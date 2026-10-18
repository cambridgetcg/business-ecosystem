"""The sphere facet: what is part of KINGDOM OS, the civilisation (owner decision D4).

D4 (dec-2026-10-17-5) says KINGDOM OS is the civilisation, not one repository: every
civilisation-related repository and several Cloudflare domains belong to it. The facet has three
values (vocab/facets.toml [facet.sphere]): kingdom-os, independent and undecided. undecided is a
value, not a gap: the evidence is mixed or absent, and the record is listed for Yu with the reason.

Assignments are curated, from an evidence-backed classification (reviewed = false until Yu reviews
it), and kept where the curation already keeps per-record knowledge: a family default as
[family.sphere] in curated/families/<family>.toml, a project's own value on its [[project]] row,
zones, surfaces and projects without a curated row as [[sphere]] rows of curated/estate.toml, and
local ids plus the full evidence of every row in private/curated/sphere.toml. The decision's
sphere_by_layer places what no assignment names, from the KINGDOM layer on the authority ref.

`estate sphere --import` writes a classification into those places. Committed files are edited by
inserting text exactly where import-survey renders it, so a later re-import (which carries the rows
forward, curate.carry_spheres) reproduces them; the private file goes through curate.keep_private.
"""
import datetime as dt
import json
import os
import tomllib
from collections import Counter

import curate
import safety
from safety import GuardError, require

KINGDOM_OS, INDEPENDENT, UNDECIDED = curate.SPHERES
# Only the classification input says this; the facet holds it as undecided with third_party set,
# because D4 names no sphere for code the estate holds but does not own.
NOT_OURS = "not-ours"
CURATED_PROJECT, MIRROR, CURATED_FAMILY, RULE_LAYER = "curated:project", "mirror", "curated:family", "rule:layer"
CURATED_ZONE, OWNER_PROJECT, CURATED_SURFACE, SOURCE_PROJECT = ("curated:zone", "owner-project", "curated:surface",
                                                                "source-project")
NONE = "none"
MIRROR_VERBS = ("mirror_of", "copy_of")
PRIVATE_FILE = "curated/sphere.toml"
FAMILIES_DIR = "curated/families"
ESTATE_FILE = "curated/estate.toml"
CONFIDENCE = ("high", "medium", "low")
SHORT_MAX = 300
REVIEW_DAYS = 90
ROW_KEYS = ("value", "follows", "third_party", "confidence", "evidence", "source", "reviewed", "as_of", "review_after")
PRIVATE_HEADER = ("# Sphere classification behind the KINGDOM OS facet (owner decision D4): local ids and the full\n"
                  "# evidence of every row. Private; one copy only. Written by `estate sphere --import PATH --write`.\n\n")


def values(facets):
    """The sphere values vocab/facets.toml defines, in its order (empty when the facet is absent)."""
    table = (((facets or {}).get("facet") or {}).get("sphere") or {}).get("values") or {}
    return tuple(table)


def facet(value, basis, decision, src=None, at=None, **extra):
    """A sphere facet: always a value (undecided included), its basis and the defining decision."""
    out = {"value": value, "status": "set", "basis": basis, "src": src, "at": at, "alt": [], "decision": decision}
    out.update({k: v for k, v in extra.items() if v is not None})
    return out


# ── the curated assignments ─────────────────────────────────────────────────────────────────

def _entry(row, where):
    entry = {k: row.get(k) for k in ROW_KEYS if row.get(k) is not None}
    entry["where"] = where
    return entry


