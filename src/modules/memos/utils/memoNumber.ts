/**
 * Memo reference numbers: `MEMO-<SUB>-<YYYY>-<NNN>`, minted at SUBMIT by the
 * callable from a forward-only counter — never counted or max+1 client-side.
 * Mirror of functions/src/memos/lib/memoNumber.js.
 */
import { MEMO_SUBSIDIARY_CODES } from '../constants/memoTemplates';

export const MEMO_NUMBER_PAD = 3;

export function memoSubsidiaryCode(subsidiaryId: string): string {
  return MEMO_SUBSIDIARY_CODES[subsidiaryId] ?? String(subsidiaryId || 'GRP').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase();
}

/** 'MEMO-ZTA-2026' — everything before the sequence, no trailing dash. */
export function memoNumberPrefix(subsidiaryId: string, year: number): string {
  return `MEMO-${memoSubsidiaryCode(subsidiaryId)}-${year}`;
}

export interface ParsedMemoNumber { code: string; year: number; sequence: number }

export function parseMemoNumber(value: string | undefined | null): ParsedMemoNumber | null {
  const m = String(value ?? '').match(/^MEMO-([A-Z]{2,4})-(\d{4})-(\d+)$/);
  if (!m) return null;
  return { code: m[1], year: Number(m[2]), sequence: Number(m[3]) };
}
