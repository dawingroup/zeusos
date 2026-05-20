# Dawin Cutlist Processor - Technical Report

**Version:** 1.0.0  
**Date:** December 27, 2025  
**Platform:** Firebase Hosted Web Application  
**URL:** https://dawinos.web.app

---

## Executive Summary

The Dawin Cutlist Processor is a comprehensive manufacturing operations platform designed for custom millwork and furniture production. The application integrates AI-powered design strategy generation, asset management, project lifecycle tracking, and production optimization tools into a unified system.

---

## Architecture Overview

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS 3.3 |
| **State Management** | Zustand, React Context |
| **Routing** | React Router DOM 6.x |
| **Backend** | Firebase (Firestore, Functions, Hosting) |
| **AI Services** | Google Gemini 2.0 with Search Grounding |
| **PDF Generation** | @react-pdf/renderer |
| **Icons** | Lucide React |

### Deployment

- **Hosting:** Firebase Hosting
- **Functions:** Firebase Cloud Functions (Node.js 20, Gen 2)
- **Database:** Cloud Firestore
- **Authentication:** Firebase Auth
- **Secrets:** Google Secret Manager

---

## Module Architecture

The application follows a modular architecture with 6 core modules:

```
src/
├── modules/
│   ├── assets/              # Smart Asset Registry
│   ├── customer-hub/        # Customer Management
│   ├── cutlist-processor/   # Cutting List Optimization
│   ├── design-manager/      # Design & Project Management
│   ├── feature-library/     # Manufacturing Features
│   └── strategy/            # AI Strategy Reports
├── shared/                  # Shared components, services, types
├── app/                     # App-level pages and routing
└── components/              # Legacy components
```

---

## Module Details

### 1. Design Manager Module

**Path:** `src/modules/design-manager/`  
**Purpose:** Core project and design item lifecycle management

#### Components

| Component | Description |
|-----------|-------------|
| `ProjectView` | Main project dashboard with tabs for design items, cutlist, and estimates |
| `DesignItemDetail` | Detailed view of individual design items with specs, materials, features |
| `StrategyCanvas` | AI-powered project strategy research interface |
| `ProjectDialog` | Project creation and editing modal |
| `CutlistTab` | Aggregated cutlist view with CSV export |
| `EstimateTab` | Project estimation with line items |
| `RoadmapPage` | Project milestone and timeline management |
| `StageGateCheck` | Quality gate checkpoint system |
| `TrafficLight` | Visual project status indicators |

#### Services

- `designItemService.ts` - Design item CRUD operations
- `projectService.ts` - Project management
- `estimateService.ts` - Estimation calculations
- `cutlistAggregation.ts` - Cutlist consolidation logic

#### Features

- **Kanban & List Views** - Toggle between visual layouts
- **Stage Filtering** - Filter by production stage (CONCEPT → PRODUCTION)
- **Category Filtering** - Filter by item category
- **Bulk Import** - CSV import for design items
- **AI Strategy Generation** - Gemini-powered design recommendations

---

### 2. Smart Asset Registry Module

**Path:** `src/modules/assets/`  
**Purpose:** Workshop equipment and tool management with maintenance tracking

#### Components

| Component | Description |
|-----------|-------------|
| `AssetRegistryPage` | Main asset listing with filters, search, and statistics |
| `AssetForm` | Asset creation form (embedded in registry page) |
| `AssetFilters` | Category and status filtering |

#### Features

- **Asset Categories:** CNC, Power Tools, Hand Tools, Jigs, Fixtures, Workstations, Finishing, Safety, Storage
- **Status Tracking:** Active, Maintenance, Repair, Retired
- **Maintenance Scheduling:** Next service due dates, service history
- **CSV Export:** Export filtered asset list to CSV
- **Asset Entry Form:** Full form with brand, model, serial number, location

#### Services

- `AssetService.ts` - CRUD operations, maintenance logs, status changes, checkouts

#### Data Model

