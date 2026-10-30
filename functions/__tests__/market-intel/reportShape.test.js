/**
 * One stored report shape (audit 2026-10, A2 / WP3): the scan stamps the
 * core, every reader normalises through toReportWire, and the audit can
 * name what is off on an old document.
 *
 *    cd functions && node --test __tests__/market-intel/reportShape.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const shape = require('../../src/lib/marketIntelReportShape');

const ts = (iso) => ({ toDate: () => new Date(iso) });

test('scanReportCore: title from the model or a default, server Timestamp, brand, source, org', () => {
  const generatedAt = ts('2026-10-29T09:00:00.000Z');
  const core = shape.scanReportCore({ reportTitle: 'Q4 landscape', subsidiaryName: 'Zeus Digital', subsidiaryId: 'zeus-digital', generatedAt });
  assert.deepEqual(core, {
    title: 'Q4 landscape',
    reportTitle: 'Q4 landscape',
    reportType: 'ai_scan',
    subsidiaryId: 'zeus-digital',
    generatedAt,
    source: 'ai_scan',
    organizationId: 'default',
  });
  const blank = shape.scanReportCore({ reportTitle: '  ', subsidiaryName: 'Labyrinth Audio & Visual Content Studio', subsidiaryId: 'labyrinth', generatedAt });
  assert.equal(blank.title, 'Market Intelligence Report: Labyrinth Audio & Visual Content Studio');
});

test('toReportWire: a pre-WP3 scan document (reportTitle, model-typed generatedAt string) reads as the one shape', () => {
  const legacy = {
    reportTitle: 'Old scan',
    generatedAt: '2026-09-01',
    metadata: { generatedAt: '2026-09-01T10:00:00.000Z' },
    subsidiaryId: 'zeus-the-agency',
    competitorAnalyses: [],
    status: 'completed',
    createdAt: ts('2026-09-01T10:00:01.000Z'),
  };
  const wire = shape.toReportWire('r1', legacy);
  assert.equal(wire.id, 'r1');
  assert.equal(wire.title, 'Old scan');
  assert.equal(wire.reportTitle, 'Old scan');
  assert.equal(wire.reportType, 'ai_scan');
  assert.equal(wire.source, 'ai_scan');
  assert.equal(wire.organizationId, 'default');
  assert.equal(wire.generatedAt, '2026-09-01T10:00:00.000Z', 'metadata.generatedAt (server) wins over the model string');
  assert.equal(wire.createdAt, '2026-09-01T10:00:01.000Z');
  assert.equal(wire.updatedAt, null);
});

test('toReportWire: a post-WP3 document round-trips and dates become ISO strings', () => {
  const doc = {
    ...shape.scanReportCore({ reportTitle: 'New', subsidiaryId: 'odd-gorilla', generatedAt: ts('2026-10-29T09:00:00.000Z') }),
    createdAt: { _seconds: 1793264400 },
    updatedAt: { seconds: 1793264400 },
  };
  const wire = shape.toReportWire('r2', doc);
  assert.equal(wire.generatedAt, '2026-10-29T09:00:00.000Z');
  assert.equal(wire.createdAt, new Date(1793264400 * 1000).toISOString());
  assert.equal(wire.updatedAt, wire.createdAt);
  assert.equal(wire.subsidiaryId, 'odd-gorilla');
});

test('toReportWire: an unknown shape has null title/type/source rather than a guess', () => {
  const wire = shape.toReportWire('r3', { foo: 1 });
  assert.equal(wire.title, null);
  assert.equal(wire.reportType, null);
  assert.equal(wire.source, null);
  assert.equal(wire.generatedAt, null);
});

test('toIsoString: Timestamp, Date, string, millis, JSON-ed Timestamp; garbage is null', () => {
  assert.equal(shape.toIsoString(ts('2026-01-02T03:04:05.000Z')), '2026-01-02T03:04:05.000Z');
  assert.equal(shape.toIsoString(new Date('2026-01-02T03:04:05.000Z')), '2026-01-02T03:04:05.000Z');
  assert.equal(shape.toIsoString('2026-01-02T03:04:05.000Z'), '2026-01-02T03:04:05.000Z');
  assert.equal(shape.toIsoString(0), '1970-01-01T00:00:00.000Z');
  assert.equal(shape.toIsoString({ _seconds: 86400 }), '1970-01-02T00:00:00.000Z');
  assert.equal(shape.toIsoString('ISO date string'), null, 'the model placeholder text is not a date');
  assert.equal(shape.toIsoString(''), null);
  assert.equal(shape.toIsoString(undefined), null);
});

test('reportShapeDefects names what is off on an old document and nothing on a new one', () => {
  assert.deepEqual(
    shape.reportShapeDefects({ reportTitle: 'x', generatedAt: 'ISO date string', subsidiaryId: 'finishes' }).sort(),
    ['report_generated_at_not_timestamp', 'report_missing_title', 'report_missing_type', 'report_organization_not_default'].sort(),
  );
  const fresh = shape.scanReportCore({ reportTitle: 'x', subsidiaryId: 'labyrinth', generatedAt: ts('2026-10-29T09:00:00.000Z') });
  assert.deepEqual(shape.reportShapeDefects(fresh), []);
});
