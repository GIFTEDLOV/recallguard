# RecallGuard deployment provenance

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
