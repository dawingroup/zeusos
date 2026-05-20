# Design Manager Module - Gap Analysis & Risk Assessment

**Generated:** December 25, 2025  
**Spec Version:** Design Process Management Module Technical Specification  
**Codebase:** `/Users/macbook/cutlist-processor`

---

## 1. Executive Summary

### Implementation Status: ~60% Complete

| Category | Spec Requirements | Implemented | Gap |
|----------|------------------|-------------|-----|
| **Data Models** | 8 interfaces | 6 | 2 missing |
| **Components** | 15 components | 12 | 3 missing |
| **Hooks** | 5 hooks | 5 | ✅ Complete |
| **Cloud Functions** | 4 functions | 1 | 3 missing |
| **Firestore Rules** | 7 collections | 3 | 4 missing |
| **Utilities** | 3 utilities | 3 | ✅ Complete |

---

## 2. Detailed Gap Analysis

### 2.1 Data Models (types/index.ts)

#### ✅ IMPLEMENTED
- `RAGStatusValue`, `DesignStage`, `DesignCategory`
- `RAGValue`, `RAGStatus` (all 19 aspects)
- `DesignCompletenessAspects`, `ManufacturingReadinessAspects`, `QualityGatesAspects`
- `StageTransition`, `ApprovalRecord`, `DesignFile`
- `DesignItem`, `DesignProject`
- `DesignDashboardStats`, `DesignItemFilters`

#### ❌ MISSING FROM SPEC
| Interface | Priority | Risk Level |
|-----------|----------|------------|
| `DesignParameters` | HIGH | 🔴 Critical |
| `MaterialSpec` | HIGH | 🔴 Critical |
| `HardwareSpec` | MEDIUM | 🟡 Medium |
| `FinishSpec` | MEDIUM | 🟡 Medium |
| `Deliverable` | MEDIUM | 🟡 Medium |
| `AIAnalysis` | LOW | 🟢 Low |
| `DfMIssue` | LOW | 🟢 Low |
| `Approval` (full version) | MEDIUM | 🟡 Medium |

### 2.2 Components

#### ✅ IMPLEMENTED
| Component | File | Status |
|-----------|------|--------|
| `DesignDashboard` | `/components/dashboard/DesignDashboard.tsx` | ✅ |
| `StageKanban` | `/components/dashboard/StageKanban.tsx` | ✅ |
| `RAGIndicator` | `/components/traffic-light/RAGIndicator.tsx` | ✅ |
| `RAGStatusPanel` | `/components/traffic-light/RAGStatusPanel.tsx` | ✅ |
| `RAGStagePanel` | `/components/traffic-light/RAGStagePanel.tsx` | ✅ |
| `RAGEditModal` | `/components/traffic-light/RAGEditModal.tsx` | ✅ |
| `StageGateCheck` | `/components/stage-gate/StageGateCheck.tsx` | ✅ |
| `DesignItemCard` | `/components/design-item/DesignItemCard.tsx` | ✅ |
| `DesignItemDetail` | `/components/design-item/DesignItemDetail.tsx` | ✅ |
| `ReadinessGauge` | `/components/design-item/ReadinessGauge.tsx` | ✅ |
| `StageBadge` | `/components/design-item/StageBadge.tsx` | ✅ |
| `NewDesignItemDialog` | `/components/design-item/NewDesignItemDialog.tsx` | ✅ |

#### ❌ MISSING/INCOMPLETE
| Component | Priority | Risk Level | Notes |
|-----------|----------|------------|-------|
| `ParametersEditor` | HIGH | 🔴 Critical | Core design spec editor |
| `BriefAnalyzer` | MEDIUM | 🟡 Medium | AI integration - files exist but broken |
| `DfMChecker` | MEDIUM | 🟡 Medium | AI integration - files exist but broken |
| `ApprovalPanel` | LOW | 🟢 Low | Approval workflow UI |
| `DeliverablesPanel` | LOW | 🟢 Low | File management UI |

### 2.3 Cloud Functions (functions/index.js)

#### ✅ IMPLEMENTED
| Function | Purpose | Status |
|----------|---------|--------|
| `api` (Notion) | Customer/Project queries | ✅ Working |

#### ❌ MISSING
| Function | Priority | Risk Level | Complexity |
|----------|----------|------------|------------|
| `syncDesignToKatana` | HIGH | 🔴 Critical | High |
| `analyzeBrief` | MEDIUM | 🟡 Medium | Medium |
| `runDfMCheck` | MEDIUM | 🟡 Medium | Medium |
| `syncMilestoneToNotion` | LOW | 🟢 Low | Low |

### 2.4 Firestore Security Rules

