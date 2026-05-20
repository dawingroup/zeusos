/**
 * Design Manager Error Logger
 * Centralized error tracking and logging for the design manager module
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

// ============================================
// Error Categories & Severity
// ============================================

export enum ErrorCategory {
  FIREBASE = 'FIREBASE',
  INVENTORY_API = 'INVENTORY_API',
  NOTION_API = 'NOTION_API',
  AI_ANALYSIS = 'AI_ANALYSIS',
  VALIDATION = 'VALIDATION',
  UI_COMPONENT = 'UI_COMPONENT',
  NETWORK = 'NETWORK',
  AUTH = 'AUTH',
}

export enum ErrorSeverity {
  CRITICAL = 'CRITICAL',   // App crash, data loss
  ERROR = 'ERROR',         // Feature broken
  WARNING = 'WARNING',     // Degraded experience
  INFO = 'INFO',           // Logged for debugging
}

// ============================================
// Error Codes Reference
// ============================================

export const ERROR_CODES = {
  // Firebase errors
  FB_001: { message: 'Firestore connection failed', severity: ErrorSeverity.CRITICAL },
  FB_002: { message: 'Document not found', severity: ErrorSeverity.ERROR },
  FB_003: { message: 'Permission denied', severity: ErrorSeverity.ERROR },
  FB_004: { message: 'Query timeout', severity: ErrorSeverity.WARNING },
  FB_005: { message: 'Write operation failed', severity: ErrorSeverity.ERROR },
  
  // AI Analysis errors
  AI_001: { message: 'Claude API error', severity: ErrorSeverity.ERROR },
  AI_002: { message: 'Low confidence result', severity: ErrorSeverity.WARNING },
  AI_003: { message: 'Analysis timeout', severity: ErrorSeverity.ERROR },
  AI_004: { message: 'Invalid AI response format', severity: ErrorSeverity.ERROR },
  
  // Validation errors
  VAL_001: { message: 'Gate check failed', severity: ErrorSeverity.WARNING },
  VAL_002: { message: 'Invalid RAG status', severity: ErrorSeverity.ERROR },
  VAL_003: { message: 'Invalid stage transition', severity: ErrorSeverity.ERROR },
  VAL_004: { message: 'Required field missing', severity: ErrorSeverity.WARNING },
  
  // UI Component errors
  UI_001: { message: 'Component render failed', severity: ErrorSeverity.CRITICAL },
  UI_002: { message: 'State update error', severity: ErrorSeverity.ERROR },
  UI_003: { message: 'Event handler error', severity: ErrorSeverity.ERROR },
  
  // Network errors
  NET_001: { message: 'Request timeout', severity: ErrorSeverity.ERROR },
  NET_002: { message: 'Network unavailable', severity: ErrorSeverity.WARNING },
  
  // Auth errors
  AUTH_001: { message: 'Session expired', severity: ErrorSeverity.CRITICAL },
  AUTH_002: { message: 'Unauthorized action', severity: ErrorSeverity.ERROR },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// ============================================
// Error Log Interface
// ============================================

export interface ErrorLog {
  id: string;
  timestamp: Date;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  stack?: string;
  context: Record<string, unknown>;
  userId?: string;
  userEmail?: string;
  url?: string;
  resolved: boolean;
}

// ============================================
// Error Logger Class
// ============================================

class DesignManagerErrorLogger {
  private static instance: DesignManagerErrorLogger;
  private errorQueue: ErrorLog[] = [];
  private isInitialized = false;

  private constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (this.isInitialized) return;
    
    // Flush errors every 5 seconds
    setInterval(() => this.flush(), 5000);
    
    // Flush on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
      
      // Capture unhandled errors
      window.addEventListener('error', (event) => {
        this.log(
          'UI_001',
          ErrorCategory.UI_COMPONENT,
          ErrorSeverity.CRITICAL,
          `Unhandled error: ${event.message}`,
          { filename: event.filename, lineno: event.lineno, colno: event.colno },
          event.error
        );
      });
      
      // Capture unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        this.log(
          'UI_001',
          ErrorCategory.UI_COMPONENT,
          ErrorSeverity.CRITICAL,
          `Unhandled promise rejection: ${event.reason}`,
          { reason: String(event.reason) }
        );
      });
    }
    
    this.isInitialized = true;
  }

  static getInstance(): DesignManagerErrorLogger {
    if (!DesignManagerErrorLogger.instance) {
      DesignManagerErrorLogger.instance = new DesignManagerErrorLogger();
    }
    return DesignManagerErrorLogger.instance;
  }

  log(
    code: string,
    category: ErrorCategory,
    severity: ErrorSeverity,
    message: string,
    context: Record<string, unknown> = {},
    error?: Error
  ): void {
    const logEntry: ErrorLog = {
      id: this.generateId(),
      timestamp: new Date(),
      category,
      severity,
      code,
      message,
      stack: error?.stack,
      context: {
        ...context,
        errorName: error?.name,
        errorMessage: error?.message,
      },
      userId: this.getCurrentUserId(),
      userEmail: this.getCurrentUserEmail(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      resolved: false,
    };

    // Always log to console in development
    if (import.meta.env.DEV) {
      this.logToConsole(logEntry, error);
    }

    // Critical errors logged immediately
    if (severity === ErrorSeverity.CRITICAL) {
      this.persistError(logEntry);
    } else {
      this.errorQueue.push(logEntry);
    }
  }

  private logToConsole(logEntry: ErrorLog, error?: Error): void {
    const style = this.getConsoleStyle(logEntry.severity);
    
    console.group(`%c[${logEntry.severity}] ${logEntry.code}: ${logEntry.message}`, style);
    console.log('Category:', logEntry.category);
    console.log('Context:', logEntry.context);
    console.log('Timestamp:', logEntry.timestamp.toISOString());
    if (error) {
      console.error('Error:', error);
    }
    console.groupEnd();
  }

  private getConsoleStyle(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'color: white; background: #dc2626; padding: 2px 6px; border-radius: 3px; font-weight: bold;';
      case ErrorSeverity.ERROR:
        return 'color: white; background: #ea580c; padding: 2px 6px; border-radius: 3px; font-weight: bold;';
      case ErrorSeverity.WARNING:
        return 'color: black; background: #fbbf24; padding: 2px 6px; border-radius: 3px; font-weight: bold;';
      case ErrorSeverity.INFO:
        return 'color: white; background: #3b82f6; padding: 2px 6px; border-radius: 3px;';
      default:
        return '';
    }
  }

  private async flush(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      const promises = errors.map(error => 
        addDoc(collection(db, 'designManagerErrors'), {
          ...error,
          timestamp: serverTimestamp(),
        })
      );
      await Promise.all(promises);
    } catch (e) {
      // If we can't log to Firestore, log to console
      console.error('Failed to persist error logs:', e);
      errors.forEach(err => console.error('Unpersisted error:', err));
      // Re-add to queue for retry
      this.errorQueue.push(...errors);
    }
  }

  private async persistError(error: ErrorLog): Promise<void> {
    try {
      await addDoc(collection(db, 'designManagerErrors'), {
        ...error,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error('Failed to persist critical error:', e, error);
    }
  }

  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCurrentUserId(): string | undefined {
    // Try to get from localStorage or auth state
    try {
      const authState = localStorage.getItem('authUser');
      if (authState) {
        const parsed = JSON.parse(authState);
        return parsed?.uid;
      }
    } catch {
      // Ignore parse errors
    }
    return undefined;
  }

  private getCurrentUserEmail(): string | undefined {
    try {
      const authState = localStorage.getItem('authUser');
      if (authState) {
        const parsed = JSON.parse(authState);
        return parsed?.email;
      }
    } catch {
      // Ignore parse errors
    }
    return undefined;
  }

  // Get recent errors for debugging
  getRecentErrors(): ErrorLog[] {
    return [...this.errorQueue];
  }

  // Clear error queue (for testing)
  clearQueue(): void {
    this.errorQueue = [];
  }
}

// ============================================
// Singleton Export
// ============================================

export const errorLogger = DesignManagerErrorLogger.getInstance();

// ============================================
// Convenience Functions
// ============================================

export function logFirebaseError(
  code: ErrorCode,
  context: Record<string, unknown> = {},
  error?: Error
): void {
  const errorDef = ERROR_CODES[code];
  errorLogger.log(
    code,
    ErrorCategory.FIREBASE,
    errorDef?.severity || ErrorSeverity.ERROR,
    errorDef?.message || 'Unknown Firebase error',
    context,
    error
  );
}

export function logAIError(
  code: ErrorCode,
  context: Record<string, unknown> = {},
  error?: Error
): void {
  const errorDef = ERROR_CODES[code];
  errorLogger.log(
    code,
    ErrorCategory.AI_ANALYSIS,
    errorDef?.severity || ErrorSeverity.ERROR,
    errorDef?.message || 'Unknown AI error',
    context,
    error
  );
}

export function logValidationError(
  code: ErrorCode,
  context: Record<string, unknown> = {},
  error?: Error
): void {
  const errorDef = ERROR_CODES[code];
  errorLogger.log(
    code,
    ErrorCategory.VALIDATION,
    errorDef?.severity || ErrorSeverity.WARNING,
    errorDef?.message || 'Validation error',
    context,
    error
  );
}

export function logUIError(
  code: ErrorCode,
  context: Record<string, unknown> = {},
  error?: Error
): void {
  const errorDef = ERROR_CODES[code];
  errorLogger.log(
    code,
    ErrorCategory.UI_COMPONENT,
    errorDef?.severity || ErrorSeverity.ERROR,
    errorDef?.message || 'UI error',
    context,
    error
  );
}

export function logCritical(
  code: string,
  category: ErrorCategory,
  message: string,
  context: Record<string, unknown> = {},
  error?: Error
): void {
  errorLogger.log(code, category, ErrorSeverity.CRITICAL, message, context, error);
}

// ============================================
// Error Wrapper for Async Functions
// ============================================

export function withErrorLogging<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  category: ErrorCategory,
  context: Record<string, unknown> = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorLogger.log(
        'UNKNOWN',
        category,
        ErrorSeverity.ERROR,
        error instanceof Error ? error.message : 'Unknown error',
        { ...context, args },
        error instanceof Error ? error : undefined
      );
      throw error;
    }
  }) as T;
}
