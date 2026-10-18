"""Safety core of the estate layer: guarded git, guarded reads, and the private writer.

Every rule that keeps the overlay read-only lives here, so the other modules cannot drift:
git runs with a replaced environment, a fixed hardening prefix and an argument allowlist;
reads refuse secret-shaped names, symlinked final components and oversized files; every
private write goes through O_CREAT|O_EXCL|O_NOFOLLOW at 0600 under private/, walking each
ancestor without following links. Deletion is marker-gated and never follows a link.
"""
from contextlib import contextmanager
import datetime as dt
import difflib
import errno
import fnmatch
import hashlib
import json
import math
import os
import re
import signal
import stat
import subprocess
import sys
import time
from collections import namedtuple
from urllib.parse import urlsplit


LAYER_DIR = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

# BEGIN-ALLOWED-LOCATORS
# The only home-relative locations the tool names in code. Everything else is an owner-edited
# locator in private/config.toml. "~/../Shared" is the macOS shared folder beside the home
# directory, expressed relative to HOME so a synthetic HOME never reaches the real one.
HOME_PREFIX = "~/"
LOCATORS = {
    "pulse_status": "~/.kingdom/STATUS.md",
    "pulse_history": "~/.kingdom/pulse-history.jsonl",
    "registry_copy": "~/.kingdom/REGISTRY.yaml",
    "launch_agents": "~/Library/LaunchAgents",
    "claude_settings": "~/.claude/settings.json",
    "hermes_jobs": "~/.hermes/profiles/*/cron/jobs.json",
    "observer_runs": "~/.local/state/kingdom-cloudflare-observer/runs",
}
DISCOVERY_ROOTS = ("~", "~/../Shared", "~/.cache")
PRUNE_PATHS = (
    "~/Library", "~/.Trash", "~/Pictures", "~/Music", "~/Movies", "~/Applications",
    "~/.npm", "~/.cargo/registry", "~/.rustup", "~/go/pkg", "~/.bun/install/cache",
    "~/.ollama/models", "~/.cache/uv", "~/.cache/pip", "~/.cache/huggingface", "~/.docker",
)
PRUNE_NAMES = ("node_modules", ".venv", "venv", "__pycache__", ".pnpm-store", ".terraform")
# END-ALLOWED-LOCATORS


class EstateError(Exception):
    """Base class for every refusal raised by the estate tool."""


class GuardError(EstateError):
    """A guard refused; the CLI maps this to exit 2 and writes nothing further."""

    def __init__(self, message, reasons=None):
        super().__init__(message)
        self.reasons = list(reasons or [message])


class GitRefused(GuardError):
    """A git call outside the allowlist, or an object read on a promisor clone."""


class LockHeld(GuardError):
    """Another live build holds the run lock."""


def require(condition, message):
    if not condition:
        raise GuardError(message)


def utc_now():
    return dt.datetime.now(dt.timezone.utc)


def iso(moment):
    return moment.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha12(text):
    return hashlib.sha256(text.encode("utf-8", "surrogateescape")).hexdigest()[:12]


def expand_locator(locator, home=None):
    """Expand a "~"-relative locator against HOME (the synthetic one under tests)."""
    home = os.environ.get("HOME", "") if home is None else home
    require(os.path.isabs(home), "HOME must be an absolute path")
    if locator == "~":
        return os.path.normpath(home)
    if locator.startswith(HOME_PREFIX):
        return os.path.normpath(os.path.join(home, locator[len(HOME_PREFIX):]))
    require(os.path.isabs(locator), "locator must be absolute or HOME-relative: " + locator)
    return os.path.normpath(locator)


def prune_set(home=None, layer_dir=None):
    """Absolute paths the discovery walk never enters (names in PRUNE_NAMES are pruned anywhere)."""
    paths = {expand_locator(p, home) for p in PRUNE_PATHS}
    paths.add(os.path.join(os.path.realpath(layer_dir or LAYER_DIR), "private"))
    return paths


# ── git ─────────────────────────────────────────────────────────────────────────────────────

Result = namedtuple("Result", "ok out err code timed_out raw")
Result.__doc__ = """Outcome of one git call. Git failures are values, never exceptions.

ok: exit 0 and no timeout. out: stdout as text (utf-8, surrogateescape, so it round-trips to
raw). err: stderr, at most 4 KiB. code: exit status, or None after a timeout or spawn failure.
timed_out: the process group was killed. raw: stdout bytes (blob reads need exact bytes)."""

GIT_PREFIX = (
    "--no-optional-locks",
    "-c", "core.fsmonitor=false",
    "-c", "core.untrackedCache=false",
    "-c", "core.hooksPath=/dev/null",
    "-c", "gc.auto=0",
    "-c", "maintenance.auto=false",
    "-c", "protocol.allow=never",
    "-c", "protocol.file.allow=never",
    "-c", "protocol.git.allow=never",
    "-c", "protocol.http.allow=never",
    "-c", "protocol.https.allow=never",
    "-c", "protocol.ssh.allow=never",
    # ext is "never" by default, but a user config could allow it; protocol.allow does not
    # override an explicit per-protocol setting, so name it too.
    "-c", "protocol.ext.allow=never",
    "-c", "submodule.recurse=false",
    # log would verify a signed commit through gpg.program when log.showSignature is set in any
    # config; the program is the user's to choose, so it is switched off and pointed nowhere.
    "-c", "log.showSignature=false",
    "-c", "gpg.program=/usr/bin/false",
    "-c", "gpg.ssh.program=/usr/bin/false",
    "-c", "gpg.x509.program=/usr/bin/false",
)

PROMISOR_PATTERN = r"^(extensions\.partialclone|remote\..*\.promisor|remote\..*\.partialclonefilter)$"
# status re-hashes a stat-dirty file through its clean or process filter, a program named in repo
# or global config (git-lfs writes objects into the repository that way).
FILTER_PATTERN = r"^filter\..*\.(clean|process)$"

_REF = re.compile(r"[A-Za-z0-9@][A-Za-z0-9._/@{}^~+-]*")
_RANGE = re.compile(r"[A-Za-z0-9@][A-Za-z0-9._/@{}^~+-]*?\.\.\.[A-Za-z0-9@][A-Za-z0-9._/@{}^~+-]*")
_REFPATH = re.compile(r"[A-Za-z0-9@][A-Za-z0-9._/@{}^~+-]*:[^\x00\n]+")
_KEY = re.compile(r"[A-Za-z][A-Za-z0-9-]*\.[^\x00\n]+")
_PATTERN = re.compile(r"[^\x00\n-][^\x00\n]*")
# Any --format except the %G signature placeholders, which make log run gpg to verify.
_FORMAT = re.compile(r"--format=(?:(?!%G)[^\x00\n])*")
_ARGPATH = re.compile(r"[^\x00\n-][^\x00\n]*")
_ANYPATH = re.compile(r"[^\x00\n]+")

# Each shape is the complete argument list a subcommand may take; strings are literal,
# patterns must fullmatch. Nothing that writes, fetches or edits refs can be expressed in the
# arguments. Programs git itself would run from config are stopped too: hooks, fsmonitor,
# gpg and every transport by the prefix, filter drivers by refusing status (filter_state).
_SHAPES = {
    "rev-parse": (
        ("--git-dir",), ("--git-common-dir",), ("--show-toplevel",),
        ("--is-shallow-repository",), ("--abbrev-ref", "HEAD"), ("--abbrev-ref", "@{u}"),
        ("--verify", "-q", _REF), ("--verify", "-q", _REFPATH), (_REFPATH,),
    ),
    "symbolic-ref": (("-q", "--short", "HEAD"),),
    "config": (("--get", _KEY), ("--get-regexp", _PATTERN)),
    "log": (("-1", _FORMAT), ("-1", _FORMAT, _REF)),
    "rev-list": (
        ("--count", "HEAD"), ("--left-right", "--count", _RANGE),
        ("--branches", "--not", "--remotes", "--count"), ("--max-parents=0", "HEAD"),
    ),
    "for-each-ref": (("--format=%(refname)", "refs/heads"),),
    "worktree": (("list", "--porcelain"),),
    "ls-files": (("-z",), ("--error-unmatch", "--", _ANYPATH)),
    "status": (("--porcelain=v1", "-z", "-unormal", "--ignore-submodules=all"),),
}
_BLOB_SHAPES = {"cat-file": (("blob", _REFPATH),)}
_HOST_SHAPES = {
    "check-ignore": (("-q", _ARGPATH), ("-q", "--", _ANYPATH), ("-q", "--no-index", "--", _ANYPATH)),
    "ls-files": (("--", _ANYPATH),),
    "diff": (("--cached", "--name-only"), ("--cached", "--name-only", "-z")),
    "branch": (("--show-current",),),
}
ROLES = ("checkout", "kingdom", "host")


def _shape_matches(shape, args):
    if len(shape) != len(args):
        return False
    for want, got in zip(shape, args):
        if not isinstance(got, str):
            return False
        if isinstance(want, str):
            if want != got:
                return False
        elif want.fullmatch(got) is None:
            return False
    return True


def _kill_group(proc):
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass
    try:
        proc.kill()
    except ProcessLookupError:
        pass


class GitRunner:
    """Read-only git for one root. role: checkout (default), kingdom (blob reads) or host.

    The environment is replaced, not inherited (only HOME and PATH pass through), so no
    GIT_DIR, credential helper or pager from the caller can leak in. GIT_CEILING_DIRECTORIES
    stops discovery at the root, so a vanished .git never resolves to an ancestor repo."""

    def __init__(self, root, role="checkout", timeout=20, status_timeout=60, git="git", path_env=None):
        require(isinstance(root, str) and os.path.isabs(root), "GitRunner root must be absolute")
        require(role in ROLES, "unknown GitRunner role: %r" % (role,))
        self.root = root
        self.real = os.path.realpath(root)
        self.role = role
        self.timeout = timeout
        self.status_timeout = status_timeout
        self.git = git
        self.calls = []
        self._promisor = None
        self._filters = None
        self.env = {
            "HOME": os.environ.get("HOME", ""),
            "PATH": path_env if path_env is not None else os.environ.get("PATH", "/usr/bin:/bin"),
            "LC_ALL": "C",
            "GIT_OPTIONAL_LOCKS": "0",
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_ASKPASS": "/usr/bin/false",
            "SSH_ASKPASS": "/usr/bin/false",
            "GIT_SSH_COMMAND": "/usr/bin/false",
            "GCM_INTERACTIVE": "never",
            "GIT_PAGER": "cat",
            "PAGER": "cat",
            # Harmless where unsupported (Apple git 2.39); protocol.*.allow=never is the real stop.
            "GIT_NO_LAZY_FETCH": "1",
            "GIT_CEILING_DIRECTORIES": os.path.dirname(self.real),
        }

    def shapes(self, subcmd):
        shapes = _SHAPES.get(subcmd, ())
        if self.role in ("kingdom", "host"):
            shapes = shapes + _BLOB_SHAPES.get(subcmd, ())
        if self.role == "host":
            shapes = shapes + _HOST_SHAPES.get(subcmd, ())
        return shapes

    def check_allowed(self, subcmd, args):
        """Raise GitRefused unless (subcmd, args) is exactly an allowlisted shape for this role."""
        if not isinstance(subcmd, str) or not any(_shape_matches(s, args) for s in self.shapes(subcmd)):
            raise GitRefused("git call refused (not allowlisted for role %s): %s %s"
                             % (self.role, subcmd, " ".join(map(str, args))))

    @staticmethod
    def reads_objects(subcmd, args):
        # Blob/tree reads are what trigger lazy fetches on a promisor clone.
        return subcmd in ("status", "cat-file") or (subcmd == "rev-parse" and any(":" in a for a in args))

    def run(self, subcmd, *args, timeout=None):
        args = tuple(args)
        self.check_allowed(subcmd, args)
        if self.reads_objects(subcmd, args):
            flag, reasons = self.promisor_state()
            if flag is not False:
                raise GitRefused("%s refused: promisor clone or unverified config (%s)"
                                 % (subcmd, ", ".join(reasons) or "unknown"))
        if subcmd == "status":
            flag, reasons = self.filter_state()
            if flag is not False:
                raise GitRefused("status refused: filter drivers configured or unverified (%s); status "
                                 "would run them" % (", ".join(reasons) or "unknown"))
        if timeout is None:
            timeout = self.status_timeout if subcmd == "status" else self.timeout
        return self._spawn(subcmd, args, timeout)

    def _spawn(self, subcmd, args, timeout):
        argv = [self.git, *GIT_PREFIX, "-C", self.real, subcmd, *args]
        self.calls.append((subcmd,) + args)
        try:
            proc = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                    stderr=subprocess.PIPE, env=self.env, cwd="/",
                                    start_new_session=True, close_fds=True)
        except OSError as exc:
            return Result(False, "", "spawn failed: " + (exc.strerror or str(exc)), None, False, b"")
        try:
            out, err = proc.communicate(timeout=timeout)
        except subprocess.TimeoutExpired:
            _kill_group(proc)
            try:
                proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                pass
            return Result(False, "", "timeout after %ss" % timeout, None, True, b"")
        return Result(proc.returncode == 0, out.decode("utf-8", "surrogateescape"),
                      err.decode("utf-8", "replace")[:4096], proc.returncode, False, out)

    def promisor_state(self):
        """(flag, reasons): True with the matching keys, False when none is set, or None when
        the config could not be read. Callers treat None like True and skip object reads.
        Run toplevel_check first: outside a repo, git config reads only global config."""
        if self._promisor is None:
            res = self.run("config", "--get-regexp", PROMISOR_PATTERN)
            if res.timed_out:
                self._promisor = (None, ["config read timed out"])
            elif res.code == 1 and not res.out.strip():
                self._promisor = (False, [])
            elif res.ok:
                keys = [line.split(" ", 1)[0] for line in res.out.splitlines() if line.strip()]
                self._promisor = (True, keys) if keys else (None, ["config output unreadable"])
            else:
                self._promisor = (None, ["config read failed: exit %s" % res.code])
        return self._promisor

    def filter_state(self):
        """(flag, reasons) for filter.<driver>.clean/process keys in any config this repository
        reads: True with the keys, False when none is set, None when unreadable."""
        if self._filters is None:
            res = self.run("config", "--get-regexp", FILTER_PATTERN)
            if res.timed_out:
                self._filters = (None, ["config read timed out"])
            elif res.code == 1 and not res.out.strip():
                self._filters = (False, [])
            elif res.ok:
                keys = [line.split(" ", 1)[0] for line in res.out.splitlines() if line.strip()]
                self._filters = (True, keys) if keys else (None, ["config output unreadable"])
            else:
                self._filters = (None, ["config read failed: exit %s" % res.code])
        return self._filters

    def toplevel_check(self):
        """{ok, toplevel, reason}: the root must be the realpath of its own work tree top."""
        if not os.path.isdir(self.real):
            return {"ok": False, "toplevel": None, "reason": "gone"}
        res = self.run("rev-parse", "--show-toplevel")
        if res.timed_out:
            return {"ok": False, "toplevel": None, "reason": "timeout"}
        if not res.ok:
            return {"ok": False, "toplevel": None, "reason": "rev-parse failed: exit %s" % res.code}
        top = res.out.rstrip("\n")
        if os.path.realpath(top) != self.real:
            return {"ok": False, "toplevel": top, "reason": "toplevel mismatch"}
        return {"ok": True, "toplevel": top, "reason": None}

    def toplevel_ok(self):
        return self.toplevel_check()["ok"]


