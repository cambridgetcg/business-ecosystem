"""The hygiene plan of owner decision D8: every hygiene issue and what needs to be done.

D8 (dec-2026-10-17-9) asks for a plan, not execution. The plan (schema estate.hygiene/1, written by a
survey outside this tool) names where secrets and single copies live, so it is private: it lives in
one file of the private curation, private/curated/hygiene.json, mode 0400 inside the 0500 dir, and
changes only through `estate hygiene` (--import, --set), each write keeping the previous bytes as a
new 0400 backup (curate.keep_private). It is an owner plan (plans.py): the file, the merge by item id,
the owner's status and its log are the ones every owner plan shares; this module adds the plan's own
shape, the baseline and the join.

The file holds the newest plan verbatim beside what the estate adds per item: the owner's status
(with a log), when the item was first and last in a plan, since when it is missing from the newest
one (an item is never dropped), and a baseline: the signals the estate itself measured on the item's
related records when the plan was imported. A build joins every item with the same measurements
again (join), so an item whose signals have all cleared reads "no longer observed" without anyone
editing it. That is a signal beside the plan, never a verdict on the fix: the status stays the
owner's.
"""
from collections import Counter

import curate
import plans

PLAN_SCHEMA = "estate.hygiene/1"
SCHEMA = "estate.hygiene-curation/1"
SET_STATUSES = ("open", "in-progress", "in-progress-elsewhere", "done", "declined")
# A plan may also record an issue it found already resolved; only the plan says that.
PLAN_STATUSES = SET_STATUSES + ("mitigated",)
STORE = plans.Store("hygiene", "hygiene plan", "hygiene item", "estate hygiene", PLAN_SCHEMA, SCHEMA, SET_STATUSES,
                    PLAN_STATUSES, kept=("baseline",),
                    note="The D8 hygiene plan, private: it names where secrets live, never their values. "
                         "Changed only by `estate hygiene --import` and `estate hygiene --set`.")
PRIVATE_FILE = STORE.private_file
MODE = plans.MODE
CLOSED = ("done", "declined", "mitigated")
ELSEWHERE = "in-progress-elsewhere"
SET_BY = STORE.set_by
ITEM_TEXT = ("id", "title", "area", "severity", "status", "wave")
ITEM_LISTS = ("where", "actions", "depends_on", "related_records", "related_items", "lens_ids")

OBSERVED, CLEARED, UNKNOWN_NOW, NOT_OBSERVED, NOT_MEASURED = (
    "observed", "no longer observed", "unknown now", "not observed", "not measured")
# A plan's related ids may name owner decisions, questions and disputes beside records: those are
# references to the curation, resolved there, never "missing from the run".
REFERENCE_PREFIXES = ("dec-", "q:", "dispute:")


# ── what the estate already measures ────────────────────────────────────────────────────────
# Each check reads one record of a run and returns None when it does not apply to that record,
# else (True observed | False measured absent | None unknown, detail).

def _present(record):
    return record.get("presence", "present") == "present"


def _failing(record):
    if record.get("kind") != "scheduler":
        return None
    if not _present(record):
        return False, "job %s" % record.get("presence")  # a removed job fails no more
    health = record.get("health") or {}
    state = health.get("state")
    if state == "failing":
        return True, "failing (%s)" % health.get("basis")
    if state in ("healthy", "disabled"):
        return False, state
    return None, "health %s" % (state or "unknown")


def _tcc(record):
    if record.get("kind") != "scheduler":
        return None
    if not _present(record):
        return False, "job %s" % record.get("presence")
    value = record.get("tcc_exposed")
    return (value, "targets a protected folder" if value else "targets no protected folder") \
        if isinstance(value, bool) else (None, "folder protection unknown")


def _surface_state(record):
    if record.get("kind") != "surface":
        return None
    if not _present(record):
        return "absent", "surface %s in this run" % record.get("presence")
    health = record.get("health") or {}
    return health.get("state") or "unknown", "%s%s" % (health.get("state") or "unknown",
                                                        " %s" % health["code"] if health.get("code") else "")


def _serving(record):
    seen = _surface_state(record)
    if seen is None:
        return None
    state, detail = seen
    if state in ("up", "contradicted"):
        return True, "serving: " + detail
    return (False, detail) if state == "down" else (None, detail)


def _contradicted(record):
    seen = _surface_state(record)
    if seen is None:
        return None
    state, detail = seen
    if state == "contradicted":
        return True, detail
    return (False, detail) if state in ("up", "down") else (None, detail)


def _secret_file(record):
    # Only what the curation marks secret-bearing: presence of any other file is not the issue.
    if record.get("kind") != "artifact" or not record.get("secret_bearing"):
        return None
    status = record.get("status")
    if status == "present":
        return True, "present (names only)"
    return (False, "missing") if status == "missing" else (None, "status %s" % (status or "unknown"))


def _risk(key):
    word = curate.RISKS[key]
    measured = key in curate.MEASURED_RISKS

    def check(record):
        if record.get("kind") != "project":
            return None
        if word in (record.get("risks") or []):
            return True, word
        if not _present(record):
            return None, "project %s in this run" % record.get("presence")
        if not measured:
            return None, "%s is confirmed by curation, never refuted by measurement" % word
        if not ((record.get("measures") or {}).get("measured_checkouts") or 0):
            return None, "no measured checkout"
        return False, "no " + word
    return "risk:" + word, check


CHECKS = dict([("failing", _failing), ("tcc", _tcc), ("serving", _serving), ("contradicted", _contradicted),
               ("secret-file", _secret_file)]
              + [_risk(key) for key in ("silent", "hollow", "tcc", "single", "unpushed", "unsaved", "diverge",
                                        "stale", "prunable", "partial", "lender", "borrower", "secret-path")])
# The plan's areas, each with the measurements that can be the same thing as its issues. An area
# not listed is joined with nothing (a measured unknown beats a guess).
AREA_CHECKS = {
    "automation": ("failing", "tcc", "contradicted") + tuple("risk:" + curate.RISKS[k] for k in ("silent", "hollow", "tcc")),
    "durability": ("failing",) + tuple("risk:" + curate.RISKS[k] for k in ("single", "unpushed", "unsaved")),
    "repos": tuple("risk:" + curate.RISKS[k] for k in ("diverge", "stale", "prunable", "partial", "lender", "borrower")),
    "secrets": ("secret-file", "risk:" + curate.RISKS["secret-path"]),
    "exposure": ("serving", "secret-file"),
    "cloud": ("serving",),
    "agents": ("secret-file",),
}


def measure(item_plan, by_id):
    """{(record id, check): (value, detail)} for every check of the item's area that applies to one
    of its related records in this run; records the run does not hold are left out."""
    out = {}
    for rid in item_plan.get("related_records") or []:
        record = by_id.get(rid)
        if record is None:
            continue
        for name in AREA_CHECKS.get(item_plan.get("area")) or ():
            result = CHECKS[name](record)
            if result is not None:
                out[(rid, name)] = result
    return out


# ── the private file ────────────────────────────────────────────────────────────────────────

