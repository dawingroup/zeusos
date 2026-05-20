/**
 * Cross-Module Service
 * Core cross-module reference + metrics + activity utilities
 */

import {
  collection,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  CrossModuleMetric,
  CrossModuleReference,
  CrossModuleSummary,
} from '@/integration/types';
import {
  DAWINOS_MODULES,
  MODULE_RELATIONSHIPS,
  type ModuleId,
} from '@/integration/constants';

const COLLECTIONS = {
  CROSS_REFS: 'cross_module_references',
  METRICS: 'cross_module_metrics',
  ACTIVITY: 'cross_module_activity',
} as const;

export interface ActivityEntry {
  id: string;
  organizationId: string;
  userId: string;
  module: ModuleId;
  action: string;
  entityType: string;
  entityId: string;
  entityTitle: string;
  metadata?: Record<string, unknown>;
  timestamp: Timestamp;
}

export type CrossModuleReferenceRecord = CrossModuleReference & { id: string; updatedAt?: Timestamp };

export async function createCrossModuleReference(
  reference: Omit<CrossModuleReference, 'createdAt'>
): Promise<CrossModuleReferenceRecord> {
  const docRef = await addDoc(collection(db, COLLECTIONS.CROSS_REFS), {
    ...reference,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  const snapshot = await getDoc(docRef);
  return { id: snapshot.id, ...(snapshot.data() as object) } as CrossModuleReferenceRecord;
}

export async function getCrossModuleReferences(
  entityId: string,
  entityType: string
): Promise<CrossModuleReferenceRecord[]> {
  const sourceQuery = query(
    collection(db, COLLECTIONS.CROSS_REFS),
    where('sourceEntityId', '==', entityId),
    where('sourceEntityType', '==', entityType)
  );

  const targetQuery = query(
    collection(db, COLLECTIONS.CROSS_REFS),
    where('targetEntityId', '==', entityId),
    where('targetEntityType', '==', entityType)
  );

  const [sourceSnapshot, targetSnapshot] = await Promise.all([
    getDocs(sourceQuery),
    getDocs(targetQuery),
  ]);

  const references: CrossModuleReferenceRecord[] = [];

  sourceSnapshot.docs.forEach((d) => {
    references.push({ id: d.id, ...(d.data() as object) } as CrossModuleReferenceRecord);
  });

  targetSnapshot.docs.forEach((d) => {
    references.push({ id: d.id, ...(d.data() as object) } as CrossModuleReferenceRecord);
  });

  return references;
}

export async function getRelatedEntities(
  entityId: string,
  entityType: string,
  targetModule?: ModuleId
): Promise<
  { entityId: string; entityType: string; module: ModuleId; title: string }[]
> {
  const references = await getCrossModuleReferences(entityId, entityType);

  const relatedEntities: {
    entityId: string;
    entityType: string;
    module: ModuleId;
    title: string;
  }[] = [];

  for (const ref of references) {
    const isSource = ref.sourceEntityId === entityId;
    const relatedId = isSource ? ref.targetEntityId : ref.sourceEntityId;
    const relatedType = isSource ? ref.targetEntityType : ref.sourceEntityType;
    const relatedModule = isSource ? ref.targetModule : ref.sourceModule;

    if (targetModule && relatedModule !== targetModule) continue;

    relatedEntities.push({
      entityId: relatedId,
      entityType: relatedType,
      module: relatedModule,
      title: (ref.metadata as any)?.title || relatedId,
    });
  }

  return relatedEntities;
}

export async function getCrossModuleMetrics(
  organizationId: string
): Promise<CrossModuleMetric[]> {
  const q = query(
    collection(db, COLLECTIONS.METRICS),
    where('organizationId', '==', organizationId),
    orderBy('calculatedAt', 'desc'),
    limit(50)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as CrossModuleMetric[];
}

export async function calculateModuleSummary(
  organizationId: string,
  module: ModuleId
): Promise<CrossModuleSummary> {
  const summary: CrossModuleSummary = {
    module,
    metrics: [],
    alerts: [],
    pendingItems: 0,
    lastActivity: Timestamp.now(),
  };

  await addDoc(collection(db, COLLECTIONS.METRICS), {
    organizationId,
    type: 'module_summary',
    module,
    data: summary,
    calculatedAt: Timestamp.now(),
  });

  return summary;
}

export async function getAllModuleSummaries(
  organizationId: string
): Promise<Record<ModuleId, CrossModuleSummary>> {
  const summaries = {} as Record<ModuleId, CrossModuleSummary>;

  const moduleIds = Object.values(DAWINOS_MODULES) as ModuleId[];

  for (const module of moduleIds) {
    const q = query(
      collection(db, COLLECTIONS.METRICS),
      where('organizationId', '==', organizationId),
      where('type', '==', 'module_summary'),
      where('module', '==', module),
      orderBy('calculatedAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const row = snapshot.docs[0].data() as any;
      summaries[module] = row.data as CrossModuleSummary;
    } else {
      summaries[module] = {
        module,
        metrics: [],
        alerts: [],
        pendingItems: 0,
        lastActivity: Timestamp.now(),
      };
    }
  }

  return summaries;
}

export async function logActivity(
  entry: Omit<ActivityEntry, 'id' | 'timestamp'>
): Promise<void> {
  await addDoc(collection(db, COLLECTIONS.ACTIVITY), {
    ...entry,
    timestamp: Timestamp.now(),
  });
}

export async function getRecentActivity(
  organizationId: string,
  userId?: string,
  moduleFilter?: ModuleId[],
  pageSize: number = 20
): Promise<ActivityEntry[]> {
  let q = query(
    collection(db, COLLECTIONS.ACTIVITY),
    where('organizationId', '==', organizationId),
    orderBy('timestamp', 'desc'),
    limit(pageSize)
  );

  if (userId) {
    q = query(
      collection(db, COLLECTIONS.ACTIVITY),
      where('organizationId', '==', organizationId),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(pageSize)
    );
  }

  const snapshot = await getDocs(q);
  const activities = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as object),
  })) as ActivityEntry[];

  if (moduleFilter?.length) {
    return activities.filter((a) => moduleFilter.includes(a.module));
  }

  return activities;
}

