/**
 * ManualClipDialog Component
 * Multi-step dialog for manually creating a material clip via photo upload or URL.
 * Uses Google Search + Gemini AI to research and extract product details.
 */

import { useState, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  Link,
  Search,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader2,
  RotateCcw,
  Camera,
  Globe,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { functions } from '@/shared/services/firebase/functions';
import { db } from '@/shared/services/firebase';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import { Badge } from '@/core/components/ui/badge';
import { Textarea } from '@/core/components/ui/textarea';

// ============================================
// Types
// ============================================

type Step = 'input' | 'researching' | 'review' | 'saving' | 'done';
type InputMode = 'photo' | 'url';

interface ProductResearch {
  name: string;
  brand: string | null;
  description: string | null;
  category: string;
  price: { amount: number; currency: string; formatted: string; unit: string } | null;
  materials: string[];
  colors: string[];
  dimensions: { width: number | null; height: number | null; depth: number | null; unit: string } | null;
  sku: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  supplier: string | null;
  manufacturerUrl: string | null;
  confidence: number;
  searchSources: string[];
}

interface ManualClipDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onClipCreated?: () => void;
}

const STEP_LABELS: Record<Step, string> = {
  input: 'Upload or Paste URL',
  researching: 'Researching Product',
  review: 'Review Details',
  saving: 'Saving Clip',
  done: 'Complete',
};

// ============================================
// Component
// ============================================