def curated_index(curated, allowed):
    """(rows {record id: entry}, families {family id: entry}, problems) of every curated sphere
    assignment. Committed rows decide; a private row adds the full evidence (evidence_full) and
    is itself the assignment only for an id nothing committed names (a local id)."""
    rows, families, problems = {}, {}, []

    def take(rid, row, where, into):
        if not isinstance(row, dict) or not isinstance(rid, str) or not rid:
            problems.append("sphere: an assignment in %s has no id or is not a table" % where)
        elif row.get("value") not in allowed:
            problems.append("sphere: %s in %s names %r, which is not a sphere value" % (rid, where, row.get("value")))
        elif rid in into:
            problems.append("sphere: %s is assigned twice (%s and %s); the first is kept" % (rid, into[rid]["where"], where))
        else:
            into[rid] = _entry(row, where)

    for pid, row in sorted((curated.get("projects") or {}).items()):
        if not row.get("private_only") and row.get("sphere") is not None:
            take(pid, row["sphere"], FAMILIES_DIR, rows)
    for fid, row in sorted((curated.get("families") or {}).items()):
        if row.get("sphere") is not None:
            take(fid, row["sphere"], row.get("file") or FAMILIES_DIR, families)
    for row in curated.get("spheres") or []:
        take((row or {}).get("id"), row, ESTATE_FILE, rows)
    for row in ((curated.get("private") or {}).get("sphere") or {}).get("sphere") or []:
        rid = (row or {}).get("id")
        known = rows.get(rid) or families.get(rid)
        if known is None:
            take(rid, row, "private/" + PRIVATE_FILE, rows)
            continue
        if row.get("value") not in (None, known["value"]):
            problems.append("sphere: private/%s says %s is %s, the committed curation says %s; the committed "
                            "value is kept" % (PRIVATE_FILE, rid, row.get("value"), known["value"]))
        if row.get("evidence"):
            known["evidence_full"] = row["evidence"]
    return rows, families, problems


def rule_problems(rule, layers, allowed):
    """Where the decision's sphere_by_layer and the live layer vocabulary disagree: a layer it maps
    that the authority ref does not know, a live layer it leaves out, or a value that is no sphere."""
    if not rule:
        return []
    by_layer = rule.get("by_layer") or {}
    out = ["sphere: %s maps layer %s, which the authority ref's vocabulary does not have" % (rule["decision"], k)
           for k in sorted(by_layer) if layers and k not in layers]
    out += ["sphere: %s gives layer %s no sphere; such projects stay undecided unless curated" % (rule["decision"], k)
            for k in sorted(layers) if k not in by_layer]
    out += ["sphere: %s maps layer %s to %r, which is not a sphere value" % (rule["decision"], k, v)
            for k, v in sorted(by_layer.items()) if v not in allowed]
    return out


# ── resolution ──────────────────────────────────────────────────────────────────────────────

def _curated_facet(entry, basis, decision, via=None):
    # reason: the committed short text (a private-only row has only its full text); evidence: the
    # full private text when there is more of it.
    reason = entry.get("evidence") or entry.get("evidence_full")
    full = entry.get("evidence_full")
    return facet(entry["value"], basis, decision, "src:curated", entry.get("as_of"),
                 confidence=entry.get("confidence"), reviewed=entry.get("reviewed"), via=via,
                 third_party=True if entry.get("third_party") else None, reason=reason,
                 evidence=full if full and full != reason else None)


def final_word(evidence):
    """The last say of a row's evidence: the checker's, when a check revised the first pass."""
    text = str(evidence or "").split("| checker:")[-1].strip()
    return text[len("checker:"):].strip() if text.startswith("checker:") else text


def _layer_values(layer):
    if layer.get("status") in ("settled", "roster-fallback") and layer.get("value") is not None:
        return [layer["value"]]
    if layer.get("status") == "contested":
        return sorted({c.get("value") for c in layer.get("candidates") or [] if c.get("value") is not None})
    return []


