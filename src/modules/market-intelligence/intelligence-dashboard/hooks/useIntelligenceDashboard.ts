import { useCallback, useEffect, useMemo, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/shared/hooks';
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
  IntelligenceAnalytics,
} from '../types/dashboard.types';
import type {
  InsightCreateInput,
  InsightUpdateInput,
  InsightStatusTransitionInput,
  ReportCreateInput,
  ReportUpdateInput,
  ReportScheduleCreateInput,
  ReportScheduleUpdateInput,
  ActionItemCreateInput,
  ActionItemUpdateInput,
  DashboardCreateInput,
  DashboardUpdateInput,
} from '../schemas/dashboard.schemas';
import { intelligenceService } from '../services/intelligenceService';

export interface UseIntelligenceDashboardOptions {
  organizationId: string;
  autoLoad?: boolean;
  realtime?: boolean;
}

export interface UseIntelligenceDashboardReturn {
  insights: IntelligenceInsight[];
  selectedInsight: IntelligenceInsight | null;
  reports: IntelligenceReport[];
  selectedReport: IntelligenceReport | null;
  schedules: ReportSchedule[];
  actionItems: IntelligenceActionItem[];
  selectedActionItem: IntelligenceActionItem | null;
  dashboards: DashboardConfiguration[];
  selectedDashboard: DashboardConfiguration | null;
  executiveSummary: ExecutiveSummaryData | null;
  analytics: IntelligenceAnalytics | null;

  isLoading: boolean;
  error: string | null;

  insightsLoading: boolean;
  reportsLoading: boolean;
  schedulesLoading: boolean;
  actionItemsLoading: boolean;
  dashboardsLoading: boolean;
  executiveLoading: boolean;

  loadInsights: (filters?: InsightFilter) => Promise<void>;
  loadInsight: (id: string) => Promise<void>;
  createInsight: (input: InsightCreateInput) => Promise<string | null>;
  updateInsight: (id: string, updates: InsightUpdateInput) => Promise<boolean>;
  transitionInsightStatus: (id: string, input: InsightStatusTransitionInput) => Promise<boolean>;
  deleteInsight: (id: string) => Promise<boolean>;

  loadReports: (filters?: ReportFilter) => Promise<void>;
  loadReport: (id: string) => Promise<void>;
  createReport: (input: ReportCreateInput) => Promise<string | null>;
  updateReport: (id: string, updates: ReportUpdateInput) => Promise<boolean>;
  transitionReportStatus: (id: string, newStatus: IntelligenceReport['status']) => Promise<boolean>;
  deleteReport: (id: string) => Promise<boolean>;

  loadReportSchedules: () => Promise<void>;
  createReportSchedule: (input: ReportScheduleCreateInput) => Promise<string | null>;
  updateReportSchedule: (id: string, updates: ReportScheduleUpdateInput) => Promise<boolean>;
  deleteReportSchedule: (id: string) => Promise<boolean>;

  loadActionItems: (filters?: ActionItemFilter) => Promise<void>;
  loadActionItem: (id: string) => Promise<void>;
  createActionItem: (input: ActionItemCreateInput) => Promise<string | null>;
  updateActionItem: (id: string, updates: ActionItemUpdateInput) => Promise<boolean>;
  transitionActionItemStatus: (id: string, newStatus: IntelligenceActionItem['status']) => Promise<boolean>;
  deleteActionItem: (id: string) => Promise<boolean>;

  loadDashboards: () => Promise<void>;
  loadDashboard: (id: string) => Promise<void>;
  createDashboard: (input: DashboardCreateInput) => Promise<string | null>;
  updateDashboard: (id: string, updates: DashboardUpdateInput) => Promise<boolean>;
  deleteDashboard: (id: string) => Promise<boolean>;
  setSelectedDashboard: (dashboard: DashboardConfiguration | null) => void;

  loadExecutiveSummary: (period?: { start: Timestamp; end: Timestamp }) => Promise<void>;
  loadAnalytics: (period?: IntelligenceAnalytics['period']) => Promise<void>;

  clearError: () => void;
}

export function useIntelligenceDashboard({
  organizationId,
  autoLoad = true,
  realtime = true,
}: UseIntelligenceDashboardOptions): UseIntelligenceDashboardReturn {
  const { user } = useAuth();

  const [insights, setInsights] = useState<IntelligenceInsight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<IntelligenceInsight | null>(null);
  const [reports, setReports] = useState<IntelligenceReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<IntelligenceReport | null>(null);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [actionItems, setActionItems] = useState<IntelligenceActionItem[]>([]);
  const [selectedActionItem, setSelectedActionItem] = useState<IntelligenceActionItem | null>(null);
  const [dashboards, setDashboards] = useState<DashboardConfiguration[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardConfiguration | null>(null);
  const [executiveSummary, setExecutiveSummary] = useState<ExecutiveSummaryData | null>(null);
  const [analytics, setAnalytics] = useState<IntelligenceAnalytics | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [insightsLoading, setInsightsLoading] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [actionItemsLoading, setActionItemsLoading] = useState(false);
  const [dashboardsLoading, setDashboardsLoading] = useState(false);
  const [executiveLoading, setExecutiveLoading] = useState(false);

  const isLoading = useMemo(
    () =>
      insightsLoading ||
      reportsLoading ||
      schedulesLoading ||
      actionItemsLoading ||
      dashboardsLoading ||
      executiveLoading,
    [
      insightsLoading,
      reportsLoading,
      schedulesLoading,
      actionItemsLoading,
      dashboardsLoading,
      executiveLoading,
    ]
  );

  const clearError = useCallback(() => setError(null), []);

  const requireUser = useCallback((): string | null => {
    if (!user?.uid) {
      setError('Authentication required');
      return null;
    }
    return user.uid;
  }, [user?.uid]);

  const loadInsights = useCallback(
    async (filters?: InsightFilter) => {
      setInsightsLoading(true);
      setError(null);
      try {
        const data = await intelligenceService.getInsights(organizationId, filters);
        setInsights(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load insights');
      } finally {
        setInsightsLoading(false);
      }
    },
    [organizationId]
  );

  const loadInsight = useCallback(
    async (id: string) => {
      setInsightsLoading(true);
      setError(null);
      try {
        const data = await intelligenceService.getInsight(id);
        setSelectedInsight(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load insight');
      } finally {
        setInsightsLoading(false);
      }
    },
    []
  );

  const createInsight = useCallback(
    async (input: InsightCreateInput) => {
      const uid = requireUser();
      if (!uid) return null;
      setError(null);
      try {
        const id = await intelligenceService.createInsight(organizationId, input, uid);
        return id;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create insight');
        return null;
      }
    },
    [organizationId, requireUser]
  );

  const updateInsight = useCallback(
    async (id: string, updates: InsightUpdateInput) => {
      const uid = requireUser();
      if (!uid) return false;
      setError(null);
      try {
        await intelligenceService.updateInsight(id, updates, uid);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update insight');
        return false;
      }
    },
    [requireUser]
  );

  const transitionInsightStatus = useCallback(
    async (id: string, input: InsightStatusTransitionInput) => {
      const uid = requireUser();
      if (!uid) return false;
      setError(null);
      try {
        await intelligenceService.transitionInsightStatus(id, input, uid);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to transition insight');
        return false;
      }
    },
    [requireUser]
  );

  const deleteInsight = useCallback(async (id: string) => {
    setError(null);
    try {
      await intelligenceService.deleteInsight(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete insight');
      return false;
    }
  }, []);

  const loadReports = useCallback(
    async (filters?: ReportFilter) => {
      setReportsLoading(true);
      setError(null);
      try {
        const data = await intelligenceService.getReports(organizationId, filters);
        setReports(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load reports');
      } finally {
        setReportsLoading(false);
      }
    },
    [organizationId]
  );

  const loadReport = useCallback(async (id: string) => {
    setReportsLoading(true);
    setError(null);
    try {
      const data = await intelligenceService.getReport(id);
      setSelectedReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const createReport = useCallback(
    async (input: ReportCreateInput) => {
      const uid = requireUser();
      if (!uid) return null;
      setError(null);
      try {
        const id = await intelligenceService.createReport(organizationId, input, uid);
        return id;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create report');
        return null;
      }
    },
    [organizationId, requireUser]
  );

  const updateReport = useCallback(
    async (id: string, updates: ReportUpdateInput) => {
      const uid = requireUser();
      if (!uid) return false;
      setError(null);
      try {
        await intelligenceService.updateReport(id, updates, uid);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update report');
        return false;
      }
    },
    [requireUser]
  );

  const transitionReportStatus = useCallback(
    async (id: string, newStatus: IntelligenceReport['status']) => {
      const uid = requireUser();
      if (!uid) return false;
      setError(null);
      try {
        await intelligenceService.transitionReportStatus(id, newStatus, uid);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to transition report');
        return false;
      }
    },
    [requireUser]
  );

  const deleteReport = useCallback(async (id: string) => {
    setError(null);
    try {
      await intelligenceService.deleteReport(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete report');
      return false;
    }
  }, []);

  const loadReportSchedules = useCallback(async () => {
    setSchedulesLoading(true);
    setError(null);
    try {
      const data = await intelligenceService.getReportSchedules(organizationId);
      setSchedules(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report schedules');
    } finally {
      setSchedulesLoading(false);
    }
  }, [organizationId]);

  const createReportSchedule = useCallback(
    async (input: ReportScheduleCreateInput) => {
      const uid = requireUser();
      if (!uid) return null;
      setError(null);
      try {
        const id = await intelligenceService.createReportSchedule(organizationId, input, uid);
        return id;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create report schedule');
        return null;
      }
    },
    [organizationId, requireUser]
  );

  const updateReportSchedule = useCallback(
    async (id: string, updates: ReportScheduleUpdateInput) => {
      const uid = requireUser();
      if (!uid) return false;
      setError(null);
      try {
        await intelligenceService.updateReportSchedule(id, updates, uid);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update report schedule');
        return false;
      }
    },
    [requireUser]
  );

  const deleteReportSchedule = useCallback(async (id: string) => {
    setError(null);
    try {
      await intelligenceService.deleteReportSchedule(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete report schedule');
      return false;
    }
  }, []);

  const loadActionItems = useCallback(
    async (filters?: ActionItemFilter) => {
      setActionItemsLoading(true);
      setError(null);
      try {
        const data = await intelligenceService.getActionItems(organizationId, filters);
        setActionItems(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load action items');
      } finally {
        setActionItemsLoading(false);
      }
    },
    [organizationId]
  );

  const loadActionItem = useCallback(async (id: string) => {
    setActionItemsLoading(true);
    setError(null);
    try {
      const data = await intelligenceService.getActionItem(id);
      setSelectedActionItem(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load action item');
    } finally {
      setActionItemsLoading(false);
    }
  }, []);

  const createActionItem = useCallback(
    async (input: ActionItemCreateInput) => {
      const uid = requireUser();
      if (!uid) return null;
      setError(null);
      try {
        const id = await intelligenceService.createActionItem(organizationId, input, uid);
        return id;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create action item');
        return null;
      }
    },
    [organizationId, requireUser]
  );

  const updateActionItem = useCallback(
    async (id: string, updates: ActionItemUpdateInput) => {
      const uid = requireUser();
      if (!uid) return false;
      setError(null);
      try {
        await intelligenceService.updateActionItem(id, updates, uid);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update action item');
        return false;
      }
    },
    [requireUser]
  );

  const transitionActionItemStatus = useCallback(
    async (id: string, newStatus: IntelligenceActionItem['status']) => {
      const uid = requireUser();
      if (!uid) return false;
      setError(null);
      try {
        await intelligenceService.transitionActionItemStatus(id, newStatus, uid);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to transition action item');
        return false;
      }
    },
    [requireUser]
  );

  const deleteActionItem = useCallback(async (id: string) => {
    setError(null);
    try {
      await intelligenceService.deleteActionItem(id);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete action item');
      return false;
    }
  }, []);

  const loadDashboards = useCallback(async () => {
    setDashboardsLoading(true);
    setError(null);
    try {
      const data = await intelligenceService.getDashboards(organizationId);
      setDashboards(data);
      if (!selectedDashboard && data.length) {
        setSelectedDashboard(data.find((d) => d.isDefault) || data[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboards');
    } finally {
      setDashboardsLoading(false);
    }
  }, [organizationId, selectedDashboard]);

  const loadDashboard = useCallback(async (id: string) => {
    setDashboardsLoading(true);
    setError(null);
    try {
      const data = await intelligenceService.getDashboard(id);
      setSelectedDashboard(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setDashboardsLoading(false);
    }
  }, []);

  const createDashboard = useCallback(
    async (input: DashboardCreateInput) => {
      const uid = requireUser();
      if (!uid) return null;
      setError(null);
      try {
        const id = await intelligenceService.createDashboard(organizationId, input, uid);
        return id;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create dashboard');
        return null;
      }
    },
    [organizationId, requireUser]
  );

  const updateDashboard = useCallback(
    async (id: string, updates: DashboardUpdateInput) => {
      const uid = requireUser();
      if (!uid) return false;
      setError(null);
      try {
        await intelligenceService.updateDashboard(id, updates, uid);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update dashboard');
        return false;
      }
    },
    [requireUser]
  );

  const deleteDashboard = useCallback(async (id: string) => {
    setError(null);
    try {
      await intelligenceService.deleteDashboard(id);
      if (selectedDashboard?.id === id) {
        setSelectedDashboard(null);
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete dashboard');
      return false;
    }
  }, [selectedDashboard?.id]);

  const loadExecutiveSummary = useCallback(
    async (period?: { start: Timestamp; end: Timestamp }) => {
      setExecutiveLoading(true);
      setError(null);
      try {
        const data = await intelligenceService.getExecutiveSummary(organizationId, period);
        setExecutiveSummary(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load executive summary');
      } finally {
        setExecutiveLoading(false);
      }
    },
    [organizationId]
  );

  const loadAnalytics = useCallback(
    async (period: IntelligenceAnalytics['period'] = 'monthly') => {
      setExecutiveLoading(true);
      setError(null);
      try {
        const data = await intelligenceService.getIntelligenceAnalytics(organizationId, period);
        setAnalytics(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load analytics');
      } finally {
        setExecutiveLoading(false);
      }
    },
    [organizationId]
  );

  useEffect(() => {
    if (!organizationId || !autoLoad) return;

    if (realtime) {
      const unsubInsights = intelligenceService.subscribeToInsights(
        organizationId,
        setInsights,
        (e) => setError(e.message)
      );
      const unsubReports = intelligenceService.subscribeToReports(
        organizationId,
        setReports,
        (e) => setError(e.message)
      );
      const unsubActions = intelligenceService.subscribeToActionItems(
        organizationId,
        setActionItems,
        (e) => setError(e.message)
      );

      loadReportSchedules();
      loadDashboards();
      loadExecutiveSummary();
      loadAnalytics('monthly');

      return () => {
        unsubInsights();
        unsubReports();
        unsubActions();
      };
    }

    loadInsights();
    loadReports();
    loadActionItems();
    loadReportSchedules();
    loadDashboards();
    loadExecutiveSummary();
    loadAnalytics('monthly');
  }, [
    organizationId,
    autoLoad,
    realtime,
    loadInsights,
    loadReports,
    loadActionItems,
    loadReportSchedules,
    loadDashboards,
    loadExecutiveSummary,
    loadAnalytics,
  ]);

  useEffect(() => {
    if (!selectedDashboard && dashboards.length) {
      setSelectedDashboard(dashboards.find((d) => d.isDefault) || dashboards[0]);
    }
  }, [dashboards, selectedDashboard]);

  return {
    insights,
    selectedInsight,
    reports,
    selectedReport,
    schedules,
    actionItems,
    selectedActionItem,
    dashboards,
    selectedDashboard,
    executiveSummary,
    analytics,

    isLoading,
    error,

    insightsLoading,
    reportsLoading,
    schedulesLoading,
    actionItemsLoading,
    dashboardsLoading,
    executiveLoading,

    loadInsights,
    loadInsight,
    createInsight,
    updateInsight,
    transitionInsightStatus,
    deleteInsight,

    loadReports,
    loadReport,
    createReport,
    updateReport,
    transitionReportStatus,
    deleteReport,

    loadReportSchedules,
    createReportSchedule,
    updateReportSchedule,
    deleteReportSchedule,

    loadActionItems,
    loadActionItem,
    createActionItem,
    updateActionItem,
    transitionActionItemStatus,
    deleteActionItem,

    loadDashboards,
    loadDashboard,
    createDashboard,
    updateDashboard,
    deleteDashboard,
    setSelectedDashboard,

    loadExecutiveSummary,
    loadAnalytics,

    clearError,
  };
}
