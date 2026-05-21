/**
 * Inter-company Recharge Service
 * ZeusOS HR Central - Payroll Module
 *
 * Produces the period schedule used by Finance to post inter-company
 * salary recharges under the Model A host-employer arrangement.
 *
 * For each employee split across multiple subsidiaries, the host
 * subsidiary (payroll.subsidiaryId, where statutory filings happen)
 * recharges each non-host subsidiary for its allocated share of the
 * employer's economic cost:
 *
 *     recharge = allocationPercent% × (grossPay + employerNSSF)
 *
 * The schedule groups line items by (host → recipient) so each pair
 * generates one journal entry per period. Treatment is contra-expense
 * at the host (NOT revenue), which matches IAS 1 §33 substance for
 * pure cost-sharing arrangements and avoids inflating either side's
 * revenue line.
 *
 * Below the URA 25 bn TP documentation threshold this schedule, the
 * methodology doc, and the signed intercompany services agreement
 * are the supporting file for transfer-pricing defence.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';
import type { EmployeePayroll } from '../types/payroll.types';

const PAYROLL_COLLECTION = 'payroll';
const SUBSIDIARY_COLLECTION = 'subsidiaries';

export interface RechargeLineItem {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  allocationPercent: number;        // recipient's share, 0–100
  grossPay: number;                 // full pay (host-side)
  employerNssf: number;             // full employer NSSF (host-side)
  rechargeableCost: number;         // grossPay + employerNssf
  rechargeAmount: number;           // rechargeableCost × allocationPercent / 100
}

export interface RechargePairSchedule {
  hostSubsidiaryId: string;
  hostSubsidiaryName: string;
  recipientSubsidiaryId: string;
  recipientSubsidiaryName: string;
  totalRecharge: number;
  lineCount: number;
  lines: RechargeLineItem[];
}

export interface RechargePeriodSchedule {
  year: number;
  month: number;
  period: string;                   // YYYY-MM
  generatedAt: Date;
  pairs: RechargePairSchedule[];
  grandTotal: number;
}

/**
 * Compute the recharge schedule for a period across all payrolls.
 * Optionally restrict to a single host (when generating from a
 * specific monthly run, pass the run's subsidiary set).
 */
export async function getRechargeScheduleForPeriod(
  year: number,
  month: number,
  options?: { hostSubsidiaryIds?: string[] },
): Promise<RechargePeriodSchedule> {
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const q = query(
    collection(db, PAYROLL_COLLECTION),
    where('year', '==', year),
    where('month', '==', month),
  );
  const snap = await getDocs(q);
  const payrolls = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as EmployeePayroll))
    .filter(p => {
      if (!options?.hostSubsidiaryIds?.length) return true;
      return options.hostSubsidiaryIds.includes(p.subsidiaryId);
    });

  // Bucket lines by (host, recipient) pair
  const pairKey = (h: string, r: string) => `${h}__${r}`;
  const pairs = new Map<string, RechargePairSchedule>();
  const subsidiaryNames = new Map<string, string>();

  const resolveName = async (id: string): Promise<string> => {
    if (subsidiaryNames.has(id)) return subsidiaryNames.get(id) as string;
    try {
      const sSnap = await getDoc(doc(db, SUBSIDIARY_COLLECTION, id));
      const name = (sSnap.data()?.name as string) || id;
      subsidiaryNames.set(id, name);
      return name;
    } catch {
      subsidiaryNames.set(id, id);
      return id;
    }
  };

  for (const p of payrolls) {
    const allocs = p.subsidiaryAllocations;
    if (!allocs || allocs.length === 0) continue;          // no split — no recharge
    const host = p.subsidiaryId;
    const grossPay = Number(p.grossPay) || 0;
    const employerNssf = Number(p.nssfBreakdown?.employerContribution) || 0;
    const rechargeableCost = grossPay + employerNssf;

    for (const a of allocs) {
      if (a.subsidiaryId === host) continue;               // host's own share isn't recharged
      const pct = Math.max(0, Math.min(100, Number(a.allocationPercent) || 0));
      if (pct === 0) continue;
      const rechargeAmount = Math.round(rechargeableCost * pct / 100);

      const key = pairKey(host, a.subsidiaryId);
      let bucket = pairs.get(key);
      if (!bucket) {
        bucket = {
          hostSubsidiaryId: host,
          hostSubsidiaryName: await resolveName(host),
          recipientSubsidiaryId: a.subsidiaryId,
          recipientSubsidiaryName: await resolveName(a.subsidiaryId),
          totalRecharge: 0,
          lineCount: 0,
          lines: [],
        };
        pairs.set(key, bucket);
      }

      bucket.lines.push({
        employeeId: p.employeeId,
        employeeNumber: p.employeeNumber,
        employeeName: p.employeeName,
        allocationPercent: pct,
        grossPay,
        employerNssf,
        rechargeableCost,
        rechargeAmount,
      });
      bucket.totalRecharge += rechargeAmount;
      bucket.lineCount += 1;
    }
  }

  const pairList = Array.from(pairs.values()).sort((a, b) =>
    a.hostSubsidiaryName.localeCompare(b.hostSubsidiaryName) ||
    a.recipientSubsidiaryName.localeCompare(b.recipientSubsidiaryName),
  );
  // Sort lines within each pair for readability
  for (const p of pairList) {
    p.lines.sort((x, y) => x.employeeName.localeCompare(y.employeeName));
  }

  return {
    year,
    month,
    period,
    generatedAt: new Date(),
    pairs: pairList,
    grandTotal: pairList.reduce((acc, p) => acc + p.totalRecharge, 0),
  };
}

