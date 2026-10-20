"""The estate model: vocabulary and curation loading, the join of census, KINGDOM and the side
sources into records, per-ref KINGDOM resolution, facets, freshness, validation, reconciliation.

KINGDOM stays primary. layer, kind and state are resolved per ref from the live foundation (the
valid card value, the roster row and harvest's override rules), never from survey placements,
tags or prior maps; when they disagree the facet is contested, its value null and every
candidate listed, rather than settled by the overlay. Every facet carries a status: a source that
could not be read leaves the value None with status unknown, never 0, clean or healthy.

Words of the risk vocabulary come from curate.RISKS (spelled in parts there) and local ids are
built from curate.LOCAL, so this file passes the privacy lint it is committed under.
"""
import datetime as dt
import fnmatch
import hashlib
import json
import os
import re
import tomllib
from collections import Counter

import capability
import census
import curate
import decisions
import hygiene
import ideas
import kingdom
import motifs
import packages
import safety
import sources
import sphere
import wires


SNAPSHOT_SCHEMA = "estate.snapshot/1"
FACETS = "vocab/facets.toml"
RECORDS = "vocab/records.toml"
TAG_MAP = "vocab/tag-map.tsv"
FAMILIES_DIR = "curated/families"
CURATED_ESTATE = "curated/estate.toml"
DECISIONS = "curated/decisions.toml"
CAPABILITIES = capability.COMMITTED_FILE
WIRES = wires.FILE
MOTIFS = motifs.FILE
PRIVATE_PROJECTS = "private/curated/projects.toml"
PRIVATE_ESTATE = "private/curated/estate.toml"
# The owner's own words behind the owner decisions, verbatim; private, written by `estate decisions`.
PRIVATE_DECISIONS = "private/curated/decisions.toml"
# Local-id sphere rows and the full evidence of every sphere row; private, written by `estate sphere`.
PRIVATE_SPHERE = "private/" + sphere.PRIVATE_FILE
PRIVATE_HYGIENE = "private/" + hygiene.PRIVATE_FILE
# The ideas plan: business ideas as proposals whose statuses only the owner sets; private, written by
# `estate ideas`.
PRIVATE_IDEAS = "private/" + ideas.PRIVATE_FILE
# Local-id capability rows and the full evidence of every capability row; private, written by
# `estate capability`.
PRIVATE_CAPABILITY = "private/" + capability.PRIVATE_FILE
MAX_TOML = 4 << 20

LOCAL = curate.LOCAL
RISKS = curate.RISKS
KINGDOM_FIELDS = ("layer", "kind", "state")
NAVIGATION = ("layer", "kind", "state", "standing", "liveness", "running", "hosting", "stack",
              "exposure", "family", "role", "topic", "sphere", "capability")
RECORD_KINDS = ("project", "checkout", "group", "family", "surface", "zone", "scheduler", "artifact",
                "device", "account", "relation", "package")
VALUE_STATUS = "set"
CURRENT = ("deployment_commit_verified", "current_tracked_config", "current_source_document")
ATTRIBUTION_ORDER = CURRENT + ("historical_source_evidence", "candidate_only", "unresolved")
FRESHNESS_ORDER = ("fresh", "aging", "stale", "missing", "error")
ACTIVE_WITHIN_S = 30 * 86400
PULSE_STALE_S = 24 * 3600
GONE_AFTER_S = 24 * 3600
GONE_KEEP_S = 30 * 86400
DEFAULT_BRANCHES = ("main", "master")
# harvest diagnostics that make a card field missing, off-vocabulary or malformed (standing
# card-invalid). unknown-dependency and name-mismatch judge references, not the card's own fields:
# they stay in card_schema_ok and open P06/P05 instead.
CARD_FIELD_CODES = ("missing-field", "unknown-field", "duplicate-field", "malformed-line", "invalid-type",
                    "invalid-enum", "unsupported-adoption")
CANONICAL_BASES = ("override", "scheduler-target", "default-branch-newest", "shortest-path")
# (fresh_s, stale_s) per source, spec section 11. Sources read live have no budget.
BUDGETS = {
    "census": (86400, 7 * 86400), "full-walk": (7 * 86400, 30 * 86400), "pulse": (3600, 86400),
    "pulse-history": (3600, 86400), "cloudflare-observer": (36 * 3600, 7 * 86400),
    "forge": (7 * 86400, 30 * 86400), "portfolio-map": (14 * 86400, 30 * 86400),
    "kingdom-origin": (7 * 86400, 30 * 86400),
}
REQUIRED_SOURCES = ("src:census", "src:kingdom:worktree", "src:roster", "src:pulse")
# Declared counts the overlay can verify; any other [[declared]] id is reported unverifiable.
DECLARED_METRICS = {"citizens-md": "citizens", "roster-header": "projects"}
# Forges, vendors and shared hosts: a hostname under one of these is a service the estate uses,
# not a zone it holds (spec 6.7 zones are registrable domains of the estate's own).
PROVIDER_APEX = ("github.com", "codeberg.org", "gitlab.com", "ollama.com", "surge.sh", "netlify.app", "npmjs.com",
                 "pypi.org", "huggingface.co", "shopify.com", "myshopify.com", "stripe.com", "supabase.co",
                 "amazonaws.com", "cloudfront.net", "herokuapp.com", "render.com", "railway.app")
MULTI_LABEL_SUFFIXES = ("co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "com.au", "net.au", "co.nz",
                        "co.jp", "com.br", "com.cn", "co.in", "co.za")
STACK_EXT = {
    ".go": "go", ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".js": "javascript",
    ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript", ".py": "python", ".rs": "rust",
    ".sol": "solidity", ".sh": "shell", ".bash": "shell", ".zsh": "shell", ".tf": "terraform",
    ".liquid": "liquid", ".html": "html", ".htm": "html", ".md": "markdown",
}
STACK_MIN_FILES = 3
STACK_MIN_SHARE = 0.05
STACK_MAJOR_SHARE = 0.25  # in a tiny repo one file can still be a quarter of it
# Hosting values a measurement channel can show absent (manifests, schedulers, pulse-backed
# surfaces); the rest (x-npm, x-aws, shopify, ...) come only from curated rows or REGISTRY.
MEASURABLE_HOSTING = ("fly", "cf-pages", "cf-worker", "vercel", "codeberg-pages", "x-github-pages", "external",
                      "local-launchd", "x-cron", "x-hermes-cron", "x-gha-schedule")
STACK_MANIFESTS = {
    "go.mod": "go", "Cargo.toml": "rust", "pyproject.toml": "python", "requirements.txt": "python",
    "setup.py": "python", "foundry.toml": "solidity", "hardhat.config.ts": "solidity",
    "hardhat.config.js": "solidity", "tsconfig.json": "typescript", "deno.json": "typescript",
    "terraform": "terraform",
}
SCHEDULER_HOSTING = {"launchd": "local-launchd", "cron": "x-cron", "hermes": "x-hermes-cron",
                     "gha": "x-gha-schedule", "cf-cron": "cf-worker"}
PORTFOLIO_KINDS = {"pages": "cf-pages", "workers": "cf-worker"}
LIVENESS_STATE = {"active": "active", "dormant": "dormant", "archived": "archived", "gone": "archived"}


class ModelError(safety.EstateError):
    """The vocabulary contract is missing or malformed; the CLI exits 1 and keeps the previous run."""


# ── small helpers ───────────────────────────────────────────────────────────────────────────

def _layer(layer_dir):
    return os.path.realpath(layer_dir or safety.LAYER_DIR)


def _plain(value):
    """TOML dates become ISO strings so every record serialises as JSON."""
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    if isinstance(value, (dt.date, dt.datetime, dt.time)):
        return value.isoformat()
    return value


def _read_toml(path):
    raw, reason = safety.read_checked(path, MAX_TOML)
    if raw is None:
        return None, reason
    try:
        return tomllib.loads(raw.decode("utf-8")), None
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        return None, "invalid toml: %s" % exc


def parse_iso(text):
    if not isinstance(text, str) or not text:
        return None
    try:
        moment = dt.datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=dt.timezone.utc)


def epoch(text):
    moment = parse_iso(text)
    return moment.timestamp() if moment else None


def _age(now, text):
    seconds = epoch(text)
    return None if seconds is None else int(now.timestamp() - seconds)


def _iso_epoch(seconds):
    return safety.iso(dt.datetime.fromtimestamp(seconds, dt.timezone.utc))


def _repo_name(ident):
    return ident.rsplit("/", 1)[-1].lower() if isinstance(ident, str) else None


def _forge_parts(ident):
    parts = ident.split("/", 2)
    return (parts + [None, None, None])[:3]


def _is_forge(ident):
    return isinstance(ident, str) and not ident.startswith((LOCAL, "file:")) and ident.count("/") >= 2


def freshness(age_s, fresh_s, stale_s):
    """fresh within fresh_s, aging within stale_s, stale beyond; missing when the age is unknown."""
    if age_s is None:
        return "missing"
    if age_s <= fresh_s:
        return "fresh"
    if age_s <= stale_s:
        return "aging"
    return "stale"


def worst_freshness(values):
    known = [v for v in values if v in FRESHNESS_ORDER]
    return max(known, key=FRESHNESS_ORDER.index) if known else None


def _facet(value=None, status="unknown", basis=None, src=None, at=None, **extra):
    facet = {"value": value, "status": status, "basis": basis, "src": src, "at": at, "alt": []}
    facet.update(extra)
    return facet


def _multi(values, status, basis=None, src=None, at=None, **extra):
    facet = {"values": list(values), "status": status, "basis": basis, "src": src, "at": at, "alt": []}
    facet.update(extra)
    return facet


# ── vocabulary and curation ─────────────────────────────────────────────────────────────────

def facets_problems(facets):
    """Shape problems of vocab/facets.toml (empty when usable)."""
    problems = []
    meta = facets.get("meta") if isinstance(facets, dict) else None
    navigation = (meta or {}).get("navigation")
    size = len(NAVIGATION)
    if not isinstance(navigation, list) or len(navigation) != size or len(set(navigation)) != size:
        problems.append("[meta].navigation must list exactly %d distinct facets" % size)
        navigation = []
    tables = facets.get("facet") or {}
    for name in navigation:
        table = tables.get(name)
        if not isinstance(table, dict):
            problems.append("navigation facet %s has no [facet.%s] table" % (name, name))
        elif table.get("owner") == "kingdom" and "values" in table:
            problems.append("KINGDOM facet %s must be a pointer, not a value list" % name)
        elif table.get("owner") != "kingdom" and not isinstance(table.get("values"), dict):
            problems.append("overlay facet %s needs a [facet.%s.values] table" % (name, name))
    return problems


def contract_problems(contract):
    """Shape problems of vocab/records.toml (empty when usable)."""
    problems = []
    kinds = (contract or {}).get("kind") or {}
    for name in RECORD_KINDS + ("proposal", "source"):
        table = kinds.get(name)
        if not isinstance(table, dict) or not isinstance(table.get("fields"), dict):
            problems.append("records.toml lacks [kind.%s] with fields" % name)
    return problems


def _values(facets, *path):
    node = facets or {}
    for part in path:
        node = (node or {}).get(part) or {}
    return set(node.get("values") or {}) | set(node.get("statuses") or [])


def target_vocabulary(facets, card_enums=None):
    """{tag-map target key: allowed values}, read from vocab/facets.toml; card hints come from
    the live CARD_ENUMS when given (never from a copy), else they cannot be checked (None)."""
    return {
        "topic": _values(facets, "facet", "topic") | set((facets.get("topic_candidates") or {}).get("values") or []),
        "role": _values(facets, "facet", "role"), "role_status": _values(facets, "display", "role_status"),
        "expect:liveness": _values(facets, "facet", "liveness"), "expect:hosting": _values(facets, "facet", "hosting"),
        "expect:stack": _values(facets, "facet", "stack"), "expect:exposure": _values(facets, "facet", "exposure"),
        "expect:standing": _values(facets, "facet", "standing"),
        "expect:checkout_role": _values(facets, "vocab", "checkout_role"),
        "expect:provenance": _values(facets, "display", "provenance"), "risk": _values(facets, "vocab", "risk"),
        "purpose_group": _values(facets, "business", "purpose_group"),
        "be.framework_domain": _values(facets, "business", "be.framework_domain"),
        "artifact_kind": _values(facets, "vocab", "artifact_kind"), "relation": _values(facets, "vocab", "relation"),
        "drop": _values(facets, "vocab", "tag_drop"),
        "card-hint:layer": set(card_enums["layer"]) if card_enums and card_enums.get("layer") else None,
        "card-hint:kind": set(card_enums["kind"]) if card_enums and card_enums.get("kind") else None,
    }


def vocab_target_problems(rows, facets, card_enums=None):
    """Closure of the tag map against vocab/facets.toml (spec 5): a row without a target, a target
    key the registry does not know, or a value outside it. Card hints are checked against the live
    CARD_ENUMS passed in; without them they are reported as unchecked."""
    allowed = target_vocabulary(facets, card_enums)
    problems = []
    for raw, targets, _rules, _uses in rows:
        if not targets:
            problems.append("%s: no target" % raw)
        for target in targets:
            key, sep, value = target.partition("=")
            if not sep or not value:
                problems.append("%s: malformed target %r" % (raw, target))
            elif key not in allowed:
                problems.append("%s: unknown target key %r" % (raw, key))
            elif allowed[key] is None:
                problems.append("%s: %s unchecked (no live CARD_ENUMS given)" % (raw, target))
            elif value not in allowed[key]:
                problems.append("%s: %s is not in vocab/facets.toml" % (raw, target))
    return problems


def load_vocab(layer_dir=None):
    """vocab/facets.toml and vocab/records.toml (both required: ModelError when unusable) plus the
    tag map, whose absence is recorded in status rather than raised."""
    layer = _layer(layer_dir)
    out = {"facets": None, "records": None, "tag_map": None, "tag_index": None, "status": {}}
    for key, rel in (("facets", FACETS), ("records", RECORDS)):
        data, reason = _read_toml(os.path.join(layer, rel))
        if data is None:
            raise ModelError("%s unreadable: %s" % (rel, reason))
        out[key] = data
        out["status"][rel] = "ok"
    problems = facets_problems(out["facets"]) + contract_problems(out["records"])
    if problems:
        raise ModelError("vocabulary contract invalid: " + "; ".join(problems))
    raw, reason = safety.read_checked(os.path.join(layer, TAG_MAP), MAX_TOML)
    if raw is None:
        out["status"][TAG_MAP] = reason
        return out
    try:
        rows = curate.parse_tag_map(raw.decode("utf-8"))
    except (UnicodeDecodeError, safety.GuardError) as exc:
        out["status"][TAG_MAP] = "invalid: %s" % exc
        return out
    out["tag_map"], out["tag_index"] = rows, curate.tag_index(rows)
    out["status"][TAG_MAP] = "ok"
    return out


def _family_files(layer, out):
    folder = os.path.join(layer, FAMILIES_DIR)
    try:
        with os.scandir(folder) as entries:
            names = sorted(e.name for e in entries if e.name.endswith(".toml"))
    except FileNotFoundError:
        out["status"][FAMILIES_DIR] = "missing"
        return
    except OSError as exc:
        out["status"][FAMILIES_DIR] = "error: %s" % exc.strerror
        return
    out["status"][FAMILIES_DIR] = "ok"
    for name in names:
        rel = FAMILIES_DIR + "/" + name
        data, reason = _read_toml(os.path.join(folder, name))
        if data is None or not isinstance(data.get("family"), dict):
            out["problems"].append("%s: %s" % (rel, reason or "no [family] table"))
            continue
        family = dict(data["family"], file=rel)
        out["families"][family["id"]] = family
        for row in data.get("project") or []:
            if row.get("id") in out["projects"]:
                out["problems"].append("%s: project %s curated twice" % (rel, row.get("id")))
                continue
            out["projects"][row["id"]] = dict(row, family_id=family["id"])
        for row in data.get("group") or []:
            out["groups"][row["id"]] = dict(row, family_id=family["id"], committed=True)


def _private_rows(layer, out):
    data, reason = _read_toml(os.path.join(layer, PRIVATE_PROJECTS))
    out["status"][PRIVATE_PROJECTS] = reason or "ok"
    for row in (data or {}).get("project") or []:
        out["private"]["projects"][row["id"]] = row
        if row.get("committed") is False and row["id"] not in out["projects"]:
            # local:* projects live only in the private file; they carry their own curation.
            local = {k: row[k] for k in ("name", "what", "role", "role_status", "topics", "aliases", "alias_status")
                     if k in row}
            out["projects"][row["id"]] = dict(local, id=row["id"], family_id="family:" + row["family"],
                                              private_only=True)
    data, reason = _read_toml(os.path.join(layer, PRIVATE_ESTATE))
    out["status"][PRIVATE_ESTATE] = reason or "ok"
    estate = data or {}
    out["private"]["estate"] = estate
    for row in estate.get("group") or []:
        if row["id"] in out["groups"]:
            out["groups"][row["id"]]["private"] = row
        else:
            out["groups"][row["id"]] = dict(row, family_id="family:" + row["family"], committed=False,
                                            private=row)
    for row in estate.get("family") or []:
        if row.get("id") in out["families"]:
            out["families"][row["id"]]["private"] = row
    words, reason = _read_toml(os.path.join(layer, PRIVATE_DECISIONS))
    out["status"][PRIVATE_DECISIONS] = reason or "ok"
    out["private"]["decisions"] = words or {}
    rows, reason = _read_toml(os.path.join(layer, PRIVATE_SPHERE))
    out["status"][PRIVATE_SPHERE] = reason or "ok"
    out["private"]["sphere"] = rows or {}
    rows, reason = _read_toml(os.path.join(layer, PRIVATE_CAPABILITY))
    out["status"][PRIVATE_CAPABILITY] = reason or "ok"
    out["private"]["capability"] = rows or {}
    # JSON, not TOML: the D8 plan is kept as its own schema, verbatim (hygiene.py).
    doc, reason = hygiene.load(os.path.join(layer, PRIVATE_HYGIENE))
    out["status"][PRIVATE_HYGIENE] = reason or "ok"
    out["private"]["hygiene"] = doc
    # JSON as well: the ideas plan is an owner plan like the D8 one (ideas.py, plans.py).
    doc, reason = ideas.load(os.path.join(layer, PRIVATE_IDEAS))
    out["status"][PRIVATE_IDEAS] = reason or "ok"
    out["private"]["ideas"] = doc


def load_curated(layer_dir=None):
    """The committed curation (families, groups, estate.toml, decisions.toml, capabilities.toml with its
    [[capability]] and [[host]] rows, wires.toml, motifs.toml) plus the private curation, with the owner
    decisions applied to its questions and disputes (decisions.apply). Any file that is absent is
    recorded in status as missing; nothing is invented."""
    layer = _layer(layer_dir)
    out = {"families": {}, "projects": {}, "groups": {}, "identity": [], "surfaces": [], "zones": [],
           "disputes": [], "questions": [], "upstream_notes": [], "spheres": [], "capabilities": [], "hosts": [],
           "wires": [], "motifs": [], "owners": {}, "legal": {}, "decisions": [],
           "private": {"projects": {}, "estate": {}, "decisions": {}, "sphere": {}, "capability": {}, "hygiene": None,
                       "ideas": None},
           "status": {},
           "problems": []}
    _family_files(layer, out)
    estate, reason = _read_toml(os.path.join(layer, CURATED_ESTATE))
    out["status"][CURATED_ESTATE] = reason or "ok"
    for key, table in (("identity", "identity"), ("surfaces", "surface"), ("zones", "zone"),
                       ("disputes", "dispute"), ("questions", "question"), ("upstream_notes", "upstream_note"),
                       ("spheres", "sphere")):
        out[key] = list((estate or {}).get(table) or [])
    out["owners"] = (estate or {}).get("owners") or {}
    out["legal"] = (estate or {}).get("legal") or {}
    decided, reason = _read_toml(os.path.join(layer, DECISIONS))
    out["status"][DECISIONS] = reason or "ok"
    out["decisions"] = list((decided or {}).get("decision") or [])
    rows, reason = _read_toml(os.path.join(layer, CAPABILITIES))
    out["status"][CAPABILITIES] = reason or "ok"
    out["capabilities"] = list((rows or {}).get("capability") or [])
    out["hosts"] = list((rows or {}).get("host") or [])
    rows, reason = _read_toml(os.path.join(layer, WIRES))
    out["status"][WIRES] = reason or "ok"
    out["wires"] = list((rows or {}).get("wire") or [])
    rows, reason = _read_toml(os.path.join(layer, MOTIFS))
    out["status"][MOTIFS] = reason or "ok"
    out["motifs"] = list((rows or {}).get("motif") or [])
    _private_rows(layer, out)
    return decisions.apply(_plain(out))


