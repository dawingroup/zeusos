// ============================================================================
// AGGREGATION SERVICE
// DawinOS v2.0 - CEO Strategy Command Module
// Service for aggregating performance data across strategy, OKRs, and KPIs
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  AggregatedPerformance,
  StrategyAggregation,
  OKRAggregation,
  KPIAggregation,
  PerformanceWeights,
  PerformanceHealth,
  PerformanceHierarchy,
  PerformanceNode,
  PerformanceComparison,
  ComparisonEntity,
  EntityRanking,
  PerformanceHeatmap,
  HeatmapRow,
  HeatmapColumn,
  HeatmapCell,
  AggregationInput,
  ChildAggregationSummary,
  PillarProgress,
} from '../types/aggregation.types';
import {
  AggregationLevel,
  HealthIndicator,
  PerformanceDomain,
  AGGREGATION_LEVELS,
  TREND_INDICATORS,
  HEALTH_INDICATORS,
  AGGREGATION_DEFAULTS,
  AGGREGATION_COLLECTIONS,
  getRatingFromScore,
  getTrendFromChange,
  getHealthFromScore,
  getChildLevel,
} from '../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Collection References
// ----------------------------------------------------------------------------

function getAggregationsCollection(companyId: string) {
  return collection(db, 'companies', companyId, AGGREGATION_COLLECTIONS.AGGREGATIONS);
}

// ----------------------------------------------------------------------------
// Period Helpers
// ----------------------------------------------------------------------------

function getPeriodStart(fiscalYear: number, quarter?: number, month?: number): Timestamp {
  // Uganda fiscal year starts July 1
  const fyStartMonth = 6; // July (0-indexed)
  
  if (month) {
    const actualYear = month >= 7 ? fiscalYear : fiscalYear + 1;
    return Timestamp.fromDate(new Date(actualYear, month - 1, 1));
  }
  
  if (quarter) {
    const quarterMonths = [6, 9, 0, 3]; // Q1=Jul, Q2=Oct, Q3=Jan, Q4=Apr
    const monthIndex = quarterMonths[quarter - 1];
    const actualYear = monthIndex >= 6 ? fiscalYear : fiscalYear + 1;
    return Timestamp.fromDate(new Date(actualYear, monthIndex, 1));
  }
  
  // Full fiscal year
  return Timestamp.fromDate(new Date(fiscalYear, fyStartMonth, 1));
}

function getPeriodEnd(fiscalYear: number, quarter?: number, month?: number): Timestamp {
  // Uganda fiscal year ends June 30
  if (month) {
    const actualYear = month >= 7 ? fiscalYear : fiscalYear + 1;
    const lastDay = new Date(actualYear, month, 0).getDate();
    return Timestamp.fromDate(new Date(actualYear, month - 1, lastDay, 23, 59, 59));
  }
  
  if (quarter) {
    const quarterEndMonths = [8, 11, 2, 5]; // Q1=Sep, Q2=Dec, Q3=Mar, Q4=Jun
    const monthIndex = quarterEndMonths[quarter - 1];
    const actualYear = monthIndex >= 6 ? fiscalYear : fiscalYear + 1;
    const lastDay = new Date(actualYear, monthIndex + 1, 0).getDate();
    return Timestamp.fromDate(new Date(actualYear, monthIndex, lastDay, 23, 59, 59));
  }
  
  // Full fiscal year ends June 30
  return Timestamp.fromDate(new Date(fiscalYear + 1, 5, 30, 23, 59, 59));
}

// ============================================================================
// AGGREGATION SERVICE CLASS
// ============================================================================

class AggregationService {
  // ==========================================================================
  // MAIN AGGREGATION
  // ==========================================================================

