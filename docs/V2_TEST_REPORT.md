# RecallGuard V2 verification report

This report covers the docs-aligned v0.6 release-candidate work on
`v2/remediation`, starting at `740adef951c23494ae77cf7f21d89c45f7eb9d8e`.
It records offline gates and non-write source qualification only. No Bradbury
transaction, application write, Vercel change, merge, or push was performed.

## Frozen contract and toolchain

- Starting V2 contract source SHA-256: `abbfa666d15858d8efa41b321a39287f282963a28315b92f1a1c79aadfe3cb9b`.
- Final candidate contract source SHA-256: `60fedd9cb0b1615277d41380ed646cd36e417cc074cad94c424e928513019ae3`.
- GenLayer CLI: `0.40.0-rc.3`.
- `genlayer-js`: `2.0.0-rc.1`.
- `genlayer-py`: `0.19.0rc2`.
- `genlayer-test` / `gltest`: `0.30.0rc2`; bundled GLSim: `0.30.0-rc.2`.
- `genvm-linter`: `0.11.0`.
- Contract header remains the official `py-genlayer:1jb...` dependency. The
  linter resolves it with official runner `v0.3.0-rc7`; the direct v0.6 test
  runner is explicitly `v0.6.0-rc3`. No dependency digest was changed.
- Transaction Kit is not installed; the frontend uses the documented
  genlayer-js v2 fee-estimation and lifecycle APIs.

## Offline results

- Direct/adversarial contract suite: 91 passed under `v0.6.0-rc3`.
- Adversarial coverage: 64 named scenarios across identity, notices,
  permissionless authorization, source/schema failures, validator
  disagreement, prompt injection, state aggregation, and write safety.
- Validator-focused consensus safety module: 13 meaningful cases.
- Mutation suite: 19 generated, 19 killed.
- Frontend Vitest suite: 50 passed.
- TypeScript: passed.
- Production build: passed.
- `genvm-lint lint`: passed.
- `genvm-lint validate`: passed; RecallGuard has 9 methods (7 views, 2 writes).
- `genvm-lint check`: passed.
- `genvm-lint typecheck --strict`: passed with no type errors.

The direct count is 91 rather than the earlier 98 because three legacy
frontend receipt-alias assertions were removed during the v2 SDK migration.
No decision-critical coverage was removed; obsolete numeric/legacy receipt
expectations were replaced by current v2 lifecycle and execution-result tests.

## Final-runner CPSC source qualification

The exact frozen CPSC API source was probed five times as separate
read-only `tools/probe_cpsc_source.py` observations using the installed
GLSim live-I/O web handler. Every observation returned HTTP 200,
`application/json; charset=utf-8`, 3839 bytes, strict UTF-8, exactly one
requested RecallNumber `26741`, effective host `www.saferproducts.gov`, and
the same canonical snapshot hash:

`af1d69a4b450a352a404f86bde7c602a2b15435139a48570e25c6a814ee0d927`

The raw body hash was stable at
`387b1edf29c18776b21b74e5f836d119c91e7aca0c3fb95e86f0781dbe22fcff`, but raw
body bytes are not stored or compared by the contract. Latencies were
2052.1, 1307.3, 1301.6, 1326.8, and 1543.5 ms. This is a five-observation
transport/canonicalization gate, not five-validator protocol consensus.

Amazon remains excluded from consensus after unstable GET/render-shaped
observations. It is only an identity namespace and informational URL.

## Release blockers

The reproducible `scripts/generate_fee_profile.py` now invokes the pinned
`gltest --fee-profile` path and fails closed when the output is empty or
incomplete. The final five-validator local Studio/GLSim endpoint accepted the
request, but every validator failed to load the contract with
`unexpected end of memory`; the profiler emitted no measured entries. No
`frontend/public/fee-profile.json` is checked in and no fee values were
invented.

The v0.6 single- and five-validator GLSim attempts either stalled before a
deployment receipt or reached a five-validator agreement on the contract-load
error `unexpected end of memory`, so the required actual multi-validator
Fixtures A, B, and C were not run. This is an external execution blocker, not
a substituted direct test or a tuned fixture result. Bradbury health/nonce
preflight and all deployment/live-proof fields remain not run because earlier
release gates are incomplete.
