// ============================================================================
// KPI SERVICE - DawinOS CEO Strategy Command
// Firebase service for KPI definition management
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  KPIDefinition,
  KPITarget,
  KPIThreshold,
  KPIScorecard,
  ScorecardSection,
  KPIAnalytics,
  KPIPerformanceSummary,
  KPIFilters,
  ScorecardFilters,
  CreateKPIInput,
  UpdateKPIInput,
  CreateScorecardInput,
  UpdateScorecardInput,
  CreateScorecardSectionInput,
  UpdateScorecardSectionInput,
} from '../types/kpi.types';
import {
  KPI_COLLECTIONS,
  KPI_STATUS,
  KPI_PERFORMANCE,
  KPI_DEFAULTS,
  KPIPerformance,
  KPIDirection,
} from '../constants/kpi.constants';

// ----------------------------------------------------------------------------
// ID Generation
// ----------------------------------------------------------------------------
function generateId(): string {
  return doc(collection(db, '_')).id;
}

// ----------------------------------------------------------------------------
// Collection References
// ----------------------------------------------------------------------------
function getKPIsCollection(companyId: string) {
  return collection(db, 'companies', companyId, KPI_COLLECTIONS.DEFINITIONS);
}

function getKPIRef(companyId: string, kpiId: string) {
  return doc(db, 'companies', companyId, KPI_COLLECTIONS.DEFINITIONS, kpiId);
}

function getScorecardsCollection(companyId: string) {
  return collection(db, 'companies', companyId, KPI_COLLECTIONS.SCORECARDS);
}

function getScorecardRef(companyId: string, scorecardId: string) {
  return doc(db, 'companies', companyId, KPI_COLLECTIONS.SCORECARDS, scorecardId);
}

// ============================================================================
// PERFORMANCE CALCULATION
// ============================================================================

function calculatePerformanceStatus(
  value: number | undefined,
  target: KPITarget,
  direction: KPIDirection
): KPIPerformance {
  if (value === undefined || value === null) {
    return KPI_PERFORMANCE.NO_DATA;
  }

  const targetValue = target.value;
  const stretchValue = target.stretchValue;
  const minimumValue = target.minimumValue;

  switch (direction) {
    case 'higher_is_better':
      if (stretchValue && value >= stretchValue) {
        return KPI_PERFORMANCE.EXCEEDING;
      }
      if (value >= targetValue) {
        return KPI_PERFORMANCE.ON_TARGET;
      }
      if (minimumValue && value < minimumValue) {
        return KPI_PERFORMANCE.CRITICAL;
      }
      return KPI_PERFORMANCE.BELOW_TARGET;

    case 'lower_is_better':
      if (stretchValue && value <= stretchValue) {
        return KPI_PERFORMANCE.EXCEEDING;
      }
      if (value <= targetValue) {
        return KPI_PERFORMANCE.ON_TARGET;
      }
      if (minimumValue && value > minimumValue) {
        return KPI_PERFORMANCE.CRITICAL;
      }
      return KPI_PERFORMANCE.BELOW_TARGET;

    case 'target_is_best':
      const tolerance = targetValue * 0.05; // 5% tolerance
      if (Math.abs(value - targetValue) <= tolerance) {
        return KPI_PERFORMANCE.ON_TARGET;
      }
      if (Math.abs(value - targetValue) <= tolerance * 2) {
        return KPI_PERFORMANCE.BELOW_TARGET;
      }
      return KPI_PERFORMANCE.CRITICAL;

    case 'range_is_best':
      const rangeMin = target.rangeMin ?? targetValue * 0.9;
      const rangeMax = target.rangeMax ?? targetValue * 1.1;
      if (value >= rangeMin && value <= rangeMax) {
        return KPI_PERFORMANCE.ON_TARGET;
      }
      return KPI_PERFORMANCE.BELOW_TARGET;

    default:
      return KPI_PERFORMANCE.NO_DATA;
  }
}

