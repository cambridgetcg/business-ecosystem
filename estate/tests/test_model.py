"""Model tests: the facet registry and record contract, KINGDOM layer resolution per ref, the join
over the synthetic estate, facets, freshness, validation and reconciliation.

In-memory cases are shaped like census.run_census and kingdom.read_foundation output; the fixture
cases run the real census and foundation readers over the synthetic estate of spec 13, with a
synthetic curation written into its layer. Strings the privacy lint rejects are built in parts."""
import copy
import datetime as dt
import os
import re
import shutil
import tomllib

from . import fixture
import census
import curate
import kingdom
import model
import proposals
import safety

LAYER = fixture.LAYER_DIR
NOW = dt.datetime(2026, 10, 17, 12, 0, tzinfo=dt.timezone.utc)
NOW_ISO = safety.iso(NOW)
MINI_HOME = "/nonexistent-estate-test/home"
LOCAL = "local" + ":"
ENUM_WORDS = {v for values in fixture.KINGDOM_ENUMS.values() for v in values}
VOCAB = model.load_vocab(LAYER)


def _iso_days_ago(days):
    return safety.iso(NOW - dt.timedelta(days=days))


# ── in-memory structures shaped like T2/T3 output ───────────────────────────────────────────

def mini_checkout(path, remote=None, card=None, card_tracked=True, days=2, **fields):
    """A census.measure()-shaped checkout record, measured ok."""
    info = {"path": path, "gitkind": "dir", "hub": None, "is_worktree": False, "is_hub": False,
            "submodule_of": None, "nested_in": None, "alternates": [], "registrations": [],
            "discovered_by": "walk", "problems": []}
    rec = census._blank(info, MINI_HOME, NOW_ISO)
    ident = safety.normalize_remote(remote) if remote else None
    rec.update(measure_status="ok", born=True, branch="main", detached=False, head="a" * 40, root_commit="b" * 40,
               root_commits=1, commits=3, shallow=False, last_commit_at=_iso_days_ago(days),
               remotes={"origin": ident} if ident else {}, primary_remote=ident,
               primary_remote_name="origin" if ident else None, unpushed_commits=0, stash_count=0,
               dirty={"modified": 0, "untracked": 0, "mode": "normal"}, partial={"flag": False, "reasons": []},
               tracked_files=4, top_ext=[[".md", 4]], manifests=[], manifests_tracked=[], workflows=[],
               has_claude_md=False, wake_markers={"wake_md": False, "hook_file": False, "session_start": False},
               fate=False, rest_marker=[], readme_title=None, post_commit_hook=False,
               upstream={"state": "tracking", "ref": "origin/main", "ahead": 0, "behind": 0, "as_of_fetch": NOW_ISO})
    if card is not None:
        rec["card"] = {"present": True, "tracked": card_tracked, "text_sha256": safety.sha12(card), "text": card}
    else:
        rec["card"] = {"present": False, "tracked": None, "text_sha256": None, "text": None}
    rec.update(fields)
    return rec


def mini_ref(ref, roster_text, fleet_layer="fleet", name_overrides=True):
    return {"ref": ref, "status": "ok", "commit": "c" * 40, "card_enums": copy.deepcopy(fixture.KINGDOM_ENUMS),
            "layers": list(fixture.LAYER_ORDER),
            "required_card_fields": ["name", "kind", "layer", "owner_sister", "domain", "state", "purpose", "dependsOn"],
            "optional_card_fields": ["adopts"], "rights_baselines": ["xenia.rights/0.1"],
            "citizens_dir": ["Desktop", "citizens"], "citizens_dir_path": os.path.join(MINI_HOME, "Desktop", "citizens"),
            "rules": {"fleet_forced_layer": fleet_layer, "fleet_defaults": {"kind": "service"},
                      "card_name_overrides": name_overrides, "depends_filtered": True,
                      "name_mismatch_code": not name_overrides, "unknown_dependency_code": True},
            "roster": kingdom.parse_roster(roster_text, MINI_HOME), "architecture": {"mapped": None},
            "schema_check": {"ok": True, "mismatches": []}, "parse_errors": []}


def mini_foundation(roster_text, origin_roster_text=None):
    return {"kos_path": os.path.join(MINI_HOME, "Desktop", "kingdom-os"), "remote_id": kingdom.KOS_REMOTE_ID,
            "refs": {kingdom.WORKTREE: mini_ref(kingdom.WORKTREE, roster_text),
                     kingdom.ORIGIN_MAIN: mini_ref(kingdom.ORIGIN_MAIN, origin_roster_text or roster_text,
                                                   name_overrides=False)},
            "fetch_head": {"mtime": NOW_ISO, "age_s": 3600, "reason": None}, "ahead_behind": {"ahead": 0, "behind": 0},
            "divergence": [], "alerts": [], "observed_at": NOW_ISO}


def mini_sources(listing=None):
    pulse = {"status": {"state": "ok", "generated_at": _iso_days_ago(0), "rows": [], "alerts": 0},
             "history": {"state": "ok", "lines": 1, "transitions": [], "last": None, "mtime": NOW_ISO}}
    repos = {r["id"]: dict(r, listing=0) for r in listing or []}
    forge = {"status": "ok", "repos": repos, "errors": [],
             "listings": [{"path": "x", "forge": "github", "owners": ["cambridgetcg"], "count": len(repos),
                           "unrecognised": 0, "age_s": 3600, "mtime": NOW_ISO, "sha256": None}]}
    return {"pulse": pulse, "registry": {"status": "ok", "services": [], "ids": [], "runtime_prefixes": [], "errors": []},
            "forge": forge, "global_wake": {"present": False, "status": "ok"}}


def empty_curated():
    return {"families": {}, "projects": {}, "groups": {}, "identity": [], "surfaces": [], "zones": [],
            "disputes": [], "questions": [], "upstream_notes": [], "owners": {"github": ["cambridgetcg"]},
            "legal": {}, "decisions": [], "private": {"projects": {}, "estate": {}}, "status": {}, "problems": []}


def mini_build(checkouts, roster_text="", listing=None, curated=None, origin_roster_text=None):
    data = {"checkouts": checkouts, "artifacts": [], "coverage": {"expected": len(checkouts), "observed": len(checkouts), "errors": 0},
            "finished_at": NOW_ISO, "last_full_at": NOW_ISO, "mode": "full", "degraded_reasons": []}
    foundation = mini_foundation(roster_text, origin_roster_text)
    snapshot = model.build_records(data, foundation, mini_sources(listing), curated or empty_curated(), VOCAB,
                                   None, {"kingdom": {"ref": kingdom.WORKTREE}}, now=NOW, home=MINI_HOME)
    return snapshot, foundation


def projects(snapshot):
    return {r["id"]: r for r in snapshot["records"] if r["kind"] == "project"}


def repo_path(*parts):
    return os.path.join(MINI_HOME, "Desktop", *parts)


# ── vocabulary files ────────────────────────────────────────────────────────────────────────

def _strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for value in node.values():
            yield from _strings(value)
    elif isinstance(node, list):
        for value in node:
            yield from _strings(value)


