# DawinOS Architecture & Firestore Contract — iOS/Xcode Reference

## Context

The DawinOS iOS app will be built natively in Xcode and must consume the **same Firebase backend** as the existing Vite/React web app. This document is the single-source reference the iOS team needs to model their data layer correctly the first time. Field shapes below are pulled directly from the web app's TypeScript type files (not the MCP server, which has drifted in places). Where the web and MCP types disagree, **the web TypeScript types are authoritative**.

> ⚠️ The MCP server's `dawinos-mcp-server/src/types.ts` contains simplified shapes (e.g., flat `stockOnHand`, narrower `InventoryUnit` set) that do **not** match the real Firestore documents. Do **not** use MCP types as your iOS contract.

---

## 1. System Architecture

### 1.1 Tech stack

| Layer | Web app | iOS equivalent |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | SwiftUI (recommended) or UIKit |
| State | Zustand + React Query + React Context | The Composable Architecture / `@Observable` / Combine |
| Data layer | Firebase Web SDK v10 | `firebase-ios-sdk` (FirebaseFirestore, FirebaseAuth, FirebaseStorage, FirebaseFunctions) |
| Persistence | IndexedDB persistent cache + multi-tab manager | Firestore offline persistence (enabled by default on iOS) |
| Auth | Google OAuth popup, anonymous auth for public portals | `GoogleSignIn-iOS` + `FirebaseAuth` |
| Functions | 200+ Cloud Functions (onCall, onCreate, onUpdate, scheduled, Pub/Sub) | Call via `Functions.functions().httpsCallable(...)` |
| File storage | Firebase Storage | `FirebaseStorage` |
| Payments / BI | QuickBooks Online sync, Fathom reports | Read-only from Firestore cache collections |

### 1.2 Firebase initialization (web truth)

`src/shared/services/firebase/firestore.ts`:
```ts
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
```

iOS equivalent:
```swift
let settings = FirestoreSettings()
settings.cacheSettings = PersistentCacheSettings(sizeBytes: NSNumber(value: FirestoreCacheSizeUnlimited))
Firestore.firestore().settings = settings
```

### 1.3 Tenancy model

Not a strict multi-tenant model. Three scoping patterns coexist:

| Pattern | Example paths | Notes |
|---|---|---|
| **Flat root collections** | `inventoryItems/{id}`, `purchaseOrders/{id}`, `manufacturingOrders/{id}`, `customers/{id}`, `designProjects/{id}`, `contacts/{id}` | Default for most business data. Row-level access is controlled by Firestore rules + `createdBy`/`assigned*` fields on the doc. |
| **Org-scoped** | `organizations/default/advisory_projects/{id}`, `organizations/default/allocation_groups/{id}` | Infrastructure delivery / MatFlow. Today only the `default` org is used. |
| **Company-scoped** | `companies/{companyId}/strategy_reviews/{id}`, `companies/{companyId}/forecasts/{id}`, `companies/{companyId}/expenditure_queue/{id}` | Finance, strategy, treasury. `{companyId}` = the operating subsidiary. |

**iOS teams must build a small helper that resolves these three patterns from a single `collectionPath(for:)` function** so business logic stays path-agnostic.

### 1.4 Authentication

- Primary: Google OAuth 2.0 via `signInWithPopup` on web → `GIDSignIn` + `Auth.auth().signIn(with:)` on iOS.
- Anonymous auth is also supported (`signInAnonymously`) — used by public portals, not needed in the main iOS app.
- Roles come from `users/{uid}.globalRole` (`admin | owner | manager | user`). No custom claims — the Firestore rules read the user doc directly. iOS must read `users/{uid}` on login to cache the role.
- Project-level access: `designProjects/{id}.createdBy`, `.assignedDesigner`, `.assignedEngineer` are the fields used by `isProjectMember(projectId)` in rules.

### 1.5 Cloud Functions call surface

iOS will call these via `Functions.functions().httpsCallable(...)`. Grouped by area:

- **Design Studio AI** — `designChat`, `imageAnalysis`, `designItemEnhancement`, `analyzeClip`
- **BOQ / MatFlow** — `enhanceBOQItems`, `generateFormulaBreakdown`, `applyFormulaToBOQ`, `parsePurchaseOrderPdf`
- **Manufacturing** — `onManufacturingOrderCreated` (trigger only), `onMOCompletedMES`, `dailyProductionReport`
- **Inventory** — `auditInventoryHealth`, `mergeInventoryDuplicates`
- **Procurement** — `procurementAdvisor`, `parsePurchaseOrderPdf`
- **QBO** — `syncAllQBOData`, `syncInventoryItemsToQBO`, `syncSOToInvoice`
- **Strategy** — `assessStrategySection`, `rewriteStrategySection`, `strategyResearch`
- **Assets / Workshop 3D** — `analyzeFeatureFromAsset`, `recognizeCabinetParts`, `generateMesh`, `generateParametric`, `uploadToTrimbleConnect`
- **Cashflow** — `dailyCashFlowOptimizer`, `generateSpendPlan`, `rescoreExpenditures`
- **Memory / Intelligence** — `extractMemories`, `semanticMemorySearch`, `marketIntelligenceScan`
- **Messaging** — `metaWhatsAppWebhook` (webhook only), `sendWhatsAppMessage`, `gchatWebhook`, `sendGChatMessage`, `sendPushNotification`

Cloud Functions region: default (`us-central1`) unless otherwise noted in each function's source.

### 1.6 Module layout (web → iOS feature mapping)

The web app organizes features two ways: `src/modules/*` for cross-subsidiary modules, and `src/subsidiaries/{finishes|advisory|technology|capital}/*` for subsidiary-specific features. iOS should mirror this as Swift modules/targets:

