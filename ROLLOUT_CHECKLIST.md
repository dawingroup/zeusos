# Purchase Order Enhancement - Rollout Checklist

**Date Started**: 2026-02-07
**Target Completion**: 8-11 weeks from start
**Status**: 🟡 Pre-Deployment Preparation

---

## Pre-Deployment Checklist

### ✅ Phase 1: Code Review & Validation

- [x] Phase 1 implementation complete (PO delivery tracking)
- [x] Phase 2 implementation complete (Accountability integration)
- [x] Phase 3 implementation complete (Auto-PO generation)
- [x] UI components created (4 components)
- [x] Test suite created (44 tests)
- [x] Migration script created with dry-run mode
- [x] Documentation complete

**Action Items**:
- [ ] Code review by senior developer
- [ ] Security review (SQL injection, XSS, access control)
- [ ] Performance review (query optimization, indexing)

---

### 🔄 Phase 2: Local Testing (Current Phase)

**Prerequisites**:
```bash
# Install dependencies
npm install

# Start Firebase emulator
firebase emulators:start
```

#### Test 1: Type Checking
```bash
# Check for TypeScript errors
npx tsc --noEmit
```
**Expected**: No errors in new files
**Status**: ⏳ Pending

#### Test 2: Service Integration
```bash
# Test service methods manually
# Open Node REPL or create test script
```

**Manual Tests**:
1. Create test PO with delivery tracking fields
2. Link mock delivery to PO
3. Verify PO status updates
4. Test variance calculation
5. Test auto-PO generation with mock requisition

**Status**: ⏳ Pending

#### Test 3: Migration Dry Run
```bash
# Run migration in dry-run mode (safe - no writes)
npm run migrate:po-tracking

# Review output carefully
# Check for warnings or errors
```

**Expected Output**:
- Shows how many POs would be migrated
- Lists any POs that would be skipped
- No errors

**Status**: ⏳ Pending

#### Test 4: UI Component Rendering
```bash
# Start dev server
npm run dev

# Test each component:
# 1. Navigate to delivery recording page
# 2. Test PO picker in accountability form
# 3. Approve requisition to see auto-gen dialog
# 4. Check fulfillment dashboard
```

**Component Checklist**:
- [ ] DeliveryRecordingForm renders without errors
- [ ] POPickerForAccountability renders without errors
- [ ] AutoPOGenerationDialog renders without errors
- [ ] POFulfillmentDashboard renders without errors
- [ ] No console errors in browser
- [ ] Styling looks correct (Tailwind CSS applied)

**Status**: ⏳ Pending

---

### 🔄 Phase 3: Staging Deployment

#### Step 1: Backup Production Data
```bash
# Export Firestore data
gcloud config set project YOUR_PROJECT_ID
gcloud firestore export gs://your-backup-bucket/pre-po-enhancement-$(date +%Y%m%d)

# Verify backup exists
gsutil ls gs://your-backup-bucket/
```
**Status**: ⏳ Pending
**Backup Location**: `_________________________________`

#### Step 2: Deploy to Staging
```bash
# Build the project
npm run build

# Deploy to staging environment
firebase use staging  # or your staging project
npm run deploy:preview

# Verify deployment
curl https://staging-url.web.app/
```
**Status**: ⏳ Pending
**Staging URL**: `_________________________________`

#### Step 3: Run Migration on Staging
```bash
# Set to staging project
firebase use staging

# Run migration DRY RUN first
npm run migrate:po-tracking

# Review output, then run live migration
npm run migrate:po-tracking -- --live

# Verify migration results in Firestore console
```
**Status**: ⏳ Pending
**POs Migrated**: `_________`
**Errors**: `_________`

#### Step 4: Staging UAT (User Acceptance Testing)

**Test Users**:
1. Project Manager: `_________________________________`
2. Site Engineer: `_________________________________`
3. Accountant: `_________________________________`

**Test Scenarios**:

1. **Scenario: Record Delivery** ⏳
   - User: Site Engineer
   - Steps:
     1. Navigate to Procurement → Record Delivery
     2. Select PO-2026-001
     3. Select item "Cement - 50kg bags"
     4. Record delivery: 50 bags received, 0 rejected
     5. Submit
   - Expected:
     - Delivery recorded successfully
     - PO status updates to "partially_fulfilled"
     - Progress bar shows 50/100 (50%)
   - **Result**: `____ PASS / FAIL`

2. **Scenario: Link Expense to PO** ⏳
   - User: Accountant
   - Steps:
     1. Create accountability for cement purchase
     2. Add expense: 1,750,000 UGX for 50 bags
     3. Click "Link to PO"
     4. Select PO-2026-001, item "Cement"
   - Expected:
     - PO picker shows variance: 0% (exact match)
     - Green "Match" badge displayed
     - No investigation triggered
   - **Result**: `____ PASS / FAIL`

