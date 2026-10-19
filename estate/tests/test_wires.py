"""Wire tests (tool/wires.py, sources.find_anchors): wires on the relation record kind.

Anchors are re-found in tracked files with comments stripped, and a hit counts as code only outside
tests and documents. A curated row's code_state is measured from its anchors and its end packages'
build state (wired, wired-unbuilt, declared, contradicted, or None when what decides it was not read);
its stage reads designed; demonstrated only when the latest run on main of the workflow it names is read
green, through one allowlisted, read-only gh call per workflow (a fake transport in the unit tests and a
stub gh on the command line, so no test touches the network), designed when that run is red or absent,
and unknown when it was not read; accepted or active only with an owner decision. Nothing gh prints
beyond the run's checked fields is kept. The verdict compares claim and measurement, and check --wires exits
1 when a curated wired claim has no consuming code and 10 when another state differs, could not be
measured or the row changed after the build. Measured depends_on edges come from package imports and
manifests. A designed wire may name an end not built yet: it is measured and shown, but gives no
relation record."""
import json
import os
import tomllib

from . import fixture
from . import test_e2e
from . import test_model
from . import test_packages
import curate
import model
import packages
import safety
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


# One `gh run list --json ...` row as gh prints it (with fields the reader drops), and what it keeps.
GREEN = {"databaseId": 42, "status": "completed", "conclusion": "success", "headSha": "a" * 40, "event": "push",
         "createdAt": "2026-10-19T00:00:00Z", "url": "https://github.com/cambridgetcg/fixture-domains/actions/runs/42",
         "displayTitle": "dropped"}
RUN = {"id": 42, "status": "completed", "conclusion": "success", "head_sha": "a" * 40, "event": "push",
       "created_at": "2026-10-19T00:00:00Z"}


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

    def test_the_seed_rows_are_clean_unreviewed_and_the_first_wire_only_designed(self):
        path = os.path.join(fixture.LAYER_DIR, wires.FILE)
        with open(path, encoding="utf-8") as stream:
            text = stream.read()
        self.assertEqual(curate.lint_text(text, wires.FILE, curate.scope_of(wires.FILE)), [])
        raw = tomllib.loads(text)["wire"]
        rows, problems = wires.rows({"wires": raw})
        self.assertEqual((problems, len(rows)), ([], len(raw)))
        self.assertEqual({r["reviewed"] for r in raw}, {False})
        sale = rows["sale-to-ledger"]
        self.assertEqual((sale["stage"], sale["code_state"], sale["flow"]), ("designed", "declared", "sale-to-ledger"))
        self.assertNotIn("demonstrated_by", sale)
        self.assertEqual({r["stage"] for r in rows.values()}, {"designed"})
        for item in rows.values():
            for end in (item["from"], item["to"]):
                self.assertTrue(end.startswith("pkg:github.com/cambridgetcg/business-ecosystem//"), end)

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
        self.assertEqual(wires.stage_of(row(), set()), ("designed", None, None))
        demo = row(stage="demonstrated", demonstrated_by="wire-e2e.yml")
        stage, reason, run = wires.stage_of(demo, set())
        self.assertEqual((stage, run), ("unknown", None))
        self.assertIn("the latest run of wire-e2e.yml on main was not read (build --forge reads it)", reason)
        key = wires.run_key(HOST, "wire-e2e.yml")  # the repository of the consuming side

        def runs(read="read", reason=None, **fields):
            return {"runs": {key: {"status": read, "reason": reason,
                                   "run": dict(RUN, **fields) if read == "read" else None}}}
        cases = [(runs(), "demonstrated", "run 42 of 2026-10-19T00:00:00Z at aaaaaaaaaaaa, is green"),
                 (runs(conclusion="failure"), "designed", "concluded failure"),
                 (runs(status="in_progress", conclusion=None), "unknown", "is in_progress"),
                 (runs("none", "no run of wire-e2e.yml on main"), "designed", "wire-e2e.yml has no run on main"),
                 (runs("error", "gh exited 4"), "unknown", "could not be read: gh exited 4"),
                 ({"runs": {}}, "unknown", "could not be read: not requested")]
        for given, want, text in cases:
            stage, reason, _run = wires.stage_of(demo, set(), given)
            self.assertEqual(stage, want, given)
            self.assertIn(text, reason)
        self.assertEqual(wires.stage_of(demo, set(), runs())[2], RUN)
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
        self.assertEqual(wires.verdict_of(demo, "wired", both, "demonstrated"), "agrees")

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


