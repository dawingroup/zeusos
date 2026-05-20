/**
 * Pipeline Service
 * Firestore CRUD operations for Launch Products
 */

import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { 
  LaunchProduct, 
  ProductDeliverable,
  StageTransition,
  ProductSpecifications,
} from '../types/product.types';
import type { PipelineStage } from '../types/stage.types';
import { PIPELINE_STAGES, STAGE_ORDER } from '../constants/stages';

const COLLECTION_NAME = 'launchProducts';

export interface PipelineColumn {
  stage: PipelineStage;
  config: typeof PIPELINE_STAGES[0];
  products: LaunchProduct[];
}

/**
 * Get all products
 */
export async function getProducts(): Promise<LaunchProduct[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as LaunchProduct));
}

/**
 * Subscribe to products with real-time updates
 */
export function subscribeToProducts(
  callback: (products: LaunchProduct[]) => void
): () => void {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('createdAt', 'desc')
  );
  
  return onSnapshot(q, (snapshot) => {
    const products = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as LaunchProduct));
    callback(products);
  });
}

/**
 * Get products grouped by pipeline stage
 */
export async function getProductsByStage(): Promise<PipelineColumn[]> {
  const products = await getProducts();
  
  return PIPELINE_STAGES.map(config => ({
    stage: config.id,
    config,
    products: products.filter(p => p.currentStage === config.id),
  }));
}

/**
 * Get product by ID
 */
export async function getProductById(id: string): Promise<LaunchProduct | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as LaunchProduct;
}

/**
 * Create new product
 */
export async function createProduct(data: Partial<LaunchProduct>): Promise<LaunchProduct> {
  const now = Timestamp.now();
  
  const productData: Omit<LaunchProduct, 'id'> = {
    name: data.name || '',
    handle: data.handle || generateHandle(data.name || ''),
    description: data.description || '',
    category: data.category || 'furniture',
    currentStage: data.currentStage || 'idea',
    stageHistory: [{
      from: 'idea' as PipelineStage,
      to: 'idea' as PipelineStage,
      transitionedAt: now,
      transitionedBy: data.assignedTo || 'system',
      notes: 'Product created',
    }],
    deliverables: [],
    specifications: data.specifications || {
      materials: [],
      finishes: [],
      colors: [],
      features: [],
    },
    auditHistory: [],
    priority: data.priority || 'medium',
    tags: data.tags || [],
    notes: data.notes || '',
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), productData);
  
  return {
    id: docRef.id,
    ...productData,
  };
}

/**
 * Update existing product
 */
export async function updateProduct(id: string, data: Partial<LaunchProduct>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete product
 */
export async function deleteProduct(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

/**
 * Move product to a different stage
 */
export async function moveProductToStage(
  productId: string, 
  newStage: PipelineStage,
  userId: string,
  notes?: string,
  gateOverride?: boolean
): Promise<void> {
  const product = await getProductById(productId);
  if (!product) throw new Error('Product not found');
  
  const now = Timestamp.now();
  const transition: StageTransition = {
    from: product.currentStage,
    to: newStage,
    transitionedAt: now,
    transitionedBy: userId,
    ...(notes !== undefined && { notes }),
    ...(gateOverride !== undefined && { gateOverride }),
  };
  
  const docRef = doc(db, COLLECTION_NAME, productId);
  await updateDoc(docRef, {
    currentStage: newStage,
    stageHistory: [...product.stageHistory, transition],
    updatedAt: now,
  });
}

/**
 * Add deliverable to product
 */
export async function addDeliverable(
  productId: string,
  deliverable: Omit<ProductDeliverable, 'id'>
): Promise<void> {
  const product = await getProductById(productId);
  if (!product) throw new Error('Product not found');
  
  const newDeliverable: ProductDeliverable = {
    ...deliverable,
    id: `del_${Date.now()}`,
  };
  
  const docRef = doc(db, COLLECTION_NAME, productId);
  await updateDoc(docRef, {
    deliverables: [...product.deliverables, newDeliverable],
    updatedAt: Timestamp.now(),
  });
}

/**
 * Remove deliverable from product
 */
export async function removeDeliverable(
  productId: string,
  deliverableId: string
): Promise<void> {
  const product = await getProductById(productId);
  if (!product) throw new Error('Product not found');
  
  const docRef = doc(db, COLLECTION_NAME, productId);
  await updateDoc(docRef, {
    deliverables: product.deliverables.filter(d => d.id !== deliverableId),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Update product specifications
 */
export async function updateSpecifications(
  productId: string,
  specifications: Partial<ProductSpecifications>
): Promise<void> {
  const product = await getProductById(productId);
  if (!product) throw new Error('Product not found');
  
  const docRef = doc(db, COLLECTION_NAME, productId);
  await updateDoc(docRef, {
    specifications: { ...product.specifications, ...specifications },
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get products by stage
 */
export async function getProductsInStage(stage: PipelineStage): Promise<LaunchProduct[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('currentStage', '==', stage)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as LaunchProduct));
}

/**
 * Generate URL-friendly handle from name
 */
function generateHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Check if product can advance to next stage
 */
export function canAdvanceStage(product: LaunchProduct): boolean {
  const currentIndex = STAGE_ORDER[product.currentStage];
  const stages = Object.keys(STAGE_ORDER);
  const nextStage = stages.find(s => STAGE_ORDER[s] === currentIndex + 1);
  return !!nextStage;
}
