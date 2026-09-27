#!/usr/bin/env python3
"""Offline queries of an explicitly selected private portfolio-map snapshot."""
import argparse
import copy
from datetime import datetime, timezone
import hashlib
from collections import Counter
from contextlib import contextmanager
import json
import math
from html import escape
import re
import os
import stat
import sys
from urllib.parse import unquote, urlsplit


MAX_BYTES = 8 * 1024 * 1024

CURRENT = {"deployment_commit_verified", "current_tracked_config", "current_source_document"}
ATTRIBUTIONS = CURRENT | {"historical_source_evidence", "candidate_only", "unresolved"}


class Invalid(ValueError):
    """Unusable metadata, without reading any evidence locator."""


def require(condition, message):
    if not condition:
        raise Invalid(message)


@contextmanager
def parent_fd(path):
    """Walk only the named path, without following any symlink component."""
    require(isinstance(path, str) and bool(path) and "\x00" not in path, "invalid path")
    parts = path.split("/")
    require(".." not in parts and parts[-1] not in ("", "."), "path must name a file without '..'")
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    fd = os.open("/" if path.startswith("/") else ".", flags)
    try:
        for part in parts[:-1]:
            if part in ("", "."):
                continue
            next_fd = os.open(part, flags, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        yield fd, parts[-1]
    finally:
        os.close(fd)


def read_bytes(path):
    with parent_fd(path) as (directory, name):
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
        with os.fdopen(fd, "rb") as stream:
            info = os.fstat(stream.fileno())
            require(stat.S_ISREG(info.st_mode), "input must be a regular file")
            require(info.st_size <= MAX_BYTES, "input exceeds 8 MiB limit")
            raw = stream.read(MAX_BYTES + 1)
            require(len(raw) <= MAX_BYTES, "input exceeds 8 MiB limit")
            return raw


def write_new(path, payload):
    """Publish fully serialized bytes atomically; link cannot replace a target."""
    raw = payload.encode("utf-8")
    with parent_fd(path) as (directory, name):
        temporary = ".portfolio-" + os.urandom(16).hex()
        fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
        try:
            with os.fdopen(fd, "wb") as stream:
                os.fchmod(stream.fileno(), 0o600)
                stream.write(raw)
                stream.flush()
                os.fsync(stream.fileno())
            os.link(temporary, name, src_dir_fd=directory, dst_dir_fd=directory, follow_symlinks=False)
        finally:
            os.unlink(temporary, dir_fd=directory)


def json_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON object key")
        result[key] = value
    return result


def reject_constant(value):
    raise Invalid("nonfinite JSON number")


def parse(raw):
    try:
        data = json.loads(raw.decode("utf-8"), object_pairs_hook=json_object, parse_constant=reject_constant)
    except RecursionError as exc:
        raise Invalid("JSON nesting is too deep") from exc
    except ValueError as exc:
        raise Invalid("invalid JSON: " + str(exc)) from exc
    pending = [(data, 0)]
    while pending:
        value, depth = pending.pop()
        require(depth <= 64, "JSON nesting exceeds 64 levels")
        if isinstance(value, dict):
            pending.extend((v, depth + 1) for pair in value.items() for v in pair)
        elif isinstance(value, list):
            pending.extend((v, depth + 1) for v in value)
        elif isinstance(value, float):
            require(math.isfinite(value), "nonfinite JSON number")
        elif isinstance(value, str):
            require(not any(0xD800 <= ord(c) <= 0xDFFF for c in value), "unpaired Unicode surrogate")
    return data


def text(value):
    return isinstance(value, str) and bool(value.strip())


def strings(value):
    return isinstance(value, list) and all(text(v) for v in value)


def codeberg(value):
    return isinstance(value, str) and re.fullmatch(r"https://codeberg\.org/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", value) is not None and value.rsplit("/", 1)[-1] not in {".", ".."}


def unique(records, key):
    values = [r.get(key) for r in records]
    require(all(text(v) and not any(c.isspace() or ord(c) < 32 for c in v) for v in values), key + " requires exact non-whitespace identifiers")
    require(len(set(values)) == len(values), "duplicate " + key)


def evidence_list(value):
    require(isinstance(value, list) and bool(value), "evidence must be a nonempty array")
    for e in value:
        require(isinstance(e, dict) and all(text(e.get(k)) for k in ("kind", "locator", "note")), "evidence requires kind, locator, note")


def validate(data):
    require(isinstance(data, dict), "map must be an object")
    require(data.get("schema") == "business-ecosystem.portfolio-map/1", "unsupported map schema")
    for key in ("repositories", "surfaces", "zones"):
        require(isinstance(data.get(key), list) and all(isinstance(r, dict) for r in data[key]), key + " must be an array of records")
    for key in ("summary", "semantics", "observation_times"):
        require(isinstance(data.get(key), dict), key + " must be an object")
    for key, value in data["summary"].items():
        if key in {"groups", "attribution"}:
            require(isinstance(value, dict) and all(type(n) is int and n >= 0 for n in value.values()), "summary grouping requires integer counts")
        elif key in {"repositories", "private_repositories", "archived_repositories", "forks", "pages", "workers", "zones", "source_relations", "current_source_relations", "historical_source_relations", "unestablished_source_relations", "new_source_relations", "dirty_pages_declarations"}:
            require(type(value) is int and value >= 0, "summary requires nonnegative integer " + key)
    for r in data["repositories"]:
        for key in ("id", "repository", "full_name", "name", "purpose", "group", "mapping_basis"):
            require(text(r.get(key)), "repository requires string " + key)
        require(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+", r["full_name"]) is not None and r["name"] == r["full_name"].split("/")[-1] and r["name"] not in {".", ".."}, "malformed literal repository identity")
        require(strings(r.get("framework_domains")), "framework_domains must be strings")
        require(isinstance(r.get("lifecycle"), dict), "lifecycle must be an object")
        for key in ("github_archived", "github_fork", "github_disabled"):
            require(type(r["lifecycle"].get(key)) is bool, "lifecycle requires boolean " + key)
        require(isinstance(r.get("github_metadata"), dict) and type(r["github_metadata"].get("private")) is bool, "github_metadata requires boolean private")
    repos, surfaces = data["repositories"], data["surfaces"]
    unique(repos + surfaces + data["zones"], "id")
    unique(repos, "full_name")
    unique(surfaces, "resource_id")
    names = {r["full_name"] for r in repos}
    require(all(r["repository"] == r["full_name"] for r in repos), "repository and full_name disagree")
    provider_ids = [r["github_metadata"].get("id") for r in repos]
    require(all(type(v) is int and v > 0 for v in provider_ids), "GitHub IDs must be positive integers")
    require(len(set(provider_ids)) == len(provider_ids), "duplicate GitHub identity")
    require(strings(data["semantics"].get("allowed_framework_domains")), "allowed_framework_domains must be strings")
    legal = data.get("legal_entities")
    require(isinstance(legal, dict) and isinstance(legal.get("records"), list) and all(isinstance(r, dict) for r in legal["records"]), "legal_entities requires explicit records")
    unique(legal["records"], "id")
    legal_ids = {r["id"] for r in legal["records"]}
    for zone in data["zones"]:
        reference = zone.get("legal_entity_id")
        require(reference is None or (text(reference) and reference in legal_ids), "zone legal entity must be null or an explicit legal record ID")
    for record in repos + surfaces:
        require("legal_entity_id" in record and (record["legal_entity_id"] is None or (text(record["legal_entity_id"]) and record["legal_entity_id"] in legal_ids)), "legal entity must be null or an explicit legal record ID")
        evidence_list(record.get("evidence"))
        require(strings(record.get("framework_domains")), "framework_domains must be strings")
        require(set(record["framework_domains"]) <= set(data["semantics"]["allowed_framework_domains"]), "unknown framework domain")
    for s in surfaces:
        require(text(s.get("account_id")), "surface requires account_id")
        require(s.get("kind") in ("pages", "workers"), "unknown surface kind")
        require(isinstance(s.get("metadata"), dict), "surface metadata must be an object")
        require(strings(s.get("candidate_repositories")), "candidate_repositories must be strings")
        require(all(v in names or codeberg(v) for v in s["candidate_repositories"]), "candidate repository not in snapshot or explicit Codeberg URL")
        for key in ("canonical_deployment", "latest_deployment"):
            deployment = s["metadata"].get(key)
            if deployment is not None:
                require(isinstance(deployment, dict), "deployment metadata must be an object or null")
                trigger = deployment.get("trigger")
                require(trigger is None or isinstance(trigger, dict), "deployment trigger must be an object or null")
                metadata = (trigger or {}).get("metadata")
                require(metadata is None or isinstance(metadata, dict), "trigger metadata must be an object or null")
                if metadata and "commit_dirty" in metadata:
                    require(type(metadata["commit_dirty"]) is bool, "commit_dirty must be boolean")
        require(isinstance(s.get("attribution"), str) and s["attribution"] in ATTRIBUTIONS, "unknown attribution")
        require("repository" in s, "surface requires repository (possibly null)")
        unassigned = s["attribution"] in {"candidate_only", "unresolved"}
        require((s["repository"] is None) == unassigned, "repository-null and attribution disagree")
        require(s["repository"] is None or (text(s["repository"]) and (s["repository"] in names or codeberg(s["repository"]))), "repository is not in snapshot or an explicit Codeberg source")
    for r in repos:
        refs = r.get("hosting_resources")
        require(strings(refs) and len(refs) == len(set(refs)), "hosting_resources must be unique strings")
        require(set(refs) == {s["id"] for s in surfaces if s["repository"] == r["full_name"]}, "inverse hosting_resources disagree")
    validate_history(data)
    return data


def dirty(surface, key="canonical_deployment"):
    deployment = surface["metadata"].get(key) or {}
    return ((deployment.get("trigger") or {}).get("metadata") or {}).get("commit_dirty") is True


def counts(data):
    repos, surfaces = data["repositories"], data["surfaces"]
    return {
        "repositories": len(repos),
        "private_repositories": sum(r["github_metadata"]["private"] for r in repos),
        "archived_repositories": sum(r["lifecycle"]["github_archived"] for r in repos),
        "forks": sum(r["lifecycle"]["github_fork"] for r in repos),
        "groups": dict(Counter(r["group"] for r in repos)),
        "pages": sum(s["kind"] == "pages" for s in surfaces),
        "workers": sum(s["kind"] == "workers" for s in surfaces),
        "zones": len(data["zones"]),
        "new_source_relations": (sum(s["repository"] is not None and s["repository"] != data["review_baseline"]["source_relations"][s["resource_id"]] for s in surfaces) if "review_baseline" in data else None),
        "source_relations": sum(s["repository"] is not None for s in surfaces),
        "current_source_relations": sum(s["attribution"] in CURRENT for s in surfaces),
        "historical_source_relations": sum(s["attribution"] == "historical_source_evidence" for s in surfaces),
        "unestablished_source_relations": sum(s["repository"] is None for s in surfaces),
        "attribution": dict(Counter(s["attribution"] for s in surfaces)),
        "dirty_pages_declarations": sum(s["kind"] == "pages" and dirty(s) for s in surfaces),
    }


def summary(data):
    computed = counts(data)
    declared = data["summary"]
    return {
        "computed": computed,
        "declared": declared,
        "disagreements": [{"field": k, "declared": declared.get(k), "computed": v}
                          for k, v in computed.items() if v is not None and declared.get(k) != v],
        "unverifiable": [k for k, v in computed.items() if v is None] + [k for k in declared if k not in computed],
    }


def records(data):
    for section, kind in (("repositories", "repository"), ("surfaces", "surface"), ("zones", "zone")):
        for record in data[section]:
            yield {"kind": kind, "record": record}


def bounded_limit(value):
    try:
        limit = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("limit must be an integer") from exc
    if not 1 <= limit <= 100:
        raise argparse.ArgumentTypeError("limit must be 1..100")
    return limit


def find(data, query, limit):
    require(text(query), "query must not be empty")
    matches = [r for r in records(data) if query.casefold() in json.dumps(r["record"], ensure_ascii=False).casefold()]
    return {"total_matches": len(matches), "returned_count": len(matches[:limit]), "has_more": len(matches) > limit, "results": matches[:limit]}


def show(data, identifier):
    matches = [r for r in records(data) if identifier in [r["record"].get(k) for k in ("id", "resource_id", "full_name")]]
    require(bool(matches), "no exact identifier matched")
    require(len(matches) == 1, "ambiguous identifier; use a unique full identity")
    return matches[0]


def queue(data):
    queued = []
    for item in records(data):
        record, reasons = item["record"], []
        if item["kind"] == "repository":
            if record["mapping_basis"] == "unresolved" or record["group"] == "unresolved":
                reasons.append("purpose_unresolved")
            if record["mapping_basis"] in {"name_inference", "name_inferred"}:
                reasons.append("purpose_name_inferred")
        elif item["kind"] == "surface":
            if record["attribution"] not in CURRENT:
                reasons.append(record["attribution"])
            if dirty(record) or dirty(record, "latest_deployment"):
                reasons.append("dirty_deployment")
        if reasons:
            queued.append({**item, "reasons": reasons})
    by_reason = Counter(reason for item in queued for reason in item["reasons"])
    return {"record_count": len(queued), "findings_count": sum(by_reason.values()), "counts_by_reason": dict(by_reason), "records": queued}


def encoded(value):
    return json.dumps(value, indent=2, sort_keys=True, ensure_ascii=True) + "\n"


def encoded_map(data):
    payload = encoded(data)
    raw = payload.encode("utf-8")
    require(len(raw) <= MAX_BYTES, "serialized map exceeds 8 MiB; retain history and use a narrower explicitly prepared snapshot")
    parse(raw)
    return payload


def escaped(value):
    return escape(str(value), quote=True).replace("[", "&#91;").replace("]", "&#93;")


def render(data, format):
    if format == "json":
        return encoded_map(data)
    markdown = format == "markdown"
    def heading(level, value):
        return ("#" * level + " " + value + "\n\n") if markdown else f"<h{level}>{value}</h{level}>\n"
    parts = [] if markdown else ['<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Private portfolio map</title></head><body style="overflow-wrap: anywhere;">\n']
    parts += [heading(1, "PRIVATE portfolio map"),
              "<p>Human/private view. Audience labels are not access control. Classification and declared lifecycle are not runtime health. Repository, portfolio concept, hosting surface and legal entity are distinct. No online verification is performed.</p>\n",
              "<details><summary>Calculated totals and declared disagreements</summary><pre style=\"white-space: pre-wrap; overflow-wrap: anywhere;\">" + escaped(encoded(summary(data))) + "</pre></details>\n"]
    provenance = {k: v for k, v in data.items() if k not in {"repositories", "surfaces", "zones", "summary"}}
    parts.append("<details><summary>Scope, observation provenance and retained reviews</summary><pre style=\"white-space: pre-wrap; overflow-wrap: anywhere;\">" + escaped(encoded(provenance)) + "</pre></details>\n")
    repo_by_name = {r["full_name"]: r for r in data["repositories"]}
    for section, title in (("repositories", "Repositories"), ("surfaces", "Hosting surfaces"), ("zones", "DNS zones (not applications)")):
        parts.append(heading(2, title))
        for r in data[section]:
            title = r.get("full_name", r.get("resource_id", r["id"]))
            parts.append("<article><h3>" + escaped(title) + "</h3>\n<dl>")
            purpose = r.get("purpose")
            if section == "surfaces":
                purpose = repo_by_name.get(r["repository"], {}).get("purpose", "unknown — no source-purpose record in this snapshot")
            fields = {"Exact ID": r["id"], "Purpose": purpose or "unknown", "Attribution": r.get("attribution", "not applicable; purpose classification only"),
                      "Repository": r.get("repository") or "unknown", "Legal entity": r.get("legal_entity_id") or "unknown / unassigned",
                      "Framework domains (not adapters)": r.get("framework_domains", []),
                      "Declared lifecycle / runtime": r.get("lifecycle", r.get("runtime_status", "not assessed")),
                      "Caveat": r.get("caveat", "unknown")}
            for label, value in fields.items():
                parts.append("<dt>" + label + "</dt><dd>" + escaped(value) + "</dd>\n")
            parts.append("</dl><details><summary>Saved metadata, evidence and history</summary><pre style=\"white-space: pre-wrap; overflow-wrap: anywhere;\">" + escaped(encoded(r)) + "</pre></details></article>\n")
    if not markdown:
        parts.append("</body></html>\n")
    return "".join(parts)


def fields(value, expected, label):
    require(isinstance(value, dict) and set(value) == set(expected), label + " has missing or unexpected fields")


def pinned(evidence):
    revision = evidence.get("revision")
    if "revision" in evidence:
        require(isinstance(revision, str) and re.fullmatch(r"[0-9a-f]{40}|[0-9a-f]{64}", revision) is not None, "review revision must be a full immutable hash")
    locator = evidence["locator"]
    match = re.fullmatch(r"sha256:([0-9a-f]{64})", locator)
    if locator.startswith("sha256:"):
        require(match is not None, "sha256 locator must contain exactly 64 lowercase hex characters")
    # urlsplit strips leading controls and embedded tabs/newlines; never turn
    # those malformed literals into an apparently immutable path token.
    if not match:
        try:
            url = urlsplit(locator)
        except ValueError:
            url = None
        routes = {
            "github.com": r"/[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9_.-]+/(?:blob|commit)/",
            "codeberg.org": r"/[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+/(?:src/commit|commit)/",
        }
        if url and url.scheme == "https" and url.netloc in routes:
            # Decode only to reject ambiguous syntax, never to repair a pin.
            # Encoded separators/percent signs can hide further normalization.
            require(ord(locator[0]) > 32 and not any(c in locator for c in "\r\n\t")
                    and "\\" not in url.path and "//" not in url.path
                    and re.search(r"%(?:2f|5c|25)", url.path, re.IGNORECASE) is None
                    and not any(part in {".", ".."} for part in unquote(url.path).split("/")),
                    "review locator path must not require normalization")
            # Only the provider route's reference slot is a pin, not a token
            # embedded later in a file path underneath a mutable branch.
            match = re.match(routes[url.netloc] + r"([0-9a-f]{64}|[0-9a-f]{40})(?=/|$)", url.path)
    if match and revision:
        require(match.group(1) == revision, "review revision contradicts immutable locator")
    return bool(revision or match)


def validate_replacement(replacement, names):
    fields(replacement, ("repository", "attribution", "evidence", "caveat"), "replacement")
    repository, attribution = replacement["repository"], replacement["attribution"]
    require(isinstance(attribution, str) and attribution in ATTRIBUTIONS, "unrecognized replacement attribution")
    require((repository is None) == (attribution in {"candidate_only", "unresolved"}), "replacement repository-null and attribution disagree")
    require(repository is None or (text(repository) and (repository in names or codeberg(repository))), "replacement repository must be a member or explicit Codeberg URL")
    evidence_list(replacement["evidence"])
    if attribution in CURRENT:
        require(any([pinned(e) for e in replacement["evidence"]]), "current source evidence needs an immutable locator or full revision")
    require(text(replacement["caveat"]), "replacement caveat must be nonempty")


def validate_review(data, raw, review):
    fields(review, ("schema", "base_map_sha256", "changes"), "review")
    require(review["schema"] == "business-ecosystem.portfolio-review/1", "unsupported review schema")
    require(review["base_map_sha256"] == hashlib.sha256(raw).hexdigest(), "stale or malformed base_map_sha256 (exact input bytes required)")
    changes = review["changes"]
    require(isinstance(changes, list) and bool(changes), "changes must be a nonempty array")
    surfaces = {s["resource_id"]: s for s in data["surfaces"]}
    names = {r["full_name"] for r in data["repositories"]}
    seen = set()
    for change in changes:
        fields(change, ("resource_id", "expected", "replacement"), "change")
        rid = change["resource_id"]
        require(text(rid) and rid in surfaces, "resource_id must exactly match baseline resource_id")
        require(rid not in seen, "repeated resource_id in review")
        seen.add(rid)
        fields(change["expected"], ("repository", "attribution"), "expected before-state")
        surface = surfaces[rid]
        require(change["expected"] == {k: surface[k] for k in ("repository", "attribution")}, "before-state mismatch")
        validate_replacement(change["replacement"], names)


def sha256_text(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def same_json_value(left, right):
    """Compare parsed JSON without Python's bool/int/float coercion."""
    if type(left) is not type(right):
        return False
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(same_json_value(left[key], right[key]) for key in left)
    if isinstance(left, list):
        return len(left) == len(right) and all(same_json_value(a, b) for a, b in zip(left, right))
    if isinstance(left, float):
        return left.hex() == right.hex()  # Preserve signed zero as well.
    return left == right


def validate_history(data):
    if "review_baseline" not in data and "review_history" not in data:
        return
    baseline = data.get("review_baseline")
    fields(baseline, ("map_sha256", "source_relations", "original_summary"), "review_baseline")
    require(sha256_text(baseline["map_sha256"]), "baseline map_sha256 is malformed")
    require(isinstance(baseline["original_summary"], dict), "baseline original_summary must be an object")
    surfaces = {s["resource_id"]: s for s in data["surfaces"]}
    names = {r["full_name"] for r in data["repositories"]}
    relations = baseline["source_relations"]
    require(isinstance(relations, dict) and set(relations) == set(surfaces), "baseline resource coverage differs")
    state = dict(relations)
    attribution = {}
    evidence, caveats = {}, {}
    history = data.get("review_history")
    require(isinstance(history, list) and bool(history), "review_history must be a nonempty array")
    for entry in history:
        fields(entry, ("base_map_sha256", "review_sha256", "applied_at", "verification", "changes"), "history entry")
        require(sha256_text(entry["base_map_sha256"]) and sha256_text(entry["review_sha256"]), "history hashes malformed")
        require(text(entry["applied_at"]) and entry["verification"] == "operator_supplied_not_online_verified", "history provenance malformed")
        changes = entry["changes"]
        require(isinstance(changes, list) and bool(changes), "history changes must be nonempty")
        seen = set()
        for change in changes:
            fields(change, ("resource_id", "before", "replacement"), "history change")
            rid = change["resource_id"]
            require(text(rid) and rid in surfaces and rid not in seen, "history resource invalid or repeated")
            seen.add(rid)
            before = change["before"]
            require(isinstance(before, dict) and before.get("resource_id") == rid and before.get("id") == surfaces[rid]["id"], "history before identity mismatch")
            before_attribution = before.get("attribution")
            require(isinstance(before_attribution, str) and before_attribution in ATTRIBUTIONS, "history before attribution invalid")
            require("repository" in before, "history before requires repository")
            before_repository = before["repository"]
            require((before_repository is None) == (before_attribution in {"candidate_only", "unresolved"}), "history before repository-null and attribution disagree")
            require(before_repository is None or (text(before_repository) and (before_repository in names or codeberg(before_repository))), "history before repository must be a member or explicit Codeberg URL")
            require(before_repository == state[rid], "history before repository disagrees with baseline or preceding review")
            if rid in attribution:
                require(before.get("attribution") == attribution[rid], "history before attribution mismatch")
                require(same_json_value(before.get("evidence"), evidence[rid]), "history before evidence continuity mismatch")
                require(before.get("caveat") == caveats[rid], "history before caveat mismatch")
            replacement = change["replacement"]
            validate_replacement(replacement, names)
            evidence_list(before.get("evidence"))
            state[rid] = replacement["repository"]
            attribution[rid] = replacement["attribution"]
            evidence[rid] = before["evidence"] + replacement["evidence"]
            caveats[rid] = replacement["caveat"]
    require(history[0]["base_map_sha256"] == baseline["map_sha256"], "first review is not bound to original baseline")
    require(state == {rid: s["repository"] for rid, s in surfaces.items()}, "history final source relations disagree")
    require(all(surfaces[rid]["attribution"] == value for rid, value in attribution.items()), "history final attribution disagrees")
    require(all(same_json_value(surfaces[rid]["evidence"], value) for rid, value in evidence.items()), "history final evidence retention disagrees")
    require(all(surfaces[rid].get("caveat") == value for rid, value in caveats.items()), "history final caveat disagrees")


def apply_review(data, raw, review, review_raw):
    validate_review(data, raw, review)
    result = copy.deepcopy(data)
    result.setdefault("review_baseline", {
        "map_sha256": hashlib.sha256(raw).hexdigest(),
        "source_relations": {s["resource_id"]: s["repository"] for s in data["surfaces"]},
        "original_summary": copy.deepcopy(data["summary"]),
    })
    sources = {r["full_name"]: r for r in result["repositories"]}
    surfaces = {s["resource_id"]: s for s in result["surfaces"]}
    changed = []
    for change in review["changes"]:
        surface = surfaces[change["resource_id"]]
        replacement = copy.deepcopy(change["replacement"])
        changed.append({"resource_id": change["resource_id"], "before": copy.deepcopy(surface), "replacement": replacement})
        old_evidence = surface["evidence"]
        surface.update(replacement)
        surface["evidence"] = old_evidence + replacement["evidence"]
        source = sources.get(surface["repository"])
        surface["framework_domains"] = list(source["framework_domains"]) if source else []
        surface["group"] = source["group"] if source else "unresolved"
        surface["framework_relationship"] = "inherited_source_purpose_not_runtime_integration" if source else "not_assigned"
    for repo in result["repositories"]:
        repo["hosting_resources"] = [s["id"] for s in result["surfaces"] if s["repository"] == repo["full_name"]]
    result["summary"].update(counts(result))
    result.setdefault("review_history", []).append({
        "base_map_sha256": hashlib.sha256(raw).hexdigest(),
        "review_sha256": hashlib.sha256(review_raw).hexdigest(),
        "applied_at": datetime.now(timezone.utc).isoformat(),
        "verification": "operator_supplied_not_online_verified",
        "changes": changed,
    })
    return validate(result)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--map", required=True, help="Explicit private JSON input; no discovery")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("summary", help="Validate and compare calculated totals")
    search = commands.add_parser("find", help="Search saved metadata, never referenced sources")
    search.add_argument("query")
    search.add_argument("--limit", type=bounded_limit, default=20)
    commands.add_parser("queue", help="All unresolved, historical, purpose and dirty-deployment findings")
    lookup = commands.add_parser("show", help="Exact ID, resource ID, or repository full_name")
    lookup.add_argument("identifier")
    rendering = commands.add_parser("render", help="Private human view or unchanged machine JSON")
    rendering.add_argument("--format", choices=["html", "markdown", "json"], default="html")
    rendering.add_argument("--output", help="New private file only; default is stdout")
    applying = commands.add_parser("apply-review", help="Apply operator-supplied evidence to a NEW private map")
    applying.add_argument("--review", required=True)
    applying.add_argument("--output", required=True)
    args = parser.parse_args(argv)
    try:
        raw = read_bytes(args.map)
        data = validate(parse(raw))
        if args.command == "apply-review":
            review_raw = read_bytes(args.review)
            result = apply_review(data, raw, parse(review_raw), review_raw)
            payload = encoded_map(result)
            write_new(args.output, payload)
            return 0
        if args.command == "render":
            payload = render(data, args.format)
            if args.output:
                write_new(args.output, payload)
            else:
                sys.stdout.write(payload)
            return 0
        if args.command == "summary":
            result = summary(data)
        elif args.command == "find":
            result = find(data, args.query, args.limit)
        elif args.command == "queue":
            result = queue(data)
        else:
            result = show(data, args.identifier)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (Invalid, OSError, UnicodeError, json.JSONDecodeError) as exc:
        print("error: " + str(exc), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
