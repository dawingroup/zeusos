// src/subsidiaries/advisory/ai/services/domain-handlers.ts

import {
  AgentDomain,
  DomainHandler,
  AgentTool,
} from '../types/agent';
import type { FunctionDeclarationsTool } from '@google/generative-ai';

// Domain-specific system prompts
const DOMAIN_PROMPTS: Record<AgentDomain, string> = {
  infrastructure: `You are helping with infrastructure project management in Uganda.
Focus on:
- Construction progress and milestones for healthcare facilities (AMH projects)
- Interim Payment Certificates (IPCs) and valuations
- Contractor management and site visits
- Budget tracking and expenditure monitoring
- Project documentation and reporting

Key entities: Projects (AMH-XXX), Facilities, Milestones, IPCs, Contractors
Common actions: Check status, generate IPC, update progress, view budget`,

  investment: `You are helping with investment portfolio management.
Focus on:
- Portfolio performance metrics (IRR, MOIC, NAV, AUM)
- Asset allocation and diversification analysis
- Return calculations and benchmarking
- Investment thesis and strategy review
- Risk assessment and monitoring

Key metrics: IRR, MOIC, Multiple, NAV, DPI, RVPI, TVPI
Time periods: MTD, QTD, YTD, 1Y, 3Y, 5Y, Since Inception`,

  advisory: `You are helping with advisory and deal management services.
Focus on:
- M&A transaction support and due diligence
- Capital raising and restructuring mandates
- Client relationship management
- Proposal and pitch preparation
- Deal pipeline and status tracking

Deal stages: Origination, Mandate, Due Diligence, Execution, Closing
Services: M&A, Capital Raising, Restructuring, Valuations`,

  matflow: `You are helping with material procurement and supply chain management for construction projects in Uganda.
Focus on:
- Bill of Quantities (BOQ) management and AI parsing
- Requisition creation and approval workflow
- Purchase order generation and tracking
- Supplier management and quotations
- Delivery tracking and verification
- Budget monitoring and variance analysis

Approval flow: Technical Review → Budget Check → Final Approval
Key entities: Requisitions (REQ-XXX), Purchase Orders (PO-XXX), Suppliers, Materials
Common materials: Cement, steel/rebar, aggregate, sand, timber, tiles, roofing sheets`,

  analytics: `You are helping with cross-platform analytics and reporting.
Focus on:
- Generating comprehensive reports across modules
- Comparing entities and performance metrics
- Trend analysis and forecasting
- KPI dashboards and visualizations
- Data aggregation from multiple sources

Report types: Performance, Comparison, Trend, Summary, Custom`,

  settings: `You are helping with platform configuration and user preferences.
Focus on:
- User profile and preference management
- Notification settings
- Organization configuration
- Access permissions and roles
- System integrations`,

  general: `You are a helpful assistant for the ZeusOS.
Help users navigate the platform and answer general questions.
If a question seems domain-specific, guide them to the appropriate module.`,
};

