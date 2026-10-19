"""Side sources around the census: schedulers, deploy manifests, monorepo packages, portfolio-map/1,
the Cloudflare observer, forge listings, prior maps and artifact lstat.

Each reader returns a dict with a status and its own errors, so a failing source becomes
`unknown` plus a reason, never zero, clean or healthy. Secrets stay out by construction:
LaunchAgent EnvironmentVariables are dropped the moment a plist is parsed, crontab lines are
redacted before anything else looks at them, records are built from allowlisted keys only,
and artifacts are lstat'ed, never opened. Scheduler records carry `target_paths` for project
containment; those are in-memory join inputs and are never meant to be persisted as such.
"""
import datetime as dt
import errno
import glob
import hashlib
import json
import os
import plistlib
import re
import shutil
import signal
import stat
import subprocess
import tomllib

import safety
from safety import GitRunner, read_checked

TOOL_TIMEOUT = 20
GH_TIMEOUT = 120
MAX_SMALL = 1 << 20
MAX_WORKFLOW = 256 << 10
MAX_PORTFOLIO = 8 << 20
MAX_BIG = 16 << 20
PORTFOLIO_SCHEMA = "business-ecosystem.portfolio-map/1"
CF_SURFACES_SCHEMA = "kingdom.cloudflare-surfaces/1"
# cloudflare-inventory AUDIENCES, reused verbatim (spec section 3, surface.audience).
AUDIENCES = ("human", "agent", "mixed", "operator", "infrastructure", "unknown")
# Claim-only projection (spec section 4): REALM.md tiers are counted, never used as a facet.
REALM_TIERS = ("mind", "ledger", "guard", "market", "agent-fabric")
TCC_DIRS = ("Desktop", "Documents", "Downloads")
INTERPRETERS = {"sh", "bash", "zsh", "dash", "fish", "env", "python", "python3", "node", "bun", "bunx",
                "deno", "ruby", "perl", "osascript", "uv", "npx", "tsx"}
GH_FIELDS = "name,nameWithOwner,isPrivate,isArchived,isFork,pushedAt,description"


def _now():
    return safety.iso(safety.utc_now())


def _iso_mtime(seconds):
    return safety.iso(dt.datetime.fromtimestamp(seconds, dt.timezone.utc))


def _home(home):
    return os.environ.get("HOME", "") if home is None else home


def _basename(path):
    return os.path.basename(path.rstrip("/")) if isinstance(path, str) and path else None


def _is_interpreter(name):
    return name in INTERPRETERS or re.fullmatch(r"python3\.\d+", name or "") is not None


def _under_home_dirs(path, home, names):
    real_home = os.path.normpath(home)
    for name in names:
        base = os.path.join(real_home, name)
        if path == base or path.startswith(base + os.sep):
            return True
    return False


def tcc_exposed(paths, home=None):
    """True when any target sits under HOME's Desktop, Documents or Downloads, where TCC stops
    launchd and cron jobs from reading. False only says no visible target does; a wrapper
    script's own targets are not visible (see script_paths), and the model turns that into
    unknown."""
    home = _home(home)
    return any(_under_home_dirs(os.path.normpath(p), home, TCC_DIRS) for p in paths if os.path.isabs(p))


SCRIPT_SUFFIXES = (".sh", ".bash", ".zsh", ".py", ".js", ".mjs", ".cjs", ".ts", ".mts", ".rb", ".pl", ".command")


def script_paths(paths):
    """The absolute targets that are scripts (by suffix): a script may cd and read anywhere, so
    what it touches is unknown unless it sits inside a measured checkout."""
    return [os.path.normpath(p) for p in paths if os.path.isabs(p) and p.endswith(SCRIPT_SUFFIXES)]


def _lstat_summary(path):
    """{size, mtime} of a log path without opening it, or {state: missing|error}."""
    try:
        info = os.lstat(path)
    except FileNotFoundError:
        return {"state": "missing"}
    except OSError as exc:
        return {"state": "error:" + errno.errorcode.get(exc.errno, str(exc.errno))}
    return {"state": "present", "size": info.st_size, "mtime": _iso_mtime(info.st_mtime)}


def _run_tool(name, args, timeout=TOOL_TIMEOUT):
    """Run one allowlisted read-only tool (launchctl, crontab, gh) with argv, no shell, no
    stdin and a minimal environment; failures come back as a safety.Result, never raise."""
    program = shutil.which(name)
    if program is None:
        return safety.Result(False, "", "%s not found on PATH" % name, None, False, b"")
    env = {"HOME": os.environ.get("HOME", ""), "PATH": os.environ.get("PATH", "/usr/bin:/bin"), "LC_ALL": "C"}
    try:
        proc = subprocess.Popen([program, *args], stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, env=env, cwd="/", start_new_session=True, close_fds=True)
    except OSError as exc:
        return safety.Result(False, "", "spawn failed: %s" % (exc.strerror or exc), None, False, b"")
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            proc.kill()
        proc.communicate()
        return safety.Result(False, "", "timeout after %ss" % timeout, None, True, b"")
    return safety.Result(proc.returncode == 0, out.decode("utf-8", "surrogateescape"),
                         err.decode("utf-8", "replace")[:4096], proc.returncode, False, out)


def _tool_status(result):
    return "timeout" if result.timed_out else ("unavailable" if result.code is None else "error")


# ── launchd ─────────────────────────────────────────────────────────────────────────────────

_CALENDAR_KEYS = ("Minute", "Hour", "Day", "Weekday", "Month")


def _calendar(value):
    def one(item):
        return {k: item[k] for k in _CALENDAR_KEYS if isinstance(item, dict) and type(item.get(k)) is int}
    if isinstance(value, dict):
        return [one(value)]
    if isinstance(value, list):
        return [one(v) for v in value if isinstance(v, dict)]
    return None


def _launchd_job(file_name, data, home):
    label = data.get("Label") if isinstance(data.get("Label"), str) else None
    args = data.get("ProgramArguments")
    args = [a for a in args if isinstance(a, str)] if isinstance(args, list) else []
    program = data.get("Program") if isinstance(data.get("Program"), str) else (args[0] if args else None)
    program_base = _basename(program)
    # The script behind an interpreter is chosen the way a crontab line's is: `env NAME=value
    # python3 job.py` names job.py, never the assignment, which may carry a secret.
    script = _script_word(args[1:]) if _is_interpreter(program_base) else None
    working = data.get("WorkingDirectory") if isinstance(data.get("WorkingDirectory"), str) else None
    # The interpreter binary says nothing about which project a job serves; its script does.
    runner = None if _is_interpreter(program_base) else program
    targets = [p for p in (working, script, runner) if isinstance(p, str) and os.path.isabs(p)]
    keep_alive = data.get("KeepAlive")
    job = {
        "id": "sched:launchd:" + (label or file_name), "mechanism": "launchd", "label": label,
        "file": file_name,
        "schedule": {
            "start_interval": data["StartInterval"] if type(data.get("StartInterval")) is int else None,
            "start_calendar_interval": _calendar(data.get("StartCalendarInterval")),
            "keep_alive": keep_alive if type(keep_alive) is bool else ("conditional" if isinstance(keep_alive, dict) else None),
            "run_at_load": data["RunAtLoad"] if type(data.get("RunAtLoad")) is bool else None,
        },
        "disabled": data["Disabled"] if type(data.get("Disabled")) is bool else None,
        "program_basename": program_base,
        "script_basename": _basename(script),
        "log": {key: _lstat_summary(data[plist_key]) if isinstance(data.get(plist_key), str) else None
                for key, plist_key in (("stdout", "StandardOutPath"), ("stderr", "StandardErrorPath"))},
        "target_paths": targets,
        "script_paths": script_paths(targets),
        "tcc_exposed": tcc_exposed(targets, home),
        "errors": [] if label else ["plist has no Label"],
    }
    return job


def read_launchd(agents_dir=None, home=None):
    """LOCATORS launch_agents *.plist via plistlib (regular files, <= 1 MiB, no symlinks).
    EnvironmentVariables is discarded right after parsing and no other ProgramArguments than
    the basenames (and argv[1] behind an interpreter) are kept."""
    home = _home(home)
    directory = agents_dir or safety.expand_locator(safety.LOCATORS["launch_agents"], home)
    out = {"source": "launchd", "status": "ok", "jobs": [], "skipped": [], "errors": [], "observed_at": _now()}
    try:
        with os.scandir(directory) as entries:
            names = sorted(entry.name for entry in entries)
    except FileNotFoundError:
        out["status"] = "missing"
        return out
    except OSError as exc:
        out["status"] = "error"
        out["errors"].append({"file": None, "error": errno.errorcode.get(exc.errno, str(exc.errno))})
        return out
    for name in names:
        if not name.endswith(".plist"):
            out["skipped"].append({"file": name, "reason": "not a .plist (launchd does not load it)"})
            continue
        raw, reason = read_checked(os.path.join(directory, name), MAX_SMALL)
        if raw is None:
            out["errors"].append({"file": name, "error": reason})
            continue
        try:
            data = plistlib.loads(raw)
        except Exception as exc:  # a corrupt plist is an error entry, never a crashed build
            out["errors"].append({"file": name, "error": "unparseable plist: %s" % type(exc).__name__})
            continue
        if not isinstance(data, dict):
            out["errors"].append({"file": name, "error": "plist root is not a dictionary"})
            continue
        data.pop("EnvironmentVariables", None)
        out["jobs"].append(_launchd_job(name, data, home))
        del data
    if out["errors"]:
        out["status"] = "partial"
    return out


def read_launchctl():
    """`launchctl list`: {status, jobs{label: {pid, last_exit}}, errors}."""
    res = _run_tool("launchctl", ["list"])
    out = {"source": "launchctl", "status": "ok", "jobs": {}, "errors": [], "observed_at": _now()}
    if not res.ok:
        out["status"] = _tool_status(res)
        out["errors"].append(res.err.strip()[:300] or "exit %s" % res.code)
        return out
    for line in res.out.split("\n")[1:]:
        parts = line.split("\t")
        if len(parts) != 3 or not parts[2]:
            continue
        pid, status, label = parts
        out["jobs"][label] = {"pid": int(pid) if re.fullmatch(r"\d+", pid) else None,
                              "last_exit": int(status) if re.fullmatch(r"-?\d+", status) else None}
    return out


