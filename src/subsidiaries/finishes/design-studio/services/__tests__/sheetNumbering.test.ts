/**
 * Tests for SHEET_NUMBERING — pins the architectural A-series sub-ranges
 * + sub-cover slots. The numbering is consumed by both the renderer
 * and the table-of-contents surface, so a regression here would show
 * as drawings being mis-filed in a construction set.
 */
import { describe, it, expect } from 'vitest';
import { SHEET_NUMBERING } from '../../constants/workshop-viewer.constants';

describe('SHEET_NUMBERING.architectural — kind-aware A-series', () => {
  it('routes plans to A1xx', () => {
    expect(SHEET_NUMBERING.architectural('plan', 1)).toBe('A101');
    expect(SHEET_NUMBERING.architectural('plan', 2)).toBe('A102');
    expect(SHEET_NUMBERING.architectural('plan', 12)).toBe('A112');
  });

  it('routes elevations to A2xx', () => {
    expect(SHEET_NUMBERING.architectural('elevation', 1)).toBe('A201');
    expect(SHEET_NUMBERING.architectural('elevation', 5)).toBe('A205');
  });

  it('routes sections to A3xx', () => {
    expect(SHEET_NUMBERING.architectural('section', 1)).toBe('A301');
    expect(SHEET_NUMBERING.architectural('section', 10)).toBe('A310');
  });

  it('routes details to A5xx', () => {
    expect(SHEET_NUMBERING.architectural('detail', 1)).toBe('A501');
    expect(SHEET_NUMBERING.architectural('detail', 7)).toBe('A507');
  });

  it('routes "other" to A9xx', () => {
    expect(SHEET_NUMBERING.architectural('other', 1)).toBe('A901');
  });

  it('zero-pads the sequence within its kind (so sort order matches numeric order)', () => {
    expect(SHEET_NUMBERING.architectural('plan', 3).length).toBe(4);
    expect(SHEET_NUMBERING.architectural('elevation', 11).length).toBe(4);
  });
});

describe('SHEET_NUMBERING — sub-cover slots', () => {
  it('project cover is P000 (before consolidated drawings)', () => {
    expect(SHEET_NUMBERING.projectCover).toBe('P000');
  });

  it('cabinets cover is C000 (before per-cabinet block)', () => {
    expect(SHEET_NUMBERING.cabinetsCover).toBe('C000');
  });

  it('schedules cover is I300 (before I301 cut list, I303 hardware, I304 finish)', () => {
    expect(SHEET_NUMBERING.schedulesCover).toBe('I300');
    // Numerically precedes the first schedule sheet.
    expect(SHEET_NUMBERING.schedulesCover < SHEET_NUMBERING.cutList).toBe(true);
    expect(SHEET_NUMBERING.schedulesCover < SHEET_NUMBERING.hardwareSchedule).toBe(true);
    expect(SHEET_NUMBERING.schedulesCover < SHEET_NUMBERING.finishSchedule).toBe(true);
  });

  it('renders cover is I400 (before I500 gallery)', () => {
    expect(SHEET_NUMBERING.rendersCover).toBe('I400');
    expect(SHEET_NUMBERING.rendersCover < SHEET_NUMBERING.renderGallery).toBe(true);
  });

  it('architectural cover is A000 (before A1xx / A2xx / …)', () => {
    expect(SHEET_NUMBERING.architecturalCover).toBe('A000');
    expect(SHEET_NUMBERING.architecturalCover < SHEET_NUMBERING.architectural('plan', 1)).toBe(true);
  });
});

describe('architecturalSubtitle', () => {
  // Imported lazily so the SHEET_NUMBERING describe above stays a pure
  // constants test.
  it('summarises counts by kind', async () => {
    const { architecturalSubtitle } = await import('../sceneScheduleSheets');
    const asset = (kind: 'plan' | 'elevation' | 'section' | 'detail' | 'other') => ({
      id: Math.random().toString(), label: kind, kind,
      fileUrl: '', fileName: '', mimeType: 'image/png',
      uploadedBy: 'u', uploadedAt: null as never,
    });
    expect(architecturalSubtitle([asset('plan'), asset('plan'), asset('elevation')])).toBe(
      '2 plans · 1 elevation',
    );
    expect(architecturalSubtitle([asset('section')])).toBe('1 section');
    expect(architecturalSubtitle([])).toBe('');
  });
});
