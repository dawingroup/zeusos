/**
 * Sync Service
 * Cross-module sync queue + config (execution is a placeholder)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import { MODULE_RELATIONSHIPS, type ModuleId } from '@/integration/constants';

const COLLECTIONS = {
  SYNC_QUEUE: 'sync_queue',
  SYNC_LOG: 'sync_log',
  SYNC_CONFIG: 'sync_config',
} as const;

export type SyncStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type SyncDirection = 'push' | 'pull' | 'bidirectional';

export interface SyncTask {
  id: string;
  organizationId: string;
  sourceModule: ModuleId;
  targetModule: ModuleId;
  entityType: string;
  entityId: string;
  direction: SyncDirection;
  status: SyncStatus;
  priority: number;
  data?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
}

export interface SyncLog {
  id: string;
  taskId: string;
  organizationId: string;
  sourceModule: ModuleId;
  targetModule: ModuleId;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete' | 'link';
  status: 'success' | 'failure';
  details?: string;
  error?: string;
  timestamp: Timestamp;
}

export interface SyncConfig {
  id: string;
  organizationId: string;
  sourceModule: ModuleId;
  targetModule: ModuleId;
  entityType: string;
  enabled: boolean;
  syncDirection: SyncDirection;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  fieldMappings: { sourceField: string; targetField: string; transform?: string }[];
  filters?: Record<string, unknown>;
  lastSyncAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export async function queueSyncTask(
  task: Omit<SyncTask, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt'>
): Promise<SyncTask> {
  const docRef = await addDoc(collection(db, COLLECTIONS.SYNC_QUEUE), {
    ...task,
    status: 'pending',
    retryCount: 0,
    maxRetries: task.maxRetries || 3,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const snapshot = await getDoc(docRef);
  return { id: snapshot.id, ...(snapshot.data() as object) } as SyncTask;
}

export async function getPendingSyncTasks(
  organizationId: string,
  limit_: number = 50
): Promise<SyncTask[]> {
  const q = query(
    collection(db, COLLECTIONS.SYNC_QUEUE),
    where('organizationId', '==', organizationId),
    where('status', 'in', ['pending', 'processing']),
    orderBy('priority', 'desc'),
    orderBy('createdAt', 'asc'),
    limit(limit_)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as SyncTask[];
}

export async function updateSyncTaskStatus(
  taskId: string,
  status: SyncStatus,
  error?: string
): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SYNC_QUEUE, taskId);

  const updateData: Record<string, unknown> = {
    status,
    updatedAt: Timestamp.now(),
  };

  if (status === 'completed' || status === 'failed') {
    updateData.completedAt = Timestamp.now();
  }

  if (error) {
    updateData.error = error;
  }

  if (status === 'failed') {
    const snap = await getDoc(docRef);
    const currentRetry = (snap.data() as any)?.retryCount || 0;
    updateData.retryCount = currentRetry + 1;
  }

  await updateDoc(docRef, updateData);
}

export async function retrySyncTask(taskId: string): Promise<void> {
  const docRef = doc(db, COLLECTIONS.SYNC_QUEUE, taskId);
  const task = await getDoc(docRef);
  if (!task.exists()) throw new Error('Task not found');

  const data = task.data() as any;
  if ((data.retryCount || 0) >= (data.maxRetries || 0)) {
    throw new Error('Max retries exceeded');
  }

  await updateDoc(docRef, {
    status: 'pending',
    error: null,
    updatedAt: Timestamp.now(),
  });
}

export async function processSyncTask(_task: SyncTask): Promise<void> {
  // Placeholder: execution will be implemented once module-specific adapters exist.
  return;
}

export async function getSyncConfig(
  organizationId: string,
  sourceModule: ModuleId,
  targetModule: ModuleId,
  entityType: string
): Promise<SyncConfig | null> {
  const q = query(
    collection(db, COLLECTIONS.SYNC_CONFIG),
    where('organizationId', '==', organizationId),
    where('sourceModule', '==', sourceModule),
    where('targetModule', '==', targetModule),
    where('entityType', '==', entityType),
    limit(1)
  );

  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  return { id: snapshot.docs[0].id, ...(snapshot.docs[0].data() as object) } as SyncConfig;
}

export async function saveSyncConfig(
  config: Omit<SyncConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SyncConfig> {
  const existing = await getSyncConfig(
    config.organizationId,
    config.sourceModule,
    config.targetModule,
    config.entityType
  );

  if (existing) {
    await updateDoc(doc(db, COLLECTIONS.SYNC_CONFIG, existing.id), {
      ...config,
      updatedAt: Timestamp.now(),
    });

    return { ...existing, ...config, updatedAt: Timestamp.now() };
  }

  const docRef = await addDoc(collection(db, COLLECTIONS.SYNC_CONFIG), {
    ...config,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const snapshot = await getDoc(docRef);
  return { id: snapshot.id, ...(snapshot.data() as object) } as SyncConfig;
}

export async function getAllSyncConfigs(organizationId: string): Promise<SyncConfig[]> {
  const q = query(
    collection(db, COLLECTIONS.SYNC_CONFIG),
    where('organizationId', '==', organizationId)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as SyncConfig[];
}

async function logSyncAction(log: Omit<SyncLog, 'id' | 'timestamp'>): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.SYNC_LOG), {
    ...log,
    timestamp: Timestamp.now(),
  });
}

export async function triggerEntitySync(
  organizationId: string,
  sourceModule: ModuleId,
  entityType: string,
  entityId: string,
  data: Record<string, unknown>
): Promise<void> {
  const relationships = MODULE_RELATIONSHIPS.filter(
    (r) => r.sourceModule === sourceModule && r.dataPoints.includes(entityType)
  );

  for (const relationship of relationships) {
    const config = await getSyncConfig(
      organizationId,
      sourceModule,
      relationship.targetModule,
      entityType
    );

    if (config?.enabled && config.syncFrequency === 'realtime') {
      await queueSyncTask({
        organizationId,
        sourceModule,
        targetModule: relationship.targetModule,
        entityType,
        entityId,
        direction: 'push',
        priority: 1,
        data,
        maxRetries: 3,
      });

      await logSyncAction({
        taskId: 'n/a',
        organizationId,
        sourceModule,
        targetModule: relationship.targetModule,
        entityType,
        entityId,
        action: 'update',
        status: 'success',
      });
    }
  }
}

export function subscribeToSyncQueue(
  organizationId: string,
  callback: (tasks: SyncTask[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.SYNC_QUEUE),
    where('organizationId', '==', organizationId),
    where('status', 'in', ['pending', 'processing']),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as object),
    })) as SyncTask[];
    callback(tasks);
  });
}
