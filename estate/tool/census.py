"""Census: find every git checkout under the discovery roots and measure each one read-only.

Discovery is a plain directory walk: no git, no symlink ever followed, no mount point crossed.
Git metadata it needs (gitfiles, commondir, alternates, worktree registrations) is read as
small plain files through safety.read_checked.

Measurement runs only allowlisted calls through safety.GitRunner. It first proves the root is
still its own top level, then reads the promisor config, and only then measures the rest;
status is never run on a promisor clone. A failed or timed-out call leaves its field None and
adds a reason, so the record says "unknown" instead of claiming 0 or clean.
"""
import concurrent.futures
import datetime as dt
import errno
import hashlib
import json
import os
import stat
import time
from collections import Counter

import safety


SCHEMA = "estate.census/1"
WORKERS = 8
QUICK_DEPTH = 4
FULL_WALK_MAX_AGE_S = 7 * 86400

STATUS_SKIPPED_PARTIAL = "skipped-partial-clone"
MEASURE_STATUSES = ("ok", "partial", STATUS_SKIPPED_PARTIAL, "timeout", "error", "gone-during-run")
OBSERVED_STATUSES = ("ok", "partial", STATUS_SKIPPED_PARTIAL)

CARD_NAME = "kingdom.yaml"
CARD_MAX = 256 << 10
SMALL_MAX = 64 << 10
README_NAMES = ("README.md", "readme.md", "README", "README.rst")
README_LINES = 40
# HALT, REST.md and CADENCE are the spec's names; the fleet's own tools write REST and EVENT-ONLY
# (citizen-fleet.sh and karma.ts treat either as "this citizen rests"). CADENCE.md is a choice
# record, not a marker, so it is not one of them.
REST_MARKERS = ("HALT", "REST", "REST.md", "CADENCE", "EVENT-ONLY")
SETTINGS_FILES = (".claude/settings.local.json", ".claude/settings.json")
# Presence only; sources.py reads the few whose contents matter (fly.toml, wrangler.toml, ...).
MANIFESTS = (
    "package.json", "tsconfig.json", "pnpm-workspace.yaml", "turbo.json", "deno.json", "bunfig.toml",
    "go.mod", "Cargo.toml", "pyproject.toml", "requirements.txt", "setup.py", "Gemfile",
    "foundry.toml", "hardhat.config.ts", "hardhat.config.js", "Anchor.toml", "Makefile",
    "Dockerfile", "docker-compose.yml", "fly.toml", "wrangler.toml", "wrangler.jsonc",
    "wrangler.json", "vercel.json", ".vercel/project.json", "netlify.toml", "CNAME", ".domains",
    "serverless.yml", "template.yaml", "shopify.app.toml", "next.config.js", "next.config.mjs",
    "next.config.ts", "vite.config.ts", "astro.config.mjs",
)
WORKFLOW_DIR = ".github/workflows"
TOP_EXT = 8
SYMLINK_INDEX_ID = "artifact:symlink-index-"


def checkout_id(path):
    return "co:" + safety.sha12(os.path.realpath(path))


def display_rel(path, home):
    """Display path relative to HOME: "~" itself, or safety.HOME_PREFIX plus the rest.
    Paths outside HOME stay absolute."""
    home = os.path.realpath(home) if home else ""
    if home and path == home:
        return "~"
    if home and path.startswith(home + os.sep):
        return safety.HOME_PREFIX + path[len(home) + 1:]
    return path


def _errname(exc):
    return errno.errorcode.get(getattr(exc, "errno", None) or 0, type(exc).__name__)


def _iso_epoch(seconds):
    return safety.iso(dt.datetime.fromtimestamp(seconds, dt.timezone.utc))


def _parse_iso(text):
    try:
        moment = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except (AttributeError, TypeError, ValueError):
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=dt.timezone.utc)


# ── discovery ───────────────────────────────────────────────────────────────────────────────

def _work_tree_of(common_dir):
    # A non-bare repository keeps its common dir at <work tree>/.git.
    return os.path.dirname(common_dir) if os.path.basename(common_dir) == ".git" else common_dir


def _read_small(path, problems, label, limit=SMALL_MAX):
    raw, why = safety.read_checked(path, limit)
    if raw is None and why != "missing":
        problems.append("%s unreadable: %s" % (label, why))
    return None if raw is None else raw.decode("utf-8", "surrogateescape")


def _read_alternates(common_dir, problems):
    """Lender work trees (or object dirs when no work tree can be derived) this repo borrows from."""
    text = _read_small(os.path.join(common_dir, "objects", "info", "alternates"), problems, "alternates")
    lenders = []
    for line in (text or "").splitlines():
        entry = line.strip()
        if not entry or entry.startswith("#"):
            continue
        objects = os.path.realpath(entry if os.path.isabs(entry)
                                   else os.path.join(common_dir, "objects", entry))
        if os.path.basename(objects) == "objects":
            lenders.append(_work_tree_of(os.path.dirname(objects)))
        else:
            lenders.append(objects)
        if not os.path.isdir(objects):
            problems.append("alternates entry points at a missing object dir")
    return sorted(set(lenders))


