# Phase 6 — Sibling-Brand Reconciliation + Intelligence Layer

Implementation playbook for the work scoped by [`ADDENDUM_V1_1.md`](ADDENDUM_V1_1.md) (sibling brands, conflict firewall, Tier system, ECD ladder, brand routing) and [`ADDENDUM_V1_2.md`](ADDENDUM_V1_2.md) (human capital, event/task engine, agent network).

The two addenda are **one phase**, not two — because v1.2's role-aware assigner *is* the engine behind v1.1's `routeBrand()`, and v1.2's verb matrix *is* the ECD ladder. Building them together avoids two passes on the same code paths.

> **Build philosophy** (v1.2 §8): ship as a sequence of small, reviewable PRs. Read-only watchers (Observe + Detect + Draft) deliver value with zero mutation risk and should land **well before** any agent gets `gated` mutation rights. Each agent tool handler is its own PR. Do not assume tools execute just because they're declared.

---

## Sub-phases & exit criteria

| Sub-phase | Scope | Closes | Exit criteria |
|---|---|---|---|
| **6.A** Human Capital Model | `role_profiles` + `role_assignments` + `EmployeeAssignmentService` on `hr-central`; engine config table | v1.2-A | Person routing works for any `eventType` against role-aware ranking |
| **6.B** Brand Routing + Tier | `routeBrand()` step in assignment CFns; Tier on engagement/master_job/IWO; `tier_sla_policy` config | v1.1 C2 + C4 | Issuing an IWO selects a serving brand by capability+capacity+conflict; SLA clock derived from Tier |
| **6.C** Conflict Firewall | `category`, `account_category`, `conflict_walls` collections; RBAC conflict-scope CHECK; reporting roll-up exclusion | v1.1 C3 | Walled accounts cannot be staffed across walls; cross-account reports never join two competing accounts |
| **6.D** ECD Ladder + Brief intake refinement | Verb matrix on `creative.internal_approval_requested`; IWO state expansion (`DELIVERED → [ladder rungs] → ACCEPTED_INTERNALLY`); intake brief authorship + CES stage | v1.1 C5 + C6 + C7 | An IWO cannot reach `ACCEPTED_INTERNALLY` without ECD `canApprove` sign-off; intake captures brief co-authorship; CES feeds pricing |
| **6.E** Event/Task Engine | `EventDefinition.tasks[]` + `generatedTasks` + uniform inbox surface; event families `campaign.*` / `iwo.*` / `creative.*` / `media.*` / `financial.*` / `hr.*` | v1.2-B | A `BusinessEvent` write deterministically produces inbox cards routed via §6.A |
| **6.F** Agent Network | `agents` + `agent_audit_entries` + dispatcher with 4 gates + tool-registry unification with MCP; ZA-002 + ZA-003 in `draft_only`; ZA-001, ZA-004, ZA-006 in `gated` (one PR per handler) | v1.2-C | Watcher agents emit findings + draft tasks into the human inbox; every refusal audited; no agent mutates without explicit human accept |

**Hard gate:** 6.E mutating agents (ZA-001, ZA-004, ZA-006) **may not ship** until the four v1.1 §9 commercial questions are resolved (legal-entities vs trading-names, group vs per-brand sell, transfer pricing policy, category-exclusivity granularity).

---

## 6.A — Human Capital Model

**Files to add:**
- `src/modules/hr-central/types/role-profile.types.ts` — `RoleProfile`, `RoleSkill`, `TaskCapability`, `ApprovalAuthority` interfaces.
- `src/modules/hr-central/services/role-profile.service.ts` — CRUD.
- `src/modules/hr-central/services/role-assignment.service.ts` — assign / un-assign / effective-dated lookup.
- `src/modules/hr-central/services/employee-assignment.service.ts` — `resolveAssignment(rule, context)` dispatching on `role` / `department` / `user|manager|creator` / `dynamic`; role-aware ranking by current utilisation; fallback chains.
- `src/modules/hr-central/services/engine-config.service.ts` — working hours (08:00–17:00 EAT Mon-Fri), SLA hours by priority, reminder cadence, overdue-escalation thresholds. **Coupled to Tier System (see 6.B).**
- `firestore.rules` — add `role_profiles`, `role_assignments`, `engine_config` collections (read: any authed; write: `isParentOrgPrincipal()` + admin).
- `functions/__tests__/hr-central/employee-assignment.test.js` — coverage for the four rule types + fallback cascade + overloaded-expert-loses-to-available-intermediate.

