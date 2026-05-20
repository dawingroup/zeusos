import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  addDoc
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  UnifiedSearchQuery,
  UnifiedSearchResult,
  UnifiedSearchResponse,
  SearchFacets,
  EntityReference,
  ModuleType,
  LinkableEntityType
} from '../types/cross-module';
import { entityLinkerService } from './entity-linker';

const SEARCH_HISTORY_COLLECTION = 'searchHistory';

const SEARCH_CONFIG: Record<ModuleType, { collections: Record<string, { nameField: string; refField?: string }> }> = {
  infrastructure: {
    collections: {
      projects: { nameField: 'projectName', refField: 'projectNumber' },
      engagements: { nameField: 'name', refField: 'code' },
      facilities: { nameField: 'name', refField: 'code' },
      ipcs: { nameField: 'certificateNumber', refField: 'certificateNumber' },
      milestones: { nameField: 'name' }
    }
  },
  investment: {
    collections: {
      deals: { nameField: 'name', refField: 'dealNumber' },
      portfolios: { nameField: 'name', refField: 'code' },
      funds: { nameField: 'name', refField: 'fundCode' },
      investments: { nameField: 'name', refField: 'code' }
    }
  },
  advisory: {
    collections: {
      mandates: { nameField: 'name', refField: 'mandateNumber' },
      proposals: { nameField: 'title', refField: 'proposalNumber' },
      clients: { nameField: 'name', refField: 'clientCode' }
    }
  },
  matflow: {
    collections: {
      requisitions: { nameField: 'title', refField: 'requisitionNumber' },
      purchaseOrders: { nameField: 'title', refField: 'poNumber' },
      suppliers: { nameField: 'name', refField: 'supplierCode' },
      boqs: { nameField: 'name', refField: 'boqNumber' }
    }
  }
};

export class UnifiedSearchService {
  async search(searchQuery: UnifiedSearchQuery, userId: string): Promise<UnifiedSearchResponse> {
    const startTime = Date.now();
    const results: UnifiedSearchResult[] = [];
    const facetCounts: Record<ModuleType, number> = {
      infrastructure: 0,
      investment: 0,
      advisory: 0,
      matflow: 0
    };
    const entityTypeCounts: Record<string, number> = {};
    const dateRangeCounts: Record<string, number> = {
      'Today': 0,
      'This Week': 0,
      'This Month': 0,
      'Older': 0
    };

    const modulesToSearch = searchQuery.modules || ['infrastructure', 'investment', 'advisory', 'matflow'];
    const searchLimit = searchQuery.limit || 20;
    const queryLower = searchQuery.query.toLowerCase();

    for (const module of modulesToSearch) {
      const config = SEARCH_CONFIG[module];
      
      for (const [collectionName, fields] of Object.entries(config.collections)) {
        const entityType = this.getEntityTypeFromCollection(collectionName);
        
        if (searchQuery.entityTypes && !searchQuery.entityTypes.includes(entityType)) {
          continue;
        }

        try {
          let q = query(collection(db, collectionName), limit(50));
          
          if (searchQuery.dateRange) {
            q = query(
              collection(db, collectionName),
              where('createdAt', '>=', Timestamp.fromDate(searchQuery.dateRange.start)),
              where('createdAt', '<=', Timestamp.fromDate(searchQuery.dateRange.end)),
              limit(50)
            );
          }

          const snapshot = await getDocs(q);

          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const name = data[fields.nameField] || '';
            const refNumber = fields.refField ? data[fields.refField] : '';
            
            const score = this.calculateRelevanceScore(queryLower, name, refNumber, data);

            if (score > 0) {
              const entityRef: EntityReference = {
                id: docSnap.id,
                type: entityType,
                module,
                name,
                referenceNumber: refNumber,
                metadata: { status: data.status, createdAt: data.createdAt }
              };

              results.push({
                entity: entityRef,
                score,
                highlights: this.generateHighlights(queryLower, name, refNumber)
              });

              facetCounts[module]++;
              entityTypeCounts[entityType] = (entityTypeCounts[entityType] || 0) + 1;

              if (data.createdAt) {
                const createdDate = data.createdAt.toDate();
                const now = new Date();
                const daysDiff = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysDiff === 0) dateRangeCounts['Today']++;
                else if (daysDiff <= 7) dateRangeCounts['This Week']++;
                else if (daysDiff <= 30) dateRangeCounts['This Month']++;
                else dateRangeCounts['Older']++;
              }
            }
          });
        } catch (error) {
          console.error(`Error searching ${collectionName}:`, error);
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    const paginatedResults = results.slice(
      searchQuery.offset || 0,
      (searchQuery.offset || 0) + searchLimit
    );

    const enrichedResults = await this.enrichWithLinkedEntities(paginatedResults);
    await this.saveSearchHistory(searchQuery, userId);

    const facets: SearchFacets = {
      modules: Object.entries(facetCounts)
        .map(([module, count]) => ({ module: module as ModuleType, count }))
        .filter(f => f.count > 0),
      entityTypes: Object.entries(entityTypeCounts)
        .map(([type, count]) => ({ type: type as LinkableEntityType, count })),
      dateRanges: Object.entries(dateRangeCounts)
        .map(([label, count]) => ({ label, count }))
        .filter(d => d.count > 0)
    };

    return {
      results: enrichedResults,
      facets,
      total: results.length,
      query: searchQuery,
      executionTime: Date.now() - startTime
    };
  }

