# Prompt 3.4: Material Library

## Objective
Create a three-tier material library system for standardized material selection.

## Prerequisites
- Completed Prompts 3.1-3.3

## Requirements

### 1. Material Types

Create `src/modules/design-manager/types/materials.ts` with:
- MaterialCategory: sheet-goods, solid-wood, hardware, edge-banding, finishing, other
- MaterialUnit: sheet, sqft, sqm, lft, pcs, gal, ea
- Material interface with: code, name, category, dimensions, pricing, grainPattern
- MaterialTier: global, customer, project

### 2. Firestore Collections

```
materials/                    # Global materials (admin only)
  {materialId}

customers/{customerId}/
  materials/                  # Customer-specific materials
    {materialId}

customers/{customerId}/projects/{projectId}/
  materials/                  # Project-specific overrides
    {materialId}
```

### 3. Material Service

Create `materialService.ts` with:
- `getMaterialsForProject(customerId, projectId)` - merges all three tiers
- `createGlobalMaterial(data, userId)` - admin only
- `createCustomerMaterial(customerId, data, userId)`
- `createProjectMaterial(customerId, projectId, data, userId)`
- `linkMaterialToPart(partId, materialId)` - assigns material to part

### 4. Material Selector Component

Create `MaterialSelector.tsx`:
- Dropdown/modal for selecting materials
- Shows merged materials from all tiers
- Groups by category
- Search/filter functionality
- Shows pricing info

### 5. Material Admin Page (optional)

Create route `/materials` for global material management:
- List all global materials
- Add/edit/delete materials
- Import materials from CSV

## Validation Checklist

- [ ] Three-tier resolution works (project > customer > global)
- [ ] Material selector shows all available materials
- [ ] Linking material to part updates part.materialId
- [ ] Pricing flows through to estimates

## Phase 3 Complete!

Proceed to **Phase 4: Project-Level Cutlist Aggregation**.
