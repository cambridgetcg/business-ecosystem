"""Tests for tool/curate.py: scrubber, privacy lint, tag targets, roles and the survey import.

Every secret-shaped or home-path string below is built by concatenation, so this file passes the
privacy lint it tests. Imports run against a small synthetic survey and a synthetic host repo.
"""
import json
import os
import stat
import tomllib
import unittest

from . import fixture
import curate
import safety

HOME_REL = fixture.HOME_REL
LOCAL = "local" + ":"
PLANTED_PATH = HOME_REL + "Desktop/alpha-service"
PLANTED_ABS = "/" + "Users/" + "someone/Desktop/thing"
PLANTED_IP = "10." + "20.30.40"
PLANTED_EMAIL = fixture.FIXTURE_EMAIL
PLANTED_HEX = "ab12cd34" * 5
PLANTED_GHP = "gh" + "p_" + "A1b2C3d4" * 4
PLANTED_ASSIGN = "pass" + "word=" + "hunter2"
RISK_WORD = curate.RISKS["unsaved"]


def survey_files(home):
    """{relpath: JSON-able} for a small synthetic survey that exercises every import path."""
    clean_fix = {"field": "what", "verdict": "weakened", "corrected": "It is smaller than claimed.",
                 "evidence": "ls " + PLANTED_PATH}
    risky_fix = {"field": "risks", "verdict": "refuted", "corrected": "It holds " + "uncommitted" + " edits.",
                 "evidence": "status count"}

    def project(family, ident, name, what, tags, rels=(), corrections=(), bf="ops: tooling", path=None):
        return {"family": family, "id": ident, "name": name, "path": path or HOME_REL + "Desktop/" + name,
                "what": what, "layer": "os", "kind": "ops", "domain": "none", "card_state": "active",
                "card_present": True, "liveness": "active", "business_function": bf, "tags": list(tags),
                "surfaces": ["door (cf-pages door)"], "rels": list(rels), "risks": ["a private risk"],
                "confidence": "high", "corrections": list(corrections)}

    projects = [
        project("kingdom-core", "github.com/cambridgetcg/kingdom-os", "kingdom-os",
                "The connective layer. It lives at " + PLANTED_PATH + " and answers on " + PLANTED_IP + ".",
                ["zerone", "karma", "nextjs-vercel"],
                rels=["feeds:github.com/cambridgetcg/zerone-core (pulse reads it)",
                      "copy_of:" + PLANTED_PATH, "depended_on_by:business-ecosystem; zerone-core"],
                corrections=[clean_fix, risky_fix]),
        project("zerone-core", "github.com/cambridgetcg/zerone-core", "zerone-core",
                "The chain. Its operator token lives in " + PLANTED_GHP + " today.", ["zerone", "cosmos-sdk"],
                bf="platform (retired): the ledger"),
        project("business-ecosystem", "github.com/cambridgetcg/business-ecosystem", "business-ecosystem",
                "The host monorepo.", ["zerone", "removed-2026-10-17"], bf="none (stub)"),
        project("kingdom-satellites", LOCAL + HOME_REL + "Desktop/local-notes", "local-notes",
                "Fixture notes with no remote.", ["notes-tag"]),
        project("zerone-satellites", os.path.realpath(home).lower() + "/desktop/gone-worktree", "gone-worktree",
                "A removed worktree.", ["notes-tag"]),
    ]
    groups = [
        {"family": "fleet-citizens", "bulk": True, "label": "founding-value-citizens", "count": 2,
         "members": ["citizen-abzu", "citizen-an"], "canonical_location": HOME_REL + "love/citizens",
         "notes": None, "what": "The founding citizens.", "layer": "soul", "kind": "doctrine",
         "liveness": "dormant", "business_function": "doctrine: soul canon", "tags": ["fleet-citizen"]},
        {"family": "fleet-citizens", "bulk": True, "label": "desktop-founding-mirror", "count": 1,
         "members": ["citizen-abzu"], "canonical_location": HOME_REL + "Desktop/citizens", "notes": "mirror",
         "what": "A mirror.", "layer": "soul", "kind": "doctrine", "liveness": "duplicate-checkout",
         "business_function": "ops: mirror", "tags": ["mirror"]},
    ]
    summaries = {family: {"summary": "Family %s. It is synthetic." % family, "drift": [],
                          "open_questions": ["Is it real?", "Where is the " + "pass" + "phrase file?"],
                          "nongit": []} for family in curate.FAMILIES}
    summaries["kingdom-core"]["nongit"] = [{"path": HOME_REL + ".kingdom", "what": "state", "role": "state",
                                            "secret_bearing": True, "suggested_tags": ["runtime-state", "keys"]}]
    phrases = [phrase for ident, phrase in curate.QUESTION_IDS]
    questions = ["Question about %s?" % p for p in phrases]
    questions[6] = "May agents rotate the " + "pass" + "phrase file under " + PLANTED_PATH + "? Which hygiene applies?"
    critic = {"questions_for_yu": questions, "gaps": [], "overlaps": [], "top_risks": [], "estate_shape": ""}
    surfaces = {"out": {"surfaces": [
        {"id": "door", "kind": "cf-pages", "source_project": "kingdom-os", "url_or_label": "https://door.example.dev",
         "source_path": PLANTED_PATH, "deploy_method": "wrangler", "last_known_status": "up", "evidence": "pulse"},
        {"id": "chain-1", "kind": "fly-app (chain)", "source_project": "zerone",
         "url_or_label": "http://" + PLANTED_IP + ":26657", "source_path": "", "deploy_method": "fly",
         "last_known_status": "up", "evidence": "pulse"},
    ], "unmapped": ["an unattributed app"]}}
    gh = [{"name": n, "url": "https://github.com/cambridgetcg/" + n, "isPrivate": True}
          for n in ("kingdom-os", "kingdom", "legible_money", "zerone-core", "rewardspro", "cambridge-tcg-monorepo",
                    "ai-love", "business-ecosystem")]
    codeberg = [{"name": n, "html_url": "https://codeberg.org/zerone-dev/" + n, "private": True,
                 "owner": {"login": "zerone-dev"}} for n in ("kingdom-os", "youspeak", "zerone")]
    return {
        "design/projects-digest.jsonl": projects + groups,
        "design/family-summaries.json": summaries,
        "design/critic.json": critic,
        "design/x-surfaces.json": surfaces,
        "gh-cambridgetcg.json": gh,
        "codeberg-zerone-dev.json": codeberg,
    }


def write_survey(root, home):
    survey = os.path.join(root, "survey")
    for rel, data in survey_files(home).items():
        if rel.endswith(".jsonl"):
            text = "".join(json.dumps(row) + "\n" for row in data)
        else:
            text = json.dumps(data, indent=1)
        fixture.write_file(os.path.join(survey, rel), text)
    safety.write_sums(survey)
    return survey


def _text(path):
    with open(path, encoding="utf-8") as stream:
        return stream.read()


class ScrubTests(fixture.EstateTestCase):

    def test_planted_values_become_placeholders(self):
        prose = "The service keeps a small catalogue of public pages and answers questions about them. " * 4
        text = (prose + "It lives at %s and %s. Mail %s about %s. The id is %s."
                % (PLANTED_PATH, PLANTED_ABS, PLANTED_EMAIL, PLANTED_IP, PLANTED_HEX))
        public, spans, heavy = curate.scrub(text)
        self.assertFalse(heavy)
        for planted in (PLANTED_PATH, PLANTED_ABS, PLANTED_EMAIL, PLANTED_IP, PLANTED_HEX):
            self.assertNotIn(planted, public)
        for mark in ("⟨local⟩", "⟨email⟩", "⟨ip⟩", "⟨id⟩"):
            self.assertIn(mark, public)
        self.assertEqual(curate.lint_text(public, "curated/x.toml", "strict"), [])

    def test_secret_sentences_move_whole(self):
        text = ("The service is small. Its key is %s here. Login uses %s. It has %s in two places. It is fine."
                % (PLANTED_GHP, PLANTED_ASSIGN, RISK_WORD))
        public, spans, heavy = curate.scrub(text)
        for planted in (PLANTED_GHP, PLANTED_ASSIGN, RISK_WORD):
            self.assertNotIn(planted, public)
            self.assertTrue(any(planted in s for s in spans))

    def test_unpushed_state_phrasings_move(self):
        public, spans, heavy = curate.scrub("It is a fixture chain. 7 of its tips sit on no remote. It has 2 stashes.")
        self.assertEqual(public, "It is a fixture chain.")
        self.assertTrue(heavy)

    def test_heavy_text_keeps_only_first_clean_sentence(self):
        text = "Short intro. " + " ".join("The " + "pass" + "phrase is in file %d." % i for i in range(5))
        public, spans, heavy = curate.scrub(text)
        self.assertTrue(heavy)
        self.assertEqual(public, "Short intro.")

    def test_risky_record_regex(self):
        self.assertTrue(curate.is_risky({"corrected": "a " + "wallet" + " was found"}))
        self.assertFalse(curate.is_risky({"corrected": "the count is 3, not 4"}))


