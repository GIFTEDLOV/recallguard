import pytest

from .conftest import deploy_recall_guard, evidence_hash, listing_args, listing_args_for


def test_new_registration_is_unassessed(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args("https://catalog.example/item/1", "listing evidence"))
    listing = contract.get_listing(contract.get_listing_ids()[0])
    assert listing.state == "UNASSESSED"
    assert listing.identity_version == "v2-stable-source-identity"
    assert listing.evidence_sha256 == evidence_hash("listing evidence")


def test_registration_never_produces_cleared(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args("https://catalog.example/item/1", "listing evidence"))
    assert contract.get_listing(contract.get_listing_ids()[0]).state != "CLEARED"


def test_registration_has_no_assessment_history(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args("https://catalog.example/item/1", "listing evidence"))
    listing_id = contract.get_listing_ids()[0]
    assert contract.get_listing_assessments(listing_id) == []
    assert len(contract.get_assessment_ids()) == 0


def test_duplicate_canonical_identity_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args("https://catalog.example/item/1", "listing evidence")
    contract.register_listing(*args)
    with direct_vm.expect_revert("BUSINESS:DUPLICATE_LISTING"):
        contract.register_listing(*args)


def test_duplicate_identity_rejected_when_only_evidence_snapshot_changes(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args("https://catalog.example/item/1", "old snapshot"))
    changed = listing_args("https://catalog.example/item/1", "new snapshot")
    with direct_vm.expect_revert("BUSINESS:DUPLICATE_LISTING"):
        contract.register_listing(*changed)


def test_duplicate_identity_rejected_when_descriptive_name_changes(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for(product_name="Original name"))
    changed = listing_args_for(product_name="Renamed product")
    with direct_vm.expect_revert("BUSINESS:DUPLICATE_LISTING"):
        contract.register_listing(*changed)


def test_equivalent_identity_case_and_whitespace_normalizes_to_same_id(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    first = listing_args_for(external_listing_id="External-001", product_id="PROD-001")
    second = listing_args_for(
        external_listing_id="  external-001 ",
        product_id=" prod-001 ",
        manufacturer=" example manufacturer ",
        model=" XP-100 ",
        serial_or_lot=" lot-7 ",
    )
    contract.register_listing(*first)
    with direct_vm.expect_revert("BUSINESS:DUPLICATE_LISTING"):
        contract.register_listing(*second)


@pytest.mark.parametrize(
    "field_index",
    [0, 1, 2, 4, 5],
)
def test_required_identity_fields_reject_empty(direct_vm, direct_deploy, field_index):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args("https://catalog.example/item/1", "listing evidence")
    args[field_index] = ""
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:INVALID_REQUIRED_METADATA"):
        contract.register_listing(*args)


def test_empty_serial_or_lot_is_allowed_when_not_applicable(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args_for(serial_or_lot="")
    contract.register_listing(*args)
    assert contract.get_listing(contract.get_listing_ids()[0]).serial_or_lot == ""


def test_listing_url_must_match_declared_marketplace_host(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args_for(listing_url="https://other.example/item/1")
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:LISTING_HOST_MISMATCH"):
        contract.register_listing(*args)


def test_marketplace_domain_policy_rejects_unlisted_marketplace(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args_for(marketplace_host="untrusted.example", listing_url="https://untrusted.example/item/1")
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:WRONG_MARKETPLACE_DOMAIN"):
        contract.register_listing(*args)


def test_listing_evidence_domain_policy_rejects_unlisted_source(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args_for(evidence_url="https://untrusted.example/item/1")
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:WRONG_LISTING_SOURCE_DOMAIN"):
        contract.register_listing(*args)


def test_http_listing_url_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args_for(listing_url="http://market.example/item/1")
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:HTTPS_REQUIRED"):
        contract.register_listing(*args)


def test_http_evidence_url_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args_for(evidence_url="http://catalog.example/item/1")
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:HTTPS_REQUIRED"):
        contract.register_listing(*args)


def test_uppercase_digest_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args("https://catalog.example/item/1", "listing evidence")
    args[-1] = args[-1].upper()
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:INVALID_REQUIRED_METADATA"):
        contract.register_listing(*args)


def test_bad_digest_length_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args("https://catalog.example/item/1", "listing evidence")
    args[-1] = "0" * 63
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:INVALID_REQUIRED_METADATA"):
        contract.register_listing(*args)


def test_separator_in_identity_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args("https://catalog.example/item/1", "listing evidence")
    args[1] = "external|001"
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:INVALID_REQUIRED_METADATA"):
        contract.register_listing(*args)


def test_unknown_listing_view_is_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    with direct_vm.expect_revert("BUSINESS:INVALID_ID"):
        contract.get_listing("not-registered")


def test_contract_info_exposes_v2_states_and_policies(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    info = contract.contract_info()
    assert info["version"] == "v2"
    assert info["listing_state_enum"] == ["UNASSESSED", "CLEARED", "REVIEW_REQUIRED", "BLOCKED"]
    assert info["authorized_marketplace_domains"] == ["market.example"]
    assert info["authorized_listing_evidence_domains"] == ["catalog.example"]
    assert info["duplicate_notice_policy"] == "REJECT_SAME_LISTING_AND_NOTICE_ID"
