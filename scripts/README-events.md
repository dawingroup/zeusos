# Business Event Generation Scripts

This directory contains scripts for generating business events to trigger the Intelligence Layer task system.

## Generate Design Manager Events

Creates business events for existing Design Manager projects.

### Prerequisites

1. Firebase service account key file
2. Node.js installed
3. Firebase Admin SDK

### Usage

```bash
# Dry run (preview without making changes)
npm run generate:design-events -- --dry-run

# Generate events for real
npm run generate:design-events
```

### What it does

1. Fetches all projects from `designProjects` collection
2. Determines appropriate event type based on project stage
3. Creates business events in `businessEvents` collection
4. Skips projects that already have events
5. Provides detailed statistics

### Event Types Generated

Based on project stage (mapped to actual event-catalog events):
- `brief` → `finishes.client_consultation_scheduled`
- `scoping` → `finishes.space_planning_requested`
- `design` → `finishes.design_concepts_created`
- `review` → `finishes.design_approval_requested`
- `approval` → `finishes.client_feedback_received`
- `production` → `finishes.design_production_ready`
- `delivery` → `finishes.installation_scheduled`
- `completed` → `finishes.installation_complete`

### Environment Setup

Set the path to your service account key:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

Or place `service-account-key.json` in the project root.

### Output

The script provides:
- Progress updates for each project
- Summary statistics
- Events grouped by type and stage
- Error reporting

### Safety Features

- **Dry run mode**: Test without making changes
- **Duplicate detection**: Skips projects with existing events
- **Error handling**: Continues processing even if individual projects fail
- **Detailed logging**: Track exactly what's happening

### After Running

Once events are created, the Intelligence Layer will:
1. Process the events
2. Generate appropriate tasks
3. Assign tasks to team members based on roles
4. Send notifications to assignees

Monitor progress in the Intelligence Admin Console at `/ai/admin`.
