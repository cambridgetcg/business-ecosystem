"""Read-only, independently checked projection of the persisted evidence and ledger."""
import hashlib
import json
import string
from decimal import Decimal

from src.domain.general_ledger.validators.balance_validator import BalanceValidator

from .policy import CONTEXT, validate_request
from .storage import canonical, hydrate_entry, money


def require(condition, explanation):
    if not condition:
        raise ValueError("evidence integrity: " + explanation)


def build_report(connection):
    require(not connection.execute("PRAGMA foreign_key_check").fetchall(), "foreign key mismatch")
    require(connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "SQLite integrity check")
    scope = CONTEXT["entity_id"] + "/" + CONTEXT["project_id"]
    contexts = [dict(row) for row in connection.execute("SELECT * FROM context ORDER BY scope")]
    for context in contexts:
        require(context["scope"] == scope, "unknown scope")
        document = json.loads(context["document"])
        require(document == {**{key: CONTEXT[key] for key in ("entity_id", "project_id", "owner_id")}, "synthetic": True}, "context mismatch")
    accounts = [dict(row) for row in connection.execute("SELECT * FROM accounts ORDER BY id")]
    periods = [{**dict(row), "document": json.loads(row["document"])} for row in connection.execute("SELECT * FROM periods ORDER BY id")]
    entries = []
    for row in connection.execute("SELECT * FROM ledger_entries ORDER BY rowid"):
        document = json.loads(row["document"])
        require(row["reversal_of_id"] == document["reversal_of_id"], "SQL/JSON reversal link mismatch")
        entries.append({**document, "scope": row["scope"], "operation_id": row["operation_id"]})
    evidence = [{**dict(row), "request": json.loads(row["request"])} for row in connection.execute("SELECT * FROM evidence ORDER BY seq")]
    by_id = {entry["id"]: entry for entry in entries}
    by_operation = {item["operation_id"]: item for item in evidence}
    expected_balances = {account["id"]: Decimal("0") for account in accounts}
    expected_periods = {period["id"]: [Decimal("0"), Decimal("0"), 0] for period in periods}
    for account in accounts:
        require(account["scope"] == scope and account["id"] in (CONTEXT["debit_account_id"], CONTEXT["credit_account_id"]), "account scope")
    for item in evidence:
        validate_request(item["request"])
        require(item["scope"] == scope and item["operation_id"] == item["request"]["operation_id"], "evidence scope/identity")
        refused = item["request"]["decision"]["action"] == "refuse"
        require((item["entry_id"] is None) == refused, "decision/entry mismatch")
        require(item["outcome"] == ("refused" if refused else "reversed" if item["request"]["schema"] == "synthetic-reversal/1" else "posted"), "decision/outcome mismatch")
        require(refused or item["entry_id"] in by_id, "missing journal entry")
    validator = BalanceValidator()
    reversed_originals = set()
    for document in entries:
        require(document["scope"] == scope, "entry scope")
        item = by_operation.get(document["operation_id"])
        require(item is not None and item["entry_id"] == document["id"], "missing matching evidence")
        entry = hydrate_entry({key: value for key, value in document.items() if key not in ("scope", "operation_id")})
        require(entry.is_posted and entry.currency_code == "GBP", "entry status/currency")
        require(all(line.amount.is_finite() and line.amount > 0 for line in entry.lines), "nonfinite or nonpositive amount")
        validator.validate_entry_complete(entry)
        debits, credits = entry.calculate_totals()
        require(debits == credits == entry.total_debits == entry.total_credits, "journal totals")
        require(entry.fiscal_period_id in expected_periods, "period scope")
        require(entry.posted_by == item["request"]["decision"]["actor"] and entry.entry_date.isoformat() == item["request"]["date"], "actor/date mismatch")
        if entry.is_reversal:
            require(entry.reversal_of_id not in reversed_originals, "duplicate reversal of original")
            reversed_originals.add(entry.reversal_of_id)
            original = by_id.get(entry.reversal_of_id)
            require(original is not None and original["reversal_of_id"] is None, "invalid reversal link")
            require(item["request"].get("original_entry_id") == original["id"], "reversal request link")
            original_entry = hydrate_entry({key: value for key, value in original.items() if key not in ("scope", "operation_id")})
            expected_lines = [(line.account_id, line.entry_type.opposite, line.amount) for line in original_entry.lines]
        else:
            request = item["request"]
            from src.domain.general_ledger.models.journal_entry_line import EntryType
            expected_lines = [(request["debit_account_id"], EntryType.DEBIT, Decimal(request["amount"])), (request["credit_account_id"], EntryType.CREDIT, Decimal(request["amount"]))]
        require([(line.account_id, line.entry_type, line.amount) for line in entry.lines] == expected_lines, "proposal/ledger lines mismatch")
        for line in entry.lines:
            require(line.account_id in expected_balances, "line account scope")
            expected_balances[line.account_id] += line.signed_amount
        totals = expected_periods[entry.fiscal_period_id]
        totals[0] += debits
        totals[1] += credits
        totals[2] += 1
    for account in accounts:
        actual = Decimal(account["balance"])
        require(actual.is_finite() and actual == expected_balances[account["id"]], "account balance mismatch")
    for period in periods:
        require(period["scope"] == scope and period["id"] == CONTEXT["period_id"], "period scope")
        document = period["document"]
        require([Decimal(document["total_debits"]), Decimal(document["total_credits"]), document["entry_count"]] == expected_periods[period["id"]], "period totals mismatch")
    trial = validator.calculate_trial_balance({key: (value, "DEBIT") for key, value in expected_balances.items()})
    require(trial.is_balanced, "trial balance mismatch")
    report = {
        "schema": "payment-evidence-report/1", "synthetic": True,
        "authentication": "simulated actors; not authentication",
        "posting_engine": "src.domain.general_ledger.services.posting_service.PostingService",
        "contexts": [json.loads(row["document"]) for row in contexts],
        "entries": entries, "evidence": evidence, "accounts": accounts, "periods": periods,
        "balances": {row["id"]: row["balance"] for row in accounts},
        "validation": {"balanced": True, "evidence_matches_ledger": True,
                       "balances_match_lines": True, "periods_match_entries": True,
                       "trial_debits": money(trial.total_debit_balances), "trial_credits": money(trial.total_credit_balances)},
    }
    report["record_digest"] = hashlib.sha256(canonical(report).encode()).hexdigest()
    return report


