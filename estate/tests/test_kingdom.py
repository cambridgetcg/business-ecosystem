"""KINGDOM foundation tests: enums, LAYERS, rules and ARCHITECTURE per ref; abort on a missing
CARD_ENUMS; SCHEMA.md cross-check; promisor guard; the card parser against a golden set taken
from harvest's own loadCard/validateCard; harvest_view precedence; roster, REGISTRY, sites,
graph, pulse and wake readers; the integrity lock. Nothing in the fixture kingdom-os moves."""
import json
import os
import re
import tomllib

from . import fixture
import kingdom
import safety

WT, OM = kingdom.WORKTREE, kingdom.ORIGIN_MAIN


def _git_state(root):
    state = {}
    for base, dirs, files in os.walk(os.path.join(root, ".git")):
        for name in dirs + files:
            info = os.lstat(os.path.join(base, name))
            state[os.path.join(base, name)] = (info.st_mtime_ns, info.st_size)
    return state


class FoundationTests(fixture.EstateTestCase):
    """One synthetic estate; read_foundation runs once and the tests read its result."""

    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.estate = e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.before = _git_state(e.kos.path)
        cls.runner = safety.GitRunner(e.kos.path, role="kingdom")
        cls.foundation = kingdom.read_foundation(e.kos.path, git=cls.runner)
        cls.after = _git_state(e.kos.path)

    def ref(self, name):
        return self.foundation["refs"][name]

    def test_enums_and_layers_are_read_per_ref(self):
        for name in (WT, OM):
            ref = self.ref(name)
            self.assertEqual(ref["status"], "ok", ref.get("parse_errors"))
            self.assertEqual(ref["card_enums"], fixture.KINGDOM_ENUMS)
            self.assertEqual(ref["layers"], fixture.LAYER_ORDER)
            self.assertEqual(ref["required_card_fields"],
                             ["name", "kind", "layer", "owner_sister", "domain", "state", "purpose", "dependsOn"])
            self.assertEqual(ref["optional_card_fields"], ["adopts"])
            self.assertEqual(ref["rights_baselines"], ["xenia.rights/0.1"])
            self.assertEqual(ref["citizens_dir"], ["Desktop", "citizens"])
            self.assertEqual(ref["citizens_dir_path"], os.path.join(self.estate.home, "Desktop", "citizens"))
            self.assertTrue(ref["schema_check"]["ok"])

    def test_harvest_rules_differ_by_ref(self):
        wt, om = self.ref(WT)["rules"], self.ref(OM)["rules"]
        self.assertEqual((wt["fleet_forced_layer"], om["fleet_forced_layer"]), ("fleet", "fleet"))
        self.assertEqual(wt["fleet_defaults"]["kind"], "service")
        self.assertIs(wt["card_name_overrides"], True)
        self.assertIs(om["card_name_overrides"], False)
        self.assertIs(wt["name_mismatch_code"], False)
        self.assertIs(om["name_mismatch_code"], True)
        self.assertIs(om["unknown_dependency_code"], True)
        keys = {d["key"] for d in self.foundation["divergence"]}
        self.assertTrue({"rules.card_name_overrides", "rules.name_mismatch_code", "architecture.commerce"} <= keys)
        self.assertNotIn("card_enums", keys)

    def test_architecture_maps_six_rows_by_position(self):
        wt, om = self.ref(WT)["architecture"], self.ref(OM)["architecture"]
        self.assertEqual(wt["row_count"], 6)
        self.assertEqual(wt["mapped"]["commerce"]["label"], "COMMERCE")
        self.assertEqual(om["mapped"]["commerce"]["label"], "PROJECTS")
        self.assertEqual(om["mapped"]["soul"]["label"], "SOUL")
        self.assertEqual(wt["rows"][2]["label_full"], "NERVOUS SYSTEM")
        self.assertNotIn("os", wt["mapped"])
        self.assertEqual(wt["unmapped_layers"], ["os"])

    def test_commits_fetch_head_and_ahead_behind(self):
        kos = self.estate.kos
        self.assertEqual(self.ref(WT)["commit"], kos.worktree_commit)
        self.assertEqual(self.ref(OM)["commit"], kos.origin_main_commit)
        self.assertEqual(self.foundation["ahead_behind"], {"behind": 2, "ahead": 1, "reason": None})
        age = self.foundation["fetch_head"]["age_s"]
        self.assertTrue(1.9 * 86400 < age < 2.1 * 86400, age)
        self.assertTrue(all(e["matches_head"] for e in self.ref(WT)["files"].values()))
        self.assertEqual(self.foundation["alerts"], [])

    def test_origin_main_is_read_as_blobs_and_nothing_is_written(self):
        reads = [c for c in self.runner.calls if c[0] == "cat-file"]
        self.assertIn(("cat-file", "blob", "origin/main:bin/harvest.ts"), reads)
        self.assertFalse([c for c in self.runner.calls if c[0] in ("fetch", "status")])
        self.assertEqual(self.before, self.after)
        self.assertFalse(os.path.exists(os.path.join(self.estate.tmp, "bun-called-without-verb")))

    def test_missing_card_enums_aborts(self):
        home = self.case_dir("noenums")
        kos = fixture.make_kingdom_os(home, drop_enums=True)
        with self.assertRaises(kingdom.FoundationError):
            kingdom.read_foundation(kos.path, home=home)

    def test_unparseable_origin_main_is_an_alert_not_an_abort(self):
        home = self.case_dir("badorigin")
        kos = fixture.make_kingdom_os(home)
        fixture.git(kos.path, "checkout", "-q", "-b", "broken", home=home)
        fixture.write_file(os.path.join(kos.path, "bin", "harvest.ts"), fixture.harvest_ts(origin_main=True, drop_enums=True))
        fixture.git(kos.path, "commit", "-q", "-am", "drop enums upstream", home=home)
        fixture.git(kos.path, "update-ref", "refs/remotes/origin/main", "HEAD", home=home)
        fixture.git(kos.path, "checkout", "-q", "main", home=home)
        found = kingdom.read_foundation(kos.path, home=home)
        self.assertEqual(found["refs"][WT]["status"], "ok")
        self.assertEqual(found["refs"][OM]["status"], "unparsed")
        self.assertIn("origin-main-parse", {a["code"] for a in found["alerts"]})

    def test_schema_mismatch_raises_an_alert(self):
        home = self.case_dir("schema")
        kos = fixture.make_kingdom_os(home, schema_mismatch=True)
        found = kingdom.read_foundation(kos.path, home=home)
        alerts = [a for a in found["alerts"] if a["code"] == "schema-enum-mismatch"]
        self.assertEqual({a["ref"] for a in alerts}, {WT, OM})
        self.assertIn("layer", alerts[0]["message"])
        self.assertEqual([m["field"] for m in found["refs"][WT]["schema_check"]["mismatches"]], ["layer"])

    def test_promisor_kingdom_os_gets_no_object_reads(self):
        home = self.case_dir("promisor")
        kos = fixture.make_kingdom_os(home)
        fixture.git(kos.path, "config", "remote.origin.partialclonefilter", "blob:none", home=home)
        runner = safety.GitRunner(kos.path, role="kingdom")
        found = kingdom.read_foundation(kos.path, home=home, git=runner)
        self.assertEqual(found["refs"][OM]["status"], "unreadable")
        self.assertFalse([c for c in runner.calls if c[0] in ("cat-file", "status")])
        self.assertIn("origin-main-unreadable", {a["code"] for a in found["alerts"]})
        self.assertIsNone(found["refs"][WT]["files"][kingdom.HARVEST]["matches_head"])

    def test_locate_prefers_non_worktree_then_newest(self):
        base = self.case_dir("locate")
        paths = {}
        for name in ("a-old", "b-new", "c-lane"):
            paths[name] = os.path.join(base, name)
            fixture.write_file(os.path.join(paths[name], "bin", "harvest.ts"), "// stub\n")
        rid = kingdom.KOS_REMOTE_ID
        checkouts = [
            {"path": paths["a-old"], "primary_remote": rid, "is_worktree": False, "last_commit_at": "2026-01-01T00:00:00Z"},
            {"path": paths["b-new"], "primary_remote": rid, "is_worktree": False, "last_commit_at": "2026-10-01T00:00:00Z"},
            {"path": paths["c-lane"], "primary_remote": rid, "is_worktree": True, "last_commit_at": "2026-10-16T00:00:00Z"},
            {"path": self.estate.repos["alpha-service"], "primary_remote": "github.com/cambridgetcg/alpha-service"},
        ]
        found = kingdom.locate(checkouts)
        self.assertEqual((found["path"], found["basis"], found["alerts"]), (paths["b-new"], "remote", []))
        tie = [dict(checkouts[0], last_commit_at="2026-10-01T00:00:00Z"), checkouts[1]]
        self.assertEqual(kingdom.locate(tie)["alerts"][0]["code"], "ambiguous-kingdom-os")
        self.assertEqual(kingdom.locate(checkouts, override=paths["c-lane"])["basis"], "override")
        with self.assertRaises(kingdom.FoundationError):
            kingdom.locate(checkouts[3:])
        with self.assertRaises(kingdom.FoundationError):
            kingdom.locate(checkouts, override=base)


