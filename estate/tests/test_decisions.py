"""Owner decision tests: decisions.toml owner-decision rows applied at build time.

Unit cases cover the decision index (status of resolved questions and disputes, the primary-ref
rule, the config edit) and the layer ruling in model.resolve_field and model.combine_refs. The
fixture cases build the synthetic estate of spec 13 twice, before and after owner decisions,
and check the model, the proposals lifecycle, the atlas and the tree. The CLI cases cover
decisions --sync-config, --words-from, accept-vocab --reviewed-harvest and check --verify-harvest
on the authority ref, and the import keeping owner decisions."""
import copy
import json
import os
import shutil
import stat
import tomllib

from . import fixture
from . import test_curate
from . import test_e2e
from . import test_model
import decisions
import kingdom
import model
import proposals
import render
import safety
import sources
import tree

VOCAB = test_model.VOCAB
D1, D2, D3, D5, D6 = ("dec-2026-10-17-2", "dec-2026-10-17-3", "dec-2026-10-17-4", "dec-2026-10-17-6",
                      "dec-2026-10-17-7")
OWNED = ["surface:cf-pages:alpha-docs", "zone:example.dev", "surface:cf-worker:never-seen"]


def owner(ident, **fields):
    row = {"id": ident, "date": "2026-10-17", "kind": decisions.KIND, "by": "yu", "subject": "subject " + ident,
           "decision": "decision " + ident}
    row.update(fields)
    return row


def owner_decisions():
    return [
        owner(D1, label="D1", resolves=["dispute:taxonomy-authority", "q:taxonomy-authority"],
              outcome={"dispute:taxonomy-authority": "origin/main"},
              effects={"taxonomy_ref": kingdom.ORIGIN_MAIN, "drift_only": kingdom.WORKTREE,
                       "non_authoritative": ["the fork"]}),
        owner(D2, label="D2", resolves=["dispute:citizen-layer", "q:citizen-layer"],
              outcome={"dispute:citizen-layer": "soul"}, open={"q:citizen-layer": "Should the fleet resume?"},
              stays_open=["A fixture card naming another layer stays contested."],
              effects={"layer_overrule": "harvest:fleet", "layer_default": "soul"}),
        owner(D3, label="D3", resolves=["q:in-repo-private-area"], effects={"confirms": "dec-2026-10-17-1"}),
        owner(D5, label="D5", resolves=["q:unattributed-surfaces"],
              effects={"ownership": [{"provider": "cloudflare", "basis": "owner answer", "ids": OWNED},
                                     {"provider": "fly", "basis": "collective answer",
                                      "ids": ["surface:fly:collector"]}]}),
        owner(D6, label="D6", resolves=["q:residual-cloud"], open={"q:residual-cloud": "What about the Fly half?"},
              effects={"provider_status": {"provider": "aws", "status": "in-progress-elsewhere"}, "no_calls": True,
                       "sphere_values": ["not", "applied"]}),
    ]


QUESTIONS = [
    {"id": "q:taxonomy-authority", "status": "open", "text": "Which taxonomy?"},
    {"id": "q:citizen-layer", "status": "open", "text": "Soul or fleet? Should the fleet resume?"},
    {"id": "q:in-repo-private-area", "status": "open", "text": "Where may the map live?"},
    {"id": "q:still-open", "status": "open", "text": "A question nobody answered yet."},
]
PRIVATE_QUESTIONS = [
    {"id": "q:unattributed-surfaces", "status": "open", "text": "Who owns these?", "committed": False},
    {"id": "q:residual-cloud", "status": "open", "text": "AWS stacks and Fly resources?", "committed": False},
]
DISPUTES = [
    {"id": "dispute:taxonomy-authority", "title": "Which taxonomy", "status": "open", "proposal_rule": "P15",
     "candidates": [{"claim": "worktree", "source": "local"}, {"claim": "origin/main", "source": "github"}]},
    {"id": "dispute:adr-0001", "title": "ADR-0001", "status": "open", "candidates": []},
]


def unit_curated():
    cur = test_model.empty_curated()
    cur["questions"] = copy.deepcopy(QUESTIONS)
    cur["disputes"] = copy.deepcopy(DISPUTES) + [{"id": "dispute:citizen-layer", "title": "Citizen layer",
                                                  "status": "open", "proposal_rule": "P10", "candidates": []}]
    cur["private"]["estate"]["question"] = copy.deepcopy(PRIVATE_QUESTIONS)
    cur["decisions"] = owner_decisions() + [{"id": "dec-2026-10-17-10", "date": "2026-10-17", "proposal": "prop:P01:"
                                             + "a" * 12, "outcome": "declined", "reason": "not now"}]
    return cur


