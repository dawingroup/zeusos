# ADR-0001 — Commercial Structure

**Date:** 2026-05-24
**Status:** Accepted
**Decided by:** Zeus leadership
**Gate satisfied:** [Addendum v1.1 §15.5](../ADDENDUM_V1_1.md) / [Phase 6 playbook §17.2](../PHASE_6_INTELLIGENCE_LAYER.md) "Hard gate on Phase 6.F mutating agents"
**Supersedes:** N/A
**Superseded by:** N/A

---

## Context

Addendum v1.1 §15.5 surfaced four commercial questions that the build spec could not answer without leadership input. The Phase 6 implementation playbook documents these as a **hard gate** on Phase 6.F — no mutating agent (ZA-001 Routing, ZA-004 Conflict Sentinel, ZA-006 HR Capacity) may ship until they resolve, because each touches money, contracts, or staffing in ways that depend on the answers.

This ADR records the leadership decisions, the rationale where given, and the precise downstream code changes each unlocks or requires.

---

## Decision 1 — Legal entity structure

**Q:** Are the five sibling brands separate legal entities (real inter-co invoicing) or trading names under one entity (internal cost allocation)?

**Decision:** **Separate legal entities — real inter-co invoicing.**

Each brand has its own GL, files its own taxes, raises real inter-company invoices when work crosses brand boundaries.

### Implementation impact

| Surface | What stays / changes |
|---|---|
| `organizations/{orgId}.is_legal_entity` | `true` for all 5 brand orgs + `zeus-group`. Existing default. |
| `closeWorkOrder` outbox | Emits `InterCompanyInvoiceRaised` (not `IntraEntityCostAllocated`) on every cross-brand IWO close. Code path already exists ([`functions/src/assignment/closeWorkOrder.js`](../../functions/src/assignment/closeWorkOrder.js)). |
| Billing engine | `InterCompanyInvoice` collection populated per close. UI shows the cross-brand AR/AP ledger. |
| 6.F Finance Sentinel (ZA-005) | Reads real inter-co invoice aging — no path-switching logic needed. |

**Net change to existing code: none.** This is the documented default in v1.0 §8 and the codebase ships it correctly.

---

## Decision 2 — Commercial relationship ownership

**Q:** Who holds the commercial relationship — group-level Account Management only, or do brands also sell direct?

**Decision:** **Brands also sell direct.**

Zeus Group's Account Management team holds the strategic relationship for parent-level clients, **and** brand-side commercial leads can independently sign MSAs / SOWs / Quotes / Invoices for clients they win directly.

### Why this is the complex answer

v1.1 §15.5 explicitly flagged: *"if brands sell independently, the firewall and single-invoice rules need a defined precedence."* That work is now required.

### Implementation impact — gating PRs that must land before 6.F

| Required change | Where | Status |
|---|---|---|
| **Brand-scoped commercial verbs** in `RoleProfile.taskCapabilities` (e.g. an Account Director on Zeus Digital can `canApprove` on `quote.*` events when scoped to that brand) | [`src/modules/hr-central/role-profiles/types`](../../src/modules/hr-central/role-profiles/types) — extend the `TaskCapability` shape with optional `brandScope: SubsidiaryId[]` | ❌ New work |
| **`ParentOrgGuard`** relaxed for brand-direct sales paths | [`src/router/guards/ParentOrgGuard.tsx`](../../src/router/guards/ParentOrgGuard.tsx) — currently blanket parent-org only. Needs split into `requireCommercialScope` that accepts either `parent` or a specific brand | ❌ New work |
| Server-side `assertParentOrgPrincipal` helpers in [`functions/src/assignment/lib/auth.js`](../../functions/src/assignment/lib/auth.js) get a sibling `assertCommercialPrincipal({ allowedBrandId? })` | functions/src/assignment/lib/auth.js | ❌ New work |
| **Account anchor** (which org owns the client commercially) recorded on `Client.commercialOwnerOrgId` | [`src/modules/contracts/types/client.types.ts`](../../src/modules/contracts/types/client.types.ts) | ❌ New work |
| **Conflict firewall anchor** uses `Client.commercialOwnerOrgId` instead of "whichever brand has an open IWO" — brand-owned account is its own wall anchor (per Q4 model below) | [`functions/src/conflict-firewall/excludeConflicted.js`](../../functions/src/conflict-firewall/excludeConflicted.js) | ❌ Rewrite needed |
| **Single-invoice rule** stays **per-master-job** (already correct — `ClientInvoice` is `UNIQUE per master_job` per CLAUDE.md) — confirms the rule was already right | [`functions/src/billing/`](../../functions/src/billing) | ✅ No change |
| **Reporting roll-ups** distinguish parent-AM-sold vs brand-sold revenue at the master-job level | Phase 6.F intelligence layer (downstream) | ❌ Phase 6.F |
| 6.F ZA-001 (Routing) — must respect that brand-owned accounts CANNOT be routed away from their owning brand without commercial-owner override | [`functions/src/assignment/services/route-brand.service.js`](../../functions/src/assignment/services/route-brand.service.js) | ❌ Phase 6.F |
| 6.F ZA-004 (Conflict Sentinel) — competitor walls anchor at `commercialOwnerOrgId`, not "first brand to serve" | conflict-firewall | ❌ Phase 6.F |

