/**
 * Tests for the CustomerContact shape + legacy converters (P11-1).
 *
 * The type itself is just a shape; behaviour lives in the two
 * converters that bridge the legacy embedded `ContactPerson[]` array
 * and the new top-level `customerContacts` collection. These tests
 * pin down loss-less round-tripping and the collection constant —
 * everything else (CRUD, subscribe, writers) ships in later slices.
 */
import { Timestamp } from 'firebase/firestore';
import { describe, it, expect } from 'vitest';
import type { ContactPerson } from '../index';
import {
  CUSTOMER_CONTACTS_COLLECTION,
  contactPersonToCustomerContactData,
  customerContactToContactPerson,
  findContactInEmbedded,
  resolveContactPerson,
  toCustomerContactRef,
  type CustomerContact,
} from '../customerContact';

describe('CUSTOMER_CONTACTS_COLLECTION constant', () => {
  it('points at the top-level customerContacts collection', () => {
    // The value must match the Firestore rules + indexes that land in
    // P11-2; hard-coding it here locks the name so a rename can't
    // silently diverge between type and service.
    expect(CUSTOMER_CONTACTS_COLLECTION).toBe('customerContacts');
  });
});

describe('contactPersonToCustomerContactData', () => {
  it('copies every legacy field onto the new shape', () => {
    const legacy: ContactPerson = {
      id: 'cp-1',
      name: 'Jane Doe',
      title: 'Ms.',
      department: 'Procurement',
      role: 'procurement',
      email: 'jane@example.com',
      phone: '+256-700-111-222',
      mobile: '+256-700-333-444',
      notes: 'Primary day-to-day contact',
      isPrimary: true,
    };

    expect(contactPersonToCustomerContactData(legacy)).toEqual({
      name: 'Jane Doe',
      title: 'Ms.',
      department: 'Procurement',
      role: 'procurement',
      email: 'jane@example.com',
      phone: '+256-700-111-222',
      mobile: '+256-700-333-444',
      notes: 'Primary day-to-day contact',
      isPrimary: true,
    });
  });

  it('preserves isPrimary=false without inventing a default', () => {
    // Regression guard: the copy must NOT coerce a secondary contact
    // into primary — `isPrimary` is required on both shapes so the
    // converter should pass it through verbatim.
    const legacy: ContactPerson = {
      id: 'cp-2',
      name: 'Secondary',
      isPrimary: false,
    };
    expect(contactPersonToCustomerContactData(legacy).isPrimary).toBe(false);
  });

  it('leaves optional fields undefined when source omits them', () => {
    const legacy: ContactPerson = {
      id: 'cp-3',
      name: 'Minimal',
      isPrimary: false,
    };
    const data = contactPersonToCustomerContactData(legacy);
    expect(data.email).toBeUndefined();
    expect(data.role).toBeUndefined();
    expect(data.notes).toBeUndefined();
  });
});

describe('customerContactToContactPerson', () => {
  it('drops collection-only fields (customerId, isActive, timestamps)', () => {
    const ts = Timestamp.fromDate(new Date('2026-04-17T00:00:00Z'));
    const record: CustomerContact = {
      id: 'cc-1',
      customerId: 'cust-1',
      name: 'Jane Doe',
      title: 'Ms.',
      department: 'Procurement',
      role: 'procurement',
      email: 'jane@example.com',
      phone: '+256-700-111-222',
      mobile: '+256-700-333-444',
      notes: 'Primary',
      isPrimary: true,
      isActive: true,
      createdAt: ts,
      updatedAt: ts,
    };

    const person = customerContactToContactPerson(record);
    expect(person).toEqual({
      id: 'cc-1',
      name: 'Jane Doe',
      title: 'Ms.',
      department: 'Procurement',
      role: 'procurement',
      email: 'jane@example.com',
      phone: '+256-700-111-222',
      mobile: '+256-700-333-444',
      notes: 'Primary',
      isPrimary: true,
    });
    // Legacy embedded shape has no slot for these — must not leak.
    expect(person).not.toHaveProperty('customerId');
    expect(person).not.toHaveProperty('isActive');
    expect(person).not.toHaveProperty('createdAt');
    expect(person).not.toHaveProperty('updatedAt');
  });
});

describe('ContactPerson → CustomerContactData → ContactPerson round-trip', () => {
  it('preserves every field the legacy shape carries', () => {
    const original: ContactPerson = {
      id: 'cp-rt',
      name: 'Round Trip',
      title: 'Dr.',
      department: 'Finance',
      role: 'finance',
      email: 'rt@example.com',
      phone: '+1-555-0100',
      mobile: '+1-555-0101',
      notes: 'Sees all POs',
      isPrimary: true,
    };

    // Simulate the P11-3 mirroring path: legacy row -> form data ->
    // stamped as a collection record -> converted back for a legacy
    // consumer. Round-trip must equal the original minus whatever the
    // collection adds (customerId / timestamps / isActive).
    const data = contactPersonToCustomerContactData(original);
    const record: CustomerContact = {
      ...data,
      id: original.id,
      customerId: 'cust-x',
      createdAt: Timestamp.fromDate(new Date(0)),
      updatedAt: Timestamp.fromDate(new Date(0)),
    };
    expect(customerContactToContactPerson(record)).toEqual(original);
  });
});

