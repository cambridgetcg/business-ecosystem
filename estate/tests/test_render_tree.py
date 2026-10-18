"""Render and tree tests: the seven views of one build and the symlink tree, over the synthetic
estate of spec 13 (census, foundation and sources read for real, as test_model does).

Covers spec 13 render/tree: the cycle guard refuses the home repository and the host, contested
records are linked under every candidate layer beside _CONTESTED.txt, no off-enum or unknown
directory exists, ATLAS.html makes no external reference and escapes planted markup, check_tree
fails on a hand-added link and on a path whose repository changed, and every view is 0600 with
a SHA256SUMS that verifies. Planted strings are built in parts so this file passes the lint."""
import copy
import json
import os
import re
import stat
import tomllib
from html.parser import HTMLParser

from . import fixture
from . import test_model
import curate
import model
import proposals
import render
import safety
import tree

VOCAB = test_model.VOCAB
PLANTED = "<" + "script>x</" + "script>"
OFF_ENUM_SEGMENTS = {"boot", "registry", "userland", "unknown", "unset"}
LOCAL_FOO = model.LOCAL + fixture.HOME_REL + "x/foo"


class _Tags(HTMLParser):
    """Every start tag with its attributes, plus the text of each <script>."""

    def __init__(self):
        super().__init__()
        self.tags, self.scripts, self._script = [], [], None

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))
        if tag == "script":
            self._script = dict(attrs)

    def handle_data(self, data):
        if self._script is not None:
            self.scripts.append((self._script, data))

    def handle_endtag(self, tag):
        if tag == "script":
            self._script = None


def parse_html(text):
    parser = _Tags()
    parser.feed(text)
    return parser


def md_table(section):
    """Rows (lists of cells) of the first Markdown table in section, header row excluded;
    escaped pipes stay inside their cells."""
    rows = []
    for line in section.splitlines():
        if line.startswith("|"):
            if not line.startswith("|---"):
                rows.append([c.strip() for c in re.split(r"(?<!\\)\|", line.strip())[1:-1]])
        elif rows:
            break
    return rows[1:]


def md_section(markdown, heading):
    return markdown.split(heading + "\n", 1)[1].split("\n## ", 1)[0]


def read(path):
    with open(path, encoding="utf-8") as stream:
        return stream.read()


def walk(root):
    """{relpath: lstat} under root without following links."""
    out = {}
    for base, dirs, files in os.walk(root, followlinks=False):
        for name in dirs + files:
            path = os.path.join(base, name)
            out[os.path.relpath(path, root)] = os.lstat(path)
    return out


