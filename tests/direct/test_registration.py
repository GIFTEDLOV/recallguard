from .conftest import deploy_recall_guard, evidence_hash, listing_args


def test_valid_listing_registration(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    direct_vm.mock_web(r"unused", {"status": 200, "body": "unused"})
    contract.register_listing(*listing_args("https://catalog.example/item/1", "listing evidence"))

    ids = contract.get_listing_ids()
    assert len(ids) == 1
    listing = contract.get_listing(ids[0])
    assert listing.state == "ACTIVE"
    assert listing.product_id == "PROD-001"
    assert listing.evidence_sha256 == evidence_hash("listing evidence")


def test_duplicate_listing_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args("https://catalog.example/item/1", "listing evidence")
    contract.register_listing(*args)
    with direct_vm.expect_revert("BUSINESS:DUPLICATE_LISTING"):
        contract.register_listing(*args)


def test_input_bounds_and_invalid_metadata_rejected(direct_vm, direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    args = listing_args("https://catalog.example/item/1", "listing evidence")
    args[0] = "x" * 257
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:INVALID_REQUIRED_METADATA"):
        contract.register_listing(*args)

    args = listing_args("http://catalog.example/item/1", "listing evidence")
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:HTTPS_REQUIRED"):
        contract.register_listing(*args)

    args = listing_args("https://catalog.example/item/1", "listing evidence")
    args[-1] = "0" * 63
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:INVALID_REQUIRED_METADATA"):
        contract.register_listing(*args)


def test_unauthorized_assessment_domain_and_sender_rejected(direct_vm, direct_deploy, direct_bob, direct_owner):
    contract = deploy_recall_guard(direct_deploy)
    contract.register_listing(*listing_args("https://catalog.example/item/1", "listing evidence"))
    listing_id = contract.get_listing_ids()[0]
    direct_vm.sender = direct_bob
    with direct_vm.expect_revert("BUSINESS:UNAUTHORIZED_ACTION"):
        contract.request_assessment(listing_id, "https://recalls.example.gov/notice/1", evidence_hash("recall"))

    direct_vm.sender = direct_owner
    with direct_vm.expect_revert("EVIDENCE_INTEGRITY:WRONG_SOURCE_DOMAIN"):
        contract.request_assessment(listing_id, "https://not-authorized.example/notice/1", evidence_hash("recall"))


def test_unknown_listing_id_is_rejected_as_a_business_error(direct_vm, direct_deploy, direct_owner):
    contract = deploy_recall_guard(direct_deploy)
    direct_vm.sender = direct_owner

    with direct_vm.expect_revert("BUSINESS:INVALID_ID"):
        contract.request_assessment("not-a-registered-listing", "https://recalls.example.gov/notice/1", evidence_hash("recall"))
