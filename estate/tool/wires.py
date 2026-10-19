"""Wires: what connects the business's packages and repositories, carried on the relation record kind
(vocab/records.toml [kind.relation]) rather than a kind of their own.

Measured edges come from package records (tool/packages.py): a package whose non-test source imports
another package of its host is a depends_on relation of basis measured-import; one whose manifest only
declares it is a depends_on of basis measured-manifest. Curated wires are the [[wire]] rows of
curated/wires.toml: one end feeds the other over an event, an HTTP route or a file (or depends on it),
with anchors, each a repository-relative path and a text that every build re-finds in the tracked files
of that side's checkout (sources.find_anchors). An end is a package or project id (a group names no single
checkout to search); an end this run does not hold is allowed (a designed wire may name a package not built
yet): the wire is then shown and checked but gives no relation record.

Two fields, independent of each other. code_state is what the code shows:
  wired          both sides have non-test code for it, and no end package is build- or typecheck-quarantined
  wired-unbuilt  both sides have the code, and an end package is quarantined
  declared       no code consumes it yet (a manifest, a workflow or a document names it), or one side is
                 not built yet (nothing is tracked where its anchors point)
  contradicted   one side has the code and the other side's tracked code does not answer it
stage is how far it has been shown to work: designed; demonstrated only when the latest run on main of
the workflow the row names (demonstrated_by, in the repository of its consuming side) is read green by
`build --forge` (read_runs: one allowlisted, read-only gh call per workflow, for host repositories only);
accepted or active only with the owner decision the row names; unknown when the evidence a claimed stage
needs cannot be read. Neither says live: in the estate that word means observed up.

A curated row states a claim, the build measures it, and the verdict compares the two. check --wires
exits 1 when a curated wired claim has no consuming code (unevidenced), and 10 when another curated state
differs from measurement or could not be measured.
"""
import re
from collections import Counter

import packages
import sources

FILE = "curated/wires.toml"
CODE_STATES = ("wired", "wired-unbuilt", "declared", "contradicted")
STAGES = ("designed", "demonstrated", "accepted", "active", "unknown")
CHANNELS = ("event", "http", "file", "manual")
VERBS = ("feeds", "depends_on")
VERDICTS = ("agrees", "unevidenced", "differs", "not-measured")
NOT_MEASURED = "not-measured"
SIDES = ("from", "to")
WIRED = ("wired", "wired-unbuilt")
MEASURED_IMPORT, MEASURED_MANIFEST, CURATED = "measured-import", "measured-manifest", "curated"
# The keys a row may carry beyond its claim; they are shown, never measured.
META_KEYS = ("flow", "hop", "decision", "demonstrated_by", "evidence", "source", "reviewed", "as_of", "review_after")
_NAME = re.compile(r"[a-z0-9][a-z0-9-]*")


def consumer_side(verb):
    """The side whose code consumes a wire: the receiving end of feeds, the dependent end of depends_on."""
    return "to" if verb == "feeds" else "from"


def repo_of(end):
    """The project whose checkout holds an end's code: a package's host, a project itself; None for a
    group, which names no single checkout."""
    if end.startswith("pkg:"):
        return end[len("pkg:"):].split("//", 1)[0]
    return None if end.startswith("group:") else end


