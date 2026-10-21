"""Curated knowledge for the estate layer: scrubber, privacy lint, tag targets and the survey import.

scrub() decides what of a survey text may be committed: risky sentences move whole to private and
paths, IPs, emails and long hex ids become placeholders. lint_committed() is the gate before Yu
commits: every committed file is checked against the same patterns, plus a few structure and
host-state checks. suggest_targets() maps raw survey tags onto the vocabulary of spec section 4.
import_survey() turns the preserved survey copy into the committed curation, the tag map and the
private curation, validating everything before it writes anything.

Strings the lint rejects (home paths, token prefixes, risk-vocabulary words) are spelled in parts
here, so this file passes its own lint. This file holds no private knowledge: the owner's
devices, accounts, caveat checks, location rules, private group paths and locators live only in
the private curation, and a re-import carries them forward from there.
"""
import ast
import datetime as dt
import difflib
import fnmatch
import hashlib
import json
import os
import pwd
import re
import stat
import sys
import tomllib

import safety
from safety import GuardError, require


AS_OF = dt.date(2026, 10, 17)
REVIEW_AFTER = AS_OF + dt.timedelta(days=90)
SOURCE = "survey-2026-10-17"
SURVEY_DIRNAME = "survey-2026-10-17"
HOME_REL = "~" + "/"
LOCAL = "local" + ":"


def _joined(*parts):
    return "-".join(parts)


# ── vocabulary (spec section 4; check --vocab re-checks against vocab/facets.toml and live KINGDOM) ──

FAMILIES = (
    "zerone-core", "zerone-satellites", "agenttool-core", "agenttool-services", "kingdom-core",
    "kingdom-satellites", "soul-core", "soul-satellites", "language-youspeak", "language-protocols",
    "commerce-tcg", "commerce-ventures", "economy-ventures", "business-ecosystem", "agent-runtimes",
    "infra-ops", "fleet-citizens",
)
# Raw-tag spellings of spec rule R2 that hint at a card layer. They are matching patterns, not the
# vocabulary: every card-hint target is checked against the live CARD_ENUMS (import-survey reads
# them from kingdom-os, check --vocab re-checks them), never against a copy.
R2_LAYER_WORDS = ("soul", "runtime", "nervous", "fleet", "economy", "commerce", "os")
KINGDOM_FIELDS = ("layer", "kind", "state")
EXPECT = {
    "liveness": ("active", "dormant", "archived", "gone"),
    "hosting": ("fly", "cf-pages", "cf-worker", "vercel", "shopify", "supabase", "stripe", "codeberg-pages",
                "local-launchd", "local", "cloudflare-email", "external", "x-github-pages", "x-aws", "x-npm",
                "x-pypi", "x-homebrew-tap", "x-vps", "x-gha-schedule", "x-cron", "x-hermes-cron"),
    "stack": ("go", "typescript", "javascript", "python", "rust", "solidity", "shell", "terraform", "liquid",
              "html", "markdown"),
    "exposure": ("public", "private", "local-only"),
    "standing": ("owned", "card-untracked", "card-invalid", "listed", "unlisted", "unknown"),
    "checkout_role": ("canonical", "linked-worktree", "agent-lane", "clone", "mirror", "snapshot", "staging",
                      "submodule", "nested", "fixture", "cache", "vendored", "prunable-registration",
                      "gone-during-run"),
    "provenance": ("authored", "fork", "mirror", "vendored", "generated"),
}
ROLES = ("revenue", "product", "platform", "public-door", "distribution", "agent-runtime", "ops", "research",
         "play", "doctrine", "standard", "methodology", "citizen", "archive", "incidental")
ROLE_STATUS = ("current", "retired", "historic", "unrealised", "claimed")
# The risk vocabulary, spelled in parts: the lint rejects these words in committed files other
# than vocab/facets.toml and vocab/tag-map.tsv, and this file is one of them.
RISKS = {key: _joined(*parts) for key, parts in (
    ("unsaved", ("unsaved", "work")), ("unpushed", ("unpushed", "work")), ("single", ("single", "copy")),
    ("secret-path", ("secret", "bearing", "path")), ("secret-history", ("secret", "in", "history")),
    ("partial", ("partial", "clone")), ("lender", ("alternates", "lender")),
    ("borrower", ("alternates", "borrower")), ("diverge", ("diverg" "ed",)),
    ("stale", ("stale", "checkout")), ("prunable", ("prunable", "worktrees")), ("drift", ("path", "drift")),
    ("hollow", ("hollow", "green")), ("silent", ("silent", "failure")), ("cost", ("cost", "exposure")),
    ("lan", ("lan", "exposed")), ("tcc", ("tcc", "exposed")), ("churn", ("visibility", "churn")),
    ("collision", ("name", "collision")), ("license", ("license", "risk")),
    ("claims", ("claims", "not", "evidence")),
)}
# The risks whose absence is measured too (model risks); a secret-bearing path is known only from
# curation, so it can be confirmed but never refuted.
MEASURED_RISKS = ("unsaved", "unpushed", "single", "partial", "lender", "borrower", "diverge", "stale", "prunable",
                  "tcc", "hollow", "silent")
PURPOSE_GROUPS = ("agent_infrastructure", "business_operations", "commerce_marketplaces",
                  "communication_collaboration", "community_culture", "creative_media", "data_knowledge",
                  "developer_tools", "games_interactive", "infrastructure_security", "payments_finance",
                  "research_learning", "web_portfolio", "unresolved")
FRAMEWORK_DOMAINS = ("entity-governance", "accounting", "banking-treasury", "compliance", "tax", "kyc-identity",
                     "corporate-security", "contracts-legal", "insurance", "intellectual-property",
                     "data-privacy")
ARTIFACT_KINDS = ("state", "evidence", "logs", "data", "keys", "config", "docs", "backup", "report", "mission",
                  "wallet", "cache", "tool-install", "symlink-index", "unknown")
RELATION_VERBS = ("depends_on", "feeds", "part_of", "deployed_by", "mirror_of", "copy_of", "fork_of",
                  "supersedes", "superseded_by", "worktree_of", "borrows_objects_from", "nested_in",
                  "submodule_of", "name_collision", "related_to")
DROP_REASONS = ("echo", "event", "queue", "evidence", "identity", "be-internal", "singleton")
TOPIC_SEEDS = ("agenttool", "youspeak", "zerone", "natural-language-internet", "hermes", "cambridge-tcg",
               "claude-code", "castle", "legible", "openclaw", "continuity", "forged-word", "codex", "gospel",
               "rewardspro", "mcp", "ai-love", "sinovai", "npl", "xenia", "founding-citizen", "treasury",
               "x402", "nats", "commons", "captioneer", "did", "fomo", "rhetoric")
TOPIC_CANDIDATES = ("purpose-prompter", "whitehack", "taxsorted", "cashloom", "karma", "love-unlimited")
TOPICS = TOPIC_SEEDS + TOPIC_CANDIDATES
TOPIC_CAP = 40
TOPICS_PER_RECORD = 3
# The sphere facet's values (owner decision D4, and third-party from dec-2026-10-20-3;
# vocab/facets.toml [facet.sphere] defines them).
SPHERES = ("kingdom-os", "independent", "undecided", "third-party")
# The capability facet's values (decision dec-2026-10-20-1; vocab/facets.toml [facet.capability]
# defines them, with their bands).
CAPABILITIES = ("goods-sales", "marketplace", "stock-sourcing", "catalogue-channels", "market-pricing", "billing",
                "agent-commerce", "marketing-outreach", "customer-messaging", "customer-loyalty",
                "business-analytics", "accounting", "banking-treasury", "tax", "compliance", "entity-governance",
                "kyc-identity", "contracts-legal", "data-privacy", "insurance", "intellectual-property",
                "corporate-security", "own-account-trading")
# Overlay values of the navigation facets; with the live KINGDOM values (nav_values) a topic may
# never equal one of them.
OVERLAY_NAV_VALUES = (EXPECT["standing"] + EXPECT["liveness"] + ("up", "down", "contradicted", "unprobed", "none",
                                                                 "unknown")
                      + EXPECT["hosting"] + EXPECT["stack"] + EXPECT["exposure"] + FAMILIES + ROLES + SPHERES
                      + CAPABILITIES)


def nav_values(card_enums):
    """Every navigation-facet value: the live KINGDOM layer, kind and state values plus the
    overlay's own. Without the live enums the KINGDOM values are unknown, so this refuses."""
    require(isinstance(card_enums, dict) and all(card_enums.get(f) for f in KINGDOM_FIELDS),
            "the live CARD_ENUMS (layer, kind, state) are needed; they are never copied")
    return frozenset(v for f in KINGDOM_FIELDS for v in card_enums[f]) | frozenset(OVERLAY_NAV_VALUES)


def target_values():
    """{target key: allowed values} for every tag-map target form except the card hints, whose
    values come only from the live CARD_ENUMS."""
    values = {"expect:" + facet: allowed for facet, allowed in EXPECT.items()}
    values.update({
        "role": ROLES, "role_status": ROLE_STATUS, "risk": tuple(RISKS.values()),
        "purpose_group": PURPOSE_GROUPS, "be.framework_domain": FRAMEWORK_DOMAINS, "artifact_kind": ARTIFACT_KINDS,
        "topic": TOPICS, "relation": RELATION_VERBS, "drop": DROP_REASONS,
    })
    return values


def target_problems(target, card_enums=None):
    """Why a single tag-map target is invalid ([] when it is fine). card_enums is the live
    CARD_ENUMS dict; without it a card hint cannot be checked here and is left to check --vocab,
    which always has the live values."""
    key, sep, value = target.partition("=")
    if not sep or not value:
        return ["malformed target %r" % target]
    if key in ("card-hint:layer", "card-hint:kind"):
        if card_enums is None:
            return []
        allowed = tuple(card_enums.get(key.split(":", 1)[1], ()))
    else:
        allowed = target_values().get(key)
    if allowed is None:
        return ["unknown target key %r" % key]
    if value not in allowed:
        return ["%s=%s is not in the vocabulary" % (key, value)]
    return []


# ── scrub (spec 9.7) ────────────────────────────────────────────────────────────────────────

# The import rule verbatim: a sentence matching it moves whole to private.
SENTENCE_RISK = re.compile(
    r"(?i)credential|secret|token|password|passphrase|mnemonic|private key|keyring|wallet|seed phrase"
    r"|api[_ -]?key|\.pem|\.key\b|priv_validator|unpushed|local-only (branch|tip)|single[- ]copy|dirty"
    r"|uncommitted|unsaved|0644|0600|chmod|recovery code|tfstate|\.env")

# Unpushed, unsaved and one-copy state phrased without the spec's words ("tips on no remote",
# "2 stashes", "2 ahead", "9 untracked files", "12 commits behind", "exists nowhere else"):
# per-record risk detail (spec 9.7 keeps per-record risks private) that must not reach a
# committed file either.
LOCAL_STATE = re.compile(
    r"(?i)\bno (?:git )?remotes?\b|\bon no remote|\blocal-only\b|\bstash(?:es|ed)?\b"
    r"|\b\d[\d,]*\s+(?:commits?\s+)?(?:ahead|behind)\b|\bbehind (?:trunk|origin|upstream|main|the trunk)\b"
    r"|\bnot pushed\b|\bnever pushed\b|\bonly (?:local )?copy\b|\bone copy\b|\bWIP\b"
    r"|\b\d[\d,]*\s+(?:untracked|modified)\b|\buntracked (?:files?|entries|paths?|count|content)\b"
    r"|\bmodified (?:files?|count|paths?|entries)\b|\bnever (?:been )?committed\b|\bnowhere else\b"
    r"|\blocal branch(?:es)?\b|\bcommits? (?:only )?locally\b|\[gone\]")
# Security posture (PRIV-1): a weakness, an exposure, where unredacted material still lives, or
# the state of a backup. These are per-record risks too, written in words the spec regex misses.
SECURITY = re.compile(
    r"(?i)\bIAM\b|\bMFA\b|\baccess keys?\b|\broot (?:access|account|user|keys?)\b"
    r"|\blong-lived (?:keys?|tokens?|credentials?)\b|\binject(?:ion|ions|ed|able|s)?\b|\byolo\b|\bexploit"
    r"|\bvulnerab|\bCVE-\d|\battack(?:er|ers|s)?\b|\bhijack|\btakeover\b|\bphish|\bprivilege|\bescalat"
    r"|\bdrain(?:s|ed|ing)?\b|\bunauthenticated\b|\bwithout auth|\bno auth\b|\bredact(?:ed|ion|ions)?\b"
    r"|\bunredacted\b|\bliterals?\b|\bno backups?\b|\bnot backed up\b|\bunbacked\b|\bretention\b"
    r"|\bnot[_ ]assessed\b|\bunverified (?:captures?|backups?)\b"
    r"|\b(?:signing|hot|hive|private|enrol(?:l)?ment|validator|deploy|root|master|seed|operator) keys?\b"
    r"|\bloopback\b|\ball interfaces\b|\bexposed (?:on|to) the (?:lan|internet|network)\b|\bopen ports?\b"
    r"|\bholds? \d[\d.,]* (?:ETH|ZRN|USDC|BTC|SOL)\b|\bleak(?:s|ed|ing|age)?\b|\bbypass(?:es|ed|ing)?\b"
    r"|\bTCC\b|\bfails? (?:on )?every\b"
    # What sits idle and whether to tear it down: the vocabulary's cost risk, per record.
    r"|\bidle\b|\btorn down\b|\btear(?:s|ing)? (?:it |them )?down\b|\bresidual (?:stacks?|resources?|infra\w*)\b")
_LOGIN = pwd.getpwuid(os.getuid()).pw_name

