/**
 * UAT Executor
 * Manages UAT test case execution and reporting
 */

import { uatTestCases, getUATTestCaseById } from './uat-test-cases';

export interface UATExecution {
  id: string;
  testCaseId: string;
  executedBy: string;
  executedAt: Date;
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'blocked';
  environment: 'staging' | 'production';
  stepResults: UATStepResult[];
  notes: string;
  attachments: string[];
  duration: number;
}

export interface UATStepResult {
  stepNumber: number;
  status: 'passed' | 'failed' | 'skipped' | 'blocked';
  actualOutcome: string;
  notes?: string;
  screenshot?: string;
  executedAt: Date;
}

export interface UATReport {
  executionDate: Date;
  environment: string;
  totalTestCases: number;
  passed: number;
  failed: number;
  blocked: number;
  pending: number;
  passRate: number;
  criticalIssues: UATIssue[];
  recommendations: string[];
  executions: UATExecution[];
}

export interface UATIssue {
  testCaseId: string;
  title: string;
  severity: 'critical' | 'major' | 'minor';
  description: string;
  stepsToReproduce: string[];
  expectedBehavior: string;
  actualBehavior: string;
  workaround?: string;
}

export class UATExecutor {
  private executions: UATExecution[] = [];

  /**
   * Start a new test execution
   */
  async startExecution(
    testCaseId: string,
    userId: string,
    environment: 'staging' | 'production'
  ): Promise<UATExecution> {
    const testCase = getUATTestCaseById(testCaseId);
    if (!testCase) {
      throw new Error(`Test case ${testCaseId} not found`);
    }

    const execution: UATExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      testCaseId,
      executedBy: userId,
      executedAt: new Date(),
      status: 'in_progress',
      environment,
      stepResults: [],
      notes: '',
      attachments: [],
      duration: 0,
    };

