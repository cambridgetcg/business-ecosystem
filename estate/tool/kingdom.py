"""KINGDOM foundation reader: kingdom-os read live, per ref, never copied and never extended.

The card enums, LAYERS, the card fields, the rights baselines, the citizens dir and the harvest
rules come from bin/harvest.ts on two refs: the worktree files on disk, and origin/main read as
blobs (cat-file; nothing is fetched). The card parser mirrors harvest's loadCard/validateCard,
including JavaScript's whitespace and line-terminator rules, so `active # note` stays off-enum
exactly as harvest sees it. Nothing here writes. A worktree CARD_ENUMS or LAYERS that cannot be
parsed raises FoundationError (exit 1): there is no honest fallback, not even the lock.
"""
import datetime as dt
import errno
import hashlib
import json
import os
import re
import stat
import tomllib

import safety
from safety import GitRunner, GitRefused, read_checked

KOS_REMOTE_ID = "github.com/cambridgetcg/kingdom-os"
HARVEST = "bin/harvest.ts"
SCHEMA = "SCHEMA.md"
ARCHITECTURE = "ARCHITECTURE.md"
ROSTER = "roster.conf"
FOUNDATION_FILES = (HARVEST, SCHEMA, ARCHITECTURE, ROSTER)
WORKTREE, ORIGIN_MAIN = "worktree", "origin/main"
REFS = (WORKTREE, ORIGIN_MAIN)
LOCK_RELPATH = "vocab/kingdom.lock.toml"
LOCK_HASH_KEYS = ("harvest_blob_sha256", "card_enums_block_sha256", "layers_block_sha256", "schema_md_sha256")
REVIEWED_KEY = "harvest_reviewed_sha256"
MAX_SOURCE = 1 << 20
MAX_GRAPH = 8 << 20
PULSE_TAIL = 64 << 10


class FoundationError(safety.EstateError):
    """The worktree foundation cannot be read; the CLI exits 1 and keeps the previous run."""


# ── JavaScript string semantics (harvest runs under bun) ───────────────────────────────────

# JS \s and String.prototype.trim: WhiteSpace plus LineTerminator, nothing else. Python's own
# \s and str.strip() also take \x1c-\x1f and \x85, which would make the mirror disagree.
_JS_WS_CHARS = ("\t\n\x0b\x0c\r   " + "".join(chr(c) for c in range(0x2000, 0x200b))
                + "    　﻿")
_JS_WS = "[" + "".join("\\u%04x" % ord(c) for c in _JS_WS_CHARS) + "]"
_JS_DOT = "[^\n\r  ]"  # JS `.` never matches a line terminator
# harvest: line.match(/^([a-zA-Z_]+):\s*(.*)$/) with no flags, so $ is the end of the line text.
_CARD_LINE = re.compile("([a-zA-Z_]+):" + _JS_WS + "*(" + _JS_DOT + "*)\\Z")


def js_trim(text):
    return text.strip(_JS_WS_CHARS)


def _unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def _card_array(value):
    """harvest parseCardArray: [a, b] -> ['a', 'b'] (unquoted, empties dropped), else None."""
    if not (value.startswith("[") and value.endswith("]")):
        return None
    return [item for item in (_unquote(js_trim(part)) for part in value[1:-1].split(",")) if item]


def _decode(data):
    return data.decode("utf-8", "replace") if isinstance(data, (bytes, bytearray)) else data


# ── cards ───────────────────────────────────────────────────────────────────────────────────

SCALAR_FIELDS = ("name", "kind", "layer", "owner_sister", "domain", "state", "purpose")


def _load_card_raw(text):
    """harvest loadCard's first pass: flat key: value lines, every duplicated key dropped."""
    raw, seen, duplicated = {}, set(), set()
    for line in text.split("\n"):
        match = _CARD_LINE.match(line)
        if match is None:
            continue
        key, value = match.group(1), js_trim(match.group(2))
        if key in seen:
            duplicated.add(key)
            raw.pop(key, None)
            continue
        seen.add(key)
        array = _card_array(value)
        if array is not None:
            raw[key] = array
        elif value:
            raw[key] = _unquote(value)
    for key in duplicated:
        raw.pop(key, None)
    return raw


def _valid_fields(raw, enums, accepted_adoptions):
    """harvest loadCard's second pass: only schema-approved, correctly typed values survive."""
    card = {}
    for field in SCALAR_FIELDS:
        value = raw.get(field)
        allowed = enums.get(field)
        if isinstance(value, str) and (allowed is None or value in allowed):
            card[field] = value
    depends = raw.get("dependsOn")
    if isinstance(depends, list):
        card["dependsOn"] = list(depends)
    adopts = raw.get("adopts")
    if isinstance(adopts, list) and all(v in accepted_adoptions for v in adopts):
        card["adopts"] = list(dict.fromkeys(adopts))
    return card


def _validate_card(text, enums, ref_rules, known_names, expected_name):
    """harvest validateCard: diagnostics carry line, field and code, never the rejected value."""
    required = list(ref_rules.get("required_card_fields") or [])
    fields = set(required) | set(ref_rules.get("optional_card_fields") or [])
    accepted = set(ref_rules.get("rights_baselines") or [])
    check_name = bool((ref_rules.get("rules") or {}).get("name_mismatch_code")) and expected_name is not None
    diagnostics, seen = [], set()

    def add(code, line=None, field=None):
        entry = {"code": code}
        if line is not None:
            entry["line"] = line
        if field is not None:
            entry["field"] = field
        diagnostics.append(entry)

    for number, source in enumerate(text.split("\n"), 1):
        trimmed = js_trim(source)
        if not trimmed or trimmed.startswith("#"):
            continue
        match = _CARD_LINE.match(source)
        if match is None:
            add("malformed-line", number)
            continue
        field, raw = match.group(1), js_trim(match.group(2))
        if field not in fields:
            add("unknown-field", number, field)
            continue
        if field in seen:
            add("duplicate-field", number, field)
            continue
        seen.add(field)
        array = _card_array(raw)
        if field in ("dependsOn", "adopts"):
            if array is None:
                add("invalid-type", number, field)
            elif field == "dependsOn":
                if known_names is not None and any(d.lower() not in known_names for d in array):
                    add("unknown-dependency", number, field)
            elif any(a not in accepted for a in array):
                add("unsupported-adoption", number, field)
            continue
        if not raw or array is not None:
            add("invalid-type", number, field)
            continue
        value = _unquote(raw)
        if field == "name" and check_name and value != expected_name:
            add("name-mismatch", number, field)
        allowed = enums.get(field)
        if allowed is not None and value not in allowed:
            add("invalid-enum", number, field)
    for field in required:
        if field not in seen:
            add("missing-field", None, field)
    return diagnostics


def parse_card(text, enums, rules, known_names=None, expected_name=None):
    """Parse a kingdom.yaml exactly as harvest does under one ref.

    rules is that ref's foundation dict (read_foundation()["refs"][ref]): it supplies the rights
    baselines, the required/optional fields and the name-mismatch rule. known_names (lowercased
    roster+fleet names) enables the unknown-dependency check; expected_name (the roster seed)
    enables name-mismatch where the ref has it. Returns {raw (PRIVATE), valid, off_enum,
    diagnostics, schema_ok, deps_checked}. Inline comments are not stripped: `state: active #
    note` is off-enum, as in harvest."""
    text = _decode(text)
    accepted = set(rules.get("rights_baselines") or [])
    raw = _load_card_raw(text)
    valid = _valid_fields(raw, enums, accepted)
    off_enum = {field: raw[field] for field in SCALAR_FIELDS
                if field in enums and isinstance(raw.get(field), str) and raw[field] not in enums[field]}
    diagnostics = _validate_card(text, enums, rules, known_names, expected_name)
    return {"raw": raw, "valid": valid, "off_enum": off_enum, "diagnostics": diagnostics,
            "schema_ok": not diagnostics, "deps_checked": known_names is not None}


