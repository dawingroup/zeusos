import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full px-2.5 py-2 text-[13px] leading-relaxed',
          'rounded-[7px] border border-[var(--border-default)]',
          'bg-[var(--input-background)] text-[var(--fg-primary)]',
          'placeholder:text-[var(--fg-quaternary)]',
          'transition-[border-color,box-shadow] duration-150 resize-y',
          'focus:outline-none focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[var(--bg-sunken)]',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
