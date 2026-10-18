"""Hygiene plan tests (owner decision D8, tool/hygiene.py).

Unit cases cover the plan check, the merge by stable item id (owner status kept, an item the plan
drops kept and marked missing, the baseline only ever growing), the owner status change and its
diff, and the join with a run's own measurements: a baseline signal that has cleared reads "no
longer observed", one the run cannot measure reads "unknown now", never clean. One synthetic estate
then imports a plan, builds, loses a secret-bearing file, builds again and is driven through the
command line: HYGIENE.md, the atlas section, the listing filters, --set with its 0400 backup, a
re-import, and the privacy boundary (nothing of the plan outside the private area). Item ids and
titles here are synthetic."""
import copy
import json
import os
import stat
import urllib.parse

from . import fixture
from . import test_decisions
from . import test_e2e
import curate
import decisions
import hygiene
import render
import safety

D8 = "dec-2026-10-17-9"
OBSERVED_AT = "2026-10-18T00:00:00+01:00"
RUN = {"id": "20261017T220000Z-aaaa", "observed_at": "2026-10-17T22:00:00Z"}
UNSAVED, UNPUSHED, SECRET_PATH = (curate.RISKS[k] for k in ("unsaved", "unpushed", "secret-path"))
# A note shaped like a provider key, built in parts so this file passes the privacy lint.
KEYLIKE_NOTE = "rotated to " + "AK" + "IA" + "ABCDEFGHIJKLMNOP"


def item(ident, area, severity="P1", status="open", wave="Now", related=(), title=None):
    return {"id": ident, "title": title or "Fixture issue " + ident, "area": area, "severity": severity,
            "status": status, "where": ["a place"], "evidence": "seen once", "risk": "some harm",
            "actions": ["do the thing"], "agent_safe": True, "needs_yu": False, "reversible": True,
            "effort": "minutes", "depends_on": [], "related_records": list(related), "related_items": [],
            "lens_ids": ["fx-1"], "who": "Agent-safe", "wave": wave, "group": "group " + wave}


def plan_doc(items, observed=OBSERVED_AT):
    waves = {}
    for entry in items:
        waves.setdefault(entry["wave"], []).append(entry["id"])
    return {"schema": hygiene.PLAN_SCHEMA, "observed_at": observed, "generated_at": observed,
            "measured_window": "a synthetic evening",
            "severity_scale": {"P0": "act now", "P1": "this week", "P2": "this month", "P3": "tidy-up"},
            "waves": [{"name": name, "items": len(ids), "groups": [{"name": "group " + name, "note": "", "items": ids}]}
                      for name, ids in waves.items()],
            "top10": ["the first thing to do"], "items": copy.deepcopy(items),
            "refuted": [{"id": "fx-9", "why": "a false positive"}], "not_checked": ["provider-side validity"]}


def sched(sid, state, presence="present"):
    return {"kind": "scheduler", "id": sid, "presence": presence, "tcc_exposed": False,
            "health": {"state": state, "basis": "launchctl last exit 1"}}


def art(aid, status, secret=True):
    return {"kind": "artifact", "id": aid, "secret_bearing": secret, "status": status, "presence": "present"}


def proj(pid, risks=(), measured=1, presence="present"):
    return {"kind": "project", "id": pid, "risks": list(risks), "presence": presence,
            "measures": {"measured_checkouts": measured}}


def account(aid, status=None, creds=()):
    return {"kind": "account", "id": aid, "credential_artifacts": list(creds), "used_by": [], "owns": [],
            "decided_status": status}


def by_id(*records):
    return {r["id"]: r for r in records}


JOB = "sched:launchd:fixture.backup"
KEYS = "artifact:fixture-keyring"
REPO = "github.com/cambridgetcg/fixture-repo"
ITEMS = [item("H-fixture-backup-job", "automation", "P0", related=[JOB]),
         item("H-fixture-keys", "secrets", "P0", related=[KEYS, REPO]),
         item("H-fixture-repo-work", "durability", "P2", wave="This week", related=[REPO]),
         item("H-fixture-handover", "cloud", "P1", status="in-progress-elsewhere", related=["account:aws:old"]),
         item("H-fixture-unmapped", "paperwork", "P3", status="mitigated", wave="Tidy-up", related=[REPO])]
BEFORE = by_id(sched(JOB, "failing"), art(KEYS, "present"), proj(REPO, [UNSAVED, SECRET_PATH]),
               account("account:aws:old", {"status": "in-progress-elsewhere", "decision": "dec-2026-10-17-7"}))


