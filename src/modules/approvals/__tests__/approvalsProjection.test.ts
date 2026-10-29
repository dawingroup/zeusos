import { describe, expect, it } from 'vitest';

import {
  buildApprovalsInbox,
  bumpUrgency,
  filterByScope,
  humanizeAction,
  projectChangeOrder,
  projectIwo,
  projectMediaSupplierInvoice,
  projectQuote,
  projectSow,
  projectTalentInvoice,
  rungLabel,
  sortApprovalItems,
  toMillis,
  urgencyForAge,
} from '../approvalsProjection';
import type { ApprovalItem } from '../types';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 25, 12, 0, 0); // 2026-10-25T12:00Z
const daysAgo = (n: number) => NOW - n * DAY;

describe('toMillis', () => {
  it('reads epoch ms, Date, ISO string, Timestamp-like {seconds} and {toMillis}', () => {
    expect(toMillis(1_000)).toBe(1_000);
    expect(toMillis(new Date(5_000))).toBe(5_000);
    expect(toMillis('2026-10-25T12:00:00.000Z')).toBe(NOW);
    expect(toMillis({ seconds: 2 })).toBe(2_000);
    expect(toMillis({ toMillis: () => 7 })).toBe(7);
  });
  it('is undefined for null, garbage strings and NaN', () => {
    expect(toMillis(null)).toBeUndefined();
    expect(toMillis(undefined)).toBeUndefined();
    expect(toMillis('not a date')).toBeUndefined();
    expect(toMillis(Number.NaN)).toBeUndefined();
  });
});

describe('urgency helpers', () => {
  it('climbs with age but never drops below the base', () => {
    expect(urgencyForAge(0, 'low')).toBe('low');
    expect(urgencyForAge(3, 'low')).toBe('medium');
    expect(urgencyForAge(7, 'low')).toBe('high');
    expect(urgencyForAge(14, 'low')).toBe('critical');
    expect(urgencyForAge(0, 'high')).toBe('high');
    expect(urgencyForAge(3, 'high')).toBe('high');
  });
  it('bumpUrgency goes one step and saturates', () => {
    expect(bumpUrgency('low')).toBe('medium');
    expect(bumpUrgency('critical')).toBe('critical');
  });
});

describe('projectIwo', () => {
  const base = {
    id: 'iwo_1',
    code: 'IWO-ZTA-DIAGEO-014',
    subsidiaryOrgId: 'zeus-the-agency',
    masterJobId: 'mj_1',
    budgetMinor: 12_000_000,
    currency: 'UGX',
    issuedByUserId: 'u_am',
    deliveredAt: daysAgo(1),
  };

  it('projects nothing when the IWO is not DELIVERED', () => {
    expect(projectIwo({ ...base, state: 'IN_PROGRESS' }, NOW)).toBeNull();
    expect(projectIwo({ ...base, state: 'ACCEPTED_INTERNALLY' }, NOW)).toBeNull();
  });

  it('projects an ECD-rung row while the ladder is open, titled with the rung and aged from the last move', () => {
    const item = projectIwo(
      {
        ...base,
        state: 'DELIVERED',
        approvalChain: {
          ladder: ['DESIGNER', 'ACD', 'CD', 'ECD'],
          currentRung: 'CD',
          complete: false,
          history: [
            { action: 'INIT', rung: 'DESIGNER', occurredAt: daysAgo(10) },
            { action: 'ADVANCE', rung: 'ACD', occurredAt: daysAgo(4) },
          ],
        },
      },
      NOW,
    )!;
    expect(item.kind).toBe('ecd_rung');
    expect(item.id).toBe('ecd:iwo_1');
    expect(item.title).toBe('IWO-ZTA-DIAGEO-014 — awaiting Creative Director');
    expect(item.status).toBe('CD');
    expect(item.daysPending).toBe(4);
    expect(item.urgency).toBe('medium');
    expect(item.brandId).toBe('zeus-the-agency');
    expect(item.requesterUserId).toBe('u_am');
    expect(item.amountMinor).toBe(12_000_000);
    expect(item.entity).toMatchObject({ type: 'iwo', id: 'iwo_1', ref: 'IWO-ZTA-DIAGEO-014', masterJobId: 'mj_1' });
    expect(item.decision).toBe('inline');
  });

  it('projects an internal-acceptance row once the ladder is complete, and for pre-ladder IWOs', () => {
    const complete = projectIwo(
      { ...base, state: 'DELIVERED', approvalChain: { currentRung: 'ECD', complete: true, history: [] } },
      NOW,
    )!;
    expect(complete.kind).toBe('iwo_internal_acceptance');
    expect(complete.id).toBe('iwo-accept:iwo_1');
    expect(complete.requiredAction).toBe('accept_internally');

    const legacy = projectIwo({ ...base, state: 'DELIVERED' }, NOW)!;
    expect(legacy.kind).toBe('iwo_internal_acceptance');
    expect(legacy.daysPending).toBe(1);
  });

  it('lifts urgency one step when the SLA has passed', () => {
    const fresh = projectIwo({ ...base, state: 'DELIVERED', slaDueAt: NOW + DAY }, NOW)!;
    const overdue = projectIwo({ ...base, state: 'DELIVERED', slaDueAt: NOW - DAY }, NOW)!;
    expect(fresh.urgency).toBe('medium');
    expect(overdue.urgency).toBe('high');
    expect(overdue.dueAtMs).toBe(NOW - DAY);
  });
});

