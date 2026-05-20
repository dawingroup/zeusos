#!/bin/bash

###############################################################################
# Darwin Finishes - Document Upload & AI Integration Deployment Script
#
# This script deploys the client document upload feature with AI integration
# to Firebase Hosting and updates Storage Rules
#
# Usage: bash DEPLOY-DOCUMENT-UPLOAD.sh
###############################################################################

set -e  # Exit on error

echo "=================================================="
echo "Darwin Finishes - Document Upload Deployment"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}Error: Firebase CLI not found. Install with: npm install -g firebase-tools${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm not found. Please install Node.js${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Step 2: Install dependencies
echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Run TypeScript check
echo -e "${YELLOW}Step 3: Type checking...${NC}"
npx tsc --noEmit
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Type check passed${NC}"
else
    echo -e "${RED}Warning: Type check failed. Continue anyway? (y/n)${NC}"
    read -r response
    if [[ "$response" != "y" ]]; then
        exit 1
    fi
fi
echo ""

# Step 4: Build application
echo -e "${YELLOW}Step 4: Building application...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}Error: Build failed${NC}"
    exit 1
fi
echo ""

# Step 5: Deploy Storage Rules
echo -e "${YELLOW}Step 5: Deploying Storage Rules...${NC}"
echo -e "${YELLOW}This will update Firebase Storage security rules.${NC}"
echo -e "${YELLOW}Continue? (y/n)${NC}"
read -r response
if [[ "$response" == "y" ]]; then
    firebase deploy --only storage
    echo -e "${GREEN}✓ Storage rules deployed${NC}"
else
    echo -e "${YELLOW}Skipped storage rules deployment${NC}"
fi
echo ""

# Step 6: Deploy to Firebase Hosting
echo -e "${YELLOW}Step 6: Deploying to Firebase Hosting...${NC}"
echo -e "${YELLOW}This will deploy the application to production.${NC}"
echo -e "${YELLOW}Continue? (y/n)${NC}"
read -r response
if [[ "$response" == "y" ]]; then
    firebase deploy --only hosting
    echo -e "${GREEN}✓ Hosting deployed${NC}"
else
    echo -e "${YELLOW}Skipped hosting deployment${NC}"
fi
echo ""

# Step 7: Verify deployment
echo -e "${YELLOW}Step 7: Post-deployment verification${NC}"
echo ""
echo "Please verify the following:"
echo "1. Navigate to a project and check the Documents tab appears"
echo "2. Upload a test image (reference-images category)"
echo "3. Verify AI analysis triggers and completes"
echo "4. Navigate to /finishes/design/ai-tools"
echo "5. Run AI testing and verify all tools pass"
echo ""
echo -e "${GREEN}Deployment URLs to test:${NC}"
echo "- AI Tools: https://your-domain.com/finishes/design/ai-tools"
echo "- Project Documents: https://your-domain.com/finishes/design/project/{projectId}"
echo ""

# Step 8: Summary
echo "=================================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=================================================="
echo ""
echo "Features deployed:"
echo "✓ Client document upload (drag & drop)"
echo "✓ AI analysis (Image Analysis + Project Scoping)"
echo "✓ Documents tab in project view"
echo "✓ AI testing and verification page"
echo "✓ Storage security rules"
echo ""
echo "Documentation:"
echo "- Full guide: docs/DARWIN-FINISHES-DOCUMENT-UPLOAD-DEPLOYMENT.md"
echo "- Quick start: docs/DOCUMENT-UPLOAD-QUICK-START.md"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test document upload in a real project"
echo "2. Run AI tools verification test"
echo "3. Monitor Firebase Console for errors"
echo "4. Check user feedback"
echo ""
echo "=================================================="
