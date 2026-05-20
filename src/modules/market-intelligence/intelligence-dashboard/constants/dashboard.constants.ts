export const DATA_SOURCES = {
  COMPETITOR_ANALYSIS: 'competitor_analysis',
  MARKET_RESEARCH: 'market_research',
  ENVIRONMENT_SCANNING: 'environment_scanning',
  EXTERNAL_DATA: 'external_data',
  INTERNAL_DATA: 'internal_data',
} as const;

export type DataSource = typeof DATA_SOURCES[keyof typeof DATA_SOURCES];

export const DATA_SOURCE_CONFIG: Record<
  DataSource,
  {
    label: string;
    description: string;
    icon: string;
    color: string;
    refreshInterval: number;
  }
> = {
  [DATA_SOURCES.COMPETITOR_ANALYSIS]: {
    label: 'Competitor Analysis',
    description: 'Competitor profiles, SWOT, and benchmarking data',
    icon: 'Users',
    color: '#1976d2',
    refreshInterval: 1440,
  },
  [DATA_SOURCES.MARKET_RESEARCH]: {
    label: 'Market Research',
    description: 'Market sizing, trends, surveys, and research documents',
    icon: 'TrendingUp',
    color: '#388e3c',
    refreshInterval: 720,
  },
  [DATA_SOURCES.ENVIRONMENT_SCANNING]: {
    label: 'Environment Scanning',
    description: 'PESTEL, signals, regulatory, and scenario data',
    icon: 'Globe',
    color: '#f57c00',
    refreshInterval: 360,
  },
  [DATA_SOURCES.EXTERNAL_DATA]: {
    label: 'External Data',
    description: 'Third-party data feeds and APIs',
    icon: 'Cloud',
    color: '#7b1fa2',
    refreshInterval: 60,
  },
  [DATA_SOURCES.INTERNAL_DATA]: {
    label: 'Internal Data',
    description: 'Internal company performance and metrics',
    icon: 'Building',
    color: '#0288d1',
    refreshInterval: 480,
  },
};

export const INSIGHT_TYPES = {
  OPPORTUNITY: 'opportunity',
  THREAT: 'threat',
  TREND: 'trend',
  ANOMALY: 'anomaly',
  CORRELATION: 'correlation',
  PREDICTION: 'prediction',
  RECOMMENDATION: 'recommendation',
  WARNING: 'warning',
} as const;

export type InsightType = typeof INSIGHT_TYPES[keyof typeof INSIGHT_TYPES];

export const INSIGHT_TYPE_CONFIG: Record<
  InsightType,
  {
    label: string;
    description: string;
    icon: string;
    color: string;
    priority: number;
  }
> = {
  [INSIGHT_TYPES.OPPORTUNITY]: {
    label: 'Opportunity',
    description: 'Potential growth or advantage area',
    icon: 'Lightbulb',
    color: '#4caf50',
    priority: 1,
  },
  [INSIGHT_TYPES.THREAT]: {
    label: 'Threat',
    description: 'Risk or competitive challenge',
    icon: 'AlertTriangle',
    color: '#f44336',
    priority: 1,
  },
  [INSIGHT_TYPES.TREND]: {
    label: 'Trend',
    description: 'Emerging pattern or direction',
    icon: 'TrendingUp',
    color: '#2196f3',
    priority: 2,
  },
  [INSIGHT_TYPES.ANOMALY]: {
    label: 'Anomaly',
    description: 'Unexpected deviation from normal',
    icon: 'Zap',
    color: '#ff9800',
    priority: 2,
  },
  [INSIGHT_TYPES.CORRELATION]: {
    label: 'Correlation',
    description: 'Relationship between data points',
    icon: 'Link',
    color: '#9c27b0',
    priority: 3,
  },
  [INSIGHT_TYPES.PREDICTION]: {
    label: 'Prediction',
    description: 'Future state forecast',
    icon: 'Eye',
    color: '#00bcd4',
    priority: 2,
  },
  [INSIGHT_TYPES.RECOMMENDATION]: {
    label: 'Recommendation',
    description: 'Suggested action or decision',
    icon: 'CheckCircle',
    color: '#8bc34a',
    priority: 1,
  },
  [INSIGHT_TYPES.WARNING]: {
    label: 'Warning',
    description: 'Caution about potential issue',
    icon: 'AlertCircle',
    color: '#ff5722',
    priority: 1,
  },
};

export const INSIGHT_PRIORITIES = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info',
} as const;

export type InsightPriority = typeof INSIGHT_PRIORITIES[keyof typeof INSIGHT_PRIORITIES];

export const INSIGHT_PRIORITY_CONFIG: Record<
  InsightPriority,
  {
    label: string;
    color: string;
    backgroundColor: string;
    sortOrder: number;
    notifyImmediately: boolean;
  }
> = {
  [INSIGHT_PRIORITIES.CRITICAL]: {
    label: 'Critical',
    color: '#fff',
    backgroundColor: '#d32f2f',
    sortOrder: 1,
    notifyImmediately: true,
  },
  [INSIGHT_PRIORITIES.HIGH]: {
    label: 'High',
    color: '#fff',
    backgroundColor: '#f57c00',
    sortOrder: 2,
    notifyImmediately: true,
  },
  [INSIGHT_PRIORITIES.MEDIUM]: {
    label: 'Medium',
    color: '#000',
    backgroundColor: '#ffc107',
    sortOrder: 3,
    notifyImmediately: false,
  },
  [INSIGHT_PRIORITIES.LOW]: {
    label: 'Low',
    color: '#000',
    backgroundColor: '#8bc34a',
    sortOrder: 4,
    notifyImmediately: false,
  },
  [INSIGHT_PRIORITIES.INFO]: {
    label: 'Informational',
    color: '#000',
    backgroundColor: '#e0e0e0',
    sortOrder: 5,
    notifyImmediately: false,
  },
};

