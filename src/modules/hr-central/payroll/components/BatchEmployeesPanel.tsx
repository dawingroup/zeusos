/**
 * BatchEmployeesPanel
 *
 * Per-employee payslip table for a payroll batch. Replaces the "Employee
 * list will be loaded here…" stub on PayrollBatchDetail. Read-only;
 * downloading individual payslips is handled by the existing payroll
 * PDF service hooked at the page level (next iteration).
 *
 * Allocation-aware: when `batchSubsidiaryId` is provided, each row's
 * monetary columns are scaled by that employee's snapshotted
 * allocation factor for this subsidiary. The host sub-batch sees full
 * statutory deductions; recipient sub-batches see 0 statutory and a
 * cost-share view of gross/net (per Model A — see PAYROLL-ALLOCATIONS.md).
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, Users } from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Input } from '@/core/components/ui/input';
import type { EmployeePayroll } from '../types/payroll.types';
import { formatCurrency } from '../utils/tax-calculator';
import { getEmployeeSubsidiaryAllocation, isHostSubsidiary } from '../services/payroll-batch.service';

interface Props {
  payrolls: EmployeePayroll[];
  /** When set, columns are scaled by each employee's allocation share
   *  for this subsidiary. Statutory items only display on the host
   *  sub-batch. Omit for non-batch contexts (e.g. ad-hoc payroll page). */
  batchSubsidiaryId?: string;
}

interface ScaledRow {
  payroll: EmployeePayroll;
  factor: number;          // 0..1
  isHost: boolean;
  grossPay: number;
  payeNet: number;         // 0 for recipients
  nssfEmployee: number;    // 0 for recipients
  lst: number;             // 0 for recipients
  voluntaryDeductions: number;
  totalDeductions: number;
  netPay: number;
}