def answer(items=None, code=0, err="", timed_out=False):
    """A safety.Result as gh would return it: items printed as JSON on success."""
    raw = b"" if items is None else json.dumps(items).encode("utf-8")
    return safety.Result(code == 0 and not timed_out, raw.decode("utf-8"), err, None if timed_out else code,
                         timed_out, raw)


def transport(*answers):
    """(call, calls): a fake gh transport answering in order and recording each argv; never the network."""
    calls, replies = [], list(answers)

    def call(argv):
        calls.append(list(argv))
        return replies.pop(0)
    return call, calls


class WorkflowRunTests(fixture.EstateTestCase):

    def test_one_allowlisted_read_only_call_per_workflow(self):
        call, calls = transport(answer([GREEN]))
        out = sources.workflow_runs([(HOST, "wire-e2e.yml"), (HOST, "wire-e2e.yml")], allow_network=True, transport=call)
        self.assertEqual(calls, [["run", "list", "--repo", "cambridgetcg/fixture-domains", "--workflow", "wire-e2e.yml",
                                  "--branch", "main", "--limit", "1", "--json",
                                  "databaseId,status,conclusion,headSha,event,createdAt"]])
        self.assertEqual(out["runs"], {HOST + "|wire-e2e.yml": {"status": "read", "reason": None, "run": RUN}})
        self.assertEqual(out["status"], "ok")

    def test_nothing_is_called_without_network_or_outside_the_allowlist(self):
        call, calls = transport()
        self.assertEqual(sources.workflow_runs([(HOST, "wire-e2e.yml")], transport=call)["status"], "skipped")
        refused = [("codeberg.org/zerone-dev/ai-love", "ci.yml"), (HOST, "../ci.yml"), (HOST, "ci.yml --web"),
                   (HOST, ".github/workflows/ci.yml"), (HOST, "ci"), ("github.com/cambridgetcg", "ci.yml")]
        out = sources.workflow_runs(refused, allow_network=True, transport=call)
        self.assertEqual(calls, [])
        self.assertEqual(len(out["runs"]), len(refused))
        self.assertEqual({item["status"] for item in out["runs"].values()}, {"refused"})
        self.assertEqual(out["status"], "partial")

    def test_a_failure_keeps_only_the_estates_own_words(self):
        shaped = "gh" + "p_" + "Q7" * 18  # shaped like a gh credential, built at run time; nothing kept may hold it
        answers = [answer(code=4, err="HTTP 401: Bad credentials " + shaped), answer(timed_out=True, err=shaped),
                   answer(code=None, err="gh not found on PATH"), safety.Result(True, shaped, "", 0, False, shaped.encode()),
                   answer([]), answer([{"databaseId": "42", "status": "completed"}]),
                   answer([dict(GREEN, status="in_progress", conclusion="")]), answer([dict(GREEN, headSha=shaped)])]
        call, _calls = transport(*answers)
        names = ["w%d.yml" % i for i in range(len(answers))]
        out = sources.workflow_runs([(HOST, name) for name in names], allow_network=True, transport=call)
        got = [(out["runs"][HOST + "|" + name]["status"], out["runs"][HOST + "|" + name]["reason"]) for name in names]
        self.assertEqual(got, [("error", "gh exited 4"), ("error", "timeout after %ss" % sources.GH_TIMEOUT),
                               ("error", "gh not found on PATH"), ("invalid", "gh printed no JSON list"),
                               ("none", "no run of w4.yml on main"),
                               ("invalid", "the run gh printed is not of the expected shape"), ("read", None),
                               ("invalid", "the run gh printed is not of the expected shape")])
        self.assertEqual(out["runs"][HOST + "|w6.yml"]["run"], dict(RUN, status="in_progress", conclusion=None))
        self.assertNotIn(shaped, json.dumps(out))
        self.assertEqual(out["status"], "partial")

    def test_read_runs_asks_only_for_demonstrated_claims_in_host_repositories(self):
        elsewhere = "github.com/cambridgetcg/elsewhere"
        rows_ = {"demo": row("demo", stage="demonstrated", demonstrated_by="wire-e2e.yml"),
                 "plain": row("plain", demonstrated_by="other.yml"),  # designed: nothing to read
                 "away": row("away", to=elsewhere, stage="demonstrated", demonstrated_by="ci.yml")}
        call, calls = transport(answer([GREEN]))
        self.assertIsNone(wires.read_runs(rows_, {HOST: {}}, transport=call))  # no --forge: nothing read
        out = wires.read_runs(rows_, {HOST: {}}, allow_network=True, transport=call)
        self.assertEqual([argv[3] for argv in calls], ["cambridgetcg/fixture-domains"])
        self.assertEqual(out["runs"][wires.run_key(HOST, "wire-e2e.yml")]["status"], "read")
        away = out["runs"][wires.run_key(elsewhere, "ci.yml")]
        self.assertEqual((away["status"], away["reason"]), ("refused", "%s is not a host repository ([[host]] row)"
                                                            % elsewhere))
        self.assertEqual(out["status"], "partial")
        self.assertEqual(wires.stage_of(rows_["demo"], set(), out)[0], "demonstrated")
        self.assertEqual(wires.stage_of(rows_["away"], set(), out)[0], "unknown")
        summary = wires.summary([], [], [], out)
        self.assertEqual(summary["runs"]["runs"][wires.run_key(HOST, "wire-e2e.yml")], {"status": "read", "reason": None,
                                                                                       "run": RUN})
        self.assertIsNone(wires.summary([], [], [])["runs"])


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


