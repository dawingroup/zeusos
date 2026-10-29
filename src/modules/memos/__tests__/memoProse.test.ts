import { describe, expect, it } from 'vitest';
import { memoWordCount, proseToBlocks, sectionsToPlainText } from '../utils/memoProse';
import { memoDraftDeletion, isUnsubmittedDraft } from '../utils/memoDeletion';
import { memoNewUrlForRecord, parseMemoPrefill } from '../utils/memoPrefill';
import { resolveMemoActor } from '../utils/memoActor';

describe('proseToBlocks', () => {
  it('splits paragraphs on blank lines, lists on "- " / "1. ", sub-heads on "## "', () => {
    const blocks = proseToBlocks('Purpose line one\nstill the same paragraph.\n\n## Options\n- first\n- second\n  continued\n\n1. one\n2) two\n\nTail.');
    expect(blocks).toEqual([
      { kind: 'para', text: 'Purpose line one still the same paragraph.' },
      { kind: 'sub', text: 'Options' },
      { kind: 'list', ordered: false, items: ['first', 'second continued'] },
      { kind: 'list', ordered: true, items: ['one', 'two'] },
      { kind: 'para', text: 'Tail.' },
    ]);
    expect(proseToBlocks('')).toEqual([]);
    expect(proseToBlocks(null)).toEqual([]);
  });

  it('plain text and word count skip disabled and empty sections', () => {
    const sections = [
      { key: 'purpose', heading: 'Purpose', content: 'Hire a generator.', enabled: true },
      { key: 'risks', heading: 'Risks', content: 'Rain.', enabled: false },
      { key: 'impact', heading: 'Impact', content: '   ', enabled: true },
    ];
    expect(sectionsToPlainText(sections)).toBe('PURPOSE\nHire a generator.');
    expect(memoWordCount(sections)).toBe(4);
  });
});

describe('memoDraftDeletion', () => {
  const draft = { status: 'draft' as const, createdBy: 'a', version: 0 };
  it('the author deletes an unsubmitted draft; a numbered one is withdrawn or left to an admin', () => {
    expect(isUnsubmittedDraft(draft)).toBe(true);
    expect(memoDraftDeletion(draft, 'a', false).allowed).toBe(true);
    expect(memoDraftDeletion(draft, 'b', false).allowed).toBe(false);
    expect(memoDraftDeletion({ ...draft, memoNumber: 'MEMO-ZTA-2026-001', version: 1 }, 'a', false).allowed).toBe(false);
    expect(memoDraftDeletion({ ...draft, memoNumber: 'MEMO-ZTA-2026-001', version: 1 }, 'b', true).allowed).toBe(true);
    expect(memoDraftDeletion({ ...draft, status: 'submitted' }, 'a', true).allowed).toBe(false);
  });
});

describe('memoPrefill', () => {
  it('round-trips a record link and refuses an unknown type or relation', () => {
    const url = memoNewUrlForRecord({ type: 'iwo', id: 'iwo-42', label: 'IWO-ZTA-014', relation: 'authorises', memoType: 'request', category: 'finance', subject: 'Extra shoot day' });
    const sp = new URL(`https://x${url}`).searchParams;
    expect(parseMemoPrefill(sp)).toEqual({
      link: { type: 'iwo', id: 'iwo-42', label: 'IWO-ZTA-014', relation: 'authorises' },
      memoType: 'request',
      category: 'finance',
      subject: 'Extra shoot day',
    });
    expect(parseMemoPrefill(new URLSearchParams('link=dragon:1'))).toBeNull();
    expect(parseMemoPrefill(new URLSearchParams('link=sow:s1&clientId=c1&msaId=m1&relation=nonsense'))?.link).toEqual({ type: 'sow', id: 's1', label: 's1', relation: 'context', clientId: 'c1', msaId: 'm1' });
  });
});

describe('resolveMemoActor', () => {
  it('identity is the auth uid; the profile supplies the name and the role', () => {
    expect(resolveMemoActor(null)).toEqual({ actor: null, isAdmin: false });
    expect(resolveMemoActor({ uid: 'u1', email: 'a@zeus.co.ke' }, { displayName: 'Amina', globalRole: 'admin' })).toEqual({ actor: { uid: 'u1', name: 'Amina', email: 'a@zeus.co.ke' }, isAdmin: true });
    expect(resolveMemoActor({ uid: 'u1', displayName: 'A. Author' }, null)).toEqual({ actor: { uid: 'u1', name: 'A. Author' }, isAdmin: false });
  });
});