class VocabularyTests(fixture.EstateTestCase):

    def setUp(self):
        super().setUp()
        with open(os.path.join(LAYER, "vocab", "facets.toml"), "rb") as stream:
            self.facets = tomllib.load(stream)
        with open(os.path.join(LAYER, "vocab", "records.toml"), "rb") as stream:
            self.records = tomllib.load(stream)

    def test_navigation_lists_exactly_thirteen_facets(self):
        # The thirteenth, sphere, is owner decision D4's KINGDOM OS facet.
        navigation = self.facets["meta"]["navigation"]
        self.assertEqual(len(navigation), 13)
        self.assertEqual(navigation[-1], "sphere")
        self.assertEqual(tuple(navigation), model.NAVIGATION)
        for name in navigation:
            self.assertIn(name, self.facets["facet"])
        self.assertEqual(model.facets_problems(self.facets), [])

    def test_kingdom_tables_are_pointers_without_enum_literals(self):
        owned = [(group, name, table) for group in ("facet", "display")
                 for name, table in self.facets[group].items() if table.get("owner") == "kingdom"]
        self.assertEqual({name for _, name, _ in owned},
                         {"layer", "kind", "state", "owner_sister", "domain", "adopts", "conformance"})
        for group, name, table in owned:
            self.assertNotIn("values", table, "%s.%s must not list values" % (group, name))
            self.assertIn("pointer", table)
            for text in _strings(table):
                # Hyphenated names stay whole: "kingdom-os" names a repository, not a layer value.
                words = {w.strip(".-") for w in re.findall(r"[a-z0-9][a-z0-9_.-]*", text.lower())}
                self.assertFalse(words & ENUM_WORDS, "%s.%s spells %s" % (group, name, words & ENUM_WORDS))

    def test_hosting_names_registry_source_and_nine_extensions(self):
        hosting = self.facets["facet"]["hosting"]
        self.assertIn("REGISTRY", hosting["kingdom_source"])
        self.assertIn("runtime prefix", hosting["kingdom_source"])
        self.assertEqual(len(hosting["extensions"]), 9)
        self.assertTrue(all(x.startswith("x-") and x in hosting["values"] for x in hosting["extensions"]))

    def test_values_agree_with_the_curation_vocabulary(self):
        f = self.facets
        self.assertEqual(set(f["vocab"]["risk"]["values"]), set(curate.RISKS.values()))
        # Every tag-map expectation target must be a value or a status of its facet here.
        for facet in ("liveness", "hosting", "stack", "exposure", "standing", "provenance", "checkout_role"):
            table = (f["facet"].get(facet) or f["display"].get(facet) or f["vocab"].get(facet))
            values, statuses = set(table["values"]), set(table.get("statuses") or [])
            expect = set(curate.EXPECT[facet])
            self.assertTrue(values <= expect <= values | statuses, facet)
        self.assertEqual(set(f["facet"]["role"]["values"]), set(curate.ROLES))
        self.assertEqual(set(f["display"]["role_status"]["values"]), set(curate.ROLE_STATUS))
        self.assertEqual(set(f["facet"]["family"]["values"]), set(curate.FAMILIES))
        self.assertEqual(set(f["facet"]["topic"]["values"]), set(curate.TOPIC_SEEDS))
        self.assertEqual(set(f["business"]["purpose_group"]["values"]), set(curate.PURPOSE_GROUPS))
        self.assertEqual(set(f["business"]["be.framework_domain"]["values"]), set(curate.FRAMEWORK_DOMAINS))
        self.assertEqual(set(f["vocab"]["artifact_kind"]["values"]), set(curate.ARTIFACT_KINDS))
        self.assertEqual(set(f["vocab"]["relation"]["values"]), set(curate.RELATION_VERBS))
        self.assertEqual(set(f["vocab"]["tag_drop"]["values"]), set(curate.DROP_REASONS))

    def test_every_other_vocabulary_value_has_a_definition(self):
        for group in ("facet", "display", "business", "claim", "vocab"):
            for name, table in self.facets[group].items():
                for value, definition in (table.get("values") or {}).items():
                    self.assertTrue(isinstance(definition, str) and definition.strip(), "%s.%s.%s" % (group, name, value))
        for name in ("display", "business", "claim"):
            self.assertIn(name, self.facets)
        for name in ("checkout_role", "risk", "relation", "attribution", "surface_health", "scheduler_health", "artifact_kind"):
            self.assertIn(name, self.facets["vocab"])

    def test_records_contract_holds_every_kind_of_spec_3(self):
        kinds = self.records["kind"]
        for kind in ("project", "checkout", "group", "family", "surface", "zone", "scheduler", "artifact",
                     "device", "account", "relation", "proposal", "source"):
            self.assertIn(kind, kinds)
            self.assertTrue(kinds[kind]["fields"], kind)
            self.assertIn(kinds[kind].get("privacy"), ("committed", "private", "derived"), kind)
            self.assertTrue(re.compile(kinds[kind]["id_pattern"]), kind)
        self.assertEqual(model.contract_problems(self.records), [])
        self.assertEqual(self.records["enum"]["measure_status"], list(census.MEASURE_STATUSES))

    def test_tag_map_reaches_closure_against_the_facet_registry(self):
        rows = VOCAB["tag_map"]
        self.assertTrue(rows)
        self.assertEqual(model.vocab_target_problems(rows, self.facets, fixture.KINGDOM_ENUMS), [])
        broken = [("made-up", ["role=astronaut", "expect:stack=cobol", "card-hint:layer=boot", "colour=red"], [], 1),
                  ("empty", [], [], 1)]
        problems = model.vocab_target_problems(broken, self.facets, fixture.KINGDOM_ENUMS)
        self.assertEqual(len(problems), 5)
        unchecked = model.vocab_target_problems([("soul", ["card-hint:layer=soul"], [], 1)], self.facets)
        self.assertEqual(unchecked, ["soul: card-hint:layer=soul unchecked (no live CARD_ENUMS given)"])

    def test_load_vocab_refuses_a_missing_contract(self):
        layer = self.case_dir()
        os.makedirs(os.path.join(layer, "vocab"))
        shutil.copy(os.path.join(LAYER, "vocab", "facets.toml"), os.path.join(layer, "vocab", "facets.toml"))
        with self.assertRaises(model.ModelError):
            model.load_vocab(layer)
        shutil.copy(os.path.join(LAYER, "vocab", "records.toml"), os.path.join(layer, "vocab", "records.toml"))
        vocab = model.load_vocab(layer)
        self.assertEqual(vocab["status"]["vocab/tag-map.tsv"], "missing")
        self.assertIsNone(vocab["tag_index"])

    def test_committed_files_of_this_task_pass_the_privacy_lint(self):
        for rel in ("vocab/facets.toml", "vocab/records.toml", "tool/model.py", "tool/proposals.py",
                    "tests/test_model.py", "tests/test_proposals.py"):
            with open(os.path.join(LAYER, rel), encoding="utf-8") as stream:
                findings = curate.lint_text(stream.read(), rel, curate.scope_of(rel))
            self.assertEqual(findings, [], rel)


# ── KINGDOM resolution in memory ────────────────────────────────────────────────────────────