def imported(items=ITEMS, records=BEFORE):
    doc, _counts, _notes = hygiene.merge(plan_doc(items), None, records, RUN, "0" * 8, "2026-10-18T00:10:00Z")
    return doc


class PlanCheckTests(fixture.EstateTestCase):

    def test_a_valid_plan_has_no_problems_and_notes_what_it_cannot_join(self):
        plan = plan_doc(ITEMS)
        self.assertEqual(hygiene.plan_problems(plan), [])
        plan["items"][0]["depends_on"] = ["H-fixture-nowhere"]
        notes = hygiene.plan_notes(plan)
        self.assertIn("H-fixture-backup-job depends_on H-fixture-nowhere, which is not an item", notes)
        self.assertTrue(any("paperwork" in n for n in notes))

    def test_structure_and_enums_are_refused(self):
        plan = plan_doc(ITEMS + [dict(ITEMS[0])])
        plan["items"][1]["severity"] = "P9"
        plan["items"][2]["status"] = "maybe"
        plan["items"][3]["wave"] = "Someday"
        plan["items"][4]["where"] = "one place"
        problems = hygiene.plan_problems(plan)
        for expected in ("H-fixture-backup-job appears twice", "severity 'P9'", "status 'maybe'", "wave 'Someday'",
                         "where must be a list of strings"):
            self.assertTrue(any(expected in p for p in problems), (expected, problems))
        self.assertEqual(hygiene.plan_problems(dict(plan_doc(ITEMS), schema="other/1"))[0][:6], "schema")


class MergeTests(fixture.EstateTestCase):

    def test_a_first_import_keeps_the_plan_verbatim_and_takes_a_baseline(self):
        plan = plan_doc(ITEMS)
        doc, counts, _notes = hygiene.merge(plan, None, BEFORE, RUN, "0" * 8, "2026-10-18T00:10:00Z")
        self.assertEqual(hygiene.doc_problems(doc), [])
        self.assertEqual(counts["added"], len(ITEMS))
        self.assertEqual([i["plan"] for i in doc["items"]], plan["items"])
        self.assertEqual(doc["plan"]["observed_at"], OBSERVED_AT)
        self.assertNotIn("items", doc["plan"])
        self.assertEqual(doc["imports"][-1]["observed_at"], OBSERVED_AT)
        self.assertEqual(doc["imports"][-1]["baseline_run"], RUN["id"])
        base = {i["id"]: {(b["record"], b["check"]) for b in i["baseline"]} for i in doc["items"]}
        self.assertEqual(base["H-fixture-backup-job"], {(JOB, "failing")})
        self.assertEqual(base["H-fixture-keys"], {(KEYS, "secret-file"), (REPO, "risk:" + SECRET_PATH)})
        self.assertEqual(base["H-fixture-repo-work"], {(REPO, "risk:" + UNSAVED)})
        self.assertEqual(base["H-fixture-unmapped"], set())  # an area with no estate check

    def test_a_reimport_keeps_owner_status_and_marks_a_dropped_item_missing(self):
        doc = imported()
        doc, _before, _after = hygiene.set_status(doc, "H-fixture-repo-work", "in-progress", "started", "2026-10-18T01:00:00Z")
        later = [dict(ITEMS[0], title="Fixture issue, reworded"), ITEMS[1], item("H-fixture-new", "repos", "P3"),
                 ITEMS[3], ITEMS[4]]
        new, counts, _notes = hygiene.merge(plan_doc(later, "2026-10-20T00:00:00Z"), doc, by_id(sched(JOB, "healthy")),
                                            dict(RUN, id="20261019T000000Z-bbbb"), "1" * 8, "2026-10-20T00:10:00Z")
        self.assertEqual((counts["added"], counts["updated"], counts["unchanged"], counts["missing"]), (1, 1, 3, 1))
        items = {i["id"]: i for i in new["items"]}
        dropped = items["H-fixture-repo-work"]
        self.assertEqual(dropped["missing_since"], "2026-10-20T00:00:00Z")
        self.assertEqual(dropped["owner"]["status"], "in-progress")  # kept, never silently dropped
        self.assertEqual(items["H-fixture-backup-job"]["plan"]["title"], "Fixture issue, reworded")
        self.assertEqual(items["H-fixture-backup-job"]["first_seen"], OBSERVED_AT)
        # The baseline only grows: the job now healthy keeps the failing signal first seen.
        self.assertEqual([b["check"] for b in items["H-fixture-backup-job"]["baseline"]], ["failing"])
        self.assertEqual(len(new["imports"]), 2)
        back, counts, _notes = hygiene.merge(plan_doc(ITEMS, "2026-10-21T00:00:00Z"), new, {}, RUN, "2" * 8, "x")
        self.assertEqual(counts["returned"], 1)
        self.assertIsNone({i["id"]: i for i in back["items"]}["H-fixture-repo-work"]["missing_since"])
        self.assertEqual(len(back["items"]), len(ITEMS) + 1)  # the new item is now missing, not gone

    def test_the_same_plan_again_changes_nothing(self):
        doc = imported()
        again, counts, _notes = hygiene.merge(plan_doc(ITEMS), doc, BEFORE, RUN, "0" * 8, "2026-10-19T00:00:00Z")
        self.assertIs(again, doc)
        self.assertEqual(counts["unchanged"], len(ITEMS))


class StatusTests(fixture.EstateTestCase):

    def test_set_records_the_owner_status_with_a_log_and_a_diff(self):
        doc = imported()
        new, before, after = hygiene.set_status(doc, "H-fixture-keys", "done", "moved to the vault", "2026-10-18T02:00:00Z")
        self.assertEqual(hygiene.effective(after), ("done", "owner"))
        self.assertEqual(after["log"][-1], {"at": "2026-10-18T02:00:00Z", "from": "open", "to": "done",
                                            "note": "moved to the vault", "by": hygiene.SET_BY})
        self.assertIsNone(before["owner"])
        self.assertEqual(hygiene.doc_problems(new), [])
        diff = hygiene.status_diff(before, after)
        self.assertIn('- "owner": null', diff)
        self.assertIn('+  "status": "done"', diff)
        self.assertTrue(diff.endswith("}\n"))
        self.assertNotIn("evidence", diff)  # the plan's words are not part of the diff
        self.assertIsNone(doc["items"][1]["owner"])  # the input document is not mutated
        same, b2, a2 = hygiene.set_status(new, "H-fixture-keys", "done", None, "later")
        self.assertIs(a2, b2)

    def test_unknown_ids_statuses_and_secret_shaped_notes_are_refused(self):
        doc = imported()
        for args in (("H-fixture-nowhere", "done", None), ("H-fixture-keys", "mitigated", None),
                     ("H-fixture-keys", "done", KEYLIKE_NOTE)):
            with self.assertRaises(safety.GuardError):
                hygiene.set_status(doc, *args, "now")


