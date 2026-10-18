"""estate: the command line of the estate layer (spec sections 2, 6, 7 and 11).

One build measures the estate, reads KINGDOM live, joins, proposes, validates, renders, builds the
symlink tree and seals a new run under the private area; nothing outside the private area changes
except the two convenience links beside it. The other verbs read a sealed run back (check, show,
ls, proposals) or are owner verbs that print a diff and change a committed file only with --write.

Exit codes: 0 complete and fresh; 10 complete but degraded (every reason listed); 1 failed (the
previous run stays current); 2 usage error or guard refusal (nothing written).
"""
import os
import stat
import sys

TOOL_DIR = os.path.dirname(os.path.realpath(__file__))


def untrusted_tool_files(tool_dir):
    """Reasons the tool's own code may not be ours: -I drops the script directory from sys.path,
    so it is inserted by hand, and only once the directory and every module in it are owned by
    this uid and writable by nobody else."""
    uid = os.getuid()
    try:
        names = sorted(n for n in os.listdir(tool_dir) if n.endswith(".py"))
    except OSError as exc:
        return ["cannot list %s: %s" % (tool_dir, exc.strerror)]
    problems = []
    for path in [tool_dir] + [os.path.join(tool_dir, n) for n in names]:
        try:
            info = os.lstat(path)
        except OSError as exc:
            problems.append("%s: %s" % (path, exc.strerror))
            continue
        if stat.S_ISLNK(info.st_mode):
            problems.append("%s is a symlink" % path)
        if info.st_uid != uid:
            problems.append("%s is not owned by uid %d" % (path, uid))
        if info.st_mode & 0o022:
            problems.append("%s is group- or world-writable" % path)
    return problems


_PROBLEMS = untrusted_tool_files(TOOL_DIR)
if _PROBLEMS:
    sys.stderr.write("estate: refusing to load the tool: %s\n" % "; ".join(_PROBLEMS))
    raise SystemExit(2)
if TOOL_DIR not in sys.path:
    sys.path.insert(0, TOOL_DIR)

import argparse  # noqa: E402  (stdlib; after the trust check on purpose)
import datetime as dt  # noqa: E402
import hashlib  # noqa: E402
import json  # noqa: E402
import re  # noqa: E402
import shutil  # noqa: E402
import signal  # noqa: E402
import subprocess  # noqa: E402
import tarfile  # noqa: E402
import tomllib  # noqa: E402

import census  # noqa: E402
import curate  # noqa: E402
import decisions  # noqa: E402
import hygiene  # noqa: E402
import kingdom  # noqa: E402
import model  # noqa: E402
import proposals  # noqa: E402
import render  # noqa: E402
import safety  # noqa: E402
import sources  # noqa: E402
import sphere  # noqa: E402
import tree  # noqa: E402

from collections import Counter  # noqa: E402
from safety import GuardError, require  # noqa: E402


VERSION = "estate 1 (estate.run/1, estate.snapshot/1, estate.proposal/1)"
RUN_SCHEMA = "estate.run/1"
SNAPSHOT_SCHEMA = model.SNAPSHOT_SCHEMA
CONFIG = "config.toml"
CURRENT = "current"
RUNS = "runs"
CENSUS_FILE = "census.json"
RECORDS_FILE = "records.jsonl"
PROPOSALS_FILE = "proposals.jsonl"
RUN_FILE = "run.json"
# private/<name> -> its target, created after every seal (spec 6.13).
STATIC_LINKS = {"ATLAS.html": "current/ATLAS.html", "ATLAS.md": "current/ATLAS.md", "tree": "current/tree"}
DEFAULT_RETENTION = 5
STALE_AFTER_S = 7 * 86400
MAX_RUN_FILE = 512 << 20
OUTCOMES = proposals.DECISION_OUTCOMES
OWNERS = ("kingdom-os", "repo", "yu", "pr1-owner")
# Foundation alerts that mean KINGDOM could not be read completely: a measurement gap, so the run
# is degraded. Disagreements inside KINGDOM itself (schema vs enums, worktree vs origin/main) are
# drift for the atlas and DRIFT.md, not a fault of this run.
DEGRADING_ALERTS = ("foundation-parse", "origin-main-unreadable", "origin-main-parse", "architecture-rows",
                    "ambiguous-kingdom-os")
HARVEST_TIMEOUT = 120
HARVEST_VERBS = ("validate", "conformance")


# ── small helpers ───────────────────────────────────────────────────────────────────────────

def say(text=""):
    sys.stdout.write(text + "\n")


def warn(text):
    sys.stderr.write("estate: " + text + "\n")


def within(path, directory):
    return path == directory or path.startswith(directory.rstrip(os.sep) + os.sep)


def dumps(value, indent=None):
    # ASCII escapes keep non-UTF-8 path bytes (surrogateescape) writable and readable back.
    return json.dumps(value, sort_keys=True, ensure_ascii=True, indent=indent, default=str)


def worst_exit(codes):
    """2 beats 1 beats 10 beats 0: the most serious outcome of several checks."""
    for code in (2, 1, 10):
        if code in codes:
            return code
    return 0


def read_json(path, limit=MAX_RUN_FILE):
    raw, reason = safety.read_checked(path, limit)
    if raw is None:
        return None, reason
    try:
        return json.loads(raw.decode("utf-8")), None
    except (UnicodeDecodeError, ValueError) as exc:
        return None, "invalid json: %s" % exc


def read_jsonl(path, limit=MAX_RUN_FILE):
    raw, reason = safety.read_checked(path, limit)
    if raw is None:
        return None, reason
    rows = []
    try:
        for line in raw.decode("utf-8").splitlines():
            if line.strip():
                rows.append(json.loads(line))
    except (UnicodeDecodeError, ValueError) as exc:
        return None, "invalid json line: %s" % exc
    return rows, None


def dedupe(items):
    seen, out = set(), []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


class Ctx:
    """Where this invocation works: the layer, its private area, the host repository, HOME."""

    def __init__(self, layer_dir=None):
        self.layer = os.path.realpath(layer_dir or safety.LAYER_DIR)
        self.area = safety.PrivateArea(self.layer)
        self.private = self.area.root
        self.host = os.path.dirname(self.layer)
        self.home = os.environ.get("HOME", "")
        require(os.path.isabs(self.home), "HOME must be set to an absolute path")


# ── config ──────────────────────────────────────────────────────────────────────────────────

def config_problems(cfg):
    problems = []

    def table(name):
        value = cfg.get(name, {})
        if not isinstance(value, dict):
            problems.append("[%s] must be a table" % name)
            return {}
        return value

    ref = table("kingdom").get("ref")
    if ref is not None and ref not in kingdom.REFS:
        problems.append("[kingdom].ref must be one of %s" % ", ".join(kingdom.REFS))
    override = table("kingdom").get("kingdom_os_override")
    if override is not None and not isinstance(override, str):
        problems.append("[kingdom].kingdom_os_override must be a path string")
    for name, key in (("roots", "extra"), ("forge", "owners"), ("forge", "listings")):
        value = table(name).get(key)
        if value is not None and not (isinstance(value, list) and all(isinstance(v, str) for v in value)):
            problems.append("[%s].%s must be a list of strings" % (name, key))
    enabled = table("tree").get("enabled")
    if enabled is not None and not isinstance(enabled, bool):
        problems.append("[tree].enabled must be true or false")
    runs = table("retention").get("runs")
    if runs is not None and not (isinstance(runs, int) and not isinstance(runs, bool) and runs >= 1):
        problems.append("[retention].runs must be an integer >= 1")
    return problems


def load_config(area):
    """(config dict, note). A missing config builds with defaults and says so; an unreadable or
    malformed one is the owner's input gone wrong and is refused."""
    raw, reason = safety.read_checked(area.path(CONFIG), 1 << 20)
    if raw is None:
        if reason == "missing":
            return {}, "private config.toml missing; defaults used (no forge listings or locators)"
        raise GuardError("private config.toml unreadable: %s" % reason)
    try:
        cfg = tomllib.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        raise GuardError("private config.toml is not valid TOML: %s" % exc)
    problems = config_problems(cfg)
    if problems:
        raise GuardError("private config.toml: " + "; ".join(problems), problems)
    return cfg, None


# ── runs ────────────────────────────────────────────────────────────────────────────────────

def current_run(area):
    """(run dir, None) for private/current, or (None, reason). current must be the relative link
    runs/<run id> into a marked run."""
    link = os.path.join(area.root, CURRENT)
    try:
        target = os.readlink(link)
    except FileNotFoundError:
        return None, "no current run (run build first)"
    except OSError as exc:
        return None, "current is not a symlink (%s)" % exc.strerror
    parts = target.split("/")
    if len(parts) != 2 or parts[0] != RUNS or safety.RUN_ID.fullmatch(parts[1]) is None:
        return None, "current points outside the runs: %s" % target
    run_dir = os.path.join(area.root, RUNS, parts[1])
    try:
        safety.require_run_dir(area, run_dir)
    except GuardError as exc:
        return None, "current run %s: %s" % (parts[1], exc)
    return run_dir, None


def read_run(run_dir, want=("run", "records", "props", "census")):
    """One run read back: {dir, id, run, header, records, props, census, problems}."""
    out = {"dir": run_dir, "id": os.path.basename(run_dir), "run": None, "header": None, "records": None,
           "props": None, "census": None, "problems": []}
    if "run" in want:
        out["run"], why = read_json(os.path.join(run_dir, RUN_FILE))
        if why:
            out["problems"].append("%s: %s" % (RUN_FILE, why))
    if "records" in want:
        rows, why = read_jsonl(os.path.join(run_dir, RECORDS_FILE))
        if why:
            out["problems"].append("%s: %s" % (RECORDS_FILE, why))
        elif not rows or rows[0].get("schema") != SNAPSHOT_SCHEMA:
            out["problems"].append("%s: no %s header" % (RECORDS_FILE, SNAPSHOT_SCHEMA))
        else:
            out["header"], out["records"] = rows[0], rows[1:]
    if "props" in want:
        out["props"], why = read_jsonl(os.path.join(run_dir, PROPOSALS_FILE))
        if why:
            out["problems"].append("%s: %s" % (PROPOSALS_FILE, why))
    if "census" in want:
        out["census"], why = read_json(os.path.join(run_dir, CENSUS_FILE))
        if why:
            out["problems"].append("%s: %s" % (CENSUS_FILE, why))
    return out


def require_current(ctx, want):
    run_dir, why = current_run(ctx.area)
    require(run_dir is not None, why or "no current run")
    run = read_run(run_dir, want)
    require(not run["problems"], "current run %s unreadable: %s" % (run["id"], "; ".join(run["problems"])))
    return run


def previous_inputs(area):
    """What the next build needs from the current run: the snapshot for reconciliation, the
    proposals for their lifecycle, the census for quick and reuse modes. A current link that
    cannot be read is reported, never silently treated as a first run."""
    run_dir, why = current_run(area)
    empty = {"run_id": None, "dir": None, "snapshot": None, "props": None, "census": None, "problems": []}
    if run_dir is None:
        if os.path.lexists(os.path.join(area.root, CURRENT)):
            empty["problems"].append("previous run unreadable: %s" % why)
        return empty
    run = read_run(run_dir)
    out = dict(empty, run_id=run["id"], dir=run_dir)
    if run["problems"]:
        out["problems"].append("previous run %s partly unreadable: %s" % (run["id"], "; ".join(run["problems"])))
    if run["records"] is not None:
        observed = (run["header"] or {}).get("observed_at") or (run["run"] or {}).get("observed_at")
        out["snapshot"] = {"observed_at": observed, "records": run["records"]}
    out["props"] = run["props"]
    if isinstance(run["census"], dict) and isinstance(run["census"].get("checkouts"), list):
        out["census"] = run["census"]
    elif run["records"] is not None:
        # Without the census file the checkout records still give the known roots for a quick
        # walk; last_full_at comes from run.json so quick is not forced to full.
        meta = (run["run"] or {}).get("census") or {}
        out["census"] = {"checkouts": [r for r in run["records"] if r.get("kind") == "checkout"],
                         "last_full_at": meta.get("last_full_at"), "finished_at": meta.get("finished_at")}
    return out