export const INSIGHT_STATUSES = {
  NEW: 'new',
  REVIEWED: 'reviewed',
  IN_PROGRESS: 'in_progress',
  ACTED_UPON: 'acted_upon',
  DISMISSED: 'dismissed',
  EXPIRED: 'expired',
} as const;

export type InsightStatus = typeof INSIGHT_STATUSES[keyof typeof INSIGHT_STATUSES];

export const INSIGHT_STATUS_CONFIG: Record<
  InsightStatus,
  {
    label: string;
    color: string;
    icon: string;
    allowedTransitions: InsightStatus[];
  }
> = {
  [INSIGHT_STATUSES.NEW]: {
    label: 'New',
    color: '#2196f3',
    icon: 'Sparkles',
    allowedTransitions: ['reviewed', 'dismissed'],
  },
  [INSIGHT_STATUSES.REVIEWED]: {
    label: 'Reviewed',
    color: '#9c27b0',
    icon: 'Eye',
    allowedTransitions: ['in_progress', 'dismissed'],
  },
  [INSIGHT_STATUSES.IN_PROGRESS]: {
    label: 'In Progress',
    color: '#ff9800',
    icon: 'Clock',
    allowedTransitions: ['acted_upon', 'dismissed'],
  },
  [INSIGHT_STATUSES.ACTED_UPON]: {
    label: 'Acted Upon',
    color: '#4caf50',
    icon: 'CheckCircle',
    allowedTransitions: [],
  },
  [INSIGHT_STATUSES.DISMISSED]: {
    label: 'Dismissed',
    color: '#9e9e9e',
    icon: 'X',
    allowedTransitions: ['reviewed'],
  },
  [INSIGHT_STATUSES.EXPIRED]: {
    label: 'Expired',
    color: '#757575',
    icon: 'Clock',
    allowedTransitions: [],
  },
};

export const REPORT_TYPES = {
  EXECUTIVE_SUMMARY: 'executive_summary',
  COMPETITIVE_LANDSCAPE: 'competitive_landscape',
  MARKET_OVERVIEW: 'market_overview',
  INDUSTRY_ANALYSIS: 'industry_analysis',
  TREND_REPORT: 'trend_report',
  PESTEL_REPORT: 'pestel_report',
  STRATEGIC_BRIEF: 'strategic_brief',
  QUARTERLY_INTELLIGENCE: 'quarterly_intelligence',
  CUSTOM: 'custom',
} as const;

export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES];

export const REPORT_TYPE_CONFIG: Record<
  ReportType,
  {
    label: string;
    description: string;
    icon: string;
    defaultSections: string[];
    estimatedPages: number;
  }
> = {
  [REPORT_TYPES.EXECUTIVE_SUMMARY]: {
    label: 'Executive Summary',
    description: 'High-level overview for leadership',
    icon: 'FileText',
    defaultSections: ['key_insights', 'recommendations', 'action_items'],
    estimatedPages: 2,
  },
  [REPORT_TYPES.COMPETITIVE_LANDSCAPE]: {
    label: 'Competitive Landscape',
    description: 'Competitor positioning and analysis',
    icon: 'Users',
    defaultSections: ['competitor_overview', 'swot_summary', 'benchmarking', 'competitive_threats'],
    estimatedPages: 8,
  },
  [REPORT_TYPES.MARKET_OVERVIEW]: {
    label: 'Market Overview',
    description: 'Market size, trends, and dynamics',
    icon: 'BarChart',
    defaultSections: ['market_sizing', 'key_trends', 'growth_drivers', 'market_segments'],
    estimatedPages: 10,
  },
  [REPORT_TYPES.INDUSTRY_ANALYSIS]: {
    label: 'Industry Analysis',
    description: 'Industry forces and dynamics',
    icon: 'Layers',
    defaultSections: ['porters_forces', 'value_chain', 'industry_trends', 'key_players'],
    estimatedPages: 12,
  },
  [REPORT_TYPES.TREND_REPORT]: {
    label: 'Trend Report',
    description: 'Emerging trends and implications',
    icon: 'TrendingUp',
    defaultSections: ['trend_overview', 'trend_analysis', 'implications', 'recommendations'],
    estimatedPages: 6,
  },
  [REPORT_TYPES.PESTEL_REPORT]: {
    label: 'PESTEL Report',
    description: 'Macro-environment analysis',
    icon: 'Globe',
    defaultSections: ['political', 'economic', 'social', 'technological', 'environmental', 'legal'],
    estimatedPages: 15,
  },
  [REPORT_TYPES.STRATEGIC_BRIEF]: {
    label: 'Strategic Brief',
    description: 'Strategic recommendations with evidence',
    icon: 'Target',
    defaultSections: ['situation', 'analysis', 'options', 'recommendation'],
    estimatedPages: 5,
  },
  [REPORT_TYPES.QUARTERLY_INTELLIGENCE]: {
    label: 'Quarterly Intelligence',
    description: 'Comprehensive quarterly review',
    icon: 'Calendar',
    defaultSections: ['executive_summary', 'market_update', 'competitive_update', 'regulatory_update', 'outlook'],
    estimatedPages: 25,
  },
  [REPORT_TYPES.CUSTOM]: {
    label: 'Custom Report',
    description: 'User-defined report structure',
    icon: 'Settings',
    defaultSections: [],
    estimatedPages: 0,
  },
};

