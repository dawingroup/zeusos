# Dawin Cutlist Processor - Architecture Report

**Version:** 1.0.0  
**Report Date:** December 26, 2024  
**Deployment URL:** https://dawin-cutlist-processor.web.app  
**Repository:** https://github.com/dawingroup/dawinos

---

## Executive Summary

The Dawin Cutlist Processor is a modern web application built for millwork operations management. It consists of two primary modules:

1. **Cutlist Processor Module** - Legacy cutting list optimization and material management
2. **Design Manager Module** - Design workflow tracking with RAG status monitoring

The application uses a modular architecture with shared components, Firebase backend services, and a consistent design system.

---

## 1. Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI Framework |
| TypeScript | 5.9.3 | Type Safety |
| Vite | 4.4.5 | Build Tool |
| React Router DOM | 6.30.2 | Routing |
| Tailwind CSS | 3.3.3 | Styling |
| Lucide React | 0.263.1 | Icons |
| Zustand | 5.0.9 | State Management |

### Backend (Firebase)
| Service | Purpose |
|---------|---------|
| Firebase Authentication | User auth via Google OAuth |
| Cloud Firestore | NoSQL database for projects, items, deliverables |
| Firebase Storage | File storage for deliverables |
| Firebase Hosting | Static site hosting |
| Cloud Functions | API endpoints (configured but minimal use) |

### Additional Libraries
- **class-variance-authority** - Component variant styling
- **Fuse.js** - Fuzzy search
- **jsPDF / html2canvas** - PDF generation
- **googleapis** - Google Drive integration

---

## 2. Application Architecture

### 2.1 Directory Structure

```
src/
├── App.jsx                    # Legacy Cutlist Processor (main component)
├── main.jsx                   # Application entry point with routing
├── index.css                  # Global styles and Tailwind config
│
├── modules/                   # Feature modules
│   ├── cutlist-processor/     # Cutlist optimization module
│   └── design-manager/        # Design workflow module
│
├── shared/                    # Shared code across modules
│   ├── components/            # Reusable UI components
│   ├── hooks/                 # Custom React hooks
│   ├── services/              # Shared services
│   ├── types/                 # TypeScript types
│   └── utils/                 # Utility functions
│
├── contexts/                  # React Context providers
│   ├── AuthContext.jsx        # Authentication state
│   ├── ConfigContext.jsx      # App configuration
│   ├── OffcutContext.jsx      # Offcut management
│   └── WorkInstanceContext.jsx # Work session management
│
├── services/                  # Legacy services
│   ├── configService.js       # Configuration management
│   ├── driveService.js        # Google Drive integration
│   ├── materialMapping.js     # Material mapping logic
│   ├── pdfExportService.js    # PDF generation
│   ├── stockMaterialsService.js # Stock materials
│   └── workInstanceService.js # Work instance management
│
├── components/                # Legacy components (Cutlist Processor)
├── firebase/                  # Firebase configuration
└── utils/                     # Legacy utilities
```

### 2.2 Routing Structure

```
/                    → App.jsx (Cutlist Processor)
/design              → DesignManagerModule
  /design/project/:projectId           → ProjectView
  /design/project/:projectId/item/:id  → DesignItemDetail
```

### 2.3 Module Pattern

Each module follows a consistent structure:

```
module/
├── ModuleEntry.tsx      # Module entry point with internal routing
├── components/          # Module-specific components
├── hooks/               # Module-specific hooks
├── services/            # Module-specific services (Firestore, Storage)
├── types/               # Module-specific TypeScript types
├── utils/               # Module-specific utilities
└── index.ts             # Public exports
```

---

## 3. Design Manager Module (Detailed)

### 3.1 Data Model

#### Collections (Firestore)

```
designProjects/
├── {projectId}
│   ├── code: string
│   ├── name: string
│   ├── description?: string
│   ├── customerName?: string
│   ├── status: 'active' | 'on-hold' | 'completed' | 'cancelled'
│   ├── startDate?: Timestamp
│   ├── dueDate?: Timestamp
│   ├── createdAt: Timestamp
│   ├── createdBy: string
│   ├── updatedAt: Timestamp
│   └── updatedBy: string
│
└── designItems/ (subcollection)
    ├── {itemId}
    │   ├── itemCode: string
    │   ├── name: string
    │   ├── category: DesignCategory
    │   ├── currentStage: DesignStage
    │   ├── ragStatus: RAGStatus
    │   ├── overallReadiness: number (0-100)
    │   ├── parameters: ParametersObject
    │   ├── stageHistory: StageTransition[]
    │   └── approvals: ApprovalRecord[]
    │
    ├── deliverables/ (subcollection)
    │   └── {deliverableId}
    │       ├── name: string
    │       ├── type: DeliverableType
    │       ├── stage: DesignStage
    │       ├── status: 'draft' | 'review' | 'approved' | 'superseded'
    │       ├── storageUrl: string
    │       └── storagePath: string
    │
    └── approvals/ (subcollection)
        └── {approvalId}
```

#### Design Stages (Workflow)

