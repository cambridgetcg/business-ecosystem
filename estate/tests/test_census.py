"""Census tests: discovery over the synthetic estate (oracle roots, pruning, unreadable dirs,
symlink-index, worktrees, alternates, nesting, quick/known/full modes) and read-only
measurement (no write under any .git, promisor clones never get status, gone roots, timeouts,
normalized remotes, every field unknown rather than defaulted)."""
import datetime as dt
import hashlib
import json
import os
import re
import shutil

from . import fixture
import census
import safety


def _git_state(roots):
    """(mtime_ns, size, mode) of every entry under each root's .git, plus the .git itself.
    A lock file created and removed again still moves its directory's mtime."""
    state = {}
    for root in roots:
        dotgit = os.path.join(root, ".git")
        info = os.lstat(dotgit)
        state[dotgit] = (info.st_mtime_ns, info.st_size, info.st_mode)
        for base, dirs, files in os.walk(dotgit):
            for name in dirs + files:
                path = os.path.join(base, name)
                info = os.lstat(path)
                state[path] = (info.st_mtime_ns, info.st_size, info.st_mode)
    return state


def _subcommand(argv):
    """The git subcommand of a GitRunner argv: git, the prefix, -C, root, subcommand, args."""
    offset = 1 + len(safety.GIT_PREFIX) + 2
    return argv[offset], argv[offset - 1], tuple(argv[offset + 1:])


