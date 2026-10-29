# AI platform layer — ledger, attribution, policy, provider errors (DawinOS stream D port)

Ported 2026-10-29. Before this, ZeusOS ran ~47 AI callables, 5 agents and 3 scheduled AI jobs with no cost ledger, no provenance, no spend policy and no provider-error translation: the only tokens recorded anywhere were the ones `agentReason` wrote into `agent_audit_entries`, a Claude failure reached the browser as a bare `500`, and nobody could say where the money went.

## The shape of it

```
entry point              →  wrapper sets the attribution context (AsyncLocalStorage)
  onAiCall                   trigger 'user' + the caller's uid
  onAiSchedule               trigger 'scheduled'
  onAiDocument{Created,…}    trigger 'event'
        ↓
client boundary          →  every model call passes here and is RECORDED
  claudeClient.wrapClientForApiSafety  (applied by getClient and ai/_anthropic.getAnthropic)
  geminiClient.getModel → instrumentModel
        ↓
ai_usage_events          →  one row per call, priced at write (config/aiPricing.js)
        ↓ hourly / nightly (ai-usage/rollup.js)
ai_usage_daily / ai_usage_monthly  →  the AI usage page (/admin/ai-usage)
        ↓
ai_policy/global         →  budgets that alert (to the admins, one notice per threshold per period) and switches that pause a feature or agent
```

## Pricing — `functions/src/config/aiPricing.js` ↔ `src/shared/constants/aiPricing.ts`

Per-million USD rates per model (Anthropic incl. prompt-cache read / write, Google incl. thinking billed as output), aliases for every spelling a model arrives in (dotted ids, dated snapshots, `models/` prefixes), `priceUsage(model, usage)` → `{ costUsd, priced, pricingVersion, breakdown }`. An unknown model is **flagged `priced: false`** and costed at zero, so new traffic shows as unpriced instead of free. `toUgx` follows `ai_policy/global.ugxPerUsd` within bounds, else the one USD→UGX default (3700, the same as `fxRates`). The two files are pinned by `src/shared/constants/__tests__/aiPricing.test.ts`; bump `PRICING_VERSION` when a rate changes — every row records the version it was priced at.

## Ledger — `functions/src/utils/aiUsageLedger.js`

