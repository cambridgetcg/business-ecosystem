"""Business capability map tests (tool/capability.py).

Unit cases cover the vocabulary (23 values in four bands, the run band equal to the framework
domains, no collision with navigation values or topics, the companion vocabularies), the one
business population (business_scope), which the Business section and the map share, the curated
index, the resolution order (curated row, packages, mirror, else unassigned or none), the QUEUE
lines, and the classification import: merged by id, reviewed rows kept, local ids private, a
re-import byte for byte the same. One synthetic estate is then classified and built through the
command line, and its records, queue and the capability verb checked."""
import datetime as dt
import json
import os
import stat
import tomllib

from . import fixture
from . import test_e2e
from . import test_model
import capability
import curate
import model
import safety

G = "github.com/cambridgetcg/"
FACETS = test_model.VOCAB["facets"]
ALLOWED = capability.values(FACETS)
# Local ids are built from parts, as the fixture plants them (no home-relative literal here).
LOCAL_NOTES = test_model.LOCAL + fixture.HOME_REL + "Desktop/local-notes"


def project(pid, layer=None, status=None, family=None, roles=(), kind=None, group=None, candidates=(), aliases=(),
            domains=()):
    """A project record shaped as the join leaves it, before the capability step."""
    status = status or ("settled" if layer else "unset")
    return {"kind": "project", "id": pid, "aliases": list(aliases),
            "facets": {"layer": {"value": layer if status in ("settled", "roster-fallback") else None, "status": status,
                                 "candidates": [{"value": c, "source": "card"} for c in candidates]},
                       "kind": {"value": kind, "status": "settled" if kind else "unset", "candidates": []},
                       "family": {"value": family, "status": "set" if family else "unassigned"},
                       "role": {"values": list(roles), "status": "set" if roles else "unknown"}},
            "display": {"purpose_group": group, "be.framework_domain": list(domains)}, "display_src": {}}


def index(*rows, private=()):
    cur = test_model.empty_curated()
    cur["capabilities"] = list(rows)
    cur["private"]["capability"] = {"capability": list(private)}
    return capability.curated_index(cur, FACETS)


def field(projects, pid):
    return projects[pid]["display"]["capability"]


class VocabularyTests(fixture.EstateTestCase):

    def test_twenty_three_values_in_four_bands(self):
        self.assertEqual(len(ALLOWED), 23)
        bands = capability.bands(FACETS)
        self.assertEqual(list(bands), ["sell", "grow", "run", "own-funds"])
        members = [v for band in bands.values() for v in band]
        self.assertEqual(members, list(ALLOWED))  # each value in exactly one band, in the value order
        # The run band is the framework domains, the join key to business-ecosystem's domain packages.
        self.assertEqual(set(bands["run"]), set(curate.FRAMEWORK_DOMAINS))
        self.assertEqual(len(bands["run"]), len(curate.FRAMEWORK_DOMAINS))
        self.assertEqual(set(bands["run"]), set(FACETS["business"]["be.framework_domain"]["values"]))

    def test_no_value_collides_with_navigation_values_topics_or_statuses(self):
        table = FACETS["business"]["capability"]
        taken = set(curate.OVERLAY_NAV_VALUES) | set(curate.TOPICS) | set(table["statuses"])
        taken |= {v for values in fixture.KINGDOM_ENUMS.values() for v in values}
        self.assertEqual(set(ALLOWED) & taken, set())
        candidates = FACETS["capability_candidates"]["values"]
        self.assertEqual(candidates, ["customer-support"])
        self.assertEqual(set(candidates) & set(ALLOWED), set())

    def test_a_display_field_not_a_navigation_facet(self):
        self.assertNotIn("capability", model.NAVIGATION)
        self.assertNotIn("capability", FACETS["meta"]["navigation"])
        spec = test_model.VOCAB["records"]["kind"]["project"]["subfields"]["display"]["capability"]
        self.assertEqual((spec["type"], spec["enum"], spec["statuses"], spec["optional"]),
                         ("facet", "facets:business/capability", ["unassigned", "none"], True))
        table = FACETS["business"]["capability"]
        for basis in (capability.CURATED_PROJECT, capability.DERIVED_PACKAGES, capability.MIRROR, capability.NONE):
            self.assertIn(basis, table["bases"])
        self.assertIn("only an owner decision makes it one", table["rule"])

    def test_the_companion_vocabularies(self):
        self.assertEqual(capability.vocabulary(FACETS, "capability_impl"),
                         ("code", "code-unbuilt", "stub", "manual", "unread"))
        self.assertEqual(capability.vocabulary(FACETS, "capability_operating"),
                         ("in-use", "paused", "retired", "never", "unknown"))
        self.assertEqual(capability.vocabulary(FACETS, "capability_serves"), ("self", "customers", "both"))
        for name in ("capability_impl", "capability_operating", "capability_serves"):
            for value, definition in FACETS["vocab"][name]["values"].items():
                self.assertTrue(definition.strip(), "%s.%s" % (name, value))
        for value in ALLOWED:
            self.assertTrue(FACETS["business"]["capability"]["values"][value].strip(), value)

    def test_the_files_of_the_map_pass_the_privacy_lint(self):
        for rel in ("vocab/facets.toml", "vocab/records.toml", "tool/capability.py", "tests/test_capability.py"):
            with open(os.path.join(fixture.LAYER_DIR, rel), encoding="utf-8") as stream:
                text = stream.read()
            self.assertEqual(curate.lint_text(text, rel, curate.scope_of(rel)), [], rel)
            self.assertEqual(curate.lint_test_vectors(text, rel), [], rel)


