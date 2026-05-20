import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface FieldProps {
  /** Label rendered above the control. */
  label?: React.ReactNode;
  /** Optional helper text rendered below the control. */
  hint?: React.ReactNode;
  /** Error message — overrides `hint` and switches the field into error state. */
  error?: React.ReactNode;
  /** Adds an asterisk-style required marker next to the label. */
  required?: boolean;
  /** Maps to the control's `id` for label association. */
  htmlFor?: string;
  /** The actual form control. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Composable wrapper for any form control — pairs label + control + hint/error.
 * Designed to be used with the re-skinned `<Input>`, `<Textarea>`, `<Select>`,
 * `<Checkbox>`, `<Switch>`, etc.
 */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[11.5px] font-medium leading-snug"
          style={{ color: 'var(--fg-secondary)' }}
        >
          {label}
          {required && (
            <span
              className="ml-0.5"
              style={{ color: 'var(--rag-red)' }}
              aria-hidden="true"
            >
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <p
          className="text-[11.5px] leading-snug"
          style={{ color: 'var(--rag-red)' }}
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p
          className="text-[11.5px] leading-snug"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}