# ── reads ───────────────────────────────────────────────────────────────────────────────────

# Names that are never opened, only lstat'ed. Matched case-insensitively on the final component.
DENY_PATTERNS = (
    ".env*", "*.tfstate*", "*.tfvars", "*.pem", "*.key", "*mnemonic*", "priv_validator*",
    "credentials*", "auth.json", "token*", "*secret*", "*.keychain", "*.keychain-db",
)


def is_denied(name):
    low = name.lower()
    return any(fnmatch.fnmatchcase(low, pattern) for pattern in DENY_PATTERNS)


def read_checked(path, max_bytes=1 << 20):
    """(bytes, None) or (None, reason) with reason in denied, missing, symlink, not-regular,
    too-large or error:<ERRNO>. A symlinked final component is refused, never followed."""
    if is_denied(os.path.basename(path.rstrip("/"))):
        return None, "denied"
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    except FileNotFoundError:
        return None, "missing"
    except OSError as exc:
        if exc.errno == errno.ELOOP:
            return None, "symlink"
        return None, "error:" + errno.errorcode.get(exc.errno, str(exc.errno))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            return None, "not-regular"
        if info.st_size > max_bytes:
            return None, "too-large"
        chunks, remaining = [], max_bytes + 1
        while remaining > 0:
            chunk = os.read(fd, min(remaining, 1 << 16))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        data = b"".join(chunks)
        if len(data) > max_bytes:
            return None, "too-large"
        return data, None
    except OSError as exc:
        return None, "error:" + errno.errorcode.get(exc.errno, str(exc.errno))
    finally:
        os.close(fd)


def safe_read(path, max_bytes=1 << 20):
    return read_checked(path, max_bytes)[0]


# ── low-level fd helpers ────────────────────────────────────────────────────────────────────

_DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
_NEW_FILE = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC


def _plain_parts(relpath):
    require(isinstance(relpath, str) and relpath and "\x00" not in relpath, "invalid path")
    require(not os.path.isabs(relpath), "path must be relative: " + relpath)
    parts = relpath.split("/")
    require(all(p not in ("", ".", "..") for p in parts), "path must be normalized, without '..': " + relpath)
    return parts


def _open_dir(path):
    try:
        return os.open(path, _DIR_FLAGS)
    except OSError as exc:
        raise GuardError("not a real directory (missing or a symlink): %s" % path) from exc


def _walk(dir_fd, parts, create, mode=0o700):
    """Descend parts from dir_fd without following any link; returns a new fd the caller closes."""
    fd = os.dup(dir_fd)
    try:
        for part in parts:
            made = False
            if create:
                try:
                    os.mkdir(part, mode, dir_fd=fd)
                    made = True
                except FileExistsError:
                    pass
            try:
                child = os.open(part, _DIR_FLAGS, dir_fd=fd)
            except OSError as exc:
                raise GuardError("ancestor %r is missing or not a real directory" % part) from exc
            if made:
                os.fchmod(child, mode)  # mkdir honours the umask; pin the intended mode
            os.close(fd)
            fd = child
        return fd
    except BaseException:
        os.close(fd)
        raise


def _write_all(fd, payload):
    view = memoryview(payload)
    while view:
        written = os.write(fd, view)
        view = view[written:]


def _write_new_at(dir_fd, name, payload, mode):
    fd = os.open(name, _NEW_FILE, 0o600, dir_fd=dir_fd)
    try:
        _write_all(fd, payload)
        os.fsync(fd)
        os.fchmod(fd, mode)
    except BaseException:
        # We created this name with O_EXCL; never leave a half-written file behind.
        os.close(fd)
        os.unlink(name, dir_fd=dir_fd)
        raise
    os.close(fd)


def _lstat_at(dir_fd, name):
    try:
        return os.stat(name, dir_fd=dir_fd, follow_symlinks=False)
    except FileNotFoundError:
        return None


def _swap_link(dir_fd, name, target):
    """Point name at target atomically (temp link + rename); only ever replaces a symlink."""
    current = _lstat_at(dir_fd, name)
    if current is not None and not stat.S_ISLNK(current.st_mode):
        raise GuardError("refusing to replace %r: it exists and is not a symlink" % name)
    temporary = ".%s.tmp-%s" % (name, os.urandom(4).hex())
    os.symlink(target, temporary, dir_fd=dir_fd)
    try:
        os.replace(temporary, name, src_dir_fd=dir_fd, dst_dir_fd=dir_fd)
    except BaseException:
        os.unlink(temporary, dir_fd=dir_fd)
        raise


def atomic_symlink(link, target):
    """Create or retarget the symlink at link. The parent must be a real directory."""
    parent, name = os.path.split(os.path.abspath(link))
    _plain_parts(name)
    dir_fd = _open_dir(parent)
    try:
        _swap_link(dir_fd, name, target)
    finally:
        os.close(dir_fd)


