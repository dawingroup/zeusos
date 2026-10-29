# Memos — written decision records (DawinOS stream G port)

Ported 2026-10-26 from DawinOS's Memos module (Sept–Oct 2026) and reshaped for ZeusOS: the memo is the written context for a finance, administrative or operational decision; it goes **through** the people it names under Through, **to** the people it names under To, is **signed** by one of them, **numbered** per brand per year, and **issued** as a frozen snapshot with a PDF. Each step is one task in `generated_tasks` (Phase 6.E vocabulary), so a memo waiting on you shows up on My Day like anything else.

## The shape

| Type | What it is | Tier floor | After issue |
|---|---|---|---|
| `decision` | asks a named authority to decide | manager | — |
| `request` | justifies a spend, exception or hire | manager | — |
| `information` | briefs recipients; no decision | none | distribution notified |
| `directive` | policy / notice | admin (brand MD) | recipients acknowledge |
| `record` | records a decision already taken | none | filed and numbered |

Categories `finance | admin | operations`, impact `low | medium | high`. Header: To / From / Through / Cc / date. Sections come from a per-type template (`purpose` and `recommendation` are required on a decision or request; `purpose` + `details` on an information memo; `purpose` + `policy` + `effective_date` on a directive; `purpose` + `record` on a memo for record). Links point at ZeusOS records through the shared route registry (`RecordEntityType` now includes `memo`); the relation says whether the memo *authorises* the record, is *context*, or *supersedes* an earlier memo.

Money is **data on the memo** (`amountMinor` + `currency`, minor units like every commercial collection, no FX). It feeds the tier; it does not raise a payable — DawinOS's payables / closure / finance-actions tail was not ported (see Follow-ups).

## Who decides: the tier

`functions/src/memos/lib/memoApprovalRouting.js` (mirror `src/modules/memos/utils/memoApproval.ts`, lockstep-tested). The most senior of three inputs:

- **band** — the amount ladder for `memo_<category>` on `systemSettings/approvalRouting`, the same document stream F's supplier-spend routing reads. A memo module is an `ApprovalModuleRoutingV2` (`enabled`, `currency`, `bands[].maxAmountMinor`, `bands[].signatures[].approverRole`); the band's role is the most senior signature it asks for. **Ships absent = off.**
- **impact** — low → none, medium → manager, high → admin.
- **type** — decision / request → manager, directive → admin, information / record → none.

So impact and type can only *raise* the band's answer. `required: false` is reachable only when every input is null. The tier sets the seniority the decider *should* hold; it does not pick the decider — the header does. An addressee below the tier is warned about in the editor and recorded (`approval.tierMet: false`), not blocked; the signer's directory role is audited onto `approval.seniorityCheck` at decision.

## Who holds it: the route

`functions/src/memos/lib/memoRoute.js` (mirror `utils/memoRoute.ts`). Through parties clear it **in the order listed**; then any one addressee decides. The author is never on the route. A party typed by name with no ZeusOS login cannot receive a task and is left off; when that leaves nobody under To, the callable picks a decider by the tier's role chain from `users` / `organizations/default/users` (manager → admin → owner, widened downwards when only the author holds the tier), **excluding the author**; nobody at all → `approval.unroutable` and no task.

## One write path: `memoAction`

Drafts are the author's — the client creates, edits, attaches to and deletes them under the `memos` rules (`allow update` is limited to the authored fields). Everything after that goes through the `memoAction` callable (`functions/src/memos/callables/memoAction.js`, europe-west1), in a transaction, with a `statusHistory` row:

| action | who | what |
|---|---|---|
| `submit` | author | validates (To, required sections, amount), mints `MEMO-<SUB>-<YYYY>-<NNN>` from `memo_counters/memos_{sub}_{year}` (once — a resubmit keeps it and bumps `version`), writes `versions/v{n}`, resolves the tier, plans the route; nothing to clear and nobody to decide → issued in the same call |
| `clear` | the Through party whose turn it is | `cleared` (moves on) or `returned` with a note (→ `rejected`, author told) |
| `decide` | an addressee (an admin may cover), never the author | `approved` / `rejected` / `modified` (+ conditions verbatim), signed by typing their name (`signatureMethod: 'typed'`) |
| `issue` | author, anyone on the route, admin | from approved / modified or submitted + cleared; freezes `issuedSnapshot` with a SHA-256 `contentHash`; a replacement retires the memo it `supersedes` |
| `filePdf` | author, route, admin | records where the client-rendered PDF landed (additive, once) |
| `withdraw` | author or admin; issued → admin only | terminal; route tasks close |
| `reopen` | author | rejected → draft |
| `acknowledge` | a recipient of an issued memo | `acknowledgements[uid]`; the ack task closes |

Statuses: `draft → submitted → approved | rejected | modified → issued → superseded | withdrawn`, `rejected → draft`. A memo that needs no decision but has Through parties is `submitted` while they clear it and is issued straight from `submitted` once `approval.stage === 'cleared'`.

The PDF is rendered client-side (`@react-pdf/renderer`, `src/modules/memos/pdf/`, imported lazily), uploaded to `memos/{sub}/{memoId}/{memoNumber}-v{n}.pdf`, and recorded with `filePdf` — best effort; the memo IS issued either way and the page offers "Render & file PDF" to retry.

