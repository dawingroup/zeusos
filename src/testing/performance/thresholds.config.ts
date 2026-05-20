/**
 * Performance Thresholds Configuration
 * Defines acceptable performance limits for operations
 */

export interface OperationThreshold {
  maxLatency: number; // milliseconds
  minThroughput: number; // operations per second
  maxMemory: number; // bytes
}

export interface PerformanceThresholds {
  operations: Record<string, OperationThreshold>;
  general: {
    pageLoadTime: number;
    apiResponseTime: number;
    migrationThroughput: number;
  };
}

export const performanceThresholds: PerformanceThresholds = {
  operations: {
    // Engagement operations
    create_engagement: {
      maxLatency: 100,
      minThroughput: 10,
      maxMemory: 50 * 1024 * 1024, // 50MB
    },
    read_engagement: {
      maxLatency: 50,
      minThroughput: 50,
      maxMemory: 20 * 1024 * 1024, // 20MB
    },
    update_engagement: {
      maxLatency: 75,
      minThroughput: 20,
      maxMemory: 30 * 1024 * 1024, // 30MB
    },
    delete_engagement: {
      maxLatency: 50,
      minThroughput: 30,
      maxMemory: 10 * 1024 * 1024, // 10MB
    },
    list_engagements: {
      maxLatency: 200,
      minThroughput: 5,
      maxMemory: 100 * 1024 * 1024, // 100MB
    },

    // Project operations
    create_project: {
      maxLatency: 100,
      minThroughput: 10,
      maxMemory: 50 * 1024 * 1024,
    },
    read_project: {
      maxLatency: 50,
      minThroughput: 50,
      maxMemory: 20 * 1024 * 1024,
    },
    list_projects: {
      maxLatency: 200,
      minThroughput: 5,
      maxMemory: 100 * 1024 * 1024,
    },

    // Payment operations
    create_payment: {
      maxLatency: 100,
      minThroughput: 10,
      maxMemory: 50 * 1024 * 1024,
    },
    approve_payment: {
      maxLatency: 150,
      minThroughput: 8,
      maxMemory: 40 * 1024 * 1024,
    },

    // Batch operations
    batch_write: {
      maxLatency: 500,
      minThroughput: 100,
      maxMemory: 200 * 1024 * 1024, // 200MB
    },
    batch_read: {
      maxLatency: 300,
      minThroughput: 200,
      maxMemory: 150 * 1024 * 1024,
    },

    // Migration operations
    migration: {
      maxLatency: 1000,
      minThroughput: 50,
      maxMemory: 500 * 1024 * 1024, // 500MB
    },
    migration_validation: {
      maxLatency: 500,
      minThroughput: 100,
      maxMemory: 200 * 1024 * 1024,
    },
    migration_rollback: {
      maxLatency: 2000,
      minThroughput: 25,
      maxMemory: 300 * 1024 * 1024,
    },

    // Query operations
    filtered_query: {
      maxLatency: 150,
      minThroughput: 10,
      maxMemory: 80 * 1024 * 1024,
    },
    paginated_query: {
      maxLatency: 100,
      minThroughput: 15,
      maxMemory: 60 * 1024 * 1024,
    },
    aggregate_query: {
      maxLatency: 300,
      minThroughput: 5,
      maxMemory: 120 * 1024 * 1024,
    },

    // Concurrent operations
    concurrent_read: {
      maxLatency: 200,
      minThroughput: 25,
      maxMemory: 150 * 1024 * 1024,
    },
    concurrent_write: {
      maxLatency: 150,
      minThroughput: 15,
      maxMemory: 200 * 1024 * 1024,
    },
  },

  general: {
    pageLoadTime: 3000, // 3 seconds
    apiResponseTime: 500, // 500ms
    migrationThroughput: 100, // 100 records/second
  },
};

export interface PerformanceValidationResult {
  passed: boolean;
  violations: string[];
  metrics: {
    operation: string;
    latency: number;
    throughput: number;
    memoryUsage: number;
  };
}

/**
 * Validate performance against thresholds
 */
export function validatePerformance(
  operation: string,
  latency: number,
  throughput: number,
  memoryUsage: number
): PerformanceValidationResult {
  const thresholds = performanceThresholds.operations[operation];
  const violations: string[] = [];

  if (!thresholds) {
    return {
      passed: true,
      violations: [],
      metrics: { operation, latency, throughput, memoryUsage },
    };
  }

  if (latency > thresholds.maxLatency) {
    violations.push(
      `Latency ${latency.toFixed(2)}ms exceeds threshold ${thresholds.maxLatency}ms`
    );
  }

  if (throughput < thresholds.minThroughput) {
    violations.push(
      `Throughput ${throughput.toFixed(2)} ops/s below threshold ${thresholds.minThroughput} ops/s`
    );
  }

  if (memoryUsage > thresholds.maxMemory) {
    violations.push(
      `Memory usage ${(memoryUsage / 1024 / 1024).toFixed(2)}MB exceeds threshold ${(thresholds.maxMemory / 1024 / 1024).toFixed(2)}MB`
    );
  }

  return {
    passed: violations.length === 0,
    violations,
    metrics: { operation, latency, throughput, memoryUsage },
  };
}

/**
 * Get threshold for operation
 */
export function getThreshold(operation: string): OperationThreshold | null {
  return performanceThresholds.operations[operation] || null;
}

/**
 * Format performance result for display
 */
export function formatPerformanceResult(result: PerformanceValidationResult): string {
  const { metrics, passed, violations } = result;
  let output = `Operation: ${metrics.operation}\n`;
  output += `  Latency: ${metrics.latency.toFixed(2)}ms\n`;
  output += `  Throughput: ${metrics.throughput.toFixed(2)} ops/s\n`;
  output += `  Memory: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`;
  output += `  Status: ${passed ? '✓ PASSED' : '✗ FAILED'}\n`;

  if (violations.length > 0) {
    output += `  Violations:\n`;
    for (const violation of violations) {
      output += `    - ${violation}\n`;
    }
  }

  return output;
}

/**
 * Calculate performance score (0-100)
 */
export function calculatePerformanceScore(results: PerformanceValidationResult[]): number {
  if (results.length === 0) return 100;

  const passedCount = results.filter(r => r.passed).length;
  return (passedCount / results.length) * 100;
}
