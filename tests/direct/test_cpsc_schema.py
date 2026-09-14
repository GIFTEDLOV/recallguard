import copy
import json
from pathlib import Path
from types import SimpleNamespace

import pytest
from glsim.live_io import create_web_handler

from .conftest import deploy_recall_guard, json_body, mock_cpsc, mock_verdict, setup_listing


FIXTURE_PATH = Path(__file__).parents[2] / "fixtures" / "cpsc_26741_response_shape.json"


def actual_cpsc_26741_record():
    payload = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    assert isinstance(payload, list)
    assert len(payload) == 1
    return payload[0]


def test_actual_26741_description_shape_is_accepted(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    mock_cpsc(direct_vm, record=actual_cpsc_26741_record())
    mock_verdict(direct_vm, "AFFECTED")

    contract.request_assessment(listing_id, "26741")

    assessment = contract.get_assessment(contract.get_assessment_ids()[0])
    assert assessment.recall_identifier == "26741"
    assert assessment.verdict == "AFFECTED"
    assert contract.get_listing(listing_id).state == "BLOCKED"


def test_actual_26741_canonical_snapshot_is_deterministic(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    first_record = actual_cpsc_26741_record()
    second_record = json.loads(json.dumps(first_record, ensure_ascii=False))

    first = contract._canonical_cpsc_record(first_record, "26741")
    second = contract._canonical_cpsc_record(second_record, "26741")

    assert first == second
    assert contract._snapshot_id(first) == contract._snapshot_id(second)


def test_live_26741_schema_qualification_is_read_only(direct_deploy):
    response = create_web_handler(use_browser=False)({
        "url": "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26741",
        "method": "GET",
    })["ok"]["response"]
    contract = deploy_recall_guard(direct_deploy)
    facts = contract._parse_cpsc_response(
        SimpleNamespace(status=response["status"], body=response["body"]),
        "26741",
    )
    snapshot = contract._snapshot_id(facts)
    listing = SimpleNamespace(
        product_id="rg-fixture-a",
        product_name="scented mistolin dilutable cleaner",
        manufacturer="clorox manufacturing company of puerto rico, inc., puerto rico",
        model="scented mistolin",
        serial_or_lot="pr01-25100",
    )
    prompt = contract._decision_prompt(facts, listing)

    assert response["status"] == 200
    assert facts["recall_number"] == "26741"
    assert facts["recall_id"] == 10940
    assert len(snapshot) == 64
    assert all(value in prompt for value in vars(listing).values())


@pytest.mark.parametrize("description", [None, {}, [], "x" * 1025])
def test_malformed_description_fails_closed(direct_vm, direct_deploy, description):
    contract = deploy_recall_guard(direct_deploy)
    record = actual_cpsc_26741_record()
    record["Description"] = description

    with direct_vm.expect_revert("SOURCE:INVALID_SCHEMA_Description"):
        contract._canonical_cpsc_record(record, "26741")


def test_missing_required_decision_field_fails_closed(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    record = actual_cpsc_26741_record()
    del record["Description"]

    with direct_vm.expect_revert("SOURCE:MISSING_SCHEMA_Description"):
        contract._canonical_cpsc_record(record, "26741")


@pytest.mark.parametrize(
    ("field", "value", "error"),
    [
        ("Products", {}, "SOURCE:INVALID_SCHEMA_Products"),
        ("Manufacturers", "unexpected", "SOURCE:INVALID_SCHEMA_Manufacturers"),
        ("ProductUPCs", [{"UPC": []}], "SOURCE:INVALID_SCHEMA_UPC"),
        ("Hazards", [{"Name": {}}], "SOURCE:INVALID_SCHEMA_HazardName"),
        ("Remedies", [{"Name": []}], "SOURCE:INVALID_SCHEMA_RemedyName"),
    ],
)
def test_unexpected_decision_field_variants_fail_closed(direct_vm, direct_deploy, field, value, error):
    contract = deploy_recall_guard(direct_deploy)
    record = actual_cpsc_26741_record()
    record[field] = value

    with direct_vm.expect_revert(error):
        contract._canonical_cpsc_record(record, "26741")


def test_recall_number_mismatch_still_fails_closed(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    record = actual_cpsc_26741_record()
    record["RecallNumber"] = "99999"
    mock_cpsc(direct_vm, response_body=json_body(record))

    with direct_vm.expect_revert("SOURCE:CPSC_EXACT_RECORD_NOT_FOUND"):
        contract.request_assessment(listing_id, "26741")
    assert len(contract.get_assessment_ids()) == 0
    assert contract.get_listing(listing_id).state == "UNASSESSED"


@pytest.mark.parametrize(
    ("verdict", "state"),
    [("AFFECTED", "BLOCKED"), ("INCONCLUSIVE", "REVIEW_REQUIRED"), ("NOT_AFFECTED", "CLEARED")],
)
def test_actual_26741_assessment_semantics_unchanged(direct_vm, direct_deploy, verdict, state):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    mock_cpsc(direct_vm, record=copy.deepcopy(actual_cpsc_26741_record()))
    mock_verdict(direct_vm, verdict)

    contract.request_assessment(listing_id, "26741")

    assessment = contract.get_assessment(contract.get_assessment_ids()[0])
    assert assessment.verdict == verdict
    assert assessment.state_after == state
    assert contract.get_listing(listing_id).state == state