## Draft with AI

`draftMemoSection` (`functions/src/memos/ai/draftMemoSection.js`, europe-west1) drafts ONE section of a DRAFT memo from the memo's own context — its header, what the author has written in the other sections, the scalar fields of the records it links to (through the record registry: IWO, master job, client, SOW, PO, supplier, …) and the section's template hint — and returns the text; it never writes. The author lands it in the editor and keeps, edits or drops it ("Draft with AI" / "Improve with AI" under each section card, with an optional one-line instruction; unsaved edits are saved first so the model reads the current draft). The model is told to leave a bracketed placeholder for any fact it was not given. Author (or admin) only; draft only. Dark until `ANTHROPIC_API_KEY` is set: the callable refuses with `failed-precondition` and the editor shows the sentence in place. One `agent_audit_entries` row per draft (`ZA-011` / `memo.draft_section`).

## Tasks

`functions/src/memos/lib/memoTasks.js` runs after every transition (never fails the memo write). One task per person per step, deterministic id `memoTaskId(key)` = `memo__<key with : → __>`:

| key | who | kind |
|---|---|---|
| `memo_clear:{memoId}:{uid}` | the current Through party | review |
| `memo_approval:{memoId}:{uid}` | each addressee at decision | approval |
| `memo_returned:{memoId}:{version}` | the author, when sent back | notify |
| `memo_ack:{memoId}:{uid}` | distribution + header on issue (never the author) | notify |

A step's task completes by the same key when the memo moves on; a returned memo resubmitted to the same clearer re-opens their task. Tasks carry `entityType: 'memo'`, so the inbox and My Day deep-link to `/memos/:id`; `onTaskWritten` sends the bell notices as for any task.

## Reads and rules

`firestore.rules` `memos/{memoId}`: a participant (author, on the route, on the distribution) always reads; a non-confidential memo also by its brand's own staff (`subsidiaryId == callerHomeOrgId()`) and by parent-org principals; an admin reads everything. The client uses only rule-provable list shapes — `subsidiaryId == X AND confidential == false`, `createdBy == uid`, `distributionUids array-contains uid`, `routeUids array-contains uid` — and filters / sorts client-side, so no composite index is needed. `comments` are readable by whoever reads the memo, posted only as yourself; `versions` are callable-written. `memo_counters` are closed to clients (the shared `counters` collection is client-writable for PO / employee numbering, so memos keep their own). `storage.rules`: `memos/{sub}/{memoId}/**` is staff-readable and staff-writable within the size limit.

## Surface

`/memos` (register — the brand's non-confidential memos merged with those addressed to me or on my route), `/memos/mine`, `/memos/awaiting` (my turn to clear, addressed to me to decide, or my acknowledgement outstanding), `/memos/new`, `/memos/:id`, `/memos/:id/edit`. Manifest `memos` in PARENT and the subsidiary tail. `<WriteMemoButton type="iwo" id=… />` drops on any record page and seeds the memo's first link.

## Tests

- `functions/__tests__/memos/memoRouting.test.js` — planner, tier (floors, v2 band, raise-only across every combination), numbers, hash, model, keys.
- `functions/__tests__/memos/memoAction.test.js` — the callable against the in-memory Firestore: the whole route, numbering across a return, no-decision memos, role fallback and unroutable, admin cover and junior signer, withdraw, band from `systemSettings/approvalRouting`, supersede, task-sync failure isolation.
- `functions/__tests__/memos/memoAi.test.js` — `draftMemoSection`: dark without a key, grounded prompt (other sections, linked record scalars, attachments, instruction), author / draft / section gates, never written.
- `src/modules/memos/__tests__/` — lockstep (route, tier, keys, templates, codes, transitions against the CFn copies), prose / deletion / prefill / actor, PDF document model, register, editor (Draft with AI lands in the card; the no-key sentence shows in place) and detail page renders; `src/core/navigation/__tests__/manifest.memos.test.ts`.

## Not ported / follow-ups

- **Payables, closure, finance actions, services sales orders** (`memoPayable`, `memoClosure`, `financeActions`, the adjustments ledger) — DawinOS-finance-specific; a decided memo in ZeusOS records the decision and stops. Revisit with stream M (finance) if a memo should raise a `purchase_orders` / journal entry.
- **Drive mirror** of the issued PDF — Google Drive stays disabled per plan §3.
- **Electronic signature capture** — ZeusOS has no signature component; decisions are signed by typed name. A drawn signature can be added later as `signatureMethod: 'electronic'` + `signatureUrl` without changing the model.
- **Approvals inbox feed** (`/approvals`) for memo decisions — once stream F lands, a `memo_decision` kind can project `memo_approval:*` tasks; today they appear in the task inbox and My Day.
- **Memo amount ladder UI** — Settings → Approval routing (stream F) edits `supplier_spend`; adding `memo_finance` / `memo_admin` / `memo_operations` modules there is a config change, not code.
- Deploy: rules (`memos`, `memo_counters`, storage path), functions (`memoAction`, `draftMemoSection`). CI is dead — deploy locally once merged.
