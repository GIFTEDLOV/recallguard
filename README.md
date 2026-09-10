# RecallGuard V2

RecallGuard is a GenLayer product-safety application for one narrow question:

> Given the immutable registered product/listing facts for this RecallGuard
> record, does the independently retrieved authoritative CPSC recall record
> place that described product within the affected recall scope?

It does not prove that Amazon or another marketplace displayed the registered
facts, that a seller told the truth, that SHA-256 authenticates a publisher, or
that a cleared record is universally safe. The contract records facts supplied
by an address and preserves the consensus-backed CPSC applicability result.

V2 is developed on `v2/remediation`. It is not deployed to Bradbury in this
phase. V1 production evidence remains preserved in Git history,
`PROVENANCE.md`, and [docs/V1_FREEZE.md](docs/V1_FREEZE.md).

## Authoritative states

- `UNASSESSED` - Not yet assessed. Registration always starts here.
- `CLEARED` - Cleared by consensus against the recorded assessments and
  registered facts.
- `REVIEW_REQUIRED` - An admissible, genuinely ambiguous assessment remains.
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
clear, verified, approved, or active.

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
