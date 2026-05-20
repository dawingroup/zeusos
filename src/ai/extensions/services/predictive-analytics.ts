/**
 * Predictive Analytics Service
 * AI-powered predictions for projects, deals, and portfolios
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import {
  AIPrediction,
  PredictionType,
  PredictionFactor,
  PredictionRecommendation,
  ProjectHealthAnalysis,
  DealScoring,
  DimensionHealth,
  RiskFactor,
  LinkableEntityType,
} from '../types/ai-extensions';
import { ModuleType } from '../../../subsidiaries/advisory/cross-module/types/cross-module';

export class PredictiveAnalyticsService {
  private predictionsRef = collection(db, 'aiPredictions');

  /**
   * Generate project completion prediction
   */
  async predictProjectCompletion(
    projectId: string,
    projectData: Record<string, any>,
    historicalData: Record<string, any>[]
  ): Promise<AIPrediction> {
    const prompt = `Analyze this infrastructure project and predict completion probability.

PROJECT DATA:
${JSON.stringify(projectData, null, 2)}

HISTORICAL SIMILAR PROJECTS:
${JSON.stringify(historicalData, null, 2)}

Consider:
- Current progress vs planned timeline
- Budget utilization patterns
- Resource availability
- Weather and seasonal factors in Uganda
- Contractor performance history
- Approval pipeline status

Generate a completion prediction with factors and recommendations.`;

    try {
      const response = await this.callPredictionAPI(prompt, 'project_completion');
      
      const prediction: AIPrediction = {
        id: `pred_${Date.now()}`,
        type: 'project_completion',
        prediction: response.prediction || `Project completion analysis based on current data`,
        probability: response.probability || 0.7,
        confidenceInterval: response.confidenceInterval || [0.6, 0.8],
        module: 'infrastructure',
        entityType: 'project',
        entityId: projectId,
        positiveFactors: response.positiveFactors || [],
        negativeFactors: response.negativeFactors || [],
        recommendations: response.recommendations || [],
        modelVersion: '1.0.0',
        generatedAt: new Date(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      };

      await this.storePrediction(prediction);
      return prediction;
    } catch (error) {
      console.error('Error generating prediction:', error);
      return this.generateFallbackPrediction(projectId, 'project_completion', 'infrastructure', 'project');
    }
  }

  /**
   * Analyze project health
   */
  async analyzeProjectHealth(
    projectId: string,
    projectData: Record<string, any>,
    milestones: Record<string, any>[],
    payments: Record<string, any>[]
  ): Promise<ProjectHealthAnalysis> {
    // Calculate health metrics from available data
    const scheduleHealth = this.calculateScheduleHealth(projectData, milestones);
    const budgetHealth = this.calculateBudgetHealth(projectData, payments);
    const qualityHealth = this.assessQualityHealth(projectData);
    const safetyHealth = this.assessSafetyHealth(projectData);

    // Calculate overall health score
    const healthScore = Math.round(
      (scheduleHealth.score + budgetHealth.score + qualityHealth.score + safetyHealth.score) / 4
    );

    const overallHealth: 'healthy' | 'at_risk' | 'critical' = 
      healthScore >= 70 ? 'healthy' : 
      healthScore >= 40 ? 'at_risk' : 'critical';

    // Identify risk factors
    const riskFactors = this.identifyRiskFactors(projectData, milestones, payments);

    // Generate recommendations
    const recommendations = this.generateHealthRecommendations(
      scheduleHealth,
      budgetHealth,
      qualityHealth,
      safetyHealth
    );

    // Determine trend
    const trendDirection = this.calculateTrend(projectData);

    return {
      projectId,
      overallHealth,
      healthScore,
      dimensions: {
        schedule: scheduleHealth,
        budget: budgetHealth,
        quality: qualityHealth,
        safety: safetyHealth,
      },
      riskFactors,
      recommendations,
      trendDirection,
    };
  }

  /**
   * Score investment deal
   */
  async scoreDeal(
    dealId: string,
    dealData: Record<string, any>,
    financials: Record<string, any>,
    comparables: Record<string, any>[]
  ): Promise<DealScoring> {
    // Calculate dimension scores
    const strategicFit = this.assessStrategicFit(dealData);
    const financialViability = this.assessFinancialViability(financials);
    const riskAssessment = this.assessDealRisk(dealData);
    const executionCapability = this.assessExecutionCapability(dealData);
    const marketConditions = this.assessMarketConditions(dealData, comparables);

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      strategicFit * 0.25 +
      financialViability * 0.30 +
      riskAssessment * 0.20 +
      executionCapability * 0.15 +
      marketConditions * 0.10
    );

    // Determine recommendation
    const recommendation: DealScoring['recommendation'] = 
      overallScore >= 80 ? 'strong_proceed' :
      overallScore >= 65 ? 'proceed' :
      overallScore >= 50 ? 'conditional' : 'decline';

    // Extract key factors
    const keyStrengths = this.identifyDealStrengths(dealData, financials);
    const keyRisks = this.identifyDealRisks(dealData, financials);
    const requiredConditions = this.identifyRequiredConditions(dealData);

    return {
      dealId,
      overallScore,
      recommendation,
      dimensions: {
        strategic_fit: strategicFit,
        financial_viability: financialViability,
        risk_assessment: riskAssessment,
        execution_capability: executionCapability,
        market_conditions: marketConditions,
      },
      keyStrengths,
      keyRisks,
      requiredConditions,
    };
  }

  /**
   * Predict budget variance
   */
  async predictBudgetVariance(
    entityId: string,
    entityType: LinkableEntityType,
    budgetData: Record<string, any>,
    spendingHistory: Record<string, any>[]
  ): Promise<AIPrediction> {
    // Analyze spending patterns
    const spendingRate = this.calculateSpendingRate(spendingHistory);
    const projectedSpend = this.projectFinalSpend(budgetData, spendingRate);
    const variance = projectedSpend - (budgetData.totalBudget || 0);
    const variancePercent = budgetData.totalBudget ? variance / budgetData.totalBudget : 0;

    const probability = Math.min(0.95, Math.max(0.5, 0.5 + Math.abs(variancePercent)));

    const positiveFactors: PredictionFactor[] = [];
    const negativeFactors: PredictionFactor[] = [];

    if (variancePercent > 0.1) {
      negativeFactors.push({
        factor: 'Spending trend exceeds budget',
        impact: 'high',
        direction: 'negative',
        value: `${(variancePercent * 100).toFixed(1)}% over`,
        explanation: 'Current spending rate projects budget overrun',
      });
    } else if (variancePercent < -0.1) {
      positiveFactors.push({
        factor: 'Spending below forecast',
        impact: 'medium',
        direction: 'positive',
        value: `${(Math.abs(variancePercent) * 100).toFixed(1)}% under`,
        explanation: 'Current spending rate is below budget allocation',
      });
    }

    const recommendations: PredictionRecommendation[] = [];
    if (variancePercent > 0.15) {
      recommendations.push({
        action: 'Review and reduce discretionary spending',
        priority: 'high',
        expectedImpact: 'Could reduce variance by 5-10%',
        effort: 'medium',
      });
    }

    const prediction: AIPrediction = {
      id: `pred_budget_${Date.now()}`,
      type: 'budget_variance',
      prediction: variancePercent > 0 
        ? `Projected ${(variancePercent * 100).toFixed(1)}% budget overrun`
        : `Projected ${(Math.abs(variancePercent) * 100).toFixed(1)}% under budget`,
      probability,
      confidenceInterval: [probability - 0.1, Math.min(1, probability + 0.1)],
      module: 'infrastructure',
      entityType,
      entityId,
      positiveFactors,
      negativeFactors,
      recommendations,
      modelVersion: '1.0.0',
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    await this.storePrediction(prediction);
    return prediction;
  }

  // Helper methods for health analysis
  private calculateScheduleHealth(
    projectData: Record<string, any>,
    _milestones: Record<string, any>[]
  ): DimensionHealth {
    const progress = projectData.progressPercent || 0;
    const plannedProgress = projectData.plannedProgress || progress;
    const variance = progress - plannedProgress;

    const score = Math.max(0, Math.min(100, 70 + variance));
    const status: 'green' | 'yellow' | 'red' = 
      variance >= -5 ? 'green' : variance >= -15 ? 'yellow' : 'red';

    return {
      status,
      score,
      trend: variance > 0 ? 'up' : variance < -5 ? 'down' : 'stable',
      details: `${progress}% complete vs ${plannedProgress}% planned`,
    };
  }

  private calculateBudgetHealth(
    projectData: Record<string, any>,
    payments: Record<string, any>[]
  ): DimensionHealth {
    const totalBudget = projectData.budgetAmount || 0;
    const totalSpent = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const progress = projectData.progressPercent || 0;

    const expectedSpend = totalBudget * (progress / 100);
    const variance = expectedSpend - totalSpent;
    const variancePercent = expectedSpend > 0 ? (variance / expectedSpend) * 100 : 0;

    const score = Math.max(0, Math.min(100, 70 + variancePercent));
    const status: 'green' | 'yellow' | 'red' = 
      variancePercent >= -10 ? 'green' : variancePercent >= -25 ? 'yellow' : 'red';

    return {
      status,
      score,
      trend: variancePercent > 0 ? 'up' : variancePercent < -10 ? 'down' : 'stable',
      details: `Spent ${totalSpent.toLocaleString()} of ${totalBudget.toLocaleString()} budget`,
    };
  }

  private assessQualityHealth(projectData: Record<string, any>): DimensionHealth {
    const qualityScore = projectData.qualityScore || 75;
    const status: 'green' | 'yellow' | 'red' = 
      qualityScore >= 80 ? 'green' : qualityScore >= 60 ? 'yellow' : 'red';

    return {
      status,
      score: qualityScore,
      trend: 'stable',
      details: `Quality score: ${qualityScore}/100`,
    };
  }

  private assessSafetyHealth(projectData: Record<string, any>): DimensionHealth {
    const safetyIncidents = projectData.safetyIncidents || 0;
    const score = Math.max(0, 100 - safetyIncidents * 20);
    const status: 'green' | 'yellow' | 'red' = 
      safetyIncidents === 0 ? 'green' : safetyIncidents <= 2 ? 'yellow' : 'red';

    return {
      status,
      score,
      trend: 'stable',
      details: `${safetyIncidents} safety incidents recorded`,
    };
  }

  private identifyRiskFactors(
    projectData: Record<string, any>,
    _milestones: Record<string, any>[],
    payments: Record<string, any>[]
  ): RiskFactor[] {
    const risks: RiskFactor[] = [];

    // Schedule risk
    if (projectData.progressPercent < (projectData.plannedProgress || 0) - 10) {
      risks.push({
        category: 'Schedule',
        description: 'Project is significantly behind schedule',
        probability: 0.7,
        impact: 0.8,
        mitigationStatus: 'unmitigated',
      });
    }

    // Budget risk
    const totalBudget = projectData.budgetAmount || 0;
    const totalSpent = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (totalSpent > totalBudget * 0.9 && projectData.progressPercent < 90) {
      risks.push({
        category: 'Budget',
        description: 'Budget nearly exhausted before completion',
        probability: 0.8,
        impact: 0.9,
        mitigationStatus: 'in_progress',
      });
    }

    return risks;
  }

  private generateHealthRecommendations(
    schedule: DimensionHealth,
    budget: DimensionHealth,
    quality: DimensionHealth,
    safety: DimensionHealth
  ): string[] {
    const recommendations: string[] = [];

    if (schedule.status === 'red') {
      recommendations.push('Implement schedule recovery plan with additional resources');
    }
    if (budget.status === 'red') {
      recommendations.push('Conduct urgent budget review and identify cost savings');
    }
    if (quality.status !== 'green') {
      recommendations.push('Increase quality inspections and address defects promptly');
    }
    if (safety.status !== 'green') {
      recommendations.push('Conduct safety audit and reinforce safety protocols');
    }

    return recommendations;
  }

  private calculateTrend(projectData: Record<string, any>): 'improving' | 'stable' | 'declining' {
    // Simplified trend calculation
    const recentProgress = projectData.recentProgressChange || 0;
    if (recentProgress > 5) return 'improving';
    if (recentProgress < -5) return 'declining';
    return 'stable';
  }

  // Deal scoring helpers
  private assessStrategicFit(dealData: Record<string, any>): number {
    return dealData.strategicScore || 70;
  }

  private assessFinancialViability(financials: Record<string, any>): number {
    const irr = financials.irr || 0;
    const npv = financials.npv || 0;
    
    let score = 50;
    if (irr > 0.15) score += 25;
    else if (irr > 0.10) score += 15;
    
    if (npv > 0) score += 25;
    
    return Math.min(100, score);
  }

  private assessDealRisk(dealData: Record<string, any>): number {
    const riskScore = dealData.riskScore || 50;
    return 100 - riskScore; // Invert so higher is better
  }

  private assessExecutionCapability(dealData: Record<string, any>): number {
    return dealData.executionScore || 65;
  }

  private assessMarketConditions(
    dealData: Record<string, any>,
    _comparables: Record<string, any>[]
  ): number {
    return dealData.marketScore || 70;
  }

  private identifyDealStrengths(
    dealData: Record<string, any>,
    financials: Record<string, any>
  ): string[] {
    const strengths: string[] = [];
    if (financials.irr > 0.15) strengths.push('Strong projected returns');
    if (dealData.experiencedSponsor) strengths.push('Experienced sponsor team');
    return strengths.length ? strengths : ['Diversification opportunity'];
  }

  private identifyDealRisks(
    dealData: Record<string, any>,
    financials: Record<string, any>
  ): string[] {
    const risks: string[] = [];
    if (financials.debtRatio > 0.7) risks.push('High leverage ratio');
    if (dealData.regulatoryUncertainty) risks.push('Regulatory uncertainty');
    return risks.length ? risks : ['Standard market risks apply'];
  }

  private identifyRequiredConditions(dealData: Record<string, any>): string[] {
    const conditions: string[] = [];
    if (dealData.pendingApprovals) conditions.push('Regulatory approvals required');
    if (dealData.dueDiligenceGaps) conditions.push('Complete due diligence');
    return conditions;
  }

  // Budget prediction helpers
  private calculateSpendingRate(spendingHistory: Record<string, any>[]): number {
    if (spendingHistory.length < 2) return 0;
    const totalSpent = spendingHistory.reduce((sum, s) => sum + (s.amount || 0), 0);
    const months = spendingHistory.length;
    return totalSpent / months;
  }

  private projectFinalSpend(
    budgetData: Record<string, any>,
    monthlyRate: number
  ): number {
    const remainingMonths = budgetData.remainingMonths || 6;
    const currentSpend = budgetData.currentSpend || 0;
    return currentSpend + monthlyRate * remainingMonths;
  }

  /**
   * Call prediction API (placeholder)
   */
  private async callPredictionAPI(
    _prompt: string,
    predictionType: PredictionType
  ): Promise<any> {
    console.log('Calling prediction API for:', predictionType);
    // In production, this would call Gemini via Cloud Function
    return {
      prediction: 'Analysis complete',
      probability: 0.75,
      confidenceInterval: [0.65, 0.85],
      positiveFactors: [],
      negativeFactors: [],
      recommendations: [],
    };
  }

  /**
   * Generate fallback prediction
   */
  private generateFallbackPrediction(
    entityId: string,
    type: PredictionType,
    module: ModuleType,
    entityType: LinkableEntityType
  ): AIPrediction {
    return {
      id: `pred_fallback_${Date.now()}`,
      type,
      prediction: 'Insufficient data for detailed prediction',
      probability: 0.5,
      confidenceInterval: [0.3, 0.7],
      module,
      entityType,
      entityId,
      positiveFactors: [],
      negativeFactors: [],
      recommendations: [{
        action: 'Add more data to improve prediction accuracy',
        priority: 'medium',
        expectedImpact: 'Better predictions with more historical data',
        effort: 'low',
      }],
      modelVersion: '1.0.0',
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  /**
   * Store prediction
   */
  private async storePrediction(prediction: AIPrediction): Promise<string> {
    const docRef = await addDoc(this.predictionsRef, {
      ...prediction,
      generatedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Get predictions for entity
   */
  async getPredictions(
    entityType: LinkableEntityType,
    entityId: string
  ): Promise<AIPrediction[]> {
    const q = query(
      this.predictionsRef,
      where('entityType', '==', entityType),
      where('entityId', '==', entityId),
      orderBy('generatedAt', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      generatedAt: doc.data().generatedAt?.toDate() || new Date(),
      validUntil: doc.data().validUntil?.toDate() || new Date(),
    })) as AIPrediction[];
  }
}

export const predictiveAnalyticsService = new PredictiveAnalyticsService();