# ── roster ──────────────────────────────────────────────────────────────────────────────────

ROSTER_COLUMNS = ("name", "path", "kind", "layer", "domain", "state", "purpose")


def _expand_home(path, home):
    # harvest: p.startsWith('~') ? p.replace('~', HOME) : p  (the first '~' only)
    return path.replace("~", home, 1) if path.startswith("~") else path


def parse_roster(text, home=None):
    """roster.conf as harvest parseRoster reads it: `name | path | kind | layer | domain | state |
    purpose`, '#' lines skipped, rows without a name or path skipped (and counted here)."""
    home = os.environ.get("HOME", "") if home is None else home
    rows, skipped = [], []
    for number, line in enumerate(_decode(text).split("\n"), 1):
        stripped = js_trim(line)
        if not stripped or stripped.startswith("#"):
            continue
        parts = [js_trim(part) for part in stripped.split("|")]
        parts += [None] * (len(ROSTER_COLUMNS) - len(parts))
        name, path = parts[0], parts[1]
        if not name or not path:
            skipped.append(number)
            continue
        row = dict(zip(ROSTER_COLUMNS, parts[:len(ROSTER_COLUMNS)]))
        row["purpose"] = row["purpose"] if row["purpose"] is not None else ""
        row["path_raw"] = path
        row["path"] = _expand_home(path, home)
        row["line"] = number
        rows.append(row)
    return {"rows": rows, "skipped_lines": skipped}


# ── harvest.ts extraction ──────────────────────────────────────────────────────────────────

class _Unparsed(Exception):
    pass


_STRING_ITEM = re.compile(r"'([^'\\\n]*)'|\"([^\"\\\n]*)\"")


def _string_list(body, what):
    values = []
    for index, item in enumerate(part.strip() for part in body.split(",")):
        if not item:
            if index == len(body.split(",")) - 1:
                continue  # a trailing comma
            raise _Unparsed("%s: empty item" % what)
        match = _STRING_ITEM.fullmatch(item)
        if match is None:
            raise _Unparsed("%s: item is not a string literal" % what)
        values.append(match.group(1) if match.group(1) is not None else match.group(2))
    if not values:
        raise _Unparsed("%s: empty list" % what)
    return values


def _sha256(text):
    return hashlib.sha256(text.encode("utf-8", "surrogateescape")).hexdigest()


def _card_enums(text):
    block = re.search(r"const CARD_ENUMS[^=]*=\s*\{(.*?)\n\}", text, re.S)
    if block is None:
        raise _Unparsed("CARD_ENUMS block not found")
    enums = {}
    for field, body in re.findall(r"(\w+):\s*\[([^\]]*)\]", block.group(1)):
        if field in enums:
            raise _Unparsed("CARD_ENUMS: duplicate field %s" % field)
        enums[field] = _string_list(body, "CARD_ENUMS." + field)
    if not enums:
        raise _Unparsed("CARD_ENUMS block has no fields")
    return enums, _sha256(block.group(0))


def _const_list(text, name):
    match = re.search(r"const %s\s*=\s*\[([^\]]*)\]" % name, text)
    if match is None:
        raise _Unparsed("%s not found" % name)
    return _string_list(match.group(1), name), _sha256(match.group(0))


def _rights_keys(text):
    block = re.search(r"const RIGHTS_BASELINES[^=]*=\s*\{(.*?)\n\}", text, re.S)
    if block is None:
        raise _Unparsed("RIGHTS_BASELINES block not found")
    keys = re.findall(r"(?m)^  (?:'([^'\n]+)'|\"([^\"\n]+)\")\s*:\s*\{", block.group(1))
    return [a or b for a, b in keys]


def _citizens_dir(text):
    match = re.search(r"const CITIZENS_DIR\s*=\s*join\(\s*HOME\s*,([^)]*)\)", text)
    if match is None:
        raise _Unparsed("CITIZENS_DIR = join(HOME, ...) not found")
    return _string_list(match.group(1), "CITIZENS_DIR")


def _function_body(text, name):
    start = re.search(r"\nfunction %s\(" % name, text)
    if start is None:
        raise _Unparsed("function %s not found" % name)
    end = text.find("\n}\n", start.end())
    if end < 0:
        raise _Unparsed("function %s has no closing brace" % name)
    return text[start.end():end]


def _rules(text):
    """The harvest rules that change what a card means, read from this ref's code."""
    rules, errors = {}, []
    try:
        fleet = _function_body(text, "discoverFleet")
        layer = re.search(r"\blayer:\s*'([^'\n]+)'", fleet)
        rules["fleet_forced_layer"] = layer.group(1) if layer else None
        if layer is None:
            errors.append("discoverFleet: no forced layer literal")
        rules["fleet_defaults"] = {field: default for field, default in re.findall(
            r"\b(\w+):\s*\(card\.\w+ as string\)\s*\?\?\s*'([^'\n]*)'", fleet)}
    except _Unparsed as exc:
        rules["fleet_forced_layer"], rules["fleet_defaults"] = None, {}
        errors.append(str(exc))
    try:
        build = _function_body(text, "build")
        destructure = re.search(r"const\s*\{([^}]*)\}\s*=\s*loadedCard", build)
        if destructure is None:
            raise _Unparsed("build: card destructuring not found")
        # origin/main destructures `name: _cardName` away: the roster seed owns the name.
        rules["card_name_overrides"] = re.search(r"\bname\s*:", destructure.group(1)) is None
        rules["depends_filtered"] = re.search(r"\.dependsOn\.filter\(", build) is not None
    except _Unparsed as exc:
        rules["card_name_overrides"] = rules["depends_filtered"] = None
        errors.append(str(exc))
    codes = re.search(r"type DiagnosticCode\s*=(.*?)\n\n", text, re.S)
    if codes is None:
        rules["name_mismatch_code"] = rules["unknown_dependency_code"] = None
        errors.append("DiagnosticCode union not found")
    else:
        rules["name_mismatch_code"] = "'name-mismatch'" in codes.group(1)
        rules["unknown_dependency_code"] = "'unknown-dependency'" in codes.group(1)
    return rules, errors


# ── ARCHITECTURE.md and SCHEMA.md ──────────────────────────────────────────────────────────

_BOX_LABEL = re.compile(r"\s{1,3}([A-Z][A-Z0-9&/-]*(?: [A-Z][A-Z0-9&/-]*)*)\s{2,}(\S.*?)\s*")


