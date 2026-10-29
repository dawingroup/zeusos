/**
 * The group fiscal year — ONE definition.
 *
 *   - The fiscal year is the CALENDAR YEAR, 1 January – 31 December,
 *     everywhere. It is written "FY 2026" — never "FY 2025/26".
 *   - "Which year / month is it?" is read on the East Africa clock
 *     (EAT, UTC+3, no DST), not the viewer's browser clock.
 *   - Every derivation takes an optional `startMonth` so a record that stores
 *     its own start month (a legacy July–June budget) is still read on its
 *     own terms.
 *
 * Statutory tax periods (monthly VAT/PAYE/WHT) are NOT the company fiscal
 * year and do not use this.
 *
 * Pure and dependency-free apart from the constants module, so a server twin
 * can be a hand translation of this body.
 */
import { EAT_UTC_OFFSET_MS, BUSINESS_TIMEZONE } from '@/shared/constants/functionalCurrency';

export const FISCAL_YEAR_START_MONTH = 1; // January, 1-based — the calendar year
export const FISCAL_TIMEZONE = BUSINESS_TIMEZONE;
export { EAT_UTC_OFFSET_MS };

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Anything a date arrives as — see `eatCalendarParts`. */
export type FiscalDateInput =
  | string
  | number
  | Date
  | { toDate: () => Date }
  | null
  | undefined;

export interface CalendarParts {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
}

export interface FiscalMonth {
  /** 1-12; the start month is 1. */
  fiscalMonth: number;
  /** 1-4 */
  quarter: number;
  calendarYear: number;
  /** 1-12 */
  calendarMonth: number;
  /** 'YYYY-MM' */
  key: string;
}

export interface DateRange {
  /** 'YYYY-MM-DD' */
  start: string;
  /** 'YYYY-MM-DD' */
  end: string;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

/** A start month (1-12), or the company default when absent/invalid. */
export function normalizeStartMonth(startMonth?: number | null): number {
  const n = Number(startMonth);
  return isMonth(n) ? n : FISCAL_YEAR_START_MONTH;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Anything a date arrives as → its calendar date on the EAT clock, or null.
 *   - 'YYYY-MM' / 'YYYY-MM-DD' strings are calendar dates already (no clock);
 *     'YYYY-MM' reads as the 1st of that month.
 *   - a Date, epoch milliseconds, an ISO date-time string, or a Firestore
 *     Timestamp (`{ toDate() }`) is an INSTANT, read on the EAT clock.
 */
export function eatCalendarParts(value: FiscalDateInput): CalendarParts | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = dateOnly[3] === undefined ? 1 : Number(dateOnly[3]);
      if (!isMonth(month) || day < 1 || day > daysInMonth(year, month)) return null;
      return { year, month, day };
    }
    const t = Date.parse(value);
    return Number.isFinite(t) ? eatCalendarParts(t) : null;
  }
  let t: number;
  if (value instanceof Date) t = value.getTime();
  else if (typeof value === 'number') t = value;
  else if (typeof value === 'object' && typeof value.toDate === 'function') t = value.toDate().getTime();
  else return null;
  if (!Number.isFinite(t)) return null;
  const k = new Date(t + EAT_UTC_OFFSET_MS);
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate() };
}

/** A date's EAT calendar day as 'YYYY-MM-DD', or null. */
export function eatDateKey(value: FiscalDateInput): string | null {
  const p = eatCalendarParts(value);
  return p ? `${p.year}-${pad2(p.month)}-${pad2(p.day)}` : null;
}

/** A date's EAT calendar month as 'YYYY-MM', or null. */
export function eatPeriodKey(value: FiscalDateInput): string | null {
  const p = eatCalendarParts(value);
  return p ? `${p.year}-${pad2(p.month)}` : null;
}

/**
 * The instant an EAT calendar day ('YYYY-MM-DD') begins, or — with
 * `endOfDay` — its last millisecond. For Firestore Timestamps that must bound
 * a business day whatever clock the caller runs on.
 */
export function eatDayBoundary(dateKey: FiscalDateInput, endOfDay?: boolean): Date | null {
  const p = eatCalendarParts(dateKey);
  if (!p) return null;
  const startUtc = Date.UTC(p.year, p.month - 1, p.day) - EAT_UTC_OFFSET_MS;
  return new Date(endOfDay ? startUtc + 86400000 - 1 : startUtc);
}

/** A calendar month (1-12) of `year` → the fiscal year it belongs to. */
export function fiscalYearOfMonth(year: number, month: number, startMonth?: number | null): number | null {
  const s = normalizeStartMonth(startMonth);
  if (!Number.isInteger(year) || !isMonth(month)) return null;
  return s > 1 && month >= s ? year + 1 : year;
}

/** Any date (see `eatCalendarParts`) → the fiscal year it falls in, or null. */
export function fiscalYearOf(value: FiscalDateInput, startMonth?: number | null): number | null {
  const p = eatCalendarParts(value);
  return p ? fiscalYearOfMonth(p.year, p.month, startMonth) : null;
}