```typescript
interface Asset {
  id: string;
  brand: string;
  model: string;
  nickname?: string;
  serialNumber?: string;
  category: AssetCategory;
  status: AssetStatus;
  location: AssetLocation;
  specs: Record<string, any>;
  maintenance: AssetMaintenance;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

### 3. Strategy Module

**Path:** `src/modules/strategy/`  
**Purpose:** AI-generated design strategy reports with PDF export

#### Components

| Component | Description |
|-----------|-------------|
| `StrategyPDF` | PDF document renderer for strategy reports |
| `StrategyCanvas` | Research interface with AI report generation |
| `ResearchAssistant` | Chat-based research interface |
| `TrendInsightsPanel` | Display saved research findings |
| `ChallengesSection` | Pain points, goals, constraints input |
| `SpaceParametersSection` | Area and space type configuration |
| `BudgetFrameworkSection` | Budget tier and priorities |

#### AI Integration

The `generateStrategyReport` Cloud Function uses:
- **Gemini 2.0 Flash** with Google Search grounding
- Real-time trend research for the target location
- Feature matching to available manufacturing capabilities
- Production feasibility scoring

#### Report Sections

1. Executive Summary
2. Market Trends (with relevance scores)
3. Design Recommendations
4. Material Palette
5. Color Scheme
6. Production Feasibility
7. Next Steps

---

### 4. Feature Library Module

**Path:** `src/modules/feature-library/`  
**Purpose:** Manufacturing capability catalog

#### Features

- Feature scanning and creation
- Category-based organization
- Asset requirement linking
- Availability status based on asset health

---

### 5. Customer Hub Module

**Path:** `src/modules/customer-hub/`  
**Purpose:** Customer relationship management

#### Components

- `CustomerListPage` - Customer directory
- `CustomerDetailPage` - Individual customer view
- `CustomerForm` - Customer creation/editing

---

### 6. Cutlist Processor Module

**Path:** `src/modules/cutlist-processor/`  
**Purpose:** Cutting list optimization and material calculation

#### Legacy Components

The original cutlist processor functionality resides in `src/App.jsx` and handles:
- Material input and optimization
- Stock sheet allocation
- Waste minimization
- Export to cutting diagrams

---

## Cloud Functions

**Path:** `functions/src/ai/`

### generateStrategyReport

**Trigger:** HTTP Callable  
**Purpose:** Generate AI-powered design strategy reports

**Input:**
```typescript
{
  projectName: string;
  projectType?: string;
  clientBrief: string;
  location?: string;
  year?: number;
  constraints?: string[];
  painPoints?: string[];
  goals?: string[];
  budgetTier?: string;
  spaceDetails?: string;
  researchFindings?: ResearchFindingInput[];
  researchExcerpts?: string[];
}
```

**Process:**
1. Fetch available features from Firestore
2. Generate strategy using Gemini with Google Search grounding
3. Parse JSON response
4. Enrich with asset details
5. Return complete strategy report

### enrichAssetData

**Trigger:** HTTP Callable  
**Purpose:** Auto-fill asset specifications using AI web search

### analyzeFeatureFromAsset

**Trigger:** HTTP Callable  
**Purpose:** Analyze jig/setup photos to identify design features

---

## Recent Improvements (December 2025)

### Bug Fixes

| Issue | Resolution |
|-------|------------|
| Asset Registry not accessible | Fixed routing in `main.jsx`, added navigation link |
| PDF generation failing | Removed invalid font registration, fixed PDF renderer |
| Strategy report returning test data | Removed test PDF button, fixed cloud function |
| Function authentication errors | Set Cloud Run invoker policy to public |
| GEMINI_API_KEY conflict | Removed `.env` file, using Firebase Secrets exclusively |
| Strategy Canvas scroll issue | Changed to flex layout with `overflow-y-auto` |

### New Features

| Feature | Description |
|---------|-------------|
| **Asset Entry Form** | Full form in Asset Registry for adding new assets |
| **CSV Export** | Export filtered assets to CSV file |
| **Enhanced AI Strategy** | Includes constraints, pain points, goals, research findings |
| **Google Search Grounding** | Real-time trend research in strategy generation |
| **Scrollable Strategy UI** | Fixed layout for proper content scrolling |

### Code Quality

- Improved error handling in Cloud Functions
- Better JSON parsing with multiple extraction methods
- Enhanced logging for debugging
- Type safety improvements in TypeScript

---

## Database Schema

### Collections

| Collection | Description |
|------------|-------------|
| `projects` | Design projects |
| `designItems` | Individual design items within projects |
| `features` | Manufacturing features/capabilities |
| `assets` | Workshop equipment and tools |
| `customers` | Customer records |
| `projectStrategies` | Saved strategy research data |
| `maintenance_logs` | Asset maintenance history |
| `status_changes` | Asset status change history |
| `checkouts` | Asset checkout records |

---

## Shared Services

**Path:** `src/shared/services/`

| Service | Purpose |
|---------|---------|
| `firebase.ts` | Firebase app initialization |
| `firestore.ts` | Firestore database access |
| `auth.ts` | Authentication utilities |
| `featureService.ts` | Feature CRUD operations |
| `materialService.ts` | Material management |
| `customerService.ts` | Customer operations |

---

## UI Components

### Shared Components

**Path:** `src/shared/components/`

- `Header.tsx` - Global navigation header with module switcher
- `AppLayout.tsx` - Main layout wrapper
- `Button.tsx` - Reusable button component (shadcn/ui style)
- `LoadingSpinner.tsx` - Loading indicators

### Design System

- **Primary Color:** `#0A7C8E` (Teal)
- **Gradients:** Indigo to Purple for AI features
- **Border Radius:** Rounded corners (`rounded-lg`, `rounded-xl`)
- **Shadows:** Subtle shadows for depth

