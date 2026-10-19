"""The business capability map: what the business has code for, or does by hand, per project.

The vocabulary is vocab/facets.toml [business.capability]: 23 values in four bands (sell, grow,
run, own-funds). The run band is exactly the eleven be.framework_domain ids, so business-ecosystem's
own domain packages join it by name. The map is a display field of the Business view, not a
navigation facet: making it one is an owner decision the estate does not take for itself.

Each value carries impl (code, code-unbuilt, stub, manual or unread), an operating claim (in-use,
paused, retired, never or unknown; dated, reviewed = false until Yu reviews it) and serves (self,
customers or both). A capability that is only documented or designed is listed under designed and
never as a value; an idea is never a value. A project in business scope that nothing places is
unassigned, never assumed to have no capability.

business_scope() is the one business population: the Business section of the atlas and this map
both use it, so one atlas never shows two different business populations.

Whole repositories are curated: one [[capability]] row per project in curated/capabilities.toml,
keyed by forge id, written by `estate capability --import` (reviewed = false until Yu reviews it),
with local ids and the full evidence of every row in private/curated/capability.toml. The import
merges by id and keeps every row Yu has reviewed, and keeps the file's [[host]] rows as they are.

The packages of a host repository (a [[host]] row; tool/packages.py) get their values from code: a
package takes its curated row (a [[capability]] row keyed by its package id), else the run-band value
its directory names (rule:package-path: business-ecosystem's domain packages are named after their
framework domain), else none, and its impl is measured. A host project with no curated row of its own
takes the union of its packages that have code (derived:packages).
"""
import datetime as dt
import json
import os
import tomllib
from collections import Counter

import curate
import safety
import sphere
from safety import GuardError, require

UNASSIGNED, NONE = "unassigned", "none"
CURATED_PROJECT, DERIVED_PACKAGES, MIRROR = "curated:project", "derived:packages", "mirror"
CURATED_PACKAGE, PACKAGE_PATH = "curated:package", "rule:package-path"
SET = "set"
# A host project holding a value through several packages reads the first of their impls in this
# order: one package with compiled code is enough for code.
IMPL_ORDER = ("code", "code-unbuilt", "stub", "manual", "unread")
# Readings a curated package row may state; the other impls of a package are measured.
CURATED_IMPL = ("stub", "manual")
COMMITTED_FILE = "curated/capabilities.toml"
PRIVATE_FILE = "curated/capability.toml"
# The per-value maps of a row and the value each takes when a row does not name it.
FIELDS = ("impl", "operating", "serves")
DEFAULTS = {"impl": "code", "operating": "unknown", "serves": "self"}
FIELD_VOCABULARY = {"impl": "capability_impl", "operating": "capability_operating", "serves": "capability_serves"}
META_KEYS = ("confidence", "evidence", "source", "reviewed", "as_of", "review_after")
CONFIDENCE = ("high", "medium", "low")
SHORT_MAX = 300
REVIEW_DAYS = 90
COMMITTED_HEADER = (
    "# The business capability map (vocab/facets.toml [business.capability]): one [[capability]] row per\n"
    "# project, keyed by forge id, or per package, keyed by its package id (pkg:<forge id>//<subpath>), and\n"
    "# one [[host]] row per repository whose packages are read (tool/packages.py). Written by\n"
    "# `estate capability --import ABS_PATH --write`, which merges rows by id, keeps every row with\n"
    "# reviewed = true and the [[host]] rows as they are, and renders this file anew (comments other than\n"
    "# this header are not kept). impl, operating and serves name values whose reading a row states; the\n"
    "# others read impl code (a package's impl is measured), operating unknown, serves self. operating is a\n"
    "# claim as of the row's as_of. A row with no values says the project has no business capability.\n"
    "# Local ids and the full evidence of every row live in private/curated/capability.toml.\n\n")
PRIVATE_HEADER = ("# Capability rows behind the business capability map: local ids and the full evidence of every\n"
                  "# row. Private; one copy only. Written by `estate capability --import PATH --write`.\n\n")
# Business scope (vocab/facets.toml [business.capability].rule). The layers and the purpose groups
# are the Business section's earlier scope; the families, the role and the KINGDOM kind are the
# 2026-10-18 business inventory's. The scope is their union, so neither population shrinks.
BUSINESS_LAYERS = ("commerce", "economy")
BUSINESS_GROUPS = ("business_operations", "payments_finance", "commerce_marketplaces")
BUSINESS_FAMILIES = ("commerce-tcg", "commerce-ventures", "economy-ventures", "business-ecosystem")
BUSINESS_ROLES = ("revenue",)
BUSINESS_KINDS = ("venture",)


def _table(facets):
    return ((facets or {}).get("business") or {}).get("capability") or {}


def values(facets):
    """The capability values vocab/facets.toml defines, in its order (empty when absent)."""
    return tuple(_table(facets).get("values") or {})


def bands(facets):
    """{band: [values]} in the order vocab/facets.toml lists them."""
    return {band: list(members) for band, members in (_table(facets).get("bands") or {}).items()}


def vocabulary(facets, name):
    """The values of one companion vocabulary (capability_impl, capability_operating or
    capability_serves), in order."""
    return tuple((((facets or {}).get("vocab") or {}).get(name) or {}).get("values") or {})


def band_of(facets):
    """{value: band}."""
    return {value: band for band, members in bands(facets).items() for value in members}


# ── the one business population ─────────────────────────────────────────────────────────────

def _candidates(facet):
    """Every value a facet could take: its value, or each candidate of a contested facet. This is
    model.contested_values; model imports this module, so it is restated here, not imported."""
    if facet.get("value") is not None:
        return [facet["value"]]
    if facet.get("status") == "contested":
        return sorted({c["value"] for c in facet.get("candidates") or [] if c.get("value") is not None})
    return []


def business_scope(project):
    """Why a project is in business scope, one reason per rule it meets ([] when it is out of
    scope): its KINGDOM layer (each candidate of a contested layer), its purpose group, its family,
    its roles, its KINGDOM kind."""
    facets = project.get("facets") or {}
    reasons = ["layer " + v for v in _candidates(facets.get("layer") or {}) if v in BUSINESS_LAYERS]
    group = (project.get("display") or {}).get("purpose_group")
    if group in BUSINESS_GROUPS:
        reasons.append("purpose group " + group)
    family = (facets.get("family") or {}).get("value")
    if family in BUSINESS_FAMILIES:
        reasons.append("family " + family)
    reasons += ["role " + v for v in (facets.get("role") or {}).get("values") or [] if v in BUSINESS_ROLES]
    reasons += ["kind " + v for v in _candidates(facets.get("kind") or {}) if v in BUSINESS_KINDS]
    return reasons


def scope_rule():
    """The business scope in one line, for the views."""
    return ("KINGDOM layer %s; purpose group %s; family %s; role %s; KINGDOM kind %s" % (
        " or ".join(BUSINESS_LAYERS), ", ".join(BUSINESS_GROUPS), ", ".join(BUSINESS_FAMILIES),
        " or ".join(BUSINESS_ROLES), " or ".join(BUSINESS_KINDS)))


# ── the curated rows ────────────────────────────────────────────────────────────────────────

def _vocab(facets):
    out = {"values": values(facets)}
    out.update({field: vocabulary(facets, name) for field, name in FIELD_VOCABULARY.items()})
    return out


def check_row(row, voc, where):
    """(entry, problems) for one capability row. What lies outside the vocabulary is dropped and
    named, never kept, so every record still validates: an unknown value, a map entry for a value
    the row does not hold or with an unknown reading, a designed value that is also a value."""
    ident = row.get("id") if isinstance(row, dict) else None
    if not isinstance(ident, str) or not ident:
        return None, ["capability: a row in %s has no id or is not a table" % where]
    problems = []
    given = row.get("values")
    if not isinstance(given, list):
        problems.append("capability: %s in %s has no values list" % (ident, where))
        given = []
    unknown = [v for v in given if v not in voc["values"]]
    if unknown:
        problems.append("capability: %s in %s names %s, not capability values" % (ident, where, ", ".join(map(str, unknown))))
    held = [v for v in voc["values"] if v in given]
    stated = {}
    for field in FIELDS:
        table = row.get(field) or {}
        if not isinstance(table, dict):
            problems.append("capability: %s in %s: %s must be a table" % (ident, where, field))
            table = {}
        for value, reading in table.items():
            if value not in held:
                problems.append("capability: %s in %s: %s names %s, which is not one of its values"
                                % (ident, where, field, value))
            elif reading not in voc[field]:
                problems.append("capability: %s in %s: %s %s is %r, not a %s value"
                                % (ident, where, field, value, reading, FIELD_VOCABULARY[field]))
            else:
                stated.setdefault(field, {})[value] = reading
    designed = row.get("designed") or []
    if not isinstance(designed, list):
        problems.append("capability: %s in %s: designed must be a list" % (ident, where))
        designed = []
    wrong = [v for v in designed if v not in voc["values"] or v in held]
    if wrong:
        problems.append("capability: %s in %s: designed names %s, not capability values it does not hold"
                        % (ident, where, ", ".join(map(str, wrong))))
    if row.get("confidence") is not None and row["confidence"] not in CONFIDENCE:
        problems.append("capability: %s in %s: confidence %r is not one of %s" % (ident, where, row["confidence"],
                                                                                  ", ".join(CONFIDENCE)))
    entry = {"id": ident, "values": held, "stated": stated,
             "by_value": {v: {f: stated.get(f, {}).get(v, DEFAULTS[f]) for f in FIELDS} for v in held},
             "designed": [v for v in voc["values"] if v in designed and v not in held], "where": where}
    entry.update({k: row[k] for k in META_KEYS if row.get(k) is not None})
    return entry, problems


def curated_index(curated, facets):
    """(rows {id: entry}, problems) of every curated capability row. Committed rows decide; a
    private row adds the full evidence (evidence_full) and is itself the row only for an id nothing
    committed names (a local id)."""
    voc = _vocab(facets)
    rows, problems = {}, []
    for row in curated.get("capabilities") or []:
        entry, found = check_row(row, voc, COMMITTED_FILE)
        problems += found
        if entry is None:
            continue
        if entry["id"] in rows:
            problems.append("capability: %s has two rows in %s; the first is kept" % (entry["id"], COMMITTED_FILE))
            continue
        rows[entry["id"]] = entry
    for row in ((curated.get("private") or {}).get("capability") or {}).get("capability") or []:
        if not isinstance(row, dict):
            problems.append("capability: a row in private/%s has no id or is not a table" % PRIVATE_FILE)
            continue
        ident = row.get("id")
        if ident in rows:
            if row.get("evidence"):
                rows[ident]["evidence_full"] = row["evidence"]
            continue
        if "values" not in row:
            continue  # the evidence of a committed row that is no longer there: kept, not a row
        entry, found = check_row(row, voc, "private/" + PRIVATE_FILE)
        problems += found
        if entry is not None:
            rows[entry["id"]] = entry
    return rows, problems


# ── resolution ──────────────────────────────────────────────────────────────────────────────

def facet(values_, status, basis, src=None, at=None, **extra):
    """The capability display field: the common multi-valued facet shape plus capability_extra
    (vocab/records.toml); extras that are None are left out."""
    out = {"values": list(values_), "status": status, "basis": basis, "src": src, "at": at, "alt": []}
    out.update({k: v for k, v in extra.items() if v is not None})
    return out


def _unplaced(scope):
    if scope:
        return facet([], UNASSIGNED, NONE, scope=scope, by_value={}, designed=[],
                     reason="in business scope (%s), and no curated row or package names a capability"
                            % "; ".join(scope))
    return facet([], NONE, NONE, scope=[], by_value={}, designed=[], reason="outside business scope")