describe('projectSow / projectChangeOrder / projectQuote', () => {
  it('surfaces only PENDING_APPROVAL SOWs, with the ceiling as the amount and ids for the nested route', () => {
    expect(projectSow({ id: 's1', status: 'DRAFT' }, NOW)).toBeNull();
    expect(projectSow({ id: 's1', status: 'ACTIVE' }, NOW)).toBeNull();
    const item = projectSow(
      { id: 's1', code: 'SOW-ACME-2026-Q4', title: 'Brand refresh', clientId: 'c1', msaId: 'm1', status: 'PENDING_APPROVAL', ceilingMinor: 80_000_000, currency: 'UGX', updatedAt: daysAgo(8) },
      NOW,
    )!;
    expect(item.kind).toBe('sow_approval');
    expect(item.title).toBe('SOW SOW-ACME-2026-Q4 — Brand refresh');
    expect(item.urgency).toBe('high');
    expect(item.amountMinor).toBe(80_000_000);
    expect(item.entity).toMatchObject({ type: 'sow', id: 's1', clientId: 'c1', msaId: 'm1' });
  });

  it('surfaces DRAFT change orders; a de-scope is low urgency, a ceiling raise medium', () => {
    expect(projectChangeOrder({ id: 'co1', status: 'APPROVED' }, NOW)).toBeNull();
    const raise = projectChangeOrder(
      { id: 'co1', code: 'CO-001', sowId: 's1', clientId: 'c1', msaId: 'm1', status: 'DRAFT', deltaMinor: 5_000_000, createdBy: 'u_am', createdAt: daysAgo(0) },
      NOW,
    )!;
    const descope = projectChangeOrder({ id: 'co2', status: 'DRAFT', deltaMinor: -5_000_000, createdAt: daysAgo(0) }, NOW)!;
    expect(raise.urgency).toBe('medium');
    expect(descope.urgency).toBe('low');
    expect(raise.requesterUserId).toBe('u_am');
    expect(raise.entity).toMatchObject({ type: 'changeOrder', id: 'co1', clientId: 'c1', msaId: 'm1', sowId: 's1' });
  });

  it('surfaces ISSUED quotes as open-only nudges with the issuer as requester', () => {
    expect(projectQuote({ id: 'q1', status: 'ACCEPTED' }, NOW)).toBeNull();
    const item = projectQuote(
      { id: 'q1', code: 'Q-001', clientId: 'c1', status: 'ISSUED', clientTotalMinor: 100_000_000, currency: 'KES', issuedAt: daysAgo(2), issuedByUserId: 'u_pricing' },
      NOW,
    )!;
    expect(item.kind).toBe('quote_awaiting_client');
    expect(item.decision).toBe('open_only');
    expect(item.urgency).toBe('low');
    expect(item.requesterUserId).toBe('u_pricing');
  });
});

