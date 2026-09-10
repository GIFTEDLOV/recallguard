import pytest

from .conftest import cpsc_record, deploy_recall_guard, listing_args_for, mock_cpsc, request_one, setup_listing


def assess_sequence(contract, direct_vm, listing_id, sequence):
    for index, (verdict, record) in enumerate(sequence, start=26741):
        request_one(
            contract,
            direct_vm,
            listing_id,
            recall_identifier=str(index),
            record=record,
            verdict=verdict,
        )


def test_no_assessments_is_unassessed(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    assert contract.get_listing(listing_id).state == "UNASSESSED"


@pytest.mark.parametrize(
    ("sequence", "expected"),
    [
        (["AFFECTED", "NOT_AFFECTED"], "BLOCKED"),
        (["NOT_AFFECTED", "AFFECTED"], "BLOCKED"),
        (["INCONCLUSIVE", "NOT_AFFECTED"], "REVIEW_REQUIRED"),
        (["NOT_AFFECTED", "INCONCLUSIVE"], "REVIEW_REQUIRED"),
        (["NOT_AFFECTED", "NOT_AFFECTED"], "CLEARED"),
        (["INCONCLUSIVE", "AFFECTED", "NOT_AFFECTED"], "BLOCKED"),
    ],
)
def test_aggregation_priority_is_order_independent(direct_vm, direct_deploy, sequence, expected):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    records = [cpsc_record(recall_number=str(26741 + i)) for i in range(len(sequence))]
    assess_sequence(contract, direct_vm, listing_id, list(zip(sequence, records)))
    assert contract.get_listing(listing_id).state == expected


def test_cleared_plus_affected_is_blocked(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED")
    request_one(contract, direct_vm, listing_id, recall_identifier="26742", record=cpsc_record(recall_number="26742"), verdict="AFFECTED")
    assert contract.get_listing(listing_id).state == "BLOCKED"


def test_blocked_plus_not_affected_remains_blocked(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="AFFECTED")
    later = request_one(contract, direct_vm, listing_id, recall_identifier="26742", record=cpsc_record(recall_number="26742"), verdict="NOT_AFFECTED")
    assert later.state_after == "BLOCKED"
    assert contract.get_listing(listing_id).state == "BLOCKED"


def test_review_required_plus_not_affected_remains_review_required(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="INCONCLUSIVE")
    later = request_one(contract, direct_vm, listing_id, recall_identifier="26742", record=cpsc_record(recall_number="26742"), verdict="NOT_AFFECTED")
    assert later.state_after == "REVIEW_REQUIRED"
    assert contract.get_listing(listing_id).state == "REVIEW_REQUIRED"


def test_failed_assessment_is_not_scanned_by_aggregation(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    mock_cpsc(direct_vm, status=503)
    with direct_vm.expect_revert("TRANSIENT:CPSC_HTTP_5XX"):
        contract.request_assessment(listing_id, "26741")
    assert contract.get_listing(listing_id).state == "UNASSESSED"
    assert list(contract.get_listing_assessments(listing_id)) == []


def test_other_listing_history_does_not_affect_aggregate(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    first_listing = setup_listing(contract)
    contract.register_listing(*listing_args_for(external_listing_id="external-002", listing_url="https://market.example/item/2"))
    second_listing = contract.get_listing_ids()[1]
    request_one(contract, direct_vm, first_listing, verdict="NOT_AFFECTED")
    request_one(contract, direct_vm, second_listing, recall_identifier="26742", record=cpsc_record(recall_number="26742"), verdict="AFFECTED")
    assert contract.get_listing(first_listing).state == "CLEARED"
    assert contract.get_listing(second_listing).state == "BLOCKED"