---

## Decision 3 — Transfer pricing policy

**Q:** How is transfer pricing set between brands — cost, cost-plus, or market?

**Decision:** **Cost-plus.**

Receiving brand bills the master-job-owning brand at `cost + fixed markup %`. Per-pair markup configurable.

### Implementation impact

| Surface | Change |
|---|---|
| New collection `transfer_pricing_policy/{fromOrgId}__{toOrgId}` | `{ fromOrgId, toOrgId, markupPct, effectiveFrom, effectiveUntil?, setBy, setAt }`. Admin-only write. Versioned (effective-dated) for audit. |
| `closeWorkOrder` transfer-price math | `transferPriceMinor = cumulativeCostMinor × (1 + lookupMarkupPct(fromBrand, toBrand) / 100)`. Currently `transferPriceMinor` is set at issue time from the rate card — needs migration to compute-on-close from policy. |
| Quote builder | Unchanged for client-facing pricing (still rate card × markup). Cost-plus only governs the **intra-group** leg. |
| Default policy | `markupPct = 10` when no row exists for the pair. Seed via [`functions/src/migrations/seedTransferPricingPolicy.js`](../../functions/src/migrations) — admin-callable. |
| 6.F Finance Sentinel (ZA-005) | Reads markup policy when computing per-brand margin posts (catches "brand X is delivering at cost"). |

**Note:** Q3 affects the close-side IWO math, not the issue-side. Existing `transferPriceMinor` at issue stays as a hint; close recomputes from the (newer) policy.

---

## Decision 4 — Conflict firewall granularity

**Q:** Category-exclusivity — single category, sub-category, or named-competitor list per client?

**Decision:** **Named-competitor list per client.**

Each client carries an explicit list of competitor clients they do not want sharing a brand. Most flexible, most accurate, requires upfront list maintenance per client at intake.

### Implementation impact — invalidates 6.C as currently designed

PR #78 (Conflict Firewall, in review) currently uses the `Category` × `ClientCategory` × `ConflictWall` model from Addendum v1.1 §6. This ADR deprecates that model in favour of a named-competitor edge.

