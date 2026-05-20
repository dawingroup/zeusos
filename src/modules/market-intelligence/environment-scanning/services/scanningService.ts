// ============================================================================
// ENVIRONMENT SCANNING SERVICE
// DawinOS v2.0 - Market Intelligence Module
// Firebase Firestore CRUD operations for environment scanning
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import {
  PESTELAnalysis,
  PESTELFactor,
  EnvironmentSignal,
  SignalStatusChange,
  RegulatoryItem,
  RegulatoryStatusChange,
  Scenario,
  EarlyWarningAlert,
  AlertTrigger,
  TrackedIndicator,
  IndicatorDataPoint,
  EnvironmentScanningAnalytics,
  PESTELAnalysisFilters,
  SignalFilters,
  RegulatoryFilters,
  ScenarioFilters,
  AlertFilters,
} from '../types/scanning.types';
import {
  SignalStatus,
  RegulatoryStatus,
  SCANNING_COLLECTIONS,
  IMPACT_LEVEL_CONFIG,
  PROBABILITY_LEVEL_CONFIG,
  ImpactLevel,
  ProbabilityLevel,
} from '../constants/scanning.constants';
import {
  pestelAnalysisSchema,
  pestelFactorSchema,
  signalSchema,
  regulatoryItemSchema,
  scenarioSchema,
  alertTriggerSchema,
  trackedIndicatorSchema,
} from '../schemas/scanning.schemas';

// ----------------------------------------------------------------------------
// COLLECTION REFERENCES
// ----------------------------------------------------------------------------

const COLLECTIONS = SCANNING_COLLECTIONS;

// ----------------------------------------------------------------------------
// HELPER FUNCTIONS
// ----------------------------------------------------------------------------

function calculateRiskScore(impact: ImpactLevel, probability: ProbabilityLevel): number {
  const impactScore = IMPACT_LEVEL_CONFIG[impact]?.score || 3;
  const probabilityScore = PROBABILITY_LEVEL_CONFIG[probability]?.score || 3;
  return impactScore * probabilityScore;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// ----------------------------------------------------------------------------
// PESTEL ANALYSIS SERVICE
// ----------------------------------------------------------------------------

export async function createPESTELAnalysis(
  data: Omit<PESTELAnalysis, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status'>,
  userId: string
): Promise<PESTELAnalysis> {
  const validation = pestelAnalysisSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.message}`);
  }

  const now = Timestamp.now();
  const analysis: Omit<PESTELAnalysis, 'id'> = {
    ...data,
    factors: data.factors || [],
    summary: data.summary || {
      overallImpact: 'medium',
      keyOpportunities: [],
      keyThreats: [],
      strategicImplications: [],
    },
    status: 'draft',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    version: 1,
    linkedScenarios: [],
    linkedSignals: [],
    linkedRegulations: [],
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.PESTEL_ANALYSES), analysis);
  return { id: docRef.id, ...analysis };
}

export async function getPESTELAnalysis(id: string): Promise<PESTELAnalysis | null> {
  const docRef = doc(db, COLLECTIONS.PESTEL_ANALYSES, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as PESTELAnalysis;
}

export async function getPESTELAnalyses(
  filters?: PESTELAnalysisFilters
): Promise<PESTELAnalysis[]> {
  let q = query(
    collection(db, COLLECTIONS.PESTEL_ANALYSES),
    orderBy('createdAt', 'desc')
  );
  
  if (filters?.status?.length) {
    q = query(q, where('status', 'in', filters.status));
  }
  
  const snapshot = await getDocs(q);
  let analyses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PESTELAnalysis));
  
  if (filters?.dimensions?.length) {
    analyses = analyses.filter(a => 
      a.factors.some(f => filters.dimensions!.includes(f.dimension))
    );
  }
  
  if (filters?.industries?.length) {
    analyses = analyses.filter(a => 
      a.scope.industries.some(i => filters.industries!.includes(i))
    );
  }
  
  return analyses;
}

export async function updatePESTELAnalysis(
  id: string,
  data: Partial<PESTELAnalysis>
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.PESTEL_ANALYSES, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function addPESTELFactor(
  analysisId: string,
  factor: Omit<PESTELFactor, 'id' | 'lastUpdated'>
): Promise<PESTELFactor> {
  const validation = pestelFactorSchema.safeParse(factor);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.message}`);
  }

  const analysis = await getPESTELAnalysis(analysisId);
  if (!analysis) {
    throw new Error('PESTEL analysis not found');
  }

  const now = Timestamp.now();
  const riskScore = calculateRiskScore(factor.impact.level, factor.impact.probability);
  
  const newFactor: PESTELFactor = {
    ...factor,
    id: generateId(),
    impact: {
      ...factor.impact,
      riskScore,
    },
    lastUpdated: now,
  };

  const docRef = doc(db, COLLECTIONS.PESTEL_ANALYSES, analysisId);
  await updateDoc(docRef, {
    factors: [...analysis.factors, newFactor],
    updatedAt: now,
  });

  return newFactor;
}

