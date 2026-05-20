# DawinOS v2.0 - Architecture Guide

## System Overview

DawinOS v2.0 is a modular enterprise operating system built on React and Firebase, designed to support multiple subsidiaries within Dawin Group.

## Architecture Principles

1. **Modularity**: Independent feature modules
2. **Scalability**: Multi-subsidiary support
3. **Security**: Role-based access control
4. **Performance**: Optimized data fetching
5. **Maintainability**: Clean code architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    React Application                     │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │ │
│  │  │ Core     │ │ Modules  │ │ Integr.  │ │ Testing  │   │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Firebase                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Firestore  │ │    Auth    │ │  Storage   │ │Functions │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── core/                    # Shared infrastructure
│   ├── components/          # UI components
│   │   ├── ui/              # Base components (shadcn)
│   │   ├── layout/          # Layout components
│   │   ├── navigation/      # Navigation components
│   │   ├── search/          # Global search
│   │   ├── notifications/   # Notification center
│   │   └── dashboard/       # Dashboard components
│   ├── hooks/               # Custom React hooks
│   └── services/            # Cross-module services
│
├── integration/             # Cross-module integration
│   ├── store/               # Global state (GlobalContext)
│   └── constants/           # Module configurations
│
├── subsidiaries/            # Subsidiary-specific code
│   └── finishes/            # Dawin Finishes modules
│       ├── design-manager/
│       ├── cutlist/
│       └── ...
│
├── lib/                     # Libraries and utilities
│   └── firebase.ts          # Firebase initialization
│
├── testing/                 # Test infrastructure
│   ├── config/              # Test configuration
│   ├── setup/               # Test setup and mocks
│   ├── factories/           # Test data factories
│   ├── utils/               # Test utilities
│   └── integration/         # Integration tests
│
└── app/                     # Application entry
    ├── pages/               # Route pages
    └── main.jsx             # Entry point
```

## Core Layer

### Global State Management

State is managed via React Context (`GlobalContext`):

```typescript
interface GlobalState {
  user: User | null;
  subsidiary: Subsidiary | null;
  currentModule: ModuleId | null;
  sidebarState: SidebarState;
  searchState: SearchState;
  notifications: Notification[];
  preferences: UserPreferences;
}
```

### Services

| Service | Purpose |
|---------|---------|
| `crossModuleService` | Cross-module references |
| `searchService` | Global search |
| `syncService` | Data synchronization |
| `notificationService` | User notifications |
| `analyticsService` | Usage analytics |

### Hooks

| Hook | Purpose |
|------|---------|
| `useCrossModule` | Cross-module data |
| `useGlobalSearch` | Search functionality |
| `useSync` | Sync status |
| `useKeyboardShortcuts` | Keyboard navigation |

## Module Architecture

### Module Structure

Each module follows this structure:

```
module-name/
├── components/          # UI components
├── hooks/               # Module-specific hooks
├── services/            # Module services
├── types/               # TypeScript types
├── constants/           # Module constants
└── index.ts             # Public exports
```

### Module Registration

Modules are registered in `integration/constants/modules.constants.ts`:

```typescript
export const MODULES: ModuleDefinition[] = [
  {
    id: 'hr_central',
    name: 'HR Central',
    path: '/hr',
    icon: 'Users',
    permissions: ['hr:read'],
  },
  // ...
];
```

## Data Flow

### Read Flow

```
Component
    │
    ▼
useQuery (React Query)
    │
    ▼
Service Layer
    │
    ▼
Firestore SDK
    │
    ▼
Firebase Firestore
```

### Write Flow

```
Component (Form Submit)
    │
    ▼
Service Layer (Validation)
    │
    ▼
Firestore SDK
    │
    ▼
Security Rules Check
    │
    ▼
Firebase Firestore
    │
    ▼
Realtime Update → Components
```

## Cross-Module Integration

### Reference Tracking

Cross-module references are stored in `cross_module_references`:

```typescript
interface CrossModuleReference {
  id: string;
  sourceModule: string;
  sourceEntityId: string;
  targetModule: string;
  targetEntityId: string;
  referenceType: string;
  metadata?: Record<string, unknown>;
}
```

### Activity Tracking

Cross-module activities are logged for the unified dashboard:

```typescript
interface CrossModuleActivity {
  id: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  userId: string;
  timestamp: Timestamp;
}
```

## Firebase Integration

### Firestore Collections

| Collection | Purpose |
|------------|---------|
| `users` | User profiles |
| `employees` | Employee records |
| `payroll` | Payroll data |
| `okrs` | OKRs and objectives |
| `kpis` | Key performance indicators |
| `deals` | Investment deals |
| `notifications` | User notifications |
| `audit_logs` | Audit trail |

### Security Rules

Security rules enforce:

1. Authentication requirement
2. Permission-based access
3. Subsidiary isolation
4. Audit trail protection

## Performance Optimization

### Code Splitting

Modules are lazy-loaded:

```typescript
const HRModule = lazy(() => import('./modules/hr-central'));
const StrategyModule = lazy(() => import('./modules/ceo-strategy'));
```

### Data Caching

React Query provides:

- Automatic caching
- Background refetching
- Optimistic updates

### Bundle Optimization

Vite configuration includes:

- Manual chunk splitting by module
- Vendor chunk separation
- Tree shaking
- Minification

## Testing Architecture

### Test Pyramid

```
        ┌───────┐
        │ E2E   │  10%
        ├───────┤
        │ Integ │  30%
        ├───────┤
        │ Unit  │  60%
        └───────┘
```

### Test Types

| Type | Tool | Location |
|------|------|----------|
| Unit | Vitest | `src/**/*.test.ts` |
| Integration | Vitest + MSW | `src/testing/integration/` |
| E2E | Playwright | `e2e/tests/` |
| Performance | Vitest | `src/testing/performance/` |

## Deployment Architecture

### Environments

```
develop branch → Staging (preview channel)
main branch → Production (live)
PR → Preview channel (temporary)
```

### CI/CD Pipeline

```
Push → Install → Lint → Test → Build → Deploy → Verify
```

## Scalability Considerations

### Multi-Subsidiary Support

- Data partitioned by `subsidiaryId`
- Security rules enforce isolation
- Indexes optimized per subsidiary

### Performance at Scale

- Pagination for large lists
- Firestore indexes for common queries
- Caching layer via React Query

## Future Architecture

### Planned Improvements

1. **Micro-frontends**: Module federation for independent deployments
2. **Offline Support**: Service worker with background sync
3. **Real-time Collaboration**: Presence and live cursors
4. **AI Integration**: Enhanced Gemini integration for automation
