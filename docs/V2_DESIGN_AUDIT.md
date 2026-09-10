# RecallGuard V2 adversarial architecture audit

Status: docs-alignment audit for the final release candidate. V1 history is
preserved and V1 production is not modified.

## Exact trust question

Given the immutable registered product/listing facts for a RecallGuard record,
does the independently retrieved authoritative CPSC recall record place that
described product within the affected recall scope?

The protocol proves stable record identity, facts registered by an address,
permissionless assessment, independent validator adjudication, accepted
shared state, and append-only history. It does not prove that a marketplace
displayed the facts, that a seller was truthful, that SHA-256 authenticates a
publisher, that a product is universally safe, or that consensus is legal
certification.

## Confirmed V1 trust gaps

1. Registration initialized `ACTIVE`, conflating existence with clearance.
2. Assessment was owner-only, allowing suppression by non-submission.
3. Latest-result assignment could erase earlier adverse or unresolved results.
4. Descriptive and mutable evidence fields influenced listing identity.
5. Notice/evidence identity was not separated into logical notice and snapshot.
6. Domain allowlisting and hashing were not publisher authentication.

## Threat audit and V2 disposition

### Listing identity

V2 hashes only identity version, canonical marketplace host, and normalized
external listing ID. Product ID, name, manufacturer, model, serial/lot, URL
representation, and evidence are not identity inputs. Host case, default port,
trailing dot, whitespace, and query tracking variations cannot split a record.
Marketplace ID reuse is not guessed: the marketplace must issue a stable
generation in the external ID or the policy must use a new identity version.
Independent TypeScript/Python vectors and duplicate-registration tests cover
this boundary. The ID does not prove marketplace display or product truth.

### Initial state and authorization

Registration stores `UNASSESSED`; no registration path stores `CLEARED`.
`request_assessment(listing_id, recall_identifier)` is permissionless and
stores `requested_by`. No owner or administrator can approve, cancel, delete,
overwrite, suppress, or manually unblock a result.

### Recall source admissibility

The contract constructs the fixed official CPSC API URL from a bounded recall
identifier. Caller-controlled URL, host, path, query, body, SHA, and authority
are excluded. It requires the frozen host/path policy, HTTP success, strict
UTF-8, bounded size, valid JSON, one exact requested record, and the observed
schema. A domain policy is admissibility, not legal authority; source content
remains mutable and untrusted.

### Listing source policy

The marketplace host is a namespace and listing URL is informational
navigation. Amazon is not fetched, rendered, hashed, or used for consensus.
The application says `REGISTERED FACTS` and `REGISTERED BY`; it does not claim
verified marketplace facts.

### Integrity and canonicalization

The raw CPSC body is never persisted or compared. Only recall identity/date,
title/description, product descriptors, manufacturers, UPCs, hazards, and
remedies are canonicalized. Irrelevant API-field changes leave the snapshot
unchanged; decision-relevant changes change it. SHA-256 binds canonical bytes;
it does not establish publisher authenticity.

### Repeated, conflicting, duplicate, and replayed notices

Logical notice identity is SHA-256 of `[notice_version, CPSC, exact_recall_id]`.
Snapshot identity is SHA-256 of canonical decision facts. The same logical
notice with a changed snapshot keeps the same notice ID and creates a separate
historical assessment. An exact listing/notice/snapshot duplicate is rejected.
Different recall numbers are different notices; URL query parameters are not a
notice identity input.

State is recomputed from every stored `ADJUDICATED` assessment, not from the
latest result: `AFFECTED > INCONCLUSIVE > NOT_AFFECTED > none`. Every ordering
of the same successful set produces the same derived state. `AFFECTED` remains
`BLOCKED`; `INCONCLUSIVE` remains `REVIEW_REQUIRED` despite later favorable
results.

### Duplicate checks and replay

Assessment ID binds listing ID, logical notice ID, and canonical snapshot hash.
Exact replay cannot append a second record. A later authoritative snapshot is
deliberately append-only, preserving old consequences rather than overwriting
history.

### Nondeterminism and storage boundary

The persisted listing is copied to memory before nondeterministic execution.
Leader and validator use `run_nondet_unsafe`; each independently fetches the
fixed CPSC record, canonicalizes it, hashes it, and derives the verdict. The
validator type-checks `Return`, `UserError`, and `VMError` before calldata and
compares notice ID, recall ID, snapshot hash, and verdict. Direct tests enable
strict mocks and pickling checks; direct-mode validator rollback limitations
are documented separately from production protocol consensus.

### Malicious evidence and malformed model output

The prompt is contract-constructed, has minimal caller text, delimits evidence
as data, instructs the model never to follow embedded commands, and accepts
exactly one verdict field. Prompt injection, fake JSON, fake system messages,
malicious text, extra fields, invalid enums, and model errors cannot become a
business verdict.

### Consensus, source availability, and stale mutable sources

Source/schema failures, timeouts, 5xx responses, malformed output, VM errors,
validator disagreement, and fee/transaction failures are not `INCONCLUSIVE`
or `NOT_AFFECTED`. They yield no authoritative assessment and no state
mutation. A successful assessment is a consensus statement about the
independently retrieved source snapshot at execution time; it does not freeze
the public CPSC page or guarantee future availability.

### Finality, transaction recovery, and UI divergence

Contract `ADJUDICATED` is not protocol `FINALIZED`. The app persists the same
GenLayer transaction ID before polling, waits for finalization, requires
`ACCEPTED` or `FINALIZED` plus `FINISHED_WITH_RETURN`, then reads contract
state. An outer EVM receipt or accepted status alone is insufficient. Refresh,
timeout, wallet disconnect, wrong network, or an ambiguous RPC response never
blindly rebroadcasts. UI state is always reread from contract views after
successful execution.

## Governance review

There is no contract admin/owner authority after deployment. No address can
change source policy, marketplace policy, delete history, overwrite verdicts,
manually unblock, or suppress a challenger. Constructor policy is immutable and
must be reproduced from `config/v2_source_policy.json`.

## Release blockers

- The installed CLI/SDK/Python/gltest family is older than the official
  Consensus v0.6 RC family; a coherent RC toolchain is not installed.
- No measured fee profile exists for this exact contract on the target
  fee-charging family, so application writes fail closed until the v2 SDK/fee
  path is available.
- Amazon is intentionally unqualified and cannot be a production evidence
  source. Only the fixed CPSC adapter is a candidate source.
- Five-validator CPSC semantic and frozen fixture proof has not been run on
  the coherent RC family. Bradbury deployment is therefore blocked.