`withAiContext(ctx, fn)` / `currentAiContext()` carry `{ feature, trigger, userId, subsidiaryId, agentId }` down the call tree; `recordAiUsage(event)` writes one row: provider, model (and the spelling requested), feature (explicit → context → the deployed function's exported name → `unattributed`), trigger (`user` · `scheduled` · `event` · `unknown` — never `user` by default), uid, brand, agent, attempt, outcome, `isWaste`, latency, tokens (input / output / cacheRead / cacheWrite / thoughts / searches), `costUsd` / `costUgx`, `priced`, `pricingVersion`. `createdAt` is an ISO string; `expiresAt` is a Timestamp 120 days out for a TTL policy (set it on `ai_usage_events.expiresAt` in the console; the rollups are the long record). **Writes never throw.**

Outcomes: `ok` · `empty` · `parse_failed` · `refused` · `paused` · `error` · `timeout` · `billing_blocked` · `auth_failed` · `bad_request` · `provider_unavailable`; everything but `ok` and `paused` is waste.

## The boundaries

`utils/claudeClient.wrapClientForApiSafety(client)` wraps `messages.create`: sanitises the request (lone UTF-16 surrogates from a `slice()` through an emoji make the API reject the body), checks the policy BEFORE the call (a paused feature costs nothing and is recorded as `paused`), records the call (a `stop_reason: 'refusal'` is `refused`, not `ok`), and translates a **provider** failure (`utils/aiProviderErrors.js`: out of credit → `resource-exhausted` with the top-up sentence; bad key → `failed-precondition`; 429 → `resource-exhausted`; 5xx / 529 → `unavailable`) while a prompt-level failure is thrown untouched with its `status` intact for the retry gates. `getClient(apiKey)` and `ai/_anthropic.getAnthropic()` both hand out the wrapped client, so the presets, the tool loop, the agents and every `getAnthropic` caller are covered. The presets now bound a request by what is LEFT of a caller's deadline (`overrides.deadlineMs`), scale the timeout with `max_tokens` (`answerTimeoutMs`), and `createMessageWithRetry` is the one retry policy (SDK retries off; never a 400/401, a deadline, or a retry that could not finish in time).

`utils/geminiClient.getModel()` returns a model whose `generateContent` is recorded (thinking tokens included, an empty answer is `empty`) and whose failures are translated (billing dunning / `PERMISSION_DENIED` → the "settle billing on the key's project" sentence; `API_KEY_INVALID`; `RESOURCE_EXHAUSTED`; `UNAVAILABLE`).

## Attribution — `utils/aiCallable.js`, `aiScheduled.js`, `aiFirestore.js`

Drop-in replacements for `onCall`, `onSchedule` and the four `onDocument*` builders. Every AI entry point imports them under the original name (`const { onAiCall: onCall } = require('../utils/aiCallable')`), so the call sites did not change: 47 callables under `ai/`, `agents/`, `memos/`, `event-task-engine/` and `intelligence/`, the task-engine schedules, the agent watchers, the social sync, `enrichTaskOnCreate` and `analyzeNewClip`. A feature wanting a better label than the function's name nests its own `withAiContext({ feature })`.

## Policy — `utils/aiPolicy.js`, `ai_policy/global`

`{ monthlyBudgetUsd, dailyBudgetUsd, alertThresholds: [0.5, 0.8, 1], ugxPerUsd, features: { [feature]: { enabled, note } }, agents: { [agentId]: { enabled, note } } }`. Read through a 60-second cache; **fail-open** (a missing or unreadable policy means everything is enabled). Budgets alert, they never refuse a call. `assertAiFeatureEnabled` throws `failed-precondition` with the note so a user who hits a paused feature is told it was paused.

## Rollup — `ai-usage/rollupCore.js` + `rollup.js`

`aiUsageRollupHourly` (every hour, UTC) recomputes today and checks the budgets; `aiUsageRollupDaily` (01:30 UTC) finalises yesterday. A day document carries the totals, `byFeature` / `byModel` / `byProvider` / `byTrigger` / `bySubsidiary` / `byAgent` / `byUser`, `unpricedCalls`, `retryCalls`, `cacheHitRate`, `successRate`, latency p50 / p95; the month sums the day documents (never raw rows). `checkBudgets` raises each threshold crossing **once per period** (persisted in `alertsFired`) as an `ai.budget` notice to the admins through the one notice shape (stream C), linking to `/admin/ai-usage`.

## The page — `/admin/ai-usage`

`src/modules/admin/pages/AiUsagePage.tsx` (parent-org): spend this month and the straight-line projection, budget used, cache hit rate, wasted spend, calls; the waste finder (calls billed for nothing, retries, unpriced models, a cold cache); cost by feature / model / agent / trigger / brand / user with cost per **successful** call (a cheap model that fails and gets retried is not cheap); admins pause a feature from the table and set the budgets. Reads the rollups, never the ledger.

## Rules

`ai_usage_events`, `ai_usage_daily`, `ai_usage_monthly`: read by admins and parent-org principals, written by the server only. `ai_policy`: read by staff, written by admins. Index: `ai_usage_events (isWaste ASC, createdAt DESC)` for the waste drill-down.

## Tests

- `functions/__tests__/ai-usage/pricing.test.js` — spellings, every billed line, thinking per provider, the unpriced flag, UGX bounds.
- `functions/__tests__/ai-usage/ledger.test.js` — rows and attribution (incl. the exported-name feature label), the Claude boundary (sanitise, record ok / refused / failed, translate only provider failures), the pause switch, the Gemini boundary, classification, the attempt budget.
- `functions/__tests__/ai-usage/rollup.test.js` — a day's breakdowns, the month, idempotent recompute keeping alerts, budgets raised once per threshold to the admins.
- `src/shared/constants/__tests__/aiPricing.test.ts` (lockstep), `src/modules/admin/__tests__/aiUsage.test.tsx` (derivations + the page).

## Not ported / follow-ups

- **Gemini → Claude fallback** (`claudeFallback.js`, `geminiWithFallback.js`, the grounded ladders) — tied to DawinOS's `geminiGrounded.js`; port with stream H (market-intel) where the Gemini call sites live.
- **Provider reconciliation** (`syncProviderUsage.js`, the Anthropic usage / cost admin API) — needs an admin key; adds the "ledger against invoice" line on the page.
- Firestore TTL on `ai_usage_events.expiresAt` is set in the console, not in rules.
- The 10 legacy `claudeClient` callers (DawinOS inventory / matflow / Shopify) now go through the boundary too; most are dead code waiting on the Phase 1.E sweep.
