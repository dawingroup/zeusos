#!/bin/bash

# Deploy Firestore Indexes and Hosting
# This script deploys the updated indexes and the latest build

set -e

echo "============================================"
echo "Firebase Deployment - Indexes & Hosting"
echo "============================================"
echo ""

cd /Users/macbook/cutlist-processor

# Step 1: Authenticate
echo "Step 1: Authenticating with Firebase..."
firebase login --reauth

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Authentication failed"
    exit 1
fi

echo ""
echo "✅ Authentication successful!"
echo ""

# Step 2: Deploy Firestore Indexes
echo "Step 2: Deploying Firestore indexes..."
echo "This will create the missing index for competencies (companyId + category + name)"
firebase deploy --only firestore:indexes

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Index deployment failed"
    exit 1
fi

echo ""
echo "✅ Indexes deployed successfully!"
echo ""

# Step 3: Build the app
echo "Step 3: Building React application..."
npm run build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Build failed"
    exit 1
fi

echo ""
echo "✅ Build completed successfully!"
echo ""

# Step 4: Deploy Hosting
echo "Step 4: Deploying to Firebase Hosting..."
firebase deploy --only hosting

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================"
    echo "✅ Deployment successful!"
    echo "============================================"
    echo ""
    echo "Deployed components:"
    echo "  ✅ Firestore Indexes (competencies fix)"
    echo "  ✅ React App to Firebase Hosting"
    echo ""
    echo "🎉 Your app is now live!"
    echo ""
    echo "View your app at: https://dawinos.web.app"
    echo ""
    echo "Important Notes:"
    echo "  • The new competencies index will take 5-10 minutes to build"
    echo "  • Check index status: https://console.firebase.google.com/project/dawinos/firestore/indexes"
    echo "  • Competency seeding will work once the index is ready"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi
