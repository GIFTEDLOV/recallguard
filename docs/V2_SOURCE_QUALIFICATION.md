# V2 live source qualification

Status: stop-gated. No blockchain transaction, application write, deployment,
or fixture semantic execution was performed.

The probes used five independent processes through the installed GenLayer
simulator live-I/O handler (`glsim.live_io.create_web_handler`). This exercises
the same live web handler used by simulator GenVM execution, but it is not a
GenLayer protocol transaction or a claim of on-chain validator finality.

## CPSC public page

URL: `https://www.cpsc.gov/Recalls`

| Observation | Status | Bytes | SHA-256 | UTF-8 | Latency ms |
| --- | ---: | ---: | --- | --- | ---: |
| Validator 1 | 200 | 283575 | `479ee17b68d1aa7766430d27bf4d2a0e06f40ebb3e6d9cf622977576f4c34b78` | yes | 1853.8 |
| Validator 2 | 200 | 283575 | same | yes | 2273.2 |
| Validator 3 | 200 | 283575 | same | yes | 2297.2 |
| Validator 4 | 200 | 283575 | same | yes | 2601.6 |
| Validator 5 | 200 | 283575 | same | yes | 3127.2 |

Direct HTTP observation reported `text/html; charset=UTF-8`, final host
`www.cpsc.gov`, and no redirects. The body is consistently retrievable but
fails the current 24,000-byte contract cap. It is not a qualified production
evidence source for the current contract.

## CPSC Recall Data API

URL:
`https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallNumber=26741`

| Observation | Status | Bytes | SHA-256 | Facts SHA-256 | UTF-8 | Latency ms |
| --- | ---: | ---: | --- | --- | --- | ---: |
| Validator 1 | 200 | 3839 | `387b1edf29c18776b21b74e5f836d119c91e7aca0c3fb95e86f0781dbe22fcff` | `e1cd2fde3d45b14c3cfd6b65843bd345be149e4b3355f931747373aa7a62e576` | yes | 1857.6 |
| Validator 2 | 200 | 3839 | same | same | yes | 2249.1 |
| Validator 3 | 200 | 3839 | same | same | yes | 2242.3 |
| Validator 4 | 200 | 3839 | same | same | yes | 2223.0 |
| Validator 5 | 200 | 3839 | same | same | yes | 1644.0 |

Direct HTTP observation reported `application/json; charset=utf-8`, final host
`www.saferproducts.gov`, and no redirects. The response contained one record:

- `RecallID=10940`, `RecallNumber=26741`, `RecallDate=2026-09-03`;
- title, description, public CPSC URL, product, manufacturer, hazard, and
  remedy fields were present;
- the five raw body hashes and canonical decision-relevant fact hashes matched.

This is transport/fact-shape qualified, but the current V2 contract would reject
the host because the active recall allowlist is `cpsc.gov`. Activating it requires
a contract source-class boundary for the exact CPSC API path. It is therefore
not production-qualified in the current contract.

## Amazon GET

URL: `https://www.amazon.com/dp/B08N5KWB9H`

All five observations returned HTTP 200 and UTF-8, but the bodies diverged:

| Validator | Bytes | SHA-256 | Classification |
| --- | ---: | --- | --- |
| 1 | 744872 | `629b373dbface329c0b9e28d9d784bc41b7595d64071220fa30fb927382d5208` | large dynamic HTML; identity markers present |
| 2 | 3781 | `85c0946b681733e69e56e7dd66f8ba19f5bfc034d1a9ba91b76d45cc9f4459ad` | CAPTCHA / Continue shopping; no ASIN |
| 3 | 3781 | `27c4a7dbd6525de110f2c7fcff720fdcd2bc9a50e4d6a68f00e63967ca462a14` | CAPTCHA / Continue shopping; no ASIN |
| 4 | 3781 | `bbecd468398467b9520916708410df7414a96159a575832dd2f2353e1ebc4be6` | CAPTCHA / Continue shopping; no ASIN |
| 5 | 3781 | `f170c418c7fa14d6e4a41f59b59b734634ff92f9325fe93b3306131a793887cb` | CAPTCHA / Continue shopping; no ASIN |

Direct HTTP observation reported `text/html`, final host `www.amazon.com`, and
no redirects. A second classification run observed the same alternating
challenge/large-page behavior, with the large page between 744,956 and 745,026
bytes. Stable product facts were not consistently available.

## Amazon render-text attempt

The browser/render-text path was also attempted through the live-I/O handler.
It returned divergent responses across five observations:

| Validator | Bytes | SHA-256 | Classification |
| --- | ---: | --- | --- |
| 1 | 3781 | `ec96ad6d54f94bc8ef610ab0695565a6896af9e948bffdefa676c87e8eedb693` | CAPTCHA / Continue shopping |
| 2 | 3781 | `98b23e62feb5726ceaa5e14ae8302538d54da922e61af3ceec413989a976ae83` | CAPTCHA / Continue shopping |
| 3 | 3781 | `6856ba514e179d099a33aa5832f47ac79c7418c44402544b8b28f41b7db75ac1` | CAPTCHA / Continue shopping |
| 4 | 3781 | `6b85ac95752ce07fa9270f9c1d1f0c1a431c42447ec7c6487d9e6ff4031c7dae` | CAPTCHA / Continue shopping |
| 5 | 745052 | `2c27facb678c567b141a959f3e094985253cccede8a23d99f2be9df6f656c885` | large dynamic HTML; identity markers present |

Render mode does not qualify Amazon. A challenge page is never accepted as
listing evidence.

## Decision

- CPSC public HTML: not qualified for the current whole-page evidence model.
- CPSC API: 5/5 transport and fact-consistency pass, but not admitted by the
  current contract's host policy; candidate for a separately reviewed contract
  boundary.
- Amazon listing/evidence source: not qualified.
- Fixtures A, B, and C: not run because the required marketplace/evidence
  source gate failed. Their frozen direct-mode values remain unchanged.
- No source policy was broadened to hide the failure, and no contract change was
  made in this stop-gated phase.
