"""Motif tests (tool/motifs.py): the patterns the code repeats, a view over package records.

A motif's users are measured as the packages whose non-test source imports one of its libraries (the
measured-import edges between package records); a package whose manifest only declares a library, a test
that imports it and a sibling library of the same motif are not users. With no importer, a curated
also_in anchor re-found as code reads reimplemented and none reads unused; a pattern no library embodies
reads no-library; what cannot be read reads not-measured, and positive evidence decides first. A library
that is no package of its host's checkout, or an anchor code no longer holds, is queued as stale. The
synthetic monorepo is built in a temporary directory, and the command line runs on a synthetic estate."""
import os

from . import fixture
from . import test_e2e
from . import test_model
from . import test_packages
import curate
import model
import motifs
import packages
import wires

HOST = test_packages.HOST
pkg = test_packages.pkg
FACETS = test_model.VOCAB["facets"]
HOST_ROW = {"id": HOST, "extra_folders": []}  # no quarantine list: build state not measured
MOTIF_ROWS = [
    {"name": "domain-events", "pattern": "A domain announces what happened.",
     "libraries": [pkg("shared/libs/messaging"), pkg("shared/libs/events")], "reviewed": False},
    {"name": "transactional-outbox", "pattern": "An event is stored with the change it reports.",
     "libraries": [pkg("shared/libs/outbox")], "reviewed": False},
    {"name": "saga-compensation", "pattern": "Completed steps are undone when a later one fails.",
     "libraries": [pkg("shared/libs/saga")],
     "also_in": [{"in": pkg("operational/engine"), "path": "operational/engine/src", "text": "async function runCompensation("},
                 {"in": pkg("operational/ledger"), "path": "operational/ledger/src/ledger.py", "text": "compensate by hand"}],
     "reviewed": False},
    {"name": "compensating-entry", "pattern": "A correction is a new offsetting entry.",
     "also_in": [{"in": pkg("operational/ledger"), "path": "operational/ledger/src/ledger.py", "text": "def create_reversal("}],
     "reviewed": False},
    {"name": "audit-trail", "pattern": "Every change is kept in an audit trail.",
     "libraries": [pkg("shared/libs/audit-logging")], "reviewed": False}]


def record(subpath, name, unbuilt=False):
    return {"id": pkg(subpath), "host": HOST, "name": name, "build": {"unbuilt": unbuilt}}


def edge(frm, to, basis=wires.MEASURED_IMPORT):
    return {"from": pkg(frm), "to": pkg(to), "basis": basis, "code_state": "wired", "also": []}


def anchor_hits(*found):
    """found_by_repo for the host: (path, text, found) triples."""
    return {HOST: {(p, t): {"path": p, "text": t, "found": f, "files": []} for p, t, f in found}}


READ = {HOST: {"id": HOST, "status": "read", "at_commit": "f" * 40}}


class VocabularyTests(fixture.EstateTestCase):

    def test_the_states_match_the_vocabulary(self):
        self.assertEqual(tuple(FACETS["vocab"]["motif_state"]["values"]), motifs.STATES)
        self.assertNotIn("live", motifs.STATES)

    def test_the_module_and_its_tests_pass_the_privacy_lint(self):
        for rel in ("tool/motifs.py", "tests/test_motifs.py"):
            with open(os.path.join(fixture.LAYER_DIR, rel), encoding="utf-8") as stream:
                body = stream.read()
            self.assertEqual(curate.lint_text(body, rel, curate.scope_of(rel)) + curate.lint_test_vectors(body, rel), [], rel)