class LintTests(fixture.EstateTestCase):

    def layer(self):
        root = self.case_dir()
        layer = os.path.join(root, "estate")
        files = {
            ".gitignore": "/" + "private/\n__pycache__/\n/atlas.html\n/tree\n",
            "README.md": "# estate\n",
            "curated/bad.toml": "\n".join([
                "a = \"%s\"" % PLANTED_PATH, "b = \"%s\"" % PLANTED_IP, "c = \"%s\"" % PLANTED_EMAIL,
                "d = \"%s\"" % (PLANTED_HEX * 2), "e = \"%s\"" % PLANTED_GHP, "f = \"%s\"" % PLANTED_ASSIGN,
                "g = \"%s\"" % RISK_WORD, "h = \"%s\"" % (LOCAL + HOME_REL + "x"),
                "i = \"github:repo:" + "123\""]) + "\n",
            "vocab/tag-map.tsv": "raw\ttargets\trule\tuses\nx\trisk=%s\tR3\t1\n" % RISK_WORD,
            "tool/other.py": "WHERE = \"%s\"\n" % PLANTED_PATH,
            "tool/safety.py": "%s\nX = \"%s\"\n%s\n" % (curate.LOCATOR_BEGIN, PLANTED_PATH, curate.LOCATOR_END),
            "curated/STATUS.md": "fine\n",
        }
        for rel, text in files.items():
            fixture.write_file(os.path.join(layer, rel), text)
        os.makedirs(os.path.join(layer, "private"), mode=0o700)
        fixture.write_file(os.path.join(layer, "private", "secret-ish.txt"), PLANTED_GHP)
        return layer

    def test_planted_strings_are_caught(self):
        layer = self.layer()
        findings = curate.lint_committed(layer, host=None, listings=[])
        bad = {f["rule"] for f in findings if f["path"] == "curated/bad.toml"}
        self.assertEqual(bad, {"path", "ipv4", "email", "hex", "token-prefix", "assignment", "risk-word",
                               "local-id", "provider-id"})
        # Secret-shaped matches are never echoed in full.
        hit = [f for f in findings if f["rule"] == "token-prefix"][0]
        self.assertNotIn(PLANTED_GHP, hit["detail"])

    def test_scopes_and_exemptions(self):
        findings = curate.lint_committed(self.layer(), host=None, listings=[])
        paths = {(f["path"], f["rule"]) for f in findings}
        self.assertIn(("tool/other.py", "path"), paths)
        self.assertNotIn(("tool/safety.py", "path"), paths)
        self.assertNotIn((".gitignore", "path"), paths)
        self.assertNotIn(("vocab/tag-map.tsv", "risk-word"), paths)
        self.assertIn(("curated/STATUS.md", "progress-path"), paths)
        self.assertFalse(any(f["path"].startswith("private") for f in findings))

    def test_publication_guard(self):
        root = self.case_dir()
        listing = os.path.join(root, "gh.json")

        def guard(private):
            rows = [{"name": "business-ecosystem", "url": "https://github.com/cambridgetcg/business-ecosystem",
                     "isPrivate": private}]
            fixture.write_file(listing, json.dumps(rows))
            return [f for f in curate.lint_committed(self.layer(), None, [listing]) if f["rule"] == "publication"]

        self.assertEqual(guard(True), [])
        public = guard(False)
        self.assertEqual([f["severity"] for f in public], ["error"])
        unknown = [f for f in curate.lint_committed(self.layer(), None, []) if f["rule"] == "publication"]
        self.assertEqual([f["severity"] for f in unknown], ["warning"])

    def test_host_checks(self):
        root = self.case_dir()
        home = os.path.join(root, "home")
        os.makedirs(home)
        with fixture.patched_env(HOME=home):
            host = os.path.join(root, "host")
            layer = fixture.make_host(host, home=home)
            fixture.write_file(os.path.join(layer, "curated", "ok.toml"), "a = 1\n")
            findings = curate.lint_committed(layer, host=host, listings=[])
        rules = {(f["check"], f["rule"]) for f in findings}
        self.assertIn(("host-state", "branch"), rules)
        self.assertNotIn(("structure", "hidden-by-gitignore"), rules)
        self.assertEqual([f for f in findings if f["check"] == "content"], [])