  private calculateRelevanceScore(query: string, name: string, refNumber: string, data: Record<string, unknown>): number {
    let score = 0;
    const nameLower = name.toLowerCase();
    const refLower = refNumber?.toLowerCase() || '';

    if (nameLower.includes(query)) {
      score += 3;
      if (nameLower === query) score += 2;
      if (nameLower.startsWith(query)) score += 1.5;
    }

    if (refLower.includes(query)) {
      score += 2.5;
      if (refLower === query) score += 1.5;
    }

    const description = ((data.description || data.notes || '') as string).toLowerCase();
    if (description.includes(query)) {
      score += 1;
    }

    if (data.createdAt) {
      const createdAt = data.createdAt as Timestamp;
      const daysSinceCreation = Math.floor(
        (Date.now() - createdAt.toDate().getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceCreation < 7) score += 1.5;
      else if (daysSinceCreation < 30) score += 1;
      else if (daysSinceCreation < 90) score += 0.5;
    }

    return score;
  }

  private generateHighlights(query: string, name: string, refNumber: string): string[] {
    const highlights: string[] = [];
    const nameLower = name.toLowerCase();
    const refLower = refNumber?.toLowerCase() || '';

    if (nameLower.includes(query)) {
      const start = nameLower.indexOf(query);
      highlights.push(
        name.substring(0, start) +
        '<mark>' + name.substring(start, start + query.length) + '</mark>' +
        name.substring(start + query.length)
      );
    }

    if (refLower && refLower.includes(query)) {
      const start = refLower.indexOf(query);
      highlights.push(
        refNumber.substring(0, start) +
        '<mark>' + refNumber.substring(start, start + query.length) + '</mark>' +
        refNumber.substring(start + query.length)
      );
    }

    return highlights;
  }

  private async enrichWithLinkedEntities(results: UnifiedSearchResult[]): Promise<UnifiedSearchResult[]> {
    return Promise.all(
      results.map(async result => {
        const links = await entityLinkerService.getEntityLinks(
          result.entity.id,
          result.entity.type,
          'outgoing'
        );
        
        return {
          ...result,
          linkedEntities: links.slice(0, 5).map(l => l.targetEntity)
        };
      })
    );
  }

  private getEntityTypeFromCollection(collectionName: string): LinkableEntityType {
    const mapping: Record<string, LinkableEntityType> = {
      projects: 'project',
      engagements: 'engagement',
      facilities: 'facility',
      ipcs: 'ipc',
      milestones: 'milestone',
      contractors: 'contractor',
      deals: 'deal',
      portfolios: 'portfolio',
      funds: 'fund',
      investments: 'investment',
      investors: 'investor',
      mandates: 'mandate',
      proposals: 'proposal',
      clients: 'client',
      deliverables: 'deliverable',
      requisitions: 'requisition',
      purchaseOrders: 'purchase_order',
      suppliers: 'supplier',
      boqs: 'boq',
      deliveries: 'delivery',
      materials: 'material'
    };
    return mapping[collectionName] || 'project';
  }

  async getSuggestions(partialQuery: string, modules?: ModuleType[]): Promise<EntityReference[]> {
    if (partialQuery.length < 2) return [];

    const response = await this.search({ query: partialQuery, modules, limit: 10 }, 'system');
    return response.results.map(r => r.entity);
  }

  private async saveSearchHistory(searchQuery: UnifiedSearchQuery, userId: string): Promise<void> {
    try {
      await addDoc(collection(db, SEARCH_HISTORY_COLLECTION), {
        query: searchQuery.query,
        modules: searchQuery.modules,
        entityTypes: searchQuery.entityTypes,
        userId,
        timestamp: Timestamp.now()
      });
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }

  async getRecentSearches(userId: string, count: number = 10): Promise<string[]> {
    const q = query(
      collection(db, SEARCH_HISTORY_COLLECTION),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(count)
    );

    const snapshot = await getDocs(q);
    const searches = new Set<string>();
    
    snapshot.forEach(docSnap => {
      searches.add(docSnap.data().query);
    });

    return Array.from(searches);
  }
}

export const unifiedSearchService = new UnifiedSearchService();