| Web module | Purpose | Primary collections | Suggested iOS feature |
|---|---|---|---|
| `modules/inventory` | Materials catalog + stock | `inventoryItems`, `stockLevels`, `stockLevels/{id}/movements`, `stock_adjustments`, `finishLibrary`, `warehouses`, `counters` | InventoryFeature |
| `modules/strategy` | Strategy docs, reviews, pillars | `strategy_documents`, `companies/{id}/strategy_reviews/*` | StrategyFeature |
| `subsidiaries/finishes/design-manager` | Design project workflow | `designProjects`, + nested `designItems`, `stageHistory`, `approvals`, `deliverables`, `clientDocuments`, `clientInteractions`, `aiAnalyses`, `projectParts`, `materials` | DesignManagerFeature |
| `subsidiaries/finishes/design-studio` | Product configurator, KB | `productDefinitions`, `designKnowledgeBase`, `manufacturingDataPackages`, `configuratorAnalytics` | DesignStudioFeature |
| `subsidiaries/finishes/cutlist` | BOM / cutting optimization | `workInstances`, `materialMappings`, `stockMaterials` | CutlistFeature |
| `subsidiaries/finishes/customers` | Customer hub | `customers`, `customers/{id}/materials`, `customers/{id}/projects` | CustomersFeature |
| `subsidiaries/finishes/launch-pipeline` | Product launch to Shopify | `launchProducts`, `launchDeliverables` | LaunchPipelineFeature |
| `subsidiaries/finishes/feature-library` | Reusable design features | `features`, `featureComponents` | FeatureLibraryFeature |
| `subsidiaries/finishes/assets` | Asset registry & workshop | `assets`, `assetStatusChanges`, `assetCheckouts`, `assetConsumables`, `maintenanceLogs`, `workshop_viewer_sessions` | AssetsFeature |
| `subsidiaries/advisory/core` | Engagement, client, funder mgmt | `engagements` (+ `fundingSources`/`disbursements`/`reportingRequirements`/`covenants`/`approvalRequests`), `clients` (+ `contacts`), `funders` | EngagementFeature |
| `subsidiaries/advisory/matflow` | Construction delivery / BOQ | `organizations/default/advisory_projects`, `organizations/default/allocation_groups`, `advisoryPlatform/matflow/boqs`, `advisoryPlatform/matflow/boqVariations`, `advisoryPlatform/matflow/boqTemplates`, `matflow_formulas`, `material_rates` | MatFlowFeature |
| `subsidiaries/advisory/delivery` | Delivery reporting | `deliveryProjects`, `deliveryReports`, `projectDeliverables` | DeliveryFeature |
| `subsidiaries/advisory/investment` | Blended finance / deals | `investmentDeals`, `fundingStructures`, `blendedFinanceAnalyses` | InvestmentFeature |
| `subsidiaries/capital/*` | Capital markets | `companies/{id}/capital_needs`, `companies/{id}/capital_products`, `companies/{id}/capital_applications`, `companies/{id}/capital_facilities`, `companies/{id}/capital_readiness` | CapitalFeature |
| Cross-cutting: Purchasing | PO workflow | `purchaseOrders`, `suppliers`, `counters` | PurchasingFeature |
| Cross-cutting: Manufacturing | Shop-floor MO | `manufacturingOrders` (+ `bomEntries`/`materialConsumptions`/`stageTransitions`), `counters` | ManufacturingFeature |
| Cross-cutting: CRM | Sales pipeline | `crmDeals`, `crmActivities`, `crmTasks` | CRMFeature |
| Cross-cutting: Finance | Cash flow & CFO tools | `companies/{id}/expenditure_queue`, `companies/{id}/spend_plans`, `companies/{id}/cashflow_projections`, `companies/{id}/forecasts/*`, `companies/{id}/cfo_briefings`, `companies/{id}/qbo_*` | FinanceFeature |
| Cross-cutting: AI Memory | Persistent AI memory | `ai_memory`, `ai_conversations` | AIMemoryFeature |
| Cross-cutting: Files | Unified file manager | `projectFiles` | FilesFeature |
| Cross-cutting: Notifications | Alerts | `companies/{id}/notifications`, per-user notif docs | NotificationsFeature |

---

## 2. Firestore Collection Map (authoritative)

### 2.1 Flat root collections

| Path | Document type | Auth type file |
|---|---|---|
| `users/{uid}` | User profile + role | `src/core/types/user.ts` (or inline in auth service) |
| `inventoryItems/{itemId}` | `InventoryItem` | `src/modules/inventory/types/inventory.ts` |
| `finishLibrary/{finishId}` | `FinishDocument` | `src/modules/inventory/types/finishLibrary.ts` |
| `finishAttributeDefinitions/{id}` | attribute metadata | `src/modules/inventory/types/finishLibrary.ts` |
| `warehouses/{id}` | Warehouse | `src/modules/inventory/types/` |
| `stockLevels/{id}` | `StockLevel` | `src/modules/inventory/types/` |
| `stockLevels/{id}/movements/{moveId}` | `StockMovement` (immutable) | |
| `stock_adjustments/{id}` | `StockAdjustment` | |
| `counters/{counterId}` | Sequential number generators (PO, MO, ADJ) | |
| `purchaseOrders/{poId}` | `PurchaseOrder` (line items embedded) | |
| `suppliers/{id}` | Supplier | |
| `manufacturingOrders/{moId}` | `ManufacturingOrder` | |
| `manufacturingOrders/{moId}/bomEntries/{id}` | `BOMEntry` | |
| `manufacturingOrders/{moId}/materialConsumptions/{id}` | `MaterialConsumption` | |
| `manufacturingOrders/{moId}/stageTransitions/{id}` | `StageTransition` | |
| `customers/{customerId}` | Customer master | |
| `customers/{customerId}/materials/{id}` | customer-specific material override | |
| `customers/{customerId}/projects/{id}` | customer project index | |
| `contacts/{id}` | Generic contact | |
| `designProjects/{projectId}` | Design project | `src/subsidiaries/finishes/design-manager/types/` |
| `designProjects/{projectId}/designItems/{itemId}` | Design item | |
| `designProjects/{projectId}/designItems/{itemId}/stageHistory/{id}` | immutable audit | |
| `designProjects/{projectId}/designItems/{itemId}/approvals/{id}` | approval sign-off | |
| `designProjects/{projectId}/designItems/{itemId}/deliverables/{id}` | design deliverable | |
| `designProjects/{projectId}/clientDocuments/{id}` | uploaded client files | |
| `designProjects/{projectId}/clientInteractions/{id}` | meetings / call logs | |
| `designProjects/{projectId}/aiAnalyses/{id}` | AI-generated analyses | |
| `designProjects/{projectId}/projectParts/{id}` | shared custom parts | |
| `designProjects/{projectId}/materials/{id}` | project-specific materials | |
| `projectFiles/{fileId}` | unified file manager | |
| `productDefinitions/{id}` | Product Definition Document (PDD) | `src/subsidiaries/finishes/design-studio/types/` |
| `designKnowledgeBase/{id}` | KB entry | |
| `manufacturingDataPackages/{id}` | MDP handoff package | |
| `configuratorAnalytics/{eventId}` | configurator telemetry | |
| `features/{id}` | Reusable feature | `src/subsidiaries/finishes/feature-library/types.ts` |
| `assets/{id}` | Asset | `src/subsidiaries/finishes/assets/types.ts` |
| `assetStatusChanges/{id}` | immutable audit | |
| `assetCheckouts/{id}` | checkout log | |
| `assetConsumables/{id}` | consumables | |
| `maintenanceLogs/{id}` | maintenance record | |
| `workshop_viewer_sessions/{id}` | 3D viewer session | |
| `crmDeals/{id}` | Sales deal | |
| `crmActivities/{id}` | call/email/meeting | |
| `crmTasks/{id}` | follow-up task | |
| `integrations/{docId}` | OAuth tokens (QBO, Shopify, Adobe) | admin only |
| `integrations/{docId}/items/{id}` | QBO item resolution cache | |
| `integrations/{docId}/resolution_log/{id}` | resolution audit | |
| `engagements/{engagementId}` | Advisory engagement | `src/subsidiaries/advisory/core/types/engagement.ts` |
| `engagements/{id}/fundingSources/{fsId}` | Funding source | |
| `engagements/{id}/fundingSources/{fsId}/disbursements/{id}` | Disbursement | |
| `engagements/{id}/reportingRequirements/{id}` | Reporting requirement | |
| `engagements/{id}/reportSubmissions/{id}` | Report submission | |
| `engagements/{id}/covenants/{id}` | Covenant | |
| `engagements/{id}/covenants/{covId}/measurements/{id}` | Covenant measurement | |
| `engagements/{id}/approvalRequests/{id}` | Approval | |
| `engagements/{id}/documents/{id}` | Engagement document | |
| `engagements/{id}/activityLog/{id}` | Activity audit | |
| `clients/{clientId}` | Client/borrower | `src/subsidiaries/advisory/core/types/client*.ts` |
| `clients/{clientId}/contacts/{id}` | Contact | |
| `clients/{clientId}/kycDocuments/{id}` | KYC doc | |
| `funders/{id}` | Funder | `src/subsidiaries/advisory/core/types/funder.ts` |
| `ai_memory/{id}` | AI memory entry | `src/shared/services/ai/aiMemory.types.ts` |
| `ai_conversations/{id}` | AI conversation (messages embedded) | |
| `strategy_documents/{id}` | Strategy document | `src/modules/strategy/types/strategy.types.ts` |
| `strategy_documents/{id}/document_sections/{id}` | Parsed section | `src/modules/strategy/types/documentSection.types.ts` |
| `strategy_documents/{id}/section_audit_log/{id}` | Section audit (immutable) | |
| `projectStrategy/{projectId}` | Project-level strategy canvas | |
| `offcuts/{id}` | Offcut material | `src/shared/types/offcut.ts` |
| `productVariants/{id}` | Finish × attribute combos + stock ledger | |
| `productVariants/{id}/stockTransactions/{id}` | stock ledger (immutable) | |
| `productVariants/{id}/reservations/{id}` | stock reservations | |
| `costHistory/{id}` | Unit cost change audit (immutable) | |
| `inventoryAgentInstructions/{id}` | AI audit config (admin) | |
| `inventoryAuditResults/{id}` | Last audit results | |
| `designManagerErrors/{id}` | Error tracking (admin) | |
| `creditUsage/{subsidiaryId}` | AI credit/token tracking | |

