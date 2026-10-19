"""Ideas plan tests (tool/ideas.py, on the owner plan store of tool/plans.py).

Ideas are proposals whose statuses only the owner sets: an import merges by stable idea id, only
proposes, keeps every owner status and keeps an idea a newer plan leaves out (marked missing); --set
records one owner status with a log, refusing other statuses and notes shaped like secrets. Each build
joins every idea with its own measurements of the backing the idea names (a wire, a motif, a capability,
a record): backed, not-backed, not-measured or no-backing, and an idea marked done that the run does not
back is queued, its status left as it is. A backing entry takes only its own kind's keys and values a build
can measure, so every plan an import accepts joins. The plan lives in the private curation only. The D8
hygiene plan shares the store, and its own tests run unchanged. Ideas and titles here are synthetic."""
import copy
import json
import os
import stat

from . import fixture
from . import test_e2e
from . import test_model
from . import test_motifs
import capability
import hygiene
import ideas
import model
import plans
import safety

pkg = test_motifs.pkg
FACETS = test_model.VOCAB["facets"]
OBSERVED_AT = "2026-10-19T00:00:00Z"
# A note shaped like a provider key, built in parts so this file passes the privacy lint.
KEYLIKE_NOTE = "kept in " + "AK" + "IA" + "ABCDEFGHIJKLMNOP"


def idea(ident, kind="adopt-motif", backed_by=(), title=None, **extra):
    return dict({"id": ident, "title": title or "Fixture idea " + ident, "kind": kind, "why": "a synthetic reason",
                 "backed_by": [dict(b) for b in backed_by], "related_records": []}, **extra)


def plan_doc(items, observed=OBSERVED_AT):
    return {"schema": ideas.PLAN_SCHEMA, "observed_at": observed, "generated_at": observed, "items": copy.deepcopy(items)}


ITEMS = [idea("I-events", backed_by=[{"motif": "domain-events"}]),
         idea("I-outbox", backed_by=[{"motif": "transactional-outbox", "state": "adopted"}]),
         idea("I-engine", kind="wire", backed_by=[{"record": pkg("operational/engine")}]),
         idea("I-retire-saga", kind="retire")]


def imported(items=ITEMS):
    doc, _counts = ideas.merge(plan_doc(items), None, "0" * 8, "2026-10-19T00:10:00Z")
    return doc


class StoreTests(fixture.EstateTestCase):

    def test_hygiene_and_ideas_are_two_owner_plans_of_one_store(self):
        self.assertIsInstance(hygiene.STORE, plans.Store)
        self.assertIsInstance(ideas.STORE, plans.Store)
        self.assertEqual((hygiene.PRIVATE_FILE, ideas.PRIVATE_FILE), ("curated/hygiene.json", "curated/ideas.json"))
        self.assertEqual((hygiene.MODE, ideas.MODE), (0o400, 0o400))
        self.assertEqual((hygiene.SET_BY, ideas.STORE.set_by), ("owner (estate hygiene --set)", "owner (estate ideas --set)"))
        # Only the hygiene plan keeps a baseline beside each item.
        self.assertEqual((hygiene.STORE.kept, ideas.STORE.kept), (("log", "baseline"), ("log",)))

    def test_the_modules_and_their_tests_pass_the_privacy_lint(self):
        import curate
        for rel in ("tool/plans.py", "tool/ideas.py", "tests/test_ideas.py"):
            with open(os.path.join(fixture.LAYER_DIR, rel), encoding="utf-8") as stream:
                body = stream.read()
            self.assertEqual(curate.lint_text(body, rel, curate.scope_of(rel)) + curate.lint_test_vectors(body, rel), [], rel)