class JoinTests(fixture.EstateTestCase):

    def joined(self, records, doc=None, decision=D8):
        view = hygiene.join(doc or imported(), None, list(records.values()), decision, "run-now")
        return view, {i["id"]: i for i in view["items"]}

    def test_cleared_signals_read_no_longer_observed(self):
        after = by_id(sched(JOB, "healthy"), art(KEYS, "missing"), proj(REPO), BEFORE["account:aws:old"])
        view, items = self.joined(after)
        self.assertEqual(items["H-fixture-backup-job"]["join"]["verdict"], hygiene.CLEARED)
        self.assertEqual(items["H-fixture-repo-work"]["join"]["verdict"], hygiene.CLEARED)
        # The secret-bearing path is confirmed by curation only: its absence is never measured.
        keys = items["H-fixture-keys"]["join"]
        self.assertEqual(keys["verdict"], hygiene.UNKNOWN_NOW)
        self.assertEqual([c["record"] for c in keys["cleared"]], [KEYS])
        self.assertEqual(view["counts"]["open_cleared"], 2)

    def test_a_signal_still_there_or_unmeasurable_is_never_clean(self):
        view, items = self.joined(BEFORE)
        self.assertEqual(items["H-fixture-backup-job"]["join"]["verdict"], hygiene.OBSERVED)
        gone = by_id(art(KEYS, "missing"), BEFORE["account:aws:old"])  # the job and repo are not in this run
        view, items = self.joined(gone)
        self.assertEqual(items["H-fixture-backup-job"]["join"]["verdict"], hygiene.UNKNOWN_NOW)
        self.assertEqual(items["H-fixture-backup-job"]["join"]["not_in_run"], [JOB])
        removed = by_id(sched(JOB, "failing", presence="gone"))
        view, items = self.joined(removed)
        self.assertEqual(items["H-fixture-backup-job"]["join"]["verdict"], hygiene.CLEARED)  # the job was removed
        unknown_health = by_id(sched(JOB, "unknown"))
        view, items = self.joined(unknown_health)
        self.assertEqual(items["H-fixture-backup-job"]["join"]["verdict"], hygiene.UNKNOWN_NOW)

    def test_areas_without_checks_and_clean_checks_say_so(self):
        clean = imported(records=by_id(proj(REPO)))
        view, items = self.joined(by_id(proj(REPO)), clean)
        self.assertEqual(items["H-fixture-repo-work"]["join"]["verdict"], hygiene.NOT_OBSERVED)
        self.assertEqual(items["H-fixture-unmapped"]["join"]["verdict"], hygiene.NOT_MEASURED)
        self.assertIsNone(items["H-fixture-unmapped"]["join"]["checks"])
        unmeasured = by_id(proj(REPO, measured=0))
        view, items = self.joined(unmeasured, imported(records=unmeasured))
        self.assertEqual(items["H-fixture-repo-work"]["join"]["verdict"], hygiene.NOT_MEASURED)

    def test_in_progress_elsewhere_is_shown_with_the_deciding_account(self):
        view, items = self.joined(BEFORE)
        handover = items["H-fixture-handover"]
        self.assertEqual(handover["status"], hygiene.ELSEWHERE)
        self.assertEqual(handover["join"]["elsewhere"], [{"record": "account:aws:old", "status": "in-progress-elsewhere",
                                                          "decision": "dec-2026-10-17-7", "account": "account:aws:old"}])
        self.assertEqual(view["counts"]["elsewhere"], 1)

    def test_a_missing_or_broken_file_is_reported_not_hidden(self):
        none = hygiene.join(None, "missing", [], D8)
        self.assertEqual(none["status"], "none")
        self.assertIn(D8, none["degraded"])
        self.assertIsNone(hygiene.join(None, "missing", [], None)["degraded"])
        broken = hygiene.join(None, "invalid json: x", [], None)
        self.assertEqual(broken["status"], "invalid")
        self.assertTrue(broken["degraded"])


class ReviewFixTests(fixture.EstateTestCase):
    """U6, U7, U8: owner filters, reference ids, and the P0 list without closed items."""

    def test_reference_ids_resolve_against_the_curation_not_the_run(self):
        curated = {"owner_decisions": [{"id": "dec-2026-10-17-7", "label": "D6", "subject": "fixture subject"}],
                   "questions": [{"id": "q:fixture", "status": "partly-decided", "decided_by": ["dec-2026-10-17-7"]}]}
        refs = hygiene.reference_status(curated)
        entry = imported([item("H-fixture-refs", "cloud", related=["q:fixture", "dec-2026-10-17-7", "q:gone",
                                                                     "account:fixture-missing"])])["items"][0]
        joined = hygiene.join_item(entry, {}, {}, refs)
        self.assertEqual(joined["not_in_run"], ["account:fixture-missing"])
        self.assertEqual([(r["id"], r["status"]) for r in joined["references"]], [
            ("q:fixture", "partly-decided by dec-2026-10-17-7"), ("dec-2026-10-17-7", "owner decision D6: fixture subject"),
            ("q:gone", "not in the curation")])

    def test_owner_filters_and_the_allowed_values(self):
        entries = [dict(item("H-fixture-yu", "cloud"), needs_yu=True, agent_safe=False),
                   item("H-fixture-agent", "secrets", wave="This week")]
        doc = imported(entries)
        view = hygiene.join(doc, None, [], None, "run-now")
        self.assertEqual([i["id"] for i in hygiene.filtered(view["items"], needs_yu=True)], ["H-fixture-yu"])
        self.assertEqual([i["id"] for i in hygiene.filtered(view["items"], agent_safe=True)], ["H-fixture-agent"])
        self.assertEqual([i["id"] for i in hygiene.filtered(view["items"], wave="this WEEK")], ["H-fixture-agent"])
        allowed = hygiene.filter_values(doc)
        self.assertEqual(allowed["wave"], ["Now", "This week"])
        self.assertEqual(allowed["area"], ["cloud", "secrets"])
        self.assertEqual([(label, len(group)) for label, group in hygiene.owner_split(view["items"])],
                         [("needs Yu and agent-safe", 0), ("needs Yu only", 1), ("agent-safe only", 1),
                          ("neither flag", 0)])

    def test_the_atlas_act_now_list_leaves_closed_items_out(self):
        doc = imported([item("H-fixture-open", "cloud", "P0"), item("H-fixture-done", "cloud", "P0", status="mitigated")])
        snapshot = {"records": [], "hygiene": hygiene.join(doc, None, [], D8, "run-now")}
        view = render.View(snapshot, [], {"run_id": "run-now"}, {}, {}, None, None, "run-now", "/nowhere")
        page = render.Doc()
        render._hygiene(page, view)
        text = render.to_markdown(page)
        act_now = text.split("### P0", 1)[1]
        self.assertIn("H-fixture-open", act_now)
        self.assertNotIn("H-fixture-done", act_now)
        self.assertIn("P0 items closed (done, declined or mitigated): 1", act_now)