def _row_problems(row):
    problems = []
    if not isinstance(row.get("name"), str) or not _NAME.fullmatch(row["name"]):
        problems.append("needs a name of lowercase letters, digits and hyphens")
    for side in SIDES:
        if not isinstance(row.get(side), str) or not row[side]:
            problems.append("needs a %s end" % side)
        elif repo_of(row[side]) is None:
            problems.append("has a group at its %s end; anchors need a package or project end" % side)
    if row.get("verb") not in VERBS:
        problems.append("verb must be %s" % " or ".join(VERBS))
    channel = row.get("channel")
    if channel is not None and not (isinstance(channel, dict) and channel.get("kind") in CHANNELS
                                    and isinstance(channel.get("name"), str) and channel["name"]):
        problems.append("channel needs a kind (%s) and a name" % ", ".join(CHANNELS))
    anchors = row.get("anchors")
    if not isinstance(anchors, list) or not all(
            isinstance(a, dict) and a.get("side") in SIDES and packages._relative(a.get("path"))
            and isinstance(a.get("text"), str) and a["text"].strip() for a in anchors):
        problems.append("anchors must be a list of {side (from or to), path (repository-relative), text}")
    elif any(not any(a["side"] == side for a in anchors) for side in SIDES):
        problems.append("needs at least one anchor on each side")
    if row.get("code_state") not in CODE_STATES:
        problems.append("code_state must be one of %s" % ", ".join(CODE_STATES))
    stage = row.get("stage", "designed")
    if stage not in STAGES or stage == "unknown":
        problems.append("stage must be one of %s" % ", ".join(s for s in STAGES if s != "unknown"))
    if stage == "demonstrated" and not (isinstance(row.get("demonstrated_by"), str)
                                        and sources.WORKFLOW_FILE.fullmatch(row["demonstrated_by"])):
        problems.append("a demonstrated stage needs demonstrated_by, the workflow file whose runs on main show it")
    if stage in ("accepted", "active") and not isinstance(row.get("decision"), str):
        problems.append("an accepted or active stage needs the owner decision that gives it")
    if row.get("flow") is not None and not (isinstance(row["flow"], str) and _NAME.fullmatch(row["flow"])):
        problems.append("flow must be a name of lowercase letters, digits and hyphens")
    if row.get("hop") is not None and not (type(row["hop"]) is int and row["hop"] >= 1):
        problems.append("hop must be a whole number from 1")
    return problems


def rows(curated):
    """({name: row}, problems): the [[wire]] rows of curated/wires.toml, each checked. A row of the wrong
    shape is named and left out, never half kept; stage defaults to designed."""
    out, problems = {}, []
    for index, row in enumerate((curated or {}).get("wires") or []):
        name = row.get("name") if isinstance(row, dict) else None
        where = "wire %s" % (name if isinstance(name, str) else "#%d" % (index + 1))
        found = _row_problems(row) if isinstance(row, dict) else ["is not a table"]
        if not found and name in out:
            found = ["is named twice; the first is kept"]
        if found:
            problems += ["wires: %s in %s %s" % (where, FILE, item) for item in found]
            continue
        entry = {"name": name, "from": row["from"], "verb": row["verb"], "to": row["to"],
                 "channel": dict(row["channel"]) if row.get("channel") else None,
                 "anchors": [{"side": a["side"], "path": a["path"].strip("/"), "text": a["text"]} for a in row["anchors"]],
                 "code_state": row["code_state"], "stage": row.get("stage", "designed")}
        entry.update({k: row[k] for k in META_KEYS if row.get(k) is not None})
        out[name] = entry
    return out, problems


def anchors_by_repo(wire_rows):
    """{project id: [{path, text}]}: what each checkout must be searched for, every anchor once."""
    out = {}
    for row in wire_rows.values():
        for anchor in row["anchors"]:
            wanted = out.setdefault(repo_of(row[anchor["side"]]), [])
            item = {"path": anchor["path"], "text": anchor["text"]}
            if item not in wanted:
                wanted.append(item)
    return out


def sides(row, found_by_repo):
    """{side: [anchor with found and files]} of one row; found is None when that side's checkout was not
    searched (found_by_repo: {project id: {(path, text): find_anchors result}})."""
    out = {side: [] for side in SIDES}
    for anchor in row["anchors"]:
        seen = found_by_repo.get(repo_of(row[anchor["side"]]))
        hit = seen.get((anchor["path"], anchor["text"])) if seen is not None else None
        out[anchor["side"]].append(dict(anchor, found=(hit or {}).get("found"), files=list((hit or {}).get("files") or [])))
    return out


