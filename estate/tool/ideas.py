"""The ideas plan: business ideas as proposals whose statuses only the owner sets.

An idea is a proposal, never a capability value, a wire or a motif: it names something the business could
wire, adopt, merge, quarantine, fill in or retire. Ideas carry business plans, so they are private: one file
of the private curation, private/curated/ideas.json, an owner plan (plans.py) like the D8 hygiene plan,
mode 0400 inside the 0500 dir, changed only by `estate ideas` (--import, --set), each write keeping the
previous bytes as a new 0400 backup. Nothing of it is committed.

A plan (schema estate.ideas/1, written outside this tool) lists ideas by stable id with a title, a kind and,
optionally, what would back it once built: a curated wire reading a code_state (and stage), a motif reading a
state, a capability held by a record (with an impl or operating claim), or a record present in the run. Each
backing entry may carry only its own kind's keys (QUALIFIERS), and each value it asks for must be one a build
can measure (vocabularies), so an imported plan always joins and every verdict means what it says. An
import can only propose: every status beyond proposed is the owner's, set one at a time with --set and kept
across imports. Each build joins every idea with this run's measurements of its backing: backed when all of
it holds, not-backed when some is measured not to, not-measured when what decides it could not be read, and
no-backing when the idea names none. An idea the owner marks done that is not backed raises QUEUE
idea-done-unbacked: a reason to look again, never a change to the owner's status.
"""
from collections import Counter

import capability
import motifs
import plans
import wires

PLAN_SCHEMA = "estate.ideas/1"
SCHEMA = "estate.ideas-curation/1"
SET_STATUSES = ("proposed", "accepted", "declined", "deferred", "done")
PROPOSED, DONE = "proposed", "done"
STORE = plans.Store("ideas", "ideas plan", "idea", "estate ideas", PLAN_SCHEMA, SCHEMA, SET_STATUSES, (PROPOSED,),
                    default_status=PROPOSED,
                    note="Business ideas as proposals, private. Statuses are the owner's: changed only by "
                         "`estate ideas --import` (which only proposes) and `estate ideas --set`.")
PRIVATE_FILE = STORE.private_file
MODE = plans.MODE
CLOSED = ("declined", "done")
KINDS = ("merge", "wire", "adopt-motif", "quarantine", "fill-gap", "retire")
BACKING_KEYS = ("wire", "motif", "capability", "record")
# What each kind of backing may ask for beyond its name; a capability may also name the record holding it.
QUALIFIERS = {"wire": ("code_state", "stage"), "motif": ("state",), "capability": ("impl", "operating"), "record": ()}
VERDICTS = ("backed", "not-backed", "not-measured", "no-backing")
BACKED, NOT_BACKED, NOT_MEASURED, NO_BACKING = VERDICTS


# ── the plan ────────────────────────────────────────────────────────────────────────────────

def vocabularies(facets):
    """{qualifier: the values a backed_by entry may ask for}: those a build can measure. A wanted stage or
    motif state of unknown or not-measured could never hold, so neither is one; impl and operating come from
    vocab/facets.toml."""
    return {"code_state": wires.CODE_STATES, "stage": tuple(s for s in wires.STAGES if s != "unknown"),
            "state": tuple(s for s in motifs.STATES if s != motifs.NOT_MEASURED),
            "impl": capability.vocabulary(facets, "capability_impl"),
            "operating": capability.vocabulary(facets, "capability_operating")}


def _backing_problems(ident, ref, capability_values, allowed):
    if not isinstance(ref, dict):
        return ["%s: each backed_by entry must be a table" % ident]
    named = [key for key in BACKING_KEYS if key in ref]
    if len(named) != 1 and named != ["capability", "record"]:
        return ["%s: a backed_by entry names exactly one of wire, motif, capability or record (a capability may "
                "add the record holding it)" % ident]
    out = ["%s: backed_by %s must be a non-empty string" % (ident, key) for key in named
           if not isinstance(ref.get(key), str) or not ref[key].strip()]
    kind = named[0]
    own = QUALIFIERS[kind]
    stray = sorted(str(key) for key in ref if key not in named and key not in own)
    if stray:
        out.append("%s: backed_by %s does not take %s (it takes %s)" % (
            ident, kind, ", ".join(stray), ", ".join(own) if own else "nothing more"))
    for key in own:
        if key in ref and ref[key] not in allowed[key]:
            out.append("%s: backed_by %s %s %r is not one of %s" % (ident, kind, key, ref[key], ", ".join(allowed[key])))
    if "capability" in ref and ref.get("capability") not in capability_values:
        out.append("%s: backed_by capability %r is not a capability value" % (ident, ref.get("capability")))
    return out


