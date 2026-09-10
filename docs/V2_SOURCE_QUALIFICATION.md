# V2 source qualification

Status: source gate recorded; no blockchain transaction, application write,
deployment, or semantic fixture execution was performed.

The final-runner CPSC probe was run five times as separate
`python tools/probe_cpsc_source.py` observations through the installed
GLSim live-I/O HTTP handler with network access enabled. This is a GenVM
web-runtime retrieval probe, not protocol consensus or finality.

## CPSC authority and endpoint

- Authority: United States Consumer Product Safety Commission.
- Host: `www.saferproducts.gov`.
- Exact path: `/RestWebServices/Recall`.
- Frozen URL:
  `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26741`.
- Caller URL control: none; the contract constructs this URL from a bounded
  recall identifier.

## Five-observation CPSC result

All five observations had the following stable transport and shape result:

| Observation | HTTP | Response type | Bytes | Raw SHA-256 | UTF-8 | Exact records | Stable fact SHA-256 | Effective host | Redirects | Latency ms |
| --- | ---: | --- | ---: | --- | --- | ---: | --- | --- | --- | ---: |
| 1 | 200 | `application/json; charset=utf-8` | 3839 | `387b1edf29c18776b21b74e5f836d119c91e7aca0c3fb95e86f0781dbe22fcff` | yes | 1 | `af1d69a4b450a352a404f86bde7c602a2b15435139a48570e25c6a814ee0d927` | `www.saferproducts.gov` | not observable / none reported | 2052.1 |
| 2 | 200 | `application/json; charset=utf-8` | 3839 | same | yes | 1 | same | same | not observable / none reported | 1307.3 |
| 3 | 200 | `application/json; charset=utf-8` | 3839 | same | yes | 1 | same | same | not observable / none reported | 1301.6 |
| 4 | 200 | `application/json; charset=utf-8` | 3839 | same | yes | 1 | same | same | not observable / none reported | 1326.8 |
| 5 | 200 | `application/json; charset=utf-8` | 3839 | same | yes | 1 | same | same | not observable / none reported | 1543.5 |

The exact record contained `RecallID=10940`, `RecallNumber=26741`, and the
decision fields required by the adapter. The canonical extractor includes only
recall identity/date/title/description, product name/description/model/type,
manufacturer names, UPCs, hazards, and remedies. It excludes public URLs,
contacts, images, counters, publish metadata, wrapper noise, and ordering.

The five observations therefore pass the current non-write CPSC transport,
exact-record, canonical-facts, and snapshot-hash gate. The raw SHA is recorded
for probe provenance only; the contract does not accept or store a raw body
commitment. The canonical hash is the frozen snapshot value in
`fixtures/v2_live_fixtures.json`.

The initial sandbox-only run returned a synthetic HTTP 502 wrapper because the
environment blocked outbound retrieval. It was not counted as qualification;
the same unchanged probe was rerun with read-only network access.

## Amazon qualification history

Amazon was tested before this final boundary decision at:
`https://www.amazon.com/dp/B08N5KWB9H` using both `gl.nondet.web.get`-shaped
retrieval and render-text probing. Five observations alternated between a
large dynamic HTML page and 3,781-byte CAPTCHA/Continue-shopping responses;
stable product facts were not consistently available. No workaround was used.

Amazon is therefore **not qualified** and is removed from the RecallGuard
consensus evidence path. It remains only a marketplace namespace and
informational navigation URL. No Amazon HTML hash, render result, or seller
claim is used by the contract.

## Decision

- `CPSC_SOURCE_QUALIFIED`: **YES for the final-runner five-observation
  transport/extraction gate; not a substitute for the pending multi-validator
  semantic proof**. The fixed CPSC API passed HTTP, exact-record,
  canonical-facts, and snapshot-hash requirements 5/5.
- `CPSC_API_QUALIFIED`: YES for the five-observation non-write retrieval gate.
- `AMAZON_SOURCE_QUALIFIED`: NO.
- `LISTING_EVIDENCE_SOURCE_QUALIFIED`: NO; V2 has no listing-evidence
  consensus source class.
- `FIXTURE_A/B/C`: not run. The coherent v0.6 Python/JS/CLI family is pinned,
  but local Studio/GLSim execution stalls before a transaction receipt and no
  measured fee profile is available. Amazon's failure is not a blocker to the
  CPSC-only contract path because Amazon is not consensus evidence. No
  Bradbury transaction was broadcast.
