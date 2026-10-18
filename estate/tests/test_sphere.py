"""Sphere facet tests (owner decision D4, tool/sphere.py).

Unit cases cover the resolution order (curated row, mirror, family default, KINGDOM layer, else
undecided), alias and mirror inheritance, zones and surfaces, the curated index, the decision's
sphere_by_layer, and the classification import: text inserted exactly where import-survey renders
it, so a re-import carries it forward byte for byte. One synthetic estate is then classified and
built through the command line, and its records, ls, atlas, tree, queue and proposals checked."""
import json
import os
import stat
import tomllib
import types

from . import fixture
from . import test_curate
from . import test_decisions
from . import test_e2e
from . import test_model
import curate
import decisions
import model
import safety
import sphere
import tree

D4 = "dec-2026-10-17-5"
G = "github.com/cambridgetcg/"
BY_LAYER = {"soul": "kingdom-os", "runtime": "kingdom-os", "nervous": "kingdom-os", "fleet": "kingdom-os",
            "economy": "kingdom-os", "os": "kingdom-os", "commerce": "independent"}
RULE = {"by_layer": BY_LAYER, "decision": D4}
ALLOWED = sphere.values(test_model.VOCAB["facets"])
KOS, IND, UND = sphere.KINGDOM_OS, sphere.INDEPENDENT, sphere.UNDECIDED
# Local ids are built from parts, as the fixture plants them (no home-relative literal here).
NOTES = test_model.LOCAL + fixture.HOME_REL + "notes"
LOCAL_NOTES = test_model.LOCAL + fixture.HOME_REL + "Desktop/local-notes"
BRAIN = "surface:" + test_model.LOCAL + "brain"  # a surface id the committed lint rejects


def d4_row():
    return test_decisions.owner(D4, label="D4", resolves=[], effects={"sphere_by_layer": dict(BY_LAYER)})


def project(pid, layer=None, status=None, family=None, aliases=(), candidates=()):
    status = status or ("settled" if layer else "unset")
    value = layer if status in ("settled", "roster-fallback") else None
    return {"kind": "project", "id": pid, "aliases": list(aliases), "family_id": family,
            "facets": {"layer": {"value": value, "status": status,
                                 "candidates": [{"value": c, "source": "card"} for c in candidates]}}}


def entry(value, **extra):
    return dict({"value": value, "where": "test"}, **extra)


def resolve(projects, rows=None, families=None, rule=RULE, mirrors=None):
    problems = sphere.resolve_projects(projects, rows or {}, families or {}, rule, mirrors or {}, ALLOWED,
                                       "origin/main", "2026-10-17T12:00:00Z")
    return {pid: p["facets"]["sphere"] for pid, p in projects.items()}, problems


class VocabularyTests(fixture.EstateTestCase):

    def test_the_facet_has_the_three_values_of_the_decision(self):
        self.assertEqual(ALLOWED, (KOS, IND, UND))
        self.assertEqual(tuple(curate.SPHERES), ALLOWED)
        table = test_model.VOCAB["facets"]["facet"]["sphere"]
        self.assertEqual(table["decision"], D4)
        for basis in (sphere.CURATED_PROJECT, sphere.MIRROR, sphere.CURATED_FAMILY, sphere.RULE_LAYER,
                      sphere.CURATED_ZONE, sphere.OWNER_PROJECT, sphere.CURATED_SURFACE, sphere.SOURCE_PROJECT,
                      sphere.NONE):
            self.assertIn(basis, table["bases"])
        self.assertIn("sphere", model.NAVIGATION)
        # A topic may never equal a navigation value, so the sphere values join them.
        self.assertTrue(set(ALLOWED) <= set(curate.OVERLAY_NAV_VALUES))

    def test_the_committed_decision_defines_the_layer_rule(self):
        with open(os.path.join(fixture.LAYER_DIR, "curated", "decisions.toml"), "rb") as stream:
            rows = tomllib.load(stream)["decision"]
        rule = decisions.rules(rows)["sphere"]
        self.assertEqual(rule["decision"], D4)
        self.assertEqual(rule["by_layer"], BY_LAYER)
        d4 = next(d for d in rows if d["id"] == D4)
        self.assertNotIn("pending", d4)  # the facet is applied, no longer pending
        self.assertIn("sphere_by_layer", decisions.effect_keys(d4)[0])