// Tool definitions by domain
const DOMAIN_TOOLS: Record<AgentDomain, AgentTool[]> = {
  general: [
    {
      name: 'navigateToModule',
      description: 'Navigate the user to a specific platform module',
      domain: 'general',
      functionDeclaration: {
        name: 'navigateToModule',
        description: 'Navigate to a platform module',
        parameters: {
          type: 'object',
          properties: {
            module: {
              type: 'string',
              description: 'The module to navigate to',
              enum: ['infrastructure', 'investment', 'advisory', 'matflow', 'analytics', 'settings'],
            },
          },
          required: ['module'],
        },
      },
      handler: 'handleNavigateToModule',
    },
    {
      name: 'searchPlatform',
      description: 'Search across all platform modules',
      domain: 'general',
      functionDeclaration: {
        name: 'searchPlatform',
        description: 'Search for entities across the platform',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query',
            },
            modules: {
              type: 'array',
              description: 'Modules to search in (optional)',
              items: { type: 'string', description: 'Module name to include in search' },
            },
          },
          required: ['query'],
        },
      },
      handler: 'handleSearchPlatform',
    },
  ],

  infrastructure: [
    {
      name: 'getProjectStatus',
      description: 'Get the current status and key metrics of a project',
      domain: 'infrastructure',
      functionDeclaration: {
        name: 'getProjectStatus',
        description: 'Retrieve project status and metrics',
        parameters: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID (e.g., AMH-001)',
            },
          },
          required: ['projectId'],
        },
      },
      handler: 'handleGetProjectStatus',
    },
    {
      name: 'listMilestones',
      description: 'List milestones for a project',
      domain: 'infrastructure',
      functionDeclaration: {
        name: 'listMilestones',
        description: 'Get project milestones',
        parameters: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            status: {
              type: 'string',
              description: 'Filter by status',
              enum: ['pending', 'in_progress', 'completed', 'delayed'],
            },
          },
          required: ['projectId'],
        },
      },
      handler: 'handleListMilestones',
    },
    {
      name: 'generateIPC',
      description: 'Generate an Interim Payment Certificate',
      domain: 'infrastructure',
      functionDeclaration: {
        name: 'generateIPC',
        description: 'Generate IPC for a project',
        parameters: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            period: {
              type: 'string',
              description: 'Payment period (e.g., "2024-Q1")',
            },
          },
          required: ['projectId', 'period'],
        },
      },
      handler: 'handleGenerateIPC',
    },
  ],

  investment: [
    {
      name: 'getPortfolioSummary',
      description: 'Get portfolio performance summary',
      domain: 'investment',
      functionDeclaration: {
        name: 'getPortfolioSummary',
        description: 'Retrieve portfolio summary and metrics',
        parameters: {
          type: 'object',
          properties: {
            portfolioId: {
              type: 'string',
              description: 'Portfolio ID',
            },
          },
          required: ['portfolioId'],
        },
      },
      handler: 'handleGetPortfolioSummary',
    },
    {
      name: 'analyzeReturns',
      description: 'Analyze investment returns',
      domain: 'investment',
      functionDeclaration: {
        name: 'analyzeReturns',
        description: 'Analyze returns for an investment entity',
        parameters: {
          type: 'object',
          properties: {
            entityId: {
              type: 'string',
              description: 'Entity ID (portfolio, fund, or investment)',
            },
            period: {
              type: 'string',
              description: 'Analysis period',
              enum: ['MTD', 'QTD', 'YTD', '1Y', '3Y', '5Y', 'inception'],
            },
          },
          required: ['entityId'],
        },
      },
      handler: 'handleAnalyzeReturns',
    },
  ],

  advisory: [
    {
      name: 'getDealPipeline',
      description: 'Get advisory deal pipeline',
      domain: 'advisory',
      functionDeclaration: {
        name: 'getDealPipeline',
        description: 'Retrieve deal pipeline',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Filter by deal status',
              enum: ['active', 'closed', 'on_hold', 'lost'],
            },
            dealType: {
              type: 'string',
              description: 'Filter by deal type',
              enum: ['ma', 'capital_raising', 'restructuring', 'valuation'],
            },
          },
        },
      },
      handler: 'handleGetDealPipeline',
    },
    {
      name: 'generateProposal',
      description: 'Generate a deal proposal document',
      domain: 'advisory',
      functionDeclaration: {
        name: 'generateProposal',
        description: 'Generate proposal for a deal',
        parameters: {
          type: 'object',
          properties: {
            dealId: {
              type: 'string',
              description: 'Deal ID',
            },
            template: {
              type: 'string',
              description: 'Proposal template',
              enum: ['standard', 'detailed', 'executive_summary'],
            },
          },
          required: ['dealId'],
        },
      },
      handler: 'handleGenerateProposal',
    },
  ],

  matflow: [
    {
      name: 'createRequisition',
      description: 'Create a new material requisition',
      domain: 'matflow',
      functionDeclaration: {
        name: 'createRequisition',
        description: 'Create requisition for materials',
        parameters: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            description: {
              type: 'string',
              description: 'Requisition description',
            },
            items: {
              type: 'array',
              description: 'Material items',
              items: {
                type: 'object',
                description: 'Material item with name, quantity, and unit details',
              },
            },
            priority: {
              type: 'string',
              description: 'Priority level',
              enum: ['normal', 'high', 'urgent'],
            },
          },
          required: ['projectId', 'description', 'items'],
        },
      },
      handler: 'handleCreateRequisition',
    },
    {
      name: 'checkBudget',
      description: 'Check available budget for procurement',
      domain: 'matflow',
      functionDeclaration: {
        name: 'checkBudget',
        description: 'Check project budget availability',
        parameters: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            category: {
              type: 'string',
              description: 'Budget category',
            },
          },
          required: ['projectId'],
        },
      },
      handler: 'handleCheckBudget',
    },
    {
      name: 'getSupplierQuotes',
      description: 'Get quotes from suppliers for materials',
      domain: 'matflow',
      functionDeclaration: {
        name: 'getSupplierQuotes',
        description: 'Retrieve supplier quotes',
        parameters: {
          type: 'object',
          properties: {
            materialIds: {
              type: 'array',
              description: 'Material IDs to get quotes for',
              items: { type: 'string', description: 'Material identifier' },
            },
            quantities: {
              type: 'array',
              description: 'Quantities needed',
              items: { type: 'number', description: 'Quantity required for the corresponding material' },
            },
          },
          required: ['materialIds', 'quantities'],
        },
      },
      handler: 'handleGetSupplierQuotes',
    },
    {
      name: 'trackDelivery',
      description: 'Track delivery status for a purchase order',
      domain: 'matflow',
      functionDeclaration: {
        name: 'trackDelivery',
        description: 'Track PO delivery status',
        parameters: {
          type: 'object',
          properties: {
            poNumber: {
              type: 'string',
              description: 'Purchase order number',
            },
          },
          required: ['poNumber'],
        },
      },
      handler: 'handleTrackDelivery',
    },
  ],

  analytics: [
    {
      name: 'generateReport',
      description: 'Generate an analytics report',
      domain: 'analytics',
      functionDeclaration: {
        name: 'generateReport',
        description: 'Generate platform report',
        parameters: {
          type: 'object',
          properties: {
            reportType: {
              type: 'string',
              description: 'Type of report',
              enum: ['performance', 'comparison', 'trend', 'summary', 'custom'],
            },
            entityId: {
              type: 'string',
              description: 'Entity to report on (optional)',
            },
            dateRange: {
              type: 'object',
              description: 'Date range for the report',
            },
            format: {
              type: 'string',
              description: 'Output format',
              enum: ['summary', 'detailed', 'pdf', 'excel'],
            },
          },
          required: ['reportType'],
        },
      },
      handler: 'handleGenerateReport',
    },
    {
      name: 'compareEntities',
      description: 'Compare multiple entities',
      domain: 'analytics',
      functionDeclaration: {
        name: 'compareEntities',
        description: 'Compare entities side by side',
        parameters: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              description: 'Type of entities to compare',
              enum: ['projects', 'portfolios', 'deals', 'suppliers'],
            },
            entityIds: {
              type: 'array',
              description: 'IDs of entities to compare',
              items: { type: 'string', description: 'Entity identifier to include in comparison' },
            },
            metrics: {
              type: 'array',
              description: 'Metrics to compare',
              items: { type: 'string', description: 'Metric name to compare across entities' },
            },
          },
          required: ['entityType', 'entityIds'],
        },
      },
      handler: 'handleCompareEntities',
    },
  ],

  settings: [
    {
      name: 'updatePreferences',
      description: 'Update user preferences',
      domain: 'settings',
      functionDeclaration: {
        name: 'updatePreferences',
        description: 'Update user preference settings',
        parameters: {
          type: 'object',
          properties: {
            preference: {
              type: 'string',
              description: 'Preference to update',
              enum: ['language', 'timezone', 'currency', 'notifications', 'theme'],
            },
            value: {
              type: 'string',
              description: 'New value for the preference',
            },
          },
          required: ['preference', 'value'],
        },
      },
      handler: 'handleUpdatePreferences',
    },
  ],
};

