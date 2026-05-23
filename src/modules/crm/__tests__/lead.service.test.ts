/**
 * Unit tests — CRM lead service (Phase 4).
 *
 * Covers:
 *   - createLead required-field + probability validation
 *   - allowedNextStages / isValidStageTransition
 *   - changeLeadStage transition guards
 *     - LOST requires reason
 *     - WON is terminal
 *     - LOST → PROSPECT clears closedAt/lostReason
 *   - logActivity required fields + lead doc touch
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

const store = new Map<string, Record<string, unknown>>();

vi.mock('firebase/firestore', () => {
  const makeRef = (path: string, id?: string) => ({
    __path: path,
    __id: id ?? `auto-${Math.random().toString(36).slice(2, 8)}`,
  });

  return {
    collection: vi.fn((_db: unknown, ...segments: string[]) => ({
      __path: segments.join('/'),
    })),
    doc: vi.fn((...args: unknown[]) => {
      if (args.length >= 3) {
        const segments = args.slice(1).filter((a) => typeof a === 'string') as string[];
        return makeRef(segments.slice(0, -1).join('/'), segments[segments.length - 1]);
      }
      const parent = args[0] as { __path: string };
      return makeRef(parent.__path);
    }),
    addDoc: vi.fn(async (col: { __path: string }, data: Record<string, unknown>) => {
      const ref = makeRef(col.__path);
      const key = `${ref.__path}/${ref.__id}`;
      store.set(key, { ...data });
      // Match by id alone too so getDoc lookups by id work
      store.set(ref.__id, { ...data });
      return ref;
    }),
    getDoc: vi.fn(async (ref: { __id: string }) => {
      const data = store.get(ref.__id);
      return {
        exists: () => data !== undefined,
        id: ref.__id,
        data: () => (data ? { ...data } : undefined),
      };
    }),
    getDocs: vi.fn(async (col: { __path?: string } | undefined) => {
      const prefix = col?.__path ? `${col.__path}/` : '';
      const docs = Array.from(store.entries())
        .filter(([id]) => prefix ? id.startsWith(prefix) : !id.includes('/'))
        .map(([id, data]) => ({
          id: id.includes('/') ? id.split('/').pop()! : id,
          data: () => ({ ...data }),
        }));
      return { docs };
    }),
    updateDoc: vi.fn(async (ref: { __id: string }, patch: Record<string, unknown>) => {
      const existing = store.get(ref.__id);
      if (!existing) throw new Error('not found');
      store.set(ref.__id, { ...existing, ...patch });
    }),
    query: vi.fn((col: unknown) => col),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => '__SERVER_TS__'),
  };
});

import {
  createLead,
  getLead,
  changeLeadStage,
  logActivity,
  isValidStageTransition,
  allowedNextStages,
} from '../services/lead.service';

beforeEach(() => {
  store.clear();
});

describe('createLead', () => {
  it('creates a lead in PROSPECT by default', async () => {
    const l = await createLead({
      name: 'Acme Beverages Ltd',
      source: 'INBOUND',
      currency: 'UGX',
      orgId: 'org-default',
      createdBy: 'u1',
    });
    expect(l.stage).toBe('PROSPECT');
    expect(l.name).toBe('Acme Beverages Ltd');
  });

  it('rejects missing name', async () => {
    await expect(
      createLead({
        name: '  ',
        source: 'INBOUND',
        currency: 'UGX',
        orgId: 'org-default',
        createdBy: 'u1',
      }),
    ).rejects.toThrow(/name is required/);
  });

  it('rejects missing orgId', async () => {
    await expect(
      createLead({
        name: 'X',
        source: 'INBOUND',
        currency: 'UGX',
        orgId: '',
        createdBy: 'u1',
      }),
    ).rejects.toThrow(/orgId is required/);
  });

  it('rejects probability outside 0..1', async () => {
    await expect(
      createLead({
        name: 'X',
        source: 'INBOUND',
        currency: 'UGX',
        orgId: 'org-default',
        probability: 1.5,
        createdBy: 'u1',
      }),
    ).rejects.toThrow(/probability must be between 0 and 1/);
  });
});

describe('stage transition rules', () => {
  it('allows PROSPECT → QUALIFIED', () => {
    expect(isValidStageTransition('PROSPECT', 'QUALIFIED')).toBe(true);
  });

  it('blocks PROSPECT → WON (must go through PITCH)', () => {
    expect(isValidStageTransition('PROSPECT', 'WON')).toBe(false);
  });

  it('blocks PROSPECT → PROSPECT (no-op self-transition)', () => {
    expect(isValidStageTransition('PROSPECT', 'PROSPECT')).toBe(false);
  });

  it('allows PITCH → WON or LOST', () => {
    expect(isValidStageTransition('PITCH', 'WON')).toBe(true);
    expect(isValidStageTransition('PITCH', 'LOST')).toBe(true);
  });

  it('WON is terminal (no allowed next stages)', () => {
    expect(allowedNextStages('WON')).toEqual([]);
  });

  it('LOST can be re-opened to PROSPECT', () => {
    expect(allowedNextStages('LOST')).toContain('PROSPECT');
  });
});

describe('changeLeadStage', () => {
  it('moves a lead through PROSPECT → QUALIFIED → PITCH → WON', async () => {
    const l = await createLead({
      name: 'Pipeline test',
      source: 'OUTBOUND',
      currency: 'UGX',
      orgId: 'org-default',
      createdBy: 'u1',
    });
    await changeLeadStage(l.id, 'QUALIFIED', 'u1');
    await changeLeadStage(l.id, 'PITCH', 'u1');
    await changeLeadStage(l.id, 'WON', 'u1', { convertedClientId: 'client-XYZ' });

    const after = await getLead(l.id);
    expect(after?.stage).toBe('WON');
    expect(after?.convertedClientId).toBe('client-XYZ');
    expect(after?.closedAt).toBeDefined();
  });

  it('rejects illegal transitions', async () => {
    const l = await createLead({
      name: 'X',
      source: 'INBOUND',
      currency: 'UGX',
      orgId: 'org-default',
      createdBy: 'u1',
    });
    await expect(changeLeadStage(l.id, 'WON', 'u1')).rejects.toThrow(/illegal stage transition/);
  });

  it('requires lostReason when moving to LOST', async () => {
    const l = await createLead({
      name: 'X',
      source: 'INBOUND',
      currency: 'UGX',
      orgId: 'org-default',
      createdBy: 'u1',
    });
    await expect(changeLeadStage(l.id, 'LOST', 'u1')).rejects.toThrow(/lostReason is required/);
    await expect(changeLeadStage(l.id, 'LOST', 'u1', { lostReason: '   ' })).rejects.toThrow(
      /lostReason is required/,
    );
  });

  it('records lostReason on LOST', async () => {
    const l = await createLead({
      name: 'X',
      source: 'INBOUND',
      currency: 'UGX',
      orgId: 'org-default',
      createdBy: 'u1',
    });
    await changeLeadStage(l.id, 'LOST', 'u1', { lostReason: 'Budget canceled' });
    const after = await getLead(l.id);
    expect(after?.stage).toBe('LOST');
    expect(after?.lostReason).toBe('Budget canceled');
    expect(after?.closedAt).toBeDefined();
  });

  it('clears closedAt and lostReason on LOST → PROSPECT re-open', async () => {
    const l = await createLead({
      name: 'X',
      source: 'INBOUND',
      currency: 'UGX',
      orgId: 'org-default',
      createdBy: 'u1',
    });
    await changeLeadStage(l.id, 'LOST', 'u1', { lostReason: 'Budget' });
    await changeLeadStage(l.id, 'PROSPECT', 'u1');
    const after = await getLead(l.id);
    expect(after?.stage).toBe('PROSPECT');
    expect(after?.closedAt).toBeNull();
    expect(after?.lostReason).toBeNull();
  });

  it('rejects ANY transition out of WON (terminal)', async () => {
    const l = await createLead({
      name: 'X',
      source: 'INBOUND',
      currency: 'UGX',
      orgId: 'org-default',
      createdBy: 'u1',
    });
    await changeLeadStage(l.id, 'QUALIFIED', 'u1');
    await changeLeadStage(l.id, 'PITCH', 'u1');
    await changeLeadStage(l.id, 'WON', 'u1');
    for (const next of ['PROSPECT', 'QUALIFIED', 'PITCH', 'LOST'] as const) {
      await expect(changeLeadStage(l.id, next, 'u1')).rejects.toThrow(/illegal stage transition/);
    }
  });
});

describe('logActivity', () => {
  it('rejects missing kind/summary/performedBy', async () => {
    const l = await createLead({
      name: 'X', source: 'INBOUND', currency: 'UGX', orgId: 'org-default', createdBy: 'u1',
    });
    // @ts-expect-error — intentionally missing kind
    await expect(logActivity(l.id, { summary: 'x', performedBy: 'u1' })).rejects.toThrow(/kind is required/);
    await expect(
      // @ts-expect-error — intentionally missing performedBy
      logActivity(l.id, { kind: 'NOTE', summary: 'x' }),
    ).rejects.toThrow(/performedBy is required/);
    await expect(
      logActivity(l.id, { kind: 'NOTE', summary: '   ', performedBy: 'u1' }),
    ).rejects.toThrow(/summary is required/);
  });

  it('records a NOTE activity', async () => {
    const l = await createLead({
      name: 'X', source: 'INBOUND', currency: 'UGX', orgId: 'org-default', createdBy: 'u1',
    });
    const a = await logActivity(l.id, {
      kind: 'NOTE',
      summary: 'First contact via referral',
      performedBy: 'u1',
    });
    expect(a.kind).toBe('NOTE');
    expect(a.summary).toBe('First contact via referral');
  });
});
