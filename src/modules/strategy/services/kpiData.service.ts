// ============================================================================
// KPI DATA SERVICE - DawinOS CEO Strategy Command
// Firebase service for KPI data point, trend, and alert management
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  KPIDefinition,
  KPIDataPoint,
  KPITrend,
  KPITrendPeriod,
  KPIAlert,
  CreateDataPointInput,
  DataPointFilters,
} from '../types/kpi.types';
import {
  KPI_COLLECTIONS,
  KPI_PERFORMANCE,
  KPI_DEFAULTS,
  KPI_ALERT_TYPE,
  KPI_ALERT_SEVERITY,
  KPIPerformance,
  KPIDirection,
} from '../constants/kpi.constants';
import { kpiService } from './kpi.service';

// ID generation handled by Firestore doc() reference

// ----------------------------------------------------------------------------
// Collection References
// ----------------------------------------------------------------------------
function getDataPointsCollection(companyId: string) {
  return collection(db, 'companies', companyId, KPI_COLLECTIONS.DATA_POINTS);
}

function getDataPointRef(companyId: string, dataPointId: string) {
  return doc(db, 'companies', companyId, KPI_COLLECTIONS.DATA_POINTS, dataPointId);
}

function getAlertsCollection(companyId: string) {
  return collection(db, 'companies', companyId, KPI_COLLECTIONS.ALERTS);
}

function getAlertRef(companyId: string, alertId: string) {
  return doc(db, 'companies', companyId, KPI_COLLECTIONS.ALERTS, alertId);
}

// ----------------------------------------------------------------------------
// Performance Calculation
// ----------------------------------------------------------------------------
function calculatePerformanceStatus(
  value: number,
  target: { value: number; stretchValue?: number; minimumValue?: number; rangeMin?: number; rangeMax?: number },
  direction: KPIDirection
): KPIPerformance {
  const targetValue = target.value;
  const stretchValue = target.stretchValue;
  const minimumValue = target.minimumValue;

  switch (direction) {
    case 'higher_is_better':
      if (stretchValue && value >= stretchValue) return KPI_PERFORMANCE.EXCEEDING;
      if (value >= targetValue) return KPI_PERFORMANCE.ON_TARGET;
      if (minimumValue && value < minimumValue) return KPI_PERFORMANCE.CRITICAL;
      return KPI_PERFORMANCE.BELOW_TARGET;

    case 'lower_is_better':
      if (stretchValue && value <= stretchValue) return KPI_PERFORMANCE.EXCEEDING;
      if (value <= targetValue) return KPI_PERFORMANCE.ON_TARGET;
      if (minimumValue && value > minimumValue) return KPI_PERFORMANCE.CRITICAL;
      return KPI_PERFORMANCE.BELOW_TARGET;

    case 'target_is_best':
      const tolerance = targetValue * 0.05;
      if (Math.abs(value - targetValue) <= tolerance) return KPI_PERFORMANCE.ON_TARGET;
      if (Math.abs(value - targetValue) <= tolerance * 2) return KPI_PERFORMANCE.BELOW_TARGET;
      return KPI_PERFORMANCE.CRITICAL;

    case 'range_is_best':
      const rangeMin = target.rangeMin ?? targetValue * 0.9;
      const rangeMax = target.rangeMax ?? targetValue * 1.1;
      if (value >= rangeMin && value <= rangeMax) return KPI_PERFORMANCE.ON_TARGET;
      return KPI_PERFORMANCE.BELOW_TARGET;

    default:
      return KPI_PERFORMANCE.NO_DATA;
  }
}

// ============================================================================
// KPI DATA SERVICE CLASS
// ============================================================================
class KPIDataService {
  // ==========================================================================
  // DATA POINT MANAGEMENT
  // ==========================================================================

