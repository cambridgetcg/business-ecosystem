"""Wire tests (tool/wires.py, sources.find_anchors): wires on the relation record kind.

Anchors are re-found in tracked files with comments stripped, and a hit counts as code only outside
tests and documents. A curated row's code_state is measured from its anchors and its end packages'
build state (wired, wired-unbuilt, declared, contradicted, or None when what decides it was not read);
its stage reads designed, unknown for a demonstrated claim this version cannot evidence, and accepted or
active only with an owner decision. The verdict compares claim and measurement, and check --wires exits
1 when a curated wired claim has no consuming code and 10 when another state differs, could not be
measured or the row changed after the build. Measured depends_on edges come from package imports and
manifests. A designed wire may name an end not built yet: it is measured and shown, but gives no
relation record."""
import json
import os

from . import fixture
from . import test_e2e
from . import test_model
from . import test_packages
import curate
import model
import packages
import sources
import wires

HOST = test_packages.HOST
pkg = test_packages.pkg
FACETS = test_model.VOCAB["facets"]


def row(name="w", frm=None, to=None, verb="feeds", code_state="wired", stage="designed", anchors=None, **extra):
    out = {"name": name, "from": frm or pkg("a"), "verb": verb, "to": to or pkg("b"), "code_state": code_state,
           "stage": stage, "channel": {"kind": "event", "name": "x.happened"},
           "anchors": anchors or [{"side": "from", "path": "a", "text": "x"}, {"side": "to", "path": "b", "text": "x"}]}
    out.update(extra)
    return out


def found(**by_side):
    """sides() output with the given found values per side: found(from_=["code"], to=["none"])."""
    return {side: [{"side": side, "path": "p", "text": "t", "found": f, "files": []}
                   for f in by_side.get(side + "_", by_side.get(side, []))] for side in wires.SIDES}


class VocabularyTests(fixture.EstateTestCase):

    def test_the_vocabularies_match_the_module_and_never_say_live(self):
        voc = FACETS["vocab"]
        self.assertEqual(tuple(voc["wire_code_state"]["values"]), wires.CODE_STATES)
        self.assertEqual(tuple(voc["wire_stage"]["values"]), wires.STAGES)
        self.assertEqual(tuple(voc["wire_verdict"]["values"]), wires.VERDICTS)
        self.assertEqual(tuple(voc["wire_channel"]["values"]), wires.CHANNELS)
        self.assertEqual(tuple(voc["wire_anchor"]["values"]), sources.ANCHOR_FOUND)
        self.assertNotIn("live", wires.CODE_STATES + wires.STAGES)
        for basis in (wires.MEASURED_IMPORT, wires.MEASURED_MANIFEST, wires.CURATED):
            self.assertIn(basis, voc["relation_basis"]["values"])
        for verb in wires.VERBS:
            self.assertIn(verb, voc["relation"]["values"])
        relation = test_model.VOCAB["records"]["kind"]["relation"]["fields"]
        self.assertEqual((relation["from"]["ref"], relation["to"]["ref"]), ("project|group|package",) * 2)

    def test_the_module_and_its_tests_pass_the_privacy_lint(self):
        for rel in ("tool/wires.py", "tests/test_wires.py"):
            with open(os.path.join(fixture.LAYER_DIR, rel), encoding="utf-8") as stream:
                body = stream.read()
            self.assertEqual(curate.lint_text(body, rel, curate.scope_of(rel)) + curate.lint_test_vectors(body, rel), [], rel)