class ScopeTests(fixture.EstateTestCase):

    def test_each_rule_of_the_one_business_population(self):
        cases = {
            "layer": (project(G + "a", "commerce"), ["layer commerce"]),
            "contested": (project(G + "b", status="contested", candidates=("soul", "economy")), ["layer economy"]),
            "group": (project(G + "c", group="payments_finance"), ["purpose group payments_finance"]),
            "family": (project(G + "d", family="commerce-tcg"), ["family commerce-tcg"]),
            "role": (project(G + "e", roles=("public-door", "revenue")), ["role revenue"]),
            "kind": (project(G + "f", kind="venture"), ["kind venture"]),
            "several": (project(G + "g", "economy", family="economy-ventures", roles=("revenue",)),
                        ["layer economy", "family economy-ventures", "role revenue"]),
            "outside": (project(G + "h", "soul", family="soul-core", roles=("doctrine",), group="creative_media"), []),
        }
        for name, (record, reasons) in cases.items():
            self.assertEqual(capability.business_scope(record), reasons, name)
        rule = capability.scope_rule()
        for word in capability.BUSINESS_GROUPS + capability.BUSINESS_FAMILIES + ("commerce or economy", "venture"):
            self.assertIn(word, rule)

    def test_in_scope_is_unassigned_and_outside_is_none_never_a_value(self):
        projects = {G + "shop": project(G + "shop", family="commerce-tcg"), G + "poem": project(G + "poem", "soul")}
        capability.resolve_projects(projects)
        shop, poem = (projects[G + n]["display"]["capability"] for n in ("shop", "poem"))
        self.assertEqual((shop["values"], shop["status"], shop["basis"], shop["scope"]),
                         ([], capability.UNASSIGNED, capability.NONE, ["family commerce-tcg"]))
        self.assertIn("in business scope", shop["reason"])
        self.assertEqual((poem["values"], poem["status"], poem["scope"]), ([], capability.NONE, []))
        summary = capability.summary(projects, FACETS)
        self.assertEqual(summary["projects"], {"unassigned": 1, "none": 1})
        self.assertEqual((summary["in_scope"], summary["unassigned"]), (1, [G + "shop"]))
        self.assertEqual(set(summary["by_value"]), set(ALLOWED))

    def test_every_built_project_carries_the_field_and_validates(self):
        curated = test_model.empty_curated()
        curated["families"] = {"family:commerce-tcg": {"id": "family:commerce-tcg", "label": "commerce-tcg"}}
        curated["projects"] = {G + "shop": {"id": G + "shop", "family_id": "family:commerce-tcg"}}
        checkouts = [test_model.mini_checkout(test_model.repo_path(name), "https://%s%s.git" % (G, name))
                     for name in ("shop", "poem")]
        snapshot, _ = test_model.mini_build(checkouts, curated=curated)
        self.assertTrue(model.validate(snapshot, test_model.VOCAB["records"], facets=FACETS)["ok"])
        fields = {pid: p["display"]["capability"] for pid, p in test_model.projects(snapshot).items()}
        self.assertEqual(fields[G + "shop"]["status"], capability.UNASSIGNED)
        self.assertEqual(fields[G + "poem"]["status"], capability.NONE)
        self.assertEqual(snapshot["capability"]["unassigned"], [G + "shop"])
        # A stub carried from a run before the field existed still validates.
        for record in snapshot["records"]:
            record.get("display", {}).pop("capability", None)
        data = {"checkouts": checkouts[:1], "artifacts": [], "coverage": {}, "finished_at": test_model.NOW_ISO,
                "last_full_at": test_model.NOW_ISO}
        later = test_model.NOW + dt.timedelta(hours=2)
        second = model.build_records(data, test_model.mini_foundation(""), test_model.mini_sources(), curated,
                                     test_model.VOCAB, snapshot, {"kingdom": {"ref": "worktree"}}, now=later,
                                     home=test_model.MINI_HOME)
        self.assertIn(G + "poem", second["reconcile"]["missing"])
        self.assertTrue(model.validate(second, test_model.VOCAB["records"], facets=FACETS)["ok"])