def _own(pid, project, rows, families, rule, allowed, ref, at):
    """A project's sphere before mirrors are considered, and any problem with its assignment."""
    decision = (rule or {}).get("decision")
    entry, via, problem = rows.get(pid), None, None
    if entry is None:
        hits = [(alias, rows[alias]) for alias in sorted(project.get("aliases") or []) if alias in rows]
        if hits:
            via, entry = hits[0]
            if len({e["value"] for _, e in hits}) > 1:
                problem = "sphere: the aliases of %s carry different spheres; %s is used" % (pid, via)
    if entry is not None:
        return _curated_facet(entry, CURATED_PROJECT, decision, via), problem
    family = project.get("family_id")
    default = families.get(family) if family else None
    if default is not None and default["value"] != UNDECIDED:
        return facet(default["value"], CURATED_FAMILY, decision, "src:curated", default.get("as_of"),
                     confidence=default.get("confidence"), reviewed=default.get("reviewed"), family=family), None
    layer = ((project.get("facets") or {}).get("layer")) or {}
    found = _layer_values(layer)
    by_layer = (rule or {}).get("by_layer") or {}
    mapped = {by_layer.get(v) for v in found}
    if found and len(mapped) == 1 and None not in mapped and next(iter(mapped)) in allowed:
        return facet(next(iter(mapped)), RULE_LAYER, decision, "src:kingdom:%s" % ref if ref else None, at,
                     layer="|".join(found)), None
    if default is not None:
        why = "family %s presumes nothing (its members are mixed)" % family.split(":", 1)[-1]
    else:
        why = "no curated assignment and no family default"
    if not rule:
        why += ", and no owner decision maps a KINGDOM layer to a sphere"
    elif not found:
        why += ", and the KINGDOM layer is %s" % (layer.get("status") or "unset")
    elif None in mapped:
        why += ", and %s gives layer %s no sphere" % (decision, "|".join(v for v in found if by_layer.get(v) is None))
    else:
        why += ", and the %slayer (%s) maps to %s" % ("contested " if layer.get("status") == "contested" else "",
                                                     "|".join(found), "|".join(sorted(m for m in mapped if m)))
    return facet(UNDECIDED, CURATED_FAMILY if default is not None else NONE, decision,
                 "src:curated" if default is not None else None, default.get("as_of") if default else None,
                 family=family if default is not None else None, reason=why), None


def mirror_targets(relations):
    """{project id: [the projects it is a mirror_of or copy_of]} from the relation records."""
    out = {}
    for rel in relations:
        if rel.get("verb") in MIRROR_VERBS and rel.get("from") and rel.get("to") and rel["from"] != rel["to"]:
            out.setdefault(rel["from"], set()).add(rel["to"])
    return {k: sorted(v) for k, v in out.items()}


def _root(pid, mirrors, base, projects):
    """The project a mirror shares its sphere with: follow single mirror_of/copy_of links until a
    project with its own curated assignment, or with no single target. None for a non-mirror, and
    for a cycle of mirrors, which names no canonical project."""
    seen, current = {pid}, pid
    while True:
        targets = [t for t in mirrors.get(current) or [] if t in projects]
        if len(targets) != 1:
            return None if current == pid else current
        if targets[0] in seen:
            return None
        current = targets[0]
        seen.add(current)
        if base[current]["basis"] == CURATED_PROJECT:
            return current


def resolve_projects(projects, rows, families, rule, mirrors, allowed, ref=None, at=None):
    """Set facets["sphere"] on every project (order: vocab/facets.toml [facet.sphere].rule).
    Returns the problems met (conflicting aliases)."""
    base, problems = {}, []
    for pid in sorted(projects):
        base[pid], problem = _own(pid, projects[pid], rows, families, rule, allowed, ref, at)
        if problem:
            problems.append(problem)
    for pid in sorted(projects):
        out = base[pid]
        if out["basis"] != CURATED_PROJECT:
            root = _root(pid, mirrors, base, projects)
            if root is not None:
                theirs = base[root]
                out = facet(theirs["value"], MIRROR, theirs["decision"], theirs.get("src"), theirs.get("at"),
                            via=root, confidence=theirs.get("confidence"), third_party=theirs.get("third_party"),
                            reason=("follows %s: %s" % (root, theirs["reason"])) if theirs.get("reason") else None)
        projects[pid]["facets"]["sphere"] = out
    return problems


def _follow(kind, owner, projects, decision):
    """A zone's or surface's sphere from its owner or source project."""
    theirs = ((projects.get(owner) or {}).get("facets") or {}).get("sphere")
    if not theirs:
        return None
    reason = "follows %s%s" % (owner, ": " + theirs["reason"] if theirs.get("reason") else "")
    return facet(theirs["value"], kind, decision, theirs.get("src"), theirs.get("at"), via=owner,
                 confidence=theirs.get("confidence"), third_party=theirs.get("third_party"),
                 reason=reason if theirs["value"] == UNDECIDED else None)