def _curated(entry, scope, via):
    # evidence: the committed short text (a private-only row has only its full text);
    # evidence_full: the private text when there is more of it.
    short = entry.get("evidence") or entry.get("evidence_full")
    full = entry.get("evidence_full")
    return facet(entry["values"], SET if entry["values"] else NONE, CURATED_PROJECT, "src:curated", entry.get("as_of"),
                 via=via, scope=scope, by_value=entry["by_value"], designed=entry["designed"],
                 confidence=entry.get("confidence"), reviewed=entry.get("reviewed"),
                 review_after=entry.get("review_after"), source=entry.get("source"), evidence=short,
                 evidence_full=full if full and full != short else None,
                 reason=None if entry["values"] else "a curated row says it has no business capability")


def _derived(found, scope, designed=()):
    """found: {value: {impl, via}} from the project's packages that have code; designed: the values
    its packages only document."""
    held = sorted(found)
    return facet(held, SET, DERIVED_PACKAGES, "src:packages", None, scope=scope,
                 designed=[v for v in designed if v not in found],
                 by_value={v: {"impl": found[v].get("impl") or DEFAULTS["impl"], "operating": DEFAULTS["operating"],
                               "serves": DEFAULTS["serves"], "via": found[v].get("via")} for v in held})


def _package_impl(record):
    """The measured impl of a package: code-unbuilt when its build or typecheck is quarantined at the
    checkout's HEAD (packages.build_state), code when it has readable source, unread when its only
    source is files the reader may not open, None when it has no source at all."""
    measures = record.get("measures") or {}
    if measures.get("src_files"):
        return "code-unbuilt" if (record.get("build") or {}).get("unbuilt") else "code"
    if measures.get("unread_files"):
        return "unread"
    return None


def resolve_packages(packages, rows=None, facets=None):
    """Set capability on every package record (the facet shape; status set or none): its curated row
    (a [[capability]] row keyed by its package id), else the run-band value its directory names
    (rule:package-path), else none. impl is measured (_package_impl) unless a curated row states stub
    or manual. A value whose package has no source at all is never held: it is listed as designed when
    the package has documents, and left out otherwise. Returns (derived {host project id: {value:
    {impl, via [package ids]}}}, designed {host project id: [values]}, problems): what derived:packages
    gives each host project, the best impl of its packages per value (IMPL_ORDER)."""
    rows = rows or {}
    run = set(bands(facets).get("run") or [])
    order = list(values(facets))
    derived, designed, problems = {}, {}, []
    for pid in sorted(packages):
        record = packages[pid]
        entry = rows.get(pid)
        measured = _package_impl(record)
        leaf = record["subpath"].rsplit("/", 1)[-1]
        if entry is not None:
            wanted, basis, stated = entry["values"], CURATED_PACKAGE, entry["stated"].get("impl") or {}
            problems += ["capability: %s states impl %s for %s; a package's impl is measured, so it is not used"
                         % (pid, impl, value) for value, impl in sorted(stated.items()) if impl not in CURATED_IMPL]
        else:
            wanted, basis, stated = ([leaf] if leaf in run else []), PACKAGE_PATH, {}
        held, docs, by_value = [], [], {}
        for value in wanted:
            impl = stated[value] if stated.get(value) in CURATED_IMPL else measured
            if impl is None:
                if (record.get("measures") or {}).get("md_files"):
                    docs.append(value)
                continue
            held.append(value)
            reading = dict((entry or {}).get("by_value", {}).get(value) or {f: DEFAULTS[f] for f in FIELDS}, impl=impl)
            by_value[value] = reading
        if entry is not None:
            field = facet(held, SET if held else NONE, CURATED_PACKAGE, "src:curated", entry.get("as_of"),
                          by_value=by_value, designed=docs, confidence=entry.get("confidence"),
                          reviewed=entry.get("reviewed"), review_after=entry.get("review_after"),
                          source=entry.get("source"), evidence=entry.get("evidence") or entry.get("evidence_full"),
                          reason=None if held else ("a curated row says it has no business capability"
                                                    if not wanted else "its curated values have no source behind them"))
        elif held or docs:
            field = facet(held, SET if held else NONE, basis if held else NONE, "src:packages", record.get("commit_date"),
                          by_value=by_value, designed=docs,
                          reason=None if held else "the package has documents and no source")
        else:
            field = facet([], NONE, NONE, None, None, by_value={}, designed=[],
                          reason="it has neither source nor documents" if wanted else
                          "its directory names no run-band capability and no curated row names it")
        record["capability"] = field
        host = record.get("host")
        for value in held:
            slot = derived.setdefault(host, {}).setdefault(value, {"impl": by_value[value]["impl"], "via": []})
            if IMPL_ORDER.index(by_value[value]["impl"]) < IMPL_ORDER.index(slot["impl"]):
                slot["impl"] = by_value[value]["impl"]
            slot["via"].append(pid)
        designed.setdefault(host, set()).update(docs)
    designed = {host: [v for v in order if v in found and v not in derived.get(host, {})]
                for host, found in designed.items() if found}
    return derived, designed, problems


