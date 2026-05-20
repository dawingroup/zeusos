#!/bin/bash
# =============================================================================
# DAWINOS v2.0 FIRESTORE BACKUP SCRIPT
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_ID="${FIREBASE_PROJECT:-dawinos}"
BACKUP_BUCKET="${BACKUP_BUCKET:-dawinos-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PREFIX="firestore_backup_$TIMESTAMP"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}DawinOS Firestore Backup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Project: ${GREEN}$PROJECT_ID${NC}"
echo -e "Backup: ${GREEN}$BACKUP_PREFIX${NC}"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    if ! command -v gcloud &> /dev/null; then
        echo -e "${RED}Error: gcloud CLI is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Prerequisites check passed${NC}"
}

# Create backup
create_backup() {
    echo -e "${YELLOW}Creating Firestore backup...${NC}"
    
    gcloud firestore export gs://$BACKUP_BUCKET/$BACKUP_PREFIX \
        --project=$PROJECT_ID \
        --async
    
    echo -e "${GREEN}✓ Backup initiated${NC}"
    echo -e "Backup location: ${BLUE}gs://$BACKUP_BUCKET/$BACKUP_PREFIX${NC}"
}

# List recent backups
list_backups() {
    echo -e "${YELLOW}Recent backups:${NC}"
    gsutil ls -l gs://$BACKUP_BUCKET/ | tail -10
}

# Main
main() {
    check_prerequisites
    
    case "${1:-backup}" in
        backup)
            create_backup
            ;;
        list)
            list_backups
            ;;
        *)
            echo "Usage: $0 [backup|list]"
            exit 1
            ;;
    esac
}

main "$@"