  async calculateAggregation(
    companyId: string,
    input: AggregationInput,
    userId: string
  ): Promise<AggregatedPerformance> {
    const now = Timestamp.now();
    
    // Get weights (use defaults if not provided)
    const weights: PerformanceWeights = input.weights || {
      strategy: AGGREGATION_DEFAULTS.DEFAULT_WEIGHT_STRATEGY,
      okr: AGGREGATION_DEFAULTS.DEFAULT_WEIGHT_OKR,
      kpi: AGGREGATION_DEFAULTS.DEFAULT_WEIGHT_KPI,
    };
    
    // Calculate each domain
    const strategyAgg = await this.aggregateStrategy(companyId, input);
    const okrAgg = await this.aggregateOKRs(companyId, input);
    const kpiAgg = await this.aggregateKPIs(companyId, input);
    
    // Calculate combined score
    const combinedScore = this.calculateCombinedScore(
      strategyAgg.score,
      okrAgg.score,
      kpiAgg.score,
      weights
    );
    
    // Determine rating
    const rating = getRatingFromScore(combinedScore);
    
    // Calculate health
    const health = this.calculateHealth(strategyAgg, okrAgg, kpiAgg);
    
    // Get child aggregations if requested
    let childAggregations: ChildAggregationSummary[] | undefined;
    if (input.includeChildren) {
      childAggregations = await this.getChildAggregations(companyId, input, weights);
    }
    
    // Build aggregation result
    const aggregation: AggregatedPerformance = {
      id: `${input.entityId}_${input.fiscalYear}_${input.quarter || 'full'}`,
      companyId,
      level: input.level,
      entityId: input.entityId,
      entityName: input.entityName,
      fiscalYear: input.fiscalYear,
      quarter: input.quarter,
      month: input.month,
      periodStart: getPeriodStart(input.fiscalYear, input.quarter, input.month),
      periodEnd: getPeriodEnd(input.fiscalYear, input.quarter, input.month),
      strategyScore: strategyAgg.score,
      okrScore: okrAgg.score,
      kpiScore: kpiAgg.score,
      combinedScore,
      weights,
      rating,
      trend: TREND_INDICATORS.STABLE, // Will be calculated from historical data
      strategyCount: strategyAgg.totalPlans,
      okrCount: okrAgg.totalObjectives,
      kpiCount: kpiAgg.totalKPIs,
      health,
      childAggregations,
      calculatedAt: now,
      calculatedBy: userId,
      isSnapshot: false,
    };
    
    // Calculate trend from previous period
    const previousAgg = await this.getPreviousAggregation(companyId, input);
    if (previousAgg) {
      aggregation.previousScore = previousAgg.combinedScore;
      aggregation.scoreChange = combinedScore - previousAgg.combinedScore;
      aggregation.scoreChangePercent = previousAgg.combinedScore !== 0
        ? ((combinedScore - previousAgg.combinedScore) / previousAgg.combinedScore) * 100
        : 0;
      aggregation.trend = getTrendFromChange(aggregation.scoreChangePercent);
    }
    
    return aggregation;
  }

  // ==========================================================================
  // STRATEGY AGGREGATION
  // ==========================================================================

