/**
 * Template Manager Service
 * Manages report templates in Firestore
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
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import type {
  ReportTemplate,
  ReportTemplateInput,
  ReportType,
  TemplateValidationResult,
} from '../types';

// ============================================================================
// COLLECTION PATHS
// ============================================================================

const getTemplatesPath = (orgId: string) =>
  `organizations/${orgId}/report_templates`;

// ============================================================================
// TEMPLATE MANAGER SERVICE
// ============================================================================

export class TemplateManagerService {
  private static instance: TemplateManagerService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): TemplateManagerService {
    if (!TemplateManagerService.instance) {
      TemplateManagerService.instance = new TemplateManagerService(db);
    }
    return TemplateManagerService.instance;
  }

  // ============================================================================
  // CREATE
  // ============================================================================

  /**
   * Create a new report template
   */
  async createTemplate(
    orgId: string,
    input: ReportTemplateInput,
    userId: string
  ): Promise<string> {
    // Validate template
    const validation = this.validateTemplate(input);
    if (!validation.isValid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    const templatesRef = collection(this.db, getTemplatesPath(orgId));

    // If this template is marked as default, unset other defaults of same type
    if (input.isDefault) {
      await this.unsetDefaultTemplates(orgId, input.type);
    }

    const templateData = {
      ...input,
      createdAt: serverTimestamp(),
      createdBy: userId,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    };

    const docRef = await addDoc(templatesRef, templateData);
    return docRef.id;
  }

  // ============================================================================
  // READ
  // ============================================================================

  /**
   * Get a template by ID
   */
  async getTemplate(
    orgId: string,
    templateId: string
  ): Promise<ReportTemplate | null> {
    const templateRef = doc(this.db, getTemplatesPath(orgId), templateId);
    const snapshot = await getDoc(templateRef);

    if (!snapshot.exists()) {
      return null;
    }

    return {
      id: snapshot.id,
      ...snapshot.data(),
    } as ReportTemplate;
  }

  /**
   * Get all templates for an organization
   */
  async getAllTemplates(
    orgId: string,
    activeOnly: boolean = true
  ): Promise<ReportTemplate[]> {
    const templatesRef = collection(this.db, getTemplatesPath(orgId));

    let q;
    if (activeOnly) {
      q = query(
        templatesRef,
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
    } else {
      q = query(templatesRef, orderBy('name', 'asc'));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as ReportTemplate
    );
  }

  /**
   * Get templates by type
   */
  async getTemplatesByType(
    orgId: string,
    type: ReportType,
    activeOnly: boolean = true
  ): Promise<ReportTemplate[]> {
    const templatesRef = collection(this.db, getTemplatesPath(orgId));

    let q;
    if (activeOnly) {
      q = query(
        templatesRef,
        where('type', '==', type),
        where('isActive', '==', true),
        orderBy('name', 'asc')
      );
    } else {
      q = query(
        templatesRef,
        where('type', '==', type),
        orderBy('name', 'asc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
        }) as ReportTemplate
    );
  }

  /**
   * Get the default template for a report type
   */
  async getDefaultTemplate(
    orgId: string,
    type: ReportType
  ): Promise<ReportTemplate | null> {
    const templatesRef = collection(this.db, getTemplatesPath(orgId));

    const q = query(
      templatesRef,
      where('type', '==', type),
      where('isDefault', '==', true),
      where('isActive', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Fallback: get any active template of this type
      const fallbackQ = query(
        templatesRef,
        where('type', '==', type),
        where('isActive', '==', true)
      );
      const fallbackSnapshot = await getDocs(fallbackQ);

      if (fallbackSnapshot.empty) {
        return null;
      }

      return {
        id: fallbackSnapshot.docs[0].id,
        ...fallbackSnapshot.docs[0].data(),
      } as ReportTemplate;
    }

    return {
      id: snapshot.docs[0].id,
      ...snapshot.docs[0].data(),
    } as ReportTemplate;
  }

  // ============================================================================
  // UPDATE
  // ============================================================================

  /**
   * Update a template
   */
  async updateTemplate(
    orgId: string,
    templateId: string,
    updates: Partial<ReportTemplateInput>,
    userId: string
  ): Promise<void> {
    const templateRef = doc(this.db, getTemplatesPath(orgId), templateId);

    // If setting as default, unset other defaults
    if (updates.isDefault && updates.type) {
      await this.unsetDefaultTemplates(orgId, updates.type, templateId);
    }

    await updateDoc(templateRef, {
      ...updates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  /**
   * Set a template as the default for its type
   */
  async setAsDefault(
    orgId: string,
    templateId: string,
    userId: string
  ): Promise<void> {
    const template = await this.getTemplate(orgId, templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Unset other defaults
    await this.unsetDefaultTemplates(orgId, template.type, templateId);

    // Set this template as default
    const templateRef = doc(this.db, getTemplatesPath(orgId), templateId);
    await updateDoc(templateRef, {
      isDefault: true,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  /**
   * Activate or deactivate a template
   */
  async setTemplateActive(
    orgId: string,
    templateId: string,
    isActive: boolean,
    userId: string
  ): Promise<void> {
    const templateRef = doc(this.db, getTemplatesPath(orgId), templateId);
    await updateDoc(templateRef, {
      isActive,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  // ============================================================================
  // DELETE
  // ============================================================================

  /**
   * Delete a template
   */
  async deleteTemplate(orgId: string, templateId: string): Promise<void> {
    const templateRef = doc(this.db, getTemplatesPath(orgId), templateId);
    await deleteDoc(templateRef);
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  /**
   * Validate a template configuration
   */
  validateTemplate(
    template: ReportTemplateInput | ReportTemplate
  ): TemplateValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingPlaceholders: string[] = [];

    // Required fields
    if (!template.name?.trim()) {
      errors.push('Template name is required');
    }

    if (!template.type) {
      errors.push('Report type is required');
    }

    if (!template.googleDocTemplateId?.trim()) {
      errors.push('Google Doc template ID is required');
    }

    // Placeholders validation
    if (!template.placeholders || template.placeholders.length === 0) {
      warnings.push('No placeholders defined - report will not have dynamic content');
    } else {
      // Check for duplicate placeholders
      const placeholderSet = new Set<string>();
      for (const ph of template.placeholders) {
        if (!ph.placeholder) {
          errors.push('Placeholder text is required for all placeholders');
          continue;
        }
        if (placeholderSet.has(ph.placeholder)) {
          errors.push(`Duplicate placeholder: ${ph.placeholder}`);
        }
        placeholderSet.add(ph.placeholder);

        // Check placeholder format
        if (!ph.placeholder.startsWith('{{') || !ph.placeholder.endsWith('}}')) {
          warnings.push(
            `Placeholder "${ph.placeholder}" should use {{PLACEHOLDER}} format`
          );
        }

        if (!ph.fieldPath) {
          errors.push(`Field path is required for placeholder: ${ph.placeholder}`);
        }
      }
    }

    // Folder path validation
    if (!template.folderPath?.trim()) {
      warnings.push('No folder path defined - reports will be saved in root folder');
    }

    // File naming pattern validation
    if (!template.fileNamingPattern?.trim()) {
      warnings.push('No file naming pattern - using default naming');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingPlaceholders,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Unset default flag for all templates of a type (except excluded one)
   */
  private async unsetDefaultTemplates(
    orgId: string,
    type: ReportType,
    excludeTemplateId?: string
  ): Promise<void> {
    const templatesRef = collection(this.db, getTemplatesPath(orgId));
    const q = query(
      templatesRef,
      where('type', '==', type),
      where('isDefault', '==', true)
    );

    const snapshot = await getDocs(q);

    const updates = snapshot.docs
      .filter((doc) => doc.id !== excludeTemplateId)
      .map((doc) =>
        updateDoc(doc.ref, {
          isDefault: false,
          updatedAt: serverTimestamp(),
        })
      );

    await Promise.all(updates);
  }
}

export default TemplateManagerService;
