/**
 * The PDF document model renders the memo AS ISSUED — from the snapshot when
 * there is one — without rasterising anything.
 */
import { describe, expect, it } from 'vitest';
import { buildMemoDocData, buildMemoFilename, resolveMemoIssuer } from '../pdf/memoDocData';
import type { Memo } from '../types/memo';

const base: Memo = {
  id: 'm1',
  memoNumber: 'MEMO-ZTA-2026-001',
  subsidiaryId: 'zeus-the-agency',
  type: 'request',
  category: 'finance',
  impact: 'medium',
  confidential: false,
  subject: 'Generator hire',
  header: { to: [{ uid: 'g', name: 'Grace', title: 'MD' }], from: { uid: 'a', name: 'Amina' }, through: [{ uid: 'b', name: 'Ben' }], cc: [], date: '2026-10-26' },
  amountMinor: 180000,
  currency: 'KES',
  sections: [
    { key: 'purpose', heading: 'Purpose', content: 'Hire a generator.\n\n- six weeks\n- Diageo shoot', enabled: true },
    { key: 'risks', heading: 'Risks', content: 'off', enabled: false },
  ],
  attachments: [{ id: 'a1', name: 'quote.pdf', url: 'u', addedBy: 'a', addedAt: '2026-10-26T09:00:00.000Z' }],
  links: [{ type: 'iwo', id: 'iwo-1', label: 'IWO-ZTA-014', relation: 'authorises' }],
  distribution: [{ uid: 'c', name: 'Carol', role: 'ack', requiresAck: true }],
  distributionUids: ['c'],
  acknowledgements: {},
  status: 'submitted',
  statusHistory: [],
  version: 1,
  createdBy: 'a',
  createdByName: 'Amina',
  createdAt: '2026-10-26T09:00:00.000Z',
  updatedAt: '2026-10-26T09:00:00.000Z',
  updatedBy: 'a',
};

describe('buildMemoDocData', () => {
  it('a submitted memo renders as a draft from its live fields', () => {
    const d = buildMemoDocData(base);
    expect(d.draft).toBe(true);
    expect(d.issuer.name).toBe('Zeus The Agency');
    expect(d.issuer.groupLine).toBe('A Zeus Group company');
    expect(d.header).toMatchObject({ to: 'Grace, MD', through: 'Ben', cc: '—', from: 'Amina' });
    expect(d.classLine).toContain('Request / justification');
    expect(d.classLine).toContain('KES');
    expect(d.sections.map((s) => s.key)).toEqual(['purpose']);
    expect(d.sections[0].blocks[1]).toEqual({ kind: 'list', ordered: false, items: ['six weeks', 'Diageo shoot'] });
    expect(d.references).toEqual(['IWO-ZTA-014 (authorised by this memo)']);
    expect(d.attachments).toEqual(['quote.pdf']);
    expect(d.distribution).toEqual([{ name: 'Carol', role: 'Acknowledge', acknowledged: 'pending' }]);
    expect(d.decision).toBeUndefined();
    expect(d.contentHash).toBeUndefined();
  });

  it('an issued memo renders from its snapshot, with the decision and the hash', () => {
    const issued: Memo = {
      ...base,
      status: 'issued',
      sections: [{ key: 'purpose', heading: 'Purpose', content: 'EDITED AFTER ISSUE — must not print', enabled: true }],
      decision: { outcome: 'modified', conditions: 'Four weeks only.', signedBy: 'g', signedByName: 'Grace Admin', signedNameTyped: 'Grace', signatureMethod: 'typed', at: '2026-10-27T10:00:00.000Z' },
      acknowledgements: { c: { name: 'Carol', at: '2026-10-28T08:00:00.000Z', method: 'in_app' } },
      issuedSnapshot: {
        memoNumber: 'MEMO-ZTA-2026-001', version: 1, header: base.header, sections: base.sections, links: base.links, attachments: base.attachments,
        distribution: base.distribution, amountMinor: 180000, currency: 'KES', contentHash: 'abc123', issuedAt: '2026-10-27T11:00:00.000Z', issuedBy: 'a',
      },
    };
    const d = buildMemoDocData(issued);
    expect(d.draft).toBe(false);
    expect(d.sections[0].blocks[0]).toEqual({ kind: 'para', text: 'Hire a generator.' });
    expect(d.decision).toMatchObject({ outcomeLabel: 'APPROVED WITH CONDITIONS', signedByName: 'Grace Admin', signedNameTyped: 'Grace' });
    expect(d.decision?.conditions).toEqual([{ kind: 'para', text: 'Four weeks only.' }]);
    expect(d.distribution[0].acknowledged).toMatch(/28 Oct 2026/);
    expect(d.contentHash).toBe('abc123');
    expect(d.title).toBe('MEMO-ZTA-2026-001 — Generator hire');
  });

  it('filenames and the group issuer', () => {
    expect(buildMemoFilename(base)).toBe('MEMO-ZTA-2026-001-v1-Generator-hire.pdf');
    expect(buildMemoFilename({ subject: 'Draft: thing?', version: 0 })).toBe('DRAFT-memo-Draft-thing.pdf');
    expect(resolveMemoIssuer('zeus-group')).toEqual({ name: 'Zeus Group', groupLine: undefined });
    expect(resolveMemoIssuer('nope').name).toBe('Zeus Group');
  });
});