# ── crontab ─────────────────────────────────────────────────────────────────────────────────

_ASSIGN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*=")
_CRON_FIELD = re.compile(r"[0-9A-Za-z*/,\-]+")
_SEPARATOR = re.compile(r"\s*(?:&&|\|\||;|\|)\s*")
_SETUP_WORDS = {"cd", "export", "source", ".", "set", "umask", "ulimit", "sleep", "true"}
# Interpreter flags whose value is the next word (never a script), and flags whose value is
# inline code (so there is no script at all).
_VALUE_FLAGS = {"-W", "-X", "-r", "--require", "--inspect-port", "--env-file", "--loader", "--import", "--config",
                "--cwd", "--title"}
_INLINE_FLAGS = {"-c", "-e", "--eval", "-p", "--print"}


def _script_word(words):
    """The script an interpreter runs, from the words after it. NAME=value words, flags, the
    value of a flag that takes one (or of any flag named like a secret, --api-key K) and nested
    interpreters (env python3 job.py) are looked through; an inline-code flag means no script.
    A word that still holds '=' is never returned, so no assignment reaches a record."""
    skip = False
    for word in words:
        if skip:
            skip = False
            continue
        if _ASSIGN.match(word):
            continue
        if word.startswith("-"):
            flag = word.split("=", 1)[0]
            if flag in _INLINE_FLAGS:
                return None
            if "=" not in word and (flag in _VALUE_FLAGS or safety.SECRET_NAME.search(flag)):
                skip = True
            continue
        bare = word.strip("'\"")
        if "=" in bare or _is_interpreter(_basename(bare)):
            continue
        return bare
    return None


def _command_parts(command):
    """(executable basename, script basename) of the first real step of a (redacted) command:
    `cd DIR && NAME=v /path/node .../tsx job.ts` gives ('node', 'job.ts'). Runners such as tsx
    behind an interpreter are looked through; `-c` means an inline string, so no script."""
    for segment in _SEPARATOR.split(command):
        rest = segment.split()
        while rest and _ASSIGN.match(rest[0]):
            rest = rest[1:]
        if not rest or rest[0] in _SETUP_WORDS or rest[0].startswith(("<", ">", "2>")):
            continue
        exe = _basename(rest[0].strip("'\""))
        word = _script_word(rest[1:]) if _is_interpreter(exe) else None
        return exe, _basename(word) if word else None
    return None, None


_REDIRECT = re.compile(r"^(?:\d*>>?&?|<|&>>?)")
_HOME_REF = re.compile(r"^(?:\$HOME|\$\{HOME\}|~)(?=/|$)")


def _target_paths(tokens, home):
    """Absolute paths a (redacted) command names, $HOME and ~ expanded as text, redirect
    prefixes and NAME= prefixes removed, /dev/* and interpreter binaries skipped. Used only
    for containment."""
    paths = []
    for word in tokens:
        word = _REDIRECT.sub("", word.strip("'\";"))
        if _ASSIGN.match(word):
            word = word.split("=", 1)[1].strip("'\"")
        word = _HOME_REF.sub(lambda _: home, word)
        if (word.startswith("/") and not word.startswith("/dev/") and "<redacted>" not in word
                and not _is_interpreter(_basename(word))):
            paths.append(os.path.normpath(word))
    return paths


def parse_crontab(text, home=None):
    """Redact every line first (safety.redact_command), then keep only schedule fields, the
    executable and script basenames, and the id sha12(redacted line). Environment lines keep
    their name only. Nothing is executed or expanded."""
    home = _home(home)
    jobs, env, unparsed = [], [], []
    for number, line in enumerate(text.split("\n"), 1):
        redacted = safety.redact_command(line).strip()
        if not redacted or redacted.startswith("#"):
            continue
        tokens = redacted.split()
        if tokens[0].startswith("@"):
            schedule, command = tokens[0], tokens[1:]
        elif len(tokens) >= 6 and all(_CRON_FIELD.fullmatch(t) for t in tokens[:5]):
            schedule, command = " ".join(tokens[:5]), tokens[5:]
        elif _ASSIGN.match(redacted):
            env.append({"name": redacted.split("=", 1)[0], "line": number})
            continue
        else:
            unparsed.append({"id": "sched:cron:" + safety.sha12(redacted), "line": number})
            continue
        exe, script = _command_parts(" ".join(command))
        targets = _target_paths(command, home)
        jobs.append({"id": "sched:cron:" + safety.sha12(redacted), "mechanism": "cron",
                     "label": script or exe, "schedule": schedule, "program_basename": exe,
                     "script_basename": script, "line": number, "target_paths": targets,
                     "script_paths": script_paths(targets), "tcc_exposed": tcc_exposed(targets, home)})
    return {"jobs": jobs, "env": env, "unparsed": unparsed}


def read_crontab(home=None):
    """`crontab -l`, redacted line by line before parsing: {status, jobs, env, unparsed, errors}."""
    res = _run_tool("crontab", ["-l"])
    out = {"source": "crontab", "status": "ok", "jobs": [], "env": [], "unparsed": [], "errors": [],
           "observed_at": _now()}
    if not res.ok:
        if res.code == 1 and "no crontab" in res.err.lower():
            out["status"] = "empty"
        else:
            out["status"] = _tool_status(res)
            out["errors"].append(safety.redact_command(res.err.strip()[:300]) or "exit %s" % res.code)
        return out
    out.update(parse_crontab(res.out, home))
    return out


# ── JSON schedulers (hermes) ────────────────────────────────────────────────────────────────

def _hermes_job(path, job, home):
    profile = path.split("/profiles/", 1)[1].split("/", 1)[0] if "/profiles/" in path else _basename(os.path.dirname(path))
    ident = job.get("id") if isinstance(job.get("id"), str) else safety.sha12(json.dumps(job.get("name")))
    schedule = job.get("schedule")
    if isinstance(schedule, dict):
        schedule = schedule.get("expr") if isinstance(schedule.get("expr"), str) else schedule.get("display")
    workdir = job.get("workdir") if isinstance(job.get("workdir"), str) else None
    targets = [workdir] if workdir and os.path.isabs(workdir) else []
    return {"id": "sched:hermes:%s/%s" % (profile, ident), "mechanism": "hermes", "profile": profile,
            "label": job.get("name") if isinstance(job.get("name"), str) else None,
            "schedule": schedule if isinstance(schedule, str) else None,
            "enabled": job.get("enabled") if type(job.get("enabled")) is bool else None,
            "last_status": job.get("last_status") if isinstance(job.get("last_status"), str) else None,
            "state": job.get("state") if isinstance(job.get("state"), str) else None,
            "last_run_at": job.get("last_run_at") if isinstance(job.get("last_run_at"), str) else None,
            "target_paths": targets, "tcc_exposed": tcc_exposed(targets, home)}


def read_scheduler_json(globs=None, home=None):
    """Hermes-style jobs.json files (default LOCATORS hermes_jobs, plus config
    scheduler_json_globs): id, name, schedule, enabled, last status. Prompts, delivery targets,
    scripts and every other key are never copied."""
    home = _home(home)
    patterns = list(globs) if globs else [safety.LOCATORS["hermes_jobs"]]
    out = {"source": "scheduler-json", "status": "ok", "jobs": [], "files": [], "errors": [], "observed_at": _now()}
    seen = set()
    for pattern in patterns:
        for path in sorted(glob.glob(safety.expand_locator(pattern, home))):
            if path in seen:
                continue
            seen.add(path)
            raw, reason = read_checked(path, MAX_SMALL)
            if raw is None:
                out["errors"].append({"file": path, "error": reason})
                continue
            try:
                data = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, ValueError):
                out["errors"].append({"file": path, "error": "invalid json"})
                continue
            jobs = data.get("jobs") if isinstance(data, dict) else data
            if not isinstance(jobs, list):
                out["errors"].append({"file": path, "error": "no jobs list"})
                continue
            out["files"].append({"file": path, "jobs": len(jobs)})
            out["jobs"].extend(_hermes_job(path, job, home) for job in jobs if isinstance(job, dict))
    if not seen:
        out["status"] = "missing"
    elif out["errors"]:
        out["status"] = "partial"
    return out


# ── inside canonical checkouts ──────────────────────────────────────────────────────────────

def _clean(checkout):
    """True only when census measured zero modified tracked files; unknown is not clean."""
    dirty = checkout.get("dirty") or {}
    return dirty.get("mode") == "normal" and dirty.get("modified") == 0


def _tracked(runner, rel):
    try:
        res = runner.run("ls-files", "--error-unmatch", "--", rel)
    except safety.GitRefused:
        return None
    if res.ok:
        return True
    return False if res.code == 1 else None


def _attribution(tracked, clean):
    return "current_tracked_config" if tracked is True and clean else "candidate_only"


def _project_label(checkout, project_id):
    return project_id or checkout.get("project_id") or _basename(checkout["path"])


_CRON_LINE = re.compile(r"""^\s*-?\s*cron\s*:\s*(['"]?)([^'"#\n]+?)\1\s*(?:#.*)?$""", re.M)


def _read_toml(root, rel, errors):
    raw, reason = read_checked(os.path.join(root, rel), MAX_WORKFLOW)
    if raw is None:
        if reason != "missing":
            errors.append({"file": rel, "error": reason})
        return None
    try:
        return tomllib.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, tomllib.TOMLDecodeError):
        errors.append({"file": rel, "error": "invalid toml"})
        return None