def parse_architecture(text, layers):
    """The first box of ARCHITECTURE.md: segments between rules, each `│  LABEL  one-liner │`
    plus continuation lines. Exactly 6 segments map by position onto LAYERS[0..5]; os has no
    row and gets none (never invented)."""
    segments, inside = [], False
    for line in _decode(text).split("\n"):
        stripped = line.strip()
        if stripped.startswith("┌"):
            if segments or inside:
                break
            inside, segments = True, [[]]
            continue
        if not inside:
            continue
        if stripped.startswith("└"):
            break
        if stripped.startswith("├"):
            segments.append([])
            continue
        if stripped.startswith("│"):
            segments[-1].append(stripped.strip("│").rstrip())
    rows = []
    for segment in segments:
        content = [s for s in segment if s.strip()]
        if not content:
            continue
        first = _BOX_LABEL.fullmatch(content[0])
        label = first.group(1) if first else None
        labels, detail = ([label] if label else []), []
        for extra in content[1:]:
            more = _BOX_LABEL.fullmatch(extra)
            if more:
                labels.append(more.group(1))
                detail.append(more.group(2))
            else:
                detail.append(extra.strip())
        rows.append({"label": label, "label_full": " ".join(labels) or None,
                     "one_liner": first.group(2) if first else content[0].strip(), "detail": detail})
    mapped = None
    if len(rows) == 6 and layers and len(layers) >= 6:
        mapped = {layers[index]: {"label": row["label"], "one_liner": row["one_liner"]}
                  for index, row in enumerate(rows)}
    return {"rows": rows, "row_count": len(rows), "mapped": mapped,
            "unmapped_layers": [l for l in (layers or []) if mapped is None or l not in mapped]}


_ENUM_RUN = re.compile(r"[a-z][a-z0-9_.-]*(?:\|[a-z][a-z0-9_.-]*)+")


def parse_schema_enums(text):
    """SCHEMA.md's fenced yaml example: `field: example  # a|b|c ...` comment enums."""
    found, fenced = {}, False
    for line in _decode(text).split("\n"):
        if line.strip().startswith("```"):
            fenced = not fenced
            continue
        if not fenced:
            continue
        match = re.match(r"([A-Za-z_]+):[^#]*#(.*)$", line)
        if match is None:
            continue
        run = _ENUM_RUN.search(match.group(2))
        if run is not None:
            found[match.group(1)] = run.group(0).split("|")
    return found


def _schema_check(schema_enums, card_enums):
    mismatches = []
    for field in sorted(set(card_enums) | set(schema_enums)):
        ours, theirs = card_enums.get(field), schema_enums.get(field)
        if ours is None or theirs is None or set(ours) != set(theirs):
            mismatches.append({"field": field, "card_enums": ours, "schema_md": theirs})
    return {"ok": not mismatches, "mismatches": mismatches}


# ── per-ref foundation ─────────────────────────────────────────────────────────────────────

def _ref_data(ref, files, home):
    """Extract one ref's foundation from {relpath: (bytes|None, status)}. Returns (data, errors)
    where errors names every extraction that failed (never silently defaulted)."""
    data = {"ref": ref, "files": {}, "card_enums": None, "layers": None, "parse_errors": []}
    errors = []
    for rel in FOUNDATION_FILES:
        raw, status = files.get(rel, (None, "missing"))
        data["files"][rel] = {"status": status or "ok",
                              "sha256": hashlib.sha256(raw).hexdigest() if raw is not None else None}
    harvest_raw = files.get(HARVEST, (None, None))[0]
    if harvest_raw is None:
        errors.append("bin/harvest.ts unreadable: %s" % data["files"][HARVEST]["status"])
        data["status"] = "unparsed"
        data["parse_errors"] = errors
        return data, errors
    text = _decode(harvest_raw)
    data["harvest_blob_sha256"] = data["files"][HARVEST]["sha256"]
    for key, reader in (("card_enums", _card_enums), ("layers", lambda t: _const_list(t, "LAYERS"))):
        try:
            value, block_sha = reader(text)
            data[key] = value
            data[key + "_block_sha256"] = block_sha
        except _Unparsed as exc:
            data[key] = None
            errors.append(str(exc))
    for key, name in (("required_card_fields", "REQUIRED_CARD_FIELDS"), ("optional_card_fields", "OPTIONAL_CARD_FIELDS")):
        try:
            data[key] = _const_list(text, name)[0]
        except _Unparsed as exc:
            data[key] = None
            errors.append(str(exc))
    for key, reader in (("rights_baselines", _rights_keys), ("citizens_dir", _citizens_dir)):
        try:
            data[key] = reader(text)
        except _Unparsed as exc:
            data[key] = None
            errors.append(str(exc))
    data["citizens_dir_path"] = (os.path.join(home, *data["citizens_dir"]) if data["citizens_dir"] else None)
    data["rules"], rule_errors = _rules(text)
    errors += rule_errors
    schema_raw = files.get(SCHEMA, (None, None))[0]
    data["schema_md_sha256"] = data["files"][SCHEMA]["sha256"]
    if schema_raw is not None and data["card_enums"] is not None:
        data["schema_check"] = _schema_check(parse_schema_enums(schema_raw), data["card_enums"])
    else:
        data["schema_check"] = {"ok": None, "mismatches": [], "reason": "SCHEMA.md or CARD_ENUMS unavailable"}
    arch_raw = files.get(ARCHITECTURE, (None, None))[0]
    data["architecture"] = (parse_architecture(arch_raw, data["layers"]) if arch_raw is not None
                            else {"rows": [], "row_count": 0, "mapped": None, "reason": "unreadable"})
    roster_raw = files.get(ROSTER, (None, None))[0]
    data["roster"] = parse_roster(roster_raw, home) if roster_raw is not None else None
    data["parse_errors"] = errors
    data["status"] = "ok" if not errors else "partial"
    if data["card_enums"] is None or data["layers"] is None:
        data["status"] = "unparsed"
    return data, errors


def _iso_from_git(text):
    try:
        moment = dt.datetime.fromisoformat(text.strip())
    except ValueError:
        return None
    return safety.iso(moment)


def _commit(git, ref):
    """(sha, committed_at) for a ref, or (None, None) when git cannot say."""
    res = git.run("rev-parse", "--verify", "-q", ref)
    if not res.ok or not re.fullmatch(r"[0-9a-f]{40,64}", res.out.strip()):
        return None, None
    when = git.run("log", "-1", "--format=%cI", ref)
    return res.out.strip(), (_iso_from_git(when.out) if when.ok else None)


def _ahead_behind(git):
    res = git.run("rev-list", "--left-right", "--count", ORIGIN_MAIN + "...HEAD")
    match = re.fullmatch(r"(\d+)\s+(\d+)", res.out.strip()) if res.ok else None
    if match is None:
        return {"behind": None, "ahead": None, "reason": "rev-list failed: %s" % (res.err.strip()[:200] or res.code)}
    return {"behind": int(match.group(1)), "ahead": int(match.group(2)), "reason": None}


def _fetch_head(git, root, now):
    res = git.run("rev-parse", "--git-dir")
    if not res.ok:
        return {"mtime": None, "age_s": None, "reason": "git dir unknown"}
    git_dir = os.path.join(root, res.out.strip())
    try:
        info = os.lstat(os.path.join(git_dir, "FETCH_HEAD"))
    except FileNotFoundError:
        return {"mtime": None, "age_s": None, "reason": "FETCH_HEAD missing (never fetched)"}
    except OSError as exc:
        return {"mtime": None, "age_s": None, "reason": "lstat failed: %s" % exc.strerror}
    moment = dt.datetime.fromtimestamp(info.st_mtime, dt.timezone.utc)
    return {"mtime": safety.iso(moment), "age_s": int(now.timestamp() - info.st_mtime), "reason": None}


def _read_worktree(root):
    files = {}
    for rel in FOUNDATION_FILES:
        files[rel] = read_checked(os.path.join(root, rel), MAX_SOURCE)
    return files


