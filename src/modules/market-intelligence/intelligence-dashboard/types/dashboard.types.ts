import { Timestamp } from 'firebase/firestore';
import {
  DataSource,
  InsightType,
  InsightPriority,
  InsightStatus,
  ReportType,
  ReportStatus,
  ReportSection,
  WidgetType,
  MetricType,
  VisualizationType,
  ActionItemType,
  ActionItemStatus,
  ScheduleFrequency,
} from '../constants/dashboard.constants';

export interface BaseEntity {
  id: string;
  organizationId: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface InsightEvidence {
  id: string;
  type: 'data_point' | 'trend' | 'event' | 'quote' | 'statistic' | 'document';
  source: DataSource;
  sourceEntityId?: string;
  title: string;
  description: string;
  value?: string | number;
  date?: Timestamp;
  url?: string;
  attachmentUrl?: string;
  credibility: 'high' | 'medium' | 'low';
}

export interface IntelligenceInsight extends BaseEntity {
  type: InsightType;
  priority: InsightPriority;
  status: InsightStatus;

  title: string;
  description: string;
  evidence: InsightEvidence[];
  implications: string[];
  recommendations: string[];

  dataSources: DataSource[];
  sourceEntityIds: string[];
  sourceEntityTypes: string[];

  confidence: number;
  relevanceScore: number;
  impactLevel: 'high' | 'medium' | 'low';
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';

  expiresAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  reviewNotes?: string;
  actedAt?: Timestamp;
  actedBy?: string;
  actionTaken?: string;
  dismissedAt?: Timestamp;
  dismissedBy?: string;
  dismissReason?: string;

  linkedReportIds: string[];
  linkedActionItemIds: string[];
  relatedInsightIds: string[];

  tags: string[];
  industries: string[];
  geographies: string[];
}

export interface InsightFilter {
  types?: InsightType[];
  priorities?: InsightPriority[];
  statuses?: InsightStatus[];
  dataSources?: DataSource[];
  impactLevels?: ('high' | 'medium' | 'low')[];
  timeframes?: ('immediate' | 'short_term' | 'medium_term' | 'long_term')[];
  tags?: string[];
  industries?: string[];
  dateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  searchQuery?: string;
}

export interface ReportSubsection {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface ReportVisualization {
  id: string;
  type: VisualizationType;
  title: string;
  dataSourceId: string;
  config: Record<string, unknown>;
  width: 'full' | 'half' | 'third';
}

export interface ReportDataPoint {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  changePercent?: number;
  source: DataSource;
}

export interface ReportSectionContent {
  id: string;
  section: ReportSection;
  order: number;
  title: string;
  content: string;
  visualizations: ReportVisualization[];
  dataPoints: ReportDataPoint[];
  subsections: ReportSubsection[];
  isIncluded: boolean;
}

export interface ReportApprover {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  reviewedAt?: Timestamp;
  comments?: string;
}

export interface ReportRecipient {
  userId?: string;
  email: string;
  name: string;
  role?: string;
  sendVia: ('email' | 'app' | 'slack')[];
}

export interface IntelligenceReport extends BaseEntity {
  title: string;
  type: ReportType;
  status: ReportStatus;
  description: string;

  sections: ReportSectionContent[];
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];

  dataSources: DataSource[];
  dateRange: {
    start: Timestamp;
    end: Timestamp;
  };

  includedInsightIds: string[];

  approvers: ReportApprover[];
  currentApproverIndex: number;

  recipients: ReportRecipient[];
  sentAt?: Timestamp;
  sentBy?: string;

  version: number;
  previousVersionId?: string;

  scheduleId?: string;
  scheduledFor?: Timestamp;

  pageCount?: number;
  wordCount?: number;
  generatedAt?: Timestamp;
  pdfUrl?: string;
  docxUrl?: string;

  tags: string[];
}

export interface ReportFilter {
  types?: ReportType[];
  statuses?: ReportStatus[];
  createdByIds?: string[];
  dateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  tags?: string[];
  searchQuery?: string;
}

export interface ReportSchedule extends BaseEntity {
  name: string;
  description: string;
  reportType: ReportType;
  templateId?: string;

  frequency: ScheduleFrequency;
  customCron?: string;
  timezone: string;
  nextRunAt: Timestamp;
  lastRunAt?: Timestamp;