describe('toCustomerContactRef', () => {
  it('falls back to mobile when phone is missing', () => {
    // Matches advisory's `toContactRef` heuristic — keeps picker
    // tooltips showing SOME number even if only mobile is recorded.
    const ts = Timestamp.fromDate(new Date('2026-04-17T00:00:00Z'));
    const record: CustomerContact = {
      id: 'cc-ref',
      customerId: 'cust-1',
      name: 'Mobile Only',
      mobile: '+256-700-999-888',
      isPrimary: false,
      createdAt: ts,
      updatedAt: ts,
    };
    expect(toCustomerContactRef(record)).toEqual({
      id: 'cc-ref',
      customerId: 'cust-1',
      name: 'Mobile Only',
      email: undefined,
      phone: '+256-700-999-888',
      role: undefined,
      isPrimary: false,
    });
  });

  it('prefers phone over mobile when both set', () => {
    const ts = Timestamp.fromDate(new Date('2026-04-17T00:00:00Z'));
    const record: CustomerContact = {
      id: 'cc-ref-2',
      customerId: 'cust-1',
      name: 'Both Numbers',
      phone: '+256-1',
      mobile: '+256-2',
      isPrimary: true,
      createdAt: ts,
      updatedAt: ts,
    };
    expect(toCustomerContactRef(record).phone).toBe('+256-1');
  });
});

describe('resolveContactPerson (P11-5 reader helper)', () => {
  it('returns an id-branch ref when contactPersonId is present', () => {
    // Modern activity row: P11-4 writer populated both id + name cache.
    // Resolver must prefer the id (exact join) and surface the cache so
    // a list view can render immediately without waiting for a fetch.
    expect(
      resolveContactPerson({
        contactPersonId: 'cp-1',
        contactPersonName: 'Jane Doe',
      }),
    ).toEqual({
      kind: 'id',
      contactPersonId: 'cp-1',
      contactPersonName: 'Jane Doe',
    });
  });

  it('returns an id-branch ref even when name cache is missing', () => {
    // Writer forgot to denormalize the name — still valid, reader will
    // resolve via getCustomerContact(id).
    expect(resolveContactPerson({ contactPersonId: 'cp-2' })).toEqual({
      kind: 'id',
      contactPersonId: 'cp-2',
      contactPersonName: undefined,
    });
  });

  it('falls back to name-branch when only contactPersonName is set', () => {
    // Legacy activity row from before P11-4: no FK, only free text.
    // Reader should still show the name; embedded-array lookup can
    // enrich with title/email if the Customer doc is at hand.
    expect(
      resolveContactPerson({ contactPersonName: 'Bob Builder' }),
    ).toEqual({ kind: 'name', contactPersonName: 'Bob Builder' });
  });

  it('returns null when neither signal is present', () => {
    // Activity with no contact attribution at all — readers render "—".
    expect(resolveContactPerson({})).toBeNull();
  });

  it('prefers id over name when both present (id is the canonical signal)', () => {
    // If a writer populated both but they disagree, id wins — it's the
    // FK to the source-of-truth record; the name is just a cache.
    const result = resolveContactPerson({
      contactPersonId: 'cp-3',
      contactPersonName: 'Cached Stale Name',
    });
    expect(result?.kind).toBe('id');
  });
});

describe('findContactInEmbedded (P11-5 legacy array lookup)', () => {
  const contacts = [
    { id: 'cp-1', name: 'Jane Doe', isPrimary: true, email: 'jane@x.com' },
    { id: 'cp-2', name: 'bob builder', isPrimary: false },
    { id: 'cp-3', name: 'Charlie', isPrimary: false },
  ];

  it('matches by id when resolver returned an id branch', () => {
    const resolved = resolveContactPerson({ contactPersonId: 'cp-2' });
    expect(findContactInEmbedded(contacts, resolved)?.id).toBe('cp-2');
  });

  it('matches by case-insensitive name when resolver returned a name branch', () => {
    // Legacy row has "Bob Builder" (title-cased). Embedded entry is
    // "bob builder" (lower-cased). Case-insensitive match should find it.
    const resolved = resolveContactPerson({ contactPersonName: 'Bob Builder' });
    expect(findContactInEmbedded(contacts, resolved)?.id).toBe('cp-2');
  });

  it('returns null when no embedded entry matches the id', () => {
    const resolved = resolveContactPerson({ contactPersonId: 'cp-missing' });
    expect(findContactInEmbedded(contacts, resolved)).toBeNull();
  });

  it('returns null when no embedded entry matches the name', () => {
    const resolved = resolveContactPerson({ contactPersonName: 'Unknown Person' });
    expect(findContactInEmbedded(contacts, resolved)).toBeNull();
  });

  it('returns null when resolved is null', () => {
    expect(findContactInEmbedded(contacts, null)).toBeNull();
  });

  it('returns null when the contacts array is empty or undefined', () => {
    const resolved = resolveContactPerson({ contactPersonId: 'cp-1' });
    expect(findContactInEmbedded(undefined, resolved)).toBeNull();
    expect(findContactInEmbedded([], resolved)).toBeNull();
  });
});
