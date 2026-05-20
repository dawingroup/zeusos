# Comprehensive Testing Guide
## Pricing & Estimation Integration - Phases 1 & 2

This guide will walk you through testing all the new functionality we've implemented.

---

## 🎯 Testing Overview

**What We're Testing**:
- ✅ Phase 1: Material pricing service, staleness detection
- ✅ Phase 2: Workflow tracker, validation alerts

**Time Required**: ~30 minutes

**Prerequisites**:
- Project with at least 3 design items
- Mix of manufactured and procured items (recommended)
- Access to Firebase (for data verification)

---

## 📋 Test Scenarios

### Test 1: Material Pricing Service (Phase 1)

**Goal**: Verify material prices are looked up correctly

**Steps**:
1. Open a project with manufactured items
2. Go to a design item's **Parts** tab
3. Add some sheet parts (if not already present):
   - Material: "Plywood"
   - Thickness: 18mm
   - Length: 1200mm, Width: 600mm
   - Quantity: 4
4. Scroll down to **Costing Summary** section
5. Click **"Auto Calculate"** button
6. Open browser console (F12)

**What to Look For**:
✅ No errors in console
✅ Sheet materials cost calculated
✅ If material has palette mapping: uses palette price
✅ If no palette mapping: see warning "Using fallback price for..."
✅ Cost breakdown shows:
   - Sheet Materials: (amount)
   - Standard Parts: (amount)
   - Special Parts: (amount)
   - Labor: (hours × rate)

**Expected Console Output**:
```
[MaterialPricing] Using fallback price for Plywood 18mm (32000 UGX)
```
OR if palette exists:
```
(No warning - price from palette)
```

**Success Criteria**:
- ✅ Material prices calculated without errors
- ✅ Source tracking visible in console
- ✅ Fallback prices used only when necessary

---

### Test 2: Costing Save Structure (Phase 1)

**Goal**: Verify complete costing structure is saved

**Steps**:
1. From the previous test, after clicking "Auto Calculate"
2. Verify all cost components are populated:
   - Sheet Materials Cost
   - Standard Parts Cost (if any)
   - Special Parts Cost (if any)
   - Labor Hours and Cost
3. Click **"Save Costing"** button
4. See success message briefly
5. Go to Firebase Console → `designProjects` → your project → `designItems` → your item
6. Look at the `manufacturing` field

**What to Look For in Firestore**:
```json
{
  "manufacturing": {
    "sheetMaterials": [...],
    "sheetMaterialsCost": 250000,
    "standardParts": [...],
    "standardPartsCost": 45000,
    "specialParts": [...],
    "specialPartsCost": 0,
    "materialCost": 295000,
    "laborHours": 12,
    "laborRate": 15000,
    "laborCost": 180000,
    "totalCost": 475000,
    "costPerUnit": 475000,
    "quantity": 1,
    "autoCalculated": true,
    "estimatedAt": { seconds: ..., nanoseconds: ... },
    "estimatedBy": "user@email.com",
    "lastAutoCalcAt": { seconds: ..., nanoseconds: ... }
  }
}
```

**Success Criteria**:
- ✅ All fields present and populated
- ✅ No `undefined` values in Firestore
- ✅ Timestamps are recent
- ✅ `autoCalculated: true` is set
- ✅ Math is correct: materialCost + laborCost = totalCost

---

### Test 3: Workflow Tracker Visibility (Phase 2)

**Goal**: Verify workflow tracker appears and displays correctly

**Steps**:
1. Navigate to the project view (main project page)
2. Look at the top of the page, above the tabs
3. You should see the **PricingWorkflowTracker** component

**What to Look For**:
```
┌─────────────────────────────────────────────────────────┐
│ 🕐 Pricing Workflow        [XX% Complete]              │
│ [Suggested action text]                                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
└─────────────────────────────────────────────────────────┘
```

**Components**:
- ✅ Progress icon (🕐, ✓, or ⚠)
- ✅ "Pricing Workflow" title
- ✅ Completion percentage badge
- ✅ Suggested action text
- ✅ Progress bar
- ✅ Step status badges (desktop only)
- ✅ Error/warning count (if any)
- ✅ Expand/collapse chevron (▶ or ▼)

**Success Criteria**:
- ✅ Tracker visible at top of project view
- ✅ Shows above tab navigation
- ✅ Doesn't block other content
- ✅ Progress percentage makes sense