  async aggregateStrategy(
    companyId: string,
    input: AggregationInput
  ): Promise<StrategyAggregation> {
    // Get strategy documents for the entity
    const strategiesRef = collection(db, 'companies', companyId, 'strategyDocuments');
    let q = query(strategiesRef, where('fiscalYear', '==', input.fiscalYear));
    
    const snapshot = await getDocs(q);
    let strategies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    
    // Filter by scope if not group level
    if (input.level !== AGGREGATION_LEVELS.GROUP) {
      strategies = strategies.filter(s => 
        s.scope === input.level && 
        (s.subsidiaryId === input.entityId || s.departmentId === input.entityId)
      );
    }
    
    const totalPlans = strategies.length;
    const activePlans = strategies.filter(s => s.status === 'active').length;
    const completedPlans = strategies.filter(s => s.status === 'completed').length;
    
    // Aggregate pillar progress
    const pillarProgress: PillarProgress[] = [];
    let totalPillarProgress = 0;
    let pillarCount = 0;
    
    for (const strategy of strategies) {
      if (strategy.pillars) {
        for (const pillar of strategy.pillars) {
          const progress = pillar.progress || 0;
          pillarProgress.push({
            pillarId: pillar.id,
            pillarName: pillar.name,
            progress,
            objectivesCount: pillar.objectives?.length || 0,
            completedObjectives: pillar.objectives?.filter((o: any) => o.status === 'completed').length || 0,
            status: progress >= 100 ? 'completed' : progress >= 70 ? 'on_track' : progress >= 40 ? 'at_risk' : 'delayed',
          });
          totalPillarProgress += progress;
          pillarCount++;
        }
      }
    }
    
    const averagePillarProgress = pillarCount > 0 ? totalPillarProgress / pillarCount : 0;
    
    // Count objectives and initiatives across all strategies
    let totalObjectives = 0;
    let completedObjectives = 0;
    let onTrackObjectives = 0;
    let atRiskObjectives = 0;
    let totalInitiatives = 0;
    let completedInitiatives = 0;
    let onTrackInitiatives = 0;
    let delayedInitiatives = 0;
    
    for (const strategy of strategies) {
      if (strategy.pillars) {
        for (const pillar of strategy.pillars) {
          if (pillar.objectives) {
            for (const obj of pillar.objectives) {
              totalObjectives++;
              if (obj.status === 'completed') completedObjectives++;
              else if (obj.status === 'on_track') onTrackObjectives++;
              else if (obj.status === 'at_risk') atRiskObjectives++;
              
              if (obj.initiatives) {
                for (const init of obj.initiatives) {
                  totalInitiatives++;
                  if (init.status === 'completed') completedInitiatives++;
                  else if (init.status === 'on_track') onTrackInitiatives++;
                  else if (init.status === 'delayed') delayedInitiatives++;
                }
              }
            }
          }
        }
      }
    }
    
    // Calculate overall strategy score
    const objectiveCompletionRate = totalObjectives > 0 ? (completedObjectives / totalObjectives) * 100 : 0;
    const initiativeCompletionRate = totalInitiatives > 0 ? (completedInitiatives / totalInitiatives) * 100 : 0;
    
    // Weighted score: 40% pillar progress, 35% objective completion, 25% initiative completion
    const score = (averagePillarProgress * 0.4) + (objectiveCompletionRate * 0.35) + (initiativeCompletionRate * 0.25);
    
    return {
      totalPlans,
      activePlans,
      completedPlans,
      pillarProgress,
      averagePillarProgress,
      totalObjectives,
      completedObjectives,
      onTrackObjectives,
      atRiskObjectives,
      totalInitiatives,
      completedInitiatives,
      onTrackInitiatives,
      delayedInitiatives,
      score: Math.min(100, Math.max(0, score)),
    };
  }

  // ==========================================================================
  // OKR AGGREGATION
  // ==========================================================================