3. **Scenario: Variance Detection** ⏳
   - User: Accountant
   - Steps:
     1. Create accountability with 6% over PO amount
     2. Link to PO
   - Expected:
     - Red "Investigation Required" badge
     - Warning message displayed
     - Investigation created automatically
   - **Result**: `____ PASS / FAIL`

4. **Scenario: Auto-PO Generation** ⏳
   - User: Project Manager
   - Steps:
     1. Create requisition with 3 items
     2. Approve requisition
   - Expected:
     - Auto-generation dialog appears
     - Shows 1-2 POs generated (depending on suppliers)
     - Statistics correct
     - Can view generated POs
   - **Result**: `____ PASS / FAIL`

5. **Scenario: PO Fulfillment Dashboard** ⏳
   - User: Project Manager
   - Steps:
     1. Navigate to Procurement → PO Fulfillment
     2. View dashboard
     3. Expand a PO
     4. Click "Record Delivery"
   - Expected:
     - Statistics show correct totals
     - POs listed with progress bars
     - Expandable items show details
     - Record Delivery button works
   - **Result**: `____ PASS / FAIL`

**UAT Sign-Off**:
- [ ] All scenarios PASS
- [ ] No critical bugs found
- [ ] Performance acceptable (<2s page load)
- [ ] Mobile responsive (tested on tablet/phone)

**Sign-Off**: _________________ Date: _________

---

### 🔄 Phase 4: Production Rollout (Gradual)

#### Week 1-2: Preparation
- [ ] Schedule production deployment
- [ ] Notify users of upcoming changes
- [ ] Create rollback plan
- [ ] Set up monitoring/alerting

#### Week 3: Phase 1 Deploy (Read-Only)
```bash
# Deploy Phase 1 with read-only mode
firebase use production
npm run deploy

# Verify deployment
# Check Firestore rules allow reads
```

**Feature Flags**:
```typescript
export const PO_FEATURES = {
  deliveryTracking: true,        // Display only
  recordDelivery: false,          // Not yet active
  accountabilityValidation: false,
  autoGeneration: false
};
```

**Monitoring**:
- [ ] Check error logs daily
- [ ] Monitor page load times
- [ ] Track user engagement with new UI

**Status**: ⏳ Pending

#### Week 4: Phase 1 Active
```typescript
export const PO_FEATURES = {
  deliveryTracking: true,
  recordDelivery: true,           // NOW ACTIVE
  accountabilityValidation: false,
  autoGeneration: false
};
```

**Redeploy**:
```bash
npm run deploy
```

**Validation**:
- [ ] Users can record deliveries
- [ ] PO statuses update correctly
- [ ] Quantities accumulate properly
- [ ] No performance degradation

**Metrics to Track**:
- Deliveries recorded per day: `_________`
- Average PO fulfillment time: `_________`
- User feedback: `_________`

**Status**: ⏳ Pending

#### Week 5: Phase 2 Deploy (Warnings Only)
```typescript
export const PO_FEATURES = {
  deliveryTracking: true,
  recordDelivery: true,
  accountabilityValidation: true,  // NOW ACTIVE
  enforcePoRequirements: false,    // Warnings only
  autoGeneration: false
};
```

**Monitoring**:
- [ ] Variance warnings showing correctly
- [ ] No false positives
- [ ] Users understand warnings
- [ ] Three-way matches created

**Status**: ⏳ Pending

#### Week 6: Phase 2 Active (Enforcement)
```typescript
export const PO_FEATURES = {
  deliveryTracking: true,
  recordDelivery: true,
  accountabilityValidation: true,
  enforcePoRequirements: true,     // NOW ENFORCED
  autoGeneration: false
};

export const PO_THRESHOLDS = {
  construction_materials: 500000,  // ENFORCED
  equipment_rental: 1000000,       // ENFORCED
  professional_services: 2000000   // ENFORCED
};
```

**Validation**:
- [ ] PO mandatory for materials >500k
- [ ] Investigations triggered for ≥5% variance
- [ ] No blocking of valid expenses

**Status**: ⏳ Pending

#### Week 7: Phase 3 Pilot (2-3 Projects)
```typescript
export const PO_FEATURES = {
  deliveryTracking: true,
  recordDelivery: true,
  accountabilityValidation: true,
  enforcePoRequirements: true,
  autoGeneration: true             // NOW ACTIVE (pilot)
};

// Enable for specific projects only
export const AUTO_GEN_PILOT_PROJECTS = [
  'proj-001',
  'proj-002',
  'proj-003'
];
```

