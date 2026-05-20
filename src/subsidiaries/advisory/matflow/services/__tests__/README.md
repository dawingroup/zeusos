# Purchase Order Enhancement Testing Guide

This directory contains comprehensive tests for the Purchase Order Enhancement & Integration implementation.

## Test Files Overview

### Phase 1: PO Delivery Tracking
**File**: `po-delivery-tracking.test.ts`

Tests core PO delivery tracking functionality:
- Linking deliveries to PO items
- Quantity accumulation (delivered, received, rejected, accepted)
- Auto-status updates (approved → partially_fulfilled → fulfilled)
- Multiple deliveries for same item
- Rejection tracking
- Error handling

**Key Test Scenarios**:
- ✅ Partial delivery updates PO to `partially_fulfilled`
- ✅ Multiple deliveries accumulate quantities correctly
- ✅ Full delivery updates PO to `fulfilled`
- ✅ Rejected quantities tracked separately
- ✅ Errors thrown for non-existent POs/items

---

### Phase 2: Accountability PO Validation
**File**: `accountability-po-validation.test.ts`

Tests accountability expense validation against purchase orders:
- PO validation logic
- Variance detection with thresholds:
  - <2%: Minor (no warnings)
  - 2-5%: Moderate (warnings, no investigation)
  - ≥5%: Severe (warnings + investigation triggered)
- Three-way matching (PO → Delivery → Accountability)
- PO mandatory requirements by expense category

**Key Test Scenarios**:
- ✅ Exact match validates without errors/warnings
- ✅ 1.5% variance passes silently
- ✅ 3% variance generates warning but no investigation
- ✅ 6% variance triggers mandatory investigation
- ✅ Three-way match record created correctly
- ✅ PO required for construction materials >500k UGX
- ✅ PO optional for construction materials <500k UGX

---

### Phase 3: Auto-PO Generation
**File**: `auto-po-generation.test.ts`

Tests automatic PO generation from approved requisitions:
- Single supplier scenarios
- Multi-supplier grouping
- Unassigned supplier handling
- Requisition workflow integration
- PO content validation

**Key Test Scenarios**:
- ✅ Single PO created for items from same supplier
- ✅ Multiple POs created when items have different suppliers
- ✅ Items without suppliers grouped as "unassigned"
- ✅ PO generation only works on approved requisitions
- ✅ Generated POs linked back to requisition
- ✅ 18% VAT applied correctly
- ✅ Delivery tracking fields initialized to 0

---

### Integration Test
**File**: `po-integration.test.ts`

End-to-end workflow test covering complete procurement-to-payment cycle:

**Workflow Steps**:
1. Create requisition with 3 items from 2 suppliers
2. Approve requisition → Auto-generate 2 POs
3. Record deliveries → Update PO tracking
4. Monitor PO status progression
5. Create accountability linking expenses to POs
6. Three-way matching validation
7. Verify zero-variance scenario (no investigation)

**Additional Scenario**:
- 8% variance detection and investigation triggering

---

## Running the Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure Firebase emulator is running (if using Firestore)
firebase emulators:start
```

### Run All Tests
```bash
# Run all PO enhancement tests
npm test -- src/subsidiaries/advisory/matflow/services/__tests__/

# Run specific test file
npm test -- po-delivery-tracking.test.ts
npm test -- accountability-po-validation.test.ts
npm test -- auto-po-generation.test.ts
npm test -- po-integration.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage src/subsidiaries/advisory/matflow/services/__tests__/
```

### Watch Mode (for development)
```bash
npm test -- --watch po-delivery-tracking.test.ts
```

---

## Test Data Setup

### Mock Data
Tests use isolated test data:
- Project IDs: `test-project-001`, `test-project-002`, etc.
- User IDs: `test-user-phase1`, `test-user-phase2`, etc.
- Supplier IDs: `supplier-A`, `supplier-B`, `supplier-test`

### Cleanup
Each test suite uses `beforeEach` to set up fresh test data. Ensure proper cleanup after tests to avoid Firestore pollution:

```typescript
afterEach(async () => {
  // Clean up test data if needed
  // await cleanupTestData(testProjectId);
});
```

---

## Expected Test Results

### Phase 1: PO Delivery Tracking
- **Total Tests**: 11
- **Expected Duration**: ~2-3 seconds
- **Key Metrics**:
  - Delivery linking success rate: 100%
  - Status transition accuracy: 100%
  - Quantity accumulation accuracy: 100%

### Phase 2: Accountability PO Validation
- **Total Tests**: 14
- **Expected Duration**: ~3-4 seconds
- **Key Metrics**:
  - Validation accuracy: 100%
  - Variance detection accuracy: 100% (0.1% tolerance)
  - Investigation trigger rate: Correct for ≥5% variance

### Phase 3: Auto-PO Generation
- **Total Tests**: 17
- **Expected Duration**: ~4-5 seconds
- **Key Metrics**:
  - PO generation success rate: 100%
  - Supplier grouping accuracy: 100%
  - VAT calculation accuracy: 100%

### Integration Test
- **Total Tests**: 2
- **Expected Duration**: ~5-6 seconds
- **Key Metrics**:
  - End-to-end workflow completion: 100%
  - Three-way match creation: 100%
  - Investigation triggering: Correct for ≥5% variance

---

## Troubleshooting

### Test Failures

**Issue**: "Purchase order not found"
- **Cause**: PO creation failed or wrong ID used
- **Fix**: Check Firestore emulator logs, verify PO creation logic

**Issue**: "Status not updated to partially_fulfilled"
- **Cause**: `updatePODeliveryStatus` not called or logic error
- **Fix**: Verify `linkDeliveryToPO` calls status update method

**Issue**: "Variance percentage incorrect"
- **Cause**: Rounding errors or wrong calculation
- **Fix**: Use `toBeCloseTo()` matcher with appropriate precision

**Issue**: "Three-way match creation fails"
- **Cause**: Missing PO, delivery, or accountability record
- **Fix**: Ensure all three components exist before creating match

---

## Continuous Integration

### GitHub Actions
Add to `.github/workflows/test.yml`:

```yaml
- name: Run PO Enhancement Tests
  run: npm test -- src/subsidiaries/advisory/matflow/services/__tests__/

- name: Upload Test Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    flags: po-enhancement
```

### Required Environment Variables
```bash
FIREBASE_PROJECT_ID=your-test-project
FIRESTORE_EMULATOR_HOST=localhost:8080
```

---

## Next Steps After Testing

1. **Data Migration**: Run migration script to backfill existing POs
2. **UI Integration**: Build delivery recording and PO picker forms
3. **User Acceptance Testing**: Deploy to staging for manual testing
4. **Performance Testing**: Load test with 1000+ POs and deliveries
5. **Gradual Rollout**: Enable features project-by-project

---

## Test Maintenance

### Adding New Tests
When adding new functionality:

1. Add test cases to appropriate phase file
2. Update this README with new scenarios
3. Ensure new tests follow existing patterns
4. Maintain >90% code coverage

### Updating Tests
When modifying implementation:

1. Update affected test assertions
2. Add tests for new edge cases
3. Keep test data realistic
4. Document breaking changes

---

## Support

For issues with tests:
- Check Firestore emulator logs: `firebase emulators:start --debug`
- Review implementation files referenced in tests
- Verify test data setup in `beforeEach` blocks
- Consult implementation plan: `/Users/ofd/.claude/plans/validated-hatching-conway.md`
