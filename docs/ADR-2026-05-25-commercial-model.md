# ADR-2026-05-25 — Commercial Model: §15.5 Resolutions

| Status | Date | Authors | Closes |
|---|---|---|---|
| Accepted | 2026-05-25 | Zeus Group leadership | Plan §15.5 (the four open commercial questions) |

## 1. Context

Phase 6 of the Zeus Group rollout introduced a substantial intelligence layer (Addendum v1.2 — task / event engine, agent network, role-aware assigner). The work plan
([`/Users/danielonzimai/.claude/plans/we-have-onboarded-a-lovely-planet.md` §15.5](../../../.claude/plans/we-have-onboarded-a-lovely-planet.md)) declared **four open commercial questions** as a **hard gate** on Phase 6.E (event / task engine) and Phase 6.F (mutating agents). Until those questions were resolved and recorded as an architectural decision, the watcher agents (ZA-001 Traffic, ZA-004 Conflict Sentinel, ZA-006 HR Capacity) had to stay in `draft_only` mode (propose, never commit).

The Phase 3.A.5 domain model and the Phase 3.D — 3.F implementations were built under provisional answers — most consequentially the "Commercial Gravity" invariant: *"subsidiary never quotes"*. That assumption is enforced three layers deep ([`ParentOrgGuard`](../src/router/guards/ParentOrgGuard.tsx) in the UI, [`assertParentOrgPrincipal`](../functions/src/assignment/lib/auth.js) in the Cloud Functions, and `isParentOrgPrincipal()` in [`firestore.rules`](../firestore.rules)).

Phase 6.C also shipped a category-based [conflict firewall](../functions/src/conflict-firewall/excludeConflicted.js) under the provisional answer to Q4.

This ADR records the final decisions and the consequent reshape work.

## 2. Decisions

### Q1 — Legal entity model

> *Are the five brands separate legal entities with their own books, or trading names under fewer entities?*

**Decision: Separate legal entities** — Zeus The Agency, Zeus Digital, Labyrinth, Odd Gorilla, and House of Zeus are each their own legal entity with their own books. Inter-company invoicing is real, not a cost-allocation fiction.

**Rationale:** allows each brand to defend its own P&L, supports KE-tax treatment for House of Zeus (separate from the Uganda entities), and aligns with how the consortium operates in market.

**Implications:**

- ✅ Already supported. `organizations/{orgId}.is_legal_entity` is `true` for all 5 sub-brands per the Phase 3.A.5 seed.
- ✅ The Phase 3.F `intercompany_invoices` collection + `closeWorkOrder` IC-invoice writer is the canonical flow.
- ✅ Each `Organization` carries `base_currency` and `gl_connection_id` for its own books.
- 📋 **Action:** confirm seed data has `is_legal_entity: true` for all 5 in a Firestore migration; verify FX rates table has UGX↔KES coverage for House of Zeus invoicing into the parent.

### Q2 — Commercial ownership (this is the breaking change)

> *Who holds the commercial relationship — group-level account-management, or each brand also sells direct?*

**Decision: Each brand also sells direct, with a precedence rule.** Both group-level AMs and brand-level ADs can sign clients. When an account is signed, it carries a `primaryBrandId` flag that fixes the home brand. Other brands can pitch into that client only with the home brand's consent (recorded as a `client_pitch_consent` row).

**Rationale:** the consortium already operates this way — each brand has its own ADs and its own client pipeline; group AMs handle whales and group-wide clients. Forcing all sales through a parent-org gate would invert the existing org chart.

**Implications — this is a meaningful reversal of the Commercial Gravity invariant:**

