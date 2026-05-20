// ============================================================================
// TEST TYPES
// DawinOS v2.0 - Testing Strategy
// TypeScript interfaces for testing
// ============================================================================

import type { ReactElement } from 'react';

// =============================================================================
// TEST RESULT TYPES
// =============================================================================

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export type TestSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface TestResult {
  id: string;
  name: string;
  status: TestStatus;
  duration: number;
  error?: string;
  stack?: string;
  retries?: number;
  startedAt: Date;
  completedAt?: Date;
}

export interface TestSuiteResult {
  id: string;
  name: string;
  phase: string;
  module: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

export interface TestRunSummary {
  id: string;
  runId: string;
  timestamp: Date;
  environment: 'local' | 'ci' | 'staging' | 'production';
  branch: string;
  commit: string;
  suites: TestSuiteResult[];
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  coverage?: CoverageReport;
}

// =============================================================================
// COVERAGE TYPES
// =============================================================================

export interface CoverageMetrics {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface CoverageReport {
  summary: CoverageMetrics;
  byFile: Record<string, CoverageMetrics>;
  byPhase: Record<string, CoverageMetrics>;
  byModule: Record<string, CoverageMetrics>;
  thresholdsPassed: boolean;
}

// =============================================================================
// TEST CONFIGURATION TYPES
// =============================================================================

export interface TestConfig {
  phase: string;
  module: string;
  timeout?: number;
  retries?: number;
  tags?: string[];
  skip?: boolean;
  only?: boolean;
}

export interface TestFixture<T = unknown> {
  name: string;
  data: T;
  cleanup?: () => Promise<void>;
}

export interface MockConfig {
  services?: string[];
  firebase?: boolean;
  api?: boolean;
  storage?: boolean;
}

// =============================================================================
// RENDER OPTIONS
// =============================================================================

export interface CustomRenderOptions {
  user?: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    subsidiaryId: string;
    permissions: string[];
  };
  subsidiary?: {
    id: string;
    name: string;
    code: string;
    type: string;
    currency: string;
    timezone: string;
    status: string;
  };
  initialRoute?: string;
  preloadedState?: Record<string, unknown>;
}

export interface RenderResult {
  user: unknown;
  container: HTMLElement;
  rerender: (ui: ReactElement) => void;
  unmount: () => void;
  asFragment: () => DocumentFragment;
}

// =============================================================================
// FACTORY TYPES
// =============================================================================

export interface FactoryOptions<T> {
  overrides?: Partial<T>;
  traits?: string[];
  count?: number;
  sequence?: number;
}

export interface Factory<T> {
  build: (options?: FactoryOptions<T>) => T;
  buildList: (count: number, options?: FactoryOptions<T>) => T[];
  create: (options?: FactoryOptions<T>) => Promise<T>;
  createList: (count: number, options?: FactoryOptions<T>) => Promise<T[]>;
}

// =============================================================================
// ASSERTION HELPERS
// =============================================================================

export interface CustomMatchers<R = unknown> {
  toBeValidUUID(): R;
  toBeValidUGXAmount(): R;
  toBeValidEmail(): R;
  toBeValidPhone(): R;
  toBeWithinRange(min: number, max: number): R;
  toHavePermission(permission: string): R;
  toBeInPhase(phase: string): R;
}

// =============================================================================
// PERFORMANCE TESTING
// =============================================================================

export interface PerformanceMetrics {
  renderTime: number;
  updateTime: number;
  memoryUsage: number;
  bundleSize: number;
  networkRequests: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface PerformanceBenchmark {
  name: string;
  baseline: number;
  current: number;
  threshold: number;
  passed: boolean;
  difference: number;
  percentChange: number;
}

// =============================================================================
// E2E TESTING
// =============================================================================

export interface E2ETestContext {
  baseUrl: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    permissions: string[];
  };
  authToken?: string;
  cookies?: Record<string, string>;
}

export interface E2EAction {
  type: 'click' | 'type' | 'select' | 'navigate' | 'wait' | 'assert';
  target?: string;
  value?: string;
  options?: Record<string, unknown>;
}

export interface E2EScenario {
  name: string;
  description: string;
  phase: string;
  criticalPath: string;
  steps: E2EAction[];
  assertions: E2EAction[];
  cleanup?: E2EAction[];
}

// =============================================================================
// MOCK TYPES
// =============================================================================

export interface MockFirestoreDoc<T> {
  id: string;
  data: () => T;
  exists: () => boolean;
  ref: {
    id: string;
    path: string;
  };
}

export interface MockFirestoreQuery<T> {
  docs: MockFirestoreDoc<T>[];
  empty: boolean;
  size: number;
}

export interface MockApiResponse<T> {
  status: number;
  data: T;
  headers?: Record<string, string>;
  delay?: number;
}

// =============================================================================
// TEST REPORT TYPES
// =============================================================================

export interface TestReportConfig {
  format: 'html' | 'json' | 'junit' | 'markdown';
  outputDir: string;
  includeScreenshots?: boolean;
  includeVideos?: boolean;
  includeConsoleOutput?: boolean;
}

export interface TestReport {
  config: TestReportConfig;
  summary: TestRunSummary;
  details: TestSuiteResult[];
  artifacts: {
    screenshots: string[];
    videos: string[];
    logs: string[];
  };
  generatedAt: Date;
}
