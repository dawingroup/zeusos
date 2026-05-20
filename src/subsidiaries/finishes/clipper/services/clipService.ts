/**
 * Clip Service
 * CRUD operations for design clips with Firestore
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { DesignClip, ClipFilter, ClipStats } from '../types';

const CLIPS_COLLECTION = 'designClips';

/**
 * Subscribe to clips for a user
 */
export function subscribeToClips(
  userId: string,
  filter: ClipFilter,
  callback: (clips: DesignClip[]) => void
): () => void {
  const clipsRef = collection(db, CLIPS_COLLECTION);
  
  let q = query(clipsRef, where('createdBy', '==', userId), orderBy('createdAt', 'desc'));
  
  if (filter.projectId) {
    q = query(q, where('projectId', '==', filter.projectId));
  }
  
  if (filter.syncStatus) {
    q = query(q, where('syncStatus', '==', filter.syncStatus));
  }
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const clips = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
      updatedAt: (doc.data().updatedAt as Timestamp)?.toDate() || new Date(),
    })) as DesignClip[];
    
    // Client-side filtering for search
    let filtered = clips;
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = clips.filter(clip => 
        clip.title.toLowerCase().includes(searchLower) ||
        clip.description?.toLowerCase().includes(searchLower) ||
        clip.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    callback(filtered);
  });
  
  return unsubscribe;
}

/**
 * Create a new clip
 */
export async function createClip(
  clip: Omit<DesignClip, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const clipsRef = collection(db, CLIPS_COLLECTION);
  
  const docRef = await addDoc(clipsRef, {
    ...clip,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

/**
 * Update an existing clip
 */
export async function updateClip(
  clipId: string,
  updates: Partial<DesignClip>
): Promise<void> {
  const clipRef = doc(db, CLIPS_COLLECTION, clipId);
  
  await updateDoc(clipRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a clip
 */
export async function deleteClip(clipId: string): Promise<void> {
  const clipRef = doc(db, CLIPS_COLLECTION, clipId);
  await deleteDoc(clipRef);
}

/**
 * Link a clip to a design item
 */
export async function linkClipToDesignItem(
  clipId: string,
  projectId: string,
  designItemId: string
): Promise<void> {
  await updateClip(clipId, { projectId, designItemId });
}

/**
 * Get clip statistics
 */
export function subscribeToClipStats(
  userId: string,
  callback: (stats: ClipStats) => void
): () => void {
  return subscribeToClips(userId, {}, (clips) => {
    const stats: ClipStats = {
      total: clips.length,
      synced: clips.filter(c => c.syncStatus === 'synced').length,
      pending: clips.filter(c => c.syncStatus === 'pending').length,
      byProject: {},
    };
    
    clips.forEach(clip => {
      if (clip.projectId) {
        stats.byProject[clip.projectId] = (stats.byProject[clip.projectId] || 0) + 1;
      }
    });
    
    callback(stats);
  });
}
