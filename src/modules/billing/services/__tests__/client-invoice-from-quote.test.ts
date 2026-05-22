/**
 * generateClientInvoiceFromQuote — wires 3.C Quote → 3.F ClientInvoice.
 *
 * Mocks the pricing module's read helpers (getQuote / listQuoteLines)
 * and the client-invoice service to assert the right payload is
 * constructed without exercising Firestore.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Quote, QuoteLine } from '@/modules/pricing/types';
import type { GenerateClientInvoiceInput } from '../client-invoice.service';

const mockGetQuote = vi.fn<[string], Promise<Quote | null>>();
const mockListQuoteLines = vi.fn<[string], Promise<QuoteLine[]>>();
const mockGenerateClientInvoice = vi.fn<[GenerateClientInvoiceInput], Promise<{ id: string }>>();

vi.mock('@/modules/pricing/services/firestore', () => ({
  getQuote: (id: string) => mockGetQuote(id),
  listQuoteLines: (id: string) => mockListQuoteLines(id),
}));

vi.mock('../client-invoice.service', () => ({
  generateClientInvoice: (input: GenerateClientInvoiceInput) =>
    mockGenerateClientInvoice(input),
}));

import { generateClientInvoiceFromQuote } from '../client-invoice-from-quote.service';

function quote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: 'q-1',
    sowId: 'sow-1',
    clientId: 'client-1',
    code: 'Q-2026-Q2-001',
    status: 'ACCEPTED',
    clientTotalMinor: 10_000_000,
    totalCostMinor: 6_000_000,
    currency: 'UGX',
    marginFloorPct: 25,
    createdBy: 'user-1',
    createdAt: '2026-05-22T10:00:00Z',
    updatedAt: '2026-05-22T10:00:00Z',
    ...overrides,
  };
}

function quoteLine(overrides: Partial<QuoteLine> = {}): QuoteLine {
  return {
    id: 'ql-1',
    quoteId: 'q-1',
    subsidiaryOrgId: 'zeus-the-agency',
    rateCardLineId: 'rcl-1',
    rateCardId: 'rc-1',
    roleCode: 'designer-senior',
    unit: 'HOUR',
    description: 'Zeus The Agency — design hours',
    qty: 40,
    costMinor: 4_000_000,
    markupPct: 50,
    clientMinor: 6_000_000,
    currency: 'UGX',
    ...overrides,
  };
}

beforeEach(() => {
  mockGetQuote.mockReset();
  mockListQuoteLines.mockReset();
  mockGenerateClientInvoice.mockReset();
  mockGenerateClientInvoice.mockResolvedValue({ id: 'ci-1' } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateClientInvoiceFromQuote', () => {
  it('rejects when the Quote does not exist', async () => {
    mockGetQuote.mockResolvedValue(null);
    await expect(
      generateClientInvoiceFromQuote({
        quoteId: 'missing',
        masterJobId: 'mj-1',
        createdBy: 'u-1',
      }),
    ).rejects.toThrow(/not found/);
  });

  it('rejects when the Quote is not ACCEPTED', async () => {
    mockGetQuote.mockResolvedValue(quote({ status: 'DRAFT' }));
    mockListQuoteLines.mockResolvedValue([quoteLine()]);
    await expect(
      generateClientInvoiceFromQuote({
        quoteId: 'q-1',
        masterJobId: 'mj-1',
        createdBy: 'u-1',
      }),
    ).rejects.toThrow(/only ACCEPTED quotes/);
  });

  it('rejects when the Quote has no lines', async () => {
    mockGetQuote.mockResolvedValue(quote());
    mockListQuoteLines.mockResolvedValue([]);
    await expect(
      generateClientInvoiceFromQuote({
        quoteId: 'q-1',
        masterJobId: 'mj-1',
        createdBy: 'u-1',
      }),
    ).rejects.toThrow(/no lines/);
  });

  it('maps QuoteLine fields onto the GenerateClientInvoiceInput correctly', async () => {
    mockGetQuote.mockResolvedValue(quote());
    mockListQuoteLines.mockResolvedValue([
      quoteLine(),
      quoteLine({
        id: 'ql-2',
        subsidiaryOrgId: 'labyrinth',
        description: 'Labyrinth — production hours',
        costMinor: 2_000_000,
        clientMinor: 4_000_000,
      }),
    ]);

    await generateClientInvoiceFromQuote({
      quoteId: 'q-1',
      masterJobId: 'mj-1',
      createdBy: 'user-x',
      idempotencyKey: 'k-1',
    });

    expect(mockGenerateClientInvoice).toHaveBeenCalledTimes(1);
    const arg = mockGenerateClientInvoice.mock.calls[0][0];
    expect(arg.masterJobId).toBe('mj-1');
    expect(arg.clientId).toBe('client-1');
    expect(arg.clientCurrency).toBe('UGX');
    expect(arg.createdBy).toBe('user-x');
    expect(arg.idempotencyKey).toBe('k-1');
    expect(arg.lines).toHaveLength(2);
    expect(arg.lines[0]).toMatchObject({
      id: 'ql-1',
      quoteLineId: 'ql-1',
      sourceAmountMinor: 6_000_000,
      sourceCurrency: 'UGX',
      costMinor: 4_000_000,
      sourceSubsidiaryId: 'zeus-the-agency',
    });
    expect(arg.lines[1]).toMatchObject({
      id: 'ql-2',
      sourceSubsidiaryId: 'labyrinth',
      sourceAmountMinor: 4_000_000,
      costMinor: 2_000_000,
    });
  });

  it('runs descriptions through clientFriendlyDescription (subsidiary identity stripped)', async () => {
    mockGetQuote.mockResolvedValue(quote());
    mockListQuoteLines.mockResolvedValue([
      quoteLine({ description: 'Zeus The Agency — design hours' }),
      quoteLine({ id: 'ql-2', description: 'Labyrinth — production hours' }),
    ]);

    await generateClientInvoiceFromQuote({
      quoteId: 'q-1',
      masterJobId: 'mj-1',
      createdBy: 'u-1',
    });

    const arg = mockGenerateClientInvoice.mock.calls[0][0];
    for (const line of arg.lines) {
      expect(line.description).not.toMatch(/Zeus|Labyrinth/);
    }
    expect(arg.lines[0].description).toBe('Creative campaign development');
    expect(arg.lines[1].description).toBe('Production services');
  });

  it('passes through consolidationDate override', async () => {
    mockGetQuote.mockResolvedValue(quote());
    mockListQuoteLines.mockResolvedValue([quoteLine()]);
    await generateClientInvoiceFromQuote({
      quoteId: 'q-1',
      masterJobId: 'mj-1',
      createdBy: 'u-1',
      consolidationDate: '2026-06-30',
    });
    expect(mockGenerateClientInvoice.mock.calls[0][0].consolidationDate).toBe('2026-06-30');
  });
});
