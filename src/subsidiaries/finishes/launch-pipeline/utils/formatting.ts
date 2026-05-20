/**
 * Formatting Utilities
 * Functions for formatting launch pipeline data for display
 */

import { Timestamp } from 'firebase/firestore';
import type { LaunchProduct, ProductCategory } from '../types/product.types';
import type { PipelineStage, DeliverableType } from '../types/stage.types';

/**
 * Format a product name for URL/handle
 */
export function generateHandle(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Format category for display
 */
export function formatCategory(category: ProductCategory): string {
  const labels: Record<ProductCategory, string> = {
    casework: 'Casework',
    furniture: 'Furniture',
    millwork: 'Millwork',
    doors: 'Doors & Panels',
    fixtures: 'Fixtures',
    specialty: 'Specialty Items',
  };
  return labels[category] || category;
}

/**
 * Format stage for display
 */
export function formatStage(stage: PipelineStage): string {
  const labels: Record<PipelineStage, string> = {
    idea: 'Idea',
    research: 'Research',
    design: 'Design',
    prototype: 'Prototype',
    photography: 'Photography',
    documentation: 'Documentation',
    launched: 'Launched',
  };
  return labels[stage] || stage;
}

/**
 * Format deliverable type for display
 */
export function formatDeliverableType(type: DeliverableType): string {
  const labels: Record<DeliverableType, string> = {
    concept_brief: 'Concept Brief',
    market_positioning: 'Market Positioning',
    reference_images: 'Reference Images',
    competitor_analysis: 'Competitor Analysis',
    pricing_strategy: 'Pricing Strategy',
    material_research: 'Material Research',
    cad_files: 'CAD Files',
    technical_drawings: 'Technical Drawings',
    bom_draft: 'Bill of Materials',
    cutlist: 'Cut List',
    physical_sample: 'Physical Sample',
    qc_notes: 'QC Notes',
    iteration_log: 'Iteration Log',
    hero_images: 'Hero Images',
    detail_shots: 'Detail Shots',
    lifestyle_photos: 'Lifestyle Photos',
    '360_views': '360° Views',
    product_description: 'Product Description',
    seo_metadata: 'SEO Metadata',
    specifications: 'Specifications',
    care_instructions: 'Care Instructions',
  };
  return labels[type] || type;
}

/**
 * Format priority for display with color hint
 */
export function formatPriority(priority: LaunchProduct['priority']): {
  label: string;
  color: string;
  bgColor: string;
} {
  const config: Record<LaunchProduct['priority'], { label: string; color: string; bgColor: string }> = {
    low: { label: 'Low', color: 'text-gray-600', bgColor: 'bg-gray-100' },
    medium: { label: 'Medium', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
    urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
  };
  return config[priority];
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: Timestamp | Date | null | undefined): string {
  if (!timestamp) return 'N/A';

  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format timestamp with time
 */
export function formatTimestampWithTime(timestamp: Timestamp | Date | null | undefined): string {
  if (!timestamp) return 'N/A';

  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(timestamp: Timestamp | Date | null | undefined): string {
  if (!timestamp) return 'N/A';

  const date = timestamp instanceof Timestamp ? timestamp.toDate() : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return formatTimestamp(date);
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return 'N/A';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Format dimensions for display
 */
export function formatDimensions(
  dimensions: { length: number; width: number; height: number; unit: 'mm' | 'cm' | 'in' } | undefined
): string {
  if (!dimensions) return 'Not specified';

  const { length, width, height, unit } = dimensions;
  return `${length} × ${width} × ${height} ${unit}`;
}

/**
 * Format weight for display
 */
export function formatWeight(weight: { value: number; unit: 'kg' | 'lb' } | undefined): string {
  if (!weight) return 'Not specified';
  return `${weight.value} ${weight.unit}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format product summary for list views
 */
export function formatProductSummary(product: LaunchProduct): string {
  const parts: string[] = [formatCategory(product.category)];

  if (product.specifications?.materials?.length) {
    parts.push(product.specifications.materials.slice(0, 2).join(', '));
  }

  if (product.specifications?.dimensions) {
    parts.push(formatDimensions(product.specifications.dimensions));
  }

  return parts.join(' • ');
}

/**
 * Generate a product code from name and category
 */
export function generateProductCode(name: string, category: ProductCategory): string {
  const categoryPrefixes: Record<ProductCategory, string> = {
    casework: 'CW',
    furniture: 'FN',
    millwork: 'MW',
    doors: 'DR',
    fixtures: 'FX',
    specialty: 'SP',
  };

  const prefix = categoryPrefixes[category];
  const nameCode = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 4);
  const timestamp = Date.now().toString(36).toUpperCase().slice(-4);

  return `${prefix}-${nameCode}-${timestamp}`;
}