class CuratedIndexTests(fixture.EstateTestCase):

    def test_rows_are_read_leniently_and_what_is_off_vocabulary_is_named_and_dropped(self):
        rows, problems = index(
            {"id": G + "shop", "values": ["goods-sales", "billing", "made-up"], "operating": {"billing": "retired",
                                                                                         "tax": "in-use"},
             "serves": {"goods-sales": "everyone"}, "designed": ["billing", "tax"], "confidence": "certain",
             "evidence": "A shop.", "reviewed": False, "as_of": "2026-10-18", "review_after": "2027-01-16"},
            {"id": G + "shop", "values": ["tax"]},
            {"values": ["tax"]},
            private=[{"id": G + "shop", "evidence": "the full shop text"},
                     {"id": LOCAL_NOTES, "values": ["business-analytics"], "evidence": "private notes"},
                     {"id": G + "gone", "evidence": "evidence whose committed row was removed"}])
        shop = rows[G + "shop"]
        self.assertEqual(shop["values"], ["goods-sales", "billing"])  # vocabulary order; made-up dropped
        self.assertEqual(shop["by_value"]["billing"], {"impl": "code", "operating": "retired", "serves": "self"})
        self.assertEqual(shop["by_value"]["goods-sales"], {"impl": "code", "operating": "unknown", "serves": "self"})
        self.assertEqual(shop["designed"], ["tax"])
        self.assertEqual(shop["evidence_full"], "the full shop text")
        self.assertEqual(rows[LOCAL_NOTES]["values"], ["business-analytics"])  # a private-only row is the row
        self.assertNotIn(G + "gone", rows)  # evidence alone is never a row
        joined = "\n".join(problems)
        for needle in ("names made-up, not capability values", "operating names tax, which is not one of its values",
                       "serves goods-sales is 'everyone'", "designed names billing", "confidence 'certain'",
                       "%sshop has two rows" % G, "has no id"):
            self.assertIn(needle, joined)


