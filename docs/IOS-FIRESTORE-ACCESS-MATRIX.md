# DawinOS iOS — Firestore Security Rules Access Matrix

> Extracted from `firestore.rules` (3,404 lines). This is a digest for the iOS team showing **what each user role can do** so you can build correct guards in the app.

---

## 1. Authentication & Role System

### Auth methods (iOS must support)
- **Google OAuth** — primary sign-in (`GIDSignIn` + `Auth.auth().signIn(with:)`)
- **Anonymous auth** — used by public portals only (CD Portal, Client Portal). Not needed in main iOS app.

### How roles are resolved

The rules use **multiple overlapping helper functions**. iOS must understand all of them:

```
isAuthenticated()     → request.auth != null
isAdmin()             → super-user email OR users/{uid}.globalRole in ['admin','owner']
                        OR organizations/default/users/{uid}.globalRole in ['admin','owner']
isExecutive()         → custom claims: role in ['platform_admin','ceo','executive','director']
isHR()                → custom claims: role in ['platform_admin','hr_admin','hr_manager']
isFinance()           → custom claims: role in ['platform_admin','finance_admin','finance_manager','accountant']
isPlatformAdmin()     → users/{uid}.platformRole in ['super_admin','admin']
isPlatformStaff()     → users/{uid}.platformRole in ['super_admin','admin','manager','staff']
isProjectMember(id)   → designProjects/{id}.createdBy/assignedDesigner/assignedEngineer matches uid/email
isOrgMember(orgId)    → users/{uid}.organizationId == orgId
canReadEngagement(id) → isPlatformAdmin() OR user has any role in engagement
canWriteEngagement(id)→ isPlatformAdmin() OR user has write-capable engagement role
```

**iOS action items:**
1. On sign-in, fetch `users/{uid}` and cache: `globalRole`, `platformRole`, `organizationId`, `engagementRoles`, `clientAssociations`, `funderAssociations`
2. Build a `UserPermissions` model that answers `canRead(collection:)`, `canWrite(collection:)` using these fields
3. Note: some roles use custom claims (`request.auth.token.role`) — these are set by Cloud Functions, not by client writes

---

## 2. Access Patterns by Category

### A. Open to all authenticated users (read + write)

Most operational collections fall here. If the user is signed in, they can read and create/update. Only delete is restricted (usually admin-only).

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| `inventoryItems/{id}` | auth | auth | auth | auth |
| `finishLibrary/{id}` | auth | auth | auth | auth |
| `stock_adjustments/{id}` | auth | auth | auth | **never** |
| `stockLevels/{id}` | auth | auth | auth | admin |
| `warehouses/{id}` | auth | auth | auth | admin |
| `counters/{id}` | auth | auth | auth | auth |
| `customers/{id}` (+ subcollections) | auth | auth | auth | auth |
| `contacts/{id}` | auth | auth | auth | auth |
| `designProjects/{id}` | auth | auth | auth | projectMember/admin |
| `projectFiles/{id}` | auth | auth | auth | auth |
| `crmDeals/{id}` | auth | auth | auth | admin |
| `crmActivities/{id}` | auth | auth | auth | admin |
| `crmTasks/{id}` | auth | auth | auth | auth |
| `assets/{id}` | auth | auth | auth | admin |
| `features/{id}` | auth | auth | auth | admin |
| `manufacturingOrders/{id}` | auth | auth | auth | admin |
| `productDefinitions/{id}` | auth | auth | auth | admin |
| `salesOrders/{id}` | auth | auth | auth | admin |
| `deals/{id}` | auth | auth | auth | admin |
| `employees/{id}` | auth | auth | auth | admin |
| `offcuts/{id}` | auth | auth | auth | auth |
| `productVariants/{id}` | auth | auth | auth | auth |

### B. Special write restrictions

| Collection | Special rule |
|---|---|
| `purchaseOrders/{id}` | **Self-approval blocked**: if status is changing from `pending-approval` → `approved`, the approver's UID must differ from `createdBy` |
| `designProjects/{id}/designItems/*` | Write requires `isProjectMember(projectId)` |
| `designProjects/{id}/materials/*` | Write requires `isProjectMember(projectId)` |
| `designProjects/{id}/clientDocuments/*` | Write requires `isProjectMember(projectId)` |
| `designProjects/{id}/aiAnalyses/*` | Update only by the original requester |
| `designProjects/{id}/designItems/*/approvals/*` | Update only by `assignedTo` user |
| `designClips/{id}` | Create/update/delete only by `createdBy` |
| `aiChats/{id}` | Update: own chat or project-linked; Delete: own only |
| `payments/{id}` | Update: creator (drafts only) OR finance/project roles |
| `discountPolicies/{id}` | Admin only (read/write) |

