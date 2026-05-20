/**
 * Report Generation Service
 * Main orchestrator for generating reports using Google Docs
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  Firestore,
  QueryConstraint,
} from 'firebase/firestore';
import { format } from 'date-fns';
import type {
  ReportGenerationRequest,
  ReportGenerationResult,
  GeneratedReport,
  ReportTemplate,
  ReportPeriod,
  ReportHistoryOptions,
  ReportStatus,
} from '../types';
import { GoogleDocsService } from './google-docs.service';
import { TemplateManagerService } from './template-manager.service';
import { ReportDataAggregatorService } from './report-data-aggregator.service';

// ============================================================================
// COLLECTION PATHS
// ============================================================================

const getReportsPath = (orgId: string) =>
  `organizations/${orgId}/generated_reports`;

// ============================================================================
// REPORT GENERATION SERVICE
// ============================================================================

export class ReportGenerationService {
  private static instance: ReportGenerationService;
  private db: Firestore;
  private docsService: GoogleDocsService;
  private templateManager: TemplateManagerService;
  private dataAggregator: ReportDataAggregatorService;

  private constructor(
    db: Firestore,
    docsService: GoogleDocsService,
    templateManager: TemplateManagerService,
    dataAggregator: ReportDataAggregatorService
  ) {
    this.db = db;
    this.docsService = docsService;
    this.templateManager = templateManager;
    this.dataAggregator = dataAggregator;
  }

  static getInstance(
    db: Firestore,
    docsService: GoogleDocsService,
    templateManager: TemplateManagerService,
    dataAggregator: ReportDataAggregatorService
  ): ReportGenerationService {
    if (!ReportGenerationService.instance) {
      ReportGenerationService.instance = new ReportGenerationService(
        db,
        docsService,
        templateManager,
        dataAggregator
      );
    }
    return ReportGenerationService.instance;
  }

  // ============================================================================
  // REPORT GENERATION
  // ============================================================================

  /**
   * Generate a report from template
   */
  async generateReport(
    orgId: string,
    request: ReportGenerationRequest,
    accessToken: string,
    userId: string,
    userName: string
  ): Promise<ReportGenerationResult> {
    let reportId: string | undefined;

    try {
      // Initialize Google Docs service
      this.docsService.initialize(accessToken);

      // 1. Load template configuration
      const template = await this.templateManager.getTemplate(
        orgId,
        request.templateId
      );
      if (!template) {
        throw new Error(`Template ${request.templateId} not found`);
      }

      // 2. Create initial report record (status: generating)
      reportId = await this.createReportRecord(
        orgId,
        template,
        request,
        userId,
        userName
      );

      // 3. Aggregate data from all sources
      const dataContext = await this.dataAggregator.aggregateReportData(
        orgId,
        request.projectId,
        request.reportPeriod,
        template.dataSources,
        userName,
        request.customData
      );

      // 4. Build replacement map
      const replacements = this.dataAggregator.buildReplacementMap(
        dataContext,
        template.placeholders
      );

      // 5. Generate document title
      const docTitle = this.formatDocumentTitle(template, dataContext);

      // 6. Determine target folder
      let targetFolderId = request.folderId;
      if (!targetFolderId && request.saveToFolder !== false) {
        // Build folder path from template configuration
        targetFolderId = await this.ensureReportFolder(
          template,
          dataContext,
          accessToken
        );
      }

      // 7. Copy template document
      const { docId, docUrl } = await this.docsService.copyTemplate(
        template.googleDocTemplateId,
        docTitle,
        targetFolderId
      );

      // 8. Replace placeholders
      await this.docsService.replacePlaceholdersMap(docId, replacements);

      // 9. Update report record with success
      await this.updateReportRecord(orgId, reportId, {
        googleDocId: docId,
        googleDocUrl: docUrl,
        googleDriveFolderId: targetFolderId || '',
        status: 'draft',
        projectCode: dataContext.project.projectCode,
        projectName: dataContext.project.name,
        programId: dataContext.program?.id,
        programName: dataContext.program?.name,
      });

      return {
        success: true,
        reportId,
        googleDocId: docId,
        googleDocUrl: docUrl,
      };
    } catch (error) {
      // Update report record with error if it was created
      if (reportId) {
        await this.updateReportRecord(orgId, reportId, {
          status: 'error',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }

      return {
        success: false,
        reportId,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // ============================================================================
  // REPORT RECORDS MANAGEMENT
  // ============================================================================

  /**
   * Create initial report record
   */
  private async createReportRecord(
    orgId: string,
    template: ReportTemplate,
    request: ReportGenerationRequest,
    userId: string,
    userName: string
  ): Promise<string> {
    const reportsRef = collection(this.db, getReportsPath(orgId));

    const reportData: Omit<GeneratedReport, 'id'> = {
      templateId: template.id,
      templateName: template.name,
      reportType: template.type,
      projectId: request.projectId,
      projectCode: '', // Will be updated after data fetch
      projectName: '', // Will be updated after data fetch
      googleDocId: '',
      googleDocUrl: '',
      googleDriveFolderId: '',
      reportPeriod: request.reportPeriod,
      status: 'generating',
      generatedAt: Timestamp.now(),
      generatedBy: userId,
      generatedByName: userName,
    };

    const docRef = await addDoc(reportsRef, reportData);
    return docRef.id;
  }

  /**
   * Update report record
   */
  private async updateReportRecord(
    orgId: string,
    reportId: string,
    updates: Partial<GeneratedReport>
  ): Promise<void> {
    const reportRef = doc(this.db, getReportsPath(orgId), reportId);
    await updateDoc(reportRef, {
      ...updates,
      lastModifiedAt: serverTimestamp(),
    });
  }

  /**
   * Get a report by ID
   */
  async getReport(
    orgId: string,
    reportId: string
  ): Promise<GeneratedReport | null> {
    const reportRef = doc(this.db, getReportsPath(orgId), reportId);
    const snapshot = await getDoc(reportRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as GeneratedReport;
  }

  /**
   * Get report history for a project
   */
  async getReportHistory(
    orgId: string,
    projectId: string,
    options: ReportHistoryOptions = {}
  ): Promise<GeneratedReport[]> {
    const reportsRef = collection(this.db, getReportsPath(orgId));

    const constraints: QueryConstraint[] = [where('projectId', '==', projectId)];

    if (options.reportType) {
      constraints.push(where('reportType', '==', options.reportType));
    }

    if (options.status) {
      constraints.push(where('status', '==', options.status));
    }

    constraints.push(orderBy('generatedAt', 'desc'));

    if (options.limit) {
      constraints.push(limit(options.limit));
    }

    const q = query(reportsRef, ...constraints);
    const snapshot = await getDocs(q);

    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as GeneratedReport
    );
  }

  /**
   * Update report status
   */
  async updateReportStatus(
    orgId: string,
    reportId: string,
    status: ReportStatus
  ): Promise<void> {
    const reportRef = doc(this.db, getReportsPath(orgId), reportId);
    await updateDoc(reportRef, {
      status,
      lastModifiedAt: serverTimestamp(),
    });
  }

  /**
   * Delete a report record
   */
  async deleteReport(
    orgId: string,
    reportId: string,
    deleteGoogleDoc: boolean = false,
    accessToken?: string
  ): Promise<void> {
    // Get report to find Google Doc ID
    if (deleteGoogleDoc && accessToken) {
      const report = await this.getReport(orgId, reportId);
      if (report?.googleDocId) {
        this.docsService.initialize(accessToken);
        try {
          await this.docsService.deleteDocument(report.googleDocId);
        } catch (error) {
          console.error('Failed to delete Google Doc:', error);
          // Continue with Firestore deletion even if Drive deletion fails
        }
      }
    }

    // Delete Firestore record
    const reportRef = doc(this.db, getReportsPath(orgId), reportId);
    await deleteDoc(reportRef);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Format document title from template pattern
   */
  private formatDocumentTitle(
    template: ReportTemplate,
    dataContext: {
      project: { projectCode: string };
      reportPeriod: ReportPeriod;
    }
  ): string {
    let title = template.fileNamingPattern;

    // Replace placeholders in title
    title = title.replace('{ProjectCode}', dataContext.project.projectCode);
    title = title.replace('{Period}', dataContext.reportPeriod.periodLabel);
    title = title.replace('{Year}', String(dataContext.reportPeriod.year));
    title = title.replace(
      '{Quarter}',
      dataContext.reportPeriod.quarter
        ? `Q${dataContext.reportPeriod.quarter}`
        : ''
    );
    title = title.replace('{Date}', format(new Date(), 'yyyy-MM-dd'));

    // Handle activity name for activity completion reports
    if (title.includes('{ActivityName}')) {
      const customData = (dataContext as { customData?: Record<string, unknown> }).customData;
      const activityName = customData?.activityName || 'Activity';
      title = title.replace('{ActivityName}', String(activityName));
    }

    return title;
  }

  /**
   * Ensure report folder exists in Google Drive
   */
  private async ensureReportFolder(
    template: ReportTemplate,
    dataContext: {
      project: { projectCode: string; driveFolderId?: string };
      reportPeriod: ReportPeriod;
    },
    _accessToken: string
  ): Promise<string | undefined> {
    // Parse folder path template
    let folderPath = template.folderPath;
    folderPath = folderPath.replace('{Year}', String(dataContext.reportPeriod.year));
    folderPath = folderPath.replace(
      '{ReportType}',
      this.formatReportTypeForFolder(template.type)
    );
    folderPath = folderPath.replace(
      '{ProjectCode}',
      dataContext.project.projectCode
    );

    // Split path into parts
    const pathParts = folderPath.split('/').filter((p) => p.trim());

    // Use the project's root Drive folder to create sub-folders
    const projectDriveFolderId = dataContext.project.driveFolderId;
    if (!projectDriveFolderId) {
      console.warn('Project has no Drive folder ID, reports will be saved to root');
      return undefined;
    }

    // Return the resolved folder path for Drive integration
    return pathParts.join('/');
  }

  /**
   * Format report type for folder name
   */
  private formatReportTypeForFolder(type: string): string {
    const typeMap: Record<string, string> = {
      monthly_progress: 'Monthly Progress',
      quarterly_progress: 'Quarterly Progress',
      steering_committee: 'Steering Committee',
      activity_completion: 'Activity Completion',
      variance_report: 'Variance Reports',
      reconciliation_report: 'Reconciliation',
      custom: 'Custom',
    };
    return typeMap[type] || type;
  }
}

export default ReportGenerationService;
