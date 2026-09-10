# RecallGuard V2 source policy

This is a small, frozen launch policy. It separates four claims:

1. source-policy admissibility;
2. content integrity through canonical snapshot hashing;
3. semantic applicability adjudication;
4. GenLayer consensus and protocol finality.

Allowlisting a host or hashing bytes does not authenticate a publisher, seller,
marketplace, product, or legal recall status.

## Exact trust question

RecallGuard asks:

> Given the immutable registered product/listing facts for this RecallGuard
> record, does the independently retrieved authoritative CPSC recall record
> place that described product within the affected recall scope?

It does not prove that Amazon displayed the registered facts, that a seller told
the truth, that SHA-256 authenticates a publisher, or that `CLEARED` means a
physical product is universally safe.

## Recall authority

The authority and the admitted fetch property are deliberately separate:

- `cpsc.gov` is the CPSC's official public web property and documents the
  recall database/API relationship. It is not an admitted V2 fetch endpoint.
- `www.saferproducts.gov` is admitted only for the official CPSC-operated
  machine-readable Recall Data API at the exact path below. Arbitrary pages on
  `saferproducts.gov` are not equivalent evidence.

| Authority | Host | Path boundary | Policy role | Limitation |
| --- | --- | --- | --- | --- |
| United States Consumer Product Safety Commission | `www.saferproducts.gov` | exactly `/RestWebServices/Recall` | Official CPSC machine-readable recall data interface | Public mutable data; CPSC scope is consumer products, not a universal registry. |

The contract never accepts a recall URL. A caller supplies only a bounded CPSC
recall identifier. The contract constructs exactly:

```text
https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=<identifier>
```

The identifier allows only uppercase/lowercase ASCII letters, digits, and
hyphens after canonical trimming/upcasing. Host, path, format, and query names
are contract constants. `cpsc.gov` public HTML is not an assessment input in
V2.

The adapter requires HTTP 200, strict UTF-8, valid JSON, an array response,
exactly one record whose `RecallNumber` matches the requested identifier, the
observed CPSC schema, bounded field sizes, and deterministic canonicalization.
It extracts only `RecallID`, `RecallNumber`, `RecallDate`, `Title`,
`Description`, product name/description/model/type, manufacturer names, UPCs,
hazard names, and remedy names. Raw HTTP bodies, URLs, counters, contacts,
publish timestamps, images, and API wrapper noise are not stored.

## Marketplace namespace

`amazon.com` remains a marketplace namespace only. Amazon is never fetched or
rendered by GenVM, never hashed, and never used as consensus evidence. The
Amazon URL can be shown as informational navigation. The external marketplace
identifier is the stable identity input; registered product facts are caller
claims committed by the registering address.

The production policy therefore does not include an Amazon listing-evidence
allowlist. There is no listing-evidence source class in the V2 contract.

## Machine-readable policy

The exact constructor policy and source boundary are frozen in
`config/v2_source_policy.json`. It contains only the CPSC API host boundary and
the marketplace namespace currently evaluated by the application. No
environment variable may override those values during deployment.

## Live qualification gate

The prior five-observation probe found the CPSC API endpoint returned one
requested record with equal stable facts and equal canonical fact hash. The
Amazon probe alternated between a large dynamic page and CAPTCHA/“Continue
shopping” bodies, so Amazon is explicitly **not qualified** and is excluded
from consensus. No Fixture A/B/C semantic transaction may run until the fixed
CPSC adapter itself passes the same gate in a coherent multi-validator
environment.

## Known limitations

- CPSC records and remedy information can change; the logical notice ID remains
  stable while each decision-relevant canonical snapshot is retained.
- Consensus makes the adjudication reproducible; it does not authenticate the
  CPSC publisher or confer legal certification.
- Registered product facts are immutable claims, not independently proven
  marketplace facts.
- `INCONCLUSIVE` is reserved for admissible evidence with genuine semantic
  ambiguity. Source, model, consensus, fee, and infrastructure failures create
  no assessment and no state mutation.
