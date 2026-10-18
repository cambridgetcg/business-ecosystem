"""Safety-core tests: the audit harness itself, git allowlist and hardening, guarded reads,
the private writer and its guards, committed writes, the run lock, marker-gated deletion,
SHA256SUMS, TOML, redaction, remote identity, the locator block and the bin/estate shim."""
import contextlib
import datetime as dt
import io
import json
import os
import shutil
import socket
import stat
import subprocess
import tempfile
import time
import tomllib

from . import fixture
import safety

EQ = "="  # planted assignments are concatenated so this file stays lint-clean


class AuditHarnessTests(fixture.EstateTestCase):
    @classmethod
    def setUpClass(cls):
        cls.outside = os.path.realpath(tempfile.mkdtemp(prefix="estate-outside-"))
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(cls.outside)

    def test_network_is_refused(self):
        with fixture.expect_violations() as caught:
            with self.assertRaises(fixture.AuditViolation):
                socket.getaddrinfo("example.invalid", 443)
        self.assertTrue(caught)

    def test_foreign_subprocess_is_refused(self):
        with fixture.expect_violations() as caught:
            with self.assertRaises(fixture.AuditViolation):
                subprocess.run(["/bin/echo", "hello"], capture_output=True)
        self.assertTrue(caught)

    def test_writes_outside_root_are_refused(self):
        target = os.path.join(self.outside, "escape.txt")
        with fixture.expect_violations() as caught:
            with self.assertRaises(fixture.AuditViolation):
                open(target, "w").close()
            with self.assertRaises(fixture.AuditViolation):
                os.open(target, os.O_WRONLY | os.O_CREAT, 0o600)
            with self.assertRaises(fixture.AuditViolation):
                os.mkdir(os.path.join(self.outside, "d"))
            with self.assertRaises(fixture.AuditViolation):
                os.symlink(self.tmp, os.path.join(self.outside, "link"))
        self.assertEqual(len(caught), 4)
        self.assertEqual(os.listdir(self.outside), [])

    def test_git_is_allowed_and_logged(self):
        before = len(fixture.spawned())
        subprocess.run(["git", "--version"], capture_output=True, check=True)
        self.assertEqual(fixture.spawned()[before:], [["git", "--version"]])