  async aggregateOKRs(
    companyId: string,
    input: AggregationInput
  ): Promise<OKRAggregation> {
    // Get objectives for the entity
    const objectivesRef = collection(db, 'companies', companyId, 'okrObjectives');
    let q = query(objectivesRef, where('fiscalYear', '==', input.fiscalYear));
    
    if (input.quarter) {
      q = query(q, where('quarter', '==', input.quarter));
    }
    
    const snapshot = await getDocs(q);
    let objectives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    
    // Filter by level
    const levelMapping: Record<AggregationLevel, string> = {
      [AGGREGATION_LEVELS.GROUP]: 'company',
      [AGGREGATION_LEVELS.SUBSIDIARY]: 'subsidiary',
      [AGGREGATION_LEVELS.DEPARTMENT]: 'department',
      [AGGREGATION_LEVELS.TEAM]: 'team',
      [AGGREGATION_LEVELS.INDIVIDUAL]: 'individual',
    };
    
    if (input.level !== AGGREGATION_LEVELS.GROUP) {
      objectives = objectives.filter(o => 
        o.level === levelMapping[input.level] && 
        (o.ownerId === input.entityId || o.departmentId === input.entityId)
      );
    }
    
    // Count objectives by status
    const totalObjectives = objectives.length;
    const completedObjectives = objectives.filter(o => o.status === 'completed').length;
    const onTrackObjectives = objectives.filter(o => o.status === 'on_track').length;
    const atRiskObjectives = objectives.filter(o => o.status === 'at_risk').length;
    const notStartedObjectives = objectives.filter(o => o.status === 'not_started').length;
    
    // Count and score key results
    let totalKeyResults = 0;
    let completedKeyResults = 0;
    let onTrackKeyResults = 0;
    let atRiskKeyResults = 0;
    let totalObjectiveScore = 0;
    let totalKeyResultScore = 0;
    
    for (const objective of objectives) {
      totalObjectiveScore += objective.score || 0;
      
      if (objective.keyResults) {
        for (const kr of objective.keyResults) {
          totalKeyResults++;
          totalKeyResultScore += kr.score || 0;
          
          if (kr.score >= 1.0) completedKeyResults++;
          else if (kr.score >= 0.7) onTrackKeyResults++;
          else atRiskKeyResults++;
        }
      }
    }
    
    const averageObjectiveScore = totalObjectives > 0 ? totalObjectiveScore / totalObjectives : 0;
    const averageKeyResultScore = totalKeyResults > 0 ? totalKeyResultScore / totalKeyResults : 0;
    
    // Convert Google OKR score (0-1) to percentage (0-100)
    // In Google OKR, 0.7 is considered "success", so we scale accordingly
    const score = Math.min(100, (averageObjectiveScore / 0.7) * 100);
    
    // Group by level
    const byLevel: Record<string, any> = {};
    for (const objective of objectives) {
      const level = objective.level || 'unknown';
      if (!byLevel[level]) {
        byLevel[level] = {
          level,
          objectivesCount: 0,
          totalScore: 0,
          completedCount: 0,
        };
      }
      byLevel[level].objectivesCount++;
      byLevel[level].totalScore += objective.score || 0;
      if (objective.status === 'completed') byLevel[level].completedCount++;
    }
    
    // Calculate averages for each level
    for (const level of Object.keys(byLevel)) {
      byLevel[level].averageScore = byLevel[level].objectivesCount > 0
        ? byLevel[level].totalScore / byLevel[level].objectivesCount
        : 0;
      byLevel[level].completionRate = byLevel[level].objectivesCount > 0
        ? (byLevel[level].completedCount / byLevel[level].objectivesCount) * 100
        : 0;
      delete byLevel[level].totalScore;
      delete byLevel[level].completedCount;
    }
    
    // Calculate alignment score
    const alignmentScore = this.calculateOKRAlignment(objectives);
    
    // Calculate cascading depth
    const cascadingDepth = this.calculateCascadingDepth(objectives);
    
    return {
      totalObjectives,
      completedObjectives,
      onTrackObjectives,
      atRiskObjectives,
      notStartedObjectives,
      totalKeyResults,
      completedKeyResults,
      onTrackKeyResults,
      atRiskKeyResults,
      averageObjectiveScore,
      averageKeyResultScore,
      score: Math.min(100, Math.max(0, score)),
      byLevel,
      alignmentScore,
      cascadingDepth,
    };
  }

  private calculateOKRAlignment(objectives: any[]): number {
    const withParent = objectives.filter(o => o.parentObjectiveId);
    if (withParent.length === 0) return 100;
    
    let alignedCount = 0;
    for (const obj of withParent) {
      const parent = objectives.find(o => o.id === obj.parentObjectiveId);
      if (parent) {
        if (obj.status !== 'at_risk' || parent.status === 'at_risk') {
          alignedCount++;
        }
      }
    }
    
    return (alignedCount / withParent.length) * 100;
  }

  private calculateCascadingDepth(objectives: any[]): number {
    const getDepth = (objId: string, visited: Set<string>): number => {
      if (visited.has(objId)) return 0;
      visited.add(objId);
      
      const children = objectives.filter(o => o.parentObjectiveId === objId);
      if (children.length === 0) return 1;
      
      return 1 + Math.max(...children.map(c => getDepth(c.id, visited)));
    };
    
    const roots = objectives.filter(o => !o.parentObjectiveId);
    if (roots.length === 0) return 0;
    
    return Math.max(...roots.map(r => getDepth(r.id, new Set())));
  }

  // ==========================================================================
  // KPI AGGREGATION
  // ==========================================================================