### 2.2 Org-scoped collections (`organizations/default/...`)

| Path | Document type | Auth type file |
|---|---|---|
| `organizations/default/advisory_projects/{id}` | `Project` (MatFlow) | `src/subsidiaries/advisory/core/project/types/project.types.ts` |
| `organizations/default/allocation_groups/{id}` | `AllocationGroup` | |
| `advisoryPlatform/matflow/boqs/{id}` | `BOQDocument` | `src/subsidiaries/advisory/core/project/types/boq.types.ts` |
| `advisoryPlatform/matflow/boqVariations/{id}` | `BOQVariation` | |
| `advisoryPlatform/matflow/boqTemplates/{id}` | `BOQTemplate` | |
| `advisoryPlatform/matflow/suppliers/{id}` | MatFlow-specific supplier | |
| `matflow_formulas/{id}` | Construction formula (C25, BRICK_230, etc.) | `src/subsidiaries/advisory/matflow/types/formula.ts` |
| `material_rates/{id}` | MatFlow material rate library | |

### 2.3 Company-scoped collections (`companies/{companyId}/...`)

Finance, strategy, treasury, and capital markets data. Replace `{companyId}` with the subsidiary ID on iOS.

| Subpath | Purpose |
|---|---|
| `strategy_reviews/{id}` | Strategy review cycle (+ `document_sections`, `section_audit_log` subcollections) |
| `business_pivots/{id}` | Strategic pivots |
| `financial_reports/{id}` | Aggregated finance |
| `qbo_sync_jobs/{id}` | QBO sync job history |
| `qbo_synced_data/{id}` | P&L / balance sheet snapshots |
| `qbo_accounts/{id}` | Chart of accounts cache |
| `qbo_items/{id}` | QBO products/services cache |
| `qbo_invoices/{id}` | QBO invoices |
| `qbo_bills/{id}` | QBO bills |
| `qbo_bank_transactions/{id}` | QBO bank tx |
| `fathom_reports/{id}` | Fathom financial reports |
| `fathom_alerts/{id}` | Fathom alerts |
| `reconciliation_schedules/{id}`, `reconciliation_tasks/{id}` | Recon scheduling |
| `finance_documents/{id}` | Receipts, invoices, docs |
| `tax_portal_links/{id}` | Tax compliance links |
| `forecasts/{id}` | 3-way forecast (+ `periods`, `value_rules`, `micro_capex`, `micro_loans`, `micro_capital_events`, `micro_dividends` subcollections) |
| `budgets/{id}` | Budget (+ `budgetLines`) |
| `cashflow_projections/{id}` | Cashflow projections |
| `expenditure_queue/{id}` | Payment priority queue |
| `spend_plans/{id}` | Approved payment schedules |
| `savings_ledger/{id}` | Cash reserve |
| `liability_register/{id}` | Liabilities |
| `optimizer_config/{id}`, `optimizer_runs/{id}`, `optimizer_semaphores/{id}` | Cashflow optimizer |
| `projected_receipts/{id}` | Expected inflows |
| `client_payment_profiles/{id}` | Customer payment behavior |
| `cfo_briefings/{id}` | CFO briefings |
| `scenario_results/{id}` | What-if scenario output |
| `notifications/{id}` | Company-level notifications |
| `capital_needs/{id}`, `capital_products/{id}`, `capital_applications/{id}`, `capital_facilities/{id}`, `capital_readiness/{id}` | Capital markets |

---

## 3. Ground-truth field shapes (from web TypeScript)

Each block below is transcribed from the file noted at the top. Optional fields are marked `?`. `Timestamp` is `FIRTimestamp` on iOS. Use Firestore's native `Date`/`Timestamp` decoding — do not store ISO strings.

### 3.1 Inventory — `inventoryItems/{id}`