def _row(entry, basis, decision, theirs_of, problems):
    """A curated zone or surface row. A row that says follows = <id> takes that record's sphere
    now, so a classification that follows a project cannot go stale when the project's value
    changes; a stored value that no longer agrees is reported, to refresh the row."""
    out = _curated_facet(entry, basis, decision)
    target = entry.get("follows")
    if not target:
        return out
    theirs = theirs_of(target)
    if not theirs:
        problems.append("sphere: a curated row follows %s, which has no sphere in this run; its own value %s is kept"
                        % (target, entry["value"]))
        return out
    if theirs["value"] != entry["value"]:
        problems.append("sphere: a curated row follows %s, which is now %s, but still stores %s; the followed value "
                        "is used (refresh the row with estate sphere --import)" % (target, theirs["value"], entry["value"]))
    out.update(value=theirs["value"], via=target, follows=target)
    if theirs.get("third_party"):
        out["third_party"] = True
    return out


def resolve_zone(zone, rows, projects, decision, problems=None):
    if zone["id"] in rows:
        return _row(rows[zone["id"]], CURATED_ZONE, decision,
                    lambda ident: ((projects.get(ident) or {}).get("facets") or {}).get("sphere"),
                    problems if problems is not None else [])
    return _follow(OWNER_PROJECT, zone.get("owner_project"), projects, decision) or facet(
        UNDECIDED, NONE, decision, reason="no curated assignment and no owner project")


def resolve_surface(surface, rows, projects, decision, zones=None, problems=None):
    """zones: the resolved zones, which a surface's row may follow (a worker that only routes on one
    zone)."""
    if surface["id"] in rows:
        return _row(rows[surface["id"]], CURATED_SURFACE, decision,
                    lambda ident: ((projects.get(ident) or {}).get("facets") or {}).get("sphere")
                    or ((zones or {}).get(ident) or {}).get("sphere"), problems if problems is not None else [])
    return _follow(SOURCE_PROJECT, surface.get("source_project"), projects, decision) or facet(
        UNDECIDED, NONE, decision, reason="no curated assignment and no source project")


def follow_mismatches(zones, surfaces, projects):
    """Curated zone and surface rows (without follows) whose value differs from the sphere of the
    project they hang on: a zone's owner project, a surface's source project. Nothing changes, the
    row stands until Yu reviews it; the difference is listed so a stale reason cannot hide."""
    out = []
    for record, key in [(z, "owner_project") for z in zones.values()] + [(s, "source_project") for s in surfaces.values()]:
        mine = record.get("sphere") or {}
        if mine.get("basis") not in (CURATED_ZONE, CURATED_SURFACE) or mine.get("follows"):
            continue
        owner = record.get(key)
        theirs = ((projects.get(owner) or {}).get("facets") or {}).get("sphere") or {} if owner else {}
        if theirs.get("value") and theirs["value"] != mine.get("value"):
            out.append({"id": record["id"], "value": mine.get("value"), "project": owner, "project_value": theirs["value"]})
    return sorted(out, key=lambda m: m["id"])


def summary(projects, zones, surfaces, rows, families, rule, allowed, problems, mismatches=()):
    """What the atlas and `estate sphere` say about the facet in one build."""
    matched = set(projects) | set(zones) | set(surfaces)
    for project in projects.values():
        matched |= set(project.get("aliases") or [])

    def count(records, key=lambda r: r.get("facets", {}).get("sphere")):
        return dict(Counter((key(r) or {}).get("value") or "missing" for r in records))

    return {"decision": (rule or {}).get("decision"), "by_layer": dict((rule or {}).get("by_layer") or {}),
            "values": list(allowed),
            "projects": count(projects.values()),
            "zones": count(zones.values(), lambda r: r.get("sphere")),
            "surfaces": count(surfaces.values(), lambda r: r.get("sphere")),
            "families": {fid: entry["value"] for fid, entry in sorted(families.items())},
            "unmatched": sorted(rid for rid in rows if rid not in matched),
            "mismatches": list(mismatches),
            "problems": list(problems)}