class ResolutionTests(fixture.EstateTestCase):

    def test_the_order_is_curated_then_family_then_layer_then_undecided(self):
        projects = {G + "explicit": project(G + "explicit", "commerce", family="family:kos"),
                    G + "family": project(G + "family", "commerce", family="family:kos"),
                    G + "layer": project(G + "layer", "commerce", family="family:mixed"),
                    G + "soul": project(G + "soul", "soul", status="roster-fallback"),
                    G + "open": project(G + "open", family="family:mixed"),
                    G + "bare": project(G + "bare"),
                    G + "new": project(G + "new", "brand-new")}
        rows = {G + "explicit": entry(UND, evidence="mixed evidence", confidence="low", reviewed=False)}
        families = {"family:kos": entry(KOS, reviewed=False), "family:mixed": entry(UND)}
        got, problems = resolve(projects, rows, families)
        self.assertEqual(problems, [])
        expect = {"explicit": (UND, sphere.CURATED_PROJECT), "family": (KOS, sphere.CURATED_FAMILY),
                  # A family default of undecided presumes nothing: the layer rule still applies.
                  "layer": (IND, sphere.RULE_LAYER), "soul": (KOS, sphere.RULE_LAYER),
                  "open": (UND, sphere.CURATED_FAMILY), "bare": (UND, sphere.NONE), "new": (UND, sphere.NONE)}
        for name, (value, basis) in expect.items():
            facet = got[G + name]
            self.assertEqual((facet["value"], facet["basis"], facet["status"], facet["decision"]),
                             (value, basis, "set", D4), name)
        self.assertEqual(got[G + "explicit"]["reason"], "mixed evidence")
        self.assertIs(got[G + "explicit"]["reviewed"], False)
        self.assertEqual(got[G + "layer"]["layer"], "commerce")
        self.assertEqual(got[G + "layer"]["src"], "src:kingdom:origin/main")
        self.assertIn("presumes nothing", got[G + "open"]["reason"])
        self.assertIn("the KINGDOM layer is unset", got[G + "bare"]["reason"])
        self.assertIn("gives layer brand-new no sphere", got[G + "new"]["reason"])
        for facet in got.values():  # undecided always says why
            if facet["value"] == UND:
                self.assertTrue(facet.get("reason"))

    def test_a_contested_layer_places_only_when_every_candidate_agrees(self):
        projects = {G + "agree": project(G + "agree", status="contested", candidates=("soul", "fleet")),
                    G + "split": project(G + "split", status="contested", candidates=("soul", "commerce"))}
        got, _ = resolve(projects)
        self.assertEqual((got[G + "agree"]["value"], got[G + "agree"]["layer"]), (KOS, "fleet|soul"))
        self.assertEqual(got[G + "split"]["value"], UND)
        self.assertIn("contested layer (commerce|soul)", got[G + "split"]["reason"])

    def test_without_the_decision_only_curated_rows_place_a_project(self):
        projects = {G + "a": project(G + "a", "soul"), G + "b": project(G + "b", "soul")}
        got, _ = resolve(projects, rows={G + "b": entry(KOS)}, rule=None)
        self.assertEqual((got[G + "a"]["value"], got[G + "a"]["decision"]), (UND, None))
        self.assertIn("no owner decision maps a KINGDOM layer", got[G + "a"]["reason"])
        self.assertEqual(got[G + "b"]["value"], KOS)

    def test_a_row_under_an_alias_is_the_projects_own(self):
        projects = {G + "trunk": project(G + "trunk", "commerce", aliases=[G + "alias"]),
                    G + "both": project(G + "both", aliases=[G + "x1", G + "x2"])}
        rows = {G + "alias": entry(KOS), G + "x1": entry(KOS), G + "x2": entry(IND)}
        got, problems = resolve(projects, rows)
        self.assertEqual((got[G + "trunk"]["value"], got[G + "trunk"]["basis"], got[G + "trunk"]["via"]),
                         (KOS, sphere.CURATED_PROJECT, G + "alias"))
        self.assertEqual(got[G + "both"]["via"], G + "x1")
        self.assertEqual(problems, ["sphere: the aliases of %sboth carry different spheres; %sx1 is used" % (G, G)])

    def test_mirrors_share_their_canonical_projects_sphere(self):
        projects = {G + "canon": project(G + "canon", "soul"),
                    G + "mirror": project(G + "mirror", "commerce", family="family:kos"),
                    G + "copy": project(G + "copy"),
                    G + "own": project(G + "own"),
                    G + "loop-a": project(G + "loop-a", "soul"), G + "loop-b": project(G + "loop-b", "commerce"),
                    G + "split": project(G + "split", "soul")}
        rows = {G + "canon": entry(IND, evidence="a business"), G + "own": entry(KOS)}
        mirrors = sphere.mirror_targets([
            {"from": G + "mirror", "verb": "mirror_of", "to": G + "canon"},
            {"from": G + "copy", "verb": "copy_of", "to": G + "mirror"},
            {"from": G + "own", "verb": "mirror_of", "to": G + "canon"},
            {"from": G + "loop-a", "verb": "mirror_of", "to": G + "loop-b"},
            {"from": G + "loop-b", "verb": "mirror_of", "to": G + "loop-a"},
            {"from": G + "split", "verb": "copy_of", "to": G + "canon"},
            {"from": G + "split", "verb": "copy_of", "to": G + "own"},
            {"from": G + "canon", "verb": "fork_of", "to": G + "own"}])
        got, _ = resolve(projects, rows, {"family:kos": entry(KOS)}, mirrors=mirrors)
        self.assertEqual((got[G + "mirror"]["value"], got[G + "mirror"]["basis"], got[G + "mirror"]["via"]),
                         (IND, sphere.MIRROR, G + "canon"))
        self.assertEqual((got[G + "copy"]["value"], got[G + "copy"]["via"]), (IND, G + "canon"))  # a chain
        self.assertEqual(got[G + "mirror"]["reason"], "follows %scanon: a business" % G)
        self.assertEqual(got[G + "own"]["basis"], sphere.CURATED_PROJECT)  # its own row wins
        # A cycle names no canonical project, and two canonicals are no single one.
        self.assertEqual((got[G + "loop-a"]["value"], got[G + "loop-b"]["value"]), (KOS, IND))
        self.assertEqual(got[G + "split"]["basis"], sphere.RULE_LAYER)
        self.assertEqual(got[G + "canon"]["basis"], sphere.CURATED_PROJECT)  # fork_of is not a mirror

    def test_zones_and_surfaces_follow_their_project_unless_curated(self):
        projects = {G + "door": project(G + "door", "soul"), G + "shop": project(G + "shop")}
        resolve(projects)
        rows = {"zone:curated.dev": entry(IND, confidence="high"), "surface:cf-pages:pinned": entry(KOS)}
        zone = lambda zid, owner=None: {"id": zid, "owner_project": owner}
        self.assertEqual(sphere.resolve_zone(zone("zone:curated.dev", G + "door"), rows, projects, D4)["basis"],
                         sphere.CURATED_ZONE)
        owned = sphere.resolve_zone(zone("zone:door.dev", G + "door"), rows, projects, D4)
        self.assertEqual((owned["value"], owned["basis"], owned["via"]), (KOS, sphere.OWNER_PROJECT, G + "door"))
        alone = sphere.resolve_zone(zone("zone:alone.dev"), rows, projects, D4)
        self.assertEqual((alone["value"], alone["basis"], alone["reason"]),
                         (UND, sphere.NONE, "no curated assignment and no owner project"))
        surface = lambda sid, source=None: {"id": sid, "source_project": source}
        pinned = sphere.resolve_surface(surface("surface:cf-pages:pinned", G + "shop"), rows, projects, D4)
        self.assertEqual((pinned["value"], pinned["basis"]), (KOS, sphere.CURATED_SURFACE))
        follows = sphere.resolve_surface(surface("surface:fly:shop", G + "shop"), rows, projects, D4)
        self.assertEqual((follows["value"], follows["basis"]), (UND, sphere.SOURCE_PROJECT))
        self.assertTrue(follows["reason"].startswith("follows %sshop: no curated assignment" % G))
        self.assertEqual(sphere.resolve_surface(surface("surface:fly:none"), rows, projects, D4)["basis"], sphere.NONE)


    def test_a_follows_row_tracks_its_record_and_a_stale_value_is_reported(self):
        # U2/F1: a classification that follows a project cannot go stale when the project's value moves.
        projects = {G + "art": project(G + "art", "economy"), G + "shop": project(G + "shop", "commerce")}
        resolve(projects)
        rows = {"zone:art.dev": entry(UND, follows=G + "art", evidence="Follows art."),
                "surface:cf-worker:router": entry(KOS, follows="zone:art.dev"),
                "zone:lost.dev": entry(IND, follows=G + "gone")}
        problems = []
        zones = {"zone:art.dev": {"id": "zone:art.dev", "owner_project": G + "art"}}
        zones["zone:art.dev"]["sphere"] = sphere.resolve_zone(zones["zone:art.dev"], rows, projects, D4, problems)
        got = zones["zone:art.dev"]["sphere"]
        self.assertEqual((got["value"], got["basis"], got["follows"], got["via"]),
                         (KOS, sphere.CURATED_ZONE, G + "art", G + "art"))
        self.assertEqual(len(problems), 1)
        self.assertIn("follows %sart, which is now kingdom-os, but still stores undecided" % G, problems[0])
        router = sphere.resolve_surface({"id": "surface:cf-worker:router", "source_project": None}, rows, projects,
                                        D4, zones, problems)
        self.assertEqual((router["value"], router["follows"]), (KOS, "zone:art.dev"))
        self.assertEqual(len(problems), 1)  # the stored value agrees
        lost = sphere.resolve_zone({"id": "zone:lost.dev"}, rows, projects, D4, problems)
        self.assertEqual(lost["value"], IND)  # nothing to follow: its own value, reported
        self.assertIn("follows %sgone, which has no sphere in this run" % G, problems[-1])

    def test_a_curated_row_that_differs_from_its_project_is_listed_never_changed(self):
        projects = {G + "art": project(G + "art", "economy")}
        resolve(projects)
        rows = {"zone:art.dev": entry(UND, evidence="Follows art (undecided).")}
        zones = {"zone:art.dev": {"id": "zone:art.dev", "owner_project": G + "art"}}
        zones["zone:art.dev"]["sphere"] = sphere.resolve_zone(zones["zone:art.dev"], rows, projects, D4)
        self.assertEqual(zones["zone:art.dev"]["sphere"]["value"], UND)
        self.assertEqual(sphere.follow_mismatches(zones, {}, projects), [
            {"id": "zone:art.dev", "value": UND, "project": G + "art", "project_value": KOS}])

    def test_import_keeps_follows_and_third_party_beside_a_placed_value(self):
        data = {"exceptions": [{"id": G + "vendor", "sphere": KOS, "third_party": True, "short": "A vendor tree."}],
                "zones": [{"id": "zone:art.dev", "sphere": KOS, "follows": G + "art", "short": "Follows art."}],
                "surfaces": [], "family_defaults": []}
        self.assertEqual(sphere._value(data["exceptions"][0], ALLOWED, "exceptions"), (KOS, True))
        with self.assertRaises(safety.GuardError):
            sphere._value({"id": "x", "sphere": KOS, "third_party": "yes"}, ALLOWED, "exceptions")


