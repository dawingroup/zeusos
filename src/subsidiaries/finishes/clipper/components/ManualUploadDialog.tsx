/**
 * ManualUploadDialog Component
 * Multi-step modal for uploading a client photo, finding a clearer version
 * via reverse image search, and running AI analysis.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  Search,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Image,
  ArrowRight,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { useManualUpload, type UploadStep } from '../hooks/useManualUpload';
import { SearchResultCard } from './SearchResultCard';

interface ManualUploadDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  designItemId?: string;
  onClipCreated?: (clipId: string) => void;
}

const STEP_LABELS: Record<UploadStep, string> = {
  upload: 'Upload Photo',
  searching: 'Searching Web',
  'select-result': 'Select Best Image',
  analyzing: 'Analyzing',
  complete: 'Complete',
};

export const ManualUploadDialog: React.FC<ManualUploadDialogProps> = ({
  open,
  onClose,
  projectId,
  designItemId,
  onClipCreated,
}) => {
  const {
    step,
    error,
    uploadPhoto,
    searchResults,
    webEntities,
    bestGuessLabels,
    isSearching: _isSearching,
    selectedResult,
    selectResult,
    useOriginal,
    confirmAndAnalyze,
    isAnalyzing: _isAnalyzing,
    analysisResult,
    createdClipId: _createdClipId,
    skipSearch: _skipSearch,
    reset,
  } = useManualUpload({ projectId, designItemId });

  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      return;
    }
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

  const handleUploadAndSearch = useCallback(async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    await uploadPhoto(selectedFile, title);
    setIsUploading(false);
  }, [selectedFile, title, uploadPhoto]);

  const handleSkipSearch = useCallback(async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    // Upload first, then skip search
    await uploadPhoto(selectedFile, title);
    // After upload completes, the hook transitions to searching/select-result
    // We need to call skipSearch which will use original and analyze
    setIsUploading(false);
  }, [selectedFile, title, uploadPhoto]);

  const handleConfirm = useCallback(async () => {
    const clipId = await confirmAndAnalyze();
    if (clipId && onClipCreated) {
      onClipCreated(clipId);
    }
  }, [confirmAndAnalyze, onClipCreated]);

  const handleClose = useCallback(() => {
    reset();
    setPreviewUrl(null);
    setSelectedFile(null);
    setTitle('');
    setIsUploading(false);
    onClose();
  }, [reset, onClose]);

  const handleStartOver = useCallback(() => {
    reset();
    setPreviewUrl(null);
    setSelectedFile(null);
    setTitle('');
    setIsUploading(false);
  }, [reset]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Upload Inspiration Photo</h2>
            <p className="text-xs text-gray-500 mt-0.5">{STEP_LABELS[step]}</p>
          </div>
          <button onClick={handleClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-2 border-b border-gray-50">
          <div className="flex items-center gap-2">
            {(['upload', 'searching', 'select-result', 'analyzing', 'complete'] as UploadStep[]).map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <div className={`flex-1 h-px ${step === s || ['searching', 'select-result', 'analyzing', 'complete'].indexOf(step) >= ['searching', 'select-result', 'analyzing', 'complete'].indexOf(s) ? 'bg-[#1d1d1f]' : 'bg-gray-200'}`} />}
                <div className={`w-2 h-2 rounded-full ${step === s ? 'bg-[#1d1d1f] scale-125' : (['upload', 'searching', 'select-result', 'analyzing', 'complete'].indexOf(step) > i ? 'bg-[#1d1d1f]' : 'bg-gray-200')}`} />
              </React.Fragment>
            ))}
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

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {!previewUrl ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
                    ${dragOver ? 'border-[#1d1d1f] bg-gray-50' : 'border-gray-300 hover:border-gray-400'}
                  `}
                >
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700">
                    Drop a photo here or click to browse
                  </p>
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
                <div className="space-y-4">
                  {/* Preview */}
                  <div className="relative rounded-xl overflow-hidden bg-gray-100 max-h-64 flex items-center justify-center">
                    <img src={previewUrl} alt="Preview" className="max-h-64 object-contain" />
                    <button
                      onClick={() => {
                        setPreviewUrl(null);
                        setSelectedFile(null);
                        setTitle('');
                      }}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>

                  {/* Title input */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Title (optional)</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Client's kitchen island reference"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1d1d1f] focus:border-transparent"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleUploadAndSearch}
                      disabled={isUploading}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:bg-black disabled:opacity-50 transition-colors"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Upload & Find Clearer Version
                    </button>
                    <button
                      onClick={handleSkipSearch}
                      disabled={isUploading}
                      className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Skip Search
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Searching */}
          {step === 'searching' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                {previewUrl && (
                  <img src={previewUrl} alt="Uploaded" className="w-24 h-24 object-cover rounded-xl" />
                )}
                <div className="absolute -bottom-2 -right-2 p-1.5 bg-white rounded-full shadow-md">
                  <Loader2 className="w-5 h-5 text-[#1d1d1f] animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Searching the web for similar images...</p>
                <p className="text-xs text-gray-400 mt-1">Finding clearer, higher-quality versions</p>
              </div>
            </div>
          )}

          {/* Step 3: Select Result */}
          {step === 'select-result' && (
            <div className="space-y-4">
              {/* Web entities / labels */}
              {(bestGuessLabels.length > 0 || webEntities.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {bestGuessLabels.map((label) => (
                    <span key={label} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                      {label}
                    </span>
                  ))}
                  {webEntities.slice(0, 5).map((e) => (
                    <span key={e.description} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {e.description}
                    </span>
                  ))}
                </div>
              )}

              {searchResults.length > 0 ? (
                <>
                  <p className="text-sm text-gray-600">
                    Found {searchResults.length} similar images. Select the clearest one:
                  </p>

                  {/* Results grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {/* Original image option */}
                    <button
                      type="button"
                      onClick={useOriginal}
                      className={`
                        relative rounded-lg overflow-hidden border-2 transition-all text-left
                        ${!selectedResult
                          ? 'border-[#1d1d1f] ring-2 ring-[#1d1d1f] ring-offset-1'
                          : 'border-gray-200 hover:border-gray-400'
                        }
                      `}
                    >
                      <div className="aspect-square bg-gray-100 overflow-hidden">
                        {previewUrl && (
                          <img src={previewUrl} alt="Original" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="p-2 bg-white">
                        <p className="text-xs text-gray-700 font-medium">Use Original</p>
                        <p className="text-[10px] text-gray-400">Client's photo</p>
                      </div>
                      {!selectedResult && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-[#1d1d1f] rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute top-2 left-2 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Original
                      </div>
                    </button>

                    {/* Search results */}
                    {searchResults.map((match, idx) => (
                      <SearchResultCard
                        key={`${match.url}-${idx}`}
                        match={match}
                        selected={selectedResult?.url === match.url}
                        onSelect={() => selectResult(match)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Image className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 font-medium">No similar images found online</p>
                  <p className="text-xs text-gray-400 mt-1">We'll analyze your original photo instead</p>
                </div>
              )}

              {/* Confirm button */}
              <div className="pt-2">
                <button
                  onClick={handleConfirm}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  {selectedResult ? 'Use Selected & Analyze' : 'Use Original & Analyze'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Analyzing */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="p-4 bg-purple-50 rounded-full">
                <Sparkles className="w-8 h-8 text-purple-500 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Running AI analysis...</p>
                <p className="text-xs text-gray-400 mt-1">
                  Identifying materials, style, and manufacturing potential
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6">
                <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
                <p className="text-sm font-medium text-gray-700">Inspiration clip saved</p>
              </div>

              {/* Analysis summary */}
              {analysisResult && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">AI Analysis</h4>

                  {analysisResult.productType && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Type:</span>
                      <span className="text-sm text-gray-800 font-medium">{analysisResult.productType}</span>
                    </div>
                  )}

                  {analysisResult.style && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Style:</span>
                      <span className="text-sm text-gray-800">{analysisResult.style}</span>
                    </div>
                  )}

                  {analysisResult.primaryMaterials && analysisResult.primaryMaterials.length > 0 && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-gray-500 mt-0.5">Materials:</span>
                      <div className="flex flex-wrap gap-1">
                        {analysisResult.primaryMaterials.map((m) => (
                          <span key={m} className="px-2 py-0.5 bg-white border border-gray-200 text-xs rounded-full text-gray-700">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysisResult.millworkAssessment && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Complexity:</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        analysisResult.millworkAssessment.complexity === 'simple' ? 'bg-green-100 text-green-700' :
                        analysisResult.millworkAssessment.complexity === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
                        analysisResult.millworkAssessment.complexity === 'complex' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {analysisResult.millworkAssessment.complexity}
                      </span>
                    </div>
                  )}

                  {analysisResult.colors && analysisResult.colors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Colors:</span>
                      <div className="flex gap-1">
                        {analysisResult.colors.slice(0, 5).map((color) => (
                          <div
                            key={color}
                            className="w-5 h-5 rounded-full border border-gray-200"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-[#1d1d1f] text-white text-sm font-medium rounded-lg hover:bg-black transition-colors"
                >
                  Done
                </button>
                <button
                  onClick={handleStartOver}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Upload Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
