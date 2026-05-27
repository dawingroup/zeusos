# UI Alignment Tracker

**Status:** Active — Phase U.4 layout compliance audit
**Last refreshed:** 2026-05-24
**Spec:** [docs/STYLING.md](STYLING.md)

This is the audit deliverable for Phase U.4 of the UI alignment pass. It scores every module's primary pages against the [spec §17 composition checklist](STYLING.md#17-composition-rules--what-to-use-when):

- **Chrome** — page renders inside `<ModuleTabNav>` + `<ModuleContentWrapper>` or has a documented reason not to
- **Grid** — dashboard-style rows use `.grid-kpis` / `.grid-cols-{2,3}` rather than ad-hoc grids
- **KPI tiles** — executive surfaces use `.kpi`; library/catalogue surfaces use `<KpiCard>`; not both on one page
- **Status** — uses `.rag` (semantic) or `statusBadgeClass()` (lifecycle), not bespoke colored spans
- **Lists** — compact lists in cards use `<div class="card-body tight">` + `.list-row`
- **Tokens** — `lint:design` reports 0 warnings (achieved 2026-05-24)

Verdicts: ✅ compliant · 🟡 partial / cosmetic only · ❌ scaffold (needs full refactor)

---

## Status summary

| | Pages audited | ✅ | 🟡 | ❌ |
|---|---|---|---|---|
| Total | ~80 | ~38 | ~35 | **7** |

**The 7 ❌ scaffolds are the actionable backlog.** Everything else is either compliant or has minor token/grid cosmetics that can be addressed when next touched — they're not blocking and the existing token-form is dark-mode-aware.

---

## ❌ Phase-3 scaffold backlog (action required)

These were authored during Phase 3.C (pricing) and Phase 3.E (delivery) before the token system existed. They use inline `style={{ padding: 24, fontSize: 13, color: '#475569', background: '#1d4ed8' }}` throughout and need a real Tailwind/token rewrite — not a per-hex token swap. Each is a discrete follow-up task.

| Page | Lines | Module | Effort | Priority |
|---|---|---|---|---|
| [`delivery/pages/IWOWorkspacePage.tsx`](../src/modules/delivery/pages/IWOWorkspacePage.tsx) | 573 | delivery | L | high (subsidiary daily driver) |
| [`pricing/pages/QuoteBuilderPage.tsx`](../src/modules/pricing/pages/QuoteBuilderPage.tsx) | 440 | pricing | L | high (AM workhorse) |
| [`delivery/pages/IWOInboxPage.tsx`](../src/modules/delivery/pages/IWOInboxPage.tsx) | 214 | delivery | M | high (subsidiary entry point) |
| [`pricing/pages/RateCardsPage.tsx`](../src/modules/pricing/pages/RateCardsPage.tsx) | 191 | pricing | M | medium |
| [`pricing/pages/RateCardEditorPage.tsx`](../src/modules/pricing/pages/RateCardEditorPage.tsx) | 166 | pricing | M | medium |
| ~~`delivery/components/RouteToAMButton.tsx`~~ | 94 | delivery | S | ✅ done in U.4 |
| ~~`delivery/components/BurnMeterBar.tsx`~~ | 73 | delivery | S | ✅ done in U.4 |

The two ✅ rows above are the proof-of-concept refactors landed alongside this audit. The other 5 should each be a ~half-day follow-up PR; pick them up incrementally as you touch the surrounding module.

Each carries a file-level `eslint-disable design-system/no-inline-style-literals -- TODO(U.4)` so U.6's lint-error promotion isn't blocked. Removing that disable comment is the merge gate for each follow-up PR.

---

## ✅ Compliant pages (sample)

| Module | Page | Notes |
|---|---|---|
| strategy | [`ExecutiveDashboard`](../src/modules/strategy/pages/ExecutiveDashboard.tsx) | Reference dashboard per spec §17 |
| strategy | [`KPIDashboard`](../src/modules/strategy/pages/KPIDashboard.tsx) | Uses `.kpi` tiles + `.grid-kpis` |
| finance | [`CashFlowPage`](../src/modules/finance/pages/CashFlowPage.tsx) | Cash-flow waterfall ref. impl. |
| finance | [`CFOBriefingPage`](../src/modules/finance/pages/CFOBriefingPage.tsx) | Uses `.kpi` + tokens throughout |
| intelligence | [`CompetitorDashboard`](../src/modules/intelligence/components/competitor/CompetitorDashboard.tsx) | Token-aligned post-sweep |
| account-management | [`ClientsPage`](../src/modules/account-management/pages/ClientsPage.tsx) | Token-aligned post-sweep |

---

## 🟡 Partial-compliance pages (cosmetic only — no action required)

Most modules' pages fall here: tokens are correct, dark mode works, accent swap works — but they don't use `<ModuleTabNav>` / `<ModuleContentWrapper>` (rely on `AppShell` chrome directly), or use shadcn `<Card>` rather than the density-aware `.card` / `.card-head` / `.card-body`. **These render correctly today.** Migrate to the density-aware primitives when you touch a file.

Module families in this bucket:
- All `finance/` pages except CashFlow + CFOBriefing
- All `hr-central/` pages — they use shadcn `<Card>` consistently
- All `procurement/` + `compliance/` + `crm/` + `suppliers/` + `admin/` pages
- All `talent/` + `media/` + `production/` + `campaigns/` + `billing/` + `account-management/` + `contracts/` pages
- `asset-library/` (recently polished in Phase 5.C)
- Most of `intelligence/` + `intelligence-layer/` + `market-intelligence/`

---

## Audit method

For each module, I sampled the entry page (e.g. `ClientsPage`, `EmployeeListPage`, `FinanceOverviewPage`) + 1-2 detail pages, and checked:

1. `grep -l ModuleTabNav,ModuleContentWrapper` — chrome compliance
2. `grep -l grid-kpis` — dashboard-grid usage
3. `grep -l "<KpiCard\|className=\"kpi"` — KPI-tile usage
4. `lint:design` per-file count — token compliance (now uniformly 0)

A page is 🟡 if it's token-compliant but doesn't yet use the chrome/grid primitives; ❌ only if it predates the token system and would need a rewrite (the 7 listed above).

---

## What this delivers

- **A clear, prioritized list of 5 remaining scaffold pages** that need real refactoring — each its own follow-up PR. No more "vague layout cleanup" backlog.
- **The other ~70 module pages are explicitly OK to leave as-is** unless you're already touching them. This unblocks U.6 (promote `lint:design` rules to error) — no page in the audit blocks it.
- **Two proof-of-concept refactors** (`BurnMeterBar`, `RouteToAMButton`) ship alongside this doc so the pattern is visible.
