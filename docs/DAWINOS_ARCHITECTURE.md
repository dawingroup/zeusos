# DawinOS Architecture

## Vision

DawinOS is the unified operating system for the Dawin Group, providing each subsidiary with dedicated modules and shared infrastructure to excel in their operations.

---

## Company Structure → Module Mapping

```
DawinOS (Platform Core)
├── 🎨 Dawin Finishes (Manufacturing & Millwork)
│   │   [Current dawinos app]
│   ├── clipper                 # Design inspiration capture
│   ├── design-manager          # Design workflow & approvals
│   ├── cutlist-processor       # Sheet optimization & nesting
│   ├── feature-library         # Reusable component library
│   ├── launch-pipeline         # Strategy canvas & pipeline
│   ├── customer-hub            # Customer management
│   ├── assets                  # CNC machines & tools
│   └── production-tracker      # Shop floor tracking (future)
│
├── 📊 Dawin Advisory (Consulting & Strategy)
│   ├── client-portal           # Client engagement
│   ├── project-tracker         # Advisory projects
│   ├── knowledge-base          # Research & insights
│   └── deliverables            # Reports & presentations
│
├── 💻 Dawin Technology (Software & Innovation)
│   ├── product-hub             # Product development
│   ├── dev-ops                 # Infrastructure management
│   ├── ai-lab                  # AI/ML experiments
│   └── integrations            # Third-party connectors
│
├── 💰 Dawin Capital (Investment & Finance)
│   ├── portfolio               # Investment tracking
│   ├── deal-flow               # Opportunity pipeline
│   ├── due-diligence           # Analysis workflows
│   └── reporting               # Financial reports
│
└── 🎯 Core Services (Cross-cutting)
    ├── auth                    # Identity & access
    ├── notifications           # Alerts & messaging
    ├── documents               # File management
    ├── analytics               # BI & reporting
    ├── integrations            # External systems (Katana, QB, etc.)
    └── ai-services             # Gemini, vision analysis
```

---

## Current State Analysis

### Existing Modules → Dawin Finishes

| Current Module | New Location | Description |
|----------------|--------------|-------------|
| `design-manager` | `finishes/design-manager` | Design workflow, estimates, cutlist aggregation |
| `cutlist-processor` | `finishes/cutlist` | CSV processing, nesting optimization |
| `feature-library` | `finishes/feature-library` | Reusable component library |
| `launch-pipeline` | `finishes/launch-pipeline` | Strategy canvas, pipeline management |
| `customer-hub` | `finishes/customers` | Customer management |
| `assets` | `finishes/assets` | CNC machines, tools tracking |
| `strategy` | `finishes/strategy` | Business strategy tools |

### Dawin Clipper → Finishes Module

| Component | Integration | Description |
|-----------|-------------|-------------|
| Chrome Extension | `extensions/clipper/` | Stays as browser extension |
| Web Gallery | `finishes/clipper/` | New web module for viewing/managing clips |
| IndexedDB Storage | Keep in extension | Offline-first via Dexie.js |
| Firebase Sync | Shared backend | Syncs to `designClips` collection |
| AI Analysis | `core/ai/` | Shared Gemini service |

---

## Architecture Principles

### 1. Subsidiary Autonomy
Each subsidiary operates as an independent business unit with its own:
- Module namespace (`/subsidiaries/finishes/*`, `/subsidiaries/advisory/*`, etc.)
- Data isolation (Firestore collections per subsidiary)
- Role-based access control
- Customizable workflows

### 2. Shared Infrastructure
Common services available to all subsidiaries:
- Authentication (Firebase Auth)
- Storage (Firebase Storage, Firestore)
- AI Services (Gemini API)
- External Integrations (Katana, QuickBooks)

### 3. Module Federation
Modules can be:
- **Standalone**: Full page with routing
- **Embedded**: Widget within another module
- **Headless**: Service-only (no UI)

### 4. Progressive Enhancement
Features roll out incrementally:
- Core functionality first
- Advanced features gated by subscription/role
- Beta features opt-in per subsidiary