# ── the private area ────────────────────────────────────────────────────────────────────────

# A3: the only writes outside private/ are these two relative links at the layer root.
ROOT_LINKS = {"atlas.html": "private/ATLAS.html", "tree": "private/tree"}
PRIVATE_GUARD_LINE = "/" + "private/"


class PrivateArea:
    """The single writer for private/. Paths are relative to private/ (or absolute inside it)."""

    def __init__(self, layer_dir=None):
        self.layer = os.path.realpath(layer_dir or LAYER_DIR)
        self.root = os.path.join(self.layer, "private")

    # -- guards --
    def dir_problems(self):
        try:
            info = os.lstat(self.root)
        except FileNotFoundError:
            return ["private area is missing"]
        if stat.S_ISLNK(info.st_mode):
            return ["private area is a symlink"]
        if not stat.S_ISDIR(info.st_mode):
            return ["private area is not a directory"]
        problems = []
        if info.st_uid != os.getuid():
            problems.append("private area is not owned by uid %d" % os.getuid())
        if stat.S_IMODE(info.st_mode) & 0o077:
            problems.append("private area is group/world accessible (mode %o)" % stat.S_IMODE(info.st_mode))
        return problems

    def guard_problems(self):
        """Each of the two ignore guards checked on its own (spec 9: the private area is ignored
        twice), because git's answer for the canary stays right while either one still holds."""
        problems = []
        raw, reason = read_checked(os.path.join(self.layer, ".gitignore"), 64 << 10)
        lines = raw.decode("utf-8", "replace").splitlines() if raw is not None else []
        if PRIVATE_GUARD_LINE not in [line.strip() for line in lines]:
            problems.append("guard 1: the layer .gitignore has no %r line (%s)"
                            % (PRIVATE_GUARD_LINE, reason or "line absent"))
        raw, reason = read_checked(os.path.join(self.root, ".gitignore"), 4096)
        if raw != b"*\n":
            problems.append("guard 2: private/.gitignore is not a regular file holding exactly '*' (%s)"
                            % (reason or "other content"))
        return problems

    def preflight(self, host_repo):
        """Refuse (GuardError listing every reason) unless git ignores the canary and the two
        root links, nothing under private/ is tracked, and private/ is a 0700 dir we own."""
        problems = []
        if sys.version_info < (3, 11):
            problems.append("python %d.%d < 3.11" % sys.version_info[:2])
        problems += self.dir_problems()
        canary = os.path.join(self.root, "DO-NOT-COMMIT")
        info = _lstat_or_none(canary)
        if info is None or not stat.S_ISREG(info.st_mode):
            problems.append("canary DO-NOT-COMMIT is missing or not a regular file")
        problems += self.guard_problems()
        host = os.path.realpath(host_repo)
        rel = os.path.relpath(self.layer, host)
        if rel == "." or rel.startswith(".."):
            problems.append("layer is not inside the host repository")
        else:
            git = GitRunner(host, role="host")
            top = git.toplevel_check()
            if not top["ok"]:
                problems.append("host repository check failed: %s" % top["reason"])
            else:
                for path in (os.path.join(rel, "private", "DO-NOT-COMMIT"),
                             os.path.join(rel, "atlas.html"), os.path.join(rel, "tree")):
                    res = git.run("check-ignore", "-q", "--", path)
                    if res.code != 0:
                        problems.append("git does not ignore %s (check-ignore exit %s)" % (path, res.code))
                res = git.run("ls-files", "--", os.path.join(rel, "private"))
                if not res.ok:
                    problems.append("ls-files over the private area failed: exit %s" % res.code)
                elif res.out.strip():
                    problems.append("git tracks files under the private area")
        if problems:
            raise GuardError("preflight refused: " + "; ".join(problems), problems)
        return {"host": host, "layer_rel": rel}

    # -- path handling --
    def parts(self, path):
        require(isinstance(path, str) and path and "\x00" not in path, "invalid path")
        if os.path.isabs(path):
            norm = os.path.normpath(path)
            require(norm.startswith(self.root + os.sep), "refusing a write outside the private area: " + path)
            path = norm[len(self.root) + 1:]
        try:
            return _plain_parts(path)
        except GuardError as exc:
            raise GuardError("refusing a write outside the private area: %s (%s)" % (path, exc)) from exc

    def path(self, relpath):
        return os.path.join(self.root, *self.parts(relpath))

    @contextmanager
    def _parent(self, parts, parents):
        root_fd = _open_dir(self.root)
        try:
            fd = _walk(root_fd, parts[:-1], create=parents)
        finally:
            os.close(root_fd)
        try:
            yield fd
        finally:
            os.close(fd)

    # -- writers --
    def write(self, relpath, data, mode=0o600, parents=False):
        """Create a new file; never overwrites (O_EXCL), never follows a link (O_NOFOLLOW)."""
        parts = self.parts(relpath)
        require(mode & 0o077 == 0, "private files may not be group/world accessible")
        payload = data.encode("utf-8") if isinstance(data, str) else bytes(data)
        with self._parent(parts, parents) as dir_fd:
            try:
                _write_new_at(dir_fd, parts[-1], payload, mode)
            except FileExistsError as exc:
                raise GuardError("refusing to overwrite %s" % "/".join(parts)) from exc
        return os.path.join(self.root, *parts)

    def replace(self, relpath, data, mode=0o600):
        """Atomically replace a regular file (temp + rename). Only owner-input files such as
        config.toml need this; generated outputs are always new files in a new run."""
        parts = self.parts(relpath)
        require(mode & 0o077 == 0, "private files may not be group/world accessible")
        payload = data.encode("utf-8") if isinstance(data, str) else bytes(data)
        with self._parent(parts, False) as dir_fd:
            current = _lstat_at(dir_fd, parts[-1])
            require(current is None or stat.S_ISREG(current.st_mode),
                    "refusing to replace %s: not a regular file" % "/".join(parts))
            temporary = ".%s.estate-%s" % (parts[-1], os.urandom(4).hex())
            _write_new_at(dir_fd, temporary, payload, mode)
            try:
                os.replace(temporary, parts[-1], src_dir_fd=dir_fd, dst_dir_fd=dir_fd)
            except BaseException:
                os.unlink(temporary, dir_fd=dir_fd)
                raise
        return os.path.join(self.root, *parts)

    def mkdir(self, relpath):
        parts = self.parts(relpath)
        root_fd = _open_dir(self.root)
        try:
            os.close(_walk(root_fd, parts, create=True))
        finally:
            os.close(root_fd)
        return os.path.join(self.root, *parts)

    def symlink(self, relpath, target):
        """Create or atomically retarget a link inside the private area (current, ATLAS.*)."""
        parts = self.parts(relpath)
        with self._parent(parts, False) as dir_fd:
            _swap_link(dir_fd, parts[-1], target)
        return os.path.join(self.root, *parts)

    def remove_link(self, relpath):
        """Remove a symlink inside the private area (private/tree on untree); never a file or dir."""
        parts = self.parts(relpath)
        with self._parent(parts, False) as dir_fd:
            current = _lstat_at(dir_fd, parts[-1])
            if current is None:
                return "absent"
            require(stat.S_ISLNK(current.st_mode), "refusing to remove %s: not a symlink" % "/".join(parts))
            os.unlink(parts[-1], dir_fd=dir_fd)
            return "removed"

    # -- curated lock --
    def _chmod_curated(self, mode):
        root_fd = _open_dir(self.root)
        try:
            fd = _walk(root_fd, ["curated"], create=False)
        finally:
            os.close(root_fd)
        try:
            os.fchmod(fd, mode)
        finally:
            os.close(fd)

    def unlock_curated(self):
        self._chmod_curated(0o700)

    def lock_curated(self):
        self._chmod_curated(0o500)

    @contextmanager
    def curated_writable(self):
        self.unlock_curated()
        try:
            yield
        finally:
            self.lock_curated()

    def curated_mode(self):
        info = _lstat_or_none(os.path.join(self.root, "curated"))
        return None if info is None or not stat.S_ISDIR(info.st_mode) else stat.S_IMODE(info.st_mode)

    # -- the two root links (A3) --
    def ensure_root_link(self, name):
        """Create layer/<name> -> its fixed private target; 'present' if already ours.
        Anything else at that name (a file, a dir, a foreign link) is refused, never replaced."""
        require(name in ROOT_LINKS, "not an allowed root link: %r" % (name,))
        target = ROOT_LINKS[name]
        layer_fd = _open_dir(self.layer)
        try:
            current = _lstat_at(layer_fd, name)
            if current is not None:
                require(stat.S_ISLNK(current.st_mode) and os.readlink(name, dir_fd=layer_fd) == target,
                        "refusing to touch %s: it is not the link the tool created" % name)
                return "present"
            os.symlink(target, name, dir_fd=layer_fd)
            return "created"
        finally:
            os.close(layer_fd)

    def remove_root_link(self, name):
        require(name in ROOT_LINKS, "not an allowed root link: %r" % (name,))
        layer_fd = _open_dir(self.layer)
        try:
            current = _lstat_at(layer_fd, name)
            if current is None:
                return "absent"
            require(stat.S_ISLNK(current.st_mode) and os.readlink(name, dir_fd=layer_fd) == ROOT_LINKS[name],
                    "refusing to remove %s: it is not the link the tool created" % name)
            os.unlink(name, dir_fd=layer_fd)
            return "removed"
        finally:
            os.close(layer_fd)


