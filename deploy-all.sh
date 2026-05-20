#!/bin/bash

# Complete Firebase Deployment Script
# Builds the app and deploys to Firebase Hosting + Firestore Rules

set -e  # Exit on error

echo "============================================"
echo "Firebase Complete Deployment"
echo "============================================"
echo ""

cd /Users/macbook/cutlist-processor

# Step 1: Clean previous builds
echo "Step 1: Cleaning previous builds..."
rm -rf dist
echo "✅ Cleaned dist directory"
echo ""

# Step 2: Build the React app
echo "Step 2: Building React application..."
echo "Running: npm run build"
npm run build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed successfully"
echo ""

# Step 3: Verify build output
if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo "❌ Build output not found in dist directory"
    exit 1
fi

echo "✅ Build output verified"
echo ""

# Step 4: Deploy to Firebase
echo "Step 3: Deploying to Firebase..."
echo "This will deploy:"
echo "  • Hosting (from dist/)"
echo "  • Firestore Rules"
echo ""

firebase deploy --only hosting,firestore:rules

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================"
    echo "✅ Deployment successful!"
    echo "============================================"
    echo ""
    echo "Deployed components:"
    echo "  ✅ React App to Firebase Hosting"
    echo "  ✅ Firestore Security Rules"
    echo ""
    echo "Updated Firestore Rules for Performance Module:"
    echo "  • competencies - All authenticated users can create/update"
    echo "  • employee_competencies - All authenticated users can create/update"
    echo "  • training_courses - All authenticated users can create/update"
    echo "  • employee_training - All authenticated users can create"
    echo "  • performance_metrics - All authenticated users can create/update"
    echo ""
    echo "🎉 Your app is now live!"
    echo ""
    echo "View your app at:"
    firebase hosting:channel:list 2>/dev/null | grep -o 'https://[^[:space:]]*' | head -1 || echo "  Run 'firebase open hosting:site' to see your URL"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi
