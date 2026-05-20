import { Timestamp } from 'firebase/firestore';
import { z } from 'zod';
import {
  DATA_SOURCES,
  type DataSource,
  INSIGHT_TYPES,
  type InsightType,
  INSIGHT_PRIORITIES,
  type InsightPriority,
  INSIGHT_STATUSES,
  type InsightStatus,
  REPORT_TYPES,
  type ReportType,
  REPORT_STATUSES,
  type ReportStatus,
  REPORT_SECTIONS,
  type ReportSection,
  WIDGET_TYPES,
  type WidgetType,
  METRIC_TYPES,
  type MetricType,
  VISUALIZATION_TYPES,
  type VisualizationType,
  ACTION_ITEM_TYPES,
  type ActionItemType,
  ACTION_ITEM_STATUSES,
  type ActionItemStatus,
  SCHEDULE_FREQUENCIES,
  type ScheduleFrequency,
} from '../constants/dashboard.constants';

const generateId = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

const timestampSchema = z.preprocess((val) => {
  if (val instanceof Timestamp) return val;
  if (val instanceof Date) return Timestamp.fromDate(val);
  if (val && typeof val === 'object' && 'seconds' in (val as object) && 'nanoseconds' in (val as object)) {
    const v = val as { seconds: number; nanoseconds: number };
    return new Timestamp(v.seconds, v.nanoseconds);
  }
  return val;
}, z.instanceof(Timestamp));

const dataSourceEnum = z.enum(Object.values(DATA_SOURCES) as [DataSource, ...DataSource[]]);
const insightTypeEnum = z.enum(Object.values(INSIGHT_TYPES) as [InsightType, ...InsightType[]]);
const insightPriorityEnum = z.enum(Object.values(INSIGHT_PRIORITIES) as [InsightPriority, ...InsightPriority[]]);
const insightStatusEnum = z.enum(Object.values(INSIGHT_STATUSES) as [InsightStatus, ...InsightStatus[]]);
const reportTypeEnum = z.enum(Object.values(REPORT_TYPES) as [ReportType, ...ReportType[]]);
const reportStatusEnum = z.enum(Object.values(REPORT_STATUSES) as [ReportStatus, ...ReportStatus[]]);
const reportSectionEnum = z.enum(Object.values(REPORT_SECTIONS) as [ReportSection, ...ReportSection[]]);
const widgetTypeEnum = z.enum(Object.values(WIDGET_TYPES) as [WidgetType, ...WidgetType[]]);
const metricTypeEnum = z.enum(Object.values(METRIC_TYPES) as [MetricType, ...MetricType[]]);
const visualizationTypeEnum = z.enum(Object.values(VISUALIZATION_TYPES) as [VisualizationType, ...VisualizationType[]]);
const actionItemTypeEnum = z.enum(Object.values(ACTION_ITEM_TYPES) as [ActionItemType, ...ActionItemType[]]);
const actionItemStatusEnum = z.enum(Object.values(ACTION_ITEM_STATUSES) as [ActionItemStatus, ...ActionItemStatus[]]);
const scheduleFrequencyEnum = z.enum(Object.values(SCHEDULE_FREQUENCIES) as [ScheduleFrequency, ...ScheduleFrequency[]]);

export const insightEvidenceSchema = z.object({
  id: z.string().min(1).optional().default(() => generateId()),
  type: z.enum(['data_point', 'trend', 'event', 'quote', 'statistic', 'document']),
  source: dataSourceEnum,
  sourceEntityId: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  value: z.union([z.string(), z.number()]).optional(),
  date: timestampSchema.optional(),
  url: z.string().url().optional().or(z.literal('')),
  attachmentUrl: z.string().url().optional().or(z.literal('')),
  credibility: z.enum(['high', 'medium', 'low']),
});

export const insightCreateSchema = z.object({
  type: insightTypeEnum,
  priority: insightPriorityEnum,

  title: z.string().min(3).max(200),
  description: z.string().min(10).max(5000),
  evidence: z.array(insightEvidenceSchema).default([]),
  implications: z.array(z.string().min(1).max(500)).default([]),
  recommendations: z.array(z.string().min(1).max(500)).default([]),

  dataSources: z.array(dataSourceEnum).min(1),
  sourceEntityIds: z.array(z.string()).default([]),
  sourceEntityTypes: z.array(z.string()).default([]),

  confidence: z.number().min(0).max(100).default(50),
  relevanceScore: z.number().min(0).max(100).default(50),
  impactLevel: z.enum(['high', 'medium', 'low']).default('medium'),
  timeframe: z.enum(['immediate', 'short_term', 'medium_term', 'long_term']).default('short_term'),

  expiresAt: timestampSchema.optional(),

  linkedReportIds: z.array(z.string()).default([]),
  linkedActionItemIds: z.array(z.string()).default([]),
  relatedInsightIds: z.array(z.string()).default([]),

  tags: z.array(z.string().min(1).max(50)).default([]),
  industries: z.array(z.string().min(1).max(100)).default([]),
  geographies: z.array(z.string().min(1).max(100)).default([]),
});