def _read_blobs(git, ref):
    files = {}
    for rel in FOUNDATION_FILES:
        res = git.run("cat-file", "blob", "%s:%s" % (ref, rel))
        if res.ok:
            files[rel] = (res.raw, None) if len(res.raw) <= MAX_SOURCE else (None, "too-large")
        elif res.timed_out:
            files[rel] = (None, "timeout")
        else:
            files[rel] = (None, "missing" if res.code == 128 else "error: exit %s" % res.code)
    return files


def _divergence(worktree, origin):
    keys = ("card_enums", "layers", "required_card_fields", "optional_card_fields", "rights_baselines", "citizens_dir")
    out = [{"key": key, WORKTREE: worktree.get(key), ORIGIN_MAIN: origin.get(key)}
           for key in keys if worktree.get(key) != origin.get(key)]
    for rule in sorted(set(worktree.get("rules") or {}) | set(origin.get("rules") or {})):
        a, b = (worktree.get("rules") or {}).get(rule), (origin.get("rules") or {}).get(rule)
        if a != b:
            out.append({"key": "rules." + rule, WORKTREE: a, ORIGIN_MAIN: b})
    labels = [((r.get("architecture") or {}).get("mapped") or {}) for r in (worktree, origin)]
    for layer in sorted(set(labels[0]) | set(labels[1])):
        a, b = labels[0].get(layer, {}).get("label"), labels[1].get(layer, {}).get("label")
        if a != b:
            out.append({"key": "architecture." + layer, WORKTREE: a, ORIGIN_MAIN: b})
    return out


def read_foundation(kos, home=None, git=None, now=None):
    """Read kingdom-os on both refs. kos is a path or locate()'s dict.

    Returns {kos_path, remote_id, refs: {worktree, origin/main}, fetch_head, ahead_behind,
    divergence[], alerts[], observed_at}. Each ref dict has status ok|partial|unparsed|unreadable,
    commit, committed_at, card_enums, layers, required/optional_card_fields, rights_baselines,
    citizens_dir(+_path), rules{fleet_forced_layer, fleet_defaults, card_name_overrides,
    name_mismatch_code, unknown_dependency_code, depends_filtered}, architecture, schema_check,
    roster, the four lock hashes and parse_errors. Raises FoundationError when the worktree
    CARD_ENUMS or LAYERS cannot be parsed."""
    path = kos["path"] if isinstance(kos, dict) else kos
    root = os.path.realpath(path)
    home = os.environ.get("HOME", "") if home is None else home
    now = now or safety.utc_now()
    git = git or GitRunner(root, role="kingdom")
    alerts = []

    def alert(code, ref, message):
        alerts.append({"code": code, "ref": ref, "message": message})

    worktree, errors = _ref_data(WORKTREE, _read_worktree(root), home)
    if worktree["card_enums"] is None or worktree["layers"] is None:
        raise FoundationError("kingdom-os worktree foundation unreadable at %s: %s" % (root, "; ".join(errors)))
    for message in errors:
        alert("foundation-parse", WORKTREE, message)
    top = git.toplevel_check()
    refs = {WORKTREE: worktree}
    fetch_head, ahead_behind = {"mtime": None, "age_s": None, "reason": "repository check failed"}, None
    if not top["ok"]:
        worktree["commit"] = worktree["committed_at"] = None
        refs[ORIGIN_MAIN] = {"ref": ORIGIN_MAIN, "status": "unreadable", "reason": top["reason"]}
        alert("origin-main-unreadable", ORIGIN_MAIN, "git toplevel check failed: %s" % top["reason"])
    else:
        worktree["commit"], worktree["committed_at"] = _commit(git, "HEAD")
        refs[ORIGIN_MAIN] = _read_origin(git, home, alert)
        fetch_head = _fetch_head(git, root, now)
        ahead_behind = _ahead_behind(git) if refs[ORIGIN_MAIN].get("commit") else None
        _mark_head_matches(git, worktree, alert)
    for ref, data in refs.items():
        _ref_alerts(ref, data, alert)
    origin = refs[ORIGIN_MAIN]
    divergence = _divergence(worktree, origin) if origin.get("status") in ("ok", "partial") else []
    for item in divergence:
        if item["key"] in ("card_enums", "layers"):
            alert("ref-divergence", None, "%s differs between worktree and origin/main" % item["key"])
    return {"kos_path": root, "remote_id": KOS_REMOTE_ID, "refs": refs, "fetch_head": fetch_head,
            "ahead_behind": ahead_behind, "divergence": divergence, "alerts": alerts,
            "observed_at": safety.iso(now)}


def _read_origin(git, home, alert):
    flag, reasons = git.promisor_state()
    if flag is not False:
        alert("origin-main-unreadable", ORIGIN_MAIN,
              "object reads skipped (promisor or unverified config: %s)" % (", ".join(reasons) or "unknown"))
        return {"ref": ORIGIN_MAIN, "status": "unreadable", "reason": "promisor"}
    commit, committed_at = _commit(git, ORIGIN_MAIN)
    if commit is None:
        alert("origin-main-unreadable", ORIGIN_MAIN, "origin/main does not resolve")
        return {"ref": ORIGIN_MAIN, "status": "unreadable", "reason": "ref missing"}
    try:
        files = _read_blobs(git, ORIGIN_MAIN)
    except GitRefused as exc:
        alert("origin-main-unreadable", ORIGIN_MAIN, str(exc))
        return {"ref": ORIGIN_MAIN, "status": "unreadable", "reason": "refused", "commit": commit}
    data, errors = _ref_data(ORIGIN_MAIN, files, home)
    data["commit"], data["committed_at"] = commit, committed_at
    for message in errors:
        alert("origin-main-parse" if data["status"] == "unparsed" else "foundation-parse", ORIGIN_MAIN, message)
    return data


def _mark_head_matches(git, worktree, alert):
    """Worktree files are what is on disk; say per file whether they equal the HEAD blob."""
    flag, _ = git.promisor_state()
    for rel, entry in worktree["files"].items():
        if flag is not False or entry["sha256"] is None:
            entry["matches_head"] = None
            continue
        res = git.run("cat-file", "blob", "HEAD:" + rel)
        entry["matches_head"] = (hashlib.sha256(res.raw).hexdigest() == entry["sha256"]) if res.ok else None
    changed = [rel for rel, e in worktree["files"].items() if e.get("matches_head") is False]
    if changed:
        alert("worktree-uncommitted", WORKTREE, "foundation files differ from HEAD: " + ", ".join(changed))


def _ref_alerts(ref, data, alert):
    if data.get("status") not in ("ok", "partial"):
        return
    check = data.get("schema_check") or {}
    if check.get("ok") is False:
        alert("schema-enum-mismatch", ref, "SCHEMA.md comment enums disagree with CARD_ENUMS for: "
              + ", ".join(m["field"] for m in check["mismatches"]))
    enum_layers = (data.get("card_enums") or {}).get("layer")
    if enum_layers is not None and data.get("layers") is not None and set(enum_layers) != set(data["layers"]):
        alert("layers-enum-mismatch", ref, "LAYERS and CARD_ENUMS.layer hold different values")
    arch = data.get("architecture") or {}
    if arch.get("mapped") is None:
        alert("architecture-rows", ref, "ARCHITECTURE box has %s rows, not 6; labels left unmapped"
              % arch.get("row_count"))
    forced = (data.get("rules") or {}).get("fleet_forced_layer")
    if forced is not None and data.get("layers") is not None and forced not in data["layers"]:
        alert("fleet-layer-off-enum", ref, "discoverFleet forces a layer that LAYERS does not hold")


