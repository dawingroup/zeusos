/**
 * Market Intelligence integrity audit — the PURE half
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, WP0).
 *
 * `auditMarketIntel(snapshots)` takes `{ [collectionId]: Array<{ id, data }> }`
 * and reproduces every count the audit document reports: documents per
 * collection, subsidiary vocabulary per scoped field, orphaned competitor
 * references, social shells, report-shape drift, archive stamps, and any
 * document in a retired collection. No Firebase here, so
 * functions/__tests__/market-intel/integrity.test.js pins it against
 * fixtures and scripts/audit-market-intel-integrity.cjs feeds it live
 * documents.
 *
 * `--strict` in the script exits 1 when `hasDefects(report)` — later work
 * packages use it as a post-change gate.
 */
'use strict';

const path = require('node:path');

const vocabulary = require(path.join(__dirname, '..', '..', 'functions', 'src', 'lib', 'marketIntelVocabulary'));
const reportShape = require(path.join(__dirname, '..', '..', 'functions', 'src', 'lib', 'marketIntelReportShape'));
const socialKeys = require(path.join(__dirname, '..', '..', 'functions', 'src', 'lib', 'socialPostKeys'));

const {
  MARKET_INTEL_COLLECTIONS,
  MARKET_INTEL_COLLECTION_IDS,
  RETIRED_MARKET_INTEL_COLLECTIONS,
  COMPETITOR_CHILD_COLLECTIONS,
  COMPETITOR_REFERENCE_ARRAYS,
  isMarketIntelSubsidiaryId,
  isCompetitorIdSentinel,
} = vocabulary;

/** Every collection the script reads: owned first, then retired. */
const AUDITED_COLLECTION_IDS = Object.freeze([
  ...MARKET_INTEL_COLLECTION_IDS,
  ...RETIRED_MARKET_INTEL_COLLECTIONS,
]);

const SAMPLE_LIMIT = 5;