class AnchorTests(fixture.EstateTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        denied = "token" + "-config.ts"  # deny-listed by name; never opened
        cls.root = fixture.make_repo(os.path.join(cls.tmp, "anchors"), files={
            "src/a.ts": "// 'comment.only'\nconst e = 'event.name'\n/* 'block.only' */ const u = 'https://x//y'\n",
            "src/b.py": "NAME = 'py.event'  # 'py.comment'\nURL = 'a # kept'\n",
            "flows/w.yaml": "source: yaml.event # 'yaml.comment'\n",
            "src/dist/out.js": "const built = 'built.only'\n",
            "tests/test_a.ts": "const t = 'test.only'\n",
            "docs/README.md": "doc.only\n",
            "src/NOTES.md": "notes on event.name\n",
            "locked/" + denied: "export const sealed = 'sealed.text'\n",
            "locked/open.ts": "export const open = 1\n"})
        texts = [("src", "event.name"), ("src", "comment.only"), ("src", "block.only"), ("src", "https://x//y"),
                 ("src/b.py", "py.event"), ("src/b.py", "py.comment"), ("src/b.py", "a # kept"),
                 ("flows/w.yaml", "yaml.event"), ("flows", "yaml.comment"), ("src", "built.only"), ("tests", "test.only"),
                 ("docs", "doc.only"), ("missing/dir", "x"), ("locked", "sealed.text"), ("locked", "open = 1")]
        with fixture.tracking_opens() as opened:
            cls.out = sources.find_anchors({"path": cls.root}, [{"path": p, "text": t} for p, t in texts])
        cls.opened = list(opened)
        cls.by = {(a["path"], a["text"]): a for a in cls.out["anchors"]}

    def found(self, path, text):
        return self.by[(path.strip("/"), text)]["found"]

    def test_found_says_where_the_text_is_never_more(self):
        self.assertEqual(self.out["status"], "ok")
        cases = {("src", "event.name"): "code", ("src", "https://x//y"): "code", ("src/b.py", "py.event"): "code",
                 ("src/b.py", "a # kept"): "code", ("flows/w.yaml", "yaml.event"): "code",
                 ("tests", "test.only"): "test", ("docs", "doc.only"): "doc", ("src", "comment.only"): "none",
                 ("src", "block.only"): "none", ("src/b.py", "py.comment"): "none", ("flows", "yaml.comment"): "none",
                 ("src", "built.only"): "none", ("missing/dir", "x"): "absent", ("locked", "sealed.text"): "unread",
                 ("locked", "open = 1"): "code"}
        for (path, text), want in cases.items():
            self.assertEqual(self.found(path, text), want, (path, text))
        # Code wins over the document that also names it; files lists both.
        self.assertEqual(self.by[("src", "event.name")]["files"], ["src/NOTES.md", "src/a.ts"])
        self.assertFalse([p for p in self.opened if os.path.basename(p).startswith("token")])

    def test_a_checkout_that_cannot_be_listed_is_an_error_not_a_miss(self):
        out = sources.find_anchors({"path": self.case_dir("bare")}, [{"path": "src", "text": "x"}])
        self.assertEqual((out["status"], out["anchors"]), ("error", []))
        self.assertTrue(out["reason"])

    def test_hash_comments_respect_quotes(self):
        self.assertEqual(sources.strip_hash_comments("a = 'x # y'  # z\n# whole\nb = \"q\\\"#\" # c"),
                         "a = 'x # y'  \n\nb = \"q\\\"#\" ")


class RowTests(fixture.EstateTestCase):

    def test_rows_of_the_wrong_shape_are_named_and_left_out(self):
        good = row("ok-wire", flow="f-1", hop=2, evidence="short", reviewed=False)
        bad = [row("Bad Name"), row("no-verb", verb="calls"), row("no-anchor-to", anchors=[{"side": "from", "path": "a", "text": "x"}]),
               row("abs-path", anchors=[{"side": "from", "path": "/a", "text": "x"}, {"side": "to", "path": "b", "text": "x"}]),
               row("live-state", code_state="live"), row("unknown-stage", stage="unknown"),
               row("demo-no-workflow", stage="demonstrated"), row("accepted-no-decision", stage="accepted"),
               row("group-end", frm="group:x/y"), row("bad-channel", channel={"kind": "carrier-pigeon", "name": "x"}),
               row("bad-hop", hop=0), "not a table", dict(good)]
        rows, problems = wires.rows({"wires": [good] + bad})
        self.assertEqual(list(rows), ["ok-wire"])
        self.assertEqual((rows["ok-wire"]["flow"], rows["ok-wire"]["hop"], rows["ok-wire"]["reviewed"]), ("f-1", 2, False))
        self.assertEqual(len(problems), 13)
        joined = "\n".join(problems)
        for needle in ("needs a name", "verb must be feeds or depends_on", "at least one anchor on each side",
                       "anchors must be a list", "code_state must be one of", "stage must be one of",
                       "needs demonstrated_by", "needs the owner decision", "anchors need a package or project end",
                       "channel needs a kind", "hop must be", "wire #13", "is named twice"):
            self.assertIn(needle, joined)
        self.assertIn("stage must be one of", wires.rows({"wires": [dict(row("plain"), stage=None)]})[1][0])
        defaults = dict(row("defaulted"))
        del defaults["stage"]
        self.assertEqual(wires.rows({"wires": [defaults]})[0]["defaulted"]["stage"], "designed")
        self.assertEqual(wires.anchors_by_repo({"a": row("a"), "b": row("b")}), {HOST: [{"path": "a", "text": "x"},
                                                                                      {"path": "b", "text": "x"}]})
        self.assertEqual((wires.repo_of(pkg("x/y")), wires.repo_of(HOST), wires.repo_of("group:a/b")), (HOST, HOST, None))


class MeasureTests(fixture.EstateTestCase):

    def test_code_state_from_anchors_and_build_state(self):
        r = row()
        cases = [
            (found(from_=["code"], to=["code"]), {}, "wired"),
            (found(from_=["code"], to=["code"]), {pkg("a"): False, pkg("b"): False}, "wired"),
            (found(from_=["code"], to=["code"]), {pkg("a"): True, pkg("b"): False}, "wired-unbuilt"),
            (found(from_=["code"], to=["code"]), {pkg("a"): None}, None),  # build state not measured
            (found(from_=["code"], to=["none"]), {}, "contradicted"),
            (found(from_=["code"], to=["code", "none"]), {}, "contradicted"),  # one anchor of a side missing
            (found(from_=["none"], to=["code", "none"]), {}, "declared"),  # neither side has all of its code
            (found(from_=["code"], to=["unread"]), {}, None),
            (found(from_=["absent"], to=["code"]), {}, "declared"),  # the producer is not built yet
            (found(from_=["code"], to=["absent"]), {}, "declared"),  # nothing consumes it yet
            (found(from_=["doc"], to=["test"]), {}, "declared"),
            (found(from_=["none"], to=["unread"]), {}, None),
            (found(from_=[None], to=["code"]), {}, None)]  # a side's checkout not searched
        for sides_, unbuilt, want in cases:
            self.assertEqual(wires.measure(r, sides_, unbuilt)[0], want, (sides_, unbuilt))
        self.assertEqual(wires.consumer_side("feeds"), "to")
        self.assertEqual(wires.consumer_side("depends_on"), "from")

    def test_stage_needs_evidence_and_decisions(self):
        self.assertEqual(wires.stage_of(row(), set()), ("designed", None))
        stage, reason = wires.stage_of(row(stage="demonstrated", demonstrated_by="wire-e2e.yml"), set())
        self.assertEqual(stage, "unknown")
        self.assertIn("wire-e2e.yml", reason)
        self.assertEqual(wires.stage_of(row(stage="accepted", decision="dec-1"), {"dec-1"})[0], "accepted")
        self.assertEqual(wires.stage_of(row(stage="active", decision="dec-2"), {"dec-1"})[0], "unknown")

    def test_the_verdict_compares_the_claim_with_measurement(self):
        wired, contradicted = row(code_state="wired"), row(code_state="contradicted")
        both, broken = found(from_=["code"], to=["code"]), found(from_=["code"], to=["none"])
        self.assertEqual(wires.verdict_of(wired, "wired", both, "designed"), "agrees")
        self.assertEqual(wires.verdict_of(wired, "contradicted", broken, "designed"), "unevidenced")
        self.assertEqual(wires.verdict_of(row(code_state="wired", verb="depends_on"), "contradicted", broken, "designed"),
                         "differs")  # depends_on: the from side consumes, and it has the code
        self.assertEqual(wires.verdict_of(wired, "wired-unbuilt", both, "designed"), "differs")
        self.assertEqual(wires.verdict_of(contradicted, "contradicted", broken, "designed"), "agrees")
        self.assertEqual(wires.verdict_of(contradicted, None, found(from_=["code"], to=["unread"]), "designed"),
                         "not-measured")
        self.assertEqual(wires.verdict_of(wired, None, found(from_=[None], to=["code"]), "designed"), "not-measured")
        self.assertEqual(wires.verdict_of(wired, None, found(from_=["code"], to=[None]), "designed"),
                         "not-measured")  # the consuming side not searched: never unevidenced
        demo = row(stage="demonstrated", demonstrated_by="wire-e2e.yml")
        self.assertEqual(wires.verdict_of(demo, "wired", both, "unknown"), "not-measured")
        self.assertEqual(wires.verdict_of(demo, "wired", both, "designed"), "differs")

    def test_measured_edges_and_flows(self):
        records = {pkg("a"): {"id": pkg("a"), "host": HOST, "name": "@x/a", "imports": {"internal": ["@x/b"]},
                              "deps": {"declared_internal": ["@x/b", "@x/c"]}, "build": {"unbuilt": False}},
                   pkg("b"): {"id": pkg("b"), "host": HOST, "name": "@x/b", "imports": {"internal": []},
                              "deps": {"declared_internal": []}, "build": {"unbuilt": True}},
                   pkg("c"): {"id": pkg("c"), "host": HOST, "name": "@x/c", "imports": {"internal": ["@x/a"]},
                              "deps": {"declared_internal": []}, "build": {"unbuilt": None}}}
        edges = {(e["from"], e["to"]): (e["basis"], e["code_state"], e["also"]) for e in wires.measured_edges(records)}
        self.assertEqual(edges, {(pkg("a"), pkg("b")): ("measured-import", "wired-unbuilt", ["measured-manifest"]),
                                 (pkg("a"), pkg("c")): ("measured-manifest", "declared", []),
                                 (pkg("c"), pkg("a")): ("measured-import", None, [])})
        hops = [{"name": "two", "flow": "f", "hop": 2, "code_state": "contradicted", "stage": "designed"},
                {"name": "one", "flow": "f", "hop": 1, "code_state": "wired", "stage": "demonstrated"},
                {"name": "lone", "flow": "g", "hop": 1, "code_state": None, "stage": "designed"}]
        self.assertEqual(wires.flows(hops), {"f": {"hops": ["one", "two"], "code_state": "contradicted", "stage": "designed"},
                                             "g": {"hops": ["lone"], "code_state": None, "stage": "designed"}})

    def test_check_exit_codes(self):
        current = {"a": row("a"), "b": row("b", code_state="contradicted")}

        def run(verdict_a, verdict_b="agrees"):
            rows_ = []
            for name, verdict in (("a", verdict_a), ("b", verdict_b)):
                then = current[name]
                rows_.append(dict(then, claimed={"code_state": then["code_state"], "stage": then["stage"]},
                                  code_state=then["code_state"], verdict=verdict, reason="r", stage_reason=None,
                                  anchors=[dict(a, found="code", files=[]) for a in then["anchors"]]))
            return {"rows": rows_}
        self.assertEqual(wires.check(run("agrees"), current, [])[0], 0)
        code, lines = wires.check(run("unevidenced"), current, [])
        self.assertEqual(code, 1)
        self.assertIn("unevidenced 1", lines[0])
        self.assertEqual(wires.check(run("differs"), current, [])[0], 10)
        self.assertEqual(wires.check(run("not-measured"), current, [])[0], 10)
        self.assertEqual(wires.check(run("agrees"), current, ["wires: a problem"])[0], 10)
        added = dict(current, c=row("c"))
        code, lines = wires.check(run("agrees"), added, [])
        self.assertEqual(code, 10)
        self.assertIn("  stale: c is not in the current run (added after the build; rebuild)", lines)
        changed = dict(current, a=row("a", code_state="declared"))
        code, lines = wires.check(run("unevidenced"), changed, [])
        self.assertEqual(code, 10)  # the run measured the old row; its verdict no longer counts
        self.assertIn("  stale: a changed after the build; the run measured the old row (rebuild)", lines)
        code, lines = wires.check(run("agrees"), {"a": current["a"]}, [])
        self.assertEqual(code, 10)
        self.assertIn("  stale: b is in the current run but no longer in curated/wires.toml (rebuild)", lines)


WIRE_ROWS = [
    {"name": "erase-to-ledger", "from": pkg("operational/data-privacy"), "verb": "feeds",
     "to": pkg("foundational/accounting"), "channel": {"kind": "event", "name": "privacy.erased"},
     "anchors": [{"side": "from", "path": "operational/data-privacy/src", "text": "export const erase"},
                 {"side": "to", "path": "foundational/accounting/src/ledger.py", "text": "def post"}],
     "code_state": "wired-unbuilt", "stage": "designed", "flow": "erasure", "hop": 1, "reviewed": False,
     "as_of": "2026-10-19"},
    {"name": "intake-to-ledger", "from": pkg("operational/intake"), "verb": "feeds", "to": pkg("foundational/accounting"),
     "channel": {"kind": "file", "name": "events.ndjson"},
     "anchors": [{"side": "from", "path": "operational/intake", "text": "post"},
                 {"side": "to", "path": "foundational/accounting/src/index.ts", "text": "export const post"}],
     "code_state": "declared", "stage": "designed", "reviewed": False}]
UNEVIDENCED = {"name": "health-to-ledger", "from": pkg("operational/insurance"), "verb": "feeds",
               "to": pkg("foundational/accounting"), "channel": {"kind": "http", "name": "GET /health"},
               "anchors": [{"side": "from", "path": "operational/insurance/src", "text": "health"},
                           {"side": "to", "path": "foundational/accounting/src", "text": "/health"}],
               "code_state": "wired", "stage": "designed", "reviewed": False}


class WireJoinTests(fixture.EstateTestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        root, _measured = fixture.make_domain_monorepo(os.path.join(cls.tmp, "domains"))
        cls.checkout = test_model.mini_checkout(root, "https://%s.git" % HOST)
        cls.curated = test_model.empty_curated()
        cls.curated["hosts"] = [test_packages.HOST_ROW]
        cls.curated["wires"] = WIRE_ROWS + [UNEVIDENCED]
        rows = wires.rows(cls.curated)[0]
        srcs = test_model.mini_sources()
        srcs["repo"] = {cls.checkout["id"]: model.read_canonical(cls.checkout, HOST, packages.host_rows(cls.curated)[0],
                                                                 wires.anchors_by_repo(rows))}
        data = {"checkouts": [cls.checkout], "artifacts": [], "coverage": {"expected": 1, "observed": 1, "errors": 0},
                "finished_at": test_model.NOW_ISO, "last_full_at": test_model.NOW_ISO, "mode": "full",
                "degraded_reasons": []}
        cls.snapshot = model.build_records(data, test_model.mini_foundation(""), srcs, cls.curated, test_model.VOCAB, None,
                                           {"kingdom": {"ref": "worktree"}}, now=test_model.NOW, home=test_model.MINI_HOME)
        cls.relations = {r["id"]: r for r in cls.snapshot["records"] if r["kind"] == "relation"}
        cls.rows = {r["name"]: r for r in cls.snapshot["wires"]["rows"]}

    def test_wires_are_relations_that_validate(self):
        self.assertEqual(model.validate(self.snapshot, test_model.VOCAB["records"], facets=FACETS)["problems"], [])
        imports = [r for r in self.relations.values() if r["basis"] == wires.MEASURED_IMPORT]
        self.assertEqual([(r["from"], r["to"], r["code_state"], r["also"]) for r in imports],
                         [(pkg("foundational/accounting"), pkg("shared/libs/messaging"), "wired", ["measured-manifest"])])
        erase = self.relations[self.rows["erase-to-ledger"]["id"]]
        self.assertEqual((erase["basis"], erase["verb"], erase["code_state"], erase["stage"], erase["verdict"],
                          erase["claimed"], erase["flow"]),
                         (wires.CURATED, "feeds", "wired-unbuilt", "designed", "agrees",
                          {"code_state": "wired-unbuilt", "stage": "designed"}, "erasure"))
        self.assertEqual(erase["anchors"][0]["files"], ["operational/data-privacy/src/index.ts"])
        privacy = next(r for r in self.snapshot["records"] if r["id"] == pkg("operational/data-privacy"))
        self.assertIn(erase["id"], privacy["relations"])

    def test_an_end_not_built_yet_is_measured_but_gives_no_record(self):
        intake = self.rows["intake-to-ledger"]
        self.assertEqual((intake["id"], intake["ends"], intake["code_state"], intake["verdict"]),
                         (None, {"from": False, "to": True}, "declared", "agrees"))
        self.assertEqual(intake["anchors"][0]["found"], "absent")

    def test_an_unevidenced_claim_is_queued_and_the_channel_is_part_of_the_id(self):
        health = self.rows["health-to-ledger"]
        self.assertEqual((health["code_state"], health["verdict"]), ("contradicted", "unevidenced"))
        queued = [(q["reason"], q["id"]) for q in self.snapshot["queue"] if q["reason"].startswith("wire-")]
        self.assertEqual(queued, [("wire-unevidenced", "health-to-ledger")])
        self.assertEqual(self.snapshot["wires"]["verdicts"], {"agrees": 2, "unevidenced": 1})
        self.assertEqual(self.snapshot["wires"]["flows"]["erasure"]["code_state"], "wired-unbuilt")
        plain = "rel:" + model.safety.sha12("%s|feeds|%s" % (pkg("operational/insurance"), pkg("foundational/accounting")))
        self.assertNotIn(plain, self.relations)
        self.assertIn(health["id"], self.relations)


class CommandLineWireTests(fixture.EstateTestCase):
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
        fixture.make_domain_monorepo(os.path.join(e.desktop, "fixture-domains"), home=e.home, remote="https://%s.git" % HOST)
        fixture.write_file(os.path.join(e.layer, "curated", "capabilities.toml"),
                           "# fixture\n" + model.safety.toml_dumps({"host": [test_packages.HOST_ROW]}))
        cls.wire_file = os.path.join(e.layer, wires.FILE)
        fixture.write_file(cls.wire_file, model.safety.toml_dumps({"wire": WIRE_ROWS}))
        cls.accept = test_e2e.cli(e.layer, "accept-vocab", "--write")
        cls.first = test_e2e.cli(e.layer, "build")
        cls.agreeing = test_e2e.cli(e.layer, "check", "--wires")
        run_dir = os.path.realpath(os.path.join(e.private, "current"))
        cls.atlas = test_e2e.read_text(os.path.join(run_dir, "ATLAS.md"))
        cls.full = test_e2e.read_text(os.path.join(run_dir, "CAPABILITIES.md"))
        cls.run_doc = test_e2e.read_json(os.path.join(run_dir, "run.json"))
        fixture.write_file(cls.wire_file, model.safety.toml_dumps({"wire": WIRE_ROWS + [UNEVIDENCED]}))
        cls.stale = test_e2e.cli(e.layer, "check", "--wires")
        cls.second = test_e2e.cli(e.layer, "build", "--reuse-census")
        cls.unevidenced = test_e2e.cli(e.layer, "check", "--wires")
        changed = json.loads(json.dumps(WIRE_ROWS))
        changed[0]["code_state"] = "wired"
        fixture.write_file(cls.wire_file, model.safety.toml_dumps({"wire": changed}))
        cls.third = test_e2e.cli(e.layer, "build", "--reuse-census")
        cls.differs = test_e2e.cli(e.layer, "check", "--wires")

    def test_check_wires_exits_by_the_worst_verdict(self):
        for result in (self.first, self.second, self.third):
            self.assertIn(result[0], (0, 10), result[1] + result[2])
            self.assertNotIn("failed validation", result[1] + result[2])
        self.assertIn("  wires: 2 curated · verdicts agrees 2 · package imports wired 1 · declared only 0 "
                      "(estate check --wires)", self.first[1])
        code, out, err = self.agreeing
        self.assertEqual(code, 0, out + err)
        self.assertIn("check --wires: 2 curated wires: agrees 2 (run ", out)
        code, out, _err = self.stale
        self.assertEqual(code, 10)
        self.assertIn("stale: health-to-ledger is not in the current run", out)
        code, out, _err = self.unevidenced
        self.assertEqual(code, 1)
        self.assertIn("unevidenced  health-to-ledger: claimed wired, designed; measured contradicted, designed", out)
        code, out, _err = self.differs
        self.assertEqual(code, 10)
        self.assertIn("differs      erase-to-ledger: claimed wired, designed; measured wired-unbuilt, designed", out)

    def test_the_run_and_the_views_carry_the_wires(self):
        self.assertEqual(self.run_doc["wires"]["verdicts"], {"agrees": 2})
        self.assertEqual(self.run_doc["wires"]["measured"]["measured-import"], {"wired": 1})
        business = self.atlas[self.atlas.index("\n## Business (secondary)"):self.atlas.index("\n## Freshness")]
        self.assertIn("### Wires", business)
        self.assertIn("| erase-to-ledger | operational/data-privacy | foundational/accounting | event privacy.erased | "
                      "wired-unbuilt, designed | wired-unbuilt | designed | agrees | erasure 1 |", business)
        self.assertIn("operational/intake (not in this run)", business)
        self.assertIn("Flow erasure: erase-to-ledger; its worst hop reads wired-unbuilt", business)
        self.assertIn("| to | foundational/accounting/src/ledger.py | def post | code | foundational/accounting/src/ledger.py |",
                      self.full)


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