def read_repo_schedules(checkout, project_id=None, git=None):
    """Schedulers declared in one canonical checkout: tracked .github/workflows/*.yml cron lines
    (sched:gha:<project>/<file>) and wrangler.toml [triggers] crons (sched:cf-cron:<worker>).
    Health is unknown (no run history is read). Attribution is current_tracked_config only for
    a tracked file in a checkout census measured clean; otherwise candidate_only."""
    root = checkout["path"]
    runner = git or GitRunner(root)
    clean = _clean(checkout)
    project = _project_label(checkout, project_id)
    out = {"jobs": [], "skipped": [], "errors": []}
    workflows = os.path.join(root, ".github", "workflows")
    try:
        with os.scandir(workflows) as entries:
            names = sorted(e.name for e in entries if e.is_file(follow_symlinks=False)
                           and e.name.endswith((".yml", ".yaml")))
    except (FileNotFoundError, NotADirectoryError):
        names = []
    except OSError as exc:
        names = []
        out["errors"].append({"file": ".github/workflows", "error": errno.errorcode.get(exc.errno, str(exc.errno))})
    for name in names:
        rel = ".github/workflows/" + name
        tracked = _tracked(runner, rel)
        if tracked is not True:
            out["skipped"].append({"file": rel, "reason": "untracked" if tracked is False else "tracking unknown"})
            continue
        raw, reason = read_checked(os.path.join(root, rel), MAX_WORKFLOW)
        if raw is None:
            out["errors"].append({"file": rel, "error": reason})
            continue
        crons = [m.group(2).strip() for m in _CRON_LINE.finditer(raw.decode("utf-8", "replace"))]
        if crons:
            out["jobs"].append({"id": "sched:gha:%s/%s" % (project, name), "mechanism": "gha", "label": name,
                                "schedule": crons, "source_file": rel, "tracked": True,
                                "attribution": _attribution(True, clean),
                                "health": {"state": "unknown", "basis": "no run history read"}})
    wrangler = _read_toml(root, "wrangler.toml", out["errors"])
    if wrangler is not None:
        triggers = wrangler.get("triggers") if isinstance(wrangler.get("triggers"), dict) else {}
        crons = [c for c in triggers.get("crons", []) if isinstance(c, str)] if isinstance(triggers.get("crons"), list) else []
        if crons:
            worker = wrangler.get("name") if isinstance(wrangler.get("name"), str) else project
            tracked = _tracked(runner, "wrangler.toml")
            out["jobs"].append({"id": "sched:cf-cron:" + worker, "mechanism": "cf-cron", "label": worker,
                                "schedule": crons, "source_file": "wrangler.toml", "tracked": tracked,
                                "attribution": _attribution(tracked, clean),
                                "health": {"state": "unknown", "basis": "no run history read"}})
    return out


_HOSTNAME = re.compile(r"(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]")


def _hostname(text):
    if not isinstance(text, str):
        return None
    host = text.strip().lower()
    host = re.sub(r"^[a-z]+://", "", host).split("/", 1)[0].split(":", 1)[0]
    host = host[2:] if host.startswith("*.") else host
    return host if _HOSTNAME.fullmatch(host) else None


def _surface(rel, hosting, name, hostnames, tracked, clean, owner):
    """One manifest surface. Its id comes from a real name or hostname, which is what lets the same
    surface be recognised across repos; a manifest with neither (most vercel.json files) gets an
    id of its own repository, never one shared by every nameless manifest of that kind."""
    hosts = sorted({h for h in hostnames if h})
    key = name or (hosts[0] if hosts else "%s@%s" % (_unsafe_free(_basename(owner) or "repo"), safety.sha12(owner)[:6]))
    return {"id": "surface:%s:%s" % (hosting, key), "hosting": hosting, "name": name, "hostnames": hosts,
            "source_file": rel, "tracked": tracked, "attribution": _attribution(tracked, clean)}


def _unsafe_free(text):
    return re.sub(r"[^A-Za-z0-9._-]+", "-", text).strip("-") or "repo"


# A CNAME file is GitHub Pages' custom domain, but a domain under another host's apex cannot be
# served by GitHub Pages: the file is then a leftover or another tool's (surge reads CNAME too).
CNAME_HOSTS = (("surge.sh", "external"), ("netlify.app", "external"), ("vercel.app", "vercel"),
               ("pages.dev", "cf-pages"), ("workers.dev", "cf-worker"), ("fly.dev", "fly"),
               ("codeberg.page", "codeberg-pages"))


def _cname_hosting(host):
    for apex, hosting in CNAME_HOSTS:
        if host and (host == apex or host.endswith("." + apex)):
            return hosting
    return "x-github-pages"


def read_manifests(checkout, git=None):
    """Deploy manifests in one canonical checkout, as surface candidates: fly.toml app,
    wrangler.toml name/routes, vercel.json and .vercel/project.json (projectName only),
    .domains and CNAME. {surfaces[{id, hosting, name, hostnames, source_file, tracked,
    attribution}], errors}."""
    root = checkout["path"]
    runner = git or GitRunner(root)
    clean = _clean(checkout)
    owner = _project_label(checkout, None)
    out = {"surfaces": [], "errors": []}
    fly = _read_toml(root, "fly.toml", out["errors"])
    if fly is not None and isinstance(fly.get("app"), str):
        out["surfaces"].append(_surface("fly.toml", "fly", fly["app"], [], _tracked(runner, "fly.toml"), clean, owner))
    wrangler = _read_toml(root, "wrangler.toml", out["errors"])
    if wrangler is not None and isinstance(wrangler.get("name"), str):
        routes = wrangler.get("routes") if isinstance(wrangler.get("routes"), list) else []
        if isinstance(wrangler.get("route"), (str, dict)):
            routes = routes + [wrangler["route"]]
        hosts = [_hostname(r if isinstance(r, str) else r.get("pattern")) for r in routes if isinstance(r, (str, dict))]
        hosting = "cf-pages" if "pages_build_output_dir" in wrangler else "cf-worker"
        out["surfaces"].append(_surface("wrangler.toml", hosting, wrangler["name"], hosts,
                                        _tracked(runner, "wrangler.toml"), clean, owner))
    for rel in ("vercel.json", ".vercel/project.json"):
        raw, reason = read_checked(os.path.join(root, rel), MAX_SMALL)
        if raw is None:
            if reason != "missing":
                out["errors"].append({"file": rel, "error": reason})
            continue
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            out["errors"].append({"file": rel, "error": "invalid json"})
            continue
        key = "projectName" if rel.startswith(".vercel") else "name"
        name = data.get(key) if isinstance(data, dict) and isinstance(data.get(key), str) else None
        del data  # .vercel/project.json also holds provider ids; only the project name is kept
        out["surfaces"].append(_surface(rel, "vercel", name, [], _tracked(runner, rel), clean, owner))
    for rel, hosting in ((".domains", "codeberg-pages"), ("CNAME", "x-github-pages")):
        raw, reason = read_checked(os.path.join(root, rel), MAX_SMALL)
        if raw is None:
            if reason != "missing":
                out["errors"].append({"file": rel, "error": reason})
            continue
        lines = [l.strip() for l in raw.decode("utf-8", "replace").split("\n") if l.strip() and not l.strip().startswith("#")]
        hosts = [_hostname(l) for l in (lines if rel == ".domains" else lines[:1])]
        if rel == "CNAME":
            hosting = _cname_hosting(next((h for h in hosts if h), None))
        out["surfaces"].append(_surface(rel, hosting, None, hosts, _tracked(runner, rel), clean, owner))
    return out


# ── packages inside a monorepo checkout ─────────────────────────────────────────────────────

