/**
 * Design Options Service
 * CRUD operations for design options and integration with client portal approvals
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { createApprovalItem } from './clientPortalExtendedService';
import type {
  DesignOption,
  DesignOptionGroup,
  DesignOptionFormData,
  DesignOptionInspiration,
  DesignOptionStatus,
  DesignOptionFilters,
  SubmitForApprovalOptions,
} from '../types/designOptions';
import type { DesignClip } from '@/subsidiaries/finishes/clipper/types';

const DESIGN_OPTIONS_COLLECTION = 'designOptions';
const DESIGN_OPTION_GROUPS_COLLECTION = 'designOptionGroups';

// ============================================================================
// DESIGN OPTION CRUD
// ============================================================================

/**
 * Create a new design option (draft)
 */
export async function createDesignOption(
  projectId: string,
  data: DesignOptionFormData,
  userId: string,
  designItemId?: string,
  designItemName?: string
): Promise<DesignOption> {
  const optionsRef = collection(db, DESIGN_OPTIONS_COLLECTION);

  const option: Omit<DesignOption, 'id'> = {
    projectId,
    designItemId,
    designItemName,
    name: data.name,
    description: data.description,
    category: data.category,
    inspirations: data.inspirations || [],
    estimatedCost: data.estimatedCost,
    currency: data.currency || 'UGX',
    isRecommended: data.isRecommended || false,
    comparisonNotes: data.comparisonNotes,
    status: 'draft',
    priority: data.priority || 'medium',
    tags: data.tags || [],
    createdAt: Timestamp.now(),
    createdBy: userId,
  };

  const docRef = await addDoc(optionsRef, {
    ...option,
    createdAt: serverTimestamp(),
  });

  return { id: docRef.id, ...option };
}

/**
 * Update a design option
 */
export async function updateDesignOption(
  optionId: string,
  updates: Partial<Omit<DesignOption, 'id' | 'createdAt' | 'createdBy' | 'projectId'>>
): Promise<void> {
  const optionRef = doc(db, DESIGN_OPTIONS_COLLECTION, optionId);
  await updateDoc(optionRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get a design option by ID
 */
export async function getDesignOption(optionId: string): Promise<DesignOption | null> {
  const optionRef = doc(db, DESIGN_OPTIONS_COLLECTION, optionId);
  const snapshot = await getDoc(optionRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as DesignOption;
}

/**
 * Delete a design option
 */
export async function deleteDesignOption(optionId: string): Promise<void> {
  const optionRef = doc(db, DESIGN_OPTIONS_COLLECTION, optionId);
  await deleteDoc(optionRef);
}

// ============================================================================
// INSPIRATION MANAGEMENT
// ============================================================================

/**
 * Add an inspiration to a design option
 */
export async function addInspirationToOption(
  optionId: string,
  inspiration: DesignOptionInspiration
): Promise<void> {
  const option = await getDesignOption(optionId);
  if (!option) {
    throw new Error('Design option not found');
  }

  const newInspiration: DesignOptionInspiration = {
    ...inspiration,
    order: option.inspirations.length,
  };

  await updateDesignOption(optionId, {
    inspirations: [...option.inspirations, newInspiration],
  });
}

/**
 * Link an existing clip to a design option
 */
export async function linkClipToOption(
  optionId: string,
  clipId: string
): Promise<void> {
  // Get the clip data
  const clipRef = doc(db, 'designClips', clipId);
  const clipSnapshot = await getDoc(clipRef);

  if (!clipSnapshot.exists()) {
    throw new Error('Clip not found');
  }

  const clip = clipSnapshot.data() as DesignClip;

  const inspiration: DesignOptionInspiration = {
    id: clipId,
    clipId: clipId,
    imageUrl: clip.imageUrl,
    thumbnailUrl: clip.thumbnailUrl,
    title: clip.title,
    description: clip.description,
    sourceUrl: clip.sourceUrl,
    aiAnalysis: clip.aiAnalysis,
    isManualUpload: clip.uploadSource === 'manual-upload',
  };

  await addInspirationToOption(optionId, inspiration);
}

/**
 * Remove an inspiration from a design option
 */
export async function removeInspirationFromOption(
  optionId: string,
  inspirationId: string
): Promise<void> {
  const option = await getDesignOption(optionId);
  if (!option) {
    throw new Error('Design option not found');
  }

  const updatedInspirations = option.inspirations
    .filter(insp => insp.id !== inspirationId)
    .map((insp, index) => ({ ...insp, order: index }));

  await updateDesignOption(optionId, {
    inspirations: updatedInspirations,
  });
}

/**
 * Reorder inspirations in a design option
 */
export async function reorderInspirations(
  optionId: string,
  inspirationIds: string[]
): Promise<void> {
  const option = await getDesignOption(optionId);
  if (!option) {
    throw new Error('Design option not found');
  }

  const inspirationMap = new Map(option.inspirations.map(insp => [insp.id, insp]));
  const reorderedInspirations = inspirationIds
    .map((id, index) => {
      const insp = inspirationMap.get(id);
      return insp ? { ...insp, order: index } : null;
    })
    .filter((insp): insp is NonNullable<typeof insp> => insp !== null);

  await updateDesignOption(optionId, {
    inspirations: reorderedInspirations as DesignOptionInspiration[],
  });
}

// ============================================================================
// APPROVAL WORKFLOW
// ============================================================================

/**
 * Submit a design option for client approval
 */
export async function submitForApproval(
  optionId: string,
  userId: string,
  options?: SubmitForApprovalOptions
): Promise<{ approvalItemId: string }> {
  const option = await getDesignOption(optionId);
  if (!option) {
    throw new Error('Design option not found');
  }

  if (option.status !== 'draft' && option.status !== 'revision') {
    throw new Error('Only draft or revision options can be submitted');
  }

  // Create approval item in client portal
  const approvalItem = await createApprovalItem(
    option.projectId,
    'design_option',
    option.name,
    1, // Quantity is 1 for design options
    option.estimatedCost || 0,
    userId,
    {
      quoteId: options?.quoteId,
      designItemId: option.designItemId,
      designItemName: option.designItemName,
      description: option.description,
      currency: option.currency,
      imageUrl: option.inspirations[0]?.imageUrl,
      priority: options?.priority || option.priority,
      dueDate: options?.dueDate,
      // Design option specific fields
      designOption: {
        category: option.category,
        inspirations: option.inspirations.map(insp => ({
          id: insp.id,
          clipId: insp.clipId,
          imageUrl: insp.imageUrl,
          thumbnailUrl: insp.thumbnailUrl,
          title: insp.title,
          description: insp.description,
          sourceUrl: insp.sourceUrl,
        })),
        isRecommended: option.isRecommended,
        comparisonNotes: option.comparisonNotes,
      },
      sourceOptionId: optionId,
    }
  );

  // Update option status
  await updateDesignOption(optionId, {
    status: 'submitted',
    submittedAt: Timestamp.now(),
    submittedBy: userId,
    approvalItemId: approvalItem.id,
  });

  return { approvalItemId: approvalItem.id };
}

/**
 * Handle client response to a design option
 * Called when approval item status changes
 */
export async function handleClientResponse(
  optionId: string,
  status: 'approved' | 'rejected' | 'revision',
  respondedBy?: string,
  notes?: string
): Promise<void> {
  const statusMap: Record<string, DesignOptionStatus> = {
    approved: 'approved',
    rejected: 'rejected',
    revision: 'revision',
  };

  await updateDesignOption(optionId, {
    status: statusMap[status],
    clientResponse: {
      status: statusMap[status],
      notes,
      respondedAt: Timestamp.now(),
      respondedBy,
    },
  });
}

// ============================================================================
// OPTION GROUPS
// ============================================================================

/**
 * Create an option group for comparison
 */
export async function createOptionGroup(
  projectId: string,
  name: string,
  optionIds: string[],
  userId: string,
  designItemId?: string,
  description?: string
): Promise<DesignOptionGroup> {
  const groupsRef = collection(db, DESIGN_OPTION_GROUPS_COLLECTION);

  const group: Omit<DesignOptionGroup, 'id'> = {
    projectId,
    designItemId,
    name,
    description,
    optionIds,
    status: 'draft',
    createdAt: Timestamp.now(),
    createdBy: userId,
  };

  const docRef = await addDoc(groupsRef, {
    ...group,
    createdAt: serverTimestamp(),
  });

  return { id: docRef.id, ...group };
}

/**
 * Submit an option group for approval (client picks one)
 */
export async function submitGroupForApproval(
  groupId: string,
  userId: string,
  options?: SubmitForApprovalOptions
): Promise<{ approvalItemId: string }> {
  const groupRef = doc(db, DESIGN_OPTION_GROUPS_COLLECTION, groupId);
  const groupSnapshot = await getDoc(groupRef);

  if (!groupSnapshot.exists()) {
    throw new Error('Option group not found');
  }

  const group = { id: groupSnapshot.id, ...groupSnapshot.data() } as DesignOptionGroup;

  // Get all options in the group
  const optionPromises = group.optionIds.map(id => getDesignOption(id));
  const optionsData = await Promise.all(optionPromises);
  const validOptions = optionsData.filter((opt): opt is DesignOption => opt !== null);

  if (validOptions.length === 0) {
    throw new Error('No valid options in group');
  }

  // Use the first option as the primary, others as alternatives
  const primaryOption = validOptions.find(opt => opt.isRecommended) || validOptions[0];
  const alternativeOptions = validOptions
    .filter(opt => opt.id !== primaryOption.id)
    .map(opt => ({
      id: opt.id,
      name: opt.name,
      description: opt.description,
      unitCost: opt.estimatedCost || 0,
      imageUrl: opt.inspirations[0]?.imageUrl,
    }));

  // Create approval item
  const approvalItem = await createApprovalItem(
    group.projectId,
    'design_option',
    group.name,
    1,
    primaryOption.estimatedCost || 0,
    userId,
    {
      quoteId: options?.quoteId,
      designItemId: group.designItemId,
      description: group.description,
      imageUrl: primaryOption.inspirations[0]?.imageUrl,
      priority: options?.priority || 'medium',
      dueDate: options?.dueDate,
      alternativeOptions,
      designOption: {
        category: primaryOption.category,
        inspirations: primaryOption.inspirations.map(insp => ({
          id: insp.id,
          clipId: insp.clipId,
          imageUrl: insp.imageUrl,
          thumbnailUrl: insp.thumbnailUrl,
          title: insp.title,
          description: insp.description,
          sourceUrl: insp.sourceUrl,
        })),
        isRecommended: primaryOption.isRecommended,
        comparisonNotes: primaryOption.comparisonNotes,
      },
      isOptionGroup: true,
      sourceGroupId: groupId,
    }
  );

  // Update group and all options
  await updateDoc(groupRef, {
    status: 'submitted',
    approvalItemId: approvalItem.id,
    updatedAt: serverTimestamp(),
  });

  // Mark all options as submitted
  for (const opt of validOptions) {
    await updateDesignOption(opt.id, {
      status: 'submitted',
      submittedAt: Timestamp.now(),
      submittedBy: userId,
    });
  }

  return { approvalItemId: approvalItem.id };
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get design options for a project
 */
export async function getProjectDesignOptions(
  projectId: string,
  filters?: DesignOptionFilters
): Promise<DesignOption[]> {
  const optionsRef = collection(db, DESIGN_OPTIONS_COLLECTION);

  let q = query(
    optionsRef,
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );

  // Apply filters
  if (filters?.designItemId) {
    q = query(q, where('designItemId', '==', filters.designItemId));
  }

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length === 1) {
      q = query(q, where('status', '==', statuses[0]));
    }
    // For multiple statuses, we'll filter in memory
  }

  const snapshot = await getDocs(q);
  let options = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as DesignOption[];

  // Apply in-memory filters
  if (filters?.status && Array.isArray(filters.status) && filters.status.length > 1) {
    options = options.filter(opt => filters.status?.includes(opt.status));
  }

  if (filters?.category) {
    const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
    options = options.filter(opt => categories.includes(opt.category));
  }

  if (filters?.isRecommended !== undefined) {
    options = options.filter(opt => opt.isRecommended === filters.isRecommended);
  }

  return options;
}

/**
 * Subscribe to design options for a project (real-time)
 */
export function subscribeToDesignOptions(
  projectId: string,
  callback: (options: DesignOption[]) => void,
  filters?: DesignOptionFilters
): Unsubscribe {
  const optionsRef = collection(db, DESIGN_OPTIONS_COLLECTION);

  let q = query(
    optionsRef,
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );

  if (filters?.designItemId) {
    q = query(q, where('designItemId', '==', filters.designItemId));
  }

  return onSnapshot(q, (snapshot) => {
    let options = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as DesignOption[];

    // Apply in-memory filters
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      options = options.filter(opt => statuses.includes(opt.status));
    }

    if (filters?.category) {
      const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
      options = options.filter(opt => categories.includes(opt.category));
    }

    if (filters?.isRecommended !== undefined) {
      options = options.filter(opt => opt.isRecommended === filters.isRecommended);
    }

    callback(options);
  });
}

/**
 * Get option groups for a project
 */
export async function getProjectOptionGroups(
  projectId: string,
  status?: DesignOptionGroup['status']
): Promise<DesignOptionGroup[]> {
  const groupsRef = collection(db, DESIGN_OPTION_GROUPS_COLLECTION);

  let q = query(
    groupsRef,
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc')
  );

  if (status) {
    q = query(q, where('status', '==', status));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as DesignOptionGroup[];
}
