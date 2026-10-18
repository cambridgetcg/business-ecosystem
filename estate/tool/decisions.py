"""Owner decisions: what Yu settled, applied when the map is built.

curated/decisions.toml holds two kinds of [[decision]]: proposal dispositions written by
`estate proposals --decide` (proposals.py reads those) and owner decisions (kind "owner-decision"),
read here. An owner decision names the questions and disputes it resolves, says per id what was
decided (outcome) and what stays open (open), and carries a small effects table.

The effects are applied at build time instead of being written back into the curation: the private
curation keeps its single copy untouched, a status never lives in two places, and removing a
decision undoes its effects on the next build. An effect this version does not apply is listed as
not applied, never guessed at.
"""
import re

import kingdom

KIND = "owner-decision"
DECIDED, PARTLY = "decided", "partly-decided"
# Effect keys this version applies, and what each one does to the map.
APPLIED = {
    "taxonomy_ref": "the build reads this kingdom-os ref as the primary (authority) ref",
    "drift_only": "this ref is still read and shown, as drift only",
    "non_authoritative": "listed in the atlas as non-authoritative; proposals only",
    "layer_overrule": "this candidate no longer contests a card that names the decided layer or none; it stays "
                      "listed as a claim, and a card naming another layer stays contested",
    "layer_default": "the layer a record takes when the overruled candidate was its only claim",
    "confirms": "the named earlier decision is confirmed",
    "ownership": "the named surfaces and zones are attributed to the estate's own account of the provider",
    "provider_status": "the provider's account, and what is tied to it, carry this status",
    "no_calls": "the estate makes no calls to the provider",
    "status_note": "shown with the decision",
    "sphere_by_layer": "defines the sphere facet: a project nothing curated places takes the sphere its KINGDOM "
                       "layer maps to",
    "hygiene_view": "the private hygiene plan (estate hygiene) renders as HYGIENE.md and an atlas section on every "
                    "build, joined with the run's own measurements",
}
_SEQ = re.compile(r"-(\d+)$")


def _seq(ident):
    match = _SEQ.search(str(ident))
    return int(match.group(1)) if match else 0


def owner_decisions(rows):
    """The owner decisions among the decisions.toml rows, oldest first (by date, then number)."""
    out = [d for d in rows or [] if isinstance(d, dict) and d.get("kind") == KIND and d.get("id")]
    return sorted(out, key=lambda d: (str(d.get("date") or ""), _seq(d["id"]), str(d["id"])))


def problems(rows, known_ids):
    """Shape problems of the owner decisions, as plain sentences (empty when usable). known_ids:
    every question and dispute id of the curation, so a decision cannot resolve a typo."""
    out, seen = [], set()
    for d in owner_decisions(rows):
        ident = d["id"]
        if ident in seen:
            out.append("owner decision %s appears twice" % ident)
        seen.add(ident)
        for key in ("date", "by", "subject", "decision"):
            if not d.get(key):
                out.append("owner decision %s has no %s" % (ident, key))
        resolves = d.get("resolves") or []
        if not isinstance(resolves, list):
            out.append("owner decision %s: resolves must be a list" % ident)
            resolves = []
        for rid in resolves:
            if rid not in known_ids:
                out.append("owner decision %s resolves %s, which no question or dispute carries" % (ident, rid))
        for table in ("outcome", "open"):
            value = d.get(table) or {}
            if not isinstance(value, dict):
                out.append("owner decision %s: %s must be a table keyed by resolved id" % (ident, table))
                continue
            for key in value:
                if key not in resolves:
                    out.append("owner decision %s: %s names %s, which it does not resolve" % (ident, table, key))
        effects = d.get("effects") or {}
        if not isinstance(effects, dict):
            out.append("owner decision %s: effects must be a table" % ident)
            continue
        ref = effects.get("taxonomy_ref")
        if ref is not None and ref not in kingdom.REFS:
            out.append("owner decision %s: taxonomy_ref must be one of %s" % (ident, ", ".join(kingdom.REFS)))
        for item in effects.get("ownership") or []:
            if not (isinstance(item, dict) and item.get("provider") and isinstance(item.get("ids"), list)):
                out.append("owner decision %s: each ownership entry needs a provider and a list of ids" % ident)
        by_layer = effects.get("sphere_by_layer")
        if by_layer is not None and not (isinstance(by_layer, dict) and by_layer
                                         and all(isinstance(v, str) and v for v in by_layer.values())):
            out.append("owner decision %s: sphere_by_layer must be a table of layer = sphere" % ident)
        if "hygiene_view" in effects and effects["hygiene_view"] is not True:
            out.append("owner decision %s: hygiene_view must be true" % ident)
    return out


