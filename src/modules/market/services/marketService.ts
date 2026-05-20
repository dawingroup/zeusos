// ============================================================================
// MARKET INTELLIGENCE SERVICE
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import {
  Competitor,
  MarketSignal,
  IntelligenceItem,
  SWOTAnalysis,
  MarketIntelligenceSummary,
  CompetitorFilters,
  SignalFilters,
  IntelligenceFilters,
} from '../types/market.types';
import {
  COMPETITORS_COLLECTION,
  MARKET_SIGNALS_COLLECTION,
  INTELLIGENCE_ITEMS_COLLECTION,
  SWOT_ANALYSES_COLLECTION,
  ThreatLevel,
  SignalType,
  ImpactLevel,
} from '../constants/market.constants';
import {
  CompetitorInput,
  CompetitorUpdate,
  MarketSignalInput,
  IntelligenceItemInput,
  SWOTAnalysisInput,
} from '../schemas/market.schemas';

// ============================================================================
// COMPETITORS
// ============================================================================

export const createCompetitor = async (
  companyId: string,
  input: CompetitorInput,
  userId: string
): Promise<Competitor> => {
  const collectionRef = collection(db, COMPETITORS_COLLECTION);
  
  const competitor: Omit<Competitor, 'id'> = {
    companyId,
    ...input,
    products: input.products || [],
    strengths: input.strengths || [],
    weaknesses: input.weaknesses || [],
    differentiators: input.differentiators || [],
    signalCount: 0,
    lastUpdated: Timestamp.now(),
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, competitor);
  return { id: docRef.id, ...competitor };
};

export const getCompetitor = async (competitorId: string): Promise<Competitor | null> => {
  const docRef = doc(db, COMPETITORS_COLLECTION, competitorId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as Competitor;
};

export const getCompetitors = async (
  companyId: string,
  filters: CompetitorFilters = {}
): Promise<Competitor[]> => {
  const constraints = [
    where('companyId', '==', companyId),
  ];
  
  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }
  
  if (filters.threatLevel) {
    constraints.push(where('threatLevel', '==', filters.threatLevel));
  }
  
  if (filters.ugandaOnly) {
    constraints.push(where('ugandaPresence', '==', true));
  }
  
  const q = query(
    collection(db, COMPETITORS_COLLECTION),
    ...constraints,
    orderBy('name')
  );
  
  const snapshot = await getDocs(q);
  let competitors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Competitor[];
  
  // Filter by segments in memory
  if (filters.segments?.length) {
    competitors = competitors.filter(c => 
      c.segments.some(s => filters.segments!.includes(s))
    );
  }
  
  // Filter by search term
  if (filters.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    competitors = competitors.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.description.toLowerCase().includes(term)
    );
  }
  
  // Sort by threat level priority
  const threatOrder: Record<ThreatLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    minimal: 4,
  };
  
  competitors.sort((a, b) => threatOrder[a.threatLevel] - threatOrder[b.threatLevel]);
  
  return competitors;
};