**File:** `src/modules/inventory/types/inventory.ts` — interface `InventoryItem`

> ⚠️ Critical: `pricing` and `inventory` are **nested objects**, not flat fields. The MCP tool writes them incorrectly if misused; the web is the truth.

```ts
InventoryCategory = 'sheet-goods' | 'solid-wood' | 'hardware' | 'edge-banding'
                  | 'finishing' | 'adhesives' | 'fasteners' | 'other'

InventoryUnit = // count
    'ea' | 'pcs' | 'pair' | 'dozen' | 'set'
  // sheet
  | 'sheet'
  // length
  | 'mm' | 'cm' | 'm' | 'in' | 'ft' | 'yd' | 'lft'
  // area
  | 'sqmm' | 'sqcm' | 'sqm' | 'sqin' | 'sqft' | 'sqyd'
  // volume
  | 'ml' | 'cl' | 'ltr' | 'cbm' | 'floz' | 'pt' | 'qt' | 'gal' | 'cbft'
  // weight
  | 'mg' | 'g' | 'kg' | 'mt' | 'oz' | 'lb' | 'ton'
  // packaging
  | 'box' | 'pack' | 'roll' | 'bundle' | 'carton' | 'pallet' | 'bag'
  | 'tube' | 'can' | 'drum' | 'barrel' | 'spool'

InventoryStatus = 'active' | 'discontinued' | 'out-of-stock' | 'archived'
InventoryTier = 'catalogue' | 'project'
InventoryClassification = 'material' | 'product' | 'kit'
InventorySource = 'manual' | 'parts-promotion'
InventoryItemType = 'standard' | 'engineering-parent' | 'purchasing-tier' | 'kit'

InventoryPricing {
  costPerUnit: number
  currency: string              // e.g. "UGX", "USD", "KES"
  unit: InventoryUnit
  functionalCurrencyCost?: number
  exchangeRate?: number
  priceHistory?: PriceHistoryEntry[]
  costPerCubicMetre?: number    // timber/solid-wood only
  pricingBasis?: 'per-unit' | 'per-cbm'
}

PriceHistoryEntry {
  costPerUnit: number
  currency: string
  recordedAt: Timestamp
  source: 'manual-update' | 'po-receipt'
}

InventoryStock {
  inStock: number
  reorderLevel?: number
  volumeOnHand?: number         // timber
  piecesOnHand?: number         // timber
}

InventoryDimensions {
  length: number                // mm
  width: number                 // mm
  thickness: number             // mm
}

VariantAttribute {
  key: string                   // 'color' | 'thickness' | ...
  value: string
}

StructuredName {
  function?: string
  keySpecs?: string
  qualityTier?: string
  brandName?: string
}

VendorSource {
  id: string
  supplierId: string
  supplierName: string
  mpn: string                   // manufacturer part number
  supplierSku?: string
  brandName?: string
  unitPrice: number
  currency: string
  unit: InventoryUnit
  minimumOrder?: number
  leadTimeDays?: number
  isPreferred: boolean
  qualityTier?: 'economy' | 'standard' | 'premium' | 'luxury'
  certifications?: string[]
  notes?: string
  url?: string
  lastQuotedAt?: Timestamp
  addedAt: Timestamp
  addedBy: string
}

KitComponent {
  inventoryItemId: string
  sku: string
  name: string
  quantity: number
  unit: InventoryUnit
  isOptional?: boolean
  notes?: string
}

SupplierInventoryPricing {
  supplierId: string
  supplierName: string
  supplierCode?: string
  unitPrice: number
  currency: string
  unit: InventoryUnit
  minimumOrder?: number
  leadTimeDays?: number
  effectiveDate?: Timestamp
  expiryDate?: Timestamp
  notes?: string
  isPreferred: boolean
  lastQuotedAt?: Timestamp
  addedAt: Timestamp
  addedBy: string
  qualityTier?: 'economy' | 'standard' | 'premium' | 'luxury'
  certifications?: string[]
  brand?: string
  bulkDiscountThreshold?: number
  bulkDiscountPrice?: number
}

InventoryItem {
  id: string
  sku: string                               // unique
  name: string
  displayName?: string
  description?: string

  // Classification
  classification?: InventoryClassification
  category: InventoryCategory
  subcategory?: string
  brand?: string
  tags: string[]
  aliases?: string[]

  itemType?: InventoryItemType              // default 'standard'
  structuredName?: StructuredName

  // Family / SKU hierarchy
  isFamily?: boolean                        // parent marker
  isOrderable?: boolean                     // false for families
  isBomSelectable?: boolean
  familyId?: string | null                  // child → parent
  skuIds?: string[]                         // parent → children
  variantAttributeDefinitions?: string[]

  // UoM conversion
  purchaseUom?: InventoryUnit
  stockUom?: InventoryUnit
  consumptionUom?: InventoryUnit
  uomConversion?: number                    // 1 purchaseUom = X stockUom

  // Legacy flat variants
  parentItemId?: string
  variantAttributes?: VariantAttribute[]
  variantIds?: string[]
  isVariantParent?: boolean

  // Engineering hierarchy (parametric)
  engineeringParentId?: string
  engineeringFunction?: string
  purchasingTierIds?: string[]

  vendorSources?: VendorSource[]
  kitComponents?: KitComponent[]
  kitSourceId?: string
  parametricTags?: Record<string, string>

  // Supplier / Shopify / QBO sync
  preferredSupplierId?: string
  preferredSupplierName?: string
  shopifyProductId?: string
  shopifyVariantId?: string
  shopifySyncStatus?: 'not_synced' | 'syncing' | 'synced' | 'error'
  shopifyLastSyncAt?: Timestamp
  qboItemId?: string
  qboSyncStatus?: 'synced' | 'error' | 'pending'
  qboSyncedAt?: Timestamp

  linkedProjectIds?: string[]
  supplierPricing?: SupplierInventoryPricing[]
  linkedMaterialIds?: string[]

  source: InventorySource                   // 'manual' | 'parts-promotion'
  promotedFromPartId?: string

  tier: InventoryTier                       // 'catalogue' | 'project'
  scopeId?: string                          // projectId for project-tier items

  restockable?: boolean                     // default true

  dimensions?: InventoryDimensions
  grainPattern?: 'none' | 'lengthwise' | 'crosswise' | 'random'

  pricing: InventoryPricing                 // REQUIRED nested object
  inventory: InventoryStock                 // REQUIRED nested object (NOT flat stockOnHand)

  status: InventoryStatus

  // Finish library attribution
  finishCategory?: FinishCategory
  finishSubtype?: FinishSubtype
  linkedFinishes?: LinkedFinish[]
  linkedFinishIds?: string[]                // flat array for array-contains queries
  requiredAttributes?: string[]
  attributeConstraints?: Record<string, (string | number | boolean)[]>

  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
  lastAuditedAt?: Timestamp
}
```

