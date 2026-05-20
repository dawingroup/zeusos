/**
 * Unit Tests: Manufacturing Execution Service
 *
 * Tests for step lifecycle management in the MES (Manufacturing Execution System).
 * Verifies that the correct Firestore operations are called with the right arguments
 * for each step transition (start, complete, pause, QC, progress).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mocks
// ============================================

const mockTransaction = {
  get: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
};

vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  collection: vi.fn((...args: string[]) => ({ path: args.join('/') })),
  doc: vi.fn((...args: string[]) => ({ path: args.join('/') })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  updateDoc: vi.fn(),
  addDoc: vi.fn(),
  query: vi.fn((...args: unknown[]) => args),
  where: vi.fn((...args: unknown[]) => ({ type: 'where', args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: 'orderBy', args })),
  serverTimestamp: vi.fn(() => new Date('2026-03-09T10:00:00Z')),
  runTransaction: vi.fn((_db: unknown, fn: (t: typeof mockTransaction) => Promise<void>) => fn(mockTransaction)),
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn(),
  })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date('2026-03-09T10:00:00Z') })),
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
  },
}));

vi.mock('@/shared/services/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  functions: {},
  app: {},
}));

// Import after mocks are set up
import { manufacturingExecutionService } from '@/modules/manufacturing/services/manufacturingExecutionService';
import { addDoc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import type { ManufacturingStep, ManufacturingOrderMES } from '@/modules/manufacturing/types';

// ============================================
// Helpers
// ============================================

function createMockStep(overrides: Partial<ManufacturingStep> = {}): ManufacturingStep {
  return {
    id: 'step-1',
    orderId: 'order-1',
    stepIndex: 0,
    name: 'CNC Cutting',
    workstationType: 'cutting_cnc',
    workstationId: 'ws-cnc-01',
    status: 'queued',
    statusHistory: [],
    assignedOperatorId: undefined,
    assignedOperatorName: undefined,
    estimatedDurationMinutes: 60,
    actualDurationMinutes: undefined,
    startedAt: undefined,
    completedAt: undefined,
    timeEntries: [],
    qcRequired: false,
    materialsConsumed: [],
    dependsOnStepIds: [],
    isRework: false,
    attachments: [],
    createdAt: new Date() as never,
    updatedAt: new Date() as never,
    ...overrides,
  };
}

function createMockMO(overrides: Partial<ManufacturingOrderMES> = {}): ManufacturingOrderMES {
  return {
    id: 'order-1',
    moNumber: 'MO-2026-0001',
    status: 'in-progress',
    mesStatus: 'ready',
    designItemId: 'di-1',
    projectId: 'proj-1',
    projectCode: 'P001',
    itemName: 'Kitchen Cabinet',
    designItemName: 'Kitchen Cabinet',
    quantity: 1,
    priority: 'medium',
    bom: [],
    parts: [],
    instructions: '',
    handoverNotes: '',
    scheduling: {},
    materialReservations: [],
    materialConsumptions: [],
    stageHistory: [],
    currentStage: 'cutting',
    stageEnteredAt: new Date() as never,
    costSummary: { materialCost: 0, laborCost: 0, totalCost: 0, currency: 'UGX' },
    subsidiaryId: 'finishes',
    totalSteps: 3,
    completedSteps: 0,
    currentStepIndex: 0,
    estimatedLaborHours: 5,
    actualLaborHours: 0,
    estimatedMaterialCost: 0,
    actualMaterialCost: 0,
    estimatedTotalCost: 0,
    actualTotalCost: 0,
    defectCount: 0,
    reworkOrderIds: [],
    bomLineCount: 0,
    bomTotalMaterialCost: 0,
    createdAt: new Date() as never,
    createdBy: 'user-1',
    updatedAt: new Date() as never,
    updatedBy: 'user-1',
    ...overrides,
  };
}

function createMockWorkstation() {
  return {
    id: 'ws-cnc-01',
    name: 'CNC Machine 1',
    code: 'CNC-01',
    type: 'cutting_cnc',
    currentActiveJobs: 1,
    currentStepIds: ['existing-step'],
    maxConcurrentJobs: 3,
    operatingHoursPerDay: 8,
    status: 'operational',
    queuedStepCount: 2,
    assignedOperatorIds: [],
    isActive: true,
    organizationId: 'org-1',
    subsidiaryId: 'finishes',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
    updatedBy: 'admin',
  };
}

// ============================================
// Tests
// ============================================

describe('Manufacturing Execution Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ------------------------------------------
  // startStep
  // ------------------------------------------
  describe('startStep', () => {
    it('should update step status to in_progress and add time entry', async () => {
      const mockStep = createMockStep({ status: 'queued', dependsOnStepIds: [] });
      const mockMO = createMockMO({ mesStatus: 'ready' });
      const mockWS = createMockWorkstation();

      // Transaction.get returns step, then MO, then workstation
      mockTransaction.get
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'step-1',
          data: () => ({ ...mockStep, id: undefined }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'order-1',
          data: () => ({ ...mockMO, id: undefined }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws-cnc-01',
          data: () => mockWS,
        });

      await manufacturingExecutionService.startStep(
        'order-1',
        'step-1',
        'operator-1',
        'John Doe',
      );

      // Verify transaction.update was called for the step
      const stepUpdateCall = mockTransaction.update.mock.calls[0];
      expect(stepUpdateCall).toBeDefined();
      const stepUpdateData = stepUpdateCall[1];
      expect(stepUpdateData.status).toBe('in_progress');
      expect(stepUpdateData.assignedOperatorId).toBe('operator-1');
      expect(stepUpdateData.assignedOperatorName).toBe('John Doe');
      expect(stepUpdateData.startedAt).toBeDefined();

      // Verify time entry was added
      const timeEntries = stepUpdateData.timeEntries;
      expect(timeEntries).toHaveLength(1);
      expect(timeEntries[0].operatorId).toBe('operator-1');
      expect(timeEntries[0].operatorName).toBe('John Doe');
      expect(timeEntries[0].action).toBe('start');

      // Verify status history was updated
      const statusHistory = stepUpdateData.statusHistory;
      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0].from).toBe('queued');
      expect(statusHistory[0].to).toBe('in_progress');
      expect(statusHistory[0].changedBy).toBe('operator-1');
    });

    it('should update MO status to in_progress when MO is in ready state', async () => {
      const mockStep = createMockStep({ status: 'ready', dependsOnStepIds: [] });
      const mockMO = createMockMO({ mesStatus: 'ready' });
      const mockWS = createMockWorkstation();

      mockTransaction.get
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'step-1',
          data: () => ({ ...mockStep, id: undefined }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'order-1',
          data: () => ({ ...mockMO, id: undefined }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws-cnc-01',
          data: () => mockWS,
        });

      await manufacturingExecutionService.startStep('order-1', 'step-1', 'op-1', 'Jane');

      // The second update call should be the MO update
      const moUpdateCall = mockTransaction.update.mock.calls[1];
      expect(moUpdateCall).toBeDefined();
      const moUpdateData = moUpdateCall[1];
      expect(moUpdateData.mesStatus).toBe('in_progress');
      expect(moUpdateData.status).toBe('in-progress');
      expect(moUpdateData.actualStartDate).toBeDefined();
    });

    it('should throw error if step is not in queued or ready status', async () => {
      const mockStep = createMockStep({ status: 'completed', dependsOnStepIds: [] });

      mockTransaction.get.mockResolvedValueOnce({
        exists: () => true,
        id: 'step-1',
        data: () => ({ ...mockStep, id: undefined }),
      });

      await expect(
        manufacturingExecutionService.startStep('order-1', 'step-1', 'op-1', 'Jane'),
      ).rejects.toThrow('Cannot start step in status "completed"');
    });

    it('should update workstation active jobs when step has a workstation', async () => {
      const mockStep = createMockStep({
        status: 'queued',
        dependsOnStepIds: [],
        workstationId: 'ws-cnc-01',
      });
      const mockMO = createMockMO({ mesStatus: 'in_progress' });
      const mockWS = createMockWorkstation();

      mockTransaction.get
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'step-1',
          data: () => ({ ...mockStep, id: undefined }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'order-1',
          data: () => ({ ...mockMO, id: undefined }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws-cnc-01',
          data: () => mockWS,
        });

      await manufacturingExecutionService.startStep('order-1', 'step-1', 'op-1', 'Jane');

      // Third update should be workstation
      const wsUpdateCall = mockTransaction.update.mock.calls[2];
      expect(wsUpdateCall).toBeDefined();
      const wsUpdateData = wsUpdateCall[1];
      expect(wsUpdateData.currentActiveJobs).toBe(mockWS.currentActiveJobs + 1);
      expect(wsUpdateData.currentStepIds).toContain('step-1');
    });
  });

  // ------------------------------------------
  // completeStep
  // ------------------------------------------
  describe('completeStep', () => {
    it('should update step status to completed and calculate duration', async () => {
      const startTime = new Date('2026-03-09T09:00:00Z');
      const mockStep = createMockStep({
        status: 'in_progress',
        qcRequired: false,
        workstationId: 'ws-cnc-01',
        timeEntries: [
          {
            id: 'te-1',
            operatorId: 'op-1',
            operatorName: 'John',
            action: 'start',
            timestamp: startTime as never,
          },
        ],
      });
      const mockWS = createMockWorkstation();

      mockTransaction.get
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'step-1',
          data: () => ({ ...mockStep, id: undefined }),
        })
        .mockResolvedValueOnce({
          exists: () => true,
          id: 'ws-cnc-01',
          data: () => mockWS,
        });

      // Mock getDocs for updateMOProgress
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'step-1',
            data: () => ({
              ...mockStep,
              status: 'completed',
              actualDurationMinutes: 60,
              stepIndex: 0,
            }),
          },
        ],
      } as never);

      // Mock updateDoc for updateMOProgress
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await manufacturingExecutionService.completeStep(
        'order-1',
        'step-1',
        'op-1',
        'John',
      );

      // Verify step was updated in the transaction
      const stepUpdateCall = mockTransaction.update.mock.calls[0];
      expect(stepUpdateCall).toBeDefined();
      const stepData = stepUpdateCall[1];
      expect(stepData.status).toBe('completed');
      expect(stepData.actualDurationMinutes).toBeDefined();
      expect(typeof stepData.actualDurationMinutes).toBe('number');

      // Verify complete time entry was added
      const lastEntry = stepData.timeEntries[stepData.timeEntries.length - 1];
      expect(lastEntry.action).toBe('complete');
      expect(lastEntry.operatorId).toBe('op-1');
    });

    it('should set status to qc_pending when qcRequired is true', async () => {
      const mockStep = createMockStep({
        status: 'in_progress',
        qcRequired: true,
        workstationId: undefined,
        timeEntries: [
          {
            id: 'te-1',
            operatorId: 'op-1',
            operatorName: 'John',
            action: 'start',
            timestamp: new Date() as never,
          },
        ],
      });

      mockTransaction.get.mockResolvedValueOnce({
        exists: () => true,
        id: 'step-1',
        data: () => ({ ...mockStep, id: undefined }),
      });

      // Mock getDocs for updateMOProgress
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'step-1',
            data: () => ({
              ...mockStep,
              status: 'qc_pending',
              stepIndex: 0,
            }),
          },
        ],
      } as never);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await manufacturingExecutionService.completeStep(
        'order-1',
        'step-1',
        'op-1',
        'John',
      );

      const stepData = mockTransaction.update.mock.calls[0][1];
      expect(stepData.status).toBe('qc_pending');
    });

    it('should throw error if step is not in_progress', async () => {
      const mockStep = createMockStep({ status: 'paused' });

      mockTransaction.get.mockResolvedValueOnce({
        exists: () => true,
        id: 'step-1',
        data: () => ({ ...mockStep, id: undefined }),
      });

      await expect(
        manufacturingExecutionService.completeStep('order-1', 'step-1', 'op-1', 'John'),
      ).rejects.toThrow('Cannot complete step in status "paused"');
    });
  });

  // ------------------------------------------
  // pauseStep
  // ------------------------------------------
  describe('pauseStep', () => {
    it('should update step status to paused and close time entry', async () => {
      const mockStep = createMockStep({
        status: 'in_progress',
        assignedOperatorName: 'John Doe',
        timeEntries: [
          {
            id: 'te-1',
            operatorId: 'op-1',
            operatorName: 'John Doe',
            action: 'start',
            timestamp: new Date('2026-03-09T09:00:00Z') as never,
          },
        ],
      });

      mockTransaction.get.mockResolvedValueOnce({
        exists: () => true,
        id: 'step-1',
        data: () => ({ ...mockStep, id: undefined }),
      });

      await manufacturingExecutionService.pauseStep(
        'order-1',
        'step-1',
        'op-1',
        'Waiting for material',
      );

      const stepUpdateCall = mockTransaction.update.mock.calls[0];
      expect(stepUpdateCall).toBeDefined();
      const stepData = stepUpdateCall[1];

      // Verify status change
      expect(stepData.status).toBe('paused');

      // Verify pause time entry was added
      const timeEntries = stepData.timeEntries;
      expect(timeEntries).toHaveLength(2);
      const pauseEntry = timeEntries[1];
      expect(pauseEntry.action).toBe('pause');
      expect(pauseEntry.operatorId).toBe('op-1');
      expect(pauseEntry.notes).toBe('Waiting for material');

      // Verify status history was updated
      const statusHistory = stepData.statusHistory;
      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0].from).toBe('in_progress');
      expect(statusHistory[0].to).toBe('paused');
      expect(statusHistory[0].reason).toBe('Waiting for material');
    });

    it('should throw error if step is not in_progress', async () => {
      const mockStep = createMockStep({ status: 'queued' });

      mockTransaction.get.mockResolvedValueOnce({
        exists: () => true,
        id: 'step-1',
        data: () => ({ ...mockStep, id: undefined }),
      });

      await expect(
        manufacturingExecutionService.pauseStep('order-1', 'step-1', 'op-1'),
      ).rejects.toThrow('Cannot pause step in status "queued"');
    });
  });

  // ------------------------------------------
  // recordQCResult
  // ------------------------------------------
  describe('recordQCResult', () => {
    it('should create quality event document for a passing inspection', async () => {
      const mockStep = createMockStep({
        status: 'qc_pending',
        statusHistory: [
          { from: 'in_progress', to: 'qc_pending', changedBy: 'op-1', changedAt: new Date() as never },
        ],
      });

      mockTransaction.get.mockResolvedValueOnce({
        exists: () => true,
        id: 'step-1',
        data: () => ({ ...mockStep, id: undefined }),
      });

      // Mock addDoc for quality event creation
      vi.mocked(addDoc).mockResolvedValueOnce({ id: 'qe-1' } as never);

      // Mock getDocs and updateDoc for updateMOProgress
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'step-1',
            data: () => ({
              ...mockStep,
              status: 'completed',
              stepIndex: 0,
            }),
          },
        ],
      } as never);
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await manufacturingExecutionService.recordQCResult(
        'order-1',
        'step-1',
        'pass',
        'inspector-1',
        'Quality Inspector',
        'All dimensions within tolerance',
      );

      // Verify step was updated to completed
      const stepData = mockTransaction.update.mock.calls[0][1];
      expect(stepData.status).toBe('completed');
      expect(stepData.qcResult).toBe('pass');

      // Verify quality event was created via addDoc
      expect(addDoc).toHaveBeenCalled();
      const addDocCalls = vi.mocked(addDoc).mock.calls;
      const qeData = addDocCalls[0][1] as Record<string, unknown>;
      expect(qeData.orderId).toBe('order-1');
      expect(qeData.stepId).toBe('step-1');
      expect(qeData.type).toBe('inspection');
      expect(qeData.result).toBe('pass');
      expect(qeData.inspectorId).toBe('inspector-1');
      expect(qeData.inspectorName).toBe('Quality Inspector');
    });

    it('should create defect quality event and update defect count on failure', async () => {
      const mockStep = createMockStep({ status: 'qc_pending' });
      const mockMO = createMockMO({ defectCount: 2 });

      mockTransaction.get.mockResolvedValueOnce({
        exists: () => true,
        id: 'step-1',
        data: () => ({ ...mockStep, id: undefined }),
      });

      // Mock addDoc for defect quality event
      vi.mocked(addDoc).mockResolvedValueOnce({ id: 'qe-defect-1' } as never);

      // Mock getDoc for MO defect count update
      vi.mocked(getDoc).mockResolvedValueOnce({
        exists: () => true,
        id: 'order-1',
        data: () => ({ ...mockMO, id: undefined }),
      } as never);

      // Mock updateDoc for defect count + updateMOProgress
      vi.mocked(updateDoc).mockResolvedValue(undefined);

      // Mock getDocs for updateMOProgress
      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: [
          {
            id: 'step-1',
            data: () => ({ ...mockStep, status: 'failed', stepIndex: 0 }),
          },
        ],
      } as never);

      await manufacturingExecutionService.recordQCResult(
        'order-1',
        'step-1',
        'fail',
        'inspector-1',
        'Quality Inspector',
        'Surface scratches detected',
        {
          defectType: 'surface_damage',
          defectSeverity: 'major',
          defectDescription: 'Deep scratch on front panel',
          affectedQuantity: 1,
          resolution: 'pending',
          photos: ['photo-1.jpg'],
        },
      );

      // Verify step was updated to failed
      const stepData = mockTransaction.update.mock.calls[0][1];
      expect(stepData.status).toBe('failed');
      expect(stepData.qcResult).toBe('fail');

      // Verify defect quality event was created
      const addDocCalls = vi.mocked(addDoc).mock.calls;
      const qeData = addDocCalls[0][1] as Record<string, unknown>;
      expect(qeData.type).toBe('defect');
      expect(qeData.result).toBe('fail');
      expect(qeData.defectType).toBe('surface_damage');
      expect(qeData.defectSeverity).toBe('major');
      expect(qeData.photos).toEqual(['photo-1.jpg']);

      // Verify MO defect count was updated
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          defectCount: 3, // was 2, now 3
        }),
      );
    });

    it('should throw error if step is not in qc_pending status', async () => {
      const mockStep = createMockStep({ status: 'in_progress' });

      mockTransaction.get.mockResolvedValueOnce({
        exists: () => true,
        id: 'step-1',
        data: () => ({ ...mockStep, id: undefined }),
      });

      await expect(
        manufacturingExecutionService.recordQCResult(
          'order-1',
          'step-1',
          'pass',
          'inspector-1',
          'Inspector',
        ),
      ).rejects.toThrow('Cannot record QC for step in status "in_progress"');
    });
  });

  // ------------------------------------------
  // updateMOProgress
  // ------------------------------------------
  describe('updateMOProgress', () => {
    it('should calculate correct completion percentage', async () => {
      const steps = [
        { id: 's1', status: 'completed', stepIndex: 0, actualDurationMinutes: 30 },
        { id: 's2', status: 'completed', stepIndex: 1, actualDurationMinutes: 45 },
        { id: 's3', status: 'in_progress', stepIndex: 2, actualDurationMinutes: undefined, workstationId: 'ws-1' },
        { id: 's4', status: 'queued', stepIndex: 3, actualDurationMinutes: undefined },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: steps.map(s => ({
          id: s.id,
          data: () => s,
        })),
      } as never);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await manufacturingExecutionService.updateMOProgress('order-1');

      // Verify updateDoc was called with correct progress data
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          totalSteps: 4,
          completedSteps: 2, // 2 completed out of 4
          currentStepIndex: 2, // first non-completed step
          currentWorkstationId: 'ws-1',
          actualLaborHours: 1.25, // (30 + 45) / 60
        }),
      );
    });

    it('should mark MO as completed when all steps are done', async () => {
      const steps = [
        { id: 's1', status: 'completed', stepIndex: 0, actualDurationMinutes: 30 },
        { id: 's2', status: 'completed', stepIndex: 1, actualDurationMinutes: 45 },
        { id: 's3', status: 'skipped', stepIndex: 2, actualDurationMinutes: 0 },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: steps.map(s => ({
          id: s.id,
          data: () => s,
        })),
      } as never);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await manufacturingExecutionService.updateMOProgress('order-1');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          totalSteps: 3,
          completedSteps: 3, // completed + skipped
          mesStatus: 'completed',
          status: 'completed',
          actualEndDate: expect.anything(),
        }),
      );
    });

    it('should set quality_review status when a step has failed', async () => {
      const steps = [
        { id: 's1', status: 'completed', stepIndex: 0, actualDurationMinutes: 30 },
        { id: 's2', status: 'failed', stepIndex: 1, actualDurationMinutes: 20 },
        { id: 's3', status: 'queued', stepIndex: 2, actualDurationMinutes: undefined },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: steps.map(s => ({
          id: s.id,
          data: () => s,
        })),
      } as never);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await manufacturingExecutionService.updateMOProgress('order-1');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          mesStatus: 'quality_review',
          qcStatus: 'failed',
        }),
      );
    });

    it('should handle single-step orders correctly', async () => {
      const steps = [
        { id: 's1', status: 'completed', stepIndex: 0, actualDurationMinutes: 120 },
      ];

      vi.mocked(getDocs).mockResolvedValueOnce({
        docs: steps.map(s => ({
          id: s.id,
          data: () => s,
        })),
      } as never);

      vi.mocked(updateDoc).mockResolvedValue(undefined);

      await manufacturingExecutionService.updateMOProgress('order-1');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          totalSteps: 1,
          completedSteps: 1,
          actualLaborHours: 2, // 120 / 60
          mesStatus: 'completed',
          status: 'completed',
        }),
      );
    });
  });

  // ------------------------------------------
  // calculateDurationFromEntries
  // ------------------------------------------
  describe('calculateDurationFromEntries', () => {
    it('should calculate duration from start to complete', () => {
      const entries = [
        {
          id: 'e1',
          operatorId: 'op-1',
          operatorName: 'John',
          action: 'start' as const,
          timestamp: { toMillis: () => new Date('2026-03-09T09:00:00Z').getTime() } as never,
        },
        {
          id: 'e2',
          operatorId: 'op-1',
          operatorName: 'John',
          action: 'complete' as const,
          timestamp: { toMillis: () => new Date('2026-03-09T10:00:00Z').getTime() } as never,
        },
      ];

      const duration = manufacturingExecutionService.calculateDurationFromEntries(entries);
      expect(duration).toBe(60); // 60 minutes
    });

    it('should exclude paused time from duration', () => {
      const entries = [
        {
          id: 'e1',
          operatorId: 'op-1',
          operatorName: 'John',
          action: 'start' as const,
          timestamp: { toMillis: () => new Date('2026-03-09T09:00:00Z').getTime() } as never,
        },
        {
          id: 'e2',
          operatorId: 'op-1',
          operatorName: 'John',
          action: 'pause' as const,
          timestamp: { toMillis: () => new Date('2026-03-09T09:30:00Z').getTime() } as never,
        },
        {
          id: 'e3',
          operatorId: 'op-1',
          operatorName: 'John',
          action: 'resume' as const,
          timestamp: { toMillis: () => new Date('2026-03-09T10:00:00Z').getTime() } as never,
        },
        {
          id: 'e4',
          operatorId: 'op-1',
          operatorName: 'John',
          action: 'complete' as const,
          timestamp: { toMillis: () => new Date('2026-03-09T10:30:00Z').getTime() } as never,
        },
      ];

      const duration = manufacturingExecutionService.calculateDurationFromEntries(entries);
      // 30 min work + 30 min pause (excluded) + 30 min work = 60 min active
      expect(duration).toBe(60);
    });
  });
});
