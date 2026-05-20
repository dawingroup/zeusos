# DawinOS MCP Server — Build Progress

## Phase 0: Audit & Alignment
- [x] Audit existing DawinOS Firestore collections — verify collection names, field names, document structure
- [x] Audit existing Cloud Functions directory — confirm Gen 2 patterns, entry point, deployment config
- [x] Verify BaseEntity field names match live Firestore docs (check createdAt vs created_at, etc.)
- [x] Verify purchaseOrders collection — lineItems is embedded array (not subcollection); status values are kebab-case
- [x] Verify manufacturing_orders collection — ACTUAL name: `manufacturingOrders`; status kebab-case; stage field: `currentStage`
- [x] Verify finishLibrary collection — confirmed exists via finishTriggers.js
- [x] Verify inventory_items collection — ACTUAL name: `inventoryItems`; stock field: `stockOnHand`; cost field: `costPrice`
- [x] Verify projectFunds collection — DOES NOT EXIST — advisory uses `organizations/default/advisory_projects`
- [x] Verify expenditure_allocations — DOES NOT EXIST — advisory uses `organizations/default/allocation_groups`
- [x] Verify stock_adjustments collection — confirmed, snake_case; also `stockLevels` collection exists
- [x] Verify suppliers collection — confirmed at root level
- [x] Document any field name discrepancies in AUDIT_NOTES.md
- [x] Confirm organizationId value — ACTUAL: `'default'` (NOT 'dawin-group')
- [x] Confirm subsidiaryId values — `'dawin-finishes'`, `'dawin-advisory'`, etc.

## Phase 1: Project Setup & Infrastructure
- [x] Initialize project: package.json, tsconfig.json, .gitignore
- [ ] Install dependencies: @modelcontextprotocol/sdk, firebase-admin, express, zod
- [ ] Create src/ directory structure (index.ts, handler.ts, types.ts, constants.ts, services/, tools/)
- [ ] Implement Firebase service (initializeFirebase, getDb, serializeDoc, formatters)
- [ ] Implement formatting helpers (formatTimestamp, formatCurrency, truncateIfNeeded)
- [ ] Create types.ts with all Firestore entity interfaces (aligned to Phase 0 audit findings)
- [ ] Create constants.ts with verified collection names (from Phase 0 audit)
- [ ] Implement handler.ts with createMcpHandler export (Cloud Function target)
- [ ] Implement main entry point (index.ts) with McpServer, dual transport (HTTP + stdio)
- [ ] Verify `npm run build` compiles without errors (produces dist/index.js AND dist/handler.js)
- [ ] Test stdio transport locally with MCP Inspector

## Phase 2: Purchasing & PO Tools (3 tools)
- [ ] dawinos_list_purchase_orders — list/filter by status, supplier, project, date
- [ ] dawinos_get_purchase_order — full PO with embedded lineItems array
- [ ] dawinos_po_spend_analysis — aggregate spend by supplier/month/status
- [ ] Test all 3 tools against live Firestore with MCP Inspector
- [ ] ✅ GATE: All 3 tools return correct data for at least 2 real POs

## Phase 3: Manufacturing Tools (3 tools)
- [ ] dawinos_list_manufacturing_orders — list/filter by status, stage, priority, project
- [ ] dawinos_get_manufacturing_order — full MO details with bomEntries, materialConsumptions, stageTransitions
- [ ] dawinos_production_summary — dashboard: status/stage counts, overdue alerts
- [ ] Test all 3 tools against live Firestore
- [ ] ✅ GATE: Production summary returns accurate counts matching DawinOS UI

## Phase 4: Inventory & Finish Library Tools (4 tools)
- [ ] dawinos_search_inventory — search by name/SKU/category, low-stock filter (uses stockOnHand)
- [ ] dawinos_get_finish_library — browse/search finishes by category/availability
- [ ] dawinos_stock_levels — stock health from stockLevels collection
- [ ] dawinos_list_stock_adjustments — adjustment history with type/date filters
- [ ] Test all 4 tools against live Firestore
- [ ] ✅ GATE: Stock levels data correct

## Phase 5: Advisory Tools (4 tools)
- [ ] dawinos_list_project_funds → queries organizations/default/advisory_projects
- [ ] dawinos_get_project_fund → single advisory project with budget/progress/accountabilitySummary
- [ ] dawinos_project_expenditures → queries organizations/default/allocation_groups
- [ ] dawinos_accountability_summary → aggregate accountabilitySummary across projects
- [ ] Test all 4 tools against live Firestore
- [ ] ✅ GATE: Advisory summary data correct

## Phase 6: Deployment (Sibling directory + Cloud Function wrapper)
- [ ] Create `functions/src/mcp/dawinos-mcp.ts` — thin onRequest wrapper importing dist/handler.js
- [ ] Add `exports.dawinos_mcp` to `functions/index.js`
- [ ] Verify import path resolves correctly from functions build output
- [ ] Build: `cd dawinos-mcp-server && npm run build`
- [ ] Deploy: `firebase deploy --only functions:dawinos_mcp`
- [ ] Verify GET /dawinos_mcp returns {"status":"ok","tools":14}
- [ ] Verify POST /dawinos_mcp with tools/list returns 14 tools
- [ ] Test full tool call from Claude.ai MCP connection
- [ ] ✅ GATE: All 14 tools accessible from a Claude.ai conversation