export const insightUpdateSchema = insightCreateSchema.partial();

export const insightStatusTransitionSchema = z.object({
  newStatus: insightStatusEnum,
  notes: z.string().max(2000).optional(),
  actionTaken: z.string().max(2000).optional(),
  dismissReason: z.string().max(2000).optional(),
});

export const reportRecipientSchema = z.object({
  userId: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  sendVia: z.array(z.enum(['email', 'app', 'slack'])).min(1),
});

export const reportApproverSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().min(1).max(200),
  userEmail: z.string().email(),
  role: z.string().min(1).max(200),
  status: z.enum(['pending', 'approved', 'rejected', 'skipped']).default('pending'),
  reviewedAt: timestampSchema.optional(),
  comments: z.string().max(2000).optional(),
});

export const reportVisualizationSchema = z.object({
  id: z.string().min(1).optional().default(() => generateId()),
  type: visualizationTypeEnum,
  title: z.string().min(1).max(200),
  dataSourceId: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
  width: z.enum(['full', 'half', 'third']).default('full'),
});

export const reportDataPointSchema = z.object({
  id: z.string().min(1).optional().default(() => generateId()),
  label: z.string().min(1).max(200),
  value: z.union([z.string(), z.number()]),
  unit: z.string().max(20).optional(),
  trend: z.enum(['up', 'down', 'stable']).optional(),
  changePercent: z.number().optional(),
  source: dataSourceEnum,
});

export const reportSubsectionSchema = z.object({
  id: z.string().min(1).optional().default(() => generateId()),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  order: z.number().int().min(0),
});

export const reportSectionContentSchema = z.object({
  id: z.string().min(1).optional().default(() => generateId()),
  section: reportSectionEnum,
  order: z.number().int().min(0),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  visualizations: z.array(reportVisualizationSchema).default([]),
  dataPoints: z.array(reportDataPointSchema).default([]),
  subsections: z.array(reportSubsectionSchema).default([]),
  isIncluded: z.boolean().default(true),
});

export const reportCreateSchema = z.object({
  title: z.string().min(3).max(200),
  type: reportTypeEnum,
  description: z.string().min(0).max(2000).default(''),

  sections: z.array(reportSectionContentSchema).min(1),
  executiveSummary: z.string().min(0).max(10000).default(''),
  keyFindings: z.array(z.string().min(1).max(500)).default([]),
  recommendations: z.array(z.string().min(1).max(500)).default([]),

  dataSources: z.array(dataSourceEnum).default([]),
  dateRange: z.object({
    start: timestampSchema,
    end: timestampSchema,
  }),

  includedInsightIds: z.array(z.string()).default([]),

  approvers: z.array(reportApproverSchema).default([]),
  recipients: z.array(reportRecipientSchema).default([]),

  tags: z.array(z.string().min(1).max(50)).default([]),
});

export const reportUpdateSchema = reportCreateSchema.partial();

export const reportScheduleCreateSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(2000).default(''),
  reportType: reportTypeEnum,
  templateId: z.string().optional(),

  frequency: scheduleFrequencyEnum,
  customCron: z.string().max(200).optional(),
  timezone: z.string().min(1).max(100).default('Africa/Kampala'),

  dataSources: z.array(dataSourceEnum).default([]),
  sections: z.array(reportSectionEnum).default([]),
  dateRangeType: z.enum(['last_period', 'custom', 'ytd', 'mtd']).default('last_period'),
  customDateRange: z
    .object({ start: timestampSchema, end: timestampSchema })
    .optional(),

  autoDistribute: z.boolean().default(false),
  recipients: z.array(reportRecipientSchema).default([]),
  approvers: z.array(reportApproverSchema).default([]),

  isActive: z.boolean().default(true),
});

export const reportScheduleUpdateSchema = reportScheduleCreateSchema.partial();