export async function updatePESTELAnalysisStatus(
  id: string,
  status: PESTELAnalysis['status'],
  reviewedBy?: string
): Promise<void> {
  const updates: Partial<PESTELAnalysis> = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === 'completed' && reviewedBy) {
    updates.reviewedBy = reviewedBy;
    updates.reviewedAt = Timestamp.now();
  }

  await updatePESTELAnalysis(id, updates);
}

export async function generatePESTELSummary(analysisId: string): Promise<void> {
  const analysis = await getPESTELAnalysis(analysisId);
  if (!analysis) {
    throw new Error('PESTEL analysis not found');
  }

  const opportunities = analysis.factors
    .filter(f => f.type === 'opportunity')
    .sort((a, b) => b.impact.riskScore - a.impact.riskScore)
    .slice(0, 5)
    .map(f => f.title);

  const threats = analysis.factors
    .filter(f => f.type === 'threat')
    .sort((a, b) => b.impact.riskScore - a.impact.riskScore)
    .slice(0, 5)
    .map(f => f.title);

  const avgRiskScore = analysis.factors.length > 0
    ? analysis.factors.reduce((sum, f) => sum + f.impact.riskScore, 0) / analysis.factors.length
    : 0;

  let overallImpact: ImpactLevel = 'medium';
  if (avgRiskScore >= 20) overallImpact = 'very_high';
  else if (avgRiskScore >= 15) overallImpact = 'high';
  else if (avgRiskScore >= 10) overallImpact = 'medium';
  else if (avgRiskScore >= 5) overallImpact = 'low';
  else overallImpact = 'very_low';

  await updatePESTELAnalysis(analysisId, {
    summary: {
      overallImpact,
      keyOpportunities: opportunities,
      keyThreats: threats,
      strategicImplications: analysis.summary?.strategicImplications || [],
    },
  });
}

// ----------------------------------------------------------------------------
// SIGNAL SERVICE
// ----------------------------------------------------------------------------

