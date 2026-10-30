/**
 * Memo vocabulary: labels, hints, brand codes for numbering, and the section
 * template each memo type starts from. The templates encode the anatomy of
 * a decision-quality memo (purpose → background → options → impact → risks →
 * recommendation → implementation). Keys are stable so a section keeps its
 * identity across edits and resubmits.
 *
 * Mirror of functions/src/memos/lib/memoModel.js — pinned by
 * __tests__/memoLockstep.test.ts (required keys per type, brand codes).
 */

import { FUNCTIONAL_CURRENCY } from '@/shared/constants/functionalCurrency';
import type { MemoCategory, MemoImpact, MemoSection, MemoStatus, MemoType } from '../types/memo';

export const MEMO_TYPES: MemoType[] = ['decision', 'request', 'information', 'directive', 'record'];
export const MEMO_CATEGORIES: MemoCategory[] = ['finance', 'admin', 'operations'];
export const MEMO_IMPACTS: MemoImpact[] = ['low', 'medium', 'high'];

export const MEMO_TYPE_LABELS: Record<MemoType, string> = {
  decision: 'Decision memo',
  request: 'Request / justification',
  information: 'Information memo',
  directive: 'Directive / policy notice',
  record: 'Memo for record',
};

export const MEMO_TYPE_HINTS: Record<MemoType, string> = {
  decision: 'Asks a named authority to decide. Ends with a signed Approve / Decline / Modify block.',
  request: 'Justifies a spend, exception, hire or permission. Approved against the tier its amount, impact and type call for.',
  information: 'Briefs recipients. No decision is requested and no approval is needed.',
  directive: 'Instructs staff or announces a policy. Needs a brand MD or above; recipients acknowledge it.',
  record: 'Records a verbal agreement, meeting or decision already taken. Filed and numbered; no approval.',
};

export const MEMO_CATEGORY_LABELS: Record<MemoCategory, string> = {
  finance: 'Finance',
  admin: 'Administrative',
  operations: 'Operations',
};

export const MEMO_IMPACT_LABELS: Record<MemoImpact, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export const MEMO_IMPACT_HINTS: Record<MemoImpact, string> = {
  low: 'Routine; reversible; affects one team.',
  medium: 'Commits the brand for a period, or affects several teams or a client.',
  high: 'Hard to reverse, strategic, legal, or affects people’s employment or the group’s reputation.',
};

export const MEMO_STATUS_LABELS: Record<MemoStatus, string> = {
  draft: 'Draft',
  submitted: 'On its route',
  approved: 'Approved',
  rejected: 'Not approved',
  modified: 'Approved with conditions',
  issued: 'Issued',
  superseded: 'Superseded',
  withdrawn: 'Withdrawn',
};

/** Brand code in the memo number, keyed by the canonical SubsidiaryId. */
export const MEMO_SUBSIDIARY_CODES: Record<string, string> = {
  'zeus-group': 'GRP',
  'zeus-the-agency': 'ZTA',
  'zeus-digital': 'ZDG',
  labyrinth: 'LAB',
  'odd-gorilla': 'OGR',
  'house-of-zeus': 'HOZ',
};

export const DEFAULT_MEMO_CURRENCY = FUNCTIONAL_CURRENCY;
export const MEMO_CURRENCIES = Array.from(new Set([FUNCTIONAL_CURRENCY, 'KES', 'UGX', 'TZS', 'RWF', 'USD', 'EUR', 'GBP']));

export interface MemoSectionTemplate {
  key: string;
  heading: string;
  /** Shown to the author under the heading; never printed. */
  hint: string;
  /** A required section cannot be disabled and must have content to submit. */
  required: boolean;
}

