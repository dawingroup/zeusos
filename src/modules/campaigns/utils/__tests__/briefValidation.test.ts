/**
 * Brief validation — Phase 6.D unit tests (C6).
 *   cd <root> && npx tsx --test src/modules/campaigns/utils/__tests__/briefValidation.test.ts
 *
 * The tests run with node:test against the pure validators. No Firestore
 * stub is needed — these are pure functions over the Brief type.
 *
 * NOTE: this file uses .ts extension, so run via tsx or compiled output.
 * The functions/ Node test runner can't pick this up directly — added
 * to the project-level test target if/when one exists.
 */

import { test, expect } from 'vitest';
import {
  validateBrief,
  validateBriefingCadence,
  validateCoAuthorship,
} from '../briefValidation';
import type { Brief, BriefAuthorContribution } from '../../types/campaign.types';

function baseBrief(over: Partial<Brief> = {}): Brief {
  return {
    tier: 2,
    objectives: 'objective',
    targetAudience: 'TA',
    kpis: [],
    ...over,
  };
}

// ─────────────────── briefing cadence ─────────────────────────────────

test('cadence: both unset → no warning', () => {
  const w = validateBriefingCadence(baseBrief());
  expect(w.length).toBe(0);
});

test('cadence: only doc delivered → no warning (verbal not yet)', () => {
  const w = validateBriefingCadence(baseBrief({
    documentDeliveredAt: '2026-05-24T09:00:00Z',
  }));
  expect(w.length).toBe(0);
});

test('cadence: TIER_2 verbal without doc → warns NO_DOCUMENT_DELIVERED', () => {
  const w = validateBriefingCadence(baseBrief({
    verbalBriefingAt: '2026-05-24T10:00:00Z',
  }));
  expect(w.length).toBe(1);
  expect(w[0].code).toBe('NO_DOCUMENT_DELIVERED');
});

test('cadence: TIER_3 verbal without doc → no warning (call-first allowed)', () => {
  const w = validateBriefingCadence(baseBrief({
    tier: 3,
    verbalBriefingAt: '2026-05-24T10:00:00Z',
  }));
  expect(w.length).toBe(0);
});

test('cadence: gap < 24h → DOC_VERBAL_TOO_CLOSE', () => {
  const w = validateBriefingCadence(baseBrief({
    documentDeliveredAt: '2026-05-24T09:00:00Z',
    verbalBriefingAt:    '2026-05-24T15:00:00Z',     // 6h gap
  }));
  expect(w.length).toBe(1);
  expect(w[0].code).toBe('DOC_VERBAL_TOO_CLOSE');
  expect(w[0].message).toMatch(/6h/);
});

test('cadence: gap ≥ 24h → no warning', () => {
  const w = validateBriefingCadence(baseBrief({
    documentDeliveredAt: '2026-05-23T09:00:00Z',
    verbalBriefingAt:    '2026-05-24T09:30:00Z',     // 24.5h gap
  }));
  expect(w.length).toBe(0);
});

// ─────────────────── co-authorship ────────────────────────────────────

test('coauthor: empty contributions array → no warning (legacy)', () => {
  const w = validateCoAuthorship(baseBrief({ authorContributions: [] }));
  expect(w.length).toBe(0);
});

test('coauthor: missing → no warning', () => {
  const w = validateCoAuthorship(baseBrief());
  expect(w.length).toBe(0);
});

const contribution = (over: Partial<BriefAuthorContribution>): BriefAuthorContribution => ({
  id: 'c1',
  principalKind: 'client',
  principalRef: 'p1',
  role: 'client_lead',
  contributionSummary: 'summary',
  contributedAt: '2026-05-24T09:00:00Z',
  ...over,
});

test('coauthor: only client → warns NO_AGENCY_CONTRIBUTION', () => {
  const w = validateCoAuthorship(baseBrief({
    authorContributions: [contribution({ principalKind: 'client' })],
  }));
  expect(w.length).toBe(1);
  expect(w[0].code).toBe('NO_AGENCY_CONTRIBUTION');
});

test('coauthor: only agency → warns NO_CLIENT_CONTRIBUTION', () => {
  const w = validateCoAuthorship(baseBrief({
    authorContributions: [contribution({ principalKind: 'agency' })],
  }));
  expect(w.length).toBe(1);
  expect(w[0].code).toBe('NO_CLIENT_CONTRIBUTION');
});

test('coauthor: both sides present → no warning', () => {
  const w = validateCoAuthorship(baseBrief({
    authorContributions: [
      contribution({ principalKind: 'client', id: 'c1' }),
      contribution({ principalKind: 'agency', id: 'a1' }),
    ],
  }));
  expect(w.length).toBe(0);
});

// ─────────────────── validateBrief (composed) ─────────────────────────

test('validateBrief: composes cadence + coauthor warnings', () => {
  const w = validateBrief(baseBrief({
    documentDeliveredAt: '2026-05-24T09:00:00Z',
    verbalBriefingAt:    '2026-05-24T12:00:00Z',     // 3h gap, fires DOC_VERBAL_TOO_CLOSE
    authorContributions: [contribution({ principalKind: 'client' })],   // fires NO_AGENCY
  }));
  expect(w.length).toBe(2);
  const codes = w.map((x) => x.code).sort();
  expect(codes).toEqual(['DOC_VERBAL_TOO_CLOSE', 'NO_AGENCY_CONTRIBUTION']);
});

test('validateBrief: clean brief → []', () => {
  const w = validateBrief(baseBrief({
    documentDeliveredAt: '2026-05-23T09:00:00Z',
    verbalBriefingAt:    '2026-05-24T09:30:00Z',
    authorContributions: [
      contribution({ principalKind: 'client', id: 'c1' }),
      contribution({ principalKind: 'agency', id: 'a1' }),
    ],
  }));
  expect(w.length).toBe(0);
});