def plan_problems(plan):
    """Why a plan cannot be imported (empty when it can). Structure and enums are checked here;
    references to ids that are not items are notes (plan_notes), not refusals."""
    if not isinstance(plan, dict):
        return ["the plan must be a JSON object"]
    out = []
    if plan.get("schema") != PLAN_SCHEMA:
        out.append("schema must be %s, not %r" % (PLAN_SCHEMA, plan.get("schema")))
    if not isinstance(plan.get("observed_at"), str) or not plan["observed_at"]:
        out.append("observed_at must be a non-empty string")
    scale = plan.get("severity_scale")
    if not isinstance(scale, dict) or not scale:
        out.append("severity_scale must be a non-empty table")
        scale = {}
    waves = plan.get("waves") if isinstance(plan.get("waves"), list) else None
    if waves is None:
        out.append("waves must be a list")
    for wave in waves or []:
        groups = wave.get("groups", []) if isinstance(wave, dict) else None
        if not (isinstance(wave, dict) and isinstance(wave.get("name"), str) and isinstance(groups, list)
                and all(isinstance(g, dict) and isinstance(g.get("items", []), list) for g in groups)):
            out.append("each wave needs a name and a list of groups, each with a list of items")
    names = {w.get("name") for w in waves or [] if isinstance(w, dict)}
    items = plan.get("items")
    if not isinstance(items, list) or not items:
        return out + ["items must be a non-empty list"]
    seen = set()
    for n, item in enumerate(items):
        where = "item %d" % n
        if not isinstance(item, dict):
            out.append("%s is not an object" % where)
            continue
        for key in ITEM_TEXT:
            if not isinstance(item.get(key), str) or not item[key].strip():
                out.append("%s: %s must be a non-empty string" % (item.get("id") or where, key))
        for key in ITEM_LISTS:
            value = item.get(key, [])
            if not (isinstance(value, list) and all(isinstance(v, str) for v in value)):
                out.append("%s: %s must be a list of strings" % (item.get("id") or where, key))
        ident = item.get("id")
        if not isinstance(ident, str):
            continue
        if any(c.isspace() for c in ident):
            out.append("%s: id must have no spaces" % where)
        if ident in seen:
            out.append("%s appears twice" % ident)
        seen.add(ident)
        if scale and item.get("severity") not in scale:
            out.append("%s: severity %r is not in severity_scale" % (ident, item.get("severity")))
        if item.get("status") not in PLAN_STATUSES:
            out.append("%s: status %r is not one of %s" % (ident, item.get("status"), ", ".join(PLAN_STATUSES)))
        if waves is not None and item.get("wave") not in names:
            out.append("%s: wave %r is not a wave of the plan" % (ident, item.get("wave")))
    return out


def plan_notes(plan):
    """References in a valid plan that name no item, and areas no estate check covers."""
    ids = {i["id"] for i in plan["items"]}
    notes = []
    for wave in plan.get("waves") or []:
        for group in wave.get("groups") or []:
            notes += ["wave %r group %r names %s, which is not an item" % (wave.get("name"), group.get("name"), i)
                      for i in group.get("items") or [] if i not in ids]
    for item in plan["items"]:
        notes += ["%s %s %s, which is not an item" % (item["id"], key, ref)
                  for key in ("depends_on", "related_items") for ref in item.get(key) or [] if ref not in ids]
    areas = sorted({i["area"] for i in plan["items"]} - set(AREA_CHECKS))
    if areas:
        notes.append("areas with no estate measurement (their items are joined with nothing): " + ", ".join(areas))
    return notes


def doc_problems(doc):
    """Why the private file cannot be used (empty when it can)."""
    return plans.doc_problems(STORE, doc)


def load(path):
    """(doc, None) for a usable private file, else (None, reason): "missing", or why it is not."""
    return plans.load(STORE, path)


def read_plan(path):
    """(plan, sha256): the plan JSON at an absolute path, checked; GuardError when unusable."""
    return plans.read_plan(STORE, path, plan_problems)


text_of = plans.text_of


# ── import: merge by stable id ──────────────────────────────────────────────────────────────

def baseline_of(item_plan, by_id, run):
    """The signals observed now on the item's related records, stamped with the run they came from."""
    return [{"record": rid, "check": name, "detail": detail, "run": run.get("id"), "at": run.get("observed_at")}
            for (rid, name), (value, detail) in sorted(measure(item_plan, by_id).items()) if value is True]


def _union(old, new):
    """The baseline keeps every signal it has seen, each with the run that first saw it."""
    keys = {(b.get("record"), b.get("check")) for b in old}
    return list(old) + [b for b in new if (b["record"], b["check"]) not in keys]


