/**
 * Material Service
 * 
 * Service for managing materials and project materials.
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import { stripUndefined } from '../utils/stripUndefined';

// Generate unique IDs
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};
import type {
  Material,
  MaterialCatalog,
  ProjectMaterial,
  MaterialTransfer,
  CreateMaterialInput,
  CreateProjectMaterialInput,
  MaterialCategoryExtended,
  ProjectMaterialStatus
} from '../types/material';
import type { BOQMoney } from '../types/boq';

const MATERIALS_COLLECTION = 'advisoryPlatform/matflow/materials';
const CATALOGS_COLLECTION = 'advisoryPlatform/matflow/materialCatalogs';
const PROJECT_MATERIALS_COLLECTION = 'advisoryPlatform/matflow/projectMaterials';
const TRANSFERS_COLLECTION = 'advisoryPlatform/matflow/materialTransfers';

export const materialService = {
  // ============================================================================
  // MATERIAL LIBRARY OPERATIONS
  // ============================================================================
  
  /**
   * Create a new material in the library
   */
  async createMaterial(
    input: CreateMaterialInput,
    userId: string
  ): Promise<string> {
    const id = generateId();
    
    const material: Material = {
      id,
      code: input.code,
      name: input.name,
      description: input.description,
      category: input.category,
      ...(input.subcategory ? { subcategory: input.subcategory } : {}),
      specifications: input.specifications || [],
      baseUnit: input.baseUnit,
      standardRate: input.standardRate,
      rateHistory: [{
        rate: input.standardRate,
        effectiveFrom: Timestamp.now(),
        source: 'standard'
      }],
      preferredSuppliers: input.preferredSuppliers || [],
      isActive: true,
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, MATERIALS_COLLECTION, id), material);
    return id;
  },
  
  /**
   * Get material by ID
   */
  async getMaterial(materialId: string): Promise<Material | null> {
    const snap = await getDoc(doc(db, MATERIALS_COLLECTION, materialId));
    return snap.exists() ? (snap.data() as Material) : null;
  },
  
  /**
   * Batch-fetch materials by IDs (Firestore 'in' max 30 per query)
   */
  async getMaterialsByIds(ids: string[]): Promise<Material[]> {
    if (!ids.length) return [];
    const unique = [...new Set(ids.filter(Boolean))];
    const results: Material[] = [];
    for (let i = 0; i < unique.length; i += 30) {
      const batch = unique.slice(i, i + 30);
      const q = query(
        collection(db, MATERIALS_COLLECTION),
        where(documentId(), 'in', batch)
      );
      const snap = await getDocs(q);
      snap.forEach(d => results.push({ id: d.id, ...d.data() } as Material));
    }
    return results;
  },

  /**
   * Get material by code
   */
  async getMaterialByCode(code: string): Promise<Material | null> {
    const q = query(
      collection(db, MATERIALS_COLLECTION),
      where('code', '==', code),
      limit(1)
    );
    
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as Material);
  },
  
  /**
   * Get all materials
   */
  async getAllMaterials(): Promise<Material[]> {
    const q = query(
      collection(db, MATERIALS_COLLECTION),
      where('isActive', '==', true),
      orderBy('name')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Material);
  },
  
  /**
   * Get materials by category
   */
  async getMaterialsByCategory(category: MaterialCategoryExtended): Promise<Material[]> {
    const q = query(
      collection(db, MATERIALS_COLLECTION),
      where('category', '==', category),
      where('isActive', '==', true),
      orderBy('name')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Material);
  },
  
  /**
   * Search materials
   */
  async searchMaterials(searchQuery: string): Promise<Material[]> {
    // Get all active materials and filter client-side
    // In production, consider using Algolia or similar for better search
    const materials = await this.getAllMaterials();
    const query = searchQuery.toLowerCase();
    
    return materials.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.code.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query)
    );
  },
  
  /**
   * Update material
   */
  async updateMaterial(
    materialId: string,
    updates: Partial<Omit<Material, 'id' | 'audit'>>,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), {
      ...stripUndefined(updates as Record<string, any>),
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Update material rate
   */
  async updateMaterialRate(
    materialId: string,
    newRate: BOQMoney,
    source: 'standard' | 'purchase' | 'quotation' | 'estimate' | 'market',
    userId: string,
    supplierId?: string
  ): Promise<void> {
    const material = await this.getMaterial(materialId);
    if (!material) throw new Error('Material not found');
    
    // Close previous rate period
    const rateHistory = material.rateHistory.map((r, i) => {
      if (i === 0 && !r.effectiveTo) {
        return { ...r, effectiveTo: Timestamp.now() };
      }
      return r;
    });
    
    // Add new rate
    rateHistory.unshift({
      rate: newRate,
      effectiveFrom: Timestamp.now(),
      source,
      supplierId
    });
    
    await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), {
      standardRate: newRate,
      lastPurchaseRate: source === 'purchase' ? newRate : material.lastPurchaseRate,
      rateHistory,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Deactivate material
   */
  async deactivateMaterial(materialId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, MATERIALS_COLLECTION, materialId), {
      isActive: false,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // PROJECT MATERIAL OPERATIONS
  // ============================================================================
  
  /**
   * Add material to project
   */
  async addProjectMaterial(
    input: CreateProjectMaterialInput,
    userId: string
  ): Promise<string> {
    const material = await this.getMaterial(input.materialId);
    if (!material) throw new Error('Material not found');
    
    const id = generateId();
    
    const projectMaterial: ProjectMaterial = {
      id,
      projectId: input.projectId,
      materialId: input.materialId,
      boqItemIds: input.boqItemIds,
      materialCode: material.code,
      materialName: material.name,
      category: material.category,
      unit: material.baseUnit,
      boqQuantity: input.boqQuantity,
      requisitionedQuantity: 0,
      orderedQuantity: 0,
      deliveredQuantity: 0,
      usedQuantity: 0,
      wasteQuantity: 0,
      budgetRate: input.budgetRate,
      budgetAmount: {
        amount: input.budgetRate.amount * input.boqQuantity,
        currency: input.budgetRate.currency
      },
      quantityVariance: 0,
      status: 'planned',
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, PROJECT_MATERIALS_COLLECTION, id), projectMaterial);
    return id;
  },
  
  /**
   * Get project material by ID
   */
  async getProjectMaterial(projectMaterialId: string): Promise<ProjectMaterial | null> {
    const snap = await getDoc(doc(db, PROJECT_MATERIALS_COLLECTION, projectMaterialId));
    return snap.exists() ? (snap.data() as ProjectMaterial) : null;
  },
  
  /**
   * Get all materials for a project
   */
  async getProjectMaterials(projectId: string): Promise<ProjectMaterial[]> {
    const q = query(
      collection(db, PROJECT_MATERIALS_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('materialName')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ProjectMaterial);
  },
  
  /**
   * Update project material quantities
   */
  async updateProjectMaterialQuantities(
    projectMaterialId: string,
    quantities: Partial<Pick<ProjectMaterial, 
      'requisitionedQuantity' | 'orderedQuantity' | 'deliveredQuantity' | 'usedQuantity' | 'wasteQuantity'
    >>,
    userId: string
  ): Promise<void> {
    const pm = await this.getProjectMaterial(projectMaterialId);
    if (!pm) throw new Error('Project material not found');
    
    const updated = { ...pm, ...quantities };
    const quantityVariance = updated.deliveredQuantity - pm.boqQuantity;
    
    // Determine status based on quantities
    let status: ProjectMaterialStatus = 'planned';
    if (updated.requisitionedQuantity > 0) status = 'requisitioned';
    if (updated.orderedQuantity > 0) {
      status = updated.orderedQuantity >= pm.boqQuantity ? 'fully_ordered' : 'partially_ordered';
    }
    if (updated.deliveredQuantity > 0) {
      status = updated.deliveredQuantity >= pm.boqQuantity ? 'fully_delivered' : 'partially_delivered';
    }
    if (updated.usedQuantity > 0) status = 'in_use';
    if (updated.usedQuantity >= pm.boqQuantity) status = 'completed';
    
    await updateDoc(doc(db, PROJECT_MATERIALS_COLLECTION, projectMaterialId), {
      ...quantities,
      quantityVariance,
      status,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Update project material actual cost
   */
  async updateProjectMaterialActualCost(
    projectMaterialId: string,
    actualRate: BOQMoney,
    userId: string
  ): Promise<void> {
    const pm = await this.getProjectMaterial(projectMaterialId);
    if (!pm) throw new Error('Project material not found');
    
    const actualAmount: BOQMoney = {
      amount: actualRate.amount * pm.deliveredQuantity,
      currency: actualRate.currency
    };
    
    const costVariance: BOQMoney = {
      amount: actualAmount.amount - pm.budgetAmount.amount,
      currency: actualAmount.currency
    };
    
    await updateDoc(doc(db, PROJECT_MATERIALS_COLLECTION, projectMaterialId), {
      actualRate,
      actualAmount,
      costVariance,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // MATERIAL TRANSFER OPERATIONS
  // ============================================================================
  
  /**
   * Create material transfer request
   */
  async createTransfer(
    transfer: Omit<MaterialTransfer, 'id' | 'status' | 'audit'>,
    userId: string
  ): Promise<string> {
    const id = generateId();
    
    const fullTransfer: MaterialTransfer = {
      ...transfer,
      id,
      status: 'draft',
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, TRANSFERS_COLLECTION, id), fullTransfer);
    return id;
  },
  
  /**
   * Get transfer by ID
   */
  async getTransfer(transferId: string): Promise<MaterialTransfer | null> {
    const snap = await getDoc(doc(db, TRANSFERS_COLLECTION, transferId));
    return snap.exists() ? (snap.data() as MaterialTransfer) : null;
  },
  
  /**
   * Get transfers for a project
   */
  async getTransfersForProject(projectId: string): Promise<MaterialTransfer[]> {
    const outgoing = query(
      collection(db, TRANSFERS_COLLECTION),
      where('fromProjectId', '==', projectId),
      orderBy('transferDate', 'desc')
    );
    
    const incoming = query(
      collection(db, TRANSFERS_COLLECTION),
      where('toProjectId', '==', projectId),
      orderBy('transferDate', 'desc')
    );
    
    const [outSnap, inSnap] = await Promise.all([
      getDocs(outgoing),
      getDocs(incoming)
    ]);
    
    const transfers = [
      ...outSnap.docs.map(d => d.data() as MaterialTransfer),
      ...inSnap.docs.map(d => d.data() as MaterialTransfer)
    ];
    
    return transfers.sort((a, b) => 
      b.transferDate.toMillis() - a.transferDate.toMillis()
    );
  },
  
  /**
   * Approve transfer
   */
  async approveTransfer(transferId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, TRANSFERS_COLLECTION, transferId), {
      status: 'approved',
      approvedBy: userId,
      approvedAt: Timestamp.now(),
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Mark transfer as received
   */
  async receiveTransfer(
    transferId: string,
    receivedQuantities: { materialId: string; receivedQuantity: number }[],
    userId: string
  ): Promise<void> {
    const transfer = await this.getTransfer(transferId);
    if (!transfer) throw new Error('Transfer not found');
    
    const quantityMap = new Map(receivedQuantities.map(r => [r.materialId, r.receivedQuantity]));
    
    const items = transfer.items.map(item => ({
      ...item,
      receivedQuantity: quantityMap.get(item.materialId) ?? item.quantity
    }));
    
    await updateDoc(doc(db, TRANSFERS_COLLECTION, transferId), {
      status: 'received',
      items,
      receivedBy: userId,
      receivedAt: Timestamp.now(),
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // CATALOG OPERATIONS
  // ============================================================================
  
  /**
   * Create material catalog
   */
  async createCatalog(
    catalog: Omit<MaterialCatalog, 'id' | 'materialCount' | 'audit'>,
    userId: string
  ): Promise<string> {
    const id = generateId();
    
    const fullCatalog: MaterialCatalog = {
      ...catalog,
      id,
      materialCount: catalog.materialIds.length,
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, CATALOGS_COLLECTION, id), fullCatalog);
    return id;
  },
  
  /**
   * Get catalog by ID
   */
  async getCatalog(catalogId: string): Promise<MaterialCatalog | null> {
    const snap = await getDoc(doc(db, CATALOGS_COLLECTION, catalogId));
    return snap.exists() ? (snap.data() as MaterialCatalog) : null;
  },
  
  /**
   * Add material to catalog
   */
  async addMaterialToCatalog(
    catalogId: string,
    materialId: string,
    userId: string
  ): Promise<void> {
    const catalog = await this.getCatalog(catalogId);
    if (!catalog) throw new Error('Catalog not found');
    
    if (!catalog.materialIds.includes(materialId)) {
      await updateDoc(doc(db, CATALOGS_COLLECTION, catalogId), {
        materialIds: [...catalog.materialIds, materialId],
        materialCount: catalog.materialCount + 1,
        'audit.updatedAt': Timestamp.now(),
        'audit.updatedBy': userId
      });
    }
  },
  
  /**
   * Remove material from catalog
   */
  async removeMaterialFromCatalog(
    catalogId: string,
    materialId: string,
    userId: string
  ): Promise<void> {
    const catalog = await this.getCatalog(catalogId);
    if (!catalog) throw new Error('Catalog not found');
    
    await updateDoc(doc(db, CATALOGS_COLLECTION, catalogId), {
      materialIds: catalog.materialIds.filter(id => id !== materialId),
      materialCount: catalog.materialCount - 1,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  }
};

export default materialService;