  async aggregateKPIs(
    companyId: string,
    input: AggregationInput
  ): Promise<KPIAggregation> {
    // Get KPIs
    const kpisRef = collection(db, 'companies', companyId, 'kpiDefinitions');
    let q = query(kpisRef, where('status', '==', 'active'));
    
    const snapshot = await getDocs(q);
    let kpis = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
    
    // Filter by scope if needed
    if (input.level !== AGGREGATION_LEVELS.GROUP) {
      const scopeMapping: Record<AggregationLevel, string> = {
        [AGGREGATION_LEVELS.GROUP]: 'group',
        [AGGREGATION_LEVELS.SUBSIDIARY]: 'subsidiary',
        [AGGREGATION_LEVELS.DEPARTMENT]: 'department',
        [AGGREGATION_LEVELS.TEAM]: 'team',
        [AGGREGATION_LEVELS.INDIVIDUAL]: 'individual',
      };
      
      kpis = kpis.filter(k => 
        k.scope === scopeMapping[input.level] &&
        (k.subsidiaryId === input.entityId || k.departmentId === input.entityId || k.ownerId === input.entityId)
      );
    }
    
    const totalKPIs = kpis.length;
    const activeKPIs = kpis.filter(k => k.status === 'active').length;
    
    // Performance distribution
    let exceedingCount = 0;
    let onTargetCount = 0;
    let belowTargetCount = 0;
    let criticalCount = 0;
    let noDataCount = 0;
    let improvingCount = 0;
    let decliningCount = 0;
    let stableCount = 0;
    let totalScore = 0;
    let scoredCount = 0;
    
    for (const kpi of kpis) {
      switch (kpi.currentPerformance) {
        case 'exceeding': exceedingCount++; break;
        case 'on_target': onTargetCount++; break;
        case 'below_target': belowTargetCount++; break;
        case 'critical': criticalCount++; break;
        case 'no_data': noDataCount++; break;
      }
      
      switch (kpi.trendDirection) {
        case 'up': improvingCount++; break;
        case 'down': decliningCount++; break;
        case 'stable': stableCount++; break;
      }
      
      if (kpi.currentValue !== undefined && kpi.target) {
        const kpiScore = this.calculateKPIScore(kpi);
        totalScore += kpiScore;
        scoredCount++;
      }
    }
    
    const averageScore = scoredCount > 0 ? totalScore / scoredCount : 0;
    const kpisWithData = totalKPIs - noDataCount;
    const healthScore = kpisWithData > 0
      ? ((exceedingCount + onTargetCount) / kpisWithData) * 100
      : 0;
    
    // Group by category
    const byCategory: Record<string, any> = {};
    for (const kpi of kpis) {
      if (!byCategory[kpi.category]) {
        byCategory[kpi.category] = {
          category: kpi.category,
          kpiCount: 0,
          totalScore: 0,
          scoredCount: 0,
        };
      }
      byCategory[kpi.category].kpiCount++;
      
      if (kpi.currentValue !== undefined && kpi.target) {
        const kpiScore = this.calculateKPIScore(kpi);
        byCategory[kpi.category].totalScore += kpiScore;
        byCategory[kpi.category].scoredCount++;
      }
    }
    
    // Calculate category averages
    for (const category of Object.keys(byCategory)) {
      const cat = byCategory[category];
      cat.averageScore = cat.scoredCount > 0 ? cat.totalScore / cat.scoredCount : 0;
      cat.performanceStatus = cat.averageScore >= 80 ? 'exceeding' :
        cat.averageScore >= 60 ? 'on_target' :
        cat.averageScore >= 40 ? 'below_target' : 'critical';
      delete cat.totalScore;
      delete cat.scoredCount;
    }
    
    return {
      totalKPIs,
      activeKPIs,
      exceedingCount,
      onTargetCount,
      belowTargetCount,
      criticalCount,
      noDataCount,
      averageScore,
      healthScore,
      score: Math.min(100, Math.max(0, averageScore)),
      byCategory,
      improvingCount,
      decliningCount,
      stableCount,
    };
  }

