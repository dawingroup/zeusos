/**
 * FUNDS ACKNOWLEDGEMENT FORM COMPONENT
 *
 * Form for generating Funds Received Acknowledgement documents for requisitions.
 * Features:
 * - Pre-filled data from linked requisition
 * - Digital signature capture
 * - Live document preview matching PDF layout
 * - Dual logo header (client + donor)
 * - Facility branding integration
 */

import { useState, useMemo } from 'react';
import {
  FileSignature,
  Download,
  Eye,
  Check,
  AlertCircle,
  Calendar,
  CreditCard,
  User,
  Briefcase,
  FileText,
  Loader2,
  X,
  ImageIcon,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';

import { ManualRequisition } from '../types/manual-requisition';
import {
  FundsAcknowledgementFormData,
  FundsAcknowledgementDocument,
  FacilityBranding,
  getDefaultBranding,
  validateFundsAcknowledgementForm,
  generateAcknowledgementFileName,
} from '../types/funds-acknowledgement';
import {
  downloadFundsAcknowledgementPDF,
  generateFundsAcknowledgementDataUrl,
  generateFundsAcknowledgementBlob,
  formatCurrency,
  numberToWords,
  formatDateWithOrdinal,
} from '../services/funds-acknowledgement-document-service';
import { SignaturePad } from './SignaturePad';
import { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface FundsAcknowledgementFormProps {
  /** The requisition to generate acknowledgement for */
  requisition: ManualRequisition;
  /** Project data (if already loaded) */
  project?: Project;
  /** Callback when acknowledgement is saved (receives document metadata and PDF blob) */
  onDocumentSaved?: (doc: FundsAcknowledgementDocument, pdfBlob: Blob) => Promise<void>;
  /** Loading state */
  isLoading?: boolean;
  /** Callback to close the form */
  onClose?: () => void;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function FundsAcknowledgementForm({
  requisition,
  project,
  onDocumentSaved,
  isLoading = false,
  onClose,
}: FundsAcknowledgementFormProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [templateVariant, setTemplateVariant] = useState<'standard' | 'donor_header'>('standard');

  // Form state - pre-filled from requisition
  const [formData, setFormData] = useState<FundsAcknowledgementFormData>({
    dateOfFundsTransfer: requisition.paidDate
      ? requisition.paidDate instanceof Date
        ? requisition.paidDate
        : (requisition.paidDate as any).toDate()
      : new Date(),
    projectName: requisition.linkedProjectName || requisition.purpose,
    projectDescription: requisition.purpose,
    amountReceived: requisition.amount,
    currency: requisition.currency || 'UGX',
    paymentMethod: '',
    periodCovered: '',
    requestorName: '',
    requestorTitle: '',
    requestorEmail: '',
    signatureDate: new Date(),
    signatureDataUrl: undefined,
    notes: '',
  });

  // Get branding from project or use default
  const branding: FacilityBranding = useMemo(() => {
    if (project?.facilityBranding) {
      return project.facilityBranding;
    }
    return getDefaultBranding();
  }, [project]);

  // Project code for file naming
  const projectCode = useMemo(() => {
    return project?.projectCode || requisition.linkedProjectId?.substring(0, 6).toUpperCase() || 'AMH';
  }, [project, requisition]);

  const buildFundsAckNumber = (amountReceived: number, suffix?: 'PREVIEW' | 'RCPT'): string => {
    const baseRef = (requisition.referenceNumber || requisition.id || 'REQ')
      .replace(/^DEFAULT[-/]+/i, '')
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const isSinglePayment = amountReceived >= requisition.amount;
    const instanceCode = isSinglePayment ? '01' : 'INST-01';
    return suffix ? `${baseRef}/${instanceCode}-${suffix}` : `${baseRef}/${instanceCode}`;
  };

  // Handle input changes
  const handleInputChange = (field: keyof FundsAcknowledgementFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors([]); // Clear errors on change
  };

  // Handle signature change
  const handleSignatureChange = (dataUrl: string | null) => {
    setFormData((prev) => ({ ...prev, signatureDataUrl: dataUrl || undefined }));
  };

  // Validate and show preview
  const handlePreview = async () => {
    const validation = validateFundsAcknowledgementForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setPreviewLoading(true);
    setErrors([]);
    try {
      const formDataWithPlaceholder = {
        ...formData,
        receiptNumber: buildFundsAckNumber(formData.amountReceived, 'PREVIEW'),
      };

      const dataUrl = await generateFundsAcknowledgementDataUrl({
        formData: formDataWithPlaceholder,
        branding,
        projectCode,
        templateVariant,
      });

      if (!dataUrl || !dataUrl.startsWith('data:application/pdf')) {
        throw new Error('Invalid PDF data URL generated');
      }

      setPreviewUrl(dataUrl);
      setShowPreview(true);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      setErrors([`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Download without saving (preview/draft mode - uses placeholder receipt number)
  const handleDownload = async () => {
    const validation = validateFundsAcknowledgementForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      const formDataWithPlaceholder = {
        ...formData,
        receiptNumber: buildFundsAckNumber(formData.amountReceived, 'RCPT'),
      };

      await downloadFundsAcknowledgementPDF({
        formData: formDataWithPlaceholder,
        branding,
        projectCode,
        templateVariant,
      });
    } catch (error) {
      console.error('Failed to download PDF:', error);
      setErrors(['Failed to download PDF. Please try again.']);
    }
  };

  // Save and optionally download
  const handleSave = async () => {
    const validation = validateFundsAcknowledgementForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      const receiptNumber = buildFundsAckNumber(formData.amountReceived);

      // Update form data with the receipt number
      const formDataWithReceipt = {
        ...formData,
        receiptNumber,
      };

      const pdfOptions = {
        formData: formDataWithReceipt,
        branding,
        projectCode,
        templateVariant,
      };

      // Generate PDF blob for storage upload (no automatic download)
      const pdfBlob = await generateFundsAcknowledgementBlob(pdfOptions);

      // If callback provided, create document record with PDF blob
      if (onDocumentSaved) {
        const document: FundsAcknowledgementDocument = {
          id: '', // Will be set by Firestore
          receiptNumber,
          dateOfFundsTransfer: formData.dateOfFundsTransfer,
          projectName: formData.projectName,
          projectDescription: formData.projectDescription,
          amountReceived: formData.amountReceived,
          amountInWords: '', // Will be computed by service
          currency: formData.currency,
          paymentMethod: formData.paymentMethod,
          periodCovered: formData.periodCovered,
          requestorName: formData.requestorName,
          requestorTitle: formData.requestorTitle,
          requestorEmail: formData.requestorEmail,
          signatureDate: formData.signatureDate || new Date(),
          signatureDataUrl: formData.signatureDataUrl,
          facilityBranding: branding,
          fileName: generateAcknowledgementFileName(projectCode, formData.periodCovered),
          projectId: requisition.linkedProjectId || '',
          projectCode,
          programId: requisition.linkedProgramId,
          linkedRequisitionId: requisition.id,
          templateVariant,
          generatedAt: null as any, // Will be set by Firestore
          generatedBy: '', // Will be set by service
          notes: formData.notes,
        };

        await onDocumentSaved(document, pdfBlob);
      }

      // Close form if callback provided
      onClose?.();
    } catch (error) {
      console.error('Failed to save acknowledgement:', error);
      setErrors(['Failed to save acknowledgement. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  // Check if form is valid for preview/download
  const isFormValid = useMemo(() => {
    return validateFundsAcknowledgementForm(formData).isValid;
  }, [formData]);

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="bg-white border rounded-lg p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-blue-600" />
              Generate Funds Acknowledgement
            </h3>
            <div className="mt-3 max-w-sm">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Document Template
              </label>
              <Select
                value={templateVariant}
                onValueChange={(value) => setTemplateVariant(value as 'standard' | 'donor_header')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (Facility Header)</SelectItem>
                  <SelectItem value="donor_header">Donor Header Form</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Standard keeps existing layout. Donor Header puts title/ref on left and donor logo on right.
              </p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Please fix the following errors:</p>
                <ul className="mt-1 text-sm text-red-700 list-disc list-inside">
                  {errors.map((error, idx) => (
                    <li key={idx}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Document Header Preview - Mirrors PDF Layout */}
        <div className="border rounded-lg overflow-hidden bg-white">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h4 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Document Preview</h4>
          </div>

          {templateVariant === 'donor_header' ? (
            <>
              {/* Donor Header Variant */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-start justify-between min-h-[70px]">
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-gray-900 leading-tight">
                      Funds Acknowledgement Form
                    </h3>
                    <p className="text-xs text-gray-600">
                      Ref: {formData.receiptNumber || 'RCPT'}
                    </p>
                  </div>
                  <div className="flex items-start justify-end">
                    {branding.donorLogoUrl ? (
                      <img
                        src={branding.donorLogoUrl}
                        alt="Donor Logo"
                        className="max-h-[95px] w-auto object-contain"
                        style={{ maxWidth: '170px' }}
                      />
                    ) : (
                      <div className="h-16 w-24 bg-gray-50 border border-dashed border-gray-300 rounded flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Header with Facility Logo and Branding - TOP-ALIGNED Row */}
              {/* Layout: [Logo 15%] [Facility Info 85%] - facility logo only */}
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="flex items-start min-h-[70px]">
                  {/* Facility Logo (Left) - 25% width, top-aligned, larger */}
                  <div className="w-[25%] flex items-start justify-start pt-1">
                    {branding.clientLogoUrl ? (
                      <img
                        src={branding.clientLogoUrl}
                        alt="Facility Logo"
                        className="max-h-[80px] w-auto object-contain"
                        style={{ maxWidth: '100px' }}
                      />
                    ) : (
                      <div className="h-16 w-20 bg-gray-50 border border-dashed border-gray-300 rounded flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Facility Branding - 75% width, centered text (shifted right), top-aligned */}
                  <div className="w-[75%] text-center px-4 space-y-0.5 pt-1 pl-8">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide leading-tight">
                      {branding.facilityName}
                    </h3>
                    {branding.address && (
                      <p className="text-[9px] text-gray-600 leading-tight">{branding.address}</p>
                    )}
                    {(branding.telephone || branding.email) && (
                      <p className="text-[9px] text-gray-600 leading-tight">
                        {branding.telephone && `Tel: ${branding.telephone}`}
                        {branding.telephone && branding.email && ' | '}
                        {branding.email && `Email: ${branding.email}`}
                      </p>
                    )}
                    {branding.tagline && (
                      <p className="text-[8px] text-gray-500 italic leading-tight">"{branding.tagline}"</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Document Title - with soft gray separator */}
              <div className="px-4 py-2 border-b border-gray-300/60 bg-gray-50/50">
                <h4 className="text-center font-bold text-gray-800 text-sm">
                  Funds Received Acknowledgement Form
                </h4>
              </div>
            </>
          )}

          {/* Transaction Details Table Preview */}
          <div className="p-4">
            <div className="border rounded overflow-hidden text-sm">
              {/* Receipt Number */}
              <div className="flex">
                <div className="w-1/3 bg-slate-700 text-white px-3 py-2 font-medium">Receipt Number:</div>
                <div className="w-2/3 px-3 py-2 bg-white">{formData.receiptNumber || '#Receipt-2026-XXX'}</div>
              </div>
              {/* Date */}
              <div className="flex">
                <div className="w-1/3 bg-slate-700 text-white px-3 py-2 font-medium">Date of Funds Transfer:</div>
                <div className="w-2/3 px-3 py-2 bg-gray-50">
                  {formData.dateOfFundsTransfer ? formatDateWithOrdinal(formData.dateOfFundsTransfer) : '-'}
                </div>
              </div>
              {/* Project Name */}
              <div className="flex">
                <div className="w-1/3 bg-slate-700 text-white px-3 py-2 font-medium">Project Name:</div>
                <div className="w-2/3 px-3 py-2 bg-white">{formData.projectName || '-'}</div>
              </div>
              {/* Amount */}
              <div className="flex">
                <div className="w-1/3 bg-slate-700 text-white px-3 py-2 font-medium">Amount Received:</div>
                <div className="w-2/3 px-3 py-2 bg-gray-50 font-medium">
                  {formData.amountReceived ? formatCurrency(formData.amountReceived, formData.currency) : '-'}
                </div>
              </div>
              {/* Amount in Words */}
              <div className="flex">
                <div className="w-1/3 bg-slate-700 text-white px-3 py-2 font-medium">Amount in Words:</div>
                <div className="w-2/3 px-3 py-2 bg-white text-xs">
                  {formData.amountReceived ? numberToWords(formData.amountReceived) : '-'}
                </div>
              </div>
              {/* Payment Method */}
              <div className="flex">
                <div className="w-1/3 bg-slate-700 text-white px-3 py-2 font-medium">Method of Payment:</div>
                <div className="w-2/3 px-3 py-2 bg-gray-50">{formData.paymentMethod || '-'}</div>
              </div>
            </div>
          </div>

          {/* Branding Status Indicator */}
          {(templateVariant === 'standard' ? !branding.clientLogoUrl || !branding.donorLogoUrl : !branding.donorLogoUrl) && (
            <div className="mx-4 mb-4 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {templateVariant === 'donor_header'
                ? 'Donor logo not configured. Upload in Project Settings.'
                : !branding.clientLogoUrl && !branding.donorLogoUrl
                ? 'No logos configured. Upload logos in Project Settings to customize the document header.'
                : !branding.clientLogoUrl
                ? 'Client logo not configured. Upload in Project Settings.'
                : 'Donor logo not configured. Upload in Project Settings.'}
            </div>
          )}
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date of Funds Transfer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Date of Funds Transfer <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={
                formData.dateOfFundsTransfer instanceof Date
                  ? formData.dateOfFundsTransfer.toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) => handleInputChange('dateOfFundsTransfer', new Date(e.target.value))}
            />
          </div>

          {/* Period Covered */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Period Covered
            </label>
            <Input
              type="text"
              value={formData.periodCovered || ''}
              onChange={(e) => handleInputChange('periodCovered', e.target.value)}
              placeholder="e.g., August 2025"
            />
          </div>

          {/* Project Name */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText className="w-4 h-4 inline mr-1" />
              Project Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.projectName}
              onChange={(e) => handleInputChange('projectName', e.target.value)}
              placeholder="e.g., Project Management Consultancy Fees"
            />
          </div>

          {/* Amount Received */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <DollarSign className="w-4 h-4 inline mr-1" />
              Amount Received <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={formData.amountReceived || ''}
              onChange={(e) => handleInputChange('amountReceived', parseFloat(e.target.value) || 0)}
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">
              Requisition amount: {formatCurrency(requisition.amount, requisition.currency)}
            </p>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <CreditCard className="w-4 h-4 inline mr-1" />
              Method of Payment <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.paymentMethod}
              onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
              placeholder="e.g., Bank Transfer to Centenary Account"
            />
          </div>

          {/* Requestor Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              Requestor Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.requestorName}
              onChange={(e) => handleInputChange('requestorName', e.target.value)}
              placeholder="Full name of person receiving funds"
            />
          </div>

          {/* Requestor Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Briefcase className="w-4 h-4 inline mr-1" />
              Title / Position
            </label>
            <Input
              type="text"
              value={formData.requestorTitle || ''}
              onChange={(e) => handleInputChange('requestorTitle', e.target.value)}
              placeholder="e.g., Project Manager"
            />
          </div>

          {/* Signature Date - allows backdating */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Signature Date
            </label>
            <Input
              type="date"
              value={
                formData.signatureDate instanceof Date
                  ? formData.signatureDate.toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) => handleInputChange('signatureDate', new Date(e.target.value))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Date the document is signed (can be backdated)
            </p>
          </div>

          {/* Project Description (for acknowledgement statement) */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <FileText className="w-4 h-4 inline mr-1" />
              Description (for acknowledgement statement)
            </label>
            <Textarea
              value={formData.projectDescription || ''}
              onChange={(e) => handleInputChange('projectDescription', e.target.value)}
              placeholder="Brief description of what the funds are for..."
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1">
              This will appear in: "I hereby acknowledge that I have received the funds as [description]..."
            </p>
          </div>

          {/* Signature Pad - Compact */}
          <div className="md:col-span-2 -mt-1">
            <SignaturePad
              onSignatureChange={handleSignatureChange}
              width={360}
              height={120}
              label="Digital Signature"
              initialSignature={formData.signatureDataUrl}
            />
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
            <Textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>
        </div>

        {/* Amount mismatch warning */}
        {formData.amountReceived !== requisition.amount && formData.amountReceived > 0 && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>
              Amount received ({formatCurrency(formData.amountReceived, formData.currency)}) differs from
              requisition amount ({formatCurrency(requisition.amount, requisition.currency)})
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handlePreview} disabled={!isFormValid || previewLoading}>
            {previewLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Preview PDF
              </>
            )}
          </Button>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleDownload} disabled={!isFormValid}>
              <Download className="w-4 h-4 mr-2" />
              Download Only
            </Button>

            <Button onClick={handleSave} disabled={!isFormValid || saving || isLoading}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save
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
            <DialogTitle>Funds Acknowledgement Preview</DialogTitle>
            <DialogDescription>Review the document before downloading or saving</DialogDescription>
          </DialogHeader>
          <div className="mt-4 h-[70vh]">
            <iframe
              src={previewUrl}
              className="w-full h-full border rounded-lg"
              title="Funds Acknowledgement Preview"
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

export default FundsAcknowledgementForm;