class CensusOverFixtureTests(fixture.EstateTestCase):
    """One synthetic estate, one full census; the tests read the stored results."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.estate = e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.roots = [safety.expand_locator(r, e.home) for r in safety.DISCOVERY_ROOTS]
        cls.prune = safety.prune_set(e.home, e.layer)
        cls.found, cls.walk = census.discover(cls.roots, cls.prune, "full")
        cls.state_before = _git_state(e.git_roots)
        spawned_before = len(fixture.spawned())
        with fixture.tracking_opens() as opened:
            cls.result = census.run_census(e.config, None, "quick", home=e.home, layer_dir=e.layer)
        cls.opened = list(opened)
        cls.spawned = fixture.spawned()[spawned_before:]
        cls.state_after = _git_state(e.git_roots)
        cls.by_path = {info["path"]: info for info in cls.found}
        cls.co = {c["path"]: c for c in cls.result["checkouts"]}

    # -- discovery --
    def test_discovery_finds_exactly_the_oracle_roots(self):
        self.assertEqual(sorted(self.by_path), sorted(self.estate.git_roots))
        for hidden in self.estate.hidden_roots:
            self.assertNotIn(hidden, self.by_path)
        self.assertEqual(sorted(self.co), sorted(self.estate.git_roots))

    def test_unreadable_directory_is_a_coverage_error(self):
        self.assertIn(self.estate.unreadable, [u["path"] for u in self.walk["unreadable"]])
        self.assertEqual(self.walk["expected"], self.walk["observed"] + self.walk["errors"])
        self.assertGreaterEqual(self.walk["errors"], 1)

    def test_symlinked_git_root_is_an_artifact_and_never_walked(self):
        self.assertEqual(self.walk["symlink_index"], [
            {"path": self.estate.symlink_index, "target": self.estate.repos["alpha-service"]}])
        links = os.path.dirname(self.estate.symlink_index)
        self.assertFalse([p for p in self.by_path if p.startswith(links + os.sep)])
        (artifact,) = self.result["artifacts"]
        self.assertEqual(artifact["artifact_kind"], "symlink-index")
        self.assertEqual(artifact["id"], "artifact:symlink-index-" + safety.sha12(self.estate.symlink_index))
        self.assertIs(artifact["contents_read"], False)

    def test_linked_worktree_and_prunable_registration(self):
        lane = self.estate.repos["lane-repo"]
        worktree = self.by_path[self.estate.worktree]
        self.assertEqual((worktree["gitkind"], worktree["is_worktree"], worktree["hub"]), ("file", True, lane))
        registrations = {r["name"]: r for r in self.by_path[lane]["registrations"]}
        self.assertEqual(registrations[os.path.basename(self.estate.worktree)]["present"], True)
        gone = registrations["gone-worktree"]
        self.assertEqual((gone["present"], gone["path"]), (False, os.path.join(self.estate.tmp, "gone-worktree")))
        self.assertTrue(os.path.isdir(self.estate.prunable_registration))
        self.assertEqual(self.walk["prunable_registrations"], 1)
        hub = self.co[lane]
        self.assertEqual((hub["is_hub"], hub["worktrees"]["registered"], hub["worktrees"]["prunable"],
                          hub["worktrees"]["basis"]), (True, 2, 1, "git"))
        self.assertEqual(self.co[self.estate.worktree]["checkout_role"], "linked-worktree")
        self.assertNotIn(gone["path"], self.co)

    def test_alternates_link_borrower_and_lender(self):
        lender, borrower = self.estate.lender, self.estate.borrower
        self.assertEqual(self.co[borrower]["alternates"], [lender])
        self.assertEqual(self.co[lender]["lends_objects_to"], [borrower])
        self.assertEqual(self.co[lender]["alternates"], [])
        self.assertEqual(self.co[borrower]["lends_objects_to"], [])

    def test_nested_repos_are_detected(self):
        inner = self.co[self.estate.nested_inner]
        self.assertEqual((inner["nested_in"], inner["checkout_role"]), (self.estate.nested_outer, "nested"))
        # HOME is a repo too, but a discovery root nests nothing.
        self.assertIsNone(self.co[self.estate.home]["nested_in"])
        self.assertIsNone(self.co[self.estate.repos["alpha-service"]]["nested_in"])
        self.assertIsNone(self.co[self.estate.repos["alpha-service"]]["checkout_role"])

    # -- read-only guarantees --
    def test_fixture_repos_are_not_modified(self):
        for root in self.estate.git_roots:
            for name in ("index", os.path.join("logs", "HEAD")):
                path = os.path.join(root, ".git", name)
                if os.path.exists(path):
                    with self.subTest(path=path):
                        self.assertEqual(self.state_before[path], self.state_after[path])
        self.assertEqual(sorted(set(self.state_after) - set(self.state_before)), [], "new files under .git")
        self.assertEqual(self.state_before, self.state_after)

    def test_promisor_clone_never_gets_status(self):
        rec = self.co[self.estate.promisor]
        self.assertEqual(rec["measure_status"], census.STATUS_SKIPPED_PARTIAL)
        self.assertIs(rec["partial"]["flag"], True)
        self.assertIn("remote.x.partialclonefilter", rec["partial"]["reasons"])
        self.assertEqual(rec["dirty"], {"modified": None, "untracked": None, "mode": "skipped-partial"})
        # Commit-level facts are still measured; only object reads are skipped.
        self.assertEqual(rec["commits"], 1)
        statused = [argv for argv in self.spawned if self.estate.promisor in argv and "status" in argv]
        self.assertEqual(statused, [])

    def test_every_spawned_git_call_is_allowlisted(self):
        self.assertTrue(self.spawned)
        checker = safety.GitRunner(self.estate.home)
        for argv in self.spawned:
            with self.subTest(argv=argv):
                self.assertEqual(os.path.basename(argv[0]), "git")
                self.assertEqual(tuple(argv[1:1 + len(safety.GIT_PREFIX)]), safety.GIT_PREFIX)
                subcmd, root, args = _subcommand(argv)
                self.assertIn(root, self.co)
                checker.check_allowed(subcmd, args)  # raises GitRefused if not allowlisted
        used = {_subcommand(argv)[0] for argv in self.spawned}
        self.assertLessEqual(used, set(safety._SHAPES))

    def test_secret_shaped_files_are_never_opened(self):
        denied = [p for p in self.opened if safety.is_denied(os.path.basename(p))]
        self.assertEqual(denied, [])
        dumped = json.dumps(self.result)
        self.assertNotIn(fixture.NEVER_READ, dumped)
        self.assertNotIn(fixture.PLIST_SECRET_VALUE, dumped)

    # -- census shape --
    def test_census_shape_and_coverage(self):
        r = self.result
        self.assertEqual((r["schema"], r["mode"], r["mode_reason"]), ("estate.census/1", "full", "no previous census"))
        self.assertEqual(r["last_full_at"], r["started_at"])
        cov = r["coverage"]
        self.assertEqual(cov["expected"], cov["observed"] + cov["errors"])
        self.assertEqual(cov["expected"], len(r["checkouts"]) + len(cov["unreadable"]))
        self.assertEqual(r["state"], "degraded")
        self.assertIn("1 directories unreadable", r["degraded_reasons"])
        ids = [c["id"] for c in r["checkouts"]]
        self.assertEqual(len(ids), len(set(ids)))
        for c in r["checkouts"]:
            with self.subTest(path=c["path"]):
                self.assertIn(c["measure_status"], census.MEASURE_STATUSES)
                self.assertEqual(c["id"], "co:" + hashlib.sha256(c["path"].encode()).hexdigest()[:12])
                self.assertEqual(c["kind"], "checkout")
                self.assertRegex(c["observed_at"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
                if c["measure_status"] == "ok":
                    self.assertEqual(c["errors"], [])
                    self.assertIsInstance(c["commits"], int)
                    self.assertIn(c["dirty"]["mode"], ("normal",))
        self.assertEqual(self.co[self.estate.home]["rel"], "~")
        self.assertEqual(self.co[self.estate.repos["alpha-service"]]["rel"],
                         safety.HOME_PREFIX + "Desktop/alpha-service")

    def test_measured_fields_of_a_busy_checkout(self):
        path = self.estate.repos["alpha-service"]
        c = self.co[path]
        self.assertEqual(c["measure_status"], "ok", c["errors"])
        self.assertEqual((c["branch"], c["detached"], c["born"], c["shallow"]), ("main", False, True, False))
        self.assertEqual(c["head"], fixture.git(path, "rev-parse", "HEAD").strip())
        self.assertEqual(c["root_commit"], fixture.git(path, "rev-list", "--max-parents=0", "HEAD").strip())
        self.assertEqual(c["commits"], 2)
        self.assertEqual(c["upstream"]["state"], "tracking")
        self.assertEqual((c["upstream"]["ref"], c["upstream"]["ahead"], c["upstream"]["behind"]), ("origin/main", 1, 0))
        self.assertIsNone(c["upstream"]["as_of_fetch"])
        self.assertEqual((c["unpushed_commits"], c["stash_count"]), (1, 1))
        # untracked: notes.txt, .env and node_modules/ (which holds the pruned nested repo)
        self.assertEqual(c["dirty"], {"modified": 1, "untracked": 3, "mode": "normal"})
        with open(os.path.join(path, "kingdom.yaml"), "rb") as stream:
            card = stream.read()
        self.assertEqual(c["card"], {"present": True, "tracked": True,
                                     "text_sha256": hashlib.sha256(card).hexdigest(), "text": card.decode()})
        self.assertEqual((c["has_claude_md"], c["fate"], c["rest_marker"]), (True, False, []))
        self.assertEqual(c["wake_markers"], {"wake_md": True, "hook_file": False, "session_start": False})
        self.assertEqual(c["readme_title"], "Alpha Service")
        for name in ("package.json", "fly.toml", "CNAME", ".github/workflows"):
            self.assertIn(name, c["manifests"])
        self.assertIn("fly.toml", c["manifests_tracked"])
        self.assertEqual(c["workflows"], [".github/workflows/nightly.yml"])
        tracked = fixture.git(path, "ls-files").split()
        self.assertEqual(c["tracked_files"], len(tracked))
        self.assertIn([".ts", 2], c["top_ext"])
        self.assertEqual(c["remotes"], {"origin": "github.com/cambridgetcg/alpha-service"})
        self.assertRegex(c["last_commit_at"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")

    def test_kingdom_os_upstream_and_fetch_age(self):
        c = self.co[self.estate.kos.path]
        self.assertEqual(c["measure_status"], "ok", c["errors"])
        self.assertEqual((c["upstream"]["state"], c["upstream"]["ahead"], c["upstream"]["behind"]), ("tracking", 1, 2))
        self.assertIsNotNone(c["upstream"]["as_of_fetch"])
        self.assertEqual(c["head"], self.estate.kos.worktree_commit)

    def test_remotes_are_normalized(self):
        kos = self.co[self.estate.kos.path]
        self.assertEqual(kos["remotes"], {"origin": "github.com/cambridgetcg/kingdom-os"})
        self.assertEqual((kos["primary_remote"], kos["primary_remote_name"]),
                         ("github.com/cambridgetcg/kingdom-os", "origin"))
        scp = self.co[self.estate.repos["boot-lantern"]]
        self.assertEqual(scp["primary_remote"], "github.com/cambridgetcg/boot-lantern")
        self.assertEqual(self.co[self.estate.repos["zerone-mini"]]["primary_remote"], "codeberg.org/zerone-dev/zerone-mini")
        promisor = self.co[self.estate.promisor]
        self.assertEqual((promisor["primary_remote"], promisor["primary_remote_name"]),
                         ("github.com/cambridgetcg/promisor-demo", "x"))
        local = self.co[self.estate.repos["local-notes"]]
        self.assertEqual((local["remotes"], local["primary_remote"]), ({}, None))

    def test_unborn_repo_measures_zero_commits_not_unknown(self):
        c = self.co[self.estate.repos["empty-new"]]
        self.assertEqual(c["measure_status"], "ok", c["errors"])
        self.assertEqual((c["born"], c["commits"], c["head"], c["root_commit"]), (False, 0, None, None))
        self.assertEqual(c["upstream"]["state"], "unborn")
        self.assertEqual((c["branch"], c["tracked_files"], c["unpushed_commits"]), ("main", 0, 0))

    def test_cards_markers_and_no_upstream(self):
        lantern = self.co[self.estate.repos["boot-lantern"]]
        self.assertEqual((lantern["card"]["present"], lantern["card"]["tracked"]), (True, False))
        self.assertIn("state: active # note", lantern["card"]["text"])
        self.assertEqual(lantern["upstream"]["state"], "none")
        self.assertEqual(self.co[self.estate.repos["zerone-mini"]]["rest_marker"], ["HALT"])
        plain = self.co[self.estate.repos["plain-tool"]]
        self.assertEqual((plain["card"]["present"], plain["card"]["tracked"], plain["card"]["text"]), (False, False, None))
        self.assertIn("terraform", self.co[self.estate.repos["infra-tf"]]["manifests"])


class SourceAllowlistTests(fixture.EstateTestCase):
    def test_census_source_names_only_allowlisted_subcommands(self):
        with open(os.path.join(fixture.TOOL_DIR, "census.py"), encoding="utf-8") as stream:
            source = stream.read()
        named = re.findall(r'_call\(runner, rec, "[a-z_]+", "([^"]*)"', source)
        # Every _call names its subcommand as a literal, so the list above is complete.
        self.assertEqual(len(named), len(re.findall(r"(?<!def )_call\(runner, rec, ", source)))
        self.assertGreaterEqual(len(named), 12)
        self.assertLessEqual(set(named), set(safety._SHAPES))
        # The only other run() calls are the pass-throughs in _Runner and _call.
        self.assertEqual(re.findall(r"\.run\(([^)]*)\)", source),
                         ["subcmd, *args, timeout=timeout", "subcmd, *args"])
        self.assertNotIn("subprocess", source)
        self.assertNotIn("role=", source)  # census git is always the checkout role


class MeasureEdgeTests(fixture.EstateTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.home = os.path.join(cls.tmp, "home")
        os.makedirs(cls.home)
        os.environ["HOME"] = cls.home

    def test_root_deleted_between_discover_and_measure_is_gone_during_run(self):
        base = self.case_dir()
        repo = fixture.make_repo(os.path.join(base, "vanishing"), home=self.home,
                                 remote="https://github.com/cambridgetcg/vanishing.git")
        found, _ = census.discover([base], prune=set(), mode="full")
        self.assertEqual([info["path"] for info in found], [repo])
        fixture.force_rmtree(repo)
        rec = census.measure(found[0], home=self.home)
        self.assertEqual((rec["measure_status"], rec["checkout_role"]), ("gone-during-run", "gone-during-run"))
        self.assertEqual((rec["commits"], rec["head"], rec["remotes"]), (None, None, None))
        self.assertEqual(rec["dirty"]["mode"], "unknown")
        self.assertTrue(rec["errors"])

    def test_git_dir_removed_mid_run_is_gone_during_run(self):
        repo = fixture.make_repo(os.path.join(self.case_dir(), "hollowed"), home=self.home)
        info = census.inspect_root(repo)
        fixture.force_rmtree(os.path.join(repo, ".git"))
        self.assertEqual(census.measure(info, home=self.home)["measure_status"], "gone-during-run")

    def _slow_git(self, script_body):
        bin_dir = os.path.join(self.case_dir("slowgit"), "bin")
        real_git = shutil.which("git")
        self.assertIsNotNone(real_git)
        return fixture.stub_bin("git", script_body.replace("@GIT@", real_git), bin_dir)

    def test_a_slow_call_is_a_timeout_not_a_value(self):
        repo = fixture.make_repo(os.path.join(self.case_dir(), "slowlog"), home=self.home)
        stub = self._slow_git('case " $* " in *" log "*) sleep 30 ;; esac\nexec "@GIT@" "$@"')
        rec = census.measure(repo, home=self.home, git=stub, timeout=1)
        self.assertEqual(rec["measure_status"], "timeout")
        self.assertIsNone(rec["last_commit_at"])
        self.assertIn("last_commit: git log timed out", rec["errors"])
        self.assertEqual(rec["commits"], 1)  # other fields are still measured

    def test_a_hung_git_times_out_at_the_toplevel_check(self):
        repo = fixture.make_repo(os.path.join(self.case_dir(), "hung"), home=self.home)
        stub = self._slow_git("sleep 30")
        rec = census.measure(repo, home=self.home, git=stub, timeout=1)
        self.assertEqual(rec["measure_status"], "timeout")
        self.assertEqual((rec["commits"], rec["branch"], rec["dirty"]["modified"]), (None, None, None))
        self.assertEqual(rec["partial"]["flag"], None)

    def test_filter_only_promisor_clone(self):
        repo = fixture.make_promisor_clone(os.path.join(self.case_dir(), "filter-only"),
                                           keys=("partialclonefilter",), home=self.home)
        before = len(fixture.spawned())
        rec = census.measure(repo, home=self.home)
        self.assertEqual(rec["partial"], {"flag": True, "reasons": ["remote.x.partialclonefilter"]})
        self.assertEqual((rec["measure_status"], rec["dirty"]["mode"]), (census.STATUS_SKIPPED_PARTIAL, "skipped-partial"))
        self.assertFalse([argv for argv in fixture.spawned()[before:] if "status" in argv])

    def test_userinfo_is_stripped_and_never_stored(self):
        secret = "hunter" + "-planted-credential"
        url = "https://" + "someone" + ":" + secret + "@" + "github.com/cambridgetcg/Creds-Demo.git"
        repo = fixture.make_repo(os.path.join(self.case_dir(), "creds"), home=self.home, remote=url,
                                 remotes={"backup": "file://" + self.tmp})
        rec = census.measure(repo, home=self.home)
        self.assertEqual(rec["remotes"]["origin"], "github.com/cambridgetcg/creds-demo")
        self.assertTrue(rec["remotes"]["backup"].startswith("file:"))
        self.assertEqual(rec["primary_remote"], "github.com/cambridgetcg/creds-demo")
        self.assertNotIn(secret, json.dumps(rec))
        self.assertNotIn("someone", json.dumps(rec))

    def test_measure_accepts_a_bare_path(self):
        repo = fixture.make_repo(os.path.join(self.case_dir(), "bare-path"), home=self.home)
        rec = census.measure(repo + os.sep, home=self.home)
        self.assertEqual((rec["path"], rec["measure_status"], rec["discovered_by"]), (repo, "ok", "direct"))
        self.assertEqual(rec["id"], census.checkout_id(repo))


class DiscoveryModeTests(fixture.EstateTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.home = os.path.join(cls.tmp, "home")
        os.makedirs(cls.home)
        os.environ["HOME"] = cls.home
        cls.base = os.path.join(cls.tmp, "walk")
        cls.shallow = fixture.make_repo(os.path.join(cls.base, "a", "b", "near"), home=cls.home)
        cls.deep = fixture.make_repo(os.path.join(cls.base, "a", "b", "c", "d", "e", "deep"), home=cls.home)
        cls.pruned = fixture.make_repo(os.path.join(cls.base, "skip-me", "hidden"), home=cls.home)
        cls.by_name = fixture.make_repo(os.path.join(cls.base, "x", ".venv", "inner"), home=cls.home)

    def test_quick_mode_is_depth_limited_and_adds_known_roots(self):
        found, cov = census.discover([self.base], prune=set(), mode="quick")
        paths = [info["path"] for info in found]
        self.assertIn(self.shallow, paths)
        self.assertNotIn(self.deep, paths)
        self.assertEqual(cov["max_depth"], census.QUICK_DEPTH)
        missing = os.path.join(self.base, "moved-away")
        found, cov = census.discover([self.base], prune=set(), mode="quick", known=[self.deep, missing])
        by_path = {info["path"]: info for info in found}
        self.assertEqual(by_path[self.deep]["discovered_by"], "known")
        self.assertEqual(cov["known_missing"], [missing])

    def test_quick_mode_re_examines_known_symlink_indexes(self):
        # A link deeper than the quick depth is seen again by path, never reported missing unseen.
        base = self.case_dir("links")
        deep_dir = os.path.join(base, "a", "b", "c", "d", "e")
        os.makedirs(deep_dir)
        link, gone = os.path.join(deep_dir, "near-link"), os.path.join(deep_dir, "gone-link")
        os.symlink(self.shallow, link)
        _found, cov = census.discover([base], prune=set(), mode="quick")
        self.assertEqual(cov["symlink_index"], [])
        _found, full = census.discover([base], prune=set(), mode="full")
        self.assertEqual(full["symlink_index"], [{"path": link, "target": self.shallow}])
        prev = {"artifacts": [{"id": census.SYMLINK_INDEX_ID + safety.sha12(p), "artifact_kind": "symlink-index",
                               "path": p} for p in (link, gone)]}
        # A curated link farm shares the kind but is a directory, not one link: never re-examined.
        prev["artifacts"].append({"id": "artifact:link-farm", "artifact_kind": "symlink-index", "path": base})
        _found, cov = census.discover([base], prune=set(), mode="quick", known_links=census._known_links(prev))
        self.assertEqual(cov["symlink_index"], full["symlink_index"])
        self.assertEqual(cov["known_links_missing"], [gone])

    def test_full_mode_is_unlimited_and_prunes(self):
        found, cov = census.discover([self.base], prune={os.path.join(self.base, "skip-me")}, mode="full")
        paths = [info["path"] for info in found]
        self.assertIn(self.deep, paths)
        self.assertNotIn(self.pruned, paths)
        self.assertNotIn(self.by_name, paths)
        self.assertIsNone(cov["max_depth"])
        self.assertEqual(cov["expected"], cov["observed"] + cov["errors"])

    def test_reuse_mode_does_not_walk(self):
        found, cov = census.discover([self.base], prune=set(), mode="reuse", known=[self.shallow])
        self.assertEqual([info["path"] for info in found], [self.shallow])
        self.assertEqual(cov["dirs_scanned"], 0)
        with self.assertRaises(ValueError):
            census.discover([self.base], mode="sideways")

    def test_pick_mode(self):
        now = 1_800_000_000
        recent = safety.iso(dt.datetime.fromtimestamp(now - 86400, dt.timezone.utc))
        old = safety.iso(dt.datetime.fromtimestamp(now - 8 * 86400, dt.timezone.utc))
        prev = {"checkouts": [{"path": self.shallow}], "last_full_at": recent}
        self.assertEqual(census.pick_mode("quick", prev, now), ("quick", "requested"))
        self.assertEqual(census.pick_mode("quick", dict(prev, last_full_at=old), now),
                         ("full", "last full walk older than 7 d"))
        self.assertEqual(census.pick_mode("quick", None, now), ("full", "no previous census"))
        self.assertEqual(census.pick_mode("quick", {"checkouts": [{"path": self.shallow}]}, now),
                         ("full", "no recorded full walk"))
        self.assertEqual(census.pick_mode("full", prev, now), ("full", "requested"))

    def test_reuse_census(self):
        with self.assertRaises(safety.EstateError):
            census.run_census({}, None, "reuse", home=self.home)
        prev = {"schema": census.SCHEMA, "checkouts": [{"path": self.shallow, "measure_status": "ok"}],
                "finished_at": "2026-10-16T00:00:00Z"}
        reused = census.run_census({}, prev, "reuse", home=self.home, clock=lambda: 1_792_195_200)
        self.assertEqual((reused["mode"], reused["reused_from"], reused["checkouts"]),
                         ("reuse", "2026-10-16T00:00:00Z", prev["checkouts"]))
        self.assertEqual(reused["reuse_age_s"], 1_792_195_200 - 1_792_108_800)

    def test_quick_census_measures_known_deep_roots(self):
        prev = [{"kind": "checkout", "path": self.deep}]
        found, _ = census.discover([self.base], prune=set(), mode="quick", known=census._known_paths(prev))
        self.assertIn(self.deep, [info["path"] for info in found])
        recent = safety.iso(safety.utc_now() - dt.timedelta(days=1))
        prev = {"checkouts": [{"path": self.deep}], "last_full_at": recent}
        result = census.run_census({"roots": {"extra": [self.base]}}, prev, "quick", home=self.home)
        self.assertEqual((result["mode"], result["last_full_at"]), ("quick", recent))
        by_path = {c["path"]: c for c in result["checkouts"]}
        self.assertEqual(by_path[self.deep]["discovered_by"], "known")
        self.assertEqual(by_path[self.deep]["measure_status"], "ok")
        self.assertIn(self.shallow, by_path)
        # This synthetic HOME has no shared folder beside it and no .cache: absent, not unreadable.
        self.assertEqual(result["coverage"]["missing_roots"],
                         [os.path.join(self.tmp, "Shared"), os.path.join(self.home, ".cache")])
        self.assertEqual(result["coverage"]["unreadable"], [])
        self.assertEqual(result["state"], "complete")
        with self.assertRaises(safety.GuardError):
            census.run_census({"roots": {"extra": "not-a-list"}}, None, "full", home=self.home)
