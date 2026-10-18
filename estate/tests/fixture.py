"""Test harness for the estate layer: an audit hook plus builders for a synthetic estate.

While a test class is active the audit hook refuses network calls, every subprocess except git
and the binaries a test explicitly allows, and writes outside the class's temporary root. The
builders create, under that root, the complete synthetic estate of spec section 13: a fake
kingdom-os with a diverging origin/main, carded and uncarded repos, a promisor clone, an
alternates pair, worktrees, nested and home-level repos, the host repo with its estate layer,
citizens, pulse files, LaunchAgents, scheduler stubs, a portfolio-map/1 file and forge listings.

Secret-shaped strings are planted by concatenation so the committed tree passes the privacy
lint; nothing here touches the real HOME, the network or any real repository.
"""
from contextlib import contextmanager
import datetime as dt
import json
import os
import plistlib
import shutil
import stat
import subprocess
import sys
import tempfile
import time
import types
import unittest

TESTS_DIR = os.path.dirname(os.path.realpath(__file__))
LAYER_DIR = os.path.dirname(TESTS_DIR)
TOOL_DIR = os.path.join(LAYER_DIR, "tool")
if TOOL_DIR not in sys.path:
    sys.path.insert(0, TOOL_DIR)
# A write of __pycache__ into the real layer would trip the audit hook; never write bytecode.
sys.dont_write_bytecode = True

import safety  # noqa: E402  (needs TOOL_DIR on sys.path)


# ── planted strings (concatenated so the source stays lint-clean) ───────────────────────────

HOME_REL = "~" + "/"
FIXTURE_EMAIL = "fixture" + "@" + "example.invalid"
CRON_SECRET_LINE = "FIXTURE_PASS" + "PHRASE" + "=$(security x) run.sh"
CRON_SECRET_REDACTED = "FIXTURE_PASS" + "PHRASE" + "=<redacted> run.sh"
PLIST_SECRET_NAME = "API_" + "TOKEN"
PLIST_SECRET_VALUE = "fixture-" + "launchagent-value-never-stored"
NEVER_READ = "fixture-" + "content-that-must-never-be-read"

KINGDOM_ENUMS = {
    "kind": ["doctrine", "service", "firmware", "ops", "lineage", "venture", "infra", "methodology",
             "reference", "unknown"],
    "layer": ["soul", "runtime", "nervous", "fleet", "economy", "commerce", "os"],
    "owner_sister": ["alpha", "beta", "gamma", "sophia", "none"],
    "domain": ["sophia", "alpha", "beta", "gamma", "commerce", "none"],
    "state": ["active", "dormant", "archived", "frozen", "reference", "remote", "unknown"],
}
LAYER_ORDER = ["soul", "runtime", "nervous", "fleet", "economy", "commerce", "os"]
KOS_REMOTE = "https://github.com/cambridgetcg/KINGDOM-OS.git"


# ── audit hook ──────────────────────────────────────────────────────────────────────────────

_STATE = sys.__dict__.setdefault("_estate_audit_state", {
    "installed": False, "active": False, "roots": (), "names": set(), "paths": set(),
    "violations": [], "spawned": [], "opened": None,
})

_NET_EVENTS = {"socket.connect", "socket.getaddrinfo", "socket.gethostbyname",
               "socket.gethostbyaddr", "socket.sendto", "socket.sendmsg"}
_WRITE_FLAGS = os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND
# event -> ((path index, dir_fd index), ...) for every path the event may modify
_PATH_EVENTS = {
    "os.mkdir": ((0, 2),), "os.rmdir": ((0, 1),), "os.remove": ((0, 1),),
    "os.rename": ((0, 2), (1, 3)), "os.link": ((1, 3),), "os.symlink": ((1, 2),),
    "os.chmod": ((0, 2),), "os.chown": ((0, 3),), "os.truncate": ((0, None),),
    "os.utime": ((0, 3),), "os.chflags": ((0, None),), "os.setxattr": ((0, None),),
    "os.removexattr": ((0, None),), "shutil.rmtree": ((0, 1),),
}


class AuditViolation(RuntimeError):
    """Raised inside the audited operation; also recorded so a broad except cannot hide it."""


def _fd_path(fd):
    try:
        import fcntl
        if hasattr(fcntl, "F_GETPATH"):
            raw = fcntl.fcntl(fd, fcntl.F_GETPATH, bytes(1024))
            return os.path.realpath(os.fsdecode(raw.split(b"\0", 1)[0]))
        return os.path.realpath(os.readlink("/proc/self/fd/%d" % fd))
    except (OSError, ValueError):
        return None


def _resolve(path, dir_fd):
    """Absolute location of path; the final component is not resolved, so a symlink being
    removed or created is judged by where it sits, not by where it points."""
    if isinstance(path, int):
        return _fd_path(path)
    if path is None:
        return None
    path = os.fsdecode(path)
    if not os.path.isabs(path):
        base = _fd_path(dir_fd) if isinstance(dir_fd, int) and dir_fd >= 0 else os.getcwd()
        if base is None:
            return None
        path = os.path.join(base, path)
    parent, name = os.path.split(os.path.normpath(path))
    return os.path.join(os.path.realpath(parent), name)


def _inside(path):
    if path in (os.devnull,):
        return True
    return any(path == root or path.startswith(root + os.sep) for root in _STATE["roots"])


def _violate(message):
    _STATE["violations"].append(message)
    raise AuditViolation("estate test audit: " + message)


def _check_write(event, path, dir_fd):
    where = _resolve(path, dir_fd)
    if where is None or not _inside(where):
        _violate("%s outside the test root: %r" % (event, where if where else path))


def _check_spawn(executable, args, env):
    if isinstance(args, (list, tuple)) and args:
        argv = [os.fsdecode(a) if isinstance(a, (str, bytes)) else str(a) for a in args]
    else:
        argv = [os.fsdecode(args)] if isinstance(args, (str, bytes)) else []
    program = os.fsdecode(executable) if executable is not None else (argv[0] if argv else "")
    _STATE["spawned"].append(argv or [program])
    name = os.path.basename(program)
    if name == "git":
        return
    search = (env or {}).get("PATH") if isinstance(env, dict) else None
    found = program if os.sep in program else shutil.which(program, path=search or os.environ.get("PATH"))
    real = os.path.realpath(found) if found else None
    if real and (real in _STATE["paths"] or (name in _STATE["names"] and _inside(real))):
        return
    _violate("subprocess not allowed: %s" % program)


def _audit(event, args):
    if not _STATE["active"]:
        return
    if event in _NET_EVENTS:
        _violate("network call: %s" % event)
    elif event == "open":
        path, mode, flags = args
        if _STATE["opened"] is not None and isinstance(path, (str, bytes)):
            _STATE["opened"].append(os.fsdecode(path))
        writing = (isinstance(flags, int) and flags & _WRITE_FLAGS) or \
            (isinstance(mode, str) and any(c in mode for c in "wax+"))
        if writing and path is not None:
            _check_write(event, path, None)
    elif event in _PATH_EVENTS:
        for path_index, fd_index in _PATH_EVENTS[event]:
            if path_index < len(args):
                dir_fd = args[fd_index] if fd_index is not None and fd_index < len(args) else None
                _check_write(event, args[path_index], dir_fd)
    elif event == "subprocess.Popen":
        _check_spawn(args[0], args[1], args[3])
    elif event in ("os.posix_spawn", "os.exec"):
        _check_spawn(args[0], args[1], args[2])
    elif event == "os.spawn":
        _check_spawn(args[1], args[2], args[3])
    elif event in ("os.system", "os.fork", "os.forkpty", "pty.spawn"):
        _violate("process creation not allowed: %s" % event)