def census_prev(prev, mode):
    """The previous census as run_census reads it. For a quick walk the known paths also take in
    the previous snapshot's checkouts and symlink indexes, missing stubs included, so each one is
    re-examined by path rather than presumed absent because the walk stopped above it. A quick
    census builds a fresh result, so these additions never reach a record unmeasured."""
    data = prev["census"]
    if mode != "quick" or data is None or prev["snapshot"] is None:
        return data
    records = prev["snapshot"]["records"]
    data = dict(data)
    paths = {c.get("path") for c in data.get("checkouts") or []}
    data["checkouts"] = list(data.get("checkouts") or []) + [
        r for r in records if r.get("kind") == "checkout" and r.get("path") not in paths]
    links = {a.get("path") for a in data.get("artifacts") or []}
    data["artifacts"] = list(data.get("artifacts") or []) + [
        r for r in records if r.get("kind") == "artifact" and str(r.get("id", "")).startswith(census.SYMLINK_INDEX_ID)
        and r.get("path") not in links]
    return data


def new_run_id(now):
    return now.strftime("%Y%m%dT%H%M%SZ") + "-" + os.urandom(2).hex()


def make_run_dir(area, now):
    for _attempt in range(8):
        run_id = new_run_id(now)
        rel = "/".join((RUNS, run_id))
        if os.path.lexists(area.path(rel)):
            continue
        area.mkdir(rel)
        area.write("/".join((rel, safety.RUN_MARKER)), run_id + "\n")
        return run_id, rel, area.path(rel)
    raise GuardError("could not pick an unused run id")


# ── locating kingdom-os outside a build ─────────────────────────────────────────────────────

def locate_kingdom_os(ctx, cfg):
    """kingdom.locate() for the verbs that read KINGDOM without building: the config override,
    else the checkouts measured by the current run, else one full census (a first run only)."""
    override = (cfg.get("kingdom") or {}).get("kingdom_os_override")
    if override:
        return kingdom.locate([], override)
    run_dir, _why = current_run(ctx.area)
    if run_dir is not None:
        run = read_run(run_dir, ("records",))
        checkouts = [r for r in run["records"] or [] if r.get("kind") == "checkout"
                     and r.get("presence", "present") == "present"]
        if checkouts:
            # A census would meet the same checkouts and the same ambiguity, so a failure here is
            # reported as it is rather than retried the slow way.
            try:
                loc = kingdom.locate(checkouts)
            except kingdom.FoundationError as exc:
                raise kingdom.FoundationError("kingdom-os could not be located among the checkouts of run %s: %s; "
                                              "set [kingdom].kingdom_os_override in private/config.toml"
                                              % (run["id"], exc)) from exc
            loc["basis"] = "previous run %s (%s)" % (run["id"], loc["basis"])
            return loc
        say("current run %s holds no checkout records; measuring the estate once (full census)" % run["id"])
    else:
        say("no current run to locate kingdom-os from; measuring the estate once (full census)")
    data = census.run_census(cfg, None, "full", home=ctx.home, layer_dir=ctx.layer)
    return kingdom.locate(data["checkouts"])


def authority(ctx, cfg):
    """decisions.primary_ref() for the verbs that read KINGDOM outside a build: the ref an owner
    decision names as the taxonomy authority, else the config pin, else the worktree."""
    curated = model.load_curated(ctx.layer)
    return decisions.primary_ref(cfg, decisions.rules(curated.get("decisions")))


def authority_enums(ctx, cfg, foundation, verb):
    """The live CARD_ENUMS of the authority ref, refused (never copied, never guessed) when that
    ref could not be read."""
    ref = authority(ctx, cfg)["ref"]
    enums = (foundation["refs"].get(ref) or {}).get("card_enums")
    require(enums, "%s needs the live CARD_ENUMS of the kingdom-os %s ref, the taxonomy authority (%s)"
            % (verb, ref, foundation["kos_path"]))
    return ref, enums


# ── build ───────────────────────────────────────────────────────────────────────────────────

def check_link_slots(area):
    """Refuse before writing anything if a name the seal will link is something else."""
    problems = []
    for name in (CURRENT,) + tuple(STATIC_LINKS):
        path = os.path.join(area.root, name)
        if os.path.lexists(path) and not os.path.islink(path):
            problems.append("private %s exists and is not a symlink" % name)
    for name, target in safety.ROOT_LINKS.items():
        path = os.path.join(area.layer, name)
        if os.path.lexists(path) and (not os.path.islink(path) or os.readlink(path) != target):
            problems.append("layer %s exists and is not the link the tool creates" % name)
    if problems:
        raise GuardError("refusing to build: " + "; ".join(problems), problems)


def merge_gh_listing(srcs, cfg, allowed, now):
    """--forge: list each configured owner with gh (the only network access) and add the
    listing to the forge source as the newest one. Returns (summary, [(run relpath, raw)], reasons)."""
    if not allowed:
        return None, [], []
    owners = (cfg.get("forge") or {}).get("owners") or []
    result = sources.gh_listing(owners, allow_network=True)
    forge = srcs.get("forge") or {}
    srcs["forge"] = forge
    forge.setdefault("listings", [])
    forge.setdefault("repos", {})
    forge.setdefault("errors", [])
    raws, reasons = [], []
    summary = {"status": result.get("status"), "owners": {}}
    if not owners:
        reasons.append("--forge asked, but config [forge].owners is empty")
    for owner, item in sorted((result.get("owners") or {}).items()):
        summary["owners"][owner] = {k: item.get(k) for k in ("status", "count", "error")}
        if item.get("status") != "ok":
            reasons.append("forge listing of %s via gh: %s (%s)" % (owner, item.get("status"), item.get("error")))
            continue
        raw = item.get("raw") or b""
        try:
            listed = len(json.loads(raw.decode("utf-8")))
        except (UnicodeDecodeError, ValueError, TypeError):
            listed = item.get("count")
        rel = "forge/gh-%s.json" % owner
        index = len(forge["listings"])
        forge["listings"].append({"path": rel, "forge": "github", "owners": [owner], "count": item.get("count"),
                                  "unrecognised": max(0, (listed or 0) - (item.get("count") or 0)), "age_s": 0,
                                  "mtime": safety.iso(now), "sha256": hashlib.sha256(raw).hexdigest()})
        for row in item.get("repos") or []:
            # The live listing is the newest evidence, so it replaces the seeded rows.
            forge["repos"][row["id"]] = dict(row, listing=index)
        raws.append((rel, raw))
    if forge.get("status") in (None, "not-configured", "error") and raws:
        forge["status"] = "ok" if not forge["errors"] else "partial"
    return summary, raws, reasons


def validate_all(snapshot, props, vocab):
    """Spec 6.10 against vocab/records.toml: every record, every source entry and every proposal."""
    contract = vocab["records"]
    problems = list(model.validate(snapshot, contract, facets=vocab["facets"], proposals=props)["problems"])
    kinds = contract.get("kind") or {}
    sub = {"kind": {k: kinds[k] for k in ("source", "proposal") if k in kinds}, "enum": contract.get("enum") or {}}
    problems += model.validate([dict(e, kind="source") for e in (snapshot.get("sources") or {}).values()],
                               sub)["problems"]
    # The facet registry too: a proposal's sphere is a value of vocab/facets.toml [facet.sphere].
    problems += model.validate([dict(p, kind="proposal") for p in props], sub, facets=vocab["facets"])["problems"]
    return problems


def lock_reasons(lock_cmp):
    if lock_cmp["state"] == "mismatch":
        keys = ", ".join("%s %s" % (d.get("ref") or "-", d.get("key")) for d in lock_cmp["diffs"])
        return ["vocab_drift: kingdom-os foundation differs from vocab/kingdom.lock.toml (%s); live KINGDOM "
                "is used, review and run accept-vocab --write" % keys]
    if lock_cmp["state"] == "missing":
        return ["kingdom lock unreadable (%s); integrity unchecked until accept-vocab --write" % lock_cmp.get("read")]
    return []


def foundation_reasons(foundation):
    return ["foundation alert %s%s: %s" % (a["code"], " (%s)" % a["ref"] if a.get("ref") else "", a["message"])
            for a in foundation.get("alerts") or [] if a.get("code") in DEGRADING_ALERTS]


def tree_summary(tree_res, tree_check):
    if tree_res is None:
        return {"enabled": False}
    diff = tree_res["diff"]
    return {"enabled": True, "links": tree_res["links"], "refused": tree_res["refused"],
            "not_linked": tree_res["not_linked"],
            "diff": {"baseline": diff["baseline"], "added": diff["added"], "removed": diff["removed"],
                     "retargeted": diff["retargeted"], "refused": diff["refused"]},
            "check": {k: tree_check[k] if k in ("ok", "exit", "checked") else len(tree_check[k])
                      for k in ("ok", "exit", "checked", "broken", "mismatched", "missing", "extra",
                                "unverified", "errors")}}


def tree_check_reason(check):
    counts = ["%d %s" % (len(check[k]), k) for k in ("broken", "mismatched", "missing", "extra", "unverified",
                                                       "errors") if check[k]]
    return "tree self-check failed: " + ", ".join(counts)


README_TXT = "README.txt"
# What private/README.txt says. The build keeps it current, so the PERSISTENT list follows the files
# this version keeps in one copy (U10).
PRIVATE_README = """estate private area

Everything here is private to this machine and ignored by git twice. Directories are 0700 and
files 0600 unless noted. Only `estate/bin/estate` writes here, through its guarded writer, and a
build keeps this file current.

PERSISTENT (not regenerable; this machine holds the only copy)
  curated/                      0500 between writes; the KEEP-NOT-REGENERABLE marker lives here
  curated/survey-2026-10-17/    verbatim survey evidence of 2026-10-17: files 0400, dirs 0500,
                                SHA256SUMS. The committed curation can be rebuilt from it with
                                `estate/bin/estate import-survey --write`.
  curated/projects.toml         per-record private knowledge (hand-editable, 0600)
  curated/estate.toml           artifacts, devices, accounts, private rules (hand-editable, 0600)
  curated/decisions.toml        the owner's verbatim words behind owner decisions, and private
                                refinements of what they leave open (0600; written by
                                `estate decisions --words-from` and `--private-from`)
  curated/sphere.toml           local ids and the full evidence of every sphere row (0600;
                                written by `estate sphere --import`)
  curated/hygiene.json          the D8 hygiene plan with the owner's statuses (0400; changed only
                                by `estate hygiene --import` and `--set`)
  curated/*.bak-<time>          the previous copy each owner verb keeps (0400)
  config.toml                   owner-edited input locators and options (no secrets)

  There is no backup. `estate/bin/estate export-private --to ABS_PATH` writes a 0600 tar of
  curated/ and config.toml to a path outside business-ecosystem.

DISPOSABLE (regenerated by `estate/bin/estate build`)
  runs/<YYYYMMDDTHHMMSSZ-xxxx>/  one sealed run each; retention keeps the newest few
  current                       symlink to the last complete or degraded run
  ATLAS.html, ATLAS.md, tree    static symlinks through current/
  estate.lock                   present only while a build runs; a stale one is recovered
  README.txt.bak-<time>         an earlier text of this file (0400)

GUARDS (do not remove)
  .gitignore                    "*" (guard 2)
  DO-NOT-COMMIT                 the canary checked before every write
"""


def ensure_private_readme(area):
    """Keep private/README.txt as PRIVATE_README: created when absent; a different text is replaced
    atomically after it is kept as a new 0400 backup. Never followed through a link."""
    raw, why = safety.read_checked(area.path(README_TXT), 1 << 20)
    if raw is None and why != "missing":
        return "left as is (%s)" % why
    if raw is not None and raw.decode("utf-8", "replace") == PRIVATE_README:
        return "present"
    if raw is None:
        area.write(README_TXT, PRIVATE_README)
        return "created"
    area.write("%s.bak-%s" % (README_TXT, curate.backup_stamp()), raw, mode=0o400)
    area.replace(README_TXT, PRIVATE_README)
    return "updated"


