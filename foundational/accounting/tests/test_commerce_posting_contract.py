"""The Python contract mirror against the shared contract of record and its conformance cases.

The JSON Schema and CASES.json live in shared/events/financial-events, where the
TypeScript tests run the same cases with zod and ajv. This module also holds the
synthetic event builders that the other commerce tests import.
"""
import copy
import importlib
import json
import re
import uuid
from pathlib import Path

import pytest

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "commerce_posting"
GOLDEN = FIXTURES / "golden-synthetic-2026-09-10.ndjson"
SELLER = "synthetic-seller-lab"
BOOKS_OF = {"entityId": "00000000-0000-4000-8000-00000000b00c", "decisionRef": "synthetic-books-lab"}
CHANNEL = {"kind": "marketplace", "name": "synthetic-market"}
SHARED_CONTRACT = Path(__file__).resolve().parents[3] / "shared" / "events" / "financial-events"
SCHEMA = SHARED_CONTRACT / "schema" / "commerce-sale-events.v1.schema.json"
CASES = SHARED_CONTRACT / "conformance" / "commerce-sale-v1" / "CASES.json"
ANNOTATIONS = {"description", "$id", "$schema", "title", "x-semantic-rules"}


def contract():
    return importlib.import_module("src.commerce_posting.contract")


def line(ref, revenue_class, net, tax, treatment="standard_rated", *, quantity=1, rate=None, basis=None):
    return {"lineRef": ref, "revenueClass": revenue_class, "quantity": quantity, "net": net, "tax": tax,
            "taxTreatment": treatment, "taxRateBp": (2000 if treatment == "standard_rated" else 0) if rate is None else rate,
            "taxBasis": basis or ("derived_from_inclusive" if tax else "not_applicable")}


def fee(ref, net, tax, treatment="standard_rated", fee_type="FINAL_VALUE_FEE"):
    return {"feeRef": ref, "feeType": fee_type, "net": net, "tax": tax, "taxTreatment": treatment}


def part(ref, net, tax, name="lineRef"):
    return {name: ref, "net": net, "tax": tax}


def _envelope(event_type, key, sale_key, occurred_at, payload, causation=None):
    c = contract()
    metadata = {"correlationId": c.event_id_for(sale_key), "source": "commerce-intake/fixture@0.1.0",
                "timestamp": "2026-10-18T12:00:00Z"}
    if causation:
        metadata["causationId"] = causation
    return {"id": c.event_id_for(key), "type": event_type, "aggregateId": c.aggregate_id_for(sale_key),
            "aggregateType": "Sale", "version": 1, "occurredAt": occurred_at, "metadata": metadata, "payload": payload}


def sale(transaction_id, tax_point_date, items, charges=(), *, occurred_at=None, country="GB", **changes):
    """A contract-valid synthetic sale; `changes` replace payload fields before ids and totals are derived."""
    payload = {"evidenceClass": "synthetic", "booksOf": dict(BOOKS_OF), "channel": dict(CHANNEL),
               "provider": {"name": "synthetic", "accountRef": SELLER, "transactionType": "SALE",
                            "transactionId": transaction_id, "orderRef": "syn-order-" + transaction_id.rsplit("-", 1)[-1]},
               "taxPointDate": tax_point_date, "currency": "GBP", "counterparty": {"kind": "consumer", "country": country},
               "lines": list(items), "fees": list(charges), "providerCollectedTax": 0}
    payload.update(changes)
    gross = sum(item["net"] + item["tax"] for item in payload["lines"])
    charged = sum(item["net"] + item["tax"] for item in payload["fees"])
    payload["totals"] = {"gross": gross, "fees": charged, "net": gross - charged}
    provider = payload["provider"]
    key = "|".join(("v1", provider["name"], provider["accountRef"], provider["transactionType"], provider["transactionId"]))
    payload = {"idempotencyKey": key, **payload}
    return _envelope("commerce.sale.recorded", key, key, occurred_at or tax_point_date + "T10:00:00Z", payload)