# ── reading the side sources (the input shape of build_records) ────────────────────────────

def _locator(cfg, key, home):
    value = ((cfg or {}).get("locators") or {}).get(key)
    if not value:
        return None
    try:
        return safety.expand_locator(value, home)
    except safety.GuardError:
        return None


def gather_sources(cfg, kos_path, curated=None, home=None):
    """Every source build_records reads except the per-checkout ones (see read_canonical): the
    KINGDOM runtime files, schedulers, portfolio-map/1, the observer, forge listings, prior maps
    and artifact lstat. Each value is the reader's own dict with its status."""
    home = os.environ.get("HOME", "") if home is None else home
    cfg = cfg or {}
    globs = [safety.LOCATORS["hermes_jobs"]] + list((cfg.get("locators") or {}).get("scheduler_json_globs") or [])
    artifacts = ((curated or {}).get("private") or {}).get("estate", {}).get("artifact") or []
    return {
        "registry": kingdom.read_registry(kos_path, home),
        "sites": kingdom.read_sites(kos_path),
        "graph": kingdom.read_graph(kos_path),
        "pulse": kingdom.read_pulse(home),
        "global_wake": kingdom.global_wake(home),
        "launchd": sources.read_launchd(home=home),
        "launchctl": sources.read_launchctl(),
        "crontab": sources.read_crontab(home),
        "scheduler_json": sources.read_scheduler_json(globs, home),
        "portfolio": sources.read_portfolio_v1(_locator(cfg, "portfolio_map", home)),
        "observer": sources.read_observer(_locator(cfg, "observer_runs", home), home),
        "cf_inventory": sources.read_cf_inventory(_locator(cfg, "cf_inventory", home)),
        "forge": sources.read_forge_listings((cfg.get("forge") or {}).get("listings") or []),
        "prior_maps": sources.read_prior_maps(cfg, home),
        "artifacts": sources.lstat_artifacts(artifacts, home),
    }


def read_canonical(checkout, project_id, hosts=None, anchors=None):
    """The per-checkout sources, read only for canonical checkouts: repo schedulers and deploy
    manifests; for a host repository (hosts: packages.host_rows) its packages and the quarantine list
    its row names; and the curated wire anchors that point into it (anchors: wires.anchors_by_repo).
    Pass this as build_records(repo_reader=read_canonical), with hosts and anchors bound
    (functools.partial) when packages and wires are wanted."""
    out = {"schedules": sources.read_repo_schedules(checkout, project_id),
           "manifests": sources.read_manifests(checkout)}
    host = (hosts or {}).get(project_id)
    if host is not None:
        out["packages"] = sources.read_packages(checkout, host.get("extra_folders") or ())
        out["build_list"] = sources.read_build_list(checkout, host["build_list"]) if host.get("build_list") else None
    if (anchors or {}).get(project_id):
        out["anchors"] = sources.find_anchors(checkout, anchors[project_id])
    return out


# ── KINGDOM resolution (spec 6.8) ──────────────────────────────────────────────────────────

def _harvest_value(field, view):
    """Candidate (c): what harvest's own rules make of this field. The citizens-dir rule forces
    the layer of every carded citizen; any other field counts only where a rule overrode the card."""
    if not view:
        return None
    if field == "layer" and view.get("source") == "fleet":
        return view.get("layer")
    override = (view.get("overrides") or {}).get(field)
    return override["harvest"] if override else None


def resolve_field(field, card, roster_row, view, enums, ruling=None):
    """One KINGDOM field under one ref. card: parse_card() result or None; roster_row: that ref's
    roster row or None; view: harvest_view() or None; enums: that ref's live CARD_ENUMS; ruling:
    an owner decision on this field (decisions.rules()["layer"]) or None.
    Returns {status, value, basis, candidates[{value, source}], off_enum[{value, source}]}, plus
    decided_by when the ruling settled what the claims alone would leave contested or forced.

    A ruling overrules one candidate source (harvest's forced fleet) only where it decides
    something: the card names the ruling's default (citizens are soul) or names no layer, when the
    default holds, as harvest itself would give it once it honours the card. That claim stays
    listed, marked overruled_by. A card naming another layer is a case the ruling does not cover,
    so its contest with the forced value stays open for Yu and no decision is credited with it."""
    allowed = set(enums.get(field) or ())
    candidates, off = [], []

    def claim(value, source):
        if value is None or value == "":
            return
        (candidates if value in allowed else off).append({"value": value, "source": source})

    card_value = ((card or {}).get("valid") or {}).get(field)
    claim(card_value, "card")
    if card_value is None and card and field in (card.get("off_enum") or {}):
        claim(card["off_enum"][field], "card")
    harvest = _harvest_value(field, view)
    harvest_source = "harvest:" + (view or {}).get("source", "rule")
    claim(harvest, harvest_source)
    roster_value = (roster_row or {}).get(field)
    claim(roster_value, "roster")
    out = {"status": "unset", "value": None, "basis": None, "candidates": candidates, "off_enum": off}
    ruled = (ruling or {}).get("field") == field and ruling.get("overrule") == harvest_source \
        and harvest is not None and harvest != card_value and card_value in (None, ruling.get("default"))
    if ruled:
        for item in candidates + off:
            if item["source"] == harvest_source:
                item["overruled_by"] = ruling["decision"]
        value = card_value if card_value is not None else ruling.get("default")
        if value in allowed:
            if card_value is None:
                candidates.append({"value": value, "source": "owner-decision"})
            out.update(status="settled", value=value, basis="owner-decision", decided_by=ruling["decision"])
            return out
        harvest = None  # overruled, and no value to take its place: the other claims decide
    if card_value is not None:
        if harvest is not None and harvest != card_value:
            out.update(status="contested", basis="harvest-rule")
        else:
            out.update(status="settled", value=card_value, basis="card")
    elif harvest is not None and harvest in allowed:
        out.update(status="roster-fallback", value=harvest, basis="harvest-rule")
    elif roster_value in allowed:
        out.update(status="roster-fallback", value=roster_value, basis="roster")
    elif off:
        out.update(status="off-enum-only")
    return out


def combine_refs(per_ref, primary, at=None, authority=None):
    """The facet for one KINGDOM field from its per-ref resolutions. The primary ref decides; when
    another readable ref yields a different status or value the facet is ref_divergent. Without an
    authority decision a divergence alone makes it contested with the candidates of every ref; with
    one (authority: the decision id naming the primary ref) the value follows the primary ref and
    the divergence stays visible in ref_divergent and by_ref, as drift."""
    if primary not in per_ref:
        readable = sorted(per_ref)
        if not readable:
            return _facet(status="unset", basis="kingdom", src=None, at=at, candidates=[], off_enum=[],
                          ref=None, ref_divergent=False, by_ref={})
        primary = readable[0]
    main = per_ref[primary]
    by_ref = {ref: {"status": r["status"], "value": r["value"]} for ref, r in per_ref.items()}
    divergent = any((r["status"], r["value"]) != (main["status"], main["value"])
                    for ref, r in per_ref.items() if ref != primary)
    candidates = [dict(c, ref=primary) for c in main["candidates"]]
    facet = _facet(main["value"], main["status"], "kingdom", "src:kingdom:" + primary, at,
                   ref=primary, resolved_by=main["basis"], candidates=candidates,
                   off_enum=[dict(c, ref=primary) for c in main["off_enum"]],
                   ref_divergent=divergent, by_ref=by_ref)
    if main.get("decided_by"):
        facet["decided_by"] = main["decided_by"]
    if divergent and authority:
        facet["authority"] = authority
    if divergent and not authority:
        for ref, r in sorted(per_ref.items()):
            if ref == primary:
                continue
            seen = {(c["value"], c["source"]) for c in facet["candidates"] if c["ref"] == ref}
            facet["candidates"] += [dict(c, ref=ref) for c in r["candidates"] if (c["value"], c["source"]) not in seen]
            if r["value"] is not None and not any(c["value"] == r["value"] and c["ref"] == ref for c in facet["candidates"]):
                facet["candidates"].append({"value": r["value"], "source": r["basis"] or "resolution", "ref": ref})
        facet.update(value=None, status="contested", resolved_by="ref-divergence")
    return facet


def by_ref_text(facet):
    """One line per ref of a KINGDOM facet, the facet's own ref first, e.g. "origin/main settled
    soul (authority dec-...); worktree contested"."""
    by_ref = facet.get("by_ref") or {}
    order = sorted(by_ref, key=lambda ref: (ref != facet.get("ref"), ref))
    parts = []
    for ref in order:
        entry = by_ref[ref]
        text = "%s %s%s" % (ref, entry.get("status"), " %s" % entry["value"] if entry.get("value") is not None else "")
        if ref == facet.get("ref") and facet.get("authority"):
            text += " (authority, %s)" % facet["authority"]
        parts.append(text)
    return "; ".join(parts) or "no ref read"


def contested_values(facet):
    """Every value a facet could take: its value, or each candidate value when it is contested."""
    if facet.get("value") is not None:
        return [facet["value"]]
    if facet.get("status") == "contested":
        return sorted({c["value"] for c in facet.get("candidates") or []})
    return []


# ── the join ────────────────────────────────────────────────────────────────────────────────