# ── importing a classification ──────────────────────────────────────────────────────────────

def read_classification(path):
    """The classification JSON at an absolute path, shape-checked; GuardError when unusable."""
    require(os.path.isabs(path), "--import needs an absolute path")
    raw, reason = safety.read_checked(path, 16 << 20)
    require(raw is not None, "cannot read %s: %s" % (path, reason))
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise GuardError("%s is not JSON: %s" % (path, exc)) from exc
    require(isinstance(data, dict), "%s: the classification must be a JSON object" % path)
    for key in ("family_defaults", "exceptions", "zones", "surfaces"):
        require(isinstance(data.get(key, []), list), "%s: %s must be a list" % (path, key))
    return data


def private_shaped(ident):
    """True when an id may not appear in a committed file (a local id, or anything the privacy lint
    rejects, such as a surface named after a local runtime): its row lives in the private file."""
    return ident.startswith(curate.LOCAL) or bool(curate.lint_text('id = "%s"\n' % ident, ESTATE_FILE, "strict"))


def _value(entry, allowed, where):
    """(value, third_party) of one classification entry. not-ours is undecided and third-party; an
    entry may also mark third-party code that a curated value already places (third_party: true),
    so a later answer about third-party code reaches it too."""
    raw = entry.get("sphere")
    if raw == NOT_OURS:
        return UNDECIDED, True
    require(raw in allowed, "%s: %s has sphere %r, which is not a sphere value" % (where, entry.get("id") or
                                                                                    entry.get("family"), raw))
    require(entry.get("third_party") in (None, True, False), "%s: %s: third_party must be true or false"
            % (where, entry.get("id") or entry.get("family")))
    return raw, entry.get("third_party") is True


def _short(entry):
    """The committed evidence: the entry's own short text, else the first clean sentences of its
    evidence (curate.scrub), never more than SHORT_MAX characters."""
    text = entry.get("short")
    if not text:
        # The checker's word is the last one on a disputed row; scrub keeps only lint-clean text.
        text, _spans, _heavy = curate.scrub(final_word(entry.get("evidence") or entry.get("rationale")))
    text = " ".join(str(text).split())
    return text if len(text) <= SHORT_MAX else text[:SHORT_MAX - 2].rsplit(" ", 1)[0] + " …"


def _rank(entry):
    return CONFIDENCE.index(entry["confidence"]) if entry.get("confidence") in CONFIDENCE else len(CONFIDENCE)


def _merge(entries, where):
    """One entry per id: duplicates must agree on the sphere; the highest confidence wins and the
    evidence of each is kept."""
    out = {}
    for entry in entries:
        ident = entry.get("id")
        require(isinstance(ident, str) and ident, "%s: an entry has no id" % where)
        if ident not in out:
            out[ident] = dict(entry)
            continue
        first = out[ident]
        require(first.get("sphere") == entry.get("sphere"), "%s: %s is classified twice, as %s and %s" % (
            where, ident, first.get("sphere"), entry.get("sphere")))
        keep = entry if _rank(entry) < _rank(first) else first
        merged = dict(keep, evidence=" || ".join(e for e in (first.get("evidence"), entry.get("evidence")) if e))
        if not merged.get("short"):
            merged["short"] = keep.get("short") or first.get("short") or entry.get("short")
        out[ident] = merged
    return out


