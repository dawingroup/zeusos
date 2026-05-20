# Dawin Advisory - Architecture Report

**Generated:** January 18, 2026  
**Location:** `src/subsidiaries/advisory/`  
**Total Items:** 496 files/directories

---

## Executive Summary

Dawin Advisory is a comprehensive consulting and strategy platform within DawinOS, designed for infrastructure investment management, project delivery, and material flow tracking. The module is organized into **6 major sub-modules** with extensive cross-module integration capabilities.

---

## 1. Module Architecture Overview

```
src/subsidiaries/advisory/
├── AdvisoryModule.tsx          # Main entry point & routing
├── index.ts                    # Barrel exports
├── advisory/                   # Client & Portfolio Management (66 items)
├── ai/                         # AI Services & Components (14 items)
├── components/                 # Shared Layout Components (6 items)
├── constants/                  # Module Constants (1 item)
├── core/                       # Core Types & Services (63 items)
├── cross-module/               # Cross-Module Integration (19 items)
├── delivery/                   # Project Delivery Module (82 items)
├── investment/                 # Deal & Pipeline Management (58 items)
├── matflow/                    # Material Flow Tracking (179 items)
├── pages/                      # Top-level Advisory Pages (2 items)
└── shared/                     # Shared Utilities (4 items)
```

---

## 2. Core Modules

### 2.1 MatFlow Module (179 items)
**Purpose:** Material flow tracking and management for construction projects

#### Routes (`/advisory/matflow/*`)
| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | MatFlow overview & metrics |
| `/projects` | ProjectList | All MatFlow projects |
| `/projects/new` | ProjectCreate | Create new project |
| `/projects/:projectId` | ProjectDetail | Project details & BOQ |
| `/projects/:projectId/import` | BOQImport | Import BOQ from Excel |
| `/projects/:projectId/forecast` | MaterialForecast | Material forecasting |
| `/boq` | BOQManagement | BOQ management |
| `/procurement` | ProcurementPage | Procurement management |
| `/suppliers` | SuppliersPage | Supplier management |
| `/materials` | MaterialLibrary | Material catalog |
| `/formulas` | FormulaDatabase | Calculation formulas |
| `/reports` | Reports | Reporting dashboard |
| `/settings` | Settings | Module settings |
| `/admin/seed` | AdminSeed | Admin data seeding |

#### Services (25 services)
| Service | Purpose |
|---------|---------|
| `boq-parser-service.ts` | Excel BOQ parsing & extraction |
| `boq-service.ts` | BOQ CRUD operations |
| `boqExportService.ts` | BOQ export functionality |
| `customerService.ts` | Customer management |
| `efrisService.ts` | EFRIS tax validation (Uganda) |
| `exportService.ts` | Report generation & export |
| `formulaService.ts` | Formula calculations |
| `formulaSuggestionService.ts` | AI formula suggestions |
| `material-service.ts` | Material management |
| `materialCalculator.ts` | Material quantity calculations |
| `materialForecastService.ts` | Material forecasting |
| `offlineAwareService.ts` | Offline-first operations |
| `offlineConfig.ts` | Offline persistence config |
| `parsingService.ts` | Generic parsing utilities |
| `procurement-service.ts` | Procurement management |
| `procurementService.ts` | Procurement operations |
| `projectService.ts` | Project CRUD |
| `pushNotificationService.ts` | Push notifications |
| `requisition-service.ts` | Requisition management |
| `serviceWorkerRegistration.ts` | PWA service worker |
| `stageProgressService.ts` | Stage progress tracking |
| `supplier-service.ts` | Supplier management |
| `syncQueueService.ts` | Offline sync queue |
| `varianceService.ts` | Cost variance analysis |

