/**
 * ObligationForm
 * Dialog for creating/editing compliance obligations (template picker or manual).
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  OBLIGATION_TEMPLATES,
  CATEGORY_LABELS,
  REGULATORY_BODY_LABELS,
  FREQUENCY_LABELS,
  OBLIGATION_PRIORITY_LABELS,
} from '../types/constants';
import type {
  ComplianceDocumentCategory,
  RegulatoryBody,
  RenewalFrequency,
  ObligationPriority,
  ComplianceObligationInput,
  ObligationTemplate,
} from '../types';

interface ObligationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: Partial<ComplianceObligationInput>) => Promise<unknown>;
}

export function ObligationForm({ open, onOpenChange, onSave }: ObligationFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ObligationTemplate | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ComplianceDocumentCategory>('tax');
  const [regulatoryBody, setRegulatoryBody] = useState<RegulatoryBody>('URA');
  const [frequency, setFrequency] = useState<RenewalFrequency>('monthly');
  const [dayOfMonthDue, setDayOfMonthDue] = useState('15');
  const [priority, setPriority] = useState<ObligationPriority>('high');
  const [autoCreateTasks, setAutoCreateTasks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTemplateSelect = (t: ObligationTemplate) => {
    setSelectedTemplate(t);
    setTitle(t.title);
    setDescription(t.description);
    setCategory(t.category);
    setRegulatoryBody(t.regulatoryBody);
    setFrequency(t.frequency);
    if (t.dayOfMonthDue) setDayOfMonthDue(String(t.dayOfMonthDue));
    setPriority(t.priority);
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setTitle('');
    setDescription('');
    setCategory('tax');
    setRegulatoryBody('URA');
    setFrequency('monthly');
    setDayOfMonthDue('15');
    setPriority('high');
    setAutoCreateTasks(true);
    setError(null);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: Partial<ComplianceObligationInput> = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        regulatoryBody,
        frequency,
        dayOfMonthDue: dayOfMonthDue ? Number(dayOfMonthDue) : undefined,
        priority,
        autoCreateTasks,
        requiredDocumentTypes: selectedTemplate?.requiredDocumentTypes || [],
        status: 'active',
        createdBy: 'current_user',
      };

      await onSave(input);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save obligation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Compliance Obligation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {/* Template Picker */}
          {!selectedTemplate && (
            <div className="space-y-2">
              <Label>Select a Template (or fill in manually below)</Label>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {OBLIGATION_TEMPLATES.map(t => (
                  <button
                    key={t.title}
                    onClick={() => handleTemplateSelect(t)}
                    className="text-left text-sm px-3 py-2 rounded-md border hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {REGULATORY_BODY_LABELS[t.regulatoryBody]} &middot; {FREQUENCY_LABELS[t.frequency]} &middot; {OBLIGATION_PRIORITY_LABELS[t.priority]}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div className="flex items-center justify-between bg-[var(--rag-green-soft)] border border-[var(--rag-green)] rounded-md px-3 py-2">
              <span className="text-sm">Template: <strong>{selectedTemplate.title}</strong></span>
              <Button variant="ghost" size="sm" onClick={resetForm}>Clear</Button>
            </div>
          )}

          {/* Core Fields */}
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Monthly PAYE Filing" />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full text-sm border rounded-md px-3 py-2 bg-background min-h-[60px] resize-y"
              placeholder="Details about this obligation..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <select value={category} onChange={e => setCategory(e.target.value as ComplianceDocumentCategory)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Regulatory Body</Label>
              <select value={regulatoryBody} onChange={e => setRegulatoryBody(e.target.value as RegulatoryBody)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                {Object.entries(REGULATORY_BODY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <select value={frequency} onChange={e => setFrequency(e.target.value as RenewalFrequency)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Day of Month Due</Label>
              <Input type="number" min="1" max="28" value={dayOfMonthDue} onChange={e => setDayOfMonthDue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <select value={priority} onChange={e => setPriority(e.target.value as ObligationPriority)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                {Object.entries(OBLIGATION_PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoCreateTasks}
              onChange={e => setAutoCreateTasks(e.target.checked)}
              className="rounded"
            />
            Automatically create tasks when this obligation is due
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add Obligation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
