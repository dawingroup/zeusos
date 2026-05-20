import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import {
  ACTION_ITEM_STATUS_CONFIG,
  INSIGHT_PRIORITY_CONFIG,
  INSIGHT_STATUS_CONFIG,
  INTELLIGENCE_COLLECTIONS,
  REPORT_STATUS_CONFIG,
} from '../constants/dashboard.constants';
import type {
  IntelligenceInsight,
  InsightFilter,
  IntelligenceReport,
  ReportFilter,
  ReportSchedule,
  IntelligenceActionItem,
  ActionItemFilter,
  DashboardConfiguration,
  ExecutiveSummaryData,
  DataSourceStatus,
  MetricSnapshot,
  IntelligenceAnalytics,
} from '../types/dashboard.types';
import {
  insightCreateSchema,
  insightUpdateSchema,
  insightStatusTransitionSchema,
  reportCreateSchema,
  reportUpdateSchema,
  reportScheduleCreateSchema,
  reportScheduleUpdateSchema,
  actionItemCreateSchema,
  actionItemUpdateSchema,
  dashboardCreateSchema,
  dashboardUpdateSchema,
  type InsightCreateInput,
  type InsightUpdateInput,
  type InsightStatusTransitionInput,
  type ReportCreateInput,
  type ReportUpdateInput,
  type ReportScheduleCreateInput,
  type ReportScheduleUpdateInput,
  type ActionItemCreateInput,
  type ActionItemUpdateInput,
  type DashboardCreateInput,
  type DashboardUpdateInput,
} from '../schemas/dashboard.schemas';

const COLLECTIONS = INTELLIGENCE_COLLECTIONS;

const generateId = (): string => {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
};

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function buildInsightQueryConstraints(filters?: InsightFilter): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  if (filters?.types?.length) {
    constraints.push(where('type', 'in', filters.types));
  }

  if (filters?.priorities?.length) {
    constraints.push(where('priority', 'in', filters.priorities));
  }

  if (filters?.statuses?.length) {
    constraints.push(where('status', 'in', filters.statuses));
  }

  if (filters?.dataSources?.length) {
    constraints.push(where('dataSources', 'array-contains-any', filters.dataSources));
  }

  if (filters?.tags?.length) {
    constraints.push(where('tags', 'array-contains-any', filters.tags));
  }

  if (filters?.industries?.length) {
    constraints.push(where('industries', 'array-contains-any', filters.industries));
  }

  if (filters?.dateRange) {
    constraints.push(where('createdAt', '>=', filters.dateRange.start));
    constraints.push(where('createdAt', '<=', filters.dateRange.end));
  }

  // Sorting
  constraints.push(orderBy('createdAt', 'desc'));

  // Free-text search query is not implemented here; it generally requires dedicated
  // indexing/denormalization in Firestore.

  return constraints;
}

function buildReportQueryConstraints(filters?: ReportFilter): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  if (filters?.types?.length) {
    constraints.push(where('type', 'in', filters.types));
  }

  if (filters?.statuses?.length) {
    constraints.push(where('status', 'in', filters.statuses));
  }

  if (filters?.createdByIds?.length) {
    constraints.push(where('createdBy', 'in', filters.createdByIds));
  }

  if (filters?.tags?.length) {
    constraints.push(where('tags', 'array-contains-any', filters.tags));
  }

  if (filters?.dateRange) {
    constraints.push(where('createdAt', '>=', filters.dateRange.start));
    constraints.push(where('createdAt', '<=', filters.dateRange.end));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  return constraints;
}

function buildActionItemQueryConstraints(filters?: ActionItemFilter): QueryConstraint[] {
  const constraints: QueryConstraint[] = [];

  if (filters?.types?.length) {
    constraints.push(where('type', 'in', filters.types));
  }

  if (filters?.statuses?.length) {
    constraints.push(where('status', 'in', filters.statuses));
  }

  if (filters?.priorities?.length) {
    constraints.push(where('priority', 'in', filters.priorities));
  }

  if (filters?.assigneeIds?.length) {
    constraints.push(where('assigneeId', 'in', filters.assigneeIds));
  }

  if (filters?.dueDateRange) {
    constraints.push(where('dueDate', '>=', filters.dueDateRange.start));
    constraints.push(where('dueDate', '<=', filters.dueDateRange.end));
  }

  if (filters?.overdue) {
    constraints.push(where('dueDate', '<', Timestamp.now()));
  }

  constraints.push(orderBy('dueDate', 'asc'));

  return constraints;
}

