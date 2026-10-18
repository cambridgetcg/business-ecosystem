"""Proposal tests: stable ids, the rules over the synthetic estate, ref-aware upstream status
against the origin/main blob, decisions, bulk keys, card_text without inline comments and the
lifecycle across runs. Nothing is applied anywhere; blobs are read with cat-file only."""
import copy
import datetime as dt
import json
import re

from . import fixture
from .test_model import NOW, VOCAB, build_fixture, mini_build, mini_checkout, projects, repo_path
import kingdom
import model
import proposals
import safety


def by_rule(props, rule):
    return [p for p in props if p["rule"] == rule]


def find(props, rule, record_id=None, field=None):
    hits = [p for p in props if p["rule"] == rule and (record_id is None or p["target"]["record_id"] == record_id)
            and (field is None or p["target"]["field"] == field)]
    if len(hits) != 1:
        raise AssertionError("%d %s proposals for %s/%s" % (len(hits), rule, record_id, field))
    return hits[0]


class FixtureProposalTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")
    MINI = "codeberg.org/zerone-dev/zerone-mini"

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        build_fixture(cls)
        cls.now = safety.utc_now()  # one clock for every run of this class, so runs compare exactly
        before = len(fixture.spawned())
        cls.blobs = proposals.read_blobs(cls.foundation)
        cls.blob_calls = fixture.spawned()[before:]
        cls.props = cls.run_queue()

    @classmethod
    def run_queue(cls, blobs=None, decisions=(), prev=None, lock=None):
        snapshot = model.build_records(cls.census, cls.foundation, cls.srcs, cls.curated, VOCAB, None,
                                       cls.estate.config, now=cls.now, home=cls.estate.home,
                                       repo_reader=model.read_canonical)
        cls.last_snapshot = snapshot
        return proposals.propose(snapshot, cls.foundation, prev, list(decisions), blobs or cls.blobs, lock,
                                 now=cls.now, curated=cls.curated, facets=VOCAB["facets"])

    def test_ids_are_identical_across_two_runs(self):
        again = self.run_queue()
        self.assertEqual([p["id"] for p in again], [p["id"] for p in self.props])
        self.assertEqual(json.dumps(again, sort_keys=True), json.dumps(self.props, sort_keys=True))
        self.assertEqual(len({p["id"] for p in self.props}), len(self.props))
        later = self.now + dt.timedelta(hours=3)
        snapshot = model.build_records(self.census, self.foundation, self.srcs, self.curated, VOCAB, None,
                                       self.estate.config, now=later, home=self.estate.home,
                                       repo_reader=model.read_canonical)
        shifted = proposals.propose(snapshot, self.foundation, None, [], self.blobs, None, now=later,
                                    curated=self.curated, facets=VOCAB["facets"])
        self.assertEqual([p["id"] for p in shifted], [p["id"] for p in self.props])

    def test_every_proposal_meets_the_contract(self):
        contract = {"kind": {"proposal": VOCAB["records"]["kind"]["proposal"]}, "enum": VOCAB["records"]["enum"]}
        result = model.validate([dict(p, kind="proposal") for p in self.props], contract, facets=VOCAB["facets"])
        self.assertEqual(result["problems"], [])
        for p in self.props:
            self.assertEqual(p["schema"], "estate.proposal/1")
            self.assertTrue(p["id"].startswith("prop:%s:" % p["rule"]))

    def test_card_against_roster_gives_settled_card_and_p07(self):
        mini = next(r for r in self.last_snapshot["records"] if r["id"] == self.MINI)
        self.assertEqual((mini["facets"]["layer"]["status"], mini["facets"]["layer"]["value"]), ("settled", "economy"))
        p07 = find(self.props, "P07", self.MINI, "layer")
        self.assertEqual((p07["current"]["value"], p07["proposed"]["value"]), ("os", "economy"))
        self.assertEqual(p07["target"]["owner"], "kingdom-os")
        self.assertEqual(p07["collab"], {"repo_id": kingdom.KOS_REMOTE_ID, "path_scopes": ["roster.conf"]})
        self.assertEqual(p07["upstream"]["status"], "same-as-current")
        self.assertEqual(p07["status"], "open")
        origin = p07["proposed"]["patch"]["origin/main"]
        pin = proposals.blob_id(self.blobs["origin/main"]["roster.conf"])
        self.assertEqual(origin["blob"], pin)
        self.assertEqual(origin["commit"], self.estate.kos.origin_main_commit)
        self.assertIn("a/roster.conf@" + pin, origin["diff"])
        self.assertIn("+zerone-mini | " + fixture.HOME_REL + "Desktop/zerone-mini | infra | economy |", origin["diff"])
        self.assertIsNotNone(p07["proposed"]["patch"]["worktree"]["diff"])
        self.assertIn(p07["id"], next(r for r in self.last_snapshot["records"] if r["id"] == self.MINI)["proposals"])

    def test_moved_roster_path_is_repointed_by_remote_id(self):
        p07 = find(self.props, "P07", "github.com/cambridgetcg/business-ecosystem", "path")
        self.assertEqual(p07["current"]["value"], fixture.HOME_REL + "Desktop/ecosystem")
        self.assertEqual(p07["proposed"]["value"], fixture.HOME_REL + "Desktop/business-ecosystem")
        self.assertEqual(p07["priority"], 1)

    def test_off_enum_card_values_give_p03(self):
        layer = find(self.props, "P03", "github.com/cambridgetcg/boot-lantern", "layer")
        self.assertTrue(layer["needs_yu"])
        self.assertIsNone(layer["proposed"]["value"])
        self.assertIn("competing vocabulary", layer["basis"][0])
        self.assertEqual(layer["options"][0]["values"], fixture.KINGDOM_ENUMS["layer"])
        state = find(self.props, "P03", "github.com/cambridgetcg/boot-lantern", "state")
        self.assertFalse(state["needs_yu"])
        self.assertEqual(state["proposed"]["value"], "active")
        self.assertIn("+state: active\n", state["proposed"]["patch"]["checkout-head"]["diff"])
        self.assertEqual(state["collab"]["path_scopes"], ["kingdom.yaml"])

    def test_the_citizen_layer_is_one_bulk_decision(self):
        p10 = [p for p in by_rule(self.props, "P10") if "card=soul" in p["bulk_key"]]
        self.assertEqual(len(p10), 1)
        p10 = p10[0]
        citizens = ["github.com/cambridgetcg/citizen-ada", "github.com/cambridgetcg/citizen-bo"]
        self.assertEqual(p10["current"]["members"], citizens)
        self.assertEqual(p10["bulk_count"], 2)
        self.assertEqual(p10["proposed"], {"value": None, "candidates": ["fleet", "soul"]})
        self.assertEqual((p10["target"]["owner"], p10["needs_yu"]), ("yu", True))
        self.assertIn("dispute:citizen-layer", p10["basis"])
        for pid in citizens:
            record = next(r for r in self.last_snapshot["records"] if r["id"] == pid)
            self.assertIn(p10["id"], record["proposals"])

    def test_origin_main_already_matching_is_resolved_upstream(self):
        p07 = find(self.props, "P07", self.MINI, "layer")
        for new_layer, upstream, status in (("economy", "matches-proposed", "resolved-upstream"),
                                            ("soul", "differs", "conflict-with-upstream")):
            blobs = copy.deepcopy(self.blobs)
            text = blobs["origin/main"]["roster.conf"].decode("utf-8")
            text = text.replace("zerone-mini | " + fixture.HOME_REL + "Desktop/zerone-mini | infra | os |",
                                "zerone-mini | " + fixture.HOME_REL + "Desktop/zerone-mini | infra | %s |" % new_layer)
            blobs["origin/main"]["roster.conf"] = text.encode("utf-8")
            again = find(self.run_queue(blobs), "P07", self.MINI, "layer")
            self.assertEqual(again["id"], p07["id"])
            self.assertEqual((again["upstream"]["status"], again["status"]), (upstream, status))
            self.assertEqual(again["upstream"]["origin_main_value"], new_layer)

    def test_a_declined_decision_suppresses_the_proposal(self):
        p07 = find(self.props, "P07", self.MINI, "layer")
        p10 = next(p for p in by_rule(self.props, "P10") if "card=soul" in p["bulk_key"])
        decisions = [{"id": "dec-2026-10-17-9", "date": "2026-10-17", "proposal": p07["id"], "outcome": "declined",
                      "reason": "the roster keeps os on purpose"},
                     {"id": "dec-2026-10-17-10", "date": "2026-10-17", "bulk_key": p10["bulk_key"], "outcome": "deferred",
                      "reason": "after the citizen review"}]
        again = self.run_queue(decisions=decisions)
        declined = next(p for p in again if p["id"] == p07["id"])
        self.assertEqual((declined["status"], declined["decision_ref"]), ("declined", "dec-2026-10-17-9"))
        deferred = next(p for p in again if p["id"] == p10["id"])
        self.assertEqual(deferred["status"], "deferred")
        summary = proposals.summary(again)
        self.assertEqual(summary["by_status"]["declined"], 1)
        self.assertEqual(summary["open"], proposals.summary(self.props)["open"] - 2)

    def test_card_text_is_ready_to_paste_without_inline_comments(self):
        cards = [p["proposed"]["card_text"] for p in by_rule(self.props, "P01")]
        self.assertTrue(cards)
        rules = self.foundation["refs"][kingdom.WORKTREE]
        for text in cards:
            for line in text.splitlines():
                self.assertTrue(line.startswith("#") or re.fullmatch(r"[A-Za-z_]+: [^#]*", line), line)
            parsed = kingdom.parse_card(text, rules["card_enums"], rules)
            self.assertEqual(parsed["off_enum"], {})
        self.assertFalse(any(p["target"]["record_id"].endswith(fixture.HOME_REL.rstrip("/")) for p in by_rule(self.props, "P01")))

    def test_previous_proposals_resolve_or_are_superseded(self):
        old = (NOW - dt.timedelta(days=45)).strftime("%Y-%m-%dT%H:%M:%SZ")
        p07 = find(self.props, "P07", self.MINI, "layer")
        prev = [dict(p07, first_seen=old),
                {"id": "prop:P04:" + "1" * 12, "rule": "P04", "status": "open", "first_seen": old,
                 "target": {"owner": "repo", "record_id": "github.com/cambridgetcg/alpha-service"}},
                {"id": "prop:P02:" + "2" * 12, "rule": "P02", "status": "open", "first_seen": old,
                 "target": {"owner": "repo", "record_id": "github.com/cambridgetcg/vanished"}},
                {"id": "prop:P02:" + "3" * 12, "rule": "P02", "status": "resolved-observed", "first_seen": old,
                 "target": {"owner": "repo", "record_id": "github.com/cambridgetcg/alpha-service"}}]
        again = {p["id"]: p for p in self.run_queue(prev=prev)}
        self.assertEqual(again[p07["id"]]["first_seen"], old)
        self.assertTrue(again[p07["id"]]["long_open"])
        self.assertEqual(again["prop:P04:" + "1" * 12]["status"], "resolved-observed")
        self.assertEqual(again["prop:P02:" + "2" * 12]["status"], "superseded")
        self.assertNotIn("prop:P02:" + "3" * 12, again)

    def test_registry_sites_and_derived_map_rules(self):
        runtime = find(self.props, "P11", "surface:cf-worker:agenttool-site", "runtime")
        self.assertEqual((runtime["current"]["value"], runtime["proposed"]["value"]), ("fly:agenttool", "cf-worker:agenttool-site"))
        self.assertIn("+    runtime: cf-worker:agenttool-site", runtime["proposed"]["patch"]["worktree"]["diff"])
        self.assertEqual(runtime["collab"]["path_scopes"], ["REGISTRY.yaml"])
        repo = find(self.props, "P11", "surface:cf-worker:agenttool-site", "repo")
        self.assertEqual(repo["proposed"]["value"], "github.com/cambridgetcg/alpha-service@main")
        p12 = find(self.props, "P12", "surface:cf-pages:alpha-docs")
        self.assertIn("  - id: alpha-docs\n", p12["proposed"]["entry"])
        self.assertIn("no-such-repo", [p["current"]["value"] for p in by_rule(self.props, "P13")])
        self.assertEqual(len(by_rule(self.props, "P14")), 1)
        p16 = find(self.props, "P16")
        self.assertEqual((p16["target"]["owner"], p16["proposed"]["note"]), ("pr1-owner", "A short doc note."))

    def test_foundation_divergence_and_vocab_drift(self):
        divergence = [p for p in by_rule(self.props, "P15") if p["proposed"].get("decision") == "foundation-divergence"]
        self.assertEqual(len(divergence), 1)
        lock = kingdom.make_lock(self.foundation)
        self.assertFalse(any(p["proposed"].get("decision") == "vocab-drift" for p in self.run_queue(lock=lock)))
        lock["refs"][kingdom.WORKTREE]["card_enums_block_sha256"] = "0" * 64
        drift = [p for p in self.run_queue(lock=lock) if p["proposed"].get("decision") == "vocab-drift"]
        self.assertEqual(len(drift), 1)
        self.assertEqual(drift[0]["priority"], 1)

    def test_blobs_are_read_with_cat_file_only(self):
        # GitRunner proves the clone is not a promisor before any object read; nothing else runs.
        subcommands = []
        for argv in self.blob_calls:
            self.assertEqual(argv[0].rsplit("/", 1)[-1], "git")
            subcommand = argv[argv.index("-C") + 2]
            subcommands.append(subcommand)
            self.assertIn(subcommand, ("cat-file", "config"))
            if subcommand == "config":
                self.assertEqual(argv[-1], safety.PROMISOR_PATTERN)
        self.assertEqual(subcommands.count("cat-file"), len(proposals.HOT_FILES))
        self.assertIsNotNone(self.blobs["origin/main"]["roster.conf"])
        self.assertEqual(self.blobs["origin_main_commit"], self.estate.kos.origin_main_commit)


