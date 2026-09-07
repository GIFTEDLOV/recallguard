# RecallGuard

RecallGuard is a GenLayer Project for decentralized product-recall
applicability and listing safety. It helps marketplaces, resellers,
procurement teams, equipment operators, and product owners determine whether a
specific tracked product falls within the affected scope of an authoritative
recall notice.

## 1. What RecallGuard is

RecallGuard turns a recall applicability decision into a shared,
contract-backed safety record. The frontend collects evidence references and
displays contract state. The Intelligent Contract owns the authoritative
semantic decision and resulting listing state.

## 2. The problem it solves

RecallGuard asks:

> Does this specific product/listing fall within the affected scope described
> by this authoritative recall notice?

Seller claims, marketplace databases, and a single backend evaluator are not
adequate trust anchors for that question. RecallGuard binds the evidence
commitments, semantic result, validator agreement, and state transition into a
single on-chain assessment record.

## 3. Why GenLayer is necessary

The decision requires interpretation of public recall evidence, not only a
simple database lookup. GenLayer lets validators independently reproduce the
decision-critical evaluation while the Intelligent Contract enforces the
admissibility rules, consensus boundary, assessment record, and listing-state
transition.

Consensus proves agreement about the interpretation. It does not authenticate
the underlying public evidence.

## 4. How the product works

1. Register a product/listing with deterministic metadata and committed public
   evidence.
2. Request an assessment against an official recall source.
3. The contract authenticates the source policy, checks integrity and
   admissibility, evaluates the evidence semantically, and binds the result to
   validator agreement.
4. The contract stores the assessment and transitions the listing state.
5. The application reads the resulting listing, assessment, and attestation
   records.

Live application: [recallguard-seven.vercel.app](https://recallguard-seven.vercel.app)

Source repository: [github.com/GIFTEDLOV/recallguard](https://github.com/GIFTEDLOV/recallguard)

## 5. Architecture

The public interface is intentionally small:

- Writes: `register_listing(...)`, `request_assessment(...)`
- Views: `get_listing(id)`, `get_assessment(id)`, `get_listing_ids()`,
  `get_assessment_ids()`, `get_attestation(id)`, `contract_info()`

The frontend performs precondition reads, broadcasts each write once, persists
the transaction hash immediately, reconciles the same hash, waits for
`FINALIZED`, verifies execution success, and reads the expected state. It never
computes or overrides the authoritative verdict.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the locked trust model, error
taxonomy, lifecycle, API, and known limitations.

## 6. Intelligent Contract

The frozen contract is [`contracts/recall_guard.py`](contracts/recall_guard.py).
It owns listing identity, evidence configuration, deterministic admissibility,
semantic evaluation, validator equivalence, assessment storage, state
transitions, and finalized attestation records.

Current Bradbury deployment:

- Contract: `0xcB6688DcD30bDB97B882c02a1B1273914dcAB563`
- Deployment transaction:
  `0xab29e9a78c32fb4c800abb0c2b2568e60debaa0edd8e63f650e4071da1e42732`
- Network: GenLayer Bradbury, chain ID `4221`
- RPC: `https://rpc-bradbury.genlayer.com`

## 7. Evidence model

Recall evidence is HTTPS-only and must resolve under the deterministic
authoritative-domain allowlist. Listing evidence is also public HTTPS
evidence. URLs and bodies are bounded, responses must be available and strict
UTF-8, and exact lowercase SHA-256 commitments are checked.

The order is:

`source policy and availability -> integrity -> schema/admissibility -> semantic judgment -> consensus -> state consequence`

Fetched text is untrusted evidence. It may contain commands, fake verdicts,
prompt text, JSON, or instructions; it is never treated as evaluator
instructions. Authoritative webpages remain mutable public sources. A stored
digest commits to the bytes assessed in that execution; it does not make the
live webpage immutable.

## 8. Verdict and state model

Authoritative verdicts are exactly:

- `AFFECTED`
- `NOT_AFFECTED`
- `INCONCLUSIVE`

Listing states are exactly:

- `ACTIVE`
- `RECALL_REVIEW`
- `BLOCKED`

Transitions are:

- `AFFECTED -> BLOCKED`
- `INCONCLUSIVE -> RECALL_REVIEW`
- `NOT_AFFECTED -> ACTIVE`

Evidence, network, model, validation, or consensus failure never becomes
`NOT_AFFECTED`. The frontend does not decide recall status.

## 9. How to use the live app

Open [RecallGuard](https://recallguard-seven.vercel.app), connect an EIP-1193
wallet, and use the Bradbury network. The app provides overview, listings,
recall checks, attestations, and activity views. Technical IDs, hashes,
transaction details, and exact contract enums remain available behind the
user-facing status labels.

Production browser QA was manually performed by the user: the site loaded,
Bradbury RPC worked, the wallet connected on chain 4221, production contract
data loaded, and no serious console/runtime errors were observed. This is
recorded as manual verification, not automated browser verification.

## 10. Live Bradbury proof

A representative production-shaped assessment was finalized on Bradbury:

- Registration: `0xc238a33949dafade935f0695c3760ade5c1576714092144d1f53bda50256c390`
- Assessment: `0x78f9a716c06f37bf700ae35a3c206b790f9f83d080558b3615f09f3c92a08ad8`
- Assessment consensus: `5/5 AGREE`
- Final verdict: `AFFECTED`
- Final listing state: `BLOCKED`
- Assessment and attestation readback: verified

The complete transaction and evidence record is preserved in
[PROVENANCE.md](PROVENANCE.md). Superseded Bradbury attempts are retained
separately and are not presented as current deployment proof.

## 11. Testing

The release gates include 18 Direct Mode/adversarial tests, 7 focused frontend
tests, TypeScript typechecking, a production Next.js build, `genvm-lint`, GenVM
validation, and a repository secret scan. The current release passed all of
these checks.

Run the local gates from the repository root:

```powershell
python -m pytest -q
npm run test
npm run lint
npm run build
genvm-lint check contracts/recall_guard.py
genvm-lint validate contracts/recall_guard.py
```

## 12. Security and trust model

The contract fails closed on bad hashes, unauthorized domains, unavailable or
malformed evidence, malformed model output, validator disagreement, timeouts,
and execution failures. The model authority is restricted to one strict JSON
object containing only `verdict`; free-form reasoning is not authoritative.

Consensus binds the decision-critical result later used for the state
transition, but consensus is not evidence authentication. No private key or
secret belongs in this repository.

## 13. Limitations

RecallGuard does not establish legal authority for a source merely because its
domain is allowlisted. Public recall pages can change after an assessment.
The live proof demonstrates one finalized `AFFECTED -> BLOCKED` path; it does
not claim that every verdict branch has been live-proven. The Bradbury node’s
documented lifecycle RPC was unavailable during release recovery, so supported
status/receipt surfaces were used. Browser QA was manual rather than automated.

## 14. Developer setup

Install the Python dependencies from `requirements.txt` and JavaScript
dependencies with `npm install`. Copy the root `.env.example` or
`frontend/.env.example` to a local environment file and set the public
contract-address value when working against another deployment. The committed
frontend defaults and production deployment target Bradbury; no private key is
required by the frontend.

Start the frontend locally:

```powershell
npm run dev
```

Deployment tooling is in `deploy/`. Never commit a private key, wallet secret,
or environment file containing one.
