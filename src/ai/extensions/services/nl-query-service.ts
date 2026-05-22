/**
 * Natural Language Query Service
 * Converts natural language to structured queries
 */

import {
  collection,
  getDocs,
  query as firestoreQuery,
  where,
  orderBy,
  limit,
  Query,
  DocumentData,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import {
  ParsedNLQuery,
  NLQueryResponse,
  NLQueryType,
  QueryFilter,
  ChartConfig,
  ModuleType,
} from '../types/ai-extensions';

// Collection mappings
const COLLECTION_MAP: Record<string, string> = {
  // Infrastructure
  'programs': 'programs',
  'projects': 'projects',
  'ipcs': 'ipcs',
  'requisitions': 'requisitions',
  'milestones': 'milestones',
  // MatFlow
  'boqs': 'boqs',
  'materials': 'materials',
  'purchase_orders': 'purchaseOrders',
};

const FIELD_MAP: Record<string, string> = {
  'budget': 'budgetAmount',
  'spent': 'actualSpend',
  'progress': 'progressPercent',
  'status': 'status',
  'date': 'createdAt',
  'created': 'createdAt',
  'updated': 'updatedAt',
  'amount': 'amount',
  'value': 'value',
  'name': 'name',
  'title': 'title',
};

// Query patterns for common questions
const QUERY_PATTERNS: Array<{
  pattern: RegExp;
  queryType: NLQueryType;
  extractor: (match: RegExpMatchArray, module: ModuleType) => Partial<ParsedNLQuery>;
}> = [
  {
    pattern: /show\s+(?:all\s+)?(\w+)\s+(?:over|above)\s+budget/i,
    queryType: 'filter',
    extractor: (match, _module) => ({
      intent: `Find ${match[1]} exceeding budget`,
      filters: [{ field: 'budgetVariance', operator: 'gt', value: 0 }],
      firestoreQuery: {
        collection: COLLECTION_MAP[match[1]] || 'projects',
        filters: [],
      },
    }),
  },
  {
    pattern: /list\s+(?:all\s+)?(\w+)\s+(?:closing|due)\s+this\s+month/i,
    queryType: 'filter',
    extractor: (match) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        intent: `Find ${match[1]} due this month`,
        filters: [
          { field: 'dueDate', operator: 'gte', value: startOfMonth },
          { field: 'dueDate', operator: 'lte', value: endOfMonth },
        ],
        firestoreQuery: {
          collection: COLLECTION_MAP[match[1]] || 'deals',
          filters: [],
        },
      };
    },
  },
  {
    pattern: /compare\s+(\w+)\s+performance\s+by\s+(\w+)/i,
    queryType: 'compare',
    extractor: (match) => ({
      intent: `Compare ${match[1]} by ${match[2]}`,
      aggregations: [{ field: match[2], operation: 'group', alias: match[2] }],
    }),
  },
  {
    pattern: /find\s+(\w+)\s+pending\s+approval/i,
    queryType: 'filter',
    extractor: (match) => ({
      intent: `Find ${match[1]} pending approval`,
      filters: [{ field: 'status', operator: 'eq', value: 'pending_approval' }],
      firestoreQuery: {
        collection: COLLECTION_MAP[match[1]] || 'requisitions',
        filters: [{ field: 'status', operator: 'eq', value: 'pending_approval' }],
      },
    }),
  },
  {
    pattern: /how\s+many\s+(\w+)/i,
    queryType: 'aggregate',
    extractor: (match) => ({
      intent: `Count ${match[1]}`,
      aggregations: [{ field: '*', operation: 'count', alias: 'total' }],
      firestoreQuery: {
        collection: COLLECTION_MAP[match[1]] || match[1],
        filters: [],
      },
    }),
  },
  {
    pattern: /total\s+(\w+)\s+(?:amount|value|budget)/i,
    queryType: 'aggregate',
    extractor: (match) => ({
      intent: `Sum ${match[1]} amounts`,
      aggregations: [{ field: 'amount', operation: 'sum', alias: 'total' }],
    }),
  },
];

export class NLQueryService {
  private queriesRef = collection(db, 'nlQueries');

  /**
   * Process natural language query
   */
  async processQuery(
    naturalQuery: string,
    module: ModuleType,
    userId: string
  ): Promise<NLQueryResponse> {
    // Parse the query
    const parsed = await this.parseQuery(naturalQuery, module);

    // Execute the query
    const results = await this.executeQuery(parsed);

    // Generate summary
    const summary = this.generateSummary(naturalQuery, results, parsed);

    // Determine visualization
    const visualization = this.determineVisualization(parsed, results);

    // Store query for history
    await this.storeQuery(naturalQuery, parsed, results.length, userId);

    return {
      query: parsed,
      results,
      totalCount: results.length,
      summary,
      visualizationType: visualization.type,
      chartConfig: visualization.config,
    };
  }