```
concept → preliminary → technical → pre-production → production-ready
```

#### Design Categories

- Casework
- Furniture
- Millwork
- Doors
- Fixtures
- Specialty

#### RAG Status Structure

```typescript
RAGStatus {
  designCompleteness: {
    overallDimensions, model3D, productionDrawings,
    materialSpecs, hardwareSpecs, finishSpecs,
    joineryDetails, tolerances, assemblyInstructions
  },
  manufacturingReadiness: {
    materialAvailability, hardwareAvailability,
    toolingReadiness, processDocumentation,
    qualityCriteria, costValidation
  },
  qualityGates: {
    internalDesignReview, manufacturingReview,
    clientApproval, prototypeValidation
  }
}
```

### 3.2 Component Hierarchy

```
DesignManagerModule
├── DesignManagerPageNew (Dashboard)
│   ├── ProjectDialog (Create/Edit/Delete Project)
│   ├── ProjectDashboardCard (Project Summary)
│   ├── DesignItemCard
│   └── StageKanban
│
├── ProjectView (Project Detail)
│   ├── Project Stats Cards
│   ├── Project Details Card
│   ├── NewDesignItemDialog
│   ├── ProjectDialog
│   └── StageKanban / DesignItemCard
│
└── DesignItemDetail (Item Detail)
    ├── Tabs: Overview | Parameters | RAG Status | Files | Approvals | History | AI
    ├── OverviewTab (with parameter summary)
    ├── ParametersEditor
    ├── RAGStagePanel / RAGEditModal
    ├── DeliverablesManager
    ├── ApprovalWorkflow
    ├── HistoryTab
    ├── BriefAnalyzer (AI)
    ├── DfMChecker (AI)
    └── StageGateCheck (Modal)
```

### 3.3 Services

| Service | File | Purpose |
|---------|------|---------|
| Firestore | `firestore.ts` | CRUD operations, real-time subscriptions |
| Storage | `storage.ts` | File upload/download for deliverables |

### 3.4 Hooks

| Hook | Purpose |
|------|---------|
| `useProject` | Fetch single project with real-time updates |
| `useDesignItems` | Fetch design items with filtering |
| `useDesignItem` | Fetch single design item |
| `useStageTransition` | Handle stage advancement |
| `useRAGUpdate` | Update RAG status aspects |

---

## 4. Shared Components

### 4.1 UI Components (`/shared/components/ui/`)

| Component | Description |
|-----------|-------------|
| `Button` | Primary button with variants (default, destructive, outline, secondary, ghost, link) |
| `Card` | Card container with Header, Title, Description, Content, Footer |
| `Input` | Form input field |
| `Tabs` | Tab navigation (Radix UI based) |

### 4.2 Layout Components (`/shared/components/layout/`)

| Component | Description |
|-----------|-------------|
| `GlobalHeader` | Application-wide header with navigation |
| `AppLayout` | Main layout wrapper |
| `Header` | Module-specific header |

---

## 5. Authentication & Authorization

### Current Implementation

- **Provider:** Firebase Authentication with Google OAuth
- **Context:** `AuthContext.jsx` provides `user`, `isAuthenticated`, `signIn`, `signOut`
- **Protected Routes:** Conditional rendering based on `isAuthenticated`

### User Object

```javascript
{
  email: string,
  displayName: string,
  photoURL: string,
  uid: string
}
```

---

## 6. Styling System

