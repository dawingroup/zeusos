/**
 * Attendance import dialog.
 *
 * Step 1: pick a file. Step 2: parse and preview — show how many rows
 * resolved, what couldn't be matched, and any soft warnings. Step 3:
 * confirm to commit via the matrix upsert (so a re-import for the same
 * day overwrites rather than duplicates).
 */

import { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { parseAttendanceFile, type ParseAttendanceResult, type EmployeeLookup } from '../services/attendanceImport.service';
import type { AttendanceStatus } from '../types/payroll-records.types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: string; // YYYY-MM
  employees: EmployeeLookup[];
  onConfirm: (cells: Array<{ employeeId: string; date: string; status: AttendanceStatus; notes?: string; hoursWorked?: number }>) => Promise<void>;
}

export function AttendanceImportDialog({ open, onOpenChange, period, employees, onConfirm }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<ParseAttendanceResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setResult(null);
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const r = await parseAttendanceFile(file, employees, period);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setParsing(false);
    }
  };

  const handleConfirm = async () => {
    if (!result) return;
    setCommitting(true);
    try {
      await onConfirm(result.rows.map(r => ({
        employeeId: r.employeeId,
        date: r.date,
        status: r.status,
        notes: r.notes,
        hoursWorked: r.hoursWorked,
      })));
      reset();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCommitting(false);
    }
  };

  const close = () => {
    if (committing) return;
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import attendance from spreadsheet</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file with columns for employee (id, number, or full name),
            date, and status. Existing records for the same employee + date will be updated.
          </DialogDescription>
        </DialogHeader>

        {!result && !parsing && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-10 text-center">
            <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-3">
              Drop a file here or click to browse. Accepts <code className="text-xs">.xlsx</code>,
              {' '}<code className="text-xs">.xls</code>, <code className="text-xs">.csv</code>.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <Button onClick={() => inputRef.current?.click()} variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" /> Choose file
            </Button>
            <p className="text-[11px] text-gray-400 mt-3">
              Status values accepted: P / Present, A / Absent, L / Late, LV / Leave,
              {' '}S / Sick, HD / Half Day, PH / Holiday.
            </p>
          </div>
        )}

        {parsing && (
          <div className="py-10 flex items-center justify-center text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Parsing {fileName}…
          </div>
        )}

        {error && (
          <div className="border border-red-200 bg-red-50 text-red-800 rounded p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Import failed</div>
              <div className="text-xs mt-0.5">{error}</div>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-gray-500" />
                <span className="font-medium">{fileName}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">sheet: {result.sourceLabel}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="w-3 h-3 mr-1" /> Choose different file
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="border border-green-200 bg-green-50 rounded p-3">
                <div className="text-2xl font-bold text-green-800">{result.rows.length}</div>
                <div className="text-xs text-green-700">rows resolved</div>
              </div>
              <div className={`border rounded p-3 ${result.unmatchedEmployees.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${result.unmatchedEmployees.length > 0 ? 'text-amber-800' : 'text-gray-700'}`}>
                  {result.unmatchedEmployees.length}
                </div>
                <div className={`text-xs ${result.unmatchedEmployees.length > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                  unmatched employees
                </div>
              </div>
              <div className={`border rounded p-3 ${result.invalidRows.length > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className={`text-2xl font-bold ${result.invalidRows.length > 0 ? 'text-red-800' : 'text-gray-700'}`}>
                  {result.invalidRows.length}
                </div>
                <div className={`text-xs ${result.invalidRows.length > 0 ? 'text-red-700' : 'text-gray-500'}`}>
                  invalid rows
                </div>
              </div>
            </div>

            {(result.unmatchedEmployees.length > 0 || result.invalidRows.length > 0 || result.warnings.length > 0) && (
              <div className="border border-gray-200 rounded max-h-40 overflow-auto text-xs">
                {result.invalidRows.map((r, i) => (
                  <div key={`inv-${i}`} className="px-3 py-1.5 border-b border-gray-100 flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-500 font-mono">row {r.sourceRow}:</span>
                    <span className="text-red-700">{r.reason}</span>
                  </div>
                ))}
                {result.unmatchedEmployees.map((r, i) => (
                  <div key={`unm-${i}`} className="px-3 py-1.5 border-b border-gray-100 flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-500 font-mono">row {r.sourceRow}:</span>
                    <span className="text-amber-700">No employee found for "{r.identifier}"</span>
                  </div>
                ))}
                {result.warnings.map((r, i) => (
                  <div key={`wrn-${i}`} className="px-3 py-1.5 border-b border-gray-100 flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-500 font-mono">row {r.sourceRow}:</span>
                    <span className="text-gray-600">{r.message}</span>
                  </div>
                ))}
              </div>
            )}

            {result.rows.length > 0 && (
              <div className="border border-gray-200 rounded max-h-48 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-700">Employee</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-700">Date</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-700">Status</th>
                      <th className="px-2 py-1.5 text-right font-medium text-gray-700">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1">{r.employeeName}</td>
                        <td className="px-2 py-1 font-mono">{r.date}</td>
                        <td className="px-2 py-1 capitalize">{r.status.replace('_', ' ')}</td>
                        <td className="px-2 py-1 text-right font-mono">{r.hoursWorked ?? '—'}</td>
                      </tr>
                    ))}
                    {result.rows.length > 50 && (
                      <tr><td colSpan={4} className="px-2 py-1.5 text-center text-gray-500 italic">+{result.rows.length - 50} more rows…</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {result.rows.length > 0 && result.unmatchedEmployees.length === 0 && result.invalidRows.length === 0 && (
              <div className="flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle2 className="w-3.5 h-3.5" /> Looks clean — ready to import.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={committing}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!result || result.rows.length === 0 || committing}
          >
            {committing ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : null}
            Import {result?.rows.length ? `${result.rows.length} rows` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AttendanceImportDialog;
