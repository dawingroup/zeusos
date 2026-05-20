// ============================================================================
// E2E TEST TIMEOUTS
// DawinOS v2.0 - Testing Strategy
// Timeout constants for E2E tests
// ============================================================================

export const TEST_TIMEOUTS = {
  E2E: {
    DEFAULT: 30000,
    NAVIGATION: 10000,
    FORM_SUBMIT: 15000,
    DATA_LOAD: 20000,
    WORKFLOW: 60000,
  },
  WAIT: {
    SHORT: 100,
    MEDIUM: 500,
    LONG: 1000,
    VERY_LONG: 5000,
  },
} as const;
