/**
 * Financial Model Service
 * 
 * Manages financial models, scenarios, and calculations
 */

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
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import {
  FinancialModel,
  ModelAssumptions,
  ModelOutputs,
  ModelInvestmentStructure,
} from '../types/financial-model';
import { CashFlowProjection, CashFlowSummary, RevenueBreakdown, CostBreakdown } from '../types/cash-flow';
import { ReturnMetrics, DebtMetrics, DSCRByPeriod } from '../types/returns';
import { Scenario, ScenarioType, AssumptionOverride, ScenarioComparison } from '../types/scenario';
import { SensitivityAnalysis, SensitivityVariable, SensitivityResult, TornadoData, TornadoVariable } from '../types/sensitivity';
import {
  calculateReturnMetrics,
  calculateWACC,
  calculateCAPM,
  calculateGordonGrowthTerminalValue,
  calculateExitMultipleTerminalValue,
} from '../utils/financial-calculations';

const MODELS_COLLECTION = 'advisoryPlatform/investment/financialModels';

export class FinancialModelService {
  /**
   * Get financial model by ID
   */
  async getFinancialModel(modelId: string): Promise<FinancialModel | null> {
    const docRef = doc(db, MODELS_COLLECTION, modelId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return docSnap.data() as FinancialModel;
  }

  /**
   * Get financial models for a deal
   */
  async getDealModels(dealId: string): Promise<FinancialModel[]> {
    const q = query(
      collection(db, MODELS_COLLECTION),
      where('dealId', '==', dealId),
      orderBy('updatedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as FinancialModel);
  }

  /**
   * Get latest approved model for a deal
   */
  async getLatestApprovedModel(dealId: string): Promise<FinancialModel | null> {
    const q = query(
      collection(db, MODELS_COLLECTION),
      where('dealId', '==', dealId),
      where('status', '==', 'approved'),
      orderBy('approvedAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.length > 0 ? snapshot.docs[0].data() as FinancialModel : null;
  }

  /**
   * Create new financial model
   */
  async createFinancialModel(
    model: Omit<FinancialModel, 'id' | 'createdAt' | 'updatedAt' | 'cashFlows' | 'cashFlowSummary' | 'equityReturns' | 'outputs'>,
    userId: string
  ): Promise<FinancialModel> {
    const modelId = doc(collection(db, MODELS_COLLECTION)).id;
    const now = Timestamp.now();
    
    // Calculate cash flows and returns
    const calculated = this.calculateModelOutputs(model.assumptions, model.investmentStructure);
    
    const newModel: FinancialModel = {
      ...model,
      id: modelId,
      status: 'draft',
      cashFlows: calculated.cashFlows,
      cashFlowSummary: calculated.cashFlowSummary,
      equityReturns: calculated.equityReturns,
      debtMetrics: calculated.debtMetrics,
      outputs: calculated.outputs,
      createdAt: now,
      createdBy: userId,
      updatedAt: now,
      updatedBy: userId,
    };
    
    await setDoc(doc(db, MODELS_COLLECTION, modelId), newModel);
    
    return newModel;
  }

  /**
   * Update financial model
   */
  async updateFinancialModel(
    modelId: string,
    updates: Partial<FinancialModel>,
    userId: string
  ): Promise<FinancialModel> {
    const existing = await this.getFinancialModel(modelId);
    if (!existing) {
      throw new Error('Financial model not found');
    }
    
    // If assumptions changed, recalculate
    const needsRecalculation = updates.assumptions || updates.investmentStructure;
    
    let updatedModel: FinancialModel = {
      ...existing,
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };
    
    if (needsRecalculation) {
      const calculated = this.calculateModelOutputs(
        updatedModel.assumptions,
        updatedModel.investmentStructure
      );
      updatedModel = {
        ...updatedModel,
        cashFlows: calculated.cashFlows,
        cashFlowSummary: calculated.cashFlowSummary,
        equityReturns: calculated.equityReturns,
        debtMetrics: calculated.debtMetrics,
        outputs: calculated.outputs,
      };
    }
    
    await updateDoc(doc(db, MODELS_COLLECTION, modelId), updatedModel as unknown as Record<string, unknown>);
    
    return updatedModel;
  }

  /**
   * Create new version of model
   */
  async createModelVersion(
    sourceModelId: string,
    versionNotes: string,
    userId: string
  ): Promise<FinancialModel> {
    const sourceModel = await this.getFinancialModel(sourceModelId);
    if (!sourceModel) {
      throw new Error('Source model not found');
    }
    
    // Parse and increment version
    const versionParts = sourceModel.version.split('.');
    const newVersion = `${versionParts[0]}.${parseInt(versionParts[1] || '0') + 1}`;
    
    const newModel = await this.createFinancialModel(
      {
        ...sourceModel,
        version: newVersion,
        previousVersionId: sourceModelId,
        versionNotes,
        status: 'draft',
        baseCase: sourceModel.baseCase,
        scenarios: sourceModel.scenarios,
        sensitivityAnalyses: sourceModel.sensitivityAnalyses,
        approvedAt: undefined,
        approvedBy: undefined,
      },
      userId
    );
    
    // Mark old model as superseded
    await updateDoc(doc(db, MODELS_COLLECTION, sourceModelId), {
      status: 'superseded',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    
    return newModel;
  }

  /**
   * Submit model for approval
   */
  async submitModelForApproval(modelId: string, userId: string): Promise<void> {
    const model = await this.getFinancialModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }
    
    if (model.status !== 'draft') {
      throw new Error('Only draft models can be submitted for approval');
    }
    
    await updateDoc(doc(db, MODELS_COLLECTION, modelId), {
      status: 'in_review',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  /**
   * Approve financial model
   */
  async approveModel(modelId: string, userId: string): Promise<void> {
    const model = await this.getFinancialModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }
    
    if (model.status !== 'in_review') {
      throw new Error('Only models in review can be approved');
    }
    
    await updateDoc(doc(db, MODELS_COLLECTION, modelId), {
      status: 'approved',
      approvedAt: Timestamp.now(),
      approvedBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  /**
   * Calculate model outputs from assumptions
   */
  calculateModelOutputs(
    assumptions: ModelAssumptions,
    investmentStructure: ModelInvestmentStructure
  ): {
    cashFlows: CashFlowProjection[];
    cashFlowSummary: CashFlowSummary;
    equityReturns: ReturnMetrics;
    debtMetrics?: DebtMetrics;
    outputs: ModelOutputs;
  } {
    // Generate cash flows
    const cashFlows = this.generateCashFlows(assumptions, investmentStructure);
    
    // Calculate summary
    const cashFlowSummary = this.summarizeCashFlows(cashFlows, assumptions);
    
    // Calculate WACC
    const wacc = this.calculateModelWACC(assumptions, investmentStructure);
    const costOfEquity = this.calculateModelCostOfEquity(assumptions);
    
    // Calculate returns
    const equityCashFlows = cashFlows.map(cf => cf.fcfe);
    const projectCashFlows = cashFlows.map(cf => cf.fcff);
    
    const returnMetrics = calculateReturnMetrics(
      equityCashFlows,
      projectCashFlows,
      wacc,
      costOfEquity
    );
    
    const equityReturns: ReturnMetrics = {
      projectIRR: returnMetrics.projectIRR,
      equityIRR: returnMetrics.equityIRR,
      npv: returnMetrics.npv,
      npvAtWacc: returnMetrics.npvAtWacc,
      npvAtCostOfEquity: returnMetrics.npvAtCostOfEquity,
      moic: returnMetrics.moic,
      paybackPeriod: returnMetrics.paybackPeriod,
      discountedPaybackPeriod: returnMetrics.discountedPaybackPeriod,
      returnsByYear: returnMetrics.returnsByYear,
    };
    
    // Calculate debt metrics if applicable
    let debtMetrics: DebtMetrics | undefined;
    if (investmentStructure.debtAmount && investmentStructure.debtAmount > 0) {
      debtMetrics = this.calculateDebtMetrics(cashFlows, assumptions, investmentStructure);
    }
    
    // Model outputs
    const outputs: ModelOutputs = {
      projectIRR: equityReturns.projectIRR,
      equityIRR: equityReturns.equityIRR,
      npv: equityReturns.npv,
      moic: equityReturns.moic,
      paybackPeriod: equityReturns.paybackPeriod,
      minDSCR: debtMetrics?.dscr.minimum,
      averageDSCR: debtMetrics?.dscr.average,
    };
    
    return {
      cashFlows,
      cashFlowSummary,
      equityReturns,
      debtMetrics,
      outputs,
    };
  }

  /**
   * Generate cash flows from assumptions
   */
  private generateCashFlows(
    assumptions: ModelAssumptions,
    structure: ModelInvestmentStructure
  ): CashFlowProjection[] {
    const projections: CashFlowProjection[] = [];
    const startDate = new Date(assumptions.modelStartDate);
    
    for (let year = 0; year <= assumptions.projectionPeriod; year++) {
      const periodStart = new Date(startDate);
      periodStart.setFullYear(periodStart.getFullYear() + year);
      const periodEnd = new Date(periodStart);
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      periodEnd.setDate(periodEnd.getDate() - 1);
      
      // Calculate revenue
      const revenue = this.calculateYearRevenue(year, assumptions);
      
      // Calculate costs
      const operatingCosts = this.calculateYearCosts(year, assumptions, revenue.total);
      
      // EBITDA
      const ebitda = revenue.total - operatingCosts.total;
      const ebitdaMargin = revenue.total > 0 ? ebitda / revenue.total : 0;
      
      // Depreciation
      const depreciation = this.calculateDepreciation(year, assumptions);
      const amortization = 0;
      
      // EBIT
      const ebit = ebitda - depreciation - amortization;
      
      // Interest
      const { interestExpense, debtDrawdown, principalRepayment } = 
        this.calculateDebtService(year, assumptions, structure);
      const interestIncome = 0;
      
      // Tax
      const taxableIncome = Math.max(0, ebit - interestExpense + interestIncome);
      const taxExpense = this.calculateTax(taxableIncome, year, assumptions);
      
      // Net income
      const netIncome = taxableIncome - taxExpense;
      
      // Capex
      const capex = this.calculateYearCapex(year, assumptions);
      
      // Working capital
      const workingCapitalChange = this.calculateWorkingCapitalChange(year, revenue.total, assumptions);
      
      // Free cash flows
      const fcff = ebitda - taxExpense - capex - workingCapitalChange;
      const fcfe = fcff - interestExpense + interestIncome - principalRepayment + debtDrawdown;
      
      // Cash position
      const previousCash = year > 0 ? projections[year - 1].closingCash : 0;
      const openingCash = previousCash;
      const cashFlow = fcfe;
      const closingCash = openingCash + cashFlow;
      
      // DSCR
      const debtService = interestExpense + principalRepayment;
      const cashAvailableForDebtService = ebitda - taxExpense - capex - workingCapitalChange;
      const dscr = debtService > 0 ? cashAvailableForDebtService / debtService : undefined;
      
      projections.push({
        period: year,
        periodType: 'annual',
        startDate: periodStart,
        endDate: periodEnd,
        revenue,
        operatingCosts,
        ebitda,
        ebitdaMargin,
        depreciation,
        amortization,
        ebit,
        interestExpense,
        interestIncome,
        taxableIncome,
        taxExpense,
        netIncome,
        addBackDepreciation: depreciation,
        workingCapitalChange,
        capex,
        fcff,
        fcfe,
        debtDrawdown,
        principalRepayment,
        debtServicePayment: debtService,
        openingCash,
        cashFlow,
        closingCash,
        dscr,
      });
    }
    
    // Add terminal value to final year
    if (assumptions.terminalValue.method !== 'none') {
      const lastProjection = projections[projections.length - 1];
      const terminalValue = this.calculateTerminalValue(lastProjection, assumptions);
      lastProjection.fcff += terminalValue;
      lastProjection.fcfe += terminalValue;
    }
    
    return projections;
  }

  private calculateYearRevenue(year: number, assumptions: ModelAssumptions): RevenueBreakdown {
    const { revenue } = assumptions;
    
    if (year === 0) {
      return { total: 0, byStream: [] };
    }
    
    let baseRevenue = 0;
    
    switch (revenue.revenueModel) {
      case 'capacity_based':
        const utilization = revenue.utilizationRate || 0;
        const capacity = revenue.capacity || 0;
        const tariff = revenue.tariff || 0;
        baseRevenue = capacity * utilization * tariff;
        // Apply escalation
        if (revenue.tariffEscalation && year > 1) {
          baseRevenue *= Math.pow(1 + revenue.tariffEscalation, year - 1);
        }
        break;
      
      case 'volume_based':
        const volume = (revenue.baseVolume || 0) * 
                       Math.pow(1 + (revenue.volumeGrowthRate || 0), year - 1);
        const price = (revenue.basePrice || 0) * 
                      Math.pow(1 + (revenue.priceEscalation || 0), year - 1);
        baseRevenue = volume * price;
        break;
      
      case 'availability_based':
        baseRevenue = (revenue.availabilityPayment || 0) * 
                      Math.pow(1 + (revenue.paymentEscalation || 0), year - 1);
        break;
      
      default:
        baseRevenue = 0;
    }
    
    // Apply ramp-up if applicable
    if (revenue.rampUpSchedule && revenue.rampUpPeriod && year <= Math.ceil(revenue.rampUpPeriod / 12)) {
      const rampUpStep = revenue.rampUpSchedule.find(s => s.month >= year * 12);
      const rampUpFactor = rampUpStep?.utilizationPercentage || 100;
      baseRevenue *= rampUpFactor / 100;
    }
    
    return { total: baseRevenue, byStream: [{ name: 'Primary Revenue', amount: baseRevenue }] };
  }

  private calculateYearCosts(year: number, assumptions: ModelAssumptions, revenue: number): CostBreakdown {
    if (year === 0) {
      return { total: 0, fixed: 0, variable: 0, byCategory: [] };
    }
    
    const { operatingCosts } = assumptions;
    
    let fixedTotal = 0;
    let variableTotal = 0;
    const byCategory: { name: string; amount: number; type: 'fixed' | 'variable' }[] = [];
    
    // Fixed costs with escalation
    operatingCosts.fixedCosts.forEach(cost => {
      if (year >= cost.startYear && (!cost.endYear || year <= cost.endYear)) {
        const escalated = cost.amount * Math.pow(1 + cost.escalation, year - cost.startYear);
        fixedTotal += escalated;
        byCategory.push({ name: cost.name, amount: escalated, type: 'fixed' });
      }
    });
    
    // Variable costs
    operatingCosts.variableCosts.forEach(cost => {
      const escalated = cost.costPerUnit * Math.pow(1 + cost.escalation, year - 1);
      const amount = escalated * (revenue / 1000); // Simplified
      variableTotal += amount;
      byCategory.push({ name: cost.name, amount, type: 'variable' });
    });
    
    // O&M contract
    if (operatingCosts.omContractAmount) {
      const omCost = operatingCosts.omContractAmount * 
                     Math.pow(1 + (operatingCosts.omEscalation || 0), year - 1);
      fixedTotal += omCost;
      byCategory.push({ name: 'O&M Contract', amount: omCost, type: 'fixed' });
    }
    
    return { total: fixedTotal + variableTotal, fixed: fixedTotal, variable: variableTotal, byCategory };
  }

  private calculateDepreciation(year: number, assumptions: ModelAssumptions): number {
    if (year === 0) return 0;
    
    const totalCapex = assumptions.capex.constructionCapex.reduce((sum, c) => sum + c.amount, 0);
    const usefulLife = 20; // Default for infrastructure
    
    return totalCapex / usefulLife;
  }

  private calculateDebtService(
    year: number,
    assumptions: ModelAssumptions,
    structure: ModelInvestmentStructure
  ): { interestExpense: number; debtDrawdown: number; principalRepayment: number } {
    if (!structure.debtAmount || !assumptions.financing.seniorDebt) {
      return { interestExpense: 0, debtDrawdown: 0, principalRepayment: 0 };
    }
    
    const debt = assumptions.financing.seniorDebt;
    const gracePeriod = (debt.gracePeriod || 0) / 12;
    
    if (year === 0) {
      return { interestExpense: 0, debtDrawdown: structure.debtAmount, principalRepayment: 0 };
    }
    
    // Simplified annual debt service calculation
    const tenorYears = debt.tenor / 12;
    const remainingYears = Math.max(0, tenorYears - year);
    const outstandingDebt = structure.debtAmount * (remainingYears / tenorYears);
    
    const interestExpense = outstandingDebt * debt.interestRate;
    
    let principalRepayment = 0;
    if (year > gracePeriod && year <= tenorYears) {
      const amortizingYears = tenorYears - gracePeriod;
      principalRepayment = structure.debtAmount / amortizingYears;
    }
    
    return { interestExpense, debtDrawdown: 0, principalRepayment };
  }

  private calculateTax(taxableIncome: number, year: number, assumptions: ModelAssumptions): number {
    const { tax } = assumptions;
    
    if (tax.taxHoliday) {
      if (year >= tax.taxHoliday.startYear && 
          year < tax.taxHoliday.startYear + tax.taxHoliday.duration) {
        return taxableIncome * tax.corporateIncomeTaxRate * (1 - tax.taxHoliday.exemptionPercentage);
      }
    }
    
    return Math.max(0, taxableIncome) * tax.corporateIncomeTaxRate;
  }

  private calculateYearCapex(year: number, assumptions: ModelAssumptions): number {
    if (year === 0) {
      const constructionTotal = assumptions.capex.constructionCapex.reduce((sum, c) => sum + c.amount, 0);
      const contingency = constructionTotal * assumptions.capex.contingencyPercentage;
      return constructionTotal + contingency + (assumptions.capex.developmentCosts || 0);
    }
    
    const { maintenanceCapex } = assumptions.capex;
    if (maintenanceCapex.type === 'fixed_schedule') {
      return maintenanceCapex.fixedAmount || 0;
    }
    
    return 0;
  }

  private calculateWorkingCapitalChange(year: number, revenue: number, assumptions: ModelAssumptions): number {
    if (year === 0) return 0;
    
    const { workingCapital } = assumptions;
    const receivables = revenue * (workingCapital.receivableDays / 365);
    const payables = revenue * 0.6 * (workingCapital.payableDays / 365);
    
    const netWorkingCapital = receivables - payables;
    
    if (year === 1) {
      return netWorkingCapital;
    }
    
    return 0;
  }

  private calculateTerminalValue(lastProjection: CashFlowProjection, assumptions: ModelAssumptions): number {
    const { terminalValue, discountRate } = assumptions;
    
    switch (terminalValue.method) {
      case 'gordon_growth':
        return calculateGordonGrowthTerminalValue(
          lastProjection.fcff,
          terminalValue.perpetuityGrowthRate || 0.02,
          discountRate
        );
      
      case 'exit_multiple':
        const metric = terminalValue.exitMultipleMetric === 'revenue' 
          ? lastProjection.revenue.total 
          : lastProjection.ebitda;
        return calculateExitMultipleTerminalValue(metric, terminalValue.exitMultiple || 8);
      
      default:
        return 0;
    }
  }

  private summarizeCashFlows(cashFlows: CashFlowProjection[], _assumptions: ModelAssumptions): CashFlowSummary {
    const operatingCashFlows = cashFlows.filter(cf => cf.period > 0);
    
    return {
      totalRevenue: cashFlows.reduce((sum, cf) => sum + cf.revenue.total, 0),
      totalEbitda: cashFlows.reduce((sum, cf) => sum + cf.ebitda, 0),
      averageEbitdaMargin: operatingCashFlows.length > 0
        ? operatingCashFlows.reduce((sum, cf) => sum + cf.ebitdaMargin, 0) / operatingCashFlows.length
        : 0,
      totalCapex: cashFlows.reduce((sum, cf) => sum + cf.capex, 0),
      totalDebtService: cashFlows.reduce((sum, cf) => sum + (cf.debtServicePayment || 0), 0),
      totalDividends: cashFlows.reduce((sum, cf) => sum + (cf.dividends || 0), 0),
      netCashGenerated: cashFlows.reduce((sum, cf) => sum + cf.cashFlow, 0),
      equityCashFlows: cashFlows.map(cf => cf.fcfe),
      projectCashFlows: cashFlows.map(cf => cf.fcff),
      constructionPeriodCosts: cashFlows[0]?.capex || 0,
      operationPeriodCashFlow: operatingCashFlows.reduce((sum, cf) => sum + cf.fcfe, 0),
      terminalValue: 0,
    };
  }

  private calculateModelWACC(assumptions: ModelAssumptions, structure: ModelInvestmentStructure): number {
    const totalCapital = structure.totalInvestmentAmount;
    const equityWeight = (structure.equityAmount || totalCapital) / totalCapital;
    const debtWeight = (structure.debtAmount || 0) / totalCapital;
    
    const costOfEquity = this.calculateModelCostOfEquity(assumptions);
    const costOfDebt = assumptions.financing.seniorDebt?.interestRate || 0.10;
    
    return calculateWACC(costOfEquity, costOfDebt, assumptions.tax.corporateIncomeTaxRate, equityWeight, debtWeight);
  }

  private calculateModelCostOfEquity(assumptions: ModelAssumptions): number {
    return calculateCAPM(
      assumptions.riskFreeRate,
      1.2,
      0.06,
      0.02,
      assumptions.countryRisk?.countryRiskPremium || 0.03
    );
  }

  private calculateDebtMetrics(
    cashFlows: CashFlowProjection[],
    assumptions: ModelAssumptions,
    structure: ModelInvestmentStructure
  ): DebtMetrics {
    const dscrByPeriod: DSCRByPeriod[] = cashFlows
      .filter(cf => cf.period > 0 && cf.dscr !== undefined)
      .map(cf => ({
        period: cf.period,
        dscr: cf.dscr!,
        debtService: cf.debtServicePayment || 0,
        cashAvailable: cf.ebitda - cf.taxExpense - cf.capex,
        breachesMinimum: cf.dscr! < (assumptions.financing.seniorDebt?.minDSCR || 1.2),
      }));
    
    const dscrValues = dscrByPeriod.map(d => d.dscr).filter(d => isFinite(d));
    const minDSCR = dscrValues.length > 0 ? Math.min(...dscrValues) : 0;
    const avgDSCR = dscrValues.length > 0 ? dscrValues.reduce((s, d) => s + d, 0) / dscrValues.length : 0;
    
    const firstYearEbitda = cashFlows[1]?.ebitda || 1;
    
    return {
      dscr: {
        minimum: minDSCR,
        average: avgDSCR,
        byPeriod: dscrByPeriod,
        covenantBreaches: dscrByPeriod
          .filter(d => d.breachesMinimum)
          .map(d => ({
            period: d.period,
            covenant: 'DSCR',
            required: assumptions.financing.seniorDebt?.minDSCR || 1.2,
            actual: d.dscr,
            severity: d.dscr < 1.0 ? 'event_of_default' as const : 'minor' as const,
          })),
      },
      icr: avgDSCR,
      llcr: avgDSCR * 1.1,
      debtToEquity: (structure.debtAmount || 0) / (structure.equityAmount || 1),
      debtToEbitda: (structure.debtAmount || 0) / firstYearEbitda,
      netDebtToEbitda: (structure.debtAmount || 0) / firstYearEbitda,
      maxDebtCapacity: firstYearEbitda * 5,
      debtHeadroom: (firstYearEbitda * 5) - (structure.debtAmount || 0),
      averageDebtLife: (assumptions.financing.seniorDebt?.tenor || 120) / 12 / 2,
      repaymentSchedule: [],
    };
  }

  /**
   * Create scenario
   */
  async createScenario(
    modelId: string,
    scenarioType: ScenarioType,
    overrides: AssumptionOverride[],
    userId: string
  ): Promise<Scenario> {
    const model = await this.getFinancialModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }
    
    const scenarioId = doc(collection(db, MODELS_COLLECTION, modelId, 'scenarios')).id;
    
    // Apply overrides to assumptions
    const scenarioAssumptions = this.applyAssumptionOverrides(model.assumptions, overrides);
    
    // Calculate scenario cash flows and returns
    const { cashFlows, equityReturns, debtMetrics } = this.calculateModelOutputs(
      scenarioAssumptions,
      model.investmentStructure
    );
    
    const scenario: Scenario = {
      id: scenarioId,
      name: scenarioType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: scenarioType,
      description: `${scenarioType} scenario with ${overrides.length} assumption changes`,
      assumptionOverrides: overrides,
      cashFlows,
      returns: equityReturns,
      debtMetrics,
      createdAt: new Date(),
      createdBy: userId,
    };
    
    // Save scenario and update model
    const updatedScenarios = [...(model.scenarios || []), scenario];
    const scenarioComparison = this.calculateScenarioComparison(model.baseCase, updatedScenarios);
    
    await updateDoc(doc(db, MODELS_COLLECTION, modelId), {
      scenarios: updatedScenarios,
      scenarioComparison,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    
    return scenario;
  }

  private applyAssumptionOverrides(
    assumptions: ModelAssumptions,
    overrides: AssumptionOverride[]
  ): ModelAssumptions {
    const modified = JSON.parse(JSON.stringify(assumptions));
    
    overrides.forEach(override => {
      const pathParts = override.path.split('.');
      let target: Record<string, unknown> = modified;
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (target[pathParts[i]] === undefined) return;
        target = target[pathParts[i]] as Record<string, unknown>;
      }
      
      const finalKey = pathParts[pathParts.length - 1];
      target[finalKey] = override.newValue;
    });
    
    return modified;
  }

  private calculateScenarioComparison(baseCase: Scenario, scenarios: Scenario[]): ScenarioComparison {
    return {
      scenarios: scenarios.map(s => ({
        scenarioId: s.id,
        scenarioName: s.name,
        scenarioType: s.type,
        projectIRR: s.returns.projectIRR,
        equityIRR: s.returns.equityIRR,
        npv: s.returns.npv,
        moic: s.returns.moic,
        minDSCR: s.debtMetrics?.dscr.minimum,
        deltaFromBase: {
          irrDelta: s.returns.equityIRR - baseCase.returns.equityIRR,
          npvDelta: s.returns.npv - baseCase.returns.npv,
          moicDelta: s.returns.moic - baseCase.returns.moic,
        },
      })),
    };
  }

  /**
   * Run sensitivity analysis
   */
  async runSensitivityAnalysis(
    modelId: string,
    variables: SensitivityVariable[],
    type: 'one_way' | 'two_way' | 'tornado',
    userId: string
  ): Promise<SensitivityAnalysis> {
    const model = await this.getFinancialModel(modelId);
    if (!model) {
      throw new Error('Model not found');
    }
    
    const analysisId = doc(collection(db, MODELS_COLLECTION, modelId, 'sensitivity')).id;
    
    const results: SensitivityResult[] = [];
    
    if (type === 'tornado') {
      for (const variable of variables) {
        const steps = [variable.minValue, variable.maxValue];
        
        for (const value of steps) {
          const override: AssumptionOverride = {
            path: variable.path,
            originalValue: variable.baseValue,
            newValue: value,
          };
          
          const scenarioAssumptions = this.applyAssumptionOverrides(model.assumptions, [override]);
          const { equityReturns } = this.calculateModelOutputs(scenarioAssumptions, model.investmentStructure);
          
          results.push({
            variableName: variable.name,
            variableValue: value,
            projectIRR: equityReturns.projectIRR,
            equityIRR: equityReturns.equityIRR,
            npv: equityReturns.npv,
            moic: equityReturns.moic,
            irrDelta: equityReturns.equityIRR - (model.outputs.equityIRR || 0),
            npvDelta: equityReturns.npv - model.outputs.npv,
          });
        }
      }
    } else {
      const primaryVariable = variables[0];
      const stepSize = (primaryVariable.maxValue - primaryVariable.minValue) / primaryVariable.steps;
      
      for (let i = 0; i <= primaryVariable.steps; i++) {
        const value = primaryVariable.minValue + (i * stepSize);
        const override: AssumptionOverride = {
          path: primaryVariable.path,
          originalValue: primaryVariable.baseValue,
          newValue: value,
        };
        
        const scenarioAssumptions = this.applyAssumptionOverrides(model.assumptions, [override]);
        const { equityReturns } = this.calculateModelOutputs(scenarioAssumptions, model.investmentStructure);
        
        results.push({
          variableName: primaryVariable.name,
          variableValue: value,
          projectIRR: equityReturns.projectIRR,
          equityIRR: equityReturns.equityIRR,
          npv: equityReturns.npv,
          moic: equityReturns.moic,
          irrDelta: equityReturns.equityIRR - (model.outputs.equityIRR || 0),
          npvDelta: equityReturns.npv - model.outputs.npv,
        });
      }
    }
    
    const tornadoData = type === 'tornado' ? this.buildTornadoData(results, model.outputs.equityIRR || 0) : undefined;
    
    const analysis: SensitivityAnalysis = {
      id: analysisId,
      name: `${type} Analysis - ${variables.map(v => v.name).join(', ')}`,
      type,
      variables,
      results,
      tornadoData,
      createdAt: new Date(),
      createdBy: userId,
    };
    
    const updatedAnalyses = [...(model.sensitivityAnalyses || []), analysis];
    
    await updateDoc(doc(db, MODELS_COLLECTION, modelId), {
      sensitivityAnalyses: updatedAnalyses,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
    
    return analysis;
  }

  private buildTornadoData(results: SensitivityResult[], baseIRR: number): TornadoData {
    const variableMap = new Map<string, { low: SensitivityResult; high: SensitivityResult }>();
    
    results.forEach(r => {
      const existing = variableMap.get(r.variableName);
      if (!existing) {
        variableMap.set(r.variableName, { low: r, high: r });
      } else {
        if (r.variableValue < existing.low.variableValue) existing.low = r;
        if (r.variableValue > existing.high.variableValue) existing.high = r;
      }
    });
    
    const variables: TornadoVariable[] = [];
    
    variableMap.forEach((data, name) => {
      const range = Math.abs(data.high.equityIRR - data.low.equityIRR);
      const inputRange = Math.abs(data.high.variableValue - data.low.variableValue);
      variables.push({
        name,
        lowValue: data.low.variableValue,
        highValue: data.high.variableValue,
        lowResult: data.low.equityIRR,
        highResult: data.high.equityIRR,
        range,
        elasticity: inputRange > 0 ? range / inputRange : 0,
      });
    });
    
    variables.sort((a, b) => b.range - a.range);
    
    return {
      targetMetric: 'irr',
      baseValue: baseIRR,
      variables,
    };
  }
}

// Export singleton instance
let financialModelServiceInstance: FinancialModelService | null = null;

export function getFinancialModelService(): FinancialModelService {
  if (!financialModelServiceInstance) {
    financialModelServiceInstance = new FinancialModelService();
  }
  return financialModelServiceInstance;
}

export const financialModelService = getFinancialModelService();
