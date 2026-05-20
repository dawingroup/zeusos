/**
 * ACTIVITY REPORT UPLOAD COMPONENT
 *
 * Allows Project Managers to upload activity reports at two levels:
 *
 * 1. REQUISITION-LEVEL: Overall report for the requisition showing
 *    evidence of work implemented for the funds disbursed
 *
 * 2. ACCOUNTABILITY-LEVEL: Specific to labour payments and professional
 *    services (expense categories: 'labor_wages' and 'professional_services')
 */

import { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  X,
  Image,
  Calendar,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  Trash2,
  Plus,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Badge } from '@/core/components/ui/badge';
import { format } from 'date-fns';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/shared/services/firebase';
import {
  ActivityReport,
  ActivityReportFormData,
  ActivityReportLevel,
} from '../../types/manual-requisition';
import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface ActivityReportUploadProps {
  /** The level of the activity report - requisition or accountability */
  level: ActivityReportLevel;
  /** The requisition ID (always required) */
  requisitionId: string;
  /** The accountability entry ID (required for accountability-level reports) */
  accountabilityId?: string;
  /** Existing report to display/edit */
  existingReport?: ActivityReport;
  /** Callback when report is saved */
  onReportSaved: (report: ActivityReportFormData) => Promise<void>;
  /** Callback when report is removed (optional) */
  onReportRemoved?: () => Promise<void>;
  /** Whether the form should be read-only */
  disabled?: boolean;
  /** Custom title for the prompt (defaults based on level) */
  promptTitle?: string;
  /** Custom description for the prompt */
  promptDescription?: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

function formatDate(date: Date | Timestamp | any): string {
  if (!date) return 'N/A';
  const d = date instanceof Date ? date : date?.toDate?.() || new Date(date);
  return format(d, 'MMM d, yyyy');
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ActivityReportUpload({
  level,
  requisitionId,
  accountabilityId,
  existingReport,
  onReportSaved,
  onReportRemoved: _onReportRemoved,
  disabled = false,
  promptTitle,
  promptDescription,
}: ActivityReportUploadProps) {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Default titles and descriptions based on level
  const defaultPromptTitle = level === 'requisition'
    ? 'Requisition Activity Report Required'
    : 'Activity Report Required';
  const defaultPromptDescription = level === 'requisition'
    ? 'Please upload an activity report documenting the overall work progress for this requisition. This provides evidence of how the funds were used.'
    : 'Please upload an activity report documenting the work/services provided for this labour or service payment.';

  const displayTitle = promptTitle || defaultPromptTitle;
  const displayDescription = promptDescription || defaultPromptDescription;

  // Form state
  const [formData, setFormData] = useState<ActivityReportFormData>({
    level,
    title: existingReport?.title || '',
    description: existingReport?.description || '',
    workSection: existingReport?.workSection || '',
    startDate: existingReport?.startDate instanceof Date
      ? existingReport.startDate
      : existingReport?.startDate
        ? (existingReport.startDate as Timestamp).toDate()
        : undefined,
    endDate: existingReport?.endDate instanceof Date
      ? existingReport.endDate
      : existingReport?.endDate
        ? (existingReport.endDate as Timestamp).toDate()
        : undefined,
    location: existingReport?.location || '',
    documentUrl: existingReport?.documentUrl || '',
    documentName: existingReport?.documentName || '',
    documentType: existingReport?.documentType || '',
    documentSize: existingReport?.documentSize,
    photos: existingReport?.photos?.map(p => ({
      url: p.url,
      caption: p.caption,
    })) || [],
  });

  const handleInputChange = (field: keyof ActivityReportFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a PDF or Word document');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      // Build storage path based on level
      const storagePath = level === 'requisition'
        ? `activity-reports/${requisitionId}/requisition/${Date.now()}-${file.name}`
        : `activity-reports/${requisitionId}/accountability/${accountabilityId}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      setFormData(prev => ({
        ...prev,
        documentUrl: downloadUrl,
        documentName: file.name,
        documentType: file.type,
        documentSize: file.size,
      }));
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const newPhotos: { url: string; caption?: string }[] = [];

      for (const file of Array.from(files)) {
        // Validate image type
        if (!file.type.startsWith('image/')) {
          continue;
        }

        // Validate file size (max 5MB per photo)
        if (file.size > 5 * 1024 * 1024) {
          continue;
        }

        // Build storage path based on level
        const storagePath = level === 'requisition'
          ? `activity-reports/${requisitionId}/requisition/photos/${Date.now()}-${file.name}`
          : `activity-reports/${requisitionId}/accountability/${accountabilityId}/photos/${Date.now()}-${file.name}`;
        const storageRef = ref(storage, storagePath);
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);

        newPhotos.push({ url: downloadUrl, caption: '' });
      }

      setFormData(prev => ({
        ...prev,
        photos: [...(prev.photos || []), ...newPhotos],
      }));
    } catch (error) {
      console.error('Failed to upload photos:', error);
      alert('Failed to upload photos. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos?.filter((_, i) => i !== index) || [],
    }));
  };

  const updatePhotoCaption = (index: number, caption: string) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos?.map((p, i) => (i === index ? { ...p, caption } : p)) || [],
    }));
  };

  const handleSave = async () => {
    if (!formData.title || !formData.description || !formData.workSection || !formData.documentUrl) {
      alert('Please fill in all required fields and upload a document');
      return;
    }

    setSaving(true);
    try {
      await onReportSaved(formData);
      setShowForm(false);
    } catch (error) {
      console.error('Failed to save activity report:', error);
      alert('Failed to save activity report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = formData.title && formData.description && formData.workSection && formData.documentUrl;

  // ─────────────────────────────────────────────────────────────────
  // RENDER: EXISTING REPORT
  // ─────────────────────────────────────────────────────────────────

  if (existingReport && !showForm) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h4 className="font-medium text-green-900 flex items-center gap-2">
                Activity Report Submitted
                <Badge
                  variant="outline"
                  className={
                    existingReport.reviewStatus === 'approved'
                      ? 'text-green-700 border-green-300'
                      : existingReport.reviewStatus === 'rejected'
                        ? 'text-red-700 border-red-300'
                        : 'text-yellow-700 border-yellow-300'
                  }
                >
                  {existingReport.reviewStatus === 'approved' ? 'Approved' :
                   existingReport.reviewStatus === 'rejected' ? 'Rejected' : 'Pending Review'}
                </Badge>
              </h4>
              <p className="text-sm font-medium text-green-800 mt-1">{existingReport.title}</p>
              <p className="text-sm text-green-700 mt-1">{existingReport.description}</p>
              <div className="mt-2 space-y-1 text-sm text-green-600">
                <p><span className="font-medium">Work Section:</span> {existingReport.workSection}</p>
                {existingReport.location && (
                  <p><span className="font-medium">Location:</span> {existingReport.location}</p>
                )}
                {existingReport.startDate && existingReport.endDate && (
                  <p>
                    <span className="font-medium">Period:</span>{' '}
                    {formatDate(existingReport.startDate)} - {formatDate(existingReport.endDate)}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(existingReport.documentUrl, '_blank')}
              className="border-green-300 text-green-700 hover:bg-green-100"
            >
              <Eye className="w-4 h-4 mr-1" />
              View
            </Button>
            {!disabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForm(true)}
                className="border-green-300 text-green-700 hover:bg-green-100"
              >
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* Show photos if any */}
        {existingReport.photos && existingReport.photos.length > 0 && (
          <div className="mt-3 pt-3 border-t border-green-200">
            <p className="text-sm font-medium text-green-800 mb-2">Supporting Photos</p>
            <div className="flex gap-2 overflow-x-auto">
              {existingReport.photos.map((photo, index) => (
                <div key={index} className="flex-shrink-0">
                  <img
                    src={photo.url}
                    alt={photo.caption || `Photo ${index + 1}`}
                    className="w-20 h-20 object-cover rounded-lg border border-green-200"
                    onClick={() => window.open(photo.url, '_blank')}
                    style={{ cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: NO REPORT - PROMPT TO ADD
  // ─────────────────────────────────────────────────────────────────

  if (!showForm) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 rounded-full">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-amber-900">{displayTitle}</h4>
            <p className="text-sm text-amber-700 mt-1">{displayDescription}</p>
            {!disabled && (
              <Button
                onClick={() => setShowForm(true)}
                className="mt-3 bg-amber-600 hover:bg-amber-700"
                size="sm"
              >
                <Upload className="w-4 h-4 mr-2" />
                Add Activity Report
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: FORM
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" />
          Activity Report
        </h4>
        <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Report Title <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.title}
            onChange={e => handleInputChange('title', e.target.value)}
            placeholder="e.g., Foundation Works Progress Report"
          />
        </div>

        {/* Work Section */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Section of Work <span className="text-red-500">*</span>
          </label>
          <Input
            value={formData.workSection}
            onChange={e => handleInputChange('workSection', e.target.value)}
            placeholder="e.g., Foundation excavation and concrete pouring"
          />
          <p className="text-xs text-gray-500 mt-1">
            Specify which section of work this report covers
          </p>
        </div>

        {/* Description */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Work Description <span className="text-red-500">*</span>
          </label>
          <Textarea
            value={formData.description}
            onChange={e => handleInputChange('description', e.target.value)}
            placeholder="Describe the work that was implemented..."
            rows={3}
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Calendar className="w-4 h-4 inline mr-1" />
            Work Start Date
          </label>
          <Input
            type="date"
            value={formData.startDate ? format(formData.startDate, 'yyyy-MM-dd') : ''}
            onChange={e => handleInputChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Calendar className="w-4 h-4 inline mr-1" />
            Work End Date
          </label>
          <Input
            type="date"
            value={formData.endDate ? format(formData.endDate, 'yyyy-MM-dd') : ''}
            onChange={e => handleInputChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
          />
        </div>

        {/* Location */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MapPin className="w-4 h-4 inline mr-1" />
            Work Location
          </label>
          <Input
            value={formData.location || ''}
            onChange={e => handleInputChange('location', e.target.value)}
            placeholder="e.g., Site A - Block 1"
          />
        </div>

        {/* Document Upload */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <FileText className="w-4 h-4 inline mr-1" />
            Activity Report Document <span className="text-red-500">*</span>
          </label>
          {formData.documentUrl ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
              <FileText className="w-8 h-8 text-blue-500" />
              <div className="flex-1">
                <p className="font-medium text-sm">{formData.documentName}</p>
                {formData.documentSize && (
                  <p className="text-xs text-gray-500">{formatFileSize(formData.documentSize)}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(formData.documentUrl, '_blank')}
                >
                  <Eye className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleInputChange('documentUrl', '')}
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                  <p className="text-sm text-gray-600">Uploading...</p>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Click to upload PDF or Word document
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Max 10MB</p>
                </>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Supporting Photos */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <Image className="w-4 h-4 inline mr-1" />
            Supporting Photos (Optional)
          </label>
          <div className="space-y-3">
            {/* Existing photos */}
            {formData.photos && formData.photos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {formData.photos.map((photo, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={photo.url}
                      alt={photo.caption || `Photo ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <Input
                      placeholder="Caption..."
                      value={photo.caption || ''}
                      onChange={e => updatePhotoCaption(index, e.target.value)}
                      className="mt-1 text-xs"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Add photos button */}
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-primary hover:bg-gray-50 transition-colors"
              onClick={() => photoInputRef.current?.click()}
            >
              <Plus className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-sm text-gray-600">Add site photos</p>
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!isFormValid || saving || uploading}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4 mr-2" />
              Save Activity Report
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ActivityReportUpload;