---

## API Endpoints

### Firebase Functions

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generateStrategyReport` | POST | Generate AI strategy report |
| `/enrichAssetData` | POST | Enrich asset with AI data |
| `/analyzeFeatureFromAsset` | POST | Analyze feature from image |
| `/api/*` | Various | General API routes |

---

## Environment Configuration

### Required Secrets (Firebase Secret Manager)

- `GEMINI_API_KEY` - Google Gemini API access
- `ANTHROPIC_API_KEY` - Claude API (optional)
- `KATANA_API_KEY` - Katana MRP integration
- `NOTION_API_KEY` - Notion integration

### Firebase Configuration

```javascript
// src/firebase/config.ts
const firebaseConfig = {
  projectId: 'dawinos',
  // ... other config
};
```

---

## Deployment

### Build & Deploy

```bash
# Build frontend
npm run build

# Deploy everything
firebase deploy

# Deploy hosting only
firebase deploy --only hosting

# Deploy functions only
firebase deploy --only functions
```

### URLs

- **Production:** https://dawinos.web.app
- **Console:** https://console.firebase.google.com/project/dawinos

---

## Optimization State Architecture

### Overview

The optimization state system tracks cutlist optimization results at the project level with automatic invalidation detection when parts or materials change.

### Key Components

| Component | Path | Description |
|-----------|------|-------------|
| **Project Types** | `src/shared/types/project.ts` | `OptimizationState`, `EstimationResult`, `ProductionResult` interfaces |
| **InvalidationDetector** | `src/shared/services/optimization/InvalidationDetector.ts` | Detects when changes invalidate optimization results |
| **RAG Service** | `src/shared/services/ragService.ts` | Updates Red-Amber-Green status for optimization workflow |
| **Project Service** | `src/shared/services/projectService.ts` | Save with auto-invalidation, estimation/production result storage |

### Optimization State Schema

```typescript
interface OptimizationState {
  estimation: EstimationResult | null;   // Stage 3 results
  production: ProductionResult | null;   // Stage 4 results
  config: OptimizationConfig;            // Persisted settings
  lastEstimationRun?: Timestamp;
  lastProductionRun?: Timestamp;
}
```

### Invalidation Triggers

| Trigger | Invalidates |
|---------|-------------|
| `PART_ADDED` / `PART_REMOVED` | Estimation + Production |
| `PART_DIMENSIONS_CHANGED` | Estimation + Production |
| `MATERIAL_CHANGED` | Estimation + Production |
| `STOCK_CONFIG_CHANGED` | Estimation + Production |
| `KERF_CHANGED` | Production only |
| `DESIGN_ITEM_ADDED` / `REMOVED` | Estimation + Production |

### RAG Status Flow

```
RED    → No optimization run
AMBER  → Results invalidated (changes detected)
GREEN  → Results current and valid
GREY   → Not applicable (e.g., production without estimation)
```

### Optimization Engine

**Path:** `src/shared/services/optimization/`

| File | Description |
|------|-------------|
| `OptimizationService.ts` | Core guillotine bin-packing algorithm with ESTIMATION and PRODUCTION modes |
| `projectOptimization.ts` | Project-level actions: `runProjectEstimation()`, `runProjectProduction()` |
| `InvalidationDetector.ts` | Detects when parts/materials changes invalidate cached results |

**Two Optimization Modes:**

| Mode | Purpose | Speed | Accuracy |
|------|---------|-------|----------|
| **ESTIMATION** | Quick quoting (Stage 3) | Fast | ~70% utilization assumption, +15% buffer |
| **PRODUCTION** | Final nesting (Stage 4) | Full | Guillotine algorithm, 85%+ yield target |

**Key Functions:**

```typescript
// Run estimation and save to project
await runProjectEstimation(projectId, userId);

// Run production nesting and save to project
await runProjectProduction(projectId, userId);

// Check if re-run needed
needsReOptimization(project, 'estimation'); // true if stale

// Get status summary
getOptimizationStatus(project); // { estimationStatus, productionStatus, canRunProduction }
```

### Material Palette System

**Path:** `src/modules/design-manager/services/materialHarvester.ts`

The Material Palette system manages the mapping between design materials and inventory items.

**Schema:**

```typescript
interface MaterialPaletteEntry {
  id: string;
  designName: string;        // From CSV/Polyboard
  normalizedName: string;    // Cleaned for matching
  thickness: number;
  materialType: 'PANEL' | 'SOLID' | 'VENEER' | 'EDGE';
  usageCount: number;        // Parts using this material
  designItemIds: string[];   // Which design items use it
  inventoryId?: string;      // Katana/Stock SKU
  inventoryName?: string;
  stockSheets: StockSheet[]; // For optimization
}
```

**Key Functions:**

```typescript
// Scan design items and build palette
await harvestMaterials(projectId, userId);
// Returns: { newMaterials, existingMaterials, removedMaterials }

// Map material to inventory
await mapMaterialToInventory(projectId, entryId, inventoryId, ...);

// Check mapping status
getPaletteStats(palette); // { total, mapped, unmapped, percentMapped }
allMaterialsMapped(palette); // true if ready for Katana export
```

**Invalidation Hooks:**

| Action | Invalidates |
|--------|-------------|
| New materials found | Estimation (new stock sheets needed) |
| Material remapped to different inventory | Katana BOM |
| Stock sheets changed | Estimation |
| Material unmapped | Katana BOM |

**UI Component:** `MaterialPaletteTable.tsx`
- Shows all palette entries with mapping status
- Green badge: Mapped to inventory
- Amber badge: Unmapped (blocks Katana export)
- Auto-Map button for AI-assisted matching
- Rescan button to update from design items

### Nesting Studio Widget

**Path:** `src/modules/design-manager/components/production/NestingStudio.tsx`

The Nesting Studio provides an interactive optimization interface embedded in project views.

**Two Modes:**

| Mode | Tab | Purpose |
|------|-----|---------|
| **ESTIMATION** | Estimate Tab | Quick material estimation (~70% utilization) |
| **PRODUCTION** | Production Tab | Full nesting optimization (85%+ yield) |

**Features:**

- Configuration panel (kerf, grain matching, rotation settings)
- Run/Re-run optimization button with status indication
- Invalidation warning when project data has changed
- **EstimationResults**: Sheet summary, waste %, rough cost
- **ProductionResults**: Visual nesting sheets, cut sequence, yield %

**Integration:**

```tsx
// In EstimateTab (Stage 3)
<NestingStudio projectId={projectId} project={project} mode="ESTIMATION" />

// In ProductionTab (Stage 4+)
<NestingStudio projectId={projectId} project={project} mode="PRODUCTION" />
```

**ProductionTab includes:**
- NestingStudio in PRODUCTION mode
- Shop Traveler PDF generation
- Katana BOM export with material mapping validation

---

## Roadmap

### Planned Features

1. **Katana MRP Integration** - Sync with manufacturing ERP
2. **Shopify Integration** - E-commerce order flow
3. **Advanced Reporting** - Analytics dashboard
4. **Mobile App** - React Native companion app
5. **Barcode Scanning** - Asset and material tracking
6. **Automated Scheduling** - Production calendar optimization

### Technical Debt

1. Code-split large chunks (StrategyCanvas, index bundles)
2. Migrate legacy `App.jsx` to modular structure
3. Add comprehensive test coverage
4. Implement proper error boundaries
5. Add offline support with service workers

---

## Security Considerations

- All Cloud Functions use Firebase Secrets for API keys
- Firestore security rules protect data access
- HTTPS enforced on all endpoints
- Auth tokens required for sensitive operations

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Build Size (JS) | ~1.5 MB (uncompressed) |
| Build Size (CSS) | ~62 KB |
| Lighthouse Score | TBD |
| First Contentful Paint | TBD |

---

## Support & Maintenance

**Project Owner:** Dawin Group  
**Repository:** dawinos  
**Hosting:** Firebase  
**Region:** us-central1

---

*Report generated: December 27, 2025*
