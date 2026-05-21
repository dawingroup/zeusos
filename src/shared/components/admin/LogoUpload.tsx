/**
 * Logo Upload Component
 * Dedicated component for uploading organization logos
 */

import { useState, useRef } from 'react';
import { Upload, X, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Alert, AlertDescription } from '@/core/components/ui/alert';
import { uploadSubsidiaryLogo, deleteSubsidiaryLogo } from '@/core/settings';
import { cn } from '@/shared/lib/utils';

interface LogoUploadProps {
  currentLogoUrl?: string;
  onLogoChange?: (logoUrl: string | undefined) => void;
  className?: string;
  subsidiaryId?: string;
  subsidiaryName?: string;
}

export default function LogoUpload({ 
  currentLogoUrl, 
  onLogoChange,
  className,
  subsidiaryId = 'zeus-group',
  subsidiaryName = 'Zeus Group',
}: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    
    // Validate file
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      setError('File size exceeds 2MB limit');
      return;
    }
    
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: PNG, JPG, SVG, WebP');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const logoUrl = await uploadSubsidiaryLogo(file, subsidiaryId, 'primary');
      onLogoChange?.(logoUrl);
    } catch (err) {
      console.error('Failed to upload logo:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete the logo?')) return;
    
    setUploading(true);
    setError(null);
    
    try {
      await deleteSubsidiaryLogo(subsidiaryId, 'primary');
      onLogoChange?.(undefined);
    } catch (err) {
      console.error('Failed to delete logo:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete logo');
    } finally {
      setUploading(false);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="text-lg">{subsidiaryName} Logo</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Upload logo for {subsidiaryName}. It appears on subsidiary-specific documents.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {/* Logo Preview */}
        <div className="flex items-center justify-center">
          <div 
            className={cn(
              'w-48 h-32 border-2 border-dashed rounded-lg flex items-center justify-center overflow-hidden transition-colors',
              uploading ? 'border-gray-300 bg-gray-50' : 'border-gray-300 hover:border-gray-400 bg-gray-100'
            )}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                <span className="text-sm text-gray-600">Uploading...</span>
              </div>
            ) : currentLogoUrl ? (
              <div className="relative w-full h-full">
                <img 
                  src={currentLogoUrl} 
                  alt="Organization Logo"
                  className="w-full h-full object-contain p-2"
                />
                <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleDelete}
                    className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Upload className="w-8 h-8" />
                <span className="text-sm">Drop logo here or click to browse</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Upload Button */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="hidden"
          />
          
          <Button 
            onClick={openFileDialog}
            disabled={uploading}
            variant="outline"
            className="flex-1"
          >
            <Upload className="w-4 h-4 mr-2" />
            {currentLogoUrl ? 'Change Logo' : 'Upload Logo'}
          </Button>
          
          {currentLogoUrl && (
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={uploading}
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
        
        {/* File Requirements */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• PNG, JPG, SVG, WebP formats</p>
          <p>• Maximum file size: 2MB</p>
          <p>• Recommended dimensions: 200x100px (will be scaled automatically)</p>
        </div>
      </CardContent>
    </Card>
  );
}