function calculateKPIScore(
  value: number | undefined,
  target: KPITarget,
  direction: KPIDirection
): number {
  if (value === undefined || value === null) {
    return 0;
  }

  const targetValue = target.value;

  switch (direction) {
    case 'higher_is_better':
      if (targetValue === 0) return value > 0 ? 100 : 0;
      return Math.min(100, Math.max(0, (value / targetValue) * 100));

    case 'lower_is_better':
      if (value === 0) return 100;
      if (targetValue === 0) return 0;
      return Math.min(100, Math.max(0, (targetValue / value) * 100));

    case 'target_is_best':
      const deviation = Math.abs(value - targetValue);
      const maxDeviation = targetValue * 0.5; // 50% max deviation
      return Math.max(0, 100 - (deviation / maxDeviation) * 100);

    case 'range_is_best':
      const rangeMin = target.rangeMin ?? targetValue * 0.9;
      const rangeMax = target.rangeMax ?? targetValue * 1.1;
      if (value >= rangeMin && value <= rangeMax) {
        return 100;
      }
      const rangeCenter = (rangeMin + rangeMax) / 2;
      const rangeSpread = (rangeMax - rangeMin) / 2;
      const distance = Math.abs(value - rangeCenter) - rangeSpread;
      return Math.max(0, 100 - (distance / rangeSpread) * 50);

    default:
      return 0;
  }
}

// ============================================================================
// KPI SERVICE CLASS
// ============================================================================
class KPIService {
  // ==========================================================================
  // KPI CRUD
  // ==========================================================================