def _read_registrations(common_dir, problems):
    """Linked worktrees registered in common_dir/worktrees. A registration whose <worktree>/.git
    no longer exists is prunable; nothing is pruned, it is only reported."""
    folder = os.path.join(common_dir, "worktrees")
    try:
        with os.scandir(folder) as it:
            names = sorted(entry.name for entry in it if entry.is_dir(follow_symlinks=False))
    except FileNotFoundError:
        return []
    except OSError as exc:
        problems.append("worktree registrations unreadable: %s" % _errname(exc))
        return []
    found = []
    for name in names:
        registration = os.path.join(folder, name)
        text = _read_small(os.path.join(registration, "gitdir"), problems, "worktree gitdir", 4096)
        if text is None or not text.strip():
            found.append({"name": name, "path": None, "present": False})
            continue
        target = text.strip()
        if not os.path.isabs(target):
            target = os.path.normpath(os.path.join(registration, target))
        found.append({"name": name, "path": os.path.dirname(target), "present": os.path.lexists(target)})
    return found


def inspect_root(path, discovered_by="direct"):
    """Structural facts of one git root from plain-file reads only (no git call):
    gitkind, hub / worktree / submodule links, alternates and worktree registrations."""
    info = {"path": path, "gitkind": None, "hub": None, "is_worktree": False, "is_hub": False,
            "submodule_of": None, "nested_in": None, "alternates": [], "registrations": [],
            "discovered_by": discovered_by, "problems": [], "_common": None}
    problems = info["problems"]
    dotgit = os.path.join(path, ".git")
    try:
        mode = os.lstat(dotgit).st_mode
        if stat.S_ISLNK(mode):
            mode = os.stat(dotgit).st_mode
    except FileNotFoundError:
        problems.append(".git is missing")
        return info
    except OSError as exc:
        problems.append(".git unreadable: %s" % _errname(exc))
        return info
    if stat.S_ISDIR(mode):
        info["gitkind"] = "dir"
        gitdir = os.path.realpath(dotgit)
    elif stat.S_ISREG(mode):
        info["gitkind"] = "file"
        text = _read_small(dotgit, problems, "gitfile", 4096)
        line = (text or "").strip()
        if not line.startswith("gitdir:"):
            problems.append("gitfile has no gitdir line")
            return info
        target = line[len("gitdir:"):].strip()
        gitdir = os.path.realpath(target if os.path.isabs(target) else os.path.join(path, target))
        if not os.path.isdir(gitdir):
            problems.append("gitfile points at a missing git dir")
            return info
    else:
        problems.append(".git is neither a directory nor a file")
        return info
    common = gitdir
    commondir = _read_small(os.path.join(gitdir, "commondir"), problems, "commondir", 4096)
    if commondir and commondir.strip():
        relative = commondir.strip()
        common = os.path.realpath(relative if os.path.isabs(relative) else os.path.join(gitdir, relative))
    info["_common"] = common
    if info["gitkind"] == "file":
        if common != gitdir and os.path.basename(os.path.dirname(gitdir)) == "worktrees":
            info["is_worktree"] = True
            info["hub"] = _work_tree_of(common)
        elif os.sep + os.path.join(".git", "modules") + os.sep in gitdir:
            info["submodule_of"] = gitdir.split(os.sep + os.path.join(".git", "modules") + os.sep, 1)[0]
    info["alternates"] = _read_alternates(common, problems)
    if not info["is_worktree"]:
        info["registrations"] = _read_registrations(common, problems)
        info["is_hub"] = bool(info["registrations"])
    return info


def _note_symlink(path, cov):
    """A symlinked directory is never entered; one that points at a git root is recorded as a
    symlink-index artifact so link farms are visible without being walked."""
    target = os.path.realpath(path)
    if os.path.isdir(target) and os.path.lexists(os.path.join(target, ".git")):
        cov["symlink_index"].append({"path": path, "target": target})
    else:
        cov["symlinks_skipped"] += 1


def _walk(root, prune_paths, max_depth, visited, found, cov):
    try:
        root_info = os.lstat(root)
    except FileNotFoundError:
        # An absent root holds no repos: a fact, not a gap (e.g. no shared folder here).
        cov["missing_roots"].append(root)
        return
    except OSError as exc:
        cov["unreadable"].append({"path": root, "error": _errname(exc)})
        return
    if not stat.S_ISDIR(root_info.st_mode):
        cov["unreadable"].append({"path": root, "error": "not a directory"})
        return
    device = root_info.st_dev
    stack = [(root, 0)]
    while stack:
        path, depth = stack.pop()
        budget = float("inf") if max_depth is None else max_depth - depth
        # Roots overlap (HOME contains .cache); rescan only with a larger depth budget.
        if visited.get(path, -1) >= budget:
            continue
        visited[path] = budget
        try:
            with os.scandir(path) as it:
                entries = list(it)
        except OSError as exc:
            cov["unreadable"].append({"path": path, "error": _errname(exc)})
            continue
        cov["dirs_scanned"] += 1
        if any(entry.name == ".git" for entry in entries):
            found.setdefault(path, "walk")
        if budget <= 0:
            continue
        for entry in entries:
            name = entry.name
            if name == ".git" or name in safety.PRUNE_NAMES:
                continue
            child = entry.path
            if child in prune_paths:
                continue
            try:
                if entry.is_symlink():
                    _note_symlink(child, cov)
                    continue
                if not entry.is_dir(follow_symlinks=False):
                    continue
                child_dev = entry.stat(follow_symlinks=False).st_dev
            except OSError as exc:
                cov["unreadable"].append({"path": child, "error": _errname(exc)})
                continue
            if child_dev != device:
                cov["other_device"].append(child)
                continue
            stack.append((child, depth + 1))