  /**
   * Parse natural language into structured query
   */
  async parseQuery(
    naturalQuery: string,
    module: ModuleType
  ): Promise<ParsedNLQuery> {
    // Try to match against known patterns first
    for (const { pattern, queryType, extractor } of QUERY_PATTERNS) {
      const match = naturalQuery.match(pattern);
      if (match) {
        const extracted = extractor(match, module);
        return {
          originalQuery: naturalQuery,
          queryType,
          intent: extracted.intent || naturalQuery,
          entities: [],
          filters: extracted.filters || [],
          aggregations: extracted.aggregations || [],
          timeRange: extracted.timeRange,
          firestoreQuery: extracted.firestoreQuery,
          confidence: 0.8,
          alternativeInterpretations: [],
        };
      }
    }

    // Fall back to AI-based parsing
    return this.aiParseQuery(naturalQuery, module);
  }

  /**
   * AI-based query parsing (when patterns don't match)
   */
  private async aiParseQuery(
    naturalQuery: string,
    module: ModuleType
  ): Promise<ParsedNLQuery> {
    // Determine likely collection based on keywords
    const collectionGuess = this.guessCollection(naturalQuery, module);
    
    // Extract potential filters from query
    const filters = this.extractFilters(naturalQuery);

    // Determine query type
    const queryType = this.determineQueryType(naturalQuery);

    return {
      originalQuery: naturalQuery,
      queryType,
      intent: naturalQuery,
      entities: [],
      filters,
      aggregations: [],
      firestoreQuery: {
        collection: collectionGuess,
        filters,
        limit: 50,
      },
      confidence: 0.6,
      alternativeInterpretations: [
        `Search for "${naturalQuery}" in ${collectionGuess}`,
      ],
    };
  }

  /**
   * Guess collection based on query content
   */
  private guessCollection(query: string, module: ModuleType): string {
    const lowerQuery = query.toLowerCase();

    // Module-specific collection mapping
    const moduleCollections: Record<ModuleType, Record<string, string>> = {
      infrastructure: {
        'project': 'projects',
        'program': 'programs',
        'ipc': 'ipcs',
        'payment': 'ipcs',
        'requisition': 'requisitions',
        'milestone': 'milestones',
      },
      matflow: {
        'boq': 'boqs',
        'material': 'materials',
        'purchase': 'purchaseOrders',
        'order': 'purchaseOrders',
        'supplier': 'suppliers',
      },
    };

    const collections = moduleCollections[module];
    for (const [keyword, collection] of Object.entries(collections)) {
      if (lowerQuery.includes(keyword)) {
        return collection;
      }
    }

    // Default by module
    const defaults: Record<ModuleType, string> = {
      infrastructure: 'projects',
      matflow: 'materials',
    };

    return defaults[module];
  }

  /**
   * Extract filters from natural language
   */
  private extractFilters(query: string): QueryFilter[] {
    const filters: QueryFilter[] = [];
    const lowerQuery = query.toLowerCase();

    // Status filters
    const statusMatches = lowerQuery.match(/status\s*(?:is|=|:)?\s*(\w+)/i);
    if (statusMatches) {
      filters.push({ field: 'status', operator: 'eq', value: statusMatches[1] });
    }

    // Pending/active status keywords
    if (lowerQuery.includes('pending')) {
      filters.push({ field: 'status', operator: 'eq', value: 'pending' });
    } else if (lowerQuery.includes('active')) {
      filters.push({ field: 'status', operator: 'eq', value: 'active' });
    } else if (lowerQuery.includes('completed')) {
      filters.push({ field: 'status', operator: 'eq', value: 'completed' });
    }

    // Amount filters
    const amountMatch = lowerQuery.match(/(?:over|above|more than|greater than)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i);
    if (amountMatch) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      filters.push({ field: 'amount', operator: 'gt', value: amount });
    }

    const belowMatch = lowerQuery.match(/(?:under|below|less than)\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i);
    if (belowMatch) {
      const amount = parseFloat(belowMatch[1].replace(/,/g, ''));
      filters.push({ field: 'amount', operator: 'lt', value: amount });
    }

