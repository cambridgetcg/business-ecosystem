"""Package reader tests (sources.read_packages) over a synthetic pnpm monorepo.

The reader takes tracked files only and reads them through the deny list: a deny-listed file is
counted as unread and makes the line count a lower bound, never a zero, and is never opened. Workspace
globs follow pnpm (* never crosses /); an import written only in a comment is no import; declared and
imported internal dependencies are compared both ways; duplicate names, unresolved tsconfig extends,
empty globs and untracked package directories are reported."""
import os

from . import fixture
import curate
import safety
import sources

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
        for rel in ("tool/sources.py", "tests/test_packages.py", "tests/fixture.py"):
            with open(os.path.join(fixture.LAYER_DIR, rel), encoding="utf-8") as stream:
                text = stream.read()
            self.assertEqual(curate.lint_text(text, rel, curate.scope_of(rel)) + curate.lint_test_vectors(text, rel),
                             [], rel)


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