class TagTargetTests(fixture.EstateTestCase):

    def test_rules(self):
        cases = {
            "nextjs-vercel": (["expect:stack=typescript", "expect:hosting=vercel"], "R0"),
            "removed-2026-10-17": (["drop=event"], "R0"),
            "zerone-core": (["drop=echo"], "R1"),
            "economy-layer": (["card-hint:layer=economy"], "R2"),
            "archived-on-github": (["expect:liveness=archived"], "R3"),
            "legacy-chain": (["role_status=historic"], "R4"),
            "storefront": (["role=revenue"], "R5"),
            "hmrc-mtd": (["be.framework_domain=tax"], "R6"),
            "youspeak-verbs": (["topic=youspeak"], "R7"),
            "runtime-state": (["artifact_kind=state"], "R8"),
        }
        for raw, (targets, rule) in cases.items():
            got, rules = curate.suggest_targets(raw)
            self.assertEqual(got, targets, raw)
            self.assertIn(rule, rules, raw)
        self.assertEqual(curate.suggest_targets("partial" + "-clone")[0], ["risk=" + curate.RISKS["partial"]])

    def test_residuals(self):
        self.assertEqual(curate.suggest_targets("zz-unique", uses=1)[0], ["drop=singleton"])
        self.assertEqual(curate.suggest_targets("zz-unique", uses=3)[0], ["drop=queue"])
        self.assertEqual(curate.suggest_targets("needs-owner-decision", uses=1)[0], ["drop=queue"])

    def test_map_round_trip_and_closure(self):
        rows = curate.build_tag_map({"games": 2, "game": 1, "nextjs-vercel": 4, "zz-unique": 1})
        text = curate.tag_map_text(rows)
        self.assertEqual(curate.parse_tag_map(text), rows)
        self.assertEqual(curate.tag_map_problems(rows), [])
        self.assertIn("R0", dict((r[0], r[2]) for r in rows)["games"])
        bad = [("x", ["topic=not-a-topic"], ["R7"], 1), ("y", [], [], 1)]
        self.assertEqual(len(curate.tag_map_problems(bad)), 2)
        live = {"layer": ["soul"], "kind": ["doctrine"]}
        self.assertTrue(curate.target_problems("card-hint:layer=os", live))

    @unittest.skipUnless(os.path.exists(os.path.join(fixture.LAYER_DIR, "vocab", "tag-map.tsv")),
                         "vocab/tag-map.tsv not imported yet")
    def test_committed_tag_map_closes(self):
        raw, reason = safety.read_checked(os.path.join(fixture.LAYER_DIR, "vocab", "tag-map.tsv"))
        rows = curate.parse_tag_map(raw.decode("utf-8"))
        self.assertEqual(curate.tag_map_problems(rows), [])
        self.assertTrue(all(row[1] for row in rows))


class RoleAndRelationTests(fixture.EstateTestCase):

    def test_roles_from_function(self):
        cases = {
            "platform (retired): the ledger": (["platform"], "retired"),
            "research/play: games": (["research", "play"], "current"),
            "doctrine/lineage": (["doctrine", "archive"], "current"),
            "public door + platform": (["public-door", "platform"], "current"),
            "research (claimed by forge description only)": (["research"], "claimed"),
            "economy bridge (in development): x": (["platform"], "unrealised"),
            "fleet: citizens": (["citizen"], "current"),
            "none (stub)": ([], None),
            "unknown": ([], None),
        }
        for text, expected in cases.items():
            self.assertEqual(curate.roles_from_function(text), expected, text)

    def test_parse_relation(self):
        verb, inverse, raw_kind, targets = curate.parse_relation("depended_on_by:alpha (note, here); beta")
        self.assertEqual((verb, inverse, raw_kind), ("depends_on", True, "depended_on_by"))
        self.assertEqual(targets, [("alpha", "note, here"), ("beta", "")])
        self.assertEqual(curate.parse_relation("archive_of:x")[0], "copy_of")
        self.assertEqual(curate.parse_relation("serves:x")[0], "related_to")


