/**
 * FACILITY BRANDING EDITOR COMPONENT
 *
 * Editor for managing facility branding including:
 * - Client logo upload
 * - Donor/Program logo upload
 * - Contact information
 * - Preview of PDF header
 */

import { useState, useRef, useCallback } from 'react';
import {
  Building2,
  Upload,
  X,
  Phone,
  Mail,
  MapPin,
  Quote,
  Loader2,
  Check,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';

import { FacilityBranding } from '../types/funds-acknowledgement';
import { uploadFile, deleteFile } from '@/shared/services/firebase/storage';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface FacilityBrandingEditorProps {
  /** Current branding configuration */
  branding?: FacilityBranding;
  /** Project code for storage path organization */
  projectCode: string;
  /** Project ID for storage path */
  projectId: string;
  /** Callback when branding is saved */
  onSave: (branding: FacilityBranding) => Promise<void>;
  /** Loading state from parent */
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function FacilityBrandingEditor({
  branding,
  projectCode,
  projectId: _projectId, // Reserved for future Firestore operations
  onSave,
  isLoading = false,
}: FacilityBrandingEditorProps) {
  // Form state
  const [formData, setFormData] = useState<FacilityBranding>({
    facilityName: branding?.facilityName || '',
    facilityCode: branding?.facilityCode || projectCode,
    address: branding?.address || '',
    telephone: branding?.telephone || '',
    email: branding?.email || '',
    tagline: branding?.tagline || '',
    clientLogoUrl: branding?.clientLogoUrl || '',
    clientLogoStoragePath: branding?.clientLogoStoragePath || '',
    donorLogoUrl: branding?.donorLogoUrl || '',
    donorLogoStoragePath: branding?.donorLogoStoragePath || '',
    clientLogoWidth: branding?.clientLogoWidth || 25,
    donorLogoWidth: branding?.donorLogoWidth || 25,
  });

  const [saving, setSaving] = useState(false);
  const [uploadingClient, setUploadingClient] = useState(false);
  const [uploadingDonor, setUploadingDonor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const clientLogoInputRef = useRef<HTMLInputElement>(null);
  const donorLogoInputRef = useRef<HTMLInputElement>(null);

  // Handle input changes
  const handleInputChange = (field: keyof FacilityBranding, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
    setSuccess(false);
  };

  // Handle logo upload
  const handleLogoUpload = useCallback(
    async (file: File, logoType: 'client' | 'donor') => {
      const setUploading = logoType === 'client' ? setUploadingClient : setUploadingDonor;
      setUploading(true);
      setError(null);

      try {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error('Please select an image file (PNG, JPG, etc.)');
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          throw new Error('Image must be less than 2MB');
        }

        // Generate storage path
        const extension = file.name.split('.').pop() || 'png';
        const storagePath = `assets/logos/${projectCode}/${logoType}_logo_${Date.now()}.${extension}`;

        // Delete old logo if exists
        const oldPath =
          logoType === 'client' ? formData.clientLogoStoragePath : formData.donorLogoStoragePath;
        if (oldPath) {
          try {
            await deleteFile(oldPath);
          } catch (e) {
            // Ignore delete errors for old files
            console.warn('Could not delete old logo:', e);
          }
        }

        // Upload new logo
        const { url } = await uploadFile(storagePath, file);

        // Update form data
        if (logoType === 'client') {
          setFormData((prev) => ({
            ...prev,
            clientLogoUrl: url,
            clientLogoStoragePath: storagePath,
          }));
        } else {
          setFormData((prev) => ({
            ...prev,
            donorLogoUrl: url,
            donorLogoStoragePath: storagePath,
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload logo');
      } finally {
        setUploading(false);
      }
    },
    [projectCode, formData.clientLogoStoragePath, formData.donorLogoStoragePath]
  );

  // Handle logo removal
  const handleLogoRemove = useCallback(
    async (logoType: 'client' | 'donor') => {
      const storagePath =
        logoType === 'client' ? formData.clientLogoStoragePath : formData.donorLogoStoragePath;

      if (storagePath) {
        try {
          await deleteFile(storagePath);
        } catch (e) {
          console.warn('Could not delete logo:', e);
        }
      }

      if (logoType === 'client') {
        setFormData((prev) => ({
          ...prev,
          clientLogoUrl: '',
          clientLogoStoragePath: '',
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          donorLogoUrl: '',
          donorLogoStoragePath: '',
        }));
      }
    },
    [formData.clientLogoStoragePath, formData.donorLogoStoragePath]
  );

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, logoType: 'client' | 'donor') => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoUpload(file, logoType);
    }
    // Reset input
    e.target.value = '';
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.facilityName?.trim()) {
      setError('Facility name is required');
      return;
    }
    if (!formData.address?.trim()) {
      setError('Address is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save branding');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          Facility Branding
          {success && (
            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 ml-auto">
              <Check className="w-3 h-3 mr-1" />
              Saved
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Logo Upload Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Client Logo */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Client / Facility Logo (Left)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              {formData.clientLogoUrl ? (
                <div className="relative inline-block">
                  <img
                    src={formData.clientLogoUrl}
                    alt="Client Logo"
                    className="max-h-24 max-w-full object-contain"
                  />
                  <button
                    onClick={() => handleLogoRemove('client')}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : uploadingClient ? (
                <div className="py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Uploading...</p>
                </div>
              ) : (
                <div
                  className="py-4 cursor-pointer"
                  onClick={() => clientLogoInputRef.current?.click()}
                >
                  <ImageIcon className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Click to upload client logo</p>
                  <p className="text-xs text-gray-400">PNG, JPG up to 2MB</p>
                </div>
              )}
              <input
                ref={clientLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'client')}
              />
            </div>
            {formData.clientLogoUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => clientLogoInputRef.current?.click()}
                disabled={uploadingClient}
              >
                <Upload className="w-4 h-4 mr-2" />
                Replace Logo
              </Button>
            )}
          </div>

          {/* Donor Logo */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Donor / Program Logo (Right)
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
              {formData.donorLogoUrl ? (
                <div className="relative inline-block">
                  <img
                    src={formData.donorLogoUrl}
                    alt="Donor Logo"
                    className="max-h-24 max-w-full object-contain"
                  />
                  <button
                    onClick={() => handleLogoRemove('donor')}
                    className="absolute -top-2 -right-2 p-1 bg-red-100 rounded-full text-red-600 hover:bg-red-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : uploadingDonor ? (
                <div className="py-4">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Uploading...</p>
                </div>
              ) : (
                <div
                  className="py-4 cursor-pointer"
                  onClick={() => donorLogoInputRef.current?.click()}
                >
                  <ImageIcon className="w-10 h-10 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-500 mt-2">Click to upload donor logo</p>
                  <p className="text-xs text-gray-400">PNG, JPG up to 2MB</p>
                </div>
              )}
              <input
                ref={donorLogoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'donor')}
              />
            </div>
            {formData.donorLogoUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => donorLogoInputRef.current?.click()}
                disabled={uploadingDonor}
              >
                <Upload className="w-4 h-4 mr-2" />
                Replace Logo
              </Button>
            )}
          </div>
        </div>

        {/* Contact Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Contact Information</h3>

          {/* Facility Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Facility Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.facilityName}
              onChange={(e) => handleInputChange('facilityName', e.target.value)}
              placeholder="e.g., ST. THERESE OF LISIEUX RWIBAALE HEALTH CENTRE IV"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Address <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="e.g., P.O. Box 1045, Kyenjojo, Uganda"
            />
          </div>

          {/* Telephone & Email Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Telephone
              </label>
              <Input
                type="text"
                value={formData.telephone || ''}
                onChange={(e) => handleInputChange('telephone', e.target.value)}
                placeholder="e.g., (+256)782765188"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Email
              </label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="e.g., facility@example.com"
              />
            </div>
          </div>

          {/* Tagline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Quote className="w-4 h-4 inline mr-1" />
              Tagline / Motto
            </label>
            <Textarea
              value={formData.tagline || ''}
              onChange={(e) => handleInputChange('tagline', e.target.value)}
              placeholder="e.g., Holistic Care for Mothers and their families"
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1">
              This appears below the header in generated documents
            </p>
          </div>
        </div>

        {/* Preview */}
        {(formData.facilityName || formData.clientLogoUrl || formData.donorLogoUrl) && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 border-b pb-2">Preview</h3>
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                {/* Client Logo */}
                <div className="flex-shrink-0 w-20 h-16 flex items-center">
                  {formData.clientLogoUrl ? (
                    <img
                      src={formData.clientLogoUrl}
                      alt="Client"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                      Logo
                    </div>
                  )}
                </div>

                {/* Center Info */}
                <div className="flex-1 text-center">
                  <h4 className="font-bold text-sm uppercase">
                    {formData.facilityName || 'Facility Name'}
                  </h4>
                  <p className="text-xs text-gray-600">{formData.address || 'Address'}</p>
                  {(formData.telephone || formData.email) && (
                    <p className="text-xs text-gray-500">
                      {[formData.telephone, formData.email].filter(Boolean).join(' | ')}
                    </p>
                  )}
                  {formData.tagline && (
                    <p className="text-xs italic text-gray-500 mt-1">"{formData.tagline}"</p>
                  )}
                </div>

                {/* Donor Logo */}
                <div className="flex-shrink-0 w-20 h-16 flex items-center justify-end">
                  {formData.donorLogoUrl ? (
                    <img
                      src={formData.donorLogoUrl}
                      alt="Donor"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                      Logo
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={saving || isLoading}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Branding
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default FacilityBrandingEditor;
