/**
 * Attendance Matrix
 *
 * Rows = employees, columns = days of the selected month. Each cell holds
 * a status (present / absent / leave / sick / half-day / holiday). Click
 * a cell to open the status picker; click a column header to bulk-set
 * the whole day. Saved records come from the `records` prop; in-flight
 * edits live in local `dirty` state and only commit when the user hits
 * Save (we batch-write the diff, not the whole grid).
 */

import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Save, RotateCcw, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/core/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import type { AttendanceRecord, AttendanceStatus } from '../types/payroll-records.types';

export interface MatrixCellChange {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
}

interface Props {
  period: string; // YYYY-MM
  employees: Array<{ id: string; fullName: string; employeeNumber?: string }>;
  records: AttendanceRecord[];
  loading?: boolean;
  saving?: boolean;
  onSave: (changes: MatrixCellChange[]) => Promise<void>;
}

// Editable statuses (weekend is auto-derived; not user-selectable per cell).
const PICKABLE_STATUSES: AttendanceStatus[] = [
  'present', 'absent', 'late', 'half_day', 'leave', 'sick', 'holiday',
];

const STATUS_META: Record<AttendanceStatus, { letter: string; label: string; bg: string; text: string }> = {
  present:  { letter: 'P',  label: 'Present',   bg: 'bg-green-100',  text: 'text-green-800' },
  absent:   { letter: 'A',  label: 'Absent',    bg: 'bg-red-100',    text: 'text-red-800' },
  late:     { letter: 'L',  label: 'Late',      bg: 'bg-yellow-100', text: 'text-yellow-800' },
  half_day: { letter: 'H',  label: 'Half Day',  bg: 'bg-orange-100', text: 'text-orange-800' },
  leave:    { letter: 'LV', label: 'Leave',     bg: 'bg-blue-100',   text: 'text-blue-800' },
  sick:     { letter: 'S',  label: 'Sick',      bg: 'bg-pink-100',   text: 'text-pink-800' },
  holiday:  { letter: 'PH', label: 'Holiday',   bg: 'bg-purple-100', text: 'text-purple-800' },
  weekend:  { letter: '·',  label: 'Weekend',   bg: 'bg-gray-100',   text: 'text-gray-400' },
};

function cellKey(employeeId: string, date: string): string {
  return `${employeeId}|${date}`;
}

