"""Owner plans: a private plan whose item statuses only the owner sets.

The D8 hygiene plan (hygiene.py) and the ideas plan (ideas.py) are two of them, and this module holds what
they share. A Store names one kind of plan: its file in the private curation (private/curated/<kind>.json,
mode 0400 inside the 0500 dir, every write keeping the previous bytes as a new 0400 backup through
curate.keep_private), its schemas, the statuses the owner may set and those a plan itself may carry, and
the verb that changes it, which is the only writer.

The file holds the newest plan verbatim beside what the estate adds per item: the owner's status (with a
log), when the item was first and last in a plan, since when it is missing from the newest one (an item is
never dropped), and whatever the kind keeps beside them (hygiene: the signals measured at import).
merge() takes a newer plan by stable item id and keeps every owner status; set_status() records one owner
status with a log entry; view() is the skeleton a build joins, each item with its effective status (the
owner's, else the plan's) and what its kind joins it with. Nothing here measures or decides a status.
"""
import difflib
import hashlib
import json
import os
from collections import Counter

import curate
import safety
from safety import GuardError, require

MODE = 0o400  # read-only between owner verbs: a hand edit would bypass the status log and the backup
MAX_BYTES = 16 << 20
# Text a note may not carry: the secret shapes of the privacy lint (a status note is never a value).
SECRET_SHAPED = ("hex", "token-prefix", "assignment")
IMPORT_COUNTS = ("added", "updated", "unchanged", "missing", "returned")


class Store:
    """One kind of owner plan. kind: its short name (the note lint's scope); label: what the views call
    the plan; noun: what they call one item; verb: the command that changes it; set_statuses: what the
    owner may set; plan_statuses: what a plan may carry (an import never sets anything else);
    default_status: the effective status of an item whose plan names none; kept: the per-item lists the
    estate keeps beside the plan; note: the file's own note."""

    def __init__(self, kind, label, noun, verb, plan_schema, schema, set_statuses, plan_statuses,
                 default_status=None, kept=(), note=""):
        self.kind, self.label, self.noun, self.verb = kind, label, noun, verb
        self.plan_schema, self.schema = plan_schema, schema
        self.private_file = "curated/%s.json" % kind
        self.set_statuses, self.plan_statuses = tuple(set_statuses), tuple(plan_statuses)
        self.default_status, self.kept, self.note = default_status, ("log",) + tuple(kept), note
        self.set_by = "owner (%s --set)" % verb


# ── the private file ────────────────────────────────────────────────────────────────────────

def doc_problems(store, doc):
    """Why the private file of this store cannot be used (empty when it can)."""
    if not isinstance(doc, dict):
        return ["not a JSON object"]
    out = []
    if doc.get("schema") != store.schema:
        out.append("schema must be %s, not %r" % (store.schema, doc.get("schema")))
    if not isinstance(doc.get("plan"), dict):
        out.append("plan must be an object")
    if not isinstance(doc.get("imports"), list):
        out.append("imports must be a list")
    items = doc.get("items")
    if not isinstance(items, list):
        return out + ["items must be a list"]
    seen = set()
    for item in items:
        ident = item.get("id") if isinstance(item, dict) else None
        if not isinstance(ident, str) or not ident or not isinstance(item.get("plan"), dict) \
                or item["plan"].get("id") != ident:
            out.append("an item has no id or no plan of its own")
            continue
        if ident in seen:
            out.append("%s appears twice" % ident)
        seen.add(ident)
        owner = item.get("owner")
        if owner is not None and not (isinstance(owner, dict) and owner.get("status") in store.set_statuses):
            out.append("%s: owner status must be one of %s" % (ident, ", ".join(store.set_statuses)))
        for key in store.kept:
            if not (isinstance(item.get(key), list) and all(isinstance(e, dict) for e in item[key])):
                out.append("%s: %s must be a list of objects" % (ident, key))
    return out


def load(store, path):
    """(doc, None) for a usable private file, else (None, reason): "missing", or why it is not."""
    raw, reason = safety.read_checked(path, MAX_BYTES)
    if raw is None:
        return None, reason
    try:
        doc = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        return None, "invalid json: %s" % exc
    problems = doc_problems(store, doc)
    return (None, "invalid: " + "; ".join(problems[:5])) if problems else (doc, None)


def read_plan(store, path, plan_problems):
    """(plan, sha256 of its bytes): the plan JSON at an absolute path, checked by the kind's
    plan_problems(plan); GuardError when unusable."""
    require(os.path.isabs(path), "--import needs an absolute path")
    raw, reason = safety.read_checked(path, MAX_BYTES)
    require(raw is not None, "cannot read %s: %s" % (path, reason))
    try:
        plan = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as exc:
        raise GuardError("%s is not JSON: %s" % (path, exc)) from exc
    problems = plan_problems(plan)
    require(not problems, "%s is not a usable %s plan: %s" % (path, store.plan_schema, "; ".join(problems[:10])))
    return plan, hashlib.sha256(raw).hexdigest()


def text_of(doc):
    return json.dumps(doc, indent=1, ensure_ascii=False) + "\n"


# ── import: merge by stable id ──────────────────────────────────────────────────────────────