def _prose(text):
    # Character references display punctuation without letting Markdown/HTML
    # reinterpret it. Make control characters and line breaks visible as text.
    visible = "".join(char if char.isprintable() else ascii(char)[1:-1] for char in text)
    return "".join(f"&#{ord(char)};" if char in string.punctuation else char for char in visible)


def human_report(report):
    lines = ["# Synthetic payment evidence", "", "OFFLINE DEMONSTRATION ONLY — simulated actors; not authentication.",
             "No bank execution, customer data, runtime adapter, or production readiness is claimed.", "",
             f"Persisted-record SHA-256: `{report['record_digest']}`", ""]
    for context in report["contexts"]:
        lines.append(f"Entity: {context['entity_id']}; project: {context['project_id']}; explicitly assigned synthetic owner: {context['owner_id']}.")
    lines.extend(["", "## Decisions and ledger effects"])
    for item in report["evidence"]:
        decision = item["request"]["decision"]
        lines.append(f"- {item['operation_id']}: **{item['outcome']}**; {decision['action']} by {decision['actor']}. Reason: {_prose(decision['reason'])}. Entry: {item['entry_id'] or 'none'}.")
    for entry in report["entries"]:
        lines.append(f"- Entry {entry['id']} ({entry['entry_number']}): debits {entry['total_debits']} = credits {entry['total_credits']} {entry['currency_code']}; reversal of {entry['reversal_of_id'] or 'none'}.")
    lines.extend(["", "## Closing balances (debit-positive)"])
    lines.extend(f"- {key}: {value} GBP" for key, value in report["balances"].items())
    lines.extend(["", "Validated using the real BalanceValidator; balances and period totals reconcile to persisted lines. Original entries are retained; compensating entries are linked, not destructive edits.",
                  "", "## Exact machine-readable projection", "", "```json", json.dumps(report, indent=2, sort_keys=True, allow_nan=False), "```", ""])
    return "\n".join(lines)