def plan_import(data, curated, allowed, layer_dir=None):
    """Where each classification row goes, and the new text of every file it changes:
    {committed {relpath: new text}, private text, counts, skipped [(id, why)]}. Nothing is written."""
    layer = os.path.realpath(layer_dir or safety.LAYER_DIR)
    meta = data.get("meta") or {}
    source = meta.get("source") or "classification"
    as_of = dt.date.fromisoformat(str(meta.get("as_of") or safety.utc_now().date().isoformat()))
    review_after = as_of + dt.timedelta(days=REVIEW_DAYS)
    dropped = {d.get("id"): d.get("why") or "dropped by the classification" for d in data.get("drop") or []}
    stamp = {"source": source, "reviewed": False, "as_of": as_of, "review_after": review_after}
    families_in = {fid.split(":", 1)[1]: row for fid, row in (curated.get("families") or {}).items()}
    committed_rows = {pid: row for pid, row in (curated.get("projects") or {}).items() if not row.get("private_only")}
    family_tables, row_tables, estate_rows, private_rows, skipped = {}, {}, [], [], []

    for entry in data.get("family_defaults") or []:
        family = entry.get("family")
        value, third = _value(entry, allowed, "family_defaults")
        if family not in families_in:
            skipped.append(("family " + str(family), "no curated family of that name; no default is stored"))
            continue
        family_tables[family] = dict({"value": value, "evidence": _short(entry)}, **stamp)
        private_rows.append({"id": "family:" + family, "evidence": entry.get("rationale") or ""})
    for kind in ("exceptions", "zones", "surfaces"):
        for ident, entry in sorted(_merge(data.get(kind) or [], kind).items()):
            if ident in dropped:
                skipped.append((ident, dropped[ident]))
                continue
            value, third = _value(entry, allowed, kind)
            if kind == "zones" and third:
                skipped.append((ident, "a third-party apex is not an estate zone"))
                continue
            table = dict({"value": value}, **({"third_party": True} if third else {}))
            follows = entry.get("follows")
            if follows is not None:
                require(kind != "exceptions" and isinstance(follows, str) and follows and follows != ident,
                        "%s: %s: follows names the record a zone or surface takes its sphere from" % (kind, ident))
                table["follows"] = follows
            if entry.get("confidence") in CONFIDENCE:
                table["confidence"] = entry["confidence"]
            full = {"id": ident, "evidence": entry.get("evidence") or ""}
            if private_shaped(ident) or (follows and private_shaped(follows)):
                private_rows.append(dict(full, **table, **stamp))
                continue
            table.update(evidence=_short(entry), **stamp)
            if kind == "exceptions" and ident in committed_rows:
                row_tables[ident] = table
            else:
                estate_rows.append(dict({"id": ident}, **table))
            private_rows.append(full)

    committed = {}
    for family, table in sorted(family_tables.items()):
        rel = FAMILIES_DIR + "/%s.toml" % family
        committed[rel] = set_family_sphere(_read(layer, rel), table)
    for pid, table in sorted(row_tables.items()):
        rel = families_in[committed_rows[pid]["family_id"].split(":", 1)[1]].get("file") or (
            FAMILIES_DIR + "/%s.toml" % committed_rows[pid]["family_id"].split(":", 1)[1])
        committed[rel] = set_row_sphere(committed.get(rel) or _read(layer, rel), pid, table)
    committed[ESTATE_FILE] = set_estate_spheres(_read(layer, ESTATE_FILE), estate_rows)
    for rel, new in committed.items():
        findings = curate.lint_text(new, rel, curate.scope_of(rel))
        require(not findings, "the sphere rows would fail the privacy lint in %s: %s" % (rel, "; ".join(
            "%s line %s (%s)" % (f["rule"], f.get("line"), f.get("detail")) for f in findings[:5])))
    private = PRIVATE_HEADER + safety.toml_dumps({"meta": {"source": source, "as_of": as_of,
                                                           "note": "private sphere rows; one copy only"},
                                                  "sphere": private_rows})
    require(_plain(tomllib.loads(private).get("sphere")) == _plain(private_rows),
            "the private sphere rows do not round-trip through TOML")
    counts = {"family_defaults": len(family_tables), "project_rows": len(row_tables), "estate_rows": len(estate_rows),
              "private_only": sum(1 for r in private_rows if "value" in r), "private_rows": len(private_rows),
              "skipped": len(skipped)}
    return {"committed": committed, "private": private, "counts": counts, "skipped": skipped}