class _Join:
    """Holds the indexes of one build. Each method is one step of spec 6.7-6.8."""

    def __init__(self, census_data, foundation, srcs, curated, vocab, cfg, now, home, prev):
        self.census = census_data or {}
        self.foundation = foundation or {"refs": {}}
        self.srcs = srcs or {}
        self.curated = curated or {}
        self.vocab = vocab or {}
        self.cfg = cfg or {}
        self.now = now
        self.now_iso = safety.iso(now)
        self.home = os.path.realpath(home)
        self.prev = prev
        # An owner decision on the taxonomy authority picks the primary ref; config only without one.
        self.decided = decisions.rules(self.curated.get("decisions"))
        self.authority = decisions.primary_ref(self.cfg, self.decided)
        self.primary = self.authority["ref"]
        self.problems = []
        self.queue, self.drift, self.attention = [], [], []
        self.co, self.card_text, self.by_real, self.co_project = {}, {}, {}, {}
        self.by_inode = None
        self.local_aliases = {}
        self.projects, self.surfaces, self.schedulers, self.zones = {}, {}, {}, {}
        self.groups, self.families, self.relations, self.artifacts = {}, {}, {}, {}
        self.repo, self.roster, self.fleet = {}, {}, {}
        self.sphere, self.hygiene, self.capability, self.ideas = {}, {}, {}, {}
        self.packages, self.hosts, self.package_problems, self.wires = {}, [], [], {}
        # The package import edges and the anchors found in each checkout, kept for the motifs view.
        self.package_edges, self.anchors_found, self.motifs = [], {}, {}
        priv = (self.curated.get("private") or {}).get("estate") or {}
        self.private_estate = priv
        self.private_projects = (self.curated.get("private") or {}).get("projects") or {}
        self.location_rules = priv.get("location_rule") or []
        self.caveats = {c["pulse_id"]: c for c in priv.get("caveat") or [] if c.get("pulse_id")}
        pulse = (self.srcs.get("pulse") or {}).get("status") or {}
        self.pulse_rows = {row["id"]: row for row in pulse.get("rows") or []}
        self.pulse_at = pulse.get("generated_at")
        age = _age(now, self.pulse_at)
        self.pulse_ok = age is not None and age <= PULSE_STALE_S
        self.launchctl = self.srcs.get("launchctl") or {}
        self.registry = [s for s in (self.srcs.get("registry") or {}).get("services") or [] if s.get("id")]
        self.uncontaining = {self.home} | {os.path.realpath(safety.expand_locator(r, self.home))
                                           for r in safety.DISCOVERY_ROOTS}

    # ── checkouts and identity ──────────────────────────────────────────────

    def index_checkouts(self):
        for raw in self.census.get("checkouts") or []:
            co = json.loads(json.dumps(raw))
            card = co.get("card") or {}
            if card.get("text") is not None:
                self.card_text[co["id"]] = card["text"]
            co["card"] = {k: card.get(k) for k in ("present", "tracked", "text_sha256")}
            co.update(project_basis=None, presence="present", missing_since=None)
            self.co[co["id"]] = co
            self.by_real[os.path.realpath(co["path"])] = co["id"]
        prev_co = {r["id"]: r for r in _prev_records(self.prev) if r.get("kind") == "checkout"}
        self.prev_project_of = {cid: r.get("project_id") for cid, r in prev_co.items() if r.get("project_id")}

    def checkout_at(self, path):
        """The checkout id at path, matched by identity: the realpath string first, then the
        (device, inode) pair. APFS matches names case-insensitively while realpath keeps the case
        as written, so a roster path spelled KINGDOM-OS is the checkout census measured as kingdom-os."""
        if not isinstance(path, str) or not os.path.isabs(path):
            return None
        cid = self.by_real.get(os.path.realpath(path))
        if cid:
            return cid
        try:
            info = os.stat(path)
        except OSError:
            return None
        if self.by_inode is None:
            self.by_inode = {}
            for real, known in self.by_real.items():
                try:
                    seen = os.stat(real)
                except OSError:
                    continue
                self.by_inode.setdefault((seen.st_dev, seen.st_ino), known)
        return self.by_inode.get((info.st_dev, info.st_ino))

    def _project(self, pid):
        if pid not in self.projects:
            self.projects[pid] = {
                "kind": "project", "id": pid, "name": None, "aliases": [], "local": pid.startswith(LOCAL),
                "forge": None, "kingdom": None, "facets": {}, "display": {}, "display_src": {},
                "flags": {"resting": False, "checkout_present": False, "incidental": False,
                          "orphaned_curation": False},
                "claims": [], "measures": {}, "curated": None, "checkouts": [], "canonical_checkout": None,
                "canonical_basis": None, "group_ids": [], "family_id": None, "relations": [], "packages": [], "surfaces": [],
                "schedulers": [], "proposals": [], "legal_entity_id": None, "risks": [], "risk_detail": [],
                "risk_notes": [], "tag_expectations": [], "unmapped_tags": [], "freshness": {},
                "presence": "present", "missing_since": None, "observed_at": self.now_iso}
        return self.projects[pid]

    def _attach(self, cid, pid, basis):
        co = self.co[cid]
        co["project_id"], co["project_basis"] = pid, basis
        if pid is None:
            return
        self.co_project[cid] = pid
        self._project(pid)["checkouts"].append(cid)

    def _local_alias(self, co):
        base = os.path.basename(co["path"].rstrip("/")) or "root"
        if co.get("born") is False:
            digest = hashlib.sha256(os.path.realpath(co["path"]).encode("utf-8", "surrogateescape")).hexdigest()
            return "%s%s@p%s" % (LOCAL, base, digest[:8])
        if co.get("root_commit"):
            return "%s%s@%s" % (LOCAL, base, co["root_commit"][:12])
        return None

    def _forge_identity(self, co, alias_of):
        remotes = co.get("remotes")
        if remotes is None:
            return None, "unknown"
        ids = sorted(v for v in remotes.values() if v)
        for value in ids:
            if value in alias_of:
                return alias_of[value], "identity"
        order = (["origin"] if "origin" in remotes else []) + sorted(n for n in remotes if n != "origin")
        for name in order:
            value = remotes[name]
            if value and not value.startswith("file:"):
                return value, "remote"
        return None, ("file" if any(v.startswith("file:") for v in ids) else "none")

    def assign_projects(self):
        """Primary forge id per checkout (a curated [[identity]] alias wins, then origin, then the
        first remote sorted); a clone of a local path joins the project it was cloned from; no
        remote gives the local id, matched to private curation by id or by root-commit alias."""
        alias_of = {a: entry["id"] for entry in self.curated.get("identity") or [] for a in entry.get("aliases") or []}
        local_ids = {pid for pid in self.curated.get("projects") or {} if pid.startswith(LOCAL)}
        local_alias = {}
        for pid in local_ids:
            for alias in (self.curated["projects"][pid].get("aliases") or []):
                local_alias[alias] = pid
        file_index = {}
        for cid, co in self.co.items():
            for variant in (co["path"], co["path"] + "/", os.path.join(co["path"], ".git")):
                file_index["file:" + safety.sha12(variant)] = cid
        pending = []
        for cid in sorted(self.co):
            co = self.co[cid]
            pid, basis = self._forge_identity(co, alias_of)
            alias = self._local_alias(co)
            if pid is not None:
                self._attach(cid, pid, basis)
                if alias in local_alias:
                    self.queue.append({"reason": "local-forge-migration", "id": pid,
                                       "detail": "curation under %s now has a forge id" % local_alias[alias],
                                       "from": local_alias[alias]})
            elif basis == "file":
                pending.append(cid)
            elif basis == "unknown":
                previous = self.prev_project_of.get(cid)
                self._attach(cid, previous, "previous-run" if previous else "unknown")
            else:
                self._attach(cid, *self._local_identity(co, alias, local_ids, local_alias))
        for _ in range(2):  # a clone of a clone resolves on the second pass
            still = []
            for cid in pending:
                sources_ = [file_index.get(v) for v in sorted((self.co[cid].get("remotes") or {}).values()) if v]
                source = next((s for s in sources_ if s and s != cid and s in self.co_project), None)
                if source:
                    self._attach(cid, self.co_project[source], "file-remote")
                else:
                    still.append(cid)
            pending = still
        for cid in pending:
            co = self.co[cid]
            self._attach(cid, *self._local_identity(co, self._local_alias(co), local_ids, local_alias))

    def _local_identity(self, co, alias, local_ids, local_alias):
        ident = LOCAL + census.display_rel(co["path"], self.home)
        if ident in local_ids:
            return ident, "local"
        if alias and alias in local_alias:
            return local_alias[alias], "local-alias"
        return ident, "local"

    def forge_projects(self):
        repos = (self.srcs.get("forge") or {}).get("repos") or {}
        listings = (self.srcs.get("forge") or {}).get("listings") or []
        for pid, row in sorted(repos.items()):
            project = self._project(pid)
            listing = listings[row["listing"]] if isinstance(row.get("listing"), int) and row["listing"] < len(listings) else {}
            at = listing.get("mtime")
            project["forge"] = {
                "host": row.get("host"), "owner": row.get("owner"), "repo": row.get("name"), "listed": True,
                "visibility": {"v": row.get("visibility"), "at": at} if row.get("visibility") else None,
                "archived": row.get("archived"), "fork": row.get("fork"), "mirror": row.get("mirror"),
                "pushed_at": row.get("pushed_at"), "description": row.get("description"), "listing_at": at}
        for pid, project in self.projects.items():
            if project["forge"] is None and _is_forge(pid):
                host, owner, repo = _forge_parts(pid)
                project["forge"] = {"host": host, "owner": owner, "repo": repo, "listed": False, "visibility": None,
                                    "archived": None, "fork": None, "mirror": None, "pushed_at": None,
                                    "description": None, "listing_at": None}

    def curated_projects(self):
        self.local_aliases = {}
        for pid, row in sorted((self.curated.get("projects") or {}).items()):
            if pid not in self.projects and pid.startswith(LOCAL):
                # The curated local path may now be a checkout of a forge project (a remote was
                # added): the local id is that project's alias, not a second, empty record.
                cid = self.checkout_at(self._local_path(pid))
                owner = self.co_project.get(cid) if cid else None
                if owner and not owner.startswith(LOCAL):
                    self.local_aliases.setdefault(owner, []).append(pid)
                    self.queue.append({"reason": "local-forge-migration", "id": owner,
                                       "detail": "curation under %s now has a forge id" % pid, "from": pid})
                    continue
            if pid not in self.projects:
                self._project(pid)["flags"]["orphaned_curation"] = True
                self.queue.append({"reason": "orphaned-curation", "id": pid,
                                   "detail": "curated id matches no checkout and no forge listing"})
                if _is_forge(pid):
                    host, owner, repo = _forge_parts(pid)
                    self.projects[pid]["forge"] = {"host": host, "owner": owner, "repo": repo, "listed": False,
                                                   "visibility": None, "archived": None, "fork": None,
                                                   "mirror": None, "pushed_at": None, "description": None,
                                                   "listing_at": None}

    # ── canonical checkout and roles ────────────────────────────────────────

    def _matches(self, path, pattern):
        try:
            expanded = safety.expand_locator(pattern, self.home)
        except safety.GuardError:
            return False
        if any(ch in pattern for ch in "*?["):
            return fnmatch.fnmatchcase(path, expanded)
        return path == expanded or path.startswith(expanded.rstrip("/") + "/")

    def location_role(self, path):
        for rule in self.location_rules:
            if isinstance(rule.get("pattern"), str) and self._matches(path, rule["pattern"]):
                return rule.get("checkout_role")
        return None

    def containing_checkout(self, path):
        """The deepest checkout holding path. HOME and the discovery roots never own anything by
        containment: the home repository ignores everything it contains."""
        if not isinstance(path, str) or not os.path.isabs(path):
            return None
        target = os.path.normpath(path)
        best = None
        for real, cid in self.by_real.items():
            if real in self.uncontaining:
                continue
            if target == real or target.startswith(real + "/"):
                if best is None or len(real) > len(best[0]):
                    best = (real, cid)
        if best is None and os.path.isabs(target):
            real_target = os.path.realpath(target)
            if real_target != target:
                return self.containing_checkout(real_target)
        return best[1] if best else None

    def _scheduler_jobs(self):
        jobs = []
        for key in ("launchd", "crontab", "scheduler_json"):
            for job in (self.srcs.get(key) or {}).get("jobs") or []:
                jobs.append(job)
        return jobs

    def choose_canonical(self):
        overrides = {}
        for row in self.private_estate.get("canonical_override") or []:
            try:
                overrides[row["project"]] = os.path.realpath(safety.expand_locator(row["path"], self.home))
            except (KeyError, safety.GuardError):
                self.problems.append("canonical_override row without a usable project/path")
        targeted = set()
        for job in self._scheduler_jobs():
            for path in job.get("target_paths") or []:
                cid = self.containing_checkout(path)
                if cid:
                    targeted.add(cid)
        self.scheduler_targets = targeted
        self.location = {cid: self.location_role(co["path"]) for cid, co in self.co.items()}
        for pid, project in self.projects.items():
            cid, basis = self._canonical_for(pid, project, overrides.get(pid))
            project["canonical_checkout"], project["canonical_basis"] = cid, basis
        for cid, co in self.co.items():
            co["checkout_role"] = self._role(cid)

    def _rank_newest(self, cid):
        co = self.co[cid]
        seconds = epoch(co.get("last_commit_at"))
        return (bool(co.get("is_worktree")), -(seconds if seconds is not None else float("-inf")),
                len(co["path"]), co["path"])

    def _canonical_for(self, pid, project, override):
        present = [cid for cid in project["checkouts"] if self.co[cid].get("measure_status") != "gone-during-run"]
        if not present:
            return None, None
        if override:
            hit = [cid for cid in present if os.path.realpath(self.co[cid]["path"]) == override]
            if hit:
                return hit[0], "override"
            self.problems.append("canonical override for %s names no present checkout" % pid)
        targeted = [cid for cid in present if cid in self.scheduler_targets]
        if targeted:
            return sorted(targeted, key=self._rank_newest)[0], "scheduler-target"
        plain = [cid for cid in present if not self.co[cid].get("is_worktree") and not self.location.get(cid)]
        default = [cid for cid in plain if self.co[cid].get("branch") in DEFAULT_BRANCHES]
        if default:
            return sorted(default, key=self._rank_newest)[0], "default-branch-newest"
        pool = plain or present
        return sorted(pool, key=lambda c: (len(self.co[c]["path"]), self.co[c]["path"]))[0], "shortest-path"

    def _role(self, cid):
        co = self.co[cid]
        structural = co.get("checkout_role")
        if structural in ("gone-during-run", "linked-worktree", "submodule"):
            return structural
        pid = self.co_project.get(cid)
        if pid and self.projects[pid]["canonical_checkout"] == cid:
            return "canonical"
        if self.location.get(cid):
            return self.location[cid]
        if structural == "nested":
            return "nested"
        return "clone" if pid else None

    def read_repos(self, repo_reader):
        """Per-checkout sources for canonical checkouts only (or as handed in, keyed by checkout id)."""
        given = self.srcs.get("repo") or {}
        for pid, project in sorted(self.projects.items()):
            cid = project["canonical_checkout"]
            if cid is None:
                continue
            if repo_reader is None:
                if cid in given:
                    self.repo[cid] = given[cid]
                continue
            co = self.co[cid]
            if co.get("measure_status") not in census.OBSERVED_STATUSES:
                continue
            try:
                self.repo[cid] = repo_reader(dict(co, project_id=pid), pid)
            except Exception as exc:  # one unreadable checkout must not fail the build
                self.repo[cid] = {"schedules": {"jobs": [], "errors": [{"error": type(exc).__name__}]},
                                  "manifests": {"surfaces": [], "errors": [{"error": type(exc).__name__}]}}

    # ── KINGDOM ingest ──────────────────────────────────────────────────────

    def _name_index(self):
        index = {}
        for pid, project in self.projects.items():
            names = {_repo_name(pid)}
            curated_name = ((self.curated.get("projects") or {}).get(pid) or {}).get("name")
            if curated_name:
                names.add(curated_name.lower())
            for name in names:
                if name:
                    index.setdefault(name, set()).add(pid)
        return index

    def by_name(self, name):
        hits = self.name_index.get((name or "").lower(), set())
        if len(hits) == 1:
            return next(iter(hits))
        owners = ["%s/%s/" % (host, o) for host, key in (("github.com", "github"), ("codeberg.org", "codeberg"))
                  for o in (self.curated.get("owners") or {}).get(key) or []]
        with_checkout = sorted(p for p in hits if self.projects[p]["checkouts"])
        if len(with_checkout) == 1:
            return with_checkout[0]
        owned = sorted(p for p in hits if any(p.startswith(o) for o in owners))
        return owned[0] if len(owned) == 1 else None

    def kingdom_ingest(self):
        self.refs = {ref: data for ref, data in (self.foundation.get("refs") or {}).items()
                     if data.get("status") in ("ok", "partial") and data.get("card_enums")}
        if self.refs and self.primary not in self.refs:
            # The primary ref could not be read: the run says so and uses the ref it could read.
            self.authority["unreadable"] = self.primary
            self.primary = sorted(self.refs)[0]
        self.name_index = self._name_index()
        for ref, rules in self.refs.items():
            self._roster_join(ref, rules)
            self._fleet_join(ref, rules)
        self.known = {ref: self._known_names(ref) for ref in self.refs}
        primary = self.refs.get(self.primary) or (self.refs[sorted(self.refs)[0]] if self.refs else {})
        self.enums_primary = primary.get("card_enums") or {}
        wake = self.srcs.get("global_wake") or {}
        self.global_wake = wake.get("present") if wake else None
        for pid in sorted(self.projects):
            self._kingdom_project(pid, self.projects[pid])

    def _roster_join(self, ref, rules):
        roster = rules.get("roster")
        state = {"status": "ok" if roster is not None else "unreadable", "rows": [], "by_project": {}, "orphans": []}
        for row in (roster or {}).get("rows") or []:
            path = row.get("path") or ""
            cid = self.checkout_at(path)
            pid = self.co_project.get(cid) if cid else None
            status, candidates = ("ok" if pid else None), []
            if pid is None:
                pid = self.by_name(row.get("name"))
                if pid:
                    status = "elsewhere"
                else:
                    # Never "no project with that name" when several carry it, and never "no
                    # checkout at the path" when the path exists.
                    candidates = sorted(self.name_index.get((row.get("name") or "").lower(), set()))
                    if len(candidates) > 1:
                        status = "ambiguous"
                    elif os.path.isabs(path) and os.path.isdir(path):
                        status = "not-a-checkout"
                    else:
                        status = "missing"
            entry = dict(row, ref=ref, path_status=status, project_id=pid, candidates=candidates,
                         checkout_id=cid if status == "ok" else None)
            state["rows"].append(entry)
            if pid is None:
                state["orphans"].append(entry)
            elif pid in state["by_project"]:
                entry["duplicate_of_line"] = state["by_project"][pid]["line"]
            else:
                state["by_project"][pid] = entry
        self.roster[ref] = state

    def _fleet_join(self, ref, rules):
        citizens = rules.get("citizens_dir_path")
        members = {}
        if citizens:
            parents = {os.path.normpath(citizens), os.path.realpath(citizens)}
            for cid, co in sorted(self.co.items()):
                if os.path.dirname(co["path"]) in parents and (co.get("card") or {}).get("present"):
                    pid = self.co_project.get(cid)
                    if pid and pid not in members:
                        members[pid] = cid
        self.fleet[ref] = members

    def _known_names(self, ref):
        names = {(row.get("name") or "").lower() for row in self.roster[ref]["rows"]}
        for pid, cid in self.fleet[ref].items():
            names.add(os.path.basename(self.co[cid]["path"]).lower())
        return {n for n in names if n}

    def _parse(self, cid, ref, expected_name=None):
        text = self.card_text.get(cid) if cid else None
        if text is None:
            return None
        rules = self.refs[ref]
        return kingdom.parse_card(text, rules["card_enums"], rules, self.known[ref], expected_name)

    def _card_checkout(self, project):
        canonical = project["canonical_checkout"]
        if canonical and canonical in self.card_text:
            return canonical
        return next((cid for cid in sorted(project["checkouts"]) if cid in self.card_text), None)

    def _kingdom_project(self, pid, project):
        card_cid = self._card_checkout(project)
        canonical = project["canonical_checkout"]
        # A card read from any checkout counts; a canonical card that exists but could not be read
        # keeps card_present True with no parse, so standing says unknown rather than unlisted.
        present_card = True if card_cid else (self.co[canonical]["card"].get("present") if canonical else None)
        per_ref, views, cards, rosters = {}, {}, {}, {}
        for ref, rules in self.refs.items():
            roster_row = self.roster[ref]["by_project"].get(pid)
            card = self._parse(card_cid, ref, roster_row.get("name") if roster_row else None)
            fleet_cid = self.fleet[ref].get(pid)
            if fleet_cid:
                view = kingdom.harvest_view(self._parse(fleet_cid, ref), roster_row, self.co[fleet_cid]["path"],
                                            rules, self.known[ref])
            elif roster_row:
                row_card = self._parse(roster_row.get("checkout_id"), ref) if roster_row.get("path_status") == "ok" else None
                view = kingdom.harvest_view(row_card, roster_row, roster_row["path"], rules, self.known[ref])
            else:
                view = None
            per_ref[ref] = {field: resolve_field(field, card, roster_row, view, rules["card_enums"], self.decided["layer"])
                            for field in KINGDOM_FIELDS}
            views[ref], cards[ref], rosters[ref] = view, card, roster_row
        primary = self.primary if self.primary in per_ref else (sorted(per_ref)[0] if per_ref else None)
        card = cards.get(primary)
        conformance, wake_basis = self._conformance(canonical)
        project["kingdom"] = {
            "card_present": present_card, "card_checkout": card_cid,
            "card_tracked": self.co[card_cid]["card"].get("tracked") if card_cid else None,
            "card_text_sha256": self.co[card_cid]["card"].get("text_sha256") if card_cid else None,
            "card_text": self.card_text.get(card_cid) if card_cid else None,
            "card_raw": card["raw"] if card else None,
            "card_valid": card["valid"] if card else {},
            "card_schema_ok": card["schema_ok"] if card else None,
            "card_field_ok": (not any(d["code"] in CARD_FIELD_CODES for d in card["diagnostics"])) if card else None,
            "card_diagnostics": card["diagnostics"] if card else [],
            "off_enum": card["off_enum"] if card else {},
            "card_by_ref": {ref: None if c is None else {k: c[k] for k in ("valid", "off_enum", "schema_ok", "diagnostics")}
                            for ref, c in cards.items()},
            "roster_row": _roster_summary(rosters.get(primary)),
            "roster_by_ref": {ref: _roster_summary(r) for ref, r in rosters.items()},
            "harvest_view": {ref_key(ref): _view_summary(v) for ref, v in views.items()},
            "fleet_checkout": self.fleet.get(primary, {}).get(pid),
            "graph_entry": None, "registry_ids": [], "sites_keys": [],
            "conformance": conformance, "wake_basis": wake_basis, "ref": primary,
        }
        for field in KINGDOM_FIELDS:
            facet = combine_refs({ref: r[field] for ref, r in per_ref.items()}, self.primary,
                                 self.foundation.get("observed_at"), self.authority["decision"])
            if facet["status"] == "unset" and present_card is None and not project["checkouts"]:
                # unset says no claim exists; here no card could be read at all.
                facet["note"] = "no checkout here, so no card was read"
            project["facets"][field] = facet

    def _conformance(self, cid):
        """harvest checkConformance on the canonical checkout; a record with no checkout is not
        conformant at all (harvest: not a directory), whatever the global wake says."""
        if cid is None:
            return {"card": False, "claudeMd": False, "wake": False, "fate": False}, "none"
        co = self.co[cid]
        markers = co.get("wake_markers") or {}
        local = [("wake-md", markers.get("wake_md")), ("hook-file", markers.get("hook_file")),
                 ("session-start", markers.get("session_start"))]
        basis = next((name for name, hit in local if hit is True), None)
        if basis is None:
            basis = "global" if self.global_wake else "none"
        return {"card": bool((co.get("card") or {}).get("present")), "claudeMd": bool(co.get("has_claude_md")),
                "wake": basis != "none", "fate": bool(co.get("fate"))}, basis

    def kingdom_claims(self):
        """REGISTRY repo claims, sites.json keys and the graph.json entry onto projects."""
        self.registry_project = {}
        for entry in self.registry:
            pid = self.repo_claim(entry.get("repo"))
            self.registry_project[entry["id"]] = pid
            if pid in self.projects:
                self.projects[pid]["kingdom"]["registry_ids"].append(entry["id"])
        self.sites = []
        for door in (self.srcs.get("sites") or {}).get("doors") or []:
            pid = self.by_name(door.get("repo"))
            self.sites.append(dict(door, project_id=pid))
            if pid:
                self.projects[pid]["kingdom"]["sites_keys"].append(door["repo"])
        graph = self.srcs.get("graph") or {}
        at = (graph.get("dated") or {}).get("graph_mtime")
        for entry in graph.get("entries") or []:
            cid = self.checkout_at(entry.get("path"))
            pid = self.co_project.get(cid) if cid else self.by_name(entry.get("name"))
            if pid and self.projects[pid]["kingdom"]["graph_entry"] is None:
                self.projects[pid]["kingdom"]["graph_entry"] = dict(
                    {k: entry.get(k) for k in ("name", "kind", "layer", "state", "hasCard")}, ref="graph.json", at=at)

    def repo_claim(self, text):
        """A REGISTRY repo claim ("github.com/o/r@main", "codeberg.org/o/r (core)") as a project id."""
        if not isinstance(text, str) or not text.strip():
            return None
        core = re.split(r"[@\s(]", text.strip(), maxsplit=1)[0]
        ident = safety.normalize_remote("https://" + core) if "://" not in core else safety.normalize_remote(core)
        if ident is None:
            return None
        alias_of = {a: e["id"] for e in self.curated.get("identity") or [] for a in e.get("aliases") or []}
        return alias_of.get(ident, ident)

    # ── schedulers ──────────────────────────────────────────────────────────

    def _caveat(self, pulse_id, observed):
        cav = self.caveats.get(pulse_id)
        if not cav:
            return None
        result, detail = self._check(cav)
        check = cav.get("check")
        # effect "annotate" keeps the observation and only explains it (an exit that is not a
        # success, but is not the failure it looks like either); the default contradicts it.
        effect = cav.get("effect") or "contradict"
        contradicts = effect == "contradict" and (
            (result is False and observed == "up" and check in ("dir-nonempty", "file-mtime-within"))
            or (result is True and observed == "down" and check == "exit-code-equals"))
        return {"id": cav.get("id"), "check": check, "result": result, "detail": detail, "effect": effect,
                "contradicts": contradicts, "note": cav.get("note")}

    def _check(self, cav):
        """One cheap local caveat check: (True|False|None, detail). Nothing is opened for reading."""
        args = cav.get("args") or {}
        check = cav.get("check")
        if check == "exit-code-equals":
            if self.launchctl.get("status") != "ok":
                return None, "launchctl %s" % self.launchctl.get("status")
            job = (self.launchctl.get("jobs") or {}).get(args.get("label"))
            if job is None or job.get("last_exit") is None:
                return None, "no last exit for the label"
            return job["last_exit"] == args.get("code"), "last exit %s" % job["last_exit"]
        try:
            path = safety.expand_locator(args.get("path") or "", self.home)
            info = os.lstat(path)
        except (safety.GuardError, TypeError):
            return None, "caveat has no usable path"
        except FileNotFoundError:
            return False, "path missing"
        except OSError as exc:
            return None, "lstat failed: %s" % exc.strerror
        if check == "dir-nonempty":
            if not os.path.isdir(path) or os.path.islink(path):
                return None, "not a plain directory (links are not followed)"
            return holds_regular_file(path)
        if check == "file-mtime-within":
            within = args.get("within_s")
            if not isinstance(within, int):
                return None, "within_s missing"
            return (self.now.timestamp() - info.st_mtime) <= within, "mtime age %ds" % int(self.now.timestamp() - info.st_mtime)
        return None, "unknown check %r" % check

    def _registry_by_runtime(self):
        index = {}
        for entry in self.registry:
            if isinstance(entry.get("runtime"), str):
                index.setdefault(entry["runtime"], []).append(entry)
        return index

    def build_schedulers(self):
        by_runtime = self._registry_by_runtime()
        for job in (self.srcs.get("launchd") or {}).get("jobs") or []:
            reg = (by_runtime.get("local-launchd:%s" % job.get("label")) or [None])[0]
            self._scheduler(job, self._launchd_health(job), reg, job.get("log"))
        for job in (self.srcs.get("crontab") or {}).get("jobs") or []:
            self._scheduler(job, {"state": "unknown", "basis": "cron keeps no run result", "at": self.now_iso}, None, None)
        for job in (self.srcs.get("scheduler_json") or {}).get("jobs") or []:
            self._scheduler(job, self._hermes_health(job), None, None)
        for cid, repo in sorted(self.repo.items()):
            for job in ((repo or {}).get("schedules") or {}).get("jobs") or []:
                reg = None
                if job.get("mechanism") == "cf-cron":
                    reg = (by_runtime.get("cf-worker:%s" % job.get("label")) or [None])[0]
                health = dict(job.get("health") or {"state": "unknown", "basis": "no run history read"}, at=self.now_iso)
                self._scheduler(job, health, reg, None, cid)

    def _launchd_health(self, job):
        if job.get("disabled") is True:
            return {"state": "disabled", "basis": "Disabled in the plist", "at": self.now_iso}
        if self.launchctl.get("status") != "ok":
            return {"state": "unknown", "basis": "launchctl %s" % self.launchctl.get("status"), "at": self.now_iso}
        entry = (self.launchctl.get("jobs") or {}).get(job.get("label"))
        if entry is None:
            return {"state": "unknown", "basis": "not loaded in launchctl", "at": self.now_iso}
        # A live pid is the job running now; the last exit belongs to an earlier instance (a
        # KeepAlive job killed by a signal and restarted reports -15 or -9 while it runs).
        if isinstance(entry.get("pid"), int):
            previous = entry.get("last_exit")
            return {"state": "healthy", "basis": "running (pid %d)%s" % (
                entry["pid"], "; previous exit %s" % previous if previous not in (None, 0) else ""), "at": self.now_iso}
        if entry.get("last_exit") is None:
            return {"state": "unknown", "basis": "no last exit", "at": self.now_iso}
        state = "healthy" if entry["last_exit"] == 0 else "failing"
        return {"state": state, "basis": "launchctl last exit %s (not running)" % entry["last_exit"]
                if state == "failing" else "launchctl last exit 0", "at": self.now_iso}

    def _hermes_health(self, job):
        if job.get("enabled") is False:
            return {"state": "disabled", "basis": "enabled = false", "at": self.now_iso}
        status = (job.get("last_status") or "").lower()
        if status in ("ok", "success", "succeeded"):
            return {"state": "healthy", "basis": "last_status " + status, "at": job.get("last_run_at") or self.now_iso}
        if status in ("error", "failed", "failure"):
            return {"state": "failing", "basis": "last_status " + status, "at": job.get("last_run_at") or self.now_iso}
        return {"state": "unknown", "basis": "no last status", "at": self.now_iso}

    def _scheduler(self, job, health, reg, log, cid=None):
        if cid is None:
            hits = [self.containing_checkout(p) for p in job.get("target_paths") or []]
            cid = next((h for h in hits if h), None)
        pid = self.co_project.get(cid) if cid else None
        reg_id = reg["id"] if reg else None
        pulse = self.pulse_rows.get(reg_id) if reg_id else None
        tcc, tcc_basis = job.get("tcc_exposed"), "no visible target is under Desktop, Documents or Downloads"
        outside = [p for p in job.get("script_paths") or [] if not self.containing_checkout(p)]
        if tcc is True:
            tcc_basis = "a visible target is under Desktop, Documents or Downloads"
        elif outside:
            # A wrapper script outside every checkout may cd anywhere; its targets are not read.
            tcc, tcc_basis = None, "unknown: runs %s, a script outside any checkout" % os.path.basename(outside[0])
        record = {
            "kind": "scheduler", "id": job["id"], "mechanism": job.get("mechanism"), "label": job.get("label"),
            "schedule": job.get("schedule"), "program_basename": job.get("program_basename"),
            "script_basename": job.get("script_basename"), "target_checkout": cid, "project_id": pid,
            "registry_id": reg_id, "watched_by_pulse": bool(pulse), "tcc_exposed": tcc, "tcc_basis": tcc_basis,
            "attribution": job.get("attribution"), "source_file": job.get("source_file"),
            "health": dict(health, caveat=None), "pulse": None, "log": log, "presence": "present",
            "missing_since": None, "observed_at": self.now_iso}
        if pulse:
            record["pulse"] = {"observed": pulse.get("observed"), "code": pulse.get("code"), "at": self.pulse_at}
            record["health"]["caveat"] = self._caveat(reg_id, pulse.get("observed"))
        if record["id"] in self.schedulers:
            self.problems.append("scheduler id %s seen twice; the first is kept" % record["id"])
            return
        self.schedulers[record["id"]] = record
        if pid:
            self.projects[pid]["schedulers"].append(record["id"])

    # ── surfaces ────────────────────────────────────────────────────────────

    def _surface(self, sid, provider, name):
        if sid not in self.surfaces:
            self.surfaces[sid] = {
                "kind": "surface", "id": sid, "provider": provider, "name": name, "hostnames": [],
                "audience": None, "registry": None, "health": None, "source_project": None,
                "attribution": {"class": "unresolved", "evidence": []}, "competing_sources": [],
                "portfolio_resource_id": None, "attribution_v1": None, "zone_ids": [], "legal_entity_id": None,
                "curated": False, "dispute": None, "presence": "present", "missing_since": None,
                "observed_at": self.now_iso, "_claims": []}
        return self.surfaces[sid]

    def _claim(self, surface, pid, cls, evidence):
        surface["_claims"].append((pid, cls))
        surface["attribution"]["evidence"].append(dict(evidence, project=pid, attribution=cls))

    def build_surfaces(self):
        curated_by_name = {}
        for row in self.curated.get("surfaces") or []:
            s = self._surface(row["id"], row.get("provider"), row.get("name"))
            s["curated"] = True
            s["hostnames"] = sorted(set(s["hostnames"]) | set(row.get("hostnames") or []))
            curated_by_name.setdefault(row.get("name"), row["id"])
            if row.get("source_project"):
                self._claim(s, self._canon(row["source_project"]), "current_source_document",
                            {"kind": "curated", "locator": CURATED_ESTATE, "note": row.get("source", "curated")})
            for other in row.get("competing_sources") or []:
                self._claim(s, self._canon(other), "candidate_only",
                            {"kind": "curated-competing", "locator": CURATED_ESTATE, "note": "competing source"})
        self.registry_surface = {}
        for entry in self.registry:
            prefix = entry.get("runtime_prefix")
            if prefix == "local-launchd":
                continue  # a LaunchAgent: joined to its scheduler record
            sid = curated_by_name.get(entry["id"]) or "surface:%s:%s" % (prefix or "unknown", entry["id"])
            s = self._surface(sid, prefix, entry["id"])
            s["registry"] = {"id": entry["id"], "expected_status": entry.get("status"),
                             "runtime_claim": entry.get("runtime"), "repo_claim": entry.get("repo"),
                             "expect": entry.get("expect")}
            urls = entry.get("urls")
            values = urls.values() if isinstance(urls, dict) else (urls if isinstance(urls, list) else [])
            s["hostnames"] = sorted(set(s["hostnames"]) | {h for h in (host_of(u) for u in values) if h})
            pid = self.registry_project.get(entry["id"])
            if pid:
                self._claim(s, pid, "current_source_document",
                            {"kind": "registry", "locator": "REGISTRY.yaml#" + entry["id"], "note": "repo claim"})
            self.registry_surface[entry["id"]] = sid
        self._manifest_surfaces()
        self._portfolio_surfaces()
        self._inventory_audience()
        self._disputed_surfaces()
        for sid in sorted(self.surfaces):
            self._finish_surface(self.surfaces[sid])

    def _disputed_surfaces(self):
        """An open curated dispute about which source serves a surface keeps that surface
        unsettled: every forge candidate competes, and no curated row settles it silently."""
        for dispute in self.curated.get("disputes") or []:
            if dispute.get("status") != "open":
                continue
            for sid in dispute.get("surfaces") or []:
                s = self.surfaces.get(sid)
                if s is None:
                    continue
                s["dispute"] = dispute.get("id")
                for cand in dispute.get("candidates") or []:
                    if _is_forge(cand.get("claim")):
                        self._claim(s, self._canon(cand["claim"]), "candidate_only",
                                    {"kind": "dispute", "locator": CURATED_ESTATE, "note": dispute.get("id")})

    def _canon(self, ident):
        alias_of = {a: e["id"] for e in self.curated.get("identity") or [] for a in e.get("aliases") or []}
        return alias_of.get(ident, ident)

    def _manifest_surfaces(self):
        by_runtime = self._registry_by_runtime()
        for cid, repo in sorted(self.repo.items()):
            pid = self.co_project.get(cid)
            for m in ((repo or {}).get("manifests") or {}).get("surfaces") or []:
                targets = [self.registry_surface[e["id"]] for e in by_runtime.get("%s:%s" % (m.get("hosting"), m.get("name")), [])
                           if e["id"] in self.registry_surface] if m.get("name") else []
                if not targets:
                    targets = [sid for sid, s in sorted(self.surfaces.items()) if s["curated"] and s["provider"] == m.get("hosting")
                               and ((m.get("name") and s["name"] == m.get("name")) or set(s["hostnames"]) & set(m.get("hostnames") or []))]
                if not targets:
                    targets = [m["id"]]
                for sid in targets:
                    s = self._surface(sid, m.get("hosting"), m.get("name"))
                    s["hostnames"] = sorted(set(s["hostnames"]) | set(m.get("hostnames") or []))
                    self._claim(s, pid, m.get("attribution") or "candidate_only",
                                {"kind": "manifest", "locator": "%s:%s" % (self.co[cid]["rel"], m.get("source_file")),
                                 "note": "tracked" if m.get("tracked") else "untracked or unknown"})

    def _portfolio_surfaces(self):
        by_runtime = self._registry_by_runtime()
        for ps in (self.srcs.get("portfolio") or {}).get("surfaces") or []:
            provider = PORTFOLIO_KINDS.get(ps.get("kind"))
            name = ps.get("name")
            if not provider or not name:
                continue
            targets = [self.registry_surface[e["id"]] for e in by_runtime.get("%s:%s" % (provider, name), [])
                       if e["id"] in self.registry_surface]
            if not targets:
                targets = [sid for sid, s in sorted(self.surfaces.items()) if s["provider"] == provider and s["name"] == name]
            if not targets:
                targets = ["surface:%s:%s" % (provider, name)]
            repo = ps.get("repository")
            pid = self._canon("github.com/" + repo.lower()) if isinstance(repo, str) and "/" in repo and "://" not in repo else None
            for sid in targets:
                s = self._surface(sid, provider, name)
                s["portfolio_resource_id"] = ps.get("resource_id")
                s["attribution_v1"] = ps.get("attribution")
                # The map's custom domains and routes: what puts a worker in its zone (build_zones).
                s["hostnames"] = sorted(set(s["hostnames"]) | set(ps.get("hostnames") or []))
                if pid:
                    self._claim(s, pid, "historical_source_evidence",
                                {"kind": "portfolio-map/1", "locator": ps.get("portfolio_id"), "note": "v1 " + str(ps.get("attribution"))})

    def _inventory_audience(self):
        inventory = self.srcs.get("cf_inventory") or {}
        audience = {row.get("name"): row.get("audience") for row in inventory.get("surfaces") or [] if row.get("name")}
        for s in self.surfaces.values():
            if s["name"] in audience:
                s["audience"] = audience[s["name"]]

    def _finish_surface(self, s):
        # A claim naming a project this estate does not know stays evidence only; the surface is
        # never pinned to an id that no record carries.
        raw = [(pid, cls) for pid, cls in s.pop("_claims") if pid]
        s["unresolved_projects"] = sorted({pid for pid, _ in raw if pid not in self.projects})
        claims = [(pid, cls) for pid, cls in raw if pid in self.projects]
        if claims and s.get("dispute"):
            s["attribution"]["class"] = "candidate_only"
            s["competing_sources"] = sorted({pid for pid, _ in claims})
        elif claims:
            best = min((cls for _, cls in claims), key=lambda c: ATTRIBUTION_ORDER.index(c) if c in ATTRIBUTION_ORDER else 99)
            best_pids = sorted({pid for pid, cls in claims if cls == best})
            others = sorted({pid for pid, _ in claims} - set(best_pids))
            if best in CURRENT + ("historical_source_evidence",) and len(best_pids) == 1:
                s["source_project"], s["attribution"]["class"] = best_pids[0], best
                s["competing_sources"] = others
            else:
                s["attribution"]["class"] = "candidate_only"
                s["competing_sources"] = sorted(set(best_pids) | set(others))
        for pid in [s["source_project"]] + s["competing_sources"]:
            if pid in self.projects and s["id"] not in self.projects[pid]["surfaces"]:
                self.projects[pid]["surfaces"].append(s["id"])
        s["health"] = self._surface_health(s)

    def _surface_health(self, s):
        reg_id = (s["registry"] or {}).get("id")
        if not self.pulse_ok:
            return {"state": "unknown", "code": None, "at": self.pulse_at, "src": "src:pulse",
                    "caveat": None, "basis": "pulse missing or older than 24 h"}
        row = self.pulse_rows.get(reg_id) if reg_id else None
        if row is None:
            return {"state": "unprobed", "code": None, "at": self.pulse_at, "src": "src:pulse", "caveat": None,
                    "basis": "no pulse row"}
        observed = row.get("observed")
        state = observed if observed in ("up", "down") else "unknown"
        caveat = self._caveat(reg_id, observed)
        if caveat and caveat["contradicts"]:
            state = "contradicted"
        return {"state": state, "code": row.get("code"), "at": self.pulse_at, "src": "src:pulse",
                "caveat": caveat, "basis": "pulse observed %s" % observed}

    # ── zones ───────────────────────────────────────────────────────────────

    def _zone(self, fqdn):
        zid = "zone:" + fqdn
        if zid not in self.zones:
            self.zones[zid] = {"kind": "zone", "id": zid, "fqdn": fqdn, "dns_provider": "unknown",
                               "registrar": "unknown", "email_routing": None, "purpose": None, "owner_project": None,
                               "surfaces": [], "portfolio_id": None, "legal_entity_id": None, "seen_in": [],
                               "presence": "present", "missing_since": None, "observed_at": self.now_iso}
        return self.zones[zid]

    def registrable(self, host):
        host = (host or "").lower().strip(".")
        if not host or "." not in host or re.fullmatch(r"[\d.]+", host):
            return None
        curated = sorted((z["fqdn"] for z in self.curated.get("zones") or [] if z.get("fqdn")), key=len, reverse=True)
        for fqdn in curated:
            if host == fqdn or host.endswith("." + fqdn):
                return fqdn
        labels = host.split(".")
        size = 3 if ".".join(labels[-2:]) in MULTI_LABEL_SUFFIXES else 2
        apex = ".".join(labels[-size:])
        return None if apex in curate.SHARED_APEX or apex in PROVIDER_APEX else apex

    def build_zones(self):
        cloudflare = set((self.srcs.get("observer") or {}).get("zone_names") or [])
        cloudflare |= set((self.srcs.get("cf_inventory") or {}).get("zones") or [])
        for row in self.curated.get("zones") or []:
            z = self._zone(row["fqdn"])
            z["seen_in"].append("curated")
            for key in ("dns_provider", "registrar", "purpose", "email_routing"):
                if row.get(key) not in (None, "unknown"):
                    z[key] = row[key]
            owner = row.get("owner_project")
            if owner:
                z["owner_project"] = owner if owner in self.projects else None
                z["owner_project_claim"] = owner
            for sid in row.get("surfaces") or []:
                if sid in self.surfaces and sid not in z["surfaces"]:
                    z["surfaces"].append(sid)
                    if z["id"] not in self.surfaces[sid]["zone_ids"]:
                        self.surfaces[sid]["zone_ids"].append(z["id"])
        for pz in (self.srcs.get("portfolio") or {}).get("zones") or []:
            if isinstance(pz.get("name"), str):
                z = self._zone(pz["name"].lower())
                z["portfolio_id"] = pz.get("portfolio_id")
                z["seen_in"].append("portfolio-map/1")
                cloudflare.add(pz["name"].lower())
        for name in sorted(cloudflare):
            self._zone(name)["seen_in"].append("cloudflare")
        for z in self.zones.values():
            if z["dns_provider"] == "unknown" and z["fqdn"] in cloudflare:
                z["dns_provider"] = "cloudflare"
        for sid, s in sorted(self.surfaces.items()):
            for host in s["hostnames"]:
                apex = self.registrable(host)
                if not apex:
                    continue
                z = self._zone(apex)
                if sid not in z["surfaces"]:
                    z["surfaces"].append(sid)
                if z["id"] not in s["zone_ids"]:
                    s["zone_ids"].append(z["id"])
        for z in self.zones.values():
            z["seen_in"] = sorted(set(z["seen_in"]) | ({"surfaces"} if z["surfaces"] else set()))
            z["surfaces"].sort()

    # ── groups, families, relations, artifacts ──────────────────────────────

    def build_groups(self):
        for gid, row in sorted((self.curated.get("groups") or {}).items()):
            private = row.get("private") or {}
            rule = row.get("member_rule") or private.get("member_rule") or {}
            members, member_kind, count, note = self._members(rule)
            group = {
                "kind": "group", "id": gid, "label": row.get("label") or private.get("label"),
                # The views are private: the full survey text before the scrubbed committed one.
                "family_id": row.get("family_id"), "what": private.get("what_full") or row.get("what"),
                "role": row.get("role") or private.get("role") or [], "role_status": row.get("role_status") or private.get("role_status"),
                "member_rule": rule, "members": members, "member_kind": member_kind,
                "count_at_survey": row.get("count_at_survey", private.get("count_at_survey")),
                "count_now": count, "delta": None, "member_note": note, "kingdom_claims": {},
                "canonical_location": private.get("canonical_location"), "committed": bool(row.get("committed")),
                "presence": "present", "missing_since": None, "observed_at": self.now_iso}
            if isinstance(count, int) and isinstance(group["count_at_survey"], int):
                group["delta"] = count - group["count_at_survey"]
            self.groups[gid] = group
            projects = members if member_kind == "project" else (
                [self.co_project[c] for c in members if c in self.co_project] if member_kind == "checkout" else [])
            group["member_projects"] = sorted(set(projects))
            for pid in group["member_projects"]:
                if gid not in self.projects[pid]["group_ids"]:
                    self.projects[pid]["group_ids"].append(gid)

    def _members(self, rule):
        """(members, member kind, count now, note). names and forge-glob rules hold projects,
        repo-subpath rules hold sub-paths of the repository's canonical checkout, and private
        path-glob rules hold checkouts (or plain paths that exist but are not checkouts)."""
        kind = rule.get("kind")
        if kind == "names":
            names = [n for n in rule.get("names") or [] if isinstance(n, str)]
            found = sorted(n for n in names if n in self.projects)
            return found, "project", len(found), "%d of %d names present" % (len(found), len(names))
        if kind == "forge-glob":
            pattern = rule.get("pattern") or ""
            found = sorted(pid for pid in self.projects if fnmatch.fnmatchcase(pid, pattern))
            return found, "project", len(found), None
        if kind == "repo-subpath":
            project = self.projects.get(self._canon(rule.get("repo") or ""))
            cid = project["canonical_checkout"] if project else None
            if cid is None:
                return [], "subpath", None, "repository has no canonical checkout here"
            root = self.co[cid]["path"]
            found = [n for n in rule.get("names") or [] if os.path.lexists(os.path.join(root, n))]
            return found, "subpath", len(found), None
        if kind == "path-glob":
            found = set()
            for pattern in rule.get("patterns") or []:
                hits = [cid for cid, co in self.co.items() if self._matches(co["path"], pattern)]
                if hits:
                    found |= set(hits)
                elif not any(ch in pattern for ch in "*?["):
                    try:
                        if os.path.lexists(safety.expand_locator(pattern, self.home)):
                            found.add(pattern)
                    except safety.GuardError:
                        continue
            return sorted(found), "checkout", len(found), None
        return [], None, None, "member rule kind %r is not understood" % kind

    def build_packages(self):
        """The package records of every host repository a [[host]] row names (packages.py), from what
        read_repos read in its canonical checkout. A host this run did not read is summarised with the
        reason and gives no records: its packages of the previous run are carried as missing
        (reconcile), never read as empty."""
        rows, self.package_problems = packages.host_rows(self.curated)
        for host in sorted(rows):
            project = self.projects.get(host)
            cid = (project or {}).get("canonical_checkout")
            source = (self.repo.get(cid) or {}) if cid else {}
            read, listing = source.get("packages"), source.get("build_list")
            reason = ("no project of this run has this forge id" if project is None
                      else "the project has no canonical checkout here" if cid is None
                      else "its canonical checkout was not read for packages" if read is None else None)
            found = packages.records(host, read, listing, self.now_iso, self.groups) if (read or {}).get("status") == "ok" else {}
            self.packages.update(found)
            if project is not None:
                project["packages"] = sorted(found)
            summary = packages.host_summary(host, read, listing, found, reason)
            self.hosts.append(summary)
            names = (summary.get("build_list") or {}).get("unmatched") or []
            if names:
                self.package_problems.append("packages: the quarantine list of %s names %s, no package of its "
                                             "checkout" % (host, ", ".join(names)))
            self.package_problems += ["packages: the quarantine list of %s: %s" % (host, p)
                                      for p in (listing or {}).get("problems") or []]

    def build_families(self):
        for fid, row in sorted((self.curated.get("families") or {}).items()):
            private = row.get("private") or {}
            self.families[fid] = {
                "kind": "family", "id": fid, "label": row.get("label"), "summary": row.get("summary"),
                "open_questions": row.get("open_questions") or [], "as_of": row.get("as_of"),
                "review_after": row.get("review_after"), "reviewed": row.get("reviewed"), "source": row.get("source"),
                "heavy": bool(row.get("heavy")), "sphere": row.get("sphere"), "summary_full": private.get("summary_full"),
                "drift": private.get("drift") or [], "nongit_paths": private.get("nongit_paths") or [],
                "projects_n": 0, "presence": "present", "missing_since": None, "observed_at": self.now_iso}

    def _relation(self, frm, verb, to, basis, raw_kind=None, note=None, src=None, channel=None):
        """The id of the relation frm verb to, created or given one more basis. A wire's channel is part of
        its id, so two wires between the same ends over different channels stay two relations."""
        key = "%s|%s|%s" % (frm, verb, to) + ("|%s:%s" % (channel["kind"], channel["name"]) if channel else "")
        rid = "rel:" + safety.sha12(key)
        if rid in self.relations:
            if basis not in self.relations[rid]["also"] and basis != self.relations[rid]["basis"]:
                self.relations[rid]["also"].append(basis)
            return rid
        self.relations[rid] = {"kind": "relation", "id": rid, "from": frm, "verb": verb, "to": to, "basis": basis,
                               "also": [], "raw_kind": raw_kind or verb, "note": note, "src": src,
                               "at": self.now_iso, "presence": "present", "missing_since": None,
                               "observed_at": self.now_iso}
        return rid

    def _known_end(self, ident):
        return ident in self.projects or ident in self.groups or ident in self.packages

    def _attach_relations(self):
        """List every relation on the project and package records at its ends."""
        for rid, rel in self.relations.items():
            for end in (rel["from"], rel["to"]):
                record = self.projects.get(end) or self.packages.get(end)
                if record is not None and rid not in record["relations"]:
                    record["relations"].append(rid)

    def build_relations(self):
        for pid, row in sorted((self.curated.get("projects") or {}).items()):
            for edge in row.get("relations") or []:
                frm, to = edge.get("from") or pid, edge.get("to")
                if not (self._known_end(frm) and self._known_end(to)):
                    self.queue.append({"reason": "orphaned-curation", "id": pid,
                                       "detail": "relation %s %s -> %s has an end that resolves to nothing"
                                                 % (edge.get("verb"), frm, to)})
                    continue
                self._relation(frm, edge.get("verb"), to, "curated", edge.get("raw_kind"), edge.get("note"), "src:curated")
        for pid, project in sorted(self.projects.items()):
            for dep in ((project["kingdom"] or {}).get("card_valid") or {}).get("dependsOn") or []:
                other = self._roster_or_name(dep)
                if other and other != pid:
                    self._relation(pid, "depends_on", other, "card-dependsOn", "dependsOn", None, "src:kingdom:" + self.primary)
        for cid, co in sorted(self.co.items()):
            pid = self.co_project.get(cid)
            if not pid:
                continue
            ends = [("borrows_objects_from", self.checkout_at(p)) for p in co.get("alternates") or []]
            ends.append(("nested_in", self.checkout_at(co.get("nested_in"))))
            ends.append(("submodule_of", self.checkout_at(co.get("submodule_of"))))
            ends.append(("worktree_of", self.checkout_at(co.get("hub"))))
            for verb, other_cid in ends:
                other = self.co_project.get(other_cid) if other_cid else None
                if other and other != pid:
                    self._relation(pid, verb, other, "measured-git", verb, None, "src:census")
        self._attach_relations()

    def _roster_or_name(self, name):
        for ref in (self.primary,) + tuple(r for r in self.roster if r != self.primary):
            for row in (self.roster.get(ref) or {}).get("rows") or []:
                if (row.get("name") or "").lower() == (name or "").lower() and row.get("project_id"):
                    return row["project_id"]
        return self.by_name(name)

    def build_artifacts(self):
        for art in self.census.get("artifacts") or []:
            record = dict(art)
            record.update(presence="present", missing_since=None, family_id=None, status="present")
            self.artifacts[record["id"]] = record
        observed = {a.get("id"): a for a in self.srcs.get("artifacts") or [] if a.get("id")}
        for row in self.private_estate.get("artifact") or []:
            seen = observed.get(row["id"]) or {}
            path = seen.get("path")
            owner = self.co_project.get(self.containing_checkout(path)) if path else None
            family = "family:" + row["family"] if row.get("family") else None
            self.artifacts[row["id"]] = {
                "kind": "artifact", "id": row["id"], "path": path or row.get("path"), "artifact_kind": row.get("artifact_kind"),
                "owner_project": owner, "family_id": family if family in self.families else None, "family_claim": family,
                "label": row.get("what"), "role": row.get("role"), "size": seen.get("size"), "mtime": seen.get("mtime"),
                "mode": seen.get("mode"), "type": seen.get("type"), "status": seen.get("status") or "not-observed",
                "secret_bearing": row.get("secret_bearing"), "contents_read": False, "backup": row.get("backup") or "unknown",
                "presence": "present", "missing_since": None, "observed_at": self.now_iso}

    def build_accounts(self):
        self.accounts = {}
        for row in self.private_estate.get("account") or []:
            self.accounts[row["id"]] = {
                "kind": "account", "id": row["id"], "provider": row.get("provider"), "label": row.get("label"),
                "purpose": row.get("purpose"), "used_by": row.get("used_by") or [],
                "credential_artifacts": row.get("credential_artifacts") or [], "owns": [], "decided_status": None,
                "presence": "present", "missing_since": None, "observed_at": self.now_iso}

    def owner_effects(self):
        """Owner decisions that attribute records to the estate's own provider accounts, or give a
        provider a status (decisions.rules). A named record this run did not observe is listed on
        the account as unobserved; a provider with no single account row is reported, not guessed."""
        accounts = list(self.accounts.values())
        self.ownership = []
        for rule in self.decided["ownership"]:
            account = decisions.account_for(rule["provider"], accounts)
            if account is None:
                self.problems.append("owner decision %s names the estate's %s account, but the private curation "
                                     "has no single account row for that provider" % (rule["decision"], rule["provider"]))
            for rid in rule["ids"]:
                record = self.surfaces.get(rid) or self.zones.get(rid)
                entry = {"id": rid, "decision": rule["decision"], "basis": rule["basis"], "observed": record is not None}
                if record is not None:
                    record["account"] = {"id": account["id"] if account else None, "provider": rule["provider"],
                                         "decision": rule["decision"], "basis": rule["basis"]}
                if account is not None:
                    account["owns"].append(entry)
                self.ownership.append(dict(entry, account=account["id"] if account else None, provider=rule["provider"]))
        for provider, status in sorted(self.decided["provider_status"].items()):
            for account in accounts:
                if account["provider"] == provider:
                    account["decided_status"] = dict(status, provider=provider)

    def decided_record_status(self):
        """{record id: decided status} for every record tied to an account a provider status covers:
        the account itself, its credential artifacts and what it uses or owns."""
        out = {}
        for account in self.accounts.values():
            status = account.get("decided_status")
            if not status:
                continue
            ids = [account["id"]] + list(account["credential_artifacts"]) + list(account["used_by"])
            ids += [item["id"] for item in account["owns"]]
            for rid in ids:
                out.setdefault(rid, {"status": status["status"], "decision": status["decision"],
                                     "provider": status["provider"], "account": account["id"]})
        return out

    def other_records(self):
        out = []
        for row in self.private_estate.get("device") or []:
            out.append({"kind": "device", "id": row["id"], "label": row.get("label"), "device_kind": row.get("kind"),
                        "role": row.get("role"), "status": row.get("status"), "evidence": row.get("evidence"),
                        "presence": "present", "missing_since": None, "observed_at": self.now_iso})
        return out + [self.accounts[aid] for aid in sorted(self.accounts)]

    # ── facets ──────────────────────────────────────────────────────────────

    def classify(self):
        for pid in sorted(self.projects):
            project = self.projects[pid]
            self._curation(pid, project)
            self._measures(project)
            facets = project["facets"]
            if not self.refs:
                for field in KINGDOM_FIELDS:
                    facets[field] = _facet(status="unset", basis="kingdom", candidates=[], off_enum=[], ref=None,
                                           ref_divergent=False, by_ref={}, note="no readable foundation ref")
            facets["standing"] = self._standing(project)
            facets["liveness"] = self._liveness(project)
            facets["hosting"] = self._hosting(project)
            facets["running"] = self._running(project)
            facets["stack"] = self._stack(project)
            facets["exposure"] = self._exposure(project)
            self._display(project)
            self._claims(pid, project)
            project["flags"]["incidental"] = "incidental" in facets["role"].get("values", [])

    def group_claims(self):
        """What KINGDOM says about each group's members, counted once per member: the layer status
        and every candidate as source=value, so card-says-soul against harvest-says-fleet reads as
        one line for the whole citizen group."""
        for group in self.groups.values():
            statuses, candidates = Counter(), Counter()
            for pid in group["member_projects"]:
                facet = self.projects[pid]["facets"].get("layer") or {}
                statuses[facet.get("status") or "unknown"] += 1
                for item in {(c["source"], c["value"]) for c in facet.get("candidates") or []}:
                    candidates["%s=%s" % item] += 1
            group["kingdom_claims"] = {"layer_status": dict(sorted(statuses.items())),
                                       "candidates": dict(sorted(candidates.items()))}

    def spheres(self):
        """The sphere facet (owner decision D4, sphere.py) on every project, zone and surface: the
        curated assignment, a mirror's canonical project, the family default, the KINGDOM layer on
        the primary ref through the decision's sphere_by_layer, else undecided with the reason."""
        allowed = sphere.values(self.vocab.get("facets"))
        rows, families, problems = sphere.curated_index(self.curated, allowed)
        rule = self.decided.get("sphere")
        problems += sphere.rule_problems(rule, set(self.enums_primary.get("layer") or ()), allowed)
        problems += sphere.resolve_projects(self.projects, rows, families, rule,
                                            sphere.mirror_targets(self.relations.values()), allowed,
                                            self.primary if self.refs else None, self.foundation.get("observed_at"))
        decision = (rule or {}).get("decision")
        for zone in self.zones.values():
            zone["sphere"] = sphere.resolve_zone(zone, rows, self.projects, decision, problems)
        for surface in self.surfaces.values():
            surface["sphere"] = sphere.resolve_surface(surface, rows, self.projects, decision, self.zones, problems)
        mismatches = sphere.follow_mismatches(self.zones, self.surfaces, self.projects)
        self.sphere = sphere.summary(self.projects, self.zones, self.surfaces, rows, families, rule, allowed, problems,
                                     mismatches)
        self.problems += problems
        for rid in self.sphere["unmatched"]:
            self.queue.append({"reason": "sphere-unmatched", "id": rid,
                               "detail": "a curated sphere row names no record of this run"})
        for item in mismatches:
            self.queue.append({"reason": "sphere-follow-mismatch", "id": item["id"],
                               "detail": "curated sphere %s, but %s, the project it hangs on, is %s; the curated row "
                                         "stands until Yu reviews it" % (item["value"], item["project"],
                                                                         item["project_value"])})

    def capabilities(self):
        """The business capability map (capability.py): every package record's capability (its curated
        row, else the run-band value its directory names), then every project's display: its curated
        row (under its id or an alias), else the union of its packages that have code, else the values
        of the one project it mirrors, else unassigned when it is in business scope
        (capability.business_scope) and none outside it. QUEUE lists the unassigned, framework-domain
        candidates, rows past their review date and rows naming no record."""
        facets = self.vocab.get("facets")
        rows, problems = capability.curated_index(self.curated, facets)
        problems += self.package_problems
        derived, designed, found = capability.resolve_packages(self.packages, rows, facets)
        problems += found
        problems += capability.resolve_projects(self.projects, rows, sphere.mirror_targets(self.relations.values()),
                                                derived, designed)
        checks = capability.row_checks(self.projects, rows, self.now.date().isoformat(), self.packages)
        self.queue += capability.queue_items(self.projects, checks)
        self.capability = capability.summary(self.projects, facets, rows, problems, checks, self.packages, self.hosts)
        self.problems += problems

    def build_wires(self):
        """Wires on the relation kind (wires.py): the import and manifest edges between package records,
        then every curated [[wire]] row, its anchors re-found in each side's canonical checkout, its
        code_state and stage measured (a demonstrated claim against the workflow run build --forge read,
        srcs["workflow_runs"]; not read without it) and compared with its claim. A row whose ends this run
        holds becomes (or joins) a relation record; one naming an end not built yet is still measured and
        shown. QUEUE lists curated wired claims with no consuming code and claims measurement
        contradicts."""
        rows, problems = wires.rows(self.curated)
        runs = self.srcs.get("workflow_runs")
        edges = self.package_edges = wires.measured_edges(self.packages)
        for edge in edges:
            rid = self._relation(edge["from"], "depends_on", edge["to"], edge["basis"],
                                 "import" if edge["basis"] == wires.MEASURED_IMPORT else "manifest", None, "src:packages")
            relation = self.relations[rid]
            relation["also"] += [b for b in edge["also"] if b not in relation["also"]]
            relation["code_state"] = edge["code_state"]
        found_by_repo = {}
        for pid, project in self.projects.items():
            cid = project["canonical_checkout"]
            read = (self.repo.get(cid) or {}).get("anchors") if cid else None
            if (read or {}).get("status") == "ok":
                found_by_repo[pid] = {(a["path"], a["text"]): a for a in read["anchors"]}
        self.anchors_found = found_by_repo
        decision_ids = {d["id"] for d in decisions.owner_decisions(self.curated.get("decisions"))}
        evaluated = []
        for name in sorted(rows):
            row = rows[name]
            unbuilt = {end: (self.packages[end].get("build") or {}).get("unbuilt") for end in (row["from"], row["to"])
                       if end in self.packages}
            entry = wires.evaluate(row, found_by_repo, unbuilt, decision_ids, runs)
            entry["ends"] = {side: self._known_end(row[side]) for side in wires.SIDES}
            entry["id"] = None
            if all(entry["ends"].values()):
                entry["id"] = self._relation(row["from"], row["verb"], row["to"], wires.CURATED, row["verb"],
                                             row.get("evidence"), "src:curated", row["channel"])
                relation = self.relations[entry["id"]]
                relation.update({k: entry[k] for k in ("name", "channel", "anchors", "claimed", "code_state", "reason",
                                                       "stage", "stage_reason", "run", "verdict")})
                relation.update({k: row[k] for k in wires.META_KEYS if k in row})
            evaluated.append(entry)
            if entry["verdict"] == "unevidenced":
                self.queue.append({"reason": "wire-unevidenced", "id": name,
                                   "detail": "curated %s, but the consuming side has no code for it" % row["code_state"]})
            elif entry["verdict"] == "differs":
                self.queue.append({"reason": "wire-differs", "id": name, "detail": "curated %s, %s; measured %s, %s" % (
                    row["code_state"], row["stage"], entry["code_state"], entry["stage"])})
        self._attach_relations()
        self.wires = wires.summary(evaluated, edges, problems, runs)
        self.problems += problems

    def build_motifs(self):
        """The motifs view (motifs.py), after build_wires: every [[motif]] row of curated/motifs.toml with
        the packages that import its libraries (the measured-import edges between package records) and its
        also_in anchors re-found with the wire anchors. A view, never a record. QUEUE lists a library that
        is no package of its host's checkout and an anchor no longer found as code (motif-stale)."""
        rows, problems = motifs.rows(self.curated)
        hosts = {h["id"]: h for h in self.hosts}
        evaluated = [motifs.evaluate(rows[name], self.packages, self.package_edges, self.anchors_found, hosts)
                     for name in sorted(rows)]
        self.queue += motifs.queue_items(evaluated)
        self.motifs = motifs.summary(evaluated, problems)
        self.problems += problems

    def _curation(self, pid, project):
        row = (self.curated.get("projects") or {}).get(pid)
        group_rows = [self.groups[g] for g in project["group_ids"] if g in self.groups]
        project["name"] = (row or {}).get("name") or (project["forge"] or {}).get("repo") or (
            os.path.basename(self.co[project["checkouts"][0]]["path"]) if project["checkouts"] else pid)
        aliases = set()
        for entry in self.curated.get("identity") or []:
            if entry.get("id") == pid:
                aliases |= set(entry.get("aliases") or [])
        aliases |= set((row or {}).get("aliases") or []) | set(self.local_aliases.get(pid, []))
        for cid in project["checkouts"]:
            for value in (self.co[cid].get("remotes") or {}).values():
                if value and value != pid and not value.startswith("file:"):
                    aliases.add(value)
            alias = self._local_alias(self.co[cid])
            if alias and project["local"]:
                aliases.add(alias)
        project["aliases"] = sorted(aliases)
        if row:
            project["curated"] = {k: row.get(k) for k in ("what", "confidence", "as_of", "review_after", "reviewed",
                                                          "source", "heavy")}
            # The views are private, so they show the full text; the committed (scrubbed) text
            # stays beside it for anything that may leave the private area (a P01 card purpose).
            full = (self.private_projects.get(pid) or {}).get("what_full")
            project["curated"]["what_public"] = row.get("what")
            if full:
                project["curated"]["what"] = full
        family = (row or {}).get("family_id") or next((g["family_id"] for g in group_rows if g.get("family_id")), None)
        project["family_id"] = family
        facets = project["facets"]
        if family:
            basis = "curated" if row and row.get("family_id") else "group"
            facets["family"] = _facet(family.split(":", 1)[1], VALUE_STATUS, basis, "src:curated")
        else:
            facets["family"] = _facet(status="unassigned", basis="curated", src="src:curated")
        role_group = None if (row or {}).get("role") else self._role_group(project, group_rows)
        roles = (row or {}).get("role") or (role_group or {}).get("role") or []
        role_status = (row or {}).get("role_status") or (role_group or {}).get("role_status")
        facets["role"] = _multi(roles[:2], VALUE_STATUS if roles else "unknown",
                                ("group" if role_group else "curated") if roles else None, "src:curated",
                                role_status=role_status, group=(role_group or {}).get("id"))
        topics = (row or {}).get("topics") or []
        facets["topic"] = _multi(topics[:3], VALUE_STATUS if topics else "none", "curated" if topics else None, "src:curated")
        if family:
            fam = self.families.get(family)
            if fam is not None:
                fam["projects_n"] += 1

    def _role_group(self, project, group_rows):
        """The group whose role describes this project. A names, forge-glob or repo-subpath group
        is about the project itself; a path-glob group is about checkouts in one place (a mirror,
        a snapshot), so it describes the project only when its canonical checkout is a member.
        Among those, the one with the fewest members (the most specific) wins."""
        usable = []
        for group in group_rows:
            if not group.get("role"):
                continue
            if group.get("member_kind") == "checkout" and project["canonical_checkout"] not in (group.get("members") or []):
                continue
            usable.append(group)
        usable.sort(key=lambda g: (g.get("member_kind") == "checkout", len(g.get("member_projects") or []), g["id"]))
        return usable[0] if usable else None

    def _local_path(self, ident):
        rest = ident[len(LOCAL):]
        if rest == "~":
            return self.home
        return os.path.join(self.home, rest[len(safety.HOME_PREFIX):]) if rest.startswith(safety.HOME_PREFIX) else None

    def _measures(self, project):
        present = [self.co[c] for c in project["checkouts"] if self.co[c].get("measure_status") in census.OBSERVED_STATUSES]
        commits = [c.get("last_commit_at") for c in present if c.get("last_commit_at")]
        dirty = [c["dirty"] for c in present if (c.get("dirty") or {}).get("mode") == "normal"]
        unpushed = [c.get("unpushed_commits") for c in present]
        project["measures"] = {
            "last_commit_any": max(commits, key=epoch) if commits else None,
            "pushed_at": (project["forge"] or {}).get("pushed_at"),
            "dirty_total": sum((d.get("modified") or 0) + (d.get("untracked") or 0) for d in dirty) if dirty else None,
            "dirty_unknown": len(present) - len(dirty),
            "unpushed_commits": sum(u for u in unpushed if isinstance(u, int)) if any(isinstance(u, int) for u in unpushed) else None,
            "checkouts_n": len(project["checkouts"]), "measured_checkouts": len(present)}
        project["flags"]["checkout_present"] = bool(project["canonical_checkout"])
        canonical = self.co.get(project["canonical_checkout"]) if project["canonical_checkout"] else None
        project["flags"]["resting"] = bool(canonical and canonical.get("rest_marker"))

    def _standing(self, project):
        k = project["kingdom"] or {}
        src = "src:kingdom:" + str(k.get("ref"))
        if k.get("card_present"):
            if k.get("card_field_ok") is None:
                return _facet(status="unknown", basis="derived", src=src, note="card present but not read")
            if not k["card_field_ok"]:
                return _facet("card-invalid", VALUE_STATUS, "derived", src)
            tracked = k.get("card_tracked")
            if tracked is None:
                return _facet(status="unknown", basis="derived", src=src, note="card tracking unknown")
            return _facet("owned" if tracked else "card-untracked", VALUE_STATUS, "derived", src)
        listed = bool(k.get("registry_ids") or k.get("sites_keys")
                      or any(r for r in (k.get("roster_by_ref") or {}).values()))
        if listed:
            return _facet("listed", VALUE_STATUS, "derived", src)
        if not project["checkouts"] or k.get("card_present") is None:
            return _facet(status="unknown", basis="derived", src=src, note="no checkout here to read a card from")
        return _facet("unlisted", VALUE_STATUS, "derived", src)

    def _forge_fresh(self, project):
        forge = self.srcs.get("forge") or {}
        host = (project["forge"] or {}).get("host")
        for listing in forge.get("listings") or []:
            if listing.get("age_s") is not None and listing["age_s"] <= BUDGETS["forge"][0]:
                owners = set(listing.get("owners") or [])
                if (project["forge"] or {}).get("owner") in owners and host and listing.get("forge") in (host.split(".")[0], "mixed"):
                    return True
        return False

    def _liveness(self, project):
        forge = project["forge"] or {}
        measures = project["measures"]
        if forge.get("archived") is True:
            return _facet("archived", VALUE_STATUS, "measured", "src:forge", forge.get("listing_at"))
        times = [t for t in (measures["last_commit_any"], forge.get("pushed_at")) if epoch(t) is not None]
        newest = max(times, key=epoch) if times else None
        src = "src:census" if newest == measures["last_commit_any"] and newest else "src:forge"
        if newest and self.now.timestamp() - epoch(newest) <= ACTIVE_WITHIN_S:
            return _facet("active", VALUE_STATUS, "measured", src, newest)
        if not project["flags"]["checkout_present"] and forge.get("listed") is False and self._forge_fresh(project):
            return _facet("gone", VALUE_STATUS, "measured", "src:forge", self.now_iso)
        if newest:
            return _facet("dormant", VALUE_STATUS, "measured", src, newest)
        unborn = [self.co[c] for c in project["checkouts"] if self.co[c].get("born") is False]
        if unborn:
            return _facet("dormant", VALUE_STATUS, "measured", "src:census", self.now_iso, note="no commits yet")
        return _facet(status="unknown", basis="measured", note="no measuring source saw it")

    def _hosting(self, project):
        found = {}

        def add(value, cls, via):
            if not value:
                return
            old = found.get(value)
            if old is None or ATTRIBUTION_ORDER.index(cls) < ATTRIBUTION_ORDER.index(old["class"]):
                found[value] = {"class": cls, "via": via}

        for sid in project["surfaces"]:
            s = self.surfaces[sid]
            cls = s["attribution"]["class"] if s["source_project"] == project["id"] else "candidate_only"
            add(s["provider"], cls, sid)
        for sched in project["schedulers"]:
            record = self.schedulers[sched]
            cls = record.get("attribution") or "current_source_document"
            add(SCHEDULER_HOSTING.get(record["mechanism"]), cls, sched)
        values = sorted(found)
        if values:
            return _multi(values, VALUE_STATUS, "derived", "src:join",
                          attribution={v: found[v]["class"] for v in values}, via={v: found[v]["via"] for v in values})
        registry_ok = (self.srcs.get("registry") or {}).get("status") in ("ok", "partial")
        if not registry_ok:
            return _multi([], "unknown", "derived", "src:join", attribution={}, via={}, note="REGISTRY unreadable")
        # "none" is a measurement only where the deploy manifests were read: in the canonical
        # checkout. A project with no measured checkout here has unknown hosting.
        if project["canonical_checkout"] not in self.repo:
            return _multi([], "unknown", "derived", "src:join", attribution={}, via={},
                          note="no measured canonical checkout here, so no manifest was read")
        return _multi([], "none", "derived", "src:join", attribution={}, via={})

    def _running(self, project):
        attributed = [self.surfaces[s] for s in project["surfaces"]
                      if self.surfaces[s]["source_project"] == project["id"] and self.surfaces[s]["attribution"]["class"] in CURRENT]
        schedulers = [self.schedulers[s] for s in project["schedulers"]]
        if not attributed and not schedulers:
            return _facet("none", VALUE_STATUS, "derived", "src:join")
        if not self.pulse_ok:
            return _facet(status="unknown", basis="derived", src="src:pulse", note="pulse missing or older than 24 h")
        states = [s["health"]["state"] for s in attributed]
        for sched in schedulers:
            caveat = sched["health"].get("caveat") or {}
            if caveat.get("contradicts"):
                states.append("contradicted")
            else:
                states.append({"healthy": "up", "failing": "down"}.get(sched["health"]["state"], "unprobed"))
        for state in ("contradicted", "down", "up"):
            if state in states:
                return _facet(state, VALUE_STATUS, "derived", "src:pulse", self.pulse_at)
        return _facet("unprobed", VALUE_STATUS, "derived", "src:join")

    def _stack(self, project):
        cid = project["canonical_checkout"]
        co = self.co.get(cid) if cid else None
        if not co or co.get("tracked_files") is None or co.get("top_ext") is None:
            return _multi([], "unknown", "measured", "src:census", note="no measured canonical checkout")
        total = co["tracked_files"] or 0
        counts = Counter()
        for ext, n in co["top_ext"]:
            lang = STACK_EXT.get(ext)
            if lang:
                counts[lang] += n
        manifest_langs = [STACK_MANIFESTS[m] for m in co.get("manifests") or [] if m in STACK_MANIFESTS]
        if "package.json" in (co.get("manifests") or []) and "typescript" not in counts and "typescript" not in manifest_langs:
            manifest_langs.append("javascript")
        markdown = counts.pop("markdown", 0)
        ordered = ["markdown"] if total and markdown / total > 0.6 else []
        # A language counts from its files only with a real share: one run.sh among nine files does
        # not make a markdown home a shell project. Manifests still count on their own.
        for lang, n in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])):
            share = n / total if total else 0
            if ((n >= STACK_MIN_FILES and share >= STACK_MIN_SHARE) or share >= STACK_MAJOR_SHARE) and lang not in ordered:
                ordered.append(lang)
        if not ordered and not manifest_langs and markdown >= STACK_MIN_FILES and markdown >= max(counts.values() or [0]):
            ordered.append("markdown")
        for lang in manifest_langs:
            if lang not in ordered:
                ordered.append(lang)
        values = ordered[:3]
        return _multi(values, VALUE_STATUS if values else "unknown", "measured", "src:census", co.get("observed_at"))

    def _exposure(self, project):
        forge = project["forge"] or {}
        visibility = forge.get("visibility") or {}
        if visibility.get("v") in ("public", "private"):
            return _facet(visibility["v"], VALUE_STATUS, "measured", "src:forge", visibility.get("at"))
        v1 = self.portfolio_repos.get(project["id"])
        if v1 and isinstance(v1.get("private"), bool):
            observed = ((self.srcs.get("portfolio") or {}).get("observed") or {}).get("github")
            return _facet("private" if v1["private"] else "public", VALUE_STATUS, "imported", "src:portfolio-map", observed)
        if project["checkouts"] and not project["forge"]:
            measured = [self.co[c] for c in project["checkouts"] if self.co[c].get("remotes") is not None]
            if measured and not any(v for c in measured for v in (c.get("remotes") or {}).values()
                                    if v and not v.startswith("file:")):
                return _facet("local-only", VALUE_STATUS, "measured", "src:census", self.now_iso)
            return _facet(status="unknown", basis="measured", note="the checkout's remotes were not measured")
        if project["local"]:
            return _facet(status="unknown", basis="measured", note="curated local id with no checkout here")
        return _facet(status="unknown", basis="measured", note="no listing names it")

    def _display(self, project):
        k = project["kingdom"] or {}
        valid = k.get("card_valid") or {}
        roster = k.get("roster_row") or {}
        display, src = project["display"], project["display_src"]
        display["owner_sister"] = valid.get("owner_sister")
        src["owner_sister"] = "card" if valid.get("owner_sister") else None
        roster_domain = roster.get("domain") if roster.get("domain") in (self.enums_primary.get("domain") or ()) else None
        display["domain"] = valid.get("domain") or roster_domain
        src["domain"] = "card" if valid.get("domain") else ("roster" if roster_domain else None)
        display["adopts"] = list(valid.get("adopts") or [])
        forge = project["forge"] or {}
        roles = {self.co[c]["checkout_role"] for c in project["checkouts"]}
        tag_provenance = sorted({t.split("=", 1)[1] for t in self._targets(project["id"]) if t.startswith("expect:provenance=")})
        if forge.get("fork"):
            display["provenance"], src["provenance"] = "fork", "forge"
        elif forge.get("mirror"):
            display["provenance"], src["provenance"] = "mirror", "forge"
        elif self.co.get(project["canonical_checkout"] or "", {}).get("checkout_role") == "vendored" or (roles == {"vendored"}):
            display["provenance"], src["provenance"] = "vendored", "location-rule"
        elif len(tag_provenance) == 1:
            display["provenance"], src["provenance"] = tag_provenance[0], "tag"
        else:
            display["provenance"], src["provenance"] = None, None
        v1 = self.portfolio_repos.get(project["id"]) or {}
        groups = sorted({t.split("=", 1)[1] for t in self._targets(project["id"]) if t.startswith("purpose_group=")})
        if v1.get("group"):
            display["purpose_group"], src["purpose_group"] = v1["group"], "portfolio-map/1"
        elif len(groups) == 1:
            display["purpose_group"], src["purpose_group"] = groups[0], "tag"
        else:
            display["purpose_group"], src["purpose_group"] = None, None
        domains = v1.get("framework_domains") or sorted({t.split("=", 1)[1] for t in self._targets(project["id"])
                                                         if t.startswith("be.framework_domain=")})
        display["be.framework_domain"] = list(domains)
        src["be.framework_domain"] = ("portfolio-map/1" if v1.get("framework_domains") else ("tag" if domains else None))
        display["role_status"] = project["facets"]["role"].get("role_status")
        src["role_status"] = "curated" if display["role_status"] else None

    def _targets(self, pid):
        index = self.vocab.get("tag_index") or {}
        out = []
        for raw in (self.private_projects.get(pid) or {}).get("raw_tags") or []:
            out += index.get(raw, [])
        return out

    def _claims(self, pid, project):
        k = project["kingdom"] or {}
        claims = project["claims"]
        at = self.foundation.get("observed_at")
        for field, value in sorted((k.get("card_valid") or {}).items()):
            claims.append({"source": "card", "field": field, "value": value, "at": at})
        for field in ("kind", "layer", "state"):
            if (k.get("roster_row") or {}).get(field):
                claims.append({"source": "roster", "field": field, "value": k["roster_row"][field], "at": at})
        registry_at = (self.srcs.get("registry") or {}).get("updated")
        for entry in self.registry:
            if entry["id"] in k.get("registry_ids", []):
                claims.append({"source": "registry", "field": "runtime", "value": entry.get("runtime"), "at": registry_at})
        for door in self.sites:
            if door.get("project_id") == pid:
                claims.append({"source": "sites", "field": "url", "value": door.get("url"), "at": None})
        canonical = self.co.get(project["canonical_checkout"]) if project["canonical_checkout"] else None
        if canonical and canonical.get("readme_title"):
            claims.append({"source": "readme", "field": "title", "value": canonical["readme_title"], "at": canonical.get("observed_at")})
        if (project["forge"] or {}).get("description"):
            claims.append({"source": "forge", "field": "description", "value": project["forge"]["description"],
                           "at": project["forge"].get("listing_at")})
        graph = k.get("graph_entry")
        if graph:
            for field in ("layer", "kind", "state"):
                if graph.get(field):
                    claims.append({"source": "graph.json", "field": field, "value": graph[field], "at": graph.get("at")})
        for key, entries in self.prior_names.items():
            for name, value in entries:
                if name == (project["name"] or "").lower() or name == _repo_name(pid):
                    claims.append({"source": key, "field": "placement", "value": value, "at": None})
        for field, value in sorted(((self.private_projects.get(pid) or {}).get("survey_claims") or {}).items()):
            claims.append({"source": "survey", "field": field, "value": value, "at": curate.AS_OF.isoformat()})

    def index_side_claims(self):
        self.portfolio_repos = {}
        for repo in (self.srcs.get("portfolio") or {}).get("repositories") or []:
            if isinstance(repo.get("full_name"), str):
                self.portfolio_repos[self._canon("github.com/" + repo["full_name"].lower())] = repo
        self.prior_names = {}
        prior = self.srcs.get("prior_maps") or {}
        index = ((prior.get("kingdom_index") or {}).get("claims") or {}).get("buckets") or {}
        self.prior_names["kingdom-index"] = [(n.lower(), bucket) for bucket, names in index.items() for n in names]
        catalog = ((prior.get("start_here_catalog") or {}).get("claims") or {}).get("entries") or []
        self.prior_names["start-here"] = [((e.get("name") or "").lower(), e.get("cluster")) for e in catalog if e.get("name")]

    # ── tag expectations and risks ──────────────────────────────────────────

    def expectations(self):
        index = self.vocab.get("tag_index")
        for pid, project in sorted(self.projects.items()):
            row = self.private_projects.get(pid) or {}
            raw_tags = row.get("raw_tags") or []
            if index is None and raw_tags:
                project["tag_expectations"] = [{"raw": raw, "target": None, "result": "unverifiable",
                                                "measured": None, "note": "tag map unreadable"} for raw in raw_tags]
                continue
            for raw in raw_tags:
                if raw not in (index or {}):
                    project["unmapped_tags"].append(raw)
                    self.queue.append({"reason": "unmapped-tag", "id": pid, "detail": raw})
                    continue
                for target in index[raw]:
                    result = self._expect(project, target)
                    if result is None:
                        continue
                    outcome, measured = result
                    project["tag_expectations"].append({"raw": raw, "target": target, "result": outcome, "measured": measured})

    def _expect(self, project, target):
        key, _, value = target.partition("=")
        facets = project["facets"]
        if key.startswith("expect:"):
            facet = key.split(":", 1)[1]
            if facet == "checkout_role":
                roles = sorted({self.co[c]["checkout_role"] for c in project["checkouts"] if self.co[c]["checkout_role"]})
                if not project["checkouts"]:
                    return "unverifiable", None
                return ("met" if value in roles else "failed"), roles
            if facet == "provenance":
                measured = project["display"].get("provenance")
                return ("unverifiable" if measured is None else "met" if measured == value else "failed"), measured
            f = facets.get(facet) or {}
            if "values" in f:
                if f["status"] == "unknown":
                    return "unverifiable", None
                if value not in f["values"] and facet == "hosting" and value not in MEASURABLE_HOSTING:
                    # Only curated rows or REGISTRY ever name this host: its absence is not measured.
                    return "unverifiable", f["values"]
                return ("met" if value in f["values"] else "failed"), f["values"]
            if f.get("value") is None:
                return "unverifiable", None
            return ("met" if f["value"] == value else "failed"), f["value"]
        if key == "risk":
            if value in project["risks"]:
                return "met", project["risks"]
            if value not in self.measurable_risks or not project["checkouts"]:
                # Nothing measured here can show the risk absent: no measurable form, or no
                # checkout of this project on this machine.
                return "unverifiable", None
            return "failed", project["risks"]
        return None

    def risks(self):
        # Risks whose absence is measured too. A secret-bearing path is known only from curation,
        # so a tag claiming one can be confirmed but never refuted: it stays unverifiable.
        self.measurable_risks = {RISKS[k] for k in curate.MEASURED_RISKS}
        secret_owner = {}
        for art in self.artifacts.values():
            if art.get("secret_bearing") and art.get("owner_project"):
                secret_owner.setdefault(art["owner_project"], []).append(art["id"])
        for pid, project in sorted(self.projects.items()):
            found = []
            for cid in project["checkouts"]:
                found += self._checkout_risks(project, self.co[cid])
            if project["local"] and project["measures"].get("last_commit_any"):
                found.append((RISKS["single"], project["canonical_checkout"], "no forge remote holds these commits"))
            for sid in project["schedulers"]:
                sched = self.schedulers[sid]
                if sched.get("tcc_exposed"):
                    found.append((RISKS["tcc"], sid, "scheduled job targets a TCC-protected folder"))
                if sched["health"]["state"] == "failing" and not sched["watched_by_pulse"] \
                        and not (sched["health"].get("caveat") or {}).get("contradicts"):
                    found.append((RISKS["silent"], sid, "failing and not watched by pulse"))
                if (sched["health"].get("caveat") or {}).get("contradicts"):
                    found.append((RISKS["hollow"], sid, "pulse observation contradicted by a caveat"))
            for sid in project["surfaces"]:
                if self.surfaces[sid]["health"]["state"] == "contradicted":
                    found.append((RISKS["hollow"], sid, "pulse observation contradicted by a caveat"))
            for art in secret_owner.get(pid, []):
                found.append((RISKS["secret-path"], art, "names only; contents never read"))
            project["risk_detail"] = [{"risk": r, "where": w, "detail": d} for r, w, d in found]
            project["risks"] = sorted({r for r, _, _ in found})
            project["risk_notes"] = list((self.private_projects.get(pid) or {}).get("risks") or [])

    def _checkout_risks(self, project, co):
        out = []
        dirty = co.get("dirty") or {}
        if dirty.get("mode") == "normal" and ((dirty.get("modified") or 0) + (dirty.get("untracked") or 0)) > 0:
            out.append((RISKS["unsaved"], co["id"], "%s modified, %s untracked" % (dirty.get("modified"), dirty.get("untracked"))))
        upstream = co.get("upstream") or {}
        if (co.get("unpushed_commits") or 0) > 0 or (upstream.get("ahead") or 0) > 0:
            out.append((RISKS["unpushed"], co["id"], "%s commits on no remote branch" % co.get("unpushed_commits")))
        if (upstream.get("ahead") or 0) > 0 and (upstream.get("behind") or 0) > 0:
            out.append((RISKS["diverge"], co["id"], "ahead %s, behind %s" % (upstream["ahead"], upstream["behind"])))
        fetched = _age(self.now, upstream.get("as_of_fetch"))
        if (upstream.get("behind") or 0) > 0 or (upstream.get("state") == "tracking" and fetched is not None and fetched > ACTIVE_WITHIN_S):
            out.append((RISKS["stale"], co["id"], "behind %s, fetched %s" % (upstream.get("behind"), upstream.get("as_of_fetch"))))
        if (co.get("partial") or {}).get("flag") is True:
            out.append((RISKS["partial"], co["id"], ", ".join((co.get("partial") or {}).get("reasons") or [])))
        if co.get("lends_objects_to"):
            out.append((RISKS["lender"], co["id"], "%d borrowers" % len(co["lends_objects_to"])))
        if co.get("alternates"):
            out.append((RISKS["borrower"], co["id"], "%d lenders" % len(co["alternates"])))
        if ((co.get("worktrees") or {}).get("prunable") or 0) > 0:
            out.append((RISKS["prunable"], co["id"], "%d prunable registrations" % co["worktrees"]["prunable"]))
        return out

    # ── freshness and source entries ────────────────────────────────────────

    def source_entries(self):
        entries = {}

        def add(sid, kind, cls, status, age_s=None, budget=None, required=False, configured=True,
                coverage=None, sha256=None, observed_at=None, locator_id=None, note=None, floor=None):
            # A reader status other than ok/partial/empty is a failure to read (denied, symlink,
            # invalid, timeout, ...): error, never fresh.
            if status == "not-configured":
                fresh, configured = "missing", False
            elif status in (None, "missing", "unavailable"):
                fresh = "missing"
            elif status not in ("ok", "partial", "empty"):
                fresh = "error"
            elif budget:
                fresh = freshness(age_s, *budget)
            else:
                fresh = "fresh"
            if floor and FRESHNESS_ORDER.index(floor) > FRESHNESS_ORDER.index(fresh):
                fresh = floor
            entries[sid] = {"id": sid, "kind": kind, "class": cls, "status": status, "locator_id": locator_id,
                            "sha256": sha256, "observed_at": observed_at, "age_s": age_s,
                            "budget": {"fresh_s": budget[0], "stale_s": budget[1]} if budget else None,
                            "freshness": fresh, "required": required, "configured": configured,
                            "coverage": coverage, "note": note}

        c = self.census
        cov = c.get("coverage") or {}
        add("src:census", "census", "measure", "ok" if c.get("checkouts") is not None else "missing",
            _age(self.now, c.get("finished_at")), BUDGETS["census"], True,
            coverage={k: cov.get(k) for k in ("expected", "observed", "errors")}, observed_at=c.get("finished_at"),
            note=("reused from %s" % c.get("reused_from")) if c.get("mode") == "reuse" else c.get("mode_reason"),
            floor="aging" if c.get("mode") == "reuse" else None)
        add("src:full-walk", "full-walk", "measure", "ok" if c.get("last_full_at") else "missing",
            _age(self.now, c.get("last_full_at")), BUDGETS["full-walk"], observed_at=c.get("last_full_at"))
        refs = self.foundation.get("refs") or {}
        wt = refs.get(kingdom.WORKTREE) or {}
        add("src:kingdom:worktree", "kingdom", "measure", wt.get("status") if wt.get("status") in ("ok", "partial") else "error",
            required=True, sha256=wt.get("harvest_blob_sha256"), observed_at=self.foundation.get("observed_at"),
            locator_id="kingdom-os worktree", note="; ".join(wt.get("parse_errors") or []) or None)
        om = refs.get(kingdom.ORIGIN_MAIN) or {}
        fetch = self.foundation.get("fetch_head") or {}
        add("src:kingdom:origin/main", "kingdom", "claim",
            om.get("status") if om.get("status") in ("ok", "partial") else "error",
            fetch.get("age_s"), BUDGETS["kingdom-origin"], sha256=om.get("harvest_blob_sha256"),
            observed_at=fetch.get("mtime"), locator_id="kingdom-os origin/main", note=fetch.get("reason"))
        roster = (refs.get(self.primary) or wt).get("roster")
        add("src:roster", "roster", "claim", "ok" if roster is not None else "error", required=True,
            coverage={"expected": len(roster["rows"]) + len(roster["skipped_lines"]), "observed": len(roster["rows"]),
                      "errors": len(roster["skipped_lines"])} if roster else None, locator_id="kingdom-os roster.conf")
        reg = self.srcs.get("registry") or {}
        add("src:registry", "registry", "claim", reg.get("status", "missing"), sha256=reg.get("sha256"),
            coverage={"expected": len(reg.get("services") or []), "observed": len(reg.get("ids") or []),
                      "errors": len(reg.get("errors") or [])} if reg else None, locator_id="kingdom-os REGISTRY.yaml",
            note=("pulse copy %s" % ("equal" if (reg.get("copy") or {}).get("equal") else "differs or unreadable")) if reg else None)
        for key, sid in (("sites", "src:sites"), ("graph", "src:graph")):
            data = self.srcs.get(key) or {}
            add(sid, key, "claim", data.get("status", "missing"), sha256=data.get("sha256"),
                locator_id="kingdom-os %s" % ("sites.json" if key == "sites" else "graph.json"))
        pulse = self.srcs.get("pulse") or {}
        status = pulse.get("status") or {}
        add("src:pulse", "pulse", "measure", status.get("state") or "missing",
            _age(self.now, status.get("generated_at")), BUDGETS["pulse"], True, sha256=status.get("sha256"),
            observed_at=status.get("generated_at"), locator_id="LOCATORS.pulse_status",
            coverage={"expected": len(self.registry), "observed": len(status.get("rows") or []), "errors": 0} if status else None)
        history = pulse.get("history") or {}
        add("src:pulse-history", "pulse-history", "measure", history.get("state", "missing"),
            _age(self.now, history.get("mtime")), BUDGETS["pulse-history"], observed_at=history.get("mtime"),
            locator_id="LOCATORS.pulse_history")
        for key, sid, kind in (("launchd", "src:launchd", "launchd"), ("launchctl", "src:launchctl", "launchctl"),
                               ("crontab", "src:crontab", "crontab"), ("scheduler_json", "src:scheduler-json", "hermes")):
            data = self.srcs.get(key)
            status = (data or {}).get("status", "missing")
            jobs = (data or {}).get("jobs")
            add(sid, kind, "measure", status, observed_at=(data or {}).get("observed_at"),
                coverage={"expected": None, "observed": len(jobs) if jobs is not None else None,
                          "errors": len((data or {}).get("errors") or [])} if data else None,
                note=None if status in ("ok", "empty") else status)
        obs = self.srcs.get("observer") or {}
        add("src:cloudflare-observer", "cloudflare-observer", "measure", obs.get("status", "missing"),
            _age(self.now, obs.get("finished_at") or obs.get("started_at")), BUDGETS["cloudflare-observer"],
            observed_at=obs.get("finished_at"), locator_id="LOCATORS.observer_runs",
            coverage=observer_coverage(obs) if obs else None,
            note=("observer state %s" % obs.get("state")) if obs.get("state") and obs.get("state") != "complete" else None)
        # The observer's own degraded state propagates (spec 6.6): it is a reason, not a footnote.
        entries["src:cloudflare-observer"]["propagates"] = (
            "cloudflare-observer reports %s" % obs["state"]) if obs.get("state") not in (None, "complete") else None
        inv = self.srcs.get("cf_inventory") or {"status": "not-configured"}
        add("src:cf-inventory", "cloudflare-inventory", "claim", inv.get("status"), sha256=inv.get("sha256"),
            observed_at=inv.get("as_of"), locator_id="config.locators.cf_inventory")
        forge = self.srcs.get("forge") or {"status": "not-configured", "listings": []}
        for index, listing in enumerate(forge.get("listings") or []):
            add("src:forge:%d" % index, "forge", "measure", "ok", listing.get("age_s"), BUDGETS["forge"],
                sha256=listing.get("sha256"), observed_at=listing.get("mtime"),
                locator_id="config.forge.listings[%d]" % index,
                coverage={"expected": listing.get("count", 0) + listing.get("unrecognised", 0),
                          "observed": listing.get("count"), "errors": listing.get("unrecognised")},
                note="%s %s" % (listing.get("forge"), ",".join(listing.get("owners") or [])))
        if not forge.get("listings"):
            add("src:forge", "forge", "measure", forge.get("status") or "missing", locator_id="config.forge.listings")
        port = self.srcs.get("portfolio") or {"status": "not-configured"}
        observed = (port.get("observed") or {}).get("github") or port.get("mtime")
        add("src:portfolio-map", "portfolio-map", "imported", port.get("status"), _age(self.now, observed),
            BUDGETS["portfolio-map"], sha256=port.get("sha256"), observed_at=observed,
            locator_id="config.locators.portfolio_map", note="historical source, never rewritten")
        for key, value in sorted((self.srcs.get("prior_maps") or {}).items()):
            if key == "declared":
                continue
            add("src:prior:" + key, "prior-map", "claim", (value or {}).get("status", "missing"),
                sha256=(value or {}).get("sha256"), observed_at=(value or {}).get("mtime"),
                locator_id="config.locators." + key)
        curated_status = self.curated.get("status") or {}
        add("src:curated", "curated", "curated", "ok" if curated_status.get(CURATED_ESTATE) == "ok" else curated_status.get(CURATED_ESTATE, "missing"),
            locator_id="curated/", note="private: %s" % curated_status.get(PRIVATE_PROJECTS))
        arts = self.srcs.get("artifacts")
        statuses = Counter(str(a.get("status")) for a in arts or [])
        unread = sum(n for status, n in statuses.items() if status not in ("present", "missing"))
        add("src:artifacts", "artifacts", "measure", "ok" if arts is not None else "missing",
            coverage={"expected": len(self.private_estate.get("artifact") or []), "observed": statuses["present"],
                      "errors": unread} if arts is not None else None,
            note=("%d missing; %d not checkable (no path, glob or placeholder, error)" % (statuses["missing"], unread))
            if arts is not None else None)
        self.source_index = entries
        return entries

    def record_freshness(self):
        entries = self.source_index
        census_fresh = entries["src:census"]["freshness"]
        forge_fresh = worst_freshness([e["freshness"] for sid, e in entries.items() if sid.startswith("src:forge")])
        for project in self.projects.values():
            by_source = {}
            if project["checkouts"]:
                by_source["src:census"] = census_fresh
            if (project["forge"] or {}).get("listed"):
                by_source["src:forge"] = forge_fresh
            if project["facets"]["running"].get("value") not in ("none",):
                by_source["src:pulse"] = entries["src:pulse"]["freshness"]
            if project["display_src"].get("purpose_group") == "portfolio-map/1" or project["facets"]["exposure"].get("src") == "src:portfolio-map":
                by_source["src:portfolio-map"] = entries["src:portfolio-map"]["freshness"]
            by_source["src:kingdom:" + str((project["kingdom"] or {}).get("ref"))] = entries.get(
                "src:kingdom:" + str((project["kingdom"] or {}).get("ref")), {}).get("freshness", "missing")
            if project["curated"]:
                review = parse_iso(str(project["curated"].get("review_after") or "") + "T00:00:00Z")
                by_source["src:curated"] = "stale" if review and self.now > review else "fresh"
            project["freshness"] = {"worst": worst_freshness(by_source.values()), "by_source": by_source}

    # ── QUEUE, DRIFT, ATTENTION ─────────────────────────────────────────────

    def queues(self):
        today = self.now.date().isoformat()
        for pid, project in sorted(self.projects.items()):
            curated = (self.curated.get("projects") or {}).get(pid)
            if curated is None and not project["group_ids"]:
                self.queue.append({"reason": "uncurated", "id": pid, "detail": project["name"]})
            if project["facets"]["family"]["status"] == "unassigned":
                self.queue.append({"reason": "family-unassigned", "id": pid, "detail": project["name"]})
            if curated is not None and project["facets"]["role"]["status"] == "unknown":
                self.queue.append({"reason": "role-unknown", "id": pid, "detail": project["name"]})
            for item in (self.private_projects.get(pid) or {}).get("queue") or []:
                reason = item.split(":", 1)[0]
                self.queue.append({"reason": {"role": "role-unknown", "topic": "topic-below-threshold",
                                              "what": "what-heavy"}.get(reason, reason), "id": pid, "detail": item})
            if curated and str(curated.get("review_after") or "9999") < today:
                self.queue.append({"reason": "review-overdue", "id": pid, "detail": curated.get("review_after")})
            if curated and curated.get("private_only") and curated.get("alias_status") not in (None, "ok"):
                self.queue.append({"reason": "local-alias", "id": pid, "detail": curated.get("alias_status")})
        for fid, family in sorted(self.families.items()):
            if family.get("reviewed") is False:
                self.queue.append({"reason": "family-unreviewed", "id": fid, "detail": family.get("label")})
        seen, unique = set(), []
        for item in self.queue:
            key = (item["reason"], item["id"], str(item.get("detail")))
            if key not in seen:
                seen.add(key)
                unique.append(item)
        self.queue = unique

    def drifts(self):
        for pid, project in sorted(self.projects.items()):
            state = project["facets"]["state"].get("value")
            live = project["facets"]["liveness"].get("value")
            if state and live and not state_agrees(state, live, project):
                self.drift.append({"section": 1, "code": "state-vs-liveness", "id": pid,
                                   "detail": "declared %s, measured %s" % (state, live)})
            for item in project["tag_expectations"]:
                if item["result"] == "failed":
                    self.drift.append({"section": 3, "code": "tag-expectation-failed", "id": pid,
                                       "detail": "%s (from %r) but measured %s" % (item["target"], item["raw"], item["measured"])})
            for name in KINGDOM_FIELDS:
                facet = project["facets"].get(name) or {}
                if facet.get("ref_divergent"):
                    self.drift.append({"section": 2, "code": "ref-divergent-facet", "id": pid,
                                       "detail": "%s: %s" % (name, by_ref_text(facet))})
        for sid, s in sorted(self.surfaces.items()):
            reg = s["registry"] or {}
            if reg.get("runtime_claim") and s["provider"] and str(reg["runtime_claim"]).split(":", 1)[0] != s["provider"]:
                self.drift.append({"section": 1, "code": "registry-runtime", "id": sid,
                                   "detail": "REGISTRY runtime %s, evidence says %s" % (reg["runtime_claim"], s["provider"])})
            claimed = self.repo_claim(reg.get("repo_claim"))
            if claimed and s["source_project"] and claimed != s["source_project"]:
                self.drift.append({"section": 1, "code": "registry-repo", "id": sid,
                                   "detail": "REGISTRY repo %s, attributed %s" % (reg.get("repo_claim"), s["source_project"])})
            if s["attribution_v1"] in CURRENT and not any(e["kind"] == "manifest" for e in s["attribution"]["evidence"]):
                self.drift.append({"section": 1, "code": "portfolio-attribution", "id": sid,
                                   "detail": "v1 says %s; no local manifest confirms it" % s["attribution_v1"]})
            if (s["health"] or {}).get("state") == "contradicted":
                self.drift.append({"section": 6, "code": RISKS["hollow"], "id": sid, "detail": (s["health"].get("caveat") or {}).get("note")})
        for sid, sched in sorted(self.schedulers.items()):
            if (sched["health"].get("caveat") or {}).get("contradicts"):
                self.drift.append({"section": 6, "code": RISKS["hollow"], "id": sid, "detail": sched["health"]["caveat"].get("note")})
        self._map_drift()

    def _map_drift(self):
        for ref, state in sorted(self.roster.items()):
            for row in state["rows"]:
                if row["path_status"] != "ok" and row.get("state") != "remote":
                    self.drift.append({"section": 2, "code": "roster-path-" + row["path_status"], "id": row.get("project_id"),
                                       "detail": "%s roster row %s points at a path that is not its checkout" % (ref, row.get("name"))})
        graph = self.srcs.get("graph") or {}
        graph_names = {(e.get("name") or "").lower() for e in graph.get("entries") or []}
        missing = set()
        for row in (self.roster.get(self.primary) or {}).get("rows") or []:
            name = (row.get("name") or "").lower()
            joined = self.projects.get(row.get("project_id") or "") or {}
            # graph.json keys a member by its card name where harvest lets the card rename it, so
            # a row is in the graph when its project carries a graph entry, whatever the name.
            if name and name not in graph_names and not (joined.get("kingdom") or {}).get("graph_entry"):
                missing.add(name)
        for name in sorted(missing):
            self.drift.append({"section": 2, "code": "roster-not-in-graph", "id": None, "detail": name})
        if graph.get("count") is not None and graph.get("catalog_count") is not None and graph["count"] != graph["catalog_count"]:
            self.drift.append({"section": 2, "code": "graph-vs-catalog", "id": None,
                               "detail": "graph.json %s entries, CATALOG.md %s" % (graph["count"], graph["catalog_count"])})
        for key, entries in sorted(self.prior_names.items()):
            for name, value in entries:
                if name and not self.name_index.get(name):
                    self.drift.append({"section": 2, "code": key + "-unresolved", "id": None, "detail": "%s (%s)" % (name, value)})
        gen = ((self.srcs.get("prior_maps") or {}).get("registry_gen") or {}).get("claims") or {}
        if gen.get("ids") is not None:
            ids = {s["id"] for s in self.registry}
            for missing in sorted(ids - set(gen["ids"])):
                self.drift.append({"section": 2, "code": "registry-gen-missing", "id": None, "detail": missing})
            for extra in sorted(set(gen["ids"]) - ids):
                self.drift.append({"section": 2, "code": "registry-gen-extra", "id": None, "detail": extra})
        for item in self.foundation.get("divergence") or []:
            self.drift.append({"section": 2, "code": "ref-divergence", "id": None,
                               "detail": "%s: worktree %r, origin/main %r" % (item["key"], item.get(kingdom.WORKTREE), item.get(kingdom.ORIGIN_MAIN))})
        for alert in self.foundation.get("alerts") or []:
            self.drift.append({"section": 5, "code": alert.get("code"), "id": None, "detail": alert.get("message")})

    def attentions(self):
        severity = {RISKS["unsaved"]: 2, RISKS["unpushed"]: 2, RISKS["single"]: 1, RISKS["partial"]: 2,
                    RISKS["lender"]: 2, RISKS["borrower"]: 3, RISKS["diverge"]: 2, RISKS["stale"]: 3,
                    RISKS["prunable"]: 3, RISKS["tcc"]: 2, RISKS["hollow"]: 1, RISKS["silent"]: 1,
                    RISKS["secret-path"]: 1}
        for pid, project in sorted(self.projects.items()):
            for item in project["risk_detail"]:
                level = severity.get(item["risk"], 3)
                if item["risk"] in (RISKS["unsaved"], RISKS["unpushed"]) and RISKS["single"] in project["risks"]:
                    level = 1
                self.attention.append({"risk": item["risk"], "severity": level, "id": pid, "where": item["where"],
                                       "detail": item["detail"], "basis": "measured"})
            for item in project["tag_expectations"]:
                if not item["target"] or not item["target"].startswith("risk="):
                    continue
                if item["result"] in ("failed", "unverifiable"):
                    self.attention.append({"risk": item["target"].split("=", 1)[1], "severity": 3, "id": pid,
                                           "where": None, "detail": "tag %r: %s" % (item["raw"], item["result"]),
                                           "basis": "tag"})
        for sid, sched in sorted(self.schedulers.items()):
            if sched["project_id"] is None and sched.get("tcc_exposed"):
                self.attention.append({"risk": RISKS["tcc"], "severity": 2, "id": sid, "where": sid,
                                       "detail": "scheduled job targets a TCC-protected folder", "basis": "measured"})
            if sched["project_id"] is None and sched["health"]["state"] == "failing" and not sched["watched_by_pulse"]:
                self.attention.append({"risk": RISKS["silent"], "severity": 1, "id": sid, "where": sid,
                                       "detail": sched["health"]["basis"], "basis": "measured"})
        for item in self.drift:
            if item["code"] == RISKS["hollow"] and not any(a["where"] == item["id"] for a in self.attention):
                self.attention.append({"risk": RISKS["hollow"], "severity": 1, "id": item["id"], "where": item["id"],
                                       "detail": item["detail"], "basis": "caveat"})
        for aid, art in sorted(self.artifacts.items()):
            if art.get("secret_bearing") and not art.get("owner_project"):
                self.attention.append({"risk": RISKS["secret-path"], "severity": 1, "id": aid, "where": aid,
                                       "detail": "name only; contents never read", "basis": "curated"})
        decided = self.decided_record_status()
        for item in self.attention:
            hit = decided.get(item["id"]) or decided.get(item.get("where"))
            if hit:
                item.update(status=hit["status"], decision=hit["decision"])
        self.attention.sort(key=lambda a: (a["severity"], a["risk"], str(a["id"])))

    def decision_effects(self):
        """What each owner decision did to this map, counted for the atlas Decided section:
        {decision id: {...}}; a decision with no effect this version applies maps to {}."""
        out = {did: {} for did in self.decided["by_id"]}
        auth = self.authority
        if auth.get("decision") in out:
            divergent = sum(1 for p in self.projects.values() for f in KINGDOM_FIELDS
                            if (p["facets"].get(f) or {}).get("ref_divergent"))
            out[auth["decision"]].update(primary_ref=self.primary, ref_divergent_facets=divergent,
                                         config_ref=auth.get("config_ref"), conflict=auth.get("conflict"),
                                         unreadable=auth.get("unreadable"))
        layer = self.decided["layer"]
        if layer and layer["decision"] in out:
            settled = [p for p in self.projects.values()
                       if (p["facets"].get("layer") or {}).get("decided_by") == layer["decision"]]
            values = Counter(p["facets"]["layer"]["value"] for p in settled)
            out[layer["decision"]].update(layer_settled=len(settled), layer_values=dict(sorted(values.items())))
        for item in self.ownership:
            out.setdefault(item["decision"], {}).setdefault("ownership", []).append(item)
        for provider, status in sorted(self.decided["provider_status"].items()):
            out.setdefault(status["decision"], {}).update(
                provider=provider, status=status["status"],
                accounts=sorted(a["id"] for a in self.accounts.values() if a["provider"] == provider),
                attention_rows=sum(1 for a in self.attention if a.get("decision") == status["decision"]))
        if self.sphere.get("decision") in out:
            out[self.sphere["decision"]].update(sphere_projects=self.sphere["projects"],
                                                sphere_zones=self.sphere["zones"],
                                                sphere_surfaces=self.sphere["surfaces"])
        if self.hygiene.get("decision") in out:
            out[self.hygiene["decision"]].update(hygiene=self.hygiene["counts"])
        return out

    # ── counts ──────────────────────────────────────────────────────────────

    def citizen_names(self):
        """Distinct citizens of the fleet-citizens family: one per repository name, so a forge
        twin or snapshot copy of the same citizen counts once, and a family member whose curated
        role is something else (the public site that lists the citizens) is not a citizen."""
        names = set()
        for pid, project in self.projects.items():
            if project["family_id"] != "family:fleet-citizens" or project["flags"]["orphaned_curation"]:
                continue
            roles = set(project["facets"].get("role", {}).get("values") or [])
            if roles and not roles & set(CITIZEN_ROLES) and project["facets"]["role"].get("basis") == "curated":
                continue
            names.add(_citizen_name(pid))
        return names

    def counts(self):
        computed = {
            "projects": sum(1 for p in self.projects.values() if not p["flags"]["orphaned_curation"]),
            "projects_with_checkout": sum(1 for p in self.projects.values() if p["checkouts"]),
            # Spec 6.7: forge-only projects are listing entries that have no checkout.
            "forge_only": sum(1 for p in self.projects.values()
                              if not p["checkouts"] and (p["forge"] or {}).get("listed")),
            "orphaned_curation": sum(1 for p in self.projects.values() if p["flags"]["orphaned_curation"]),
            "checkouts": len(self.co), "citizens": len(self.citizen_names()), "surfaces": len(self.surfaces),
            "schedulers": len(self.schedulers), "zones": len(self.zones), "groups": len(self.groups),
        }
        declared = ((self.srcs.get("prior_maps") or {}).get("declared") or {}).get("entries") or []
        disagreements, unverifiable = [], []
        for entry in declared:
            metric = DECLARED_METRICS.get(entry["id"])
            if metric is None:
                unverifiable.append({"id": entry["id"], "label": entry.get("label"), "declared": entry.get("value"),
                                     "source": entry.get("source")})
            elif computed[metric] != entry.get("value"):
                disagreements.append({"id": entry["id"], "label": entry.get("label"), "declared": entry.get("value"),
                                      "computed": computed[metric], "metric": metric, "source": entry.get("source")})
        return {"computed": computed, "declared": declared, "disagreements": disagreements, "unverifiable": unverifiable}


