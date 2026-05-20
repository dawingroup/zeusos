/**
 * Content Template Types
 * Type definitions for reusable content templates
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Template Types
// ============================================

export type TemplateType = 'whatsapp' | 'social_post' | 'email';
export type TemplateStatus = 'draft' | 'active' | 'archived';

export interface ContentTemplate {
  id: string;
  companyId: string;

  // Template Identity
  name: string;
  description: string;
  templateType: TemplateType;
  status: TemplateStatus;

  // Content
  content: string; // With {{placeholders}}
  placeholders: string[];

  // Media (for social templates)
  mediaUrls?: string[];
  suggestedHashtags?: string[];

  // WhatsApp (reference to approved templates)
  whatsappTemplateId?: string;
  whatsappTemplateName?: string;

  // Usage tracking
  usageCount: number;
  lastUsed?: Timestamp;

  // Metadata
  category?: string;
  tags: string[];
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Template Preview
// ============================================

export interface TemplatePreview {
  content: string;
  resolvedContent: string;
  placeholders: Record<string, string>;
}

// ============================================
// Form & Filter Types
// ============================================

export interface TemplateFormData {
  name: string;
  description: string;
  templateType: TemplateType;
  content: string;
  mediaUrls?: string[];
  suggestedHashtags?: string[];
  whatsappTemplateId?: string;
  whatsappTemplateName?: string;
  category?: string;
  tags: string[];
}

export interface TemplateFilters {
  templateType?: TemplateType;
  status?: TemplateStatus;
  category?: string;
  search?: string;
  tags?: string[];
}