const PURPOSE: MemoSectionTemplate = {
  key: 'purpose',
  heading: 'Purpose',
  hint: 'One or two sentences: what is being asked, of whom, and by when. Lead with the ask.',
  required: true,
};
const BACKGROUND: MemoSectionTemplate = {
  key: 'background',
  heading: 'Background',
  hint: 'Only what the reader does not already know. State the assumptions that frame the memo.',
  required: false,
};
const OPTIONS: MemoSectionTemplate = {
  key: 'options',
  heading: 'Options considered',
  hint: 'Two or three real options on comparable dimensions: cost, timing, risk, reversibility, who is affected.',
  required: false,
};
const IMPACT: MemoSectionTemplate = {
  key: 'impact',
  heading: 'Financial & operational impact',
  hint: 'Amounts, budget line, cash timing, headcount, capacity. Numbers, not adjectives.',
  required: false,
};
const RISKS: MemoSectionTemplate = {
  key: 'risks',
  heading: 'Risks & mitigations',
  hint: 'The top three things that could go wrong, and what is done about each.',
  required: false,
};
const RECOMMENDATION: MemoSectionTemplate = {
  key: 'recommendation',
  heading: 'Recommendation',
  hint: 'State it plainly. Bound the scope: exactly what is being approved, and what is not.',
  required: true,
};
const IMPLEMENTATION: MemoSectionTemplate = {
  key: 'implementation',
  heading: 'Implementation & follow-up',
  hint: 'Owner, milestones, what triggers a return to the approver.',
  required: false,
};

export const MEMO_SECTION_TEMPLATES: Record<MemoType, MemoSectionTemplate[]> = {
  decision: [PURPOSE, BACKGROUND, OPTIONS, IMPACT, RISKS, RECOMMENDATION, IMPLEMENTATION],
  request: [
    PURPOSE,
    { ...BACKGROUND, heading: 'Justification', hint: 'Why this, why now, and what happens if it is not approved.' },
    OPTIONS,
    IMPACT,
    RISKS,
    { ...RECOMMENDATION, heading: 'Request', hint: 'Exactly what is requested: amount, scope, period, conditions you propose.' },
    IMPLEMENTATION,
  ],
  information: [
    PURPOSE,
    BACKGROUND,
    { key: 'details', heading: 'Details', hint: 'The substance. Sub-heads and bullets help the reader skim.', required: true },
    { key: 'next_steps', heading: 'Next steps', hint: 'What, if anything, the reader should do.', required: false },
  ],
  directive: [
    PURPOSE,
    { key: 'policy', heading: 'Policy / instruction', hint: 'The instruction itself, in numbered points where possible.', required: true },
    { key: 'effective_date', heading: 'Effective date & scope', hint: 'From when, for whom, and what it replaces.', required: true },
    { key: 'compliance', heading: 'Compliance & exceptions', hint: 'How compliance is checked; who may grant an exception and how.', required: false },
  ],
  record: [
    PURPOSE,
    { key: 'record', heading: 'Record', hint: 'Who agreed what, when, and any conditions. Dates and names.', required: true },
    { key: 'follow_up', heading: 'Follow-up', hint: 'Actions arising, with owners.', required: false },
  ],
};

/** Fresh, empty sections for a memo type. */
export function sectionsForType(type: MemoType): MemoSection[] {
  return MEMO_SECTION_TEMPLATES[type].map((t) => ({ key: t.key, heading: t.heading, content: '', enabled: true }));
}

/**
 * Carry authored content across a type change: sections whose key exists in
 * the new template keep their text; the rest are appended disabled so
 * nothing the author wrote is silently lost.
 */
export function retargetSections(existing: MemoSection[], type: MemoType): MemoSection[] {
  const template = MEMO_SECTION_TEMPLATES[type];
  const byKey = new Map(existing.map((s) => [s.key, s]));
  const next: MemoSection[] = template.map((t) => {
    const prior = byKey.get(t.key);
    return { key: t.key, heading: t.heading, content: prior?.content ?? '', enabled: prior ? prior.enabled : true };
  });
  const templateKeys = new Set(template.map((t) => t.key));
  for (const s of existing) {
    if (!templateKeys.has(s.key) && s.content.trim()) next.push({ ...s, enabled: false });
  }
  return next;
}

export function templateFor(type: MemoType, key: string): MemoSectionTemplate | undefined {
  return MEMO_SECTION_TEMPLATES[type].find((t) => t.key === key);
}

/** Required section keys per type — the callable refuses a submit without them. */
export function requiredSectionKeys(type: MemoType): string[] {
  return MEMO_SECTION_TEMPLATES[type].filter((t) => t.required).map((t) => t.key);
}

/** Headings of the required sections still empty or switched off. */
export function missingRequiredSections(type: MemoType, sections: MemoSection[]): string[] {
  return MEMO_SECTION_TEMPLATES[type]
    .filter((t) => t.required)
    .filter((t) => {
      const s = sections.find((x) => x.key === t.key);
      return !s || !s.enabled || !s.content.trim();
    })
    .map((t) => t.heading);
}
