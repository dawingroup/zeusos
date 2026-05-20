/**
 * Phase 3b — tests for the revision-request service.
 *
 * Covers:
 *   - create sets status='pending' + timestamps
 *   - acknowledge/resolve/decline write the right fields
 *   - countOpenRequests only counts pending+acknowledged
 *   - subscribeToRevisionRequests filters by itemId + status client-side
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import {
  createRevisionRequest,
  acknowledgeRevisionRequest,
  resolveRevisionRequest,
  declineRevisionRequest,
  countOpenRequests,
  subscribeToRevisionRequests,
  type RevisionRequest,
} from '../revisionRequestService';

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>;
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>;
const onSnapshotMock = onSnapshot as unknown as ReturnType<typeof vi.fn>;

function makeRequest(overrides: Partial<RevisionRequest> = {}): RevisionRequest {
  return {
    id: overrides.id || 'r1',
    projectId: overrides.projectId || 'p1',
    itemId: overrides.itemId,
    requestedBy: overrides.requestedBy || 'u1',
    message: overrides.message || 'please change X',
    status: overrides.status || 'pending',
    createdAt: overrides.createdAt || ({} as RevisionRequest['createdAt']),
    updatedAt: overrides.updatedAt || ({} as RevisionRequest['updatedAt']),
    ...overrides,
  };
}

describe('createRevisionRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addDocMock.mockResolvedValue({ id: 'new-req-id' });
  });

  it('writes status=pending + createdAt/updatedAt + forwards the draft fields', async () => {
    const id = await createRevisionRequest({
      projectId: 'p1',
      itemId: 'i1',
      itemName: 'Kitchen',
      requestedBy: 'client-uid',
      requestedByName: 'Alice',
      message: 'Can we swap the hardware?',
    });
    expect(id).toBe('new-req-id');
    const [, written] = addDocMock.mock.calls[0];
    expect(written).toMatchObject({
      projectId: 'p1',
      itemId: 'i1',
      itemName: 'Kitchen',
      requestedBy: 'client-uid',
      requestedByName: 'Alice',
      message: 'Can we swap the hardware?',
      status: 'pending',
    });
    expect(written.createdAt).toBeDefined();
    expect(written.updatedAt).toBeDefined();
  });
});

describe('acknowledge/resolve/decline transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('acknowledge → status=acknowledged + acknowledgedBy/At', async () => {
    await acknowledgeRevisionRequest('r1', 'designer-uid');
    const [, updates] = updateDocMock.mock.calls[0];
    expect(updates).toMatchObject({
      status: 'acknowledged',
      acknowledgedBy: 'designer-uid',
    });
    expect(updates.acknowledgedAt).toBeDefined();
    expect(updates.updatedAt).toBeDefined();
  });

  it('resolve → status=resolved + resolvedBy/At + optional note + fileId', async () => {
    await resolveRevisionRequest('r1', 'designer-uid', {
      note: 'ok, v2 uploaded',
      resolvedWithFileId: 'file-xyz',
    });
    const [, updates] = updateDocMock.mock.calls[0];
    expect(updates).toMatchObject({
      status: 'resolved',
      resolvedBy: 'designer-uid',
      resolvedNote: 'ok, v2 uploaded',
      resolvedWithFileId: 'file-xyz',
    });
  });

  it('decline → status=declined with note', async () => {
    await declineRevisionRequest('r1', 'designer-uid', 'Outside scope of contract');
    const [, updates] = updateDocMock.mock.calls[0];
    expect(updates).toMatchObject({
      status: 'declined',
      resolvedBy: 'designer-uid',
      resolvedNote: 'Outside scope of contract',
    });
  });
});

describe('countOpenRequests', () => {
  it('counts pending + acknowledged only', () => {
    const rows = [
      makeRequest({ id: 'a', status: 'pending' }),
      makeRequest({ id: 'b', status: 'acknowledged' }),
      makeRequest({ id: 'c', status: 'resolved' }),
      makeRequest({ id: 'd', status: 'declined' }),
    ];
    expect(countOpenRequests(rows)).toBe(2);
    expect(countOpenRequests([])).toBe(0);
  });
});

describe('subscribeToRevisionRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies client-side itemId + status filters before invoking callback', () => {
    // Capture the onSnapshot handler so we can drive it synthetically.
    let dataHandler: ((snap: { docs: Array<{ id: string; data: () => unknown }> }) => void) | null =
      null;
    onSnapshotMock.mockImplementation((_q, onNext) => {
      dataHandler = onNext as typeof dataHandler;
      return () => {};
    });

    const received: RevisionRequest[][] = [];
    subscribeToRevisionRequests(
      'p1',
      { itemId: 'i1', status: ['pending'] },
      (rows) => received.push(rows),
    );

    // Deliver a mock snapshot with a mix of item IDs + statuses.
    dataHandler!({
      docs: [
        { id: 'a', data: () => ({ itemId: 'i1', status: 'pending', projectId: 'p1' }) },
        { id: 'b', data: () => ({ itemId: 'i1', status: 'resolved', projectId: 'p1' }) },
        { id: 'c', data: () => ({ itemId: 'i2', status: 'pending', projectId: 'p1' }) },
        { id: 'd', data: () => ({ itemId: 'i1', status: 'pending', projectId: 'p1' }) },
      ],
    });

    expect(received).toHaveLength(1);
    expect(received[0].map((r) => r.id).sort()).toEqual(['a', 'd']);
  });
});