/** Calendar month (1-12) → fiscal month (1-12; the start month is 1). */
export function fiscalMonthOfMonth(month: number, startMonth?: number | null): number | null {
  const s = normalizeStartMonth(startMonth);
  if (!isMonth(month)) return null;
  return ((month - s + 12) % 12) + 1;
}

/** Any date → its fiscal month (1-12), or null. */
export function fiscalMonthOf(value: FiscalDateInput, startMonth?: number | null): number | null {
  const p = eatCalendarParts(value);
  return p ? fiscalMonthOfMonth(p.month, startMonth) : null;
}

/** Calendar month (1-12) → fiscal quarter (1-4). */
export function fiscalQuarterOfMonth(month: number, startMonth?: number | null): number | null {
  const fm = fiscalMonthOfMonth(month, startMonth);
  return fm === null ? null : Math.ceil(fm / 3);
}

/** Any date → its fiscal quarter (1-4), or null. */
export function fiscalQuarterOf(value: FiscalDateInput, startMonth?: number | null): number | null {
  const p = eatCalendarParts(value);
  return p ? fiscalQuarterOfMonth(p.month, startMonth) : null;
}

/** The twelve months of fiscal year `fy`, oldest first. */
export function fiscalYearMonths(fy: number, startMonth?: number | null): FiscalMonth[] {
  const s = normalizeStartMonth(startMonth);
  if (!Number.isInteger(fy)) return [];
  const firstYear = s > 1 ? fy - 1 : fy;
  const months: FiscalMonth[] = [];
  for (let i = 0; i < 12; i += 1) {
    const idx = s - 1 + i; // 0-based months from January of firstYear
    const calendarYear = firstYear + Math.floor(idx / 12);
    const calendarMonth = (idx % 12) + 1;
    months.push({
      fiscalMonth: i + 1,
      quarter: Math.floor(i / 3) + 1,
      calendarYear,
      calendarMonth,
      key: `${calendarYear}-${pad2(calendarMonth)}`,
    });
  }
  return months;
}

/** The twelve 'YYYY-MM' keys of fiscal year `fy`, oldest first. */
export function fiscalYearMonthKeys(fy: number, startMonth?: number | null): string[] {
  return fiscalYearMonths(fy, startMonth).map((m) => m.key);
}

/** First month of fiscal year `fy` as 'YYYY-MM' (FY 2026 → '2026-01'). */
export function fiscalYearStartKey(fy: number, startMonth?: number | null): string | null {
  const months = fiscalYearMonths(fy, startMonth);
  return months.length ? months[0].key : null;
}

/** Last month of fiscal year `fy` as 'YYYY-MM' (FY 2026 → '2026-12'). */
export function fiscalYearEndKey(fy: number, startMonth?: number | null): string | null {
  const months = fiscalYearMonths(fy, startMonth);
  return months.length ? months[11].key : null;
}

/** Fiscal year `fy` as calendar dates: FY 2026 → { start: '2026-01-01', end: '2026-12-31' }. */
export function fiscalYearRange(fy: number, startMonth?: number | null): DateRange | null {
  const months = fiscalYearMonths(fy, startMonth);
  if (!months.length) return null;
  const first = months[0];
  const last = months[11];
  return {
    start: `${first.key}-01`,
    end: `${last.key}-${pad2(daysInMonth(last.calendarYear, last.calendarMonth))}`,
  };
}

/**
 * Fiscal-year-to-date as calendar dates, both read in EAT:
 * 13 Sep 2026 → { fiscalYear: 2026, start: '2026-01-01', end: '2026-09-13' }.
 * Omitting `asOf` means now.
 */
export function fyToDateRange(
  asOf?: FiscalDateInput,
  startMonth?: number | null,
): (DateRange & { fiscalYear: number }) | null {
  const end = eatDateKey(asOf === undefined ? new Date() : asOf);
  if (!end) return null;
  const fiscalYear = fiscalYearOf(end, startMonth) as number;
  const range = fiscalYearRange(fiscalYear, startMonth) as DateRange;
  return { fiscalYear, start: range.start, end };
}

/** How the fiscal year is written on screen: 2026 → 'FY 2026'. */
export function fiscalYearLabel(fy: number | null | undefined): string {
  if (typeof fy !== 'number' || !Number.isInteger(fy)) return '';
  return `FY ${fy}`;
}

/**
 * A twelve-month plan's name. A calendar-year plan is its fiscal year
 * ('FY 2026'); any other start month is named by its real months
 * ('Jul 2025 – Jun 2026') — never 'FY 2025/26'.
 */
export function fiscalPeriodLabel(fy: number | null | undefined, startMonth?: number | null): string {
  const s = normalizeStartMonth(startMonth);
  if (typeof fy !== 'number' || !Number.isInteger(fy)) return '';
  if (s === 1) return fiscalYearLabel(fy);
  const months = fiscalYearMonths(fy, s);
  const first = months[0];
  const last = months[11];
  return `${MONTH_SHORT_NAMES[first.calendarMonth - 1]} ${first.calendarYear} – ` +
    `${MONTH_SHORT_NAMES[last.calendarMonth - 1]} ${last.calendarYear}`;
}
