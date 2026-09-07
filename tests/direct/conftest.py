"""Shared direct-mode helpers."""


def deploy_recall_guard(direct_deploy, domains=None):
    return direct_deploy(
        "contracts/recall_guard.py",
        domains or ["recalls.example.gov"],
    )


def evidence_hash(text: str) -> str:
    import hashlib

    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def listing_args(evidence_url: str, evidence_body: str):
    return [
        "PROD-001",
        "Example Pump",
        "Example Manufacturer",
        "XP-100",
        "LOT-7",
        "https://market.example/item/PROD-001",
        evidence_url,
        evidence_hash(evidence_body),
    ]
