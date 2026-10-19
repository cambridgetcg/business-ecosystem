"""Posting rules: one balanced set of journal lines per postable event.

Amounts are the event's own integer minor units, summed per account and
never recomputed from rates. Zero lines are omitted because the domain
refuses non-positive amounts. Provider-collected tax is never posted.
"""
from decimal import Decimal

from src.domain.general_ledger.models.journal_entry_line import EntryType

from .contract import SALE_RECORDED
from .policy import CURRENCY_EXPONENT, clearing_account

DEBIT, CREDIT = EntryType.DEBIT, EntryType.CREDIT


def amount(minor_units):
    return Decimal(minor_units).scaleb(-CURRENCY_EXPONENT)


def posting_lines(event):
    """Return [(account_id, EntryType, minor units)] in a fixed account order."""
    payload = event["payload"]
    clearing = clearing_account(payload["channel"])
    net = payload["totals"]["net"]
    if event["type"] == SALE_RECORDED:
        lines, fees = payload["lines"], payload["fees"]
        rows = [(clearing, DEBIT if net >= 0 else CREDIT, abs(net)),
                ("syn-selling-fees", DEBIT, sum(fee["net"] for fee in fees)),
                ("syn-tax-on-fees", DEBIT, sum(fee["tax"] for fee in fees)),
                ("syn-sales-goods", CREDIT, sum(line["net"] for line in lines if line["revenueClass"] == "goods")),
                ("syn-sales-shipping", CREDIT, sum(line["net"] for line in lines if line["revenueClass"] == "shipping")),
                ("syn-tax-stated-on-sales", CREDIT, sum(line["tax"] for line in lines))]
    else:
        lines, credits = payload["lines"], payload["feeCredits"]
        rows = [("syn-sales-refunds", DEBIT, sum(line["net"] for line in lines)),
                ("syn-tax-stated-on-sales", DEBIT, sum(line["tax"] for line in lines)),
                (clearing, CREDIT if net >= 0 else DEBIT, abs(net)),
                ("syn-selling-fees", CREDIT, sum(credit["net"] for credit in credits)),
                ("syn-tax-on-fees", CREDIT, sum(credit["tax"] for credit in credits))]
    return [row for row in rows if row[2]]
