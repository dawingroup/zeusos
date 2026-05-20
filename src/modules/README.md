# Modules Architecture

This directory contains self-contained feature modules for the Dawin Design-to-Production platform.

## Module Pattern

Each module follows a consistent structure and encapsulates all code related to a specific feature domain.

### Structure

```
modules/
├── [module-name]/
│   ├── components/       # React components (UI)
│   ├── hooks/            # Custom React hooks
│   ├── services/         # Business logic, API calls
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Helper functions
│   ├── context/          # React context providers
│   └── index.ts          # Public API (barrel export)
```

### Principles

1. **Self-Contained**: Each module should be independently deployable and testable
2. **Public API**: Only export what other modules need via `index.ts`
3. **No Cross-Module Imports**: Modules should not import directly from each other's internal files
4. **Shared Dependencies**: Use `@/shared/*` for common utilities, components, and services
5. **Single Responsibility**: Each module owns one feature domain

### Import Rules

```typescript
// ✅ CORRECT - Import from module's public API
import { CutlistProcessor } from '@/modules/cutlist-processor';

// ✅ CORRECT - Import from shared
import { useAuth } from '@/shared/hooks';
import { Button } from '@/shared/components/ui';

// ❌ WRONG - Direct import from module internals
import { SomeComponent } from '@/modules/cutlist-processor/components/SomeComponent';

// ❌ WRONG - Cross-module internal import
import { something } from '@/modules/design-manager/utils/helper';
```

### Module Communication

Modules communicate through:
1. **Shared Services**: Firebase, external APIs via `@/shared/services`
2. **URL Parameters**: Route-based data passing
3. **Shared State**: Global state in `@/shared/context` (sparingly)
4. **Events**: Custom events for loose coupling (if needed)

## Current Modules

### cutlist-processor
**Status**: Existing (migration pending)

CSV upload, material mapping, nesting optimization, and PDF output for cutting lists.

**Public API**:
- Components: Main cutlist processor view
- Hooks: useCutlistOptimization, useMaterialMapping
- Types: Panel, Material, OptimizationResult

### design-manager
**Status**: New (in development)

Design workflow tracking with traffic light status system, stage-gate processes, and approval workflows.

**Public API**:
- Components: Dashboard, DesignItem, TrafficLight, Approvals
- Hooks: useDesignWorkflow, useStageGate
- Types: DesignItem, Stage, ApprovalStatus

## Adding a New Module

1. Create the module directory structure:
   ```bash
   mkdir -p src/modules/[module-name]/{components,hooks,services,types,utils,context}
   ```

2. Create the `index.ts` barrel export:
   ```typescript
   // src/modules/[module-name]/index.ts
   export * from './components';
   export * from './hooks';
   export * from './types';
   ```

3. Register the module route in `src/app/routes/index.ts`

4. Add module to the main modules index:
   ```typescript
   // src/modules/index.ts
   export * as NewModule from './new-module';
   ```

## Testing

Each module should have its own tests co-located with the code:

```
modules/[module-name]/
├── components/
│   ├── MyComponent.tsx
│   └── __tests__/
│       └── MyComponent.test.tsx
├── hooks/
│   ├── useMyHook.ts
│   └── __tests__/
│       └── useMyHook.test.ts
```

Run module-specific tests:
```bash
npm test -- --testPathPattern=modules/[module-name]
```
