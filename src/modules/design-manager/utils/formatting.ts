/**
 * Formatting Utilities
 * Display formatting for Design Manager types
 */

import type { DesignStage, DesignCategory, RAGStatusValue } from '../types';

/**
 * Human-readable labels for design stages
 */
export const STAGE_LABELS: Record<DesignStage, string> = {
  // Manufacturing stages (Custom Furniture/Millwork)
  'concept': 'Concept Development',
  'preliminary': 'Preliminary Design',
  'technical': 'Technical Design',
  'pre-production': 'Pre-Production',
  'production-ready': 'Production Ready',
  // Procurement stages
  'procure-identify': 'Procurement - Identify',
  'procure-quote': 'Procurement - Quote',
  'procure-approve': 'Procurement - Approve',
  'procure-order': 'Procurement - Order',
  'procure-received': 'Procurement - Received',
  // Design Document stages (Brief → Schematic → Development → Construction Docs → Approval)
  'arch-brief': 'Project Brief',
  'arch-schematic': 'Schematic Design',
  'arch-development': 'Design Development',
  'arch-construction-docs': 'Construction Documents',
  'arch-approved': 'Approved',
  // Construction stages
  'const-scope': 'Scope Definition',
  'const-spec': 'Specification',
  'const-quote': 'Quotation',
  'const-approve': 'Approval',
  'const-in-progress': 'Work In Progress',
  'const-inspection': 'Inspection/QC',
  'const-complete': 'Completed',
};

/**
 * Short labels for design stages
 */
export const STAGE_SHORT_LABELS: Record<DesignStage, string> = {
  // Manufacturing stages
  'concept': 'Concept',
  'preliminary': 'Preliminary',
  'technical': 'Technical',
  'pre-production': 'Pre-Prod',
  'production-ready': 'Ready',
  // Procurement stages
  'procure-identify': 'Identify',
  'procure-quote': 'Quote',
  'procure-approve': 'Approve',
  'procure-order': 'Order',
  'procure-received': 'Received',
  // Design Document stages
  'arch-brief': 'Brief',
  'arch-schematic': 'Schematic',
  'arch-development': 'Development',
  'arch-construction-docs': 'Const. Docs',
  'arch-approved': 'Approved',
  // Construction stages
  'const-scope': 'Scope',
  'const-spec': 'Spec',
  'const-quote': 'Quote',
  'const-approve': 'Approve',
  'const-in-progress': 'In Progress',
  'const-inspection': 'Inspection',
  'const-complete': 'Complete',
};

/**
 * Emoji icons for design stages
 */
export const STAGE_ICONS: Record<DesignStage, string> = {
  // Manufacturing stages
  'concept': '💡',
  'preliminary': '📐',
  'technical': '⚙️',
  'pre-production': '🔧',
  'production-ready': '✅',
  // Procurement stages
  'procure-identify': '🔎',
  'procure-quote': '💬',
  'procure-approve': '🟣',
  'procure-order': '🛒',
  'procure-received': '📦',
  // Design Document stages
  'arch-brief': '📋',
  'arch-schematic': '✏️',
  'arch-development': '📐',
  'arch-construction-docs': '📄',
  'arch-approved': '✅',
  // Construction stages
  'const-scope': '📋',
  'const-spec': '📝',
  'const-quote': '💰',
  'const-approve': '✓',
  'const-in-progress': '🔨',
  'const-inspection': '🔍',
  'const-complete': '🏁',
};

/**
 * Human-readable labels for design categories
 */
export const CATEGORY_LABELS: Record<DesignCategory, string> = {
  'casework': 'Casework',
  'furniture': 'Furniture',
  'millwork': 'Millwork',
  'doors': 'Doors',
  'fixtures': 'Fixtures',
  'specialty': 'Specialty',
  'architectural': 'Architectural',
};

/**
 * Hex color values for RAG statuses
 */
export const RAG_COLORS: Record<RAGStatusValue, string> = {
  'red': '#EF4444',
  'amber': '#F59E0B',
  'green': '#22C55E',
  'not-applicable': '#9CA3AF',
};

/**
 * Tailwind background color classes for RAG statuses
 */
export const RAG_BG_COLORS: Record<RAGStatusValue, string> = {
  'red': 'bg-red-500',
  'amber': 'bg-amber-500',
  'green': 'bg-green-500',
  'not-applicable': 'bg-gray-400',
};

/**
 * Tailwind text color classes for RAG statuses
 */
export const RAG_TEXT_COLORS: Record<RAGStatusValue, string> = {
  'red': 'text-red-500',
  'amber': 'text-amber-500',
  'green': 'text-green-500',
  'not-applicable': 'text-gray-400',
};

/**
 * Tailwind border color classes for RAG statuses
 */
export const RAG_BORDER_COLORS: Record<RAGStatusValue, string> = {
  'red': 'border-red-500',
  'amber': 'border-amber-500',
  'green': 'border-green-500',
  'not-applicable': 'border-gray-400',
};

/**
 * Human-readable labels for RAG statuses
 */
export const RAG_LABELS: Record<RAGStatusValue, string> = {
  'red': 'Not Ready',
  'amber': 'In Progress',
  'green': 'Complete',
  'not-applicable': 'N/A',
};

/**
 * Format a project code
 * @param year - Year (e.g., 2025)
 * @param sequence - Sequence number
 * @returns Formatted code (e.g., DF-2025-001)
 */
export function formatProjectCode(year: number, sequence: number): string {
  return `DF-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Format a design item code
 * @param projectCode - Parent project code
 * @param sequence - Item sequence number
 * @returns Formatted code (e.g., DF-2025-001-003)
 */
export function formatItemCode(projectCode: string, sequence: number): string {
  return `${projectCode}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Format a date timestamp
 * @param timestamp - Firestore timestamp
 * @returns Formatted date string
 */
export function formatDate(timestamp: { seconds: number; nanoseconds: number }): string {
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a datetime timestamp
 * @param timestamp - Firestore timestamp or Date or any timestamp-like object
 * @returns Formatted datetime string
 */
export function formatDateTime(timestamp: any): string {
  if (!timestamp) return 'N/A';
  
  let date: Date;
  
  // Handle Firestore Timestamp with toDate() method
  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  }
  // Handle plain object with seconds
  else if (timestamp.seconds !== undefined) {
    date = new Date(timestamp.seconds * 1000);
  }
  // Handle Date object
  else if (timestamp instanceof Date) {
    date = timestamp;
  }
  // Handle number (milliseconds)
  else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  }
  // Fallback
  else {
    return 'N/A';
  }
  
  return date.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 * @param timestamp - Firestore timestamp
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: { seconds: number; nanoseconds: number }): string {
  const now = Date.now();
  const then = timestamp.seconds * 1000;
  const diff = now - then;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return formatDate(timestamp);
}

/**
 * Format a percentage with optional decimal places
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 0)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Get initials from a name or email
 * @param nameOrEmail - Full name or email address
 * @returns Initials (e.g., "JD" or "JS")
 */
export function getInitials(nameOrEmail: string): string {
  if (!nameOrEmail) return '??';
  
  // If it's an email, use the part before @
  const name = nameOrEmail.includes('@') 
    ? nameOrEmail.split('@')[0] 
    : nameOrEmail;
  
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  
  return name.substring(0, 2).toUpperCase();
}

/**
 * Truncate text with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
