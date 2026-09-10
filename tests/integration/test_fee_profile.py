"""Representative local Studio/GLSim writes used by the v0.6 fee profiler."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from gltest import get_contract_factory, get_default_account, get_gl_client


pytestmark = pytest.mark.integration


def frozen_cpsc_response() -> str:
    """A schema-valid CPSC record used only to make local profiling repeatable."""
    return json.dumps(
        [
            {
                "RecallID": 10940,
                "RecallNumber": "26741",
                "RecallDate": "2026-09-03",
                "Title": "Example Pump recall",
                "Description": "The Example Pump XP-100 may overheat and presents a hazard.",
                "Products": [
                    {
                        "Name": "Example Pump",
                        "Description": "Example Pump XP-100, lot LOT-7.",
                        "Model": "XP-100",
                        "Type": "Pump",
                    }
                ],
                "Manufacturers": [{"Name": "Example Manufacturer"}],
                "ProductUPCs": [{"UPC": "000123456789"}],
                "Hazards": [{"Name": "The pump may overheat."}],
                "Remedies": [{"Name": "Refund"}],
            }
        ],
        ensure_ascii=False,
        separators=(",", ":"),
    )


@pytest.fixture(scope="session", autouse=True)
def install_semantic_fixture():
    """Use frozen source bytes while still exercising the CPSC web boundary."""
    client = get_gl_client()
    response = client.provider.make_request(
        method="sim_installMocks",
        params={
            "strict": True,
            "llm_mocks": {
                r"RecallGuard applicability evaluator": json.dumps(
                    {"verdict": "AFFECTED"}, separators=(",", ":")
                )
            },
            "web_mocks": {
                re.escape(
                    "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26741"
                ): {"status": 200, "body": frozen_cpsc_response()}
            },
        },
    )
    assert response["result"]["llm"] == 1
    assert response["result"]["web"] == 1
    yield


def test_representative_v06_deploy_register_and_assessment():
    factory = get_contract_factory(contract_file_path=Path("recall_guard.py"))
    account = get_default_account()
    contract = factory.deploy(
        args=[["saferproducts.gov"], ["amazon.com"]],
        account=account,
        wait_until="finalized",
        wait_interval=100,
        wait_retries=100,
    )

    registration = contract.register_listing(
        args=[
            "amazon.com",
            "fee-profile-001",
            "MISTOLIN",
            "Scented Mistolin",
            "Clorox",
            "Scented Mistolin",
            "PR01-25100",
            "https://www.amazon.com/dp/B08N5KWB9H",
        ]
    ).transact(
        wait_until="finalized",
        wait_interval=100,
        wait_retries=100,
    )
    assert registration["status"] == "FINALIZED"

    listing_id = contract.get_listing_ids().call()[0]
    assessment = contract.request_assessment(args=[listing_id, "26741"]).transact(
        wait_until="finalized",
        wait_interval=100,
        wait_retries=100,
    )
    assert assessment["status"] == "FINALIZED"
