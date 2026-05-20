/**
 * Procurement Service
 * 
 * Service for managing purchase orders, deliveries, and suppliers.
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
  Timestamp
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import { stripUndefined } from '../utils/stripUndefined';
import type {
  ProcurementEntry,
  PurchaseOrder,
  CreateProcurementInput,
  UpdateProcurementInput,
  QualityCheckInput
} from '../types/procurement';
import type {
  Supplier,
  SupplierQuotation,
  CreateSupplierInput,
  UpdateSupplierInput
} from '../types/supplier';
import type { BOQMoney } from '../types/boq';

// Generate unique IDs
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Generate PO number
const generatePONumber = (): string => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `PO-${dateStr}-${random}`;
};

// Generate delivery reference
const generateDeliveryRef = (): string => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `DEL-${dateStr}-${random}`;
};

const PROCUREMENT_COLLECTION = 'advisoryPlatform/matflow/procurement';
const PO_COLLECTION = 'advisoryPlatform/matflow/purchaseOrders';
const SUPPLIERS_COLLECTION = 'advisoryPlatform/matflow/suppliers';
const QUOTATIONS_COLLECTION = 'advisoryPlatform/matflow/quotations';

export const procurementService = {
  // ============================================================================
  // PROCUREMENT ENTRY OPERATIONS (Deliveries)
  // ============================================================================
  
  /**
   * Record a new procurement/delivery entry
   */
  async createProcurementEntry(
    projectId: string,
    input: CreateProcurementInput,
    userId: string,
    userName: string
  ): Promise<string> {
    const id = generateId();
    const referenceNumber = generateDeliveryRef();
    
    const entry: ProcurementEntry = {
      id,
      projectId,
      type: input.type,
      status: 'pending',
      referenceNumber,
      externalReference: input.externalReference,
      materialId: input.materialId,
      materialName: input.materialName,
      unit: input.unit,
      quantityReceived: input.quantityReceived,
      quantityAccepted: input.quantityAccepted,
      quantityRejected: input.quantityRejected,
      unitPrice: input.unitPrice,
      totalAmount: input.unitPrice * input.quantityAccepted,
      currency: 'UGX',
      supplierName: input.supplierName,
      supplierContact: input.supplierContact,
      deliveryDate: Timestamp.fromDate(input.deliveryDate),
      deliveryCondition: input.deliveryCondition,
      receivedBy: userId,
      receivedByName: userName,
      boqItemIds: input.boqItemIds,
      stageId: input.stageId,
      deliveryLocation: input.deliveryLocation,
      attachments: [],
      notes: input.notes,
      qualityCheckDone: false,
      efrisValidated: false,
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now(),
      updatedBy: userId
    };
    
    await setDoc(doc(db, PROCUREMENT_COLLECTION, id), entry);
    return id;
  },
  
  /**
   * Get procurement entry by ID
   */
  async getProcurementEntry(entryId: string): Promise<ProcurementEntry | null> {
    const snap = await getDoc(doc(db, PROCUREMENT_COLLECTION, entryId));
    return snap.exists() ? (snap.data() as ProcurementEntry) : null;
  },
  
  /**
   * Get procurement entries for a project
   */
  async getProjectProcurementEntries(projectId: string): Promise<ProcurementEntry[]> {
    const q = query(
      collection(db, PROCUREMENT_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('deliveryDate', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ProcurementEntry);
  },
  
  /**
   * Get procurement entries by material
   */
  async getMaterialProcurementEntries(
    projectId: string,
    materialId: string
  ): Promise<ProcurementEntry[]> {
    const q = query(
      collection(db, PROCUREMENT_COLLECTION),
      where('projectId', '==', projectId),
      where('materialId', '==', materialId),
      orderBy('deliveryDate', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as ProcurementEntry);
  },
  
  /**
   * Update procurement entry
   */
  async updateProcurementEntry(
    entryId: string,
    updates: UpdateProcurementInput,
    userId: string
  ): Promise<void> {
    const entry = await this.getProcurementEntry(entryId);
    if (!entry) throw new Error('Procurement entry not found');
    
    const updateData: Partial<ProcurementEntry> = {
      ...stripUndefined(updates as Record<string, any>),
      updatedAt: Timestamp.now(),
      updatedBy: userId
    } as Partial<ProcurementEntry>;
    
    // Recalculate total if quantities changed
    if (updates.quantityAccepted !== undefined) {
      updateData.totalAmount = entry.unitPrice * updates.quantityAccepted;
    }
    
    await updateDoc(doc(db, PROCUREMENT_COLLECTION, entryId), updateData);
  },
  
  /**
   * Quality check a delivery
   */
  async qualityCheckDelivery(
    entryId: string,
    input: QualityCheckInput,
    userId: string
  ): Promise<void> {
    const entry = await this.getProcurementEntry(entryId);
    if (!entry) throw new Error('Procurement entry not found');
    
    await updateDoc(doc(db, PROCUREMENT_COLLECTION, entryId), {
      quantityAccepted: input.quantityAccepted,
      quantityRejected: input.quantityRejected,
      totalAmount: entry.unitPrice * input.quantityAccepted,
      deliveryCondition: input.condition,
      qualityCheckDone: true,
      qualityCheckBy: userId,
      qualityCheckDate: Timestamp.now(),
      qualityNotes: input.notes,
      status: input.quantityRejected > 0 ? 'disputed' : 'confirmed',
      updatedAt: Timestamp.now(),
      updatedBy: userId
    });
  },
  
  /**
   * Confirm procurement entry
   */
  async confirmProcurementEntry(
    entryId: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, PROCUREMENT_COLLECTION, entryId), {
      status: 'confirmed',
      updatedAt: Timestamp.now(),
      updatedBy: userId
    });
  },
  
  // ============================================================================
  // PURCHASE ORDER OPERATIONS
  // ============================================================================
  
  /**
   * Create a purchase order
   */
  async createPurchaseOrder(
    po: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt'>,
    userId: string
  ): Promise<string> {
    const id = generateId();
    const orderNumber = generatePONumber();
    
    const purchaseOrder: PurchaseOrder = {
      ...po,
      id,
      orderNumber,
      status: 'draft',
      createdAt: Timestamp.now(),
      createdBy: userId,
      updatedAt: Timestamp.now()
    };
    
    await setDoc(doc(db, PO_COLLECTION, id), purchaseOrder);
    return id;
  },
  
  /**
   * Get purchase order by ID
   */
  async getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
    const snap = await getDoc(doc(db, PO_COLLECTION, poId));
    return snap.exists() ? (snap.data() as PurchaseOrder) : null;
  },
  
  /**
   * Get purchase orders for a project
   */
  async getProjectPurchaseOrders(projectId: string): Promise<PurchaseOrder[]> {
    const q = query(
      collection(db, PO_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as PurchaseOrder);
  },

  /**
   * Get purchase orders by project (alias for getProjectPurchaseOrders)
   */
  async getPurchaseOrdersByProject(projectId: string): Promise<PurchaseOrder[]> {
    return this.getProjectPurchaseOrders(projectId);
  },
  
  /**
   * Submit PO for approval
   */
  async submitPurchaseOrder(poId: string, _userId: string): Promise<void> {
    await updateDoc(doc(db, PO_COLLECTION, poId), {
      status: 'submitted',
      updatedAt: Timestamp.now()
    });
  },
  
  /**
   * Approve purchase order
   */
  async approvePurchaseOrder(
    poId: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, PO_COLLECTION, poId), {
      status: 'approved',
      approvedBy: userId,
      approvedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  },
  
  /**
   * Update purchase order with partial data
   */
  async updatePurchaseOrder(
    poId: string,
    updates: Partial<PurchaseOrder>,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, PO_COLLECTION, poId), {
      ...stripUndefined(updates as Record<string, any>),
      updatedAt: Timestamp.now(),
      updatedBy: userId
    });
  },

  /**
   * Link delivery entry to PO item and update quantities
   */
  async linkDeliveryToPO(
    deliveryId: string,
    purchaseOrderId: string,
    poItemId: string,
    userId: string
  ): Promise<void> {
    // 1. Get delivery entry
    const delivery = await this.getProcurementEntry(deliveryId);
    if (!delivery) throw new Error('Delivery entry not found');

    // 2. Get PO and find item
    const po = await this.getPurchaseOrder(purchaseOrderId);
    if (!po) throw new Error('Purchase order not found');

    const itemIndex = po.items.findIndex(item => item.materialId === poItemId);
    if (itemIndex === -1) throw new Error('PO item not found');

    // 3. Update delivery with PO reference
    await updateDoc(doc(db, PROCUREMENT_COLLECTION, deliveryId), {
      purchaseOrderId,
      poItemId,
      poItemLineNumber: itemIndex + 1,
      updatedAt: Timestamp.now(),
      updatedBy: userId
    });

    // 4. Update PO item quantities
    const updatedItems = [...po.items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      deliveredQuantity: (updatedItems[itemIndex].deliveredQuantity || 0) + delivery.quantityReceived,
      acceptedQuantity: (updatedItems[itemIndex].acceptedQuantity || 0) + delivery.quantityAccepted,
      rejectedQuantity: (updatedItems[itemIndex].rejectedQuantity || 0) + (delivery.quantityRejected || 0),
      deliveryEntryIds: [...(updatedItems[itemIndex].deliveryEntryIds || []), deliveryId]
    };

    // 5. Update PO
    await updateDoc(doc(db, PO_COLLECTION, purchaseOrderId), {
      items: updatedItems,
      updatedAt: Timestamp.now()
    });

    // 6. Auto-update PO status based on fulfillment
    await this.updatePODeliveryStatus(purchaseOrderId, userId);
  },

  /**
   * Auto-update PO status based on delivery fulfillment
   */
  async updatePODeliveryStatus(
    poId: string,
    userId: string
  ): Promise<void> {
    const po = await this.getPurchaseOrder(poId);
    if (!po) throw new Error('Purchase order not found');

    // Calculate fulfillment
    const allFullyDelivered = po.items.every(
      item => (item.deliveredQuantity || 0) >= item.quantity
    );
    const anyDelivered = po.items.some(item => (item.deliveredQuantity || 0) > 0);

    // Determine new status using workflow rules
    let newStatus = po.status;
    if (allFullyDelivered && po.status !== 'fulfilled') {
      newStatus = 'fulfilled';
    } else if (anyDelivered && po.status === 'approved') {
      newStatus = 'partially_fulfilled';
    }

    // Only update if status changed
    if (newStatus !== po.status) {
      await updateDoc(doc(db, PO_COLLECTION, poId), {
        status: newStatus,
        updatedAt: Timestamp.now(),
        updatedBy: userId
      });
    }
  },
  
  // ============================================================================
  // SUPPLIER OPERATIONS
  // ============================================================================
  
  /**
   * Create a supplier
   */
  async createSupplier(
    input: CreateSupplierInput,
    userId: string
  ): Promise<string> {
    const id = generateId();
    
    const supplier: Supplier = {
      id,
      code: input.code || '',
      name: input.name || '',
      tradeName: input.tradeName || '',
      contactPerson: input.contactPerson || '',
      email: input.email || '',
      phone: input.phone,
      address: input.address as any || { street: '', city: '', country: '' },
      categories: input.categories || [],
      materials: [],
      totalOrders: 0,
      totalValue: { amount: 0, currency: 'UGX' },
      status: 'pending_approval',
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, SUPPLIERS_COLLECTION, id), supplier);
    return id;
  },
  
  /**
   * Get supplier by ID
   */
  async getSupplier(supplierId: string): Promise<Supplier | null> {
    const snap = await getDoc(doc(db, SUPPLIERS_COLLECTION, supplierId));
    return snap.exists() ? (snap.data() as Supplier) : null;
  },
  
  /**
   * Get all active suppliers
   */
  async getActiveSuppliers(): Promise<Supplier[]> {
    const q = query(
      collection(db, SUPPLIERS_COLLECTION),
      where('status', '==', 'active'),
      orderBy('name')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Supplier);
  },
  
  /**
   * Get suppliers by category
   */
  async getSuppliersByCategory(category: string): Promise<Supplier[]> {
    const q = query(
      collection(db, SUPPLIERS_COLLECTION),
      where('categories', 'array-contains', category),
      where('status', '==', 'active'),
      orderBy('name')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Supplier);
  },
  
  /**
   * Update supplier
   */
  async updateSupplier(
    supplierId: string,
    updates: UpdateSupplierInput,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, SUPPLIERS_COLLECTION, supplierId), {
      ...stripUndefined(updates as Record<string, any>),
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Activate supplier
   */
  async activateSupplier(supplierId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, SUPPLIERS_COLLECTION, supplierId), {
      status: 'active',
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Blacklist supplier
   */
  async blacklistSupplier(
    supplierId: string,
    reason: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, SUPPLIERS_COLLECTION, supplierId), {
      status: 'blacklisted',
      blacklistReason: reason,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Update supplier statistics after an order
   */
  async updateSupplierStats(
    supplierId: string,
    orderValue: BOQMoney,
    userId: string
  ): Promise<void> {
    const supplier = await this.getSupplier(supplierId);
    if (!supplier) throw new Error('Supplier not found');
    
    await updateDoc(doc(db, SUPPLIERS_COLLECTION, supplierId), {
      totalOrders: supplier.totalOrders + 1,
      'totalValue.amount': supplier.totalValue.amount + orderValue.amount,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  // ============================================================================
  // QUOTATION OPERATIONS
  // ============================================================================
  
  /**
   * Record supplier quotation
   */
  async createQuotation(
    quotation: Omit<SupplierQuotation, 'id' | 'status' | 'audit'>,
    userId: string
  ): Promise<string> {
    const id = generateId();
    
    const fullQuotation: SupplierQuotation = {
      ...quotation,
      id,
      status: 'received',
      audit: {
        createdAt: Timestamp.now(),
        createdBy: userId,
        updatedAt: Timestamp.now(),
        updatedBy: userId,
        version: 1
      }
    };
    
    await setDoc(doc(db, QUOTATIONS_COLLECTION, id), fullQuotation);
    return id;
  },
  
  /**
   * Get quotation by ID
   */
  async getQuotation(quotationId: string): Promise<SupplierQuotation | null> {
    const snap = await getDoc(doc(db, QUOTATIONS_COLLECTION, quotationId));
    return snap.exists() ? (snap.data() as SupplierQuotation) : null;
  },
  
  /**
   * Get quotations for a project
   */
  async getProjectQuotations(projectId: string): Promise<SupplierQuotation[]> {
    const q = query(
      collection(db, QUOTATIONS_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('quotationDate', 'desc')
    );
    
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as SupplierQuotation);
  },
  
  /**
   * Accept quotation
   */
  async acceptQuotation(quotationId: string, userId: string): Promise<void> {
    await updateDoc(doc(db, QUOTATIONS_COLLECTION, quotationId), {
      status: 'accepted',
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  },
  
  /**
   * Reject quotation
   */
  async rejectQuotation(
    quotationId: string,
    reason: string,
    userId: string
  ): Promise<void> {
    await updateDoc(doc(db, QUOTATIONS_COLLECTION, quotationId), {
      status: 'rejected',
      rejectionReason: reason,
      'audit.updatedAt': Timestamp.now(),
      'audit.updatedBy': userId
    });
  }
};

export default procurementService;
