# RecallGuard V2

RecallGuard is a GenLayer marketplace safety protocol for evidence-bound
product recall checks. V2 addresses two V1 trust-model defects identified by
GenLayer steward review: registration is not clearance, and a listing owner
cannot suppress an adverse assessment because assessment is permissionless.

V2 is implemented on branch `v2/remediation`. It is not deployed to Bradbury
in this phase. The V1 contract, production URL, deployment address, source
digest, and historical deployment evidence remain preserved in Git history,
`PROVENANCE.md`, and [docs/V1_FREEZE.md](docs/V1_FREEZE.md).

## Product model

Marketplaces, operators, resellers, and any connected user can register or
challenge a listing. RecallGuard evaluates the listing against an allowlisted
recall source through GenLayer consensus and stores an append-only attestation.

Authoritative listing states are:

- `UNASSESSED` — Not yet assessed. Registration always begins here.
- `CLEARED` — Cleared by consensus after at least one successful relevant
  `NOT_AFFECTED` assessment.
- `REVIEW_REQUIRED` — No affected result exists, but a finalized assessment is
  inconclusive.
- `BLOCKED` — At least one finalized relevant assessment is affected.

The aggregate priority is `AFFECTED > INCONCLUSIVE > all NOT_AFFECTED`.
Favorable later notices never erase a blocked or unresolved history.

## V2 contract API

Writes:

```text
register_listing(
  marketplace_host, external_listing_id, product_id, product_name,
  manufacturer, model, serial_or_lot, listing_url, evidence_url,
  evidence_sha256
)
request_assessment(listing_id, recall_url, recall_sha256)
```

`request_assessment` is permissionless. The contract stores `requested_by` and
does not provide owner cancellation, overwrite, suppression, or administrator
veto.

Views include `get_listing`, `get_assessment`, `get_listing_ids`,
`get_assessment_ids`, `get_listing_assessments`, `get_attestation`, and
`contract_info`.

## Identity and evidence

The stable listing ID hashes the normalized marketplace host, marketplace
external listing identifier, product identifier, manufacturer, model, and
serial/lot. Product name, canonical listing URL, evidence URL, and evidence
SHA-256 are separate evidence-snapshot fields and are not included in the
stable identity. This binds a marketplace reference without claiming ownership
or physical authenticity.

Recall, marketplace, and listing-evidence hosts have separate configured
allowlists. Fetched evidence must be HTTPS, HTTP 200, strict UTF-8, bounded in
size, and equal to its lowercase SHA-256 commitment. These checks establish
admissibility and byte integrity; they do not authenticate legal authority or
make mutable pages immutable. Consensus adjudicates semantic applicability but
does not authenticate evidence.

All model output must be exactly `{"verdict": "AFFECTED" | "NOT_AFFECTED" |
"INCONCLUSIVE"}`. Any evidence, model, or consensus failure creates no
business verdict and no state mutation.

## Application routes

The V2 application provides:

- `/` product landing page
- `/app` operations dashboard
- `/app/listings` searchable listing directory
- `/app/listings/new` stable identity registration
- `/app/listings/[id]` canonical identity, state, and full history
- `/app/listings/[id]/check` permissionless recall challenge
- `/app/assessments` and `/app/attestations` finalized assessment records
- `/app/activity` contract append-order activity

The interface explicitly labels `UNASSESSED` as “Not yet assessed” and never
uses safe, active, approved, verified, or clear language for that state.

## Verification

```powershell
python -m pytest tests/direct -q
cd frontend
npm test -- --run
npm run lint
npm run build
```

The direct GenVM suite covers registration, third-party authorization, source
policy, evidence integrity, strict model output, repeated notices, aggregate
state priority, identity stability, and failed-path non-mutation. A live
multi-validator Bradbury run is still required before any V2 deployment.

See [ARCHITECTURE.md](ARCHITECTURE.md) and
[docs/V2_DESIGN_AUDIT.md](docs/V2_DESIGN_AUDIT.md) for the full trust model,
threat audit, API semantics, and known limitations.
