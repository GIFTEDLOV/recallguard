import pytest

from .conftest import deploy_recall_guard, listing_args_for, setup_listing


def test_new_registration_is_unassessed(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    listing = contract.get_listing(listing_id)
    assert listing.state == "UNASSESSED"
    assert listing.identity_version == "v2-stable-marketplace-reference"
    assert list(contract.get_listing_assessments(listing_id)) == []


def test_registration_never_produces_cleared(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract)
    assert contract.get_listing(listing_id).state != "CLEARED"


def test_duplicate_canonical_identity_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for())
    with direct_vm.expect_revert("EXPECTED:DUPLICATE_LISTING"):
        contract.register_listing(*listing_args_for())


@pytest.mark.parametrize(
    "field",
    ["marketplace_host", "external_listing_id", "product_id", "product_name", "manufacturer", "model"],
)
def test_required_registration_fields_reject_empty(direct_vm, direct_deploy, field):
    contract = deploy_recall_guard(direct_deploy)
    values = {
        "marketplace_host": "market.example",
        "external_listing_id": "external-001",
        "product_id": "PROD-001",
        "product_name": "Example Pump",
        "manufacturer": "Example Manufacturer",
        "model": "XP-100",
        "serial_or_lot": "LOT-7",
        "listing_url": "https://market.example/item/PROD-001",
    }
    values[field] = ""
    with direct_vm.expect_revert("EXPECTED:INVALID"):
        contract.register_listing(*values.values())


def test_empty_serial_or_lot_is_allowed(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    listing_id = setup_listing(contract, serial_or_lot="")
    assert contract.get_listing(listing_id).serial_or_lot == ""


def test_listing_url_must_match_declared_marketplace_host(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    with direct_vm.expect_revert("EXPECTED:LISTING_HOST_MISMATCH"):
        contract.register_listing(*listing_args_for(listing_url="https://other.example/item/1"))


def test_marketplace_domain_policy_rejects_unlisted_marketplace(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args_for(marketplace_host="untrusted.example", listing_url="https://untrusted.example/item/1")
    with direct_vm.expect_revert("EXPECTED:WRONG_MARKETPLACE_DOMAIN"):
        contract.register_listing(*args)


@pytest.mark.parametrize("url", ["http://market.example/item/1", "market.example/item/1", "https://market .example/item/1"])
def test_invalid_listing_url_rejected(direct_vm, direct_deploy, url):
    contract = deploy_recall_guard(direct_deploy)
    with direct_vm.expect_revert("EXPECTED:"):
        contract.register_listing(*listing_args_for(listing_url=url))


def test_contract_info_exposes_fixed_cpsc_policy(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    info = contract.contract_info()
    assert info["version"] == "v2"
    assert info["listing_state_enum"] == ["UNASSESSED", "CLEARED", "REVIEW_REQUIRED", "BLOCKED"]
    assert info["cpsc_authority"] == "United States Consumer Product Safety Commission"
    assert info["cpsc_host"] == "www.saferproducts.gov"
    assert info["cpsc_path"] == "/RestWebServices/Recall"
    assert info["raw_cpsc_body_stored"] is False
    assert info["marketplace_evidence_in_consensus"] is False
    assert info["administrator_exists"] is False


def test_constructor_rejects_policy_without_cpsc_api(direct_vm, direct_deploy):
    with direct_vm.expect_revert("EXPECTED:CPSC_API_POLICY_REQUIRED"):
        deploy_recall_guard(direct_deploy, recall_domains=["cpsc.gov"])


def test_unknown_listing_view_is_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    with direct_vm.expect_revert("EXPECTED:LISTING_NOT_FOUND"):
        contract.get_listing("not-registered")
