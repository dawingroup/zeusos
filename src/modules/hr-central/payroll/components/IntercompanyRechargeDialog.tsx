/**
 * Intercompany Recharge Dialog
 *
 * Lets HR / Finance generate the period recharge schedule for a
 * monthly run, preview the journal entries it implies, and download
 * the schedule as CSV for posting and the TP file.
 */

import { useEffect, useState } from 'react';
import { Loader2, Download, X, ClipboardCopy } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  getRechargeScheduleForPeriod,
  rechargeScheduleToCsv,
  rechargeJournalEntries,
  type RechargePeriodSchedule,
} from '@/modules/hr-central/payroll/services/intercompany-recharge.service';

interface IntercompanyRechargeDialogProps {
  open: boolean;
  onClose: () => void;
  year: number;
  month: number;
  hostSubsidiaryIds?: string[];
}

function formatUGX(n: number): string {
  return `UGX ${(n || 0).toLocaleString()}`;
}

export function IntercompanyRechargeDialog({
  open,
  onClose,
  year,
  month,
  hostSubsidiaryIds,
}: IntercompanyRechargeDialogProps) {
  const [schedule, setSchedule] = useState<RechargePeriodSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSchedule(null);
    getRechargeScheduleForPeriod(year, month, { hostSubsidiaryIds })
      .then(s => { if (!cancelled) setSchedule(s); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load schedule'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, year, month, hostSubsidiaryIds?.join(',')]);

  if (!open) return null;

  const downloadCsv = () => {
    if (!schedule) return;
    const csv = rechargeScheduleToCsv(schedule);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recharge-schedule-${schedule.period}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyJEs = async () => {
    if (!schedule) return;
    const text = schedule.pairs
      .map(p => rechargeJournalEntries(p, schedule.period))
      .join('\n\n---\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopyHint('Journal entries copied');
      setTimeout(() => setCopyHint(null), 2000);
    } catch {
      setCopyHint('Copy failed — select and copy manually');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Intercompany recharge — {year}-{String(month).padStart(2, '0')}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Host → recipient cost allocations for split employees.
              Treatment: contra-expense at host (Model A).
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--fg-tertiary)] hover:text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Building schedule…
            </div>
          )}
          {error && (
            <div className="rounded bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {schedule && !loading && schedule.pairs.length === 0 && (
            <div className="rounded bg-[var(--bg-sunken)] border border-[var(--border-subtle)] p-4 text-sm text-muted-foreground">
              No split employees found for this period. Nothing to recharge.
            </div>
          )}
          {schedule && schedule.pairs.length > 0 && (
            <>
              <div className="rounded bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900">
                <strong>{schedule.pairs.length}</strong> host→recipient pair{schedule.pairs.length === 1 ? '' : 's'}.
                Grand total to recharge: <strong>{formatUGX(schedule.grandTotal)}</strong>.
              </div>
              {schedule.pairs.map(pair => (
                <div
                  key={`${pair.hostSubsidiaryId}__${pair.recipientSubsidiaryId}`}
                  className="border border-[var(--border-subtle)] rounded-lg overflow-hidden"
                >
                  <div className="bg-[var(--bg-sunken)] px-4 py-3 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {pair.hostSubsidiaryName} → {pair.recipientSubsidiaryName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {pair.lineCount} employee{pair.lineCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <p className="text-base font-semibold text-foreground">
                        {formatUGX(pair.totalRecharge)}
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-card border-b">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Employee</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Alloc%</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Gross</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Empl. NSSF</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Recharge</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pair.lines.map(l => (
                          <tr key={l.employeeId} className="border-t">
                            <td className="px-3 py-1.5">
                              <span className="font-medium">{l.employeeName}</span>
                              <span className="text-[var(--fg-tertiary)] ml-1">({l.employeeNumber})</span>
                            </td>
                            <td className="px-3 py-1.5 text-right">{l.allocationPercent.toFixed(1)}%</td>
                            <td className="px-3 py-1.5 text-right">{l.grossPay.toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right">{l.employerNssf.toLocaleString()}</td>
                            <td className="px-3 py-1.5 text-right font-medium">{l.rechargeAmount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <details className="border-t bg-[var(--bg-sunken)]">
                    <summary className="px-4 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-[var(--bg-sunken)]">
                      Journal entry template
                    </summary>
                    <pre className="px-4 py-3 text-xs font-mono whitespace-pre-wrap text-foreground bg-card">
{rechargeJournalEntries(pair, schedule.period)}
                    </pre>
                  </details>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t bg-[var(--bg-sunken)] flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {copyHint || 'Schedule supports the TP file alongside the intercompany services agreement.'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyJEs}
              disabled={!schedule || schedule.pairs.length === 0}
            >
              <ClipboardCopy className="h-4 w-4 mr-1.5" /> Copy JEs
            </Button>
            <Button
              size="sm"
              onClick={downloadCsv}
              disabled={!schedule || schedule.pairs.length === 0}
            >
              <Download className="h-4 w-4 mr-1.5" /> Download CSV
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
