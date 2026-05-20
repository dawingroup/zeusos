// ============================================================================
// MARKET RESEARCH SERVICE
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import {
  IndustryTrend,
  PESTLEFactor,
  PESTLEAnalysis,
  ResearchReport,
  MarketIndicatorValue,
  ResearchSource,
  MarketResearchSummary,
  TrendFilters,
  ResearchReportFilters,
} from '../types/research.types';
import {
  IndustryTrendInput,
  IndustryTrendUpdate,
  PESTLEFactorInput,
  PESTLEFactorUpdate,
  ResearchReportInput,
  MarketIndicatorInput,
  ResearchSourceInput,
} from '../schemas/research.schemas';
import {
  MARKET_TRENDS_COLLECTION,
  INDUSTRY_REPORTS_COLLECTION,
  PESTLE_FACTORS_COLLECTION,
  MARKET_INDICATORS_COLLECTION,
  RESEARCH_SOURCES_COLLECTION,
  TrendCategory,
  TrendStatus,
  ResearchReportStatus,
} from '../constants/research.constants';
import { PESTLECategory } from '../constants/market.constants';

// ============================================================================
// INDUSTRY TRENDS
// ============================================================================

export const createTrend = async (
  companyId: string,
  input: IndustryTrendInput,
  userId: string
): Promise<IndustryTrend> => {
  const collectionRef = collection(db, MARKET_TRENDS_COLLECTION);
  
  const trend: Omit<IndustryTrend, 'id'> = {
    companyId,
    ...input,
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, trend);
  return { id: docRef.id, ...trend };
};