  private calculateKPIScore(kpi: any): number {
    if (kpi.currentValue === undefined || !kpi.target) return 0;
    
    const targetValue = kpi.target.value;
    const currentValue = kpi.currentValue;
    
    switch (kpi.direction) {
      case 'higher_is_better':
        if (targetValue === 0) return currentValue > 0 ? 100 : 0;
        return Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
      case 'lower_is_better':
        if (currentValue === 0) return 100;
        if (targetValue === 0) return 0;
        return Math.min(100, Math.max(0, (targetValue / currentValue) * 100));
      default:
        return 50;
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private calculateCombinedScore(
    strategyScore: number,
    okrScore: number,
    kpiScore: number,
    weights: PerformanceWeights
  ): number {
    return (
      strategyScore * weights.strategy +
      okrScore * weights.okr +
      kpiScore * weights.kpi
    );
  }

  private calculateHealth(
    strategy: StrategyAggregation,
    okr: OKRAggregation,
    kpi: KPIAggregation
  ): PerformanceHealth {
    const strategyHealth = getHealthFromScore(strategy.score);
    const okrHealth = getHealthFromScore(okr.score);
    const kpiHealth = getHealthFromScore(kpi.score);
    
    // Overall health is the worst of the three
    let overall: HealthIndicator;
    if (strategyHealth === HEALTH_INDICATORS.CRITICAL || 
        okrHealth === HEALTH_INDICATORS.CRITICAL || 
        kpiHealth === HEALTH_INDICATORS.CRITICAL) {
      overall = HEALTH_INDICATORS.CRITICAL;
    } else if (strategyHealth === HEALTH_INDICATORS.WARNING || 
               okrHealth === HEALTH_INDICATORS.WARNING || 
               kpiHealth === HEALTH_INDICATORS.WARNING) {
      overall = HEALTH_INDICATORS.WARNING;
    } else {
      overall = HEALTH_INDICATORS.HEALTHY;
    }
    
    // Count issues
    const criticalIssues = 
      strategy.atRiskObjectives + 
      okr.atRiskObjectives + 
      kpi.criticalCount;
    
    const warningIssues = 
      strategy.delayedInitiatives + 
      okr.atRiskKeyResults + 
      kpi.belowTargetCount;
    
    const healthyItems = 
      strategy.completedObjectives + strategy.onTrackObjectives +
      okr.completedObjectives + okr.onTrackObjectives +
      kpi.exceedingCount + kpi.onTargetCount;
    
    const noDataItems = kpi.noDataCount;
    
    return {
      overall,
      strategyHealth,
      okrHealth,
      kpiHealth,
      criticalIssues,
      warningIssues,
      healthyItems,
      noDataItems,
    };
  }

  private async getPreviousAggregation(
    companyId: string,
    input: AggregationInput
  ): Promise<AggregatedPerformance | null> {
    // Calculate previous period
    let prevYear = input.fiscalYear;
    let prevQuarter = input.quarter;
    let prevMonth = input.month;
    
    if (input.month) {
      prevMonth = input.month - 1;
      if (prevMonth < 1) {
        prevMonth = 12;
        prevYear--;
      }
    } else if (input.quarter) {
      prevQuarter = input.quarter - 1;
      if (prevQuarter < 1) {
        prevQuarter = 4;
        prevYear--;
      }
    } else {
      prevYear--;
    }
    
    const prevId = `${input.entityId}_${prevYear}_${prevQuarter || 'full'}`;
    const docRef = doc(getAggregationsCollection(companyId), prevId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as AggregatedPerformance;
    }
    
    return null;
  }

  private async getChildAggregations(
    companyId: string,
    input: AggregationInput,
    _weights: PerformanceWeights
  ): Promise<ChildAggregationSummary[]> {
    const childLevel = getChildLevel(input.level);
    if (!childLevel) return [];
    
    // Get child entities based on level
    let childEntities: { id: string; name: string }[] = [];
    
    switch (childLevel) {
      case AGGREGATION_LEVELS.SUBSIDIARY:
        const subsidiariesRef = collection(db, 'companies', companyId, 'subsidiaries');
        const subSnapshot = await getDocs(query(subsidiariesRef, where('isActive', '==', true)));
        childEntities = subSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
        break;
      case AGGREGATION_LEVELS.DEPARTMENT:
        const deptsRef = collection(db, 'companies', companyId, 'departments');
        let deptQuery = query(deptsRef, where('isActive', '==', true));
        if (input.level === AGGREGATION_LEVELS.SUBSIDIARY) {
          deptQuery = query(deptQuery, where('subsidiaryId', '==', input.entityId));
        }
        const deptSnapshot = await getDocs(deptQuery);
        childEntities = deptSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
        break;
      case AGGREGATION_LEVELS.TEAM:
        const teamsRef = collection(db, 'companies', companyId, 'teams');
        let teamQuery = query(teamsRef, where('isActive', '==', true));
        if (input.level === AGGREGATION_LEVELS.DEPARTMENT) {
          teamQuery = query(teamQuery, where('departmentId', '==', input.entityId));
        }
        const teamSnapshot = await getDocs(teamQuery);
        childEntities = teamSnapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
        break;
    }
    
    const summaries: ChildAggregationSummary[] = [];
    
    for (const entity of childEntities) {
      const childAgg = await this.calculateAggregation(companyId, {
        ...input,
        level: childLevel,
        entityId: entity.id,
        entityName: entity.name,
        includeChildren: false,
      }, 'system');
      
      summaries.push({
        entityId: entity.id,
        entityName: entity.name,
        level: childLevel,
        combinedScore: childAgg.combinedScore,
        rating: childAgg.rating,
        trend: childAgg.trend,
      });
    }
    
    return summaries.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  // ==========================================================================
  // HIERARCHY
  // ==========================================================================

  async buildPerformanceHierarchy(
    companyId: string,
    fiscalYear: number,
    quarter?: number
  ): Promise<PerformanceHierarchy> {
    // Build from group level down
    const rootAgg = await this.calculateAggregation(companyId, {
      level: AGGREGATION_LEVELS.GROUP,
      entityId: companyId,
      entityName: 'Dawin Group',
      fiscalYear,
      quarter,
      includeChildren: true,
    }, 'system');
    
    const buildNode = async (agg: AggregatedPerformance, depth: number): Promise<PerformanceNode> => {
      const children: PerformanceNode[] = [];
      
      if (agg.childAggregations && depth < 4) {
        for (const child of agg.childAggregations) {
          const childAgg = await this.calculateAggregation(companyId, {
            level: child.level,
            entityId: child.entityId,
            entityName: child.entityName,
            fiscalYear,
            quarter,
            includeChildren: true,
          }, 'system');
          
          children.push(await buildNode(childAgg, depth + 1));
        }
      }
      
      return {
        id: agg.entityId,
        name: agg.entityName,
        level: agg.level,
        combinedScore: agg.combinedScore,
        strategyScore: agg.strategyScore,
        okrScore: agg.okrScore,
        kpiScore: agg.kpiScore,
        rating: agg.rating,
        trend: agg.trend,
        health: agg.health.overall,
        children,
        childCount: children.length,
      };
    };
    
    const root = await buildNode(rootAgg, 0);
    
    const countNodes = (node: PerformanceNode): number => {
      return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
    };
    
    const maxDepth = (node: PerformanceNode, depth: number): number => {
      if (node.children.length === 0) return depth;
      return Math.max(...node.children.map(c => maxDepth(c, depth + 1)));
    };
    
    return {
      root,
      depth: maxDepth(root, 1),
      totalNodes: countNodes(root),
      aggregationMethod: 'weighted_average',
    };
  }

  // ==========================================================================
  // COMPARISON
  // ==========================================================================

  async comparePerformance(
    companyId: string,
    entityIds: string[],
    domain: PerformanceDomain,
    fiscalYear: number,
    quarter?: number
  ): Promise<PerformanceComparison> {
    const entities: ComparisonEntity[] = [];
    const scores: number[] = [];
    
    for (const entityId of entityIds) {
      // Fetch entity info
      const entityRef = doc(db, 'companies', companyId, 'subsidiaries', entityId);
      const entitySnap = await getDoc(entityRef);
      
      let entityName = entityId;
      let level: AggregationLevel = AGGREGATION_LEVELS.SUBSIDIARY;
      
      if (entitySnap.exists()) {
        entityName = entitySnap.data().name;
      }
      
      const agg = await this.calculateAggregation(companyId, {
        level,
        entityId,
        entityName,
        fiscalYear,
        quarter,
      }, 'system');
      
      const score = domain === 'combined' ? agg.combinedScore :
                    domain === 'strategy' ? agg.strategyScore :
                    domain === 'okr' ? agg.okrScore : agg.kpiScore;
      
      scores.push(score);
      
      entities.push({
        entityId,
        entityName,
        level,
        score,
        rating: getRatingFromScore(score),
        trend: agg.trend,
        rank: 0,
        percentile: 0,
      });
    }
    
    // Sort and assign ranks
    entities.sort((a, b) => b.score - a.score);
    entities.forEach((e, i) => {
      e.rank = i + 1;
      e.percentile = ((entities.length - i) / entities.length) * 100;
    });
    
    // Calculate statistics
    const average = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sortedScores = [...scores].sort((a, b) => a - b);
    const median = sortedScores.length % 2 === 0
      ? (sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2
      : sortedScores[Math.floor(sortedScores.length / 2)];
    
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);
    
    const rankings: EntityRanking[] = entities.map(e => ({
      rank: e.rank,
      entityId: e.entityId,
      entityName: e.entityName,
      score: e.score,
    }));
    
    return {
      entities,
      domain,
      period: { fiscalYear, quarter },
      rankings,
      average,
      median,
      standardDeviation,
      topPerformer: entities[0]?.entityName || '',
      bottomPerformer: entities[entities.length - 1]?.entityName || '',
    };
  }

  // ==========================================================================
  // HEATMAP
  // ==========================================================================

  async generateHeatmap(
    companyId: string,
    entityIds: string[],
    domains: PerformanceDomain[],
    fiscalYear: number,
    quarter?: number
  ): Promise<PerformanceHeatmap> {
    const rows: HeatmapRow[] = [];
    const columns: HeatmapColumn[] = domains.map(d => ({
      id: d,
      label: d === 'combined' ? 'Overall' : d.charAt(0).toUpperCase() + d.slice(1),
      domain: d,
    }));
    const cells: HeatmapCell[] = [];
    
    let minValue = 100;
    let maxValue = 0;
    
    for (const entityId of entityIds) {
      const entityRef = doc(db, 'companies', companyId, 'subsidiaries', entityId);
      const entitySnap = await getDoc(entityRef);
      
      const entityName = entitySnap.exists() ? entitySnap.data().name : entityId;
      
      rows.push({
        id: entityId,
        label: entityName,
        level: AGGREGATION_LEVELS.SUBSIDIARY,
      });
      
      const agg = await this.calculateAggregation(companyId, {
        level: AGGREGATION_LEVELS.SUBSIDIARY,
        entityId,
        entityName,
        fiscalYear,
        quarter,
      }, 'system');
      
      for (const domain of domains) {
        const score = domain === 'combined' ? agg.combinedScore :
                      domain === 'strategy' ? agg.strategyScore :
                      domain === 'okr' ? agg.okrScore : agg.kpiScore;
        
        minValue = Math.min(minValue, score);
        maxValue = Math.max(maxValue, score);
        
        cells.push({
          rowId: entityId,
          columnId: domain,
          value: score,
          rating: getRatingFromScore(score),
          trend: agg.trend,
          tooltip: `${entityName}: ${score.toFixed(1)}`,
        });
      }
    }
    
    return {
      rows,
      columns,
      cells,
      minValue,
      maxValue,
      rowType: 'entity',
      columnType: 'domain',
    };
  }

  // ==========================================================================
  // SAVE/RETRIEVE
  // ==========================================================================

  async saveAggregation(
    companyId: string,
    aggregation: AggregatedPerformance
  ): Promise<void> {
    const docRef = doc(getAggregationsCollection(companyId), aggregation.id);
    await setDoc(docRef, aggregation);
  }

  async getAggregation(
    companyId: string,
    entityId: string,
    fiscalYear: number,
    quarter?: number
  ): Promise<AggregatedPerformance | null> {
    const aggId = `${entityId}_${fiscalYear}_${quarter || 'full'}`;
    const docRef = doc(getAggregationsCollection(companyId), aggId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as AggregatedPerformance;
    }
    
    return null;
  }
}

// Export singleton instance
export const aggregationService = new AggregationService();