class DecisionIndexTests(fixture.EstateTestCase):

    def test_resolved_questions_and_disputes_take_the_decided_status(self):
        cur = decisions.apply(unit_curated())
        by_id = {q["id"]: q for q in cur["questions"] + cur["disputes"] + cur["private"]["estate"]["question"]}
        self.assertEqual((by_id["q:taxonomy-authority"]["status"], by_id["q:taxonomy-authority"]["decided_by"]),
                         (decisions.DECIDED, [D1]))
        self.assertEqual(by_id["dispute:taxonomy-authority"]["outcome"], ["origin/main"])
        self.assertEqual((by_id["q:citizen-layer"]["status"], by_id["q:citizen-layer"]["open_text"]),
                         (decisions.PARTLY, "Should the fleet resume?"))
        self.assertEqual(by_id["q:residual-cloud"]["status"], decisions.PARTLY)  # a private question
        self.assertEqual(by_id["q:unattributed-surfaces"]["status"], decisions.DECIDED)
        self.assertEqual(by_id["q:still-open"]["status"], "open")
        self.assertEqual(by_id["dispute:adr-0001"]["status"], "open")
        self.assertNotIn("decided_by", by_id["dispute:adr-0001"])
        # Proposal dispositions are not owner decisions.
        self.assertEqual([d["id"] for d in cur["owner_decisions"]], [D1, D2, D3, D5, D6])
        self.assertEqual(cur["problems"], [])
        self.assertIs(decisions.apply(cur), cur)
        self.assertEqual(cur["problems"], [])  # applying twice adds nothing

    def test_a_later_decision_closes_the_remainder_an_earlier_one_left(self):
        rows = [owner(D2, resolves=["q:x"], open={"q:x": "the rest"}),
                owner("dec-2026-10-18-1", date="2026-10-18", resolves=["q:x"])]
        found = decisions.resolution(rows)["q:x"]
        self.assertEqual((found["status"], found["open"], found["decided_by"]),
                         (decisions.DECIDED, None, [D2, "dec-2026-10-18-1"]))

    def test_shape_problems_are_named(self):
        rows = [owner(D1, resolves=["q:typo"], open={"q:other": "x"}, effects={"taxonomy_ref": "main"}),
                owner(D1, resolves=[]), {"id": "dec-2026-10-17-5", "kind": decisions.KIND, "resolves": "q:x"}]
        problems = decisions.problems(rows, {"q:x"})
        joined = "\n".join(problems)
        for needle in ("resolves q:typo", "open names q:other", "taxonomy_ref must be one of", "appears twice",
                       "resolves must be a list", "has no subject"):
            self.assertIn(needle, joined)

    def test_the_authority_decision_picks_the_primary_ref_over_the_config(self):
        rules = decisions.rules(owner_decisions())
        pinned = decisions.primary_ref({"kingdom": {"ref": kingdom.WORKTREE}}, rules)
        self.assertEqual((pinned["ref"], pinned["basis"], pinned["decision"], pinned["conflict"]),
                         (kingdom.ORIGIN_MAIN, "decision", D1, True))
        self.assertIn("contradicts owner decision " + D1, decisions.conflict_reason(pinned))
        agreeing = decisions.primary_ref({"kingdom": {"ref": kingdom.ORIGIN_MAIN}}, rules)
        self.assertFalse(agreeing["conflict"])
        self.assertIsNone(decisions.conflict_reason(agreeing))
        self.assertEqual(decisions.primary_ref({"kingdom": {"ref": kingdom.ORIGIN_MAIN}}, decisions.rules([]))["basis"],
                         "config")
        self.assertEqual(decisions.primary_ref({}, decisions.rules([]))["ref"], kingdom.WORKTREE)

    def test_config_edit_keeps_comments_and_other_tables(self):
        text = "# owner config\n[kingdom]\n# pinned at import\nref = \"worktree\"\n\n[tree]\nenabled = true\n"
        new = decisions.config_with_ref(text, kingdom.ORIGIN_MAIN)
        self.assertEqual(tomllib.loads(new), {"kingdom": {"ref": kingdom.ORIGIN_MAIN}, "tree": {"enabled": True}})
        self.assertIn("# pinned at import\n", new)
        self.assertIn("# owner config\n", new)
        bare = decisions.config_with_ref("[tree]\nenabled = true\n", kingdom.ORIGIN_MAIN)
        self.assertEqual(tomllib.loads(bare)["kingdom"]["ref"], kingdom.ORIGIN_MAIN)
        empty_table = decisions.config_with_ref("[kingdom]\n\n[tree]\nenabled = false\n", kingdom.ORIGIN_MAIN)
        self.assertEqual(tomllib.loads(empty_table)["kingdom"]["ref"], kingdom.ORIGIN_MAIN)

    def test_unknown_effects_are_listed_as_not_applied(self):
        applied, pending = decisions.effect_keys(owner_decisions()[-1])
        self.assertEqual((sorted(applied), pending), (["no_calls", "provider_status"], ["sphere_values"]))