DIR_WALK_DEPTH = 4
DIR_WALK_ENTRIES = 20000


def holds_regular_file(path):
    """(True|False|None, detail): whether a directory holds at least one regular file within a
    bounded walk that never follows a link. Empty subdirectories do not count: a models directory
    holding only empty blobs/ and manifests/ is empty. None when the walk hits its bounds first."""
    pending, seen, deeper = [(path, 0)], 0, False
    while pending:
        directory, depth = pending.pop()
        try:
            with os.scandir(directory) as entries:
                for entry in entries:
                    seen += 1
                    if entry.is_file(follow_symlinks=False):
                        return True, "a regular file found"
                    if entry.is_dir(follow_symlinks=False):
                        if depth + 1 < DIR_WALK_DEPTH:
                            pending.append((entry.path, depth + 1))
                        else:
                            deeper = True
                    if seen >= DIR_WALK_ENTRIES:
                        return None, "walk stopped after %d entries without a regular file" % seen
        except OSError as exc:
            return None, "unlistable: %s" % exc.strerror
    if deeper:
        return None, "no regular file within %d levels; deeper directories not walked" % DIR_WALK_DEPTH
    if seen:
        return False, "no regular file (%d entries, all empty directories)" % seen
    return False, "empty"


CITIZEN_ROLES = ("citizen", "doctrine")