class GitRunnerTests(fixture.EstateTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.home = os.path.join(cls.tmp, "home")
        os.makedirs(cls.home)
        os.environ["HOME"] = cls.home
        fixture.make_repo(cls.home, files={".gitignore": "*\n"}, home=cls.home)
        desktop = os.path.join(cls.home, "Desktop")
        cls.repo = fixture.make_repo(os.path.join(desktop, "plain"), home=cls.home,
                                     remote="https://github.com/cambridgetcg/plain.git",
                                     files={"a.txt": "alpha\n", "sub/b.txt": "beta\n"})
        cls.filter_only = fixture.make_promisor_clone(os.path.join(desktop, "filter-only"),
                                                      keys=("partialclonefilter",), home=cls.home)
        cls.promisor_only = fixture.make_promisor_clone(os.path.join(desktop, "promisor-only"),
                                                        keys=("promisor",), home=cls.home)
        cls.notgit = os.path.join(desktop, "notgit")
        os.makedirs(cls.notgit)

    def test_allowlisted_reads_work(self):
        git = safety.GitRunner(self.repo)
        self.assertTrue(git.run("rev-parse", "--show-toplevel").ok)
        self.assertEqual(git.run("config", "--get", "remote.origin.url").out.strip(),
                         "https://github.com/cambridgetcg/plain.git")
        self.assertEqual(sorted(git.run("ls-files", "-z").out.strip("\0").split("\0")), ["a.txt", "sub/b.txt"])
        self.assertEqual(git.run("rev-list", "--count", "HEAD").out.strip(), "1")
        self.assertEqual(git.run("symbolic-ref", "-q", "--short", "HEAD").out.strip(), "main")
        self.assertEqual(git.run("for-each-ref", "--format=%(refname)", "refs/heads").out.strip(), "refs/heads/main")
        self.assertTrue(git.run("log", "-1", "--format=%H%x00%ct").ok)
        self.assertIn("worktree ", git.run("worktree", "list", "--porcelain").out)
        self.assertEqual(git.promisor_state(), (False, []))
        status = git.run("status", "--porcelain=v1", "-z", "-unormal", "--ignore-submodules=all")
        self.assertTrue(status.ok)
        self.assertEqual(status.out, "")

    def test_disallowed_calls_are_refused_before_spawning(self):
        outside = os.path.join(self.tmp, "out.txt")
        cases = [
            ("checkout", "fetch", ()), ("checkout", "pull", ()), ("checkout", "push", ()),
            ("checkout", "clone", ("a", "b")), ("checkout", "gc", ()), ("checkout", "prune", ()),
            ("checkout", "repack", ()), ("checkout", "maintenance", ("run",)),
            ("checkout", "checkout", ("main",)), ("checkout", "switch", ("main",)),
            ("checkout", "reset", ("--hard",)), ("checkout", "add", ("-A",)),
            ("checkout", "commit", ("-m", "x")), ("checkout", "stash", ("push",)),
            ("checkout", "update-ref", ("refs/x", "HEAD")), ("checkout", "update-index", ("--refresh",)),
            ("checkout", "worktree", ("add", "x")), ("checkout", "worktree", ("prune",)),
            ("checkout", "submodule", ("update",)), ("checkout", "remote", ("update",)),
            ("checkout", "config", ("core.x", "y")), ("checkout", "config", ("--unset", "core.x")),
            ("checkout", "config", ("--global", "--get", "core.x")), ("checkout", "config", ("--get", "--global")),
            ("checkout", "status", ()), ("checkout", "status", ("--porcelain",)),
            ("checkout", "log", ("-1", "--format=%H", "--output=" + outside)),
            ("checkout", "log", ("-1", "--format=%H", "-p")),
            ("checkout", "rev-parse", ("--verify", "-q", "--all")),
            ("checkout", "rev-parse", ("--show-toplevel", "extra")),
            ("checkout", "rev-list", ("--all",)), ("checkout", "ls-files", ("--others",)),
            ("checkout", "cat-file", ("blob", "HEAD:a.txt")),
            ("checkout", "check-ignore", ("-q", "a.txt")),
            ("checkout", "diff", ("--cached", "--name-only")),
            ("host", "branch", ("-D", "main")), ("host", "diff", ("HEAD",)),
            ("kingdom", "cat-file", ("-p", "HEAD")), ("checkout", "-c", ("x",)),
            ("checkout", "--exec-path", ()), ("checkout", None, ()),
        ]
        for role, subcmd, args in cases:
            with self.subTest(role=role, subcmd=subcmd, args=args):
                git = safety.GitRunner(self.repo, role=role)
                before = len(fixture.spawned())
                with self.assertRaises(safety.GitRefused):
                    git.run(subcmd, *args)
                self.assertEqual(git.calls, [])
                self.assertEqual(len(fixture.spawned()), before)
        self.assertFalse(os.path.exists(outside))

    def test_role_gated_calls(self):
        kingdom = safety.GitRunner(self.repo, role="kingdom")
        self.assertEqual(kingdom.run("cat-file", "blob", "HEAD:a.txt").raw, b"alpha\n")
        host = safety.GitRunner(self.repo, role="host")
        self.assertEqual(host.run("branch", "--show-current").out.strip(), "main")
        self.assertEqual(host.run("check-ignore", "-q", "--", "a.txt").code, 1)
        self.assertTrue(host.run("diff", "--cached", "--name-only").ok)
        self.assertEqual(host.run("ls-files", "--", "sub").out.strip(), "sub/b.txt")

    def test_every_protocol_is_blocked(self):
        git = safety.GitRunner(self.repo)
        for key in ("protocol.allow", "protocol.file.allow", "protocol.git.allow", "protocol.http.allow",
                    "protocol.https.allow", "protocol.ssh.allow", "protocol.ext.allow"):
            with self.subTest(key=key):
                self.assertEqual(git.run("config", "--get", key).out.strip(), "never")
        for key, value in (("core.hooksPath", "/dev/null"), ("core.fsmonitor", "false"), ("gc.auto", "0"),
                           ("submodule.recurse", "false"), ("maintenance.auto", "false")):
            self.assertEqual(git.run("config", "--get", key).out.strip(), value)

    def test_environment_is_replaced(self):
        with fixture.patched_env(GIT_DIR="/nonexistent", GIT_WORK_TREE="/nonexistent",
                                 GIT_CONFIG_PARAMETERS="'core.pager=false'", GIT_SSH="/bin/false"):
            git = safety.GitRunner(self.repo)
            self.assertTrue(git.toplevel_ok())
        self.assertEqual(set(git.env), {
            "HOME", "PATH", "LC_ALL", "GIT_OPTIONAL_LOCKS", "GIT_TERMINAL_PROMPT", "GIT_ASKPASS",
            "SSH_ASKPASS", "GIT_SSH_COMMAND", "GCM_INTERACTIVE", "GIT_PAGER", "PAGER",
            "GIT_NO_LAZY_FETCH", "GIT_CEILING_DIRECTORIES"})
        self.assertEqual(git.env["GIT_OPTIONAL_LOCKS"], "0")
        self.assertEqual(git.env["GIT_CEILING_DIRECTORIES"], os.path.dirname(os.path.realpath(self.repo)))

    def test_status_is_never_invoked_on_a_filter_only_clone(self):
        git = safety.GitRunner(self.filter_only, role="kingdom")
        self.assertEqual(git.promisor_state(), (True, ["remote.x.partialclonefilter"]))
        before = len(fixture.spawned())
        for subcmd, args in (("status", ("--porcelain=v1", "-z", "-unormal", "--ignore-submodules=all")),
                             ("cat-file", ("blob", "HEAD:README.md")),
                             ("rev-parse", ("HEAD:README.md",))):
            with self.subTest(subcmd=subcmd):
                with self.assertRaises(safety.GitRefused):
                    git.run(subcmd, *args)
        self.assertEqual(len(fixture.spawned()), before)
        real = os.path.realpath(self.filter_only)
        self.assertFalse([argv for argv in fixture.spawned() if real in argv and "status" in argv])
        self.assertEqual([call[0] for call in git.calls], ["config"])

    def test_promisor_only_clone_is_flagged(self):
        self.assertEqual(safety.GitRunner(self.promisor_only).promisor_state(), (True, ["remote.x.promisor"]))

    def test_toplevel_mismatch_gone_and_ceiling(self):
        self.assertTrue(safety.GitRunner(self.repo).toplevel_ok())
        # A root whose work tree is configured elsewhere is not the checkout it claims to be.
        elsewhere = self.case_dir("elsewhere-tree")
        detached = fixture.make_repo(os.path.join(self.case_dir(), "detached"), home=self.home)
        fixture.git(detached, "config", "core.worktree", elsewhere, home=self.home)
        mismatch = safety.GitRunner(detached).toplevel_check()
        self.assertEqual(mismatch["reason"], "toplevel mismatch")
        self.assertEqual(os.path.realpath(mismatch["toplevel"]), elsewhere)
        self.assertEqual(safety.GitRunner(os.path.join(self.tmp, "missing")).toplevel_check()["reason"], "gone")
        # The ceiling stops discovery at the root's parent: a plain subdir never resolves to the
        # repo above it, and a non-repo under the home repo never resolves to home.
        for path in (os.path.join(self.repo, "sub"), self.notgit):
            with self.subTest(path=path):
                check = safety.GitRunner(path).toplevel_check()
                self.assertFalse(check["ok"])
                self.assertTrue(check["reason"].startswith("rev-parse failed"), check)

    def test_git_failures_are_results(self):
        res = safety.GitRunner(self.repo).run("rev-parse", "--verify", "-q", "refs/heads/nope")
        self.assertEqual((res.ok, res.code, res.timed_out), (False, 1, False))
        res = safety.GitRunner(self.repo, git=os.path.join(self.tmp, "no-such", "git")).run("rev-parse", "--show-toplevel")
        self.assertEqual((res.ok, res.code, res.timed_out), (False, None, False))
        self.assertTrue(res.err.startswith("spawn failed"))

    def test_timeout_kills_the_process_group(self):
        pidfile = os.path.join(self.tmp, "sleeper.pid")
        slow = fixture.stub_bin("git", "sleep 30 &\necho $! > '%s'\nwait" % pidfile, os.path.join(self.tmp, "slowbin"))
        git = safety.GitRunner(self.repo, git=slow, timeout=1)
        started = time.monotonic()
        res = git.run("rev-parse", "--show-toplevel")
        self.assertTrue(res.timed_out)
        self.assertEqual((res.ok, res.code), (False, None))
        self.assertLess(time.monotonic() - started, 10)
        with open(pidfile) as stream:
            sleeper = int(stream.read().strip())
        deadline = time.monotonic() + 5
        while safety.pid_alive(sleeper) and time.monotonic() < deadline:
            time.sleep(0.05)
        self.assertFalse(safety.pid_alive(sleeper), "grandchild survived the timeout")


class SafeReadTests(fixture.EstateTestCase):
    def test_denied_names_are_never_opened(self):
        folder = self.case_dir()
        names = [".env", ".env.local", "terraform.tfstate", "x.tfstate.backup", "prod.tfvars", "server.pem",
                 "id.key", "wallet-mnemonic.txt", "priv_validator_key.json", "credentials.json", "auth.json",
                 "token.txt", "app_secret.yml", "login.keychain-db", "SECRET.TXT"]
        paths = [fixture.write_file(os.path.join(folder, n), fixture.NEVER_READ) for n in names]
        with fixture.tracking_opens() as opened:
            for path in paths:
                with self.subTest(path=os.path.basename(path)):
                    self.assertEqual(safety.read_checked(path), (None, "denied"))
                    self.assertIsNone(safety.safe_read(path))
        self.assertFalse(set(paths) & set(opened))
        self.assertFalse(safety.is_denied("README.md") or safety.is_denied("kingdom.yaml"))

    def test_reads_refuse_links_specials_and_oversize(self):
        folder = self.case_dir()
        target = fixture.write_file(os.path.join(folder, "real.txt"), "hello\n")
        link = os.path.join(folder, "link.txt")
        os.symlink(target, link)
        fifo = os.path.join(folder, "pipe")
        os.mkfifo(fifo)
        self.assertEqual(safety.read_checked(target), (b"hello\n", None))
        self.assertEqual(safety.read_checked(link), (None, "symlink"))
        self.assertEqual(safety.read_checked(fifo), (None, "not-regular"))
        self.assertEqual(safety.read_checked(os.path.join(folder, "absent")), (None, "missing"))
        self.assertEqual(safety.read_checked(target, max_bytes=3), (None, "too-large"))
        self.assertEqual(safety.read_checked(folder), (None, "not-regular"))


class PrivateAreaTests(fixture.EstateTestCase):
    def layer(self):
        return fixture.make_layer(self.case_dir())

    def test_write_creates_a_0600_file(self):
        area = safety.PrivateArea(self.layer())
        path = area.write("note.txt", "hello\n")
        self.assertEqual(stat.S_IMODE(os.lstat(path).st_mode), 0o600)
        with open(path) as stream:
            self.assertEqual(stream.read(), "hello\n")
        self.assertEqual(stat.S_IMODE(os.lstat(area.write("ro.txt", b"x", mode=0o400)).st_mode), 0o400)
        with self.assertRaises(safety.GuardError):
            area.write("open.txt", "x", mode=0o644)

    def test_o_excl_never_overwrites(self):
        area = safety.PrivateArea(self.layer())
        path = area.write("once.txt", "first\n")
        with self.assertRaises(safety.GuardError):
            area.write("once.txt", "second\n")
        with open(path) as stream:
            self.assertEqual(stream.read(), "first\n")

    def test_writes_outside_private_raise(self):
        layer = self.layer()
        area = safety.PrivateArea(layer)
        for bad in ("../escape.txt", "a/../../escape.txt", "", ".", "x//y", "./x",
                    os.path.join(layer, "README.md"), os.path.join(self.tmp, "elsewhere.txt"),
                    os.path.join(layer, "private", "..", "escape.txt")):
            with self.subTest(path=bad):
                with self.assertRaises(safety.GuardError):
                    area.write(bad, "x")
        self.assertFalse(os.path.exists(os.path.join(layer, "escape.txt")))
        self.assertFalse(os.path.exists(os.path.join(layer, "README.md")))
        self.assertFalse(os.path.exists(os.path.join(self.tmp, "elsewhere.txt")))

    def test_symlinked_ancestor_raises(self):
        layer = self.layer()
        outside = self.case_dir("outside")
        os.symlink(outside, os.path.join(layer, "private", "runs"))
        area = safety.PrivateArea(layer)
        with self.assertRaises(safety.GuardError):
            area.write("runs/x.txt", "x")
        with self.assertRaises(safety.GuardError):
            area.write("runs/x.txt", "x", parents=True)
        with self.assertRaises(safety.GuardError):
            area.mkdir("runs/deeper")
        self.assertEqual(os.listdir(outside), [])

    def test_symlinked_private_root_is_refused(self):
        layer = os.path.join(self.case_dir(), "estate")
        os.makedirs(layer)
        real = self.case_dir("real-private")
        os.chmod(real, 0o700)
        os.symlink(real, os.path.join(layer, "private"))
        area = safety.PrivateArea(layer)
        self.assertEqual(area.dir_problems(), ["private area is a symlink"])
        with self.assertRaises(safety.GuardError):
            area.write("x.txt", "x")
        self.assertEqual(os.listdir(real), [])

    def test_existing_link_at_target_is_not_followed(self):
        layer = self.layer()
        victim = fixture.write_file(os.path.join(self.case_dir(), "victim.txt"), "keep\n")
        os.symlink(victim, os.path.join(layer, "private", "out.txt"))
        with self.assertRaises(safety.GuardError):
            safety.PrivateArea(layer).write("out.txt", "clobber\n")
        with open(victim) as stream:
            self.assertEqual(stream.read(), "keep\n")

    def test_mkdir_parents_replace_and_symlink(self):
        area = safety.PrivateArea(self.layer())
        old = os.umask(0o022)
        try:
            deep = area.mkdir("runs/a/b")
        finally:
            os.umask(old)
        for path in (os.path.dirname(os.path.dirname(deep)), os.path.dirname(deep), deep):
            self.assertEqual(stat.S_IMODE(os.lstat(path).st_mode), 0o700)
        area.write("made/by/parents.txt", "x", parents=True)
        config = area.write("config.toml", "a = 1\n")
        area.replace("config.toml", "a = 2\n")
        with open(config) as stream:
            self.assertEqual(stream.read(), "a = 2\n")
        self.assertEqual(stat.S_IMODE(os.lstat(config).st_mode), 0o600)
        self.assertFalse([n for n in os.listdir(area.root) if ".estate-" in n])
        with self.assertRaises(safety.GuardError):
            area.replace("runs", "x")
        area.symlink("current", "runs/a")
        area.symlink("current", "runs/a/b")
        self.assertEqual(os.readlink(os.path.join(area.root, "current")), "runs/a/b")
        with self.assertRaises(safety.GuardError):
            area.symlink("config.toml", "runs/a")
        safety.atomic_symlink(os.path.join(area.root, "current"), "runs")
        self.assertEqual(os.readlink(os.path.join(area.root, "current")), "runs")
        self.assertEqual(area.remove_link("current"), "removed")
        self.assertEqual(area.remove_link("current"), "absent")
        with self.assertRaises(safety.GuardError):
            area.remove_link("config.toml")
        with self.assertRaises(safety.GuardError):
            area.remove_link("runs")
        self.assertTrue(os.path.isfile(config) and os.path.isdir(os.path.join(area.root, "runs")))

    def test_locked_curated_survives_rm_rf(self):
        layer = self.layer()
        area = safety.PrivateArea(layer)
        curated = os.path.join(area.root, "curated")
        marker = os.path.join(curated, "KEEP-NOT-REGENERABLE")
        self.assertEqual(area.curated_mode(), 0o500)
        with self.assertRaises(OSError):
            shutil.rmtree(curated)
        with self.assertRaises(PermissionError):
            os.remove(marker)
        with self.assertRaises(PermissionError):
            area.write("curated/projects.toml", "x")
        self.assertTrue(os.path.exists(marker))
        with area.curated_writable():
            area.write("curated/projects.toml", "[x]\n")
        self.assertEqual(area.curated_mode(), 0o500)
        with self.assertRaises(RuntimeError):
            with area.curated_writable():
                raise RuntimeError("boom")
        self.assertEqual(area.curated_mode(), 0o500)

    def test_preflight_passes_on_a_guarded_host(self):
        host = os.path.join(self.case_dir(), "host")
        layer = fixture.make_host(host, home=self.tmp)
        self.assertEqual(safety.PrivateArea(layer).preflight(host)["layer_rel"], "estate")

    def test_preflight_needs_the_ignore_guards(self):
        host = os.path.join(self.case_dir(), "host")
        layer = fixture.make_host(host, home=self.tmp)
        area = safety.PrivateArea(layer)
        fixture.write_file(os.path.join(layer, ".gitignore"), "")
        with self.assertRaises(safety.GuardError) as ctx:
            area.preflight(host)
        text = " ".join(ctx.exception.reasons)
        self.assertIn("atlas.html", text)
        self.assertIn("tree", text)
        self.assertNotIn("DO-NOT-COMMIT", text)  # guard 2 still holds the canary
        os.chmod(os.path.join(layer, "private", ".gitignore"), 0o600)
        os.remove(os.path.join(layer, "private", ".gitignore"))
        with self.assertRaises(safety.GuardError) as ctx:
            area.preflight(host)
        self.assertIn("DO-NOT-COMMIT", " ".join(ctx.exception.reasons))

    def test_preflight_refuses_tracked_private_files(self):
        host = os.path.join(self.case_dir(), "host")
        layer = fixture.make_host(host, home=self.tmp)
        fixture.git(host, "add", "-f", "--", os.path.join("estate", "private", "DO-NOT-COMMIT"), home=self.tmp)
        with self.assertRaises(safety.GuardError) as ctx:
            safety.PrivateArea(layer).preflight(host)
        self.assertIn("git tracks files under the private area", ctx.exception.reasons)

    def test_preflight_refuses_open_modes_and_missing_canary(self):
        host = os.path.join(self.case_dir(), "host")
        layer = fixture.make_host(host, home=self.tmp)
        private = os.path.join(layer, "private")
        os.chmod(private, 0o755)
        with self.assertRaises(safety.GuardError) as ctx:
            safety.PrivateArea(layer).preflight(host)
        self.assertTrue(any("group/world" in r for r in ctx.exception.reasons))
        os.chmod(private, 0o700)
        os.remove(os.path.join(private, "DO-NOT-COMMIT"))
        with self.assertRaises(safety.GuardError) as ctx:
            safety.PrivateArea(layer).preflight(host)
        self.assertTrue(any("canary" in r for r in ctx.exception.reasons))

    def test_root_links_are_the_only_outside_writes(self):
        layer = self.layer()
        area = safety.PrivateArea(layer)
        self.assertEqual(area.ensure_root_link("atlas.html"), "created")
        self.assertEqual(os.readlink(os.path.join(layer, "atlas.html")), "private/ATLAS.html")
        self.assertEqual(area.ensure_root_link("atlas.html"), "present")
        with self.assertRaises(safety.GuardError):
            area.ensure_root_link("README.md")
        squatter = fixture.write_file(os.path.join(layer, "tree"), "hand-made\n")
        with self.assertRaises(safety.GuardError):
            area.ensure_root_link("tree")
        with self.assertRaises(safety.GuardError):
            area.remove_root_link("tree")
        with open(squatter) as stream:
            self.assertEqual(stream.read(), "hand-made\n")
        os.remove(squatter)
        os.symlink("/", os.path.join(layer, "tree"))
        with self.assertRaises(safety.GuardError):
            area.ensure_root_link("tree")
        os.remove(os.path.join(layer, "tree"))
        self.assertEqual(area.ensure_root_link("tree"), "created")
        self.assertEqual(area.remove_root_link("tree"), "removed")
        self.assertEqual(area.remove_root_link("tree"), "absent")


class WriteCommittedTests(fixture.EstateTestCase):
    def test_dry_run_prints_the_diff_and_writes_nothing(self):
        layer = fixture.make_layer(self.case_dir())
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            result = safety.write_committed("vocab/x.toml", "a = 1\n", "accept-vocab", False, layer_dir=layer)
        self.assertIn("+a = 1", out.getvalue())
        self.assertEqual((result["changed"], result["written"]), (True, False))
        self.assertFalse(os.path.exists(os.path.join(layer, "vocab")))

    def test_write_creates_then_replaces_atomically(self):
        layer = fixture.make_layer(self.case_dir())
        with contextlib.redirect_stdout(io.StringIO()):
            safety.write_committed("curated/families/a.toml", "x = 1\n", "import-survey", True, layer_dir=layer)
        path = os.path.join(layer, "curated", "families", "a.toml")
        self.assertEqual(stat.S_IMODE(os.lstat(path).st_mode), 0o644)
        self.assertEqual(stat.S_IMODE(os.lstat(os.path.dirname(path)).st_mode), 0o755)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            result = safety.write_committed("curated/families/a.toml", "x = 2\n", "import-survey", True, layer_dir=layer)
        self.assertTrue(result["written"])
        self.assertIn("-x = 1", out.getvalue())
        self.assertIn("+x = 2", out.getvalue())
        with open(path) as stream:
            self.assertEqual(stream.read(), "x = 2\n")
        self.assertEqual(os.listdir(os.path.dirname(path)), ["a.toml"])
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            result = safety.write_committed("curated/families/a.toml", "x = 2\n", "import-survey", True, layer_dir=layer)
        self.assertEqual((result["changed"], result["written"]), (False, False))
        self.assertIn("unchanged", out.getvalue())

    def test_refuses_private_outside_and_links(self):
        layer = fixture.make_layer(self.case_dir())
        for bad in ("private/config.toml", "../x.toml", "README.md", "tool/x.py", "vocab",
                    os.path.join(layer, "vocab", "x.toml"), "/".join(("vocab", "..", "private", "x"))):
            with self.subTest(path=bad):
                with self.assertRaises(safety.GuardError):
                    safety.write_committed(bad, "x\n", "test", True, layer_dir=layer, quiet=True)
        outside = self.case_dir("outside")
        os.symlink(outside, os.path.join(layer, "vocab"))
        with self.assertRaises(safety.GuardError):
            safety.write_committed("vocab/x.toml", "x\n", "test", True, layer_dir=layer, quiet=True)
        self.assertEqual(os.listdir(outside), [])
        os.makedirs(os.path.join(layer, "curated"), exist_ok=True)
        os.chmod(os.path.join(layer, "curated"), 0o755)
        victim = fixture.write_file(os.path.join(outside, "victim.toml"), "keep\n")
        os.symlink(victim, os.path.join(layer, "curated", "linked.toml"))
        with self.assertRaises(safety.GuardError):
            safety.write_committed("curated/linked.toml", "x\n", "test", True, layer_dir=layer, quiet=True)
        with open(victim) as stream:
            self.assertEqual(stream.read(), "keep\n")


class RunLockTests(fixture.EstateTestCase):
    def private(self):
        path = self.case_dir()
        os.chmod(path, 0o700)
        return path

    def plant(self, private, payload, age_s=0):
        path = fixture.write_file(os.path.join(private, safety.LOCK_NAME), payload, mode=0o600)
        if age_s:
            moment = time.time() - age_s
            os.utime(path, (moment, moment))
        return path

    @staticmethod
    def stamp(seconds_ago):
        return safety.iso(dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=seconds_ago))

    def test_acquire_and_release(self):
        private = self.private()
        with safety.RunLock(private) as lock:
            path = os.path.join(private, safety.LOCK_NAME)
            self.assertEqual(stat.S_IMODE(os.lstat(path).st_mode), 0o600)
            with open(path) as stream:
                self.assertEqual(json.load(stream)["pid"], os.getpid())
            self.assertIsNone(lock.recovered)
        self.assertFalse(os.path.exists(path))

    def test_live_lock_is_held(self):
        private = self.private()
        path = self.plant(private, json.dumps({"pid": os.getpid(), "started_at": self.stamp(60)}))
        with self.assertRaises(safety.LockHeld):
            safety.RunLock(private).acquire()
        self.assertTrue(os.path.exists(path))

    def test_dead_pid_is_recovered_and_reported(self):
        private = self.private()
        proc = subprocess.Popen(["git", "--version"], stdout=subprocess.DEVNULL)
        proc.wait()
        self.plant(private, json.dumps({"pid": proc.pid, "started_at": self.stamp(30)}))
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            lock = safety.RunLock(private).acquire()
        self.assertEqual(lock.recovered["reason"], "dead pid")
        self.assertEqual(lock.recovered["pid"], proc.pid)
        self.assertIn("recovered stale run lock", err.getvalue())
        with open(os.path.join(private, safety.LOCK_NAME)) as stream:
            self.assertEqual(json.load(stream)["pid"], os.getpid())
        lock.release()

    def test_old_lock_is_recovered_even_with_a_live_pid(self):
        private = self.private()
        self.plant(private, json.dumps({"pid": os.getpid(), "started_at": self.stamp(3 * 3600)}))
        with contextlib.redirect_stderr(io.StringIO()):
            lock = safety.RunLock(private).acquire()
        self.assertEqual(lock.recovered["reason"], "older than 2 h")
        lock.release()

    def test_unreadable_lock(self):
        private = self.private()
        self.plant(private, "garbage")
        with self.assertRaises(safety.LockHeld):
            safety.RunLock(private).acquire()
        os.remove(os.path.join(private, safety.LOCK_NAME))
        self.plant(private, "garbage", age_s=600)
        with contextlib.redirect_stderr(io.StringIO()):
            lock = safety.RunLock(private).acquire()
        self.assertEqual(lock.recovered["reason"], "unreadable lock")
        lock.release()

    def test_release_leaves_a_foreign_lock_and_symlinks_are_refused(self):
        private = self.private()
        lock = safety.RunLock(private).acquire()
        path = os.path.join(private, safety.LOCK_NAME)
        os.remove(path)
        self.plant(private, json.dumps({"pid": os.getpid(), "started_at": self.stamp(1), "nonce": "other"}))
        with contextlib.redirect_stderr(io.StringIO()) as err:
            lock.release()
        self.assertTrue(os.path.exists(path))
        self.assertIn("another process", err.getvalue())
        os.remove(path)
        os.symlink(os.path.join(self.tmp, "nowhere"), path)
        with self.assertRaises(safety.GuardError):
            safety.RunLock(private).acquire()


