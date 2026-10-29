/**
 * The one stored report shape, as the CLIENT reads it — twin of
 * functions/src/lib/marketIntelReportShape.js
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, A2 / WP3).
 *
 * A `market_intelligence_reports` document written before WP3 carries
 * `reportTitle` and a `generatedAt` the model typed as a string; one written
 * after carries `title`, `reportType`, `source` and a server Timestamp.
 * Every reader that touches a stored document directly (the strategy
 * aggregator, any list) goes through these so both shapes read the same.
 * Pinned to the server twin by src/modules/intelligence/__tests__/reportShape.lockstep.test.ts.
 */

export const REPORT_ORGANIZATION_ID = 'default';
export const AI_SCAN_REPORT_TYPE = 'ai_scan';
export const AI_SCAN_SOURCE = 'ai_scan';

type Loose = Record<string, unknown> | null | undefined;

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Timestamp (web SDK), Date, ISO string, millis or a JSON-ed Timestamp → ISO string; garbage → null. */
export function toIsoString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  let date: Date | null = null;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'object') {
    const v = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof v.toDate === 'function') {
      try {
        date = v.toDate();
      } catch {
        return null;
      }
    } else if (typeof v._seconds === 'number') {
      date = new Date(v._seconds * 1000);
    } else if (typeof v.seconds === 'number') {
      date = new Date(v.seconds * 1000);
    }
  } else if (typeof value === 'string' || typeof value === 'number') {
    date = new Date(value);
  }
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** Which writer produced a document, from its shape. */
export function detectReportSource(data: Loose): typeof AI_SCAN_SOURCE | null {
  const d = data ?? {};
  if (d.source === AI_SCAN_SOURCE) return AI_SCAN_SOURCE;
  if (Array.isArray(d.competitorAnalyses) || nonEmptyString(d.reportTitle)) return AI_SCAN_SOURCE;
  return null;
}

/** `title`, falling back to the scan's legacy `reportTitle`. */
export function reportTitleOf(data: Loose): string | null {
  const d = data ?? {};
  return nonEmptyString(d.title) ?? nonEmptyString(d.reportTitle) ?? null;
}

export function reportTypeOf(data: Loose): string | null {
  const d = data ?? {};
  const stored = nonEmptyString(d.reportType) ?? nonEmptyString(d.type);
  if (stored) return stored;
  return detectReportSource(d) === AI_SCAN_SOURCE ? AI_SCAN_REPORT_TYPE : null;
}

/** When the report was generated: the server's metadata stamp wins over the model's string, then createdAt. */
export function reportGeneratedAtIso(data: Loose): string | null {
  const d = data ?? {};
  const metadata = (d.metadata ?? null) as { generatedAt?: unknown } | null;
  return toIsoString(metadata?.generatedAt) ?? toIsoString(d.generatedAt) ?? toIsoString(d.createdAt) ?? null;
}
