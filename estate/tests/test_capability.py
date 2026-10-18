"""Business capability map tests (tool/capability.py).

Unit cases cover the vocabulary (23 values in four bands, the run band equal to the framework
domains, no collision with navigation values or topics, the companion vocabularies) and the one
business population (business_scope), which the Business section and the map share."""
import datetime as dt
import os

from . import fixture
from . import test_model
import capability
import curate
import model

G = "github.com/cambridgetcg/"
FACETS = test_model.VOCAB["facets"]
ALLOWED = capability.values(FACETS)


def project(pid, layer=None, status=None, family=None, roles=(), kind=None, group=None, candidates=()):
    """A project record shaped as the join leaves it, before the capability step."""
    status = status or ("settled" if layer else "unset")
    return {"kind": "project", "id": pid, "aliases": [],
            "facets": {"layer": {"value": layer if status in ("settled", "roster-fallback") else None, "status": status,
                                 "candidates": [{"value": c, "source": "card"} for c in candidates]},
                       "kind": {"value": kind, "status": "settled" if kind else "unset", "candidates": []},
                       "family": {"value": family, "status": "set" if family else "unassigned"},
                       "role": {"values": list(roles), "status": "set" if roles else "unknown"}},
            "display": {"purpose_group": group}, "display_src": {}}


class VocabularyTests(fixture.EstateTestCase):

    def test_twenty_three_values_in_four_bands(self):
        self.assertEqual(len(ALLOWED), 23)
        bands = capability.bands(FACETS)
        self.assertEqual(list(bands), ["sell", "grow", "run", "own-funds"])
        members = [v for band in bands.values() for v in band]
        self.assertEqual(members, list(ALLOWED))  # each value in exactly one band, in the value order
        # The run band is the framework domains, the join key to business-ecosystem's domain packages.
        self.assertEqual(set(bands["run"]), set(curate.FRAMEWORK_DOMAINS))
        self.assertEqual(len(bands["run"]), len(curate.FRAMEWORK_DOMAINS))
        self.assertEqual(set(bands["run"]), set(FACETS["business"]["be.framework_domain"]["values"]))

    def test_no_value_collides_with_navigation_values_topics_or_statuses(self):
        table = FACETS["business"]["capability"]
        taken = set(curate.OVERLAY_NAV_VALUES) | set(curate.TOPICS) | set(table["statuses"])
        taken |= {v for values in fixture.KINGDOM_ENUMS.values() for v in values}
        self.assertEqual(set(ALLOWED) & taken, set())
        candidates = FACETS["capability_candidates"]["values"]
        self.assertEqual(candidates, ["customer-support"])
        self.assertEqual(set(candidates) & set(ALLOWED), set())

    def test_a_display_field_not_a_navigation_facet(self):
        self.assertNotIn("capability", model.NAVIGATION)
        self.assertNotIn("capability", FACETS["meta"]["navigation"])
        spec = test_model.VOCAB["records"]["kind"]["project"]["subfields"]["display"]["capability"]
        self.assertEqual((spec["type"], spec["enum"], spec["statuses"], spec["optional"]),
                         ("facet", "facets:business/capability", ["unassigned", "none"], True))
        table = FACETS["business"]["capability"]
        for basis in (capability.CURATED_PROJECT, capability.DERIVED_PACKAGES, capability.MIRROR, capability.NONE):
            self.assertIn(basis, table["bases"])
        self.assertIn("only an owner decision makes it one", table["rule"])

    def test_the_companion_vocabularies(self):
        self.assertEqual(capability.vocabulary(FACETS, "capability_impl"),
                         ("code", "code-unbuilt", "stub", "manual", "unread"))
        self.assertEqual(capability.vocabulary(FACETS, "capability_operating"),
                         ("in-use", "paused", "retired", "never", "unknown"))
        self.assertEqual(capability.vocabulary(FACETS, "capability_serves"), ("self", "customers", "both"))
        for name in ("capability_impl", "capability_operating", "capability_serves"):
            for value, definition in FACETS["vocab"][name]["values"].items():
                self.assertTrue(definition.strip(), "%s.%s" % (name, value))
        for value in ALLOWED:
            self.assertTrue(FACETS["business"]["capability"]["values"][value].strip(), value)

    def test_the_files_of_the_map_pass_the_privacy_lint(self):
        for rel in ("vocab/facets.toml", "vocab/records.toml", "tool/capability.py", "tests/test_capability.py"):
            with open(os.path.join(fixture.LAYER_DIR, rel), encoding="utf-8") as stream:
                text = stream.read()
            self.assertEqual(curate.lint_text(text, rel, curate.scope_of(rel)), [], rel)
            self.assertEqual(curate.lint_test_vectors(text, rel), [], rel)