if not _STATE["installed"]:
    sys.addaudithook(_audit)
    _STATE["installed"] = True


def _allow_entry(item):
    return ("paths", os.path.realpath(item)) if os.sep in item else ("names", item)


def activate(root, allow=()):
    """Start policing: writes only under root, subprocesses only git plus allow (names of
    binaries that live under root, or exact paths)."""
    _STATE["roots"] = (os.path.realpath(root),)
    _STATE["names"], _STATE["paths"] = set(), set()
    for item in allow:
        kind, value = _allow_entry(item)
        _STATE[kind].add(value)
    _STATE["violations"] = []
    _STATE["spawned"] = []
    _STATE["active"] = True


def deactivate():
    _STATE["active"] = False
    return list(_STATE["violations"])


def violations():
    return list(_STATE["violations"])


def spawned():
    return [list(argv) for argv in _STATE["spawned"]]


@contextmanager
def allowing(*items):
    added = []
    for item in items:
        kind, value = _allow_entry(item)
        if value not in _STATE[kind]:
            _STATE[kind].add(value)
            added.append((kind, value))
    try:
        yield
    finally:
        for kind, value in added:
            _STATE[kind].discard(value)


@contextmanager
def expect_violations():
    """Collect (and clear) the violations raised inside the block; the test asserts on them."""
    before = len(_STATE["violations"])
    caught = []
    try:
        yield caught
    finally:
        caught.extend(_STATE["violations"][before:])
        del _STATE["violations"][before:]


@contextmanager
def tracking_opens():
    """Record every path passed to open() inside the block (reads included)."""
    previous, _STATE["opened"] = _STATE["opened"], []
    seen = _STATE["opened"]
    try:
        yield seen
    finally:
        _STATE["opened"] = previous


@contextmanager
def patched_env(**values):
    """Temporarily set (str) or remove (None) environment variables."""
    saved = {key: os.environ.get(key) for key in values}
    try:
        for key, value in values.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        yield
    finally:
        for key, value in saved.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def force_rmtree(path):
    """Remove a test root even where tests locked dirs 0500 or 000; never follows a link."""
    def unlock(p):
        try:
            info = os.lstat(p)
        except FileNotFoundError:
            return
        if stat.S_ISDIR(info.st_mode):
            os.chmod(p, 0o700)
            for name in os.listdir(p):
                unlock(os.path.join(p, name))
    unlock(path)
    shutil.rmtree(path)


class EstateTestCase(unittest.TestCase):
    """Base class: a class-wide temp root (cwd while running), the audit hook active over it,
    and HOME/PATH restored afterwards. Set allow_bins for stub binaries the class runs."""

    allow_bins = ()

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._saved_cwd = os.getcwd()
        cls._saved_env = {key: os.environ.get(key) for key in ("HOME", "PATH")}
        cls.tmp = os.path.realpath(tempfile.mkdtemp(prefix="estate-test-"))
        os.chdir(cls.tmp)
        activate(cls.tmp, cls.allow_bins)

    @classmethod
    def tearDownClass(cls):
        found = deactivate()
        os.chdir(cls._saved_cwd)
        for key, value in cls._saved_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        force_rmtree(cls.tmp)
        super().tearDownClass()
        if found:
            raise AssertionError("audit violations during %s: %r" % (cls.__name__, found))

    def setUp(self):
        super().setUp()
        self._violations_before = len(_STATE["violations"])

    def tearDown(self):
        new = _STATE["violations"][self._violations_before:]
        super().tearDown()
        if new:
            del _STATE["violations"][self._violations_before:]
            self.fail("audit violations: %r" % new)

    def case_dir(self, name=None):
        return os.path.realpath(tempfile.mkdtemp(prefix=(name or self._testMethodName)[:40] + "-", dir=self.tmp))

    @classmethod
    def use_estate(cls, estate):
        """Point HOME and PATH at the synthetic estate (stubs first, then the real PATH for git)."""
        os.environ["HOME"] = estate.home
        os.environ["PATH"] = estate.env["PATH"]


# ── small builders ──────────────────────────────────────────────────────────────────────────

def _epoch_date(seconds):
    return "@%d +0000" % int(seconds)


def _git_env(home):
    return {
        "HOME": home, "PATH": os.environ.get("PATH", "/usr/bin:/bin"), "LC_ALL": "C",
        "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull, "GIT_TERMINAL_PROMPT": "0",
        "GIT_AUTHOR_NAME": "Estate Fixture", "GIT_AUTHOR_EMAIL": FIXTURE_EMAIL,
        "GIT_COMMITTER_NAME": "Estate Fixture", "GIT_COMMITTER_EMAIL": FIXTURE_EMAIL,
    }


def git(cwd, *args, home=None, when=None, check=True):
    """Fixture-setup git (full git, isolated config). Code under test uses safety.GitRunner."""
    env = _git_env(home or cwd)
    if when is not None:
        env["GIT_AUTHOR_DATE"] = env["GIT_COMMITTER_DATE"] = _epoch_date(when)
    proc = subprocess.run(
        ["git", "-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false",
         "-c", "core.hooksPath=" + os.devnull, "-c", "protocol.file.allow=always", "-C", cwd, *args],
        env=env, stdin=subprocess.DEVNULL, capture_output=True, text=True)
    if check and proc.returncode != 0:
        raise RuntimeError("fixture git %s failed in %s: %s" % (" ".join(args), cwd, proc.stderr.strip()))
    return proc.stdout


