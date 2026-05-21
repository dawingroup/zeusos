// ============================================================================
// PERFORMANCE METRICS SERVICE
// ZeusOS v2.0 - HR Performance Module
// Firebase service for tracking employee performance metrics
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type { PerformanceMetrics } from '../types/development.types';

// ============================================================================
// PERFORMANCE METRICS CRUD
// ============================================================================

/**
 * Record performance metrics for an employee
 */
export async function recordPerformanceMetrics(
  companyId: string,
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  metrics: Omit<PerformanceMetrics, 'id' | 'companyId' | 'employeeId' | 'periodStart' | 'periodEnd' | 'createdAt' | 'updatedAt'>,
  recordedBy: string
): Promise<PerformanceMetrics> {
  const metricsData = {
    ...metrics,
    companyId,
    employeeId,
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    recordedBy,
  };

  const docRef = await addDoc(collection(db, 'performance_metrics'), metricsData);
  const docSnap = await getDoc(docRef);

  return {
    id: docRef.id,
    ...docSnap.data(),
  } as PerformanceMetrics;
}

/**
 * Get performance metrics for an employee
 */
export async function getPerformanceMetrics(
  companyId: string,
  employeeId: string,
  startDate?: Date,
  endDate?: Date
): Promise<PerformanceMetrics[]> {
  let q = query(
    collection(db, 'performance_metrics'),
    where('companyId', '==', companyId),
    where('employeeId', '==', employeeId),
    orderBy('periodStart', 'desc')
  );

  if (startDate) {
    q = query(q, where('periodStart', '>=', Timestamp.fromDate(startDate)));
  }

  if (endDate) {
    q = query(q, where('periodEnd', '<=', Timestamp.fromDate(endDate)));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as PerformanceMetrics[];
}

/**
 * Get a single performance metrics record
 */
export async function getPerformanceMetricsById(metricsId: string): Promise<PerformanceMetrics> {
  const docRef = doc(db, 'performance_metrics', metricsId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Performance metrics not found');
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as PerformanceMetrics;
}

/**
 * Update performance metrics
 */
export async function updatePerformanceMetrics(
  metricsId: string,
  updates: Partial<Omit<PerformanceMetrics, 'id' | 'companyId' | 'employeeId' | 'periodStart' | 'periodEnd' | 'createdAt'>>,
  updatedBy: string
): Promise<void> {
  const docRef = doc(db, 'performance_metrics', metricsId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy,
  });
}

/**
 * Delete performance metrics
 */
export async function deletePerformanceMetrics(metricsId: string): Promise<void> {
  const docRef = doc(db, 'performance_metrics', metricsId);
  await deleteDoc(docRef);
}

// ============================================================================
// METRICS CALCULATION
// ============================================================================

/**
 * Calculate overall performance score
 */
export function calculateOverallPerformanceScore(
  attendance: { attendanceRate: number },
  quality: { qualityScore: number },
  productivity: { efficiencyRate: number; onTimeDelivery: number },
  behavioral: {
    teamCollaboration: number;
    communication: number;
    initiative: number;
    adaptability: number;
    professionalism: number;
  }
): number {
  // Weighted calculation
  const attendanceScore = attendance.attendanceRate; // 15% weight
  const qualityScore = quality.qualityScore; // 30% weight
  const productivityScore = (productivity.efficiencyRate + productivity.onTimeDelivery) / 2; // 30% weight

  // Average of behavioral scores
  const behavioralScore =
    (behavioral.teamCollaboration +
      behavioral.communication +
      behavioral.initiative +
      behavioral.adaptability +
      behavioral.professionalism) /
    5; // 25% weight

  const overallScore =
    attendanceScore * 0.15 +
    qualityScore * 0.3 +
    productivityScore * 0.3 +
    behavioralScore * 0.25;

  return Math.round(overallScore * 100) / 100; // Round to 2 decimals
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get performance trends for an employee
 */
export async function getPerformanceTrends(
  companyId: string,
  employeeId: string,
  numberOfPeriods: number = 6
): Promise<{
  periods: Date[];
  overallScores: number[];
  attendanceRates: number[];
  qualityScores: number[];
  productivityScores: number[];
  behavioralScores: number[];
}> {
  const metrics = await getPerformanceMetrics(companyId, employeeId);

  // Get the most recent periods
  const recentMetrics = metrics.slice(0, numberOfPeriods).reverse();

  return {
    periods: recentMetrics.map(m =>
      m.periodEnd instanceof Timestamp ? m.periodEnd.toDate() : new Date(m.periodEnd)
    ),
    overallScores: recentMetrics.map(m => m.overallPerformanceScore),
    attendanceRates: recentMetrics.map(m => m.attendance.attendanceRate),
    qualityScores: recentMetrics.map(m => m.quality.qualityScore),
    productivityScores: recentMetrics.map(m => m.productivity.efficiencyRate),
    behavioralScores: recentMetrics.map(m => {
      const b = m.behavioral;
      return (b.teamCollaboration + b.communication + b.initiative + b.adaptability + b.professionalism) / 5;
    }),
  };
}

/**
 * Get performance comparison across employees
 */
export async function getTeamPerformanceComparison(
  companyId: string,
  employeeIds: string[],
  periodStart: Date,
  periodEnd: Date
): Promise<
  Array<{
    employeeId: string;
    averageScore: number;
    attendanceRate: number;
    qualityScore: number;
    productivityScore: number;
    behavioralScore: number;
  }>
> {
  const comparison = await Promise.all(
    employeeIds.map(async employeeId => {
      const metrics = await getPerformanceMetrics(
        companyId,
        employeeId,
        periodStart,
        periodEnd
      );

      if (metrics.length === 0) {
        return {
          employeeId,
          averageScore: 0,
          attendanceRate: 0,
          qualityScore: 0,
          productivityScore: 0,
          behavioralScore: 0,
        };
      }

      const avgScore =
        metrics.reduce((sum, m) => sum + m.overallPerformanceScore, 0) / metrics.length;
      const avgAttendance =
        metrics.reduce((sum, m) => sum + m.attendance.attendanceRate, 0) / metrics.length;
      const avgQuality =
        metrics.reduce((sum, m) => sum + m.quality.qualityScore, 0) / metrics.length;
      const avgProductivity =
        metrics.reduce((sum, m) => sum + m.productivity.efficiencyRate, 0) / metrics.length;
      const avgBehavioral =
        metrics.reduce((sum, m) => {
          const b = m.behavioral;
          return (
            sum +
            (b.teamCollaboration + b.communication + b.initiative + b.adaptability + b.professionalism) /
              5
          );
        }, 0) / metrics.length;

      return {
        employeeId,
        averageScore: Math.round(avgScore * 100) / 100,
        attendanceRate: Math.round(avgAttendance * 100) / 100,
        qualityScore: Math.round(avgQuality * 100) / 100,
        productivityScore: Math.round(avgProductivity * 100) / 100,
        behavioralScore: Math.round(avgBehavioral * 100) / 100,
      };
    })
  );

  return comparison.sort((a, b) => b.averageScore - a.averageScore);
}

/**
 * Get department-wide performance statistics
 */
export async function getDepartmentPerformanceStats(
  companyId: string,
  _departmentId: string,
  employeeIds: string[],
  periodStart: Date,
  periodEnd: Date
): Promise<{
  totalEmployees: number;
  averagePerformanceScore: number;
  averageAttendanceRate: number;
  averageQualityScore: number;
  averageProductivityRate: number;
  topPerformers: Array<{ employeeId: string; score: number }>;
  needsImprovement: Array<{ employeeId: string; score: number }>;
}> {
  const comparison = await getTeamPerformanceComparison(
    companyId,
    employeeIds,
    periodStart,
    periodEnd
  );

  const totalEmployees = comparison.length;
  const avgPerformance =
    comparison.reduce((sum, emp) => sum + emp.averageScore, 0) / totalEmployees || 0;
  const avgAttendance =
    comparison.reduce((sum, emp) => sum + emp.attendanceRate, 0) / totalEmployees || 0;
  const avgQuality =
    comparison.reduce((sum, emp) => sum + emp.qualityScore, 0) / totalEmployees || 0;
  const avgProductivity =
    comparison.reduce((sum, emp) => sum + emp.productivityScore, 0) / totalEmployees || 0;

  // Top 20% performers
  const topCount = Math.max(1, Math.ceil(totalEmployees * 0.2));
  const topPerformers = comparison
    .slice(0, topCount)
    .map(emp => ({ employeeId: emp.employeeId, score: emp.averageScore }));

  // Bottom 20% needing improvement
  const needsImprovementCount = Math.max(1, Math.ceil(totalEmployees * 0.2));
  const needsImprovement = comparison
    .slice(-needsImprovementCount)
    .map(emp => ({ employeeId: emp.employeeId, score: emp.averageScore }));

  return {
    totalEmployees,
    averagePerformanceScore: Math.round(avgPerformance * 100) / 100,
    averageAttendanceRate: Math.round(avgAttendance * 100) / 100,
    averageQualityScore: Math.round(avgQuality * 100) / 100,
    averageProductivityRate: Math.round(avgProductivity * 100) / 100,
    topPerformers,
    needsImprovement,
  };
}

/**
 * Get performance alerts for managers
 */
export async function getPerformanceAlerts(
  companyId: string,
  employeeIds: string[],
  thresholds: {
    attendanceMin?: number; // e.g., 95
    qualityMin?: number; // e.g., 80
    productivityMin?: number; // e.g., 85
    overallMin?: number; // e.g., 75
  } = {}
): Promise<
  Array<{
    employeeId: string;
    alertType: 'attendance' | 'quality' | 'productivity' | 'overall';
    currentValue: number;
    threshold: number;
    severity: 'warning' | 'critical';
  }>
> {
  const defaultThresholds = {
    attendanceMin: thresholds.attendanceMin || 95,
    qualityMin: thresholds.qualityMin || 80,
    productivityMin: thresholds.productivityMin || 85,
    overallMin: thresholds.overallMin || 75,
  };

  const alerts: Array<{
    employeeId: string;
    alertType: 'attendance' | 'quality' | 'productivity' | 'overall';
    currentValue: number;
    threshold: number;
    severity: 'warning' | 'critical';
  }> = [];

  for (const employeeId of employeeIds) {
    const metrics = await getPerformanceMetrics(companyId, employeeId);

    if (metrics.length === 0) continue;

    // Get most recent metrics
    const latestMetrics = metrics[0];

    // Check attendance
    if (latestMetrics.attendance.attendanceRate < defaultThresholds.attendanceMin) {
      alerts.push({
        employeeId,
        alertType: 'attendance',
        currentValue: latestMetrics.attendance.attendanceRate,
        threshold: defaultThresholds.attendanceMin,
        severity:
          latestMetrics.attendance.attendanceRate < defaultThresholds.attendanceMin - 5
            ? 'critical'
            : 'warning',
      });
    }

    // Check quality
    if (latestMetrics.quality.qualityScore < defaultThresholds.qualityMin) {
      alerts.push({
        employeeId,
        alertType: 'quality',
        currentValue: latestMetrics.quality.qualityScore,
        threshold: defaultThresholds.qualityMin,
        severity:
          latestMetrics.quality.qualityScore < defaultThresholds.qualityMin - 10
            ? 'critical'
            : 'warning',
      });
    }

    // Check productivity
    if (latestMetrics.productivity.efficiencyRate < defaultThresholds.productivityMin) {
      alerts.push({
        employeeId,
        alertType: 'productivity',
        currentValue: latestMetrics.productivity.efficiencyRate,
        threshold: defaultThresholds.productivityMin,
        severity:
          latestMetrics.productivity.efficiencyRate < defaultThresholds.productivityMin - 10
            ? 'critical'
            : 'warning',
      });
    }

    // Check overall
    if (latestMetrics.overallPerformanceScore < defaultThresholds.overallMin) {
      alerts.push({
        employeeId,
        alertType: 'overall',
        currentValue: latestMetrics.overallPerformanceScore,
        threshold: defaultThresholds.overallMin,
        severity:
          latestMetrics.overallPerformanceScore < defaultThresholds.overallMin - 10
            ? 'critical'
            : 'warning',
      });
    }
  }

  return alerts;
}