# ── locating kingdom-os ────────────────────────────────────────────────────────────────────

def _has_harvest(path):
    try:
        return stat.S_ISREG(os.lstat(os.path.join(path, HARVEST)).st_mode)
    except OSError:
        return False


def locate(checkouts, override=None):
    """The kingdom-os checkout: config override first; else the checkouts whose primary remote is
    github.com/cambridgetcg/kingdom-os and that hold bin/harvest.ts, preferring a non-worktree,
    then the newest commit, then the shortest path. More than one equal candidate is an alert.
    Returns {path, basis, candidates, alerts}; raises FoundationError when none qualifies."""
    if override:
        root = os.path.realpath(safety.expand_locator(override))
        if not _has_harvest(root):
            raise FoundationError("kingdom_os_override %s has no regular %s" % (root, HARVEST))
        return {"path": root, "basis": "override", "candidates": [root], "alerts": []}
    found = [c for c in checkouts if c.get("primary_remote") == KOS_REMOTE_ID and c.get("path")
             and _has_harvest(c["path"])]
    if not found:
        raise FoundationError("no checkout with primary remote %s and %s" % (KOS_REMOTE_ID, HARVEST))

    def rank(c):
        return (bool(c.get("is_worktree")), _neg_time(c.get("last_commit_at")), len(c["path"]), c["path"])

    found.sort(key=rank)
    best = found[0]
    alerts = []
    peers = [c for c in found if rank(c)[:2] == rank(best)[:2]]
    if len(peers) > 1:
        alerts.append({"code": "ambiguous-kingdom-os", "ref": None,
                       "message": "%d equally ranked kingdom-os checkouts; chose the shortest path" % len(peers)})
    return {"path": best["path"], "basis": "remote", "candidates": [c["path"] for c in found], "alerts": alerts}


def _neg_time(text):
    try:
        moment = dt.datetime.fromisoformat(str(text).replace("Z", "+00:00"))
    except ValueError:
        return float("inf")  # an unknown commit time ranks last, never first
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=dt.timezone.utc)
    return -moment.timestamp()


# ── harvest's view of one checkout ─────────────────────────────────────────────────────────

def _under(path, directory):
    if not path or not directory:
        return False
    candidates = {os.path.normpath(path), os.path.realpath(path)}
    parents = {os.path.normpath(directory), os.path.realpath(directory)}
    return any(os.path.dirname(p) in parents for p in candidates)


def harvest_view(card, roster_row, path, rules, known_names=None):
    """What harvest's build() would emit for one checkout under one ref, or None if harvest
    would not see it. card: parse_card() result (None when there is no card file);
    roster_row: a parse_roster row (None when unlisted); rules: that ref's foundation dict.

    Roster rows: the card's valid fields override the roster except path; the name only where
    the ref lets a card rename a member. A carded directory directly under CITIZENS_DIR is a
    fleet entry with the forced layer and the ref's literal defaults. Returns the view with
    source roster|fleet, overrides {field: {card, harvest}} where a rule overrode the card, and
    unknown_rules naming any rule this ref's code did not let us read."""
    ref_rules = rules.get("rules") or {}
    valid = dict(card["valid"]) if card is not None else {}
    valid.pop("adopts", None)
    unknown = []
    view = None
    if roster_row is not None:
        view = {k: roster_row.get(k) for k in ("name", "kind", "layer", "domain", "state", "purpose")}
        overlay = dict(valid)
        if ref_rules.get("card_name_overrides") is None:
            unknown.append("card_name_overrides")
            if "name" in overlay and overlay["name"] != view["name"]:
                overlay["name"] = None
        elif ref_rules["card_name_overrides"] is False:
            overlay.pop("name", None)
        view.update(overlay)
        view["path"] = roster_row.get("path")
        view["dependsOn"] = list(valid.get("dependsOn") or [])
        view["source"] = "roster"
    fleet = None
    if card is not None and _under(path, rules.get("citizens_dir_path")):
        defaults = ref_rules.get("fleet_defaults") or {}
        forced = ref_rules.get("fleet_forced_layer")
        if forced is None:
            unknown.append("fleet_forced_layer")
        fleet = {"name": valid.get("name") or os.path.basename(os.path.normpath(path)),
                 "path": path, "layer": forced,
                 "dependsOn": list(valid.get("dependsOn") or []), "source": "fleet"}
        for field in ("kind", "domain", "state", "purpose"):
            fleet[field] = valid[field] if field in valid else defaults.get(field)
    result = fleet or view
    if result is None:
        return None
    if fleet is not None and view is not None:
        result["also_roster"] = view
    if ref_rules.get("depends_filtered") and known_names is not None:
        result["dependsOn"] = [d for d in result["dependsOn"] if d.lower() in known_names]
    elif ref_rules.get("depends_filtered"):
        unknown.append("known_names (depends filter not applied)")
    result["overrides"] = {field: {"card": valid[field], "harvest": result.get(field)}
                           for field in ("name", "kind", "layer", "domain", "state", "purpose")
                           if field in valid and result.get(field) != valid[field]}
    result["ref"] = rules.get("ref")
    result["unknown_rules"] = unknown
    return result


# ── REGISTRY.yaml strict subset ────────────────────────────────────────────────────────────

REGISTRY_FIELDS = ("id", "what", "audience", "urls", "repo", "runtime", "status", "expect", "deploy")
_TOP = re.compile(r"([A-Za-z_][A-Za-z0-9_]*):(?:[ \t]+(.*))?")
_ENTRY = re.compile(r"  - id:[ \t]*(.*)")
_FIELD = re.compile(r"    ([A-Za-z_][A-Za-z0-9_]*):(?:[ \t]+(.*))?")
_BLOCK = re.compile(r"[|>][+-]?[0-9]?(?:[ \t]+#.*)?")


class _YamlError(Exception):
    pass


def _strip_comment(text):
    """Drop ` # comment` from an unquoted value."""
    match = re.search(r"(?:^|[ \t])#", text)
    return (text[:match.start()] if match else text).strip()


def _quoted(text):
    """('value', rest) for a value starting with a quote."""
    quote = text[0]
    if quote == "'":
        index, out = 1, []
        while index < len(text):
            if text[index] == "'":
                if text[index + 1:index + 2] == "'":
                    out.append("'")
                    index += 2
                    continue
                return "".join(out), text[index + 1:]
            out.append(text[index])
            index += 1
        raise _YamlError("unterminated single-quoted value")
    index, out = 1, []
    while index < len(text):
        ch = text[index]
        if ch == "\\" and index + 1 < len(text):
            out.append({"n": "\n", "t": "\t", '"': '"', "\\": "\\"}.get(text[index + 1], text[index + 1]))
            index += 2
            continue
        if ch == '"':
            return "".join(out), text[index + 1:]
        out.append(ch)
        index += 1
    raise _YamlError("unterminated double-quoted value")


def _after_value(rest):
    rest = rest.strip()
    if rest and not rest.startswith("#"):
        raise _YamlError("unexpected text after a value")


def _scalar(text):
    text = text.strip()
    if not text:
        return None
    if text[0] in "\"'":
        value, rest = _quoted(text)
        _after_value(rest)
        return value
    return _strip_comment(text)