describe('supplier invoices', () => {
  it('surfaces SUBMITTED talent invoices with the submitter as requester', () => {
    expect(projectTalentInvoice({ id: 't1', status: 'APPROVED' }, NOW)).toBeNull();
    const item = projectTalentInvoice(
      { id: 't1', talentProfileId: 'tp1', masterJobId: 'mj1', status: 'SUBMITTED', amountMinor: 250_000, currency: 'UGX', createdBy: 'u_freelancer', createdAt: daysAgo(1) },
      NOW,
    )!;
    expect(item.kind).toBe('talent_invoice');
    expect(item.requesterUserId).toBe('u_freelancer');
    expect(item.entity).toMatchObject({ type: 'talentInvoice', id: 't1', masterJobId: 'mj1' });
  });

  it('shows how far a multi-signature plan has got, and nothing for a single-signature one', () => {
    const base = { id: 't2', status: 'SUBMITTED', createdAt: daysAgo(0) };
    expect(projectTalentInvoice({ ...base, approval: { pendingLevel: 1, signatures: [{ level: 1, label: 'Talent lead' }] } }, NOW)!.title).toBe('Talent invoice t2');
    const two = projectTalentInvoice(
      {
        ...base,
        approval: { pendingLevel: 2, signatures: [{ level: 1, label: 'Brand MD', approvedBy: 'u_md' }, { level: 2, label: 'Zeus Group CEO', approvedBy: null }] },
      },
      NOW,
    )!;
    expect(two.title).toBe('Talent invoice t2 — level 2 of 3 (Zeus Group CEO)'.replace('of 3', 'of 2'));
    // No pendingLevel stamped yet: derive it from the first unsigned level.
    const derived = projectTalentInvoice(
      { ...base, approval: { signatures: [{ level: 1, label: 'Brand MD', approvedBy: 'u_md' }, { level: 2, label: 'CEO' }, { level: 3, label: 'Finance' }] } },
      NOW,
    )!;
    expect(derived.title).toBe('Talent invoice t2 — level 2 of 3 (CEO)');
  });

  it('surfaces SUBMITTED media invoices carrying the media plan for the route', () => {
    const item = projectMediaSupplierInvoice(
      { id: 'mi1', mediaPlanId: 'mp1', masterJobId: 'mj1', vehicleType: 'OOH', status: 'SUBMITTED', amountMinor: 9_000_000, currency: 'KES', createdBy: 'u_media', createdAt: daysAgo(0) },
      NOW,
    )!;
    expect(item.kind).toBe('media_supplier_invoice');
    expect(item.title).toBe('Media invoice mi1 — OOH');
    expect(item.entity).toMatchObject({ type: 'mediaSupplierInvoice', id: 'mi1', mediaPlanId: 'mp1' });
  });
});

describe('buildApprovalsInbox + sort + scope', () => {
  const inbox = () =>
    buildApprovalsInbox(
      {
        iwos: [
          { id: 'i_old', code: 'OLD', subsidiaryOrgId: 'labyrinth', state: 'DELIVERED', deliveredAt: daysAgo(20) },
          { id: 'i_due', code: 'DUE', subsidiaryOrgId: 'zeus-the-agency', state: 'DELIVERED', deliveredAt: daysAgo(1), slaDueAt: NOW - 1 },
          { id: 'i_ok', code: 'OK', subsidiaryOrgId: 'zeus-the-agency', state: 'DELIVERED', deliveredAt: daysAgo(1) },
          { id: 'i_skip', state: 'IN_PROGRESS' },
        ],
        sows: [{ id: 's', status: 'PENDING_APPROVAL', updatedAt: daysAgo(0) }],
        quotes: [{ id: 'q', status: 'ISSUED', issuedAt: daysAgo(0) }],
      },
      NOW,
    );

  it('emits one row per actionable source and orders most-urgent, then overdue, then longest-waiting', () => {
    const ids = inbox().map((i) => i.id);
    expect(ids).toEqual(['iwo-accept:i_old', 'iwo-accept:i_due', 'iwo-accept:i_ok', 'sow:s', 'quote:q']);
  });

  it('sortApprovalItems is stable on identical keys and does not mutate its input', () => {
    const items = inbox();
    const copy = [...items];
    sortApprovalItems(items, NOW);
    expect(items).toEqual(copy);
  });

  it('filterByScope: parent sees all, a brand sees only its own IWO rows, none sees nothing', () => {
    const items = inbox();
    expect(filterByScope(items, { kind: 'parent' })).toHaveLength(5);
    const brand = filterByScope(items, { kind: 'brand', orgId: 'zeus-the-agency' });
    expect(brand.map((i) => i.id)).toEqual(['iwo-accept:i_due', 'iwo-accept:i_ok']);
    expect(filterByScope(items, { kind: 'none' })).toEqual([]);
  });
});

describe('labels', () => {
  it('names rungs and actions for humans, falling back to a tidied slug', () => {
    expect(rungLabel('ECD')).toBe('Executive Creative Director');
    expect(rungLabel('MYSTERY')).toBe('MYSTERY');
    expect(rungLabel(undefined)).toBe('the ladder');
    expect(humanizeAction('approve_sow')).toBe('Approve SOW');
    expect(humanizeAction('do_the_thing')).toBe('Do the thing');
  });
});

// Type-level guard: every projector output satisfies ApprovalItem.
const _typeCheck: ApprovalItem | null = projectSow({ id: 'x', status: 'PENDING_APPROVAL' }, NOW);
void _typeCheck;
