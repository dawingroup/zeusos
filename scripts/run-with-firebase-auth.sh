#!/bin/bash

# This script runs the event generation using Firebase authentication
# It extracts the access token from Firebase CLI and uses it

echo "🔐 Getting Firebase access token..."

# Try to get a valid Firebase token
FIREBASE_TOKEN=$(firebase login:ci --no-localhost 2>&1 || echo "")

if [ -z "$FIREBASE_TOKEN" ]; then
  echo "❌ Could not get Firebase token automatically"
  echo ""
  echo "Please download service account key manually:"
  echo "1. Go to: https://console.firebase.google.com/project/dawinos/settings/serviceaccounts/adminsdk"
  echo "2. Click 'Generate new private key'"
  echo "3. Save as: /Users/macbook/cutlist-processor/service-account-key.json"
  echo ""
  echo "Then run: npm run generate:design-events -- --dry-run"
  exit 1
fi

# Export the token
export FIREBASE_TOKEN

echo "✓ Firebase token obtained"
echo ""

# Run the script
node scripts/generate-design-manager-events.cjs "$@"