def plan_problems(plan, facets):
    """Why a plan cannot be imported (empty when it can), its backing checked against the vocabularies of
    facets (vocab/facets.toml): the capability values and what each backing may ask for."""
    if not isinstance(plan, dict):
        return ["the plan must be a JSON object"]
    out = []
    if plan.get("schema") != PLAN_SCHEMA:
        out.append("schema must be %s, not %r" % (PLAN_SCHEMA, plan.get("schema")))
    if not isinstance(plan.get("observed_at"), str) or not plan["observed_at"]:
        out.append("observed_at must be a non-empty string")
    items = plan.get("items")
    if not isinstance(items, list) or not items:
        return out + ["items must be a non-empty list"]
    capability_values, allowed = capability.values(facets), vocabularies(facets)
    seen = set()
    for n, item in enumerate(items):
        if not isinstance(item, dict):
            out.append("item %d is not an object" % n)
            continue
        ident = item.get("id") if isinstance(item.get("id"), str) and item["id"].strip() else None
        where = ident or "item %d" % n
        if ident is None:
            out.append("%s: id must be a non-empty string" % where)
        elif any(c.isspace() for c in ident):
            out.append("%s: id must have no spaces" % where)
        elif ident in seen:
            out.append("%s appears twice" % ident)
        seen.add(ident)
        if not isinstance(item.get("title"), str) or not item["title"].strip():
            out.append("%s: title must be a non-empty string" % where)
        if item.get("kind") not in KINDS:
            out.append("%s: kind %r is not one of %s" % (where, item.get("kind"), ", ".join(KINDS)))
        if item.get("status", PROPOSED) not in STORE.plan_statuses:
            out.append("%s: status %r: an import only proposes; the owner sets every other status with "
                       "estate ideas --set" % (where, item.get("status")))
        related = item.get("related_records", [])
        if not (isinstance(related, list) and all(isinstance(r, str) for r in related)):
            out.append("%s: related_records must be a list of strings" % where)
        backing = item.get("backed_by", [])
        if not isinstance(backing, list):
            out.append("%s: backed_by must be a list" % where)
            continue
        for ref in backing:
            out += _backing_problems(where, ref, capability_values, allowed)
    return out


def read_plan(path, facets):
    """(plan, sha256): the plan JSON at an absolute path, checked against the vocabularies of facets;
    GuardError when unusable."""
    return plans.read_plan(STORE, path, lambda plan: plan_problems(plan, facets))


def load(path):
    """(doc, None) for a usable private file, else (None, reason): "missing", or why it is not."""
    return plans.load(STORE, path)


def merge(plan, doc, source_sha256, now_iso):
    """(new doc, counts): the plan merged into doc by idea id; every owner status kept (plans.merge)."""
    return plans.merge(STORE, plan, doc, source_sha256, now_iso)


def set_status(doc, ident, status, note, now_iso):
    """(new doc, before, after): the owner's status of one idea, with a log entry (plans.set_status)."""
    return plans.set_status(STORE, doc, ident, status, note, now_iso)


def effective(item):
    return plans.effective(STORE, item)


def status_diff(before, after):
    return plans.status_diff(STORE, before, after)


text_of = plans.text_of


# ── the join a build renders ────────────────────────────────────────────────────────────────

def _holding(record, value):
    """The reading of a capability value on one record (a project's capability facet or a package's own), or
    None when it does not hold the value."""
    field = (record.get("facets") or {}).get("capability") if record.get("kind") == "project" else record.get("capability")
    field = field or {}
    if field.get("basis") == capability.MIRROR or value not in (field.get("values") or []):
        return None
    return (field.get("by_value") or {}).get(value) or {}


