import json

import pytest

from .conftest import cpsc_record, deploy_recall_guard, json_body, mock_cpsc, mock_verdict, request_one, setup_listing


def test_validator_independently_fetches_and_derives_same_result(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="AFFECTED")
    direct_vm.clear_mocks()
    mock_cpsc(direct_vm)
    mock_verdict(direct_vm, "AFFECTED")
    assert direct_vm.run_validator() is True


def test_validator_disagreement_on_semantic_verdict_fails_closed(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="AFFECTED")
    direct_vm.clear_mocks()
    mock_cpsc(direct_vm)
    mock_verdict(direct_vm, "NOT_AFFECTED")
    assert direct_vm.run_validator() is False
    assert contract.get_listing(listing_id).state == "BLOCKED"
    assert len(contract.get_assessment_ids()) == 1


def test_validator_disagreement_on_snapshot_fails_closed(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED")
    direct_vm.clear_mocks()
    mock_cpsc(direct_vm, record=cpsc_record(description="validator saw changed facts"))
    mock_verdict(direct_vm, "NOT_AFFECTED")
    assert direct_vm.run_validator() is False
    assert contract.get_listing(listing_id).state == "CLEARED"
    assert len(contract.get_assessment_ids()) == 1


def test_leader_enum_only_never_passes_validation(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id, verdict="NOT_AFFECTED")
    direct_vm.clear_mocks()
    mock_cpsc(direct_vm)
    mock_verdict(direct_vm, "AFFECTED")
    assert direct_vm.run_validator(leader_result={"verdict": "NOT_AFFECTED"}) is False
    assert contract.get_listing(listing_id).state == "CLEARED"
    assert len(contract.get_assessment_ids()) == 1


def test_validator_rejects_extra_leader_fields(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id)
    direct_vm.clear_mocks()
    mock_cpsc(direct_vm)
    mock_verdict(direct_vm)
    result = {"notice_id": "x", "recall_id": "26741", "snapshot_sha256": "x", "verdict": "NOT_AFFECTED", "reason": "leader claim"}
    assert direct_vm.run_validator(leader_result=result) is False


def test_leader_user_error_is_not_read_as_calldata(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    from genlayer import gl

    error = gl.vm.UserError("SOURCE:CPSC_INVALID_JSON")
    assert contract._same_error_class(error, lambda: (_ for _ in ()).throw(gl.vm.UserError("SOURCE:CPSC_INVALID_JSON"))) is True


def test_timeout_path_has_no_business_verdict(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    mock_cpsc(direct_vm, status=503)
    with direct_vm.expect_revert("TRANSIENT:CPSC_HTTP_5XX"):
        contract.request_assessment(listing_id, "26741")
    assert len(contract.get_assessment_ids()) == 0
    assert contract.get_listing(listing_id).state == "UNASSESSED"


def test_pickling_checks_are_enabled_for_captured_consensus_closures(direct_vm, direct_deploy):
    cloudpickle = pytest.importorskip("cloudpickle")
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    request_one(contract, direct_vm, listing_id)
    assert direct_vm.check_pickling is True
    _, leader_fn, validator_fn = direct_vm._captured_validators[-1]
    cloudpickle.dumps(leader_fn)
    cloudpickle.dumps(validator_fn)


@pytest.mark.parametrize(
    ("field", "value"),
    [("Products", [{}]), ("Manufacturers", ["bad"]), ("ProductUPCs", [{"UPC": 7}]), ("Hazards", [{"Name": 7}]), ("Remedies", [{"Name": None}])],
)
def test_schema_type_errors_never_become_inconclusive(direct_vm, direct_deploy, field, value):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    record = cpsc_record(**{field: value})
    mock_cpsc(direct_vm, record=record)
    with direct_vm.expect_revert("SOURCE:"):
        contract.request_assessment(listing_id, "26741")
    assert contract.get_listing(listing_id).state == "UNASSESSED"