  dataSources: DataSource[];
  sections: ReportSection[];
  dateRangeType: 'last_period' | 'custom' | 'ytd' | 'mtd';
  customDateRange?: {
    start: Timestamp;
    end: Timestamp;
  };

  autoDistribute: boolean;
  recipients: ReportRecipient[];
  approvers: ReportApprover[];

  isActive: boolean;
  failureCount: number;
  lastError?: string;
}

export interface IntelligenceActionItem extends BaseEntity {
  title: string;
  description: string;
  type: ActionItemType;
  status: ActionItemStatus;
  priority: InsightPriority;

  assigneeId: string;
  assigneeName: string;
  assigneeEmail: string;

  dueDate: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;

  sourceInsightId?: string;
  sourceReportId?: string;

  progress: number;
  blockers?: string[];
  notes?: string;

  outcome?: string;
  impactAssessment?: string;
  lessonsLearned?: string;

  tags: string[];
}

export interface ActionItemFilter {
  types?: ActionItemType[];
  statuses?: ActionItemStatus[];
  priorities?: InsightPriority[];
  assigneeIds?: string[];
  dueDateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  overdue?: boolean;
  searchQuery?: string;
}

export interface WidgetConfig {
  dataSources?: DataSource[];
  dateRange?: {
    type: 'last_7_days' | 'last_30_days' | 'last_90_days' | 'custom' | 'ytd';
    start?: Timestamp;
    end?: Timestamp;
  };

  metrics?: MetricType[];
  groupBy?: string;
  visualizationType?: VisualizationType;

  showLegend?: boolean;
  showLabels?: boolean;
  showTrends?: boolean;

  threshold?: {
    warning: number;
    critical: number;
  };

  customSettings?: Record<string, unknown>;
}

export interface DashboardWidget {
  id: string;
  type: WidgetType;
  title: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: WidgetConfig;
  refreshInterval: number;
  lastRefreshedAt?: Timestamp;
  isLoading: boolean;
  error?: string;
}

export interface DashboardConfiguration extends BaseEntity {
  name: string;
  description: string;
  isDefault: boolean;

  columns: number;
  rowHeight: number;

  widgets: DashboardWidget[];

  ownerId: string;
  sharedWith: string[];
  isPublic: boolean;

  theme: 'light' | 'dark' | 'system';
  colorScheme?: string;
}

export interface DataSourceStatus {
  source: DataSource;
  lastUpdated: Timestamp;
  recordCount: number;
  status: 'healthy' | 'stale' | 'error' | 'unknown';
  refreshInProgress: boolean;
  nextScheduledRefresh?: Timestamp;
  lastError?: string;
}

export interface MetricSnapshot {
  metricType: MetricType;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  isPositive: boolean;
}

export interface ExecutiveHeadline {
  title: string;
  type: InsightType;
  priority: InsightPriority;
  summary: string;
  insightId: string;
}

export interface UpcomingDeadline {
  title: string;
  type: 'action_item' | 'report' | 'schedule' | 'regulatory';
  dueDate: Timestamp;
  entityId: string;
}

export interface ActiveAlert {
  title: string;
  priority: InsightPriority;
  source: DataSource;
  entityId: string;
}

export interface ExecutiveSummaryData {
  generatedAt: Timestamp;
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  headlines: ExecutiveHeadline[];
  keyMetrics: MetricSnapshot[];
  topInsights: IntelligenceInsight[];
  upcomingDeadlines: UpcomingDeadline[];
  activeAlerts: ActiveAlert[];
  dataStatus: DataSourceStatus[];
}

export interface CrossModuleCorrelation {
  id: string;
  metricA: MetricType;
  metricB: MetricType;
  correlation: number;
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  significance: number;
  description: string;
  insights: string[];
}

export interface IntelligenceAnalytics extends BaseEntity {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  periodStart: Timestamp;
  periodEnd: Timestamp;
  generatedAt: Timestamp;

  keyMetrics: MetricSnapshot[];
  insightsByType: Record<string, number>;
  insightsByPriority: Record<string, number>;

  actionItemsSummary: {
    total: number;
    overdue: number;
    byStatus: Record<string, number>;
  };

  reportSummary: {
    total: number;
    byStatus: Record<string, number>;
    publishedThisPeriod: number;
  };

  correlations?: CrossModuleCorrelation[];
}
