# RecallGuard V2

RecallGuard is a GenLayer product-safety application for one narrow question:

> Given the immutable registered product/listing facts for this RecallGuard
> record, does the independently retrieved authoritative CPSC recall record
> place that described product within the affected recall scope?

It does not prove that Amazon or another marketplace displayed the registered
facts, that a seller told the truth, that SHA-256 authenticates a publisher, or
that a cleared record is universally safe. The contract records facts supplied
by an address and preserves the consensus-backed CPSC applicability result.

V2 is the current Studio-dev release. Historical V1 and superseded V2
deployment evidence remains preserved in Git history, `PROVENANCE.md`, and
[docs/V1_FREEZE.md](docs/V1_FREEZE.md).

## Authoritative V2 deployment

- Network: `Studio-dev`
- RPC: `https://studio-dev.genlayer.com/api`
- Chain ID: `61997`
- Contract: `0x6E2EAfF16124c513022Ad85751fD4dfF8d7e5580`
- Source SHA-256: `814fd01cd7d1c1d6ab3c2789a54ee76432bdc1e8653b4658b2dfc2348b0a3f3d`
- Deploy transaction: `0xd8ed4bf844bf8b1e35ccfa6f39382df4a4ef73c33eb774f089f3d4a877cd4c49`
- Live steward assessment: `0xa1d7ea20dd909cac43776a8a09b5186e8f6a7d94bb1023f050af8b9d7ab4d8ce`
- Canonical proof: [studio-dev-steward-proof-schema-fix-2026-09-14.json](deploy/evidence/studio-dev-steward-proof-schema-fix-2026-09-14.json)

The live steward proof registered listing `fc579fdf19698bf917bb7cc5a9e3d29a99fd45911d85306008e34c99cceaa3e0`, then a distinct challenger requested the assessment. It returned `AFFECTED`, changed the listing to `BLOCKED`, and produced verified append-only history and attestation records.

## Authoritative states

- `UNASSESSED` - Not yet assessed. No consensus clearance exists; this is not
  a safe or approved state.
- `CLEARED` - Cleared by consensus against the recorded assessments and
  registered facts; this is not universal product safety certification.
- `REVIEW_REQUIRED` - An admissible, genuinely ambiguous assessment remains
  and needs review.
- `BLOCKED` - At least one relevant affected assessment remains.

The aggregate priority is `AFFECTED > INCONCLUSIVE > NOT_AFFECTED`. A later
favorable assessment cannot erase an affected or unresolved history.

## Contract API

Writes:

```text
register_listing(
  marketplace_host, external_listing_id, product_id, product_name,
  manufacturer, model, serial_or_lot, listing_url
)
request_assessment(listing_id, recall_identifier)
```

Assessment is permissionless. The sender is stored as `requested_by`; the
listing owner has no approval, cancellation, overwrite, deletion, or manual
unblock power. The contract constructs the fixed CPSC API request itself:

```text
https://www.saferproducts.gov/RestWebServices/Recall
  ?format=json&RecallNumber=<bounded_identifier>
```

The caller cannot provide a URL, host, path, query, body, or verdict.

Views include `get_listing`, `get_assessment`, `get_listing_ids`,
`get_assessment_ids`, `get_listing_assessments`, `get_attestation`, and
`contract_info`.

## Identity and evidence boundary

The stable listing ID is the SHA-256 of the identity version, canonical
marketplace host, and normalized external listing ID. Product metadata,
canonical URL representation, evidence snapshots, and evidence hashes do not
change that identity. Amazon is only an informational marketplace namespace
and navigation URL; it is never fetched, rendered, hashed, or used in
consensus.

The logical notice ID is the SHA-256 of the notice version, `CPSC`, and exact
recall identifier. The snapshot ID is a SHA-256 of canonical decision-relevant
CPSC fields. A changed snapshot preserves logical notice identity and creates
an append-only historical assessment; exact duplicate listing/notice/snapshot
replays are rejected.

Source policy, content integrity, semantic adjudication, validator consensus,
and GenLayer protocol finality are separate layers. Raw CPSC bodies are not
stored. Model output is exactly one of `AFFECTED`, `NOT_AFFECTED`, or
`INCONCLUSIVE`. Source, model, timeout, VM, fee, or consensus failures create
no business verdict and no state mutation.

## Application routes

- `/` landing page and trust model
- `/app` operations dashboard
- `/app/listings` searchable directory
- `/app/listings/new` registration
- `/app/listings/[id]` complete listing detail and history
- `/app/listings/[id]/check` permissionless CPSC challenge
- `/app/assessments` assessment history
- `/app/attestations` verifiable records
- `/app/activity` transaction/activity history

Every listing detail page exposes the challenge path to any connected wallet.
The UI labels `UNASSESSED` as `Not yet assessed` and never presents it as safe,
clear, verified, approved, or active. A connected wallet does not need to be
the listing owner to request an assessment.

## Transaction safety

The application follows the documented GenLayer lifecycle: precondition read,
fee quote, one broadcast, immediate transaction-ID persistence, same-ID
finalization tracking, `status + FINISHED_WITH_RETURN` verification, then
authoritative state readback. Refreshes, timeouts, disconnects, or accepted
status do not trigger a blind replacement write.

## Verification

```powershell
python -m pytest tests/direct -q
Set-Location frontend
npm test -- --run --pool=threads --poolOptions.threads.singleThread
npm run lint
npm run build
```

The Vitest command used for the current Windows runner is:

```powershell
npm test -- --pool=threads --no-file-parallelism --maxWorkers=1
```

Offline gates and live-source qualification are recorded in
[docs/OFFICIAL_DOCS_AUDIT.md](docs/OFFICIAL_DOCS_AUDIT.md),
[docs/V2_SOURCE_POLICY.md](docs/V2_SOURCE_POLICY.md), and
[docs/V2_LIVE_FIXTURES.md](docs/V2_LIVE_FIXTURES.md). Bradbury deployment and
V1 production switching remain explicitly out of scope until the documented
toolchain, fee, CPSC, and multi-validator gates pass.