  async recordDataPoint(
    companyId: string,
    input: CreateDataPointInput,
    userId: string,
    userName?: string
  ): Promise<KPIDataPoint> {
    // Get KPI definition
    const kpi = await kpiService.getKPI(companyId, input.kpiId);
    if (!kpi) {
      throw new Error('KPI not found');
    }

    // Get previous data point
    const previousDataPoint = await this.getLatestDataPoint(companyId, input.kpiId);
    const previousValue = previousDataPoint?.value;

    // Calculate variance
    const targetValue = kpi.target.value;
    const variance = input.value - targetValue;
    const variancePercent = targetValue !== 0 ? (variance / targetValue) * 100 : 0;

    // Calculate performance
    const performanceStatus = calculatePerformanceStatus(input.value, kpi.target, kpi.direction);

    // Calculate score (0-100)
    let score: number;
    switch (kpi.direction) {
      case 'higher_is_better':
        score = targetValue > 0 ? Math.min(100, (input.value / targetValue) * 100) : 0;
        break;
      case 'lower_is_better':
        score = input.value > 0 && targetValue > 0 ? Math.min(100, (targetValue / input.value) * 100) : 0;
        break;
      default:
        score = performanceStatus === KPI_PERFORMANCE.ON_TARGET ? 100 : 50;
    }

    const colRef = getDataPointsCollection(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    const dataPoint: KPIDataPoint = {
      id: docRef.id,
      kpiId: input.kpiId,
      companyId,
      date: Timestamp.fromDate(input.date),
      periodStart: input.periodStart ? Timestamp.fromDate(input.periodStart) : Timestamp.fromDate(input.date),
      periodEnd: input.periodEnd ? Timestamp.fromDate(input.periodEnd) : Timestamp.fromDate(input.date),
      fiscalYear: input.fiscalYear,
      fiscalQuarter: input.fiscalQuarter,
      fiscalMonth: input.fiscalMonth,
      value: input.value,
      previousValue,
      target: targetValue,
      variance,
      variancePercent,
      performanceStatus,
      score,
      note: input.note,
      dataSource: kpi.dataSource.type,
      enteredBy: userId,
      enteredByName: userName,
      enteredAt: now,
    };

    await setDoc(docRef, dataPoint);

    // Update KPI with current value and performance
    await this.updateKPICurrentValue(companyId, kpi, input.value, performanceStatus, now);

    // Check thresholds and create alerts if necessary
    await this.checkThresholds(companyId, kpi, input.value);

    return dataPoint;
  }

  async getDataPoint(companyId: string, dataPointId: string): Promise<KPIDataPoint | null> {
    const docSnap = await getDoc(getDataPointRef(companyId, dataPointId));
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as KPIDataPoint;
  }

  async getDataPoints(
    companyId: string,
    kpiId: string,
    filters?: DataPointFilters
  ): Promise<KPIDataPoint[]> {
    let q = query(
      getDataPointsCollection(companyId),
      where('kpiId', '==', kpiId),
      orderBy('date', 'desc')
    );

    if (filters?.fiscalYear) {
      q = query(q, where('fiscalYear', '==', filters.fiscalYear));
    }
    if (filters?.fiscalQuarter) {
      q = query(q, where('fiscalQuarter', '==', filters.fiscalQuarter));
    }
    if (filters?.maxResults) {
      q = query(q, limit(filters.maxResults));
    }

    const snapshot = await getDocs(q);
    let dataPoints = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KPIDataPoint[];

    // Client-side date filtering
    if (filters?.startDate) {
      const startTs = Timestamp.fromDate(filters.startDate);
      dataPoints = dataPoints.filter((dp) => dp.date >= startTs);
    }
    if (filters?.endDate) {
      const endTs = Timestamp.fromDate(filters.endDate);
      dataPoints = dataPoints.filter((dp) => dp.date <= endTs);
    }

    return dataPoints;
  }

  async getLatestDataPoint(companyId: string, kpiId: string): Promise<KPIDataPoint | null> {
    const q = query(
      getDataPointsCollection(companyId),
      where('kpiId', '==', kpiId),
      orderBy('date', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as KPIDataPoint;
  }

  async updateDataPoint(
    companyId: string,
    dataPointId: string,
    updates: { value?: number; note?: string; adjustmentReason?: string },
    _userId: string
  ): Promise<KPIDataPoint> {
    const existing = await this.getDataPoint(companyId, dataPointId);
    if (!existing) {
      throw new Error('Data point not found');
    }

    const updateData: Partial<KPIDataPoint> = {};

    if (updates.value !== undefined) {
      const kpi = await kpiService.getKPI(companyId, existing.kpiId);
      if (!kpi) {
        throw new Error('KPI not found');
      }

      const targetValue = kpi.target.value;
      updateData.value = updates.value;
      updateData.variance = updates.value - targetValue;
      updateData.variancePercent = targetValue !== 0 ? (updateData.variance / targetValue) * 100 : 0;
      updateData.performanceStatus = calculatePerformanceStatus(updates.value, kpi.target, kpi.direction);
      updateData.isAdjusted = true;
      updateData.adjustmentReason = updates.adjustmentReason;

      // Update KPI current value if this is the latest data point
      const latest = await this.getLatestDataPoint(companyId, existing.kpiId);
      if (latest?.id === dataPointId) {
        await this.updateKPICurrentValue(
          companyId,
          kpi,
          updates.value,
          updateData.performanceStatus,
          Timestamp.now()
        );
      }
    }

    if (updates.note !== undefined) {
      updateData.note = updates.note;
    }

    await updateDoc(getDataPointRef(companyId, dataPointId), updateData);
    return (await this.getDataPoint(companyId, dataPointId))!;
  }

  private async updateKPICurrentValue(
    companyId: string,
    kpi: KPIDefinition,
    value: number,
    performance: KPIPerformance,
    timestamp: Timestamp
  ): Promise<void> {
    // Determine trend direction
    let trendDirection: 'up' | 'down' | 'stable' = 'stable';
    if (kpi.currentValue !== undefined) {
      if (value > kpi.currentValue) trendDirection = 'up';
      else if (value < kpi.currentValue) trendDirection = 'down';
    }

    const kpiRef = doc(db, 'companies', companyId, KPI_COLLECTIONS.DEFINITIONS, kpi.id);
    await updateDoc(kpiRef, {
      currentValue: value,
      currentPerformance: performance,
      lastDataPointDate: timestamp,
      trendDirection,
      updatedAt: timestamp,
    });
  }

  // ==========================================================================
  // TREND ANALYSIS
  // ==========================================================================

  async getKPITrend(companyId: string, kpiId: string, periods?: number): Promise<KPITrend> {
    const numPeriods = periods || KPI_DEFAULTS.TREND_PERIODS;
    const dataPoints = await this.getDataPoints(companyId, kpiId, { maxResults: numPeriods });

    const kpi = await kpiService.getKPI(companyId, kpiId);
    if (!kpi) {
      throw new Error('KPI not found');
    }

    const trendPeriods: KPITrendPeriod[] = dataPoints.map((dp) => ({
      date: dp.date,
      value: dp.value,
      target: dp.target,
      performance: dp.performanceStatus,
    }));

    // Calculate trend direction and strength using linear regression
    const { direction, strength, projectedValue } = this.calculateTrendMetrics(
      trendPeriods.map((p) => p.value)
    );

    return {
      kpiId,
      periods: trendPeriods.reverse(), // Oldest first for charts
      trendDirection: direction,
      trendStrength: strength,
      projectedValue,
      projectedDate: Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      ),
    };
  }

  private calculateTrendMetrics(values: number[]): {
    direction: 'up' | 'down' | 'stable';
    strength: number;
    projectedValue?: number;
  } {
    if (values.length < 2) {
      return { direction: 'stable', strength: 0 };
    }

    // Simple linear regression
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + i * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for strength
    const mean = sumY / n;
    const ssTotal = values.reduce((sum, y) => sum + Math.pow(y - mean, 2), 0);
    const ssResidual = values.reduce((sum, y, i) => {
      const predicted = intercept + slope * i;
      return sum + Math.pow(y - predicted, 2);
    }, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    // Determine direction based on slope relative to mean
    const slopeThreshold = Math.abs(mean) * 0.01; // 1% of mean
    let direction: 'up' | 'down' | 'stable';
    if (slope > slopeThreshold) {
      direction = 'up';
    } else if (slope < -slopeThreshold) {
      direction = 'down';
    } else {
      direction = 'stable';
    }

    // Project next value
    const projectedValue = intercept + slope * n;

    return {
      direction,
      strength: Math.abs(rSquared),
      projectedValue: projectedValue > 0 ? projectedValue : 0,
    };
  }

  async compareKPIPerformance(
    companyId: string,
    kpiId: string,
    currentPeriod: { startDate: Date; endDate: Date },
    previousPeriod: { startDate: Date; endDate: Date }
  ): Promise<{
    currentAvg: number;
    previousAvg: number;
    change: number;
    changePercent: number;
  }> {
    const currentDataPoints = await this.getDataPoints(companyId, kpiId, {
      startDate: currentPeriod.startDate,
      endDate: currentPeriod.endDate,
    });

    const previousDataPoints = await this.getDataPoints(companyId, kpiId, {
      startDate: previousPeriod.startDate,
      endDate: previousPeriod.endDate,
    });

    const currentAvg =
      currentDataPoints.length > 0
        ? currentDataPoints.reduce((sum, dp) => sum + dp.value, 0) / currentDataPoints.length
        : 0;

    const previousAvg =
      previousDataPoints.length > 0
        ? previousDataPoints.reduce((sum, dp) => sum + dp.value, 0) / previousDataPoints.length
        : 0;

    const change = currentAvg - previousAvg;
    const changePercent = previousAvg !== 0 ? (change / previousAvg) * 100 : 0;

    return { currentAvg, previousAvg, change, changePercent };
  }

  // ==========================================================================
  // ALERT MANAGEMENT
  // ==========================================================================

  private async checkThresholds(
    companyId: string,
    kpi: KPIDefinition,
    value: number
  ): Promise<void> {
    for (const threshold of kpi.thresholds) {
      if (!threshold.alertEnabled) continue;

      let thresholdCrossed = false;

      switch (threshold.comparison) {
        case 'above':
          thresholdCrossed = value > threshold.value;
          break;
        case 'below':
          thresholdCrossed = value < threshold.value;
          break;
        case 'equals':
          thresholdCrossed = Math.abs(value - threshold.value) < 0.001;
          break;
        case 'between':
          thresholdCrossed =
            threshold.upperValue !== undefined &&
            value >= threshold.value &&
            value <= threshold.upperValue;
          break;
      }

      if (thresholdCrossed) {
        await this.createAlert(companyId, kpi, threshold.id, value, threshold.value);
      }
    }
  }

  private async createAlert(
    companyId: string,
    kpi: KPIDefinition,
    thresholdId: string,
    currentValue: number,
    thresholdValue: number
  ): Promise<KPIAlert> {
    const colRef = getAlertsCollection(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    const threshold = kpi.thresholds.find((t) => t.id === thresholdId);
    const severity = currentValue < thresholdValue * 0.5
      ? KPI_ALERT_SEVERITY.CRITICAL
      : currentValue < thresholdValue * 0.8
        ? KPI_ALERT_SEVERITY.WARNING
        : KPI_ALERT_SEVERITY.INFO;

    const alert: KPIAlert = {
      id: docRef.id,
      kpiId: kpi.id,
      kpiCode: kpi.code,
      kpiName: kpi.name,
      companyId,
      type: KPI_ALERT_TYPE.THRESHOLD_CROSSED,
      severity,
      title: `${kpi.code} threshold crossed`,
      message: `${kpi.name} (${kpi.code}) has crossed the ${threshold?.name || 'threshold'} level. Current value: ${currentValue}, Threshold: ${thresholdValue}`,
      thresholdId,
      currentValue,
      thresholdValue,
      triggeredAt: now,
      notificationsSent: [],
    };

    await setDoc(docRef, alert);
    return alert;
  }

  async getActiveAlerts(companyId: string): Promise<KPIAlert[]> {
    const q = query(
      getAlertsCollection(companyId),
      where('resolvedAt', '==', null),
      orderBy('triggeredAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KPIAlert[];
  }

  async getAlertsByKPI(companyId: string, kpiId: string): Promise<KPIAlert[]> {
    const q = query(
      getAlertsCollection(companyId),
      where('kpiId', '==', kpiId),
      orderBy('triggeredAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as KPIAlert[];
  }

  async acknowledgeAlert(companyId: string, alertId: string, userId: string): Promise<void> {
    await updateDoc(getAlertRef(companyId, alertId), {
      acknowledgedAt: Timestamp.now(),
      acknowledgedBy: userId,
    });
  }

  async resolveAlert(companyId: string, alertId: string, userId: string): Promise<void> {
    await updateDoc(getAlertRef(companyId, alertId), {
      resolvedAt: Timestamp.now(),
      resolvedBy: userId,
    });
  }

  // ==========================================================================
  // CALCULATED KPI SUPPORT
  // ==========================================================================

  async calculateFormula(
    companyId: string,
    kpi: KPIDefinition
  ): Promise<number> {
    if (!kpi.calculation?.formula) {
      throw new Error('KPI has no formula defined');
    }

    const variables: Record<string, number> = {};

    for (const variable of kpi.calculation.variables || []) {
      switch (variable.sourceType) {
        case 'kpi':
          if (variable.sourceId) {
            const sourceKPI = await kpiService.getKPI(companyId, variable.sourceId);
            if (sourceKPI?.currentValue !== undefined) {
              variables[variable.name] = sourceKPI.currentValue;
            }
          }
          break;
        case 'constant':
          if (variable.constantValue !== undefined) {
            variables[variable.name] = variable.constantValue;
          }
          break;
      }
    }

    return this.evaluateMathExpression(kpi.calculation.formula, variables);
  }

  private evaluateMathExpression(formula: string, variables: Record<string, number>): number {
    let expression = formula;
    for (const [name, value] of Object.entries(variables)) {
      expression = expression.replace(new RegExp(`\\b${name}\\b`, 'g'), value.toString());
    }

    // Sanitize expression (only allow numbers, operators, parentheses)
    const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');

    try {
      return new Function(`return ${sanitized}`)();
    } catch {
      throw new Error('Invalid formula expression');
    }
  }

  async calculateAggregatedValue(companyId: string, kpi: KPIDefinition): Promise<number> {
    if (!kpi.aggregation?.sourceKPIIds || kpi.aggregation.sourceKPIIds.length === 0) {
      throw new Error('KPI has no source KPIs for aggregation');
    }

    const sourceValues: number[] = [];
    const weights: Record<string, number> = kpi.aggregation.weights || {};

    for (const sourceId of kpi.aggregation.sourceKPIIds) {
      const sourceKPI = await kpiService.getKPI(companyId, sourceId);
      if (sourceKPI?.currentValue !== undefined) {
        sourceValues.push(sourceKPI.currentValue);
      }
    }

    if (sourceValues.length === 0) {
      return 0;
    }

    switch (kpi.aggregation.method) {
      case 'sum':
        return sourceValues.reduce((sum, v) => sum + v, 0);

      case 'average':
        return sourceValues.reduce((sum, v) => sum + v, 0) / sourceValues.length;

      case 'weighted_average':
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < kpi.aggregation.sourceKPIIds.length; i++) {
          const weight = weights[kpi.aggregation.sourceKPIIds[i]] || 1;
          if (sourceValues[i] !== undefined) {
            weightedSum += sourceValues[i] * weight;
            totalWeight += weight;
          }
        }
        return totalWeight > 0 ? weightedSum / totalWeight : 0;

      case 'minimum':
        return Math.min(...sourceValues);

      case 'maximum':
        return Math.max(...sourceValues);

      case 'count':
        return sourceValues.length;

      case 'median':
        const sorted = [...sourceValues].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;

      case 'latest':
        return sourceValues[sourceValues.length - 1];

      default:
        return 0;
    }
  }
}

// Export singleton instance
export const kpiDataService = new KPIDataService();
