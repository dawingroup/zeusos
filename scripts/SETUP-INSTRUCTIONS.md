# ADD-FIN-001 Setup Instructions

## Quick Setup (2 commands)

Since we're having authentication issues with scripts, here's the simplest approach:

### Step 1: Authenticate with gcloud

```bash
gcloud auth application-default login
```

This will open your browser for authentication.

### Step 2: Run the setup command

```bash
cd /Users/ofd/CascadeProjects/cutlist-processor
node scripts/setup-approval-config.cjs
```

That's it! The script will:
1. Find your organization ID automatically
2. Create the approval configuration
3. Verify everything works

---

## Alternative: Manual Setup via Firebase Console

If you prefer to do it manually (or if the script still has issues):

### Step 1: Get Your Organization ID

Visit: https://console.firebase.google.com/project/dawinos/firestore/databases/-default-/data/~2Forganizations

Click on any organization document and copy its ID from the URL.

### Step 2: Create the Configuration

1. In that organization document, click "Start collection"
2. Collection ID: `approval_config`
3. Document ID: `requisition_default`
4. Add these fields one by one:

**Simple Fields:**
- `id` (string): `requisition_default`
- `name` (string): `ADD-FIN-001 Default Requisition Workflow`
- `description` (string): `Dual-approval workflow: Technical Review → Financial Approval`
- `type` (string): `requisition`
- `level` (string): `organization`
- `entityId` (string): `YOUR_ORG_ID` ← Use the ID from Step 1
- `isDefault` (boolean): `true`
- `isActive` (boolean): `true`
- `overridesDefault` (boolean): `false`
- `version` (number): `1`
- `createdBy` (string): `system`
- `updatedBy` (string): `system`
- `reason` (string): `Initial ADD-FIN-001 system setup`

**Array Field - stages:**

Click "Add field" → Field: `stages` → Type: `array`

Add first array element (Technical Review):
- Click "+ Add item" → Type: `map`
- Add these fields to the map:
  - `id` (string): `technical-review`
  - `sequence` (number): `1`
  - `name` (string): `Technical Review`
  - `description` (string): `ICE Manager reviews technical feasibility and BOQ alignment`
  - `requiredRole` (string): `ICE_MANAGER`
  - `alternativeRoles` (array): Add string `PROJECT_MANAGER`
  - `slaHours` (number): `48`
  - `isRequired` (boolean): `true`
  - `canSkip` (boolean): `false`
  - `canRunInParallel` (boolean): `false`
  - `isExternalApproval` (boolean): `false`
  - `notifyOnAssignment` (boolean): `true`
  - `notifyOnOverdue` (boolean): `true`

Add second array element (Financial Approval):
- Click "+ Add item" → Type: `map`
- Add these fields to the map:
  - `id` (string): `financial-approval`
  - `sequence` (number): `2`
  - `name` (string): `Financial Approval`
  - `description` (string): `Finance reviews budget availability and compliance`
  - `requiredRole` (string): `FINANCE`
  - `alternativeRoles` (array): Leave empty
  - `slaHours` (number): `72`
  - `isRequired` (boolean): `true`
  - `canSkip` (boolean): `false`
  - `canRunInParallel` (boolean): `false`
  - `isExternalApproval` (boolean): `false`
  - `notifyOnAssignment` (boolean): `true`
  - `notifyOnOverdue` (boolean): `true`

5. Click "Save"

---

## Even Simpler: JSON Import

If the Firebase Console supports JSON import (it should), use this:

1. Navigate to: https://console.firebase.google.com/project/dawinos/firestore/databases/-default-/data/~2Forganizations~2FYOUR_ORG_ID~2Fapproval_config

2. Click "Add document"

3. Document ID: `requisition_default`

4. Switch to "JSON" mode (if available)

5. Paste this (replace YOUR_ORG_ID):

```json
{
  "id": "requisition_default",
  "name": "ADD-FIN-001 Default Requisition Workflow",
  "description": "Dual-approval workflow: Technical Review → Financial Approval",
  "type": "requisition",
  "level": "organization",
  "entityId": "YOUR_ORG_ID",
  "isDefault": true,
  "isActive": true,
  "overridesDefault": false,
  "stages": [
    {
      "id": "technical-review",
      "sequence": 1,
      "name": "Technical Review",
      "description": "ICE Manager reviews technical feasibility and BOQ alignment",
      "requiredRole": "ICE_MANAGER",
      "alternativeRoles": ["PROJECT_MANAGER"],
      "slaHours": 48,
      "isRequired": true,
      "canSkip": false,
      "skipConditions": [],
      "canRunInParallel": false,
      "parallelGroupId": null,
      "isExternalApproval": false,
      "externalApproverEmail": null,
      "externalApproverName": null,
      "notifyOnAssignment": true,
      "notifyOnOverdue": true,
      "escalationRules": []
    },
    {
      "id": "financial-approval",
      "sequence": 2,
      "name": "Financial Approval",
      "description": "Finance reviews budget availability and compliance",
      "requiredRole": "FINANCE",
      "alternativeRoles": [],
      "slaHours": 72,
      "isRequired": true,
      "canSkip": false,
      "skipConditions": [],
      "canRunInParallel": false,
      "parallelGroupId": null,
      "isExternalApproval": false,
      "externalApproverEmail": null,
      "externalApproverName": null,
      "notifyOnAssignment": true,
      "notifyOnOverdue": true,
      "escalationRules": []
    }
  ],
  "version": 1,
  "previousVersionId": null,
  "createdBy": "system",
  "updatedBy": "system",
  "reason": "Initial ADD-FIN-001 system setup"
}
```

---

## Verify Setup

After creating the configuration (via any method), verify it works:

### Via Firebase Console:
Visit: https://console.firebase.google.com/project/dawinos/firestore/databases/-default-/data/~2Forganizations~2FYOUR_ORG_ID~2Fapproval_config~2Frequisition_default

You should see your configuration with 2 stages.

### Via Code:
The enhanced requisition service will automatically use this configuration when creating requisitions.

---

## What's Next?

Once the configuration is created, you can immediately:

1. **Test with an existing project** - Create a requisition using `RequisitionFormEnhanced`
2. **Verify BOQ integration** - Check that BOQ validation works
3. **Test approval workflow** - Ensure dual-approval (Technical → Financial) works
4. **Monitor deadlines** - Wait for hourly check or trigger manually

The system is fully deployed and ready to use! 🚀