class RemovalTests(fixture.EstateTestCase):
    RUN = "20261017T120000Z-ab12"

    def make_run(self, runs, name=None, marker=None):
        name = name or self.RUN
        run = os.path.join(runs, name)
        os.makedirs(os.path.join(run, "tree", "1-layer", "soul"))
        fixture.write_file(os.path.join(run, safety.RUN_MARKER), (marker if marker is not None else name) + "\n")
        fixture.write_file(os.path.join(run, "ATLAS.md"), "# atlas\n")
        fixture.write_file(os.path.join(run, "tree", safety.TREE_MANIFEST), "[]\n")
        return run

    def test_removes_a_marked_run_without_following_links(self):
        runs = self.case_dir("runs")
        outside = self.case_dir("outside")
        keep = fixture.write_file(os.path.join(outside, "keep.txt"), "keep\n")
        run = self.make_run(runs)
        os.symlink(outside, os.path.join(run, "tree", "1-layer", "soul", "linked"))
        os.symlink(keep, os.path.join(run, "file-link"))
        counts = safety.remove_run_dir(run, runs)
        self.assertFalse(os.path.lexists(run))
        self.assertEqual(counts["links"], 2)
        self.assertTrue(os.path.exists(keep))

    def test_refusals_leave_everything_in_place(self):
        runs = self.case_dir("runs")
        unmarked = os.path.join(runs, "20261017T120001Z-cd34")
        os.makedirs(unmarked)
        mismatched = self.make_run(runs, "20261017T120002Z-ef56", marker="20261017T120000Z-0000")
        badname = os.path.join(runs, "not-a-run")
        os.makedirs(badname)
        fixture.write_file(os.path.join(badname, safety.RUN_MARKER), "not-a-run\n")
        elsewhere = self.case_dir("elsewhere")
        stray = self.make_run(elsewhere, "20261017T120003Z-aa11")
        real = self.make_run(self.case_dir("realruns"), "20261017T120004Z-bb22")
        linked = os.path.join(runs, "20261017T120004Z-bb22")
        os.symlink(real, linked)
        for path, root in ((unmarked, runs), (mismatched, runs), (badname, runs), (stray, runs), (linked, runs)):
            with self.subTest(path=os.path.basename(path)):
                with self.assertRaises(safety.GuardError):
                    safety.remove_run_dir(path, root)
                self.assertTrue(os.path.lexists(path))
        self.assertTrue(os.path.exists(os.path.join(real, "ATLAS.md")))
        runs_link = os.path.join(self.case_dir(), "runs-link")
        os.symlink(runs, runs_link)
        with self.assertRaises(safety.GuardError):
            safety.remove_run_dir(os.path.join(runs_link, os.path.basename(mismatched)), runs_link)

    def test_remove_tree_dir_needs_the_manifest(self):
        runs = self.case_dir("runs")
        run = self.make_run(runs)
        os.remove(os.path.join(run, "tree", safety.TREE_MANIFEST))
        with self.assertRaises(safety.GuardError):
            safety.remove_tree_dir(os.path.join(run, "tree"), run)
        fixture.write_file(os.path.join(run, "tree", safety.TREE_MANIFEST), "[]\n")
        safety.remove_tree_dir(os.path.join(run, "tree"), run)
        self.assertFalse(os.path.exists(os.path.join(run, "tree")))
        self.assertTrue(os.path.exists(os.path.join(run, "ATLAS.md")))
        with self.assertRaises(safety.GuardError):
            safety.remove_tree_dir(os.path.join(run, "ATLAS.md"), run)