def check_backing(ref, by_id, wire_rows, motif_rows):
    """(holds: True, False or None when it could not be measured, detail) for one backed_by entry, against
    this run's records (by_id), curated wires (wire_rows: {name: evaluated row}) and motifs (motif_rows)."""
    if "wire" in ref:
        row = wire_rows.get(ref["wire"])
        if row is None:
            return False, "no curated wire %s in this run" % ref["wire"]
        wanted_state, wanted_stage = ref.get("code_state", "wired"), ref.get("stage")
        if row.get("code_state") is None or (wanted_stage and row.get("stage") == "unknown"):
            return None, "wire %s was not measured (%s)" % (ref["wire"], row.get("reason") or row.get("stage_reason"))
        holds = row["code_state"] == wanted_state and (not wanted_stage or row.get("stage") == wanted_stage)
        return holds, "wire %s measures %s, %s; wanted %s%s" % (ref["wire"], row["code_state"], row.get("stage"),
                                                                 wanted_state, ", %s" % wanted_stage if wanted_stage else "")
    if "motif" in ref:
        row = motif_rows.get(ref["motif"])
        wanted = ref.get("state", "adopted")
        if row is None:
            return False, "no curated motif %s in this run" % ref["motif"]
        if row.get("state") == "not-measured":
            return None, "motif %s was not measured (%s)" % (ref["motif"], row.get("reason"))
        return row.get("state") == wanted, "motif %s reads %s; wanted %s" % (ref["motif"], row.get("state"), wanted)
    if "capability" in ref:
        value = ref["capability"]
        wanted = {k: ref[k] for k in ("impl", "operating") if ref.get(k)}
        candidates = [by_id.get(ref["record"])] if ref.get("record") else [
            r for r in by_id.values() if r.get("kind") in ("project", "package")]
        if ref.get("record") and (candidates[0] is None or candidates[0].get("presence", "present") != "present"):
            return None, "record %s is not present in this run" % ref["record"]
        holders = [(r["id"], reading) for r in candidates if r.get("presence", "present") == "present"
                   for reading in [_holding(r, value)] if reading is not None
                   and all(reading.get(k) == v for k, v in wanted.items())]
        return bool(holders), "capability %s%s held by %s" % (
            value, " (%s)" % ", ".join("%s %s" % kv for kv in sorted(wanted.items())) if wanted else "",
            ", ".join(rid for rid, _ in holders[:5]) or "no record of this run")
    record = by_id.get(ref["record"])
    presence = (record or {}).get("presence", "present") if record is not None else None
    if presence == "missing":
        return None, "record %s is missing from this run (not read)" % ref["record"]
    return presence == "present", "record %s is %s" % (ref["record"], presence or "not in this run")


def join_item(item, by_id, wire_rows, motif_rows):
    """What this run measures of one idea's backing: its verdict and each entry with what was found."""
    refs = item["plan"].get("backed_by") or []
    if by_id is None:
        return {"verdict": None, "backing": []}
    backing = []
    for ref in refs:
        holds, detail = check_backing(ref, by_id, wire_rows, motif_rows)
        backing.append({"ref": ref, "holds": holds, "detail": detail})
    if not refs:
        verdict = NO_BACKING
    elif any(b["holds"] is False for b in backing):
        verdict = NOT_BACKED
    elif any(b["holds"] is None for b in backing):
        verdict = NOT_MEASURED
    else:
        verdict = BACKED
    return {"verdict": verdict, "backing": backing}


def join(doc, reason, records, wires_view=None, motifs_view=None, run_id=None):
    """The view a build renders (plans.view): every idea with its effective status (the owner's, else
    proposed) and its backing measured in this run. records: the run's records (None when no run is at
    hand: nothing is joined); wires_view and motifs_view: the run's wires and motifs (wires.summary,
    motifs.summary). A missing file is no plan yet, never degraded; an invalid one degrades the run."""
    by_id = {r["id"]: r for r in records if isinstance(r, dict) and r.get("id")} if records is not None else None
    wire_rows = {r["name"]: r for r in (wires_view or {}).get("rows") or []}
    motif_rows = {r["name"]: r for r in (motifs_view or {}).get("rows") or []}
    return plans.view(STORE, doc, reason, lambda item: join_item(item, by_id, wire_rows, motif_rows), summary,
                      run_id=run_id)


def summary(view):
    """Counts only (no ids or titles): what run.json says about the ideas plan."""
    items = view.get("items") or []

    def by(key):
        return dict(sorted(Counter(key(i) for i in items).items()))
    return {"status": view.get("status"), "items": len(items), "missing": sum(1 for i in items if i.get("missing_since")),
            "observed_at": (view.get("plan") or {}).get("observed_at"), "by_status": by(lambda i: i["status"]),
            "by_kind": by(lambda i: i["plan"].get("kind")), "by_verdict": by(lambda i: i["join"]["verdict"] or "not joined"),
            "done_unbacked": len(done_unbacked(items))}


def done_unbacked(items):
    """The ideas the owner marked done whose backing this run does not show (not backed, not measured or
    none named)."""
    return [i for i in items if i.get("status") == DONE and (i.get("join") or {}).get("verdict") not in (BACKED, None)]


def queue_items(view):
    """QUEUE idea-done-unbacked: an idea marked done that this run's measurements do not back."""
    return [{"reason": "idea-done-unbacked", "id": i["id"], "detail": "marked done by the owner; backing %s%s" % (
        i["join"]["verdict"], ": " + "; ".join(b["detail"] for b in i["join"]["backing"] if b["holds"] is not True)
        if i["join"]["backing"] else " (the idea names none)")} for i in done_unbacked(view.get("items") or [])]


def filtered(items, status=None, kind=None):
    """Ideas matching every given filter (case-insensitive; status is the effective one)."""
    def same(value, wanted):
        return wanted is None or str(value or "").lower() == wanted.lower()
    return [i for i in items if same(i["status"], status) and same(i["plan"].get("kind"), kind)]