#### ✅ IMPLEMENTED
- `designProjects/{projectId}` - Basic read/write
- `designProjects/{projectId}/designItems/{itemId}` - Basic CRUD
- `users/{userId}` - Self-write only

#### ❌ MISSING
| Collection | Priority | Notes |
|------------|----------|-------|
| `stageHistory` subcollection | HIGH | Needs immutable audit trail |
| `approvals` subcollection | MEDIUM | Needs assignee-based update |
| `deliverables` subcollection | MEDIUM | Standard CRUD |
| `aiAnalyses` subcollection | LOW | Requestor-based update |
| Helper functions (`isAdmin`, `isProjectMember`) | HIGH | Security critical |

---

## 3. High-Risk Implementation Areas

### 🔴 CRITICAL RISK

#### 3.1 AI Component Integration
**Problem:** Previous attempt to integrate `BriefAnalyzer` and `DfMChecker` caused white screen crash.

**Root Causes:**
1. Module import errors in barrel exports
2. Missing type definitions (`BriefAnalysisResult`, `ExtractedDesignItem`, `DesignItemFull`)
3. Lazy loading not properly configured
4. No error boundary catching component failures

**Mitigation Strategy:**
```typescript
// 1. Use dynamic imports with error handling
const BriefAnalyzer = lazy(() => 
  import('../ai/BriefAnalyzer').catch(() => ({
    default: () => <ErrorFallback message="AI Brief Analyzer unavailable" />
  }))
);

// 2. Wrap in error boundary
<AIErrorBoundary>
  <Suspense fallback={<LoadingSpinner />}>
    <BriefAnalyzer />
  </Suspense>
</AIErrorBoundary>

// 3. Feature flag to disable if broken
if (import.meta.env.VITE_ENABLE_AI_BRIEF_PARSING !== 'true') {
  return <FeatureDisabled />;
}
```

#### 3.2 Katana API Integration
**Problem:** External API with rate limits, authentication, and complex data mapping.

**Risks:**
- Rate limiting (60 requests/minute)
- API key exposure
- BOM structure mismatch
- Sync failures leaving inconsistent state

**Mitigation Strategy:**
```typescript
// 1. Use Firebase Secrets for API key
const KATANA_API_KEY = defineSecret('KATANA_API_KEY');

// 2. Implement retry with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000);
    }
  }
}

// 3. Transaction-style sync with rollback
const syncResult = await db.runTransaction(async (transaction) => {
  // Update Firestore first, mark as "syncing"
  // Call Katana API
  // If success: update to "synced"
  // If failure: rollback to previous state
});
```

#### 3.3 Stage Transition with Gate Checks
**Problem:** Complex validation logic with override capability.

**Risks:**
- Race conditions when multiple users edit same item
- Gate criteria bypass without proper audit
- Inconsistent state if validation fails mid-transition

**Mitigation Strategy:**
```typescript
// 1. Use Firestore transactions
export async function transitionStage(
  projectId: string,
  itemId: string,
  targetStage: DesignStage,
  options: { userId: string; notes?: string; override?: boolean }
): Promise<TransitionResult> {
  return db.runTransaction(async (transaction) => {
    const itemRef = doc(db, 'designProjects', projectId, 'designItems', itemId);
    const itemSnap = await transaction.get(itemRef);
    
    if (!itemSnap.exists()) {
      throw new Error('ITEM_NOT_FOUND');
    }
    
    const item = itemSnap.data() as DesignItem;
    
    // Validate gate criteria
    const validation = canAdvanceToStage(item, targetStage);
    if (!validation.canAdvance && !options.override) {
      return { success: false, failures: validation.failures };
    }
    
    // Create history entry atomically
    const historyRef = doc(collection(itemRef, 'stageHistory'));
    transaction.set(historyRef, {
      fromStage: item.currentStage,
      toStage: targetStage,
      transitionedAt: serverTimestamp(),
      transitionedBy: options.userId,
      gateCheckPassed: validation.canAdvance,
      overrideUsed: options.override && !validation.canAdvance,
      notes: options.notes || '',
    });
    
    // Update item
    transaction.update(itemRef, {
      currentStage: targetStage,
      stageEnteredAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: options.userId,
    });
    
    return { success: true };
  });
}
```

### 🟡 MEDIUM RISK

#### 3.4 DesignParameters Type Complexity
**Problem:** Deep nested object with many optional fields.

**Risks:**
- Partial updates overwriting data
- Type mismatches at runtime
- UI form state complexity

