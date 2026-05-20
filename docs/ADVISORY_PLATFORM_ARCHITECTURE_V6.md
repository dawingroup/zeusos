# Dawin Advisory Platform Architecture
## Unified Platform Specification v6.0

**Version:** 6.0  
**Date:** January 2026  
**Author:** Platform Architecture Team  
**Status:** Draft for Review  
**Supersedes:** dawin-advisory-platform-architecture-v5.md

---

## Executive Summary

Version 6.0 introduces a **unified engagement-centric architecture** that fundamentally restructures how Dawin Advisory modules interact. This revision addresses key architectural limitations in v5.0 by:

1. **Engagement-First Design** — All advisory work flows through a unified `Engagement` entity that can encompass programs, deals, or pure advisory mandates
2. **True Funding Agnosticism** — Infrastructure programs work identically whether grant-funded, government-budgeted, or privately invested
3. **Investment Advisory as Core Module** — Full integration of wealth management, portfolio advisory, and client services
4. **Unified AI Orchestration** — Single Gemini agent serves all modules with domain-aware context switching
5. **Cross-Module Entity Linking** — Clean relationships between delivery projects, investment deals, and portfolio holdings

### Key Architectural Changes from v5.0

| Aspect | v5.0 | v6.0 |
|--------|------|------|
| Primary Entity | Program (funding-typed) | Engagement (purpose-typed) |
| Module Coupling | Loose, via shared types | Unified via Engagement layer |
| Investment vs Delivery | Separate programs | Linked entities on single engagement |
| Advisory Services | Standalone module | Integrated client-centric hub |
| AI Context | Per-module flows | Unified agent with module awareness |

---

## Table of Contents