class ResolutionTests(fixture.EstateTestCase):

    def test_the_order_is_row_then_packages_then_mirror_then_scope(self):
        projects = {G + "row": project(G + "row", family="commerce-tcg", domains=("tax", "accounting", "insurance")),
                    G + "pkgs": project(G + "pkgs", family="business-ecosystem"),
                    G + "mirror": project(G + "mirror", family="commerce-tcg"),
                    G + "copy": project(G + "copy"),
                    G + "trunk": project(G + "trunk", aliases=(G + "old-name",)),
                    G + "nothing": project(G + "nothing", roles=("revenue",)),
                    G + "poem": project(G + "poem", "soul"),
                    G + "door": project(G + "door", family="commerce-tcg")}
        rows, _ = index({"id": G + "row", "values": ["goods-sales", "tax"], "designed": ["accounting"],
                         "serves": {"goods-sales": "customers"}, "evidence": "A shop.", "reviewed": False},
                        {"id": G + "old-name", "values": ["billing"]},
                        {"id": G + "door", "values": [], "evidence": "A public door; no business code."})
        mirrors = {G + "mirror": [G + "row"], G + "copy": [G + "mirror"]}
        derived = {G + "pkgs": {"accounting": {"impl": "code-unbuilt", "via": ["pkg:x"]}}}
        problems = capability.resolve_projects(projects, rows, mirrors, derived)
        self.assertEqual(problems, [])
        got = {pid.rsplit("/", 1)[1]: (f["values"], f["status"], f["basis"])
               for pid, f in ((pid, field(projects, pid)) for pid in projects)}
        self.assertEqual(got, {
            "row": (["goods-sales", "tax"], "set", capability.CURATED_PROJECT),
            "pkgs": (["accounting"], "set", capability.DERIVED_PACKAGES),
            "mirror": (["goods-sales", "tax"], "set", capability.MIRROR),
            "copy": (["goods-sales", "tax"], "set", capability.MIRROR),  # a chain of mirrors
            "trunk": (["billing"], "set", capability.CURATED_PROJECT),  # its row under an alias
            "nothing": ([], capability.UNASSIGNED, capability.NONE),
            "poem": ([], capability.NONE, capability.NONE),
            "door": ([], capability.NONE, capability.CURATED_PROJECT)})  # curated: no capability
        row = field(projects, G + "row")
        self.assertEqual(row["by_value"]["goods-sales"]["serves"], "customers")
        self.assertEqual(row["designed"], ["accounting"])
        # be.framework_domain is relevance only: a run-band value neither held nor designed is a candidate.
        self.assertEqual(row["candidates"], ["insurance"])
        self.assertEqual(field(projects, G + "pkgs")["by_value"]["accounting"]["impl"], "code-unbuilt")
        self.assertEqual((field(projects, G + "copy")["via"], field(projects, G + "copy")["scope"]), (G + "row", []))
        self.assertEqual(field(projects, G + "trunk")["via"], G + "old-name")
        self.assertEqual(field(projects, G + "nothing")["scope"], ["role revenue"])
        self.assertEqual(projects[G + "row"]["display_src"]["capability"], capability.CURATED_PROJECT)
        self.assertIsNone(projects[G + "nothing"]["display_src"]["capability"])

    def test_a_mirror_of_an_unplaced_project_stays_unplaced_and_two_aliases_are_reported(self):
        projects = {G + "a": project(G + "a", family="commerce-tcg"), G + "b": project(G + "b", family="commerce-tcg"),
                    G + "c": project(G + "c", aliases=(G + "c1", G + "c2"))}
        rows, _ = index({"id": G + "c1", "values": ["tax"]}, {"id": G + "c2", "values": ["billing"]})
        problems = capability.resolve_projects(projects, rows, {G + "a": [G + "b"]})
        self.assertEqual(field(projects, G + "a")["status"], capability.UNASSIGNED)
        self.assertEqual(field(projects, G + "c")["values"], ["tax"])
        self.assertEqual(problems, ["capability: the aliases of %sc carry 2 rows (%sc1, %sc2); %sc1 is used"
                                    % (G, G, G, G)])


class QueueTests(fixture.EstateTestCase):

    def test_the_four_queue_reasons(self):
        projects = {G + "shop": project(G + "shop", family="commerce-tcg", aliases=(G + "shop-old",)),
                    G + "ledger": project(G + "ledger", family="commerce-tcg", domains=("accounting",))}
        rows, _ = index({"id": G + "shop-old", "values": ["goods-sales"], "review_after": "2026-09-01"},
                        {"id": G + "never-seen", "values": ["tax"], "review_after": "2027-01-16"})
        capability.resolve_projects(projects, rows)
        checks = capability.row_checks(projects, rows, "2026-10-18")
        self.assertEqual(checks["unmatched"], [G + "never-seen"])
        self.assertEqual(checks["overdue"], [(G + "shop-old", "2026-09-01")])
        self.assertEqual(checks["unreviewed"], [G + "never-seen", G + "shop-old"])
        items = {(i["reason"], i["id"]) for i in capability.queue_items(projects, checks)}
        self.assertEqual(items, {("capability-unassigned", G + "ledger"), ("capability-candidate", G + "ledger"),
                                 ("capability-review-overdue", G + "shop-old"),
                                 ("capability-orphan-row", G + "never-seen")})
        summary = capability.summary(projects, FACETS, rows, ["a problem"], checks)
        self.assertEqual((summary["rows"], summary["candidates"], summary["by_value"]["goods-sales"]),
                         (2, 1, [G + "shop"]))
        self.assertEqual(summary["problems"], ["a problem"])