def merge(store, plan, doc, source_sha256, now_iso, added=None, kept=None, import_extra=None):
    """(new doc, counts): plan merged into doc by item id. A known item takes the new plan's words and
    keeps the owner's status and log; a new item starts with no owner status; an item the plan no
    longer lists is kept and marked missing since the plan's observed_at. added(item plan) gives a new
    item's kept fields, kept(item plan, old item) a known item's, both beyond its log; import_extra is
    written into the import log entry. The old doc itself comes back when nothing but the import log would
    change. Nothing is written here."""
    observed = plan["observed_at"]
    old_items = {i["id"]: i for i in (doc or {}).get("items") or []}
    counts = Counter()
    items = []
    for item_plan in plan["items"]:
        old = old_items.pop(item_plan["id"], None)
        if old is None:
            counts["added"] += 1
            items.append(dict({"id": item_plan["id"], "plan": item_plan, "first_seen": observed, "last_seen": observed,
                               "missing_since": None, "owner": None, "log": []}, **(added(item_plan) if added else {})))
            continue
        counts["updated" if old["plan"] != item_plan else "unchanged"] += 1
        if old.get("missing_since"):
            counts["returned"] += 1
        if old.get("owner"):
            counts["owner_status_kept"] += 1
        items.append(dict(old, plan=item_plan, last_seen=observed, missing_since=None,
                          **(kept(item_plan, old) if kept else {})))
    for old in old_items.values():
        counts["missing"] += 1
        items.append(dict(old, missing_since=old.get("missing_since") or observed))
    new = {"schema": store.schema, "note": store.note, "plan": {k: v for k, v in plan.items() if k != "items"},
           "items": items, "imports": list((doc or {}).get("imports") or [])}
    counts["items"] = len(items)
    if doc is not None and {k: v for k, v in new.items() if k != "imports"} == \
            {k: v for k, v in doc.items() if k != "imports"}:
        return doc, counts
    new["imports"].append(dict({"at": now_iso, "source_sha256": source_sha256, "schema": plan["schema"],
                                "observed_at": observed, "generated_at": plan.get("generated_at")},
                               **(import_extra or {}), **{k: counts[k] for k in IMPORT_COUNTS}))
    return new, counts


# ── an owner status change ──────────────────────────────────────────────────────────────────

def note_problems(store, note):
    if note is None:
        return []
    findings = curate.lint_text(note, "%s-note" % store.kind, "code")
    return sorted({f["rule"] for f in findings if f["rule"] in SECRET_SHAPED})


def effective(store, item):
    """(status, basis): the owner's status when one is set, else the plan's (else the store's default)."""
    owner = item.get("owner")
    return (owner["status"], "owner") if owner else (item["plan"].get("status") or store.default_status, "plan")


def set_status(store, doc, ident, status, note, now_iso):
    """(new doc, before, after): the item's owner status set, with a log entry; after is before when the
    owner already set this status (and note). GuardError for an unknown id or status, or a note shaped
    like a secret."""
    require(status in store.set_statuses, "--status must be one of %s" % ", ".join(store.set_statuses))
    bad = note_problems(store, note)
    require(not bad, "the note looks like it holds a secret value (%s); a note says what was done, never "
                     "with what" % ", ".join(bad))
    index = next((n for n, i in enumerate(doc["items"]) if i["id"] == ident), None)
    require(index is not None, "no %s %r in private/%s" % (store.noun, ident, store.private_file))
    item = doc["items"][index]
    owner = item.get("owner") or {}
    if owner.get("status") == status and note in (None, owner.get("note")):
        return doc, item, item
    before = effective(store, item)
    entry = {"at": now_iso, "from": before[0], "to": status, "note": note, "by": store.set_by}
    changed = dict(item, owner={"status": status, "at": now_iso, "note": note},
                   log=list(item.get("log") or []) + [entry])
    items = list(doc["items"])
    items[index] = changed
    return dict(doc, items=items), item, changed


def status_diff(store, before, after):
    """A unified diff of one item's estate fields, the plan's words left out."""
    def lines(item):
        shown = {k: item.get(k) for k in ("id", "owner", "log", "missing_since")}
        return (json.dumps(shown, indent=1, ensure_ascii=False) + "\n").splitlines(True)
    return "".join(difflib.unified_diff(lines(before), lines(after),
                                        fromfile="%s %s (now)" % (store.private_file, before["id"]),
                                        tofile="%s %s (%s --set)" % (store.private_file, after["id"], store.verb)))


# ── the view a build renders ────────────────────────────────────────────────────────────────

def view(store, doc, reason, join_item, summary, decision=None, run_id=None):
    """The view a build renders: {status ok|none|invalid, reason, degraded, file, decision, run_id, plan,
    imports, items[], counts}. join_item(item) gives what the kind joins one item with; summary(view) its
    counts. A missing file is degraded only when an owner decision places the plan there; an invalid one
    always is. Each item carries its plan, effective status and basis, owner and log, and its join."""
    out = {"status": "ok", "reason": None, "degraded": None, "file": "private/" + store.private_file,
           "decision": decision, "run_id": run_id, "plan": None, "imports": [], "items": [], "counts": {}}
    if doc is None:
        out.update(status="none" if reason in (None, "missing") else "invalid", reason=reason or "missing")
        if out["status"] == "invalid" or decision:
            out["degraded"] = "the private %s (private/%s) is %s%s" % (
                store.label, store.private_file, out["reason"],
                "; owner decision %s places it there" % decision if decision else "")
        out["counts"] = summary(out)
        return out
    for item in doc["items"]:
        status, basis = effective(store, item)
        out["items"].append(dict(item, status=status, status_basis=basis, join=join_item(item)))
    out.update(plan=doc["plan"], imports=doc.get("imports") or [])
    out["counts"] = summary(out)
    return out