class RowTests(fixture.EstateTestCase):

    def test_rows_of_the_wrong_shape_are_named_and_left_out(self):
        good = dict(MOTIF_ROWS[2], evidence="short", as_of="2026-10-19")
        bad = [dict(good, name="Bad Name"), dict(good, name="no-pattern", pattern=" "),
               dict(good, name="not-a-package", libraries=["github.com/cambridgetcg/fixture-domains"]),
               dict(good, name="abs-anchor", also_in=[{"in": pkg("x"), "path": "/abs", "text": "t"}]),
               dict(good, name="group-anchor", also_in=[{"in": "group:x/y", "path": "a", "text": "t"}]),
               {"name": "says-nothing", "pattern": "A pattern with nowhere to look."}, "not a table", dict(good)]
        rows, problems = motifs.rows({"motifs": [good] + bad})
        self.assertEqual(list(rows), ["saga-compensation"])
        self.assertEqual((rows["saga-compensation"]["evidence"], rows["saga-compensation"]["also_in"][0]["path"]),
                         ("short", "operational/engine/src"))
        self.assertEqual(len(problems), 8)
        joined = "\n".join(problems)
        for needle in ("needs a name", "needs the pattern", "libraries must be a list of package ids",
                       "also_in must be a list", "needs a library or an also_in anchor", "motif #8", "is named twice"):
            self.assertIn(needle, joined)

    def test_motif_anchors_join_the_wire_anchors_once_per_checkout(self):
        rows = motifs.rows({"motifs": MOTIF_ROWS})[0]
        wanted = {HOST: [{"path": "operational/ledger/src/ledger.py", "text": "def create_reversal("}]}
        merged = motifs.anchors_by_repo(rows, wanted)
        self.assertEqual(merged[HOST], [{"path": "operational/ledger/src/ledger.py", "text": "def create_reversal("},
                                        {"path": "operational/engine/src", "text": "async function runCompensation("},
                                        {"path": "operational/ledger/src/ledger.py", "text": "compensate by hand"}])
        self.assertEqual(len(wanted[HOST]), 1)  # the wires' own dict is not changed


class EvaluateTests(fixture.EstateTestCase):

    def setUp(self):
        super().setUp()
        self.records = {r["id"]: r for r in (record("shared/libs/messaging", "@x/messaging"),
                                             record("shared/libs/events", "@x/events"),
                                             record("shared/libs/outbox", "@x/outbox"),
                                             record("shared/libs/saga", "@x/saga"),
                                             record("operational/engine", "@x/engine", unbuilt=True),
                                             record("operational/intake", "@x/intake"))}
        self.edges = [edge("operational/engine", "shared/libs/messaging"), edge("shared/libs/events", "shared/libs/messaging"),
                      edge("operational/intake", "shared/libs/messaging", wires.MEASURED_MANIFEST)]

    def evaluate(self, index, found=None, records=None, hosts=READ):
        row = motifs.rows({"motifs": [MOTIF_ROWS[index]]})[0][MOTIF_ROWS[index]["name"]]
        return motifs.evaluate(row, self.records if records is None else records, self.edges, found or {}, hosts)

    def test_adopted_counts_importers_never_declarers_or_siblings(self):
        out = self.evaluate(0)
        self.assertEqual((out["state"], out["users"]), (motifs.ADOPTED, [pkg("operational/engine")]))
        messaging = out["libraries"][0]
        self.assertEqual((messaging["users"], messaging["declared"], messaging["unbuilt_users"]),
                         ([pkg("operational/engine")], [pkg("operational/intake")], 1))
        self.assertEqual(out["reason"], "1 package imports shared/libs/messaging (1) in non-test source")
        self.assertEqual(motifs.library_text(messaging), "shared/libs/messaging: imported by 1 (1 build- or "
                                                         "typecheck-quarantined), declared only by 1")

    def test_reimplemented_unused_and_no_library(self):
        found = anchor_hits(("operational/engine/src", "async function runCompensation(", "code"),
                            ("operational/ledger/src/ledger.py", "compensate by hand", "none"),
                            ("operational/ledger/src/ledger.py", "def create_reversal(", "code"))
        saga = self.evaluate(2, found)
        self.assertEqual(saga["state"], motifs.REIMPLEMENTED)
        self.assertEqual(saga["stale"], ["also_in %s: 'compensate by hand' under operational/ledger/src/ledger.py is "
                                         "found none, not code" % pkg("operational/ledger")])
        nothing = anchor_hits(("operational/engine/src", "async function runCompensation(", "none"),
                              ("operational/ledger/src/ledger.py", "compensate by hand", "doc"))
        self.assertEqual(self.evaluate(2, nothing)["state"], motifs.UNUSED)
        entry = self.evaluate(3, found)
        self.assertEqual((entry["state"], entry["stale"]), (motifs.NO_LIBRARY, []))
        self.assertIn("1 of 1 curated anchor found as code", entry["reason"])

    def test_what_cannot_be_read_is_not_measured_and_positive_evidence_decides_first(self):
        # The host was not read: neither a user count of 0 nor a stale library.
        unread = self.evaluate(1, records={}, hosts={})
        self.assertEqual((unread["state"], unread["stale"]), (motifs.NOT_MEASURED, []))
        self.assertIn("was not read for packages in this run", unread["reason"])
        # A library that is no package of a host that was read is stale, and the motif is not measured.
        gone = self.evaluate(4)
        self.assertEqual(gone["state"], motifs.NOT_MEASURED)
        self.assertEqual(gone["stale"], ["library %s is not a package of %s at ffffffffffff"
                                         % (pkg("shared/libs/audit-logging"), HOST)])
        # One importer is adoption although another library of the motif was not read.
        partial = dict(self.records)
        del partial[pkg("shared/libs/events")]
        self.assertEqual(self.evaluate(0, records=partial, hosts={})["state"], motifs.ADOPTED)
        # No importer and an anchor not searched: not unused.
        self.assertEqual(self.evaluate(2, {})["state"], motifs.NOT_MEASURED)
        unreadable = anchor_hits(("operational/engine/src", "async function runCompensation(", "unread"),
                                 ("operational/ledger/src/ledger.py", "compensate by hand", "code"))
        self.assertEqual(self.evaluate(2, unreadable)["state"], motifs.REIMPLEMENTED)

    def test_the_summary_counts_states_in_vocabulary_order(self):
        evaluated = [self.evaluate(i) for i in range(len(MOTIF_ROWS))]
        view = motifs.summary(evaluated, ["motifs: a problem"])
        self.assertEqual(motifs.states_text(view["states"]), "adopted 1, unused 1, no-library 1, not-measured 2")
        self.assertEqual(motifs.states_text({}), "none")
        self.assertEqual(view["problems"], ["motifs: a problem"])
        queued = motifs.queue_items(evaluated)
        self.assertEqual({(q["reason"], q["id"]) for q in queued}, {("motif-stale", "audit-trail")})