function tally(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function makeDefect(code, collection, message) {
  return { code, collection, message, count: 0, sample: [] };
}

function hit(defect, id) {
  defect.count += 1;
  if (defect.sample.length < SAMPLE_LIMIT) defect.sample.push(id);
}

function rowsOf(snapshots, id) {
  const rows = snapshots && snapshots[id];
  return Array.isArray(rows) ? rows : [];
}

/** Subsidiary vocabulary on one scoped field: value → count, plus unknowns. */
function auditVocabulary(rows, spec, defects) {
  const values = {};
  const unknown = makeDefect('unknown_subsidiary_id', spec.id, `${spec.subsidiaryField} names a subsidiary outside MARKET_INTEL_SUBSIDIARY_IDS`);
  const missing = makeDefect('missing_subsidiary_scope', spec.id, `${spec.subsidiaryField} is absent or empty`);
  for (const row of rows) {
    const raw = row.data ? row.data[spec.subsidiaryField] : undefined;
    const list = spec.subsidiaryFieldKind === 'array' ? (Array.isArray(raw) ? raw : []) : raw ? [raw] : [];
    if (list.length === 0) {
      tally(values, '(none)');
      hit(missing, row.id);
      continue;
    }
    let bad = false;
    for (const v of list) {
      tally(values, String(v));
      if (!isMarketIntelSubsidiaryId(v)) bad = true;
    }
    if (bad) hit(unknown, row.id);
  }
  if (unknown.count) defects.push(unknown);
  if (missing.count) defects.push(missing);
  return { field: spec.subsidiaryField, values };
}

function auditMarketIntel(snapshots, options = {}) {
  const measuredAt = options.measuredAt || new Date().toISOString();
  const collections = {};
  const defects = [];
  const vocab = {};

  for (const id of AUDITED_COLLECTION_IDS) {
    const rows = rowsOf(snapshots, id);
    collections[id] = {
      docs: rows.length,
      retired: RETIRED_MARKET_INTEL_COLLECTIONS.includes(id),
      sampled: !!(options.sampled && options.sampled[id]),
    };
  }

  // Retired collections must be empty.
  for (const id of RETIRED_MARKET_INTEL_COLLECTIONS) {
    const rows = rowsOf(snapshots, id);
    if (rows.length === 0) continue;
    const d = makeDefect('retired_collection_present', id, 'a retired collection still holds documents');
    for (const row of rows) hit(d, row.id);
    defects.push(d);
  }

  // Subsidiary vocabulary on every scoped field.
  for (const spec of MARKET_INTEL_COLLECTIONS) {
    if (!spec.subsidiaryField) continue;
    vocab[spec.id] = auditVocabulary(rowsOf(snapshots, spec.id), spec, defects);
  }

  // Legacy DawinOS field on win/loss.
  {
    const d = makeDefect('legacy_subsidiary_field', 'win_loss_records', 'carries DawinOS `dawinSubsidiary` instead of `subsidiaryId`');
    for (const row of rowsOf(snapshots, 'win_loss_records')) {
      if (row.data && 'dawinSubsidiary' in row.data) hit(d, row.id);
    }
    if (d.count) defects.push(d);
  }

  // Competitor references: orphans and sentinels.
  const competitorIds = new Set(rowsOf(snapshots, 'competitors').map((r) => r.id));
  const sentinels = {};
  for (const spec of COMPETITOR_CHILD_COLLECTIONS) {
    const orphan = makeDefect('orphan_competitor_ref', spec.id, `${spec.competitorField} points at no competitor`);
    for (const row of rowsOf(snapshots, spec.id)) {
      const ref = row.data ? row.data[spec.competitorField] : undefined;
      if (ref === null || ref === undefined || ref === '') {
        hit(orphan, row.id);
        continue;
      }
      if (isCompetitorIdSentinel(ref)) {
        tally(sentinels, spec.id);
        continue;
      }
      if (!competitorIds.has(ref)) hit(orphan, row.id);
    }
    if (orphan.count) defects.push(orphan);
  }
  for (const spec of COMPETITOR_REFERENCE_ARRAYS) {
    const dangling = makeDefect('dangling_competitor_reference', spec.id, `${spec.field} names a competitor that no longer exists`);
    for (const row of rowsOf(snapshots, spec.id)) {
      const arr = row.data && Array.isArray(row.data[spec.field]) ? row.data[spec.field] : [];
      if (arr.some((x) => !competitorIds.has(x))) hit(dangling, row.id);
    }
    if (dangling.count) defects.push(dangling);
  }

  // Archive stamps on competitors.
  {
    const d = makeDefect('archived_without_stamp', 'competitors', '`archived: true` without `archivedAt`');
    for (const row of rowsOf(snapshots, 'competitors')) {
      if (row.data && row.data.archived === true && !row.data.archivedAt) hit(d, row.id);
    }
    if (d.count) defects.push(d);
  }

  // Social shells.
  {
    const synthetic = makeDefect('synthetic_post_id', 'social_posts', 'postId is a synthetic fallback, not the platform id');
    const empty = makeDefect('empty_social_post', 'social_posts', 'no body and zero engagement');
    const badKey = makeDefect('social_post_doc_id_not_natural', 'social_posts', 'document id is not {platform}_{postId}');
    for (const row of rowsOf(snapshots, 'social_posts')) {
      const p = row.data || {};
      if (!p.postId || socialKeys.isSyntheticPostId(p.postId)) hit(synthetic, row.id);
      const engagement = Number(p.likes || 0) + Number(p.comments || 0) + Number(p.shares || 0) + Number(p.views || 0);
      if (!(typeof p.contentText === 'string' && p.contentText.trim() !== '') && engagement === 0) hit(empty, row.id);
      if (p.postId && p.platform && row.id !== socialKeys.socialPostDocId(p.platform, p.postId)) hit(badKey, row.id);
    }
    if (synthetic.count) defects.push(synthetic);
    if (empty.count) defects.push(empty);
    if (badKey.count) defects.push(badKey);

    const zero = makeDefect('zero_follower_metrics', 'social_metrics', 'every account count is zero');
    for (const row of rowsOf(snapshots, 'social_metrics')) {
      if (socialKeys.isInformationFreeMetrics(row.data)) hit(zero, row.id);
    }
    if (zero.count) defects.push(zero);
  }

  // Report shape.
  {
    const byCode = {};
    const shapes = { generatedAtString: 0, generatedAtTimestamp: 0, titleOnly: 0, reportTitleOnly: 0, both: 0, neither: 0 };
    for (const row of rowsOf(snapshots, 'market_intelligence_reports')) {
      const d = row.data || {};
      if (typeof d.generatedAt === 'string') shapes.generatedAtString += 1;
      else if (d.generatedAt) shapes.generatedAtTimestamp += 1;
      const hasTitle = typeof d.title === 'string' && d.title !== '';
      const hasLegacy = typeof d.reportTitle === 'string' && d.reportTitle !== '';
      if (hasTitle && hasLegacy) shapes.both += 1;
      else if (hasTitle) shapes.titleOnly += 1;
      else if (hasLegacy) shapes.reportTitleOnly += 1;
      else shapes.neither += 1;
      for (const code of reportShape.reportShapeDefects(d)) {
        if (!byCode[code]) byCode[code] = makeDefect(code, 'market_intelligence_reports', 'stored report is not in the one shape');
        hit(byCode[code], row.id);
      }
      // An unknown subsidiaryId is already counted by the vocabulary audit above.
    }
    for (const d of Object.values(byCode)) defects.push(d);
    vocab.market_intelligence_reports = { ...(vocab.market_intelligence_reports || {}), shapes };
  }

  const totalDocs = Object.values(collections).reduce((n, c) => n + c.docs, 0);
  const defectCount = defects.reduce((n, d) => n + d.count, 0);
  return {
    measuredAt,
    collections,
    vocabulary: vocab,
    sentinels,
    defects,
    summary: { totalDocs, defectCount, collectionsPresent: Object.values(collections).filter((c) => c.docs > 0).length },
  };
}

function hasDefects(report) {
  return !!report && report.summary.defectCount > 0;
}

/** Plain-text rendering for the terminal. */
function renderReport(report) {
  const lines = [];
  lines.push(`Market Intelligence integrity — measured ${report.measuredAt}`);
  lines.push('');
  lines.push('Collection                          docs   note');
  for (const [id, c] of Object.entries(report.collections)) {
    const note = c.retired ? 'retired' : c.sampled ? 'sampled' : '';
    lines.push(`${id.padEnd(35)} ${String(c.docs).padStart(5)}   ${note}`);
  }
  lines.push('');
  for (const [coll, v] of Object.entries(report.vocabulary)) {
    if (v.values) {
      const dist = Object.entries(v.values).map(([k, n]) => `${k} ${n}`).join(' / ') || '(no documents)';
      lines.push(`${coll}.${v.field}: ${dist}`);
    }
    if (v.shapes) lines.push(`${coll} shapes: ${JSON.stringify(v.shapes)}`);
  }
  if (Object.keys(report.sentinels).length) {
    lines.push(`sentinel competitorIds (OWN_/CANDIDATE_, not orphans): ${JSON.stringify(report.sentinels)}`);
  }
  lines.push('');
  if (report.defects.length === 0) {
    lines.push('Defects: none');
  } else {
    lines.push('Defects:');
    for (const d of report.defects) {
      lines.push(`  ${d.code.padEnd(36)} ${d.collection.padEnd(28)} ${String(d.count).padStart(5)}   ${d.message}${d.sample.length ? `  e.g. ${d.sample.join(', ')}` : ''}`);
    }
  }
  lines.push('');
  lines.push(`Total documents: ${report.summary.totalDocs}; defects: ${report.summary.defectCount}`);
  return lines.join('\n');
}

module.exports = {
  AUDITED_COLLECTION_IDS,
  SAMPLE_LIMIT,
  auditMarketIntel,
  hasDefects,
  renderReport,
};