def measure(row, found, unbuilt):
    """(code_state, reason) of one curated row from its re-found anchors (found: sides()) and the build
    state of its end packages (unbuilt: {package id: True, False or None} for the ends this run holds as
    packages). None when what decides it could not be read."""
    if any(a["found"] is None for side in SIDES for a in found[side]):
        return None, "a side's checkout was not searched in this run"
    code = {side: all(a["found"] == "code" for a in found[side]) for side in SIDES}
    present = {side: any(a["found"] != "absent" for a in found[side]) for side in SIDES}
    unread = {side: any(a["found"] == "unread" for a in found[side]) for side in SIDES}
    if code["from"] and code["to"]:
        states = [unbuilt[row[side]] for side in SIDES if row[side] in unbuilt]
        if True in states:
            return "wired-unbuilt", "both sides have the code; an end package is build- or typecheck-quarantined"
        if None in states:
            return None, "both sides have the code; an end package's build state was not measured"
        return "wired", "both sides have the code; no end package is quarantined"
    for one, other in (("from", "to"), ("to", "from")):
        if code[one] and present[other]:
            if unread[other]:
                return None, "the %s side has the code; a file of the %s side could not be read" % (one, other)
            return "contradicted", "the %s side has the code and the %s side's tracked code does not answer it" % (
                one, other)
    consumer = consumer_side(row["verb"])
    if unread[consumer]:
        return None, "a file of the consuming (%s) side could not be read" % consumer
    if code[consumer]:
        return "declared", "the consuming side has the code; nothing is tracked yet where the other side's anchors point"
    return "declared", "no code consumes it yet"


def workflow_repo(row):
    """The repository whose workflow runs can demonstrate a row: the one holding its consuming side."""
    return repo_of(row[consumer_side(row["verb"])])


def run_key(repo, workflow):
    return "%s|%s" % (repo, workflow)


def read_runs(wire_rows, hosts, allow_network=False, transport=None):
    """build --forge: the latest run on main of each workflow a row claiming demonstrated names, in
    the repository of its consuming side (sources.workflow_runs: one read-only gh call per workflow).
    Only host repositories (a [[host]] row) are read; another repository is refused without a call.
    None without allow_network, so every demonstrated claim reads unknown."""
    if allow_network is not True:
        return None
    wanted, refused = [], {}
    for row in wire_rows.values():
        if row["stage"] != "demonstrated":
            continue
        repo, workflow = workflow_repo(row), row["demonstrated_by"]
        if repo in (hosts or {}):
            wanted.append((repo, workflow))
        else:
            refused[run_key(repo, workflow)] = {"status": "refused", "run": None,
                                                "reason": "%s is not a host repository ([[host]] row)" % repo}
    out = sources.workflow_runs(sorted(set(wanted)), allow_network=True, transport=transport)
    out["runs"].update(refused)
    if refused:
        out["status"] = "partial"
    return out


def _run_text(run):
    return "run %s of %s at %s" % (run["id"], run["created_at"], run["head_sha"][:12])