class ResolutionTests(fixture.EstateTestCase):
    enums = fixture.KINGDOM_ENUMS

    def card(self, text):
        rules = mini_ref(kingdom.WORKTREE, "")
        return kingdom.parse_card(text, self.enums, rules)

    def test_card_soul_with_fleet_rule_is_contested(self):
        rules = mini_ref(kingdom.WORKTREE, "")
        card = self.card(fixture.card_text("citizen-ada", kind="lineage", layer="soul", owner_sister="sophia", domain="sophia"))
        view = kingdom.harvest_view(card, None, os.path.join(rules["citizens_dir_path"], "citizen-ada"), rules)
        one = model.resolve_field("layer", card, None, view, self.enums)
        self.assertEqual(one["status"], "contested")
        self.assertIsNone(one["value"])
        facet = model.combine_refs({kingdom.WORKTREE: one, kingdom.ORIGIN_MAIN: dict(one)}, kingdom.WORKTREE)
        self.assertEqual(facet["status"], "contested")
        self.assertIsNone(facet["value"])
        self.assertEqual(sorted((c["value"], c["source"]) for c in facet["candidates"]),
                         [("fleet", "harvest:fleet"), ("soul", "card")])
        self.assertFalse(facet["ref_divergent"])
        self.assertEqual(model.contested_values(facet), ["fleet", "soul"])

    def test_card_wins_over_roster_without_a_dispute(self):
        card = self.card(fixture.card_text("zerone-mini", kind="infra", layer="economy"))
        row = {"name": "zerone-mini", "path": repo_path("zerone-mini"), "kind": "infra", "layer": "os",
               "domain": "none", "state": "active", "purpose": "x"}
        view = kingdom.harvest_view(card, row, row["path"], mini_ref(kingdom.WORKTREE, ""))
        one = model.resolve_field("layer", card, row, view, self.enums)
        self.assertEqual((one["status"], one["value"], one["basis"]), ("settled", "economy", "card"))
        self.assertIn({"value": "os", "source": "roster"}, one["candidates"])

    def test_off_enum_only_card_has_no_value(self):
        card = self.card(fixture.card_text("lantern", layer="boot"))
        one = model.resolve_field("layer", card, None, None, self.enums)
        self.assertEqual(one["status"], "off-enum-only")
        self.assertIsNone(one["value"])
        self.assertEqual(one["off_enum"], [{"value": "boot", "source": "card"}])

    def test_inline_comment_keeps_state_off_vocabulary(self):
        card = self.card(fixture.card_text("lantern", state="active # note"))
        self.assertEqual(card["off_enum"], {"state": "active # note"})
        self.assertEqual(model.resolve_field("state", card, None, None, self.enums)["status"], "off-enum-only")

    def test_roster_fallback_and_unset(self):
        row = {"name": "plain", "layer": "os", "kind": "ops", "state": "dormant"}
        self.assertEqual(model.resolve_field("layer", None, row, None, self.enums)["status"], "roster-fallback")
        unset = model.resolve_field("layer", None, None, None, self.enums)
        self.assertEqual((unset["status"], unset["value"]), ("unset", None))

    def test_ref_divergence_alone_makes_contested(self):
        worktree = model.resolve_field("layer", None, None, None, self.enums)
        origin = model.resolve_field("layer", None, {"layer": "runtime"}, None, self.enums)
        facet = model.combine_refs({kingdom.WORKTREE: worktree, kingdom.ORIGIN_MAIN: origin}, kingdom.WORKTREE)
        self.assertTrue(facet["ref_divergent"])
        self.assertEqual(facet["status"], "contested")
        self.assertIsNone(facet["value"])
        self.assertEqual(facet["candidates"], [{"value": "runtime", "source": "roster", "ref": kingdom.ORIGIN_MAIN}])
        self.assertEqual(facet["by_ref"][kingdom.WORKTREE]["status"], "unset")

    def test_freshness_budgets(self):
        self.assertEqual(model.freshness(10, 60, 600), "fresh")
        self.assertEqual(model.freshness(100, 60, 600), "aging")
        self.assertEqual(model.freshness(1000, 60, 600), "stale")
        self.assertEqual(model.freshness(None, 60, 600), "missing")
        self.assertEqual(model.worst_freshness(["fresh", "stale", "aging"]), "stale")


class InMemoryBuildTests(fixture.EstateTestCase):
    """build_records over hand-made census and foundation structures (no git, no files)."""

    def test_card_state_archived_never_sets_liveness(self):
        card = fixture.card_text("relic", kind="lineage", layer="soul", state="archived")
        co = mini_checkout(repo_path("relic"), "https://github.com/cambridgetcg/relic.git", card=card, days=2)
        snapshot, _ = mini_build([co], listing=[{"id": "github.com/cambridgetcg/relic", "host": "github.com",
                                                 "owner": "cambridgetcg", "name": "relic", "forge": "github",
                                                 "visibility": "private", "archived": False, "pushed_at": _iso_days_ago(2)}])
        relic = projects(snapshot)["github.com/cambridgetcg/relic"]
        self.assertEqual(relic["facets"]["state"]["value"], "archived")
        self.assertEqual(relic["facets"]["liveness"]["value"], "active")
        self.assertEqual(relic["facets"]["liveness"]["basis"], "measured")
        self.assertTrue(any(d["code"] == "state-vs-liveness" and d["id"] == relic["id"] for d in snapshot["drift"]))

    def test_forge_archived_flag_alone_sets_archived(self):
        co = mini_checkout(repo_path("old"), "https://github.com/cambridgetcg/old.git", days=1)
        snapshot, _ = mini_build([co], listing=[{"id": "github.com/cambridgetcg/old", "host": "github.com",
                                                 "owner": "cambridgetcg", "name": "old", "forge": "github",
                                                 "visibility": "public", "archived": True, "pushed_at": _iso_days_ago(1)}])
        self.assertEqual(projects(snapshot)["github.com/cambridgetcg/old"]["facets"]["liveness"]["value"], "archived")

    def test_unread_sources_stay_unknown(self):
        co = mini_checkout(repo_path("blind"), "https://github.com/cambridgetcg/blind.git", last_commit_at=None,
                           tracked_files=None, top_ext=None)
        snapshot, _ = mini_build([co])
        blind = projects(snapshot)["github.com/cambridgetcg/blind"]
        self.assertEqual(blind["facets"]["liveness"]["status"], "unknown")
        self.assertIsNone(blind["facets"]["liveness"]["value"])
        self.assertEqual(blind["facets"]["stack"]["status"], "unknown")
        self.assertEqual(blind["facets"]["exposure"]["status"], "unknown")

    def test_valid_untracked_card_is_card_untracked(self):
        card = fixture.card_text("loose", kind="service", layer="runtime")
        co = mini_checkout(repo_path("loose"), "https://github.com/cambridgetcg/loose.git", card=card, card_tracked=False)
        snapshot, _ = mini_build([co])
        self.assertEqual(projects(snapshot)["github.com/cambridgetcg/loose"]["facets"]["standing"]["value"], "card-untracked")

    def test_unknown_dependency_alone_keeps_the_card_owned(self):
        card = fixture.card_text("leaner", depends=("ghost-member",))
        co = mini_checkout(repo_path("leaner"), "https://github.com/cambridgetcg/leaner.git", card=card)
        snapshot, foundation = mini_build([co])
        leaner = projects(snapshot)["github.com/cambridgetcg/leaner"]
        self.assertEqual(leaner["facets"]["standing"]["value"], "owned")
        self.assertIs(leaner["kingdom"]["card_schema_ok"], False)
        self.assertIs(leaner["kingdom"]["card_field_ok"], True)
        p06 = [p for p in proposals.propose(snapshot, foundation, now=NOW) if p["rule"] == "P06"]
        self.assertEqual([p["bulk_key"] for p in p06], ["P06:ghost-member"])

    def test_no_remote_gives_a_local_id_and_local_only_exposure(self):
        co = mini_checkout(repo_path("notes"))
        snapshot, _ = mini_build([co])
        ident = model.LOCAL + safety.HOME_PREFIX + "Desktop/notes"
        notes = projects(snapshot)[ident]
        self.assertTrue(notes["local"])
        self.assertEqual(notes["facets"]["exposure"]["value"], "local-only")
        self.assertIn(curate.RISKS["single"], notes["risks"])
        self.assertIn(model.LOCAL + "notes@" + "b" * 12, notes["aliases"])