PACKAGE_MANIFESTS = {"package.json": "package-json", "pyproject.toml": "pyproject"}
SOURCE_LANG = {".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
               ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript", ".py": "python"}
# Build output and dependency trees are never a package's own code, even when tracked.
GENERATED_DIRS = ("node_modules", "dist", "build", ".turbo", "coverage")
TEST_PATH = re.compile(r"(?:^|/)(?:tests?|__tests__|spec)/|\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|/)test_[^/]*\.py$"
                       r"|_test\.py$")
DEPENDENCY_KEYS = ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies")
# The package tasks a monorepo's CI runs through turbo, and that its quarantine list may name.
CI_TASKS = ("build", "typecheck", "lint", "test")
MAX_PACKAGE_FILES = 20000
# Static problems, each a code of the package it concerns (or of a workspace glob):
#   workspace-glob-empty   a workspace glob matches no tracked package
#   extends-unresolved     a tracked tsconfig extends a relative path that is not a tracked file
#   duplicate-name         two packages declare the same name
#   declared-not-imported  a manifest declares an internal package that no non-test source imports
#   imported-not-declared  non-test source imports an internal package its manifest does not declare
#   untracked-package      a directory a workspace glob matches holds a manifest git does not track
PACKAGE_PROBLEMS = ("workspace-glob-empty", "extends-unresolved", "duplicate-name", "declared-not-imported",
                    "imported-not-declared", "untracked-package")
_IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"\n]+)['"]""", re.M)
_EXTENDS = re.compile(r'"extends"\s*:\s*"([^"]+)"')
_PACKAGES_KEY = re.compile(r"^packages\s*:")
_LIST_ITEM = re.compile(r"""^\s*-\s*(['"]?)([^'"#]+?)\1\s*(?:#.*)?$""")


def strip_comments(text):
    """JavaScript or TypeScript source without its // and /* */ comments; string and template
    literals are kept whole, so an import specifier or a URL inside a string survives and an import
    written inside a comment does not. Regular-expression literals are not recognised."""
    out, i, n = [], 0, len(text)
    while i < n:
        ch = text[i]
        if ch in "'\"`":
            end = i + 1
            while end < n and text[end] != ch and not (ch != "`" and text[end] == "\n"):
                end += 2 if text[end] == "\\" else 1
            out.append(text[i:end + 1])
            i = end + 1
        elif text.startswith("//", i):
            end = text.find("\n", i)
            i = n if end < 0 else end
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            out.append("\n" * text.count("\n", i, n if end < 0 else end))
            i = n if end < 0 else end + 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def import_names(text):
    """The package names a JavaScript or TypeScript source imports (from, import(), require() and
    side-effect imports), outside comments; relative paths and node: builtins are not packages."""
    names = set()
    for spec in _IMPORT.findall(strip_comments(text)):
        if spec.startswith((".", "/", "node:")):
            continue
        parts = spec.split("/")
        names.add("/".join(parts[:2]) if spec.startswith("@") and len(parts) > 1 else parts[0])
    return names


def glob_match(path, pattern):
    """pnpm workspace semantics: * never crosses /, ** does."""
    regex = re.escape(pattern).replace(r"\*\*", "\0").replace(r"\*", "[^/]*").replace("\0", ".*")
    return re.fullmatch(regex, path) is not None


def workspace_globs(root, tracked):
    """(include globs, exclude globs) from a tracked pnpm-workspace.yaml packages list, else the root
    package.json workspaces field (a list, or a table with packages); ([], []) when neither says."""
    patterns = []
    if "pnpm-workspace.yaml" in tracked:
        raw, _reason = read_checked(os.path.join(root, "pnpm-workspace.yaml"), MAX_SMALL)
        inside = False
        for line in (raw or b"").decode("utf-8", "replace").splitlines():
            if _PACKAGES_KEY.match(line):
                inside = True
            elif inside and line.strip() and not line.startswith((" ", "\t", "-", "#")):
                inside = False
            elif inside:
                item = _LIST_ITEM.match(line)
                if item:
                    patterns.append(item.group(2).strip())
    elif "package.json" in tracked:
        raw, _reason = read_checked(os.path.join(root, "package.json"), MAX_SMALL)
        try:
            spaces = json.loads(raw.decode("utf-8")).get("workspaces") if raw is not None else None
        except (UnicodeDecodeError, ValueError, AttributeError):
            spaces = None
        if isinstance(spaces, dict):
            spaces = spaces.get("packages")
        patterns = [p for p in spaces or [] if isinstance(p, str)] if isinstance(spaces, list) else []
    include = [p.rstrip("/") for p in patterns if not p.startswith("!")]
    exclude = [p[1:].rstrip("/") for p in patterns if p.startswith("!")]
    return include, exclude


def _glob_dirs(root, pattern):
    """Directories on disk a workspace glob matches (no link followed; ** globs are not expanded)."""
    if "**" in pattern:
        return []
    found = [""]
    for part in pattern.split("/"):
        nxt = []
        for base in found:
            try:
                with os.scandir(os.path.join(root, base) if base else root) as entries:
                    names = sorted(e.name for e in entries if e.is_dir(follow_symlinks=False))
            except OSError:
                continue
            nxt += [base + "/" + name if base else name for name in names if glob_match(name, part)]
        found = nxt
    return found


def _manifest_of(subpath, tracked):
    kinds = [kind for name, kind in PACKAGE_MANIFESTS.items() if subpath + "/" + name in tracked]
    return "both" if len(kinds) > 1 else (kinds[0] if kinds else "module-folder")


def _read_package_json(root, subpath, tracked):
    """(name, {declared dependency names}, [CI_TASKS its scripts define]) of a tracked package.json,
    else a pyproject.toml's [project].name with no dependencies matched and no scripts; (None, set(),
    []) when neither reads."""
    if subpath + "/package.json" in tracked:
        raw, _reason = read_checked(os.path.join(root, subpath, "package.json"), MAX_SMALL)
        try:
            data = json.loads(raw.decode("utf-8")) if raw is not None else None
        except (UnicodeDecodeError, ValueError):
            data = None
        if isinstance(data, dict):
            declared = set()
            for key in DEPENDENCY_KEYS:
                if isinstance(data.get(key), dict):
                    declared |= set(data[key])
            scripts = data.get("scripts") if isinstance(data.get("scripts"), dict) else {}
            return ((data["name"] if isinstance(data.get("name"), str) else None), declared,
                    [task for task in CI_TASKS if task in scripts])
    if subpath + "/pyproject.toml" in tracked:
        doc = _read_toml(root, subpath + "/pyproject.toml", [])
        name = ((doc or {}).get("project") or {}).get("name")
        return (name if isinstance(name, str) else None), set(), []
    return None, set(), []


def _unresolved_extends(root, subpath, tracked):
    """The relative extends targets of the package's own tracked tsconfig files that resolve to
    no tracked file (with or without .json)."""
    out = []
    for rel in sorted(t for t in tracked if t.startswith(subpath + "/tsconfig") and t.endswith(".json")
                      and "/" not in t[len(subpath) + 1:]):
        raw, _reason = read_checked(os.path.join(root, rel), MAX_SMALL)
        match = _EXTENDS.search(strip_comments(raw.decode("utf-8", "replace"))) if raw is not None else None
        if match and match.group(1).startswith("."):
            target = os.path.normpath(os.path.join(subpath, match.group(1)))
            if target not in tracked and target + ".json" not in tracked:
                out.append("%s extends %s" % (rel, match.group(1)))
    return out


def read_packages(checkout, extra_folders=(), git=None):
    """The packages of one monorepo checkout, measured from tracked files only (git ls-files) and
    read through the deny list: a package is a directory holding a tracked package.json or
    pyproject.toml, or a folder extra_folders names. For each: its manifest kind, name and whether a
    workspace glob includes it; which of CI_TASKS its package.json scripts define (scripts);
    non-test source files, non-blank lines (by language) and test files;
    files the reader may not or could not open (unread_files, and then loc_partial: a lower bound,
    never a zero); declared internal dependencies against the imports its non-test JavaScript and
    TypeScript actually make; who imports it; and its static problems (PACKAGE_PROBLEMS). Python
    files count toward lines, but their imports are not matched to packages. The working tree is
    read, so at_head is false when census measured modified tracked files and None when that is
    unknown. Build state is not read here: read_build_list reads it."""
    root = checkout["path"]
    runner = git or GitRunner(root)
    dirty = checkout.get("dirty") or {}
    out = {"status": "ok", "reason": None, "at_commit": checkout.get("head"), "commit_date": checkout.get("last_commit_at"),
           "at_head": _clean(checkout) if dirty.get("mode") == "normal" else None, "files": None,
           "globs": {}, "packages": {}, "problems": []}
    try:
        res = runner.run("ls-files", "-z")
    except safety.GitRefused as exc:
        return dict(out, status="error", reason=str(exc))
    if not res.ok:
        return dict(out, status="error", reason="ls-files failed: exit %s" % res.code)
    files = [p for p in res.out.split("\0") if p]
    if len(files) > MAX_PACKAGE_FILES:
        return dict(out, status="error", reason="%d tracked files, more than the %d the reader reads" % (
            len(files), MAX_PACKAGE_FILES), files=len(files))
    out["files"] = len(files)
    tracked = set(files)
    include, exclude = workspace_globs(root, tracked)

    def generated(rel):
        return any(part in GENERATED_DIRS for part in rel.split("/")[:-1])

    dirs = {f.rsplit("/", 1)[0] for f in files if "/" in f and f.rsplit("/", 1)[1] in PACKAGE_MANIFESTS
            and not generated(f)}
    dirs |= {d.strip("/") for d in extra_folders if d.strip("/")}
    packages = out["packages"]
    for subpath in sorted(dirs):
        name, declared, scripts = _read_package_json(root, subpath, tracked)
        packages[subpath] = {
            "subpath": subpath, "name": name, "manifest": _manifest_of(subpath, tracked),
            "workspace": any(glob_match(subpath, g) for g in include) and not any(glob_match(subpath, g) for g in exclude),
            "scripts": scripts,
            "measures": {"src_files": 0, "loc": 0, "loc_by_lang": {}, "test_files": 0, "md_files": 0, "unread_files": 0,
                         "loc_partial": False},
            "deps": {"declared": declared}, "imports": {"internal": set()}, "imported_by": [], "static": []}
    out["globs"] = {g: sorted(d for d in packages if glob_match(d, g)) for g in include}
    by_name = {}
    for subpath, package in packages.items():
        if package["name"]:
            by_name.setdefault(package["name"], []).append(subpath)
    owners = sorted(packages, key=len, reverse=True)
    for rel in files:
        owner = next((d for d in owners if rel.startswith(d + "/")), None)
        if owner is None or generated(rel):
            continue
        measures, inner = packages[owner]["measures"], rel[len(owner) + 1:]
        base, ext = os.path.basename(rel), os.path.splitext(rel)[1]
        if ext == ".md":
            measures["md_files"] += 1
            continue
        if ext not in SOURCE_LANG or rel.endswith(".d.ts"):
            continue
        if TEST_PATH.search(inner):
            measures["test_files"] += 1
            continue
        raw, _reason = (None, "denied") if safety.is_denied(base) else read_checked(os.path.join(root, rel), MAX_SMALL)
        if raw is None:
            measures["unread_files"] += 1
            measures["loc_partial"] = True
            continue
        text = raw.decode("utf-8", "replace")
        lines = sum(1 for line in text.splitlines() if line.strip())
        measures["src_files"] += 1
        measures["loc"] += lines
        lang = SOURCE_LANG[ext]
        measures["loc_by_lang"][lang] = measures["loc_by_lang"].get(lang, 0) + lines
        if lang != "python":
            own = packages[owner]["name"]
            packages[owner]["imports"]["internal"] |= {n for n in import_names(text) if n in by_name and n != own}
    for subpath, package in packages.items():
        declared, imported = package["deps"].pop("declared"), package["imports"]["internal"]
        internal = {n for n in declared if n in by_name and n != package["name"]}
        package["deps"] = {"declared_internal": sorted(internal), "declared_external_n": len(declared - set(by_name))}
        package["imports"] = {"internal": sorted(imported), "undeclared": sorted(imported - internal)}
        for name in sorted(imported):
            for target in by_name[name]:
                packages[target]["imported_by"].append(package["name"] or subpath)
        codes = []
        if package["name"] and len(by_name[package["name"]]) > 1:
            codes.append(("duplicate-name", "%s is also declared by %s" % (package["name"], ", ".join(
                d for d in by_name[package["name"]] if d != subpath))))
        codes += [("declared-not-imported", n) for n in sorted(internal - imported)]
        codes += [("imported-not-declared", n) for n in sorted(imported - internal)]
        codes += [("extends-unresolved", d) for d in _unresolved_extends(root, subpath, tracked)]
        package["static"] = sorted({code for code, _ in codes})
        out["problems"] += [{"code": code, "path": subpath, "detail": detail} for code, detail in codes]
    for package in packages.values():
        package["imported_by"] = sorted(set(package["imported_by"]))
    for pattern in include:
        if not out["globs"][pattern]:
            out["problems"].append({"code": "workspace-glob-empty", "path": pattern, "detail": "matches no tracked package"})
        for subpath in _glob_dirs(root, pattern):
            loose = [n for n in PACKAGE_MANIFESTS if subpath + "/" + n not in tracked
                     and os.path.isfile(os.path.join(root, subpath, n)) and not os.path.islink(os.path.join(root, subpath, n))]
            if loose and subpath not in packages:
                out["problems"].append({"code": "untracked-package", "path": subpath,
                                        "detail": "%s on disk, not tracked" % ", ".join(loose)})
    return out


_COMMIT = re.compile(r"[0-9a-f]{7,40}")


def _commit_lag(runner, commit):
    """{commit_date, commits_since, ancestor} of one commit against HEAD (None when the checkout does
    not hold it): its committer date, how many commits HEAD has that it lacks, and whether it is an
    ancestor of HEAD."""
    out = {"commit_date": None, "commits_since": None, "ancestor": None}
    try:
        date = runner.run("log", "-1", "--format=%cI", commit)
        count = runner.run("rev-list", "--left-right", "--count", "%s...HEAD" % commit)
    except safety.GitRefused:
        return out
    if date.ok and date.out.strip():
        out["commit_date"] = date.out.strip()
    parts = count.out.split() if count.ok else []
    if len(parts) == 2 and all(p.isdigit() for p in parts):
        out["ancestor"], out["commits_since"] = parts[0] == "0", int(parts[1])
    return out


def read_build_list(checkout, rel, git=None):
    """The quarantine list of a monorepo's CI at rel (business-ecosystem: ci/quarantine.json, kept by
    scripts/ci-quarantine.mjs): the package tasks its CI skips until they are fixed. Read as a tracked
    file through the deny list. Each entry keeps only package, task, errors and measured_at (its
    reasons and exit texts stay in the repository); an entry of another shape is named in problems and
    left out. For each distinct measured_at: its commit date, how many commits HEAD is past it and
    whether it is an ancestor of HEAD, all None when the checkout does not hold it. at_head is true only
    when census measured the checkout clean, so the bytes read are HEAD's; what that means is the
    caller's to decide. {status (ok | missing | untracked | invalid | error), reason, path, at_head,
    entries [{package, task, errors, measured_at}], commits {measured_at: {...}}, problems [text]}."""
    root = checkout["path"]
    dirty = checkout.get("dirty") or {}
    out = {"status": "ok", "reason": None, "path": rel, "at_head": _clean(checkout) if dirty.get("mode") == "normal" else None,
           "entries": [], "commits": {}, "problems": []}
    if not isinstance(rel, str) or not rel or os.path.isabs(rel) or ".." in rel.split("/"):
        return dict(out, status="error", reason="the list path must be repository-relative")
    runner = git or GitRunner(root)
    raw, reason = read_checked(os.path.join(root, rel), MAX_SMALL)
    if raw is None:
        return dict(out, status="missing" if reason == "missing" else "error", reason=reason)
    tracked = _tracked(runner, rel)
    if tracked is not True:
        return dict(out, status="untracked", reason="not tracked" if tracked is False else "tracked state unknown")
    try:
        doc = _load_json(raw)
    except (UnicodeDecodeError, ValueError, RecursionError):
        return dict(out, status="invalid", reason="not JSON")
    entries = doc.get("entries") if isinstance(doc, dict) else None
    if not isinstance(entries, list):
        return dict(out, status="invalid", reason="no entries list")
    for index, entry in enumerate(entries):
        item = entry if isinstance(entry, dict) else {}
        errors, measured = item.get("errors"), item.get("measured_at")
        if not (isinstance(item.get("package"), str) and item.get("task") in CI_TASKS
                and (errors is None or (type(errors) is int and errors >= 0))
                and (measured is None or (isinstance(measured, str) and _COMMIT.fullmatch(measured)))):
            out["problems"].append("entry %d is not {package, task (%s), errors, measured_at}" % (index, ", ".join(CI_TASKS)))
            continue
        out["entries"].append({"package": item["package"], "task": item["task"], "errors": errors, "measured_at": measured})
    for commit in sorted({e["measured_at"] for e in out["entries"] if e["measured_at"]}):
        out["commits"][commit] = _commit_lag(runner, commit)
    return out


# ── wire anchors (curated/wires.toml) ───────────────────────────────────────────────────────

# Files an anchor is searched in. Documents declare; tests exercise; anything else tracked and read
# here (source, workflow and configuration files) is code a running system loads.
DOC_SUFFIXES = (".md", ".markdown", ".rst", ".txt")
HASH_COMMENT_SUFFIXES = (".py", ".yaml", ".yml", ".toml", ".sh", ".bash")
ANCHOR_SUFFIXES = tuple(SOURCE_LANG) + HASH_COMMENT_SUFFIXES + DOC_SUFFIXES + (".json", ".sql", ".prisma", ".graphql")
ANCHOR_FILES_SHOWN = 5
ANCHOR_FOUND = ("code", "test", "doc", "none", "absent", "unread")


def strip_hash_comments(text):
    """Python, YAML, TOML or shell text without its # comments: a # outside a quoted string runs to the
    end of its line. Quotes are followed within a line only, so a # inside a one-line string survives
    and a line inside a multi-line string may lose its tail (such lines are documentation, not code)."""
    out = []
    for line in text.split("\n"):
        quote, i, cut = None, 0, len(line)
        while i < len(line):
            ch = line[i]
            if quote:
                if ch == "\\":
                    i += 1
                elif ch == quote:
                    quote = None
            elif ch in "'\"":
                quote = ch
            elif ch == "#":
                cut = i
                break
            i += 1
        out.append(line[:cut])
    return "\n".join(out)


def _anchor_kind(rel):
    if TEST_PATH.search(rel):
        return "test"
    return "doc" if os.path.splitext(rel)[1].lower() in DOC_SUFFIXES else "code"


def _anchor_text(rel, raw):
    text = raw.decode("utf-8", "replace")
    ext = os.path.splitext(rel)[1].lower()
    if ext in SOURCE_LANG and SOURCE_LANG[ext] != "python":
        return strip_comments(text)
    return strip_hash_comments(text) if ext in HASH_COMMENT_SUFFIXES else text


def find_anchors(checkout, anchors, git=None):
    """Curated wire anchors re-found in one checkout. Each anchor is a repository-relative path (a file,
    or a directory and everything under it) and a text; the text is searched in the tracked files there
    with comments stripped (JavaScript and TypeScript comments; # comments in Python, YAML, TOML and
    shell), each file read through the deny list, build output skipped. found is code (in a file that is
    neither a test nor a document), test (only in tests), doc (only in documents), none (the path holds
    tracked files and none has the text), absent (no tracked file at or under the path) or unread (not
    found, and a file there could not be read). {status, reason, anchors [{path, text, found, files}]},
    files naming at most ANCHOR_FILES_SHOWN of the files that hold the text."""
    root = checkout["path"]
    runner = git or GitRunner(root)
    out = {"status": "ok", "reason": None, "anchors": []}
    try:
        res = runner.run("ls-files", "-z")
    except safety.GitRefused as exc:
        return dict(out, status="error", reason=str(exc))
    if not res.ok:
        return dict(out, status="error", reason="ls-files failed: exit %s" % res.code)
    files = [p for p in res.out.split("\0") if p]
    if len(files) > MAX_PACKAGE_FILES:
        return dict(out, status="error", reason="%d tracked files, more than the %d the reader reads" % (
            len(files), MAX_PACKAGE_FILES))
    cache = {}
    for anchor in anchors:
        path, text = anchor["path"].strip("/"), anchor["text"]
        under = [f for f in files if (f == path or f.startswith(path + "/"))
                 and not any(part in GENERATED_DIRS for part in f.split("/")[:-1])]
        kinds, hits, unread = set(), [], False
        for rel in under:
            if os.path.splitext(rel)[1].lower() not in ANCHOR_SUFFIXES:
                continue
            if rel not in cache:
                raw, _reason = (None, "denied") if safety.is_denied(os.path.basename(rel)) else read_checked(
                    os.path.join(root, rel), MAX_SMALL)
                cache[rel] = None if raw is None else _anchor_text(rel, raw)
            if cache[rel] is None:
                unread = True
            elif text in cache[rel]:
                kinds.add(_anchor_kind(rel))
                hits.append(rel)
        found = next((k for k in ("code", "test", "doc") if k in kinds), None) or (
            "unread" if unread else ("none" if under else "absent"))
        out["anchors"].append({"path": path, "text": text, "found": found, "files": hits[:ANCHOR_FILES_SHOWN]})
    return out


# ── files named by the owner (no symlinked path anywhere) ──────────────────────────────────

class _Refused(Exception):
    pass


def read_nofollow(path, limit):
    """Bytes of a regular file reached without following any symlink component, <= limit.
    Raises _Refused with a reason (the portfolio.py parent_fd discipline)."""
    if not isinstance(path, str) or not os.path.isabs(path) or "\x00" in path:
        raise _Refused("path must be absolute")
    parts = [p for p in path.split("/") if p]
    if not parts or any(p in (".", "..") for p in parts):
        raise _Refused("path must be normalized")
    if safety.is_denied(parts[-1]):
        raise _Refused("denied name")
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC
    fd = os.open("/", flags)
    try:
        for part in parts[:-1]:
            try:
                child = os.open(part, flags, dir_fd=fd)
            except FileNotFoundError:
                raise _Refused("missing") from None
            except OSError:
                raise _Refused("a path component is a symlink or not a directory") from None
            os.close(fd)
            fd = child
        try:
            file_fd = os.open(parts[-1], os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC, dir_fd=fd)
        except FileNotFoundError:
            raise _Refused("missing") from None
        except OSError:
            raise _Refused("the file is a symlink or unreadable") from None
    finally:
        os.close(fd)
    with os.fdopen(file_fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode):
            raise _Refused("not a regular file")
        if info.st_size > limit:
            raise _Refused("larger than %d bytes" % limit)
        raw = stream.read(limit + 1)
    if len(raw) > limit:
        raise _Refused("larger than %d bytes" % limit)
    return raw, info


def _strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON object key")
        result[key] = value
    return result


def _load_json(raw):
    return json.loads(raw.decode("utf-8"), object_pairs_hook=_strict_object)


def _source_head(path, raw, info):
    return {"path": path, "sha256": hashlib.sha256(raw).hexdigest(), "mtime": _iso_mtime(info.st_mtime)}


# ── portfolio-map/1 ─────────────────────────────────────────────────────────────────────────

def _evidence(value):
    return [{k: e.get(k) for k in ("kind", "locator", "note")} for e in value if isinstance(e, dict)] \
        if isinstance(value, list) else []


_HOST = re.compile(r"(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+")


def edge_host(edge):
    """The hostname one hosting edge binds: its hostname (a worker custom domain, a Pages declared
    domain), else the host part of its route pattern. A route's path is never kept; "*.zone" stays
    a wildcard host. None when the edge names no usable host."""
    host = edge.get("hostname")
    if not isinstance(host, str):
        pattern = edge.get("pattern")
        if not isinstance(pattern, str):
            return None
        host = pattern.split("://", 1)[-1].split("/", 1)[0]
    host = host.strip().lower().rstrip(".")
    if host.startswith("*") and not host.startswith("*."):
        host = host[1:]  # "*zone/*" covers the apex and every subdomain
    return host if _HOST.fullmatch(host) else None


def read_portfolio_v1(path):
    """The dated portfolio-map/1 snapshot (historical source): regular file, no symlinked path,
    <= 8 MiB, schema checked, duplicate keys refused. Evidence locators are copied, never
    followed. {status, schema, sha256, mtime, observed, repositories, surfaces (each with the
    hostnames its hosting edges bind), zones, hosting_edges [{kind, to, hostname}],
    edges_unjoined, legal_entities, errors}."""
    out = {"source": "portfolio-map/1", "status": "ok", "errors": [], "repositories": [], "surfaces": [],
           "zones": [], "hosting_edges": [], "edges_unjoined": 0, "observed": {}, "legal_entities": None}
    if not path:
        out["status"] = "not-configured"
        return out
    try:
        raw, info = read_nofollow(path, MAX_PORTFOLIO)
    except _Refused as exc:
        out["status"] = "refused"
        out["errors"].append(str(exc))
        return out
    out.update(_source_head(path, raw, info))
    try:
        data = _load_json(raw)
    except (UnicodeDecodeError, ValueError, RecursionError) as exc:
        out["status"] = "invalid"
        out["errors"].append("invalid json: %s" % exc)
        return out
    if not isinstance(data, dict) or data.get("schema") != PORTFOLIO_SCHEMA:
        out["status"] = "invalid"
        out["errors"].append("unsupported schema (want %s)" % PORTFOLIO_SCHEMA)
        return out
    out["schema"] = data["schema"]
    times = data.get("observation_times")
    out["observed"] = {k: v for k, v in times.items() if isinstance(v, str)} if isinstance(times, dict) else {}
    for repo in data.get("repositories") or []:
        if not isinstance(repo, dict) or not isinstance(repo.get("full_name"), str):
            out["errors"].append("repository without full_name")
            continue
        meta = repo.get("github_metadata") if isinstance(repo.get("github_metadata"), dict) else {}
        life = repo.get("lifecycle") if isinstance(repo.get("lifecycle"), dict) else {}
        out["repositories"].append({
            "portfolio_id": repo.get("id"), "full_name": repo["full_name"],
            "github_id": meta.get("id") if type(meta.get("id")) is int else None,
            "private": meta.get("private") if type(meta.get("private")) is bool else None,
            "group": repo.get("group") if isinstance(repo.get("group"), str) else None,
            "framework_domains": [d for d in repo.get("framework_domains") or [] if isinstance(d, str)],
            "lifecycle": {k: life[k] for k in ("github_archived", "github_fork", "github_disabled") if type(life.get(k)) is bool},
            "legal_entity_id": repo.get("legal_entity_id"), "evidence": _evidence(repo.get("evidence"))})
    for surface in data.get("surfaces") or []:
        if not isinstance(surface, dict):
            continue
        meta = surface.get("metadata") if isinstance(surface.get("metadata"), dict) else {}
        name = meta.get("name")
        if name is None and surface.get("kind") == "workers":
            name = meta.get("id")  # Cloudflare's script listing names a worker by its id; it has no name field
        out["surfaces"].append({
            "portfolio_id": surface.get("id"), "resource_id": surface.get("resource_id"),
            "kind": surface.get("kind"), "name": name if isinstance(name, str) else None,
            "attribution": surface.get("attribution"), "repository": surface.get("repository"),
            "candidate_repositories": [c for c in surface.get("candidate_repositories") or [] if isinstance(c, str)],
            "legal_entity_id": surface.get("legal_entity_id"), "evidence": _evidence(surface.get("evidence"))})
    for zone in data.get("zones") or []:
        if isinstance(zone, dict):
            out["zones"].append({"portfolio_id": zone.get("id"), "name": zone.get("name"),
                                 "legal_entity_id": zone.get("legal_entity_id")})
    # The edges bind a surface (to) to a hostname in a zone: custom domains, zone routes and Pages
    # declared domains. They are the only place the map says which domain a worker serves.
    bound = {}
    for edge in data.get("hosting_edges") or []:
        if not isinstance(edge, dict):
            continue
        host, target = edge_host(edge), edge.get("to") if isinstance(edge.get("to"), str) else None
        out["hosting_edges"].append({"kind": edge.get("kind") if isinstance(edge.get("kind"), str) else None,
                                     "to": target, "hostname": host})
        if host and target:
            bound.setdefault(target, set()).add(host)
    known = {s["portfolio_id"] for s in out["surfaces"]}
    out["edges_unjoined"] = sum(1 for e in out["hosting_edges"] if not e["hostname"] or e["to"] not in known)
    for surface in out["surfaces"]:
        surface["hostnames"] = sorted(bound.get(surface["portfolio_id"]) or ())
    legal = data.get("legal_entities")
    if isinstance(legal, dict):
        records = legal.get("records") if isinstance(legal.get("records"), list) else []
        out["legal_entities"] = {"status": legal.get("status"), "records": len(records)}
    if out["errors"]:
        out["status"] = "partial"
    return out


# ── Cloudflare observer and inventory ──────────────────────────────────────────────────────

_RUN_DIR = re.compile(r"\d{8}T\d{6}Z-[0-9a-f]+")


def read_observer(directory=None, home=None):
    """The newest kingdom-cloudflare-observer run: its own state (degraded propagates),
    coverage and error count, plus snapshot scope.zone_names. Account ids are not kept."""
    home = _home(home)
    directory = directory or safety.expand_locator(safety.LOCATORS["observer_runs"], home)
    out = {"source": "cloudflare-observer", "status": "ok", "run_id": None, "state": None, "coverage": None,
           "errors_n": None, "started_at": None, "finished_at": None, "zone_names": [], "zones_expected": None,
           "runs_n": 0, "errors": []}
    try:
        with os.scandir(directory) as entries:
            runs = sorted(e.name for e in entries if e.is_dir(follow_symlinks=False) and _RUN_DIR.fullmatch(e.name))
    except FileNotFoundError:
        out["status"] = "missing"
        return out
    except OSError as exc:
        out["status"] = "error"
        out["errors"].append(errno.errorcode.get(exc.errno, str(exc.errno)))
        return out
    out["runs_n"] = len(runs)
    if not runs:
        out["status"] = "missing"
        out["errors"].append("no runs")
        return out
    newest = os.path.join(directory, runs[-1])
    raw, reason = read_checked(os.path.join(newest, "run.json"), MAX_SMALL)
    if raw is None:
        out["status"] = "error"
        out["errors"].append("run.json %s" % reason)
        return out
    try:
        run = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        out["status"] = "error"
        out["errors"].append("run.json invalid json")
        return out
    coverage = run.get("coverage") if isinstance(run.get("coverage"), dict) else None
    out.update({"run_id": run.get("run_id") if isinstance(run.get("run_id"), str) else runs[-1],
                "state": run.get("state") if isinstance(run.get("state"), str) else None,
                "schema": run.get("schema") if isinstance(run.get("schema"), str) else None,
                "coverage": {k: v for k, v in coverage.items() if type(v) in (int, bool)} if coverage else None,
                "errors_n": len(run["errors"]) if isinstance(run.get("errors"), list) else None,
                "started_at": run.get("started_at") if isinstance(run.get("started_at"), str) else None,
                "finished_at": run.get("finished_at") if isinstance(run.get("finished_at"), str) else None})
    snap, reason = read_checked(os.path.join(newest, "snapshot.json"), MAX_BIG)
    if snap is None:
        out["errors"].append("snapshot.json %s" % reason)
    else:
        try:
            scope = json.loads(snap.decode("utf-8")).get("scope") or {}
            out["zone_names"] = sorted(z for z in scope.get("zone_names") or [] if isinstance(z, str))
            out["zones_expected"] = scope.get("zones_expected") if type(scope.get("zones_expected")) is int else None
        except (UnicodeDecodeError, ValueError, AttributeError):
            out["errors"].append("snapshot.json unreadable scope")
    if out["state"] is None:
        out["errors"].append("run.json has no state")
    if out["errors"]:
        out["status"] = "partial"
    return out


def read_cf_inventory(path):
    """Optional kingdom-os cloudflare inventory/surfaces snapshot (schema
    kingdom.cloudflare-surfaces/1): surfaces with audience, zone names, Pages projects and
    Worker scripts. Absent locator -> status not-configured."""
    out = {"source": "cloudflare-inventory", "status": "ok", "surfaces": [], "zones": [], "pages": [],
           "workers": [], "errors": []}
    if not path:
        out["status"] = "not-configured"
        return out
    try:
        raw, info = read_nofollow(path, MAX_BIG)
        data = _load_json(raw)
    except _Refused as exc:
        out["status"] = "refused"
        out["errors"].append(str(exc))
        return out
    except (UnicodeDecodeError, ValueError, RecursionError):
        out["status"] = "invalid"
        out["errors"].append("invalid json")
        return out
    out.update(_source_head(path, raw, info))
    if not isinstance(data, dict) or data.get("schema") != CF_SURFACES_SCHEMA:
        out["status"] = "invalid"
        out["errors"].append("unsupported schema (want %s)" % CF_SURFACES_SCHEMA)
        return out
    out["as_of"] = data.get("as_of") if isinstance(data.get("as_of"), str) else None
    for row in data.get("surfaces") or []:
        if isinstance(row, dict) and isinstance(row.get("id"), str):
            audience = row.get("audience") if row.get("audience") in AUDIENCES else "unknown"
            out["surfaces"].append({k: row.get(k) for k in ("id", "name", "kind", "state") if isinstance(row.get(k), str)}
                                   | {"audience": audience})
    zones = data.get("zones") if isinstance(data.get("zones"), dict) else {}
    out["zones"] = sorted(z["name"] for z in zones.get("items") or [] if isinstance(z, dict) and isinstance(z.get("name"), str))
    for account in data.get("accounts_inventory") or []:
        if not isinstance(account, dict):
            continue
        for item in ((account.get("pages") or {}).get("items") or []):
            if isinstance(item, dict) and isinstance(item.get("name"), str):
                source = item.get("source") if isinstance(item.get("source"), dict) else {}
                out["pages"].append({"name": item["name"], "subdomain": item.get("subdomain"),
                                     "domains": [d for d in item.get("domains") or [] if isinstance(d, str)],
                                     "source_owner": source.get("owner"), "source_repo": source.get("repo_name")})
        for item in ((account.get("workers") or {}).get("items") or []):
            if isinstance(item, dict) and isinstance(item.get("id"), str):
                out["workers"].append({"name": item["id"]})
    return out


# ── forge listings ──────────────────────────────────────────────────────────────────────────

def _github_repo(item):
    url = item.get("url") if isinstance(item.get("url"), str) else None
    full = item.get("nameWithOwner") if isinstance(item.get("nameWithOwner"), str) else None
    ident = safety.normalize_remote(url) if url else ("github.com/" + full.lower() if full else None)
    language = item.get("primaryLanguage")
    return ident, {"visibility": _visibility(item.get("isPrivate")), "archived": _bool(item.get("isArchived")),
                   "fork": _bool(item.get("isFork")), "mirror": None, "pushed_at": _text(item.get("pushedAt")),
                   "description": _text(item.get("description")),
                   "language": _text(language.get("name")) if isinstance(language, dict) else None}


def _codeberg_repo(item):
    url = item.get("html_url") if isinstance(item.get("html_url"), str) else None
    owner = item.get("owner")
    owner = owner.get("login") if isinstance(owner, dict) else owner
    ident = safety.normalize_remote(url) if url else (
        "codeberg.org/%s/%s" % (owner, item.get("name")) if isinstance(owner, str) and isinstance(item.get("name"), str) else None)
    return (ident.lower() if ident else None), {
        "visibility": _visibility(item.get("private")), "archived": _bool(item.get("archived")),
        "fork": _bool(item.get("fork")), "mirror": _bool(item.get("mirror")),
        "pushed_at": _text(item.get("updated_at")), "description": _text(item.get("description")),
        "language": _text(item.get("language"))}


def _bool(value):
    return value if type(value) is bool else None


def _text(value):
    return value if isinstance(value, str) and value else None


def _visibility(private):
    return None if type(private) is not bool else ("private" if private else "public")


def _forge_of(item):
    if any(k in item for k in ("nameWithOwner", "isPrivate", "pushedAt")) or "github.com/" in str(item.get("url", "")):
        return "github"
    if "html_url" in item or "codeberg.org/" in str(item.get("html_url", "")):
        return "codeberg"
    return None


def normalize_listing(items):
    """[(id, record)] from one forge listing; unrecognised rows come back with id None."""
    out = []
    for item in items:
        if not isinstance(item, dict):
            out.append((None, None))
            continue
        forge = _forge_of(item)
        if forge == "github":
            ident, record = _github_repo(item)
        elif forge == "codeberg":
            ident, record = _codeberg_repo(item)
        else:
            out.append((None, None))
            continue
        if ident:
            host, owner, name = (ident.split("/", 2) + [None, None])[:3]
            record.update({"id": ident, "host": host, "owner": owner, "name": name, "forge": forge})
        out.append((ident, record))
    return out


def read_forge_listings(paths, now=None):
    """Owner-supplied forge listings (`gh repo list --json ...`, the Codeberg API export).
    Each listing is dated by its file mtime. {status, listings[{path, forge, owners, count,
    unrecognised, sha256, mtime, age_s}], repos{id: record}, errors}."""
    now = now or safety.utc_now()
    out = {"source": "forge-listings", "status": "ok", "listings": [], "repos": {}, "errors": [],
           "observed_at": safety.iso(now)}
    if not paths:
        out["status"] = "not-configured"
        return out
    for path in paths:
        path = safety.expand_locator(path)
        try:
            raw, info = read_nofollow(path, MAX_BIG)
            items = _load_json(raw)
        except _Refused as exc:
            out["errors"].append({"path": path, "error": str(exc)})
            continue
        except (UnicodeDecodeError, ValueError, RecursionError):
            out["errors"].append({"path": path, "error": "invalid json"})
            continue
        if not isinstance(items, list):
            out["errors"].append({"path": path, "error": "listing is not a JSON array"})
            continue
        rows = normalize_listing(items)
        listing = _source_head(path, raw, info)
        forges = sorted({r["forge"] for _, r in rows if r})
        listing.update({"forge": forges[0] if len(forges) == 1 else ("mixed" if forges else None),
                        "owners": sorted({r["owner"] for _, r in rows if r and r.get("owner")}),
                        "count": sum(1 for i, _ in rows if i), "unrecognised": sum(1 for i, _ in rows if not i),
                        "age_s": int(now.timestamp() - info.st_mtime)})
        index = len(out["listings"])
        out["listings"].append(listing)
        for ident, record in rows:
            if ident and ident not in out["repos"]:
                out["repos"][ident] = dict(record, listing=index)
    if out["errors"]:
        out["status"] = "partial" if out["listings"] else "error"
    return out


def gh_listing(owners, allow_network=False, limit=2000):
    """The opt-in `--forge` listing, one of the overlay's two network reads (workflow_runs is the
    other): `gh repo list OWNER --limit N --json name,nameWithOwner,isPrivate,isArchived,isFork,
    pushedAt,description` per owner. Without allow_network=True nothing is spawned. Returns {status, owners{owner:
    {status, count, repos[], raw (bytes for the run dir), error}}}."""
    if allow_network is not True:
        return {"source": "gh", "status": "skipped", "reason": "network not requested (--forge)", "owners": {}}
    out = {"source": "gh", "status": "ok", "owners": {}, "observed_at": _now()}
    for owner in owners or []:
        if not isinstance(owner, str) or re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]{0,38}", owner) is None:
            out["owners"][str(owner)] = {"status": "refused", "error": "invalid owner name"}
            continue
        res = _run_tool("gh", ["repo", "list", owner, "--limit", str(int(limit)), "--json", GH_FIELDS], timeout=GH_TIMEOUT)
        if not res.ok:
            out["owners"][owner] = {"status": _tool_status(res), "error": res.err.strip()[:300] or "exit %s" % res.code}
            continue
        try:
            items = _load_json(res.raw)
        except (UnicodeDecodeError, ValueError):
            out["owners"][owner] = {"status": "invalid", "error": "gh printed invalid json"}
            continue
        rows = [r for _, r in normalize_listing(items if isinstance(items, list) else []) if r]
        out["owners"][owner] = {"status": "ok", "count": len(rows), "repos": rows, "raw": res.raw}
    if any(v.get("status") != "ok" for v in out["owners"].values()):
        out["status"] = "partial"
    return out