    this.executions.push(execution);
    return execution;
  }

  /**
   * Record step result
   */
  async recordStepResult(
    executionId: string,
    stepResult: UATStepResult
  ): Promise<void> {
    const execution = this.executions.find(e => e.id === executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    execution.stepResults.push(stepResult);

    // Update execution status if step failed or blocked
    if (stepResult.status === 'failed') {
      execution.status = 'failed';
    } else if (stepResult.status === 'blocked' && execution.status !== 'failed') {
      execution.status = 'blocked';
    }
  }

  /**
   * Complete test execution
   */
  async completeExecution(
    executionId: string,
    notes: string = ''
  ): Promise<UATExecution> {
    const execution = this.executions.find(e => e.id === executionId);
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const testCase = getUATTestCaseById(execution.testCaseId);
    if (!testCase) {
      throw new Error(`Test case ${execution.testCaseId} not found`);
    }

    // Determine final status
    if (execution.status !== 'failed' && execution.status !== 'blocked') {
      const allStepsPassed = execution.stepResults.every(
        sr => sr.status === 'passed' || sr.status === 'skipped'
      );
      execution.status = allStepsPassed ? 'passed' : 'failed';
    }

    execution.notes = notes;
    execution.duration = Date.now() - execution.executedAt.getTime();

    return execution;
  }

  /**
   * Add attachment to execution
   */
  addAttachment(executionId: string, attachmentUrl: string): void {
    const execution = this.executions.find(e => e.id === executionId);
    if (execution) {
      execution.attachments.push(attachmentUrl);
    }
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): UATExecution | undefined {
    return this.executions.find(e => e.id === executionId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): UATExecution[] {
    return [...this.executions];
  }

  /**
   * Get executions by status
   */
  getExecutionsByStatus(status: UATExecution['status']): UATExecution[] {
    return this.executions.filter(e => e.status === status);
  }

  /**
   * Generate UAT report
   */
  generateReport(): UATReport {
    const passed = this.executions.filter(e => e.status === 'passed').length;
    const failed = this.executions.filter(e => e.status === 'failed').length;
    const blocked = this.executions.filter(e => e.status === 'blocked').length;
    const pending = this.executions.filter(e => e.status === 'pending' || e.status === 'in_progress').length;

    const criticalIssues: UATIssue[] = this.executions
      .filter(e => e.status === 'failed')
      .map(e => {
        const testCase = getUATTestCaseById(e.testCaseId);
        const failedStep = e.stepResults.find(sr => sr.status === 'failed');

        return {
          testCaseId: e.testCaseId,
          title: testCase?.title || 'Unknown Test',
          severity: testCase?.priority === 'critical' ? 'critical' as const : 'major' as const,
          description: failedStep?.notes || 'Test case failed',
          stepsToReproduce: testCase?.steps.map(s => s.action) || [],
          expectedBehavior: failedStep
            ? testCase?.steps.find(s => s.stepNumber === failedStep.stepNumber)?.expectedOutcome || ''
            : '',
          actualBehavior: failedStep?.actualOutcome || '',
        };
      });

    const recommendations = this.generateRecommendations(passed, failed, blocked, pending);

    const passRate = this.executions.length > 0
      ? (passed / this.executions.length) * 100
      : 0;

    return {
      executionDate: new Date(),
      environment: this.executions[0]?.environment || 'staging',
      totalTestCases: this.executions.length,
      passed,
      failed,
      blocked,
      pending,
      passRate,
      criticalIssues,
      recommendations,
      executions: [...this.executions],
    };
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(
    passed: number,
    failed: number,
    blocked: number,
    pending: number
  ): string[] {
    const recommendations: string[] = [];
    const total = passed + failed + blocked + pending;

    if (failed > 0) {
      recommendations.push(`Address ${failed} failed test case(s) before production deployment`);
    }

    if (blocked > 0) {
      recommendations.push(`Unblock ${blocked} test case(s) by resolving dependencies`);
    }

    if (pending > 0) {
      recommendations.push(`Complete ${pending} pending test case(s)`);
    }

    const passRate = total > 0 ? (passed / total) * 100 : 0;

    if (passRate < 80) {
      recommendations.push('Pass rate below 80%, recommend additional testing and bug fixes');
    } else if (passRate < 90) {
      recommendations.push('Pass rate below 90%, recommend reviewing failed tests before deployment');
    } else if (passRate >= 95) {
      recommendations.push('Pass rate above 95%, system ready for production deployment');
    }

    // Check for critical failures
    const criticalFailures = this.executions.filter(e => {
      const tc = getUATTestCaseById(e.testCaseId);
      return e.status === 'failed' && tc?.priority === 'critical';
    });

    if (criticalFailures.length > 0) {
      recommendations.unshift(`CRITICAL: ${criticalFailures.length} critical test(s) failed - deployment blocked`);
    }

    return recommendations;
  }

  /**
   * Export report as Markdown
   */
  exportReportAsMarkdown(): string {
    const report = this.generateReport();

    let markdown = `# UAT Execution Report\n\n`;
    markdown += `**Date:** ${report.executionDate.toISOString()}\n`;
    markdown += `**Environment:** ${report.environment}\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|--------|-------|\n`;
    markdown += `| Total Test Cases | ${report.totalTestCases} |\n`;
    markdown += `| Passed | ${report.passed} |\n`;
    markdown += `| Failed | ${report.failed} |\n`;
    markdown += `| Blocked | ${report.blocked} |\n`;
    markdown += `| Pending | ${report.pending} |\n`;
    markdown += `| Pass Rate | ${report.passRate.toFixed(1)}% |\n\n`;

    if (report.criticalIssues.length > 0) {
      markdown += `## Critical Issues\n\n`;
      for (const issue of report.criticalIssues) {
        markdown += `### ${issue.testCaseId}: ${issue.title}\n\n`;
        markdown += `**Severity:** ${issue.severity}\n\n`;
        markdown += `**Description:** ${issue.description}\n\n`;
        markdown += `**Expected:** ${issue.expectedBehavior}\n\n`;
        markdown += `**Actual:** ${issue.actualBehavior}\n\n`;
        if (issue.workaround) {
          markdown += `**Workaround:** ${issue.workaround}\n\n`;
        }
        markdown += `---\n\n`;
      }
    }

    markdown += `## Recommendations\n\n`;
    for (const rec of report.recommendations) {
      markdown += `- ${rec}\n`;
    }

    markdown += `\n## Detailed Results\n\n`;
    for (const exec of report.executions) {
      const tc = getUATTestCaseById(exec.testCaseId);
      markdown += `### ${exec.testCaseId}: ${tc?.title || 'Unknown'}\n\n`;
      markdown += `- **Status:** ${exec.status}\n`;
      markdown += `- **Duration:** ${exec.duration}ms\n`;
      markdown += `- **Executed By:** ${exec.executedBy}\n`;
      markdown += `- **Steps Completed:** ${exec.stepResults.length}/${tc?.steps.length || 0}\n\n`;

      if (exec.notes) {
        markdown += `**Notes:** ${exec.notes}\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Export report as JSON
   */
  exportReportAsJSON(): string {
    const report = this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  /**
   * Clear all executions
   */
  clearExecutions(): void {
    this.executions = [];
  }

  /**
   * Run automated test case (placeholder for integration with test runners)
   */
  async runAutomatedTest(
    testCaseId: string,
    userId: string,
    environment: 'staging' | 'production'
  ): Promise<UATExecution> {
    const testCase = getUATTestCaseById(testCaseId);
    if (!testCase) {
      throw new Error(`Test case ${testCaseId} not found`);
    }

    if (!testCase.automatable) {
      throw new Error(`Test case ${testCaseId} is not automatable`);
    }

    const execution = await this.startExecution(testCaseId, userId, environment);

    // Simulate automated test execution
    for (const step of testCase.steps) {
      const stepResult: UATStepResult = {
        stepNumber: step.stepNumber,
        status: 'passed', // In real implementation, this would be determined by actual test
        actualOutcome: step.expectedOutcome,
        executedAt: new Date(),
      };

      await this.recordStepResult(execution.id, stepResult);
    }

    return this.completeExecution(execution.id, 'Automated test execution');
  }

  /**
   * Get coverage summary
   */
  getCoverageSummary(): {
    totalCases: number;
    executedCases: number;
    coveragePercent: number;
    byCategory: Record<string, { total: number; executed: number }>;
  } {
    const executedIds = new Set(this.executions.map(e => e.testCaseId));
    const byCategory: Record<string, { total: number; executed: number }> = {};

    for (const tc of uatTestCases) {
      if (!byCategory[tc.category]) {
        byCategory[tc.category] = { total: 0, executed: 0 };
      }
      byCategory[tc.category].total++;
      if (executedIds.has(tc.id)) {
        byCategory[tc.category].executed++;
      }
    }

    return {
      totalCases: uatTestCases.length,
      executedCases: executedIds.size,
      coveragePercent: (executedIds.size / uatTestCases.length) * 100,
      byCategory,
    };
  }
}

/**
 * Create UAT executor instance
 */
export function createUATExecutor(): UATExecutor {
  return new UATExecutor();
}