#### Hooks (28 hooks)
| Hook Category | Hooks |
|---------------|-------|
| **BOQ** | `useBOQ`, `useBOQParsing`, `useBOQReview`, `boq-hooks` |
| **Materials** | `material-hooks`, `useMaterialCalculator`, `useFormulas`, `useFormulaSuggestions` |
| **Procurement** | `procurement-hooks`, `useProcurement`, `requisition-hooks` |
| **Suppliers** | `supplier-hooks` |
| **Projects** | `useProjects`, `useMatFlow` |
| **Stages** | `useStageProgress` |
| **Variance** | `useVariance` |
| **Export** | `useExport` |
| **EFRIS** | `useEFRIS` |
| **Offline/PWA** | `useNetworkStatus`, `useSyncStatus`, `offline-hooks`, `usePushNotifications` |
| **UI** | `useMediaQuery`, `useCustomers`, `usePermissions` |

#### Types (14 type files)
- `boq.ts` - BOQ item structure with hierarchy
- `core.ts` - Core MatFlow types
- `customer.ts` - Customer types
- `efris.ts` - EFRIS tax validation types
- `export.ts` - Export configuration types
- `material.ts` - Material types
- `offline.ts` - Offline sync types
- `parsing.ts` - Parsing configuration types
- `procurement.ts` - Procurement types
- `requisition.ts` - Requisition types
- `stageProgress.ts` - Stage tracking types
- `supplier.ts` - Supplier types
- `variance.ts` - Variance analysis types

#### AI Capabilities (`matflow/ai/`)
| File | Purpose |
|------|---------|
| `boq-parser-ai.ts` | AI-powered BOQ extraction from Excel |
| `boqCleanupService.ts` | AI cleanup & hierarchy extraction |
| `confidence-scorer.ts` | Parsing confidence scoring |
| `material-matcher-ai.ts` | AI material matching |
| `parsing-prompts.ts` | Gemini prompt templates |
| `schemas/boqSchema.ts` | Zod schemas for AI output |
| `matchers/` | Pattern matching utilities |

#### Component Categories
| Category | Components |
|----------|------------|
| **Dashboard** | MatFlowDashboard, summary cards |
| **BOQ** | BOQItemReview, ConfidenceIndicator |
| **Charts** | Various visualization components |
| **EFRIS** | ValidationBadge, FDNInput, ComplianceDashboard |
| **Export** | ReportGenerator, ReportsList, QuickExportPanel |
| **Mobile** | MobileNav, MobileQuickActions, MobileBOQList, etc. |
| **Offline** | OfflineIndicator, SyncStatus |
| **PWA** | InstallPrompt, UpdatePrompt, NotificationSettings |
| **Procurement** | PurchaseOrders, Requisitions |
| **Stages** | StageProgressBar, StageTimeline |
| **Variance** | VarianceCharts, VarianceTables |

---

### 2.2 Investment Module (58 items)
**Purpose:** Infrastructure investment deal management and pipeline tracking

#### Routes (`/advisory/investment/*`)
| Route | Page | Description |
|-------|------|-------------|
| `/` | InvestmentDashboard | Investment overview |
| `/pipeline` | PipelineKanban | Kanban deal pipeline |
| `/deals` | DealList | All deals listing |
| `/deals/new` | NewDeal | Create new deal |
| `/deals/:dealId` | DealDetail | Deal details |
| `/reports` | Reports | Investment reports |

#### Services
| Service | Purpose |
|---------|---------|
| `deal-service.ts` | Deal CRUD, filtering, stage gates |
| `pipeline-service.ts` | Pipeline management & analytics |
| `due-diligence-service.ts` | DD workflow management |
| `financial-model-service.ts` | Financial modeling & scenarios |
| `deal-project-sync-service.ts` | Deal-to-Project conversion |