class CuratedIndexTests(fixture.EstateTestCase):

    def test_committed_rows_decide_and_private_rows_add_the_full_evidence(self):
        cur = test_model.empty_curated()
        cur["projects"] = {G + "a": {"sphere": {"value": KOS, "evidence": "short"}},
                           G + "p": {"private_only": True, "sphere": {"value": IND}}}
        cur["families"] = {"family:f": {"file": "curated/families/f.toml", "sphere": {"value": UND}}}
        cur["spheres"] = [{"id": "zone:z.dev", "value": IND}, {"id": G + "a", "value": IND},
                          {"id": "surface:x:bad", "value": "maybe"}]
        cur["private"]["sphere"] = {"sphere": [
            {"id": G + "a", "evidence": "the full text"}, {"id": "family:f", "evidence": "family text"},
            {"id": "zone:z.dev", "value": KOS, "evidence": "says otherwise"},
            {"id": NOTES, "value": KOS, "evidence": "private only"}]}
        rows, families, problems = sphere.curated_index(cur, ALLOWED)
        self.assertEqual((rows[G + "a"]["value"], rows[G + "a"]["evidence_full"]), (KOS, "the full text"))
        self.assertEqual(families["family:f"]["evidence_full"], "family text")
        self.assertEqual(rows["zone:z.dev"]["value"], IND)
        self.assertEqual(rows[NOTES]["where"], "private/" + sphere.PRIVATE_FILE)
        self.assertNotIn(G + "p", rows)  # a private-only curation row carries no committed sphere
        joined = "\n".join(problems)
        for needle in ("%sa is assigned twice" % G, "'maybe', which is not a sphere value",
                       "says zone:z.dev is kingdom-os, the committed curation says independent"):
            self.assertIn(needle, joined)
        # A committed row without a short text takes the private text as its reason.
        facet = sphere.resolve_zone({"id": "zone:z.dev"}, rows, {}, D4)
        self.assertEqual((facet["value"], facet["reason"]), (IND, "says otherwise"))
        self.assertNotIn("evidence", facet)
        facet = sphere.resolve_zone({"id": G + "a"}, rows, {}, D4)
        self.assertEqual((facet["reason"], facet["evidence"]), ("short", "the full text"))

    def test_the_layer_rule_is_checked_against_the_live_layers(self):
        problems = sphere.rule_problems(dict(RULE, by_layer=dict(BY_LAYER, soul="sacred")), {"soul", "brand-new"},
                                        ALLOWED)
        joined = "\n".join(problems)
        self.assertIn("maps layer runtime, which the authority ref's vocabulary does not have", joined)
        self.assertIn("gives layer brand-new no sphere", joined)
        self.assertIn("maps layer soul to 'sacred'", joined)
        self.assertEqual(sphere.rule_problems(None, {"soul"}, ALLOWED), [])

    def test_a_malformed_layer_rule_is_a_decision_problem(self):
        rows = [test_decisions.owner(D4, resolves=[], effects={"sphere_by_layer": "soul"})]
        self.assertIn("sphere_by_layer must be a table", "\n".join(decisions.problems(rows, set())))
        self.assertIsNone(decisions.rules(rows)["sphere"])
        self.assertEqual(decisions.rules([d4_row()])["sphere"], RULE)


