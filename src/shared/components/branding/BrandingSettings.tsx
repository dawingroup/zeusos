/**
 * BrandingSettings Component
 * UI for uploading and managing logo and favicon
 */

import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useBranding } from '@/shared/hooks/useBranding';
import { useAuth } from '@/shared/hooks';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';

export function BrandingSettings() {
  const { currentSubsidiary } = useSubsidiary();
  const activeSubsidiaryId = currentSubsidiary?.id || 'zeus-group';
  const activeSubsidiaryName = currentSubsidiary?.name || 'Zeus Group';
  const { branding, uploading, error, uploadLogo, uploadFavicon, resetBranding } =
    useBranding(activeSubsidiaryId);
  const { user } = useAuth();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      await uploadLogo(file);
      setSuccessMessage('Logo uploaded successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error uploading logo:', err);
    }

    // Reset input
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleFaviconUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    try {
      await uploadFavicon(file);
      setSuccessMessage('Favicon uploaded successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error uploading favicon:', err);
    }

    // Reset input
    if (faviconInputRef.current) {
      faviconInputRef.current.value = '';
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset branding to defaults? This will delete uploaded files.')) {
      return;
    }

    try {
      await resetBranding();
      setSuccessMessage('Branding reset to defaults!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error resetting branding:', err);
    }
  };

  if (!user) {
    return (
      <div className="p-4 bg-[var(--rag-amber-soft)] border border-[var(--rag-amber)] rounded-lg">
        <p className="text-sm text-[var(--rag-amber)]">Please sign in to manage branding settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Branding Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload logo and favicon for {activeSubsidiaryName}
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-2 p-4 bg-[var(--rag-green-soft)] border border-[var(--rag-green)] rounded-lg">
          <CheckCircle className="h-5 w-5 text-[var(--rag-green)]" />
          <p className="text-sm text-[var(--rag-green)]">{successMessage}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg">
          <AlertCircle className="h-5 w-5 text-[var(--rag-red)]" />
          <p className="text-sm text-[var(--rag-red)]">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Logo Upload */}
        <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Logo</h3>
            {branding.logoUrl && (
              <span className="text-xs text-[var(--rag-green)] bg-[var(--rag-green-soft)] px-2 py-1 rounded">
                Custom
              </span>
            )}
          </div>

          {/* Logo Preview */}
          <div className="aspect-square bg-[var(--bg-sunken)] rounded-lg flex items-center justify-center border-2 border-dashed border-[var(--border-default)]">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="max-h-full max-w-full object-contain p-4"
              />
            ) : (
              <div className="text-center">
                <ImageIcon className="h-16 w-16 text-[var(--fg-tertiary)] mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Default Logo</p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="space-y-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
              disabled={uploading}
            />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#872E5C] text-white rounded-md hover:bg-[#6a2449] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload Logo'}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              PNG, JPG, SVG • Max 5MB
            </p>
          </div>
        </div>

        {/* Favicon Upload */}
        <div className="bg-card border border-[var(--border-subtle)] rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Favicon</h3>
            {branding.faviconUrl && (
              <span className="text-xs text-[var(--rag-green)] bg-[var(--rag-green-soft)] px-2 py-1 rounded">
                Custom
              </span>
            )}
          </div>

          {/* Favicon Preview */}
          <div className="aspect-square bg-[var(--bg-sunken)] rounded-lg flex items-center justify-center border-2 border-dashed border-[var(--border-default)]">
            {branding.faviconUrl ? (
              <img
                src={branding.faviconUrl}
                alt="Favicon"
                className="max-h-full max-w-full object-contain p-4"
              />
            ) : (
              <div className="text-center">
                <ImageIcon className="h-16 w-16 text-[var(--fg-tertiary)] mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Default Favicon</p>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div className="space-y-2">
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
              onChange={handleFaviconUpload}
              className="hidden"
              disabled={uploading}
            />
            <button
              onClick={() => faviconInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#872E5C] text-white rounded-md hover:bg-[#6a2449] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading...' : 'Upload Favicon'}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              PNG, ICO, SVG • Max 1MB
            </p>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      {(branding.logoUrl || branding.faviconUrl) && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleReset}
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-2 border border-[var(--border-default)] text-muted-foreground rounded-md hover:bg-[var(--bg-sunken)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className="h-4 w-4" />
            Reset to Default Branding
          </button>
        </div>
      )}

      {/* Guidelines */}
      <div className="bg-[var(--rag-blue-soft)] border border-[var(--rag-blue)] rounded-lg p-4 mt-6">
        <h4 className="text-sm font-semibold text-[var(--rag-blue)] mb-2">Guidelines</h4>
        <ul className="text-xs text-[var(--rag-blue)] space-y-1 list-disc list-inside">
          <li>Logo: Recommended size 200x200px or larger, square aspect ratio works best</li>
          <li>Favicon: Recommended size 32x32px or 64x64px for best compatibility</li>
          <li>Use PNG or SVG format for transparency support</li>
          <li>Changes take effect immediately across the platform</li>
          <li>Uploaded files are stored securely in Firebase Storage</li>
        </ul>
      </div>
    </div>
  );
}

export default BrandingSettings;
