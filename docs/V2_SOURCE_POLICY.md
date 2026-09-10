# RecallGuard V2 source policy

The V2 release candidate freezes a deliberately small source policy. The
contract allowlists are policy inputs, not an oracle and not a cryptographic
signature. HTTPS establishes transport; the SHA-256 commitment binds the bytes
that validators retrieved; consensus makes the semantic adjudication
reproducible. None of those facts alone authenticates a publisher, proves
legal authority, proves ownership of a listing, or makes a page immutable.

## CPSC source topology

The authority is the United States Consumer Product Safety Commission (CPSC).
The CPSC public recall pages are on `cpsc.gov`. CPSC also documents its
machine-readable Recall Data API at `saferproducts.gov`, under the specific
`/RestWebServices/Recall` path. That second property is admitted only for the
CPSC-operated API purpose; it is not a generic `saferproducts.gov` content
allowlist.

The current contract accepts only host-level recall domains, so the active RC
deployment allowlist remains `cpsc.gov`. Do not append `saferproducts.gov` to
that list without first adding an explicit host-plus-path source-class check.
The smallest next source-boundary change is to admit exactly
`https://www.saferproducts.gov/RestWebServices/Recall` for structured CPSC
records and to reject other saferproducts.gov paths.

The live probe found that `https://www.cpsc.gov/Recalls` returned valid UTF-8
with status 200 but was 283,575 bytes, exceeding the contract's 24,000-byte
evidence cap. The structured API query for RecallNumber `26741` returned one
JSON record, 3,839 bytes, and the same body and decision-relevant fact hash in
all five independent observations. This qualifies the API transport/fact
shape, but not current-contract admission; no contract or production policy
was changed to activate it in this stop-gated phase.

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

The structured CPSC API is documented in the topology section above and
remains a candidate until the contract can bind the host to its exact API path
and, preferably, a canonical decision-relevant field envelope.

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

The values are frozen in the RC artifact, but the live retrieval gate is failed
for the current production source set. Amazon returned status 200 while
alternating between a CAPTCHA/"Continue shopping" response and a large dynamic
HTML page; it did not provide a stable product record across five observations.
Deployment is blocked and the policy must be reviewed as a new release, not
silently broadened.

The complete read-only observation table is in
[`docs/V2_SOURCE_QUALIFICATION.md`](V2_SOURCE_QUALIFICATION.md). The fixture
URLs and policy values must not be changed after observing validator results.
