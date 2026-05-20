import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-[34px] w-full px-2.5 py-1.5 text-[13px] leading-tight',
          'rounded-[7px] border border-[var(--border-default)]',
          'bg-[var(--input-background)] text-[var(--fg-primary)]',
          'placeholder:text-[var(--fg-quaternary)]',
          'file:border-0 file:bg-transparent file:text-[12.5px] file:font-medium file:text-[var(--fg-primary)]',
          'transition-[border-color,box-shadow] duration-150',
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
Input.displayName = 'Input';

export { Input };