def _rows_for(pid, project, rows):
    """(entry, via, problem): a project's row under its id, else under one of its aliases."""
    if pid in rows:
        return rows[pid], None, None
    hits = [alias for alias in sorted(project.get("aliases") or []) if alias in rows]
    if not hits:
        return None, None, None
    problem = None
    if len(hits) > 1:
        problem = "capability: the aliases of %s carry %d rows (%s); %s is used" % (pid, len(hits), ", ".join(hits),
                                                                                    hits[0])
    return rows[hits[0]], hits[0], problem


def resolve_projects(projects, rows=None, mirrors=None, derived=None, designed=None):
    """Set display["capability"] on every project (order: vocab/facets.toml [business.capability]
    .rule): its curated row, else its packages that have code (derived: {project id: {value:
    {impl, via}}} and designed: {project id: [values]}, from resolve_packages), else the one project it
    mirrors, else unassigned in business scope and none outside it. Returns the problems met."""
    rows, mirrors, derived, designed = rows or {}, mirrors or {}, derived or {}, designed or {}
    base, problems = {}, []
    for pid in sorted(projects):
        project = projects[pid]
        scope = business_scope(project)
        entry, via, problem = _rows_for(pid, project, rows)
        if problem:
            problems.append(problem)
        if entry is not None:
            base[pid] = _curated(entry, scope, via)
        elif derived.get(pid):
            base[pid] = _derived(derived[pid], scope, designed.get(pid) or ())
        else:
            base[pid] = _unplaced(scope)

    def own(ident):
        return base[ident]["basis"] in (CURATED_PROJECT, DERIVED_PACKAGES)

    for pid in sorted(projects):
        out = base[pid]
        if not own(pid):
            root = sphere.mirror_root(pid, mirrors, projects, own)
            if root is not None and own(root):
                theirs = base[root]
                out = facet(theirs["values"], theirs["status"], MIRROR, theirs.get("src"), theirs.get("at"), via=root,
                            scope=out["scope"], by_value=theirs["by_value"], designed=theirs["designed"],
                            reviewed=theirs.get("reviewed"), reason="follows %s" % root)
        held = set(out["values"]) | set(out["designed"])
        named = (projects[pid].get("display") or {}).get("be.framework_domain") or []
        out["candidates"] = [v for v in named if v not in held]
        projects[pid]["display"]["capability"] = out
        projects[pid]["display_src"]["capability"] = out["basis"] if out["basis"] != NONE else None
    return problems


def row_checks(projects, rows, today, packages=()):
    """{unmatched: [row ids naming no project, alias or package of this run], overdue: [(row id,
    review_after)], unreviewed: [row ids not yet reviewed]}."""
    known = set(projects) | set(packages)
    for project in projects.values():
        known |= set(project.get("aliases") or [])
    return {"unmatched": sorted(rid for rid in rows if rid not in known),
            "overdue": sorted((rid, str(e["review_after"])) for rid, e in rows.items()
                              if e.get("review_after") is not None and str(e["review_after"]) < today),
            "unreviewed": sorted(rid for rid, e in rows.items() if e.get("reviewed") is not True)}


