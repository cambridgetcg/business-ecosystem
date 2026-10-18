"""The KINGDOM proposals queue (spec 10): rules P01-P17 over one snapshot.

The overlay never edits kingdom-os, a card or any other repository. Every rule turns a drift it
can see into a proposal with a stable id (prop:<rule>:<sha12(rule|file|record|field|proposed)>),
so the same drift keeps the same id run after run. Proposals for kingdom-os files carry patch
previews diffed against the origin/main blob with its blob sha pinned, and against the worktree
blob; their status says whether origin/main already made the change (resolved-upstream) or
changed the target differently (conflict-with-upstream). card_text is ready to paste and holds
only in-vocabulary values; basis notes sit on comment lines above each field, never inline,
because harvest reads an inline comment as part of the value. Owners decide through
curated/decisions.toml; nothing here writes. An owner decision (decisions.py) that settles what a
proposal asked turns it into the follow-up the decision calls for (P17), and the earlier proposal
is carried as superseded with that decision as its decision_ref. Every proposal carries its
subject's sphere (owner decision D4); the estate lists P09 and P12 for members of KINGDOM OS ahead of
the same rule for independent and undecided subjects (its own ordering, not part of D4; citizens
excepted), and no rule asks anything new of independent ones.
"""
import difflib
import hashlib
import json
import os
import re

import decisions
import kingdom
import model
import safety

SCHEMA = "estate.proposal/1"
KOS_REPO = kingdom.KOS_REMOTE_ID
ROSTER, REGISTRY, SITES, SCHEMA_MD, HARVEST = "roster.conf", "REGISTRY.yaml", "sites.json", "SCHEMA.md", "bin/harvest.ts"
HOT_FILES = (ROSTER, REGISTRY, SITES, SCHEMA_MD, HARVEST)
CARD = "kingdom.yaml"
MAX_BLOB = 1 << 20
LONG_OPEN_DAYS = 30
RULES = {
    "P01": "card-missing", "P02": "card-untracked", "P03": "card-off-enum", "P04": "card-state-vs-liveness",
    "P05": "card-name", "P06": "card-depends-unknown", "P07": "roster-row-drift", "P08": "roster-remote-but-present",
    "P09": "roster-absent", "P10": "layer-contested", "P11": "registry-field-drift", "P12": "registry-missing-surface",
    "P13": "sites-key-mismatch", "P14": "derived-map-stale", "P15": "foundation-divergence", "P16": "upstream-note",
    "P17": "decision-follow-up",
}
CARD_ORDER = ("name", "kind", "layer", "owner_sister", "domain", "state", "purpose", "dependsOn")
ROSTER_COLUMNS = kingdom.ROSTER_COLUMNS
DECISION_OUTCOMES = ("declined", "deferred", "accepted")
CARRIED = ("open", "conflict-with-upstream", "resolved-upstream")


# ── blobs ───────────────────────────────────────────────────────────────────────────────────

def rule_of(prop_id):
    """P01 from prop:P01:<sha12>; None for anything else."""
    parts = str(prop_id).split(":")
    return parts[1] if len(parts) == 3 and parts[0] == "prop" else None


def blob_id(data):
    """git's blob id (sha1 of "blob <size>\\0<data>"), computed locally: the pin of a patch preview."""
    return hashlib.sha1(b"blob %d\x00" % len(data) + data).hexdigest()


def read_blobs(foundation, files=HOT_FILES, git=None):
    """The hot kingdom-os files on both refs: {"worktree": {file: bytes|None}, "origin/main":
    {file: bytes|None}, "origin_main_commit", "reasons": {"<ref>:<file>": reason}}. The worktree
    is read with no-follow reads; origin/main through cat-file, which GitRunner refuses on a
    promisor clone (nothing is ever fetched)."""
    kos = (foundation or {}).get("kos_path")
    out = {kingdom.WORKTREE: {}, kingdom.ORIGIN_MAIN: {}, "origin_main_commit": None, "reasons": {}}
    if not kos:
        return out
    for rel in files:
        raw, reason = safety.read_checked(os.path.join(kos, rel), MAX_BLOB)
        out[kingdom.WORKTREE][rel] = raw
        if raw is None:
            out["reasons"]["worktree:" + rel] = reason
    origin = (foundation.get("refs") or {}).get(kingdom.ORIGIN_MAIN) or {}
    if origin.get("status") not in ("ok", "partial"):
        out["reasons"]["origin/main"] = "origin/main unreadable: %s" % origin.get("reason")
        return out
    out["origin_main_commit"] = origin.get("commit")
    runner = git or safety.GitRunner(kos, role="kingdom")
    for rel in files:
        try:
            res = runner.run("cat-file", "blob", "%s:%s" % (kingdom.ORIGIN_MAIN, rel))
        except safety.GitRefused as exc:
            out[kingdom.ORIGIN_MAIN][rel] = None
            out["reasons"]["origin/main:" + rel] = str(exc)
            continue
        ok = res.ok and len(res.raw) <= MAX_BLOB
        out[kingdom.ORIGIN_MAIN][rel] = res.raw if ok else None
        if not ok:
            out["reasons"]["origin/main:" + rel] = "timeout" if res.timed_out else "exit %s" % res.code
    return out


def _text(blob):
    return blob.decode("utf-8", "replace") if isinstance(blob, (bytes, bytearray)) else None


def _diff(old, new, label, pin):
    if old is None or new is None or old == new:
        return None
    return "".join(difflib.unified_diff(old.splitlines(True), new.splitlines(True),
                                        "a/%s@%s" % (label, pin), "b/%s" % label))


# ── edits used only to preview patches ──────────────────────────────────────────────────────

def _roster_line(text, name):
    """(index, columns) of the first roster row named name, harvest-style parsing."""
    lines = text.split("\n")
    for index, line in enumerate(lines):
        stripped = kingdom.js_trim(line)
        if not stripped or stripped.startswith("#"):
            continue
        parts = [kingdom.js_trim(p) for p in stripped.split("|")]
        if parts and parts[0] == name:
            return index, parts + [""] * (len(ROSTER_COLUMNS) - len(parts))
    return None, None


def roster_value(text, name, field):
    if text is None:
        return None, False
    index, parts = _roster_line(text, name)
    if index is None:
        return None, True
    return parts[ROSTER_COLUMNS.index(field)] or None, True


def roster_edit(text, name, field, value):
    """The roster text with one column of one row replaced, or None when the row is absent. Only
    that column's span changes: the row keeps its alignment and its other columns as written, so
    the preview is a patch an owner can apply as it stands."""
    if text is None:
        return None
    index, parts = _roster_line(text, name)
    if index is None:
        return None
    lines = text.split("\n")
    cells = lines[index].split("|")
    col = ROSTER_COLUMNS.index(field)
    if col < len(cells):
        old = cells[col]
        lead = old[:len(old) - len(old.lstrip())]
        body = lead + value
        if col < len(cells) - 1:
            body = body.ljust(len(old) - 1) + " " if len(body) < len(old) else body + " "
        cells[col] = body
    else:
        cells[-1] = cells[-1].rstrip() + " "
        cells += [" "] * (col - len(cells)) + [" " + value]
    lines[index] = "|".join(cells)
    return "\n".join(lines)


