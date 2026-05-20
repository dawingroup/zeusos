/**
 * Compliance Event Service
 * Emits BusinessEvents to intelligence layer's taskGenerationService.
 */

import { Timestamp } from 'firebase/firestore';
import type { ComplianceDocumentStatus } from '../types';

// Lazy import to avoid circular deps
let generateTasksFromEvent: ((event: Record<string, unknown>) => Promise<unknown[]>) | null = null;

async function getTaskGenerator() {
  if (!generateTasksFromEvent) {
    try {
      const mod = await import('@/modules/intelligence-layer/services/taskGenerationService');
      // generateTasksFromEvent is a method on the singleton service instance
      generateTasksFromEvent = mod.taskGenerationService.generateTasksFromEvent.bind(
        mod.taskGenerationService,
      ) as unknown as typeof generateTasksFromEvent;
    } catch {
      // Intelligence layer may not be available
      return null;
    }
  }
  return generateTasksFromEvent;
}

function createEvent(
  eventType: string,
  entityType: string,
  entityId: string,
  entityName: string,
  companyId: string,
  currentState: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id: `compliance_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    eventType,
    triggeredBy: 'system',
    triggeredByName: 'Compliance System',
    sourceModule: 'compliance',
    subsidiary: 'corporate',
    entityType,
    entityId,
    entityName,
    companyId,
    currentState,
    timestamp: Timestamp.now(),
  };
}

// ── Document Events ────────────────────────────────────────────────────────

export async function emitDocumentStatusChange(
  documentId: string,
  companyId: string,
  previousStatus: ComplianceDocumentStatus,
  newStatus: ComplianceDocumentStatus
): Promise<void> {
  const gen = await getTaskGenerator();
  if (!gen) return;

  const eventType =
    newStatus === 'expired'
      ? 'compliance_document_expired'
      : newStatus === 'expiring_soon'
        ? 'compliance_document_expiring'
        : null;

  if (!eventType) return;

  const event = createEvent(
    eventType,
    'compliance_document',
    documentId,
    `Document ${documentId}`,
    companyId,
    { previousStatus, newStatus }
  );

  try {
    await gen(event);
  } catch {
    // Silently fail - task generation is non-critical
  }
}

export async function emitDocumentUploaded(
  documentId: string,
  companyId: string
): Promise<void> {
  const gen = await getTaskGenerator();
  if (!gen) return;

  const event = createEvent(
    'compliance_document_uploaded',
    'compliance_document',
    documentId,
    `Document ${documentId}`,
    companyId
  );

  try {
    await gen(event);
  } catch {
    // Silently fail
  }
}

// ── Obligation Events ──────────────────────────────────────────────────────

export async function emitObligationDue(
  obligationId: string,
  companyId: string,
  isOverdue: boolean
): Promise<void> {
  const gen = await getTaskGenerator();
  if (!gen) return;

  const eventType = isOverdue
    ? 'compliance_obligation_overdue'
    : 'compliance_obligation_due';

  const event = createEvent(
    eventType,
    'compliance_obligation',
    obligationId,
    `Obligation ${obligationId}`,
    companyId,
    { isOverdue }
  );

  try {
    await gen(event);
  } catch {
    // Silently fail
  }
}

export async function emitObligationCompleted(
  obligationId: string,
  companyId: string
): Promise<void> {
  const gen = await getTaskGenerator();
  if (!gen) return;

  const event = createEvent(
    'compliance_obligation_completed',
    'compliance_obligation',
    obligationId,
    `Obligation ${obligationId}`,
    companyId
  );

  try {
    await gen(event);
  } catch {
    // Silently fail
  }
}