# ── one workflow's latest run on main (build --forge; tool/wires.py) ────────────────────────

RUN_FIELDS = "databaseId,status,conclusion,headSha,event,createdAt"
RUN_STATUSES = ("requested", "queued", "pending", "waiting", "in_progress", "completed")
RUN_CONCLUSIONS = ("success", "failure", "cancelled", "skipped", "timed_out", "action_required", "neutral", "stale",
                   "startup_failure")
_GITHUB_REPO = re.compile(r"github\.com/([A-Za-z0-9][A-Za-z0-9-]{0,38})/([A-Za-z0-9._-]{1,100})")
WORKFLOW_FILE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*\.ya?ml")
_SHA = re.compile(r"[0-9a-f]{40}")


def workflow_run_argv(repo, workflow):
    """The one workflow-run read the estate makes, as gh argv: `gh run list --repo OWNER/NAME --workflow
    FILE --branch main --limit 1 --json RUN_FIELDS`, read-only; None unless repo is a github.com forge id
    and workflow a workflow file name (FILE.yml or FILE.yaml, no path)."""
    match = _GITHUB_REPO.fullmatch(repo) if isinstance(repo, str) else None
    if match is None or not (isinstance(workflow, str) and WORKFLOW_FILE.fullmatch(workflow)):
        return None
    return ["run", "list", "--repo", "%s/%s" % match.groups(), "--workflow", workflow, "--branch", "main",
            "--limit", "1", "--json", RUN_FIELDS]


