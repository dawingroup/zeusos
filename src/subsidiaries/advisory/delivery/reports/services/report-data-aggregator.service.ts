/**
 * Report Data Aggregator Service
 * Fetches and formats data from various sources for report population
 */

import { Firestore } from 'firebase/firestore';
import { format } from 'date-fns';
import type {
  ReportDataContext,
  ProjectContext,
  ProgramContext,
  BudgetSummary,
  ProgressSummary,
  FacilityBrandingContext,
  ReportPeriod,
  PlaceholderConfig,
  PlaceholderFormatOptions,
  DataSourceConfig,
} from '../types';

// ============================================================================
// REPORT DATA AGGREGATOR SERVICE
// ============================================================================

export class ReportDataAggregatorService {
  private static instance: ReportDataAggregatorService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): ReportDataAggregatorService {
    if (!ReportDataAggregatorService.instance) {
      ReportDataAggregatorService.instance = new ReportDataAggregatorService(db);
    }
    return ReportDataAggregatorService.instance;
  }

  // ============================================================================
  // MAIN AGGREGATION METHOD
  // ============================================================================

  /**
   * Aggregate all data needed for a report
   */
  async aggregateReportData(
    orgId: string,
    projectId: string,
    reportPeriod: ReportPeriod,
    _dataSources: DataSourceConfig[],
    preparedByName: string,
    customData?: Record<string, unknown>
  ): Promise<ReportDataContext> {
    // Fetch project data
    const project = await this.getProjectContext(orgId, projectId);

    // Fetch program data if project has a program
    let program: ProgramContext | undefined;
    if (project.programId) {
      program = await this.getProgramContext(orgId, project.programId);
    }

    // Get budget summary from project
    const budget = await this.getBudgetSummary(orgId, projectId);

    // Get progress summary from project
    const progress = await this.getProgressSummary(orgId, projectId);

    // Get facility branding if available
    const facilityBranding = await this.getFacilityBranding(orgId, projectId);

    return {
      project,
      program,
      budget,
      progress,
      facilityBranding,
      reportPeriod,
      generatedAt: new Date(),
      preparedByName,
      customData,
    };
  }

  // ============================================================================
  // DATA FETCHING METHODS
  // ============================================================================

  /**
   * Get project context for report
   */
  async getProjectContext(
    orgId: string,
    projectId: string
  ): Promise<ProjectContext & { programId?: string }> {
    const { doc, getDoc } = await import('firebase/firestore');
    const projectRef = doc(
      this.db,
      `organizations/${orgId}/advisory_projects`,
      projectId
    );
    const snapshot = await getDoc(projectRef);

    if (!snapshot.exists()) {
      throw new Error(`Project ${projectId} not found`);
    }

    const data = snapshot.data();

    return {
      id: snapshot.id,
      name: data.name || '',
      projectCode: data.projectCode || '',
      status: this.formatStatus(data.status),
      description: data.description,
      location: {
        siteName: data.location?.siteName || '',
        address: data.location?.address,
        district: data.location?.district,
        region: data.location?.region,
        country: data.location?.country,
      },
      timeline: {
        startDate: data.timeline?.startDate?.toDate?.(),
        endDate: data.timeline?.endDate?.toDate?.(),
        actualStartDate: data.timeline?.actualStartDate?.toDate?.(),
        percentTimeElapsed: data.timeline?.percentTimeElapsed,
      },
      createdAt: data.createdAt?.toDate?.() || new Date(),
      programId: data.programId,
    };
  }

  /**
   * Get program context for report
   */
  async getProgramContext(
    orgId: string,
    programId: string
  ): Promise<ProgramContext> {
    const { doc, getDoc } = await import('firebase/firestore');
    const programRef = doc(
      this.db,
      `organizations/${orgId}/advisory_programs`,
      programId
    );
    const snapshot = await getDoc(programRef);

    if (!snapshot.exists()) {
      return {
        id: programId,
        name: '',
        code: '',
      };
    }

    const data = snapshot.data();

    return {
      id: snapshot.id,
      name: data.name || '',
      code: data.code || '',
      description: data.description,
      sectors: data.sectors,
    };
  }

  /**
   * Get budget summary for report
   */
  async getBudgetSummary(
    orgId: string,
    projectId: string
  ): Promise<BudgetSummary> {
    const { doc, getDoc } = await import('firebase/firestore');
    const projectRef = doc(
      this.db,
      `organizations/${orgId}/advisory_projects`,
      projectId
    );
    const snapshot = await getDoc(projectRef);

    if (!snapshot.exists()) {
      throw new Error(`Project ${projectId} not found`);
    }

    const data = snapshot.data();
    const budget = data.budget || {};

    const totalBudget = budget.totalBudget || 0;
    const spent = budget.spent || 0;
    const committed = budget.committed || 0;
    const remaining = totalBudget - spent - committed;
    const variance = budget.variance || 0;
    const variancePercentage =
      totalBudget > 0 ? (variance / totalBudget) * 100 : 0;

    return {
      currency: budget.currency || 'UGX',
      totalBudget,
      spent,
      committed,
      remaining,
      variance,
      variancePercentage,
      varianceStatus: budget.varianceStatus || 'on_track',
    };
  }

  /**
   * Get progress summary for report
   */
  async getProgressSummary(
    orgId: string,
    projectId: string
  ): Promise<ProgressSummary> {
    const { doc, getDoc } = await import('firebase/firestore');
    const projectRef = doc(
      this.db,
      `organizations/${orgId}/advisory_projects`,
      projectId
    );
    const snapshot = await getDoc(projectRef);

    if (!snapshot.exists()) {
      throw new Error(`Project ${projectId} not found`);
    }

    const data = snapshot.data();
    const progress = data.progress || {};
    const timeline = data.timeline || {};

    return {
      physicalProgress: progress.physicalProgress || 0,
      financialProgress: progress.financialProgress || 0,
      completionPercent: progress.completionPercent || 0,
      timeElapsedPercent: timeline.percentTimeElapsed || 0,
      scheduleVarianceDays: timeline.scheduleVarianceDays,
      scheduleStatus: this.determineScheduleStatus(
        progress.physicalProgress || 0,
        timeline.percentTimeElapsed || 0
      ),
    };
  }

  /**
   * Get facility branding for report headers
   */
  async getFacilityBranding(
    orgId: string,
    projectId: string
  ): Promise<FacilityBrandingContext | undefined> {
    const { doc, getDoc } = await import('firebase/firestore');
    const projectRef = doc(
      this.db,
      `organizations/${orgId}/advisory_projects`,
      projectId
    );
    const snapshot = await getDoc(projectRef);

    if (!snapshot.exists()) {
      return undefined;
    }

    const data = snapshot.data();
    const branding = data.facilityBranding;

    if (!branding) {
      return undefined;
    }

    return {
      facilityName: branding.facilityName || '',
      facilityCode: branding.facilityCode,
      address: branding.address,
      telephone: branding.telephone,
      email: branding.email,
      tagline: branding.tagline,
      clientLogoUrl: branding.clientLogoUrl,
      donorLogoUrl: branding.donorLogoUrl,
    };
  }

  // ============================================================================
  // VALUE FORMATTING
  // ============================================================================

  /**
   * Format a value based on placeholder configuration
   */
  formatValue(
    value: unknown,
    config: PlaceholderConfig
  ): string {
    if (value === null || value === undefined) {
      return config.defaultValue || '';
    }

    const format = config.format;
    const options = config.formatOptions || {};

    switch (format) {
      case 'currency':
        return this.formatCurrency(value as number, options);
      case 'percentage':
        return this.formatPercentage(value as number, options);
      case 'date':
        return this.formatDate(value as Date | string, options);
      case 'number':
        return this.formatNumber(value as number, options);
      case 'list':
        return this.formatList(value as string[]);
      case 'text':
      default:
        return String(value);
    }
  }

  /**
   * Format currency value
   */
  private formatCurrency(
    value: number,
    options: PlaceholderFormatOptions
  ): string {
    const currency = options.currency || 'UGX';
    const formatter = new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    return formatter.format(value);
  }

  /**
   * Format percentage value
   */
  private formatPercentage(
    value: number,
    options: PlaceholderFormatOptions
  ): string {
    const decimalPlaces = options.decimalPlaces ?? 1;
    return `${value.toFixed(decimalPlaces)}%`;
  }

  /**
   * Format date value
   */
  private formatDate(
    value: Date | string,
    options: PlaceholderFormatOptions
  ): string {
    const date = value instanceof Date ? value : new Date(value);
    const dateFormat = options.dateFormat || 'MMMM d, yyyy';
    return format(date, dateFormat);
  }

  /**
   * Format number value
   */
  private formatNumber(
    value: number,
    options: PlaceholderFormatOptions
  ): string {
    const prefix = options.prefix || '';
    const suffix = options.suffix || '';
    const decimalPlaces = options.decimalPlaces ?? 0;
    const formatted = value.toFixed(decimalPlaces);
    return `${prefix}${formatted}${suffix}`;
  }

  /**
   * Format list to comma-separated string
   */
  private formatList(value: string[]): string {
    if (!Array.isArray(value)) {
      return String(value);
    }
    return value.join(', ');
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Format project status for display
   */
  private formatStatus(status: string): string {
    const statusMap: Record<string, string> = {
      planning: 'Planning',
      procurement: 'Procurement',
      mobilization: 'Mobilization',
      active: 'Active',
      substantial_completion: 'Substantial Completion',
      defects_liability: 'Defects Liability',
      completed: 'Completed',
      suspended: 'Suspended',
      cancelled: 'Cancelled',
    };
    return statusMap[status] || status;
  }

  /**
   * Determine schedule status based on progress vs time elapsed
   */
  private determineScheduleStatus(
    physicalProgress: number,
    timeElapsed: number
  ): 'on_schedule' | 'ahead' | 'behind' {
    const difference = physicalProgress - timeElapsed;
    if (Math.abs(difference) < 5) {
      return 'on_schedule';
    }
    return difference > 0 ? 'ahead' : 'behind';
  }

  /**
   * Get value from nested object path
   */
  getValueFromPath(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Build replacement map from data context and placeholders
   */
  buildReplacementMap(
    dataContext: ReportDataContext,
    placeholders: PlaceholderConfig[]
  ): Map<string, string> {
    const replacements = new Map<string, string>();

    // Flatten data context for easier access
    const flatData: Record<string, unknown> = {
      project: dataContext.project,
      program: dataContext.program,
      budget: dataContext.budget,
      progress: dataContext.progress,
      facilityBranding: dataContext.facilityBranding,
      reportPeriod: dataContext.reportPeriod,
      generatedAt: dataContext.generatedAt,
      preparedByName: dataContext.preparedByName,
      customData: dataContext.customData,
    };

    for (const placeholder of placeholders) {
      const value = this.getValueFromPath(flatData, placeholder.fieldPath);
      const formattedValue = this.formatValue(value, placeholder);
      replacements.set(placeholder.placeholder, formattedValue);
    }

    return replacements;
  }
}

export default ReportDataAggregatorService;
