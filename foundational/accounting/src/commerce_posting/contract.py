"""Strict Python mirror of the commerce sale event contract, version 1.

The contract of record is the language-neutral JSON Schema in
shared/events/financial-events/schema/commerce-sale-events.v1.schema.json,
with the shared conformance cases beside it in conformance/commerce-sale-v1/.
Tests compare this mirror field by field with that schema and run every shared
case. The structure below is plain data, so no JSON Schema library is needed.
Cross-field rules S1-S6 and S8 are checked here; S7 needs the stored sale and
is checked by the flow; S9 is stated by the adapter; S10 is the replay digest.

Values are validated exactly as delivered and never normalized: timestamps stay
strings ending in Z, amounts stay integer minor units.
"""
import hashlib
import json
import re
import uuid
from datetime import date, datetime

# Equal to COMMERCE_EVENT_NAMESPACE in @ecosystem/contracts-financial and to the
# namespace of the shared conformance cases (a test compares them).
COMMERCE_EVENT_NAMESPACE = uuid.UUID("6f1d3c52-8a4e-4d7b-9c1e-2b5a7e9f0c31")
CONTRACT_VERSION = 1
SALE_RECORDED = "commerce.sale.recorded"
SALE_REFUNDED = "commerce.sale.refunded"
ENFORCED_RULES = ("S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S10")
ADAPTER_STATED_RULES = ("S9",)


class ContractError(ValueError):
    """A delivered event that does not satisfy contract version 1."""


def _ecma(pattern):
    # JSON Schema patterns are ECMA-262: an unflagged `$` matches only at the
    # very end, while Python's `$` also matches before a final newline.
    return re.compile(pattern[:-1] + r"\Z" if pattern.endswith("$") else pattern)


class Text:
    def __init__(self, pattern, *, max_length=None, format=None):
        self.pattern, self.max_length, self.format = pattern, max_length, format
        self.regex = _ecma(pattern)

    def check(self, value, path):
        if not isinstance(value, str):
            raise ContractError(f"{path}: expected a string")
        if self.max_length is not None and len(value) > self.max_length:
            raise ContractError(f"{path}: longer than {self.max_length} characters")
        if not self.regex.search(value):
            raise ContractError(f"{path}: does not match the contract pattern")
        if self.format == "date" and not _calendar_date(value):
            raise ContractError(f"{path}: not a calendar date")
        if self.format == "date-time" and not _utc_instant(value):
            raise ContractError(f"{path}: not an RFC 3339 UTC instant")

    def schema(self):
        return {"type": "string", "pattern": self.pattern,
                **({"maxLength": self.max_length} if self.max_length is not None else {}),
                **({"format": self.format} if self.format else {})}


class OneOf:
    def __init__(self, *values):
        self.values = values

    def check(self, value, path):
        if not isinstance(value, str) or value not in self.values:
            raise ContractError(f"{path}: not one of the contract values")

    def schema(self):
        return {"enum": list(self.values)}


class Const:
    def __init__(self, value):
        self.value = value

    def check(self, value, path):
        if type(value) is not type(self.value) or value != self.value:
            raise ContractError(f"{path}: must be {self.value!r}")

    def schema(self):
        return {"const": self.value}


class Integer:
    def __init__(self, minimum, maximum):
        self.minimum, self.maximum = minimum, maximum

    def check(self, value, path):
        # bool is an int subclass; floats never pass, even integral ones.
        if type(value) is not int:
            raise ContractError(f"{path}: expected an integer")
        if not self.minimum <= value <= self.maximum:
            raise ContractError(f"{path}: outside {self.minimum}..{self.maximum}")

    def schema(self):
        return {"type": "integer", "minimum": self.minimum, "maximum": self.maximum}