def _citizen_name(pid):
    return _repo_name(pid)


def state_agrees(state, live, project):
    if state in ("reference", "unknown"):
        return True
    if state == "remote":
        return not project["flags"]["checkout_present"]
    if state == "frozen":
        return live in ("dormant", "archived")
    return LIVENESS_STATE.get(live) == state


def ref_key(ref):
    """The key a ref's harvest view is stored under in a record ("/" is kept out of keys)."""
    return "origin_main" if ref == kingdom.ORIGIN_MAIN else ref


def _roster_summary(row):
    if not row:
        return None
    return {k: row.get(k) for k in ("ref", "name", "path_raw", "path_status", "line", "kind", "layer", "domain",
                                    "state", "purpose", "checkout_id", "duplicate_of_line", "candidates")}


def _view_summary(view):
    if not view:
        return None
    return {k: view.get(k) for k in ("name", "kind", "layer", "domain", "state", "purpose", "source", "overrides",
                                     "unknown_rules", "also_roster", "dependsOn")}


def host_of(url):
    if not isinstance(url, str):
        return None
    match = re.match(r"^[a-z][a-z0-9+.-]*://([^/:?#]+)", url.strip().lower())
    host = match.group(1) if match else None
    return host if host and "." in host and not re.fullmatch(r"[\d.]+", host) and host != "localhost" else None


