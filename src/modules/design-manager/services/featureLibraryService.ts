/**
 * Feature Library Service
 * CRUD operations for the Feature Library collection
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
  increment,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { 
  FeatureLibraryItem, 
  FeatureFormData, 
  FeatureSearchOptions,
  FeatureCategory,
} from '../types/featureLibrary';

const COLLECTION_NAME = 'featureLibrary';

/**
 * Generate feature code based on category
 * Format: {CATEGORY_PREFIX}-{SEQUENCE}
 */
export async function generateFeatureCode(category: FeatureCategory): Promise<string> {
  const prefixes: Record<FeatureCategory, string> = {
    joinery: 'JNR',
    finishing: 'FIN',
    hardware: 'HDW',
    upholstery: 'UPH',
    metalwork: 'MTL',
    carving: 'CRV',
    veneer: 'VNR',
    laminate: 'LAM',
    glass: 'GLS',
    stone: 'STN',
  };

  const prefix = prefixes[category];
  
  // Get count of features in this category
  const q = query(
    collection(db, COLLECTION_NAME),
    where('category', '==', category)
  );
  const snapshot = await getDocs(q);
  const nextNumber = snapshot.size + 1;
  
  return `${prefix}-${String(nextNumber).padStart(3, '0')}`;
}

/**
 * Get all features with optional filtering
 */
export async function getFeatures(options: FeatureSearchOptions = {}): Promise<FeatureLibraryItem[]> {
  const { category, qualityGrade, status, sortBy = 'name', sortOrder = 'asc' } = options;
  
  let q = query(collection(db, COLLECTION_NAME));
  
  // Apply filters
  if (category) {
    q = query(q, where('category', '==', category));
  }
  if (qualityGrade) {
    q = query(q, where('qualityGrade', '==', qualityGrade));
  }
  if (status) {
    q = query(q, where('status', '==', status));
  }
  
  // Apply sorting
  q = query(q, orderBy(sortBy, sortOrder));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as FeatureLibraryItem));
}

/**
 * Get feature by ID
 */
export async function getFeatureById(id: string): Promise<FeatureLibraryItem | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as FeatureLibraryItem;
}

/**
 * Create new feature
 */
export async function createFeature(data: FeatureFormData): Promise<FeatureLibraryItem> {
  const code = await generateFeatureCode(data.category);
  
  const featureData = {
    ...data,
    code,
    usageCount: 0,
    images: [],
    videoUrls: [],
    drawingUrls: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  const docRef = await addDoc(collection(db, COLLECTION_NAME), featureData);
  
  return {
    id: docRef.id,
    ...featureData,
  } as FeatureLibraryItem;
}

/**
 * Update existing feature
 */
export async function updateFeature(id: string, data: Partial<FeatureFormData>): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete feature
 */
export async function deleteFeature(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

/**
 * Increment usage count for a feature
 */
export async function incrementUsageCount(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    usageCount: increment(1),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Search features by text query
 * Note: For production, consider using Algolia or similar for full-text search
 */
export async function searchFeatures(searchQuery: string): Promise<FeatureLibraryItem[]> {
  // Get all active features and filter client-side
  // In production, use a search service like Algolia
  const allFeatures = await getFeatures({ status: 'active' });
  
  const lowerQuery = searchQuery.toLowerCase();
  return allFeatures.filter(feature => 
    feature.name.toLowerCase().includes(lowerQuery) ||
    feature.description.toLowerCase().includes(lowerQuery) ||
    feature.code.toLowerCase().includes(lowerQuery) ||
    feature.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get features by category
 */
export async function getFeaturesByCategory(category: FeatureCategory): Promise<FeatureLibraryItem[]> {
  return getFeatures({ category, status: 'active' });
}

/**
 * Get feature counts by category
 */
export async function getFeatureCountsByCategory(): Promise<Record<FeatureCategory, number>> {
  const features = await getFeatures();
  
  const counts: Record<string, number> = {
    joinery: 0,
    finishing: 0,
    hardware: 0,
    upholstery: 0,
    metalwork: 0,
    carving: 0,
    veneer: 0,
    laminate: 0,
    glass: 0,
    stone: 0,
  };
  
  features.forEach(feature => {
    if (counts[feature.category] !== undefined) {
      counts[feature.category]++;
    }
  });
  
  return counts as Record<FeatureCategory, number>;
}

/**
 * Export Feature Library for AI context caching
 * Returns optimized JSON format for Gemini
 */
export async function exportForAIContext(): Promise<object> {
  const features = await getFeatures({ status: 'active' });
  
  return {
    featureLibrary: {
      lastUpdated: new Date().toISOString(),
      totalFeatures: features.length,
      categories: [...new Set(features.map(f => f.category))],
      features: features.map(f => ({
        code: f.code,
        name: f.name,
        category: f.category,
        qualityGrade: f.qualityGrade,
        estimatedHours: f.estimatedTime.typical,
        requiredEquipment: f.requiredEquipment,
        skillLevel: f.costFactors.skillLevel,
        tags: f.tags,
      })),
    },
  };
}