class Array:
    def __init__(self, item, *, min_items=0, max_items):
        self.item, self.min_items, self.max_items = item, min_items, max_items

    def check(self, value, path):
        if not isinstance(value, list):
            raise ContractError(f"{path}: expected an array")
        if not self.min_items <= len(value) <= self.max_items:
            raise ContractError(f"{path}: needs {self.min_items}..{self.max_items} items")
        for index, item in enumerate(value):
            self.item.check(item, f"{path}[{index}]")

    def schema(self):
        return {"type": "array", "items": self.item.schema(), "maxItems": self.max_items,
                **({"minItems": self.min_items} if self.min_items else {})}


class Obj:
    def __init__(self, required, optional=None):
        self.required, self.optional = required, optional or {}

    def check(self, value, path):
        if not isinstance(value, dict):
            raise ContractError(f"{path}: expected an object")
        unknown = sorted(set(value) - set(self.required) - set(self.optional))
        if unknown:
            raise ContractError(f"{path}: unknown field {unknown[0]}")
        missing = sorted(set(self.required) - set(value))
        if missing:
            raise ContractError(f"{path}: missing field {missing[0]}")
        for name, spec in {**self.required, **self.optional}.items():
            if name in value:
                spec.check(value[name], f"{path}.{name}")

    def schema(self):
        return {"type": "object", "additionalProperties": False, "required": sorted(self.required),
                "properties": {name: spec.schema() for name, spec in {**self.required, **self.optional}.items()}}


def _calendar_date(text):
    try:
        date.fromisoformat(text)
    except ValueError:
        return False
    return True


def _utc_instant(text):
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z", text):
        return False
    try:
        datetime.strptime(text[:19], "%Y-%m-%dT%H:%M:%S")
    except ValueError:
        return False
    return True


