import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
    'rounded-[7px] text-[13px] font-medium leading-none',
    'transition-colors disabled:pointer-events-none disabled:opacity-50',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-soft)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--bg-surface)]',
  ].join(' '),
  {
    variants: {
      variant: {
        default:
          'bg-[var(--fg-primary)] text-white hover:bg-[var(--teal-light)]',
        primary:
          'bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90',
        destructive:
          'bg-[var(--rag-red)] text-white hover:opacity-90',
        outline:
          'border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--fg-primary)] hover:bg-[var(--bg-sunken)]',
        secondary:
          'bg-[var(--bg-sunken)] text-[var(--fg-primary)] hover:bg-[var(--border-default)]',
        ghost:
          'bg-transparent text-[var(--fg-primary)] hover:bg-[var(--bg-sunken)]',
        link:
          'bg-transparent text-[var(--accent)] underline-offset-4 hover:underline px-0',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-[12px]',
        lg: 'h-10 px-4 text-[13.5px]',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
