"""Shared direct-mode fixtures for the CPSC-only V2 contract."""

import hashlib
import json
import os

import pytest


@pytest.fixture(autouse=True)
def strict_genvm_controls(direct_vm):
    # These are official gltest controls. Pickling is also asserted explicitly
    # in test_storage_boundary because the current direct unsafe shim does not
    # enforce it for every closure.
    direct_vm.strict_mocks = True
    direct_vm.check_pickling = True
    yield
    direct_vm.strict_mocks = False
    direct_vm.check_pickling = False


def deploy_recall_guard(direct_deploy, recall_domains=None, marketplace_domains=None):
    return direct_deploy(
        os.environ.get("RECALLGUARD_CONTRACT_PATH", "contracts/recall_guard.py"),
        recall_domains or ["saferproducts.gov"],
        marketplace_domains or ["market.example"],
    )


def json_body(record):
    return json.dumps([record], ensure_ascii=False, separators=(",", ":"))


def cpsc_record(
    recall_number="26741",
    *,
    title="Example Pump recall",
    description="The Example Pump XP-100 may overheat and presents a hazard.",
    product_name="Example Pump",
    product_description="Example Pump XP-100, lot LOT-7.",
    model="XP-100",
    manufacturer="Example Manufacturer",
    recall_id=10940,
    **extra,
):
    record = {
        "RecallID": recall_id,
        "RecallNumber": recall_number,
        "RecallDate": "2026-09-03",
        "Title": title,
        "Description": description,
        "URL": "https://www.cpsc.gov/Recalls/2026/example-pump",
        "Products": [{
            "Name": product_name,
            "Description": product_description,
            "Model": model,
            "Type": "Pump",
            "CategoryID": 42,
            "NumberOfUnits": "1000",
        }],
        "Manufacturers": [{"Name": manufacturer, "CompanyID": 900}],
        "ProductUPCs": [{"UPC": "000123456789"}],
        "Hazards": [{"Name": "The pump may overheat."}],
        "Remedies": [{"Name": "Refund"}],
    }
    record.update(extra)
    return record


def evidence_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def listing_args_for(
    *,
    marketplace_host="market.example",
    external_listing_id="external-001",
    product_id="PROD-001",
    product_name="Example Pump",
    manufacturer="Example Manufacturer",
    model="XP-100",
    serial_or_lot="LOT-7",
    listing_url="https://market.example/item/PROD-001",
):
    return [
        marketplace_host,
        external_listing_id,
        product_id,
        product_name,
        manufacturer,
        model,
        serial_or_lot,
        listing_url,
    ]


def listing_args(*, external_listing_id="external-001", **kwargs):
    return listing_args_for(external_listing_id=external_listing_id, **kwargs)


def mock_cpsc(direct_vm, record=None, *, response_body=None, status=200, recall_identifier="26741"):
    if response_body is None:
        response_body = json_body(record or cpsc_record(recall_identifier))
    direct_vm.mock_web(
        r"saferproducts\.gov/RestWebServices/Recall\?format=json&RecallNumber=" + recall_identifier,
        {"status": status, "body": response_body},
    )


def mock_verdict(direct_vm, verdict="NOT_AFFECTED"):
    direct_vm.mock_llm(
        r"RecallGuard applicability evaluator",
        json.dumps(json.dumps({"verdict": verdict}, separators=(",", ":"))),
    )


def setup_listing(contract, **kwargs):
    contract.register_listing(*listing_args(**kwargs))
    return contract.get_listing_ids()[0]


def request_one(contract, direct_vm, listing_id, *, recall_identifier="26741", record=None, verdict="NOT_AFFECTED", sender=None):
    direct_vm.clear_mocks()
    if sender is not None:
        direct_vm.sender = sender
    mock_cpsc(direct_vm, record=record, recall_identifier=recall_identifier)
    mock_verdict(direct_vm, verdict)
    contract.request_assessment(listing_id, recall_identifier)
    return contract.get_assessment(contract.get_assessment_ids()[-1])
