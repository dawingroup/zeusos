#!/bin/bash

# Firebase Security Rules Deployment Script
# This script deploys the updated Firestore security rules

echo "============================================"
echo "Firebase Security Rules Deployment"
echo "============================================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed."
    echo "Install it with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI is installed"
echo ""

# Check if authenticated
echo "Checking Firebase authentication..."
if ! firebase projects:list &> /dev/null; then
    echo "⚠️  Not authenticated with Firebase"
    echo ""
    echo "Running: firebase login --reauth"
    firebase login --reauth

    if [ $? -ne 0 ]; then
        echo "❌ Authentication failed"
        exit 1
    fi
fi

echo "✅ Authenticated with Firebase"
echo ""

# Deploy Firestore rules
echo "Deploying Firestore security rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================"
    echo "✅ Deployment successful!"
    echo "============================================"
    echo ""
    echo "The following collections now have updated permissions:"
    echo "  • competencies - All authenticated users can create/update"
    echo "  • employee_competencies - All authenticated users can create/update"
    echo "  • training_courses - All authenticated users can create/update"
    echo "  • employee_training - All authenticated users can create"
    echo "  • performance_metrics - All authenticated users can create/update"
    echo ""
    echo "You can now seed competencies from the UI!"
else
    echo ""
    echo "❌ Deployment failed"
    echo "Check the error messages above"
    exit 1
fi