def queue_items(projects, checks):
    """The QUEUE lines of the map: capability-unassigned, capability-candidate,
    capability-review-overdue and capability-orphan-row."""
    out = []
    for pid in sorted(projects):
        field = (projects[pid].get("display") or {}).get("capability") or {}
        if field.get("status") == UNASSIGNED:
            out.append({"reason": "capability-unassigned", "id": pid,
                        "detail": "in business scope: %s" % "; ".join(field.get("scope") or [])})
        for value in field.get("candidates") or []:
            out.append({"reason": "capability-candidate", "id": pid,
                        "detail": "be.framework_domain names %s; it is neither a value nor designed here" % value})
    out += [{"reason": "capability-review-overdue", "id": rid, "detail": "review after %s" % after}
            for rid, after in checks["overdue"]]
    out += [{"reason": "capability-orphan-row", "id": rid, "detail": "a curated capability row names no record of this run"}
            for rid in checks["unmatched"]]
    return out


def host_text(summary):
    """One host repository (packages.host_summary) in one line: where its packages were read and what
    their build state rests on."""
    if summary.get("status") != "read":
        return "%s: packages not read (%s)" % (summary.get("id"), summary.get("reason") or "unknown")
    total, workspace, folders = (summary.get(k) or 0 for k in ("packages", "workspace", "folders"))
    head = "%s at %s (%s%s): %d packages: %d in its workspace, %d folder%s its host row names, %d outside the workspace" % (
        summary["id"], (summary.get("at_commit") or "an unknown commit")[:12], summary.get("commit_date") or "date unknown",
        "" if summary.get("at_head") else "; its working tree differs from HEAD or was not measured",
        total, workspace, folders, "" if folders == 1 else "s", total - workspace - folders)
    listing = summary.get("build_list")
    if listing is None:
        return head + "; build state not measured: the host row names no quarantine list"
    if listing.get("status") != "ok" or listing.get("at_head") is not True:
        return head + "; build state not measured: %s %s" % (listing.get("path"), listing.get("reason") if listing.get(
            "status") != "ok" else "was not read as the one at HEAD (modified tracked files or an unmeasured checkout)")
    commits = ", ".join("%s (%s; %s commits before HEAD)" % (
        commit[:12], lag.get("commit_date") or "date unknown",
        lag["commits_since"] if lag.get("commits_since") is not None else "an unknown number of")
        for commit, lag in sorted((listing.get("commits") or {}).items()))
    return head + "; build state from %s at HEAD, %d entries, error counts measured at %s" % (
        listing.get("path"), listing.get("entries") or 0, commits or "no named commit")


def package_summary(packages):
    """{records, holding, by_basis, by_impl} over the package records of one build."""
    fields = [p.get("capability") or {} for p in (packages or {}).values()]
    return {"records": len(fields), "holding": sum(1 for f in fields if f.get("values")),
            "by_basis": dict(sorted(Counter(f.get("basis") or "missing" for f in fields).items())),
            "by_impl": dict(sorted(Counter(e.get("impl") for f in fields for e in (f.get("by_value") or {}).values()
                                           ).items()))}


