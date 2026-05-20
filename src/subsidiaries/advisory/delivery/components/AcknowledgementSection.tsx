/**
 * ACKNOWLEDGEMENT SECTION COMPONENT
 *
 * Form section for creating acknowledgement documents for requisitions.
 * This is the first step - acknowledging receipt of funds before adding accountabilities.
 */

import { useState } from 'react';
import {
  FileSignature,
  Download,
  Eye,
  Check,
  AlertCircle,
  Mail,
  User,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Badge } from '@/core/components/ui/badge';
import { format } from 'date-fns';
import {
  ManualRequisition,
  AcknowledgementFormData,
} from '../types/manual-requisition';
import {
  downloadAcknowledgementPDF,
  generateAcknowledgementDataUrl,
} from '../services/acknowledgement-document-service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface AcknowledgementSectionProps {
  requisition: ManualRequisition;
  onAcknowledgementSaved: (acknowledgement: AcknowledgementFormData) => Promise<void>;
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: Date | any): string {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : date?.toDate?.() || new Date(date);
  return format(d, 'MMM d, yyyy');
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function AcknowledgementSection({
  requisition,
  onAcknowledgementSaved,
  isLoading = false,
}: AcknowledgementSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<AcknowledgementFormData>({
    amountReceived: requisition.amount,
    dateReceived: new Date(),
    receivedBy: '',
    receivedByEmail: '',
    receivedByTitle: '',
    signatureHtml: '',
    notes: '',
  });

  const hasAcknowledgement = Boolean(requisition.acknowledgement);

  const handleInputChange = (field: keyof AcknowledgementFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePreview = () => {
    const dataUrl = generateAcknowledgementDataUrl({
      requisition,
      acknowledgement: formData,
    });
    setPreviewUrl(dataUrl);
    setShowPreview(true);
  };

  const handleDownload = () => {
    downloadAcknowledgementPDF({
      requisition,
      acknowledgement: formData,
    });
  };

  const handleDownloadExisting = () => {
    if (requisition.acknowledgement) {
      const existingData: AcknowledgementFormData = {
        amountReceived: requisition.acknowledgement.amountReceived,
        dateReceived: requisition.acknowledgement.dateReceived instanceof Date
          ? requisition.acknowledgement.dateReceived
          : (requisition.acknowledgement.dateReceived as any).toDate(),
        receivedBy: requisition.acknowledgement.receivedBy,
        receivedByEmail: requisition.acknowledgement.receivedByEmail,
        receivedByTitle: requisition.acknowledgement.receivedByTitle,
        signatureHtml: requisition.acknowledgement.signatureHtml,
        notes: requisition.acknowledgement.notes,
      };
      downloadAcknowledgementPDF({
        requisition,
        acknowledgement: existingData,
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onAcknowledgementSaved(formData);
      setShowForm(false);
    } catch (error) {
      console.error('Failed to save acknowledgement:', error);
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = formData.receivedBy && formData.receivedByEmail && formData.amountReceived > 0;

  // ─────────────────────────────────────────────────────────────────
  // RENDER: EXISTING ACKNOWLEDGEMENT
  // ─────────────────────────────────────────────────────────────────

  if (hasAcknowledgement && requisition.acknowledgement) {
    const ack = requisition.acknowledgement;
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium text-green-900 flex items-center gap-2">
                Acknowledgement Document Generated
                <Badge variant="outline" className="text-green-700 border-green-300">
                  Complete
                </Badge>
              </h3>
              <div className="mt-2 space-y-1 text-sm text-green-700">
                <p>
                  <span className="font-medium">Amount:</span>{' '}
                  {formatCurrency(ack.amountReceived, requisition.currency)}
                </p>
                <p>
                  <span className="font-medium">Received by:</span> {ack.receivedBy}
                </p>
                <p>
                  <span className="font-medium">Date:</span> {formatDate(ack.dateReceived)}
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadExisting}
            className="border-green-300 text-green-700 hover:bg-green-100"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: CREATE ACKNOWLEDGEMENT PROMPT
  // ─────────────────────────────────────────────────────────────────

  if (!showForm) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-full">
            <FileSignature className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-amber-900">Acknowledgement Required</h3>
            <p className="text-sm text-amber-700 mt-1">
              Before adding accountability entries, you need to generate an acknowledgement document
              confirming receipt of funds. This document will include your email signature.
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="mt-3 bg-amber-600 hover:bg-amber-700"
            >
              <FileSignature className="w-4 h-4 mr-2" />
              Create Acknowledgement
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: ACKNOWLEDGEMENT FORM
  // ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="bg-white border rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-gray-500" />
            Create Acknowledgement Document
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(false)}
          >
            Cancel
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Amount Received */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Amount Received <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={formData.amountReceived || ''}
              onChange={e => handleInputChange('amountReceived', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Requisition amount: {formatCurrency(requisition.amount, requisition.currency)}
            </p>
          </div>

          {/* Date Received */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date Received <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={formData.dateReceived instanceof Date
                ? formData.dateReceived.toISOString().split('T')[0]
                : ''}
              onChange={e => handleInputChange('dateReceived', new Date(e.target.value))}
            />
          </div>

          {/* Received By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Received By (Full Name) <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.receivedBy}
              onChange={e => handleInputChange('receivedBy', e.target.value)}
              placeholder="John Doe"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Mail className="w-4 h-4 inline mr-1" />
              Email Address <span className="text-red-500">*</span>
            </label>
            <Input
              type="email"
              value={formData.receivedByEmail}
              onChange={e => handleInputChange('receivedByEmail', e.target.value)}
              placeholder="john.doe@company.com"
            />
          </div>

          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Job Title / Position
            </label>
            <Input
              type="text"
              value={formData.receivedByTitle || ''}
              onChange={e => handleInputChange('receivedByTitle', e.target.value)}
              placeholder="e.g., Project Manager, Field Officer"
            />
          </div>

          {/* Email Signature */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText className="w-4 h-4 inline mr-1" />
              Email Signature (paste your signature here)
            </label>
            <Textarea
              value={formData.signatureHtml || ''}
              onChange={e => handleInputChange('signatureHtml', e.target.value)}
              placeholder="Paste your email signature here (HTML or plain text). This will appear at the bottom of the acknowledgement document."
              rows={4}
            />
            <p className="text-xs text-gray-500 mt-1">
              Copy your email signature from Outlook/Gmail and paste it here. It will be included in the PDF.
            </p>
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <Textarea
              value={formData.notes || ''}
              onChange={e => handleInputChange('notes', e.target.value)}
              placeholder="Any additional notes about this acknowledgement"
              rows={2}
            />
          </div>
        </div>

        {/* Warning if amount differs */}
        {formData.amountReceived !== requisition.amount && formData.amountReceived > 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>
              Amount received ({formatCurrency(formData.amountReceived, requisition.currency)}) differs from
              requisition amount ({formatCurrency(requisition.amount, requisition.currency)})
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!isFormValid}
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview PDF
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={!isFormValid}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Only
            </Button>

            <Button
              onClick={handleSave}
              disabled={!isFormValid || saving || isLoading}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save & Download
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Acknowledgement Document Preview</DialogTitle>
            <DialogDescription>
              Review the document before downloading or saving
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 h-[70vh]">
            <iframe
              src={previewUrl}
              className="w-full h-full border rounded-lg"
              title="Acknowledgement Preview"
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Close
            </Button>
            <Button onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AcknowledgementSection;