def _read(layer, rel):
    raw, reason = safety.read_checked(os.path.join(layer, rel), 4 << 20)
    require(raw is not None, "cannot read %s: %s" % (rel, reason))
    return raw.decode("utf-8")


# ── committed text, edited where import-survey renders it ──────────────────────────────────

def _header_at(lines, start):
    return next((i for i in range(start, len(lines)) if lines[i].startswith("[")), len(lines))


def _strip_sphere(doc):
    """A parsed curated file without its sphere data, to prove an edit touched nothing else."""
    doc = json.loads(json.dumps(doc, default=str))
    (doc.get("family") or {}).pop("sphere", None)
    for row in doc.get("project") or []:
        row.pop("sphere", None)
    doc.pop("sphere", None)
    return doc


def _checked(old, new, expect):
    """new, once it parses, equals old apart from its sphere data, and holds the expected data."""
    try:
        before, after = tomllib.loads(old), tomllib.loads(new)
    except tomllib.TOMLDecodeError as exc:
        raise GuardError("the sphere edit does not parse: %s" % exc) from exc
    require(_strip_sphere(before) == _strip_sphere(after), "the sphere edit changed more than the sphere data")
    require(expect(after), "the sphere edit did not hold the expected data")
    return new


def set_family_sphere(text, table):
    """The family file with [family.sphere] set to table: rendered after the [family] keys, where
    toml_dumps puts a sub-table, and replacing an existing [family.sphere] block."""
    lines = text.split("\n")
    head = lines.index("[family]")
    block = ["[family.sphere]"] + safety.toml_dumps(table).rstrip("\n").split("\n")
    at = _header_at(lines, head + 1)
    if at < len(lines) and lines[at] == "[family.sphere]":
        end = _header_at(lines, at + 1)
        while end > at + 1 and lines[end - 1] == "":
            end -= 1
        lines[at:end] = block
    elif at < len(lines):
        lines[at:at] = block + [""]
    else:
        while lines and lines[-1] == "":
            lines.pop()
        lines += [""] + block
    new = "\n".join(lines)
    return _checked(text, new if new.endswith("\n") else new + "\n",
                    lambda doc: _plain(doc["family"].get("sphere")) == _plain(table))


def set_row_sphere(text, pid, table):
    """The family file with `sphere = { ... }` as the last key of the [[project]] row of pid,
    replacing an existing one: where toml_dumps renders an inline table of the row."""
    lines = text.split("\n")
    wanted = "id = %s" % safety.toml_dumps({"id": pid}).strip().split(" = ", 1)[1]
    hits = [i for i, line in enumerate(lines) if line == wanted and i > 0 and lines[i - 1] == "[[project]]"]
    require(len(hits) == 1, "no single [[project]] row for %s in its family file" % pid)
    end = hits[0]
    while end + 1 < len(lines) and lines[end + 1] and not lines[end + 1].startswith("["):
        end += 1
    rendered = safety.toml_dumps({"sphere": safety.Inline(table)}).rstrip("\n")
    existing = [i for i in range(hits[0], end + 1) if lines[i].startswith("sphere = ")]
    if existing:
        lines[existing[0]] = rendered
    else:
        lines.insert(end + 1, rendered)
    return _checked(text, "\n".join(lines), lambda doc: any(
        r.get("id") == pid and _plain(r.get("sphere")) == _plain(table) for r in doc.get("project") or []))


def set_estate_spheres(text, rows):
    """estate.toml with its [[sphere]] rows replaced by rows, appended last, as toml_dumps renders
    the estate document's last array."""
    lines = text.rstrip("\n").split("\n")
    out, skipping = [], False
    for line in lines:
        if line.startswith("["):
            skipping = line == "[[sphere]]"
        if not skipping:
            out.append(line)
    while out and out[-1] == "":
        out.pop()
    new = "\n".join(out) + "\n"
    if rows:
        new += "\n" + safety.toml_dumps({"sphere": rows})
    return _checked(text, new, lambda doc: _plain(doc.get("sphere") or []) == _plain(rows))


def _plain(value):
    return json.loads(json.dumps(value, default=str)) if value is not None else None