class CommandLineForgeRunTests(fixture.EstateTestCase):
    """build --forge reads the latest run on main of the workflow a demonstrated wire names through a
    stub gh (no network): green demonstrates it, red leaves it designed, a failed call leaves it unknown
    and degrades the run, and nothing the stub prints on failure is kept or shown."""
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
        fixture.make_domain_monorepo(os.path.join(e.desktop, "fixture-domains"), home=e.home, remote="https://%s.git" % HOST)
        fixture.write_file(os.path.join(e.layer, "curated", "capabilities.toml"),
                           "# fixture\n" + model.safety.toml_dumps({"host": [test_packages.HOST_ROW]}))
        demo = dict(WIRE_ROWS[0], stage="demonstrated", demonstrated_by="wire-e2e.yml")
        fixture.write_file(os.path.join(e.layer, wires.FILE), model.safety.toml_dumps({"wire": [demo, WIRE_ROWS[1]]}))
        cls.shaped = "gh" + "p_" + "Q7" * 18  # shaped like a gh credential, built at run time
        runs, fail = os.path.join(e.tmp, "gh-runs.json"), os.path.join(e.tmp, "gh-fail")
        fixture.stub_bin("gh", (
            "# synthetic gh: the forge listing, and `gh run list` from a canned file or a failure\n"
            "if [ \"$1\" = repo ] && [ \"$2\" = list ]; then cat '%s'; exit 0; fi\n"
            "if [ \"$1\" = run ] && [ \"$2\" = list ]; then\n"
            "  if [ -e '%s' ]; then echo 'HTTP 401: Bad credentials %s' >&2; echo '%s'; exit 4; fi\n"
            "  cat '%s'; exit 0\n"
            "fi\n"
            "exit 1") % (e.listing_gh, fail, cls.shaped, cls.shaped, runs), e.bin_dir)
        test_e2e.cli(e.layer, "accept-vocab", "--write")
        cls.offline = cls.step("build")
        fixture.write_file(runs, json.dumps([GREEN]))
        before = len(fixture.spawned())
        cls.green = cls.step("build", "--reuse-census", "--forge")
        cls.green_calls = [argv[1:] for argv in fixture.spawned()[before:] if os.path.basename(argv[0]) == "gh"]
        fixture.write_file(runs, json.dumps([dict(GREEN, databaseId=43, conclusion="failure")]))
        cls.red = cls.step("build", "--reuse-census", "--forge")
        fixture.write_file(fail, "")
        cls.failed = cls.step("build", "--reuse-census", "--forge")

    @classmethod
    def step(cls, *argv):
        """One build and check --wires after it, with the run they read."""
        built = test_e2e.cli(cls.layer, *argv)
        checked = test_e2e.cli(cls.layer, "check", "--wires")
        run_dir = os.path.realpath(os.path.join(cls.private, "current"))
        return {"build": built, "check": checked, "dir": run_dir,
                "run": test_e2e.read_json(os.path.join(run_dir, "run.json")),
                "erase": next(r for r in test_e2e.read_json(os.path.join(run_dir, "run.json"))["wires"]["rows"]
                              if r["name"] == "erase-to-ledger")}

    def test_only_a_green_run_read_by_build_forge_demonstrates_a_wire(self):
        for step in (self.offline, self.green, self.red, self.failed):
            self.assertIn(step["build"][0], (0, 10), step["build"][1] + step["build"][2])
            self.assertNotIn("failed validation", step["build"][1] + step["build"][2])
        erase = self.offline["erase"]
        self.assertEqual((erase["stage"], erase["verdict"], erase["run"]), ("unknown", "not-measured", None))
        self.assertIn("was not read (build --forge reads it)", erase["stage_reason"])
        self.assertEqual(self.offline["check"][0], 10)
        erase = self.green["erase"]
        self.assertEqual((erase["stage"], erase["verdict"], erase["run"]), ("demonstrated", "agrees", RUN))
        code, out, err = self.green["check"]
        self.assertEqual(code, 0, out + err)
        self.assertIn("agrees 2", out)
        erase = self.red["erase"]
        self.assertEqual((erase["stage"], erase["verdict"], erase["run"]["conclusion"]), ("designed", "differs", "failure"))
        self.assertEqual(self.red["check"][0], 10)
        self.assertIn("differs      erase-to-ledger: claimed wired-unbuilt, demonstrated; measured wired-unbuilt, designed",
                      self.red["check"][1])
        records = test_e2e.jsonl(os.path.join(self.red["dir"], "records.jsonl"))[1:]
        relation = next(r for r in records if r.get("name") == "erase-to-ledger")
        self.assertEqual((relation["stage"], relation["run"]["id"]), ("designed", 43))
        atlas = test_e2e.read_text(os.path.join(self.green["dir"], "ATLAS.md"))
        self.assertIn("| demonstrated (run 42) | agrees |", atlas)

    def test_one_allowlisted_call_and_a_failure_keeps_nothing_gh_printed(self):
        runs = [argv for argv in self.green_calls if argv[:2] == ["run", "list"]]
        self.assertEqual(runs, [["run", "list", "--repo", "cambridgetcg/fixture-domains", "--workflow", "wire-e2e.yml",
                                 "--branch", "main", "--limit", "1", "--json",
                                 "databaseId,status,conclusion,headSha,event,createdAt"]])
        self.assertEqual([argv[:2] for argv in self.green_calls], [["repo", "list"], ["run", "list"]])
        erase = self.failed["erase"]
        self.assertEqual((erase["stage"], erase["verdict"]), ("unknown", "not-measured"))
        self.assertIn("could not be read: gh exited 4", erase["stage_reason"])
        reason = "workflow run %s|wire-e2e.yml via gh: error (gh exited 4)" % HOST
        self.assertIn(reason, self.failed["run"]["degraded_reasons"])
        self.assertEqual(self.failed["build"][0], 10)
        for step in (self.green, self.red, self.failed):
            self.assertNotIn(self.shaped, "".join(step["build"][1:]) + "".join(step["check"][1:]))
        for base, _dirs, files in os.walk(self.private):
            for name in files:
                path = os.path.join(base, name)
                if os.path.islink(path):
                    continue
                with open(path, "rb") as stream:
                    self.assertNotIn(self.shaped.encode("utf-8"), stream.read(), path)


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
