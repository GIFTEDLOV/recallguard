"""Read-only CPSC probe through the installed GLSim live-I/O web handler."""

from __future__ import annotations

import hashlib
import json
import sys
import time
from urllib.parse import urlparse

from glsim.live_io import create_web_handler


URL = "https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26741"


def canonical_record(record: dict) -> dict:
    return {
        "recall_id": record["RecallID"],
        "recall_number": record["RecallNumber"].strip().upper(),
        "recall_date": record["RecallDate"].strip(),
        "title": record["Title"].strip(),
        "description": record["Description"].strip(),
        "products": sorted([
            {"name": p["Name"].strip(), "description": p["Description"].strip(), "model": p["Model"].strip(), "type": p["Type"].strip()}
            for p in record["Products"]
        ], key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":"))),
        "manufacturers": sorted([{"name": m["Name"].strip()} for m in record["Manufacturers"]], key=lambda item: json.dumps(item, ensure_ascii=False, sort_keys=True, separators=(",", ":"))),
        "product_upcs": sorted([item["UPC"].strip() for item in record["ProductUPCs"]]),
        "hazards": sorted([item["Name"].strip() for item in record["Hazards"]]),
        "remedies": sorted([item["Name"].strip() for item in record["Remedies"]]),
    }


def main() -> int:
    handler = create_web_handler(use_browser=False)
    started = time.perf_counter()
    result = handler({"url": URL, "method": "GET"})
    latency_ms = round((time.perf_counter() - started) * 1000, 1)
    response = result["ok"]["response"]
    body = response.get("body", b"")
    if isinstance(body, str):
        body = body.encode("utf-8")
    item: dict[str, object] = {
        "url": URL,
        "status": response.get("status"),
        "response_type": response.get("headers", {}).get("content-type", ""),
        "response_bytes": len(body),
        "raw_sha256": hashlib.sha256(body).hexdigest(),
        "utf8": False,
        "effective_hostname": urlparse(URL).hostname,
        "redirects_observable": False,
        "latency_ms": latency_ms,
        "stable_facts_equal": False,
        "stable_facts_sha256": None,
        "exact_record_count": 0,
    }
    try:
        text = body.decode("utf-8")
        item["utf8"] = True
        parsed = json.loads(text)
        exact = [record for record in parsed if isinstance(record, dict) and str(record.get("RecallNumber", "")).strip().upper() == "26741"]
        item["exact_record_count"] = len(exact)
        if len(exact) == 1:
            facts = json.dumps(canonical_record(exact[0]), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
            item["stable_facts_sha256"] = hashlib.sha256(facts.encode("utf-8")).hexdigest()
            item["stable_facts_equal"] = True
    except Exception as error:
        item["parse_error"] = type(error).__name__
    print(json.dumps(item, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