/**
 * Get domain handler configuration
 */
export function getDomainHandler(domain: AgentDomain): DomainHandler {
  const tools = DOMAIN_TOOLS[domain] || [];
  const systemPrompt = DOMAIN_PROMPTS[domain] || DOMAIN_PROMPTS.general;

  const domainNames: Record<AgentDomain, string> = {
    general: 'General Assistant',
    infrastructure: 'Infrastructure Projects',
    investment: 'Investment Management',
    advisory: 'Advisory Services',
    matflow: 'Material Flow',
    analytics: 'Analytics & Reports',
    settings: 'Settings & Preferences',
  };

  const domainDescriptions: Record<AgentDomain, string> = {
    general: 'General platform assistance and navigation',
    infrastructure: 'Construction project management and monitoring',
    investment: 'Portfolio and investment performance management',
    advisory: 'Deal management and client advisory services',
    matflow: 'Material procurement and supply chain management',
    analytics: 'Cross-platform analytics and reporting',
    settings: 'User and system configuration',
  };

  return {
    domain,
    name: domainNames[domain],
    description: domainDescriptions[domain],
    keywords: [],
    patterns: [],
    entityTypes: [],
    systemPrompt,
    tools,
    capabilities: {
      canCreate: ['matflow', 'advisory'].includes(domain),
      canUpdate: !['general', 'analytics'].includes(domain),
      canDelete: ['settings'].includes(domain),
      canAnalyze: ['analytics', 'investment', 'infrastructure'].includes(domain),
    },
  };
}

/**
 * Get tools for a domain as Gemini function declarations
 */
export function getDomainTools(domain: AgentDomain): FunctionDeclarationsTool[] {
  const domainTools = DOMAIN_TOOLS[domain] || [];
  const generalTools = domain !== 'general' ? DOMAIN_TOOLS.general : [];
  
  const allTools = [...domainTools, ...generalTools];

  if (allTools.length === 0) {
    return [];
  }

  return [
    {
      functionDeclarations: allTools.map((tool): any => ({
        name: tool.functionDeclaration.name,
        description: tool.functionDeclaration.description,
        parameters: tool.functionDeclaration.parameters,
      })),
    },
  ];
}

/**
 * Get all available tools across domains
 */
export function getAllTools(): AgentTool[] {
  const allTools: AgentTool[] = [];
  
  for (const domain of Object.keys(DOMAIN_TOOLS) as AgentDomain[]) {
    allTools.push(...DOMAIN_TOOLS[domain]);
  }
  
  return allTools;
}
