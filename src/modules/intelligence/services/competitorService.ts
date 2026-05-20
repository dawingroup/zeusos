// ============================================================================
// COMPETITOR SERVICE
// DawinOS v2.0 - Market Intelligence Module
// Firebase service for Competitor Analysis operations
// ============================================================================

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  Competitor,
  SWOTAnalysis,
  CompetitiveMove,
  WinLossRecord,
  CompetitorAnalytics,
  CompetitorFormInput,
  SWOTFormInput,
  CompetitiveMoveFormInput,
  WinLossFormInput,
  KeyExecutive,
  IntelligenceItem,
  CompetitorFilters,
  MoveFilters,
  WinLossFilters,
} from '../types/competitor.types';
import {
  ThreatLevel,
  CompetitorType,
  Industry,
  Geography,
  CompetitorStatus,
  CompetitiveMoveType,
  COMPETITORS_COLLECTION,
  SWOT_COLLECTION,
  MOVES_COLLECTION,
  WIN_LOSS_COLLECTION,
} from '../constants/competitor.constants';
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// ============================================================================
// COMPETITOR CRUD OPERATIONS
// ============================================================================

export const competitorService = {
  // --------------------------------------------------------------------------
  // CREATE
  // --------------------------------------------------------------------------
  
  async createCompetitor(
    input: CompetitorFormInput,
    userId: string
  ): Promise<string> {
    const now = Timestamp.now();
    
    // Strip undefined values — Firestore rejects them
    const cleanInput: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        cleanInput[key] = value;
      }
    }

    const competitorData = {
      status: 'active' as CompetitorStatus,
      keyExecutives: [],
      positioning: {
        positionScores: [],
        valuePropositon: '',
        targetSegments: [],
        differentiators: [],
        weaknessAreas: [],
      },
      customers: [],
      partners: [],
      overlapAreas: [],
      subsidiariesCompeting: [], // Ensure this is always initialized
      intelligenceSources: [],
      tags: [],
      assignedAnalysts: [],
      ...cleanInput, // Spread cleanInput after defaults to allow overrides
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(
      collection(db, COMPETITORS_COLLECTION),
      competitorData
    );
    
    return docRef.id;
  },
  
  // --------------------------------------------------------------------------
  // READ
  // --------------------------------------------------------------------------
  
  async getCompetitor(id: string): Promise<Competitor | null> {
    const docRef = doc(db, COMPETITORS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as Competitor;
  },
  
  async getCompetitors(filters?: CompetitorFilters): Promise<Competitor[]> {
    let q = query(
      collection(db, COMPETITORS_COLLECTION),
      orderBy('name', 'asc')
    );
    
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    
    if (filters?.type) {
      q = query(q, where('type', '==', filters.type));
    }
    
    if (filters?.threatLevel) {
      q = query(q, where('threatLevel', '==', filters.threatLevel));
    }
    
    const snapshot = await getDocs(q);
    let competitors = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Competitor[];
    
    // Client-side filtering for array fields
    if (filters?.industry) {
      competitors = competitors.filter(c => 
        c.industries.includes(filters.industry!)
      );
    }
    
    if (filters?.geography) {
      competitors = competitors.filter(c => 
        c.geographies.includes(filters.geography!)
      );
    }
    
    if (filters?.subsidiaryId) {
      competitors = competitors.filter(c => 
        c.subsidiariesCompeting.includes(filters.subsidiaryId!)
      );
    }
    
    if (filters?.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      competitors = competitors.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.legalName?.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term)
      );
    }
    
    return competitors;
  },
  
  async getHighThreatCompetitors(limitCount = 10): Promise<Competitor[]> {
    const q = query(
      collection(db, COMPETITORS_COLLECTION),
      where('status', '==', 'active'),
      where('threatLevel', 'in', ['high', 'critical']),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Competitor[];
  },
  
  async searchCompetitors(searchTerm: string): Promise<Competitor[]> {
    const allCompetitors = await this.getCompetitors({ status: 'active' });
    const lowerSearch = searchTerm.toLowerCase();
    
    return allCompetitors.filter(c =>
      c.name.toLowerCase().includes(lowerSearch) ||
      c.legalName?.toLowerCase().includes(lowerSearch) ||
      c.description.toLowerCase().includes(lowerSearch) ||
      c.products.some(p => p.toLowerCase().includes(lowerSearch)) ||
      c.services.some(s => s.toLowerCase().includes(lowerSearch))
    );
  },
  
  // --------------------------------------------------------------------------
  // UPDATE
  // --------------------------------------------------------------------------
  
  async updateCompetitor(
    id: string,
    updates: Partial<CompetitorFormInput>
  ): Promise<void> {
    const docRef = doc(db, COMPETITORS_COLLECTION, id);
    // Strip undefined values — Firestore rejects them
    const clean: Record<string, unknown> = { updatedAt: Timestamp.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        clean[key] = value;
      }
    }
    await updateDoc(docRef, clean);
  },
  
  async updateThreatLevel(
    id: string,
    threatLevel: ThreatLevel,
    _reason: string,
    _userId: string
  ): Promise<void> {
    const competitor = await this.getCompetitor(id);
    if (!competitor) throw new Error('Competitor not found');
    
    await updateDoc(doc(db, COMPETITORS_COLLECTION, id), {
      threatLevel,
      updatedAt: Timestamp.now(),
    });
  },
  
  async updateStatus(
    id: string,
    status: CompetitorStatus,
    notes?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updatedAt: Timestamp.now(),
    };
    if (notes) {
      updates.notes = notes;
    }
    await updateDoc(doc(db, COMPETITORS_COLLECTION, id), updates);
  },
  
  async addKeyExecutive(
    competitorId: string,
    executive: Omit<KeyExecutive, 'id'>
  ): Promise<void> {
    const competitor = await this.getCompetitor(competitorId);
    if (!competitor) throw new Error('Competitor not found');
    
    const newExecutive: KeyExecutive = {
      id: generateId(),
      ...executive,
    };
    
    await updateDoc(doc(db, COMPETITORS_COLLECTION, competitorId), {
      keyExecutives: [...competitor.keyExecutives, newExecutive],
      updatedAt: Timestamp.now(),
    });
  },
  
  async removeKeyExecutive(
    competitorId: string,
    executiveId: string
  ): Promise<void> {
    const competitor = await this.getCompetitor(competitorId);
    if (!competitor) throw new Error('Competitor not found');
    
    await updateDoc(doc(db, COMPETITORS_COLLECTION, competitorId), {
      keyExecutives: competitor.keyExecutives.filter(e => e.id !== executiveId),
      updatedAt: Timestamp.now(),
    });
  },
  
  async addIntelligence(
    competitorId: string,
    intelligence: Omit<IntelligenceItem, 'id' | 'collectedAt' | 'collectedBy'>,
    userId: string
  ): Promise<void> {
    const competitor = await this.getCompetitor(competitorId);
    if (!competitor) throw new Error('Competitor not found');
    
    const newIntel: IntelligenceItem = {
      id: generateId(),
      ...intelligence,
      collectedAt: Timestamp.now(),
      collectedBy: userId,
    };
    
    await updateDoc(doc(db, COMPETITORS_COLLECTION, competitorId), {
      intelligenceSources: [...competitor.intelligenceSources, newIntel],
      updatedAt: Timestamp.now(),
    });
  },
  
  // --------------------------------------------------------------------------
  // DELETE
  // --------------------------------------------------------------------------
  
  async deleteCompetitor(id: string): Promise<void> {
    await deleteDoc(doc(db, COMPETITORS_COLLECTION, id));
  },
  
  async archiveCompetitor(id: string, reason: string): Promise<void> {
    await updateDoc(doc(db, COMPETITORS_COLLECTION, id), {
      status: 'inactive' as CompetitorStatus,
      notes: reason,
      updatedAt: Timestamp.now(),
    });
  },
};

