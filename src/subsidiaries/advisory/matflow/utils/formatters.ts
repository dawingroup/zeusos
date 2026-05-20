/**
 * MatFlow Formatting Utilities
 */

/**
 * Format currency value
 */
export function formatCurrency(
  value: number,
  currency: string = 'UGX',
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return `${currency} 0`;
  }
  
  const formatter = new Intl.NumberFormat('en-UG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    ...options,
  });
  
  return `${currency} ${formatter.format(value)}`;
}

// Firestore Timestamp type
interface FirestoreTimestamp {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
}

/**
 * Format date
 */
export function formatDate(
  date: Date | string | number | FirestoreTimestamp | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  
  try {
    let d: Date;
    
    // Handle Firestore Timestamp
    if (typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate();
    } else if (date instanceof Date) {
      d = date;
    } else {
      d = new Date(date as string | number);
    }
    
    if (isNaN(d.getTime())) return '-';
    
    return d.toLocaleDateString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options,
    });
  } catch {
    return '-';
  }
}

/**
 * Format date and time
 */
export function formatDateTime(
  date: Date | string | number | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '-';
  
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    return d.toLocaleString('en-UG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...options,
    });
  } catch {
    return '-';
  }
}

/**
 * Format percentage
 */
export function formatPercent(
  value: number,
  decimals: number = 1
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with thousands separator
 */
export function formatNumber(
  value: number,
  decimals: number = 0
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }
  
  return new Intl.NumberFormat('en-UG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format currency in compact form (K, M, B)
 */
export function formatCurrencyCompact(
  amount: number,
  currency: string = 'UGX'
): string {
  if (amount >= 1e9) {
    return `${currency} ${(amount / 1e9).toFixed(1)}B`;
  }
  if (amount >= 1e6) {
    return `${currency} ${(amount / 1e6).toFixed(1)}M`;
  }
  if (amount >= 1e3) {
    return `${currency} ${(amount / 1e3).toFixed(0)}K`;
  }
  return formatCurrency(amount, currency);
}

/**
 * Format percentage (alias for formatPercent)
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return formatPercent(value, decimals);
}

/**
 * Format quantity with unit
 */
export function formatQuantity(quantity: number, unit: string): string {
  return `${formatNumber(quantity)} ${unit}`;
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(
  text: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return formatDate(d);
}