**iOS gotchas:**
- Use Firestore's `Codable` support. Nested structs for `pricing` and `inventory` are mandatory.
- Indexes: there's a composite index on `familyId + status + name`. Any child query must include a `status` filter, or it will fail in production.
- There is **no top-level `stockOnHand`** — always read `inventory.inStock`.
- Do NOT write to legacy top-level `costPrice` / `currency` — those were historically orphaned and get overwritten by the canonical `pricing` object (see recent fix in commit `36fd375`).

### 3.2 Inventory — `finishLibrary/{id}`

**File:** `src/modules/inventory/types/finishLibrary.ts` — interface `FinishDocument`

```ts
FinishCategory = 'board' | 'paint' | 'tile' | 'laminate' | 'veneer'
               | 'fabric' | 'metal' | 'stone' | 'glass' | 'custom'
FinishAvailability = 'in_stock' | 'made_to_order' | 'discontinued' | 'seasonal'

LinkedFinish {
  finishId: string
  finishName: string
  relationshipType: string
}

FinishDocument {
  id: string
  organizationId: string
  subsidiaryId?: string
  name: string
  code: string
  category: FinishCategory
  subtype?: FinishSubtype
  description?: string
  hexColor?: string
  secondaryColor?: string
  patternType?: string
  availability: FinishAvailability
  tags?: string[]
  costModifier?: { costModifierType: 'percentage' | 'absolute'; value: number }
  thumbnailUrl?: string
  textureAssets?: {
    diffuseUrl?: string
    normalUrl?: string
    roughnessUrl?: string
    tileRepeat?: number
  }
  linkedFinishes?: LinkedFinish[]
  isActive: boolean
  notes?: string
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
  version: number
}
```

### 3.3 Stock — `stockLevels/{id}` + `/movements/{id}`

```ts
StockLevel {
  id: string
  inventoryItemId: string
  warehouseId: string
  quantityOnHand: number
  quantityAllocated: number
  quantityAvailable: number        // derived: onHand - allocated
  reorderPoint: number
  lastCountedAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Subcollection: stockLevels/{id}/movements/{id}
StockMovement {                    // immutable
  id: string
  type: 'receipt' | 'issue' | 'adjustment' | 'transfer' | 'count'
  quantity: number
  quantityBefore: number
  quantityAfter: number
  referenceType?: 'purchaseOrder' | 'manufacturingOrder' | 'stockAdjustment' | 'salesOrder'
  referenceId?: string
  notes?: string
  createdAt: Timestamp
  createdBy: string
}
```

### 3.4 Stock adjustments — `stock_adjustments/{id}`

```ts
StockAdjustment {
  id: string
  adjustmentNumber: string                 // ADJ-YYYY-NNNN (counter-generated)
  type: 'physical_count_variance' | 'damage_spoilage' | 'shrinkage_loss'
      | 'offcut_adjustment' | 'correction'
  reason: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  lineItems: StockAdjustmentLineItem[]     // EMBEDDED array
  totalValue: number
  notes?: string
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
  approvedBy?: string
  approvedAt?: Timestamp
}

StockAdjustmentLineItem {
  inventoryItemId: string
  itemName: string
  adjustmentType: 'increase' | 'decrease'
  quantity: number
  unitCost: number
  totalCost: number
  notes?: string
}
```

### 3.5 Purchasing — `purchaseOrders/{id}`

```ts
PurchaseOrder {
  id: string
  poNumber: string                         // PO-YYYY-NNNN (counter-generated via transaction)
  status: 'draft' | 'pending-approval' | 'approved' | 'sent'
        | 'partially-received' | 'received' | 'closed' | 'cancelled'
  supplierId: string
  supplierName: string
  supplierEmail?: string
  supplierPhone?: string
  lineItems: PurchaseOrderLineItem[]       // EMBEDDED — not a subcollection
  subtotal: number
  tax?: number
  total: number                            // GRAND TOTAL (not 'grandTotal')
  currency: 'UGX' | 'USD'
  expectedDeliveryDate?: Timestamp
  actualDeliveryDate?: Timestamp
  notes?: string
  projectId?: string
  rejectionReason?: string                 // when status=rejected
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
  version: number
}

PurchaseOrderLineItem {
  id: string
  itemName: string                         // NOTE: 'itemName' not 'name'
  inventoryItemId?: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  notes?: string
}
```

Allowed status transitions (enforced by `dawinos_update_po_status`):
```
draft            → pending-approval | cancelled
pending-approval → approved | rejected | cancelled
approved         → sent | cancelled
sent             → partially-received | received | cancelled
partially-received → received | cancelled
received         → closed
```

### 3.6 Manufacturing — `manufacturingOrders/{id}`

```ts
ManufacturingOrder {
  id: string
  moNumber: string                         // MO-YYYY-NNNN
  status: 'draft' | 'pending-approval' | 'approved' | 'in-progress'
        | 'on-hold' | 'completed' | 'cancelled'
  currentStage: 'queued' | 'cutting' | 'assembly' | 'finishing' | 'qc' | 'ready'
  itemName: string
  quantity: number
  priority: 'low' | 'medium' | 'high' | 'urgent'
  projectId?: string
  targetCompletionDate?: Timestamp
  estimatedCost?: number
  actualCost?: number
  notes?: string
  instructions?: string
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
  version: number
}
```

> ⚠️ **NOT embedded.** BOM entries, material consumptions, and stage transitions are **subcollections** named exactly: `bomEntries`, `materialConsumptions`, `stageTransitions` (not `bom`, `materials`, `steps`).

```ts
// manufacturingOrders/{moId}/bomEntries/{id}
BOMEntry {
  id: string
  inventoryItemId: string
  itemName: string
  quantity: number
  unit: string
  unitCost: number
  totalCost: number
  currency?: 'UGX' | 'USD'
}

// manufacturingOrders/{moId}/materialConsumptions/{id}
MaterialConsumption {
  id: string
  inventoryItemId: string
  quantityConsumed: number
  consumedAt: Timestamp
  notes?: string
}

// manufacturingOrders/{moId}/stageTransitions/{id}
StageTransition {
  id: string
  fromStage: string
  toStage: string
  transitionedAt: Timestamp
  transitionedBy: string
  notes?: string
}
```

Status field is `currentStage` (not `productionStage`). Status uses kebab-case (`in-progress`, not `in_progress`).

### 3.7 MatFlow (Infrastructure Delivery) — `organizations/default/advisory_projects/{id}`

**File:** `src/subsidiaries/advisory/core/project/types/project.types.ts` — interface `Project`

```ts
ProjectStatus = 'planning' | 'procurement' | 'mobilization' | 'active'
              | 'substantial_completion' | 'defects_liability'
              | 'completed' | 'suspended' | 'cancelled'
ProjectType = 'new_construction' | 'renovation' | 'expansion' | 'rehabilitation'

ProjectLocation {
  siteName: string
  address?: string
  district: string
  region: string
  country: string
  coordinates?: { latitude: number; longitude: number }
}

ProjectBudget {
  currency: 'UGX' | 'USD'
  totalBudget: number
  spent: number
  committed: number
  remaining: number
  variance: number
  varianceStatus: 'on_track' | 'over' | 'under'
  contingencyPercent: number
}

ProjectProgress {
  physicalProgress: number          // 0-100
  financialProgress: number         // 0-100
  completionPercent: number
  progressStatus: 'ahead' | 'on_track' | 'behind' | 'critical'
}

ProjectTimeline {
  plannedStartDate: Timestamp
  plannedEndDate: Timestamp
  currentStartDate: Timestamp
  currentEndDate: Timestamp
  actualStartDate?: Timestamp
  actualEndDate?: Timestamp
  isDelayed: boolean
  daysRemaining: number
  currentDuration: number
  percentTimeElapsed: number
  delayDays: number
  milestones?: any[]
}

ProjectMember {
  userId: string
  email: string
  displayName: string
  role: 'quantity_surveyor' | 'site_engineer' | 'project_manager' | 'advisor'
  capabilities: string[]
}

ProjectStage {
  id: string
  name: string
  order: number
  status: 'not_started' | 'in_progress' | 'completed'
  completionPercent: number
}

ProjectSettings {
  taxEnabled: boolean
  taxRate: number
  defaultWastagePercent: number
}

AccountabilitySummary {
  totalDisbursed: number
  totalAccounted: number
  unaccountedAmount: number
  requisitionCount: number
  manualRequisitionCount: number
  accountabilityRate: number        // 0-1
  overdueCount: number
  status: 'healthy' | 'warning' | 'critical'
}

Project {
  id: string
  name: string
  projectCode: string
  description?: string
  programId: string
  programName?: string
  engagementId: string
  customerId?: string
  customerName?: string
  linkedDealId?: string
  status: ProjectStatus
  projectType: ProjectType
  implementationType?: string
  contractor?: {
    name?: string
    companyName?: string
    contact?: string
    contactPerson?: { name: string; role?: string; email?: string; phone?: string }
    contractType?: string
    contractNumber?: string
    contractValue?: number
    startDate?: Timestamp
    endDate?: Timestamp
  }
  location: ProjectLocation
  budget: ProjectBudget
  progress: ProjectProgress
  timeline: ProjectTimeline
  settings: ProjectSettings
  stages: ProjectStage[]
  members: ProjectMember[]
  boqIds: string[]
  activeBoqId?: string
  boqSummary?: {
    totalItems: number
    totalValue: number
    parsedItems: number
    approvedItems: number
  }
  requisitionIds?: string[]
  manualRequisitionIds?: string[]
  accountabilitySummary?: AccountabilitySummary
  facilityBranding?: FacilityBranding
  facilityConfigurationId?: string
  tags?: string[]
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
  version: number
  isDeleted: boolean
  deletedAt?: Timestamp
  deletedBy?: string
}
```

### 3.8 MatFlow — `organizations/default/allocation_groups/{id}`

```ts
AllocationGroup {
  id: string
  groupNumber: string
  date: Timestamp
  vendorName: string
  totalAmount: number
  currency: 'UGX' | 'USD'
  status: 'Draft' | 'Finalized'             // PascalCase
  allocations: AllocationEntry[]
  projectIds: string[]                      // denormalized for array-contains
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
}

AllocationEntry {
  projectId: string
  projectName: string
  amount: number
  percentage?: number
  notes?: string
}
```

### 3.9 MatFlow — BOQ — `advisoryPlatform/matflow/boqs/{id}`

**File:** `src/subsidiaries/advisory/core/project/types/boq.types.ts`

```ts
BOQDocumentStatus = 'draft' | 'pending_review' | 'approved' | 'superseded' | 'archived'
BOQSource = 'manual' | 'excel_import' | 'ai_parsed' | 'template' | 'variation'
ParsingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'review_required'
BOQCategory = 'preliminaries' | 'substructure' | 'superstructure' | 'finishes'
            | 'services' | 'external_works' | 'provisional' | 'contingency'
            | 'professional_fees' | 'other'

BOQMoney { amount: number; currency: string }

BOQItem {
  id: string
  boqId: string
  sectionId: string
  itemNumber: string
  description: string
  specification?: string
  quantity: number
  unit: string
  laborRate: BOQMoney
  materialRate: BOQMoney
  equipmentRate?: BOQMoney
  unitRate: BOQMoney
  laborAmount: BOQMoney
  materialAmount: BOQMoney
  equipmentAmount?: BOQMoney
  totalAmount: BOQMoney
  category: BOQCategory
  workType?: string
  tradeCode?: string
  aiExtracted?: boolean
  aiConfidence?: number
  aiSuggestions?: string[]
  linkedMaterialId?: string
  linkedMaterialName?: string
  procuredQuantity: number
  deliveredQuantity: number
  installedQuantity: number
  order: number
}

BOQSection {
  id: string
  boqId: string
  code: string
  name: string
  description?: string
  order: number
  parentSectionId?: string
  level: number
  items: BOQItem[]                           // EMBEDDED
  subtotal: BOQMoney
}

BOQDocument {
  id: string
  projectId: string
  projectName: string
  engagementId: string
  programId?: string
  name: string
  description?: string
  version: number
  status: BOQDocumentStatus
  source: BOQSource
  sourceFileUrl?: string
  sourceFileName?: string
  parsingStatus: ParsingStatus
  parsingResults?: {
    startedAt: Timestamp
    completedAt?: Timestamp
    model: string
    confidence: number
    itemsExtracted: number
    warnings: string[]
    errors: string[]
  }
  summary: {
    totalItems: number
    totalSections: number
    totalAmount: BOQMoney
    laborAmount: BOQMoney
    materialAmount: BOQMoney
    equipmentAmount: BOQMoney
    currency: string
  }
  sections: BOQSection[]                    // EMBEDDED — whole tree in one doc
  approval?: {
    status: 'pending' | 'approved' | 'rejected'
    approvedBy?: string
    approvedAt?: Timestamp
    notes?: string
  }
  audit: {
    createdAt: Timestamp
    createdBy: string
    updatedAt: Timestamp
    updatedBy: string
    version: number
  }
}
```

