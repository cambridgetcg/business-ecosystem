"""Synthetic, offline black-box regression tests; never load the private estate."""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / "scripts" / "portfolio.py"


def fixture():
    return {
        "schema": "business-ecosystem.portfolio-map/1",
        "privacy": "PRIVATE synthetic operator inventory",
        "observation_times": {"github": ["2025-01-01T00:00:00Z"], "cloudflare": "2025-01-02T00:00:00Z"},
        "scope": {"excluded": ["live endpoints"]},
        "semantics": {"primary_groups": ["knowledge_research", "unresolved"], "allowed_framework_domains": ["knowledge_outreach"]},
        "legal_entities": {"status": "not_established", "records": []},
        "runtime_integrations": {"status": "not_assessed", "certified_records": []},
        "repositories": [{
            "id": "github:repo:101", "repository": "sample/atlas", "full_name": "sample/atlas", "name": "atlas",
            "source_url": "https://github.com/sample/atlas", "group": "knowledge_research", "purpose": "Synthetic reference library",
            "framework_domains": ["knowledge_outreach"], "framework_relationship": "purpose_mapping_not_runtime_integration",
            "role_in_framework": "Reference only", "mapping_basis": "source_declaration", "confidence": "high",
            "evidence": [{"kind": "source_declaration", "locator": "https://github.com/sample/atlas/blob/" + "a" * 40 + "/README.md", "revision": "a" * 40, "note": "Declared purpose"}],
            "caveat": "Not runtime verified", "lifecycle": {"github_archived": False, "github_fork": False, "github_disabled": False, "source_card_state_literal": "active", "runtime_status": "not_assessed"},
            "github_metadata": {"id": 101, "private": True, "observed_default_branch_head": "a" * 40}, "source_card": None,
            "legal_entity_id": None, "hosting_resources": [],
        }],
        "surfaces": [{
            "id": "cloudflare:sample:pages:atlas", "resource_id": "pages:atlas", "account_id": "sample", "kind": "pages",
            "repository": None, "attribution": "candidate_only", "candidate_repositories": ["sample/atlas"],
            "evidence": [{"kind": "inventory_metadata", "locator": "saved.json#/pages/0", "note": "Saved observation, not read"}],
            "caveat": "No source assignment yet", "metadata": {"name": "atlas", "canonical_deployment": {"trigger": {"metadata": {"commit_dirty": True}}}},
            "bindings": [], "zone_routes": [], "group": "unresolved", "framework_domains": [], "framework_relationship": "not_assigned",
            "runtime_status": "not_probed", "legal_entity_id": None,
        }],
        "zones": [], "inputs": ["DO-NOT-READ.json"],
        "summary": {"repositories": 1, "private_repositories": 1, "archived_repositories": 0, "forks": 0, "groups": {"knowledge_research": 1}, "pages": 1, "workers": 0, "zones": 0, "source_relations": 0, "current_source_relations": 0, "historical_source_relations": 0, "unestablished_source_relations": 1, "new_source_relations": 0, "attribution": {"candidate_only": 1}, "dirty_pages_declarations": 1},
    }


