#!/bin/bash
set -e

# Configuration
PROJECT_ID="dawinos"
GITHUB_ORG="dawingroup"
GITHUB_REPO="dawinos"
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"
SA_NAME="firebase-github-deploy"

echo "=========================================="
echo "Firebase Workload Identity Federation Setup"
echo "=========================================="
echo ""
echo "Project: $PROJECT_ID"
echo "GitHub:  $GITHUB_ORG/$GITHUB_REPO"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed."
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if authenticated
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1)
if [ -z "$ACTIVE_ACCOUNT" ]; then
    echo "Error: Not authenticated with gcloud. Run: gcloud auth login"
    exit 1
fi
echo "Authenticated as: $ACTIVE_ACCOUNT"
echo ""

echo "Step 1/6: Enabling required APIs..."
gcloud services enable iamcredentials.googleapis.com --project $PROJECT_ID
gcloud services enable iam.googleapis.com --project $PROJECT_ID
echo "✓ APIs enabled"

echo ""
echo "Step 2/6: Creating Workload Identity Pool..."
if gcloud iam workload-identity-pools describe $POOL_NAME --project=$PROJECT_ID --location="global" > /dev/null 2>&1; then
    echo "✓ Pool already exists"
else
    gcloud iam workload-identity-pools create $POOL_NAME \
        --project=$PROJECT_ID \
        --location="global" \
        --display-name="GitHub Actions Pool"
    echo "✓ Pool created"
fi

echo ""
echo "Step 3/6: Creating OIDC Provider..."
if gcloud iam workload-identity-pools providers describe $PROVIDER_NAME --project=$PROJECT_ID --location="global" --workload-identity-pool=$POOL_NAME > /dev/null 2>&1; then
    echo "✓ Provider already exists"
else
    gcloud iam workload-identity-pools providers create-oidc $PROVIDER_NAME \
        --project=$PROJECT_ID \
        --location="global" \
        --workload-identity-pool=$POOL_NAME \
        --display-name="GitHub Provider" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
        --attribute-condition="assertion.repository_owner == '${GITHUB_ORG}'" \
        --issuer-uri="https://token.actions.githubusercontent.com"
    echo "✓ Provider created"
fi

echo ""
echo "Step 4/6: Creating Service Account..."
if gcloud iam service-accounts describe "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" --project=$PROJECT_ID > /dev/null 2>&1; then
    echo "✓ Service account already exists"
else
    gcloud iam service-accounts create $SA_NAME \
        --project=$PROJECT_ID \
        --display-name="Firebase GitHub Deploy"
    echo "✓ Service account created"
fi

echo ""
echo "Step 5/6: Granting Firebase deployment permissions..."
ROLES=(
    "roles/firebase.admin"
    "roles/cloudfunctions.admin"
    "roles/iam.serviceAccountUser"
    "roles/run.admin"
    "roles/storage.admin"
    "roles/firebasehosting.admin"
)

for role in "${ROLES[@]}"; do
    echo "  Adding $role..."
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="$role" \
        --quiet > /dev/null
done
echo "✓ Permissions granted"

echo ""
echo "Step 6/6: Configuring Workload Identity binding..."
POOL_ID=$(gcloud iam workload-identity-pools describe $POOL_NAME \
    --project=$PROJECT_ID \
    --location="global" \
    --format="value(name)")

gcloud iam service-accounts add-iam-policy-binding \
    "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --project=$PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${GITHUB_ORG}/${GITHUB_REPO}" \
    --quiet > /dev/null
echo "✓ Workload Identity binding configured"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Add these secrets to GitHub:"
echo "(Settings → Secrets and variables → Actions)"
echo ""

WIF_PROVIDER=$(gcloud iam workload-identity-pools providers describe $PROVIDER_NAME \
    --project=$PROJECT_ID \
    --location="global" \
    --workload-identity-pool=$POOL_NAME \
    --format="value(name)")

echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│ Secret: WIF_PROVIDER                                           │"
echo "├─────────────────────────────────────────────────────────────────┤"
echo "│ $WIF_PROVIDER"
echo "├─────────────────────────────────────────────────────────────────┤"
echo "│ Secret: WIF_SERVICE_ACCOUNT                                    │"
echo "├─────────────────────────────────────────────────────────────────┤"
echo "│ ${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com               │"
echo "└─────────────────────────────────────────────────────────────────┘"
echo ""
echo "After adding secrets, push to 'main' or create a PR to trigger deployment."
echo ""
echo "IMPORTANT: Delete any service account keys you created earlier!"
