// ============================================================================
// INTELLIGENCE LAYER CONSTANTS
// ZeusOS v2.0 - Cross-Module AI Intelligence
// Configuration and theme constants
// ============================================================================

// Module theme color
export const MODULE_COLOR = '#9C27B0';
export const MODULE_COLOR_LIGHT = '#E1BEE7';
export const MODULE_COLOR_DARK = '#7B1FA2';

// AI Model configurations
export const AI_MODELS = [
  {
    id: 'gemini-pro',
    label: 'Gemini Pro',
    description: 'Best for complex reasoning and analysis',
    maxTokens: 8192,
    capabilities: ['reasoning', 'analysis', 'generation', 'extraction'],
  },
  {
    id: 'gemini-1.5-flash',
    label: 'Gemini Flash',
    description: 'Fast responses for simple tasks',
    maxTokens: 4096,
    capabilities: ['generation', 'extraction', 'summarization'],
  },
] as const;

export type AIModelId = typeof AI_MODELS[number]['id'];

// Intelligence feature types
export const INTELLIGENCE_FEATURES = [
  {
    id: 'smart_suggestions',
    label: 'Smart Suggestions',
    description: 'AI-powered task and action recommendations',
    icon: 'lightbulb',
    color: '#FF9800',
  },
  {
    id: 'anomaly_detection',
    label: 'Anomaly Detection',
    description: 'Automatic identification of unusual patterns',
    icon: 'warning',
    color: '#F44336',
  },
  {
    id: 'predictive_analytics',
    label: 'Predictive Analytics',
    description: 'Forecast trends and outcomes',
    icon: 'trending_up',
    color: '#4CAF50',
  },
  {
    id: 'document_intelligence',
    label: 'Document Intelligence',
    description: 'Extract insights from documents',
    icon: 'description',
    color: '#2196F3',
  },
  {
    id: 'natural_language',
    label: 'Natural Language',
    description: 'Query data using natural language',
    icon: 'chat',
    color: '#9C27B0',
  },
  {
    id: 'auto_categorization',
    label: 'Auto Categorization',
    description: 'Automatic classification and tagging',
    icon: 'label',
    color: '#00BCD4',
  },
] as const;

export type IntelligenceFeatureId = typeof INTELLIGENCE_FEATURES[number]['id'];

// Suggestion types
export const SUGGESTION_TYPES = [
  { id: 'task', label: 'Task Suggestion', color: '#2196F3', icon: 'assignment' },
  { id: 'approval', label: 'Approval Required', color: '#FF9800', icon: 'approval' },
  { id: 'alert', label: 'Alert', color: '#F44336', icon: 'notification_important' },
  { id: 'insight', label: 'Insight', color: '#9C27B0', icon: 'lightbulb' },
  { id: 'optimization', label: 'Optimization', color: '#4CAF50', icon: 'speed' },
  { id: 'reminder', label: 'Reminder', color: '#607D8B', icon: 'schedule' },
] as const;

export type SuggestionType = typeof SUGGESTION_TYPES[number]['id'];

// Anomaly severity levels
export const ANOMALY_SEVERITY = [
  { id: 'critical', label: 'Critical', color: '#D32F2F', bgColor: '#FFEBEE', priority: 1 },
  { id: 'high', label: 'High', color: '#F44336', bgColor: '#FFEBEE', priority: 2 },
  { id: 'medium', label: 'Medium', color: '#FF9800', bgColor: '#FFF3E0', priority: 3 },
  { id: 'low', label: 'Low', color: '#FFC107', bgColor: '#FFFDE7', priority: 4 },
  { id: 'info', label: 'Info', color: '#2196F3', bgColor: '#E3F2FD', priority: 5 },
] as const;

export type AnomalySeverityId = typeof ANOMALY_SEVERITY[number]['id'];

