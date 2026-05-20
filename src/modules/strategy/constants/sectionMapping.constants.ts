// ============================================================================
// SECTION MAPPING CONSTANTS - Strategy Plan Update Tool
// Keywords for section type classification, data source mappings, and scoring
// ============================================================================

import type { SectionType } from '../types/documentSection.types';

// ----------------------------------------------------------------------------
// Section Type Keywords
// Used by the section parser to classify sections by heading + content
// ----------------------------------------------------------------------------

export const SECTION_TYPE_KEYWORDS: Record<SectionType, string[]> = {
  financial: [
    'financial', 'revenue', 'budget', 'cash', 'profit', 'margin', 'cost',
    'expenditure', 'funding', 'ebitda', 'p&l', 'income', 'expense',
    'investment', 'capital', 'roi', 'balance sheet', 'cash flow',
  ],
  market: [
    'market', 'competitive', 'competitor', 'industry', 'segment',
    'positioning', 'share', 'trends', 'demand', 'customer',
    'target audience', 'market size', 'market analysis',
  ],
  operations: [
    'operations', 'production', 'manufacturing', 'supply chain',
    'capacity', 'inventory', 'logistics', 'process', 'efficiency',
    'quality', 'delivery', 'procurement', 'warehouse',
  ],
  growth: [
    'growth', 'expansion', 'pipeline', 'sales', 'revenue target',
    'new market', 'acquisition', 'scaling', 'strategy', 'roadmap',
    'milestone', 'implementation',
  ],
  risk: [
    'risk', 'threat', 'mitigation', 'contingency', 'compliance',
    'exposure', 'vulnerability', 'challenge', 'barrier', 'obstacle',
  ],
  people: [
    'people', 'talent', 'team', 'hiring', 'retention', 'culture',
    'training', 'workforce', 'hr', 'headcount', 'employee',
    'human resource', 'staff', 'leadership',
  ],
  governance: [
    'governance', 'board', 'approval', 'policy', 'regulation',
    'oversight', 'audit', 'compliance', 'legal', 'framework',
  ],
  general: [],
};

// ----------------------------------------------------------------------------
// Default Data Source Mapping per Section Type
// Maps section types to DawinOS MCP tools for data retrieval
// ----------------------------------------------------------------------------

export const DEFAULT_DATA_SOURCE_MAPPING: Record<SectionType, string[]> = {
  financial: [
    'cfo_briefing',
    'expenditure_queue',
    'quote_pipeline_analysis',
    'po_spend_analysis',
    'run_cash_flow_scenario',
  ],
  market: [
    'market_intelligence',
    'strategy_research',
    'procurement_advisor',
  ],
  operations: [
    'production_summary',
    'stock_levels',
    'material_demand_forecast',
    'list_manufacturing_orders',
  ],
  growth: [
    'quote_pipeline_analysis',
    'list_project_funds',
    'list_quotes',
  ],
  risk: [
    'cfo_briefing',
    'expenditure_queue',
    'cross_module_query',
  ],
  people: [
    'cross_module_query',
  ],
  governance: [
    'get_memory_context',
  ],
  general: [
    'assistant_chat',
  ],
};

// ----------------------------------------------------------------------------
// Alignment Score Labels
// Scale: 1–5
// ----------------------------------------------------------------------------

export const ALIGNMENT_SCORE_LABELS: Record<number, { label: string; description: string }> = {
  5: { label: 'Fully Aligned', description: 'Fully aligned with current business data' },
  4: { label: 'Mostly Aligned', description: 'Mostly aligned, minor updates needed' },
  3: { label: 'Partially Aligned', description: 'Partially aligned, significant gaps exist' },
  2: { label: 'Largely Outdated', description: 'Largely outdated, major rewrite needed' },
  1: { label: 'Misaligned', description: 'Completely misaligned with current reality' },
};

// ----------------------------------------------------------------------------
// Defaults
// ----------------------------------------------------------------------------

export const SECTION_DEFAULTS = {
  REWRITE_THRESHOLD: 3,
  AUTO_APPLY_REWRITES: false,
  MAX_SECTIONS: 50,
} as const;