def refund(transaction_id, of_sale, tax_point_date, items, credits=(), *, reason="return", occurred_at=None, **changes):
    """A refund of `of_sale`; items and credits are (ref, net, tax) tuples."""
    sold = of_sale["payload"]
    payload = {"evidenceClass": sold["evidenceClass"], "booksOf": dict(sold["booksOf"]), "channel": dict(sold["channel"]),
               "provider": {**sold["provider"], "transactionType": "REFUND", "transactionId": transaction_id},
               "saleIdempotencyKey": sold["idempotencyKey"], "taxPointDate": tax_point_date, "currency": sold["currency"],
               "reason": reason, "lines": [part(*item) for item in items],
               "feeCredits": [part(*item, name="feeRef") for item in credits], "providerCollectedTaxRefunded": 0}
    payload.update(changes)
    gross = sum(item["net"] + item["tax"] for item in payload["lines"])
    credited = sum(item["net"] + item["tax"] for item in payload["feeCredits"])
    payload["totals"] = {"gross": gross, "feeCredits": credited, "net": gross - credited}
    provider = payload["provider"]
    key = "|".join(("v1", provider["name"], provider["accountRef"], provider["transactionType"], provider["transactionId"]))
    payload = {"idempotencyKey": key, **payload}
    return _envelope("commerce.sale.refunded", key, payload["saleIdempotencyKey"],
                     occurred_at or tax_point_date + "T09:00:00Z", payload, causation=of_sale["id"])


def golden_events():
    """The seven synthetic September-October 2026 transactions of the wire spike, in delivery order."""
    t1 = sale("syn-sale-t1", "2026-09-14", [line("L1", "goods", 2000, 400, quantity=2), line("S1", "shipping", 300, 60)],
              [fee("F1", 275, 55)], occurred_at="2026-09-14T10:15:00Z")
    t3 = refund("syn-refund-t3", t1, "2026-09-20", [("L1", 1000, 200)], [("F1", 100, 20)], reason="partial_refund")
    t2 = sale("syn-sale-t2", "2026-09-21", [line("L1", "goods", 5000, 0, "zero_rated"), line("S1", "shipping", 800, 0, "zero_rated")],
              [fee("F1", 500, 100)], country="US")
    t5 = sale("syn-sale-t5", "2026-09-25", [line("L1", "goods", 900, 0, "margin_scheme")])
    # 23:30Z on 30 September is 00:30 BST on 1 October: the adapter states the UK tax point (S9).
    t4 = sale("syn-sale-t4", "2026-10-01", [line("L1", "goods", 500, 100)], occurred_at="2026-09-30T23:30:00Z")
    t6 = refund("syn-refund-t6", t1, "2026-10-03", [("L1", 1000, 200), ("S1", 300, 60)])
    t7 = refund("syn-refund-t7", t2, "2026-10-04", [("L1", 6000, 0)])
    return [t1, t3, t2, t5, t4, t6, t7]


def test_golden_fixture_file_is_exactly_the_builders_output():
    expected = b"".join(contract().canonical_json(event) + b"\n" for event in golden_events())
    assert GOLDEN.read_bytes() == expected


def _inline(node, defs):
    if isinstance(node, dict):
        if "$ref" in node:
            return {**_inline(defs[node["$ref"].rsplit("/", 1)[1]], defs),
                    **_inline({key: value for key, value in node.items() if key != "$ref"}, defs)}
        return {key: _inline(value, defs) for key, value in node.items() if key not in ANNOTATIONS}
    if isinstance(node, list):
        return [_inline(item, defs) for item in node]
    return node


def _sorted_required(node):
    if isinstance(node, dict):
        return {key: sorted(value) if key == "required" else _sorted_required(value) for key, value in node.items()}
    if isinstance(node, list):
        return [_sorted_required(item) for item in node]
    return node