class CommittedRowsTests(fixture.EstateTestCase):

    def test_the_committed_rows_read_cleanly_and_carry_their_review_stamp(self):
        path = os.path.join(fixture.LAYER_DIR, capability.COMMITTED_FILE)
        with open(path, encoding="utf-8") as stream:
            text = stream.read()
        self.assertTrue(text.startswith(capability.COMMITTED_HEADER))
        self.assertEqual(curate.lint_text(text, capability.COMMITTED_FILE, "strict"), [])
        cur = test_model.empty_curated()
        cur["capabilities"] = tomllib.loads(text)["capability"]
        rows, problems = capability.curated_index(cur, FACETS)
        self.assertEqual(problems, [])
        self.assertEqual(len(rows), len(cur["capabilities"]))
        for ident, entry in rows.items():
            self.assertFalse(ident.startswith(test_model.LOCAL), ident)  # local ids stay private
            self.assertIsInstance(entry.get("reviewed"), bool, ident)
            for key in ("source", "as_of", "review_after", "evidence"):
                self.assertIn(key, entry, ident)
            self.assertLessEqual(len(entry["evidence"]), capability.SHORT_MAX, ident)


# ── the classification import ───────────────────────────────────────────────────────────────

CLASSIFICATION = {
    "meta": {"source": "capability-test", "as_of": "2026-10-18"},
    "rows": [
        {"id": G + "shop", "values": ["goods-sales", "customer-loyalty"], "operating": {"goods-sales": "unknown"},
         "serves": {"customer-loyalty": "customers"}, "confidence": "medium", "short": "A fixture shop.",
         "evidence": "the long private text about the fixture shop"},
        {"id": G + "door", "values": [], "short": "A public door; no business code.", "evidence": "a door"},
        {"id": G + "pitch", "values": [], "designed": ["marketing-outreach"], "short": "Outreach designed only.",
         "evidence": "documents only"},
        {"id": LOCAL_NOTES, "values": ["business-analytics"], "confidence": "low", "evidence": "private notes"},
    ],
}