def _run_of(item):
    """The fields kept of one `gh run list` row, each shape-checked: {id, status, conclusion, head_sha,
    event, created_at}; None when the row is not of that shape (nothing else from it is kept)."""
    if not isinstance(item, dict):
        return None
    run = {"id": item.get("databaseId"), "status": item.get("status"), "conclusion": item.get("conclusion") or None,
           "head_sha": item.get("headSha"), "event": item.get("event"), "created_at": item.get("createdAt")}
    ok = (type(run["id"]) is int and run["status"] in RUN_STATUSES
          and (run["conclusion"] is None or run["conclusion"] in RUN_CONCLUSIONS)
          and isinstance(run["head_sha"], str) and _SHA.fullmatch(run["head_sha"])
          and isinstance(run["event"], str) and re.fullmatch(r"[a-z_]{1,40}", run["event"])
          and isinstance(run["created_at"], str) and _is_iso(run["created_at"]))
    return run if ok else None


def _is_iso(text):
    try:
        dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return False
    return True


def _gh_failure(result):
    """Why a gh call failed, in the estate's own words: gh's output is never kept, so nothing it prints
    (a token among it) reaches a record, a run file or the terminal."""
    if result.timed_out:
        return "timeout after %ss" % GH_TIMEOUT
    if result.code is None:
        return "gh could not be started" if "not found" not in (result.err or "") else "gh not found on PATH"
    return "gh exited %s" % result.code


