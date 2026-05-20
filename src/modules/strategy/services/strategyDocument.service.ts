// ============================================================================
// STRATEGY DOCUMENT SERVICE - DawinOS CEO Strategy Command
// Firebase service for strategy document management
// ============================================================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  limit,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import {
  StrategyDocument,
  StrategyVersion,
  StrategicPillar,
  StrategicObjective,
  PillarMetric,
  StrategyRisk,
  StrategyAlignment,
  StrategySummary,
  PillarSummary,
  MilestoneSummary,
  StrategyDocumentFilters,
  CreateStrategyDocumentInput,
  UpdateStrategyDocumentInput,
  CreatePillarInput,
  UpdatePillarInput,
  CreateObjectiveInput,
  UpdateObjectiveInput,
  CreateMetricInput,
  UpdateMetricInput,
  CreateRiskInput,
  UpdateRiskInput,
  CreateAlignmentInput,
} from '../types/strategy.types';
import {
  STRATEGY_COLLECTIONS,
  STRATEGY_DOCUMENT_STATUS,
  STRATEGY_DEFAULTS,
  PILLAR_STATUS,
  OBJECTIVE_STATUS,
  PILLAR_CATEGORY_COLORS,
} from '../constants/strategy.constants';

// ----------------------------------------------------------------------------
// ID Generation
// ----------------------------------------------------------------------------
function generateId(): string {
  return doc(collection(db, '_')).id;
}

// ----------------------------------------------------------------------------
// Collection References
// ----------------------------------------------------------------------------
function getStrategyCollection(companyId: string) {
  return collection(db, 'companies', companyId, STRATEGY_COLLECTIONS.DOCUMENTS);
}

function getStrategyRef(companyId: string, documentId: string) {
  return doc(db, 'companies', companyId, STRATEGY_COLLECTIONS.DOCUMENTS, documentId);
}

function getVersionsCollection(companyId: string, documentId: string) {
  return collection(
    db,
    'companies',
    companyId,
    STRATEGY_COLLECTIONS.DOCUMENTS,
    documentId,
    STRATEGY_COLLECTIONS.VERSIONS
  );
}

function getAlignmentsCollection(companyId: string) {
  return collection(db, 'companies', companyId, STRATEGY_COLLECTIONS.ALIGNMENTS);
}