// -----------------------------------------------------------------------------
// INSIGHTS
// -----------------------------------------------------------------------------

async function createInsight(
  organizationId: string,
  input: unknown,
  userId: string
): Promise<string> {
  const parsed = insightCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: InsightCreateInput = parsed.data;

  const now = Timestamp.now();

  const insight: Omit<IntelligenceInsight, 'id'> = {
    organizationId,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,

    status: 'new',

    ...data,

    reviewedAt: undefined,
    reviewedBy: undefined,
    reviewNotes: undefined,
    actedAt: undefined,
    actedBy: undefined,
    actionTaken: undefined,
    dismissedAt: undefined,
    dismissedBy: undefined,
    dismissReason: undefined,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.INSIGHTS), insight);
  return docRef.id;
}

async function getInsight(id: string): Promise<IntelligenceInsight | null> {
  const docRef = doc(db, COLLECTIONS.INSIGHTS, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as IntelligenceInsight;
}

async function getInsights(
  organizationId: string,
  filters?: InsightFilter,
  pageSize = 200
): Promise<IntelligenceInsight[]> {
  const constraints = [where('organizationId', '==', organizationId), ...buildInsightQueryConstraints(filters)];
  const q = query(collection(db, COLLECTIONS.INSIGHTS), ...constraints, limit(pageSize));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IntelligenceInsight));
}

async function updateInsight(id: string, updates: unknown, userId: string): Promise<boolean> {
  const parsed = insightUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: InsightUpdateInput = parsed.data;

  const docRef = doc(db, COLLECTIONS.INSIGHTS, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  return true;
}

async function transitionInsightStatus(
  id: string,
  input: unknown,
  userId: string
): Promise<boolean> {
  const parsed = insightStatusTransitionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: InsightStatusTransitionInput = parsed.data;

  const insight = await getInsight(id);
  if (!insight) {
    throw new Error('Insight not found');
  }

  const currentConfig = INSIGHT_STATUS_CONFIG[insight.status];
  const allowed = currentConfig?.allowedTransitions ?? [];
  if (!allowed.includes(data.newStatus)) {
    throw new Error(`Invalid status transition: ${insight.status} -> ${data.newStatus}`);
  }

  const now = Timestamp.now();
  const update: Partial<IntelligenceInsight> = {
    status: data.newStatus,
    updatedAt: now,
    updatedBy: userId,
  };

  if (data.newStatus === 'reviewed') {
    update.reviewedAt = now;
    update.reviewedBy = userId;
    update.reviewNotes = data.notes;
  }

  if (data.newStatus === 'in_progress') {
    update.reviewNotes = data.notes;
  }

  if (data.newStatus === 'acted_upon') {
    update.actedAt = now;
    update.actedBy = userId;
    update.actionTaken = data.actionTaken || data.notes;
  }

  if (data.newStatus === 'dismissed') {
    update.dismissedAt = now;
    update.dismissedBy = userId;
    update.dismissReason = data.dismissReason || data.notes;
  }

  const docRef = doc(db, COLLECTIONS.INSIGHTS, id);
  await updateDoc(docRef, update);
  return true;
}

async function deleteInsight(id: string): Promise<boolean> {
  await deleteDoc(doc(db, COLLECTIONS.INSIGHTS, id));
  return true;
}

function subscribeToInsights(
  organizationId: string,
  onChange: (insights: IntelligenceInsight[]) => void,
  onError?: (error: Error) => void,
  filters?: InsightFilter,
  pageSize = 200
): Unsubscribe {
  const constraints = [where('organizationId', '==', organizationId), ...buildInsightQueryConstraints(filters), limit(pageSize)];
  const q = query(collection(db, COLLECTIONS.INSIGHTS), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IntelligenceInsight));
      onChange(items);
    },
    (err) => {
      onError?.(err);
    }
  );
}