class ScopeTests(fixture.EstateTestCase):

    def test_each_rule_of_the_one_business_population(self):
        cases = {
            "layer": (project(G + "a", "commerce"), ["layer commerce"]),
            "contested": (project(G + "b", status="contested", candidates=("soul", "economy")), ["layer economy"]),
            "group": (project(G + "c", group="payments_finance"), ["purpose group payments_finance"]),
            "family": (project(G + "d", family="commerce-tcg"), ["family commerce-tcg"]),
            "role": (project(G + "e", roles=("public-door", "revenue")), ["role revenue"]),
            "kind": (project(G + "f", kind="venture"), ["kind venture"]),
            "several": (project(G + "g", "economy", family="economy-ventures", roles=("revenue",)),
                        ["layer economy", "family economy-ventures", "role revenue"]),
            "outside": (project(G + "h", "soul", family="soul-core", roles=("doctrine",), group="creative_media"), []),
        }
        for name, (record, reasons) in cases.items():
            self.assertEqual(capability.business_scope(record), reasons, name)
        rule = capability.scope_rule()
        for word in capability.BUSINESS_GROUPS + capability.BUSINESS_FAMILIES + ("commerce or economy", "venture"):
            self.assertIn(word, rule)

    def test_in_scope_is_unassigned_and_outside_is_none_never_a_value(self):
        projects = {G + "shop": project(G + "shop", family="commerce-tcg"), G + "poem": project(G + "poem", "soul")}
        capability.resolve_projects(projects)
        shop, poem = (projects[G + n]["display"]["capability"] for n in ("shop", "poem"))
        self.assertEqual((shop["values"], shop["status"], shop["basis"], shop["scope"]),
                         ([], capability.UNASSIGNED, capability.NONE, ["family commerce-tcg"]))
        self.assertIn("in business scope", shop["reason"])
        self.assertEqual((poem["values"], poem["status"], poem["scope"]), ([], capability.NONE, []))
        summary = capability.summary(projects, ALLOWED, capability.bands(FACETS))
        self.assertEqual(summary["projects"], {"unassigned": 1, "none": 1})
        self.assertEqual((summary["in_scope"], summary["unassigned"]), (1, [G + "shop"]))
        self.assertEqual(set(summary["by_value"]), set(ALLOWED))

    def test_every_built_project_carries_the_field_and_validates(self):
        curated = test_model.empty_curated()
        curated["families"] = {"family:commerce-tcg": {"id": "family:commerce-tcg", "label": "commerce-tcg"}}
        curated["projects"] = {G + "shop": {"id": G + "shop", "family_id": "family:commerce-tcg"}}
        checkouts = [test_model.mini_checkout(test_model.repo_path(name), "https://%s%s.git" % (G, name))
                     for name in ("shop", "poem")]
        snapshot, _ = test_model.mini_build(checkouts, curated=curated)
        self.assertTrue(model.validate(snapshot, test_model.VOCAB["records"], facets=FACETS)["ok"])
        fields = {pid: p["display"]["capability"] for pid, p in test_model.projects(snapshot).items()}
        self.assertEqual(fields[G + "shop"]["status"], capability.UNASSIGNED)
        self.assertEqual(fields[G + "poem"]["status"], capability.NONE)
        self.assertEqual(snapshot["capability"]["unassigned"], [G + "shop"])
        # A stub carried from a run before the field existed still validates.
        for record in snapshot["records"]:
            record.get("display", {}).pop("capability", None)
        data = {"checkouts": checkouts[:1], "artifacts": [], "coverage": {}, "finished_at": test_model.NOW_ISO,
                "last_full_at": test_model.NOW_ISO}
        later = test_model.NOW + dt.timedelta(hours=2)
        second = model.build_records(data, test_model.mini_foundation(""), test_model.mini_sources(), curated,
                                     test_model.VOCAB, snapshot, {"kingdom": {"ref": "worktree"}}, now=later,
                                     home=test_model.MINI_HOME)
        self.assertIn(G + "poem", second["reconcile"]["missing"])
        self.assertTrue(model.validate(second, test_model.VOCAB["records"], facets=FACETS)["ok"])


if __name__ == "__main__":  # pragma: no cover
    import unittest
    unittest.main()