def ensure_private_link(area, name, target):
    path = os.path.join(area.root, name)
    if os.path.islink(path) and os.readlink(path) == target:
        return "present"
    area.symlink(name, target)
    return "created"


def retain(area, keep, current_id):
    """Keep the newest `keep` runs plus current; delete older ones through the marker-gated
    remover. Returns {kept, removed[], refused[]}."""
    runs_root = os.path.join(area.root, RUNS)
    names = sorted(n for n in os.listdir(runs_root) if safety.RUN_ID.fullmatch(n))
    doomed = [n for n in names[:max(0, len(names) - keep)] if n != current_id]
    report = {"kept": [n for n in names if n not in doomed], "removed": [], "refused": []}
    for name in doomed:
        try:
            safety.remove_run_dir(os.path.join(runs_root, name), runs_root)
            report["removed"].append(name)
        except (GuardError, OSError) as exc:
            report["refused"].append({"run": name, "reason": str(exc)})
    return report


def write_failed_run(area, now, started, problems, reasons):
    run_id, rel, _run_dir = make_run_dir(area, now)
    doc = {"schema": RUN_SCHEMA, "run_id": run_id, "state": "failed", "exit": 1, "started_at": safety.iso(started),
           "finished_at": safety.iso(safety.utc_now()), "degraded_reasons": reasons,
           "validation": {"ok": False, "problems_n": len(problems), "problems": problems[:500]}}
    area.write("/".join((rel, RUN_FILE)), dumps(doc, 1) + "\n")
    return run_id


def cmd_build(ctx, args):
    require(not (args.full and args.reuse_census), "--full and --reuse-census exclude each other")
    ctx.area.preflight(ctx.host)
    cfg, cfg_note = load_config(ctx.area)
    check_link_slots(ctx.area)
    lock = safety.RunLock(ctx.private)
    lock.acquire()
    try:
        return build(ctx, args, cfg, cfg_note, lock)
    finally:
        lock.release()


def build(ctx, args, cfg, cfg_note, lock):
    started = safety.utc_now()
    reasons = [cfg_note] if cfg_note else []
    prev = previous_inputs(ctx.area)
    reasons += prev["problems"]
    mode = "reuse" if args.reuse_census else ("full" if args.full else "quick")
    require(mode != "reuse" or prev["census"] is not None, "--reuse-census needs a previous census; run build first")
    vocab = model.load_vocab(ctx.layer)
    curated = model.load_curated(ctx.layer)

    # 3-4: discover and measure; 2: the foundation, located among the measured checkouts.
    census_data = census.run_census(cfg, census_prev(prev, mode), mode, home=ctx.home, layer_dir=ctx.layer)
    loc = kingdom.locate(census_data["checkouts"], (cfg.get("kingdom") or {}).get("kingdom_os_override"))
    foundation = kingdom.read_foundation(loc, home=ctx.home)
    foundation["alerts"] = list(loc["alerts"]) + foundation["alerts"]

    # 5-8: KINGDOM ingest, the other sources, the join and classification.
    srcs = model.gather_sources(cfg, foundation["kos_path"], curated, ctx.home)
    now = safety.utc_now()
    forge_summary, forge_raws, forge_reasons = merge_gh_listing(srcs, cfg, args.forge, now)
    reasons += forge_reasons
    snapshot = model.build_records(census_data, foundation, srcs, curated, vocab, prev["snapshot"], cfg, now=now,
                                   home=ctx.home, repo_reader=model.read_canonical)

    # 9: proposals, against the integrity lock.
    lock_doc, lock_read = kingdom.read_lock(ctx.layer)
    lock_cmp = dict(kingdom.compare_lock(foundation, lock_doc), read=lock_read)
    blobs = proposals.read_blobs(foundation)
    props = proposals.propose(snapshot, foundation, prev["props"], curated.get("decisions"), blobs, lock_doc, now,
                              curated, vocab["facets"])

    # 10: validate; a run that fails its own contract never becomes current.
    problems = validate_all(snapshot, props, vocab)
    if problems:
        run_id = write_failed_run(ctx.area, now, started, problems, reasons)
        warn("build failed validation (%d problems); run %s is not current. First problems:" % (len(problems), run_id))
        for item in problems[:20]:
            warn("  %s %s: %s" % (item.get("id"), item.get("field"), item.get("problem")))
        return 1

    reasons += snapshot["degraded_reasons"] + lock_reasons(lock_cmp) + foundation_reasons(foundation)
    run_id, run_rel, run_dir = make_run_dir(ctx.area, now)

    # 12 before 11, so DRIFT can show what the tree gained and lost.
    tree_res, tree_check = None, None
    tree_enabled = not args.no_tree and (cfg.get("tree") or {}).get("enabled", True) is not False
    if tree_enabled:
        prev_manifest = tree.read_manifest(os.path.join(prev["dir"], tree.TREE))[0] if prev["dir"] else None
        tree_res = tree.build_tree(run_dir, snapshot, ctx.layer, prev_manifest, home=ctx.home)
        tree_check = tree.check_tree(tree_res["tree_dir"])
        if not tree_check["ok"]:
            reasons.append(tree_check_reason(tree_check))
    reasons = dedupe(reasons)
    state = "degraded" if reasons else "complete"
    code = 10 if reasons else 0
    run_meta = {"run_id": run_id, "mode": census_data["mode"], "state": state, "degraded_reasons": reasons,
                "lock": lock_cmp, "tree": tree_res, "mirror_drift": None, "first_run": prev["snapshot"] is None}
    files = render.render_all(run_dir, snapshot, props, run_meta, curated=curated, vocab=vocab,
                              portfolio=srcs.get("portfolio"), prev_props=prev["props"], layer_dir=ctx.layer,
                              home=ctx.home)

    # 13: seal.
    for rel, raw in forge_raws:
        ctx.area.write("/".join((run_rel, rel)), raw, parents=True)
    header = {k: snapshot.get(k) for k in ("schema", "observed_at", "ref", "layers", "enums", "live_values", "counts")}
    header.update(run_id=run_id, records=len(snapshot["records"]))
    ctx.area.write("/".join((run_rel, RECORDS_FILE)),
                   "".join(dumps(row) + "\n" for row in [header] + snapshot["records"]))
    ctx.area.write("/".join((run_rel, PROPOSALS_FILE)), "".join(dumps(p) + "\n" for p in props))
    ctx.area.write("/".join((run_rel, CENSUS_FILE)), dumps(census_data) + "\n")
    finished = safety.utc_now()
    run_doc = run_document(run_id, state, code, started, finished, args, census_data, snapshot, srcs, lock_cmp,
                           tree_res, tree_check, props, lock.recovered, forge_summary, prev, reasons, cfg_note)
    ctx.area.write("/".join((run_rel, RUN_FILE)), dumps(run_doc, 1) + "\n")
    sums = safety.write_sums(run_dir)
    ctx.area.symlink(CURRENT, run_rel)
    links = {name: ensure_private_link(ctx.area, name, target) for name, target in STATIC_LINKS.items()
             if name != "tree" or tree_res is not None}
    links[README_TXT] = ensure_private_readme(ctx.area)
    links["atlas.html (layer)"] = ctx.area.ensure_root_link("atlas.html")
    if tree_res is not None:
        links["tree (layer)"] = ctx.area.ensure_root_link("tree")
    else:
        # Without a tree in this run the tree links would dangle; they come back with the next tree.
        links["tree"] = ctx.area.remove_link("tree")
        links["tree (layer)"] = ctx.area.remove_root_link("tree")
    keep = (cfg.get("retention") or {}).get("runs", DEFAULT_RETENTION)
    kept = retain(ctx.area, keep, run_id)
    print_build_summary(ctx, run_doc, files, sums, links, kept)
    return code


def run_document(run_id, state, code, started, finished, args, census_data, snapshot, srcs, lock_cmp, tree_res,
                 tree_check, props, recovered, forge_summary, prev, reasons, cfg_note):
    """run.json (estate.run/1): everything a later check, quick build or reader needs to know about
    this run without re-measuring."""
    registry = srcs.get("registry") or {}
    kinds = {}
    for record in snapshot["records"]:
        kinds[record["kind"]] = kinds.get(record["kind"], 0) + 1
    meta = {k: v for k, v in census_data.items() if k not in ("checkouts", "artifacts")}
    meta["checkouts_n"] = len(census_data.get("checkouts") or [])
    foundation = dict(snapshot["foundation"])
    return {
        "schema": RUN_SCHEMA, "run_id": run_id, "state": state, "exit": code,
        "started_at": safety.iso(started), "finished_at": safety.iso(finished), "observed_at": snapshot["observed_at"],
        "mode": census_data["mode"], "mode_reason": census_data.get("mode_reason"),
        "options": {"full": args.full, "reuse_census": args.reuse_census, "forge": args.forge, "no_tree": args.no_tree},
        "config": cfg_note or "ok",
        "degraded_reasons": reasons,
        "sources": snapshot["sources"], "worst_source": snapshot["worst_source"], "counts": snapshot["counts"],
        "records_by_kind": dict(sorted(kinds.items())),
        "reconcile": snapshot["reconcile"], "foundation": foundation, "kingdom": snapshot.get("kingdom"),
        "lock_state": lock_cmp["state"], "lock": lock_cmp,
        "registry": {"status": registry.get("status"), "ids_n": len(registry.get("ids") or []),
                     "services_n": len(registry.get("services") or []), "errors": registry.get("errors") or [],
                     "copy": registry.get("copy")},
        "census": meta,
        "tree": tree_summary(tree_res, tree_check),
        "validation": {"ok": True, "problems_n": 0},
        "proposals": proposals.summary(props),
        "hygiene": (snapshot.get("hygiene") or {}).get("counts"),
        "lock_recovered": recovered,
        "forge_network": forge_summary,
        "previous": {"run_id": prev["run_id"], "problems": prev["problems"]},
        "problems": snapshot.get("problems") or [],
    }


def print_build_summary(ctx, run_doc, files, sums, links, kept):
    census_meta = run_doc["census"]
    cov = census_meta.get("coverage") or {}
    say("estate build: run %s · mode %s (%s) · state %s · exit %d" % (
        run_doc["run_id"], run_doc["mode"], run_doc.get("mode_reason"), run_doc["state"], run_doc["exit"]))
    say("  checkouts %s (expected %s = observed %s + errors %s) · records %s" % (
        census_meta.get("checkouts_n"), cov.get("expected"), cov.get("observed"), cov.get("errors"),
        ", ".join("%s %d" % kv for kv in run_doc["records_by_kind"].items())))
    say("  foundation: worktree %s, origin/main %s · lock %s · REGISTRY %d ids" % (
        (run_doc["foundation"]["refs"].get(kingdom.WORKTREE) or {}).get("status"),
        (run_doc["foundation"]["refs"].get(kingdom.ORIGIN_MAIN) or {}).get("status"),
        run_doc["lock_state"], run_doc["registry"]["ids_n"]))
    summary = run_doc["proposals"]
    say("  proposals: %d open (%d long open) · %s" % (summary["open"], summary["long_open"], ", ".join(
        "%s %d" % kv for kv in sorted(summary["by_owner"].items())) or "none"))
    plan = run_doc.get("hygiene") or {}
    if plan.get("status") == "ok":
        say("  hygiene plan: %d items · by status %s · signals %s" % (
            plan["items"], ", ".join("%s %d" % kv for kv in plan["by_status"].items()),
            ", ".join("%s %d" % kv for kv in plan["by_verdict"].items())))
    else:
        say("  hygiene plan: %s" % (plan.get("status") or "not joined"))
    tree_doc = run_doc["tree"]
    if tree_doc.get("enabled"):
        say("  tree: %d links, %d refused, self-check %s" % (tree_doc["links"], len(tree_doc["refused"]),
                                                             "ok" if tree_doc["check"]["ok"] else "FAILED"))
    else:
        say("  tree: not built in this run")
    if run_doc["lock_recovered"]:
        say("  recovered a stale run lock: %s" % dumps(run_doc["lock_recovered"]))
    say("  sealed %d files; links %s" % (sums, ", ".join("%s %s" % kv for kv in sorted(links.items()))))
    if kept["removed"] or kept["refused"]:
        say("  retention: removed %s; refused %s" % (", ".join(kept["removed"]) or "none",
                                                    "; ".join("%s (%s)" % (r["run"], r["reason"]) for r in kept["refused"])
                                                    or "none"))
    if run_doc["degraded_reasons"]:
        say("  degraded because:")
        for reason in run_doc["degraded_reasons"]:
            say("    - " + reason)
    say("  atlas: %s" % os.path.join(ctx.layer, "atlas.html"))
    say("  views: %s" % ", ".join(sorted(files)))


