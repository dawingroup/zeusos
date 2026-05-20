/**
 * Attendance file importer.
 *
 * Today: Excel/CSV files exported by hand from payroll spreadsheets.
 * Tomorrow: HIK Vision biometric reader logs (different shape — each scan
 * is one timestamp, derive day status from in/out pairs). The importer
 * is structured around named adapters so the HIK parser can drop in
 * without churning the call site.
 */

import * as XLSX from 'xlsx';
import type { AttendanceStatus } from '../types/payroll-records.types';

export interface EmployeeLookup {
  id: string;
  fullName: string;
  employeeNumber?: string;
}

export interface ParsedAttendanceRow {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  hoursWorked?: number;
  notes?: string;
  /** 1-based row number from the source file, for surfaced errors. */
  sourceRow: number;
}

export interface ParseAttendanceResult {
  rows: ParsedAttendanceRow[];
  /** Rows that referenced an employee we couldn't resolve. */
  unmatchedEmployees: Array<{ sourceRow: number; identifier: string }>;
  /** Rows we couldn't parse at all (bad date, missing fields, unknown status). */
  invalidRows: Array<{ sourceRow: number; reason: string }>;
  /** Soft warnings — row was accepted but with an assumption. */
  warnings: Array<{ sourceRow: number; message: string }>;
  /** Source file label (sheet name or "csv"), useful in the preview UI. */
  sourceLabel: string;
}

// ---------------------------------------------------------------------------
// Header column resolution
// ---------------------------------------------------------------------------

const COLUMN_ALIASES = {
  employeeId: ['employee_id', 'employee id', 'emp_id', 'emp id', 'staff_id', 'staff id', 'id', 'employee number', 'employee_number', 'emp number', 'emp_number', 'staff number', 'staff_number', 'employee code', 'employee_code'],
  employeeName: ['employee_name', 'employee name', 'name', 'full name', 'full_name', 'staff name', 'staff_name', 'employee'],
  date: ['date', 'day', 'attendance date', 'attendance_date'],
  status: ['status', 'attendance', 'attendance status', 'attendance_status', 'state'],
  hours: ['hours', 'hours_worked', 'hours worked', 'worked hours', 'worked_hours', 'duration'],
  notes: ['notes', 'note', 'comment', 'comments', 'remark', 'remarks'],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

function resolveColumns(headers: string[]): Partial<Record<ColumnKey, number>> {
  const normalized = headers.map(h => String(h ?? '').trim().toLowerCase());
  const result: Partial<Record<ColumnKey, number>> = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as Array<[ColumnKey, readonly string[]]>) {
    const idx = normalized.findIndex(h => aliases.includes(h));
    if (idx >= 0) result[key] = idx;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Status normalization — accept the variations a human will type
// ---------------------------------------------------------------------------

const STATUS_MAP: Record<string, AttendanceStatus> = {
  // present
  p: 'present', present: 'present', 'on duty': 'present', working: 'present', work: 'present', '1': 'present', yes: 'present', y: 'present',
  // absent
  a: 'absent', absent: 'absent', off: 'absent', 'no show': 'absent', noshow: 'absent', '0': 'absent', no: 'absent', n: 'absent',
  // late
  l: 'late', late: 'late', tardy: 'late',
  // leave
  lv: 'leave', leave: 'leave', 'on leave': 'leave', 'al': 'leave', 'annual leave': 'leave', vacation: 'leave',
  // sick
  s: 'sick', sick: 'sick', 'sl': 'sick', 'sick leave': 'sick', ill: 'sick',
  // half day
  hd: 'half_day', 'h/d': 'half_day', 'half day': 'half_day', 'half-day': 'half_day', half_day: 'half_day', halfday: 'half_day',
  // holiday / weekend
  h: 'holiday', holiday: 'holiday', 'public holiday': 'holiday', ph: 'holiday',
  w: 'weekend', weekend: 'weekend', wk: 'weekend',
};

function normalizeStatus(raw: unknown): AttendanceStatus | null {
  if (raw == null) return null;
  const k = String(raw).trim().toLowerCase();
  if (!k) return null;
  return STATUS_MAP[k] ?? null;
}

// ---------------------------------------------------------------------------
// Date normalization — accept Excel serials, JS Date objects, and strings
// ---------------------------------------------------------------------------

function normalizeDate(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) return toISO(raw);

  if (typeof raw === 'number') {
    // Excel serial date — convert via SheetJS helper.
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return null;
    const d = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return toISO(d);
  }

  const s = String(raw).trim();
  if (!s) return null;

  // ISO YYYY-MM-DD (or YYYY/MM/DD)
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  // DD/MM/YYYY or D/M/YYYY (Uganda common form)
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  // Last resort: let JS try.
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return toISO(parsed);

  return null;
}

function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = pad2(d.getUTCMonth() + 1);
  const day = pad2(d.getUTCDate());
  return `${y}-${m}-${day}`;
}