export const REPORT_STATUSES = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;

export type ReportStatus = typeof REPORT_STATUSES[keyof typeof REPORT_STATUSES];

export const REPORT_STATUS_CONFIG: Record<
  ReportStatus,
  {
    label: string;
    color: string;
    icon: string;
    allowedTransitions: ReportStatus[];
  }
> = {
  [REPORT_STATUSES.DRAFT]: {
    label: 'Draft',
    color: '#9e9e9e',
    icon: 'Edit',
    allowedTransitions: ['in_review'],
  },
  [REPORT_STATUSES.IN_REVIEW]: {
    label: 'In Review',
    color: '#ff9800',
    icon: 'Eye',
    allowedTransitions: ['draft', 'approved'],
  },
  [REPORT_STATUSES.APPROVED]: {
    label: 'Approved',
    color: '#4caf50',
    icon: 'CheckCircle',
    allowedTransitions: ['published'],
  },
  [REPORT_STATUSES.PUBLISHED]: {
    label: 'Published',
    color: '#2196f3',
    icon: 'Globe',
    allowedTransitions: ['archived'],
  },
  [REPORT_STATUSES.ARCHIVED]: {
    label: 'Archived',
    color: '#757575',
    icon: 'Archive',
    allowedTransitions: [],
  },
};

export const WIDGET_TYPES = {
  KEY_METRICS: 'key_metrics',
  INSIGHTS_FEED: 'insights_feed',
  COMPETITIVE_RADAR: 'competitive_radar',
  TREND_CHART: 'trend_chart',
  PESTEL_SUMMARY: 'pestel_summary',
  MARKET_SIZING: 'market_sizing',
  EARLY_WARNING: 'early_warning',
  SCENARIO_STATUS: 'scenario_status',
  REGULATORY_ALERTS: 'regulatory_alerts',
  REPORT_STATUS: 'report_status',
  DATA_FRESHNESS: 'data_freshness',
  ACTION_ITEMS: 'action_items',
} as const;

export type WidgetType = typeof WIDGET_TYPES[keyof typeof WIDGET_TYPES];

export const WIDGET_TYPE_CONFIG: Record<
  WidgetType,
  {
    label: string;
    description: string;
    icon: string;
    defaultSize: { width: number; height: number };
    refreshInterval: number;
    requiredDataSources: DataSource[];
  }
> = {
  [WIDGET_TYPES.KEY_METRICS]: {
    label: 'Key Metrics',
    description: 'Summary of key performance indicators',
    icon: 'BarChart2',
    defaultSize: { width: 4, height: 2 },
    refreshInterval: 60,
    requiredDataSources: ['competitor_analysis', 'market_research'],
  },
  [WIDGET_TYPES.INSIGHTS_FEED]: {
    label: 'Insights Feed',
    description: 'Real-time intelligence insights stream',
    icon: 'Rss',
    defaultSize: { width: 4, height: 4 },
    refreshInterval: 15,
    requiredDataSources: ['competitor_analysis', 'market_research', 'environment_scanning'],
  },
  [WIDGET_TYPES.COMPETITIVE_RADAR]: {
    label: 'Competitive Radar',
    description: 'Competitor positioning visualization',
    icon: 'Target',
    defaultSize: { width: 6, height: 4 },
    refreshInterval: 720,
    requiredDataSources: ['competitor_analysis'],
  },
  [WIDGET_TYPES.TREND_CHART]: {
    label: 'Trend Chart',
    description: 'Market trends over time',
    icon: 'TrendingUp',
    defaultSize: { width: 6, height: 3 },
    refreshInterval: 360,
    requiredDataSources: ['market_research'],
  },
  [WIDGET_TYPES.PESTEL_SUMMARY]: {
    label: 'PESTEL Summary',
    description: 'Macro-environment factor overview',
    icon: 'Globe',
    defaultSize: { width: 6, height: 4 },
    refreshInterval: 1440,
    requiredDataSources: ['environment_scanning'],
  },
  [WIDGET_TYPES.MARKET_SIZING]: {
    label: 'Market Sizing',
    description: 'TAM/SAM/SOM visualization',
    icon: 'PieChart',
    defaultSize: { width: 4, height: 3 },
    refreshInterval: 720,
    requiredDataSources: ['market_research'],
  },
  [WIDGET_TYPES.EARLY_WARNING]: {
    label: 'Early Warning',
    description: 'Active alerts and warnings',
    icon: 'AlertTriangle',
    defaultSize: { width: 4, height: 3 },
    refreshInterval: 30,
    requiredDataSources: ['environment_scanning'],
  },
  [WIDGET_TYPES.SCENARIO_STATUS]: {
    label: 'Scenario Status',
    description: 'Scenario signpost monitoring',
    icon: 'Flag',
    defaultSize: { width: 4, height: 3 },
    refreshInterval: 60,
    requiredDataSources: ['environment_scanning'],
  },
  [WIDGET_TYPES.REGULATORY_ALERTS]: {
    label: 'Regulatory Alerts',
    description: 'Upcoming regulatory deadlines',
    icon: 'Scale',
    defaultSize: { width: 4, height: 2 },
    refreshInterval: 360,
    requiredDataSources: ['environment_scanning'],
  },
  [WIDGET_TYPES.REPORT_STATUS]: {
    label: 'Report Status',
    description: 'Intelligence report workflow status',
    icon: 'FileText',
    defaultSize: { width: 4, height: 2 },
    refreshInterval: 60,
    requiredDataSources: [],
  },
  [WIDGET_TYPES.DATA_FRESHNESS]: {
    label: 'Data Freshness',
    description: 'Data source update status',
    icon: 'RefreshCw',
    defaultSize: { width: 4, height: 2 },
    refreshInterval: 15,
    requiredDataSources: [],
  },
  [WIDGET_TYPES.ACTION_ITEMS]: {
    label: 'Action Items',
    description: 'Pending intelligence actions',
    icon: 'CheckSquare',
    defaultSize: { width: 4, height: 3 },
    refreshInterval: 30,
    requiredDataSources: [],
  },
};

