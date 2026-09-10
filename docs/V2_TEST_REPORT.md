# RecallGuard V2 verification report

- V2 contract source SHA-256: `f3a9e9b488644e7a780138f33199853436a2be55e357d0356d0ed4fea57bb751`
- Direct VM test cases: `98 passed`
- Named direct test scenarios: `86`
- Decision-critical mutants: `18 total, 18 killed`
- Frontend Vitest cases: `29 passed`
- TypeScript: passed with `npm run lint`
- Production build: passed with `npm run build`
- GenVM lint: passed
- GenVM validation: passed (`9` methods: `7` views, `2` writes)
- Local HTTP smoke check: `/` returned `200`

The V2 checkpoint source SHA-256 before hardening was
`715972ac3c7d7ce808cfd8dcec72300aacb3c060e8a8f7616590c53b62b3b810`; the
release-candidate source is the hardened digest above.

Mutation coverage is implemented in `scripts/v2_mutation_test.py` and covers
registration state, stable identity, host canonicalization, source policy,
permissionless assessment, terminal-state behavior, aggregate priority, logical
notice/snapshot identity, notice deduplication, digest verification, strict
model schema, and contract record terminology.

The prescribed `agent-browser` executable was not installed and the available
browser-control surface exposed no browser, so no automated visual browser
session was completed. The production build and HTTP smoke check succeeded.

The exact RC source policy is machine-readable in
`config/v2_source_policy.json`; its live retrieval gate is intentionally still
open. Frozen deterministic owner/challenger fixtures are in
`fixtures/v2_live_fixtures.json`. The fixture manifest is not presented as a
live authority capture.
