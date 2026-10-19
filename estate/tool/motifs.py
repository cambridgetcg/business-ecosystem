"""Motifs: the design patterns the business's code repeats, and whether that code reuses the shared library
that embodies each one. A view over package records and their import edges, not a record kind.

A motif is a [[motif]] row of curated/motifs.toml: a name, the pattern in one sentence, the shared libraries
that embody it (package ids, pkg:<forge id>//<subpath>; none for a pattern no library carries) and also_in
anchors, each a package or project id, a repository-relative path and a text that every build re-finds in
that side's canonical checkout as it re-finds wire anchors (sources.find_anchors): where code does the same
by hand. Its users are measured: the packages whose non-test source imports one of its libraries (the
measured-import edges of wires.measured_edges), the motif's own libraries left out. A package whose
manifest only declares a library is listed apart and is not a user.

state is what this build measured:
  adopted        a package imports one of its libraries
  reimplemented  no package imports them, and a curated anchor is found as code elsewhere
  unused         no package imports them, and no curated anchor is found as code
  no-library     no shared library embodies it; its anchors show where code does it
  not-measured   no package imports the libraries that were read, and what would decide the state could not
                 be read (a library's host was not read, an anchor was not searched or a file was unreadable)
Positive evidence decides first: one importer is adoption even when another library of the motif was not
read, and one anchor found as code is a reimplementation even when another could not be read. A library
that is no package of its host's checkout, or an anchor not found as code any more, is stale: QUEUE lists it
(motif-stale), so the row is corrected rather than believed. Rows are hand-edited and read reviewed = false
until Yu reviews them; they hold only forge ids, package ids, repository-relative anchors and short evidence.
"""
from collections import Counter

import sources
import wires

FILE = "curated/motifs.toml"
STATES = ("adopted", "reimplemented", "unused", "no-library", "not-measured")
ADOPTED, REIMPLEMENTED, UNUSED, NO_LIBRARY, NOT_MEASURED = STATES
# The keys a row may carry beyond what is measured; they are shown, never measured.
META_KEYS = ("evidence", "source", "reviewed", "as_of", "review_after")


def _row_problems(row):
    problems = []
    if not isinstance(row.get("name"), str) or not wires.NAME.fullmatch(row["name"]):
        problems.append("needs a name of lowercase letters, digits and hyphens")
    if not isinstance(row.get("pattern"), str) or not row["pattern"].strip():
        problems.append("needs the pattern in a sentence")
    libraries = row.get("libraries", [])
    if not isinstance(libraries, list) or not all(isinstance(lib, str) and lib.startswith("pkg:") and "//" in lib
                                                  for lib in libraries):
        problems.append("libraries must be a list of package ids (pkg:<forge id>//<subpath>)")
    anchors = row.get("also_in", [])
    if not isinstance(anchors, list) or not all(
            isinstance(a, dict) and isinstance(a.get("in"), str) and wires.repo_of(a["in"]) is not None
            and sources.repo_relative(a.get("path")) and isinstance(a.get("text"), str) and a["text"].strip()
            for a in anchors):
        problems.append("also_in must be a list of {in (a package or project id), path (repository-relative), text}")
    if not problems and not libraries and not anchors:
        problems.append("needs a library or an also_in anchor")
    return problems


def rows(curated):
    """({name: row}, problems): the [[motif]] rows of curated/motifs.toml, each checked. A row of the wrong
    shape is named and left out, never half kept."""
    out, problems = {}, []
    for index, row in enumerate((curated or {}).get("motifs") or []):
        name = row.get("name") if isinstance(row, dict) else None
        where = "motif %s" % (name if isinstance(name, str) else "#%d" % (index + 1))
        found = _row_problems(row) if isinstance(row, dict) else ["is not a table"]
        if not found and name in out:
            found = ["is named twice; the first is kept"]
        if found:
            problems += ["motifs: %s in %s %s" % (where, FILE, item) for item in found]
            continue
        entry = {"name": name, "pattern": row["pattern"].strip(), "libraries": list(row.get("libraries") or []),
                 "also_in": [{"in": a["in"], "path": a["path"].strip("/"), "text": a["text"]}
                             for a in row.get("also_in") or []]}
        entry.update({k: row[k] for k in META_KEYS if row.get(k) is not None})
        out[name] = entry
    return out, problems


def anchors_by_repo(motif_rows, wanted=None):
    """{project id: [{path, text}]}: wanted (wires.anchors_by_repo, so each checkout is searched once for
    wires and motifs) with the also_in anchors of every motif added, every anchor once."""
    out = {repo: list(items) for repo, items in (wanted or {}).items()}
    for row in motif_rows.values():
        for anchor in row["also_in"]:
            items = out.setdefault(wires.repo_of(anchor["in"]), [])
            item = {"path": anchor["path"], "text": anchor["text"]}
            if item not in items:
                items.append(item)
    return out