class RenderTests(fixture.EstateTestCase):

    def view(self, records):
        doc = imported()
        snapshot = {"records": list(records.values()),
                    "hygiene": hygiene.join(doc, None, list(records.values()), D8, "run-now")}
        view = render.View(snapshot, [], {"run_id": "run-now"}, {}, {}, None, None, "run-now", "/nowhere")
        view.hygiene_href = "file://" + urllib.parse.quote("/nowhere/run-now/HYGIENE.md")
        return view

    def test_hygiene_md_holds_every_item_and_the_lists_to_check_first(self):
        view = self.view(by_id(sched(JOB, "healthy"), art(KEYS, "missing"), proj(REPO), BEFORE["account:aws:old"]))
        text = render.to_markdown(render.hygiene_doc(view))
        for entry in ITEMS:
            self.assertIn(entry["id"], text)
            self.assertIn(entry["title"], text)
        first = text.split("## Check these first", 1)[1].split("## In progress elsewhere", 1)[0]
        self.assertIn("H-fixture-backup-job \\[P0 · open · signals no longer observed\\]", first)
        elsewhere = text.split("## In progress elsewhere", 1)[1].split("\n## ", 1)[0]
        self.assertIn("H-fixture-handover", elsewhere)
        self.assertIn("no longer observed: " + JOB + " failing", text)
        self.assertIn("a false positive", text)  # the plan's refuted list is kept

    def test_the_atlas_section_counts_and_links_and_lists_p0(self):
        view = self.view(BEFORE)
        doc = render.Doc()
        render._hygiene(doc, view)
        text = render.to_markdown(doc)
        self.assertIn("## Hygiene", text)
        self.assertIn("(<file:///nowhere/run-now/HYGIENE.md>)", text)
        self.assertIn("| Now | 3 |", text)
        self.assertIn("### P0 — act now (2)", text)
        self.assertIn("- H-fixture-keys \\[P0 · open · signals observed\\]", text)
        self.assertNotIn("H-fixture-repo-work", text)  # P2: only in HYGIENE.md
        html_body = render.to_html_body(doc)
        self.assertIn('<a href="file:///nowhere/run-now/HYGIENE.md">', html_body)

    def test_the_decided_section_counts_the_plan(self):
        line = render._hygiene_effect(self.view(BEFORE).hygiene["counts"])
        self.assertIn("hygiene plan (see Hygiene and HYGIENE.md): 5 items", line)
        self.assertEqual(render._hygiene_effect({"status": "none"}), "hygiene plan: none in the private curation (see Hygiene)")


class DecisionTests(fixture.EstateTestCase):

    def test_the_committed_d8_decision_applies_the_view(self):
        with open(os.path.join(fixture.LAYER_DIR, "curated", "decisions.toml"), "rb") as stream:
            import tomllib
            rows = tomllib.load(stream)["decision"]
        d8 = next(d for d in rows if d["id"] == D8)
        self.assertNotIn("pending", d8)  # the view is applied, no longer pending
        self.assertEqual(decisions.effect_keys(d8), (["hygiene_view"], []))
        self.assertEqual(decisions.rules(rows)["hygiene"], {"decision": D8})
        self.assertEqual(decisions.problems([dict(d8, effects={"hygiene_view": "yes"})], set()),
                         ["owner decision %s: hygiene_view must be true" % D8])


# ── the command line over a synthetic estate ────────────────────────────────────────────────

