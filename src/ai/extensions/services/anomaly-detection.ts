/**
 * Anomaly Detection Service
 * Identifies unusual patterns and potential issues
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
  serverTimestamp,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import {
  Anomaly,
  ModuleType,
} from '../types/ai-extensions';

// Anomaly detection thresholds
const THRESHOLDS = {
  budgetOverrunPercent: 0.1, // 10% over budget
  timelineSlipDays: 14, // 2 weeks delay
  paymentDeviationPercent: 0.25, // 25% deviation from average
  rateDeviationPercent: 0.2, // 20% deviation from market rate
  duplicateThreshold: 0.95, // 95% similarity for duplicate detection
};

export class AnomalyDetectionService {
  private anomaliesRef = collection(db, 'anomalies');

  /**
   * Detect anomalies in project data
   */
  async detectProjectAnomalies(
    projectId: string,
    projectData: Record<string, any>,
    historicalData: Record<string, any>[],
    peerData: Record<string, any>[]
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Budget overrun detection
    const budgetAnomaly = this.detectBudgetOverrun(projectId, projectData);
    if (budgetAnomaly) anomalies.push(budgetAnomaly);

    // Timeline slip detection
    const timelineAnomaly = this.detectTimelineSlip(projectId, projectData);
    if (timelineAnomaly) anomalies.push(timelineAnomaly);

    // Historical comparison anomalies
    const historicalAnomalies = this.compareWithHistorical(projectId, projectData, historicalData);
    anomalies.push(...historicalAnomalies);

    // Peer comparison anomalies
    const peerAnomalies = this.compareWithPeers(projectId, projectData, peerData);
    anomalies.push(...peerAnomalies);

    // Missing approval detection
    const approvalAnomaly = this.detectMissingApprovals(projectId, projectData);
    if (approvalAnomaly) anomalies.push(approvalAnomaly);

    // Store detected anomalies
    for (const anomaly of anomalies) {
      await this.storeAnomaly(anomaly);
    }

    return anomalies;
  }

  /**
   * Detect budget overrun
   */
  private detectBudgetOverrun(
    projectId: string,
    projectData: Record<string, any>
  ): Anomaly | null {
    const budget = projectData.budgetAmount || 0;
    const spent = projectData.actualSpend || 0;
    const progress = projectData.progressPercent || 0;

    if (budget <= 0) return null;

    const expectedSpend = budget * (progress / 100);
    const variance = spent - expectedSpend;
    const variancePercent = variance / expectedSpend;

    if (variancePercent > THRESHOLDS.budgetOverrunPercent) {
      const severity = variancePercent > 0.25 ? 'critical' :
        variancePercent > 0.15 ? 'high' : 'medium';

      return {
        id: `anomaly_budget_${Date.now()}`,
        type: 'budget_overrun',
        severity,
        module: 'infrastructure',
        entityType: 'project',
        entityId: projectId,
        field: 'actualSpend',
        description: `Spending is ${(variancePercent * 100).toFixed(1)}% above expected for current progress`,
        expectedValue: expectedSpend,
        actualValue: spent,
        deviation: variancePercent,
        evidence: [{
          type: 'rule_violation',
          description: `Expected spend at ${progress}% progress: ${expectedSpend.toLocaleString()}, Actual: ${spent.toLocaleString()}`,
          data: { budget, spent, progress, expectedSpend },
        }],
        suggestedActions: [
          'Review recent expenditures for unnecessary costs',
          'Conduct variance analysis meeting',
          'Update forecast and communicate to stakeholders',
        ],
        detectedAt: new Date(),
        detectionMethod: 'rule_based',
        confidence: 0.9,
      };
    }

    return null;
  }

  /**
   * Detect timeline slip
   */
  private detectTimelineSlip(
    projectId: string,
    projectData: Record<string, any>
  ): Anomaly | null {
    const plannedProgress = projectData.plannedProgress || 0;
    const actualProgress = projectData.progressPercent || 0;
    const slippage = plannedProgress - actualProgress;

    if (slippage > 10) { // More than 10% behind
      const severity = slippage > 25 ? 'critical' :
        slippage > 15 ? 'high' : 'medium';

      return {
        id: `anomaly_timeline_${Date.now()}`,
        type: 'timeline_slip',
        severity,
        module: 'infrastructure',
        entityType: 'project',
        entityId: projectId,
        field: 'progressPercent',
        description: `Project is ${slippage.toFixed(1)}% behind schedule`,
        expectedValue: plannedProgress,
        actualValue: actualProgress,
        deviation: slippage / 100,
        evidence: [{
          type: 'rule_violation',
          description: `Planned progress: ${plannedProgress}%, Actual: ${actualProgress}%`,
          data: { plannedProgress, actualProgress, slippage },
        }],
        suggestedActions: [
          'Identify and address blocking issues',
          'Consider adding resources to critical path',
          'Review and update project schedule',
        ],
        detectedAt: new Date(),
        detectionMethod: 'rule_based',
        confidence: 0.85,
      };
    }

    return null;
  }

  /**
   * Compare with historical data
   */
  private compareWithHistorical(
    projectId: string,
    projectData: Record<string, any>,
    historicalData: Record<string, any>[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (historicalData.length < 3) return anomalies; // Need enough data

    // Calculate historical averages
    const avgBudgetUtilization = historicalData.reduce((sum, p) => {
      const utilization = p.actualSpend / p.budgetAmount;
      return sum + (isNaN(utilization) ? 0 : utilization);
    }, 0) / historicalData.length;

    const currentUtilization = (projectData.actualSpend || 0) / (projectData.budgetAmount || 1);
    const utilizationDeviation = Math.abs(currentUtilization - avgBudgetUtilization);

    if (utilizationDeviation > 0.2) {
      anomalies.push({
        id: `anomaly_hist_${Date.now()}`,
        type: 'pattern_break',
        severity: utilizationDeviation > 0.35 ? 'high' : 'medium',
        module: 'infrastructure',
        entityType: 'project',
        entityId: projectId,
        description: `Budget utilization deviates ${(utilizationDeviation * 100).toFixed(1)}% from historical average`,
        expectedValue: avgBudgetUtilization,
        actualValue: currentUtilization,
        deviation: utilizationDeviation,
        evidence: [{
          type: 'historical_comparison',
          description: `Historical average: ${(avgBudgetUtilization * 100).toFixed(1)}%, Current: ${(currentUtilization * 100).toFixed(1)}%`,
          data: { avgBudgetUtilization, currentUtilization, sampleSize: historicalData.length },
        }],
        suggestedActions: [
          'Review if project scope has changed significantly',
          'Analyze cost drivers vs historical projects',
        ],
        detectedAt: new Date(),
        detectionMethod: 'statistical',
        confidence: 0.75,
      });
    }

    return anomalies;
  }

  /**
   * Compare with peer projects
   */
  private compareWithPeers(
    projectId: string,
    projectData: Record<string, any>,
    peerData: Record<string, any>[]
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    if (peerData.length < 2) return anomalies;

    // Calculate peer average progress
    const avgProgress = peerData.reduce((sum, p) => sum + (p.progressPercent || 0), 0) / peerData.length;
    const currentProgress = projectData.progressPercent || 0;
    const progressDeviation = avgProgress - currentProgress;

    if (progressDeviation > 15) {
      anomalies.push({
        id: `anomaly_peer_${Date.now()}`,
        type: 'pattern_break',
        severity: progressDeviation > 25 ? 'high' : 'medium',
        module: 'infrastructure',
        entityType: 'project',
        entityId: projectId,
        description: `Progress is ${progressDeviation.toFixed(1)}% behind peer average`,
        expectedValue: avgProgress,
        actualValue: currentProgress,
        deviation: progressDeviation / 100,
        evidence: [{
          type: 'peer_comparison',
          description: `Peer average progress: ${avgProgress.toFixed(1)}%, This project: ${currentProgress.toFixed(1)}%`,
          data: { avgProgress, currentProgress, peerCount: peerData.length },
        }],
        suggestedActions: [
          'Investigate factors causing slower progress',
          'Learn from peer projects performing better',
        ],
        detectedAt: new Date(),
        detectionMethod: 'statistical',
        confidence: 0.7,
      });
    }

    return anomalies;
  }

  /**
   * Detect missing approvals
   */
  private detectMissingApprovals(
    projectId: string,
    projectData: Record<string, any>
  ): Anomaly | null {
    const pendingApprovals = projectData.pendingApprovals || [];
    const oldestPendingDays = projectData.oldestPendingApprovalDays || 0;

    if (oldestPendingDays > 7 && pendingApprovals.length > 0) {
      return {
        id: `anomaly_approval_${Date.now()}`,
        type: 'missing_approval',
        severity: oldestPendingDays > 14 ? 'high' : 'medium',
        module: 'infrastructure',
        entityType: 'project',
        entityId: projectId,
        description: `${pendingApprovals.length} approval(s) pending for over ${oldestPendingDays} days`,
        evidence: [{
          type: 'rule_violation',
          description: `Approvals pending: ${pendingApprovals.join(', ')}`,
          data: { pendingApprovals, oldestPendingDays },
        }],
        suggestedActions: [
          'Follow up with approvers',
          'Escalate if blocking critical work',
          'Consider alternative approval paths',
        ],
        detectedAt: new Date(),
        detectionMethod: 'rule_based',
        confidence: 0.95,
      };
    }

    return null;
  }

  /**
   * Detect payment anomalies
   */
  async detectPaymentAnomalies(
    payments: Record<string, any>[],
    _projectBudget: number,
    contractRates: Record<string, number>
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    if (payments.length < 2) return anomalies;

    // Calculate payment statistics
    const amounts = payments.map(p => p.amount || 0).filter(a => a > 0);
    const avgPayment = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(
      amounts.reduce((sum, a) => sum + Math.pow(a - avgPayment, 2), 0) / amounts.length
    );

    // Detect unusual payments
    for (const payment of payments) {
      const deviation = Math.abs((payment.amount || 0) - avgPayment);
      if (deviation > stdDev * 2) {
        anomalies.push({
          id: `anomaly_payment_${Date.now()}_${payment.id || Math.random()}`,
          type: 'unusual_payment',
          severity: deviation > stdDev * 3 ? 'high' : 'medium',
          module: 'infrastructure',
          entityType: 'payment',
          entityId: payment.id || 'unknown',
          field: 'amount',
          description: `Payment amount ${payment.amount?.toLocaleString()} deviates significantly from average`,
          expectedValue: avgPayment,
          actualValue: payment.amount,
          deviation: deviation / avgPayment,
          evidence: [{
            type: 'pattern_analysis',
            description: `Average payment: ${avgPayment.toLocaleString()}, This payment: ${payment.amount?.toLocaleString()}`,
            data: { avgPayment, stdDev, paymentAmount: payment.amount },
          }],
          suggestedActions: [
            'Verify payment details and supporting documents',
            'Confirm with approving authority',
          ],
          detectedAt: new Date(),
          detectionMethod: 'statistical',
          confidence: 0.8,
        });
      }
    }

    // Detect rate deviations
    for (const payment of payments) {
      if (payment.rateCategory && contractRates[payment.rateCategory]) {
        const contractRate = contractRates[payment.rateCategory];
        const actualRate = payment.rate || 0;
        const rateDeviation = Math.abs(actualRate - contractRate) / contractRate;

        if (rateDeviation > THRESHOLDS.rateDeviationPercent) {
          anomalies.push({
            id: `anomaly_rate_${Date.now()}_${payment.id || Math.random()}`,
            type: 'rate_deviation',
            severity: rateDeviation > 0.3 ? 'high' : 'medium',
            module: 'infrastructure',
            entityType: 'payment',
            entityId: payment.id || 'unknown',
            field: 'rate',
            description: `Rate for ${payment.rateCategory} deviates ${(rateDeviation * 100).toFixed(1)}% from contract rate`,
            expectedValue: contractRate,
            actualValue: actualRate,
            deviation: rateDeviation,
            evidence: [{
              type: 'rule_violation',
              description: `Contract rate: ${contractRate}, Applied rate: ${actualRate}`,
              data: { contractRate, actualRate, category: payment.rateCategory },
            }],
            suggestedActions: [
              'Verify rate application is correct',
              'Check for approved rate variations',
            ],
            detectedAt: new Date(),
            detectionMethod: 'rule_based',
            confidence: 0.9,
          });
        }
      }
    }

    // Detect potential duplicates
    const duplicates = this.detectDuplicatePayments(payments);
    anomalies.push(...duplicates);

    return anomalies;
  }

  /**
   * Detect duplicate payments
   */
  private detectDuplicatePayments(payments: Record<string, any>[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const checked = new Set<string>();

    for (let i = 0; i < payments.length; i++) {
      for (let j = i + 1; j < payments.length; j++) {
        const p1 = payments[i];
        const p2 = payments[j];
        const key = `${p1.id}-${p2.id}`;

        if (checked.has(key)) continue;
        checked.add(key);

        // Check for similarity
        const sameAmount = p1.amount === p2.amount;
        const sameVendor = p1.vendor === p2.vendor;
        const closeDate = p1.date && p2.date && 
          Math.abs(new Date(p1.date).getTime() - new Date(p2.date).getTime()) < 7 * 24 * 60 * 60 * 1000;

        if (sameAmount && sameVendor && closeDate) {
          anomalies.push({
            id: `anomaly_dup_${Date.now()}_${i}_${j}`,
            type: 'duplicate_entry',
            severity: 'high',
            module: 'infrastructure',
            entityType: 'payment',
            entityId: p1.id || 'unknown',
            description: `Potential duplicate payment detected: same amount (${p1.amount}) and vendor within 7 days`,
            evidence: [{
              type: 'pattern_analysis',
              description: `Payment 1: ${p1.id}, Payment 2: ${p2.id}`,
              data: { payment1: p1, payment2: p2 },
            }],
            suggestedActions: [
              'Verify both payments are legitimate',
              'Check invoice numbers are different',
              'Confirm with vendor if needed',
            ],
            detectedAt: new Date(),
            detectionMethod: 'pattern',
            confidence: 0.85,
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Detect BOQ anomalies
   */
  async detectBOQAnomalies(
    boqItems: Record<string, any>[],
    marketRates: Record<string, number>,
    _historicalRates: Record<string, number>
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    for (const item of boqItems) {
      const itemRate = item.rate || 0;
      const itemDesc = (item.description || '').toLowerCase();

      // Check against market rates
      for (const [material, marketRate] of Object.entries(marketRates)) {
        if (itemDesc.includes(material.toLowerCase())) {
          const deviation = (itemRate - marketRate) / marketRate;

          if (Math.abs(deviation) > THRESHOLDS.rateDeviationPercent) {
            anomalies.push({
              id: `anomaly_boq_${Date.now()}_${item.id || Math.random()}`,
              type: 'rate_deviation',
              severity: Math.abs(deviation) > 0.4 ? 'high' : 'medium',
              module: 'matflow',
              entityType: 'boq',
              entityId: item.boqId || 'unknown',
              field: 'rate',
              description: `Rate for "${item.description}" is ${(deviation * 100).toFixed(1)}% ${deviation > 0 ? 'above' : 'below'} market rate`,
              expectedValue: marketRate,
              actualValue: itemRate,
              deviation: Math.abs(deviation),
              evidence: [{
                type: 'peer_comparison',
                description: `Market rate: ${marketRate}, BOQ rate: ${itemRate}`,
                data: { marketRate, itemRate, material },
              }],
              suggestedActions: [
                deviation > 0 ? 'Negotiate for better pricing' : 'Verify quality specifications',
                'Get comparative quotes',
              ],
              detectedAt: new Date(),
              detectionMethod: 'statistical',
              confidence: 0.75,
            });
          }
          break;
        }
      }

      // Check for unusually high quantities
      if (item.quantity > 10000) {
        anomalies.push({
          id: `anomaly_qty_${Date.now()}_${item.id || Math.random()}`,
          type: 'data_inconsistency',
          severity: 'low',
          module: 'matflow',
          entityType: 'boq',
          entityId: item.boqId || 'unknown',
          field: 'quantity',
          description: `Unusually high quantity (${item.quantity}) for "${item.description}"`,
          evidence: [{
            type: 'rule_violation',
            description: 'Quantity exceeds typical thresholds',
            data: { quantity: item.quantity, item: item.description },
          }],
          suggestedActions: [
            'Verify quantity calculation',
            'Confirm unit of measurement',
          ],
          detectedAt: new Date(),
          detectionMethod: 'rule_based',
          confidence: 0.6,
        });
      }
    }

    return anomalies;
  }

  /**
   * Store anomaly
   */
  private async storeAnomaly(anomaly: Anomaly): Promise<string> {
    const docRef = await addDoc(this.anomaliesRef, {
      ...anomaly,
      detectedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Get unresolved anomalies
   */
  async getAnomalies(
    module: ModuleType,
    entityId?: string,
    severity?: Anomaly['severity']
  ): Promise<Anomaly[]> {
    try {
      let q = query(
        this.anomaliesRef,
        where('module', '==', module),
        where('resolvedAt', '==', null),
        orderBy('detectedAt', 'desc'),
        limit(50)
      );

      if (entityId) {
        q = query(
          this.anomaliesRef,
          where('module', '==', module),
          where('entityId', '==', entityId),
          where('resolvedAt', '==', null),
          orderBy('detectedAt', 'desc'),
          limit(50)
        );
      }

      const snapshot = await getDocs(q);
      let results = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        detectedAt: doc.data().detectedAt?.toDate() || new Date(),
      })) as Anomaly[];

      if (severity) {
        results = results.filter(a => a.severity === severity);
      }

      return results;
    } catch (error) {
      console.error('Error fetching anomalies:', error);
      return [];
    }
  }

  /**
   * Resolve anomaly
   */
  async resolveAnomaly(
    anomalyId: string,
    resolvedBy: string,
    resolution: string
  ): Promise<void> {
    await updateDoc(doc(this.anomaliesRef, anomalyId), {
      resolvedAt: serverTimestamp(),
      resolvedBy,
      resolution,
    });
  }

  /**
   * Subscribe to anomalies
   */
  subscribeAnomalies(
    module: ModuleType,
    callback: (anomalies: Anomaly[]) => void
  ): () => void {
    const q = query(
      this.anomaliesRef,
      where('module', '==', module),
      where('resolvedAt', '==', null),
      orderBy('detectedAt', 'desc'),
      limit(20)
    );

    return onSnapshot(q, (snapshot) => {
      const anomalies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        detectedAt: doc.data().detectedAt?.toDate() || new Date(),
      })) as Anomaly[];
      callback(anomalies);
    }, (error) => {
      console.error('Anomaly subscription error:', error);
      callback([]);
    });
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(
    module: ModuleType,
    entityId: string,
    callback: (anomalies: Anomaly[]) => void
  ): () => void {
    // Subscribe to entity-specific anomalies
    const q = query(
      this.anomaliesRef,
      where('module', '==', module),
      where('entityId', '==', entityId),
      where('resolvedAt', '==', null),
      orderBy('detectedAt', 'desc'),
      limit(10)
    );

    return onSnapshot(q, (snapshot) => {
      const anomalies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        detectedAt: doc.data().detectedAt?.toDate() || new Date(),
      })) as Anomaly[];
      
      if (anomalies.length > 0) {
        callback(anomalies);
      }
    }, (error) => {
      console.error('Monitoring subscription error:', error);
    });
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