`BOQVariation` and `BOQTemplate` shapes also exist in the same file — see the file for exact fields if/when the iOS team needs them.

### 3.10 Advisory core — `engagements/{id}` and children

**File:** `src/subsidiaries/advisory/core/types/engagement.ts` (plus sibling files in that types/ folder)

```ts
Engagement {
  id: string
  name: string
  description?: string
  clientId: string
  funderId?: string
  startDate: Timestamp
  endDate?: Timestamp
  status: string
  totalBudget: number
  currency: string
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
}

// engagements/{id}/fundingSources/{fsId}
FundingSource {
  id: string
  funderId: string
  funderName: string
  amount: number
  currency: string
  disbursementSchedule?: string[]
  status: string
  createdAt: Timestamp
}

// engagements/{id}/fundingSources/{fsId}/disbursements/{id}
Disbursement {
  id: string
  amount: number
  date: Timestamp
  status: string
  notes?: string
  createdAt: Timestamp
}

// engagements/{id}/reportingRequirements/{id}
ReportingRequirement {
  id: string
  name: string
  dueDate: Timestamp
  frequency?: string
  status: string
}

// engagements/{id}/reportSubmissions/{id}
ReportSubmission {
  id: string
  reportType: string
  submissionDate: Timestamp
  status: string
  documentUrl?: string
}

// engagements/{id}/covenants/{id}
Covenant {
  id: string
  description: string
  dueDate?: Timestamp
  status: string
}

// engagements/{id}/covenants/{covId}/measurements/{id}
CovenantMeasurement {
  id: string
  measurementDate: Timestamp
  value: number | string
  status: string
  notes?: string
}

// engagements/{id}/approvalRequests/{id}
ApprovalRequest {
  id: string
  description: string
  requestedBy: string
  requestedAt: Timestamp
  approvedBy?: string
  approvedAt?: Timestamp
  status: 'pending' | 'approved' | 'rejected'
}
```

`clients/{id}`, `clients/{id}/contacts/{id}`, and `funders/{id}` follow similar simple master shapes — see the matching files in `src/subsidiaries/advisory/core/types/`.

### 3.11 Strategy — `strategy_documents/{id}` + subcollections

**File:** `src/modules/strategy/types/strategy.types.ts`

```ts
StrategyDocument {
  id: string
  companyId: string
  title: string
  subtitle?: string
  description?: string
  type: string
  status: 'draft' | 'in_review' | 'approved' | 'active' | 'superseded' | 'archived'
  scope: 'group' | 'subsidiary' | 'department' | 'team'
  timeHorizon: 'short_term' | 'medium_term' | 'long_term' | 'vision'
  fiscalYear?: string
  quarter?: number
  approvalLevel?: string
  approvedBy?: string
  approvedAt?: Timestamp
  reviewFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'annual'
  nextReviewDate?: Timestamp
  pillars: StrategicPillar[]
  content?: StrategyDocumentContent
  tags?: string[]
  createdAt: Timestamp
  createdBy: string
  updatedAt: Timestamp
  updatedBy: string
  version: number
}

StrategicPillar {
  id: string
  name: string
  description?: string
  weight: number                    // 0-100 (weighted sum)
  order: number
  objectives: StrategicObjective[]
  metrics?: PillarMetric[]
  owner?: string
  ownerName?: string
  status: 'not_started' | 'on_track' | 'at_risk' | 'behind'
  progress: number                  // 0-100
}

StrategicObjective {
  id: string
  title: string
  description?: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'not_started' | 'in_progress' | 'completed' | 'deferred' | 'cancelled'
  progress: number
  linkedOKRIds?: string[]
  linkedKPIIds?: string[]
  assigneeName?: string
  assigneeId?: string
  dueDate?: Timestamp
  metrics?: PillarMetric[]
}

PillarMetric {
  id: string
  name: string
  targetValue: number | string
  currentValue?: number | string
  baselineValue?: number | string
  direction: 'up' | 'down'
  unit?: string
  lastUpdated?: Timestamp
}

StrategyDocumentContent {
  summary?: string
  vision?: string
  mission?: string
  values?: string[]
  context?: string
  assumptions?: string[]
  risks?: StrategyRisk[]
  dependencies?: string[]
  successCriteria?: string[]
}

StrategyRisk {
  id: string
  description: string
  likelihood: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  mitigation?: string
  status: 'identified' | 'mitigating' | 'mitigated' | 'materialized'
}
```

**Strategy review subcollections** (file: `src/modules/strategy/types/documentSection.types.ts`):

```ts
// strategy_documents/{docId}/document_sections/{id}
DocumentSection {
  id: string
  sectionType: 'financial' | 'market' | 'operations' | 'growth'
             | 'risk' | 'people' | 'governance' | 'general'
  sectionIndex: number
  headingText: string
  headingLevel: number
  parentSectionId?: string
  content: string
  contentHash: string
  alignmentScore?: number                    // 1-5
  lastAssessedAt?: Timestamp
  pendingRewrite?: string
  rewriteStatus: 'none' | 'pending_review' | 'approved' | 'rejected' | 'applied'
  googleDocRange?: { startIndex: number; endIndex: number }
  createdAt: Timestamp
  updatedAt: Timestamp
  version: number
}

// strategy_documents/{docId}/section_audit_log/{id}   (immutable)
SectionAuditEntry {
  id: string
  sectionId: string
  changeType: 'rewrite' | 'minor_edit' | 'assessment_only'
            | 'manual_edit' | 'new_section' | 'removed'
  beforeHash?: string
  afterHash?: string
  dataSnapshot?: Record<string, unknown>
  changedBy: string
  changedAt: Timestamp
  changeDescription?: string
}
```

### 3.12 AI Memory — `ai_memory/{id}` and `ai_conversations/{id}`

**File:** `src/shared/services/ai/aiMemory.types.ts`

```ts
MemoryCategory = 'business_fact' | 'user_preference' | 'project_insight'
               | 'customer_intel' | 'process_knowledge' | 'decision_record'
               | 'market_intel' | 'financial_insight'
MemoryImportance = 'critical' | 'high' | 'medium' | 'low'

AIMemoryEntry {
  id: string
  category: MemoryCategory
  content: string
  summary?: string
  tags: string[]
  importance: MemoryImportance
  source: {
    type: 'conversation' | 'document' | 'manual' | 'ai_extracted'
    refId?: string
    module?: string
    extractedFrom?: string
  }
  companyId: string
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
  accessCount: number
  lastAccessedAt: Timestamp
  expiresAt?: Timestamp
  isArchived: boolean
  relatedEntityIds?: string[]
  embedding?: number[]                      // Gemini embedding for semantic search
}

AIConversation {
  id: string
  userId: string
  companyId: string
  module: 'assistant' | 'strategy_research' | 'strategy_review'
        | 'design_enhancement' | 'project_scoping' | 'image_analysis'
        | 'advisory' | 'customer_intel'
  mode?: string
  title: string
  messages: ConversationMessage[]           // EMBEDDED
  context?: Record<string, unknown>
  memoryExtractionDone: boolean
  projectId?: string
  designItemId?: string
  customerId?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  lastMessageAt: Timestamp
  messageCount: number
  isArchived: boolean
}

ConversationMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  mode?: string
  sources?: Array<{ url: string; title: string; domain?: string }>
  metadata?: Record<string, unknown>
  timestamp: Timestamp
}
```

