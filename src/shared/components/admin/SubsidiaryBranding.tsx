/**
 * Subsidiary Branding Component
 * Manages branding for all Zeus Group sub-brands
 */

import { useState, useRef } from 'react';
import { Building2, Upload, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import { uploadSubsidiaryLogo, deleteSubsidiaryLogo } from '@/core/settings';
import { useOrganizationSettings } from '@/core/settings';
import type { DocumentBrandingPalette } from '@/core/settings/types';

const SUBSIDIARIES = [
  { id: 'zeus-group',      name: 'Zeus Group',      description: 'Parent consortium' },
  { id: 'zeus-the-agency', name: 'Zeus The Agency', description: 'Flagship 360° advertising agency (Uganda)' },
  { id: 'zeus-digital',    name: 'Zeus Digital',    description: 'Digital-focused content, SEM, influencer & media buy' },
  { id: 'labyrinth',       name: 'Labyrinth',       description: 'Audio & visual content production studio' },
  { id: 'odd-gorilla',     name: 'Odd Gorilla',     description: 'Conflict agency for same-category clients' },
  { id: 'house-of-zeus',   name: 'House of Zeus',   description: 'Kenya market expansion' },
] as const;

type SubsidiaryId = typeof SUBSIDIARIES[number]['id'];

interface SubsidiaryBrandingTabProps {
  subsidiaryId: SubsidiaryId;
  subsidiary: typeof SUBSIDIARIES[number];
  branding: any;
  onBrandingUpdate: (subsidiaryId: SubsidiaryId, updates: any) => void;
}

function SubsidiaryBrandingTab({ 
  subsidiaryId, 
  subsidiary, 
  branding, 
  onBrandingUpdate 
}: SubsidiaryBrandingTabProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docPalette: DocumentBrandingPalette = branding?.documentPalette ?? {};

  const patchDocPalette = (patch: Partial<DocumentBrandingPalette>) => {
    const next: DocumentBrandingPalette = { ...docPalette };
    for (const [k, v] of Object.entries(patch)) {
      const key = k as keyof DocumentBrandingPalette;
      const val = typeof v === 'string' ? v.trim() : '';
      if (val) next[key] = val as never;
      else delete next[key];
    }
    onBrandingUpdate(subsidiaryId, {
      documentPalette: Object.keys(next).length > 0 ? next : {},
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setUploadError(null);
    
    try {
      const logoUrl = await uploadSubsidiaryLogo(file, subsidiaryId, 'primary');
      onBrandingUpdate(subsidiaryId, { logoUrl });
    } catch (error) {
      console.error('Failed to upload logo:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to delete the logo?')) return;

    setUploading(true);
    try {
      await deleteSubsidiaryLogo(subsidiaryId, 'primary');
      onBrandingUpdate(subsidiaryId, { logoUrl: undefined });
    } catch (error) {
      console.error('Failed to delete logo:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to delete logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {subsidiary.name}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{subsidiary.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {uploadError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {/* Logo Upload */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Logo</Label>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 bg-[var(--bg-sunken)] rounded-lg flex items-center justify-center border-2 border-dashed border-[var(--border-default)] overflow-hidden">
              {uploading ? (
                <Loader2 className="w-8 h-8 animate-spin text-[var(--fg-tertiary)]" />
              ) : branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt={`${subsidiary.name} Logo`}
                  className="w-full h-full object-contain p-2"
                />
              ) : (
                <Upload className="w-8 h-8 text-[var(--fg-tertiary)]" />
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                disabled={uploading}
                className="hidden"
              />
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading...' : branding?.logoUrl ? 'Change Logo' : 'Upload Logo'}
              </Button>
              {branding?.logoUrl && (
                <Button variant="destructive" onClick={handleDeleteLogo} disabled={uploading}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Brand Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor={`${subsidiaryId}-primary`}>Primary Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id={`${subsidiaryId}-primary`}
                type="color"
                value={branding?.primaryColor || '#872E5C'}
                onChange={(e) => onBrandingUpdate(subsidiaryId, { primaryColor: e.target.value })}
                className="w-12 h-8 p-0 border-0"
              />
              <Input
                value={branding?.primaryColor || '#872E5C'}
                onChange={(e) => onBrandingUpdate(subsidiaryId, { primaryColor: e.target.value })}
                placeholder="#872E5C"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${subsidiaryId}-secondary`}>Secondary Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id={`${subsidiaryId}-secondary`}
                type="color"
                value={branding?.secondaryColor || '#E18425'}
                onChange={(e) => onBrandingUpdate(subsidiaryId, { secondaryColor: e.target.value })}
                className="w-12 h-8 p-0 border-0"
              />
              <Input
                value={branding?.secondaryColor || '#E18425'}
                onChange={(e) => onBrandingUpdate(subsidiaryId, { secondaryColor: e.target.value })}
                placeholder="#E18425"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${subsidiaryId}-accent`}>Accent Color</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id={`${subsidiaryId}-accent`}
                type="color"
                value={branding?.accentColor || branding?.primaryColor || '#16a34a'}
                onChange={(e) => onBrandingUpdate(subsidiaryId, { accentColor: e.target.value })}
                className="w-12 h-8 p-0 border-0"
              />
              <Input
                value={branding?.accentColor || ''}
                onChange={(e) =>
                  onBrandingUpdate(subsidiaryId, {
                    accentColor: e.target.value.trim() || undefined,
                  })
                }
                placeholder="Falls back to primary"
              />
            </div>
          </div>
        </div>

        {/* PDF / branded documents — optional overrides (else app colours above apply) */}
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div>
            <Label className="text-base">Branded documents (PDF)</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Optional colours for receipts and other exports. Leave a field empty to use the subsidiary
              primary, secondary, or accent above.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(
              [
                ['primary', 'Document primary', branding?.primaryColor || '#872E5C'],
                ['secondary', 'Document secondary', branding?.secondaryColor || '#E18425'],
                ['accent', 'Title & amounts accent', branding?.accentColor || branding?.primaryColor || '#16a34a'],
                ['border', 'Borders & dividers', '#e5e7eb'],
                ['muted', 'Muted labels', '#9ca3af'],
                ['highlightBg', 'Highlight box background', '#ecfdf5'],
                ['tableAltBg', 'Alternating table rows', '#f9fafb'],
              ] as const
            ).map(([field, label, fallbackPicker]) => {
              const f = field as keyof DocumentBrandingPalette;
              const stored = docPalette[f]?.trim();
              const pickerVal =
                stored && /^#[0-9A-Fa-f]{3,6}$/.test(stored) ? stored : fallbackPicker;
              return (
                <div key={field}>
                  <Label htmlFor={`${subsidiaryId}-doc-${field}`}>{label}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id={`${subsidiaryId}-doc-${field}-c`}
                      type="color"
                      value={pickerVal.length === 7 ? pickerVal : fallbackPicker}
                      onChange={(e) => patchDocPalette({ [f]: e.target.value })}
                      className="w-12 h-8 p-0 border-0"
                    />
                    <Input
                      id={`${subsidiaryId}-doc-${field}`}
                      value={stored ?? ''}
                      onChange={(e) => patchDocPalette({ [f]: e.target.value })}
                      placeholder="Default"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Additional Branding */}
        <div className="space-y-4">
          <div>
            <Label htmlFor={`${subsidiaryId}-tagline`}>Tagline</Label>
            <Input
              id={`${subsidiaryId}-tagline`}
              value={branding?.tagline || ''}
              onChange={(e) => onBrandingUpdate(subsidiaryId, { tagline: e.target.value })}
              placeholder="Enter tagline..."
            />
          </div>
          <div>
            <Label htmlFor={`${subsidiaryId}-description`}>Description</Label>
            <Textarea
              id={`${subsidiaryId}-description`}
              value={branding?.description || ''}
              onChange={(e) => onBrandingUpdate(subsidiaryId, { description: e.target.value })}
              placeholder="Enter description..."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor={`${subsidiaryId}-website`}>Website</Label>
            <Input
              id={`${subsidiaryId}-website`}
              value={branding?.website || ''}
              onChange={(e) => onBrandingUpdate(subsidiaryId, { website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
        </div>

        {/* Contact & Address */}
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div>
            <Label className="text-base">Contact &amp; Address</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Used on this subsidiary's letterheads, invoices, and quotes. Falls back to
              the group address (Settings → General) when blank.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor={`${subsidiaryId}-email`}>Email</Label>
              <Input
                id={`${subsidiaryId}-email`}
                type="email"
                value={branding?.contact?.email || ''}
                onChange={(e) =>
                  onBrandingUpdate(subsidiaryId, {
                    contact: { ...(branding?.contact ?? {}), email: e.target.value },
                  })
                }
                placeholder="hello@example.com"
              />
            </div>
            <div>
              <Label htmlFor={`${subsidiaryId}-phone`}>Phone</Label>
              <Input
                id={`${subsidiaryId}-phone`}
                value={branding?.contact?.phone || ''}
                onChange={(e) =>
                  onBrandingUpdate(subsidiaryId, {
                    contact: { ...(branding?.contact ?? {}), phone: e.target.value },
                  })
                }
                placeholder="+256 7XX XXX XXX"
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`${subsidiaryId}-street`}>Street</Label>
            <Input
              id={`${subsidiaryId}-street`}
              value={branding?.contact?.address?.street || ''}
              onChange={(e) =>
                onBrandingUpdate(subsidiaryId, {
                  contact: {
                    ...(branding?.contact ?? {}),
                    address: {
                      ...(branding?.contact?.address ?? {}),
                      street: e.target.value,
                    },
                  },
                })
              }
              placeholder="Plot 1, Address Lane"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor={`${subsidiaryId}-city`}>City</Label>
              <Input
                id={`${subsidiaryId}-city`}
                value={branding?.contact?.address?.city || ''}
                onChange={(e) =>
                  onBrandingUpdate(subsidiaryId, {
                    contact: {
                      ...(branding?.contact ?? {}),
                      address: {
                        ...(branding?.contact?.address ?? {}),
                        city: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Kampala"
              />
            </div>
            <div>
              <Label htmlFor={`${subsidiaryId}-country`}>Country</Label>
              <Input
                id={`${subsidiaryId}-country`}
                value={branding?.contact?.address?.country || ''}
                onChange={(e) =>
                  onBrandingUpdate(subsidiaryId, {
                    contact: {
                      ...(branding?.contact ?? {}),
                      address: {
                        ...(branding?.contact?.address ?? {}),
                        country: e.target.value,
                      },
                    },
                  })
                }
                placeholder="Uganda"
              />
            </div>
            <div>
              <Label htmlFor={`${subsidiaryId}-postal`}>Postal Code</Label>
              <Input
                id={`${subsidiaryId}-postal`}
                value={branding?.contact?.address?.postalCode || ''}
                onChange={(e) =>
                  onBrandingUpdate(subsidiaryId, {
                    contact: {
                      ...(branding?.contact ?? {}),
                      address: {
                        ...(branding?.contact?.address ?? {}),
                        postalCode: e.target.value,
                      },
                    },
                  })
                }
                placeholder="P.O. Box 1234"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div>
          <Label>Preview</Label>
          <div 
            className="h-16 rounded-lg flex items-center justify-center text-white font-semibold mt-2"
            style={{
              background: `linear-gradient(to right, ${branding?.primaryColor || '#872E5C'}, ${branding?.secondaryColor || '#E18425'})`,
            }}
          >
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo" className="h-8 w-auto object-contain" />
            ) : (
              <span>{subsidiary.name}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SubsidiaryBranding() {
  const { settings, isLoading, updateSettings } = useOrganizationSettings();
  const [activeTab, setActiveTab] = useState<string>('zeus-group');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--fg-tertiary)]" />
      </div>
    );
  }

  const branding = settings?.branding || {
    groupPrimaryColor: '#0A1F4A',
    groupSecondaryColor: '#E63946',
    subsidiaries: {
      'zeus-group':       { primaryColor: '#0A1F4A', secondaryColor: '#E63946' },
      'zeus-the-agency':  { primaryColor: '#F5D900', secondaryColor: '#0A1F4A' },
      'zeus-digital':     { primaryColor: '#00C5E5', secondaryColor: '#0A1F4A' },
      'labyrinth':        { primaryColor: '#C8F0D6', secondaryColor: '#0A1F4A' },
      'odd-gorilla':      { primaryColor: '#FFB0B8', secondaryColor: '#0A1F4A' },
      'house-of-zeus':    { primaryColor: '#C8FF3C', secondaryColor: '#0A1F4A' },
    }
  };

  const handleBrandingUpdate = async (subsidiaryId: SubsidiaryId, updates: any) => {
    const updatedBranding = {
      ...branding,
      subsidiaries: {
        ...branding.subsidiaries,
        [subsidiaryId]: {
          ...branding.subsidiaries[subsidiaryId],
          ...updates,
        },
      },
    };

    await updateSettings({
      branding: updatedBranding,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Subsidiary Branding</h2>
        <p className="text-muted-foreground">
          Manage logos, colors, and branding for each Zeus Group agency
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          {SUBSIDIARIES.map((subsidiary) => (
            <TabsTrigger key={subsidiary.id} value={subsidiary.id}>
              {subsidiary.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {SUBSIDIARIES.map((subsidiary) => (
          <TabsContent key={subsidiary.id} value={subsidiary.id}>
            <SubsidiaryBrandingTab
              subsidiaryId={subsidiary.id}
              subsidiary={subsidiary}
              branding={branding.subsidiaries[subsidiary.id]}
              onBrandingUpdate={handleBrandingUpdate}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
