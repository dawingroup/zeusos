# ZeusOS Addendum v1.1 — Sibling-Brand Reconciliation

**Source:** `ZeusOS_Addendum_v1.1.pdf` (12pp, draft 2026-05-24).
**Companion to:** ZeusOS Tech Spec v1.0 (plan §14).
**Status:** Engineering reference. Supersedes v1.0 §2 architecture; extends §5–§7 and §10.
**Implementation:** plan §17 Phase 6.A–6.B.

---

## 1. The headline correction

v1.0 assumed a **parent + specialized delivery subsidiaries** model. The Zeus Group profile (`ZEUS-GROUP_PROFILE-MASTER_4.pdf`, 106pp) documents **five full-service sibling brands with overlapping capabilities**, one of which (Odd Gorilla) exists specifically to serve competing clients.

Architecture is restated as a **shared commercial core + five sibling brands**, with a **conflict firewall** and two governance tools (Tier System, ECD Approval Ladder) as shared services.

The sibling brands **remain legal entities with their own GL and rate cards**, so the inter-company invoicing machinery from v1.0 §8 carries over unchanged. The only structural shift is that "which entity delivers" is now a **routing decision**, not a fixed module-to-org mapping.

### 1.1 Change register

| # | Change | Affects |
|---|---|---|
| C1 | Re-model from parent+subsidiaries → shared commercial core + sibling brands | v1.0 §2 |
| C2 | Brand routing in the assignment engine (overlapping capabilities) | v1.0 §7 |
| C3 | Conflict firewall for category-competing accounts (Odd Gorilla) | New §6 |
| C4 | Tier System as scoping + SLA input | v1.0 §7, §5 |
| C5 | ECD ladder as internal-acceptance state machine | v1.0 §6 |
| C6 | Co-authored briefs at intake (client helps build the brief) | v1.0 §7.3 |
| C7 | CES (cost estimate sheet) into the pricing pipeline | v1.0 §8 |

---

## 2. The five sibling brands

| Brand | Org ID | Documented role | Capabilities |
|---|---|---|---|
| Zeus The Agency | `zeus-the-agency` | Flagship 360° integrated agency (Uganda) | Creative, BTL, Digital, PR, Media, Production |
| Zeus Digital | `zeus-digital` | Digital-led offshoot; also full service | Content, SEM/SEO, influencer, media buy, innovation |
| Labyrinth | `labyrinth` | Audio & visual content studio | Sound, photography, podcast, film, documentary |
| Odd Gorilla | `odd-gorilla` | Conflict agency for competing accounts | Full 360°, deliberately separate |
| House of Zeus | `house-of-zeus` | Kenya-market expansion | Full 360° (Creative, BTL, Digital, PR, Media, Production) |

Three of five brands claim the full stack — capability alone does **not** determine routing.

---

## 3. Revised architecture (C1)

```
CLIENT LAYER
  ↑↓ (brief co-authored at Campaign Proposal Stage; one MSA, one price, one invoice per client)

SHARED COMMERCIAL CORE (group-level Account Mgmt + Traffic)
  Contracts & SOW  |  Pricing & Rate Card  |  Assignment + Traffic  |  Billing & Revenue  |  Conflict Firewall
                              ↑↓
INTERNAL WORK-ORDER & INTER-COMPANY BUS
  (budget ▼ · time/cost ▲ · i/c invoice ▲ · conflict-scoped)
                              ↓
DELIVERY LAYER — five full-service sibling brands (overlapping capabilities; routed per job)
  ZTA  ·  Zeus Digital  ·  Labyrinth  ·  Odd Gorilla (walled)  ·  House of Zeus

GROUP SHARED SERVICES
  Tier System  |  ECD Approval Ladder  |  Identity & RBAC (brand-scoped + conflict tags)  |  Event Bus + Ledger Sync + Reporting
```

The v1.0 `OrganizationKind = PARENT | SUBSIDIARY` enum is **retained** — it correctly models the legal-entity structure. v1.1 just relabels "specialized subsidiary" → "sibling brand" and adds the routing layer above.

---

## 4. Documented flow → ZeusOS objects (C6, C7)

