import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--fg-primary)] text-white',
        muted:
          'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
        secondary:
          'bg-[var(--bg-sunken)] text-[var(--fg-primary)]',
        accent:
          'bg-[var(--accent-soft)] text-[var(--accent)]',
        outline:
          'border border-[var(--border-default)] text-[var(--fg-secondary)] bg-transparent',
        destructive:
          'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
        success:
          'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
        warning:
          'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
        info:
          'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
      },
    },
    defaultVariants: {
      variant: 'muted',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
