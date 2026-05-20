# Dawin Cutlist Processor - Windsurf Implementation Prompts

## Overview

This directory contains implementation prompts for the Dawin Cutlist Processor, organized by development phase. Each prompt is self-contained and can be fed directly to Windsurf (or another AI coding assistant) for implementation.

## Getting Started

1. **Read the Conditioning Prompt First**  
   Start by sharing `00-conditioning-prompt.md` with Windsurf to establish project context, tech stack, and conventions.

2. **Follow the Phase Sequence**  
   Implement prompts in order within each phase. Later prompts often depend on earlier implementations.

3. **One Prompt at a Time**  
   Each prompt is designed to be a complete implementation unit. Complete and test before moving to the next.

## Directory Structure

```
windsurf-prompts/
├── 00-conditioning-prompt.md     # Project context & conventions
├── README.md                      # This file
│
├── phase1/                        # Customer Hub Foundation
│   ├── prompt1.1-customer-data-model.md
│   ├── prompt1.2-customer-crud-hooks.md
│   ├── prompt1.3-customer-management-ui.md
│   ├── prompt1.4-katana-customer-sync.md
│   ├── prompt1.5-quickbooks-customer-sync.md
│   └── prompt1.6-google-drive-folder-creation.md
│
├── phase2/                        # Project + Drive Lifecycle
│   ├── prompt2.1-project-data-model-enhancement.md
│   ├── prompt2.2-project-development-folder.md
│   └── prompt2.3-project-confirmation-migration.md
│
├── phase3/                        # Design Item Parts Management
│   ├── prompt3.1-design-item-parts-model.md
│   ├── prompt3.2-csv-parts-import.md
│   ├── prompt3.3-parts-list-ui.md
│   └── prompt3.4-material-library.md
│
├── phase4/                        # Project-Level Cutlist Aggregation
│   ├── prompt4.1-consolidated-cutlist-model.md
│   ├── prompt4.2-cutlist-aggregation-service.md
│   ├── prompt4.3-consolidated-cutlist-ui.md
│   └── prompt4.4-consolidated-estimate.md
│
└── phase5/                        # Production Optimization (Outlines)
    ├── prompt5.1-nesting-algorithm-outline.md
    ├── prompt5.2-katana-bom-sync-outline.md
    └── prompt5.3-production-labels-outline.md
```

## Phase Summaries

### Phase 1: Customer Hub Foundation (6 prompts)
Establishes the customer entity as the root of the data hierarchy with:
- Firestore data model and TypeScript interfaces
- React CRUD hooks with real-time updates
- Customer management UI (list, form, detail views)
- External system sync: Katana MRP, QuickBooks, Google Drive

### Phase 2: Project + Drive Lifecycle (3 prompts)
Enhances the project model for the development → confirmed workflow:
- Project data model with consolidated cutlist and estimate fields
- Development folder auto-creation in ~Onzimais drive
- Project confirmation with folder migration to customer's drive

### Phase 3: Design Item Parts Management (4 prompts)
Implements parts management within design items:
- Design item model with embedded parts entries and RAG status
- CSV import from Polyboard and SketchUp exports
- Parts list UI with inline editing
- Three-tier material library management

### Phase 4: Project-Level Cutlist Aggregation (4 prompts)
Aggregates parts across all design items for optimization:
- Consolidated cutlist data model at project level
- Aggregation service with staleness detection
- Cutlist UI with material summaries and export
- Consolidated estimate calculation with QuickBooks sync

### Phase 5: Production Optimization (3 outline prompts)
Future development outlines for:
- Nesting algorithm integration (OptiCut/CutList Plus)
- Katana BOM synchronization
- Production label generation with QR codes

## Usage Tips

1. **Context Window Management**  
   For long prompts, you may need to split implementation across multiple Windsurf sessions.

2. **Testing Between Prompts**  
   Verify each implementation works before proceeding. The system builds incrementally.

3. **Reference Previous Work**  
   Windsurf can reference files created in earlier prompts. Point it to existing code when relevant.

4. **Customization**  
   Prompts include specific field names and structures. Adjust to match your existing codebase if needed.

## External Dependencies

The prompts reference these external systems:
- **Firebase** - Firestore, Cloud Functions, Authentication
- **Katana MRP** - api.katanamrp.com (requires API key)
- **QuickBooks Online** - OAuth 2.0 integration
- **Google Drive API** - Service account with domain-wide delegation

Ensure credentials are configured before implementing sync prompts.

## Current Application State

Before starting these prompts, the application already has:
- ✅ Design Manager module with projects and design items
- ✅ RAG status tracking system
- ✅ Stage-gate workflow (concept → production-ready)
- ✅ Deliverables management with file uploads
- ✅ Approval workflow
- ✅ Parameters editor for design items
- ✅ Firebase Authentication with Google OAuth
- ✅ Firestore real-time subscriptions
- ✅ Cutlist Processor module (legacy)

These prompts extend the existing functionality with customer management, parts tracking, and production optimization.