def summary(projects, facets, rows=None, problems=(), checks=None, packages=None, hosts=None):
    """What the atlas and `estate capability` say about the map in one build; packages and hosts
    (packages.host_summary) say what was read of the host repositories."""
    allowed = values(facets)
    fields = {pid: (project.get("display") or {}).get("capability") or {} for pid, project in projects.items()}
    by_value = {value: [] for value in allowed}
    for pid, field in sorted(fields.items()):
        if field.get("basis") == MIRROR:
            continue  # a mirror holds its project's values again, as in the atlas
        for value in field.get("values") or []:
            by_value.setdefault(value, []).append(pid)
    checks = checks or {"unmatched": [], "overdue": [], "unreviewed": []}
    return {"values": list(allowed), "bands": bands(facets),
            "projects": dict(Counter(f.get("status") or "missing" for f in fields.values())),
            "bases": dict(Counter(f.get("basis") or "missing" for f in fields.values())),
            "in_scope": sum(1 for f in fields.values() if f.get("scope")),
            "unassigned": sorted(pid for pid, f in fields.items() if f.get("status") == UNASSIGNED),
            "candidates": sum(len(f.get("candidates") or []) for f in fields.values()),
            "by_value": by_value, "rows": len(rows or {}), "unreviewed": checks["unreviewed"],
            "overdue": checks["overdue"], "unmatched": checks["unmatched"], "problems": list(problems),
            "packages": package_summary(packages), "hosts": list(hosts or [])}


# ── importing a classification ──────────────────────────────────────────────────────────────

def read_classification(path):
    """The classification JSON at an absolute path, shape-checked: {meta: {source, as_of}, rows:
    [{id, values, impl, operating, serves, designed, confidence, short, evidence}]}."""
    require(os.path.isabs(path), "--import needs an absolute path")
    raw, reason = safety.read_checked(path, 16 << 20)
    require(raw is not None, "cannot read %s: %s" % (path, reason))
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise GuardError("%s is not JSON: %s" % (path, exc)) from exc
    require(isinstance(data, dict) and isinstance(data.get("rows"), list),
            "%s: the classification must be a JSON object with a rows list" % path)
    return data


def _short(row):
    """The committed evidence: the row's own short text, else the clean part of its evidence
    (curate.scrub), never more than SHORT_MAX characters."""
    text = row.get("short")
    if not text:
        text, _spans, _heavy = curate.scrub(row.get("evidence") or "")
    text = " ".join(str(text).split())
    return text if len(text) <= SHORT_MAX else text[:SHORT_MAX - 2].rsplit(" ", 1)[0] + " …"


def _table_of(ident, row):
    """One row as the file renders it: fixed keys first, the per-value maps inline and in value
    order, then any other key a hand edit added (sorted), so nothing is lost."""
    held = list(row.get("values") or [])
    out = {"id": ident}
    if "values" in row:
        out["values"] = held  # an evidence-only private row holds no values, and must not gain any
    for field in FIELDS:
        stated = row.get(field) or {}
        if stated:
            out[field] = safety.Inline({v: stated[v] for v in held if v in stated})
    if row.get("designed"):
        out["designed"] = list(row["designed"])
    for key in META_KEYS:
        if row.get(key) is not None:
            out[key] = row[key]
    for key in sorted(set(row) - set(out) - set(FIELDS) - {"designed"}):
        out[key] = safety.Inline(row[key]) if isinstance(row[key], dict) else row[key]
    return out


def _read_rows(path, table="capability"):
    """The [[capability]] (or [[host]]) rows of one TOML file, read as written (dates stay dates); []
    when absent."""
    raw, reason = safety.read_checked(path, 4 << 20)
    if raw is None:
        require(reason == "missing", "cannot read %s: %s" % (path, reason))
        return []
    try:
        rows = tomllib.loads(raw.decode("utf-8")).get(table) or []
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        raise GuardError("%s is not valid TOML: %s" % (path, exc)) from exc
    require(isinstance(rows, list) and all(isinstance(r, dict) and isinstance(r.get("id"), str) for r in rows),
            "%s: every [[%s]] row needs an id" % (path, table))
    return rows


def _host_table(row):
    """A [[host]] row as the file renders it: its keys in their written order, maps inline."""
    return {key: safety.Inline(value) if isinstance(value, dict) else value for key, value in row.items()}


