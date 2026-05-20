/**
 * FormCurrency Component
 * Currency input with currency selector
 */

import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { cn } from '@/shared/lib/utils';

const CURRENCIES = [
  { value: 'UGX', label: 'UGX', symbol: 'USh' },
  { value: 'USD', label: 'USD', symbol: '$' },
  { value: 'EUR', label: 'EUR', symbol: '€' },
  { value: 'KES', label: 'KES', symbol: 'KSh' },
  { value: 'GBP', label: 'GBP', symbol: '£' },
];

interface FormCurrencyProps {
  label: string;
  amount: number;
  currency: string;
  onAmountChange: (amount: number) => void;
  onCurrencyChange: (currency: string) => void;
  placeholder?: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormCurrency({
  label,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  placeholder = '0.00',
  description,
  error,
  required = false,
  disabled = false,
  className,
}: FormCurrencyProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      
      <div className="flex gap-2">
        <Select
          value={currency}
          onValueChange={onCurrencyChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((curr) => (
              <SelectItem key={curr.value} value={curr.value}>
                {curr.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Input
          type="number"
          step="0.01"
          value={amount || ''}
          onChange={(e) => onAmountChange(parseFloat(e.target.value) || 0)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn('flex-1', error && 'border-destructive')}
        />
      </div>

      {description && !error && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