class RenderTreeTests(fixture.EstateTestCase):
    allow_bins = ("launchctl", "crontab", "gh", "bun")
    run_counter = 0

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        test_model.build_fixture(cls)
        e = cls.estate
        blobs = proposals.read_blobs(cls.foundation)
        cls.props = proposals.propose(cls.snapshot, cls.foundation, None, cls.curated.get("decisions"), blobs, None,
                                      curated=cls.curated, facets=VOCAB["facets"])
        cls.area = safety.PrivateArea(e.layer)
        cls.run_dir = cls.new_run()
        cls.tree = tree.build_tree(cls.run_dir, cls.snapshot, e.layer, None, home=e.home)
        cls.files = render.render_all(cls.run_dir, cls.snapshot, cls.props,
                                      {"mode": "full", "first_run": True, "tree": cls.tree},
                                      curated=cls.curated, vocab=VOCAB, portfolio=cls.srcs.get("portfolio"),
                                      home=e.home)
        cls.sums = safety.write_sums(cls.run_dir)
        cls.atlas_md = cls.read(cls.files["ATLAS.md"])
        cls.atlas_html = cls.read(cls.files["ATLAS.html"])
        cls.tree_dir = cls.tree["tree_dir"]
        cls.projects = {r["id"]: r for r in cls.snapshot["records"] if r["kind"] == "project"}

    @classmethod
    def new_run(cls):
        cls.run_counter += 1
        run_id = "20261017T120000Z-%04x" % cls.run_counter
        cls.area.mkdir("runs/" + run_id)
        cls.area.write("runs/%s/%s" % (run_id, safety.RUN_MARKER), run_id + "\n")
        return os.path.join(cls.area.root, "runs", run_id)

    read = staticmethod(read)

    def project_id(self, name, owner="github.com/cambridgetcg/"):
        return owner + name

    def links(self, tree_dir):
        return {rel: os.readlink(os.path.join(tree_dir, rel)) for rel, info in walk(tree_dir).items()
                if stat.S_ISLNK(info.st_mode)}

    # ── files, modes, sums ──────────────────────────────────────────────────────────────────

    def test_every_view_is_written_0600_into_the_run(self):
        self.assertEqual(set(self.files), set(render.VIEW_FILES))
        for name, path in self.files.items():
            self.assertEqual(os.path.dirname(path), os.path.realpath(self.run_dir), name)
            self.assertEqual(stat.S_IMODE(os.lstat(path).st_mode), 0o600, name)
        for rel, info in walk(self.run_dir).items():
            if stat.S_ISDIR(info.st_mode):
                self.assertEqual(stat.S_IMODE(info.st_mode), 0o700, rel)
            elif stat.S_ISREG(info.st_mode):
                self.assertEqual(stat.S_IMODE(info.st_mode), 0o600, rel)

    def test_sha256sums_cover_the_views_and_verify(self):
        report = safety.verify_sums(self.run_dir)
        self.assertTrue(report["ok"], report)
        listed = self.read(os.path.join(self.run_dir, safety.SUMS_NAME))
        for name in render.VIEW_FILES:
            self.assertIn("  " + name + "\n", listed)
        self.assertNotIn("  tree/", listed)

    def test_views_refuse_a_directory_that_is_not_a_marked_run(self):
        stray = self.area.mkdir("runs/not-a-run")
        with self.assertRaises(safety.GuardError):
            render.render_all(stray, self.snapshot, self.props, {}, home=self.estate.home)
        unmarked = self.area.mkdir("runs/20261017T120000Z-ffff")
        with self.assertRaises(safety.GuardError):
            render.render_all(unmarked, self.snapshot, self.props, {}, home=self.estate.home)
        with self.assertRaises(safety.GuardError):
            tree.build_tree(unmarked, self.snapshot, self.estate.layer, None, home=self.estate.home)
        with self.assertRaises(safety.GuardError):  # a run that already has a tree
            tree.build_tree(self.run_dir, self.snapshot, self.estate.layer, None, home=self.estate.home)

    # ── ATLAS.md ────────────────────────────────────────────────────────────────────────────

    def test_atlas_sections_follow_the_spec_order(self):
        headings = ["# Estate atlas", "## Layer × liveness", "## Standing ladder", "## §0 Foundation"]
        headings += ["## Layer %s" % layer for layer in fixture.LAYER_ORDER]
        headings += ["## Disputed", "## Unplaced", "## Surfaces and zones", "## Schedulers", "## Business (secondary)",
                     "## Freshness", "## Proposals", "## Questions for Yu"]
        positions = [self.atlas_md.index(h + "\n") if h != "# Estate atlas" else self.atlas_md.index(h)
                     for h in headings]
        self.assertEqual(positions, sorted(positions))
        header = self.atlas_md[:positions[1]]
        worst = self.snapshot["worst_source"]
        self.assertIn("WORST SOURCE: %s — %s" % (worst["id"], worst["freshness"]), header)
        self.assertIn("Computed: ", header)
        self.assertIn("CITIZENS.md founding citizens | CITIZENS.md | 53 | 3", header)
        self.assertIn("one copy only", header)

    def test_matrix_partitions_records_and_counts_contested_once(self):
        rows = {r[0]: r for r in md_table(md_section(self.atlas_md, "## Layer × liveness"))}
        present = [p for p in self.projects.values() if p["presence"] == "present"]
        contested = [p for p in present if p["facets"]["layer"]["status"] == "contested"]
        self.assertIn(self.project_id("citizen-ada"), [p["id"] for p in contested])
        total = int(rows["total"][-1])
        self.assertEqual(total, len(present))
        contested_row = next(r for label, r in rows.items() if label.startswith("contested"))
        self.assertEqual(int(contested_row[-1]), len(contested))
        settled = {layer: sum(1 for p in present if p["facets"]["layer"]["status"] == "settled"
                              and p["facets"]["layer"]["value"] == layer) for layer in fixture.LAYER_ORDER}
        for layer in fixture.LAYER_ORDER:
            self.assertEqual(int(rows[layer][-1]), settled[layer], layer)
        self.assertEqual(sum(int(r[-1]) for label, r in rows.items() if label != "total"), total)

    def test_foundation_states_the_missing_os_row_and_invents_nothing(self):
        foundation = self.atlas_md.split("## §0 Foundation\n", 1)[1].split("\n## Layer soul", 1)[0]
        self.assertIn("ARCHITECTURE has no os row; no one-liner is invented for it.", foundation)
        self.assertIn("| os | — (no row) | — (none; not invented) |", foundation)
        self.assertIn("| commerce | PROJECTS |", foundation)
        self.assertIn("| commerce | COMMERCE |", foundation)
        self.assertIn("dispute:citizen-layer", foundation)
        os_section = self.atlas_md.split("## Layer os\n\n", 1)[1]
        self.assertTrue(os_section.startswith("ARCHITECTURE has no os row; no one-liner."))

    def test_layer_sections_show_contested_stubs_and_rows(self):
        soul = self.atlas_md.split("## Layer soul\n", 1)[1].split("\n## Layer runtime", 1)[0]
        fleet = self.atlas_md.split("## Layer fleet\n", 1)[1].split("\n## Layer economy", 1)[0]
        for section in (soul, fleet):
            # Labelled by the group defined by the members themselves, not by a checkout location.
            self.assertIn("- → 2 fixture citizens, contested fleet\\|soul; see Disputed", section)
        economy = self.atlas_md.split("## Layer economy\n", 1)[1].split("\n## Layer commerce", 1)[0]
        self.assertIn("| zerone-mini |", economy)
        self.assertIn("active ≠ dormant", economy)
        disputed = self.atlas_md.split("## Disputed\n", 1)[1].split("\n## Unplaced", 1)[0]
        self.assertIn("fixture citizens (2): citizen-ada, citizen-bo", disputed)
        self.assertIn("soul ← card @worktree; fleet ← harvest:fleet @worktree", disputed)
        unplaced = self.atlas_md.split("## Unplaced\n", 1)[1].split("\n## Surfaces", 1)[0]
        cy = self.projects[self.project_id("citizen-cy")]
        p01 = [p for p in cy["proposals"] if p.startswith("prop:P01:")]
        self.assertTrue(p01)
        self.assertIn(p01[0], unplaced)

    # ── ATLAS.html ──────────────────────────────────────────────────────────────────────────

    def test_html_is_self_contained_with_csp(self):
        parsed = parse_html(self.atlas_html)
        external = [(tag, k, val) for tag, attrs in parsed.tags for k, val in attrs.items()
                    if k in ("src", "href", "action", "srcset") and val and re.match(r"(?i)\s*(https?:)?//", val)]
        self.assertEqual(external, [])
        self.assertFalse([t for t, _ in parsed.tags if t in ("link", "img", "iframe", "object", "embed", "base")])
        self.assertTrue(all("src" not in attrs for tag, attrs in parsed.tags if tag == "script"))
        csp = [attrs.get("content") for tag, attrs in parsed.tags
               if tag == "meta" and (attrs.get("http-equiv") or "").lower() == "content-security-policy"]
        self.assertEqual(len(csp), 1)
        self.assertTrue(csp[0].startswith("default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"))
        data = [text for attrs, text in parsed.scripts if attrs.get("type") == "application/json"]
        self.assertEqual(len(data), 1)
        self.assertNotIn("</", data[0])
        payload = json.loads(data[0])
        self.assertEqual(payload["facets"], list(model.NAVIGATION))
        ada = next(r for r in payload["records"] if r["id"] == self.project_id("citizen-ada"))
        self.assertEqual(sorted(ada["f"]["layer"]), ["fleet", "soul"])
        self.assertTrue(ada["citizen"])
        self.assertIn("prefers-color-scheme: dark", self.atlas_html)
        for control in ('id="q"', 'id="t-citizens"', 'id="t-incidental"', 'id="chips"'):
            self.assertIn(control, self.atlas_html)
        ids = {attrs.get("data-id") for tag, attrs in parsed.tags if attrs.get("class") == "rec"}
        self.assertEqual(ids, {p["id"] for p in self.projects.values() if p["presence"] == "present"})

    def test_planted_markup_renders_escaped(self):
        snapshot = copy.deepcopy(self.snapshot)
        alpha = next(r for r in snapshot["records"] if r["id"] == self.project_id("alpha-service"))
        alpha["name"] = PLANTED
        alpha["curated"]["what"] = "</" + "script><img src=https://evil.example/x.png> & more"
        run = self.new_run()
        files = render.render_all(run, snapshot, self.props, {}, curated=self.curated, vocab=VOCAB, home=self.estate.home)
        page = self.read(files["ATLAS.html"])
        self.assertNotIn(PLANTED, page)
        self.assertIn("&lt;script&gt;x&lt;/script&gt;", page)
        parsed = parse_html(page)
        self.assertEqual([t for t, _ in parsed.tags].count("script"), 2)
        self.assertFalse([t for t, _ in parsed.tags if t == "img"])
        payload = json.loads(next(text for attrs, text in parsed.scripts if attrs.get("type") == "application/json"))
        self.assertTrue(any(PLANTED in r["s"] for r in payload["records"]))
        atlas_md = self.read(files["ATLAS.md"])
        self.assertNotIn(PLANTED, atlas_md)
        self.assertIn("\\<script\\>x\\</script\\>", atlas_md)

    # ── the other views ─────────────────────────────────────────────────────────────────────

    def test_proposals_drift_queue_attention_shapes(self):
        text = self.read(self.files["PROPOSALS.md"])
        for prop in self.props:
            self.assertIn(prop["id"], text)
        self.assertIn("## Owner: kingdom-os", text)
        card = next(p for p in self.props if p["rule"] == "P01")
        self.assertIn(card["proposed"]["card_text"].splitlines()[0], text)
        drift = self.read(self.files["DRIFT.md"])
        positions = [drift.index("## %d. " % n) for n in range(1, 7)]
        self.assertEqual(positions, sorted(positions))
        self.assertIn(curate.RISKS["hollow"], drift.split("## 6. ", 1)[1])
        self.assertIn("No previous tree manifest", drift)
        queue = self.read(self.files["QUEUE.md"])
        for reason in {q["reason"] for q in self.snapshot["queue"]}:
            self.assertIn("## %s (" % reason, queue)
        attention = self.read(self.files["ATTENTION.md"])
        for risk in {a["risk"] for a in self.snapshot["attention"]}:
            self.assertIn("## %s (" % risk, attention)
        self.assertNotIn(fixture.NEVER_READ, attention)

    def test_portfolio_join_keys_overlay_facets_by_v1_ids(self):
        join = json.loads(self.read(self.files["portfolio-join.json"]))
        self.assertEqual(join["schema"], render.JOIN_SCHEMA)
        self.assertEqual(join["source_map"]["schema"], "business-ecosystem.portfolio-map/1")
        repo = next(r for r in join["repositories"] if r["portfolio_id"] == "repo-1")
        self.assertEqual(repo["overlay_id"], self.project_id("alpha-service"))
        self.assertEqual(repo["extensions"]["kingdom"]["layer"], {"value": "runtime", "status": "settled"})
        self.assertEqual(repo["extensions"]["overlay"]["family"]["value"], "agenttool-services")
        surface = next(s for s in join["surfaces"] if s["portfolio_resource_id"] == "pages:alpha")
        self.assertEqual(surface["attribution_v1"], "current_tracked_config")
        self.assertIs(surface["agree"], surface["attribution_v1"] == surface["attribution_overlay"])
        self.assertIn({"portfolio_id": "zone-1", "overlay_id": "zone:example.dev"}, join["zones"])
        self.assertIn(self.project_id("plain-tool"), join["unjoined"]["overlay_github"])

    # ── tree ────────────────────────────────────────────────────────────────────────────────

    def test_cycle_guard_refuses_home_and_host(self):
        refused = {(r["record_id"], r["reason"]) for r in self.tree["refused"]}
        home_id = model.LOCAL + "~"
        host_id = self.project_id("business-ecosystem")
        self.assertIn((home_id, "cycle-refused"), refused)
        self.assertIn((host_id, "cycle-refused"), refused)
        not_linked = self.read(os.path.join(self.tree_dir, tree.NOT_LINKED))
        cycle = not_linked.split("== cycle-refused", 1)[1].split("\n==", 1)[0]
        self.assertIn("(%s)" % home_id, cycle)
        self.assertIn("(%s)" % host_id, cycle)
        layer = os.path.realpath(self.estate.layer)
        forbidden = {os.path.realpath(self.estate.home), os.path.realpath(self.estate.host)}
        for rel, target in self.links(self.tree_dir).items():
            real = os.path.realpath(os.path.join(self.tree_dir, rel))
            self.assertEqual(target, real, rel)  # absolute, already the realpath
            self.assertNotIn(real, forbidden, rel)
            self.assertFalse(layer == real or layer.startswith(real + os.sep) or real.startswith(layer + os.sep), rel)

    def test_contested_citizens_are_linked_under_both_layers(self):
        citizens_home = os.path.realpath(os.path.join(self.estate.desktop, "citizens"))
        carded = [p for p in self.estate.citizens if os.path.exists(os.path.join(p, "kingdom.yaml"))]
        self.assertEqual(len(carded), 2)
        for layer in ("soul", "fleet"):
            family_dir = os.path.join(self.tree_dir, tree.LAYER, layer, "fleet-citizens")
            link = os.path.join(family_dir, "_desktop-citizens")
            self.assertEqual(os.readlink(link), citizens_home)
            for path in carded:
                self.assertTrue(os.path.realpath(path).startswith(os.path.realpath(link) + os.sep))
            for where in (family_dir, os.path.dirname(family_dir)):
                note = self.read(os.path.join(where, tree.CONTESTED))
                for name in ("citizen-ada", "citizen-bo"):
                    self.assertIn(self.project_id(name), note)
                p10 = [p for p in self.projects[self.project_id("citizen-ada")]["proposals"] if p.startswith("prop:P10:")]
                self.assertIn(p10[0], note)
                self.assertIn("soul <- card @worktree; fleet <- harvest:fleet @worktree", note)

    def test_contested_records_without_a_group_home_are_linked_one_by_one(self):
        snapshot = copy.deepcopy(self.snapshot)
        snapshot["records"] = [r for r in snapshot["records"] if r["kind"] != "group"]
        renamed = next(r for r in snapshot["records"] if r["id"] == self.project_id("plain-tool"))
        renamed["name"] = "unknown"
        run = self.new_run()
        result = tree.build_tree(run, snapshot, self.estate.layer, None, home=self.estate.home)
        ada = os.path.realpath(next(p for p in self.estate.citizens if p.endswith("citizen-ada")))
        for layer in ("soul", "fleet"):
            link = os.path.join(result["tree_dir"], tree.LAYER, layer, "fleet-citizens", "citizen-ada")
            self.assertEqual(os.readlink(link), ada)
            self.assertTrue(os.path.isfile(os.path.join(os.path.dirname(link), tree.CONTESTED)))
        self.assertTrue(os.path.islink(os.path.join(result["tree_dir"], tree.NAME, "unknown@cambridgetcg")))
        self.assert_no_off_enum_segments(result["tree_dir"])

    def assert_no_off_enum_segments(self, tree_dir):
        for rel in walk(tree_dir):
            self.assertFalse(set(rel.split(os.sep)) & OFF_ENUM_SEGMENTS, rel)

    def test_no_directory_is_named_after_an_off_enum_value_or_unknown(self):
        self.assert_no_off_enum_segments(self.tree_dir)
        layer_dirs = set(os.listdir(os.path.join(self.tree_dir, tree.LAYER)))
        self.assertTrue(layer_dirs <= set(fixture.LAYER_ORDER))
        lantern = self.projects[self.project_id("boot-lantern")]
        self.assertEqual(lantern["kingdom"]["off_enum"]["layer"], "boot")

    def test_foundation_axis_links_the_taxonomy_sources(self):
        base = os.path.join(self.tree_dir, tree.FOUNDATION)
        self.assertEqual(os.readlink(os.path.join(base, "kingdom-os")), os.path.realpath(self.estate.kos.path))
        self.assertEqual(os.readlink(os.path.join(base, "kingdom-realm")), os.path.realpath(self.estate.realm))
        readme = self.read(os.path.join(base, tree.README))
        self.assertIn("not an extra layer", readme)
        self.assertIn(self.estate.kos.worktree_commit, readme)
        self.assertIn(" ".join(fixture.LAYER_ORDER), readme)
        root = self.read(os.path.join(self.tree_dir, tree.README))
        self.assertIn("never hand-edit", root)
        self.assertIn("estate untree", root)

    def test_other_axes(self):
        names = set(os.listdir(os.path.join(self.tree_dir, tree.NAME)))
        self.assertIn("alpha-service", names)
        self.assertNotIn("business-ecosystem", names)
        self.assertNotIn("forge-only-thing", names)
        self.assertEqual(os.listdir(os.path.join(self.tree_dir, tree.LIVE)), ["alpha-service"])
        self.assertIn("public-door", os.listdir(os.path.join(self.tree_dir, tree.ROLE)))
        self.assertEqual(os.readlink(os.path.join(self.tree_dir, tree.GROUPS, "fleet-citizens.desktop-citizens")),
                         os.path.realpath(os.path.join(self.estate.desktop, "citizens")))
        worktree = os.path.realpath(self.estate.worktree)
        self.assertNotIn(worktree, self.links(self.tree_dir).values())

    def test_check_tree_is_clean_on_an_unmodified_build(self):
        report = tree.check_tree(self.tree_dir)
        self.assertEqual((report["ok"], report["exit"]), (True, 0), report)
        self.assertEqual(report["checked"], self.tree["links"])

    def test_check_tree_flags_hand_edits(self):
        run = self.new_run()
        result = tree.build_tree(run, self.snapshot, self.estate.layer, self.tree["manifest"], home=self.estate.home)
        self.assertTrue(result["diff"]["baseline"])
        self.assertEqual((result["diff"]["added"], result["diff"]["removed"], result["diff"]["retargeted"]), ([], [], []))
        tree_dir = result["tree_dir"]
        os.symlink(self.estate.desktop, os.path.join(tree_dir, tree.NAME, "hand-added"))
        report = tree.check_tree(tree_dir)
        self.assertEqual(report["exit"], 1)
        self.assertEqual([e["path"] for e in report["extra"]], [tree.NAME + "/hand-added"])
        os.unlink(os.path.join(tree_dir, tree.NAME, "plain-tool"))
        retarget = os.path.join(tree_dir, tree.NAME, "infra-tf")
        os.unlink(retarget)
        os.symlink(os.path.realpath(self.estate.repos["beta-site"]), retarget)
        with open(os.path.join(tree_dir, tree.NOT_LINKED), "a", encoding="utf-8") as stream:
            stream.write("hand note\n")
        report = tree.check_tree(tree_dir)
        self.assertIn({"path": tree.NAME + "/plain-tool"}, report["missing"])
        mismatched = {e["path"] for e in report["mismatched"]}
        self.assertIn(tree.NAME + "/infra-tf", mismatched)
        self.assertIn(tree.NOT_LINKED, mismatched)

    def test_check_tree_flags_a_path_whose_repository_changed(self):
        run = self.new_run()
        result = tree.build_tree(run, self.snapshot, self.estate.layer, None, home=self.estate.home)
        repo = self.estate.repos["alpha-service"]
        original = "https://github.com/cambridgetcg/alpha-service.git"
        fixture.git(repo, "remote", "set-url", "origin", "https://github.com/cambridgetcg/someone-else.git",
                    home=self.estate.home)
        try:
            report = tree.check_tree(result["tree_dir"])
        finally:
            fixture.git(repo, "remote", "set-url", "origin", original, home=self.estate.home)
        self.assertEqual(report["exit"], 1)
        paths = {e["path"] for e in report["mismatched"]}
        self.assertIn(tree.NAME + "/alpha-service", paths)
        self.assertTrue(all("someone-else" in e["detail"] for e in report["mismatched"]))
        self.assertTrue(tree.check_tree(result["tree_dir"])["ok"])


    # ── review fixes (U1, U5, U6, U14) ──────────────────────────────────────────────────────

    def test_a_group_home_collapses_only_members_it_reaches_in_layers_they_all_share(self):
        snapshot = copy.deepcopy(self.snapshot)
        by_id = {r["id"]: r for r in snapshot["records"]}
        bo = by_id[self.project_id("citizen-bo")]
        bo["facets"]["layer"] = dict(bo["facets"]["layer"], status="settled", value="soul")
        run = self.new_run()
        result = tree.build_tree(run, snapshot, self.estate.layer, None, home=self.estate.home)
        base = os.path.join(result["tree_dir"], tree.LAYER)
        self.assertTrue(os.path.islink(os.path.join(base, "soul", "fleet-citizens", "_desktop-citizens")))
        # In fleet only citizen-ada lands, so the home is not linked there and ada is linked alone.
        self.assertFalse(os.path.lexists(os.path.join(base, "fleet", "fleet-citizens", "_desktop-citizens")))
        self.assertTrue(os.path.islink(os.path.join(base, "fleet", "fleet-citizens", "citizen-ada")))
        # A home that does not hold the members' checkouts collapses nobody.
        snapshot = copy.deepcopy(self.snapshot)
        elsewhere = os.path.join(self.estate.home, "Desktop", "kingdom-mcp")
        for record in snapshot["records"]:
            if record["id"] == "group:fleet-citizens/desktop-citizens":
                record["canonical_location"] = elsewhere
        run = self.new_run()
        result = tree.build_tree(run, snapshot, self.estate.layer, None, home=self.estate.home)
        for layer in ("soul", "fleet"):
            family_dir = os.path.join(result["tree_dir"], tree.LAYER, layer, "fleet-citizens")
            self.assertFalse(os.path.lexists(os.path.join(family_dir, "_desktop-citizens")), layer)
            self.assertTrue(os.path.islink(os.path.join(family_dir, "citizen-ada")), layer)

    def test_the_atlas_has_a_contents_list(self):
        self.assertIn('<nav class="toc"', self.atlas_html)
        for anchor in ("#matrix", "#unplaced", "#surfaces", "#schedulers", "#freshness", "#questions"):
            self.assertIn('href="%s"' % anchor, self.atlas_html)
        self.assertIn("Contents: ", self.atlas_md)

    def test_unplaced_records_are_described_like_placed_ones(self):
        unplaced = self.atlas_md.split("## Unplaced\n", 1)[1].split("\n## Surfaces", 1)[0]
        # sphere: owner decision D4's KINGDOM OS facet, on every project line.
        self.assertIn("| name | what | kind | sphere | state vs liveness | role | hosting | running | standing |", unplaced)
        self.assertIn("orphaned curation", unplaced)  # ghost-project, curated but found nowhere

    def test_group_lines_carry_what_kingdom_says_and_counts_are_distinct(self):
        self.assertIn("KINGDOM layer", self.atlas_md)
        self.assertIn("projects placed here", self.atlas_md)