**Schema (Firestore):**
```
role_profiles/{id}
  brandId, departmentId, jobLevel, employmentTypes,
  reportsTo[], supervises[], peers[], escalationPath[], delegationPool[],
  skills[], taskCapabilities[], approvalAuthorities[],
  typicalTaskLoad: {daily, weekly, maxConcurrent},
  aiContext: {briefingPriorities[], taskSortingWeights, communicationStyle}

role_assignments/{id}
  employeeId, role_profile_id, effectiveFrom, effectiveTo,
  overrides: {customAuthorities?, maxDailyTasks?}
```

**Seed:** ~10 ZeusOS role profiles for the five sibling brands plus group-level Account Director, Traffic Manager, CFO. (Port shape from DawinOS ~40 profiles; re-point `subsidiaryId` and `taskCapabilities.eventType`.)

**Exit:** `resolveAssignment({ rule: 'role', roleId: 'ECD' }, { event })` returns the next available ECD with capacity, falling back to manager if no one is available.

---

## 6.B — Brand Routing + Tier System

**Files to touch:**
- `functions/src/assignment/issueWorkOrder.js` — insert `routeBrand()` step before the IWO insert.
- `functions/src/assignment/routeBrand.js` *(new)* — wraps `EmployeeAssignmentService` at brand scope (capability + conflict + capacity); on `region == 'KE'`, prefer House of Zeus; on empty candidates, raise `NO_ELIGIBLE_BRAND` and emit `routing.brand_proposed` with `manual_required: true`.
- `functions/src/platform/outbox.js` — add `RoutingBrandProposed` event type.
- `src/modules/account-management/types/engagement.types.ts` — add `default_tier: BriefTier`.
- `src/modules/account-management/types/master-job.types.ts` — add `tier: BriefTier`.
- `src/modules/delivery/types/internal-work-order.types.ts` — add `tier: BriefTier`, `sla_due_at: Timestamp`.
- `src/modules/account-management/services/tier-sla-policy.service.ts` *(new)* — resolves `tier → {min_lead_days, feedback_days, briefing_mode}` from `tier_sla_policy` collection.
- `firestore.rules` — `tier_sla_policy` (read: any authed; write: parent-org admin).
- `src/modules/account-management/pages/IntakePage.tsx` — Tier classification field + validation that `sla_due_at >= now + tier.min_lead_days` without admin override (logged).

**Routing is a recommendation; Traffic decides.** The CFn writes `RoutingBrandProposed`, and the IWO is held in `PROPOSED` state until a Traffic/PM role confirms. This is also the seam where ZA-001 (Routing agent) plugs in 6.F.

**Exit:** Issuing a `master_job` with capability "media buying" picks the highest-capacity non-conflicted brand among ZTA / Zeus Digital / House of Zeus; `sla_due_at` reflects Tier-derived minimum; manual override is logged.

---

## 6.C — Conflict Firewall

**Files to add:**
- `src/modules/account-management/types/category.types.ts` — `Category` + `AccountCategory` + `ConflictWall` interfaces.
- `src/modules/account-management/services/category.service.ts` — CRUD.
- `src/modules/account-management/services/conflict-wall.service.ts` — `pinAccountToBrand(accountId, brandId, categoryId)`; `isWalled(accountId): ConflictWall | null`.
- `functions/src/assignment/routeBrand.js` — call `excludeConflicted(masterJob.account)` before the capability filter.
- `firestore.rules` — `categories` / `account_categories` / `conflict_walls`; **isolation:** a principal whose `walledAccounts[]` intersects an account's competing-category set cannot read that account (returns `permission-denied`, not just empty data).
- `src/modules/intelligence/services/reporting-rollup.service.ts` — filter walled-account joins out of cross-account aggregates.
- `functions/__tests__/firestore-rules/conflict-firewall.test.js` — verify (a) Odd Gorilla principal cannot read ZTA account in same category, (b) ECD assigned to walled-account-A cannot be granted `canApprove` on walled-account-B in same category, (c) group-level reports exclude walled joins.

**Exit:** the three v1.1 §6.2 enforcement layers pass tests. Reporting shows group margin without leaking competing-creative metadata.

---

## 6.D — ECD Ladder + Brief Refinements