function buildMonthDays(period: string): Array<{ date: string; day: number; weekday: number; isWeekend: boolean }> {
  const [yStr, mStr] = period.split('-');
  const year = Number(yStr);
  const month = Number(mStr); // 1-based
  const totalDays = new Date(year, month, 0).getDate();
  const out = [];
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, month - 1, day);
    const weekday = d.getDay(); // 0 = Sunday
    out.push({
      date: `${yStr}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      day,
      weekday,
      isWeekend: weekday === 0 || weekday === 6,
    });
  }
  return out;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function AttendanceMatrix({
  period,
  employees,
  records,
  loading,
  saving,
  onSave,
}: Props) {
  const days = useMemo(() => buildMonthDays(period), [period]);

  const savedByKey = useMemo(() => {
    const m = new Map<string, AttendanceStatus>();
    for (const r of records) m.set(cellKey(r.employeeId, r.date), r.status);
    return m;
  }, [records]);

  const [dirty, setDirty] = useState<Map<string, AttendanceStatus>>(new Map());

  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    [employees],
  );

  const setCell = (employeeId: string, date: string, status: AttendanceStatus) => {
    setDirty(prev => {
      const next = new Map(prev);
      const k = cellKey(employeeId, date);
      // If we're "setting back" to the saved value, drop the dirty entry.
      if (savedByKey.get(k) === status) {
        next.delete(k);
      } else {
        next.set(k, status);
      }
      return next;
    });
  };

  /** Apply a status to every cell in a single day for all employees. */
  const setColumnAll = (date: string, status: AttendanceStatus) => {
    setDirty(prev => {
      const next = new Map(prev);
      for (const emp of sortedEmployees) {
        const k = cellKey(emp.id, date);
        if (savedByKey.get(k) === status) {
          next.delete(k);
        } else {
          next.set(k, status);
        }
      }
      return next;
    });
  };

  /** Apply a status to every cell in a row (working days only). */
  const setRowAll = (employeeId: string, status: AttendanceStatus) => {
    setDirty(prev => {
      const next = new Map(prev);
      for (const day of days) {
        if (day.isWeekend) continue;
        const k = cellKey(employeeId, day.date);
        if (savedByKey.get(k) === status) {
          next.delete(k);
        } else {
          next.set(k, status);
        }
      }
      return next;
    });
  };

  /** Fill every blank working-day cell with Present. */
  const fillUnrecordedPresent = () => {
    setDirty(prev => {
      const next = new Map(prev);
      for (const emp of sortedEmployees) {
        for (const day of days) {
          if (day.isWeekend) continue;
          const k = cellKey(emp.id, day.date);
          if (savedByKey.has(k)) continue;
          if (next.has(k)) continue;
          next.set(k, 'present');
        }
      }
      return next;
    });
  };

  const discardChanges = () => setDirty(new Map());

  const handleSave = async () => {
    if (dirty.size === 0) return;
    const changes: MatrixCellChange[] = [];
    for (const [key, status] of dirty.entries()) {
      const [employeeId, date] = key.split('|');
      changes.push({ employeeId, date, status });
    }
    await onSave(changes);
    setDirty(new Map());
  };

  const resolveCell = (employeeId: string, date: string, isWeekend: boolean): AttendanceStatus | null => {
    const k = cellKey(employeeId, date);
    if (dirty.has(k)) return dirty.get(k)!;
    if (savedByKey.has(k)) return savedByKey.get(k)!;
    if (isWeekend) return 'weekend';
    return null;
  };

  // Per-employee summary in the right footer column.
  const summaries = useMemo(() => {
    const out = new Map<string, { worked: number; absent: number; leave: number; sick: number; unrecorded: number }>();
    for (const emp of sortedEmployees) {
      let worked = 0, absent = 0, leave = 0, sick = 0, unrecorded = 0;
      for (const day of days) {
        if (day.isWeekend) continue;
        const status = resolveCell(emp.id, day.date, false);
        if (status === 'present' || status === 'late') worked++;
        else if (status === 'half_day') worked += 0.5;
        else if (status === 'absent') absent++;
        else if (status === 'leave') leave++;
        else if (status === 'sick') sick++;
        else if (!status) unrecorded++;
      }
      out.set(emp.id, { worked, absent, leave, sick, unrecorded });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedEmployees, days, savedByKey, dirty]);

  const dirtyCount = dirty.size;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span className="font-medium text-gray-900">
            {format(new Date(period + '-01'), 'MMMM yyyy')}
          </span>
          <span className="text-gray-400">·</span>
          <span>{sortedEmployees.length} employees</span>
          {dirtyCount > 0 && (
            <>
              <span className="text-gray-400">·</span>
              <span className="text-amber-700 font-medium">{dirtyCount} unsaved</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fillUnrecordedPresent}>
            Mark unrecorded as Present
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={discardChanges}
            disabled={dirtyCount === 0 || saving}
          >
            <RotateCcw className="w-3 h-3 mr-1.5" /> Discard
          </Button>
          <Button size="sm" onClick={handleSave} disabled={dirtyCount === 0 || saving}>
            {saving ? <Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> : <Save className="w-3 h-3 mr-1.5" />}
            Save {dirtyCount > 0 ? `(${dirtyCount})` : ''}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {PICKABLE_STATUSES.map(s => (
          <span key={s} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${STATUS_META[s].bg} ${STATUS_META[s].text}`}>
            <span className="font-mono font-bold">{STATUS_META[s].letter}</span>
            <span>{STATUS_META[s].label}</span>
          </span>
        ))}
      </div>

      {/* Matrix */}
      {loading ? (
        <div className="py-12 flex items-center justify-center text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading attendance…
        </div>
      ) : sortedEmployees.length === 0 ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          No active employees in the selected period.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-auto bg-white">
          <table className="text-xs border-collapse" style={{ minWidth: '100%' }}>
            <thead>
              <tr className="bg-gray-50 sticky top-0 z-10">
                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left font-medium text-gray-700 border-r border-gray-200 z-20" style={{ minWidth: 200 }}>
                  Employee
                </th>
                {days.map(d => (
                  <th
                    key={d.date}
                    className={`px-1 py-2 text-center font-medium border-r border-gray-100 ${d.isWeekend ? 'bg-gray-100 text-gray-400' : 'text-gray-700'}`}
                    style={{ minWidth: 32 }}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full focus:outline-none focus:ring-1 focus:ring-blue-300 rounded">
                          <div className="text-[10px] leading-none">{WEEKDAY_LETTERS[d.weekday]}</div>
                          <div className="text-[11px] font-mono leading-tight mt-0.5">{d.day}</div>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-40">
                        <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wide">
                          Set whole column
                        </div>
                        {PICKABLE_STATUSES.map(s => (
                          <DropdownMenuItem key={s} onClick={() => setColumnAll(d.date, s)}>
                            <span className={`inline-block w-5 text-center font-mono font-bold mr-2 rounded ${STATUS_META[s].bg} ${STATUS_META[s].text}`}>
                              {STATUS_META[s].letter}
                            </span>
                            {STATUS_META[s].label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium text-gray-700 border-l border-gray-200" style={{ minWidth: 130 }}>
                  Summary
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((emp, i) => {
                const sum = summaries.get(emp.id)!;
                return (
                  <tr key={emp.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="sticky left-0 bg-inherit px-3 py-1.5 border-r border-gray-200 font-medium text-gray-900">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-left hover:text-blue-600 focus:outline-none">
                            {emp.fullName}
                            {emp.employeeNumber && (
                              <span className="ml-2 text-gray-400 font-mono text-[10px]">{emp.employeeNumber}</span>
                            )}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-44">
                          <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wide">
                            Set whole row (workdays)
                          </div>
                          {PICKABLE_STATUSES.map(s => (
                            <DropdownMenuItem key={s} onClick={() => setRowAll(emp.id, s)}>
                              <span className={`inline-block w-5 text-center font-mono font-bold mr-2 rounded ${STATUS_META[s].bg} ${STATUS_META[s].text}`}>
                                {STATUS_META[s].letter}
                              </span>
                              {STATUS_META[s].label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    {days.map(d => {
                      const status = resolveCell(emp.id, d.date, d.isWeekend);
                      const meta = status ? STATUS_META[status] : null;
                      const isDirty = dirty.has(cellKey(emp.id, d.date));
                      return (
                        <td
                          key={d.date}
                          className={`p-0.5 border-r border-gray-100 text-center ${d.isWeekend ? 'bg-gray-50' : ''}`}
                        >
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className={`w-7 h-6 text-[10px] font-mono font-bold rounded ${
                                  meta ? `${meta.bg} ${meta.text}` : 'bg-white border border-dashed border-gray-300 text-gray-300 hover:border-gray-400'
                                } ${isDirty ? 'ring-2 ring-amber-400 ring-offset-0' : ''}`}
                                title={meta ? `${meta.label}${isDirty ? ' (unsaved)' : ''}` : 'No record'}
                              >
                                {meta ? meta.letter : '·'}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-44 p-1" align="center">
                              <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wide">
                                {format(new Date(d.date), 'EEE, dd MMM')}
                              </div>
                              {PICKABLE_STATUSES.map(s => (
                                <button
                                  key={s}
                                  onClick={() => setCell(emp.id, d.date, s)}
                                  className="flex items-center w-full px-2 py-1 text-sm text-left rounded hover:bg-gray-100"
                                >
                                  <span className={`inline-block w-5 text-center font-mono font-bold mr-2 rounded ${STATUS_META[s].bg} ${STATUS_META[s].text}`}>
                                    {STATUS_META[s].letter}
                                  </span>
                                  {STATUS_META[s].label}
                                </button>
                              ))}
                            </PopoverContent>
                          </Popover>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 border-l border-gray-200 text-center text-[11px] text-gray-700">
                      <div className="flex items-center justify-center gap-2">
                        <span title="Worked (P+L+½H)" className="text-green-700 font-medium">{sum.worked}</span>
                        <span className="text-gray-300">/</span>
                        <span title="Absent" className="text-red-700">{sum.absent}</span>
                        <span title="Leave/Sick" className="text-blue-700">{sum.leave + sum.sick}</span>
                        {sum.unrecorded > 0 && (
                          <span title="Unrecorded workdays" className="text-amber-600">·{sum.unrecorded}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dirtyCount === 0 && records.length > 0 && !loading && (
        <div className="text-xs text-gray-500 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          All changes saved.
        </div>
      )}
    </div>
  );
}

export default AttendanceMatrix;
