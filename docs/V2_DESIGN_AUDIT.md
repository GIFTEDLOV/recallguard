# RecallGuard V2 adversarial design audit

Status: design baseline recorded before V2 implementation.

## Scope and V1 boundary

V1 is preserved at commit `29c973568eaeaffde91d2138d08eb8ade2a0a7d8` and its
contract source digest is recorded in `docs/V1_FREEZE.md`. V2 is a new branch
and will not reuse the V1 production address. The steward feedback is treated
as a trust-model finding, not as a copy or presentation issue.

## Confirmed V1 trust gaps

1. `register_listing` stores `ACTIVE` before any consensus-backed assessment.
   The state is therefore indistinguishable from a cleared result and can be
   shown as safe by a careless consumer.
2. `request_assessment` requires `listing.owner == msg.sender`. An owner can
   suppress a recall check by declining to submit it. This is a protocol
   authorization defect, not a UI defect.
3. V1's `state_after` is selected from only the new verdict and assigned to the
   listing. A later `NOT_AFFECTED` can erase an earlier `AFFECTED` or
   `INCONCLUSIVE` result.
4. V1's listing ID includes product name, listing evidence URL, and evidence
   digest. Changing descriptive or mutable evidence fields can create a new
   ID and escape the old history.
5. V1's assessment identity includes a listing-evidence digest. The same recall
   notice can be assessed repeatedly after evidence changes, without a single
   explicit notice identity policy.
6. The V1 recall allowlist is useful for source admissibility but does not
   authenticate a legal authority or prove that a page is immutable. V1 also
   lacks a distinct marketplace/listing-evidence policy.

## Threat and invariant audit

### Listing identity

An attacker can vary product name, listing URL, evidence URL, or evidence hash
to obtain a fresh V1 listing ID. There is no explicit marketplace host plus
external listing identifier binding. V2 will use a stable canonical tuple of
marketplace host, marketplace listing identifier, product identifier,
manufacturer, model, and serial/lot where supplied. The URL and evidence hash
are stored evidence snapshots and are not part of the stable identity.

The identity proves only that the contract saw the same canonical identifiers;
it does not prove ownership, title, authenticity of the item, or that a
marketplace will never recycle an external identifier.

### Initial state semantics

V1 registration is `ACTIVE`, conflating existence with clearance. V2 registration
must be `UNASSESSED`, and only a successful finalized `NOT_AFFECTED` assessment
can produce `CLEARED`.

### Assessment authorization and suppression

V1 is owner-only. V2 assessment writes are permissionless for any sender once a
listing exists. The sender is retained as `requested_by` for provenance. There
is no owner cancellation, overwrite, appeal, administrator veto, or state reset.

### Recall source authentication and admissibility

The contract can enforce HTTPS, an exact configured host or subdomain policy,
HTTP 200, strict UTF-8, bounded bytes, and a body SHA-256 match. These establish
admissibility and byte integrity under the configured policy. They do not prove
government authority, domain control, signatures, legal effect, or permanence.
V2 retains this boundary and stores the canonical recall notice identity.

### Listing source authentication and admissibility

V1 accepts any HTTPS listing evidence URL. V2 will separately configure
marketplace domains for listing URLs and listing-evidence domains for the
evidence snapshot. Both still require HTTPS, HTTP 200, bounded strict UTF-8,
and an exact digest. A marketplace allowlist is a policy boundary, not a
cryptographic signature.

### Evidence integrity and malicious content

SHA-256 checks the fetched bytes only. Consensus authenticates neither source
nor content. Source text is untrusted and may contain prompt injection, fake
verdicts, malformed JSON, or misleading claims. V2 continues to delimit source
text in the evaluator prompt and accepts only a strict verdict enum.

### Repeated and conflicting notices

V1 overwrites the listing with the latest mapped result and treats `BLOCKED` as
terminal. V2 appends only successful finalized assessments, derives state from
the full relevant history, and gives priority `AFFECTED` > `INCONCLUSIVE` >
`NOT_AFFECTED`. A favorable later result cannot clear a previous adverse or
unresolved result. The notice identity is the hash of canonical recall URL plus
the exact committed notice body digest; the same listing plus notice identity
is rejected as a duplicate.

### State aggregation

Only `FINALIZED` assessments are relevant. Failed fetches, failed parsing,
validator disagreement, timeouts, and consensus failures produce no business
verdict and no assessment or listing-state mutation. A finalized assessment's
`state_after` is the derived aggregate after appending that assessment, not a
verdict-only replacement.

### Duplicate checks and replay

The assessment ID is deterministic from listing ID and notice identity. This
prevents replay of the same notice against the same stable listing, even if a
mutable listing evidence snapshot later changes. Different notices remain
independently auditable. Registration rejects an already-used stable listing
identity.

### Finality and transaction recovery

The client must broadcast once, persist the returned hash immediately, reconcile
that hash after refresh or ambiguous RPC response, verify finalized execution,
and then read expected contract state. A hash, accepted status, or finality
without successful execution is not success. There is no blind rebroadcast.

### Frontend/contract divergence

The contract is authoritative for state, verdict, requester, notice identity,
source authority, and attestation. The frontend may calculate candidate hashes
for convenience but must reread the contract after finality and present a
loading, empty, error, pending, failed, disagreement, wrong-network, and wallet
disconnect state without inventing a verdict.

### Consensus failure and unavailable evidence

Source-fetch consensus failure must fail closed. Model disagreement, timeout,
invalid JSON, extra fields, wrong types, and invalid verdicts must fail closed.
No failure may be mapped to `NOT_AFFECTED`, and no failed path may append an
assessment or change an aggregate state.

## V2 design decisions

1. Authoritative listing states are exactly `UNASSESSED`, `CLEARED`,
   `REVIEW_REQUIRED`, and `BLOCKED`.
2. Registration stores `UNASSESSED`.
3. Assessment is permissionless and append-only.
4. Identity is stable and evidence snapshots are separate fields.
5. Recall and listing sources have separate allowlists and the same bounded
   integrity pipeline.
6. State is derived from all finalized assessments, with adverse and unresolved
   results taking priority over favorable results.
7. No V2 deployment occurs in this phase.

## Residual limitations to test and disclose

- An allowlist is not a signed oracle; a configured domain could publish a
  stale or misleading page.
- SHA-256 commits bytes assessed at execution time and does not guarantee the
  URL remains unchanged.
- External listing identifiers are only as stable as the marketplace policy
  that issues them; the identity scheme cannot prove physical possession.
- GenLayer validator execution and live Bradbury behavior still require a
  multi-validator test before deployment.