**Files to touch:**
- `src/modules/delivery/types/internal-work-order.types.ts` — expand state machine: `DELIVERED → AWAITING_DESIGNER_REVIEW → AWAITING_AD_REVIEW → AWAITING_STUDIO_REVIEW → AWAITING_ACD_REVIEW → AWAITING_CD_REVIEW → AWAITING_ECD_REVIEW → ACCEPTED_INTERNALLY`. Tier 3 may collapse to `AWAITING_STUDIO_REVIEW → AWAITING_CD_REVIEW` per brand config.
- `functions/src/assignment/advanceApprovalRung.js` *(new)* — checks the actor's `taskCapabilities` for `canApprove` on `creative.internal_approval_requested` at the right rung; emits `ApprovalRungAdvanced` or `ApprovalRungRejected`.
- `functions/src/assignment/acceptInternal.js` — gate on ECD-rung `canApprove` only; emits `InternalApprovalGranted`.
- `functions/src/platform/outbox.js` — add `ApprovalRungAdvanced`, `ApprovalRungRejected`, `InternalApprovalGranted` event types.
- `src/modules/account-management/types/engagement.types.ts` — add `brief.authorship[]` + `brief.documentSubmittedAt: Timestamp` + `brief.verbalAt: Timestamp` (enforce ≥ 24h gap unless admin override).
- `src/modules/account-management/pages/IntakePage.tsx` — brief co-authorship UI (C6).
- `src/modules/pricing/services/pricing.service.ts` — accept CES line-items as typed input (`{lineType: 'CES', costMinor, supplierId, deliverableId}`); applied to quote/change-order with ceiling check (C7).

**Exit:** Tier-1 creative IWO cannot reach `ACCEPTED_INTERNALLY` without all 6 rungs signing off; Tier-3 collapses per brand config; intake records co-authorship + 24h rule; CES lines flow into pricing.

---

## 6.E — Event / Task Engine

**Files to add:**
- `functions/src/events/eventDefinition.schema.js` *(new)* — `EventDefinition.tasks[]` with `{titleTpl, priority: P0..P3, dueInDays, assignTo: AssignmentRule, conditions?}`.
- `functions/src/events/generateTasks.js` *(new)* — Firestore trigger on `domain_events/{eventId}`; resolves `EventDefinition[eventType]`; for each rule, calls `EmployeeAssignmentService.resolveAssignment(rule.assignTo, {event})`; writes `generated_tasks/{taskId}` with bidirectional audit chain `{eventId, parentTaskId?}`.
- `src/modules/shared-ops/types/generated-task.types.ts` — `GeneratedTask` interface; lifecycle `pending_assignment → assigned → in_progress → pending_review → completed|cancelled|blocked|escalated`.
- `src/modules/shared-ops/pages/InboxPage.tsx` — single inbox card surface; each card carries `source` / WHY-header keyed to creator (trigger / scheduled / agent-id).
- `src/modules/shared-ops/services/task-lifecycle.service.ts` — transitions; emits downstream `task.completed` event feeding the next inference cycle.

**Event-family seeds** (the `EventDefinition` config docs):
- `campaign.stage_changed` → "Prep next-stage deliverables" (P2, 1d, role-rule → AM)
- `iwo.sla_due_soon` → "Nudge owner; flag Traffic" (P1, same-day, user-rule → IWO owner)
- `iwo.budget_exceeded` → "Block postings; raise change-order task" (P0, same-day, role-rule → Account Director)
- `creative.revision_requested` → "Return to originator with notes" (P1, 1d, creator-rule)
- `media.flight_underpacing` → "Investigate pacing vs plan" (P1, 2d, role-rule → Media Lead)
- `hr.over_allocated` → "Rebalance load / escalate to manager" (P2, 2d, manager-rule)

**Exit:** writing a `domain_event` of any seeded type produces inbox cards on the right people's queues; lifecycle transitions emit downstream events; `dedupeKey` prevents double-cards.

---

## 6.F — Agent Network

Split across multiple small PRs. **Each tool handler is its own PR.**

### 6.F.1 — Foundation (one PR)