- ⚠️ The `ParentOrgGuard` blanket on `/clients`, `/master-jobs`, `/account-mgmt/*`, `/pricing/*`, `/billing/*` (router) needs to relax into a `BrandAccessGuard` that checks `client.primaryBrandId === caller.brandId` OR `caller.kind === 'PARENT'`.
- ⚠️ `assertParentOrgPrincipal` in `functions/src/assignment/lib/auth.js` becomes `assertCommercialPrincipal(client.primaryBrandId)` — accepts the brand's home AD OR a parent-org AM.
- ⚠️ `firestore.rules` `isParentOrgPrincipal()` becomes `canActOnClient(clientId)` — same boundary, finer signal.
- ⚠️ **The Phase 6.UI.0 sidebar manifest** (just merged in [#81](https://github.com/dawingroup/zeusos/pull/81)) needs a third org-kind variant. Today it has `PARENT` (full commercial sidebar) and `SUBSIDIARY` (delivery-only sidebar). Add **`SUBSIDIARY_SELLING`** — surfaces brand-scoped Account Mgmt / Pricing / Billing entries for subsidiary ADs.
- 📋 **Action:** add `clients.primaryBrandId: SubsidiaryId` to the [`Client` type](../src/modules/contracts/types/client.types.ts) and the create-client form. Default new clients via the creator's `homeOrgId`. Backfill existing clients to `primaryBrandId = 'zeus-group'` (preserve current behaviour for already-signed accounts).
- 📋 **Action:** add a `client_pitch_consent` collection (or a `clients.pitchConsent[]` field) for the cross-brand pitch permission. Out of scope for the first reshape PR; sketch as a follow-up.

### Q3 — Transfer pricing

> *How is transfer pricing set when brand A serves brand B's master_job?*

**Decision: Cost-plus, fixed markup.** Default `15%`; per-brand override allowed via `organizations/{id}.icMarkupPct` for brands with unusual cost structures (e.g. Labyrinth's higher equipment depreciation).

**Rationale:** arms-length transfer-pricing convention; defensible at audit time; predictable for the receiving brand's margin planning; simple to configure.

**Implications:**

- 📋 **Action:** add `engineConfig.icMarkupPctDefault: number` (defaults to 15) at [`functions/src/assignment/services/route-brand.service.js`](../functions/src/assignment/services/route-brand.service.js) ←→ wherever `transferPriceMinor` is computed for IC invoices. Likely lives in `functions/src/billing/intercompany.js`.
- 📋 **Action:** add `organizations/{id}.icMarkupPct: number | null` (null = use default). Editable via the Admin → Organisations surface; admin-only.
- 📋 **Action:** [`closeWorkOrder`](../functions/src/assignment/closeWorkOrder.js) reads the markup at the moment of IC-invoice creation. Store the applied pct on the `intercompany_invoices/{id}` doc for audit (the markup may change later without retroactive effect on settled invoices).

### Q4 — Conflict-firewall granularity

> *Is category exclusivity contractually promised, and at what granularity (category, sub-category, named-competitor list)?*

**Decision: Named-competitor list per client.** Each client carries an explicit list of competitors it won't tolerate the consortium serving. The list is contract-derived, edited by ADs at MSA / SOW signing time.

**Rationale:** matches how the contracts actually read in the East African market — "Pepsi will not work with an agency that serves Coca-Cola, Dr Pepper, or Fanta" is the contractual language, not "Pepsi will not work with an agency serving anyone in the carbonated-beverage category." Category-level exclusivity over-blocks (would forbid serving Bell Lager when serving Coca-Cola) and is harder to defend at contract review.

**Implications — this means the just-shipped 6.C `conflict_walls` model is the wrong shape:**

- ⚠️ The current PR [#78 (6.C Conflict Firewall)](https://github.com/dawingroup/zeusos/pull/78) ships `categories` + `client_categories` + `conflict_walls` keyed on categoryId. This shape over-blocks and doesn't capture contractual reality.
- ⚠️ PR [#83 (6.C UI)](https://github.com/dawingroup/zeusos/pull/83) builds the admin UI on top of the category model. Both need a rework.
- 📋 **New shape:** `client_competitors/{clientId__competitorClientId}` — `{ clientId, competitorClientId, sourceAggregateType: 'MSA' | 'manual', sourceAggregateId, notes, addedBy, addedAt }`. The firewall checks: *"is any candidate brand currently serving a client on the requesting client's competitor list?"*
- 📋 **Categories survive as a reporting overlay only.** AMs still tag clients by category for portfolio reporting ("we serve 3 FMCG clients across 4 brands"), but routing does not consult categories.
- 📋 **`excludeConflicted` rewrites** as: query `client_competitors` for the requesting client → for each competitor on the list, query open IWOs across all brands to find which brand serves them → exclude those brands.

## 3. Reshape plan

The work below brings the codebase in line with the four decisions. Sequenced for minimum breakage; each step is a separate reviewable PR. Phase 6.E / 6.F mutating-agent work stays paused until **all of section 3** lands.

### 3.1 Close the affected open PRs

| PR | Action | Reason |
|---|---|---|
| [#78](https://github.com/dawingroup/zeusos/pull/78) (6.C backend) | **Close** | Categories model wrong shape. Useful pieces (idempotent admin-callable pattern, outbox event `ConflictExclusivityRisk`) are reusable in the rewrite. |
| [#83](https://github.com/dawingroup/zeusos/pull/83) (6.C UI) | **Close** | UI built on the categories model. The `CategoryPickerDialog` / `WallsPage` shells are reusable shapes but the data model underneath changes. |
| [#80](https://github.com/dawingroup/zeusos/pull/80) (6.D backend) | **Keep open, rebase onto main** | ECD ladder + briefs + CES are independent of the commercial-model decisions. |
| [#84](https://github.com/dawingroup/zeusos/pull/84), [#85](https://github.com/dawingroup/zeusos/pull/85) (6.D UI + CES) | **Keep open, rebase onto main after #80** | Same — pure delivery / production work. |
| [#52](https://github.com/dawingroup/zeusos/pull/52) (Addendum docs) | **Keep open, layer this ADR in** | The docs PR should land as the authoritative reference; this ADR is its supporting decision record. |

### 3.2 Decision-driven changes (ordered)

1. **Conflict firewall rewrite (Q4)** — replaces #78 / #83.
   - New collection `client_competitors`, new admin CFns, new `excludeConflicted` matcher.
   - New UI: `CompetitorListPage` per client, `BreachRisksPage` consuming `ConflictExclusivityRisk` events (event type can carry over; payload shape changes).
   - Keep `categories` as a reporting overlay; remove `conflict_walls` and `client_categories` from the firewall path.

2. **IC markup config (Q3)** — additive, low-risk.
   - Add `organizations.icMarkupPct` schema field + Firestore migration.
   - Wire into `intercompany_invoices` creation; persist the applied pct on each invoice for audit.

3. **`primaryBrandId` on Client (Q2 setup)** — additive.
   - Add the field; default new clients via creator's home org; backfill existing clients to `zeus-group`.
   - Add to the create-client form + display on the client detail page.

4. **`BrandAccessGuard` + relax three-layer commercial gate (Q2 main change)** — breaking.
   - New `BrandAccessGuard` component (UI) and `assertCommercialPrincipal(clientId)` helper (functions).
   - Update `firestore.rules` — `isParentOrgPrincipal()` → `canActOnClient(clientId)` for the commercial collections (`clients`, `msas`, `sows`, `quotes`, `change_orders`, `master_jobs`, `client_invoices`).
   - **One PR per layer** so each can be smoke-tested before the next lands. The UI relax should ship last so subsidiary ADs don't see broken affordances before the API supports them.

5. **`SUBSIDIARY_SELLING` manifest variant (Q2 UI cleanup)** — extends [`src/core/navigation/manifest.ts`](../src/core/navigation/manifest.ts).
   - Third org-kind in `resolveNav`: brand admins on their own brand get a hybrid sidebar (Inbox + Active Work + ECD Review + their commercial entries scoped to their `primaryBrandId` clients).
   - Updates the dev-bypass user to match.

6. **Phase 6.E unblocked** — once steps 1–5 are merged and deployed.
   - Per the plan §17, mutating agents (ZA-001 Traffic, ZA-004 Conflict Sentinel, ZA-006 HR Capacity) can leave `draft_only` and move to `gated` mode.

### 3.3 Phase 6.UI work already shipped, status check

| PR | Status | Aligned with ADR? |
|---|---|---|
| [#81](https://github.com/dawingroup/zeusos/pull/81) Phase 6.UI.0 — Sidebar manifest | Merged | Mostly — needs the `SUBSIDIARY_SELLING` variant added (step 5 above). |
| [#88](https://github.com/dawingroup/zeusos/pull/88) Phase 6.UI.B — Traffic | Merged | ✅ Routing logic is brand-aware regardless of commercial-ownership model. |
| [#86](https://github.com/dawingroup/zeusos/pull/86) Phase 6.UI.A — Role Profiles | Merged | ✅ Role profiles are already brand-scoped; verb matrix and approval authorities don't depend on the commercial model. |
| [#84](https://github.com/dawingroup/zeusos/pull/84) Phase 6.UI.D.2 — ECD Review | Open | ✅ Delivery-side; no commercial-model dependency. Rebase + ship. |
| [#85](https://github.com/dawingroup/zeusos/pull/85) Phase 6.UI.D — CES + Brief | Open | ✅ Same. Rebase + ship. |

## 4. Consequences

- **Phase 6.E / 6.F mutating agents are unblocked once §3 lands.** This ADR satisfies the hard-gate condition in the plan.
- **The "subsidiary never quotes" invariant is retired.** Replace mental model with: *"subsidiary acts on its own brand's commercial relationships; parent acts on group-wide ones."*
- **The Phase 6.C work** (PRs #78 + #83) is wasted from a merge perspective but **the pattern carries**: idempotent admin callables, outbox event shape, admin-only `firestore.rules` posture, modular tabbed UI. Re-use the scaffolds; throw away the data model.
- **Two months of Phase 3 enforcement (UI + API + rules) needs relaxing**, in three coordinated PRs. Each layer is independently testable.
- **Subsidiary admins gain real authority over their own brand's clients** — and the system has to keep them strictly inside their brand's scope. The Conflict Firewall (rewritten under Q4) becomes the operative cross-brand boundary, not the commercial-gravity gate.

## 5. Open follow-ups

- **`client_pitch_consent` mechanism** — Q2's "cross-brand pitch with home-brand consent" needs UI + audit trail. Sketch as a separate ADR once primaryBrandId is live and we have real cross-brand pitch cases to model against.
- **Per-brand markup overrides (Q3)** — the schema supports it; the admin UI to edit it is a small follow-up. Out of scope for the first reshape PR.
- **Existing client backfill (Q2)** — every pre-ADR client gets `primaryBrandId = 'zeus-group'`. AMs can re-assign post-migration; we don't try to infer brand ownership from historical data.

---

*This ADR was drafted in collaboration with Claude Code on 2026-05-25, based on a structured Q&A session that walked through §15.5 of the work plan. The four answers were chosen by Zeus Group leadership.*