class SumsTests(fixture.EstateTestCase):
    def run_dir(self):
        run = os.path.join(self.case_dir(), "20261017T120000Z-ab12")
        fixture.write_file(os.path.join(run, safety.RUN_MARKER), "20261017T120000Z-ab12\n")
        fixture.write_file(os.path.join(run, "ATLAS.md"), "# atlas\n")
        fixture.write_file(os.path.join(run, "sub dir", "data.json"), "{}\n")
        fixture.write_file(os.path.join(run, "tree", "README.txt"), "generated\n")
        return run

    def test_verify_reports_modified_missing_and_unexpected(self):
        run = self.run_dir()
        self.assertEqual(safety.write_sums(run), 3)
        self.assertTrue(safety.verify_sums(run)["ok"])
        fixture.write_file(os.path.join(run, "tree", "README.txt"), "tree is not sealed\n")
        self.assertTrue(safety.verify_sums(run)["ok"])
        fixture.write_file(os.path.join(run, "ATLAS.md"), "# tampered\n")
        report = safety.verify_sums(run)
        self.assertFalse(report["ok"])
        self.assertEqual(report["modified"], ["ATLAS.md"])
        os.remove(os.path.join(run, "sub dir", "data.json"))
        fixture.write_file(os.path.join(run, "extra.txt"), "x\n")
        report = safety.verify_sums(run)
        self.assertEqual((report["missing"], report["unexpected"]), (["sub dir/data.json"], ["extra.txt"]))
        with self.assertRaises(safety.GuardError):
            safety.write_sums(run)

    def test_missing_sums_file_is_not_ok(self):
        report = safety.verify_sums(self.run_dir())
        self.assertFalse(report["ok"])
        self.assertTrue(report["errors"])

    def test_shasum_accepts_the_format(self):
        run = self.run_dir()
        safety.write_sums(run)
        shasum = shutil.which("shasum")
        if shasum is None:
            self.skipTest("shasum not installed")
        with fixture.allowing(shasum):
            proc = subprocess.run([shasum, "-a", "256", "-c", safety.SUMS_NAME], cwd=run, capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, proc.stdout + proc.stderr)