// -----------------------------------------------------------------------------
// REPORTS
// -----------------------------------------------------------------------------

async function createReport(
  organizationId: string,
  input: unknown,
  userId: string
): Promise<string> {
  const parsed = reportCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: ReportCreateInput = parsed.data;

  const now = Timestamp.now();

  const report: Omit<IntelligenceReport, 'id'> = {
    organizationId,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,

    status: 'draft',

    ...data,

    approvers: data.approvers || [],
    currentApproverIndex: 0,

    recipients: data.recipients || [],

    version: 1,
    previousVersionId: undefined,

    scheduleId: undefined,
    scheduledFor: undefined,

    sentAt: undefined,
    sentBy: undefined,

    pageCount: undefined,
    wordCount: undefined,
    generatedAt: undefined,
    pdfUrl: undefined,
    docxUrl: undefined,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.REPORTS), report);
  return docRef.id;
}

async function getReport(id: string): Promise<IntelligenceReport | null> {
  const docRef = doc(db, COLLECTIONS.REPORTS, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as IntelligenceReport;
}

async function getReports(
  organizationId: string,
  filters?: ReportFilter,
  pageSize = 200
): Promise<IntelligenceReport[]> {
  const constraints = [where('organizationId', '==', organizationId), ...buildReportQueryConstraints(filters), limit(pageSize)];
  const q = query(collection(db, COLLECTIONS.REPORTS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IntelligenceReport));
}

async function updateReport(id: string, updates: unknown, userId: string): Promise<boolean> {
  const parsed = reportUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: ReportUpdateInput = parsed.data;

  const docRef = doc(db, COLLECTIONS.REPORTS, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  return true;
}

async function transitionReportStatus(
  id: string,
  newStatus: IntelligenceReport['status'],
  userId: string
): Promise<boolean> {
  const report = await getReport(id);
  if (!report) throw new Error('Report not found');

  const allowed = REPORT_STATUS_CONFIG[report.status]?.allowedTransitions ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status transition: ${report.status} -> ${newStatus}`);
  }

  const docRef = doc(db, COLLECTIONS.REPORTS, id);
  await updateDoc(docRef, {
    status: newStatus,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  return true;
}

async function deleteReport(id: string): Promise<boolean> {
  await deleteDoc(doc(db, COLLECTIONS.REPORTS, id));
  return true;
}

function subscribeToReports(
  organizationId: string,
  onChange: (reports: IntelligenceReport[]) => void,
  onError?: (error: Error) => void,
  filters?: ReportFilter,
  pageSize = 200
): Unsubscribe {
  const constraints = [where('organizationId', '==', organizationId), ...buildReportQueryConstraints(filters), limit(pageSize)];
  const q = query(collection(db, COLLECTIONS.REPORTS), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IntelligenceReport));
      onChange(items);
    },
    (err) => onError?.(err)
  );
}

// -----------------------------------------------------------------------------
// REPORT SCHEDULES
// -----------------------------------------------------------------------------

async function createReportSchedule(
  organizationId: string,
  input: unknown,
  userId: string
): Promise<string> {
  const parsed = reportScheduleCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: ReportScheduleCreateInput = parsed.data;

  const now = Timestamp.now();
  const nextRunAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

  const schedule: Omit<ReportSchedule, 'id'> = {
    organizationId,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,

    ...data,

    nextRunAt,
    lastRunAt: undefined,

    failureCount: 0,
    lastError: undefined,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.REPORT_SCHEDULES), schedule);
  return docRef.id;
}

async function getReportSchedule(id: string): Promise<ReportSchedule | null> {
  const docRef = doc(db, COLLECTIONS.REPORT_SCHEDULES, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ReportSchedule;
}

async function getReportSchedules(
  organizationId: string,
  pageSize = 200
): Promise<ReportSchedule[]> {
  const q = query(
    collection(db, COLLECTIONS.REPORT_SCHEDULES),
    where('organizationId', '==', organizationId),
    orderBy('nextRunAt', 'asc'),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReportSchedule));
}

async function updateReportSchedule(
  id: string,
  updates: unknown,
  userId: string
): Promise<boolean> {
  const parsed = reportScheduleUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: ReportScheduleUpdateInput = parsed.data;

  const docRef = doc(db, COLLECTIONS.REPORT_SCHEDULES, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  return true;
}

async function deleteReportSchedule(id: string): Promise<boolean> {
  await deleteDoc(doc(db, COLLECTIONS.REPORT_SCHEDULES, id));
  return true;
}

// -----------------------------------------------------------------------------
// ACTION ITEMS
// -----------------------------------------------------------------------------

async function createActionItem(
  organizationId: string,
  input: unknown,
  userId: string
): Promise<string> {
  const parsed = actionItemCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: ActionItemCreateInput = parsed.data;

  const now = Timestamp.now();

  const actionItem: Omit<IntelligenceActionItem, 'id'> = {
    organizationId,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,

    status: 'todo',

    ...data,

    startedAt: undefined,
    completedAt: undefined,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.ACTION_ITEMS), actionItem);
  return docRef.id;
}

async function getActionItem(id: string): Promise<IntelligenceActionItem | null> {
  const docRef = doc(db, COLLECTIONS.ACTION_ITEMS, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as IntelligenceActionItem;
}

async function getActionItems(
  organizationId: string,
  filters?: ActionItemFilter,
  pageSize = 200
): Promise<IntelligenceActionItem[]> {
  const constraints = [
    where('organizationId', '==', organizationId),
    ...buildActionItemQueryConstraints(filters),
    limit(pageSize),
  ];

  const q = query(collection(db, COLLECTIONS.ACTION_ITEMS), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as IntelligenceActionItem));
}

async function updateActionItem(id: string, updates: unknown, userId: string): Promise<boolean> {
  const parsed = actionItemUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: ActionItemUpdateInput = parsed.data;

  const docRef = doc(db, COLLECTIONS.ACTION_ITEMS, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  return true;
}

async function transitionActionItemStatus(
  id: string,
  newStatus: IntelligenceActionItem['status'],
  userId: string
): Promise<boolean> {
  const actionItem = await getActionItem(id);
  if (!actionItem) throw new Error('Action item not found');

  const allowed = ACTION_ITEM_STATUS_CONFIG[actionItem.status]?.allowedTransitions ?? [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`Invalid status transition: ${actionItem.status} -> ${newStatus}`);
  }

  const now = Timestamp.now();
  const update: Partial<IntelligenceActionItem> = {
    status: newStatus,
    updatedAt: now,
    updatedBy: userId,
  };

  if (newStatus === 'in_progress') {
    update.startedAt = actionItem.startedAt || now;
  }

  if (newStatus === 'completed') {
    update.completedAt = now;
    update.progress = 100;
  }

  const docRef = doc(db, COLLECTIONS.ACTION_ITEMS, id);
  await updateDoc(docRef, update);

  return true;
}

async function deleteActionItem(id: string): Promise<boolean> {
  await deleteDoc(doc(db, COLLECTIONS.ACTION_ITEMS, id));
  return true;
}

function subscribeToActionItems(
  organizationId: string,
  onChange: (items: IntelligenceActionItem[]) => void,
  onError?: (error: Error) => void,
  filters?: ActionItemFilter,
  pageSize = 200
): Unsubscribe {
  const constraints = [
    where('organizationId', '==', organizationId),
    ...buildActionItemQueryConstraints(filters),
    limit(pageSize),
  ];

  const q = query(collection(db, COLLECTIONS.ACTION_ITEMS), ...constraints);

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as IntelligenceActionItem));
      onChange(items);
    },
    (err) => onError?.(err)
  );
}

// -----------------------------------------------------------------------------
// DASHBOARDS
// -----------------------------------------------------------------------------

async function createDashboard(
  organizationId: string,
  input: unknown,
  userId: string
): Promise<string> {
  const parsed = dashboardCreateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: DashboardCreateInput = parsed.data;

  const now = Timestamp.now();

  const dashboard: Omit<DashboardConfiguration, 'id'> = {
    organizationId,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,

    ownerId: userId,

    ...data,

    widgets: data.widgets.map((w) => ({
      ...w,
      id: w.id || generateId(),
      isLoading: false,
    })),
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.DASHBOARDS), dashboard);
  return docRef.id;
}

async function getDashboard(id: string): Promise<DashboardConfiguration | null> {
  const docRef = doc(db, COLLECTIONS.DASHBOARDS, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DashboardConfiguration;
}

async function getDashboards(organizationId: string, pageSize = 50): Promise<DashboardConfiguration[]> {
  const q = query(
    collection(db, COLLECTIONS.DASHBOARDS),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as DashboardConfiguration));
}

async function updateDashboard(id: string, updates: unknown, userId: string): Promise<boolean> {
  const parsed = dashboardUpdateSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(`Validation failed: ${parsed.error.message}`);
  }

  const data: DashboardUpdateInput = parsed.data;

  const docRef = doc(db, COLLECTIONS.DASHBOARDS, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  return true;
}

async function deleteDashboard(id: string): Promise<boolean> {
  await deleteDoc(doc(db, COLLECTIONS.DASHBOARDS, id));
  return true;
}

// -----------------------------------------------------------------------------
// EXECUTIVE SUMMARY / ANALYTICS (lightweight / partial)
// -----------------------------------------------------------------------------

async function getExecutiveSummary(
  organizationId: string,
  period?: { start: Timestamp; end: Timestamp }
): Promise<ExecutiveSummaryData> {
  const now = Timestamp.now();
  const start = period?.start ?? Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = period?.end ?? now;

  const [insights, actionItems, reports] = await Promise.all([
    getInsights(organizationId, { dateRange: { start, end } }, 100),
    getActionItems(organizationId, undefined, 100),
    getReports(organizationId, undefined, 50),
  ]);

  const topInsights = insights
    .slice()
    .sort((a, b) => {
      const ap = INSIGHT_PRIORITY_CONFIG[a.priority]?.sortOrder ?? 99;
      const bp = INSIGHT_PRIORITY_CONFIG[b.priority]?.sortOrder ?? 99;
      return ap - bp;
    })
    .slice(0, 5);

  const headlines = topInsights.map((i) => ({
    title: i.title,
    type: i.type,
    priority: i.priority,
    summary: i.description.slice(0, 200),
    insightId: i.id,
  }));

  const overdueActions = actionItems.filter(
    (a) => a.status !== 'completed' && a.status !== 'cancelled' && a.dueDate.toMillis() < Date.now()
  );

  const upcomingScheduledReports = reports
    .filter((r) => r.scheduledFor && r.scheduledFor.toMillis() >= Date.now())
    .sort((a, b) => (a.scheduledFor?.toMillis() ?? 0) - (b.scheduledFor?.toMillis() ?? 0))
    .slice(0, 10)
    .map((r) => ({
      title: r.title,
      type: 'report' as const,
      dueDate: r.scheduledFor as Timestamp,
      entityId: r.id,
    }));

  const upcomingDeadlines = [
    ...overdueActions.slice(0, 10).map((a) => ({
      title: a.title,
      type: 'action_item' as const,
      dueDate: a.dueDate,
      entityId: a.id,
    })),
    ...upcomingScheduledReports,
  ].slice(0, 10);

  const activeAlerts = topInsights
    .filter((i) => i.priority === 'critical' || i.priority === 'high')
    .slice(0, 10)
    .map((i) => ({
      title: i.title,
      priority: i.priority,
      source: i.dataSources[0] || 'internal_data',
      entityId: i.id,
    }));

  const dataStatus: DataSourceStatus[] = [];

  const keyMetrics: MetricSnapshot[] = [
    {
      metricType: 'insight_count',
      currentValue: insights.filter((i) => i.status === 'new').length,
      previousValue: 0,
      changePercent: 0,
      trend: 'stable',
      isPositive: true,
    },
    {
      metricType: 'action_items',
      currentValue: actionItems.filter((a) => a.status !== 'completed' && a.status !== 'cancelled').length,
      previousValue: 0,
      changePercent: 0,
      trend: 'stable',
      isPositive: true,
    },
    {
      metricType: 'data_freshness',
      currentValue: 0,
      previousValue: 0,
      changePercent: 0,
      trend: 'stable',
      isPositive: true,
    },
  ];

  return {
    generatedAt: now,
    period: { start, end },
    headlines,
    keyMetrics,
    topInsights,
    upcomingDeadlines,
    activeAlerts,
    dataStatus,
  };
}

async function getIntelligenceAnalytics(
  organizationId: string,
  period: IntelligenceAnalytics['period'] = 'monthly'
): Promise<IntelligenceAnalytics> {
  const now = Timestamp.now();

  const periodDays =
    period === 'daily'
      ? 1
      : period === 'weekly'
        ? 7
        : period === 'monthly'
          ? 30
          : 90;

  const periodStart = Timestamp.fromMillis(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  const periodEnd = now;

  const [insights, actionItems, reports] = await Promise.all([
    getInsights(organizationId, { dateRange: { start: periodStart, end: periodEnd } }, 500),
    getActionItems(organizationId, undefined, 500),
    getReports(organizationId, undefined, 200),
  ]);

  const insightsByType: Record<string, number> = {};
  const insightsByPriority: Record<string, number> = {};

  for (const i of insights) {
    insightsByType[i.type] = safeNumber(insightsByType[i.type]) + 1;
    insightsByPriority[i.priority] = safeNumber(insightsByPriority[i.priority]) + 1;
  }

  const byStatus: Record<string, number> = {};
  const overdue = actionItems.filter(
    (a) => a.status !== 'completed' && a.status !== 'cancelled' && a.dueDate.toMillis() < Date.now()
  ).length;

  for (const a of actionItems) {
    byStatus[a.status] = safeNumber(byStatus[a.status]) + 1;
  }

  const reportsByStatus: Record<string, number> = {};
  for (const r of reports) {
    reportsByStatus[r.status] = safeNumber(reportsByStatus[r.status]) + 1;
  }

  const publishedThisPeriod = reports.filter(
    (r) => r.status === 'published' && r.updatedAt.toMillis() >= periodStart.toMillis()
  ).length;

  const keyMetrics: MetricSnapshot[] = [
    {
      metricType: 'insight_count',
      currentValue: insights.length,
      previousValue: 0,
      changePercent: 0,
      trend: 'stable',
      isPositive: true,
    },
    {
      metricType: 'action_items',
      currentValue: actionItems.filter((a) => a.status !== 'completed' && a.status !== 'cancelled').length,
      previousValue: 0,
      changePercent: 0,
      trend: 'stable',
      isPositive: true,
    },
    {
      metricType: 'data_freshness',
      currentValue: 0,
      previousValue: 0,
      changePercent: 0,
      trend: 'stable',
      isPositive: true,
    },
  ];

  return {
    id: 'analytics',
    organizationId,
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',

    period,
    periodStart,
    periodEnd,
    generatedAt: now,

    keyMetrics,
    insightsByType,
    insightsByPriority,

    actionItemsSummary: {
      total: actionItems.length,
      overdue,
      byStatus,
    },

    reportSummary: {
      total: reports.length,
      byStatus: reportsByStatus,
      publishedThisPeriod,
    },

    correlations: [],
  };
}

export const intelligenceService = {
  // Insights
  createInsight,
  getInsight,
  getInsights,
  updateInsight,
  transitionInsightStatus,
  deleteInsight,
  subscribeToInsights,

  // Reports
  createReport,
  getReport,
  getReports,
  updateReport,
  transitionReportStatus,
  deleteReport,
  subscribeToReports,

  // Schedules
  createReportSchedule,
  getReportSchedule,
  getReportSchedules,
  updateReportSchedule,
  deleteReportSchedule,

  // Action Items
  createActionItem,
  getActionItem,
  getActionItems,
  updateActionItem,
  transitionActionItemStatus,
  deleteActionItem,
  subscribeToActionItems,

  // Dashboards
  createDashboard,
  getDashboard,
  getDashboards,
  updateDashboard,
  deleteDashboard,

  // Aggregations
  getExecutiveSummary,
  getIntelligenceAnalytics,
};
