# V2 semantic fixtures and live proof

The frozen manifest is
[`fixtures/v2_live_fixtures.json`](../fixtures/v2_live_fixtures.json). It
contains three owner/challenger scenarios bound to the same observed CPSC
Recall Data API record (`RecallNumber=26741`) and distinct stable marketplace
reference IDs.

- Fixture A: account A registers the facts; unrelated account B requests the
  check for a scented Mistolin cleaner with a matching `PR01-25100` date code;
  expected `AFFECTED` -> `BLOCKED`. Its declared marketplace host is
  `www.amazon.com`, matching the listing URL host and remaining admitted by the
  deployed `amazon.com` parent-domain policy.
- Fixture B: registered facts clearly exclude the same authoritative scope;
  the product is an unrelated helmet; expected `NOT_AFFECTED` -> `CLEARED`.
- Fixture C: the authoritative record is admissible but the registered facts
  identify a Clorox Lestoil cleaner and a matching date-code shape but do not
  establish the recall's required scent and Puerto Rico/U.S. Virgin Islands
  scope; expected `INCONCLUSIVE` -> `REVIEW_REQUIRED`.

The manifest freezes stable listing IDs, external IDs, registered facts,
authority URL, notice ID, canonical snapshot hash, and outcomes before any
multi-validator semantic execution. Amazon links are navigation references
only. They are not retrieved or hashed by the contract.

Fixture C is not a network, timeout, malformed-source, or consensus-failure
simulation. Any such failure must produce no assessment and no state mutation.

The fixture manifest remains the deterministic semantic regression set. Fixture
A is also the approved live steward proof: on the authoritative Studio-dev
contract it was registered by the owner and assessed by the distinct challenger,
returning `AFFECTED` -> `BLOCKED` with verified history and attestation. The
canonical live evidence is
[`deploy/evidence/studio-dev-steward-proof-schema-fix-2026-09-14.json`](../deploy/evidence/studio-dev-steward-proof-schema-fix-2026-09-14.json).