# ── the classification import ───────────────────────────────────────────────────────────────

FAMILY_DOC = {
    "family": {"id": "family:soul-core", "label": "soul-core", "summary": "synthetic", "open_questions": [],
               "as_of": "2026-10-17", "review_after": "2027-01-15", "reviewed": False, "source": "survey-2026-10-17"},
    "project": [
        {"id": G + "alpha", "name": "alpha", "what": "The alpha.", "confidence": "high", "source": "survey-2026-10-17",
         "relations": [{"verb": "related_to", "to": G + "beta", "raw_kind": "maps"}]},
        {"id": G + "beta", "name": "beta", "what": "The beta.", "role": ["ops"], "source": "survey-2026-10-17"},
    ],
    "group": [{"id": "group:soul-core/pair", "label": "pair",
               "member_rule": safety.Inline({"kind": "names", "names": [G + "alpha", G + "beta"]})}],
}
ESTATE_DOC = {
    "owners": {"github": ["cambridgetcg"]},
    "legal": {"status": "unassigned", "records": []},
    "zone": [{"id": "zone:alpha.dev", "fqdn": "alpha.dev"}],
    "dispute": [{"id": "dispute:x", "candidates": [safety.Inline({"claim": "a", "source": "b"})]}],
}
CLASSIFICATION = {
    "meta": {"source": "classification-test", "as_of": "2026-10-17"},
    "drop": [{"id": "surface:vercel:vercel.json", "why": "a parser artifact"}],
    "family_defaults": [{"family": "soul-core", "sphere": KOS, "rationale": "the soul trees", "short": "Soul trees."},
                        {"family": "(no family)", "sphere": UND, "rationale": "none"}],
    "exceptions": [
        {"id": G + "alpha", "sphere": UND, "confidence": "low", "evidence": "mixed, see the long text",
         "short": "Mixed."},
        {"id": G + "uncurated", "sphere": IND, "confidence": "high", "evidence": "a shop", "short": "A shop."},
        {"id": "github.com/vendor/tool", "sphere": sphere.NOT_OURS, "evidence": "upstream clone",
         "short": "Third-party clone."},
        {"id": NOTES, "sphere": KOS, "confidence": "low", "evidence": "private notes"},
    ],
    "zones": [{"id": "zone:alpha.dev", "sphere": KOS, "confidence": "high", "evidence": "the door",
               "short": "The door."},
              {"id": "zone:github.com", "sphere": sphere.NOT_OURS, "evidence": "a forge apex"}],
    "surfaces": [
        {"id": "surface:cf-pages:alpha", "sphere": KOS, "confidence": "low", "evidence": "first pass",
         "short": "Alpha pages."},
        {"id": "surface:cf-pages:alpha", "sphere": KOS, "confidence": "high", "evidence": "second pass"},
        {"id": "surface:vercel:vercel.json", "sphere": UND, "evidence": "artifact"},
        {"id": BRAIN, "sphere": KOS, "evidence": "the resident model server"},
    ],
}


def write_layer(case):
    layer = case
    fixture.write_file(os.path.join(layer, "curated", "families", "soul-core.toml"), safety.toml_dumps(FAMILY_DOC))
    fixture.write_file(os.path.join(layer, "curated", "estate.toml"), safety.toml_dumps(ESTATE_DOC))
    return layer


