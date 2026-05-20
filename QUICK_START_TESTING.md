# Quick Start: Testing PO Enhancement

**Time Required**: 30-60 minutes
**Prerequisites**: Node.js, Firebase CLI, Git

---

## 🚀 Step 1: Environment Setup (5 minutes)

```bash
# 1. Ensure you're on the correct branch
git status
git pull origin main

# 2. Install dependencies (if needed)
npm install

# 3. Start Firebase emulators (in separate terminal)
firebase emulators:start

# 4. Start dev server (in another terminal)
npm run dev
```

**Verify**:
- ✅ Emulators running on http://localhost:4000
- ✅ Dev server running on http://localhost:5173 (or similar)
- ✅ No console errors

---

## 🔍 Step 2: Code Validation (5 minutes)

### Check TypeScript Compilation
```bash
npx tsc --noEmit --skipLibCheck
```

**Expected**: Compilation completes (some errors in unrelated files OK)

### Check for Syntax Errors
```bash
npm run lint
```

**Expected**: No errors in new PO enhancement files

---

## 🧪 Step 3: Manual Service Testing (10 minutes)

### Test Auto-PO Generation

Create test file: `test-po-generation.ts`

```typescript
import { autoPOGenerationService } from './src/subsidiaries/advisory/matflow/services/auto-po-generation.service';

async function testAutoGeneration() {
  // Requires actual requisition ID from your dev environment
  const requisitionId = 'test-req-001';
  const userId = 'test-user-001';

  try {
    const result = await autoPOGenerationService.generatePOsFromRequisition(
      requisitionId,
      userId
    );

    console.log('✅ Generation Result:', {
      success: result.success,
      totalPOs: result.summary.totalPOs,
      totalItems: result.summary.totalItems,
      totalAmount: result.summary.totalAmount,
      errors: result.errors,
      warnings: result.warnings
    });

    result.summary.supplierBreakdown.forEach(supplier => {
      console.log(`  - ${supplier.supplierName}: ${supplier.itemCount} items, ${supplier.totalAmount.toLocaleString()} UGX`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAutoGeneration();
```

Run:
```bash
npx ts-node test-po-generation.ts
```

---

## 🎨 Step 4: UI Component Testing (15 minutes)

### 4.1 Test DeliveryRecordingForm

1. Navigate to: http://localhost:5173/procurement/deliveries/new
2. Check:
   - [ ] Form renders without errors
   - [ ] PO dropdown populates
   - [ ] Item dropdown populates after PO selection
   - [ ] Quantity fields work
   - [ ] Progress bars display
   - [ ] Submit button enables/disables correctly

**Screenshot**: (Capture and attach to checklist)

### 4.2 Test POPickerForAccountability

1. Navigate to accountability form
2. Click "Link to PO" button
3. Check:
   - [ ] Modal opens
   - [ ] Search works
   - [ ] PO list displays
   - [ ] Variance calculation shows
   - [ ] Color-coded badges appear
   - [ ] Selection works

**Screenshot**: (Capture and attach to checklist)

### 4.3 Test AutoPOGenerationDialog

1. Approve a test requisition
2. Check:
   - [ ] Dialog appears
   - [ ] Statistics show correctly
   - [ ] Supplier breakdown displays
   - [ ] Links work
   - [ ] Can close dialog

**Screenshot**: (Capture and attach to checklist)

### 4.4 Test POFulfillmentDashboard

1. Navigate to: http://localhost:5173/procurement/fulfillment
2. Check:
   - [ ] Statistics cards show data
   - [ ] PO list displays
   - [ ] Search/filter works
   - [ ] Expand/collapse works
   - [ ] Progress bars render
   - [ ] "Record Delivery" buttons work

**Screenshot**: (Capture and attach to checklist)

---

## 📊 Step 5: Migration Dry Run (5 minutes)

### Run Migration Script (Dry Run)
```bash
# This is SAFE - no writes to Firestore
npm run migrate:po-tracking
```

**Review Output**:
```
========================================
PO DELIVERY TRACKING MIGRATION
========================================
Mode: DRY RUN
Batch Size: 50
...

Found 234 purchase orders to process

Processing batch 1/5...
  [MIGRATE] PO-2026-001 - Added tracking to 3 items
  [MIGRATE] PO-2026-002 - Added tracking to 5 items
  [SKIP] PO-2026-003 - Already migrated
  ...

========================================
MIGRATION SUMMARY
========================================
Mode: DRY RUN (no changes written)
Total POs: 234
Migrated: 198
Skipped: 35
Errors: 1
Duration: 2.34s
========================================

✅ Dry run completed successfully
💡 Run with dryRun: false to apply changes
```