### 3.13 Design Manager — `designProjects/{id}`

Detailed types live in `src/subsidiaries/finishes/design-manager/types/`:
- `index.ts` — re-exports (`RAGStatus`, `DesignStage`, `DesignItem`, `DesignProject`)
- `design-item.ts` — `DesignItem` (the per-item record under `designProjects/{id}/designItems/{id}`)
- `approvals.ts` — `Approval` workflow record
- `deliverables.ts` — `Deliverable` spec

The iOS team should **read these four files directly** when implementing the DesignManager feature. Every `DesignItem` record has a `stageHistory` subcollection that must be treated as append-only.

### 3.14 Other modules — file pointers

For the remaining modules, use these files as the ground truth:

| Area | File |
|---|---|
| Design Studio / Configurator | `src/subsidiaries/finishes/design-studio/types/index.ts`, `.../product.ts`, `.../configurator.ts` |
| Cutlist / BOM | `src/subsidiaries/finishes/cutlist/types/index.ts`, `.../bom.ts`, `.../layout.ts` |
| Feature Library | `src/subsidiaries/finishes/feature-library/types.ts` |
| Launch Pipeline | `src/subsidiaries/finishes/launch-pipeline/types/index.ts` |
| Customers | `src/subsidiaries/finishes/customers/types/index.ts` |
| Assets | `src/subsidiaries/finishes/assets/types.ts` |
| Advisory Delivery | `src/subsidiaries/advisory/delivery/types/index.ts`, `.../reports/types/index.ts` |
| Advisory Investment | `src/subsidiaries/advisory/investment/types/index.ts` |
| Advisory MatFlow Formula | `src/subsidiaries/advisory/matflow/types/formula.ts`, `.../boq.ts`, `.../costing.ts` |
| Shared core | `src/shared/types/index.ts`, `.../common.ts`, `.../project.ts`, `.../offcut.ts`, `.../assets.ts` |

---

## 4. Security rules & tenancy (iOS implications)

`firestore.rules` (868 lines) enforces:

- `isAuthenticated()` — `request.auth != null`
- `isAdmin()` — super-user email **or** `users/{uid}.globalRole` ∈ `['admin','owner']`. Also checks legacy `organizations/default/users/{uid}`.
- `isProjectMember(projectId)` — true if user is `createdBy`, `assignedDesigner`, `assignedEngineer`, or admin on `designProjects/{projectId}`.

Rules enforce immutable audit trails on: `stageHistory`, `section_audit_log`, `costHistory`, `assetStatusChanges`, `stockLevels/{id}/movements`, `productVariants/{id}/stockTransactions`. iOS **must not attempt to update or delete** documents in these subcollections — always append.

Self-approval is blocked on POs: the approver must differ from the creator.

Most sensitive writes (integrations, financial records, deletes) are admin-only. The iOS app should surface a clear "admin required" state for these operations rather than silently fail.

---

## 5. Recommended iOS data-layer shape

1. **Single `FirestorePaths` enum** with cases for flat, org-scoped, and company-scoped collections. Never hardcode path strings in features.
2. **Codable models** one-per-document-type, matching the TypeScript interfaces above. Use `@DocumentID` for `id` and `@ServerTimestamp` for `createdAt`/`updatedAt`.
3. **Repository protocol** per module (e.g. `InventoryRepository`, `PurchaseOrderRepository`) with `fetch`, `fetchList`, `listen`, `save`, `update`. Implement with Firestore snapshots backed by Combine `AnyPublisher` or async `AsyncSequence`.
4. **Counter helper** for `counters/{counterId}` PO/MO/ADJ number generation — must use a Firestore transaction (see web implementation for exact pattern).
5. **Role-aware UI** — fetch `users/{uid}` on sign-in and cache `globalRole`; gate admin-only features client-side (server still enforces).
6. **Offline-first by default** — Firestore iOS SDK has persistence on by default. Do not disable.
7. **Do not reproduce the MCP types**; always read from the web TypeScript files in `src/`.

---

## 6. Critical files to read (in priority order)

1. `src/modules/inventory/types/inventory.ts` — most-used shape
2. `src/modules/inventory/types/finishLibrary.ts`
3. `src/subsidiaries/advisory/core/project/types/project.types.ts`
4. `src/subsidiaries/advisory/core/project/types/boq.types.ts`
5. `src/subsidiaries/advisory/core/types/engagement.ts` (and siblings in that folder)
6. `src/modules/strategy/types/strategy.types.ts` and `documentSection.types.ts`
7. `src/shared/services/ai/aiMemory.types.ts`
8. `src/subsidiaries/finishes/design-manager/types/*`
9. `src/shared/services/firebase/firestore.ts` — the canonical data-access pattern
10. `firestore.rules` — final word on what iOS is allowed to write

---

## 7. Verification plan (once iOS scaffolding exists)

1. Sign in to Firebase with a test Google account using the iOS SDK; confirm `users/{uid}` doc is fetched and `globalRole` is readable.
2. Read a single known `inventoryItems/{id}` document, decode into the Swift model, and assert that `pricing.costPerUnit` and `inventory.inStock` round-trip correctly (nested objects — easy to get wrong).
3. Run a `whereField("familyId", isEqualTo:)` + `whereField("status", isEqualTo: "active")` query to confirm the composite index path works.
4. Call a harmless `onCall` function (e.g. `auditInventoryHealth` in dry-run mode) to confirm Functions wiring.
5. Open a `manufacturingOrders/{id}` and read the three subcollections (`bomEntries`, `materialConsumptions`, `stageTransitions`) separately — iOS must **not** expect them embedded.
6. Fetch an `organizations/default/advisory_projects/{id}` Project and confirm the deeply-nested `budget`, `progress`, `timeline`, `accountabilitySummary` all decode.
7. Attempt to write to `stockLevels/{id}/movements/{id}` via update — it **must** be rejected by rules (confirms audit-immutability is enforced).
8. On a test BOQ document, confirm the full `sections: BOQSection[]` tree decodes from a single document read.