# ── the fixture estate ──────────────────────────────────────────────────────────────────────

def write_curation(e, caveat_dir):
    """A small synthetic curation in the fixture layer: one family file, estate.toml, decisions,
    and the private projects/estate files (private/curated is 0500 between writes)."""
    citizens = {
        "family": {"id": "family:fleet-citizens", "label": "fleet-citizens", "summary": "synthetic",
                   "open_questions": [], "as_of": "2026-10-17", "review_after": "2027-01-15", "reviewed": False,
                   "source": "survey-2026-10-17"},
        "group": [{"id": "group:fleet-citizens/fixture-citizens", "label": "fixture citizens", "what": "carded citizens",
                   "role": ["citizen"], "role_status": "current",
                   "member_rule": {"kind": "names", "names": ["github.com/cambridgetcg/citizen-ada",
                                                              "github.com/cambridgetcg/citizen-bo",
                                                              "github.com/cambridgetcg/citizen-zz"]},
                   "count_at_survey": 3, "as_of": "2026-10-17", "review_after": "2027-01-15", "reviewed": False,
                   "source": "survey-2026-10-17"}],
    }
    services = {
        "family": {"id": "family:agenttool-services", "label": "agenttool-services", "summary": "synthetic",
                   "open_questions": [], "as_of": "2026-10-17", "review_after": "2027-01-15", "reviewed": True,
                   "source": "survey-2026-10-17"},
        "project": [
            {"id": "github.com/cambridgetcg/alpha-service", "name": "alpha-service", "what": "The alpha door.",
             "role": ["public-door"], "role_status": "current", "topics": ["agenttool"], "confidence": "high",
             "as_of": "2026-10-17", "review_after": "2027-01-15", "reviewed": False, "source": "survey-2026-10-17",
             "relations": [{"verb": "depends_on", "to": "github.com/cambridgetcg/kingdom-os", "raw_kind": "depends_on"},
                           {"verb": "feeds", "to": "github.com/cambridgetcg/no-such-thing", "raw_kind": "feeds"}]},
            {"id": "github.com/cambridgetcg/ghost-project", "name": "ghost-project", "what": "Curated, found nowhere.",
             "confidence": "low", "as_of": "2026-10-17", "review_after": "2026-10-01", "reviewed": False,
             "source": "survey-2026-10-17"},
        ],
    }
    estate = {
        "owners": {"github": ["cambridgetcg"], "codeberg": ["zerone-dev"]},
        "legal": {"status": "unassigned", "records": []},
        "identity": [{"id": "github.com/cambridgetcg/kingdom-mcp-trunk", "aliases": ["github.com/cambridgetcg/kingdom-mcp"]}],
        "surface": [{"id": "surface:cf-pages:alpha-pages", "provider": "cf-pages", "name": "alpha-pages",
                     "hostnames": ["alpha.example.dev"], "source_project": "github.com/cambridgetcg/alpha-service"},
                    {"id": "surface:cf-worker:agenttool-site", "provider": "cf-worker", "name": "agenttool-site",
                     "hostnames": ["agenttool.dev"], "source_project": "github.com/cambridgetcg/alpha-service"},
                    {"id": "surface:cf-pages:alpha-docs", "provider": "cf-pages", "name": "alpha-docs",
                     "hostnames": ["docs.example.dev"], "source_project": "github.com/cambridgetcg/alpha-service"}],
        "zone": [{"id": "zone:example.dev", "fqdn": "example.dev", "dns_provider": "unknown", "registrar": "unknown",
                  "surfaces": ["surface:cf-pages:alpha-pages"]}],
        "dispute": [{"id": "dispute:citizen-layer", "title": "Citizen layer", "status": "open", "question": "q:x",
                     "candidates": [{"claim": "soul", "source": "cards"}, {"claim": "fleet", "source": "harvest"}],
                     "proposal_rule": "P10"}],
        "upstream_note": [{"id": "note:fixture", "owner": "pr1-owner", "repo_id": "github.com/cambridgetcg/business-ecosystem",
                           "file": "docs/PORTFOLIO_MAP.md", "title": "Note the private area", "text": "A short doc note.",
                           "status": "proposed"}],
    }
    raw_tags = [VocabFixture.dormant_tag, VocabFixture.secret_tag, "zz-not-a-mapped-tag"]
    private_projects = {"meta": {"source": "fixture"}, "project": [
        {"id": "github.com/cambridgetcg/alpha-service", "family": "agenttool-services", "committed": True,
         "survey_id": "alpha", "path": fixture.HOME_REL + "Desktop/alpha-service", "what_full": "x",
         "risks": ["fixture risk note"], "raw_tags": raw_tags, "surfaces_raw": [], "rels_raw": [],
         "survey_claims": {"layer": "runtime", "liveness": "live"}, "queue": ["what:heavy"]},
    ]}
    private_estate = {
        "meta": {"source": "fixture"},
        "location_rule": [{"pattern": fixture.HOME_REL + ".cache/*", "checkout_role": "cache", "note": "tool caches"}],
        "canonical_override": [{"project": "github.com/cambridgetcg/lender-lib",
                                "path": fixture.HOME_REL + "Desktop/borrower-lib", "basis": "fixture"}],
        "caveat": [
            {"id": "caveat:alpha-pages-build", "pulse_id": "alpha-pages", "check": "dir-nonempty",
             "args": {"path": caveat_dir}, "note": "pages up while the build dir is empty"},
            {"id": "caveat:fixture-backup-exit3", "pulse_id": "fixture-backup", "check": "exit-code-equals",
             "args": {"label": "com.example.fixture-backup", "code": 3}, "note": "exit 3 is by design"},
        ],
        "group": [{"id": "group:fleet-citizens/desktop-citizens", "family": "fleet-citizens", "committed": False,
                   "label": "desktop citizens", "what_full": "checkouts under Desktop/citizens", "members": [],
                   "canonical_location": fixture.HOME_REL + "Desktop/citizens", "notes": "", "raw_tags": [],
                   "count_at_survey": 2, "survey_claims": {},
                   "member_rule": {"kind": "path-glob", "patterns": [fixture.HOME_REL + "Desktop/citizens/*"]}}],
        "artifact": [{"id": "artifact:fixture-keys", "family": "infra-ops", "path": fixture.HOME_REL + ".fixture-keys",
                      "artifact_kind": "keys", "what": "key dir", "role": "keys", "secret_bearing": True,
                      "contents_read": False, "backup": "unknown"}],
    }
    layer = e.layer
    os.makedirs(os.path.join(layer, "curated", "families"))
    fixture.write_file(os.path.join(layer, "curated", "families", "fleet-citizens.toml"), safety.toml_dumps(citizens))
    fixture.write_file(os.path.join(layer, "curated", "families", "agenttool-services.toml"), safety.toml_dumps(services))
    fixture.write_file(os.path.join(layer, "curated", "estate.toml"), safety.toml_dumps(estate))
    fixture.write_file(os.path.join(layer, "curated", "decisions.toml"), "")
    curated_dir = os.path.join(e.private, "curated")
    os.chmod(curated_dir, 0o700)
    fixture.write_file(os.path.join(curated_dir, "projects.toml"), safety.toml_dumps(private_projects), mode=0o600)
    fixture.write_file(os.path.join(curated_dir, "estate.toml"), safety.toml_dumps(private_estate), mode=0o600)
    os.chmod(curated_dir, 0o500)