def workflow_runs(requests, allow_network=False, transport=None):
    """The latest run on main of each (repository forge id, workflow file) in requests, read with
    workflow_run_argv and nothing else: read-only, one call per pair, through transport (argv -> a
    safety.Result; by default gh with the minimal environment of _run_tool, which passes no token).
    Without allow_network=True nothing is called. Only the fields _run_of keeps are kept, and a failure
    keeps only the estate's own words for it. {source, status (ok | partial | skipped), reason, runs
    {"repo|workflow": {status (read | none | refused | error | invalid), reason, run}}}: none is a read
    that found no run on main."""
    if allow_network is not True:
        return {"source": "gh-runs", "status": "skipped", "reason": "network not requested (--forge)", "runs": {}}
    call = transport or (lambda argv: _run_tool("gh", argv, timeout=GH_TIMEOUT))
    out = {"source": "gh-runs", "status": "ok", "reason": None, "runs": {}, "observed_at": _now()}
    for repo, workflow in requests or []:
        key = "%s|%s" % (repo, workflow)
        if key in out["runs"]:
            continue
        argv = workflow_run_argv(repo, workflow)
        if argv is None:
            out["runs"][key] = {"status": "refused", "reason": "not a github.com repository and a workflow file name",
                                "run": None}
            continue
        result = call(argv)
        if not result.ok:
            out["runs"][key] = {"status": "error", "reason": _gh_failure(result), "run": None}
            continue
        try:
            items = _load_json(result.raw)
        except (UnicodeDecodeError, ValueError, RecursionError):
            items = None
        if not isinstance(items, list):
            out["runs"][key] = {"status": "invalid", "reason": "gh printed no JSON list", "run": None}
        elif not items:
            out["runs"][key] = {"status": "none", "reason": "no run of %s on main" % workflow, "run": None}
        elif _run_of(items[0]) is None:
            out["runs"][key] = {"status": "invalid", "reason": "the run gh printed is not of the expected shape",
                                "run": None}
        else:
            out["runs"][key] = {"status": "read", "reason": None, "run": _run_of(items[0])}
    if any(item["status"] not in ("read", "none") for item in out["runs"].values()):
        out["status"] = "partial"
    return out


