import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/utils';

const toggleGroupVariants = cva(
  'inline-flex items-center rounded-md',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: 'border border-input',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const toggleGroupItemVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-transparent hover:bg-muted hover:text-muted-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
        outline:
          'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-accent data-[state=on]:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-3',
        sm: 'h-9 px-2.5',
        lg: 'h-11 px-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

interface ToggleGroupContextValue {
  value: string | string[];
  onValueChange: (value: string) => void;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  type: 'single' | 'multiple';
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  value: '',
  onValueChange: () => {},
  type: 'single',
});

export interface ToggleGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toggleGroupVariants> {
  type?: 'single' | 'multiple';
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  size?: 'default' | 'sm' | 'lg';
}

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  ({ className, variant, type = 'single', value, onValueChange, size, children, ...props }, ref) => {
    const handleValueChange = React.useCallback(
      (itemValue: string) => {
        if (type === 'single') {
          onValueChange?.(itemValue);
        } else if (Array.isArray(value)) {
          const newValue = value.includes(itemValue)
            ? value.filter((v) => v !== itemValue)
            : [...value, itemValue];
          onValueChange?.(newValue);
        }
      },
      [type, value, onValueChange]
    );

    return (
      <ToggleGroupContext.Provider value={{ value: value ?? '', onValueChange: handleValueChange, variant: variant ?? 'default', size: size ?? 'default', type }}>
        <div
          ref={ref}
          className={cn(toggleGroupVariants({ variant }), 'gap-1', className)}
          role="group"
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    );
  }
);
ToggleGroup.displayName = 'ToggleGroup';

export interface ToggleGroupItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof toggleGroupItemVariants> {
  value: string;
}

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value, variant, size, children, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext);
    const isActive =
      context.type === 'single'
        ? context.value === value
        : Array.isArray(context.value) && context.value.includes(value);

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isActive}
        data-state={isActive ? 'on' : 'off'}
        className={cn(
          toggleGroupItemVariants({
            variant: variant ?? context.variant,
            size: size ?? context.size,
          }),
          className
        )}
        onClick={() => context.onValueChange(value)}
        {...props}
      >
        {children}
      </button>
    );
  }
);
ToggleGroupItem.displayName = 'ToggleGroupItem';

export { ToggleGroup, ToggleGroupItem, toggleGroupItemVariants };
