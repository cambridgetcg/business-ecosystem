"""Package records: the packages of the monorepos a [[host]] row of curated/capabilities.toml opts in.

A host is a project, keyed by forge id. Its canonical checkout is read for packages
(sources.read_packages: tracked manifests, every file read through the deny list) and for the build
state its CI enforces (sources.read_build_list: the tracked quarantine list the row names,
ci/quarantine.json in business-ecosystem). Each package becomes a record pkg:<host forge id>//<subpath>
with its measures, declared and imported internal dependencies, static problems and build state;
capability.resolve_packages then gives it its business capability, and the host project takes the
union of its packages that have code (derived:packages).

Build state. The quarantine list is the contract the host's CI enforces at the commit that carries it:
ci.yml skips exactly the listed package tasks and runs every other one, and the ratchet re-measures a
listed task on every pull request that touches its package. So a task's state is its membership in the
list at the checkout's HEAD: quarantined when listed, gated when CI runs it (a workspace package whose
package.json defines that script) and not-run otherwise. An entry's measured_at is the commit whose
sources its error count was measured at. It always predates the commit that carries the list (a commit
cannot name itself), so comparing it with HEAD would leave every package unmeasured for ever; it is
reported as dated evidence instead, with how many commits HEAD is past it. The bytes read are HEAD's
only when the list is a tracked file and census measured the checkout clean (the rule
sources._attribution applies to deploy manifests); otherwise every task reads not-measured, never
gated. A gated task is a contract of CI, not an observed run: the estate runs no build.
"""
from collections import Counter

import sources

FILE = "curated/capabilities.toml"
TASKS = sources.CI_TASKS
# A package whose build or typecheck is quarantined has source that does not compile in CI: its
# capability reads code-unbuilt (vocab/facets.toml capability_impl).
UNBUILT_TASKS = ("build", "typecheck")
QUARANTINED, GATED, NOT_RUN, NOT_MEASURED = "quarantined", "gated", "not-run", "not-measured"
FOLDER = "module-folder"  # vocab/facets.toml package_manifest: a folder a host row names, with no manifest


def package_id(host, subpath):
    return "pkg:%s//%s" % (host, subpath)


def _relative(path):
    return isinstance(path, str) and bool(path.strip("/")) and not path.startswith("/") and ".." not in path.split("/")


def host_rows(curated):
    """({host project id: {id, extra_folders, build_list}}, problems) from the [[host]] rows of
    curated/capabilities.toml. A path that is not repository-relative is named and left out."""
    rows, problems = {}, []
    for row in (curated or {}).get("hosts") or []:
        ident = row.get("id") if isinstance(row, dict) else None
        if not isinstance(ident, str) or not ident:
            problems.append("packages: a [[host]] row in %s has no id or is not a table" % FILE)
            continue
        if ident in rows:
            problems.append("packages: %s has two [[host]] rows in %s; the first is kept" % (ident, FILE))
            continue
        folders = row.get("extra_folders") or []
        folders = folders if isinstance(folders, list) else [folders]
        rel = row.get("build_list")
        bad = [str(f) for f in folders if not _relative(f)] + ([str(rel)] if rel is not None and not _relative(rel) else [])
        if bad:
            problems.append("packages: host %s names %s, not repository-relative paths" % (ident, ", ".join(bad)))
        rows[ident] = {"id": ident, "extra_folders": [f.strip("/") for f in folders if _relative(f)],
                       "build_list": rel.strip("/") if _relative(rel) else None}
    return rows, problems