    return filters;
  }

  /**
   * Determine query type from natural language
   */
  private determineQueryType(query: string): NLQueryType {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.match(/how\s+many|count|total\s+number/i)) {
      return 'aggregate';
    }
    if (lowerQuery.match(/compare|versus|vs|difference/i)) {
      return 'compare';
    }
    if (lowerQuery.match(/trend|over\s+time|history|growth/i)) {
      return 'trend';
    }
    if (lowerQuery.match(/report|summary|overview/i)) {
      return 'report';
    }
    if (lowerQuery.match(/where|with|having|filter/i)) {
      return 'filter';
    }

    return 'search';
  }

  /**
   * Execute parsed query against Firestore
   */
  async executeQuery(parsed: ParsedNLQuery): Promise<any[]> {
    if (!parsed.firestoreQuery) {
      return [];
    }

    const { collection: collName, filters, orderBy: order, limit: lim } = parsed.firestoreQuery;

    try {
      let q: Query<DocumentData> = collection(db, collName);

      // Apply filters
      for (const filter of filters) {
        const op = this.mapOperator(filter.operator);
        const fieldName = FIELD_MAP[filter.field] || filter.field;
        q = firestoreQuery(q, where(fieldName, op, filter.value));
      }

      // Apply ordering
      if (order) {
        q = firestoreQuery(q, orderBy(order.field, order.direction));
      }

      // Apply limit
      q = firestoreQuery(q, limit(lim || 50));

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Query execution error:', error);
      return [];
    }
  }

  /**
   * Map query operator to Firestore operator
   */
  private mapOperator(op: QueryFilter['operator']): '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in' {
    const map: Record<string, '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any' | 'not-in'> = {
      'eq': '==',
      'neq': '!=',
      'gt': '>',
      'gte': '>=',
      'lt': '<',
      'lte': '<=',
      'contains': 'array-contains',
      'in': 'in',
    };
    return map[op] || '==';
  }

  /**
   * Generate summary of results
   */
  private generateSummary(
    query: string,
    results: any[],
    parsed: ParsedNLQuery
  ): string {
    if (results.length === 0) {
      return `No results found for: "${query}"`;
    }

    if (parsed.queryType === 'aggregate') {
      if (parsed.aggregations.some(a => a.operation === 'count')) {
        return `Found ${results.length} items matching your query.`;
      }
      if (parsed.aggregations.some(a => a.operation === 'sum')) {
        const total = results.reduce((sum, r) => sum + (r.amount || 0), 0);
        return `Total amount: ${total.toLocaleString()}`;
      }
    }

    return `Found ${results.length} results for "${query}".`;
  }

  /**
   * Determine best visualization for results
   */
  private determineVisualization(
    parsed: ParsedNLQuery,
    results: any[]
  ): { type: 'table' | 'chart' | 'cards' | 'timeline'; config?: ChartConfig } {
    if (results.length === 0) {
      return { type: 'table' };
    }

    // Aggregation queries → charts
    if (parsed.aggregations.length > 0) {
      const groupAgg = parsed.aggregations.find(a => a.operation === 'group');
      return {
        type: 'chart',
        config: {
          type: 'bar',
          xAxis: groupAgg?.alias || 'category',
          yAxis: 'value',
        },
      };
    }

    // Trend queries → line charts
    if (parsed.queryType === 'trend') {
      return {
        type: 'chart',
        config: {
          type: 'line',
          xAxis: 'date',
          yAxis: 'value',
        },
      };
    }

    // Compare queries → bar charts
    if (parsed.queryType === 'compare') {
      return {
        type: 'chart',
        config: {
          type: 'bar',
          xAxis: 'name',
          yAxis: 'value',
        },
      };
    }

    // Few results → cards
    if (results.length <= 6) {
      return { type: 'cards' };
    }

    // Default → table
    return { type: 'table' };
  }

  /**
   * Store query for history
   */
  private async storeQuery(
    query: string,
    parsed: ParsedNLQuery,
    resultCount: number,
    userId: string
  ): Promise<void> {
    try {
      await addDoc(this.queriesRef, {
        query,
        parsedQuery: {
          queryType: parsed.queryType,
          intent: parsed.intent,
          confidence: parsed.confidence,
        },
        resultCount,
        userId,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error storing query:', error);
    }
  }

  /**
   * Get query suggestions based on module
   */
  getQuerySuggestions(module: ModuleType): string[] {
    const suggestions: Record<ModuleType, string[]> = {
      infrastructure: [
        'Show all projects over budget',
        'List IPCs pending approval',
        'Find requisitions from this month',
        'Compare project progress by program',
        'How many active projects?',
      ],
      matflow: [
        'Show materials low in stock',
        'List pending purchase orders',
        'Find BOQ items over budget',
        'Compare supplier pricing',
        'Total procurement spend?',
      ],
    };

    return suggestions[module] || [];
  }
}

export const nlQueryService = new NLQueryService();
