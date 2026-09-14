# RecallGuard deployment provenance

## Current authoritative V2 release — Studio-dev

This is the current frontend and application target. No historical V1 or
superseded V2 address is an active target.

- Network: `Studio-dev`
- RPC: `https://studio-dev.genlayer.com/api`
- Chain ID: `61997`
- Contract: `0x6E2EAfF16124c513022Ad85751fD4dfF8d7e5580`
- Source SHA-256: `814fd01cd7d1c1d6ab3c2789a54ee76432bdc1e8653b4658b2dfc2348b0a3f3d`
- Deploy transaction: `0xd8ed4bf844bf8b1e35ccfa6f39382df4a4ef73c33eb774f089f3d4a877cd4c49`
- Deploy result: `FINALIZED` + `FINISHED_WITH_RETURN`
- Steward register transaction: `0x41ae7209145328c59a5a330599899ad1edd81672affe7cd2f8dc2562899084c8`
- Steward assessment transaction: `0xa1d7ea20dd909cac43776a8a09b5186e8f6a7d94bb1023f050af8b9d7ab4d8ce`
- Steward result: `AFFECTED` -> `BLOCKED`; history and attestation verified
- Canonical evidence: `deploy/evidence/studio-dev-steward-proof-schema-fix-2026-09-14.json`
- Frontend preview deployment: `dpl_CLxMmmnjUTbH4dMRx9hCxL59YSSc`
- Frontend preview URL: `https://recallguard-cnpru3kyf-kolofahkelvin16-6437s-projects.vercel.app`
- Preview source: branch `v2/bradbury-stable`, commit `e4a1533`, dirty worktree preserved
- Preview smoke: landing, app, V2 contract, Studio-dev network, blocked listing, history,
  attestation, four-state key, and permissionless challenger UI verified; no old contract
  address in preview bundles

## Consensus v0.6 / Studio v0.123 RC runner migration

The historical Bradbury candidate remains preserved under its original source
identity:

- `PRE_RC_RUNNER_SHA256`: `60fedd9cb0b1615277d41380ed646cd36e417cc074cad94c424e928513019ae3`
- `OLD_RUNNER_PIN`: `py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6`

The RC-compatible source identity is:

- `NEW_RUNNER_PIN`: `py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng`
- `NEW_RUNNER_VERSION`: `v0.3.0`
- `RUNNER_PIN_SOURCE`: official GenLayer Studio `v0.123.0-rc.6` bundled `wizard_of_coin.py` example and matching runner manifest
- `RC_COMPATIBLE_SHA256`: `5ccac7504d6f892e28244e842aa4a2545b69e2ee4d5008b68d90445cabdd888f`

RecallGuard V2 RC migration changed only the pinned GenVM Python runner/API
compatibility surface required by Consensus v0.6 / Studio v0.123; contract
logic and state semantics are unchanged. The additional source edits are the
minimal v0.3 API namespace/error/result-format adaptations proven necessary by
the RC runtime; constructor values, validation rules, public methods, state
transitions, and consensus policy remain unchanged.

The real v0.6 fee profile is measured separately against the matching local RC
Studio and is not a live-price quote:

- `FEE_PROFILE_PATH`: `frontend/public/fee-profile.json`
- `FEE_PROFILE_NETWORK`: `studio-dev` (chain `61997`)
- `FEE_PROFILE_HEADROOM`: `1.25`

This record preserves the first Bradbury attempt. It is historical evidence only
and is not current deployment proof.

## Historical Bradbury attempt

- Classification: `HISTORICAL_BRADBURY_ATTEMPT`
- Current-use classification: `NOT_CURRENT_DEPLOYMENT`
- Finality classification: `NOT_FINALIZED`
- State-proof classification: `NOT_STATE_VERIFIED`
- Network: GenLayer Bradbury, chain ID `4221`
- RPC: `https://rpc-bradbury.genlayer.com`

### Deployment

- Transaction: `0x8b7a494bd16267477fc371a42764cb39a91134e1743ba0b665997a7f2b464bb6`
- Historical observation: `ACCEPTED`, consensus `AGREE`, execution
  `FINISHED_WITH_RETURN`
- Provisional address returned by the historical deployment receipt:
  `0x0dc71E7067095b968BD1D6796D3E1f1Cd480FC30`
- Current status observation: `UNINITIALIZED` (status code `0`)
- Current receipt observation: zero/uninitialized receipt
- Current readback observation: contract not found

### Registration

- Transaction: `0xa73b251d9aa9f284bf4657f464091e9d1fe7ac79109998129a0c4a73a5d5512e`
- Historical/current receipt observation: `ACCEPTED` (status code `5`),
  consensus `AGREE`, execution `FINISHED_WITH_RETURN`