### C. Immutable audit collections (append-only)

These subcollections **cannot be updated or deleted** by any client. iOS must only ever `addDocument()` — never `updateDocument()` or `deleteDocument()`.

| Path | Notes |
|---|---|
| `stockLevels/{id}/movements/{id}` | `update, delete: if false` |
| `costHistory/{id}` | `update, delete: if false` |
| `productVariants/{id}/stockTransactions/{id}` | `update, delete: if false` (ledger) |
| `designProjects/{pid}/designItems/{iid}/stageHistory/{id}` | `update, delete: if false` |
| `companies/{cid}/strategy_reviews/{rid}/section_audit_log/{id}` | Only `create` allowed |
| `engagements/{eid}/activityLog/{id}` | `create: if false` (Cloud Functions only), `update, delete: if false` |
| `organizations/{oid}/advisory_projects/{pid}/activityLog/{id}` | `update, delete: if false` |
| `organizations/{oid}/advisory_programs/{pid}/activityLog/{id}` | `update, delete: if false` |
| `clientQuotes/{qid}/activity/{id}` | `update, delete: if false` |
| `deals/{did}/activities/{id}` | `update, delete: if false` |
| `employees/{eid}/audit/{id}` | `update, delete: if false` |
| `organizations/{oid}/auditLog/{id}` | `update, delete: if false` |
| `audit_logs/{id}` | `update, delete: if false`, read: admin only |
| `intelligenceActivity/{id}` | `update: if false` |
| `aiModelUsage/{id}` | `update, delete: if false` |

### D. Cloud Functions-only write (client cannot write)

| Collection | Notes |
|---|---|
| `productAudits/{id}` | `write: if false` — only Admin SDK |
| `rateLimits/{id}` | `write: if false` — only Admin SDK |
| `campaignAnalytics/{id}` | `write: if false` — only Admin SDK |
| `productionReports/{id}` | `create, update: if false` — only Admin SDK |
| `whatsappBroadcasts/{bid}/recipients/{phone}` | `create, update: if false` |
| `engagements/{eid}/activityLog/{id}` | `create: if false` — Cloud Functions only |

iOS should show these collections as **read-only** — no create/edit UI.

### E. Role-gated collections

| Collection | Read gate | Write gate |
|---|---|---|
| `engagements/{id}` | `canReadEngagement` (team member or admin) | Create: admin/manager; Update: engagement leadership; Delete: super_admin only |
| `engagements/{id}/fundingSources/*` | engagement team | `canWriteEngagement` + required fields validation |
| `engagements/{id}/covenants/*` | engagement team | management or compliance/finance officer |
| `funders/{id}` | platform staff or associated funder | Create/update: platform admin only; Delete: super_admin |
| `executive/strategy/*` | `isExecutive()` | `isExecutive()` |
| `executive/capital/*` | `isExecutive()` | `isExecutive()` |
| `hr/employees/{id}` | admin, HR, or self | Create: HR; Update: HR or self (limited fields) |
| `hr/payroll_batches/*` | HR, finance, admin | Write: HR only; **Delete: never** |
| `hr/leave_requests/{id}` | admin, HR, or self | Create: self only; Update: HR |
| `financial_reports/{id}` | finance, executive, admin | Write: finance only |
| `strategy_documents/{id}` | auth | Create: executive/strategy_manager; Update: executive/strategy_manager/creator |
| `shared_ops/smart_tasks/{id}` | admin, assignee, creator, delegator | Create: auth; Update: admin/assignee/creator |
| `shared_ops/finance_batches/*` | `isFinance()` | `isFinance()` |
| `shared_ops/grey_areas/{id}` | admin, executive, HR, assignee | Create: auth; Update: admin/HR/assignee |
| `integrations/{id}` | auth | **Admin only** — contains OAuth tokens |

### F. Public read (no auth required)

These collections allow `get` or `read` without authentication — for portal access:

| Collection | Public access | Notes |
|---|---|---|
| `clientQuotes/{id}` | `get` if `accessToken != null` | Token-based client portal |
| `clientPortalTokens/{token}` | `get: if true` | Token resolution |
| `designSignOffs/{id}` | `get: if true`, `update: if true` | Client approval portal |
| `clientPortalShares/{id}` | `read: if true` | Shared portal links |
| `quoteComparisonGroups/{id}` | `read: if true` | Quote comparison |
| `organizations/{oid}/advisory_projects/{pid}` | `read: if true` | CD Portal |
| `organizations/{oid}/advisory_programs/{pid}` | `read: if true` | CD Portal |
| `programs/{pid}` | `read: if true` | CD Portal |
| `manual_requisitions/{id}` | `get: if true` (not list) | CD Portal, requires knowing doc ID |
| `funds_acknowledgements/{id}` | `get: if true` (not list) | CD Portal |
| `portal_access_tokens/{id}` | `get: if true` (not list) | Token resolution |

**iOS implication:** If building portal features in the iOS app, these can be accessed without sign-in. Otherwise, ignore.

### G. Company-scoped collections (`companies/{companyId}/...`)

All follow the same pattern:
- **Read:** `isAuthenticated()`
- **Create/Update:** `isAuthenticated()`
- **Delete:** `isAdmin()`

This applies to: `strategy_reviews`, `business_pivots`, `financial_reports`, `qbo_*`, `fathom_*`, `reconciliation_*`, `finance_documents`, `tax_portal_links`, `forecasts` (+ subcollections), `budgets`, `budgetLines`, `cashflow_projections`, `expenditure_queue`, `spend_plans`, `savings_ledger`, `liability_register`, `optimizer_*`, `projected_receipts`, `client_payment_profiles`, `cfo_briefings`, `scenario_results`, `notifications`, `capital_*`

**Exception:** `forecasts/{id}/value_rules/{id}` and micro-forecast subcollections allow authenticated delete (not admin-only).

### H. Organization-scoped collections (`organizations/{orgId}/...`)

| Path | Read | Write | Delete |
|---|---|---|---|
| `organizations/{oid}` | auth | admin | admin |
| `organizations/{oid}/settings/{id}` | auth | admin or org member | admin or org member |
| `organizations/{oid}/users/{uid}` | auth | Create/delete: admin; Update: admin or self (limited fields) | admin |
| `organizations/{oid}/advisory_projects/{pid}` | **public** | Create: auth (createdBy=uid); Update: auth | admin or creator |
| `organizations/{oid}/advisory_programs/{pid}` | **public** | auth | admin or creator |
| `organizations/{oid}/matflow_projects/{pid}` | auth | Create: auth (createdBy=uid); Update: auth | admin or creator |
| `organizations/{oid}/allocation_groups/{gid}` | auth | auth | admin |

---

## 3. Collection group queries

One explicit collection group rule exists:

```
match /{path=**}/designItems/{itemId} {
  allow read: if isAuthenticated();
}
```

This means iOS can use `Firestore.firestore().collectionGroup("designItems")` to query across all design projects.

---

## 4. iOS Implementation Checklist

1. **Build a `UserPermissions` service** that reads `users/{uid}` and caches `globalRole`, `platformRole`, `organizationId`, `engagementRoles`, custom claims
2. **Gate UI based on role** — hide admin-only features, show read-only for Cloud Functions-only collections
3. **Never attempt update/delete on immutable collections** (Section 2C) — always `addDocument()`
4. **Enforce PO self-approval block** in the UI — disable the "Approve" button when `currentUser.uid == po.createdBy`
5. **Include required fields** when creating `fundingSources` (`category`, `instrumentType`, `funderId`, `committedAmount`) and `disbursements` (`requestedAmount`, `description`) — rules validate these
6. **Handle permission denied gracefully** — show "Admin access required" or "You're not a member of this project" rather than generic errors
7. **For engagement reads**: if the user has no role in the engagement, the read will be denied. Don't fetch all engagements; query by role membership.
8. **Organization user self-update**: users can only update `displayName`, `phone`, `jobTitle`, `department`, `photoUrl`, `lastLoginAt`, `updatedAt` on their own org user doc — block other field edits in the UI

---

## 5. Files provided

| File | Location |
|---|---|
| Full rules source | `docs/firestore.rules` (copy of project root `firestore.rules`) |
| Architecture & field shapes | `docs/IOS-ARCHITECTURE-REFERENCE.md` |
| This access matrix | `docs/IOS-FIRESTORE-ACCESS-MATRIX.md` |