# ── prior maps (claims for DRIFT only) ─────────────────────────────────────────────────────

def _kingdom_index(raw):
    buckets, current = {}, None
    for line in raw.decode("utf-8", "replace").split("\n"):
        heading = re.match(r"##\s+(.+?)\s*$", line)
        if heading:
            current = heading.group(1)
            buckets.setdefault(current, [])
            continue
        # `- **`soul/name`** — text` on the real index; a plain `- name` also counts.
        item = re.match(r"\s*[-*]\s+(?:\*\*)?`?([^`*\s]+)", line)
        if item and current is not None:
            buckets[current].append(item.group(1).rsplit("/", 1)[-1])
    return {"buckets": buckets, "names_n": sum(len(v) for v in buckets.values())}


def _start_here(raw):
    data = json.loads(raw.decode("utf-8"))
    if isinstance(data, dict) and isinstance(data.get("roots"), list):
        rows = [{"name": r.get("name"), "cluster": r.get("cluster"), "path": r.get("path")}
                for r in data["roots"] if isinstance(r, dict) and isinstance(r.get("name"), str)]
        return {"schema": data.get("schema"), "snapshot": data.get("snapshot"), "entries": rows}
    if isinstance(data, dict) and isinstance(data.get("clusters"), dict):
        rows = [{"name": name, "cluster": cluster, "path": None}
                for cluster, names in data["clusters"].items() if isinstance(names, list)
                for name in names if isinstance(name, str)]
        return {"schema": data.get("schema"), "snapshot": None, "entries": rows}
    raise ValueError("unrecognised catalog shape")


def _registry_gen(raw):
    data = json.loads(raw.decode("utf-8"))
    services = data.get("services") if isinstance(data, dict) else None
    if not isinstance(services, list):
        raise ValueError("no services list")
    return {"updated": data.get("updated"), "generated": data.get("generated"),
            "ids": [s["id"] for s in services if isinstance(s, dict) and isinstance(s.get("id"), str)]}


def _realm(raw):
    text = raw.decode("utf-8", "replace").lower()
    return {"tier_mentions": {tier: len(re.findall(r"(?<![a-z0-9-])%s(?![a-z0-9-])" % re.escape(tier), text))
                              for tier in REALM_TIERS}}


_PRIOR_READERS = (("kingdom_index", _kingdom_index), ("start_here_catalog", _start_here),
                  ("registry_gen", _registry_gen), ("realm_md", _realm))


def _prior(locator, parser, home):
    if not locator:
        return {"status": "not-configured"}
    path = safety.expand_locator(locator, home)
    raw, reason = read_checked(path, MAX_BIG)
    if raw is None:
        return {"status": reason, "path": path}
    try:
        info = os.lstat(path)
        claims = parser(raw)
    except (UnicodeDecodeError, ValueError, OSError) as exc:
        return {"status": "unreadable", "path": path, "error": type(exc).__name__}
    return dict(_source_head(path, raw, info), status="ok", claims=claims)


def read_prior_maps(cfg, home=None):
    """Prior maps named in private/config.toml [locators] (kingdom_index, start_here_catalog,
    registry_gen, realm_md) plus the [[declared]] counts. All are dated claims for DRIFT."""
    home = _home(home)
    locators = (cfg or {}).get("locators") or {}
    out = {key: _prior(locators.get(key), parser, home) for key, parser in _PRIOR_READERS}
    declared, errors = [], []
    for entry in (cfg or {}).get("declared") or []:
        if (isinstance(entry, dict) and isinstance(entry.get("id"), str)
                and type(entry.get("value")) in (int, float) and not isinstance(entry.get("value"), bool)):
            declared.append({k: entry.get(k) for k in ("id", "label", "value", "source")})
        else:
            errors.append("declared entry needs a string id and a numeric value")
    out["declared"] = {"status": "ok" if not errors else "partial", "entries": declared, "errors": errors}
    return out


# ── artifacts ───────────────────────────────────────────────────────────────────────────────

_ARTIFACT_KEYS = ("artifact_kind", "owner_project", "secret_bearing", "backup", "label")
_LOCATOR_WORD = re.compile(r"[^\s(),;]+")
UNVERIFIABLE = "unverifiable"


def artifact_locator(text):
    """(locator, problem) for a curated artifact path. The curation often follows the locator with
    prose (a dot-dir followed by "(file NAMES only)", "... fleet.log and citizen log"): the leading word is the
    locator. A glob or a placeholder names many paths or none, so it cannot be lstat'ed."""
    match = _LOCATOR_WORD.match(text.strip()) if isinstance(text, str) else None
    if match is None:
        return None, "no path"
    word = match.group(0)
    if any(ch in word for ch in "*?[]{}<>"):
        return None, "%s (glob or placeholder)" % UNVERIFIABLE
    return word, None


def lstat_artifacts(bindings, home=None):
    """lstat only (size, mtime, mode, type) for curated [[artifact]] bindings; contents are
    never opened, whatever the name. Each binding needs id (or slug) and path (or locator)."""
    home = _home(home)
    out = []
    for binding in bindings or []:
        if not isinstance(binding, dict):
            continue
        ident = binding.get("id") or ("artifact:" + binding["slug"] if isinstance(binding.get("slug"), str) else None)
        locator, problem = artifact_locator(binding.get("path") or binding.get("locator"))
        record = {"id": ident, "path": None, "contents_read": False, "status": None,
                  **{k: binding[k] for k in _ARTIFACT_KEYS if k in binding}}
        if problem:
            record["status"] = problem
            out.append(record)
            continue
        try:
            record["path"] = safety.expand_locator(locator, home)
            info = os.lstat(record["path"])
        except FileNotFoundError:
            record["status"] = "missing"
        except safety.GuardError:
            record["status"] = "invalid path"
        except OSError as exc:
            record["status"] = "error:" + errno.errorcode.get(exc.errno, str(exc.errno))
        else:
            mode = info.st_mode
            record.update({"status": "present", "size": info.st_size, "mtime": _iso_mtime(info.st_mtime),
                           "mode": stat.S_IMODE(mode),
                           "type": "symlink" if stat.S_ISLNK(mode) else "dir" if stat.S_ISDIR(mode)
                           else "file" if stat.S_ISREG(mode) else "other"})
        out.append(record)
    return out
