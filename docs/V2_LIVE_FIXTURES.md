# V2 live-test fixtures

The frozen fixture manifest is
[`fixtures/v2_live_fixtures.json`](../fixtures/v2_live_fixtures.json). It
contains three deterministic owner/challenger scenarios with concrete listing
IDs, external IDs, source URLs, evidence bytes, SHA-256 values, authority
references, and expected verdict/state pairs.

The committed scenarios are direct-mode captures using reserved `.example`
domains. They are intentionally safe for offline adversarial tests and are not
claimed to be live authorities. The manifest marks production use blocked until
the same scenarios are represented by exact snapshots retrieved from the
frozen production source policy (`cpsc.gov` / `amazon.com`) and pass a
multi-validator retrieval probe.

The semantic expectations are frozen now:

- A: unrelated account B challenges A's listing; `AFFECTED` → `BLOCKED`.
- B: the notice clearly excludes the listing; `NOT_AFFECTED` → `CLEARED`.
- C: evidence is genuinely insufficient; `INCONCLUSIVE` → `REVIEW_REQUIRED`.

No fixture may be tuned after validator votes are observed. If the production
source cannot provide stable, retrievable evidence for a fixture, the live run
must stop and the source policy must be reviewed as a new release.
