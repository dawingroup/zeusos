# Dawin Design-to-Production Platform
# Architecture Strategy & Module Integration Guide

**Version:** 2.0  
**Date:** December 27, 2025  
**Project:** Dawin Cutlist Processor → Dawin Design-to-Production Platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Vision & Goals](#2-platform-vision--goals)
3. [Module Architecture Overview](#3-module-architecture-overview)
4. [Module Interconnection Strategy](#4-module-interconnection-strategy)
5. [AI Modules & Features](#5-ai-modules--features)
6. [Data Flow Architecture](#6-data-flow-architecture)
7. [Shared Infrastructure](#7-shared-infrastructure)
8. [External Integrations](#8-external-integrations)
9. [Legacy to Modular Migration Plan](#9-legacy-to-modular-migration-plan)
10. [Implementation Roadmap](#10-implementation-roadmap)

See `ARCHITECTURE_DIAGRAMS.md` for visual diagrams.

---

## 1. Executive Summary

The Dawin Design-to-Production Platform transforms a single-purpose cutlist processing tool into a comprehensive modular platform managing the entire millwork design-to-production workflow.

### Key Objectives

- **Modular Monolith**: Self-contained feature modules with clear boundaries
- **AI-First Design**: AI capabilities embedded at every stage
- **Seamless Integration**: Modules communicate through well-defined interfaces
- **Incremental Migration**: Legacy code migrated without breaking functionality

---

## 2. Platform Vision & Goals

### 2.1 Target Platform Structure

```
DAWIN DESIGN-TO-PRODUCTION PLATFORM
├── DESIGN MANAGER    → Workflow tracking, RAG status, approvals
├── CUTLIST PROCESSOR → CSV import, optimization, BOM output
├── PROCUREMENT       → Material orders, supplier management
└── PRODUCTION        → Shop floor tracking, quality control
         │
         └── SHARED INFRASTRUCTURE
             Firebase │ AI Services │ Notion │ Drive │ Katana
```

### 2.2 Business Goals

| Goal | Modules Involved |
|------|------------------|
| Design Tracking | Design Manager |
| Cutting Optimization | Cutlist Processor |
| Material Planning | Procurement |
| Production Visibility | Production Tracker |
| AI Automation | All Modules |

---

## 3. Module Architecture Overview

### 3.1 Module Hierarchy

```
src/
├── app/                    # Application Shell
│   ├── routes/
│   ├── pages/
│   └── providers/
├── modules/                # Feature Modules
│   ├── cutlist-processor/  # ✅ Active
│   ├── design-manager/     # 🔄 In Development
│   ├── procurement/        # 📋 Planned
│   └── production/         # 📋 Planned
└── shared/                 # Shared Infrastructure
    ├── components/
    ├── services/
    ├── hooks/
    ├── types/
    └── ai/                 # AI Services
```

### 3.2 Module Status

| Module | Status | Key Components |
|--------|--------|----------------|
| **Cutlist Processor** | ✅ Active | FileUpload, Optimizer, PDF Export |
| **Design Manager** | 🔄 Dev | Dashboard, RAG Status, Stage Gates |
| **Procurement** | 📋 Planned | Material Orders, Suppliers |
| **Production** | 📋 Planned | Work Orders, Quality Control |

---

## 4. Module Interconnection Strategy

### 4.1 Data Flow

```
Design Manager → Cutlist Processor → Procurement → Production
      │                  │                │              │
      └──────────────────┴────────────────┴──────────────┘
                              ↓
                    Shared Firestore + Events
```

### 4.2 Communication Patterns

**Pattern 1: Event-Driven (Firestore Triggers)**
```typescript
// When design item reaches "production-ready"
export const onProductionReady = onDocumentUpdated(
  'designProjects/{projectId}/designItems/{itemId}',
  async (event) => {
    if (after.currentStage === 'production-ready') {
      await createCutlistFromDesignItem(after);
      await syncToKatana(after);
    }
  }
);
```

**Pattern 2: Shared Services**
```typescript
export interface ModuleBridge {
  exportDesignToCutlist(designItemId: string): Promise<string>;
  exportBomToProcurement(cutlistId: string): Promise<string>;
}
```

**Pattern 3: URL Navigation with Context**
```typescript
const navigation = useModuleNavigation();
navigation.openCutlistForDesign(designItemId);
```

### 4.3 Cross-Module References

```typescript
interface CrossModuleRefs {
  designProjectId?: string;
  designItemId?: string;
  cutlistId?: string;
  purchaseOrderId?: string;
  workOrderId?: string;
  katanaProductId?: string;
}
```

---

## 5. AI Modules & Features

### 5.1 AI Architecture

```
AI SERVICES LAYER
├── CLAUDE API (Text, Analysis)
├── VISION MODELS (Drawing Analysis)
└── CUSTOM ML (Cost/Time Estimation)
         │
         └── AI SERVICE ORCHESTRATOR
             ├── Request routing
             ├── Prompt engineering
             ├── Response parsing
             └── Caching
```

### 5.2 Design Manager AI Features

| Feature | Model | Input | Output |
|---------|-------|-------|--------|
| **Brief Parser** | Claude | Text brief | Structured parameters |
| **DfM Analyzer** | Claude + Rules | Design params | Issues, suggestions |
| **Auto-RAG** | Claude Vision | Drawings | RAG recommendations |
| **Cost Estimator** | Custom ML | Parameters | Cost breakdown |
| **Time Estimator** | Custom ML | Complexity | Hours by department |

#### Brief Parser Example
```typescript
async function parseDesignBrief(brief: string): Promise<ParsedBrief> {
  return await claude.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    system: `Extract design parameters from briefs...`,
    messages: [{ role: 'user', content: brief }],
    tools: [{ name: 'extract_design_parameters', ... }]
  });
}
```

#### DfM Rules Engine
```typescript
const DFM_RULES: DfMRule[] = [
  {
    id: 'MIN_PANEL_THICKNESS',
    check: (params) => {
      if (params.width > 600 && params.thickness < 18) {
        return { severity: 'error', message: 'Needs 18mm minimum' };
      }
    }
  },
  // 50+ rules for structural, material, joinery, finish
];
```

### 5.3 Cutlist Processor AI Features

| Feature | Model | Input | Output |
|---------|-------|-------|--------|
| **Smart Material Mapping** | Claude | Unknown material | Suggested mapping |
| **Optimization Advisor** | Rules + ML | Panel data | Optimal settings |
| **Anomaly Detection** | Custom ML | Dimensions | Flagged items |

### 5.4 AI Integration Points

```
DESIGN PHASE          PLANNING PHASE        PRODUCTION PHASE
─────────────         ──────────────        ────────────────
Brief Parser    →     Material Mapper  →    Schedule Optimizer
DfM Analyzer    →     Optimization     →    Quality Predictor
Cost Estimator  →     Anomaly Detect   →    Report Generator
```

---

## 6. Data Flow Architecture

### 6.1 Firestore Structure

```
/users/{userId}
/designProjects/{projectId}
  └── /designItems/{itemId}
/workInstances/{instanceId}
/materialMappings/{mappingId}
/stockMaterials/{materialId}
/aiAnalyses/{analysisId}
```

### 6.2 Real-Time Sync

```typescript
export function useRealtimeSync<T>(path: string) {
  return onSnapshot(collection(db, path), (snapshot) => {
    setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  });
}
```

---

## 7. Shared Infrastructure

### 7.1 Directory Structure

```
src/shared/
├── services/
│   ├── firebase/       # Config, Firestore, Auth, Storage
│   ├── external/       # Notion, Drive, Katana
│   ├── ai/             # AI orchestrator, models
│   └── module-bridge/  # Cross-module communication
├── hooks/              # useAuth, useFirestore, etc.
├── components/
│   ├── ui/             # shadcn/ui components
│   ├── layout/         # AppLayout, Header, Nav
│   └── feedback/       # Toast, Loading, Error
└── types/              # Common types
```

---

## 8. External Integrations

### 8.1 Integration Map

| Service | Purpose | Sync Points |
|---------|---------|-------------|
| **Notion** | Projects, Clients | Customer selector, Activity log |
| **Google Drive** | Files, Auto-save | CSV import, Output export |
| **Katana MRP** | Manufacturing | Products, BOMs, Orders |
| **Claude AI** | Intelligence | Brief parsing, DfM analysis |

### 8.2 API Proxy Architecture

```
Frontend → Firebase Functions → External APIs
           (secure keys, rate limiting, caching)
```

---

## 9. Legacy to Modular Migration Plan

### 9.1 Migration Phases

| Phase | Timeline | Objective |
|-------|----------|-----------|
| **1. Foundation** | Week 1-2 | Create module structure ✅ |
| **2. Extraction** | Week 3-4 | Move legacy code 🔄 |
| **3. Integration** | Week 5-6 | Wire up modules 📋 |

### 9.2 File Migration Map

```
LEGACY                          → MODULE LOCATION
─────────────────────────────────────────────────
src/App.jsx                     → Split into modules
src/components/FileUpload.jsx   → cutlist-processor/components/
src/services/driveService.js    → shared/services/external/
src/contexts/AuthContext.jsx    → shared/contexts/
src/utils/optimizationEngine.js → cutlist-processor/utils/
```

### 9.3 Rollback Strategy

```typescript
// Feature flag for legacy vs modular mode
if (import.meta.env.VITE_MODULAR_MODE) {
  // New modular routing
} else {
  // Legacy monolithic App
}
```

---

## 10. Implementation Roadmap

### Q1 2025: Foundation & Design Manager
- [x] Module folder structure
- [x] Shared infrastructure
- [x] Design Manager types
- [ ] Stage-gate workflow
- [ ] AI Brief Parser
- [ ] AI DfM Analyzer

### Q2 2025: Migration & AI
- [ ] Extract legacy cutlist code
- [ ] ModuleBridge service
- [ ] Firestore triggers
- [ ] Smart Material Mapping
- [ ] Katana integration
- [ ] Procurement foundation

---

**See also:**
- `ARCHITECTURE_DIAGRAMS.md` - Visual diagrams
- `AI_FEATURES_DETAIL.md` - Detailed AI specifications
- `MIGRATION_SCRIPTS.md` - Migration automation