// ============================================================================
// STRATEGY DOCUMENT SERVICE CLASS
// ============================================================================
class StrategyDocumentService {
  // --------------------------------------------------------------------------
  // Create Strategy Document
  // --------------------------------------------------------------------------
  async createDocument(
    companyId: string,
    input: CreateStrategyDocumentInput,
    userId: string
  ): Promise<StrategyDocument> {
    const colRef = getStrategyCollection(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    // Process pillars with IDs
    const pillars: StrategicPillar[] = (input.pillars || []).map((pillar, index) => ({
      id: generateId(),
      category: pillar.category,
      name: pillar.name,
      description: pillar.description,
      weight: pillar.weight,
      order: index,
      objectives: [],
      metrics: [],
      owner: pillar.ownerId
        ? { id: pillar.ownerId, name: pillar.ownerName || '' }
        : undefined,
      status: PILLAR_STATUS.NOT_STARTED,
      progress: 0,
      color: pillar.color || PILLAR_CATEGORY_COLORS[pillar.category],
    }));

    const document: StrategyDocument = {
      id: docRef.id,
      companyId,
      type: input.type,
      title: input.title,
      subtitle: input.subtitle,
      description: input.description,
      status: STRATEGY_DOCUMENT_STATUS.DRAFT,
      scope: input.scope,
      scopeEntityId: input.scopeEntityId,
      scopeEntityName: input.scopeEntityName,
      timeHorizon: input.timeHorizon,
      effectiveFrom: Timestamp.fromDate(input.effectiveFrom),
      effectiveTo: input.effectiveTo ? Timestamp.fromDate(input.effectiveTo) : undefined,
      fiscalYear: input.fiscalYear,
      quarter: input.quarter,
      content: input.content || {},
      pillars,
      parentDocumentId: input.parentDocumentId,
      linkedDocumentIds: [],
      approvalLevel: input.approvalLevel,
      reviewFrequency: input.reviewFrequency,
      version: 1,
      tags: input.tags || [],
      attachments: [],
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    };

    await setDoc(docRef, document);
    return document;
  }

  // --------------------------------------------------------------------------
  // Get Strategy Document
  // --------------------------------------------------------------------------
  async getDocument(
    companyId: string,
    documentId: string
  ): Promise<StrategyDocument | null> {
    const docSnap = await getDoc(getStrategyRef(companyId, documentId));
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as StrategyDocument;
  }

  // --------------------------------------------------------------------------
  // Get Strategy Documents
  // --------------------------------------------------------------------------
  async getDocuments(
    companyId: string,
    filters?: StrategyDocumentFilters
  ): Promise<StrategyDocument[]> {
    let q = query(getStrategyCollection(companyId), orderBy('updatedAt', 'desc'));

    if (filters?.type) {
      q = query(q, where('type', '==', filters.type));
    }
    if (filters?.status) {
      q = query(q, where('status', '==', filters.status));
    }
    if (filters?.scope) {
      q = query(q, where('scope', '==', filters.scope));
    }
    if (filters?.scopeEntityId) {
      q = query(q, where('scopeEntityId', '==', filters.scopeEntityId));
    }
    if (filters?.fiscalYear) {
      q = query(q, where('fiscalYear', '==', filters.fiscalYear));
    }
    if (filters?.timeHorizon) {
      q = query(q, where('timeHorizon', '==', filters.timeHorizon));
    }
    if (filters?.activeOnly) {
      q = query(q, where('status', '==', STRATEGY_DOCUMENT_STATUS.ACTIVE));
    }
    if (filters?.parentDocumentId) {
      q = query(q, where('parentDocumentId', '==', filters.parentDocumentId));
    }

    const snapshot = await getDocs(q);
    let documents = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StrategyDocument[];

    // Client-side filtering for tags and search
    if (filters?.tags && filters.tags.length > 0) {
      documents = documents.filter((doc) =>
        filters.tags!.some((tag) => doc.tags.includes(tag))
      );
    }

    if (filters?.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      documents = documents.filter(
        (doc) =>
          doc.title.toLowerCase().includes(searchLower) ||
          doc.description?.toLowerCase().includes(searchLower) ||
          doc.content.summary?.toLowerCase().includes(searchLower)
      );
    }

    return documents;
  }

  // --------------------------------------------------------------------------
  // Get Active Group Strategy
  // --------------------------------------------------------------------------
  async getActiveGroupStrategy(companyId: string): Promise<StrategyDocument | null> {
    const q = query(
      getStrategyCollection(companyId),
      where('scope', '==', 'group'),
      where('status', '==', STRATEGY_DOCUMENT_STATUS.ACTIVE),
      where('type', '==', 'strategic_plan'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as StrategyDocument;
  }

  // --------------------------------------------------------------------------
  // Update Strategy Document
  // --------------------------------------------------------------------------
  async updateDocument(
    companyId: string,
    documentId: string,
    input: UpdateStrategyDocumentInput,
    userId: string
  ): Promise<StrategyDocument> {
    const existing = await this.getDocument(companyId, documentId);
    if (!existing) {
      throw new Error('Strategy document not found');
    }

    // Create version snapshot if changeLog provided
    if (input.changeLog) {
      await this.createVersion(companyId, documentId, existing, input.changeLog, userId);
    }

    const now = Timestamp.now();
    const updateData: Partial<StrategyDocument> = {
      updatedAt: now,
      updatedBy: userId,
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.subtitle !== undefined) updateData.subtitle = input.subtitle || undefined;
    if (input.description !== undefined) updateData.description = input.description || undefined;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.timeHorizon !== undefined) updateData.timeHorizon = input.timeHorizon;
    if (input.effectiveFrom !== undefined) {
      updateData.effectiveFrom = Timestamp.fromDate(input.effectiveFrom);
    }
    if (input.effectiveTo !== undefined) {
      updateData.effectiveTo = input.effectiveTo
        ? Timestamp.fromDate(input.effectiveTo)
        : undefined;
    }
    if (input.content !== undefined) {
      updateData.content = { ...existing.content, ...input.content };
    }
    if (input.approvalLevel !== undefined) updateData.approvalLevel = input.approvalLevel;
    if (input.reviewFrequency !== undefined) updateData.reviewFrequency = input.reviewFrequency;
    if (input.nextReviewDate !== undefined) {
      updateData.nextReviewDate = input.nextReviewDate
        ? Timestamp.fromDate(input.nextReviewDate)
        : undefined;
    }
    if (input.tags !== undefined) updateData.tags = input.tags || [];

    // Increment version if changeLog provided
    if (input.changeLog) {
      updateData.version = existing.version + 1;
      updateData.changeLog = input.changeLog;
    }

    await updateDoc(getStrategyRef(companyId, documentId), updateData);
    return (await this.getDocument(companyId, documentId))!;
  }

  // --------------------------------------------------------------------------
  // Delete Strategy Document
  // --------------------------------------------------------------------------
  async deleteDocument(companyId: string, documentId: string): Promise<void> {
    await deleteDoc(getStrategyRef(companyId, documentId));
  }

  // ==========================================================================
  // PILLAR MANAGEMENT
  // ==========================================================================

  async addPillar(
    companyId: string,
    documentId: string,
    input: CreatePillarInput,
    userId: string
  ): Promise<StrategicPillar> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    if (document.pillars.length >= STRATEGY_DEFAULTS.MAX_PILLARS) {
      throw new Error(`Maximum of ${STRATEGY_DEFAULTS.MAX_PILLARS} pillars allowed`);
    }

    const newPillar: StrategicPillar = {
      id: generateId(),
      category: input.category,
      name: input.name,
      description: input.description,
      weight: input.weight,
      order: document.pillars.length,
      objectives: [],
      metrics: [],
      owner: input.ownerId
        ? { id: input.ownerId, name: input.ownerName || '' }
        : undefined,
      status: PILLAR_STATUS.NOT_STARTED,
      progress: 0,
      color: input.color || PILLAR_CATEGORY_COLORS[input.category],
    };

    const updatedPillars = [...document.pillars, newPillar];

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return newPillar;
  }

  async updatePillar(
    companyId: string,
    documentId: string,
    pillarId: string,
    input: UpdatePillarInput,
    userId: string
  ): Promise<StrategicPillar> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const pillarIndex = document.pillars.findIndex((p) => p.id === pillarId);
    if (pillarIndex === -1) {
      throw new Error('Pillar not found');
    }

    const updatedPillar: StrategicPillar = {
      ...document.pillars[pillarIndex],
    };

    if (input.category !== undefined) updatedPillar.category = input.category;
    if (input.name !== undefined) updatedPillar.name = input.name;
    if (input.description !== undefined) updatedPillar.description = input.description || undefined;
    if (input.weight !== undefined) updatedPillar.weight = input.weight;
    if (input.status !== undefined) updatedPillar.status = input.status;
    if (input.progress !== undefined) updatedPillar.progress = input.progress;
    if (input.ownerId !== undefined) {
      updatedPillar.owner = input.ownerId
        ? { id: input.ownerId, name: input.ownerName || '' }
        : undefined;
    }
    if (input.color !== undefined) updatedPillar.color = input.color || undefined;

    const updatedPillars = [...document.pillars];
    updatedPillars[pillarIndex] = updatedPillar;

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return updatedPillar;
  }