**Pilot Projects**:
1. Project: `_________________` Status: `_________`
2. Project: `_________________` Status: `_________`
3. Project: `_________________` Status: `_________`

**Feedback Collection**:
- [ ] Auto-generation working correctly
- [ ] Supplier grouping accurate
- [ ] Unassigned items handled properly
- [ ] Users satisfied with workflow

**Status**: ⏳ Pending

#### Week 8+: Full Rollout
```typescript
// Remove pilot restrictions
export const PO_FEATURES = {
  deliveryTracking: true,
  recordDelivery: true,
  accountabilityValidation: true,
  enforcePoRequirements: true,
  autoGeneration: true             // ALL PROJECTS
};
```

**Final Validation**:
- [ ] All features stable
- [ ] No critical bugs
- [ ] User training complete
- [ ] Documentation updated

**Status**: ⏳ Pending

---

## Performance Metrics

### Baseline (Before Enhancement)
- PO creation time: `_________ seconds`
- Average fulfillment time: `_________ days`
- Accountability submission time: `_________ minutes`
- Variance detection rate: `_________ %`

### Target (After Enhancement)
- PO creation time: <2 seconds (with auto-generation)
- Average fulfillment time: <30 days
- Accountability submission time: <5 minutes
- Variance detection rate: 95%+

### Actual Results
**Week 4**:
- PO creation time: `_________`
- Fulfillment time: `_________`
- Submissions: `_________`
- Variance detection: `_________%`

**Week 8**:
- PO creation time: `_________`
- Fulfillment time: `_________`
- Submissions: `_________`
- Variance detection: `_________%`

---

## Rollback Procedures

### If Critical Bug Found

**Immediate Action**:
```bash
# Revert to previous deployment
firebase hosting:rollback

# Disable features via feature flags
# Update in code and redeploy
```

**Severity Levels**:
- **P0 (Critical)**: Rollback immediately
  - Data loss
  - Security vulnerability
  - Complete service outage

- **P1 (High)**: Hot-fix within 24 hours
  - Major feature broken
  - Significant performance degradation
  - Wrong calculations

- **P2 (Medium)**: Fix in next deployment
  - Minor UI bugs
  - Non-critical features broken
  - Cosmetic issues

### Rollback Contacts
- Tech Lead: `_________________________________`
- DevOps: `_________________________________`
- Product Manager: `_________________________________`

---

## Success Criteria

### Phase 1 Success
- [ ] 90%+ of deliveries recorded via new UI
- [ ] PO statuses auto-update correctly
- [ ] <5 user-reported bugs per week
- [ ] Page load time <2 seconds

### Phase 2 Success
- [ ] 95%+ variance detection accuracy
- [ ] Investigations triggered for all ≥5% variances
- [ ] Zero false positives on PO requirements
- [ ] User satisfaction >80%

### Phase 3 Success
- [ ] 90%+ requisitions auto-generate POs
- [ ] <2 seconds per PO generation
- [ ] Supplier grouping 95%+ accurate
- [ ] Manual intervention only for edge cases

### Overall Success
- [ ] Full feature adoption within 8 weeks
- [ ] 30% reduction in PO processing time
- [ ] 50% reduction in variance investigations
- [ ] Zero critical bugs in production
- [ ] Positive user feedback (>4/5 rating)

---

## Training & Documentation

### User Training Materials
- [ ] Video tutorial: Recording deliveries
- [ ] Video tutorial: Linking expenses to POs
- [ ] Quick reference guide (PDF)
- [ ] FAQ document
- [ ] In-app tooltips and help

### Training Schedule
- Week 2: Project Managers (2 hours)
- Week 2: Site Engineers (1.5 hours)
- Week 3: Accountants (2 hours)
- Week 4: All other users (1 hour)

### Documentation Links
- Implementation Plan: `/Users/ofd/.claude/plans/validated-hatching-conway.md`
- Testing Guide: `src/subsidiaries/advisory/matflow/services/__tests__/README.md`
- Migration Guide: `src/subsidiaries/advisory/matflow/migrations/README.md`
- UI Components: `src/subsidiaries/advisory/matflow/components/UI_COMPONENTS.md`
- This Checklist: `ROLLOUT_CHECKLIST.md`

---

## Sign-Off

### Development Team
- Developer: _________________ Date: _________
- Code Reviewer: _________________ Date: _________
- QA Lead: _________________ Date: _________

### Stakeholders
- Product Manager: _________________ Date: _________
- Tech Lead: _________________ Date: _________
- Project Sponsor: _________________ Date: _________

---

**Current Phase**: Pre-Deployment Preparation
**Next Milestone**: Complete local testing and staging deployment
**Target Date**: _________________