class TreeUnitTests(fixture.EstateTestCase):

    def test_names_are_sanitized_and_collisions_suffixed(self):
        projects = [{"id": "github.com/a/Foo", "name": "Foo"}, {"id": "github.com/b/foo", "name": "foo"},
                    {"id": "github.com/c/.hidden", "name": ".hidden"}, {"id": "github.com/c/sp", "name": "we ird/na_me"},
                    {"id": LOCAL_FOO, "name": "foo"}, {"id": "codeberg.org/d/unknown", "name": "unknown"},
                    {"id": "github.com/e/citizens", "name": "_citizens"}]
        names = tree.assign_names(projects)
        self.assertEqual(names["github.com/a/Foo"], "Foo@a")
        self.assertEqual(names["github.com/b/foo"], "foo@b")
        self.assertEqual(names[LOCAL_FOO], "foo@local")
        self.assertEqual(names["github.com/c/.hidden"], "dot-hidden")
        self.assertEqual(names["github.com/c/sp"], "we-ird-na_me")
        self.assertEqual(names["github.com/e/citizens"], "_citizens@e")
        self.assertEqual(names["codeberg.org/d/unknown"], "unknown@d")
        twins = tree.assign_names([{"id": "github.com/a/x", "name": "x"}, {"id": "codeberg.org/a/x", "name": "x"}])
        self.assertEqual(len({n.lower() for n in twins.values()}), 2)
        self.assertTrue(all(re.fullmatch(r"[A-Za-z0-9._@-]+", n) for n in list(names.values()) + list(twins.values())))

    def test_group_locator_takes_the_leading_locator_only(self):
        home = fixture.HOME_REL
        self.assertEqual(tree.group_locator(home + "x/citizens (living homes); this set is a mirror"), home + "x/citizens")
        self.assertEqual(tree.group_locator("/srv/a, /srv/b"), "/srv/a")
        # One home per member: the directory holding them is the group's home.
        self.assertEqual(tree.group_locator(home + "x/citizen-<name>"), home + "x")
        for unusable in (home + "<who>/citizen-x", "(forge-only) github.com/o/npl-*", home + "x/*", home + "<name>",
                         "", None):
            self.assertIsNone(tree.group_locator(unusable), unusable)
        self.assertEqual(tree.group_locator("inside " + home + ".codex"), "inside")  # expand_locator then refuses it

    def test_link_self_check(self):
        root = self.case_dir()
        estate = os.path.join(root, "host", "estate")
        os.makedirs(os.path.join(estate, "private", "inner"))
        repo = fixture.make_repo(os.path.join(root, "repo"), home=root)
        plain = os.path.join(root, "plain")
        os.makedirs(plain)
        a_file = fixture.write_file(os.path.join(root, "file.txt"), "x")
        real = os.path.realpath(estate)
        self.assertIsNone(tree.link_problem(repo, real))
        self.assertEqual(tree.link_problem(os.path.join(root, "absent"), real), "target-missing")
        self.assertEqual(tree.link_problem(a_file, real), "target-not-directory")
        self.assertEqual(tree.link_problem(plain, real), "no-git-entry")
        self.assertIsNone(tree.link_problem(plain, real, need_git=False))
        self.assertEqual(tree.link_problem(estate, real), "cycle-refused")
        self.assertEqual(tree.link_problem(os.path.join(root, "host"), real, need_git=False), "cycle-refused")
        self.assertEqual(tree.link_problem(root, real, need_git=False), "cycle-refused")
        self.assertEqual(tree.link_problem(os.path.join(estate, "private", "inner"), real, need_git=False),
                         "inside-estate")
        self.assertEqual(tree.link_problem("relative/path", real), "target-not-absolute")

    def test_diff_manifests(self):
        prev = {"entries": [{"path": "5-name/a", "target": "/t/a"}, {"path": "5-name/b", "target": "/t/b"}],
                "refused": [{"record_id": "x", "reason": "cycle-refused"}]}
        current = {"entries": [{"path": "5-name/a", "target": "/t/a2"}, {"path": "5-name/c", "target": "/t/c"}],
                   "refused": [{"record_id": "x", "reason": "cycle-refused"}, {"record_id": "y", "reason": "target-missing"}]}
        diff = tree.diff_manifests(prev, current)
        self.assertEqual(diff["added"], ["5-name/c"])
        self.assertEqual(diff["removed"], ["5-name/b"])
        self.assertEqual(diff["retargeted"], [{"path": "5-name/a", "from": "/t/a", "to": "/t/a2"}])
        self.assertEqual(diff["refused"], [{"record_id": "y", "reason": "target-missing"}])
        self.assertFalse(tree.diff_manifests(None, current)["baseline"])

    def test_untree_removes_every_tree_through_the_marker_gate(self):
        host = self.case_dir("untree")
        layer = fixture.make_layer(host)
        area = safety.PrivateArea(layer)
        config = "# owner config\n[kingdom]\nref = \"worktree\"\n\n[tree]\n# keep the tree\nenabled = true\n"
        fixture.write_file(os.path.join(area.root, "config.toml"), config, mode=0o600)
        target = fixture.make_repo(os.path.join(host, "elsewhere", "repo"), home=host)
        runs = []
        for number in (1, 2):
            run_id = "20261017T130000Z-%04x" % number
            area.mkdir("runs/" + run_id)
            area.write("runs/%s/%s" % (run_id, safety.RUN_MARKER), run_id + "\n")
            area.write("runs/%s/run.json" % run_id, "{}\n")
            area.mkdir("runs/%s/tree/5-name" % run_id)
            area.symlink("runs/%s/tree/5-name/repo" % run_id, target)
            area.write("runs/%s/tree/%s" % (run_id, tree.MANIFEST), json.dumps({"schema": tree.SCHEMA, "entries": []}))
            safety.write_sums(os.path.join(area.root, "runs", run_id))
            runs.append(os.path.join(area.root, "runs", run_id))
        decoy = area.mkdir("runs/20261017T130000Z-dddd")
        area.mkdir("runs/20261017T130000Z-dddd/tree")
        area.symlink("current", "runs/" + os.path.basename(runs[-1]))
        area.symlink("tree", "current/tree")
        self.assertEqual(area.ensure_root_link("tree"), "created")
        report = tree.untree(area.root)
        self.assertEqual(report["config"], "disabled")
        self.assertEqual(sorted(report["runs"]), [os.path.basename(r) for r in runs])
        self.assertEqual(report["runs"][os.path.basename(runs[0])], {"files": 1, "links": 1, "dirs": 2})
        self.assertEqual([r["run"] for r in report["refused"]], [os.path.basename(decoy)])
        self.assertFalse(report["ok"])
        self.assertEqual((report["private_link"], report["root_link"]), ("removed", "removed"))
        for run in runs:
            self.assertFalse(os.path.lexists(os.path.join(run, tree.TREE)))
            self.assertTrue(safety.verify_sums(run)["ok"])
        self.assertTrue(os.path.isdir(os.path.join(decoy, "tree")))
        self.assertTrue(os.path.isdir(target))
        self.assertFalse(os.path.lexists(os.path.join(layer, "tree")))
        text = read(os.path.join(area.root, "config.toml"))
        self.assertIn("# keep the tree", text)
        self.assertIs(tomllib.loads(text)["tree"]["enabled"], False)
        self.assertEqual(tomllib.loads(text)["kingdom"]["ref"], "worktree")
        self.assertEqual(stat.S_IMODE(os.lstat(os.path.join(area.root, "config.toml")).st_mode), 0o600)
        self.assertEqual(tree.untree(area.root)["config"], "unchanged")

    def test_untree_config_edits(self):
        self.assertEqual(tree._tree_disabled(""), "[tree]\nenabled = false\n")
        self.assertEqual(tomllib.loads(tree._tree_disabled("[forge]\nowners = []\n"))["tree"], {"enabled": False})
        self.assertEqual(tomllib.loads(tree._tree_disabled("[tree]\n[retention]\nruns = 5\n"))["tree"], {"enabled": False})
        layer = fixture.make_layer(self.case_dir("inline"))
        area = safety.PrivateArea(layer)
        inline = "tree = { enabled = true }\n"
        fixture.write_file(os.path.join(area.root, "config.toml"), inline, mode=0o600)
        with self.assertRaises(safety.GuardError):
            tree.untree(area.root)
        self.assertEqual(read(os.path.join(area.root, "config.toml")), inline)


