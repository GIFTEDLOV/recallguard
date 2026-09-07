# RecallGuard architecture

## Product and parties

RecallGuard evaluates whether a specific product or marketplace listing falls within the affected scope of an authoritative product-recall notice. Marketplaces, resellers, procurement teams, equipment operators, and product owners submit listing metadata and public evidence. RecallGuard's GenLayer Intelligent Contract owns the authoritative verdict and listing-state transition.

## Trust problem and why GenLayer

The trust-sensitive question is semantic: whether a particular model, lot, serial range, or product description is covered by a notice. A conventional backend can fetch and summarize text, but it cannot make that interpretation authoritative without becoming a centralized oracle. GenLayer lets the contract fetch public evidence and run an evaluator in non-deterministic blocks while validators independently reproduce and agree on the decision-critical result.

## Evidence and trust boundary

Recall notices must use HTTPS and a configured authoritative domain. Listing evidence must use an explicit public HTTPS URL. Both sources are bounded, required to return HTTP 200, decoded as strict UTF-8, and committed with a canonical lowercase SHA-256 digest. The contract independently fetches each source and checks the digest before semantic evaluation.

Authentication and integrity are separate: the domain allowlist is a deterministic source-policy check; the digest is an integrity check for the bytes fetched in this execution. Consensus proves agreement about interpretation and does not authenticate a source. Official pages remain mutable authoritative-source evidence; the stored URL and digest record what was assessed, not an immutable claim that the live page can never change.

All fetched text is untrusted. The evaluator receives explicit system instructions plus separately delimited recall and listing evidence, and is told that source text may contain commands, fake verdicts, JSON, or prompt instructions. Prompting is defense-in-depth only; strict deterministic schema parsing is authoritative.

## Exact validator question

For each source, validators independently reproduce the fetched UTF-8 body and its SHA-256 digest through the current custom `gl.vm.run_nondet_unsafe` leader/validator mechanism and compare the canonical envelope exactly. This avoids accepting a leader-provided digest or source summary. For the semantic step, validators independently run the same minimal evaluator and the comparative equivalence principle asks: “Is the `verdict` field exactly identical, with no additional authoritative fields accepted?” Only a strictly parsed enum is allowed to reach state mutation.

## Verdict and state machine

The only authoritative verdicts are `AFFECTED`, `NOT_AFFECTED`, and `INCONCLUSIVE`. Affected transitions the listing to `BLOCKED`; inconclusive transitions it to `RECALL_REVIEW`; not affected transitions it to `ACTIVE` only after source policy, integrity, availability, model schema, and consensus all succeed. Any evidence, model, or consensus failure reverts and does not mutate listing or assessment state.

`BLOCKED` is terminal for V1. A successful assessment is append-only: its deterministic ID includes the listing ID, recall URL, recall digest, and listing-evidence digest, and an existing assessment cannot be overwritten. A changed digest for a mutable source creates a distinct assessment record.

## Error taxonomy

- `BUSINESS:*`: duplicate listing/assessment, invalid ID, unauthorized action, or illegal state transition.
- `EVIDENCE_INTEGRITY:*`: HTTPS/domain policy, metadata, UTF-8, size, malformed evidence, or SHA mismatch.
- `EVIDENCE_UNAVAILABLE:*`: non-200, timeout, unreachable source, or temporary fetch failure.
- `SEMANTIC_MODEL:*`: malformed JSON, missing/extra keys, wrong type, or invalid enum.
- `CONSENSUS:*`: disagreement, validator timeout, or equivalence failure.

These domains are never converted into a business verdict.

## Public contract API

Writes: `register_listing(...)`, `request_assessment(...)`.

Views: `get_listing(id)`, `get_assessment(id)`, `get_listing_ids()`, `get_assessment_ids()`, `get_attestation(id)`, and `contract_info()`.

The constructor accepts the deterministic authoritative recall-domain allowlist. There is no admin, governance, appeal, token, payment, reputation, chat, or subscription surface.

## Frontend authority boundary

The frontend calculates hashes and deterministic IDs for display and input validation, but never decides the verdict or listing state. It submits the two writes, reads contract state, and displays stored attestations. Backend/API summaries are non-authoritative and are not used by the contract.

## Transaction lifecycle

Every state-changing action follows: precondition read → broadcast exactly once → persist the hash immediately → reconcile that same hash → track provisional/terminal status → wait for `FINALIZED` → verify successful execution → read expected contract state → display the final outcome. `ACCEPTED`, a hash, or `FINALIZED` alone is not success. Refreshes, polling failures, ambiguous RPC responses, and process restarts never trigger rebroadcast.

## Known limitations

V1 uses HTTPS domain policy and body SHA-256 commitments; it does not prove legal authority or cryptographically sign government pages. Mutable pages can change after an attestation, which is why the assessed digest is stored. Direct tests mock web/LLM hosts and do not replace a real Bradbury integration run. The frontend client is intentionally a minimal integration skeleton during Hour 1; visual product work and production deployment follow after the public contract interface is stable.