def plan_import(data, facets, layer_dir=None, replace_reviewed=()):
    """The new text of curated/capabilities.toml and of the private file, merged by id:
    {committed {relpath: text}, private text, counts, kept_reviewed [ids]}. An imported row
    replaces the unreviewed row of its id; a reviewed row is kept unless replace_reviewed names it;
    a row the import leaves out is kept; the [[host]] rows are kept as they are. Nothing is written."""
    layer = os.path.realpath(layer_dir or safety.LAYER_DIR)
    voc = _vocab(facets)
    meta = data.get("meta") or {}
    source = meta.get("source") or "classification"
    as_of = dt.date.fromisoformat(str(meta.get("as_of") or safety.utc_now().date().isoformat()))
    stamp = {"source": source, "reviewed": False, "as_of": as_of, "review_after": as_of + dt.timedelta(days=REVIEW_DAYS)}
    old = {r["id"]: r for r in _read_rows(os.path.join(layer, COMMITTED_FILE))}
    hosts = [_host_table(r) for r in _read_rows(os.path.join(layer, COMMITTED_FILE), "host")]
    old_private = {r["id"]: r for r in _read_rows(os.path.join(layer, "private", PRIVATE_FILE))}
    replace = set(replace_reviewed or ())
    for ident in sorted(replace):
        require((old.get(ident) or {}).get("reviewed") is True,
                "--replace-reviewed %s: no reviewed row of that id in %s" % (ident, COMMITTED_FILE))
    committed, private = dict(old), dict(old_private)
    counts = Counter()
    kept_reviewed, seen = [], set()
    for row in data["rows"]:
        entry, problems = check_row(row, voc, "the classification")
        require(entry is not None and not problems, "; ".join(problems) or "a classification row has no id")
        ident = entry["id"]
        require(ident not in seen, "the classification lists %s twice" % ident)
        seen.add(ident)
        if (old.get(ident) or {}).get("reviewed") is True and ident not in replace:
            kept_reviewed.append(ident)
            continue
        table = dict({"values": entry["values"], "designed": entry["designed"]}, **entry["stated"])
        if row.get("confidence") is not None:
            table["confidence"] = row["confidence"]
        full = {"id": ident, "evidence": row.get("evidence") or row.get("short") or ""}
        if sphere.private_shaped(ident):
            private[ident] = _table_of(ident, dict(table, evidence=full["evidence"], **stamp))
            counts["private_only"] += 1
            continue
        new = _table_of(ident, dict(table, evidence=_short(row), **stamp))
        counts["added" if ident not in old else ("unchanged" if _table_of(ident, old[ident]) == new else "replaced")] += 1
        committed[ident] = new
        private[ident] = full
    counts["kept"] = sum(1 for ident in old if ident not in seen)
    counts["kept_reviewed"] = len(kept_reviewed)
    rows = [_table_of(ident, committed[ident]) for ident in sorted(committed)]
    tables = {key: value for key, value in (("host", hosts), ("capability", rows)) if value}
    text = COMMITTED_HEADER + (safety.toml_dumps(tables) if tables else "")
    findings = curate.lint_text(text, COMMITTED_FILE, curate.scope_of(COMMITTED_FILE))
    require(not findings, "the capability rows would fail the privacy lint in %s: %s" % (COMMITTED_FILE, "; ".join(
        "%s line %s (%s)" % (f["rule"], f.get("line"), f.get("detail")) for f in findings[:5])))
    written = tomllib.loads(text)
    require(_plain(written.get("capability") or []) == _plain(rows) and _plain(written.get("host") or []) == _plain(hosts),
            "the capability rows do not round-trip through TOML")
    private_rows = [_table_of(ident, private[ident]) for ident in sorted(private)]
    private_text = PRIVATE_HEADER + safety.toml_dumps({"meta": {"source": source, "as_of": as_of,
                                                                "note": "private capability rows; one copy only"},
                                                       "capability": private_rows})
    require(_plain(tomllib.loads(private_text).get("capability")) == _plain(private_rows),
            "the private capability rows do not round-trip through TOML")
    counts["private_rows"] = len(private_rows)
    return {"committed": {COMMITTED_FILE: text}, "private": private_text, "counts": dict(counts),
            "kept_reviewed": kept_reviewed}


def _plain(value):
    return json.loads(json.dumps(value, default=str)) if value is not None else None
