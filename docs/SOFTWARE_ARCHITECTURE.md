# DawinOS — Software Architecture Document

**Version:** 2.0
**Date:** March 9, 2026
**Platform:** DawinOS — Enterprise Manufacturing & Operations SaaS
**Classification:** Internal — Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Overview](#2-system-overview)
3. [Technology Stack](#3-technology-stack)
4. [High-Level Architecture](#4-high-level-architecture)
5. [Frontend Architecture](#5-frontend-architecture)
6. [Module System](#6-module-system)
7. [Subsidiary Architecture](#7-subsidiary-architecture)
8. [State Management](#8-state-management)
9. [Routing & Navigation](#9-routing--navigation)
10. [Backend Architecture (Cloud Functions)](#10-backend-architecture-cloud-functions)
11. [Data Architecture (Firestore)](#11-data-architecture-firestore)
12. [AI & Machine Learning Services](#12-ai--machine-learning-services)
13. [Optimization Engine](#13-optimization-engine)
14. [External Integrations](#14-external-integrations)
15. [Security Architecture](#15-security-architecture)
16. [Authentication & Authorization](#16-authentication--authorization)
17. [Real-Time & Event-Driven Architecture](#17-real-time--event-driven-architecture)
18. [Offline & PWA Support](#18-offline--pwa-support)
19. [Testing Architecture](#19-testing-architecture)
20. [Build, Deployment & Infrastructure](#20-build-deployment--infrastructure)
21. [Cross-Cutting Concerns](#21-cross-cutting-concerns)
22. [Appendices](#appendices)

---

## 1. Executive Summary

DawinOS is an enterprise-grade, multi-tenant SaaS platform purpose-built for manufacturing, millwork, and construction consulting operations. The platform consolidates 27+ feature modules across 4 business subsidiaries into a unified application, providing end-to-end operational management spanning design, procurement, manufacturing, finance, HR, CRM, marketing, and strategic planning.

### Key Architectural Characteristics

| Characteristic | Approach |
|---------------|----------|
| **Architecture Style** | Modular monolith with service layer separation |
| **Multi-Tenancy** | Organization + Subsidiary scoping via Firestore document paths |
| **Frontend** | React 18 SPA with lazy-loaded feature modules |
| **Backend** | Firebase Cloud Functions (187 serverless functions) |
| **Database** | Cloud Firestore (NoSQL, offline-first) |
| **AI Strategy** | Dual-model (Google Gemini + Anthropic Claude) with persistent memory |
| **Real-Time** | Firestore listeners + Cloud Function triggers |
| **Offline** | IndexedDB persistent cache via Firestore SDK |

---

## 2. System Overview

### 2.1 Business Context

DawinOS serves the **Dawin Group**, a conglomerate operating across four subsidiaries:

| Subsidiary | Domain | Status |
|-----------|--------|--------|
| **Dawin Finishes** | Custom millwork, furniture manufacturing | Active |
| **Dawin Advisory** | NGO/development construction consulting | Active |
| **Dawin Capital** | Venture capital & fund management | Coming Soon |
| **Dawin Technology** | Software development & technology services | Coming Soon |

### 2.2 System Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                        DawinOS Platform                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              React SPA (Vite + TypeScript)            │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Design  │ │ Finance │ │ Mfg/Proc │ │  CRM/HR  │  │   │
│  │  │ Manager │ │  Module │ │  Module  │ │  Modules │  │   │
│  │  └────┬────┘ └────┬────┘ └────┬─────┘ └────┬─────┘  │   │
│  │       └───────────┼──────────┼──────────────┘        │   │
│  │              ┌────┴──────────┴────┐                   │   │
│  │              │   Core Services    │                   │   │
│  │              │ (Firebase SDK,     │                   │   │
│  │              │  State Mgmt,       │                   │   │
│  │              │  Shared Utils)     │                   │   │
│  │              └─────────┬─────────┘                   │   │
│  └────────────────────────┼─────────────────────────────┘   │
│                           │ HTTPS / WebSocket                │
│  ┌────────────────────────┼─────────────────────────────┐   │
│  │         Firebase Platform (Google Cloud)               │   │
│  │  ┌─────────┐ ┌────────┴──┐ ┌──────────┐ ┌────────┐  │   │
│  │  │Firestore│ │  Cloud    │ │  Cloud   │ │  Auth  │  │   │
│  │  │(NoSQL)  │ │ Functions │ │ Storage  │ │(OAuth) │  │   │
│  │  └─────────┘ └───────────┘ └──────────┘ └────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┼─────────────────────────────┐   │
│  │            External Services                           │   │
│  │  Shopify · QuickBooks · WhatsApp · Google Chat        │   │
│  │  Adobe PDF · Google Vision · Gemini · Claude          │   │
│  │  Google Drive · Notion · BigQuery                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | React | 18.2.0 |
| **Language** | TypeScript | 5.9.3 (strict mode) |
| **Build Tool** | Vite | 4.4.5 |
| **Routing** | React Router DOM | 6.30.2 |
| **UI Framework** | Material-UI (MUI) | 7.3.7 |
| **Component Library** | Radix UI | Latest |
| **Styling** | TailwindCSS + Emotion | 3.3.3 |
| **Forms** | React Hook Form + Zod | 7.69.0 / 4.3.4 |
| **State Management** | Zustand | 5.0.9 |
| **Async State** | TanStack React Query | 5.90.16 |
| **Charts** | Recharts | 3.6.0 |
| **Canvas** | Konva.js | 9.3.6 |
| **PDF** | @react-pdf/renderer + jsPDF | 4.3.2 / 3.0.4 |
| **Icons** | Lucide React | 0.263.1 |

### 3.2 Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 20 |
| **Functions** | Firebase Cloud Functions (Gen 2) | 4.9.0 |
| **Database** | Cloud Firestore | 10.14.1 |
| **Auth** | Firebase Authentication | 10.14.1 |
| **Storage** | Firebase Cloud Storage | 10.14.1 |
| **Admin SDK** | firebase-admin | 13.6.0 |
| **AI (Google)** | @google/generative-ai (Gemini) | 0.24.1 |
| **AI (Anthropic)** | @anthropic-ai/sdk (Claude) | 0.71.2 |
| **Vision** | Google Cloud Vision API | Latest |
| **Analytics** | Google BigQuery | Latest |

### 3.3 Testing

| Layer | Technology | Version |
|-------|-----------|---------|
| **Unit/Integration** | Vitest | 1.6.0 |
| **Component Testing** | @testing-library/react | Latest |
| **E2E** | Playwright | 1.40.0 |
| **API Mocking** | MSW (Mock Service Worker) | Latest |
| **Coverage** | @vitest/coverage-v8 | Latest |
| **Test Data** | Faker.js | Latest |

### 3.4 DevOps

| Layer | Technology |
|-------|-----------|
| **Hosting** | Firebase Hosting (CDN) |
| **CI/CD** | Firebase Deploy + Preview Channels |
| **Secrets** | Firebase Secret Manager |
| **Emulators** | Firebase Local Emulator Suite |
| **Linting** | ESLint 9 + TypeScript ESLint |

---

## 4. High-Level Architecture

### 4.1 Architectural Style: Modular Monolith

DawinOS follows a **modular monolith** pattern — a single deployable unit composed of loosely coupled, independently maintainable feature modules. This approach balances development velocity (single codebase, shared types, unified deployment) with organizational clarity (clear module boundaries, explicit integration points).

```
┌──────────────────────────────────────────────────────────────┐
│                    Application Shell (App.tsx)                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                   Router + Guards                       │  │
│  │  ┌──────────────────────────────────────────────────┐  │  │
│  │  │              Module Layer (27 modules)            │  │  │
│  │  │                                                   │  │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │  │  │
│  │  │  │  Design   │  │ Finance  │  │ Manufacturing │   │  │  │
│  │  │  │  Manager  │  │  Module  │  │    Module     │   │  │  │
│  │  │  ├──────────┤  ├──────────┤  ├──────────────┤   │  │  │
│  │  │  │pages     │  │pages     │  │pages         │   │  │  │
│  │  │  │components│  │components│  │components    │   │  │  │
│  │  │  │services  │  │services  │  │services      │   │  │  │
│  │  │  │hooks     │  │hooks     │  │hooks         │   │  │  │
│  │  │  │types     │  │types     │  │types         │   │  │  │
│  │  │  └──────────┘  └──────────┘  └──────────────┘   │  │  │
│  │  │        ↕              ↕              ↕           │  │  │
│  │  │  ┌──────────────────────────────────────────┐   │  │  │
│  │  │  │       Integration Layer                   │   │  │  │
│  │  │  │  (CrossModuleService, GlobalContext,       │   │  │  │
│  │  │  │   MODULE_RELATIONSHIPS, entity links)      │   │  │  │
│  │  │  └──────────────────────────────────────────┘   │  │  │
│  │  └──────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │               Core & Shared Layer                       │  │
│  │  Firebase SDK · Zustand · React Query · Shared UI       │  │
│  │  Optimization · PDF · AI Memory · Notifications         │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Layer Responsibilities

| Layer | Responsibility |
|-------|---------------|
| **Application Shell** | Auth context, theme, global providers, error boundaries |
| **Router + Guards** | Route definitions, lazy loading, auth/role/module guards |
| **Module Layer** | Feature-specific UI, business logic, data access |
| **Integration Layer** | Cross-module communication, entity linking, data flow definitions |
| **Core/Shared Layer** | Firebase services, state stores, shared components, utilities |

### 4.3 Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Modular monolith over microservices | Single team, rapid iteration, shared types, simpler deployment |
| Firestore over SQL | Real-time sync, offline-first, flexible schemas, serverless scaling |
| Cloud Functions over Express server | Pay-per-invocation, zero ops, auto-scaling, Firebase integration |
| Dual AI models (Gemini + Claude) | Cost optimization (Gemini for speed) + quality (Claude for reasoning) |
| Zustand over Redux | Lightweight, no boilerplate, TypeScript-native |
| MUI + Radix over custom UI | Enterprise component coverage, accessibility, theming |

---

## 5. Frontend Architecture

### 5.1 Directory Structure

```
src/
├── app/                          # Application shell & entry
│   ├── App.tsx                   # Root component (providers, router)
│   ├── pages/                    # Top-level pages
│   └── index.ts
├── router/                       # Routing configuration
│   ├── index.tsx                 # Route tree definitions
│   └── guards/                   # AuthGuard, RoleGuard, ModuleGuard
├── modules/                      # Feature modules (27 total)
│   ├── design-manager/           # Design & cutting optimization
│   ├── finance/                  # Accounting, budgets, forecasting
│   ├── manufacturing/            # Production & shop floor
│   ├── procurement/              # Purchase orders & buying
│   ├── crm/                      # Sales & customer relationships
│   ├── hr-central/               # HR, payroll, performance
│   ├── intelligence-layer/       # AI task generation
│   ├── capital/                  # Capital seeking & readiness
│   ├── strategy/                 # OKRs, KPIs, strategic planning
│   ├── marketing/                # Campaigns & content
│   ├── whatsapp/                 # WhatsApp commerce
│   ├── inventory/                # Stock management
│   ├── customer-hub/             # Customer management
│   ├── suppliers/                # Vendor management
│   ├── assets/                   # Asset registry & tracking
│   ├── launch-pipeline/          # Product launch workflow
│   ├── intelligence/             # Market intelligence
│   ├── compliance/               # Regulatory tracking
│   ├── gchat/                    # Google Chat integration
│   ├── messaging/                # Unified inbox
│   └── ...                       # Additional modules
├── subsidiaries/                 # Business unit variations
│   ├── advisory/                 # NGO/development consulting
│   ├── finishes/                 # Dawin Finishes (manufacturing)
│   ├── capital/                  # Investment services
│   └── technology/               # Technology services
├── core/                         # Platform infrastructure
│   ├── services/                 # Firebase, notifications, search
│   ├── components/               # Core UI (navigation, layout)
│   ├── settings/                 # User & org settings
│   └── hooks/                    # Core hooks
├── shared/                       # Shared utilities & components
│   ├── components/               # Reusable UI components
│   ├── services/                 # Business services (AI, PDF, optimization)
│   ├── stores/                   # Zustand stores
│   ├── hooks/                    # Shared hooks
│   ├── types/                    # Shared TypeScript types
│   └── utils/                    # Helpers & formatters
├── integration/                  # Cross-module integration layer
│   ├── store/                    # GlobalContext provider
│   ├── types/                    # Integration types
│   └── constants/                # Module definitions & relationships
├── contexts/                     # React Context providers
├── config/                       # Navigation & configuration
├── pages/                        # Top-level page routes
├── ai/                           # AI extension services
├── testing/                      # Test utilities & setup
└── main.jsx                      # Application entry point
```

### 5.2 Module Internal Structure

Every module follows a consistent directory convention:

```
src/modules/{module-name}/
├── components/              # React components (presentational + containers)
│   ├── dashboard/           # Module dashboard widgets
│   ├── shared/              # Module-scoped shared components
│   └── {feature}/           # Feature-specific components
├── pages/                   # Route-level page components
│   ├── index.ts             # Page exports
│   └── {Feature}Page.tsx    # Individual pages
├── services/                # Business logic & Firestore access
│   └── {feature}Service.ts  # Service files
├── hooks/                   # Custom React hooks
│   └── use{Feature}.ts      # Hook files
├── types/                   # TypeScript interfaces & types
│   └── index.ts             # Type exports
├── constants/               # Module constants & enums
├── schemas/                 # Zod validation schemas
├── utils/                   # Module-specific utilities
├── context/                 # Module-level React context (if needed)
├── index.ts                 # Public module API
└── {Module}Module.tsx       # Module wrapper/provider (if needed)
```

### 5.3 Component Architecture

Components follow a **presentational/container** split:

```
┌─────────────────────────────┐
│         Page Component       │  ← Route target, data orchestration
│  ┌───────────────────────┐  │
│  │   Container Component  │  │  ← Business logic, hooks, service calls
│  │  ┌─────────────────┐  │  │
│  │  │  Presentational  │  │  │  ← Pure UI, props-driven
│  │  │    Component     │  │  │
│  │  └─────────────────┘  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

**UI Component Hierarchy:**
- **MUI components** — Primary design system (buttons, dialogs, tables, forms)
- **Radix UI primitives** — Accessible building blocks (select, tabs, tooltip)
- **ShadCN-style components** — `src/shared/components/ui/` (customized Radix wrappers)
- **Module components** — Feature-specific, composed from shared primitives

---

## 6. Module System

### 6.1 Module Registry

The platform defines modules through a central registry in `src/integration/constants/modules.constants.ts`:

```typescript
interface ModuleDefinition {
  id: ModuleId;
  name: string;
  shortName: string;
  description: string;
  icon: ComponentType;
  color: string;
  basePath: string;
  permissions: ModulePermission[];
  features: string[];
  order: number;
}
```

### 6.2 Complete Module Inventory

| # | Module | Path | Domain | Key Features |
|---|--------|------|--------|-------------|
| 1 | Design Manager | `/design` | Design | Projects, materials, strategy canvas, cutlists, client portal |
| 2 | Finance | `/finance` | Operations | Budgets, accounts, QBO sync, KPIs, cash flow, tax compliance |
| 3 | Manufacturing | `/manufacturing` | Production | Production orders, shop floor, goods receipt, inventory integration |
| 4 | Procurement | `/procurement` | Supply Chain | Purchase orders, RFQs, supplier management, consolidation |
| 5 | CRM | `/crm` | Sales | Deal pipeline, activities, projects, sales tasks |
| 6 | HR Central | `/hr` | People | Employees, payroll, leave, org structure, contracts |
| 7 | Intelligence Layer | `/intelligence-layer` | AI | Task generation, employee inbox, manager dashboard |
| 8 | Capital Hub | `/capital` | Finance | Capital seeking, readiness assessment, applications, facilities |
| 9 | Strategy | `/strategy` | Executive | OKRs, KPIs, executive dashboard, performance overview |
| 10 | Marketing | `/marketing` | Growth | Campaigns, content, templates, analytics, key dates |
| 11 | WhatsApp | `/whatsapp` | Messaging | WhatsApp commerce, broadcasting, templates, CRM integration |
| 12 | Inventory | `/inventory` | Supply Chain | Stock levels, variants, supplier pricing, consumables |
| 13 | Customer Hub | `/customers` | Sales | Customer database, details, forms |
| 14 | Suppliers | `/suppliers` | Supply Chain | Vendor database, performance, pricing |
| 15 | Assets | `/assets` | Operations | Asset registry, maintenance, depreciation, checkout |
| 16 | Launch Pipeline | `/launch-pipeline` | Product | Launch workflow, naming wizard, deliverables |
| 17 | Intelligence | `/intelligence` | Market | Competitor analysis, social monitoring, market scanning |
| 18 | Compliance | `/compliance` | Governance | Regulatory docs, obligations, audit trails |
| 19 | GChat | `/gchat` | Messaging | Google Chat integration, unified messaging |
| 20 | Messaging | `/messaging` | Communication | Unified inbox across channels |
| 21 | Market Intelligence | `/market-intelligence` | Research | Environment scanning, competitive intelligence |
| 22 | Performance | `/performance` | People | Reviews, competencies, development plans, training |
| 23 | Feature Library | `/features` | Design | Reusable design features & components |
| 24 | Cutlist Processor | `/cutlist` | Production | Cutting optimization (legacy) |

### 6.3 Cross-Module Integration

Modules communicate through explicitly defined relationships:

```
┌─────────────┐     employee_count      ┌──────────────┐
│  HR Central  │ ─────────────────────► │  CEO Strategy │
│              │     department_data     │              │
└──────┬───────┘ ◄───────────────────── └──────┬───────┘
       │                                        │
       │ employee_profiles                      │ okrs, kpis
       ▼                                        ▼
┌──────────────┐                        ┌──────────────┐
│    Staff     │ ◄───────────────────── │   Finance    │
│ Performance  │     performance_data    │   Module     │
└──────────────┘                        └──────┬───────┘
                                               │
                                               │ funding_data
                                               ▼
                                        ┌──────────────┐
                                        │  Capital Hub │
                                        └──────────────┘
```

**Cross-Module Service** (`src/core/services/crossModuleService.ts`):

| Method | Purpose |
|--------|---------|
| `createCrossModuleReference()` | Link entities across modules |
| `getCrossModuleReferences()` | Find related entities |
| `getCrossModuleMetrics()` | Aggregate module KPIs |
| `logActivity()` | Activity audit trail |
| `subscribeToActivity()` | Real-time activity feed |
| `validateCrossModuleConsistency()` | Data integrity checks |

**Cross-Module Entities:**

```typescript
CROSS_MODULE_ENTITIES = {
  EMPLOYEE:    { primary: 'hr_central',         linked: ['staff_performance', 'finance'] },
  DEPARTMENT:  { primary: 'hr_central',         linked: ['finance', 'ceo_strategy'] },
  OKR:         { primary: 'ceo_strategy',       linked: ['staff_performance'] },
  BUDGET:      { primary: 'finance',            linked: ['hr_central', 'capital_hub'] },
  INVESTOR:    { primary: 'capital_hub',        linked: ['finance'] },
  COMPETITOR:  { primary: 'market_intelligence', linked: ['ceo_strategy'] },
}
```

---

## 7. Subsidiary Architecture

### 7.1 Multi-Subsidiary Model

DawinOS supports multiple business units (subsidiaries) within a single organization, each with distinct workflows, branding, and module access:

```
┌──────────────────────────────────────────────────────────────┐
│                    Organization (Dawin Group)                  │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │    Finishes   │  │   Advisory   │  │ Corporate Modules  │ │
│  │  (Subsidiary) │  │ (Subsidiary) │  │   (Cross-cutting)  │ │
│  ├──────────────┤  ├──────────────┤  ├────────────────────┤ │
│  │Design Manager│  │  Delivery    │  │ Strategy           │ │
│  │Clipper       │  │  MatFlow     │  │ HR Central         │ │
│  │Manufacturing │  │  Investment  │  │ Finance            │ │
│  │CRM           │  │  AI Agents   │  │ Capital Hub        │ │
│  │Marketing     │  │  BOQ Mgmt   │  │ Compliance         │ │
│  │Launch        │  │  Procurement │  │ Market Intelligence│ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Subsidiary Types

```typescript
interface Subsidiary {
  id: string;                    // 'dawin-finishes' | 'dawin-advisory'
  name: string;
  shortName: string;
  color: string;
  modules: SubsidiaryModule[];
  status: 'active' | 'inactive' | 'coming-soon';
}
```

### 7.3 Advisory Subsidiary (Construction Consulting)

```
src/subsidiaries/advisory/
├── delivery/                    # Project delivery & requisitions
│   ├── components/              # Requisition forms, accountability
│   ├── core/services/           # Enhanced requisition, BOQ control
│   ├── hooks/                   # Program, project, accountability hooks
│   ├── pages/                   # Country director dashboard, projects
│   ├── reports/                 # Report generation
│   ├── services/                # Payment, program, fund location
│   └── types/                   # Program, requisition, payment types
├── matflow/                     # Material flow & BOQ management
│   ├── ai/                      # BOQ cleanup, confidence scoring
│   ├── components/              # BOQ tables, procurement forms
│   ├── services/                # Manufacturing, procurement, PO
│   └── types/                   # Core BOQ, requisition types
├── ai/                          # Domain-specific AI agents
│   ├── components/              # AI chat, action cards
│   ├── services/                # Gemini agent, tool executor
│   └── hooks/                   # useAIAgent
├── core/                        # Core domain logic
│   ├── boq-parsing/             # BOQ document parsing
│   ├── project/                 # Project service & types
│   └── services/approval/       # Approval engine
├── cross-module/                # Cross-module integrations
│   └── services/                # Entity linker, unified search
└── shared/                      # Advisory-specific shared code
```

### 7.4 Finishes Subsidiary (Manufacturing)

```
src/subsidiaries/finishes/
├── design-manager/              # Design-specific features
│   ├── components/              # Architectural drawings, items
│   ├── services/                # AI, estimates, materials
│   ├── hooks/                   # AI context
│   └── types/                   # Finishes-specific types
├── clipper/                     # Cutting optimizer
│   ├── components/              # Manual upload dialog
│   ├── hooks/                   # Upload hooks
│   └── types/                   # Clipper types
├── cutlist/                     # Cutlist processing
├── launch-pipeline/             # Product launches
└── assets/                      # Asset management
```

---

## 8. State Management

### 8.1 Multi-Layer State Architecture

DawinOS employs a layered state management strategy, choosing the right tool for each state category:

```
┌────────────────────────────────────────────────────┐
│  Layer 1: Global Context (React Context + Reducer) │
│  Auth, current module, organization, subsidiary,   │
│  user profile, preferences, notifications          │
├────────────────────────────────────────────────────┤
│  Layer 2: Zustand Stores (Lightweight Atoms)       │
│  syncStore, navigationStore, uiStore               │
├────────────────────────────────────────────────────┤
│  Layer 3: TanStack React Query (Server State)      │
│  API data, Firestore queries, pagination,          │
│  optimistic updates, background refetch            │
├────────────────────────────────────────────────────┤
│  Layer 4: Component Context (Scoped Providers)     │
│  AuthContext, SubsidiaryContext, ConfigContext,     │
│  OffcutContext, WorkInstanceContext                 │
├────────────────────────────────────────────────────┤
│  Layer 5: Local State (useState / useReducer)      │
│  Form inputs, UI toggles, modal states             │
└────────────────────────────────────────────────────┘
```

### 8.2 GlobalState Structure

```typescript
interface GlobalState {
  auth: AuthState;                // Firebase auth + loading/error
  currentModule: ModuleId;        // Active module context
  currentOrganizationId: string;  // Tenant scope
  currentSubsidiaryId: string;    // Subsidiary scope
  user: UserState;                // DawinUser profile
  preferences: UserPreferences;   // User settings
  sidebar: SidebarState;          // UI sidebar state
  search: SearchState;            // Global search state
  notifications: NotificationState;
  moduleData: ModuleDataState;    // Per-module data cache
  isOnline: boolean;              // Connectivity status
  lastSync: Date;                 // Sync tracking
}
```

### 8.3 State Access Hooks

| Hook | Purpose |
|------|---------|
| `useGlobalState()` | Root context access |
| `useAuth()` | Authentication + permission checks |
| `useCurrentModule()` | Active module switching |
| `useSidebar()` | Sidebar state + pin toggle |
| `useSearch()` | Global search interface |
| `useNotifications()` | Notification management |
| `usePreferences()` | User settings |
| `useUserModules()` | Module access resolution |

### 8.4 React Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5-minute stale time
      retry: 1,                    // Single retry on failure
    },
  },
});
```

---

## 9. Routing & Navigation

### 9.1 Route Architecture

The application uses **React Router v6** with lazy-loaded routes and multi-level guards:

```typescript
<BrowserRouter>
  <Suspense fallback={<FullPageLoader />}>
    <Routes>
      {/* Public Routes */}
      <Route path="/auth/*" element={<AuthPages />} />
      <Route path="/client-portal/:token" element={<ClientPortal />} />

      {/* Protected Routes */}
      <Route element={<AuthGuard />}>
        <Route path="/" element={<UnifiedDashboard />} />

        {/* Module Routes (lazy-loaded) */}
        <Route element={<ModuleGuard module="design-manager" />}>
          <Route path="/design/*" element={<DesignManagerRoutes />} />
        </Route>

        <Route element={<ModuleGuard module="finance" />}>
          <Route path="/finance/*" element={<FinanceRoutes />} />
        </Route>

        {/* ... 20+ more module route groups ... */}

        {/* Admin Routes */}
        <Route element={<RoleGuard roles={['owner', 'admin']} />}>
          <Route path="/admin/*" element={<AdminRoutes />} />
        </Route>
      </Route>
    </Routes>
  </Suspense>
</BrowserRouter>
```

### 9.2 Route Guards

| Guard | Purpose | Behavior on Failure |
|-------|---------|-------------------|
| **AuthGuard** | Requires authenticated user | Redirect to `/auth/login` |
| **RoleGuard** | Requires specific global role | Show 403 or redirect |
| **ModuleGuard** | Requires module access | Hide route, show upgrade prompt |

### 9.3 Lazy Loading Strategy

Routes use a custom `lazyWithRetry` wrapper that handles chunk loading failures gracefully:

```typescript
const DesignManagerRoutes = lazyWithRetry(
  () => import('../modules/design-manager/pages'),
  { retries: 3, delay: 1000 }
);
```

### 9.4 Navigation Configuration

Navigation is organized by context in `src/config/navigation.unified.ts`:

| Category | Scope | Example Modules |
|----------|-------|----------------|
| **FINISHES_NAVIGATION** | Dawin Finishes subsidiary | Clipper, Design Manager, Manufacturing |
| **ADVISORY_NAVIGATION** | Dawin Advisory subsidiary | Delivery, MatFlow, Investment |
| **CORPORATE_NAVIGATION** | Cross-subsidiary | Strategy, HR, Finance, Capital |
| **GLOBAL_NAVIGATION** | All subsidiaries | Customers, Suppliers, Messaging |
| **UTILITY_NAVIGATION** | Tools & AI | Intelligence Layer, AI Assistant |

**Navigation Features:**
- **Command Palette** (Cmd+K) — Fuzzy search across all navigation items
- **Module Tab Nav** — Per-module sub-navigation tabs
- **Breadcrumbs** — Current path + module context
- **Access Filtering** — `filterNavigationByAccess()` hides unauthorized items

---

## 10. Backend Architecture (Cloud Functions)

### 10.1 Overview

The backend consists of **187 Firebase Cloud Functions** organized across 12 categories:

```
functions/
├── index.js                     # Entry point (4,639 lines, 187 exports)
├── src/
│   ├── ai/                      # 36 AI service functions
│   ├── integrations/            # External API integrations
│   │   ├── meta/                # WhatsApp Cloud API (8 files)
│   │   ├── quickbooks/          # QBO OAuth & sync (10 files)
│   │   ├── gchat/               # Google Chat (3 files)
│   │   └── zoko/                # Legacy WhatsApp (5 files)
│   ├── webhooks/                # Incoming webhook handlers (8 files)
│   ├── triggers/                # Firestore event triggers (16 files)
│   ├── scheduled/               # Cron jobs (8 files)
│   ├── finance/                 # Cash flow optimization (4 files)
│   ├── tools/                   # AI tool execution (10+ files)
│   ├── auth/                    # Authentication (4 files)
│   ├── marketing/               # Campaign management (3 files)
│   ├── notifications/           # Push & incident management (4 files)
│   └── utils/                   # Shared utilities (5 files)
└── package.json
```

### 10.2 Function Categories

| Category | Count | Trigger Type | Purpose |
|----------|-------|-------------|---------|
| **AI/ML** | 45+ | `onCall` | Design chat, image analysis, embeddings, market intel |
| **Webhooks** | 8 | `onRequest` | Shopify, Meta WhatsApp, Google Chat, Zoko |
| **QuickBooks** | 15+ | `onCall` | OAuth, customer/vendor/invoice sync, COGS |
| **Finance** | 8 | `onCall` + `onSchedule` | Cash flow optimization, CFO briefing |
| **Triggers** | 16+ | `onDocumentCreated/Updated` | Business event monitors, stock alerts |
| **Scheduled** | 12 | `onSchedule` | Daily audits, TTL cleanup, deadline monitoring |
| **Auth** | 8 | `onCall` | Custom claims, user invites, migration |
| **Marketing** | 5 | `onCall` | Campaign execution, engagement tracking |
| **Notifications** | 4 | `onCall` | Push notifications, incident management |
| **Tools/AI** | 10+ | `onCall` | Tool executor, security, cross-module tools |

### 10.3 Function Patterns

**Callable Function (onCall):**
```javascript
exports.functionName = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [REQUIRED_SECRETS],
  memory: '512MB',
  timeoutSeconds: 300,
}, async (request) => {
  // 1. Authentication check
  // 2. Input validation
  // 3. Business logic
  // 4. Firestore operations
  // 5. Return structured response
});
```

**HTTP Webhook (onRequest):**
```javascript
exports.webhookHandler = onRequest({
  cors: ALLOWED_ORIGINS,
}, async (request, response) => {
  // 1. Signature verification (HMAC-SHA256)
  // 2. Payload parsing
  // 3. Event processing
  // 4. Response (200 OK)
});
```

**Firestore Trigger:**
```javascript
exports.onDocumentCreated = onDocumentCreated(
  'collection/{docId}',
  async (event) => {
    // 1. Extract document data
    // 2. Run business logic
    // 3. Create side effects
  }
);
```

### 10.4 Scheduled Jobs

| Function | Schedule | Purpose |
|----------|----------|---------|
| `dailyCashFlowOptimizer` | 5:00 AM EAT | Score & allocate expenditures |
| `hourlyDeadlineCheck` | Every hour | Monitor project deadlines |
| `dailyDeadlineSummary` | 6:00 AM EAT | Generate summary reports |
| `dailyDocumentExport` | 2:00 AM EAT | Export documents to GCS |
| `dailyCatalogAudit` | 3:00 AM | Audit Shopify catalog |
| `weeklyCatalogAudit` | Weekly | Deep product audit |
| `memoryTTLCleanup` | Every 6 hours | Clean expired AI memories |
| `scheduledCustomerSync` | Every 30 min | QBO customer sync |
| `scheduledTemplateSyncMeta` | Every 2 hours | Refresh WhatsApp templates |

---

## 11. Data Architecture (Firestore)

### 11.1 Database Design Philosophy

Firestore is used as the primary database with these design principles:

- **Document-oriented** — Each entity is a self-contained document
- **Denormalized** — Redundant data for read performance
- **Offline-first** — Persistent IndexedDB cache on client
- **Real-time** — `onSnapshot` listeners for live updates
- **Multi-tenant** — Organization/subsidiary scoping via document paths

### 11.2 Core Collections

| Collection | Purpose | Scope | Indices |
|-----------|---------|-------|---------|
| `designProjects` | Design projects | Subsidiary | `(customerId, updatedAt)` |
| `designItems` | Project items | Project | Nested in projects |
| `features` | Manufacturing features | Global | `(type, material)` |
| `crmDeals` | Sales pipeline | Organization | `(stage, createdAt)` |
| `crmActivities` | Sales activities | Organization | `(dealId, createdAt)` |
| `shopifyOrders` | E-commerce orders | Organization | `(shopifyOrderId)` |
| `customers` | Customer records | Organization | `(name, email)` |
| `suppliers` | Vendor records | Organization | `(status, name)` |
| `inventory_items` | Inventory stock | Organization | `(sku, category)` |
| `manufacturing_orders` | Production orders | Organization | `(status, createdAt)` |
| `purchase_orders` | Purchase orders | Organization | `(status, supplierId)` |
| `assets` | Asset registry | Organization | `(status, category)` |
| `employees` | HR records | Organization | `(department, status)` |
| `budgets` | Financial budgets | Organization | `(fiscalYear, department)` |
| `expenditure_queue` | Finance queue | Organization | `(status, score)` |
| `spend_plans` | Daily allocations | Organization | `(date, status)` |
| `ai_memory` | AI persistent memory | Company | `(category, importance)` |
| `ai_conversations` | Chat history | Company | `(module, createdAt)` |
| `embeddings` | Vector storage | Company | Semantic search |
| `notifications` | User notifications | User + Org | `(userId, read)` |
| `cross_module_references` | Entity links | Organization | `(sourceModule, targetModule)` |
| `cross_module_metrics` | Module KPIs | Organization | `(moduleId, date)` |
| `cross_module_activity` | Audit trail | Organization | `(moduleId, timestamp)` |
| `launchProducts` | Product launches | Organization | `(currentStage)` |

### 11.3 Document Patterns

**Base Entity Pattern:**
```typescript
interface BaseEntity {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}
```

**Multi-Tenant Scoping:**
```typescript
// Organization-scoped
organizations/{orgId}/users/{userId}
organizations/{orgId}/settings

// Collection-scoped (with organizationId field)
designProjects (field: organizationId, subsidiaryId)
crmDeals (field: organizationId)
```

### 11.4 Firestore Service Layer

```typescript
// Generic CRUD operations (src/shared/services/firebase/firestore.ts)
fetchDocument<T>(collectionPath, docId): Promise<T | null>
fetchCollection<T>(collectionPath, constraints): Promise<T[]>
saveDocument(collectionPath, docId, data): Promise<void>
updateDocument(collectionPath, docId, updates): Promise<void>
removeDocument(collectionPath, docId): Promise<void>
subscribeToDocument<T>(path, docId, callback): Unsubscribe
subscribeToCollection<T>(path, constraints, callback): Unsubscribe
```

---

## 12. AI & Machine Learning Services

### 12.1 Dual-Model Strategy

DawinOS employs two AI models strategically:

```
┌──────────────────────────────────────────────────┐
│              AI Service Architecture              │
│                                                   │
│  ┌─────────────────────┐ ┌─────────────────────┐ │
│  │   Google Gemini      │ │  Anthropic Claude   │ │
│  │   (gemini-2.0-flash) │ │  (claude-sonnet-4)  │ │
│  ├─────────────────────┤ ├─────────────────────┤ │
│  │ ✓ Design chat       │ │ ✓ AI assistant      │ │
│  │ ✓ Image analysis    │ │ ✓ Strategic research│ │
│  │ ✓ Embeddings        │ │ ✓ CFO briefing     │ │
│  │ ✓ Content generation│ │ ✓ Complex reasoning│ │
│  │ ✓ Market scanning   │ │ ✓ Cross-module     │ │
│  │ ✓ Catalog audits    │ │   intelligence     │ │
│  │ ✓ BOQ cleanup       │ │                    │ │
│  │                     │ │ Cost: Higher       │ │
│  │ Cost: Lower         │ │ Quality: Higher    │ │
│  │ Speed: Faster       │ │ Reasoning: Better  │ │
│  └─────────────────────┘ └─────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │          AI Memory System                    │ │
│  │  ┌───────────┐  ┌──────────────────────┐   │ │
│  │  │ Memories  │  │   Semantic Search     │   │ │
│  │  │ (CRUD)    │  │ (Vector Embeddings)   │   │ │
│  │  └───────────┘  └──────────────────────┘   │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 12.2 Gemini Configuration

```javascript
MODEL_CONFIGS = {
  flash:      { model: 'gemini-2.0-flash', maxTokens: 4096,  temp: 0.7 },
  standard:   { model: 'gemini-2.0-flash', maxTokens: 8192,  temp: 0.5 },
  pro:        { model: 'gemini-2.0-flash', maxTokens: 8192,  temp: 0.4 },
  structured: { model: 'gemini-2.0-flash', maxTokens: 4096,  temp: 0.3 },
  vision:     { model: 'gemini-2.0-flash', maxTokens: 4096,  temp: 0.4 },
}
```

### 12.3 Claude Configuration

```javascript
MODEL_CONFIGS = {
  fast:     { model: 'claude-sonnet-4-20250514', tokens: 4096,  temp: 0.3 },
  standard: { model: 'claude-sonnet-4-20250514', tokens: 8192,  temp: 0.4 },
  detailed: { model: 'claude-sonnet-4-20250514', tokens: 16384, temp: 0.3 },
}
```

### 12.4 AI Memory System

```typescript
// Persistent business context for AI conversations
interface AIMemory {
  id: string;
  companyId: string;
  category: 'business_context' | 'project_insight' | 'user_preference';
  importance: 'low' | 'medium' | 'high' | 'critical';
  content: string;
  metadata: Record<string, any>;
  expiresAt?: Timestamp;       // TTL support
  createdAt: Timestamp;
}

// Memory operations
createMemory(memory: AIMemory): Promise<void>
searchMemories(filters): Promise<AIMemory[]>
getMemoryContext(companyId): Promise<string>      // Aggregated context for prompts
semanticMemorySearch(query): Promise<AIMemory[]>  // Vector-based retrieval
```

### 12.5 AI Functions (Cloud Functions)

| Function | Model | Purpose |
|----------|-------|---------|
| `designChat` | Gemini | Interactive design assistance |
| `imageAnalysis` | Gemini | Vision-based image processing |
| `generateEmbeddings` | Gemini | Vector embedding generation |
| `assistantChat` | Claude | General AI assistant |
| `strategyResearch` | Claude | Market & competitive research |
| `cfoBriefing` | Claude | Executive financial briefings |
| `assetIntelligence` | Gemini | Asset analytics & recommendations |
| `procurementAdvisor` | Gemini | Procurement optimization |
| `cashFlowScenario` | Gemini | Financial scenario modeling |
| `marketIntelligence` | Gemini | Competitive monitoring |
| `catalogAudit` | Gemini | Product catalog quality audit |
| `aiProjectScope` | Claude | Project scope estimation |

---

## 13. Optimization Engine

### 13.1 Overview

The optimization engine provides cutting/packing algorithms for manufacturing operations:

```
┌──────────────────────────────────────────────────┐
│            Optimization Engine                    │
│                                                   │
│  ┌─────────────────────┐ ┌─────────────────────┐ │
│  │  OptimizationService │ │  ProjectOptimization│ │
│  │  (Core Algorithm)    │ │  (Multi-Material)   │ │
│  ├─────────────────────┤ ├─────────────────────┤ │
│  │ Guillotine packing  │ │ Project-level batch  │ │
│  │ Sheet utilization   │ │ Multi-material runs  │ │
│  │ Waste tracking      │ │ Offcut integration   │ │
│  └─────────────────────┘ └─────────────────────┘ │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │       Material-Specific Optimizers         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │  Timber  │ │  Linear  │ │  Glass   │  │  │
│  │  │Optimizer │ │ Stock    │ │Optimizer │  │  │
│  │  │          │ │Optimizer │ │          │  │  │
│  │  ├──────────┤ ├──────────┤ ├──────────┤  │  │
│  │  │Grain dir │ │Length bin│ │Breakage  │  │  │
│  │  │Offcut    │ │packing  │ │aware     │  │  │
│  │  │reuse     │ │Waste min│ │Edge prot │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘  │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │        Processing Cost Service             │  │
│  │  Workshop rates · Labor costs · Pricing    │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 13.2 Optimization Modes

| Mode | Purpose | Utilization |
|------|---------|-------------|
| **ESTIMATION** | Quick quote generation | 70–90% (heuristic) |
| **PRODUCTION** | Full guillotine cutting | 85–98% (exact algorithm) |

### 13.3 Default Stock Sheets

```javascript
MDF:      2440 × 1220 × 18mm @ ₦85,000
Plywood:  2440 × 1220 × 18mm @ ₦180,000
Chipboard: 2440 × 1220 × 18mm @ ₦65,000
Melamine: 2440 × 1220 × 18mm @ ₦95,000
```

---

## 14. External Integrations

### 14.1 Integration Map

```
┌──────────────────────────────────────────────────────────┐
│                  DawinOS Integration Layer                 │
│                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │   Shopify    │    │  QuickBooks  │    │  WhatsApp   │ │
│  │  Webhooks    │    │  Online      │    │ Cloud API   │ │
│  ├─────────────┤    ├──────────────┤    ├─────────────┤ │
│  │Order create │    │OAuth 2.0     │    │Send message │ │
│  │Order fulfill│    │Customer sync │    │Templates    │ │
│  │Order update │    │Vendor sync   │    │Broadcast    │ │
│  │Product sync │    │Bill creation │    │Sales agent  │ │
│  │Inventory    │    │Invoice sync  │    │Media upload │ │
│  │             │    │Journal entry │    │             │ │
│  │             │    │Sales order   │    │             │ │
│  └─────────────┘    └──────────────┘    └─────────────┘ │
│                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │ Google Chat  │    │  Adobe PDF   │    │Google Drive │ │
│  ├─────────────┤    ├──────────────┤    ├─────────────┤ │
│  │Direct msg   │    │PDF generate  │    │File storage │ │
│  │Space create │    │PDF extract   │    │Auto-save    │ │
│  │Incidents    │    │OCR / Vision  │    │Sharing      │ │
│  └─────────────┘    └──────────────┘    └─────────────┘ │
│                                                           │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │   Notion     │    │  BigQuery    │    │Google Vision│ │
│  ├─────────────┤    ├──────────────┤    ├─────────────┤ │
│  │Database sync│    │Analytics     │    │Image OCR    │ │
│  │Page read    │    │Warehousing   │    │Label detect │ │
│  └─────────────┘    └──────────────┘    └─────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 14.2 Shopify Integration

**Webhook Handlers:**
- `shopifyOrderCreate` → Creates CRM deal (stage: won), syncs inventory
- `shopifyOrderFulfilled` → Updates fulfillment status
- `shopifyOrderUpdate` → Syncs order modifications
- **Verification:** HMAC-SHA256 webhook signature validation
- **Inventory Sync:** Bidirectional — `onStockLevelChanged` trigger pushes updates back

### 14.3 QuickBooks Online Integration

**OAuth Flow:**
1. `getAuthUrl()` → Generate OAuth state + redirect URI
2. `handleCallback()` → Exchange authorization code for tokens
3. Token storage: AES-256-GCM encryption in Firestore
4. OAuth state: HMAC signing for CSRF protection

**Data Sync Matrix:**

| DawinOS Entity | QBO Entity | Direction | Trigger |
|---------------|-----------|-----------|---------|
| Customer | Contact | Bidirectional | Scheduled (30 min) |
| Supplier | Vendor | Push | On create/update |
| Purchase Order | Bill | Push | On PO approval |
| Manufacturing Order | Invoice | Push | On MO completion |
| COGS | Journal Entry | Push | On MO completion |
| Quote | Sales Order | Push | On quote approval |

### 14.4 WhatsApp Cloud API (Meta)

- **API Version:** v21.0
- **Authentication:** Bearer token
- **Rate Limiting:** Exponential backoff on 429 responses
- **Functions:** Text, template, media messages + broadcast campaigns
- **AI Sales Agent:** `processWhatsAppWithAI()` — AI-powered conversational commerce

---

## 15. Security Architecture

### 15.1 Firestore Security Rules

**Authentication Functions:**
```javascript
isAuthenticated()     // Basic auth check
isAdmin()             // Multi-level admin check
isProjectMember(id)   // Project-level access
```

**Collection-Level Security:**

| Collection | Read | Write | Notes |
|-----------|------|-------|-------|
| `designProjects` | Project members + admin | Project members + admin | Field-level control |
| `crmDeals` | Authenticated | Authenticated | Org-scoped |
| `ai_memory` | User + company-scoped | User + company-scoped | TTL enforcement |
| `features` | Authenticated | Admin only | Shared library |
| `qbo_tokens` | — | — | Encrypted at rest |

### 15.2 Storage Security Rules

**Role-Based File Access:**

| Path | Access | File Types | Max Size |
|------|--------|-----------|----------|
| `hr/employees/{id}` | HR + Admin | Images, PDF, Docs | 50MB |
| `finance/statements/` | Finance + Admin | PDF, Spreadsheets | 50MB |
| `executive/strategy/` | Executive + Admin | All supported | 50MB |
| `design/projects/{id}` | Project members | Images, PDF, CAD | 100MB |

### 15.3 Secret Management

All sensitive credentials are stored in **Firebase Secret Manager**:

```
ANTHROPIC_API_KEY                # Claude AI access
GEMINI_API_KEY                   # Google AI access
QUICKBOOKS_CLIENT_ID / SECRET    # QBO OAuth
META_WHATSAPP_ACCESS_TOKEN       # WhatsApp API
QBO_TOKEN_ENCRYPTION_KEY         # AES-256-GCM key
OAUTH_STATE_SECRET               # HMAC signing key
NOTION_API_KEY                   # Notion integration
```

---

## 16. Authentication & Authorization

### 16.1 Authentication Flow

```
┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│  User    │───►│ Firebase Auth│───►│ Firestore    │───►│ DawinOS  │
│  Login   │    │ (Google OAuth│    │ User Lookup  │    │ Session  │
│          │    │  + popup)    │    │              │    │          │
└─────────┘    └──────────────┘    └──────────────┘    └──────────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ Load Profile │
                                   │ - Global role│
                                   │ - Subsidiary │
                                   │   access     │
                                   │ - Module     │
                                   │   permissions│
                                   └──────────────┘
```

**Steps:**
1. Firebase `onAuthStateChanged` triggers
2. Look up user in `organizations/{orgId}/users/{userId}`
3. Auto-provision super users (allowlisted emails)
4. Fallback search by email for legacy users
5. Load `DawinUser` profile with full permission tree

### 16.2 Authorization Model

```typescript
interface DawinUser {
  id: string;
  uid: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  globalRole: GlobalRole;         // owner | admin | manager | member | viewer
  subsidiaryAccess: SubsidiaryAccess[];
  isActive: boolean;
}

interface SubsidiaryAccess {
  subsidiaryId: string;
  hasAccess: boolean;
  modules: ModuleAccess[];
}

interface ModuleAccess {
  moduleId: SubsidiaryModule;
  hasAccess: boolean;
  role?: string;                  // Module-specific role
  customPermissions?: string[];   // Feature-level access
}
```

### 16.3 Permission Hierarchy

```
Organization
├── Global Role (owner > admin > manager > member > viewer)
├── Subsidiary Access
│   ├── Subsidiary A
│   │   ├── Module 1: { hasAccess: true, permissions: [...] }
│   │   ├── Module 2: { hasAccess: false }
│   │   └── ...
│   └── Subsidiary B
│       ├── Module 1: { hasAccess: true, permissions: [...] }
│       └── ...
└── Super User Override (allowlisted emails → full access)
```

### 16.4 Module-Level Feature Access

Each module defines granular feature permissions:

| Module | Features |
|--------|----------|
| Finance | `analysis`, `forecasting`, `reports`, `operations`, `settings` |
| HR | `employees`, `performance`, `leave`, `payroll`, `org-structure` |
| Strategy | `dashboard`, `plans`, `okrs`, `kpis`, `analytics` |
| CRM | `pipeline`, `deals`, `projects`, `reports` |
| Capital | `dashboard`, `needs`, `products`, `readiness`, `applications` |

---

## 17. Real-Time & Event-Driven Architecture

### 17.1 Firestore Triggers

| Trigger | Event | Handler |
|---------|-------|---------|
| `onDesignItemCreated` | New design item | Context capture, AI enrichment |
| `onDesignItemUpdated` | Item update | Memory creation, cache invalidation |
| `onPurchaseOrderCreated` | New PO | Auto-bill generation (QBO sync) |
| `onManufacturingOrderCompleted` | MO complete | Invoice + COGS sync |
| `onAssetStatusChange` | Asset update | Status log, depreciation recalc |
| `onFeatureWritten` | Feature update | Feature cache invalidation |
| `onDesignClipCreated` | New clip | Auto-analysis via AI |
| `onStockLevelChanged` | Inventory update | Push to Shopify |
| `onCashFlowChange` | Finance update | Re-score expenditure queue |

### 17.2 Client-Side Real-Time Subscriptions

```typescript
// Notification listener
onSnapshot(
  query(collection(db, 'notifications'),
    where('userId', '==', currentUserId),
    where('organizationId', '==', orgId),
    orderBy('createdAt', 'desc'),
    limit(50)
  ),
  (snapshot) => dispatch({ type: 'SET_NOTIFICATIONS', payload: snapshot.docs })
);
```

### 17.3 Notification Types by Module

| Module | Notification Types |
|--------|-------------------|
| HR Central | `contract_expiring`, `leave_request`, `payroll_pending` |
| Strategy | `okr_due`, `kpi_threshold`, `strategy_review` |
| Finance | `budget_warning`, `approval_pending`, `reconciliation_needed` |
| Performance | `review_due`, `goal_deadline`, `feedback_requested` |
| Capital | `investor_followup`, `deal_milestone`, `round_closing` |
| Market Intel | `insight_critical`, `competitor_alert`, `regulatory_change` |

---

## 18. Offline & PWA Support

### 18.1 Offline-First Strategy

```
┌─────────────────────────────────────────────────┐
│              Offline Architecture                │
│                                                  │
│  ┌──────────────────┐   ┌────────────────────┐  │
│  │  Firestore SDK   │   │  IndexedDB (Dexie) │  │
│  │  Persistent Cache│   │  Local Data Store   │  │
│  ├──────────────────┤   ├────────────────────┤  │
│  │ Auto-sync on     │   │ Module-specific    │  │
│  │ reconnect        │   │ offline data       │  │
│  │ Conflict resolve │   │ Queue mutations    │  │
│  │ Optimistic writes│   │                    │  │
│  └──────────────────┘   └────────────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │          Service Worker (PWA)             │   │
│  │  App shell caching · Push notifications   │   │
│  │  Offline fallback page                    │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### 18.2 PWA Configuration

- **Service Worker:** Registered via `src/pwa/initPWA.ts`
- **Push Notifications:** Web Push API
- **Offline Storage:** Firestore persistent cache (IndexedDB) + Dexie.js 4.2.1
- **App Shell:** Cached for instant loading

---

## 19. Testing Architecture

### 19.1 Testing Pyramid

```
         ┌───────────┐
         │   E2E     │  Playwright (critical flows)
         │   Tests   │
        ┌┴───────────┴┐
        │ Integration  │  Vitest + Firebase Emulators
        │    Tests     │
       ┌┴─────────────┴┐
       │   Unit Tests   │  Vitest + Testing Library + MSW
       │                │
       └────────────────┘
```

### 19.2 Test Configuration

| Suite | Config File | Environment | Coverage |
|-------|------------|-------------|----------|
| Unit | `vitest.config.ts` | jsdom | 80% threshold |
| Integration | `vitest.integration.config.ts` | Emulators | — |
| Migration | `vitest.migration.config.ts` | Emulators | — |
| PO-specific | `vitest.config.po.ts` | jsdom | — |
| E2E | `playwright.config.ts` | Browser | — |

### 19.3 Coverage Thresholds

```typescript
coverage: {
  provider: 'v8',
  thresholds: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80,
  }
}
```

### 19.4 Test Infrastructure

| Tool | Purpose |
|------|---------|
| **Vitest** | Test runner (Jest-compatible) |
| **@testing-library/react** | Component testing |
| **MSW** | API mocking (Mock Service Worker) |
| **Faker.js** | Realistic test data generation |
| **Firebase Emulators** | Local Firestore/Auth/Storage |
| **Playwright** | E2E browser testing |

---

## 20. Build, Deployment & Infrastructure

### 20.1 Build Pipeline

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Source Code │───►│  Vite Build  │───►│  Firebase    │
│  (TypeScript)│    │  (Rollup)    │    │  Hosting     │
└─────────────┘    └──────────────┘    └──────────────┘
                          │
                   ┌──────┴──────┐
                   │ Code Split  │
                   ├─────────────┤
                   │vendor-react │
                   │vendor-firebase│
                   │vendor-ui    │
                   │vendor-mui   │
                   │vendor-pdf   │
                   │module chunks│
                   └─────────────┘
```

### 20.2 Code Splitting Strategy

| Chunk | Contents |
|-------|----------|
| `vendor-react` | React, React DOM, React Router |
| `vendor-firebase` | Firebase SDK (Auth, Firestore, Storage) |
| `vendor-ui` | Lucide, Recharts, Framer Motion |
| `vendor-mui` | Material-UI components |
| `vendor-pdf` | @react-pdf/renderer, jsPDF |
| Module chunks | Lazy-loaded per module |

### 20.3 Deployment Commands

```bash
npm run build            # Production build (Vite → /dist)
npm run deploy           # Build + Firebase Hosting + Functions
npm run deploy:preview   # Preview channel (staging)
npm run emulators        # Local development (Auth:9099, Firestore:8080,
                         #   Functions:5001, Storage:9199, UI:4000)
```

### 20.4 Firebase Hosting Configuration

```json
{
  "hosting": {
    "public": "dist",
    "rewrites": [
      { "source": "/api/**", "function": "api" },
      { "source": "**", "destination": "/index.html" }
    ],
    "headers": [
      {
        "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache" }]
      }
    ]
  }
}
```

---

## 21. Cross-Cutting Concerns

### 21.1 Error Handling

| Layer | Strategy |
|-------|----------|
| **Components** | React Error Boundaries (per-module + global) |
| **Services** | try-catch with structured error responses |
| **Cloud Functions** | `HttpsError` codes (auth, not-found, invalid-argument) |
| **Webhooks** | 200 OK response + error logging (prevent retry storms) |
| **UI** | Error pages (404, 500, offline) with recovery options |

### 21.2 Logging & Monitoring

| Layer | Tool |
|-------|------|
| **Cloud Functions** | Firebase Logger (`logger.info/warn/error`) |
| **Client Errors** | Error boundaries + console + error service |
| **Business Events** | Cross-module activity log (Firestore) |
| **AI Operations** | Rate limiting metrics + usage tracking |

### 21.3 Performance Optimization

| Strategy | Implementation |
|----------|---------------|
| **Lazy Loading** | `lazyWithRetry()` for all module routes |
| **Code Splitting** | Vendor chunks + per-module chunks |
| **React Query Caching** | 5-min stale time, dedup requests |
| **Firestore Cache** | Persistent IndexedDB (offline-first) |
| **Image Optimization** | Lazy loading, responsive images |
| **Bundle Size** | Tree shaking, minification (Terser) |

### 21.4 Path Aliases

```typescript
// tsconfig.json path aliases
{
  "@/*":                 ["src/*"],
  "@/modules/*":         ["src/modules/*"],
  "@/shared/*":          ["src/shared/*"],
  "@/core/*":            ["src/core/*"],
  "@/subsidiaries/*":    ["src/subsidiaries/*"],
  "@/integration/*":     ["src/integration/*"],
  "@/testing/*":         ["src/testing/*"],
}
```

### 21.5 Code Conventions

| Convention | Standard |
|-----------|----------|
| **Language** | TypeScript strict mode |
| **Components** | PascalCase (`DesignItemDetail.tsx`) |
| **Functions/Variables** | camelCase (`fetchDesignItem`) |
| **Types/Interfaces** | PascalCase (`DesignItem`, `ProjectStatus`) |
| **Constants** | UPPER_SNAKE_CASE (`MODULE_RELATIONSHIPS`) |
| **Files** | kebab-case for utils, PascalCase for components |
| **Services** | `{feature}Service.ts` pattern |
| **Hooks** | `use{Feature}.ts` pattern |

---

## Appendices

### A. Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_FIREBASE_*` | Firebase project configuration |
| `VITE_ADOBE_*` | Adobe PDF Services credentials |
| `VITE_APP_VERSION` | Application version string |

### B. Firebase Emulator Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| Emulator UI | 4000 |

### C. React Query Defaults

```typescript
{
  staleTime: 300000,    // 5 minutes
  retry: 1,             // Single retry
  refetchOnWindowFocus: false,
}
```

### D. Build Targets

| Target | Value |
|--------|-------|
| ECMAScript | ES2020 |
| Module | ESNext |
| Node.js | 20 |
| Dev Server Port | 3000 |
| Preview Port | 4173 |

### E. Key File Reference

| File | Purpose |
|------|---------|
| `src/main.jsx` | Application entry point |
| `src/app/App.tsx` | Root component (providers, theme, router) |
| `src/router/index.tsx` | Route definitions (300+ routes) |
| `src/integration/store/GlobalContext.tsx` | Global state provider |
| `src/integration/constants/modules.constants.ts` | Module definitions |
| `src/config/navigation.unified.ts` | Navigation configuration |
| `src/hooks/useUserModules.ts` | Module access resolution |
| `src/core/services/crossModuleService.ts` | Cross-module communication |
| `src/shared/services/firebase/firestore.ts` | Firestore service layer |
| `src/shared/services/optimization/OptimizationService.ts` | Cutting algorithm |
| `functions/index.js` | Cloud Functions entry (187 exports) |
| `functions/src/utils/geminiClient.js` | Gemini AI configuration |
| `functions/src/utils/claudeClient.js` | Claude AI configuration |
| `firebase.json` | Firebase project configuration |
| `vite.config.ts` | Build configuration |
| `tsconfig.json` | TypeScript configuration |

---

*Document generated from codebase analysis. Last updated: March 9, 2026.*