export const METRIC_TYPES = {
  COMPETITOR_COUNT: 'competitor_count',
  MARKET_SIZE: 'market_size',
  MARKET_GROWTH: 'market_growth',
  TREND_COUNT: 'trend_count',
  ACTIVE_SIGNALS: 'active_signals',
  REGULATORY_ITEMS: 'regulatory_items',
  INSIGHT_COUNT: 'insight_count',
  ACTION_ITEMS: 'action_items',
  DATA_FRESHNESS: 'data_freshness',
  SCENARIO_PROBABILITY: 'scenario_probability',
} as const;

export type MetricType = typeof METRIC_TYPES[keyof typeof METRIC_TYPES];

export const METRIC_TYPE_CONFIG: Record<
  MetricType,
  {
    label: string;
    description: string;
    unit: string;
    format: 'number' | 'currency' | 'percentage' | 'days';
    dataSource: DataSource;
    aggregation: 'sum' | 'count' | 'average' | 'latest';
  }
> = {
  [METRIC_TYPES.COMPETITOR_COUNT]: {
    label: 'Active Competitors',
    description: 'Number of tracked competitors',
    unit: '',
    format: 'number',
    dataSource: 'competitor_analysis',
    aggregation: 'count',
  },
  [METRIC_TYPES.MARKET_SIZE]: {
    label: 'Market Size (TAM)',
    description: 'Total addressable market',
    unit: 'USD',
    format: 'currency',
    dataSource: 'market_research',
    aggregation: 'latest',
  },
  [METRIC_TYPES.MARKET_GROWTH]: {
    label: 'Market Growth Rate',
    description: 'Year-over-year market growth',
    unit: '%',
    format: 'percentage',
    dataSource: 'market_research',
    aggregation: 'latest',
  },
  [METRIC_TYPES.TREND_COUNT]: {
    label: 'Active Trends',
    description: 'Number of tracked trends',
    unit: '',
    format: 'number',
    dataSource: 'market_research',
    aggregation: 'count',
  },
  [METRIC_TYPES.ACTIVE_SIGNALS]: {
    label: 'Active Signals',
    description: 'Unresolved environment signals',
    unit: '',
    format: 'number',
    dataSource: 'environment_scanning',
    aggregation: 'count',
  },
  [METRIC_TYPES.REGULATORY_ITEMS]: {
    label: 'Regulatory Items',
    description: 'Tracked regulatory changes',
    unit: '',
    format: 'number',
    dataSource: 'environment_scanning',
    aggregation: 'count',
  },
  [METRIC_TYPES.INSIGHT_COUNT]: {
    label: 'New Insights',
    description: 'Unreviewed intelligence insights',
    unit: '',
    format: 'number',
    dataSource: 'internal_data',
    aggregation: 'count',
  },
  [METRIC_TYPES.ACTION_ITEMS]: {
    label: 'Pending Actions',
    description: 'Outstanding action items',
    unit: '',
    format: 'number',
    dataSource: 'internal_data',
    aggregation: 'count',
  },
  [METRIC_TYPES.DATA_FRESHNESS]: {
    label: 'Data Freshness',
    description: 'Average data age',
    unit: 'days',
    format: 'days',
    dataSource: 'internal_data',
    aggregation: 'average',
  },
  [METRIC_TYPES.SCENARIO_PROBABILITY]: {
    label: 'Scenario Probability',
    description: 'Average scenario probability',
    unit: '%',
    format: 'percentage',
    dataSource: 'environment_scanning',
    aggregation: 'average',
  },
};

export const VISUALIZATION_TYPES = {
  LINE_CHART: 'line_chart',
  BAR_CHART: 'bar_chart',
  PIE_CHART: 'pie_chart',
  RADAR_CHART: 'radar_chart',
  HEATMAP: 'heatmap',
  SCATTER_PLOT: 'scatter_plot',
  TREEMAP: 'treemap',
  FUNNEL: 'funnel',
  TIMELINE: 'timeline',
  MAP: 'map',
  MATRIX: 'matrix',
  BUBBLE: 'bubble',
} as const;