export async function createSignal(
  data: Omit<EnvironmentSignal, 'id' | 'detectedAt' | 'updatedAt' | 'status' | 'statusHistory'>,
  userId: string
): Promise<EnvironmentSignal> {
  const validation = signalSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.message}`);
  }

  const now = Timestamp.now();
  const signal: Omit<EnvironmentSignal, 'id'> = {
    ...data,
    status: 'new',
    statusHistory: [],
    relatedSignals: data.relatedSignals || [],
    relatedRegulations: data.relatedRegulations || [],
    linkedAnalyses: data.linkedAnalyses || [],
    actionItems: data.actionItems || [],
    detectedBy: userId,
    detectedAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.SIGNALS), signal);
  return { id: docRef.id, ...signal };
}

export async function getSignal(id: string): Promise<EnvironmentSignal | null> {
  const docRef = doc(db, COLLECTIONS.SIGNALS, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as EnvironmentSignal;
}

export async function getSignals(filters?: SignalFilters): Promise<EnvironmentSignal[]> {
  let q = query(
    collection(db, COLLECTIONS.SIGNALS),
    orderBy('detectedAt', 'desc')
  );
  
  if (filters?.signalType?.length) {
    q = query(q, where('signalType', 'in', filters.signalType));
  }
  
  if (filters?.status?.length) {
    q = query(q, where('status', 'in', filters.status));
  }
  
  const snapshot = await getDocs(q);
  let signals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EnvironmentSignal));
  
  if (filters?.dimension?.length) {
    signals = signals.filter(s => filters.dimension!.includes(s.pestelDimension));
  }
  
  if (filters?.source?.length) {
    signals = signals.filter(s => filters.source!.includes(s.source));
  }
  
  if (filters?.confidenceMin !== undefined) {
    signals = signals.filter(s => s.assessment.confidenceLevel >= filters.confidenceMin!);
  }
  
  return signals;
}

export async function updateSignalStatus(
  id: string,
  newStatus: SignalStatus,
  userId: string,
  reason: string
): Promise<void> {
  const signal = await getSignal(id);
  if (!signal) {
    throw new Error('Signal not found');
  }

  const statusChange: SignalStatusChange = {
    fromStatus: signal.status,
    toStatus: newStatus,
    changedBy: userId,
    changedAt: Timestamp.now(),
    reason,
  };

  const docRef = doc(db, COLLECTIONS.SIGNALS, id);
  await updateDoc(docRef, {
    status: newStatus,
    statusHistory: [...signal.statusHistory, statusChange],
    updatedAt: Timestamp.now(),
    ...(newStatus === 'validated' ? { validatedBy: userId, validatedAt: Timestamp.now() } : {}),
  });
}

export async function addSignalActionItem(
  signalId: string,
  actionItem: Omit<EnvironmentSignal['actionItems'][0], 'id'>
): Promise<void> {
  const signal = await getSignal(signalId);
  if (!signal) {
    throw new Error('Signal not found');
  }

  const newActionItem = {
    ...actionItem,
    id: generateId(),
  };

  const docRef = doc(db, COLLECTIONS.SIGNALS, signalId);
  await updateDoc(docRef, {
    actionItems: [...signal.actionItems, newActionItem],
    updatedAt: Timestamp.now(),
  });
}

// ----------------------------------------------------------------------------
// REGULATORY SERVICE
// ----------------------------------------------------------------------------

export async function createRegulatoryItem(
  data: Omit<RegulatoryItem, 'id' | 'trackedAt' | 'updatedAt' | 'statusHistory'>,
  userId: string
): Promise<RegulatoryItem> {
  const validation = regulatoryItemSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.message}`);
  }

  const now = Timestamp.now();
  const item: Omit<RegulatoryItem, 'id'> = {
    ...data,
    statusHistory: [],
    compliance: data.compliance || {
      status: 'under_review',
      requirements: [],
    },
    documents: data.documents || [],
    relatedRegulations: data.relatedRegulations || [],
    linkedSignals: data.linkedSignals || [],
    trackedBy: userId,
    trackedAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.REGULATIONS), item);
  return { id: docRef.id, ...item };
}

export async function getRegulatoryItem(id: string): Promise<RegulatoryItem | null> {
  const docRef = doc(db, COLLECTIONS.REGULATIONS, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as RegulatoryItem;
}

export async function getRegulatoryItems(
  filters?: RegulatoryFilters
): Promise<RegulatoryItem[]> {
  let q = query(
    collection(db, COLLECTIONS.REGULATIONS),
    orderBy('trackedAt', 'desc')
  );
  
  if (filters?.category?.length) {
    q = query(q, where('category', 'in', filters.category));
  }
  
  if (filters?.status?.length) {
    q = query(q, where('status', 'in', filters.status));
  }
  
  const snapshot = await getDocs(q);
  let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RegulatoryItem));
  
  if (filters?.complianceStatus?.length) {
    items = items.filter(i => filters.complianceStatus!.includes(i.compliance.status));
  }
  
  if (filters?.jurisdiction?.length) {
    items = items.filter(i => filters.jurisdiction!.includes(i.jurisdiction));
  }
  
  if (filters?.impactLevel?.length) {
    items = items.filter(i => filters.impactLevel!.includes(i.impact.level));
  }
  
  return items;
}

export async function updateRegulatoryStatus(
  id: string,
  newStatus: RegulatoryStatus,
  userId: string,
  notes?: string
): Promise<void> {
  const item = await getRegulatoryItem(id);
  if (!item) {
    throw new Error('Regulatory item not found');
  }

  const statusChange: RegulatoryStatusChange = {
    fromStatus: item.status,
    toStatus: newStatus,
    changedBy: userId,
    changedAt: Timestamp.now(),
    notes,
  };

  const docRef = doc(db, COLLECTIONS.REGULATIONS, id);
  await updateDoc(docRef, {
    status: newStatus,
    statusHistory: [...item.statusHistory, statusChange],
    updatedAt: Timestamp.now(),
  });
}

