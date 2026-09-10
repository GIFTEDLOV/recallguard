from .conftest import cpsc_record, deploy_recall_guard, mock_cpsc, mock_verdict, request_one, setup_listing


def test_same_recall_with_updated_decision_facts_keeps_logical_notice_id(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id, record=cpsc_record(description="Initial scope"), verdict="NOT_AFFECTED")
    second = request_one(contract, direct_vm, listing_id, record=cpsc_record(description="Updated scope"), verdict="INCONCLUSIVE")
    assert first.notice_id == second.notice_id
    assert first.snapshot_id != second.snapshot_id
    assert first.id != second.id


def test_duplicate_exact_snapshot_is_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id)
    mock_cpsc(direct_vm)
    mock_verdict(direct_vm)
    with direct_vm.expect_revert("EXPECTED:DUPLICATE_ASSESSMENT"):
        contract.request_assessment(listing_id, "26741")
    assert list(contract.get_assessment_ids()) == [first.id]


def test_different_authority_recall_identifiers_are_distinct(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id, recall_identifier="26741")
    second = request_one(contract, direct_vm, listing_id, recall_identifier="26742", record=cpsc_record(recall_number="26742"))
    assert first.notice_id != second.notice_id
    assert first.id != second.id


def test_same_text_different_url_cannot_create_second_notice(direct_vm, direct_deploy):
    # The API URL is not caller-controlled. A caller cannot create a second
    # logical notice by changing a URL or adding tracking parameters.
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id)
    assert contract._cpsc_url("26741") == "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26741"
    assert first.notice_id == contract._notice_id("26741")
    assert first.notice_id == "7fc982953efc0a29971edc9011e15335efbdf3fe200e2b1cdecc6892ef2a56ae"


def test_irrelevant_api_fields_do_not_change_snapshot(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = contract._canonical_cpsc_record(cpsc_record(LastPublishDate="2026-09-03T00:00:00Z", ConsumerContact="one"), "26741")
    second = contract._canonical_cpsc_record(cpsc_record(LastPublishDate="2099-01-01T00:00:00Z", ConsumerContact="two"), "26741")
    assert contract._snapshot_id(first) == contract._snapshot_id(second)
    request_one(contract, direct_vm, listing_id, record=cpsc_record(LastPublishDate="2026-09-03T00:00:00Z", ConsumerContact="one"))
    direct_vm.clear_mocks()
    mock_cpsc(direct_vm, record=cpsc_record(LastPublishDate="2099-01-01T00:00:00Z", ConsumerContact="two"))
    mock_verdict(direct_vm)
    with direct_vm.expect_revert("EXPECTED:DUPLICATE_ASSESSMENT"):
        contract.request_assessment(listing_id, "26741")


def test_relevant_api_fields_change_snapshot(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    first = request_one(contract, direct_vm, listing_id, record=cpsc_record(title="First scope"))
    second = request_one(contract, direct_vm, listing_id, record=cpsc_record(title="Second scope"))
    assert first.notice_id == second.notice_id
    assert first.snapshot_id != second.snapshot_id


def test_assessment_preserves_logical_notice_and_snapshot_provenance(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    assessment = request_one(contract, direct_vm, listing_id)
    assert len(assessment.notice_id) == 64
    assert assessment.recall_identifier == "26741"
    assert assessment.snapshot_id == assessment.snapshot_sha256
    assert len(assessment.snapshot_id) == 64
