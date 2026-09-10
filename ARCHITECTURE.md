# RecallGuard V2 architecture

RecallGuard is a narrow applicability adjudicator, not a marketplace
authenticator or legal product-certification system. Its contract question is:

> Given the immutable registered product/listing facts for this RecallGuard
> record, does the independently retrieved authoritative CPSC recall record
> place that described product within the affected recall scope?

## State model

The contract stores exactly four listing states:

- `UNASSESSED`: no successful semantic assessment exists.
- `CLEARED`: at least one successful `NOT_AFFECTED` assessment exists and no
  successful `AFFECTED` or `INCONCLUSIVE` assessment exists.
- `REVIEW_REQUIRED`: at least one successful `INCONCLUSIVE` assessment exists
  and no successful `AFFECTED` assessment exists.
- `BLOCKED`: at least one successful `AFFECTED` assessment exists.

Registration always stores `UNASSESSED`; it can never create `CLEARED`.
Aggregation scans all stored `ADJUDICATED` assessments and applies
`AFFECTED > INCONCLUSIVE > NOT_AFFECTED > none`. Failed or undetermined
transactions append no assessment and do not mutate listing state.

## Stable listing identity

The listing ID is SHA-256 over this exact canonical JSON array:

```text
["v2-stable-marketplace-reference", canonical_marketplace_host,
  normalized_external_listing_id]
```

The marketplace host is a namespace, not publisher authentication. Host case,
default HTTPS port, and trailing DNS dot cannot split identity. Product ID,
name, manufacturer, model, serial/lot, URL representation, and any evidence
snapshot are mutable registered metadata and cannot create a second identity.
If a marketplace legitimately reuses an external ID, the source policy must
include a stable generation in that external ID or move to a new identity
version; the contract never guesses reuse semantics. See
[docs/LISTING_IDENTITY.md](docs/LISTING_IDENTITY.md) and the independent
implementation in `frontend/lib/canonical.ts`.

The ID proves only that RecallGuard registered this canonical namespace/reference
pair. It does not prove ownership, title, availability, physical possession,
marketplace display, or product authenticity.

## CPSC source adapter

The only consensus evidence adapter is the contract-constructed CPSC request:

```text
https://www.saferproducts.gov/RestWebServices/Recall
  ?format=json&RecallNumber=<bounded_identifier>
```

The caller provides only a bounded recall identifier. The contract rejects
control characters, malformed identifiers, host/path substitution, query
injection, non-success transport, invalid UTF-8, malformed JSON, oversized
bodies, wrong record identity, and ambiguous exact matches. It canonicalizes
only the decision-relevant CPSC fields: recall identity/date/title/
description, products, manufacturers, UPCs, hazards, and remedies. The raw
HTTP body, wrapper metadata, volatile URLs/counters, and unrelated fields are
not stored or compared.

The logical notice ID is:

```text
SHA256(JSON(["v2-cpsc-recall-number", "CPSC", exact_recall_identifier]))
```

The snapshot ID is SHA-256 of deterministic canonical decision facts. A changed
snapshot retains the logical notice ID but creates a new append-only assessment;
an exact listing/notice/snapshot duplicate is rejected.

## Nondeterministic boundary

`request_assessment` copies the stored `Listing` into memory before entering
the nondeterministic closure. The leader and validator each independently:

1. construct the same fixed CPSC URL;
2. fetch and validate the response;
3. extract and canonicalize the exact requested record;
4. compute the canonical snapshot hash; and
5. evaluate applicability against the copied registered facts.

The custom boundary uses `gl.vm.run_nondet_unsafe`. The leader returns only
`notice_id`, `recall_id`, `snapshot_sha256`, and the three-value verdict. The
validator checks `gl.vm.Return`, `gl.vm.UserError`, and `gl.vm.VMError` before
reading calldata, independently repeats retrieval and semantic derivation,
and compares all four authoritative fields. Leader-only enum or JSON-shape
validation is not sufficient.

The evaluator prompt is constructed by contract code, contains minimum
caller-controlled text, delimits CPSC data as untrusted data, rejects extra
JSON fields, and explicitly ignores commands, fake JSON, or system messages in
evidence. `INCONCLUSIVE` is reserved for genuinely ambiguous applicability;
transport, schema, model, VM, timeout, fee, or consensus failures are errors,
not business verdicts.

## Permissionless assessment

```text
request_assessment(listing_id, recall_identifier)
```

Any address can request a check for an existing listing. `requested_by` is
stored in each assessment. The owner cannot approve, cancel, overwrite, delete,
unblock, change source policy, or suppress a third-party assessment. There is
no administrator address or post-deployment policy mutator.

## Public API

Writes:

- `register_listing(marketplace_host, external_listing_id, product_id,
  product_name, manufacturer, model, serial_or_lot, listing_url)`
- `request_assessment(listing_id, recall_identifier)`

Views:

- `get_listing`, `get_assessment`, `get_listing_ids`, `get_assessment_ids`
- `get_listing_assessments`, `get_attestation`, `contract_info`

Views expose identity, registered-by address, current state, assessment
history, requester, logical notice, canonical snapshot hash, authority,
verdict, resulting state, contract record status (`ADJUDICATED`), and policy
version. Protocol finality is not stored as a contract business status.

## Frontend transaction boundary

The application performs a precondition read, prepares a current fee quote,
asks the wallet to sign, broadcasts once, persists the returned GenLayer
transaction ID immediately, tracks that same ID through finalization, requires
`ACCEPTED` or `FINALIZED` plus `FINISHED_WITH_RETURN`, and only then reads
expected contract state. Accepted status or an outer EVM receipt alone is not
success. Refresh, timeout, wallet disconnect, and RPC ambiguity never trigger
a blind rebroadcast.

## Governance and release boundary

No address can change the constructor source policy, delete history, overwrite
verdicts, manually unblock a listing, or suppress a challenger. Production
policy is frozen in `config/v2_source_policy.json`; the current installed
toolchain is documented in `toolchain.json` and must be replaced by one
coherent v0.6-compatible RC family before fee-charging Bradbury deployment.

V1 production remains preserved and untouched. V2 is not deployed or promoted
in this phase.