def _lstat_or_none(path):
    try:
        return os.lstat(path)
    except FileNotFoundError:
        return None


# ── committed files (owner verbs only) ──────────────────────────────────────────────────────

COMMITTED_DIRS = ("curated", "vocab")


def _diff(old, new, relpath, verb):
    def lines(text):
        out = text.splitlines(True)
        if out and not out[-1].endswith("\n"):
            out[-1] += "\n\\ No newline at end of file\n"
        return out
    source = "a/" + relpath if old is not None else "/dev/null"
    return "".join(difflib.unified_diff(lines(old or ""), lines(new), fromfile=source,
                                        tofile="b/%s (estate %s)" % (relpath, verb)))


def write_committed(relpath, text, verb, write, layer_dir=None, quiet=False):
    """Owner-verb writer for curated/** and vocab/**: prints the unified diff first, changes the
    file only when write is True, via a temp file and rename in the same directory.
    Returns {path, changed, written, diff}."""
    parts = _plain_parts(relpath)
    require(parts[0] in COMMITTED_DIRS and len(parts) > 1,
            "committed writes are limited to curated/ and vocab/: " + relpath)
    require(isinstance(text, str), "committed text must be str")
    layer_fd = _open_dir(os.path.realpath(layer_dir or LAYER_DIR))
    try:
        dir_fd, old = _committed_parent(layer_fd, parts, create=False)
        try:
            if dir_fd is not None:
                old = _read_committed(dir_fd, parts)
            diff = _diff(old, text, relpath, verb)
            changed = old != text
            if not quiet:
                sys.stdout.write(diff if changed else "unchanged: %s\n" % relpath)
            written = False
            if write and changed:
                if dir_fd is None:
                    dir_fd, _ = _committed_parent(layer_fd, parts, create=True)
                temporary = ".%s.estate-%s" % (parts[-1], os.urandom(4).hex())
                _write_new_at(dir_fd, temporary, text.encode("utf-8"), 0o644)
                try:
                    os.replace(temporary, parts[-1], src_dir_fd=dir_fd, dst_dir_fd=dir_fd)
                except BaseException:
                    os.unlink(temporary, dir_fd=dir_fd)
                    raise
                written = True
        finally:
            if dir_fd is not None:
                os.close(dir_fd)
    finally:
        os.close(layer_fd)
    return {"path": relpath, "changed": changed, "written": written, "diff": diff}


def _committed_parent(layer_fd, parts, create):
    """(fd, None) for the parent dir, or (None, None) when it does not exist and create is False."""
    fd = os.dup(layer_fd)
    try:
        for part in parts[:-1]:
            made = False
            if create:
                try:
                    os.mkdir(part, 0o755, dir_fd=fd)
                    made = True
                except FileExistsError:
                    pass
            try:
                child = os.open(part, _DIR_FLAGS, dir_fd=fd)
            except FileNotFoundError:
                os.close(fd)
                return None, None
            except OSError as exc:
                raise GuardError("committed path ancestor %r is not a real directory" % part) from exc
            if made:
                os.fchmod(child, 0o755)  # committed dirs are ordinary repo dirs, whatever the umask
            os.close(fd)
            fd = child
        return fd, None
    except BaseException:
        os.close(fd)
        raise


def _read_committed(dir_fd, parts):
    try:
        fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=dir_fd)
    except FileNotFoundError:
        return None
    except OSError as exc:
        raise GuardError("refusing %s: not a regular file (symlink?)" % "/".join(parts)) from exc
    with os.fdopen(fd, "rb") as stream:
        require(stat.S_ISREG(os.fstat(stream.fileno()).st_mode), "refusing %s: not a regular file" % "/".join(parts))
        raw = stream.read()
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise GuardError("refusing %s: existing file is not utf-8" % "/".join(parts)) from exc


# ── run lock ────────────────────────────────────────────────────────────────────────────────

LOCK_NAME = "estate.lock"
LOCK_STALE_AFTER_S = 2 * 3600


def pid_alive(pid):
    if not isinstance(pid, int) or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _parse_iso(text):
    try:
        moment = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=dt.timezone.utc)


