# ADD-FIN-001 Testing Guide - Diagonistic Center Project

## 🎯 Testing Status

**Date:** 2026-01-18
**Project:** Diagonistic Center (ID: `Zx36tGZdPMMo4H5dtHHt`)
**System:** Fully deployed and configured
**UI Routes:** Updated to use enhanced forms

---

## ✅ Deployment Verified

### Backend Infrastructure
- ✅ **13 Firestore Indexes** - Deployed
- ✅ **7 Cloud Functions** - Running
- ✅ **Approval Configuration** - Created at `approval_config/requisition_default`
- ✅ **Type System** - All services ready

### Frontend Integration
- ✅ **Routes Updated** - Enhanced forms now active
- ✅ **RequisitionFormEnhanced** - Routed at `/advisory/delivery/projects/:projectId/requisitions/new/manual`
- ✅ **AccountabilityFormEnhanced** - Routed at `/advisory/delivery/requisitions/:requisitionId/accountability/new`

### Test Project Details
```
Project: Diagonistic Center
ID: Zx36tGZdPMMo4H5dtHHt
BOQ Items: 0 (needs to be created for testing)
Existing Requisitions: 0
Status: Ready for testing
```

---

## 📋 Testing Checklist

### Phase 1: Create Test BOQ Items (15 minutes)

Before testing requisitions, we need BOQ items. Navigate to:

**URL:** `http://localhost:5173/advisory/delivery/projects/Zx36tGZdPMMo4H5dtHHt/boq`

**Create 2-3 test BOQ items:**

#### Sample BOQ Item 1: Medical Equipment
```
Item Number: 001
Description: Diagnostic Ultrasound Machine
Category: Medical Equipment
Unit: Each (EA)
Quantity Contract: 2
Rate Contract: 1,500,000 KES
Budget Line: Equipment
```

#### Sample BOQ Item 2: Building Materials
```
Item Number: 002
Description: Ceramic Floor Tiles
Category: Building Materials
Unit: Square Meters (M2)
Quantity Contract: 200
Rate Contract: 2,500 KES
Budget Line: Construction
```

#### Sample BOQ Item 3: Services
```
Item Number: 003
Description: Electrical Installation
Category: Services
Unit: Each (EA)
Quantity Contract: 1
Rate Contract: 500,000 KES
Budget Line: Services
```

**Note:** When creating BOQ items through the UI, the `budgetControl` field will be automatically calculated by the BOQ service.

---

### Phase 2: Test Enhanced Requisition Form (20 minutes)

#### Test 2.1: Navigate to Requisition Form

**URL:** `http://localhost:5173/advisory/delivery/projects/Zx36tGZdPMMo4H5dtHHt/requisitions/new/manual`

**Expected:**
- ✅ Form loads without errors
- ✅ "ADD-FIN-001 Enhanced Requisition" or similar title visible
- ✅ BOQ item selector available
- ✅ Real-time validation messages displayed

#### Test 2.2: BOQ Item Selection

**Action:** Click on BOQ item selector

**Expected:**
- ✅ List of BOQ items appears (the 3 items you created)
- ✅ Shows available quantity for each item
- ✅ Shows budget information
- ✅ Items with 0 available quantity are disabled

#### Test 2.3: Fill Requisition Form

**Fill in:**
```
Purpose: Purchase Diagnostic Ultrasound Machine
BOQ Item: 001 - Diagnostic Ultrasound Machine
Quantity Requested: 1 (out of 2 available)
Advance Type: Materials
Budget Line: Equipment
Justification: Required for diagnostic center operations
```

**Optional (PM Responsibility):**
- Add quotations (optional feature)
- Select supplier (optional)
- Upload supporting documents

**Expected:**
- ✅ Form validates quantity against BOQ availability
- ✅ Shows amount calculation: 1 × 1,500,000 = 1,500,000 KES
- ✅ Shows advance policy: 14-day accountability deadline
- ✅ Real-time budget validation passes
- ✅ No overdue accountability warning (first requisition)

#### Test 2.4: Submit Requisition

**Action:** Click "Submit Requisition"