export const updateCompetitor = async (
  competitorId: string,
  updates: CompetitorUpdate
): Promise<void> => {
  const docRef = doc(db, COMPETITORS_COLLECTION, competitorId);
  
  await updateDoc(docRef, {
    ...updates,
    lastUpdated: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
};

export const deleteCompetitor = async (competitorId: string): Promise<void> => {
  await deleteDoc(doc(db, COMPETITORS_COLLECTION, competitorId));
};

// ============================================================================
// MARKET SIGNALS
// ============================================================================

export const createMarketSignal = async (
  companyId: string,
  input: MarketSignalInput,
  userId: string,
  userName: string
): Promise<MarketSignal> => {
  const collectionRef = collection(db, MARKET_SIGNALS_COLLECTION);
  
  const signal: Omit<MarketSignal, 'id'> = {
    companyId,
    ...input,
    competitorName: '',
    addedBy: userId,
    addedByName: userName,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Get competitor name if linked
  if (input.competitorId) {
    const competitor = await getCompetitor(input.competitorId);
    if (competitor) {
      signal.competitorName = competitor.name;
      
      // Update competitor signal count
      await updateDoc(doc(db, COMPETITORS_COLLECTION, input.competitorId), {
        signalCount: competitor.signalCount + 1,
        lastSignalDate: input.signalDate,
        lastUpdated: Timestamp.now(),
      });
    }
  }
  
  const docRef = await addDoc(collectionRef, signal);
  return { id: docRef.id, ...signal };
};

export const getMarketSignal = async (signalId: string): Promise<MarketSignal | null> => {
  const docRef = doc(db, MARKET_SIGNALS_COLLECTION, signalId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as MarketSignal;
};

export const getMarketSignals = async (
  companyId: string,
  filters: SignalFilters = {}
): Promise<MarketSignal[]> => {
  const constraints = [
    where('companyId', '==', companyId),
  ];
  
  if (filters.competitorId) {
    constraints.push(where('competitorId', '==', filters.competitorId));
  }
  
  if (filters.impactLevel) {
    constraints.push(where('impactLevel', '==', filters.impactLevel));
  }
  
  if (filters.requiresAction !== undefined) {
    constraints.push(where('requiresAction', '==', filters.requiresAction));
  }
  
  const q = query(
    collection(db, MARKET_SIGNALS_COLLECTION),
    ...constraints,
    orderBy('signalDate', 'desc')
  );
  
  const snapshot = await getDocs(q);
  let signals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MarketSignal[];
  
  // Apply additional filters in memory
  if (filters.signalTypes?.length) {
    signals = signals.filter(s => filters.signalTypes!.includes(s.signalType));
  }
  
  if (filters.source) {
    signals = signals.filter(s => s.source === filters.source);
  }
  
  if (filters.dateFrom) {
    signals = signals.filter(s => new Date(s.signalDate) >= filters.dateFrom!);
  }
  
  if (filters.dateTo) {
    signals = signals.filter(s => new Date(s.signalDate) <= filters.dateTo!);
  }
  
  return signals;
};

export const updateMarketSignal = async (
  signalId: string,
  updates: Partial<MarketSignalInput>
): Promise<void> => {
  const docRef = doc(db, MARKET_SIGNALS_COLLECTION, signalId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const markSignalActioned = async (
  signalId: string,
  actionTaken: string
): Promise<void> => {
  await updateDoc(doc(db, MARKET_SIGNALS_COLLECTION, signalId), {
    actionTaken,
    actionDate: new Date(),
    requiresAction: false,
    updatedAt: Timestamp.now(),
  });
};

export const deleteMarketSignal = async (signalId: string): Promise<void> => {
  await deleteDoc(doc(db, MARKET_SIGNALS_COLLECTION, signalId));
};

// ============================================================================
// INTELLIGENCE ITEMS
// ============================================================================

export const createIntelligenceItem = async (
  companyId: string,
  input: IntelligenceItemInput,
  userId: string
): Promise<IntelligenceItem> => {
  const collectionRef = collection(db, INTELLIGENCE_ITEMS_COLLECTION);
  
  const item: Omit<IntelligenceItem, 'id'> = {
    companyId,
    ...input,
    status: 'new',
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, item);
  return { id: docRef.id, ...item };
};

export const getIntelligenceItems = async (
  companyId: string,
  filters: IntelligenceFilters = {}
): Promise<IntelligenceItem[]> => {
  const constraints = [
    where('companyId', '==', companyId),
  ];
  
  if (filters.category) {
    constraints.push(where('category', '==', filters.category));
  }
  
  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }
  
  if (filters.relevance) {
    constraints.push(where('relevance', '==', filters.relevance));
  }
  
  const q = query(
    collection(db, INTELLIGENCE_ITEMS_COLLECTION),
    ...constraints,
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as IntelligenceItem[];
  
  // Filter by segments in memory
  if (filters.segments?.length) {
    items = items.filter(item => 
      item.segments.some(s => filters.segments!.includes(s))
    );
  }
  
  return items;
};

export const updateIntelligenceItem = async (
  itemId: string,
  updates: Partial<IntelligenceItemInput> & { status?: IntelligenceItem['status'] }
): Promise<void> => {
  const docRef = doc(db, INTELLIGENCE_ITEMS_COLLECTION, itemId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteIntelligenceItem = async (itemId: string): Promise<void> => {
  await deleteDoc(doc(db, INTELLIGENCE_ITEMS_COLLECTION, itemId));
};

// ============================================================================
// SWOT ANALYSIS
// ============================================================================

export const createSWOTAnalysis = async (
  companyId: string,
  input: SWOTAnalysisInput,
  userId: string
): Promise<SWOTAnalysis> => {
  const collectionRef = collection(db, SWOT_ANALYSES_COLLECTION);
  
  const swot: Omit<SWOTAnalysis, 'id'> = {
    companyId,
    ...input,
    strengths: input.strengths.map((s, i) => ({ ...s, id: `s_${i}_${Date.now()}` })),
    weaknesses: input.weaknesses.map((w, i) => ({ ...w, id: `w_${i}_${Date.now()}` })),
    opportunities: input.opportunities.map((o, i) => ({ ...o, id: `o_${i}_${Date.now()}` })),
    threats: input.threats.map((t, i) => ({ ...t, id: `t_${i}_${Date.now()}` })),
    analysisDate: new Date(),
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, swot);
  return { id: docRef.id, ...swot };
};

export const getSWOTAnalysis = async (swotId: string): Promise<SWOTAnalysis | null> => {
  const docRef = doc(db, SWOT_ANALYSES_COLLECTION, swotId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as SWOTAnalysis;
};

export const getSWOTAnalyses = async (
  companyId: string,
  targetId?: string
): Promise<SWOTAnalysis[]> => {
  const constraints = [
    where('companyId', '==', companyId),
  ];
  
  if (targetId) {
    constraints.push(where('targetId', '==', targetId));
  }
  
  const q = query(
    collection(db, SWOT_ANALYSES_COLLECTION),
    ...constraints,
    orderBy('analysisDate', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SWOTAnalysis[];
};

export const updateSWOTAnalysis = async (
  swotId: string,
  updates: Partial<SWOTAnalysisInput>
): Promise<void> => {
  const docRef = doc(db, SWOT_ANALYSES_COLLECTION, swotId);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteSWOTAnalysis = async (swotId: string): Promise<void> => {
  await deleteDoc(doc(db, SWOT_ANALYSES_COLLECTION, swotId));
};

// ============================================================================
// ANALYTICS
// ============================================================================

export const getMarketIntelligenceSummary = async (
  companyId: string
): Promise<MarketIntelligenceSummary> => {
  const competitors = await getCompetitors(companyId);
  const signals = await getMarketSignals(companyId);
  
  // Count by threat level
  const competitorsByThreat: Record<ThreatLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    minimal: 0,
  };
  
  competitors.forEach(c => {
    competitorsByThreat[c.threatLevel]++;
  });
  
  // Recent signals (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentSignals = signals.filter(s => new Date(s.signalDate) >= thirtyDaysAgo);
  
  // Signals by type
  const signalsByType: Partial<Record<SignalType, number>> = {};
  const signalsByImpact: Record<ImpactLevel, number> = {
    major: 0,
    moderate: 0,
    minor: 0,
    unknown: 0,
  };
  
  recentSignals.forEach(s => {
    signalsByType[s.signalType] = (signalsByType[s.signalType] || 0) + 1;
    signalsByImpact[s.impactLevel]++;
  });
  
  // Top competitor updates
  const competitorSignalCounts = new Map<string, { count: number; name: string; lastSignal: Date }>();
  recentSignals.forEach(s => {
    if (s.competitorId) {
      const existing = competitorSignalCounts.get(s.competitorId);
      if (existing) {
        existing.count++;
        if (new Date(s.signalDate) > existing.lastSignal) {
          existing.lastSignal = new Date(s.signalDate);
        }
      } else {
        competitorSignalCounts.set(s.competitorId, {
          count: 1,
          name: s.competitorName || '',
          lastSignal: new Date(s.signalDate),
        });
      }
    }
  });
  
  const topCompetitorUpdates = Array.from(competitorSignalCounts.entries())
    .map(([id, data]) => ({
      competitorId: id,
      competitorName: data.name,
      signalCount: data.count,
      lastSignal: data.lastSignal,
    }))
    .sort((a, b) => b.signalCount - a.signalCount)
    .slice(0, 5);
  
  return {
    totalCompetitors: competitors.length,
    competitorsByThreat,
    recentSignals: recentSignals.length,
    signalsByType,
    signalsByImpact,
    topCompetitorUpdates,
  };
};

// Get competitor with all related signals
export const getCompetitorWithSignals = async (
  competitorId: string
): Promise<{ competitor: Competitor | null; signals: MarketSignal[] }> => {
  const competitor = await getCompetitor(competitorId);
  
  if (!competitor) {
    return { competitor: null, signals: [] };
  }
  
  const signals = await getMarketSignals(competitor.companyId, { competitorId });
  
  return { competitor, signals };
};

// Get actionable signals
export const getActionableSignals = async (companyId: string): Promise<MarketSignal[]> => {
  return getMarketSignals(companyId, { requiresAction: true });
};
