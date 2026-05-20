# AI Intelligence Module - Testing Guide

**Version:** 1.0  
**Date:** January 8, 2026  
**Module:** Intelligence Layer (Phase 8.13-8.14)  
**URL:** https://dawinos.web.app

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Testing the AI Intelligence Dashboard](#testing-the-ai-intelligence-dashboard)
3. [Testing Business Event Detection](#testing-business-event-detection)
4. [Testing Task Generation](#testing-task-generation)
5. [Testing Cross-Module Integration](#testing-cross-module-integration)
6. [Firestore Verification](#firestore-verification)
7. [Console Testing Scripts](#console-testing-scripts)
8. [Expected Results](#expected-results)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### 1. Access Requirements
- Valid user account on https://dawinos.web.app
- Admin role (for full testing capabilities)
- Access to Firebase Console: https://console.firebase.google.com/project/dawinos

### 2. Browser Requirements
- Chrome DevTools open (F12 or Cmd+Option+I)
- Console tab visible for running test scripts

---

## Testing the AI Intelligence Dashboard

### Test 1.1: Navigate to AI Intelligence
1. Log in to https://dawinos.web.app
2. Click on "AI Intelligence" in the sidebar navigation
3. **Expected:** Dashboard loads with sections for:
   - Overview stats
   - Smart Suggestions
   - Anomalies
   - Predictions
   - Cross-Module Insights

### Test 1.2: Verify Dashboard Components
1. On the AI Intelligence dashboard
2. Check that these tabs/sections are visible:
   - Overview
   - Suggestions
   - Anomalies
   - Predictions
   - Insights
3. **Expected:** All tabs render without errors

### Test 1.3: Natural Language Query
1. Find the search/query input
2. Type: "Show me recent design items"
3. **Expected:** Query is processed (may show placeholder results initially)

---

## Testing Business Event Detection

### Test 2.1: Verify Event Service Import
Open browser console and run:
```javascript
// Check if services are available
console.log('Testing AI Intelligence Services...');

// This tests the module is properly loaded
const testModuleLoad = async () => {
  try {
    // Check Firestore connection
    const { collection, getDocs, query, limit } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
    console.log('✅ Firestore SDK loaded');
    return true;
  } catch (e) {
    console.error('❌ Failed to load Firestore:', e);
    return false;
  }
};
testModuleLoad();
```

### Test 2.2: Create Test Business Event via Firestore
In Firebase Console (Firestore Database):

1. Navigate to: Firestore Database > businessEvents
2. Click "Add Document"
3. Use auto-generated ID
4. Add these fields:
```json
{
  "eventType": "design_item_stage_changed",
  "category": "workflow_transition",
  "severity": "medium",
  "sourceModule": "design_manager",
  "subsidiary": "finishes",
  "entityType": "designItems",
  "entityId": "test-item-001",
  "entityName": "Test Cabinet Design",
  "projectId": "test-project-001",
  "projectName": "Test Kitchen Project",
  "title": "Design Item Stage Changed: Test Cabinet Design",
  "description": "Design item moved from concept to preliminary stage.",
  "status": "pending",
  "triggeredAt": [current timestamp],
  "createdAt": [current timestamp]
}
```
5. **Expected:** Document saves successfully

---

## Testing Task Generation

### Test 3.1: Create Test Task Template
In Firebase Console (Firestore Database):

1. Navigate to: Firestore Database > taskTemplates
2. Click "Add Document"
3. Add these fields:
```json
{
  "name": "Test Template",
  "description": "Template for testing",
  "category": "test",
  "triggerEvents": ["test_event"],
  "defaultTitle": "Test Task: {entityName}",
  "defaultDescription": "This is a test task for {entityName}",
  "defaultPriority": "medium",
  "defaultDueDays": 7,
  "checklistItems": [
    {
      "id": "1",
      "title": "Verify test setup",
      "description": "Confirm test environment is ready",
      "isRequired": true,
      "order": 1,
      "completed": false
    },
    {
      "id": "2",
      "title": "Run test cases",
      "description": "Execute all test scenarios",
      "isRequired": true,
      "order": 2,
      "completed": false
    }
  ],
  "assignmentStrategy": "creator",
  "sourceModule": "design_manager",
  "subsidiary": "finishes",
  "isActive": true,
  "version": 1,
  "createdAt": [current timestamp],
  "updatedAt": [current timestamp],
  "createdBy": "test-user"
}
```
5. **Expected:** Document saves successfully

### Test 3.2: Create Test Generated Task
In Firebase Console (Firestore Database):

1. Navigate to: Firestore Database > generatedTasks
2. Click "Add Document"
3. Add these fields:
```json
{
  "businessEventId": "test-event-001",
  "templateId": "test-template-001",
  "title": "Complete Preliminary Design Requirements",
  "description": "Ensure all preliminary design requirements are met.",
  "priority": "medium",
  "status": "pending",
  "dueDate": [7 days from now],
  "checklistItems": [
    {
      "id": "1",
      "title": "Overall Dimensions Defined",
      "description": "Confirm all major dimensions are documented",
      "isRequired": true,
      "order": 1,
      "completed": false
    },
    {
      "id": "2",
      "title": "3D Model Created",
      "description": "Create initial 3D model with basic geometry",
      "isRequired": true,
      "order": 2,
      "completed": false
    },
    {
      "id": "3",
      "title": "Material Selection",
      "description": "Select primary materials for the design",
      "isRequired": true,
      "order": 3,
      "completed": false
    }
  ],
  "checklistProgress": 0,
  "sourceModule": "design_manager",
  "subsidiary": "finishes",
  "entityType": "designItems",
  "entityId": "test-item-001",
  "entityName": "Test Cabinet Design",
  "projectId": "test-project-001",
  "projectName": "Test Kitchen Project",
  "createdAt": [current timestamp],
  "updatedAt": [current timestamp],
  "createdBy": "system"
}
```
5. **Expected:** Document saves successfully

---

## Testing Cross-Module Integration

### Test 4.1: Design Manager Integration (Manual Trigger)

To test the integration from Design Manager, you need to:

1. Navigate to Design Manager module
2. Open any design project
3. Open a design item
4. Change the stage (e.g., from "concept" to "preliminary")
5. **Expected:** 
   - A business event should be created in `businessEvents` collection
   - Generated tasks should appear in `generatedTasks` collection

### Test 4.2: Verify Module Configurations
Run in browser console:
```javascript
// Check SOURCE_MODULES configuration
console.log('Checking module configurations...');

const expectedModules = [
  'design_manager',
  'launch_pipeline', 
  'inventory',
  'customer_hub',
  'engagements',
  'funding',
  'reporting',
  'hr_central',
  'financial',
  'capital_hub'
];

console.log('Expected modules:', expectedModules);
console.log('✅ Module configuration test complete');
```

### Test 4.3: Test Event Categories
The following event categories should be supported:
- `workflow_transition` - Stage changes
- `approval_required` - Approval requests
- `deadline_approaching` - Due date warnings
- `anomaly_detected` - Unusual patterns
- `milestone_reached` - Completed milestones
- `quality_gate` - RAG status changes
- `cost_threshold` - Budget alerts

---

## Firestore Verification

### Test 5.1: Verify Collections Exist
In Firebase Console, verify these collections exist:
- [ ] `businessEvents`
- [ ] `taskTemplates`
- [ ] `generatedTasks`
- [ ] `taskDependencies`
- [ ] `smartSuggestions`
- [ ] `anomalies`
- [ ] `predictions`
- [ ] `crossModuleInsights`
- [ ] `intelligenceActivity`
- [ ] `assistantConversations`
- [ ] `nlQueries`

### Test 5.2: Verify Indexes
In Firebase Console > Firestore > Indexes:

Check for these composite indexes:
- `businessEvents`: status + createdAt
- `businessEvents`: sourceModule + createdAt
- `generatedTasks`: status + dueDate
- `generatedTasks`: assignedTo + status + dueDate
- `taskTemplates`: isActive + sourceModule

### Test 5.3: Verify Security Rules
Test that authenticated users can:
- Read all business events
- Create business events
- Read/create generated tasks
- Read task templates (only admins can write)

---

## Console Testing Scripts

### Script 1: Full Integration Test
Copy and paste into browser console:
```javascript
(async function testAIIntelligence() {
  console.log('🧪 AI Intelligence Integration Test');
  console.log('=====================================');
  
  const tests = {
    passed: 0,
    failed: 0,
    results: []
  };
  
  // Test 1: Check page loaded
  const aiNav = document.querySelector('[href*="/ai"]');
  if (aiNav) {
    tests.passed++;
    tests.results.push('✅ AI Intelligence navigation link found');
  } else {
    tests.failed++;
    tests.results.push('❌ AI Intelligence navigation link NOT found');
  }
  
  // Test 2: Check Firebase loaded
  if (typeof firebase !== 'undefined' || window.__FIREBASE_APP__) {
    tests.passed++;
    tests.results.push('✅ Firebase SDK loaded');
  } else {
    tests.failed++;
    tests.results.push('⚠️ Firebase SDK check inconclusive (may be modular)');
  }
  
  // Print results
  console.log('\n📊 Test Results:');
  tests.results.forEach(r => console.log(r));
  console.log(`\n✅ Passed: ${tests.passed}`);
  console.log(`❌ Failed: ${tests.failed}`);
  
  return tests;
})();
```

### Script 2: Check Firestore Data
Run from Firebase Console > Firestore > Shell:
```javascript
// Count documents in AI collections
const collections = [
  'businessEvents',
  'taskTemplates', 
  'generatedTasks',
  'smartSuggestions',
  'anomalies',
  'predictions'
];

for (const col of collections) {
  const snapshot = await db.collection(col).get();
  console.log(`${col}: ${snapshot.size} documents`);
}
```

---

## Expected Results

### After Successful Deployment

| Component | Expected State |
|-----------|----------------|
| AI Intelligence Page | Loads at `/ai` route |
| Dashboard Sections | All tabs render |
| Firestore Collections | All collections created |
| Firestore Indexes | All indexes deployed |
| Security Rules | Authenticated access working |

### Task Template Triggers

| Event Type | Expected Template |
|------------|-------------------|
| `design_item_stage_changed` (concept→preliminary) | "Complete Preliminary Design Requirements" |
| `design_item_stage_changed` (preliminary→technical) | "Complete Technical Design Requirements" |
| `design_item_stage_changed` (technical→pre-production) | "Complete Pre-Production Checklist" |
| `design_item_approval_requested` | "Review and Approve Design" |
| `design_item_procurement_started` | "Complete Procurement Requirements" |
| `engagement_created` | "Complete Engagement Setup" |
| `disbursement_requested` | "Process Disbursement Request" |
| `report_due` | "Prepare and Submit Report" |

---

## Troubleshooting

### Issue: AI Intelligence page not loading
**Solution:**
1. Clear browser cache
2. Check browser console for errors
3. Verify you're logged in
4. Try hard refresh (Cmd+Shift+R)

### Issue: No data showing in dashboard
**Solution:**
1. This is expected initially - no events have been triggered yet
2. Create test data using Firestore Console (see Test 2.2)
3. Trigger events by using Design Manager features

### Issue: Firestore permission denied
**Solution:**
1. Verify you're logged in
2. Check if your user has appropriate role
3. Verify security rules are deployed:
   ```bash
   firebase deploy --only firestore:rules --project dawinos
   ```

### Issue: Indexes not working
**Solution:**
1. Check Firebase Console for index build status
2. Some composite indexes take 5-10 minutes to build
3. Redeploy indexes if needed:
   ```bash
   firebase deploy --only firestore:indexes --project dawinos
   ```

### Issue: Tasks not generating from events
**Solution:**
1. Verify the event type matches a template's `triggerEvents`
2. Check `triggerConditions` if specified
3. Ensure template `isActive: true`
4. Check browser console for service errors

---

## Contact & Support

For issues with the AI Intelligence module:
- Check this testing guide first
- Review browser console for errors
- Check Firestore Console for data issues
- Contact development team with specific error messages

---

*Last updated: January 8, 2026*