class VocabFixture:
    """Raw tags picked from the reviewed tag map by their targets, so the tests follow the map."""
    index = VOCAB["tag_index"] or {}
    dormant_tag = next(raw for raw, targets in sorted(index.items()) if targets == ["expect:liveness=dormant"])
    secret_tag = next(raw for raw, targets in sorted(index.items())
                      if targets == ["risk=" + curate.RISKS["secret-path"]])


def build_fixture(cls):
    """One synthetic estate with curation; census, foundation and sources read for real."""
    e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
    cls.use_estate(e)
    cls.caveat_dir = os.path.join(e.home, "empty-build")
    os.makedirs(cls.caveat_dir)
    write_curation(e, cls.caveat_dir)
    cls.estate = e
    cls.census = census.run_census(e.config, None, "full", home=e.home, layer_dir=e.layer)
    cls.foundation = kingdom.read_foundation(e.kos.path)
    cls.curated = model.load_curated(e.layer)
    cls.srcs = model.gather_sources(e.config, e.kos.path, cls.curated, e.home)
    cls.snapshot = model.build_records(cls.census, cls.foundation, cls.srcs, cls.curated, VOCAB, None, e.config,
                                       home=e.home, repo_reader=model.read_canonical)
    cls.by_id = {r["id"]: r for r in cls.snapshot["records"]}


class FixtureModelTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        build_fixture(cls)

    def project(self, name, owner="github.com/cambridgetcg/"):
        return self.by_id[owner + name]

    def checkout_at(self, path):
        return self.by_id[census.checkout_id(path)]

    def test_snapshot_validates_against_the_contract(self):
        result = model.validate(self.snapshot, VOCAB["records"], facets=VOCAB["facets"])
        self.assertEqual(result["problems"], [])
        self.assertEqual(self.snapshot["schema"], "estate.snapshot/1")
        self.assertEqual(self.snapshot["layers"], fixture.LAYER_ORDER)

    def test_validate_checks_kingdom_values_against_the_live_enums(self):
        snapshot = copy.deepcopy(self.snapshot)
        enums = copy.deepcopy(snapshot["enums"])
        self.assertTrue(model.validate(snapshot, VOCAB["records"], enums, VOCAB["facets"])["ok"])
        enums["layer"] = [v for v in enums["layer"] if v != "economy"]
        problems = model.validate(snapshot, VOCAB["records"], enums, VOCAB["facets"])["problems"]
        self.assertTrue(any(p["field"] == "facets.layer" and "economy" in p["problem"] for p in problems))

    def test_validate_reports_broken_records(self):
        snapshot = copy.deepcopy(self.snapshot)
        rows = snapshot["records"]
        alpha = next(r for r in rows if r["id"] == "github.com/cambridgetcg/alpha-service")
        alpha["facets"]["layer"]["value"] = "boot"
        alpha["checkouts"].append("co:" + "0" * 12)
        rows.append(copy.deepcopy(rows[0]))
        del alpha["observed_at"]
        problems = model.validate(snapshot, VOCAB["records"], facets=VOCAB["facets"])["problems"]
        kinds = {(p["field"], p["problem"].split(" ")[0]) for p in problems}
        self.assertIn(("facets.layer", "'boot'"), kinds)
        self.assertIn(("checkouts", "dangling"), kinds)
        self.assertIn(("id", "duplicate"), kinds)
        self.assertIn(("observed_at", "missing"), kinds)

    def test_layers_resolve_per_ref_on_the_fixture(self):
        for name in ("citizen-ada", "citizen-bo"):
            layer = self.project(name)["facets"]["layer"]
            self.assertEqual((layer["status"], layer["value"]), ("contested", None))
            self.assertEqual(len(layer["candidates"]), 2)
        mini = self.project("zerone-mini", "codeberg.org/zerone-dev/")["facets"]["layer"]
        self.assertEqual((mini["status"], mini["value"]), ("settled", "economy"))
        lantern = self.project("boot-lantern")
        self.assertEqual(lantern["kingdom"]["off_enum"], {"layer": "boot", "state": "active # note"})
        self.assertEqual(lantern["facets"]["layer"]["status"], "roster-fallback")
        self.assertEqual(lantern["facets"]["standing"]["value"], "card-invalid")
        edge = self.project("edge-worker")["facets"]["layer"]
        self.assertTrue(edge["ref_divergent"])
        self.assertEqual(edge["status"], "contested")

    def test_identity_alias_and_project_join(self):
        trunk = self.project("kingdom-mcp-trunk")
        co = self.by_id[trunk["checkouts"][0]]
        self.assertEqual(co["project_id"], trunk["id"])
        self.assertEqual(co["project_basis"], "identity")
        self.assertIn("github.com/cambridgetcg/kingdom-mcp", trunk["aliases"])
        borrower = self.checkout_at(self.estate.borrower)
        self.assertEqual((borrower["project_id"], borrower["project_basis"]), ("github.com/cambridgetcg/lender-lib", "file-remote"))

    def test_forge_only_and_orphaned_curation(self):
        only = self.project("forge-only-thing")
        self.assertEqual(only["checkouts"], [])
        self.assertFalse(only["flags"]["checkout_present"])
        self.assertEqual(only["facets"]["standing"]["status"], "unknown")
        self.assertEqual(only["facets"]["exposure"]["value"], "private")
        ghost = self.project("ghost-project")
        self.assertTrue(ghost["flags"]["orphaned_curation"])
        reasons = {(q["reason"], q["id"]) for q in self.snapshot["queue"]}
        self.assertIn(("orphaned-curation", ghost["id"]), reasons)
        self.assertIn(("review-overdue", ghost["id"]), reasons)
        self.assertTrue(any(q["reason"] == "orphaned-curation" and "no-such-thing" in q["detail"]
                            for q in self.snapshot["queue"]))

    def test_canonical_checkout_rules(self):
        self.assertEqual(self.project("alpha-service")["canonical_basis"], "scheduler-target")
        self.assertEqual(self.project("kingdom-os")["canonical_basis"], "default-branch-newest")
        lender = self.project("lender-lib")
        self.assertEqual(lender["canonical_basis"], "override")
        self.assertEqual(lender["canonical_checkout"], census.checkout_id(self.estate.borrower))
        self.assertEqual(self.checkout_at(self.estate.lender)["checkout_role"], "clone")
        self.assertEqual(self.checkout_at(self.estate.worktree)["checkout_role"], "linked-worktree")
        mirror = self.project("vendor-mirror", "github.com/example/")
        self.assertEqual(mirror["canonical_basis"], "shortest-path")

    def test_running_is_contradicted_by_a_caveat(self):
        alpha = self.project("alpha-service")
        self.assertEqual(alpha["facets"]["running"]["value"], "contradicted")
        surface = self.by_id["surface:cf-pages:alpha-pages"]
        self.assertEqual(surface["health"]["state"], "contradicted")
        self.assertIs(surface["health"]["caveat"]["result"], False)
        backup = self.by_id["sched:launchd:com.example.fixture-backup"]
        self.assertEqual(backup["health"]["state"], "failing")
        self.assertTrue(backup["health"]["caveat"]["contradicts"])
        greens = {d["id"] for d in self.snapshot["drift"] if d["section"] == 6}
        self.assertEqual(greens, {surface["id"], backup["id"]})
        self.assertIn(curate.RISKS["hollow"], alpha["risks"])

    def test_hosting_carries_attribution_classes(self):
        hosting = self.project("alpha-service")["facets"]["hosting"]
        self.assertEqual(hosting["attribution"]["cf-pages"], "current_source_document")
        self.assertEqual(hosting["attribution"]["fly"], "candidate_only")  # untracked edit: not clean
        self.assertEqual(hosting["attribution"]["local-launchd"], "current_source_document")
        self.assertEqual(self.project("beta-site")["facets"]["running"]["value"], "unprobed")
        self.assertEqual(self.project("plain-tool")["facets"]["running"]["value"], "none")

    def test_other_facets(self):
        self.assertEqual(self.project("edge-worker")["facets"]["stack"]["values"][0], "typescript")
        self.assertEqual(self.project("zerone-mini", "codeberg.org/zerone-dev/")["facets"]["stack"]["values"], ["go"])
        self.assertIn("terraform", self.project("infra-tf")["facets"]["stack"]["values"])
        self.assertEqual(self.project("alpha-service")["facets"]["exposure"]["value"], "public")
        self.assertEqual(self.project("plain-tool")["facets"]["liveness"]["value"], "archived")
        self.assertTrue(self.project("zerone-mini", "codeberg.org/zerone-dev/")["flags"]["resting"])
        standing = {n: self.project(n)["facets"]["standing"].get("value")
                    for n in ("alpha-service", "business-ecosystem", "beta-site")}
        self.assertEqual(standing, {"alpha-service": "owned", "business-ecosystem": "listed", "beta-site": "unlisted"})

    def test_curated_family_role_topic_and_groups(self):
        alpha = self.project("alpha-service")
        self.assertEqual(alpha["facets"]["family"]["value"], "agenttool-services")
        self.assertEqual(alpha["facets"]["role"]["values"], ["public-door"])
        self.assertEqual(alpha["facets"]["topic"]["values"], ["agenttool"])
        ada = self.project("citizen-ada")
        self.assertEqual((ada["facets"]["family"]["value"], ada["facets"]["family"]["basis"]), ("fleet-citizens", "group"))
        group = self.by_id["group:fleet-citizens/fixture-citizens"]
        self.assertEqual((group["count_now"], group["delta"]), (2, -1))
        self.assertEqual(group["kingdom_claims"]["candidates"], {"card=soul": 2, "harvest:fleet=fleet": 2})
        desktop = self.by_id["group:fleet-citizens/desktop-citizens"]
        self.assertEqual(desktop["member_kind"], "checkout")
        self.assertEqual(desktop["count_now"], 3)
        self.assertEqual(self.snapshot["counts"]["computed"]["citizens"], 3)

    def test_tag_expectations_and_unmapped_tags(self):
        alpha = self.project("alpha-service")
        failed = [t for t in alpha["tag_expectations"] if t["result"] == "failed"]
        self.assertEqual([t["target"] for t in failed], ["expect:liveness=dormant"])
        self.assertEqual(alpha["unmapped_tags"], ["zz-not-a-mapped-tag"])
        self.assertTrue(any(d["code"] == "tag-expectation-failed" and d["id"] == alpha["id"] for d in self.snapshot["drift"]))
        self.assertTrue(any(q["reason"] == "unmapped-tag" for q in self.snapshot["queue"]))
        self.assertTrue(any(a["basis"] == "tag" and a["risk"] == curate.RISKS["secret-path"] for a in self.snapshot["attention"]))
        self.assertIn("1 unmapped raw tags", self.snapshot["degraded_reasons"])

    def test_measured_risks_reach_attention(self):
        alpha = self.project("alpha-service")
        for key in ("unsaved", "unpushed"):
            self.assertIn(curate.RISKS[key], alpha["risks"])
        self.assertIn(curate.RISKS["partial"], self.project("promisor-demo")["risks"])
        lender = self.project("lender-lib")
        self.assertIn(curate.RISKS["lender"], lender["risks"])
        self.assertIn(curate.RISKS["prunable"], self.project("lane-repo")["risks"])
        self.assertTrue(any(a["id"] == "artifact:fixture-keys" for a in self.snapshot["attention"]))
        self.assertEqual(alpha["risk_notes"], ["fixture risk note"])

    def test_freshness_worst_source_and_counts(self):
        sources = self.snapshot["sources"]
        self.assertEqual(sources["src:forge:0"]["freshness"], "stale")
        self.assertEqual(sources["src:pulse"]["freshness"], "fresh")
        self.assertTrue(sources["src:census"]["required"])
        self.assertTrue(self.snapshot["worst_source"]["id"].startswith("src:forge"))
        self.assertTrue(any("src:forge" in r and "stale" in r for r in self.snapshot["degraded_reasons"]))
        # The fixture observer run says degraded; that propagates as a reason of its own.
        self.assertIn("cloudflare-observer reports degraded", self.snapshot["degraded_reasons"])
        contract = {"kind": {"source": VOCAB["records"]["kind"]["source"]}, "enum": VOCAB["records"]["enum"]}
        entries = [dict(e, kind="source") for e in sources.values()]
        self.assertEqual(model.validate(entries, contract)["problems"], [])
        census_cov = sources["src:census"]["coverage"]
        self.assertEqual(census_cov["expected"], census_cov["observed"] + census_cov["errors"])
        counts = self.snapshot["counts"]
        self.assertEqual({d["id"] for d in counts["disagreements"]}, {"citizens-md", "roster-header"})
        self.assertEqual([u["id"] for u in counts["unverifiable"]], ["ecosystem-status"])
        alpha = self.project("alpha-service")
        self.assertEqual(alpha["freshness"]["by_source"]["src:forge"], "stale")
        self.assertEqual(alpha["freshness"]["worst"], "stale")

    def test_zones_and_surfaces_join(self):
        zone = self.by_id["zone:example.dev"]
        self.assertIn("surface:cf-pages:alpha-pages", zone["surfaces"])
        self.assertEqual(zone["dns_provider"], "cloudflare")
        self.assertEqual(self.by_id["zone:agenttool.dev"]["dns_provider"], "cloudflare")
        api = self.by_id["surface:fly:agenttool-api"]
        self.assertIsNone(api["source_project"])
        self.assertEqual(api["unresolved_projects"], ["github.com/cambridgetcg/agenttool"])

    def test_no_secret_value_reaches_a_record(self):
        text = repr(self.snapshot)
        for planted in (fixture.PLIST_SECRET_VALUE, fixture.NEVER_READ, "PROMPT TEXT THAT MUST NEVER BE STORED"):
            self.assertNotIn(planted, text)

    def test_facet_index_lists_contested_records_under_every_candidate(self):
        index = model.facet_index(self.snapshot["records"])
        ada = "github.com/cambridgetcg/citizen-ada"
        self.assertIn(ada, index["layer"]["soul"])
        self.assertIn(ada, index["layer"]["fleet"])


# ── reconciliation ──────────────────────────────────────────────────────────────────────────