class ImportTests(fixture.EstateTestCase):

    def plan(self, layer, data=CLASSIFICATION):
        return sphere.plan_import(json.loads(json.dumps(data)), model.load_curated(layer), ALLOWED, layer)

    def test_rows_go_where_the_curation_keeps_them(self):
        layer = write_layer(self.case_dir())
        plan = self.plan(layer)
        self.assertEqual(plan["counts"], {"family_defaults": 1, "project_rows": 1, "estate_rows": 4,
                                          "private_only": 2, "private_rows": 8, "skipped": 3})
        self.assertEqual({ident for ident, _ in plan["skipped"]},
                         {"family (no family)", "zone:github.com", "surface:vercel:vercel.json"})
        family = tomllib.loads(plan["committed"]["curated/families/soul-core.toml"])
        self.assertEqual((family["family"]["sphere"]["value"], family["family"]["sphere"]["evidence"]), (KOS, "Soul trees."))
        alpha = next(r for r in family["project"] if r["id"] == G + "alpha")
        self.assertEqual((alpha["sphere"]["value"], alpha["sphere"]["reviewed"], alpha["sphere"]["source"]),
                         (UND, False, "classification-test"))
        self.assertNotIn("sphere", next(r for r in family["project"] if r["id"] == G + "beta"))
        estate = tomllib.loads(plan["committed"]["curated/estate.toml"])
        rows = {r["id"]: r for r in estate["sphere"]}
        self.assertEqual(set(rows), {G + "uncurated", "github.com/vendor/tool", "zone:alpha.dev", "surface:cf-pages:alpha"})
        self.assertEqual((rows["github.com/vendor/tool"]["value"], rows["github.com/vendor/tool"]["third_party"]),
                         (UND, True))
        # Duplicates agree: the higher confidence wins and both texts are kept privately.
        self.assertEqual((rows["surface:cf-pages:alpha"]["confidence"], rows["surface:cf-pages:alpha"]["evidence"]),
                         ("high", "Alpha pages."))
        private = tomllib.loads(plan["private"])["sphere"]
        by_id = {r["id"]: r for r in private}
        self.assertEqual(by_id[NOTES]["value"], KOS)
        self.assertEqual(by_id[BRAIN]["value"], KOS)  # an id the committed lint rejects
        self.assertEqual(by_id["surface:cf-pages:alpha"]["evidence"], "first pass || second pass")
        self.assertEqual(by_id["family:soul-core"]["evidence"], "the soul trees")
        self.assertNotIn("value", by_id[G + "alpha"])  # its value is committed
        for rel, text in plan["committed"].items():
            self.assertEqual(curate.lint_text(text, rel, curate.scope_of(rel)), [], rel)

    def test_the_edit_is_where_toml_dumps_renders_it_and_a_reimport_carries_it(self):
        layer = write_layer(self.case_dir())
        plan = self.plan(layer)
        for rel, text in plan["committed"].items():
            fixture.write_file(os.path.join(layer, rel), text)
        # Applying the same classification again changes nothing.
        self.assertEqual(self.plan(layer)["committed"], plan["committed"])
        kept = curate.existing_spheres(layer)
        fresh = types.SimpleNamespace(committed={"curated/families/soul-core.toml": json.loads(json.dumps(FAMILY_DOC)),
                                                 "curated/estate.toml": json.loads(json.dumps(ESTATE_DOC))},
                                      counts={})
        # The import's own documents mark these inline, as curate builds them.
        fresh.committed["curated/families/soul-core.toml"]["group"][0]["member_rule"] = FAMILY_DOC["group"][0]["member_rule"]
        fresh.committed["curated/estate.toml"]["dispute"][0]["candidates"] = ESTATE_DOC["dispute"][0]["candidates"]
        curate.carry_spheres(fresh, kept)
        for rel, doc in fresh.committed.items():
            self.assertEqual(curate.render(rel, doc), plan["committed"][rel], rel)
        self.assertEqual(fresh.counts["spheres_carried"], 1 + 1 + 4)

    def test_an_existing_row_is_replaced_not_repeated(self):
        layer = write_layer(self.case_dir())
        for rel, text in self.plan(layer)["committed"].items():
            fixture.write_file(os.path.join(layer, rel), text)
        changed = json.loads(json.dumps(CLASSIFICATION))
        changed["exceptions"][0]["sphere"] = KOS
        changed["family_defaults"][0]["sphere"] = IND
        changed["zones"] = []
        plan = self.plan(layer, changed)
        family_text = plan["committed"]["curated/families/soul-core.toml"]
        self.assertEqual(family_text.count("[family.sphere]"), 1)
        self.assertEqual(family_text.count("\nsphere = "), 1)
        family = tomllib.loads(family_text)
        self.assertEqual(family["family"]["sphere"]["value"], IND)
        self.assertEqual(next(r for r in family["project"] if r["id"] == G + "alpha")["sphere"]["value"], KOS)
        estate = tomllib.loads(plan["committed"]["curated/estate.toml"])
        self.assertNotIn("zone:alpha.dev", {r["id"] for r in estate["sphere"]})

    def test_text_the_privacy_lint_rejects_refuses_the_import(self):
        layer = write_layer(self.case_dir())
        bad = json.loads(json.dumps(CLASSIFICATION))
        bad["zones"][0]["short"] = "Lives at /" + "Users/someone/thing."
        with self.assertRaises(safety.GuardError):
            self.plan(layer, bad)
        bad = json.loads(json.dumps(CLASSIFICATION))
        bad["exceptions"][1]["sphere"] = "maybe"
        with self.assertRaises(safety.GuardError):
            self.plan(layer, bad)

    def test_an_overwriting_survey_import_keeps_the_sphere_rows(self):
        home = os.path.join(self.tmp, "home-sphere-import")
        os.makedirs(os.path.join(home, "Desktop"))
        survey = test_curate.write_survey(self.case_dir("survey"), home)
        host = os.path.join(self.case_dir("host"), "business-ecosystem")
        layer = fixture.make_host(host, home=home)

        def run(**kw):
            with fixture.patched_env(HOME=home):
                return test_decisions.curate_import(survey, layer, host, home, **kw)

        run()
        family = os.path.join(layer, "curated", "families", "kingdom-core.toml")
        estate = os.path.join(layer, "curated", "estate.toml")
        with open(family, encoding="utf-8") as stream:
            text = stream.read()
        stamp = {"source": "classification-test", "reviewed": False}
        text = sphere.set_family_sphere(text, dict({"value": KOS, "evidence": "The connective map."}, **stamp))
        text = sphere.set_row_sphere(text, G + "kingdom-os", dict({"value": KOS, "evidence": "The map."}, **stamp))
        fixture.write_file(family, text)
        with open(estate, encoding="utf-8") as stream:
            estate_text = sphere.set_estate_spheres(stream.read(), [dict({"id": "zone:door.example.dev", "value": KOS},
                                                                        **stamp)])
        fixture.write_file(estate, estate_text)
        report = run(overwrite=True)
        for path, before in ((family, text), (estate, estate_text)):
            with open(path, encoding="utf-8") as stream:
                self.assertEqual(stream.read(), before, path)
        statuses = {i["path"]: i["status"] for i in report["committed"]}
        self.assertEqual((statuses["curated/families/kingdom-core.toml"], statuses["curated/estate.toml"]),
                         ("unchanged", "unchanged"))