def merge(plan, doc, by_id, run, source_sha256, now_iso):
    """(new doc, counts, notes): plan merged into doc by item id (plans.merge). A known item takes the
    new plan's words and keeps the owner's status, log and baseline (gaining the signals seen now); a
    new item starts with no owner status and the signals seen now; an item the plan no longer lists is
    kept and marked missing since the plan's observed_at. Nothing is written here."""
    new, counts = plans.merge(
        STORE, plan, doc, source_sha256, now_iso,
        added=lambda item_plan: {"baseline": baseline_of(item_plan, by_id, run)},
        kept=lambda item_plan, old: {"baseline": _union(old.get("baseline") or [], baseline_of(item_plan, by_id, run))},
        import_extra={"baseline_run": run.get("id"), "baseline_observed_at": run.get("observed_at")})
    counts["baseline_signals"] = sum(len(i["baseline"]) for i in new["items"])
    return new, counts, plan_notes(plan)


# ── an owner status change ──────────────────────────────────────────────────────────────────

def note_problems(note):
    return plans.note_problems(STORE, note)


def set_status(doc, ident, status, note, now_iso):
    """(new doc, before, after): the item's owner status set, with a log entry; after is before
    when the owner already set this status (and note). GuardError for an unknown id or status, or a
    note shaped like a secret."""
    return plans.set_status(STORE, doc, ident, status, note, now_iso)


def effective(item):
    """(status, basis): the owner's status when one is set, else the plan's."""
    return plans.effective(STORE, item)


def status_diff(before, after):
    """A unified diff of one item's estate fields, the plan's words left out."""
    return plans.status_diff(STORE, before, after)


# ── the join a build renders ────────────────────────────────────────────────────────────────

def is_reference(ident):
    return isinstance(ident, str) and ident.startswith(REFERENCE_PREFIXES)


def reference_status(curated):
    """{decision, question or dispute id: its status in words} from the curation, with the owner
    decisions applied (model.load_curated): what a plan's reference ids point at."""
    out = {}
    for d in (curated or {}).get("owner_decisions") or []:
        out[d["id"]] = "owner decision%s: %s" % (" " + d["label"] if d.get("label") else "", d.get("subject"))
    for row in (curated or {}).get("decisions") or []:
        if isinstance(row, dict) and row.get("id") and row["id"] not in out:
            out[row["id"]] = "decision (%s)" % (row.get("kind") or "proposal")
    private = (((curated or {}).get("private") or {}).get("estate") or {}).get("question") or []
    for item in list((curated or {}).get("questions") or []) + list(private) + list((curated or {}).get("disputes") or []):
        if isinstance(item, dict) and item.get("id"):
            status = item.get("status") or "open"
            out.setdefault(item["id"], "%s%s" % (status, " by " + ", ".join(item["decided_by"])
                                                  if item.get("decided_by") else ""))
    return out


def decided_elsewhere(by_id):
    """{record id: (status, decision, account)} for every record tied to an account an owner
    decision gave a provider status (D6: in-progress-elsewhere), as the model attributes them."""
    out = {}
    for record in by_id.values():
        status = record.get("decided_status") if record.get("kind") == "account" else None
        if not status:
            continue
        ids = [record["id"]] + list(record.get("credential_artifacts") or []) + list(record.get("used_by") or [])
        ids += [o.get("id") for o in record.get("owns") or [] if isinstance(o, dict)]
        for rid in ids:
            out.setdefault(rid, (status.get("status"), status.get("decision"), record["id"]))
    return out


def join_item(item, by_id, elsewhere, refs=None):
    """What the estate measures now about one item's related records, against its baseline.
    refs: reference_status(); a related id that is a reference is resolved there, not in the run."""
    item_plan = item["plan"]
    checks = AREA_CHECKS.get(item_plan.get("area"))
    now = measure(item_plan, by_id) if by_id is not None else {}
    observed = [{"record": r, "check": c, "detail": d} for (r, c), (v, d) in sorted(now.items()) if v is True]
    cleared, unknown = [], []
    for base in item.get("baseline") or []:
        value, detail = now.get((base.get("record"), base.get("check")), (None, "not measured in this run"))
        if value is True:
            continue
        (cleared if value is False else unknown).append(dict(base, now=detail))
    if by_id is None:
        verdict = None
    elif checks is None:
        verdict = NOT_MEASURED
    elif observed:
        verdict = OBSERVED
    elif item.get("baseline"):
        verdict = CLEARED if not unknown else UNKNOWN_NOW
    else:
        verdict = NOT_OBSERVED if any(v is False for v, _d in now.values()) else NOT_MEASURED
    related = item_plan.get("related_records") or []
    return {"verdict": verdict, "checks": list(checks) if checks is not None else None, "observed": observed,
            "cleared": cleared, "unknown": unknown,
            "not_in_run": [r for r in related if by_id is not None and r not in by_id and not is_reference(r)],
            "references": [{"id": r, "status": (refs or {}).get(r) or "not in the curation"}
                           for r in related if is_reference(r)],
            "elsewhere": [{"record": r, "status": elsewhere[r][0], "decision": elsewhere[r][1],
                           "account": elsewhere[r][2]} for r in related if r in elsewhere]}