class TomlTests(fixture.EstateTestCase):
    def test_round_trip(self):
        obj = {
            "title": 'quote " backslash \\ newline \n tab \t ctrl \x01 del \x7f unicode ü ✓',
            "n": -3, "flag": True, "ratio": 0.25, "big": 10 ** 18, "day": dt.date(2026, 10, 17),
            "moment": dt.datetime(2026, 10, 17, 12, 30, tzinfo=dt.timezone.utc),
            "empty": [], "words": ["a", "b"], "nested": [[1, 2], ["x"]],
            "mixed": [1, "two", safety.Inline(three=3)],
            "point": safety.Inline(x=1, y=safety.Inline(z="deep")),
            "with space": "quoted key", "dotted.key": 1,
            "owners": {"github": ["cambridgetcg"], "codeberg": ["zerone-dev"], "deeper": {"leaf": 1}},
            "empty_table": {},
            "project": [
                {"id": "github.com/a/b", "roles": ["ops"], "curated": {"what": "x", "as_of": dt.date(2026, 10, 17)},
                 "relation": [{"verb": "depends_on", "to": "github.com/a/c"}]},
                {"id": "github.com/a/c", "inline": safety.Inline(k="v")},
            ],
        }
        text = safety.toml_dumps(obj)
        self.assertEqual(tomllib.loads(text), obj)
        self.assertEqual(tomllib.loads(safety.toml_dumps({"t": (1, 2)})), {"t": [1, 2]})
        self.assertEqual(safety.toml_dumps({}), "")

    def test_refusals(self):
        for bad in ({"a": None}, {"a": float("nan")}, {1: "x"}, {"": 1}, {"a": object()}, {"a": "\ud800"}):
            with self.subTest(bad=repr(bad)):
                with self.assertRaises((TypeError, ValueError)):
                    safety.toml_dumps(bad)
        with self.assertRaises(TypeError):
            safety.toml_dumps(["not", "a", "table"])