# $defs of the v1 JSON Schema, in the same order and with the same names.
UUID = Text("^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
UUID_V5 = Text("^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
INSTANT = Text(r"^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?Z$", format="date-time")
CALENDAR_DATE = Text("^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$", format="date")
CURRENCY_CODE = Text("^[A-Z]{3}$")
MINOR_UNITS = Integer(0, 100_000_000_000)
SIGNED_MINOR_UNITS = Integer(-100_000_000_000, 100_000_000_000)
REF = Text("^[A-Za-z0-9._:-]{1,64}$")
PROVIDER_NAMES = ("synthetic", "ebay", "stripe", "shopify_partner", "bank_statement", "manual")
IDEMPOTENCY_KEY = Text(r"^v1\|(synthetic|ebay|stripe|shopify_partner|bank_statement|manual)\|[A-Za-z0-9._:-]{1,64}\|[A-Za-z_]{1,40}\|[A-Za-z0-9._:/-]{1,128}$",
                       max_length=255)
METADATA = Obj({"correlationId": UUID,
                "source": Text(r"^commerce-intake/[a-z0-9-]{1,40}@[0-9]+\.[0-9]+\.[0-9]+$"),
                "timestamp": INSTANT},
               {"causationId": UUID, "userId": UUID, "tenantId": UUID})
EVIDENCE_CLASS = OneOf("synthetic", "recorded", "live")
BOOKS_OF = Obj({"entityId": UUID,
                "decisionRef": Text("^(dec-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]+|synthetic-[a-z0-9-]{1,40})$")})
CHANNEL = Obj({"kind": OneOf("marketplace", "storefront", "direct_b2b", "in_person"),
               "name": Text("^[a-z0-9-]{1,40}$")})
PROVIDER = Obj({"name": OneOf(*PROVIDER_NAMES), "accountRef": REF,
                "transactionType": Text("^[A-Za-z_]{1,40}$"),
                "transactionId": Text("^[A-Za-z0-9._:/-]{1,128}$")},
               {"orderRef": Text("^[A-Za-z0-9._:/-]{1,128}$")})
COUNTERPARTY = Obj({"kind": OneOf("consumer", "business", "unknown"), "country": Text("^[A-Z]{2}$")})
SALE_LINE = Obj({"lineRef": REF, "revenueClass": OneOf("goods", "shipping"),
                 "quantity": Integer(1, 100_000), "net": MINOR_UNITS, "tax": MINOR_UNITS,
                 "taxTreatment": OneOf("standard_rated", "reduced_rated", "zero_rated", "exempt", "outside_scope", "margin_scheme"),
                 "taxRateBp": Integer(0, 10_000),
                 "taxBasis": OneOf("source_stated", "derived_from_inclusive", "not_applicable")})
FEE = Obj({"feeRef": REF, "feeType": Text("^[A-Z0-9_]{1,40}$"), "net": MINOR_UNITS, "tax": MINOR_UNITS,
           "taxTreatment": OneOf("standard_rated", "exempt", "outside_scope", "reverse_charge")})
REFUND_LINE = Obj({"lineRef": REF, "net": MINOR_UNITS, "tax": MINOR_UNITS})
FEE_CREDIT = Obj({"feeRef": REF, "net": MINOR_UNITS, "tax": MINOR_UNITS})
SALE_RECORDED_PAYLOAD = Obj({
    "evidenceClass": EVIDENCE_CLASS, "booksOf": BOOKS_OF, "channel": CHANNEL, "provider": PROVIDER,
    "idempotencyKey": IDEMPOTENCY_KEY, "taxPointDate": CALENDAR_DATE, "currency": CURRENCY_CODE,
    "counterparty": COUNTERPARTY, "lines": Array(SALE_LINE, min_items=1, max_items=200),
    "fees": Array(FEE, max_items=50), "providerCollectedTax": MINOR_UNITS,
    "totals": Obj({"gross": MINOR_UNITS, "fees": MINOR_UNITS, "net": SIGNED_MINOR_UNITS}),
})
SALE_REFUNDED_PAYLOAD = Obj({
    "evidenceClass": EVIDENCE_CLASS, "booksOf": BOOKS_OF, "channel": CHANNEL, "provider": PROVIDER,
    "idempotencyKey": IDEMPOTENCY_KEY, "saleIdempotencyKey": IDEMPOTENCY_KEY,
    "taxPointDate": CALENDAR_DATE, "currency": CURRENCY_CODE,
    "reason": OneOf("return", "cancellation", "partial_refund", "goodwill", "other"),
    "lines": Array(REFUND_LINE, min_items=1, max_items=200), "feeCredits": Array(FEE_CREDIT, max_items=50),
    "providerCollectedTaxRefunded": MINOR_UNITS,
    "totals": Obj({"gross": MINOR_UNITS, "feeCredits": MINOR_UNITS, "net": SIGNED_MINOR_UNITS}),
})


def _event(event_type, payload):
    return Obj({"id": UUID_V5, "type": Const(event_type), "aggregateId": UUID_V5,
                "aggregateType": Const("Sale"), "version": Const(CONTRACT_VERSION),
                "occurredAt": INSTANT, "metadata": METADATA, "payload": payload})


EVENTS = {SALE_RECORDED: _event(SALE_RECORDED, SALE_RECORDED_PAYLOAD),
          SALE_REFUNDED: _event(SALE_REFUNDED, SALE_REFUNDED_PAYLOAD)}
TAX_FREE_TREATMENTS = frozenset({"zero_rated", "exempt", "outside_scope", "margin_scheme"})
TAX_FREE_FEE_TREATMENTS = frozenset({"exempt", "outside_scope"})


def event_id_for(idempotency_key):
    return str(uuid.uuid5(COMMERCE_EVENT_NAMESPACE, idempotency_key))


def aggregate_id_for(sale_key):
    return str(uuid.uuid5(COMMERCE_EVENT_NAMESPACE, "sale|" + sale_key))


def sale_key_of(event):
    payload = event["payload"]
    return payload["idempotencyKey"] if event["type"] == SALE_RECORDED else payload["saleIdempotencyKey"]


def canonical_json(value):
    # Sorted keys, no whitespace, UTF-8, integers only. Every contract string is
    # ASCII by pattern or enum, so this equals RFC 8785 output for valid events.
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")


def replay_digest(event):
    """S10: SHA-256 of canonical JSON of the raw values; metadata is trace data."""
    return hashlib.sha256(canonical_json({key: event[key] for key in ("type", "version", "aggregateId", "occurredAt", "payload")})).hexdigest()


def validate(event):
    """Raise ContractError unless event is a v1 commerce sale event (S7 aside)."""
    if not isinstance(event, dict):
        raise ContractError("event: expected an object")
    if event.get("type") not in EVENTS:
        raise ContractError("event.type: unsupported event type")
    if type(event.get("version")) is not int or event["version"] != CONTRACT_VERSION:
        raise ContractError("event.version: unsupported contract version")
    EVENTS[event["type"]].check(event, "event")
    payload, provider = event["payload"], event["payload"]["provider"]
    key = payload["idempotencyKey"]
    if event["id"] != event_id_for(key):
        raise ContractError("S1 id is not UUIDv5 of the idempotency key")
    if event["aggregateId"] != aggregate_id_for(sale_key_of(event)):
        raise ContractError("S2 aggregateId is not UUIDv5 of the sale key")
    if key != "|".join(("v1", provider["name"], provider["accountRef"], provider["transactionType"], provider["transactionId"])):
        raise ContractError("S3 idempotency key does not match the provider fields")
    lines = payload["lines"]
    if len({line["lineRef"] for line in lines}) != len(lines):
        raise ContractError("S6 lineRef values repeat")
    charges = payload["fees"] if event["type"] == SALE_RECORDED else payload["feeCredits"]
    if len({fee["feeRef"] for fee in charges}) != len(charges):
        raise ContractError("S6 feeRef values repeat")
    gross = sum(line["net"] + line["tax"] for line in lines)
    charged = sum(fee["net"] + fee["tax"] for fee in charges)
    rule, field = ("S4", "fees") if event["type"] == SALE_RECORDED else ("S5", "feeCredits")
    totals = payload["totals"]
    if (totals["gross"], totals[field], totals["net"]) != (gross, charged, gross - charged):
        raise ContractError(f"{rule} totals differ from the lines")
    if event["type"] == SALE_RECORDED:
        for index, line in enumerate(lines):
            if line["taxTreatment"] in TAX_FREE_TREATMENTS and line["tax"] != 0:
                raise ContractError(f"S8 event.payload.lines[{index}]: {line['taxTreatment']} line states tax")
            if (line["taxBasis"] == "not_applicable") != (line["tax"] == 0):
                raise ContractError(f"S8 event.payload.lines[{index}]: taxBasis not_applicable must match zero tax")
        for index, charge in enumerate(charges):
            if charge["taxTreatment"] in TAX_FREE_FEE_TREATMENTS and charge["tax"] != 0:
                raise ContractError(f"S8 event.payload.fees[{index}]: {charge['taxTreatment']} fee states tax")


def check_refund_against_sale(refund, sale):
    """S7 identity rules for a refund and its stored sale; caps are policy."""
    payload, sold = refund["payload"], sale["payload"]
    if sale["type"] != SALE_RECORDED:
        raise ContractError("S7 saleIdempotencyKey names an event that is not a sale")
    for name, ours, theirs in (("booksOf.entityId", payload["booksOf"]["entityId"], sold["booksOf"]["entityId"]),
                               ("currency", payload["currency"], sold["currency"]),
                               ("channel", payload["channel"], sold["channel"]),
                               ("provider.accountRef", payload["provider"]["accountRef"], sold["provider"]["accountRef"])):
        if ours != theirs:
            raise ContractError(f"S7 refund {name} differs from its sale")
    if not {line["lineRef"] for line in payload["lines"]} <= {line["lineRef"] for line in sold["lines"]}:
        raise ContractError("S7 refund names a lineRef its sale does not have")
    if not {fee["feeRef"] for fee in payload["feeCredits"]} <= {fee["feeRef"] for fee in sold["fees"]}:
        raise ContractError("S7 refund names a feeRef its sale does not have")