**Mitigation:**
```typescript
// Use Zod for runtime validation
const DesignParametersSchema = z.object({
  dimensions: z.object({
    width: z.number().nullable(),
    height: z.number().nullable(),
    depth: z.number().nullable(),
    unit: z.enum(['mm', 'inches']),
  }),
  primaryMaterial: MaterialSpecSchema.nullable(),
  // ... etc
});

// Validate before save
function updateParameters(params: unknown): DesignParameters {
  return DesignParametersSchema.parse(params);
}
```

#### 3.5 Real-time Subscriptions Memory Leaks
**Problem:** Multiple `onSnapshot` listeners without cleanup.

**Mitigation:**
```typescript
// Always return cleanup function
useEffect(() => {
  const unsubscribe = subscribeToDesignItems(projectId, setItems);
  return () => unsubscribe();
}, [projectId]);

// Use AbortController for async operations
useEffect(() => {
  const controller = new AbortController();
  
  fetchData(controller.signal).catch(e => {
    if (e.name !== 'AbortError') throw e;
  });
  
  return () => controller.abort();
}, []);
```

### 🟢 LOW RISK

#### 3.6 Deliverables File Upload
- Standard Firebase Storage operations
- Existing patterns in codebase

#### 3.7 Notion Milestone Sync
- Simple API calls
- Non-critical feature

---

## 4. Error Logging System

### 4.1 Error Categories

```typescript
// src/modules/design-manager/utils/error-logger.ts

export enum ErrorCategory {
  FIREBASE = 'FIREBASE',
  KATANA_API = 'KATANA_API',
  NOTION_API = 'NOTION_API',
  AI_ANALYSIS = 'AI_ANALYSIS',
  VALIDATION = 'VALIDATION',
  UI_COMPONENT = 'UI_COMPONENT',
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
}

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',   // App crash, data loss
  ERROR = 'ERROR',         // Feature broken
  WARNING = 'WARNING',     // Degraded experience
  INFO = 'INFO',           // Logged for debugging
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  stack?: string;
  context: Record<string, unknown>;
  userId?: string;
  resolved: boolean;
}
```

### 4.2 Error Codes Reference

| Code | Category | Severity | Description | Resolution |
|------|----------|----------|-------------|------------|
| `FB_001` | FIREBASE | CRITICAL | Firestore connection failed | Check network/config |
| `FB_002` | FIREBASE | ERROR | Document not found | Verify ID exists |
| `FB_003` | FIREBASE | ERROR | Permission denied | Check auth/rules |
| `FB_004` | FIREBASE | WARNING | Query timeout | Optimize query |
| `KT_001` | KATANA_API | ERROR | Authentication failed | Check API key |
| `KT_002` | KATANA_API | WARNING | Rate limit exceeded | Wait and retry |
| `KT_003` | KATANA_API | ERROR | Product sync failed | Check data mapping |
| `AI_001` | AI_ANALYSIS | ERROR | Claude API error | Check API key/limits |
| `AI_002` | AI_ANALYSIS | WARNING | Low confidence result | Review manually |
| `AI_003` | AI_ANALYSIS | INFO | Analysis cached | Normal operation |
| `VAL_001` | VALIDATION | WARNING | Gate check failed | Review criteria |
| `VAL_002` | VALIDATION | ERROR | Invalid RAG status | Fix data |
| `UI_001` | UI_COMPONENT | CRITICAL | Component crash | Check error boundary |
| `UI_002` | UI_COMPONENT | ERROR | Render error | Check props/state |
| `NET_001` | NETWORK | ERROR | Request timeout | Retry operation |
| `AUTH_001` | AUTH | CRITICAL | Session expired | Re-authenticate |

### 4.3 Implementation