#### Hooks
| Category | Hooks |
|----------|-------|
| **Deal** | `useDeal`, `useEngagementDeals`, `usePipeline`, `usePipelineSummary`, `useDealsSearch`, `useCreateDeal`, `useUpdateDeal`, `useStageTransition`, `useDealTeam`, `useDealActivity`, `useDealLinks` |
| **Pipeline** | `usePipelineKanban`, `usePipelineStats`, `useStageConfigs`, `useStageTransitionRequest`, `usePendingApprovals`, `usePipelineViews`, `useUserPipelinePreferences` |
| **Due Diligence** | `useDueDiligence`, `useDealDueDiligence`, `useInitializeDueDiligence`, `useUpdateDDStatus`, `useWorkstreams`, `useWorkstream`, `useTasks`, `useFindings`, `useDDSummary`, `useDDSignOff` |
| **Financial Models** | `useFinancialModel`, `useDealModels`, `useLatestApprovedModel`, `useCreateFinancialModel`, `useUpdateFinancialModel`, `useCreateModelVersion`, `useSubmitModelForApproval`, `useApproveModel`, `useCreateScenario`, `useRunSensitivityAnalysis`, `useLiveModelCalculations`, `useScenarioComparison`, `useFormattedMetrics` |

#### Types (18 type files)
- `deal.ts` - Core deal types
- `deal-stage.ts` - Stage definitions (14KB)
- `deal-structure.ts` - Deal structuring
- `deal-team.ts` - Team assignments
- `deal-geography.ts` - Geographic data
- `pipeline.ts` - Pipeline configuration
- `pipeline-view.ts` - View preferences
- `due-diligence.ts` - DD process types
- `dd-workstream.ts` - DD workstreams (10KB)
- `dd-task.ts` - DD tasks
- `dd-finding.ts` - DD findings
- `financial-model.ts` - Financial models (12KB)
- `scenario.ts` - Scenario analysis
- `sensitivity.ts` - Sensitivity analysis
- `valuation.ts` - Valuation methods
- `returns.ts` - Return metrics
- `cash-flow.ts` - Cash flow projections

#### Utility Functions (`pipeline-analytics.ts`)
- `calculateDealVelocity` - Deal progression speed
- `calculateStageAging` - Time in stage
- `isOverdueInStage` - Overdue detection
- `calculateFunnelConversion` - Conversion rates
- `calculateWeightedPipelineValue` - Weighted value
- `groupDealsByPeriod` - Period grouping
- `calculateExpectedClosesByMonth` - Close projections
- `getDealsAtRisk` - Risk identification
- `calculateWinRateBySector` - Sector analysis

---

### 2.3 Delivery Module (82 items)
**Purpose:** Project delivery, payments, and accountability tracking

#### Routes (`/advisory/delivery/*`)
| Route | Page | Description |
|-------|------|-------------|
| `/` | DeliveryDashboard | Delivery overview |
| `/programs` | ProgramList | Programs listing |
| `/programs/new` | NewProgram | Create program |
| `/programs/:programId` | ProgramDetail | Program details |
| `/projects` | ProjectList | Projects listing |
| `/projects/new` | NewProject | Create project |
| `/projects/:projectId` | ProjectDetail | Project details |
| `/projects/:projectId/payments` | PaymentsPage | Payment tracking |
| `/projects/:projectId/visits` | SiteVisitsPage | Site visit logs |
| `/projects/:projectId/requisitions` | RequisitionsPage | Requisition list |
| `/projects/:projectId/requisitions/new` | NewBOQRequisitionPage | New requisition |
| `/requisitions/:requisitionId` | RequisitionDetailPage | Requisition details |
| `/requisitions/:requisitionId/accountability/new` | AccountabilityFormPage | Accountability form |
| `/accountabilities/:accountabilityId` | AccountabilityDetailPage | Accountability details |
| `/approvals` | ApprovalsPage | Pending approvals |

#### Services
| Service | Purpose | Size |
|---------|---------|------|
| `program-service.ts` | Program management | 25KB |
| `project-service.ts` | Project CRUD | 22KB |
| `progress-service.ts` | Progress tracking | 16KB |
| `payment-service.ts` | Payment processing | 15KB |
| `requisition-service.ts` | Requisition workflow | 14KB |
| `ipc-service.ts` | Interim Payment Certificates | 11KB |

