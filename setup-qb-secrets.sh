#!/bin/bash

# ============================================================================
# QuickBooks Secrets Setup Script
# Generates secure encryption keys and configures Firebase
# ============================================================================

echo "🔐 QuickBooks OAuth Setup Script"
echo "=================================="
echo ""

# Check if running in the correct directory
if [ ! -f ".firebaserc" ]; then
  echo "❌ Error: Must run from project root directory"
  exit 1
fi

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
  echo "❌ Error: Firebase CLI not installed. Run: npm install -g firebase-tools"
  exit 1
fi

echo "📝 Step 1: Enter QuickBooks OAuth Credentials"
echo "Get these from: https://developer.intuit.com/app/developer/dashboard"
echo ""

read -p "QuickBooks Client ID: " CLIENT_ID
read -p "QuickBooks Client Secret: " CLIENT_SECRET

if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
  echo "❌ Error: Client ID and Secret are required"
  exit 1
fi

echo ""
echo "🔑 Step 2: Generating Encryption Keys"
echo ""

# Generate 32-byte hex keys for encryption
TOKEN_ENCRYPTION_KEY=$(openssl rand -hex 32)
OAUTH_STATE_SECRET=$(openssl rand -hex 32)

echo "✅ Encryption keys generated"
echo ""

echo "🔧 Step 3: Configuring Firebase Functions"
echo ""

# Set Firebase Functions config
firebase functions:config:set \
  quickbooks.client_id="$CLIENT_ID" \
  quickbooks.client_secret="$CLIENT_SECRET" \
  quickbooks.redirect_uri="https://us-central1-dawinos.cloudfunctions.net/qbCallback"

echo ""
echo "✅ Firebase config set"
echo ""

echo "🔐 Step 4: Setting Up Secrets"
echo ""
echo "IMPORTANT: You need to create these secrets manually in Google Cloud Console:"
echo ""
echo "1. Go to: https://console.cloud.google.com/security/secret-manager?project=dawinos"
echo "2. Click 'CREATE SECRET'"
echo "3. Create the following secrets:"
echo ""
echo "   Secret Name: QBO_TOKEN_ENCRYPTION_KEY"
echo "   Secret Value: $TOKEN_ENCRYPTION_KEY"
echo ""
echo "   Secret Name: QBO_OAUTH_STATE_SECRET"
echo "   Secret Value: $OAUTH_STATE_SECRET"
echo ""
echo "4. Grant 'Secret Manager Secret Accessor' role to:"
echo "   dawinos@appspot.gserviceaccount.com"
echo ""
echo "📋 Save these keys securely (you'll need them):"
echo "================================================"
echo "QBO_TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY"
echo "QBO_OAUTH_STATE_SECRET=$OAUTH_STATE_SECRET"
echo "================================================"
echo ""
echo "💾 Saving to .env.local (DO NOT COMMIT THIS FILE)"

cat > .env.local << EOF
# QuickBooks OAuth Credentials
QUICKBOOKS_CLIENT_ID=$CLIENT_ID
QUICKBOOKS_CLIENT_SECRET=$CLIENT_SECRET
QUICKBOOKS_REDIRECT_URI=https://us-central1-dawinos.cloudfunctions.net/qbCallback

# Encryption Keys (for local development only)
QBO_TOKEN_ENCRYPTION_KEY=$TOKEN_ENCRYPTION_KEY
QBO_OAUTH_STATE_SECRET=$OAUTH_STATE_SECRET
EOF

echo "✅ Configuration saved to .env.local"
echo ""
echo "🚀 Next Steps:"
echo "1. Set up secrets in Google Cloud Console (see instructions above)"
echo "2. Deploy your functions: firebase deploy --only functions"
echo "3. Connect to QuickBooks from Finance → Integrations page"
echo ""
echo "✅ Setup complete!"