1. [Unified Architecture Overview](#1-unified-architecture-overview)
2. [Engagement-Centric Data Model](#2-engagement-centric-data-model)
3. [Advisory Domains](#3-advisory-domains)
4. [Infrastructure Delivery Module](#4-infrastructure-delivery-module)
5. [Infrastructure Investment Module](#5-infrastructure-investment-module)
6. [Investment Advisory Services Module](#6-investment-advisory-services-module)
7. [MatFlow Shared Service](#7-matflow-shared-service)
8. [Unified AI Agent Architecture](#8-unified-ai-agent-architecture)
9. [Cross-Module Integration Patterns](#9-cross-module-integration-patterns)
10. [Security & Multi-Tenancy](#10-security--multi-tenancy)
11. [Implementation Guide](#11-implementation-guide)
12. [Migration from v5.0](#12-migration-from-v50)

---

## 1. Unified Architecture Overview

### 1.1 Platform Philosophy

The v6.0 architecture centers on a fundamental insight: **all advisory work is an engagement with a client toward a goal**. Whether delivering infrastructure, investing capital, or advising on portfolios, the work follows common patterns:

- A **client** engages Dawin Advisory
- For a specific **mandate** (build, invest, advise)
- With defined **scope** and **terms**
- Generating **work products** and **outcomes**
- Tracked through **workflows** and **approvals**

### 1.2 Directory Structure

```
src/
├── core/                                   # DawinOS Core Services
│   ├── auth/
│   ├── components/
│   ├── hooks/
│   └── utils/
│
├── subsidiaries/
│   └── advisory/                           # 📊 Dawin Advisory
│       │
│       ├── core/                           # ADVISORY CORE (NEW)
│       │   ├── ai/                         # Unified AI Agent
│       │   │   ├── agent.ts                # Gemini agent orchestrator
│       │   │   ├── flows/                  # Domain-aware flows
│       │   │   │   ├── document.flows.ts
│       │   │   │   ├── financial.flows.ts
│       │   │   │   ├── risk.flows.ts
│       │   │   │   └── workflow.flows.ts
│       │   │   ├── prompts/
│       │   │   └── context/                # Module context builders
│       │   │
│       │   ├── types/                      # Core type definitions
│       │   │   ├── engagement.ts           # Unified Engagement
│       │   │   ├── client.ts               # Client types
│       │   │   ├── stakeholder.ts
│       │   │   ├── funding.ts              # Funding abstraction
│       │   │   ├── approval.ts             # Approval workflows
│       │   │   └── money.ts                # Currency handling
│       │   │
│       │   ├── services/                   # Core services
│       │   │   ├── engagement-service.ts
│       │   │   ├── client-service.ts
│       │   │   ├── approval-engine.ts
│       │   │   ├── notification-service.ts
│       │   │   ├── document-service.ts
│       │   │   └── audit-service.ts
│       │   │
│       │   ├── components/                 # Shared UI components
│       │   │   ├── EngagementCard/
│       │   │   ├── ClientSelector/
│       │   │   ├── ApprovalQueue/
│       │   │   ├── FundingSourceBadge/
│       │   │   ├── AIAssistant/
│       │   │   └── UnifiedDashboard/
│       │   │
│       │   └── hooks/
│       │       ├── useEngagement.ts
│       │       ├── useClient.ts
│       │       ├── useApproval.ts
│       │       └── useAdvisoryAI.ts
│       │
│       ├── delivery/                       # INFRASTRUCTURE DELIVERY (Renamed)
│       │   ├── types/
│       │   │   ├── program.ts
│       │   │   ├── project.ts
│       │   │   └── payment.ts
│       │   ├── components/
│       │   ├── pages/
│       │   ├── services/
│       │   └── hooks/
│       │
│       ├── investment/                     # INFRASTRUCTURE INVESTMENT
│       │   ├── types/
│       │   │   ├── deal.ts
│       │   │   ├── asset.ts
│       │   │   └── model.ts
│       │   ├── components/
│       │   ├── pages/
│       │   ├── services/
│       │   └── hooks/
│       │
│       ├── advisory/                       # INVESTMENT ADVISORY SERVICES
│       │   ├── types/
│       │   │   ├── advisory-client.ts
│       │   │   ├── portfolio.ts
│       │   │   ├── research.ts
│       │   │   └── planning.ts
│       │   ├── components/
│       │   ├── pages/
│       │   ├── services/
│       │   └── hooks/
│       │
│       ├── matflow/                        # MATFLOW (SHARED SERVICE)
│       │   ├── types/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── services/
│       │   └── hooks/
│       │
│       ├── routes.tsx
│       └── index.ts
```

---

## 2. Engagement-Centric Data Model

### 2.1 Core Principle

The `Engagement` is the foundational entity that unifies all advisory work. Every program, deal, or advisory mandate is an engagement with a client.

### 2.2 Engagement Entity Relationships

```
CLIENT (1) ────────> (N) ENGAGEMENT
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
     PROGRAM            DEAL           PORTFOLIO
   (Delivery)       (Investment)      (Advisory)
         │                 │
         ▼                 │
     PROJECT ◄─────────────┘
         │            (linkedDealId)
         ▼
     MATFLOW
```

### 2.3 Key Types

- **Engagement** - Root entity for all advisory work
- **Client** - Organization or individual engaging Dawin
- **FundingSource** - Funding-agnostic abstraction (grant, debt, equity, etc.)
- **Program** - Delivery-focused container for projects
- **Deal** - Investment-focused pipeline entity
- **Portfolio** - Advisory-focused client holdings
- **MatFlowProject** - Material management for any construction

---

## 3. Module Overview

### 3.1 Infrastructure Delivery Module
- Programs (donor/government/corporate/PPP/blended)
- Projects (contractor or direct implementation)
- Payment workflows (IPCs, requisitions, milestones)

### 3.2 Infrastructure Investment Module
- Deal pipeline (sourcing → closing → monitoring)
- Assets under management (greenfield/brownfield/operating)
- Financial models (IRR/MOIC, sensitivity, scenarios)

### 3.3 Investment Advisory Services Module
- Client portfolios (holdings, allocation, performance)
- Research & insights (market outlook, sector analysis)
- Wealth planning (goals, tax, succession, estate)

### 3.4 MatFlow Shared Service
- BOQ management
- Formula engine
- Procurement tracking
- Variance analysis
- AI optimizer

---

## 4. Implementation Phases

### Phase 1: Core Foundation (Weeks 1-4)
- Engagement type definitions and Firestore schema
- Client model with full profile support
- Funding source abstraction types
- Engagement CRUD service
- Client management service
- Base approval engine

### Phase 2: Delivery Module (Weeks 5-10)
- Program model (funding-agnostic)
- Project wizard with configuration
- Payment request abstraction
- Progress tracking system

### Phase 3: Investment Module (Weeks 11-16)
- Deal model and pipeline stages
- Due diligence tracking
- Investment structure configuration
- Deal-Project linking service

### Phase 4: Advisory Module (Weeks 17-22)
- Advisory client model
- Portfolio model
- Performance calculation service
- Infrastructure-portfolio integration

### Phase 5: AI & MatFlow (Weeks 23-28)
- Unified AI agent setup
- Document parsing flows
- Portfolio optimization AI
- MatFlow multi-source integration

---

## 5. Security & Access Control

### 5.1 Advisory Roles
- **Platform**: platform_admin, platform_viewer
- **Engagement**: engagement_lead, engagement_member, engagement_viewer
- **Delivery**: program_manager, project_manager, site_manager, quantity_surveyor, finance_officer
- **Investment**: deal_lead, investment_analyst, portfolio_manager_investment
- **Advisory**: relationship_manager, portfolio_manager_advisory, research_analyst, wealth_planner
- **MatFlow**: matflow_admin, matflow_user
- **External**: client_user, funder_user, contractor_user

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 6.0 | Jan 2026 | Platform Team | Engagement-centric architecture, true funding agnosticism, investment advisory integration |

---

*Full specification with type definitions available on request.*
