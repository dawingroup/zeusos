/**
 * P5 — createProject fail-loud guard on `customerId`.
 *
 * Mirrors the Firestore security rule in-app so callers get a typed
 * `MissingCustomerIdError` instead of an opaque `PERMISSION_DENIED`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc } from 'firebase/firestore';
import {
  createProject,
  assertCustomerIdPresent,
  MissingCustomerIdError,
} from '../firestore';
import type { DesignProject } from '../../types';

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>;

type ProjectInput = Omit<
  DesignProject,
  'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'
>;

function makeValidInput(over: Partial<ProjectInput> = {}): ProjectInput {
  // Status is required on DesignProject; other optional fields are omitted
  // and will be stripped by stripUndefined() in the service.
  return {
    code: 'P-001',
    name: 'Test Project',
    customerId: 'cust-1',
    customerName: 'Acme Ltd',
    status: 'active',
    ...over,
  };
}

describe('P5 — assertCustomerIdPresent (pure guard)', () => {
  it('throws MissingCustomerIdError when customerId is undefined', () => {
    expect(() => assertCustomerIdPresent({})).toThrow(MissingCustomerIdError);
  });

  it('throws when customerId is null', () => {
    expect(() => assertCustomerIdPresent({ customerId: null as unknown as string }))
      .toThrow(MissingCustomerIdError);
  });

  it('throws when customerId is an empty string', () => {
    expect(() => assertCustomerIdPresent({ customerId: '' })).toThrow(MissingCustomerIdError);
  });

  it('throws when customerId is whitespace-only', () => {
    expect(() => assertCustomerIdPresent({ customerId: '   ' })).toThrow(MissingCustomerIdError);
  });

  it('throws when customerId is not a string', () => {
    expect(() => assertCustomerIdPresent({ customerId: 42 as unknown as string }))
      .toThrow(MissingCustomerIdError);
  });

  it('narrows the type and passes on a non-empty string', () => {
    const input: { customerId?: unknown } = { customerId: 'cust-ok' };
    assertCustomerIdPresent(input);
    // After the assertion, `input.customerId` is a string — the test just
    // has to compile and not throw.
    expect(input.customerId).toBe('cust-ok');
  });

  it('exposes a stable error code for UI branching', () => {
    try {
      assertCustomerIdPresent({ customerId: '' });
      throw new Error('expected MissingCustomerIdError');
    } catch (err) {
      const e = err as MissingCustomerIdError;
      expect(e).toBeInstanceOf(MissingCustomerIdError);
      expect(e.code).toBe('project/missing-customer-id');
    }
  });
});

describe('P5 — createProject guard integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects before any Firestore write when customerId is missing', async () => {
    await expect(
      createProject({ ...makeValidInput(), customerId: undefined as unknown as string }, 'user-1'),
    ).rejects.toBeInstanceOf(MissingCustomerIdError);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('rejects when customerId is an empty string', async () => {
    await expect(
      createProject({ ...makeValidInput(), customerId: '' }, 'user-1'),
    ).rejects.toBeInstanceOf(MissingCustomerIdError);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('writes to Firestore when customerId is valid', async () => {
    addDocMock.mockResolvedValueOnce({ id: 'new-project-id' });
    const id = await createProject(makeValidInput(), 'user-1');
    expect(id).toBe('new-project-id');
    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = addDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.customerId).toBe('cust-1');
    expect(payload.customerName).toBe('Acme Ltd');
    expect(payload.createdBy).toBe('user-1');
  });
});
