# RecallGuard V2 verification report

- V2 contract source SHA-256: `715972ac3c7d7ce808cfd8dcec72300aacb3c060e8a8f7616590c53b62b3b810`
- Direct VM test cases: `74 passed`
- Named direct test scenarios: `64`
- Decision-critical mutants: `14 total, 14 killed`
- Frontend Vitest cases: `12 passed`
- TypeScript: passed with `npm run lint`
- Production build: passed with `npm run build`
- GenVM lint: passed
- GenVM validation: passed (`9` methods: `7` views, `2` writes)
- Local HTTP smoke check: `/` returned `200`

Mutation coverage is implemented in `scripts/v2_mutation_test.py` and covers
registration state, stable identity, source policy, permissionless assessment,
terminal-state behavior, aggregate priority, notice deduplication, digest
verification, and strict model schema.

The prescribed `agent-browser` executable was not installed and the available
browser-control surface exposed no browser, so no automated visual browser
session was completed. The production build and HTTP smoke check succeeded.
