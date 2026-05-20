/**
 * Tests for the Party abstraction (P8-1).
 *
 * Covers the helpers, equality semantics, key round-tripping, and the
 * Client/Customer structural converters. Kept small — the Party types
 * themselves are just shape definitions; behaviour lives in the
 * handful of pure functions below.
 */

import { describe, it, expect } from 'vitest';
import {
  partyRef,
  partyRefEquals,
  partyRefKey,
  parsePartyRefKey,
  isPartyKind,
  isPartyRef,
  clientToPartyRef,
  customerToPartyRef,
  clientToPartySummary,
  customerToPartySummary,
  resolveParty,
  PARTY_KIND_LABELS,
  PARTY_KIND_SHORT_LABELS,
  type PartyRef,
} from '../party';

describe('partyRef + equality', () => {
  it('builds a ref with the supplied kind and id', () => {
    expect(partyRef('advisory_client', 'abc')).toEqual({
      partyKind: 'advisory_client',
      partyId: 'abc',
    });
  });

  it('treats matching id+kind as equal', () => {
    expect(
      partyRefEquals(partyRef('advisory_client', 'x'), partyRef('advisory_client', 'x')),
    ).toBe(true);
  });

  it('does NOT conflate matching ids across kinds', () => {
    // The whole point of the abstraction — same id, different subsidiaries.
    expect(
      partyRefEquals(
        partyRef('advisory_client', 'dup-id'),
        partyRef('finishes_customer', 'dup-id'),
      ),
    ).toBe(false);
  });

  it('handles nullish inputs by identity comparison', () => {
    expect(partyRefEquals(null, null)).toBe(true);
    expect(partyRefEquals(undefined, undefined)).toBe(true);
    expect(partyRefEquals(null, undefined)).toBe(false);
    expect(partyRefEquals(partyRef('advisory_client', 'x'), null)).toBe(false);
  });
});

describe('key round-trip', () => {
  it('round-trips a ref through the key format', () => {
    const ref = partyRef('finishes_customer', 'customer-123');
    const key = partyRefKey(ref);
    expect(key).toBe('finishes_customer:customer-123');
    expect(parsePartyRefKey(key)).toEqual(ref);
  });

  it('tolerates ids that contain hyphens / underscores / slashes', () => {
    // Firestore ids can include almost anything except `/`; we still
    // slice on the FIRST colon so ids with colons would break — but
    // that's not a valid Firestore id so it's a non-issue.
    const weird = partyRef('advisory_client', 'org_abc-123.xyz');
    expect(parsePartyRefKey(partyRefKey(weird))).toEqual(weird);
  });

  it('returns null for malformed keys', () => {
    expect(parsePartyRefKey('no-colon-here')).toBeNull();
    expect(parsePartyRefKey(':missing-kind')).toBeNull();
    expect(parsePartyRefKey('advisory_client:')).toBeNull();
    expect(parsePartyRefKey('unknown_kind:abc')).toBeNull();
  });
});

describe('runtime type guards', () => {
  it('isPartyKind accepts the two known kinds only', () => {
    expect(isPartyKind('advisory_client')).toBe(true);
    expect(isPartyKind('finishes_customer')).toBe(true);
    expect(isPartyKind('other')).toBe(false);
    expect(isPartyKind(undefined)).toBe(false);
    expect(isPartyKind(42)).toBe(false);
  });

  it('isPartyRef accepts valid shapes and rejects noise', () => {
    expect(isPartyRef({ partyId: 'x', partyKind: 'advisory_client' })).toBe(true);
    expect(isPartyRef({ partyId: 42, partyKind: 'advisory_client' })).toBe(false);
    expect(isPartyRef({ partyId: 'x', partyKind: 'bogus' })).toBe(false);
    expect(isPartyRef(null)).toBe(false);
    expect(isPartyRef('advisory_client:x')).toBe(false);
  });
});