def join(doc, reason, records, decision=None, run_id=None, refs=None):
    """The view a build renders (plans.view): {status ok|none|invalid, reason, degraded, plan, imports,
    items[], counts}. records: the run's records (None when no run is at hand: nothing is joined); refs:
    reference_status() of the curation. Each item carries its plan, effective status and basis,
    owner and log, and join_item's result."""
    by_id = {r["id"]: r for r in records if isinstance(r, dict) and r.get("id")} if records is not None else None
    elsewhere = decided_elsewhere(by_id or {})
    return plans.view(STORE, doc, reason, lambda item: join_item(item, by_id, elsewhere, refs), summary, decision, run_id)


def summary(view):
    """Counts only (no ids or titles): what run.json and the Decided section say about the plan."""
    items = view.get("items") or []
    present = [i for i in items if not i.get("missing_since")]

    def by(key):
        return dict(sorted(Counter(key(i) for i in items).items()))
    return {"status": view.get("status"), "items": len(items), "missing": len(items) - len(present),
            "observed_at": (view.get("plan") or {}).get("observed_at"),
            "by_status": by(lambda i: i["status"]), "by_severity": by(lambda i: i["plan"].get("severity")),
            "by_wave": by(lambda i: i["plan"].get("wave")),
            "by_verdict": by(lambda i: i["join"]["verdict"] or "not joined"),
            "open_cleared": sum(1 for i in items if i["status"] not in CLOSED and i["join"]["verdict"] == CLEARED),
            "closed_observed": sum(1 for i in items if i["status"] in CLOSED and i["join"]["verdict"] == OBSERVED),
            "elsewhere": sum(1 for i in items if i["status"] == ELSEWHERE)}


def filtered(items, wave=None, severity=None, status=None, area=None, needs_yu=None, agent_safe=None):
    """Items matching every given filter (case-insensitive; status is the effective one; needs_yu
    and agent_safe, when given, must be the plan's own booleans)."""
    def same(value, wanted):
        return wanted is None or str(value or "").lower() == wanted.lower()

    def flag(value, wanted):
        return wanted is None or value is wanted
    return [i for i in items if same(i["plan"].get("wave"), wave) and same(i["plan"].get("severity"), severity)
            and same(i["status"], status) and same(i["plan"].get("area"), area)
            and flag(i["plan"].get("needs_yu"), needs_yu) and flag(i["plan"].get("agent_safe"), agent_safe)]


def filter_values(doc):
    """{filter: values the plan holds} for --wave, --severity, --area and --status, so a typo is
    refused with the allowed values instead of listing nothing."""
    plan = doc.get("plan") or {}
    items = [i["plan"] for i in doc.get("items") or []]
    return {"wave": [w.get("name") for w in plan.get("waves") or [] if isinstance(w, dict) and w.get("name")],
            "severity": list(plan.get("severity_scale") or {}),
            "area": sorted({i.get("area") for i in items if i.get("area")}),
            "status": list(PLAN_STATUSES)}


def owner_split(items):
    """[(who, items)]: the plan's owner fields in four groups, for the who-acts summary."""
    groups = (("needs Yu and agent-safe", True, True), ("needs Yu only", True, False),
              ("agent-safe only", False, True), ("neither flag", False, False))
    return [(label, [i for i in items if (i["plan"].get("needs_yu") is True) == yu
                     and (i["plan"].get("agent_safe") is True) == agent]) for label, yu, agent in groups]
