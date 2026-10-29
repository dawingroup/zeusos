import { describe, it, expect } from 'vitest';
import {
  eatCalendarParts,
  eatDateKey,
  eatDayBoundary,
  fiscalPeriodLabel,
  fiscalQuarterOf,
  fiscalYearOf,
  fiscalYearRange,
  fyToDateRange,
} from '../fiscalYear';

describe('fiscalYear — the calendar year, read on the East Africa clock', () => {
  it('reads date-only strings as calendar dates and instants on the EAT clock', () => {
    expect(eatCalendarParts('2026-09-13')).toEqual({ year: 2026, month: 9, day: 13 });
    expect(eatCalendarParts('2026-09')).toEqual({ year: 2026, month: 9, day: 1 });
    // 22:30 UTC on the 13th is 01:30 on the 14th in Nairobi / Kampala.
    expect(eatDateKey('2026-09-13T22:30:00Z')).toBe('2026-09-14');
    expect(eatDateKey({ toDate: () => new Date('2026-01-01T00:00:00Z') })).toBe('2026-01-01');
    expect(eatCalendarParts('2026-02-30')).toBeNull();
    expect(eatCalendarParts(null)).toBeNull();
  });

  it('the fiscal year is the calendar year unless the record carries its own start month', () => {
    expect(fiscalYearOf('2026-07-01')).toBe(2026);
    expect(fiscalYearOf('2026-07-01', 7)).toBe(2027);
    expect(fiscalYearOf('2026-06-30', 7)).toBe(2026);
    expect(fiscalQuarterOf('2026-09-13')).toBe(3);
    expect(fiscalQuarterOf('2026-09-13', 7)).toBe(1);
  });

  it('ranges and labels', () => {
    expect(fiscalYearRange(2026)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(fiscalYearRange(2026, 7)).toEqual({ start: '2025-07-01', end: '2026-06-30' });
    expect(fyToDateRange('2026-09-13')).toEqual({ fiscalYear: 2026, start: '2026-01-01', end: '2026-09-13' });
    expect(fiscalPeriodLabel(2026)).toBe('FY 2026');
    expect(fiscalPeriodLabel(2026, 7)).toBe('Jul 2025 – Jun 2026');
    expect(fiscalPeriodLabel(null)).toBe('');
  });

  it('day boundaries are the EAT midnight, as UTC instants', () => {
    expect(eatDayBoundary('2026-01-01')?.toISOString()).toBe('2025-12-31T21:00:00.000Z');
    expect(eatDayBoundary('2026-01-01', true)?.toISOString()).toBe('2026-01-01T20:59:59.999Z');
  });
});
