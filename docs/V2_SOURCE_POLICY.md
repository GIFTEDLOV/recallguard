# RecallGuard V2 source policy

The V2 release candidate freezes a deliberately small source policy. The
contract allowlists are policy inputs, not an oracle and not a cryptographic
signature. HTTPS establishes transport; the SHA-256 commitment binds the bytes
that validators retrieved; consensus makes the semantic adjudication
reproducible. None of those facts alone authenticates a publisher, proves
legal authority, proves ownership of a listing, or makes a page immutable.

## Exact production values

The reproducible machine-readable policy is
[`config/v2_source_policy.json`](../config/v2_source_policy.json). The exact
V2 RC deployment values are:

```text
recall_domains = ["cpsc.gov"]
marketplace_domains = ["amazon.com"]
listing_evidence_domains = ["amazon.com"]
```

`deploy/deployScript.ts` reads these values from the committed policy file and
does not accept environment overrides. The root `.env.example` documents the
same values for operator visibility, but those variables cannot silently drift
the deployment arguments.

## Recall authority

| Domain | Authority | Scope | Why admitted | Live fixture | Limitations |
| --- | --- | --- | --- | --- | --- |
| `cpsc.gov` | U.S. Consumer Product Safety Commission | U.S. consumer-product recalls and product-safety warnings | Federal authority publishes the recall record on its controlled government domain | `https://www.cpsc.gov/Recalls` | Pages and remedies are mutable; scope is not universal; allowlisting is not a signature |

No FDA, Health Canada, manufacturer, or third-party recall domain is included
in the V2 RC policy. Those can be proposed only with a separately reviewed
scope, fixture, and retrieval proof.

## Marketplace and listing evidence source

| Domain | Role | Identity/evidence rule | Live fixture | Limitations |
| --- | --- | --- | --- | --- |
| `amazon.com` | Amazon marketplace/catalog and same-host listing evidence | `v2-stable-marketplace-reference`; host plus operator-supplied external reference is stable; title, metadata, URL representation, and SHA snapshot are not identity | `https://www.amazon.com/dp/B08N5KWB9H` | Automated retrieval may be blocked or dynamic; an ASIN does not prove ownership or physical authenticity; SHA is content integrity only |

The marketplace and evidence host checks are separate contract checks even
though this small launch policy uses the same domain for both. A listing URL
must have the declared marketplace host. Arbitrary HTTPS sources are rejected.

## Retrieval gate

The values are frozen in the RC artifact, but the live retrieval gate remains
open until the exact fixtures pass GenVM retrieval and multi-validator
agreement. The fixture URLs and policy values must not be changed after seeing
validator votes. If Amazon presents an anti-bot or consent response, deployment
is blocked and the policy must be reviewed as a new release—not silently
broadened.
