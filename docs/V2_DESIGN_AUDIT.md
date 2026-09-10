# RecallGuard V2 adversarial design audit

Status: hardened V2 release-candidate audit; findings are preserved as design
decisions and test obligations.

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
to obtain a fresh V1 listing ID. V2 binds the explicit source namespace and
external marketplace reference only: the exact canonical tuple is
`[identity_version, marketplace_host, external_listing_id]`. Product ID,
manufacturer, model, serial/lot, title, URL representation, and evidence SHA
are stored metadata or snapshots and do not split the stable ID. Host case,
default `:443`, and a trailing dot are canonicalized; query strings are not an
identity key.

The configured host is the namespace. If a marketplace recycles an external
ID, the operator must supply a stable generation in the external reference or
the policy must move to a new identity version. The identity proves only that
the contract saw the same source reference; it does not prove ownership, title,
authenticity, listing availability, or that a marketplace will never recycle an
identifier. See `docs/LISTING_IDENTITY.md` for the independent implementation
and vectors.

### Initial state semantics

V1 registration is `ACTIVE`, conflating existence with clearance. V2 registration
must be `UNASSESSED`, and only a successful recorded `NOT_AFFECTED` assessment
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
terminal. V2 appends only successful recorded assessments, derives state from
the full relevant history, and gives priority `AFFECTED` > `INCONCLUSIVE` >
`NOT_AFFECTED`. A favorable later result cannot clear a previous adverse or
unresolved result. The logical notice identity is the hash of
`[notice_identity_version, authoritative_source_host, authority-issued
notice_reference]`. Its canonical URL and body SHA are a separate evidence
snapshot. The assessment identity binds the listing to that snapshot; an exact
snapshot replay is rejected, while an explicitly updated snapshot of the same
logical notice retains the same `notice_id`.

### State aggregation

Only `RECORDED` assessments are relevant. Failed fetches, failed parsing,
validator disagreement, timeouts, and consensus failures produce no business
verdict and no assessment or listing-state mutation. A recorded assessment's
`state_after` is the derived aggregate after appending that assessment, not a
verdict-only replacement. `RECORDED` is contract storage terminology; protocol
transaction finality is established by the external GenLayer lifecycle.

### Duplicate checks and replay

The assessment ID is deterministic from listing ID and evidence snapshot ID.
The snapshot ID is deterministic from logical notice ID and recall-body SHA.
This prevents exact replay of the same snapshot against the same stable
listing—including URL query changes—while allowing a new snapshot to be
explicitly recorded under the same logical notice. Different authority
namespaces and notice references remain independently auditable. Registration
rejects an already-used stable listing identity.

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
6. State is derived from all recorded assessments, with adverse and unresolved
   results taking priority over favorable results.
7. Contract storage status is `RECORDED`; protocol transaction finality is an
   external lifecycle fact, not a contract field.
8. The exact RC source policy is frozen in `config/v2_source_policy.json` and
   remains gated on live retrieval proof.
9. No V2 deployment occurs in this phase.

### Authority and governance

There is no owner/admin address and no write method for changing recall,
marketplace, or listing-evidence allowlists. No address can delete listings or
assessments, overwrite verdicts, manually unblock a listing, cancel a
challenger's assessment, or suppress a third-party request. The constructor
allowlists are immutable after deployment; the deployment script reads the
committed source policy and rejects drift.

## Residual limitations to test and disclose

- An allowlist is not a signed oracle; a configured domain could publish a
  stale or misleading page.
- SHA-256 commits bytes assessed at execution time and does not guarantee the
  URL remains unchanged.
- External listing identifiers are only as stable as the marketplace policy
  that issues them; the identity scheme cannot prove physical possession.
- GenLayer validator execution and live Bradbury behavior still require a
  multi-validator test before deployment.