**Expected:**
- ✅ Requisition created successfully
- ✅ Redirects to requisition detail page
- ✅ Status shows "Pending Approval"
- ✅ Approval workflow shows: Technical Review → Financial Approval
- ✅ BOQ item quantity updated:
  - `quantityRequisitioned`: 1
  - `quantityRemaining`: 1 (2 - 1)
  - Status: `partial`

**Verify in Firestore:**
```
Collection: requisitions
Fields to check:
- projectId: Zx36tGZdPMMo4H5dtHHt
- status: pending
- amountRequested: 1500000
- currency: KES
- sourceType: boq
- accountabilityDueDate: (14 days from now)
- accountabilityStatus: pending
```

---

### Phase 3: Test Approval Workflow (10 minutes)

#### Test 3.1: Check Approval Configuration

**Verify:** Requisition uses default dual-approval workflow

**Expected:**
- ✅ Stage 1: Technical Review (ICE Manager, 48h SLA)
- ✅ Stage 2: Financial Approval (Finance, 72h SLA)
- ✅ No amount-based escalation (same workflow for all amounts)

#### Test 3.2: Approve Technical Review (Manual)

**Action:** As ICE Manager, approve the requisition

**Navigate to:** Approvals page or requisition detail page

**Expected:**
- ✅ Approval button visible for Technical Review
- ✅ After approval, status updates to "Technical Approved"
- ✅ Next stage (Financial Approval) becomes active
- ✅ SLA timer starts for Financial Approval (72 hours)

#### Test 3.3: Approve Financial Review (Manual)

**Action:** As Finance user, approve the requisition

**Expected:**
- ✅ Approval button visible for Financial Approval
- ✅ After approval, requisition status updates to "Approved"
- ✅ Ready for payment processing

---

### Phase 4: Test Accountability Form (25 minutes)

#### Test 4.1: Make Payment (Manual Setup)

**Note:** For testing accountability, the requisition needs to be paid first.

**Firestore Update (for testing):**
```
Collection: requisitions/{requisitionId}
Update: { status: 'paid' }
```

#### Test 4.2: Navigate to Accountability Form

**URL:** `http://localhost:5173/advisory/delivery/requisitions/{requisitionId}/accountability/new`

**Expected:**
- ✅ Enhanced Accountability Form loads
- ✅ Shows requisition details (amount, purpose)
- ✅ Shows deadline (14 days from approval)
- ✅ Category-specific proof of spend checklist visible

#### Test 4.3: Fill Accountability Details

**Expense 1:**
```
Category: Materials
Description: Diagnostic Ultrasound Machine
Amount: 1,400,000 KES
Supplier: Medical Equipment Ltd
Date: [Today's date]
```

**Proof of Spend (Materials):**
- ✅ Upload Invoice (PDF)
- ✅ Upload Receipt (PDF or Image)
- ✅ Upload Delivery Note (PDF)
- ✅ Upload Photo of Equipment (JPG/PNG, min 300 DPI)

**Expected:**
- ✅ Category-specific checklist appears for "Materials"
- ✅ Required documents: Invoice, Receipt, Delivery Note, Photo
- ✅ Document quality validation (300 DPI minimum)
- ✅ Real-time variance calculation shows:
  - Requisition Amount: 1,500,000 KES
  - Total Expenses: 1,400,000 KES
  - Variance: -100,000 KES (6.67% under budget)
  - Status: Minor (< 2%) - Actually Moderate since >2%

**Unspent Amount:**
```
Amount Returned: 100,000 KES
Return Method: Bank Transfer
Return Date: [Today's date]
```

#### Test 4.4: Submit Accountability

**Action:** Click "Submit Accountability"

**Expected:**
- ✅ Zero-discrepancy validation passes (all proof of spend uploaded)
- ✅ Variance calculated correctly
- ✅ If variance >2%, investigation may be triggered
- ✅ BOQ item updated:
  - `quantityExecuted`: 1
  - `spentAmount`: 1,400,000
  - `varianceAmount`: -100,000
  - `variancePercentage`: -6.67%
  - `varianceStatus`: may change to 'alert' if over threshold