| Documented stage (profile) | ZeusOS object / control |
|---|---|
| Campaign Proposal Stage | Intake item on Account → Engagement (co-authored brief captured; Tier classified) |
| Client Brief (doc, 24h before verbal) | SOW scope + ceiling + Tier → SLA lead time |
| Verbal Briefing → Strategy Brainstorm | Master Job opened → pricing builds Quote |
| Strategy Presentation → Approval/Reverts | Quote ACCEPTED, SOW ACTIVE (gate) |
| Execution by IMC Teams · 5 channel tracks | Internal Work Orders — one per brand/track (routed by capability+capacity+conflict; budget locked) |
| Internal Review of IMC GTM (ECD ladder) | IWO internal-acceptance state machine (ECD sign-off = ACCEPTED_INTERNALLY gate) |
| Client Presentation → Consolidated Feedback | Deliverable → client approval via Account Mgmt (revisions loop back to in-progress) |
| CES / Production Costs & Timings | Pricing engine: production line items + markup (added to quote / change order; ceiling check) |
| GTM Rollout → Production & Launch | IWOs → DELIVERED; cost actuals posted (burn tracked in locked budget) |
| Reporting & Monitoring | Reporting service: per-job + per-entity metrics (margin, utilisation, burn from event log) |
| Campaign Performance Review | IWOs CLOSED → i/c invoices → ONE client invoice (roll-up & settle; rev-rec to parent) |

**Refinement C6 — Co-authored briefs:** the intake brief field should record authorship/contribution and the 24-hour document-before-verbal rule. Commercial firewall unaffected — pricing and scope commitments still occur only in the core.

**Refinement C7 — CES into pricing:** the cost-estimate-sheet stage maps to a typed input on the pricing engine (production cost lines added to quote/change-order with ceiling check).

---

## 5. Tier System (C4)

| Tier | Scope | Lead time | Briefing mode |
|---|---|---|---|
| Tier 1 | Creative strategy across all channels (ATL, Digital, OOH, BTL, PR, Media) | ≥ 2 weeks; feedback 4–5 days | Meeting + final brief on mail |
| Tier 2 | Tactical/problem briefs on a few channels (digital, BTL, POS, emailers) | ≥ 1 week for proper revert | Call + brief on mail |
| Tier 3 | Small jobs (document layout, customer/staff notices) | ≥ 1–2 days | Call, then email |

### 5.1 Schema (PostgreSQL syntax in PDF; Firestore equivalent)

```ts
type BriefTier = 'TIER_1' | 'TIER_2' | 'TIER_3';

interface Engagement     { default_tier: BriefTier; ... }
interface MasterJob      { tier: BriefTier; ... }
interface InternalWorkOrder {
  tier: BriefTier;
  sla_due_at: Timestamp;  // derived from tier_sla_policy
  ...
}

// Firestore: tier_sla_policy/{tier}
interface TierSlaPolicy {
  tier: BriefTier;           // doc id
  min_lead_days: number;
  feedback_days: number;
  briefing_mode: 'MEETING' | 'CALL' | 'EMAIL';
}
```

### 5.2 Behaviour

- Intake classifies the brief → Tier sets the minimum lead time and briefing mode.
- Assignment engine refuses to promise a delivery date earlier than the Tier minimum **without an explicit override (logged)**.
- Tier flows onto each IWO so the subsidiary brand sees the SLA it must meet; reporting analyzes on-time delivery by Tier.

---

## 6. Conflict firewall (C3)

Odd Gorilla exists so the group can serve **competing clients in the same category** without either client's work or data being visible to the team serving the other. Enforced **structurally**, not by convention.

### 6.1 Model

```ts
// Firestore collections
interface Category {
  id: string;             // ULID
  name: string;           // e.g. 'CARBONATED_BEVERAGE' (unique)
}

interface AccountCategory {
  id: string;             // `${account_id}__${category_id}`
  account_id: string;
  category_id: string;
  exclusive: boolean;     // default true
}

interface ConflictWall {
  id: string;             // ULID
  account_id: string;
  serving_org_id: string; // pins this account to one sibling brand
  category_id: string;
}
```

### 6.2 Enforcement (three layers)