def _prev_records(prev):
    if prev is None:
        return []
    if isinstance(prev, dict):
        return [r for r in prev.get("records") or [] if isinstance(r, dict)]
    return [r for r in prev if isinstance(r, dict)]


# ── build ───────────────────────────────────────────────────────────────────────────────────

def build_records(census_data, foundation, srcs, curated, vocab, prev=None, cfg=None, now=None, home=None,
                  repo_reader=None):
    """Join everything into records (spec 6.7-6.10). census_data: run_census() output;
    foundation: kingdom.read_foundation(); srcs: gather_sources() (plus "repo" keyed by checkout id
    when repo_reader is None); curated: load_curated(); vocab: load_vocab(); prev: the previous
    snapshot ({"records": [...]}) or its record list; cfg: private/config.toml.

    Returns the snapshot dict {schema, observed_at, ref, layers, enums, records[], sources{},
    worst_source, counts, queue[], drift[], attention[], kingdom{roster, sites, registry},
    foundation, problems[], reconcile{}, degraded_reasons[]}. Proposals are added by proposals.py."""
    now = now or safety.utc_now()
    home = os.environ.get("HOME", "") if home is None else home
    j = _Join(census_data, foundation, srcs, curated, vocab, cfg, now, home, prev)
    j.index_checkouts()
    j.assign_projects()
    j.forge_projects()
    j.curated_projects()
    j.choose_canonical()
    j.read_repos(repo_reader)
    j.kingdom_ingest()
    j.kingdom_claims()
    j.index_side_claims()
    j.build_schedulers()
    j.build_surfaces()
    j.build_zones()
    j.build_families()
    j.build_groups()
    j.build_packages()
    j.build_artifacts()
    j.build_accounts()
    j.owner_effects()
    j.classify()
    j.group_claims()
    j.build_relations()
    j.spheres()
    j.capabilities()
    j.build_wires()
    j.build_motifs()
    j.risks()
    j.expectations()
    j.source_entries()
    j.record_freshness()
    j.queues()
    j.drifts()
    j.attentions()
    records = _assemble(j)
    # The D8 plan joined with this run's own measurements (hygiene.join); a view, never a record.
    private = (curated or {}).get("private") or {}
    j.hygiene = hygiene.join(private.get("hygiene"), ((curated or {}).get("status") or {}).get(PRIVATE_HYGIENE),
                             records, (j.decided.get("hygiene") or {}).get("decision"),
                             refs=hygiene.reference_status(curated))
    # The ideas plan joined with this run's records, wires and motifs (ideas.join); a view, never a record.
    # An idea the owner marked done that this run does not back is queued, its status left as it is.
    j.ideas = ideas.join(private.get("ideas"), ((curated or {}).get("status") or {}).get(PRIVATE_IDEAS), records,
                         j.wires, j.motifs)
    j.queue += ideas.queue_items(j.ideas)
    snapshot = {
        "schema": SNAPSHOT_SCHEMA, "observed_at": j.now_iso, "ref": j.primary,
        "layers": list((j.refs.get(j.primary) or {}).get("layers") or []),
        "enums": dict((j.refs.get(j.primary) or {}).get("card_enums") or {}),
        "live_values": {"facet/hosting": sorted(((srcs or {}).get("registry") or {}).get("runtime_prefixes") or [])},
        "records": records, "sources": j.source_index, "worst_source": worst_source(j.source_index),
        "counts": j.counts(), "queue": j.queue, "drift": j.drift, "attention": j.attention,
        "kingdom": {"roster": {ref: {"status": s["status"], "rows": [_roster_summary(r) for r in s["rows"]],
                                     "orphans": [_roster_summary(r) for r in s["orphans"]]} for ref, s in j.roster.items()},
                    "sites": j.sites, "registry": [{"id": e["id"], "project_id": j.registry_project.get(e["id"]),
                                                    "runtime": e.get("runtime"), "repo": e.get("repo"),
                                                    "status": e.get("status")} for e in j.registry]},
        "foundation": foundation_summary(foundation),
        "authority": j.authority, "sphere": j.sphere, "capability": j.capability, "wires": j.wires, "motifs": j.motifs,
        "hygiene": j.hygiene, "ideas": j.ideas,
        "decision_effects": j.decision_effects(),
        "problems": j.problems + list((curated or {}).get("problems") or []),
    }
    snapshot["reconcile"] = reconcile(prev, snapshot, now)
    snapshot["drift"] += changes(prev, snapshot, srcs)
    for item in snapshot["drift"]:
        if item["code"] == "exposure-changed" and item.get("from") in ("public", "private") and item.get("to") in ("public", "private"):
            snapshot["attention"].append({"risk": RISKS["churn"], "severity": 2, "id": item["id"], "where": item["id"],
                                          "detail": item["detail"], "basis": "measured"})
    snapshot["degraded_reasons"] = degraded_reasons(snapshot, census_data)
    return snapshot