### Design Tokens (Tailwind CSS)

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 7%;           /* #1d1d1f - Apple Black */
  --primary: 0 0% 12%;             /* Primary brand color */
  --secondary: 0 0% 96%;
  --muted: 0 0% 96%;
  --accent: 0 0% 96%;
  --destructive: 0 84% 60%;
  --border: 0 0% 90%;
  --ring: 0 0% 12%;
}
```

### Component Styling Patterns

- **Cards:** `bg-white rounded-lg shadow-sm border border-gray-200 p-4`
- **Buttons (Primary):** `bg-primary text-white hover:bg-primary/90`
- **Inputs:** `border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary`
- **Stats Cards:** `border-l-4 border-l-{color}` for colored accent

---

## 7. Current Feature Status

### ✅ Implemented Features

| Module | Feature | Status |
|--------|---------|--------|
| Design Manager | Project CRUD | ✅ Complete |
| Design Manager | Project Dashboard Card | ✅ Complete |
| Design Manager | Design Item CRUD | ✅ Complete |
| Design Manager | RAG Status Tracking | ✅ Complete |
| Design Manager | Stage Workflow | ✅ Complete |
| Design Manager | Deliverables Upload/Delete | ✅ Complete |
| Design Manager | Approval Workflow | ✅ Complete |
| Design Manager | Parameters Editor | ✅ Complete |
| Design Manager | AI Brief Analyzer | ✅ Complete |
| Design Manager | AI DfM Checker | ✅ Complete |
| Cutlist Processor | CSV Import | ✅ Complete |
| Cutlist Processor | Material Mapping | ✅ Complete |
| Cutlist Processor | Optimization | ✅ Complete |
| Cutlist Processor | PDF Export | ✅ Complete |
| Shared | Google Auth | ✅ Complete |
| Shared | Global Header | ✅ Complete |

### 🔄 Partially Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Deliverable Edit | 🔄 Partial | Delete works, edit UI not implemented |
| Work Instance Persistence | 🔄 Partial | Context exists, Firestore integration incomplete |
| User Roles/Permissions | 🔄 Partial | Email-based, no role management UI |

### ❌ Not Yet Implemented

| Feature | Priority | Complexity |
|---------|----------|------------|
| User/Team Management | Medium | Medium |
| Notification System | Medium | Medium |
| Comments/Activity Feed | Low | Medium |
| Reporting Dashboard | Medium | High |
| Mobile Responsive Optimization | Low | Medium |
| Offline Support | Low | High |
| Multi-tenant Support | Low | High |

---

## 8. Recommendations for Future Development

### 8.1 Short-Term (1-2 Sprints)

1. **Deliverable Edit Functionality**
   - Add edit dialog for deliverable metadata
   - Allow version management

2. **Search & Filtering**
   - Global search across projects and items
   - Advanced filtering on dashboard

3. **Notification System**
   - Toast notifications for actions
   - Email notifications for approvals (Cloud Functions)

### 8.2 Medium-Term (3-6 Sprints)

1. **User Management Module**
   - Team creation and management
   - Role-based access control (Admin, Designer, Reviewer)
   - User invitation system

2. **Reporting Dashboard**
   - Project timeline views
   - Readiness trends over time
   - Export reports to PDF/Excel

3. **Activity Feed**
   - Audit log for all actions
   - Comments on design items
   - @mentions for team members

### 8.3 Long-Term (Future Roadmap)

1. **Mobile App**
   - React Native or PWA
   - Offline-first architecture

2. **Integration Hub**
   - CAD software integration
   - ERP system connections
   - Supplier catalog integration

3. **Advanced AI Features**
   - Automatic material estimation
   - Cost prediction
   - Design recommendations

---

## 9. Technical Debt & Improvements

### 9.1 Code Quality

| Issue | Priority | Effort |
|-------|----------|--------|
| Migrate `App.jsx` to TypeScript | Medium | High |
| Extract legacy components to modules | Low | High |
| Add unit tests (Jest/Vitest) | High | High |
| Add E2E tests (Playwright) | Medium | Medium |

### 9.2 Performance

| Issue | Priority | Effort |
|-------|----------|--------|
| Code splitting (already partial) | Low | Low |
| Image optimization | Low | Low |
| Firestore query optimization | Medium | Medium |
| Bundle size reduction | Low | Medium |

### 9.3 Architecture

| Issue | Priority | Effort |
|-------|----------|--------|
| Centralize error handling | Medium | Low |
| Add logging service | Medium | Low |
| Implement feature flags | Low | Medium |
| Add API rate limiting | Low | Low |

---

## 10. Deployment Pipeline

### Current Setup

```
Developer → Git Push → GitHub (main) → Manual Firebase Deploy
```

### Recommended CI/CD

```
Developer → Git Push → GitHub Actions
                         ├── Build & Test
                         ├── Preview Deploy (PR)
                         └── Production Deploy (main merge)
```

### Environment Configuration

| Environment | URL | Purpose |
|-------------|-----|---------|
| Production | https://dawin-cutlist-processor.web.app | Live users |
| Preview | (not configured) | PR testing |
| Local | http://localhost:3000 | Development |

---

## 11. Security Considerations

### Current Security

- ✅ Firebase Authentication required
- ✅ Firestore security rules (basic)
- ✅ HTTPS only (Firebase Hosting)

### Recommended Improvements

- [ ] Implement stricter Firestore rules (user-specific access)
- [ ] Add rate limiting on Cloud Functions
- [ ] Implement session timeout
- [ ] Add audit logging for sensitive actions
- [ ] Regular security dependency updates

---

## 12. Appendix

### A. File Count by Directory

| Directory | Files | Description |
|-----------|-------|-------------|
| `src/modules/design-manager/` | 57+ | Design Manager module |
| `src/shared/` | 33+ | Shared components and utilities |
| `src/components/` | 13+ | Legacy Cutlist components |
| `src/services/` | 6 | Legacy services |
| `src/contexts/` | 4 | React contexts |

### B. Key Configuration Files

| File | Purpose |
|------|---------|
| `vite.config.js` | Vite build configuration |
| `tailwind.config.js` | Tailwind CSS theming |
| `firebase.json` | Firebase Hosting/Firestore config |
| `firestore.rules` | Firestore security rules |
| `tsconfig.json` | TypeScript configuration |

### C. Useful Commands

```bash
# Development
npm run dev                 # Start dev server

# Build & Deploy
npm run build              # Build for production
npm run deploy             # Build + Firebase deploy

# Firebase
firebase login --reauth    # Re-authenticate
firebase deploy --only hosting  # Deploy hosting only
firebase deploy --only firestore:rules  # Deploy rules only
```

---

*Report generated for Dawin Group internal use.*
