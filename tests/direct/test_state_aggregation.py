from .conftest import deploy_recall_guard, evidence_hash, listing_args
from .test_assessment import LISTING_BODY, RECALL_URL, request_one, setup_listing


def test_cleared_plus_affected_is_blocked(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    request_one(contract, direct_vm, listing_id, verdict="AFFECTED", recall_url="https://recalls.example.gov/notice/2", recall_body="Affected notice")
    assert contract.get_listing(listing_id).state == "BLOCKED"


def test_cleared_plus_inconclusive_is_review_required(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    request_one(contract, direct_vm, listing_id, verdict="INCONCLUSIVE", recall_url="https://recalls.example.gov/notice/2", recall_body="Unclear notice")
    assert contract.get_listing(listing_id).state == "REVIEW_REQUIRED"


def test_review_required_plus_not_affected_remains_review_required(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="INCONCLUSIVE", recall_url=RECALL_URL)
    assessment = request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url="https://recalls.example.gov/notice/2", recall_body="Later favorable notice")
    assert assessment.state_after == "REVIEW_REQUIRED"
    assert contract.get_listing(listing_id).state == "REVIEW_REQUIRED"


def test_blocked_plus_not_affected_remains_blocked(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="AFFECTED", recall_url=RECALL_URL)
    assessment = request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url="https://recalls.example.gov/notice/2", recall_body="Later favorable notice")
    assert assessment.state_after == "BLOCKED"
    assert contract.get_listing(listing_id).state == "BLOCKED"


def test_multiple_not_affected_assessments_are_cleared(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url="https://recalls.example.gov/notice/2", recall_body="Second clear notice")
    assert contract.get_listing(listing_id).state == "CLEARED"


def test_affected_has_priority_over_inconclusive(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="INCONCLUSIVE", recall_url=RECALL_URL)
    request_one(contract, direct_vm, listing_id, verdict="AFFECTED", recall_url="https://recalls.example.gov/notice/2", recall_body="Affected notice")
    assert contract.get_listing(listing_id).state == "BLOCKED"


def test_inconclusive_has_priority_over_not_affected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    request_one(contract, direct_vm, listing_id, verdict="INCONCLUSIVE", recall_url="https://recalls.example.gov/notice/2", recall_body="Unclear notice")
    assert contract.get_listing(listing_id).state == "REVIEW_REQUIRED"


def test_first_assessment_state_after_is_aggregate_not_verdict_only(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    assessment = request_one(contract, direct_vm, listing_id, verdict="INCONCLUSIVE", recall_url=RECALL_URL)
    assert assessment.state_after == "REVIEW_REQUIRED"


def test_second_assessment_records_previous_adverse_consequence(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="AFFECTED", recall_url=RECALL_URL)
    later = request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url="https://recalls.example.gov/notice/2", recall_body="Different notice")
    assert later.state_after == "BLOCKED"
    assert len(contract.get_listing_assessments(listing_id)) == 2


def test_same_notice_same_digest_is_duplicate_and_idempotence_is_explicit(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    direct_vm.clear_mocks()
    direct_vm.mock_web(r"recalls\.example\.gov/notice/1", {"status": 200, "body": "Recall notice: XP-100 lot LOT-7 is affected."})
    direct_vm.mock_web(r"catalog\.example/item/1", {"status": 200, "body": LISTING_BODY})
    direct_vm.mock_llm(r"RecallGuard decision evaluator", '{"verdict":"NOT_AFFECTED"}')
    with direct_vm.expect_revert("BUSINESS:DUPLICATE_ASSESSMENT"):
        contract.request_assessment(listing_id, RECALL_URL, evidence_hash("Recall notice: XP-100 lot LOT-7 is affected."))
    assert len(contract.get_assessment_ids()) == 1


def test_same_url_with_new_committed_snapshot_is_a_distinct_notice_identity(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    second = request_one(contract, direct_vm, listing_id, verdict="INCONCLUSIVE", recall_url=RECALL_URL, recall_body="Updated notice bytes")
    assert first.notice_id != second.notice_id
    assert len(contract.get_listing_assessments(listing_id)) == 2
    assert contract.get_listing(listing_id).state == "REVIEW_REQUIRED"


def test_different_notice_urls_have_distinct_assessment_ids(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    second = request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url="https://recalls.example.gov/notice/2", recall_body="Second notice")
    assert first.id != second.id


def test_listing_history_order_is_append_order(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    second = request_one(contract, direct_vm, listing_id, verdict="INCONCLUSIVE", recall_url="https://recalls.example.gov/notice/2", recall_body="Unclear notice")
    assert list(contract.get_listing_assessments(listing_id)) == [first.id, second.id]


def test_other_listing_history_does_not_affect_aggregate(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    first_listing = setup_listing(contract)
    second_args = listing_args("https://catalog.example/item/2", LISTING_BODY, external_listing_id="external-002")
    contract.register_listing(*second_args)
    second_listing = contract.get_listing_ids()[1]
    request_one(contract, direct_vm, first_listing, verdict="NOT_AFFECTED", recall_url=RECALL_URL)
    request_one(contract, direct_vm, second_listing, verdict="AFFECTED", recall_url="https://recalls.example.gov/notice/2", recall_body="Affected second")
    assert contract.get_listing(first_listing).state == "CLEARED"
    assert contract.get_listing(second_listing).state == "BLOCKED"