export const actionItemCreateSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().min(0).max(2000).default(''),
  type: actionItemTypeEnum,
  priority: insightPriorityEnum,

  assigneeId: z.string().min(1),
  assigneeName: z.string().min(1).max(200),
  assigneeEmail: z.string().email(),

  dueDate: timestampSchema,

  sourceInsightId: z.string().optional(),
  sourceReportId: z.string().optional(),

  progress: z.number().min(0).max(100).default(0),
  blockers: z.array(z.string().min(1).max(500)).optional(),
  notes: z.string().max(5000).optional(),

  outcome: z.string().max(5000).optional(),
  impactAssessment: z.string().max(5000).optional(),
  lessonsLearned: z.string().max(5000).optional(),

  tags: z.array(z.string().min(1).max(50)).default([]),
});

export const actionItemUpdateSchema = actionItemCreateSchema.partial();

export const dashboardWidgetSchema = z.object({
  id: z.string().min(1).optional().default(() => generateId()),
  type: widgetTypeEnum,
  title: z.string().min(1).max(200),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
  }),
  config: z.object({
    dataSources: z.array(dataSourceEnum).optional(),
    dateRange: z
      .object({
        type: z.enum(['last_7_days', 'last_30_days', 'last_90_days', 'custom', 'ytd']),
        start: timestampSchema.optional(),
        end: timestampSchema.optional(),
      })
      .optional(),
    metrics: z.array(metricTypeEnum).optional(),
    groupBy: z.string().optional(),
    visualizationType: visualizationTypeEnum.optional(),
    showLegend: z.boolean().optional(),
    showLabels: z.boolean().optional(),
    showTrends: z.boolean().optional(),
    threshold: z
      .object({
        warning: z.number(),
        critical: z.number(),
      })
      .optional(),
    customSettings: z.record(z.string(), z.unknown()).optional(),
  }),
  refreshInterval: z.number().int().min(1),
  lastRefreshedAt: timestampSchema.optional(),
  isLoading: z.boolean().default(false),
  error: z.string().optional(),
});

export const dashboardCreateSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(2000).default(''),
  isDefault: z.boolean().default(false),

  columns: z.number().int().min(1).max(24).default(12),
  rowHeight: z.number().int().min(50).max(300).default(100),

  widgets: z.array(dashboardWidgetSchema).default([]),

  sharedWith: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),

  theme: z.enum(['light', 'dark', 'system']).default('system'),
  colorScheme: z.string().optional(),
});

export const dashboardUpdateSchema = dashboardCreateSchema.partial();

export const insightFilterSchema = z.object({
  types: z.array(insightTypeEnum).optional(),
  priorities: z.array(insightPriorityEnum).optional(),
  statuses: z.array(insightStatusEnum).optional(),
  dataSources: z.array(dataSourceEnum).optional(),
  impactLevels: z.array(z.enum(['high', 'medium', 'low'])).optional(),
  timeframes: z.array(z.enum(['immediate', 'short_term', 'medium_term', 'long_term'])).optional(),
  tags: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: timestampSchema,
      end: timestampSchema,
    })
    .optional(),
  searchQuery: z.string().optional(),
});

export const reportFilterSchema = z.object({
  types: z.array(reportTypeEnum).optional(),
  statuses: z.array(reportStatusEnum).optional(),
  createdByIds: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: timestampSchema,
      end: timestampSchema,
    })
    .optional(),
  tags: z.array(z.string()).optional(),
  searchQuery: z.string().optional(),
});

export const actionItemFilterSchema = z.object({
  types: z.array(actionItemTypeEnum).optional(),
  statuses: z.array(actionItemStatusEnum).optional(),
  priorities: z.array(insightPriorityEnum).optional(),
  assigneeIds: z.array(z.string()).optional(),
  dueDateRange: z
    .object({
      start: timestampSchema,
      end: timestampSchema,
    })
    .optional(),
  overdue: z.boolean().optional(),
  searchQuery: z.string().optional(),
});

export type InsightCreateInput = z.infer<typeof insightCreateSchema>;
export type InsightUpdateInput = z.infer<typeof insightUpdateSchema>;
export type InsightStatusTransitionInput = z.infer<typeof insightStatusTransitionSchema>;

export type ReportCreateInput = z.infer<typeof reportCreateSchema>;
export type ReportUpdateInput = z.infer<typeof reportUpdateSchema>;

export type ReportScheduleCreateInput = z.infer<typeof reportScheduleCreateSchema>;
export type ReportScheduleUpdateInput = z.infer<typeof reportScheduleUpdateSchema>;

export type ActionItemCreateInput = z.infer<typeof actionItemCreateSchema>;
export type ActionItemUpdateInput = z.infer<typeof actionItemUpdateSchema>;

export type DashboardCreateInput = z.infer<typeof dashboardCreateSchema>;
export type DashboardUpdateInput = z.infer<typeof dashboardUpdateSchema>;
