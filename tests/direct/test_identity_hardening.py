from .conftest import deploy_recall_guard, listing_args_for


def test_same_marketplace_reference_changed_title_is_same_id(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for(product_name="Original title"))
    with direct_vm.expect_revert("EXPECTED:DUPLICATE_LISTING"):
        contract.register_listing(*listing_args_for(product_name="Seller changed title"))


def test_same_marketplace_reference_changed_manufacturer_spelling_is_same_id(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for(manufacturer="Example Manufacturer"))
    with direct_vm.expect_revert("EXPECTED:DUPLICATE_LISTING"):
        contract.register_listing(*listing_args_for(manufacturer="EXAMPLE  MANUFACTURER"))


def test_same_marketplace_reference_changed_evidence_is_same_id(direct_vm, direct_deploy):
    # Evidence is deliberately not an identity input and is not accepted by
    # the V2 consensus path. The registered marketplace reference remains the
    # sole stable key.
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for(external_listing_id="external-001"))
    with direct_vm.expect_revert("EXPECTED:DUPLICATE_LISTING"):
        contract.register_listing(*listing_args_for(external_listing_id="external-001", listing_url="https://market.example/item/1?evidence=changed"))


def test_url_case_default_port_and_tracking_query_do_not_split_identity(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for(listing_url="https://market.example/item/1"))
    with direct_vm.expect_revert("EXPECTED:DUPLICATE_LISTING"):
        contract.register_listing(*listing_args_for(listing_url="https://MARKET.EXAMPLE:443/item/1?utm_source=changed"))


def test_same_external_id_on_different_marketplaces_has_different_id(direct_deploy):
    contract = deploy_recall_guard(
        direct_deploy,
        marketplace_domains=["market.example", "other-market.example"],
    )
    contract.register_listing(*listing_args_for(marketplace_host="market.example", listing_url="https://market.example/item/1"))
    contract.register_listing(*listing_args_for(marketplace_host="other-market.example", listing_url="https://other-market.example/item/1"))
    assert len(contract.get_listing_ids()) == 2
    assert contract.get_listing_ids()[0] != contract.get_listing_ids()[1]


def test_different_external_ids_on_same_marketplace_have_different_id(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for(external_listing_id="external-001"))
    contract.register_listing(*listing_args_for(external_listing_id="external-002", listing_url="https://market.example/item/2"))
    assert len(contract.get_listing_ids()) == 2
    assert contract.get_listing_ids()[0] != contract.get_listing_ids()[1]


def test_contract_identity_matches_independent_reference_vector(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for(marketplace_host="MARKET.EXAMPLE:443", external_listing_id=" External-001 "))
    assert contract.get_listing_ids()[0] == "9c2c7207c9113db97289ba757032296a618ec04ecc3655fa158f2b7ac5a3c1e7"


def test_malformed_marketplace_host_with_whitespace_is_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    with direct_vm.expect_revert("EXPECTED:INVALID_HOST"):
        contract.register_listing(*listing_args_for(marketplace_host="market .example"))


def test_identity_does_not_depend_on_product_or_serial_fields(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args_for(product_id="PROD-001", model="XP-100", serial_or_lot="LOT-7"))
    changed = listing_args_for(product_id="PROD-RENAMED", model="XP100", serial_or_lot="LOT-8")
    with direct_vm.expect_revert("EXPECTED:DUPLICATE_LISTING"):
        contract.register_listing(*changed)