def build_state(package, listing):
    """{list, status, reason, tasks {task: state}, quarantined [{task, errors, measured_at}], unbuilt}
    of one package against its host's quarantine list (read_build_list output, None when the host
    names none). unbuilt is None when the list was not read as HEAD's."""
    state = {"list": (listing or {}).get("path"), "status": (listing or {}).get("status"), "reason": None,
             "tasks": {task: NOT_MEASURED for task in TASKS}, "quarantined": [], "unbuilt": None}
    if listing is None:
        return dict(state, reason="the host row names no quarantine list")
    if listing.get("status") != "ok":
        return dict(state, reason="%s %s%s" % (listing.get("path"), listing.get("status"),
                                               ": %s" % listing["reason"] if listing.get("reason") else ""))
    if listing.get("at_head") is not True:
        return dict(state, reason="the checkout has modified tracked files or an unknown state, so the list read "
                                  "may not be the one at HEAD")
    name = package.get("name")
    listed = {e["task"]: e for e in listing.get("entries") or [] if name and e["package"] == name}
    for task in TASKS:
        if task in listed:
            state["tasks"][task] = QUARANTINED
        elif package.get("workspace") and task in (package.get("scripts") or []):
            state["tasks"][task] = GATED
        else:
            state["tasks"][task] = NOT_RUN
    state["quarantined"] = [{"task": t, "errors": listed[t]["errors"], "measured_at": listed[t]["measured_at"]}
                            for t in TASKS if t in listed]
    state["unbuilt"] = any(state["tasks"][t] == QUARANTINED for t in UNBUILT_TASKS)
    return state


def _groups_of(host, subpath, groups):
    """The repo-subpath groups of the host whose member names hold this package's directory."""
    out = []
    for gid, group in sorted((groups or {}).items()):
        rule = group.get("member_rule") or {}
        if rule.get("kind") == "repo-subpath" and rule.get("repo") == host and subpath in (rule.get("names") or []):
            out.append(gid)
    return out


def records(host, read, listing, now_iso, groups=None):
    """The package records of one host from its read_packages output, joined with its quarantine list
    (build_state) and its repo-subpath groups. The capability field is set later
    (capability.resolve_packages)."""
    out = {}
    for subpath, package in sorted((read.get("packages") or {}).items()):
        pid = package_id(host, subpath)
        out[pid] = {
            "kind": "package", "id": pid, "host": host, "subpath": subpath, "name": package.get("name"),
            "manifest": package.get("manifest"), "workspace": package.get("workspace"),
            "scripts": list(package.get("scripts") or []), "measures": package.get("measures") or {},
            "deps": package.get("deps") or {}, "imports": package.get("imports") or {},
            "imported_by": list(package.get("imported_by") or []), "static": list(package.get("static") or []),
            "build": build_state(package, listing), "capability": None, "group_ids": _groups_of(host, subpath, groups),
            "at_commit": read.get("at_commit"), "commit_date": read.get("commit_date"), "at_head": read.get("at_head"),
            "presence": "present", "missing_since": None, "observed_at": now_iso}
    return out


def host_summary(host, read, listing, package_records, reason=None):
    """What the views say about one host in one build: whether its packages were read, at which
    commit, how many (workspace: the packages with a manifest that a workspace glob includes, as the
    host's own tooling counts them; folders: the module folders its row names), its static problems by
    code, and its quarantine list (status, entries, the entries naming no package of this read, and
    each measured_at's date and distance from HEAD)."""
    if read is None or read.get("status") != "ok":
        return {"id": host, "status": "unknown", "reason": reason or (read or {}).get("reason") or "not read",
                "packages": 0, "build_list": None}
    names = {r["name"] for r in package_records.values() if r.get("name")}
    entries = (listing or {}).get("entries") or []
    return {"id": host, "status": "read", "reason": None, "at_commit": read.get("at_commit"),
            "commit_date": read.get("commit_date"), "at_head": read.get("at_head"), "files": read.get("files"),
            "packages": len(package_records), "folders": sum(1 for r in package_records.values() if r.get("manifest") == FOLDER),
            "workspace": sum(1 for r in package_records.values() if r.get("workspace") and r.get("manifest") != FOLDER),
            "problems": dict(sorted(Counter(p["code"] for p in read.get("problems") or []).items())),
            "build_list": None if listing is None else {
                "path": listing.get("path"), "status": listing.get("status"), "reason": listing.get("reason"),
                "at_head": listing.get("at_head"), "entries": len(entries),
                "unmatched": sorted({e["package"] for e in entries} - names), "commits": listing.get("commits") or {},
                "problems": list(listing.get("problems") or [])}}
