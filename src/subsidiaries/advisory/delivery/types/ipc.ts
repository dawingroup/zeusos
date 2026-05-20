/**
 * IPC TYPES
 * 
 * Interim Payment Certificate for contractor-implemented projects.
 */

import { Timestamp } from 'firebase/firestore';
import { Payment, PaymentDeduction } from './payment';

// ─────────────────────────────────────────────────────────────────
// BILL ITEM VALUATION
// ─────────────────────────────────────────────────────────────────

export interface BillItemValuation {
  billItemId: string;
  billReference: string;
  description: string;
  unit: string;
  contractQuantity: number;
  contractRate: number;
  contractAmount: number;
  
  // Cumulative quantities
  previousQuantity: number;
  thisQuantity: number;
  cumulativeQuantity: number;
  
  // Calculated amounts
  previousAmount: number;
  thisAmount: number;
  cumulativeAmount: number;
}

// ─────────────────────────────────────────────────────────────────
// VARIATION ORDER
// ─────────────────────────────────────────────────────────────────

export type VariationOrderType = 'addition' | 'omission';

export interface VariationOrder {
  id: string;
  voNumber: string;
  description: string;
  type: VariationOrderType;
  amount: number;
  approvedAt: Date;
  approvedBy: string;
}

// ─────────────────────────────────────────────────────────────────
// IPC VALUATION
// ─────────────────────────────────────────────────────────────────

export interface IPCValuation {
  // Works breakdown
  billItems: BillItemValuation[];
  
  // Summary amounts
  worksDone: number;
  materialsOnSite: number;
  variationsApproved: number;
  dayworks?: number;
  grossValuation: number;
  
  // Adjustments
  lessRetention: number;
  lessAdvanceRecovery: number;
  lessWithholdingTax: number;
  lessPreviousCertificates: number;
  otherDeductions: number;
  
  // Net
  amountDue: number;
}

// ─────────────────────────────────────────────────────────────────
// IPC ENTITY
// ─────────────────────────────────────────────────────────────────

export interface IPC extends Payment {
  paymentType: 'ipc';
  
  // IPC-specific fields
  ipcNumber: number;
  certificateDate: Date;
  
  // Valuation summary
  valuation: IPCValuation;
  
  // Cumulative tracking
  previousCertified: number;
  thisCertified: number;
  cumulativeCertified: number;
  
  // Contract reference
  contractValue: number;
  percentComplete: number;
  
  // Variation orders included
  variationOrders?: VariationOrder[];
  
  // QS certification
  qsCertifiedBy?: string;
  qsCertifiedAt?: Timestamp;
  qsComments?: string;
}

// ─────────────────────────────────────────────────────────────────
// IPC FORM DATA
// ─────────────────────────────────────────────────────────────────

export interface IPCFormData {
  projectId: string;
  certificateDate: Date;
  periodFrom: Date;
  periodTo: Date;
  billItems: Partial<BillItemValuation>[];
  materialsOnSite?: number;
  variationOrders?: VariationOrder[];
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate valuation from bill items
 */
export function calculateIPCValuation(
  billItems: BillItemValuation[],
  materialsOnSite: number = 0,
  variationsApproved: number = 0,
  previousCertificates: number = 0
): IPCValuation {
  const worksDone = billItems.reduce((sum, item) => sum + item.thisAmount, 0);
  const grossValuation = worksDone + materialsOnSite + variationsApproved;
  
  return {
    billItems,
    worksDone,
    materialsOnSite,
    variationsApproved,
    grossValuation,
    lessRetention: 0,
    lessAdvanceRecovery: 0,
    lessWithholdingTax: 0,
    lessPreviousCertificates: previousCertificates,
    otherDeductions: 0,
    amountDue: grossValuation,
  };
}

/**
 * Calculate retention deduction
 */
export function calculateRetention(
  worksDone: number,
  retentionRate: number,
  maxRetentionPercent: number = 50,
  contractValue: number = 0
): number {
  const retentionAmount = worksDone * (retentionRate / 100);
  
  if (contractValue > 0) {
    const maxRetention = contractValue * (maxRetentionPercent / 100);
    return Math.min(retentionAmount, maxRetention);
  }
  
  return retentionAmount;
}

/**
 * Calculate withholding tax (Uganda: 6% for construction)
 */
export function calculateWithholdingTax(
  worksDone: number,
  rate: number = 6
): number {
  return worksDone * (rate / 100);
}

/**
 * Calculate advance recovery
 */
export function calculateAdvanceRecovery(
  grossValuation: number,
  advancePercentage: number,
  totalAdvance: number,
  recoveredToDate: number
): number {
  const recoveryThisCert = grossValuation * (advancePercentage / 100);
  const remainingToRecover = totalAdvance - recoveredToDate;
  return Math.min(recoveryThisCert, remainingToRecover);
}

/**
 * Build IPC deductions array
 */
export function buildIPCDeductions(
  valuation: IPCValuation,
  retentionRate: number,
  whtRate: number = 6
): PaymentDeduction[] {
  const deductions: PaymentDeduction[] = [];
  
  // Retention
  const retentionAmount = valuation.worksDone * (retentionRate / 100);
  if (retentionAmount > 0) {
    deductions.push({
      id: `ret-${Date.now()}`,
      type: 'retention',
      description: `Retention (${retentionRate}%)`,
      rate: retentionRate,
      amount: retentionAmount,
      isAutomatic: true,
    });
  }
  
  // Withholding tax
  const whtAmount = valuation.worksDone * (whtRate / 100);
  if (whtAmount > 0) {
    deductions.push({
      id: `wht-${Date.now()}`,
      type: 'withholding_tax',
      description: `Withholding Tax (${whtRate}%)`,
      rate: whtRate,
      amount: whtAmount,
      isAutomatic: true,
    });
  }
  
  return deductions;
}

/**
 * Format IPC number
 */
export function formatIPCNumber(ipcNumber: number): string {
  return `IPC ${ipcNumber.toString().padStart(2, '0')}`;
}

/**
 * Get IPC summary text
 */
export function getIPCSummary(ipc: IPC): string {
  return `${formatIPCNumber(ipc.ipcNumber)} - ${ipc.percentComplete.toFixed(1)}% Complete`;
}