def _flatten_event(definition, defs):
    # Each event is allOf[envelope] + its own type/payload + unevaluatedProperties:false.
    variant = _inline(definition, defs)
    (envelope,) = variant.pop("allOf")
    assert variant.pop("unevaluatedProperties") is False
    return {"type": "object", "additionalProperties": False,
            "required": sorted(set(envelope["required"]) | set(variant["required"])),
            "properties": {**envelope["properties"], **variant["properties"]}}


@pytest.mark.parametrize("event_type,definition", [("commerce.sale.recorded", "saleRecordedEvent"),
                                                   ("commerce.sale.refunded", "saleRefundedEvent")])
def test_python_mirror_matches_the_schema_field_by_field(event_type, definition):
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["oneOf"] == [{"$ref": "#/$defs/saleRecordedEvent"}, {"$ref": "#/$defs/saleRefundedEvent"}]
    expected = _sorted_required(_flatten_event(schema["$defs"][definition], schema["$defs"]))
    assert _sorted_required(contract().EVENTS[event_type].schema()) == expected


def test_every_semantic_rule_is_enforced_or_stated_by_the_adapter():
    rules = [rule.split()[0] for rule in json.loads(SCHEMA.read_text(encoding="utf-8"))["x-semantic-rules"]]
    assert sorted(rules) == sorted(contract().ENFORCED_RULES + contract().ADAPTER_STATED_RULES)


def _cases():
    return json.loads(CASES.read_text(encoding="utf-8"))


def _shared_event(name):
    return copy.deepcopy(next(case["event"] for case in _cases()["valid"] if case["name"] == name))


def _patched(document, patch):
    """RFC 6902 add, replace and remove as the shared cases use them; the path '' replaces the document."""
    document = copy.deepcopy(document)
    for operation in patch:
        op, value = operation["op"], copy.deepcopy(operation.get("value"))
        if operation["path"] == "":
            document = value
            continue
        *parents, last = operation["path"][1:].split("/")
        target = document
        for part in parents:
            target = target[int(part)] if isinstance(target, list) else target[part]
        if isinstance(target, list):
            index = int(last)
            if op == "add":
                target.insert(index, value)
            elif op == "replace":
                target[index] = value
            else:
                del target[index]
        elif op == "remove":
            del target[last]
        else:
            assert (last in target) == (op == "replace"), operation
            target[last] = value
    return document


def _named(cases):
    return pytest.mark.parametrize("case", cases, ids=[case["name"] for case in cases])


def test_shared_cases_use_this_namespace_and_schema():
    cases = _cases()
    assert cases["namespace"] == str(contract().COMMERCE_EVENT_NAMESPACE)
    assert (CASES.parent / cases["schema"]).resolve() == SCHEMA.resolve()


@_named(_cases()["valid"])
def test_shared_valid_cases_hold_with_their_ids_and_replay_digest(case):
    c = contract()
    event = case["event"]
    c.validate(event)
    assert event["id"] == c.event_id_for(event["payload"]["idempotencyKey"])
    assert event["aggregateId"] == c.aggregate_id_for(c.sale_key_of(event))
    assert c.replay_digest(event) == case["replayDigest"]


@_named(_cases()["invalid"])
def test_shared_invalid_cases_are_contract_errors_naming_their_rule(case):
    event = _patched(_shared_event(case["base"]), case["patch"])
    with pytest.raises(contract().ContractError) as raised:
        contract().validate(event)
    if case["rule"] == "schema":
        assert not re.match(r"S[0-9]+ ", str(raised.value))
    else:
        assert str(raised.value).startswith(case["rule"] + " ")


@_named(_cases()["refundAgainstSale"])
def test_shared_refund_against_sale_cases(case):
    refund_event = _patched(_shared_event(case["refund"]), case["patch"])
    if case["rule"] is None:
        contract().check_refund_against_sale(refund_event, _shared_event(case["sale"]))
    else:
        with pytest.raises(contract().ContractError, match="^" + case["rule"] + " "):
            contract().check_refund_against_sale(refund_event, _shared_event(case["sale"]))


