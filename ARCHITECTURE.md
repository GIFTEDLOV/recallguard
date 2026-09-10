# RecallGuard V2 architecture

RecallGuard evaluates whether a specific marketplace listing falls within the
affected scope of an admissible product-recall notice. The GenLayer
Intelligent Contract owns listing identity, evidence admissibility, semantic
verdict, finalized assessment history, and the derived listing state.

## Authoritative state model

The only listing states are:

- `UNASSESSED`: no successful consensus-backed assessment exists.
- `CLEARED`: at least one finalized relevant assessment exists and all recorded
  relevant verdicts are `NOT_AFFECTED`.
- `REVIEW_REQUIRED`: no `AFFECTED` assessment exists, but at least one
  finalized relevant verdict is `INCONCLUSIVE`.
- `BLOCKED`: at least one finalized relevant verdict is `AFFECTED`.

Registration always creates `UNASSESSED`. It never creates `CLEARED`.
State is derived from the complete finalized history with priority
`AFFECTED > INCONCLUSIVE > all NOT_AFFECTED`; a later favorable notice cannot
erase an adverse or unresolved result.

## Stable listing identity

The stable listing ID is the SHA-256 of this exact JSON array, after trimming,
lowercasing, and collapsing whitespace in each part:

```text
[marketplace_host, external_listing_id, product_id, manufacturer, model, serial_or_lot]
```

The marketplace host must match the HTTPS listing URL and be in the configured
marketplace allowlist. The external listing identifier is the marketplace's
stable source identity. Product name, listing URL path, evidence URL, and
evidence digest are deliberately separate mutable evidence-snapshot fields;
changing a snapshot cannot create a new stable listing identity. This does not
prove ownership, title, physical authenticity, legal authority, or that a
marketplace will never recycle an external identifier.

The canonical implementation is duplicated in
`frontend/lib/canonical.ts`, with a cross-implementation vector test.

## Source trust boundary

Recall notices, marketplace listing URLs, and listing evidence URLs are
separately configured by domain allowlists. Every fetched source must be HTTPS,
resolve to HTTP 200, decode as strict UTF-8, stay within the byte limit, and
match its lowercase SHA-256 commitment. These checks establish policy
admissibility and byte integrity. They do not authenticate a legal authority,
domain control, signatures, or page permanence. Consensus authenticates neither
source nor content; it only makes the semantic decision reproducible.

Fetched content is untrusted evidence. The evaluator receives delimited source
text and strict instructions, and the contract accepts only a JSON object with
one exact verdict field. Malformed output, extra fields, invalid enums, fetch
failure, validator disagreement, timeout, and unavailable evidence revert with
no business verdict and no authoritative state mutation.

## Permissionless assessment

`request_assessment(listing_id, recall_url, recall_sha256)` is permissionless.
Owners and unrelated marketplace operators use the same path. `requested_by`
is stored on the finalized assessment. There is no owner cancellation,
overwrite, suppression, appeal, or administrator veto.

Notice identity is the SHA-256 of the canonical recall URL plus the exact
recall-body digest. Assessment identity is the SHA-256 of
`[listing_id, notice_id]`. A duplicate listing/notice pair is rejected even if
the listing's mutable evidence snapshot would later change; distinct notices
remain independently auditable.

## Public API

Writes:

- `register_listing(marketplace_host, external_listing_id, product_id,
  product_name, manufacturer, model, serial_or_lot, listing_url, evidence_url,
  evidence_sha256)`
- `request_assessment(listing_id, recall_url, recall_sha256)`

Views:

- `get_listing`, `get_assessment`, `get_listing_ids`, `get_assessment_ids`
- `get_listing_assessments`, `get_attestation`, `contract_info`

Views expose stable identity, owner, current derived state, assessment history,
requester, notice identity, source authority semantics, verdict, finalized
status, and evidence commitments.

## Frontend authority boundary

The frontend reads state and verdicts from contract views. It calculates hashes
only as input conveniences and never derives a business verdict. Listing detail
pages show `Not yet assessed`, `Cleared by consensus`, `Review required`, and
`Blocked` distinctly; `UNASSESSED` is neutral and never presented as safe,
verified, active, or approved. Any connected wallet can reach the challenge
flow from a listing detail page.

Every write uses:

```text
precondition read -> broadcast once -> persist hash -> reconcile same hash
-> finalized -> verify execution -> read expected state
```

Refresh, wallet disconnect, ambiguous RPC responses, pending status, failed
execution, and wrong network do not trigger a blind rebroadcast.

## Release boundary

V1 production provenance remains in `PROVENANCE.md` and `docs/V1_FREEZE.md`.
V2 is not deployed to Bradbury, does not replace the V1 contract, and does not
change the V1 production Vercel project in this development phase. Live
multi-validator testing remains a release gate.