class RunLock:
    """O_EXCL lock file {pid, started_at, nonce} in private/. A lock whose pid is dead, or
    that is older than 2 h, is removed, reported on stderr and kept in .recovered for run.json."""

    def __init__(self, private_dir, clock=time.time):
        self.private = private_dir
        self.clock = clock
        self.nonce = os.urandom(8).hex()
        self.recovered = None
        self.held = False

    def __enter__(self):
        return self.acquire()

    def __exit__(self, *exc):
        self.release()

    def acquire(self):
        for attempt in (1, 2):
            dir_fd = _open_dir(self.private)
            try:
                try:
                    payload = json.dumps({"pid": os.getpid(), "started_at": iso(dt.datetime.fromtimestamp(
                        self.clock(), dt.timezone.utc)), "nonce": self.nonce}) + "\n"
                    _write_new_at(dir_fd, LOCK_NAME, payload.encode("utf-8"), 0o600)
                    self.held = True
                    return self
                except FileExistsError:
                    if attempt == 2:
                        raise LockHeld("run lock reappeared while recovering a stale one")
                    info = self._inspect(dir_fd)
                    if not info["stale"]:
                        raise LockHeld("another build holds the run lock (pid %s since %s)"
                                       % (info["pid"], info["started_at"]))
                    if not self._take_stale(dir_fd, info["raw"]):
                        raise LockHeld("another build replaced the stale run lock first")
                    self.recovered = {k: info[k] for k in ("pid", "started_at", "age_s", "reason")}
                    sys.stderr.write("estate: recovered stale run lock (%s; pid %s, started %s)\n"
                                     % (info["reason"], info["pid"], info["started_at"]))
            finally:
                os.close(dir_fd)
        raise LockHeld("run lock could not be acquired")

    def _inspect(self, dir_fd):
        info = os.stat(LOCK_NAME, dir_fd=dir_fd, follow_symlinks=False)
        require(stat.S_ISREG(info.st_mode), "run lock is not a regular file; refusing to touch it")
        fd = os.open(LOCK_NAME, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=dir_fd)
        with os.fdopen(fd, "rb") as stream:
            raw = stream.read(4096)
        pid, started, started_at = None, None, None
        try:
            data = json.loads(raw.decode("utf-8"))
            pid = data.get("pid") if type(data.get("pid")) is int else None
            started_at = data.get("started_at")
            started = _parse_iso(started_at) if isinstance(started_at, str) else None
        except (ValueError, UnicodeDecodeError, AttributeError):
            pass
        now = self.clock()
        age = now - (started.timestamp() if started else info.st_mtime)
        if pid is None:
            # A lock is created and written in one step, so an unreadable one older than a
            # minute was left by a crash, not by a writer mid-flight.
            stale, reason = age > 60, "unreadable lock"
        elif not pid_alive(pid):
            stale, reason = True, "dead pid"
        elif age > LOCK_STALE_AFTER_S:
            stale, reason = True, "older than 2 h"
        else:
            stale, reason = False, "held"
        return {"pid": pid, "started_at": started_at, "age_s": int(age), "stale": stale,
                "reason": reason, "raw": raw}

    @staticmethod
    def _take_stale(dir_fd, raw):
        """Move the stale lock aside under a unique name, so that of two builds recovering the
        same stale lock only one wins (a rename succeeds once), then drop it if it still holds
        the bytes that were judged stale. A lock that changed in between belonged to a build that
        just took it: it is put back, never deleted. True when the stale lock is gone."""
        aside = ".%s.stale-%s" % (LOCK_NAME, os.urandom(4).hex())
        try:
            os.rename(LOCK_NAME, aside, src_dir_fd=dir_fd, dst_dir_fd=dir_fd)
        except FileNotFoundError:
            return False
        again = _read_small_at(dir_fd, aside)
        if again == raw:
            os.unlink(aside, dir_fd=dir_fd)
            return True
        try:
            # link fails rather than replace a lock created meanwhile.
            os.link(aside, LOCK_NAME, src_dir_fd=dir_fd, dst_dir_fd=dir_fd, follow_symlinks=False)
            os.unlink(aside, dir_fd=dir_fd)
        except FileExistsError:
            sys.stderr.write("estate: a live run lock was displaced while recovering a stale one; it is kept "
                             "as private/%s\n" % aside)
        return False

    def release(self):
        if not self.held:
            return
        self.held = False
        dir_fd = _open_dir(self.private)
        try:
            try:
                fd = os.open(LOCK_NAME, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=dir_fd)
            except FileNotFoundError:
                sys.stderr.write("estate: run lock vanished before release\n")
                return
            with os.fdopen(fd, "rb") as stream:
                raw = stream.read(4096)
            try:
                ours = json.loads(raw.decode("utf-8")).get("nonce") == self.nonce
            except (ValueError, UnicodeDecodeError, AttributeError):
                ours = False
            if ours:
                os.unlink(LOCK_NAME, dir_fd=dir_fd)
            else:
                sys.stderr.write("estate: run lock belongs to another process; left in place\n")
        finally:
            os.close(dir_fd)


# ── marker-gated deletion ───────────────────────────────────────────────────────────────────

RUN_ID = re.compile(r"\d{8}T\d{6}Z-[0-9a-f]{4}")
RUN_MARKER = ".estate-run"
TREE_MANIFEST = ".estate-tree.json"


def _read_small_at(dir_fd, name, limit=4096):
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=dir_fd)
    except OSError:
        return None
    with os.fdopen(fd, "rb") as stream:
        if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode):
            return None
        return stream.read(limit)


def _remove_contents(dir_fd, counts):
    """Bottom-up removal through fds: unlink files and links, rmdir dirs, never follow a link."""
    with os.scandir(dir_fd) as entries:
        names = [entry.name for entry in entries]
    for name in names:
        info = os.stat(name, dir_fd=dir_fd, follow_symlinks=False)
        if stat.S_ISDIR(info.st_mode):
            child = os.open(name, _DIR_FLAGS, dir_fd=dir_fd)
            try:
                _remove_contents(child, counts)
            finally:
                os.close(child)
            os.rmdir(name, dir_fd=dir_fd)
            counts["dirs"] += 1
        else:
            os.unlink(name, dir_fd=dir_fd)
            counts["links" if stat.S_ISLNK(info.st_mode) else "files"] += 1
    return counts


def _open_marked_run(parent_fd, name):
    info = _lstat_at(parent_fd, name)
    require(info is not None and stat.S_ISDIR(info.st_mode), "refusing %s: not a real directory" % name)
    fd = os.open(name, _DIR_FLAGS, dir_fd=parent_fd)
    marker = _read_small_at(fd, RUN_MARKER)
    if marker is None or marker.decode("utf-8", "replace").strip() != name:
        os.close(fd)
        raise GuardError("refusing %s: run marker missing or not equal to the directory name" % name)
    return fd