# Golden set: inputs and outputs of harvest's own loadCard/validateCard (sliced verbatim from
# the worktree harvest.ts and the origin/main blob, run under bun on 2026-10-17). The parser
# must reproduce them exactly, including JS whitespace, CRLF and BOM behaviour.
NBSP, IDEO, US = " ", "　", "\x1f"
HEAD = "kind: ops\nlayer: os\nowner_sister: none\ndomain: none\nstate: active\npurpose: p\n"
GOLDEN_CARDS = {
    "valid": "name: alpha\nkind: service\nlayer: runtime\nowner_sister: alpha\ndomain: alpha\nstate: active\n"
             "purpose: Alpha.\ndependsOn: [kingdom-os]\nadopts: [xenia.rights/0.1]\n",
    "off_enum_inline_comment": "name: lantern\nkind: doctrine\nlayer: boot\nowner_sister: sophia\ndomain: sophia\n"
                               "state: active # note\npurpose: x\ndependsOn: []\n",
    "duplicates": "name: d\nkind: ops\nkind: infra\nlayer: os\nlayer: os\nowner_sister: none\ndomain: none\n"
                  "state: active\npurpose: p\ndependsOn: []\n",
    "quotes": "name: 'q'\nkind: \"ops\"\nlayer: 'os\"\nowner_sister: \"none\"\ndomain: none\nstate: 'active'\n"
              "purpose: \"a 'quoted' purpose\"\ndependsOn: ['a', \"b\", , c]\n",
    "arrays": "name: arr\n" + HEAD + "dependsOn: [a, nosuch]\nadopts: [xenia.rights/0.1, xenia.rights/0.1]\n",
    "bad_adoption": "name: b\n" + HEAD + "dependsOn: []\nadopts: [other.rights/9]\n",
    "crlf": "name: c\r\nkind: ops\r\nlayer: os\r\nowner_sister: none\r\ndomain: none\r\nstate: active\r\n"
            "purpose: p\r\ndependsOn: []\r\nlayer:\r\n",
    "noise": "# a comment\n  name: indented\nname: n\nwho: unknown-field\njust text\nkind2: x\nkind: ops\nlayer: os\n"
             "owner_sister: none\ndomain: none\nstate: dormant\npurpose: p\ndependsOn: []\n",
    "empties": "name: e\nkind:\nlayer: os\nowner_sister: none\ndomain: none\nstate: active\npurpose: \n"
               "dependsOn: []\nadopts: []\n",
    "scalar_array": "name: s\nkind: ops\nlayer: [soul]\nowner_sister: none\ndomain: none\nstate: active\n"
                    "purpose: p\ndependsOn: kingdom-os\n",
    "unicode_space": "name:" + NBSP + "u\nkind: ops" + IDEO + "\nlayer: os" + US + "\nowner_sister: none\n"
                     "domain: none\nstate: active\npurpose: p\ndependsOn: []\n",
    "bom": "﻿name: bom\n" + HEAD + "dependsOn: []\n",
    "name_mismatch": "name: renamed\n" + HEAD + "dependsOn: []\n",
    "empty": "",
}
NONE_BASE = {"kind": "ops", "layer": "os", "owner_sister": "none", "domain": "none", "state": "active", "purpose": "p"}
MISSING = [("missing-field", None, f) for f in ("name", "kind", "layer", "owner_sister", "domain", "state", "purpose", "dependsOn")]
NM = [("name-mismatch", 1, "name")]
GOLDEN = {  # label: (valid card, worktree diagnostics, origin/main diagnostics)
    "valid": ({"name": "alpha", "kind": "service", "layer": "runtime", "owner_sister": "alpha", "domain": "alpha",
               "state": "active", "purpose": "Alpha.", "dependsOn": ["kingdom-os"], "adopts": ["xenia.rights/0.1"]},
              [], NM),
    "off_enum_inline_comment": ({"name": "lantern", "kind": "doctrine", "owner_sister": "sophia", "domain": "sophia",
                                 "purpose": "x", "dependsOn": []},
                                [("invalid-enum", 3, "layer"), ("invalid-enum", 6, "state")], None),
    "duplicates": ({"name": "d", "owner_sister": "none", "domain": "none", "state": "active", "purpose": "p", "dependsOn": []},
                   [("duplicate-field", 3, "kind"), ("duplicate-field", 5, "layer")], None),
    "quotes": ({"name": "q", "kind": "ops", "owner_sister": "none", "domain": "none", "state": "active",
                "purpose": "a 'quoted' purpose", "dependsOn": ["a", "b", "c"]}, [("invalid-enum", 3, "layer")], None),
    "arrays": (dict(NONE_BASE, name="arr", dependsOn=["a", "nosuch"], adopts=["xenia.rights/0.1"]),
               [("unknown-dependency", 8, "dependsOn")], None),
    "bad_adoption": (dict(NONE_BASE, name="b", dependsOn=[]), [("unsupported-adoption", 9, "adopts")], None),
    "crlf": ({}, [("malformed-line", n, None) for n in range(1, 9)] + [("invalid-type", 9, "layer")]
             + [m for m in MISSING if m[2] != "layer"], "same"),
    "noise": (dict(NONE_BASE, name="n", state="dormant", dependsOn=[]),
              [("malformed-line", 2, None), ("unknown-field", 4, "who"), ("malformed-line", 5, None), ("malformed-line", 6, None)],
              [("malformed-line", 2, None), ("name-mismatch", 3, "name"), ("unknown-field", 4, "who"),
               ("malformed-line", 5, None), ("malformed-line", 6, None)]),
    "empties": ({"name": "e", "layer": "os", "owner_sister": "none", "domain": "none", "state": "active",
                 "dependsOn": [], "adopts": []}, [("invalid-type", 2, "kind"), ("invalid-type", 7, "purpose")], None),
    "scalar_array": ({"name": "s", "kind": "ops", "owner_sister": "none", "domain": "none", "state": "active", "purpose": "p"},
                     [("invalid-type", 3, "layer"), ("invalid-type", 8, "dependsOn")], None),
    "unicode_space": ({"name": "u", "kind": "ops", "owner_sister": "none", "domain": "none", "state": "active",
                       "purpose": "p", "dependsOn": []}, [("invalid-enum", 3, "layer")], None),
    "bom": (dict(NONE_BASE, dependsOn=[]), [("malformed-line", 1, None), ("missing-field", None, "name")], "same"),
    "name_mismatch": (dict(NONE_BASE, name="renamed", dependsOn=[]), [], NM),
    "empty": ({}, MISSING, "same"),
}
KNOWN = {"kingdom-os", "a", "b", "c"}