class PlanCheckTests(fixture.EstateTestCase):

    def test_a_valid_plan_has_no_problems(self):
        self.assertEqual(ideas.plan_problems(plan_doc(ITEMS), FACETS), [])
        with_capability = plan_doc([idea("I-gap", "fill-gap", [{"capability": "marketing-outreach", "operating": "in-use"}]),
                                    idea("I-held", "fill-gap", [{"capability": "accounting", "record": pkg("operational/ledger"),
                                                                 "impl": "code-unbuilt", "operating": "unknown"}]),
                                    idea("I-wire", "wire", [{"wire": "sale-to-ledger", "code_state": "wired-unbuilt",
                                                             "stage": "demonstrated"}])])
        self.assertEqual(ideas.plan_problems(with_capability, FACETS), [])
        self.assertEqual(set(ideas.vocabularies(FACETS)["impl"]), set(capability.IMPL_ORDER))

    def test_an_import_only_proposes_and_shapes_are_refused(self):
        items = ITEMS + [dict(ITEMS[0]), idea("I-done", status="done"), idea("I-odd", kind="launch"),
                         idea("I spaced"), idea("I-two", backed_by=[{"motif": "a", "wire": "b"}]),
                         idea("I-empty", backed_by=[{"record": " "}]),
                         idea("I-value", backed_by=[{"capability": "teleportation"}])]
        problems = ideas.plan_problems(plan_doc(items), FACETS)
        for expected in ("I-events appears twice", "I-done: status 'done': an import only proposes", "kind 'launch'",
                         "id must have no spaces", "names exactly one of wire, motif, capability or record",
                         "backed_by record must be a non-empty string", "'teleportation' is not a capability value"):
            self.assertTrue(any(expected in p for p in problems), (expected, problems))
        self.assertEqual(ideas.plan_problems(dict(plan_doc(ITEMS), schema="estate.hygiene/1"), FACETS)[0][:6], "schema")
        self.assertIn("items must be a non-empty list", ideas.plan_problems(plan_doc([]), FACETS))

    def test_a_backing_entry_asks_only_what_its_kind_measures(self):
        refused = {"I-stage-number": {"wire": "sale-to-ledger", "stage": 7},
                   "I-stage-unknown": {"wire": "sale-to-ledger", "stage": "unknown"},
                   "I-code-state": {"wire": "sale-to-ledger", "code_state": "wird"},
                   "I-motif-state": {"motif": "domain-events", "state": "live"},
                   "I-motif-unmeasurable": {"motif": "domain-events", "state": "not-measured"},
                   "I-misspelt": {"motif": "domain-events", "stat": "unused"},
                   "I-borrowed": {"wire": "sale-to-ledger", "state": "adopted"},
                   "I-impl": {"capability": "accounting", "impl": "shipped"},
                   "I-operating": {"capability": "accounting", "operating": 1},
                   "I-record-extra": {"record": pkg("operational/engine"), "impl": "code"}}
        problems = ideas.plan_problems(plan_doc([idea(ident, backed_by=[ref]) for ident, ref in refused.items()]), FACETS)
        for ident in refused:
            self.assertTrue(any(p.startswith(ident + ":") for p in problems), (ident, problems))
        joined = "\n".join(problems)
        for expected in ("I-stage-number: backed_by wire stage 7 is not one of designed, demonstrated, accepted, active",
                         "I-motif-state: backed_by motif state 'live' is not one of adopted, reimplemented, unused, "
                         "no-library", "I-misspelt: backed_by motif does not take stat (it takes state)",
                         "I-borrowed: backed_by wire does not take state (it takes code_state, stage)",
                         "I-record-extra: backed_by record does not take impl (it takes nothing more)"):
            self.assertIn(expected, joined)
        # A value of the wrong type that reached a build would still never raise.
        holds, detail = ideas.check_backing({"wire": "w", "stage": 7}, {}, {"w": {"code_state": "wired",
                                                                                  "stage": "designed"}}, {})
        self.assertEqual((holds, detail), (False, "wire w measures wired, designed; wanted wired, 7"))


