# V2 stable listing identity

## Definition

RecallGuard V2 treats a marketplace listing as a source reference, not as a
hash of whatever descriptive page fields happen to be visible today. The
stable listing ID is:

```text
SHA-256(UTF-8(JSON.stringify([
  "v2-stable-marketplace-reference",
  canonical_marketplace_host,
  canonical_external_listing_id
])))
```

The JSON is a compact UTF-8 array with no spaces. The external identifier is
trimmed, lowercased, and internal whitespace is collapsed. The host is trimmed,
lowercased, a default `:443` is removed, and one trailing DNS dot is removed.
Non-default ports and reserved characters are rejected.

The contract implementation is in `contracts/recall_guard.py`. The independent
off-chain TypeScript implementation is in `frontend/lib/canonical.ts`.
`frontend/lib/canonical.test.ts` and
`tests/direct/test_identity_hardening.py` pin cross-implementation vectors.

## Why metadata is excluded

The following fields are stored on the listing, but are not identity inputs:

- product ID, product name, manufacturer, model, and serial/lot;
- listing URL path, canonical URL representation, and query parameters;
- listing evidence URL and evidence SHA-256.

Therefore the same `(marketplace host, external listing ID)` cannot evade
assessment history by changing title, manufacturer spelling, model formatting,
description, URL tracking parameters, or evidence snapshot. A second
registration of that source reference is rejected as a duplicate, even when
the descriptive metadata differs.

## Marketplace reuse semantics

The host is an explicit namespace. V2 does not assume two marketplaces share
an ID space, and the same external ID on two hosts produces two IDs. Within one
host, the marketplace policy must define the external reference's lifecycle.
The V2 RC policy uses Amazon's catalog/ASIN-style reference. If a future source
reuses an external ID for a distinct listing, its adapter must include a stable
generation or source-issued version in `external_listing_id`, or the protocol
must introduce a new `identity_version`. The contract never infers a new
identity from mutable product text.

## What the identity does not prove

The ID does not prove that the caller owns the listing, that the listing is
currently available, that the item is physically authentic, that metadata is
truthful, that the marketplace page is immutable, or that an allowlisted source
is a legally authoritative recall publisher. Those are separate source-policy,
evidence-integrity, and consensus boundaries.

## Required invariants

The V2 test suite freezes these properties:

- same marketplace and external ID with changed title, evidence, manufacturer,
  product ID, model, or serial/lot is the same ID and cannot be registered twice;
- equivalent host case, default-port, trailing-dot, and URL query variations
  cannot split identity;
- same external ID on different marketplace namespaces differs;
- different external IDs on one marketplace differ;
- mutable evidence SHA never changes the stable listing identity.
