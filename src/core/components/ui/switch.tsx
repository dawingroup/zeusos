import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Toggle switch — 34×20 track, 16×16 thumb. Slides on accent when checked.
 * Built on a native checkbox to inherit accessibility without a radix dep.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    { className, checked, defaultChecked, onCheckedChange, onChange, disabled, ...props },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = React.useState(
      defaultChecked ?? false
    );
    const isControlled = checked !== undefined;
    const value = isControlled ? checked : internalChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) setInternalChecked(e.target.checked);
      onChange?.(e);
      onCheckedChange?.(e.target.checked);
    };

    return (
      <label
        className={cn(
          'relative inline-flex items-center w-[34px] h-5 shrink-0 cursor-pointer',
          'rounded-full transition-colors duration-150',
          'focus-within:ring-[3px] focus-within:ring-[var(--accent-soft)]',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        style={{
          backgroundColor: value ? 'var(--accent)' : 'var(--switch-background)',
        }}
      >
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          aria-checked={value}
          checked={value}
          disabled={disabled}
          onChange={handleChange}
          className="sr-only"
          {...props}
        />
        <span
          className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-card shadow-[0_1px_2px_rgba(20,20,22,0.18)] transition-transform duration-150"
          style={{ transform: value ? 'translateX(14px)' : 'translateX(0)' }}
          aria-hidden="true"
        />
      </label>
    );
  }
);
Switch.displayName = 'Switch';

export { Switch };
