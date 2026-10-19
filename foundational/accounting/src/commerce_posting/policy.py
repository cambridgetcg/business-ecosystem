"""Closed v1 activation policy. No ownership, channel or tax scheme is inferred.

Activation lives in code: posting another evidence class, set of books,
currency or tax treatment is a reviewed change to this file, never a setting.
Changing a decision here also changes what the integrity check re-derives from
stored evidence, so it needs a new database marker (storage.META_VERSION).
"""
from dataclasses import dataclass, field

from .contract import SALE_RECORDED

# entityId -> decisionRef of the books this consumer keeps. Synthetic only:
# no real entity is assigned until the owner records that decision.
BOOKS = {"00000000-0000-4000-8000-00000000b00c": "synthetic-books-lab"}
ACTIVATED_EVIDENCE_CLASSES = ("synthetic",)
CURRENCY, CURRENCY_EXPONENT = "GBP", 2
# One v1 tax policy for the books: tax is posted exactly as the source states
# it, for standard- and zero-rated sales only. Margin scheme, flat rate, reduced
# rate and reverse charge are refused rather than guessed.
TAX_POLICY = "source-stated/1"
POSTABLE_SALE_TREATMENTS = ("standard_rated", "zero_rated")
POSTABLE_FEE_TREATMENTS = ("standard_rated", "exempt", "outside_scope")
ACTOR = "commerce-posting-v1"
REASONS = ("not_our_books", "evidence_class_not_activated", "unsupported_currency_v1",
           "unsupported_treatment_v1", "refund_exceeds_sale", "zero_value")

# Synthetic chart of accounts. Clearing accounts are per channel (see clearing_account).
CLEARING_PREFIX = "syn-clearing-"
CHART = {
    "syn-sales-goods": "REVENUE",
    "syn-sales-shipping": "REVENUE",
    "syn-sales-refunds": "REVENUE",  # contra-revenue: debited by refunds
    "syn-selling-fees": "EXPENSE",
    "syn-tax-stated-on-sales": "LIABILITY",
    "syn-tax-on-fees": "ASSET",
}
PERIODS = {
    "syn-commerce-2026-09": {"year": 2026, "period_number": 9, "name": "SYNTHETIC September 2026",
                             "start_date": "2026-09-01", "end_date": "2026-09-30"},
    "syn-commerce-2026-10": {"year": 2026, "period_number": 10, "name": "SYNTHETIC October 2026",
                             "start_date": "2026-10-01", "end_date": "2026-10-31"},
}


def clearing_account(channel):
    return CLEARING_PREFIX + channel["name"]


def period_for(tax_point_date):
    # ISO dates order lexically, so no parsing is needed here.
    return next((period_id for period_id, period in PERIODS.items()
                 if period["start_date"] <= tax_point_date <= period["end_date"]), None)


@dataclass
class SaleState:
    """A stored sale and the refunds already offset against it."""
    event: dict
    outcome: str
    reason: str | None
    entry_id: str | None
    refunded: dict = field(default_factory=dict)   # lineRef -> [net, tax]
    credited: dict = field(default_factory=dict)   # feeRef -> [net, tax]

    def apply(self, refund):
        for line in refund["payload"]["lines"]:
            total = self.refunded.setdefault(line["lineRef"], [0, 0])
            total[0], total[1] = total[0] + line["net"], total[1] + line["tax"]
        for fee in refund["payload"]["feeCredits"]:
            total = self.credited.setdefault(fee["feeRef"], [0, 0])
            total[0], total[1] = total[0] + fee["net"], total[1] + fee["tax"]


def refusal(event, sale=None):
    """Return the refusal reason for a contract-valid event, or None to post it.

    Checks run in a fixed order so a reason is reproducible: books, evidence
    class, currency, then treatment (sales) or the sale's own refusal and the
    refund caps (refunds), then zero value. `sale` is required for a refund.
    """
    payload = event["payload"]
    books = payload["booksOf"]
    if BOOKS.get(books["entityId"]) != books["decisionRef"]:
        return "not_our_books"
    if payload["evidenceClass"] not in ACTIVATED_EVIDENCE_CLASSES:
        return "evidence_class_not_activated"
    if payload["currency"] != CURRENCY:
        return "unsupported_currency_v1"
    if event["type"] == SALE_RECORDED:
        if any(line["taxTreatment"] not in POSTABLE_SALE_TREATMENTS for line in payload["lines"]):
            return "unsupported_treatment_v1"
        # Fee tax is posted only for standard-rated fees.
        if any(fee["taxTreatment"] not in POSTABLE_FEE_TREATMENTS or (fee["taxTreatment"] != "standard_rated" and fee["tax"])
               for fee in payload["fees"]):
            return "unsupported_treatment_v1"
        charges = payload["fees"]
    else:
        if sale.outcome == "refused":
            return sale.reason  # A refund of a refused sale inherits its refusal.
        sold = sale.event["payload"]
        for items, ref, limits, done in ((payload["lines"], "lineRef", sold["lines"], sale.refunded),
                                         (payload["feeCredits"], "feeRef", sold["fees"], sale.credited)):
            limit = {item[ref]: item for item in limits}
            for item in items:
                net, tax = done.get(item[ref], (0, 0))
                if net + item["net"] > limit[item[ref]]["net"] or tax + item["tax"] > limit[item[ref]]["tax"]:
                    return "refund_exceeds_sale"
        charges = payload["feeCredits"]
    if not any(item["net"] or item["tax"] for item in payload["lines"] + charges):
        return "zero_value"
    return None
