import json

import pytest

from .conftest import deploy_recall_guard, evidence_hash, listing_args
from .test_assessment import LISTING_BODY, RECALL_URL, request_one, setup_listing


def test_same_recall_reference_with_updated_page_snapshot_keeps_logical_notice_id(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(
        contract,
        direct_vm,
        listing_id,
        notice_reference="CPSC-2026-001",
        recall_body="CPSC-2026-001 initial scope",
        verdict="NOT_AFFECTED",
    )
    second = request_one(
        contract,
        direct_vm,
        listing_id,
        notice_reference="CPSC-2026-001",
        recall_body="CPSC-2026-001 updated scope",
        verdict="INCONCLUSIVE",
    )
    assert first.notice_id == second.notice_id
    assert first.snapshot_id != second.snapshot_id
    assert first.id != second.id
    assert contract.get_listing(listing_id).state == "REVIEW_REQUIRED"


def test_duplicate_exact_snapshot_is_rejected_even_when_url_query_changes(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    body = "CPSC-2026-002 exact snapshot"
    request_one(contract, direct_vm, listing_id, notice_reference="CPSC-2026-002", recall_body=body)
    with direct_vm.expect_revert("BUSINESS:DUPLICATE_ASSESSMENT"):
        contract.request_assessment(
            listing_id,
            RECALL_URL + "?utm_source=attacker",
            "CPSC-2026-002",
            evidence_hash(body),
        )
    assert len(contract.get_assessment_ids()) == 1


def test_different_notice_references_from_same_authority_are_distinct(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id, notice_reference="CPSC-2026-003", recall_body="notice three")
    second = request_one(contract, direct_vm, listing_id, notice_reference="CPSC-2026-004", recall_body="notice four", recall_url="https://recalls.example.gov/notice/2")
    assert first.notice_id != second.notice_id
    assert first.id != second.id


def test_same_text_from_different_authority_domains_has_distinct_notice_identity(direct_vm, direct_deploy):
    contract = deploy_recall_guard(
        direct_deploy,
        recall_domains=["recalls.example.gov", "other-authority.example"],
    )
    contract.register_listing(*listing_args("https://catalog.example/item/1", LISTING_BODY))
    listing_id = contract.get_listing_ids()[0]
    body = "Same text, different authority namespace"
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": body})
    direct_vm.mock_web(r"other-authority\.example/notice/1", {"status": 200, "body": body})
    direct_vm.mock_web(r"catalog\.example/item/1", {"status": 200, "body": LISTING_BODY})
    direct_vm.mock_llm(r"RecallGuard decision evaluator", json.dumps({"verdict": "NOT_AFFECTED"}))
    contract.request_assessment(listing_id, RECALL_URL, "AUTH-001", evidence_hash(body))
    first = contract.get_assessment(contract.get_assessment_ids()[0])
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"other-authority\.example/notice/1", {"status": 200, "body": body})
    direct_vm.mock_web(r"catalog\.example/item/1", {"status": 200, "body": LISTING_BODY})
    direct_vm.mock_llm(r"RecallGuard decision evaluator", json.dumps({"verdict": "NOT_AFFECTED"}))
    contract.request_assessment(listing_id, "https://other-authority.example/notice/1", "AUTH-001", evidence_hash(body))
    second = contract.get_assessment(contract.get_assessment_ids()[1])
    assert first.notice_id != second.notice_id


def test_query_variation_cannot_create_repeated_logical_notice(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(
        contract,
        direct_vm,
        listing_id,
        recall_url=RECALL_URL + "?page=1",
        notice_reference="CPSC-2026-005",
        recall_body="snapshot one",
    )
    second = request_one(
        contract,
        direct_vm,
        listing_id,
        recall_url=RECALL_URL + "?page=2",
        notice_reference="CPSC-2026-005",
        recall_body="snapshot two",
        verdict="INCONCLUSIVE",
    )
    assert first.notice_id == second.notice_id
    assert len({assessment.notice_id for assessment in [first, second]}) == 1


@pytest.mark.parametrize("reference", ["", "   ", "x" * 257])
def test_notice_reference_is_required_and_bounded(direct_vm, direct_deploy, reference):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:INVALID_REQUIRED_METADATA"):
        contract.request_assessment(listing_id, RECALL_URL, reference, evidence_hash("recall"))