class PortfolioTests(unittest.TestCase):
    def setUp(self):
        # tempfile honors the caller's explicit TMPDIR; CI may set its own private scratch.
        self.temp = tempfile.TemporaryDirectory(prefix="portfolio-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.map = self.root / "map.json"
        self.data = fixture()
        self.save()

    def save(self):
        self.map.write_text(json.dumps(self.data), encoding="utf-8")

    def run_cli(self, *args, map_path=None):
        return subprocess.run([sys.executable, "-B", str(CLI), "--map", str(map_path or self.map), *args], capture_output=True, text=True, cwd=self.root, timeout=10)

    def result(self, *args):
        run = self.run_cli(*args)
        self.assertEqual(run.returncode, 0, run.stderr)
        return json.loads(run.stdout)

    def test_summary_derives_counts_without_claiming_runtime_health(self):
        result = self.result("summary")
        self.assertEqual(result["computed"]["repositories"], 1)
        self.assertEqual(result["computed"]["unestablished_source_relations"], 1)
        self.assertEqual(result["computed"]["dirty_pages_declarations"], 1)
        self.assertNotIn("healthy", result["computed"])
        self.assertEqual(self.map.read_text(), json.dumps(self.data))

    def test_malformed_schema_is_rejected_without_partial_output(self):
        invalid = [None, [], {}, {**fixture(), "schema": "wrong"}]
        for field, value in [("repositories", {}), ("surfaces", None), ("zones", [None]), ("summary", []), ("semantics", None)]:
            invalid.append({**fixture(), field: value})
        for field, value in [("id", ""), ("purpose", 7), ("framework_domains", "not-a-list"), ("lifecycle", {}), ("github_metadata", {"private": "false"})]:
            item = fixture()
            item["repositories"][0][field] = value
            invalid.append(item)
        for value in invalid:
            with self.subTest(value_type=type(value).__name__):
                self.map.write_text(json.dumps(value))
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2)
                self.assertEqual(run.stdout, "")
                self.assertIn("error:", run.stderr)
                self.assertNotIn("Traceback", run.stderr)

    def test_identity_and_attribution_graph_refuses_conflicts(self):
        cases = []
        for section in ("repositories", "surfaces"):
            value = fixture()
            value[section].append(copy.deepcopy(value[section][0]))
            cases.append(value)
        for field, new in [("id", "other"), ("full_name", "sample/other")]:
            value = fixture()
            extra = copy.deepcopy(value["repositories"][0])
            extra[field] = new
            value["repositories"].append(extra)
            cases.append(value)
        for field, new in [("attribution", "guessed"), ("attribution", "current_tracked_config"), ("repository", "sample/atlas"), ("metadata", None), ("kind", "zone"), ("candidate_repositories", [7]), ("evidence", []), ("framework_domains", ["invented"])]:
            value = fixture()
            value["surfaces"][0][field] = new
            cases.append(value)
        value = fixture()
        value["repositories"][0]["hosting_resources"] = ["cloudflare:sample:pages:atlas"]
        cases.append(value)
        value = fixture()
        value["surfaces"][0].update(repository="sample/missing", attribution="current_source_document")
        cases.append(value)
        for value in cases:
            with self.subTest(case=cases.index(value)):
                self.data = value
                self.save()
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2, run.stdout)
                self.assertEqual(run.stdout, "")
                self.assertNotIn("Traceback", run.stderr)

    def test_input_reader_refuses_symlinks_and_non_regular_or_oversize_files(self):
        link = self.root / "linked.json"
        link.symlink_to(self.map)
        parent_link = self.root / "linked-dir"
        parent_link.symlink_to(self.root, target_is_directory=True)
        fifo = self.root / "pipe"
        os.mkfifo(fifo)
        oversized = self.root / "big.json"
        with oversized.open("wb") as stream:
            stream.truncate(8 * 1024 * 1024 + 1)
        for path in (link, parent_link / "map.json", fifo, oversized, self.root):
            with self.subTest(path=path.name):
                run = self.run_cli("summary", map_path=path)
                self.assertEqual(run.returncode, 2, run.stdout)
                self.assertNotIn("Traceback", run.stderr)

    def test_json_rejects_duplicate_keys_nonfinite_invalid_utf8_and_deep_nesting(self):
        valid = json.dumps(fixture())
        bad = [b"{", b"\xff", valid.replace('"schema":', '"schema": "ignored", "schema":', 1).encode(), valid.replace('"inputs": ["DO-NOT-READ.json"]', '"inputs": [NaN]').encode(), b"[" * 2000 + b"0" + b"]" * 2000]
        for raw in bad:
            with self.subTest(length=len(raw)):
                self.map.write_bytes(raw)
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2)
                self.assertEqual(run.stdout, "")
                self.assertNotIn("Traceback", run.stderr)

    def test_summary_flags_declared_disagreements_and_unverifiable_legacy_count(self):
        self.data["summary"]["repositories"] = 999
        self.data["summary"]["new_source_relations"] = 42
        self.save()
        result = self.result("summary")
        self.assertIn("disagreements", result)
        self.assertIn({"field": "repositories", "declared": 999, "computed": 1}, result["disagreements"])
        self.assertEqual(result["declared"]["new_source_relations"], 42)
        self.assertIsNone(result["computed"]["new_source_relations"])
        self.assertIn("new_source_relations", result["unverifiable"])

    def test_find_is_bounded_with_truthful_total_and_exact_records(self):
        result = self.result("find", "ATLAS", "--limit", "1")
        self.assertEqual(result["total_matches"], 2)
        self.assertEqual(result["returned_count"], 1)
        self.assertTrue(result["has_more"])
        self.assertEqual(result["results"][0]["record"], self.data["repositories"][0])
        self.assertEqual(self.result("find", "nonexistent")["total_matches"], 0)
        for limit in ("0", "101", "-1"):
            self.assertEqual(self.run_cli("find", "atlas", "--limit", limit).returncode, 2)

    def test_show_accepts_only_exact_identifiers_and_detects_ambiguity(self):
        for value in ("sample/atlas", "github:repo:101"):
            self.assertEqual(self.result("show", value)["record"], self.data["repositories"][0])
        self.assertEqual(self.result("show", "pages:atlas")["kind"], "surface")
        for value in ("atlas", "Sample/atlas", " sample/atlas"):
            self.assertEqual(self.run_cli("show", value).returncode, 2)
        self.data["repositories"][0]["id"] = "pages:atlas"
        self.save()
        run = self.run_cli("show", "pages:atlas")
        self.assertEqual(run.returncode, 2)
        self.assertIn("ambiguous", run.stderr)

    def test_queue_includes_all_review_reasons_without_double_counting_records(self):
        self.data["repositories"][0]["mapping_basis"] = "name_inference"
        repo = copy.deepcopy(self.data["repositories"][0])
        repo.update(id="github:repo:102", repository="sample/unknown", full_name="sample/unknown", name="unknown", mapping_basis="unresolved", group="unresolved")
        repo["github_metadata"]["id"] = 102
        self.data["repositories"].append(repo)
        for name, attribution, source in [("old", "historical_source_evidence", "https://codeberg.org/sample/archive"), ("unknown", "unresolved", None)]:
            surface = copy.deepcopy(self.data["surfaces"][0])
            surface.update(id="cloudflare:sample:workers:" + name, resource_id="workers:" + name, kind="workers", attribution=attribution, repository=source, metadata={})
            self.data["surfaces"].append(surface)
        self.save()
        result = self.result("queue")
        expected = {"candidate_only": 1, "unresolved": 1, "historical_source_evidence": 1, "purpose_unresolved": 1, "purpose_name_inferred": 1, "dirty_deployment": 1}
        self.assertEqual(result["counts_by_reason"], expected)
        self.assertEqual(result["findings_count"], sum(expected.values()))
        self.assertEqual(result["record_count"], len(self.data["repositories"] + self.data["surfaces"]))
        self.assertEqual(len(result["records"]), result["record_count"])
        self.assertEqual(result["records"][2]["reasons"], ["candidate_only", "dirty_deployment"])

    def test_render_exposes_repository_and_hosting_unknowns_without_active_content(self):
        payload = '<script>alert(1)</script>![track](https://invalid.test/pixel)'
        self.data["repositories"][0]["purpose"] = payload
        self.data["surfaces"][0]["caveat"] = payload
        self.save()
        for format in ("html", "markdown"):
            run = self.run_cli("render", "--format", format)
            self.assertEqual(run.returncode, 0, run.stderr)
            output = run.stdout
            for expected in ("Repositories", "Hosting surfaces", "sample/atlas", "pages:atlas", "candidate_only", "Purpose", "unknown", "PRIVATE", "not access control", "not runtime health"):
                self.assertIn(expected, output)
            for forbidden in ("<script>", "<img", "<iframe", "<link", "<style", '<a href="https:', "![track]("):
                self.assertNotIn(forbidden, output)
            self.assertIn("&lt;script&gt;", output)
            self.assertIn("<details>", output)
            self.assertEqual(output, self.run_cli("render", "--format", format).stdout)
        self.assertEqual(self.result("render", "--format", "json"), self.data)

    def test_expanded_evidence_wraps_long_metadata_in_small_viewports(self):
        from html.parser import HTMLParser

        panels = []

        class Panels(HTMLParser):
            def handle_starttag(self, tag, attrs):
                if tag in ("pre", "body"):
                    panels.append((tag, dict(attrs).get("style", "")))

        output = self.run_cli("render")
        self.assertEqual(output.returncode, 0, output.stderr)
        Panels().feed(output.stdout)
        self.assertTrue(panels)
        for tag, style in panels:
            if tag == "pre":
                self.assertIn("white-space: pre-wrap", style)
            self.assertIn("overflow-wrap: anywhere", style)

    def test_render_file_output_is_explicit_private_no_overwrite_and_validation_first(self):
        output = self.root / "view.html"
        run = self.run_cli("render", "--output", str(output))
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        self.assertEqual(output.read_text(), self.run_cli("render").stdout)
        original = output.read_bytes()
        self.assertEqual(self.run_cli("render", "--output", str(output)).returncode, 2)
        self.assertEqual(original, output.read_bytes())
        link = self.root / "output-link"
        link.symlink_to(output)
        self.assertEqual(self.run_cli("render", "--output", str(link)).returncode, 2)
        redirected = self.root / "redirected"
        redirected.symlink_to(self.root, target_is_directory=True)
        self.assertEqual(self.run_cli("render", "--output", str(redirected / "absent.html")).returncode, 2)
        self.data["schema"] = "invalid"
        self.save()
        self.assertEqual(self.run_cli("render", "--output", str(self.root / "absent.html")).returncode, 2)
        self.assertFalse((self.root / "absent.html").exists())
        self.assertEqual(original, output.read_bytes())
        self.assertFalse(list(self.root.glob(".portfolio-*")))

    def review(self, source="sample/atlas", attribution="current_tracked_config"):
        return {"schema": "business-ecosystem.portfolio-review/1", "base_map_sha256": hashlib.sha256(self.map.read_bytes()).hexdigest(), "changes": [{"resource_id": "pages:atlas", "expected": {"repository": self.data["surfaces"][0]["repository"], "attribution": self.data["surfaces"][0]["attribution"]}, "replacement": {"repository": source, "attribution": attribution, "evidence": [{"kind": "current_tracked_config", "locator": "https://github.com/sample/atlas/blob/" + "b" * 40 + "/wrangler.toml", "revision": "b" * 40, "note": "Operator inspected pinned config"}], "caveat": "Reviewed source declaration, not runtime verification"}}]}

    def save_review(self, review):
        path = self.root / "review.json"
        path.write_text(json.dumps(review))
        return path

    def test_apply_review_preserves_coverage_evidence_and_derives_projection(self):
        review = self.review()
        path = self.save_review(review)
        output = self.root / "reviewed.json"
        original = self.map.read_bytes()
        run = self.run_cli("apply-review", "--review", str(path), "--output", str(output))
        self.assertEqual(run.returncode, 0, run.stderr)
        applied = json.loads(output.read_text())
        self.assertEqual(self.map.read_bytes(), original)
        self.assertEqual(output.stat().st_mode & 0o777, 0o600)
        for section in ("repositories", "surfaces", "zones"):
            self.assertEqual([r["id"] for r in applied[section]], [r["id"] for r in self.data[section]])
        self.assertEqual(applied["legal_entities"], self.data["legal_entities"])
        self.assertEqual(applied["observation_times"], self.data["observation_times"])
        surface = applied["surfaces"][0]
        self.assertEqual(surface["evidence"], self.data["surfaces"][0]["evidence"] + review["changes"][0]["replacement"]["evidence"])
        self.assertIsNone(surface["legal_entity_id"])
        self.assertEqual(surface["framework_domains"], ["knowledge_outreach"])
        self.assertEqual(applied["repositories"][0]["hosting_resources"], [surface["id"]])
        self.assertEqual(applied["summary"]["current_source_relations"], 1)
        self.assertEqual(applied["summary"]["unestablished_source_relations"], 0)
        self.assertEqual(applied["summary"]["new_source_relations"], 1)
        history = applied["review_history"][0]
        self.assertEqual(history["changes"][0]["before"], self.data["surfaces"][0])
        self.assertEqual(history["base_map_sha256"], review["base_map_sha256"])
        self.assertEqual(history["review_sha256"], hashlib.sha256(path.read_bytes()).hexdigest())
        self.assertEqual(history["verification"], "operator_supplied_not_online_verified")
        self.assertIn("applied_at", history)
        checked = self.run_cli("summary", map_path=output)
        self.assertEqual(checked.returncode, 0, checked.stderr)
        self.assertEqual(json.loads(checked.stdout)["disagreements"], [])

    def test_review_envelope_is_fully_validated_before_any_write(self):
        valid = self.review()
        cases = []
        for key, value in [("schema", "wrong"), ("base_map_sha256", "0" * 64), ("changes", []), ("legal_owner", "invented")]:
            item = copy.deepcopy(valid)
            item[key] = value
            cases.append(item)
        for key, value in [("resource_id", " pages:atlas"), ("resource_id", "cloudflare:sample:pages:atlas"), ("expected", {}), ("expected", {"repository": None, "attribution": "unresolved"}), ("path", "/legal_entities")]:
            item = copy.deepcopy(valid)
            item["changes"][0][key] = value
            cases.append(item)
        item = copy.deepcopy(valid)
        item["changes"].append(copy.deepcopy(item["changes"][0]))
        cases.append(item)
        for key, value in [("legal_owner", "invented"), ("legal_entity_id", "atlas"), ("repository", "sample/absent"), ("repository", "https://codeberg.org/sample/../atlas"), ("attribution", "guessed"), ("evidence", []), ("evidence", [{"kind": "config", "locator": "README.md", "note": "not pinned"}]), ("caveat", "")]:
            item = copy.deepcopy(valid)
            item["changes"][0]["replacement"][key] = value
            cases.append(item)
        output = self.root / "output.json"
        original = self.map.read_bytes()
        for index, item in enumerate(cases):
            with self.subTest(index=index):
                output = self.root / ("output-" + str(index) + ".json")
                review_path = self.save_review(item)
                run = self.run_cli("apply-review", "--review", str(review_path), "--output", str(output))
                self.assertEqual(run.returncode, 2, run.stdout)
                self.assertEqual(run.stdout, "")
                self.assertNotIn("Traceback", run.stderr)
                self.assertEqual(self.map.read_bytes(), original)
                self.assertFalse(output.exists())
        output.write_bytes(b"keep existing bytes")
        run = self.run_cli("apply-review", "--review", str(self.save_review(valid)), "--output", str(output))
        self.assertEqual(run.returncode, 2)
        self.assertEqual(output.read_bytes(), b"keep existing bytes")
        self.assertEqual(self.map.read_bytes(), original)

    def test_nested_metadata_types_and_literal_identities_cannot_bypass_validation(self):
        cases = []
        for path, value in [
            (("summary", "repositories"), True),
            (("summary", "groups"), {"knowledge_research": "1"}),
            (("repositories", 0, "full_name"), "sample//atlas"),
            (("repositories", 0, "full_name"), " sample/atlas"),
            (("repositories", 0, "name"), "different"),
            (("surfaces", 0, "metadata", "canonical_deployment"), []),
            (("surfaces", 0, "metadata", "canonical_deployment", "trigger"), False),
            (("surfaces", 0, "metadata", "canonical_deployment", "trigger", "metadata", "commit_dirty"), "false"),
            (("repositories", 0, "legal_entity_id"), "guessed-slug"),
            (("surfaces", 0, "candidate_repositories"), ["sample/missing"]),
            (("surfaces", 0, "resource_id"), "pages:atlas\n"),
        ]:
            item = fixture()
            target = item
            for key in path[:-1]:
                target = target[key]
            target[path[-1]] = value
            cases.append(item)
        for i, item in enumerate(cases):
            with self.subTest(case=i):
                self.data = item
                self.save()
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2)
                self.assertNotIn("Traceback", run.stderr)

    def test_zone_legal_references_require_explicit_records_when_present(self):
        zone = {"id": "dns:sample:zone", "name": "example.invalid", "extension": {"keep": True}}
        self.data["zones"] = [zone]
        self.data["legal_entities"]["records"] = [{"id": "legal:sample"}]
        for reference in ({}, {"legal_entity_id": None}, {"legal_entity_id": "legal:sample"}):
            with self.subTest(reference=reference):
                zone.pop("legal_entity_id", None)
                zone.update(reference)
                self.save()
                self.assertEqual(self.result("show", zone["id"])["record"], zone)
                self.assertEqual(self.result("render", "--format", "json"), self.data)
                for format in ("html", "markdown"):
                    run = self.run_cli("render", "--format", format)
                    self.assertEqual(run.returncode, 0, run.stderr)
                    expected = "legal:sample" if reference.get("legal_entity_id") else "unknown / unassigned"
                    self.assertIn("<dt>Legal entity</dt><dd>" + expected + "</dd>", run.stdout)
        for index, value in enumerate(("invented-entity", "sample/atlas", " legal:sample", "legal:sample\n", "", 42, False, [], {})):
            with self.subTest(value=value):
                zone["legal_entity_id"] = value
                self.save()
                output = self.root / ("zone-invalid-" + str(index) + ".html")
                run = self.run_cli("render", "--output", str(output))
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("legal", run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertFalse(output.exists())
                self.assertNotIn("Traceback", run.stderr)

    def test_derived_baseline_is_validated_against_retained_history(self):
        path = self.save_review(self.review())
        output = self.root / "first.json"
        self.assertEqual(self.run_cli("apply-review", "--review", str(path), "--output", str(output)).returncode, 0)
        reviewed = json.loads(output.read_text())
        tampered = copy.deepcopy(reviewed)
        tampered["review_baseline"]["source_relations"]["pages:atlas"] = "sample/atlas"
        self.map.write_text(json.dumps(tampered))
        run = self.run_cli("summary")
        self.assertEqual(run.returncode, 2, run.stdout)
        for field, value in [("source_relations", {}), ("map_sha256", "bad"), ("original_summary", None)]:
            item = copy.deepcopy(reviewed)
            item["review_baseline"][field] = value
            self.map.write_text(json.dumps(item))
            run = self.run_cli("summary")
            self.assertEqual(run.returncode, 2)
            self.assertNotIn("Traceback", run.stderr)
        for value in (None, [], [{"changes": []}]):
            item = copy.deepcopy(reviewed)
            item["review_history"] = value
            self.map.write_text(json.dumps(item))
            self.assertEqual(self.run_cli("summary").returncode, 2)

    def test_history_revalidates_replacements_hidden_by_later_reviews(self):
        for index in range(2):
            output = self.root / ("history-" + str(index) + ".json")
            run = self.run_cli("apply-review", "--review", str(self.save_review(self.review())), "--output", str(output))
            self.assertEqual(run.returncode, 0, run.stderr)
            self.map, self.data = output, json.loads(output.read_text())
        valid = copy.deepcopy(self.data)
        evidence = valid["review_history"][0]["changes"][0]["replacement"]["evidence"][0]
        cases = [
            ("repository", "sample/absent"),
            ("repository", "https://codeberg.org/sample/.."),
            ("repository", None),
            ("attribution", "guessed"),
            ("attribution", "unresolved"),
            ("attribution", []),
            ("evidence", [{"kind": "source", "locator": "README.md", "note": "Unpinned"}]),
            ("evidence", [{**evidence, "revision": "c" * 40}]),
            ("evidence", [{**evidence, "revision": "b" * 39}]),
            ("caveat", ""),
            ("caveat", None),
        ]
        for field, value in cases:
            with self.subTest(field=field, value=value):
                tampered = copy.deepcopy(valid)
                first = tampered["review_history"][0]["changes"][0]
                second = tampered["review_history"][1]["changes"][0]
                first["replacement"][field] = value
                second["before"][field] = value
                if field == "evidence":
                    second["before"]["evidence"] = first["before"]["evidence"] + value
                    tampered["surfaces"][0]["evidence"] = second["before"]["evidence"] + second["replacement"]["evidence"]
                self.map.write_text(json.dumps(tampered))
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertNotIn("Traceback", run.stderr)

    def test_history_initial_source_state_uses_legacy_evidence_rules(self):
        surface = self.data["surfaces"][0]
        surface.update(repository="sample/atlas", attribution="current_source_document")
        surface["evidence"][0]["revision"] = "legacy-branch-not-a-reviewed-pin"
        surface.pop("caveat")
        surface["opaque_extension"] = {"keep": ["literal metadata"]}
        self.data["repositories"][0]["hosting_resources"] = [surface["id"]]
        self.save()
        original = copy.deepcopy(self.data)
        self.assertEqual(self.run_cli("summary").returncode, 0)
        output = self.root / "legacy-reviewed.json"
        run = self.run_cli("apply-review", "--review", str(self.save_review(self.review())), "--output", str(output))
        self.assertEqual(run.returncode, 0, run.stderr)
        reviewed = json.loads(output.read_text())
        self.assertEqual(reviewed["review_history"][0]["changes"][0]["before"], original["surfaces"][0])
        self.assertEqual(reviewed["surfaces"][0]["opaque_extension"], original["surfaces"][0]["opaque_extension"])
        self.assertEqual(self.run_cli("summary", map_path=output).returncode, 0)
        for repository, attribution in (
            ("sample/missing", "current_source_document"),
            ("https://codeberg.org/sample/..", "historical_source_evidence"),
            (None, "current_source_document"),
            ("sample/atlas", "unresolved"),
            ("sample/atlas", "guessed"),
        ):
            with self.subTest(repository=repository, attribution=attribution):
                tampered = copy.deepcopy(reviewed)
                tampered["review_baseline"]["source_relations"]["pages:atlas"] = repository
                tampered["review_history"][0]["changes"][0]["before"].update(repository=repository, attribution=attribution)
                self.map.write_text(json.dumps(tampered))
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertNotIn("Traceback", run.stderr)

    def test_history_retains_evidence_and_caveats_through_each_transition(self):
        for index in range(2):
            output = self.root / ("retained-" + str(index) + ".json")
            run = self.run_cli("apply-review", "--review", str(self.save_review(self.review())), "--output", str(output))
            self.assertEqual(run.returncode, 0, run.stderr)
            self.map, self.data = output, json.loads(output.read_text())
        valid = copy.deepcopy(self.data)
        # The repeated review legitimately appends the same evidence twice.
        self.assertEqual(len(valid["surfaces"][0]["evidence"]), 3)
        for location, mutation in (
            ("current", "remove-original"),
            ("current", "remove-appended"),
            ("current", "rewrite-note"),
            ("current", "reorder"),
            ("current", "caveat"),
            ("next-before", "remove-original"),
            ("next-before", "remove-appended"),
            ("next-before", "rewrite-note"),
            ("next-before", "reorder"),
            ("next-before", "caveat"),
        ):
            with self.subTest(location=location, mutation=mutation):
                tampered = copy.deepcopy(valid)
                second = tampered["review_history"][1]["changes"][0]
                target = tampered["surfaces"][0] if location == "current" else second["before"]
                if mutation == "remove-original":
                    target["evidence"].pop(0)
                elif mutation == "remove-appended":
                    target["evidence"].pop(1)
                elif mutation == "rewrite-note":
                    target["evidence"][0]["note"] = "Rewritten without a retained review"
                elif mutation == "reorder":
                    target["evidence"].reverse()
                else:
                    target["caveat"] = "Replacement caveat was lost"
                if location == "next-before" and mutation != "caveat":
                    tampered["surfaces"][0]["evidence"] = target["evidence"] + second["replacement"]["evidence"]
                self.map.write_text(json.dumps(tampered))
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertNotIn("Traceback", run.stderr)

    def reviewed_history_with_typed_extensions(self):
        self.data["surfaces"][0]["evidence"][0]["extension"] = {
            "operator_confirmed": True,
            "nested": [{"count": 1, "ratio": 1.0, "zero": -0.0, "disabled": False}, True],
            "labels": ["retained", "retained"],
            "null": None,
        }
        self.save()
        for index in range(2):
            output = self.root / ("typed-history-" + str(index) + ".json")
            run = self.run_cli("apply-review", "--review", str(self.save_review(self.review())), "--output", str(output))
            self.assertEqual(run.returncode, 0, run.stderr)
            self.map, self.data = output, json.loads(output.read_text())
        return copy.deepcopy(self.data)

    def test_history_final_evidence_retention_is_recursively_type_sensitive(self):
        valid = self.reviewed_history_with_typed_extensions()
        self.assertEqual(self.run_cli("summary").returncode, 0)
        # Object-key order is not evidence order; opaque duplicate list items stay.
        reordered = copy.deepcopy(valid)
        extension = reordered["surfaces"][0]["evidence"][0]["extension"]
        extension["nested"][0] = dict(reversed(list(extension["nested"][0].items())))
        reordered["surfaces"][0]["evidence"][0]["extension"] = dict(reversed(list(extension.items())))
        self.map.write_text(json.dumps(reordered))
        checked = self.run_cli("summary")
        self.assertEqual(checked.returncode, 0, checked.stderr)
        for path, value in (
            (("operator_confirmed",), 1),
            (("operator_confirmed",), False),
            (("nested", 0, "disabled"), 0),
            (("nested", 0, "count"), True),
            (("nested", 0, "count"), 1.0),
            (("nested", 0, "ratio"), 1),
            (("nested", 0, "zero"), 0.0),
            (("nested", 1), 1),
            (("null",), False),
            (("labels",), ["retained"]),
        ):
            with self.subTest(path=path, value=value):
                tampered = copy.deepcopy(valid)
                target = tampered["surfaces"][0]["evidence"][0]["extension"]
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = value
                self.map.write_text(json.dumps(tampered))
                original = self.map.read_bytes()
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("history final evidence retention", run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertNotIn("Traceback", run.stderr)
                self.assertEqual(self.map.read_bytes(), original)

    def test_history_before_evidence_continuity_is_recursively_type_sensitive(self):
        valid = self.reviewed_history_with_typed_extensions()
        reordered = copy.deepcopy(valid)
        second = reordered["review_history"][1]["changes"][0]
        extension = second["before"]["evidence"][0]["extension"]
        extension["nested"][0] = dict(reversed(list(extension["nested"][0].items())))
        second["before"]["evidence"][0]["extension"] = dict(reversed(list(extension.items())))
        reordered["surfaces"][0]["evidence"] = second["before"]["evidence"] + second["replacement"]["evidence"]
        self.map.write_text(json.dumps(reordered))
        checked = self.run_cli("summary")
        self.assertEqual(checked.returncode, 0, checked.stderr)
        for path, value in (
            (("operator_confirmed",), 1),
            (("operator_confirmed",), False),
            (("nested", 0, "disabled"), 0),
            (("nested", 0, "count"), True),
            (("nested", 0, "count"), 1.0),
            (("nested", 0, "ratio"), 1),
            (("nested", 0, "zero"), 0.0),
            (("nested", 1), 1),
            (("null",), False),
            (("labels",), ["retained"]),
        ):
            with self.subTest(path=path, value=value):
                tampered = copy.deepcopy(valid)
                second = tampered["review_history"][1]["changes"][0]
                target = second["before"]["evidence"][0]["extension"]
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = value
                # Final evidence agrees with the forged before-record, so only
                # comparison against the preceding review can detect this.
                tampered["surfaces"][0]["evidence"] = second["before"]["evidence"] + second["replacement"]["evidence"]
                self.map.write_text(json.dumps(tampered))
                original = self.map.read_bytes()
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("history before evidence continuity", run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertNotIn("Traceback", run.stderr)
                self.assertEqual(self.map.read_bytes(), original)

    def test_queue_flags_latest_dirty_deployment_separately_from_canonical_count(self):
        metadata = self.data["surfaces"][0]["metadata"]
        metadata["latest_deployment"] = copy.deepcopy(metadata["canonical_deployment"])
        metadata["canonical_deployment"]["trigger"]["metadata"]["commit_dirty"] = False
        self.save()
        queued = self.result("queue")
        self.assertIn("dirty_deployment", queued["counts_by_reason"])
        self.assertEqual(queued["counts_by_reason"]["dirty_deployment"], 1)
        self.assertEqual(self.result("summary")["computed"]["dirty_pages_declarations"], 0)

    def test_apply_never_publishes_a_derived_map_larger_than_read_limit(self):
        self.data["surfaces"][0]["evidence"][0]["note"] = "x" * (5 * 1024 * 1024)
        self.save()
        original = self.map.read_bytes()
        output = self.root / "too-big.json"
        review_path = self.save_review(self.review())
        run = self.run_cli("apply-review", "--review", str(review_path), "--output", str(output))
        self.assertEqual(run.returncode, 2)
        self.assertIn("8 MiB", run.stderr)
        self.assertFalse(output.exists())
        self.assertEqual(self.map.read_bytes(), original)

    def test_apply_checks_serialized_history_nesting_before_publication(self):
        for input_depth, expected_code in ((61, 0), (64, 2)):
            with self.subTest(input_depth=input_depth):
                nested = "opaque literal"
                for _ in range(input_depth - 3):
                    nested = [nested]
                self.data["surfaces"][0]["extension"] = nested
                self.save()
                original = self.map.read_bytes()
                checked = self.run_cli("summary")
                self.assertEqual(checked.returncode, 0, checked.stderr)
                output = self.root / ("depth-" + str(input_depth) + ".json")
                run = self.run_cli("apply-review", "--review", str(self.save_review(self.review())), "--output", str(output))
                self.assertEqual(run.returncode, expected_code, run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertEqual(self.map.read_bytes(), original)
                self.assertFalse(list(self.root.glob(".portfolio-*")))
                if expected_code == 2:
                    self.assertIn("nesting", run.stderr)
                    self.assertFalse(output.exists())
                else:
                    self.assertEqual(self.run_cli("summary", map_path=output).returncode, 0)
                    applied = json.loads(output.read_text())
                    self.assertEqual(applied["surfaces"][0]["extension"], nested)
                    self.assertEqual(applied["review_history"][0]["changes"][0]["before"]["extension"], nested)
                    self.assertEqual(output.stat().st_mode & 0o777, 0o600)

    def test_json_render_refuses_ascii_expansion_beyond_reader_limit(self):
        self.data["extension"] = "é" * (2 * 1024 * 1024)
        self.map.write_text(json.dumps(self.data, ensure_ascii=False), encoding="utf-8")
        original = self.map.read_bytes()
        self.assertLess(len(original), 8 * 1024 * 1024)
        self.assertEqual(self.run_cli("summary").returncode, 0)
        output = self.root / "oversize-export.json"
        existing = self.root / "existing-export.json"
        existing.write_bytes(b"retain existing bytes")
        for target in (None, output, existing):
            with self.subTest(target=target):
                args = () if target is None else ("--output", str(target))
                run = self.run_cli("render", "--format", "json", *args)
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("8 MiB", run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertFalse(output.exists())
                self.assertEqual(existing.read_bytes(), b"retain existing bytes")
                self.assertEqual(self.map.read_bytes(), original)
                self.assertFalse(list(self.root.glob(".portfolio-*")))
        # Unicode and depth-64 opaque metadata remain lossless when in bounds.
        self.data = fixture()
        nested = "é"
        for _ in range(63):
            nested = [nested]
        self.data["extension"] = nested
        self.map.write_text(json.dumps(self.data, ensure_ascii=False), encoding="utf-8")
        rendered = self.run_cli("render", "--format", "json")
        self.assertEqual(rendered.returncode, 0, rendered.stderr)
        self.assertEqual(json.loads(rendered.stdout), self.data)
        bounded = self.root / "bounded-export.json"
        written = self.run_cli("render", "--format", "json", "--output", str(bounded))
        self.assertEqual(written.returncode, 0, written.stderr)
        self.assertEqual(bounded.read_text(), rendered.stdout)
        self.assertEqual(bounded.stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.run_cli("summary", map_path=bounded).returncode, 0)

    def test_review_locator_query_or_fragment_cannot_supply_a_path_pin(self):
        base = "https://github.com/sample/atlas/blob/main/wrangler.toml"
        for index, locator in enumerate((
            base + "?evidence=/blob/" + "b" * 40,
            base + "#/commit/" + "b" * 40,
            base + "?evidence=/src/commit/" + "b" * 64 + "/config",
            base + "#sha256:" + "b" * 64,
        )):
            with self.subTest(locator=locator):
                review = self.review()
                evidence = review["changes"][0]["replacement"]["evidence"][0]
                evidence.pop("revision")
                evidence["locator"] = locator
                output = self.root / ("query-pin-" + str(index) + ".json")
                original = self.map.read_bytes()
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("immutable", run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertFalse(output.exists())
                self.assertEqual(self.map.read_bytes(), original)

    def test_review_pins_require_literal_hash_tokens(self):
        pin = "b" * 64
        invalid = [
            {"locator": "sha256:" + "b" * 40},
            {"locator": "sha256:" + pin[:-1]},
            {"locator": "sha256:" + pin + "b"},
            {"locator": "sha256:" + pin.upper()},
            {"locator": " sha256:" + pin},
            {"locator": "sha256:" + pin + "#note"},
            {"locator": "https://github.com/sample/atlas/blob/" + "b" * 20 + "\n" + "b" * 20 + "/config"},
            {"locator": "https://github.com/sample/atlas/blob/" + "b" * 20 + "%62" + "b" * 19 + "/config"},
            *[{"locator": "README.md", "revision": value} for value in (pin.upper(), " " + pin, pin + "\n", "b" * 39, "b" * 41)],
        ]
        for index, values in enumerate(invalid):
            with self.subTest(values=values):
                review = self.review()
                review["changes"][0]["replacement"]["evidence"] = [{"kind": "source", "note": "Literal synthetic token", **values}]
                output = self.root / ("bad-token-" + str(index) + ".json")
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertFalse(output.exists())
                self.assertNotIn("Traceback", run.stderr)
        valid = [
            {"locator": "sha256:" + pin},
            {"locator": "sha256:" + pin, "revision": pin},
            {"locator": "https://github.com/sample/atlas/blob/" + "b" * 40 + "/config?other=/commit/" + "c" * 40, "revision": "b" * 40},
            {"locator": "https://codeberg.org/sample/replacement.git/src/commit/" + pin + "/config#section"},
            {"locator": "README.md", "revision": "b" * 40},
        ]
        for index, values in enumerate(valid):
            with self.subTest(values=values):
                review = self.review()
                evidence = {"kind": "source", "note": "Literal synthetic token", **values}
                review["changes"][0]["replacement"]["evidence"] = [evidence]
                output = self.root / ("valid-token-" + str(index) + ".json")
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 0, run.stderr)
                self.assertEqual(json.loads(output.read_text())["surfaces"][0]["evidence"][-1], evidence)

    def test_review_locator_pin_must_occupy_the_supported_provider_reference(self):
        pin = "b" * 40
        invalid = [
            "https://github.com/sample/atlas/blob/main/docs/blob/" + pin + "/config",
            "https://github.com/sample/atlas/blob/main/docs/commit/" + pin + "/config",
            "https://codeberg.org/sample/atlas/src/branch/main/docs/src/commit/" + pin + "/config",
            "https://github.com/sample/atlas/issues/blob/" + pin + "/config",
            "https://github.com/sample/atlas/src/commit/" + pin + "/config",
            "https://codeberg.org/sample/atlas/blob/" + pin + "/config",
            "https://example.invalid/sample/atlas/blob/" + pin + "/config",
            "https://github.com@elsewhere.invalid/sample/atlas/blob/" + pin + "/config",
            "saved/sample/atlas/blob/" + pin + "/config",
        ]
        original = self.map.read_bytes()
        for index, locator in enumerate(invalid):
            with self.subTest(locator=locator):
                review = self.review()
                evidence = review["changes"][0]["replacement"]["evidence"][0]
                evidence.pop("revision")
                evidence["locator"] = locator
                output = self.root / ("wrong-reference-" + str(index) + ".json")
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("immutable", run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertFalse(output.exists())
                self.assertEqual(self.map.read_bytes(), original)
        valid = [
            ("https://github.com/sample/atlas/blob/" + pin + "/docs/blob/main/config", None),
            ("https://github.com/sample/atlas/commit/" + pin, None),
            ("https://codeberg.org/sample/replacement.git/src/commit/" + pin + "/config", None),
            ("https://codeberg.org/sample/replacement.git/commit/" + "b" * 64, None),
            (invalid[0], "c" * 40),
            (invalid[2], "c" * 40),
            ("README.md", pin),
        ]
        for index, (locator, revision) in enumerate(valid):
            with self.subTest(locator=locator, revision=revision):
                source = "https://codeberg.org/sample/replacement.git" if "replacement.git" in locator else "sample/atlas"
                review = self.review(source)
                evidence = review["changes"][0]["replacement"]["evidence"][0]
                evidence.pop("revision")
                evidence["locator"] = locator
                if revision is not None:
                    evidence["revision"] = revision
                output = self.root / ("real-reference-" + str(index) + ".json")
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 0, run.stderr)
                applied = json.loads(output.read_text())
                self.assertEqual(applied["surfaces"][0]["repository"], source)
                self.assertEqual(applied["surfaces"][0]["evidence"][-1], evidence)
                checked = self.run_cli("summary", map_path=output)
                self.assertEqual(checked.returncode, 0, checked.stderr)
                self.assertEqual(self.map.read_bytes(), original)

    def test_review_locator_refuses_path_normalization_instead_of_repairing_pins(self):
        pin = "b" * 40
        bases = (
            "https://github.com/sample/atlas/blob/" + pin,
            "https://codeberg.org/sample/replacement.git/src/commit/" + pin,
        )
        suffixes = (
            "/../../blob/main/config",
            "/docs/../config",
            "/./config",
            "/%2e%2e/%2E%2e/blob/main/config",
            "/.%2e/%2e./blob/main/config",
            "/..%2f..%2Fblob/main/config",
            "/%2e%2e%5c%2e%2e%5Cblob/main/config",
            "/%252e%252e/%252e%252e/blob/main/config",
            "/docs\\..\\..\\blob\\main\\config",
            "/docs//config",
        )
        original = self.map.read_bytes()
        for base_index, base in enumerate(bases):
            for suffix_index, suffix in enumerate(suffixes):
                for revision in (None, pin):
                    with self.subTest(base=base, suffix=suffix, revision=revision):
                        review = self.review()
                        evidence = review["changes"][0]["replacement"]["evidence"][0]
                        evidence["locator"] = base + suffix
                        if revision is None:
                            evidence.pop("revision")
                        output = self.root / ("normalized-" + str(base_index) + "-" + str(suffix_index) + "-" + str(revision is None) + ".json")
                        run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                        self.assertEqual(run.returncode, 2, run.stderr)
                        self.assertIn("normalization", run.stderr)
                        self.assertEqual(run.stdout, "")
                        self.assertFalse(output.exists())
                        self.assertEqual(self.map.read_bytes(), original)
        for index, suffix in enumerate((
            "/.config.toml", "/docs/.../config", "/docs/config%2Etoml",
            "/docs/a%20b.toml?return=../%2e%2e/#/../../blob/main/config",
        )):
            with self.subTest(valid_suffix=suffix):
                review = self.review()
                evidence = review["changes"][0]["replacement"]["evidence"][0]
                evidence.pop("revision")
                evidence["locator"] = bases[0] + suffix
                output = self.root / ("literal-path-" + str(index) + ".json")
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 0, run.stderr)
                self.assertEqual(json.loads(output.read_text())["surfaces"][0]["evidence"][-1], evidence)
                checked = self.run_cli("summary", map_path=output)
                self.assertEqual(checked.returncode, 0, checked.stderr)

    def test_review_locator_normalization_guard_cannot_be_skipped_with_controls(self):
        pin = "b" * 40
        base = "https://github.com/sample/atlas/blob/" + pin
        for index, locator in enumerate((
            "\t" + base + "/../../blob/main/config",
            base + "/docs/\n../../blob/main/config",
            base + "/docs/\t%2e%2e/%2e%2e/blob/main/config",
        )):
            with self.subTest(locator=locator):
                review = self.review()
                evidence = review["changes"][0]["replacement"]["evidence"][0]
                # An independent pin must not make malformed provider paths valid.
                evidence.update(locator=locator, revision=pin)
                output = self.root / ("control-normalization-" + str(index) + ".json")
                original = self.map.read_bytes()
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("normalization", run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertFalse(output.exists())
                self.assertEqual(self.map.read_bytes(), original)

    def test_malformed_sha256_locator_cannot_fall_back_to_a_valid_revision(self):
        for index, (digest, revision) in enumerate((
            ("b" * 40, "b" * 40),
            ("b" * 63, "b" * 64),
            ("B" * 64, "b" * 64),
            ("b" * 64 + "#note", "b" * 64),
        )):
            with self.subTest(digest=digest):
                review = self.review()
                review["changes"][0]["replacement"]["evidence"][0].update(locator="sha256:" + digest, revision=revision)
                output = self.root / ("invalid-digest-" + str(index) + ".json")
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 2, run.stderr)
                self.assertIn("sha256", run.stderr)
                self.assertEqual(run.stdout, "")
                self.assertFalse(output.exists())

    def test_review_rejects_contradictory_pins_and_invalid_codeberg_tokens(self):
        for index, mutate in enumerate((
            lambda r: r["changes"][0]["replacement"]["evidence"][0].update(revision="c" * 40),
            lambda r: r["changes"][0]["replacement"].update(repository="https://codeberg.org/sample/.."),
            lambda r: r["changes"][0]["replacement"]["evidence"][0].update(revision=["b" * 40]),
        )):
            with self.subTest(case=index):
                review = self.review()
                mutate(review)
                output = self.root / (str(index) + ".json")
                run = self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output))
                self.assertEqual(run.returncode, 2)
                self.assertFalse(output.exists())

    def test_sequential_reviews_keep_original_baseline_and_external_sources_unclassified(self):
        original = copy.deepcopy(self.data)
        original_bytes = self.map.read_bytes()
        first = self.root / "first.json"
        review = self.review()
        self.assertEqual(self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(first)).returncode, 0)
        first_data = json.loads(first.read_text())
        self.map = first
        self.data = first_data
        external = "https://codeberg.org/sample/replacement.git"
        second_review = self.review(external)
        second_review["changes"][0]["replacement"]["evidence"][0]["locator"] = "https://codeberg.org/sample/replacement.git/src/commit/" + "b" * 40 + "/wrangler.toml"
        second = self.root / "second.json"
        self.assertEqual(self.run_cli("apply-review", "--review", str(self.save_review(second_review)), "--output", str(second)).returncode, 0)
        second_data = json.loads(second.read_text())
        self.assertEqual(second_data["review_baseline"], first_data["review_baseline"])
        self.assertEqual(second_data["summary"]["new_source_relations"], 1)
        self.assertEqual(second_data["repositories"][0]["hosting_resources"], [])
        self.assertEqual(second_data["surfaces"][0]["repository"], external)
        self.assertEqual(second_data["surfaces"][0]["framework_domains"], [])
        self.assertEqual(second_data["surfaces"][0]["group"], "unresolved")
        self.assertEqual(second_data["repositories"], original["repositories"])
        self.assertEqual(second_data["review_history"][0], first_data["review_history"][0])
        self.assertEqual(second_data["review_history"][1]["changes"][0]["before"], first_data["surfaces"][0])
        self.assertEqual(second_data["observation_times"], original["observation_times"])
        self.assertEqual((self.root / "map.json").read_bytes(), original_bytes)
        self.map, self.data = second, second_data
        third = self.root / "third.json"
        self.assertEqual(self.run_cli("apply-review", "--review", str(self.save_review(self.review(None, "unresolved"))), "--output", str(third)).returncode, 0)
        self.assertEqual(json.loads(third.read_text())["summary"]["new_source_relations"], 0)
        self.assertEqual(json.loads(third.read_text())["surfaces"][0]["legal_entity_id"], None)

    def test_stale_hash_cannot_be_repaired_by_reformatting_or_case_normalization(self):
        review = self.review()
        path = self.save_review(review)
        self.map.write_text(json.dumps(self.data, indent=2))
        output = self.root / "stale.json"
        run = self.run_cli("apply-review", "--review", str(path), "--output", str(output))
        self.assertEqual(run.returncode, 2)
        self.assertIn("base_map_sha256", run.stderr)
        self.assertFalse(output.exists())
        review = self.review()
        review["base_map_sha256"] = review["base_map_sha256"].upper()
        self.assertEqual(self.run_cli("apply-review", "--review", str(self.save_review(review)), "--output", str(output)).returncode, 2)

    def test_invalid_second_change_is_atomic_and_review_symlinks_are_rejected(self):
        other = copy.deepcopy(self.data["surfaces"][0])
        other.update(id="cloudflare:sample:pages:second", resource_id="pages:second")
        self.data["surfaces"].append(other)
        self.save()
        review = self.review()
        second = copy.deepcopy(review["changes"][0])
        second["resource_id"] = "pages:second"
        second["expected"]["attribution"] = "wrong"
        review["changes"].append(second)
        original = self.map.read_bytes()
        output = self.root / "batch.json"
        review_path = self.save_review(review)
        self.assertEqual(self.run_cli("apply-review", "--review", str(review_path), "--output", str(output)).returncode, 2)
        self.assertFalse(output.exists())
        self.assertEqual(self.map.read_bytes(), original)
        link = self.root / "review-link.json"
        link.symlink_to(self.save_review(self.review()))
        self.assertEqual(self.run_cli("apply-review", "--review", str(link), "--output", str(output)).returncode, 2)
        self.assertFalse(output.exists())
        self.assertEqual(self.run_cli("apply-review", "--review", str(review_path), "--output", str(self.map)).returncode, 2)
        self.assertEqual(self.map.read_bytes(), original)

    def test_read_only_commands_have_no_source_reads_network_or_application_imports(self):
        script = r'''import ast, contextlib, io, json, os, runpy, socket, sys
from pathlib import Path
cli, map_path = sys.argv[1:]
source = Path(cli).read_text()
for node in ast.walk(ast.parse(source)):
    if isinstance(node, ast.Import):
        assert all(a.name.split('.')[0] in sys.stdlib_module_names for a in node.names)
    if isinstance(node, ast.ImportFrom):
        assert node.module.split('.')[0] in sys.stdlib_module_names
module = runpy.run_path(cli, run_name='portfolio_import_test')
# Warm only argparse's lazy standard-library imports before guarding data I/O.
with contextlib.redirect_stdout(io.StringIO()):
    try:
        module['main'](['--help'])
    except SystemExit as exc:
        assert exc.code == 0
reads = []
def guard(event, args):
    if event.startswith('socket.') or event in ('os.scandir', 'os.listdir', 'subprocess.Popen', 'os.system', 'import'):
        raise AssertionError('forbidden event ' + event)
    if event == 'open':
        path, mode, flags = args
        if isinstance(path, int):
            return
        assert flags & os.O_NOFOLLOW, (path, flags)
        assert not flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT), (path, flags)
        if not flags & os.O_DIRECTORY:
            assert path == Path(map_path).name, path
            reads.append(path)
sys.addaudithook(guard)
for action in (lambda: open('DO-NOT-READ.json'), socket.socket):
    try:
        action()
    except AssertionError:
        pass
    else:
        raise AssertionError('negative control was not blocked')
commands = [['summary'], ['find', 'atlas', '--limit', '1'], ['show', 'sample/atlas'], ['queue'], ['render'], ['render', '--format', 'markdown'], ['render', '--format', 'json']]
for args in commands:
    with contextlib.redirect_stdout(io.StringIO()):
        assert module['main'](['--map', map_path] + args) == 0
assert len(reads) == len(commands), reads
print('offline guards passed')
'''
        run = subprocess.run([sys.executable, "-B", "-c", script, str(CLI), str(self.map)], cwd=self.root, capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertIn("offline guards passed", run.stdout)

    def test_import_help_and_missing_map_have_no_default_output_side_effects(self):
        def snapshot():
            return {str(p.relative_to(self.root)): None if p.is_dir() else p.read_bytes() for p in self.root.rglob("*")}
        before = snapshot()
        env = {**os.environ, "HOME": str(self.root), "PORTFOLIO_MAP": str(self.map), "PYTHONDONTWRITEBYTECODE": "1"}
        for args, code in [(["--help"], 0), (["summary"], 2), (["--unknown"], 2)]:
            run = subprocess.run([sys.executable, "-B", str(CLI), *args], cwd=self.root, env=env, capture_output=True, text=True)
            self.assertEqual(run.returncode, code)
        run = subprocess.run([sys.executable, "-B", "-c", "import runpy,sys; runpy.run_path(sys.argv[1], run_name='import_only')", str(CLI)], cwd=self.root, env=env, capture_output=True, text=True)
        self.assertEqual(run.returncode, 0, run.stderr)
        self.assertEqual(run.stdout, "")
        self.assertEqual(snapshot(), before)

    def test_failed_atomic_publication_cleans_staging_without_touching_existing_bytes(self):
        import runpy
        from unittest.mock import patch
        module = runpy.run_path(str(CLI), run_name="writer_test")
        output = self.root / "new.json"
        original = self.map.read_bytes()
        for error in (OSError("synthetic publication failure"), KeyboardInterrupt()):
            with patch.object(module["os"], "link", side_effect=error):
                with self.assertRaises(type(error)):
                    module["write_new"](str(output), "new bytes")
            self.assertFalse(output.exists())
            self.assertFalse(list(self.root.glob(".portfolio-*")))
            self.assertEqual(self.map.read_bytes(), original)

    def test_json_limits_cover_exponent_overflow_surrogates_and_parseable_deep_metadata(self):
        base = json.dumps(fixture())
        variants = [base[:-1] + ', "extension": 1e999}', base[:-1] + ', "extension": "\\ud800"}', base[:-1] + ', "extension": ' + '[' * 70 + '0' + ']' * 70 + '}']
        for raw in variants:
            with self.subTest(length=len(raw)):
                self.map.write_text(raw)
                run = self.run_cli("summary")
                self.assertEqual(run.returncode, 2)
                self.assertNotIn("Traceback", run.stderr)

    def test_human_render_keeps_review_history_and_observation_provenance_visible(self):
        output = self.root / "reviewed.json"
        review_path = self.save_review(self.review())
        self.assertEqual(self.run_cli("apply-review", "--review", str(review_path), "--output", str(output)).returncode, 0)
        view = self.run_cli("render", map_path=output)
        self.assertEqual(view.returncode, 0, view.stderr)
        self.assertIn("No source assignment yet", view.stdout)
        self.assertIn("2025-01-02T00:00:00Z", view.stdout)
        self.assertIn("operator_supplied_not_online_verified", view.stdout)


if __name__ == "__main__":
    unittest.main()
