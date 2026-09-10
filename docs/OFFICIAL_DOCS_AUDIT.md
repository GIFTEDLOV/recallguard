# Official GenLayer documentation audit

Audit basis: [GenLayer full documentation](https://docs.genlayer.com/full-documentation.txt),
retrieved 2026-09-10. This is a requirement-by-requirement implementation
audit for `v2/remediation`, not a summary of the documentation. The audit
started at `11de4eb21bcf8decc47d88a629a5cd1d46c123e9` and must be rerun after
any toolchain or contract dependency change.

## Decision-critical requirements

| Requirement from the official specification | Classification | Evidence or exact remaining action |
| --- | --- | --- |
| Use an Intelligent Contract where a shared result requires interpretation of external information | PASS | `contracts/recall_guard.py` records an append-only assessment and derives a shared listing state. `tests/direct/test_assessment.py` and `test_state_aggregation.py` cover the result. |
| Keep state mutation deterministic and outside nondeterministic execution | PASS | `request_assessment` writes only after `run_nondet_unsafe` returns a matching result. `tests/direct/test_consensus_safety.py` checks failed paths leave no stored assessment. |
| Put web/LLM work inside a nondeterministic boundary | PASS | The only assessment web call and semantic evaluation are inside `gl.vm.run_nondet_unsafe` closures. |
| Do not access persistent storage from a nondeterministic closure | PASS | `request_assessment` obtains `gl.storage.copy_to_memory(self.listings[listing_id])` before constructing the closures. `test_pickling_checks_are_enabled_for_captured_consensus_closures` exercises the boundary with pickling checks. |
| Prefer an explicit custom leader/validator implementation for safety-critical custom equivalence | PASS | Leader and validator in `contracts/recall_guard.py` independently fetch, parse, canonicalize, hash, and adjudicate the fixed CPSC source. No `prompt_comparative` path remains. |
| Validators must independently reproduce the decision, not just validate leader JSON | PASS | The validator repeats source retrieval and semantic derivation, then compares `notice_id`, `recall_id`, `snapshot_sha256`, and `verdict`. `tests/direct/test_consensus_safety.py` includes semantic verdict, snapshot, extra-field, and enum disagreement cases. |
| Handle `Return`, `UserError`, and `VMError` before reading validator calldata | PASS | The validator classifies GenLayer result objects before accessing their data; ordinary exceptions are classified separately as source, transient, semantic, or consensus failures. Covered by UserError and timeout tests. |
| Extract stable structured data before equivalence comparison | PASS | `_parse_cpsc_response` returns only the canonical CPSC decision structure. Raw HTTP bytes, wrapper ordering, URLs, and presentation fields are not stored or compared. Canonical and mutation tests cover relevant versus irrelevant field changes. |
| Contract-constructed prompts must treat retrieved content as data | PASS | `_decision_prompt` has fixed instructions, minimal caller-controlled text, delimited registered/CPSC facts, and explicit prompt-injection defenses. Tests include fake JSON, system-message text, and instruction injection. |
| Model output must be structurally minimal and exact | PASS | `_parse_authoritative_verdict` accepts exactly one object key, `verdict`, with only `AFFECTED`, `NOT_AFFECTED`, or `INCONCLUSIVE`. Malformed output never becomes a business result. |
| LLM calls are nondeterministic inputs and must be contract-scoped, bounded, and treated as untrusted output | PASS | The prompt is assembled in the contract, registered facts and canonical CPSC facts are delimited as data, and only the exact three-value object is accepted. No caller supplies a system prompt or equivalence rule. |
| Errors must not be converted into a favorable or inconclusive business verdict | PASS | Source, transient, semantic, consensus, fee, and transaction failures raise without appending an assessment. Tests cover malformed schema, HTTP errors, timeout, invalid model output, and disagreement. |
| Registration must distinguish existence from consensus clearance | PASS | `register_listing` initializes `UNASSESSED`; only a successful stored `NOT_AFFECTED` can contribute to `CLEARED`. Registration tests assert no safe/clear alias. |
| State must aggregate complete successful history by priority | PASS | `_aggregate_state` scans stored `ADJUDICATED` records with `AFFECTED > INCONCLUSIVE > NOT_AFFECTED > none`. Order and repeated-notice tests cover all permutations. |
| Source allowlisting is not publisher authentication; hashing is integrity only | PASS | `docs/V2_SOURCE_POLICY.md`, `config/v2_source_policy.json`, `contract_info`, and the UI separate admissibility, content integrity, semantic adjudication, consensus, and finality. |
| Recall evidence must use an admissible fixed authority boundary | PASS | The contract accepts a bounded recall identifier and constructs exactly `https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=<id>`. Caller URLs, hosts, paths, query strings, and body hashes are not accepted. |
| Amazon must not be treated as authenticated consensus evidence | PASS | Amazon is a namespace/informational URL only. There is no Amazon `web.get`, render, HTML hash, or evidence argument in the contract. The five-request qualification observed challenge-page instability and correctly classified Amazon as unqualified. |
| Logical notice identity must be separated from the evidence snapshot | PASS | Notice ID hashes version + `CPSC` + exact recall identifier; snapshot ID hashes canonical decision facts. Tests cover updated snapshots, exact duplicates, domain separation, and URL-query replay. |
| Listing identity must be stable across mutable descriptive facts | PASS | Listing ID hashes identity version + canonical marketplace host + normalized external listing ID only. Independent Python/TypeScript reference vectors and cross-marketplace tests cover the boundary. |
| Transaction writes require fee policy, returned transaction ID, finality, execution result, and readback | CHANGE REQUIRED | `deploy/deployScript.ts` and `frontend/lib/contracts/RecallGuard.ts` fail closed unless the v2 fee estimator returns `distribution` and `feeValue`; they then persist and reconcile the same ID and require `FINISHED_WITH_RETURN`. The installed `genlayer-js 1.1.8` does not provide the v2 estimator, no measured `fee-profile.json` exists, and no live write may be enabled until the coherent v0.6 RC family is installed and profiled. |
| A successful transaction requires lifecycle status plus `FINISHED_WITH_RETURN` | PASS | `isSuccessfulTransaction` and deployment verification require `ACCEPTED`/`FINALIZED` together with `FINISHED_WITH_RETURN`. `Finalized + FINISHED_WITH_ERROR` is a failure in `frontend/lib/contracts/RecallGuard.test.ts`. |
| Protocol `FINALIZED` must not be asserted by contract business state | PASS | The contract stores `ADJUDICATED`; the UI labels a transaction finalized only from a reconciled protocol receipt. Historical `PROVENANCE.md` references are preserved V1 evidence, not V2 semantics. |
| Persist the returned GenLayer transaction ID before polling and reconcile that same ID after refresh/timeout | PASS | `pendingTransactions.save` occurs immediately after `writeContract` returns. Recovery tests cover submitted, accepted, finalization-window, failed execution, disconnect, timeout, and duplicate click behavior. |
| Never blind-rebroadcast after an uncertain client timeout | PASS | A pending/reconciliation-required record blocks a new write and polls the persisted hash. No replacement or nonce-level retry is implemented in the application. |
| Use `LATEST_FINAL` or the current documented final read snapshot for durable readback | CHANGE REQUIRED | The readback abstraction needs a finality-aware snapshot selector in the installed v2 client. This cannot be verified with the installed pre-v2 `genlayer-js`; the release remains blocked until the exact current API is pinned and the readback test uses its documented final snapshot. |
| DApp architecture must separate authoritative contract reads from local UX state | PASS | Listing and assessment views are read from the contract; local storage contains only pending/confirmed transaction reconciliation metadata and never supplies a safety state. |
| GenLayerJS write/query APIs must be used with current transaction lifecycle semantics | CHANGE REQUIRED | The adapter has the documented lifecycle shape and fail-closed guards, but the checked-in dependency is `genlayer-js 1.1.8`, not the official v2 RC family. Re-run SDK-specific query, fee, and lifecycle tests after pinning the current client. |
| Preserve structured RPC error data and decode current error surfaces | CHANGE REQUIRED | `frontend/lib/ui.ts` recognizes structured code/data before compatibility text, but raw payload preservation and current ABI/error decoding cannot be certified against `genlayer-js 2.0 RC` until that client is installed. Add an SDK-specific error decoder test as part of toolchain qualification. |
| Use the coherent v0.6 release family rather than mixing old SDKs | CHANGE REQUIRED | Official v0.6 guidance names matching node/Studio, `genlayer-js 2.0 RC`, `genlayer-py 0.19 RC`, CLI `0.40 RC`, matching Transaction Kit and gltest. `toolchain.json` records the observed mismatch: CLI `0.39.1`, JS `1.1.8`, Python `0.19.0rc2`, gltest `0.30.0rc2`, linter `0.11.0`, and no Transaction Kit. Do not install latest blindly; resolve as one tested family. |
| Fee profiles must be measured from representative paths and reused reproducibly | CHANGE REQUIRED | `deploy/deployScript.ts` consumes a root `fee-profile.json`, but that artifact does not exist because the target fee family is not installed. Generate deploy/register/assessment/error profiles only after installing the compatible SDK and running representative measurements. |
| Transaction Kit is the preferred current fee/signing/tracking surface when compatible | NOT APPLICABLE (blocked pending compatibility) | No compatible Transaction Kit is installed. The custom React adapter is intentionally fail-closed and must be rechecked against the exact v2 client before release. Migration is not justified until compatibility is proven. |
| Layer tests from deterministic/storage to mocked nondeterminism, direct validators, Studio/GLSim, then Bradbury | CHANGE REQUIRED | 91 direct tests run with strict mocks and pickling checks, including explicit disagreement. No Studio/GLSim multi-validator semantic fixture run has been completed, and no Bradbury write is authorized. Add the integration layer after the toolchain is coherent. |
| `genvm-lint` and strict type validation must run on the exact release contract | PASS / CHANGE REQUIRED | `genvm-lint check` and `validate` are expected gates for the current source and must be rerun at the final commit. `genvm-lint typecheck --strict` is not currently executable because the installed environment lacks the compatible `pyright` surface; this remains a release blocker, not a waived check. |
| Production policy must be machine-readable, immutable, and reproducible | PASS | `config/v2_source_policy.json` and `docs/V2_SOURCE_POLICY.md` freeze CPSC host/path, canonical fields, Amazon namespace-only treatment, fixture and limitations. Deployment consumes the exact policy rather than vague deployment-time governance. |
| Bradbury writes must be gated by both RPC views and unresolved-hash checks | NOT APPLICABLE (not reached) | No Bradbury nonce or mempool action was taken because Amazon failed qualification and the toolchain/fee gates remain closed. Before any future write, read both RPCs, compare latest/pending nonce and prior hashes, and stop on disagreement. |

## Required release actions

The implementation changes required by the docs-alignment audit are complete
for the contract/source boundary. The following are still required before a
live release can be called ready:

1. Install and record one coherent v0.6-compatible CLI/SDK/Python/gltest/
   Transaction Kit family; do not mix it with the installed legacy JS client.
2. Generate and check in a measured `fee-profile.json` for deploy, registration,
   assessment, and required failure branches.
3. Re-run the exact contract with the compatible linter, strict typecheck, and
   Studio/GLSim five-validator semantic fixtures.
4. Repeat the five-observation CPSC gate using the exact GenVM runtime of that
   family. The current read-only probe passed, but it is not protocol consensus.
5. Only after all gates pass may the separate Bradbury mempool gate be read; no
   deployment, application write, Vercel change, merge, or push is authorized by
   this audit.

The official documentation requires validators to independently reproduce the
decision and requires durable transaction success to include
`FINISHED_WITH_RETURN`; these are the two release properties most likely to be
silently weakened by an SDK migration and therefore remain explicit gates.