def _split_flow(body):
    """Split a flow collection body on commas outside quotes."""
    parts, current, quote = [], [], None
    for ch in body:
        if quote:
            current.append(ch)
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
            current.append(ch)
        elif ch == ",":
            parts.append("".join(current))
            current = []
        else:
            current.append(ch)
    if quote:
        raise _YamlError("unterminated quote in a flow collection")
    parts.append("".join(current))
    return [p.strip() for p in parts if p.strip()]


def _flow_end(text, opener, closer):
    quote = None
    for index, ch in enumerate(text):
        if quote:
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == closer:
            return index
    raise _YamlError("unterminated flow %s" % ("map" if opener == "{" else "sequence"))


def _flow_item(text):
    if text and text[0] in "\"'":
        value, rest = _quoted(text)
        if rest.strip():
            raise _YamlError("text after a quoted flow item")
        return value
    if re.fullmatch(r"-?\d+", text):
        return int(text)
    return text


def _value(text):
    """Parse one field value: quoted, flow map, flow sequence or plain scalar."""
    text = text.strip()
    if text.startswith("{"):
        end = _flow_end(text, "{", "}")
        _after_value(text[end + 1:])
        out = {}
        for item in _split_flow(text[1:end]):
            match = re.fullmatch(r"([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)", item, re.S)
            if match is None:
                raise _YamlError("flow map item without key: value")
            out[match.group(1)] = _flow_item(match.group(2).strip())
        return out
    if text.startswith("["):
        end = _flow_end(text, "[", "]")
        _after_value(text[end + 1:])
        return [_flow_item(item) for item in _split_flow(text[1:end])]
    return _scalar(text)


def _indent(line):
    return len(line) - len(line.lstrip(" "))


def parse_registry(text):
    """REGISTRY.yaml through a strict subset reader: top-level version/updated, `services:`
    entries starting at `  - id: X`, scalars at indent 4 (quotes stripped, ` # comment` dropped
    from unquoted values), flow maps and sequences on one line; block scalars and nested lists
    are consumed by indentation and ignored. A broken entry keeps its id with every field
    unknown (None) plus its errors; the reader never raises on content.

    Returns {version, updated, services[{id, what, audience, urls, repo, runtime,
    runtime_prefix, status, expect, deploy, line, errors}], ids, runtime_prefixes, errors}."""
    lines = _decode(text).split("\n")
    top, services, errors = {}, [], []
    entry, in_services, skip_deeper_than = None, False, None

    def close():
        if entry is not None:
            services.append(_finish(entry))

    for number, line in enumerate(lines, 1):
        body = line.rstrip("\r")
        if not body.strip() or body.lstrip(" ").startswith("#"):
            continue
        if "\t" in body[:_indent(body) + 1]:
            _record(entry, errors, number, "tab indentation")
            continue
        depth = _indent(body)
        if skip_deeper_than is not None:
            if depth > skip_deeper_than:
                continue
            skip_deeper_than = None
        if depth == 0:
            close()
            entry = None
            match = _TOP.fullmatch(body)
            if match is None:
                errors.append({"line": number, "id": None, "message": "unreadable top-level line"})
                continue
            key, rest = match.group(1), (match.group(2) or "")
            in_services = key == "services"
            if key in ("version", "updated"):
                try:
                    top[key] = _scalar(rest)
                except _YamlError as exc:
                    errors.append({"line": number, "id": None, "message": "%s: %s" % (key, exc)})
            elif not in_services:
                skip_deeper_than = 0  # an unknown top-level section: consumed and ignored
            continue
        if not in_services:
            errors.append({"line": number, "id": None, "message": "content outside services"})
            continue
        start = _ENTRY.fullmatch(body)
        if start is not None:
            close()
            entry = {"line": number, "fields": {}, "errors": []}
            try:
                entry["id"] = _scalar(start.group(1))
            except _YamlError as exc:
                entry["id"] = None
                entry["errors"].append("line %d: id: %s" % (number, exc))
            continue
        if entry is None:
            errors.append({"line": number, "id": None, "message": "content before the first entry"})
            continue
        if depth > 4:
            entry["errors"].append("line %d: unexpected indentation" % number)
            continue
        field = _FIELD.fullmatch(body) if depth == 4 else None
        if field is None:
            entry["errors"].append("line %d: not a `key: value` line at indent 4" % number)
            continue
        key, rest = field.group(1), (field.group(2) or "").strip()
        if key == "id":
            entry["errors"].append("line %d: second id inside an entry" % number)
            continue
        if not rest or rest.startswith("#") or _BLOCK.fullmatch(rest):
            skip_deeper_than = 4  # a nested list or a block scalar: consumed, ignored
            if key in REGISTRY_FIELDS:
                entry["fields"][key] = None
            continue
        if key not in REGISTRY_FIELDS:
            continue
        try:
            entry["fields"][key] = _value(rest)
        except _YamlError as exc:
            entry["errors"].append("line %d: %s: %s" % (number, key, exc))
    close()
    seen = set()
    for service in services:
        for message in service["errors"]:
            errors.append({"line": service["line"], "id": service["id"], "message": message})
        if service["id"] in seen:
            errors.append({"line": service["line"], "id": service["id"], "message": "duplicate id"})
        seen.add(service["id"])
    ids = [s["id"] for s in services if s["id"]]
    prefixes = sorted({s["runtime_prefix"] for s in services if s.get("runtime_prefix")})
    return {"version": top.get("version"), "updated": top.get("updated"), "services": services,
            "ids": ids, "runtime_prefixes": prefixes, "errors": errors}


def _record(entry, errors, number, message):
    if entry is not None:
        entry["errors"].append("line %d: %s" % (number, message))
    else:
        errors.append({"line": number, "id": None, "message": message})


def _finish(entry):
    out = {"id": entry.get("id"), "line": entry["line"], "errors": list(entry["errors"])}
    broken = bool(entry["errors"]) or not entry.get("id")
    for key in REGISTRY_FIELDS[1:]:
        out[key] = None if broken else entry["fields"].get(key)
    if not entry.get("id") and not entry["errors"]:
        out["errors"].append("entry without an id")
    runtime = out.get("runtime")
    out["runtime_prefix"] = runtime.split(":", 1)[0] if isinstance(runtime, str) and runtime else None
    return out


def read_registry(kos_path, home=None):
    """parse_registry over the kingdom-os worktree REGISTRY.yaml, plus a byte comparison with
    pulse's TCC-safe copy (LOCATORS registry_copy)."""
    raw, reason = read_checked(os.path.join(kos_path, "REGISTRY.yaml"), MAX_SOURCE)
    if raw is None:
        return {"status": reason, "sha256": None, "services": [], "ids": [], "runtime_prefixes": [],
                "errors": [{"line": None, "id": None, "message": "REGISTRY.yaml unreadable: %s" % reason}],
                "copy": _registry_copy(None, home)}
    parsed = parse_registry(raw)
    parsed["status"] = "ok" if not parsed["errors"] else "partial"
    parsed["sha256"] = hashlib.sha256(raw).hexdigest()
    parsed["copy"] = _registry_copy(raw, home)
    return parsed


def _registry_copy(raw, home):
    copy, reason = read_checked(safety.expand_locator(safety.LOCATORS["registry_copy"], home), MAX_SOURCE)
    if copy is None:
        return {"status": reason, "equal": None}
    return {"status": "ok", "equal": None if raw is None else copy == raw,
            "sha256": hashlib.sha256(copy).hexdigest()}


# ── dated claims: sites.json, graph.json, CATALOG.md ───────────────────────────────────────