class ReconcileTests(fixture.EstateTestCase):

    def record(self, rid):
        return {"kind": "zone", "id": rid, "presence": "present", "missing_since": None, "observed_at": NOW_ISO}

    def run_at(self, prev, ids, hours):
        snapshot = {"records": [self.record(i) for i in ids]}
        moment = NOW + dt.timedelta(hours=hours)
        result = model.reconcile(prev, snapshot, moment)
        return snapshot, result

    def presence(self, snapshot, rid):
        return next(r for r in snapshot["records"] if r["id"] == rid)["presence"]

    def test_missing_then_gone_after_two_absences_a_day_apart(self):
        first, _ = self.run_at(None, ["zone:a", "zone:b"], 0)
        second, result = self.run_at(first, ["zone:a"], 1)
        self.assertEqual(result["missing"], ["zone:b"])
        self.assertEqual(self.presence(second, "zone:b"), "missing")
        third, result = self.run_at(second, ["zone:a"], 25)
        self.assertEqual(result["gone"], ["zone:b"])
        stub = next(r for r in third["records"] if r["id"] == "zone:b")
        self.assertEqual((stub["presence"], stub["absences"]), ("gone", 2))

    def test_absences_less_than_a_day_apart_stay_missing(self):
        first, _ = self.run_at(None, ["zone:a", "zone:b"], 0)
        second, _ = self.run_at(first, ["zone:a"], 1)
        third, result = self.run_at(second, ["zone:a"], 5)
        self.assertEqual(result["missing"], ["zone:b"])
        self.assertEqual(self.presence(third, "zone:b"), "missing")

    def test_a_single_absence_stays_missing_and_a_return_is_present(self):
        first, _ = self.run_at(None, ["zone:a", "zone:b"], 0)
        second, _ = self.run_at(first, ["zone:a"], 30)
        self.assertEqual(self.presence(second, "zone:b"), "missing")
        third, result = self.run_at(second, ["zone:a", "zone:b"], 60)
        self.assertEqual(result["returned"], ["zone:b"])
        self.assertEqual(self.presence(third, "zone:b"), "present")

    def test_gone_stubs_are_dropped_after_thirty_days(self):
        first, _ = self.run_at(None, ["zone:a", "zone:b"], 0)
        second, _ = self.run_at(first, ["zone:a"], 1)
        third, _ = self.run_at(second, ["zone:a"], 30)
        fourth, result = self.run_at(third, ["zone:a"], 24 * 40)
        self.assertEqual(result["dropped"], ["zone:b"])
        self.assertNotIn("zone:b", {r["id"] for r in fourth["records"]})

    def test_build_records_reconciles_against_the_previous_snapshot(self):
        a = mini_checkout(repo_path("a"), "https://github.com/cambridgetcg/a.git")
        b = mini_checkout(repo_path("b"), "https://github.com/cambridgetcg/b.git")
        first, _ = mini_build([a, b])
        data = {"checkouts": [a], "artifacts": [], "coverage": {}, "finished_at": NOW_ISO, "last_full_at": NOW_ISO}
        later = NOW + dt.timedelta(hours=2)
        second = model.build_records(data, mini_foundation(""), mini_sources(), empty_curated(), VOCAB, first,
                                     {"kingdom": {"ref": kingdom.WORKTREE}}, now=later, home=MINI_HOME)
        self.assertIn("github.com/cambridgetcg/b", second["reconcile"]["missing"])
        self.assertTrue(model.validate(second, VOCAB["records"], facets=VOCAB["facets"])["ok"])
        codes = {(d["code"], d["id"]) for d in second["drift"] if d["section"] == 4}
        self.assertIn(("record-missing", "github.com/cambridgetcg/b"), codes)

    def test_facet_transitions_and_visibility_churn(self):
        co = mini_checkout(repo_path("flip"), "https://github.com/cambridgetcg/flip.git")
        row = {"id": "github.com/cambridgetcg/flip", "host": "github.com", "owner": "cambridgetcg", "name": "flip",
               "forge": "github", "archived": False, "pushed_at": _iso_days_ago(1)}
        first, _ = mini_build([co], listing=[dict(row, visibility="private")])
        data = {"checkouts": [co], "artifacts": [], "coverage": {}, "finished_at": NOW_ISO, "last_full_at": NOW_ISO}
        later = NOW + dt.timedelta(hours=2)
        srcs = mini_sources([dict(row, visibility="public")])
        second = model.build_records(data, mini_foundation(""), srcs, empty_curated(), VOCAB, first,
                                     {"kingdom": {"ref": kingdom.WORKTREE}}, now=later, home=MINI_HOME)
        change = [d for d in second["drift"] if d["code"] == "exposure-changed"]
        self.assertEqual([(d["from"], d["to"]) for d in change], [("private", "public")])
        self.assertTrue(any(a["risk"] == curate.RISKS["churn"] for a in second["attention"]))
        self.assertEqual([d for d in first["drift"] if d["section"] == 4], [])

    def test_only_pulse_transitions_after_the_previous_run_are_changes(self):
        co = mini_checkout(repo_path("steady"), "https://github.com/cambridgetcg/steady.git")
        first, _ = mini_build([co])
        data = {"checkouts": [co], "artifacts": [], "coverage": {}, "finished_at": NOW_ISO, "last_full_at": NOW_ISO}
        srcs = mini_sources()
        srcs["pulse"]["history"]["transitions"] = [
            {"id": "old-probe", "from": "up", "to": "down", "at": _iso_days_ago(1)},
            {"id": "new-probe", "from": "down", "to": "up", "at": safety.iso(NOW + dt.timedelta(minutes=30))}]
        second = model.build_records(data, mini_foundation(""), srcs, empty_curated(), VOCAB, first,
                                     {"kingdom": {"ref": kingdom.WORKTREE}}, now=NOW + dt.timedelta(hours=1),
                                     home=MINI_HOME)
        self.assertEqual([d["id"] for d in second["drift"] if d["section"] == 4], ["new-probe"])


def bare_join(srcs=None, curated=None):
    """A _Join over nothing: enough for its unit methods."""
    return model._Join({}, {"refs": {}}, srcs or {}, curated or empty_curated(), VOCAB, {}, NOW, MINI_HOME, None)


