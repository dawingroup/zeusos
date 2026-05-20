/**
 * FormField Component
 * Reusable form field with label, input, and error handling
 */

import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import { cn } from '@/shared/lib/utils';

interface FormFieldProps {
  name: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  description?: string;
  error?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'textarea';
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormField({
  name,
  label,
  value,
  onChange,
  placeholder,
  description,
  error,
  type = 'text',
  required = false,
  disabled = false,
  className,
}: FormFieldProps) {
  const inputId = `field-${name}`;

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      {type === 'textarea' ? (
        <Textarea
          id={inputId}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(error && 'border-destructive')}
        />
      ) : (
        <Input
          id={inputId}
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(error && 'border-destructive')}
        />
      )}

      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