def _mtime(path):
    try:
        info = os.lstat(path)
    except OSError:
        return None
    return safety.iso(dt.datetime.fromtimestamp(info.st_mtime, dt.timezone.utc))


def _head_at(kos_path, git):
    git = git or GitRunner(os.path.realpath(kos_path), role="kingdom")
    if not git.toplevel_ok():
        return None, None
    return _commit(git, "HEAD")


def _json_file(path, limit):
    raw, reason = read_checked(path, limit)
    if raw is None:
        return None, reason, None
    try:
        return json.loads(raw.decode("utf-8")), None, hashlib.sha256(raw).hexdigest()
    except (UnicodeDecodeError, ValueError) as exc:
        return None, "invalid json: %s" % exc.__class__.__name__, hashlib.sha256(raw).hexdigest()


def read_sites(kos_path, git=None):
    """sites.json doors as dated claims: {status, doors[{repo, url, label}], dated{head_commit,
    head_commit_at, mtime}, sha256, errors}."""
    path = os.path.join(kos_path, "sites.json")
    data, reason, digest = _json_file(path, MAX_SOURCE)
    commit, committed_at = _head_at(kos_path, git)
    out = {"status": "ok", "doors": [], "sha256": digest, "errors": [],
           "dated": {"head_commit": commit, "head_commit_at": committed_at, "mtime": _mtime(path)}}
    if data is None:
        out["status"] = reason
        return out
    doors = data.get("doors") if isinstance(data, dict) else None
    if not isinstance(doors, list):
        out["status"] = "unexpected shape"
        return out
    for index, door in enumerate(doors):
        if isinstance(door, dict) and all(isinstance(door.get(k), str) for k in ("repo", "url")):
            out["doors"].append({"repo": door["repo"], "url": door["url"],
                                 "label": door.get("label") if isinstance(door.get("label"), str) else None})
        else:
            out["errors"].append("door %d lacks string repo/url" % index)
    if out["errors"]:
        out["status"] = "partial"
    return out


def read_graph(kos_path, git=None):
    """graph.json and CATALOG.md as dated, derived claims (harvest's last output, never rerun):
    {status, entries[{name, path, kind, layer, domain, state, hasCard}], count, catalog_count,
    dated{head_commit, head_commit_at, graph_mtime, catalog_mtime}, sha256, errors}."""
    graph_path = os.path.join(kos_path, "graph.json")
    catalog_path = os.path.join(kos_path, "CATALOG.md")
    data, reason, digest = _json_file(graph_path, MAX_GRAPH)
    commit, committed_at = _head_at(kos_path, git)
    out = {"status": "ok", "entries": [], "count": None, "catalog_count": None, "sha256": digest,
           "errors": [], "dated": {"head_commit": commit, "head_commit_at": committed_at,
                                   "graph_mtime": _mtime(graph_path), "catalog_mtime": _mtime(catalog_path)}}
    if data is None:
        out["status"] = reason
    elif not isinstance(data, list):
        out["status"] = "unexpected shape"
    else:
        keep = ("name", "path", "kind", "layer", "domain", "state", "hasCard")
        out["entries"] = [{k: e.get(k) for k in keep} for e in data if isinstance(e, dict)]
        out["count"] = len(data)
    catalog, catalog_reason = read_checked(catalog_path, MAX_SOURCE)
    if catalog is None:
        out["errors"].append("CATALOG.md unreadable: %s" % catalog_reason)
    else:
        match = re.search(r"Derived index of (\d+) repos", catalog.decode("utf-8", "replace"))
        out["catalog_count"] = int(match.group(1)) if match else None
    return out


# ── pulse and the global wake ──────────────────────────────────────────────────────────────

_STATUS_STAMP = re.compile(r"^>\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)", re.M)
_STATUS_ROW = re.compile(r"\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|")


def _int_or_none(text):
    text = text.strip()
    return int(text) if re.fullmatch(r"\d+", text) else None


def parse_status(text):
    """pulse's STATUS.md: header timestamp and `| icon | service | expected | observed | code |
    ms | url |` rows."""
    text = _decode(text)
    stamp = _STATUS_STAMP.search(text)
    rows = []
    for line in text.split("\n"):
        match = _STATUS_ROW.fullmatch(line.strip())
        if match is None:
            continue
        cells = [c.strip() for c in match.groups()]
        if cells[1] in ("service", "") or set(cells[1]) <= set("-:"):
            continue
        rows.append({"icon": cells[0], "id": cells[1], "expected": cells[2],
                     "observed": None if cells[3] in ("—", "-", "") else cells[3],
                     "code": _int_or_none(cells[4]), "ms": _int_or_none(cells[5]), "url": cells[6] or None})
    alerts = re.search(r"^## .*Alerts \((\d+)\)", text, re.M)
    return {"generated_at": stamp.group(1) if stamp else None, "rows": rows,
            "alerts": int(alerts.group(1)) if alerts else 0}


def _tail(path, size):
    """(bytes, offset, reason): the last `size` bytes of a regular, non-symlink file."""
    if safety.is_denied(os.path.basename(path)):
        return None, 0, "denied"
    try:
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK | os.O_CLOEXEC)
    except FileNotFoundError:
        return None, 0, "missing"
    except OSError as exc:
        if exc.errno == errno.ELOOP:
            return None, 0, "symlink"
        return None, 0, "error:" + errno.errorcode.get(exc.errno, str(exc.errno))
    try:
        info = os.fstat(fd)
        if not stat.S_ISREG(info.st_mode):
            return None, 0, "not-regular"
        offset = max(0, info.st_size - size)
        os.lseek(fd, offset, os.SEEK_SET)
        chunks, remaining = [], size
        while remaining > 0:
            chunk = os.read(fd, min(remaining, 1 << 16))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        return b"".join(chunks), offset, None
    finally:
        os.close(fd)


