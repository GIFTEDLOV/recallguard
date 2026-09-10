# RecallGuard V2 product review

## Product promise

RecallGuard asks one narrow question: given immutable registered product facts,
does the independently retrieved authoritative CPSC recall record place that
described product within the affected recall scope?

The product does not authenticate marketplace pages, prove that a seller told
the truth, or certify that a physical product is universally safe. The UI uses
`REGISTERED FACTS` and `REGISTERED BY`. `CLEARED` means only “Cleared by
consensus against the recorded assessments and registered facts.”

## Reviewed surfaces

- `/` explains the trust boundary, append-only history, independent validators,
  and the difference between registered facts and source authority.
- `/app` presents neutral `Not yet assessed`, `Cleared by consensus`, `Review
  required`, and `Blocked` queues without grouping unassessed records with
  cleared records.
- `/app/listings` provides searchable product records and state filters.
- `/app/listings/new` registers the stable marketplace namespace/reference and
  immutable product facts; the marketplace URL is informational navigation.
- `/app/listings/[id]` shows identity, external listing ID, owner, registered
  facts, current authoritative state, consensus-existence indicator, complete
  assessment history, and the visible permissionless challenge action.
- `/app/checks` and `/app/listings/[id]/check` expose “Check against a recall”
  to any connected wallet. The browser submits a bounded CPSC recall number,
  not a URL, evidence hash, prompt, or verdict.
- `/app/checks/[id]` and `/app/attestations` expose requester, authority,
  logical notice ID, canonical evidence snapshot ID/SHA, verdict, resulting
  state, contract record status, and the protocol transaction lifecycle when
  the same transaction has been reconciled.
- `/app/activity` presents local transaction recovery records without claiming
  that a local observation is contract state.

## Safety-status hierarchy

`UNASSESSED` is neutral and says “Not yet assessed”; it is never green, safe,
clear, verified, approved, or active. `CLEARED` is shown only when the
contract returns `CLEARED`. `REVIEW_REQUIRED` and `BLOCKED` remain distinct,
and the detail copy explains that state is derived from complete successful
assessment history with adverse priority.

## Transaction UX

Write flows perform a precondition read, obtain the SDK fee quote, ask the user
to sign, broadcast once, persist the returned GenLayer transaction ID before
polling, reconcile that same ID, require protocol success plus
`FINISHED_WITH_RETURN`, and then read the expected contract state. Refresh,
wallet disconnect, timeout, duplicate click, wrong network, and finalized
execution failure are represented in tests. The current installed client does
not expose the required v2 fee estimator, so the adapter fails closed and is
not release-ready until the coherent v0.6 client family is installed.

## Remaining quality limits

The repository has no available browser automation runner in this environment;
visual verification is therefore limited to the successful production build
and application-level UI tests. A real browser pass remains part of release
preflight.

The contract does not store an outer transaction hash on each assessment. The
application retains a versioned local confirmed-transaction index when it
observed the finalized write and labels that value as app-observed. Records
created elsewhere correctly show that the hash is unavailable in contract
state. An indexer or future event field can add operational metadata without
changing safety semantics.