# The privacy lint's content rules (spec 9.6, plus the shapes of the accounts this estate holds).
# scrub() uses the same patterns, so scrubbed text always passes the lint.
LINT_RULES = (
    ("path", re.compile("|".join(re.escape(p) for p in (
        HOME_REL, "/" + "Users/", "/" + "private/", "/" + "Volumes/", "/" + "var/folders/", "/" + "tmp/",
        "/" + "opt/", "$" + "HOME/", "$" + "{HOME}/"))),),
    ("ipv4", re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")),
    ("email", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")),
    ("hex", re.compile(r"[0-9a-fA-F]{32,}")),
    ("provider-id", re.compile(r"github:repo:\d+|cloudflare:(?:zone|pages|workers):")),
    ("local-id", re.compile(r"\b" + LOCAL + r"(?=[~\w])")),
    ("token-prefix", re.compile("|".join((
        r"\bgh[pousr]" + "_", "github" + "_pat_", r"\b" + "sk" + "-", r"\b(?:sk|rk|pk)_(?:live|test)" + "_",
        "AK" + "IA", "AS" + "IA[A-Z0-9]{12}", "xox[abprs]" + "-", r"\bnpm" + "_[A-Za-z0-9]{20,}",
        r"\bgl" + "pat-", r"\bey" + r"J[A-Za-z0-9_-]{10,}\.", "-" * 5 + "BEGIN")))),
    ("assignment", re.compile(r"(?i)(?:password|passphrase|mnemonic|secret_key|api_key|token"
                              r"|[a-z0-9_]*(?:secret|private|service_role|access)_?key)\s*[:=]")),
    ("risk-word", re.compile(r"(?i)(?<![\w-])(?:" + "|".join(re.escape(w) for w in RISKS.values())
                             + r")(?![\w-])")),
    # The same risk words written as prose, with spaces ("partial clone"). The underscore form
    # is not prose: name_collision is a relation verb of the vocabulary.
    ("risk-phrase", re.compile(r"(?i)(?<![\w-])(?:" + "|".join(
        re.escape(w).replace(r"\-", r"\s+") for w in RISKS.values() if "-" in w) + r")(?![\w-])")),
    ("login", re.compile(r"(?<![A-Za-z0-9])" + re.escape(_LOGIN) + r"(?![A-Za-z0-9])")
     if len(_LOGIN) >= 4 else re.compile(r"(?!x)x")),
    ("state-detail", LOCAL_STATE),
    ("security", SECURITY),
    # A home locator assembled from parts in tool code (the home prefix joined to a literal path): the way a
    # private path would slip past the path rule. Locators belong in safety.py's allowed block or
    # in private/config.toml; tests may still build planted strings this way (spec 9.6).
    ("locator-parts", re.compile(r"""(?:HOME_REL|HOME_PREFIX)\s*\+\s*["'][^"'\s]|["']~["']\s*\+\s*["']/["']\s*\+""")),
)
_RULE = dict(LINT_RULES)
# Rules for prose only: code names these states and words legitimately, so they apply to the
# curation (curated/**), where survey text lands and owners edit by hand.
CURATED_ONLY_RULES = ("risk-phrase", "state-detail", "security")
# Sentence-level moves beyond the spec regex: a token value, a key assignment, a risk word, the
# login name, local state or security posture in a sentence makes the whole sentence private,
# because the lint would reject it anyway.
_MOVE_RULES = ("token-prefix", "assignment", "risk-word", "risk-phrase", "login", "state-detail", "security")

_ABS_PATH = re.compile(r"(?<![\w.:/~-])/(?:Users|private|Volumes|var|tmp|opt|usr|etc|Library|Applications"
                       r"|System|home|root|bin|sbin|dev|mnt|srv)/[^\s,;)\]'\"`<>]*")
_TILDE_PATH = re.compile(r"~[A-Za-z0-9_.-]*/[^\s,;)\]'\"`<>]*")
_HEX_ID = re.compile(r"(?<![0-9A-Za-z])(?=[0-9a-fA-F]*\d)(?=[0-9a-fA-F]*[a-fA-F])[0-9a-fA-F]{12,}(?![0-9A-Za-z])")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[\"'(\[`/~A-Z0-9⟨])")
_TRIM_LEFT = "([{\"'`"
_TRIM_RIGHT = ")]}\"'`.,;:!?"
PLACEHOLDER = {"path": "⟨local⟩", "ip": "⟨ip⟩", "email": "⟨email⟩", "id": "⟨id⟩"}
HEAVY_RATIO = 0.30


def _token_sub(pattern, placeholder, text, spans):
    """Replace every whitespace-delimited token containing pattern by placeholder, keeping the
    brackets and punctuation around it."""
    def swap(match):
        piece = match.group(0)
        left = len(piece) - len(piece.lstrip(_TRIM_LEFT))
        core = piece[left:]
        right = len(core) - len(core.rstrip(_TRIM_RIGHT))
        core, tail = (core[:-right], core[-right:]) if right else (core, "")
        if not pattern.search(core):
            return piece
        spans.append(core)
        return piece[:left] + placeholder + tail
    return re.sub(r"\S+", swap, text)


def _regex_sub(pattern, placeholder, text, spans):
    def swap(match):
        value = match.group(0).rstrip(".,;:")
        spans.append(value)
        return placeholder + match.group(0)[len(value):]
    return pattern.sub(swap, text)


def _placeholders(sentence):
    """(clean sentence, [replaced original values]) for paths, local and provider ids, emails,
    IPs and hex ids."""
    spans = []
    text = _token_sub(_RULE["local-id"], PLACEHOLDER["path"], sentence, spans)
    text = _token_sub(_RULE["provider-id"], PLACEHOLDER["id"], text, spans)
    text = _regex_sub(_RULE["email"], PLACEHOLDER["email"], text, spans)
    text = _regex_sub(_TILDE_PATH, PLACEHOLDER["path"], text, spans)
    text = _regex_sub(_ABS_PATH, PLACEHOLDER["path"], text, spans)
    text = _token_sub(_RULE["path"], PLACEHOLDER["path"], text, spans)
    text = _regex_sub(_RULE["ipv4"], PLACEHOLDER["ip"], text, spans)
    text = _regex_sub(_RULE["hex"], PLACEHOLDER["id"], text, spans)
    text = _regex_sub(_HEX_ID, PLACEHOLDER["id"], text, spans)
    return text, spans


def _moves_private(sentence):
    return SENTENCE_RISK.search(sentence) is not None or any(_RULE[name].search(sentence) for name in _MOVE_RULES)


def scrub(text):
    """(public, private_spans, heavy) for one survey text (spec 9.7).

    A sentence that matches the risk regex (or would fail the lint: token values, key assignments,
    risk words) moves whole to private; in the rest, paths, IPs, emails and hex ids become
    placeholders. When more than 30% of the text is moved or replaced, only its first clean
    sentence is public and the text is heavy. private_spans lists what was removed or replaced."""
    if not isinstance(text, str) or not text.strip():
        return "", [], False
    private, removed = [], 0
    paragraphs, first_clean = [], None
    for line in text.split("\n"):
        kept = []
        for sentence in _SENTENCE_END.split(line):
            if not sentence.strip():
                continue
            if _moves_private(sentence):
                private.append(sentence)
                removed += len(sentence)
                continue
            clean, spans = _placeholders(sentence)
            private.extend(spans)
            removed += sum(len(s) for s in spans)
            kept.append(clean)
            if first_clean is None and not spans:
                first_clean = clean.strip()
        if kept:
            paragraphs.append(" ".join(kept))
        elif not line.strip() and paragraphs and paragraphs[-1] != "":
            paragraphs.append("")
    while paragraphs and paragraphs[-1] == "":
        paragraphs.pop()
    heavy = removed / max(len(text), 1) > HEAVY_RATIO
    public = (first_clean or "") if heavy else "\n".join(paragraphs).strip()
    if lint_text(public, "curated/scrub", "strict"):
        # Belt and braces: never return public text the lint would reject.
        return "", private + [public], True
    return public, private, heavy


def is_risky(record):
    """True when the JSON form of record matches the import risk regex (corrections move wholesale)."""
    return SENTENCE_RISK.search(json.dumps(record, ensure_ascii=False, sort_keys=True)) is not None


# A correction about a record's risks, liveness evidence or working-tree state is that record's
# risk detail, whatever words it uses: it moves wholesale (spec 9.7: per-record risks are private).
RISK_FIELD = re.compile(r"(?i)risk|liveness|dirty|untracked|unpushed|unsaved|stash|branch|backup|secret|exposure")


# ── privacy lint (spec 9.6) ─────────────────────────────────────────────────────────────────

STRICT_DIRS = ("curated", "vocab")
STRICT_ROOT_FILES = ("README.md", ".gitignore")
CODE_DIRS = ("tool", "tests", "bin")
RISK_WORD_FILES = ("vocab/facets.toml", "vocab/tag-map.tsv")
LOCK_FILE = "vocab/kingdom.lock.toml"
FORBIDDEN_NAMES = ("STATUS.md", "PATH.md", "LIGHT.md", "PROGRESS.md")
PROTECTED_BRANCHES = ("main", "develop")
GUARD_LINE = "/" + "private/"
# Spelled in parts: tool/safety.py must stay the only file that holds the markers themselves.
LOCATOR_BEGIN = "# BEGIN-" + "ALLOWED-LOCATORS"
LOCATOR_END = "# END-" + "ALLOWED-LOCATORS"
_SECRET_SHAPED = ("hex", "token-prefix", "assignment", "login")
# Files the desktop and editors drop beside real files (Finder's .DS_Store, AppleDouble, swap and
# backup files). git ignores them through the host's own rules; the lint lists them as info.
JUNK_NAMES = (".DS_Store", "._*", "*.swp", "*.swo", ".*.swp", "*~", "Icon\r")


def _finding(check, rule, path, line=None, detail="", severity="error"):
    return {"check": check, "rule": rule, "path": path, "line": line, "detail": detail, "severity": severity}


def _excerpt(rule, value):
    # Secret-shaped matches are never echoed in full; the location is enough to find them.
    return value[:6] + "…" if rule in _SECRET_SHAPED else value[:40]


def _exempt(rule, relpath, scope, line, in_locator_block):
    if rule in CURATED_ONLY_RULES and not relpath.startswith("curated/"):
        return True
    if rule == "locator-parts" and not relpath.startswith(("tool/", "bin/")):
        return True
    if rule == "path" and scope == "code" and in_locator_block:
        return True
    if rule == "path" and relpath == ".gitignore" and line.strip() == GUARD_LINE:
        return True
    if rule in ("risk-word", "risk-phrase") and relpath in RISK_WORD_FILES:
        return True
    if rule == "hex" and relpath == LOCK_FILE:
        key = line.split("=", 1)[0].strip().strip('"')
        return "=" in line and (key.endswith("_sha256") or key.endswith("commit"))
    return False


def lint_text(text, relpath, scope):
    """Content findings for one file's text. scope: strict (curated, vocab, README, .gitignore) or
    code (tool, tests, bin); code may name home locators only inside the allowed-locators block of
    tool/safety.py. The prose rules (risk phrases, local state, security posture) apply to
    curated/** only."""
    findings = []
    block = False
    for number, line in enumerate(text.splitlines(), 1):
        if relpath == "tool/safety.py" and line.strip() == LOCATOR_BEGIN:
            block = True
        for rule, pattern in LINT_RULES:
            for match in pattern.finditer(line):
                if not _exempt(rule, relpath, scope, line, block):
                    findings.append(_finding("content", rule, relpath, number, _excerpt(rule, match.group(0))))
        if relpath == "tool/safety.py" and line.strip() == LOCATOR_END:
            block = False
    return findings


# A test vector (a sentence fed to scrub or the lint) is linted like the curation, because a real
# finding pasted into a test would otherwise reach the committed half untouched (CB-1). A vector
# that carries risk or posture words must name a fixture subject, so it reads as synthetic.
TEST_VECTOR_MARK = re.compile(r"(?i)\b(?:fixture|example)")
_SENTENCE_SHAPE = re.compile(r"\S+(?:\s+\S+){4,}?[.!?][\"')\]]*\s*$", re.S)


def _docstrings(tree):
    """ids of the docstring constants of a module, its classes and functions (code prose)."""
    out = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) and node.body:
            first = node.body[0]
            if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
                out.add(id(first.value))
    return out


def lint_test_vectors(text, relpath):
    """Findings for sentence-shaped string literals in tests/*.py that carry the curation's prose
    rules (risk phrases, local state, security posture) without naming a fixture subject."""
    if not (relpath.startswith("tests/") and relpath.endswith(".py")):
        return []
    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        return [_finding("structure", "unparsable", relpath, exc.lineno, "cannot check its test vectors",
                         severity="warning")]
    skip = _docstrings(tree)
    findings = []
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Constant) and isinstance(node.value, str)) or id(node) in skip:
            continue
        value = node.value.strip()
        if not _SENTENCE_SHAPE.fullmatch(value) or TEST_VECTOR_MARK.search(value):
            continue
        rules = sorted({rule for rule in CURATED_ONLY_RULES if _RULE[rule].search(value)})
        if rules:
            findings.append(_finding("content", "test-vector", relpath, node.lineno,
                                     "a sentence with %s words names no fixture subject; make it synthetic "
                                     "(say fixture or example)" % "/".join(rules)))
    return findings


def _ignore_rules(layer):
    """The layer's own .gitignore as (anchored, dir_only, name) triples. Only the simple forms the
    layer uses are understood: "/name", "/name/", "name/" and "name"."""
    raw, reason = safety.read_checked(os.path.join(layer, ".gitignore"), 64 << 10)
    rules = []
    for line in (raw or b"").decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        anchored, dir_only = line.startswith("/"), line.endswith("/")
        rules.append((anchored, dir_only, line.strip("/")))
    return rules


def _ignored(rel, is_dir, rules):
    name = rel.rsplit("/", 1)[-1]
    for anchored, dir_only, pattern in rules:
        if dir_only and not is_dir:
            continue
        if fnmatch.fnmatchcase(rel if anchored else name, pattern):
            return True
    return False


def is_junk(name):
    return any(fnmatch.fnmatchcase(name, pattern) for pattern in JUNK_NAMES)


def committed_files(layer_dir=None, junk=None):
    """(files, symlinks, problems) of the layer's committed half, relative to the layer: every
    path the layer's .gitignore does not exclude. Links are listed, never followed. Desktop and
    editor droppings (JUNK_NAMES) are left out and, when junk is a list, appended to it."""
    layer = os.path.realpath(layer_dir or safety.LAYER_DIR)
    rules = _ignore_rules(layer)
    files, links, problems = [], [], []

    def walk(directory, prefix):
        try:
            with os.scandir(directory) as entries:
                listing = sorted(entries, key=lambda e: e.name)
        except OSError as exc:
            problems.append("%s: unreadable (%s)" % (prefix or ".", exc.strerror))
            return
        for entry in listing:
            rel = prefix + entry.name
            is_dir = entry.is_dir(follow_symlinks=False)
            if _ignored(rel, is_dir, rules):
                continue
            if not is_dir and is_junk(entry.name):
                if junk is not None:
                    junk.append(rel)
                continue
            if entry.is_symlink():
                links.append(rel)
            elif is_dir:
                walk(entry.path, rel + "/")
            elif entry.is_file(follow_symlinks=False):
                files.append(rel)
            else:
                problems.append("%s: not a regular file" % rel)

    walk(layer, "")
    return files, links, problems


def scope_of(relpath):
    top = relpath.split("/", 1)[0]
    if top in CODE_DIRS:
        return "code"
    return "strict"


def listing_id(row):
    """Forge id of one forge-listing row: gh (url or nameWithOwner) and Codeberg (html_url) forms."""
    if not isinstance(row, dict):
        return None
    if isinstance(row.get("nameWithOwner"), str):
        return "github.com/" + row["nameWithOwner"].lower()
    url = row.get("url") or row.get("html_url")
    ident = safety.normalize_remote(url) if isinstance(url, str) else None
    return ident if ident and not ident.startswith("file:") else None


def listing_private(row):
    flag = row.get("isPrivate", row.get("private"))
    return flag if isinstance(flag, bool) else None


def _newest_visibility(listing_paths, ident):
    """(private flag or None, listing path or None, capture time or None): the repo's visibility in
    the newest listing that names it. An entry is a path (its capture time is the file's mtime, the
    copy time for a copied listing) or (path, capture epoch) when the capture time is known, as for
    a build --forge listing. None means unknown, never assumed private."""
    best = (None, None, None)
    for entry in listing_paths:
        path, captured = entry if isinstance(entry, tuple) else (entry, None)
        try:
            info = os.lstat(path)
        except OSError:
            continue
        when = captured if captured is not None else info.st_mtime
        raw, reason = safety.read_checked(path, 64 << 20)
        if raw is None:
            continue
        try:
            rows = json.loads(raw.decode("utf-8"))
        except ValueError:
            continue
        for row in rows if isinstance(rows, list) else []:
            if listing_id(row) == ident and (best[2] is None or when > best[2]):
                best = (listing_private(row), path, when)
    return best


def config_listings(layer):
    """The forge listings named in private/config.toml [forge].listings, expanded."""
    raw, reason = safety.read_checked(os.path.join(layer, "private", "config.toml"), 1 << 20)
    if raw is None:
        return []
    try:
        config = tomllib.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return []
    listings = config.get("forge", {}).get("listings", [])
    out = []
    for item in listings if isinstance(listings, list) else []:
        try:
            out.append(safety.expand_locator(item))
        except GuardError:
            continue
    return out


