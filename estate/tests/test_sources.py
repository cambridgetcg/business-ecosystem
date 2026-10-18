"""Side-source tests: LaunchAgent EnvironmentVariables never reach a record, crontab lines are
redacted and never executed, JSON schedulers lose their prompts, repo schedules and deploy
manifests carry honest attribution, portfolio-map/1 refuses symlinked or oversized input, the
observer's own state propagates, forge listings normalize both shapes, the gh listing needs
an explicit opt-in, prior maps are claims, and artifacts are lstat'ed and never opened."""
import json
import os
import plistlib

from . import fixture
import safety
import sources

STUBS = ("launchctl", "crontab", "gh", "bun")


def _keys_anywhere(value, wanted):
    if isinstance(value, dict):
        return any(k == wanted or _keys_anywhere(v, wanted) for k, v in value.items())
    if isinstance(value, (list, tuple)):
        return any(_keys_anywhere(v, wanted) for v in value)
    return False


def _dump(value):
    return json.dumps(value, default=lambda o: o.decode("utf-8", "replace") if isinstance(o, bytes) else str(o))


class SourcesTests(fixture.EstateTestCase):
    allow_bins = STUBS

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.estate = e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)

    def clean(self, name, modified=0):
        return {"path": self.estate.repos[name], "dirty": {"mode": "normal", "modified": modified, "untracked": 0}}

    # -- launchd / launchctl --

    def test_launchd_never_keeps_environment_variables(self):
        out = sources.read_launchd()
        self.assertEqual(out["status"], "ok")
        self.assertEqual(len(out["jobs"]), 4)
        self.assertFalse(_keys_anywhere(out, "EnvironmentVariables"))
        blob = _dump(out)
        for planted in (fixture.PLIST_SECRET_NAME, fixture.PLIST_SECRET_VALUE, "DB_" + "PASSWORD"):
            self.assertNotIn(planted, blob)
        jobs = {j["label"]: j for j in out["jobs"]}
        pulse = jobs["com.kingdom.pulse"]
        self.assertEqual((pulse["program_basename"], pulse["script_basename"]), ("bun", "pulse.ts"))
        self.assertEqual(pulse["schedule"]["start_interval"], 1800)
        self.assertEqual(pulse["log"]["stdout"], {"state": "missing"})
        nightly = jobs["com.kingdom.alpha-nightly"]
        self.assertIn(self.estate.repos["alpha-service"], nightly["target_paths"])
        self.assertTrue(nightly["tcc_exposed"])
        self.assertEqual(nightly["schedule"]["start_calendar_interval"], [{"Minute": 33, "Hour": 3}])
        self.assertFalse(jobs["com.example.fixture-backup"]["tcc_exposed"])
        self.assertIs(jobs["com.example.fixture-backup"]["disabled"], False)
        self.assertIs(jobs["com.kingdom.local-brain"]["schedule"]["keep_alive"], True)

    def test_launchd_refuses_symlinks_and_survives_corrupt_plists(self):
        agents = self.case_dir("agents")
        fixture.write_file(os.path.join(agents, "good.plist"), plistlib.dumps({
            "Label": "good", "ProgramArguments": ["/bin/sh", "-c", "echo hi"],
            "EnvironmentVariables": {"X": fixture.PLIST_SECRET_VALUE}}))
        fixture.write_file(os.path.join(agents, "broken.plist"), b"<plist><dict><key>Label")
        fixture.write_file(os.path.join(agents, "list.plist"), plistlib.dumps(["not", "a", "dict"]))
        fixture.write_file(os.path.join(agents, "old.plist.disabled"), plistlib.dumps({"Label": "old"}))
        os.symlink(os.path.join(agents, "good.plist"), os.path.join(agents, "link.plist"))
        out = sources.read_launchd(agents_dir=agents)
        self.assertEqual(out["status"], "partial")
        self.assertEqual([j["label"] for j in out["jobs"]], ["good"])
        self.assertIsNone(out["jobs"][0]["script_basename"])
        errors = {e["file"]: e["error"] for e in out["errors"]}
        self.assertEqual(errors["link.plist"], "symlink")
        self.assertTrue(errors["broken.plist"].startswith("unparseable plist"))
        self.assertEqual(errors["list.plist"], "plist root is not a dictionary")
        self.assertEqual([s["file"] for s in out["skipped"]], ["old.plist.disabled"])
        self.assertNotIn(fixture.PLIST_SECRET_VALUE, _dump(out))
        self.assertEqual(sources.read_launchd(agents_dir=os.path.join(agents, "nope"))["status"], "missing")

    def test_launchctl_list(self):
        out = sources.read_launchctl()
        self.assertEqual(out["status"], "ok")
        self.assertEqual(out["jobs"]["com.kingdom.local-brain"], {"pid": 412, "last_exit": 0})
        self.assertEqual(out["jobs"]["com.example.fixture-backup"], {"pid": None, "last_exit": 3})

    # -- crontab --

    def test_crontab_is_redacted_and_never_executed(self):
        before = len(fixture.spawned())
        out = sources.read_crontab()
        spawned = fixture.spawned()[before:]
        self.assertEqual([os.path.basename(argv[0]) for argv in spawned], ["crontab"])
        self.assertEqual(out["status"], "ok")
        blob = _dump(out)
        for forbidden in ("$(", "`", "security", "fixture-flag-value", "date +%s"):
            self.assertNotIn(forbidden, blob)
        self.assertEqual([e["name"] for e in out["env"]], ["MAILTO", "FIXTURE_PASS" + "PHRASE"])
        jobs = {j["script_basename"]: j for j in out["jobs"]}
        self.assertEqual(set(jobs), {"karma.sh", "treasury.sh", "backup"})
        karma = jobs["karma.sh"]
        self.assertEqual((karma["schedule"], karma["program_basename"]), ("12,42 * * * *", "sh"))
        self.assertEqual(karma["target_paths"], [os.path.join(self.estate.home, ".kingdom", "bin", "karma.sh")])
        line = "12,42 * * * * /bin/sh " + karma["target_paths"][0] + " >/dev/null 2>&1"
        self.assertEqual(karma["id"], "sched:cron:" + safety.sha12(safety.redact_command(line).strip()))
        self.assertEqual(jobs["backup"]["program_basename"], "env")
        self.assertEqual(safety.redact_command(fixture.CRON_SECRET_LINE), fixture.CRON_SECRET_REDACTED)

    def test_parse_crontab_looks_past_setup_steps(self):
        home = self.estate.home
        job = "$" + "HOME/Desktop/job"  # spelled in parts: the privacy lint rejects the joined form
        text = ("*/10 * * * * cd " + job + " && NAME" + "=v /" + "opt/node " + job + "/node_modules/.bin/tsx "
                + job + "/cli.ts >> " + home + "/log 2>&1\n@reboot /bin/bash -c 'echo hi'\nnot a cron line\n")
        out = sources.parse_crontab(text, home=home)
        first, second = out["jobs"]
        self.assertEqual((first["program_basename"], first["script_basename"]), ("node", "cli.ts"))
        self.assertIn(os.path.join(home, "Desktop", "job", "cli.ts"), first["target_paths"])
        self.assertTrue(first["tcc_exposed"])
        self.assertEqual((second["schedule"], second["program_basename"], second["script_basename"]), ("@reboot", "bash", None))
        self.assertEqual(len(out["unparsed"]), 1)

    # -- JSON schedulers --

    def test_scheduler_json_drops_prompts(self):
        out = sources.read_scheduler_json(self.estate.config["locators"]["scheduler_json_globs"])
        self.assertEqual(out["status"], "ok")
        self.assertFalse(_keys_anywhere(out, "prompt"))
        self.assertNotIn("PROMPT TEXT", _dump(out))
        jobs = {j["id"]: j for j in out["jobs"]}
        self.assertEqual(set(jobs), {"sched:hermes:astra/job-1", "sched:hermes:astra/job-2"})
        one = jobs["sched:hermes:astra/job-1"]
        self.assertEqual((one["schedule"], one["enabled"], one["last_status"]), ("0 3 * * *", True, "ok"))
        self.assertEqual(one["target_paths"], [self.estate.repos["alpha-service"]])
        self.assertTrue(one["tcc_exposed"])
        self.assertIs(jobs["sched:hermes:astra/job-2"]["enabled"], False)
        self.assertEqual(sources.read_scheduler_json()["status"], "ok")
        self.assertEqual(sources.read_scheduler_json(["/nonexistent/*/jobs.json"])["status"], "missing")

    # -- inside canonical checkouts --

    def test_repo_schedules_attribution(self):
        alpha_id = "github.com/cambridgetcg/alpha-service"
        dirty = sources.read_repo_schedules(self.clean("alpha-service", modified=1), project_id=alpha_id)
        self.assertEqual([j["id"] for j in dirty["jobs"]], ["sched:gha:%s/nightly.yml" % alpha_id])
        self.assertEqual((dirty["jobs"][0]["schedule"], dirty["jobs"][0]["attribution"]), (["0 4 * * *"], "candidate_only"))
        self.assertEqual(sources.read_repo_schedules(self.clean("alpha-service"))["jobs"][0]["attribution"],
                         "current_tracked_config")
        unknown = {"path": self.estate.repos["alpha-service"], "dirty": {"mode": "unknown"}}
        self.assertEqual(sources.read_repo_schedules(unknown)["jobs"][0]["attribution"], "candidate_only")
        edge = sources.read_repo_schedules(self.clean("edge-worker"))
        self.assertEqual([(j["id"], j["schedule"], j["attribution"]) for j in edge["jobs"]],
                         [("sched:cf-cron:edge-worker", ["*/30 * * * *"], "current_tracked_config")])

    def test_untracked_workflows_are_skipped(self):
        repo = fixture.make_repo(os.path.join(self.case_dir("wf"), "wf-repo"), home=self.estate.home,
                                 untracked={".github/workflows/x.yml": "on:\n  schedule:\n    - cron: \"5 5 * * *\"\n"})
        out = sources.read_repo_schedules({"path": repo, "dirty": {"mode": "normal", "modified": 0}})
        self.assertEqual(out["jobs"], [])
        self.assertEqual(out["skipped"], [{"file": ".github/workflows/x.yml", "reason": "untracked"}])

    def test_manifests(self):
        alpha = sources.read_manifests(self.clean("alpha-service"))
        self.assertEqual({(s["hosting"], s["name"], tuple(s["hostnames"]), s["attribution"]) for s in alpha["surfaces"]},
                         {("fly", "alpha-service", (), "current_tracked_config"),
                          ("x-github-pages", None, ("alpha.example.dev",), "current_tracked_config")})
        edge = sources.read_manifests(self.clean("edge-worker"))["surfaces"]
        self.assertEqual([(s["id"], s["hostnames"]) for s in edge], [("surface:cf-worker:edge-worker", ["edge.example.dev"])])
        beta = sources.read_manifests(self.clean("beta-site"))
        by_file = {s["source_file"]: s for s in beta["surfaces"]}
        self.assertEqual((by_file["vercel.json"]["tracked"], by_file["vercel.json"]["name"]), (True, None))
        self.assertEqual((by_file[".vercel/project.json"]["name"], by_file[".vercel/project.json"]["attribution"]),
                         ("beta-site", "candidate_only"))
        self.assertNotIn("team-fixture", _dump(beta))

    # -- portfolio-map/1 --

    def test_portfolio_v1(self):
        out = sources.read_portfolio_v1(self.estate.v1_map)
        self.assertEqual(out["status"], "ok", out["errors"])
        self.assertEqual([r["full_name"] for r in out["repositories"]], ["cambridgetcg/alpha-service"])
        self.assertEqual((out["repositories"][0]["github_id"], out["repositories"][0]["private"]), (1001, False))
        self.assertEqual(out["surfaces"][0]["attribution"], "current_tracked_config")
        self.assertEqual(out["surfaces"][0]["evidence"], [{"kind": "fixture", "locator": "fixture:portfolio", "note": "synthetic"}])
        self.assertEqual(out["legal_entities"], {"status": "unassigned", "records": 0})
        self.assertEqual(out["observed"]["github"], "2026-10-01T00:00:00Z")
        self.assertEqual(len(out["sha256"]), 64)

    def test_portfolio_v1_binds_worker_domains_and_routes_to_their_surfaces(self):
        # F2: custom domains, zone routes and Pages declared domains put a surface in its zone; a
        # route's path is never kept, and an edge naming no known surface is counted, not guessed.
        doc = fixture._portfolio_v1()
        doc["surfaces"].append({"id": "surface-2", "kind": "workers", "metadata": {"id": "fixture-worker"}})
        doc["hosting_edges"] += [
            {"id": "e2", "kind": "provider_worker_custom_domain", "to": "surface-2", "hostname": "App.Example.dev"},
            {"id": "e3", "kind": "provider_worker_zone_route", "to": "surface-2", "pattern": "http://example.dev/hidden/*"},
            {"id": "e4", "kind": "provider_worker_zone_route", "to": "surface-2", "pattern": "*.example.dev/*"},
            {"id": "e5", "kind": "provider_worker_zone_route", "to": "surface-9", "pattern": "other.example.dev/*"},
            {"id": "e6", "kind": "provider_worker_zone_route", "to": "surface-2", "pattern": "not a host/*"}]
        path = os.path.join(self.case_dir(), "portfolio-bindings.json")
        with open(path, "w", encoding="utf-8") as stream:
            json.dump(doc, stream)
        out = sources.read_portfolio_v1(path)
        worker = next(s for s in out["surfaces"] if s["portfolio_id"] == "surface-2")
        self.assertEqual(worker["hostnames"], ["*.example.dev", "app.example.dev", "example.dev"])
        self.assertEqual(next(s for s in out["surfaces"] if s["portfolio_id"] == "surface-1")["hostnames"],
                         ["alpha.example.dev"])
        self.assertEqual(out["edges_unjoined"], 2)
        self.assertNotIn("hidden", json.dumps(out["hosting_edges"]))

    def test_portfolio_v1_refusals(self):
        base = self.case_dir("pf")
        linked_dir = os.path.join(base, "linked")
        os.symlink(self.estate.inputs, linked_dir)
        via_link = os.path.join(linked_dir, os.path.basename(self.estate.v1_map))
        self.assertEqual(sources.read_portfolio_v1(via_link)["status"], "refused")
        file_link = os.path.join(base, "map.json")
        os.symlink(self.estate.v1_map, file_link)
        self.assertEqual(sources.read_portfolio_v1(file_link)["status"], "refused")
        big = fixture.write_file(os.path.join(base, "big.json"), b" " * (sources.MAX_PORTFOLIO + 1))
        self.assertIn("larger", sources.read_portfolio_v1(big)["errors"][0])
        other = fixture.write_file(os.path.join(base, "other.json"), json.dumps({"schema": "something/9"}))
        self.assertEqual(sources.read_portfolio_v1(other)["status"], "invalid")
        dup = fixture.write_file(os.path.join(base, "dup.json"), '{"schema": "x", "schema": "y"}')
        self.assertEqual(sources.read_portfolio_v1(dup)["status"], "invalid")
        self.assertEqual(sources.read_portfolio_v1(None)["status"], "not-configured")
        self.assertEqual(sources.read_portfolio_v1("relative.json")["status"], "refused")

    # -- Cloudflare --

    def test_observer_state_propagates(self):
        out = sources.read_observer(self.estate.runtime.observer_runs)
        self.assertEqual((out["status"], out["state"], out["errors_n"]), ("ok", "degraded", 1))
        self.assertEqual(out["coverage"]["ok"], 7)
        self.assertEqual(out["zone_names"], ["agenttool.dev", "example-zone.dev"])
        self.assertNotIn("acct-fixture", _dump(out))
        self.assertEqual(sources.read_observer()["run_id"], out["run_id"])
        self.assertEqual(sources.read_observer(os.path.join(self.case_dir("obs"), "none"))["status"], "missing")

    def test_cf_inventory(self):
        self.assertEqual(sources.read_cf_inventory(None)["status"], "not-configured")
        base = self.case_dir("cf")
        path = fixture.write_file(os.path.join(base, "inv.json"), json.dumps({
            "schema": sources.CF_SURFACES_SCHEMA, "as_of": "2026-10-17T00:00:00Z",
            "surfaces": [{"id": "pages:a", "name": "a", "kind": "pages", "audience": "human", "state": "ok"},
                         {"id": "workers:b", "name": "b", "kind": "workers", "audience": "aliens"}],
            "zones": {"items": [{"id": "z", "name": "example.dev"}]},
            "accounts_inventory": [{"account_id": "acct", "pages": {"items": [{"name": "a", "domains": ["a.example.dev"]}]},
                                    "workers": {"items": [{"id": "b"}]}}]}))
        out = sources.read_cf_inventory(path)
        self.assertEqual([s["audience"] for s in out["surfaces"]], ["human", "unknown"])
        self.assertEqual((out["zones"], out["pages"][0]["domains"], out["workers"]), (["example.dev"], ["a.example.dev"], [{"name": "b"}]))
        self.assertNotIn("acct", _dump({k: v for k, v in out.items() if k != "path"}))
        wrong = fixture.write_file(os.path.join(base, "wrong.json"), json.dumps({"schema": "x"}))
        self.assertEqual(sources.read_cf_inventory(wrong)["status"], "invalid")

    # -- forge --

    def test_forge_listings_normalize_both_shapes(self):
        out = sources.read_forge_listings([self.estate.listing_gh, self.estate.listing_codeberg])
        self.assertEqual(out["status"], "ok")
        self.assertEqual([(l["forge"], l["owners"], l["count"]) for l in out["listings"]],
                         [("github", ["cambridgetcg"], 9), ("codeberg", ["zerone-dev"], 1)])
        self.assertTrue(all(39 * 86400 < l["age_s"] < 41 * 86400 for l in out["listings"]))
        repos = out["repos"]
        self.assertEqual(repos["github.com/cambridgetcg/kingdom-os"]["visibility"], "public")
        self.assertEqual(repos["github.com/cambridgetcg/business-ecosystem"]["visibility"], "private")
        self.assertIs(repos["github.com/cambridgetcg/plain-tool"]["archived"], True)
        self.assertEqual(repos["codeberg.org/zerone-dev/zerone-mini"]["owner"], "zerone-dev")
        # the real listings' shapes: GitHub rows with url only, Codeberg owner as a string
        base = self.case_dir("forge")
        gh = fixture.write_file(os.path.join(base, "gh.json"), json.dumps([
            {"name": "Mixed-Case", "url": "https://github.com/cambridgetcg/Mixed-Case", "isPrivate": True,
             "isArchived": False, "isFork": False, "pushedAt": "2026-10-17T00:00:00Z", "primaryLanguage": {"name": "Go"}},
            {"unexpected": True}]))
        cb = fixture.write_file(os.path.join(base, "cb.json"), json.dumps([
            {"name": "agenttool", "owner": "zerone-dev", "private": True, "archived": False, "mirror": False,
             "html_url": "https://codeberg.org/zerone-dev/agenttool", "updated_at": "2026-07-27T07:26:05+02:00"}]))
        real = sources.read_forge_listings([gh, cb, os.path.join(base, "missing.json")])
        self.assertEqual(real["status"], "partial")
        self.assertEqual(real["listings"][0]["unrecognised"], 1)
        self.assertEqual(real["repos"]["github.com/cambridgetcg/mixed-case"]["language"], "Go")
        self.assertEqual(real["repos"]["codeberg.org/zerone-dev/agenttool"]["visibility"], "private")
        self.assertEqual(sources.read_forge_listings([])["status"], "not-configured")

    def test_gh_listing_needs_explicit_opt_in(self):
        before = len(fixture.spawned())
        skipped = sources.gh_listing(["cambridgetcg"])
        self.assertEqual(skipped["status"], "skipped")
        self.assertEqual(sources.gh_listing(["cambridgetcg"], allow_network="yes")["status"], "skipped")
        self.assertEqual(fixture.spawned()[before:], [])
        refused = sources.gh_listing(["../evil"], allow_network=True)
        self.assertEqual(refused["owners"]["../evil"]["status"], "refused")
        self.assertEqual(fixture.spawned()[before:], [])
        out = sources.gh_listing(["cambridgetcg"], allow_network=True)
        argv = fixture.spawned()[before:][0]
        self.assertEqual(argv[1:], ["repo", "list", "cambridgetcg", "--limit", "2000", "--json", sources.GH_FIELDS])
        owner = out["owners"]["cambridgetcg"]
        self.assertEqual((owner["status"], owner["count"]), ("ok", 9))
        self.assertTrue(owner["raw"].startswith(b"["))

    # -- prior maps and artifacts --

    def test_prior_maps_are_claims(self):
        out = sources.read_prior_maps(self.estate.config)
        self.assertEqual(out["kingdom_index"]["claims"]["buckets"], {"commerce": ["alpha-service"]})
        self.assertEqual(out["start_here_catalog"]["claims"]["entries"][0], {"name": "alpha-service", "cluster": "01", "path": None})
        self.assertEqual(out["registry_gen"]["claims"]["ids"], ["agenttool-site"])
        self.assertEqual(out["realm_md"]["claims"]["tier_mentions"],
                         {"mind": 1, "ledger": 1, "guard": 1, "market": 1, "agent-fabric": 1})
        self.assertEqual([d["value"] for d in out["declared"]["entries"]], [53, 50, 14])
        self.assertTrue(all(len(out[k]["sha256"]) == 64 for k in ("kingdom_index", "realm_md")))
        empty = sources.read_prior_maps({"declared": [{"id": "x", "value": "many"}]})
        self.assertEqual(empty["realm_md"], {"status": "not-configured"})
        self.assertEqual(empty["declared"]["status"], "partial")

    def test_artifacts_are_lstat_only(self):
        alpha = self.estate.repos["alpha-service"]
        base = self.case_dir("art")
        os.symlink(os.path.join(alpha, ".env"), os.path.join(base, "env-link"))
        bindings = [
            {"id": "artifact:env", "path": os.path.join(alpha, ".env"), "artifact_kind": "config", "secret_bearing": True},
            {"slug": "tfstate", "path": os.path.join(self.estate.repos["infra-tf"], "terraform.tfstate")},
            {"id": "artifact:link", "locator": os.path.join(base, "env-link")},
            {"id": "artifact:gone", "path": os.path.join(base, "gone")},
            {"id": "artifact:dir", "path": base},
            {"id": "artifact:nopath"},
        ]
        with fixture.tracking_opens() as opened:
            out = sources.lstat_artifacts(bindings)
        self.assertFalse([p for p in opened if ".env" in p or "tfstate" in p or "env-link" in p])
        by_id = {a["id"]: a for a in out}
        env = by_id["artifact:env"]
        self.assertEqual((env["status"], env["type"], env["contents_read"], env["secret_bearing"]), ("present", "file", False, True))
        self.assertEqual(env["size"], len(fixture.NEVER_READ) + 1)
        self.assertEqual(by_id["artifact:tfstate"]["type"], "file")
        self.assertEqual(by_id["artifact:link"]["type"], "symlink")
        self.assertEqual(by_id["artifact:gone"]["status"], "missing")
        self.assertEqual(by_id["artifact:dir"]["type"], "dir")
        self.assertEqual(by_id["artifact:nopath"]["status"], "no path")
        self.assertNotIn(fixture.NEVER_READ, _dump(out))


