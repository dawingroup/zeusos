// ============================================================================
// FACILITY SERVICE
// DawinOS v2.0 — Active capital facility management & repayment tracking
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  CapitalFacility,
  CapitalFacilityFilters,
  RepaymentEntry,
  FacilityTerms,
} from '../types/capital.types';
import type { CapitalFacilityInput } from '../schemas/capital.schemas';
import { CAPITAL_FACILITIES_COLLECTION } from '../constants/capital.constants';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string) {
  return collection(db, 'companies', companyId, CAPITAL_FACILITIES_COLLECTION);
}

function companyDoc(companyId: string, docId: string) {
  return doc(db, 'companies', companyId, CAPITAL_FACILITIES_COLLECTION, docId);
}

// ────────────────────────────────────────────────────────────────────────────
// AMORTIZATION CALCULATOR
// ────────────────────────────────────────────────────────────────────────────

export function generateAmortizationSchedule(
  principal: number,
  terms: FacilityTerms,
  startDate: Date,
): RepaymentEntry[] {
  const schedule: RepaymentEntry[] = [];
  const annualRate = terms.interestRate / 100;
  const gracePeriod = terms.gracePeriodMonths || 0;

  // Determine number of payments
  let periodsPerYear: number;
  let monthsPerPeriod: number;
  switch (terms.repaymentFrequency) {
    case 'monthly': periodsPerYear = 12; monthsPerPeriod = 1; break;
    case 'quarterly': periodsPerYear = 4; monthsPerPeriod = 3; break;
    case 'semi_annually': periodsPerYear = 2; monthsPerPeriod = 6; break;
    case 'annually': periodsPerYear = 1; monthsPerPeriod = 12; break;
    case 'bullet':
      // Single payment at maturity
      const maturityDate = new Date(startDate);
      maturityDate.setMonth(maturityDate.getMonth() + terms.tenorMonths);
      const totalInterest = principal * annualRate * (terms.tenorMonths / 12);
      schedule.push({
        id: 'repay-1',
        date: Timestamp.fromDate(maturityDate),
        principalDue: principal,
        interestDue: Math.round(totalInterest),
        totalDue: Math.round(principal + totalInterest),
        status: 'upcoming',
      });
      return schedule;
    default: periodsPerYear = 12; monthsPerPeriod = 1;
  }

  const totalPeriods = Math.ceil((terms.tenorMonths - gracePeriod) / monthsPerPeriod);
  const periodicRate = annualRate / periodsPerYear;

  let balance = principal;

  // Grace period — interest only
  for (let g = 0; g < gracePeriod; g += monthsPerPeriod) {
    const paymentDate = new Date(startDate);
    paymentDate.setMonth(paymentDate.getMonth() + g + monthsPerPeriod);
    const interest = Math.round(balance * periodicRate);

    schedule.push({
      id: `repay-grace-${g + 1}`,
      date: Timestamp.fromDate(paymentDate),
      principalDue: 0,
      interestDue: interest,
      totalDue: interest,
      status: 'upcoming',
    });
  }

  if (terms.interestType === 'reducing_balance' && totalPeriods > 0) {
    // Reducing balance — equal installments (EMI)
    const emi = periodicRate > 0
      ? principal * periodicRate * Math.pow(1 + periodicRate, totalPeriods) /
        (Math.pow(1 + periodicRate, totalPeriods) - 1)
      : principal / totalPeriods;

    for (let i = 0; i < totalPeriods; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + gracePeriod + (i + 1) * monthsPerPeriod);

      const interest = Math.round(balance * periodicRate);
      const principalPart = Math.round(emi - interest);
      balance = Math.max(0, balance - principalPart);

      schedule.push({
        id: `repay-${i + 1}`,
        date: Timestamp.fromDate(paymentDate),
        principalDue: principalPart,
        interestDue: interest,
        totalDue: Math.round(emi),
        status: 'upcoming',
      });
    }
  } else if (totalPeriods > 0) {
    // Fixed rate — equal principal + declining interest (or flat interest)
    const principalPerPeriod = Math.round(principal / totalPeriods);

    for (let i = 0; i < totalPeriods; i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + gracePeriod + (i + 1) * monthsPerPeriod);

      const interest = terms.interestType === 'fixed'
        ? Math.round(principal * periodicRate) // Flat on original
        : Math.round(balance * periodicRate);   // Variable on balance

      const principalPart = i < totalPeriods - 1 ? principalPerPeriod : Math.round(balance);
      balance = Math.max(0, balance - principalPart);

      schedule.push({
        id: `repay-${i + 1}`,
        date: Timestamp.fromDate(paymentDate),
        principalDue: principalPart,
        interestDue: interest,
        totalDue: principalPart + interest,
        status: 'upcoming',
      });
    }
  }

  return schedule;
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class FacilityService {

  // ══════════════════════════════════════════════════════════════════════════
  // CRUD
  // ══════════════════════════════════════════════════════════════════════════

  async createFacility(
    companyId: string,
    input: CapitalFacilityInput,
    startDate: Date,
    maturityDate: Date,
  ): Promise<CapitalFacility> {
    const repaymentSchedule = generateAmortizationSchedule(
      input.amountDisbursed || input.facilityLimit,
      input.terms,
      startDate,
    );

    const nextPayment = repaymentSchedule.find(r => r.status === 'upcoming');

    const data = {
      ...input,
      companyId,
      amountRepaid: 0,
      outstandingBalance: input.amountDisbursed || input.facilityLimit,
      currentUtilization: input.isRevolving ? input.amountDisbursed : undefined,
      availableBalance: input.isRevolving
        ? input.facilityLimit - (input.amountDisbursed || 0)
        : undefined,
      repaymentSchedule,
      nextPaymentDate: nextPayment?.date,
      nextPaymentAmount: nextPayment?.totalDue,
      startDate: Timestamp.fromDate(startDate),
      maturityDate: Timestamp.fromDate(maturityDate),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(companyCol(companyId), data);
    return { id: docRef.id, ...data } as CapitalFacility;
  }

  async getFacility(
    companyId: string,
    facilityId: string,
  ): Promise<CapitalFacility | null> {
    const docSnap = await getDoc(companyDoc(companyId, facilityId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as CapitalFacility;
  }

  async getFacilities(
    companyId: string,
    filters: CapitalFacilityFilters = {},
  ): Promise<CapitalFacility[]> {
    let q = query(companyCol(companyId), orderBy('createdAt', 'desc'));

    if (filters.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters.productType) {
      q = query(q, where('productType', '==', filters.productType));
    }

    const snapshot = await getDocs(q);
    let items = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CapitalFacility));

    if (filters.provider) {
      items = items.filter(i =>
        i.provider.toLowerCase().includes(filters.provider!.toLowerCase()),
      );
    }
    if (filters.isRevolving !== undefined) {
      items = items.filter(i => i.isRevolving === filters.isRevolving);
    }

    return items;
  }

  async updateFacility(
    companyId: string,
    facilityId: string,
    updates: Partial<CapitalFacilityInput>,
  ): Promise<void> {
    await updateDoc(companyDoc(companyId, facilityId), {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  async deleteFacility(companyId: string, facilityId: string): Promise<void> {
    await deleteDoc(companyDoc(companyId, facilityId));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // REPAYMENT TRACKING
  // ══════════════════════════════════════════════════════════════════════════

  async recordRepayment(
    companyId: string,
    facilityId: string,
    repaymentId: string,
    amountPaid: number,
  ): Promise<void> {
    const facility = await this.getFacility(companyId, facilityId);
    if (!facility) throw new Error('Facility not found');

    const schedule = facility.repaymentSchedule.map(r => {
      if (r.id === repaymentId) {
        const status = amountPaid >= r.totalDue ? 'paid' : 'partial';
        return { ...r, amountPaid, paidDate: Timestamp.now(), status } as RepaymentEntry;
      }
      return r;
    });

    const totalRepaid = schedule.reduce((s, r) => s + (r.amountPaid || 0), 0);
    const outstandingBalance = Math.max(0, facility.amountDisbursed - totalRepaid);

    const nextPayment = schedule.find(
      r => r.status === 'upcoming' || r.status === 'overdue',
    );

    const updates: Record<string, unknown> = {
      repaymentSchedule: schedule,
      amountRepaid: totalRepaid,
      outstandingBalance,
      nextPaymentDate: nextPayment?.date,
      nextPaymentAmount: nextPayment?.totalDue,
      updatedAt: Timestamp.now(),
    };

    if (outstandingBalance <= 0) {
      updates.status = 'fully_repaid';
    }

    if (facility.isRevolving) {
      updates.currentUtilization = outstandingBalance;
      updates.availableBalance = facility.facilityLimit - outstandingBalance;
    }

    await updateDoc(companyDoc(companyId, facilityId), updates);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FACILITY ANALYTICS
  // ══════════════════════════════════════════════════════════════════════════

  async getFacilitySummary(companyId: string) {
    const facilities = await this.getFacilities(companyId);
    const active = facilities.filter(f => f.status === 'active');

    return {
      totalFacilities: facilities.length,
      activeFacilities: active.length,
      totalFacilityLimit: active.reduce((s, f) => s + f.facilityLimit, 0),
      totalOutstanding: active.reduce((s, f) => s + f.outstandingBalance, 0),
      totalAvailable: active
        .filter(f => f.isRevolving)
        .reduce((s, f) => s + (f.availableBalance || 0), 0),
      upcomingRepayments: active
        .flatMap(f =>
          f.repaymentSchedule
            .filter(r => r.status === 'upcoming' || r.status === 'overdue')
            .slice(0, 3)
            .map(r => ({ ...r, facilityName: f.facilityName, provider: f.provider })),
        )
        .sort((a, b) => {
          const aDate = a.date instanceof Timestamp ? a.date.toMillis() : 0;
          const bDate = b.date instanceof Timestamp ? b.date.toMillis() : 0;
          return aDate - bDate;
        })
        .slice(0, 10),
    };
  }
}

export const facilityService = new FacilityService();