  async createKPI(
    companyId: string,
    input: CreateKPIInput,
    userId: string
  ): Promise<KPIDefinition> {
    // Check for duplicate code
    const existingKPIs = await this.getKPIs(companyId, { searchQuery: input.code });
    const duplicate = existingKPIs.find(
      (k) => k.code === input.code && k.status !== KPI_STATUS.ARCHIVED
    );
    if (duplicate) {
      throw new Error(`KPI with code "${input.code}" already exists`);
    }

    const colRef = getKPIsCollection(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    // Process thresholds
    const thresholds: KPIThreshold[] = (input.thresholds || []).map((t, i) => ({
      ...t,
      id: generateId(),
      level: t.level ?? i + 1,
    }));

    const kpi: KPIDefinition = {
      id: docRef.id,
      companyId,
      code: input.code,
      name: input.name,
      description: input.description || '',
      category: input.category,
      type: input.type,
      status: KPI_STATUS.DRAFT,
      scope: input.scope,
      subsidiaryId: input.subsidiaryId,
      departmentId: input.departmentId,
      teamId: input.teamId,
      projectId: input.projectId,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      unit: input.unit,
      direction: input.direction,
      frequency: input.frequency,
      decimalPlaces: input.decimalPlaces ?? KPI_DEFAULTS.DECIMAL_PLACES,
      target: input.target,
      thresholds,
      dataSource: {
        type: input.dataSourceType,
        formula: input.formula,
      },
      linkedStrategyPillarId: input.linkedStrategyPillarId,
      linkedOKRKeyResultIds: input.linkedOKRKeyResultIds || [],
      bscPerspective: input.bscPerspective,
      childKPIIds: [],
      tags: input.tags || [],
      isPublic: input.isPublic ?? true,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await setDoc(docRef, kpi);
    return kpi;
  }

  async getKPI(companyId: string, kpiId: string): Promise<KPIDefinition | null> {
    const docSnap = await getDoc(getKPIRef(companyId, kpiId));
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as KPIDefinition;
  }

  async getKPIs(companyId: string, filters?: KPIFilters): Promise<KPIDefinition[]> {
    let q = query(getKPIsCollection(companyId), orderBy('code', 'asc'));

    if (filters?.category) {
      q = query(q, where('category', '==', filters.category));
    }
    if (filters?.scope) {
      q = query(q, where('scope', '==', filters.scope));
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters?.subsidiaryId) {
      q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
    }
    if (filters?.departmentId) {
      q = query(q, where('departmentId', '==', filters.departmentId));
    }
    if (filters?.ownerId) {
      q = query(q, where('ownerId', '==', filters.ownerId));
    }
    if (filters?.linkedStrategyPillarId) {
      q = query(q, where('linkedStrategyPillarId', '==', filters.linkedStrategyPillarId));
    }
    if (filters?.bscPerspective) {
      q = query(q, where('bscPerspective', '==', filters.bscPerspective));
    }

    const snapshot = await getDocs(q);
    let kpis = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KPIDefinition[];

    // Client-side filtering
    if (filters?.performance) {
      kpis = kpis.filter((k) => k.currentPerformance === filters.performance);
    }
    if (filters?.tags && filters.tags.length > 0) {
      kpis = kpis.filter((k) => filters.tags!.some((tag) => k.tags.includes(tag)));
    }
    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      kpis = kpis.filter(
        (k) =>
          k.code.toLowerCase().includes(searchLower) ||
          k.name.toLowerCase().includes(searchLower) ||
          k.description?.toLowerCase().includes(searchLower)
      );
    }
    if (filters?.favoritesOnly) {
      kpis = kpis.filter((k) => k.isFavorite);
    }

    return kpis;
  }

  async getActiveKPIs(companyId: string): Promise<KPIDefinition[]> {
    return this.getKPIs(companyId, { status: KPI_STATUS.ACTIVE });
  }

  async updateKPI(
    companyId: string,
    kpiId: string,
    input: UpdateKPIInput,
    userId: string
  ): Promise<KPIDefinition> {
    const existing = await this.getKPI(companyId, kpiId);
    if (!existing) {
      throw new Error('KPI not found');
    }

    // Check for duplicate code if code is being changed
    if (input.code && input.code !== existing.code) {
      const existingKPIs = await this.getKPIs(companyId, { searchQuery: input.code });
      const duplicate = existingKPIs.find(
        (k) => k.code === input.code && k.id !== kpiId && k.status !== KPI_STATUS.ARCHIVED
      );
      if (duplicate) {
        throw new Error(`KPI with code "${input.code}" already exists`);
      }
    }

    const now = Timestamp.now();
    const updateData: Partial<KPIDefinition> = {
      updatedAt: now,
      updatedBy: userId,
    };

    // Apply updates
    if (input.code !== undefined) updateData.code = input.code;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description || '';
    if (input.category !== undefined) updateData.category = input.category;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.ownerId !== undefined) updateData.ownerId = input.ownerId;
    if (input.ownerName !== undefined) updateData.ownerName = input.ownerName || undefined;
    if (input.unit !== undefined) updateData.unit = input.unit;
    if (input.direction !== undefined) updateData.direction = input.direction;
    if (input.frequency !== undefined) updateData.frequency = input.frequency;
    if (input.decimalPlaces !== undefined) updateData.decimalPlaces = input.decimalPlaces;
    if (input.linkedStrategyPillarId !== undefined) {
      updateData.linkedStrategyPillarId = input.linkedStrategyPillarId || undefined;
    }
    if (input.linkedOKRKeyResultIds !== undefined) {
      updateData.linkedOKRKeyResultIds = input.linkedOKRKeyResultIds;
    }
    if (input.bscPerspective !== undefined) {
      updateData.bscPerspective = input.bscPerspective || undefined;
    }
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;
    if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;

    await updateDoc(getKPIRef(companyId, kpiId), updateData);
    return (await this.getKPI(companyId, kpiId))!;
  }

  async deleteKPI(companyId: string, kpiId: string): Promise<void> {
    await deleteDoc(getKPIRef(companyId, kpiId));
  }