export function ManualClipDialog({ open, onClose, userId, onClipCreated }: ManualClipDialogProps) {
  // Step state
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);

  // Input state
  const [inputMode, setInputMode] = useState<InputMode>('photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState('');
  const [title, setTitle] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Research result (editable)
  const [research, setResearch] = useState<ProductResearch | null>(null);
  const [_uploadedBase64, setUploadedBase64] = useState<string | null>(null);

  // ============================================
  // Handlers
  // ============================================

  const handleFileSelect = useCallback((file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' '));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data:image/...;base64, prefix
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleResearch = useCallback(async () => {
    setError(null);
    setStep('researching');

    try {
      const researchProductFn = httpsCallable<
        { imageBase64?: string; imageMimeType?: string; productUrl?: string; title?: string },
        { success: boolean; research: ProductResearch }
      >(functions, 'researchProduct');

      let payload: { imageBase64?: string; imageMimeType?: string; productUrl?: string; title?: string } = {};

      if (inputMode === 'photo' && selectedFile) {
        const base64 = await fileToBase64(selectedFile);
        setUploadedBase64(base64);
        payload = {
          imageBase64: base64,
          imageMimeType: selectedFile.type,
          title: title || undefined,
        };
      } else if (inputMode === 'url' && productUrl) {
        payload = {
          productUrl,
          title: title || undefined,
        };
      } else {
        setError('Please upload a photo or enter a URL');
        setStep('input');
        return;
      }

      const result = await researchProductFn(payload);

      if (result.data.success && result.data.research) {
        setResearch(result.data.research);
        setStep('review');
      } else {
        throw new Error('Research returned no data');
      }
    } catch (err) {
      console.error('Product research failed:', err);
      setError(err instanceof Error ? err.message : 'Product research failed');
      setStep('input');
    }
  }, [inputMode, selectedFile, productUrl, title]);

  const handleSave = useCallback(async () => {
    if (!research) return;
    setStep('saving');
    setError(null);

    try {
      // Create designClips document matching the extension's format
      const clipData = {
        title: research.name,
        sourceUrl: research.sourceUrl || productUrl || '',
        imageUrl: research.imageUrl || '',
        thumbnailUrl: research.imageUrl || '',
        clipType: 'material',
        analysisStatus: 'completed',
        syncStatus: 'synced',
        uploadSource: 'manual-research',
        createdBy: userId, // Will be overridden with actual UID before save
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),

        // Extracted product data
        brand: research.brand || null,
        description: research.description || null,
        sku: research.sku || null,
        price: research.price || null,
        dimensions: research.dimensions || null,
        materials: research.materials || [],
        colors: research.colors || [],

        // AI analysis summary (for compatibility with ClipReviewQueue)
        aiAnalysis: {
          productType: research.category || 'other',
          primaryMaterials: research.materials || [],
          colors: research.colors || [],
          confidence: research.confidence,
          suggestedTags: [
            research.category,
            research.brand,
            research.supplier,
          ].filter(Boolean),
        },

        // Research metadata
        researchMetadata: {
          supplier: research.supplier || null,
          manufacturerUrl: research.manufacturerUrl || null,
          searchSources: research.searchSources || [],
          confidence: research.confidence,
          researchedAt: new Date().toISOString(),
        },

        tags: [
          research.category,
          research.brand,
          research.supplier,
        ].filter(Boolean) as string[],
      };

      const currentUser = getAuth().currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      // Override createdBy with the actual Firebase Auth UID
      clipData.createdBy = currentUser.uid;
      await addDoc(collection(db, 'designClips'), clipData);

      setStep('done');
    } catch (err) {
      console.error('Failed to save clip:', err);
      setError(err instanceof Error ? err.message : 'Failed to save clip');
      setStep('review');
    }
  }, [research, productUrl, userId]);

  const handleClose = useCallback(() => {
    if (step === 'done' && onClipCreated) {
      onClipCreated();
    }
    // Reset all state
    setStep('input');
    setError(null);
    setInputMode('photo');
    setSelectedFile(null);
    setPreviewUrl(null);
    setProductUrl('');
    setTitle('');
    setResearch(null);
    setUploadedBase64(null);
    onClose();
  }, [step, onClose, onClipCreated]);

  const handleStartOver = useCallback(() => {
    setStep('input');
    setError(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setProductUrl('');
    setTitle('');
    setResearch(null);
    setUploadedBase64(null);
  }, []);

  const updateResearchField = useCallback((field: string, value: unknown) => {
    setResearch((prev) => prev ? { ...prev, [field]: value } : prev);
  }, []);

  if (!open) return null;

  // ============================================
  // Render
  // ============================================

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Manual Product Research</h2>
            <p className="text-xs text-gray-500 mt-0.5">{STEP_LABELS[step]}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-2 border-b border-gray-50">
          <div className="flex items-center gap-2">
            {(['input', 'researching', 'review', 'saving', 'done'] as Step[]).map((s, i) => {
              const steps: Step[] = ['input', 'researching', 'review', 'saving', 'done'];
              const currentIdx = steps.indexOf(step);
              return (
                <div key={s} className="flex items-center flex-1">
                  {i > 0 && (
                    <div className={`flex-1 h-px ${currentIdx >= i ? 'bg-gray-900' : 'bg-gray-200'}`} />
                  )}
                  <div className={`w-2 h-2 rounded-full ${step === s ? 'bg-gray-900 scale-125' : currentIdx > i ? 'bg-gray-900' : 'bg-gray-200'}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-red-700">{error}</p>
                <button onClick={handleStartOver} className="text-xs text-red-600 underline mt-1">
                  Start over
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Input */}
          {step === 'input' && (
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex rounded-lg border border-gray-200 p-1 gap-1">
                <button
                  onClick={() => setInputMode('photo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    inputMode === 'photo' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Upload Photo
                </button>
                <button
                  onClick={() => setInputMode('url')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-colors ${
                    inputMode === 'url' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  Paste URL
                </button>
              </div>

              {/* Photo upload mode */}
              {inputMode === 'photo' && (
                <>
                  {!previewUrl ? (
                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                        dragOver ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-700">Drop a product photo here or click to browse</p>
                      <p className="text-xs text-gray-400 mt-1">JPEG, PNG, or WebP</p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden bg-gray-100 max-h-52 flex items-center justify-center">
                      <img src={previewUrl} alt="Preview" className="max-h-52 object-contain" />
                      <button
                        onClick={() => { setPreviewUrl(null); setSelectedFile(null); setTitle(''); }}
                        className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* URL mode */}
              {inputMode === 'url' && (
                <div>
                  <Label className="text-xs font-medium text-gray-600 mb-1">Product Page URL</Label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="url"
                      value={productUrl}
                      onChange={(e) => setProductUrl(e.target.value)}
                      placeholder="https://www.supplier.com/product/..."
                      className="pl-9"
                    />
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <Label className="text-xs font-medium text-gray-600 mb-1">Product Name (optional)</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Blum Tandembox Antaro Drawer System"
                />
              </div>

              {/* Action */}
              <button
                onClick={handleResearch}
                disabled={inputMode === 'photo' ? !selectedFile : !productUrl}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Search className="w-4 h-4" />
                Research Product
              </button>
            </div>
          )}

          {/* Step 2: Researching */}
          {step === 'researching' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="p-4 bg-blue-50 rounded-full">
                  <Search className="w-8 h-8 text-blue-500 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Researching product details...</p>
                <p className="text-xs text-gray-400 mt-1">
                  Using Google Search + AI to find pricing, materials, and specifications
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && research && (
            <div className="space-y-4">
              {/* Confidence badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium text-gray-700">AI Research Results</span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    research.confidence >= 0.8
                      ? 'text-green-700 bg-green-50 border-green-200'
                      : research.confidence >= 0.5
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-red-700 bg-red-50 border-red-200'
                  }`}
                >
                  {Math.round(research.confidence * 100)}% confidence
                </Badge>
              </div>

              {/* Image preview */}
              {(research.imageUrl || previewUrl) && (
                <div className="rounded-lg overflow-hidden bg-gray-100 max-h-40 flex items-center justify-center">
                  <img
                    src={research.imageUrl || previewUrl || ''}
                    alt={research.name}
                    className="max-h-40 object-contain"
                  />
                </div>
              )}

              {/* Editable fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Product Name</Label>
                  <Input
                    value={research.name}
                    onChange={(e) => updateResearchField('name', e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs text-gray-500">Brand</Label>
                  <Input
                    value={research.brand || ''}
                    onChange={(e) => updateResearchField('brand', e.target.value || null)}
                  />
                </div>

                <div>
                  <Label className="text-xs text-gray-500">SKU</Label>
                  <Input
                    value={research.sku || ''}
                    onChange={(e) => updateResearchField('sku', e.target.value || null)}
                  />
                </div>

                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Description</Label>
                  <Textarea
                    value={research.description || ''}
                    onChange={(e) => updateResearchField('description', e.target.value || null)}
                    rows={2}
                  />
                </div>

                {/* Price */}
                <div>
                  <Label className="text-xs text-gray-500">Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={research.price?.amount ?? ''}
                    onChange={(e) => {
                      const amount = e.target.value ? parseFloat(e.target.value) : null;
                      updateResearchField('price', amount ? {
                        ...research.price,
                        amount,
                        formatted: `${research.price?.currency || 'USD'} ${amount.toFixed(2)}`,
                      } : null);
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Currency</Label>
                  <Input
                    value={research.price?.currency || 'USD'}
                    onChange={(e) =>
                      updateResearchField('price', {
                        ...research.price,
                        currency: e.target.value,
                        formatted: `${e.target.value} ${research.price?.amount ?? 0}`,
                      })
                    }
                  />
                </div>

                {/* Dimensions */}
                <div>
                  <Label className="text-xs text-gray-500">Width (mm)</Label>
                  <Input
                    type="number"
                    value={research.dimensions?.width ?? ''}
                    onChange={(e) =>
                      updateResearchField('dimensions', {
                        ...research.dimensions,
                        width: e.target.value ? parseFloat(e.target.value) : null,
                        unit: 'mm',
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Height (mm)</Label>
                  <Input
                    type="number"
                    value={research.dimensions?.height ?? ''}
                    onChange={(e) =>
                      updateResearchField('dimensions', {
                        ...research.dimensions,
                        height: e.target.value ? parseFloat(e.target.value) : null,
                        unit: 'mm',
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Depth (mm)</Label>
                  <Input
                    type="number"
                    value={research.dimensions?.depth ?? ''}
                    onChange={(e) =>
                      updateResearchField('dimensions', {
                        ...research.dimensions,
                        depth: e.target.value ? parseFloat(e.target.value) : null,
                        unit: 'mm',
                      })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Supplier</Label>
                  <Input
                    value={research.supplier || ''}
                    onChange={(e) => updateResearchField('supplier', e.target.value || null)}
                  />
                </div>

                {/* Materials */}
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Materials (comma-separated)</Label>
                  <Input
                    value={research.materials.join(', ')}
                    onChange={(e) =>
                      updateResearchField('materials', e.target.value.split(',').map((m) => m.trim()).filter(Boolean))
                    }
                  />
                </div>

                {/* Source URL */}
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Source URL</Label>
                  <Input
                    value={research.sourceUrl || ''}
                    onChange={(e) => updateResearchField('sourceUrl', e.target.value || null)}
                  />
                </div>
              </div>

              {/* Sources */}
              {research.searchSources.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Sources used:</p>
                  <div className="flex flex-wrap gap-1">
                    {research.searchSources.slice(0, 3).map((src, i) => (
                      <a
                        key={i}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline truncate max-w-[200px]"
                      >
                        {new URL(src).hostname}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Save as Material Clip
                </button>
                <button
                  onClick={handleStartOver}
                  className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Saving */}
          {step === 'saving' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              <p className="text-sm text-gray-500">Saving clip...</p>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6">
                <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
                <p className="text-sm font-medium text-gray-700">Material clip saved</p>
                <p className="text-xs text-gray-400 mt-1">
                  It's now in your Clip Review Queue ready for conversion to the Material Library.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={handleStartOver}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Add Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