def roster_append(text, row):
    if text is None:
        return None
    return text + ("" if text.endswith("\n") or not text else "\n") + " | ".join(row) + "\n"


def registry_value(text, entry_id, field):
    if text is None:
        return None, False
    parsed = kingdom.parse_registry(text)
    for service in parsed["services"]:
        if service.get("id") == entry_id:
            return service.get(field), True
    return None, True


def registry_edit(text, entry_id, field, value):
    """REGISTRY.yaml with `    field: value` set inside the entry `  - id: entry_id`."""
    if text is None:
        return None
    lines = text.split("\n")
    start = next((i for i, l in enumerate(lines) if re.fullmatch(r"  - id:[ \t]*%s\s*" % re.escape(entry_id), l)), None)
    if start is None:
        return None
    end = next((i for i in range(start + 1, len(lines)) if lines[i].startswith("  - ") or (lines[i] and not lines[i].startswith(" "))), len(lines))
    for i in range(start + 1, end):
        if re.match(r"    %s:" % re.escape(field), lines[i]):
            lines[i] = "    %s: %s" % (field, value)
            return "\n".join(lines)
    lines.insert(start + 1, "    %s: %s" % (field, value))
    return "\n".join(lines)


def card_edit(text, field, value):
    if text is None:
        return None
    lines = text.split("\n")
    for i, line in enumerate(lines):
        if re.match(r"%s:" % re.escape(field), line):
            lines[i] = "%s: %s" % (field, value)
            return "\n".join(lines)
    return None


def card_text(fields):
    """A kingdom.yaml from [(field, value or None, note)]. A note is its own comment line above
    the field; a field with no in-vocabulary value is written as a comment that asks for one."""
    lines = []
    for field, value, note in fields:
        if note:
            lines.append("# %s: %s" % (field, " ".join(str(note).split())))
        if value is None:
            lines.append("# %s: (needs a choice)" % field)
        else:
            # A '#' or a line break inside a value would read as part of it, or end it early.
            lines.append("%s: %s" % (field, " ".join(str(value).replace("#", "").split())))
    return "\n".join(lines) + "\n"


def _clean_text(text, limit=140):
    text = " ".join(str(text or "").replace("#", "").split())
    first = re.split(r"(?<=[.!?])\s", text, maxsplit=1)[0]
    return first[:limit].rstrip()


# ── the builder ─────────────────────────────────────────────────────────────────────────────