def stage_of(row, decision_ids, runs=None):
    """(stage, reason, run): designed as claimed; demonstrated when the latest run on main of the workflow
    the row names was read (runs: read_runs) and is green, designed when it was read red or there is no run
    on main, unknown when it was not read or is still running; accepted or active as claimed only when
    the owner decision the row names is in the curation, else unknown. run: the run read, if any."""
    claimed = row["stage"]
    if claimed == "designed":
        return "designed", None, None
    if claimed == "demonstrated":
        workflow = row.get("demonstrated_by")
        if runs is None:
            return "unknown", "the latest run of %s on main was not read (build --forge reads it)" % workflow, None
        item = (runs.get("runs") or {}).get(run_key(workflow_repo(row), workflow))
        if item is None or item.get("status") not in ("read", "none"):
            return "unknown", "the latest run of %s on main could not be read: %s" % (
                workflow, (item or {}).get("reason") or "not requested"), None
        if item["status"] == "none":
            return "designed", "%s has no run on main" % workflow, None
        run = item["run"]
        if run["status"] != "completed":
            return "unknown", "the latest run of %s on main, %s, is %s" % (workflow, _run_text(run), run["status"]), run
        if run["conclusion"] == "success":
            return "demonstrated", "the latest run of %s on main, %s, is green" % (workflow, _run_text(run)), run
        return "designed", "the latest run of %s on main, %s, concluded %s" % (
            workflow, _run_text(run), run["conclusion"] or "without a conclusion"), run
    if row.get("decision") in decision_ids:
        return claimed, "owner decision %s" % row["decision"], None
    return "unknown", "the owner decision %s is not in the curation" % row.get("decision"), None


def verdict_of(row, code_state, found, stage):
    """agrees, unevidenced (a curated wired claim whose consuming side has no code), differs (a claimed
    state measurement disagrees with) or not-measured (what decides it could not be read)."""
    consumer = found[consumer_side(row["verb"])]
    searched = all(a["found"] not in (None, "unread") for a in consumer)
    if row["code_state"] in WIRED and searched and not all(a["found"] == "code" for a in consumer):
        return "unevidenced"
    if code_state is not None and code_state != row["code_state"]:
        return "differs"
    if code_state is None or stage == "unknown":
        return NOT_MEASURED
    return "differs" if stage != row["stage"] else "agrees"


def evaluate(row, found_by_repo, unbuilt, decision_ids, runs=None):
    """One curated row measured: its claim beside the measured code_state and stage (and the workflow run
    read for it), the verdict, and every anchor with what this run found."""
    found = sides(row, found_by_repo)
    code_state, reason = measure(row, found, unbuilt)
    stage, stage_reason, run = stage_of(row, decision_ids, runs)
    out = {k: row[k] for k in ("name", "from", "verb", "to", "channel")}
    out.update({"claimed": {"code_state": row["code_state"], "stage": row["stage"]}, "code_state": code_state,
                "reason": reason, "stage": stage, "stage_reason": stage_reason, "run": run,
                "verdict": verdict_of(row, code_state, found, stage),
                "anchors": [a for side in SIDES for a in found[side]]})
    out.update({k: row[k] for k in META_KEYS if k in row})
    return out


def measured_edges(package_records):
    """The depends_on edges between the packages of one host: measured-import where non-test source
    imports the other package (also measured-manifest when the manifest declares it), measured-manifest
    alone where only the manifest does. code_state: wired or wired-unbuilt for an import (by the two
    packages' build state; None when it was not measured), declared for a declaration only."""
    by_name = {}
    for record in package_records.values():
        if record.get("name"):
            by_name.setdefault((record["host"], record["name"]), []).append(record["id"])
    out = []
    for pid in sorted(package_records):
        record = package_records[pid]
        imported = set((record.get("imports") or {}).get("internal") or [])
        declared = set((record.get("deps") or {}).get("declared_internal") or [])
        for name in sorted(imported | declared):
            for target in sorted(by_name.get((record["host"], name)) or []):
                if target == pid:
                    continue
                if name in imported:
                    states = [(package_records[x].get("build") or {}).get("unbuilt") for x in (pid, target)]
                    state = "wired-unbuilt" if True in states else (None if None in states else "wired")
                    out.append({"from": pid, "to": target, "basis": MEASURED_IMPORT, "code_state": state,
                                "also": [MEASURED_MANIFEST] if name in declared else []})
                else:
                    out.append({"from": pid, "to": target, "basis": MEASURED_MANIFEST, "code_state": "declared",
                                "also": []})
    return out