  async removePillar(
    companyId: string,
    documentId: string,
    pillarId: string,
    userId: string
  ): Promise<void> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const updatedPillars = document.pillars
      .filter((p) => p.id !== pillarId)
      .map((p, index) => ({ ...p, order: index }));

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  async reorderPillars(
    companyId: string,
    documentId: string,
    pillarIds: string[],
    userId: string
  ): Promise<void> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const pillarMap = new Map(document.pillars.map((p) => [p.id, p]));
    const reorderedPillars = pillarIds
      .map((id, index) => {
        const pillar = pillarMap.get(id);
        return pillar ? { ...pillar, order: index } : null;
      })
      .filter(Boolean) as StrategicPillar[];

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: reorderedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ==========================================================================
  // OBJECTIVE MANAGEMENT
  // ==========================================================================

  async addObjective(
    companyId: string,
    documentId: string,
    input: CreateObjectiveInput,
    userId: string
  ): Promise<StrategicObjective> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const pillarIndex = document.pillars.findIndex((p) => p.id === input.pillarId);
    if (pillarIndex === -1) {
      throw new Error('Pillar not found');
    }

    const pillar = document.pillars[pillarIndex];
    if (pillar.objectives.length >= STRATEGY_DEFAULTS.MAX_OBJECTIVES_PER_PILLAR) {
      throw new Error(
        `Maximum of ${STRATEGY_DEFAULTS.MAX_OBJECTIVES_PER_PILLAR} objectives per pillar`
      );
    }