1. **Assignment routing** — engine excludes any brand already serving a category-competing account; refuses to place two walled accounts with the same delivery team.
2. **RBAC conflict scope** — a user assigned to a walled account cannot be granted access to a competing walled account; the grant is rejected, mirroring the commercial-scope CHECK from v1.0 §4.1.
3. **Event bus + reporting** — cross-account roll-ups never join two walled accounts in the same category, even for group-level dashboards (group sees margin, not competing creative).

The conflict requirement **strengthens** v1.0's per-entity data isolation — it is an extension of isolation that already exists, not a new subsystem.

---

## 7. ECD Approval Ladder (C5)

The documented creative-escalation chain becomes the **IWO internal-acceptance state machine** — replacing the generic "acceptance criteria signed by Account Mgmt" step.

```
Designer/Writer → Art Director/Copywriter → Studio Manager/Head of Copy
  → Associate Creative Director → Creative Director → Executive Creative Director

IWO state path:
  IN_PROGRESS → DELIVERED (work submitted) → [ECD ladder runs]
              → ACCEPTED_INTERNALLY (only after ECD approves) → CLOSED
```

### 7.1 Rules

- Per-brand chain: each sibling brand has its own ECD chain; routing assigns the job into one brand's chain.
- A reject at any rung returns work to the originator with structured notes; the rejecting rung is logged for cycle-time analytics.
- **Tier governs depth:** Tier 1 runs the full chain; Tier 3 may collapse to Studio Manager → CD for speed (configurable per brand). This couples `tier` → approval path.
- ECD sign-off emits `InternalApprovalGranted`; only then may the work proceed to client presentation and, on close, raise inter-company invoice.

### 7.2 New domain events (extend Tech Spec v1.0 outbox)

| Event | Emitted when | Consumers |
|---|---|---|
| `ApprovalRungAdvanced` | Work passes a rung up the ECD ladder | Reporting (cycle time), Notifications |
| `ApprovalRungRejected` | A rung sends work back | Delivery workspace, Reporting |
| `InternalApprovalGranted` | ECD approves (top of ladder) | Assignment (unlocks client presentation), I/C Finance |

---

## 8. Brand routing in the assignment engine (C2)

Because capabilities overlap, the assignment engine gains a **routing step before** it issues a work order. Selects the serving brand from candidates that (a) have the required capability, (b) are not conflicted for the account's category, (c) have capacity within the Tier's SLA.

```pseudo
function routeBrand(masterJob, requiredCapability):
  candidates = brands.withCapability(requiredCapability)        # often >1
  candidates = candidates.excludeConflicted(masterJob.account)  # §6 firewall
  candidates = candidates.filter(b ->
                 b.capacityWithin(masterJob.tier.slaDueAt))     # §5 SLA
  if masterJob.account.region == 'KE':
    prefer(candidates, 'HOUSE_OF_ZEUS')                          # geography
  if candidates.isEmpty():
    raise NO_ELIGIBLE_BRAND        # escalate to Traffic for manual routing
  return rank(candidates, by=[capacity, marginFit]).first()
```

**Routing is a recommendation; Traffic decides.** Consistent with "Traffic manages this whole process," the engine **proposes** a brand and budget; a Traffic/PM role confirms or overrides before the work order is issued. The override is logged. This keeps a human accountable for cross-brand allocation while the system enforces the hard constraints (conflict, capability, ceiling).

---

## 9. Open commercial questions (block Phase 6.E mutating agents)

1. Are the five brands **separate legal entities** with their own books (driving real inter-company invoicing), or **trading names** under fewer entities (internal cost allocation)? v1.0 assumed legal entities; billing engine treats this as a per-org flag — answer determines tax treatment.
2. Who holds the **commercial relationship** — a group-level account-management function, or does each brand also sell directly? Shared-core model assumes group-level ownership; if brands sell independently, the firewall and single-invoice rules need a defined precedence.
3. How is **transfer pricing** set between brands (cost, cost-plus, market)? Governed centrally in spec; the policy value is a Zeus decision with tax implications.
4. For the conflict firewall, is **category exclusivity contractually promised** to clients, and at what **granularity** (category, sub-category, named-competitor list)? Sets how strict the routing exclusion must be.

These are documented per addendum §9. The plan §17 Phase 6.E gates mutating agents on resolving these.