class RedactTests(fixture.EstateTestCase):
    def test_acceptance_example(self):
        self.assertEqual(safety.redact_command(fixture.CRON_SECRET_LINE), fixture.CRON_SECRET_REDACTED)
        self.assertEqual(safety.redact_command(fixture.CRON_SECRET_LINE),
                         "FIXTURE_PASS" + "PHRASE" + EQ + "<redacted> run.sh")

    def test_shapes(self):
        cases = [
            ("0 3 * * * API_K" + "EY" + EQ + "abc /bin/x", "0 3 * * * API_K" + "EY" + EQ + "<redacted> /bin/x"),
            ('export GH_TOK' + 'EN' + EQ + '"a b c"; run', "export GH_TOK" + "EN" + EQ + "<redacted>; run"),
            ("run --tok" + "en" + EQ + "xyz --name=ok", "run --tok" + "en" + EQ + "<redacted> --name=ok"),
            ("echo `cat x` $(date) $((1+2))", "echo <subst> <subst> <subst>"),
            ("unbalanced $(oops", "unbalanced <subst>"),
            ("clone https://user:pw" + "@" + "host.example/x", "clone https://<redacted>" + "@" + "host.example/x"),
            ("PATH=/bin:/usr/bin FOO=bar run", "PATH=/bin:/usr/bin FOO=bar run"),
            ('MAILTO=""', 'MAILTO=""'),
            ("DB_CRED" + EQ + "'x y' AUTH_HEADER" + EQ + "z cmd",
             "DB_CRED" + EQ + "<redacted> AUTH_HEADER" + EQ + "<redacted> cmd"),
            ("curl 'https://x.example/api?tok" + "en" + EQ + "abc&q=1'",
             "curl 'https://x.example/api?tok" + "en" + EQ + "<redacted>&q=1'"),
            ("curl -H 'Authorization: Bearer abc.def' x", "curl -H 'Authorization: Bearer <redacted>' x"),
            ('env "API_K' + 'EY' + EQ + 'x y" run', 'env "API_K' + 'EY' + EQ + '<redacted>" run'),
            # An unterminated quote redacts to the end of the line instead of guessing.
            ("API_K" + "EY" + EQ + '"x run', "API_K" + "EY" + EQ + "<redacted>"),
        ]
        for raw, expected in cases:
            with self.subTest(raw=raw):
                self.assertEqual(safety.redact_command(raw), expected)
        self.assertNotIn("$(", safety.redact_command("A='$(x)' B=\"$(y)\""))

    def test_nothing_is_executed(self):
        marker = os.path.join(self.tmp, "should-not-exist")
        before = len(fixture.spawned())
        safety.redact_command("X=$(touch %s) `touch %s`" % (marker, marker))
        self.assertFalse(os.path.exists(marker))
        self.assertEqual(len(fixture.spawned()), before)


class NormalizeRemoteTests(fixture.EstateTestCase):
    def test_forms(self):
        at = "@"
        cases = [
            ("https://github.com/cambridgetcg/KINGDOM-OS.git", "github.com/cambridgetcg/kingdom-os"),
            ("git" + at + "github.com:cambridgetcg/agenttool.git", "github.com/cambridgetcg/agenttool"),
            ("ssh://git" + at + "codeberg.org:2222/zerone-dev/Zerone-Core.git/", "codeberg.org/zerone-dev/zerone-core"),
            ("https://user:pw" + at + "GitHub.com/O/R/", "github.com/o/r"),
            ("https://github.com/o/r", "github.com/o/r"),
            ("file:///srv/x/repo", "file:" + safety.sha12("/srv/x/repo")),
            ("/srv/repos/thing.git", "file:" + safety.sha12("/srv/repos/thing.git")),
            ("../sibling", "file:" + safety.sha12("../sibling")),
        ]
        for url, expected in cases:
            with self.subTest(url=url):
                self.assertEqual(safety.normalize_remote(url), expected)
        for url in ("", "   ", None, "https://github.com", "http://[::1"):
            with self.subTest(url=url):
                self.assertIsNone(safety.normalize_remote(url))