- Validator observation: five validator votes, all `AGREE`
- Interpretation: not valid application state because the referenced deployment
  is no longer materialized and the contract readback fails

### Finalization and lifecycle observations

- Historical finalizer EVM transaction:
  `0xdb3990aeafb971f3c0a997fd2b59f04613fcc3942c4ab4a428e38a40b2135cc8`
- Finalizer receipt: mined with EVM receipt status `0x0` (reverted)
- `gen_getTransactionLifecycle`: current Bradbury response was
  `method not found`
- No deployment or registration from this attempt may be reused as release proof.

### Later read-only observation

At the controlled re-release preflight, Bradbury returned a contradictory view:

- The deployment transaction still returned `UNINITIALIZED` (status code `0`)
  with a zero receipt.
- The provisional address became readable again: `contract_info()` succeeded,
  `get_listing_ids()` returned the recorded listing, and `get_listing()` returned
  the expected `ACTIVE` listing with the committed FDA evidence hash.
- The registration transaction advanced to `FINALIZED` (status code `7`) and its
  receipt still showed `FINISHED_WITH_RETURN` and five agreeing validators.

This later readback does not establish deployment finality for the old transaction
and does not convert the historical attempt into current release proof. The old
address and registration remain excluded from the fresh release path.

The next release must use a fresh deployment transaction and independently prove
finality, successful execution, contract readback, registration readback, and
assessment readback.

## Controlled Bradbury re-release

- Fresh deployment submitted exactly once:
  `0xab29e9a78c32fb4c800abb0c2b2568e60debaa0edd8e63f650e4071da1e42732`
- Contract source SHA-256 and deployable byte SHA-256:
  `6b1e595b98eaf4eaab2e98b97176dfb3b796ed43788884ee22ec05c93e9bdc6f`
- The transaction is being reconciled by the existing deployment script; no
  registration or assessment has been submitted against it.

### Controlled re-release outcome

- The fresh deployment reached `FINALIZED` (status code `7`) during the
  bounded same-hash observation period.
- Execution was `FINISHED_WITH_RETURN` and consensus was `AGREE` with five of
  five validator votes agreeing.
- No supported lifecycle action was available because
  `gen_getTransactionLifecycle` returned `method not found`; no manual
  finalizer transaction was issued.
- The provisional deployment result established contract address
  `0xcB6688DcD30bDB97B882c02a1B1273914dcAB563`.
- Independent `contract_info()`, schema, listing-ID, and assessment-ID reads
  succeeded. The listing and assessment collections were empty before the
  prepared registration fixture.

## Prepared registration fixture

- Target contract: `0xcB6688DcD30bDB97B882c02a1B1273914dcAB563`
- Canonical listing ID:
  `1642c3b86878a03dc0e3e0e6d14c31f6c6f515632116193dfd84ab9f62c17acd`
- Product ID: `FDA-72241`
- Product name: `Progesterone 100 mg/mL in Corn Oil Injection`
- Manufacturer: `Kalman Health & Wellness, Inc. dba Essential Wellness Pharma`
- Model: `D-321-2016`
- Serial/lot: `Lot #: 072915, Exp 10/29/2015`
- Listing and evidence URL:
  `https://api.fda.gov/drug/enforcement.json?limit=1`
- Evidence response: HTTP `200`, exactly `1840` bytes
- Evidence SHA-256:
  `f7f370f959a8a573ee88f9ea45ed12ddd506f8cb28569347f938a0fd91d171a9`
- Precondition read: `get_listing_ids()` returned `[]`; no duplicate listing exists.

### Current release registration

- Target contract: `0xcB6688DcD30bDB97B882c02a1B1273914dcAB563`
- Registration transaction submitted exactly once:
  `0xc238a33949dafade935f0695c3760ade5c1576714092144d1f53bda50256c390`
- Initial receipt: `ACCEPTED`, execution `FINISHED_WITH_RETURN`, consensus
  `AGREE`, validator observations `5/5 AGREE`.
- The write uses the prepared fixture above and must be reconciled by this same
  transaction hash; no duplicate registration is permitted.

### Current release registration recovery outcome

- Same-hash observation ran for approximately 14.8 minutes across 30 SDK
  reads; every sample remained `ACCEPTED` (status code `5`).
- The final receipt remained `FINISHED_WITH_RETURN`, consensus `AGREE`, with
  five of five validator votes `AGREE`.