export function BatchEmployeesPanel({ payrolls, batchSubsidiaryId }: Props) {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const rows: ScaledRow[] = useMemo(() => {
    return payrolls.map(p => {
      // When no subsidiary context, show full amounts (legacy / ad-hoc).
      if (!batchSubsidiaryId) {
        return {
          payroll: p,
          factor: 1,
          isHost: true,
          grossPay: p.grossPay,
          payeNet: p.payeBreakdown?.netPAYE ?? 0,
          nssfEmployee: p.nssfBreakdown?.employeeContribution ?? 0,
          lst: p.lstBreakdown?.monthlyLST ?? 0,
          voluntaryDeductions: p.totalVoluntaryDeductions,
          totalDeductions: p.totalDeductions,
          netPay: p.netPay,
        };
      }
      const factor = getEmployeeSubsidiaryAllocation(p, batchSubsidiaryId);
      const isHost = isHostSubsidiary(p, batchSubsidiaryId);
      const payeNet = isHost ? (p.payeBreakdown?.netPAYE ?? 0) : 0;
      const nssfEmployee = isHost ? (p.nssfBreakdown?.employeeContribution ?? 0) : 0;
      const lst = isHost ? (p.lstBreakdown?.monthlyLST ?? 0) : 0;
      const voluntaryDeductions = (p.totalVoluntaryDeductions || 0) * factor;
      const totalDeductions = isHost
        ? p.totalDeductions
        : voluntaryDeductions;
      return {
        payroll: p,
        factor,
        isHost,
        grossPay: p.grossPay * factor,
        payeNet,
        nssfEmployee,
        lst,
        voluntaryDeductions,
        totalDeductions,
        netPay: p.netPay * factor,
      };
    });
  }, [payrolls, batchSubsidiaryId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      r.payroll.employeeName.toLowerCase().includes(q) ||
      r.payroll.employeeNumber.toLowerCase().includes(q) ||
      (r.payroll.departmentName || '').toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    gross: filtered.reduce((s, r) => s + r.grossPay, 0),
    deductions: filtered.reduce((s, r) => s + r.totalDeductions, 0),
    net: filtered.reduce((s, r) => s + r.netPay, 0),
  }), [filtered]);

  const hasSplitRows = rows.some(r => r.factor < 1);

  if (payrolls.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-gray-500">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          No payslips have been calculated for this batch yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Employees in this batch</h2>
            <p className="text-xs text-gray-500">
              {filtered.length} of {payrolls.length} {payrolls.length === 1 ? 'payslip' : 'payslips'} ·
              {' '}Net {formatCurrency(totals.net)}
              {batchSubsidiaryId && hasSplitRows && (
                <> · <span className="text-amber-700">split employees scaled to this subsidiary's share</span></>
              )}
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, number, department"
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left w-8"></th>
                <th className="px-4 py-2 text-left">Employee</th>
                <th className="px-4 py-2 text-left">Department</th>
                <th className="px-4 py-2 text-right">Gross</th>
                <th className="px-4 py-2 text-right">PAYE</th>
                <th className="px-4 py-2 text-right">NSSF</th>
                <th className="px-4 py-2 text-right">Deductions</th>
                <th className="px-4 py-2 text-right">Net pay</th>
                <th className="px-4 py-2 text-left">Pay via</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const p = r.payroll;
                const isOpen = expandedId === p.id;
                const showSplitChip = !!batchSubsidiaryId && r.factor < 1;
                return (
                  <>
                    <tr
                      key={p.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(isOpen ? null : p.id)}
                    >
                      <td className="px-4 py-2 text-gray-400">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-900 flex items-center gap-1.5">
                          {p.employeeName}
                          {showSplitChip && (
                            <span
                              className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                r.isHost
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                              title={r.isHost
                                ? 'Host subsidiary — runs full payroll & statutory filings'
                                : 'Recipient — cost-share allocated from host'}
                            >
                              {r.isHost ? 'host' : 'recipient'} {(r.factor * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400 font-mono">{p.employeeNumber}</div>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{p.departmentName || '—'}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(r.grossPay)}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-700">{formatCurrency(r.payeNet)}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-700">{formatCurrency(r.nssfEmployee)}</td>
                      <td className="px-4 py-2 text-right font-mono text-red-700">{formatCurrency(r.totalDeductions)}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">{formatCurrency(r.netPay)}</td>
                      <td className="px-4 py-2 text-xs text-gray-600 capitalize">
                        {p.paymentMethod.replace('_', ' ')}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${p.id}-detail`} className="bg-gray-50 border-b border-gray-100">
                        <td></td>
                        <td colSpan={8} className="px-4 py-3">
                          {showSplitChip && !r.isHost && (
                            <div className="mb-3 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                              Recipient view — figures show this subsidiary's <strong>{(r.factor * 100).toFixed(0)}%</strong>
                              {' '}cost share. Statutory items (PAYE / NSSF / LST) are filed by the host subsidiary
                              and shown as 0 here. See the full payslip for the host figures.
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-6 text-xs">
                            <div>
                              <div className="font-medium text-gray-700 mb-1.5">
                                Earnings{showSplitChip ? ` (× ${(r.factor * 100).toFixed(0)}%)` : ''}
                              </div>
                              <div className="space-y-0.5">
                                <Row label="Basic salary" value={p.basicSalary * r.factor} />
                                {p.earnings?.map((e, i) => (
                                  <Row key={i} label={e.description} value={e.amount * r.factor} />
                                ))}
                                <Row label="Total earnings" value={p.totalEarnings * r.factor} bold />
                              </div>
                            </div>
                            <div>
                              <div className="font-medium text-gray-700 mb-1.5">Deductions</div>
                              <div className="space-y-0.5">
                                <Row label="PAYE" value={r.payeNet} negative />
                                <Row label="NSSF (employee)" value={r.nssfEmployee} negative />
                                <Row label="LST" value={r.lst} negative />
                                {p.deductions?.filter(d => !['paye', 'nssf_employee', 'lst'].includes(d.type)).map((d, i) => (
                                  <Row key={i} label={d.description} value={d.amount * r.factor} negative />
                                ))}
                                <Row label="Total deductions" value={r.totalDeductions} bold negative />
                              </div>
                              <div className="mt-2 pt-2 border-t border-gray-200">
                                <Row label="Net pay" value={r.netPay} bold large />
                              </div>
                            </div>
                          </div>
                          {(p.bankDetails || p.mobileMoneyDetails) && (
                            <div className="mt-3 pt-2 border-t border-gray-200 text-[11px] text-gray-600">
                              {p.bankDetails && (
                                <>
                                  <span className="font-medium">Bank:</span> {p.bankDetails.bankName} · {p.bankDetails.accountNumber}
                                </>
                              )}
                              {p.mobileMoneyDetails && (
                                <>
                                  <span className="font-medium">Mobile money:</span> {p.mobileMoneyDetails.provider.toUpperCase()} {p.mobileMoneyDetails.phoneNumber}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200 text-xs">
              <tr>
                <td colSpan={3} className="px-4 py-2 font-medium text-gray-700">Totals ({filtered.length})</td>
                <td className="px-4 py-2 text-right font-mono">{formatCurrency(totals.gross)}</td>
                <td colSpan={2}></td>
                <td className="px-4 py-2 text-right font-mono text-red-700">{formatCurrency(totals.deductions)}</td>
                <td className="px-4 py-2 text-right font-mono font-semibold">{formatCurrency(totals.net)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, bold, large, negative }: { label: string; value: number; bold?: boolean; large?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between ${large ? 'text-sm' : ''}`}>
      <span className={`${bold ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{label}</span>
      <span className={`font-mono ${bold ? 'font-semibold' : ''} ${negative ? 'text-red-700' : 'text-gray-900'}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export default BatchEmployeesPanel;
