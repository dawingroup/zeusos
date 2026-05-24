# ZeusOS Addendum v1.2 — Human Capital × Business Events × Agent Network

**Source:** `ZeusOS_Addendum_v1.2.pdf` (16pp, draft 2026-05-24).
**Companion to:** ZeusOS Tech Spec v1.0 + Addendum v1.1.
**Grounded in:** DawinOS intelligence architecture (carried over, re-scoped to agency).
**Status:** Engineering reference. Extends v1.1 §7 (assignment), §7 (ECD ladder); adds the intelligence layer.
**Implementation:** plan §17 Phase 6.A–6.F.

---

## 1. Position

ZeusOS treats **human capital as a leveraged, first-class resource** and adds an **AI intelligence layer** that accelerates human capacity and monitors the system. The patterns are proven in DawinOS; **most of the agent layer is design intent, not lift-and-drop**.

### 1.1 The one-sentence design claim

> **A task is a task.** Whether a Firestore trigger, a scheduled scan, or a Claude inference created it, work lands in one human inbox, and a person's role profile alone decides whether it reaches them and what authority they wield over it. The AI layer does not run a parallel queue; it writes the same task rows humans already act on.

### 1.2 Three coupled subsystems

```
A · HUMAN CAPITAL MODEL     B · EVENT & TASK ENGINE      C · AGENT NETWORK (AI LAYER)
who can do what,            observes the business,       sits above the engine;
approve, absorb what        generates work               reads what humans read
─────────────────           ─────────────────            ─────────────────
Role Profile                BusinessEvent <module>.<e>   Agent contract /agents/{id}
Role Assignment             3 detection surfaces         Tool registry <scope>.<noun>
Org graph                   EventDefinition.tasks[]      Dispatcher — single chokepoint
EmployeeAssignmentService   generatedTasks → inbox       Background watchers (cron)

THE SUPERCHARGE LOOP
  state change → event matched → task generated → lands in inbox → act/approve
  ↑                                                                       │
  └────────── completion emits downstream events (next inference cycle) ──┘

THE AGENT LAYER ADDS FIVE VERBS
  Observe  ·  Detect  ·  Act (within envelope)  ·  Audit (everything)  ·  Personalise
```

### 1.3 Proven vs aspirational (carried over from DawinOS self-assessment)

| Area | Status in DawinOS | Implication for ZeusOS |
|---|---|---|
| Role-profile / verb-matrix model | Proven — ~40 profiles shipped | Port + re-scope to 5 sibling brands; low risk |
| Event → task generator | Proven — Firestore triggers + cron | Re-point event names to agency families |
| Dispatcher chokepoint + audit | Proven — all four gates + audit live | Lift pattern directly |
| Agent tool handlers | **1 of 66 implemented** (KPI measurement) | Each handler is a discrete PR; do **not** assume tools execute because they're declared |
| Live LLM model selection | **Not wired** — runtime ignores `agent.model` | Wire service layer to honour `agent.model` before per-agent models matter |
| Two intelligence modules | **Not merged** (`intelligence` + `intelligence-layer`) | Decide: merge, or keep referencing as DawinOS does |
| Standalone event bus | None — events are Firestore docs + triggers | Fine at current scale; revisit if volume grows |

> The intelligence layer's architecture is **proven and safe-by-design**: agents cannot act outside an audited, admin-set envelope, and every refusal is logged. But today it is a **skeleton with one wired handler and no live model selection**. Adopting it for ZeusOS means committing to a sequence of small, reviewable PRs — one per tool handler — not flipping a switch.

---

## 2. Subsystem A — Human Capital Model

People as role profiles + role assignments, **not flat permissions**. ~40 profiles in DawinOS; for ZeusOS, `subsidiaryId` is re-pointed to the five sibling brands and the verb matrix is re-pointed to agency event types.

### 2.1 Role profile shape