# ── check ───────────────────────────────────────────────────────────────────────────────────

def cmd_check(ctx, args):
    codes = []
    if not (args.commit_ready or args.vocab or args.tree or args.verify_harvest):
        codes.append(check_status(ctx))
    if args.commit_ready:
        codes.append(check_commit_ready(ctx))
    if args.vocab:
        codes.append(check_vocab(ctx))
    if args.tree:
        codes.append(check_tree(ctx))
    if args.verify_harvest:
        codes.append(check_verify_harvest(ctx))
    return worst_exit(codes)


def check_status(ctx):
    """The current run: its state, its SHA256SUMS, its age and the freshness of its required
    sources now (budgets keep running after the build), plus the private area's modes."""
    run_dir, why = current_run(ctx.area)
    if run_dir is None:
        say("check: %s" % why)
        return 10
    run = read_run(run_dir, ("run",))
    doc = run["run"] or {}
    failed = False
    warnings = []
    say("check: current run %s · state %s · observed %s · mode %s" % (
        run["id"], doc.get("state", "unknown"), doc.get("observed_at", "unknown"), doc.get("mode", "unknown")))
    if run["problems"]:
        say("  run.json unreadable: %s" % "; ".join(run["problems"]))
        failed = True
    if doc.get("state") != "complete":
        warnings.append("the run is %s" % doc.get("state", "of unknown state"))
        for reason in doc.get("degraded_reasons") or []:
            say("  degraded: %s" % reason)
    sums = safety.verify_sums(run_dir)
    if sums["ok"]:
        say("  SHA256SUMS OK")
    else:
        failed = True
        for rel in sums["modified"]:
            say("  modified since generation: %s" % rel)
        for rel in sums["missing"]:
            say("  missing since generation: %s" % rel)
        for rel in sums["unexpected"]:
            say("  added since generation: %s" % rel)
        for item in sums["errors"]:
            say("  SHA256SUMS error: %s" % item)
    now = safety.utc_now()
    observed = model.epoch(doc.get("observed_at"))
    if observed is None:
        warnings.append("observation time unknown")
    elif now.timestamp() - observed > STALE_AFTER_S:
        warnings.append("current run is older than 7 days (observed %s); the atlas is STALE" % doc.get("observed_at"))
    for sid, entry in sorted((doc.get("sources") or {}).items()):
        if not entry.get("required"):
            continue
        budget = entry.get("budget") or {}
        seen = model.epoch(entry.get("observed_at")) if isinstance(entry.get("observed_at"), str) else None
        if entry.get("freshness") in ("stale", "missing", "error"):
            warnings.append("required source %s was %s at build time" % (sid, entry["freshness"]))
        elif budget and seen is not None and model.freshness(int(now.timestamp() - seen), budget["fresh_s"],
                                                              budget["stale_s"]) == "stale":
            warnings.append("required source %s is stale now (observed %s)" % (sid, entry.get("observed_at")))
    mode = ctx.area.curated_mode()
    if mode != 0o500:
        warnings.append("private curated dir is %s, not 0500 between writes" % ("missing" if mode is None else "%o" % mode))
    try:
        plan_mode = stat.S_IMODE(os.lstat(ctx.area.path(hygiene.PRIVATE_FILE)).st_mode)
    except FileNotFoundError:
        plan_mode = None
    if plan_mode not in (None, hygiene.MODE):
        warnings.append("private %s is %o, not %o (only estate hygiene changes it)" % (
            hygiene.PRIVATE_FILE, plan_mode, hygiene.MODE))
    warnings += ["private area: %s" % p for p in ctx.area.dir_problems()]
    for name in STATIC_LINKS:
        path = os.path.join(ctx.private, name)
        if os.path.islink(path) and not os.path.exists(path):
            warnings.append("private %s link dangles" % name)
    for item in warnings:
        say("  warning: %s" % item)
    if os.path.lexists(os.path.join(ctx.private, safety.LOCK_NAME)):
        say("  note: a run lock is present (a build may be running)")
    code = 1 if failed else (10 if warnings else 0)
    say("  exit %d" % code)
    return code


def check_commit_ready(ctx):
    """The privacy lint over every committed file plus the host checks (spec 9.6), and the same
    preflight a build runs. Errors make the layer not ready (1); warnings only, 10."""
    findings = []
    try:
        ctx.area.preflight(ctx.host)
    except GuardError as exc:
        findings += [{"check": "host-state", "rule": "preflight", "path": ".", "line": None, "detail": reason,
                      "severity": "error"} for reason in exc.reasons]
    findings += curate.lint_committed(ctx.layer, ctx.host, forge_listings(ctx))
    errors = [f for f in findings if f["severity"] == "error"]
    warnings = [f for f in findings if f["severity"] == "warning"]
    notes = [f for f in findings if f["severity"] not in ("error", "warning")]
    say("check --commit-ready: %d errors, %d warnings" % (len(errors), len(warnings)))
    for item in errors + warnings + notes:
        where = item["path"] + (":%s" % item["line"] if item.get("line") else "")
        say("  %s %s/%s %s %s" % (item["severity"], item["check"], item["rule"], where, item.get("detail") or ""))
    if errors:
        say("  not ready to commit")
        return 1
    return 10 if warnings else 0