def lint_committed(layer_dir=None, host=None, listings=None):
    """Findings over every committed file of the layer (spec 9.6). Each finding is a dict with
    check (content | structure | host-state), rule, path, line, detail and severity (error |
    warning). host enables the git checks; without it they are reported as skipped warnings."""
    layer = os.path.realpath(layer_dir or safety.LAYER_DIR)
    junk = []
    files, links, problems = committed_files(layer, junk)
    findings = [_finding("structure", "unreadable", p.split(":", 1)[0], detail=p) for p in problems]
    findings += [_finding("structure", "symlink", rel, detail="committed tree holds a symlink") for rel in links]
    findings += [_finding("structure", "junk-file", rel, severity="info",
                          detail="desktop or editor file, left out of the lint; do not add it")
                 for rel in junk]
    for rel in files:
        name = rel.rsplit("/", 1)[-1]
        if name in FORBIDDEN_NAMES or rel.startswith("progress/") or "/progress/" in rel:
            findings.append(_finding("structure", "progress-path", rel,
                                     detail="name collides with the progress-sync path filters"))
        raw, reason = safety.read_checked(os.path.join(layer, rel), 16 << 20)
        if raw is None:
            findings.append(_finding("structure", "unreadable", rel, detail=reason))
            continue
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            findings.append(_finding("structure", "not-utf8", rel))
            continue
        findings += lint_text(text, rel, scope_of(rel))
        findings += lint_test_vectors(text, rel)
    findings += _host_checks(layer, host, files)
    findings += _publication_guard(layer, listings)
    return findings


def _host_checks(layer, host, files):
    if host is None:
        return [_finding("host-state", "host-skipped", ".", detail="no host repository given", severity="warning")]
    git = safety.GitRunner(os.path.realpath(host), role="host")
    top = git.toplevel_check()
    if not top["ok"]:
        return [_finding("host-state", "host-unreadable", ".", detail=top["reason"])]
    rel = os.path.relpath(layer, git.real)
    require(rel != "." and not rel.startswith(".."), "layer is not inside the host repository")
    findings = []
    for path in files:
        res = git.run("check-ignore", "-q", "--no-index", "--", rel + "/" + path)
        if res.code == 0:
            findings.append(_finding("structure", "hidden-by-gitignore", path, detail="ignored by the host"))
        elif res.code != 1:
            findings.append(_finding("structure", "check-ignore-failed", path, detail="exit %s" % res.code))
    branch = git.run("branch", "--show-current")
    current = branch.out.strip() if branch.ok else None
    if current is None:
        findings.append(_finding("host-state", "branch", ".", detail="branch unknown", severity="warning"))
    elif current in PROTECTED_BRANCHES or not current:
        findings.append(_finding("host-state", "branch", ".",
                                 detail="host is on %r; commit the layer from a branch Yu chooses" % (current or "detached")))
    staged = git.run("diff", "--cached", "--name-only", "-z")
    if not staged.ok:
        findings.append(_finding("host-state", "staged-index", ".", detail="unreadable", severity="warning"))
    else:
        for path in (p for p in staged.out.split("\0") if p):
            inside = path.startswith(rel + "/") and not path.startswith(rel + "/private" + "/")
            if not inside:
                findings.append(_finding("host-state", "staged-index", path,
                                         detail="staged path outside the committed layer"))
    return findings


# The forge source's stale budget (spec 11): an older listing says nothing about visibility now.
LISTING_STALE_S = 30 * 86400