// Source modules for cross-module intelligence
export const SOURCE_MODULES = [
  // Zeus Group
  { id: 'design_manager', label: 'Design Manager', color: '#3F51B5', icon: 'design_services', subsidiary: 'finishes' },
  { id: 'launch_pipeline', label: 'Launch Pipeline', color: '#9C27B0', icon: 'rocket_launch', subsidiary: 'finishes' },
  { id: 'inventory', label: 'Inventory', color: '#795548', icon: 'inventory_2', subsidiary: 'finishes' },
  { id: 'customer_hub', label: 'Customer Hub', color: '#00BCD4', icon: 'groups', subsidiary: 'finishes' },
  { id: 'feature_library', label: 'Feature Library', color: '#FF9800', icon: 'library_books', subsidiary: 'finishes' },
  { id: 'cutlist', label: 'Cutlist Processor', color: '#607D8B', icon: 'content_cut', subsidiary: 'finishes' },
  
  // Zeus Group
  { id: 'engagements', label: 'Engagements', color: '#009688', icon: 'handshake', subsidiary: 'advisory' },
  { id: 'funding', label: 'Funding Management', color: '#4CAF50', icon: 'payments', subsidiary: 'advisory' },
  { id: 'reporting', label: 'Reporting', color: '#2196F3', icon: 'assessment', subsidiary: 'advisory' },
  { id: 'matflow', label: 'MatFlow', color: '#795548', icon: 'construction', subsidiary: 'advisory' },
  
  // Shared/Cross-Subsidiary
  { id: 'hr_central', label: 'HR Central', color: '#E91E63', icon: 'people', subsidiary: 'shared' },
  { id: 'ceo_strategy', label: 'CEO Strategy', color: '#673AB7', icon: 'business_center', subsidiary: 'shared' },
  { id: 'financial', label: 'Financial Hub', color: '#4CAF50', icon: 'account_balance', subsidiary: 'shared' },
  { id: 'staff_performance', label: 'Staff Performance', color: '#FF5722', icon: 'trending_up', subsidiary: 'shared' },
  { id: 'capital_hub', label: 'Capital Hub', color: '#2196F3', icon: 'monetization_on', subsidiary: 'capital' },
  { id: 'market_intelligence', label: 'Market Intelligence', color: '#FF5722', icon: 'insights', subsidiary: 'shared' },
  { id: 'advisory', label: 'Advisory Platform', color: '#009688', icon: 'support_agent', subsidiary: 'advisory' },
  { id: 'compliance', label: 'Compliance Manager', color: '#8E24AA', icon: 'verified_user', subsidiary: 'corporate' },
] as const;

export type SourceModuleId = typeof SOURCE_MODULES[number]['id'];

// Prediction confidence thresholds
export const CONFIDENCE_THRESHOLDS = {
  high: 0.85,
  medium: 0.65,
  low: 0.4,
};

// AI Assistant conversation modes
export const ASSISTANT_MODES = [
  {
    id: 'cross_module',
    label: 'Cross-Module Intelligence',
    description: 'Query data across all modules with AI',
    systemPrompt: '', // Handled server-side by Claude + Tools
  },
  {
    id: 'general',
    label: 'General Assistant',
    description: 'Help with any question',
    systemPrompt: 'You are a helpful assistant for ZeusOS enterprise platform.',
  },
  {
    id: 'data_analyst',
    label: 'Data Analyst',
    description: 'Analyze business data',
    systemPrompt: 'You are a data analyst helping interpret business metrics and trends.',
  },
  {
    id: 'strategic_advisor',
    label: 'Strategic Advisor',
    description: 'Strategic planning support',
    systemPrompt: 'You are a strategic business advisor providing insights and recommendations.',
  },
  {
    id: 'document_expert',
    label: 'Document Expert',
    description: 'Help with documents',
    systemPrompt: 'You are an expert at analyzing and creating business documents.',
  },
] as const;

export type AssistantModeId = typeof ASSISTANT_MODES[number]['id'];