/**
 * Render the schedule as CSV — one row per employee line item, with a
 * trailing total row per pair. Easy for Finance to drop into Excel
 * before posting JEs.
 */
export function rechargeScheduleToCsv(schedule: RechargePeriodSchedule): string {
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: string[] = [];
  rows.push([
    'Period',
    'Host subsidiary',
    'Recipient subsidiary',
    'Employee number',
    'Employee name',
    'Allocation %',
    'Gross pay',
    'Employer NSSF',
    'Rechargeable cost',
    'Recharge amount',
  ].map(esc).join(','));

  for (const pair of schedule.pairs) {
    for (const line of pair.lines) {
      rows.push([
        schedule.period,
        pair.hostSubsidiaryName,
        pair.recipientSubsidiaryName,
        line.employeeNumber,
        line.employeeName,
        line.allocationPercent.toFixed(2),
        line.grossPay,
        line.employerNssf,
        line.rechargeableCost,
        line.rechargeAmount,
      ].map(esc).join(','));
    }
    rows.push([
      schedule.period,
      pair.hostSubsidiaryName,
      pair.recipientSubsidiaryName,
      '',
      `TOTAL (${pair.lineCount} employees)`,
      '',
      '',
      '',
      '',
      pair.totalRecharge,
    ].map(esc).join(','));
  }

  return rows.join('\n');
}

/**
 * Render the JE template for one (host → recipient) pair. Treatment 2
 * (contra-expense at host) per IAS 1 §33; matches the methodology
 * doc and the intercompany services agreement.
 */
export function rechargeJournalEntries(pair: RechargePairSchedule, period: string): string {
  const fmt = (n: number) => n.toLocaleString();
  return [
    `Period: ${period}`,
    `From host:    ${pair.hostSubsidiaryName} (${pair.hostSubsidiaryId})`,
    `To recipient: ${pair.recipientSubsidiaryName} (${pair.recipientSubsidiaryId})`,
    `Recharge amount: UGX ${fmt(pair.totalRecharge)}`,
    `Headcount:       ${pair.lineCount}`,
    '',
    `Host entries (${pair.hostSubsidiaryName}):`,
    `  DR  Intercompany receivable (${pair.recipientSubsidiaryName})  ${fmt(pair.totalRecharge)}`,
    `  CR  Salary expense (recovery)                                  ${fmt(pair.totalRecharge)}`,
    '',
    `Recipient entries (${pair.recipientSubsidiaryName}):`,
    `  DR  Salary expense (allocated from ${pair.hostSubsidiaryName}) ${fmt(pair.totalRecharge)}`,
    `  CR  Intercompany payable (${pair.hostSubsidiaryName})          ${fmt(pair.totalRecharge)}`,
  ].join('\n');
}