class LayerRulingTests(fixture.EstateTestCase):
    enums = fixture.KINGDOM_ENUMS
    ruling = {"field": "layer", "overrule": "harvest:fleet", "default": "soul", "decision": D2}

    def citizen(self, layer="soul"):
        rules = test_model.mini_ref(kingdom.WORKTREE, "")
        card = kingdom.parse_card(fixture.card_text("citizen-ada", kind="lineage", layer=layer, owner_sister="sophia",
                                                    domain="sophia"), self.enums, rules)
        view = kingdom.harvest_view(card, None, os.path.join(rules["citizens_dir_path"], "citizen-ada"), rules)
        return card, view

    def test_a_decided_dispute_settles_the_card_layer_and_keeps_harvest_as_a_claim(self):
        card, view = self.citizen()
        one = model.resolve_field("layer", card, None, view, self.enums, self.ruling)
        self.assertEqual((one["status"], one["value"], one["basis"], one["decided_by"]),
                         ("settled", "soul", "owner-decision", D2))
        fleet = next(c for c in one["candidates"] if c["source"] == "harvest:fleet")
        self.assertEqual((fleet["value"], fleet["overruled_by"]), ("fleet", D2))
        facet = model.combine_refs({kingdom.WORKTREE: one, kingdom.ORIGIN_MAIN: copy.deepcopy(one)}, kingdom.ORIGIN_MAIN)
        self.assertEqual((facet["status"], facet["value"], facet["decided_by"]), ("settled", "soul", D2))
        self.assertEqual(model.contested_values(facet), ["soul"])
        # Without the ruling the same claims stay contested.
        self.assertEqual(model.resolve_field("layer", card, None, view, self.enums)["status"], "contested")

    def test_a_card_naming_another_layer_stays_contested(self):
        # F3: D2 says citizens are soul. A card naming another layer is a case it does not cover:
        # the contest with harvest's forced fleet stays open for Yu, and D2 is not credited with it.
        card, view = self.citizen("economy")
        one = model.resolve_field("layer", card, None, view, self.enums, self.ruling)
        self.assertEqual((one["status"], one["value"], one["basis"]), ("contested", None, "harvest-rule"))
        self.assertNotIn("decided_by", one)
        self.assertFalse(any(c.get("overruled_by") for c in one["candidates"]))

    def test_the_default_holds_when_the_forced_layer_was_the_only_claim(self):
        rules = test_model.mini_ref(kingdom.WORKTREE, "")
        card = kingdom.parse_card("name: citizen-cy\nkind: lineage\n", self.enums, rules)
        view = kingdom.harvest_view(card, None, os.path.join(rules["citizens_dir_path"], "citizen-cy"), rules)
        self.assertEqual(model.resolve_field("layer", card, None, view, self.enums)["status"], "roster-fallback")
        one = model.resolve_field("layer", card, None, view, self.enums, self.ruling)
        self.assertEqual((one["status"], one["value"]), ("settled", "soul"))
        self.assertIn({"value": "soul", "source": "owner-decision"}, one["candidates"])

    def test_a_card_that_agrees_with_harvest_needs_no_ruling(self):
        card, view = self.citizen("fleet")
        one = model.resolve_field("layer", card, None, view, self.enums, self.ruling)
        self.assertEqual((one["status"], one["value"], one["basis"]), ("settled", "fleet", "card"))
        self.assertNotIn("decided_by", one)
        kind = model.resolve_field("kind", card, None, view, self.enums, self.ruling)
        self.assertNotIn("decided_by", kind)  # the ruling is about the layer only

    def test_an_authority_decision_ends_the_ref_divergence_contest(self):
        worktree = model.resolve_field("layer", None, None, None, self.enums)
        origin = model.resolve_field("layer", None, {"layer": "runtime"}, None, self.enums)
        per_ref = {kingdom.WORKTREE: worktree, kingdom.ORIGIN_MAIN: origin}
        self.assertEqual(model.combine_refs(per_ref, kingdom.ORIGIN_MAIN)["status"], "contested")
        facet = model.combine_refs(per_ref, kingdom.ORIGIN_MAIN, authority=D1)
        self.assertEqual((facet["status"], facet["value"], facet["ref"]), ("roster-fallback", "runtime", kingdom.ORIGIN_MAIN))
        self.assertTrue(facet["ref_divergent"])
        self.assertEqual(facet["authority"], D1)
        self.assertEqual(facet["by_ref"][kingdom.WORKTREE], {"status": "unset", "value": None})
        self.assertEqual(model.by_ref_text(facet),
                         "origin/main roster-fallback runtime (authority, %s); worktree unset" % D1)


# ── the synthetic estate, before and after the owner decisions ──────────────────────────────

def write_decided_curation(e, caveat_dir):
    """write_curation, plus the questions, disputes, accounts and decisions these tests need."""
    test_model.write_curation(e, caveat_dir)
    path = os.path.join(e.layer, "curated", "estate.toml")
    with open(path, "rb") as stream:
        doc = tomllib.load(stream)
    doc["dispute"] += copy.deepcopy(DISPUTES)
    doc["question"] = copy.deepcopy(QUESTIONS)
    fixture.write_file(path, safety.toml_dumps(doc))
    curated_dir = os.path.join(e.private, "curated")
    private = os.path.join(curated_dir, "estate.toml")
    with open(private, "rb") as stream:
        doc = tomllib.load(stream)
    doc["question"] = copy.deepcopy(PRIVATE_QUESTIONS)
    doc["account"] = [
        {"id": "account:cloudflare:estate", "provider": "cloudflare", "label": "estate", "purpose": "zones"},
        {"id": "account:fly:estate", "provider": "fly", "label": "estate", "purpose": "apps"},
        {"id": "account:aws:old", "provider": "aws", "label": "old", "purpose": "January stacks",
         "credential_artifacts": ["artifact:fixture-keys"]},
    ]
    os.chmod(curated_dir, 0o700)
    fixture.write_file(private, safety.toml_dumps(doc), mode=0o600)
    os.chmod(curated_dir, 0o500)


def set_decisions(e, rows):
    fixture.write_file(os.path.join(e.layer, "curated", "decisions.toml"),
                       safety.toml_dumps({"decision": rows}) if rows else "")


def build(cls, prev=None, cfg=None):
    curated = model.load_curated(cls.estate.layer)
    srcs = model.gather_sources(cls.estate.config, cls.estate.kos.path, curated, cls.estate.home)
    snapshot = model.build_records(cls.census, cls.foundation, srcs, curated, VOCAB, prev,
                                   cfg if cfg is not None else cls.config, home=cls.estate.home,
                                   repo_reader=model.read_canonical)
    return curated, srcs, snapshot


class FixtureDecisionTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.estate = e
        caveat_dir = os.path.join(e.home, "empty-build")
        os.makedirs(caveat_dir)
        write_decided_curation(e, caveat_dir)
        cls.config = dict(e.config, kingdom={})  # no pin: the decisions alone pick the ref
        cls.census = census_run(e)
        cls.foundation = kingdom.read_foundation(e.kos.path)
        cls.blobs = proposals.read_blobs(cls.foundation)
        set_decisions(e, [])
        cls.before_curated, _srcs, cls.before = build(cls)
        cls.before_props = proposals.propose(cls.before, cls.foundation, None, cls.before_curated["decisions"],
                                             cls.blobs, None, None, cls.before_curated, VOCAB["facets"])
        set_decisions(e, owner_decisions())
        cls.curated, cls.srcs, cls.snapshot = build(cls, prev={"records": cls.before["records"],
                                                               "observed_at": cls.before["observed_at"]})
        cls.props = proposals.propose(cls.snapshot, cls.foundation, cls.before_props, cls.curated["decisions"],
                                      cls.blobs, None, None, cls.curated, VOCAB["facets"])
        cls.by_id = {r["id"]: r for r in cls.snapshot["records"]}
        cls.area = safety.PrivateArea(e.layer)
        run_id = "20261017T120000Z-00d1"
        cls.area.mkdir("runs/" + run_id)
        cls.area.write("runs/%s/%s" % (run_id, safety.RUN_MARKER), run_id + "\n")
        cls.run_dir = os.path.join(cls.area.root, "runs", run_id)
        cls.tree = tree.build_tree(cls.run_dir, cls.snapshot, e.layer, None, home=e.home)
        cls.files = render.render_all(cls.run_dir, cls.snapshot, cls.props, {"mode": "full", "first_run": False,
                                                                             "tree": cls.tree},
                                      curated=cls.curated, vocab=VOCAB, portfolio=cls.srcs.get("portfolio"),
                                      prev_props=cls.before_props, home=e.home)
        with open(cls.files["ATLAS.md"], encoding="utf-8") as stream:
            cls.atlas = stream.read()

    def project(self, name, owner="github.com/cambridgetcg/"):
        return self.by_id[owner + name]

    def section(self, heading, until=None):
        rest = self.atlas.split(heading + "\n", 1)[1]
        return rest.split("\n" + until, 1)[0] if until else rest

    # ── model ──────────────────────────────────────────────────────────────────────────────

    def test_the_snapshot_validates_and_reads_the_authority_ref(self):
        problems = model.validate(self.snapshot, VOCAB["records"], facets=VOCAB["facets"], proposals=self.props)["problems"]
        self.assertEqual(problems, [])
        self.assertEqual(self.snapshot["ref"], kingdom.ORIGIN_MAIN)
        self.assertEqual((self.snapshot["authority"]["basis"], self.snapshot["authority"]["decision"]), ("decision", D1))
        self.assertFalse(any("contradicts" in r for r in self.snapshot["degraded_reasons"]))
        self.assertEqual(self.before["ref"], kingdom.WORKTREE)

    def test_citizens_settle_on_soul_and_keep_the_fleet_claim(self):
        for name in ("citizen-ada", "citizen-bo"):
            before = next(r for r in self.before["records"] if r["id"] == "github.com/cambridgetcg/" + name)
            self.assertEqual(before["facets"]["layer"]["status"], "contested")
            layer = self.project(name)["facets"]["layer"]
            self.assertEqual((layer["status"], layer["value"], layer["decided_by"]), ("settled", "soul", D2))
            self.assertIn(("fleet", "harvest:fleet", D2),
                          [(c["value"], c["source"], c.get("overruled_by")) for c in layer["candidates"]])
        group = self.by_id["group:fleet-citizens/fixture-citizens"]
        self.assertEqual(group["kingdom_claims"]["layer_status"], {"settled": 2})

    def test_the_authority_ref_ends_the_ref_divergence_contest(self):
        before = next(r for r in self.before["records"] if r["id"] == "github.com/cambridgetcg/edge-worker")
        self.assertEqual(before["facets"]["layer"]["status"], "contested")
        edge = self.project("edge-worker")["facets"]["layer"]
        self.assertEqual((edge["status"], edge["value"], edge["authority"]), ("roster-fallback", "runtime", D1))
        self.assertTrue(edge["ref_divergent"])
        drift = [d for d in self.snapshot["drift"] if d["code"] == "ref-divergent-facet"
                 and d["id"] == "github.com/cambridgetcg/edge-worker" and d["detail"].startswith("layer:")]
        self.assertEqual(len(drift), 1)
        self.assertIn("(authority, %s)" % D1, drift[0]["detail"])
        contested = [r["id"] for r in self.snapshot["records"] if r["kind"] == "project"
                     and r["presence"] == "present" and r["facets"]["layer"]["status"] == "contested"]
        self.assertEqual(contested, [])

    def test_a_config_pin_against_the_decision_degrades_the_run(self):
        _curated, _srcs, pinned = build(type(self), cfg=self.estate.config)
        self.assertEqual(pinned["ref"], kingdom.ORIGIN_MAIN)
        reasons = [r for r in pinned["degraded_reasons"] if "contradicts owner decision" in r]
        self.assertEqual(len(reasons), 1)
        self.assertIn("--sync-config", reasons[0])

    def test_ownership_lands_on_the_estate_accounts(self):
        cloudflare = self.by_id["account:cloudflare:estate"]
        self.assertEqual([(o["id"], o["observed"]) for o in cloudflare["owns"]],
                         [(OWNED[0], True), (OWNED[1], True), (OWNED[2], False)])
        docs = self.by_id["surface:cf-pages:alpha-docs"]
        self.assertEqual((docs["account"]["id"], docs["account"]["decision"]), ("account:cloudflare:estate", D5))
        self.assertEqual(self.by_id["zone:example.dev"]["account"]["basis"], "owner answer")
        fly = self.by_id["account:fly:estate"]
        self.assertEqual(fly["owns"], [{"id": "surface:fly:collector", "decision": D5, "basis": "collective answer",
                                        "observed": False}])
        self.assertNotIn("account", self.by_id["surface:cf-pages:alpha-pages"])

    def test_a_provider_status_marks_its_account_and_attention_rows(self):
        aws = self.by_id["account:aws:old"]
        self.assertEqual((aws["decided_status"]["status"], aws["decided_status"]["decision"]),
                         ("in-progress-elsewhere", D6))
        rows = [a for a in self.snapshot["attention"] if a["id"] == "artifact:fixture-keys"]
        self.assertTrue(rows)
        self.assertTrue(all((a["status"], a["decision"]) == ("in-progress-elsewhere", D6) for a in rows))
        self.assertFalse(any(a.get("status") for a in self.snapshot["attention"] if a["id"] != "artifact:fixture-keys"))
        self.assertEqual(self.snapshot["decision_effects"][D6]["attention_rows"], len(rows))

    # ── proposals ──────────────────────────────────────────────────────────────────────────

    def test_decided_proposals_are_superseded_and_follow_ups_open(self):
        props = {p["id"]: p for p in self.props}
        old_p10 = [p for p in self.before_props if p["rule"] == "P10"]
        old_p15 = [p for p in self.before_props if p["rule"] == "P15"
                   and p["proposed"].get("decision") == "foundation-divergence"]
        self.assertTrue(old_p10 and old_p15)
        # The citizens' P10 was settled by the ruling; edge-worker's (a ref divergence) by the authority.
        expected = [(p, D2 if any("citizen-" in m for m in p["current"]["members"]) else D1) for p in old_p10]
        self.assertEqual(sorted(d for _p, d in expected), [D1, D2])
        for prop, decision in expected + [(p, D1) for p in old_p15]:
            self.assertEqual((props[prop["id"]]["status"], props[prop["id"]]["decision_ref"]), ("superseded", decision))
        self.assertFalse([p for p in self.props if p["rule"] in ("P10", "P15") and p["status"] == "open"])
        # U1: the record of what a decision retired outlives the build that retired it.
        again = proposals.propose(self.snapshot, self.foundation, self.props, self.curated["decisions"],
                                  self.blobs, None, None, self.curated, VOCAB["facets"])
        kept = {p["id"]: p for p in again if p["status"] == "superseded"}
        for prop, decision in expected + [(p, D1) for p in old_p15]:
            self.assertEqual(kept[prop["id"]]["decision_ref"], decision)
        without = [d for d in self.curated["decisions"] if d.get("id") != D2]
        dropped = proposals.propose(self.snapshot, self.foundation, self.props, without, self.blobs, None, None,
                                    self.curated, VOCAB["facets"])
        self.assertFalse([p for p in dropped if p["status"] == "superseded" and p.get("decision_ref") == D2])
        follow = [p for p in self.props if p["rule"] == "P17"]
        self.assertEqual(sorted(p["decision_ref"] for p in follow), [D1, D2])
        reconcile = next(p for p in follow if p["decision_ref"] == D1)
        self.assertEqual(reconcile["title"], "reconcile local kingdom-os main with origin/main (1 ahead / 2 behind)")
        self.assertEqual((reconcile["target"]["owner"], reconcile["needs_yu"]), ("kingdom-os", False))
        self.assertNotIn("ahead", json.dumps(reconcile["proposed"]))  # counts move; the id must not
        harvest = next(p for p in follow if p["decision_ref"] == D2)
        self.assertEqual(harvest["current"]["members"], ["github.com/cambridgetcg/citizen-ada",
                                                         "github.com/cambridgetcg/citizen-bo"])
        patch = harvest["proposed"]["patch"][kingdom.ORIGIN_MAIN]
        self.assertTrue(patch["applies"])
        self.assertIn("-      layer: 'fleet', // they ARE the fleet", patch["diff"])
        self.assertIn("+      layer: (card.layer as string) ?? 'soul', // owner decision %s" % D2, patch["diff"])
        self.assertEqual(harvest["upstream"]["status"], "same-as-current")
        self.assertIn(harvest["id"], self.project("citizen-ada")["proposals"])

    def test_a_citizen_card_skeleton_takes_the_decided_layer(self):
        # F4: D2 settles citizens as soul; a P01 skeleton for a citizen with no card says so, and
        # its facet stays unset until a card exists.
        cy = self.project("citizen-cy")
        self.assertEqual(cy["facets"]["layer"]["status"], "unset")
        p01 = next(p for p in self.props if p["rule"] == "P01" and p["target"]["record_id"] == cy["id"]
                   and p["status"] == "open")
        self.assertIn("# layer: owner decision %s: citizens are layer soul\nlayer: soul\n" % D2,
                      p01["proposed"]["card_text"])
        self.assertEqual(p01["decision_ref"], D2)
        other = [p for p in self.props if p["rule"] == "P01" and "citizen-" not in p["target"]["record_id"]
                 and p["status"] == "open"]
        self.assertTrue(other)
        self.assertFalse(any("citizens are layer" in p["proposed"]["card_text"] for p in other))

    # ── atlas and tree ─────────────────────────────────────────────────────────────────────

    def test_the_atlas_states_the_authority_and_labels_layers_from_it(self):
        self.assertIn("· ref origin/main (taxonomy authority, owner decision %s) ·" % D1, self.atlas)
        foundation = self.section("## §0 Foundation", "## Layer soul")
        self.assertIn("Taxonomy authority: origin/main of github.com/cambridgetcg/kingdom-os, by owner decision %s." % D1,
                      foundation)
        self.assertIn("The worktree ref is read and shown for drift only", foundation)
        self.assertIn("the estate never fetches", foundation)
        self.assertIn("Non-authoritative, proposals only: the fork.", foundation)
        rows = {r[0]: r for r in matrix_rows(self.atlas)}
        self.assertEqual(rows["commerce"][1], "PROJECTS")
        self.assertEqual(int(next(r for label, r in rows.items() if label.startswith("contested"))[-1]), 0)
        self.assertGreaterEqual(int(rows["soul"][-1]), 2)
        commerce = self.section("## Layer commerce", "## Layer os")
        self.assertTrue(commerce.startswith("\nPROJECTS: "))

    def test_questions_for_yu_list_only_what_is_still_open(self):
        questions = self.section("## Questions for Yu")
        for done in ("q:taxonomy-authority [", "q:in-repo-private-area [", "q:unattributed-surfaces ["):
            self.assertNotIn(done.replace("[", "\\["), questions)
        self.assertIn("q:still-open \\[open\\]: A question nobody answered yet.", questions)
        self.assertIn("q:citizen-layer \\[partly-decided by %s; still open\\]: Should the fleet resume?" % D2, questions)
        self.assertNotIn("Soul or fleet?", questions)
        self.assertIn("q:residual-cloud \\[partly-decided by %s; still open\\]: What about the Fly half?" % D6, questions)
        self.assertIn("No longer asked, decided (see Decided): q:in-repo-private-area (%s)" % D3, questions)
        # U3/F3: what the decisions themselves leave open, and the sphere review, are asked here too.
        self.assertIn("Left open by the owner decisions themselves:", questions)
        self.assertIn("- %s (D2): A fixture card naming another layer stays contested." % D2, questions)
        self.assertIn("Sphere review (KINGDOM OS, owner decision D4):", questions)
        self.assertIn("(<#kingdom-os>)", questions)

    def test_the_decided_section_says_what_each_decision_did(self):
        positions = [self.atlas.index(h + "\n") for h in ("## Proposals", "## Decided", "## Questions for Yu")]
        self.assertEqual(positions, sorted(positions))
        decided = self.section("## Decided", "## Questions for Yu")
        self.assertIn("### %s (D1) — subject %s" % (D1, D1), decided)
        self.assertIn("settles dispute:taxonomy-authority \\[now decided\\]: origin/main", decided)
        self.assertIn("2 records are no longer contested by harvest:fleet: their card says soul or names no layer (soul 2)", decided)
        self.assertIn("3 named → account:cloudflare:estate (owner answer): recorded here: %s, %s; not in this run's "
                      "sources (the portfolio map, the Cloudflare observer and inventory): %s" % tuple(OWNED), decided)
        # F8: a provider the estate lists nothing of says why it has no record, not that the app is gone.
        self.assertIn("1 named → account:fly:estate (collective answer): recorded here: none; no record in this run, "
                      "because the estate reads no fly account listing", decided)
        self.assertIn("aws: in-progress-elsewhere on account:aws:old", decided)
        self.assertIn("not applied by this tool version: sphere_values", decided)
        self.assertIn("proposals it superseded: prop:P10:", decided)
        disputed = self.section("## Disputed", "## Unplaced")
        self.assertIn("Decided by the owner (see Decided):", disputed)
        table = disputed.split("### Curated disputes", 1)[1].split("Decided by the owner", 1)[0]
        self.assertIn("dispute:adr-0001", table)
        self.assertNotIn("dispute:citizen-layer", table)

    def test_citizens_are_linked_under_soul_only(self):
        layer_dir = os.path.join(self.tree["tree_dir"], "1-layer")
        self.assertFalse(os.path.exists(os.path.join(layer_dir, "fleet")))
        contested = [os.path.join(base, name) for base, _dirs, files in os.walk(layer_dir) for name in files
                     if name == tree.CONTESTED]
        self.assertEqual(contested, [])
        soul = os.path.join(layer_dir, "soul", "fleet-citizens")
        self.assertTrue(os.path.lexists(soul))
        with open(os.path.join(self.tree["tree_dir"], "0-foundation", "README.txt"), encoding="utf-8") as stream:
            readme = stream.read()
        self.assertIn("origin/main ref at commit %s" % self.estate.kos.origin_main_commit, readme)
        self.assertIn("(the taxonomy authority, owner decision %s;" % D1, readme)

    def test_attention_and_drift_carry_the_decisions(self):
        with open(self.files["ATTENTION.md"], encoding="utf-8") as stream:
            attention = stream.read()
        self.assertIn("account:aws:old (aws): in-progress-elsewhere, by owner decision %s" % D6, attention)
        self.assertIn("in-progress-elsewhere (%s)" % D6, attention)
        with open(self.files["DRIFT.md"], encoding="utf-8") as stream:
            drift = stream.read()
        self.assertIn("KINGDOM facets resolve on origin/main (taxonomy authority, owner decision %s)" % D1, drift)
        self.assertIn("ref-divergent-facet", drift)