    const newObjective: StrategicObjective = {
      id: generateId(),
      pillarId: input.pillarId,
      title: input.title,
      description: input.description,
      targetDate: input.targetDate ? Timestamp.fromDate(input.targetDate) : undefined,
      priority: input.priority,
      status: OBJECTIVE_STATUS.NOT_STARTED,
      progress: 0,
      linkedOKRIds: [],
      linkedKPIIds: [],
      assigneeId: input.assigneeId,
      assigneeName: input.assigneeName,
    };

    const updatedPillar = {
      ...pillar,
      objectives: [...pillar.objectives, newObjective],
    };

    const updatedPillars = [...document.pillars];
    updatedPillars[pillarIndex] = updatedPillar;

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return newObjective;
  }

  async updateObjective(
    companyId: string,
    documentId: string,
    pillarId: string,
    objectiveId: string,
    input: UpdateObjectiveInput,
    userId: string
  ): Promise<StrategicObjective> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const pillarIndex = document.pillars.findIndex((p) => p.id === pillarId);
    if (pillarIndex === -1) {
      throw new Error('Pillar not found');
    }

    const pillar = document.pillars[pillarIndex];
    const objectiveIndex = pillar.objectives.findIndex((o) => o.id === objectiveId);
    if (objectiveIndex === -1) {
      throw new Error('Objective not found');
    }

    const updatedObjective: StrategicObjective = {
      ...pillar.objectives[objectiveIndex],
    };

    if (input.title !== undefined) updatedObjective.title = input.title;
    if (input.description !== undefined) updatedObjective.description = input.description || undefined;
    if (input.targetDate !== undefined) {
      updatedObjective.targetDate = input.targetDate
        ? Timestamp.fromDate(input.targetDate)
        : undefined;
    }
    if (input.priority !== undefined) updatedObjective.priority = input.priority;
    if (input.status !== undefined) updatedObjective.status = input.status;
    if (input.progress !== undefined) updatedObjective.progress = input.progress;
    if (input.linkedOKRIds !== undefined) updatedObjective.linkedOKRIds = input.linkedOKRIds;
    if (input.linkedKPIIds !== undefined) updatedObjective.linkedKPIIds = input.linkedKPIIds;
    if (input.notes !== undefined) updatedObjective.notes = input.notes || undefined;
    if (input.assigneeId !== undefined) updatedObjective.assigneeId = input.assigneeId || undefined;
    if (input.assigneeName !== undefined) updatedObjective.assigneeName = input.assigneeName || undefined;

    const updatedObjectives = [...pillar.objectives];
    updatedObjectives[objectiveIndex] = updatedObjective;

    const updatedPillar = { ...pillar, objectives: updatedObjectives };
    const updatedPillars = [...document.pillars];
    updatedPillars[pillarIndex] = updatedPillar;

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return updatedObjective;
  }

  async removeObjective(
    companyId: string,
    documentId: string,
    pillarId: string,
    objectiveId: string,
    userId: string
  ): Promise<void> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const pillarIndex = document.pillars.findIndex((p) => p.id === pillarId);
    if (pillarIndex === -1) {
      throw new Error('Pillar not found');
    }

    const pillar = document.pillars[pillarIndex];
    const updatedObjectives = pillar.objectives.filter((o) => o.id !== objectiveId);

    const updatedPillar = { ...pillar, objectives: updatedObjectives };
    const updatedPillars = [...document.pillars];
    updatedPillars[pillarIndex] = updatedPillar;

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ==========================================================================
  // METRIC MANAGEMENT
  // ==========================================================================

  async addMetric(
    companyId: string,
    documentId: string,
    input: CreateMetricInput,
    userId: string
  ): Promise<PillarMetric> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const pillarIndex = document.pillars.findIndex((p) => p.id === input.pillarId);
    if (pillarIndex === -1) {
      throw new Error('Pillar not found');
    }

    const pillar = document.pillars[pillarIndex];
    if (pillar.metrics.length >= STRATEGY_DEFAULTS.MAX_METRICS_PER_PILLAR) {
      throw new Error(
        `Maximum of ${STRATEGY_DEFAULTS.MAX_METRICS_PER_PILLAR} metrics per pillar`
      );
    }

    const newMetric: PillarMetric = {
      id: generateId(),
      name: input.name,
      description: input.description,
      targetValue: input.targetValue,
      baselineValue: input.baselineValue,
      unit: input.unit,
      direction: input.direction,
      source: input.source,
    };

    const updatedPillar = {
      ...pillar,
      metrics: [...pillar.metrics, newMetric],
    };

    const updatedPillars = [...document.pillars];
    updatedPillars[pillarIndex] = updatedPillar;

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return newMetric;
  }

  async updateMetric(
    companyId: string,
    documentId: string,
    pillarId: string,
    metricId: string,
    input: UpdateMetricInput,
    userId: string
  ): Promise<PillarMetric> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const pillarIndex = document.pillars.findIndex((p) => p.id === pillarId);
    if (pillarIndex === -1) {
      throw new Error('Pillar not found');
    }

    const pillar = document.pillars[pillarIndex];
    const metricIndex = pillar.metrics.findIndex((m) => m.id === metricId);
    if (metricIndex === -1) {
      throw new Error('Metric not found');
    }

    const updatedMetric: PillarMetric = {
      ...pillar.metrics[metricIndex],
    };

    if (input.name !== undefined) updatedMetric.name = input.name;
    if (input.description !== undefined) updatedMetric.description = input.description || undefined;
    if (input.targetValue !== undefined) updatedMetric.targetValue = input.targetValue;
    if (input.currentValue !== undefined) {
      updatedMetric.currentValue = input.currentValue;
      updatedMetric.lastUpdatedAt = Timestamp.now();
    }
    if (input.unit !== undefined) updatedMetric.unit = input.unit;
    if (input.direction !== undefined) updatedMetric.direction = input.direction;
    if (input.source !== undefined) updatedMetric.source = input.source || undefined;

    const updatedMetrics = [...pillar.metrics];
    updatedMetrics[metricIndex] = updatedMetric;

    const updatedPillar = { ...pillar, metrics: updatedMetrics };
    const updatedPillars = [...document.pillars];
    updatedPillars[pillarIndex] = updatedPillar;

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return updatedMetric;
  }

  async removeMetric(
    companyId: string,
    documentId: string,
    pillarId: string,
    metricId: string,
    userId: string
  ): Promise<void> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const pillarIndex = document.pillars.findIndex((p) => p.id === pillarId);
    if (pillarIndex === -1) {
      throw new Error('Pillar not found');
    }

    const pillar = document.pillars[pillarIndex];
    const updatedMetrics = pillar.metrics.filter((m) => m.id !== metricId);

    const updatedPillar = { ...pillar, metrics: updatedMetrics };
    const updatedPillars = [...document.pillars];
    updatedPillars[pillarIndex] = updatedPillar;

    await updateDoc(getStrategyRef(companyId, documentId), {
      pillars: updatedPillars,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ==========================================================================
  // RISK MANAGEMENT
  // ==========================================================================

  async addRisk(
    companyId: string,
    documentId: string,
    input: CreateRiskInput,
    userId: string
  ): Promise<StrategyRisk> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const risks = document.content.risks || [];
    if (risks.length >= STRATEGY_DEFAULTS.MAX_RISKS) {
      throw new Error(`Maximum of ${STRATEGY_DEFAULTS.MAX_RISKS} risks allowed`);
    }

    const newRisk: StrategyRisk = {
      id: generateId(),
      description: input.description,
      likelihood: input.likelihood,
      impact: input.impact,
      mitigation: input.mitigation,
      owner: input.owner,
      ownerName: input.ownerName,
      status: 'identified',
      identifiedAt: Timestamp.now(),
    };

    await updateDoc(getStrategyRef(companyId, documentId), {
      'content.risks': [...risks, newRisk],
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return newRisk;
  }

  async updateRisk(
    companyId: string,
    documentId: string,
    riskId: string,
    input: UpdateRiskInput,
    userId: string
  ): Promise<StrategyRisk> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const risks = document.content.risks || [];
    const riskIndex = risks.findIndex((r) => r.id === riskId);
    if (riskIndex === -1) {
      throw new Error('Risk not found');
    }

    const updatedRisk: StrategyRisk = { ...risks[riskIndex] };

    if (input.description !== undefined) updatedRisk.description = input.description;
    if (input.likelihood !== undefined) updatedRisk.likelihood = input.likelihood;
    if (input.impact !== undefined) updatedRisk.impact = input.impact;
    if (input.mitigation !== undefined) updatedRisk.mitigation = input.mitigation || undefined;
    if (input.owner !== undefined) updatedRisk.owner = input.owner || undefined;
    if (input.ownerName !== undefined) updatedRisk.ownerName = input.ownerName || undefined;
    if (input.status !== undefined) {
      updatedRisk.status = input.status;
      if (input.status === 'mitigated') {
        updatedRisk.mitigatedAt = Timestamp.now();
      }
    }

    const updatedRisks = [...risks];
    updatedRisks[riskIndex] = updatedRisk;

    await updateDoc(getStrategyRef(companyId, documentId), {
      'content.risks': updatedRisks,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return updatedRisk;
  }

  async removeRisk(
    companyId: string,
    documentId: string,
    riskId: string,
    userId: string
  ): Promise<void> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Strategy document not found');
    }

    const risks = document.content.risks || [];
    const updatedRisks = risks.filter((r) => r.id !== riskId);

    await updateDoc(getStrategyRef(companyId, documentId), {
      'content.risks': updatedRisks,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  }

  // ==========================================================================
  // VERSIONING
  // ==========================================================================

  private async createVersion(
    companyId: string,
    documentId: string,
    document: StrategyDocument,
    changeLog: string,
    userId: string
  ): Promise<StrategyVersion> {
    const versionsRef = getVersionsCollection(companyId, documentId);
    const versionDoc = doc(versionsRef);

    const version: StrategyVersion = {
      id: versionDoc.id,
      documentId,
      version: document.version,
      title: document.title,
      content: document.content,
      pillars: document.pillars,
      changeLog,
      changedBy: userId,
      changedAt: Timestamp.now(),
      snapshot: {
        type: document.type,
        status: document.status,
        scope: document.scope,
        timeHorizon: document.timeHorizon,
        effectiveFrom: document.effectiveFrom,
        effectiveTo: document.effectiveTo,
        approvalLevel: document.approvalLevel,
        reviewFrequency: document.reviewFrequency,
      },
    };

    await setDoc(versionDoc, version);
    return version;
  }

  async getVersionHistory(
    companyId: string,
    documentId: string
  ): Promise<StrategyVersion[]> {
    const q = query(
      getVersionsCollection(companyId, documentId),
      orderBy('version', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StrategyVersion[];
  }

  async restoreVersion(
    companyId: string,
    documentId: string,
    versionId: string,
    userId: string
  ): Promise<StrategyDocument> {
    const versionRef = doc(getVersionsCollection(companyId, documentId), versionId);
    const versionSnap = await getDoc(versionRef);

    if (!versionSnap.exists()) {
      throw new Error('Version not found');
    }

    const version = versionSnap.data() as StrategyVersion;
    const currentDocument = await this.getDocument(companyId, documentId);

    if (!currentDocument) {
      throw new Error('Document not found');
    }

    // Create version of current state before restoring
    await this.createVersion(
      companyId,
      documentId,
      currentDocument,
      `Rolled back to version ${version.version}`,
      userId
    );

    // Restore from version
    await updateDoc(getStrategyRef(companyId, documentId), {
      title: version.title,
      content: version.content,
      pillars: version.pillars,
      version: currentDocument.version + 1,
      changeLog: `Restored from version ${version.version}`,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return (await this.getDocument(companyId, documentId))!;
  }

  // ==========================================================================
  // APPROVAL WORKFLOW
  // ==========================================================================

  async submitForApproval(
    companyId: string,
    documentId: string,
    userId: string
  ): Promise<StrategyDocument> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== STRATEGY_DOCUMENT_STATUS.DRAFT) {
      throw new Error('Only draft documents can be submitted for approval');
    }

    await updateDoc(getStrategyRef(companyId, documentId), {
      status: STRATEGY_DOCUMENT_STATUS.IN_REVIEW,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return (await this.getDocument(companyId, documentId))!;
  }

  async approveDocument(
    companyId: string,
    documentId: string,
    approverId: string,
    approverName?: string
  ): Promise<StrategyDocument> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== STRATEGY_DOCUMENT_STATUS.IN_REVIEW) {
      throw new Error('Document is not in review');
    }

    const now = Timestamp.now();

    await updateDoc(getStrategyRef(companyId, documentId), {
      status: STRATEGY_DOCUMENT_STATUS.APPROVED,
      approvedBy: approverId,
      approvedByName: approverName,
      approvedAt: now,
      updatedAt: now,
      updatedBy: approverId,
    });

    return (await this.getDocument(companyId, documentId))!;
  }

  async rejectDocument(
    companyId: string,
    documentId: string,
    rejectorId: string,
    reason: string
  ): Promise<StrategyDocument> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== STRATEGY_DOCUMENT_STATUS.IN_REVIEW) {
      throw new Error('Document is not in review');
    }

    await updateDoc(getStrategyRef(companyId, documentId), {
      status: STRATEGY_DOCUMENT_STATUS.DRAFT,
      changeLog: `Rejected: ${reason}`,
      updatedAt: Timestamp.now(),
      updatedBy: rejectorId,
    });

    return (await this.getDocument(companyId, documentId))!;
  }

  async activateDocument(
    companyId: string,
    documentId: string,
    userId: string
  ): Promise<StrategyDocument> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    if (document.status !== STRATEGY_DOCUMENT_STATUS.APPROVED) {
      throw new Error('Only approved documents can be activated');
    }

    const batch = writeBatch(db);
    const now = Timestamp.now();

    // Supersede any existing active documents of same type/scope
    const existingActive = await this.getDocuments(companyId, {
      type: document.type,
      scope: document.scope,
      scopeEntityId: document.scopeEntityId,
      activeOnly: true,
    });

    for (const existing of existingActive) {
      if (existing.id !== documentId) {
        batch.update(getStrategyRef(companyId, existing.id), {
          status: STRATEGY_DOCUMENT_STATUS.SUPERSEDED,
          updatedAt: now,
          updatedBy: userId,
        });
      }
    }

    // Activate the new document
    batch.update(getStrategyRef(companyId, documentId), {
      status: STRATEGY_DOCUMENT_STATUS.ACTIVE,
      updatedAt: now,
      updatedBy: userId,
    });

    await batch.commit();
    return (await this.getDocument(companyId, documentId))!;
  }

  async archiveDocument(
    companyId: string,
    documentId: string,
    userId: string
  ): Promise<StrategyDocument> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    await updateDoc(getStrategyRef(companyId, documentId), {
      status: STRATEGY_DOCUMENT_STATUS.ARCHIVED,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    return (await this.getDocument(companyId, documentId))!;
  }

  // ==========================================================================
  // STRATEGY SUMMARY
  // ==========================================================================

  async getStrategySummary(
    companyId: string,
    documentId: string
  ): Promise<StrategySummary> {
    const document = await this.getDocument(companyId, documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Calculate overall progress (weighted by pillar weights)
    const overallProgress =
      document.pillars.length > 0
        ? document.pillars.reduce(
            (sum, p) => sum + (p.progress || 0) * (p.weight / 100),
            0
          )
        : 0;

    // Calculate pillar summaries
    const pillarSummaries: PillarSummary[] = document.pillars.map((p) => ({
      pillarId: p.id,
      name: p.name,
      category: p.category,
      weight: p.weight,
      progress: p.progress,
      status: p.status,
      objectivesTotal: p.objectives.length,
      objectivesCompleted: p.objectives.filter(
        (o) => o.status === OBJECTIVE_STATUS.COMPLETED
      ).length,
    }));

    // Get upcoming milestones
    const now = new Date();
    const upcomingMilestones: MilestoneSummary[] = document.pillars
      .flatMap((p) =>
        p.objectives
          .filter(
            (o) =>
              o.targetDate &&
              o.status !== OBJECTIVE_STATUS.COMPLETED &&
              o.status !== OBJECTIVE_STATUS.CANCELLED
          )
          .map((o) => ({
            objectiveId: o.id,
            pillarId: p.id,
            title: o.title,
            targetDate: o.targetDate!,
            daysRemaining: Math.ceil(
              (o.targetDate!.toDate().getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            ),
            priority: o.priority,
            status: o.status,
          }))
      )
      .filter((m) => m.daysRemaining > 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);

    // Count objectives
    const objectivesTotal = document.pillars.reduce(
      (sum, p) => sum + p.objectives.length,
      0
    );
    const objectivesCompleted = document.pillars.reduce(
      (sum, p) =>
        sum + p.objectives.filter((o) => o.status === OBJECTIVE_STATUS.COMPLETED).length,
      0
    );

    // Count at-risk items
    const risksAtRisk =
      document.content.risks?.filter(
        (r) =>
          r.status !== 'mitigated' &&
          r.status !== 'accepted' &&
          (r.likelihood === 'high' || r.impact === 'high')
      ).length || 0;

    // Calculate days until review
    let daysUntilReview: number | undefined;
    if (document.nextReviewDate) {
      daysUntilReview = Math.ceil(
        (document.nextReviewDate.toDate().getTime() - now.getTime()) /
          (1000 * 60 * 60 * 24)
      );
    }

    return {
      documentId: document.id,
      title: document.title,
      type: document.type,
      status: document.status,
      scope: document.scope,
      scopeEntityName: document.scopeEntityName,
      overallProgress: Math.round(overallProgress),
      pillarSummaries,
      upcomingMilestones,
      risksAtRisk,
      objectivesTotal,
      objectivesCompleted,
      lastReviewDate: document.lastReviewDate,
      nextReviewDate: document.nextReviewDate,
      daysUntilReview,
    };
  }

  // ==========================================================================
  // ALIGNMENT MANAGEMENT
  // ==========================================================================

  async createAlignment(
    companyId: string,
    input: CreateAlignmentInput,
    userId: string
  ): Promise<StrategyAlignment> {
    const colRef = getAlignmentsCollection(companyId);
    const docRef = doc(colRef);
    const now = Timestamp.now();

    // Get document and pillar names
    const document = await this.getDocument(companyId, input.strategyDocumentId);
    const pillar = document?.pillars.find((p) => p.id === input.pillarId);
    const objective = input.objectiveId
      ? pillar?.objectives.find((o) => o.id === input.objectiveId)
      : undefined;

    const alignment: StrategyAlignment = {
      id: docRef.id,
      companyId,
      strategyDocumentId: input.strategyDocumentId,
      strategyDocumentTitle: document?.title,
      pillarId: input.pillarId,
      pillarName: pillar?.name,
      objectiveId: input.objectiveId,
      objectiveTitle: objective?.title,
      alignedEntityType: input.alignedEntityType,
      alignedEntityId: input.alignedEntityId,
      alignedEntityName: input.alignedEntityName,
      alignmentStrength: input.alignmentStrength,
      contributionDescription: input.contributionDescription,
      createdAt: now,
      createdBy: userId,
    };

    await setDoc(docRef, alignment);
    return alignment;
  }

  async getAlignments(
    companyId: string,
    filters?: {
      strategyDocumentId?: string;
      pillarId?: string;
      objectiveId?: string;
      alignedEntityType?: string;
      alignedEntityId?: string;
    }
  ): Promise<StrategyAlignment[]> {
    let q = query(getAlignmentsCollection(companyId));

    if (filters?.strategyDocumentId) {
      q = query(q, where('strategyDocumentId', '==', filters.strategyDocumentId));
    }
    if (filters?.pillarId) {
      q = query(q, where('pillarId', '==', filters.pillarId));
    }
    if (filters?.objectiveId) {
      q = query(q, where('objectiveId', '==', filters.objectiveId));
    }
    if (filters?.alignedEntityType) {
      q = query(q, where('alignedEntityType', '==', filters.alignedEntityType));
    }
    if (filters?.alignedEntityId) {
      q = query(q, where('alignedEntityId', '==', filters.alignedEntityId));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as StrategyAlignment[];
  }

  async deleteAlignment(companyId: string, alignmentId: string): Promise<void> {
    await deleteDoc(doc(getAlignmentsCollection(companyId), alignmentId));
  }
}

// Export singleton instance
export const strategyDocumentService = new StrategyDocumentService();