class LocatorTests(fixture.EstateTestCase):
    def test_single_locator_block(self):
        begin, end = "BEGIN-" + "ALLOWED-LOCATORS", "END-" + "ALLOWED-LOCATORS"
        found = []
        for sub in ("tool", "bin", "tests"):
            for dirpath, _dirs, files in os.walk(os.path.join(fixture.LAYER_DIR, sub)):
                for name in files:
                    path = os.path.join(dirpath, name)
                    with open(path, encoding="utf-8", errors="replace") as stream:
                        text = stream.read()
                    found += [(os.path.relpath(path, fixture.LAYER_DIR), m) for m in (begin, end) if m in text]
        self.assertEqual(sorted(found), [("tool/safety.py", begin), ("tool/safety.py", end)])

    def test_home_prefix_appears_only_inside_the_block(self):
        prefix = "~" + "/"
        for sub in ("tool", "bin", "tests"):
            for dirpath, _dirs, files in os.walk(os.path.join(fixture.LAYER_DIR, sub)):
                for name in files:
                    path = os.path.join(dirpath, name)
                    with open(path, encoding="utf-8", errors="replace") as stream:
                        text = stream.read()
                    if path.endswith(os.path.join("tool", "safety.py")):
                        start = text.index("# BEGIN-" + "ALLOWED-LOCATORS")
                        stop = text.index("# END-" + "ALLOWED-LOCATORS")
                        text = text[:start] + text[stop:]
                    with self.subTest(path=path):
                        lines = [n for n, line in enumerate(text.splitlines(), 1) if prefix in line]
                        self.assertFalse(lines, "home-relative literal outside the locator block")

    def test_expand_locator_and_prune_set(self):
        home = os.path.join(self.tmp, "fakehome")
        self.assertEqual(safety.expand_locator("~", home), home)
        self.assertEqual(safety.expand_locator(safety.LOCATORS["pulse_status"], home),
                         os.path.join(home, ".kingdom", "STATUS.md"))
        self.assertEqual(safety.expand_locator(safety.DISCOVERY_ROOTS[1], home), os.path.join(self.tmp, "Shared"))
        with self.assertRaises(safety.GuardError):
            safety.expand_locator("relative/path", home)
        prune = safety.prune_set(home, layer_dir=os.path.join(self.tmp, "estate"))
        self.assertIn(os.path.join(home, "Library"), prune)
        self.assertIn(os.path.join(os.path.realpath(self.tmp), "estate", "private"), prune)


class ShimTests(fixture.EstateTestCase):
    SHIM = os.path.join(fixture.LAYER_DIR, "bin", "estate")

    def run_shim(self, env, *args):
        with fixture.allowing(self.SHIM):
            return subprocess.run([self.SHIM, *args], stdin=subprocess.DEVNULL, capture_output=True,
                                  text=True, env=env, timeout=60)

    def test_is_an_executable_posix_script(self):
        info = os.stat(self.SHIM)
        self.assertTrue(info.st_mode & stat.S_IXUSR)
        with open(self.SHIM) as stream:
            self.assertEqual(stream.readline().strip(), "#!/bin/sh")

    def test_picks_a_3_11_plus_interpreter_and_passes_isolation_flags(self):
        bins = self.case_dir("pybin")
        out = os.path.join(self.tmp, "argv.txt")
        good = fixture.stub_bin("python-good", (
            'if [ "$1" = -I ] && [ "$2" = -c ]; then exit 0; fi\n'
            "printf '%s\\n' \"$@\" > '" + out + "'"), bins)
        env = {"PATH": bins + ":/usr/bin:/bin", "HOME": self.tmp, "ESTATE_PYTHON": good}
        proc = self.run_shim(env, "--version")
        self.assertEqual(proc.returncode, 0, proc.stderr)
        with open(out) as stream:
            argv = stream.read().splitlines()
        self.assertEqual(argv, ["-I", "-B", os.path.join(os.path.realpath(fixture.LAYER_DIR), "tool", "estate.py"),
                                "--version"])

    def test_skips_old_interpreters_and_refuses_without_one(self):
        bins = self.case_dir("oldbin")
        probes = os.path.join(self.tmp, "probes.txt")
        for name in ("python3.14", "python3.13", "python3.12", "python3.11", "python3", "python-old"):
            fixture.stub_bin(name, "echo %s >> '%s'\nexit 1" % (name, probes), bins)
        env = {"PATH": bins + ":/usr/bin:/bin", "HOME": self.tmp, "ESTATE_PYTHON": os.path.join(bins, "python-old")}
        proc = self.run_shim(env, "--version")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("needs python3 >= 3.11", proc.stderr)
        with open(probes) as stream:
            self.assertEqual(stream.read().split(),
                             ["python-old", "python3.14", "python3.13", "python3.12", "python3.11", "python3"])
        out = os.path.join(self.tmp, "picked.txt")
        fixture.stub_bin("python3.12", ('if [ "$1" = -I ] && [ "$2" = -c ]; then exit 0; fi\n'
                                        "echo picked > '" + out + "'"), bins)
        self.assertEqual(self.run_shim(env, "help").returncode, 0)
        self.assertTrue(os.path.exists(out))


class FixtureEstateTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.estate = fixture.make_estate(os.path.join(cls.tmp, "estate"))
        cls.use_estate(cls.estate)

    def test_section_13_inventory(self):
        e = self.estate
        kos = safety.GitRunner(e.kos.path, role="kingdom")
        self.assertEqual(safety.normalize_remote(kos.run("config", "--get", "remote.origin.url").out.strip()),
                         "github.com/cambridgetcg/kingdom-os")
        upstream = kos.run("cat-file", "blob", "origin/main:bin/harvest.ts").out
        with open(os.path.join(e.kos.path, "bin", "harvest.ts")) as stream:
            local = stream.read()
        self.assertIn("name: _cardName", upstream)
        self.assertNotIn("name: _cardName", local)
        self.assertIn("const CARD_ENUMS", local)
        self.assertIn("layer: 'fleet'", local)
        self.assertIn("PROJECTS", kos.run("cat-file", "blob", "origin/main:ARCHITECTURE.md").out)
        self.assertEqual(kos.run("rev-list", "--left-right", "--count", "@{u}...HEAD").out.split(), ["2", "1"])
        self.assertTrue(os.path.exists(os.path.join(e.kos.path, ".git", "FETCH_HEAD")))
        self.assertEqual(safety.GitRunner(e.promisor).promisor_state(),
                         (True, ["remote.x.promisor", "remote.x.partialclonefilter"]))
        self.assertTrue(os.path.isfile(os.path.join(e.borrower, ".git", "objects", "info", "alternates")))
        with open(os.path.join(e.prunable_registration, "gitdir")) as stream:
            self.assertFalse(os.path.exists(stream.read().strip()))
        self.assertTrue(os.path.isfile(os.path.join(e.worktree, ".git")))
        self.assertTrue(os.path.isdir(os.path.join(e.nested_inner, ".git")))
        self.assertTrue(os.path.isdir(os.path.join(e.home, ".git")))
        self.assertTrue(e.host.startswith(e.home + os.sep))
        self.assertEqual(safety.PrivateArea(e.layer).preflight(e.host)["layer_rel"], "estate")
        carded = [c for c in e.citizens if os.path.exists(os.path.join(c, "kingdom.yaml"))]
        self.assertEqual(len(carded), 2)
        for path in (e.runtime.status, e.runtime.history, e.runtime.registry_copy, e.runtime.settings, e.v1_map):
            self.assertTrue(os.path.isfile(path), path)
        with open(e.v1_map) as stream:
            self.assertEqual(json.load(stream)["schema"], "business-ecosystem.portfolio-map/1")
        self.assertGreater(time.time() - os.stat(e.listing_gh).st_mtime, 30 * 86400)
        with open(os.path.join(e.private, "config.toml"), "rb") as stream:
            config = tomllib.load(stream)
        self.assertEqual(config["retention"]["runs"], 5)
        self.assertEqual(stat.S_IMODE(os.stat(os.path.join(e.private, "config.toml")).st_mode), 0o600)
        self.assertTrue(os.path.islink(e.symlink_index))
        self.assertEqual(stat.S_IMODE(os.lstat(e.unreadable).st_mode), 0)
        for root in e.git_roots:
            self.assertTrue(os.path.lexists(os.path.join(root, ".git")), root)
        for hidden in e.hidden_roots:
            self.assertTrue(os.path.isdir(os.path.join(hidden, ".git")), hidden)

    def test_plist_and_crontab_carry_the_planted_secrets(self):
        import plistlib
        with open(os.path.join(self.estate.home, "Library", "LaunchAgents", "com.kingdom.pulse.plist"), "rb") as stream:
            data = plistlib.load(stream)
        self.assertEqual(data["EnvironmentVariables"], {fixture.PLIST_SECRET_NAME: fixture.PLIST_SECRET_VALUE})
        proc = subprocess.run(["crontab", "-l"], capture_output=True, text=True, env=self.estate.env)
        self.assertIn(fixture.CRON_SECRET_LINE, proc.stdout.splitlines())
        marker = os.path.join(self.estate.tmp, "bun-called-without-verb")
        subprocess.run(["bun", os.path.join(self.estate.kos.path, "bin", "harvest.ts")], env=self.estate.env)
        self.assertTrue(os.path.exists(marker))
        os.remove(marker)

    def test_runner_reads_leave_fixture_repos_untouched(self):
        def snapshot(repo):
            gitdir = os.path.join(repo, ".git")
            names = sorted(os.path.relpath(os.path.join(d, f), gitdir) for d, _s, fs in os.walk(gitdir) for f in fs)
            stamps = {n: os.stat(os.path.join(gitdir, n)).st_mtime_ns for n in ("index", "logs/HEAD")
                      if os.path.exists(os.path.join(gitdir, n))}
            return names, stamps
        repos = [self.estate.repos[n] for n in ("alpha-service", "kingdom-os", "zerone-mini", "lane-repo")]
        before = [snapshot(r) for r in repos]
        time.sleep(0.05)
        for repo in repos:
            git = safety.GitRunner(repo)
            self.assertTrue(git.toplevel_ok())
            self.assertEqual(git.promisor_state(), (False, []))
            status = git.run("status", "--porcelain=v1", "-z", "-unormal", "--ignore-submodules=all")
            self.assertTrue(status.ok)
            for args in (("rev-list", "--count", "HEAD"), ("worktree", "list", "--porcelain"), ("ls-files", "-z"),
                         ("log", "-1", "--format=%H%x00%ct"), ("rev-list", "--branches", "--not", "--remotes", "--count")):
                git.run(*args)
        self.assertEqual([snapshot(r) for r in repos], before)
        alpha = safety.GitRunner(self.estate.repos["alpha-service"])
        dirty = alpha.run("status", "--porcelain=v1", "-z", "-unormal", "--ignore-submodules=all").out
        self.assertIn(" M README.md", dirty)
        self.assertIn("?? notes.txt", dirty)
        self.assertEqual(alpha.run("rev-list", "--left-right", "--count", "@{u}...HEAD").out.split(), ["0", "1"])


