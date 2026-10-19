"""Package tests: the reader (sources.read_packages) over a synthetic pnpm monorepo, the quarantine
list reader (sources.read_build_list), package records (tool/packages.py) and their join into a build.

The reader takes tracked files only and reads them through the deny list: a deny-listed file is
counted as unread and makes the line count a lower bound, never a zero, and is never opened. Workspace
globs follow pnpm (* never crosses /); an import written only in a comment is no import; declared and
imported internal dependencies are compared both ways; duplicate names, unresolved tsconfig extends,
empty globs and untracked package directories are reported.

A package's build state is its membership in the host's tracked quarantine list at the checkout's
HEAD; an entry's measured_at always predates HEAD and is reported as dated evidence, never compared
with it; a list that cannot be read as HEAD's leaves every task not-measured. A host project takes the
capabilities of its packages that have code (derived:packages); a host this run did not read carries
its packages as missing, never as empty."""
import datetime as dt
import json
import os

from . import fixture
from . import test_e2e
from . import test_model
import capability
import curate
import model
import packages
import render
import safety
import sources

HOST = "github.com/cambridgetcg/fixture-domains"
HOST_ROW = {"id": HOST, "extra_folders": ["foundational/corporate-security"], "build_list": fixture.DOMAIN_LIST}
UNMEASURED = {task: packages.NOT_MEASURED for task in packages.TASKS}


def pkg(subpath):
    return packages.package_id(HOST, subpath)


def clean(root, modified=0):
    """A census-shaped checkout of root: its dirty state measured, modified tracked files as given."""
    return {"path": root, "head": "f" * 40, "last_commit_at": "2026-10-18T00:00:00Z",
            "dirty": {"mode": "normal", "modified": modified, "untracked": 0}}

LEDGER, PATENTS, ENGINE = "foundational/ledger", "operational/patents", "operational/.orchestration/engine"