class ImportTests(fixture.EstateTestCase):

    def plan(self, layer, data=CLASSIFICATION, replace=()):
        return capability.plan_import(json.loads(json.dumps(data)), FACETS, layer, replace)

    def apply(self, layer, plan):
        for rel, text in plan["committed"].items():
            fixture.write_file(os.path.join(layer, rel), text)
        fixture.write_file(os.path.join(layer, "private", capability.PRIVATE_FILE), plan["private"])

    def test_rows_are_rendered_merged_and_stamped_unreviewed(self):
        layer = self.case_dir()
        plan = self.plan(layer)
        self.assertEqual(plan["counts"], {"added": 3, "private_only": 1, "kept": 0, "kept_reviewed": 0,
                                          "private_rows": 4})
        text = plan["committed"][capability.COMMITTED_FILE]
        self.assertTrue(text.startswith(capability.COMMITTED_HEADER))
        rows = {r["id"]: r for r in tomllib.loads(text)["capability"]}
        self.assertEqual(set(rows), {G + "shop", G + "door", G + "pitch"})  # never the local id
        shop = rows[G + "shop"]
        self.assertEqual((shop["values"], shop["operating"], shop["serves"], shop["evidence"]),
                         (["goods-sales", "customer-loyalty"], {"goods-sales": "unknown"},
                          {"customer-loyalty": "customers"}, "A fixture shop."))
        self.assertEqual((shop["reviewed"], shop["source"], shop["as_of"], shop["review_after"]),
                         (False, "capability-test", dt.date(2026, 10, 18), dt.date(2027, 1, 16)))
        self.assertIn('operating = { goods-sales = "unknown" }', text)  # one line per map
        self.assertEqual(rows[G + "pitch"]["designed"], ["marketing-outreach"])
        self.assertNotIn("long private text", text)
        self.assertEqual(curate.lint_text(text, capability.COMMITTED_FILE, "strict"), [])
        private = {r["id"]: r for r in tomllib.loads(plan["private"])["capability"]}
        self.assertEqual(private[LOCAL_NOTES]["values"], ["business-analytics"])
        self.assertEqual(private[G + "shop"], {"id": G + "shop", "evidence": "the long private text about the fixture shop"})

    def test_a_reimport_is_byte_for_byte_and_reviewed_rows_are_kept(self):
        layer = self.case_dir()
        first = self.plan(layer)
        self.apply(layer, first)
        again = self.plan(layer)
        self.assertEqual(again["committed"], first["committed"])
        self.assertEqual(again["private"], first["private"])
        self.assertEqual(again["counts"]["unchanged"], 3)
        # Yu reviews the shop row by hand; a changed classification keeps it and replaces the others.
        path = os.path.join(layer, capability.COMMITTED_FILE)
        with open(path, encoding="utf-8") as stream:
            reviewed = stream.read().replace('evidence = "A fixture shop."\nsource = "capability-test"\nreviewed = false',
                                             'evidence = "A fixture shop."\nsource = "capability-test"\nreviewed = true')
        fixture.write_file(path, reviewed)
        changed = json.loads(json.dumps(CLASSIFICATION))
        changed["rows"][0]["values"] = ["goods-sales"]
        changed["rows"][0]["operating"] = {}
        changed["rows"][0]["serves"] = {}
        changed["rows"] = changed["rows"][:2]  # pitch is left out
        plan = self.plan(layer, changed)
        self.assertEqual(plan["kept_reviewed"], [G + "shop"])
        rows = {r["id"]: r for r in tomllib.loads(plan["committed"][capability.COMMITTED_FILE])["capability"]}
        self.assertEqual((rows[G + "shop"]["values"], rows[G + "shop"]["reviewed"]),
                         (["goods-sales", "customer-loyalty"], True))
        self.assertIn(G + "pitch", rows)  # a row the import leaves out is kept, never dropped
        self.assertEqual(plan["counts"]["kept"], 1)
        replaced = self.plan(layer, changed, replace=(G + "shop",))
        rows = {r["id"]: r for r in tomllib.loads(replaced["committed"][capability.COMMITTED_FILE])["capability"]}
        self.assertEqual((rows[G + "shop"]["values"], rows[G + "shop"]["reviewed"]), (["goods-sales"], False))
        with self.assertRaises(safety.GuardError):
            self.plan(layer, changed, replace=(G + "door",))  # not a reviewed row

    def test_a_bad_classification_is_refused_before_anything_is_planned(self):
        layer = self.case_dir()
        for mutate in (lambda d: d["rows"][0]["values"].append("made-up"),
                       lambda d: d["rows"].append(dict(d["rows"][1])),
                       lambda d: d["rows"][0].update(short="An example row that is idle on purpose."),
                       lambda d: d["rows"][1].update(short="Lives at /" + "Users/someone/thing.")):
            data = json.loads(json.dumps(CLASSIFICATION))
            mutate(data)
            with self.assertRaises(safety.GuardError):
                self.plan(layer, data)


# ── one synthetic estate, classified and built through the command line ─────────────────────

def classification(tmp):
    data = {"meta": {"source": "capability-fixture", "as_of": "2026-10-18"}, "rows": [
        {"id": G + "alpha-service", "values": ["agent-commerce", "billing"], "operating": {"billing": "in-use"},
         "serves": {"agent-commerce": "customers"}, "confidence": "medium", "short": "The alpha door sells per call.",
         "evidence": "the full alpha evidence"},
        {"id": "codeberg.org/zerone-dev/zerone-mini", "values": [], "short": "A chain node; no business capability.",
         "evidence": "chain"},
        {"id": G + "never-seen", "values": ["tax"], "short": "Not in this estate.", "evidence": "absent"},
        {"id": LOCAL_NOTES, "values": ["business-analytics"], "evidence": "notes kept beside the business"},
    ]}
    return fixture.write_file(os.path.join(tmp, "capabilities.json"), json.dumps(data))


