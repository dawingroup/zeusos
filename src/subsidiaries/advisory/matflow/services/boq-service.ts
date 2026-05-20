/**
 * BOQ Service
 * 
 * Service for managing Bills of Quantities.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  runTransaction
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';

// Generate unique IDs
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
import type {
  BOQDocument,
  BOQSection,
  BOQItem,
  BOQVariation,
  BOQDocumentStatus,
  BOQSummary,
  BOQMoney,
  CreateBOQInput,
  CreateSectionInput,
  CreateItemInput
} from '../types/boq';

const BOQ_COLLECTION = 'advisoryPlatform/matflow/boqs';
const VARIATIONS_COLLECTION = 'advisoryPlatform/matflow/boqVariations';

export const boqService = {
  // ============================================================================
  // BOQ DOCUMENT OPERATIONS
  // ============================================================================
  
  /**
   * Create a new BOQ document
   */
  async createBOQ(
    input: CreateBOQInput,
    userId: string
  ): Promise<string> {
    const id = generateId();
    
    const boq: BOQDocument = {
      id,
      projectId: input.projectId,
      projectName: input.projectName,
      engagementId: input.engagementId,
      programId: input.programId,
      name: input.name,
      description: input.description,
      version: 1,
      status: 'draft',
      source: 'manual',
      parsingStatus: 'pending',
      summary: {
        totalItems: 0,
        totalSections: 0,
        totalAmount: { amount: 0, currency: 'UGX' },
        laborAmount: { amount: 0, currency: 'UGX' },
        materialAmount: { amount: 0, currency: 'UGX' },
        equipmentAmount: { amount: 0, currency: 'UGX' },
        currency: 'UGX'
      },
      sections: [],
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, BOQ_COLLECTION, id), boq);
    return id;
  },
  
  /**
   * Get BOQ by ID
   */
  async getBOQ(boqId: string): Promise<BOQDocument | null> {
    const snap = await getDoc(doc(db, BOQ_COLLECTION, boqId));
    return snap.exists() ? (snap.data() as BOQDocument) : null;
  },
  
  /**
   * Get BOQs for a project
   */
  async getBOQsForProject(projectId: string): Promise<BOQDocument[]> {
    const q = query(
      collection(db, BOQ_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('audit.createdAt', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BOQDocument);
  },
  
  /**
   * Get BOQs for an engagement
   */
  async getBOQsForEngagement(engagementId: string): Promise<BOQDocument[]> {
    const q = query(
      collection(db, BOQ_COLLECTION),
      where('engagementId', '==', engagementId),
      orderBy('audit.createdAt', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BOQDocument);
  },
  
  /**
   * Update BOQ status
   */
  async updateBOQStatus(
    boqId: string,
    status: BOQDocumentStatus,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      status,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Approve BOQ
   */
  async approveBOQ(
    boqId: string,
    userId: string,
    notes?: string
  ): Promise<void> {
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      status: 'approved',
      approval: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: Timestamp.now(),
        notes
      },
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Update BOQ metadata
   */
  async updateBOQ(
    boqId: string,
    updates: Partial<Pick<BOQDocument, 'name' | 'description'>>,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      ...updates,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // SECTION OPERATIONS
  // ============================================================================
  
  /**
   * Add section to BOQ
   */
  async addSection(
    boqId: string,
    input: CreateSectionInput,
    userId: string
  ): Promise<string> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const sectionId = generateId();
    const newSection = {
      id: sectionId,
      boqId,
      code: input.code,
      name: input.name,
      description: input.description,
      order: input.order,
      parentSectionId: input.parentSectionId,
      level: input.level,
      items: [],
      subtotal: { amount: 0, currency: boq.summary.currency }
    };
    
    const sections = [...boq.sections, newSection];
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      'summary.totalSections': sections.length,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
    
    return sectionId;
  },
  
  /**
   * Update section
   */
  async updateSection(
    boqId: string,
    sectionId: string,
    updates: Partial<CreateSectionInput>,
    userId: string
  ): Promise<void> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const sections = boq.sections.map(s =>
      s.id === sectionId ? { ...s, ...updates } : s
    );
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Delete section
   */
  async deleteSection(
    boqId: string,
    sectionId: string,
    userId: string
  ): Promise<void> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const sections = boq.sections.filter(s => s.id !== sectionId);
    const summary = this.recalculateSummary(sections);
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      summary,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Reorder sections
   */
  async reorderSections(
    boqId: string,
    sectionOrders: { sectionId: string; order: number }[],
    userId: string
  ): Promise<void> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const orderMap = new Map(sectionOrders.map(s => [s.sectionId, s.order]));
    const sections = boq.sections.map(s => ({
      ...s,
      order: orderMap.get(s.id) ?? s.order
    })).sort((a, b) => a.order - b.order);
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // ITEM OPERATIONS
  // ============================================================================
  
  /**
   * Add item to section
   */
  async addItem(
    boqId: string,
    sectionId: string,
    input: CreateItemInput,
    userId: string
  ): Promise<string> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const itemId = generateId();
    const newItem: BOQItem = {
      id: itemId,
      boqId,
      sectionId,
      itemNumber: input.itemNumber,
      description: input.description,
      specification: input.specification,
      quantity: input.quantity,
      unit: input.unit,
      laborRate: input.laborRate,
      materialRate: input.materialRate,
      equipmentRate: input.equipmentRate,
      unitRate: input.unitRate,
      laborAmount: input.laborAmount,
      materialAmount: input.materialAmount,
      equipmentAmount: input.equipmentAmount,
      totalAmount: input.totalAmount ?? {
        amount: input.unitRate.amount * input.quantity,
        currency: input.unitRate.currency,
      },
      category: input.category,
      workType: input.workType,
      tradeCode: input.tradeCode,
      order: input.order,
      procuredQuantity: 0,
      deliveredQuantity: 0,
      installedQuantity: 0
    };
    
    const sections = boq.sections.map(s => {
      if (s.id !== sectionId) return s;
      
      const items = [...s.items, newItem];
      const subtotal = this.calculateSectionSubtotal(items);
      
      return { ...s, items, subtotal };
    });
    
    const summary = this.recalculateSummary(sections);
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      summary,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
    
    return itemId;
  },
  
  /**
   * Update item
   */
  async updateItem(
    boqId: string,
    sectionId: string,
    itemId: string,
    updates: Partial<CreateItemInput>,
    userId: string
  ): Promise<void> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const sections = boq.sections.map(s => {
      if (s.id !== sectionId) return s;
      
      const items = s.items.map(i =>
        i.id === itemId ? { ...i, ...updates } : i
      );
      const subtotal = this.calculateSectionSubtotal(items);
      
      return { ...s, items, subtotal };
    });
    
    const summary = this.recalculateSummary(sections);
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      summary,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Delete item
   */
  async deleteItem(
    boqId: string,
    sectionId: string,
    itemId: string,
    userId: string
  ): Promise<void> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const sections = boq.sections.map(s => {
      if (s.id !== sectionId) return s;
      
      const items = s.items.filter(i => i.id !== itemId);
      const subtotal = this.calculateSectionSubtotal(items);
      
      return { ...s, items, subtotal };
    });
    
    const summary = this.recalculateSummary(sections);
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      summary,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Bulk add items (for import)
   */
  async bulkAddItems(
    boqId: string,
    items: Array<{
      sectionId: string;
      item: CreateItemInput;
    }>,
    userId: string
  ): Promise<string[]> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const itemIds: string[] = [];
    
    // Group items by section
    const itemsBySection = new Map<string, typeof items>();
    for (const entry of items) {
      const existing = itemsBySection.get(entry.sectionId) || [];
      existing.push(entry);
      itemsBySection.set(entry.sectionId, existing);
    }
    
    // Update sections
    const sections = boq.sections.map(s => {
      const sectionItems = itemsBySection.get(s.id);
      if (!sectionItems) return s;
      
      const newItems = sectionItems.map(({ item }) => {
        const itemId = generateId();
        itemIds.push(itemId);
        
        return {
          id: itemId,
          boqId,
          sectionId: s.id,
          itemNumber: item.itemNumber,
          description: item.description,
          specification: item.specification,
          quantity: item.quantity,
          unit: item.unit,
          laborRate: item.laborRate,
          materialRate: item.materialRate,
          equipmentRate: item.equipmentRate,
          unitRate: item.unitRate,
          laborAmount: item.laborAmount,
          materialAmount: item.materialAmount,
          equipmentAmount: item.equipmentAmount,
          totalAmount: item.totalAmount ?? {
            amount: item.unitRate.amount * item.quantity,
            currency: item.unitRate.currency,
          },
          category: item.category,
          workType: item.workType,
          tradeCode: item.tradeCode,
          order: item.order,
          procuredQuantity: 0,
          deliveredQuantity: 0,
          installedQuantity: 0
        } as BOQItem;
      });
      
      const allItems = [...s.items, ...newItems];
      const subtotal = this.calculateSectionSubtotal(allItems);
      
      return { ...s, items: allItems, subtotal };
    });
    
    const summary = this.recalculateSummary(sections);
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      summary,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
    
    return itemIds;
  },
  
  /**
   * Update item procurement tracking
   */
  async updateItemTracking(
    boqId: string,
    sectionId: string,
    itemId: string,
    tracking: {
      procuredQuantity?: number;
      deliveredQuantity?: number;
      installedQuantity?: number;
    },
    userId: string
  ): Promise<void> {
    const boq = await this.getBOQ(boqId);
    if (!boq) throw new Error('BOQ not found');
    
    const sections = boq.sections.map(s => {
      if (s.id !== sectionId) return s;
      
      const items = s.items.map(i =>
        i.id === itemId ? { ...i, ...tracking } : i
      );
      
      return { ...s, items };
    });
    
    await updateDoc(doc(db, BOQ_COLLECTION, boqId), {
      sections,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // CALCULATION HELPERS
  // ============================================================================
  
  calculateSectionSubtotal(items: BOQItem[]): BOQMoney {
    const total = items.reduce((sum, item) => sum + item.totalAmount.amount, 0);
    return {
      amount: total,
      currency: items[0]?.totalAmount.currency || 'UGX'
    };
  },
  
  recalculateSummary(sections: BOQSection[]): BOQSummary {
    let totalItems = 0;
    let totalAmount = 0;
    let laborAmount = 0;
    let materialAmount = 0;
    let equipmentAmount = 0;
    
    for (const section of sections) {
      totalItems += section.items.length;
      
      for (const item of section.items) {
        totalAmount += item.totalAmount.amount;
        laborAmount += item.laborAmount?.amount ?? 0;
        materialAmount += item.materialAmount?.amount ?? 0;
        equipmentAmount += item.equipmentAmount?.amount ?? 0;
      }
    }
    
    const currency = sections[0]?.items[0]?.totalAmount.currency || 'UGX';
    
    return {
      totalItems,
      totalSections: sections.length,
      totalAmount: { amount: totalAmount, currency },
      laborAmount: { amount: laborAmount, currency },
      materialAmount: { amount: materialAmount, currency },
      equipmentAmount: { amount: equipmentAmount, currency },
      currency
    };
  },
  
  // ============================================================================
  // VARIATION OPERATIONS
  // ============================================================================
  
  /**
   * Create BOQ variation
   */
  async createVariation(
    originalBoqId: string,
    variation: Omit<BOQVariation, 'id' | 'originalBoqId' | 'status' | 'audit'>,
    userId: string
  ): Promise<string> {
    const id = generateId();
    
    const fullVariation: BOQVariation = {
      ...variation,
      id,
      originalBoqId,
      status: 'draft',
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, VARIATIONS_COLLECTION, id), fullVariation);
    return id;
  },
  
  /**
   * Get variation by ID
   */
  async getVariation(variationId: string): Promise<BOQVariation | null> {
    const snap = await getDoc(doc(db, VARIATIONS_COLLECTION, variationId));
    return snap.exists() ? (snap.data() as BOQVariation) : null;
  },
  
  /**
   * Get variations for BOQ
   */
  async getVariationsForBOQ(boqId: string): Promise<BOQVariation[]> {
    const q = query(
      collection(db, VARIATIONS_COLLECTION),
      where('originalBoqId', '==', boqId),
      orderBy('audit.createdAt', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as BOQVariation);
  },
  
  /**
   * Submit variation for approval
   */
  async submitVariation(
    variationId: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, VARIATIONS_COLLECTION, variationId), {
      status: 'submitted',
      submittedBy: userId,
      submittedAt: Timestamp.now(),
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Approve variation and apply to BOQ
   */
  async approveAndApplyVariation(
    variationId: string,
    userId: string
  ): Promise<void> {
    await runTransaction(db, async (transaction) => {
      const variationRef = doc(db, VARIATIONS_COLLECTION, variationId);
      const variationSnap = await transaction.get(variationRef);
      
      if (!variationSnap.exists()) {
        throw new Error('Variation not found');
      }
      
      const variation = variationSnap.data() as BOQVariation;
      
      // Get original BOQ
      const boqRef = doc(db, BOQ_COLLECTION, variation.originalBoqId);
      const boqSnap = await transaction.get(boqRef);
      
      if (!boqSnap.exists()) {
        throw new Error('Original BOQ not found');
      }
      
      const boq = boqSnap.data() as BOQDocument;
      
      // Apply changes
      let sections = [...boq.sections];
      
      // Remove items
      for (const itemId of variation.removedItemIds) {
        sections = sections.map(s => ({
          ...s,
          items: s.items.filter(i => i.id !== itemId)
        }));
      }

      // Modify items
      for (const mod of variation.modifiedItems) {
        sections = sections.map(s => ({
          ...s,
          items: s.items.map(i => {
            if (i.id !== mod.itemId) return i;
            return { ...i, [mod.field]: mod.newValue };
          })
        }));
      }

      // Add items: addedItemIds is just IDs — items themselves are tracked
      // separately on the variation document. For the rollup we leave the
      // section list as-is; full item materialisation happens when a
      // variation is approved into the BOQ via a separate flow.
      
      // Recalculate subtotals
      sections = sections.map(s => ({
        ...s,
        subtotal: boqService.calculateSectionSubtotal(s.items)
      }));
      
      // Recalculate summary
      const summary = boqService.recalculateSummary(sections);
      
      // Update BOQ
      transaction.update(boqRef, {
        sections,
        summary,
        version: boq.version + 1,
        'audit.updatedAt': Timestamp.now(),
        'audit.updatedBy': userId
      });
      
      // Update variation
      transaction.update(variationRef, {
        status: 'approved',
        approvedBy: userId,
        approvedAt: Timestamp.now(),
        'audit.updatedAt': Timestamp.now(),
        'audit.updatedBy': userId
      });
    });
  },
  
  /**
   * Reject variation
   */
  async rejectVariation(
    variationId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await updateDoc(doc(db, VARIATIONS_COLLECTION, variationId), {
      status: 'rejected',
      rejectionReason: reason,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  }
};

export default boqService;