class PackageReaderTests(fixture.EstateTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.root = fixture.make_monorepo(os.path.join(cls.tmp, "monorepo"))
        cls.checkout = {"path": cls.root, "head": "f" * 40, "last_commit_at": "2026-10-18T00:00:00Z",
                        "dirty": {"mode": "normal", "modified": 0, "untracked": 2}}
        with fixture.tracking_opens() as opened:
            cls.out = sources.read_packages(cls.checkout, extra_folders=("foundational/research",))
        cls.opened = list(opened)
        cls.packages = cls.out["packages"]

    def problems(self, code):
        return sorted((p["path"], p["detail"]) for p in self.out["problems"] if p["code"] == code)

    def test_packages_come_from_tracked_manifests_and_globs_never_cross_a_slash(self):
        self.assertEqual((self.out["status"], self.out["at_commit"], self.out["at_head"]), ("ok", "f" * 40, True))
        self.assertEqual(sorted(self.packages), [
            "foundational/accounts", LEDGER, "foundational/research", "infrastructure/lambda",
            ENGINE, PATENTS, "shared/libs/copy", "shared/libs/messaging", "shared/libs/outbox"])
        self.assertEqual(self.out["globs"]["operational/*"], [PATENTS])  # not the dot-folder package
        self.assertEqual(self.out["globs"]["operational/.orchestration/*"], [ENGINE])  # a column-0 list item
        self.assertFalse(self.packages["infrastructure/lambda"]["workspace"])
        self.assertTrue(self.packages[ENGINE]["workspace"])
        self.assertEqual(self.problems("workspace-glob-empty"), [("infra/*", "matches no tracked package")])
        self.assertEqual(self.packages["foundational/accounts"]["manifest"], "both")
        self.assertEqual(self.packages["foundational/research"]["manifest"], "module-folder")
        self.assertEqual(self.problems("untracked-package"),
                         [("foundational/drafts", "package.json on disk, not tracked")])

    def test_lines_tests_and_unread_files_are_counted_never_zeroed(self):
        ledger = self.packages[LEDGER]["measures"]
        self.assertEqual((ledger["src_files"], ledger["loc"], ledger["test_files"], ledger["md_files"]), (1, 5, 1, 1))
        self.assertEqual(ledger["loc_by_lang"], {"typescript": 5})  # no .d.ts, no dist/, no untracked scratch
        accounts = self.packages["foundational/accounts"]["measures"]
        self.assertEqual((accounts["loc_by_lang"], accounts["test_files"]), ({"python": 2}, 1))
        patents = self.packages[PATENTS]["measures"]
        self.assertEqual((patents["src_files"], patents["unread_files"], patents["loc_partial"], patents["loc"]),
                         (1, 1, True, 2))
        self.assertIn(os.path.join(self.root, LEDGER, "src", "index.ts"), self.opened)  # the opens are seen
        self.assertFalse([p for p in self.opened if os.path.basename(p).startswith("trade-")])
        self.assertFalse(self.packages["foundational/research"]["measures"]["loc_partial"])

    def test_imports_are_matched_to_declarations_both_ways_outside_comments(self):
        ledger = self.packages[LEDGER]
        self.assertEqual(ledger["deps"], {"declared_internal": ["@fixture/messaging", "@fixture/outbox"],
                                          "declared_external_n": 1})
        self.assertEqual(ledger["imports"], {"internal": ["@fixture/messaging"], "undeclared": []})
        self.assertEqual(self.packages[PATENTS]["imports"]["undeclared"], ["@fixture/ledger", "@fixture/messaging"])
        self.assertEqual(self.packages[ENGINE]["imports"]["internal"], ["@fixture/messaging"])
        self.assertEqual(self.packages["shared/libs/messaging"]["imported_by"],
                         ["@fixture/engine", "@fixture/ledger", "@fixture/patents"])
        self.assertEqual(self.packages["shared/libs/outbox"]["imported_by"], [])
        self.assertIn((LEDGER, "@fixture/outbox"), self.problems("declared-not-imported"))
        self.assertEqual(self.problems("imported-not-declared"),
                         [(PATENTS, "@fixture/ledger"), (PATENTS, "@fixture/messaging")])
        self.assertEqual(self.packages[LEDGER]["static"], ["declared-not-imported"])

    def test_duplicate_names_and_unresolved_extends(self):
        self.assertEqual(self.problems("duplicate-name"),
                         [("shared/libs/copy", "@fixture/outbox is also declared by shared/libs/outbox"),
                          ("shared/libs/outbox", "@fixture/outbox is also declared by shared/libs/copy")])
        self.assertEqual(self.problems("extends-unresolved"),
                         [(PATENTS, PATENTS + "/tsconfig.json extends ../../../tsconfig.base.json")])
        for problem in self.out["problems"]:
            self.assertIn(problem["code"], sources.PACKAGE_PROBLEMS)

    def test_the_working_tree_state_and_an_unreadable_checkout_are_said_not_guessed(self):
        modified = sources.read_packages(dict(self.checkout, dirty={"mode": "normal", "modified": 1}))
        self.assertIs(modified["at_head"], False)
        self.assertIsNone(sources.read_packages(dict(self.checkout, dirty={"mode": "unknown"}))["at_head"])
        bare = self.case_dir("not-a-repo")
        out = sources.read_packages({"path": bare})
        self.assertEqual((out["status"], out["packages"], out["files"]), ("error", {}, None))
        self.assertTrue(out["reason"])


class PackageHelperTests(fixture.EstateTestCase):

    def test_comments_strings_and_specifiers(self):
        text = ("import a from '@s/a/deep'\nconst u = \"https://x.invalid//not-a-comment\"\n"
                "/* import b from 'b' */ import c from \"c/sub\"\n// require('d')\nconst e = require( 'e' )\n"
                "const f = await import('./local')\nimport 'node:fs'\nexport { g } from '@s/g'\n")
        self.assertIn("https://x.invalid//not-a-comment", sources.strip_comments(text))
        self.assertEqual(sources.import_names(text), {"@s/a", "c", "e", "@s/g"})

    def test_globs_and_package_json_workspaces(self):
        self.assertTrue(sources.glob_match("shared/libs/cache", "shared/libs/*"))
        self.assertFalse(sources.glob_match("operational/.orchestration/engine", "operational/*"))
        self.assertTrue(sources.glob_match("apps/a/b", "apps/**"))
        root = self.case_dir()
        fixture.write_file(os.path.join(root, "package.json"), '{"workspaces": {"packages": ["apps/*", "!apps/old"]}}')
        self.assertEqual(sources.workspace_globs(root, {"package.json"}), (["apps/*"], ["apps/old"]))
        self.assertEqual(sources.workspace_globs(root, set()), ([], []))
        self.assertTrue(safety.is_denied("trade-" + "secret.ts"))

    def test_the_reader_and_its_tests_pass_the_privacy_lint(self):
        for rel in ("tool/sources.py", "tool/packages.py", "tests/test_packages.py", "tests/fixture.py"):
            with open(os.path.join(fixture.LAYER_DIR, rel), encoding="utf-8") as stream:
                text = stream.read()
            self.assertEqual(curate.lint_text(text, rel, curate.scope_of(rel)) + curate.lint_test_vectors(text, rel),
                             [], rel)



class BuildListReaderTests(fixture.EstateTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.root, cls.measured = fixture.make_domain_monorepo(os.path.join(cls.tmp, "domains"))
        cls.listing = sources.read_build_list(clean(cls.root), fixture.DOMAIN_LIST)

    def test_a_tracked_list_keeps_four_fields_per_entry_and_names_the_rest(self):
        out = self.listing
        self.assertEqual((out["status"], out["reason"], out["path"], out["at_head"]), ("ok", None, fixture.DOMAIN_LIST, True))
        self.assertEqual(len(out["entries"]), 6)
        for entry in out["entries"]:  # the reasons, first errors and exit texts stay in the repository
            self.assertEqual(set(entry), {"package", "task", "errors", "measured_at"})
        self.assertEqual(out["entries"][0], {"package": "@fixture/data-privacy", "task": "build", "errors": 7,
                                             "measured_at": self.measured})
        self.assertEqual(out["problems"], ["entry 6 is not {package, task (build, typecheck, lint, test), errors, "
                                           "measured_at}"])

    def test_each_measured_at_is_dated_and_placed_against_head(self):
        lag = self.listing["commits"][self.measured]
        self.assertEqual((lag["commits_since"], lag["ancestor"]), (2, True))  # the list's commit, then one more
        self.assertIsNotNone(model.parse_iso(lag["commit_date"]))
        root = self.case_dir()
        fixture.make_repo(root, files={"q.json": json.dumps({"entries": [
            {"package": "@x/a", "task": "lint", "errors": 1, "measured_at": "0123456"}]})})
        unknown = sources.read_build_list(clean(root), "q.json")["commits"]["0123456"]
        self.assertEqual(unknown, {"commit_date": None, "commits_since": None, "ancestor": None})

    def test_a_list_that_cannot_be_read_as_tracked_json_says_why(self):
        root = self.case_dir()
        fixture.make_repo(root, files={"bad.json": "not json\n", "flat.json": '{"entries": 3}\n'},
                          untracked={"local.json": '{"entries": []}\n'})
        cases = {"none.json": "missing", "../q.json": "error", "/q.json": "error", "local.json": "untracked",
                 "bad.json": "invalid", "flat.json": "invalid"}
        for rel, status in cases.items():
            out = sources.read_build_list(clean(root), rel)
            self.assertEqual((out["status"], out["entries"]), (status, []), rel)
            self.assertTrue(out["reason"], rel)
        self.assertIs(sources.read_build_list(clean(self.root, modified=1), fixture.DOMAIN_LIST)["at_head"], False)
        unknown = dict(clean(self.root), dirty={"mode": "unknown"})
        self.assertIsNone(sources.read_build_list(unknown, fixture.DOMAIN_LIST)["at_head"])


class PackageRecordTests(fixture.EstateTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.root, cls.measured = fixture.make_domain_monorepo(os.path.join(cls.tmp, "domains"))
        cls.read = model.read_canonical(clean(cls.root), HOST, {HOST: HOST_ROW})
        groups = {"group:x/domains": {"member_rule": {"kind": "repo-subpath", "repo": HOST,
                                                      "names": ["operational/data-privacy", "operational/insurance"]}},
                  "group:x/other": {"member_rule": {"kind": "repo-subpath", "repo": G_OTHER,
                                                    "names": ["operational/data-privacy"]}}}
        cls.records = packages.records(HOST, cls.read["packages"], cls.read["build_list"], test_model.NOW_ISO, groups)

    def tasks(self, subpath):
        return self.records[pkg(subpath)]["build"]["tasks"]

    def test_the_canonical_reader_reads_packages_only_for_a_host(self):
        self.assertEqual(sorted(self.records), [pkg(s) for s in (
            "foundational/accounting", "foundational/corporate-security", "operational/data-privacy",
            "operational/insurance", "operational/intellectual-property", "shared/libs/messaging")])
        self.assertEqual(self.read["packages"]["packages"]["operational/insurance"]["scripts"], ["build", "typecheck", "lint"])
        other = model.read_canonical(clean(self.root), "github.com/cambridgetcg/another", {HOST: HOST_ROW})
        self.assertNotIn("packages", other)
        self.assertNotIn("build_list", other)
        self.assertIsNone(model.read_canonical(clean(self.root), HOST, {HOST: dict(HOST_ROW, build_list=None)})["build_list"])

    def test_a_task_reads_its_membership_in_the_list_at_head(self):
        self.assertEqual(self.tasks("operational/data-privacy"), {"build": "quarantined", "typecheck": "quarantined",
                                                                  "lint": "quarantined", "test": "gated"})
        self.assertEqual(self.tasks("foundational/accounting"), {"build": "gated", "typecheck": "gated",
                                                                 "lint": "not-run", "test": "quarantined"})
        self.assertEqual(self.tasks("shared/libs/messaging"), {"build": "gated", "typecheck": "not-run",
                                                               "lint": "quarantined", "test": "not-run"})
        self.assertEqual(set(self.tasks("foundational/corporate-security").values()), {"not-run"})  # no manifest
        privacy = self.records[pkg("operational/data-privacy")]["build"]
        self.assertEqual((privacy["status"], privacy["list"], privacy["reason"], privacy["unbuilt"]),
                         ("ok", fixture.DOMAIN_LIST, None, True))
        self.assertEqual(privacy["quarantined"][0], {"task": "build", "errors": 7, "measured_at": self.measured})
        self.assertIs(self.records[pkg("foundational/accounting")]["build"]["unbuilt"], False)  # a test entry only

    def test_measured_at_is_dated_evidence_never_compared_with_head(self):
        # The list names the commit its counts were measured at; HEAD is always later (here two commits),
        # and comparing the two would leave every package unmeasured. The membership at HEAD still decides.
        head = fixture.git(self.root, "rev-parse", "HEAD").strip()
        self.assertNotEqual(head, self.measured)
        self.assertIs(self.records[pkg("operational/data-privacy")]["build"]["unbuilt"], True)
        summary = packages.host_summary(HOST, self.read["packages"], self.read["build_list"], self.records)
        self.assertEqual(summary["build_list"]["commits"][self.measured]["commits_since"], 2)
        self.assertEqual(summary["build_list"]["unmatched"], ["@fixture/gone"])
        text = capability.host_text(summary)
        # The workspace count is the host tooling's own: packages with a manifest, not the named folders.
        self.assertIn(": 6 packages: 5 in its workspace, 1 folder its host row names, 0 outside the workspace;", text)
        self.assertIn("build state from %s at HEAD, 6 entries, error counts measured at %s (" % (
            fixture.DOMAIN_LIST, self.measured[:12]), text)
        self.assertIn("; 2 commits before HEAD)", text)

    def test_a_list_not_read_as_heads_leaves_every_task_unmeasured(self):
        package = self.read["packages"]["packages"]["operational/data-privacy"]
        dirty = model.read_canonical(clean(self.root, modified=2), HOST, {HOST: HOST_ROW})["build_list"]
        for listing, reason in ((dirty, "modified tracked files"), (None, "names no quarantine list"),
                                (dict(self.read["build_list"], status="missing", reason="missing"), "missing")):
            state = packages.build_state(package, listing)
            self.assertEqual((state["tasks"], state["unbuilt"], state["quarantined"]), (UNMEASURED, None, []))
            self.assertIn(reason, state["reason"])
        summary = packages.host_summary(HOST, self.read["packages"], dirty, self.records)
        self.assertIn("build state not measured: %s was not read as the one at HEAD" % fixture.DOMAIN_LIST,
                      capability.host_text(summary))

    def test_the_measured_cell_names_packages_without_a_build_state(self):
        privacy = self.records[pkg("operational/data-privacy")]
        unmeasured = dict(privacy, build=packages.build_state(privacy, None))
        self.assertEqual(render._measured([privacy]), "1 package: 1 line, 0 test files, imported by 0, 0 unread")
        self.assertEqual(render._measured([privacy, unmeasured]), "2 packages: 2 lines, 0 test files, imported by 0, "
                                                                  "0 unread; build state not measured for 1")
        self.assertEqual(render._build_text(unmeasured), "not measured")

    def test_records_join_groups_and_host_rows_are_checked(self):
        privacy = self.records[pkg("operational/data-privacy")]
        self.assertEqual((privacy["host"], privacy["name"], privacy["manifest"], privacy["group_ids"]),
                         (HOST, "@fixture/data-privacy", "package-json", ["group:x/domains"]))
        self.assertEqual(self.records[pkg("shared/libs/messaging")]["imported_by"], ["@fixture/accounting"])
        rows, problems = packages.host_rows({"hosts": [
            HOST_ROW, dict(HOST_ROW, build_list="elsewhere.json"), {"extra_folders": []},
            {"id": G_OTHER, "extra_folders": ["/abs", "ok/folder", "../up"], "build_list": "../list.json"}]})
        self.assertEqual(rows[HOST], HOST_ROW)  # the first row of an id is kept
        self.assertEqual(rows[G_OTHER], {"id": G_OTHER, "extra_folders": ["ok/folder"], "build_list": None})
        self.assertEqual(len(problems), 3)
        self.assertIn("has two [[host]] rows", problems[0])
        self.assertIn("names /abs, ../up, ../list.json", problems[2])


G_OTHER = "github.com/cambridgetcg/other-mono"


class PackageJoinTests(fixture.EstateTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.root, cls.measured = fixture.make_domain_monorepo(os.path.join(cls.tmp, "domains"))
        cls.checkout = test_model.mini_checkout(cls.root, "https://%s.git" % HOST)
        cls.curated = test_model.empty_curated()
        cls.curated["hosts"] = [HOST_ROW]
        cls.curated["capabilities"] = [
            {"id": pkg("operational/insurance"), "values": ["insurance"], "impl": {"insurance": "stub"}, "reviewed": False}]
        srcs = test_model.mini_sources()
        srcs["repo"] = {cls.checkout["id"]: model.read_canonical(cls.checkout, HOST, packages.host_rows(cls.curated)[0])}
        cls.first = cls.build(srcs)
        cls.second = cls.build(test_model.mini_sources(), cls.first, test_model.NOW + dt.timedelta(hours=2))

    @classmethod
    def build(cls, srcs, prev=None, now=test_model.NOW):
        data = {"checkouts": [cls.checkout], "artifacts": [], "coverage": {"expected": 1, "observed": 1, "errors": 0},
                "finished_at": test_model.NOW_ISO, "last_full_at": test_model.NOW_ISO, "mode": "full",
                "degraded_reasons": []}
        return model.build_records(data, test_model.mini_foundation(""), srcs, cls.curated, test_model.VOCAB, prev,
                                   {"kingdom": {"ref": "worktree"}}, now=now, home=test_model.MINI_HOME)

    def records(self, snapshot, kind):
        return {r["id"]: r for r in snapshot["records"] if r["kind"] == kind}

    def test_package_records_validate_and_hang_on_their_host(self):
        self.assertEqual(model.validate(self.first, test_model.VOCAB["records"], facets=test_model.VOCAB["facets"])["problems"], [])
        found = self.records(self.first, "package")
        self.assertEqual(len(found), 6)
        project = self.records(self.first, "project")[HOST]
        self.assertEqual(project["packages"], sorted(found))
        self.assertEqual(self.first["capability"]["hosts"][0]["status"], "read")
        self.assertEqual(self.first["capability"]["packages"]["records"], 6)

    def test_the_host_project_takes_the_values_of_its_packages_that_have_code(self):
        field = self.records(self.first, "project")[HOST]["display"]["capability"]
        self.assertEqual((field["basis"], field["values"]), (capability.DERIVED_PACKAGES,
                                                             ["accounting", "data-privacy", "insurance", "intellectual-property"]))
        impls = {v: e["impl"] for v, e in field["by_value"].items()}
        self.assertEqual(impls, {"accounting": "code", "data-privacy": "code-unbuilt", "insurance": "stub",
                                 "intellectual-property": "unread"})
        self.assertEqual(field["by_value"]["data-privacy"]["via"], [pkg("operational/data-privacy")])
        self.assertEqual(field["designed"], ["corporate-security"])  # documents only: designed, never a value
        found = self.records(self.first, "package")
        bases = {r["subpath"]: r["capability"]["basis"] for r in found.values()}
        self.assertEqual(bases, {"foundational/accounting": capability.PACKAGE_PATH,
                                 "foundational/corporate-security": capability.NONE,
                                 "operational/data-privacy": capability.PACKAGE_PATH,
                                 "operational/insurance": capability.CURATED_PACKAGE,
                                 "operational/intellectual-property": capability.PACKAGE_PATH,
                                 "shared/libs/messaging": capability.NONE})
        self.assertEqual(found[pkg("foundational/corporate-security")]["capability"]["designed"], ["corporate-security"])
        self.assertEqual(found[pkg("shared/libs/messaging")]["capability"]["status"], capability.NONE)
        # The package row is a row of this run: no capability-orphan-row.
        self.assertFalse([q for q in self.first["queue"] if q["reason"] == "capability-orphan-row"])
        problems = "\n".join(self.first["capability"]["problems"])
        self.assertIn("names @fixture/gone, no package of its checkout", problems)
        self.assertIn("entry 6 is not {package", problems)

    def test_a_host_not_read_carries_its_packages_as_missing_never_as_empty(self):
        self.assertEqual(model.validate(self.second, test_model.VOCAB["records"], facets=test_model.VOCAB["facets"])["problems"], [])
        found = self.records(self.second, "package")
        self.assertEqual({r["presence"] for r in found.values()}, {"missing"})
        self.assertEqual(found[pkg("operational/data-privacy")]["measures"]["src_files"], 1)  # the last values, kept
        self.assertEqual(sorted(i for i in self.second["reconcile"]["missing"] if i.startswith("pkg:")), sorted(found))
        host = self.second["capability"]["hosts"][0]
        self.assertEqual((host["status"], host["reason"]), ("unknown", "its canonical checkout was not read for packages"))
        self.assertEqual(self.records(self.second, "project")[HOST]["packages"], [])


class CommandLinePackageTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        import shutil
        e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.layer = e.layer
        shutil.copytree(os.path.join(fixture.LAYER_DIR, "vocab"), os.path.join(e.layer, "vocab"))
        os.unlink(os.path.join(e.layer, "vocab", "kingdom.lock.toml"))
        caveat_dir = os.path.join(e.home, "empty-build")
        os.makedirs(caveat_dir)
        test_model.write_curation(e, caveat_dir)
        _root, cls.measured = fixture.make_domain_monorepo(os.path.join(e.desktop, "fixture-domains"), home=e.home,
                                                           remote="https://%s.git" % HOST)
        cls.committed = os.path.join(e.layer, capability.COMMITTED_FILE)
        fixture.write_file(cls.committed, capability.COMMITTED_HEADER + safety.toml_dumps({"host": [HOST_ROW]}))
        rows = {"meta": {"source": "package-fixture", "as_of": "2026-10-19"}, "rows": [
            {"id": pkg("operational/insurance"), "values": ["insurance"], "impl": {"insurance": "stub"},
             "short": "One health-only source file.", "evidence": "the full insurance evidence"}]}
        path = fixture.write_file(os.path.join(e.tmp, "packages.json"), json.dumps(rows))
        cls.imported = test_e2e.cli(e.layer, "capability", "--import", path, "--write")
        cls.accept = test_e2e.cli(e.layer, "accept-vocab", "--write")
        cls.built = test_e2e.cli(e.layer, "build")
        cls.run_dir = os.path.realpath(os.path.join(e.private, "current"))
        rows = test_e2e.jsonl(os.path.join(cls.run_dir, "records.jsonl"))[1:]
        cls.by_id = {r["id"]: r for r in rows if r.get("presence", "present") == "present"}
        cls.verb = test_e2e.cli(e.layer, "capability")
        cls.listed = test_e2e.cli(e.layer, "ls", "--kind", "package")
        cls.shown = test_e2e.cli(e.layer, "show", pkg("operational/data-privacy"))
        cls.atlas = test_e2e.read_text(os.path.join(cls.run_dir, "ATLAS.md"))
        cls.full = test_e2e.read_text(os.path.join(cls.run_dir, "CAPABILITIES.md"))

    def test_the_import_keeps_the_host_row_and_the_build_reads_the_host(self):
        self.assertEqual(self.imported[0], 0, self.imported[1] + self.imported[2])
        text = test_e2e.read_text(self.committed)
        self.assertIn('[[host]]\nid = "%s"' % HOST, text)
        self.assertIn('id = "%s"' % pkg("operational/insurance"), text)
        code, out, err = self.built
        self.assertIn(code, (0, 10), out + err)
        self.assertNotIn("failed validation", out + err)
        self.assertIn("package 6", out)  # records by kind
        field = self.by_id[HOST]["display"]["capability"]
        self.assertEqual((field["basis"], field["values"]), (capability.DERIVED_PACKAGES,
                                                             ["accounting", "data-privacy", "insurance", "intellectual-property"]))
        self.assertEqual(self.by_id[pkg("operational/insurance")]["capability"]["evidence"], "One health-only source file.")

    def test_ls_show_and_the_verb_reach_the_packages(self):
        code, out, _err = self.listed
        self.assertEqual(code, 0)
        self.assertIn("6 records", out)
        code, out, _err = self.shown
        self.assertEqual(code, 0)
        shown = json.loads(out)["record"]
        self.assertEqual((shown["kind"], shown["build"]["unbuilt"]), ("package", True))
        code, out, err = self.verb
        self.assertEqual(code, 0, out + err)
        self.assertIn("  packages: %s at " % HOST, out)
        self.assertIn("build state from %s at HEAD, 6 entries, error counts measured at %s (" % (
            fixture.DOMAIN_LIST, self.measured[:12]), out)
        self.assertIn("package capabilities by impl: code 1, code-unbuilt 1, stub 1, unread 1", out)

    def test_the_map_shows_the_measured_columns(self):
        business = self.atlas[self.atlas.index("\n## Business (secondary)"):self.atlas.index("\n## Freshness")]
        self.assertIn("measured (packages)", business)
        self.assertIn("Packages, measured from tracked files: 6 records, 4 holding a capability", business)
        self.assertIn("1 package: 1 line, 0 test files, imported by 0, 0 unread", business)  # data-privacy
        self.assertIn("1 package: 4 lines, 1 test file, imported by 0, 0 unread", business)  # accounting
        self.assertIn("1 package: ≥0 lines, 0 test files, imported by 0, 1 unread", business)  # intellectual-property
        self.assertIn("quarantined: build 7 at %s; typecheck 7 at" % self.measured[:12], self.full)
        self.assertIn("| %s |" % pkg("foundational/accounting"), self.full)


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