---

## Proposed Directory Structure

```
src/
├── app/                          # App shell & routing
│   ├── routes/
│   │   ├── index.tsx
│   │   └── subsidiary-routes.tsx
│   └── layout/
│
├── core/                         # DawinOS Core (renamed from shared)
│   ├── auth/                     # Authentication
│   ├── components/               # Shared UI components
│   ├── services/                 # Core services
│   │   ├── firebase/
│   │   ├── ai/
│   │   └── integrations/
│   ├── hooks/
│   ├── types/
│   └── utils/
│
├── subsidiaries/                 # Subsidiary Modules
│   ├── finishes/                 # 🎨 Dawin Finishes (current dawinos)
│   │   ├── clipper/              # Design inspiration capture
│   │   ├── design-manager/       # Design workflow & approvals
│   │   ├── cutlist/              # Sheet optimization & nesting
│   │   ├── feature-library/      # Reusable component library
│   │   ├── launch-pipeline/      # Strategy canvas & pipeline
│   │   ├── customers/            # Customer management
│   │   ├── assets/               # CNC machines & tools
│   │   └── index.ts
│   │
│   ├── advisory/                 # 📊 Dawin Advisory
│   │   ├── clients/
│   │   ├── projects/
│   │   └── index.ts
│   │
│   ├── technology/               # 💻 Dawin Technology
│   │   ├── products/
│   │   ├── integrations/
│   │   └── index.ts
│   │
│   └── capital/                  # 💰 Dawin Capital
│       ├── portfolio/
│       ├── deals/
│       └── index.ts
│
├── extensions/                   # Browser Extensions
│   └── clipper/                  # Chrome extension source
│       ├── background/
│       ├── content/
│       ├── popup/
│       └── manifest.json
│
└── main.tsx
```

---

## Clipper Integration Strategy

### Phase 1: Data Model Alignment (Week 1)

1. **Add Clip Types to Core**
   ```typescript
   // src/core/types/clip.ts
   export interface DesignClip {
     id: string;
     sourceUrl: string;
     imageUrl: string;
     thumbnailUrl: string;
     title: string;
     metadata: ClipMetadata;
     aiAnalysis?: AIAnalysis;
     projectId?: string;
     designItemId?: string;
     createdBy: string;
     createdAt: Timestamp;
   }
   ```

2. **Create Firestore Schema**
   ```
   designClips/{clipId}
   ├── id
   ├── sourceUrl
   ├── imageUrl
   ├── thumbnailUrl
   ├── title
   ├── metadata
   ├── aiAnalysis
   ├── projectId
   ├── subsidiaryId: "millwork"
   ├── createdBy
   └── createdAt
   ```

### Phase 2: Clipper Module (Week 2)

1. **Create Web Module**
   ```
   src/subsidiaries/millwork/clipper/
   ├── components/
   │   ├── ClipGallery.tsx
   │   ├── ClipCard.tsx
   │   ├── ClipDetail.tsx
   │   └── ClipImport.tsx
   ├── services/
   │   ├── clipService.ts
   │   └── aiAnalysisService.ts
   ├── hooks/
   │   └── useClips.ts
   ├── types/
   │   └── index.ts
   └── index.ts
   ```

2. **Integrate with Design Manager**
   - Add "Inspiration" tab to Design Item detail
   - Link clips to design items
   - Use AI analysis for material suggestions

### Phase 3: Extension Sync (Week 3)

1. **Update Extension Firebase Config**
   - Point to same Firebase project
   - Use same auth (Firebase Auth)
   - Sync to `designClips` collection

2. **Real-time Sync**
   - Extension saves to IndexedDB + Firebase
   - Web app subscribes to user's clips
   - Bi-directional sync with conflict resolution

### Phase 4: AI Enhancement (Week 4)

1. **Unified AI Pipeline**
   - Gemini Vision for image analysis
   - Material identification
   - Complexity assessment
   - Cost estimation hints

---

## Migration Path