class CommandLineCapabilityTests(fixture.EstateTestCase):
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
        test_model.write_curation(e, caveat_dir)
        cls.path = classification(e.tmp)
        cls.committed = os.path.join(e.layer, capability.COMMITTED_FILE)
        cls.dry = test_e2e.cli(e.layer, "capability", "--import", cls.path)
        cls.after_dry = os.path.exists(cls.committed)
        cls.wet = test_e2e.cli(e.layer, "capability", "--import", cls.path, "--write")
        cls.again = test_e2e.cli(e.layer, "capability", "--import", cls.path)
        cls.accept = test_e2e.cli(e.layer, "accept-vocab", "--write")
        cls.first = test_e2e.cli(e.layer, "build")
        cls.run_dir = os.path.realpath(os.path.join(e.private, "current"))
        rows = test_e2e.jsonl(os.path.join(cls.run_dir, "records.jsonl"))[1:]
        cls.by_id = {r["id"]: r for r in rows if r.get("presence", "present") == "present"}
        cls.verb = test_e2e.cli(e.layer, "capability")

    def capability_of(self, pid):
        return self.by_id[pid]["display"]["capability"]

    def test_the_import_prints_first_then_writes_through_the_owner_writers(self):
        code, out, err = self.dry
        self.assertEqual(code, 0, err)
        self.assertIn("nothing written", out)
        self.assertFalse(self.after_dry)
        code, out, err = self.wet
        self.assertEqual(code, 0, err)
        self.assertIn("written %s" % capability.COMMITTED_FILE, out)
        self.assertNotIn("notes kept beside the business", out)  # private evidence is never printed
        target = os.path.join(self.private, capability.PRIVATE_FILE)
        self.assertEqual(stat.S_IMODE(os.lstat(target).st_mode), 0o600)
        self.assertEqual(safety.PrivateArea(self.layer).curated_mode(), 0o500)
        code, out, _err = self.again
        self.assertIn("unchanged: %s" % capability.COMMITTED_FILE, out)
        self.assertIn("unchanged 3", out)

    def test_the_build_places_curated_rows_and_leaves_the_rest_unassigned_or_none(self):
        code, out, err = self.first
        self.assertIn(code, (0, 10), out + err)
        self.assertNotIn("failed validation", out + err)
        alpha = self.capability_of(G + "alpha-service")
        self.assertEqual((alpha["values"], alpha["basis"], alpha["reviewed"]),
                         (["billing", "agent-commerce"], capability.CURATED_PROJECT, False))
        self.assertEqual(alpha["by_value"]["billing"]["operating"], "in-use")
        self.assertEqual(alpha["evidence_full"], "the full alpha evidence")
        mini = self.capability_of("codeberg.org/zerone-dev/zerone-mini")
        self.assertEqual((mini["status"], mini["basis"], mini["scope"]), ("none", capability.CURATED_PROJECT,
                                                                        ["layer economy"]))
        self.assertEqual(self.capability_of(LOCAL_NOTES)["values"], ["business-analytics"])  # a private row
        self.assertEqual(self.capability_of(G + "plain-tool")["status"], "none")
        for record in self.by_id.values():
            if record["kind"] == "project":
                self.assertIn(self.capability_of(record["id"])["status"], ("set", "unassigned", "none"))
        queue = test_e2e.read_text(os.path.join(self.run_dir, "QUEUE.md"))
        self.assertIn("capability-orphan-row", queue)
        self.assertIn(G + "never-seen", queue)

    def test_the_verb_counts_by_band_and_lists_rows_waiting_on_review(self):
        code, out, err = self.verb
        self.assertEqual(code, 0, out + err)
        self.assertIn("capability map of run", out)
        self.assertIn("  sell: goods-sales 0 · marketplace 0", out)
        self.assertIn("billing 1", out)
        self.assertIn("curated rows: 4 · not yet reviewed 4 · past review 0 · naming no record of this run 1: "
                      + G + "never-seen", out)
        self.assertEqual(self.cli("capability", "--write")[0], 2)

    def cli(self, *argv):
        return test_e2e.cli(self.layer, *argv)


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
