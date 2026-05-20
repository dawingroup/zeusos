import { describe, it, expect } from 'vitest';
import {
  deriveQuoteCommercialSignal,
  projectHasSalesOrder,
  resolveHasSalesOrderSet,
} from '../projectCommercialSignals';
import type { ClientQuote } from '../../types/clientPortal';
import type { DesignProject } from '../../types';

const baseQuote = (over: Partial<ClientQuote>): ClientQuote => ({
  id: 'q1',
  projectId: 'p1',
  projectCode: 'PC',
  projectName: 'PN',
  customerId: 'c1',
  customerName: 'CN',
  quoteNumber: 'QT-1',
  title: 'T',
  lineItems: [],
  procurementItems: [],
  subtotal: 0,
  taxRate: 0,
  taxAmount: 0,
  total: 0,
  currency: 'USD',
  validUntil: { seconds: 0, nanoseconds: 0 } as any,
  accessToken: 'tok',
  version: 1,
  status: 'draft',
  createdAt: { seconds: 0, nanoseconds: 0 } as any,
  createdBy: 'u',
  ...over,
} as ClientQuote);

describe('deriveQuoteCommercialSignal', () => {
  it('returns none for null', () => {
    expect(deriveQuoteCommercialSignal(null)).toBe('none');
  });

  it('classifies draft', () => {
    expect(deriveQuoteCommercialSignal(baseQuote({ status: 'draft' }))).toBe('draft');
  });

  it('classifies with_client for sent / viewed / revision', () => {
    expect(deriveQuoteCommercialSignal(baseQuote({ status: 'sent' }))).toBe('with_client');
    expect(deriveQuoteCommercialSignal(baseQuote({ status: 'viewed' }))).toBe('with_client');
    expect(deriveQuoteCommercialSignal(baseQuote({ status: 'revision' }))).toBe('with_client');
  });

  it('classifies declined', () => {
    expect(deriveQuoteCommercialSignal(baseQuote({ status: 'rejected' }))).toBe('declined');
    expect(deriveQuoteCommercialSignal(baseQuote({ status: 'expired' }))).toBe('declined');
  });

  it('approved with no line approval fields is full_approval', () => {
    const q = baseQuote({
      status: 'approved',
      lineItems: [
        { id: '1', description: 'a', category: 'material', quantity: 1, unit: 'ea', unitPrice: 1, totalPrice: 1 },
      ],
    });
    expect(deriveQuoteCommercialSignal(q)).toBe('full_approval');
  });

  it('approved with all lines approved is full_approval', () => {
    const q = baseQuote({
      status: 'approved',
      lineItems: [
        { id: '1', description: 'a', category: 'material', quantity: 1, unit: 'ea', unitPrice: 1, totalPrice: 1, approvalStatus: 'approved' },
        { id: '2', description: 'b', category: 'material', quantity: 1, unit: 'ea', unitPrice: 1, totalPrice: 1, approvalStatus: 'approved' },
      ],
    });
    expect(deriveQuoteCommercialSignal(q)).toBe('full_approval');
  });

  it('approved with some lines approved is partial_lines', () => {
    const q = baseQuote({
      status: 'approved',
      lineItems: [
        { id: '1', description: 'a', category: 'material', quantity: 1, unit: 'ea', unitPrice: 1, totalPrice: 1, approvalStatus: 'approved' },
        { id: '2', description: 'b', category: 'material', quantity: 1, unit: 'ea', unitPrice: 1, totalPrice: 1, approvalStatus: 'pending' },
      ],
    });
    expect(deriveQuoteCommercialSignal(q)).toBe('partial_lines');
  });

  it('approved with granular all pending is with_client', () => {
    const q = baseQuote({
      status: 'approved',
      lineItems: [
        { id: '1', description: 'a', category: 'material', quantity: 1, unit: 'ea', unitPrice: 1, totalPrice: 1, approvalStatus: 'pending' },
      ],
    });
    expect(deriveQuoteCommercialSignal(q)).toBe('with_client');
  });

  it('approved with mixed granular and legacy lines (no approvalStatus on some) uses granular path', () => {
    const q = baseQuote({
      status: 'approved',
      lineItems: [
        { id: '1', description: 'a', category: 'material', quantity: 1, unit: 'ea', unitPrice: 1, totalPrice: 1, approvalStatus: 'approved' },
        { id: '2', description: 'b', category: 'material', quantity: 1, unit: 'ea', unitPrice: 1, totalPrice: 1 },
      ],
    });
    expect(deriveQuoteCommercialSignal(q)).toBe('partial_lines');
  });

  it('unknown quote status falls through to with_client', () => {
    const q = baseQuote({ status: 'sent' });
    (q as { status: string }).status = 'weird';
    expect(deriveQuoteCommercialSignal(q)).toBe('with_client');
  });
});

describe('projectHasSalesOrder / resolveHasSalesOrderSet', () => {
  it('true when project has linkedSalesOrderId', () => {
    const p = { id: 'p1' } as DesignProject;
    (p as any).linkedSalesOrderId = 'so1';
    expect(projectHasSalesOrder(p, new Set())).toBe(true);
  });

  it('true when in SO set', () => {
    const p = { id: 'p1' } as DesignProject;
    expect(projectHasSalesOrder(p, new Set(['p1']))).toBe(true);
  });

  it('false when neither', () => {
    const p = { id: 'p1' } as DesignProject;
    expect(projectHasSalesOrder(p, new Set(['p2']))).toBe(false);
  });

  it('resolveHasSalesOrderSet merges linked + docs', () => {
    const projects = [
      { id: 'a', linkedSalesOrderId: 'x' } as DesignProject,
      { id: 'b' } as DesignProject,
    ];
    const s = resolveHasSalesOrderSet(projects, new Set(['b']));
    expect(s.has('a')).toBe(true);
    expect(s.has('b')).toBe(true);
  });
});