export const getTrend = async (trendId: string): Promise<IndustryTrend | null> => {
  const docRef = doc(db, MARKET_TRENDS_COLLECTION, trendId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as IndustryTrend;
};

export const getTrends = async (
  companyId: string,
  filters?: TrendFilters
): Promise<IndustryTrend[]> => {
  const constraints = [
    where('companyId', '==', companyId),
  ];
  
  if (filters?.category) {
    constraints.push(where('category', '==', filters.category));
  }
  
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  
  if (filters?.businessImpact) {
    constraints.push(where('businessImpact', '==', filters.businessImpact));
  }
  
  if (filters?.isUgandaSpecific !== undefined) {
    constraints.push(where('isUgandaSpecific', '==', filters.isUgandaSpecific));
  }
  
  const q = query(
    collection(db, MARKET_TRENDS_COLLECTION),
    ...constraints,
    orderBy('identifiedDate', 'desc')
  );
  
  const snapshot = await getDocs(q);
  let trends = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as IndustryTrend[];
  
  // Client-side filtering
  if (filters?.segment) {
    trends = trends.filter(t => t.segments.includes(filters.segment!));
  }
  
  if (filters?.searchTerm) {
    const term = filters.searchTerm.toLowerCase();
    trends = trends.filter(t =>
      t.title.toLowerCase().includes(term) ||
      t.description.toLowerCase().includes(term)
    );
  }
  
  return trends;
};

export const updateTrend = async (
  trendId: string,
  updates: IndustryTrendUpdate
): Promise<void> => {
  const docRef = doc(db, MARKET_TRENDS_COLLECTION, trendId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteTrend = async (trendId: string): Promise<void> => {
  const docRef = doc(db, MARKET_TRENDS_COLLECTION, trendId);
  await deleteDoc(docRef);
};

// ============================================================================
// PESTLE FACTORS
// ============================================================================

export const createPESTLEFactor = async (
  companyId: string,
  input: PESTLEFactorInput,
  userId: string
): Promise<PESTLEFactor> => {
  const collectionRef = collection(db, PESTLE_FACTORS_COLLECTION);
  
  const factor: Omit<PESTLEFactor, 'id'> = {
    companyId,
    ...input,
    lastAssessedDate: new Date(),
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, factor);
  return { id: docRef.id, ...factor };
};

export const getPESTLEFactor = async (factorId: string): Promise<PESTLEFactor | null> => {
  const docRef = doc(db, PESTLE_FACTORS_COLLECTION, factorId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as PESTLEFactor;
};

export const getPESTLEFactors = async (
  companyId: string,
  category?: PESTLECategory,
  activeOnly: boolean = true
): Promise<PESTLEFactor[]> => {
  const constraints = [
    where('companyId', '==', companyId),
  ];
  
  if (activeOnly) {
    constraints.push(where('status', '==', 'active'));
  }
  
  if (category) {
    constraints.push(where('category', '==', category));
  }
  
  const q = query(
    collection(db, PESTLE_FACTORS_COLLECTION),
    ...constraints,
    orderBy('riskScore', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PESTLEFactor[];
};

export const updatePESTLEFactor = async (
  factorId: string,
  updates: PESTLEFactorUpdate
): Promise<void> => {
  const docRef = doc(db, PESTLE_FACTORS_COLLECTION, factorId);
  await updateDoc(docRef, {
    ...updates,
    lastAssessedDate: new Date(),
    updatedAt: Timestamp.now(),
  });
};

export const deletePESTLEFactor = async (factorId: string): Promise<void> => {
  const docRef = doc(db, PESTLE_FACTORS_COLLECTION, factorId);
  await deleteDoc(docRef);
};

export const generatePESTLEAnalysis = async (
  companyId: string,
  title: string,
  userId: string
): Promise<PESTLEAnalysis> => {
  // Fetch all active factors grouped by category
  const allFactors = await getPESTLEFactors(companyId);
  
  const groupedFactors: Record<PESTLECategory, PESTLEFactor[]> = {
    political: [],
    economic: [],
    social: [],
    technological: [],
    legal: [],
    environmental: [],
  };
  
  allFactors.forEach(factor => {
    groupedFactors[factor.category].push(factor);
  });
  
  // Calculate overall sentiment
  const sentimentScores: number[] = allFactors.map(f => {
    switch (f.sentiment) {
      case 'positive': return 1;
      case 'negative': return -1;
      case 'mixed': return 0;
      default: return 0;
    }
  });
  
  const avgSentiment = sentimentScores.length > 0
    ? sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length
    : 0;
  
  let overallSentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  if (avgSentiment > 0.3) overallSentiment = 'positive';
  else if (avgSentiment < -0.3) overallSentiment = 'negative';
  else if (Math.abs(avgSentiment) < 0.1) overallSentiment = 'neutral';
  else overallSentiment = 'mixed';
  
  // Extract key risks and opportunities
  const keyRisks = allFactors
    .filter(f => f.riskScore >= 7)
    .map(f => f.title)
    .slice(0, 5);
  
  const keyOpportunities = allFactors
    .filter(f => f.opportunityScore >= 7)
    .map(f => f.title)
    .slice(0, 5);
  
  const analysis: PESTLEAnalysis = {
    id: `pestle_${Date.now()}`,
    companyId,
    title,
    analysisDate: new Date(),
    political: groupedFactors.political,
    economic: groupedFactors.economic,
    social: groupedFactors.social,
    technological: groupedFactors.technological,
    legal: groupedFactors.legal,
    environmental: groupedFactors.environmental,
    overallSentiment,
    keyRisks,
    keyOpportunities,
    strategicImplications: [],
    preparedBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  return analysis;
};

// ============================================================================
// RESEARCH REPORTS
// ============================================================================

export const createResearchReport = async (
  companyId: string,
  input: ResearchReportInput,
  userId: string
): Promise<ResearchReport> => {
  const collectionRef = collection(db, INDUSTRY_REPORTS_COLLECTION);
  
  const report: Omit<ResearchReport, 'id'> = {
    companyId,
    ...input,
    status: 'draft',
    sections: input.sections.map((s, i) => ({ ...s, id: `section_${i}_${Date.now()}` })),
    attachments: [],
    author: userId,
    version: 1,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, report);
  return { id: docRef.id, ...report };
};

export const getResearchReport = async (reportId: string): Promise<ResearchReport | null> => {
  const docRef = doc(db, INDUSTRY_REPORTS_COLLECTION, reportId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as ResearchReport;
};

export const getResearchReports = async (
  companyId: string,
  filters?: ResearchReportFilters
): Promise<ResearchReport[]> => {
  const constraints = [
    where('companyId', '==', companyId),
  ];
  
  if (filters?.reportType) {
    constraints.push(where('reportType', '==', filters.reportType));
  }
  
  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  
  if (filters?.author) {
    constraints.push(where('author', '==', filters.author));
  }
  
  const q = query(
    collection(db, INDUSTRY_REPORTS_COLLECTION),
    ...constraints,
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  let reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ResearchReport[];
  
  // Client-side filtering for dates
  if (filters?.startDate) {
    reports = reports.filter(r => r.createdAt.toDate() >= filters.startDate!);
  }
  
  if (filters?.endDate) {
    reports = reports.filter(r => r.createdAt.toDate() <= filters.endDate!);
  }
  
  if (filters?.segment) {
    reports = reports.filter(r => r.segments.includes(filters.segment!));
  }
  
  return reports;
};

export const updateResearchReport = async (
  reportId: string,
  updates: Partial<ResearchReportInput>
): Promise<void> => {
  const docRef = doc(db, INDUSTRY_REPORTS_COLLECTION, reportId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const updateResearchReportStatus = async (
  reportId: string,
  status: ResearchReportStatus,
  userId?: string
): Promise<void> => {
  const docRef = doc(db, INDUSTRY_REPORTS_COLLECTION, reportId);
  const updates: Record<string, unknown> = {
    status,
    updatedAt: Timestamp.now(),
  };
  
  if (status === 'approved' && userId) {
    updates.approvedBy = userId;
    updates.approvedAt = Timestamp.now();
  }
  
  if (status === 'published') {
    updates.publishedAt = Timestamp.now();
  }
  
  await updateDoc(docRef, updates);
};

export const deleteResearchReport = async (reportId: string): Promise<void> => {
  const docRef = doc(db, INDUSTRY_REPORTS_COLLECTION, reportId);
  await deleteDoc(docRef);
};

// ============================================================================
// MARKET INDICATORS
// ============================================================================

export const recordIndicator = async (
  companyId: string,
  input: MarketIndicatorInput,
  userId: string
): Promise<MarketIndicatorValue> => {
  const collectionRef = collection(db, MARKET_INDICATORS_COLLECTION);
  
  // Calculate change percent if previous value provided
  let changePercent: number | undefined;
  if (input.previousValue !== undefined && input.previousValue !== 0) {
    changePercent = ((input.value - input.previousValue) / Math.abs(input.previousValue)) * 100;
  }
  
  const indicator: Omit<MarketIndicatorValue, 'id'> = {
    companyId,
    ...input,
    changePercent,
    createdBy: userId,
    createdAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, indicator);
  return { id: docRef.id, ...indicator };
};

export const getIndicators = async (
  companyId: string,
  indicatorId?: string,
  periodType?: 'monthly' | 'quarterly' | 'annual'
): Promise<MarketIndicatorValue[]> => {
  const constraints = [
    where('companyId', '==', companyId),
  ];
  
  if (indicatorId) {
    constraints.push(where('indicatorId', '==', indicatorId));
  }
  
  if (periodType) {
    constraints.push(where('periodType', '==', periodType));
  }
  
  const q = query(
    collection(db, MARKET_INDICATORS_COLLECTION),
    ...constraints,
    orderBy('publishDate', 'desc'),
    limit(100)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MarketIndicatorValue[];
};

export const getLatestIndicators = async (companyId: string): Promise<MarketIndicatorValue[]> => {
  const allIndicators = await getIndicators(companyId);
  
  // Get most recent value for each indicator
  const latestByIndicator = new Map<string, MarketIndicatorValue>();
  allIndicators.forEach(ind => {
    const existing = latestByIndicator.get(ind.indicatorId);
    if (!existing || new Date(ind.publishDate) > new Date(existing.publishDate)) {
      latestByIndicator.set(ind.indicatorId, ind);
    }
  });
  
  return Array.from(latestByIndicator.values());
};

export const deleteIndicator = async (indicatorId: string): Promise<void> => {
  const docRef = doc(db, MARKET_INDICATORS_COLLECTION, indicatorId);
  await deleteDoc(docRef);
};

// ============================================================================
// RESEARCH SOURCES
// ============================================================================

export const createResearchSource = async (
  companyId: string,
  input: ResearchSourceInput,
  userId: string
): Promise<ResearchSource> => {
  const collectionRef = collection(db, RESEARCH_SOURCES_COLLECTION);
  
  const source: Omit<ResearchSource, 'id'> = {
    companyId,
    ...input,
    usageCount: 0,
    createdBy: userId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collectionRef, source);
  return { id: docRef.id, ...source };
};

export const getResearchSource = async (sourceId: string): Promise<ResearchSource | null> => {
  const docRef = doc(db, RESEARCH_SOURCES_COLLECTION, sourceId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as ResearchSource;
};

export const getResearchSources = async (companyId: string): Promise<ResearchSource[]> => {
  const q = query(
    collection(db, RESEARCH_SOURCES_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('credibilityScore', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ResearchSource[];
};

export const updateResearchSource = async (
  sourceId: string,
  updates: Partial<ResearchSourceInput>
): Promise<void> => {
  const docRef = doc(db, RESEARCH_SOURCES_COLLECTION, sourceId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const recordSourceUsage = async (sourceId: string): Promise<void> => {
  const docRef = doc(db, RESEARCH_SOURCES_COLLECTION, sourceId);
  const snapshot = await getDoc(docRef);
  
  if (snapshot.exists()) {
    const current = snapshot.data();
    await updateDoc(docRef, {
      usageCount: (current.usageCount || 0) + 1,
      lastAccessed: new Date(),
      updatedAt: Timestamp.now(),
    });
  }
};

export const deleteResearchSource = async (sourceId: string): Promise<void> => {
  const docRef = doc(db, RESEARCH_SOURCES_COLLECTION, sourceId);
  await deleteDoc(docRef);
};

// ============================================================================
// ANALYTICS
// ============================================================================

export const getMarketResearchSummary = async (
  companyId: string
): Promise<MarketResearchSummary> => {
  const [trends, factors, reports, indicators] = await Promise.all([
    getTrends(companyId),
    getPESTLEFactors(companyId),
    getResearchReports(companyId),
    getLatestIndicators(companyId),
  ]);
  
  // Trends by category
  const trendsByCategory: Record<TrendCategory, number> = {
    technology: 0,
    regulatory: 0,
    consumer: 0,
    economic: 0,
    competitive: 0,
    demographic: 0,
    environmental: 0,
    political: 0,
  };
  
  const trendsByStatus: Record<TrendStatus, number> = {
    emerging: 0,
    growing: 0,
    mature: 0,
    declining: 0,
    stable: 0,
  };
  
  trends.forEach(t => {
    trendsByCategory[t.category]++;
    trendsByStatus[t.status]++;
  });
  
  // PESTLE by category
  const pestleByCategory: Record<PESTLECategory, number> = {
    political: 0,
    economic: 0,
    social: 0,
    technological: 0,
    legal: 0,
    environmental: 0,
  };
  
  factors.forEach(f => {
    pestleByCategory[f.category]++;
  });
  
  // Reports this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const reportsThisMonth = reports.filter(r => r.createdAt.toDate() >= startOfMonth).length;
  
  // Extract top opportunities and risks
  const topOpportunities = trends
    .filter(t => t.businessImpact === 'opportunity')
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5)
    .map(t => t.title);
  
  const topRisks = trends
    .filter(t => t.businessImpact === 'threat')
    .sort((a, b) => b.impactScore - a.impactScore)
    .slice(0, 5)
    .map(t => t.title);
  
  return {
    totalTrends: trends.length,
    trendsByCategory,
    trendsByStatus,
    activePESTLEFactors: factors.length,
    pestleByCategory,
    totalReports: reports.length,
    reportsThisMonth,
    topOpportunities,
    topRisks,
    latestIndicators: indicators,
  };
};
