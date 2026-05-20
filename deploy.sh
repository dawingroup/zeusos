#!/usr/bin/env bash

# Cutlist Processor v1.1 Deployment Script
# This script helps deploy the enhanced cutlist processor with all integrations

set -euo pipefail

echo "🚀 Cutlist Processor v1.1 Deployment Script"
echo "============================================="

FIREBASE_CLI=(npx -y firebase-tools@latest)
FIREBASE_ENV=(NO_UPDATE_NOTIFIER=1 CI=true)

run_firebase() {
    local out
    local code

    set +e
    out="$(env "${FIREBASE_ENV[@]}" "${FIREBASE_CLI[@]}" "$@" 2>&1)"
    code=$?
    set -e

    printf '%s\n' "$out"

    # firebase-tools can occasionally return non-zero after a successful deploy
    # due to local updater/config-store issues. If deploy completed, continue.
    if [ $code -ne 0 ]; then
        if [[ "$out" == *"Deploy complete!"* ]]; then
            echo "⚠️  Firebase CLI exited non-zero after successful deploy; continuing."
            return 0
        fi
        return $code
    fi

    return 0
}

# Check if user is logged in to Firebase
if ! run_firebase projects:list > /dev/null; then
    echo "🔐 Please login to Firebase first:"
    env "${FIREBASE_ENV[@]}" "${FIREBASE_CLI[@]}" login --reauth
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Please copy .env.example to .env and configure it."
    echo "   cp .env.example .env"
    echo "   Then edit .env with your Firebase and API configurations."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

echo "📦 Installing Functions dependencies..."
cd functions
npm install
cd ..

# Build the project
echo "🔨 Building project..."
npm run build

# Deploy functions first (they take longer)
echo "☁️  Deploying Firebase Functions..."
run_firebase deploy --only functions

# Deploy hosting
echo "🌐 Deploying to Firebase Hosting..."
run_firebase deploy --only hosting

# Get the hosting URL
PROJECT_ID="$(run_firebase use --current | tail -n 1)"
HOSTING_URL="https://${PROJECT_ID}.web.app"

echo ""
echo "✅ Deployment completed successfully!"
echo "🌐 Your app is available at: ${HOSTING_URL}"
echo ""
echo "📋 Next steps:"
echo "1. Configure your Firebase Authentication providers"
echo "2. Set up your Notion databases and share them with your integration"
echo "3. Test the authentication and file upload functionality"
echo "4. Verify Google Drive auto-save is working"
echo ""
echo "📖 For detailed setup instructions, see SETUP.md"
