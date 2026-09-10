# RecallGuard V2 stable listing identity

## Identity definition

RecallGuard uses one explicit marketplace-reference identity mode:

```text
SHA256(JSON.stringify([
  "v2-stable-marketplace-reference",
  canonical_marketplace_host,
  normalized_external_listing_id
]))
```

The JSON is compact, UTF-8, and uses the same array serialization in
`contracts/recall_guard.py` and `frontend/lib/canonical.ts`.

`canonical_marketplace_host` is lowercased, stripped of a default `:443`, and
stripped of one trailing DNS dot. The external listing identifier is trimmed,
lowercased, and internal whitespace is collapsed. It is the marketplace's
stable identifier in that host namespace.

## What is and is not an identity input

The following are not identity inputs and cannot create a second RecallGuard
record for the same marketplace reference:

- title or product name;
- product/manufacturer/model formatting or descriptive metadata;
- serial/lot metadata;
- canonical URL representation, path, or tracking query string;
- any mutable evidence URL, body, or SHA-256 value.

Listing registration stores those product facts as the registered facts used by
the CPSC applicability question. There is no Amazon fetch, render, body hash,
or publisher-authentication claim in consensus. `listing_url` is informational
navigation data and is checked only for HTTPS, host binding, and the frozen
marketplace namespace policy.

## Marketplace identifier reuse

The contract does not infer marketplace ownership or identifier lifecycle. A
configured marketplace that legitimately recycles an external identifier must
publish a generation/version as part of the external identifier, or the
RecallGuard policy must use a new identity version and namespace rule. A caller
must not use a changed title or page snapshot as an identity-generation signal;
doing so would allow history evasion.

The identity proves only that a stable RecallGuard record was registered under a
canonical marketplace host/reference by the registering address. It does not
prove that the marketplace displayed the registered facts, that a seller told
the truth, that the product is authentic, or that the marketplace will never
reuse the identifier.

## Notice and snapshot separation

Recall notices use a separate logical identity:

```text
SHA256(JSON.stringify([
  "v2-cpsc-recall-number",
  "CPSC",
  canonical_cpsc_recall_identifier
]))
```

The snapshot identity is the SHA-256 of the deterministic canonical JSON
containing only decision-relevant CPSC fields. A changed CPSC scope field keeps
the logical notice ID but produces a new snapshot ID. Irrelevant wrapper,
presentation, contact, publish-time, URL, and ordering fields do not change the
snapshot. Exact `(listing_id, notice_id, snapshot_id)` replay is rejected; a
new snapshot is appended and never overwrites history.

## Independent implementation and tests

The independent off-chain implementation is in
`frontend/lib/canonical.ts`. Cross-implementation vectors and required
metadata/URL variation cases are in `frontend/lib/canonical.test.ts` and
`tests/direct/test_identity_hardening.py`.
