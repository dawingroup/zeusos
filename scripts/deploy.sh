#!/bin/bash
# =============================================================================
# DAWINOS v2.0 DEPLOYMENT SCRIPT
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="${FIREBASE_PROJECT:-dawinos}"
ENVIRONMENT="${1:-production}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DawinOS v2.0 Deployment${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "Project: ${GREEN}$PROJECT_ID${NC}"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Error: Node.js is not installed${NC}"
        exit 1
    fi
    
    if ! command -v firebase &> /dev/null; then
        echo -e "${RED}Error: Firebase CLI is not installed${NC}"
        echo "Install with: npm install -g firebase-tools"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Run tests
run_tests() {
    echo -e "${YELLOW}Running tests...${NC}"
    npm run test:unit -- --run
    echo -e "${GREEN}✓ Tests passed${NC}"
}

# Build application
build_app() {
    echo -e "${YELLOW}Building application...${NC}"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        VITE_APP_ENV=production npm run build
    else
        VITE_APP_ENV=staging npm run build
    fi
    
    echo -e "${GREEN}✓ Build completed${NC}"
}

# Deploy Firestore rules
deploy_firestore_rules() {
    echo -e "${YELLOW}Deploying Firestore rules...${NC}"
    firebase deploy --only firestore:rules --project "$PROJECT_ID"
    echo -e "${GREEN}✓ Firestore rules deployed${NC}"
}

# Deploy Firestore indexes
deploy_firestore_indexes() {
    echo -e "${YELLOW}Deploying Firestore indexes...${NC}"
    firebase deploy --only firestore:indexes --project "$PROJECT_ID"
    echo -e "${GREEN}✓ Firestore indexes deployed${NC}"
}

# Deploy Storage rules
deploy_storage_rules() {
    echo -e "${YELLOW}Deploying Storage rules...${NC}"
    firebase deploy --only storage --project "$PROJECT_ID"
    echo -e "${GREEN}✓ Storage rules deployed${NC}"
}

# Deploy hosting
deploy_hosting() {
    echo -e "${YELLOW}Deploying hosting...${NC}"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        firebase deploy --only hosting --project "$PROJECT_ID"
    else
        firebase hosting:channel:deploy "$ENVIRONMENT" --project "$PROJECT_ID" --expires 30d
    fi
    
    echo -e "${GREEN}✓ Hosting deployed${NC}"
}

# Main deployment flow
main() {
    check_prerequisites
    
    # Ask for confirmation in production
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "${RED}WARNING: You are about to deploy to PRODUCTION${NC}"
        read -p "Are you sure you want to continue? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Run deployment steps
    run_tests
    build_app
    deploy_firestore_rules
    deploy_firestore_indexes
    deploy_storage_rules
    deploy_hosting
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "URL: ${BLUE}https://dawinos.web.app${NC}"
    else
        echo -e "URL: ${BLUE}https://dawinos--${ENVIRONMENT}.web.app${NC}"
    fi
}

# Run main function
main
