# DawinOS MCP Server — Firestore Audit Notes

## Date: 2026-03-29

## Method
Audited via static analysis of the existing Cloud Functions tool handlers and TypeScript type definitions:
- `functions/src/tools/manufacturingTools.js` — confirmed by reading actual Firestore query code
- `functions/src/tools/inventoryTools.js` — confirmed field names used in queries/responses
- `functions/src/tools/supplierTools.js` — confirmed collection name
- `functions/src/triggers/stockAdjustment.triggers.js` — confirmed stock_adjustments + stockLevels
- `functions/src/triggers/finishTriggers.js` — confirmed finishLibrary
- `src/subsidiaries/advisory/core/project/types/project.types.ts` — canonical Project interface
- `src/subsidiaries/advisory/delivery/types/allocation.ts` — canonical AllocationGroup interface
- `src/subsidiaries/advisory/delivery/services/allocation-service.ts` — confirmed advisory paths
- `src/core/settings/settingsService.ts` — confirmed DEFAULT_ORG_ID = 'default'

Firebase auth expired during live Firestore audit; static analysis is sufficient given the direct query code references above.

---

## Collection Status

| Collection | Exists | Actual Name | Notes |
|-----------|--------|-------------|-------|
| purchaseOrders | ✅ | `purchaseOrders` | camelCase |
| manufacturing_orders | ✅ (wrong name) | `manufacturingOrders` | spec says snake_case; actual is camelCase |
| finishLibrary | ✅ | `finishLibrary` | |
| inventory_items | ✅ (wrong name) | `inventoryItems` | spec says snake_case; actual is camelCase |
| stock_adjustments | ✅ | `stock_adjustments` | snake_case — retained |
| stockLevels | ✅ | `stockLevels` | bonus collection not in spec |
| suppliers | ✅ | `suppliers` | also falls back to `vendors` in code |
| projectFunds | ❌ DOES NOT EXIST | — | advisory uses `organizations/default/advisory_projects` |
| expenditure_allocations | ❌ DOES NOT EXIST | — | advisory uses `organizations/default/allocation_groups` |

---

## Field Name Corrections

| Collection | Spec / Expected | Actual Field | Source |
|-----------|----------------|-------------|--------|
| `inventoryItems` | `stockQuantity` | `stockOnHand` | `inventoryTools.js:119` |
| `inventoryItems` | `availableQuantity` | *(not stored)* | computed client-side from stockLevels |
| `inventoryItems` | `unitCost` | `costPrice` | `inventoryTools.js:122` |
| `manufacturingOrders` | `productionStage` | `currentStage` | `manufacturingTools.js:105` |
| `manufacturingOrders` | `moNumber` | `data.moNumber \|\| data.orderNumber` | `manufacturingTools.js:120` |
| `purchaseOrders` | `grandTotal` | `total` | `manufacturingTools.js:242` |
| `purchaseOrders` | lineItems subcollection | embedded array `lineItems` on doc | `manufacturingTools.js:238` |

---

## Status Enum Values

| Collection | Status Field | Values | Format |
|-----------|-------------|--------|--------|
| `purchaseOrders` | `status` | `draft \| pending-approval \| approved \| sent \| partially-received \| received \| closed \| cancelled` | kebab-case |
| `manufacturingOrders` | `status` | `draft \| pending-approval \| approved \| in-progress \| on-hold \| completed \| cancelled` | kebab-case |
| `manufacturingOrders` | `currentStage` | `queued \| cutting \| assembly \| finishing \| qc \| ready` | lowercase |
| `inventoryItems` | `status` | `active \| discontinued \| out-of-stock` | kebab-case |
| `inventoryItems` | `category` | `sheet-goods \| solid-wood \| hardware \| edge-banding \| finishing \| adhesives \| fasteners \| other` | kebab-case |
| `advisory_projects` | `status` | `planning \| procurement \| mobilization \| active \| substantial_completion \| defects_liability \| completed \| suspended \| cancelled` | mixed |
| `allocation_groups` | `status` | `Draft \| Finalized` | PascalCase |

---

## Manufacturing Order Subcollections

