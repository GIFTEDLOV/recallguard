import json

import pytest

from .conftest import deploy_recall_guard, evidence_hash, listing_args


RECALL_URL = "https://recalls.example.gov/notice/1"
RECALL_BODY = "Recall notice: XP-100 lot LOT-7 is affected."
LISTING_BODY = "Product page: Example Pump XP-100, lot LOT-7."


def setup_contract(direct_deploy, direct_vm):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args("https://catalog.example/item/1", LISTING_BODY))
    return contract, contract.get_listing_ids()[0]


def mock_successful_evidence(direct_vm):
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": RECALL_BODY})


def mock_full_assessment(direct_vm, llm_result):
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": RECALL_BODY})
    direct_vm.mock_web(r"catalog\.example/item/1", {"status": 200, "body": LISTING_BODY})
    direct_vm.mock_llm(r"RecallGuard decision evaluator", llm_result)


def test_validator_disagreement_fails_closed_without_state_mutation(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_successful_evidence(direct_vm)
    assert contract._fetch_admissible_evidence(RECALL_URL, evidence_hash(RECALL_BODY)) == RECALL_BODY
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": "different source"})
    assert direct_vm.run_validator() is False
    assert len(contract.get_assessment_ids()) == 0
    assert contract.get_listing(listing_id).state == "UNASSESSED"


def test_validator_agreement_accepts_identical_canonical_evidence(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_successful_evidence(direct_vm)
    assert contract._fetch_admissible_evidence(RECALL_URL, evidence_hash(RECALL_BODY)) == RECALL_BODY
    assert direct_vm.run_validator() is True
    assert contract.get_listing(listing_id).state == "UNASSESSED"


def test_validator_timeout_fails_closed_without_business_verdict(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_successful_evidence(direct_vm)
    assert contract._fetch_admissible_evidence(RECALL_URL, evidence_hash(RECALL_BODY)) == RECALL_BODY
    assert direct_vm.run_validator(leader_error=TimeoutError("validator timeout")) is False
    assert len(contract.get_assessment_ids()) == 0
    assert contract.get_listing(listing_id).state == "UNASSESSED"


@pytest.mark.parametrize(
    ("raw_result", "expected"),
    [
        ("not-json", "SEMANTIC_MODEL:MALFORMED_OUTPUT"),
        (json.dumps({"reason": "AFFECTED"}), "SEMANTIC_MODEL:SCHEMA_REJECTED"),
        (json.dumps({"verdict": "AFFECTED", "reason": "extra"}), "SEMANTIC_MODEL:SCHEMA_REJECTED"),
        (json.dumps({"verdict": 1}), "SEMANTIC_MODEL:WRONG_VERDICT_TYPE"),
        (json.dumps({"verdict": "MAYBE"}), "SEMANTIC_MODEL:INVALID_VERDICT_ENUM"),
    ],
)
def test_malformed_or_invalid_model_output_fails_closed(direct_vm, direct_deploy, raw_result, expected):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_full_assessment(direct_vm, raw_result)
    with direct_vm.expect_revert(expected):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))
    assert len(contract.get_assessment_ids()) == 0
    assert contract.get_listing(listing_id).state == "UNASSESSED"


def test_model_output_with_extra_json_fields_is_not_a_verdict(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_full_assessment(direct_vm, json.dumps({"verdict": "NOT_AFFECTED", "confidence": 1}))
    with direct_vm.expect_revert("SEMANTIC_MODEL:SCHEMA_REJECTED"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))
    assert contract.get_listing(listing_id).state == "UNASSESSED"


def test_consensus_failure_never_becomes_not_affected(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": RECALL_BODY})
    direct_vm.mock_web(r"catalog\.example/item/1", {"status": 200, "body": LISTING_BODY})
    direct_vm.mock_llm(r"RecallGuard decision evaluator", "timeout-or-disagreement")
    with direct_vm.expect_revert("SEMANTIC_MODEL:MALFORMED_OUTPUT"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))
    assert contract.get_listing(listing_id).state == "UNASSESSED"


def test_evidence_timeout_or_unavailability_is_not_a_business_verdict(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 500, "body": "timeout"})
    with direct_vm.expect_revert("EVIDENCE_UNAVAILABLE:HTTP_STATUS"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))
    assert contract.get_listing(listing_id).state == "UNASSESSED"
    assert len(contract.get_assessment_ids()) == 0


def test_empty_evidence_is_integrity_failure_not_not_affected(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": ""})
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:MALFORMED_EVIDENCE"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(""))
    assert contract.get_listing(listing_id).state == "UNASSESSED"


def test_failed_consensus_does_not_append_partial_assessment(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_full_assessment(direct_vm, "{\"verdict\":")
    with direct_vm.expect_revert("SEMANTIC_MODEL:MALFORMED_OUTPUT"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))
    assert len(contract.get_assessment_ids()) == 0
    assert contract.get_listing_assessments(listing_id) == []


def test_deterministic_verdict_parser_rejects_non_object(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_full_assessment(direct_vm, json.dumps(["AFFECTED"]))
    with direct_vm.expect_revert("SEMANTIC_MODEL:SCHEMA_REJECTED"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))
    assert contract.get_listing(listing_id).state == "UNASSESSED"


def test_valid_strict_json_is_the_only_model_success_path(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_full_assessment(direct_vm, json.dumps({"verdict": "NOT_AFFECTED"}))
    contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))
    assert contract.get_listing(listing_id).state == "CLEARED"


def test_leader_evidence_digest_is_checked_against_expected_hash(direct_vm, direct_deploy):
    contract, listing_id = setup_contract(direct_deploy, direct_vm)
    mock_successful_evidence(direct_vm)
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:BAD_SHA256"):
        contract._fetch_admissible_evidence(RECALL_URL, evidence_hash("different"))
    assert contract.get_listing(listing_id).state == "UNASSESSED"