| Old (PR #78) | New (this ADR) |
|---|---|
| `categories/{id}` master list | **deprecated** — keep for reporting taxonomy if useful, drop from firewall path |
| `client_categories/{id}` many-to-many | **deprecated** |
| `conflict_walls/{id}` snapped-in-place | **deprecated** in favour of competitor-edge walk |
| `excludeConflicted` queries `conflict_walls` by brand+category | **rewrite** to walk `client_competitors[clientId]` → for each competitor → which brand serves them (from any OPEN IWO) → exclude that brand |

### New schema

```
client_competitors/{clientId__competitorClientId}
  {
    clientId: string,
    competitorClientId: string,
    addedBy, addedAt,
    addedAtMasterJobId?,   // pinned to the moment / context the competitor was declared
    notes?,
  }
```

Symmetric: adding `pepsi → coke` does NOT auto-create `coke → pepsi`. Both sides record independently (in practice the AM enters both at intake).

### New routing path

```js
async function excludeConflicted({ db, candidates, requestingClientId, ... }) {
  // 1. Read competitor list for requesting client.
  const competitorsSnap = await db.collection('client_competitors')
    .where('clientId', '==', requestingClientId).get();
  const competitorIds = competitorsSnap.docs.map(d => d.data().competitorClientId);
  if (competitorIds.length === 0) return { walledBrandIds: [] };

  // 2. For each competitor, find which brand(s) are serving them
  //    via OPEN master_jobs (NOT just IWOs — covers brand-direct sells too).
  for (const c of candidates) {
    if (c.rejectionReason) continue;
    for (const competitorId of competitorIds) {
      const openJobs = await db.collection('master_jobs')
        .where('clientId', '==', competitorId)
        .where('status', 'in', ['OPEN', 'IN_PROGRESS'])
        .where('commercialOwnerOrgId', '==', c.brandId)   // Q2 anchor
        .limit(1).get();
      if (!openJobs.empty) {
        c.conflicted = true;
        c.rejectionReason = 'CONFLICTED';
        break;
      }
    }
  }
  // ...emit ConflictExclusivityRisk same as before
}
```

| Change | Where | Status |
|---|---|---|
| Replace category collections + types | [`src/modules/contracts/types/conflict-firewall.types.ts`](../../src/modules/contracts/types/conflict-firewall.types.ts) — drop `Category`, `ClientCategory`, `ConflictWall`; add `ClientCompetitor` | Required (in 6.C v2 PR) |
| Rewrite `excludeConflicted` | [`functions/src/conflict-firewall/excludeConflicted.js`](../../functions/src/conflict-firewall/excludeConflicted.js) | Required (in 6.C v2 PR) |
| Update tests | [`functions/__tests__/assignment/conflict-firewall.test.js`](../../functions/__tests__/assignment/conflict-firewall.test.js) | Required (in 6.C v2 PR) |
| `firestore.rules` for `client_competitors` | [`firestore.rules`](../../firestore.rules) | Required (in 6.C v2 PR) |
| Intake form captures competitor list | Frontend account-management — defer to UI follow-up | Phase 6.UI.D |
| 6.F ZA-004 (Conflict Sentinel) reads `client_competitors` not `conflict_walls` | Phase 6.F | Phase 6.F |

---

## Consequences

### Unblocked
- ✅ Phase 6.F mutating agents (ZA-001 / ZA-004 / ZA-006) — the §15.5 gate is now satisfied
- ✅ Brand-side commercial RBAC (Q2) gives brand teams real autonomy
- ✅ Named-competitor model (Q4) gives Account Mgmt precise control vs. blunt category blocking

### Required before 6.F can ship
Four PRs must land in order:

1. **This ADR** (this PR) — captures the decisions
2. **6.C v2 — Named-competitor firewall** — supersedes PR #78's data model (Q4 work)
3. **Brand-direct commercial scope** — `commercialOwnerOrgId` on `Client`, `brandScope` on `TaskCapability`, `assertCommercialPrincipal` helper (Q2 work)
4. **Transfer-pricing policy** — `transfer_pricing_policy` collection + close-side computation rewrite (Q3 work)

Then 6.F builds on top.

### Risks
- **Q2 RBAC complexity** — brand-scoped commercial verbs are a meaningful surface-area increase. Mitigated by keeping the verb matrix data-driven (capability is data — see v1.2 §6.3); no code paths need branching.
- **PR #78 disposition** — its category model is now technical debt. We can either (a) ship-then-deprecate (clean main timeline, brief deprecation cycle) or (b) close + reopen with the rewrite. Implementation choice deferred to the 6.C v2 PR description.
- **Migration risk on existing data** — none yet, since `categories` / `client_categories` / `conflict_walls` collections aren't populated in prod (PR #78 not deployed).

---

## References

- [Addendum v1.1](../ADDENDUM_V1_1.md) — §6 Conflict Firewall, §9 Open Questions, §15.5 Commercial questions
- [Addendum v1.2](../ADDENDUM_V1_2.md) — §6.3 Capability is data
- [Phase 6 Implementation Playbook](../PHASE_6_INTELLIGENCE_LAYER.md) — §17.2 hard gate
- [Tech Spec v1.0 §8](../DOMAIN_MODEL.md) — Pricing pipeline + inter-co settlement
- PRs: [#78 (Conflict Firewall v1)](https://github.com/dawingroup/zeusos/pull/78) (to be superseded), [#52 (addenda docs)](https://github.com/dawingroup/zeusos/pull/52)