class FixerRegressionTests(fixture.EstateTestCase):
    """Review findings S1, S3, S4 and PRIV-6: programs git would run from config, the stale-lock
    race and each ignore guard on its own."""

    def test_status_is_refused_where_a_filter_driver_is_configured(self):
        import census
        repo = fixture.make_repo(os.path.join(self.case_dir(), "filtered"), home=self.tmp,
                                 files={".gitattributes": "*.txt filter=probe\n", "a.txt": "a\n"})
        marker = os.path.join(repo, "MARKER")
        fixture.git(repo, "config", "filter.probe.clean", "sh -c 'echo ran >> %s; cat'" % marker, home=self.tmp)
        future = time.time() + 5
        os.utime(os.path.join(repo, "a.txt"), (future, future))  # stat-dirty: status would re-hash it
        runner = safety.GitRunner(repo)
        self.assertEqual(runner.filter_state(), (True, ["filter.probe.clean"]))
        with self.assertRaises(safety.GitRefused):
            runner.run("status", "--porcelain=v1", "-z", "-unormal", "--ignore-submodules=all")
        rec = census.measure(repo, home=self.tmp)
        self.assertEqual(rec["dirty"]["mode"], "unknown")
        self.assertIsNone(rec["dirty"]["modified"])
        self.assertTrue(any("filter drivers configured" in e for e in rec["errors"]))
        self.assertEqual(rec["measure_status"], "partial")
        self.assertFalse(os.path.exists(marker), "the clean filter ran")

    def test_signature_verification_is_never_asked_for(self):
        self.assertIn("log.showSignature=false", safety.GIT_PREFIX)
        self.assertIn("gpg.program=/usr/bin/false", safety.GIT_PREFIX)
        runner = safety.GitRunner(self.case_dir())
        for fmt in ("--format=%G?", "--format=%H%x00%GS"):
            with self.assertRaises(safety.GitRefused):
                runner.check_allowed("log", ("-1", fmt))
        runner.check_allowed("log", ("-1", "--format=%ct%x00%an"))

    def test_two_builds_never_both_take_a_stale_lock(self):
        private = self.case_dir()
        os.chmod(private, 0o700)
        proc = subprocess.Popen(["git", "--version"], stdout=subprocess.DEVNULL)
        proc.wait()
        fixture.write_file(os.path.join(private, safety.LOCK_NAME),
                           json.dumps({"pid": proc.pid, "started_at": safety.iso(dt.datetime.now(dt.timezone.utc))}),
                           mode=0o600)
        late = safety.RunLock(private)
        dir_fd = os.open(private, os.O_RDONLY | os.O_DIRECTORY)
        try:
            seen = late._inspect(dir_fd)  # B judges the lock stale ...
            self.assertTrue(seen["stale"])
            with contextlib.redirect_stderr(io.StringIO()):
                first = safety.RunLock(private).acquire()  # ... A recovers it and takes the lock ...
            self.assertFalse(late._take_stale(dir_fd, seen["raw"]))  # ... and B must not remove A's lock
        finally:
            os.close(dir_fd)
        with open(os.path.join(private, safety.LOCK_NAME)) as stream:
            self.assertEqual(json.load(stream)["nonce"], first.nonce)
        self.assertEqual(sorted(os.listdir(private)), [safety.LOCK_NAME])
        first.release()

    def test_each_ignore_guard_is_checked_on_its_own(self):
        host = os.path.join(self.case_dir(), "host")
        layer = fixture.make_host(host, home=self.tmp)
        area = safety.PrivateArea(layer)
        self.assertEqual(area.guard_problems(), [])
        gitignore = os.path.join(layer, ".gitignore")
        with open(gitignore) as stream:
            original = stream.read()
        fixture.write_file(gitignore, original.replace("/" + "private/\n", ""))
        with self.assertRaises(safety.GuardError) as ctx:
            area.preflight(host)
        self.assertTrue(any(r.startswith("guard 1") for r in ctx.exception.reasons), ctx.exception.reasons)
        fixture.write_file(gitignore, original)
        inner = os.path.join(layer, "private", ".gitignore")
        os.chmod(inner, 0o600)
        os.remove(inner)
        with self.assertRaises(safety.GuardError) as ctx:
            area.preflight(host)
        self.assertTrue(any(r.startswith("guard 2") for r in ctx.exception.reasons), ctx.exception.reasons)
