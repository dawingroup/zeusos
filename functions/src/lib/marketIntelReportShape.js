/**
 * The ONE stored shape of a `market_intelligence_reports` document
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, finding A2 / WP3).
 *
 * Before this the AI scan (functions/src/ai/marketIntelligence.js) stored
 * whatever the model wrote — `reportTitle`, a `generatedAt` the MODEL typed
 * as a string, a DawinOS `subsidiaryId` — plus `status: 'completed'`, and
 * the unrouted dashboard submodule wrote a second shape keyed on
 * `organizationId`. Every reader then saw a different subset: the strategy
 * aggregator filtered on `title`, the MCP tool printed `reportTitle`, the
 * callable filtered on `subsidiaryId`. The scan now takes its core fields
 * from here and every reader goes through `toReportWire`:
 *
 *   title           what every reader shows (`reportTitle` is still written
 *                   as an alias for one release — the MCP vendor bundle reads it)
 *   reportType      'ai_scan' (the client `ReportType` union carries it)
 *   subsidiaryId    a market-intelligence subsidiary id (one of the five brands)
 *   generatedAt     a Firestore Timestamp stamped by the SERVER, passed in by
 *                   the writer (this module is pure and cannot mint one)
 *   source          'ai_scan'
 *   organizationId  'default' — single tenant
 *
 * Pure (no firebase-admin) so functions/__tests__ and the audit script can
 * load it; the client twin is src/modules/intelligence/utils/reportShape.ts.
 */
'use strict';

const REPORT_ORGANIZATION_ID = 'default';

const REPORT_SOURCES = Object.freeze({
  AI_SCAN: 'ai_scan',
});

/** `reportType` of an AI scan — a member of the client `ReportType` union. */
const AI_SCAN_REPORT_TYPE = 'ai_scan';

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Timestamp (Admin or web SDK), Date, ISO string, millis, or the
 * `{_seconds}` / `{seconds}` object a Timestamp becomes after JSON → ISO
 * string, or null. An unparseable string is null, never passed through.
 */
function toIsoString(value) {
  if (value === null || value === undefined || value === '') return null;
  let date = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      try {
        date = value.toDate();
      } catch {
        return null;
      }
    } else if (typeof value._seconds === 'number') {
      date = new Date(value._seconds * 1000);
    } else if (typeof value.seconds === 'number') {
      date = new Date(value.seconds * 1000);
    }
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Which writer produced a document, from its shape. null = unknown. */
function detectReportSource(data) {
  const d = data || {};
  if (d.source === REPORT_SOURCES.AI_SCAN) return REPORT_SOURCES.AI_SCAN;
  if (Array.isArray(d.competitorAnalyses) || nonEmptyString(d.reportTitle)) {
    return REPORT_SOURCES.AI_SCAN;
  }
  return null;
}

/** `title`, falling back to the scan's legacy `reportTitle`. */
function reportTitleOf(data) {
  const d = data || {};
  return nonEmptyString(d.title) || nonEmptyString(d.reportTitle) || null;
}

function reportTypeOf(data) {
  const d = data || {};
  const stored = nonEmptyString(d.reportType) || nonEmptyString(d.type);
  if (stored) return stored;
  return detectReportSource(d) === REPORT_SOURCES.AI_SCAN ? AI_SCAN_REPORT_TYPE : null;
}

/**
 * When the report was generated, as an ISO string. The scan's
 * `metadata.generatedAt` is stamped by the server and wins over the
 * top-level `generatedAt`, which on a pre-WP3 document is whatever the model
 * wrote into the JSON it was asked for; then the top-level field (a
 * Timestamp after WP3), then `createdAt`.
 */
function reportGeneratedAtIso(data) {
  const d = data || {};
  return (
    toIsoString(d.metadata && d.metadata.generatedAt) ||
    toIsoString(d.generatedAt) ||
    toIsoString(d.createdAt) ||
    null
  );
}

/** Core fields of an AI-scan report. `generatedAt` is the writer's Timestamp. */
function scanReportCore({ reportTitle, subsidiaryName, subsidiaryId, generatedAt }) {
  const title =
    nonEmptyString(reportTitle) ||
    `Market Intelligence Report: ${subsidiaryName || subsidiaryId || 'Zeus Group'}`;
  return {
    title,
    // Alias kept for one release: the MCP vendor bundle and older clients read it.
    reportTitle: title,
    reportType: AI_SCAN_REPORT_TYPE,
    subsidiaryId: nonEmptyString(subsidiaryId),
    generatedAt,
    source: REPORT_SOURCES.AI_SCAN,
    organizationId: REPORT_ORGANIZATION_ID,
  };
}

/**
 * A stored report as the `getMarketIntelligenceReports` callable returns it:
 * every stored field, the core normalised from whichever shape the document
 * has, and every date the callers read as an ISO STRING (`generatedAt`,
 * `createdAt`, `updatedAt`).
 */
function toReportWire(id, data) {
  const d = data || {};
  const title = reportTitleOf(d);
  return {
    ...d,
    id,
    title,
    reportTitle: nonEmptyString(d.reportTitle) || title,
    reportType: reportTypeOf(d),
    source: detectReportSource(d),
    subsidiaryId: nonEmptyString(d.subsidiaryId),
    organizationId: nonEmptyString(d.organizationId) || REPORT_ORGANIZATION_ID,
    generatedAt: reportGeneratedAtIso(d),
    createdAt: toIsoString(d.createdAt),
    updatedAt: toIsoString(d.updatedAt),
  };
}

/** Defects on one stored document, for the integrity audit (WP0). */
function reportShapeDefects(data) {
  const d = data || {};
  const defects = [];
  if (!nonEmptyString(d.title)) defects.push('report_missing_title');
  if (!nonEmptyString(d.reportType)) defects.push('report_missing_type');
  if (!nonEmptyString(d.subsidiaryId)) defects.push('report_missing_subsidiary');
  if (typeof d.generatedAt === 'string' || d.generatedAt === undefined || d.generatedAt === null) {
    defects.push('report_generated_at_not_timestamp');
  }
  if (d.organizationId !== REPORT_ORGANIZATION_ID) defects.push('report_organization_not_default');
  return defects;
}

module.exports = {
  REPORT_ORGANIZATION_ID,
  REPORT_SOURCES,
  AI_SCAN_REPORT_TYPE,
  toIsoString,
  detectReportSource,
  reportTitleOf,
  reportTypeOf,
  reportGeneratedAtIso,
  scanReportCore,
  toReportWire,
  reportShapeDefects,
};
