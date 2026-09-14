"""Representative local Studio/GLSim writes used by the v0.6 fee profiler."""

from __future__ import annotations

import json
import os
from pathlib import Path

import pytest

from gltest import (
    get_contract_factory,
    get_default_account,
    get_gl_client,
    get_validator_factory,
)
from gltest.fees import get_fee_profile_collector


pytestmark = pytest.mark.integration

FEE_ESTIMATE_OPTIONS = {
    "leaderTimeunitsAllocation": 100,
    "validatorTimeunitsAllocation": 200,
    "totalMessageFees": 0,
    "rotations": [1],
}


def transaction_fee_preset() -> dict[str, object]:
    """Obtain current local Studio fees for each measured transaction."""
    estimate = get_gl_client().estimate_transaction_fees(FEE_ESTIMATE_OPTIONS)
    return {
        "distribution": estimate["distribution"],
        "feeValue": estimate["feeValue"],
    }


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


@pytest.fixture(scope="session")
def profiling_transaction_context() -> dict[str, object]:
    """Inject the canonical web/LLM fixture through RC mock validators.

    Consensus v0.6 Studio no longer exposes the pre-RC ``sim_installMocks``
    RPC.  The matching gltest RC instead serializes mock validators into the
    transaction context, which keeps this profiling run deterministic without
    changing the frozen contract or its production runtime behavior.
    """
    validator_factory = get_validator_factory()
    validators = validator_factory.batch_create_mock_validators(
        count=5,
        mock_llm_response={
            "nondet_exec_prompt": {
                "RecallGuard applicability evaluator": json.dumps(
                    {"verdict": "AFFECTED"}, separators=(",", ":")
                )
            }
        },
        mock_web_response={
            "nondet_web_request": {
                "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26741": {
                    "method": "GET",
                    "status": 200,
                    "body": frozen_cpsc_response(),
                }
            }
        },
    )
    return {
        "validators": [validator.to_dict() for validator in validators],
        "genvm_datetime": "2026-09-12T00:00:00Z",
    }


def test_representative_v06_deploy_register_and_assessment(profiling_transaction_context):
    factory = get_contract_factory(contract_file_path=Path("recall_guard.py"))
    account = get_default_account()
    existing_address = os.environ.get("PROFILE_EXISTING_DEPLOYMENT_ADDRESS")
    existing_tx = os.environ.get("PROFILE_EXISTING_DEPLOYMENT_TX")
    if existing_address and existing_tx:
        existing_receipt = get_gl_client().provider.make_request(
            "gen_getStudioTransactionByHash", [existing_tx, True]
        )["result"]
        assert existing_receipt["status"] == "FINALIZED"
        assert existing_receipt["txExecutionResultName"] == "FINISHED_WITH_RETURN"
        get_fee_profile_collector().record_deploy(existing_receipt)
        contract = factory.build_contract(existing_address, account=account)
    else:
        contract = factory.deploy(
            args=[["saferproducts.gov"], ["amazon.com"]],
            account=account,
            transaction_context=profiling_transaction_context,
            fees=transaction_fee_preset(),
            wait_until="finalized",
            wait_interval=1000,
            wait_retries=900,
        )

    registration = contract.register_listing(
        args=[
            "www.amazon.com",
            "fee-profile-005",
            "MISTOLIN",
            "Scented Mistolin",
            "Clorox",
            "Scented Mistolin",
            "PR01-25100",
            "https://www.amazon.com/dp/B08N5KWB9H",
        ]
    ).transact(
        transaction_context=profiling_transaction_context,
        fees=transaction_fee_preset(),
        wait_until="finalized",
        wait_interval=1000,
        wait_retries=900,
    )
    get_fee_profile_collector().record_method("register_listing", registration)

    listing_id = contract.get_listing_ids().call()[-1]
    assessment = contract.request_assessment(args=[listing_id, "26741"]).transact(
        transaction_context=profiling_transaction_context,
        fees=transaction_fee_preset(),
        wait_until="finalized",
        wait_interval=1000,
        wait_retries=900,
    )
    get_fee_profile_collector().record_method("request_assessment", assessment)