def rules(rows):
    """What a build applies, later decisions winning: {authority {ref, decision} | None, layer
    {field, overrule, default, decision} | None, ownership [{provider, ids, basis, decision}],
    provider_status {provider: {status, decision, note}}, sphere {by_layer, decision} | None,
    hygiene {decision} | None, by_id {id: decision}}."""
    out = {"authority": None, "layer": None, "ownership": [], "provider_status": {}, "sphere": None, "hygiene": None,
           "by_id": {}}
    for d in owner_decisions(rows):
        effects = d.get("effects") if isinstance(d.get("effects"), dict) else {}
        out["by_id"][d["id"]] = d
        if effects.get("taxonomy_ref") in kingdom.REFS:
            out["authority"] = {"ref": effects["taxonomy_ref"], "decision": d["id"]}
        if isinstance(effects.get("layer_overrule"), str):
            out["layer"] = {"field": "layer", "overrule": effects["layer_overrule"],
                            "default": effects.get("layer_default"), "decision": d["id"]}
        for item in effects.get("ownership") or []:
            if isinstance(item, dict) and item.get("provider") and isinstance(item.get("ids"), list):
                out["ownership"].append({"provider": item["provider"], "ids": [i for i in item["ids"] if isinstance(i, str)],
                                         "basis": item.get("basis") or "owner decision", "decision": d["id"]})
        status = effects.get("provider_status")
        if isinstance(status, dict) and status.get("provider") and status.get("status"):
            out["provider_status"][status["provider"]] = {"status": status["status"], "decision": d["id"],
                                                          "note": status.get("note")}
        by_layer = effects.get("sphere_by_layer")
        if isinstance(by_layer, dict) and by_layer:
            out["sphere"] = {"by_layer": {k: v for k, v in by_layer.items() if isinstance(v, str) and v},
                             "decision": d["id"]}
        if effects.get("hygiene_view") is True:
            out["hygiene"] = {"decision": d["id"]}
    return out


def private_texts(curated):
    """({(decision id, question id): open text}, {decision id: [note]}) from the private curation
    (private/curated/decisions.toml [[open]] and [[note]], written by decisions --private-from).
    The committed file says what stays open in neutral words; the private text may name what it
    points at (resources, task ids), and the private views show it instead."""
    doc = ((curated or {}).get("private") or {}).get("decisions") or {}
    opens = {(r.get("decision"), r.get("question")): r["text"] for r in doc.get("open") or []
             if isinstance(r, dict) and isinstance(r.get("text"), str) and r["text"].strip()}
    notes = {}
    for row in doc.get("note") or []:
        if isinstance(row, dict) and isinstance(row.get("text"), str) and row["text"].strip():
            notes.setdefault(row.get("decision"), []).append(row["text"])
    return opens, notes


def private_problems(rows, opens, notes):
    """Private texts that refine nothing: an open text for a remainder the committed decision does
    not leave open, or a note for a decision that does not exist."""
    by_id = {d["id"]: d for d in owner_decisions(rows)}
    out = ["private open text for %s in %s refines nothing: that decision leaves no committed remainder there"
           % (qid, did) for did, qid in sorted(opens, key=str)
           if not ((by_id.get(did) or {}).get("open") or {}).get(qid)]
    out += ["private note for %s: no such owner decision" % did for did in sorted(notes, key=str) if did not in by_id]
    return out


def resolution(rows, opens=None):
    """{question or dispute id: {status, decided_by[], outcome[], open}}. A later decision that
    leaves nothing open about an id closes the remainder an earlier one left. opens: private
    refinements of a committed remainder (private_texts); the status still follows the committed
    file alone."""
    out = {}
    for d in owner_decisions(rows):
        outcome = d.get("outcome") if isinstance(d.get("outcome"), dict) else {}
        remainder = d.get("open") if isinstance(d.get("open"), dict) else {}
        for rid in d.get("resolves") or []:
            entry = out.setdefault(rid, {"status": DECIDED, "decided_by": [], "outcome": [], "open": None})
            entry["decided_by"].append(d["id"])
            if outcome.get(rid):
                entry["outcome"].append(outcome[rid])
            entry["open"] = remainder.get(rid) or None
            entry["status"] = PARTLY if entry["open"] else DECIDED
            if entry["open"] and (d["id"], rid) in (opens or {}):
                entry["open"] = opens[(d["id"], rid)]
    return out


