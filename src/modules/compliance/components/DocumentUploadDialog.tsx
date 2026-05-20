/**
 * DocumentUploadDialog
 * Dialog for creating a compliance document with template picker and file upload.
 */

import { useState, useRef } from 'react';
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
import { Loader2, Upload, FileText } from 'lucide-react';
import { DOCUMENT_TEMPLATES, CATEGORY_LABELS, REGULATORY_BODY_LABELS, FREQUENCY_LABELS } from '../types/constants';
import type {
  ComplianceDocumentCategory,
  RegulatoryBody,
  RenewalFrequency,
  ComplianceDocumentInput,
  DocumentTemplate,
} from '../types';

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: Partial<ComplianceDocumentInput>, file?: File) => Promise<unknown>;
}

export function DocumentUploadDialog({ open, onOpenChange, onSave }: DocumentUploadDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [category, setCategory] = useState<ComplianceDocumentCategory>('business');
  const [regulatoryBody, setRegulatoryBody] = useState<RegulatoryBody>('OTHER');
  const [renewalFrequency, setRenewalFrequency] = useState<RenewalFrequency>('annually');
  const [alertDaysBefore, setAlertDaysBefore] = useState('30');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTemplateSelect = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setName(template.name);
    setDocumentType(template.documentType);
    setCategory(template.category);
    setRegulatoryBody(template.regulatoryBody);
    setRenewalFrequency(template.renewalFrequency);
    setAlertDaysBefore(String(template.alertDaysBefore));
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setName('');
    setDocumentType('');
    setCategory('business');
    setRegulatoryBody('OTHER');
    setRenewalFrequency('annually');
    setAlertDaysBefore('30');
    setReferenceNumber('');
    setExpiryDate('');
    setIssuedDate('');
    setNotes('');
    setFile(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Document name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input: Partial<ComplianceDocumentInput> = {
        name: name.trim(),
        documentType: documentType || name.toLowerCase().replace(/\s+/g, '_'),
        category,
        regulatoryBody,
        renewalFrequency,
        alertDaysBefore: Number(alertDaysBefore) || 30,
        status: file ? 'pending_verification' : 'missing',
        uploadedBy: 'current_user',
      };

      if (referenceNumber.trim()) input.referenceNumber = referenceNumber.trim();
      if (notes.trim()) input.notes = notes.trim();

      if (expiryDate) {
        const { Timestamp } = await import('firebase/firestore');
        input.expiryDate = Timestamp.fromDate(new Date(expiryDate));
      }
      if (issuedDate) {
        const { Timestamp } = await import('firebase/firestore');
        input.issuedDate = Timestamp.fromDate(new Date(issuedDate));
      }

      await onSave(input, file || undefined);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Compliance Document</DialogTitle>
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
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {DOCUMENT_TEMPLATES.map(t => (
                  <button
                    key={t.documentType}
                    onClick={() => handleTemplateSelect(t)}
                    className="text-left text-sm px-3 py-2 rounded-md border hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {REGULATORY_BODY_LABELS[t.regulatoryBody]} &middot; {FREQUENCY_LABELS[t.renewalFrequency]}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedTemplate && (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
              <span className="text-sm">
                Template: <strong>{selectedTemplate.name}</strong>
              </span>
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Clear
              </Button>
            </div>
          )}

          {/* Core Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Document Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Tax Clearance 2026" />
            </div>
            <div className="space-y-1.5">
              <Label>Reference Number</Label>
              <Input value={referenceNumber} onChange={e => setReferenceNumber(e.target.value)} placeholder="e.g., TCC-2026-001" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
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
            <div className="space-y-1.5">
              <Label>Renewal Frequency</Label>
              <select value={renewalFrequency} onChange={e => setRenewalFrequency(e.target.value as RenewalFrequency)} className="w-full text-sm border rounded-md px-3 py-2 bg-background">
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Issued Date</Label>
              <Input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Alert Days Before</Label>
              <Input type="number" value={alertDaysBefore} onChange={e => setAlertDaysBefore(e.target.value)} />
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-1.5">
            <Label>Upload Document</Label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-md px-4 py-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-600" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload a PDF, image, or document
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={e => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full text-sm border rounded-md px-3 py-2 bg-background min-h-[60px] resize-y"
              placeholder="Additional details..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Add Document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