def _library(lib, own, package_records, edges, hosts):
    """One library of a motif: its importers (users) and its declared-only dependants, or why it was not
    measured (stale: the library is no package of a host that was read)."""
    entry = {"id": lib, "name": None, "measured": False, "reason": None, "stale": False, "users": [], "declared": [],
             "unbuilt_users": 0}
    record = package_records.get(lib)
    if record is None:
        host = wires.repo_of(lib)
        summary = (hosts or {}).get(host) or {}
        if summary.get("status") == "read":
            entry.update(stale=True, reason="not a package of %s at %s" % (
                host, (summary.get("at_commit") or "an unknown commit")[:12]))
        else:
            entry["reason"] = "its host %s was not read for packages in this run" % host
        return entry
    to_lib = [e for e in edges if e["to"] == lib and e["from"] not in own]
    users = sorted({e["from"] for e in to_lib if e["basis"] == wires.MEASURED_IMPORT})
    entry.update(name=record.get("name"), measured=True, users=users,
                 declared=sorted({e["from"] for e in to_lib if e["basis"] == wires.MEASURED_MANIFEST}),
                 unbuilt_users=sum(1 for u in users if ((package_records.get(u) or {}).get("build") or {}).get("unbuilt")))
    return entry


def _plural(n, one, many=None):
    return "%d %s" % (n, one if n == 1 else (many or one + "s"))


def evaluate(row, package_records, edges, found_by_repo, hosts=None):
    """One motif measured: each library with its users, each also_in anchor with what this build found, the
    state and why, and the stale lines. package_records: this run's package records; edges:
    wires.measured_edges(package_records); found_by_repo: {project id: {(path, text): find_anchors result}};
    hosts: {host id: packages.host_summary}, to tell a library that is gone from one whose host was not read."""
    own = set(row["libraries"])
    libraries = [_library(lib, own, package_records, edges, hosts) for lib in row["libraries"]]
    anchors = []
    for anchor in row["also_in"]:
        seen = found_by_repo.get(wires.repo_of(anchor["in"]))
        hit = seen.get((anchor["path"], anchor["text"])) if seen is not None else None
        anchors.append(dict(anchor, found=(hit or {}).get("found"), files=list((hit or {}).get("files") or [])))
    stale = ["library %s is %s" % (lib["id"], lib["reason"]) for lib in libraries if lib["stale"]]
    stale += ["also_in %s: %r under %s is found %s, not code" % (a["in"], a["text"], a["path"], a["found"])
              for a in anchors if a["found"] not in (None, "code", "unread")]
    users = sorted({u for lib in libraries for u in lib["users"]})
    by_hand = [a for a in anchors if a["found"] == "code"]
    unsure = [a for a in anchors if a["found"] in (None, "unread")]
    unread = [lib for lib in libraries if not lib["measured"]]
    names = ", ".join(lib["id"].split("//", 1)[-1] for lib in libraries)
    if not libraries:
        state, reason = NO_LIBRARY, "no shared library embodies it; %d of %s found as code" % (
            len(by_hand), _plural(len(anchors), "curated anchor"))
    elif users:
        state, reason = ADOPTED, "%s import%s %s in non-test source" % (
            _plural(len(users), "package"), "s" if len(users) == 1 else "", ", ".join(
                "%s (%d)" % (lib["id"].split("//", 1)[-1], len(lib["users"])) for lib in libraries if lib["users"]))
    elif unread:
        state, reason = NOT_MEASURED, "no package imports the libraries read; %s" % "; ".join(
            "%s: %s" % (lib["id"].split("//", 1)[-1], lib["reason"]) for lib in unread)
    elif by_hand:
        state, reason = REIMPLEMENTED, "no package imports %s; %d of %s found as code elsewhere" % (
            names, len(by_hand), _plural(len(anchors), "curated anchor"))
    elif unsure:
        state, reason = NOT_MEASURED, "no package imports %s; %s could not be searched or read" % (
            names, _plural(len(unsure), "curated anchor"))
    else:
        state, reason = UNUSED, "no package imports %s, and %s" % (
            names, "no curated anchor is found as code elsewhere" if anchors else "no curated anchor shows it done elsewhere")
    out = {"name": row["name"], "pattern": row["pattern"], "libraries": libraries, "users": users, "anchors": anchors,
           "state": state, "reason": reason, "stale": stale}
    out.update({k: row[k] for k in META_KEYS if k in row})
    return out


def queue_items(evaluated):
    """QUEUE motif-stale: a library that is no package of its host's checkout, or an anchor no longer found
    as code."""
    return [{"reason": "motif-stale", "id": m["name"], "detail": line} for m in evaluated for line in m["stale"]]


def summary(evaluated, problems):
    """What the views, run.json and estate capability say about motifs in one build."""
    return {"rows": evaluated, "states": dict(Counter(m["state"] for m in evaluated)),
            "stale": sum(len(m["stale"]) for m in evaluated), "problems": list(problems)}


def states_text(states):
    """{state: count} in the vocabulary's order, as the views say it (run.json keeps keys sorted)."""
    return ", ".join("%s %d" % (state, states[state]) for state in STATES if (states or {}).get(state)) or "none"


def library_text(lib, short=lambda ident: ident.split("//", 1)[-1]):
    """One library of a motif in a few words: its users and declared-only dependants, or why not measured."""
    if not lib.get("measured"):
        return "%s: not measured (%s)" % (short(lib["id"]), lib.get("reason") or "unknown")
    return "%s: imported by %d%s, declared only by %d" % (
        short(lib["id"]), len(lib.get("users") or []),
        " (%d build- or typecheck-quarantined)" % lib["unbuilt_users"] if lib.get("unbuilt_users") else "",
        len(lib.get("declared") or []))