class MergeAndStatusTests(fixture.EstateTestCase):

    def test_a_first_import_proposes_every_idea_and_the_same_plan_again_changes_nothing(self):
        plan = plan_doc(ITEMS)
        doc, counts = ideas.merge(plan, None, "0" * 8, "2026-10-19T00:10:00Z")
        self.assertEqual(plans.doc_problems(ideas.STORE, doc), [])
        self.assertEqual(counts["added"], len(ITEMS))
        self.assertEqual([ideas.effective(i) for i in doc["items"]], [("proposed", "plan")] * len(ITEMS))
        self.assertNotIn("baseline", doc["items"][0])
        again, counts = ideas.merge(plan, doc, "0" * 8, "2026-10-20T00:00:00Z")
        self.assertIs(again, doc)
        self.assertEqual(counts["unchanged"], len(ITEMS))

    def test_a_reimport_keeps_the_owners_status_and_marks_a_dropped_idea_missing(self):
        doc, _before, _after = ideas.set_status(imported(), "I-events", "done", "built", "2026-10-19T01:00:00Z")
        later = [dict(ITEMS[0], title="Reworded"), ITEMS[1], ITEMS[2], idea("I-new", "merge")]
        new, counts = ideas.merge(plan_doc(later, "2026-10-21T00:00:00Z"), doc, "1" * 8, "2026-10-21T00:10:00Z")
        self.assertEqual((counts["added"], counts["updated"], counts["unchanged"], counts["missing"]), (1, 1, 2, 1))
        items = {i["id"]: i for i in new["items"]}
        self.assertEqual((ideas.effective(items["I-events"]), items["I-events"]["plan"]["title"]),
                         (("done", "owner"), "Reworded"))
        self.assertEqual(items["I-retire-saga"]["missing_since"], "2026-10-21T00:00:00Z")  # kept, never dropped
        self.assertEqual(len(new["imports"]), 2)

    def test_only_the_owner_sets_a_status_with_a_log(self):
        doc = imported()
        new, before, after = ideas.set_status(doc, "I-outbox", "accepted", "worth doing", "2026-10-19T02:00:00Z")
        self.assertEqual(after["log"][-1], {"at": "2026-10-19T02:00:00Z", "from": "proposed", "to": "accepted",
                                            "note": "worth doing", "by": "owner (estate ideas --set)"})
        self.assertIsNone(doc["items"][1]["owner"])  # the input document is not mutated
        diff = ideas.status_diff(before, after)
        self.assertIn('+  "status": "accepted"', diff)
        self.assertIn("(estate ideas --set)", diff)
        self.assertNotIn("Fixture idea", diff)  # the plan's words are not part of the diff
        same, b2, a2 = ideas.set_status(new, "I-outbox", "accepted", None, "later")
        self.assertIs(a2, b2)
        for args in (("I-nowhere", "done", None), ("I-outbox", "mitigated", None), ("I-outbox", "open", None),
                     ("I-outbox", "done", KEYLIKE_NOTE)):
            with self.assertRaises(safety.GuardError):
                ideas.set_status(doc, *args, "now")


def record(rid, kind="package", presence="present", values=(), impl="code", operating="unknown"):
    field = {"values": list(values), "basis": "rule:package-path",
             "by_value": {v: {"impl": impl, "operating": operating, "serves": "self"} for v in values}}
    out = {"id": rid, "kind": kind, "presence": presence}
    if kind == "project":
        out["display"] = {"capability": field}
    else:
        out["capability"] = field
    return out