def _publication_guard(layer, listings):
    """The newest listing that names the host must show it private (spec 9.6). Public is an error
    whatever the listing's age; a listing older than the forge stale budget is no evidence of
    privacy now, so that is unknown (a warning), as is no listing at all."""
    paths = list(listings) if listings is not None else config_listings(layer)
    flag, source, mtime = _newest_visibility(paths, BE_REPO)
    if flag is False:
        return [_finding("host-state", "publication", ".", detail="newest listing shows the host repository public")]
    if flag is None:
        return [_finding("host-state", "publication", ".", severity="warning",
                         detail="host repository visibility unknown (no listing names it)")]
    age = safety.utc_now().timestamp() - mtime
    if age > LISTING_STALE_S:
        return [_finding("host-state", "publication", ".", severity="warning",
                         detail="host repository visibility unknown: the newest listing naming it is %d days old "
                                "(stale after 30); run build --forge" % (age // 86400))]
    return []


# ── raw tag -> targets (spec 5) ─────────────────────────────────────────────────────────────

def _t(key, value):
    return "%s=%s" % (key, value)


def _risk(key):
    return _t("risk", RISKS[key])


R0_FOLDS = {
    "fly-io": "fly", "cloudflare-pages": "cf-pages", "cloudflare-worker": "cf-worker",
    "secrets-in-history": RISKS["secret-history"],
    "youspeak-verbs": "youspeak", "youspeak-word": "youspeak", "youspeak-lang": "youspeak",
    "legible-family": "legible", "legible-money": "legible",
    "word-internet": "natural-language-internet", "natural-language-protocol": "natural-language-internet",
    "wake": "continuity", "heartbeat": "continuity", "continuity": "continuity",
    "ai-love-cc": "ai-love", "castle-of-understanding": "castle",
}
# Compounds that name two facets at once (spec 5 R0 plus the review of this survey's tags).
R0_SPLITS = {
    "nextjs-vercel": (_t("expect:stack", "typescript"), _t("expect:hosting", "vercel")),
    "aws-terraform": (_t("expect:hosting", "x-aws"), _t("expect:stack", "terraform")),
    "live-local": (_t("expect:liveness", "active"), _t("expect:hosting", "local")),
    "homebrew-tap": (_t("expect:hosting", "x-homebrew-tap"), _t("role", "distribution")),
    "python-cli": (_t("expect:stack", "python"), _t("role", "distribution")),
    "python-sdk": (_t("expect:stack", "python"), _t("role", "distribution")),
    "node-cli": (_t("expect:stack", "typescript"), _t("role", "distribution")),
    "pnpm-monorepo": (_t("expect:stack", "typescript"), _t("role", "platform")),
    "pnpm-turbo-monorepo": (_t("expect:stack", "typescript"), _t("role", "platform")),
    "claude-code-fork": (_t("topic", "claude-code"), _t("expect:provenance", "fork")),
    "diverg" "ed-fork": (_risk("diverge"), _t("expect:provenance", "fork")),
    "tax-commons": (_t("be.framework_domain", "tax"), _t("topic", "commons")),
    "tax-studies": (_t("be.framework_domain", "tax"), _t("role", "research")),
    "zerone-release-evidence": (_t("topic", "zerone"), _t("artifact_kind", "evidence")),
    "zerone-research": (_t("topic", "zerone"), _t("role", "research")),
    "agenttool-did": (_t("topic", "agenttool"), _t("topic", "did"), _t("be.framework_domain", "kyc-identity")),
    "sinovai-heartbeat": (_t("topic", "sinovai"), _t("topic", "continuity")),
    "stale-snapshot": (_t("expect:checkout_role", "snapshot"), _risk("stale")),
    "launchd-log": (_t("expect:hosting", "local-launchd"), _t("artifact_kind", "logs")),
    "dangling-index": (_t("artifact_kind", "symlink-index"), _risk("drift")),
}
R0_EVENT = re.compile(r"\d{4}-\d{2}|^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*-\d{4}$")
R0_EVIDENCE = re.compile(r"^pr-\d+$|^(?:prior-art|prior-organisation|cleanup-record|engineering-record"
                         r"|provenance|names-only)$")
R1_ECHO = frozenset(FAMILIES) | {"satellite"}
R1_IDENTITY = frozenset({"github", "codeberg", "codeberg-canonical", "desktop", "gamma", "alpha-wing",
                         "home-dir", "other-device"})
R2_BE_INTERNAL = frozenset({"foundational-layer", "operational-layer"})
R2_LAYER = (
    ("soul", "soul"), ("soul-canon", "soul"), ("runtime", "runtime"), ("nervous", "nervous"),
    ("fleet", "fleet"), ("fleet-citizen", "fleet"), ("commerce", "commerce"), ("kingdom-foundation", "os"),
    ("os-kernel", "os"), ("os", "os"),
) + tuple((layer + "-layer", layer) for layer in R2_LAYER_WORDS)
R2_KIND = tuple((kind, kind) for kind in ("doctrine", "firmware", "lineage", "methodology", "infra", "ops",
                                          "reference", "venture"))
# R3: measured expectations. Patterns are fnmatch; "?" stands in for a hyphen where the raw tag
# would otherwise spell a risk word in this file.
R3 = {
    "expect:liveness": (
        ("dormant", "dormant"), ("at-rest", "dormant"), ("halted", "dormant"), ("inert", "dormant"),
        ("unused", "dormant"), ("abandoned", "dormant"), ("rest", "dormant"),
        ("archived", "archived"), ("archived-on-github", "archived"), ("frozen", "archived"),
        ("deleted", "archived"), ("live", "active"), ("live-*", "active"),
    ),
    "risk": (
        ("unsaved*", RISKS["unsaved"]), ("uncommitted*", RISKS["unsaved"]), ("dirty", RISKS["unsaved"]),
        ("unpushed*", RISKS["unpushed"]), ("unported-fixes", RISKS["diverge"]),
        ("secret*history", RISKS["secret-history"]), ("tracked?secret", RISKS["secret-history"]),
        ("secret*", RISKS["secret-path"]), ("plaintext-key", RISKS["secret-path"]),
        ("mnemonics", RISKS["secret-path"]), ("keyring*", RISKS["secret-path"]),
        ("keychain", RISKS["secret-path"]), ("0644-perms", RISKS["secret-path"]),
        ("passphrase", RISKS["secret-path"]), ("keys", RISKS["secret-path"]),
        ("signing-keys", RISKS["secret-path"]), ("validator-keys", RISKS["secret-path"]),
        ("recovery-codes", RISKS["secret-path"]), ("operator-creds", RISKS["secret-path"]),
        ("credentials-cache", RISKS["secret-path"]), ("test-keyrings", RISKS["secret-path"]),
        ("partial?clone", RISKS["partial"]), ("alternates", RISKS["borrower"]),
        ("diverg*", RISKS["diverge"]), ("codeberg-divergence", RISKS["diverge"]),
        ("release-branch-drift", RISKS["diverge"]), ("unrelated-history", RISKS["diverge"]),
        ("lan?exposed", RISKS["lan"]), ("tcc", RISKS["tcc"]), ("desktop-tcc", RISKS["tcc"]),
        ("cost*", RISKS["cost"]), ("residual-infra", RISKS["cost"]),
        ("licen*risk", RISKS["license"]),
        ("name?collision", RISKS["collision"]), ("naming?collision", RISKS["collision"]),
        ("misfiled", RISKS["collision"]), ("brand-reused", RISKS["collision"]),
        ("claims?not?evidence", RISKS["claims"]), ("self-reported-progress", RISKS["claims"]),
        ("stale", RISKS["stale"]), ("stale?checkout", RISKS["stale"]), ("stale-lineage", RISKS["stale"]),
        ("stale-workspace", RISKS["stale"]), ("stale-output", RISKS["stale"]),
        ("fake-health-check", RISKS["hollow"]),
        ("silent?*", RISKS["silent"]), ("failing-daemon", RISKS["silent"]), ("failing-job", RISKS["silent"]),
        ("prunable", RISKS["prunable"]), ("worktree-sprawl", RISKS["prunable"]),
        ("roster-drift", RISKS["drift"]), ("missing-path", RISKS["drift"]),
        ("single?copy", RISKS["single"]), ("unbacked", RISKS["single"]), ("unversioned*", RISKS["single"]),
    ),
    "expect:standing": (
        ("forge-only", "unknown"), ("card-untracked", "card-untracked"), ("uncarded", "unlisted"),
        ("off-roster", "unlisted"), ("unregistered", "unlisted"), ("uncatalogued", "unlisted"),
        ("uncataloged", "unlisted"), ("registry-drift", "listed"),
    ),
    "expect:checkout_role": (
        ("duplicate", "clone"), ("duplicate-checkout", "clone"), ("shallow-clone", "clone"),
        ("standalone-clone", "clone"), ("shallow-mirror", "mirror"), ("mirror*", "mirror"),
        ("forge-mirror", "mirror"), ("github-mirror", "mirror"), ("release-mirror", "mirror"),
        ("forge-twin", "mirror"), ("secondary-forge", "mirror"), ("forge-layout", "mirror"),
        ("worktree*", "linked-worktree"), ("claude-worktree", "linked-worktree"),
        ("feature-lanes", "linked-worktree"), ("agent-lane", "agent-lane"),
        ("snapshot", "snapshot"), ("release-snapshot", "snapshot"), ("kingdom-index", "snapshot"),
        ("prunable", "prunable-registration"), ("git-metadata", "prunable-registration"),
        ("stub", "staging"), ("forge-stub", "staging"), ("forge-staging", "staging"),
        ("fixture*", "fixture"), ("test-fixture", "fixture"), ("synthetic", "fixture"),
        ("cache", "cache"), ("census-noise", "cache"), ("census-false-positive", "cache"),
        ("plugin-catalog", "cache"), ("nested-repos", "nested"), ("hub-repo", "canonical"),
    ),
    "expect:hosting": (
        ("vercel", "vercel"), ("github-pages", "x-github-pages"), ("codeberg-pages", "codeberg-pages"),
        ("launchd*", "local-launchd"), ("cron*", "x-cron"), ("github-actions", "x-gha-schedule"),
        ("scheduled-ci", "x-gha-schedule"), ("aws*", "x-aws"), ("npm", "x-npm"), ("npm-library", "x-npm"),
        ("pypi", "x-pypi"), ("vps", "x-vps"), ("hetzner-forge", "x-vps"), ("shopify-*", "shopify"),
        ("supabase", "supabase"), ("stripe", "stripe"), ("fly", "fly"), ("fly-migration", "fly"),
        ("cf-pages", "cf-pages"), ("cf-worker", "cf-worker"),
    ),
    "expect:stack": (
        ("go", "go"), ("cosmos-sdk", "go"), ("typescript", "typescript"), ("bun", "typescript"),
        ("bun-*", "typescript"), ("node", "typescript"), ("nextjs*", "typescript"), ("react*", "typescript"),
        ("vite", "typescript"), ("fastify", "typescript"), ("hono", "typescript"),
        ("javascript", "javascript"), ("python*", "python"), ("fastapi", "python"), ("uv", "python"),
        ("rust", "rust"), ("solidity", "solidity"), ("foundry", "solidity"), ("bash", "shell"),
        ("shell", "shell"), ("terraform", "terraform"), ("iac", "terraform"), ("liquid", "liquid"),
        ("html", "html"), ("docs", "markdown"), ("docs-only", "markdown"), ("state-md", "markdown"),
        ("markdown", "markdown"), ("gitbook", "markdown"),
    ),
    "expect:exposure": (
        ("public", "public"), ("public-on-github", "public"), ("private*", "private"),
        ("local-only", "local-only"),
    ),
    "expect:provenance": (
        ("vendored*", "vendored"), ("third-party", "vendored"), ("study-source", "vendored"),
        ("fork", "fork"), ("codeberg-fork", "fork"), ("generated", "generated"),
        ("ai-generated-scaffold", "generated"), ("template", "generated"), ("openclaw-template", "generated"),
        ("derived", "generated"), ("unfilled", "generated"),
    ),
}
R4 = (
    ("superseded*", (_t("relation", "superseded_by"), _t("role_status", "retired"))),
    ("legacy*", (_t("role_status", "historic"),)),
    ("retired*", (_t("role_status", "retired"),)), ("retail-retired", (_t("role_status", "retired"),)),
    ("spin-off", (_t("role_status", "historic"),)), ("historical", (_t("role_status", "historic"),)),
    ("hive-era", (_t("role_status", "historic"),)),
    # An open owner decision, not a status (review of this survey's tags).
    ("possibly-retirable", (_t("drop", "queue"),)),
    ("design-stub", (_t("role_status", "unrealised"),)), ("placeholder", (_t("role_status", "unrealised"),)),
    ("forge-placeholder", (_t("role_status", "unrealised"),)), ("unbuilt", (_t("role_status", "unrealised"),)),
    ("unborn-repo", (_t("role_status", "unrealised"),)), ("scaffold", (_t("role_status", "unrealised"),)),
    ("empty-repo", (_t("role_status", "unrealised"),)), ("draft", (_t("role_status", "unrealised"),)),
    ("near-duplicate", (_t("relation", "copy_of"),)), ("duplicate-content", (_t("relation", "copy_of"),)),
)
# Residual markers of an open owner question wait in QUEUE however often they are used.
R9_QUEUE = ("needs-*", "unknown*")
# Checkout-role words that look like subject words; they get no role and no purpose group.
R5_NONE = frozenset({"agent-lane", "plugin-catalog"})
R5 = (
    ("revenue", ("storefront", "wholesale", "trade-in", "loyalty", "marketing*", "go-to-market",
                 "content-generator", "revenue")),
    ("platform", ("hosted-api", "agent-platform", "monorepo", "api-gateway", "gateway", "deploy-platform",
                  "agent-api", "agent-first-api", "self-hosted-paas", "tool-api")),
    ("public-door", ("public-door", "landing*", "static-site", "front-gate", "front-door", "docs-site",
                     "reading-room", "agent-front-door", "personal-site", "github-profile", "org-face",
                     "public-projection", "llms-txt")),
    ("doctrine", ("manifesto", "gospel-text", "constitution", "testament", "doctrine")),
    ("research", ("research*", "lab", "phase0-lab", "studies", "education", "mathematics", "chemistry",
                  "papers", "evaluation", "teaching", "exchange-research", "llm-research", "ml-research",
                  "identity-research")),
    ("standard", ("spec", "spec-first", "rfc", "protocol*", "standard*", "candidate-standard",
                  "language-spec", "w3c", "event-schemas", "conformance")),
    ("ops", ("census", "inventory", "atlas", "pulse", "deploy-guard", "deploy-fence", "backups", "estate*",
             "ecosystem-map", "diagnostics", "ops*", "provisioning", "repo-health", "status-dashboard",
             "portfolio-cli")),
    ("distribution", ("distribution", "sdk*", "npm-library", "plugin*", "cli", "library", "shared-libs",
                      "profile-distribution", "kingdom-cli", "claude-plugin", "hermes-plugin")),
    ("agent-runtime", ("harness", "hive*", "agent-*", "autonomous-*", "fleet-runtime", "orchestrator")),
    ("play", ("game", "arcade", "art", "newspaper")),
    ("methodology", ("methodology",)),
    ("archive", ("archive", "lineage")),
    ("citizen", ("fleet-citizen", "kingdom-citizens")),
    ("product", ("prototype",)),
)
R6_FRAMEWORK = (
    ("uk-tax*", "tax"), ("hmrc-mtd", "tax"), ("tax-*", "tax"), ("ledger", "accounting"),
    ("accounting", "accounting"), ("treasury", "banking-treasury"), ("wallet*", "banking-treasury"),
    ("custody", "banking-treasury"), ("custodial-*", "banking-treasury"), ("non-custodial", "banking-treasury"),
    ("soc2", "compliance"), ("compliance*", "compliance"), ("gdpr-privacy", "data-privacy"),
    ("consent", "data-privacy"), ("personal-data", "data-privacy"), ("possibly-personal-data", "data-privacy"),
    ("ip-portfolio", "intellectual-property"), ("iam", "corporate-security"),
    ("key-custody", "corporate-security"), ("release-signing", "corporate-security"),
    ("signing*", "corporate-security"), ("security*", "corporate-security"), ("opsec", "corporate-security"),
    ("threat-modeling", "corporate-security"), ("did*", "kyc-identity"), ("identity", "kyc-identity"),
    ("identity-*", "kyc-identity"), ("passwordless-auth", "kyc-identity"), ("auth-bridge", "kyc-identity"),
    ("entity-governance", "entity-governance"),
)
R6_PURPOSE = (
    ("agent*", "agent_infrastructure"), ("x402*", "payments_finance"), ("usdc", "payments_finance"),
    ("solana-usdc", "payments_finance"), ("polymarket", "payments_finance"), ("betfair", "payments_finance"),
    ("trading", "payments_finance"), ("finance", "payments_finance"), ("money", "payments_finance"),
    ("prediction-markets", "payments_finance"),
    ("tcg", "commerce_marketplaces"), ("cardrush", "commerce_marketplaces"),
    ("cardmarket", "commerce_marketplaces"), ("marketplace", "commerce_marketplaces"),
    ("p2p-*", "commerce_marketplaces"), ("price-*", "commerce_marketplaces"),
    ("pricing-*", "commerce_marketplaces"), ("forged-word", "community_culture"),
    ("citizens", "community_culture"), ("dictionary", "data_knowledge"), ("fact-verification", "data_knowledge"),
    ("knowledge-*", "data_knowledge"), ("semantic-data", "data_knowledge"), ("analytics", "data_knowledge"),
    ("npl-*", "developer_tools"), ("llm-compiler", "developer_tools"), ("dev-tooling", "developer_tools"),
    ("linter", "developer_tools"), ("dubbing", "creative_media"), ("sound", "creative_media"),
    ("asr-translation-tts", "creative_media"), ("cosyvoice", "creative_media"),
    ("voice-companion", "creative_media"), ("game", "games_interactive"), ("gamification", "games_interactive"),
    ("simulation", "games_interactive"), ("card-game", "games_interactive"),
    ("peer-review", "research_learning"), ("uk-government", "research_learning"),
    ("learning-guide", "research_learning"), ("enterprise-backoffice", "business_operations"),
    ("legal-finance-compliance", "business_operations"), ("collaboration", "communication_collaboration"),
    ("coordination", "communication_collaboration"),
)
# R7: every matching entry contributes (a compound may name two programmes).
R7 = (
    ("agenttool*", "agenttool"), ("collab", "agenttool"), ("seller-loop", "agenttool"),
    ("youspeak*", "youspeak"), ("constructed-language", "youspeak"), ("word-hosting", "youspeak"),
    ("zerone*", "zerone"), ("proof-of-truth", "zerone"),
    ("natural-language-internet", "natural-language-internet"), ("hermes*", "hermes"),
    ("cambridge-tcg", "cambridge-tcg"), ("claude-code", "claude-code"), ("claude-agent-sdk", "claude-code"),
    ("claude-oauth", "claude-code"), ("claude-plugin", "claude-code"), ("anthropic", "claude-code"),
    ("castle*", "castle"), ("legible", "legible"), ("openclaw*", "openclaw"),
    ("continuity", "continuity"), ("presence-heartbeat", "continuity"), ("wake-loader", "continuity"),
    ("identity-continuity", "continuity"), ("forged-word", "forged-word"), ("codex", "codex"),
    ("gospel", "gospel"), ("rewardspro*", "rewardspro"), ("mcp", "mcp"), ("kingdom-mcp", "mcp"),
    ("ai-love", "ai-love"), ("sinovai*", "sinovai"), ("npl", "npl"), ("npl-*", "npl"), ("natscript", "npl"),
    ("natural-language-programming", "npl"), ("xenia-*", "xenia"), ("rights", "xenia"),
    ("hospitality", "xenia"), ("founding-citizen", "founding-citizen"), ("treasury", "treasury"),
    ("x402*", "x402"), ("nats", "nats"), ("commons", "commons"), ("open-data-commons", "commons"),
    ("captioneer", "captioneer"), ("did", "did"), ("did-key", "did"), ("identity-did", "did"),
    ("fomo*", "fomo"), ("manipulation-detector", "fomo"), ("rhetoric*", "rhetoric"),
    ("purpose-prompter", "purpose-prompter"), ("gua", "purpose-prompter"), ("whitehack*", "whitehack"),
    ("taxsorted", "taxsorted"), ("cashloom", "cashloom"), ("moneyworld", "cashloom"), ("karma", "karma"),
    ("love-unlimited", "love-unlimited"),
)
R8 = (
    ("state", "state"), ("state-file", "state"), ("runtime-state", "state"), ("operator-home", "state"),
    ("operator-state", "state"), ("ops-state", "state"), ("node-home", "state"), ("cli-state", "state"),
    ("agent-state", "state"), ("agent-memory", "state"),
    ("config", "config"), ("control-file", "config"), ("hooks", "config"), ("cli-config", "config"),
    ("shell-profile", "config"), ("scheduler", "config"), ("credentials-loader", "config"),
    ("runtime-wiring", "config"),
    ("logs", "logs"), ("telemetry", "logs"), ("unbounded-log", "logs"),
    ("receipts", "evidence"), ("pr-evidence", "evidence"), ("evidence-store", "evidence"),
    ("release-evidence", "evidence"), ("ui-evidence", "evidence"), ("patch", "evidence"),
    ("model-checkpoints", "data"), ("checkpoints", "data"), ("research-data", "data"), ("sqlite", "data"),
    ("keyring*", "keys"), ("keys", "keys"), ("signing-keys", "keys"), ("validator-keys", "keys"),
    ("plaintext-key", "keys"), ("mnemonics", "keys"), ("passphrase", "keys"), ("recovery-codes", "keys"),
    ("operator-creds", "keys"), ("credentials-cache", "keys"), ("cli-auth", "keys"), ("local-vault", "keys"),
    ("secrets-vault", "keys"), ("keychain", "keys"),
    ("wallet*", "wallet"), ("monero", "wallet"), ("backups", "backup"), ("branch-bundle", "backup"),
    ("reports", "report"), ("estate-map", "report"), ("portfolio-map-v1", "report"),
    ("private-inventory", "report"), ("mission-packet", "mission"),
    ("instructions", "docs"), ("documents", "docs"), ("design-record", "docs"), ("product-spec", "docs"),
    ("daemon-install", "tool-install"), ("toolchain", "tool-install"), ("kingdom-daemons", "tool-install"),
    ("symlink*", "symlink-index"), ("index", "symlink-index"), ("kingdom-index", "symlink-index"),
    ("navigation-hub", "symlink-index"), ("cli-cache", "cache"),
)


def _first(pairs, tag):
    for pattern, value in pairs:
        if fnmatch.fnmatchcase(tag, pattern):
            return value
    return None


def normalize_tag(raw, known=()):
    """R0: lowercase kebab-case, synonym folds, and plural folds onto a known singular."""
    tag = re.sub(r"[\s_]+", "-", raw.strip().lower())
    tag = R0_FOLDS.get(tag, tag)
    if tag.endswith("s") and not tag.endswith("ss") and tag[:-1] in known:
        tag = R0_FOLDS.get(tag[:-1], tag[:-1])
    return tag


def suggest_targets(raw, uses=1, known=()):
    """(targets, rules) for one raw tag by rules R0-R9 of spec 5, applied in order.

    known is the set of normalized raw tags in the survey (it lets plurals fold); uses decides
    the residual: a string used once is a singleton, a string used more often waits in QUEUE."""
    tag = normalize_tag(raw, known)
    targets, rules = [], []

    def hit(rule, items):
        for item in items:
            if item not in targets:
                targets.append(item)
        if items and rule not in rules:
            rules.append(rule)

    if tag != raw:
        rules.append("R0")
    if R0_EVENT.search(tag):
        return [_t("drop", "event")], _rules_with(rules, "R0")
    if R0_EVIDENCE.search(tag):
        return [_t("drop", "evidence")], _rules_with(rules, "R0")
    hit("R0", R0_SPLITS.get(tag, ()))
    if raw in R1_ECHO or tag in R1_ECHO:
        return [_t("drop", "echo")], _rules_with(rules, "R1")
    if tag in R1_IDENTITY:
        return [_t("drop", "identity")], _rules_with(rules, "R1")
    if tag in R2_BE_INTERNAL:
        return [_t("drop", "be-internal")], _rules_with(rules, "R2")
    layer, kind = _first(R2_LAYER, tag), _first(R2_KIND, tag)
    hit("R2", ([_t("card-hint:layer", layer)] if layer else []) + ([_t("card-hint:kind", kind)] if kind else []))
    for key, pairs in R3.items():
        value = _first(pairs, tag)
        hit("R3", [_t(key, value)] if value else [])
    hit("R4", _first(R4, tag) or ())
    if tag not in R5_NONE:
        role = next((role for role, patterns in R5 if any(fnmatch.fnmatchcase(tag, p) for p in patterns)), None)
        hit("R5", [_t("role", role)] if role else [])
    if tag not in R5_NONE:
        domain, group = _first(R6_FRAMEWORK, tag), _first(R6_PURPOSE, tag)
        hit("R6", ([_t("be.framework_domain", domain)] if domain else [])
            + ([_t("purpose_group", group)] if group else []))
    hit("R7", [_t("topic", topic) for pattern, topic in R7 if fnmatch.fnmatchcase(tag, pattern)])
    kind_of_artifact = _first(R8, tag)
    hit("R8", [_t("artifact_kind", kind_of_artifact)] if kind_of_artifact else [])
    if not targets:
        waits = uses > 1 or any(fnmatch.fnmatchcase(tag, p) for p in R9_QUEUE)
        hit("R9", [_t("drop", "queue" if waits else "singleton")])
    return targets, rules


def _rules_with(rules, rule):
    return rules + [rule] if rule not in rules else rules


TAG_MAP_HEADER = ("raw", "targets", "rule", "uses")


def build_tag_map(tag_uses):
    """Rows (raw, [targets], [rules], uses) for every raw tag, sorted by raw string."""
    known = {re.sub(r"[\s_]+", "-", t.strip().lower()) for t in tag_uses}
    rows = []
    for raw in sorted(tag_uses):
        targets, rules = suggest_targets(raw, tag_uses[raw], known)
        rows.append((raw, targets, rules, tag_uses[raw]))
    return rows


def tag_map_text(rows):
    lines = ["\t".join(TAG_MAP_HEADER)]
    for raw, targets, rules, uses in rows:
        require("\t" not in raw and "\n" not in raw, "raw tag holds a tab or newline: %r" % raw)
        lines.append("\t".join((raw, " ".join(targets), "+".join(rules), str(uses))))
    return "\n".join(lines) + "\n"


def parse_tag_map(text):
    """Rows (raw, [targets], [rules], uses) of a tag-map.tsv text; raises GuardError on bad shape."""
    lines = text.splitlines()
    require(lines and tuple(lines[0].split("\t")) == TAG_MAP_HEADER, "tag map header must be raw/targets/rule/uses")
    rows = []
    for number, line in enumerate(lines[1:], 2):
        cells = line.split("\t")
        require(len(cells) == 4, "tag map line %d: expected 4 columns" % number)
        raw, targets, rules, uses = cells
        require(raw and uses.isdigit(), "tag map line %d: raw tag and integer uses required" % number)
        rows.append((raw, targets.split(), [r for r in rules.split("+") if r], int(uses)))
    return rows


def tag_map_problems(rows, card_enums=None):
    """Closure problems (spec 5): rows without a target, invalid targets, duplicate raw strings."""
    problems, seen = [], set()
    for raw, targets, rules, uses in rows:
        if raw in seen:
            problems.append("%s: duplicate row" % raw)
        seen.add(raw)
        if not targets:
            problems.append("%s: no target" % raw)
        for target in targets:
            problems += ["%s: %s" % (raw, p) for p in target_problems(target, card_enums)]
    return problems


def tag_index(rows):
    """{raw: [targets]} for applying the reviewed map to records."""
    return {raw: list(targets) for raw, targets, rules, uses in rows}


# ── business_function -> role (spec 5) ──────────────────────────────────────────────────────

# Whole-phrase matches checked before a business_function is split on "/" or "+".
_ROLE_WHOLE = (
    ("persona/product experiment", ("research",)),
    ("backup/mirror", ("incidental",)),
)
_ROLE_WORDS = (
    ("agent development lane", ("agent-runtime",)), ("unsaved development work", ("incidental",)),
    ("git metadata residue", ("incidental",)), ("vendored dependency", ("incidental",)),
    ("public communication", ("public-door",)), ("prototype venture", ("product",)),
    ("product prototype", ("product",)), ("dev scaffolding", ("incidental",)),
    ("forge placeholder", ("incidental",)), ("retired mirror", ("incidental",)),
    ("economy bridge", ("platform",)), ("agent runtime", ("agent-runtime",)),
    ("content engine", ("revenue",)), ("tooling mirror", ("incidental",)), ("forge mirror", ("incidental",)),
    ("go-to-market", ("revenue",)), ("public door", ("public-door",)), ("ops tooling", ("ops",)),
    ("starter kit", ("distribution",)), ("forge copy", ("incidental",)), ("distribution", ("distribution",)),
    ("methodology", ("methodology",)), ("education", ("research",)), ("marketing", ("revenue",)),
    ("platform", ("platform",)), ("research", ("research",)), ("doctrine", ("doctrine",)),
    ("standard", ("standard",)), ("revenue", ("revenue",)), ("product", ("product",)),
    ("venture", ("product",)), ("economy", ("platform",)), ("archive", ("archive",)),
    ("lineage", ("archive",)), ("library", ("distribution",)), ("runtime", ("agent-runtime",)),
    ("content", ("revenue",)), ("mirror", ("incidental",)), ("cache", ("incidental",)),
    ("fleet", ("citizen",)), ("infra", ("ops",)), ("play", ("play",)), ("r&d", ("research",)),
    ("ops", ("ops",)),
)
_STATUS_WORDS = (
    (re.compile(r"\bretired\b|\barchived\b"), "retired"),
    (re.compile(r"\bhistoric(?:al)?\b|\blegacy\b"), "historic"),
    (re.compile(r"\bunrealised\b|\bintended\b|\bin development\b|\bunbuilt\b"), "unrealised"),
    (re.compile(r"\bclaimed\b|\bunconfirmed\b|\bunverified\b"), "claimed"),
)


def _starts(part, phrase):
    return re.match(re.escape(phrase) + r"(?![\w-])", part) is not None


def roles_from_function(text):
    """(roles <= 2, role_status or None) from a survey business_function (spec 5 import table).
    An empty role list means the record goes to QUEUE as role unknown."""
    if not isinstance(text, str):
        return [], None
    head = re.split(r"[:;]", text, maxsplit=1)[0].strip().lower()
    qualifiers = re.findall(r"\(([^)]*)\)", head)
    core = " ".join(re.sub(r"\([^)]*\)", " ", head).split())
    roles = []
    whole = next((mapped for phrase, mapped in _ROLE_WHOLE if _starts(core, phrase)), None)
    parts = [core] if whole else [p for p in re.split(r"\s*[/+]\s*", core) if p]
    for part in parts:
        mapped = whole or next((m for phrase, m in _ROLE_WORDS if _starts(part, phrase)), ())
        roles += [r for r in mapped if r not in roles]
    roles = roles[:2]
    if not roles:
        return [], None
    for words in (qualifiers, [core]):
        for pattern, status in _STATUS_WORDS:
            if any(pattern.search(w) for w in words):
                return roles, status
    return roles, "current"


# ── survey loading ──────────────────────────────────────────────────────────────────────────

SURVEY_FILES = ("design/projects-digest.jsonl", "design/family-summaries.json", "design/critic.json",
                "design/x-surfaces.json", "gh-cambridgetcg.json", "codeberg-zerone-dev.json")


def _json_object(pairs):
    out = {}
    for key, value in pairs:
        require(key not in out, "duplicate JSON key %r" % key)
        out[key] = value
    return out


def _read_json(survey, rel, lines=False):
    raw, reason = safety.read_checked(os.path.join(survey, rel), 64 << 20)
    require(raw is not None, "survey file %s unreadable (%s)" % (rel, reason))
    try:
        text = raw.decode("utf-8")
        if lines:
            return [json.loads(line, object_pairs_hook=_json_object) for line in text.splitlines() if line.strip()]
        return json.loads(text, object_pairs_hook=_json_object)
    except ValueError as exc:
        raise GuardError("survey file %s is not valid JSON: %s" % (rel, exc)) from exc


def load_survey(survey_dir):
    """The survey inputs, verified against the copy's SHA256SUMS and validated before use."""
    survey = os.path.realpath(survey_dir)
    sums = safety.verify_sums(survey)
    require(sums["ok"], "survey copy fails its SHA256SUMS: %s" % json.dumps(
        {k: sums[k] for k in ("modified", "missing", "unexpected", "errors") if sums[k]}))
    rows = _read_json(survey, "design/projects-digest.jsonl", lines=True)
    data = {
        "projects": [r for r in rows if "id" in r],
        "groups": [r for r in rows if r.get("bulk")],
        "summaries": _read_json(survey, "design/family-summaries.json"),
        "critic": _read_json(survey, "design/critic.json"),
        "surfaces": _read_json(survey, "design/x-surfaces.json")["out"],
        "listing_gh": _read_json(survey, "gh-cambridgetcg.json"),
        "listing_codeberg": _read_json(survey, "codeberg-zerone-dev.json"),
        "titles": {},
        "dir": survey,
    }
    require(len(data["projects"]) + len(data["groups"]) == len(rows), "digest rows must be projects or bulk groups")
    for row in data["projects"]:
        for key in ("family", "id", "name", "what", "business_function", "tags", "rels", "risks", "corrections",
                    "surfaces", "confidence"):
            require(key in row, "digest project %s lacks %s" % (row.get("id"), key))
        require(row["family"] in FAMILIES, "unknown family %r" % row["family"])
    ids = [r["id"] for r in data["projects"]]
    require(len(set(ids)) == len(ids), "duplicate project ids in the digest")
    require(set(data["summaries"]) == set(FAMILIES), "family-summaries must name exactly the 17 families")
    for family in FAMILIES:
        path = os.path.join("families", family + ".json")
        if os.path.exists(os.path.join(survey, path)):
            data["titles"][family] = _read_json(survey, path).get("title", "")
    return data


def tag_uses(survey):
    """{raw tag: uses} over digest tags and family-summaries nongit suggested_tags."""
    uses = {}
    for row in survey["projects"] + survey["groups"]:
        for tag in row.get("tags") or ():
            uses[tag] = uses.get(tag, 0) + 1
    for summary in survey["summaries"].values():
        for item in summary.get("nongit") or ():
            for tag in item.get("suggested_tags") or ():
                uses[tag] = uses.get(tag, 0) + 1
    return uses


# ── identity helpers ────────────────────────────────────────────────────────────────────────

FORGE_ID = re.compile(r"(?:github\.com|codeberg\.org)/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")
PRIMARY_OWNER = "github.com/cambridgetcg/"


def is_forge_id(value):
    return isinstance(value, str) and FORGE_ID.fullmatch(value) is not None


def forge_id(value):
    ident = value.strip().rstrip("/").lower()
    return ident[:-4] if ident.endswith(".git") else ident


def _base_name(name):
    return re.sub(r"\s*\(.*$", "", name or "").strip().lower()


# Survey prose uses "zerone" for the chain trunk, not for the small public repo of that name.
NAME_ALIASES = {"zerone": "github.com/cambridgetcg/zerone-core"}


class NameIndex:
    """Resolves the bare names the survey uses for projects to their ids. When several ids share a
    name, the survey's unqualified record wins (its twins carry "(GitHub twin)" and the like),
    then a single id under the primary GitHub owner; otherwise the name stays unresolved."""

    def __init__(self, projects):
        self.by_name, self.exact, self.paths = {}, {}, {}
        for row in projects:
            for name in {_base_name(row["name"]), row["id"].rsplit("/", 1)[-1].lower()}:
                if name:
                    self.by_name.setdefault(name, set()).add(row["id"])
            self.exact.setdefault((row.get("name") or "").strip().lower(), set()).add(row["id"])
            path = (row.get("path") or "").strip().rstrip("/").lower()
            if path:
                self.paths.setdefault(path, set()).add(row["id"])

    def candidates(self, name):
        """Every id the bare name could mean, sorted."""
        return sorted(self.by_name.get(name.strip().lower(), set()))

    def by_path(self, path):
        """The one id whose survey path is path (case-insensitive), else None."""
        ids = self.paths.get(path.strip().rstrip("/").lower(), set())
        return next(iter(ids)) if len(ids) == 1 else None

    def resolve(self, name):
        key = name.strip().lower()
        if key in NAME_ALIASES:
            return NAME_ALIASES[key]
        ids = self.by_name.get(key, set())
        if len(ids) == 1:
            return next(iter(ids))
        exact = ids & self.exact.get(key, set())
        if len(exact) == 1:
            return next(iter(exact))
        primary = [i for i in ids if i.startswith(PRIMARY_OWNER)]
        return primary[0] if len(primary) == 1 else None


def rekey(row, home):
    """The record id: a forge id as is, a local id as is, and a bare absolute path (the survey has
    one, lowercased) re-keyed to a home-relative local id with its letter case restored."""
    ident = row["id"]
    if is_forge_id(ident) or ident.startswith(LOCAL):
        return ident
    require(ident.startswith("/"), "unrecognised project id %r" % ident)
    home_real = os.path.realpath(home)
    require(ident.lower().startswith(home_real.lower() + "/"), "path id outside HOME: %r" % ident)
    return LOCAL + HOME_REL + _recase(home_real, ident[len(home_real) + 1:])


def _recase(base, rel):
    """rel with each component's case taken from the directory listing where it still exists."""
    parts, current = [], base
    for part in rel.split("/"):
        try:
            names = os.listdir(current)
        except OSError:
            names = []
        match = next((n for n in names if n.lower() == part.lower()), part)
        parts.append(match)
        current = os.path.join(current, match)
    return "/".join(parts)


def local_path(ident, home):
    rest = ident[len(LOCAL):]
    if rest == "~":
        return os.path.realpath(home)
    require(rest.startswith(HOME_REL), "local id is not home-relative: %r" % ident)
    return os.path.join(os.path.realpath(home), rest[len(HOME_REL):])


def local_alias(path):
    """(alias or None, status) for a checkout without a remote: local:<basename>@<root12> from the
    root commit (the lexically smallest when there are several), local:<basename>@p<sha8(realpath)>
    for a repo without commits. Read through GitRunner; a promisor clone is not read at all."""
    real = os.path.realpath(path)
    base = os.path.basename(real.rstrip("/")) or "root"
    if not os.path.isdir(real):
        return None, "gone"
    git = safety.GitRunner(real)
    top = git.toplevel_check()
    if not top["ok"]:
        return None, "not a checkout root (%s)" % top["reason"]
    flag, reasons = git.promisor_state()
    if flag is not False:
        return None, "skipped: promisor config (%s)" % (", ".join(reasons) or "unknown")
    res = git.run("rev-list", "--max-parents=0", "HEAD")
    if res.timed_out:
        return None, "timeout"
    roots = sorted(line for line in res.out.split() if re.fullmatch(r"[0-9a-f]{40}(?:[0-9a-f]{24})?", line))
    if res.ok and roots:
        return "%s%s@%s" % (LOCAL, base, roots[0][:12]), "ok"
    head = git.run("rev-parse", "--verify", "-q", "HEAD")
    if head.code == 1 and not head.out.strip():
        return "%s%s@p%s" % (LOCAL, base, hashlib.sha256(real.encode("utf-8", "surrogateescape")).hexdigest()[:8]), "no commits"
    return None, "rev-list failed: exit %s" % res.code


# ── relations ───────────────────────────────────────────────────────────────────────────────

# Survey verbs folded onto the 15 relation verbs (spec 4); "inverse" swaps the ends.
VERB_FOLDS = {
    "related": ("related_to", False), "depended_on_by": ("depends_on", True), "fed_by": ("feeds", True),
    "duplicate_of": ("copy_of", False), "archive_of": ("copy_of", False), "archived_in": ("copy_of", True),
    "name_sibling": ("name_collision", False), "name_conflated_with": ("name_collision", False),
}


def _split_top(text, separators=",;"):
    """Split on separators outside parentheses."""
    parts, depth, current = [], 0, []
    for ch in text:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(depth - 1, 0)
        if ch in separators and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(ch)
    parts.append("".join(current))
    return [p.strip() for p in parts if p.strip()]


def parse_relation(raw):
    """(verb, inverse, raw_kind, [(target, note)]) of one survey relation string 'verb:targets'."""
    head, sep, rest = raw.partition(":")
    raw_kind = re.sub(r"\s*\(.*$", "", head).strip()
    if raw_kind in RELATION_VERBS:
        verb, inverse = raw_kind, False
    else:
        verb, inverse = VERB_FOLDS.get(raw_kind, ("related_to", False))
    targets = []
    for token in _split_top(rest):
        match = re.match(r"^(.*?)\s*\((.*)\)\s*$", token)
        target, note = (match.group(1).strip(), match.group(2).strip()) if match else (token, "")
        targets.append((target, note))
    return verb, inverse, raw_kind, targets


def resolve_target(target, names, groups):
    """A committable id (forge or group) for one relation target, or None (it stays private)."""
    if is_forge_id(target):
        return forge_id(target)
    if target.startswith((LOCAL, "~", "/")) or not re.fullmatch(r"[A-Za-z0-9_.-]+", target):
        return groups.get(target.lower())
    ident = names.resolve(target)
    return ident if ident and is_forge_id(ident) else groups.get(target.lower())


def relations_for(row, ident, names, groups):
    """(committed relations, private relations) for one project. Committed ones point at forge or
    group ids only; anything else (paths, surfaces, prose) stays private with the raw string."""
    public, private, seen = [], [], set()
    for raw in row.get("rels") or ():
        verb, inverse, raw_kind, targets = parse_relation(raw)
        for target, note in targets:
            other = resolve_target(target, names, groups)
            if other is None or other == ident or not is_forge_id(ident):
                private.append(safety.Inline({"verb": verb, "raw_kind": raw_kind, "target": target, "raw": raw}))
                continue
            edge = {"verb": verb}
            if inverse:
                edge.update({"from": other, "to": ident})
            else:
                edge["to"] = other
            edge["raw_kind"] = raw_kind
            key = (verb, edge.get("from", ident), edge["to"])
            if key in seen:
                continue
            seen.add(key)
            text, spans, heavy = scrub(note)
            if text and not spans and not heavy:
                edge["note"] = text
            public.append(edge)
    return public, private


# ── groups ──────────────────────────────────────────────────────────────────────────────────

BE_REPO = "github.com/cambridgetcg/business-ecosystem"
# The survey's bulk groups: (phrase of its label, slug, committed member rule or None). Names,
# forge globs and repo subpaths are path-free and committed. A group whose members are found by
# local path gets a private path-glob rule; its paths come from the private curation already in
# place (carried forward on a re-import) or from member paths the survey itself gives, never from
# this file.
GROUP_RULES = (
    ("Removed Codex task worktrees", "codex-task-worktrees-removed", None),
    ("Removed hub .worktrees", "hub-worktrees-removed", None),
    ("Removed Claude agent worktrees", "claude-agent-worktrees-removed", None),
    ("Removed standalone zerone2 beta clones", "zerone2-beta-clones-removed", None),
    ("Kept dirty hub worktrees", "hub-worktrees-kept", None),
    ("Hermes astra-ultra zerone checkouts", "hermes-zerone-checkouts", None),
    ("Stale worktree registrations", "hub-prunable-registrations", None),
    ("phase-b git-conformance fixture repos", "phase-b-fixtures", None),
    ("kingdom-mcp July release/feature worktrees", "kingdom-mcp-july-worktrees", None),
    ("regenerated word-citizen repos", "reforge-word-repos", None),
    ("NPL verb node repos", "npl-verb-nodes", ("forge-names", "github.com/cambridgetcg")),
    ("NPL design stubs", "npl-design-stubs", ("forge-names", "github.com/cambridgetcg")),
    ("business-ecosystem foundational services", "foundational-services", ("repo-subpath", BE_REPO)),
    ("business-ecosystem operational services", "operational-services", ("repo-subpath", BE_REPO)),
    ("business-ecosystem edge gateway", "edge-gateway", ("repo-subpath", BE_REPO)),
    ("business-ecosystem shared libraries", "shared-libraries", ("repo-subpath", BE_REPO)),
    ("business-ecosystem infrastructure-as-code", "infrastructure-as-code", ("repo-subpath", BE_REPO)),
    ("business-ecosystem documentation corpus", "documentation-corpus", ("repo-subpath", BE_REPO)),
    ("Claude Code / Agent SDK study sources", "claude-study-sources", None),
    ("Runtime caches mis-detected", "runtime-caches", None),
    ("Hermes agenttool-collab trial fixtures", "hermes-collab-fixtures", None),
    ("founding-value-citizens", "founding-value-citizens", ("forge-names", "github.com/cambridgetcg")),
    ("forged-word-citizens", "forged-word-citizens", ("forge-names", "github.com/cambridgetcg")),
    ("kingdom-fleet-snapshot-clones", "kingdom-fleet-snapshot-clones", None),
    ("desktop-founding-mirror", "desktop-founding-mirror", None),
    ("repos-github-citizen-clones", "repos-github-citizen-clones", None),
    ("codeberg-citizen-snapshots", "codeberg-citizen-snapshots", ("forge-glob", "codeberg.org/zerone-dev/citizen-*")),
    ("forge-stub-citizens-with-origin", "forge-stub-citizens-with-origin", None),
)
_SUBPATH = re.compile(r"[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*")


def group_rule_for(label):
    hits = [rule for rule in GROUP_RULES if rule[0] in label]
    require(len(hits) == 1, "survey group %r matches %d group rules" % (label, len(hits)))
    return hits[0]


def _committed_member_rule(rule, members):
    kind, arg = rule
    if kind == "forge-names":
        return safety.Inline({"kind": "names", "names": [arg + "/" + m.lower() for m in members]})
    if kind == "forge-glob":
        return safety.Inline({"kind": "forge-glob", "pattern": arg})
    names = []
    for member in members:
        core = re.sub(r"\s*\(.*$", "", member).strip().rstrip("/")
        if _SUBPATH.fullmatch(core) and core not in names:
            names.append(core)
    return safety.Inline({"kind": "repo-subpath", "repo": arg, "names": names})


def _private_member_rule(members, seeded=None):
    """The private path-glob rule of a local group: the rule already in the private curation when
    there is one (owner-curated paths survive a re-import), else the member paths the survey
    gives. A group with neither gets an empty rule and a note, never an invented path."""
    if isinstance(seeded, dict) and seeded.get("kind") == "path-glob":
        return safety.Inline(seeded)
    patterns = [m for m in members if m.startswith(("~", "/"))]
    rule = {"kind": "path-glob", "patterns": patterns}
    if not patterns:
        rule["note"] = "the survey names members, not paths; add the patterns to the private curation"
    return safety.Inline(rule)


# ── import: committed documents ─────────────────────────────────────────────────────────────

def _dated(entry):
    entry.update({"as_of": AS_OF, "review_after": REVIEW_AFTER, "reviewed": False, "source": SOURCE})
    return entry


class Plan:
    """Everything the import writes, built in memory and validated before any write."""

    def __init__(self):
        self.committed = {}        # relpath -> dict (TOML) or str (TSV)
        self.private = {}          # relpath under private/ -> dict
        self.queue = {"role_unknown": [], "topic_queue": {}, "heavy": [], "alias": {}}
        self.counts = {}


def _apply_tags(raw_tags, index):
    targets = []
    for raw in raw_tags or ():
        for target in index.get(raw, ()):
            if target not in targets:
                targets.append(target)
    return targets


def _own_names(row, ident):
    names = {_base_name(row.get("name", "")), ident.rsplit("/", 1)[-1].lower()}
    return {n for n in names if n}


def assign_topics(records, index, nav):
    """{id: (topics, queued)} for records given as {id: (raw_tags, own_names)}.

    A topic needs at least 2 records globally, never equals a navigation-facet value (nav, see
    nav_values) or the record's own name, at most 3 per record and 40 overall; the rest waits in QUEUE with a reason."""
    candidates = {}
    for ident, (raw_tags, own) in records.items():
        topics = [t.split("=", 1)[1] for t in _apply_tags(raw_tags, index) if t.startswith("topic=")]
        candidates[ident] = [t for t in topics if t not in own and t not in nav]
    uses = {}
    for topics in candidates.values():
        for topic in topics:
            uses[topic] = uses.get(topic, 0) + 1
    ranked = sorted((t for t in uses if uses[t] >= 2), key=lambda t: (-uses[t], t))
    admitted = set(ranked[:TOPIC_CAP])
    out = {}
    for ident, topics in candidates.items():
        keep, queued = [], []
        for topic in sorted(topics, key=lambda t: (-uses[t], t)):
            if uses[topic] < 2:
                queued.append(safety.Inline({"topic": topic, "reason": "below-threshold"}))
            elif topic not in admitted:
                queued.append(safety.Inline({"topic": topic, "reason": "over-global-cap"}))
            elif len(keep) >= TOPICS_PER_RECORD:
                queued.append(safety.Inline({"topic": topic, "reason": "over-record-cap"}))
            else:
                keep.append(topic)
        out[ident] = (keep, queued)
    return out, uses


def _correction_split(corrections):
    """(committed, private): a correction whose JSON matches the risk regex, or whose field is a
    record's risks, liveness evidence or working-tree state, moves wholesale; the rest commit
    field, verdict and scrubbed text (evidence locators stay private)."""
    public, private = [], []
    for item in corrections or ():
        if is_risky(item):
            private.append(dict(item, moved="risk-regex"))
            continue
        if RISK_FIELD.search(str(item.get("field") or "")):
            private.append(dict(item, moved="risk-field"))
            continue
        field, f_spans, f_heavy = scrub(item.get("field", ""))
        verdict, v_spans, v_heavy = scrub(item.get("verdict", ""))
        text, t_spans, t_heavy = scrub(item.get("corrected", ""))
        if f_spans or v_spans or t_spans or f_heavy or v_heavy or t_heavy or not text:
            private.append(dict(item, moved="scrub"))
            continue
        public.append({"field": field, "verdict": verdict, "corrected": text})
        private.append(dict(item, moved="evidence-only"))
    return public, private


def build_projects(plan, survey, index, home, alias_fn, nav):
    names = NameIndex(survey["projects"])
    groups = {}
    for row in survey["groups"]:
        phrase, slug, rule = group_rule_for(row["label"])
        if rule is not None:
            groups[slug] = "group:%s/%s" % (row["family"], slug)
    records = {}
    for row in survey["projects"]:
        ident = rekey(row, home)
        records[ident] = (row.get("tags"), _own_names(row, ident))
    topics, topic_uses = assign_topics(records, index, nav)
    families = {family: [] for family in FAMILIES}
    private_rows = []
    for row in survey["projects"]:
        ident = rekey(row, home)
        committed = is_forge_id(ident)
        what, what_spans, heavy = scrub(row["what"])
        roles, status = roles_from_function(row["business_function"])
        public_rels, private_rels = relations_for(row, ident, names, groups)
        public_corr, private_corr = _correction_split(row.get("corrections"))
        keep, queued = topics[ident]
        queue = []
        if not roles:
            queue.append("role:unknown")
            plan.queue["role_unknown"].append(ident)
        for item in queued:
            queue.append("topic:%s:%s" % (item["topic"], item["reason"]))
            plan.queue["topic_queue"].setdefault(item["topic"], []).append(ident)
        if heavy:
            queue.append("what:heavy")
            plan.queue["heavy"].append(ident)
        private = {"id": ident, "family": row["family"], "committed": committed,
                   "survey_id": row["id"], "path": row.get("path") or "", "what_full": row["what"],
                   "risks": list(row.get("risks") or []), "raw_tags": list(row.get("tags") or []),
                   "surfaces_raw": list(row.get("surfaces") or []), "rels_raw": list(row.get("rels") or [])}
        if private_rels:
            private["relations_private"] = private_rels
        if private_corr:
            private["corrections_private"] = [safety.Inline(_no_none(c)) for c in private_corr]
        private["survey_claims"] = safety.Inline(_no_none({
            k: row.get(k) for k in ("layer", "kind", "domain", "card_state", "card_present", "liveness",
                                    "business_function", "confidence")}))
        if queue:
            private["queue"] = queue
        if not committed:
            alias, alias_status = alias_fn(local_path(ident, home))
            private.update({"name": row["name"], "what": what, "role": roles, "topics": keep})
            if status:
                private["role_status"] = status
            if alias:
                private["aliases"] = [alias]
            private["alias_status"] = alias_status
            plan.queue["alias"][ident] = alias_status
            private_rows.append(private)
            continue
        # The display name is survey prose too; when it says more than a name may, the
        # committed name is the repository's own.
        name, name_spans, name_heavy = scrub(row["name"])
        if name_spans or name_heavy or not name:
            name = ident.rsplit("/", 1)[-1]
        entry = {"id": ident, "name": name, "what": what}
        if heavy:
            entry["heavy"] = True
        if roles:
            entry["role"] = roles
            entry["role_status"] = status
        if keep:
            entry["topics"] = keep
        if row.get("confidence"):
            entry["confidence"] = row["confidence"]
        _dated(entry)
        if public_rels:
            entry["relations"] = public_rels
        if public_corr:
            entry["corrections"] = public_corr
        families[row["family"]].append(entry)
        private_rows.append(private)
    plan.counts.update({"projects_committed": sum(len(v) for v in families.values()),
                        "projects_private_only": sum(1 for r in private_rows if not r["committed"]),
                        "topics_admitted": sorted(t for t in topic_uses if topic_uses[t] >= 2)})
    return families, private_rows, groups


def _no_none(mapping):
    return {k: v for k, v in mapping.items() if v is not None}


def build_groups(survey, seeded=None):
    """(committed groups by family, private group entries). seeded: {group id: row} of the private
    curation already in place; its member rule and canonical location are the owner's and win."""
    seeded = seeded or {}
    committed = {family: [] for family in FAMILIES}
    private = []
    used = set()
    for row in survey["groups"]:
        phrase, slug, rule = group_rule_for(row["label"])
        require(slug not in used, "two survey groups map to slug %r" % slug)
        used.add(slug)
        ident = "group:%s/%s" % (row["family"], slug)
        roles, status = roles_from_function(row.get("business_function"))
        members = list(row.get("members") or [])
        detail = {"id": ident, "family": row["family"], "committed": rule is not None, "label": row["label"],
                  "what_full": row.get("what") or "", "members": members,
                  "canonical_location": row.get("canonical_location") or "", "notes": row.get("notes") or "",
                  "raw_tags": list(row.get("tags") or []), "count_at_survey": row.get("count") or len(members),
                  "survey_claims": safety.Inline(_no_none({k: row.get(k) for k in (
                      "layer", "kind", "liveness", "business_function")}))}
        before = seeded.get(ident) or {}
        if before.get("canonical_location"):
            detail["canonical_location"] = before["canonical_location"]
        if rule is None:
            detail["member_rule"] = _private_member_rule(members, before.get("member_rule"))
            if roles:
                detail.update({"role": roles, "role_status": status})
            private.append(detail)
            continue
        label, l_spans, l_heavy = scrub(row["label"])
        what, w_spans, w_heavy = scrub(row.get("what") or "")
        entry = {"id": ident, "label": label or slug, "what": what}
        if w_heavy:
            entry["heavy"] = True
        if roles:
            entry.update({"role": roles, "role_status": status})
        entry["member_rule"] = _committed_member_rule(rule, members)
        entry["count_at_survey"] = row.get("count") or len(members)
        committed[row["family"]].append(_dated(entry))
        private.append(detail)
    return committed, private


def build_family_docs(plan, survey, families, groups):
    for family in FAMILIES:
        summary = survey["summaries"][family]
        text, spans, heavy = scrub(summary.get("summary", ""))
        title, t_spans, t_heavy = scrub(survey["titles"].get(family, ""))
        questions = []
        for question in summary.get("open_questions") or ():
            public, q_spans, q_heavy = scrub(question)
            if public and not q_spans and not q_heavy:
                questions.append(public)
        head = {"id": "family:" + family, "label": title or family, "summary": text}
        if heavy:
            head["heavy"] = True
        head["open_questions"] = questions
        doc = {"family": _dated(head)}
        if families[family]:
            doc["project"] = sorted(families[family], key=lambda e: e["id"])
        if groups[family]:
            doc["group"] = sorted(groups[family], key=lambda e: e["id"])
        plan.committed["curated/families/%s.toml" % family] = doc


# The six disputes the layer records but never resolves (spec 14), with their candidates.
DISPUTES = (
    ("citizen-layer", "Citizen layer: soul or fleet", "q:citizen-layer", "P10", (
        ("soul", "citizen kingdom.yaml cards (layer: soul)"),
        ("fleet", "kingdom-os bin/harvest.ts discoverFleet and the ARCHITECTURE.md FLEET row"))),
    ("kingdom-os-claimants", "Which repository is Kingdom OS", "q:kingdom-os-identity", None, (
        ("github.com/cambridgetcg/kingdom-os", "roster.conf and harvest: the connective layer"),
        ("codeberg.org/zerone-dev/kingdom-os", "the Codeberg fork claims the core registry and heartbeat; unrelated history"),
        ("github.com/cambridgetcg/kingdom", "REALM.md: Kingdom OS = LEGIBLE"))),
    ("adr-0001", "ADR-0001: legible-money canonical, or superseded by the live zerone-1 chain",
     "q:kingdom-os-identity", None, (
        ("github.com/cambridgetcg/legible_money", "ADR-0001 in the REALM repository's decisions"),
        ("github.com/cambridgetcg/zerone-core", "the live zerone-1 chain runs from this trunk"))),
    ("canonical-rewardspro", "Canonical RewardsPro source", "q:canonical-sources", None, (
        ("github.com/cambridgetcg/rewardspro", "the Vercel project rewardspro-production"),
        ("github.com/cambridgetcg/cambridge-tcg-monorepo", "apps/rewardspro inside the monorepo"))),
    ("ai-love-source", "Which source serves ai-love.cc", "q:canonical-sources", None, (
        ("github.com/cambridgetcg/ai-love", "the static site deployed by rsync to a VPS"),
        ("codeberg.org/zerone-dev/youspeak", "home/ deployed to the Pages project ai-love"))),
    ("taxonomy-authority", "Which KINGDOM taxonomy is authoritative", "q:taxonomy-authority", "P15", (
        ("kingdom-os worktree (local main)", "COMMERCE layer label on the local main branch"),
        ("kingdom-os origin/main", "COMMERCE renamed PROJECTS; commercial targets retired 2026-09-23"),
        ("codeberg.org/zerone-dev/kingdom-os", "the Codeberg KINGDOM-OS fork"))),
)
# Disputes about which source serves a surface: while one is open, the surface stays unsettled
# (every candidate competes) whatever the curated attribution says.
DISPUTE_SURFACES = {"ai-love-source": ("surface:cf-pages:ai-love",)}
# critic.questions_for_yu in order: (id, a phrase the question must contain).
QUESTION_IDS = (
    ("q:taxonomy-authority", "taxonomy is authoritative"), ("q:in-repo-private-area", "estate map live"),
    ("q:business-ecosystem-state", "business-ecosystem's state"), ("q:legal-entities", "legal entities"),
    ("q:forge-visibility", "re-publication"), ("q:device-backup", "backup"),
    ("q:secret-hygiene", "hygiene"), ("q:residual-cloud", "AWS stacks"), ("q:local-services", "RabbitMQ"),
    ("q:unattributed-surfaces", "unattributed live surfaces"), ("q:citizen-layer", "citizens layer"),
    ("q:kingdom-os-identity", "ADR-0001"), ("q:darwin-workstream", "darwin"),
    ("q:shared-folder-items", "Shared items"), ("q:canonical-sources", "RewardsPro"),
)
# Questions whose text is per-record exposure, legal or local-state detail in words the scrub rules
# do not catch (CB-8): the whole text stays private and the committed row carries only a neutral
# subject. The private atlas shows the full text (render.all_questions).
PRIVATE_QUESTIONS = {
    "q:legal-entities": "Legal entities: which exist and what each owns or operates (the private curation holds the "
                        "question).",
    "q:forge-visibility": "Forge visibility: whether the current visibility of the forge repositories is intended (the "
                          "private curation holds the question).",
    "q:darwin-workstream": "An unowned local workstream: which project owns it and what to do with it (the private "
                           "curation holds the question).",
}
UPSTREAM_NOTES = (
    ("pr1-portfolio-map-doc", "pr1-owner", BE_REPO, "docs/PORTFOLIO_MAP.md",
     "Note the owner's in-repo private area as an explicit exception",
     "PORTFOLIO_MAP.md (PR #1 branch) keeps real maps outside the repository. The estate layer keeps a "
     "gitignored, 0700 private area inside it by the owner's request (decision dec-2026-10-17-1); a short doc "
     "note would keep the two documents consistent."),
    ("pr1-v2-ideas", "pr1-owner", BE_REPO, "scripts/portfolio.py",
     "Ideas for a later portfolio-map revision",
     "The estate layer joins portfolio-map/1 records by their GitHub numeric ids and carries KINGDOM facets as "
     "opaque extensions in a separate join file. A later revision could accept such extensions without a "
     "schema change."),
    ("cproj-promisor-guard", "kingdom-os", "github.com/cambridgetcg/kingdom-os", "bin/cproj",
     "Check promisor config before any status call",
     "Checkouts whose remotes set promisor or partialclonefilter keys lazily fetch objects on status. "
     "The estate layer checks the config first and skips object reads; cproj could do the same."),
    ("pulse-exit3-semantics", "kingdom-os", "github.com/cambridgetcg/kingdom-os", "bin/pulse.ts",
     "Let pulse tell a degraded job from a failed one",
     "chain-backup exits 1 on an operational failure and 3 when it captured data it did not verify; pulse "
     "reports any nonzero launchd exit as down, so the two look the same. Exit 3 is not a success and should "
     "stay visibly not green; a distinct degraded (amber) state would separate it from a hard failure."),
    ("crontab-staged-karma", "kingdom-os", "github.com/cambridgetcg/kingdom-os", "crontab.staged",
     "Keep the karma witness line when installing crontab.staged",
     "crontab.staged lacks the karma round line, so installing it as is would stop the karma witness."),
    ("harvest-discovery-scope", "kingdom-os", "github.com/cambridgetcg/kingdom-os", "bin/harvest.ts",
     "Revisit where harvest discovers fleet citizens",
     "harvest discovers citizens only under its CITIZENS_DIR, a June mirror of the founding citizens, while the "
     "living homes and most forged-word citizens sit elsewhere."),
)


_HEDGE = re.compile(r"(?i)\bambiguous\b|\balso claims?\b|\bor\b|\beither\b|\bunclear\b|\bdisputed\b|\?")
_QUALIFIED = re.compile(r"([A-Za-z0-9_.-]+)\s*\(([^)]*)\)")
_PATH_WORD = re.compile(r"(?<![\w-])(?:~|/)[^\s,;()]+")


def _resolve_source(text, names):
    """(ids, hedged) for a survey source_project text. hedged is True when the text doubts its
    own answer ("ambiguous: A or B", "A per its README; B also claims it"): every id it names is
    then a candidate only, never the settled source. A "(codeberg clone)" or "(GitHub twin)"
    qualifier picks that forge's id when the name exists on both forges. Local paths name
    checkouts, not projects; they count only as rival claims inside a hedged text."""
    text = text or ""
    hedged = _HEDGE.search(text) is not None
    found = [forge_id(m) for m in FORGE_ID.findall(text)]
    if not found:
        for name, qualifier in _QUALIFIED.findall(text):
            low = qualifier.lower()
            host = "codeberg.org/" if "codeberg" in low else ("github.com/" if "github" in low else None)
            hits = [i for i in names.candidates(name) if host and i.startswith(host)]
            if len(hits) == 1:
                found.append(hits[0])
                text = text.replace(name, " ", 1)
        if hedged:
            found += [i for i in (names.by_path(p) for p in _PATH_WORD.findall(text)) if i and is_forge_id(i)]
        cleaned = re.sub(r"(?i)\bambiguous\s*:?", " ", _PATH_WORD.sub(" ", text))
        for token in re.split(r"\s+AND\s+|\s+or\s+|[,+/;()]", cleaned):
            ident = names.resolve(token.strip()) if token.strip() else None
            if ident and is_forge_id(ident):
                found.append(ident)
    unique = []
    for ident in found:
        if ident not in unique:
            unique.append(ident)
    return unique, hedged


_HOST = re.compile(r"(?i)(?<![\w.@-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,})(?![\w-])")
_FILE_SUFFIXES = ("js", "ts", "toml", "json", "md", "py", "sh", "yml", "yaml", "txt", "html", "log", "plist")
SHARED_APEX = ("fly.dev", "pages.dev", "vercel.app", "workers.dev", "github.io", "codeberg.page")
SURFACE_TOKENS = (
    ("fly-postgres", "fly"), ("fly-app", "fly"), ("cf-worker+cf-pages", "cf-worker"), ("cf-pages", "cf-pages"),
    ("cf-worker", "cf-worker"), ("codeberg-pages", "codeberg-pages"), ("shopify-app", "shopify"),
    ("vercel", "vercel"), ("managed-db", "supabase"), ("external-payments", "stripe"),
    ("cloudflare-email", "cloudflare-email"), ("in-process", "fly"), ("local", "local-launchd"),
    ("aws", "x-aws"), ("object-storage", "external"), ("forge", "external"), ("web door", "external"),
)


def public_hostnames(text):
    hosts = []
    for host in _HOST.findall(text or ""):
        host = host.lower()
        if host.rsplit(".", 1)[-1] in _FILE_SUFFIXES or host in SHARED_APEX or host in hosts:
            continue
        if re.fullmatch(r"[\d.]+", host) or host.startswith(("com.", "love.", "ai.", "dev.", "homebrew.")):
            continue
        hosts.append(host)
    return hosts


def registrable(host):
    for apex in SHARED_APEX:
        if host.endswith("." + apex):
            return None
    labels = host.split(".")
    return ".".join(labels[-2:]) if len(labels) >= 2 else None


def build_surfaces(survey, names):
    """(committed surfaces, committed zones, private provider resources)."""
    public, private, zones = [], [], {}
    for item in survey["surfaces"].get("surfaces", []):
        kind = item.get("kind", "")
        provider = next((t for prefix, t in SURFACE_TOKENS if kind.startswith(prefix)), "external")
        hosts = [] if provider == "local-launchd" else public_hostnames(item.get("url_or_label", ""))
        sources, hedged = _resolve_source(item.get("source_project", ""), names)
        private.append(safety.Inline(_no_none({
            "surface": "surface:%s:%s" % (provider, item["id"]), "kind": kind, "label": item.get("url_or_label"),
            "source_path": item.get("source_path"), "deploy_method": item.get("deploy_method"),
            "last_known_status": item.get("last_known_status"), "evidence": item.get("evidence"),
            "source_project_raw": item.get("source_project")})))
        if not hosts:
            continue
        entry = {"id": "surface:%s:%s" % (provider, item["id"]), "provider": provider, "name": item["id"],
                 "hostnames": hosts}
        if len(sources) == 1 and not hedged:
            entry["source_project"] = sources[0]
        elif sources:
            entry["competing_sources"] = sources
        public.append(_dated(entry))
        for host in hosts:
            apex = registrable(host)
            if apex:
                zones.setdefault(apex, []).append(entry)
    zone_rows = []
    for fqdn in sorted(zones):
        surfaces = zones[fqdn]
        owners = {s.get("source_project") for s in surfaces}
        row = {"id": "zone:" + fqdn, "fqdn": fqdn, "dns_provider": "unknown", "registrar": "unknown",
               "surfaces": sorted({s["id"] for s in surfaces})}
        if len(owners) == 1 and None not in owners:
            row["owner_project"] = owners.pop()
        zone_rows.append(_dated(row))
    return sorted(public, key=lambda e: e["id"]), zone_rows, private


def build_estate_doc(plan, survey, known_ids):
    names = NameIndex(survey["projects"])
    surfaces, zones, provider_rows = build_surfaces(survey, names)
    identity = [_dated({"id": "github.com/cambridgetcg/zerone-core", "aliases": ["codeberg.org/zerone-dev/zerone"],
                        "note": "The hub checkout tracks the Codeberg remote as origin and GitHub zerone-core as "
                                "trunk; a checkout carrying the alias resolves to the trunk."})]
    disputes = []
    for slug, title, question, rule, candidates in DISPUTES:
        entry = {"id": "dispute:" + slug, "title": title, "status": "open", "question": question,
                 "candidates": [safety.Inline({"claim": c, "source": s}) for c, s in candidates]}
        if rule:
            entry["proposal_rule"] = rule
        named = [sid for sid in DISPUTE_SURFACES.get(slug, ()) if sid in {s["id"] for s in surfaces}]
        if named:
            entry["surfaces"] = named
        disputes.append(_dated(entry))
    questions, private_questions = _questions(survey)
    notes = [_dated({"id": "note:" + slug, "owner": owner, "repo_id": repo, "file": path, "title": title,
                     "text": text, "status": "proposed"})
             for slug, owner, repo, path, title, text in UPSTREAM_NOTES]
    for ident in [e["id"] for e in identity] + [a for e in identity for a in e["aliases"]] + \
            [c["claim"] for d in disputes for c in d["candidates"] if is_forge_id(c["claim"])] + \
            [n["repo_id"] for n in notes]:
        require(ident in known_ids, "curated estate names an id the survey does not know: %s" % ident)
    plan.committed["curated/estate.toml"] = {
        "owners": {"github": ["cambridgetcg"], "codeberg": ["zerone-dev"]},
        "legal": {"status": "unassigned", "records": []},
        "identity": identity, "surface": surfaces, "zone": zones, "dispute": disputes,
        "question": questions, "upstream_note": notes,
    }
    plan.counts.update({"surfaces_committed": len(surfaces), "zones": len(zones),
                        "questions_committed": len(questions), "questions_private": len(private_questions)})
    return provider_rows, private_questions


def _questions(survey):
    texts = survey["critic"].get("questions_for_yu") or []
    require(len(texts) == len(QUESTION_IDS), "critic has %d questions for Yu, expected %d"
            % (len(texts), len(QUESTION_IDS)))
    public, private = [], []
    for (ident, phrase), text in zip(QUESTION_IDS, texts):
        require(phrase.lower() in text.lower(), "question %s no longer mentions %r" % (ident, phrase))
        clean, spans, heavy = scrub(text)
        entry = {"id": ident, "source": "critic.questions_for_yu", "status": "open"}
        if ident in PRIVATE_QUESTIONS:
            public.append(_dated(dict(entry, text=PRIVATE_QUESTIONS[ident])))
            private.append(dict(entry, text=text, committed=True))
        elif clean and not spans and not heavy:
            public.append(_dated(dict(entry, text=clean)))
        elif clean and not heavy and all(_is_placeholder_span(s) for s in spans):
            public.append(_dated(dict(entry, text=clean)))
            private.append(dict(entry, text=text, committed=True))
        else:
            # Secret-related or mostly local detail: the whole question stays private.
            private.append(dict(entry, text=text, committed=False))
    return public, private


def _is_placeholder_span(span):
    """A replaced path, IP, email or id (not a moved sentence)."""
    return " " not in span.strip()


def existing_decisions(layer):
    """The committed curated/decisions.toml text when it exists: owner decisions are the owner's,
    so an import (even with --overwrite) keeps them as written. An unreadable or invalid file
    refuses the import rather than being replaced by one that has lost them."""
    raw, reason = safety.read_checked(os.path.join(layer, "curated", "decisions.toml"), 4 << 20)
    if raw is None:
        require(reason == "missing", "curated/decisions.toml unreadable (%s); the import would lose it" % reason)
        return None
    try:
        text = raw.decode("utf-8")
        tomllib.loads(text)
    except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
        raise GuardError("curated/decisions.toml is not valid TOML (%s); the import would lose it" % exc)
    return text


def existing_spheres(layer):
    """The sphere data of the committed curation in place: {families: {slug: [family.sphere]},
    projects: {id: row sphere}, rows: [[sphere]] of curated/estate.toml}. The classification behind
    owner decision D4 is not in the survey, so an import (even with --overwrite) carries it forward
    as written; a file that cannot be read refuses the import rather than lose it."""
    out = {"families": {}, "projects": {}, "rows": []}
    rels = ["curated/families/%s.toml" % family for family in FAMILIES] + ["curated/estate.toml"]
    for rel in rels:
        raw, reason = safety.read_checked(os.path.join(layer, rel), 4 << 20)
        if raw is None:
            require(reason == "missing", "%s unreadable (%s); the import would lose its sphere rows" % (rel, reason))
            continue
        try:
            doc = tomllib.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
            raise GuardError("%s is not valid TOML (%s); the import would lose its sphere rows" % (rel, exc))
        if rel.endswith("estate.toml"):
            out["rows"] = [row for row in doc.get("sphere") or [] if isinstance(row, dict)]
            continue
        if isinstance((doc.get("family") or {}).get("sphere"), dict):
            out["families"][rel.rsplit("/", 1)[1][:-len(".toml")]] = doc["family"]["sphere"]
        for row in doc.get("project") or []:
            if isinstance(row.get("sphere"), dict):
                out["projects"][row["id"]] = row["sphere"]
    return out


def carry_spheres(plan, kept):
    """Put the sphere data in place back where the import renders it (sphere.py writes it the same
    way): [family.sphere] after the family keys, a project's inline sphere as the last key of its
    row, [[sphere]] rows last in curated/estate.toml. A project row the survey no longer produces
    keeps its sphere as a [[sphere]] row."""
    projects = dict(kept["projects"])
    for rel, doc in sorted(plan.committed.items()):
        if not rel.startswith("curated/families/"):
            continue
        slug = rel.rsplit("/", 1)[1][:-len(".toml")]
        if slug in kept["families"]:
            doc["family"]["sphere"] = kept["families"][slug]
        for row in doc.get("project") or []:
            if row["id"] in projects:
                row["sphere"] = safety.Inline(projects.pop(row["id"]))
    rows = list(kept["rows"]) + [dict({"id": pid}, **table) for pid, table in sorted(projects.items())]
    if rows:
        plan.committed["curated/estate.toml"]["sphere"] = rows
    plan.counts["spheres_carried"] = len(kept["families"]) + len(kept["projects"]) + len(kept["rows"])


def build_decisions(plan, layer=None):
    existing = existing_decisions(layer) if layer else None
    if existing is not None:
        plan.committed["curated/decisions.toml"] = existing
        return
    plan.committed["curated/decisions.toml"] = {"decision": [{
        "id": "dec-2026-10-17-1", "date": AS_OF, "kind": "exception",
        "by": "yu (user request 2026-10-17; confirmation pending q:in-repo-private-area)",
        "subject": "docs/PORTFOLIO_MAP.md rule: keep real maps, reviews and exports outside the repository",
        "decision": "The estate layer keeps its private area inside the business-ecosystem repository, at "
                    "estate/private, as an explicit exception to that rule.",
        "conditions": [
            "estate/.gitignore and private/.gitignore both ignore the private area",
            "a canary file is checked with git check-ignore before every run",
            "private directories are 0700 and files 0600",
            "every private write is no-follow and never overwrites",
            "committing stays the owner's act, from a branch other than main or develop",
        ],
        "refs": ["q:in-repo-private-area", "note:pr1-portfolio-map-doc"],
    }]}


# ── import: private documents ───────────────────────────────────────────────────────────────

def _slug(text, taken):
    base = re.sub(r"[^a-z0-9]+", "-", text.lower().replace(HOME_REL, "")).strip("-")[:60] or "item"
    slug, n = base, 2
    while slug in taken:
        slug, n = "%s-%d" % (base, n), n + 1
    taken.add(slug)
    return slug


# Tables of the private estate curation that only the owner knows (spec 9.7: devices, accounts,
# legal candidates, location rules, caveat checks). The survey cannot produce them, so a
# re-import carries them forward from the private curation already in place; a first import
# leaves them empty for the owner to fill in, and this file never holds them.
OWNER_TABLES = ("device", "account", "legal_candidate", "location_rule", "caveat")
# Survey-derived private tables whose rows the owner may edit: a row already in place wins over
# the regenerated one with the same key, and rows the owner added are kept.
KEYED_TABLES = (("artifact", "id"), ("canonical_override", "project"))


def load_seed(layer):
    """{"estate": dict, "config": dict, "status": {file: ok|missing|reason}} of the private
    curation and config already in place. An unreadable or invalid file refuses the import: it
    would otherwise be replaced by one that has lost the owner's tables."""
    out = {"estate": {}, "config": {}, "status": {}}
    for key, rel in (("estate", "curated/estate.toml"), ("config", "config.toml")):
        raw, reason = safety.read_checked(os.path.join(layer, "private", rel), 16 << 20)
        if raw is None:
            require(reason == "missing", "private %s unreadable (%s); the import refuses rather than lose it"
                    % (rel, reason))
            out["status"][rel] = "missing"
            continue
        try:
            out[key] = tomllib.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, tomllib.TOMLDecodeError) as exc:
            raise GuardError("private %s is not valid TOML (%s); fix it before importing" % (rel, exc)) from exc
        out["status"][rel] = "ok"
    return out


def _keyed_merge(fresh, before, key):
    """fresh rows, each replaced by the row already in place with the same key, plus the rows in
    place that the survey does not produce."""
    kept = {row.get(key): row for row in before or [] if isinstance(row, dict) and row.get(key)}
    out = [kept.pop(row[key], row) for row in fresh]
    return out + [row for k, row in sorted(kept.items(), key=lambda kv: str(kv[0]))]


def _inline_args(rows):
    """Caveat args are inline tables, as the first import wrote them."""
    return [dict(row, args=safety.Inline(row["args"])) if isinstance(row.get("args"), dict) else row for row in rows]


def _canonical_overrides(survey, home):
    """Survey canonical paths, kept as private overrides where the survey saw several checkouts."""
    counts = {}
    for family in FAMILIES:
        path = os.path.join("families", family + ".json")
        if not os.path.exists(os.path.join(survey["dir"], path)):
            continue
        for project in _read_json(survey["dir"], path).get("projects", []):
            counts[project.get("id")] = project.get("n_checkouts") or 0
    rows = []
    for row in survey["projects"]:
        path = row.get("path") or ""
        if counts.get(row["id"], 0) > 1 and re.fullmatch(r"~(?:/[^\s()]+)?", path):
            rows.append(safety.Inline({"project": rekey(row, home), "path": path, "basis": SOURCE}))
    return rows


def build_private_estate(plan, survey, groups_private, provider_rows, private_questions, index, home, seed):
    taken = set()
    artifacts = []
    for family in FAMILIES:
        for item in survey["summaries"][family].get("nongit") or ():
            kinds = [t.split("=", 1)[1] for t in _apply_tags(item.get("suggested_tags"), index)
                     if t.startswith("artifact_kind=")]
            artifacts.append({
                "id": "artifact:" + _slug(item.get("path", "item"), taken), "family": family,
                "path": item.get("path", ""), "artifact_kind": kinds[0] if kinds else "unknown",
                "what": item.get("what", ""), "role": item.get("role", ""),
                "secret_bearing": bool(item.get("secret_bearing")), "contents_read": False, "backup": "unknown",
                "suggested_tags": list(item.get("suggested_tags") or [])})
    families = []
    for family in FAMILIES:
        summary = survey["summaries"][family]
        families.append({"id": "family:" + family, "summary_full": summary.get("summary", ""),
                         "open_questions_full": list(summary.get("open_questions") or []),
                         "drift": [safety.Inline(_no_none(d)) for d in summary.get("drift") or []],
                         "nongit_paths": [i.get("path", "") for i in summary.get("nongit") or []]})
    critic = survey["critic"]
    before = seed.get("estate") or {}
    doc = {
        "meta": {"source": SOURCE, "as_of": AS_OF, "note": "persistent private curation; one copy only"},
        "family": families,
        "artifact": _keyed_merge(artifacts, before.get("artifact"), "id"),
        "canonical_override": _keyed_merge(_canonical_overrides(survey, home), before.get("canonical_override"),
                                           "project"),
        "group": sorted(groups_private, key=lambda g: g["id"]),
        "provider_resource": provider_rows,
        "unattributed": list(survey["surfaces"].get("unmapped") or []),
        "question": [_no_none(q) for q in private_questions],
        "critic": {"estate_shape": critic.get("estate_shape", ""), "top_risks": list(critic.get("top_risks") or []),
                   "gaps": [safety.Inline(_no_none(g)) for g in critic.get("gaps") or []],
                   "overlaps": list(critic.get("overlaps") or [])},
    }
    for table in OWNER_TABLES:
        rows = [row for row in before.get(table) or [] if isinstance(row, dict)]
        if rows:
            doc[table] = _inline_args(rows) if table == "caveat" else rows
    doc["canonical_override"] = [safety.Inline(row) for row in doc["canonical_override"]]
    plan.private["curated/estate.toml"] = doc
    plan.counts["artifacts"] = len(artifacts)
    plan.counts["owner_tables"] = {table: len(doc.get(table) or []) for table in OWNER_TABLES}
    plan.queue["owner_tables_empty"] = [table for table in OWNER_TABLES if not doc.get(table)]


def build_config(plan, layer):
    """private/config.toml for a first import: the survey's own forge listings and the build
    defaults. Locators are the owner's to add; this file names none."""
    survey_rel = os.path.relpath(os.path.join(layer, "private", "curated", SURVEY_DIRNAME),
                                 os.path.realpath(os.environ.get("HOME", "/")))
    base = (HOME_REL + survey_rel) if not survey_rel.startswith("..") else os.path.join(
        layer, "private", "curated", SURVEY_DIRNAME)
    # No [kingdom].ref pin: an owner decision on the taxonomy authority picks the ref, and without
    # one the build reads the worktree. A seeded pin would contradict such a decision.
    plan.private["config.toml"] = {
        "kingdom": {},
        "roots": {"extra": []},
        "forge": {"owners": ["cambridgetcg"],
                  "listings": [base + "/gh-cambridgetcg.json", base + "/codeberg-zerone-dev.json"]},
        "locators": {},
        "tree": {"enabled": True},
        "retention": {"runs": 5},
        "declared": [
            {"id": "citizens-md", "label": "CITIZENS.md founding citizens", "value": 53, "source": "CITIZENS.md"},
            {"id": "roster-header", "label": "roster '~50 repos'", "value": 50, "source": "roster.conf"},
            {"id": "ecosystem-status", "label": "ECOSYSTEM-STATUS apps", "value": 14,
             "source": "business-ecosystem progress/ECOSYSTEM-STATUS.json"},
        ],
    }


# ── import: validate, then write ────────────────────────────────────────────────────────────

def _plain(value):
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_plain(v) for v in value]
    return value


def render(relpath, doc):
    """Serialized text of one planned file, re-parsed and compared before it may be written."""
    if isinstance(doc, str):
        return doc
    text = safety.toml_dumps(doc)
    try:
        back = tomllib.loads(text)
    except tomllib.TOMLDecodeError as exc:
        raise GuardError("%s does not re-parse: %s" % (relpath, exc)) from exc
    require(back == _plain(doc), "%s does not round-trip through TOML" % relpath)
    return text


def plan_import(survey_dir, layer_dir=None, home=None, alias_fn=local_alias, card_enums=None, seed=None):
    """Build and validate the whole import in memory. card_enums: the live CARD_ENUMS of the
    kingdom-os worktree (required: card hints and topic exclusion are checked against them, never
    against a copy). seed: load_seed() of the layer (read here when not given). Returns (plan,
    rendered {relpath: text})."""
    layer = os.path.realpath(layer_dir or safety.LAYER_DIR)
    home = os.path.realpath(home or os.environ.get("HOME", ""))
    nav = nav_values(card_enums)
    seed = load_seed(layer) if seed is None else seed
    survey = load_survey(survey_dir)
    plan = Plan()
    rows = build_tag_map(tag_uses(survey))
    problems = tag_map_problems(rows, card_enums)
    require(not problems, "tag map fails closure: " + "; ".join(problems[:20]))
    plan.committed["vocab/tag-map.tsv"] = tag_map_text(rows)
    index = tag_index(rows)
    families, private_rows, group_ids = build_projects(plan, survey, index, home, alias_fn, nav)
    seeded_groups = {row.get("id"): row for row in (seed.get("estate") or {}).get("group") or [] if isinstance(row, dict)}
    committed_groups, private_groups = build_groups(survey, seeded_groups)
    build_family_docs(plan, survey, families, committed_groups)
    known = {r["id"] for r in survey["projects"]}
    known |= {listing_id(r) for r in survey["listing_gh"] + survey["listing_codeberg"]} - {None}
    provider_rows, private_questions = build_estate_doc(plan, survey, known)
    carry_spheres(plan, existing_spheres(layer))
    build_decisions(plan, layer)
    plan.private["curated/projects.toml"] = {
        "meta": {"source": SOURCE, "as_of": AS_OF, "note": "per-record private knowledge; one copy only"},
        "project": sorted(private_rows, key=lambda r: r["id"])}
    build_private_estate(plan, survey, private_groups, provider_rows, private_questions, index, home, seed)
    build_config(plan, layer)
    rendered = {}
    findings = []
    for relpath, doc in sorted(plan.committed.items()):
        rendered[relpath] = render(relpath, doc)
        findings += lint_text(rendered[relpath], relpath, scope_of(relpath))
    require(not findings, "import output fails the privacy lint: %s" % json.dumps(findings[:10]))
    committed_ids = [p["id"] for f in plan.committed if f.startswith("curated/families/")
                     for p in plan.committed[f].get("project", [])]
    require(not any(i.startswith(LOCAL) for i in committed_ids), "a committed project id is local")
    for relpath, doc in sorted(plan.private.items()):
        rendered["private/" + relpath] = render(relpath, doc)
    plan.counts.update({"tag_rows": len(rows), "families": len(FAMILIES),
                        "groups_committed": sum(len(v) for v in committed_groups.values()),
                        "groups_private": sum(1 for g in private_groups if not g["committed"])})
    return plan, rendered


def import_survey(survey_dir=None, write=False, layer_dir=None, host=None, overwrite=False, home=None,
                  quiet=False, alias_fn=local_alias, card_enums=None, now=None):
    """Seed the committed curation, the tag map, the private curation and private/config.toml from
    the preserved survey copy (spec 6, step 0). Prints the diff of every committed file; writes
    only when write is True, and then only files that are absent unless overwrite is True.
    Private files are written through PrivateArea (0600, O_EXCL, preflight first). With overwrite,
    a private curation file is replaced only after its previous bytes are kept beside it as a new
    0400 backup; private/config.toml is the owner's input and is never replaced. Returns a report
    {committed: [...], private: [...], counts, queue}."""
    layer = os.path.realpath(layer_dir or safety.LAYER_DIR)
    survey_dir = survey_dir or os.path.join(layer, "private", "curated", SURVEY_DIRNAME)
    plan, rendered = plan_import(survey_dir, layer, home, alias_fn, card_enums)
    area = safety.PrivateArea(layer)
    if write:
        require(host is not None, "import-survey --write needs the host repository for the preflight")
        area.preflight(host)
    report = {"committed": [], "private": [], "counts": plan.counts, "queue": plan.queue}
    for relpath in sorted(p for p in rendered if not p.startswith("private/")):
        exists = os.path.lexists(os.path.join(layer, relpath))
        allowed = write and (overwrite or not exists)
        result = safety.write_committed(relpath, rendered[relpath], "import-survey", allowed, layer, quiet)
        status = "written" if result["written"] else ("unchanged" if not result["changed"]
                                                      else ("kept (differs)" if exists else "would write"))
        report["committed"].append({"path": relpath, "status": status})
    stamp = (now or safety.utc_now()).strftime("%Y%m%dT%H%M%SZ")
    for relpath in sorted(p for p in rendered if p.startswith("private/")):
        rel = relpath[len("private/"):]
        report["private"].append(dict(_write_private(area, rel, rendered[relpath], write, overwrite, stamp),
                                      path=relpath))
    if not quiet:
        for item in report["private"]:
            sys.stdout.write("%s: %s (%d bytes, contents not shown)%s\n"
                             % (item["path"], item["status"], len(rendered[item["path"]].encode("utf-8")),
                                ("; " + item["change"]) if item.get("change") else ""))
    return report


def _change_summary(old, new):
    """Lines added and removed, counted only: the private contents are never printed."""
    added = removed = 0
    for line in difflib.unified_diff(old.splitlines(), new.splitlines(), lineterm="", n=0):
        if line.startswith("+") and not line.startswith("+++"):
            added += 1
        elif line.startswith("-") and not line.startswith("---"):
            removed += 1
    return "%d lines added, %d removed" % (added, removed)


def _write_private(area, rel, text, write, overwrite, stamp, mode=0o600):
    """{status, change?, backup?} for one private file. config.toml is never replaced; a curated
    file is replaced only with overwrite, and only after its old bytes are kept in a new 0400
    <name>.bak-<stamp> beside it (O_EXCL, so an earlier backup is never overwritten either).
    mode is the new file's (0600, or 0400 for a file only an owner verb changes)."""
    path = area.path(rel)
    exists = os.path.lexists(path)
    if not write:
        return {"status": "would write" if not exists else "present (kept)"}
    if exists and (not overwrite or rel == "config.toml"):
        return {"status": "present (kept)" + ("; config.toml is the owner's and never replaced"
                                               if overwrite and rel == "config.toml" else "")}
    curated = rel.startswith("curated/")
    if curated:
        area.unlock_curated()
    try:
        if not exists:
            area.write(rel, text, mode=mode)
            return {"status": "written"}
        raw, reason = safety.read_checked(path, 64 << 20)
        require(raw is not None, "cannot back up %s before replacing it (%s)" % (rel, reason))
        old = raw.decode("utf-8", "replace")
        if old == text:
            return {"status": "unchanged"}
        backup = "%s.bak-%s" % (rel, stamp)
        area.write(backup, raw, mode=0o400)
        area.replace(rel, text, mode=mode)
        return {"status": "replaced", "change": "%s; previous copy kept as private/%s" % (_change_summary(old, text),
                                                                                         backup),
                "backup": "private/" + backup}
    finally:
        if curated:
            area.lock_curated()


def backup_stamp():
    """A backup name's stamp: the time plus a random suffix, so two writes in one second never meet
    on O_EXCL."""
    return safety.utc_now().strftime("%Y%m%dT%H%M%SZ") + "-" + os.urandom(2).hex()


def keep_private(area, rel, text, stamp=None, mode=0o600):
    """Write one private curation file the owner keeps (decisions --words-from and --private-from,
    sphere and hygiene --import, hygiene --set): created when absent, else replaced after its
    previous bytes are kept as a new 0400 backup beside it (stamp: backup_stamp() by default)."""
    require(rel.startswith("curated/") and rel != "curated/estate.toml" and rel != "curated/projects.toml",
            "keep_private writes owner files under curated/ other than the survey-derived ones: %s" % rel)
    return _write_private(area, rel, text, True, True, stamp or backup_stamp(), mode)


def private_modes(layer_dir=None):
    """{relpath: mode} of the private files the import writes, plus private/curated itself."""
    area = safety.PrivateArea(layer_dir)
    out = {}
    for rel in ("curated", "curated/projects.toml", "curated/estate.toml", "config.toml"):
        try:
            out[rel] = stat.S_IMODE(os.lstat(area.path(rel)).st_mode)
        except FileNotFoundError:
            out[rel] = None
    return out