# ── one synthetic estate, classified and built through the command line ─────────────────────

def classification(tmp):
    data = {
        "meta": {"source": "classification-fixture", "as_of": "2026-10-17"},
        "drop": [{"id": "surface:vercel:vercel.json", "why": "a parser artifact"}],
        "family_defaults": [{"family": "fleet-citizens", "sphere": KOS, "rationale": "the citizen garden",
                             "short": "The citizen garden."},
                            {"family": "agenttool-services", "sphere": UND, "rationale": "mixed",
                             "short": "Mixed; presumes nothing."}],
        "exceptions": [
            {"id": G + "business-ecosystem", "sphere": IND, "confidence": "high", "evidence": "the host business",
             "short": "A business platform."},
            {"id": "github.com/example/vendor-mirror", "sphere": sphere.NOT_OURS, "confidence": "high",
             "evidence": "upstream clone", "short": "A third-party clone."},
            {"id": G + "kingdom-mcp", "sphere": KOS, "confidence": "high", "evidence": "the front door",
             "short": "The agent-side front door."},
            {"id": LOCAL_NOTES, "sphere": KOS, "confidence": "low",
             "evidence": "notes kept beside the kingdom"},
        ],
        "zones": [{"id": "zone:example.dev", "sphere": KOS, "confidence": "high", "evidence": "the alpha door",
                   "short": "The alpha door."},
                  {"id": "zone:github.com", "sphere": sphere.NOT_OURS, "evidence": "a forge apex"}],
        "surfaces": [{"id": "surface:cf-worker:edge-worker", "sphere": IND, "confidence": "medium",
                      "evidence": "a paid edge", "short": "A paid edge."},
                     {"id": "surface:unknown:never-seen", "sphere": KOS, "evidence": "not observed",
                      "short": "Not observed here."}],
    }
    return fixture.write_file(os.path.join(tmp, "classification.json"), json.dumps(data))


class CommandLineSphereTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import shutil
        e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.estate, cls.layer, cls.private = e, e.layer, e.private
        shutil.copytree(os.path.join(fixture.LAYER_DIR, "vocab"), os.path.join(e.layer, "vocab"))
        os.unlink(os.path.join(e.layer, "vocab", "kingdom.lock.toml"))
        caveat_dir = os.path.join(e.home, "empty-build")
        os.makedirs(caveat_dir)
        test_decisions.write_decided_curation(e, caveat_dir)
        test_decisions.set_decisions(e, test_decisions.owner_decisions() + [d4_row()])
        cls.path = classification(e.tmp)
        cls.estate_toml = os.path.join(e.layer, "curated", "estate.toml")
        with open(cls.estate_toml, encoding="utf-8") as stream:
            cls.before_import = stream.read()
        cls.dry = test_e2e.cli(e.layer, "sphere", "--import", cls.path)
        with open(cls.estate_toml, encoding="utf-8") as stream:
            cls.after_dry = stream.read()
        cls.wet = test_e2e.cli(e.layer, "sphere", "--import", cls.path, "--write")
        cls.accept = test_e2e.cli(e.layer, "accept-vocab", "--write")
        cls.first = test_e2e.cli(e.layer, "build")
        run_dir = os.path.realpath(os.path.join(e.private, "current"))
        cls.run_dir = run_dir
        rows = test_e2e.jsonl(os.path.join(run_dir, "records.jsonl"))[1:]
        cls.by_id = {r["id"]: r for r in rows if r.get("presence", "present") == "present"}
        cls.props = test_e2e.jsonl(os.path.join(run_dir, "proposals.jsonl"))
        cls.atlas = test_e2e.read_text(os.path.join(run_dir, "ATLAS.md"))

    def cli(self, *argv):
        return test_e2e.cli(self.layer, *argv)

    def sphere_of(self, rid):
        record = self.by_id[rid]
        return (record.get("facets") or {}).get("sphere") if record["kind"] == "project" else record.get("sphere")

    def test_the_import_prints_first_then_writes_through_the_owner_writers(self):
        code, out, err = self.dry
        self.assertEqual(code, 0, err)
        self.assertIn("nothing written", out)
        self.assertIn("skipped zone:github.com: a third-party apex is not an estate zone", out)
        self.assertEqual(self.after_dry, self.before_import)
        code, out, err = self.wet
        self.assertEqual(code, 0, err)
        self.assertIn("written curated/estate.toml", out)
        self.assertNotIn("notes kept beside the kingdom", out)  # private evidence is never printed
        target = os.path.join(self.private, "curated", "sphere.toml")
        self.assertEqual(stat.S_IMODE(os.lstat(target).st_mode), 0o600)
        self.assertEqual(safety.PrivateArea(self.layer).curated_mode(), 0o500)
        with open(self.estate_toml, encoding="utf-8") as stream:
            self.assertIn("[[sphere]]", stream.read())

    def test_the_build_gives_every_present_project_a_sphere_with_its_basis(self):
        code, out, err = self.first
        self.assertIn(code, (0, 10), out + err)
        self.assertNotIn("failed validation", out + err)
        bases = set(test_model.VOCAB["facets"]["facet"]["sphere"]["bases"])
        projects = [r for r in self.by_id.values() if r["kind"] == "project"]
        self.assertTrue(projects)
        for record in projects:
            facet = self.sphere_of(record["id"])
            self.assertIn(facet["value"], ALLOWED, record["id"])
            self.assertIn(facet["basis"], bases, record["id"])
        expect = {G + "citizen-ada": (KOS, sphere.CURATED_FAMILY),          # family default
                  G + "alpha-service": (KOS, sphere.RULE_LAYER),            # undecided family presumes nothing
                  G + "ghost-project": (UND, sphere.CURATED_FAMILY),        # ...and no layer: undecided
                  G + "business-ecosystem": (IND, sphere.CURATED_PROJECT),
                  "github.com/example/vendor-mirror": (UND, sphere.CURATED_PROJECT),
                  G + "kingdom-mcp-trunk": (KOS, sphere.CURATED_PROJECT),   # through its alias
                  LOCAL_NOTES: (KOS, sphere.CURATED_PROJECT),  # private row
                  "codeberg.org/zerone-dev/zerone-mini": (KOS, sphere.RULE_LAYER),
                  G + "kingdom-os": (KOS, sphere.RULE_LAYER),
                  G + "beta-site": (UND, sphere.NONE)}
        for rid, (value, basis) in expect.items():
            facet = self.sphere_of(rid)
            self.assertEqual((facet["value"], facet["basis"], facet["decision"]), (value, basis, D4), rid)
        self.assertTrue(self.sphere_of("github.com/example/vendor-mirror")["third_party"])
        self.assertEqual(self.sphere_of(G + "kingdom-mcp-trunk")["via"], G + "kingdom-mcp")
        self.assertEqual(self.sphere_of(LOCAL_NOTES)["reason"],
                         "notes kept beside the kingdom")

    def test_zones_and_surfaces_carry_the_facet(self):
        self.assertEqual(self.sphere_of("zone:example.dev")["basis"], sphere.CURATED_ZONE)
        self.assertEqual((self.sphere_of("zone:agenttool.dev")["value"], self.sphere_of("zone:agenttool.dev")["basis"]),
                         (UND, sphere.NONE))
        self.assertEqual(self.sphere_of("surface:cf-worker:edge-worker")["value"], IND)
        pages = self.sphere_of("surface:cf-pages:alpha-pages")
        self.assertEqual((pages["value"], pages["basis"], pages["via"]),
                         (KOS, sphere.SOURCE_PROJECT, G + "alpha-service"))
        self.assertEqual(self.sphere_of("surface:vercel:beta-site@fa704a")["value"], UND)

    def test_ls_filters_and_counts_by_sphere(self):
        code, out, _err = self.cli("ls", "--facet", "sphere=kingdom-os")
        self.assertEqual(code, 0)
        self.assertIn(G + "citizen-ada", out)
        self.assertNotIn(G + "business-ecosystem", out)
        code, out, _err = self.cli("ls", "--facet", "sphere=undecided", "--json")
        self.assertIn(G + "ghost-project", {row["id"] for row in json.loads(out)})
        code, out, _err = self.cli("ls")
        self.assertIn("  sphere: ", out)
        code, out, _err = self.cli("sphere")
        self.assertEqual(code, 0)
        self.assertIn("undecided projects:", out)
        self.assertIn("github.com/example/vendor-mirror", out)
        # F9/U5: zones and surfaces are members too, and a value off the facet's enum is refused.
        self.assertIn("undecided zones and surfaces:", out)
        self.assertIn("surface:unknown:never-seen", out)
        self.assertIn("curated sphere rows naming no record of this run:", out)
        code, out, _err = self.cli("ls", "--kind", "zone", "--facet", "sphere=kingdom-os")
        self.assertEqual(code, 0)
        self.assertIn("zone:example.dev", out)
        self.assertNotIn(G + "citizen-ada", out)
        code, out, _err = self.cli("ls", "--facet", "sphere=kingdom-os", "--json")
        self.assertTrue({"project", "zone"} <= {row["kind"] for row in json.loads(out)})
        self.assertEqual(self.cli("ls", "--facet", "sphere=bogus")[0], 2)
        self.assertEqual(self.cli("ls", "--kind", "zone", "--facet", "layer=soul")[0], 2)

    def test_the_atlas_shows_kingdom_os_after_the_foundation(self):
        foundation, kingdom_os = self.atlas.index("## §0 Foundation"), self.atlas.index("## KINGDOM OS")
        first_layer = self.atlas.index("\n## Layer soul")
        self.assertLess(foundation, kingdom_os)
        self.assertLess(kingdom_os, first_layer)
        self.assertNotIn("\n## ", self.atlas[foundation + 3:kingdom_os].replace("\n## KINGDOM OS", ""))
        section = self.atlas[kingdom_os:first_layer]
        for needle in ("owner decision %s" % D4, "### Sphere × layer", "### Cloudflare domains and other zones",
                       "#### Part of KINGDOM OS", "example.dev", "### Undecided, for Yu", "ghost-project",
                       "presumes nothing", "vendor-mirror", "surface:unknown:never-seen"):
            self.assertIn(needle, section)
        html = test_e2e.read_text(os.path.join(self.run_dir, "ATLAS.html"))
        self.assertIn('"sphere"', html)

    def test_the_tree_has_the_sphere_axis_and_checks_clean(self):
        link = os.path.join(self.run_dir, "tree", tree.SPHERE, KOS, "fleet-citizens", "citizen-ada")
        self.assertTrue(os.path.islink(link))
        self.assertTrue(os.path.islink(os.path.join(self.run_dir, "tree", tree.SPHERE, UND, "unassigned", "beta-site")))
        readme = test_e2e.read_text(os.path.join(self.run_dir, "tree", tree.README))
        self.assertIn(tree.SPHERE, readme)
        code, out, _err = self.cli("check", "--tree")
        self.assertEqual(code, 0, out)

    def test_proposals_carry_their_subjects_sphere(self):
        current = [p for p in self.props if p["status"] in ("open", "conflict-with-upstream", "resolved-upstream")]
        self.assertTrue(current)
        for prop in current:
            self.assertIn("sphere", prop)
            self.assertIn(prop["sphere"], ALLOWED + (None,))
        for prop in current:
            if prop["rule"] in ("P09", "P12") and prop["sphere"] != KOS and not any(
                    "through zone" in b for b in prop["basis"]):
                self.assertNotIn("part of KINGDOM OS", " ".join(prop["basis"]))
            citizen = any(b.startswith("a citizen: not raised") for b in prop["basis"])
            if prop["rule"] in ("P09", "P12") and prop["sphere"] == KOS and not citizen:
                self.assertLessEqual(prop["priority"], 2)
            # F6: the ordering is the estate's, never attributed to the owner decision.
            self.assertNotIn("(owner decision D4)", " ".join(prop["basis"]))

    def test_an_unmatched_row_waits_in_the_queue(self):
        queue = test_e2e.read_text(os.path.join(self.run_dir, "QUEUE.md"))
        self.assertIn("sphere-unmatched", queue)
        self.assertIn("surface:unknown:never-seen", queue)


