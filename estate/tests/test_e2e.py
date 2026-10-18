"""End-to-end tests of the estate command line (tool/estate.py) over the synthetic estate of spec 13.

One estate serves the main class: the committed vocabulary is copied into its layer, a synthetic
curation is written (as test_model does), the integrity lock is accepted through the CLI, and three
builds run in-process under the audit hook: a first build, an identical second one, and a reuse
build with the --forge listing. Covers spec 13 e2e: exit 10 with the expected reasons (the forge
listings are 40 days old), the outputs and their 0600/0700 modes, check verifying the sums and
naming a view modified since generation, identical proposal ids and a quiet DRIFT on a rebuild,
and every other verb. Strings the privacy lint rejects are built in parts."""
import contextlib
import io
import json
import os
import shutil
import stat
import subprocess
import tarfile
import tomllib

from . import fixture
from . import test_model
import estate
import kingdom
import render
import safety

FOUND_NOTHING = "no-such-record-" + "anywhere"


def cli(layer, *argv):
    """(exit code, stdout, stderr) of one in-process invocation against layer."""
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = estate.main(list(argv), layer_dir=layer)
    return code, out.getvalue(), err.getvalue()


def read_text(path):
    with open(path, encoding="utf-8") as stream:
        return stream.read()


def read_json(path):
    return json.loads(read_text(path))


def jsonl(path):
    return [json.loads(line) for line in read_text(path).splitlines() if line.strip()]


def walk(root):
    """{relpath: lstat} under root, never following a link."""
    out = {}
    for base, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            path = os.path.join(base, name)
            out[os.path.relpath(path, root)] = os.lstat(path)
    return out


class EndToEndTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        e = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(e)
        cls.estate, cls.layer, cls.private = e, e.layer, e.private
        shutil.copytree(os.path.join(fixture.LAYER_DIR, "vocab"), os.path.join(e.layer, "vocab"))
        cls.lock_path = os.path.join(e.layer, "vocab", "kingdom.lock.toml")
        os.unlink(cls.lock_path)  # this synthetic layer has accepted nothing yet
        caveat_dir = os.path.join(e.home, "empty-build")
        os.makedirs(caveat_dir)
        test_model.write_curation(e, caveat_dir)
        cls.dry_accept = cls.run_cli("accept-vocab")
        cls.lock_after_dry_run = os.path.exists(cls.lock_path)
        cls.accept = cls.run_cli("accept-vocab", "--write")
        cls.verify_unreviewed = cls.run_cli("check", "--verify-harvest")
        cls.first = cls.run_cli("build")
        cls.first_dir = cls.current_dir()
        cls.first_check = cls.run_cli("check")
        cls.second = cls.run_cli("build")
        cls.second_dir = cls.current_dir()
        spawned_before = len(fixture.spawned())
        cls.third = cls.run_cli("build", "--reuse-census", "--forge")
        cls.third_spawned = fixture.spawned()[spawned_before:]
        cls.third_dir = cls.current_dir()

    @classmethod
    def run_cli(cls, *argv):
        return cli(cls.layer, *argv)

    @classmethod
    def current_dir(cls):
        return os.path.realpath(os.path.join(cls.private, "current"))

    def run_doc(self, run_dir):
        return read_json(os.path.join(run_dir, "run.json"))

    # ── the integrity lock ──────────────────────────────────────────────────────────────────

    def test_accept_vocab_prints_first_and_writes_only_with_write(self):
        code, out, err = self.dry_accept
        self.assertEqual(code, 0, err)
        self.assertIn("+harvest_blob_sha256", out)
        self.assertIn("add --write", out)
        self.assertFalse(self.lock_after_dry_run)
        self.assertEqual(self.accept[0], 0, self.accept[2])
        lock, why = kingdom.read_lock(self.layer)
        self.assertIsNone(why)
        foundation = kingdom.read_foundation(self.estate.kos.path)
        self.assertEqual(kingdom.compare_lock(foundation, lock)["state"], "match")
        self.assertNotIn(kingdom.REVIEWED_KEY, lock["kingdom_os"])  # review stays a deliberate act
        self.assertEqual(stat.S_IMODE(os.stat(self.lock_path).st_mode), 0o644)

    def test_verify_harvest_runs_only_read_only_verbs_at_the_reviewed_sha(self):
        code, _out, err = self.verify_unreviewed
        self.assertEqual(code, 2)
        self.assertIn("no reviewed harvest sha", err)
        foundation = kingdom.read_foundation(self.estate.kos.path)
        old_text = read_text(self.lock_path)
        old, _ = kingdom.read_lock(self.layer)
        reviewed = foundation["refs"][kingdom.WORKTREE]["harvest_blob_sha256"]
        # The owner's hand review of the fixture harvest.ts, recorded in the lock.
        fixture.write_file(self.lock_path, kingdom.lock_text(kingdom.make_lock(foundation, reviewed, old)))
        before = len(fixture.spawned())
        try:
            code, out, err = self.run_cli("check", "--verify-harvest")
        finally:
            fixture.write_file(self.lock_path, old_text)
        bun_calls = [argv for argv in fixture.spawned()[before:] if os.path.basename(argv[0]) == "bun"]
        self.assertEqual([argv[1:] for argv in bun_calls],
                         [[os.path.join(self.estate.kos.path, "bin", "harvest.ts"), verb] for verb in ("validate", "conformance")])
        self.assertFalse(os.path.exists(os.path.join(self.estate.tmp, "bun-called-without-verb")))
        # The stub's numbers are not the mirror's: reported as drift (10), never as agreement.
        self.assertEqual(code, 10, out + err)
        self.assertIn("mirror-drift", out)
        self.assertFalse([n for n in os.listdir(self.private) if n.startswith(".verify-harvest-")])

    # ── builds ──────────────────────────────────────────────────────────────────────────────

    def test_first_build_is_degraded_and_lists_every_reason(self):
        code, out, err = self.first
        self.assertEqual(code, 10, out + err)
        doc = self.run_doc(self.first_dir)
        self.assertEqual((doc["schema"], doc["state"], doc["exit"], doc["mode"]), ("estate.run/1", "degraded", 10, "full"))
        reasons = doc["degraded_reasons"]
        self.assertTrue(any(r.startswith("src:forge:") and "stale" in r for r in reasons), reasons)
        self.assertIn("cloudflare-observer reports degraded", reasons)
        self.assertTrue(all(isinstance(r, str) and r for r in reasons))
        self.assertFalse([r for r in reasons if "vocab_drift" in r or "kingdom lock" in r])
        self.assertEqual(doc["lock_state"], "match")
        self.assertEqual({ref: doc["foundation"]["refs"][ref]["status"] for ref in kingdom.REFS},
                         {kingdom.WORKTREE: "ok", kingdom.ORIGIN_MAIN: "ok"})
        self.assertEqual(doc["registry"]["ids_n"], 7)
        coverage = doc["census"]["coverage"]
        self.assertEqual(coverage["expected"], coverage["observed"] + coverage["errors"])
        records = jsonl(os.path.join(self.first_dir, "records.jsonl"))
        checkouts = [r for r in records[1:] if r["kind"] == "checkout"]
        self.assertEqual(len(checkouts), doc["census"]["checkouts_n"])
        self.assertTrue(all(c.get("measure_status") for c in checkouts))
        self.assertTrue(doc["tree"]["enabled"])
        self.assertTrue(doc["tree"]["check"]["ok"])
        self.assertIsNone(doc["lock_recovered"])
        self.assertTrue(doc["validation"]["ok"])

    def test_outputs_exist_with_private_modes_and_links(self):
        # U10: the build keeps private/README.txt current; its PERSISTENT list names every one-copy file.
        readme = os.path.join(self.private, "README.txt")
        self.assertEqual(stat.S_IMODE(os.lstat(readme).st_mode), 0o600)
        self.assertEqual(read_text(readme), estate.PRIVATE_README)
        for kept in ("curated/decisions.toml", "curated/sphere.toml", "curated/hygiene.json"):
            self.assertIn(kept, estate.PRIVATE_README.split("DISPOSABLE", 1)[0])
        names = set(os.listdir(self.first_dir))
        expected = {safety.RUN_MARKER, "run.json", "records.jsonl", "proposals.jsonl", "census.json", "SHA256SUMS",
                    "tree"} | set(render.VIEW_FILES)
        self.assertLessEqual(expected, names)
        for run_dir in (self.first_dir, self.second_dir, self.third_dir):
            for rel, info in walk(run_dir).items():
                with self.subTest(run=os.path.basename(run_dir), path=rel):
                    if stat.S_ISLNK(info.st_mode):
                        continue
                    want = 0o700 if stat.S_ISDIR(info.st_mode) else 0o600
                    self.assertEqual(stat.S_IMODE(info.st_mode), want)
        header = jsonl(os.path.join(self.first_dir, "records.jsonl"))[0]
        self.assertEqual(header["schema"], "estate.snapshot/1")
        for name, target in estate.STATIC_LINKS.items():
            self.assertEqual(os.readlink(os.path.join(self.private, name)), target)
            self.assertTrue(os.path.exists(os.path.join(self.private, name)))
        self.assertEqual(os.readlink(os.path.join(self.private, "current")), "runs/" + os.path.basename(self.third_dir))
        for name, target in safety.ROOT_LINKS.items():
            self.assertEqual(os.readlink(os.path.join(self.layer, name)), target)
            self.assertTrue(os.path.exists(os.path.join(self.layer, name)))

    def test_check_verifies_the_sums(self):
        code, out, err = self.first_check
        self.assertEqual(code, 10, out + err)  # the run itself is degraded
        self.assertIn("SHA256SUMS OK", out)
        self.assertIn("degraded: src:forge:", out)

    def test_second_build_keeps_proposal_ids_and_reports_no_changes(self):
        self.assertEqual(self.second[0], 10, self.second[1] + self.second[2])
        first = jsonl(os.path.join(self.first_dir, "proposals.jsonl"))
        second = jsonl(os.path.join(self.second_dir, "proposals.jsonl"))
        self.assertTrue(first)
        self.assertEqual([p["id"] for p in first], [p["id"] for p in second])
        self.assertEqual([p["status"] for p in first], [p["status"] for p in second])
        self.assertEqual([p["first_seen"] for p in first], [p["first_seen"] for p in second])
        doc = self.run_doc(self.second_dir)
        self.assertEqual(doc["mode"], "quick")
        self.assertEqual(doc["previous"]["run_id"], os.path.basename(self.first_dir))
        self.assertEqual({k: v for k, v in doc["reconcile"].items() if v}, {})
        drift = read_text(os.path.join(self.second_dir, "DRIFT.md"))
        changes = drift.split("## 4.", 1)[1].split("## 5.", 1)[0]
        self.assertIn("No record, facet, group or pulse change was observed.", changes)
        self.assertIn("added 0, removed 0, retargeted 0, newly refused 0", changes)
        self.assertNotIn("opened prop:", changes)
        self.assertNotIn("resolved prop:", changes)

    def test_reuse_build_with_the_forge_listing(self):
        code, out, err = self.third
        self.assertEqual(code, 10, out + err)
        doc = self.run_doc(self.third_dir)
        self.assertEqual(doc["mode"], "reuse")
        second_census = read_json(os.path.join(self.second_dir, "census.json"))
        self.assertEqual(doc["census"]["reused_from"], second_census["finished_at"])
        self.assertEqual(doc["sources"]["src:census"]["freshness"], "aging")
        gh_calls = [argv for argv in self.third_spawned if os.path.basename(argv[0]) == "gh"]
        self.assertEqual(len(gh_calls), 1)
        self.assertEqual(gh_calls[0][1:4], ["repo", "list", "cambridgetcg"])
        raw_path = os.path.join(self.third_dir, "forge", "gh-cambridgetcg.json")
        with open(raw_path, "rb") as stream, open(self.estate.listing_gh, "rb") as listing:
            self.assertEqual(stream.read(), listing.read())
        self.assertEqual(doc["forge_network"]["owners"]["cambridgetcg"]["status"], "ok")
        fresh = [sid for sid, e in doc["sources"].items() if sid.startswith("src:forge:") and e["freshness"] == "fresh"]
        self.assertEqual(len(fresh), 1)
        # The seeded listings are still 40 days old: the run stays degraded and says why.
        self.assertTrue(any(r.startswith("src:forge:0 stale") for r in doc["degraded_reasons"]))
        self.assertEqual(safety.verify_sums(self.third_dir)["ok"], True)

    # ── check ───────────────────────────────────────────────────────────────────────────────

    def test_check_names_a_view_modified_since_generation(self):
        atlas = os.path.join(self.current_dir(), "ATLAS.md")
        with open(atlas, "rb") as stream:
            original = stream.read()
        try:
            with open(atlas, "ab") as stream:
                stream.write(b"\nhand edit\n")
            code, out, _err = self.run_cli("check")
            self.assertEqual(code, 1)
            self.assertIn("modified since generation: ATLAS.md", out)
        finally:
            with open(atlas, "wb") as stream:
                stream.write(original)
        code, out, _err = self.run_cli("check")
        self.assertEqual(code, 10)
        self.assertIn("SHA256SUMS OK", out)

    def test_check_tree_and_vocab(self):
        code, out, err = self.run_cli("check", "--tree")
        self.assertEqual(code, 0, out + err)
        code, out, err = self.run_cli("check", "--vocab")
        self.assertEqual(code, 10, out + err)
        self.assertIn("0 closure problems", out)
        self.assertIn("unmapped: zz-not-a-mapped-tag", out)
        self.assertIn("zz-not-a-mapped-tag", read_text(os.path.join(self.current_dir(), "QUEUE.md")))

    def test_check_commit_ready_reports_findings(self):
        code, out, err = self.run_cli("check", "--commit-ready")
        # The synthetic host sits on main and the layer is a test copy: not ready, with reasons.
        self.assertEqual(code, 1, out + err)
        self.assertIn("host-state/branch", out)
        self.assertIn("not ready to commit", out)

    # ── reading verbs ───────────────────────────────────────────────────────────────────────

    def test_show_and_ls(self):
        alpha = "github.com/cambridgetcg/alpha-service"
        code, out, err = self.run_cli("show", alpha)
        self.assertEqual(code, 0, err)
        shown = json.loads(out)
        self.assertEqual(shown["record"]["id"], alpha)
        self.assertTrue(shown["checkouts"])
        code, out, _err = self.run_cli("show", "citizen")
        self.assertEqual(code, 0)
        self.assertIn("records match", out)
        self.assertEqual(self.run_cli("show", FOUND_NOTHING)[0], 1)
        code, out, _err = self.run_cli("ls", "--facet", "layer=fleet")
        self.assertEqual(code, 0)
        self.assertIn("citizen-ada (contested: layer)", out)
        code, out, _err = self.run_cli("ls", "--facet", "layer=soul", "--json")
        rows = {r["id"]: r for r in json.loads(out)}
        self.assertEqual(rows["github.com/cambridgetcg/citizen-ada"]["contested"], ["layer"])
        code, out, _err = self.run_cli("ls")
        self.assertEqual(code, 0)
        self.assertIn("  layer: ", out)
        code, out, _err = self.run_cli("ls", "--kind", "checkout")
        self.assertEqual(code, 0)
        self.assertIn("co:", out)
        self.assertEqual(self.run_cli("ls", "--facet", "nosuch=x")[0], 2)

    def test_proposals_listing_and_decide(self):
        props = jsonl(os.path.join(self.current_dir(), "proposals.jsonl"))
        target = next(p for p in props if p["status"] == "open")
        code, out, _err = self.run_cli("proposals", "--rule", target["rule"])
        self.assertEqual(code, 0)
        self.assertIn(target["id"], out)
        decisions = os.path.join(self.layer, "curated", "decisions.toml")
        before = read_text(decisions)
        try:
            argv = ("proposals", "--decide", target["id"], "--as", "deferred", "--reason", "Revisit after owner review.")
            code, out, err = self.run_cli(*argv)
            self.assertEqual(code, 0, err)
            self.assertIn('+outcome = "deferred"', out)
            self.assertIn("not written", out)
            self.assertEqual(read_text(decisions), before)
            code, out, err = self.run_cli(*argv, "--write")
            self.assertEqual(code, 0, err)
            last = tomllib.loads(read_text(decisions))["decision"][-1]
            self.assertEqual((last["proposal"], last["outcome"], last["kind"]), (target["id"], "deferred", "proposal"))
            self.assertTrue(last["id"].startswith("dec-"))
            refused = self.run_cli("proposals", "--decide", "prop:P99:" + "0" * 12, "--as", "declined", "--reason", "x")
            self.assertEqual(refused[0], 2)
            planted = "see " + fixture.HOME_REL + "notes"
            self.assertEqual(self.run_cli("proposals", "--decide", target["id"], "--as", "declined", "--reason", planted,
                                          "--write")[0], 2)
        finally:
            fixture.write_file(decisions, before)

    # ── owner verbs ─────────────────────────────────────────────────────────────────────────

    def test_export_private_writes_a_new_0600_tar_outside_the_host(self):
        target = os.path.join(self.case_dir("backup"), "estate-private.tar")
        code, out, err = self.run_cli("export-private", "--to", target)
        self.assertEqual(code, 0, out + err)
        self.assertEqual(stat.S_IMODE(os.lstat(target).st_mode), 0o600)
        with tarfile.open(target) as tar:
            names = set(tar.getnames())
        self.assertLessEqual({"curated", "curated/KEEP-NOT-REGENERABLE", "curated/projects.toml", "config.toml"}, names)
        self.assertEqual(self.run_cli("export-private", "--to", target)[0], 2)  # never overwrites
        inside = os.path.join(self.estate.host, "estate-private.tar")
        self.assertEqual(self.run_cli("export-private", "--to", inside)[0], 2)
        self.assertFalse(os.path.exists(inside))
        self.assertEqual(self.run_cli("export-private", "--to", "relative.tar")[0], 2)

    def test_export_private_refuses_a_work_tree_that_would_not_ignore_it(self):
        repo = fixture.make_repo(os.path.join(self.case_dir("checkout"), "public-site"), home=self.estate.home)
        target = os.path.join(repo, "estate-private.tar")
        code, out, err = self.run_cli("export-private", "--to", target)
        self.assertEqual(code, 2, out + err)
        self.assertIn("does not ignore it", err)
        self.assertFalse(os.path.exists(target))
        ignoring = fixture.make_repo(os.path.join(self.case_dir("ignoring"), "home-like"), home=self.estate.home,
                                     files={".gitignore": "*\n"})
        self.assertEqual(self.run_cli("export-private", "--to", os.path.join(ignoring, "backup.tar"))[0], 0)

    def test_z_untree_removes_every_tree_and_disables_it(self):
        # Named to run last: it removes the trees the other tests read.
        code, out, err = self.run_cli("untree")
        self.assertEqual(code, 0, out + err)
        runs = os.path.join(self.private, "runs")
        self.assertFalse([n for n in os.listdir(runs) if os.path.lexists(os.path.join(runs, n, "tree"))])
        self.assertFalse(os.path.lexists(os.path.join(self.private, "tree")))
        self.assertFalse(os.path.lexists(os.path.join(self.layer, "tree")))
        with open(os.path.join(self.private, "config.toml"), "rb") as stream:
            self.assertIs(tomllib.load(stream)["tree"]["enabled"], False)
        code, out, _err = self.run_cli("check")
        self.assertIn("SHA256SUMS OK", out)  # the tree is outside the sums
        self.assertEqual(self.run_cli("check", "--tree")[0], 10)