def forge_listings(ctx):
    """Every forge listing the publication guard may weigh (spec 9.6: the newest one decides): the
    ones config.toml names, dated by file mtime, and the live --forge listings of every retained
    run, dated by the run's own start (its id), so a later build without --forge cannot hide a newer
    observation that the host is public."""
    paths = list(curate.config_listings(ctx.layer))
    runs = ctx.area.path(RUNS)
    try:
        names = sorted(os.listdir(runs))
    except OSError:
        names = []
    for name in names:
        forge_dir = os.path.join(runs, name, "forge")
        try:
            started = dt.datetime.strptime(name[:16], "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.timezone.utc).timestamp()
        except ValueError:
            continue
        if os.path.isdir(forge_dir) and not os.path.islink(forge_dir) and not os.path.islink(os.path.join(runs, name)):
            paths += [(os.path.join(forge_dir, f), started) for f in sorted(os.listdir(forge_dir))
                      if f.startswith("gh-") and f.endswith(".json")]
    return paths


def raw_tags_of(curated):
    """{raw tag: [where]} for every private raw tag the tag map must cover (spec 5 closure)."""
    out = {}
    for pid, row in sorted(((curated.get("private") or {}).get("projects") or {}).items()):
        for raw in row.get("raw_tags") or []:
            out.setdefault(raw, []).append(pid)
    estate = (curated.get("private") or {}).get("estate") or {}
    for row in estate.get("group") or []:
        for raw in row.get("raw_tags") or []:
            out.setdefault(raw, []).append(row.get("id"))
    for row in estate.get("artifact") or []:
        for raw in row.get("suggested_tags") or []:
            out.setdefault(raw, []).append(row.get("id"))
    return out


def check_vocab(ctx):
    """Tag-map closure against vocab/facets.toml and the live CARD_ENUMS (spec 5): a broken row
    fails (1); a private raw tag without a row is reported as unmapped (10)."""
    cfg, _note = load_config(ctx.area)
    vocab = model.load_vocab(ctx.layer)
    curated = model.load_curated(ctx.layer)
    loc = locate_kingdom_os(ctx, cfg)
    foundation = kingdom.read_foundation(loc, home=ctx.home)
    ref, enums = authority_enums(ctx, cfg, foundation, "check --vocab")
    status = vocab["status"].get(model.TAG_MAP)
    problems = []
    rows = vocab.get("tag_map")
    if rows is None:
        problems.append("vocab/tag-map.tsv unusable: %s" % status)
        rows = []
    problems += curate.tag_map_problems(rows, enums)
    problems += model.vocab_target_problems(rows, vocab["facets"], enums)
    problems = dedupe(problems)
    known = {row[0] for row in rows}
    unmapped = {raw: where for raw, where in raw_tags_of(curated).items() if raw not in known}
    say("check --vocab: %d rows, %d closure problems, %d unmapped raw tags (kingdom-os at %s, enums of %s)" % (
        len(rows), len(problems), len(unmapped), foundation["kos_path"], ref))
    for item in problems:
        say("  problem: %s" % item)
    for raw, where in sorted(unmapped.items()):
        say("  unmapped: %s (%d records, e.g. %s); QUEUE.md lists those of present records" % (
            raw, len(where), where[0]))
    if problems:
        return 1
    return 10 if unmapped else 0


def check_tree(ctx):
    link = os.path.join(ctx.private, "tree")
    if not os.path.lexists(link):
        say("check --tree: no tree link (the tree is disabled or was never built)")
        return 10
    report = tree.check_tree(link)
    say("check --tree: %s · %d entries checked · %s" % (report["tree"], report["checked"], ", ".join(
        "%s %d" % (k, len(report[k])) for k in ("broken", "mismatched", "missing", "extra", "unverified", "errors"))))
    for key in ("broken", "mismatched", "missing", "extra", "unverified"):
        for item in report[key][:50]:
            say("  %s %s %s" % (key, item.get("path"), item.get("detail") or ""))
    for item in report["errors"]:
        say("  error %s" % item)
    return report["exit"]


# -- check --verify-harvest --

def harvest_numbers(verb, text):
    if verb == "validate":
        match = re.search(r"Card schema: (\d+) checked \S (\d+) invalid \S (\d+) issues", text)
        return {"checked": int(match.group(1)), "invalid": int(match.group(2)),
                "issues": int(match.group(3))} if match else None
    match = re.search(r"Conformance gaps \((\d+)/(\d+)\)", text)
    return {"gaps": int(match.group(1)), "repos": int(match.group(2))} if match else None


def mirror_numbers(run, ref=kingdom.WORKTREE):
    """What the mirror (this layer's harvest reading) says for the same counts, from the current
    run: the projects harvest sees on ref, plus that ref's roster rows with no checkout."""
    key = model.ref_key(ref)
    seen = [r for r in run["records"] or [] if r.get("kind") == "project" and r.get("presence", "present") == "present"
            and ((r.get("kingdom") or {}).get("harvest_view") or {}).get(key)]
    orphans = (((run["run"] or {}).get("kingdom") or {}).get("roster") or {}).get(ref, {}).get("orphans") or []
    cards = [((r.get("kingdom") or {}).get("card_by_ref") or {}).get(ref) for r in seen]
    cards = [c for c in cards if c]

    def conforms(record):
        c = (record.get("kingdom") or {}).get("conformance") or {}
        return bool(c.get("card") and c.get("claudeMd") and c.get("wake"))

    return {"validate": {"checked": len(cards), "invalid": sum(1 for c in cards if c.get("schema_ok") is False),
                         "issues": sum(len(c.get("diagnostics") or []) for c in cards)},
            "conformance": {"repos": len(seen) + len(orphans),
                            "gaps": sum(1 for r in seen if not conforms(r)) + len(orphans)}}


def run_harvest(bun, harvest_path, verb, cwd, home):
    env = {"HOME": home, "PATH": os.environ.get("PATH", "/usr/bin:/bin"), "LC_ALL": "C", "NO_COLOR": "1"}
    try:
        proc = subprocess.Popen([bun, harvest_path, verb], cwd=cwd, env=env, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True,
                                close_fds=True)
    except OSError as exc:
        return {"ok": False, "code": None, "out": "", "err": "spawn failed: %s" % exc.strerror}
    try:
        out, err = proc.communicate(timeout=HARVEST_TIMEOUT)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        proc.communicate()
        return {"ok": False, "code": None, "out": "", "err": "timeout after %ss" % HARVEST_TIMEOUT}
    return {"ok": True, "code": proc.returncode, "out": out.decode("utf-8", "replace"),
            "err": err.decode("utf-8", "replace")}


def plant_ref_harvest(ctx, foundation, ref, scratch, reviewed):
    """origin/main is never checked out: its harvest.ts and roster.conf blobs go into a private
    scratch root, laid out as harvest expects (it reads ../roster.conf beside bin/). Returns
    (harvest path, [planted files]). The blob written is checked against the reviewed sha first."""
    files = kingdom.read_ref_files(foundation["kos_path"], ref)
    require(hashlib.sha256(files[kingdom.HARVEST]).hexdigest() == reviewed,
            "the %s harvest.ts blob read now is not the reviewed one" % ref)
    planted = [ctx.area.write("/".join((scratch, "root", rel)), raw, parents=True) for rel, raw in sorted(files.items())]
    return os.path.join(ctx.area.path(scratch), "root", kingdom.HARVEST), planted


def clear_scratch(ctx, scratch, planted):
    """Remove the scratch dir of one verify run: the files it planted (regular files only), then
    its now empty directories. Returns what is left (anything harvest wrote is kept for inspection)."""
    root = ctx.area.path(scratch)
    for path in planted:
        info = os.lstat(path)
        if stat.S_ISREG(info.st_mode):
            os.unlink(path)
    left = []
    for base, dirs, files in os.walk(root, topdown=False, followlinks=False):
        left += [os.path.relpath(os.path.join(base, name), root) for name in files]
        left += [os.path.relpath(os.path.join(base, name), root) for name in dirs
                 if os.path.islink(os.path.join(base, name))]
        try:
            os.rmdir(base)  # deepest first, so a directory is empty once what it held is gone
        except OSError:
            if not files:
                left.append(os.path.relpath(base, root) + "/")
    return sorted(left)


def check_verify_harvest(ctx):
    """Run harvest's read-only verbs (validate, conformance) of the taxonomy authority's ref and
    compare their counts with the mirror. Only at the reviewed harvest.ts sha, never without a verb
    (the no-verb path rewrites graph.json and CATALOG.md), argv as a list, from an empty working
    directory. The worktree's harvest.ts runs where it is; origin/main's runs from a private scratch
    copy of its blobs, removed afterwards."""
    cfg, _note = load_config(ctx.area)
    loc = locate_kingdom_os(ctx, cfg)
    foundation = kingdom.read_foundation(loc, home=ctx.home)
    ref = authority(ctx, cfg)["ref"]
    lock_doc, _why = kingdom.read_lock(ctx.layer)
    allowed, reason = kingdom.verify_harvest_allowed(foundation, lock_doc, ref)
    require(allowed, "check --verify-harvest refused: %s" % reason)
    run = require_current(ctx, ("run", "records"))
    bun = shutil.which("bun", path=os.environ.get("PATH"))
    if bun is None:
        say("check --verify-harvest: bun not found on PATH")
        return 1
    ctx.area.preflight(ctx.host)
    scratch = ".verify-harvest-" + os.urandom(4).hex()
    cwd = ctx.area.mkdir(scratch + "/cwd")
    results, planted = {}, []
    try:
        if ref == kingdom.WORKTREE:
            harvest_path = os.path.join(foundation["kos_path"], kingdom.HARVEST)
        else:
            reviewed = ((lock_doc or {}).get("kingdom_os") or {}).get(kingdom.REVIEWED_KEY)
            harvest_path, planted = plant_ref_harvest(ctx, foundation, ref, scratch, reviewed)
        for verb in HARVEST_VERBS:
            results[verb] = run_harvest(bun, harvest_path, verb, cwd, ctx.home)
    finally:
        left = clear_scratch(ctx, scratch, planted)
    say("check --verify-harvest: %s (%s)" % (reason, foundation["kos_path"]))
    if left:
        say("  harvest wrote into its scratch directory (left for inspection): %s" % ", ".join(left))
        return 1
    mirror = mirror_numbers(run, ref)
    drift, code = [], 0
    for verb in HARVEST_VERBS:
        result = results[verb]
        if not result["ok"]:
            say("  %s: %s" % (verb, result["err"]))
            code = 1
            continue
        found = harvest_numbers(verb, result["out"])
        if found is None:
            drift.append("%s: output not comparable (exit %s): %s" % (verb, result["code"],
                                                                    result["out"].strip().splitlines()[:1]))
            continue
        for key, value in sorted(found.items()):
            mine = mirror[verb].get(key)
            say("  %s %s: harvest %s, mirror %s%s" % (verb, key, value, mine, "" if value == mine else "  (mirror-drift)"))
            if value != mine:
                drift.append("%s %s: harvest %s, mirror %s" % (verb, key, value, mine))
    for item in drift:
        say("  mirror-drift: %s" % item)
    if code:
        return code
    return 10 if drift else 0


# ── show, ls, proposals ─────────────────────────────────────────────────────────────────────

def present(records):
    return [r for r in records if r.get("presence", "present") == "present"]


def cmd_show(ctx, args):
    run = require_current(ctx, ("records", "props"))
    records = run["records"]
    by_id = {r["id"]: r for r in records}
    query = args.query
    record = by_id.get(query)
    if record is None:
        low = query.lower()
        exact = [r for r in records if query in (r.get("aliases") or []) or str(r.get("name") or "").lower() == low]
        if len(exact) == 1:
            record = exact[0]
        else:
            matches = exact or [r for r in records if low in r["id"].lower() or low in str(r.get("name") or "").lower()]
            if not matches:
                say("show: nothing matches %r in run %s" % (query, run["id"]))
                return 1
            say("show: %d records match %r%s:" % (len(matches), query, " (first 20)" if len(matches) > 20 else ""))
            for r in matches[:20]:
                say("  %-10s %s  %s" % (r["kind"], r["id"], r.get("name") or ""))
            return 0
    props = {p["id"]: p for p in run["props"] or []}
    related = {"record": record}
    if record["kind"] == "project":
        for key in ("checkouts", "surfaces", "schedulers"):
            related[key] = [by_id[i] for i in record.get(key) or [] if i in by_id]
        related["proposals"] = [props[i] for i in record.get("proposals") or [] if i in props]
    say(dumps(related, 2))
    return 0


def facet_filters(pairs):
    out = []
    for pair in pairs or []:
        name, sep, value = pair.partition("=")
        require(sep and name and value, "--facet needs name=value, got %r" % pair)
        require(name in model.NAVIGATION, "unknown facet %r (facets: %s)" % (name, ", ".join(model.NAVIGATION)))
        out.append((name, value))
    return out


SPHERE_KINDS = ("project", "zone", "surface")


def cmd_ls(ctx, args):
    run = require_current(ctx, ("records",))
    records = present(run["records"])
    filters = facet_filters(args.facet)
    # The sphere facet is also on zones and surfaces (D4 names Cloudflare domains as members), so
    # a sphere-only filter lists every kind that carries it, or the one --kind names.
    by_sphere = bool(filters) and {n for n, _ in filters} == {"sphere"}
    require(not (filters and args.kind and args.kind != "project" and not (by_sphere and args.kind in SPHERE_KINDS)),
            "--facet filters projects (sphere also zones and surfaces); drop --kind %s" % args.kind)
    if by_sphere:
        allowed = sphere.values(model.load_vocab(ctx.layer)["facets"])
        bad = [v for _, v in filters if v not in allowed]
        require(not bad, "--facet sphere=%s is not a sphere value (%s)" % (bad[0] if bad else "", ", ".join(allowed)))
    if not filters and not args.kind:
        index = model.facet_index(records)
        if args.json:
            say(dumps({name: {v: len(ids) for v, ids in values.items()} for name, values in index.items()}, 2))
            return 0
        say("facet values over %d present projects of run %s (a contested record counts under each candidate):"
            % (sum(1 for r in records if r["kind"] == "project"), run["id"]))
        for name in model.NAVIGATION:
            values = sorted(index[name].items(), key=lambda kv: (-len(kv[1]), kv[0]))
            say("  %s: %s" % (name, " · ".join("%s %d" % (v, len(ids)) for v, ids in values) or "none"))
        return 0
    if by_sphere:
        kinds = (args.kind,) if args.kind else SPHERE_KINDS
        rows = [r for r in records if r["kind"] in kinds
                and all(render.sphere_of(r).get("value") == value for _, value in filters)]
    elif filters:
        index = model.facet_index(records, tuple(sorted({n for n, _ in filters})))
        chosen = None
        for name, value in filters:
            ids = set(index[name].get(value) or [])
            chosen = ids if chosen is None else chosen & ids
        rows = [r for r in records if r["id"] in chosen]
    else:
        require(args.kind in model.RECORD_KINDS, "unknown kind %r" % args.kind)
        rows = [r for r in records if r["kind"] == args.kind]
    rows.sort(key=lambda r: (str(r.get("name") or r.get("fqdn") or r["id"]).lower(), r["id"]))
    listing = []
    for r in rows:
        contested = sorted(n for n, _ in filters if ((r.get("facets") or {}).get(n) or {}).get("status") == "contested")
        listing.append({"id": r["id"], "kind": r["kind"], "name": r.get("name") or r.get("fqdn"), "contested": contested})
    if args.json:
        say(dumps(listing, 2))
        return 0
    say("%d records" % len(listing))
    for item in listing:
        mark = " (contested: %s)" % ", ".join(item["contested"]) if item["contested"] else ""
        say("  %s  %s%s" % (item["id"], item["name"] or "", mark))
    return 0


def cmd_proposals(ctx, args):
    run = require_current(ctx, ("props",))
    props = run["props"]
    if args.decide is not None:
        return decide(ctx, args, props)
    require(args.outcome is None and args.reason is None and not args.write,
            "--as, --reason and --write go with --decide")
    rows = [p for p in props if (not args.rule or p.get("rule") == args.rule)
            and (not args.owner or (p.get("target") or {}).get("owner") == args.owner)]
    summary = proposals.summary(rows)
    say("proposals of run %s: %d shown, %d open (%d long open) · by status %s" % (
        run["id"], len(rows), summary["open"], summary["long_open"],
        ", ".join("%s %d" % kv for kv in sorted(summary["by_status"].items())) or "none"))
    for p in sorted(rows, key=lambda p: ((p.get("target") or {}).get("owner") or "", p["rule"], p.get("bulk_key") or "",
                                         p["id"])):
        bulk = " [%s ×%s]" % (p["bulk_key"], p.get("bulk_count")) if p.get("bulk_key") else ""
        say("  %s  %-22s %-10s %s%s  %s" % (p["id"], p["status"], (p.get("target") or {}).get("owner"), p["rule"],
                                           bulk, p.get("title") or ""))
    return 0


def decide(ctx, args, props):
    """Append one [[decision]] to curated/decisions.toml (spec 10 lifecycle): printed as a diff,
    written only with --write. A key is a proposal id of the current run or one of its bulk keys."""
    require(args.outcome in OUTCOMES, "--decide needs --as %s" % "|".join(OUTCOMES))
    require(isinstance(args.reason, str) and args.reason.strip(), "--decide needs a non-empty --reason")
    key = args.decide
    field = "proposal" if any(p["id"] == key for p in props) else (
        "bulk_key" if any(p.get("bulk_key") == key for p in props) else None)
    require(field is not None, "no proposal id or bulk key %r in the current run" % key)
    path = os.path.join(ctx.layer, model.DECISIONS)
    raw, why = safety.read_checked(path, 4 << 20)
    require(raw is not None or why == "missing", "curated/decisions.toml unreadable: %s" % why)
    old = raw.decode("utf-8") if raw is not None else ""
    try:
        existing = tomllib.loads(old).get("decision") or []
    except tomllib.TOMLDecodeError as exc:
        raise GuardError("curated/decisions.toml is not valid TOML: %s" % exc)
    today = safety.utc_now().date()
    stem = "dec-%s-" % today.isoformat()
    taken = [int(d["id"][len(stem):]) for d in existing if str(d.get("id", "")).startswith(stem)
             and d["id"][len(stem):].isdigit()]
    ident = stem + str(max(taken, default=0) + 1)
    entry = {"id": ident, "date": today, "kind": "proposal", field: key, "outcome": args.outcome,
             "reason": args.reason.strip(), "by": "owner (estate proposals --decide)"}
    block = safety.toml_dumps({"decision": [entry]})
    findings = curate.lint_text(block, model.DECISIONS, "strict")
    require(not findings, "the decision text would fail the privacy lint: %s" % ", ".join(
        "%s (%s)" % (f["rule"], f["detail"]) for f in findings))
    new = (old.rstrip("\n") + "\n\n" + block) if old.strip() else block
    parsed = tomllib.loads(new).get("decision") or []
    require(parsed and parsed[-1].get("id") == ident, "decision did not round-trip through tomllib")
    result = safety.write_committed(model.DECISIONS, new, "proposals --decide", args.write, ctx.layer)
    say("decision %s: %s %s %s (%s)" % (ident, field, key, args.outcome,
                                        "written" if result["written"] else "not written; add --write"))
    return 0


# ── owner verbs ─────────────────────────────────────────────────────────────────────────────

def cmd_import_survey(ctx, args):
    # Card hints and the topic exclusion are checked against the live vocabulary, never a copy.
    cfg, _note = load_config(ctx.area)
    loc = locate_kingdom_os(ctx, cfg)
    foundation = kingdom.read_foundation(loc, home=ctx.home)
    _ref, enums = authority_enums(ctx, cfg, foundation, "import-survey")

    def step(ctx, args, write):
        return curate.import_survey(write=write, layer_dir=ctx.layer, host=ctx.host if write else None,
                                    overwrite=args.overwrite, home=ctx.home, card_enums=enums)
    report = _locked(ctx, args.write, step, args)
    for side in ("committed", "private"):
        counts = {}
        for item in report[side]:
            counts[item["status"]] = counts.get(item["status"], 0) + 1
        say("import-survey %s files: %s" % (side, ", ".join("%s %d" % kv for kv in sorted(counts.items())) or "none"))
    empty = report["queue"].get("owner_tables_empty") or []
    if empty:
        say("private curation tables with no rows yet (the owner fills them in): %s" % ", ".join(empty))
    if not args.write:
        say("nothing written; add --write (existing files are kept unless --overwrite; a replaced private "
            "file is backed up first, and config.toml is never replaced)")
    return 0


def cmd_accept_vocab(ctx, args):
    cfg, _note = load_config(ctx.area)
    loc = locate_kingdom_os(ctx, cfg)
    foundation = kingdom.read_foundation(loc, home=ctx.home)
    old, why = kingdom.read_lock(ctx.layer)
    before = kingdom.compare_lock(foundation, old)
    say("accept-vocab: kingdom-os at %s (%s); the lock is %s%s" % (
        foundation["kos_path"], loc["basis"], before["state"], "" if why in (None, "missing") else " (%s)" % why))
    for item in before["diffs"]:
        say("  %s %s: lock %s, live %s" % (item.get("ref") or "-", item["key"], item.get("lock"), item.get("live")))
    for alert in foundation["alerts"]:
        say("  foundation alert %s: %s" % (alert["code"], alert["message"]))
    reviewed = args.reviewed_harvest
    if reviewed is not None:
        # Recording a hand review is deliberate, and only of the harvest.ts that verify-harvest runs.
        ref = authority(ctx, cfg)["ref"]
        live = (foundation["refs"].get(ref) or {}).get("harvest_blob_sha256")
        require(reviewed == live, "--reviewed-harvest must be the sha256 of the %s harvest.ts (the taxonomy "
                                  "authority's), which is %s" % (ref, live))
        say("  recording %s harvest.ts %s as reviewed (its validate and conformance verbs read only)" % (ref, reviewed))
    lock = kingdom.make_lock(foundation, reviewed_harvest_sha256=reviewed, previous=old)
    result = safety.write_committed(kingdom.LOCK_RELPATH, kingdom.lock_text(lock), "accept-vocab", args.write, ctx.layer)
    if result["changed"] and not result["written"]:
        say("nothing written; add --write after reviewing the diff")
    return 0


def cmd_decisions(ctx, args):
    """The owner decisions: what each resolves and how a build applies it. --sync-config aligns
    private config.toml [kingdom].ref with the taxonomy authority decision; --words-from keeps the
    owner's verbatim words for decisions in the private curation. Both print what changes and
    write only with --write; a replaced private file is first kept as a new 0400 backup."""
    cfg, _note = load_config(ctx.area)
    curated = model.load_curated(ctx.layer)
    info = decisions.primary_ref(cfg, decisions.rules(curated.get("decisions")))
    require(sum(1 for flag in (args.sync_config, args.words_from, args.private_from) if flag) <= 1,
            "--sync-config, --words-from and --private-from exclude each other")
    if args.sync_config:
        return _locked(ctx, args.write, lambda c, a, write: sync_config(c, a, info, write), args)
    if args.words_from:
        return _locked(ctx, args.write, keep_words, args)
    if args.private_from:
        require(not args.for_ids, "--for goes with --words-from; a --private-from file names its decisions")
        return _locked(ctx, args.write, keep_private_texts, args)
    require(not args.write and not args.for_ids, "--write and --for go with --sync-config, --words-from or "
                                                 "--private-from")
    owner = curated.get("owner_decisions") or []
    items = {i.get("id"): i for i in (curated.get("questions") or []) + (curated.get("disputes") or [])
             + list(((curated.get("private") or {}).get("estate") or {}).get("question") or [])}
    say("owner decisions in %s: %d" % (model.DECISIONS, len(owner)))
    for d in owner:
        applied, pending = decisions.effect_keys(d)
        say("  %s%s %s by %s: %s" % (d["id"], " (%s)" % d["label"] if d.get("label") else "", d.get("date"),
                                     d.get("by"), d.get("subject")))
        if d.get("resolves"):
            say("    resolves %s" % ", ".join("%s [%s]" % (rid, (items.get(rid) or {}).get("status", "unknown id"))
                                           for rid in d["resolves"]))
        say("    effects applied: %s%s" % (", ".join(applied) or "none",
                                         "; not applied by this version: " + ", ".join(pending) if pending else ""))
        for item in d.get("pending") or []:
            say("    not yet applied: %s" % item)
        for rid, remainder in sorted((d.get("open") or {}).items()):
            say("    still open in %s: %s" % (rid, remainder))
    say("primary ref: %s (%s%s)%s" % (info["ref"], info["basis"], " " + info["decision"] if info["decision"] else "",
                                      "; " + decisions.conflict_reason(info) if info["conflict"] else ""))
    problems = [p for p in curated.get("problems") or [] if p.startswith("owner decision")]
    for item in problems:
        say("  problem: %s" % item)
    return 1 if problems else 0


def sync_config(ctx, args, info, write):
    require(info["basis"] == "decision", "no owner decision names the taxonomy authority; nothing to sync")
    raw, reason = safety.read_checked(ctx.area.path(CONFIG), 1 << 20)
    require(raw is not None or reason == "missing", "private config.toml unreadable: %s" % reason)
    old = raw.decode("utf-8") if raw is not None else ""
    new = decisions.config_with_ref(old, info["ref"])
    try:
        parsed = tomllib.loads(new)
    except tomllib.TOMLDecodeError as exc:
        raise GuardError("cannot set [kingdom].ref in config.toml automatically (%s); edit it by hand" % exc)
    require((parsed.get("kingdom") or {}).get("ref") == info["ref"] and not config_problems(parsed),
            "config.toml edit did not set [kingdom].ref cleanly")
    if new == old:
        say("decisions --sync-config: config.toml already reads [kingdom].ref = %s" % info["ref"])
        return 0
    say("decisions --sync-config: private config.toml [kingdom].ref %s -> %s (owner decision %s); other lines kept"
        % (info.get("config_ref") or "(unset)", info["ref"], info["decision"]))
    if not write:
        say("nothing written; add --write")
        return 0
    if raw is not None:  # read inside the lock (_locked), so this is the file being replaced
        backup = "%s.bak-%s" % (CONFIG, curate.backup_stamp())
        ctx.area.write(backup, raw, mode=0o400)
        say("  previous copy kept as private/%s (0400)" % backup)
    ctx.area.replace(CONFIG, new)
    say("  written")
    return 0


WORDS_HEADER = ("# The owner's own words behind owner decisions, kept verbatim, and private refinements of what\n"
                "# they leave open (private; one copy only). Written by `estate decisions --words-from PATH --for\n"
                "# ID[,ID...] --write` and `estate decisions --private-from PATH --write`.\n\n")
PRIVATE_DECISION_TABLES = ("words", "open", "note")


def _private_decisions_text(doc):
    """private/curated/decisions.toml with every table it holds, in one order; nothing is dropped."""
    tables = {k: doc[k] for k in PRIVATE_DECISION_TABLES if doc.get(k)}
    tables.update({k: v for k, v in sorted(doc.items()) if k not in PRIVATE_DECISION_TABLES})
    text = WORDS_HEADER + safety.toml_dumps(tables)
    require(tomllib.loads(text) == tables, "the private decisions file does not round-trip through TOML")
    return text


def _write_private_decisions(ctx, doc, write, what):
    say(what)
    if not write:
        say("nothing written; add --write")
        return 0
    result = curate.keep_private(ctx.area, "curated/decisions.toml", _private_decisions_text(doc))
    say("  %s%s" % (result["status"], "; " + result["change"] if result.get("change") else ""))
    return 0


def keep_private_texts(ctx, args, write):
    """Merge a TOML file of [[open]] {decision, question, text} and [[note]] {decision, text} rows
    into private/curated/decisions.toml: an open text refines a remainder the committed decision
    leaves open (the committed words stay neutral), a note says what the committed file only points
    at. Rows are keyed (decision and question; decision and text), so a re-run changes nothing."""
    require(os.path.isabs(args.private_from), "--private-from needs an absolute path")
    raw, reason = safety.read_checked(args.private_from, 64 << 10)
    require(raw is not None, "cannot read %s: %s" % (args.private_from, reason))
    try:
        given = tomllib.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        raise GuardError("%s is not TOML: %s" % (args.private_from, exc)) from exc
    require(set(given) <= {"open", "note"}, "%s may hold only [[open]] and [[note]] rows" % args.private_from)
    curated = model.load_curated(ctx.layer)  # read inside the lock when writing (_locked)
    owner = {d["id"]: d for d in curated.get("owner_decisions") or []}
    doc = dict(((curated.get("private") or {}).get("decisions")) or {})
    opens = {(r.get("decision"), r.get("question")): r for r in doc.get("open") or []}
    notes = {(r.get("decision"), r.get("text")): r for r in doc.get("note") or []}
    today = safety.utc_now().date().isoformat()
    for row in given.get("open") or []:
        did, qid, said = row.get("decision"), row.get("question"), str(row.get("text") or "").strip()
        require(did in owner and qid in ((owner[did].get("open") or {})), "[[open]] %s / %s: that owner decision "
                "leaves no committed remainder for that question" % (did, qid))
        require(said, "[[open]] %s / %s has no text" % (did, qid))
        opens[(did, qid)] = {"decision": did, "question": qid, "text": said, "date": today}
    for row in given.get("note") or []:
        did, said = row.get("decision"), str(row.get("text") or "").strip()
        require(did in owner and said, "[[note]] needs an owner decision id and text (got %r)" % did)
        notes.setdefault((did, said), {"decision": did, "text": said, "date": today})
    doc["open"] = [opens[k] for k in sorted(opens, key=str)]
    doc["note"] = [notes[k] for k in sorted(notes, key=str)]
    unchanged = doc == ((curated.get("private") or {}).get("decisions") or {})
    if unchanged:
        say("decisions --private-from: already kept")
        return 0
    return _write_private_decisions(ctx, doc, write, "decisions --private-from: private/curated/decisions.toml keeps "
                                    "%d open texts and %d notes (contents not shown)" % (len(doc["open"]), len(doc["note"])))


def keep_words(ctx, args, write):
    curated = model.load_curated(ctx.layer)  # read inside the lock when writing (_locked)
    ids = [i.strip() for i in (args.for_ids or "").split(",") if i.strip()]
    require(ids, "--words-from needs --for ID[,ID...]")
    known = {d["id"] for d in curated.get("owner_decisions") or []}
    unknown = [i for i in ids if i not in known]
    require(not unknown, "no owner decision %s in %s" % (", ".join(unknown), model.DECISIONS))
    require(os.path.isabs(args.words_from), "--words-from needs an absolute path")
    raw, reason = safety.read_checked(args.words_from, 64 << 10)
    require(raw is not None, "cannot read %s: %s" % (args.words_from, reason))
    try:
        said = raw.decode("utf-8").strip()
    except UnicodeDecodeError:
        raise GuardError("%s is not utf-8" % args.words_from)
    require(said, "%s is empty" % args.words_from)
    doc = dict(((curated.get("private") or {}).get("decisions")) or {})
    rows = list(doc.get("words") or [])
    if any(row.get("text") == said and row.get("decisions") == ids for row in rows):
        say("decisions --words-from: these words are already kept for %s" % ", ".join(ids))
        return 0
    rows.append({"decisions": ids, "date": safety.utc_now().date().isoformat(), "text": said,
                 "source": "the owner's message, verbatim"})
    doc["words"] = rows
    require((tomllib.loads(_private_decisions_text(doc)).get("words") or [])[-1].get("text") == said,
            "words did not round-trip through TOML")
    return _write_private_decisions(ctx, doc, write, "decisions --words-from: private/curated/decisions.toml gains the "
                                    "owner's words for %s (%d characters; not shown)" % (", ".join(ids), len(said)))


def cmd_sphere(ctx, args):
    """The sphere facet of owner decision D4: counts and the undecided list of the current run.
    --import writes a classification into the curation (sphere.py): committed files as a printed
    diff, the private file through keep_private; only with --write."""
    if args.import_path:
        return _locked(ctx, args.write, import_spheres, args)
    require(not args.write, "--write goes with --import")
    run = require_current(ctx, ("records",))
    records = present(run["records"])
    say("sphere facet of run %s (owner decision D4; undecided is listed for Yu):" % run["id"])
    for kind in ("project", "zone", "surface"):
        rows = [r for r in records if r["kind"] == kind]
        facets = [(r.get("facets") or {}).get("sphere") if kind == "project" else r.get("sphere") for r in rows]
        values = Counter((f or {}).get("value") or "none" for f in facets)
        bases = Counter((f or {}).get("basis") or "none" for f in facets)
        say("  %ss %d: %s · by basis %s" % (kind, len(rows), ", ".join("%s %d" % kv for kv in sorted(values.items())),
                                              ", ".join("%s %d" % kv for kv in sorted(bases.items()))))
    undecided = [r for r in records if r["kind"] == "project"
                 and ((r.get("facets") or {}).get("sphere") or {}).get("value") == sphere.UNDECIDED]
    say("undecided projects: %d" % len(undecided))
    for r in sorted(undecided, key=lambda r: (str(r.get("name") or r["id"]).lower(), r["id"])):
        facet = r["facets"]["sphere"]
        say("  %s  %s  [%s%s] %s" % (r["id"], ((r.get("facets") or {}).get("family") or {}).get("value") or "unassigned",
                                     facet.get("basis"), ", third-party" if facet.get("third_party") else "",
                                     render.clip(facet.get("reason"), 160)))
    others = sorted((r for r in records if r["kind"] in ("zone", "surface")
                     and (r.get("sphere") or {}).get("value") == sphere.UNDECIDED), key=lambda r: (r["kind"], r["id"]))
    say("undecided zones and surfaces: %d" % len(others))
    for r in others:
        say("  %s  [%s] %s" % (r["id"], r["sphere"].get("basis"), render.clip(r["sphere"].get("reason"), 160)))
    of = {kind: {r["id"]: r for r in records if r["kind"] == kind} for kind in SPHERE_KINDS}
    mismatches = sphere.follow_mismatches(of["zone"], of["surface"], of["project"])
    say("curated zone and surface rows that differ from their project (they stand until Yu reviews them): %d" % len(
        mismatches))
    for m in mismatches:
        say("  %s  %s, but %s is %s" % (m["id"], m["value"], m["project"], m["project_value"]))
    rows, _families, _problems = sphere.curated_index(model.load_curated(ctx.layer),
                                                      sphere.values(model.load_vocab(ctx.layer)["facets"]))
    known = {r["id"] for r in run["records"]} | {a for r in run["records"] for a in r.get("aliases") or []}
    unmatched = sorted(rid for rid in rows if rid not in known)
    say("curated sphere rows naming no record of this run: %d%s" % (len(unmatched), (": " + ", ".join(unmatched))
                                                                   if unmatched else ""))
    return 0


def import_spheres(ctx, args, write):
    data = sphere.read_classification(args.import_path)
    vocab = model.load_vocab(ctx.layer)
    curated = model.load_curated(ctx.layer)  # read inside the lock when writing (_locked)
    plan = sphere.plan_import(data, curated, sphere.values(vocab["facets"]), ctx.layer)
    say("sphere --import: %s" % ", ".join("%s %d" % kv for kv in sorted(plan["counts"].items())))
    for ident, why in plan["skipped"]:
        say("  skipped %s: %s" % (ident, why))
    results = [safety.write_committed(rel, text, "sphere --import", False, ctx.layer)
               for rel, text in sorted(plan["committed"].items())]
    say("private/%s: %d rows (contents not shown)" % (sphere.PRIVATE_FILE, plan["counts"]["private_rows"]))
    if not write:
        say("nothing written; add --write after reviewing the diff")
        return 0
    for result in results:
        if result["changed"]:
            safety.write_committed(result["path"], plan["committed"][result["path"]], "sphere --import", True,
                                   ctx.layer, quiet=True)
            say("  written %s" % result["path"])
    kept = curate.keep_private(ctx.area, sphere.PRIVATE_FILE, plan["private"])
    say("  private/%s: %s%s" % (sphere.PRIVATE_FILE, kept["status"], "; " + kept["change"] if kept.get("change") else ""))
    return 0


def cmd_hygiene(ctx, args):
    """The hygiene plan of owner decision D8 (hygiene.py): its items joined with the current run,
    filtered by wave, severity, status or area. --import merges a plan into the private curation
    by item id; --set records the owner's status of one item. Both print what changes and write
    only with --write, keeping the previous file as a new 0400 backup."""
    require(not (args.import_path and args.set_id), "--import and --set exclude each other")
    filters = args.wave or args.severity or args.area or args.needs_yu or args.agent_safe
    if args.import_path:
        require(not filters and args.status is None and args.note is None,
                "--wave, --severity, --status, --area, --needs-yu, --agent-safe and --note do not go with --import")
        return _locked(ctx, args.write, import_hygiene, args)
    if args.set_id:
        require(args.status is not None, "--set needs --status %s" % "|".join(hygiene.SET_STATUSES))
        require(not filters, "--wave, --severity, --area, --needs-yu and --agent-safe filter the listing; they do "
                             "not go with --set")
        return _locked(ctx, args.write, set_hygiene, args)
    require(not args.write and args.note is None, "--write and --note go with --import or --set")
    return list_hygiene(ctx, args)


def _locked(ctx, write, step, args):
    """step(ctx, args, write) under the preflight and the run lock when it writes, so the private
    file is read and replaced by one writer at a time."""
    if not write:
        return step(ctx, args, False)
    ctx.area.preflight(ctx.host)
    with safety.RunLock(ctx.private):
        return step(ctx, args, True)


def hygiene_run(ctx):
    """(records of the current run or None, {id, observed_at, why})."""
    run_dir, why = current_run(ctx.area)
    if run_dir is None:
        return None, {"id": None, "observed_at": None, "why": why}
    run = read_run(run_dir, ("records",))
    if run["problems"]:
        return None, {"id": run["id"], "observed_at": None, "why": "; ".join(run["problems"])}
    return run["records"], {"id": run["id"], "observed_at": (run["header"] or {}).get("observed_at"), "why": None}


def hygiene_file(ctx, verb):
    doc, reason = hygiene.load(ctx.area.path(hygiene.PRIVATE_FILE))
    require(doc is not None or reason == "missing", "private/%s is not usable (%s); restore its newest backup "
                                                    "beside it before %s" % (hygiene.PRIVATE_FILE, reason, verb))
    return doc


def keep_hygiene(ctx, doc):
    result = curate.keep_private(ctx.area, hygiene.PRIVATE_FILE, hygiene.text_of(doc), mode=hygiene.MODE)
    say("  private/%s: %s%s" % (hygiene.PRIVATE_FILE, result["status"], "; " + result["change"] if result.get("change") else ""))


def list_hygiene(ctx, args):
    doc = hygiene_file(ctx, "listing")
    if doc is None:
        say("hygiene: no plan in private/%s; import one with estate hygiene --import ABS_PATH --write"
            % hygiene.PRIVATE_FILE)
        return 0
    allowed = hygiene.filter_values(doc)
    for name in ("wave", "severity", "area", "status"):
        wanted = getattr(args, name)
        require(wanted is None or wanted.lower() in {v.lower() for v in allowed[name]},
                "--%s filters by one of %s (case does not matter)" % (name, ", ".join(allowed[name]) or "none"))
    records, run = hygiene_run(ctx)
    view = hygiene.join(doc, None, records, None, run["id"], refs=hygiene.reference_status(model.load_curated(ctx.layer)))
    counts = view["counts"]
    say("hygiene plan (private/%s): %d items, %d missing from the newest plan · plan observed %s · %s" % (
        hygiene.PRIVATE_FILE, counts["items"], counts["missing"], counts["observed_at"],
        "joined with run %s" % run["id"] if records is not None else "not joined (%s)" % run["why"]))
    say("  by status %s · signals %s" % (", ".join("%s %d" % kv for kv in counts["by_status"].items()),
                                         ", ".join("%s %d" % kv for kv in counts["by_verdict"].items())))
    rows = hygiene.filtered(view["items"], args.wave, args.severity, args.status, args.area,
                            True if args.needs_yu else None, True if args.agent_safe else None)
    say("  who acts: %s" % " · ".join("%s %d" % (label, len(group)) for label, group in hygiene.owner_split(view["items"])))
    if len(rows) != len(view["items"]):
        say("  %d shown (filters: %s)" % (len(rows), ", ".join("%s=%s" % (k, v) for k, v in (
            ("wave", args.wave), ("severity", args.severity), ("status", args.status), ("area", args.area),
            ("needs-yu", args.needs_yu or None), ("agent-safe", args.agent_safe or None)) if v)))
    for item in rows:
        plan = item["plan"]
        say("  %-3s %-29s %-10s %-10s %s  [%s]%s  %s" % (
            plan.get("severity"), item["status"] + (" (owner)" if item["status_basis"] == "owner" else ""),
            plan.get("wave"), plan.get("area"), item["id"], item["join"]["verdict"] or "not joined",
            " (missing since %s)" % item["missing_since"] if item.get("missing_since") else "",
            render.clip(plan.get("title"), 110)))
    return 0


def import_hygiene(ctx, args, write):
    plan, sha = hygiene.read_plan(args.import_path)
    old = hygiene_file(ctx, "an import")
    records, run = hygiene_run(ctx)
    by_id = {r["id"]: r for r in records or [] if r.get("id")}
    new, counts, notes = hygiene.merge(plan, old, by_id, run, sha, safety.iso(safety.utc_now()))
    say("hygiene --import: %s observed %s · %s" % (plan["schema"], plan["observed_at"], ", ".join(
        "%s %d" % kv for kv in sorted(counts.items()))))
    say("  baseline: %s" % ("the signals of run %s (observed %s)" % (run["id"], run["observed_at"]) if records is not None
                            else "none (%s); build, then import again to capture one" % run["why"]))
    for note in notes:
        say("  note: %s" % note)
    if new is old:
        say("  private/%s: unchanged" % hygiene.PRIVATE_FILE)
        return 0
    say("  private/%s: %s (%d bytes, contents not shown)" % (
        hygiene.PRIVATE_FILE, "replace" if old is not None else "create", len(hygiene.text_of(new).encode("utf-8"))))
    if not write:
        say("nothing written; add --write (the previous file is kept as a 0400 backup)")
        return 0
    keep_hygiene(ctx, new)
    return 0


def set_hygiene(ctx, args, write):
    doc = hygiene_file(ctx, "--set")
    require(doc is not None, "no plan in private/%s; import one first" % hygiene.PRIVATE_FILE)
    note = args.note.strip() if args.note is not None else None
    require(note is None or note, "--note needs text")
    new, before, after = hygiene.set_status(doc, args.set_id, args.status, note, safety.iso(safety.utc_now()))
    if after is before:
        say("hygiene --set: %s is already %s by the owner; nothing to change" % (args.set_id, args.status))
        return 0
    sys.stdout.write(hygiene.status_diff(before, after))
    say("hygiene --set: %s %s -> %s (%s)" % (args.set_id, hygiene.effective(before)[0], args.status,
                                            "writing" if write else "not written; add --write"))
    if write:
        keep_hygiene(ctx, new)
    return 0


def cmd_export_private(ctx, args):
    """A 0600 tar of private/curated and private/config.toml, the only copy otherwise (spec 9.12).
    The target is a new file (O_EXCL, no-follow) outside business-ecosystem."""
    target = args.to
    require(os.path.isabs(target) and os.path.normpath(target) == target, "--to needs an absolute, normalized path")
    parent, name = os.path.split(target)
    require(name not in ("", ".", ".."), "--to must name a file")
    parent_real = os.path.realpath(parent)
    require(os.path.isdir(parent_real), "the parent directory of --to does not exist: %s" % parent)
    for guarded in (os.path.realpath(ctx.host), ctx.layer):
        require(not within(parent_real, guarded), "refusing a target inside %s" % guarded)
    path = os.path.join(parent_real, name)
    for repo in enclosing_repos(parent_real):
        require_ignored_by(repo, path)
    require(not os.path.lexists(path), "refusing to overwrite %s" % path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
    members = []
    try:
        with os.fdopen(fd, "wb") as stream:
            os.fchmod(stream.fileno(), 0o600)
            with tarfile.open(fileobj=stream, mode="w", format=tarfile.PAX_FORMAT) as tar:
                add_tree(tar, ctx.area.path("curated"), "curated", members)
                config = ctx.area.path(CONFIG)
                if os.path.lexists(config):
                    add_entry(tar, config, CONFIG, members)
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        os.unlink(path)
        raise
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            digest.update(chunk)
    say("export-private: %s · %d entries · %d bytes · sha256 %s" % (path, len(members), os.lstat(path).st_size,
                                                                     digest.hexdigest()))
    return 0


def enclosing_repos(directory):
    """Every ancestor of directory (itself included) that holds a .git entry, innermost first."""
    out, current = [], directory
    while True:
        if os.path.lexists(os.path.join(current, ".git")):
            out.append(current)
        parent = os.path.dirname(current)
        if parent == current:
            return out
        current = parent


def require_ignored_by(repo, path):
    """The private tar must never land where a later `git add` in another work tree would pick it
    up: refuse unless that repository's own ignore rules cover the target (the home repository,
    which ignores everything, passes; a project checkout does not)."""
    git = safety.GitRunner(repo, role="host")
    top = git.toplevel_check()
    require(top["ok"], "refusing a target inside %s: a git work tree whose rules could not be checked (%s)"
            % (repo, top["reason"]))
    res = git.run("check-ignore", "-q", "--", os.path.relpath(path, git.real))
    require(res.code == 0, "refusing a target inside the git work tree %s: git there does not ignore it "
            "(check-ignore exit %s); choose a directory outside every repository" % (repo, res.code))


def add_entry(tar, path, arcname, members):
    info = os.lstat(path)
    if stat.S_ISREG(info.st_mode):
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
        with os.fdopen(fd, "rb") as stream:
            tarinfo = tar.gettarinfo(arcname=arcname, fileobj=stream)
            tar.addfile(tarinfo, stream)
    elif stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
        tar.addfile(tar.gettarinfo(path, arcname))  # a link is stored as a link, never followed
    else:
        warn("export-private: skipped %s (not a file, directory or link)" % arcname)
        return
    members.append(arcname)


def add_tree(tar, root, arcname, members):
    add_entry(tar, root, arcname, members)
    with os.scandir(root) as entries:
        names = sorted((e.name, e.is_dir(follow_symlinks=False)) for e in entries)
    for name, is_dir in names:
        path, arc = os.path.join(root, name), arcname + "/" + name
        if is_dir:
            add_tree(tar, path, arc, members)
        else:
            add_entry(tar, path, arc, members)


def cmd_untree(ctx, args):
    ctx.area.preflight(ctx.host)
    with safety.RunLock(ctx.private):
        report = tree.untree(ctx.private, ctx.layer)
    say("untree: config %s · trees removed from %d runs · private tree link %s · layer tree link %s" % (
        report["config"], len(report["runs"]), report["private_link"], report["root_link"]))
    for item in report["refused"]:
        say("  refused %s: %s" % (item["run"], item["reason"]))
    return 0 if report["ok"] else 1


def cmd_help(ctx, args):
    args.parser.print_help(sys.stdout)
    return 0


# ── command line ────────────────────────────────────────────────────────────────────────────

def make_parser():
    parser = argparse.ArgumentParser(prog="estate", description=__doc__.split("\n\n")[0],
                                     formatter_class=argparse.RawDescriptionHelpFormatter,
                                     epilog="exit codes: 0 complete and fresh · 10 degraded (reasons listed; not a "
                                            "failure) · 1 failed · 2 usage or guard refusal")
    parser.add_argument("--version", action="version", version=VERSION)
    verbs = parser.add_subparsers(dest="verb", required=True, metavar="VERB")

    def verb(name, handler, text):
        sub = verbs.add_parser(name, help=text, description=text)
        sub.set_defaults(handler=handler)
        return sub

    sub = verb("build", cmd_build, "measure, join, render and seal a new run")
    sub.add_argument("--full", action="store_true", help="walk every root at unlimited depth")
    sub.add_argument("--reuse-census", action="store_true", help="reuse the previous census (its age is shown)")
    sub.add_argument("--forge", action="store_true", help="list forge repositories with gh (network)")
    sub.add_argument("--no-tree", action="store_true", help="skip the symlink tree in this run")
    sub = verb("check", cmd_check, "verify the current run (checksums, age, stale sources) or run one check")
    sub.add_argument("--commit-ready", action="store_true", help="privacy lint and host checks before a commit")
    sub.add_argument("--vocab", action="store_true", help="tag-map closure against facets.toml and live enums")
    sub.add_argument("--tree", action="store_true", help="compare the symlink tree with its manifest")
    sub.add_argument("--verify-harvest", action="store_true",
                     help="run harvest validate/conformance at the reviewed sha and compare with the mirror")
    sub = verb("show", cmd_show, "one record with its checkouts, surfaces and proposals")
    sub.add_argument("query", help="an id, alias or name; otherwise up to 20 substring matches")
    sub = verb("ls", cmd_ls, "facet value counts, or the records matching --facet filters")
    sub.add_argument("--facet", action="append", metavar="NAME=VALUE", help="repeatable; filters combine")
    sub.add_argument("--kind", help="records of one kind")
    sub.add_argument("--json", action="store_true")
    sub = verb("proposals", cmd_proposals, "the KINGDOM proposals queue, or record a decision")
    sub.add_argument("--rule", help="P01..P17")
    sub.add_argument("--owner", choices=OWNERS)
    sub.add_argument("--decide", metavar="ID", help="a proposal id or bulk key of the current run")
    sub.add_argument("--as", dest="outcome", choices=OUTCOMES)
    sub.add_argument("--reason", help="why (committed text: no paths or private detail)")
    sub.add_argument("--write", action="store_true", help="change curated/decisions.toml")
    sub = verb("import-survey", cmd_import_survey, "seed curation, tag map and private files from the survey copy")
    sub.add_argument("--write", action="store_true")
    sub.add_argument("--overwrite", action="store_true",
                     help="replace files that already exist (a private file is backed up first; config.toml never)")
    sub = verb("accept-vocab", cmd_accept_vocab, "move vocab/kingdom.lock.toml to the live KINGDOM foundation")
    sub.add_argument("--write", action="store_true")
    sub.add_argument("--reviewed-harvest", metavar="SHA256",
                     help="record the authority ref's harvest.ts (this sha) as reviewed by hand")
    sub = verb("decisions", cmd_decisions, "the owner decisions and how a build applies them")
    sub.add_argument("--sync-config", action="store_true",
                     help="set private config.toml [kingdom].ref to the taxonomy authority decision's ref")
    sub.add_argument("--words-from", metavar="ABS_PATH", help="keep the owner's verbatim words (a text file)")
    sub.add_argument("--for", dest="for_ids", metavar="ID[,ID...]", help="the decisions the words are for")
    sub.add_argument("--private-from", metavar="ABS_PATH",
                     help="keep private refinements: a TOML file of [[open]] {decision, question, text} and "
                          "[[note]] {decision, text} rows")
    sub.add_argument("--write", action="store_true")
    sub = verb("sphere", cmd_sphere, "the KINGDOM OS sphere facet: counts and the undecided list, or import a "
                                     "classification")
    sub.add_argument("--import", dest="import_path", metavar="ABS_PATH", help="a classification JSON (tool/sphere.py)")
    sub.add_argument("--write", action="store_true", help="change the curation and private/curated/sphere.toml")
    sub = verb("hygiene", cmd_hygiene, "the hygiene plan (owner decision D8) joined with the current run, or "
                                       "import a plan or set an item's status")
    sub.add_argument("--wave", help="list one wave (as the plan names it)")
    sub.add_argument("--severity", help="list one severity (P0..P3)")
    sub.add_argument("--status", help="list one status; with --set, the new status (%s)" % "|".join(hygiene.SET_STATUSES))
    sub.add_argument("--area", help="list one area")
    sub.add_argument("--needs-yu", action="store_true", help="list only items the plan marks as needing Yu")
    sub.add_argument("--agent-safe", action="store_true", help="list only items the plan marks as agent-safe")
    sub.add_argument("--import", dest="import_path", metavar="ABS_PATH", help="an estate.hygiene/1 plan, merged by item id")
    sub.add_argument("--set", dest="set_id", metavar="ID", help="an item id: record the owner's --status")
    sub.add_argument("--note", help="with --set: what was done (private; never a secret value)")
    sub.add_argument("--write", action="store_true",
                     help="change private/curated/hygiene.json (the previous file is kept as a 0400 backup)")
    sub = verb("export-private", cmd_export_private, "write a 0600 tar of the private curation (the only backup)")
    sub.add_argument("--to", required=True, metavar="ABS_PATH", help="a new file outside business-ecosystem")
    verb("untree", cmd_untree, "remove the symlink tree from every run and stop building it")
    sub = verb("help", cmd_help, "this help")
    sub.set_defaults(parser=parser)
    return parser


def main(argv=None, layer_dir=None):
    parser = make_parser()
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:  # argparse: --help/--version exit 0, usage errors 2
        return exc.code if isinstance(exc.code, int) else 2
    old_umask = os.umask(0o077)
    try:
        ctx = Ctx(layer_dir)
        return args.handler(ctx, args)
    except GuardError as exc:  # GitRefused and LockHeld included
        warn("refused: %s" % exc)
        return 2
    except safety.EstateError as exc:  # FoundationError, ModelError
        warn("failed: %s" % exc)
        return 1
    except OSError as exc:
        warn("failed: %s%s" % (exc.strerror or exc, " (%s)" % exc.filename if exc.filename else ""))
        return 1
    finally:
        os.umask(old_umask)


if __name__ == "__main__":
    try:
        os.nice(10)
    except OSError:
        pass
    raise SystemExit(main())