```ts
interface RoleProfile {
  brandId: 'zeus-the-agency' | 'zeus-digital' | 'labyrinth'
         | 'odd-gorilla' | 'house-of-zeus' | 'zeus-group' | 'all';

  // Organisational placement
  departmentId: string;
  jobLevel: string;
  employmentTypes: string[];

  // Org graph (first-class, not derived)
  reportsTo: string[];
  supervises: string[];
  peers: string[];
  escalationPath: string[];
  delegationPool: string[];

  // What the role knows
  skills: RoleSkill[];     // {category, name, requiredLevel, isCore}
                           // proficiency: novice → intermediate → advanced → expert

  // What the role can do (the verb matrix — §2.2)
  taskCapabilities: TaskCapability[];

  approvalAuthorities: ApprovalAuthority[];  // typed; optional maxAmount,
                                             // requiresCoApproval, canApproveFor scope

  typicalTaskLoad: { daily: number; weekly: number; maxConcurrent: number };

  // Per-role AI personalisation
  aiContext: {
    briefingPriorities: string[];
    taskSortingWeights: Record<string, number>;
    communicationStyle: string;
  };
}
```

The `aiContext` is what lets the AI layer **tailor what surfaces to whom**: an ECD sees creative-quality and approval-queue items first; an Account Director sees client-health and margin first; a Traffic Manager sees capacity and SLA risk first. Same system, different lens per role.

### 2.2 Task capabilities — the verb matrix

The unit of human authority. **No RBAC tree, no role-string matching** — authority is enforced by these flags:

```ts
interface TaskCapability {
  eventType: string;       // 'iwo.budget_exceeded' |
                           // 'creative.revision_requested' |
                           // 'campaign.stage_changed' | ...
  taskTypes: string[];     // ['approve_change_order', 'escalate_to_ecd']
  canInitiate: boolean;
  canExecute: boolean;
  canApprove: boolean;
  canDelegate: boolean;
  conditions?: TaskCondition[];
}

// Example — Executive Creative Director, agency brand:
//   eventType 'creative.internal_approval_requested'
//   canInitiate:false  canExecute:true  canApprove:true  canDelegate:true
// This is the top rung of the ECD ladder (Addendum v1.1 §7) expressed
// as a capability.
```

**Unification with v1.1 §7 (ECD ladder):** the ladder is **not a separate mechanism** — it is the verb matrix applied to creative-approval event types. Each rung (Designer → AD → Studio Mgr → ACD → CD → ECD) is a role whose `taskCapabilities` grant `canApprove` on `creative.internal_approval_requested` at its level. Climbing the ladder = the event escalating up `escalationPath` until a role with terminal `canApprove` (ECD) signs off. **One model now drives both human routing and the internal-acceptance gate.**

### 2.3 Distribution algorithm

```
EmployeeAssignmentService.resolveAssignment(rule, context)
  dispatches on rule type:
  • role     — employees whose primary assignment matches, ranked by availability
  • department — broader pool, same ranking
  • user / manager / creator — direct lookups by triggering user or their manager
  • dynamic  — criteria search on skills + authority + amount-to-approve + urgency

Ranking is role-aware: each candidate's max load defaults to the role's
typicalTaskLoad.maxConcurrent; candidates are ordered by current utilisation
— an overloaded expert loses to an available intermediate.

Every rule carries a fallback chain so a primary failure cascades to a backstop
(typically manager or department).
```

**This is the engine behind v1.1 `routeBrand()`.** Brand routing and person routing are the **same algorithm at two scopes** — capability match, conflict exclusion, capacity check, fallback. Once `routeBrand()` picks a sibling brand, the same assigner picks the people within it.

### 2.4 Engine configuration

Tuned to Uganda/Kenya operations:

