#!/bin/bash

# Interactive Firebase Rules Deployment
# This script will open your browser for authentication, then deploy

echo "============================================"
echo "Firebase Rules Deployment (Interactive)"
echo "============================================"
echo ""

cd /Users/macbook/cutlist-processor

echo "Step 1: Authenticating with Firebase..."
echo "This will open your browser for login."
echo ""

firebase login --reauth

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Authentication failed"
    exit 1
fi

echo ""
echo "✅ Authentication successful!"
echo ""

echo "Step 2: Deploying Firestore rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================"
    echo "✅ Deployment successful!"
    echo "============================================"
    echo ""
    echo "Updated Performance module collections:"
    echo "  • competencies - All authenticated users can create/update"
    echo "  • employee_competencies - All authenticated users can create/update"
    echo "  • training_courses - All authenticated users can create/update"
    echo "  • employee_training - All authenticated users can create"
    echo "  • performance_metrics - All authenticated users can create/update"
    echo ""
    echo "🎉 You can now seed competencies from the UI!"
    echo ""
    echo "Navigate to: http://localhost:5173/hr/performance/competencies"
    echo "Click: 'Seed Standard Competencies' button"
else
    echo ""
    echo "❌ Deployment failed"
    exit 1
fi