  async activateKPI(companyId: string, kpiId: string, userId: string): Promise<KPIDefinition> {
    const kpi = await this.getKPI(companyId, kpiId);
    if (!kpi) {
      throw new Error('KPI not found');
    }
    if (!kpi.target?.value) {
      throw new Error('KPI must have a target value before activation');
    }

    await updateDoc(getKPIRef(companyId, kpiId), {
      status: KPI_STATUS.ACTIVE,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return (await this.getKPI(companyId, kpiId))!;
  }

  async pauseKPI(companyId: string, kpiId: string, userId: string): Promise<KPIDefinition> {
    await updateDoc(getKPIRef(companyId, kpiId), {
      status: KPI_STATUS.PAUSED,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    return (await this.getKPI(companyId, kpiId))!;
  }

  async archiveKPI(companyId: string, kpiId: string, userId: string): Promise<KPIDefinition> {
    await updateDoc(getKPIRef(companyId, kpiId), {
      status: KPI_STATUS.ARCHIVED,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    return (await this.getKPI(companyId, kpiId))!;
  }

  // ==========================================================================
  // TARGET & THRESHOLD MANAGEMENT
  // ==========================================================================

  async updateTarget(
    companyId: string,
    kpiId: string,
    target: KPITarget,
    userId: string
  ): Promise<KPIDefinition> {
    const kpi = await this.getKPI(companyId, kpiId);
    if (!kpi) {
      throw new Error('KPI not found');
    }

    // Recalculate performance if current value exists
    let currentPerformance = kpi.currentPerformance;
    if (kpi.currentValue !== undefined) {
      currentPerformance = calculatePerformanceStatus(kpi.currentValue, target, kpi.direction);
    }

    await updateDoc(getKPIRef(companyId, kpiId), {
      target,
      currentPerformance,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return (await this.getKPI(companyId, kpiId))!;
  }

  async addThreshold(
    companyId: string,
    kpiId: string,
    threshold: Omit<KPIThreshold, 'id'>,
    userId: string
  ): Promise<KPIThreshold> {
    const kpi = await this.getKPI(companyId, kpiId);
    if (!kpi) {
      throw new Error('KPI not found');
    }

    if (kpi.thresholds.length >= KPI_DEFAULTS.MAX_THRESHOLD_LEVELS) {
      throw new Error(`Maximum ${KPI_DEFAULTS.MAX_THRESHOLD_LEVELS} thresholds allowed`);
    }

    const newThreshold: KPIThreshold = {
      ...threshold,
      id: generateId(),
    };

    const thresholds = [...kpi.thresholds, newThreshold].sort((a, b) => a.level - b.level);

    await updateDoc(getKPIRef(companyId, kpiId), {
      thresholds,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return newThreshold;
  }

  async updateThreshold(
    companyId: string,
    kpiId: string,
    thresholdId: string,
    updates: Partial<KPIThreshold>,
    userId: string
  ): Promise<KPIThreshold> {
    const kpi = await this.getKPI(companyId, kpiId);
    if (!kpi) {
      throw new Error('KPI not found');
    }

    const thresholdIndex = kpi.thresholds.findIndex((t) => t.id === thresholdId);
    if (thresholdIndex === -1) {
      throw new Error('Threshold not found');
    }

    const updatedThreshold = { ...kpi.thresholds[thresholdIndex], ...updates };
    const thresholds = [...kpi.thresholds];
    thresholds[thresholdIndex] = updatedThreshold;
    thresholds.sort((a, b) => a.level - b.level);

    await updateDoc(getKPIRef(companyId, kpiId), {
      thresholds,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return updatedThreshold;
  }

  async removeThreshold(
    companyId: string,
    kpiId: string,
    thresholdId: string,
    userId: string
  ): Promise<void> {
    const kpi = await this.getKPI(companyId, kpiId);
    if (!kpi) {
      throw new Error('KPI not found');
    }

    const thresholds = kpi.thresholds.filter((t) => t.id !== thresholdId);

    await updateDoc(getKPIRef(companyId, kpiId), {
      thresholds,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ==========================================================================
  // SCORECARD MANAGEMENT
  // ==========================================================================

  async createScorecard(
    companyId: string,
    input: CreateScorecardInput,
    userId: string
  ): Promise<KPIScorecard> {
    const colRef = getScorecardsCollection(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    const sections: ScorecardSection[] = input.sections.map((s, i) => ({
      ...s,
      id: generateId(),
      order: i,
    }));

    const scorecard: KPIScorecard = {
      id: docRef.id,
      companyId,
      name: input.name,
      description: input.description,
      type: input.type,
      status: KPI_STATUS.ACTIVE,
      scope: input.scope,
      subsidiaryId: input.subsidiaryId,
      departmentId: input.departmentId,
      teamId: input.teamId,
      fiscalYear: input.fiscalYear,
      quarter: input.quarter,
      sections,
      showTrends: input.showTrends ?? true,
      showTargets: input.showTargets ?? true,
      showVariance: input.showVariance ?? true,
      refreshFrequency: input.refreshFrequency || 'daily',
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };

    await setDoc(docRef, scorecard);
    return scorecard;
  }

  async getScorecard(companyId: string, scorecardId: string): Promise<KPIScorecard | null> {
    const docSnap = await getDoc(getScorecardRef(companyId, scorecardId));
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as KPIScorecard;
  }

  async getScorecards(companyId: string, filters?: ScorecardFilters): Promise<KPIScorecard[]> {
    let q = query(getScorecardsCollection(companyId), orderBy('name', 'asc'));

    if (filters?.type) {
      q = query(q, where('type', '==', filters.type));
    }
    if (filters?.scope) {
      q = query(q, where('scope', '==', filters.scope));
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters?.fiscalYear) {
      q = query(q, where('fiscalYear', '==', filters.fiscalYear));
    }
    if (filters?.subsidiaryId) {
      q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
    }
    if (filters?.departmentId) {
      q = query(q, where('departmentId', '==', filters.departmentId));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KPIScorecard[];
  }

  async updateScorecard(
    companyId: string,
    scorecardId: string,
    input: UpdateScorecardInput,
    userId: string
  ): Promise<KPIScorecard> {
    const existing = await this.getScorecard(companyId, scorecardId);
    if (!existing) {
      throw new Error('Scorecard not found');
    }

    const now = Timestamp.now();
    const updateData: Partial<KPIScorecard> = {
      updatedAt: now,
      updatedBy: userId,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description || undefined;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.showTrends !== undefined) updateData.showTrends = input.showTrends;
    if (input.showTargets !== undefined) updateData.showTargets = input.showTargets;
    if (input.showVariance !== undefined) updateData.showVariance = input.showVariance;
    if (input.refreshFrequency !== undefined) updateData.refreshFrequency = input.refreshFrequency;

    await updateDoc(getScorecardRef(companyId, scorecardId), updateData);
    return (await this.getScorecard(companyId, scorecardId))!;
  }

  async deleteScorecard(companyId: string, scorecardId: string): Promise<void> {
    await deleteDoc(getScorecardRef(companyId, scorecardId));
  }

  async addScorecardSection(
    companyId: string,
    scorecardId: string,
    section: CreateScorecardSectionInput,
    userId: string
  ): Promise<ScorecardSection> {
    const scorecard = await this.getScorecard(companyId, scorecardId);
    if (!scorecard) {
      throw new Error('Scorecard not found');
    }

    if (scorecard.sections.length >= KPI_DEFAULTS.MAX_SECTIONS_PER_SCORECARD) {
      throw new Error(`Maximum ${KPI_DEFAULTS.MAX_SECTIONS_PER_SCORECARD} sections allowed`);
    }

    const newSection: ScorecardSection = {
      ...section,
      id: generateId(),
      order: scorecard.sections.length,
    };

    const sections = [...scorecard.sections, newSection];

    await updateDoc(getScorecardRef(companyId, scorecardId), {
      sections,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return newSection;
  }

  async updateScorecardSection(
    companyId: string,
    scorecardId: string,
    sectionId: string,
    updates: UpdateScorecardSectionInput,
    userId: string
  ): Promise<ScorecardSection> {
    const scorecard = await this.getScorecard(companyId, scorecardId);
    if (!scorecard) {
      throw new Error('Scorecard not found');
    }

    const sectionIndex = scorecard.sections.findIndex((s) => s.id === sectionId);
    if (sectionIndex === -1) {
      throw new Error('Section not found');
    }

    const updatedSection: ScorecardSection = {
      ...scorecard.sections[sectionIndex],
    };

    if (updates.name !== undefined) updatedSection.name = updates.name;
    if (updates.description !== undefined) updatedSection.description = updates.description || undefined;
    if (updates.category !== undefined) updatedSection.category = updates.category || undefined;
    if (updates.bscPerspective !== undefined) updatedSection.bscPerspective = updates.bscPerspective || undefined;
    if (updates.kpiIds !== undefined) updatedSection.kpiIds = updates.kpiIds;
    if (updates.weight !== undefined) updatedSection.weight = updates.weight;
    if (updates.color !== undefined) updatedSection.color = updates.color || undefined;

    const sections = [...scorecard.sections];
    sections[sectionIndex] = updatedSection;

    await updateDoc(getScorecardRef(companyId, scorecardId), {
      sections,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return updatedSection;
  }

  async removeScorecardSection(
    companyId: string,
    scorecardId: string,
    sectionId: string,
    userId: string
  ): Promise<void> {
    const scorecard = await this.getScorecard(companyId, scorecardId);
    if (!scorecard) {
      throw new Error('Scorecard not found');
    }

    const sections = scorecard.sections
      .filter((s) => s.id !== sectionId)
      .map((s, i) => ({ ...s, order: i }));

    await updateDoc(getScorecardRef(companyId, scorecardId), {
      sections,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ==========================================================================
  // SCORECARD SCORING
  // ==========================================================================

  async calculateScorecardScore(
    companyId: string,
    scorecardId: string,
    kpis: KPIDefinition[]
  ): Promise<{ overallScore: number; sectionScores: Record<string, number> }> {
    const scorecard = await this.getScorecard(companyId, scorecardId);
    if (!scorecard) {
      throw new Error('Scorecard not found');
    }

    const sectionScores: Record<string, number> = {};
    let weightedSum = 0;
    let totalWeight = 0;

    for (const section of scorecard.sections) {
      const sectionKPIs = kpis.filter((k) => section.kpiIds.includes(k.id));
      
      if (sectionKPIs.length === 0) {
        sectionScores[section.id] = 0;
        continue;
      }

      // Calculate average score for section
      let sectionTotal = 0;
      let sectionCount = 0;

      for (const kpi of sectionKPIs) {
        if (kpi.currentValue !== undefined) {
          const score = calculateKPIScore(kpi.currentValue, kpi.target, kpi.direction);
          sectionTotal += score;
          sectionCount++;
        }
      }

      const sectionScore = sectionCount > 0 ? sectionTotal / sectionCount : 0;
      sectionScores[section.id] = sectionScore;

      weightedSum += sectionScore * section.weight;
      totalWeight += section.weight;
    }

    const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Update scorecard with calculated scores
    await updateDoc(getScorecardRef(companyId, scorecardId), {
      overallScore,
      overallPerformance: overallScore >= 80 ? KPI_PERFORMANCE.EXCEEDING
        : overallScore >= 60 ? KPI_PERFORMANCE.ON_TARGET
        : overallScore >= 40 ? KPI_PERFORMANCE.BELOW_TARGET
        : KPI_PERFORMANCE.CRITICAL,
      updatedAt: Timestamp.now(),
    });

    return { overallScore, sectionScores };
  }

  // ==========================================================================
  // ANALYTICS
  // ==========================================================================

  async getKPIAnalytics(companyId: string): Promise<KPIAnalytics> {
    const kpis = await this.getActiveKPIs(companyId);
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - KPI_DEFAULTS.STALE_DATA_DAYS * 24 * 60 * 60 * 1000);

    const analytics: KPIAnalytics = {
      companyId,
      asOfDate: Timestamp.now(),
      totalKPIs: kpis.length,
      byCategory: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byPerformance: {} as Record<string, number>,
      byScope: {} as Record<string, number>,
      overallHealthScore: 0,
      exceedingCount: 0,
      onTargetCount: 0,
      belowTargetCount: 0,
      criticalCount: 0,
      noDataCount: 0,
      staleKPIsCount: 0,
      averageScore: 0,
      topPerformers: [],
      underPerformers: [],
      trends: { improving: 0, declining: 0, stable: 0 },
    };

    const performanceSummaries: KPIPerformanceSummary[] = [];
    let totalScore = 0;
    let scoredCount = 0;

    for (const kpi of kpis) {
      // By category
      analytics.byCategory[kpi.category] = (analytics.byCategory[kpi.category] || 0) + 1;

      // By status
      analytics.byStatus[kpi.status] = (analytics.byStatus[kpi.status] || 0) + 1;

      // By scope
      analytics.byScope[kpi.scope] = (analytics.byScope[kpi.scope] || 0) + 1;

      // By performance
      const perf = kpi.currentPerformance || KPI_PERFORMANCE.NO_DATA;
      analytics.byPerformance[perf] = (analytics.byPerformance[perf] || 0) + 1;

      switch (perf) {
        case KPI_PERFORMANCE.EXCEEDING:
          analytics.exceedingCount++;
          break;
        case KPI_PERFORMANCE.ON_TARGET:
          analytics.onTargetCount++;
          break;
        case KPI_PERFORMANCE.BELOW_TARGET:
          analytics.belowTargetCount++;
          break;
        case KPI_PERFORMANCE.CRITICAL:
          analytics.criticalCount++;
          break;
        case KPI_PERFORMANCE.NO_DATA:
          analytics.noDataCount++;
          break;
      }

      // Stale check
      if (kpi.lastDataPointDate && kpi.lastDataPointDate.toDate() < staleThreshold) {
        analytics.staleKPIsCount++;
      } else if (!kpi.lastDataPointDate && kpi.status === KPI_STATUS.ACTIVE) {
        analytics.staleKPIsCount++;
      }

      // Score calculation
      if (kpi.currentValue !== undefined) {
        const score = calculateKPIScore(kpi.currentValue, kpi.target, kpi.direction);
        totalScore += score;
        scoredCount++;

        // Build performance summary
        const targetValue = kpi.target.value;
        const variance = kpi.currentValue - targetValue;
        const variancePercent = targetValue !== 0 ? (variance / targetValue) * 100 : 0;

        performanceSummaries.push({
          kpiId: kpi.id,
          kpiName: kpi.name,
          kpiCode: kpi.code,
          category: kpi.category,
          currentValue: kpi.currentValue,
          target: targetValue,
          variance,
          variancePercent,
          performance: perf,
          trend: kpi.trendDirection || 'stable',
        });
      }

      // Trends
      if (kpi.trendDirection === 'up') analytics.trends.improving++;
      else if (kpi.trendDirection === 'down') analytics.trends.declining++;
      else analytics.trends.stable++;
    }

    analytics.averageScore = scoredCount > 0 ? totalScore / scoredCount : 0;
    analytics.overallHealthScore = analytics.averageScore;

    // Sort and get top/under performers
    performanceSummaries.sort((a, b) => b.variancePercent - a.variancePercent);
    analytics.topPerformers = performanceSummaries.slice(0, 5);
    analytics.underPerformers = performanceSummaries.slice(-5).reverse();

    return analytics;
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  calculatePerformanceStatus = calculatePerformanceStatus;
  calculateKPIScore = calculateKPIScore;
}

// Export singleton instance
export const kpiService = new KPIService();
