/**
 * Invoice Validation Card Component
 * Displays EFRIS invoice validation details
 */

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import {
  RefreshCw,
  Building2,
  Calendar,
  Receipt,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { InvoiceValidationRecord, InvoiceMatchResult } from '../../types/efris';
import { EFRISValidationBadge } from './EFRISValidationBadge';
import { cn } from '@/shared/lib/utils';
import { format } from 'date-fns';

interface InvoiceValidationCardProps {
  validation: InvoiceValidationRecord;
  matchResult?: InvoiceMatchResult;
  onRevalidate?: () => void;
  isRevalidating?: boolean;
  className?: string;
}

// Helper functions
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string, formatStr: string = 'PP'): string {
  try {
    return format(new Date(dateString), formatStr);
  } catch {
    return dateString;
  }
}

export function InvoiceValidationCard({
  validation,
  matchResult,
  onRevalidate,
  isRevalidating,
  className,
}: InvoiceValidationCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg font-mono">{validation.fdn}</CardTitle>
            <CardDescription>
              {validation.invoiceNumber && `Invoice: ${validation.invoiceNumber}`}
            </CardDescription>
          </div>
          <EFRISValidationBadge status={validation.validationStatus} />
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Supplier Info */}
        <div className="flex items-start gap-3">
          <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="font-medium">{validation.supplierName}</p>
            {validation.supplierTin && (
              <p className="text-sm text-muted-foreground">TIN: {validation.supplierTin}</p>
            )}
          </div>
        </div>
        
        {/* Invoice Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>{validation.invoiceDate ? formatDate(validation.invoiceDate) : 'N/A'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span>{formatCurrency(validation.totalAmount, validation.currency)}</span>
          </div>
        </div>
        
        {/* VAT Info */}
        {validation.vatAmount > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(validation.subtotal, validation.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT (18%)</span>
              <span>{formatCurrency(validation.vatAmount, validation.currency)}</span>
            </div>
            <div className="border-t my-2" />
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>{formatCurrency(validation.totalAmount, validation.currency)}</span>
            </div>
          </div>
        )}
        
        {/* Match Results */}
        {matchResult && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Match Analysis</p>
            <div className="grid gap-2">
              <MatchIndicator
                label="Amount"
                matches={matchResult.amountMatch.matches}
                detail={matchResult.amountMatch.matches 
                  ? 'Amounts match within tolerance'
                  : `Variance: ${matchResult.amountMatch.variancePercent.toFixed(1)}%` 
                }
              />
              <MatchIndicator
                label="Supplier"
                matches={matchResult.supplierMatch.matches}
                detail={matchResult.supplierMatch.matches
                  ? 'Supplier verified'
                  : 'Supplier name mismatch'
                }
              />
              <MatchIndicator
                label="Items"
                matches={matchResult.itemMatches.every(i => i.matchStatus === 'matched')}
                detail={`${matchResult.itemMatches.filter(i => i.matchStatus === 'matched').length}/${matchResult.itemMatches.length} items matched`}
              />
            </div>
          </div>
        )}
        
        {/* Warnings */}
        {matchResult?.warnings && matchResult.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                {matchResult.warnings.map((warning, idx) => (
                  <p key={idx}>{warning}</p>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Validation Error */}
        {validation.validationError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-600 mt-0.5" />
              <p className="text-sm text-red-800">{validation.validationError}</p>
            </div>
          </div>
        )}
        
        {/* Actions */}
        {onRevalidate && (
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRevalidate}
              disabled={isRevalidating}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', isRevalidating && 'animate-spin')} />
              Revalidate
            </Button>
          </div>
        )}
        
        {/* Timestamps */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          {validation.validatedAt && (
            <p>Validated: {formatDate(validation.validatedAt, 'PPp')}</p>
          )}
          {validation.lastValidationAttempt && validation.lastValidationAttempt !== validation.validatedAt && (
            <p>Last attempt: {formatDate(validation.lastValidationAttempt, 'PPp')}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Helper component for match indicators
function MatchIndicator({
  label,
  matches,
  detail,
}: {
  label: string;
  matches: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        {matches ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        )}
        <span>{label}</span>
      </div>
      <span className={cn(
        'text-xs',
        matches ? 'text-green-600' : 'text-red-600'
      )}>
        {detail}
      </span>
    </div>
  );
}

export default InvoiceValidationCard;
