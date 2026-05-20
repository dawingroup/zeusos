#!/bin/bash

# Deploy Firebase Rules using gcloud authentication
# This script uses gcloud credentials to deploy Firestore security rules

echo "============================================"
echo "Firebase Rules Deployment (via gcloud)"
echo "============================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed."
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI is installed"
echo ""

# Check gcloud authentication
echo "Checking gcloud authentication..."
ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)

if [ -z "$ACCOUNT" ]; then
    echo "⚠️  Not authenticated with gcloud"
    echo ""
    echo "Running: gcloud auth login"
    gcloud auth login

    if [ $? -ne 0 ]; then
        echo "❌ Authentication failed"
        exit 1
    fi

    ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
fi

echo "✅ Authenticated as: $ACCOUNT"
echo ""

# Set project
echo "Setting project to: dawinos"
gcloud config set project dawinos

# Get access token
echo "Getting access token..."
TOKEN=$(gcloud auth print-access-token 2>&1)

if [[ $TOKEN == ERROR* ]]; then
    echo "⚠️  Token expired, re-authenticating..."
    gcloud auth login
    TOKEN=$(gcloud auth print-access-token 2>&1)

    if [[ $TOKEN == ERROR* ]]; then
        echo "❌ Failed to get access token"
        exit 1
    fi
fi

echo "✅ Access token obtained"
echo ""

# Deploy using Firebase CLI with token
echo "Deploying Firestore rules..."
export FIREBASE_TOKEN="$TOKEN"
firebase deploy --only firestore:rules --token "$TOKEN"

if [ $? -eq 0 ]; then
    echo ""
    echo "============================================"
    echo "✅ Deployment successful!"
    echo "============================================"
    echo ""
    echo "Updated Performance module collections:"
    echo "  • competencies"
    echo "  • employee_competencies"
    echo "  • training_courses"
    echo "  • employee_training"
    echo "  • performance_metrics"
    echo ""
    echo "You can now seed competencies!"
else
    echo ""
    echo "❌ Deployment failed"
    echo ""
    echo "Try manual deployment:"
    echo "1. Open: https://console.firebase.google.com/project/dawinos/firestore/rules"
    echo "2. Copy the rules from: firestore.rules"
    echo "3. Click 'Publish' in the console"
    exit 1
fi