export type VisualizationType = typeof VISUALIZATION_TYPES[keyof typeof VISUALIZATION_TYPES];

export const VISUALIZATION_TYPE_CONFIG: Record<
  VisualizationType,
  {
    label: string;
    description: string;
    icon: string;
    recommendedFor: string[];
  }
> = {
  [VISUALIZATION_TYPES.LINE_CHART]: {
    label: 'Line Chart',
    description: 'Trend over time',
    icon: 'TrendingUp',
    recommendedFor: ['trends', 'time_series', 'growth'],
  },
  [VISUALIZATION_TYPES.BAR_CHART]: {
    label: 'Bar Chart',
    description: 'Categorical comparison',
    icon: 'BarChart2',
    recommendedFor: ['comparison', 'ranking', 'categories'],
  },
  [VISUALIZATION_TYPES.PIE_CHART]: {
    label: 'Pie Chart',
    description: 'Proportional breakdown',
    icon: 'PieChart',
    recommendedFor: ['market_share', 'composition', 'breakdown'],
  },
  [VISUALIZATION_TYPES.RADAR_CHART]: {
    label: 'Radar Chart',
    description: 'Multi-dimensional comparison',
    icon: 'Target',
    recommendedFor: ['competitive_analysis', 'benchmarking', 'profiles'],
  },
  [VISUALIZATION_TYPES.HEATMAP]: {
    label: 'Heatmap',
    description: 'Intensity matrix',
    icon: 'Grid',
    recommendedFor: ['correlation', 'impact', 'priority'],
  },
  [VISUALIZATION_TYPES.SCATTER_PLOT]: {
    label: 'Scatter Plot',
    description: 'Relationship between variables',
    icon: 'Circle',
    recommendedFor: ['correlation', 'positioning', 'clustering'],
  },
  [VISUALIZATION_TYPES.TREEMAP]: {
    label: 'Treemap',
    description: 'Hierarchical proportions',
    icon: 'Square',
    recommendedFor: ['hierarchy', 'size_comparison', 'segmentation'],
  },
  [VISUALIZATION_TYPES.FUNNEL]: {
    label: 'Funnel',
    description: 'Sequential stages',
    icon: 'Filter',
    recommendedFor: ['pipeline', 'conversion', 'stages'],
  },
  [VISUALIZATION_TYPES.TIMELINE]: {
    label: 'Timeline',
    description: 'Events over time',
    icon: 'Clock',
    recommendedFor: ['events', 'milestones', 'history'],
  },
  [VISUALIZATION_TYPES.MAP]: {
    label: 'Map',
    description: 'Geographic distribution',
    icon: 'Map',
    recommendedFor: ['geographic', 'regional', 'location'],
  },
  [VISUALIZATION_TYPES.MATRIX]: {
    label: 'Matrix',
    description: 'Two-dimensional analysis',
    icon: 'Layout',
    recommendedFor: ['quadrant', 'priority_matrix', 'swot'],
  },
  [VISUALIZATION_TYPES.BUBBLE]: {
    label: 'Bubble Chart',
    description: 'Three-dimensional comparison',
    icon: 'Circle',
    recommendedFor: ['positioning', 'comparison', 'market_map'],
  },
};

export const ACTION_ITEM_TYPES = {
  RESEARCH: 'research',
  ANALYSIS: 'analysis',
  MONITOR: 'monitor',
  REPORT: 'report',
  STRATEGY: 'strategy',
  COMMUNICATION: 'communication',
  DECISION: 'decision',
} as const;

export type ActionItemType = typeof ACTION_ITEM_TYPES[keyof typeof ACTION_ITEM_TYPES];

export const ACTION_ITEM_TYPE_CONFIG: Record<
  ActionItemType,
  {
    label: string;
    description: string;
    icon: string;
    color: string;
    defaultDueDays: number;
  }
> = {
  [ACTION_ITEM_TYPES.RESEARCH]: {
    label: 'Research',
    description: 'Conduct additional research',
    icon: 'Search',
    color: '#2196f3',
    defaultDueDays: 7,
  },
  [ACTION_ITEM_TYPES.ANALYSIS]: {
    label: 'Analysis',
    description: 'Perform deeper analysis',
    icon: 'BarChart',
    color: '#9c27b0',
    defaultDueDays: 5,
  },
  [ACTION_ITEM_TYPES.MONITOR]: {
    label: 'Monitor',
    description: 'Set up ongoing monitoring',
    icon: 'Eye',
    color: '#00bcd4',
    defaultDueDays: 3,
  },
  [ACTION_ITEM_TYPES.REPORT]: {
    label: 'Report',
    description: 'Create or update report',
    icon: 'FileText',
    color: '#ff9800',
    defaultDueDays: 14,
  },
  [ACTION_ITEM_TYPES.STRATEGY]: {
    label: 'Strategy',
    description: 'Develop strategic response',
    icon: 'Target',
    color: '#4caf50',
    defaultDueDays: 21,
  },
  [ACTION_ITEM_TYPES.COMMUNICATION]: {
    label: 'Communication',
    description: 'Share with stakeholders',
    icon: 'MessageSquare',
    color: '#3f51b5',
    defaultDueDays: 3,
  },
  [ACTION_ITEM_TYPES.DECISION]: {
    label: 'Decision',
    description: 'Make decision based on insight',
    icon: 'CheckCircle',
    color: '#f44336',
    defaultDueDays: 7,
  },
};

