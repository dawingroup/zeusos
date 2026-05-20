#!/bin/bash

# ADD-FIN-001 Approval Configuration Setup
# This script uses Firebase REST API to set up the default approval configuration

echo ""
echo "=== ADD-FIN-001 Approval Configuration Setup ==="
echo ""

# Step 1: Get Firebase access token
echo "[Step 1/4] Getting Firebase access token..."
TOKEN=$(firebase login:ci --no-localhost 2>&1 | grep -oE '1//[A-Za-z0-9_-]+' | head -1)

if [ -z "$TOKEN" ]; then
  echo "❌ Could not get access token. Trying alternative method..."
  TOKEN=$(cat ~/.config/firebase/firebase_login.json 2>/dev/null | grep -oE '"access_token":"[^"]+"' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "❌ Authentication failed. Please run: firebase login"
  exit 1
fi

echo "✅ Access token obtained"

# Step 2: Get organization ID
echo ""
echo "[Step 2/4] Finding organization ID..."

# Use Firebase REST API to get organizations
ORGS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firestore.googleapis.com/v1/projects/dawinos/databases/(default)/documents/organizations?pageSize=1")

ORG_ID=$(echo "$ORGS_RESPONSE" | grep -oE 'organizations/[^"]+' | head -1 | cut -d'/' -f2)

if [ -z "$ORG_ID" ]; then
  echo "❌ No organization found. Response:"
  echo "$ORGS_RESPONSE"
  echo ""
  echo "Please create an organization in Firestore first."
  exit 1
fi

echo "✅ Found organization: $ORG_ID"

# Step 3: Create approval configuration
echo ""
echo "[Step 3/4] Creating approval configuration..."

# Prepare JSON payload
cat > /tmp/approval_config.json << EOF
{
  "fields": {
    "id": {"stringValue": "requisition_default"},
    "name": {"stringValue": "ADD-FIN-001 Default Requisition Workflow"},
    "description": {"stringValue": "Dual-approval workflow: Technical Review → Financial Approval"},
    "type": {"stringValue": "requisition"},
    "level": {"stringValue": "organization"},
    "entityId": {"stringValue": "$ORG_ID"},
    "isDefault": {"booleanValue": true},
    "isActive": {"booleanValue": true},
    "overridesDefault": {"booleanValue": false},
    "stages": {
      "arrayValue": {
        "values": [
          {
            "mapValue": {
              "fields": {
                "id": {"stringValue": "technical-review"},
                "sequence": {"integerValue": "1"},
                "name": {"stringValue": "Technical Review"},
                "description": {"stringValue": "ICE Manager reviews technical feasibility and BOQ alignment"},
                "requiredRole": {"stringValue": "ICE_MANAGER"},
                "alternativeRoles": {"arrayValue": {"values": [{"stringValue": "PROJECT_MANAGER"}]}},
                "slaHours": {"integerValue": "48"},
                "isRequired": {"booleanValue": true},
                "canSkip": {"booleanValue": false},
                "canRunInParallel": {"booleanValue": false},
                "isExternalApproval": {"booleanValue": false},
                "notifyOnAssignment": {"booleanValue": true},
                "notifyOnOverdue": {"booleanValue": true}
              }
            }
          },
          {
            "mapValue": {
              "fields": {
                "id": {"stringValue": "financial-approval"},
                "sequence": {"integerValue": "2"},
                "name": {"stringValue": "Financial Approval"},
                "description": {"stringValue": "Finance reviews budget availability and compliance"},
                "requiredRole": {"stringValue": "FINANCE"},
                "alternativeRoles": {"arrayValue": {"values": []}},
                "slaHours": {"integerValue": "72"},
                "isRequired": {"booleanValue": true},
                "canSkip": {"booleanValue": false},
                "canRunInParallel": {"booleanValue": false},
                "isExternalApproval": {"booleanValue": false},
                "notifyOnAssignment": {"booleanValue": true},
                "notifyOnOverdue": {"booleanValue": true}
              }
            }
          }
        ]
      }
    },
    "version": {"integerValue": "1"},
    "createdBy": {"stringValue": "system"},
    "updatedBy": {"stringValue": "system"},
    "reason": {"stringValue": "Initial ADD-FIN-001 system setup"}
  }
}
EOF

# Create the document
RESPONSE=$(curl -s -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/approval_config.json \
  "https://firestore.googleapis.com/v1/projects/dawinos/databases/(default)/documents/organizations/$ORG_ID/approval_config/requisition_default")

if echo "$RESPONSE" | grep -q "error"; then
  echo "❌ Failed to create configuration:"
  echo "$RESPONSE"
  exit 1
fi

echo "✅ Approval configuration created"

# Step 4: Verify
echo ""
echo "[Step 4/4] Verifying setup..."

VERIFY_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "https://firestore.googleapis.com/v1/projects/dawinos/databases/(default)/documents/organizations/$ORG_ID/approval_config/requisition_default")

if echo "$VERIFY_RESPONSE" | grep -q "requisition_default"; then
  echo "✅ Configuration verified successfully!"
else
  echo "⚠️  Could not verify configuration"
fi

# Cleanup
rm -f /tmp/approval_config.json

echo ""
echo "✅ Setup Complete!"
echo ""
echo "Firestore path:"
echo "organizations/$ORG_ID/approval_config/requisition_default"
echo ""
echo "Direct link:"
echo "https://console.firebase.google.com/project/dawinos/firestore/databases/-default-/data/~2Forganizations~2F${ORG_ID}~2Fapproval_config~2Frequisition_default"
echo ""
echo "Next steps:"
echo "1. Test creating a requisition with an existing project"
echo "2. Verify dual-approval workflow (Technical → Financial)"
echo "3. Check deadline monitoring in 1 hour"
echo ""