class FixerModelTests(fixture.EstateTestCase):
    """Review findings TM-01..TM-17 and U4, U7, U8 on the model."""

    def test_a_running_launchd_job_is_not_failing(self):
        j = bare_join({"launchctl": {"status": "ok", "jobs": {"gw": {"pid": 34504, "last_exit": -15},
                                                              "dead": {"pid": None, "last_exit": 1}}}})
        running = j._launchd_health({"label": "gw"})
        self.assertEqual(running["state"], "healthy")
        self.assertIn("pid 34504", running["basis"])
        self.assertIn("previous exit -15", running["basis"])
        self.assertEqual(j._launchd_health({"label": "dead"})["state"], "failing")

    def test_empty_subdirectories_do_not_make_a_directory_nonempty(self):
        root = self.case_dir()
        models = os.path.join(root, "models")
        os.makedirs(os.path.join(models, "blobs"))
        os.makedirs(os.path.join(models, "manifests"))
        self.assertEqual(model.holds_regular_file(models)[0], False)
        fixture.write_file(os.path.join(models, "manifests", "m.json"), "{}\n")
        self.assertEqual(model.holds_regular_file(models)[0], True)
        j = bare_join()
        j.caveats = {"local-brain": {"id": "caveat:x", "pulse_id": "local-brain", "check": "dir-nonempty",
                                     "args": {"path": os.path.join(root, "empty")}, "note": "n"}}
        os.makedirs(os.path.join(root, "empty", "blobs"))
        self.assertTrue(j._caveat("local-brain", "up")["contradicts"])

    def test_an_annotating_caveat_never_turns_a_down_green(self):
        j = bare_join({"launchctl": {"status": "ok", "jobs": {"com.example.fixture-backup": {"pid": None, "last_exit": 3}}}})
        j.caveats = {"fixture-backup": {"id": "caveat:fixture-backup-exit3", "pulse_id": "fixture-backup",
                                      "check": "exit-code-equals", "effect": "annotate",
                                      "args": {"label": "com.example.fixture-backup", "code": 3},
                                      "note": "exit 3 means only unverified captures"}}
        caveat = j._caveat("fixture-backup", "down")
        self.assertEqual((caveat["result"], caveat["contradicts"], caveat["effect"]), (True, False, "annotate"))

    def test_checkouts_are_found_by_identity_whatever_the_case(self):
        root = self.case_dir()
        real = os.path.join(root, "kingdom-os")
        os.makedirs(real)
        upper = os.path.join(root, "KINGDOM-OS")
        if not os.path.exists(upper):
            self.skipTest("case-sensitive file system")
        j = bare_join()
        j.by_real = {os.path.realpath(real): "co:abc"}
        self.assertEqual(j.checkout_at(upper), "co:abc")
        self.assertIsNone(j.checkout_at(os.path.join(root, "elsewhere")))

    def test_an_ambiguous_roster_name_is_never_no_project(self):
        curated = empty_curated()
        curated["owners"] = {"github": ["cambridgetcg"], "codeberg": ["zerone-dev"]}
        card = fixture.card_text("twin")
        cos = [mini_checkout(repo_path("twin"), "https://github.com/cambridgetcg/twin.git", card=card),
               mini_checkout(repo_path("twin-cb"), "https://codeberg.org/zerone-dev/twin.git", card=card)]
        roster = "twin | " + fixture.HOME_REL + "Desktop/moved-twin | service | runtime | none | active | x\n"
        snapshot, foundation = mini_build(cos, roster_text=roster, curated=curated)
        orphans = snapshot["kingdom"]["roster"][kingdom.WORKTREE]["orphans"]
        self.assertEqual([(o["name"], o["path_status"]) for o in orphans], [("twin", "ambiguous")])
        self.assertEqual(orphans[0]["candidates"], ["codeberg.org/zerone-dev/twin", "github.com/cambridgetcg/twin"])
        props = proposals.propose(snapshot, foundation, now=NOW)
        p07 = [p for p in props if p["rule"] == "P07" and p["current"].get("name") == "twin"]
        self.assertEqual([p["title"] for p in p07], ["roster row name matches several projects"])
        self.assertNotIn("no project with that name", " ".join(p07[0]["basis"]))
        self.assertEqual([p for p in props if p["rule"] == "P09"], [])  # never a second row for the name

    def test_orphaned_curation_is_counted_apart_and_not_measured(self):
        curated = empty_curated()
        ghost = LOCAL + fixture.HOME_REL + "Desktop/ghost"
        curated["projects"] = {ghost: {"id": ghost, "name": "ghost", "private_only": True}}
        listing = [{"id": "github.com/cambridgetcg/far", "host": "github.com", "owner": "cambridgetcg", "name": "far",
                    "forge": "github", "visibility": "private", "archived": False, "pushed_at": _iso_days_ago(90)}]
        snapshot, _ = mini_build([mini_checkout(repo_path("here"), "https://github.com/cambridgetcg/here.git")],
                                 listing=listing, curated=curated)
        computed = snapshot["counts"]["computed"]
        self.assertEqual((computed["projects"], computed["orphaned_curation"], computed["forge_only"]), (2, 1, 1))
        record = projects(snapshot)[ghost]
        self.assertEqual(record["facets"]["exposure"]["status"], "unknown")
        far = projects(snapshot)["github.com/cambridgetcg/far"]
        self.assertEqual(far["facets"]["hosting"]["status"], "unknown")  # no checkout: no manifest was read
        self.assertIn("no checkout here", far["facets"]["layer"]["note"])

    def test_citizens_are_counted_once_per_name(self):
        j = bare_join()

        def citizen(pid, roles, basis="group"):
            return {"family_id": "family:fleet-citizens", "flags": {"orphaned_curation": False},
                    "facets": {"role": {"values": roles, "basis": basis}}}
        j.projects = {"github.com/o/citizen-a": citizen("a", ["doctrine"]),
                      "codeberg.org/z/citizen-a": citizen("a", ["ops"]),
                      "github.com/o/citizen-b": citizen("b", []),
                      "github.com/o/gate": citizen("g", ["public-door"], basis="curated")}
        self.assertEqual(j.citizen_names(), {"citizen-a", "citizen-b"})

    def test_a_mirror_group_does_not_give_its_role_to_projects_living_elsewhere(self):
        j = bare_join()
        mirror = {"id": "group:f/desktop-mirror", "role": ["ops"], "member_kind": "checkout", "members": ["co:mirror"],
                  "member_projects": ["p"]}
        names = {"id": "group:f/founding", "role": ["doctrine"], "member_kind": "project", "members": ["p"],
                 "member_projects": ["p"] * 53}
        self.assertEqual(j._role_group({"canonical_checkout": "co:home"}, [mirror, names])["id"], "group:f/founding")
        self.assertIsNone(j._role_group({"canonical_checkout": "co:home"}, [mirror]))
        self.assertEqual(j._role_group({"canonical_checkout": "co:mirror"}, [mirror])["id"], "group:f/desktop-mirror")

    def test_unmeasurable_hosting_and_checkoutless_risks_are_unverifiable(self):
        j = bare_join()
        j.measurable_risks = {curate.RISKS["partial"]}
        project = {"facets": {"hosting": {"values": [], "status": "none"}}, "display": {}, "checkouts": [],
                   "risks": []}
        self.assertEqual(j._expect(project, "expect:hosting=x-npm")[0], "unverifiable")
        self.assertEqual(j._expect(project, "expect:hosting=fly")[0], "failed")
        self.assertEqual(j._expect(project, "risk=" + curate.RISKS["partial"])[0], "unverifiable")

    def test_a_wrapper_script_outside_every_checkout_leaves_tcc_unknown(self):
        j = bare_join()
        job = {"id": "sched:launchd:upd", "mechanism": "launchd", "label": "upd", "target_paths": [],
               "script_paths": ["/" + "nonexistent-bin/update.sh"], "tcc_exposed": False}
        j._scheduler(job, {"state": "unknown", "basis": "x", "at": NOW_ISO}, None, None)
        record = j.schedulers["sched:launchd:upd"]
        self.assertIsNone(record["tcc_exposed"])
        self.assertIn("outside any checkout", record["tcc_basis"])

    def test_provider_hosts_are_not_estate_zones(self):
        j = bare_join()
        for host in ("love-engine.surge.sh", "github.com", "codeberg.org", "ollama.com"):
            self.assertIsNone(j.registrable(host), host)
        self.assertEqual(j.registrable("www.legible.money"), "legible.money")

    def test_one_shell_file_does_not_make_a_markdown_home_a_shell_project(self):
        co = mini_checkout(repo_path("citizen-z"), "https://github.com/cambridgetcg/citizen-z.git", tracked_files=9,
                           top_ext=[[".md", 4], [".json", 2], ["(none)", 1], [".sh", 1], [".yaml", 1]])
        snapshot, _ = mini_build([co])
        self.assertEqual(projects(snapshot)["github.com/cambridgetcg/citizen-z"]["facets"]["stack"]["values"],
                         ["markdown"])

    def test_private_views_get_the_full_text_and_cards_the_public_one(self):
        curated = empty_curated()
        pid = "github.com/cambridgetcg/doc"
        curated["projects"] = {pid: {"id": pid, "name": "doc", "what": "A tool."}}
        curated["private"]["projects"] = {pid: {"id": pid, "what_full": "A tool. Its key lives in a private place."}}
        snapshot, _ = mini_build([mini_checkout(repo_path("doc"), "https://github.com/cambridgetcg/doc.git")],
                                 curated=curated)
        record = projects(snapshot)[pid]
        self.assertEqual(record["curated"]["what"], "A tool. Its key lives in a private place.")
        self.assertEqual(record["curated"]["what_public"], "A tool.")
