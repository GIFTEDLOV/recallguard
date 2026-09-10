# RecallGuard V2 architecture

RecallGuard evaluates whether a specific marketplace listing falls within the
affected scope of an admissible product-recall notice. The GenLayer
Intelligent Contract owns listing identity, evidence admissibility, semantic
verdict, recorded assessment history, and the derived listing state. GenLayer
protocol transaction finality remains an external transaction-lifecycle fact.

## Authoritative state model

The only listing states are:

- `UNASSESSED`: no successful consensus-backed assessment exists.
- `CLEARED`: at least one recorded relevant assessment exists and all recorded
  relevant verdicts are `NOT_AFFECTED`.
- `REVIEW_REQUIRED`: no `AFFECTED` assessment exists, but at least one
  recorded relevant verdict is `INCONCLUSIVE`.
- `BLOCKED`: at least one recorded relevant verdict is `AFFECTED`.

Registration always creates `UNASSESSED`. It never creates `CLEARED`.
State is derived from the complete recorded history with priority
`AFFECTED > INCONCLUSIVE > all NOT_AFFECTED`; a later favorable notice cannot
erase an adverse or unresolved result.

## Stable listing identity

The stable listing ID is the SHA-256 of this exact JSON array, after
canonicalizing the host and trimming, lowercasing, and collapsing whitespace
in the external identifier:

```text
[identity_version, marketplace_host, external_listing_id]
```

The marketplace host must match the HTTPS listing URL and be in the configured
marketplace allowlist. Host case, a default `:443` port, and a trailing DNS dot
cannot split identity. The external listing identifier is the marketplace's
stable source reference. Product ID, name, manufacturer, model, serial/lot,
listing URL, evidence URL, and evidence digest are stored metadata or snapshots
and cannot create a new identity. The current policy treats each configured
host as its own namespace. A marketplace that recycles an external ID must
supply a stable generation in the external reference or receive a new
identity-version policy; the contract does not guess reuse semantics.

This identity proves only that the contract saw the same canonical marketplace
reference. It does not prove ownership, title, physical authenticity, listing
availability, recall authority, or that the marketplace will never recycle an
identifier.

The independent TypeScript implementation is in `frontend/lib/canonical.ts`,
with byte-for-byte vectors tested against the Python contract implementation.

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

`request_assessment(listing_id, recall_url, notice_reference, recall_sha256)` is permissionless.
Owners and unrelated marketplace operators use the same path. `requested_by`
is stored on the recorded assessment. There is no owner cancellation,
overwrite, suppression, appeal, or administrator veto.

Logical notice identity is the SHA-256 of
`[notice_identity_version, authoritative_source_host, authority-issued_notice_reference]`.
The canonical public URL and recall-body SHA are evidence-snapshot fields. A
snapshot ID is the SHA-256 of `[notice_id, recall_sha256]`; assessment identity
is the SHA-256 of `[listing_id, snapshot_id]`. An exact listing/notice/snapshot
replay—including a URL query variation—is rejected. A new committed snapshot
of the same logical notice may be recorded under the same `notice_id`, while
all historical verdicts remain part of aggregate state.

## Public API

Writes:

- `register_listing(marketplace_host, external_listing_id, product_id,
  product_name, manufacturer, model, serial_or_lot, listing_url, evidence_url,
  evidence_sha256)`
- `request_assessment(listing_id, recall_url, notice_reference, recall_sha256)`

Views:

- `get_listing`, `get_assessment`, `get_listing_ids`, `get_assessment_ids`
- `get_listing_assessments`, `get_attestation`, `contract_info`

Views expose stable identity, owner, current derived state, assessment history,
requester, logical notice identity, notice reference, snapshot identity, source
authority semantics, verdict, recorded contract status, and evidence
commitments.

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
-> protocol finalized -> verify execution -> read expected state
```

Refresh, wallet disconnect, ambiguous RPC responses, pending/accepted status,
failed execution, and wrong network do not trigger a blind rebroadcast.

## Authority and governance

V2 has no owner/admin address and no post-deployment policy mutators. No address
can change a source allowlist, delete a listing or assessment, overwrite a
verdict, manually unblock a listing, or suppress a challenger. The allowlists
are immutable constructor inputs, so deployment configuration is a governance
boundary and must be frozen and reproduced from
`config/v2_source_policy.json`.

## Release boundary

V1 production provenance remains in `PROVENANCE.md` and `docs/V1_FREEZE.md`.
V2 is not deployed to Bradbury, does not replace the V1 contract, and does not
change the V1 production Vercel project in this development phase. Live
multi-validator testing remains a release gate.
