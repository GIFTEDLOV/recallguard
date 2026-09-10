# RecallGuard V2 product review

## Reviewed surfaces

- Marketing narrative at `/`, with product promise, evidence boundary, and
  operator entry point.
- Workspace dashboard at `/app`, with neutral unassessed workload, review
  queue, blocked queue, and recorded assessment activity.
- Searchable listing directory and registration flow.
- Listing detail with canonical identity, mutable evidence snapshot, current
  state, consensus-existence indicator, full append-only history, and a visible
  permissionless challenge action.
- Challenge flow with source authority hint, evidence commitment helper,
  wallet/network checks, loading/error states, and recovery queue.
- Assessment/attestation detail with requester, notice identity, recall
  authority, verdict, aggregate consequence, evidence commitments, and honest
  transaction-hash limitation.
- Activity and attestation directories with empty, loading, and error states.

## Product decisions

The dashboard gives `Not yet assessed` its own neutral metric and status color;
it is never grouped into the cleared count. `Cleared by consensus` is shown
only when the contract returns `CLEARED`. `Review required` and `Blocked` remain
visually distinct and the detail copy explains their history priority.

The owner is not the gatekeeper in the interface: every listing detail page
links to `Check against a recall` / `Report recall / Challenge listing`, and the
form explains that any connected wallet may submit it. Technical commitments
remain available in detail panels without making raw hashes the primary user
workflow.

Responsive layout rules cover desktop, tablet, and mobile widths. Existing
loading skeletons, empty states, error notices, wrong-network notices, wallet
  disconnect state, pending recovery, finalized execution, and failed execution
are retained and updated to V2 language.

## Remaining quality limits

The repository does not include a browser automation runner in this environment,
so visual smoke verification is limited to a successful production build and
HTTP 200 content check. The available browser-control surface exposed no
browser instance. A real browser pass remains a release-preflight task.

The V2 contract does not store the originating transaction hash on the
assessment record. The app keeps a versioned local confirmed-transaction index
when it observed the protocol-finalized write and labels the value as app-observed; for
records created elsewhere it shows that the hash is unavailable in contract
state. An indexer or future event field can attach that operational metadata
without changing the verdict or state semantics.