def flows(evaluated):
    """{flow: {hops: [names in hop order], code_state: the worst measured hop, stage: the least stage}}.
    A hop not measured makes the flow's code_state None."""
    order = {state: i for i, state in enumerate(("contradicted", "declared", "wired-unbuilt", "wired"))}
    out = {}
    for row in sorted(evaluated, key=lambda r: (r.get("hop") or 0, r["name"])):
        if row.get("flow"):
            out.setdefault(row["flow"], []).append(row)
    summary = {}
    for flow, hops in out.items():
        states = [h["code_state"] for h in hops]
        stages = [h["stage"] for h in hops]
        summary[flow] = {"hops": [h["name"] for h in hops],
                         "code_state": None if None in states else min(states, key=order.get),
                         "stage": "unknown" if "unknown" in stages else min(stages, key=STAGES.index)}
    return summary


def summary(evaluated, edges, problems, runs=None):
    """What the views and check --wires say about wires in one build; runs: what read_runs read (None
    when the build did not ask the forge)."""
    return {"rows": evaluated, "flows": flows(evaluated),
            "runs": None if runs is None else {"status": runs.get("status"), "runs": {
                key: {k: item.get(k) for k in ("status", "reason", "run")} for key, item in sorted(
                    (runs.get("runs") or {}).items())}},
            "verdicts": dict(sorted(Counter(r["verdict"] for r in evaluated).items())),
            "measured": {basis: dict(sorted(Counter(e["code_state"] or NOT_MEASURED for e in edges
                                                    if e["basis"] == basis).items()))
                         for basis in (MEASURED_IMPORT, MEASURED_MANIFEST)},
            "problems": list(problems)}


def _claim_key(row):
    return (row["from"], row["verb"], row["to"], row.get("channel"), row["code_state"] if "code_state" in row else None,
            row.get("stage"), row.get("demonstrated_by"), row.get("decision"),
            [(a["side"], a["path"], a["text"]) for a in row.get("anchors") or []])


def check(run_summary, current, problems):
    """(exit code, lines) of check --wires over the current run's wires (summary()) and the rows of
    curated/wires.toml as they are now: 1 when a curated wired claim has no consuming code; 10 when a
    claim differs from measurement, could not be measured, a row is invalid, or a row was added or changed
    after the build (the run did not measure it); else 0."""
    measured = {r["name"]: r for r in (run_summary or {}).get("rows") or []}
    lines, stale, verdicts = [], [], Counter()
    for name in sorted(set(current) | set(measured)):
        row, seen = current.get(name), measured.get(name)
        if seen is None:
            stale.append("%s is not in the current run (added after the build; rebuild)" % name)
            continue
        if row is None:
            stale.append("%s is in the current run but no longer in %s (rebuild)" % (name, FILE))
            continue
        then = dict(seen, code_state=seen["claimed"]["code_state"], stage=seen["claimed"]["stage"])
        if _claim_key(row) != _claim_key(then):
            stale.append("%s changed after the build; the run measured the old row (rebuild)" % name)
            continue
        verdicts[seen["verdict"]] += 1
        lines.append("  %-12s %s: claimed %s, %s; measured %s, %s%s" % (
            seen["verdict"], name, seen["claimed"]["code_state"], seen["claimed"]["stage"], seen["code_state"] or "not measured",
            seen["stage"], " (%s)" % "; ".join(r for r in (seen.get("reason"), seen.get("stage_reason")) if r)
            if seen["verdict"] != "agrees" else ""))
    head = "check --wires: %d curated wires: %s" % (len(current), ", ".join(
        "%s %d" % (v, verdicts[v]) for v in VERDICTS if verdicts[v]) or "none measured")
    lines = [head] + lines + ["  stale: %s" % item for item in stale] + ["  problem: %s" % p for p in problems]
    if verdicts["unevidenced"]:
        code = 1
    elif verdicts["differs"] or verdicts[NOT_MEASURED] or stale or problems:
        code = 10
    else:
        code = 0
    return code, lines + ["  exit %d" % code]