export async function updateComplianceStatus(
  id: string,
  complianceData: Partial<RegulatoryItem['compliance']>
): Promise<void> {
  const item = await getRegulatoryItem(id);
  if (!item) {
    throw new Error('Regulatory item not found');
  }

  const docRef = doc(db, COLLECTIONS.REGULATIONS, id);
  await updateDoc(docRef, {
    compliance: { ...item.compliance, ...complianceData },
    updatedAt: Timestamp.now(),
  });
}

export async function getUpcomingDeadlines(
  daysAhead: number = 90
): Promise<RegulatoryItem[]> {
  const now = Timestamp.now();
  const futureDate = Timestamp.fromDate(
    new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000)
  );

  const q = query(
    collection(db, COLLECTIONS.REGULATIONS),
    where('dates.effectiveDate', '>=', now),
    where('dates.effectiveDate', '<=', futureDate),
    orderBy('dates.effectiveDate', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RegulatoryItem));
}

// ----------------------------------------------------------------------------
// SCENARIO SERVICE
// ----------------------------------------------------------------------------

export async function createScenario(
  data: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  userId: string
): Promise<Scenario> {
  const validation = scenarioSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.message}`);
  }

  const now = Timestamp.now();
  
  const drivingForcesWithIds = (data.drivingForces || []).map(df => ({
    ...df,
    id: generateId(),
  }));
  
  const assumptionsWithIds = (data.assumptions || []).map(a => ({
    ...a,
    id: generateId(),
  }));
  
  const strategicOptionsWithIds = (data.strategicOptions || []).map(so => ({
    ...so,
    id: generateId(),
  }));
  
  const signpostsWithIds = (data.signposts || []).map(sp => ({
    ...sp,
    id: generateId(),
    status: 'not_triggered' as const,
  }));

  const scenario: Omit<Scenario, 'id'> = {
    ...data,
    drivingForces: drivingForcesWithIds,
    assumptions: assumptionsWithIds,
    strategicOptions: strategicOptionsWithIds,
    signposts: signpostsWithIds,
    status: 'draft',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    linkedPESTEL: data.linkedPESTEL || [],
    linkedSignals: data.linkedSignals || [],
    linkedRegulations: data.linkedRegulations || [],
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.SCENARIOS), scenario);
  return { id: docRef.id, ...scenario };
}

export async function getScenario(id: string): Promise<Scenario | null> {
  const docRef = doc(db, COLLECTIONS.SCENARIOS, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return { id: docSnap.id, ...docSnap.data() } as Scenario;
}

export async function getScenarios(filters?: ScenarioFilters): Promise<Scenario[]> {
  let q = query(
    collection(db, COLLECTIONS.SCENARIOS),
    orderBy('createdAt', 'desc')
  );
  
  if (filters?.type?.length) {
    q = query(q, where('type', 'in', filters.type));
  }
  
  if (filters?.status?.length) {
    q = query(q, where('status', 'in', filters.status));
  }
  
  const snapshot = await getDocs(q);
  let scenarios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Scenario));
  
  if (filters?.probabilityRange) {
    scenarios = scenarios.filter(s => 
      s.probability >= filters.probabilityRange!.min &&
      s.probability <= filters.probabilityRange!.max
    );
  }
  
  return scenarios;
}

export async function updateScenario(
  id: string,
  data: Partial<Scenario>
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SCENARIOS, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

export async function updateScenarioStatus(
  id: string,
  status: Scenario['status'],
  approvedBy?: string
): Promise<void> {
  const updates: Partial<Scenario> = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === 'approved' && approvedBy) {
    updates.approvedBy = approvedBy;
    updates.approvedAt = Timestamp.now();
  }

  await updateScenario(id, updates);
}

export async function updateSignpostStatus(
  scenarioId: string,
  signpostId: string,
  currentValue: number
): Promise<void> {
  const scenario = await getScenario(scenarioId);
  if (!scenario) {
    throw new Error('Scenario not found');
  }

  const updatedSignposts = scenario.signposts.map(sp => {
    if (sp.id !== signpostId) return sp;

    let status: 'not_triggered' | 'approaching' | 'triggered' = 'not_triggered';
    const threshold = sp.threshold;

    if (threshold !== undefined) {
      switch (sp.direction) {
        case 'above':
          if (currentValue > threshold) status = 'triggered';
          else if (currentValue > threshold * 0.9) status = 'approaching';
          break;
        case 'below':
          if (currentValue < threshold) status = 'triggered';
          else if (currentValue < threshold * 1.1) status = 'approaching';
          break;
        case 'equals':
          if (Math.abs(currentValue - threshold) < 0.01) status = 'triggered';
          else if (Math.abs(currentValue - threshold) / threshold < 0.1) status = 'approaching';
          break;
        case 'changes':
          if (sp.currentValue !== undefined && Math.abs(currentValue - sp.currentValue) > 0) {
            status = 'triggered';
          }
          break;
      }
    }

    return {
      ...sp,
      currentValue,
      lastChecked: Timestamp.now(),
      status,
    };
  });

  await updateScenario(scenarioId, { signposts: updatedSignposts });
}

// ----------------------------------------------------------------------------
// EARLY WARNING SERVICE
// ----------------------------------------------------------------------------

export async function createAlertTrigger(
  data: Omit<AlertTrigger, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<AlertTrigger> {
  const validation = alertTriggerSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.message}`);
  }

  const now = Timestamp.now();
  const trigger: Omit<AlertTrigger, 'id'> = {
    ...data,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.TRIGGERS), trigger);
  return { id: docRef.id, ...trigger };
}

export async function getActiveTriggers(): Promise<AlertTrigger[]> {
  const q = query(
    collection(db, COLLECTIONS.TRIGGERS),
    where('isActive', '==', true)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AlertTrigger));
}

export async function createAlert(
  data: Omit<EarlyWarningAlert, 'id' | 'createdAt' | 'notificationsSent' | 'status'>
): Promise<EarlyWarningAlert> {
  const now = Timestamp.now();
  const alert: Omit<EarlyWarningAlert, 'id'> = {
    ...data,
    status: 'active',
    notificationsSent: [],
    createdAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.ALERTS), alert);
  return { id: docRef.id, ...alert };
}

export async function getAlerts(filters?: AlertFilters): Promise<EarlyWarningAlert[]> {
  let q = query(
    collection(db, COLLECTIONS.ALERTS),
    orderBy('createdAt', 'desc')
  );
  
  if (filters?.priority?.length) {
    q = query(q, where('priority', 'in', filters.priority));
  }
  
  if (filters?.status?.length) {
    q = query(q, where('status', 'in', filters.status));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EarlyWarningAlert));
}

export async function acknowledgeAlert(
  id: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ALERTS, id);
  await updateDoc(docRef, {
    status: 'acknowledged',
    acknowledgedBy: userId,
    acknowledgedAt: Timestamp.now(),
  });
}

export async function resolveAlert(
  id: string,
  userId: string,
  resolution: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.ALERTS, id);
  await updateDoc(docRef, {
    status: 'resolved',
    resolvedBy: userId,
    resolvedAt: Timestamp.now(),
    resolution,
  });
}

// ----------------------------------------------------------------------------
// INDICATOR SERVICE
// ----------------------------------------------------------------------------

export async function trackIndicator(
  data: Omit<TrackedIndicator, 'id' | 'lastUpdated' | 'trend' | 'changePercent' | 'alertStatus'>
): Promise<TrackedIndicator> {
  const validation = trackedIndicatorSchema.safeParse(data);
  if (!validation.success) {
    throw new Error(`Validation failed: ${validation.error.message}`);
  }

  const now = Timestamp.now();
  const indicator: Omit<TrackedIndicator, 'id'> = {
    ...data,
    previousValue: data.currentValue,
    changePercent: 0,
    trend: 'stable',
    alertStatus: 'normal',
    history: data.history || [{ date: now, value: data.currentValue }],
    lastUpdated: now,
  };

  const docRef = await addDoc(collection(db, COLLECTIONS.INDICATORS), indicator);
  return { id: docRef.id, ...indicator };
}

export async function updateIndicatorValue(
  id: string,
  value: number,
  source?: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.INDICATORS, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Indicator not found');
  }

  const indicator = docSnap.data() as TrackedIndicator;
  const previousValue = indicator.currentValue;
  const changePercent = previousValue !== 0 
    ? ((value - previousValue) / previousValue) * 100 
    : 0;

  let trend: TrackedIndicator['trend'] = 'stable';
  if (changePercent > 1) trend = 'up';
  else if (changePercent < -1) trend = 'down';

  let alertStatus: TrackedIndicator['alertStatus'] = 'normal';
  const thresholds = indicator.thresholds;
  if (thresholds) {
    if (thresholds.critical_high !== undefined && value > thresholds.critical_high) {
      alertStatus = 'critical';
    } else if (thresholds.critical_low !== undefined && value < thresholds.critical_low) {
      alertStatus = 'critical';
    } else if (thresholds.warning_high !== undefined && value > thresholds.warning_high) {
      alertStatus = 'warning';
    } else if (thresholds.warning_low !== undefined && value < thresholds.warning_low) {
      alertStatus = 'warning';
    }
  }

  const now = Timestamp.now();
  const newDataPoint: IndicatorDataPoint = { date: now, value, source };

  await updateDoc(docRef, {
    currentValue: value,
    previousValue,
    changePercent,
    trend,
    alertStatus,
    history: [...indicator.history.slice(-99), newDataPoint],
    lastUpdated: now,
  });
}

export async function getTrackedIndicators(): Promise<TrackedIndicator[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.INDICATORS));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TrackedIndicator));
}

// ----------------------------------------------------------------------------
// ANALYTICS SERVICE
// ----------------------------------------------------------------------------

