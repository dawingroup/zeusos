/**
 * FormSelect Component
 * Reusable select dropdown with label and error handling
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Label } from '@/core/components/ui/label';
import { cn } from '@/shared/lib/utils';

interface Option {
  value: string;
  label: string;
}

interface FormSelectProps {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormSelect({
  name,
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  description,
  error,
  required = false,
  disabled = false,
  className,
}: FormSelectProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn(error && 'border-destructive')}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