ART = "artifact:fixture-keys"   # the synthetic curation's secret-bearing artifact (test_model)
ALPHA = "github.com/cambridgetcg/alpha-service"
CHAIN = "sched:launchd:com.example.fixture-backup"
CLI_ITEMS = [item("H-fixture-keyfile", "secrets", "P0", related=[ART]),
             item("H-fixture-alpha-work", "durability", "P1", wave="This week", related=[ALPHA]),
             item("H-fixture-aws-handover", "cloud", "P0", status="in-progress-elsewhere", related=["account:aws:old"]),
             item("H-fixture-paper", "agents", "P2", wave="This week", related=["q:still-open"]),
             item("H-fixture-chain", "automation", "P3", status="mitigated", wave="Tidy-up", related=[CHAIN])]


class CommandLineHygieneTests(fixture.EstateTestCase):
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
        test_decisions.write_decided_curation(e, caveat_dir)
        test_decisions.set_decisions(e, test_decisions.owner_decisions() + [
            test_decisions.owner(D8, label="D8", resolves=[], effects={"hygiene_view": True})])
        cls.keyfile = fixture.write_file(os.path.join(e.home, ".fixture-keys"), fixture.NEVER_READ + "\n", mode=0o600)
        cls.plan_path = fixture.write_file(os.path.join(e.inputs, "hygiene-plan.json"), json.dumps(plan_doc(CLI_ITEMS)))
        cls.target = os.path.join(e.private, "curated", "hygiene.json")
        cls.accept = cls.cli_("accept-vocab", "--write")
        cls.no_plan_build = cls.cli_("build")
        cls.no_plan_list = cls.cli_("hygiene")
        cls.dry = cls.cli_("hygiene", "--import", cls.plan_path)
        cls.absent_after_dry = not os.path.lexists(cls.target)
        cls.wet = cls.cli_("hygiene", "--import", cls.plan_path, "--write")
        with open(cls.target, encoding="utf-8") as stream:
            cls.first_doc = json.load(stream)
        cls.again = cls.cli_("hygiene", "--import", cls.plan_path, "--write")
        os.unlink(cls.keyfile)  # the issue goes away; nobody edits the plan
        cls.build = cls.cli_("build")
        cls.run_dir = os.path.realpath(os.path.join(e.private, "current"))
        cls.hygiene_md = test_e2e.read_text(os.path.join(cls.run_dir, "HYGIENE.md"))
        cls.atlas = test_e2e.read_text(os.path.join(cls.run_dir, "ATLAS.md"))
        cls.atlas_html = test_e2e.read_text(os.path.join(cls.run_dir, "ATLAS.html"))
        cls.run_doc = test_e2e.read_json(os.path.join(cls.run_dir, "run.json"))
        cls.records = {r["id"]: r for r in test_e2e.jsonl(os.path.join(cls.run_dir, "records.jsonl"))[1:]}
        cls.listing = cls.cli_("hygiene")
        cls.p0 = cls.cli_("hygiene", "--severity", "p0")
        cls.elsewhere = cls.cli_("hygiene", "--status", "in-progress-elsewhere")
        cls.secrets = cls.cli_("hygiene", "--area", "secrets", "--wave", "now")
        with open(cls.target, "rb") as stream:
            cls.before_set = stream.read()
        cls.set_dry = cls.cli_("hygiene", "--set", "H-fixture-keyfile", "--status", "done", "--note", "file removed")
        with open(cls.target, "rb") as stream:
            cls.after_set_dry = stream.read()
        cls.set_wet = cls.cli_("hygiene", "--set", "H-fixture-keyfile", "--status", "done", "--note", "file removed",
                               "--write")
        cls.set_secret = cls.cli_("hygiene", "--set", "H-fixture-keyfile", "--status", "done", "--note", KEYLIKE_NOTE,
                                  "--write")
        cls.set_bad = cls.cli_("hygiene", "--set", "H-fixture-keyfile", "--status", "mitigated")
        cls.after_set = cls.cli_("hygiene", "--status", "done")
        later = [dict(CLI_ITEMS[0], title="Fixture key file, reworded"), CLI_ITEMS[2], CLI_ITEMS[3], CLI_ITEMS[4],
                 item("H-fixture-later", "repos", "P3", wave="Tidy-up", related=[ALPHA])]
        cls.later_path = fixture.write_file(os.path.join(e.inputs, "hygiene-plan-later.json"),
                                            json.dumps(plan_doc(later, "2026-10-25T00:00:00+01:00")))
        cls.reimport = cls.cli_("hygiene", "--import", cls.later_path, "--write")
        with open(cls.target, encoding="utf-8") as stream:
            cls.last_doc = json.load(stream)
        cls.after_reimport = cls.cli_("hygiene")
        cls.check = cls.cli_("check")

    @classmethod
    def cli_(cls, *argv):
        return test_e2e.cli(cls.layer, *argv)

    def test_without_a_plan_the_build_and_listing_say_so(self):
        code, out, err = self.no_plan_build
        self.assertIn(code, (0, 10), out + err)
        self.assertIn("the private hygiene plan (private/curated/hygiene.json) is missing; owner decision " + D8, out)
        self.assertIn("no plan in private/curated/hygiene.json", self.no_plan_list[1])

    def test_the_import_prints_first_then_writes_0400_with_a_baseline(self):
        code, out, err = self.dry
        self.assertEqual(code, 0, err)
        self.assertIn("nothing written", out)
        self.assertIn("added 5", out)
        self.assertTrue(self.absent_after_dry)
        code, out, err = self.wet
        self.assertEqual(code, 0, err)
        self.assertIn("private/curated/hygiene.json: written", out)
        self.assertEqual(stat.S_IMODE(os.lstat(self.target).st_mode), 0o400)
        self.assertEqual(safety.PrivateArea(self.layer).curated_mode(), 0o500)
        self.assertEqual(self.first_doc["plan"]["observed_at"], OBSERVED_AT)
        keyfile = next(i for i in self.first_doc["items"] if i["id"] == "H-fixture-keyfile")
        self.assertEqual([(b["record"], b["check"]) for b in keyfile["baseline"]], [(ART, "secret-file")])
        self.assertIn("private/curated/hygiene.json: unchanged", self.again[1])

    def test_hygiene_md_shows_every_item_and_the_cleared_one(self):
        code, out, err = self.build
        self.assertIn(code, (0, 10), out + err)
        self.assertIn("hygiene plan: 5 items", out)
        for entry in CLI_ITEMS:
            self.assertIn("#### %s — %s" % (entry["id"], entry["title"]), self.hygiene_md)
        self.assertEqual(self.records[ART]["status"], "missing")
        first = self.hygiene_md.split("## Check these first", 1)[1].split("## In progress elsewhere", 1)[0]
        self.assertIn("H-fixture-keyfile \\[P0 · open · signals no longer observed\\]", first)
        self.assertIn("no longer observed: %s secret-file: present (names only) → now missing" % ART, self.hygiene_md)
        elsewhere = self.hygiene_md.split("## In progress elsewhere", 1)[1].split("\n## ", 1)[0]
        self.assertIn("H-fixture-aws-handover \\[P0 · in-progress-elsewhere", elsewhere)
        self.assertIn("account:aws:old (aws): in-progress-elsewhere by owner decision dec-2026-10-17-7", elsewhere)
        # U7: a question id is a reference to the curation, never a record missing from the run.
        self.assertIn("refers to: q:still-open \\[open\\]", self.hygiene_md)
        self.assertNotIn("does not hold in this run: q:still-open", self.hygiene_md)
        chain = self.records.get(CHAIN)
        if chain and chain["health"]["state"] == "failing":
            closed = first.split("still observed:", 1)[1]
            self.assertIn("H-fixture-chain \\[P3 · mitigated · signals observed\\]", closed)
        self.assertEqual(stat.S_IMODE(os.lstat(os.path.join(self.run_dir, "HYGIENE.md")).st_mode), 0o600)
        # U13: the same view as a page the browser renders, with the plan's wave rule under Summary.
        with open(os.path.join(self.run_dir, "HYGIENE.html"), encoding="utf-8") as stream:
            page = stream.read()
        self.assertIn("<title>Estate hygiene</title>", page)
        self.assertIn("H-fixture-keyfile", page)
        self.assertNotIn("<script", page)

    def test_the_atlas_has_the_section_the_link_and_the_decided_line(self):
        section = self.atlas.split("## Hygiene\n", 1)[1].split("\n## Decided", 1)[0]
        self.assertIn("5 items in the private hygiene plan of owner decision " + D8, section)
        href = "file://" + urllib.parse.quote(os.path.join(self.run_dir, "HYGIENE.html"))
        self.assertIn("(<%s>)" % href, section)
        self.assertIn('href="%s"' % href, self.atlas_html)
        self.assertIn("### P0 — act now (2)", section)
        self.assertIn("- H-fixture-aws-handover \\[P0 · in-progress-elsewhere", section)
        self.assertNotIn("H-fixture-paper", section)
        self.assertIn("hygiene plan (see Hygiene and HYGIENE.md): 5 items", self.atlas)
        self.assertEqual(self.run_doc["hygiene"]["items"], 5)
        self.assertEqual(self.run_doc["hygiene"]["open_cleared"], 1)
        self.assertNotIn("H-fixture", json.dumps(self.run_doc["hygiene"]))  # counts only

    def test_the_listing_filters(self):
        code, out, err = self.listing
        self.assertEqual(code, 0, err)
        self.assertIn("5 items, 0 missing", out)
        for entry in CLI_ITEMS:
            self.assertIn(entry["id"], out)
        self.assertIn("[no longer observed]", out)
        self.assertEqual(self.ids(self.p0[1]), {"H-fixture-keyfile", "H-fixture-aws-handover"})
        self.assertEqual(self.ids(self.elsewhere[1]), {"H-fixture-aws-handover"})
        self.assertEqual(self.ids(self.secrets[1]), {"H-fixture-keyfile"})

    @staticmethod
    def ids(out):
        return {word for line in out.splitlines() for word in line.split() if word.startswith("H-fixture")}

    def test_set_prints_a_diff_then_writes_with_a_0400_backup(self):
        code, out, err = self.set_dry
        self.assertEqual(code, 0, err)
        self.assertIn('+  "status": "done"', out)
        self.assertIn("}\nhygiene --set: H-fixture-keyfile open -> done", out)
        self.assertIn("not written; add --write", out)
        self.assertEqual(self.after_set_dry, self.before_set)
        code, out, err = self.set_wet
        self.assertEqual(code, 0, err)
        self.assertIn("previous copy kept as private/curated/hygiene.json.bak-", out)
        backups = [n for n in os.listdir(os.path.join(self.private, "curated")) if n.startswith("hygiene.json.bak-")]
        self.assertTrue(backups)
        modes = {stat.S_IMODE(os.lstat(os.path.join(self.private, "curated", n)).st_mode) for n in backups}
        self.assertEqual(modes, {0o400})
        kept = []
        for name in backups:
            with open(os.path.join(self.private, "curated", name), "rb") as stream:
                kept.append(stream.read())
        self.assertIn(self.before_set, kept)  # the bytes --set replaced
        self.assertEqual(self.set_secret[0], 2)
        self.assertIn("looks like it holds a secret value", self.set_secret[2])
        self.assertEqual(self.set_bad[0], 2)
        self.assertIn("H-fixture-keyfile", self.after_set[1])
        self.assertIn("done (owner)", self.after_set[1])

    def test_a_reimport_keeps_the_status_and_marks_the_dropped_item_missing(self):
        code, out, err = self.reimport
        self.assertEqual(code, 0, err)
        self.assertIn("added 1", out)
        self.assertIn("missing 1", out)
        self.assertIn("owner_status_kept 1", out)
        items = {i["id"]: i for i in self.last_doc["items"]}
        self.assertEqual(items["H-fixture-keyfile"]["owner"]["status"], "done")
        self.assertEqual(items["H-fixture-keyfile"]["plan"]["title"], "Fixture key file, reworded")
        self.assertEqual(items["H-fixture-alpha-work"]["missing_since"], "2026-10-25T00:00:00+01:00")
        self.assertEqual(self.last_doc["plan"]["observed_at"], "2026-10-25T00:00:00+01:00")
        self.assertIn("(missing since 2026-10-25T00:00:00+01:00)", self.after_reimport[1])
        self.assertIn("6 items, 1 missing", self.after_reimport[1])
        self.assertEqual(stat.S_IMODE(os.lstat(self.target).st_mode), 0o400)

    def test_check_accepts_the_modes(self):
        code, out, err = self.check
        self.assertNotIn("hygiene.json is", out)
        self.assertNotIn("curated dir is", out)

    def test_nothing_of_the_plan_is_outside_the_private_area(self):
        files, links, _problems = curate.committed_files(self.layer)
        words = [i["id"] for i in CLI_ITEMS] + [i["title"] for i in CLI_ITEMS] + ["H-fixture-later"]
        for rel in files:
            with open(os.path.join(self.layer, rel), encoding="utf-8", errors="replace") as stream:
                content = stream.read()
            self.assertFalse([w for w in words if w in content], rel)
        self.assertFalse([rel for rel in files + links if "hygiene" in rel.lower()])
        findings = [f for f in curate.lint_committed(self.layer) if f["severity"] == "error" and f["check"] == "content"]
        self.assertEqual(findings, [])


if __name__ == "__main__":
    import unittest
    unittest.main()
