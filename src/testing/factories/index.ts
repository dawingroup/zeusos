/**
 * Test Factories Index
 * Export all test data factories
 */

export { TestDataFactory } from './test-data.factory';
export type {
  EngagementType,
  EngagementStatus,
  FundingType,
  ProjectStatus,
  ImplementationType,
  PaymentStatus,
  PaymentType,
  DealStage,
  BOQStatus,
} from './test-data.factory';

// Phase 8.3 Employee factories
export {
  employeeFactory,
  payrollFactory,
  resetEmployeeSequence,
  type TestEmployee,
  type TestPayrollData,
} from './employee.factory';
