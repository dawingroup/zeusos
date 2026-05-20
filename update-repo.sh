#!/bin/bash

# ===========================================
# Dawin Cutlist Processor - Update Script
# ===========================================
# Run this script from your existing repo root
# after extracting the new files alongside it
# ===========================================

echo "🔧 Updating Dawin Cutlist Processor..."

# Check if we're in a git repo
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository. Navigate to your repo first."
    exit 1
fi

# Check if the zip was extracted nearby
if [ ! -d "../dawin-cutlist-app" ]; then
    echo "❌ Error: Can't find ../dawin-cutlist-app folder"
    echo "   Please extract the zip file to the same parent directory as your repo"
    exit 1
fi

echo "📁 Copying new files..."

# Create directories if they don't exist
mkdir -p .github/workflows
mkdir -p src
mkdir -p public

# Copy Firebase configuration
cp ../dawin-cutlist-app/firebase.json ./
cp ../dawin-cutlist-app/.firebaserc ./
cp ../dawin-cutlist-app/FIREBASE_DEPLOY.md ./

# Copy GitHub Actions workflow
cp ../dawin-cutlist-app/.github/workflows/firebase-deploy.yml ./.github/workflows/

# Copy updated source files
cp ../dawin-cutlist-app/src/App.jsx ./src/
cp ../dawin-cutlist-app/src/main.jsx ./src/
cp ../dawin-cutlist-app/src/index.css ./src/

# Copy updated config files
cp ../dawin-cutlist-app/package.json ./
cp ../dawin-cutlist-app/vite.config.js ./
cp ../dawin-cutlist-app/tailwind.config.js ./
cp ../dawin-cutlist-app/postcss.config.js ./
cp ../dawin-cutlist-app/README.md ./
cp ../dawin-cutlist-app/index.html ./
cp ../dawin-cutlist-app/.gitignore ./

# Copy public assets
cp ../dawin-cutlist-app/public/favicon.svg ./public/

echo "✅ Files copied successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit .firebaserc and replace YOUR_FIREBASE_PROJECT_ID with your actual project ID"
echo "   2. Run: git add ."
echo "   3. Run: git commit -m 'Add Firebase hosting and cutting optimizer'"
echo "   4. Run: git push origin main"
echo ""
echo "🔐 Then set up GitHub Secrets for auto-deploy:"
echo "   - FIREBASE_SERVICE_ACCOUNT (from Firebase Console)"
echo "   - FIREBASE_PROJECT_ID (your project ID)"
