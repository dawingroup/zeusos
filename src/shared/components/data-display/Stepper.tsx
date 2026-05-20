import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface StepperStep {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
}

export interface StepperProps {
  steps: StepperStep[];
  /** 0-based index of the active step. */
  current: number;
  /** Optional click handler — when provided, completed steps become navigable. */
  onStepClick?: (index: number) => void;
  className?: string;
}

/**
 * Horizontal stepper — used in multi-stage flows like quote, PO, sales-order
 * drawers. Completed steps render a check; active is filled with --accent;
 * upcoming steps are muted.
 */
export function Stepper({ steps, current, onStepClick, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center gap-2 w-full', className)}>
      {steps.map((step, idx) => {
        const status: 'done' | 'current' | 'upcoming' =
          idx < current ? 'done' : idx === current ? 'current' : 'upcoming';
        const clickable = onStepClick && status === 'done';

        return (
          <React.Fragment key={step.id}>
            <li className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(idx)}
                className={cn(
                  'flex items-center gap-2 text-left transition-opacity',
                  clickable && 'hover:opacity-80',
                  !clickable && 'cursor-default'
                )}
                aria-current={status === 'current' ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0',
                    status === 'done' && 'text-white',
                    status === 'current' && 'text-[var(--accent-fg)]',
                    status === 'upcoming' && 'text-[var(--fg-tertiary)]'
                  )}
                  style={{
                    backgroundColor:
                      status === 'done'
                        ? 'var(--accent)'
                        : status === 'current'
                        ? 'var(--accent)'
                        : 'var(--bg-sunken)',
                    border:
                      status === 'upcoming'
                        ? '1px solid var(--border-default)'
                        : 'none',
                  }}
                >
                  {status === 'done' ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                <span className="flex flex-col min-w-0">
                  <span
                    className="text-[12.5px] font-medium leading-tight truncate"
                    style={{
                      color:
                        status === 'upcoming'
                          ? 'var(--fg-tertiary)'
                          : 'var(--fg-primary)',
                    }}
                  >
                    {step.label}
                  </span>
                  {step.description && (
                    <span
                      className="text-[11px] truncate"
                      style={{ color: 'var(--fg-tertiary)' }}
                    >
                      {step.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
            {idx < steps.length - 1 && (
              <span
                className="flex-1 h-px"
                style={{
                  backgroundColor:
                    idx < current ? 'var(--accent)' : 'var(--border-default)',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}