export const ACTION_ITEM_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type ActionItemStatus = typeof ACTION_ITEM_STATUSES[keyof typeof ACTION_ITEM_STATUSES];

export const ACTION_ITEM_STATUS_CONFIG: Record<
  ActionItemStatus,
  {
    label: string;
    color: string;
    icon: string;
    allowedTransitions: ActionItemStatus[];
  }
> = {
  [ACTION_ITEM_STATUSES.TODO]: {
    label: 'To Do',
    color: '#9e9e9e',
    icon: 'Circle',
    allowedTransitions: ['in_progress', 'cancelled'],
  },
  [ACTION_ITEM_STATUSES.IN_PROGRESS]: {
    label: 'In Progress',
    color: '#2196f3',
    icon: 'Clock',
    allowedTransitions: ['completed', 'blocked', 'cancelled'],
  },
  [ACTION_ITEM_STATUSES.BLOCKED]: {
    label: 'Blocked',
    color: '#f44336',
    icon: 'AlertCircle',
    allowedTransitions: ['in_progress', 'cancelled'],
  },
  [ACTION_ITEM_STATUSES.COMPLETED]: {
    label: 'Completed',
    color: '#4caf50',
    icon: 'CheckCircle',
    allowedTransitions: [],
  },
  [ACTION_ITEM_STATUSES.CANCELLED]: {
    label: 'Cancelled',
    color: '#757575',
    icon: 'X',
    allowedTransitions: [],
  },
};

export const REPORT_SECTIONS = {
  EXECUTIVE_SUMMARY: 'executive_summary',
  KEY_INSIGHTS: 'key_insights',
  RECOMMENDATIONS: 'recommendations',
  ACTION_ITEMS: 'action_items',
  COMPETITOR_OVERVIEW: 'competitor_overview',
  SWOT_SUMMARY: 'swot_summary',
  BENCHMARKING: 'benchmarking',
  COMPETITIVE_THREATS: 'competitive_threats',
  MARKET_SIZING: 'market_sizing',
  KEY_TRENDS: 'key_trends',
  GROWTH_DRIVERS: 'growth_drivers',
  MARKET_SEGMENTS: 'market_segments',
  PORTERS_FORCES: 'porters_forces',
  VALUE_CHAIN: 'value_chain',
  INDUSTRY_TRENDS: 'industry_trends',
  KEY_PLAYERS: 'key_players',
  TREND_OVERVIEW: 'trend_overview',
  TREND_ANALYSIS: 'trend_analysis',
  IMPLICATIONS: 'implications',
  POLITICAL: 'political',
  ECONOMIC: 'economic',
  SOCIAL: 'social',
  TECHNOLOGICAL: 'technological',
  ENVIRONMENTAL: 'environmental',
  LEGAL: 'legal',
  SITUATION: 'situation',
  ANALYSIS: 'analysis',
  OPTIONS: 'options',
  RECOMMENDATION: 'recommendation',
  MARKET_UPDATE: 'market_update',
  COMPETITIVE_UPDATE: 'competitive_update',
  REGULATORY_UPDATE: 'regulatory_update',
  OUTLOOK: 'outlook',
} as const;

export type ReportSection = typeof REPORT_SECTIONS[keyof typeof REPORT_SECTIONS];

export const REPORT_SECTION_CONFIG: Record<
  ReportSection,
  {
    label: string;
    description: string;
    dataSources: DataSource[];
    templateContent: string;
  }
> = {
  [REPORT_SECTIONS.EXECUTIVE_SUMMARY]: {
    label: 'Executive Summary',
    description: 'High-level overview for leadership',
    dataSources: ['competitor_analysis', 'market_research', 'environment_scanning'],
    templateContent: 'Overview of key findings and strategic implications...',
  },
  [REPORT_SECTIONS.KEY_INSIGHTS]: {
    label: 'Key Insights',
    description: 'Most important intelligence findings',
    dataSources: ['competitor_analysis', 'market_research', 'environment_scanning'],
    templateContent: 'Critical insights requiring attention...',
  },
  [REPORT_SECTIONS.RECOMMENDATIONS]: {
    label: 'Recommendations',
    description: 'Strategic recommendations',
    dataSources: [],
    templateContent: 'Recommended actions based on analysis...',
  },
  [REPORT_SECTIONS.ACTION_ITEMS]: {
    label: 'Action Items',
    description: 'Specific next steps',
    dataSources: [],
    templateContent: 'Prioritized action items with owners and deadlines...',
  },
  [REPORT_SECTIONS.COMPETITOR_OVERVIEW]: {
    label: 'Competitor Overview',
    description: 'Summary of competitive landscape',
    dataSources: ['competitor_analysis'],
    templateContent: 'Overview of key competitors and their positioning...',
  },
  [REPORT_SECTIONS.SWOT_SUMMARY]: {
    label: 'SWOT Summary',
    description: 'Consolidated SWOT analysis',
    dataSources: ['competitor_analysis'],
    templateContent: 'Strengths, weaknesses, opportunities, and threats...',
  },
  [REPORT_SECTIONS.BENCHMARKING]: {
    label: 'Benchmarking',
    description: 'Performance comparison',
    dataSources: ['competitor_analysis'],
    templateContent: 'Competitive benchmarking across key dimensions...',
  },
  [REPORT_SECTIONS.COMPETITIVE_THREATS]: {
    label: 'Competitive Threats',
    description: 'Threats from competitors',
    dataSources: ['competitor_analysis'],
    templateContent: 'Assessment of competitive threats and responses...',
  },
  [REPORT_SECTIONS.MARKET_SIZING]: {
    label: 'Market Sizing',
    description: 'TAM/SAM/SOM analysis',
    dataSources: ['market_research'],
    templateContent: 'Market size estimation and segmentation...',
  },
  [REPORT_SECTIONS.KEY_TRENDS]: {
    label: 'Key Trends',
    description: 'Important market trends',
    dataSources: ['market_research'],
    templateContent: 'Emerging trends shaping the market...',
  },
  [REPORT_SECTIONS.GROWTH_DRIVERS]: {
    label: 'Growth Drivers',
    description: 'Factors driving market growth',
    dataSources: ['market_research'],
    templateContent: 'Key drivers and inhibitors of market growth...',
  },
  [REPORT_SECTIONS.MARKET_SEGMENTS]: {
    label: 'Market Segments',
    description: 'Market segmentation analysis',
    dataSources: ['market_research'],
    templateContent: 'Analysis of market segments and dynamics...',
  },
  [REPORT_SECTIONS.PORTERS_FORCES]: {
    label: "Porter's Five Forces",
    description: 'Industry forces analysis',
    dataSources: ['market_research'],
    templateContent: 'Analysis of competitive forces in the industry...',
  },
  [REPORT_SECTIONS.VALUE_CHAIN]: {
    label: 'Value Chain',
    description: 'Industry value chain analysis',
    dataSources: ['market_research'],
    templateContent: 'Value chain structure and profit pools...',
  },
  [REPORT_SECTIONS.INDUSTRY_TRENDS]: {
    label: 'Industry Trends',
    description: 'Industry-level trends',
    dataSources: ['market_research', 'environment_scanning'],
    templateContent: 'Key trends affecting the industry...',
  },
  [REPORT_SECTIONS.KEY_PLAYERS]: {
    label: 'Key Players',
    description: 'Major industry participants',
    dataSources: ['competitor_analysis'],
    templateContent: 'Overview of key industry players...',
  },
  [REPORT_SECTIONS.TREND_OVERVIEW]: {
    label: 'Trend Overview',
    description: 'Summary of trends',
    dataSources: ['market_research'],
    templateContent: 'Overview of identified trends...',
  },
  [REPORT_SECTIONS.TREND_ANALYSIS]: {
    label: 'Trend Analysis',
    description: 'Deep dive on trends',
    dataSources: ['market_research'],
    templateContent: 'Detailed analysis of significant trends...',
  },
  [REPORT_SECTIONS.IMPLICATIONS]: {
    label: 'Implications',
    description: 'Strategic implications',
    dataSources: [],
    templateContent: 'Implications for strategy and operations...',
  },
  [REPORT_SECTIONS.POLITICAL]: {
    label: 'Political Factors',
    description: 'Political environment analysis',
    dataSources: ['environment_scanning'],
    templateContent: 'Political factors affecting the business...',
  },
  [REPORT_SECTIONS.ECONOMIC]: {
    label: 'Economic Factors',
    description: 'Economic environment analysis',
    dataSources: ['environment_scanning'],
    templateContent: 'Economic factors and outlook...',
  },
  [REPORT_SECTIONS.SOCIAL]: {
    label: 'Social Factors',
    description: 'Social environment analysis',
    dataSources: ['environment_scanning'],
    templateContent: 'Social and demographic trends...',
  },
  [REPORT_SECTIONS.TECHNOLOGICAL]: {
    label: 'Technological Factors',
    description: 'Technological environment analysis',
    dataSources: ['environment_scanning'],
    templateContent: 'Technology trends and disruption...',
  },
  [REPORT_SECTIONS.ENVIRONMENTAL]: {
    label: 'Environmental Factors',
    description: 'Environmental considerations',
    dataSources: ['environment_scanning'],
    templateContent: 'Environmental factors and sustainability...',
  },
  [REPORT_SECTIONS.LEGAL]: {
    label: 'Legal Factors',
    description: 'Legal and regulatory environment',
    dataSources: ['environment_scanning'],
    templateContent: 'Legal and regulatory considerations...',
  },
  [REPORT_SECTIONS.SITUATION]: {
    label: 'Situation',
    description: 'Current situation assessment',
    dataSources: ['competitor_analysis', 'market_research', 'environment_scanning'],
    templateContent: 'Assessment of the current situation...',
  },
  [REPORT_SECTIONS.ANALYSIS]: {
    label: 'Analysis',
    description: 'Detailed analysis',
    dataSources: ['competitor_analysis', 'market_research', 'environment_scanning'],
    templateContent: 'In-depth analysis of key factors...',
  },
  [REPORT_SECTIONS.OPTIONS]: {
    label: 'Options',
    description: 'Strategic options',
    dataSources: [],
    templateContent: 'Evaluation of strategic options...',
  },
  [REPORT_SECTIONS.RECOMMENDATION]: {
    label: 'Recommendation',
    description: 'Final recommendation',
    dataSources: [],
    templateContent: 'Recommended course of action...',
  },
  [REPORT_SECTIONS.MARKET_UPDATE]: {
    label: 'Market Update',
    description: 'Quarterly market update',
    dataSources: ['market_research'],
    templateContent: 'Key market developments this quarter...',
  },
  [REPORT_SECTIONS.COMPETITIVE_UPDATE]: {
    label: 'Competitive Update',
    description: 'Quarterly competitive update',
    dataSources: ['competitor_analysis'],
    templateContent: 'Competitor activities this quarter...',
  },
  [REPORT_SECTIONS.REGULATORY_UPDATE]: {
    label: 'Regulatory Update',
    description: 'Quarterly regulatory update',
    dataSources: ['environment_scanning'],
    templateContent: 'Regulatory changes and compliance status...',
  },
  [REPORT_SECTIONS.OUTLOOK]: {
    label: 'Outlook',
    description: 'Forward-looking outlook',
    dataSources: ['competitor_analysis', 'market_research', 'environment_scanning'],
    templateContent: 'Outlook for the coming period...',
  },
};

