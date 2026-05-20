/**
 * Edit Quote Dialog
 * Dialog for editing a draft client quote
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/shared/hooks';
import { Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { Timestamp } from 'firebase/firestore';
import { updateQuote } from '../../services/clientPortalService';
import type { ClientQuote } from '../../types/clientPortal';

interface EditQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: ClientQuote;
  onQuoteUpdated: () => void;
}

export default function EditQuoteDialog({
  open,
  onOpenChange,
  quote,
  onQuoteUpdated,
}: EditQuoteDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState(quote.title);
  const [description, setDescription] = useState(quote.description || '');
  const [paymentTerms, setPaymentTerms] = useState(quote.paymentTerms || '');
  const [depositRequired, setDepositRequired] = useState(
    quote.depositRequired?.toString() || ''
  );
  const [depositType, setDepositType] = useState<'percentage' | 'fixed'>(
    quote.depositType || 'percentage'
  );
  const [internalNotes, setInternalNotes] = useState(quote.internalNotes || '');
  const [quoteDate, setQuoteDate] = useState(
    quote.quoteDate
      ? new Date((quote.quoteDate as any).seconds * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );

  // Reset form when quote changes
  useEffect(() => {
    setTitle(quote.title);
    setDescription(quote.description || '');
    setPaymentTerms(quote.paymentTerms || '');
    setDepositRequired(quote.depositRequired?.toString() || '');
    setDepositType(quote.depositType || 'percentage');
    setInternalNotes(quote.internalNotes || '');
    setQuoteDate(
      quote.quoteDate
        ? new Date((quote.quoteDate as any).seconds * 1000).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
  }, [quote]);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      await updateQuote(
        quote.id,
        {
          title,
          description: description || undefined,
          quoteDate: Timestamp.fromDate(new Date(quoteDate)),
          paymentTerms: paymentTerms || undefined,
          depositRequired: depositRequired ? parseFloat(depositRequired) : undefined,
          depositType,
          internalNotes: internalNotes || undefined,
        },
        user?.uid || 'unknown'
      );

      onQuoteUpdated();
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to update quote:', err);
      setError('Failed to update quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'UGX') => {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Quote</DialogTitle>
          <DialogDescription>
            Update quote details for {quote.quoteNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quote Summary */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Quote Total</span>
              <span className="text-lg font-bold">
                {formatCurrency(quote.total, quote.currency)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-xs text-muted-foreground">
                {quote.lineItems.length} line items
              </span>
              <span className="text-xs text-muted-foreground">
                Version {quote.version}
              </span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="quoteDate">Quote Date</Label>
              <Input
                id="quoteDate"
                type="date"
                value={quoteDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuoteDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="title">Quote Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
                placeholder="Enter quote title"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                placeholder="Brief description of the work"
                className="mt-1"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deposit">Deposit Required</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="deposit"
                    type="number"
                    value={depositRequired}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDepositRequired(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={depositType} onValueChange={(v: 'percentage' | 'fixed') => setDepositType(v)}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">%</SelectItem>
                      <SelectItem value="fixed">{quote.currency}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Input
                id="paymentTerms"
                value={paymentTerms}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentTerms(e.target.value)}
                placeholder="e.g., 50% deposit, 50% on completion"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="internalNotes">Internal Notes (Not shown to client)</Label>
              <Textarea
                id="internalNotes"
                value={internalNotes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInternalNotes(e.target.value)}
                placeholder="Notes for internal reference only"
                className="mt-1"
                rows={2}
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
