/**
 * Project Parts Service
 * Manages project-level parts library (shared across design items)
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  orderBy,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ProjectPart, PartCategory } from '../types';
import type { DesignClip } from '@/subsidiaries/finishes/clipper/types';

/**
 * Get project parts collection reference
 */
function getProjectPartsRef(projectId: string) {
  return collection(db, 'designProjects', projectId, 'projectParts');
}

/**
 * Extract supplier name from URL
 */
function extractSupplierFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove common prefixes and suffixes
    return hostname
      .replace(/^www\./, '')
      .replace(/\.com$|\.co\.uk$|\.net$|\.org$/, '')
      .split('.')[0]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()); // Title case
  } catch {
    return 'Unknown Supplier';
  }
}

/**
 * Infer part category from clip data
 */
function inferCategory(clip: DesignClip): PartCategory {
  const text = `${clip.title} ${clip.description || ''} ${clip.tags.join(' ')}`.toLowerCase();
  
  if (text.includes('handle') || text.includes('pull')) return 'handle';
  if (text.includes('lock') || text.includes('latch')) return 'lock';
  if (text.includes('hinge')) return 'hinge';
  if (text.includes('slide') || text.includes('drawer')) return 'drawer-slide';
  if (text.includes('light') || text.includes('led') || text.includes('lamp')) return 'lighting';
  if (text.includes('bracket') || text.includes('shelf support')) return 'bracket';
  if (text.includes('connector') || text.includes('cam') || text.includes('dowel')) return 'connector';
  
  return 'accessory';
}

/**
 * Subscribe to project parts
 */
export function subscribeToProjectParts(
  projectId: string,
  onData: (parts: ProjectPart[]) => void,
  onError?: (error: Error) => void
) {
  const partsRef = getProjectPartsRef(projectId);
  const q = query(partsRef, orderBy('createdAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const parts = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ProjectPart[];
    onData(parts);
  }, onError);
}

/**
 * Get all project parts
 */
export async function getProjectParts(projectId: string): Promise<ProjectPart[]> {
  const partsRef = getProjectPartsRef(projectId);
  const q = query(partsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ProjectPart[];
}

/**
 * Get a single project part
 */
export async function getProjectPart(projectId: string, partId: string): Promise<ProjectPart | null> {
  const partRef = doc(db, 'designProjects', projectId, 'projectParts', partId);
  const snapshot = await getDoc(partRef);
  
  if (!snapshot.exists()) return null;
  
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as ProjectPart;
}

/**
 * Create a project part from a clip
 */
export async function createProjectPartFromClip(
  projectId: string,
  clip: DesignClip,
  userId: string,
  overrides?: Partial<ProjectPart>
): Promise<string> {
  if (!projectId) throw new Error('Project ID is required');
  if (!clip) throw new Error('Clip is required');
  if (!userId) throw new Error('User ID is required');
  
  const partsRef = getProjectPartsRef(projectId);
  
  // Build part data, handling missing fields gracefully
  const partData = {
    name: clip.title || 'Untitled Part',
    supplier: clip.sourceUrl ? extractSupplierFromUrl(clip.sourceUrl) : 'Unknown',
    category: inferCategory(clip),
    unitCost: clip.price?.amount || 0,
    currency: clip.price?.currency || 'USD',
    referenceImageUrl: clip.thumbnailUrl || clip.imageUrl || null,
    purchaseUrl: clip.sourceUrl || null,
    clipId: clip.id,
    description: clip.description || null,
    notes: clip.notes || null,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
  
  // Remove undefined/null values to avoid Firestore errors
  const cleanedData = Object.fromEntries(
    Object.entries(partData).filter(([_, v]) => v !== undefined && v !== null)
  );
  
  try {
    const docRef = await addDoc(partsRef, cleanedData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating project part:', error);
    throw error;
  }
}

/**
 * Create a project part manually
 */
export async function createProjectPart(
  projectId: string,
  data: Omit<ProjectPart, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const partsRef = getProjectPartsRef(projectId);
  
  const partData = {
    ...data,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(partsRef, partData);
  return docRef.id;
}

/**
 * Update a project part
 */
export async function updateProjectPart(
  projectId: string,
  partId: string,
  updates: Partial<ProjectPart>
): Promise<void> {
  const partRef = doc(db, 'designProjects', projectId, 'projectParts', partId);
  
  await updateDoc(partRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a project part
 */
export async function deleteProjectPart(projectId: string, partId: string): Promise<void> {
  const partRef = doc(db, 'designProjects', projectId, 'projectParts', partId);
  await deleteDoc(partRef);
}

/**
 * Bulk convert clips to project parts
 */
export async function bulkConvertClipsToProjectParts(
  projectId: string,
  clips: DesignClip[],
  userId: string
): Promise<string[]> {
  const partIds: string[] = [];
  
  for (const clip of clips) {
    // Skip clips that are already converted (have a projectPartId? - check if clipId already exists)
    const existingParts = await getProjectParts(projectId);
    const alreadyConverted = existingParts.some(p => p.clipId === clip.id);
    
    if (!alreadyConverted) {
      const partId = await createProjectPartFromClip(projectId, clip, userId);
      partIds.push(partId);
    }
  }
  
  return partIds;
}

/**
 * Promote a project part to the global materials database
 */
export async function promoteToMaterialsDatabase(
  projectId: string,
  partId: string,
  _userId: string
): Promise<string> {
  console.log('[promoteToMaterialsDatabase] Starting promotion:', { projectId, partId });
  
  const part = await getProjectPart(projectId, partId);
  if (!part) {
    console.error('[promoteToMaterialsDatabase] Part not found:', { projectId, partId });
    throw new Error('Project part not found');
  }
  
  console.log('[promoteToMaterialsDatabase] Found part:', part.name);
  
  // Create material in global materials collection with ALL part data
  const materialsRef = collection(db, 'materials');
  const materialData: Record<string, any> = {
    // Core identification
    name: part.name,
    type: 'special-part',
    category: part.category,
    supplier: part.supplier || '',
    
    // Pricing
    unitCost: part.unitCost || 0,
    currency: part.currency || 'USD',
    
    // Product image (from clip)
    imageUrl: part.referenceImageUrl || '',
    referenceImageUrl: part.referenceImageUrl || '',
    
    // Technical data
    partNumber: part.partNumber || '',
    description: part.description || '',
    specifications: part.specifications || {},
    
    // Source links
    purchaseUrl: part.purchaseUrl || '',
    
    // Notes
    notes: part.notes || '',
    
    // Provenance tracking
    sourceProjectPartId: partId,
    sourceProjectId: projectId,
    sourceClipId: part.clipId || '',
    
    // Timestamps
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  console.log('[promoteToMaterialsDatabase] Creating material:', materialData);
  
  try {
    const materialDoc = await addDoc(materialsRef, materialData);
    console.log('[promoteToMaterialsDatabase] Material created:', materialDoc.id);
    
    // Update the project part with the material reference
    await updateProjectPart(projectId, partId, {
      promotedToMaterialId: materialDoc.id,
    });
    console.log('[promoteToMaterialsDatabase] Part updated with material reference');
    
    return materialDoc.id;
  } catch (error) {
    console.error('[promoteToMaterialsDatabase] Failed to create material:', error);
    throw error;
  }
}