def apply(curated):
    """Give the curation's questions (committed and private) and disputes the status the owner
    decisions set: status, decided_by, outcome and open_text (the part still open). Adds
    owner_decisions and any shape problems. Idempotent; returns curated."""
    if curated.get("owner_decisions_applied"):
        return curated
    rows = curated.get("decisions") or []
    private_questions = ((curated.get("private") or {}).get("estate") or {}).get("question") or []
    tables = (curated.get("questions") or [], curated.get("disputes") or [], private_questions)
    known = {item.get("id") for table in tables for item in table if isinstance(item, dict)}
    opens, notes = private_texts(curated)
    found = resolution(rows, opens)
    for table in tables:
        for item in table:
            entry = found.get(item.get("id")) if isinstance(item, dict) else None
            if entry is not None:
                item.update(status=entry["status"], decided_by=list(entry["decided_by"]),
                            outcome=list(entry["outcome"]), open_text=entry["open"])
    curated["owner_decisions"] = owner_decisions(rows)
    curated["owner_notes"] = notes
    curated["owner_open_private"] = sorted("%s %s" % key for key in opens)
    curated.setdefault("problems", []).extend(problems(rows, known) + private_problems(rows, opens, notes))
    curated["owner_decisions_applied"] = True
    return curated


def primary_ref(cfg, decided):
    """Which kingdom-os ref the build reads as primary: {ref, basis decision|config|default,
    decision, config_ref, conflict}. An owner decision on the taxonomy authority wins; private
    config.toml [kingdom].ref applies only when there is none. A config pin that contradicts the
    decision is a conflict the run reports (degraded), and the decision is followed."""
    config_ref = ((cfg or {}).get("kingdom") or {}).get("ref")
    authority = (decided or {}).get("authority")
    if authority:
        return {"ref": authority["ref"], "basis": "decision", "decision": authority["decision"],
                "config_ref": config_ref, "conflict": config_ref is not None and config_ref != authority["ref"]}
    if config_ref:
        return {"ref": config_ref, "basis": "config", "decision": None, "config_ref": config_ref, "conflict": False}
    return {"ref": kingdom.WORKTREE, "basis": "default", "decision": None, "config_ref": None, "conflict": False}


def conflict_reason(info):
    """The degraded reason for a config pin that contradicts the authority decision, or None."""
    if not (info or {}).get("conflict"):
        return None
    return ("private config.toml pins [kingdom].ref = %s, which contradicts owner decision %s (taxonomy "
            "authority %s); the decision is followed. Align the pin with `estate decisions --sync-config "
            "--write`, or remove it" % (info.get("config_ref"), info.get("decision"), info.get("ref")))


def config_with_ref(text, ref):
    """config.toml text with [kingdom] ref set, comments and other tables kept as written."""
    quoted = '"%s"' % ref
    lines = text.splitlines()
    header = next((i for i, line in enumerate(lines) if line.strip() == "[kingdom]"), None)
    if header is None:
        return "[kingdom]\nref = %s\n" % quoted + ("\n" + text if text.strip() else "")
    end = next((i for i in range(header + 1, len(lines)) if lines[i].lstrip().startswith("[")), len(lines))
    for index in range(header + 1, end):
        if re.match(r"\s*ref\s*=", lines[index]):
            lines[index] = "ref = %s" % quoted
            break
    else:
        lines.insert(header + 1, "ref = %s" % quoted)
    return "\n".join(lines) + "\n"


def account_for(provider, accounts):
    """The estate's own account record of a provider: the only account row with that provider.
    None when there is none or more than one (the owner names which in the private curation)."""
    hits = [a for a in accounts if a.get("provider") == provider]
    return hits[0] if len(hits) == 1 else None


def effect_keys(decision):
    """(applied, not applied) effect keys of one decision, for the atlas."""
    effects = decision.get("effects") if isinstance(decision.get("effects"), dict) else {}
    applied = [k for k in effects if k in APPLIED]
    return applied, [k for k in effects if k not in APPLIED]