def _inside(path, prune_paths):
    if any(part in safety.PRUNE_NAMES for part in path.split(os.sep)):
        return True
    return any(path == p or path.startswith(p + os.sep) for p in prune_paths)


def discover(roots, prune=None, mode="full", known=(), max_depth=None, known_links=()):
    """Walk roots and return (roots_found, coverage).

    mode: full (unlimited depth), quick (depth <= 4 under each root plus every known root that
    still has a .git), reuse (no walk; the known roots only). known_links: symlink-index paths of
    the previous census, re-examined one by one outside a full walk, so a link deeper than the
    quick depth is seen again rather than reported missing. prune: absolute paths never
    entered (default safety.prune_set()); safety.PRUNE_NAMES and .git dirs are pruned anywhere.
    Each found root is an inspect_root() dict plus nested_in; present worktree registrations
    outside the walk are added (discovered_by "registration"). Unreadable directories are
    coverage errors: expected = roots + unreadable, observed = roots, errors = unreadable."""
    if mode not in ("full", "quick", "reuse"):
        raise ValueError("unknown discovery mode: %r" % (mode,))
    prune_paths = {os.path.realpath(p) for p in (safety.prune_set() if prune is None else prune)}
    depth = None if mode == "full" else (QUICK_DEPTH if max_depth is None else max_depth)
    walk_roots = []
    for root in roots:
        real = os.path.realpath(root)
        if real not in walk_roots:
            walk_roots.append(real)
    cov = {"mode": mode, "roots": walk_roots, "max_depth": depth, "dirs_scanned": 0,
           "unreadable": [], "other_device": [], "symlink_index": [], "symlinks_skipped": 0,
           "known_missing": [], "known_links_missing": [], "missing_roots": [], "prunable_registrations": 0}
    found = {}
    if mode != "reuse":
        visited = {}
        for root in walk_roots:
            _walk(root, prune_paths, depth, visited, found, cov)
    if mode != "full":
        for path in known:
            real = os.path.realpath(path)
            if real in found:
                continue
            if os.path.lexists(os.path.join(real, ".git")):
                found[real] = "known"
            else:
                cov["known_missing"].append(real)
        seen_links = {entry["path"] for entry in cov["symlink_index"]}
        for path in known_links:
            if path in seen_links or _inside(path, prune_paths):
                continue
            if os.path.islink(path):
                _note_symlink(path, cov)  # still an index only if it still points at a git root
            else:
                cov["known_links_missing"].append(path)
    infos = {path: inspect_root(path, how) for path, how in found.items()}
    for info in list(infos.values()):
        for registration in info["registrations"]:
            target = registration["path"]
            if not registration["present"]:
                cov["prunable_registrations"] += 1
            elif target and os.path.realpath(target) not in infos and not _inside(target, prune_paths):
                real = os.path.realpath(target)
                infos[real] = inspect_root(real, "registration")
    outer = set(walk_roots)  # a discovery root that is itself a repo (HOME) nests nothing
    for path, info in infos.items():
        parent = os.path.dirname(path)
        while parent != os.path.dirname(parent):
            if parent in infos and parent not in outer:
                info["nested_in"] = parent
                break
            parent = os.path.dirname(parent)
    cov["unreadable"] = sorted({u["path"]: u for u in cov["unreadable"]}.values(), key=lambda u: u["path"])
    cov["other_device"] = sorted(set(cov["other_device"]))
    cov["symlink_index"].sort(key=lambda s: s["path"])
    cov["known_missing"].sort()
    cov["known_links_missing"].sort()
    cov["expected"] = len(infos) + len(cov["unreadable"])
    cov["observed"] = len(infos)
    cov["errors"] = len(cov["unreadable"])
    return [infos[path] for path in sorted(infos)], cov


# ── measurement ─────────────────────────────────────────────────────────────────────────────

