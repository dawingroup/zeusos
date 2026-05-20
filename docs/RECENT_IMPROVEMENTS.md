# Recent Improvements - December 27, 2025

## Overview

This document summarizes the recent architectural improvements to the Dawin Cutlist Processor, focusing on the new Project-Level Optimization system.

---

## 1. Optimization State Architecture

### New Types (`src/shared/types/project.ts`)

| Type | Description |
|------|-------------|
| `OptimizationState` | Complete optimization state for a project |
| `EstimationResult` | Stage 3 results: sheet summary, rough cost, waste estimate |
| `ProductionResult` | Stage 4 results: nesting sheets, cut sequence, yield |
| `OptimizationConfig` | Persisted settings: kerf, stock sheets, grain matching |
| `ProjectSnapshot` | Change detection snapshot for invalidation |
| `OptimizationRAGStatus` | Red-Amber-Green status for optimization workflow |

### Project Schema Extension

```typescript
interface Project {
  // ... existing fields
  optimizationState?: OptimizationState;
  optimizationRAG?: OptimizationRAGStatus;
  materialPalette?: MaterialPalette;
  lastSnapshot?: ProjectSnapshot;
}
```

---

## 2. Invalidation Detection System

### Service (`src/shared/services/optimization/InvalidationDetector.ts`)

Automatically detects when optimization results become stale:

| Trigger | Effect |
|---------|--------|
| Part added/removed | Invalidates Estimation + Production |
| Part dimensions changed | Invalidates Estimation + Production |
| Material changed | Invalidates Estimation + Production |
| Stock config changed | Invalidates Estimation + Production |
| Design item added/removed | Invalidates Estimation + Production |

### RAG Status Service (`src/shared/services/ragService.ts`)

```typescript
updateOptimizationRAG(project); // Returns { estimation, production, katanaBOM }

// Status values:
// 🔴 RED    - No optimization run
// 🟡 AMBER  - Results invalidated
// 🟢 GREEN  - Results current
// ⚪ GREY   - Not applicable
```

---

## 3. Optimization Engine

### Extracted Service (`src/shared/services/optimization/`)

| File | Purpose |
|------|---------|
| `OptimizationService.ts` | Core guillotine bin-packing algorithm |
| `projectOptimization.ts` | Project-level actions with Firestore persistence |
| `InvalidationDetector.ts` | Change detection and invalidation |

### Two Modes

| Mode | Function | Purpose |
|------|----------|---------|
| **ESTIMATION** | `runProjectEstimation()` | Fast quoting (~70% utilization + 15% buffer) |
| **PRODUCTION** | `runProjectProduction()` | Full optimization (85%+ yield target) |

---

## 4. Material Palette System

### Harvester Service (`src/modules/design-manager/services/materialHarvester.ts`)

```typescript
// Scan design items and build palette
await harvestMaterials(projectId, userId);

// Map material to inventory (for Katana export)
await mapMaterialToInventory(projectId, entryId, inventoryId, ...);

// Check if ready for export
allMaterialsMapped(palette); // true = can export to Katana
```

### UI Component (`MaterialPaletteTable.tsx`)

- Lists all design materials with mapping status
- Green badge: Mapped to inventory ✅
- Amber badge: Unmapped (blocks Katana) ⚠️
- Rescan button to update from design items
- Auto-Map placeholder for AI-assisted matching

---

## 5. Nesting Studio Widget

### Component (`src/modules/design-manager/components/production/NestingStudio.tsx`)

Interactive optimization interface with:

- **Configuration Panel**: Kerf, target yield, grain matching, rotation
- **Run Button**: Status-aware (Current ✅ / Re-optimize 🔄 / Run ▶️)
- **Invalidation Warning**: Shows when project data changed
- **Results Display**:
  - EstimationResults: Sheet summary table, waste %, cost
  - ProductionResults: Visual nesting sheets, cut sequence

### Integration Points

| Tab | Mode | Stage |
|-----|------|-------|
| Estimate Tab | ESTIMATION | Stage 3 |
| Production Tab | PRODUCTION | Stage 4+ |

---

## 6. Production Tab

### Component (`src/modules/design-manager/components/project/ProductionTab.tsx`)

Stage-gated production interface:

- **Stage Gate**: Only visible at `pre-production` or `production-ready`
- **NestingStudio**: PRODUCTION mode optimization
- **Shop Traveler**: PDF generation (placeholder)
- **Katana Export**: BOM export with validation checks

### Validation Checks

| Check | Required For |
|-------|--------------|
| Production nesting complete | Katana export |
| All materials mapped | Katana export |
| BOM not invalidated | Clean export |

---

## 7. Project View Updates

### New Tab (`ProjectView.tsx`)

- Added **Production** tab (4th tab)
- Amber indicator dot when optimization is invalidated
- Tab visible for all stages, stage-gated internally

---

## File Summary

### New Files Created

| Path | Description |
|------|-------------|
| `src/shared/types/project.ts` | Optimization state types |
| `src/shared/services/ragService.ts` | RAG status helpers |
| `src/shared/services/projectService.ts` | Project save with invalidation |
| `src/shared/services/optimization/InvalidationDetector.ts` | Change detection |
| `src/shared/services/optimization/projectOptimization.ts` | Project-level optimization |
| `src/modules/design-manager/services/materialHarvester.ts` | Material palette management |
| `src/modules/design-manager/components/project/MaterialPaletteTable.tsx` | Material mapping UI |
| `src/modules/design-manager/components/project/ProductionTab.tsx` | Production tab |
| `src/modules/design-manager/components/production/NestingStudio.tsx` | Optimization widget |
| `src/modules/design-manager/components/production/index.ts` | Production exports |

### Updated Files

| Path | Changes |
|------|---------|
| `src/shared/types/index.ts` | Added project exports |
| `src/shared/services/index.ts` | Added optimization, RAG, project exports |
| `src/shared/services/optimization/index.ts` | Added new exports |
| `src/modules/design-manager/services/index.ts` | Added materialHarvester exports |
| `src/modules/design-manager/components/project/index.ts` | Added ProductionTab, MaterialPaletteTable |
| `src/modules/design-manager/components/project/EstimateTab.tsx` | Added NestingStudio section |
| `src/modules/design-manager/components/project/ProjectView.tsx` | Added Production tab |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Project                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  optimizationState                       ││
│  │  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ ││
│  │  │ estimation │  │ production │  │       config       │ ││
│  │  │  (Stage 3) │  │  (Stage 4) │  │ kerf, stockSheets  │ ││
│  │  └────────────┘  └────────────┘  └────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  materialPalette                         ││
│  │  entries[] → inventoryId mapping → Katana BOM           ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  lastSnapshot                            ││
│  │  partsHash, materialsHash, configHash → invalidation    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
    ┌───────────┐      ┌────────────────┐    ┌─────────────┐
    │ Estimate  │      │   Production   │    │   Katana    │
    │    Tab    │      │      Tab       │    │    Export   │
    └───────────┘      └────────────────┘    └─────────────┘
          │                    │
          ▼                    ▼
    ┌─────────────────────────────────────────┐
    │           NestingStudio                  │
    │  ESTIMATION mode │ PRODUCTION mode      │
    └─────────────────────────────────────────┘
```