function pad2(n: string | number): string {
  return String(n).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// Employee resolution
// ---------------------------------------------------------------------------

interface EmployeeIndex {
  byNumber: Map<string, EmployeeLookup>;
  byNameNormalized: Map<string, EmployeeLookup>;
  byId: Map<string, EmployeeLookup>;
}

function buildEmployeeIndex(employees: EmployeeLookup[]): EmployeeIndex {
  const idx: EmployeeIndex = {
    byNumber: new Map(),
    byNameNormalized: new Map(),
    byId: new Map(),
  };
  for (const e of employees) {
    idx.byId.set(e.id, e);
    if (e.employeeNumber) idx.byNumber.set(e.employeeNumber.trim().toLowerCase(), e);
    if (e.fullName) idx.byNameNormalized.set(normalizeName(e.fullName), e);
  }
  return idx;
}

function normalizeName(s: string): string {
  // Lowercase, strip extra whitespace, drop punctuation. Good enough for
  // matching "Alice  Mukasa" vs "alice mukasa".
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolveEmployee(
  identifier: string,
  identifierKind: 'id' | 'name',
  idx: EmployeeIndex,
): EmployeeLookup | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (identifierKind === 'id') {
    return idx.byId.get(trimmed)
      ?? idx.byNumber.get(trimmed.toLowerCase())
      ?? null;
  }
  return idx.byNameNormalized.get(normalizeName(trimmed)) ?? null;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parse an Excel or CSV file into validated attendance rows. Filters rows
 * to the period if provided so a year-wide spreadsheet doesn't blow past
 * what the user thinks they're importing.
 */
export async function parseAttendanceFile(
  file: File,
  employees: EmployeeLookup[],
  period?: string, // YYYY-MM — when set, rows outside this month are dropped (with a warning)
): Promise<ParseAttendanceResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return emptyResult('(empty file)');
  }

  const sheet = workbook.Sheets[sheetName];
  const grid: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (grid.length < 2) {
    return emptyResult(sheetName);
  }

  const headers = grid[0].map(c => String(c ?? '').trim());
  const cols = resolveColumns(headers);

  // The schema needs at least: (employeeId OR employeeName) + date + status
  if ((cols.employeeId == null && cols.employeeName == null) || cols.date == null || cols.status == null) {
    return {
      rows: [],
      unmatchedEmployees: [],
      invalidRows: [{
        sourceRow: 1,
        reason: `Header row must include columns for date, status, and either employee id/number or employee name. Found: ${headers.join(', ')}`,
      }],
      warnings: [],
      sourceLabel: sheetName,
    };
  }

  const idx = buildEmployeeIndex(employees);
  const result: ParseAttendanceResult = {
    rows: [],
    unmatchedEmployees: [],
    invalidRows: [],
    warnings: [],
    sourceLabel: sheetName,
  };

  for (let r = 1; r < grid.length; r++) {
    const row = grid[r];
    const sourceRow = r + 1; // 1-based, accounts for header

    // Skip fully empty rows silently (Excel often has trailing blanks).
    if (row.every(c => c === '' || c == null)) continue;

    const dateRaw = cols.date != null ? row[cols.date] : null;
    const date = normalizeDate(dateRaw);
    if (!date) {
      result.invalidRows.push({ sourceRow, reason: `Invalid or missing date: "${dateRaw}"` });
      continue;
    }

    if (period && !date.startsWith(period + '-')) {
      result.warnings.push({ sourceRow, message: `Row date ${date} is outside period ${period} — skipped.` });
      continue;
    }

    const statusRaw = cols.status != null ? row[cols.status] : null;
    const status = normalizeStatus(statusRaw);
    if (!status) {
      result.invalidRows.push({ sourceRow, reason: `Unknown status value: "${statusRaw}"` });
      continue;
    }

    let employee: EmployeeLookup | null = null;
    let identifier = '';
    if (cols.employeeId != null && row[cols.employeeId]) {
      identifier = String(row[cols.employeeId]).trim();
      employee = resolveEmployee(identifier, 'id', idx);
    }
    if (!employee && cols.employeeName != null && row[cols.employeeName]) {
      identifier = String(row[cols.employeeName]).trim();
      employee = resolveEmployee(identifier, 'name', idx);
    }
    if (!employee) {
      result.unmatchedEmployees.push({ sourceRow, identifier: identifier || '(blank)' });
      continue;
    }

    const hoursRaw = cols.hours != null ? row[cols.hours] : null;
    const hoursWorked = parseHours(hoursRaw);

    const notesRaw = cols.notes != null ? row[cols.notes] : null;
    const notes = notesRaw ? String(notesRaw).trim() : undefined;

    result.rows.push({
      employeeId: employee.id,
      employeeName: employee.fullName,
      date,
      status,
      hoursWorked,
      notes: notes || undefined,
      sourceRow,
    });
  }

  return result;
}

function parseHours(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 24) return undefined;
  return n;
}

function emptyResult(sourceLabel: string): ParseAttendanceResult {
  return {
    rows: [],
    unmatchedEmployees: [],
    invalidRows: [],
    warnings: [],
    sourceLabel,
  };
}

// ---------------------------------------------------------------------------
// Future adapter slot: HIK biometric reader
// ---------------------------------------------------------------------------
// Once the HIK terminal is in place, add a parseHikLog(file, employees)
// here that derives daily status from the timestamp stream:
//   - first scan of day = check-in time
//   - last scan = check-out
//   - missing scans = absent
//   - check-in past <threshold> = late
// Reuse normalizeDate / EmployeeIndex; emit the same ParsedAttendanceRow
// shape so AttendanceImportDialog doesn't change.
