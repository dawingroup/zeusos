/**
 * Roadmap Service
 * CRUD operations for Product Roadmap
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { 
  RoadmapProduct, 
  ProductFormData, 
  PipelineStage,
  PipelineColumn,
} from '../types/roadmap';
import { STAGE_CONFIG } from '../types/roadmap';

const COLLECTION_NAME = 'roadmapProducts';

/**
 * Get all products
 */
export async function getProducts(): Promise<RoadmapProduct[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    orderBy('order', 'asc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as RoadmapProduct));
}

/**
 * Get products grouped by pipeline stage
 */
export async function getProductsByStage(): Promise<PipelineColumn[]> {
  const products = await getProducts();
  
  const stages = Object.keys(STAGE_CONFIG) as PipelineStage[];
  return stages.map(stage => ({
    stage,
    products: products.filter(p => p.stage === stage && p.status === 'active'),
  }));
}

/**
 * Get product by ID
 */
export async function getProductById(id: string): Promise<RoadmapProduct | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as RoadmapProduct;
}

/**
 * Create new product
 */
export async function createProduct(data: ProductFormData): Promise<RoadmapProduct> {
  // Get current max order for the stage
  const q = query(
    collection(db, COLLECTION_NAME),
    where('stage', '==', data.stage)
  );
  const snapshot = await getDocs(q);
  const maxOrder = snapshot.docs.reduce((max, doc) => {
    const order = doc.data().order || 0;
    return order > max ? order : max;
  }, 0);

  const productData = {
    ...data,
    progressPercent: 0,
    status: data.status || 'active',
    order: maxOrder + 1,
    targetLaunchDate: data.targetLaunchDate ? Timestamp.fromDate(data.targetLaunchDate) : null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), productData);
  
  return {
    id: docRef.id,
    ...productData,
  } as RoadmapProduct;
}

/**
 * Update existing product
 */
export async function updateProduct(id: string, data: Partial<ProductFormData>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const updateData: any = {
    ...data,
    updatedAt: Timestamp.now(),
  };
  
  if (data.targetLaunchDate) {
    updateData.targetLaunchDate = Timestamp.fromDate(data.targetLaunchDate);
  }
  
  await updateDoc(docRef, updateData);
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
  newOrder: number
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, productId);
  await updateDoc(docRef, {
    stage: newStage,
    order: newOrder,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Reorder products within a stage
 */
export async function reorderProducts(
  _stage: PipelineStage,
  productIds: string[]
): Promise<void> {
  const batch = writeBatch(db);
  
  productIds.forEach((id, index) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    batch.update(docRef, { 
      order: index,
      updatedAt: Timestamp.now(),
    });
  });
  
  await batch.commit();
}

/**
 * Update product progress
 */
export async function updateProductProgress(
  id: string, 
  progressPercent: number
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    progressPercent: Math.min(100, Math.max(0, progressPercent)),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Get products by project
 */
export async function getProductsByProject(projectId: string): Promise<RoadmapProduct[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('projectId', '==', projectId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as RoadmapProduct));
}