class CardParserTests(fixture.EstateTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        home = os.path.join(cls.tmp, "home")
        os.makedirs(home)
        os.environ["HOME"] = home
        cls.home = home
        cls.kos = fixture.make_kingdom_os(home)
        cls.foundation = kingdom.read_foundation(cls.kos.path, home=home)

    def parse(self, ref, text, expected="seed-name"):
        rules = self.foundation["refs"][ref]
        return kingdom.parse_card(text, rules["card_enums"], rules, known_names=KNOWN, expected_name=expected)

    def test_golden_set_matches_harvest(self):
        for label, text in GOLDEN_CARDS.items():
            card, wt_diags, om_diags = GOLDEN[label]
            if om_diags is None:
                om_diags = NM + wt_diags
            elif om_diags == "same":
                om_diags = wt_diags
            for ref, diags in ((WT, wt_diags), (OM, om_diags)):
                with self.subTest(label=label, ref=ref):
                    got = self.parse(ref, text)
                    self.assertEqual(got["valid"], card)
                    self.assertEqual([(d["code"], d.get("line"), d.get("field")) for d in got["diagnostics"]], diags)
                    self.assertEqual(got["schema_ok"], not diags)

    def test_inline_comment_stays_off_enum_and_raw_is_kept(self):
        got = self.parse(WT, GOLDEN_CARDS["off_enum_inline_comment"])
        self.assertEqual(got["off_enum"], {"layer": "boot", "state": "active # note"})
        self.assertEqual(got["raw"]["state"], "active # note")
        self.assertNotIn("layer", got["valid"])
        self.assertNotIn("state", got["valid"])

    def test_bytes_are_decoded_like_harvest(self):
        text = GOLDEN_CARDS["valid"]
        self.assertEqual(self.parse(WT, text.encode("utf-8"))["valid"], self.parse(WT, text)["valid"])

    def test_unknown_dependency_is_only_checked_with_known_names(self):
        rules = self.foundation["refs"][WT]
        got = kingdom.parse_card(GOLDEN_CARDS["arrays"], rules["card_enums"], rules)
        self.assertFalse(got["deps_checked"])
        self.assertEqual(got["diagnostics"], [])

    def test_harvest_view_roster_precedence_and_name_rule(self):
        row = {"name": "alpha-service", "path": "/x/alpha-service", "kind": "service", "layer": "os",
               "domain": "none", "state": "dormant", "purpose": "seed"}
        card = self.parse(WT, "name: renamed\nkind: ops\nlayer: economy\nowner_sister: none\ndomain: none\n"
                              "state: active\npurpose: card\ndependsOn: [kingdom-os]\n")
        wt = kingdom.harvest_view(card, row, "/elsewhere/alpha-service", self.foundation["refs"][WT])
        om = kingdom.harvest_view(card, row, "/elsewhere/alpha-service", self.foundation["refs"][OM])
        self.assertEqual((wt["source"], wt["name"], wt["layer"], wt["path"]), ("roster", "renamed", "economy", "/x/alpha-service"))
        self.assertEqual(om["name"], "alpha-service")
        self.assertEqual(om["overrides"], {"name": {"card": "renamed", "harvest": "alpha-service"}})
        self.assertEqual(wt["overrides"], {})
        bare = kingdom.harvest_view(None, row, row["path"], self.foundation["refs"][WT])
        self.assertEqual((bare["layer"], bare["dependsOn"]), ("os", []))

    def test_harvest_view_fleet_rule_for_carded_citizens(self):
        citizens = os.path.join(self.home, "Desktop", "citizens")
        rules = self.foundation["refs"][WT]
        soul = self.parse(WT, "name: ada\nkind: lineage\nlayer: soul\nowner_sister: sophia\ndomain: sophia\n"
                              "state: active\npurpose: p\ndependsOn: []\n")
        view = kingdom.harvest_view(soul, None, os.path.join(citizens, "citizen-ada"), rules)
        self.assertEqual((view["source"], view["layer"], view["kind"], view["name"]), ("fleet", "fleet", "lineage", "ada"))
        self.assertEqual(view["overrides"], {"layer": {"card": "soul", "harvest": "fleet"}})
        kindless = self.parse(WT, "layer: soul\n")
        bare = kingdom.harvest_view(kindless, None, os.path.join(citizens, "citizen-bo"), rules)
        self.assertEqual((bare["kind"], bare["name"], bare["domain"], bare["state"]), ("service", "citizen-bo", "none", "active"))
        self.assertIsNone(kingdom.harvest_view(None, None, os.path.join(citizens, "citizen-cy"), rules))
        self.assertIsNone(kingdom.harvest_view(soul, None, os.path.join(citizens, "deep", "nested"), rules))
        row = {"name": "ada", "path": os.path.join(citizens, "citizen-ada"), "kind": "lineage", "layer": "soul",
               "domain": "sophia", "state": "active", "purpose": "p"}
        both = kingdom.harvest_view(soul, row, row["path"], rules)
        self.assertEqual((both["source"], both["also_roster"]["layer"]), ("fleet", "soul"))

    def test_harvest_view_reports_unreadable_rules_as_unknown(self):
        rules = json.loads(json.dumps(self.foundation["refs"][WT]))
        rules["rules"]["card_name_overrides"] = None
        rules["rules"]["fleet_forced_layer"] = None
        card = self.parse(WT, "name: other\nlayer: soul\n")
        row = {"name": "seed", "path": "/x/seed", "kind": "ops", "layer": "os", "domain": "none", "state": "active", "purpose": ""}
        view = kingdom.harvest_view(card, row, "/x/seed", rules)
        self.assertIsNone(view["name"])
        self.assertIn("card_name_overrides", view["unknown_rules"])
        fleet = kingdom.harvest_view(card, None, os.path.join(self.home, "Desktop", "citizens", "c"), rules)
        self.assertIsNone(fleet["layer"])
        self.assertIn("fleet_forced_layer", fleet["unknown_rules"])

    def test_parse_roster_mirrors_harvest(self):
        text = ("# header\n\nalpha | " + fixture.HOME_REL + "Desktop/alpha | service | runtime | alpha | active | Alpha | extra\n"
                "  # indented comment\nno-path |  | ops\nshort | /abs/short\n")
        roster = kingdom.parse_roster(text, home="/h")
        rows = roster["rows"]
        self.assertEqual([r["name"] for r in rows], ["alpha", "short"])
        self.assertEqual((rows[0]["path"], rows[0]["path_raw"], rows[0]["purpose"]),
                         ("/h/Desktop/alpha", fixture.HOME_REL + "Desktop/alpha", "Alpha"))
        self.assertEqual((rows[1]["kind"], rows[1]["purpose"]), (None, ""))
        self.assertEqual(roster["skipped_lines"], [5])
        self.assertEqual(len(self.foundation["refs"][WT]["roster"]["rows"]), len(fixture.ROSTER_ROWS))
        self.assertEqual(len(self.foundation["refs"][OM]["roster"]["rows"]), len(fixture.ROSTER_ROWS) + 1)


class RegistryAndRuntimeTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.estate = e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.registry = kingdom.read_registry(e.kos.path)

    def test_registry_reader_gets_every_id_and_keeps_the_broken_one(self):
        reg = self.registry
        self.assertEqual(reg["ids"], ["agenttool-site", "agenttool-api", "alpha-pages", "edge-worker",
                                      "local-brain", "fixture-backup", "broken-entry"])
        self.assertEqual((reg["version"], reg["updated"]), ("1", "2026-10-01"))
        broken = [s for s in reg["services"] if s["id"] == "broken-entry"][0]
        self.assertTrue(broken["errors"])
        self.assertIsNone(broken["status"])
        self.assertEqual({e["id"] for e in reg["errors"]}, {"broken-entry"})
        self.assertEqual(reg["status"], "partial")
        self.assertEqual(reg["runtime_prefixes"], ["cf-pages", "cf-worker", "fly", "local-launchd"])

    def test_registry_values(self):
        by_id = {s["id"]: s for s in self.registry["services"]}
        api = by_id["agenttool-api"]
        self.assertEqual(api["what"], "platform API")
        self.assertEqual(api["urls"], {"api": "https://api.agenttool.dev", "health": "https://api.agenttool.dev/v1/wake?a=1, b"})
        self.assertEqual(api["expect"], [401])
        self.assertEqual((api["runtime"], api["runtime_prefix"], api["status"]), ("fly:agenttool", "fly", "live"))
        self.assertEqual(by_id["alpha-pages"]["what"], "quoted value with # not a comment")
        self.assertEqual(by_id["local-brain"]["status"], "live")
        self.assertIsNone(by_id["local-brain"]["urls"])
        self.assertEqual(by_id["agenttool-site"]["deploy"], "fly deploy")

    def test_registry_reader_never_raises(self):
        for text in ("services:\n\t- id: x\n", "services:\n  - id: 'open\n", "services:\n  - id: a\n    urls: { x: \"y\"\n", "\x00\x01", "services:\n    what: x\n",
                     "services:\n  - id: a\n    what: \"x\" trailing\n  - id: a\n"):
            with self.subTest(text=text):
                reg = kingdom.parse_registry(text)
                self.assertTrue(reg["errors"])
        dup = kingdom.parse_registry("services:\n  - id: a\n  - id: a\n")
        self.assertIn("duplicate id", [e["message"] for e in dup["errors"]])

    def test_registry_copy_is_byte_compared(self):
        self.assertEqual(self.registry["copy"]["equal"], True)
        other = self.case_dir("copy")
        fixture.write_file(os.path.join(other, ".kingdom", "REGISTRY.yaml"), "version: 1\n")
        self.assertIs(kingdom.read_registry(self.estate.kos.path, home=other)["copy"]["equal"], False)
        self.assertIsNone(kingdom.read_registry(self.estate.kos.path, home=self.case_dir("none"))["copy"]["equal"])

    def test_sites_and_graph_are_dated_claims(self):
        sites = kingdom.read_sites(self.estate.kos.path)
        self.assertEqual([d["repo"] for d in sites["doors"]], ["agenttool", "alpha-service", "no-such-repo"])
        self.assertEqual(sites["dated"]["head_commit"], self.estate.kos.worktree_commit)
        self.assertIsNotNone(sites["dated"]["mtime"])
        graph = kingdom.read_graph(self.estate.kos.path)
        self.assertEqual((graph["status"], graph["count"], graph["catalog_count"]), ("ok", len(fixture.ROSTER_ROWS), len(fixture.ROSTER_ROWS)))
        self.assertEqual(graph["dated"]["head_commit"], self.estate.kos.worktree_commit)

    def test_pulse_status_and_history(self):
        pulse = kingdom.read_pulse()
        status, history = pulse["status"], pulse["history"]
        self.assertEqual(status["state"], "ok")
        self.assertRegex(status["generated_at"], r"^\d{4}-\d{2}-\d{2}T")
        rows = {r["id"]: r for r in status["rows"]}
        self.assertEqual(len(rows), 5)
        self.assertEqual((rows["fixture-backup"]["observed"], rows["fixture-backup"]["code"], rows["fixture-backup"]["ms"]), ("down", 3, None))
        self.assertEqual(rows["agenttool-api"]["code"], 401)
        self.assertEqual(status["alerts"], 1)
        self.assertEqual(history["state"], "ok")
        self.assertEqual(history["lines"], 3)
        self.assertEqual(history["transitions"], [{"id": "fixture-backup", "from": "up", "to": "down",
                                                   "at": history["last"]["t"]}])

    def test_pulse_history_window_drops_the_cut_line(self):
        line = json.dumps({"t": "T", "probes": [{"id": "x", "observed": "up"}]}).encode() + b"\n"
        tail = b'partial", "probes": []}\n' + line + line + b'{"t": "half'
        parsed = kingdom.parse_history_tail(tail, partial_start=True)
        self.assertEqual((parsed["lines"], parsed["unreadable_lines"]), (2, 0))
        big = self.case_dir("big")
        history = os.path.join(big, ".kingdom", "pulse-history.jsonl")
        fixture.write_file(history, line * (3 * kingdom.PULSE_TAIL // len(line)))
        read = kingdom.read_pulse(home=big)["history"]
        self.assertEqual(read["window_bytes"], kingdom.PULSE_TAIL)
        self.assertEqual(read["unreadable_lines"], 0)
        self.assertEqual(kingdom.read_pulse(home=self.case_dir("nopulse"))["status"]["state"], "missing")

    def test_global_wake_is_presence_only(self):
        self.assertEqual(kingdom.global_wake(), {"present": True, "status": "ok"})
        self.assertEqual(kingdom.global_wake(home=self.case_dir("nowake")), {"present": False, "status": "missing"})
        empty = self.case_dir("emptywake")
        fixture.write_file(os.path.join(empty, ".claude", "settings.json"),
                           json.dumps({"hooks": {"SessionStart": [{"hooks": [{"type": "command", "command": "  "}]}]}}))
        self.assertEqual(kingdom.global_wake(home=empty)["present"], False)


ENUM_VALUES = {v for values in fixture.KINGDOM_ENUMS.values() for v in values}


def _string_values(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from _string_values(item)
    elif isinstance(value, list):
        for item in value:
            yield from _string_values(item)
    elif isinstance(value, str):
        yield value


class LockTests(fixture.EstateTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        home = os.path.join(cls.tmp, "home")
        os.makedirs(home)
        os.environ["HOME"] = home
        cls.foundation = kingdom.read_foundation(fixture.make_kingdom_os(home).path, home=home)

    def test_lock_holds_hashes_and_commits_only(self):
        lock = kingdom.make_lock(self.foundation)
        text = kingdom.lock_text(lock)
        self.assertEqual(tomllib.loads(text), lock)
        self.assertNotIn(kingdom.REVIEWED_KEY, lock["kingdom_os"])
        self.assertEqual(set(lock["refs"]), {WT, OM})
        for ref in (WT, OM):
            self.assertEqual(set(lock["refs"][ref]), {"commit", *kingdom.LOCK_HASH_KEYS})
        self.assertFalse(ENUM_VALUES & set(_string_values(lock)))
        self.assertFalse(ENUM_VALUES & set(re.findall(r"[A-Za-z0-9_.-]+", text)))
        for key, value in re.findall(r"(?m)^(\w+) = \"([0-9a-f]{32,})\"$", text):
            self.assertTrue(key.endswith("_sha256") or key.endswith("commit"), key)

    def test_compare_and_verify(self):
        lock = kingdom.make_lock(self.foundation)
        self.assertEqual(kingdom.compare_lock(self.foundation, lock)["state"], "match")
        self.assertEqual(kingdom.compare_lock(self.foundation, None)["state"], "missing")
        drifted = json.loads(json.dumps(lock))
        drifted["refs"][OM]["card_enums_block_sha256"] = "0" * 64
        drifted["refs"][WT]["commit"] = "1" * 40
        result = kingdom.compare_lock(self.foundation, drifted)
        self.assertEqual(result["state"], "mismatch")
        self.assertEqual([(d["ref"], d["key"]) for d in result["diffs"]], [(OM, "card_enums_block_sha256")])
        self.assertEqual([m["ref"] for m in result["commits_moved"]], [WT])
        self.assertFalse(kingdom.verify_harvest_allowed(self.foundation, lock)[0])
        live = self.foundation["refs"][WT]["harvest_blob_sha256"]
        reviewed = kingdom.make_lock(self.foundation, reviewed_harvest_sha256=live)
        self.assertTrue(kingdom.verify_harvest_allowed(self.foundation, reviewed)[0])
        carried = kingdom.make_lock(self.foundation, previous=reviewed)
        self.assertEqual(carried["kingdom_os"][kingdom.REVIEWED_KEY], live)
        stale = kingdom.make_lock(self.foundation, reviewed_harvest_sha256="2" * 64)
        self.assertFalse(kingdom.verify_harvest_allowed(self.foundation, stale)[0])

    def test_committed_lock_is_well_formed(self):
        lock, reason = kingdom.read_lock(fixture.LAYER_DIR)
        self.assertIsNone(reason)
        self.assertEqual(lock["kingdom_os"]["remote_id"], kingdom.KOS_REMOTE_ID)
        self.assertRegex(lock["kingdom_os"][kingdom.REVIEWED_KEY], r"^[0-9a-f]{64}$")
        for ref in (WT, OM):
            self.assertEqual(set(lock["refs"][ref]), {"commit", *kingdom.LOCK_HASH_KEYS})
        self.assertFalse(ENUM_VALUES & set(_string_values(lock)))