def require_run_dir(area, run_dir):
    """(run relpath, run id) for run_dir when it is a marked run directly inside area's runs/
    (runs/<run id> holding a .estate-run marker that names it); GuardError otherwise. The one
    guard every writer into a run uses, so the rule cannot drift between them."""
    run_real = os.path.realpath(run_dir)
    name = os.path.basename(run_real)
    require(os.path.dirname(run_real) == os.path.join(area.root, "runs") and RUN_ID.fullmatch(name) is not None,
            "not a run directory (<private>/runs/<run id>): %s" % run_dir)
    marker = safe_read(os.path.join(run_real, RUN_MARKER), 4096)
    require(marker is not None and marker.decode("utf-8", "replace").strip() == name,
            "run marker missing or not equal to the run id: %s" % run_dir)
    return "runs/" + name, name


def remove_run_dir(path, runs_root):
    """Delete one run directory, only if its name is a run id, its marker names it, and it sits
    directly in runs_root (a real directory). Returns {files, links, dirs} removed."""
    require(not os.path.islink(runs_root), "refusing: runs root is a symlink")
    name = os.path.basename(os.path.normpath(path))
    require(RUN_ID.fullmatch(name) is not None, "refusing %s: not a run id" % name)
    runs_real = os.path.realpath(runs_root)
    require(os.path.realpath(os.path.dirname(os.path.abspath(os.path.normpath(path)))) == runs_real,
            "refusing %s: not directly inside the runs root" % path)
    parent_fd = _open_dir(runs_real)
    try:
        fd = _open_marked_run(parent_fd, name)
        try:
            counts = _remove_contents(fd, {"files": 0, "links": 0, "dirs": 0})
        finally:
            os.close(fd)
        os.rmdir(name, dir_fd=parent_fd)
        counts["dirs"] += 1
        return counts
    finally:
        os.close(parent_fd)


def remove_tree_dir(path, run_dir):
    """Delete <run_dir>/tree, only if run_dir is a marked run and the tree holds its manifest."""
    run_real = os.path.realpath(run_dir)
    require(not os.path.islink(run_dir), "refusing: run dir is a symlink")
    require(os.path.basename(os.path.normpath(path)) == "tree", "refusing %s: not a tree dir" % path)
    require(os.path.realpath(os.path.dirname(os.path.abspath(os.path.normpath(path)))) == run_real,
            "refusing %s: not directly inside the run dir" % path)
    parent_fd = _open_dir(os.path.dirname(run_real))
    try:
        run_fd = _open_marked_run(parent_fd, os.path.basename(run_real))
    finally:
        os.close(parent_fd)
    try:
        info = _lstat_at(run_fd, "tree")
        if info is None:
            return {"files": 0, "links": 0, "dirs": 0}
        require(stat.S_ISDIR(info.st_mode), "refusing tree: not a real directory")
        tree_fd = os.open("tree", _DIR_FLAGS, dir_fd=run_fd)
        try:
            require(_read_small_at(tree_fd, TREE_MANIFEST, 1) is not None,
                    "refusing tree: manifest %s missing" % TREE_MANIFEST)
            counts = _remove_contents(tree_fd, {"files": 0, "links": 0, "dirs": 0})
        finally:
            os.close(tree_fd)
        os.rmdir("tree", dir_fd=run_fd)
        counts["dirs"] += 1
        return counts
    finally:
        os.close(run_fd)


# ── SHA256SUMS ──────────────────────────────────────────────────────────────────────────────

SUMS_NAME = "SHA256SUMS"