**Verify in Firestore:**
```
Collection: accountabilities
Fields to check:
- requisitionId: {id}
- projectId: Zx36tGZdPMMo4H5dtHHt
- totalExpenses: 1400000
- unspentReturned: 100000
- variance.amount: -100000
- variance.percentage: -6.67
- variance.status: moderate
- isZeroDiscrepancy: true (all proof of spend complete)
```

---

### Phase 5: Test Deadline Monitoring (1 hour)

#### Test 5.1: Create Overdue Accountability (for testing)

**Firestore Manual Update:**
```javascript
// Update a requisition to have past accountability due date
db.collection('requisitions').doc('{requisitionId}').update({
  accountabilityStatus: 'pending',
  accountabilityDueDate: new Date('2026-01-10'), // Past date
  status: 'paid'
});
```

#### Test 5.2: Wait for Hourly Check (or Trigger Manually)

**Option A: Wait for next hour**
- Deadline monitoring runs at minute 0 of every hour

**Option B: Trigger manually**
```bash
# Via Firebase Console
# Functions → triggerDeadlineCheck → Testing tab → Run function
```

#### Test 5.3: Verify Deadline Monitoring Results

**Check `deadline_monitoring_logs` collection:**
```
Expected log entry:
{
  timestamp: [recent],
  type: 'hourly_check',
  summary: {
    overdueAccountabilities: 1,
    overdueInvestigations: 0,
    overdueReconciliations: 0,
    escalations: 0,
    notifications: 1
  },
  status: 'success'
}
```

**Check `notifications` collection:**
```
Expected notification:
{
  type: 'accountability_overdue',
  severity: 'warning' or 'critical',
  recipientId: {userId who created requisition},
  subject: 'Accountability Overdue: Purchase Diagnostic...',
  message: 'Your accountability... is X days overdue',
  read: false
}
```

**Check requisition status:**
```
Collection: requisitions/{requisitionId}
Updated field:
  accountabilityStatus: 'overdue' (changed from 'pending')
```

---

### Phase 6: Test BOQ Budget Control (15 minutes)

#### Test 6.1: View BOQ After Requisition

**Navigate to:** BOQ Management page for project

**Expected BOQ Item 001 updates:**
```
Original:
  quantityContract: 2
  quantityRequisitioned: 0
  quantityExecuted: 0
  status: pending

After Requisition:
  quantityContract: 2
  quantityRequisitioned: 1
  quantityExecuted: 0
  quantityRemaining: 1
  status: partial

After Accountability:
  quantityContract: 2
  quantityRequisitioned: 1
  quantityExecuted: 1
  quantityRemaining: 1
  status: partial

Budget Control:
  allocatedAmount: 3,000,000 (2 × 1,500,000)
  committedAmount: 1,500,000 (1 × 1,500,000)
  spentAmount: 1,400,000 (actual from accountability)
  remainingBudget: 1,600,000 (3M - 1.4M)
  varianceAmount: -100,000 (1.4M - 1.5M)
  variancePercentage: -6.67%
  varianceStatus: 'alert' or 'on_budget'
```

#### Test 6.2: Test BOQ Validation

**Action:** Try to create requisition for more than available quantity

**Create requisition:**
```
BOQ Item: 001
Quantity: 2 (when only 1 remains)
```

**Expected:**
- ✅ Validation error: "Insufficient quantity available"
- ✅ Shows available: 1, requested: 2
- ✅ Cannot submit requisition

---

### Phase 7: Test Compliance & Reporting (10 minutes)

#### Test 7.1: Call Deadline Summary Function

**Via Browser Console:**
```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const getSummary = httpsCallable(functions, 'getProjectDeadlineSummary');

const result = await getSummary({
  projectId: 'Zx36tGZdPMMo4H5dtHHt'
});

console.log(result.data.summary);
```

**Expected Response:**
```javascript
{
  success: true,
  summary: {
    overdueAccountabilities: 1,
    overdueInvestigations: 0,
    pendingReconciliations: 0,
    upcomingDeadlines: 0
  }
}
```

#### Test 7.2: View Compliance Metrics (If Dashboard Exists)

**Expected Metrics:**
- Accountability On-Time Rate: Based on overdue count
- Zero-Discrepancy Rate: 100% (if all accountabilities have complete proof of spend)
- Budget Adherence: Based on BOQ variance status
- Overall Compliance Score: Weighted average

