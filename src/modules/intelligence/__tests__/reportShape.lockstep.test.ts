/**
 * The client reads a stored report the way the server serves it (audit
 * 2026-10, A2 / WP3): title, type and generatedAt resolve identically for
 * every live shape.
 */
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import {
  AI_SCAN_REPORT_TYPE,
  REPORT_ORGANIZATION_ID,
  detectReportSource,
  reportGeneratedAtIso,
  reportTitleOf,
  reportTypeOf,
  toIsoString,
} from '../utils/reportShape';

const require = createRequire(import.meta.url);
const server = require('../../../../functions/src/lib/marketIntelReportShape');

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

const SHAPES: Record<string, Record<string, unknown>> = {
  preWp3Scan: {
    reportTitle: 'Old scan',
    generatedAt: 'ISO date string',
    metadata: { generatedAt: '2026-09-01T10:00:00.000Z' },
    subsidiaryId: 'finishes',
    competitorAnalyses: [],
    createdAt: ts('2026-09-01T10:00:01.000Z'),
  },
  postWp3Scan: server.scanReportCore({ reportTitle: 'New', subsidiaryId: 'zeus-digital', generatedAt: ts('2026-10-29T09:00:00.000Z') }),
  unknown: { foo: 1 },
  titleOnly: { title: 'Hand-written', type: 'competitive_landscape', createdAt: { seconds: 1793264400 } },
};

describe('report shape — lockstep', () => {
  it('constants agree', () => {
    expect(AI_SCAN_REPORT_TYPE).toBe(server.AI_SCAN_REPORT_TYPE);
    expect(REPORT_ORGANIZATION_ID).toBe(server.REPORT_ORGANIZATION_ID);
  });

  it.each(Object.keys(SHAPES))('%s resolves the same title / type / source / generatedAt on both sides', (name) => {
    const data = SHAPES[name];
    const wire = server.toReportWire('r', data);
    expect(reportTitleOf(data)).toBe(wire.title);
    expect(reportTypeOf(data)).toBe(wire.reportType);
    expect(detectReportSource(data)).toBe(wire.source);
    expect(reportGeneratedAtIso(data)).toBe(wire.generatedAt);
    expect(toIsoString(data.createdAt)).toBe(wire.createdAt);
  });

  it('the server stamp wins over the model string, and placeholder text is not a date', () => {
    expect(reportGeneratedAtIso(SHAPES.preWp3Scan)).toBe('2026-09-01T10:00:00.000Z');
    expect(toIsoString('ISO date string')).toBeNull();
    expect(reportTypeOf(SHAPES.preWp3Scan)).toBe('ai_scan');
    expect(reportTypeOf(SHAPES.unknown)).toBeNull();
  });
});