def _canon(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def proposal_id(rule, file, record, field, proposed):
    """Stable across runs: patch previews (which move with the blobs) are not part of it."""
    key = {k: v for k, v in (proposed or {}).items() if k != "patch"}
    return "prop:%s:%s" % (rule, safety.sha12("|".join([rule, file or "", record or "", field or "", _canon(key)])))


class _Queue:
    def __init__(self, snapshot, foundation, blobs, now_iso):
        self.snapshot = snapshot
        self.foundation = foundation or {}
        self.blobs = blobs or {}
        self.now_iso = now_iso
        self.records = {r["id"]: r for r in snapshot.get("records") or [] if r.get("presence", "present") == "present"}
        self.projects = {rid: r for rid, r in self.records.items() if r["kind"] == "project"}
        self.enums = snapshot.get("enums") or {}
        self.ref = snapshot.get("ref") or kingdom.WORKTREE
        self.items = {}
        self.members = {}

    def add(self, rule, title, target, current, proposed, target_ref=kingdom.WORKTREE, options=None, basis=None,
            evidence=None, needs_yu=False, priority=2, bulk_key=None, upstream=None, members=None):
        ident = proposal_id(rule, target.get("file"), target.get("record_id") or bulk_key, target.get("field"), proposed)
        if ident in self.items:
            return self.items[ident]
        target = {k: target.get(k) for k in ("owner", "repo_id", "file", "record_id", "field")}
        proposal = {
            "schema": SCHEMA, "id": ident, "rule": rule, "title": title, "target": target, "target_ref": target_ref,
            "current": current, "proposed": proposed, "options": options or [], "basis": basis or [],
            "evidence": evidence or [], "needs_yu": needs_yu, "priority": priority, "bulk_key": bulk_key,
            "bulk_count": 1, "collab": _collab(target), "upstream": upstream or _no_upstream(),
            "status": "open", "first_seen": self.now_iso, "last_seen": self.now_iso, "decision_ref": None}
        if proposal["upstream"]["status"] == "matches-proposed":
            proposal["status"] = "resolved-upstream"
        elif proposal["upstream"]["status"] == "differs":
            proposal["status"] = "conflict-with-upstream"
        self.items[ident] = proposal
        self.members[ident] = sorted(set(members or ([target["record_id"]] if target.get("record_id") in self.projects else [])))
        return proposal

    # kingdom-os file targets: current on the build's ref, patch previews on both blobs

    def _kos(self, file, old_value, new_value, edit, origin_value, origin_known):
        wt_blob = (self.blobs.get(kingdom.WORKTREE) or {}).get(file)
        om_blob = (self.blobs.get(kingdom.ORIGIN_MAIN) or {}).get(file)
        patch = {}
        for ref, blob in ((kingdom.ORIGIN_MAIN, om_blob), (kingdom.WORKTREE, wt_blob)):
            if blob is None:
                patch[ref] = None
                continue
            pin = blob_id(blob)
            new_text = edit(_text(blob))
            patch[ref] = {"blob": pin, "diff": _diff(_text(blob), new_text, file, pin) if new_text else None,
                          "applies": new_text is not None}
            if ref == kingdom.ORIGIN_MAIN:
                patch[ref]["commit"] = self.blobs.get("origin_main_commit")
        if not origin_known:
            status = "n/a"
        elif origin_value == new_value:
            status = "matches-proposed"
        elif origin_value == old_value:
            status = "same-as-current"
        else:
            status = "differs"
        upstream = {"worktree_blob": blob_id(wt_blob) if wt_blob is not None else None,
                    "origin_main_blob": blob_id(om_blob) if om_blob is not None else None,
                    "origin_main_commit": self.blobs.get("origin_main_commit"), "status": status,
                    "origin_main_value": origin_value}
        return patch, upstream

    def _roster_change(self, name, field, old, new):
        om = _text((self.blobs.get(kingdom.ORIGIN_MAIN) or {}).get(ROSTER))
        origin_value, known = roster_value(om, name, field)
        return self._kos(ROSTER, old, new, lambda text: roster_edit(text, name, field, new), origin_value, known)

    def _registry_change(self, entry_id, field, old, new, compare=lambda v: v):
        om = _text((self.blobs.get(kingdom.ORIGIN_MAIN) or {}).get(REGISTRY))
        origin_value, known = registry_value(om, entry_id, field)
        patch, upstream = self._kos(REGISTRY, compare(old), compare(new),
                                    lambda text: registry_edit(text, entry_id, field, new), compare(origin_value), known)
        return patch, upstream


def _no_upstream():
    return {"worktree_blob": None, "origin_main_blob": None, "origin_main_commit": None, "status": "n/a"}


def _collab(target):
    if target.get("owner") == "kingdom-os" and target.get("file") in HOT_FILES:
        return {"repo_id": KOS_REPO, "path_scopes": [target["file"]]}
    if target.get("file") == CARD and target.get("repo_id"):
        return {"repo_id": target["repo_id"], "path_scopes": [CARD]}
    return None


def _evidence(kind, locator, at, cls="measure"):
    return {"kind": kind, "locator": locator, "at": at, "evidence_class": cls}


# ── rules ───────────────────────────────────────────────────────────────────────────────────

def _card_target(project, field=None):
    return {"owner": "repo", "repo_id": project["id"], "file": CARD, "record_id": project["id"], "field": field}


def _roster_target(project_id, field):
    return {"owner": "kingdom-os", "repo_id": KOS_REPO, "file": ROSTER, "record_id": project_id, "field": field}


def _hints(project, key):
    return sorted({t["target"].split("=", 1)[1] for t in project.get("tag_expectations") or []
                   if t.get("target") and t["target"].startswith(key + "=")})


def _citizen(p):
    """A fleet citizen: a member of the fleet-citizens family whose role or name says so (the family
    also holds the public site that lists the citizens)."""
    roles = set((p["facets"].get("role") or {}).get("values") or [])
    name = p.get("name") or p["id"].rsplit("/", 1)[-1]
    return p.get("family_id") == "family:fleet-citizens" and (bool(roles & set(model.CITIZEN_ROLES))
                                                                or name.startswith("citizen-"))


def rule_p01(q, curated=None):
    """P01 card-missing: a checked-out project with no card and no KINGDOM claim on its layer. A
    citizen's skeleton takes the layer an owner decision gives citizens (D2: soul), named as such;
    the facet itself stays unset until a card exists."""
    ruling = decisions.rules((curated or {}).get("decisions"))["layer"]
    for pid, p in sorted(q.projects.items()):
        k = p.get("kingdom") or {}
        if p["facets"]["layer"]["status"] != "unset" or k.get("card_present") is not False:
            continue
        if not p["flags"]["checkout_present"] or p["flags"]["incidental"]:
            continue
        canonical = q.records.get(p.get("canonical_checkout") or "") or {}
        if canonical.get("rel") == "~":
            continue  # the home-level repository ignores everything; it is ground, not a member
        roster = k.get("roster_row") or {}
        fields, options = [], []

        def pick(field, hint_key, note_hint):
            allowed = q.enums.get(field) or []
            hints = [h for h in _hints(p, hint_key) if h in allowed] if hint_key else []
            if len(hints) == 1:
                return hints[0], note_hint % hints[0]
            if roster.get(field) in allowed:
                return roster[field], "from the roster row"
            options.append({"field": field, "values": list(allowed)})
            return None, None

        name = p.get("name") or pid.rsplit("/", 1)[-1]
        fields.append(("name", name, "the project name"))
        decided = ruling if ruling and _citizen(p) and ruling.get("default") in (q.enums.get("layer") or []) else None
        for field, hint in (("kind", "card-hint:kind"), ("layer", "card-hint:layer")):
            if field == "layer" and decided:
                fields.append(("layer", decided["default"], "owner decision %s: citizens are layer %s"
                               % (decided["decision"], decided["default"])))
                continue
            value, note = pick(field, hint, "card hint %s from the curated tags")
            fields.append((field, value, note))
        for field in ("owner_sister", "domain"):
            value, note = pick(field, None, None)
            fields.append((field, value, note))
        live = p["facets"]["liveness"].get("value")
        state = model.LIVENESS_STATE.get(live) if live else None
        if state not in (q.enums.get("state") or []):
            state = None
            options.append({"field": "state", "values": list(q.enums.get("state") or [])})
        fields.append(("state", state, "measured liveness %s" % live if state else None))
        # The committed (scrubbed) text: a card is committed in its own repository.
        purpose, source = _clean_text((p.get("curated") or {}).get("what_public")), "the curated what"
        if not purpose:
            claim = next((c for c in p.get("claims") or [] if c["source"] in ("readme", "forge")), None)
            purpose = _clean_text(claim["value"]) if claim else ""
            source = "the README title" if claim and claim["source"] == "readme" else "the forge description"
        fields.append(("purpose", purpose or None, source if purpose else None))
        fields.append(("dependsOn", "[]", "no KINGDOM dependency is known"))
        text = card_text(fields)
        prop = q.add("P01", "add a kingdom.yaml card", _card_target(p),
                     {"value": None, "src": "src:census", "at": p["observed_at"]},
                     {"card_text": text}, target_ref="checkout-head", options=options,
                     basis=["no card file in the canonical checkout", "layer unset on every ref"]
                     + (["layer from owner decision %s" % decided["decision"]] if decided else []),
                     evidence=[_evidence("checkout", p["canonical_checkout"], p["observed_at"])],
                     needs_yu=bool(options), priority=3, bulk_key="P01:" + str(p.get("family_id") or "unassigned"))
        if decided:
            prop["decision_ref"] = decided["decision"]


def rule_p02(q):
    for pid, p in sorted(q.projects.items()):
        if p["facets"]["standing"].get("value") != "card-untracked":
            continue
        q.add("P02", "track kingdom.yaml in git", _card_target(p), {"value": "untracked", "src": "src:census", "at": p["observed_at"]},
              {"action": "git add kingdom.yaml and commit"}, target_ref="checkout-head",
              basis=["a schema-valid card that git does not track"], priority=2,
              bulk_key="P02:" + str(p.get("family_id") or "unassigned"),
              evidence=[_evidence("checkout", p["kingdom"].get("card_checkout"), p["observed_at"])])


def rule_p03(q, facets):
    competing = set((((facets or {}).get("claim") or {}).get("registry_os_function") or {}).get("values") or {})
    for pid, p in sorted(q.projects.items()):
        k = p.get("kingdom") or {}
        for field, raw in sorted((k.get("off_enum") or {}).items()):
            allowed = q.enums.get(field) or []
            stripped = raw.split("#", 1)[0].strip() if isinstance(raw, str) else raw
            needs_yu, value, options = True, None, []
            if stripped in allowed and stripped != raw:
                needs_yu, value = False, stripped
                note = "an inline comment makes harvest read the value as off-vocabulary"
            elif isinstance(raw, str) and raw.lower() in allowed:
                needs_yu, value = False, raw.lower()
                note = "case differs from the vocabulary"
            else:
                options = [{"field": field, "values": list(allowed)}]
                note = ("a competing vocabulary (REGISTRY.md OS functions)" if raw in competing
                        else "not in the live vocabulary")
            proposed = {"value": value}
            new = card_edit(k.get("card_text"), field, value) if value is not None else None
            if new is not None:
                proposed["patch"] = {"checkout-head": {"blob": blob_id(k["card_text"].encode("utf-8")),
                                                       "diff": _diff(k["card_text"], new, CARD, blob_id(k["card_text"].encode("utf-8")))}}
            q.add("P03", "card %s is outside the vocabulary" % field, _card_target(p, field),
                  {"value": raw, "src": "src:kingdom:" + str(k.get("ref")), "at": p["observed_at"]}, proposed,
                  target_ref="checkout-head", options=options, basis=[note], needs_yu=needs_yu, priority=2,
                  bulk_key="P03:%s=%s" % (field, raw),
                  evidence=[_evidence("card", k.get("card_checkout"), p["observed_at"])])


def rule_p04(q):
    for pid, p in sorted(q.projects.items()):
        state = p["facets"]["state"]
        live = p["facets"]["liveness"].get("value")
        if state.get("value") is None or live is None or model.state_agrees(state["value"], live, p):
            continue
        new = model.LIVENESS_STATE.get(live)
        if new not in (q.enums.get("state") or []):
            continue
        if state.get("resolved_by") == "card":
            target, ref = _card_target(p, "state"), "checkout-head"
            upstream, proposed = None, {"value": new}
        else:
            row = (p.get("kingdom") or {}).get("roster_row") or {}
            if not row.get("name"):
                continue
            target, ref = _roster_target(pid, "state"), q.ref
            patch, upstream = q._roster_change(row["name"], "state", state["value"], new)
            proposed = {"value": new, "patch": patch}
        q.add("P04", "declared state %s, measured %s" % (state["value"], live), target,
              {"value": state["value"], "src": state.get("src"), "at": state.get("at")}, proposed, target_ref=ref,
              basis=["liveness is measured; the card state is a claim"], priority=3, upstream=upstream,
              bulk_key="P04:%s->%s" % (state["value"], new),
              evidence=[_evidence("liveness", p["facets"]["liveness"].get("src"), p["facets"]["liveness"].get("at"))])


def rule_p05(q):
    for pid, p in sorted(q.projects.items()):
        k = p.get("kingdom") or {}
        card_name = (k.get("card_valid") or {}).get("name")
        roster = k.get("roster_row") or {}
        if not card_name or not roster.get("name") or card_name == roster["name"]:
            continue
        semantics = {}
        for ref, rules in ((q.foundation.get("refs") or {}).items()):
            r = rules.get("rules") or {}
            if r.get("card_name_overrides") is True:
                semantics[ref] = "the card renames the member to %s" % card_name
            elif r.get("name_mismatch_code"):
                semantics[ref] = "the roster seed owns the name; harvest reports name-mismatch"
            else:
                semantics[ref] = "unknown (rule unreadable)"
        q.add("P05", "card name differs from the roster seed", _card_target(p, "name"),
              {"value": card_name, "src": "src:kingdom:" + str(k.get("ref")), "at": p["observed_at"], "per_ref": semantics},
              {"value": roster["name"]}, target_ref="checkout-head",
              options=[{"set": "card name", "value": roster["name"]}, {"set": "roster name", "value": card_name}],
              basis=["origin/main makes the roster seed own the name"], priority=2,
              evidence=[_evidence("roster", "roster.conf:%s" % roster.get("line"), p["observed_at"], "claim")])


def rule_p06(q):
    known = set()
    for ref, state in ((q.snapshot.get("kingdom") or {}).get("roster") or {}).items():
        known |= {(r.get("name") or "").lower() for r in state.get("rows") or []}
    known |= {(p.get("name") or "").lower() for p in q.projects.values() if (p.get("kingdom") or {}).get("fleet_checkout")}
    for pid, p in sorted(q.projects.items()):
        k = p.get("kingdom") or {}
        deps = (k.get("card_valid") or {}).get("dependsOn") or []
        unknown = [d for d in deps if d.lower() not in known]
        if not unknown:
            continue
        keep = [d for d in deps if d.lower() in known]
        options = [{"name": d, "close": difflib.get_close_matches(d.lower(), sorted(known), n=3)} for d in unknown]
        q.add("P06", "card dependsOn names unknown members", _card_target(p, "dependsOn"),
              {"value": deps, "src": "src:kingdom:" + str(k.get("ref")), "at": p["observed_at"]},
              {"value": keep}, target_ref="checkout-head", options=options, needs_yu=True, priority=3,
              bulk_key="P06:" + ",".join(sorted(d.lower() for d in unknown)),
              basis=["harvest drops unknown dependencies (unknown-dependency)"])


def rule_p07(q):
    """P07 roster row drift: a path that moved (repoint by remote id) and, because the card is
    authoritative (SCHEMA.md), a roster column that disagrees with a valid card value."""
    for pid, p in sorted(q.projects.items()):
        k = p.get("kingdom") or {}
        row = k.get("roster_row") or {}
        if not row.get("name"):
            continue
        canonical = q.records.get(p.get("canonical_checkout") or "")
        if row.get("path_status") == "elsewhere" and canonical:
            new = canonical.get("rel")
            patch, upstream = q._roster_change(row["name"], "path", row.get("path_raw"), new)
            q.add("P07", "roster path points where the project is not", _roster_target(pid, "path"),
                  {"value": row.get("path_raw"), "src": "src:roster", "at": p["observed_at"]},
                  {"value": new, "patch": patch}, target_ref=q.ref, upstream=upstream, priority=1,
                  basis=["the roster path is missing; the project was matched by its remote id"],
                  evidence=[_evidence("checkout", canonical["id"], canonical.get("observed_at"))])
        valid = k.get("card_valid") or {}
        for field in model.KINGDOM_FIELDS:
            if valid.get(field) and row.get(field) and valid[field] != row[field]:
                patch, upstream = q._roster_change(row["name"], field, row[field], valid[field])
                q.add("P07", "roster %s disagrees with the card" % field, _roster_target(pid, field),
                      {"value": row[field], "src": "src:roster", "at": p["observed_at"]},
                      {"value": valid[field], "patch": patch}, target_ref=q.ref, upstream=upstream, priority=2,
                      basis=["SCHEMA.md makes the card authoritative over the roster seed"],
                      bulk_key="P07:%s" % field,
                      evidence=[_evidence("card", k.get("card_checkout"), p["observed_at"], "claim")])
    roster = ((q.snapshot.get("kingdom") or {}).get("roster") or {}).get(q.ref) or {}
    for row in roster.get("orphans") or []:
        if row.get("state") == "remote":
            continue
        current = {"value": row.get("path_raw"), "src": "src:roster", "at": q.now_iso, "name": row.get("name")}
        status, candidates = row.get("path_status"), row.get("candidates") or []
        if status == "ambiguous":
            # Several projects carry the name: the row names a real member, but which one is the
            # owner's call; it is never "no project with that name".
            q.add("P07", "roster row name matches several projects", _roster_target(None, "path"), current,
                  {"value": None, "action": "repoint the row to the checkout of one of them", "candidates": candidates},
                  target_ref=q.ref, needs_yu=True, priority=2, options=[{"value": c} for c in candidates],
                  basis=["%d projects carry the name %s, and no measured checkout is at the row's path"
                         % (len(candidates), row.get("name"))],
                  bulk_key="P07:ambiguous:%s" % row.get("name"))
        elif status == "not-a-checkout":
            q.add("P07", "roster path holds no measured checkout", _roster_target(None, "path"), current,
                  {"value": None, "action": "check the path, then repoint or remove the row"}, target_ref=q.ref,
                  needs_yu=True, priority=3, bulk_key="P07:orphan:%s" % row.get("name"),
                  basis=["the path exists here, but census measured no checkout at it and no project has the name"])
        else:
            q.add("P07", "roster row matches no project here", _roster_target(None, "path"), current,
                  {"value": None, "action": "remove the row or repoint it"}, target_ref=q.ref, needs_yu=True, priority=3,
                  basis=["no path, no checkout and no project with that name here"],
                  bulk_key="P07:orphan:%s" % row.get("name"))


def rule_p08(q):
    for pid, p in sorted(q.projects.items()):
        row = (p.get("kingdom") or {}).get("roster_row") or {}
        if row.get("state") != "remote" or not p["flags"]["checkout_present"]:
            continue
        live = p["facets"]["liveness"].get("value")
        new = model.LIVENESS_STATE.get(live)
        if new not in (q.enums.get("state") or []):
            continue
        patch, upstream = q._roster_change(row["name"], "state", "remote", new)
        q.add("P08", "roster says remote, but a checkout is present", _roster_target(pid, "state"),
              {"value": "remote", "src": "src:roster", "at": p["observed_at"]}, {"value": new, "patch": patch},
              target_ref=q.ref, upstream=upstream, priority=3, basis=["state remote means not cloned on this machine"])


def rule_p09(q):
    # Every name the roster already holds, on any ref and in any state (orphans and ambiguous rows
    # included): a project carrying one of them needs a P07 repoint, never a second row.
    rostered = {(row.get("name") or "").lower() for state in ((q.snapshot.get("kingdom") or {}).get("roster") or {}).values()
                for row in state.get("rows") or []}
    planned = set()
    for pid, p in sorted(q.projects.items()):
        k = p.get("kingdom") or {}
        valid = k.get("card_valid") or {}
        if not valid.get("name") or any(k.get("roster_by_ref", {}).values()) or k.get("fleet_checkout"):
            continue
        names = {valid["name"].lower(), pid.rsplit("/", 1)[-1].lower(), (p.get("name") or "").lower()}
        if names & rostered or valid["name"].lower() in planned:
            continue
        planned.add(valid["name"].lower())
        canonical = q.records.get(p.get("canonical_checkout") or "")
        if not canonical or not all(valid.get(f) for f in ("kind", "layer", "state", "domain")):
            continue
        row = [valid["name"], canonical.get("rel") or "", valid["kind"], valid["layer"], valid["domain"],
               valid["state"], _clean_text(valid.get("purpose"))]
        om = _text((q.blobs.get(kingdom.ORIGIN_MAIN) or {}).get(ROSTER))
        on_origin = _roster_line(om, valid["name"])[0] is not None if om is not None else None
        patch, upstream = q._kos(ROSTER, None, valid["name"], lambda text: roster_append(text, row),
                                 valid["name"] if on_origin else None, om is not None)
        q.add("P09", "carded project absent from the roster", _roster_target(pid, None),
              {"value": None, "src": "src:roster", "at": p["observed_at"]}, {"row": row, "patch": patch},
              target_ref=q.ref, upstream=upstream, priority=3,
              bulk_key="P09:" + str(p.get("family_id") or "unassigned"),
              basis=["a card outside CITIZENS_DIR is invisible to harvest without a roster row"])


def rule_p10(q, curated):
    groups = {}
    for pid, p in sorted(q.projects.items()):
        layer = p["facets"]["layer"]
        if layer.get("status") != "contested":
            continue
        signature = sorted({(c["source"], c["value"]) for c in layer.get("candidates") or []})
        key = "P10:" + "|".join("%s=%s" % pair for pair in signature)
        groups.setdefault(key, []).append(pid)
    disputes = [d for d in (curated or {}).get("disputes") or [] if d.get("proposal_rule") == "P10"]
    for key, members in sorted(groups.items()):
        common = set.intersection(*(set(q.projects[m].get("group_ids") or []) for m in members)) if members else set()
        record = sorted(common)[0] if len(common) == 1 else None
        values = sorted({c["value"] for m in members for c in q.projects[m]["facets"]["layer"].get("candidates") or []})
        options = [{"value": v, "sources": sorted({c["source"] for m in members
                                                   for c in q.projects[m]["facets"]["layer"]["candidates"] if c["value"] == v})}
                   for v in values]
        q.add("P10", "layer contested for %d records" % len(members),
              {"owner": "yu", "repo_id": None, "file": None, "record_id": record, "field": "layer"},
              {"value": None, "src": "src:kingdom:" + q.ref, "at": q.now_iso, "members": members},
              {"value": None, "candidates": values}, target_ref=q.ref, options=options, needs_yu=True, priority=1,
              bulk_key=key, members=members,
              basis=["one decision for the whole group, not one per record"] + [d["id"] for d in disputes])


def rule_p11(q):
    for sid, s in sorted(q.records.items()):
        if s["kind"] != "surface" or not s.get("registry"):
            continue
        reg = s["registry"]
        claim = reg.get("runtime_claim")
        evidence = {e.get("kind") for e in (s.get("attribution") or {}).get("evidence") or []}
        if claim and s.get("provider") and str(claim).split(":", 1)[0] != s["provider"] and evidence & {"curated", "manifest"}:
            new = "%s:%s" % (s["provider"], s.get("name") or reg["id"])
            patch, upstream = q._registry_change(reg["id"], "runtime", claim, new)
            q.add("P11", "REGISTRY runtime disagrees with the evidence", _registry_target(sid, "runtime"),
                  {"value": claim, "src": "src:registry", "at": q.now_iso, "entry": reg["id"]},
                  {"value": new, "patch": patch}, target_ref=q.ref, upstream=upstream, needs_yu=True, priority=2,
                  basis=["curated or manifest evidence names another runtime"])
        repo_claim = reg.get("repo_claim")
        source = s.get("source_project")
        if repo_claim and source and (s.get("attribution") or {}).get("class") in model.CURRENT:
            core = re.split(r"[@\s(]", repo_claim.strip(), maxsplit=1)[0].lower().rstrip("/")
            if core.endswith(".git"):
                core = core[:-4]
            if core != source:
                suffix = "@" + repo_claim.split("@", 1)[1].split()[0] if "@" in repo_claim else ""
                new = source + suffix

                def norm(value):
                    return re.split(r"[@\s(]", str(value).strip(), maxsplit=1)[0].lower() if value else value
                patch, upstream = q._registry_change(reg["id"], "repo", repo_claim, new, norm)
                q.add("P11", "REGISTRY repo is not the project's primary id", _registry_target(sid, "repo"),
                      {"value": repo_claim, "src": "src:registry", "at": q.now_iso, "entry": reg["id"]},
                      {"value": new, "patch": patch}, target_ref=q.ref, upstream=upstream, priority=2,
                      basis=["attributed as %s" % s["attribution"]["class"]])


def _registry_target(record_id, field):
    return {"owner": "kingdom-os", "repo_id": KOS_REPO, "file": REGISTRY, "record_id": record_id, "field": field}


def rule_p12(q):
    for sid, s in sorted(q.records.items()):
        if s["kind"] != "surface" or s.get("registry") or not s.get("source_project") or not s.get("hostnames"):
            continue
        if (s.get("attribution") or {}).get("class") not in model.CURRENT:
            continue
        site = next((h for h in s["hostnames"] if not h.startswith("*")), None)  # a route wildcard is no URL
        if site is None:
            continue
        name = s.get("name") or sid.rsplit(":", 1)[-1]
        entry = ("  - id: %s\n    what: %s\n    urls: { site: \"https://%s\" }\n    repo: %s\n    runtime: %s:%s\n"
                 "    # status: confirm live or retired before adding\n"
                 % (name, (q.projects.get(s["source_project"]) or {}).get("name") or name, site,
                    s["source_project"], s.get("provider"), name))
        om = _text((q.blobs.get(kingdom.ORIGIN_MAIN) or {}).get(REGISTRY))
        on_origin, known = registry_value(om, name, "id")
        patch, upstream = q._kos(REGISTRY, None, name, lambda text: text + ("" if text.endswith("\n") else "\n") + entry,
                                 on_origin, known)
        q.add("P12", "surface missing from REGISTRY", _registry_target(sid, None),
              {"value": None, "src": "src:registry", "at": q.now_iso}, {"entry": entry, "patch": patch},
              target_ref=q.ref, upstream=upstream, needs_yu=True, priority=3,
              basis=["attributed %s with public hostnames, but REGISTRY has no entry" % s["attribution"]["class"]])


def rule_p13(q):
    hosts = {}
    for rid, r in q.records.items():
        if r["kind"] == "surface" and r.get("source_project"):
            for host in r.get("hostnames") or []:
                hosts.setdefault(host, set()).add(r["source_project"])
    for door in (q.snapshot.get("kingdom") or {}).get("sites") or []:
        if door.get("project_id"):
            continue
        host = model.host_of(door.get("url"))
        candidates = sorted(hosts.get(host, set()))
        names = sorted({(q.projects.get(c) or {}).get("name") or c.rsplit("/", 1)[-1] for c in candidates})
        q.add("P13", "sites.json key names no project", {"owner": "kingdom-os", "repo_id": KOS_REPO, "file": SITES,
                                                        "record_id": None, "field": "repo:" + str(door.get("repo"))},
              {"value": door.get("repo"), "src": "src:sites", "at": q.now_iso, "url": door.get("url")},
              {"value": names[0] if len(names) == 1 else None}, target_ref=q.ref,
              options=[{"value": n} for n in names], needs_yu=len(names) != 1, priority=3,
              basis=["matched by the door's hostname" if names else "no surface holds the door's hostname"])


def rule_p14(q):
    differing = []
    for pid, p in sorted(q.projects.items()):
        k = p.get("kingdom") or {}
        graph, view = k.get("graph_entry"), (k.get("harvest_view") or {}).get(kingdom.WORKTREE)
        if view and not graph:
            differing.append({"id": pid, "why": "harvest would list it; graph.json does not"})
        elif graph and view and any(graph.get(f) != view.get(f) for f in ("layer", "kind", "state")):
            differing.append({"id": pid, "why": "graph.json differs from what harvest computes now"})
    stale = [d for d in q.snapshot.get("drift") or [] if d.get("code") in ("roster-not-in-graph", "graph-vs-catalog")]
    if not differing and not stale:
        return
    q.add("P14", "graph.json and CATALOG.md are stale", {"owner": "kingdom-os", "repo_id": KOS_REPO,
                                                         "file": "graph.json", "record_id": None, "field": None},
          {"value": None, "src": "src:graph", "at": q.now_iso, "differing": len(differing), "examples": differing[:20],
           "map_drift": [d["detail"] for d in stale][:20]},
          {"action": "re-run bun bin/harvest.ts with no verb in kingdom-os; never hand-edit graph.json or CATALOG.md"},
          target_ref=q.ref, priority=3, basis=["CATALOG.md and graph.json are derived"])


def rule_p15(q, lock):
    divergence = [d for d in (q.foundation.get("divergence") or [])]
    # Once an owner decision names the authority ref there is nothing left to choose: P17 carries
    # the reconciliation instead.
    if divergence and not (q.snapshot.get("authority") or {}).get("decision"):
        q.add("P15", "kingdom-os worktree and origin/main define the foundation differently",
              {"owner": "yu", "repo_id": KOS_REPO, "file": HARVEST, "record_id": None, "field": None},
              {"value": [d["key"] for d in divergence], "src": "src:kingdom:origin/main", "at": q.now_iso,
               "ahead_behind": q.foundation.get("ahead_behind")},
              {"decision": "foundation-divergence", "keys": sorted(d["key"] for d in divergence)}, target_ref=q.ref,
              options=[{"value": "bring the worktree to origin/main"}, {"value": "keep the worktree as it is"}],
              needs_yu=True, priority=2, basis=["the build reads the configured ref; the other is shown alongside"])
    if lock is not None:
        compared = kingdom.compare_lock(q.foundation, lock) if q.foundation.get("refs") else {"state": "missing", "diffs": []}
        if compared["state"] == "mismatch":
            q.add("P15", "KINGDOM vocabulary changed since the lock",
                  {"owner": "yu", "repo_id": KOS_REPO, "file": HARVEST, "record_id": None, "field": None},
                  {"value": compared["diffs"], "src": "src:kingdom:worktree", "at": q.now_iso},
                  {"decision": "vocab-drift", "diffs": sorted("%s:%s" % (d["ref"], d["key"]) for d in compared["diffs"])},
                  target_ref=q.ref, options=[{"value": "review, then estate accept-vocab --write"}],
                  needs_yu=True, priority=1, basis=["live KINGDOM wins; the lock changes only by accept-vocab"])


def rule_p16(q, curated):
    for note in (curated or {}).get("upstream_notes") or []:
        if note.get("status") == "applied":
            continue  # its owner made the change; the lifecycle keeps a resolved stub
        owner =note.get("owner") if note.get("owner") in ("kingdom-os", "pr1-owner", "repo", "yu") else "yu"
        q.add("P16", note.get("title") or note.get("id"),
              {"owner": owner, "repo_id": note.get("repo_id"), "file": note.get("file"), "record_id": None,
               "field": note.get("id")},
              {"value": None, "src": "src:curated", "at": note.get("as_of"), "note_status": note.get("status")},
              {"note": note.get("text")}, target_ref=q.ref, priority=3,
              basis=["curated/estate.toml %s" % note.get("id")])


def rule_p17(q, curated):
    """P17 decision follow-up: the kingdom-os change an owner decision calls for. Proposed, never
    applied: kingdom-os applies it, or not, in its own repository."""
    authority = q.snapshot.get("authority") or {}
    if authority.get("decision") and authority.get("basis") == "decision":
        _reconcile_main(q, authority)
    layer = decisions.rules((curated or {}).get("decisions"))["layer"]
    if layer:
        _honour_card_layer(q, layer)


def _reconcile_main(q, authority):
    ab = q.foundation.get("ahead_behind") or {}
    ahead, behind = ab.get("ahead"), ab.get("behind")
    if ahead == 0 and behind == 0:
        return
    refs = q.foundation.get("refs") or {}
    counts = ("%s ahead / %s behind" % (ahead, behind)) if isinstance(ahead, int) and isinstance(behind, int) \
        else "ahead/behind unknown: %s" % (ab.get("reason") or "not measured")
    # The counts move with every commit, so they sit in current and the title, never in proposed.
    prop = q.add("P17", "reconcile local kingdom-os main with origin/main (%s)" % counts,
                 {"owner": "kingdom-os", "repo_id": KOS_REPO, "file": None, "record_id": None, "field": "main"},
                 {"value": {"ahead": ahead, "behind": behind}, "src": "src:kingdom:" + authority["ref"], "at": q.now_iso,
                  "worktree_commit": (refs.get(kingdom.WORKTREE) or {}).get("commit"),
                  "origin_main_commit": (refs.get(kingdom.ORIGIN_MAIN) or {}).get("commit"),
                  "fetch_head": (q.foundation.get("fetch_head") or {}).get("mtime"),
                  "divergence": sorted(d["key"] for d in q.foundation.get("divergence") or [])},
                 {"action": "reconcile the local main branch with %s, the taxonomy authority; the estate never "
                            "fetches, pulls, merges or applies it" % authority["ref"]},
                 target_ref=authority["ref"], priority=2,
                 basis=["owner decision %s: %s is the taxonomy authority" % (authority["decision"], authority["ref"]),
                        "the worktree is shown for drift only until the two agree"])
    prop["decision_ref"] = authority["decision"]


_FORCED_LAYER = re.compile(r"(\n[ \t]*layer:[ \t]*)'([^'\n]+)'(,)[^\n]*")


def honour_card_layer(text, default, decision):
    """harvest.ts with discoverFleet's forced layer literal replaced by the card's own layer, the
    default when the card has none; None when discoverFleet or its forced literal is not found."""
    if text is None:
        return None
    start = re.search(r"\nfunction discoverFleet\(", text)
    end = text.find("\n}\n", start.end()) if start else -1
    if start is None or end < 0:
        return None
    body = text[start.end():end]
    match = _FORCED_LAYER.search(body)
    if match is None:
        return None
    line = "%s(card.layer as string) ?? '%s'%s // owner decision %s: the card's own layer" % (
        match.group(1), default, match.group(3), decision)
    return text[:start.end()] + body[:match.start()] + line + body[match.end():] + text[end:]


def _forced_state(text):
    """forced | honours-card | None (unreadable) for a harvest.ts text."""
    if text is None:
        return None
    start = re.search(r"\nfunction discoverFleet\(", text)
    body = text[start.end():text.find("\n}\n", start.end())] if start else ""
    if _FORCED_LAYER.search(body):
        return "forced"
    return "honours-card" if re.search(r"layer:\s*\(card\.layer as string\)", body) else "unreadable"


def _honour_card_layer(q, layer):
    members = sorted(pid for pid, p in q.projects.items()
                     if (p["facets"].get("layer") or {}).get("decided_by") == layer["decision"])
    if not members:
        return
    om = _text((q.blobs.get(kingdom.ORIGIN_MAIN) or {}).get(HARVEST))
    default = layer.get("default") or "soul"
    patch, upstream = q._kos(HARVEST, "forced", "honours-card",
                             lambda text: honour_card_layer(text, default, layer["decision"]),
                             _forced_state(om), om is not None)
    prop = q.add("P17", "make harvest discoverFleet honour the card layer (%s when a card has none)" % default,
                 {"owner": "kingdom-os", "repo_id": KOS_REPO, "file": HARVEST, "record_id": None, "field": "discoverFleet"},
                 {"value": "discoverFleet forces layer %s on every carded repository under CITIZENS_DIR" % (
                     layer.get("overrule") or "").split(":", 1)[-1], "src": "src:kingdom:" + q.ref, "at": q.now_iso,
                  "members": members},
                 {"action": "take the layer from the citizen's card, %s when it has none" % default, "patch": patch},
                 target_ref=kingdom.ORIGIN_MAIN, priority=2, upstream=upstream, members=members,
                 bulk_key="P17:discoverFleet",
                 basis=["owner decision %s: citizens are layer %s" % (layer["decision"], default),
                        "%d records here take the card layer instead of the forced one" % len(members)])
    prop["decision_ref"] = layer["decision"]


# ── lifecycle ───────────────────────────────────────────────────────────────────────────────


# The roster- and REGISTRY-absent rules: for a member of KINGDOM OS they ask kingdom-os to list its own,
# so the estate puts them ahead of the same rule for independent and undecided subjects. This is the
# estate's ordering heuristic over D4's sphere, not something D4 itself says. A citizen's roster row
# is not raised: harvest's own discovery is the route D2 points at (P17), and one row per clone would
# be a second route beside it.
SPHERE_FIRST = ("P09", "P12")
SPHERE_PRIORITY = 2


def _record_sphere(record):
    facet = (record.get("facets") or {}).get("sphere") if record.get("kind") == "project" else record.get("sphere")
    return (facet or {}).get("value")


def _spheres(q):
    """Annotate every proposal with its subject's sphere: its record's, or its members' when they
    all agree (None otherwise). Raise P09/P12 for KINGDOM OS subjects, or surfaces in a KINGDOM OS
    zone. Nothing new is proposed for independent records: their proposals are only annotated."""
    for ident, prop in q.items.items():
        record = q.records.get((prop.get("target") or {}).get("record_id") or "")
        if record is not None:
            value = _record_sphere(record)
        else:
            found = {_record_sphere(q.projects[m]) for m in q.members.get(ident) or [] if m in q.projects}
            value = found.pop() if len(found) == 1 else None
        prop["sphere"] = value
        if prop["rule"] not in SPHERE_FIRST:
            continue
        zones = [z for z in (record or {}).get("zone_ids") or [] if _record_sphere(q.records.get(z) or {}) == "kingdom-os"]
        if prop["rule"] == "P09" and record is not None and record.get("kind") == "project" and _citizen(record):
            prop["basis"] = list(prop["basis"]) + [
                "a citizen: not raised by sphere, because harvest's own discovery (discoverFleet, the P17 follow-up of "
                "the citizen-layer owner decision, and the upstream note on harvest's discovery scope) is the route "
                "for citizens, not one roster row per clone"]
            continue
        if value == "kingdom-os" or zones:
            prop["priority"] = min(prop["priority"], SPHERE_PRIORITY)
            prop["basis"] = list(prop["basis"]) + ["part of KINGDOM OS%s: the estate lists this ahead of the same rule "
                                                   "for independent and undecided subjects (an estate ordering over "
                                                   "the D4 sphere, not part of the decision)"
                                                   % (" through zone %s" % ", ".join(zones) if zones and value != "kingdom-os"
                                                      else "")]


def _settled_by(q, prop):
    """The owner decision that settled what a proposal no longer produced asked, or None: a P10
    whose members all took their layer from one decision (a ruling, or the authority decision that
    ended a ref-divergence contest), or the foundation-divergence P15 once a decision names the
    authority ref."""
    if prop.get("rule") == "P10":
        members = [q.projects[m] for m in (prop.get("current") or {}).get("members") or [] if m in q.projects]
        settled = {(m["facets"].get("layer") or {}).get("decided_by") or (m["facets"].get("layer") or {}).get("authority")
                   for m in members}
        return settled.pop() if members and len(settled) == 1 and None not in settled else None
    if prop.get("rule") == "P15" and (prop.get("proposed") or {}).get("decision") == "foundation-divergence":
        return (q.snapshot.get("authority") or {}).get("decision")
    return None

def _decisions(decisions):
    """{proposal id or bulk key: decision}, the latest by date winning."""
    out = {}
    for d in sorted(decisions or [], key=lambda d: (str(d.get("date") or ""), str(d.get("id") or ""))):
        if d.get("outcome") in DECISION_OUTCOMES:
            for key in (d.get("proposal"), d.get("bulk_key")):
                if key:
                    out[key] = d
    return out


def _apply_lifecycle(q, prev_props, decisions, now):
    decided = _decisions(decisions)
    previous = {p["id"]: p for p in prev_props or [] if isinstance(p, dict) and p.get("id")}
    for ident, prop in q.items.items():
        before = previous.get(ident)
        if before and before.get("first_seen"):
            prop["first_seen"] = before["first_seen"]
        decision = decided.get(ident) or (decided.get(prop["bulk_key"]) if prop["bulk_key"] else None)
        if decision:
            prop["decision_ref"] = decision.get("id")
            if decision["outcome"] in ("declined", "deferred"):
                prop["status"] = decision["outcome"]
        first = model.epoch(prop["first_seen"])
        prop["age_days"] = int((now.timestamp() - first) // 86400) if first else 0
        prop["long_open"] = prop["status"] == "open" and prop["age_days"] > LONG_OPEN_DAYS
    carried = []
    # A stub an owner decision superseded is that decision's record of what it retired: it is
    # carried on every build while the decision exists, not for one build only (U1).
    owner = {d.get("id") for d in decisions or [] if isinstance(d, dict) and d.get("kind") == "owner-decision"}
    for ident, before in sorted(previous.items()):
        if ident in q.items:
            continue
        if before.get("status") == "superseded" and before.get("decision_ref") in owner:
            carried.append(dict(before, last_seen=q.now_iso))
            continue
        if before.get("status") not in CARRIED:
            continue
        record = (before.get("target") or {}).get("record_id")
        gone = record is not None and record not in q.records
        stub = dict(before, status="superseded" if gone else "resolved-observed", last_seen=q.now_iso)
        settled = _settled_by(q, before)
        if settled:
            stub.update(status="superseded", decision_ref=settled)
        carried.append(stub)
    return carried


def propose(snapshot, foundation=None, prev_props=None, decisions=None, blobs=None, lock=None, now=None,
            curated=None, facets=None):
    """Every proposal for one snapshot (spec 10), sorted by id; also fills each project's
    proposals list. foundation: kingdom.read_foundation() (rules per ref, divergence, lock
    hashes); blobs: read_blobs() for patch previews and upstream status (without it they are
    n/a); prev_props: the previous proposals.jsonl rows; decisions: curated/decisions.toml
    [[decision]] rows ({id, proposal|bulk_key, outcome: declined|deferred|accepted, reason});
    lock: vocab/kingdom.lock.toml as read (None skips the vocab-drift check); curated: for
    disputes and upstream notes; facets: vocab/facets.toml (for the competing vocabularies)."""
    now = now or safety.utc_now()
    q = _Queue(snapshot, foundation, blobs, safety.iso(now))
    rule_p01(q, curated)
    rule_p02(q)
    rule_p03(q, facets)
    rule_p04(q)
    rule_p05(q)
    rule_p06(q)
    rule_p07(q)
    rule_p08(q)
    rule_p09(q)
    rule_p10(q, curated)
    rule_p11(q)
    rule_p12(q)
    rule_p13(q)
    rule_p14(q)
    rule_p15(q, lock)
    rule_p16(q, curated)
    rule_p17(q, curated)
    _spheres(q)
    counts = {}
    for prop in q.items.values():
        if prop["bulk_key"]:
            counts[prop["bulk_key"]] = counts.get(prop["bulk_key"], 0) + max(1, len(q.members[prop["id"]]) if prop["rule"] == "P10" else 1)
    for prop in q.items.values():
        if prop["bulk_key"]:
            prop["bulk_count"] = counts[prop["bulk_key"]]
    carried = _apply_lifecycle(q, prev_props, decisions, now)
    for ident, members in q.members.items():
        for pid in members:
            project = q.projects.get(pid)
            if project is not None and ident not in project["proposals"]:
                project["proposals"].append(ident)
    for project in q.projects.values():
        project["proposals"].sort()
    return sorted(list(q.items.values()) + carried, key=lambda p: p["id"])


def summary(props):
    """Counts by status, owner and rule, for the atlas and PROPOSALS.md headers."""
    out = {"by_status": {}, "by_owner": {}, "by_rule": {}, "open": 0, "long_open": 0}
    for prop in props:
        out["by_status"][prop["status"]] = out["by_status"].get(prop["status"], 0) + 1
        if prop["status"] in ("open", "conflict-with-upstream"):
            owner = prop["target"]["owner"]
            out["by_owner"][owner] = out["by_owner"].get(owner, 0) + 1
            out["by_rule"][prop["rule"]] = out["by_rule"].get(prop["rule"], 0) + 1
            out["open"] += 1
            out["long_open"] += 1 if prop.get("long_open") else 0
    return out