export function subscribeToActivity(
  organizationId: string,
  callback: (activities: ActivityEntry[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.ACTIVITY),
    where('organizationId', '==', organizationId),
    orderBy('timestamp', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const activities = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as object),
    })) as ActivityEntry[];
    callback(activities);
  });
}

export function getModuleDataFlows(sourceModule: ModuleId): {
  targetModule: ModuleId;
  dataTypes: string[];
  direction: 'outbound' | 'inbound' | 'bidirectional';
}[] {
  const flows: {
    targetModule: ModuleId;
    dataTypes: string[];
    direction: 'outbound' | 'inbound' | 'bidirectional';
  }[] = [];

  for (const relationship of MODULE_RELATIONSHIPS) {
    if (relationship.sourceModule === sourceModule) {
      flows.push({
        targetModule: relationship.targetModule,
        dataTypes: relationship.dataPoints,
        direction: 'outbound',
      });
    }
    if (relationship.targetModule === sourceModule) {
      flows.push({
        targetModule: relationship.sourceModule,
        dataTypes: relationship.dataPoints,
        direction: 'inbound',
      });
    }
  }

  return flows;
}

export async function validateCrossModuleConsistency(
  organizationId: string
): Promise<{
  isValid: boolean;
  issues: { module: ModuleId; entityId: string; issue: string }[];
}> {
  const issues: { module: ModuleId; entityId: string; issue: string }[] = [];

  const refsQuery = query(
    collection(db, COLLECTIONS.CROSS_REFS),
    where('organizationId', '==', organizationId)
  );

  const refsSnapshot = await getDocs(refsQuery);

  for (const refDoc of refsSnapshot.docs) {
    const ref = refDoc.data() as CrossModuleReference;

    if (!ref.sourceEntityId) {
      issues.push({
        module: ref.sourceModule,
        entityId: String(ref.sourceEntityId || ''),
        issue: 'Missing source entity reference',
      });
    }

    if (!ref.targetEntityId) {
      issues.push({
        module: ref.targetModule,
        entityId: String(ref.targetEntityId || ''),
        issue: 'Missing target entity reference',
      });
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}
