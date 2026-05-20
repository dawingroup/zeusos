/**
 * Template Service
 * Content template management for campaigns and social media
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ContentTemplate,
  TemplateFormData,
  TemplateFilters,
  TemplatePreview,
} from '../types';
import { TEMPLATES_COLLECTION } from '../constants';

// Collection reference
const templatesRef = collection(db, TEMPLATES_COLLECTION);

// ============================================
// Template CRUD Operations
// ============================================

/**
 * Create a new content template
 */
export async function createTemplate(
  companyId: string,
  data: TemplateFormData,
  userId: string,
  userName: string
): Promise<string> {
  const placeholders = extractPlaceholders(data.content);

  const template: Omit<ContentTemplate, 'id'> = {
    companyId,
    name: data.name,
    description: data.description,
    templateType: data.templateType,
    status: 'active',
    content: data.content,
    placeholders,
    mediaUrls: data.mediaUrls,
    suggestedHashtags: data.suggestedHashtags,
    whatsappTemplateId: data.whatsappTemplateId,
    whatsappTemplateName: data.whatsappTemplateName,
    usageCount: 0,
    category: data.category,
    tags: data.tags,
    createdBy: userId,
    createdByName: userName,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const docRef = await addDoc(templatesRef, template);
  return docRef.id;
}

/**
 * Get a single template by ID
 */
export async function getTemplate(templateId: string): Promise<ContentTemplate | null> {
  const docRef = doc(db, TEMPLATES_COLLECTION, templateId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as ContentTemplate;
}

/**
 * Get all templates for a company with optional filters
 */
export async function getTemplates(
  companyId: string,
  filters: TemplateFilters = {}
): Promise<ContentTemplate[]> {
  const constraints: any[] = [
    where('companyId', '==', companyId),
    where('status', '!=', 'archived'),
  ];

  if (filters.templateType) {
    constraints.push(where('templateType', '==', filters.templateType));
  }

  if (filters.category) {
    constraints.push(where('category', '==', filters.category));
  }

  constraints.push(orderBy('usageCount', 'desc'));

  const q = query(templatesRef, ...constraints);
  const snapshot = await getDocs(q);

  let templates = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ContentTemplate[];

  // Client-side filters
  if (filters.search) {
    const searchLower = filters.search.toLowerCase();
    templates = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(searchLower) ||
        t.description.toLowerCase().includes(searchLower) ||
        t.content.toLowerCase().includes(searchLower)
    );
  }

  if (filters.tags && filters.tags.length > 0) {
    templates = templates.filter((t) => t.tags.some((tag) => filters.tags!.includes(tag)));
  }

  return templates;
}

/**
 * Update a template
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<TemplateFormData>
): Promise<void> {
  const docRef = doc(db, TEMPLATES_COLLECTION, templateId);

  const updateData: any = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Recalculate placeholders if content changed
  if (updates.content) {
    updateData.placeholders = extractPlaceholders(updates.content);
  }

  await updateDoc(docRef, updateData);
}

/**
 * Archive a template (soft delete)
 */
export async function archiveTemplate(templateId: string): Promise<void> {
  const docRef = doc(db, TEMPLATES_COLLECTION, templateId);
  await updateDoc(docRef, {
    status: 'archived',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a template permanently
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const docRef = doc(db, TEMPLATES_COLLECTION, templateId);
  await deleteDoc(docRef);
}

// ============================================
// Template Usage Tracking
// ============================================

/**
 * Increment template usage count
 */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
  const docRef = doc(db, TEMPLATES_COLLECTION, templateId);
  await updateDoc(docRef, {
    usageCount: increment(1),
    lastUsed: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Real-time Subscriptions
// ============================================

/**
 * Subscribe to templates list with real-time updates
 */
export function subscribeToTemplates(
  companyId: string,
  callback: (templates: ContentTemplate[]) => void,
  onError?: (error: Error) => void,
  filters: TemplateFilters = {}
): () => void {
  const constraints: any[] = [
    where('companyId', '==', companyId),
    where('status', '!=', 'archived'),
  ];

  if (filters.templateType) {
    constraints.push(where('templateType', '==', filters.templateType));
  }

  constraints.push(orderBy('usageCount', 'desc'));

  const q = query(templatesRef, ...constraints);

  return onSnapshot(
    q,
    (snapshot) => {
      let templates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ContentTemplate[];

      // Client-side filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        templates = templates.filter(
          (t) =>
            t.name.toLowerCase().includes(searchLower) ||
            t.description.toLowerCase().includes(searchLower)
        );
      }

      if (filters.tags && filters.tags.length > 0) {
        templates = templates.filter((t) => t.tags.some((tag) => filters.tags!.includes(tag)));
      }

      callback(templates);
    },
    (error) => {
      console.error('Templates subscription error:', error);
      onError?.(error);
    }
  );
}

// ============================================
// Template Utilities
// ============================================

/**
 * Extract placeholders from template content
 * Placeholders are in the format {{placeholder}}
 */
export function extractPlaceholders(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const placeholders: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const placeholder = match[1].trim();
    if (!placeholders.includes(placeholder)) {
      placeholders.push(placeholder);
    }
  }

  return placeholders;
}

/**
 * Replace placeholders in template content with actual values
 */
export function replacePlaceholders(
  content: string,
  values: Record<string, string>
): string {
  let result = content;

  Object.entries(values).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    result = result.replace(regex, value);
  });

  return result;
}

/**
 * Preview template with sample or real data
 */
export function previewTemplate(
  template: ContentTemplate,
  values: Record<string, string> = {}
): TemplatePreview {
  // Provide default values for missing placeholders
  const completeValues: Record<string, string> = { ...values };

  template.placeholders.forEach((placeholder) => {
    if (!completeValues[placeholder]) {
      completeValues[placeholder] = `[${placeholder}]`;
    }
  });

  return {
    content: template.content,
    resolvedContent: replacePlaceholders(template.content, completeValues),
    placeholders: completeValues,
  };
}

/**
 * Validate template placeholder values
 */
export function validatePlaceholderValues(
  template: ContentTemplate,
  values: Record<string, string>
): string[] {
  const errors: string[] = [];

  template.placeholders.forEach((placeholder) => {
    if (!values[placeholder] || values[placeholder].trim() === '') {
      errors.push(`Missing value for placeholder: ${placeholder}`);
    }
  });

  return errors;
}

// ============================================
// Template Queries
// ============================================

/**
 * Get popular templates (most used)
 */
export async function getPopularTemplates(
  companyId: string,
  limitCount = 10
): Promise<ContentTemplate[]> {
  const q = query(
    templatesRef,
    where('companyId', '==', companyId),
    where('status', '==', 'active'),
    orderBy('usageCount', 'desc'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  const templates = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ContentTemplate[];

  return templates.slice(0, limitCount);
}

/**
 * Get templates by category
 */
export async function getTemplatesByCategory(
  companyId: string,
  category: string
): Promise<ContentTemplate[]> {
  const q = query(
    templatesRef,
    where('companyId', '==', companyId),
    where('category', '==', category),
    where('status', '==', 'active'),
    orderBy('usageCount', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ContentTemplate[];
}

/**
 * Get WhatsApp templates (linked to approved WhatsApp templates)
 */
export async function getWhatsAppTemplates(companyId: string): Promise<ContentTemplate[]> {
  const q = query(
    templatesRef,
    where('companyId', '==', companyId),
    where('templateType', '==', 'whatsapp'),
    where('status', '==', 'active'),
    orderBy('usageCount', 'desc')
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ContentTemplate[];
}