---

### Test 4: Workflow Tracker Expansion (Phase 2)

**Goal**: Verify tracker expands to show detailed view

**Steps**:
1. From the previous test, **click anywhere on the workflow tracker**
2. It should expand to show detailed breakdown

**What to Look For (Expanded View)**:
```
┌─────────────────────────────────────────────────────────┐
│ [Compact view as above]                                 │
├─────────────────────────────────────────────────────────┤
│ [Expanded Details]                                      │
│                                                         │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│ │ 1. Item      │ │ 2. Optimiz.  │ │ 3. Estimate  │   │
│ │    Costing   │ │              │ │              │   │
│ │ [Status]     │ │ [Status]     │ │ [Status]     │   │
│ │ X of Y items │ │ Last run:... │ │ Last gen:... │   │
│ └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                         │
│ Issues Requiring Attention (if any):                    │
│ ⚠ Item Name: Issue description                         │
│   → Action to take                                      │
└─────────────────────────────────────────────────────────┘
```

**Step Status Colors**:
- 🟢 Green border: Complete
- 🔵 Blue border: In Progress
- 🟡 Yellow border: Stale (needs update)
- ⚪ Gray border: Not Started

**Success Criteria**:
- ✅ Tracker expands when clicked
- ✅ Three step cards visible
- ✅ Each step shows correct status
- ✅ Step numbers (1, 2, 3) visible
- ✅ Detail text under each step
- ✅ Issues section appears if errors exist
- ✅ Click again to collapse

---

### Test 5: Workflow Step Navigation (Phase 2)

**Goal**: Verify clicking steps navigates to correct tabs

**Steps**:
1. With tracker expanded, **click on "Item Costing" step**
2. Observe tab navigation
3. **Click on "Optimization" step** (step 2)
4. Observe tab navigation
5. **Click on "Estimate" step** (step 3)
6. Observe tab navigation

**Expected Behavior**:
- Click "Item Costing" → navigates to **"items"** tab
- Click "Optimization" → navigates to **"production"** tab
- Click "Estimate" → navigates to **"estimate"** tab

**Success Criteria**:
- ✅ Each step click changes active tab
- ✅ Tab content loads correctly
- ✅ Active tab indicator updates
- ✅ Workflow tracker remains visible (sticky)

---

### Test 6: Validation Errors - Missing Costing (Phase 2)

**Goal**: Verify validation errors appear for items without costing

**Setup**:
1. Create a new project or use existing
2. Add 3 manufactured items
3. Cost only 1 item (leave 2 without costing)
4. Don't run optimization yet

**Steps**:
1. Go to project view
2. Look at workflow tracker (should show errors)
3. Expand the tracker
4. Navigate to **Estimate** tab

**What to Look For**:

**In Workflow Tracker**:
- ✅ Error count badge: "2 errors"
- ✅ Progress: ~33% (1 of 3 items costed)
- ✅ Step 1 status: "In Progress"
- ✅ Suggested action: "Complete costing for 2 item(s)..."
- ✅ Issues section lists the 2 items

**In Estimate Tab**:
- ✅ WorkflowAlerts component appears at top
- ✅ Red error alerts for each item:
  ```
  ⚠ [Item Name]
  Missing costing data. Click Auto Calculate and Save Costing in
  the Parts tab.
  [Fix Item Name →]
  ```

**Success Criteria**:
- ✅ Errors detected automatically
- ✅ Correct count of missing items
- ✅ Clear description of what's missing
- ✅ Actionable remediation steps
- ✅ Alerts are red (error severity)

---

### Test 7: Estimate Generation with Validation (Phase 2)

**Goal**: Verify estimate generation respects workflow state

**Steps**:
1. From previous test with 2 items missing costing
2. In Estimate tab, try clicking **"Generate Estimate"**
3. Observe behavior

**Expected Behavior**:
- Should generate estimate with warning
- Estimate includes only the 1 costed item
- Error checks show the 2 missing items

**Then**:
4. Go back and cost the remaining 2 items
5. Return to Estimate tab
6. Click **"Generate Estimate"** again

**What to Look For**:
- ✅ First generation: Only 1 line item (costed item)
- ✅ Error checks section shows 2 missing items
- ✅ After costing all items: 3 line items in estimate
- ✅ No error checks
- ✅ Workflow tracker shows 100% for item costing

