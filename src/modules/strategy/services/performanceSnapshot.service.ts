// ============================================================================
// PERFORMANCE SNAPSHOT SERVICE
// DawinOS v2.0 - CEO Strategy Command Module
// Service for managing performance snapshots and trend analysis
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  PerformanceSnapshot,
  PerformanceTrend,
  TrendDataPoint,
  SnapshotFilters,
  SnapshotComparison,
} from '../types/aggregation.types';
import {
  SnapshotFrequency,
  PerformanceDomain,
  AggregationLevel,
  AGGREGATION_COLLECTIONS,
  AGGREGATION_DEFAULTS,
  AGGREGATION_LEVELS,
  TREND_INDICATORS,
  getRatingFromScore,
  getTrendFromChange,
} from '../constants/aggregation.constants';
import { aggregationService } from './aggregation.service';

// ----------------------------------------------------------------------------
// Collection References
// ----------------------------------------------------------------------------

function getSnapshotsCollection(companyId: string) {
  return collection(db, 'companies', companyId, AGGREGATION_COLLECTIONS.SNAPSHOTS);
}

function getSnapshotRef(companyId: string, snapshotId: string) {
  return doc(db, 'companies', companyId, AGGREGATION_COLLECTIONS.SNAPSHOTS, snapshotId);
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

function generateSnapshotId(
  entityId: string,
  frequency: SnapshotFrequency,
  date: Date
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const week = getWeekNumber(date);
  
  switch (frequency) {
    case 'daily':
      return `${entityId}_daily_${year}${month}${day}`;
    case 'weekly':
      return `${entityId}_weekly_${year}W${String(week).padStart(2, '0')}`;
    case 'monthly':
      return `${entityId}_monthly_${year}${month}`;
    case 'quarterly':
      const quarter = Math.ceil((date.getMonth() + 1) / 3);
      return `${entityId}_quarterly_${year}Q${quarter}`;
    default:
      return `${entityId}_${Date.now()}`;
  }
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function getFiscalQuarter(month: number): number {
  // Uganda fiscal year: Jul=Q1, Oct=Q2, Jan=Q3, Apr=Q4
  if (month >= 7 && month <= 9) return 1;
  if (month >= 10 && month <= 12) return 2;
  if (month >= 1 && month <= 3) return 3;
  return 4;
}

function getFiscalYear(date: Date): number {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  // Fiscal year starts July 1
  return month >= 7 ? year : year - 1;
}

// ============================================================================
// PERFORMANCE SNAPSHOT SERVICE CLASS
// ============================================================================

class PerformanceSnapshotService {
  // ==========================================================================
  // SNAPSHOT CRUD
  // ==========================================================================

  async createSnapshot(
    companyId: string,
    level: AggregationLevel,
    entityId: string,
    entityName: string,
    frequency: SnapshotFrequency,
    userId: string
  ): Promise<PerformanceSnapshot> {
    const now = new Date();
    const fiscalYear = getFiscalYear(now);
    const fiscalQuarter = getFiscalQuarter(now.getMonth() + 1);
    const fiscalMonth = now.getMonth() + 1;
    
    // Calculate aggregation
    const aggregation = await aggregationService.calculateAggregation(
      companyId,
      {
        level,
        entityId,
        entityName,
        fiscalYear,
        quarter: frequency === 'quarterly' ? fiscalQuarter : undefined,
        month: frequency === 'monthly' || frequency === 'daily' ? fiscalMonth : undefined,
      },
      userId
    );
    
    // Get previous snapshot for comparison
    const previousSnapshot = await this.getPreviousSnapshot(companyId, entityId, frequency);
    let comparison: SnapshotComparison | undefined;
    
    if (previousSnapshot) {
      const change = aggregation.combinedScore - previousSnapshot.combinedScore;
      const changePercent = previousSnapshot.combinedScore !== 0
        ? (change / previousSnapshot.combinedScore) * 100
        : 0;
      
      comparison = {
        period: 'previous_period',
        previousScore: previousSnapshot.combinedScore,
        currentScore: aggregation.combinedScore,
        change,
        changePercent,
        trend: getTrendFromChange(changePercent),
      };
    }
    
    const snapshotId = generateSnapshotId(entityId, frequency, now);
    const timestamp = Timestamp.now();
    
    // Get detailed aggregation data
    const strategyData = await aggregationService.aggregateStrategy(companyId, {
      level,
      entityId,
      entityName,
      fiscalYear,
    });
    
    const okrData = await aggregationService.aggregateOKRs(companyId, {
      level,
      entityId,
      entityName,
      fiscalYear,
      quarter: fiscalQuarter,
    });
    
    const kpiData = await aggregationService.aggregateKPIs(companyId, {
      level,
      entityId,
      entityName,
      fiscalYear,
    });
    
    const snapshot: PerformanceSnapshot = {
      id: snapshotId,
      companyId,
      level,
      entityId,
      entityName,
      snapshotDate: timestamp,
      fiscalYear,
      fiscalQuarter,
      fiscalMonth,
      frequency,
      strategyScore: aggregation.strategyScore,
      okrScore: aggregation.okrScore,
      kpiScore: aggregation.kpiScore,
      combinedScore: aggregation.combinedScore,
      rating: aggregation.rating,
      strategyData,
      okrData,
      kpiData,
      comparison,
      createdAt: timestamp,
      createdBy: userId,
    };
    
    await setDoc(getSnapshotRef(companyId, snapshotId), snapshot);
    return snapshot;
  }

  async getSnapshot(companyId: string, snapshotId: string): Promise<PerformanceSnapshot | null> {
    const docSnap = await getDoc(getSnapshotRef(companyId, snapshotId));
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as PerformanceSnapshot;
  }

  async getSnapshots(
    companyId: string,
    filters?: SnapshotFilters
  ): Promise<PerformanceSnapshot[]> {
    let q = query(getSnapshotsCollection(companyId), orderBy('snapshotDate', 'desc'));
    
    if (filters?.level) {
      q = query(q, where('level', '==', filters.level));
    }
    if (filters?.entityId) {
      q = query(q, where('entityId', '==', filters.entityId));
    }
    if (filters?.frequency) {
      q = query(q, where('frequency', '==', filters.frequency));
    }
    if (filters?.fiscalYear) {
      q = query(q, where('fiscalYear', '==', filters.fiscalYear));
    }
    if (filters?.quarter) {
      q = query(q, where('fiscalQuarter', '==', filters.quarter));
    }
    if (filters?.limit) {
      q = query(q, limit(filters.limit));
    }
    
    const snapshot = await getDocs(q);
    let snapshots = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as PerformanceSnapshot[];
    
    // Client-side date filtering
    if (filters?.startDate) {
      const startTs = Timestamp.fromDate(filters.startDate);
      snapshots = snapshots.filter(s => s.snapshotDate >= startTs);
    }
    if (filters?.endDate) {
      const endTs = Timestamp.fromDate(filters.endDate);
      snapshots = snapshots.filter(s => s.snapshotDate <= endTs);
    }
    
    return snapshots;
  }

  async deleteSnapshot(companyId: string, snapshotId: string): Promise<void> {
    await deleteDoc(getSnapshotRef(companyId, snapshotId));
  }

  private async getPreviousSnapshot(
    companyId: string,
    entityId: string,
    frequency: SnapshotFrequency
  ): Promise<PerformanceSnapshot | null> {
    const q = query(
      getSnapshotsCollection(companyId),
      where('entityId', '==', entityId),
      where('frequency', '==', frequency),
      orderBy('snapshotDate', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PerformanceSnapshot;
  }

  // ==========================================================================
  // TREND ANALYSIS
  // ==========================================================================

  async calculateTrend(
    companyId: string,
    entityId: string,
    entityName: string,
    level: AggregationLevel,
    domain: PerformanceDomain,
    frequency: SnapshotFrequency,
    periods: number = AGGREGATION_DEFAULTS.TREND_PERIODS
  ): Promise<PerformanceTrend> {
    const snapshots = await this.getSnapshots(companyId, {
      entityId,
      frequency,
      limit: periods,
    });
    
    if (snapshots.length < AGGREGATION_DEFAULTS.MIN_DATA_POINTS_FOR_TREND) {
      return {
        entityId,
        entityName,
        level,
        domain,
        dataPoints: [],
        trend: TREND_INDICATORS.STABLE,
        trendStrength: 0,
        volatility: 0,
        periodStart: Timestamp.now(),
        periodEnd: Timestamp.now(),
        dataPointCount: 0,
      };
    }
    
    // Build data points
    const dataPoints: TrendDataPoint[] = snapshots.map(s => {
      const score = domain === 'combined' ? s.combinedScore :
                    domain === 'strategy' ? s.strategyScore :
                    domain === 'okr' ? s.okrScore : s.kpiScore;
      
      return {
        date: s.snapshotDate,
        score,
        rating: getRatingFromScore(score),
        strategyScore: s.strategyScore,
        okrScore: s.okrScore,
        kpiScore: s.kpiScore,
      };
    }).reverse(); // Oldest first
    
    // Calculate trend using linear regression
    const { slope, rSquared } = this.linearRegression(dataPoints.map(dp => dp.score));
    
    // Calculate volatility (standard deviation)
    const scores = dataPoints.map(dp => dp.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const volatility = Math.sqrt(variance);
    
    // Determine trend indicator
    const changePercent = dataPoints.length > 1
      ? ((dataPoints[dataPoints.length - 1].score - dataPoints[0].score) / dataPoints[0].score) * 100
      : 0;
    const trend = getTrendFromChange(changePercent);
    
    // Project future value
    const projectedScore = Math.min(100, Math.max(0, 
      dataPoints[dataPoints.length - 1].score + slope
    ));
    
    // Confidence level based on R-squared and data points
    const confidenceLevel = rSquared * (Math.min(periods, dataPoints.length) / periods) * 100;
    
    return {
      entityId,
      entityName,
      level,
      domain,
      dataPoints,
      trend,
      trendStrength: rSquared,
      volatility,
      projectedScore,
      projectedRating: getRatingFromScore(projectedScore),
      confidenceLevel,
      periodStart: dataPoints[0].date,
      periodEnd: dataPoints[dataPoints.length - 1].date,
      dataPointCount: dataPoints.length,
    };
  }

  private linearRegression(values: number[]): { slope: number; intercept: number; rSquared: number } {
    const n = values.length;
    if (n < 2) return { slope: 0, intercept: values[0] || 0, rSquared: 0 };
    
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const mean = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0);
    const ssResidual = values.reduce((sum, y, i) => {
      const predicted = intercept + slope * i;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;
    
    return { slope, intercept, rSquared: Math.max(0, rSquared) };
  }

  // ==========================================================================
  // SCHEDULED SNAPSHOTS
  // ==========================================================================

  async createScheduledSnapshots(
    companyId: string,
    frequency: SnapshotFrequency,
    userId: string
  ): Promise<number> {
    let snapshotCount = 0;
    
    // Create group-level snapshot
    await this.createSnapshot(
      companyId,
      AGGREGATION_LEVELS.GROUP,
      companyId,
      'Dawin Group',
      frequency,
      userId
    );
    snapshotCount++;
    
    // Create subsidiary-level snapshots
    const subsidiariesRef = collection(db, 'companies', companyId, 'subsidiaries');
    const subSnapshot = await getDocs(query(subsidiariesRef, where('isActive', '==', true)));
    
    for (const subDoc of subSnapshot.docs) {
      const subData = subDoc.data();
      await this.createSnapshot(
        companyId,
        AGGREGATION_LEVELS.SUBSIDIARY,
        subDoc.id,
        subData.name,
        frequency,
        userId
      );
      snapshotCount++;
    }
    
    // For monthly/quarterly, also create department snapshots
    if (frequency === 'monthly' || frequency === 'quarterly') {
      const deptsRef = collection(db, 'companies', companyId, 'departments');
      const deptSnapshot = await getDocs(query(deptsRef, where('isActive', '==', true)));
      
      for (const deptDoc of deptSnapshot.docs) {
        const deptData = deptDoc.data();
        await this.createSnapshot(
          companyId,
          AGGREGATION_LEVELS.DEPARTMENT,
          deptDoc.id,
          deptData.name,
          frequency,
          userId
        );
        snapshotCount++;
      }
    }
    
    return snapshotCount;
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  async cleanupOldSnapshots(
    companyId: string,
    retentionDays: number = AGGREGATION_DEFAULTS.SNAPSHOT_RETENTION_DAYS
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);
    
    const q = query(
      getSnapshotsCollection(companyId),
      where('snapshotDate', '<', cutoffTimestamp)
    );
    
    const snapshot = await getDocs(q);
    let deletedCount = 0;
    
    for (const doc of snapshot.docs) {
      await deleteDoc(doc.ref);
      deletedCount++;
    }
    
    return deletedCount;
  }
}

// Export singleton instance
export const performanceSnapshotService = new PerformanceSnapshotService();