class RenderUnitTests(fixture.EstateTestCase):

    def test_markdown_and_json_escaping(self):
        self.assertEqual(render.md("a|b <c> `d` [e] *f*"), "a\\|b \\<c\\> \\`d\\` \\[e\\] \\*f\\*")
        self.assertEqual(render.md("two\nlines"), "two lines")
        self.assertEqual(render.text(None), "—")
        raw = render.script_json({"x": PLANTED + " & <!-- -->"})
        self.assertNotIn("<", raw)
        self.assertEqual(json.loads(raw)["x"], PLANTED + " & <!-- -->")
        self.assertEqual(render._fence("a ``` b"), "````\na ``` b\n````")

    def test_missing_inputs_are_named_not_guessed(self):
        host = self.case_dir("bare")
        layer = fixture.make_layer(host)
        area = safety.PrivateArea(layer)
        run_id = "20261017T140000Z-0001"
        area.mkdir("runs/" + run_id)
        area.write("runs/%s/%s" % (run_id, safety.RUN_MARKER), run_id + "\n")
        files = render.render_all(os.path.join(area.root, "runs", run_id), [], [], None, home=host)
        atlas = read(files["ATLAS.md"])
        self.assertIn("WORST SOURCE: unknown", atlas)
        self.assertIn("Curated disputes: not provided to the renderer.", atlas)
        self.assertIn("Lock (vocab/kingdom.lock.toml): state not provided to the renderer.", atlas)
        drift = read(files["DRIFT.md"])
        self.assertIn("Mirror drift: not measured in this run", drift)
        join = json.loads(read(files["portfolio-join.json"]))
        self.assertIn("not provided", join["note"])
        self.assertEqual(join["repositories"], [])


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