**Success Criteria**:
- ✅ Estimate generation doesn't crash with missing items
- ✅ Clear indication of what's missing
- ✅ After fixing, estimate includes all items
- ✅ Workflow tracker updates automatically

---

### Test 8: Staleness Detection (Phase 1 + 2)

**Goal**: Verify system detects when data becomes stale

**Setup**:
1. Project with 3 costed items
2. All items costed
3. Optimization run
4. Estimate generated

**Steps**:
1. Verify workflow tracker shows 100% complete (all green)
2. Go to one of the design items
3. Go to Parts tab
4. Modify something (add a part or change dimensions)
5. Click **"Auto Calculate"** and **"Save Costing"**
6. Return to project view
7. Look at workflow tracker

**What to Look For**:
- ✅ Optimization step status changes to **"Stale"** (yellow)
- ✅ Estimate step status changes to **"Stale"** (yellow)
- ✅ Warning badges appear on tracker
- ✅ Suggested action: "Re-run optimization..."

**Then**:
8. Navigate to Estimate tab
9. Look for staleness warning

**Expected Alert**:
```
⚠ Estimate Needs Regeneration
Item costs or optimization have changed. Regenerate estimate to
use latest data.
[Regenerate Estimate →]
```

**Success Criteria**:
- ✅ Staleness detected within seconds
- ✅ Workflow tracker shows yellow warnings
- ✅ Clear explanation of what's stale
- ✅ Actionable remediation ("Re-run optimization")
- ✅ Works for item changes, optimization changes, estimate changes

---

### Test 9: Complete Workflow End-to-End (Phase 1 + 2)

**Goal**: Test the full workflow from start to finish

**Setup**: Start with a clean project or reset an existing one

**Full Workflow**:

**Step 1: Create Items**
1. Create 3 new design items
   - 2 manufactured items
   - 1 procured item
2. Observe workflow tracker: 0% complete, "Complete costing..."

**Step 2: Cost Manufactured Items**
3. For each manufactured item:
   - Add parts in Parts tab
   - Click "Auto Calculate"
   - Review cost breakdown
   - Click "Save Costing"
4. Observe workflow tracker: ~66% (2 of 3 items)

**Step 3: Cost Procured Item**
5. For procured item:
   - Go to item detail → Procurement tab
   - Enter vendor, unit cost, quantity
   - System auto-calculates landed cost
6. Observe workflow tracker: 100% item costing, "Run optimization"

**Step 4: Run Optimization**
7. Navigate to Production tab (or NestingStudio)
8. Run optimization
9. Wait for completion
10. Observe workflow tracker: "Generate estimate"

**Step 5: Generate Estimate**
11. Navigate to Estimate tab
12. Click "Generate Estimate"
13. Wait for completion
14. Observe workflow tracker: 100%, all green, "All done!"

**Success Criteria**:
- ✅ Workflow tracker guides through all steps
- ✅ Percentage increases correctly
- ✅ Suggested actions update at each step
- ✅ No errors or warnings
- ✅ Estimate includes all 3 items
- ✅ Final state: 100% complete, success message

---

### Test 10: Dismissible Warnings (Phase 2)

**Goal**: Verify users can dismiss non-critical warnings

**Setup**:
1. Generate an estimate
2. Modify an item's costing (create staleness)
3. Navigate to Estimate tab

**Steps**:
1. See staleness warning appear
2. Look for **"X"** dismiss button on the alert
3. Click the **"X"** button
4. Observe alert disappears

**Then**:
5. Refresh the page
6. Check if dismissed alert reappears

**Expected Behavior**:
- Warning alerts (yellow) should be dismissible
- Error alerts (red) should NOT have dismiss button
- Dismissed alerts disappear immediately
- Currently: Dismissed alerts reappear on refresh (state is not persisted)

**Success Criteria**:
- ✅ Dismiss button visible on warnings
- ✅ Clicking "X" removes alert
- ✅ No dismiss button on errors
- ✅ Page remains functional after dismissing

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: Workflow tracker doesn't appear
**Symptoms**: No progress bar at top of project view

**Possible Causes**:
- Project has no items yet
- WorkflowState calculation failed
- React component error

**Debug Steps**:
1. Check browser console for errors
2. Verify project has at least 1 design item
3. Check Network tab - are Firestore queries succeeding?
4. Try refreshing the page

