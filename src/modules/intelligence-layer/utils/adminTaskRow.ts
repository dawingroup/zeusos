/**
 * A `generated_tasks` doc → the row the admin Task Management panel renders.
 * The engine's vocabulary (seven statuses, `assignedToUserId`, `dueAt` as an ISO
 * string) goes through the inbox's one reader, so the panel says what the inbox
 * says about the same task.
 */
import { Timestamp } from 'firebase/firestore';

import { toInboxTask } from '../hooks/useEmployeeTaskInbox';

const stamp = (d?: Date): Timestamp | undefined => (d ? Timestamp.fromDate(d) : undefined);

export function toPanelTask(id: string, data: Record<string, unknown>) {
  const t = toInboxTask(id, data);
  return {
    ...t,
    eventId: t.businessEventId,
    dueDate: stamp(t.dueDate),
    createdAt: stamp(t.createdAt) as Timestamp,
    updatedAt: stamp(t.updatedAt),
    completedAt: stamp(t.completedAt),
    checklistItems: t.checklistItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      isRequired: item.isRequired,
      isCompleted: item.completed,
      completedAt: stamp(item.completedAt),
      completedBy: item.completedBy,
    })),
  };
}
