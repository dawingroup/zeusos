# Testing Framework

Comprehensive testing framework for the Dawin Advisory Platform v5 to v6 migration.

## Prerequisites

### For Unit Tests
- Node.js 18+
- npm dependencies installed (`npm install`)

### For Integration/Migration Tests
- **Java Runtime** (required for Firebase Emulators)
  - macOS: `brew install openjdk@17`
  - Ubuntu: `sudo apt install openjdk-17-jdk`
  - Windows: Download from [java.com](https://www.java.com)
- Firebase CLI: `npm install -g firebase-tools`

## Quick Start

```bash
# Install dependencies
npm install

# Run unit tests (no emulators needed)
npm run test:run -- src/testing/unit/

# Start Firebase emulators (requires Java)
npm run emulators

# Run integration tests (in another terminal)
npm run test:integration

# Run migration tests
npm run test:migration

# Run all tests with coverage
npm run test:coverage
```

## Test Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run all tests once |
| `npm run test:ui` | Run tests with UI |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:integration` | Run integration tests (requires emulators) |
| `npm run test:migration` | Run migration tests (requires emulators) |
| `npm run test:benchmark` | Run performance benchmarks |
| `npm run emulators` | Start Firebase emulators |
| `npm run emulators:test` | Run integration tests with emulators (automated) |

## Directory Structure

```
src/testing/
├── config/
│   └── test.config.ts       # Test configuration and environment settings
├── utils/
│   └── test-environment.ts  # Test environment manager (emulator connection)
├── factories/
│   └── test-data.factory.ts # Test data generators for all entities
├── unit/
│   └── test-data-factory.test.ts  # Unit tests (no emulators)
├── integration/
│   ├── engagement.service.test.ts # Engagement CRUD tests
│   └── cross-module.test.ts       # Cross-module workflow tests
├── migration/
│   ├── dry-run-executor.ts  # Migration dry-run implementation
│   └── dry-run.test.ts      # Migration validation tests
├── performance/
│   ├── thresholds.config.ts # Performance thresholds
│   └── benchmark.test.ts    # Performance benchmarks
├── uat/
│   ├── uat-test-cases.ts    # UAT test case definitions
│   └── uat-executor.ts      # UAT execution framework
├── setup.ts                 # Unit test setup
├── setup.integration.ts     # Integration test setup
└── index.ts                 # Main exports
```

## Firebase Emulator Ports

| Service | Port |
|---------|------|
| Auth | 9099 |
| Firestore | 8080 |
| Functions | 5001 |
| Storage | 9199 |
| Emulator UI | 4000 |

## Test Types

### Unit Tests
Tests that don't require Firebase emulators. Good for testing:
- Data factories
- Utility functions
- Pure business logic

```bash
npm run test:run -- src/testing/unit/
```

### Integration Tests
Tests that require Firebase emulators. Cover:
- CRUD operations
- Query operations
- Cross-module workflows
- IPC approval workflows

```bash
# Terminal 1: Start emulators
npm run emulators

# Terminal 2: Run tests
npm run test:integration
```

### Migration Tests
Tests for v5 to v6 migration validation:
- Data validation
- Transformation logic
- Referential integrity
- Rollback functionality

```bash
npm run test:migration
```

### Performance Benchmarks
Measure operation performance:
- Read/write latency
- Batch operations
- Concurrent operations
- Migration throughput

```bash
npm run test:benchmark
```

## Test Data Factory

Generate realistic test data for any entity:

```typescript
import { TestDataFactory } from '@/testing';

// Single entities
const client = TestDataFactory.createClient();
const engagement = TestDataFactory.createEngagement({ type: 'infrastructure' });
const project = TestDataFactory.createProject(engagement.id);
const payment = TestDataFactory.createPayment(engagement.id, project.id);

// Batch creation
const engagements = TestDataFactory.createBatch(
  () => TestDataFactory.createEngagement(),
  10
);

// Combined entities
const { engagement, projects } = TestDataFactory.createEngagementWithProjects(5);

// V5 legacy data
const { programs, projects, payments } = TestDataFactory.createFullV5Dataset(3, 5, 2);
```

## Migration Dry-Run

Execute migration dry-runs to validate before production:

```typescript
import { DryRunExecutor } from '@/testing';

const executor = new DryRunExecutor(db, {
  sampleSize: 100,
  validateOnly: false,
  rollbackOnComplete: true,
});

const result = await executor.executeDryRun();
console.log(result.recommendations);
```

## UAT Framework

Track user acceptance testing:

```typescript
import { UATExecutor, getUATTestCaseById } from '@/testing';

const executor = new UATExecutor();
const execution = await executor.startExecution('UAT-ENG-001', 'tester-1', 'staging');

// Record step results
await executor.recordStepResult(execution.id, {
  stepNumber: 1,
  status: 'passed',
  actualOutcome: 'Form displayed correctly',
  executedAt: new Date(),
});

// Generate report
const report = executor.exportReportAsMarkdown();
```

## Troubleshooting

### "Test environment not initialized"
The test requires Firebase emulators. Make sure:
1. Java is installed: `java -version`
2. Emulators are running: `npm run emulators`
3. Run with correct config: `npm run test:integration`

### "Java not found"
Install Java:
- macOS: `brew install openjdk@17`
- Add to PATH: `export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"`

### Emulator connection issues
Check emulator ports aren't in use:
```bash
lsof -i :8080  # Firestore
lsof -i :9099  # Auth
```

## Coverage Thresholds

| Metric | Threshold |
|--------|-----------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |
