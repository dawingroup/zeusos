# Advisory Treasury & Accountability Enhancements — TODO

## Phase 0: Codebase Audit (COMPLETE)
- [x] Read `routes.tsx` — 61 routes mapped
- [x] Read `requisition-service.ts` — singleton pattern, hierarchy, balance recalc
- [x] Read `program-service.ts` — budget management, disbursement tracking
- [x] Read `AccountabilityFormEnhanced` — full form with variance, proof-of-spend, DPI
- [x] Read project types — Project entity with budget, accountability, progress
- [x] Read `types/` — cataloged all type definitions
- [x] Read `components/accountability/` — 8 components (metrics, aging, reconciliation, docs)
- [x] Identify PDF generation — jsPDF in image-to-pdf-service, Google Docs API in reports/
- [x] Identify document upload — Firebase Storage ref/uploadBytes/getDownloadURL
- [x] Identify currency formatting — `formatBudgetAmount` in project-budget.ts
- [x] Identify disbursement tracking — program-service budget operations
- [x] Identify number generation — Firestore transaction counters (receipt_sequences)
- [x] Identify DeliveryLayout — components/DeliveryLayout.tsx with ModuleTabNav

## Phase 1: Quick Capture + Document Attachment (COMPLETE)
- [x] 1.1 Extend Accountability type with quick capture fields
- [x] 1.2 Add isRetroactive to Requisition type
- [x] 1.3 Create quick-capture.schema.ts
- [x] 1.4 Create QuickCaptureIndex type
- [x] 1.5 Create quick-capture-service.ts
- [x] 1.6 Create document-capture-service.ts
- [x] 1.7 Create QuickCaptureFAB.tsx
- [x] 1.8 Create QuickCaptureForm.tsx (mobile-first with AI receipt extraction)
- [x] 1.9 Create QuickCapturesInbox.tsx (countdown timers)
- [x] 1.10 Create RequisitionLinker.tsx
- [x] 1.11 Create useQuickCapture.ts hooks
- [x] 1.12 Create QuickCapturesPage.tsx
- [x] 1.13 Register routes in routes.tsx
- [x] 1.14 Add Quick Captures to DeliveryLayout sidebar
- [x] 1.15 Add QuickCaptureFAB to DeliveryLayout
- [x] 1.16 Create quick_capture_index collection
- [x] 1.17 Add Firestore composite indexes
- [x] Additional: Gemini Vision AI document scanning with corner detection
- [x] Additional: Adaptive scan enhancement (shadow removal, white balance, sharpening)
- [x] Additional: Image-to-PDF conversion with perspective correction
- [x] Additional: AI receipt field extraction (Gemini Flash)

## Phase 2: Multi-Project Allocation (COMPLETE)
### Types & Schemas
- [x] 2.1 Create `types/allocation.ts` — AllocationGroup, AllocationEntry, AllocationSplitRow, AllocationSuggestion
- [x] 2.2 Create `schemas/allocation.schema.ts` — Zod validation with sum checks

### Services
- [x] 2.3 Create `services/allocation-service.ts` — Singleton, batch writes, sequential numbering

### Components
- [x] 2.4 Create `components/allocation/AllocationSplitter.tsx` — Reusable multi-project split UI
- [x] 2.5 Create `components/allocation/AllocationMemoPreview.tsx` — Styled card with table
- [x] 2.6 Integrate AllocationSplitter into QuickCaptureForm (Single/Split toggle)
- [x] 2.7 Integrate AllocationSplitter into AccountabilityFormEnhanced (toggle)
- [x] 2.8 Create `components/allocation/AllocationBadge.tsx` — Inline badge for list items
- [x] 2.9 Create `components/allocation/AllocationGroupDetail.tsx` — Full-page detail view

### Cloud Functions
- [x] 2.10 Create `functions/src/advisory/generateAllocationMemo.js` — HTML memo generation
- [x] 2.11 Register function in Cloud Functions index

### Hooks
- [x] 2.12 Create `hooks/useAllocation.ts` — 6 hooks (create, get, list, vendor history, void, generate memo)

### Routes
- [x] 2.13 Add `allocations/:groupId` route + AllocationGroupDetailPage

### Firestore
- [x] 2.14 Add Firestore composite indexes (organizationId+createdAt, vendorName+createdAt)

## Phase 3: Receipt Scanning & OCR (PENDING)
- [ ] 3.1 Create `types/ocr.types.ts`
- [ ] 3.2 Create Cloud Function `processReceiptOCR.ts`
- [ ] 3.3-3.6 Implement extraction logic (general, mobile money, EFRIS)
- [ ] 3.7 Create `services/ocr-service.ts`
- [ ] 3.8 Create `components/ocr/ReceiptScanner.tsx`
- [ ] 3.9 Create `components/ocr/OCRResultReview.tsx`
- [ ] 3.10 Integrate into QuickCaptureForm and AccountabilityFormEnhanced
- [ ] 3.11 Create `hooks/useReceiptOCR.ts`

## Phase 4: AMH Accountability Report Generator (PENDING)
- [ ] 4.1 Create `types/amh-report.types.ts`
- [ ] 4.2 Create `services/amh-report-service.ts`
- [ ] 4.3 Create Cloud Function `generateAMHReport.ts`
- [ ] 4.4 Create HTML template (8 sections)
- [ ] 4.5 Create `components/reports/AMHReportWizard.tsx`
- [ ] 4.6 Register routes and add to ReportsPage
- [ ] 4.7 Create admin data reconciliation page
- [ ] 4.8 Add Firestore indexes

## Audit Notes
- **Accountability type location:** `src/subsidiaries/advisory/delivery/types/accountability.ts`
- **Accountability collection path:** `payments/{accountabilityId}` (paymentType: 'accountability')
- **Requisition type location:** `src/subsidiaries/advisory/delivery/types/requisition.ts`
- **PDF generation:** jsPDF in `image-to-pdf-service.ts`, Google Docs API in `reports/services/`
- **Firebase Storage upload:** Dynamic `ref()` + `uploadBytes()` + `getDownloadURL()`
- **Currency formatter:** `formatBudgetAmount(amount, currency)` in `types/project-budget.ts`
- **Budget Management disbursement:** `program-service.ts` budget operations on `advisory_programs`
- **Number generation:** Firestore transaction counter at `receipt_sequences/{projectCode}-{year}`
- **Batch write pattern:** `writeBatch(db)` in `program-service.ts` (cascading deletes)
- **Singleton pattern:** Private constructor + `static getInstance(db)` + factory export
- **DeliveryLayout:** `components/DeliveryLayout.tsx` with ModuleTabNav (11 tabs)
- **Report templates:** Stored in `organizations/{orgId}/report_templates`
- **Generated reports:** Stored in `organizations/{orgId}/generated_reports`
- **Cloud Functions secrets:** `defineSecret()` from `firebase-functions/params`
- **Unified payments collection:** All types (requisition, accountability, IPC) in `payments`
- **ID format:** `item-${Date.now()}-${index}`, sequential: `REQ-{code}-{NNN}`
- **No centralized formatCurrency** — `formatBudgetAmount` in project-budget.ts is closest
