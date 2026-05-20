/**
 * Generate Monthly Run Dialog
 *
 * Fans out a month's payroll to one PayrollBatch per active subsidiary.
 * Shown from the Payroll Batches page. Pick a period + payment date,
 * preview which subsidiaries will be included, and submit — the
 * service atomically creates the parent run + N child sub-batches.
 */

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Building2, CalendarDays, Loader2 } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';

import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Badge } from '@/core/components/ui/badge';

import { useMonthlyPayrollRuns } from '../hooks/useMonthlyPayrollRuns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SubsidiaryPreview {
  id: string;
  name: string;
}

export function GenerateMonthlyRunDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { generate } = useMonthlyPayrollRuns();

  const today = new Date();
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const defaultPayDate = format(new Date(today.getFullYear(), today.getMonth() + 1, 0), 'yyyy-MM-dd');

  const [periodInput, setPeriodInput] = useState(defaultMonth);
  const [payDate, setPayDate] = useState(defaultPayDate);
  const [subsidiaries, setSubsidiaries] = useState<SubsidiaryPreview[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [year, month] = useMemo(() => {
    const [y, m] = periodInput.split('-').map(Number);
    return [y, m];
  }, [periodInput]);

  // Load active subsidiaries when the dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingPreview(true);
    setError(null);
    (async () => {
      try {
        const snap = await getDocs(query(
          collection(db, 'subsidiaries'),
          where('status', '==', 'active'),
        ));
        let subs: SubsidiaryPreview[] = snap.docs.map(d => {
          const data = d.data() as { name?: string };
          return { id: d.id, name: data.name || d.id };
        });

        if (subs.length === 0) {
          const { DEFAULT_SUBSIDIARIES } = await import('@/types/subsidiary');
          subs = DEFAULT_SUBSIDIARIES
            .filter(s => s.status === 'active')
            .map(s => ({ id: s.id, name: s.name }));
        }
        if (!cancelled) setSubsidiaries(subs);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load subsidiaries');
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const handleGenerate = async () => {
    setError(null);
    if (!year || !month) {
      setError('Pick a valid month');
      return;
    }
    if (subsidiaries.length === 0) {
      setError('No active subsidiaries to fan out to');
      return;
    }
    setSubmitting(true);
    try {
      const run = await generate({
        year,
        month,
        paymentDate: new Date(payDate),
      });
      onOpenChange(false);
      navigate(`/hr/payroll/monthly-runs/${run.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate monthly run');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate monthly payroll run</DialogTitle>
          <DialogDescription>
            Creates one sub-batch per active subsidiary for the chosen month.
            Each sub-batch can be calculated, reviewed, and paid independently —
            and bulk actions on the run apply them all at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" /> Period
              </label>
              <Input
                type="month"
                value={periodInput}
                onChange={(e) => setPeriodInput(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Payment date</label>
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              Sub-batches to create
              <Badge variant="secondary" className="ml-1">{subsidiaries.length}</Badge>
            </label>
            <div className="mt-2 border rounded-md p-2 bg-muted/30 min-h-[60px]">
              {loadingPreview ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading subsidiaries…
                </div>
              ) : subsidiaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active subsidiaries.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {subsidiaries.map(s => (
                    <Badge key={s.id} variant="outline" className="font-mono text-xs">
                      {s.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={submitting || loadingPreview || subsidiaries.length === 0}
          >
            {submitting
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              : `Generate ${subsidiaries.length} sub-batch${subsidiaries.length === 1 ? '' : 'es'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default GenerateMonthlyRunDialog;