class GuardTests(fixture.EstateTestCase):
    """Refusals that must write nothing, retention, and the usage surface."""

    def fresh_layer(self):
        host = os.path.join(self.case_dir("host"), "business-ecosystem")
        layer = fixture.make_host(host)
        os.environ["HOME"] = os.path.dirname(host)
        return layer

    def assert_untouched(self, layer):
        private = os.path.join(layer, "private")
        self.assertEqual(sorted(os.listdir(private)), [".gitignore", "DO-NOT-COMMIT", "README.txt", "curated"])

    def test_build_refuses_without_the_canary_and_writes_nothing(self):
        layer = self.fresh_layer()
        os.unlink(os.path.join(layer, "private", "DO-NOT-COMMIT"))
        code, _out, err = cli(layer, "build")
        self.assertEqual(code, 2)
        self.assertIn("canary", err)
        self.assertEqual(sorted(os.listdir(os.path.join(layer, "private"))), [".gitignore", "README.txt", "curated"])

    def test_build_refuses_while_a_live_build_holds_the_lock(self):
        layer = self.fresh_layer()
        lock = os.path.join(layer, "private", safety.LOCK_NAME)
        fixture.write_file(lock, json.dumps({"pid": os.getpid(), "started_at": safety.iso(safety.utc_now())}),
                           mode=0o600)
        code, _out, err = cli(layer, "build")
        self.assertEqual(code, 2)
        self.assertIn("holds the run lock", err)
        os.unlink(lock)
        self.assert_untouched(layer)

    def test_reuse_without_a_previous_census_and_usage_errors_exit_2(self):
        layer = self.fresh_layer()
        code, _out, err = cli(layer, "build", "--reuse-census")
        self.assertEqual(code, 2)
        self.assertIn("needs a previous census", err)
        self.assert_untouched(layer)
        self.assertEqual(cli(layer, "build", "--full", "--reuse-census")[0], 2)
        self.assertEqual(cli(layer, "no-such-verb")[0], 2)
        self.assertEqual(cli(layer, "show", "anything")[0], 2)  # no current run to read
        code, out, _err = cli(layer, "--version")
        self.assertEqual((code, out.strip()), (0, estate.VERSION))
        code, out, _err = cli(layer, "help")
        self.assertEqual(code, 0)
        self.assertIn("export-private", out)
        self.assertEqual(cli(layer, "check")[0], 10)  # nothing built yet: not fresh, not failed
        self.assert_untouched(layer)

    def test_a_layer_link_that_is_not_ours_refuses_the_build(self):
        layer = self.fresh_layer()
        fixture.write_file(os.path.join(layer, "atlas.html"), "<p>someone else's</p>\n")
        code, _out, err = cli(layer, "build")
        self.assertEqual(code, 2)
        self.assertIn("atlas.html", err)
        self.assert_untouched(layer)

    def test_a_quick_walk_re_examines_what_the_previous_snapshot_knew(self):
        link = os.path.join(self.tmp, "deep", "link")
        census_doc = {"checkouts": [{"path": "/a"}], "artifacts": [], "last_full_at": "2026-10-17T00:00:00Z"}
        records = [{"kind": "checkout", "path": "/a"}, {"kind": "checkout", "path": "/b", "presence": "missing"},
                   {"kind": "artifact", "id": "artifact:symlink-index-" + safety.sha12(link),
                    "artifact_kind": "symlink-index", "path": link, "presence": "missing"},
                   {"kind": "artifact", "id": "artifact:link-farm", "artifact_kind": "symlink-index", "path": "/f"},
                   {"kind": "artifact", "id": "artifact:keys", "artifact_kind": "keys", "path": "/k"}]
        prev = {"census": census_doc, "snapshot": {"records": records}}
        quick = estate.census_prev(prev, "quick")
        self.assertEqual([c["path"] for c in quick["checkouts"]], ["/a", "/b"])
        self.assertEqual([a["path"] for a in quick["artifacts"]], [link])
        self.assertEqual(quick["last_full_at"], census_doc["last_full_at"])
        self.assertIs(estate.census_prev(prev, "reuse"), census_doc)  # reuse keeps the census exactly
        self.assertEqual(census_doc["artifacts"], [])

    def test_retention_keeps_the_newest_runs_and_current(self):
        layer = self.fresh_layer()
        area = safety.PrivateArea(layer)
        names = ["20261017T00000%dZ-000%d" % (i, i) for i in range(7)]
        for name in names:
            area.mkdir("runs/" + name)
            area.write("runs/%s/%s" % (name, safety.RUN_MARKER), name + "\n")
            area.write("runs/%s/run.json" % name, "{}\n")
        unmarked = "20261016T000000Z-ffff"
        area.mkdir("runs/" + unmarked)
        report = estate.retain(area, 3, names[1])
        self.assertEqual(report["removed"], [names[0], names[2], names[3]])
        self.assertEqual([r["run"] for r in report["refused"]], [unmarked])
        self.assertEqual(sorted(os.listdir(os.path.join(area.root, "runs"))),
                         sorted([unmarked, names[1], names[4], names[5], names[6]]))


class EntryPointTests(fixture.EstateTestCase):
    """The real shim and script: the trust check, the sys.path insertion and the version, under -I."""

    SHIM = os.path.join(fixture.LAYER_DIR, "bin", "estate")

    def run_shim(self, *argv):
        env = {"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "HOME": self.tmp}
        with fixture.allowing(self.SHIM):
            return subprocess.run([self.SHIM, *argv], stdin=subprocess.DEVNULL, capture_output=True, text=True,
                                  env=env, timeout=60)

    def test_the_real_entry_runs_isolated(self):
        proc = self.run_shim("--version")
        self.assertEqual((proc.returncode, proc.stdout.strip()), (0, estate.VERSION), proc.stderr)
        proc = self.run_shim("help")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("accept-vocab", proc.stdout)
        self.assertEqual(self.run_shim("no-such-verb").returncode, 2)

    def test_tool_files_are_ours_and_not_writable_by_others(self):
        self.assertEqual(estate.untrusted_tool_files(estate.TOOL_DIR), [])
        loose = self.case_dir("loose")
        fixture.write_file(os.path.join(loose, "mod.py"), "x = 1\n", mode=0o666)
        problems = estate.untrusted_tool_files(loose)
        self.assertTrue(any("writable" in p for p in problems), problems)