@_named(_cases()["uuidV5"])
def test_shared_uuid_v5_vectors(case):
    assert str(uuid.uuid5(contract().COMMERCE_EVENT_NAMESPACE, case["name"])) == case["uuid"]


def test_golden_fixture_is_the_shared_golden_cases_in_delivery_order():
    golden = [case["event"] for case in _cases()["valid"] if case["name"].startswith("golden-")]
    assert [json.loads(line) for line in GOLDEN.read_text(encoding="utf-8").splitlines()] == golden == golden_events()


def test_replay_digest_covers_raw_values_but_not_metadata():
    c = contract()
    event = golden_events()[0]
    traced = copy.deepcopy(event)
    traced["metadata"].update(timestamp="2027-01-01T00:00:00Z", userId="00000000-0000-4000-8000-000000000001")
    assert c.replay_digest(traced) == c.replay_digest(event)
    # A parser that re-serializes dates (zod coerce.date) would add milliseconds:
    # still a valid instant, but different raw bytes and so a different digest.
    coerced = copy.deepcopy(event)
    coerced["occurredAt"] = "2026-09-14T10:15:00.000Z"
    c.validate(coerced)
    assert c.replay_digest(coerced) != c.replay_digest(event)


def _sale():
    return golden_events()[0]


def _refund():
    return golden_events()[1]


def _set(path, value):
    def change(event):
        target = event
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value
    return change


def _delete(path):
    def change(event):
        target = event
        for key in path[:-1]:
            target = target[key]
        del target[path[-1]]
    return change


@pytest.mark.parametrize("base,change,message", [
    (_sale, _set(("payload", "lines", 0, "net"), 20.5), "expected an integer"),
    (_sale, _set(("payload", "lines", 0, "net"), 2000.0), "expected an integer"),
    (_sale, _set(("payload", "lines", 0, "net"), True), "expected an integer"),
    (_sale, _set(("payload", "lines", 0, "tax"), -1), "outside"),
    (_sale, _set(("payload", "buyerEmail"), "x@example.com"), "unknown field buyerEmail"),
    (_sale, _set(("payload", "counterparty", "name"), "A Buyer"), "unknown field name"),
    (_sale, _set(("extra",), 1), "unknown field extra"),
    (_sale, _set(("metadata", "note"), "free text"), "unknown field note"),
    (_sale, _delete(("payload", "booksOf")), "missing field booksOf"),
    (_sale, _set(("payload", "idempotencyKey"), "ebay-123"), "does not match"),
    (_sale, _set(("id",), "3713bbb9-cc52-4770-b89a-1f0a788245b8"), "does not match"),
    (_sale, _set(("occurredAt",), "2026-09-14T10:15:00+01:00"), "does not match"),
    (_sale, _set(("occurredAt",), "2026-09-14T10:15:00z"), "does not match"),
    (_sale, _set(("occurredAt",), "2026-09-14T10:15:00Z\n"), "does not match"),
    (_sale, _set(("occurredAt",), "2026-09-14 10:15:00Z"), "does not match"),
    (_sale, _set(("occurredAt",), "2026-09-14T25:15:00Z"), "does not match"),
    (_sale, _set(("occurredAt",), "2026-02-30T10:15:00Z"), "RFC 3339"),
    (_sale, _set(("payload", "taxPointDate"), "2026-02-30"), "calendar date"),
    (_sale, _set(("payload", "currency"), "gbp"), "does not match"),
    (_sale, _set(("payload", "provider", "name"), "paypal"), "not one of"),
    (_sale, _set(("payload", "lines"), []), "needs 1..200 items"),
    (_sale, _set(("aggregateType",), "Order"), "must be 'Sale'"),
    (_sale, _set(("version",), 2), "unsupported contract version"),
    (_sale, _set(("version",), True), "unsupported contract version"),
    (_sale, _set(("version",), "1"), "unsupported contract version"),
    (_sale, _set(("type",), "commerce.sale.disputed"), "unsupported event type"),
    (_refund, _set(("type",), "commerce.sale.recorded"), "unknown field"),
    (_sale, _set(("id",), golden_events()[2]["id"]), "S1"),
    (_sale, _set(("aggregateId",), golden_events()[2]["aggregateId"]), "S2"),
    (_refund, _set(("aggregateId",), golden_events()[2]["aggregateId"]), "S2"),
    (_sale, _set(("payload", "provider", "transactionId"), "syn-sale-other"), "S3"),
    (_sale, _set(("payload", "totals", "gross"), 2761), "S4"),
    (_sale, _set(("payload", "totals", "net"), 2431), "S4"),
    (_refund, _set(("payload", "totals", "feeCredits"), 0), "S5"),
])
def test_contract_violations_are_errors(base, change, message):
    event = copy.deepcopy(base())
    change(event)
    with pytest.raises(contract().ContractError, match=message):
        contract().validate(event)


