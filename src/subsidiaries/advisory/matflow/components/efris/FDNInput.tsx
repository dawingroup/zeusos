/**
 * FDN Input Component
 * Fiscal Document Number input with validation
 */

import React from 'react';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Button } from '@/core/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Search } from 'lucide-react';
import { useFDNInput } from '../../hooks/useEFRIS';
import { cn } from '@/shared/lib/utils';

interface FDNInputProps {
  onValidate?: (fdn: string) => void;
  disabled?: boolean;
  isValidating?: boolean;
  className?: string;
}

export function FDNInput({
  onValidate,
  disabled,
  isValidating,
  className,
}: FDNInputProps) {
  const { fdn, setFDN, isValid, parsed } = useFDNInput();
  
  const handleValidate = () => {
    if (isValid && onValidate) {
      onValidate(fdn);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleValidate();
    }
  };
  
  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="fdn">Fiscal Document Number (FDN)</Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            id="fdn"
            value={fdn}
            onChange={(e) => setFDN(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="XXXXXXXX-00000000-XXXX"
            disabled={disabled || isValidating}
            className={cn(
              'pr-10 font-mono',
              fdn && (isValid ? 'border-green-500' : 'border-red-500')
            )}
            maxLength={22}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {fdn && (
              isValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )
            )}
          </div>
        </div>
        <Button
          onClick={handleValidate}
          disabled={!isValid || disabled || isValidating}
        >
          {isValidating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Validate
            </>
          )}
        </Button>
      </div>
      
      {parsed && (
        <div className="text-xs text-muted-foreground">
          <span>Device: {parsed.deviceNumber}</span>
          <span className="mx-2">•</span>
          <span>Doc: {parsed.fiscalDocNumber}</span>
          <span className="mx-2">•</span>
          <span>Code: {parsed.verificationCode}</span>
        </div>
      )}
      
      {fdn && !isValid && (
        <p className="text-xs text-red-500">
          Invalid format. Expected: XXXXXXXX-00000000-XXXX
        </p>
      )}
    </div>
  );
}

export default FDNInput;