def census_run(e):
    import census
    return census.run_census(e.config, None, "full", home=e.home, layer_dir=e.layer)


def matrix_rows(atlas):
    from . import test_render_tree
    return test_render_tree.md_table(test_render_tree.md_section(atlas, "## Layer × liveness"))


class PortfolioWorkerTests(fixture.EstateTestCase):

    def test_a_worker_without_a_name_field_is_named_by_its_id(self):
        doc = fixture._portfolio_v1()
        doc["surfaces"].append({"id": "worker-1", "resource_id": "workers:acct:edge-thing", "kind": "workers",
                                "metadata": {"id": "edge-thing", "custom_domains": []}, "attribution": "unresolved"})
        doc["surfaces"].append({"id": "pages-2", "resource_id": "pages:x", "kind": "pages",
                                "metadata": {"id": "a-uuid-not-a-name"}, "attribution": "unresolved"})
        path = fixture.write_file(os.path.join(self.case_dir(), "portfolio.json"), json.dumps(doc))
        out = sources.read_portfolio_v1(path)
        names = {s["portfolio_id"]: s["name"] for s in out["surfaces"]}
        self.assertEqual((names["worker-1"], names["pages-2"], names["surface-1"]), ("edge-thing", None, "alpha"))


# ── the command line ────────────────────────────────────────────────────────────────────────

class CommandLineDecisionTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.estate, cls.layer, cls.private = e, e.layer, e.private
        shutil.copytree(os.path.join(fixture.LAYER_DIR, "vocab"), os.path.join(e.layer, "vocab"))
        os.unlink(os.path.join(e.layer, "vocab", "kingdom.lock.toml"))
        caveat_dir = os.path.join(e.home, "empty-build")
        os.makedirs(caveat_dir)
        write_decided_curation(e, caveat_dir)
        set_decisions(e, owner_decisions())
        cls.accept = test_e2e.cli(e.layer, "accept-vocab", "--write")
        cls.first = test_e2e.cli(e.layer, "build")

    def cli(self, *argv):
        return test_e2e.cli(self.layer, *argv)

    def test_the_build_follows_the_decisions_and_reports_the_seeded_pin(self):
        self.assertEqual(self.accept[0], 0, self.accept[2])
        code, out, err = self.first
        self.assertEqual(code, 10, out + err)
        self.assertIn("contradicts owner decision " + D1, out)
        with open(os.path.join(self.private, "current", "ATLAS.md"), encoding="utf-8") as stream:
            self.assertIn("## Decided\n", stream.read())

    def test_sync_config_prints_first_then_writes_with_a_backup(self):
        config = os.path.join(self.private, "config.toml")
        with open(config, "rb") as stream:
            before = stream.read()
        code, out, _err = self.cli("decisions", "--sync-config")
        self.assertEqual(code, 0)
        self.assertIn("[kingdom].ref worktree -> origin/main (owner decision %s)" % D1, out)
        self.assertIn("nothing written", out)
        with open(config, "rb") as stream:
            self.assertEqual(stream.read(), before)
        code, out, err = self.cli("decisions", "--sync-config", "--write")
        self.assertEqual(code, 0, err)
        with open(config, "rb") as stream:
            parsed = tomllib.load(stream)
        self.assertEqual(parsed["kingdom"]["ref"], kingdom.ORIGIN_MAIN)
        self.assertEqual(parsed["tree"], tomllib.loads(before.decode("utf-8"))["tree"])
        self.assertEqual(stat.S_IMODE(os.lstat(config).st_mode), 0o600)
        backups = [n for n in os.listdir(self.private) if n.startswith("config.toml.bak-")]
        self.assertEqual(len(backups), 1)
        backup = os.path.join(self.private, backups[0])
        self.assertEqual(stat.S_IMODE(os.lstat(backup).st_mode), 0o400)
        with open(backup, "rb") as stream:
            self.assertEqual(stream.read(), before)
        code, out, _err = self.cli("decisions")
        self.assertEqual(code, 0)
        self.assertIn("primary ref: origin/main (decision %s)" % D1, out)
        self.assertNotIn("contradicts", out)
        self.assertEqual(self.cli("decisions", "--sync-config")[0], 0)  # already aligned: nothing to do

    def test_words_are_kept_privately_and_never_printed(self):
        said = "fixture owner words about taxonomy"
        words = fixture.write_file(os.path.join(self.estate.tmp, "words.txt"), said + "\n")
        code, out, err = self.cli("decisions", "--words-from", words, "--for", "%s,%s" % (D1, D2))
        self.assertEqual(code, 0, err)
        self.assertNotIn(said, out)
        target = os.path.join(self.private, "curated", "decisions.toml")
        self.assertFalse(os.path.exists(target))
        code, out, err = self.cli("decisions", "--words-from", words, "--for", "%s,%s" % (D1, D2), "--write")
        self.assertEqual(code, 0, err)
        self.assertNotIn(said, out)
        self.assertEqual(stat.S_IMODE(os.lstat(target).st_mode), 0o600)
        self.assertEqual(safety.PrivateArea(self.layer).curated_mode(), 0o500)
        with open(target, "rb") as stream:
            rows = tomllib.load(stream)["words"]
        self.assertEqual([(r["decisions"], r["text"]) for r in rows], [([D1, D2], said)])
        self.assertIn("already kept", self.cli("decisions", "--words-from", words, "--for", "%s,%s" % (D1, D2),
                                               "--write")[1])
        self.assertEqual(self.cli("decisions", "--words-from", words, "--for", "dec-1999-01-01-1")[0], 2)
        words = model.load_curated(self.layer)["private"]["decisions"]["words"]
        self.assertEqual([(w["decisions"], w["text"]) for w in words], [([D1, D2], said)])
        # CB-2/CB-4: a private refinement of what a decision leaves open, and a private note, beside
        # the words (which a later write keeps); the committed file stays neutral.
        texts = fixture.write_file(os.path.join(self.estate.tmp, "private-texts.toml"),
                                   '[[open]]\ndecision = "%s"\nquestion = "q:residual-cloud"\n'
                                   'text = "Fixture volume vol-a: keep or remove?"\n\n'
                                   '[[note]]\ndecision = "%s"\ntext = "fixture task 42"\n' % (D6, D6))
        code, out, err = self.cli("decisions", "--private-from", texts, "--write")
        self.assertEqual(code, 0, err)
        self.assertNotIn("vol-a", out)
        curated = model.load_curated(self.layer)
        self.assertEqual([(w["decisions"], w["text"]) for w in curated["private"]["decisions"]["words"]],
                         [([D1, D2], said)])
        self.assertEqual(curated["owner_notes"], {D6: ["fixture task 42"]})
        found = decisions.resolution(curated["decisions"], decisions.private_texts(curated)[0])
        self.assertEqual(found["q:residual-cloud"]["open"], "Fixture volume vol-a: keep or remove?")
        self.assertEqual(found["q:residual-cloud"]["status"], decisions.PARTLY)
        self.assertIn("already kept", self.cli("decisions", "--private-from", texts, "--write")[1])
        bad = fixture.write_file(os.path.join(self.estate.tmp, "private-bad.toml"),
                                 '[[open]]\ndecision = "%s"\nquestion = "q:still-open"\ntext = "x"\n' % D6)
        self.assertEqual(self.cli("decisions", "--private-from", bad, "--write")[0], 2)
        self.assertEqual(len([n for n in os.listdir(os.path.dirname(target)) if n.startswith("decisions.toml.bak-")]), 1)

    def test_the_review_and_verify_harvest_follow_the_authority_ref(self):
        foundation = kingdom.read_foundation(self.estate.kos.path)
        worktree_sha = foundation["refs"][kingdom.WORKTREE]["harvest_blob_sha256"]
        origin_sha = foundation["refs"][kingdom.ORIGIN_MAIN]["harvest_blob_sha256"]
        self.assertNotEqual(worktree_sha, origin_sha)
        code, _out, err = self.cli("accept-vocab", "--reviewed-harvest", worktree_sha, "--write")
        self.assertEqual(code, 2)
        self.assertIn("the sha256 of the origin/main harvest.ts", err)
        lock_path = os.path.join(self.layer, "vocab", "kingdom.lock.toml")
        with open(lock_path, encoding="utf-8") as stream:
            old = stream.read()
        try:
            code, out, err = self.cli("accept-vocab", "--reviewed-harvest", origin_sha, "--write")
            self.assertEqual(code, 0, err)
            lock, _why = kingdom.read_lock(self.layer)
            self.assertEqual(lock["kingdom_os"][kingdom.REVIEWED_KEY], origin_sha)
            before = len(fixture.spawned())
            code, out, err = self.cli("check", "--verify-harvest")
        finally:
            fixture.write_file(lock_path, old)
        bun = [argv for argv in fixture.spawned()[before:] if os.path.basename(argv[0]) == "bun"]
        self.assertEqual([argv[2] for argv in bun], ["validate", "conformance"])
        for argv in bun:
            self.assertTrue(argv[1].startswith(os.path.join(os.path.realpath(self.private), ".verify-harvest-")), argv)
            self.assertTrue(argv[1].endswith(os.path.join("root", "bin", "harvest.ts")), argv)
        self.assertIn("origin/main harvest.ts matches the reviewed sha", out)
        self.assertEqual(code, 10, out + err)  # the stub's numbers are not the mirror's
        self.assertFalse([n for n in os.listdir(self.private) if n.startswith(".verify-harvest-")])
        self.assertFalse(os.path.exists(os.path.join(self.estate.tmp, "bun-called-without-verb")))