class MotifJoinTests(fixture.EstateTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        root = fixture.make_motif_monorepo(os.path.join(cls.tmp, "motifs"))
        checkout = test_model.mini_checkout(root, "https://%s.git" % HOST)
        cls.curated = test_model.empty_curated()
        cls.curated["hosts"] = [HOST_ROW]
        cls.curated["motifs"] = MOTIF_ROWS
        anchors = motifs.anchors_by_repo(motifs.rows(cls.curated)[0])
        srcs = test_model.mini_sources()
        srcs["repo"] = {checkout["id"]: model.read_canonical(checkout, HOST, packages.host_rows(cls.curated)[0], anchors)}
        data = {"checkouts": [checkout], "artifacts": [], "coverage": {"expected": 1, "observed": 1, "errors": 0},
                "finished_at": test_model.NOW_ISO, "last_full_at": test_model.NOW_ISO, "mode": "full",
                "degraded_reasons": []}
        cls.snapshot = model.build_records(data, test_model.mini_foundation(""), srcs, cls.curated, test_model.VOCAB, None,
                                           {"kingdom": {"ref": "worktree"}}, now=test_model.NOW, home=test_model.MINI_HOME)
        cls.rows = {m["name"]: m for m in cls.snapshot["motifs"]["rows"]}

    def test_each_state_is_measured_from_the_synthetic_monorepo(self):
        self.assertEqual(model.validate(self.snapshot, test_model.VOCAB["records"], facets=FACETS)["problems"], [])
        states = {name: m["state"] for name, m in self.rows.items()}
        self.assertEqual(states, {"audit-trail": "not-measured", "compensating-entry": "no-library",
                                  "domain-events": "adopted", "saga-compensation": "reimplemented",
                                  "transactional-outbox": "unused"})
        self.assertEqual(self.snapshot["motifs"]["states"], {"adopted": 1, "reimplemented": 1, "unused": 1,
                                                             "no-library": 1, "not-measured": 1})
        events = self.rows["domain-events"]
        self.assertEqual(events["users"], [pkg("operational/engine")])  # the events library is a sibling
        outbox = self.rows["transactional-outbox"]["libraries"][0]
        # Two manifests declare it and a test imports it: no user.
        self.assertEqual((outbox["users"], outbox["declared"]), ([], [pkg("operational/engine"), pkg("operational/intake")]))
        found = {a["text"]: a["found"] for a in self.rows["saga-compensation"]["anchors"]}
        self.assertEqual(found, {"async function runCompensation(": "code", "compensate by hand": "none"})  # a docstring

    def test_stale_rows_are_queued(self):
        queued = sorted((q["id"], q["detail"]) for q in self.snapshot["queue"] if q["reason"] == "motif-stale")
        self.assertEqual([name for name, _detail in queued], ["audit-trail", "saga-compensation"])
        self.assertIn("is not a package of %s" % HOST, queued[0][1])
        self.assertEqual(self.snapshot["motifs"]["stale"], 2)


class CommandLineMotifTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import shutil
        e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        shutil.copytree(os.path.join(fixture.LAYER_DIR, "vocab"), os.path.join(e.layer, "vocab"))
        os.unlink(os.path.join(e.layer, "vocab", "kingdom.lock.toml"))
        caveat_dir = os.path.join(e.home, "empty-build")
        os.makedirs(caveat_dir)
        test_model.write_curation(e, caveat_dir)
        fixture.make_motif_monorepo(os.path.join(e.desktop, "fixture-domains"), home=e.home, remote="https://%s.git" % HOST)
        fixture.write_file(os.path.join(e.layer, "curated", "capabilities.toml"),
                           "# fixture\n" + model.safety.toml_dumps({"host": [HOST_ROW]}))
        fixture.write_file(os.path.join(e.layer, motifs.FILE), model.safety.toml_dumps({"motif": MOTIF_ROWS}))
        test_e2e.cli(e.layer, "accept-vocab", "--write")
        cls.built = test_e2e.cli(e.layer, "build")
        cls.verb = test_e2e.cli(e.layer, "capability")
        run_dir = os.path.realpath(os.path.join(e.private, "current"))
        cls.run_doc = test_e2e.read_json(os.path.join(run_dir, "run.json"))
        cls.atlas = test_e2e.read_text(os.path.join(run_dir, "ATLAS.md"))
        cls.full = test_e2e.read_text(os.path.join(run_dir, "CAPABILITIES.md"))
        cls.queue = test_e2e.read_text(os.path.join(run_dir, "QUEUE.md"))

    def test_the_build_and_the_verb_carry_the_motifs(self):
        code, out, err = self.built
        self.assertIn(code, (0, 10), out + err)
        self.assertNotIn("failed validation", out + err)
        self.assertIn("  motifs: 5 curated · adopted 1, reimplemented 1, unused 1, no-library 1, not-measured 1 · "
                      "stale 2 (estate capability)", out)
        self.assertEqual(self.run_doc["motifs"]["states"]["adopted"], 1)
        code, out, err = self.verb
        self.assertEqual(code, 0, out + err)
        self.assertIn("  motifs (the packages importing the library that embodies each pattern): 5 · adopted 1, "
                      "reimplemented 1, unused 1, no-library 1, not-measured 1 · stale 2 (QUEUE motif-stale)", out)
        self.assertIn("    transactional-outbox   unused        shared/libs/outbox: imported by 0, declared only by 2", out)
        self.assertIn("    saga-compensation      reimplemented shared/libs/saga: imported by 0, declared only by 0 · "
                      "by hand in 1 of 2 anchors", out)
        self.assertIn("    compensating-entry     no-library    no library · by hand in 1 of 1 anchors", out)

    def test_the_views_show_the_motifs(self):
        business = self.atlas[self.atlas.index("\n## Business (secondary)"):self.atlas.index("\n## Freshness")]
        self.assertIn("### Motifs", business)
        self.assertLess(business.index("### Wires"), business.index("### Motifs"))
        self.assertIn("| domain-events | adopted | shared/libs/messaging: imported by 1, declared only by 0; "
                      "shared/libs/events: imported by 0, declared only by 0 | operational/engine | — | — |", business)
        self.assertIn("| transactional-outbox | unused | shared/libs/outbox: imported by 0, declared only by 2 | — | "
                      "operational/engine, operational/intake | — |", business)
        self.assertIn("shared/libs/audit-logging (not in this run): not measured (not a package of", business)
        self.assertIn("### saga-compensation (reimplemented)", self.full)
        self.assertIn("| %s | operational/ledger/src/ledger.py | compensate by hand | none | — |"
                      % pkg("operational/ledger"), self.full)
        self.assertIn("motif-stale", self.queue)


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