// ============================================================================
// SWOT ANALYSIS OPERATIONS
// ============================================================================

export const swotService = {
  async createSWOTAnalysis(
    input: SWOTFormInput,
    userId: string
  ): Promise<string> {
    const competitor = await competitorService.getCompetitor(input.competitorId);
    if (!competitor) throw new Error('Competitor not found');
    
    const now = Timestamp.now();
    
    const existingAnalyses = await this.getSWOTAnalyses(input.competitorId);
    const version = existingAnalyses.length + 1;
    
    const swotData: Omit<SWOTAnalysis, 'id'> = {
      competitorId: input.competitorId,
      competitorName: competitor.name,
      analysisDate: now,
      analysisPeriod: input.analysisPeriod,
      analyzedBy: userId,
      version,
      strengths: input.strengths.map(s => ({
        id: generateId(),
        category: 'strength',
        ...s,
        sources: [],
      })),
      weaknesses: input.weaknesses.map(w => ({
        id: generateId(),
        category: 'weakness',
        ...w,
        sources: [],
      })),
      opportunities: input.opportunities.map(o => ({
        id: generateId(),
        category: 'opportunity',
        ...o,
        sources: [],
      })),
      threats: input.threats.map(t => ({
        id: generateId(),
        category: 'threat',
        ...t,
        sources: [],
      })),
      overallAssessment: input.overallAssessment,
      strategicImplications: input.strategicImplications,
      recommendedActions: input.recommendedActions,
      comparisonToUs: [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(collection(db, SWOT_COLLECTION), swotData);
    return docRef.id;
  },
  
  async getSWOTAnalysis(id: string): Promise<SWOTAnalysis | null> {
    const docRef = doc(db, SWOT_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as SWOTAnalysis;
  },
  
  async getSWOTAnalyses(competitorId: string): Promise<SWOTAnalysis[]> {
    const q = query(
      collection(db, SWOT_COLLECTION),
      where('competitorId', '==', competitorId),
      orderBy('analysisDate', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SWOTAnalysis[];
  },
  
  async getLatestSWOT(competitorId: string): Promise<SWOTAnalysis | null> {
    const analyses = await this.getSWOTAnalyses(competitorId);
    return analyses[0] || null;
  },
  
  async updateSWOTStatus(
    id: string,
    status: SWOTAnalysis['status']
  ): Promise<void> {
    await updateDoc(doc(db, SWOT_COLLECTION, id), {
      status,
      updatedAt: Timestamp.now(),
    });
  },
  
  async approveSWOT(id: string, userId: string): Promise<void> {
    await updateDoc(doc(db, SWOT_COLLECTION, id), {
      status: 'approved',
      approvedBy: userId,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  },
  
  async deleteSWOT(id: string): Promise<void> {
    await deleteDoc(doc(db, SWOT_COLLECTION, id));
  },
};

// ============================================================================
// COMPETITIVE MOVE OPERATIONS
// ============================================================================

export const competitiveMoveService = {
  async createMove(
    input: CompetitiveMoveFormInput,
    userId: string
  ): Promise<string> {
    const competitor = await competitorService.getCompetitor(input.competitorId);
    if (!competitor) throw new Error('Competitor not found');
    
    const now = Timestamp.now();
    
    const moveData: Omit<CompetitiveMove, 'id'> = {
      competitorId: input.competitorId,
      competitorName: competitor.name,
      moveType: input.moveType,
      title: input.title,
      description: input.description,
      dateObserved: Timestamp.fromDate(input.dateObserved),
      impactSignificance: input.impactSignificance,
      impactedMarkets: input.impactedMarkets,
      impactedIndustries: input.impactedIndustries,
      impactedSubsidiaries: input.impactedSubsidiaries,
      strategicImplications: input.strategicImplications,
      sources: [],
      confidence: 70,
      verified: false,
      status: 'identified',
      assignedTo: [],
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(collection(db, MOVES_COLLECTION), moveData);
    return docRef.id;
  },
  
  async getMove(id: string): Promise<CompetitiveMove | null> {
    const docRef = doc(db, MOVES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as CompetitiveMove;
  },
  
  async getMoves(filters?: MoveFilters): Promise<CompetitiveMove[]> {
    let q = query(
      collection(db, MOVES_COLLECTION),
      orderBy('dateObserved', 'desc')
    );
    
    if (filters?.competitorId) {
      q = query(q, where('competitorId', '==', filters.competitorId));
    }
    
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    
    const snapshot = await getDocs(q);
    let moves = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CompetitiveMove[];
    
    if (filters?.impactedSubsidiary) {
      moves = moves.filter(m => 
        m.impactedSubsidiaries.includes(filters.impactedSubsidiary!)
      );
    }
    
    if (filters?.moveType) {
      moves = moves.filter(m => m.moveType === filters.moveType);
    }
    
    if (filters?.startDate) {
      moves = moves.filter(m => 
        m.dateObserved.toDate() >= filters.startDate!
      );
    }
    
    if (filters?.endDate) {
      moves = moves.filter(m => 
        m.dateObserved.toDate() <= filters.endDate!
      );
    }
    
    return moves;
  },
  
  async getRecentMoves(days = 30): Promise<CompetitiveMove[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const q = query(
      collection(db, MOVES_COLLECTION),
      where('dateObserved', '>=', Timestamp.fromDate(cutoffDate)),
      orderBy('dateObserved', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CompetitiveMove[];
  },
  
  async updateMove(
    id: string,
    updates: Partial<CompetitiveMoveFormInput>
  ): Promise<void> {
    await updateDoc(doc(db, MOVES_COLLECTION, id), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },
  
  async updateMoveStatus(
    id: string,
    status: CompetitiveMove['status'],
    response?: string
  ): Promise<void> {
    const updates: Record<string, unknown> = {
      status,
      updatedAt: Timestamp.now(),
    };
    
    if (response) {
      updates.ourResponse = response;
    }
    
    await updateDoc(doc(db, MOVES_COLLECTION, id), updates);
  },
  
  async deleteMove(id: string): Promise<void> {
    await deleteDoc(doc(db, MOVES_COLLECTION, id));
  },
};

// ============================================================================
// WIN/LOSS ANALYSIS OPERATIONS
// ============================================================================

export const winLossService = {
  async createRecord(
    input: WinLossFormInput,
    userId: string
  ): Promise<string> {
    const now = Timestamp.now();
    
    const recordData: Omit<WinLossRecord, 'id'> = {
      opportunityName: input.opportunityName,
      clientName: input.clientName,
      projectType: input.projectType,
      estimatedValue: input.estimatedValue,
      currency: input.currency,
      competitorId: input.competitorId,
      competitorName: input.competitorName,
      additionalCompetitors: input.additionalCompetitors,
      outcome: input.outcome,
      decisionDate: Timestamp.fromDate(input.decisionDate),
      primaryReasons: input.primaryReasons,
      secondaryReasons: input.secondaryReasons,
      detailedAnalysis: input.detailedAnalysis,
      clientFeedback: input.clientFeedback,
      internalLessons: input.internalLessons,
      improvementActions: input.improvementActions,
      bidTeam: [],
      geographies: [],
      industries: [],
      dawinSubsidiary: input.dawinSubsidiary,
      dealStage: 'closed',
      recordedBy: userId,
      createdAt: now,
      updatedAt: now,
    };
    
    const docRef = await addDoc(collection(db, WIN_LOSS_COLLECTION), recordData);
    return docRef.id;
  },
  
  async getRecord(id: string): Promise<WinLossRecord | null> {
    const docRef = doc(db, WIN_LOSS_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as WinLossRecord;
  },
  
  async getRecords(filters?: WinLossFilters): Promise<WinLossRecord[]> {
    let q = query(
      collection(db, WIN_LOSS_COLLECTION),
      orderBy('decisionDate', 'desc')
    );
    
    if (filters?.outcome) {
      q = query(q, where('outcome', '==', filters.outcome));
    }
    
    if (filters?.competitorId) {
      q = query(q, where('competitorId', '==', filters.competitorId));
    }
    
    if (filters?.subsidiaryId) {
      q = query(q, where('dawinSubsidiary', '==', filters.subsidiaryId));
    }
    
    const snapshot = await getDocs(q);
    let records = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as WinLossRecord[];
    
    if (filters?.startDate) {
      records = records.filter(r => 
        r.decisionDate.toDate() >= filters.startDate!
      );
    }
    
    if (filters?.endDate) {
      records = records.filter(r => 
        r.decisionDate.toDate() <= filters.endDate!
      );
    }
    
    return records;
  },
  
  async updateRecord(
    id: string,
    updates: Partial<WinLossFormInput>
  ): Promise<void> {
    await updateDoc(doc(db, WIN_LOSS_COLLECTION, id), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  },
  
  async deleteRecord(id: string): Promise<void> {
    await deleteDoc(doc(db, WIN_LOSS_COLLECTION, id));
  },
  
  async getWinLossStats(filters?: WinLossFilters): Promise<{
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    totalValue: number;
    avgDealSize: number;
    byReason: Record<string, number>;
    byCompetitor: Array<{
      competitorName: string;
      wins: number;
      losses: number;
      winRate: number;
    }>;
  }> {
    const records = await this.getRecords(filters);
    
    const total = records.length;
    const wins = records.filter(r => r.outcome === 'won').length;
    const losses = records.filter(r => r.outcome === 'lost').length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    
    const totalValue = records.reduce((sum, r) => sum + r.estimatedValue, 0);
    const avgDealSize = total > 0 ? totalValue / total : 0;
    
    const byReason: Record<string, number> = {};
    records.forEach(r => {
      r.primaryReasons.forEach(reason => {
        byReason[reason] = (byReason[reason] || 0) + 1;
      });
    });
    
    const competitorStats: Record<string, { wins: number; losses: number }> = {};
    records.forEach(r => {
      if (!competitorStats[r.competitorName]) {
        competitorStats[r.competitorName] = { wins: 0, losses: 0 };
      }
      if (r.outcome === 'won') {
        competitorStats[r.competitorName].wins++;
      } else if (r.outcome === 'lost') {
        competitorStats[r.competitorName].losses++;
      }
    });
    
    const byCompetitor = Object.entries(competitorStats).map(([name, stats]) => ({
      competitorName: name,
      wins: stats.wins,
      losses: stats.losses,
      winRate: (stats.wins + stats.losses) > 0 
        ? (stats.wins / (stats.wins + stats.losses)) * 100 
        : 0,
    }));
    
    return {
      total,
      wins,
      losses,
      winRate,
      totalValue,
      avgDealSize,
      byReason,
      byCompetitor,
    };
  },
};

// ============================================================================
// ANALYTICS
// ============================================================================

export const competitorAnalyticsService = {
  async getAnalytics(periodDays = 90): Promise<CompetitorAnalytics> {
    const competitors = await competitorService.getCompetitors();
    const recentMoves = await competitiveMoveService.getRecentMoves(periodDays);
    const winLossStats = await winLossService.getWinLossStats({
      startDate: new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000),
    });
    
    const activeCompetitors = competitors.filter(c => c.status === 'active');
    
    const byType: Record<string, number> = {};
    activeCompetitors.forEach(c => {
      byType[c.type] = (byType[c.type] || 0) + 1;
    });
    
    const byThreatLevel: Record<string, number> = {};
    activeCompetitors.forEach(c => {
      byThreatLevel[c.threatLevel] = (byThreatLevel[c.threatLevel] || 0) + 1;
    });
    
    const byIndustry: Record<string, number> = {};
    activeCompetitors.forEach(c => {
      c.industries.forEach(ind => {
        byIndustry[ind] = (byIndustry[ind] || 0) + 1;
      });
    });
    
    const byGeography: Record<string, number> = {};
    activeCompetitors.forEach(c => {
      c.geographies.forEach(geo => {
        byGeography[geo] = (byGeography[geo] || 0) + 1;
      });
    });
    
    const movesByType: Record<string, number> = {};
    recentMoves.forEach(m => {
      movesByType[m.moveType] = (movesByType[m.moveType] || 0) + 1;
    });
    
    const now = Date.now();
    const analysisUpToDate = activeCompetitors.filter(c => {
      if (!c.nextAnalysisAt) return false;
      return c.nextAnalysisAt.toMillis() > now;
    }).length;
    
    return {
      totalCompetitors: competitors.length,
      activeCompetitors: activeCompetitors.length,
      byType: byType as Record<CompetitorType, number>,
      byThreatLevel: byThreatLevel as Record<ThreatLevel, number>,
      byIndustry: byIndustry as Record<Industry, number>,
      byGeography: byGeography as Record<Geography, number>,
      newCompetitors: 0,
      exitedCompetitors: competitors.filter(c => c.status === 'exited_market').length,
      threatLevelChanges: [],
      recentMoves: recentMoves.length,
      movesByType: movesByType as Record<CompetitiveMoveType, number>,
      pendingResponses: recentMoves.filter(m => m.status === 'identified').length,
      totalDeals: winLossStats.total,
      winRate: winLossStats.winRate,
      lossRate: 100 - winLossStats.winRate,
      topCompetitorsBeaten: [],
      topCompetitorsLostTo: [],
      analysisUpToDate,
      analysisOverdue: activeCompetitors.length - analysisUpToDate,
      periodStart: Timestamp.fromMillis(now - periodDays * 24 * 60 * 60 * 1000),
      periodEnd: Timestamp.now(),
    };
  },
};