- Working hours: 08:00–17:00 EAT, Mon–Fri
- SLA hours by priority: critical 4h → low 72h
- Per-person concurrent-task cap (from role's `typicalTaskLoad.maxConcurrent`)
- Overdue-escalation thresholds by priority
- Reminder cadence: 24h / 4h / 1h

**Coupled to v1.1 §5 Tier System:** a Tier 1 brief inherits a longer SLA clock than a Tier 3 quick-turn — `tier_sla_policy.min_lead_days` feeds the engine's clock.

---

## 3. Subsystem B — Event & Task Engine

### 3.1 The event model

A `BusinessEvent` is the atomic unit, named `<module>.<event>` (carries typed payload, source, trigger, metadata `brand + correlationId + causationId` for chain reconstruction, processing block recording status, generated tasks, and retries).

ZeusOS event families: `campaign.*`, `iwo.*`, `creative.*`, `media.*`, `financial.*`, `hr.*`.

| Event category | Example ZeusOS event | Typical generated task |
|---|---|---|
| workflow_transition | `campaign.stage_changed` | Prep next-stage deliverables |
| approval_required | `creative.internal_approval_requested` | Route to next ECD rung |
| deadline_approaching | `iwo.sla_due_soon` | Nudge owner; flag Traffic |
| cost_threshold | `iwo.budget_exceeded` | Block postings; raise change-order task |
| anomaly_detected | `media.flight_underpacing` | Investigate pacing vs plan |
| resource_constraint | `hr.over_allocated` | Rebalance load / escalate to manager |
| quality_gate | `creative.revision_requested` | Return to originator with notes |

### 3.2 Three detection surfaces

1. **Firestore triggers** — a Cloud Function writes a `businessEvents` doc when a watched collection mutates. Mapping is declarative (which collection, which CRUD verbs, which event type), gated by trigger conditions so noisy updates don't all generate work.
2. **Scheduled scans** — cron Cloud Functions sweep state on a clock (deadline monitoring, reconciliations, agent-driven daily runs of §5).
3. **Detection rules** — declarative definitions for derived conditions (anomalies, thresholds) that aren't a raw CRUD trigger.

### 3.3 From event to task

```ts
interface EventDefinition {
  eventType: string;
  tasks: EventTaskRule[];
}

interface EventTaskRule {
  titleTpl: string;            // supports {{payload.field}} interpolation
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dueInDays: number;
  assignTo: AssignmentRule;    // hands off to §2.3
  conditions?: Condition[];
}
```

Generated tasks carry a **bidirectional audit chain** back to the originating event, payload, and parent task.

Task lifecycle:

```
pending_assignment → assigned → in_progress → pending_review
  → completed | cancelled | blocked | escalated
```

Every card in the assignee inbox carries a **source / why-header** keyed to whatever created it — so AI-generated and rule-generated tasks look uniform to the human.

---

## 4. Subsystem C — Agent Network (AI layer)

Agents sit **above** the event/task engine, **not parallel** to it. They read the same data humans read, infer conditions humans would miss, and emit findings as the same `generatedTasks` rows humans get. The human inbox stays a single unified queue.

### 4.1 The agent contract

Every agent is a Firestore document with explicit capability and autonomy envelope:

```ts
interface Agent {
  id: string;                              // 'ZA-001' …
  name: string;
  description: string;
  scope: string;
  sourceModule: string;
  status: 'active' | 'paused' | 'beta';
  model: 'claude-haiku-4-5' | 'claude-sonnet-4-6' | 'claude-opus-4-7';
  fallbackModel: typeof model;
  temperature: number;
  maxOutputTokens: number;
  confidenceFloor: number;                 // 0.0–1.0 — below this, agent stays silent
  autoActMode: 'draft_only' | 'gated' | 'autonomous';
  systemPrompt: string;
  promptVersion: number;
  enabledTools: string[];                  // ids from the tool registry — capability is DATA
  skillDocIds: string[];                   // attached knowledge base
  metrics: AgentMetrics;                   // tasks30d, acceptanceRate, p50/p95 latency, cost, false-positive rate
}
```

**The autonomy spectrum** (`draft_only → gated → autonomous`) crossed with **confidenceFloor** is what makes the system safe-by-default: a freshly created agent can read and draft but cannot mutate canonical data until an admin escalates it.

### 4.2 The tool registry

Capability is an **enumerated registry**, named `<scope>.<noun>`, in four scopes. Adding a tool is a **deliberate code change** (the constant plus a server-side handler), so capability inflation is review-gated.

| Scope | Count (DawinOS) | ZeusOS examples |
|---|---|---|
| `read.*`  | 35+ | `read.master_jobs`, `read.work_orders`, `read.burn`, `read.rate_cards`, `read.approvals`, `read.media_plans`, `read.employees` |
| `write.*` | ~20 | `write.draft_message`, `write.create_task`, `write.create_change_order`, `write.create_alert`, `write.flag_conflict` |
| `search.*` | 6   | `search.cross_module`, `search.knowledge_base`, `search.contacts`, `search.strategy_history` |
| `notify.*` | 4   | `notify.user`, `notify.team`, `notify.subsidiary_lead`, `notify.escalate` |

> **Unify the agent tools with the existing MCP packs.** ZeusOS already runs an MCP server with 11 tool packs (read tools live; `zeusos_create_brief` + `zeusos_advance_master_job_stage` deferred). ZeusOS should treat the MCP packs and the agent tool registry as **ONE registry with two callers** (human-invoked via MCP, agent-invoked via the dispatcher). A tool is defined once and gated the same way regardless of who calls it — avoiding two divergent capability surfaces.

### 4.3 The dispatcher — single chokepoint, immutable audit

Every agent action passes through one dispatcher that enforces **four gates** and always writes an `agentAuditEntries` row — on success, denial, and handler error alike. Mutations to canonical data are blocked at this gate, **not deep in a handler**, so a misconfigured prompt cannot escalate privilege.

```
Agent requests tool
        ↓
Gate 1 — Load agent           (agents/{id}; fallback to seed list)
        ↓
Gate 2 — Paused?              (if paused → refuse + audit denial)
        ↓
Gate 3 — Tool enabled?        (toolId ∈ enabledTools else refuse)
        ↓
Gate 4 — Mode allows mutation?
   draft_only  — only read/search/notify
   gated       — draft, task, alert permitted
   autonomous  — acts above floor, but a human accepts before it commits
        ↓
Route → handler registry      (HANDLERS[toolId]; stub → error outcome)
        ↓
agentAuditEntries/{id}  — trigger · outcome ∈ {accepted, rejected, auto_acted, drafted, errored} · confidence · inputSnapshot · outputSnapshot
```

**Why one chokepoint:**
- Capability is data, not code paths: an agent can only call tools in its `enabledTools[]`; widening it is an admin action, logged.
- The mode gate means a misconfigured prompt cannot escalate privilege — `draft_only` physically cannot reach a mutating handler.
- Declaring a tool in the registry does not make it executable: a missing handler returns failed-precondition and writes an error row.
- Refusals are audited — "what did the agent try and why did it fail" is half the observability story, not a silent drop.
- `notify.escalate` / `notify.subsidiary_lead` are first-class tools, so an agent escalates up the **same** ladder a human would.

### 4.4 The ZeusOS agent roster

The DawinOS roster is re-scoped for an agency. Three agents carry over largely intact (Finance Sentinel, Strategy Agent, Deal Stage Watch). HR is **adapted** to capacity/utilisation. The manufacturing-specific Production Watcher is **replaced** by a Media Performance Scout. Four agency-specific watchers are added.

| Agent | Scope / module | Model | Mode | Owns / Watches |
|---|---|---|---|---|
| **ZA-001 Traffic / Routing Advisor** *(new)* | assignment | sonnet-4.6 | gated | Proposes serving brand (capability + conflict + capacity); flags routing that risks SLA or margin. **Implements v1.1 `routeBrand()`** |
| **ZA-002 Burn & SLA Watcher** *(new)* | assignment / delivery | sonnet-4.6 | gated | IWO burn ≥ 80%/100%, SLA due-date risk by Tier; raises tasks to Traffic + Account Mgmt |
| **ZA-003 ECD Cycle-Time Watcher** *(new)* | delivery (per brand) | haiku-4.5 | draft_only | Approval-ladder stalls, rung sitting too long, rejection-loop hotspots per brand chain |
| **ZA-004 Conflict Sentinel** *(new)* | conflict firewall | sonnet-4.6 | gated | Detects category-exclusivity breaches in routing/staffing **before assignment commits** (closes v1.1 C3) |
| **ZA-005 Finance Sentinel** *(carried)* | billing / intercompany | opus-4.7 | draft_only | AR aging, runway, DSO, margin leakage; CFO briefings — never posts journals |
| **ZA-006 HR & Capacity Compliance** *(adapted)* | hr / hr-central | sonnet-4.6 | gated | NSSF / PAYE, contract & talent-doc renewals, leave +utilisation & over-allocation across brands |
| **ZA-007 Strategy Agent** *(carried)* | group strategy | sonnet-4.6 | gated | Cross-cutting OKR / KPI guardian; escalates money/contract findings to others — strategy primitives only |
| **ZA-008 Deal Stage Watch** *(carried)* | crm | haiku-4.5 | draft_only | Inbound replies, pitch/pricing escalations, stalled opportunities |
| **ZA-009 Media Performance Scout** *(new — replaces Production Watcher)* | media / production | sonnet-4.6 | gated | Flight pacing vs plan, PCR variance, production OTD risk, shoot-day slippage |
| **ZA-010 Market Intel Scout** *(carried)* | market-intelligence | sonnet-4.6 | **paused** | Competitor moves, category RFPs, pitch intelligence — off until data sources wired |

**Defaults:** All agents start safe-by-default and admin-escalated. New agents start in `draft_only`.

### 4.5 Background watchers — the supercharge pattern

The canonical DawinOS example is the Strategy Agent's daily run (06:00 UTC `onSchedule`), which sweeps for stale OKR check-ins, off-track key results, stale KPI measurements, and unresolved critical alerts.

For ZeusOS the equivalent watchers sweep agency state: IWO burn vs budget, SLA due-dates by Tier, approval-ladder stalls, media flight pacing, category-conflict risk.

Each finding writes both an `agentAuditEntries` row and an actionable `generatedTasks` row that flows into the same human inbox. **Tasks are idempotent by `dedupeKey`** — the doc id encodes the condition (e.g. `burn-iwo:{iwoId}:80pct`) so an open finding doesn't double, but a closed-then-recurring condition can re-open the slot.

### 4.6 Assistant chat

The same running context that backs a watcher backs an assistant chat: a user asks "why is the Shell campaign over budget?" and the agent answers grounded in the live work-order, burn, and rate-card reads it already has tool access to, citing entity ids per its prompt contract. **The chat is a read-mostly window onto the same intelligence — not a separate capability.**

---

## 5. How the three subsystems compose

End-to-end loop has **five steps**, and the agent layer bolts on with **five verbs**:

1. **State change** — a Firestore write, scheduled scan, or agent inference produces a `BusinessEvent`.
2. **Event matched** — `EventDefinition.tasks[]` declares which tasks to spawn, gated by conditions.
3. **Task generated** — the assignment rule resolves through the role-profile graph (skills, authorities, workload, escalation).
4. **Task lands in inbox** — a uniform card whose why-header shows what created it.
5. **Act / approve / escalate** — completion emits downstream events, feeding the next inference cycle.

**Five verbs the agent layer adds:**

- **Observe** — reads canonical data via `read.*` in lockstep with humans.
- **Detect** — finds what a static rule wouldn't (stale measures, drift, cross-module anomalies).
- **Act** — within the `autoActMode × confidenceFloor` envelope (draft, task, alert).
- **Audit** — every action AND every refusal to `agentAuditEntries`; fully reconstructible.
- **Personalise** — `aiContext` per role decides what surfaces to whom (RAG, approvals).

Escalation is itself a first-class tool, so an agent escalates up the **same ladder** a human would.

---

## 6. New schema, events, and RBAC touchpoints

### 6.1 New domain events (extend v1.1 §7.2)

| Event | Emitted when | Consumer |
|---|---|---|
| `iwo.burn_threshold_crossed` | Burn watcher sees ≥ 80%/100% of budget | Traffic, Account Mgmt, Burn agent |
| `iwo.sla_due_soon` | SLA clock (Tier-derived) nears expiry | Owner, Traffic |
| `routing.brand_proposed` | Routing agent proposes a serving brand | Traffic (confirm/override) |
| `conflict.exclusivity_risk` | Conflict Sentinel detects category breach | Conflict Sentinel, Account Director |
| `agent.finding_raised` | Any watcher writes a finding | Reporting, Notifications |
| `agent.action_refused` | Dispatcher denies a tool call | Audit, Reporting (false-positive tracking) |

### 6.2 Schema additions (Postgres in PDF; Firestore equivalent)

```
# Human capital
role_profiles/{id}      brandId, jobLevel, departmentId, skills[], taskCapabilities[],
                        approvalAuthorities[], typicalTaskLoad, aiContext

role_assignments/{id}   employeeId → role_profile_id, effectiveFrom/To,
                        overrides (customAuthorities, maxDailyTasks)

# Agents & audit (AI layer)
agents/{id}             status ∈ {active,paused,beta}, model, fallbackModel,
                        confidenceFloor, autoActMode ∈ {draft_only,gated,autonomous},
                        enabledTools[], systemPrompt, promptVersion

agent_audit_entries/{id}  admin-only writable; agentId, trigger,
                          outcome ∈ {accepted,rejected,auto_acted,drafted,errored},
                          confidence, inputSnapshot, outputSnapshot, createdAt
```

### 6.3 RBAC principle: capability is data, in two places

Both halves of this addendum follow the same principle ZeusOS already uses (v1.0 §4.1): **authority is data that is checked, never code that is trusted.**

- For humans: the `taskCapabilities` verb matrix is the grant.
- For agents: `enabledTools[]` is the grant.

Neither can be widened except by an explicit, audited admin action — and for agents, the dispatcher's mode gate means even a granted mutating tool is unreachable in `draft_only`.

---

## 7. How this closes the v1.1 gaps

| v1.1 gap | Closed by | How |
|---|---|---|
| **C2** Brand routing in Assignment | §2.3 assigner + Routing agent (ZA-001) | `routeBrand()` becomes the brand-scope of the role-aware assigner; the agent **proposes**, Traffic **confirms** |
| **C3** Conflict firewall | Conflict Sentinel (ZA-004) + RBAC conflict scope | Agent detects exclusivity risk **pre-assignment**; capability data blocks cross-wall grants |
| **C4** Tier System SLAs | §2.4 engine config coupled to Tier | Tier sets the SLA clock that the Burn/SLA watcher (ZA-002) enforces |
| **C5** ECD ladder as acceptance gate | §2.2 verb matrix + ECD Cycle-Time watcher (ZA-003) | Ladder rungs are `canApprove` capabilities on `creative.internal_approval_requested`; the watcher surfaces stalls |

---

## 8. Recommended build order

Ship as a sequence of small, reviewable PRs — **not** flipping a switch — with read-only watchers (read + draft + task) deliverable well before any autonomous mutation:

1. **Port human-capital model** (role profiles + assigner), re-scoped to 5 sibling brands → becomes the engine behind v1.1 `routeBrand()`. Highest leverage, lowest risk; uses existing `src/modules/hr-central` substrate.
2. **Stand up event/task engine** on agency event families; **unify** the MCP packs with the agent tool registry (one definition, two callers).
3. **Ship the dispatcher + audit table**, then the read-only watchers (Burn/SLA ZA-002, ECD cycle-time ZA-003) in `draft_only` — value with zero mutation risk.
4. **Wire live model selection**; add gated agents (Routing ZA-001, Conflict Sentinel ZA-004, HR Capacity ZA-006) one handler-PR at a time. Each handler is a discrete PR — do not assume tools execute because they're declared.
5. **Resolve v1.1 §9 commercial questions** (legal entities vs trading names, group vs per-brand commercial ownership, transfer pricing policy, category-exclusivity granularity) **before any agent is allowed to touch money or contracts**.

This maps onto plan §17 Phase 6.A through 6.F.