class FixerSourceTests(fixture.EstateTestCase):
    """Review findings S2, TM-04, TM-15 and TM-17."""

    def test_an_env_assignment_in_program_arguments_never_reaches_a_record(self):
        planted = "API_" + "TOKEN" + "=" + "s" + "k-live-PLANTED-in-argv"
        home = self.case_dir("home")
        agents = os.path.join(home, "Library", "LaunchAgents")
        os.makedirs(agents)
        job = os.path.join(home, "Desktop", "svc", "job.py")
        with open(os.path.join(agents, "com.probe.env.plist"), "wb") as stream:
            plistlib.dump({"Label": "com.probe.env",
                           "ProgramArguments": ["/usr/bin/env", planted, "/usr/bin/python3", "-u", job]}, stream)
        out = sources.read_launchd(agents, home=home)
        self.assertNotIn("PLANTED", _dump(out))
        record = out["jobs"][0]
        self.assertEqual((record["program_basename"], record["script_basename"]), ("env", "job.py"))
        self.assertEqual(record["target_paths"], [job])
        self.assertTrue(record["tcc_exposed"])

    def test_interpreter_flag_values_are_not_scripts(self):
        self.assertEqual(sources._script_word(["-W", "ignore", "run.py"]), "run.py")
        self.assertEqual(sources._script_word(["--inspect-port", "9229", "app.js"]), "app.js")
        self.assertEqual(sources._script_word(["--api-" + "key", "VALUE", "app.js"]), "app.js")
        self.assertIsNone(sources._script_word(["-c", "print(1)"]))
        out = sources.parse_crontab("* * * * * python3 -W ignore run.py\n", home="/" + "nonexistent")
        self.assertEqual(out["jobs"][0]["script_basename"], "run.py")

    def test_nameless_manifests_get_ids_of_their_own_repository(self):
        ids = []
        for name in ("one", "two"):
            repo = fixture.make_repo(os.path.join(self.case_dir(), name), home=self.tmp,
                                     files={"vercel.json": "{}\n", "CNAME": "site.surge.sh\n"})
            out = sources.read_manifests({"path": repo, "project_id": "github.com/o/" + name,
                                          "dirty": {"mode": "normal", "modified": 0, "untracked": 0}})
            vercel = next(s for s in out["surfaces"] if s["hosting"] == "vercel")
            cname = next(s for s in out["surfaces"] if s["source_file"] == "CNAME")
            self.assertEqual(cname["hosting"], "external")  # a surge.sh name is not GitHub Pages
            ids.append(vercel["id"])
        self.assertEqual(len(set(ids)), 2, ids)
        self.assertTrue(all(i.startswith("surface:vercel:") and "vercel.json" not in i for i in ids))

    def test_artifact_paths_followed_by_prose_or_globs(self):
        home = self.case_dir("home")
        os.makedirs(os.path.join(home, ".aws"))
        rows = sources.lstat_artifacts([{"id": "artifact:a", "path": fixture.HOME_REL + ".aws (file NAMES only)"},
                                        {"id": "artifact:b", "path": fixture.HOME_REL + ".x/*/logs"},
                                        {"id": "artifact:c", "path": fixture.HOME_REL + ".none and more"}], home)
        self.assertEqual([r["status"] for r in rows],
                         ["present", "unverifiable (glob or placeholder)", "missing"])