@pytest.mark.parametrize("event,message", [
    (lambda: sale("syn-sale-dup", "2026-09-10", [line("L1", "goods", 100, 20), line("L1", "shipping", 100, 20)]), "S6 lineRef"),
    (lambda: sale("syn-sale-dup", "2026-09-10", [line("L1", "goods", 100, 20)], [fee("F1", 10, 2), fee("F1", 10, 2)]), "S6 feeRef"),
    (lambda: refund("syn-refund-dup", golden_events()[0], "2026-09-20", [("L1", 10, 2), ("L1", 10, 2)]), "S6 lineRef"),
    (lambda: sale("syn-sale-s8", "2026-09-10", [line("L1", "goods", 1000, 10, "zero_rated")]), "S8"),
    (lambda: sale("syn-sale-s8", "2026-09-10", [line("L1", "goods", 1000, 10, "margin_scheme")]), "S8"),
    (lambda: sale("syn-sale-s8", "2026-09-10", [line("L1", "goods", 1000, 200, basis="not_applicable")]), "S8"),
    (lambda: sale("syn-sale-s8", "2026-09-10", [line("L1", "goods", 1000, 0, basis="source_stated")]), "S8"),
    (lambda: sale("syn-sale-s8", "2026-09-10", [line("L1", "goods", 1000, 200)], [fee("F1", 100, 20, "exempt")]), "S8"),
    (lambda: sale("syn-sale-s8", "2026-09-10", [line("L1", "goods", 1000, 200)], [fee("F1", 100, 20, "outside_scope")]), "S8"),
])
def test_cross_field_rule_violations_are_errors(event, message):
    with pytest.raises(contract().ContractError, match=message):
        contract().validate(event())


@pytest.mark.parametrize("change,message", [
    (lambda r: r["booksOf"].update(entityId="00000000-0000-4000-8000-0000000000aa"), "booksOf.entityId"),
    (lambda r: r.update(currency="EUR"), "currency"),
    (lambda r: r["channel"].update(name="synthetic-other"), "channel"),
    (lambda r: r["provider"].update(accountRef="synthetic-seller-other"), "accountRef"),
    (lambda r: r["lines"][0].update(lineRef="L9"), "lineRef"),
    (lambda r: r["feeCredits"][0].update(feeRef="F9"), "feeRef"),
])
def test_refund_must_match_its_stored_sale(change, message):
    t1, t3 = golden_events()[:2]
    contract().check_refund_against_sale(t3, t1)
    changed = copy.deepcopy(t3)
    change(changed["payload"])
    with pytest.raises(contract().ContractError, match="S7 .*" + message):
        contract().check_refund_against_sale(changed, t1)
    with pytest.raises(contract().ContractError, match="S7 .*not a sale"):
        contract().check_refund_against_sale(t3, golden_events()[5])