### Issue 2: "Auto Calculate" doesn't work
**Symptoms**: Clicking button does nothing or shows errors

**Possible Causes**:
- No parts added to item
- MaterialPricingService error
- Network/Firestore error

**Debug Steps**:
1. Open browser console
2. Click "Auto Calculate" again
3. Look for error messages
4. Verify item has parts in Parts tab
5. Check Firestore connectivity

### Issue 3: Workflow tracker shows wrong percentage
**Symptoms**: Progress doesn't match actual completion

**Possible Causes**:
- Workflow state calculation issue
- Cached old state
- Items in unexpected state

**Debug Steps**:
1. Check which items are counted as "costed"
2. Verify each item has valid costing data in Firestore
3. Refresh page to recalculate
4. Check console for calculation logs

### Issue 4: Validation errors don't clear after fixing
**Symptoms**: Errors still shown after costing items

**Possible Causes**:
- Workflow state not recalculating
- React state not updating
- Firestore save didn't complete

**Debug Steps**:
1. Navigate to a different tab and back
2. Refresh the page
3. Verify Firestore has updated data
4. Check browser console for errors

### Issue 5: Staleness not detected
**Symptoms**: Modifying items doesn't mark estimate stale

**Possible Causes**:
- Timestamps not comparing correctly
- Workflow state not recalculating
- useEffect not triggering

**Debug Steps**:
1. Check Firestore timestamps for item, optimization, estimate
2. Verify item's `estimatedAt` is newer than `estimate.generatedAt`
3. Refresh page to force recalculation
4. Check console for staleness detection logs

---

## ✅ Testing Checklist

Use this checklist to track your testing progress:

### Phase 1 Tests:
- [ ] Material pricing service works
- [ ] Fallback prices used correctly
- [ ] Costing save structure complete
- [ ] All fields saved to Firestore
- [ ] No undefined values in saved data

### Phase 2 Tests:
- [ ] Workflow tracker appears on project view
- [ ] Tracker expands/collapses correctly
- [ ] Step navigation works (clicks navigate to tabs)
- [ ] Validation errors appear for missing costing
- [ ] Estimate tab shows WorkflowAlerts
- [ ] Staleness detected automatically
- [ ] Stale warnings appear in tracker and alerts
- [ ] Dismissible warnings work
- [ ] Complete end-to-end workflow successful

### Integration Tests:
- [ ] Phase 1 + Phase 2 work together
- [ ] Material pricing used in workflow
- [ ] Staleness detection triggers workflow updates
- [ ] Estimate generation respects validation errors

---

## 📊 Test Results Template

Use this template to document your test results:

```
Test: [Test Name]
Date: [Date]
Tester: [Your Name]

Result: ✅ PASS / ❌ FAIL / ⚠️ PARTIAL

What Worked:
- [List successful aspects]

What Didn't Work:
- [List issues found]

Console Errors:
- [Copy any error messages]

Screenshots:
- [Attach if needed]

Notes:
- [Additional observations]
```

---

## 🎯 Success Criteria Summary

**All tests PASS if**:
- ✅ No console errors during normal operation
- ✅ Material prices calculated correctly
- ✅ Complete costing structure saved to Firestore
- ✅ Workflow tracker displays on project view
- ✅ All 3 steps show correct status
- ✅ Navigation between steps works
- ✅ Validation errors appear and are actionable
- ✅ Staleness detected automatically
- ✅ End-to-end workflow completes successfully
- ✅ UI is responsive and intuitive

**Ready for Production if**:
- ✅ All tests pass
- ✅ No critical bugs found
- ✅ Performance is acceptable (< 2 sec estimate generation)
- ✅ Works in target browsers (Chrome, Safari, Firefox)
- ✅ Mobile layout is acceptable

---

## 🚀 Next Steps After Testing

**If All Tests Pass**:
1. Document any minor issues as "Known Limitations"
2. Create deployment checklist
3. Plan production rollout
4. Consider user training/documentation

**If Issues Found**:
1. Document each issue with details
2. Prioritize: Critical / High / Medium / Low
3. Fix critical issues before deployment
4. Consider rolling back if major problems

**If Uncertain**:
1. Ask questions - I'm here to help!
2. Run specific tests again
3. Check against expected behavior
4. Review implementation if needed

---

Ready to start testing? Let's begin with **Test 1: Material Pricing Service**! 🧪