CHANGE_FACETS = ("layer", "standing", "liveness", "running", "exposure")


def changes(prev, snapshot, srcs=None):
    """DRIFT section 4: what moved since the previous snapshot (records added, missing, gone and
    returned; facet transitions; group count deltas) plus the pulse transitions inside the
    history window. Nothing is compared when there is no previous snapshot."""
    out = []
    result = snapshot.get("reconcile") or {}
    for code in ("added", "missing", "gone", "returned"):
        for rid in result.get(code) or []:
            if prev is not None:
                out.append({"section": 4, "code": "record-" + code, "id": rid, "detail": code})
    before = {r["id"]: r for r in _prev_records(prev)}
    for record in snapshot["records"]:
        old = before.get(record["id"])
        if old is None or record.get("presence") != "present":
            continue
        if record["kind"] == "project":
            for name in CHANGE_FACETS:
                a = ((old.get("facets") or {}).get(name) or {}).get("value")
                b = ((record.get("facets") or {}).get(name) or {}).get("value")
                if a != b:
                    out.append({"section": 4, "code": name + "-changed", "id": record["id"],
                                "detail": "%s -> %s" % (a, b), "from": a, "to": b})
        elif record["kind"] == "group" and old.get("count_now") != record.get("count_now"):
            out.append({"section": 4, "code": "group-count-changed", "id": record["id"],
                        "detail": "%s -> %s" % (old.get("count_now"), record.get("count_now")),
                        "from": old.get("count_now"), "to": record.get("count_now")})
    # Only pulse transitions after the previous run are changes since it; the same history window
    # read twice must not report the same transition twice.
    since = epoch(prev.get("observed_at")) if isinstance(prev, dict) else None
    if since is None and before:
        since = max((epoch(r.get("observed_at")) or 0) for r in before.values()) or None
    history = ((srcs or {}).get("pulse") or {}).get("history") or {}
    transitions = (history.get("transitions") or []) if since is not None else []
    for item in transitions:
        at = epoch(item.get("at"))
        if at is not None and at > since:
            out.append({"section": 4, "code": "pulse-transition", "id": item.get("id"),
                        "detail": "%s -> %s at %s" % (item.get("from"), item.get("to"), item.get("at")),
                        "from": item.get("from"), "to": item.get("to")})
    return out


