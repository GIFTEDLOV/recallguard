# RecallGuard

RecallGuard is a GenLayer Project for evaluating whether a specific product or listing falls within the affected scope of an authoritative product-recall notice. The Intelligent Contract owns the semantic verdict and the listing-state transition; the frontend only submits inputs and displays contract state.

## Contract

`contracts/recall_guard.py` exposes the smallest useful V1 surface:

- Writes: `register_listing(...)`, `request_assessment(...)`
- Views: `get_listing(id)`, `get_assessment(id)`, `get_listing_ids()`, `get_assessment_ids()`, `get_attestation(id)`, `contract_info()`

The only authoritative verdicts are `AFFECTED`, `NOT_AFFECTED`, and `INCONCLUSIVE`. They map to `BLOCKED`, `ACTIVE`, and `RECALL_REVIEW` respectively. `NOT_AFFECTED` is reachable only after source-policy, availability, integrity, schema, semantic, and consensus checks succeed.

Recall evidence is restricted to configured HTTPS domains. Both recall and listing evidence are bounded, require HTTP 200, are decoded as strict UTF-8, and are checked against exact lowercase SHA-256 commitments. Source text is untrusted evidence, including inside the evaluator prompt. Consensus compares the decision-critical result; it does not authenticate the source.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the locked trust model, error taxonomy, state machine, API, frontend boundary, lifecycle, and limitations.

## Toolchain

- Python 3.14.3 with GenLayer CLI 0.39.1
- `genlayer-test` 0.29.2 and `genvm-lint`
- Node 24.14.0, npm 11.9.0
- Next.js 16, TypeScript, React 19, and GenLayerJS 1.1.8

Install Python dependencies using the current project patterns in `requirements.txt`. Install JavaScript dependencies with `npm install`.

## Direct tests and lint

Run the Direct Mode/adversarial suite:

```powershell
$env:PYTHONUTF8='1'
gltest tests/direct -q
```

Run contract lint and validation:

```powershell
genvm-lint check contracts/recall_guard.py
```

Integration tests live under `tests/integration` and are intentionally separate from the mocked Direct Mode suite.

## Frontend

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_CONTRACT_ADDRESS` after deployment. The frontend is in `frontend/` and uses the current GenLayerJS wallet-provider pattern:

```powershell
npm run dev
```

State-changing actions perform a precondition read, connect the wallet to the configured GenLayer network, broadcast exactly once, persist the hash immediately, wait for `FINALIZED`, verify execution success, read expected state, and only then report success. An ambiguous transaction remains persisted for same-hash reconciliation; the UI never rebroadcasts it automatically.

## Deployment

`deploy/deployScript.ts` is deployment tooling only. It reads the contract source, passes the deterministic recall-domain allowlist to the constructor, waits for finality, checks execution success, and prints the resulting address. No deployment is claimed by this repository's Hour 1 setup. Never place a private key in this repository or commit an environment file containing one.

## Evidence hashes

Use the helper below to calculate a lowercase SHA-256 commitment for a local evidence fixture:

```powershell
python scripts/source_hash.py path\to\evidence.txt
```

Official pages are treated as mutable authoritative sources. A stored digest attests to the bytes assessed in that execution; it does not make a live webpage immutable or prove legal authority.
