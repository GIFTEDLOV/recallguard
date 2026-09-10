# RecallGuard V2 verification report

This report is for the docs-aligned release candidate on
`v2/remediation`. It records offline gates and read-only source qualification;
it is not a deployment or live semantic proof.

Current contract source SHA-256 at this audit checkpoint:
`abbfa666d15858d8efa41b321a39287f282963a28315b92f1a1c79aadfe3cb9b`.

## Current offline results

- Direct contract suite: 91 passed.
- Adversarial coverage: 64 named scenarios in the direct/adversarial files,
  including identity, notice identity, authorization, source/schema failures,
  custom validator disagreement, state aggregation, prompt injection, and
  transaction-safety invariants.
- Mutation suite: 19 generated, 19 killed (`MUTATION_RESULT killed=19
  generated=19 total=19`).
- Frontend Vitest suite: 48 passed.
- TypeScript/lint: passed with `npm run lint`.
- Production build: passed with `npm run build`.
- GenVM lint phase: passed its three lint checks. The combined `check`,
  `validate`, and strict typecheck commands could not load the documented
  `py-genlayer:1jb...` runner archive from the installed linter cache.
- Strict GenVM typecheck, coherent v0.6 toolchain, fee profile, and
  Studio/GLSim semantic integration: not release-ready.

## Read-only CPSC qualification

The exact frozen API source was probed five times without broadcasting or
writing chain state:

`https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26741`

All five observations returned HTTP 200, UTF-8 JSON, one exact requested
record, equal canonical decision facts, and equal canonical snapshot hash
`af1d69a4b450a352a404f86bde7c602a2b15435139a48570e25c6a814ee0d927`.
Raw body size was 3839 bytes and the observed raw body SHA was
`387b1edf29c18776b21b74e5f836d119c91e7aca0c3fb95e86f0781dbe22fcff`.
The raw body is not stored or used as the consensus result.

This was a five-observation read-only retrieval probe, not a five-validator
GenLayer semantic execution. Frozen Fixtures A, B, and C remain pre-live and
must not be tuned after validator votes.

Amazon was deliberately excluded after five GET/render-shaped observations
showed challenge-page and body instability. It is retained only as a
marketplace namespace and informational URL.

## Reproducibility

The exact source policy is in `config/v2_source_policy.json`; the fixture
manifest is in `fixtures/v2_live_fixtures.json`; the observed toolchain and
its mismatch with the official v0.6 RC family are in `toolchain.json`.
`docs/OFFICIAL_DOCS_AUDIT.md` is the controlling implementation checklist.

No Bradbury transaction, application write, Vercel change, merge, or push was
performed for this report.
