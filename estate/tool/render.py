"""Views of one estate build (spec section 7): ATLAS.md, ATLAS.html, PROPOSALS.md, DRIFT.md,
QUEUE.md, ATTENTION.md, HYGIENE.md (owner decision D8), CAPABILITIES.md (the business capability map)
and portfolio-join.json.

Every view is a projection of the snapshot model.build_records() returned and the proposals
proposals.propose() returned. Nothing here measures, resolves or decides: a value the model left
unknown is shown as unknown, and an input the caller did not provide is named as not provided.

The atlas is built once as a list of blocks and emitted twice, as Markdown and as self-contained
HTML, so the two skeletons cannot drift and escaping lives in exactly one place per format. All
writes go through safety.PrivateArea.write (O_EXCL, no-follow, 0600) into the run directory.
"""
import datetime as dt
import html
import json
import os
import re
import urllib.parse
from collections import Counter

import capability
import curate
import decisions
import hygiene
import ideas
import model
import motifs
import proposals as proposal_rules
import safety
import sphere


VIEW_FILES = ("ATLAS.md", "ATLAS.html", "PROPOSALS.md", "DRIFT.md", "QUEUE.md", "ATTENTION.md",
              "HYGIENE.md", "HYGIENE.html", "CAPABILITIES.md", "portfolio-join.json")
JOIN_SCHEMA = "estate.portfolio-join/1"
# Spec 7, plus base-uri and form-action, which default-src does not cover.
CSP = "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
STALE_AFTER_S = 7 * 86400
WHAT_MAX = 140
OPEN = ("open", "conflict-with-upstream")
LIVENESS_COLUMNS = ("active", "dormant", "archived", "gone")
STANDING_COLUMNS = ("owned", "card-untracked", "card-invalid", "listed", "unlisted")
# Matrix rows after the layers: a partition by layer status, so every record is counted once.
# "unset" means no claim exists; a project with no checkout here had no card to read at all.
UNSET_UNREAD = "unset, no checkout here"
# A curated id that matches no checkout and no listing has its own row: it is curation waiting
# for a record (QUEUE orphaned-curation), not a project measured as unplaced.
ORPHANED = "orphaned curation"
TRAILING_ROWS = ("contested", "roster-fallback", "off-enum-only", "unset", UNSET_UNREAD, ORPHANED)
CITIZEN_FAMILY = "fleet-citizens"
INCIDENTAL_PROVENANCE = ("vendored", "generated")
LEGAL_QUESTION = "q:legal-entities"
QUEUE_ORDER = ("uncurated", "family-unassigned", "role-unknown", "unmapped-tag", "topic-below-threshold",
               "orphaned-curation", "local-forge-migration", "local-alias", "review-overdue",
               "family-unreviewed", "what-heavy", "capability-unassigned", "capability-candidate",
               "capability-review-overdue", "capability-orphan-row", "wire-unevidenced", "wire-differs", "motif-stale",
               "idea-done-unbacked")
# ATTENTION order of spec 7; risks not named there follow alphabetically.
ATTENTION_ORDER = tuple(curate.RISKS[key] for key in (
    "unsaved", "unpushed", "single", "partial", "lender", "borrower", "prunable", "secret-path",
    "secret-history", "hollow", "tcc", "lan", "cost", "churn"))
SCHEDULER_ORDER = ("failing", "unknown", "disabled", "healthy")
DRIFT_SECTIONS = {
    1: "KINGDOM claims vs measurements",
    2: "Map vs map",
    3: "Tag expectations that failed",
    4: "Changes since the previous run",
    5: "Vocabulary drift and mirror drift",
    6: "Hollow greens (contradicted observations)",
}


# ── small text helpers ──────────────────────────────────────────────────────────────────────

def text(value):
    """One-line display text for any value; None reads as an em dash, never as 0 or empty."""
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, (list, tuple)):
        return ", ".join(text(v) for v in value) if value else "—"
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)
    return " ".join(str(value).split())


def clip(value, limit=WHAT_MAX):
    value = text(value)
    return value if len(value) <= limit else value[:limit - 1].rstrip() + "…"