class _Runner(safety.GitRunner):
    """GitRunner that remembers which subcommands timed out, including the ones made inside
    toplevel_check and promisor_state, so a slow git is reported as a timeout."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.timeouts = []

    def run(self, subcmd, *args, timeout=None):
        result = super().run(subcmd, *args, timeout=timeout)
        if result.timed_out:
            self.timeouts.append(subcmd)
        return result


def _call(runner, rec, field, subcmd, *args):
    """One allowlisted call. Returns the Result, or None after noting a refusal or timeout."""
    try:
        result = runner.run(subcmd, *args)
    except safety.GitRefused as exc:
        rec["errors"].append("%s: refused: %s" % (field, exc))
        return None
    if result.timed_out:
        rec["errors"].append("%s: git %s timed out" % (field, subcmd))
        return None
    return result


def _failed(rec, field, subcmd, result):
    first = (result.err.strip().splitlines() or ["no message"])[0][:200]
    rec["errors"].append("%s: git %s exit %s: %s" % (field, subcmd, result.code, first))


def _blank(info, home, observed_at):
    path = info["path"]
    registrations = info["registrations"]
    return {
        "kind": "checkout", "id": checkout_id(path), "path": path, "rel": display_rel(path, home),
        # project_id and the final checkout_role are assigned by the model join; the census
        # only sets the structural roles it can see (linked-worktree, submodule, nested, gone).
        "project_id": None, "checkout_role": None,
        "gitkind": info["gitkind"], "hub": info["hub"], "is_worktree": info["is_worktree"],
        "is_hub": info["is_hub"], "submodule_of": info["submodule_of"], "nested_in": info["nested_in"],
        "discovered_by": info["discovered_by"],
        "branch": None, "detached": None, "head": None, "born": None, "shallow": None,
        "root_commit": None, "root_commits": None, "last_commit_at": None, "last_author": None,
        "commits": None,
        "upstream": {"state": "unknown", "ref": None, "ahead": None, "behind": None, "as_of_fetch": None},
        "unpushed_commits": None, "stash_count": None,
        "dirty": {"modified": None, "untracked": None, "mode": "unknown"},
        "partial": {"flag": None, "reasons": []},
        "alternates": list(info["alternates"]), "lends_objects_to": [],
        "worktrees": {"registered": len(registrations),
                      "prunable": sum(1 for r in registrations if not r["present"]),
                      "basis": "files", "registrations": registrations},
        "remotes": None, "primary_remote": None, "primary_remote_name": None,
        "tracked_files": None, "top_ext": None,
        "manifests": None, "manifests_tracked": None, "workflows": None,
        "card": {"present": None, "tracked": None, "text_sha256": None, "text": None},
        "has_claude_md": None, "wake_markers": None, "fate": None, "rest_marker": None,
        "readme_title": None, "post_commit_hook": None,
        "measure_status": None, "errors": list(info["problems"]), "notes": [],
        "observed_at": observed_at,
    }


def _structural_role(rec):
    if rec["measure_status"] == "gone-during-run":
        return "gone-during-run"
    if rec["is_worktree"]:
        return "linked-worktree"
    if rec["submodule_of"]:
        return "submodule"
    if rec["nested_in"]:
        return "nested"
    return None


def _discard(rec, top):
    reason = top["reason"]
    if reason == "timeout":
        rec["errors"].append("toplevel: git rev-parse timed out")
        rec["measure_status"] = "timeout"
    elif reason in ("gone", "toplevel mismatch") or not os.path.lexists(os.path.join(rec["path"], ".git")):
        # Spec 6.4: a root that is no longer its own top level is discarded as gone-during-run.
        rec["errors"].append("toplevel: %s" % reason)
        rec["measure_status"] = "gone-during-run"
    else:
        rec["errors"].append("toplevel: %s" % reason)
        rec["measure_status"] = "error"
    rec["checkout_role"] = _structural_role(rec)
    return rec


def _measure_head(runner, rec):
    result = _call(runner, rec, "shallow", "rev-parse", "--is-shallow-repository")
    if result is not None:
        if result.ok and result.out.strip() in ("true", "false"):
            rec["shallow"] = result.out.strip() == "true"
        else:
            _failed(rec, "shallow", "rev-parse", result)
    result = _call(runner, rec, "branch", "symbolic-ref", "-q", "--short", "HEAD")
    if result is not None:
        if result.ok:
            rec["branch"], rec["detached"] = result.out.strip(), False
        elif result.code == 1:
            rec["branch"], rec["detached"] = None, True
        else:
            _failed(rec, "branch", "symbolic-ref", result)
    result = _call(runner, rec, "head", "rev-parse", "--verify", "-q", "HEAD")
    if result is None:
        return
    if result.ok:
        rec["head"], rec["born"] = result.out.strip(), True
    elif result.code == 1 and not result.out.strip():
        # Unborn HEAD: no commits yet. Zero here is a measurement, not a default.
        rec["born"], rec["commits"], rec["root_commits"] = False, 0, 0
        return
    else:
        _failed(rec, "head", "rev-parse", result)
        return
    result = _call(runner, rec, "last_commit", "log", "-1", "--format=%ct%x00%an")
    if result is not None:
        parts = result.out.rstrip("\n").split("\x00")
        if result.ok and len(parts) == 2 and parts[0].isdigit():
            rec["last_commit_at"], rec["last_author"] = _iso_epoch(int(parts[0])), parts[1]
        else:
            _failed(rec, "last_commit", "log", result)
    result = _call(runner, rec, "commits", "rev-list", "--count", "HEAD")
    if result is not None:
        if result.ok and result.out.strip().isdigit():
            rec["commits"] = int(result.out.strip())
        else:
            _failed(rec, "commits", "rev-list", result)
    result = _call(runner, rec, "root_commit", "rev-list", "--max-parents=0", "HEAD")
    if result is not None:
        roots = result.out.split()
        if result.ok and roots:
            # rev-list lists newest first; the last root is the oldest history's start.
            rec["root_commit"], rec["root_commits"] = roots[-1], len(roots)
        else:
            _failed(rec, "root_commit", "rev-list", result)


_UPSTREAM_NONE = ("no upstream configured", "does not point to a branch")
_UPSTREAM_GONE = ("ambiguous argument", "unknown revision")
_UPSTREAM_UNMAPPED = ("not stored as a remote-tracking branch",)


def _measure_upstream(runner, rec, common):
    upstream = rec["upstream"]
    fetch_head = os.path.join(common, "FETCH_HEAD")
    try:
        upstream["as_of_fetch"] = _iso_epoch(os.lstat(fetch_head).st_mtime)
    except FileNotFoundError:
        upstream["as_of_fetch"] = None  # never fetched (or FETCH_HEAD removed)
    except OSError as exc:
        rec["errors"].append("upstream: FETCH_HEAD unreadable: %s" % _errname(exc))
    if rec["born"] is False:
        upstream["state"] = "unborn"
        return
    if rec["detached"] is True:
        upstream["state"] = "none"
        return
    if rec["detached"] is None or rec["born"] is None:
        return  # branch or HEAD unknown: upstream stays unknown
    result = _call(runner, rec, "upstream", "rev-parse", "--abbrev-ref", "@{u}")
    if result is None:
        return
    if not result.ok:
        message = result.err
        for state, needles in (("none", _UPSTREAM_NONE), ("gone", _UPSTREAM_GONE),
                               ("unmapped", _UPSTREAM_UNMAPPED)):
            if result.code == 128 and any(n in message for n in needles):
                upstream["state"] = state
                return
        _failed(rec, "upstream", "rev-parse", result)
        return
    upstream["ref"] = result.out.strip()
    result = _call(runner, rec, "upstream", "rev-list", "--left-right", "--count", "@{u}...HEAD")
    if result is None:
        return
    counts = result.out.split()
    if result.ok and len(counts) == 2 and all(c.isdigit() for c in counts):
        upstream["behind"], upstream["ahead"] = int(counts[0]), int(counts[1])
        upstream["state"] = "tracking"
    else:
        _failed(rec, "upstream", "rev-list", result)


def _measure_refs(runner, rec, common):
    result = _call(runner, rec, "unpushed_commits", "rev-list", "--branches", "--not", "--remotes", "--count")
    if result is not None:
        if result.ok and result.out.strip().isdigit():
            rec["unpushed_commits"] = int(result.out.strip())
        else:
            _failed(rec, "unpushed_commits", "rev-list", result)
    # git stash always writes the stash reflog, so its line count is the entry count.
    raw, why = safety.read_checked(os.path.join(common, "logs", "refs", "stash"), 4 << 20)
    if raw is not None:
        rec["stash_count"] = sum(1 for line in raw.splitlines() if line.strip())
    elif why == "missing":
        if os.path.lexists(os.path.join(common, "refs", "stash")):
            rec["errors"].append("stash_count: refs/stash exists without its reflog")
        else:
            rec["stash_count"] = 0
    else:
        rec["errors"].append("stash_count: stash reflog unreadable: %s" % why)


def _measure_worktrees(runner, rec):
    if not rec["is_hub"]:
        return
    result = _call(runner, rec, "worktrees", "worktree", "list", "--porcelain")
    if result is None:
        return
    if not result.ok:
        _failed(rec, "worktrees", "worktree", result)
        return
    blocks = [block for block in result.out.split("\n\n") if block.startswith("worktree ")]
    linked = blocks[1:]  # the first block is the main work tree
    rec["worktrees"]["registered"] = len(linked)
    rec["worktrees"]["prunable"] = sum(
        1 for block in linked if any(line.startswith("prunable") for line in block.splitlines()))
    rec["worktrees"]["basis"] = "git"


def _measure_remotes(runner, rec):
    result = _call(runner, rec, "remotes", "config", "--get-regexp", r"^remote\..*\.url$")
    if result is None:
        return
    if not result.ok and not (result.code == 1 and not result.out.strip()):
        _failed(rec, "remotes", "config", result)
        return
    remotes = {}
    for line in result.out.splitlines():
        key, _, url = line.partition(" ")
        if not (key.startswith("remote.") and key.endswith(".url")):
            continue
        name = key[len("remote."):-len(".url")]
        # Only the normalized id is kept: raw URLs can carry credentials.
        remotes[name] = safety.normalize_remote(url)
        if remotes[name] is None:
            rec["notes"].append("remote %s: unrecognised URL form" % name)
    rec["remotes"] = dict(sorted(remotes.items()))
    names = (["origin"] if "origin" in remotes else []) + sorted(n for n in remotes if n != "origin")
    for name in names:
        if remotes[name]:
            rec["primary_remote"], rec["primary_remote_name"] = remotes[name], name
            break


def _measure_files(runner, rec):
    result = _call(runner, rec, "tracked_files", "ls-files", "-z")
    if result is None:
        return None
    if not result.ok:
        _failed(rec, "tracked_files", "ls-files", result)
        return None
    tracked = [name for name in result.out.split("\x00") if name]
    rec["tracked_files"] = len(tracked)
    counts = Counter(os.path.splitext(os.path.basename(name))[1].lower() or "(none)" for name in tracked)
    rec["top_ext"] = [[ext, n] for ext, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:TOP_EXT]]
    # GitHub runs only files directly in .github/workflows, so nested paths do not count.
    rec["workflows"] = sorted(name for name in tracked if os.path.dirname(name) == WORKFLOW_DIR
                              and os.path.splitext(name)[1] in (".yml", ".yaml"))
    return set(tracked)


def _parse_status(text):
    modified = untracked = 0
    fields = text.split("\x00")
    index = 0
    while index < len(fields):
        entry = fields[index]
        index += 1
        if len(entry) < 3:
            continue
        code = entry[:2]
        if code == "??":
            untracked += 1
        elif code != "!!":
            modified += 1
            if "R" in code or "C" in code:
                index += 1  # a rename or copy is followed by its source path
    return modified, untracked


def _measure_dirty(runner, rec):
    dirty = rec["dirty"]
    flag = rec["partial"]["flag"]
    if flag is True:
        dirty["mode"] = "skipped-partial"
        return
    if flag is None:
        rec["errors"].append("dirty: skipped, promisor config could not be verified")
        return
    # status would run any configured filter driver on stat-dirty files; dirty stays unknown.
    filters, keys = runner.filter_state()
    if filters is not False:
        rec["errors"].append("dirty: skipped, %s; status would run them" % (
            "filter drivers configured (%s)" % ", ".join(keys) if filters else "filter config unverified (%s)"
            % ", ".join(keys)))
        return
    result = _call(runner, rec, "dirty", "status", "--porcelain=v1", "-z", "-unormal", "--ignore-submodules=all")
    if result is None:
        return
    if not result.ok:
        _failed(rec, "dirty", "status", result)
        return
    dirty["modified"], dirty["untracked"] = _parse_status(result.out)
    dirty["mode"] = "normal"


def _has_session_start_command(data):
    """harvest hasConfiguredSessionStartCommand: some SessionStart entry holds a hook of type
    command with a non-blank command string."""
    hooks = data.get("hooks") if isinstance(data, dict) else None
    entries = hooks.get("SessionStart") if isinstance(hooks, dict) else None
    if not isinstance(entries, list):
        return False
    for entry in entries:
        for hook in (entry.get("hooks") if isinstance(entry, dict) else None) or ():
            if (isinstance(hook, dict) and hook.get("type") == "command"
                    and isinstance(hook.get("command"), str) and hook["command"].strip()):
                return True
    return False


def _session_start(path, rec):
    """True when either repo settings file wires a SessionStart command, None when a file
    exists but could not be read. Only the boolean is kept, never the settings contents."""
    unknown = False
    for rel in SETTINGS_FILES:
        raw, why = safety.read_checked(os.path.join(path, rel))
        if raw is None:
            if why != "missing":
                rec["notes"].append("%s not read: %s" % (rel, why))
                unknown = True
            continue
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            continue  # harvest treats unparseable settings as no hook
        if _has_session_start_command(data):
            return True
    return None if unknown else False


def _readme_title(path, rec):
    for name in README_NAMES:
        raw, why = safety.read_checked(os.path.join(path, name))
        if raw is None:
            if why != "missing":
                rec["notes"].append("%s not read: %s" % (name, why))
            continue
        for line in raw.decode("utf-8", "replace").splitlines()[:README_LINES]:
            if line.startswith("#"):
                title = line.lstrip("#").strip()
                if title:
                    return title[:160]
        return None
    return None


def _measure_markers(runner, rec, tracked, common):
    path = rec["path"]

    def exists(rel):  # harvest uses existsSync, which follows links; so does this presence test
        return os.path.exists(os.path.join(path, rel))

    card = rec["card"]
    card["present"] = os.path.isfile(os.path.join(path, CARD_NAME))
    if card["present"]:
        raw, why = safety.read_checked(os.path.join(path, CARD_NAME), CARD_MAX)
        if raw is None:
            rec["notes"].append("%s not read: %s" % (CARD_NAME, why))
        else:
            card["text_sha256"] = hashlib.sha256(raw).hexdigest()
            card["text"] = raw.decode("utf-8", "replace")
    if tracked is not None:
        card["tracked"] = CARD_NAME in tracked
    elif card["present"]:
        result = _call(runner, rec, "card", "ls-files", "--error-unmatch", "--", CARD_NAME)
        if result is not None:
            if result.code in (0, 1):
                card["tracked"] = result.code == 0
            else:
                _failed(rec, "card", "ls-files", result)
    rec["has_claude_md"] = exists("CLAUDE.md")
    rec["wake_markers"] = {"wake_md": exists("WAKE.md"),
                           "hook_file": exists(os.path.join(".claude", "hooks", "wake-sophia.sh")),
                           "session_start": _session_start(path, rec)}
    rec["fate"] = exists(os.path.join("docs", "fate", "FATE.md")) or exists("fate")
    rec["readme_title"] = _readme_title(path, rec)
    manifests = [name for name in MANIFESTS if os.path.lexists(os.path.join(path, name))]
    if os.path.isdir(os.path.join(path, WORKFLOW_DIR)):
        manifests.append(WORKFLOW_DIR)
    try:
        with os.scandir(path) as it:
            names = {entry.name for entry in it}
    except OSError as exc:
        rec["errors"].append("manifests: root unreadable: %s" % _errname(exc))
    else:
        if any(name.endswith(".tf") for name in names):
            manifests.append("terraform")
        # Exact names from the listing: APFS matches case-insensitively, so a "rest/" source
        # directory must not read as the REST marker.
        rec["rest_marker"] = [name for name in REST_MARKERS if name in names]
    rec["manifests"] = manifests
    if tracked is not None:
        rec["manifests_tracked"] = [name for name in manifests if name in tracked]
    hook = os.path.join(common, "hooks", "post-commit")
    rec["post_commit_hook"] = os.path.isfile(hook) and os.access(hook, os.X_OK)


def measure(root, home=None, git="git", timeout=20, status_timeout=60):
    """Measure one checkout read-only. root is a path or a discover() entry. Returns the
    checkout record (spec section 3); for a bare path, nested_in is not computed."""
    info = root if isinstance(root, dict) else inspect_root(os.path.realpath(root))
    home = os.environ.get("HOME", "") if home is None else home
    rec = _blank(info, home, safety.iso(safety.utc_now()))
    runner = _Runner(info["path"], git=git, timeout=timeout, status_timeout=status_timeout)
    top = runner.toplevel_check()
    if not top["ok"]:
        return _discard(rec, top)
    flag, reasons = runner.promisor_state()
    rec["partial"] = {"flag": flag, "reasons": list(reasons)}
    if flag is None:
        rec["errors"].append("partial: promisor config unverified: %s" % ", ".join(reasons))
    common = info["_common"] or os.path.join(info["path"], ".git")
    _measure_head(runner, rec)
    _measure_upstream(runner, rec, common)
    _measure_refs(runner, rec, common)
    _measure_worktrees(runner, rec)
    _measure_remotes(runner, rec)
    tracked = _measure_files(runner, rec)
    _measure_dirty(runner, rec)
    _measure_markers(runner, rec, tracked, common)
    if flag is True:
        rec["measure_status"] = STATUS_SKIPPED_PARTIAL
    elif runner.timeouts:
        rec["measure_status"] = "timeout"
    elif rec["errors"]:
        rec["measure_status"] = "partial"
    else:
        rec["measure_status"] = "ok"
    rec["checkout_role"] = _structural_role(rec)
    return rec


def _measure_guarded(info, home, git, timeout, status_timeout):
    try:
        return measure(info, home=home, git=git, timeout=timeout, status_timeout=status_timeout)
    except Exception as exc:  # one bad root must not drop the others; it is reported instead
        rec = _blank(info, home, safety.iso(safety.utc_now()))
        rec["errors"].append("measure crashed: %s: %s" % (type(exc).__name__, exc))
        rec["measure_status"] = "error"
        return rec


# ── the census ──────────────────────────────────────────────────────────────────────────────

def _known_paths(prev):
    if isinstance(prev, dict):
        rows = prev.get("checkouts") or []
    elif isinstance(prev, list):
        rows = [r for r in prev if isinstance(r, dict) and r.get("kind") == "checkout"]
    else:
        rows = []
    return [r["path"] for r in rows if isinstance(r.get("path"), str) and os.path.isabs(r["path"])]


def _known_links(prev):
    """Paths of the symlink indexes a previous census found (its artifacts, or artifact records).
    Curated artifacts of the same kind name link farms, not single links, so only ids this
    module mints count."""
    if isinstance(prev, dict):
        rows = prev.get("artifacts") or []
    else:
        rows = prev if isinstance(prev, list) else []
    return sorted({r["path"] for r in rows if isinstance(r, dict) and str(r.get("id", "")).startswith(SYMLINK_INDEX_ID)
                   and isinstance(r.get("path"), str) and os.path.isabs(r["path"])})


def pick_mode(requested, prev, now):
    """(mode, reason). quick turns into full on a first run or when the last full walk is
    older than 7 days; full and reuse are taken as asked."""
    if requested in ("full", "reuse"):
        return requested, "requested"
    if requested != "quick":
        raise ValueError("unknown census mode: %r" % (requested,))
    if not _known_paths(prev):
        return "full", "no previous census"
    last_full = _parse_iso(prev.get("last_full_at")) if isinstance(prev, dict) else None
    if last_full is None:
        return "full", "no recorded full walk"
    if now - last_full.timestamp() > FULL_WALK_MAX_AGE_S:
        return "full", "last full walk older than 7 d"
    return "quick", "requested"


def _reuse(prev, now):
    if not isinstance(prev, dict) or not isinstance(prev.get("checkouts"), list):
        raise safety.EstateError("--reuse-census needs a previous census")
    reused = dict(prev)
    finished = _parse_iso(prev.get("finished_at"))
    reused.update({"mode": "reuse", "mode_reason": "requested", "reused_from": prev.get("finished_at"),
                   "reuse_age_s": None if finished is None else int(now - finished.timestamp())})
    return reused


def _symlink_artifact(entry, home, observed_at):
    rec = {"kind": "artifact", "id": SYMLINK_INDEX_ID + safety.sha12(entry["path"]),
           "path": entry["path"], "rel": display_rel(entry["path"], home), "artifact_kind": "symlink-index",
           "target": entry["target"], "target_rel": display_rel(entry["target"], home),
           "owner_project": None, "size": None, "mtime": None, "mode": None,
           "secret_bearing": False, "contents_read": False, "backup": "unknown", "observed_at": observed_at}
    try:
        info = os.lstat(entry["path"])
        rec["size"], rec["mtime"], rec["mode"] = info.st_size, _iso_epoch(info.st_mtime), stat.S_IMODE(info.st_mode)
    except OSError as exc:
        rec["error"] = "lstat failed: %s" % _errname(exc)
    return rec


def _link_lenders(checkouts):
    by_path = {c["path"]: c for c in checkouts}
    for borrower in checkouts:
        for lender in borrower["alternates"]:
            if lender in by_path:
                by_path[lender]["lends_objects_to"].append(borrower["path"])
    for checkout in checkouts:
        checkout["lends_objects_to"].sort()


def _coverage(checkouts, walk):
    statuses = Counter(c["measure_status"] for c in checkouts)
    observed = sum(statuses[s] for s in OBSERVED_STATUSES)
    unmeasured = [{"id": c["id"], "path": c["path"], "measure_status": c["measure_status"],
                   "errors": c["errors"]} for c in checkouts if c["measure_status"] not in OBSERVED_STATUSES]
    return {
        # An unreadable directory is a unit we expected to see and could not.
        "expected": len(checkouts) + len(walk["unreadable"]),
        "observed": observed,
        "errors": len(unmeasured) + len(walk["unreadable"]),
        "by_status": dict(sorted(statuses.items())),
        "partially_measured": sorted(c["id"] for c in checkouts if c["measure_status"] == "partial"),
        "unmeasured": unmeasured,
        "unreadable": walk["unreadable"],
        "other_device": walk["other_device"],
        "known_missing": walk["known_missing"],
        "known_links_missing": walk["known_links_missing"],
        "missing_roots": walk["missing_roots"],
        "prunable_registrations": walk["prunable_registrations"],
        "symlinks_skipped": walk["symlinks_skipped"],
        "dirs_scanned": walk["dirs_scanned"],
        "max_depth": walk["max_depth"],
    }


def run_census(cfg, prev=None, mode="quick", home=None, layer_dir=None, workers=WORKERS,
               git="git", timeout=20, status_timeout=60, clock=time.time):
    """Discover and measure every checkout. cfg is the parsed private/config.toml ([roots]
    extra is used); prev is the previous census (or its records). Returns
    {schema, mode, mode_reason, started_at, finished_at, last_full_at, roots, checkouts,
    artifacts, coverage, state, degraded_reasons}. Every discovered root yields exactly one
    checkout record, so coverage.expected == coverage.observed + coverage.errors."""
    cfg = cfg or {}
    home = os.environ.get("HOME", "") if home is None else home
    started = clock()
    if mode == "reuse":
        return _reuse(prev, started)
    mode, reason = pick_mode(mode, prev, started)
    extra = (cfg.get("roots") or {}).get("extra") or []
    if not (isinstance(extra, list) and all(isinstance(p, str) for p in extra)):
        raise safety.GuardError("config [roots].extra must be a list of paths")
    roots = [safety.expand_locator(p, home) for p in list(safety.DISCOVERY_ROOTS) + extra]
    quick = mode == "quick"
    found, walk = discover(roots, safety.prune_set(home, layer_dir), mode, _known_paths(prev) if quick else (),
                           known_links=_known_links(prev) if quick else ())
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_measure_guarded, info, home, git, timeout, status_timeout) for info in found]
        checkouts = [future.result() for future in futures]
    _link_lenders(checkouts)
    finished = clock()
    artifacts = [_symlink_artifact(entry, home, _iso_epoch(finished)) for entry in walk["symlink_index"]]
    coverage = _coverage(checkouts, walk)
    degraded = []
    if coverage["unmeasured"]:
        degraded.append("%d checkouts unmeasured" % len(coverage["unmeasured"]))
    if coverage["partially_measured"]:
        degraded.append("%d checkouts partially measured" % len(coverage["partially_measured"]))
    if walk["unreadable"]:
        degraded.append("%d directories unreadable" % len(walk["unreadable"]))
    if mode == "full":
        last_full = _iso_epoch(started)
    else:  # pick_mode only keeps quick when prev is a census dict with a recent full walk
        last_full = prev.get("last_full_at")
    return {
        "schema": SCHEMA, "mode": mode, "mode_reason": reason,
        "started_at": _iso_epoch(started), "finished_at": _iso_epoch(finished), "last_full_at": last_full,
        "roots": walk["roots"], "checkouts": checkouts, "artifacts": artifacts, "coverage": coverage,
        "state": "degraded" if degraded else "complete", "degraded_reasons": degraded,
    }
