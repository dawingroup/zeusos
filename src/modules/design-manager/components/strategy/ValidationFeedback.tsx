/**
 * ValidationFeedback Components
 * Reusable validation UI components for strategy canvas forms
 */

import { Check, AlertCircle, Info, HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ValidationResult } from '../../types/strategy';

// ============================================
// Validated Input Component
// ============================================

interface ValidatedInputProps {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  error?: string | null;
  isValid?: boolean;
  isValidating?: boolean;
  required?: boolean;
  helpText?: string;
  type?: 'text' | 'number' | 'email' | 'tel';
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function ValidatedInput({
  label,
  value,
  onChange,
  error,
  isValid = false,
  isValidating = false,
  required = false,
  helpText,
  type = 'text',
  placeholder,
  className,
  inputClassName,
}: ValidatedInputProps) {
  const hasError = !!error;
  const showSuccess = !hasError && isValid && value !== '';

  return (
    <div className={cn('space-y-1', className)}>
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500">*</span>}
        {helpText && (
          <HelpTooltip content={helpText} />
        )}
      </label>

      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full px-3 py-2 border rounded-md transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            hasError && 'border-red-500 focus:ring-red-500',
            showSuccess && 'border-green-500 focus:ring-green-500',
            !hasError && !showSuccess && 'border-gray-300 focus:ring-blue-500',
            inputClassName
          )}
        />

        {/* Status indicator */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isValidating && (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          )}
          {!isValidating && showSuccess && (
            <Check className="w-4 h-4 text-green-600" />
          )}
          {!isValidating && hasError && (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
        </div>
      </div>

      {/* Error message */}
      {hasError && (
        <p className="text-sm text-red-600 flex items-start gap-1">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Success message */}
      {showSuccess && !hasError && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" />
          <span>Looks good</span>
        </p>
      )}
    </div>
  );
}

// ============================================
// Validated Textarea Component
// ============================================

interface ValidatedTextareaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  isValid?: boolean;
  required?: boolean;
  helpText?: string;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  showCharCount?: boolean;
  className?: string;
}

export function ValidatedTextarea({
  label,
  value,
  onChange,
  error,
  isValid = false,
  required = false,
  helpText,
  placeholder,
  rows = 4,
  maxLength,
  showCharCount = false,
  className,
}: ValidatedTextareaProps) {
  const hasError = !!error;
  const showSuccess = !hasError && isValid && value.length > 0;
  const charCount = value.length;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500">*</span>}
          {helpText && <HelpTooltip content={helpText} />}
        </label>

        {showCharCount && (
          <span className={cn(
            'text-xs',
            maxLength && charCount > maxLength ? 'text-red-600' : 'text-gray-500'
          )}>
            {charCount}{maxLength ? ` / ${maxLength}` : ''}
          </span>
        )}
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={cn(
          'w-full px-3 py-2 border rounded-md transition-colors resize-y',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          hasError && 'border-red-500 focus:ring-red-500',
          showSuccess && 'border-green-500 focus:ring-green-500',
          !hasError && !showSuccess && 'border-gray-300 focus:ring-blue-500'
        )}
      />

      {/* Error message */}
      {hasError && (
        <p className="text-sm text-red-600 flex items-start gap-1">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {/* Success message */}
      {showSuccess && !hasError && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" />
          <span>Looks good</span>
        </p>
      )}
    </div>
  );
}

// ============================================
// Section Completeness Badge
// ============================================

interface SectionCompletenessBadgeProps {
  completed: number;
  total: number;
  className?: string;
}

export function SectionCompletenessBadge({
  completed,
  total,
  className,
}: SectionCompletenessBadgeProps) {
  const isComplete = completed === total;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)}>
      {isComplete ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-600" />
          <span className="text-green-600">Complete</span>
        </>
      ) : (
        <>
          <span className="text-gray-600">{completed}/{total}</span>
          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// Validation Summary Component
// ============================================

interface ValidationSummaryProps {
  validationResult: ValidationResult;
  onDismiss?: () => void;
  className?: string;
}

export function ValidationSummary({
  validationResult,
  onDismiss,
  className,
}: ValidationSummaryProps) {
  const { isValid, errors, warnings } = validationResult;

  const errorCount = Object.values(errors).flat().length;
  const warningCount = warnings ? Object.values(warnings).flat().length : 0;

  if (isValid && warningCount === 0) {
    return (
      <div className={cn(
        'p-4 bg-green-50 border border-green-200 rounded-md',
        className
      )}>
        <div className="flex items-start gap-3">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-green-800">
              All required fields are complete
            </p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-green-600 hover:text-green-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Errors */}
      {errorCount > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-red-800">
                {errorCount} {errorCount === 1 ? 'error' : 'errors'} found
              </p>
              <ul className="space-y-1 text-sm text-red-700">
                {Object.entries(errors).map(([field, fieldErrors]) =>
                  fieldErrors.map((error, idx) => (
                    <li key={`${field}-${idx}`} className="flex items-start gap-2">
                      <span className="text-red-400">•</span>
                      <span><strong>{field}:</strong> {error}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warningCount > 0 && warnings && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-yellow-800">
                {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
              </p>
              <ul className="space-y-1 text-sm text-yellow-700">
                {Object.entries(warnings).map(([field, fieldWarnings]) =>
                  fieldWarnings.map((warning, idx) => (
                    <li key={`${field}-${idx}`} className="flex items-start gap-2">
                      <span className="text-yellow-400">•</span>
                      <span>{warning}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Help Tooltip Component
// ============================================

interface HelpTooltipProps {
  content: string;
  className?: string;
}

export function HelpTooltip({ content, className }: HelpTooltipProps) {
  return (
    <div className={cn('group relative inline-block', className)}>
      <HelpCircle className="w-4 h-4 text-gray-400 cursor-help" />
      <div className="invisible group-hover:visible absolute z-10 w-64 p-2 mt-1 text-xs text-white bg-gray-900 rounded-md shadow-lg left-1/2 -translate-x-1/2">
        {content}
        <div className="absolute w-2 h-2 bg-gray-900 transform rotate-45 -top-1 left-1/2 -translate-x-1/2" />
      </div>
    </div>
  );
}

// ============================================
// Required Field Indicator
// ============================================

export function RequiredFieldIndicator() {
  return (
    <span className="text-red-500 text-sm font-medium" title="Required field">
      *
    </span>
  );
}

// ============================================
// Info Banner Component
// ============================================

interface InfoBannerProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  onDismiss?: () => void;
  className?: string;
}

export function InfoBanner({
  message,
  type = 'info',
  onDismiss,
  className,
}: InfoBannerProps) {
  const styles = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: <Info className="w-5 h-5 text-blue-600" />,
      text: 'text-blue-800',
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: <Check className="w-5 h-5 text-green-600" />,
      text: 'text-green-800',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
      text: 'text-yellow-800',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <AlertCircle className="w-5 h-5 text-red-600" />,
      text: 'text-red-800',
    },
  };

  const style = styles[type];

  return (
    <div className={cn(
      'p-4 rounded-md border flex items-start gap-3',
      style.bg,
      style.border,
      className
    )}>
      {style.icon}
      <p className={cn('flex-1 text-sm', style.text)}>
        {message}
      </p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={cn('hover:opacity-70', style.text)}
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ============================================
// Progress Indicator Component
// ============================================

interface ProgressIndicatorProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export function ProgressIndicator({
  current,
  total,
  label,
  className,
}: ProgressIndicatorProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">{label}</span>
          <span className="text-gray-600">{current}/{total}</span>
        </div>
      )}
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-gray-600 text-right">{percentage}% complete</p>
    </div>
  );
}
