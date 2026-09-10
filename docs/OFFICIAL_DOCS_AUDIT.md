# Official GenLayer documentation audit

Audit basis: [the official full documentation](https://docs.genlayer.com/full-documentation.txt),
the [Consensus v0.6 migration guide](https://docs.genlayer.com/developers/consensus-v06-migration),
and the [GenLayerJS v2 reference](https://docs.genlayer.com/api-references/genlayer-js),
retrieved 2026-09-10. This is a requirement-by-requirement audit of the
release candidate at `740adef951c23494ae77cf7f21d89c45f7eb9d8e` plus the
final docs-alignment changes in the working tree. The semantic contract
architecture remained unchanged; the contract bytes changed only for explicit
strict-type annotations and linter-compatible boundary comments around the
existing custom consensus implementation. The starting V2 contract SHA was
`abbfa666d15858d8efa41b321a39287f282963a28315b92f1a1c79aadfe3cb9b`; the
current working-tree SHA is recorded in `docs/V2_TEST_REPORT.md`.

The eight `CHANGE REQUIRED` findings in the previous audit meant “changes
were required at audit time”; they are not eight unresolved findings. Each is
closed below as `RESOLVED` or `BLOCKED EXTERNALLY` with a concrete reason.

## Decision-critical requirements

| Official requirement | Status | Code, test, or artifact evidence |
| --- | --- | --- |
| Use an Intelligent Contract when a shared result requires interpretation of external information | PASS | `contracts/recall_guard.py` uses a nondeterministic source/semantic boundary and commits a shared append-only result. |
| Keep deterministic mutation outside nondeterministic execution | PASS | `request_assessment` appends only after the custom consensus result passes all checks; failure tests assert unchanged history/state. |
| Put web and LLM work inside nondeterministic execution | PASS | The only CPSC web and model calls are in the leader/validator closures passed to `run_nondet_unsafe`. |
| Copy storage objects to memory before nondeterministic execution | PASS | `gl.storage.copy_to_memory` is used before closures are built; direct tests enable `check_pickling=True`. |
| Use a custom validator for safety-critical equivalence | PASS | Leader and validator independently fetch, parse, canonicalize, hash, and adjudicate the fixed CPSC source. |
| Validators independently reproduce the decision | PASS | Validator derives its own notice, snapshot, and verdict and compares all decision-critical fields; leader-only enum/schema tests fail. |
| Handle `Return`, `UserError`, and `VMError` before validator calldata access | PASS | The validator classifies each result type first; direct tests cover UserError, VMError, timeout, and disagreement. |
| Extract stable structured data before equivalence comparison | PASS | Only the bounded canonical CPSC fields are compared/stored; raw body and irrelevant API fields are excluded. |
| Treat retrieved content as untrusted data in a fixed prompt | PASS | Prompt instructions are contract-constructed, evidence is delimited, and prompt-injection fixtures cannot alter the exact three-value output policy. |
| Accept only `AFFECTED`, `NOT_AFFECTED`, or `INCONCLUSIVE` | PASS | `_parse_authoritative_verdict` requires exactly one key and one exact enum. |
| Do not turn source, semantic, or consensus failure into a business verdict | PASS | Error classes raise before assessment append; failure tests assert no state mutation and no assessment. |
| Registration must start unassessed | PASS | Constructor/registration initialize `UNASSESSED`; only successful `NOT_AFFECTED` history can produce `CLEARED`. |
| Aggregate complete successful history by adverse priority | PASS | `_derive_listing_state` implements `AFFECTED > INCONCLUSIVE > NOT_AFFECTED > none` over stored `ADJUDICATED` records. |
| Source allowlisting is not publisher authentication; hashes provide integrity only | PASS | `docs/V2_SOURCE_POLICY.md`, `config/v2_source_policy.json`, contract metadata, and UI terminology separate source policy, integrity, semantics, consensus, and finality. |
| Construct a fixed authoritative CPSC request; do not accept a caller URL | PASS | The bounded identifier is validated and inserted into the fixed `/RestWebServices/Recall` request. |
| Do not use Amazon as consensus evidence | PASS | Amazon is only a namespace/informational URL. No validator fetch, render, body hash, or caller evidence URL exists in the contract. |
| Separate logical notice identity from snapshot identity | PASS | Notice ID is version + `CPSC` + exact identifier; snapshot ID is canonical decision-field content. |
| Keep listing identity independent of mutable metadata/evidence | PASS | Stable ID is version + canonical marketplace host + normalized external listing ID; independent Python/TypeScript vectors cover this boundary. |
| Write flows require fee policy, one returned transaction ID, finality, execution result, and readback | RESOLVED | `frontend/lib/contracts/RecallGuard.ts` and `deploy/deployScript.ts` use v2 fee estimation, persist the returned ID before polling, wait for finalization, require the official success predicate, and read `LATEST_FINAL` state. A measured profile is still gated externally. |
| Successful execution requires lifecycle status plus `FINISHED_WITH_RETURN` | RESOLVED | The frontend uses `isSuccessful` from `genlayer-js` v2 and tests finalized-return versus finalized-error. Deployment additionally requires `FINALIZED`. |
| Do not call contract business state `FINALIZED` merely because execution reached a line | PASS | Assessments are `ADJUDICATED`; UI finality comes only from the protocol transaction receipt. |
| Persist and reconcile the same transaction ID after refresh/timeout | PASS | `pendingTransactions.save` occurs immediately after SDK submission; recovery tests prohibit a replacement broadcast. |
| Use final read snapshots for durable state | RESOLVED | All contract reads use `TransactionHashVariant.LATEST_FINAL`; the selector is from the installed v2 SDK types. |
| Use current GenLayerJS v2 calldata/envelope APIs | RESOLVED | No application calldata encoder remains; reads, writes, deployment, fee estimation, finalization, and success checking are official v2 APIs. `npm list` reports only `genlayer-js@2.0.0-rc.1`. |
| Keep test calldata helpers aligned with the selected runner | RESOLVED | Production code never encodes calldata. The Windows direct-test compatibility hook delegates encoding to the official dependency selected by the contract header because the pinned gltest RC otherwise imports the wrong SDK namespace; it is documented as a test-only adapter and is excluded from deployment. |
| Preserve structured RPC error data | RESOLVED | Submission errors preserve `cause`, `data`, and `code`; UI decoding checks structured fields before compatibility text. |
| Use one v0.6 release family | RESOLVED | `toolchain.json`, `requirements.txt`, and `frontend/package.json` pin CLI `0.40.0-rc.3`, JS `2.0.0-rc.1`, Py `0.19.0rc2`, gltest `0.30.0rc2`, and linter `0.11.0`; official registry/release metadata was verified. |
| Measure fee profiles from representative paths and reuse them | BLOCKED EXTERNALLY | The reproducible wrapper is `scripts/generate_fee_profile.py` and invokes the pinned `gltest --fee-profile` path. The final five-validator GLSim endpoint accepted the request but every validator failed to load the contract with `unexpected end of memory`; the profiler therefore emitted no measured entries. No fee values are fabricated or checked in. |
| Use Transaction Kit when compatible, otherwise implement the same low-level semantics | NOT APPLICABLE | Transaction Kit is not installed; the custom adapter uses the documented v2 profile-plus-live-price estimator, SDK submission, ID persistence, finalization, success predicate, and readback semantics. |
| Follow the official test layering through Studio/GLSim before Bradbury | BLOCKED EXTERNALLY | Direct/adversarial/validator layers pass; pinned five-validator GLSim reaches agreement only on a contract-load `ERROR` (`unexpected end of memory`), while earlier attempts stalled before a receipt. Five-validator semantic proof cannot honestly be reported as complete. |
| Run linter, validation, check, and strict typecheck | RESOLVED | `genvm-lint` `0.11.0` passes all four commands with `GENVM_VERSION=v0.3.0-rc7`; the unchanged contract dependency is present in that official runner. |
| Freeze machine-readable production source policy | PASS | `config/v2_source_policy.json` freezes the CPSC host/path, canonical fields, fixture policy, and Amazon namespace-only treatment. |
| Gate Bradbury writes on both RPC views and unresolved-hash checks | NOT APPLICABLE | Bradbury was not reached. No Bradbury nonce read, transaction, replacement, cancellation, or production write was attempted. |

## Current release decision

The contract/source trust architecture is docs-aligned and the offline
decision-critical suite is intact. The release candidate is not deployable:
the measured fee profile and actual five-validator semantic proof remain
blocked by the pinned local GLSim contract-load error (`unexpected end of
memory`). This is an explicit external blocker, not a waived gate. No
Bradbury transaction may be broadcast until those gates complete and the
two-RPC nonce/mempool preflight is consistent.