class ProposalPriorityTests(fixture.EstateTestCase):

    def test_registry_and_roster_absent_proposals_for_kingdom_os_go_first(self):
        import proposals
        snapshot = {"records": [
            {"kind": "project", "id": G + "door", "facets": {"sphere": {"value": KOS}}, "proposals": []},
            {"kind": "project", "id": G + "shop", "facets": {"sphere": {"value": IND}}, "proposals": []},
            {"kind": "zone", "id": "zone:door.dev", "sphere": {"value": KOS}},
            {"kind": "surface", "id": "surface:fly:shop-in-door", "zone_ids": ["zone:door.dev"],
             "sphere": {"value": IND}}], "ref": "origin/main"}
        q = proposals._Queue(snapshot, {}, {}, "2026-10-17T12:00:00Z")
        door = q.add("P09", "roster", {"owner": "kingdom-os", "record_id": G + "door"}, {}, {"row": ["door"]}, priority=3)
        shop = q.add("P09", "roster", {"owner": "kingdom-os", "record_id": G + "shop"}, {}, {"row": ["shop"]}, priority=3)
        zoned = q.add("P12", "registry", {"owner": "kingdom-os", "record_id": "surface:fly:shop-in-door"}, {},
                      {"entry": "x"}, priority=3)
        other = q.add("P01", "card", {"owner": "repo", "record_id": G + "shop"}, {}, {"card_text": "x"}, priority=3)
        q.records[G + "citizen-ida"] = q.projects[G + "citizen-ida"] = {
            "kind": "project", "id": G + "citizen-ida", "family_id": "family:fleet-citizens", "name": "citizen-ida",
            "facets": {"sphere": {"value": KOS}, "role": {"values": ["citizen"]}}, "proposals": []}
        citizen = q.add("P09", "roster", {"owner": "kingdom-os", "record_id": G + "citizen-ida"}, {},
                        {"row": ["citizen-ida"]}, priority=3)
        proposals._spheres(q)
        self.assertEqual((citizen["sphere"], citizen["priority"]), (KOS, 3))  # F6: D2's route, not one row each
        self.assertTrue(citizen["basis"][-1].startswith("a citizen: not raised"))
        self.assertIn("not part of the decision", door["basis"][-1])
        self.assertEqual((door["sphere"], door["priority"]), (KOS, 2))
        self.assertEqual((shop["sphere"], shop["priority"], shop["basis"]), (IND, 3, []))
        self.assertEqual((zoned["sphere"], zoned["priority"]), (IND, 2))
        self.assertIn("through zone zone:door.dev", zoned["basis"][-1])
        self.assertEqual((other["sphere"], other["priority"]), (IND, 3))


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