#### Types (18 type files)
| Type File | Purpose | Size |
|-----------|---------|------|
| `program.ts` | Program definitions | 17KB |
| `program-team.ts` | Program team structure | 13KB |
| `site-visit.ts` | Site visit logging | 12KB |
| `project-timeline.ts` | Timeline management | 10KB |
| `project.ts` | Project definitions | 10KB |
| `project-progress.ts` | Progress metrics | 9KB |
| `requisition.ts` | Requisition types | 9KB |
| `program-budget.ts` | Budget tracking | 8KB |
| `progress-tracking.ts` | Progress tracking | 8KB |
| `control-boq.ts` | Control BOQ types | 8KB |
| `project-contractor.ts` | Contractor management | 8KB |
| `payment.ts` | Payment types | 8KB |
| `project-scope.ts` | Scope definitions | 7KB |
| `project-budget.ts` | Project budgets | 7KB |
| `ipc.ts` | IPC types | 7KB |
| `accountability.ts` | Accountability types | 7KB |
| `project-location.ts` | Location data | 6KB |

---

### 2.4 Advisory Client Module (66 items)
**Purpose:** Client management, portfolio tracking, and performance analytics

#### Exported Services

**Client Services:**
- `createClient`, `getClient`, `updateClient`, `getClients`
- `updateClientStatus`, `updateKYCStatus`, `updateAMLStatus`
- `raiseComplianceIssue`
- `createMandate`, `getMandate`, `getClientMandates`, `updateMandateStatus`
- `createRiskAssessment`, `getRiskAssessmentHistory`
- `addClientContact`, `updateClientContact`, `removeClientContact`
- `subscribeToClient`, `subscribeToClients`

**Portfolio Services:**
- `createPortfolio`, `getPortfolio`, `updatePortfolio`, `deletePortfolio`
- `updatePortfolioStatus`
- `calculateNAV`, `updateNAV`, `getNAVHistory`, `finalizeNAV`
- `setStrategicAllocation`, `analyzeAllocation`
- `createCapitalTransaction`, `processCapitalTransaction`, `getCapitalTransactions`
- `updateCashPosition`, `createCashForecast`, `manageBankAccount`
- Subscription methods for real-time updates

**Holding Services:**
- `createHolding`, `getHolding`, `updateHolding`, `deleteHolding`
- `updateHoldingStatus`
- `createTransaction`, `processTransaction`, `getTransactions`
- `updateValuation`, `getValuationHistory`, `approveValuation`
- `recordIncome`, `processIncome`, `getIncomeHistory`

**Performance Services:**
- `calculateIrr`, `calculateTwr`, `calculateTrueTwr`
- `calculateRiskAdjustedReturns`, `calculateReturnMetrics`
- `createPerformanceSnapshot`, `getPerformanceSnapshots`
- `createBenchmark`, `getBenchmarks`, `updateBenchmarkData`
- `calculatePme`, `calculatePeerRanking`, `calculateJCurve`
- `calculateAttribution`, `getAttribution`

**Integration Services:**
- `createCrossModuleLink`, `getLinksForEntity`, `deleteCrossModuleLink`
- `initiateDealConversion`, `approveICForConversion`, `executeConversion`
- `createCapitalDeployment`, `getDeploymentsForHolding`
- `createCoInvestor`, `createCoInvestmentOpportunity`
- `buildUnifiedAssetView`, `buildCrossModuleDashboard`

#### Types (22 type files)
- `client.ts`, `client-type.ts` - Client definitions
- `portfolio.ts` - Portfolio structure (13KB)
- `holding.ts` - Holding definitions (11KB)
- `performance.ts` - Performance metrics (9KB)
- `mandate.ts` - Mandate management
- `allocation.ts` - Asset allocation
- `attribution.ts` - Attribution analysis
- `benchmark.ts` - Benchmark definitions
- `nav.ts` - NAV calculations
- `risk-profile.ts` - Risk profiling
- `compliance.ts` - Compliance tracking
- `integration.ts` - Cross-module integration
- `co-investment.ts` - Co-investment structures
- `peer-comparison.ts` - Peer analysis
- `asset-view.ts` - Unified asset views

---

### 2.5 Core Module (63 items)
**Purpose:** Shared types, services, and utilities across Advisory

#### Core Types (27 type files)
| Type File | Purpose | Size |
|-----------|---------|------|
| `covenant.ts` | Covenant tracking | 15KB |
| `funding-instrument.ts` | Funding instruments | 13KB |
| `engagement.ts` | Engagement management | 13KB |
| `reporting.ts` | Reporting framework | 11KB |
| `funding.ts` | Funding structures | 11KB |
| `client.ts` | Client core types | 11KB |
| `approval.ts` | Approval workflows | 11KB |
| `funder.ts` | Funder profiles | 9KB |
| `approval-chain.ts` | Approval chain logic | 9KB |
| `engagement-domain.ts` | Engagement domains | 9KB |
| `disbursement.ts` | Disbursement tracking | 8KB |
| `funding-terms.ts` | Funding terms | 8KB |
| `client-compliance.ts` | Compliance requirements | 7KB |
| `client-profile.ts` | Client profiles | 7KB |
| `compliance.ts` | Compliance framework | 7KB |
| `blended-finance.ts` | Blended finance types | 6KB |
| `contact.ts` | Contact management | 6KB |
| `client-types.ts` | Client categorization | 6KB |

#### Core Services
```
core/services/
├── approval/         # Approval workflow services (5 items)
├── document/         # Document management (4 items)
├── engagement/       # Engagement services (3 items)
└── notification/     # Notification services (5 items)
```

#### Security (`core/security/`)
- 4 security-related modules for access control

---

### 2.6 AI Module (14 items)
**Purpose:** AI-powered assistance and domain detection

#### Services
| Service | Purpose |
|---------|---------|
| `domain-detector.ts` | Domain context detection |
| `gemini-agent.ts` | Gemini API integration |
| `domain-handlers.ts` | Domain-specific tool handlers |
| `tool-executor.ts` | Tool execution engine |

#### Hooks
- `useAIConversation` - Conversation management
- `useAIStreaming` - Streaming responses
- `useAISuggestions` - AI suggestions

#### Components (7 items)
- AI chat interface components
- Suggestion cards
- Streaming response UI

---

### 2.7 Cross-Module Integration (19 items)
**Purpose:** Cross-module linking, unified search, and workflow orchestration

#### Services
| Service | Purpose |
|---------|---------|
| `entity-linker.ts` | Link entities across modules |
| `unified-search.ts` | Search across all modules |
| `cross-module-reports.ts` | Cross-module reporting |
| `workflow-orchestrator.ts` | Workflow automation |

#### Hooks
- `useEntityLinks` - Entity relationship management
- `useEntityGraph` - Graph visualization
- `useLinkSuggestions` - AI link suggestions
- `useUnifiedSearch` - Global search
- `useWorkflow` - Workflow state
- `useWorkflowList` - Workflow listing
- `useWorkflowTemplates` - Template management

#### Components (6 items)
- Entity linker UI
- Search interface
- Workflow builder

#### Pages (4 items)
- Cross-module dashboard
- Entity relationship view
- Unified search page
- Workflow management

---

## 3. Firebase Collections

### MatFlow Collections
```
organizations/{orgId}/
├── matflow_projects/{projectId}/
│   ├── boq_items/
│   ├── deliveries/
│   ├── requisitions/
│   └── variance_reports/
├── matflow_suppliers/
├── matflow_materials/
└── matflow_formulas/
```

### Investment Collections
```
organizations/{orgId}/
├── investment_deals/{dealId}/
│   ├── due_diligence/
│   ├── financial_models/
│   └── team_members/
├── investment_pipeline_config/
└── investment_stage_configs/
```

### Advisory Collections
```
organizations/{orgId}/
├── advisory_clients/{clientId}/
│   ├── contacts/
│   ├── mandates/
│   └── risk_assessments/
├── advisory_portfolios/{portfolioId}/
│   ├── holdings/
│   ├── nav_history/
│   └── transactions/
└── advisory_benchmarks/
```

### Delivery Collections
```
organizations/{orgId}/
├── delivery_programs/{programId}/
│   └── team_members/
├── delivery_projects/{projectId}/
│   ├── payments/
│   ├── requisitions/
│   ├── site_visits/
│   └── progress_reports/
└── delivery_accountabilities/
```