class RosterPatchTests(fixture.EstateTestCase):
    """U12: a roster patch changes one column's span and nothing else on the row."""

    def test_roster_edit_keeps_alignment_and_adds_no_empty_columns(self):
        home = fixture.HOME_REL
        text = ("castle           | %sDesktop/castle           | reference   | soul     | sophia | remote   | keep\n"
                "short | %sx | ops | os\n" % (home, home))
        edited = proposals.roster_edit(text, "castle", "state", "active").split("\n")
        self.assertEqual(edited[0], "castle           | %sDesktop/castle           | reference   | soul     | sophia"
                                    " | active   | keep" % home)
        self.assertEqual(len(edited[0]), len(text.split("\n")[0]))
        short = proposals.roster_edit(text, "short", "state", "active").split("\n")[1]
        self.assertEqual(short, "short | %sx | ops | os | | active" % home)
        self.assertIsNone(proposals.roster_edit(text, "absent", "state", "active"))


class InMemoryProposalTests(fixture.EstateTestCase):

    def test_off_enum_only_card_gives_a_null_layer_and_p03(self):
        co = mini_checkout(repo_path("lantern"), "https://github.com/cambridgetcg/lantern.git",
                           card=fixture.card_text("lantern", layer="boot"))
        snapshot, foundation = mini_build([co])
        record = projects(snapshot)["github.com/cambridgetcg/lantern"]
        self.assertEqual((record["facets"]["layer"]["status"], record["facets"]["layer"]["value"]), ("off-enum-only", None))
        props = proposals.propose(snapshot, foundation, now=NOW, facets=VOCAB["facets"])
        p03 = find(props, "P03", record["id"], "layer")
        self.assertEqual(p03["current"]["value"], "boot")
        self.assertTrue(p03["needs_yu"])
        self.assertEqual(by_rule(props, "P01"), [])

    def test_card_economy_over_roster_os_in_memory(self):
        roster = "zm | " + fixture.HOME_REL + "Desktop/zm | infra | os | none | active | mini\n"
        co = mini_checkout(repo_path("zm"), "https://codeberg.org/zerone-dev/zm.git",
                           card=fixture.card_text("zm", kind="infra", layer="economy"))
        snapshot, foundation = mini_build([co], roster_text=roster)
        record = projects(snapshot)["codeberg.org/zerone-dev/zm"]
        self.assertEqual((record["facets"]["layer"]["status"], record["facets"]["layer"]["value"]), ("settled", "economy"))
        p07 = find(proposals.propose(snapshot, foundation, now=NOW), "P07", record["id"], "layer")
        self.assertEqual(p07["proposed"]["value"], "economy")
        self.assertEqual(p07["upstream"]["status"], "n/a")

    def test_valid_untracked_card_gives_p02_and_missing_card_gives_p01(self):
        loose = mini_checkout(repo_path("loose"), "https://github.com/cambridgetcg/loose.git",
                              card=fixture.card_text("loose"), card_tracked=False)
        bare = mini_checkout(repo_path("bare"), "https://github.com/cambridgetcg/bare.git", readme_title="Bare tool")
        snapshot, foundation = mini_build([loose, bare])
        props = proposals.propose(snapshot, foundation, now=NOW)
        self.assertEqual(find(props, "P02", "github.com/cambridgetcg/loose")["proposed"],
                         {"action": "git add kingdom.yaml and commit"})
        card = find(props, "P01", "github.com/cambridgetcg/bare")["proposed"]["card_text"]
        self.assertIn("# purpose: the README title\npurpose: Bare tool\n", card)
        self.assertIn("state: active\n", card)

    def test_proposal_ids_follow_the_formula(self):
        ident = proposals.proposal_id("P07", "roster.conf", "x", "layer", {"value": "economy", "patch": {"any": 1}})
        same = proposals.proposal_id("P07", "roster.conf", "x", "layer", {"value": "economy"})
        other = proposals.proposal_id("P07", "roster.conf", "x", "layer", {"value": "soul"})
        self.assertEqual(ident, same)
        self.assertNotEqual(ident, other)
        self.assertRegex(ident, r"^prop:P07:[0-9a-f]{12}$")
