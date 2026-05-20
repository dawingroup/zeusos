/**
 * Create Quote Dialog
 * Dialog for creating a new client quote from project estimate
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { useAuth } from '@/shared/hooks';
import { Loader2, Plus, Trash2, Lock, Unlock } from 'lucide-react';
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
import { createClientQuote } from '../../services/clientPortalService';
import type { ConsolidatedEstimate } from '../../types/estimate';
import type { DesignProject } from '../../types';

interface CreateQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  onQuoteCreated: () => void;
  /** When provided, creates a quote from this alternative estimate instead of the standard one */
  alternativeEstimate?: ConsolidatedEstimate;
  /** Label for the quality tier (e.g., "Economy", "Premium") — shown in dialog title */
  tierLabel?: string;
}

export default function CreateQuoteDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  customerId,
  customerName,
  customerEmail,
  onQuoteCreated,
  alternativeEstimate,
  tierLabel,
}: CreateQuoteDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingEstimate, setLoadingEstimate] = useState(true);
  const [estimate, setEstimate] = useState<ConsolidatedEstimate | null>(null);
  const [project, setProject] = useState<DesignProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [quoteDate, setQuoteDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [internalNotes, setInternalNotes] = useState('');

  // Milestone payment state (up to 4 milestones)
  interface MilestoneEntry {
    label: string;
    percentage: string;
    locked: boolean; // locked = user manually entered, unlocked = auto-calculated
  }
  const [milestones, setMilestones] = useState<MilestoneEntry[]>([
    { label: 'Deposit', percentage: '50', locked: true },
    { label: 'Final Payment', percentage: '50', locked: false },
  ]);

  // Recalculate unlocked milestone percentages
  const recalcMilestones = useCallback((updated: MilestoneEntry[]): MilestoneEntry[] => {
    const lockedSum = updated.reduce(
      (sum, m) => (m.locked ? sum + (parseFloat(m.percentage) || 0) : sum),
      0
    );
    const unlocked = updated.filter((m) => !m.locked);
    const remaining = Math.max(0, 100 - lockedSum);

    if (unlocked.length === 0) return updated;

    const each = Math.floor((remaining / unlocked.length) * 100) / 100;
    let distributed = 0;

    return updated.map((m) => {
      if (m.locked) return m;
      // Last unlocked milestone gets the remainder to ensure exactly 100%
      const isLastUnlocked = unlocked.indexOf(m) === unlocked.length - 1;
      const value = isLastUnlocked
        ? Math.round((remaining - distributed) * 100) / 100
        : each;
      distributed += each;
      return { ...m, percentage: String(Math.max(0, value)) };
    });
  }, []);

  const handleMilestonePercentageChange = (index: number, value: string) => {
    setMilestones((prev) => {
      const updated = prev.map((m, i) =>
        i === index ? { ...m, percentage: value, locked: true } : m
      );
      return recalcMilestones(updated);
    });
  };

  const handleMilestoneLabelChange = (index: number, label: string) => {
    setMilestones((prev) => prev.map((m, i) => (i === index ? { ...m, label } : m)));
  };

  const toggleMilestoneLock = (index: number) => {
    setMilestones((prev) => {
      const updated = prev.map((m, i) =>
        i === index ? { ...m, locked: !m.locked } : m
      );
      return recalcMilestones(updated);
    });
  };

  const addMilestone = () => {
    if (milestones.length >= 4) return;
    setMilestones((prev) => {
      // Insert new milestone before the last one
      const newMilestone: MilestoneEntry = {
        label: `Payment ${prev.length}`,
        percentage: '0',
        locked: false,
      };
      // Make the last milestone unlocked so it recalculates
      const updated = [
        ...prev.slice(0, -1),
        newMilestone,
        { ...prev[prev.length - 1], locked: false },
      ];
      return recalcMilestones(updated);
    });
  };

  const removeMilestone = (index: number) => {
    if (milestones.length <= 2) return;
    // Don't allow removing first or last
    if (index === 0 || index === milestones.length - 1) return;
    setMilestones((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      return recalcMilestones(updated);
    });
  };

  const milestoneTotal = milestones.reduce((sum, m) => sum + (parseFloat(m.percentage) || 0), 0);
  const milestonesValid = Math.abs(milestoneTotal - 100) < 0.01 && milestones.every((m) => parseFloat(m.percentage) > 0);

  // Load project and estimate data
  useEffect(() => {
    async function loadData() {
      if (!open || !projectId) return;

      setLoadingEstimate(true);
      setError(null);

      try {
        const projectRef = doc(db, 'designProjects', projectId);
        const projectSnap = await getDoc(projectRef);

        if (!projectSnap.exists()) {
          setError('Project not found');
          return;
        }

        const projectData = {
          id: projectSnap.id,
          ...projectSnap.data(),
        } as DesignProject;

        setProject(projectData);

        // Get estimate — use alternative if provided, otherwise load standard
        if (alternativeEstimate) {
          setEstimate(alternativeEstimate);
          setTitle(`${tierLabel || 'Alternative'} Quote for ${projectName}`);
        } else {
          const data = projectSnap.data();
          if (data.consolidatedEstimate) {
            setEstimate(data.consolidatedEstimate as ConsolidatedEstimate);
            setTitle(`Quote for ${projectName}`);
          } else {
            setError('No estimate found. Please generate an estimate first.');
          }
        }
      } catch (err) {
        console.error('Failed to load project data:', err);
        setError('Failed to load project data');
      } finally {
        setLoadingEstimate(false);
      }
    }

    loadData();
  }, [open, projectId, projectName, alternativeEstimate, tierLabel]);

  const handleSubmit = async () => {
    if (!estimate || !project) return;

    setLoading(true);
    setError(null);

    try {
      const milestonePayments = milestones.map((m) => ({
        label: m.label,
        percentage: parseFloat(m.percentage) || 0,
      }));
      const depositPercent = milestonePayments[0]?.percentage ?? 50;
      const paymentTermsText = milestonePayments
        .map((m) => `${m.percentage}% ${m.label}`)
        .join(', ');

      await createClientQuote(
        {
          projectId,
          customerId,
          title,
          description: description || undefined,
          quoteDate,
          validityDays: parseInt(validityDays, 10),
          paymentTerms: paymentTermsText,
          depositRequired: depositPercent,
          depositType: 'percentage' as const,
          milestonePayments,
          internalNotes: internalNotes || undefined,
        },
        estimate,
        project,
        customerName,
        customerEmail,
        user?.uid || 'unknown'
      );

      onQuoteCreated();
    } catch (err) {
      console.error('Failed to create quote:', err);
      setError('Failed to create quote. Please try again.');
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
          <DialogTitle>{tierLabel ? `Create ${tierLabel} Quote` : 'Create Client Quote'}</DialogTitle>
          <DialogDescription>
            {tierLabel
              ? `Generate a ${tierLabel.toLowerCase()} tier quote from the alternative estimate for ${customerName}`
              : `Generate a quote from the project estimate for ${customerName}`}
          </DialogDescription>
        </DialogHeader>

        {loadingEstimate ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error && !estimate ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : estimate ? (
          <div className="space-y-4">
            {/* Estimate Summary */}
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Quote Total</span>
                <span className="text-lg font-bold">
                  {formatCurrency(estimate.total, estimate.currency)}
                </span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-muted-foreground">
                  {estimate.lineItems.length} line items
                </span>
                <span className="text-xs text-muted-foreground">
                  Tax: {formatCurrency(estimate.taxAmount, estimate.currency)}
                </span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
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
                  <Label htmlFor="validity">Valid For (Days)</Label>
                  <Select value={validityDays} onValueChange={setValidityDays}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="30">30 days</SelectItem>
                      <SelectItem value="60">60 days</SelectItem>
                      <SelectItem value="90">90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Milestone Payments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Payment Milestones</Label>
                  {milestones.length < 4 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addMilestone}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Milestone
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {milestones.map((milestone, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={milestone.label}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          handleMilestoneLabelChange(index, e.target.value)
                        }
                        placeholder="Payment label"
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          value={milestone.percentage}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleMilestonePercentageChange(index, e.target.value)
                          }
                          className="w-20 text-right"
                          min="0"
                          max="100"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleMilestoneLock(index)}
                        title={milestone.locked ? 'Unlock (auto-calculate)' : 'Lock (manual)'}
                      >
                        {milestone.locked ? (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <Unlock className="h-3 w-3 text-muted-foreground" />
                        )}
                      </Button>
                      {index > 0 && index < milestones.length - 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeMilestone(index)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                      {(index === 0 || index === milestones.length - 1) &&
                        milestones.length > 2 && <div className="w-8" />}
                    </div>
                  ))}
                </div>
                {/* Total indicator */}
                <div className={`flex justify-end mt-1 text-xs ${milestonesValid ? 'text-muted-foreground' : 'text-destructive'}`}>
                  Total: {milestoneTotal.toFixed(0)}%{' '}
                  {!milestonesValid && '(must equal 100%)'}
                </div>
                {estimate && (
                  <div className="mt-2 p-2 bg-muted/30 rounded text-xs text-muted-foreground space-y-0.5">
                    {milestones.map((m, i) => {
                      const pct = parseFloat(m.percentage) || 0;
                      const amt = Math.round(estimate.total * (pct / 100));
                      return (
                        <div key={i} className="flex justify-between">
                          <span>{m.label} ({pct}%)</span>
                          <span>{formatCurrency(amt, estimate.currency)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
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
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !estimate || !milestonesValid}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Quote'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