def _sha256_at(dir_fd, name):
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=dir_fd)
    digest = hashlib.sha256()
    with os.fdopen(fd, "rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sum_entries(run_dir):
    """{relpath: sha256} for every regular file except SHA256SUMS and anything under tree/."""
    entries = {}

    def walk(dir_fd, prefix):
        with os.scandir(dir_fd) as it:
            names = sorted(entry.name for entry in it)
        for name in names:
            if not prefix and name in ("tree", SUMS_NAME):
                continue
            info = os.stat(name, dir_fd=dir_fd, follow_symlinks=False)
            rel = prefix + name
            if stat.S_ISDIR(info.st_mode):
                child = os.open(name, _DIR_FLAGS, dir_fd=dir_fd)
                try:
                    walk(child, rel + "/")
                finally:
                    os.close(child)
            elif stat.S_ISREG(info.st_mode):
                entries[rel] = _sha256_at(dir_fd, name)

    fd = _open_dir(run_dir)
    try:
        walk(fd, "")
    finally:
        os.close(fd)
    return entries


def write_sums(run_dir):
    """Write run_dir/SHA256SUMS (shasum -a 256 -c format); refuses if one already exists."""
    entries = _sum_entries(run_dir)
    bad = [rel for rel in entries if "\n" in rel or "\\" in rel]
    require(not bad, "file names unsuitable for SHA256SUMS: %r" % bad)
    body = "".join("%s  %s\n" % (entries[rel], rel) for rel in sorted(entries))
    fd = _open_dir(run_dir)
    try:
        try:
            _write_new_at(fd, SUMS_NAME, body.encode("utf-8"), 0o600)
        except FileExistsError as exc:
            raise GuardError("refusing to overwrite %s (runs are immutable after seal)" % SUMS_NAME) from exc
    finally:
        os.close(fd)
    return len(entries)


def verify_sums(run_dir):
    """{ok, modified, missing, unexpected, errors}; ok only when all four lists are empty."""
    report = {"ok": False, "modified": [], "missing": [], "unexpected": [], "errors": []}
    raw, reason = read_checked(os.path.join(run_dir, SUMS_NAME), max_bytes=16 << 20)
    if raw is None:
        report["errors"].append("%s unreadable: %s" % (SUMS_NAME, reason))
        return report
    recorded = {}
    for number, line in enumerate(raw.decode("utf-8", "replace").splitlines(), 1):
        match = re.fullmatch(r"([0-9a-f]{64})  (.+)", line)
        if match is None:
            report["errors"].append("malformed line %d" % number)
            continue
        recorded[match.group(2)] = match.group(1)
    try:
        current = _sum_entries(run_dir)
    except (OSError, GuardError) as exc:
        report["errors"].append("cannot walk run dir: %s" % exc)
        return report
    report["modified"] = sorted(r for r in recorded if r in current and current[r] != recorded[r])
    report["missing"] = sorted(r for r in recorded if r not in current)
    report["unexpected"] = sorted(r for r in current if r not in recorded)
    report["ok"] = not any(report[k] for k in ("modified", "missing", "unexpected", "errors"))
    return report


# ── TOML writer ─────────────────────────────────────────────────────────────────────────────

class Inline(dict):
    """A dict that toml_dumps writes as an inline table instead of a [section]."""


_BARE_KEY = re.compile(r"[A-Za-z0-9_-]+")
_ESCAPES = {'"': '\\"', "\\": "\\\\", "\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f", "\r": "\\r"}


def _toml_string(text):
    out = ['"']
    for ch in text:
        code = ord(ch)
        if ch in _ESCAPES:
            out.append(_ESCAPES[ch])
        elif code < 0x20 or code == 0x7F:
            out.append("\\u%04x" % code)
        elif 0xD800 <= code <= 0xDFFF:
            raise ValueError("unpaired surrogate in TOML string")
        else:
            out.append(ch)
    out.append('"')
    return "".join(out)


def _toml_key(key):
    if not isinstance(key, str) or not key:
        raise TypeError("TOML keys must be non-empty strings, got %r" % (key,))
    return key if _BARE_KEY.fullmatch(key) else _toml_string(key)


def _toml_value(value, where):
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("non-finite float at %s" % where)
        return repr(value)
    if isinstance(value, str):
        return _toml_string(value)
    if isinstance(value, (dt.datetime, dt.time)):
        return value.isoformat()
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(_toml_value(v, where) for v in value) + "]"
    if isinstance(value, dict):
        if not value:
            return "{}"
        return "{ " + ", ".join("%s = %s" % (_toml_key(k), _toml_value(v, where + "." + str(k)))
                                for k, v in value.items()) + " }"
    if value is None:
        raise TypeError("None has no TOML form (at %s); omit the key instead" % where)
    raise TypeError("unsupported TOML value %r at %s" % (type(value).__name__, where))


def _is_table_array(value):
    return (isinstance(value, list) and bool(value)
            and all(isinstance(v, dict) and not isinstance(v, Inline) for v in value))


def _emit_table(table, path, lines, array):
    scalars, tables, arrays = [], [], []
    for key, value in table.items():
        if isinstance(value, dict) and not isinstance(value, Inline):
            tables.append((key, value))
        elif _is_table_array(value):
            arrays.append((key, value))
        else:
            scalars.append((key, value))
    if path:
        if lines:
            lines.append("")
        header = ".".join(_toml_key(p) for p in path)
        lines.append(("[[%s]]" if array else "[%s]") % header)
    where = ".".join(path) or "<root>"
    for key, value in scalars:
        lines.append("%s = %s" % (_toml_key(key), _toml_value(value, where + "." + str(key))))
    for key, value in tables:
        _emit_table(value, path + (key,), lines, False)
    for key, items in arrays:
        for item in items:
            _emit_table(item, path + (key,), lines, True)


def toml_dumps(obj):
    """Serialize a dict to TOML that tomllib.loads reads back equal (tuples come back as lists).
    Supports str, int, bool, finite float, date/datetime/time, arrays, tables, arrays of tables
    and Inline tables. None is refused rather than silently dropped."""
    if not isinstance(obj, dict):
        raise TypeError("toml_dumps needs a dict at the top level")
    lines = []
    _emit_table(obj, (), lines, False)
    return "\n".join(lines) + "\n" if lines else ""


# ── redaction and identity ──────────────────────────────────────────────────────────────────

SECRET_NAME = re.compile(r"(?i)pass|secret|token|key|mnemonic|cred|auth")
# NAME= at a word start, after a quote, or as a URL query parameter (?name= / &name=).
_ASSIGNMENT = re.compile(r"(?<![^\s;&|(?'\"])(-{0,2}[A-Za-z_][A-Za-z0-9_.-]*)=")
_USERINFO = re.compile(r"(?i)\b([a-z][a-z0-9+.-]*://)[^/\s@:]+:[^/\s@]+@")
_HEADER_CREDENTIAL = re.compile(r"(?i)\b(bearer|basic)\s+[^\s'\"]+")


def _paren_end(text, start):
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "(":
            depth += 1
        elif text[index] == ")":
            depth -= 1
            if depth == 0:
                return index + 1
    return len(text)


def _strip_substitutions(text):
    # Quotes are ignored on purpose: a "$(" kept inside quotes would still reach a record.
    out, index = [], 0
    while index < len(text):
        if text.startswith("$(", index):
            index = _paren_end(text, index + 1)
            out.append("<subst>")
        elif text[index] == "`":
            close = text.find("`", index + 1)
            index = len(text) if close < 0 else close + 1
            out.append("<subst>")
        else:
            out.append(text[index])
            index += 1
    return "".join(out)


def _word_end(text, index):
    while index < len(text):
        ch = text[index]
        if ch in " \t\n;&|":
            break
        if ch == "\\":
            index += 2
            continue
        if ch in "'\"":
            close = text.find(ch, index + 1)
            index = len(text) if close < 0 else close + 1
            continue
        index += 1
    return min(index, len(text))


def redact_command(text):
    """Make a command line safe to store: $(...) and backticks become <subst>; the value of any
    NAME=value, --name=value or ?name=value whose name looks secret becomes <redacted>; URL
    userinfo and Bearer/Basic header values are dropped. An unterminated quote redacts to the
    end of the line rather than guess. Pure text processing; nothing is executed or expanded."""
    text = _strip_substitutions(text)
    out, cursor = [], 0
    for match in _ASSIGNMENT.finditer(text):
        if match.start() < cursor or not SECRET_NAME.search(match.group(1)):
            continue
        out.append(text[cursor:match.end()])
        out.append("<redacted>")
        opener = text[match.start() - 1] if match.start() else ""
        if opener in ("'", '"'):
            # 'NAME=value' quoted as a whole: the value runs to the closing quote.
            close = text.find(opener, match.end())
            cursor = len(text) if close < 0 else close
        else:
            cursor = _word_end(text, match.end())
    out.append(text[cursor:])
    text = _USERINFO.sub(r"\1<redacted>@", "".join(out))
    return _HEADER_CREDENTIAL.sub(r"\1 <redacted>", text)


_SCP_LIKE = re.compile(r"(?:[^@/\s]+@)?([^:/\s]+):(?!//)(.+)")


def normalize_remote(url):
    """Forge identity of a remote URL: host/owner/repo, lowercase, no userinfo, port, .git or
    trailing slash. file:// URLs and local paths become file:<sha12(path)> (private ids).
    Returns None when the URL has no recognisable form."""
    if not isinstance(url, str) or not url.strip():
        return None
    text = url.strip()
    if text.lower().startswith("file://"):
        return "file:" + sha12(text[7:])
    if text.startswith(("/", "./", "../", "~")) or text in (".", "..") or ":" not in text:
        return "file:" + sha12(text)
    if "://" in text:
        try:
            parts = urlsplit(text)
            host, path = parts.hostname, parts.path
        except ValueError:
            return None
        if not host:
            return None
    else:
        match = _SCP_LIKE.fullmatch(text)
        if match is None:
            return None
        host, path = match.group(1), match.group(2)
    ident = (host + "/" + path.strip("/")).lower().rstrip("/")
    if ident.endswith(".git"):
        ident = ident[:-4].rstrip("/")
    return ident if "/" in ident and not ident.endswith("/") else None