---

## 🔍 Verification Checklist

### Database Integrity
- [ ] BOQ items have `budgetControl` field
- [ ] Requisitions have `accountabilityDueDate`
- [ ] Accountabilities have `variance` object
- [ ] Approval config exists at `approval_config/requisition_default`

### Cloud Functions
- [ ] `hourlyDeadlineCheck` runs successfully (check logs)
- [ ] `dailyDeadlineSummary` scheduled for 8 AM
- [ ] Manual functions callable by admins

### UI/UX
- [ ] Enhanced forms load without errors
- [ ] BOQ selection works smoothly
- [ ] Real-time validation provides feedback
- [ ] Proof of spend upload works
- [ ] Variance calculation displays correctly

### Business Logic
- [ ] Dual-approval workflow enforced
- [ ] BOQ quantity validation works
- [ ] Advance policy enforced (14-day deadline)
- [ ] Zero-discrepancy validation accurate
- [ ] Deadline monitoring detects overdue items

---

## 🐛 Known Issues & Workarounds

### Issue 1: No BOQ Items in Test Project
**Status:** Expected - project is new
**Workaround:** Create BOQ items via BOQ Import or manual entry

### Issue 2: Cannot Test Payment Flow
**Status:** Payment processing not in scope
**Workaround:** Manually update requisition status to 'paid' in Firestore for testing

### Issue 3: No Users with Specific Roles
**Status:** Role-based approval may need user setup
**Workaround:** Test with current user, verify workflow structure

---

## 📊 Success Criteria

### Minimum Viable Test (Must Pass)
- ✅ Create requisition with BOQ validation
- ✅ BOQ quantities update correctly
- ✅ Submit accountability with proof of spend
- ✅ Variance calculation accurate
- ✅ Deadline monitoring detects overdue
- ✅ Notifications created

### Complete Test (Ideal)
- ✅ All minimum tests pass
- ✅ Dual-approval workflow complete
- ✅ Zero-discrepancy validation enforced
- ✅ Budget control prevents over-requisition
- ✅ Compliance metrics accurate
- ✅ All Cloud Functions execute successfully

---

## 🎬 Quick Start Testing

**Fastest way to verify system works:**

1. **Create BOQ Item** (2 min)
   ```
   /advisory/delivery/projects/Zx36tGZdPMMo4H5dtHHt/boq
   Add: Item 001, Qty: 10, Rate: 10000
   ```

2. **Create Requisition** (3 min)
   ```
   /advisory/delivery/projects/Zx36tGZdPMMo4H5dtHHt/requisitions/new/manual
   Select BOQ 001, Qty: 5
   Submit
   ```

3. **Verify BOQ Updated** (1 min)
   ```
   Check BOQ: quantityRequisitioned should be 5
   Check BOQ: quantityRemaining should be 5
   ```

4. **Mark as Paid** (1 min)
   ```
   Firestore: requisitions/{id} → status: 'paid'
   ```

5. **Submit Accountability** (5 min)
   ```
   /advisory/delivery/requisitions/{id}/accountability/new
   Add expenses, upload proof, submit
   ```

6. **Verify Complete** (2 min)
   ```
   Check BOQ: quantityExecuted should be 5
   Check variance calculated correctly
   ```

**Total Time:** ~15 minutes

---

## 📞 Support & Next Steps

**If tests pass:** System is production-ready! ✅

**If issues found:**
1. Check browser console for errors
2. Check Firestore data structure
3. Review Cloud Function logs
4. See [DEPLOYMENT-COMPLETE.md](DEPLOYMENT-COMPLETE.md) for troubleshooting

**Documentation:**
- [Full Implementation Guide](ADD-FIN-001-IMPLEMENTATION-COMPLETE.md)
- [Deadline Monitoring System](deadline-monitoring-system.md)
- [Deployment Guide](DEPLOYMENT-COMPLETE.md)

---

**Testing Date:** _________________
**Tested By:** _________________
**Result:** ☐ Pass ☐ Fail ☐ Partial
**Notes:** _________________