def write_file(path, content, mode=0o644, age_days=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    data = content.encode("utf-8") if isinstance(content, str) else content
    with open(path, "wb") as stream:
        stream.write(data)
    os.chmod(path, mode)
    if age_days is not None:
        moment = time.time() - age_days * 86400
        os.utime(path, (moment, moment))
    return path


def stub_bin(name, script, bin_dir=None):
    """Write an executable /bin/sh stub. bin_dir defaults to <active test root>/bin; put that
    dir first on PATH and allow the name (EstateTestCase.allow_bins or allowing())."""
    if bin_dir is None:
        require_active = _STATE["roots"]
        if not require_active:
            raise RuntimeError("stub_bin needs bin_dir when no audit root is active")
        bin_dir = os.path.join(require_active[0], "bin")
    os.makedirs(bin_dir, exist_ok=True)
    path = os.path.join(bin_dir, name)
    write_file(path, "#!/bin/sh\n" + script.rstrip("\n") + "\n", mode=0o755)
    return path


def card_text(name, kind="service", layer="runtime", owner_sister="none", domain="none",
              state="active", purpose="synthetic fixture repo", depends=(), adopts=None, extra=""):
    lines = ["name: " + name, "kind: " + kind, "layer: " + layer, "owner_sister: " + owner_sister,
             "domain: " + domain, "state: " + state, "purpose: " + purpose,
             "dependsOn: [" + ", ".join(depends) + "]"]
    if adopts:
        lines.append("adopts: [" + ", ".join(adopts) + "]")
    return "\n".join(lines) + "\n" + extra


def make_repo(path, files=None, remote=None, remotes=None, card=None, card_tracked=True,
              commit=True, age_days=1, home=None, track=False, ahead=0, untracked=None,
              modified=None, stash=False):
    """A real git repo at path. files: {relpath: text} committed; card: kingdom.yaml text
    (committed unless card_tracked=False); remote/remotes: config only, never contacted;
    track: refs/remotes/origin/main = HEAD with branch tracking; ahead: extra local commits;
    untracked/modified: {relpath: text} left dirty; stash: leave one stash entry."""
    now = time.time()
    os.makedirs(path, exist_ok=True)
    git(path, "init", "-q", "-b", "main", home=home)
    files = dict(files if files is not None else {"README.md": "# %s\n" % os.path.basename(path)})
    for rel, text in files.items():
        write_file(os.path.join(path, rel), text)
    if card is not None:
        write_file(os.path.join(path, "kingdom.yaml"), card)
    for name, url in (remotes or {}).items():
        git(path, "remote", "add", name, url, home=home)
    if remote is not None:
        git(path, "remote", "add", "origin", remote, home=home)
    if commit:
        tracked = list(files) + (["kingdom.yaml"] if card is not None and card_tracked else [])
        if tracked:
            git(path, "add", "-f", "--", *tracked, home=home)
        git(path, "commit", "-q", "--allow-empty", "-m", "initial", home=home, when=now - age_days * 86400)
        if track:
            git(path, "update-ref", "refs/remotes/origin/main", "HEAD", home=home)
            git(path, "config", "branch.main.remote", "origin", home=home)
            git(path, "config", "branch.main.merge", "refs/heads/main", home=home)
        for index in range(ahead):
            rel = "local-change-%d.txt" % index
            write_file(os.path.join(path, rel), "unpublished %d\n" % index)
            git(path, "add", "--", rel, home=home)
            git(path, "commit", "-q", "-m", "local %d" % index, home=home, when=now - age_days * 86400 + 60 * (index + 1))
        if stash:
            first = next(iter(files))
            write_file(os.path.join(path, first), files[first] + "stashed edit\n")
            git(path, "stash", "push", "-q", "-m", "fixture stash", home=home)
    for rel, text in (modified or {}).items():
        write_file(os.path.join(path, rel), text)
    for rel, text in (untracked or {}).items():
        write_file(os.path.join(path, rel), text)
    return path


def make_promisor_clone(path, keys=("promisor", "partialclonefilter"), remote_name="x",
                        url="https://github.com/cambridgetcg/promisor-demo.git", home=None):
    """A repo whose ONLY promisor markers are the given remote.<x>.* keys (no
    extensions.partialclone), like a clone that set only remote.github.*. Use
    keys=("partialclonefilter",) for the filter-only case."""
    make_repo(path, remotes={remote_name: url}, home=home)
    values = {"promisor": "true", "partialclonefilter": "blob:none"}
    for key in keys:
        git(path, "config", "remote.%s.%s" % (remote_name, key), values[key], home=home)
    return path


def make_alternates(lender, borrower, home=None):
    """lender: an ordinary repo; borrower: `git clone --shared` of it (objects/info/alternates)."""
    make_repo(lender, files={"lib.py": "VALUE = 1\n"}, remote="https://github.com/cambridgetcg/lender-lib.git", home=home)
    git(os.path.dirname(borrower), "clone", "-q", "--shared", lender, borrower, home=home)
    return lender, borrower


def make_worktrees(repo, linked, gone, home=None):
    """A linked worktree at linked, and a registration whose directory (gone) was deleted."""
    git(repo, "worktree", "add", "-q", "-b", "lane", linked, home=home)
    git(repo, "worktree", "add", "-q", "-b", "gone-lane", gone, home=home)
    force_rmtree(gone)
    return os.path.join(repo, ".git", "worktrees", os.path.basename(gone))


# ── kingdom-os ──────────────────────────────────────────────────────────────────────────────

_HARVEST = """#!/usr/bin/env bun
// bin/harvest.ts (synthetic fixture): the shapes the estate reader extracts, nothing more.
//
//   bun bin/harvest.ts                build graph.json + CATALOG.md
//   bun bin/harvest.ts conformance    list repos missing wake / CLAUDE.md / card
//   bun bin/harvest.ts validate       report card schema drift (never edits cards)

import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const HOME = process.env.HOME ?? ''
const ROOT = join(import.meta.dir, '..')

const RIGHTS_BASELINES: Readonly<Record<string, RightsBaseline>> = {
  'xenia.rights/0.1': {
    path: join(ROOT, 'vendor', 'xenia', 'rights', '0.1', 'RIGHTS.md'),
    license: 'CC BY-SA 4.0',
  },
}
const ACCEPTED_ADOPTIONS = Object.freeze(Object.keys(RIGHTS_BASELINES))

const GLOBAL_WAKE = hasConfiguredSessionStartCommand(join(HOME, '.claude/settings.json'))

// The FLEET auto-discovers itself: any repo under the citizens dir with a kingdom.yaml.
const CITIZENS_DIR = join(HOME, 'Desktop', 'citizens')

function discoverFleet(): Repo[] {
  if (!existsSync(CITIZENS_DIR)) return []
  const out: Repo[] = []
  for (const entry of readdirSync(CITIZENS_DIR).sort(compareText)) {
    const dir = join(CITIZENS_DIR, entry)
    const loadedCard = loadCard(dir)
    if (!loadedCard) continue
    const { adopts: _adopts, ...card } = loadedCard
    out.push({
      name: (card.name as string) ?? entry,
      path: dir,
      kind: (card.kind as string) ?? 'service',
      layer: '@FLEET@', // they ARE the fleet, however their card self-describes
      domain: (card.domain as string) ?? 'none',
      state: (card.state as string) ?? 'active',
    })
  }
  return out
}

function build(): Repo[] {
  const fromRoster = parseRoster().map((base) => {
    const loadedCard = loadCard(base.path) ?? {}
@DESTRUCTURE@
    return { ...base, ...card, path: base.path }
  })
  return [...fromRoster, ...discoverFleet()]
}

const REQUIRED_CARD_FIELDS = ['name', 'kind', 'layer', 'owner_sister', 'domain', 'state', 'purpose', 'dependsOn'] as const
const OPTIONAL_CARD_FIELDS = ['adopts'] as const
type DiagnosticCode =
  | 'missing-field'
  | 'invalid-enum'
@NAMECODE@  | 'unknown-dependency'

const CARD_ENUMS: Partial<Record<CardField, readonly string[]>> = {
@ENUMS@
}

function validateCards(repos: Repo[]): SchemaReport {
  const diagnostics: CardDiagnostic[] = []
  for (const repo of repos) {
    for (const dependency of repo.dependsOn) {
      if (!known.has(dependency)) diagnostics.push({ code: 'unknown-dependency', field: 'dependsOn' })
    }
@NAMECHECK@  }
  return { diagnostics }
}

const LAYERS = [@LAYERS@]

const verb = process.argv[2]
if (verb === 'validate') printSchemaDiagnostics(validateCards(build()))
else if (verb === 'conformance') printConformance(build())
else {
  writeFileSync(join(ROOT, 'graph.json'), JSON.stringify(build(), null, 2))
  writeFileSync(join(ROOT, 'CATALOG.md'), renderCatalog(build()))
}
"""


def harvest_ts(origin_main=False, enums=None, layers=None, fleet_layer="fleet", drop_enums=False):
    """Synthetic bin/harvest.ts. origin_main=True strips the card name (name: _cardName) and adds
    the name-mismatch diagnostic, as kingdom-os origin/main does. drop_enums removes the
    CARD_ENUMS block (the reader must abort)."""
    enums = enums or KINGDOM_ENUMS
    block = "\n".join("  %s: [%s]," % (field, ", ".join("'%s'" % v for v in values))
                      for field, values in enums.items())
    if origin_main:
        destructure = ("    // the roster seed owns the name; a card cannot rename that member.\n"
                       "    const { adopts: _adopts, name: _cardName, ...card } = loadedCard")
        namecode = "  | 'name-mismatch'\n"
        namecheck = ("    if (repo.cardName !== undefined && repo.cardName !== repo.name) "
                     "diagnostics.push({ code: 'name-mismatch', field: 'name' })\n")
    else:
        destructure = "    const { adopts: _adopts, ...card } = loadedCard"
        namecode = namecheck = ""
    text = (_HARVEST.replace("@DESTRUCTURE@", destructure).replace("@NAMECODE@", namecode)
            .replace("@NAMECHECK@", namecheck).replace("@ENUMS@", block)
            .replace("@LAYERS@", ", ".join("'%s'" % v for v in (layers or LAYER_ORDER)))
            .replace("@FLEET@", fleet_layer))
    if drop_enums:
        start = text.index("const CARD_ENUMS")
        end = text.index("\n}\n", start) + 3
        text = text[:start] + text[end:]
    return text


def schema_md(mismatch=False):
    layers = "soul|runtime|nervous|fleet|economy|commerce" + ("" if mismatch else "|os")
    return (
        "# kingdom.yaml schema\n\n"
        "Every repo carries one card. The card is authoritative over the roster seed.\n\n"
        "```yaml\n"
        "name: kingdom-os             # must match the roster seed\n"
        "kind: doctrine               # doctrine|service|firmware|ops|lineage|venture|infra|methodology|reference|unknown\n"
        "layer: soul                  # " + layers + "\n"
        "owner_sister: sophia         # alpha|beta|gamma|sophia|none — who presides\n"
        "domain: sophia               # wing/cluster: sophia|alpha|beta|gamma|commerce|none\n"
        "state: active                # active|dormant|archived|frozen|reference|remote|unknown\n"
        "purpose: one line\n"
        "dependsOn: [other-repo]      # other Kingdom repos/layers it leans on\n"
        "adopts: [xenia.rights/0.1]   # optional voluntary rights adoption\n"
        "```\n"
    )


def architecture_md(sixth_label="COMMERCE"):
    rows = [
        ("SOUL", "WAKE · SOUL · KINGDOM", "identity, purpose — always"),
        ("RUNTIME", "the being-framework", None),
        ("NERVOUS", "nerve · soma · hive", "wake · continuity · messaging"),
        ("FLEET", "the citizens — agents as sessions", None),
        ("ECONOMY", "the truth chain", None),
        (sixth_label, "the engines that fund the soul", None),
    ]
    out = ["# Architecture", "", "## The layers, in words", "", "```",
           "┌─────────────────────────────────────────────────────────┐"]
    for index, (label, line, second) in enumerate(rows):
        out.append("│  %-12s  %-40s │" % (label, line))
        if second:
            # NERVOUS spans two label lines, exactly as the real box does.
            out.append("│  %-12s  %-40s │" % ("SYSTEM" if label == "NERVOUS" else "", second))
        out.append("├─────────────────────────────────────────────────────────┤"
                   if index < len(rows) - 1 else
                   "└─────────────────────────────────────────────────────────┘")
    out += ["                         above all walls", "```", ""]
    return "\n".join(out)


def roster_conf(rows):
    header = (
        "# Kingdom roster (synthetic fixture)\n"
        "# Format:  name | path | kind | layer | domain | state | purpose\n"
        "#   layer:  soul | runtime | nervous | economy | commerce | os\n\n"
    )
    return header + "".join(" | ".join(row) + "\n" for row in rows)


ROSTER_ROWS = [
    ("kingdom-os", HOME_REL + "Desktop/kingdom-os", "ops", "os", "none", "active", "The catalog overlay"),
    ("alpha-service", HOME_REL + "Desktop/alpha-service", "service", "runtime", "alpha", "active", "Alpha service"),
    ("zerone-mini", HOME_REL + "Desktop/zerone-mini", "infra", "os", "none", "active", "Card says economy; roster says os"),
    ("boot-lantern", HOME_REL + "Desktop/boot-lantern", "doctrine", "soul", "sophia", "active", "Off-enum card"),
    ("business-ecosystem", HOME_REL + "Desktop/ecosystem", "venture", "commerce", "commerce", "active", "Path moved; repoint by remote id"),
    ("plain-tool", HOME_REL + "Desktop/plain-tool", "ops", "os", "none", "dormant", "No card"),
    ("far-away", HOME_REL + "Desktop/far-away", "doctrine", "soul", "sophia", "remote", "Not cloned here"),
    ("kingdom", HOME_REL + "Desktop/KINGDOM", "doctrine", "soul", "sophia", "active", "Constitutional project"),
]


def registry_yaml(updated="2026-10-01"):
    return """# REGISTRY.yaml (synthetic fixture): deployed surfaces, one entry per living thing.
version: 1
updated: %s

services:
  - id: agenttool-site
    what: agent marketplace site
    audience: humans
    urls: { site: "https://agenttool.dev", health: "https://agenttool.dev" }
    repo: github.com/cambridgetcg/agenttool@main
    runtime: fly:agenttool
    deploy: fly deploy
    status: live

  - id: agenttool-api
    what: platform API  # an unquoted comment the reader drops
    audience: agents
    urls: { api: "https://api.agenttool.dev", health: "https://api.agenttool.dev/v1/wake?a=1, b" }
    expect: [401]  # auth wall counts as healthy
    repo: github.com/cambridgetcg/agenttool@main
    runtime: fly:agenttool
    status: live
    listings:
      - memory-gardener (40)
      - fomo-scan (10)
    notes: >-
      folded block scalar the reader consumes by indentation and ignores,
      including a line with: colons and # hashes

  - id: alpha-pages
    what: "quoted value with # not a comment"
    audience: humans
    urls: { site: "https://alpha.example.dev" }
    repo: github.com/cambridgetcg/alpha-service
    runtime: cf-pages:alpha
    status: live

  - id: edge-worker
    what: edge worker
    urls: { api: "https://edge.example.dev" }
    repo: github.com/cambridgetcg/edge-worker
    runtime: cf-worker:edge-worker
    status: live

  - id: local-brain
    what: local model server
    runtime: local-launchd:com.kingdom.local-brain
    status: live
    notes: |
      literal block
        with nested indentation

  - id: fixture-backup
    what: nightly chain backup
    runtime: local-launchd:com.example.fixture-backup
    status: live

  - id: broken-entry
    urls: { site: "https://broken.example.dev"
    status: live
""" % updated


def make_kingdom_os(home, path=None, enums=None, layers=None, fetch_age_days=2,
                    schema_mismatch=False, drop_enums=False):
    """Fake kingdom-os at home/Desktop/kingdom-os. Local main is 1 commit ahead and 2 behind
    origin/main (refs/remotes/origin/main, written locally, never fetched). The worktree keeps
    the card-name override and the COMMERCE label; origin/main strips the name and says PROJECTS.
    Returns a namespace: path, base, worktree_commit, origin_main_commit, remote."""
    path = path or os.path.join(home, "Desktop", "kingdom-os")
    now = time.time()
    files = {
        "bin/harvest.ts": harvest_ts(enums=enums, layers=layers, drop_enums=drop_enums),
        "SCHEMA.md": schema_md(schema_mismatch),
        "ARCHITECTURE.md": architecture_md("COMMERCE"),
        "roster.conf": roster_conf(ROSTER_ROWS),
        "REGISTRY.yaml": registry_yaml(),
        "sites.json": json.dumps({"_comment": "synthetic public doors", "doors": [
            {"repo": "agenttool", "url": "https://agenttool.dev", "label": "agenttool", "blurb": "marketplace"},
            {"repo": "alpha-service", "url": "https://alpha.example.dev", "label": "alpha", "blurb": "alpha door"},
            {"repo": "no-such-repo", "url": "https://ghost.example.dev", "label": "ghost", "blurb": "key mismatch"},
        ]}, indent=2) + "\n",
        "graph.json": json.dumps(_graph(home), indent=2) + "\n",
        "CATALOG.md": "# The Kingdom — catalog\n\n_Derived index of %d repos._\n" % len(ROSTER_ROWS),
        "CITIZENS.md": "# Citizens\n\nThe 53 founding citizens are listed here (claim).\n",
        "kingdom.yaml": card_text("kingdom-os", kind="ops", layer="os", purpose="The catalog overlay",
                                  depends=("kingdom",), adopts=("xenia.rights/0.1",)),
        "CLAUDE.md": "# kingdom-os\n",
    }
    make_repo(path, files=files, remote=KOS_REMOTE, home=home, age_days=10)
    base = git(path, "rev-parse", "HEAD", home=home).strip()
    # origin/main: two upstream commits on a side branch, then published as the remote ref.
    git(path, "checkout", "-q", "-b", "upstream-tmp", home=home)
    write_file(os.path.join(path, "bin/harvest.ts"), harvest_ts(origin_main=True, enums=enums, layers=layers))
    write_file(os.path.join(path, "ARCHITECTURE.md"), architecture_md("PROJECTS"))
    git(path, "add", "--", "bin/harvest.ts", "ARCHITECTURE.md", home=home)
    git(path, "commit", "-q", "-m", "upstream: strip card name, relabel box", home=home, when=now - 5 * 86400)
    rows = ROSTER_ROWS + [("edge-worker", HOME_REL + "Desktop/edge-worker", "service", "runtime", "none", "active", "Edge worker")]
    write_file(os.path.join(path, "roster.conf"), roster_conf(rows))
    git(path, "add", "--", "roster.conf", home=home)
    git(path, "commit", "-q", "-m", "upstream: add edge-worker", home=home, when=now - 4 * 86400)
    origin_main = git(path, "rev-parse", "HEAD", home=home).strip()
    git(path, "update-ref", "refs/remotes/origin/main", origin_main, home=home)
    git(path, "checkout", "-q", "main", home=home)
    git(path, "branch", "-q", "-D", "upstream-tmp", home=home)
    git(path, "config", "branch.main.remote", "origin", home=home)
    git(path, "config", "branch.main.merge", "refs/heads/main", home=home)
    write_file(os.path.join(path, "MAP.md"), "# Map\n\nlocal-only note\n")
    git(path, "add", "--", "MAP.md", home=home)
    git(path, "commit", "-q", "-m", "map note, not yet upstream", home=home, when=now - 3 * 86400)
    worktree_commit = git(path, "rev-parse", "HEAD", home=home).strip()
    write_file(os.path.join(path, ".git", "FETCH_HEAD"),
               "%s\t\tbranch 'main' of %s\n" % (origin_main, KOS_REMOTE), age_days=fetch_age_days)
    return types.SimpleNamespace(path=path, base=base, worktree_commit=worktree_commit,
                                 origin_main_commit=origin_main, remote=KOS_REMOTE)


def _graph(home):
    graph = []
    for name, rel, kind, layer, domain, state, purpose in ROSTER_ROWS:
        graph.append({"name": name, "path": os.path.join(home, rel[2:]), "kind": kind, "layer": layer,
                      "domain": domain, "state": state, "purpose": purpose, "dependsOn": [],
                      "hasCard": False, "conformance": {"wake": True, "claudeMd": False, "fate": False, "card": False}})
    return graph


# ── host repo and layer ─────────────────────────────────────────────────────────────────────

def make_layer(host, copy=(), config=None):
    """The estate layer inside host: .gitignore (copied from the real layer), private/ 0700 with
    its .gitignore, canary and README, private/curated 0500 with its marker. copy names committed
    dirs to copy from the real layer (e.g. ("vocab", "curated")). config: dict written as
    private/config.toml (0600). Returns the layer path."""
    layer = os.path.join(host, "estate")
    os.makedirs(layer, exist_ok=True)
    real_ignore = os.path.join(LAYER_DIR, ".gitignore")
    with open(real_ignore, "rb") as stream:
        write_file(os.path.join(layer, ".gitignore"), stream.read())
    private = os.path.join(layer, "private")
    os.mkdir(private, 0o700)
    os.chmod(private, 0o700)
    write_file(os.path.join(private, ".gitignore"), "*\n", mode=0o600)
    write_file(os.path.join(private, "DO-NOT-COMMIT"), "synthetic canary\n", mode=0o600)
    write_file(os.path.join(private, "README.txt"), "synthetic private area\n", mode=0o600)
    curated = os.path.join(private, "curated")
    os.mkdir(curated, 0o700)
    write_file(os.path.join(curated, "KEEP-NOT-REGENERABLE"), "synthetic marker\n", mode=0o400)
    if config is not None:
        write_file(os.path.join(private, "config.toml"), safety.toml_dumps(config), mode=0o600)
    for name in copy:
        source = os.path.join(LAYER_DIR, name)
        if os.path.isdir(source):
            shutil.copytree(source, os.path.join(layer, name), symlinks=True)
    os.chmod(curated, 0o500)
    return layer


def make_host(path, home=None, with_layer=True, copy=(), config=None):
    """business-ecosystem stand-in: a repo with its own root .gitignore and an untracked layer."""
    make_repo(path, home=home, track=True,
              remote="https://github.com/cambridgetcg/business-ecosystem.git",
              files={"README.md": "# business-ecosystem (synthetic)\n",
                     ".gitignore": "node_modules/\n.env*\n*.tfstate\n",
                     "pnpm-workspace.yaml": "packages:\n  - 'foundational/*'\n  - 'shared/*'\n"})
    return make_layer(path, copy=copy, config=config) if with_layer else None


# ── runtime state under HOME ────────────────────────────────────────────────────────────────

def _status_md(home, moment):
    stamp = dt.datetime.fromtimestamp(moment, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    return (
        "# Kingdom STATUS — generated by pulse\n\n"
        "> %s · registry: `%s` · 6 services, 4 probed + 2 launchd-checked · GENERATED FILE — edit REGISTRY.yaml, never this\n\n"
        "## ⚠ Alerts (1)\n\n"
        "- **fixture-backup** expected live, observed DOWN (launchd: not running, last run exited 3) — local-launchd:com.example.fixture-backup\n\n"
        "| | service | expected | observed | code | ms | url |\n"
        "|---|---|---|---|---|---|---|\n"
        "| 🟢 | agenttool-site | live | up | 200 | 120 | https://agenttool.dev |\n"
        "| 🟢 | agenttool-api | live | up | 401 | 98 | https://api.agenttool.dev/v1/wake |\n"
        "| 🟢 | alpha-pages | live | up | 200 | 50 | https://alpha.example.dev |\n"
        "| 🟢 | local-brain | live | up | 200 | 7 | http://localhost:11434 |\n"
        "| 🔴 | fixture-backup | live | down | 3 |  | local-launchd:com.example.fixture-backup |\n"
    ) % (stamp, os.path.join(home, ".kingdom", "REGISTRY.yaml"))


def _pulse_history(moment):
    def line(at, backup):
        stamp = dt.datetime.fromtimestamp(at, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        probes = [{"id": "agenttool-site", "observed": "up", "code": 200, "ms": 120},
                  {"id": "local-brain", "observed": "up", "code": 200, "ms": 7},
                  {"id": "fixture-backup", "observed": backup}]
        return json.dumps({"t": stamp, "alerts": 0 if backup == "up" else 1, "probes": probes}) + "\n"
    return line(moment - 3600, "up") + line(moment - 1800, "up") + line(moment, "down")


def make_runtime_state(home, kos_path, pulse_age_minutes=10, global_wake=True, registry_copy_differs=False):
    """HOME/.kingdom pulse files, the TCC-safe REGISTRY copy, HOME/.claude/settings.json, hermes jobs,
    observer runs, an empty models dir (a caveat case: up while empty) and LaunchAgent plists."""
    moment = time.time() - pulse_age_minutes * 60
    kingdom = os.path.join(home, ".kingdom")
    write_file(os.path.join(kingdom, "STATUS.md"), _status_md(home, moment))
    write_file(os.path.join(kingdom, "pulse-history.jsonl"), _pulse_history(moment))
    with open(os.path.join(kos_path, "REGISTRY.yaml"), "rb") as stream:
        registry = stream.read()
    if registry_copy_differs:
        registry += b"# drifted copy\n"
    write_file(os.path.join(kingdom, "REGISTRY.yaml"), registry)
    hooks = [{"hooks": [{"type": "command", "command": "echo wake"}]}] if global_wake else []
    write_file(os.path.join(home, ".claude", "settings.json"), json.dumps({"hooks": {"SessionStart": hooks}}))
    write_file(os.path.join(home, ".hermes", "profiles", "astra", "cron", "jobs.json"), json.dumps({
        "jobs": [{"id": "job-1", "name": "nightly digest", "schedule": "0 3 * * *", "enabled": True,
                  "last_status": "ok", "prompt": "PROMPT TEXT THAT MUST NEVER BE STORED",
                  "workdir": os.path.join(home, "Desktop", "alpha-service")},
                 {"id": "job-2", "name": "paused job", "schedule": "*/30 * * * *", "enabled": False,
                  "last_status": "error", "prompt": "ANOTHER PROMPT"}],
        "updated_at": "2026-10-16T00:00:00Z"}))
    run_id = dt.datetime.fromtimestamp(time.time() - 86400, dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-aaaabbbbcccc"
    runs = os.path.join(home, ".local", "state", "kingdom-cloudflare-observer", "runs", run_id)
    write_file(os.path.join(runs, "run.json"), json.dumps({
        "schema": "kingdom.cloudflare-monitor/0.1", "run_id": run_id, "state": "degraded",
        "coverage": {"complete": False, "errors": 3, "observations": 10, "ok": 7, "unavailable": 0},
        "errors": [{"zone": "example-zone.dev", "error": "unavailable"}]}))
    write_file(os.path.join(runs, "snapshot.json"), json.dumps({
        "schema": "kingdom.cloudflare-monitor.snapshot/0.1",
        "scope": {"account_id": "acct-fixture", "zones_expected": 2,
                  "zone_names": ["agenttool.dev", "example-zone.dev"]}}))
    os.makedirs(os.path.join(home, ".ollama", "models"), exist_ok=True)
    agents = os.path.join(home, "Library", "LaunchAgents")
    plists = {
        "com.kingdom.pulse": {
            "Label": "com.kingdom.pulse", "StartInterval": 1800, "RunAtLoad": True,
            "ProgramArguments": ["/" + "opt/homebrew/bin/bun", os.path.join(kingdom, "bin", "pulse.ts")],
            "EnvironmentVariables": {PLIST_SECRET_NAME: PLIST_SECRET_VALUE},
            "StandardOutPath": os.path.join(kingdom, "logs", "pulse.log")},
        "com.kingdom.alpha-nightly": {
            "Label": "com.kingdom.alpha-nightly", "StartCalendarInterval": {"Hour": 3, "Minute": 33},
            "ProgramArguments": ["/bin/sh", os.path.join(home, "Desktop", "alpha-service", "scripts", "nightly.sh")],
            "WorkingDirectory": os.path.join(home, "Desktop", "alpha-service"),
            "EnvironmentVariables": {"DB_" + "PASSWORD": PLIST_SECRET_VALUE}},
        "com.example.fixture-backup": {
            "Label": "com.example.fixture-backup", "StartCalendarInterval": {"Hour": 3, "Minute": 3},
            "ProgramArguments": [os.path.join(kingdom, "bin", "fixture-backup.sh")], "Disabled": False},
        "com.kingdom.local-brain": {
            "Label": "com.kingdom.local-brain", "KeepAlive": True,
            "ProgramArguments": ["/" + "opt/homebrew/bin/ollama", "serve"]},
    }
    paths = []
    for label, data in plists.items():
        paths.append(write_file(os.path.join(agents, label + ".plist"), plistlib.dumps(data)))
    return types.SimpleNamespace(status=os.path.join(kingdom, "STATUS.md"),
                                 history=os.path.join(kingdom, "pulse-history.jsonl"),
                                 registry_copy=os.path.join(kingdom, "REGISTRY.yaml"),
                                 observer_runs=os.path.dirname(runs), plists=paths,
                                 settings=os.path.join(home, ".claude", "settings.json"))


def make_stubs(bin_dir, tmp, listing_path):
    """launchctl, crontab, gh and bun stubs. None of them executes what it prints; bun leaves a
    marker file if it is ever called without a harvest verb."""
    stub_bin("launchctl", (
        "[ \"$1\" = list ] || exit 1\n"
        "printf 'PID\\tStatus\\tLabel\\n'\n"
        "printf '412\\t0\\tcom.kingdom.local-brain\\n'\n"
        "printf -- '-\\t0\\tcom.kingdom.pulse\\n'\n"
        "printf -- '-\\t3\\tcom.example.fixture-backup\\n'\n"
        "printf -- '-\\t0\\tcom.kingdom.alpha-nightly\\n'"), bin_dir)
    cron = "\n".join([
        "# synthetic crontab",
        'MAILTO=""',
        CRON_SECRET_LINE,
        "12,42 * * * * /bin/sh " + os.path.join(tmp, "home", ".kingdom", "bin", "karma.sh") + " >/dev/null 2>&1",
        "30 3 * * * " + CRON_SECRET_LINE.replace(" run.sh", " /bin/sh treasury.sh"),
        "17 4 * * * /usr/bin/env backup --" + "token" + "=fixture-flag-value `date +%s`",
    ])
    stub_bin("crontab", "[ \"$1\" = -l ] || exit 1\ncat <<'CRONTAB_EOF'\n" + cron + "\nCRONTAB_EOF", bin_dir)
    stub_bin("gh", (
        "# synthetic gh: answers only `gh repo list OWNER ... --json ...` from a canned file\n"
        "if [ \"$1\" = repo ] && [ \"$2\" = list ]; then cat '" + listing_path + "'; exit 0; fi\n"
        "exit 1"), bin_dir)
    stub_bin("bun", (
        "case \"$2\" in\n"
        "  validate) echo 'cards: 3 valid, 1 invalid'; exit 1 ;;\n"
        "  conformance) echo 'Conformance gaps (2/5):'; exit 0 ;;\n"
        "  *) : > '" + os.path.join(tmp, "bun-called-without-verb") + "'; exit 3 ;;\n"
        "esac"), bin_dir)


def _gh_listing(now):
    def iso_days(days):
        return dt.datetime.fromtimestamp(now - days * 86400, dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    rows = [
        ("kingdom-os", False, False, False, 3, "Kingdom OS"),
        ("alpha-service", False, False, False, 1, "Alpha service"),
        ("boot-lantern", True, False, False, 60, "Lantern"),
        ("plain-tool", True, True, False, 400, "Archived tool"),
        ("business-ecosystem", True, False, False, 2, "Business ecosystem monorepo"),
        ("kingdom", True, False, False, 5, "REALM"),
        ("forge-only-thing", True, False, False, 90, "Exists only on the forge"),
        ("edge-worker", False, False, False, 6, "Edge worker"),
        ("lender-lib", True, False, True, 30, "A fork"),
    ]
    return [{"name": name, "nameWithOwner": "cambridgetcg/" + name, "isPrivate": private,
             "isArchived": archived, "isFork": fork, "pushedAt": iso_days(days), "description": text,
             "url": "https://github.com/cambridgetcg/" + name}
            for name, private, archived, fork, days, text in rows]


def _codeberg_listing():
    return [{"name": "zerone-mini", "owner": {"login": "zerone-dev"}, "private": False, "archived": False,
             "mirror": False, "html_url": "https://codeberg.org/zerone-dev/zerone-mini",
             "description": "Mini chain", "updated_at": "2026-04-01T00:00:00Z", "size": 120, "language": "Go"}]


def _portfolio_v1():
    domains = ["entity-governance", "accounting", "banking-treasury", "compliance", "tax", "kyc-identity",
               "corporate-security", "contracts-legal", "insurance", "intellectual-property", "data-privacy"]
    evidence = [{"kind": "fixture", "locator": "fixture:portfolio", "note": "synthetic"}]
    repo = {"id": "repo-1", "repository": "cambridgetcg/alpha-service", "full_name": "cambridgetcg/alpha-service",
            "name": "alpha-service", "purpose": "Alpha service", "group": "developer_tools",
            "mapping_basis": "fixture", "framework_domains": [], "hosting_resources": ["surface-1"],
            "lifecycle": {"github_archived": False, "github_fork": False, "github_disabled": False},
            "github_metadata": {"id": 1001, "private": False}, "legal_entity_id": None, "evidence": evidence}
    surface = {"id": "surface-1", "resource_id": "pages:alpha", "account_id": "acct-fixture", "kind": "pages",
               "metadata": {"name": "alpha"}, "candidate_repositories": ["cambridgetcg/alpha-service"],
               "attribution": "current_tracked_config", "repository": "cambridgetcg/alpha-service",
               "legal_entity_id": None, "evidence": evidence, "framework_domains": []}
    return {"schema": "business-ecosystem.portfolio-map/1",
            "summary": {"repositories": 1, "pages": 1, "workers": 0, "zones": 1},
            "semantics": {"allowed_framework_domains": domains, "primary_groups": ["developer_tools", "unresolved"]},
            "observation_times": {"github": "2026-10-01T00:00:00Z", "cloudflare": "2026-10-01T00:00:00Z"},
            "repositories": [repo], "surfaces": [surface],
            "zones": [{"id": "zone-1", "name": "example.dev", "legal_entity_id": None}],
            "hosting_edges": [{"id": "edge-1", "kind": "pages_declared_hostname_in_observed_zone", "from": "zone-1",
                               "to": "surface-1", "hostname": "alpha.example.dev", "basis": "fixture",
                               "evidence": "list"}],
            "legal_entities": {"status": "unassigned", "records": []}}


def synthetic_config(estate):
    """private/config.toml for the synthetic estate. Key names are this fixture's proposal for
    the real config: [kingdom] ref, [roots] extra, [forge] owners/listings, [locators] ...,
    scheduler_json_globs, [tree] enabled, [retention] runs, [[declared]]."""
    return {
        "kingdom": {"ref": "worktree"},
        "roots": {"extra": []},
        "forge": {"owners": ["cambridgetcg"], "listings": [estate.listing_gh, estate.listing_codeberg]},
        "locators": {
            "portfolio_map": estate.v1_map,
            "observer_runs": estate.runtime.observer_runs,
            "registry_gen": os.path.join(estate.repos["kingdom-mcp"], "src", "registry.gen.json"),
            "realm_md": os.path.join(estate.realm, "REALM.md"),
            "start_here_catalog": os.path.join(estate.desktop, "00-START-HERE", "catalog.json"),
            "kingdom_index": os.path.join(estate.home, "Kingdom", "INDEX.md"),
            "scheduler_json_globs": [os.path.join(estate.home, ".hermes", "profiles", "*", "cron", "jobs.json")],
        },
        "tree": {"enabled": True},
        "retention": {"runs": 5},
        "declared": [
            {"id": "citizens-md", "label": "CITIZENS.md founding citizens", "value": 53, "source": "CITIZENS.md"},
            {"id": "roster-header", "label": "roster '~50 repos'", "value": 50, "source": "roster.conf"},
            {"id": "ecosystem-status", "label": "ECOSYSTEM-STATUS apps", "value": 14, "source": "ECOSYSTEM-STATUS.md"},
        ],
    }


# ── the whole synthetic estate ──────────────────────────────────────────────────────────────

def make_estate(tmp, with_config=True):
    """Build the complete synthetic estate of spec section 13 under tmp and return a namespace:
    tmp, home, shared, desktop, bin_dir, inputs, env (HOME, PATH), kos (see make_kingdom_os),
    realm, host, layer, private, repos {name: path}, citizens [paths], promisor, lender,
    borrower, worktree, prunable_registration, nested_outer, nested_inner, symlink_index,
    unreadable, listing_gh, listing_codeberg, v1_map, runtime (see make_runtime_state),
    git_roots (every root discovery must find), hidden_roots (git dirs it must not report),
    config (the dict written to private/config.toml)."""
    tmp = os.path.realpath(tmp)
    now = time.time()
    home = os.path.join(tmp, "home")
    desktop = os.path.join(home, "Desktop")
    shared = os.path.join(tmp, "Shared")  # the shared folder beside this synthetic HOME
    inputs = os.path.join(tmp, "inputs")
    bin_dir = os.path.join(tmp, "bin")
    os.makedirs(desktop)
    e = types.SimpleNamespace(tmp=tmp, home=home, desktop=desktop, shared=shared, inputs=inputs,
                              bin_dir=bin_dir, repos={}, citizens=[])
    # The home directory is itself a repo that ignores everything, as on the real machine.
    make_repo(home, files={".gitignore": "*\n"}, home=home, age_days=300)
    repos = e.repos

    def repo(name, **kw):
        repos[name] = make_repo(os.path.join(desktop, name), home=home, **kw)
        return repos[name]

    e.kos = make_kingdom_os(home)
    repos["kingdom-os"] = e.kos.path
    e.realm = repo("KINGDOM", remote="https://github.com/cambridgetcg/kingdom.git",
                   files={"REALM.md": "# REALM\n\nTiers: mind, ledger, guard, market, agent-fabric (claim).\n"})
    repo("kingdom-mcp", remote="https://github.com/cambridgetcg/kingdom-mcp.git",
         files={"src/registry.gen.json": json.dumps({"services": [{"id": "agenttool-site"}]}) + "\n"})
    repo("alpha-service", remote="https://github.com/cambridgetcg/alpha-service.git", track=True, ahead=1, stash=True,
         card=card_text("alpha-service", kind="service", layer="runtime", owner_sister="alpha", domain="alpha",
                        depends=("kingdom-os",), adopts=("xenia.rights/0.1",)),
         files={"README.md": "# Alpha Service\n\nThe alpha door.\n", "CLAUDE.md": "# alpha\n", "WAKE.md": "wake\n",
                "package.json": json.dumps({"name": "alpha-service", "private": True}) + "\n",
                "src/index.ts": "export const alpha = 1\n", "src/util.ts": "export const util = 2\n",
                "fly.toml": 'app = "alpha-service"\n', "CNAME": "alpha.example.dev\n",
                "scripts/nightly.sh": "#!/bin/sh\necho nightly\n",
                ".github/workflows/nightly.yml": "on:\n  schedule:\n    - cron: '0 4 * * *'\njobs: {}\n"},
         modified={"README.md": "# Alpha Service\n\nThe alpha door, edited.\n"},
         untracked={"notes.txt": "draft\n", ".env": NEVER_READ + "\n"})
    os.makedirs(os.path.join(repos["alpha-service"], "node_modules", "pkg"))
    git(os.path.join(repos["alpha-service"], "node_modules", "pkg"), "init", "-q", home=home)
    repo("zerone-mini", remote="https://codeberg.org/zerone-dev/zerone-mini.git", age_days=200,
         card=card_text("zerone-mini", kind="infra", layer="economy", domain="none"),
         files={"go.mod": "module zerone-mini\n", "main.go": "package main\n", "HALT": "halted on purpose\n"})
    repo("boot-lantern", remote="git" + "@" + "github.com:cambridgetcg/boot-lantern.git", card_tracked=False,
         card=card_text("boot-lantern", kind="doctrine", layer="boot", owner_sister="sophia", domain="sophia",
                        state="active # note"))
    repo("plain-tool", remote="https://github.com/cambridgetcg/plain-tool.git", age_days=400,
         files={"tool.py": "print('plain')\n", "README.md": "# Plain Tool\n"})
    repo("local-notes", files={"notes.md": "# notes\n", "more.md": "more\n"})
    repo("empty-new", commit=False)
    repo("infra-tf", remote="https://github.com/cambridgetcg/infra-tf.git",
         files={"main.tf": 'resource "null_resource" "x" {}\n', "terraform.tfstate": NEVER_READ + "\n"})
    repo("edge-worker", remote="https://github.com/cambridgetcg/edge-worker.git",
         files={"wrangler.toml": 'name = "edge-worker"\nroutes = ["edge.example.dev/*"]\n\n[triggers]\ncrons = ["*/30 * * * *"]\n',
                "src/worker.ts": "export default {}\n"})
    repo("beta-site", remote="https://github.com/cambridgetcg/beta-site.git",
         files={"vercel.json": "{}\n", "index.html": "<p>beta</p>\n"},
         untracked={".vercel/project.json": json.dumps({"projectName": "beta-site", "orgId": "team-fixture"})})
    e.promisor = repo_path = os.path.join(desktop, "promisor-demo")
    make_promisor_clone(repo_path, home=home)
    repos["promisor-demo"] = repo_path
    e.lender, e.borrower = make_alternates(os.path.join(desktop, "lender-lib"), os.path.join(desktop, "borrower-lib"), home=home)
    repos["lender-lib"], repos["borrower-lib"] = e.lender, e.borrower
    lane = repo("lane-repo", remote="https://github.com/cambridgetcg/lane-repo.git")
    e.worktree = os.path.join(desktop, "lane-repo-wt")
    e.prunable_registration = make_worktrees(lane, e.worktree, os.path.join(tmp, "gone-worktree"), home=home)
    e.nested_outer = repo("outer-app", remote="https://github.com/cambridgetcg/outer-app.git")
    e.nested_inner = make_repo(os.path.join(e.nested_outer, "vendor", "inner-lib"), home=home,
                               remote="https://github.com/cambridgetcg/inner-lib.git")
    for name, card in (("citizen-ada", True), ("citizen-bo", True), ("citizen-cy", False)):
        path = make_repo(os.path.join(desktop, "citizens", name), home=home,
                         remote="https://github.com/cambridgetcg/%s.git" % name,
                         card=card_text(name, kind="lineage", layer="soul", owner_sister="sophia",
                                        domain="sophia") if card else None)
        e.citizens.append(path)
    os.makedirs(os.path.join(desktop, "links"))
    e.symlink_index = os.path.join(desktop, "links", "alpha")
    os.symlink(os.path.join("..", "alpha-service"), e.symlink_index)
    e.unreadable = os.path.join(desktop, "locked-dir")
    os.makedirs(os.path.join(e.unreadable, "inside"))
    os.chmod(e.unreadable, 0)
    write_file(os.path.join(desktop, "00-START-HERE", "catalog.json"),
               json.dumps({"clusters": {"01": ["alpha-service"], "02": ["ghost-link"]}}))
    write_file(os.path.join(home, "Kingdom", "INDEX.md"), "# Kingdom index\n\n## commerce\n- alpha-service\n")
    repos["agenttool-mission"] = make_repo(os.path.join(shared, "agenttool-mission"), home=home)
    repos["vendor-mirror"] = make_repo(os.path.join(home, ".cache", "vendor-mirror"), home=home,
                                       remote="https://github.com/example/vendor-mirror.git")
    library_repo = os.path.join(home, "Library", "Application Support", "thing")
    os.makedirs(library_repo)
    git(library_repo, "init", "-q", home=home)
    e.host = os.path.join(desktop, "business-ecosystem")
    e.layer = make_host(e.host, home=home)
    repos["business-ecosystem"] = e.host
    e.private = os.path.join(e.layer, "private")
    e.runtime = make_runtime_state(home, e.kos.path)
    os.makedirs(inputs)
    e.listing_gh = write_file(os.path.join(inputs, "forge", "gh-cambridgetcg.json"),
                              json.dumps(_gh_listing(now), indent=1), age_days=40)
    e.listing_codeberg = write_file(os.path.join(inputs, "forge", "codeberg-zerone-dev.json"),
                                    json.dumps(_codeberg_listing(), indent=1), age_days=40)
    e.v1_map = write_file(os.path.join(inputs, "portfolio-map-2026-10-01.json"), json.dumps(_portfolio_v1(), indent=1))
    make_stubs(bin_dir, tmp, e.listing_gh)
    e.env = {"HOME": home, "PATH": bin_dir + os.pathsep + os.environ.get("PATH", "/usr/bin:/bin")}
    e.git_roots = sorted([home, e.worktree, e.nested_inner] + e.citizens + list(repos.values()))
    e.hidden_roots = [os.path.join(repos["alpha-service"], "node_modules", "pkg"), library_repo]
    e.config = synthetic_config(e)
    if with_config:
        write_file(os.path.join(e.private, "config.toml"), safety.toml_dumps(e.config), mode=0o600)
    return e