**Checklist**:
- [ ] Migration runs without crashing
- [ ] Shows expected number of POs
- [ ] Errors (if any) are documented
- [ ] Skipped POs are reasonable

---

## ✅ Step 6: Validation Checklist

### Code Quality
- [ ] No TypeScript errors in new files
- [ ] No ESLint warnings in new files
- [ ] All imports resolve correctly
- [ ] No unused variables/imports

### Services
- [ ] `procurement-service.ts` compiles
- [ ] `auto-po-generation.service.ts` compiles
- [ ] `enhanced-accountability.service.ts` compiles
- [ ] Type definitions are correct

### UI Components
- [ ] All 4 components render
- [ ] No console errors
- [ ] Tailwind CSS applied
- [ ] Interactive elements work
- [ ] Loading states show
- [ ] Error messages display

### Data Migration
- [ ] Dry run completes successfully
- [ ] Output shows reasonable counts
- [ ] No critical errors
- [ ] Ready for staging migration

---

## 🐛 Common Issues & Fixes

### Issue: "Cannot find module '@/core/services/firebase'"
**Cause**: TypeScript path alias not resolved
**Fix**: This is expected in isolation - will work in full app context

### Issue: "Firebase app not initialized"
**Cause**: Emulator not running or not connected
**Fix**:
```bash
# Restart emulators
firebase emulators:start

# Check connection
firebase emulators:exec "echo 'Connected'"
```

### Issue: Component shows blank screen
**Cause**: Missing data or props
**Fix**: Check browser console for errors, verify props passed correctly

### Issue: Migration shows "Permission denied"
**Cause**: Not authenticated with Firebase
**Fix**:
```bash
firebase login
gcloud auth application-default login
```

### Issue: Styling not applied
**Cause**: Tailwind CSS not built
**Fix**:
```bash
# Rebuild
npm run build

# Or restart dev server
npm run dev
```

---

## 📝 Test Results Template

Copy and fill this out:

```
## Test Results - [DATE]

### Environment
- Node Version: __________
- Firebase Emulator: __________
- Browser: __________

### Code Validation
- TypeScript: ✅ / ❌
- ESLint: ✅ / ❌
- Notes: __________

### UI Components
- DeliveryRecordingForm: ✅ / ❌
- POPickerForAccountability: ✅ / ❌
- AutoPOGenerationDialog: ✅ / ❌
- POFulfillmentDashboard: ✅ / ❌
- Notes: __________

### Migration
- Dry Run: ✅ / ❌
- POs to Migrate: __________
- Errors: __________
- Notes: __________

### Issues Found
1. [Severity] Description
2. [Severity] Description

### Next Steps
- [ ] Fix critical issues
- [ ] Deploy to staging
- [ ] Schedule UAT
```

---

## 🎯 Success Criteria

**Ready for Staging** if:
- ✅ All 4 UI components render
- ✅ No critical TypeScript errors
- ✅ Migration dry run succeeds
- ✅ No console errors in browser
- ✅ Basic interactions work

**Not Ready** if:
- ❌ Components crash or blank screen
- ❌ Critical TypeScript errors
- ❌ Migration fails completely
- ❌ Multiple console errors

---

## 📞 Need Help?

**Documentation**:
- Full Rollout Checklist: `ROLLOUT_CHECKLIST.md`
- Implementation Status: `IMPLEMENTATION_STATUS.md`
- UI Components Guide: `src/subsidiaries/advisory/matflow/components/UI_COMPONENTS.md`
- Migration Guide: `src/subsidiaries/advisory/matflow/migrations/README.md`

**Quick Commands**:
```bash
# View migration help
npm run migrate:po-tracking:help

# Run tests (when configured)
npm run test:po

# Check build
npm run build
```

---

## ⏭️ After Testing

1. **Document Results**: Fill out test results template above
2. **Create Issues**: Log any bugs found in issue tracker
3. **Update Checklist**: Mark items complete in `ROLLOUT_CHECKLIST.md`
4. **Schedule Staging**: If all tests pass, proceed to staging deployment
5. **Notify Team**: Share test results with stakeholders

---

**Quick Start Time**: ~30-60 minutes
**Full Validation Time**: ~2-4 hours
**Next Milestone**: Staging Deployment