def parse_history_tail(data, partial_start):
    """The complete JSON lines in a tail of pulse-history.jsonl: the last snapshot and every
    observed-state transition per probe id inside the window."""
    lines = data.split(b"\n")
    if partial_start and lines:
        lines = lines[1:]  # the first line was cut by the window
    if lines and lines[-1] and not data.endswith(b"\n"):
        lines = lines[:-1]  # a line still being written
    snapshots, bad = [], 0
    for line in lines:
        if not line.strip():
            continue
        try:
            item = json.loads(line.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            bad += 1
            continue
        if isinstance(item, dict) and isinstance(item.get("probes"), list):
            snapshots.append(item)
        else:
            bad += 1
    transitions, last_seen = [], {}
    for snap in snapshots:
        for probe in snap["probes"]:
            if not isinstance(probe, dict) or not isinstance(probe.get("id"), str):
                continue
            state = probe.get("observed")
            before = last_seen.get(probe["id"])
            if probe["id"] in last_seen and before != state:
                transitions.append({"id": probe["id"], "from": before, "to": state, "at": snap.get("t")})
            last_seen[probe["id"]] = state
    last = snapshots[-1] if snapshots else None
    return {"lines": len(snapshots), "unreadable_lines": bad, "transitions": transitions,
            "last": None if last is None else {"t": last.get("t"), "alerts": last.get("alerts"),
                                               "probes": [p for p in last["probes"] if isinstance(p, dict)]}}


def read_pulse(home=None):
    """KINGDOM's eye, read and never re-probed: {status{state, generated_at, rows, alerts, mtime,
    sha256}, history{state, lines, last, transitions, window_bytes, mtime}}."""
    status_path = safety.expand_locator(safety.LOCATORS["pulse_status"], home)
    history_path = safety.expand_locator(safety.LOCATORS["pulse_history"], home)
    raw, reason = read_checked(status_path, MAX_SOURCE)
    if raw is None:
        status = {"state": reason, "generated_at": None, "rows": [], "alerts": None}
    else:
        status = parse_status(raw)
        status["state"] = "ok" if status["generated_at"] else "unreadable header"
        status["sha256"] = hashlib.sha256(raw).hexdigest()
    status["mtime"] = _mtime(status_path)
    data, offset, reason = _tail(history_path, PULSE_TAIL)
    if data is None:
        history = {"state": reason, "lines": 0, "last": None, "transitions": []}
    else:
        history = parse_history_tail(data, offset > 0)
        history["state"] = "ok" if history["last"] else "no complete line"
        history["window_bytes"] = len(data)
    history["mtime"] = _mtime(history_path)
    return {"status": status, "history": history}


def _session_start_configured(data):
    # Mirror of harvest hasConfiguredSessionStartCommand: presence of one non-empty command hook.
    hooks = data.get("hooks") if isinstance(data, dict) else None
    entries = hooks.get("SessionStart") if isinstance(hooks, dict) else None
    if not isinstance(entries, list):
        return False
    for entry in entries:
        inner = entry.get("hooks") if isinstance(entry, dict) else None
        if isinstance(inner, list) and any(
                isinstance(h, dict) and h.get("type") == "command" and isinstance(h.get("command"), str)
                and js_trim(h["command"]) for h in inner):
            return True
    return False


def session_start_presence(path):
    """{present, status}: harvest's SessionStart test on one settings file. present follows
    harvest (False when missing or invalid); status says which. Contents are never kept."""
    raw, reason = read_checked(path, MAX_SOURCE)
    if raw is None:
        return {"present": False, "status": reason}
    try:
        data = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return {"present": False, "status": "invalid json"}
    return {"present": _session_start_configured(data), "status": "ok"}


def global_wake(home=None):
    """GLOBAL_WAKE as harvest computes it, from LOCATORS claude_settings: presence only."""
    return session_start_presence(safety.expand_locator(safety.LOCATORS["claude_settings"], home))


# ── the integrity lock ─────────────────────────────────────────────────────────────────────

LOCK_HEADER = (
    "# KINGDOM integrity lock (estate layer). Hashes and commits of the KINGDOM foundation files\n"
    "# as last accepted; it never holds a vocabulary value, which is read live on every build.\n"
    "# Changed only by `estate accept-vocab --write`. harvest_reviewed_sha256 is the harvest.ts\n"
    "# blob whose read-only verbs (validate, conformance) were reviewed by hand.\n\n"
)


def make_lock(foundation, reviewed_harvest_sha256=None, previous=None):
    """The lock dict for vocab/kingdom.lock.toml: remote id, per-ref commit and the four hashes.
    The reviewed harvest sha is a deliberate act: it comes from the argument, else is carried
    over from the previous lock, else it is absent (and --verify-harvest stays refused)."""
    reviewed = reviewed_harvest_sha256
    if reviewed is None and isinstance(previous, dict):
        reviewed = (previous.get("kingdom_os") or {}).get(REVIEWED_KEY)
    head = {"remote_id": foundation.get("remote_id", KOS_REMOTE_ID)}
    if reviewed:
        safety.require(re.fullmatch(r"[0-9a-f]{64}", reviewed) is not None, "reviewed sha must be a sha256")
        head[REVIEWED_KEY] = reviewed
    refs = {}
    for ref in REFS:
        data = foundation["refs"].get(ref) or {}
        if data.get("status") not in ("ok", "partial"):
            continue
        entry = {}
        if data.get("commit"):
            entry["commit"] = data["commit"]
        for key in LOCK_HASH_KEYS:
            if data.get(key):
                entry[key] = data[key]
        refs[ref] = entry
    return {"kingdom_os": head, "refs": refs}


def lock_text(lock):
    text = LOCK_HEADER + safety.toml_dumps(lock)
    safety.require(tomllib.loads(text) == lock, "lock does not round-trip through tomllib")
    return text


def read_lock(layer_dir=None):
    """(lock dict, None) or (None, reason) for vocab/kingdom.lock.toml."""
    path = os.path.join(os.path.realpath(layer_dir or safety.LAYER_DIR), LOCK_RELPATH)
    raw, reason = read_checked(path, MAX_SOURCE)
    if raw is None:
        return None, reason
    try:
        return tomllib.loads(raw.decode("utf-8")), None
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        return None, "invalid toml: %s" % exc


def compare_lock(foundation, lock):
    """{state: match|mismatch|missing, diffs[{ref, key, lock, live}], commits_moved[]}. Only the
    hashes decide; a ref whose commit moved without touching them is reported, not drift."""
    if not lock:
        return {"state": "missing", "diffs": [], "commits_moved": []}
    diffs, moved = [], []
    if (lock.get("kingdom_os") or {}).get("remote_id") != foundation.get("remote_id"):
        diffs.append({"ref": None, "key": "remote_id", "lock": (lock.get("kingdom_os") or {}).get("remote_id"),
                      "live": foundation.get("remote_id")})
    for ref in REFS:
        live = foundation["refs"].get(ref) or {}
        locked = (lock.get("refs") or {}).get(ref) or {}
        for key in LOCK_HASH_KEYS:
            if live.get(key) != locked.get(key):
                diffs.append({"ref": ref, "key": key, "lock": locked.get(key), "live": live.get(key)})
        if live.get("commit") != locked.get("commit"):
            moved.append({"ref": ref, "lock": locked.get("commit"), "live": live.get("commit")})
    return {"state": "match" if not diffs else "mismatch", "diffs": diffs, "commits_moved": moved}


def verify_harvest_allowed(foundation, lock, ref=WORKTREE):
    """(allowed, reason): `bun harvest.ts validate|conformance` may run only when the harvest.ts of
    ref (the taxonomy authority's ref) is byte-for-byte the reviewed one."""
    reviewed = ((lock or {}).get("kingdom_os") or {}).get(REVIEWED_KEY)
    live = (foundation["refs"].get(ref) or {}).get("harvest_blob_sha256")
    if not reviewed:
        return False, "no reviewed harvest sha in the lock"
    if live != reviewed:
        return False, "%s harvest.ts differs from the reviewed sha" % ref
    return True, "%s harvest.ts matches the reviewed sha" % ref


def read_ref_files(kos_path, ref, rels=(HARVEST, ROSTER)):
    """{relpath: bytes} of kingdom-os files at origin/main, read as blobs (cat-file; nothing is
    fetched, and a promisor clone is refused). Raises FoundationError when one cannot be read."""
    if ref != ORIGIN_MAIN:
        raise FoundationError("only origin/main is read as blobs; the worktree is read on disk")
    git = GitRunner(os.path.realpath(kos_path), role="kingdom")
    flag, reasons = git.promisor_state()
    if flag is not False:
        raise FoundationError("origin/main blobs not read (promisor or unverified config: %s)"
                              % (", ".join(reasons) or "unknown"))
    files = _read_blobs(git, ref)
    out = {}
    for rel in rels:
        raw, status = files.get(rel, (None, "not read"))
        if raw is None:
            raise FoundationError("origin/main:%s unreadable: %s" % (rel, status))
        out[rel] = raw
    return out
