/**
 * Report Generation Module
 * Darwin Advisory Infrastructure Delivery
 *
 * This module provides report generation functionality using Google Docs:
 * - Generate editable Google Docs reports from templates
 * - Auto-populate project, budget, and progress data
 * - Save reports to project folders in Google Drive
 *
 * @example
 * ```tsx
 * import { ReportGeneratorPanel } from './reports';
 *
 * function ProjectReports() {
 *   return (
 *     <ReportGeneratorPanel
 *       orgId="default"
 *       projectId="project-123"
 *       userName="John Doe"
 *       showHistory={true}
 *     />
 *   );
 * }
 * ```
 */

// Types
export * from './types';

// Services
export * from './services';

// Templates
export * from './templates';

// Hooks
export * from './hooks';

// Components
export * from './components';