```typescript
// src/modules/design-manager/utils/error-logger.ts

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

class DesignManagerErrorLogger {
  private static instance: DesignManagerErrorLogger;
  private errorQueue: ErrorLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Flush errors every 5 seconds
    this.flushInterval = setInterval(() => this.flush(), 5000);
    
    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  static getInstance(): DesignManagerErrorLogger {
    if (!DesignManagerErrorLogger.instance) {
      DesignManagerErrorLogger.instance = new DesignManagerErrorLogger();
    }
    return DesignManagerErrorLogger.instance;
  }

  log(
    code: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    context: Record<string, unknown> = {},
    error?: Error
  ): void {
    const logEntry: ErrorLog = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      category,
      severity,
      code,
      message,
      stack: error?.stack,
      context,
      userId: this.getCurrentUserId(),
      resolved: false,
    };

    // Always log to console in development
    if (import.meta.env.DEV) {
      console.group(`[${severity}] ${code}: ${message}`);
      console.log('Context:', context);
      if (error) console.error(error);
      console.groupEnd();
    }

    // Critical errors logged immediately
    if (severity === ErrorSeverity.CRITICAL) {
      this.persistError(logEntry);
    } else {
      this.errorQueue.push(logEntry);
    }
  }

  private async flush(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      const batch = errors.map(error => 
        addDoc(collection(db, 'errorLogs'), {
          ...error,
          timestamp: serverTimestamp(),
        })
      );
      await Promise.all(batch);
    } catch (e) {
      // If we can't log to Firestore, log to console
      console.error('Failed to persist error logs:', e);
      errors.forEach(err => console.error(err));
    }
  }

  private async persistError(error: ErrorLog): Promise<void> {
    try {
      await addDoc(collection(db, 'errorLogs'), {
        ...error,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to persist critical error:', e, error);
    }
  }

  private getCurrentUserId(): string | undefined {
    // Get from auth context - implement based on your auth setup
    return undefined;
  }
}

export const errorLogger = DesignManagerErrorLogger.getInstance();

// Convenience functions
export function logFirebaseError(code: string, message: string, context: Record<string, unknown>, error?: Error): void {
  errorLogger.log(code, ErrorCategory.FIREBASE, ErrorSeverity.ERROR, message, context, error);
}

export function logKatanaError(code: string, message: string, context: Record<string, unknown>, error?: Error): void {
  errorLogger.log(code, ErrorCategory.KATANA_API, ErrorSeverity.ERROR, message, context, error);
}

export function logAIError(code: string, message: string, context: Record<string, unknown>, error?: Error): void {
  errorLogger.log(code, ErrorCategory.AI_ANALYSIS, ErrorSeverity.ERROR, message, context, error);
}

export function logUIError(code: string, message: string, context: Record<string, unknown>, error?: Error): void {
  errorLogger.log(code, ErrorCategory.UI_COMPONENT, ErrorSeverity.ERROR, message, context, error);
}

export function logCritical(code: string, category: ErrorCategory, message: string, context: Record<string, unknown>, error?: Error): void {
  errorLogger.log(code, category, ErrorSeverity.CRITICAL, message, context, error);
}
```

---

## 5. Implementation Priority Matrix

### Phase 1: Foundation Fixes (Week 1)
| Task | Priority | Risk | Effort |
|------|----------|------|--------|
| Add missing types (`DesignParameters`, `MaterialSpec`, etc.) | HIGH | LOW | 2h |
| Update Firestore rules with subcollections | HIGH | MEDIUM | 2h |
| Implement error logging system | HIGH | LOW | 3h |
| Fix AI component integration with proper lazy loading | HIGH | HIGH | 4h |

### Phase 2: Core Features (Week 2)
| Task | Priority | Risk | Effort |
|------|----------|------|--------|
| Implement `ParametersEditor` component | HIGH | MEDIUM | 8h |
| Add Katana sync Cloud Function | HIGH | HIGH | 8h |
| Add stage history subcollection support | MEDIUM | LOW | 4h |

### Phase 3: Integrations (Week 3)
| Task | Priority | Risk | Effort |
|------|----------|------|--------|
| Implement `analyzeBrief` Cloud Function | MEDIUM | MEDIUM | 6h |
| Implement `runDfMCheck` Cloud Function | MEDIUM | MEDIUM | 6h |
| Add Notion milestone sync | LOW | LOW | 4h |

### Phase 4: Polish (Week 4)
| Task | Priority | Risk | Effort |
|------|----------|------|--------|
| Approval workflow UI | LOW | LOW | 6h |
| Deliverables management | LOW | LOW | 4h |
| Testing & bug fixes | HIGH | - | 8h |

---

## 6. Testing Checklist

### Unit Tests Required
- [ ] `calculateOverallReadiness()` - RAG calculation
- [ ] `canAdvanceToStage()` - Gate validation
- [ ] `formatItemCode()` - Code generation
- [ ] Error logger - All error types

### Integration Tests Required
- [ ] Stage transition with history
- [ ] RAG status update and readiness recalculation
- [ ] Katana sync pipeline (mock API)

### E2E Tests Required
- [ ] Create project → Add item → Edit RAG → Advance stage
- [ ] AI brief parsing → Apply to item
- [ ] Production release → Katana sync

---

## 7. Monitoring & Alerts

### Key Metrics to Track
1. **Error Rate**: Errors per hour by category
2. **Katana Sync Success**: % successful syncs
3. **AI Analysis Latency**: P95 response time
4. **Gate Override Rate**: % transitions using override

### Alert Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | >10/hour | >50/hour |
| Katana Sync Failures | >5% | >20% |
| AI Latency P95 | >10s | >30s |
| Gate Override Rate | >30% | >50% |

---

*Document maintained by: Development Team*  
*Last updated: December 25, 2025*
