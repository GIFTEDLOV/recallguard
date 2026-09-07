import json

import pytest

from .conftest import deploy_recall_guard, evidence_hash, listing_args
from .test_assessment import LISTING_BODY, LISTING_URL, RECALL_BODY, RECALL_URL


def test_validator_disagreement_fails_closed_without_state_mutation(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args(LISTING_URL, LISTING_BODY))
    listing_id = contract.get_listing_ids()[0]
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": RECALL_BODY})
    contract._fetch_admissible_evidence(RECALL_URL, evidence_hash(RECALL_BODY))
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": "different source"})

    # Direct Mode captures the validator for strict_eq and lets the test
    # replace the validator's external source independently of the leader.
    assert direct_vm.run_validator() is False
    assert len(contract.get_assessment_ids()) == 0
    assert contract.get_listing(listing_id).state == "ACTIVE"


def test_validator_agreement_accepts_the_same_canonical_evidence(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args(LISTING_URL, LISTING_BODY))
    listing_id = contract.get_listing_ids()[0]
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": RECALL_BODY})

    assert contract._fetch_admissible_evidence(RECALL_URL, evidence_hash(RECALL_BODY)) == RECALL_BODY
    assert direct_vm.run_validator() is True
    assert contract.get_listing(listing_id).state == "ACTIVE"


def test_malformed_empty_evidence_is_integrity_failure_without_state_mutation(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args(LISTING_URL, LISTING_BODY))
    listing_id = contract.get_listing_ids()[0]
    bad_body = ""
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": bad_body})

    with pytest.raises(Exception, match="EVIDENCE_INTEGRITY:MALFORMED_EVIDENCE"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(bad_body))

    assert contract.get_listing(listing_id).state == "ACTIVE"
    assert len(contract.get_assessment_ids()) == 0


def test_duplicate_and_terminal_assessment_cannot_be_overwritten(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args(LISTING_URL, LISTING_BODY))
    listing_id = contract.get_listing_ids()[0]
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": RECALL_BODY})
    direct_vm.mock_web(r"catalog\.example/item/1", {"status": 200, "body": LISTING_BODY})
    direct_vm.mock_llm(r"RecallGuard decision evaluator", json.dumps({"verdict": "INCONCLUSIVE"}))
    contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))
    assessment_id = contract.get_assessment_ids()[0]
    assert contract.get_assessment(assessment_id).status == "FINALIZED"

    with direct_vm.expect_revert("BUSINESS:DUPLICATE_ASSESSMENT"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))


def test_blocked_listing_is_terminal(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args(LISTING_URL, LISTING_BODY))
    listing_id = contract.get_listing_ids()[0]
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": RECALL_BODY})
    direct_vm.mock_web(r"catalog\.example/item/1", {"status": 200, "body": LISTING_BODY})
    direct_vm.mock_llm(r"RecallGuard decision evaluator", json.dumps({"verdict": "AFFECTED"}))
    contract.request_assessment(listing_id, RECALL_URL, evidence_hash(RECALL_BODY))

    with direct_vm.expect_revert("BUSINESS:ILLEGAL_STATE_TRANSITION"):
        contract.request_assessment(listing_id, "https://recalls.example.gov/notice/2", evidence_hash("new notice"))
