import * as React from 'react';
import { cn } from '@/shared/lib/utils';

interface RadioGroupContextValue {
  name: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(null);

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  (
    { className, value, defaultValue, onValueChange, name, children, ...props },
    ref
  ) => {
    const [internal, setInternal] = React.useState(defaultValue ?? '');
    const isControlled = value !== undefined;
    const current = isControlled ? value : internal;

    const groupName = React.useMemo(
      () => name ?? `rg-${Math.random().toString(36).slice(2, 8)}`,
      [name]
    );

    const handleChange = (v: string) => {
      if (!isControlled) setInternal(v);
      onValueChange?.(v);
    };

    return (
      <RadioGroupContext.Provider
        value={{ name: groupName, value: current, onValueChange: handleChange }}
      >
        <div
          ref={ref}
          role="radiogroup"
          className={cn('flex flex-col gap-2', className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

export interface RadioGroupItemProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
}

const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, style, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    if (!ctx) throw new Error('RadioGroupItem must be used inside RadioGroup');
    const checked = ctx.value === value;
    return (
      <input
        ref={ref}
        type="radio"
        name={ctx.name}
        value={value}
        checked={checked}
        onChange={() => ctx.onValueChange?.(value)}
        className={cn(
          'h-4 w-4 shrink-0 cursor-pointer',
          'border-[1.5px] border-[var(--border-strong)] rounded-full',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{ accentColor: 'var(--accent)', ...style }}
        {...props}
      />
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';

export { RadioGroup, RadioGroupItem };
