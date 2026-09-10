"""Shared V2 direct-mode helpers."""

import os


def deploy_recall_guard(direct_deploy, recall_domains=None, marketplace_domains=None, evidence_domains=None):
    return direct_deploy(
        os.environ.get("RECALLGUARD_CONTRACT_PATH", "contracts/recall_guard.py"),
        recall_domains or ["recalls.example.gov"],
        marketplace_domains or ["market.example"],
        evidence_domains or ["catalog.example"],
    )


def evidence_hash(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def listing_args(evidence_url: str, evidence_body: str, *, external_listing_id: str = "external-001"):
    return [
        "market.example",
        external_listing_id,
        "PROD-001",
        "Example Pump",
        "Example Manufacturer",
        "XP-100",
        "LOT-7",
        "https://market.example/item/PROD-001",
        evidence_url,
        evidence_hash(evidence_body),
    ]


def listing_args_for(
    *,
    marketplace_host: str = "market.example",
    external_listing_id: str = "external-001",
    product_id: str = "PROD-001",
    product_name: str = "Example Pump",
    manufacturer: str = "Example Manufacturer",
    model: str = "XP-100",
    serial_or_lot: str = "LOT-7",
    listing_url: str = "https://market.example/item/PROD-001",
    evidence_url: str = "https://catalog.example/item/1",
    evidence_body: str = "Product page: Example Pump XP-100, lot LOT-7.",
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
        evidence_url,
        evidence_hash(evidence_body),
    ]


def notice_reference_for(recall_url: str) -> str:
    """Test helper mirroring an authority-issued reference, not URL identity."""
    return "NOTICE-" + recall_url.rstrip("/").split("/")[-1].split("?")[0].upper()
