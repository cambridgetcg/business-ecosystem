"""Closed synthetic fixture policy. No ownership is inferred or authenticated."""
import re
from datetime import date
from decimal import Decimal

CONTEXT = {
    "entity_id": "synthetic-entity-lab", "project_id": "synthetic-project-ledger",
    "owner_id": "synthetic-owner-lab", "period_id": "syn-period-lab-2026-09",
    "debit_account_id": "syn-expense-lab", "credit_account_id": "syn-cash-lab",
}
PAYMENT_FIELDS = set(CONTEXT) | {"schema", "operation_id", "synthetic", "direction", "counterparty_id", "currency", "amount", "date", "description", "decision"}


def validate_request(request):
    reversal = isinstance(request, dict) and request.get("schema") == "synthetic-reversal/1"
    fields = {"schema", "operation_id", "synthetic", "entity_id", "project_id", "owner_id", "date", "description", "decision", "original_entry_id"} if reversal else PAYMENT_FIELDS
    if not isinstance(request, dict) or set(request) != fields:
        raise ValueError("malformed request fields")
    if request["synthetic"] is not True:
        raise ValueError("synthetic must be true")
    for key, expected in CONTEXT.items():
        if key in fields and request[key] != expected:
            raise ValueError(f"unknown or out-of-scope {key}")
    for key, expected in {"schema": "synthetic-payment/1", "direction": "outbound", "counterparty_id": "synthetic-supplier-paper", "currency": "GBP"}.items():
        if not reversal and request[key] != expected:
            raise ValueError(f"unsupported {key}")
    operation = request["operation_id"]
    if not isinstance(operation, str) or not re.fullmatch(r"synthetic-[a-z0-9-]{1,64}", operation):
        raise ValueError("invalid synthetic operation_id")
    if reversal and (not isinstance(request["original_entry_id"], str) or not request["original_entry_id"]):
        raise ValueError("original_entry_id required")
    if not reversal:
        amount = request["amount"]
        if not isinstance(amount, str) or not re.fullmatch(r"(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,4})?", amount):
            raise ValueError("amount must be a finite fixed-point decimal string with at most four places")
        decimal = Decimal(amount)
        if not decimal.is_finite() or not Decimal("0") < decimal <= Decimal("1000000"):
            raise ValueError("amount must be positive and at most 1000000")
    day = request["date"]
    if not isinstance(day, str) or not re.fullmatch(r"2026-09-[0-9]{2}", day):
        raise ValueError("date outside synthetic period")
    date.fromisoformat(day)
    description = request["description"]
    if not isinstance(description, str) or not description.startswith("SYNTHETIC ") or len(description) > 500:
        raise ValueError("description must be explicitly SYNTHETIC (max 500 chars)")
    decision = request["decision"]
    if not isinstance(decision, dict) or set(decision) != {"action", "actor", "reason", "simulated"}:
        raise ValueError("explicit decision, actor, reason and simulated marker required")
    if decision["action"] not in ("approve", "refuse") or decision["simulated"] is not True:
        raise ValueError("decision must explicitly approve or refuse; simulated must be true")
    if decision["actor"] not in ("synthetic-reviewer", "synthetic-auditor"):
        raise ValueError("unknown simulated actor")
    if not isinstance(decision["reason"], str) or not decision["reason"].strip() or len(decision["reason"]) > 500:
        raise ValueError("nonempty decision reason required (max 500 chars)")
    # JSON accepts escaped lone surrogates; UTF-8 exports and SQLite text do not.
    # Validate the unrestricted text without repairing or normalizing evidence.
    for text in (description, decision["reason"], request.get("original_entry_id", "")):
        try:
            text.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise ValueError("request text must contain valid Unicode scalar values") from exc