class JoinTests(fixture.EstateTestCase):

    RECORDS = [record(pkg("operational/engine")), record(pkg("operational/ledger"), values=["accounting"]),
               record("github.com/cambridgetcg/fixture-shop", "project", values=["marketing-outreach"], impl="manual",
                      operating="in-use"),
               record(pkg("operational/gone"), presence="missing")]
    WIRES = {"rows": [{"name": "sale-to-ledger", "code_state": "wired", "stage": "designed"},
                      {"name": "unread", "code_state": None, "stage": "designed", "reason": "a side was not searched"}]}
    MOTIFS = {"rows": [{"name": "domain-events", "state": "adopted"}, {"name": "transactional-outbox", "state": "unused"},
                       {"name": "audit-trail", "state": "not-measured", "reason": "its host was not read"}]}

    def check(self, ref):
        by_id = {r["id"]: r for r in self.RECORDS}
        wires_ = {r["name"]: r for r in self.WIRES["rows"]}
        motifs_ = {r["name"]: r for r in self.MOTIFS["rows"]}
        return ideas.check_backing(ref, by_id, wires_, motifs_)[0]

    def test_each_kind_of_backing_is_read_from_the_run(self):
        cases = [({"wire": "sale-to-ledger"}, True), ({"wire": "sale-to-ledger", "stage": "demonstrated"}, False),
                 ({"wire": "sale-to-ledger", "code_state": "declared"}, False), ({"wire": "unread"}, None),
                 ({"wire": "nowhere"}, False), ({"motif": "domain-events"}, True), ({"motif": "transactional-outbox"}, False),
                 ({"motif": "transactional-outbox", "state": "unused"}, True), ({"motif": "audit-trail"}, None),
                 ({"capability": "accounting"}, True), ({"capability": "accounting", "impl": "manual"}, False),
                 ({"capability": "marketing-outreach", "operating": "in-use"}, True),
                 ({"capability": "accounting", "record": pkg("operational/engine")}, False),
                 ({"capability": "accounting", "record": pkg("operational/gone")}, None), ({"capability": "tax"}, False),
                 ({"record": pkg("operational/engine")}, True), ({"record": pkg("operational/gone")}, None),
                 ({"record": pkg("operational/never")}, False)]
        for ref, want in cases:
            self.assertIs(self.check(ref), want, ref)

    def test_done_without_backing_is_queued_and_the_status_stays_the_owners(self):
        doc = imported(ITEMS + [idea("I-mixed", backed_by=[{"motif": "domain-events"}, {"motif": "audit-trail"}])])
        for ident in ("I-events", "I-outbox", "I-retire-saga", "I-mixed"):
            doc, _before, _after = ideas.set_status(doc, ident, "done", None, "2026-10-19T03:00:00Z")
        view = ideas.join(doc, None, self.RECORDS, self.WIRES, self.MOTIFS, "run-now")
        verdicts = {i["id"]: (i["status"], i["join"]["verdict"]) for i in view["items"]}
        self.assertEqual(verdicts, {"I-events": ("done", "backed"), "I-outbox": ("done", "not-backed"),
                                    "I-engine": ("proposed", "backed"), "I-retire-saga": ("done", "no-backing"),
                                    "I-mixed": ("done", "not-measured")})
        queued = {q["id"]: q["detail"] for q in ideas.queue_items(view)}
        self.assertEqual(sorted(queued), ["I-mixed", "I-outbox", "I-retire-saga"])
        self.assertIn("backing not-backed: motif transactional-outbox reads unused; wanted adopted", queued["I-outbox"])
        self.assertIn("(the idea names none)", queued["I-retire-saga"])
        self.assertEqual(view["counts"]["done_unbacked"], 3)
        self.assertEqual(view["counts"]["by_status"], {"done": 4, "proposed": 1})

    def test_a_missing_plan_is_no_plan_and_a_broken_one_degrades(self):
        none = ideas.join(None, "missing", [])
        self.assertEqual((none["status"], none["degraded"]), ("none", None))
        broken = ideas.join(None, "invalid json: x", [])
        self.assertEqual(broken["status"], "invalid")
        self.assertIn("the private ideas plan (private/curated/ideas.json) is invalid json", broken["degraded"])
        unjoined = ideas.join(imported(), None, None)
        self.assertEqual({i["join"]["verdict"] for i in unjoined["items"]}, {None})
        self.assertEqual(ideas.queue_items(unjoined), [])
        self.assertEqual(model.degraded_reasons({"ideas": broken}), [broken["degraded"]])
        self.assertEqual(model.degraded_reasons({"ideas": none}), [])