def age_text(seconds):
    if seconds is None:
        return "unknown"
    seconds = int(seconds)
    if seconds < 120:
        return "%d s" % seconds
    if seconds < 7200:
        return "%d min" % (seconds // 60)
    if seconds < 172800:
        return "%d h" % (seconds // 3600)
    return "%d d" % (seconds // 86400)


rule_of = proposal_rules.rule_of


def schedule_text(value):
    """launchd, cron, hermes and CI schedules in one readable form; unset keys are left out."""
    if isinstance(value, dict):
        parts = ["%s %s" % (str(k).replace("_", " "), schedule_text(item)) for k, item in sorted(value.items())
                 if item not in (None, [], {}, False)]
        return "; ".join(parts) or "—"
    if isinstance(value, (list, tuple)):
        return ", ".join(schedule_text(item) for item in value) or "—"
    return text(value)


def short(sha):
    return sha[:12] if isinstance(sha, str) else "—"


def rel_home(path, home):
    """A path shown home-relative, as census does for checkouts (the atlas is private)."""
    if not isinstance(path, str):
        return "—"
    if home and (path == home or path.startswith(home + os.sep)):
        return "~" if path == home else safety.HOME_PREFIX + path[len(home) + 1:]
    return path


# ── facets ──────────────────────────────────────────────────────────────────────────────────

def facet_of(record, name):
    return (record.get("facets") or {}).get(name) or {}


def facet_values(facet):
    """Values a record is filed under, as model.facet_index files it: the value(s), each candidate
    of a contested facet, or the status when there is no value."""
    values = facet.get("values") if "values" in facet else model.contested_values(facet)
    return list(values) if values else [facet.get("status") or "unknown"]


def facet_text(facet):
    if "values" in facet:
        return ", ".join(facet["values"]) if facet["values"] else (facet.get("status") or "unknown")
    if facet.get("value") is not None:
        return str(facet["value"])
    if facet.get("status") == "contested":
        return "contested " + "|".join(model.contested_values(facet))
    return facet.get("status") or "unknown"


def candidates_text(facet):
    parts = ["%s ← %s @%s%s" % (c.get("value"), c.get("source"), c.get("ref"),
                                " (overruled by %s)" % c["overruled_by"] if c.get("overruled_by") else "")
             for c in facet.get("candidates") or []]
    parts += ["%s (off-enum) ← %s @%s" % (c.get("value"), c.get("source"), c.get("ref"))
              for c in facet.get("off_enum") or []]
    return "; ".join(parts) or "—"


def authority_text(snapshot):
    """The ref KINGDOM facets resolve on, with why: the owner decision naming it the taxonomy
    authority, the config pin, or the default."""
    auth = snapshot.get("authority") or {}
    ref = snapshot.get("ref") or "unknown"
    if auth.get("unreadable"):
        return "%s (the primary ref %s could not be read in this run)" % (ref, auth["unreadable"])
    if auth.get("basis") == "decision":
        return "%s (taxonomy authority, owner decision %s)" % (ref, auth.get("decision"))
    if auth.get("basis") == "config":
        return "%s (private config pin; no owner decision names the authority)" % ref
    return ref


def layer_label(v, layer):
    """The ARCHITECTURE label of a layer on the primary ref, or None (os has no row)."""
    refs = (v.snapshot.get("foundation") or {}).get("refs") or {}
    mapped = ((refs.get(v.snapshot.get("ref")) or {}).get("architecture") or {}).get("mapped") or {}
    return (mapped.get(layer) or {}).get("label")


def layer_slot(project):
    """(row, value): row is a layer value for a settled layer, else the layer status (with unset
    split by whether a card could be read here at all)."""
    facet = facet_of(project, "layer")
    status = facet.get("status") or "unset"
    if (project.get("flags") or {}).get("orphaned_curation"):
        return ORPHANED, None
    if status == "settled" and facet.get("value") is not None:
        return facet["value"], facet["value"]
    if status == "unset" and unread_card(project):
        return UNSET_UNREAD, None
    return status, facet.get("value")


def unread_card(project):
    """True when no card could be read here: the project has no checkout on this machine."""
    return not project.get("checkouts") and (project.get("kingdom") or {}).get("card_present") is None


def placed_layer(project):
    """The layer section a record is listed in (settled or roster-fallback value), or None."""
    facet = facet_of(project, "layer")
    if facet.get("status") in ("settled", "roster-fallback"):
        return facet.get("value")
    return None


def is_citizen(project):
    roles = facet_of(project, "role").get("values") or []
    family = facet_of(project, "family").get("value")
    sources = [c.get("source") or "" for c in facet_of(project, "layer").get("candidates") or []]
    return "citizen" in roles or family == CITIZEN_FAMILY or any(s.startswith("harvest:fleet") for s in sources)


def is_incidental(project):
    return bool((project.get("flags") or {}).get("incidental")) or \
        (project.get("display") or {}).get("provenance") in INCIDENTAL_PROVENANCE


# ── document blocks: one skeleton, two emitters ─────────────────────────────────────────────

class Doc:
    """An ordered list of blocks. Values are plain text; the emitters escape them."""

    def __init__(self):
        self.blocks = []

    def h(self, level, value, anchor=None):
        self.blocks.append(("h", level, value, anchor))

    def p(self, value, cls=None):
        self.blocks.append(("p", value, cls))

    def ul(self, items):
        items = list(items)
        self.blocks.append(("ul", items) if items else ("p", "none", None))

    def table(self, headers, rows):
        rows = [list(r) for r in rows]
        self.blocks.append(("table", list(headers), rows) if rows else ("p", "none", None))

    def records(self, headers, rows, markdown=True):
        """rows: [(record id, cells, detail rows)]; a table in Markdown (unless markdown is False,
        where another block already lists them), a <details> each in HTML."""
        if rows:
            self.blocks.append(("records", list(headers), list(rows), markdown))

    def group(self, summary, headers, rows):
        """A collapsed group: one line in Markdown; in HTML a <details> holding its members."""
        self.blocks.append(("group", summary, list(headers), list(rows)))

    def stub(self, value, ids):
        self.blocks.append(("stub", value, sorted(ids)))

    def pre(self, value):
        self.blocks.append(("pre", value))

    def link(self, value, href):
        """One line that is a link to another private file (a file: URL, so it works from every link
        the atlas is reached through)."""
        self.blocks.append(("link", value, href))

    def filters(self):
        self.blocks.append(("filters",))


_MD_SPECIAL = re.compile(r"([\\`*\[\]<>|])")


def md(value):
    """Markdown-safe one-line text: backslash-escapes the characters that could open markup,
    an HTML tag or a table cell, so a planted value renders as itself."""
    return _MD_SPECIAL.sub(r"\\\1", text(value))


def _md_table(headers, rows):
    lines = ["| " + " | ".join(md(h) for h in headers) + " |", "|" + "---|" * len(headers)]
    lines += ["| " + " | ".join(md(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


def _fence(value):
    longest = max((len(run) for run in re.findall(r"`+", value)), default=0)
    fence = "`" * max(3, longest + 1)
    return fence + "\n" + value.rstrip("\n") + "\n" + fence


def to_markdown(doc):
    out = []
    for block in doc.blocks:
        kind = block[0]
        if kind == "h":
            out.append("#" * block[1] + " " + md(block[2]))
        elif kind == "p":
            out.append("> **" + md(block[1]) + "**" if block[2] in ("banner", "warn") else md(block[1]))
        elif kind == "ul":
            out.append("\n".join("- " + md(item) for item in block[1]))
        elif kind == "table":
            out.append(_md_table(block[1], block[2]))
        elif kind == "records" and block[3]:
            out.append(_md_table(block[1], [cells for _, cells, _ in block[2]]))
        elif kind == "group":
            out.append("- ▸ " + md(block[1]))
        elif kind == "stub":
            out.append("- → " + md(block[1]))
        elif kind == "pre":
            out.append(_fence(block[1]))
        elif kind == "link":
            out.append("[%s](<%s>)" % (md(block[1]), block[2]))
        elif kind == "toc":
            out.append("Contents: " + " · ".join(md(title) for _anchor_id, title in block[1]))
    return "\n\n".join(out) + "\n"


def esc(value):
    return html.escape(text(value), quote=True)


def _anchor(value):
    return re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-") or "section"


def _html_table(headers, rows):
    head = "".join("<th>%s</th>" % esc(h) for h in headers)
    body = "".join("<tr>" + "".join("<td>%s</td>" % esc(c) for c in row) + "</tr>" for row in rows)
    return '<div class="scroll"><table><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (head, body)


def _html_record(headers, rid, cells, detail):
    meta = " · ".join("%s %s" % (h, c) for h, c in zip(headers[1:], cells[1:]) if c not in (None, "", "—"))
    rows = "".join("<tr><th>%s</th><td>%s</td><td>%s</td><td>%s</td></tr>" % tuple(esc(v) for v in row)
                   for row in detail)
    return ('<details class="rec" data-id="%s"><summary><span class="nm">%s</span> <span class="meta">%s</span>'
            '</summary><div class="scroll"><table class="kv"><thead><tr><th>field</th><th>value</th>'
            '<th>source</th><th>at</th></tr></thead><tbody>%s</tbody></table></div></details>'
            % (esc(rid), esc(cells[0]), esc(meta), rows))


def to_html_body(doc):
    out = []
    for block in doc.blocks:
        kind = block[0]
        if kind == "h":
            anchor = block[3] or _anchor(block[2])
            out.append('<h%d id="%s">%s</h%d>' % (block[1], esc(anchor), esc(block[2]), block[1]))
        elif kind == "p":
            cls = ' class="%s"' % esc(block[2]) if block[2] else ""
            out.append("<p%s>%s</p>" % (cls, esc(block[1])))
        elif kind == "ul":
            out.append("<ul>" + "".join("<li>%s</li>" % esc(i) for i in block[1]) + "</ul>")
        elif kind == "table":
            out.append(_html_table(block[1], block[2]))
        elif kind == "records":
            out.append("".join(_html_record(block[1], rid, cells, detail) for rid, cells, detail in block[2]))
        elif kind == "group":
            members = "".join(_html_record(block[2], rid, cells, detail) for rid, cells, detail in block[3])
            out.append('<details class="grp"><summary>▸ %s <span class="cnt"></span></summary>%s</details>'
                       % (esc(block[1]), members))
        elif kind == "stub":
            out.append('<p class="stub" data-ids="%s">→ %s <a href="#disputed">Disputed</a></p>'
                       % (esc(json.dumps(block[2])), esc(block[1])))
        elif kind == "pre":
            out.append("<pre>%s</pre>" % html.escape(block[1], quote=True))
        elif kind == "link":
            out.append('<p><a href="%s">%s</a></p>' % (esc(block[2]), esc(block[1])))
        elif kind == "filters":
            out.append(FILTERS_HTML)
        elif kind == "toc":
            out.append('<nav class="toc" aria-label="contents">%s</nav>' % " · ".join(
                '<a href="#%s">%s</a>' % (esc(anchor), esc(title)) for anchor, title in block[1]))
    return "\n".join(out)


def script_json(data):
    """JSON safe inside <script type="application/json">: no '<' can close the element or open
    a comment, and '>' and '&' are escaped for good measure. JSON.parse reads it back unchanged."""
    raw = json.dumps(data, ensure_ascii=False, sort_keys=True, default=str)
    return raw.replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")


# ── the view of one build ───────────────────────────────────────────────────────────────────

class View:
    """Indexes over one snapshot and its proposals, shared by every file this module writes."""

    def __init__(self, snapshot, props, meta, curated, vocab, portfolio, prev_props, run_id, home):
        self.snapshot = snapshot
        self.meta = meta or {}
        self.curated = curated or {}
        self.vocab = vocab or {}
        self.portfolio = portfolio
        self.prev_props = prev_props
        self.run_id = run_id
        self.home = home
        self.records = [r for r in snapshot.get("records") or [] if isinstance(r, dict) and r.get("id")]
        self.by_id = {r["id"]: r for r in self.records}
        self.present = [r for r in self.records if r.get("presence", "present") == "present"]
        self.absent = [r for r in self.records if r.get("presence", "present") != "present"]
        self.projects = sorted((r for r in self.present if r.get("kind") == "project"), key=self.name_key)
        self.props = sorted((p for p in props or [] if isinstance(p, dict)), key=self.prop_key)
        self.prop_by_id = {p["id"]: p for p in self.props}
        self.layers = list(snapshot.get("layers") or [])
        self.sources = snapshot.get("sources") or {}
        nav = ((self.vocab.get("facets") or {}).get("meta") or {}).get("navigation")
        self.navigation = list(nav or model.NAVIGATION)
        self.hygiene = snapshot.get("hygiene") or {"status": "not provided", "reason": "not provided to the renderer"}
        self.hygiene_href = "HYGIENE.md"  # render_all sets the run's own file: URL
        self.ideas = snapshot.get("ideas") or {"status": "not provided", "reason": "not provided to the renderer"}
        self.capabilities_href = "CAPABILITIES.md"  # likewise

    def kind(self, kind):
        return sorted((r for r in self.present if r.get("kind") == kind), key=lambda r: r["id"])

    def decision(self, ident):
        """The owner decision with this id, or None."""
        return next((d for d in (self.curated.get("owner_decisions") or []) if d.get("id") == ident), None)

    @staticmethod
    def name_key(record):
        return (str(record.get("name") or record["id"]).lower(), record["id"])

    @staticmethod
    def prop_key(prop):
        return (prop.get("status") not in OPEN, prop.get("priority") or 9, not prop.get("needs_yu"),
                -(prop.get("bulk_count") or 0), prop.get("rule") or "", prop.get("id") or "")

    def name(self, rid):
        record = self.by_id.get(rid)
        if record is None:
            return str(rid)
        return str(record.get("name") or record.get("label") or rid)

    def rel(self, checkout_id):
        co = self.by_id.get(checkout_id)
        if not co:
            return "—"
        return co.get("rel") or rel_home(co.get("path"), self.home)

    def open_rules(self, project):
        rules = {self.prop_by_id[pid]["rule"] for pid in project.get("proposals") or []
                 if pid in self.prop_by_id and self.prop_by_id[pid].get("status") in OPEN}
        return " ".join(sorted(rules)) or "—"

    def prop_ids(self, project, *rules):
        return [pid for pid in project.get("proposals") or [] if rule_of(pid) in rules]

    def what(self, project):
        curated = project.get("curated") or {}
        if curated.get("what"):
            return clip(curated["what"])
        description = (project.get("forge") or {}).get("description")
        return clip("forge: " + description) if description else "—"

    def state_vs_liveness(self, project):
        state = facet_of(project, "state")
        live = facet_of(project, "liveness").get("value")
        claim = facet_text(state)
        measured = live if live is not None else (facet_of(project, "liveness").get("status") or "unknown")
        if state.get("value") is None or live is None:
            return "%s vs %s" % (claim, measured)
        agrees = model.state_agrees(state["value"], live, project)
        return "%s %s %s" % (claim, "=" if agrees else "≠", measured)

    def hosting(self, project):
        facet = facet_of(project, "hosting")
        values = facet.get("values") or []
        if not values:
            return facet.get("status") or "unknown"
        classes = facet.get("attribution") or {}
        return ", ".join("%s (%s)" % (v, classes.get(v, "unattributed")) for v in values)

    def role(self, project):
        facet = facet_of(project, "role")
        value = facet_text(facet)
        status = facet.get("role_status") or (project.get("display") or {}).get("role_status")
        return "%s [%s]" % (value, status) if status and facet.get("values") else value

    def cells(self, project):
        return [project.get("name") or project["id"], self.what(project), facet_text(facet_of(project, "kind")),
                facet_text(facet_of(project, "sphere")) if facet_of(project, "sphere") else "—",
                self.state_vs_liveness(project), self.role(project), self.hosting(project),
                facet_text(facet_of(project, "running")), facet_text(facet_of(project, "standing")),
                self.open_rules(project)]

    def detail(self, project):
        """(field, value, source, at) rows: KINGDOM resolution, claims, then measurements."""
        rows = [("id", project["id"], "—", "—")]
        for name in model.KINGDOM_FIELDS:
            facet = facet_of(project, name)
            rows.append(("%s (kingdom)" % name, "%s — %s" % (facet_text(facet), candidates_text(facet)),
                         "%s %s" % (facet.get("src") or "—", facet.get("resolved_by") or ""), facet.get("at")))
        for claim in project.get("claims") or []:
            rows.append(("claim %s" % claim.get("field"), claim.get("value"), claim.get("source"), claim.get("at")))
        for name in self.navigation:
            if name in model.KINGDOM_FIELDS:
                continue
            facet = facet_of(project, name)
            rows.append((name, facet_text(facet), "%s %s" % (facet.get("basis") or "—", facet.get("src") or ""),
                         facet.get("at")))
        for key, value in sorted((project.get("measures") or {}).items()):
            rows.append(("measure %s" % key, value, "src:census", None))
        rows.append(("checkouts", ["%s (%s)" % (self.rel(c), (self.by_id.get(c) or {}).get("checkout_role"))
                                   for c in project.get("checkouts") or []], "src:census", None))
        rows.append(("canonical", "%s (%s)" % (self.rel(project.get("canonical_checkout")),
                                                project.get("canonical_basis")), "model", None))
        rows.append(("surfaces", project.get("surfaces") or [], "join", None))
        rows.append(("schedulers", project.get("schedulers") or [], "join", None))
        rows.append(("proposals", ["%s (%s)" % (p, (self.prop_by_id.get(p) or {}).get("status", "?"))
                                   for p in project.get("proposals") or []], "proposals", None))
        rows.append(("risks", project.get("risks") or [], "model", None))
        rows.append(("freshness", (project.get("freshness") or {}).get("worst"), "sources", None))
        return rows

    def record_row(self, project):
        return (project["id"], self.cells(project), self.detail(project))


HEADERS = ("name", "what", "kind", "sphere", "state vs liveness", "role", "hosting", "running", "standing",
           "proposals")


# ── ATLAS ───────────────────────────────────────────────────────────────────────────────────

def atlas_doc(v):
    doc = Doc()
    _header(doc, v)
    doc.filters()
    _matrix(doc, v)
    _standing(doc, v)
    _foundation(doc, v)
    _kingdom_os(doc, v)
    _layer_sections(doc, v)
    _disputed(doc, v)
    _unplaced(doc, v)
    _surfaces(doc, v)
    _schedulers(doc, v)
    _business(doc, v)
    _freshness(doc, v)
    _proposals_summary(doc, v)
    _hygiene(doc, v)
    _decided(doc, v)
    _questions(doc, v)
    sections = [(b[3] or _anchor(b[2]), b[2]) for b in doc.blocks if b[0] == "h" and b[1] == 2]
    at = next(i for i, b in enumerate(doc.blocks) if b[0] == "filters")
    doc.blocks.insert(at, ("toc", sections))
    return doc


def run_state(v):
    reasons = list(v.meta.get("degraded_reasons") or v.snapshot.get("degraded_reasons") or [])
    state = v.meta.get("state") or ("degraded" if reasons else "complete")
    return state, reasons


def _header(doc, v):
    snap = v.snapshot
    doc.h(1, "Estate atlas — run %s" % v.run_id, "top")
    full = v.sources.get("src:full-walk") or {}
    mode = v.meta.get("mode") or "unknown"
    state, reasons = run_state(v)
    doc.p("Observed %s · ref %s · mode %s (last full walk %s ago) · state %s" % (
        snap.get("observed_at") or "unknown", authority_text(snap), mode, age_text(full.get("age_s")), state))
    worst = snap.get("worst_source")
    if worst:
        doc.p("WORST SOURCE: %s — %s, age %s%s%s" % (
            worst.get("id"), worst.get("freshness"), age_text(worst.get("age_s")),
            " (required)" if worst.get("required") else "", ("; " + worst["note"]) if worst.get("note") else ""),
            "banner")
    else:
        doc.p("WORST SOURCE: unknown — no configured source entry reached the renderer", "banner")
    doc.p("Treat this atlas as STALE after %s (7 days after observation); estate check says so too."
          % _plus_days(snap.get("observed_at"), 7))
    if reasons:
        doc.p("Degraded because:")
        doc.ul(reasons)
    counts = snap.get("counts") or {}
    computed = counts.get("computed") or {}
    doc.p("Computed: " + (", ".join("%s %s" % (k, computed[k]) for k in sorted(computed)) or "none"))
    doc.table(("declared", "source", "declared value", "computed", "metric"),
              [(d.get("label") or d.get("id"), d.get("source"), d.get("declared"), d.get("computed"), d.get("metric"))
               for d in counts.get("disagreements") or []])
    unverifiable = counts.get("unverifiable") or []
    if unverifiable:
        doc.p("Declared but unverifiable: " + "; ".join("%s says %s (%s)" % (u.get("label") or u.get("id"),
                                                                             u.get("declared"), u.get("source"))
                                                         for u in unverifiable))
    doc.p("Private view; never commit or publish it. The private curated area exists in one copy only "
          "(no backup); export-private makes one.", "warn")


def _plus_days(iso_text, days):
    moment = model.parse_iso(iso_text) if iso_text else None
    if moment is None:
        return "an unknown date (observation time unknown)"
    return safety.iso(moment + dt.timedelta(days=days))


def _partition(v):
    """{row: [projects]} over present projects: one row per layer value (settled), then the
    trailing statuses. Each record lands in exactly one row."""
    rows = {name: [] for name in v.layers + list(TRAILING_ROWS)}
    for project in v.projects:
        row, _ = layer_slot(project)
        rows.setdefault(row, []).append(project)
    return rows


def _row_label(v, row, members):
    if row in v.layers:
        return row
    if row == "contested":
        values = sorted({x for p in members for x in model.contested_values(facet_of(p, "layer"))})
        return "contested (%s; counted once)" % "|".join(values) if values else "contested"
    if row == "roster-fallback" and members:
        split = Counter(str(facet_of(p, "layer").get("value")) for p in members)
        return "roster-fallback (%s)" % ", ".join("%s %d" % kv for kv in sorted(split.items()))
    return row


def _matrix(doc, v):
    doc.h(2, "Layer × liveness", "matrix")
    doc.p("Rows partition the present projects by their KINGDOM layer under ref %s: layer rows hold settled "
          "values; contested, roster-fallback, off-enum-only and unset records have their own rows, so each "
          "record is counted once. Labels come from the ARCHITECTURE box of that ref." % authority_text(v.snapshot))
    columns = LIVENESS_COLUMNS + ("unknown",)
    rows, totals = [], [0] * (len(columns) + 3)
    for row, members in _partition(v).items():
        counts = [sum(1 for p in members if (facet_of(p, "liveness").get("value") or "unknown") == c) for c in columns]
        resting = sum(1 for p in members if (p.get("flags") or {}).get("resting"))
        up = sum(1 for p in members if facet_of(p, "running").get("value") == "up")
        line = counts + [resting, up, len(members)]
        totals = [a + b for a, b in zip(totals, line)]
        rows.append([_row_label(v, row, members), (layer_label(v, row) or "—") if row in v.layers else ""] + line)
    rows.append(["total", ""] + totals)
    doc.table(("layer", "label") + columns + ("resting", "running up", "total"), rows)
    if v.absent:
        missing = sum(1 for r in v.absent if r.get("presence") == "missing")
        doc.p("Not in the matrix: %d records missing and %d gone since earlier runs (DRIFT section 4)."
              % (missing, len(v.absent) - missing))


def _standing(doc, v):
    doc.h(2, "Standing ladder", "standing")
    columns = STANDING_COLUMNS + ("unknown",)
    rows = []
    for row, members in _partition(v).items():
        counts = [sum(1 for p in members if (facet_of(p, "standing").get("value") or "unknown") == c) for c in columns]
        rows.append([_row_label(v, row, members)] + counts + [len(members)])
    doc.table(("layer",) + columns + ("total",), rows)


def _foundation(doc, v):
    doc.h(2, "§0 Foundation", "foundation")
    found = v.snapshot.get("foundation") or {}
    refs = found.get("refs") or {}
    auth = v.snapshot.get("authority") or {}
    primary = v.snapshot.get("ref")
    fetch = found.get("fetch_head") or {}
    doc.p("kingdom-os %s (remote %s). The card enums and LAYERS are read live from bin/harvest.ts on every "
          "run; this layer never copies or extends them." % (rel_home(found.get("kos_path"), v.home),
                                                             found.get("remote_id") or "unknown"))
    if auth.get("basis") == "decision":
        others = [ref for ref in sorted(refs) if ref != auth.get("ref")]
        doc.p("Taxonomy authority: %s of %s, by owner decision %s. %s read and shown for drift only: where it "
              "differs, the value follows %s. %s is as fresh as kingdom-os's last fetch: FETCH_HEAD %s (age %s)%s; "
              "the estate never fetches." % (
                  auth.get("ref"), found.get("remote_id") or "kingdom-os", auth.get("decision"),
                  ("The %s ref is" % " and ".join(others)) if others else "No other ref is", auth.get("ref"),
                  auth.get("ref"),
                  fetch.get("mtime") or "unknown", age_text(fetch.get("age_s")),
                  " — " + fetch["reason"] if fetch.get("reason") else ""))
        if auth.get("unreadable"):
            doc.p("The authority ref %s could not be read in this run; KINGDOM facets were resolved on %s."
                  % (auth["unreadable"], primary), "warn")
        if decisions.conflict_reason(auth):
            doc.p(decisions.conflict_reason(auth), "warn")
        effects = (v.decision(auth.get("decision")) or {}).get("effects") or {}
        if effects.get("non_authoritative"):
            doc.p("Non-authoritative, proposals only: %s." % "; ".join(effects["non_authoritative"]))
    else:
        doc.p("Taxonomy authority: no owner decision names one; the build reads %s." % authority_text(v.snapshot))
    rows = []
    for ref, data in sorted(refs.items(), key=lambda kv: (kv[0] != primary, kv[0])):
        arch = data.get("architecture") or {}
        schema = data.get("schema_check") or {}
        rows.append((ref, "authority" if ref == primary and auth.get("basis") == "decision" else
                     ("primary" if ref == primary else "drift only"), data.get("status"), short(data.get("commit")),
                     data.get("committed_at"), " → ".join(data.get("layers") or []) or "—", arch.get("row_count"),
                     "ok" if schema.get("ok") else ("mismatch: %s" % text(schema.get("mismatches"))
                                                    if schema else "not checked"),
                     text(data.get("parse_errors")) if data.get("parse_errors") else "none"))
    doc.table(("ref", "role", "status", "commit", "committed", "LAYERS", "ARCHITECTURE rows", "SCHEMA.md",
               "parse errors"), rows)
    ab = found.get("ahead_behind") or {}
    doc.p("FETCH_HEAD %s (age %s)%s · local is %s ahead and %s behind origin/main%s" % (
        fetch.get("mtime") or "unknown", age_text(fetch.get("age_s")),
        (" — " + fetch["reason"]) if fetch.get("reason") else "", text(ab.get("ahead")), text(ab.get("behind")),
        (" — " + ab["reason"]) if ab.get("reason") else ""))
    lock = v.meta.get("lock")
    if lock is None:
        doc.p("Lock (vocab/kingdom.lock.toml): state not provided to the renderer.")
    else:
        doc.p("Lock (vocab/kingdom.lock.toml): %s; %d hash differences; %d ref commits moved." % (
            lock.get("state"), len(lock.get("diffs") or []), len(lock.get("commits_moved") or [])))
    doc.p("LAYERS (%s): %s" % (primary or "unknown", " → ".join(v.layers) or "unknown"))
    for ref, data in sorted(refs.items(), key=lambda kv: (kv[0] != primary, kv[0])):
        arch = data.get("architecture") or {}
        mapped = arch.get("mapped") or {}
        layers = data.get("layers") or []
        doc.h(3, "ARCHITECTURE box, %s%s" % (ref, " (labels shown in this atlas)" if ref == primary else " (drift only)"))
        doc.table(("layer", "label", "one-liner"),
                  [(layer, (mapped.get(layer) or {}).get("label") or "— (no row)",
                    (mapped.get(layer) or {}).get("one_liner") or "— (none; not invented)") for layer in layers])
        unmapped = arch.get("unmapped_layers") or [layer for layer in layers if layer not in mapped]
        if unmapped:
            doc.p("ARCHITECTURE has no %s row; no one-liner is invented for %s." % (
                "/".join(unmapped), "it" if len(unmapped) == 1 else "them"))
    divergence = found.get("divergence") or []
    doc.p("worktree vs origin/main%s:" % (" (drift; the map follows %s)" % primary
                                          if auth.get("basis") == "decision" else ""))
    doc.ul("%s: worktree %s, origin/main %s" % (d.get("key"), text(d.get("worktree")), text(d.get("origin/main")))
           for d in divergence)
    if found.get("alerts"):
        doc.p("Foundation alerts:", "warn")
        doc.ul(text(a) for a in found["alerts"])
    disputes = v.curated.get("disputes") if v.curated else None
    if disputes is None:
        doc.p("Curated disputes: not provided to the renderer.")
    else:
        doc.p("Curated disputes (%d):" % len(disputes))
        doc.ul("%s — %s [%s]: %s" % (d.get("id"), d.get("title"), _decided_status(d),
                                     "; ".join(d.get("outcome") or []) if d.get("decided_by") else
                                     "; ".join("%s (%s)" % (c.get("claim"), c.get("source"))
                                               for c in d.get("candidates") or []))
               for d in disputes)
    tiers = list((((v.vocab.get("facets") or {}).get("claim") or {}).get("realm_tier") or {}).get("values") or {})
    realm = v.sources.get("src:prior:realm_md") or {}
    doc.p("REALM tiers%s are cited as a claim (%s, %s), never as a layer value." % (
        " (" + ", ".join(tiers) + ")" if tiers else "", realm.get("id") or "src:prior:realm_md",
        realm.get("status") or "not read"))


SPHERE_LABELS = {sphere.KINGDOM_OS: "Part of KINGDOM OS", sphere.INDEPENDENT: "Independent",
                 sphere.UNDECIDED: "Undecided"}


def sphere_of(record):
    """The sphere facet of a project, zone or surface ({} when it has none)."""
    return facet_of(record, "sphere") if record.get("kind") == "project" else (record.get("sphere") or {})


def _counts(records):
    found = Counter(sphere_of(r).get("value") or "none" for r in records)
    return ", ".join("%s %d" % kv for kv in sorted(found.items())) or "none"


def _kingdom_os(doc, v):
    """KINGDOM OS as owner decision D4 frames it: the sphere facet over projects (by layer), the
    zones and their surfaces, and what is still undecided, with why, for Yu."""
    doc.h(2, "KINGDOM OS", "kingdom-os")
    info = v.snapshot.get("sphere") or {}
    ident = info.get("decision")
    d = v.decision(ident) if ident else None
    if d:
        doc.p("KINGDOM OS is the civilisation, not one repository: every civilisation-related repository and several "
              "Cloudflare domains belong to it, and kingdom-os is its connective map (owner decision %s%s)."
              % (ident, ", " + d["label"] if d.get("label") else ""))
    else:
        doc.p("No owner decision defines the sphere facet in this build: values come from curated assignments "
              "alone, and everything else is undecided.", "warn")
    values = info.get("values") or list(SPHERE_LABELS)
    meanings = ((((v.vocab.get("facets") or {}).get("facet") or {}).get("sphere") or {}).get("values")) or {}
    doc.ul("%s — %s" % (value, meanings.get(value) or "—") for value in values)
    by_layer = info.get("by_layer") or {}
    families = info.get("families") or {}
    doc.p("Each project takes its curated assignment, else the sphere of the project it mirrors or copies, else its "
          "family default (%s), else its KINGDOM layer on %s through %s (%s), else undecided." % (
              "; ".join("%s %s" % (fid.split(":", 1)[-1], value) for fid, value in sorted(families.items())) or "none",
              authority_text(v.snapshot), ident or "no decision",
              ", ".join("%s ⇒ %s" % kv for kv in by_layer.items()) or "no layer rule"))
    bases = Counter(sphere_of(p).get("basis") or "missing" for p in v.projects)
    unreviewed = sum(1 for p in v.projects if sphere_of(p).get("reviewed") is False)
    doc.p("Present projects: %s · by basis: %s · %d values rest on curated rows Yu has not reviewed yet "
          "(reviewed = false)." % (_counts(v.projects), ", ".join("%s %d" % kv for kv in sorted(bases.items())),
                                   unreviewed))
    columns = list(values)
    doc.h(3, "Sphere × layer")
    doc.p("Rows are the KINGDOM layer partition of the Layer × liveness matrix, so each present project is counted once.")
    rows, totals = [], [0] * (len(columns) + 1)
    for row, members in _partition(v).items():
        if not members and row not in v.layers:
            continue
        line = [sum(1 for p in members if sphere_of(p).get("value") == c) for c in columns] + [len(members)]
        totals = [a + b for a, b in zip(totals, line)]
        rows.append([_row_label(v, row, members), (layer_label(v, row) or "—") if row in v.layers else ""] + line)
    rows.append(["total", ""] + totals)
    doc.table(("layer", "label") + tuple(columns) + ("total",), rows)
    _kingdom_os_zones(doc, v, values)
    _kingdom_os_undecided(doc, v)
    if info.get("unmatched"):
        doc.p("Curated sphere rows naming no record of this run (QUEUE): %s." % ", ".join(info["unmatched"]))
    if info.get("mismatches"):
        doc.p("Curated zone and surface rows whose sphere differs from the project they hang on (QUEUE; the row "
              "stands until Yu reviews it): %s." % ", ".join("%s %s, %s %s" % (m["id"], m["value"], m["project"],
                                                                              m["project_value"])
                                                            for m in info["mismatches"]))
    if info.get("problems"):
        doc.p("Sphere problems:", "warn")
        doc.ul(info["problems"])


def _kingdom_os_zones(doc, v, values):
    doc.h(3, "Cloudflare domains and other zones")
    zones = sorted(v.kind("zone"), key=lambda z: z.get("fqdn") or z["id"])
    doc.p("Zones: %s. Each zone lists its surfaces; a surface whose sphere differs from its zone's says so."
          % _counts(zones))
    for value in values:
        members = [z for z in zones if sphere_of(z).get("value") == value]
        doc.h(4, "%s (%d zones)" % (SPHERE_LABELS.get(value, value), len(members)))
        rows = []
        for zone in members:
            facet = sphere_of(zone)
            surfaces = []
            for sid in zone.get("surfaces") or []:
                theirs = sphere_of(v.by_id.get(sid) or {}).get("value")
                surfaces.append(sid + (" [%s]" % theirs if theirs and theirs != value else ""))
            basis = facet.get("basis") + (" (follows %s)" % facet["follows"] if facet.get("follows") else "")
            rows.append((zone.get("fqdn"), zone.get("dns_provider"), basis, facet.get("confidence") or "—",
                         v.name(zone["owner_project"]) if zone.get("owner_project") else "—", account_text(zone),
                         ", ".join(surfaces) or "none"))
        doc.table(("zone", "dns", "basis", "confidence", "owner project", "account", "surfaces"), rows)
    loose = [s for s in v.kind("surface") if not s.get("zone_ids")]
    doc.p("Surfaces in no zone: %s (listed under Surfaces and zones)." % _counts(loose))


def _kingdom_os_undecided(doc, v):
    doc.h(3, "Undecided, for Yu")
    undecided = [p for p in v.projects if sphere_of(p).get("value") == sphere.UNDECIDED]
    third = [p for p in undecided if sphere_of(p).get("third_party")]
    asked = [p for p in undecided if not sphere_of(p).get("third_party")]
    doc.p("%d present projects are undecided: %d on mixed or absent evidence, %d third-party." % (
        len(undecided), len(asked), len(third)))
    doc.table(("name", "id", "family", "basis", "confidence", "why undecided", "evidence (last word, private)"),
              [(p.get("name") or p["id"], p["id"], _family_of(p), sphere_of(p).get("basis"),
                sphere_of(p).get("confidence") or "—", clip(sphere_of(p).get("reason"), 300),
                clip(sphere.final_word(sphere_of(p).get("evidence")), 400) or "—") for p in asked])
    placed = [p for p in v.projects if sphere_of(p).get("third_party") and sphere_of(p).get("value") != sphere.UNDECIDED]
    if third or placed:
        doc.p("Third-party code the estate holds but does not own (%d), one question: does it take a sphere at all? "
              "Owner decision D4 names none, so each is undecided: %s." % (
                  len(third), ", ".join("%s (%s)" % (p.get("name") or p["id"], _family_of(p)) for p in third) or "none"))
    if placed:
        doc.p("%d more third-party trees already carry a sphere, so the same answer reaches them: %s." % (
            len(placed), ", ".join("%s (%s, %s)" % (p.get("name") or p["id"], sphere_of(p).get("value"),
                                                    sphere_of(p).get("basis")) for p in placed)))
    others = [r for r in v.kind("zone") + v.kind("surface") if sphere_of(r).get("value") == sphere.UNDECIDED]
    doc.p("Undecided zones and surfaces: %d." % len(others))
    doc.table(("zone or surface", "basis", "confidence", "why undecided", "evidence (last word, private)"),
              [(r["id"], sphere_of(r).get("basis"), sphere_of(r).get("confidence") or "—",
                clip(sphere_of(r).get("reason"), 300), clip(sphere.final_word(sphere_of(r).get("evidence")), 300) or "—")
               for r in others])


def _decided_status(item):
    """A question's or dispute's status, naming the owner decisions that set it."""
    if item.get("decided_by"):
        return "%s by %s" % (item.get("status"), ", ".join(item["decided_by"]))
    return item.get("status") or "open"


def specific_group(groups):
    """The group that best names a project's set: one defined by the project itself (names,
    forge glob) over a set of checkouts in one place (a mirror), then the smallest."""
    ranked = sorted(groups, key=lambda g: (g.get("member_kind") == "checkout", len(g.get("member_projects") or []),
                                           g["id"]))
    return ranked[0] if ranked else None


def claims_text(group):
    """What KINGDOM says about a group's members, counted once per member (model.group_claims)."""
    claims = group.get("kingdom_claims") or {}
    status = ", ".join("%s %d" % kv for kv in sorted((claims.get("layer_status") or {}).items()))
    cands = ", ".join("%s %d" % kv for kv in sorted((claims.get("candidates") or {}).items()))
    return "layer %s%s" % (status or "unknown", "; " + cands if cands else "")


def _family_of(project):
    return facet_of(project, "family").get("value") or "unassigned"


def _group_index(v):
    """{project id: [group records]} for groups whose members are projects."""
    index = {}
    for group in v.kind("group"):
        for pid in group.get("member_projects") or []:
            index.setdefault(pid, []).append(group)
    return index


def _layer_sections(doc, v):
    groups_of = _group_index(v)
    ref = ((v.snapshot.get("foundation") or {}).get("refs") or {}).get(v.snapshot.get("ref")) or {}
    mapped = (ref.get("architecture") or {}).get("mapped") or {}
    for layer in v.layers:
        row = mapped.get(layer)
        doc.h(2, "Layer %s" % layer, "layer-" + layer)
        doc.p("%s: %s" % (row.get("label"), row.get("one_liner")) if row else
              "ARCHITECTURE has no %s row; no one-liner." % layer)
        placed = [p for p in v.projects if placed_layer(p) == layer]
        contested = [p for p in v.projects if facet_of(p, "layer").get("status") == "contested"
                     and layer in model.contested_values(facet_of(p, "layer"))]
        families = sorted({_family_of(p) for p in placed + contested}, key=lambda f: (f == "unassigned", f))
        if not families:
            doc.p("No records in this layer.")
        for family in families:
            _family_block(doc, v, layer, family, [p for p in placed if _family_of(p) == family],
                          [p for p in contested if _family_of(p) == family], groups_of)


def _family_block(doc, v, layer, family, placed, contested, groups_of):
    record = v.by_id.get("family:" + family) if family != "unassigned" else None
    doc.h(3, "%s · %s" % (layer, family if family != "unassigned" else "family unassigned"))
    if record and record.get("summary"):
        doc.p(clip(record["summary"], 600))
    loose = [p for p in placed if not groups_of.get(p["id"])]
    grouped = [p for p in placed if groups_of.get(p["id"])]
    doc.p("%d projects placed here: %d on their own, %d in groups (a project in several groups is listed under "
          "each group below)%s." % (len(placed), len(loose), len(grouped),
                                    "; %d more contested here (stubs below)" % len(contested) if contested else ""))
    doc.records(HEADERS, [v.record_row(p) for p in loose])
    by_group = {}
    for project in placed:
        for group in groups_of.get(project["id"]) or []:
            by_group.setdefault(group["id"], (group, []))[1].append(project)
    for gid in sorted(by_group):
        group, members = by_group[gid]
        doc.group("%s — %d here (now %s, at survey %s, Δ %s) · role %s · KINGDOM %s · %s" % (
            group.get("label") or gid, len(members), text(group.get("count_now")), text(group.get("count_at_survey")),
            text(group.get("delta")), text(group.get("role")), claims_text(group), clip(group.get("what"))),
            HEADERS, [v.record_row(p) for p in sorted(members, key=v.name_key)])
    stubs = {}
    for project in contested:
        group = specific_group(groups_of.get(project["id"]) or [])
        key = group["id"] if group else project["id"]
        stubs.setdefault(key, []).append(project)
    for key in sorted(stubs):
        members = stubs[key]
        values = sorted({x for p in members for x in model.contested_values(facet_of(p, "layer"))})
        label = (v.by_id.get(key) or {}).get("label") if key.startswith("group:") else members[0].get("name")
        doc.stub("%d %s, contested %s; see Disputed" % (len(members), label or key, "|".join(values)),
                 [p["id"] for p in members])


def _disputed(doc, v):
    doc.h(2, "Disputed", "disputed")
    groups_of = _group_index(v)
    rows, seen = {}, set()
    for project in v.projects:
        for name in model.KINGDOM_FIELDS:
            facet = facet_of(project, name)
            if facet.get("status") != "contested":
                continue
            seen.add(project["id"])
            group = specific_group(groups_of.get(project["id"]) or [])
            key = (name, group["id"] if group else project["id"], candidates_text(facet))
            rows.setdefault(key, []).append(project)
    doc.p("Contested records, each counted once: %d." % len(seen))
    citizens_dirs = sorted({"/".join(map(str, d)) if isinstance(d, (list, tuple)) else str(d)
                            for d in (data.get("citizens_dir") for data in
                                      ((v.snapshot.get("foundation") or {}).get("refs") or {}).values()) if d})
    overruled = sorted({c["overruled_by"] for p in v.projects for c in facet_of(p, "layer").get("candidates") or []
                        if c.get("overruled_by")})
    if overruled:
        doc.p("harvest forces layer fleet on carded repositories directly under its CITIZENS_DIR (%s); owner decision "
              "%s overrules that forced fleet, so %d such records keep their card's layer and harvest's fleet stays "
              "listed as a claim (see Decided)." % (
                  ", ".join(citizens_dirs) or "not read", ", ".join(overruled),
                  sum(1 for p in v.projects if facet_of(p, "layer").get("decided_by") in overruled)))
    elif any(c.get("source", "").startswith("harvest:fleet") for p in v.projects
             for c in facet_of(p, "layer").get("candidates") or []):
        doc.p("harvest forces layer fleet only on carded repositories directly under its CITIZENS_DIR (%s); a "
              "citizen whose card says soul is contested only when harvest reads it there."
              % (", ".join(citizens_dirs) or "not read"))
    groups_all = [g for g in v.kind("group") if (g.get("kingdom_claims") or {}).get("layer_status", {}).get("contested")]
    if groups_all:
        doc.ul("%s: %s" % (g.get("label") or g["id"], claims_text(g)) for g in groups_all)
    table = []
    for (name, holder, cands), members in sorted(rows.items()):
        label = (v.by_id.get(holder) or {}).get("label") if holder.startswith("group:") else None
        names = ", ".join(p.get("name") or p["id"] for p in sorted(members, key=v.name_key))
        p10 = sorted({pid for p in members for pid in v.prop_ids(p, "P10")})
        table.append((name, ("%s (%d): %s" % (label, len(members), names)) if label else names, cands,
                      facet_of(members[0], name).get("at"), " ".join(p10) or "—"))
    doc.table(("field", "records", "candidates (value ← source @ref)", "at", "P10"), table)
    doc.records(HEADERS, [v.record_row(p) for p in v.projects if p["id"] in seen], markdown=False)
    disputes = v.curated.get("disputes") if v.curated else None
    doc.h(3, "Curated disputes")
    if disputes is None:
        doc.p("not provided to the renderer")
    else:
        settled = [d for d in disputes if d.get("decided_by")]
        doc.table(("id", "title", "status", "candidates", "proposal rule"),
                  [(d.get("id"), d.get("title"), _decided_status(d),
                    "; ".join("%s ← %s" % (c.get("claim"), c.get("source")) for c in d.get("candidates") or []),
                    d.get("proposal_rule")) for d in disputes if not d.get("decided_by")])
        if settled:
            doc.p("Decided by the owner (see Decided):")
            doc.ul("%s — %s [%s]: %s" % (d.get("id"), d.get("title"), _decided_status(d),
                                         "; ".join(d.get("outcome") or []) or "—") for d in settled)
    doc.h(3, "Ref-divergent records")
    divergent = []
    for project in v.projects:
        for name in model.KINGDOM_FIELDS:
            facet = facet_of(project, name)
            if facet.get("ref_divergent"):
                divergent.append((project.get("name") or project["id"], name, model.by_ref_text(facet)))
    doc.table(("record", "field", "by ref"), divergent)


UNPLACED_HEADERS = HEADERS + ("off-enum or survey layer claim", "P01/P03")


def _survey_layer(project):
    return next((c.get("value") for c in project.get("claims") or [] if c.get("source") == "survey"
                 and c.get("field") == "layer"), None)


def _unplaced(doc, v):
    """Off-enum-only and unset records, described like the records of a layer section (what,
    kind, state vs liveness, role, hosting, running, standing), grouped by family, with the
    claims that could place them and their P01/P03 proposals."""
    doc.h(2, "Unplaced", "unplaced")
    rows = {}
    for project in v.projects:
        facet = facet_of(project, "layer")
        if facet.get("status") in ("off-enum-only", "unset"):
            row, _ = layer_slot(project)
            rows.setdefault(row, {}).setdefault(_family_of(project), []).append(project)
    total = sum(len(m) for families in rows.values() for m in families.values())
    doc.p("Records whose layer is off-enum-only or unset, with their P01/P03 proposals: %d. \"%s\" records have "
          "no checkout on this machine, so no card could be read; \"%s\" ids match no checkout and no listing; "
          "the others have no KINGDOM claim at all." % (total, UNSET_UNREAD, ORPHANED))
    for row in ("off-enum-only", "unset", UNSET_UNREAD, ORPHANED):
        families = rows.get(row) or {}
        if not families:
            continue
        doc.h(3, "%s (%d)" % (row, sum(len(m) for m in families.values())))
        for family in sorted(families, key=lambda f: (f == "unassigned", f)):
            members = sorted(families[family], key=v.name_key)
            doc.h(4, "%s · %s (%d)" % (row, family if family != "unassigned" else "family unassigned", len(members)))
            table = []
            for project in members:
                facet = facet_of(project, "layer")
                claims = [("%s ← %s" % (c.get("value"), c.get("source"))) for c in facet.get("off_enum") or []]
                if _survey_layer(project):
                    claims.append("%s ← survey" % _survey_layer(project))
                table.append((project["id"], v.cells(project) + [", ".join(claims) or "—",
                                                                  " ".join(v.prop_ids(project, "P01", "P03")) or "—"],
                              v.detail(project)))
            doc.records(UNPLACED_HEADERS, table)


def _surface_row(v, surface):
    health = surface.get("health") or {}
    caveat = health.get("caveat") or {}
    health_text = health.get("state") or "unknown"
    if caveat:
        health_text += " (%s)" % caveat_text(caveat)
    registry = surface.get("registry") or {}
    return (surface["id"], surface.get("provider"), surface.get("hostnames") or [],
            v.name(surface["source_project"]) if surface.get("source_project") else "unattributed",
            (surface.get("attribution") or {}).get("class"), health_text,
            registry.get("id") or "unregistered", surface.get("competing_sources") or [], account_text(surface),
            sphere_text(surface))


SURFACE_HEADERS = ("surface", "provider", "hostnames", "project", "attribution", "health", "REGISTRY", "competing",
                   "account", "sphere")


def sphere_text(record):
    """A sphere with its basis (and where it came from), for zone and surface lines."""
    facet = sphere_of(record)
    if not facet:
        return "—"
    return "%s (%s%s)" % (facet.get("value"), facet.get("basis"), ", via " + facet["via"] if facet.get("via") else "")


def account_text(record):
    """The account an owner decision attributes a surface or zone to, with that decision."""
    account = record.get("account") or {}
    if not account:
        return "—"
    return "%s (%s, %s)" % (account.get("id") or "no %s account row" % account.get("provider"),
                            account.get("basis"), account.get("decision"))


def caveat_text(caveat):
    """A caveat as evidence: its curated note is shown as the reason only when the check
    contradicted the observation or annotates it by design; otherwise the check's own result."""
    check = caveat.get("check")
    if caveat.get("contradicts"):
        return "contradicted by caveat %s (%s): %s" % (check, caveat.get("detail"), caveat.get("note"))
    if caveat.get("effect") == "annotate":
        return "caveat %s (%s): %s" % (check, caveat.get("detail"), caveat.get("note"))
    result = {True: "passed", False: "failed", None: "unknown"}.get(caveat.get("result"), "unknown")
    return "caveat %s %s: %s" % (check, result, caveat.get("detail"))


def tcc_text(sched):
    value = sched.get("tcc_exposed")
    if value is None:
        return "unknown" + (" (%s)" % sched["tcc_basis"].split(": ", 1)[-1] if sched.get("tcc_basis") else "")
    return text(value)


def _surfaces(doc, v):
    doc.h(2, "Surfaces and zones", "surfaces")
    doc.p("Joins only: zone → surface → project. Provider-level views stay with kingdom-os.")
    surfaces = v.kind("surface")
    registered = sum(1 for s in surfaces if s.get("registry"))
    doc.p("REGISTRY coverage: %d of %d surfaces carry a REGISTRY entry." % (registered, len(surfaces)))
    in_zone = set()
    for zone in sorted(v.kind("zone"), key=lambda z: z.get("fqdn") or z["id"]):
        doc.h(3, "%s (dns %s; seen in %s%s; sphere %s)" % (
            zone.get("fqdn"), zone.get("dns_provider"), text(zone.get("seen_in")),
            "; owned by " + account_text(zone) if zone.get("account") else "", sphere_text(zone)))
        members = [v.by_id[s] for s in zone.get("surfaces") or [] if s in v.by_id]
        in_zone.update(s["id"] for s in members)
        doc.table(SURFACE_HEADERS, [_surface_row(v, s) for s in members])
    doc.h(3, "Surfaces in no zone")
    doc.table(SURFACE_HEADERS, [_surface_row(v, s) for s in surfaces if s["id"] not in in_zone])
    doc.h(3, "Unregistered surfaces")
    doc.ul("%s (%s)" % (s["id"], text(s.get("hostnames"))) for s in surfaces if not s.get("registry"))
    doc.h(3, "Competing sources")
    doc.ul("%s: %s" % (s["id"], ", ".join(v.name(p) for p in s["competing_sources"]))
           for s in surfaces if s.get("competing_sources"))


def _scheduler_key(sched):
    state = (sched.get("health") or {}).get("state") or "unknown"
    order = SCHEDULER_ORDER.index(state) if state in SCHEDULER_ORDER else len(SCHEDULER_ORDER)
    return (order, bool(sched.get("watched_by_pulse")), sched.get("mechanism") or "", sched["id"])


def _schedulers(doc, v):
    doc.h(2, "Schedulers", "schedulers")
    doc.p("Health → mechanism → project; unwatched failing jobs first.")
    rows = []
    for sched in sorted(v.kind("scheduler"), key=_scheduler_key):
        health = sched.get("health") or {}
        caveat = health.get("caveat") or {}
        rows.append((health.get("state") or "unknown", sched.get("mechanism"), sched.get("label") or sched["id"],
                     v.name(sched["project_id"]) if sched.get("project_id") else "—",
                     sched.get("watched_by_pulse"), tcc_text(sched), schedule_text(sched.get("schedule")),
                     health.get("basis"), caveat_text(caveat) if caveat else "—"))
    doc.table(("health", "mechanism", "label", "project", "watched by pulse", "tcc exposed", "schedule", "basis",
               "caveat"), rows)


def capability_of(project):
    """The business capability facet of a project ({} when it has none)."""
    return (project.get("facets") or {}).get("capability") or {}


def _capability_vocab(v):
    """(bands {band: [values]}, {value: definition}) from vocab/facets.toml, else from the snapshot."""
    facets = v.vocab.get("facets") or {}
    info = v.snapshot.get("capability") or {}
    definitions = ((facets.get("facet") or {}).get("capability") or {}).get("values") or {}
    return capability.bands(facets) or dict(info.get("bands") or {}), definitions


def _holders(v):
    """{value: [(project, its reading)]}: the projects that hold each value by their own row or
    packages. A mirror holds its project's values again and is not counted twice."""
    out = {}
    for project in v.projects:
        field = capability_of(project)
        if field.get("basis") == capability.MIRROR:
            continue
        for value in field.get("values") or []:
            out.setdefault(value, []).append((project, (field.get("by_value") or {}).get(value) or {}))
    return out


def _reading(entry):
    """impl and operating of one holder, the impl only when it is not code."""
    impl = entry.get("impl") or capability.DEFAULTS["impl"]
    operating = entry.get("operating") or capability.DEFAULTS["operating"]
    return operating if impl == capability.DEFAULTS["impl"] else "%s, %s" % (impl, operating)


def _designers(v):
    """{value: [projects that list it as designed only]}."""
    out = {}
    for project in v.projects:
        for value in capability_of(project).get("designed") or []:
            out.setdefault(value, []).append(project)
    return out


def _package_holders(v):
    """{value: [package records holding it]} over the present package records."""
    out = {}
    for record in v.kind("package"):
        for value in (record.get("capability") or {}).get("values") or []:
            out.setdefault(value, []).append(record)
    return out


def _measured(records):
    """The measured cell of a value: how many packages hold it, their non-blank source lines (a lower
    bound when files were unread), test files, the packages importing them and the files unread; and
    how many of them have no measured build state, whose impl code then says nothing about compiling."""
    if not records:
        return "—"
    measures = [r.get("measures") or {} for r in records]
    importers = {name for r in records for name in r.get("imported_by") or []}
    lines, tests = sum(m.get("loc") or 0 for m in measures), sum(m.get("test_files") or 0 for m in measures)
    unmeasured = sum(1 for r in records if (r.get("build") or {}).get("unbuilt") is None)
    return "%d package%s: %s%d line%s, %d test file%s, imported by %d, %d unread%s" % (
        len(records), "" if len(records) == 1 else "s", "≥" if any(m.get("loc_partial") for m in measures) else "",
        lines, "" if lines == 1 else "s", tests, "" if tests == 1 else "s", len(importers),
        sum(m.get("unread_files") or 0 for m in measures),
        "; build state not measured for %d" % unmeasured if unmeasured else "")


def _build_text(record):
    """A package's quarantined tasks with their dated counts, or why its build state is unmeasured."""
    build = record.get("build") or {}
    if build.get("unbuilt") is None:
        return "not measured"
    listed = ["%s %s at %s" % (q["task"], q.get("errors") if q.get("errors") is not None else "?",
                               (q.get("measured_at") or "?")[:12]) for q in build.get("quarantined") or []]
    return "quarantined: " + "; ".join(listed) if listed else "none quarantined"


def _capability_lead(doc, v):
    info = v.snapshot.get("capability")
    if info is None:
        doc.p("Capability map: not provided to the renderer.")
        return False
    fields = [capability_of(p) for p in v.projects]
    scoped = [f for f in fields if f.get("scope")]
    doc.p("The capability map: what the business has code for, or does by hand (a dated manual claim). It is "
          "also a navigation facet (a filter chip and the tree axis 8-capability), by decision dec-2026-10-20-1, an "
          "agent's call under Yu's delegation of 2026-10-20. A "
          "capability that is only documented or designed is listed as designed, never as a value; an idea is never "
          "a value. operating is a claim as of its row, reviewed = false until Yu reviews it.")
    doc.p("In business scope: %d present projects, %d with capabilities, %d curated as having none, %d unassigned. "
          "All %d present projects by basis: %s. Curated rows: %d, %d not yet reviewed, %d past their review date, "
          "%d naming no record of this run." % (
              len(scoped), sum(1 for f in scoped if f.get("status") == capability.SET),
              sum(1 for f in scoped if f.get("status") == capability.NONE),
              sum(1 for f in scoped if f.get("status") == capability.UNASSIGNED), len(fields),
              ", ".join("%s %d" % kv for kv in sorted(Counter(f.get("basis") or "missing" for f in fields).items()))
              or "none", info.get("rows", 0), len(info.get("unreviewed") or []), len(info.get("overdue") or []),
              len(info.get("unmatched") or [])))
    package = info.get("packages") or {}
    if info.get("hosts") or package.get("records"):
        doc.p("Packages, measured from tracked files: %d records, %d holding a capability (by impl: %s). A package's "
              "build state is its membership in the host's quarantine list at the checkout's HEAD; the error counts "
              "are dated evidence from the commit each was measured at." % (
                  package.get("records") or 0, package.get("holding") or 0,
                  ", ".join("%s %d" % kv for kv in (package.get("by_impl") or {}).items()) or "none"))
        doc.ul(capability.host_text(h) for h in info.get("hosts") or [])
    return True


def _capability_bands(doc, v, level, full=False):
    """One table per band: per value the projects holding it with their operating claim, the
    claims counted, who it serves, the projects where it is designed only, and the projects whose
    be.framework_domain names it (relevance). full: one table per value, with each row's evidence."""
    bands, definitions = _capability_vocab(v)
    holders, designers, by_package = _holders(v), _designers(v), _package_holders(v)
    relevant = {}
    for project in v.projects:
        for value in (project.get("display") or {}).get("be.framework_domain") or []:
            relevant.setdefault(value, []).append(project)
    for band, members in bands.items():
        doc.h(level, "Band: %s" % band)
        if not full:
            rows = []
            for value in members:
                held = holders.get(value) or []
                claims = Counter(e.get("operating") or capability.DEFAULTS["operating"] for _p, e in held)
                serves = Counter(e.get("serves") or capability.DEFAULTS["serves"] for _p, e in held)
                rows.append((value, "; ".join("%s [%s]" % (v.name(p["id"]), _reading(e)) for p, e in held) or "none",
                             ", ".join("%s %d" % kv for kv in sorted(claims.items())) or "—",
                             ", ".join("%s %d" % kv for kv in sorted(serves.items())) or "—",
                             ", ".join(v.name(p["id"]) for p in designers.get(value) or []) or "—",
                             ", ".join(v.name(p["id"]) for p in relevant.get(value) or []) or "—",
                             _measured(by_package.get(value))))
            doc.table(("capability", "records [operating]", "operating claims", "serves", "designed only",
                       "relevant by be.framework_domain", "measured (packages)"), rows)
            continue
        for value in members:
            held = holders.get(value) or []
            doc.h(level + 1, "%s (%d)" % (value, len(held)))
            doc.p(definitions.get(value) or "—")
            doc.table(("project", "impl", "operating", "serves", "basis", "reviewed", "as of", "evidence"),
                      [(v.name(p["id"]), e.get("impl"), e.get("operating"), e.get("serves"), capability_of(p).get("basis"),
                        capability_of(p).get("reviewed"), capability_of(p).get("at"),
                        clip(capability_of(p).get("evidence_full") or capability_of(p).get("evidence"), 400))
                       for p, e in held])
            if designers.get(value):
                doc.p("Designed only: %s." % ", ".join(v.name(p["id"]) for p in designers[value]))
            if by_package.get(value):
                doc.table(("package", "impl", "basis", "lines", "test files", "imported by", "unread", "build state",
                           "at commit"),
                          [(r["id"], ((r.get("capability") or {}).get("by_value") or {}).get(value, {}).get("impl"),
                            (r.get("capability") or {}).get("basis"),
                            "%s%s" % ("≥" if (r.get("measures") or {}).get("loc_partial") else "",
                                      (r.get("measures") or {}).get("loc")),
                            (r.get("measures") or {}).get("test_files"), ", ".join(r.get("imported_by") or []) or "—",
                            (r.get("measures") or {}).get("unread_files"), _build_text(r), (r.get("at_commit") or "?")[:12])
                           for r in by_package[value]])


def _capability_gaps(doc, v, level):
    """The sell and grow values that no record holds as in use, said as a statement about code."""
    bands, _definitions = _capability_vocab(v)
    holders, designers = _holders(v), _designers(v)
    doc.h(level, "Gaps: no code in use found")
    doc.p("The sell and grow capabilities that no record holds as in use. The map counts code and dated manual claims, "
          "so each line says what the code shows, not what the business does by other means.")
    lines = []
    for band in ("sell", "grow"):
        for value in bands.get(band) or []:
            held = holders.get(value) or []
            if any((e.get("operating") or "") == "in-use" for _p, e in held):
                continue
            claims = Counter(e.get("operating") or capability.DEFAULTS["operating"] for _p, e in held)
            lines.append("%s (%s): no code in use; %s; designed only on %d" % (
                value, band, ("held by %d record%s (%s)" % (len(held), "" if len(held) == 1 else "s", ", ".join(
                    "%s %d" % kv for kv in sorted(claims.items())))) if held else "no record holds it",
                len(designers.get(value) or [])))
    doc.ul(lines)


def _wire_end(v, ident):
    """A wire end in short: a package's subpath, a record's name, else the id (an end not built yet)."""
    if ident.startswith("pkg:"):
        return ident.split("//", 1)[1] + ("" if ident in v.by_id else " (not in this run)")
    return v.name(ident)


def _wires(doc, v, level, full=False):
    """The wires (wires.py): the measured import and manifest edges between packages, counted; every
    curated wire with its claim, what this build measured and the verdict, by flow; full adds each
    anchor with what was found where."""
    info = v.snapshot.get("wires")
    doc.h(level, "Wires")
    if info is None:
        doc.p("Wires: not provided to the renderer.")
        return
    measured = info.get("measured") or {}
    doc.p("Wires are relations. code_state says what the code shows (wired, wired-unbuilt, declared, contradicted) "
          "and stage how far a wire has been shown to work (designed, demonstrated, accepted, active, unknown); the two "
          "are independent, and neither says the wire runs. Between packages: imports by code_state %s; manifest "
          "declarations no code imports: %d. Curated wires: %d, verdicts %s." % (
              ", ".join("%s %d" % kv for kv in (measured.get("measured-import") or {}).items()) or "none",
              sum((measured.get("measured-manifest") or {}).values()), len(info.get("rows") or []),
              ", ".join("%s %d" % kv for kv in (info.get("verdicts") or {}).items()) or "none"))
    runs = info.get("runs")
    claimed = sum(1 for r in info.get("rows") or [] if r["claimed"]["stage"] == "demonstrated")
    if runs is not None or claimed:
        doc.p("Workflow runs on main, read only by build --forge for the wires that claim demonstrated: %s." % (
            "not read in this build" if runs is None else ", ".join("%s %s" % (key.replace("|", " "), item["status"])
                                                                   for key, item in (runs.get("runs") or {}).items())
            or "none asked"))
    rows = sorted(info.get("rows") or [], key=lambda r: (r.get("flow") or "~", r.get("hop") or 0, r["name"]))
    doc.table(("wire", "from", "to", "channel", "claimed", "measured", "stage", "verdict", "flow"),
              [(r["name"], _wire_end(v, r["from"]), _wire_end(v, r["to"]),
                "%s %s" % (r["channel"]["kind"], r["channel"]["name"]) if r.get("channel") else r["verb"],
                "%s, %s" % (r["claimed"]["code_state"], r["claimed"]["stage"]), r.get("code_state") or "not measured",
                "%s (run %s)" % (r.get("stage"), r["run"]["id"]) if r.get("run") else r.get("stage"), r["verdict"],
                "%s %s" % (r["flow"], r.get("hop") or "") if r.get("flow") else "—")
               for r in rows])
    for flow, item in sorted((info.get("flows") or {}).items()):
        doc.p("Flow %s: %s; its worst hop reads %s, its least stage %s." % (
            flow, " → ".join(item["hops"]), item.get("code_state") or "not measured", item.get("stage")))
    if info.get("problems"):
        doc.p("Wire problems:", "warn")
        doc.ul(info["problems"])
    if full:
        for r in rows:
            doc.h(level + 1, "%s (%s)" % (r["name"], r["verdict"]))
            doc.p("%s %s %s. Measured: %s.%s" % (r["from"], r["verb"], r["to"], r.get("reason") or "not measured",
                                                  " Stage: %s." % r["stage_reason"] if r.get("stage_reason") else ""))
            doc.table(("side", "path", "text", "found", "files"),
                      [(a["side"], a["path"], a["text"], a.get("found") or "not searched", ", ".join(a.get("files") or []) or "—")
                       for a in r.get("anchors") or []])


def _motifs(doc, v, level, full=False):
    """The motifs view (motifs.py): each pattern with its state, the packages importing the libraries that
    embody it and where code does it by hand; full adds each library and anchor with what was found where."""
    info = v.snapshot.get("motifs")
    doc.h(level, "Motifs")
    if info is None:
        doc.p("Motifs: not provided to the renderer.")
        return
    rows = info.get("rows") or []
    doc.p("A motif is a design pattern the code repeats. Its users are measured: the packages whose non-test source "
          "imports a shared library that embodies it (adopted). With no importer, a curated anchor found as code "
          "elsewhere reads reimplemented and none reads unused; a pattern no library embodies reads no-library. A "
          "package whose manifest only declares a library is not a user. Source the reader may not open in a package "
          "that could import a library makes its count a lower bound (≥) and, with no importer found, the motif "
          "not-measured. Curated motifs: %d (%d not yet reviewed), "
          "by state %s%s." % (
              len(rows), sum(1 for m in rows if m.get("reviewed") is not True), motifs.states_text(info.get("states")),
              "; %d stale line%s in QUEUE (motif-stale)" % (info["stale"], "" if info["stale"] == 1 else "s")
              if info.get("stale") else ""))
    doc.table(("motif", "state", "libraries", "importers", "declared only", "by hand in (found as code)", "why"),
              [(m["name"], m["state"], "; ".join(motifs.library_text(lib, lambda i: _wire_end(v, i))
                                                 for lib in m.get("libraries") or []) or "none",
                ", ".join(_wire_end(v, u) for u in m.get("users") or []) or "—",
                ", ".join(_wire_end(v, d) for d in sorted({d for lib in m.get("libraries") or []
                                                            for d in lib.get("declared") or []})) or "—",
                ", ".join(sorted({_wire_end(v, a["in"]) for a in m.get("anchors") or [] if a.get("found") == "code"}))
                or "—", m.get("reason") or "—")
               for m in rows])
    if info.get("problems"):
        doc.p("Motif problems:", "warn")
        doc.ul(info["problems"])
    if full:
        for m in rows:
            doc.h(level + 1, "%s (%s)" % (m["name"], m["state"]))
            doc.p("%s Measured: %s.%s" % (m.get("pattern") or "—", m.get("reason") or "—", " Evidence: %s" % clip(
                m["evidence"], 400) if m.get("evidence") else ""))
            if m.get("libraries"):
                doc.table(("library", "name", "importers", "of them quarantined", "declared only",
                           "unread source in (files)", "not measured"),
                          [(lib["id"], lib.get("name") or "—", ", ".join(lib.get("users") or []) or "—",
                            lib.get("unbuilt_users") or 0, ", ".join(lib.get("declared") or []) or "—",
                            ", ".join("%s (%d)" % (p["id"], p["files"]) for p in lib.get("unread_in") or []) or "—",
                            lib.get("reason") or "—") for lib in m["libraries"]])
            if m.get("anchors"):
                doc.table(("in", "path", "text", "found", "files"),
                          [(a["in"], a["path"], a["text"], a.get("found") or "not searched",
                            ", ".join(a.get("files") or []) or "—") for a in m["anchors"]])
            if m.get("stale"):
                doc.p("Stale (QUEUE motif-stale): %s." % "; ".join(m["stale"]))


def _idea_line(item):
    join = item.get("join") or {}
    return "%s [%s · %s%s · backing %s] %s" % (
        item["id"], item["plan"].get("kind"), item["status"], " (owner)" if item.get("status_basis") == "owner" else "",
        join.get("verdict") or "not joined", clip(item["plan"].get("title"), 160))


def _ideas(doc, v, level, full=False):
    """The ideas plan (ideas.py): business ideas as proposals, never values. Counts by status and kind and
    the ideas marked done that this run does not back; full lists every idea with what its backing
    measured."""
    doc.h(level, "Ideas (proposals, not built)")
    view = v.ideas
    if view.get("status") == "not provided":
        doc.p("Ideas plan: not provided to the renderer.")
        return
    if view.get("status") != "ok":
        doc.p("No ideas plan in the private curation (%s is %s); import one with estate ideas --import ABS_PATH "
              "--write." % (view.get("file"), view.get("reason")) if view.get("status") == "none" else
              "The private ideas plan is not usable (%s): nothing is shown from it. Restore its newest backup beside "
              "it." % view.get("reason"), None if view.get("status") == "none" else "warn")
        return
    items, counts = view.get("items") or [], view.get("counts") or {}
    doc.p("%d ideas in the private ideas plan: proposals, never capability values, wires or motifs. Only Yu sets a "
          "status beyond proposed (estate ideas --set ID --status STATUS --write); each build checks what would back "
          "an idea against its own measurements. By status: %s. By kind: %s. Backing: %s." % (
              len(items), ", ".join("%s %d" % kv for kv in (counts.get("by_status") or {}).items()) or "none",
              ", ".join("%s %d" % kv for kv in (counts.get("by_kind") or {}).items()) or "none",
              ", ".join("%s %d" % kv for kv in (counts.get("by_verdict") or {}).items()) or "none"))
    unbacked = ideas.done_unbacked(items)
    if unbacked:
        doc.p("Marked done, and this run does not back them (QUEUE idea-done-unbacked):", "warn")
        doc.ul(_idea_line(i) for i in unbacked)
    if not full:
        return
    doc.table(("idea", "kind", "status", "title", "backing", "what this run measured"),
              [(i["id"] + (" (missing since %s)" % i["missing_since"] if i.get("missing_since") else ""),
                i["plan"].get("kind"), "%s (%s)" % (i["status"], i.get("status_basis")), clip(i["plan"].get("title"), 200),
                (i.get("join") or {}).get("verdict") or "not joined",
                "; ".join("%s: %s" % ({True: "holds", False: "does not hold", None: "not measured"}[b["holds"]],
                                      b["detail"]) for b in (i.get("join") or {}).get("backing") or []) or "—")
               for i in items])


def _capability_scope(doc, v, level):
    """Every present project in business scope, with its capabilities, why it is in scope, and the
    other business fields, so the one population is visible as a whole."""
    scoped = sorted((p for p in v.projects if capability.business_scope(p)), key=v.name_key)
    doc.h(level, "Records in business scope (%d)" % len(scoped))
    rows = []
    for project in scoped:
        field = capability_of(project)
        zones = sorted({z for s in project.get("surfaces") or [] for z in (v.by_id.get(s) or {}).get("zone_ids") or []})
        rows.append((project.get("name") or project["id"], ", ".join(field.get("values") or []) or field.get("status")
                     or "—", "%s%s" % (field.get("basis") or "—", " via " + field["via"] if field.get("via") else ""),
                     "; ".join(capability.business_scope(project)), facet_text(facet_of(project, "layer")),
                     (project.get("display") or {}).get("purpose_group"),
                     (project.get("display") or {}).get("be.framework_domain") or [],
                     project.get("surfaces") or [], zones))
    doc.table(("project", "capabilities", "basis", "why in scope", "layer", "purpose group", "be.framework_domain",
               "surfaces", "zones"), rows)


def _capability_waiting(doc, v):
    info = v.snapshot.get("capability") or {}
    for key, label in (("unassigned", "Unassigned in business scope (QUEUE capability-unassigned)"),
                       ("unmatched", "Curated rows naming no record of this run (QUEUE capability-orphan-row)")):
        if info.get(key):
            doc.p("%s: %s." % (label, ", ".join(info[key])))
    if info.get("overdue"):
        doc.p("Curated rows past their review date (QUEUE capability-review-overdue): %s." % ", ".join(
            "%s (%s)" % item for item in info["overdue"]))
    if info.get("problems"):
        doc.p("Capability problems:", "warn")
        doc.ul(info["problems"])


def _business(doc, v):
    """The Business view: one business population (capability.business_scope), the legal entity
    state, and the capability map as its body; CAPABILITIES.md holds the map in full."""
    doc.h(2, "Business (secondary)", "business")
    scoped = [p for p in v.projects if capability.business_scope(p)]
    doc.p("Scope, one population for this whole section (capability.business_scope): %s. %d present projects "
          "are in it." % (capability.scope_rule(), len(scoped)))
    legal = (v.curated.get("legal") or {}) if v.curated else {}
    doc.p("Legal entity: %s for every record (curated legal status %s); candidates live only in the private "
          "curation and are never derived here." % ("unassigned", legal.get("status") or "not provided"))
    question = next((q for q in all_questions(v) or [] if q.get("id") == LEGAL_QUESTION), None)
    if question:
        doc.p("Open question %s: %s" % (question["id"], clip(question.get("text"), 600)))
    if not _capability_lead(doc, v):
        return
    doc.link("CAPABILITIES.md: every value with its records, readings and evidence", v.capabilities_href)
    _capability_bands(doc, v, 3)
    _capability_gaps(doc, v, 3)
    _wires(doc, v, 3)
    _motifs(doc, v, 3)
    _ideas(doc, v, 3)
    _capability_scope(doc, v, 3)
    _capability_waiting(doc, v)


def capability_doc(v):
    """CAPABILITIES.md: the whole capability map, value by value with each holder's reading and
    evidence, the gaps, the wires and motifs, the ideas, the business population and what waits on
    curation or review."""
    doc = Doc()
    doc.h(1, "Capabilities — run %s" % v.run_id)
    doc.p("Private view: the evidence column holds the private text of each curated row; never commit or publish "
          "it.", "warn")
    if not _capability_lead(doc, v):
        return doc
    doc.p("Business scope (capability.business_scope): %s." % capability.scope_rule())
    facets = v.vocab.get("facets") or {}
    doc.h(2, "How a value is read")
    for name in ("capability_impl", "capability_operating", "capability_serves"):
        table = (facets.get("vocab") or {}).get(name) or {}
        doc.p("%s: %s" % (name.split("_", 1)[1], table.get("rule") or "—"))
        doc.ul("%s — %s" % kv for kv in (table.get("values") or {}).items())
    _capability_bands(doc, v, 2, full=True)
    _capability_gaps(doc, v, 2)
    _wires(doc, v, 2, full=True)
    _motifs(doc, v, 2, full=True)
    _ideas(doc, v, 2, full=True)
    _capability_scope(doc, v, 2)
    doc.h(2, "Waiting on curation or review")
    info = v.snapshot.get("capability") or {}
    doc.p("Rows not yet reviewed (reviewed = false): %s." % (", ".join(info.get("unreviewed") or []) or "none"))
    _capability_waiting(doc, v)
    return doc


def _freshness(doc, v):
    doc.h(2, "Freshness", "freshness")
    rows = []
    for sid, entry in sorted(v.sources.items()):
        budget = entry.get("budget") or {}
        cov = entry.get("coverage") or {}
        rows.append((sid, entry.get("status"), entry.get("freshness"), age_text(entry.get("age_s")),
                     ("%s / %s" % (age_text(budget.get("fresh_s")), age_text(budget.get("stale_s")))) if budget else "read live",
                     entry.get("required"), entry.get("configured"),
                     ("%s/%s, %s errors" % (text(cov.get("observed")), text(cov.get("expected")), text(cov.get("errors"))))
                     if cov else "—", entry.get("note")))
    doc.table(("source", "status", "freshness", "age", "budget fresh/stale", "required", "configured", "coverage",
               "note"), rows)
    unmeasured = [c for c in v.kind("checkout") if c.get("measure_status") != "ok"]
    doc.h(3, "Checkouts not fully measured (%d)" % len(unmeasured))
    doc.table(("checkout", "status", "errors"),
              [(c.get("rel") or rel_home(c.get("path"), v.home), c.get("measure_status") or "unknown",
                len(c.get("errors") or [])) for c in sorted(unmeasured, key=lambda c: c.get("rel") or c["id"])])


def _proposals_summary(doc, v):
    doc.h(2, "Proposals", "proposals")
    summary = proposal_rules.summary(v.props)
    doc.p("%d open (%d open longer than 30 days); by status: %s" % (
        summary["open"], summary["long_open"],
        ", ".join("%s %d" % kv for kv in sorted(summary["by_status"].items())) or "none"))
    doc.table(("owner", "open"), sorted(summary["by_owner"].items()))
    doc.table(("rule", "name", "open"), [(r, proposal_rules.RULES.get(r, "?"), n) for r, n in sorted(summary["by_rule"].items())])
    doc.h(3, "Top 10")
    doc.table(("id", "title", "owner", "target", "priority", "needs Yu", "bulk", "sphere"),
              [_prop_cells(p) for p in v.props if p.get("status") in OPEN][:10])


def _prop_cells(prop):
    target = prop.get("target") or {}
    return (prop.get("id"), prop.get("title"), target.get("owner"),
            " ".join(x for x in (target.get("repo_id"), target.get("file"), target.get("field")) if x) or "—",
            prop.get("priority"), prop.get("needs_yu"), "%s ×%s" % (prop["bulk_key"], prop.get("bulk_count"))
            if prop.get("bulk_key") else "—", prop.get("sphere") or "—")


def all_questions(v):
    """The questions for Yu: the committed ones with their full private text where the import
    scrubbed them, plus the ones the import kept wholly private (the atlas is private too)."""
    committed = v.curated.get("questions") if v.curated else None
    if committed is None:
        return None
    private = ((v.curated.get("private") or {}).get("estate") or {}).get("question") or []
    full = {q["id"]: q for q in private if isinstance(q, dict) and q.get("id")}
    out = []
    for question in committed:
        kept = full.pop(question.get("id"), None)
        out.append(dict(question, text=kept["text"]) if kept and kept.get("text") else question)
    out += [dict(q, status=q.get("status") or "open") for q in full.values()]
    return out


def _hygiene_refs(v):
    """{question or decision id: [ids of hygiene items not closed that name it]}."""
    out = {}
    for item in (v.hygiene or {}).get("items") or []:
        if item.get("status") in hygiene.CLOSED:
            continue
        for rid in item["plan"].get("related_records") or []:
            if hygiene.is_reference(rid):
                out.setdefault(rid, []).append(item["id"])
    return out


def _asked_line(q, refs):
    if q.get("status") == decisions.PARTLY:
        line = "%s [%s; still open]: %s" % (q.get("id"), _decided_status(q), clip(q.get("open_text"), 600))
    else:
        line = "%s [%s]: %s" % (q.get("id"), q.get("status"), clip(q.get("text"), 600))
    if refs.get(q.get("id")):
        line += " · hygiene items: " + ", ".join(refs[q["id"]])
    return line


def _questions(doc, v):
    """What is still asked: open questions in full, and of a partly decided one only the part an
    owner decision left open; what owner decisions leave open; and one line each pointing at the
    sphere review and the hygiene items that wait on Yu. Decided questions are listed by id only;
    Decided says what settled them."""
    doc.h(2, "Questions for Yu", "questions")
    questions = all_questions(v)
    refs = _hygiene_refs(v)
    if questions is None:
        doc.p("Curated questions: not provided to the renderer.")
    else:
        asked = sorted((q for q in questions if q.get("status") != decisions.DECIDED),
                       key=lambda q: (q.get("status") != "open", q.get("id") or ""))
        doc.ul(_asked_line(q, refs) for q in asked)
        done = [q for q in questions if q.get("status") == decisions.DECIDED]
        if done:
            doc.p("No longer asked, decided (see Decided): %s." % ", ".join(
                "%s (%s)" % (q.get("id"), ", ".join(q.get("decided_by") or [])) for q in sorted(done, key=lambda q: q["id"])))
    left = [(d, item) for d in (v.curated.get("owner_decisions") or [] if v.curated else [])
            for item in d.get("stays_open") or []]
    if left:
        doc.p("Left open by the owner decisions themselves:")
        doc.ul("%s%s: %s" % (d["id"], " (%s)" % d["label"] if d.get("label") else "", text(item)) for d, item in left)
    undecided = [r for r in v.projects + v.kind("zone") + v.kind("surface") if sphere_of(r).get("value") == sphere.UNDECIDED]
    if undecided or (v.snapshot.get("sphere") or {}).get("decision"):
        third = sum(1 for r in undecided if r.get("kind") == "project" and sphere_of(r).get("third_party"))
        kinds = Counter(r["kind"] for r in undecided)
        unreviewed = sum(1 for r in v.projects + v.kind("zone") + v.kind("surface") if sphere_of(r).get("reviewed") is False)
        doc.p("Sphere review (KINGDOM OS, owner decision D4): %d projects (%d of them third-party: does third-party "
              "code take a sphere at all?), %d zones and %d surfaces are undecided; %d sphere values rest on rows Yu "
              "has not reviewed." % (kinds["project"], third, kinds["zone"], kinds["surface"], unreviewed))
        doc.link("KINGDOM OS: the undecided list, with why", "#kingdom-os")
    info = v.snapshot.get("capability")
    if info is not None:
        unknown = sorted(v.name(p["id"]) for p in v.projects if capability_of(p).get("basis") != capability.MIRROR
                         and ((capability_of(p).get("by_value") or {}).get("goods-sales") or {}).get("operating")
                         == "unknown")
        doc.p("Capability map (Business): %d projects in business scope are unassigned and %d curated rows are not yet "
              "reviewed (reviewed = false).%s" % (
                  len(info.get("unassigned") or []), len(info.get("unreviewed") or []),
                  " goods-sales reads operating unknown for %s: which channel sells today?" % ", ".join(unknown)
                  if unknown else ""))
        doc.link("Business: the capability map", "#business")
    if v.ideas.get("status") == "ok":
        waiting = [i for i in v.ideas.get("items") or [] if i.get("status") == ideas.PROPOSED and not i.get("missing_since")]
        doc.p("Ideas plan (private): %d proposed, waiting on Yu's status (estate ideas --status proposed); %d marked "
              "done and not backed in this run (QUEUE idea-done-unbacked)." % (
                  len(waiting), len(ideas.done_unbacked(v.ideas.get("items") or []))))
    items = (v.hygiene or {}).get("items") or []
    if items:
        waiting = [i for i in items if i["plan"].get("needs_yu") is True and i.get("status") not in hygiene.CLOSED]
        waves = _hygiene_waves(v.hygiene)
        first = [i for i in waiting if waves and i["plan"].get("wave") == waves[0]]
        doc.p("Hygiene (owner decision D8): %d items not closed need Yu: %d in wave %s, %d in progress elsewhere "
              "(see Hygiene and HYGIENE.md, or estate hygiene --needs-yu)." % (
                  len(waiting), len(first), waves[0] if waves else "—",
                  sum(1 for i in waiting if i.get("status") == hygiene.ELSEWHERE)))
    needs = [p for p in v.props if p.get("needs_yu") and p.get("status") in OPEN]
    doc.p("%d open proposals need Yu's decision (see PROPOSALS.md)." % len(needs))


def _decided(doc, v):
    """Each owner decision: what it settled, what it did to this map, and what stays open."""
    doc.h(2, "Decided", "decided")
    owner = v.curated.get("owner_decisions") if v.curated else None
    if owner is None:
        doc.p("Owner decisions: not provided to the renderer.")
        return
    if not owner:
        doc.p("No owner decision is recorded in curated/decisions.toml.")
        return
    doc.p("Decisions from curated/decisions.toml, applied on every build; the curation itself is never "
          "rewritten. Each says who decided: the owner, or an agent under the owner's delegation of 2026-10-20. "
          "Questions and disputes they settle leave Questions for Yu.")
    items = {q.get("id"): q for q in (all_questions(v) or []) + list(v.curated.get("disputes") or [])}
    effects = v.snapshot.get("decision_effects") or {}
    words = _owner_words(v)
    opens, notes = decisions.private_texts(v.curated)
    shown = {}
    for d in owner:
        doc.h(3, "%s%s — %s" % (d["id"], " (%s)" % d["label"] if d.get("label") else "", d.get("subject")))
        doc.p("%s · by %s: %s" % (d.get("date"), d.get("by"), d.get("decision")))
        lines = []
        for rid in d.get("resolves") or []:
            item = items.get(rid) or {}
            outcome = (d.get("outcome") or {}).get(rid)
            remainder = (d.get("open") or {}).get(rid)
            remainder = opens.get((d["id"], rid)) or remainder if remainder else remainder
            lines.append("settles %s [now %s]%s%s" % (rid, item.get("status") or "not in the curation",
                                                       ": " + outcome if outcome else "",
                                                       "; still open: " + remainder if remainder else ""))
        lines += _effect_lines(v, d, effects.get(d["id"]) or {})
        _applied, pending = decisions.effect_keys(d)
        if pending:
            lines.append("not applied by this tool version: " + ", ".join(pending))
        lines += ["not yet applied: " + text(item) for item in d.get("pending") or []]
        lines += ["stays open: " + text(item) for item in d.get("stays_open") or []]
        lines += ["private note: " + text(item) for item in notes.get(d["id"]) or []]
        doc.ul(lines)
        for said in words.get(d["id"]) or []:
            first = shown.setdefault(id(said), d["id"])
            if first == d["id"]:
                doc.p("Owner's words (private, %s): %s" % (said.get("date") or "undated", clip(said.get("text"), 1200)))
            else:
                doc.p("Owner's words: as under %s." % first)


def _owner_words(v):
    """{decision id: [rows]} of the private curation's verbatim owner words."""
    out = {}
    for row in ((v.curated.get("private") or {}).get("decisions") or {}).get("words") or []:
        for ident in row.get("decisions") or []:
            out.setdefault(ident, []).append(row)
    return out


# The providers whose resources the estate lists from a source of its own; any other provider's
# surfaces appear only when REGISTRY, a manifest or the curation names them.
PROVIDER_LISTINGS = {"cloudflare": "the portfolio map, the Cloudflare observer and inventory"}


def _unseen_text(provider, unseen):
    """Why a surface an owner decision names has no record: absent from a listing the estate reads,
    or the estate reads no listing of that provider at all (which says nothing about the app)."""
    if not unseen:
        return "every one has a record in this run"
    if provider in PROVIDER_LISTINGS:
        return "not in this run's sources (%s): %s" % (PROVIDER_LISTINGS[provider], ", ".join(unseen))
    return ("no record in this run, because the estate reads no %s account listing (it sees such surfaces only "
            "through REGISTRY, a manifest or the curation), so this says nothing about whether it runs: %s"
            % (provider or "provider", ", ".join(unseen)))


def _effect_lines(v, d, eff):
    """What one owner decision did to this map, from the model's count of it."""
    lines, effects = [], d.get("effects") if isinstance(d.get("effects"), dict) else {}
    if "primary_ref" in eff:
        lines.append("KINGDOM facets resolve on %s; %d facets differ on the other ref and follow %s (DRIFT section 2)"
                     % (eff["primary_ref"], eff.get("ref_divergent_facets") or 0, eff["primary_ref"]))
        if eff.get("conflict"):
            lines.append("private config.toml still pins ref %s (reported as degraded)" % eff.get("config_ref"))
    if "layer_settled" in eff:
        lines.append("%d records are no longer contested by %s: their card says %s or names no layer (%s); that "
                     "claim stays listed" % (eff["layer_settled"], effects.get("layer_overrule"),
                                             effects.get("layer_default"), ", ".join(
                                                 "%s %d" % kv for kv in sorted((eff.get("layer_values") or {}).items()))
                                             or "none"))
    by_account = {}
    for item in eff.get("ownership") or []:
        by_account.setdefault((item.get("account") or "no single %s account row" % item.get("provider"),
                               item.get("basis"), item.get("provider")), []).append(item)
    for (account, basis, provider), owned in sorted(by_account.items(), key=lambda kv: tuple(map(str, kv[0]))):
        seen = [i["id"] for i in owned if i.get("observed")]
        unseen = [i["id"] for i in owned if not i.get("observed")]
        lines.append("%d named → %s (%s): recorded here: %s; %s" % (
            len(owned), account, basis, ", ".join(seen) or "none", _unseen_text(provider, unseen)))
    if "status" in eff:
        lines.append("%s: %s on %s; %d attention rows carry it%s" % (
            eff.get("provider"), eff["status"], ", ".join(eff.get("accounts") or []) or "no account row",
            eff.get("attention_rows") or 0, "; the estate makes no %s calls" % eff.get("provider")
            if effects.get("no_calls") else ""))
    if "sphere_projects" in eff:
        lines.append("sphere facet (see KINGDOM OS): projects %s; zones %s; surfaces %s" % tuple(
            ", ".join("%s %d" % kv for kv in sorted((eff.get(key) or {}).items())) or "none"
            for key in ("sphere_projects", "sphere_zones", "sphere_surfaces")))
    if "hygiene" in eff:
        lines.append(_hygiene_effect(eff["hygiene"]))
    if effects.get("confirms"):
        lines.append("confirms %s" % effects["confirms"])
    if effects.get("status_note"):
        lines.append(effects["status_note"])
    opened = sorted(p["id"] for p in v.props if p.get("decision_ref") == d["id"] and p.get("status") in OPEN)
    superseded = sorted(p["id"] for p in v.props if p.get("decision_ref") == d["id"] and p.get("status") == "superseded")
    if opened:
        lines.append("follow-up proposals: " + ", ".join(opened))
    if superseded:
        lines.append("proposals it superseded: " + ", ".join(superseded))
    return lines


# ── hygiene (owner decision D8) ─────────────────────────────────────────────────────────────

HYGIENE_FIX = "estate hygiene --set ID --status STATUS [--note TEXT] --write"


def _hygiene_absent(h):
    if h.get("status") == "none":
        return ("No hygiene plan in the private curation (%s is %s); import one with estate hygiene --import "
                "ABS_PATH --write." % (h.get("file") or "the plan file", h.get("reason") or "missing"))
    return ("The private hygiene plan is not usable (%s): nothing is shown from it. Restore its newest backup "
            "beside it or re-import the plan." % (h.get("reason") or h.get("status")))


def _ordered(values, first):
    """values in the order of first, then any others alphabetically."""
    first = [x for x in first if x in values]
    return first + sorted(x for x in values if x not in first)


def _hygiene_statuses(items):
    return _ordered({i["status"] for i in items}, hygiene.PLAN_STATUSES)


def _hygiene_waves(h):
    return [w.get("name") for w in (h.get("plan") or {}).get("waves") or [] if isinstance(w, dict)]


def _hygiene_by(items, key, order, statuses):
    rows = []
    for value in _ordered({key(i) for i in items}, order):
        mine = [i for i in items if key(i) == value]
        rows.append([value, len(mine)] + [sum(1 for i in mine if i["status"] == s) or "—" for s in statuses])
    return rows


def _status_text(item):
    return "%s%s" % (item["status"], " (owner)" if item.get("status_basis") == "owner" else "")


def _hygiene_line(item):
    verdict = (item.get("join") or {}).get("verdict") or "not joined"
    missing = "; missing from the newest plan since %s" % item["missing_since"] if item.get("missing_since") else ""
    return "%s [%s · %s · signals %s%s]: %s" % (item["id"], item["plan"].get("severity"), _status_text(item), verdict,
                                                missing, item["plan"].get("title"))


def _hygiene(doc, v):
    """D8's plan in brief: counts by wave, severity and status, the most urgent items in one line
    each, and the link to HYGIENE.md, which holds every item and its join with this run."""
    doc.h(2, "Hygiene", "hygiene")
    h = v.hygiene
    if h.get("status") != "ok":
        doc.p(_hygiene_absent(h))
        return
    items, counts, plan = h["items"], h["counts"], h.get("plan") or {}
    last = (h.get("imports") or [{}])[-1]
    doc.p("%d items in the private hygiene plan of owner decision %s: a plan, not execution. Plan observed %s; "
          "imported %s. Statuses are the owner's where set, else the plan's." % (
              len(items), h.get("decision") or "D8", plan.get("observed_at"), last.get("at") or "unknown"))
    doc.link("HYGIENE.html (HYGIENE.md beside it): every item, what it needs, and this run's measurements of its "
             "related records", v.hygiene_href)
    statuses = _hygiene_statuses(items)
    doc.table(("wave", "items") + tuple(statuses),
              _hygiene_by(items, lambda i: i["plan"].get("wave"), _hygiene_waves(h), statuses))
    scale = list(plan.get("severity_scale") or {})
    doc.table(("severity", "items") + tuple(statuses), _hygiene_by(items, lambda i: i["plan"].get("severity"), scale, statuses))
    doc.p("Signals on the related records in this run: %s. Open items whose signals all cleared: %d; closed items "
          "still observed: %d; missing from the newest plan: %d (see HYGIENE.md)." % (
              ", ".join("%s %d" % (k, n) for k, n in counts["by_verdict"].items()) or "none",
              counts["open_cleared"], counts["closed_observed"], counts["missing"]))
    top = scale[0] if scale else None
    severe = [i for i in items if top and i["plan"].get("severity") == top]
    # A closed item no longer belongs under "act now"; it is counted, and HYGIENE.md keeps it.
    urgent = [i for i in severe if i["status"] not in hygiene.CLOSED]
    doc.h(3, "%s — %s (%d)" % (top, (plan.get("severity_scale") or {}).get(top), len(urgent)) if top else "Most urgent")
    doc.ul(_hygiene_line(i) for i in urgent)
    if len(severe) > len(urgent):
        doc.p("%s items closed (done, declined or mitigated): %d; see HYGIENE.md." % (top, len(severe) - len(urgent)))


def _hygiene_effect(counts):
    if counts.get("status") != "ok":
        return "hygiene plan: %s in the private curation (see Hygiene)" % (
            "none" if counts.get("status") == "none" else "unusable")
    return ("hygiene plan (see Hygiene and HYGIENE.md): %d items%s; by status %s; signals %s" % (
        counts["items"], ", %d missing from the newest plan" % counts["missing"] if counts.get("missing") else "",
        ", ".join("%s %d" % kv for kv in counts["by_status"].items()) or "none",
        ", ".join("%s %d" % kv for kv in counts["by_verdict"].items()) or "none"))


def _signal_text(entry):
    text_ = "%s %s: %s" % (entry.get("record"), entry.get("check"), entry.get("detail"))
    if "now" in entry:
        text_ += " → now %s (seen %s, run %s)" % (entry["now"], entry.get("at") or "—", entry.get("run") or "—")
    return text_


def _hygiene_item(doc, item):
    plan = item["plan"]
    joined = item.get("join") or {}
    doc.h(4, "%s — %s" % (item["id"], plan.get("title")))
    lines = ["severity %s · status %s · area %s · wave %s · effort %s · who: %s" % (
                 plan.get("severity"), _status_text(item), plan.get("area"), plan.get("wave"), plan.get("effort"),
                 plan.get("who")),
             "agent-safe %s · needs Yu %s · reversible %s" % (text(plan.get("agent_safe")), text(plan.get("needs_yu")),
                                                             text(plan.get("reversible")))]
    if item.get("status_basis") == "owner" and plan.get("status") != item["status"]:
        lines.append("the plan says %s; the owner's status wins" % plan.get("status"))
    if item.get("missing_since"):
        lines.append("missing from the newest plan since %s (kept, never dropped)" % item["missing_since"])
    lines += ["where: " + text(w) for w in plan.get("where") or []]
    lines += ["evidence: " + text(plan.get("evidence")), "risk: " + text(plan.get("risk"))]
    lines += ["action: " + text(a) for a in plan.get("actions") or []]
    for key, label in (("depends_on", "depends on"), ("related_items", "read with"), ("related_records", "related records"),
                       ("lens_ids", "survey findings")):
        if plan.get(key):
            lines.append("%s: %s" % (label, text(plan[key])))
    verdict = joined.get("verdict")
    if verdict is None:
        lines.append("signals: not joined (no run at hand)")
    elif joined.get("checks") is None:
        lines.append("signals: not measured (the estate has no check for area %s)" % plan.get("area"))
    else:
        lines.append("signals: %s (checks for %s: %s)" % (verdict, plan.get("area"), ", ".join(joined["checks"])))
        lines += ["observed now: " + _signal_text(e) for e in joined.get("observed") or []]
        lines += ["no longer observed: " + _signal_text(e) for e in joined.get("cleared") or []]
        lines += ["seen before, unknown now: " + _signal_text(e) for e in joined.get("unknown") or []]
    if joined.get("references"):
        lines.append("refers to: " + ", ".join("%s [%s]" % (r["id"], r["status"]) for r in joined["references"]))
    if joined.get("not_in_run"):
        lines.append("related records the estate does not hold in this run: " + ", ".join(joined["not_in_run"]))
    lines += ["in progress elsewhere: %s is %s by owner decision %s (account %s); the estate takes no action there" % (
        e["record"], e["status"], e["decision"], e["account"]) for e in joined.get("elsewhere") or []]
    lines += ["owner set %s → %s at %s%s" % (e.get("from"), e.get("to"), e.get("at"),
                                             ": " + text(e["note"]) if e.get("note") else "") for e in item.get("log") or []]
    doc.ul(lines)


def hygiene_doc(v):
    """HYGIENE.md: the whole D8 plan, wave by wave, each item joined with this run's own
    measurements of its related records, plus the lists that need a look first."""
    doc = Doc()
    doc.h(1, "Hygiene — run %s" % v.run_id)
    h = v.hygiene
    if h.get("status") != "ok":
        doc.p(_hygiene_absent(h))
        return doc
    items, counts, plan = h["items"], h["counts"], h.get("plan") or {}
    doc.p("The hygiene plan of owner decision %s: every hygiene issue and what needs to be done. It is a plan, "
          "not execution: nothing here is carried out by the estate. Private: it names where secrets live, "
          "never their values; never commit or publish it." % (h.get("decision") or "D8"), "warn")
    doc.p("Plan %s, observed %s, generated %s; measured %s." % (plan.get("schema"), plan.get("observed_at"),
                                                              plan.get("generated_at"), plan.get("measured_window")))
    doc.ul("import %s: plan observed %s (sha256 %s), added %s, updated %s, unchanged %s, missing %s, returned %s; "
           "baseline from run %s" % (i.get("at"), i.get("observed_at"), short(i.get("source_sha256")), i.get("added"),
                                    i.get("updated"), i.get("unchanged"), i.get("missing"), i.get("returned"),
                                    i.get("baseline_run") or "none (no run was current)") for i in h.get("imports") or [])
    doc.p("Status is the owner's where one is set (%s), else the plan's. Signals: on each item's related records, "
          "this run measures what the estate already measures for the item's area, against the signals seen when "
          "the plan was imported (the baseline). 'no longer observed' means every baseline signal has cleared: it "
          "is a reason to check the item, not proof that it is fixed. 'not observed' means the checks ran and saw "
          "nothing; 'not measured' means the estate measures nothing of the kind there." % HYGIENE_FIX)
    doc.ul("%s: %s" % (area, ", ".join(checks)) for area, checks in sorted(hygiene.AREA_CHECKS.items()))
    statuses = _hygiene_statuses(items)
    doc.h(2, "Summary")
    if plan.get("wave_rule"):
        doc.p("How the plan places items in waves: " + text(plan["wave_rule"]))
    doc.table(("wave", "items") + tuple(statuses),
              _hygiene_by(items, lambda i: i["plan"].get("wave"), _hygiene_waves(h), statuses))
    doc.table(("who acts (the plan's needs Yu and agent-safe)", "items") + tuple(statuses),
              [[label, len(group)] + [sum(1 for i in group if i["status"] == s) or "—" for s in statuses]
               for label, group in hygiene.owner_split(items)])
    doc.table(("severity", "items") + tuple(statuses),
              _hygiene_by(items, lambda i: i["plan"].get("severity"), list(plan.get("severity_scale") or {}), statuses))
    doc.table(("area", "items") + tuple(statuses), _hygiene_by(items, lambda i: i["plan"].get("area"), (), statuses))
    doc.table(("signals", "items"), sorted(counts["by_verdict"].items()))
    doc.h(2, "Check these first")
    doc.p("Open items whose signals all cleared since the import (check, then %s):" % HYGIENE_FIX)
    doc.ul(_hygiene_line(i) for i in items if i["status"] not in hygiene.CLOSED
           and (i.get("join") or {}).get("verdict") == hygiene.CLEARED)
    doc.p("Items marked done, declined or mitigated whose signals are still observed:")
    doc.ul(_hygiene_line(i) for i in items if i["status"] in hygiene.CLOSED
           and (i.get("join") or {}).get("verdict") == hygiene.OBSERVED)
    doc.h(2, "In progress elsewhere")
    doc.p("Items with status %s are being handled outside this estate; the estate takes no action on them."
          % hygiene.ELSEWHERE)
    for account in v.kind("account"):
        status = account.get("decided_status")
        if status:
            doc.p("%s (%s): %s by owner decision %s%s; the estate makes no calls to it." % (
                account["id"], status.get("provider"), status.get("status"), status.get("decision"),
                " (%s)" % status["note"] if status.get("note") else ""))
    doc.ul(_hygiene_line(i) for i in items if i["status"] == hygiene.ELSEWHERE)
    tied = [i for i in items if i["status"] != hygiene.ELSEWHERE and (i.get("join") or {}).get("elsewhere")]
    if tied:
        doc.p("Other items with a related record under that status:")
        doc.ul("%s: %s" % (_hygiene_line(i), ", ".join(e["record"] for e in i["join"]["elsewhere"])) for i in tied)
    missing = [i for i in items if i.get("missing_since")]
    if missing:
        doc.h(2, "Missing from the newest plan (%d)" % len(missing))
        doc.ul(_hygiene_line(i) for i in missing)
    if plan.get("top10"):
        doc.h(2, "Top 10, as the plan ranks them")
        doc.ul(plan["top10"])
    by_id = {i["id"]: i for i in items}
    placed = set()
    for wave in plan.get("waves") or []:
        doc.h(2, "%s (%d items)" % (wave.get("name"), sum(len(g.get("items") or []) for g in wave.get("groups") or [])))
        for group in wave.get("groups") or []:
            doc.h(3, text(group.get("name")))
            if group.get("note"):
                doc.p(group["note"])
            for ident in group.get("items") or []:
                if ident in by_id and ident not in placed:
                    placed.add(ident)
                    _hygiene_item(doc, by_id[ident])
                elif ident not in by_id:
                    doc.p("%s: named by this group, but not an item of the plan" % ident)
    rest = [i for i in items if i["id"] not in placed]
    if rest:
        doc.h(2, "Not in any wave of the newest plan (%d)" % len(rest))
        for item in rest:
            _hygiene_item(doc, item)
    for key, title in (("critic_resolution", "Critic resolutions"), ("refuted", "Refuted, not included"),
                       ("not_checked", "Not checked by the plan")):
        if plan.get(key):
            doc.h(2, title)
            doc.ul(" · ".join("%s: %s" % (k, text(val)) for k, val in entry.items()) if isinstance(entry, dict)
                   else text(entry) for entry in plan[key])
    return doc


# ── HTML shell ──────────────────────────────────────────────────────────────────────────────

FILTERS_HTML = """<section id="filters" aria-label="filters">
<p id="stale" class="banner" hidden></p>
<div class="bar"><input id="q" type="search" placeholder="search name, id, what" aria-label="search">
<label><input type="checkbox" id="t-citizens" checked> citizens</label>
<label><input type="checkbox" id="t-incidental" checked> incidental, vendored, generated</label>
<button type="button" id="clear">clear filters</button> <span id="shown"></span></div>
<div id="chips"></div>
</section>"""

CSS = """:root{--bg:#ffffff;--fg:#1c1f24;--muted:#5b6370;--line:#d8dce2;--accent:#2353b8;--chip:#eef1f5;
--chip-on:#2353b8;--chip-on-fg:#ffffff;--warn-bg:#fff3d1;--warn-fg:#5e4300;color-scheme:light dark}
@media (prefers-color-scheme: dark){:root{--bg:#14161a;--fg:#e4e7eb;--muted:#9aa3ae;--line:#2b3037;
--accent:#86a8ff;--chip:#22272e;--chip-on:#86a8ff;--chip-on-fg:#0b0d10;--warn-bg:#3a2f12;--warn-fg:#f1d48a}}
*{box-sizing:border-box}
body{margin:0 auto;max-width:1240px;padding:16px;background:var(--bg);color:var(--fg);
font:14px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;overflow-wrap:anywhere}
h1{font-size:1.5rem;margin:.2rem 0 .6rem}h2{font-size:1.2rem;margin:2rem 0 .5rem;border-bottom:1px solid var(--line)}
h3{font-size:1rem;margin:1.2rem 0 .4rem}
.banner,.warn{background:var(--warn-bg);color:var(--warn-fg);padding:.5rem .75rem;border-radius:6px;font-weight:600}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;margin:.3rem 0 .8rem;font-size:13px}
th,td{border:1px solid var(--line);padding:3px 6px;text-align:left;vertical-align:top}
th{background:var(--chip)}
details{border:1px solid var(--line);border-radius:6px;margin:3px 0;padding:2px 8px}
details>summary{cursor:pointer}.meta{color:var(--muted);font-size:12px}.nm{font-weight:600}
.grp{border-style:dashed}.cnt{color:var(--muted);font-size:12px}
.stub{color:var(--muted);margin:3px 0}
a{color:var(--accent)}
#filters{position:sticky;top:0;background:var(--bg);padding:6px 0;border-bottom:1px solid var(--line);z-index:1}
.bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#q{flex:1 1 220px;min-width:0;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg)}
#chips{max-height:32vh;overflow:auto;margin-top:6px}
.facet{margin:2px 0}.flabel{display:inline-block;min-width:6.5rem;color:var(--muted);font-size:12px}
.chip{border:1px solid var(--line);background:var(--chip);color:var(--fg);border-radius:999px;padding:0 8px;
margin:1px 2px;font-size:12px;cursor:pointer}
.chip[aria-pressed="true"]{background:var(--chip-on);color:var(--chip-on-fg);border-color:var(--chip-on)}
.chip:disabled{opacity:.45;cursor:default}
button{font:inherit}
pre{white-space:pre-wrap;background:var(--chip);padding:6px;border-radius:6px}
.toc{margin:.4rem 0;font-size:13px;line-height:1.8}"""

# Plain DOM only (textContent, attributes, hidden); nothing is ever parsed as HTML.
SCRIPT = """(function () {
  "use strict";
  var data = JSON.parse(document.getElementById("estate-data").textContent);
  var facets = data.facets, records = data.records, picked = {}, buttons = [];
  facets.forEach(function (f) { picked[f] = {}; });
  var q = document.getElementById("q"), cit = document.getElementById("t-citizens");
  var inc = document.getElementById("t-incidental"), shown = document.getElementById("shown");
  var stale = document.getElementById("stale"), at = Date.parse(data.observed_at);
  if (stale && !isNaN(at) && Date.now() - at > data.stale_after_s * 1000) {
    stale.hidden = false;
    stale.textContent = "STALE: observed " + data.observed_at + ", more than 7 days ago. Run estate build.";
  }
  function anyPicked(f) { for (var k in picked[f]) { if (picked[f][k]) return true; } return false; }
  function passes(r, skip) {
    if (!cit.checked && r.citizen) return false;
    if (!inc.checked && r.incidental) return false;
    var term = q.value.trim().toLowerCase();
    if (term && r.s.indexOf(term) < 0) return false;
    for (var i = 0; i < facets.length; i++) {
      var f = facets[i];
      if (f === skip || !anyPicked(f)) continue;
      var vals = r.f[f] || [], hit = false;
      for (var j = 0; j < vals.length; j++) { if (picked[f][vals[j]]) { hit = true; break; } }
      if (!hit) return false;
    }
    return true;
  }
  function build() {
    var box = document.getElementById("chips");
    facets.forEach(function (f) {
      var seen = {};
      records.forEach(function (r) { (r.f[f] || []).forEach(function (v) { seen[v] = true; }); });
      var row = document.createElement("div"), label = document.createElement("span");
      row.className = "facet"; label.className = "flabel"; label.textContent = f; row.appendChild(label);
      Object.keys(seen).sort().forEach(function (v) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "chip"; b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () {
          picked[f][v] = !picked[f][v];
          b.setAttribute("aria-pressed", picked[f][v] ? "true" : "false");
          apply();
        });
        buttons.push({el: b, f: f, v: v}); row.appendChild(b);
      });
      box.appendChild(row);
    });
  }
  function apply() {
    var visible = {}, n = 0, counts = {};
    records.forEach(function (r) { if (passes(r, null)) { visible[r.id] = true; n++; } });
    facets.forEach(function (f) {
      counts[f] = {};
      records.forEach(function (r) {
        if (!passes(r, f)) return;
        (r.f[f] || []).forEach(function (v) { counts[f][v] = (counts[f][v] || 0) + 1; });
      });
    });
    buttons.forEach(function (b) {
      var c = counts[b.f][b.v] || 0;
      b.el.textContent = b.v + " " + c;
      b.el.disabled = c === 0 && !picked[b.f][b.v];
    });
    document.querySelectorAll(".rec").forEach(function (el) { el.hidden = !visible[el.getAttribute("data-id")]; });
    document.querySelectorAll(".stub").forEach(function (el) {
      var ids = JSON.parse(el.getAttribute("data-ids"));
      el.hidden = !ids.some(function (i) { return visible[i]; });
    });
    document.querySelectorAll(".grp").forEach(function (el) {
      var all = el.querySelectorAll(".rec").length, open = el.querySelectorAll(".rec:not([hidden])").length;
      el.hidden = open === 0;
      var c = el.querySelector(".cnt");
      if (c) c.textContent = "(" + open + " of " + all + " shown)";
    });
    shown.textContent = n + " of " + records.length + " projects match";
  }
  document.getElementById("clear").addEventListener("click", function () {
    facets.forEach(function (f) { picked[f] = {}; });
    buttons.forEach(function (b) { b.el.setAttribute("aria-pressed", "false"); });
    q.value = ""; cit.checked = true; inc.checked = true; apply();
  });
  [q, cit, inc].forEach(function (el) { el.addEventListener("input", apply); el.addEventListener("change", apply); });
  build();
  apply();
})();"""


def html_data(v):
    """What the filter needs per project: facet values (as facet_index files them), the toggles
    and one lower-case search string."""
    out = []
    for project in v.projects:
        f = {name: facet_values(facet_of(project, name)) for name in v.navigation}
        search = " ".join(str(x) for x in (project.get("name"), project["id"], v.what(project),
                                            " ".join(project.get("aliases") or [])) if x).lower()
        out.append({"id": project["id"], "f": f, "citizen": is_citizen(project),
                    "incidental": is_incidental(project), "s": search})
    return {"observed_at": v.snapshot.get("observed_at"), "stale_after_s": STALE_AFTER_S,
            "facets": v.navigation, "records": out}


def hygiene_html(doc):
    """HYGIENE.md as a page the browser renders: the atlas's style, no script and no data."""
    return ("<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">\n"
            "<meta http-equiv=\"Content-Security-Policy\" content=\"%s\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            "<meta name=\"referrer\" content=\"no-referrer\">\n"
            "<title>Estate hygiene</title>\n<style>%s</style>\n</head>\n<body>\n%s\n</body></html>\n") % (
                html.escape(CSP, quote=True), CSS, to_html_body(doc))


def atlas_html(v, doc):
    return ("<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\">\n"
            "<meta http-equiv=\"Content-Security-Policy\" content=\"%s\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            "<meta name=\"referrer\" content=\"no-referrer\">\n"
            "<title>Estate atlas</title>\n<style>%s</style>\n</head>\n<body>\n%s\n"
            "<script type=\"application/json\" id=\"estate-data\">%s</script>\n<script>%s</script>\n"
            "</body></html>\n") % (html.escape(CSP, quote=True), CSS, to_html_body(doc), script_json(html_data(v)),
                                   SCRIPT)


# ── PROPOSALS, DRIFT, QUEUE, ATTENTION ──────────────────────────────────────────────────────

def proposals_doc(v):
    doc = Doc()
    doc.h(1, "Proposals — run %s" % v.run_id)
    summary = proposal_rules.summary(v.props)
    doc.p("%d proposals; %d open (%d open longer than 30 days). Nothing here is ever applied: owners claim "
          "the path scopes through agenttool-collab and apply changes themselves. Decisions are recorded "
          "with estate proposals --decide ... --write." % (len(v.props), summary["open"], summary["long_open"]))
    tree = {}
    for prop in v.props:
        owner = (prop.get("target") or {}).get("owner") or "unknown"
        tree.setdefault(owner, {}).setdefault(prop.get("rule") or "?", {}).setdefault(prop.get("bulk_key"), []).append(prop)
    for owner in sorted(tree):
        doc.h(2, "Owner: %s" % owner)
        for rule in sorted(tree[owner]):
            doc.h(3, "%s %s" % (rule, proposal_rules.RULES.get(rule, "")))
            for bulk in sorted(tree[owner][rule], key=lambda k: (k is None, k or "")):
                items = tree[owner][rule][bulk]
                if bulk is not None:
                    doc.p("Bulk group %s: %d proposals (bulk count %s)" % (bulk, len(items), items[0].get("bulk_count")))
                for prop in items:
                    _proposal_block(doc, prop)
    return doc


def _proposal_block(doc, prop):
    target = prop.get("target") or {}
    upstream = prop.get("upstream") or {}
    collab = prop.get("collab") or {}
    doc.h(4, "%s — %s" % (prop.get("id"), prop.get("title")))
    doc.ul([
        "status %s%s%s" % (prop.get("status"), " (decision %s)" % prop["decision_ref"] if prop.get("decision_ref") else "",
                           " · OPEN LONGER THAN 30 DAYS" if prop.get("long_open") else ""),
        "target %s %s %s %s @%s" % (target.get("repo_id") or "—", target.get("file") or "—",
                                   target.get("record_id") or "—", target.get("field") or "—", prop.get("target_ref")),
        "priority %s · needs Yu %s · subject's sphere %s · first seen %s · last seen %s" % (
            prop.get("priority"), text(prop.get("needs_yu")), prop.get("sphere") or "—", prop.get("first_seen"),
            prop.get("last_seen")),
        "current %s" % text({k: val for k, val in (prop.get("current") or {}).items()}),
        "proposed %s" % text({k: val for k, val in (prop.get("proposed") or {}).items()
                              if k not in ("card_text", "patch")}),
        "options %s" % text(prop.get("options")),
        "basis %s" % text(prop.get("basis")),
        "upstream %s (worktree blob %s, origin/main blob %s at %s)" % (
            upstream.get("status"), short(upstream.get("worktree_blob")), short(upstream.get("origin_main_blob")),
            short(upstream.get("origin_main_commit"))),
        "collab %s %s" % (collab.get("repo_id") or "—", text(collab.get("path_scopes"))) if collab else "collab —",
    ])
    proposed = prop.get("proposed") or {}
    if proposed.get("card_text"):
        doc.p("Card text, ready to paste (basis notes on their own comment lines):")
        doc.pre(proposed["card_text"])
    for ref, patch in sorted((proposed.get("patch") or {}).items()):
        if isinstance(patch, dict) and patch.get("diff"):
            doc.p("Patch preview against %s blob %s (applies: %s)" % (ref, short(patch.get("blob")), text(patch.get("applies"))))
            doc.pre(patch["diff"])


def drift_doc(v):
    doc = Doc()
    doc.h(1, "Drift — run %s" % v.run_id)
    doc.p("KINGDOM facets resolve on %s; where another ref differs, section 2 lists it as drift." % authority_text(v.snapshot))
    by_section = {}
    for item in v.snapshot.get("drift") or []:
        by_section.setdefault(item.get("section"), []).append(item)
    for number, title in DRIFT_SECTIONS.items():
        doc.h(2, "%d. %s" % (number, title))
        items = sorted(by_section.get(number) or [], key=lambda i: (i.get("code") or "", str(i.get("id"))))
        if number == 4:
            _changes(doc, v, items)
        elif number == 5:
            _vocab_drift(doc, v)
            if items:
                _drift_table(doc, items)
        else:
            _drift_table(doc, items)
    return doc


def _drift_table(doc, items):
    doc.table(("code", "record", "detail"), [(i.get("code"), i.get("id"), _drift_detail(i)) for i in items])


def _drift_detail(item):
    detail = text(item.get("detail"))
    if "from" in item or "to" in item:
        detail += " (from %s to %s)" % (text(item.get("from")), text(item.get("to")))
    return detail


def _changes(doc, v, items):
    result = v.snapshot.get("reconcile") or {}
    if v.meta.get("first_run"):
        doc.p("First run: there was no previous snapshot to compare, so every record counts as added.")
    doc.p("Records: %s." % ", ".join("%s %d" % (k, len(result.get(k) or [])) for k in
                                     ("added", "missing", "gone", "returned", "dropped")))
    if items:
        doc.p("Record, facet, group and pulse changes:")
        _drift_table(doc, items)
    elif not v.meta.get("first_run"):
        doc.p("No record, facet, group or pulse change was observed.")
    tree = v.meta.get("tree")
    doc.h(3, "Tree links")
    if not tree:
        doc.p("tree: not built in this run, or its result was not provided to the renderer")
    else:
        diff = tree.get("diff") or {}
        if diff.get("baseline") is False:
            doc.p("No previous tree manifest; %d links created, %d refused." % (tree.get("links", 0),
                                                                                  len(tree.get("refused") or [])))
        else:
            doc.p("added %d, removed %d, retargeted %d, newly refused %d (refused in total %d)." % (
                len(diff.get("added") or []), len(diff.get("removed") or []), len(diff.get("retargeted") or []),
                len(diff.get("refused") or []), len(tree.get("refused") or [])))
            doc.ul(["added " + p for p in diff.get("added") or []] + ["removed " + p for p in diff.get("removed") or []]
                   + ["retargeted %s: %s -> %s" % (r["path"], r["from"], r["to"]) for r in diff.get("retargeted") or []]
                   + ["refused %s (%s)" % (r.get("record_id"), r.get("reason")) for r in diff.get("refused") or []])
    doc.h(3, "Proposals opened or resolved")
    if v.prev_props is None:
        doc.p("previous proposals not provided; nothing compared")
        return
    before = {p["id"]: p for p in v.prev_props if isinstance(p, dict) and p.get("id")}
    opened = [p["id"] for p in v.props if p.get("status") in OPEN and (before.get(p["id"]) or {}).get("status") not in OPEN]
    resolved = [pid for pid, p in sorted(before.items()) if p.get("status") in OPEN
                and (v.prop_by_id.get(pid) or {}).get("status") not in OPEN]
    doc.ul(["opened " + pid for pid in sorted(opened)] + ["resolved %s (now %s)" % (
        pid, (v.prop_by_id.get(pid) or {}).get("status", "absent")) for pid in resolved])


def _vocab_drift(doc, v):
    lock = v.meta.get("lock")
    if lock is None:
        doc.p("Lock comparison: not provided to the renderer.")
    else:
        doc.p("Lock comparison: %s." % lock.get("state"))
        doc.ul("%s %s: lock %s, live %s" % (d.get("ref") or "—", d.get("key"), short(d.get("lock")), short(d.get("live")))
               for d in lock.get("diffs") or [])
    mirror = v.meta.get("mirror_drift")
    if mirror is None:
        doc.p("Mirror drift: not measured in this run (check --verify-harvest measures it).")
    elif mirror:
        doc.p("Mirror drift:")
        doc.ul(text(m) for m in mirror)
    else:
        doc.p("Mirror drift: none.")


def queue_doc(v):
    doc = Doc()
    doc.h(1, "Queue — run %s" % v.run_id)
    by_reason = {}
    for item in v.snapshot.get("queue") or []:
        by_reason.setdefault(item.get("reason") or "unknown", []).append(item)
    order = [r for r in QUEUE_ORDER if r in by_reason] + sorted(r for r in by_reason if r not in QUEUE_ORDER)
    doc.p("%d items: %s." % (sum(len(x) for x in by_reason.values()),
                             ", ".join("%s %d" % (r, len(by_reason[r])) for r in order) or "none"))
    for reason in order:
        doc.h(2, "%s (%d)" % (reason, len(by_reason[reason])))
        doc.table(("record", "name", "detail"), [(i.get("id"), v.name(i.get("id")), i.get("detail"))
                                                 for i in sorted(by_reason[reason], key=lambda i: str(i.get("id")))])
    return doc


def attention_doc(v):
    doc = Doc()
    doc.h(1, "Attention — run %s" % v.run_id)
    doc.p("Risk → severity (1 is most urgent) → project or checkout. Secret-bearing items are pointers "
          "(names only); no content was ever read.")
    by_risk = {}
    for item in v.snapshot.get("attention") or []:
        by_risk.setdefault(item.get("risk") or "unknown", []).append(item)
    order = [r for r in ATTENTION_ORDER if r in by_risk] + sorted(r for r in by_risk if r not in ATTENTION_ORDER)
    doc.p("; ".join("%s %d" % (r, len(by_risk[r])) for r in order) or "none")
    for account in v.kind("account"):
        status = account.get("decided_status")
        if status:
            doc.p("%s (%s): %s, by owner decision %s; the estate makes no calls to it and takes no action. "
                  "%d rows below carry this status." % (
                      account["id"], status.get("provider"), status.get("status"), status.get("decision"),
                      sum(1 for i in v.snapshot.get("attention") or [] if i.get("decision") == status.get("decision"))))
    for risk in order:
        doc.h(2, "%s (%d)" % (risk, len(by_risk[risk])))
        items = sorted(by_risk[risk], key=lambda i: (i.get("severity") or 9, str(i.get("id"))))
        doc.table(("severity", "record", "name", "where", "detail", "basis", "status"),
                  [(i.get("severity"), i.get("id"), v.name(i.get("id")), _where(v, i.get("where")), i.get("detail"),
                    i.get("basis"), "%s (%s)" % (i["status"], i.get("decision")) if i.get("status") else "—")
                   for i in items])
    return doc


def _where(v, where):
    record = v.by_id.get(where) or {}
    if record.get("kind") == "checkout":
        return record.get("rel") or rel_home(record.get("path"), v.home)
    return where


# ── portfolio-join.json ─────────────────────────────────────────────────────────────────────

def _facet_pair(facet):
    if "values" in facet:
        return {"values": list(facet.get("values") or []), "status": facet.get("status")}
    pair = {"value": facet.get("value"), "status": facet.get("status")}
    if facet.get("status") == "contested":
        pair["candidates"] = model.contested_values(facet)
    return pair


def portfolio_join(v):
    """estate.portfolio-join/1: KINGDOM and overlay facets keyed by the v1 ids. The v1 map is a
    dated historical source; this file never rewrites it."""
    entry = v.sources.get("src:portfolio-map") or {}
    port = v.portfolio if isinstance(v.portfolio, dict) else None
    out = {"schema": JOIN_SCHEMA, "run_id": v.run_id, "observed_at": v.snapshot.get("observed_at"),
           "source_map": {"schema": (port or {}).get("schema"), "sha256": entry.get("sha256") or (port or {}).get("sha256"),
                          "observed": (port or {}).get("observed") or entry.get("observed_at"),
                          "status": (port or {}).get("status") or entry.get("status") or "not provided"},
           "repositories": [], "surfaces": [], "zones": [], "unjoined": {"portfolio": [], "overlay_github": []}}
    owner_of = {}
    for project in v.projects:
        owner_of[project["id"]] = project["id"]
        for alias in project.get("aliases") or []:
            owner_of.setdefault(alias, project["id"])
    joined = set()
    if port is None:
        out["note"] = "the portfolio-map/1 source was not provided to the renderer; repositories are not joined"
    for repo in (port or {}).get("repositories") or []:
        full = str(repo.get("full_name") or "")
        pid = owner_of.get("github.com/" + full.lower())
        if pid is None:
            out["unjoined"]["portfolio"].append({"kind": "repository", "portfolio_id": repo.get("portfolio_id"),
                                                 "full_name": full})
            continue
        joined.add(pid)
        project = v.by_id[pid]
        out["repositories"].append({
            "portfolio_id": repo.get("portfolio_id"), "full_name": full, "overlay_id": pid,
            "extensions": {"kingdom": {name: _facet_pair(facet_of(project, name)) for name in ("layer", "kind", "state", "standing")},
                           "overlay": {name: _facet_pair(facet_of(project, name))
                                       for name in ("family", "role", "liveness", "running", "hosting")}}})
    if port is not None:
        out["unjoined"]["overlay_github"] = sorted(p["id"] for p in v.projects
                                                   if p["id"].startswith("github.com/") and p["id"] not in joined)
    surface_ids = set()
    for surface in v.kind("surface"):
        if surface.get("portfolio_resource_id"):
            surface_ids.add(surface["portfolio_resource_id"])
            overlay = (surface.get("attribution") or {}).get("class")
            out["surfaces"].append({"portfolio_resource_id": surface["portfolio_resource_id"], "overlay_id": surface["id"],
                                    "attribution_v1": surface.get("attribution_v1"), "attribution_overlay": overlay,
                                    "agree": surface.get("attribution_v1") == overlay})
    for ps in (port or {}).get("surfaces") or []:
        if ps.get("resource_id") not in surface_ids:
            out["unjoined"]["portfolio"].append({"kind": "surface", "portfolio_id": ps.get("portfolio_id"),
                                                 "resource_id": ps.get("resource_id")})
    zone_ids = set()
    for zone in v.kind("zone"):
        if zone.get("portfolio_id"):
            zone_ids.add(zone["portfolio_id"])
            out["zones"].append({"portfolio_id": zone["portfolio_id"], "overlay_id": zone["id"]})
    for pz in (port or {}).get("zones") or []:
        if pz.get("portfolio_id") not in zone_ids:
            out["unjoined"]["portfolio"].append({"kind": "zone", "portfolio_id": pz.get("portfolio_id"),
                                                 "name": pz.get("name")})
    return out


# ── entry point ─────────────────────────────────────────────────────────────────────────────

def run_area(run_dir, layer_dir=None):
    """(PrivateArea, run relpath). The run dir must be runs/<run id> directly inside the private
    area and carry its marker (safety.require_run_dir), so no view can be written anywhere else."""
    run_real = os.path.realpath(run_dir)
    layer = layer_dir or os.path.dirname(os.path.dirname(os.path.dirname(run_real)))
    area = safety.PrivateArea(layer)
    run_rel, _run_id = safety.require_run_dir(area, run_dir)
    return area, run_rel


def render_all(run_dir, snapshot, props, run_meta=None, curated=None, vocab=None, portfolio=None,
               prev_props=None, layer_dir=None, home=None):
    """Write the views (VIEW_FILES) into run_dir. snapshot: model.build_records() (a bare record list is
    accepted); props: proposals.propose(); run_meta: {run_id, mode, state, degraded_reasons, lock
    (kingdom.compare_lock), tree (tree.build_tree result), mirror_drift, first_run}; curated:
    model.load_curated() (disputes, questions, legal); vocab: model.load_vocab(); portfolio: the
    sources.read_portfolio_v1() dict; prev_props: the previous run's proposals. Missing inputs are
    named as not provided in the views. Returns {name: absolute path}."""
    if isinstance(snapshot, list):
        snapshot = {"records": snapshot}
    area, run_rel = run_area(run_dir, layer_dir)
    home = os.environ.get("HOME", "") if home is None else home
    view = View(snapshot, props, run_meta, curated, vocab, portfolio, prev_props,
                (run_meta or {}).get("run_id") or os.path.basename(run_rel), home)
    view.hygiene_href = "file://" + urllib.parse.quote(os.path.join(os.path.realpath(run_dir), "HYGIENE.html"))
    view.capabilities_href = "file://" + urllib.parse.quote(os.path.join(os.path.realpath(run_dir), "CAPABILITIES.md"))
    atlas = atlas_doc(view)
    hygiene_view = hygiene_doc(view)
    outputs = {
        "ATLAS.md": to_markdown(atlas),
        "ATLAS.html": atlas_html(view, atlas),
        "PROPOSALS.md": to_markdown(proposals_doc(view)),
        "DRIFT.md": to_markdown(drift_doc(view)),
        "QUEUE.md": to_markdown(queue_doc(view)),
        "ATTENTION.md": to_markdown(attention_doc(view)),
        "HYGIENE.md": to_markdown(hygiene_view),
        "HYGIENE.html": hygiene_html(hygiene_view),
        "CAPABILITIES.md": to_markdown(capability_doc(view)),
        "portfolio-join.json": json.dumps(portfolio_join(view), indent=1, sort_keys=True, ensure_ascii=False,
                                          default=str) + "\n",
    }
    return {name: area.write(os.path.join(run_rel, name), outputs[name], 0o600) for name in VIEW_FILES}