class ImportKeepsOwnerDecisionsTests(fixture.EstateTestCase):

    def test_an_overwriting_import_keeps_the_owner_decisions(self):
        home = os.path.join(self.tmp, "home-import")
        os.makedirs(os.path.join(home, "Desktop"))
        survey = test_curate.write_survey(self.case_dir("survey"), home)
        host = os.path.join(self.case_dir("host"), "business-ecosystem")
        layer = fixture.make_host(host, home=home)

        def run(**kw):
            with fixture.patched_env(HOME=home):
                return curate_import(survey, layer, host, home, **kw)

        run()
        path = os.path.join(layer, "curated", "decisions.toml")
        with open(path, encoding="utf-8") as stream:
            seeded = stream.read()
        mine = seeded + "\n" + safety.toml_dumps({"decision": [owner(D1, resolves=[], effects={"taxonomy_ref": "origin/main"})]})
        fixture.write_file(path, mine)
        report = run(overwrite=True)
        with open(path, encoding="utf-8") as stream:
            self.assertEqual(stream.read(), mine)
        status = next(i["status"] for i in report["committed"] if i["path"] == "curated/decisions.toml")
        self.assertEqual(status, "unchanged")


def curate_import(survey, layer, host, home, **kw):
    import curate
    return curate.import_survey(survey, write=True, layer_dir=layer, host=host, home=home, quiet=True,
                                card_enums=fixture.KINGDOM_ENUMS, **kw)


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
