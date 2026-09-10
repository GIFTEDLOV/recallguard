from .conftest import deploy_recall_guard


def test_v2_has_no_post_deployment_admin_mutation_surface(direct_deploy):
    contract = deploy_recall_guard(direct_deploy)
    info = contract.contract_info()
    assert "owner" not in info
    assert "admin" not in info
    assert not hasattr(contract, "set_recall_domains")
    assert not hasattr(contract, "set_marketplace_domains")
    assert not hasattr(contract, "delete_listing")
    assert not hasattr(contract, "delete_assessment")
    assert not hasattr(contract, "override_verdict")
    assert not hasattr(contract, "unblock_listing")
