// src/subsidiaries/advisory/ai/services/domain-detector.ts

import {
  AgentDomain,
  DomainContext,
  SessionContext,
  DetectedEntity,
  EntityType,
} from '../types/agent';

interface DomainPattern {
  domain: AgentDomain;
  keywords: string[];
  patterns: RegExp[];
  weight: number;
}

interface EntityPattern {
  type: EntityType;
  patterns: RegExp[];
  validator?: (value: string) => boolean;
}

// Domain detection patterns
const DOMAIN_PATTERNS: DomainPattern[] = [
  {
    domain: 'infrastructure',
    keywords: [
      'project', 'construction', 'facility', 'hospital', 'building',
      'milestone', 'progress', 'IPC', 'valuation', 'contractor',
      'site', 'works', 'completion', 'handover', 'defects'
    ],
    patterns: [
      /AMH-\d+/i,
      /rushoroza|kabale|mbarara|jinja|gulu|lira|soroti|mbale|fort\s*portal|hoima/i,
      /project\s+(status|progress|update)/i,
      /payment\s+certificate/i,
      /site\s+(visit|inspection)/i,
    ],
    weight: 1.0,
  },
  {
    domain: 'investment',
    keywords: [
      'portfolio', 'fund', 'investment', 'return', 'ROI', 'IRR',
      'NAV', 'AUM', 'equity', 'debt', 'allocation', 'performance',
      'dividend', 'yield', 'risk', 'diversification', 'holdings'
    ],
    patterns: [
      /portfolio\s+(summary|performance|analysis)/i,
      /\b(buy|sell|hold)\s+\d+/i,
      /return\s+(of|on)\s+\d+/i,
      /\d+(\.\d+)?%\s*(return|yield|growth)/i,
      /investment\s+(strategy|thesis)/i,
    ],
    weight: 1.0,
  },
  {
    domain: 'advisory',
    keywords: [
      'deal', 'mandate', 'client', 'proposal', 'M&A', 'merger',
      'acquisition', 'due diligence', 'valuation', 'transaction',
      'engagement', 'fee', 'pitch', 'pipeline', 'restructuring'
    ],
    patterns: [
      /deal\s+(pipeline|status|update)/i,
      /client\s+(meeting|call|presentation)/i,
      /DEAL-\d+|MANDATE-\d+/i,
      /due\s+diligence/i,
      /capital\s+raising/i,
    ],
    weight: 1.0,
  },
  {
    domain: 'matflow',
    keywords: [
      'material', 'procurement', 'requisition', 'purchase order', 'PO',
      'supplier', 'vendor', 'BOQ', 'bill of quantities', 'delivery',
      'stock', 'inventory', 'cement', 'steel', 'aggregate', 'quote'
    ],
    patterns: [
      /REQ-[A-Z]+-\d{4}-\d+/i,
      /PO-[A-Z]+-\d{4}-\d+/i,
      /DEL-[A-Z]+-\d{4}-\d+/i,
      /\d+\s*(bags?|tonnes?|kg|pcs|m[²³]?|sheets?)/i,
      /material\s+(list|request|order)/i,
      /supplier\s+(quote|quotation|price)/i,
    ],
    weight: 1.0,
  },
  {
    domain: 'analytics',
    keywords: [
      'analyze', 'analysis', 'report', 'dashboard', 'metric', 'KPI',
      'trend', 'comparison', 'benchmark', 'statistics', 'chart',
      'summary', 'overview', 'insights', 'data'
    ],
    patterns: [
      /analyze\s+(this|the|my)/i,
      /compare\s+(these|the|\d+)/i,
      /show\s+(me\s+)?(the\s+)?(trend|chart|graph)/i,
      /generate\s+(a\s+)?report/i,
      /what('s| is)\s+the\s+(total|average|sum)/i,
    ],
    weight: 0.8,
  },
  {
    domain: 'settings',
    keywords: [
      'settings', 'configuration', 'preference', 'permission',
      'notification', 'profile', 'account', 'password', 'access'
    ],
    patterns: [
      /change\s+(my\s+)?(settings|preferences)/i,
      /update\s+(my\s+)?(profile|account)/i,
      /enable|disable\s+\w+/i,
    ],
    weight: 0.5,
  },
  {
    domain: 'general',
    keywords: [
      'help', 'hello', 'hi', 'hey', 'what', 'how', 'can you',
      'tell me', 'explain', 'thanks', 'thank you'
    ],
    patterns: [
      /^(hi|hello|hey|good\s+(morning|afternoon|evening))/i,
      /what\s+can\s+you\s+do/i,
      /help\s+me/i,
    ],
    weight: 0.3,
  },
];

// Entity extraction patterns
const ENTITY_PATTERNS: EntityPattern[] = [
  {
    type: 'requisition',
    patterns: [/REQ-([A-Z]+)-(\d{4})-(\d+)/gi],
  },
  {
    type: 'purchase_order',
    patterns: [/PO-([A-Z]+)-(\d{4})-(\d+)/gi],
  },
  {
    type: 'project',
    patterns: [
      /AMH-(\d+)/gi,
      /project\s+["']?([^"'\n,]+)["']?/gi,
    ],
  },
  {
    type: 'amount',
    patterns: [
      /(?:UGX|USD|EUR|GBP|KES)\s*[\d,]+(?:\.\d{2})?/gi,
      /[\d,]+(?:\.\d{2})?\s*(?:UGX|USD|EUR|GBP|KES)/gi,
      /[\d,]+(?:\.\d+)?\s*(?:million|billion|M|B|K)/gi,
    ],
  },
  {
    type: 'percentage',
    patterns: [/\d+(?:\.\d+)?%/g],
  },
  {
    type: 'date',
    patterns: [
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/g,
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{4})?/gi,
      /(?:today|tomorrow|yesterday|next\s+week|last\s+week|this\s+month)/gi,
    ],
  },
  {
    type: 'material',
    patterns: [
      /\b(cement|steel|aggregate|sand|timber|tiles?|roofing\s+sheets?|blocks?|bricks?|rebar|paint|plumbing|electrical|glass|doors?|windows?)\b/gi,
    ],
  },
  {
    type: 'supplier',
    patterns: [
      /(?:supplier|vendor)\s+["']?([^"'\n,]+)["']?/gi,
    ],
  },
  {
    type: 'person',
    patterns: [
      /(?:Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g,
    ],
  },
];

export class DomainDetector {
  private sessionContext: SessionContext;

  constructor(sessionContext: SessionContext) {
    this.sessionContext = sessionContext;
  }

  /**
   * Detect the domain and context from user input
   */
  detectDomain(input: string): DomainContext {
    const scores = this.calculateDomainScores(input);
    const entities = this.extractEntities(input);
    
    // Apply session context boosting
    this.applySessionBoost(scores);
    
    // Get the top domain
    const sortedScores = Object.entries(scores)
      .sort(([, a], [, b]) => b - a);
    
    const topDomain = sortedScores[0][0] as AgentDomain;
    const topScore = sortedScores[0][1];
    const secondScore = sortedScores[1]?.[1] || 0;
    
    // Calculate confidence based on margin
    const confidence = Math.min(1, (topScore - secondScore) / topScore + 0.3);
    
    return {
      domain: topDomain,
      confidence,
      detectedEntities: entities,
      sessionContext: this.sessionContext,
      domainParams: this.extractDomainParams(topDomain, input, entities),
    };
  }

  /**
   * Calculate domain scores based on keywords and patterns
   */
  private calculateDomainScores(input: string): Record<AgentDomain, number> {
    const scores: Record<AgentDomain, number> = {
      general: 0,
      infrastructure: 0,
      investment: 0,
      advisory: 0,
      matflow: 0,
      analytics: 0,
      settings: 0,
    };

    const inputLower = input.toLowerCase();

    for (const domainPattern of DOMAIN_PATTERNS) {
      let score = 0;

      // Check keywords
      for (const keyword of domainPattern.keywords) {
        if (inputLower.includes(keyword.toLowerCase())) {
          score += 1 * domainPattern.weight;
        }
      }

      // Check patterns
      for (const pattern of domainPattern.patterns) {
        if (pattern.test(input)) {
          score += 2 * domainPattern.weight;
        }
        // Reset regex lastIndex
        pattern.lastIndex = 0;
      }

      scores[domainPattern.domain] = score;
    }

    return scores;
  }

  /**
   * Apply boost based on session context
   */
  private applySessionBoost(scores: Record<AgentDomain, number>): void {
    // Boost current module
    if (this.sessionContext.currentModule) {
      const moduleDomain = this.moduleToDomain(this.sessionContext.currentModule);
      if (moduleDomain && scores[moduleDomain] !== undefined) {
        scores[moduleDomain] *= 1.5;
      }
    }

    // Boost based on recent entities
    for (const entity of this.sessionContext.recentEntities.slice(0, 5)) {
      const entityDomain = this.entityTypeToDomain(entity.type);
      if (entityDomain && scores[entityDomain] !== undefined) {
        scores[entityDomain] += 0.5;
      }
    }
  }

  /**
   * Extract entities from input
   */
  extractEntities(input: string): DetectedEntity[] {
    const entities: DetectedEntity[] = [];

    for (const entityPattern of ENTITY_PATTERNS) {
      for (const pattern of entityPattern.patterns) {
        let match;
        while ((match = pattern.exec(input)) !== null) {
          const entity: DetectedEntity = {
            type: entityPattern.type,
            value: match[0],
            confidence: 0.9,
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
          };

          // Try to resolve entity ID from recent entities
          entity.id = this.resolveEntityId(entity);

          entities.push(entity);
        }
        // Reset regex lastIndex
        pattern.lastIndex = 0;
      }
    }

    // Sort by position and remove duplicates
    return this.deduplicateEntities(
      entities.sort((a, b) => a.position.start - b.position.start)
    );
  }

  /**
   * Resolve entity ID from recent entities or database
   */
  private resolveEntityId(entity: DetectedEntity): string | undefined {
    // Check recent entities
    for (const recent of this.sessionContext.recentEntities) {
      if (
        recent.type === entity.type &&
        recent.name.toLowerCase().includes(entity.value.toLowerCase())
      ) {
        return recent.id;
      }
    }

    // For reference numbers, the ID is often in the value itself
    if (['requisition', 'purchase_order', 'project'].includes(entity.type)) {
      return entity.value;
    }

    return undefined;
  }

  /**
   * Remove duplicate entities (overlapping positions)
   */
  private deduplicateEntities(entities: DetectedEntity[]): DetectedEntity[] {
    const result: DetectedEntity[] = [];

    for (const entity of entities) {
      const overlaps = result.some(
        (e) =>
          (entity.position.start >= e.position.start &&
            entity.position.start < e.position.end) ||
          (entity.position.end > e.position.start &&
            entity.position.end <= e.position.end)
      );

      if (!overlaps) {
        result.push(entity);
      }
    }

    return result;
  }

  /**
   * Extract domain-specific parameters
   */
  private extractDomainParams(
    domain: AgentDomain,
    input: string,
    entities: DetectedEntity[]
  ): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    switch (domain) {
      case 'matflow':
        // Extract quantities
        const quantityMatch = input.match(/(\d+)\s*(bags?|tonnes?|kg|pcs|m[²³]?)/i);
        if (quantityMatch) {
          params.quantity = parseInt(quantityMatch[1]);
          params.unit = quantityMatch[2];
        }
        break;

      case 'analytics':
        // Extract time range
        if (/this\s+month|MTD/i.test(input)) {
          params.timeRange = 'MTD';
        } else if (/this\s+quarter|QTD/i.test(input)) {
          params.timeRange = 'QTD';
        } else if (/this\s+year|YTD/i.test(input)) {
          params.timeRange = 'YTD';
        }
        break;

      case 'investment':
        // Extract asset class
        const assetMatch = input.match(/\b(equity|debt|real\s+estate|infrastructure|private\s+equity)\b/i);
        if (assetMatch) {
          params.assetClass = assetMatch[1].toLowerCase();
        }
        break;
    }

    // Add entity IDs as params
    for (const entity of entities) {
      if (entity.id) {
        params[`${entity.type}Id`] = entity.id;
      }
    }

    return params;
  }

  /**
   * Map module name to domain
   */
  private moduleToDomain(module: string): AgentDomain | null {
    const mapping: Record<string, AgentDomain> = {
      infrastructure: 'infrastructure',
      'infrastructure-delivery': 'infrastructure',
      investment: 'investment',
      'investment-management': 'investment',
      advisory: 'advisory',
      'advisory-services': 'advisory',
      matflow: 'matflow',
      'material-flow': 'matflow',
    };
    return mapping[module.toLowerCase()] || null;
  }

  /**
   * Map entity type to domain
   */
  private entityTypeToDomain(type: string): AgentDomain | null {
    const mapping: Record<string, AgentDomain> = {
      project: 'infrastructure',
      facility: 'infrastructure',
      portfolio: 'investment',
      investment: 'investment',
      deal: 'advisory',
      engagement: 'advisory',
      requisition: 'matflow',
      purchase_order: 'matflow',
      supplier: 'matflow',
      material: 'matflow',
      boq: 'matflow',
    };
    return mapping[type] || null;
  }

  /**
   * Update session context
   */
  updateSession(updates: Partial<SessionContext>): void {
    this.sessionContext = { ...this.sessionContext, ...updates };
  }
}

export function createDomainDetector(sessionContext: SessionContext): DomainDetector {
  return new DomainDetector(sessionContext);
}
