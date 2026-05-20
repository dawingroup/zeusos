/**
 * MatFlow Firebase Collections Configuration
 * 
 * Defines collection paths and references for MatFlow data.
 */

import { collection, doc } from 'firebase/firestore';
import { db } from '@/core/services/firebase';

// ============================================================================
// COLLECTION PATHS
// ============================================================================

export const MATFLOW_COLLECTIONS = {
  // BOQ Collections
  BOQS: 'advisoryPlatform/matflow/boqs',
  BOQ_VARIATIONS: 'advisoryPlatform/matflow/boqVariations',
  BOQ_TEMPLATES: 'advisoryPlatform/matflow/boqTemplates',
  
  // Material Collections
  MATERIALS: 'advisoryPlatform/matflow/materials',
  MATERIAL_CATALOGS: 'advisoryPlatform/matflow/materialCatalogs',
  PROJECT_MATERIALS: 'advisoryPlatform/matflow/projectMaterials',
  MATERIAL_TRANSFERS: 'advisoryPlatform/matflow/materialTransfers',
  
  // Requisition Collections
  REQUISITIONS: 'advisoryPlatform/matflow/requisitions',
  REQUISITION_TEMPLATES: 'advisoryPlatform/matflow/requisitionTemplates',
  
  // Procurement Collections
  PROCUREMENT: 'advisoryPlatform/matflow/procurement',
  PURCHASE_ORDERS: 'advisoryPlatform/matflow/purchaseOrders',
  SUPPLIERS: 'advisoryPlatform/matflow/suppliers',
  QUOTATIONS: 'advisoryPlatform/matflow/quotations',
  
  // Project Collections (from existing MatFlow)
  PROJECTS: 'matflow_projects',
  
  // Customer Collections
  CUSTOMERS: 'advisoryPlatform/matflow/customers',
} as const;

// ============================================================================
// COLLECTION REFERENCES
// ============================================================================

export const matflowCollections = {
  // BOQ
  boqs: () => collection(db, MATFLOW_COLLECTIONS.BOQS),
  boq: (boqId: string) => doc(db, MATFLOW_COLLECTIONS.BOQS, boqId),
  boqVariations: () => collection(db, MATFLOW_COLLECTIONS.BOQ_VARIATIONS),
  boqVariation: (variationId: string) => doc(db, MATFLOW_COLLECTIONS.BOQ_VARIATIONS, variationId),
  boqTemplates: () => collection(db, MATFLOW_COLLECTIONS.BOQ_TEMPLATES),
  boqTemplate: (templateId: string) => doc(db, MATFLOW_COLLECTIONS.BOQ_TEMPLATES, templateId),
  
  // Materials
  materials: () => collection(db, MATFLOW_COLLECTIONS.MATERIALS),
  material: (materialId: string) => doc(db, MATFLOW_COLLECTIONS.MATERIALS, materialId),
  materialCatalogs: () => collection(db, MATFLOW_COLLECTIONS.MATERIAL_CATALOGS),
  materialCatalog: (catalogId: string) => doc(db, MATFLOW_COLLECTIONS.MATERIAL_CATALOGS, catalogId),
  projectMaterials: () => collection(db, MATFLOW_COLLECTIONS.PROJECT_MATERIALS),
  projectMaterial: (pmId: string) => doc(db, MATFLOW_COLLECTIONS.PROJECT_MATERIALS, pmId),
  materialTransfers: () => collection(db, MATFLOW_COLLECTIONS.MATERIAL_TRANSFERS),
  materialTransfer: (transferId: string) => doc(db, MATFLOW_COLLECTIONS.MATERIAL_TRANSFERS, transferId),
  
  // Requisitions
  requisitions: () => collection(db, MATFLOW_COLLECTIONS.REQUISITIONS),
  requisition: (requisitionId: string) => doc(db, MATFLOW_COLLECTIONS.REQUISITIONS, requisitionId),
  requisitionTemplates: () => collection(db, MATFLOW_COLLECTIONS.REQUISITION_TEMPLATES),
  requisitionTemplate: (templateId: string) => doc(db, MATFLOW_COLLECTIONS.REQUISITION_TEMPLATES, templateId),
  
  // Procurement
  procurement: () => collection(db, MATFLOW_COLLECTIONS.PROCUREMENT),
  procurementEntry: (entryId: string) => doc(db, MATFLOW_COLLECTIONS.PROCUREMENT, entryId),
  purchaseOrders: () => collection(db, MATFLOW_COLLECTIONS.PURCHASE_ORDERS),
  purchaseOrder: (poId: string) => doc(db, MATFLOW_COLLECTIONS.PURCHASE_ORDERS, poId),
  suppliers: () => collection(db, MATFLOW_COLLECTIONS.SUPPLIERS),
  supplier: (supplierId: string) => doc(db, MATFLOW_COLLECTIONS.SUPPLIERS, supplierId),
  quotations: () => collection(db, MATFLOW_COLLECTIONS.QUOTATIONS),
  quotation: (quotationId: string) => doc(db, MATFLOW_COLLECTIONS.QUOTATIONS, quotationId),
  
  // Projects
  projects: () => collection(db, MATFLOW_COLLECTIONS.PROJECTS),
  project: (projectId: string) => doc(db, MATFLOW_COLLECTIONS.PROJECTS, projectId),
  
  // Customers
  customers: () => collection(db, MATFLOW_COLLECTIONS.CUSTOMERS),
  customer: (customerId: string) => doc(db, MATFLOW_COLLECTIONS.CUSTOMERS, customerId),
};

// ============================================================================
// SUBCOLLECTION HELPERS
// ============================================================================

export const matflowSubcollections = {
  /**
   * Get project-specific BOQs subcollection
   */
  projectBoqs: (projectId: string) => 
    collection(db, `${MATFLOW_COLLECTIONS.PROJECTS}/${projectId}/boqs`),
  
  /**
   * Get project-specific materials subcollection
   */
  projectMaterialsList: (projectId: string) =>
    collection(db, `${MATFLOW_COLLECTIONS.PROJECTS}/${projectId}/materials`),
  
  /**
   * Get project-specific requisitions subcollection
   */
  projectRequisitions: (projectId: string) =>
    collection(db, `${MATFLOW_COLLECTIONS.PROJECTS}/${projectId}/requisitions`),
  
  /**
   * Get project-specific procurement entries subcollection
   */
  projectProcurement: (projectId: string) =>
    collection(db, `${MATFLOW_COLLECTIONS.PROJECTS}/${projectId}/procurement`),
};

// ============================================================================
// FIRESTORE RULES (for reference)
// ============================================================================

/**
 * Suggested Firestore rules for MatFlow collections:
 * 
 * ```
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     // MatFlow Platform collections
 *     match /advisoryPlatform/matflow/{collection}/{document=**} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth != null;
 *     }
 *     
 *     // Legacy MatFlow projects
 *     match /matflow_projects/{projectId} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth != null;
 *       
 *       match /{subcollection}/{document=**} {
 *         allow read: if request.auth != null;
 *         allow write: if request.auth != null;
 *       }
 *     }
 *   }
 * }
 * ```
 */

export default matflowCollections;