describe('client → party', () => {
  it('builds a ref when id is present', () => {
    expect(
      clientToPartyRef({ id: 'client-1', displayName: 'Acme Corp' }),
    ).toEqual({ partyId: 'client-1', partyKind: 'advisory_client' });
  });

  it('returns null when id is missing', () => {
    // Half-constructed DTO (e.g. during form editing) — helper refuses
    // to fabricate an id so bad refs don't leak downstream.
    expect(clientToPartyRef({ displayName: 'no-id yet' })).toBeNull();
  });

  it('summary prefers displayName, falls back to legalName then id', () => {
    expect(
      clientToPartySummary({
        id: 'c1',
        displayName: 'Acme',
        legalName: 'Acme Inc.',
        email: 'a@b.com',
      }),
    ).toMatchObject({ name: 'Acme', email: 'a@b.com' });

    expect(
      clientToPartySummary({ id: 'c1', legalName: 'Acme Inc.' }),
    ).toMatchObject({ name: 'Acme Inc.' });

    expect(clientToPartySummary({ id: 'c1' })).toMatchObject({ name: 'c1' });
  });
});

describe('customer → party', () => {
  it('builds a ref when id is present', () => {
    expect(
      customerToPartyRef({ id: 'cust-1', name: 'Jane Smith' }),
    ).toEqual({ partyId: 'cust-1', partyKind: 'finishes_customer' });
  });

  it('returns null when id is missing', () => {
    expect(customerToPartyRef({ name: 'no-id yet' })).toBeNull();
  });

  it('summary prefers Customer.name then displayName then id', () => {
    expect(
      customerToPartySummary({
        id: 'cu1',
        name: 'Jane',
        email: 'jane@example.com',
      }),
    ).toMatchObject({ name: 'Jane', email: 'jane@example.com' });

    expect(
      customerToPartySummary({ id: 'cu1', displayName: 'Fallback' }),
    ).toMatchObject({ name: 'Fallback' });

    expect(customerToPartySummary({ id: 'cu1' })).toMatchObject({ name: 'cu1' });
  });
});

describe('labels', () => {
  it('has a full and short label for each kind', () => {
    // Sanity: the UI always has a string to show. Keeps both maps in
    // sync by enumerating via the same key list.
    for (const kind of ['advisory_client', 'finishes_customer'] as const) {
      expect(PARTY_KIND_LABELS[kind]).toBeTruthy();
      expect(PARTY_KIND_SHORT_LABELS[kind]).toBeTruthy();
    }
  });
});

describe('resolveParty (P8-3 reader migration)', () => {
  it('prefers the stored party ref verbatim when present', () => {
    // Post-P8-2 row: use the stored kind even if customerId also exists.
    // This is the whole point — a deal whose party is advisory_client
    // must NOT be downgraded to finishes_customer just because the
    // legacy field is still populated for back-compat.
    expect(
      resolveParty({
        party: { partyId: 'p-1', partyKind: 'advisory_client' },
        customerId: 'cust-shadow',
      }),
    ).toEqual({ partyId: 'p-1', partyKind: 'advisory_client' });
  });

  it('falls back to customerId as finishes_customer for legacy rows', () => {
    // Pre-P8-2 rows have no `party`. Every legacy CRMDeal / CRMActivity /
    // SalesOrder originated from the finishes module, so interpreting
    // the legacy customerId as finishes_customer is lossless.
    expect(resolveParty({ customerId: 'legacy-1' })).toEqual({
      partyId: 'legacy-1',
      partyKind: 'finishes_customer',
    });
  });

  it('returns null when neither party nor customerId is set', () => {
    expect(resolveParty({})).toBeNull();
  });

  it('ignores a malformed party and falls back to customerId', () => {
    // Defense against a data-corruption case where `party` got stored
    // with an unknown kind — don't trust it; treat as legacy.
    const bogus = { partyId: 'x', partyKind: 'bogus' } as unknown as PartyRef;
    expect(
      resolveParty({ party: bogus, customerId: 'legit-cust' }),
    ).toEqual({ partyId: 'legit-cust', partyKind: 'finishes_customer' });
  });
});

describe('use as a typed value', () => {
  it('PartyRef is assignable to itself via spread — shape stays stable', () => {
    // Regression: if someone adds a required field to PartyRef we want
    // the structural-spread pattern used by PartySummary to catch it.
    const r: PartyRef = partyRef('advisory_client', 'x');
    const summary = { ...r, name: 'Test' };
    expect(summary).toEqual({
      partyId: 'x',
      partyKind: 'advisory_client',
      name: 'Test',
    });
  });
});