def _assemble(j):
    for project in j.projects.values():
        for key in ("checkouts", "surfaces", "schedulers", "group_ids", "relations", "packages"):
            project[key] = sorted(set(project[key]))
    for package in j.packages.values():
        package["relations"] = sorted(set(package["relations"]))
    order = {kind: i for i, kind in enumerate(RECORD_KINDS)}
    records = (list(j.projects.values()) + list(j.co.values()) + list(j.groups.values()) + list(j.families.values())
               + list(j.surfaces.values()) + list(j.zones.values()) + list(j.schedulers.values())
               + list(j.artifacts.values()) + j.other_records() + list(j.relations.values()) + list(j.packages.values()))
    return sorted(records, key=lambda r: (order.get(r["kind"], 99), r["id"]))


def observer_coverage(obs):
    """The observer's own coverage when its run.json has one (observations, ok, errors,
    unavailable), else its zone scope. Its zone count is not coverage: 21 of 21 zones can be in
    scope while most observations failed."""
    cov = obs.get("coverage") or {}
    if isinstance(cov.get("observations"), int) and isinstance(cov.get("ok"), int):
        errors = (cov.get("errors") or 0) + (cov.get("unavailable") or 0)
        return {"expected": cov["observations"], "observed": cov["ok"], "errors": errors,
                "complete": cov.get("complete")}
    return {"expected": obs.get("zones_expected"), "observed": len(obs.get("zone_names") or []),
            "errors": obs.get("errors_n")}


def worst_source(entries):
    """The source that sets the banner: worst freshness among configured sources, required first.
    An optional source that is merely absent does not outrank one that was read and is stale."""
    pool = [e for e in (entries or {}).values()
            if e.get("configured") and (e.get("required") or e.get("freshness") != "missing")]
    if not pool:
        return None
    best = max(pool, key=lambda e: (FRESHNESS_ORDER.index(e["freshness"]), e["required"], e["id"]))
    return {k: best.get(k) for k in ("id", "freshness", "age_s", "required", "note")}


def foundation_summary(foundation):
    """What the atlas section 0 needs from read_foundation, without the parsed roster rows."""
    foundation = foundation or {}
    refs = {}
    for ref, data in (foundation.get("refs") or {}).items():
        refs[ref] = {k: data.get(k) for k in ("status", "commit", "committed_at", "layers", "citizens_dir",
                                              "rights_baselines", "schema_check", "parse_errors", "reason")}
        arch = data.get("architecture") or {}
        refs[ref]["architecture"] = {"mapped": arch.get("mapped"), "row_count": arch.get("row_count"),
                                     "unmapped_layers": arch.get("unmapped_layers")}
        refs[ref]["rules"] = {k: v for k, v in (data.get("rules") or {}).items() if k != "fleet_defaults"}
    return {"kos_path": foundation.get("kos_path"), "remote_id": foundation.get("remote_id"), "refs": refs,
            "fetch_head": foundation.get("fetch_head"), "ahead_behind": foundation.get("ahead_behind"),
            "divergence": foundation.get("divergence") or [], "alerts": foundation.get("alerts") or [],
            "observed_at": foundation.get("observed_at")}


def degraded_reasons(snapshot, census_data=None):
    """Reasons this snapshot is degraded (exit 10), each stated plainly; T7 adds lock and tree ones."""
    reasons = list((census_data or {}).get("degraded_reasons") or [])
    for sid, entry in sorted((snapshot.get("sources") or {}).items()):
        if not entry.get("configured"):
            continue
        if entry["freshness"] in ("stale", "missing", "error") and (entry["required"] or entry["freshness"] != "missing"):
            reasons.append("%s %s%s" % (sid, entry["freshness"], " (required)" if entry["required"] else ""))
        if entry["required"] and entry["freshness"] == "aging":
            reasons.append("%s aging (required)" % sid)
        if entry.get("propagates"):
            reasons.append(entry["propagates"])
    unmapped = sorted({q["detail"] for q in snapshot.get("queue") or [] if q["reason"] == "unmapped-tag"})
    if unmapped:
        reasons.append("%d unmapped raw tags" % len(unmapped))
    authority = snapshot.get("authority") or {}
    if decisions.conflict_reason(authority):
        reasons.append(decisions.conflict_reason(authority))
    if authority.get("unreadable"):
        reasons.append("the primary kingdom-os ref %s (%s) could not be read; this run resolved KINGDOM facets "
                       "on %s" % (authority["unreadable"], authority.get("decision") or authority.get("basis"),
                                  snapshot.get("ref")))
    for view in ("hygiene", "ideas"):
        if (snapshot.get(view) or {}).get("degraded"):
            reasons.append(snapshot[view]["degraded"])
    return reasons


# ── facet views (for ls and the atlas chips) ────────────────────────────────────────────────

def facet_index(records, facets=NAVIGATION):
    """{facet: {value: [project ids]}}; a contested record is listed under every candidate value."""
    index = {name: {} for name in facets}
    for record in records:
        if record.get("kind") != "project":
            continue
        for name in facets:
            facet = (record.get("facets") or {}).get(name) or {}
            values = facet.get("values") if "values" in facet else contested_values(facet)
            if not values:
                values = [facet.get("status") or "unknown"]
            for value in values:
                index[name].setdefault(value, []).append(record["id"])
    return index


# ── validation (spec 6.10) ──────────────────────────────────────────────────────────────────

def _type_ok(value, spec):
    kind = spec.get("type", "any")
    if value is None:
        return bool(spec.get("nullable"))
    checks = {"str": lambda v: isinstance(v, str), "int": lambda v: isinstance(v, int) and not isinstance(v, bool),
              "bool": lambda v: isinstance(v, bool), "list": lambda v: isinstance(v, list),
              "dict": lambda v: isinstance(v, dict), "iso": lambda v: isinstance(v, str) and parse_iso(v) is not None,
              "date": lambda v: isinstance(v, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", v) is not None,
              "facet": lambda v: isinstance(v, dict) and "status" in v and ("value" in v or "values" in v),
              "any": lambda v: True}
    return checks.get(kind, lambda v: False)(value)


def _enum_values(name, contract, facets, enums, live=None):
    if name.startswith("kingdom:"):
        return set((enums or {}).get(name.split(":", 1)[1]) or [])
    if name.startswith("facets:"):
        # "/" separates the table path because a vocabulary name may hold a dot (be.framework_domain).
        path = name.split(":", 1)[1]
        node = facets or {}
        for part in path.split("/"):
            node = (node or {}).get(part) or {}
        values = node.get("values") if isinstance(node, dict) else None
        found = set(values) if isinstance(values, (dict, list)) else set()
        return found | set((live or {}).get(path) or [])
    return set(((contract or {}).get("enum") or {}).get(name) or [])


def validate(records, contract, enums=None, facets=None, proposals=None, live=None):
    """Check records against vocab/records.toml: unique ids, kinds, id patterns, required fields,
    types, enum membership (KINGDOM facets against the live enums passed in, never a copy; hosting
    also accepts the REGISTRY runtime prefixes read live, passed as live) and referential
    integrity of present records. records may be the snapshot itself, which then supplies enums
    and live values. Returns {ok, problems[{id, field, problem}]}."""
    if isinstance(records, dict):
        enums = enums if enums is not None else records.get("enums")
        live = live if live is not None else records.get("live_values")
    rows = records.get("records") if isinstance(records, dict) else records
    kinds = (contract or {}).get("kind") or {}
    problems = []
    ids = {}
    for record in rows or []:
        rid = record.get("id")
        if rid in ids:
            problems.append({"id": rid, "field": "id", "problem": "duplicate id"})
        ids[rid] = record.get("kind")
    known = dict(ids)
    for prop in proposals or []:
        known[prop.get("id")] = "proposal"
    for record in rows or []:
        rid, kind = record.get("id"), record.get("kind")
        table = kinds.get(kind)
        if table is None:
            problems.append({"id": rid, "field": "kind", "problem": "unknown kind %r" % kind})
            continue
        pattern = table.get("id_pattern")
        if pattern and not (isinstance(rid, str) and re.fullmatch(pattern, rid)):
            problems.append({"id": rid, "field": "id", "problem": "id does not match %s" % pattern})
        # A missing or gone stub keeps the previous run's references; only present records must
        # point at records of this run.
        refs = known if record.get("presence", "present") == "present" else None
        sections = [("", record, table.get("fields") or {})]
        for parent, specs in (table.get("subfields") or {}).items():
            container = record.get(parent)
            if isinstance(container, dict):
                sections.append((parent + ".", container, specs))
        for prefix, container, specs in sections:
            for field, spec in specs.items():
                if field not in container:
                    if not spec.get("optional"):
                        problems.append({"id": rid, "field": prefix + field, "problem": "missing"})
                    continue
                value = container[field]
                if not _type_ok(value, spec):
                    problems.append({"id": rid, "field": prefix + field, "problem": "not %s" % spec.get("type")})
                    continue
                problems += _check_values(rid, prefix + field, value, spec, contract, facets, enums, refs, live)
    return {"ok": not problems, "problems": problems}


def _check_values(rid, field, value, spec, contract, facets, enums, known, live=None):
    problems = []
    if value is None:
        return problems
    if spec.get("enum"):
        allowed = _enum_values(spec["enum"], contract, facets, enums, live)
        if spec.get("type") == "facet":
            values = value.get("values") if "values" in value else ([value.get("value")] if value.get("value") is not None else [])
            if spec["enum"].startswith("kingdom:"):
                values = values + [c.get("value") for c in value.get("candidates") or []]
            statuses = set(spec.get("statuses") or []) | {VALUE_STATUS}
            if value.get("status") not in statuses:
                problems.append({"id": rid, "field": field, "problem": "status %r not allowed" % value.get("status")})
        else:
            values = value if isinstance(value, list) else [value]
        for item in values:
            if item not in allowed:
                problems.append({"id": rid, "field": field, "problem": "%r not in %s" % (item, spec["enum"])})
    if spec.get("ref") and known is not None:
        targets = value if isinstance(value, list) else [value]
        wanted = spec["ref"].split("|")
        for target in targets:
            if known.get(target) not in wanted:
                problems.append({"id": rid, "field": field, "problem": "dangling reference %r" % target})
    return problems


# ── reconciliation (spec 6.10) ──────────────────────────────────────────────────────────────

def reconcile(prev, snapshot, now=None):
    """Mark presence across runs. An id of the previous run that is absent now becomes missing
    (first absence), then gone once a later absence is at least 24 h after the first; a gone stub
    is carried for 30 days. A returning id is present again. Stubs are appended to the snapshot's
    records. Returns {added, missing, gone, returned, dropped}."""
    now = now or safety.utc_now()
    now_iso = safety.iso(now)
    current = snapshot["records"] if isinstance(snapshot, dict) else snapshot
    by_id = {r["id"]: r for r in current}
    previous = {r["id"]: r for r in _prev_records(prev) if r.get("id")}
    out = {"added": [], "missing": [], "gone": [], "returned": [], "dropped": []}
    for rid, record in by_id.items():
        before = previous.get(rid)
        if before is None:
            out["added"].append(rid)
        elif before.get("presence") in ("missing", "gone"):
            out["returned"].append(rid)
        record["presence"], record["missing_since"] = "present", None
    stubs = []
    for rid, before in sorted(previous.items()):
        if rid in by_id:
            continue
        since = before.get("missing_since") if before.get("presence") in ("missing", "gone") else None
        if since is None:
            stub = _stub(before, "missing", now_iso, now_iso, 1)
            out["missing"].append(rid)
        else:
            absences = int(before.get("absences") or 1) + 1
            elapsed = now.timestamp() - (epoch(since) or now.timestamp())
            if before.get("presence") == "gone" and elapsed > GONE_KEEP_S:
                out["dropped"].append(rid)
                continue
            presence = "gone" if absences >= 2 and elapsed >= GONE_AFTER_S else "missing"
            stub = _stub(before, presence, since, now_iso, absences)
            out[presence].append(rid)
        stubs.append(stub)
    current.extend(stubs)
    return out


def _stub(before, presence, since, now_iso, absences):
    stub = json.loads(json.dumps(before))
    stub.update(presence=presence, missing_since=since, absences=absences,
                last_seen=before.get("last_seen") or before.get("observed_at"), observed_at=now_iso)
    return stub