export const SCHEDULE_FREQUENCIES = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ON_DEMAND: 'on_demand',
} as const;

export type ScheduleFrequency = typeof SCHEDULE_FREQUENCIES[keyof typeof SCHEDULE_FREQUENCIES];

export const SCHEDULE_FREQUENCY_CONFIG: Record<
  ScheduleFrequency,
  {
    label: string;
    description: string;
    cronExpression: string;
    intervalDays: number;
  }
> = {
  [SCHEDULE_FREQUENCIES.DAILY]: {
    label: 'Daily',
    description: 'Every day at 6:00 AM',
    cronExpression: '0 6 * * *',
    intervalDays: 1,
  },
  [SCHEDULE_FREQUENCIES.WEEKLY]: {
    label: 'Weekly',
    description: 'Every Monday at 6:00 AM',
    cronExpression: '0 6 * * 1',
    intervalDays: 7,
  },
  [SCHEDULE_FREQUENCIES.BIWEEKLY]: {
    label: 'Bi-weekly',
    description: 'Every other Monday at 6:00 AM',
    cronExpression: '0 6 * * 1/2',
    intervalDays: 14,
  },
  [SCHEDULE_FREQUENCIES.MONTHLY]: {
    label: 'Monthly',
    description: 'First Monday of each month at 6:00 AM',
    cronExpression: '0 6 1-7 * 1',
    intervalDays: 30,
  },
  [SCHEDULE_FREQUENCIES.QUARTERLY]: {
    label: 'Quarterly',
    description: 'First Monday of each quarter at 6:00 AM',
    cronExpression: '0 6 1-7 1,4,7,10 1',
    intervalDays: 90,
  },
  [SCHEDULE_FREQUENCIES.ON_DEMAND]: {
    label: 'On Demand',
    description: 'Manual generation only',
    cronExpression: '',
    intervalDays: 0,
  },
};

export const INTELLIGENCE_COLLECTIONS = {
  INSIGHTS: 'market_intelligence_insights',
  REPORTS: 'market_intelligence_reports',
  REPORT_SCHEDULES: 'market_intelligence_report_schedules',
  ACTION_ITEMS: 'market_intelligence_action_items',
  DASHBOARDS: 'market_intelligence_dashboards',
  WIDGETS: 'market_intelligence_widgets',
  DATA_SOURCES: 'market_intelligence_data_sources',
  ANALYTICS: 'market_intelligence_analytics',
} as const;

export const DEFAULT_DASHBOARD_LAYOUT = {
  columns: 12,
  rowHeight: 100,
  defaultWidgets: [
    { type: 'key_metrics', position: { x: 0, y: 0, w: 4, h: 2 } },
    { type: 'early_warning', position: { x: 4, y: 0, w: 4, h: 2 } },
    { type: 'data_freshness', position: { x: 8, y: 0, w: 4, h: 2 } },
    { type: 'insights_feed', position: { x: 0, y: 2, w: 4, h: 4 } },
    { type: 'competitive_radar', position: { x: 4, y: 2, w: 4, h: 4 } },
    { type: 'trend_chart', position: { x: 8, y: 2, w: 4, h: 4 } },
    { type: 'action_items', position: { x: 0, y: 6, w: 6, h: 3 } },
    { type: 'report_status', position: { x: 6, y: 6, w: 6, h: 3 } },
  ],
} as const;

export const UGANDA_CONTEXT = {
  currency: 'UGX',
  timezone: 'Africa/Kampala',
  fiscalYearStart: 7,
  keyIndustries: [
    'Agriculture',
    'Construction',
    'Financial Services',
    'Manufacturing',
    'Oil & Gas',
    'Real Estate',
    'Telecommunications',
    'Tourism',
    'Healthcare',
    'Education',
  ],
  majorCompetitors: {
    construction: ['China Wu Yi', 'Roko Construction', 'CHICO', 'Seyani Brothers'],
    banking: ['Stanbic Bank', 'Centenary Bank', 'DFCU Bank', 'Absa Uganda'],
    telecom: ['MTN Uganda', 'Airtel Uganda', 'Uganda Telecom'],
  },
  regulatoryBodies: {
    finance: 'Bank of Uganda',
    tax: 'Uganda Revenue Authority',
    securities: 'Capital Markets Authority',
    environment: 'NEMA',
    construction: 'UNRA',
  },
} as const;