### Step 1: Rename & Restructure (Non-breaking)

```bash
# Create new structure alongside existing
mkdir -p src/core
mkdir -p src/subsidiaries/millwork

# Move shared to core (with aliases)
mv src/shared/* src/core/

# Create symlinks for backward compatibility
ln -s src/core src/shared
```

### Step 2: Module Migration

```typescript
// Update imports gradually
// FROM:
import { Button } from '@/shared/components/ui';
import { DesignManager } from '@/modules/design-manager';

// TO:
import { Button } from '@/core/components/ui';
import { DesignManager } from '@/subsidiaries/millwork/design-manager';
```

### Step 3: Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "paths": {
      "@/core/*": ["src/core/*"],
      "@/subsidiaries/*": ["src/subsidiaries/*"],
      "@/extensions/*": ["src/extensions/*"],
      // Backward compatibility
      "@/shared/*": ["src/core/*"],
      "@/modules/*": ["src/subsidiaries/millwork/*"]
    }
  }
}
```

---

## Routing Structure

```typescript
// src/app/routes/index.tsx
const routes = [
  // DawinOS Home
  { path: '/', element: <DawinOSHome /> },
  
  // Subsidiary Routes
  { path: '/finishes/*', element: <FinishesRoutes /> },
  { path: '/advisory/*', element: <AdvisoryRoutes /> },
  { path: '/technology/*', element: <TechnologyRoutes /> },
  { path: '/capital/*', element: <CapitalRoutes /> },
  
  // Legacy redirects (backward compatibility)
  { path: '/design-manager/*', redirect: '/finishes/design/*' },
  { path: '/cutlist/*', redirect: '/finishes/cutlist/*' },
];

// src/subsidiaries/finishes/routes.tsx
const finishesRoutes = [
  { path: 'clips/*', element: <ClipperRoutes /> },        // Dawin Clipper
  { path: 'design/*', element: <DesignManagerRoutes /> }, // Design workflow
  { path: 'cutlist/*', element: <CutlistRoutes /> },      // Nesting & optimization
  { path: 'features/*', element: <FeatureLibraryRoutes /> },
  { path: 'pipeline/*', element: <LaunchPipelineRoutes /> },
  { path: 'customers/*', element: <CustomerRoutes /> },
  { path: 'assets/*', element: <AssetRoutes /> },
];
```

---

## Implementation Roadmap

### Phase 1: Foundation (2 weeks)
- [ ] Create `src/core` from `src/shared`
- [ ] Create `src/subsidiaries/finishes` structure
- [ ] Move existing modules under finishes
- [ ] Update path aliases in tsconfig.json
- [ ] Ensure all tests pass

### Phase 2: Clipper Integration (2 weeks)
- [ ] Copy clipper web components to `finishes/clipper`
- [ ] Create clipService with Firestore sync
- [ ] Add "Inspiration" tab to Design Item detail
- [ ] Update Chrome extension to sync with shared Firebase
- [ ] Link clips to design projects

### Phase 3: UI Polish (1 week)
- [ ] DawinOS home dashboard with subsidiary selector
- [ ] Subsidiary-specific navigation
- [ ] Role-based menu filtering
- [ ] Unified search across modules

### Phase 4: Future Subsidiaries (Ongoing)
- [ ] Scaffold Advisory module structure
- [ ] Scaffold Technology module structure
- [ ] Scaffold Capital module structure
- [ ] Cross-subsidiary reporting & analytics

---

## Next Steps

1. **Approve Architecture** - Review and align on structure
2. **Create Core Directory** - Begin migration from shared
3. **Integrate Clipper** - Start with web module, then sync
4. **Update Navigation** - Add subsidiary selector

---

## Questions to Resolve

1. **Subsidiary Access**: Should users have access to all subsidiaries or per-role?
2. **Data Sharing**: Which data is shared across subsidiaries (e.g., customers)?
3. **Branding**: Unified DawinOS brand or subsidiary-specific themes?
4. **Extension Distribution**: Chrome Web Store or enterprise deployment?