export async function getEnvironmentScanningAnalytics(): Promise<EnvironmentScanningAnalytics> {
  const now = Timestamp.now();
  const thirtyDaysAgo = Timestamp.fromDate(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const ninetyDaysAgo = Timestamp.fromDate(
    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  );

  const [analyses, signals, regulations, scenarios, alerts, indicators] = await Promise.all([
    getPESTELAnalyses(),
    getSignals(),
    getRegulatoryItems(),
    getScenarios(),
    getAlerts(),
    getTrackedIndicators(),
  ]);

  // PESTEL Summary
  const pestelByStatus: Record<string, number> = {};
  const pestelByDimension: Record<string, number> = {};
  let totalRiskScore = 0;
  let factorCount = 0;
  const allOpportunities: string[] = [];
  const allThreats: string[] = [];

  analyses.forEach(a => {
    pestelByStatus[a.status] = (pestelByStatus[a.status] || 0) + 1;
    a.factors.forEach(f => {
      pestelByDimension[f.dimension] = (pestelByDimension[f.dimension] || 0) + 1;
      totalRiskScore += f.impact.riskScore;
      factorCount++;
      if (f.type === 'opportunity') allOpportunities.push(f.title);
      if (f.type === 'threat') allThreats.push(f.title);
    });
  });

  // Signal Summary
  const signalByType: Record<string, number> = {};
  const signalByStatus: Record<string, number> = {};
  const signalByDimension: Record<string, number> = {};
  let totalStrength = 0;
  let recentSignals = 0;
  let validatedCount = 0;

  signals.forEach(s => {
    signalByType[s.signalType] = (signalByType[s.signalType] || 0) + 1;
    signalByStatus[s.status] = (signalByStatus[s.status] || 0) + 1;
    signalByDimension[s.pestelDimension] = (signalByDimension[s.pestelDimension] || 0) + 1;
    totalStrength += s.assessment.strengthScore;
    if (s.detectedAt.seconds >= thirtyDaysAgo.seconds) recentSignals++;
    if (s.status === 'validated' || s.status === 'acted_upon') validatedCount++;
  });

  // Regulatory Summary
  const regByCategory: Record<string, number> = {};
  const regByStatus: Record<string, number> = {};
  let compliantCount = 0;
  let upcomingDeadlines = 0;
  let highImpactCount = 0;

  regulations.forEach(r => {
    regByCategory[r.category] = (regByCategory[r.category] || 0) + 1;
    regByStatus[r.status] = (regByStatus[r.status] || 0) + 1;
    if (r.compliance.status === 'compliant') compliantCount++;
    if (r.dates.effectiveDate && 
        r.dates.effectiveDate.seconds >= now.seconds && 
        r.dates.effectiveDate.seconds <= ninetyDaysAgo.seconds) {
      upcomingDeadlines++;
    }
    if (r.impact.level === 'very_high' || r.impact.level === 'high') highImpactCount++;
  });

  // Scenario Summary
  const scenarioByType: Record<string, number> = {};
  let totalProbability = 0;
  let approvedCount = 0;
  let triggeredSignposts = 0;

  scenarios.forEach(s => {
    scenarioByType[s.type] = (scenarioByType[s.type] || 0) + 1;
    totalProbability += s.probability;
    if (s.status === 'approved') approvedCount++;
    s.signposts.forEach(sp => {
      if (sp.status === 'triggered') triggeredSignposts++;
    });
  });

  // Alert Summary
  const alertByPriority: Record<string, number> = {};
  let activeAlerts = 0;
  let alertsLast30Days = 0;
  let totalResolutionTime = 0;
  let resolvedCount = 0;

  alerts.forEach(a => {
    alertByPriority[a.priority] = (alertByPriority[a.priority] || 0) + 1;
    if (a.status === 'active') activeAlerts++;
    if (a.createdAt.seconds >= thirtyDaysAgo.seconds) alertsLast30Days++;
    if (a.status === 'resolved' && a.resolvedAt) {
      totalResolutionTime += (a.resolvedAt.seconds - a.createdAt.seconds) / 3600;
      resolvedCount++;
    }
  });

  // Indicator Summary
  let warningIndicators = 0;
  let criticalIndicators = 0;
  let lastUpdateTime = Timestamp.fromDate(new Date(0));

  indicators.forEach(i => {
    if (i.alertStatus === 'warning') warningIndicators++;
    if (i.alertStatus === 'critical') criticalIndicators++;
    if (i.lastUpdated.seconds > lastUpdateTime.seconds) {
      lastUpdateTime = i.lastUpdated;
    }
  });

  const activeTriggers = (await getActiveTriggers()).length;

  return {
    pestelSummary: {
      totalAnalyses: analyses.length,
      byStatus: pestelByStatus,
      byDimension: pestelByDimension as Record<any, number>,
      avgImpactScore: factorCount > 0 ? totalRiskScore / factorCount : 0,
      topOpportunities: allOpportunities.slice(0, 5),
      topThreats: allThreats.slice(0, 5),
    },
    signalSummary: {
      totalSignals: signals.length,
      byType: signalByType as Record<any, number>,
      byStatus: signalByStatus as Record<any, number>,
      byDimension: signalByDimension as Record<any, number>,
      avgStrengthScore: signals.length > 0 ? totalStrength / signals.length : 0,
      recentSignals,
      validationRate: signals.length > 0 ? (validatedCount / signals.length) * 100 : 0,
    },
    regulatorySummary: {
      totalTracked: regulations.length,
      byCategory: regByCategory as Record<any, number>,
      byStatus: regByStatus as Record<any, number>,
      complianceRate: regulations.length > 0 ? (compliantCount / regulations.length) * 100 : 0,
      upcomingDeadlines,
      highImpactItems: highImpactCount,
    },
    scenarioSummary: {
      totalScenarios: scenarios.length,
      byType: scenarioByType as Record<any, number>,
      avgProbability: scenarios.length > 0 ? totalProbability / scenarios.length : 0,
      approvedScenarios: approvedCount,
      triggeredSignposts,
    },
    earlyWarningSummary: {
      activeAlerts,
      byPriority: alertByPriority as Record<any, number>,
      activeTriggers,
      alertsLast30Days,
      avgResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    },
    indicatorsSummary: {
      trackedIndicators: indicators.length,
      warningIndicators,
      criticalIndicators,
      lastUpdateTime,
    },
    period: {
      start: thirtyDaysAgo,
      end: now,
    },
    generatedAt: now,
  };
}

// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------

export const scanningService = {
  // PESTEL
  createPESTELAnalysis,
  getPESTELAnalysis,
  getPESTELAnalyses,
  updatePESTELAnalysis,
  addPESTELFactor,
  updatePESTELAnalysisStatus,
  generatePESTELSummary,
  
  // Signals
  createSignal,
  getSignal,
  getSignals,
  updateSignalStatus,
  addSignalActionItem,
  
  // Regulatory
  createRegulatoryItem,
  getRegulatoryItem,
  getRegulatoryItems,
  updateRegulatoryStatus,
  updateComplianceStatus,
  getUpcomingDeadlines,
  
  // Scenarios
  createScenario,
  getScenario,
  getScenarios,
  updateScenario,
  updateScenarioStatus,
  updateSignpostStatus,
  
  // Early Warning
  createAlertTrigger,
  getActiveTriggers,
  createAlert,
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  
  // Indicators
  trackIndicator,
  updateIndicatorValue,
  getTrackedIndicators,
  
  // Analytics
  getEnvironmentScanningAnalytics,
};

export default scanningService;