---

## 4. Key Features

### 4.1 PWA Capabilities (MatFlow)
- **Offline Support:** Full offline persistence with sync queue
- **Push Notifications:** Delivery alerts, sync status
- **Service Worker:** Background sync, caching
- **Mobile Optimization:** Responsive layouts, touch-friendly UI
- **Install Prompt:** Native-like installation

### 4.2 AI Integration
- **BOQ Parsing:** AI-powered Excel extraction with confidence scoring
- **Material Matching:** Intelligent material identification
- **Formula Suggestions:** AI-suggested calculation formulas
- **Domain Detection:** Context-aware AI assistance
- **Conversation Interface:** Natural language queries

### 4.3 EFRIS Tax Compliance (Uganda)
- FDN (Fiscal Document Number) validation
- Invoice matching & verification
- Tax compliance dashboards
- Supplier TIN verification
- Batch validation capabilities

### 4.4 Financial Modeling
- IRR, TWR, True TWR calculations
- Scenario analysis & comparison
- Sensitivity analysis
- PME (Public Market Equivalent) analysis
- Peer universe comparison
- J-Curve analysis
- Attribution analysis

### 4.5 Reporting & Export
- Multi-format export (PDF, Excel, CSV)
- Report templates
- Quick export panels
- Scheduled reports
- Cross-module reports

---

## 5. Integration Points

### Deal → Project Conversion
```
Investment Deal → Delivery Project
- DealProjectSyncService handles conversion
- CreateProjectFromDealModal for UI
- LinkedProjectCard shows relationships
```

### Portfolio → Holding Links
```
Advisory Portfolio → Investment Deal → Delivery Project
- Unified asset view across modules
- Capital deployment tracking
- Performance aggregation
```

### Cross-Module Workflows
```
Workflow Orchestrator manages:
- Approval chains across modules
- Status synchronization
- Notification routing
- Activity logging
```

---

## 6. Route Summary

| Base Route | Module | Pages |
|------------|--------|-------|
| `/advisory` | Advisory Dashboard | 1 |
| `/advisory/matflow/*` | MatFlow | 14 |
| `/advisory/investment/*` | Investment | 6 |
| `/advisory/delivery/*` | Delivery | 15 |

**Total Routed Pages:** ~36

---

## 7. Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript |
| **Routing** | React Router v6 |
| **State** | React Query, Context API |
| **Styling** | TailwindCSS, shadcn/ui |
| **Icons** | Lucide React |
| **Backend** | Firebase (Firestore, Auth, Functions) |
| **AI** | Google Gemini API |
| **PWA** | Service Workers, IndexedDB |
| **Charts** | Recharts (implied) |

---

## 8. File Size Analysis (Key Files)

| File | Size | Purpose |
|------|------|---------|
| `matflow/pages/ProjectDetail.tsx` | 48KB | Comprehensive project view |
| `matflow/services/exportService.ts` | 39KB | Export engine |
| `matflow/ai/boqCleanupService.ts` | 32KB | AI cleanup logic |
| `matflow/pages/BOQImport.tsx` | 30KB | BOQ import wizard |
| `matflow/components/BOQItemReview.tsx` | 27KB | BOQ review interface |
| `matflow/services/stageProgressService.ts` | 26KB | Stage progress logic |
| `delivery/services/program-service.ts` | 25KB | Program management |
| `matflow/ai/boq-parser-ai.ts` | 23KB | AI BOQ parser |
| `matflow/services/boq-parser-service.ts` | 22KB | BOQ parsing |
| `delivery/services/project-service.ts` | 22KB | Project operations |

---

## 9. Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Files/Dirs** | 496 |
| **Sub-Modules** | 6 major |
| **Services** | 50+ |
| **Hooks** | 80+ |
| **Type Files** | 100+ |
| **Pages** | 36+ |
| **Firebase Collections** | 20+ |

---

*Report generated by Cascade for DawinOS Advisory Module*