class CommandLineIdeasTests(fixture.EstateTestCase):
    """An ideas plan imported (a dry run first), built against a synthetic monorepo with the motifs of
    test_motifs, three ideas marked done, and the views, QUEUE, listing filters and privacy boundary."""
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import shutil
        e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.layer, cls.private = e.layer, e.private
        shutil.copytree(os.path.join(fixture.LAYER_DIR, "vocab"), os.path.join(e.layer, "vocab"))
        os.unlink(os.path.join(e.layer, "vocab", "kingdom.lock.toml"))
        caveat_dir = os.path.join(e.home, "empty-build")
        os.makedirs(caveat_dir)
        test_model.write_curation(e, caveat_dir)
        fixture.make_motif_monorepo(os.path.join(e.desktop, "fixture-domains"), home=e.home,
                                    remote="https://%s.git" % test_motifs.HOST)
        fixture.write_file(os.path.join(e.layer, "curated", "capabilities.toml"),
                           "# fixture\n" + safety.toml_dumps({"host": [test_motifs.HOST_ROW]}))
        fixture.write_file(os.path.join(e.layer, "curated", "motifs.toml"), safety.toml_dumps({"motif": test_motifs.MOTIF_ROWS}))
        cls.plan_path = fixture.write_file(os.path.join(e.tmp, "ideas-plan.json"), json.dumps(plan_doc(ITEMS)))
        test_e2e.cli(e.layer, "accept-vocab", "--write")
        cls.dry = test_e2e.cli(e.layer, "ideas", "--import", cls.plan_path)
        cls.after_dry = os.path.lexists(os.path.join(e.private, "curated", "ideas.json"))
        cls.imported = test_e2e.cli(e.layer, "ideas", "--import", cls.plan_path, "--write")
        cls.sets = [test_e2e.cli(e.layer, "ideas", "--set", ident, "--status", "done", "--write")
                    for ident in ("I-events", "I-outbox", "I-retire-saga")]
        cls.refused = test_e2e.cli(e.layer, "ideas", "--set", "I-engine", "--status", "mitigated", "--write")
        cls.built = test_e2e.cli(e.layer, "build")
        cls.listed = test_e2e.cli(e.layer, "ideas")
        cls.filtered = test_e2e.cli(e.layer, "ideas", "--status", "proposed")
        cls.bad_filter = test_e2e.cli(e.layer, "ideas", "--kind", "launch")
        cls.checked = test_e2e.cli(e.layer, "check")
        run_dir = os.path.realpath(os.path.join(e.private, "current"))
        cls.run_doc = test_e2e.read_json(os.path.join(run_dir, "run.json"))
        cls.atlas = test_e2e.read_text(os.path.join(run_dir, "ATLAS.md"))
        cls.full = test_e2e.read_text(os.path.join(run_dir, "CAPABILITIES.md"))
        cls.queue = test_e2e.read_text(os.path.join(run_dir, "QUEUE.md"))
        # A plan whose backing asks for a stage no build measures is refused, and the file is left as it was.
        bad = plan_doc([idea("I-stage", "wire", [{"wire": "sale-to-ledger", "stage": 7}])])
        cls.bad_import = test_e2e.cli(e.layer, "ideas", "--import", fixture.write_file(
            os.path.join(e.tmp, "ideas-bad.json"), json.dumps(bad)), "--write")
        # A file whose mode was changed by hand is named by check; one that no longer parses degrades a build.
        target = os.path.join(e.private, "curated", "ideas.json")
        cls.mode_kept = stat.S_IMODE(os.lstat(target).st_mode)
        os.chmod(target, 0o600)
        cls.mode_checked = test_e2e.cli(e.layer, "check")
        with open(target, "w", encoding="utf-8") as stream:
            stream.write("{")
        cls.broken_build = test_e2e.cli(e.layer, "build", "--reuse-census")

    def test_the_import_and_set_write_only_with_write_and_keep_backups(self):
        code, out, err = self.dry
        self.assertEqual(code, 0, out + err)
        self.assertIn("nothing written; add --write", out)
        self.assertFalse(self.after_dry)
        self.assertEqual(self.imported[0], 0, self.imported[1] + self.imported[2])
        self.assertIn("an import only proposes", self.imported[1])
        for code, out, err in self.sets:
            self.assertEqual(code, 0, out + err)
            self.assertIn("-> done (writing)", out)
        self.assertEqual(self.refused[0], 2)
        self.assertIn("--status must be one of proposed, accepted, declined, deferred, done", self.refused[2])
        self.assertEqual(self.mode_kept, 0o400)
        backups = [n for n in os.listdir(os.path.join(self.private, "curated")) if n.startswith("ideas.json.bak-")]
        self.assertEqual(len(backups), 3)  # one per --set; the first import created the file
        self.assertNotIn("ideas.json", self.checked[1])  # its mode is the one estate ideas keeps
        self.assertIn("warning: private curated/ideas.json is 600, not 400 (only estate ideas changes it)",
                      self.mode_checked[1])

    def test_a_plan_asking_for_what_no_build_measures_is_refused(self):
        code, out, err = self.bad_import
        self.assertEqual(code, 2, out + err)
        self.assertIn("I-stage: backed_by wire stage 7 is not one of", err)
        self.assertNotIn("I-stage", self.listed[1])  # the plan written before is the one that was listed

    def test_a_plan_that_no_longer_parses_degrades_the_build(self):
        code, out, err = self.broken_build
        self.assertEqual(code, 10, out + err)
        self.assertIn("degraded because:", out)
        self.assertIn("\n    - the private ideas plan (private/curated/ideas.json) is invalid json", out)

    def test_the_build_joins_the_ideas_and_queues_the_unbacked(self):
        code, out, err = self.built
        self.assertIn(code, (0, 10), out + err)
        self.assertIn("  ideas plan: 4 ideas · by status done 3, proposed 1 · backing backed 2, no-backing 1, not-backed 1 "
                      "· done but not backed 2 (QUEUE idea-done-unbacked)", out)
        self.assertEqual(self.run_doc["ideas"]["done_unbacked"], 2)
        self.assertNotIn("ideas", " ".join(self.run_doc["degraded_reasons"]))
        self.assertIn("## idea-done-unbacked (2)", self.queue)
        self.assertIn("I-outbox", self.queue)
        self.assertIn("I-retire-saga", self.queue)

    def test_the_views_and_the_listing(self):
        business = self.atlas[self.atlas.index("\n## Business (secondary)"):self.atlas.index("\n## Freshness")]
        self.assertIn("### Ideas (proposals, not built)", business)
        self.assertIn("4 ideas in the private ideas plan: proposals, never capability values, wires or motifs.", business)
        self.assertIn("- I-outbox \\[adopt-motif · done (owner) · backing not-backed\\] Fixture idea I-outbox", business)
        self.assertNotIn("I-engine", business)  # proposed and backed: only in CAPABILITIES.md
        self.assertIn("| I-engine | wire | proposed (plan) | Fixture idea I-engine | backed | holds: record %s is present |"
                      % pkg("operational/engine"), self.full)
        self.assertIn("Ideas plan (private): 1 proposed, waiting on Yu's status (estate ideas --status proposed); 2 "
                      "marked done and not backed in this run (QUEUE idea-done-unbacked)", self.atlas)
        code, out, err = self.listed
        self.assertEqual(code, 0, out + err)
        self.assertIn("ideas plan (private/curated/ideas.json): 4 ideas, 0 missing from the newest plan", out)
        self.assertIn("  done (owner)     adopt-motif not-backed   I-outbox  Fixture idea I-outbox", out)
        code, out, _err = self.filtered
        self.assertIn("  1 shown (filters: status=proposed)", out)
        self.assertEqual(self.bad_filter[0], 2)
        self.assertIn("--kind filters by one of merge, wire, adopt-motif", self.bad_filter[2])

    def test_nothing_of_the_plan_leaves_the_private_area(self):
        for base, _dirs, files in os.walk(self.layer):
            if base.startswith(self.private):
                continue
            for name in files:
                path = os.path.join(base, name)
                if os.path.islink(path):
                    continue
                with open(path, "rb") as stream:
                    self.assertNotIn(b"Fixture idea", stream.read(), path)


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
