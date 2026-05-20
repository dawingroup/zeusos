import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Native checkbox skinned to the design system. We rely on `accent-color`
 * for the checked fill so the indicator stays in lock-step with the active
 * --accent CSS variable (boysenberry by default, but it can be tweaked).
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, style, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <input
        type="checkbox"
        className={cn(
          'h-4 w-4 shrink-0 rounded-[4px] cursor-pointer',
          'border-[1.5px] border-[var(--border-strong)]',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{ accentColor: 'var(--accent)', ...style }}
        ref={ref}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