- `waitForTransactionReceipt({ status: "FINALIZED" })` timed out at status 5.
- A read-only `get_listing_ids()` call exposed the prepared listing ID and
  therefore shows provisional state materialization, but this is not release
  proof without `FINALIZED` plus successful execution evidence.
- No assessment, duplicate registration, finalizer, or additional deployment
  was attempted. Bradbury finality remains the release blocker.

### Current release registration finalized

- The same registration transaction later reached `FINALIZED` (status code
  `7`) with execution `FINISHED_WITH_RETURN` and consensus `AGREE`.
- Validator observations were `5/5 AGREE`.
- `get_listing_ids()` returned the canonical listing ID and `get_listing()`
  returned the exact prepared product, owner, URLs, evidence digest, and
  `ACTIVE` state.
- Registration state is now verified for the current release.

### Prepared assessment fixture

- Target contract: `0xcB6688DcD30bDB97B882c02a1B1273914dcAB563`
- Listing ID: `1642c3b86878a03dc0e3e0e6d14c31f6c6f515632116193dfd84ab9f62c17acd`
- Listing source URL: `https://api.fda.gov/drug/enforcement.json?limit=1`
- Official recall source URL: `https://api.fda.gov/drug/enforcement.json?limit=1`
- Listing evidence SHA-256:
  `f7f370f959a8a573ee88f9ea45ed12ddd506f8cb28569347f938a0fd91d171a9`
- Recall evidence SHA-256:
  `f7f370f959a8a573ee88f9ea45ed12ddd506f8cb28569347f938a0fd91d171a9`
- Exact byte length for each fetched source: `1840`
- Recall host check: `api.fda.gov` is authorized by the deployed contract's
  `fda.gov` policy.
- Precondition listing state: `ACTIVE`; assessment ID is
  `0a5f98afb34fb95a7fdab843ca6b8435a21b4192a82dd5d169d7a8c181692218`.
- Verdict is not assumed or supplied by the frontend; the finalized contract
  assessment result is authoritative.

### Current release assessment submission

- Assessment transaction submitted exactly once:
  `0x78f9a716c06f37bf700ae35a3c206b790f9f83d080558b3615f09f3c92a08ad8`
- Initial receipt: `ACCEPTED`, execution `FINISHED_WITH_RETURN`, consensus
  `AGREE`.
- Initial validator observations: `5/5 AGREE`; no timeout or deterministic
  violation was reported.
- Initial equivalent output exposed `{"verdict":"AFFECTED"}`. This remains
  provisional until finality, assessment readback, listing transition, and
  attestation verification succeed.
- The assessment must be reconciled using this exact hash; no duplicate
  assessment write is permitted.

### Current release assessment finalized

- The same assessment transaction reached `FINALIZED` (status code `7`) with
  execution `FINISHED_WITH_RETURN` and consensus `AGREE`.
- Validator observations were `5/5 AGREE`; validator result hashes were:
  `0xb0e2e5b5206480e885387536385d3188c83ad9e054586ab04b1037305d9c7e99`
  for each of the five validators. No timeout or deterministic violation was
  reported.
- `get_assessment()` returned verdict `AFFECTED`, `state_after` `BLOCKED`,
  status `FINALIZED`, and the exact committed listing/recall evidence hashes.
- `get_listing()` returned the canonical listing in state `BLOCKED`.
- `get_attestation()` returned the matching finalized assessment record with
  verdict `AFFECTED` and `state_after` `BLOCKED`.
- The required transition proof is therefore:
  `AFFECTED -> BLOCKED`.

### Production frontend deployment

- Production project: `recallguard`
- Deployment ID:
  `dpl_HXm6Lszg6jPpDULLEHZPk4NgMVKg`
- Immutable deployment URL:
  `https://recallguard-gbowo1u1r-kolofahkelvin16-6437s-projects.vercel.app`
- Production URL: `https://recallguard-seven.vercel.app`
- Deployment source commit:
  `8eb62eeba693c0a707025f2d039a330b42770760`
- The first Vercel attempt failed only because the new project defaulted to a
  static `public` output. The minimal `frontend/vercel.json` Next.js framework
  configuration corrected this; the second deployment reached `READY`.
- Production HTTP checks returned `200` for `/` and `/app`. The deployed app
  bundle contains the verified Bradbury RPC and contract address, and a
  standard `eth_chainId` POST to the Bradbury RPC returned `0x107d`.
- Codex browser automation was unavailable in the release environment.
- Manual production browser QA was completed by the user: the site loaded,
  Bradbury RPC worked, the wallet connected on chain `4221`, production
  contract data loaded, and no serious console/runtime errors were observed.
  This is manual verification, not automated browser verification.