class ImportTests(fixture.EstateTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.home = os.path.join(cls.tmp, "home")
        os.makedirs(os.path.join(cls.home, "Desktop"))
        cls.notes = fixture.make_repo(os.path.join(cls.home, "Desktop", "local-notes"), home=cls.home,
                                      files={"a.md": "a\n"})
        cls.survey = write_survey(cls.tmp, cls.home)

    def host(self):
        root = self.case_dir()
        host = os.path.join(root, "business-ecosystem")
        return host, fixture.make_host(host, home=self.home)

    def run_import(self, layer, host, write=True, **kw):
        with fixture.patched_env(HOME=self.home):
            return curate.import_survey(self.survey, write=write, layer_dir=layer, host=host, home=self.home,
                                        quiet=True, card_enums=fixture.KINGDOM_ENUMS, **kw)

    def test_dry_run_writes_nothing(self):
        host, layer = self.host()
        report = self.run_import(layer, host, write=False)
        self.assertFalse(os.path.exists(os.path.join(layer, "curated")))
        self.assertFalse(os.path.exists(os.path.join(layer, "private", "config.toml")))
        self.assertTrue(all(i["status"] == "would write" for i in report["committed"] + report["private"]))

    def test_write_then_keep(self):
        host, layer = self.host()
        report = self.run_import(layer, host)
        self.assertTrue(all(i["status"] == "written" for i in report["committed"] + report["private"]))
        modes = curate.private_modes(layer)
        self.assertEqual(modes["curated"], 0o500)
        for rel in ("curated/projects.toml", "curated/estate.toml", "config.toml"):
            self.assertEqual(modes[rel], 0o600, rel)
        again = self.run_import(layer, host)
        self.assertTrue(all(i["status"] == "unchanged" for i in again["committed"]))
        self.assertTrue(all(i["status"] == "present (kept)" for i in again["private"]))
        self.assertEqual(curate.private_modes(layer)["curated"], 0o500)
        with fixture.patched_env(HOME=self.home):
            findings = curate.lint_committed(layer, host=host, listings=[])
        self.assertEqual([f for f in findings if f["check"] != "host-state"], [])

    def load(self, layer, rel):
        with open(os.path.join(layer, rel), "rb") as stream:
            return tomllib.load(stream)

    def test_committed_content(self):
        host, layer = self.host()
        report = self.run_import(layer, host)
        kingdom = self.load(layer, "curated/families/kingdom-core.toml")
        row = kingdom["project"][0]
        self.assertEqual(row["id"], "github.com/cambridgetcg/kingdom-os")
        self.assertNotIn(PLANTED_PATH, row["what"])
        self.assertNotIn(PLANTED_IP, row["what"])
        self.assertNotIn("risks", row)
        self.assertNotIn("raw_tags", row)
        # The risky correction moved wholesale; the clean one commits without its evidence.
        self.assertEqual(row["corrections"], [{"field": "what", "verdict": "weakened",
                                               "corrected": "It is smaller than claimed."}])
        # Topics: zerone has 3 records; karma has 1 and waits in QUEUE.
        self.assertIn("zerone", row["topics"])
        self.assertNotIn("karma", row.get("topics", []))
        self.assertEqual(report["queue"]["topic_queue"], {"karma": ["github.com/cambridgetcg/kingdom-os"]})
        edges = {(e["verb"], e.get("from"), e["to"]) for e in row["relations"]}
        self.assertIn(("feeds", None, "github.com/cambridgetcg/zerone-core"), edges)
        self.assertIn(("depends_on", "github.com/cambridgetcg/business-ecosystem", row["id"]), edges)
        self.assertFalse(any(PLANTED_PATH in json.dumps(e) for e in row["relations"]))
        zerone = self.load(layer, "curated/families/zerone-core.toml")["project"][0]
        self.assertEqual((zerone["role"], zerone["role_status"]), (["platform"], "retired"))
        self.assertNotIn(PLANTED_GHP, zerone["what"])
        business = self.load(layer, "curated/families/business-ecosystem.toml")["project"][0]
        self.assertNotIn("role", business)
        self.assertIn(business["id"], report["queue"]["role_unknown"])
        fleet = self.load(layer, "curated/families/fleet-citizens.toml")
        self.assertEqual([g["id"] for g in fleet["group"]], ["group:fleet-citizens/founding-value-citizens"])
        self.assertEqual(fleet["group"][0]["member_rule"]["names"],
                         ["github.com/cambridgetcg/citizen-abzu", "github.com/cambridgetcg/citizen-an"])
        estate = self.load(layer, "curated/estate.toml")
        self.assertEqual(estate["legal"], {"status": "unassigned", "records": []})
        self.assertEqual(len(estate["dispute"]), 6)
        self.assertEqual([s["hostnames"] for s in estate["surface"]], [["door.example.dev"]])
        self.assertNotIn("q:secret-hygiene", [q["id"] for q in estate["question"]])
        decisions = self.load(layer, "curated/decisions.toml")
        self.assertEqual(decisions["decision"][0]["id"], "dec-2026-10-17-1")
        for family in curate.FAMILIES:
            doc = self.load(layer, "curated/families/%s.toml" % family)
            self.assertEqual(doc["family"]["reviewed"], False)
            self.assertFalse(any(p["id"].startswith(LOCAL) for p in doc.get("project", [])))
            self.assertNotIn("pass" + "phrase", json.dumps(doc["family"]["open_questions"]))

    def test_private_content(self):
        host, layer = self.host()
        self.run_import(layer, host)
        area = safety.PrivateArea(layer)
        with open(area.path("curated/projects.toml"), "rb") as stream:
            projects = {p["id"]: p for p in tomllib.load(stream)["project"]}
        kingdom = projects["github.com/cambridgetcg/kingdom-os"]
        self.assertEqual(kingdom["risks"], ["a private risk"])
        moved = [c for c in kingdom["corrections_private"] if c["moved"] == "risk-regex"]
        self.assertEqual(len(moved), 1)
        self.assertEqual(moved[0]["evidence"], "status count")
        notes = projects[LOCAL + HOME_REL + "Desktop/local-notes"]
        root = fixture.git(self.notes, "rev-list", "--max-parents=0", "HEAD", home=self.home).split()[0]
        self.assertEqual(notes["aliases"], [LOCAL + "local-notes@" + root[:12]])
        gone = projects[LOCAL + HOME_REL + "Desktop/gone-worktree"]
        self.assertEqual(gone["alias_status"], "gone")
        with open(area.path("curated/estate.toml"), "rb") as stream:
            estate = tomllib.load(stream)
        self.assertEqual([a["artifact_kind"] for a in estate["artifact"]], ["state"])
        self.assertEqual([g["id"] for g in estate["group"] if not g["committed"]],
                         ["group:fleet-citizens/desktop-founding-mirror"])
        self.assertTrue(any(PLANTED_IP in json.dumps(r) for r in estate["provider_resource"]))
        self.assertIn("q:secret-hygiene", [q["id"] for q in estate["question"]])
        with open(area.path("config.toml"), "rb") as stream:
            config = tomllib.load(stream)
        # No ref pin is seeded: an owner decision on the taxonomy authority picks the ref.
        self.assertEqual((config["kingdom"], config["tree"]["enabled"], config["retention"]["runs"]), ({}, True, 5))
        self.assertEqual([d["value"] for d in config["declared"]], [53, 50, 14])

    def test_write_needs_host_and_intact_survey(self):
        host, layer = self.host()
        with self.assertRaises(safety.GuardError):
            self.run_import(layer, None)
        broken = os.path.join(self.case_dir(), "survey")
        for rel, data in survey_files(self.home).items():
            fixture.write_file(os.path.join(broken, rel), json.dumps(data))
        with self.assertRaises(safety.GuardError):
            curate.load_survey(broken)

    def test_local_alias_forms(self):
        empty = fixture.make_repo(os.path.join(self.case_dir(), "empty"), home=self.home, commit=False)
        alias, status = curate.local_alias(empty)
        self.assertEqual(status, "no commits")
        self.assertTrue(alias.startswith(LOCAL + "empty@p"))
        self.assertEqual(curate.local_alias(os.path.join(self.tmp, "missing")), (None, "gone"))



    # PRIV-2 and S5: owner tables come from the private curation, never from code; --overwrite
    # keeps a backup and never replaces config.toml.
    def test_owner_tables_carry_forward_and_overwrite_keeps_a_backup(self):
        host, layer = self.host()
        report = self.run_import(layer, host)
        self.assertEqual(set(report["queue"]["owner_tables_empty"]), set(curate.OWNER_TABLES))
        area = safety.PrivateArea(layer)
        path = area.path("curated/estate.toml")
        with open(path, "rb") as stream:
            doc = tomllib.load(stream)
        self.assertFalse(any(doc.get(t) for t in curate.OWNER_TABLES))
        mirror = next(g for g in doc["group"] if g["id"] == "group:fleet-citizens/desktop-founding-mirror")
        self.assertEqual(mirror["member_rule"]["patterns"], [])  # no path invented
        # The owner adds a device and the mirror's paths by hand.
        text = _text(path).replace(
            'kind = "path-glob"', 'kind = "path-glob", patterns = ["' + HOME_REL + 'Desktop/citizens/*"]', 1)
        text = text.replace('patterns = [], note', 'note', 1)
        text += '\n[[device]]\nid = "device:studio"\nlabel = "studio"\n'
        # ... and edits a survey-derived row, which the re-import regenerates.
        text = text.replace('summary_full = "Family kingdom-core.', 'summary_full = "Hand-edited kingdom-core.', 1)
        area.unlock_curated()
        try:
            area.replace("curated/estate.toml", text)
        finally:
            area.lock_curated()
        config_before = _text(area.path("config.toml"))
        again = self.run_import(layer, host, overwrite=True)
        statuses = {i["path"]: i for i in again["private"]}
        self.assertEqual(statuses["private/config.toml"]["status"].split(";")[0], "present (kept)")
        self.assertEqual(_text(area.path("config.toml")), config_before)
        replaced = statuses["private/curated/estate.toml"]
        self.assertEqual(replaced["status"], "replaced")
        backup = os.path.join(layer, replaced["backup"])
        self.assertEqual(stat.S_IMODE(os.lstat(backup).st_mode), 0o400)
        self.assertEqual(_text(backup), text)
        with open(path, "rb") as stream:
            doc = tomllib.load(stream)
        self.assertEqual([d["id"] for d in doc["device"]], ["device:studio"])
        mirror = next(g for g in doc["group"] if g["id"] == "group:fleet-citizens/desktop-founding-mirror")
        self.assertEqual(mirror["member_rule"]["patterns"], [HOME_REL + "Desktop/citizens/*"])
        self.assertEqual(curate.private_modes(layer)["curated"], 0o500)


class FixerPrivacyTests(fixture.EstateTestCase):
    """Review findings PRIV-1..PRIV-7, TM-07 and TM-18: security posture and local state stay
    private, the lint knows the estate's token shapes, owner tables are never in code, the
    publication guard weighs the newest listing and its age, and source hedges are kept."""

    def test_security_posture_and_local_state_move_private(self):
        sentences = [
            # Synthetic, as every vector must be (lint_test_vectors): each hits the rule it tests.
            "The fixture IAM role has no MFA and a root account.",
            "A crafted page could be injected into the fixture agent in yolo mode.",
            "The fixture function answers on an unauthenticated URL.",
            "The fixture repo still holds the original literals.",
            "The fixture vault has no git remote and no backup.",
            "Fixture backup retention is off and recovery NOT_ASSESSED.",
            "The fixture tree has 9 untracked files and 2 modified.",
            "The fixture trunk is 12 commits behind origin.",
            "Two fixture commits exist nowhere else.",
            "The fixture repo holds 7 local branches.",
            "The fixture checkout is a blob:none partial clone.",
        ]
        for sentence in sentences:
            public, spans, heavy = curate.scrub("A small service. " + sentence)
            self.assertEqual(public, "A small service.", sentence)
            self.assertEqual(curate.lint_text(sentence, "curated/families/x.toml", "strict") != [], True, sentence)
        # Prose rules are for the curation; code may name these states in comments.
        self.assertEqual(curate.lint_text("# skip a partial clone; no backup here\n", "tool/x.py", "code"), [])

    def test_test_vectors_must_read_as_synthetic(self):
        # CB-1: a real finding pasted into a test as a vector would pass every line rule; a sentence
        # literal in tests/ that carries posture or state words must name a fixture subject.
        real_shaped = "# fixture snippet\ndef t():\n    s = \"The billing role has no MF\" + \"A and a root account.\"\n"
        findings = curate.lint_test_vectors(real_shaped, "tests/test_x.py")
        self.assertEqual([(f["rule"], f["line"]) for f in findings], [("test-vector", 3)])
        synthetic = "def t():\n    s = \"The fixture role has no MFA and a root account.\"\n"
        self.assertEqual(curate.lint_test_vectors(synthetic, "tests/test_x.py"), [])
        docstring = '# fixture snippet\ndef t():\n    """Checks the case of 9 untracked files and 2 modified."""\n'
        self.assertEqual(curate.lint_test_vectors(docstring, "tests/test_x.py"), [])  # code prose
        self.assertEqual(curate.lint_test_vectors(real_shaped, "tool/x.py"), [])  # tests only
        self.assertEqual(curate.lint_test_vectors("x = 'a stash'\n", "tests/test_x.py"), [])  # not a sentence

    def test_token_shapes_and_locations_are_caught(self):
        planted = ["sk" + "_live_" + "A1b2C3d4E5f6", "rk" + "_live_" + "A1b2C3d4E5f6", "gh" + "s_" + "A1b2C3d4E5f6",
                   "ey" + "JhbGciOiJIUzI1NiJ9." + "ey" + "Jyb2xlIjoic2VydmljZSJ9.x", "np" + "m_" + "a1B2c3D4e5F6g7H8i9J0k1",
                   "AWS_SECRET_ACCESS_" + "KEY" + "=x", "SUPABASE_SERVICE_ROLE_" + "KEY" + "=x",
                   "$" + "HOME/Desktop/zerone", "/" + "tmp/scratch", "/" + "opt/tool", curate._LOGIN]
        for value in planted:
            self.assertTrue(curate.lint_text("x = \"%s\"\n" % value, "curated/x.toml", "strict"), value)
            public, spans, heavy = curate.scrub("Fine. It uses %s here." % value)
            self.assertNotIn(value, public)

    def test_locators_assembled_from_parts_fail_in_tool_code(self):
        line = "PATH = HOME_REL + \".ollama/models\"\n"
        self.assertEqual([f["rule"] for f in curate.lint_text(line, "tool/x.py", "code")], ["locator-parts"])
        self.assertEqual(curate.lint_text(line, "tests/x.py", "code"), [])  # tests plant strings this way

    def test_risk_corrections_move_wholesale(self):
        public, private = curate._correction_split([
            {"field": "risks (local branches)", "verdict": "weakened", "corrected": "Three of them."},
            {"field": "liveness.state", "verdict": "weakened", "corrected": "Static since July."},
            {"field": "what", "verdict": "weakened", "corrected": "It is smaller than claimed."}])
        self.assertEqual([c["field"] for c in public], ["what"])
        self.assertEqual([c["moved"] for c in private], ["risk-field", "risk-field", "evidence-only"])

    def test_publication_guard_takes_the_newest_listing_and_its_age(self):
        root = self.case_dir()
        layer = LintTests.layer(self)

        def listing(name, private, age_days):
            path = os.path.join(root, name)
            fixture.write_file(path, json.dumps([{"name": "business-ecosystem", "isPrivate": private,
                                                  "url": "https://github.com/cambridgetcg/business-ecosystem"}]),
                               age_days=age_days)
            return path

        def guard(paths):
            return [(f["severity"], f["detail"]) for f in curate.lint_committed(layer, None, paths)
                    if f["rule"] == "publication"]

        old_private = listing("seed.json", True, 40)
        self.assertEqual([s for s, _ in guard([old_private])], ["warning"])  # stale: no evidence now
        fresh_public = listing("forge-run.json", False, 0)
        self.assertEqual([s for s, _ in guard([old_private, fresh_public])], ["error"])
        self.assertEqual(guard([listing("fresh.json", True, 1)]), [])
        # CB-3: a listing's known capture time beats its file time (a copy is newer than its capture).
        copied_private = listing("copied.json", True, 0)
        captured_public = listing("captured.json", False, 0)
        now = safety.utc_now().timestamp()
        self.assertEqual([s for s, _ in guard([copied_private, (captured_public, now - 2 * 86400)])], [])
        self.assertEqual([s for s, _ in guard([(copied_private, now - 3 * 86400), (captured_public, now - 86400)])],
                         ["error"])

    def test_forge_listings_of_every_retained_run_are_weighed(self):
        # CB-3: a --forge listing in an older run still counts, dated by that run, after a plain build.
        import datetime
        import types
        import estate
        layer = self.case_dir("forge-runs")
        for run in ("20261017T100000Z-aaaa", "20261018T100000Z-bbbb"):
            os.makedirs(os.path.join(layer, "private", "runs", run, "forge" if run.endswith("aaaa") else "tree"))
        path = fixture.write_file(os.path.join(layer, "private", "runs", "20261017T100000Z-aaaa", "forge",
                                               "gh-fixture.json"), "[]")
        ctx = types.SimpleNamespace(layer=layer, area=safety.PrivateArea(layer))
        when = datetime.datetime(2026, 10, 17, 10, 0, tzinfo=datetime.timezone.utc).timestamp()
        self.assertEqual(estate.forge_listings(ctx), [(path, when)])

    def test_desktop_droppings_are_info_not_errors(self):
        layer = LintTests.layer(self)
        fixture.write_file(os.path.join(layer, "curated", ".DS_Store"), "\x00\x01binary")
        findings = [f for f in curate.lint_committed(layer, None, []) if f["path"].endswith(".DS_Store")]
        self.assertEqual([(f["rule"], f["severity"]) for f in findings], [("junk-file", "info")])

    def test_source_hedges_and_forge_qualifiers(self):
        rows = [{"id": "codeberg.org/zerone-dev/youspeak", "name": "youspeak", "path": HOME_REL + "YOUSPEAK"},
                {"id": "codeberg.org/zerone-dev/ai-love", "name": "ai-love", "path": HOME_REL + "Desktop/ai-love"},
                {"id": "github.com/o/cardforum", "name": "cardforum"},
                {"id": "github.com/o/cardforum_io", "name": "cardforum_io"},
                {"id": "github.com/o/cambridge-tcg", "name": "cambridge-tcg"},
                {"id": "codeberg.org/zerone-dev/cambridge-tcg", "name": "Cambridge-TCG (Codeberg mirror)"}]
        names = curate.NameIndex(rows)
        ids, hedged = curate._resolve_source("youspeak (home/) per its README; " + HOME_REL
                                             + "Desktop/ai-love also claims it", names)
        self.assertTrue(hedged)
        self.assertEqual(sorted(ids), ["codeberg.org/zerone-dev/ai-love", "codeberg.org/zerone-dev/youspeak"])
        ids, hedged = curate._resolve_source("ambiguous: cardforum or cardforum_io", names)
        self.assertTrue(hedged)
        self.assertEqual(sorted(ids), ["github.com/o/cardforum", "github.com/o/cardforum_io"])
        self.assertEqual(curate._resolve_source("Cambridge-TCG (codeberg clone)", names),
                         (["codeberg.org/zerone-dev/cambridge-tcg"], False))

    def test_the_import_needs_the_live_enums(self):
        with self.assertRaises(safety.GuardError):
            curate.nav_values(None)
        self.assertIn("soul", curate.nav_values(fixture.KINGDOM_ENUMS))
        self.assertEqual(curate.target_problems("card-hint:layer=boot", fixture.KINGDOM_ENUMS),
                         ["card-hint:layer=boot is not in the vocabulary"])
        self.assertFalse(hasattr(curate, "CARD_LAYERS"))


if __name__ == "__main__":
    unittest.main()