**Files to add:**
- `functions/src/agents/agent.schema.js` — Agent doc shape with `confidenceFloor`, `autoActMode`, `enabledTools[]`.
- `functions/src/agents/dispatcher.js` — single chokepoint with 4 gates (load agent → paused? → tool enabled? → mode allows mutation?) → handler registry lookup → write `agent_audit_entries/{id}` on success/denial/error.
- `functions/src/agents/toolRegistry.js` — enumerated tools (`<scope>.<noun>`); **imports the same MCP tool definitions** from [`zeusos-mcp-server/src/tools/`](../zeusos-mcp-server/src/tools) so there's one registry with two callers.
- `firestore.rules` — `agents` (read: any authed; write: parent-org admin); `agent_audit_entries` (read: parent-org admin; write: server-only via `request.auth.token.admin == true` or CFn).
- `functions/src/platform/outbox.js` — add `AgentFindingRaised`, `AgentActionRefused` event types.
- `functions/__tests__/agents/dispatcher.test.js` — all four gates fire; refusal writes audit row; missing handler returns failed-precondition.

### 6.F.2 — MCP/agent registry unification (one PR)

The 11 packs in [`zeusos-mcp-server/src/tools/`](../zeusos-mcp-server/src/tools) are recast as the single source of truth. The agent dispatcher imports the same handler functions; MCP wraps them for human callers. Adding a tool = one PR that updates the registry constant + the handler + the schema doc.

### 6.F.3 — Read-only watchers (one PR each, `draft_only`)

| PR | Agent | Tool handlers added |
|---|---|---|
| #1 | **ZA-002 Burn & SLA Watcher** | `read.iwo`, `read.budget`, `read.burn`, `read.tier_sla_policy`, `write.create_task`, `notify.user` |
| #2 | **ZA-003 ECD Cycle-Time Watcher** | `read.iwo`, `read.approvals`, `read.role_profiles`, `write.create_task` |

Both run on cron; both emit `agent.finding_raised`; tasks idempotent by `dedupeKey` (e.g. `burn-iwo:{iwoId}:80pct`).

**This is where most of the value lands.** With these two shipped in `draft_only`, leadership sees burn risk and approval-stall hotspots without any agent mutation.

### 6.F.4 — Gated mutating agents (one PR each — **gated on commercial-Q resolution**)

| PR | Agent | Adds | Closes |
|---|---|---|---|
| #3 | **ZA-001 Traffic / Routing Advisor** | Proposes serving brand via `routing.brand_proposed`; Traffic confirms | v1.1 C2 (the agent shape of `routeBrand()`) |
| #4 | **ZA-004 Conflict Sentinel** | Pre-assignment scan; emits `conflict.exclusivity_risk` | v1.1 C3 |
| #5 | **ZA-006 HR & Capacity Compliance** | Renewals, leave, over-allocation; gated draft on payroll-adjacent tasks | — |

### 6.F.5 — Live LLM model selection (one PR)

Wire the service layer to honour `agent.model` + `fallbackModel` before relying on per-agent models. Today the runtime ignores `agent.model`.

### 6.F.6 — Intelligence module decision (one PR)

Decide: merge [`src/modules/intelligence`](../src/modules/intelligence) and [`src/modules/intelligence-layer`](../src/modules/intelligence-layer) into one; or keep referencing as DawinOS does (with a `README` explaining the boundary).

### 6.F.7 — Carried agents adapted (one PR each)

- ZA-005 Finance Sentinel (`draft_only` initially — never posts journals)
- ZA-007 Strategy Agent
- ZA-008 Deal Stage Watch
- ZA-009 Media Performance Scout
- ZA-010 Market Intel Scout (`paused` until external data sources wired)

---

## Acceptance gate

Phase 6 is complete when:

1. ✅ Issuing a `master_job` automatically proposes a serving brand respecting capability, conflict, and Tier-derived SLA; Traffic confirms or overrides (logged).
2. ✅ A walled account cannot be staffed across walls; cross-account reports never join two competing accounts in the same category.
3. ✅ A Tier-1 creative IWO cannot reach `ACCEPTED_INTERNALLY` without the full 6-rung ECD chain signing off (per-brand chain).
4. ✅ Writing a `domain_event` of a seeded type produces inbox cards on the right people's queues.
5. ✅ ZA-002 and ZA-003 emit findings + draft tasks visible in the same inbox as human-routed work; every refusal logged in `agent_audit_entries`.
6. ⏳ ZA-001 + ZA-004 + ZA-006 ship **only after** plan §17 §9 commercial questions are resolved and recorded as an architectural decision in `docs/`.

The Playwright lifecycle spec extends to: AM creates engagement at Tier 1 → routing proposes ZTA → Traffic confirms → IWO issued → designer submits → 6-rung ECD ladder runs → ACCEPTED_INTERNALLY → client approval → close → i/c invoice → client invoice — with ZA-002 firing a "burn at 80%" draft task mid-flow.