| Spec Name | Actual Subcollection | Source |
|-----------|---------------------|--------|
| `bom` / `lineItems` | `bomEntries` | `manufacturingTools.js:151` |
| `materials` | `materialConsumptions` | `manufacturingTools.js:172` |
| `steps` / `transitions` | `stageTransitions` | `manufacturingTools.js:193` |

---

## Scoping / Multi-tenancy

**organizationId value:** `'default'` (NOT `'dawin-group'`)
- Source: `src/core/settings/settingsService.ts:33` — `const DEFAULT_ORG_ID = 'default'`
- Also confirmed in `src/subsidiaries/advisory/delivery/services/payment-service.ts:38` — `'organizations/default/advisory_projects'`

**Collections WITHOUT organizationId field (top-level, non-tenant-filtered):**
- `purchaseOrders` — queried directly, no `where('organizationId')` in existing tools
- `manufacturingOrders` — queried directly, no `where('organizationId')` in existing tools
- `inventoryItems` — queried directly, no `where('organizationId')` in existing tools
- `finishLibrary` — has `organizationId` field in type definition, but may be sparse
- `stock_adjustments` — no organizationId filter in existing triggers
- `stockLevels` — no organizationId filter in existing triggers
- `suppliers` — no organizationId filter in existing tools

**DECISION:** Do NOT apply `where('organizationId', '==', 'default')` to top-level collections. This mirrors the pattern used in existing `functions/src/tools/` code and avoids returning empty results.

**Advisory collections ARE path-scoped (no separate filter needed):**
- `organizations/default/advisory_projects/{projectId}`
- `organizations/default/allocation_groups/{groupId}`
- `organizations/default/advisory_programs/{programId}`

---

## Advisory Module Mapping

The spec Phase 5 refers to "donor-funded project funds" with `projectFunds` and `expenditure_allocations` collections. These do not exist. The actual advisory module collections:

| Spec Tool Purpose | Actual Collection | Path |
|-------------------|------------------|------|
| List project funds | Advisory projects | `organizations/default/advisory_projects` |
| Get project fund detail | Advisory project doc | Same path, single doc |
| List expenditure allocations | Allocation groups | `organizations/default/allocation_groups` |
| Accountability summary | Aggregate from advisory_projects | Uses `accountabilitySummary` embedded object |

**Key fields on advisory_projects:**
```
budget: { currency, totalBudget, spent, committed, remaining, variance }
progress: { physicalProgress, financialProgress, completionPercent, progressStatus }
accountabilitySummary: { totalDisbursed, totalAccounted, unaccountedAmount,
                          requisitionCount, accountabilityRate, overdueCount, status }
```

**Key fields on allocation_groups:**
```
groupNumber, date, vendorName, description, totalAmount, currency,
allocations: [{ projectId, projectName, programId, budgetCategory, percentage, allocatedAmount }],
projectIds: string[],  ← denormalized for array-contains queries
status: 'Draft' | 'Finalized',
memoUrl: string | null
```

---

## Schema Adjustments Required (applied in constants.ts and types.ts)

- [x] constants.ts: `MANUFACTURING_ORDERS = 'manufacturingOrders'` (was `manufacturing_orders`)
- [x] constants.ts: `INVENTORY_ITEMS = 'inventoryItems'` (was `inventory_items`)
- [x] constants.ts: remove `PROJECT_FUNDS`, `EXPENDITURE_ALLOCATIONS` — replaced with `ADVISORY_PATHS`
- [x] constants.ts: `DEFAULT_ORG_ID = 'default'` (was `'dawin-group'`)
- [x] types.ts: `InventoryItem.stockOnHand` (not `stockQuantity`)
- [x] types.ts: `InventoryItem.costPrice` (not `unitCost`)
- [x] types.ts: `ManufacturingOrder.currentStage` (not `productionStage`)
- [x] types.ts: `PurchaseOrder.lineItems` is embedded array (not subcollection)
- [x] types.ts: `PurchaseOrder.total` (not `grandTotal`)
- [x] types.ts: Replace `ProjectFund` + `ExpenditureAllocation` with `AdvisoryProject` + `AllocationGroup`
