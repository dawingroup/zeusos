/**
 * BOQ Import Page
 * Upload, parse, review, and import BOQ items
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/layout/PageHeader';
import { 
  Upload, 
  FileSpreadsheet, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  X,
  FileText,
  FileUp,
  FileSearch,
  Sparkles,
  Database,
  Check,
  History,
  Wand2,
  Eye,
  Trash2,
  Brain,
} from 'lucide-react';
import { useBOQParsing } from '../hooks/useBOQParsing';
import { BOQItemReview } from '../components/BOQItemReview';
import { cleanupBOQItems, type CleanedBOQItem } from '../ai/boqCleanupService';

// Parsing stages with descriptions
const PARSING_STAGES = [
  { id: 'upload', label: 'Uploading', description: 'Uploading file to server', icon: FileUp },
  { id: 'analyze', label: 'Analyzing', description: 'Analyzing file structure', icon: FileSearch },
  { id: 'extract', label: 'Extracting', description: 'Extracting BOQ items with AI', icon: Sparkles },
  { id: 'match', label: 'Matching', description: 'Matching to material library', icon: Database },
  { id: 'complete', label: 'Complete', description: 'Ready for review', icon: Check },
];

type ViewMode = 'upload' | 'review' | 'history';

const BOQImport: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [historyItemsToReview, setHistoryItemsToReview] = useState<CleanedBOQItem[]>([]);
  const [isCleaningHistory, setIsCleaningHistory] = useState(false);
  
  const {
    activeJob,
    isProcessing,
    isUploading,
    isCleaning,
    isEnhancing,
    progress,
    parsedItems,
    cleanedItems,
    cleanupStats,
    parsingHistory,
    error,
    startParsing,
    importCleanedItems,
    runCleanup,
    runAIEnhancement,
    clearActiveJob,
    refreshHistory,
    deleteHistoryJob,
  } = useBOQParsing({ projectId: projectId || '' });

  // Load history on mount
  useEffect(() => {
    console.log('Loading parsing history...');
    refreshHistory();
  }, [refreshHistory]);

  // Debug: log parsingHistory changes
  useEffect(() => {
    console.log('Parsing history updated:', parsingHistory.length, 'jobs');
    parsingHistory.forEach((job, i) => {
      console.log(`Job ${i}:`, {
        id: job.id,
        fileName: job.fileName,
        status: job.status,
        hasParsedItems: !!job.parsedItems,
        parsedItemsLength: job.parsedItems?.length || 0,
        keys: Object.keys(job)
      });
    });
  }, [parsingHistory]);

  // Auto-run cleanup when parsing completes
  useEffect(() => {
    if (activeJob?.status === 'completed' && parsedItems.length > 0 && cleanedItems.length === 0) {
      runCleanup();
    }
  }, [activeJob?.status, parsedItems.length, cleanedItems.length, runCleanup]);

  // Switch to review mode when cleanup completes
  useEffect(() => {
    if (cleanedItems.length > 0) {
      setViewMode('review');
    }
  }, [cleanedItems.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv', '.pdf'];
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(extension)) {
      alert('Please upload a valid BOQ file (.xlsx, .xls, .csv, or .pdf)');
      return;
    }
    
    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      await startParsing(selectedFile);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    clearActiveJob();
    setImportSuccess(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportCleanedItems = async (items: CleanedBOQItem[]) => {
    console.log('handleImportCleanedItems called with', items?.length, 'items');
    
    if (!items || items.length === 0) {
      console.error('No items to import');
      alert('No items to import. Please select at least one item.');
      return;
    }
    
    setIsImporting(true);
    try {
      const importedIds = await importCleanedItems(items);
      console.log('Import result:', importedIds);
      
      if (importedIds && importedIds.length > 0) {
        setImportSuccess(true);
        // Navigate to project after short delay
        setTimeout(() => {
          navigate(`/advisory/matflow/projects/${projectId}`);
        }, 1500);
      } else {
        console.warn('Import returned empty or no IDs');
        alert('Import completed but no items were imported. Check console for details.');
      }
    } catch (err) {
      console.error('Import failed:', err);
      alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleViewHistory = async (jobId: string) => {
    console.log('handleViewHistory called with jobId:', jobId);
    
    // Find the job in history
    const job = parsingHistory.find(j => j.id === jobId);
    console.log('Found job:', job);
    
    if (!job) {
      alert('Job not found in history');
      return;
    }
    
    if (!job.parsedItems || job.parsedItems.length === 0) {
      alert(`No items found in this parsing job. Status: ${job.status}`);
      return;
    }
    
    console.log('Processing', job.parsedItems.length, 'items from history');
    setIsCleaningHistory(true);
    
    try {
      // Run cleanup on historical items
      const result = await cleanupBOQItems(job.parsedItems);
      console.log('Cleanup result:', result.cleanedItems.length, 'cleaned items');
      setHistoryItemsToReview(result.cleanedItems);
      setViewMode('review');
    } catch (err) {
      console.error('Failed to cleanup historical items:', err);
      alert('Failed to process items. Please try again.');
    } finally {
      setIsCleaningHistory(false);
    }
  };

  const handleBackToUpload = () => {
    setViewMode('upload');
    clearActiveJob();
    setSelectedFile(null);
    setImportSuccess(false);
    setHistoryItemsToReview([]);
  };

  // Determine current stage based on progress
  const getCurrentStage = () => {
    if (!activeJob && !isUploading) return -1;
    if (isUploading) return 0;
    if (!activeJob) return -1;
    
    if (activeJob.status === 'completed') return 4;
    if (activeJob.status === 'failed') return -1;
    
    // Map progress percentage to stages
    if (progress < 15) return 1; // Analyzing
    if (progress < 60) return 2; // Extracting
    if (progress < 90) return 3; // Matching
    return 3;
  };

  const currentStage = getCurrentStage();

  const getStatusMessage = () => {
    if (!activeJob && !isUploading) return null;
    if (isUploading) return 'Uploading file...';
    if (!activeJob) return null;
    
    switch (activeJob.status) {
      case 'pending':
        return 'Preparing to parse...';
      case 'processing':
        const stage = PARSING_STAGES[currentStage];
        return stage ? `${stage.description}...` : `Processing... ${progress}%`;
      case 'completed':
        return `Successfully parsed ${parsedItems.length} items!`;
      case 'failed':
        return error || 'Parsing failed';
      default:
        return activeJob.status;
    }
  };

  return (
    <div>
      <PageHeader
        title="Import BOQ"
        description="Upload and parse Bill of Quantities from Excel or PDF"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Projects', href: '/advisory/matflow/projects' },
          { label: 'Project', href: `/advisory/matflow/projects/${projectId}` },
          { label: 'Import BOQ' },
        ]}
      />

      {/* View Mode Tabs */}
      <div className="px-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setViewMode('upload')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'upload' || viewMode === 'review'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Upload & Parse
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'history'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Parsing History ({parsingHistory.length})
          </button>
        </div>
      </div>

      {/* Review Mode */}
      {viewMode === 'review' && (cleanedItems.length > 0 || historyItemsToReview.length > 0) && (
        <div className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-500" />
                Review Parsed Items
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {cleanupStats ? (
                  <>
                    {cleanupStats.totalCleaned} items ready • 
                    {cleanupStats.summaryRowsRemoved} summary rows removed • 
                    {cleanupStats.formulasMatched} formulas matched • 
                    Avg confidence: {(cleanupStats.avgConfidence * 100).toFixed(0)}%
                  </>
                ) : (
                  `${(cleanedItems.length || historyItemsToReview.length)} items ready for review`
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {cleanedItems.length > 0 && !isEnhancing && (
                <button
                  onClick={runAIEnhancement}
                  disabled={isEnhancing}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  <Brain className="w-4 h-4" />
                  Enhance with AI
                </button>
              )}
              {isEnhancing && (
                <div className="flex items-center gap-2 text-sm text-indigo-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI classifying items...
                </div>
              )}
              <button
                onClick={handleBackToUpload}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                ← Back to Upload
              </button>
            </div>
          </div>
          
          {importSuccess ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-green-900">Import Successful!</h3>
              <p className="text-green-700 mt-1">Redirecting to project...</p>
            </div>
          ) : (
            <BOQItemReview
              items={cleanedItems.length > 0 ? cleanedItems : historyItemsToReview}
              onImport={handleImportCleanedItems}
              isReadOnly={isImporting}
            />
          )}
        </div>
      )}

      {/* History Mode */}
      {viewMode === 'history' && (
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Parsing History</h2>
          
          {parsingHistory.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No parsing jobs yet</p>
              <button
                onClick={() => setViewMode('upload')}
                className="mt-3 text-amber-600 hover:text-amber-700"
              >
                Upload a BOQ file to get started
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {parsingHistory.map((job) => (
                <div
                  key={job.id}
                  className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-8 h-8 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{job.fileName}</p>
                        <p className="text-sm text-gray-500">
                          {job.parsedItems?.length || 0} items • 
                          {job.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        job.status === 'completed' ? 'bg-green-100 text-green-700' :
                        job.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {job.status}
                      </span>
                      {job.status === 'completed' && (
                        job.parsedItems && job.parsedItems.length > 0 ? (
                          <button
                            onClick={() => handleViewHistory(job.id)}
                            disabled={isCleaningHistory}
                            className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1"
                          >
                            {isCleaningHistory ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                            Review
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">No items parsed</span>
                        )
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Delete this parsing job? This cannot be undone.')) {
                            deleteHistoryJob(job.id);
                          }
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Upload Mode */}
      {(viewMode === 'upload' && cleanedItems.length === 0) && (
      <div className="p-6 max-w-3xl">
        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-700 font-medium">Upload Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Upload Area */}
        <div
          className={`bg-white rounded-lg border-2 border-dashed p-12 text-center transition-colors ${
            isDragging 
              ? 'border-amber-500 bg-amber-50' 
              : selectedFile 
                ? 'border-green-300 bg-green-50' 
                : 'border-gray-200 hover:border-gray-300'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.pdf"
            onChange={handleInputChange}
            className="hidden"
          />
          
          {!selectedFile ? (
            <>
              <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload BOQ File</h3>
              <p className="text-gray-500 mb-4">Drag and drop or click to upload</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                Select File
              </button>
              <p className="text-sm text-gray-400 mt-4">Supported: .xlsx, .xls, .csv, .pdf</p>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="w-10 h-10 text-green-600" />
                <div className="text-left">
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {!isProcessing && !activeJob && (
                  <button
                    onClick={handleClear}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              
              {/* Enhanced Progress UI */}
              {(isProcessing || isUploading || activeJob?.status === 'completed') && (
                <div className="w-full max-w-md mx-auto space-y-4">
                  {/* Stage Indicators */}
                  <div className="flex items-center justify-between">
                    {PARSING_STAGES.map((stage, index) => {
                      const StageIcon = stage.icon;
                      const isActive = currentStage === index;
                      const isComplete = currentStage > index || activeJob?.status === 'completed';
                      const isFailed = activeJob?.status === 'failed' && currentStage === index;
                      
                      return (
                        <div key={stage.id} className="flex flex-col items-center">
                          <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                            ${isComplete ? 'bg-green-100 text-green-600' :
                              isActive ? 'bg-amber-100 text-amber-600' :
                              isFailed ? 'bg-red-100 text-red-600' :
                              'bg-gray-100 text-gray-400'}
                          `}>
                            {isActive && !isComplete ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isComplete ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : isFailed ? (
                              <AlertCircle className="w-5 h-5" />
                            ) : (
                              <StageIcon className="w-5 h-5" />
                            )}
                          </div>
                          <span className={`text-xs mt-1 font-medium ${
                            isComplete ? 'text-green-600' :
                            isActive ? 'text-amber-600' :
                            isFailed ? 'text-red-600' :
                            'text-gray-400'
                          }`}>
                            {stage.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Connecting Lines */}
                  <div className="relative -mt-12 mx-5">
                    <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
                    <div 
                      className="absolute top-5 left-0 h-0.5 bg-green-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (currentStage / 4) * 100)}%` }}
                    />
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="pt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{getStatusMessage()}</span>
                      <span>{activeJob?.status === 'completed' ? '100%' : `${progress}%`}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          activeJob?.status === 'completed' ? 'bg-green-500' :
                          activeJob?.status === 'failed' ? 'bg-red-500' :
                          'bg-amber-500'
                        }`}
                        style={{ width: `${activeJob?.status === 'completed' ? 100 : progress}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Parsed Items Preview */}
                  {activeJob?.status === 'completed' && parsedItems.length > 0 && !isCleaning && cleanedItems.length === 0 && (
                    <div className="bg-green-50 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 text-green-700 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Parsing Complete!
                      </div>
                      <p className="text-green-600 mt-1">
                        Found {parsedItems.length} BOQ items. Starting AI cleanup...
                      </p>
                    </div>
                  )}
                  
                  {/* AI Cleanup Progress Panel */}
                  {isCleaning && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <Wand2 className="w-4 h-4 text-purple-600 animate-pulse" />
                        </div>
                        <div>
                          <div className="font-medium text-purple-900">AI Cleanup in Progress</div>
                          <div className="text-xs text-purple-600">Processing {parsedItems.length} items...</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-xs text-purple-700">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Parsing hierarchy (Bill → Element → Section → Work Item)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Extracting names from descriptions</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Matching formulas & calculating material requirements</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Extracting governing specifications</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Identifying items needing enhancement</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Cleanup Complete */}
                  {cleanedItems.length > 0 && cleanupStats && (
                    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 text-sm">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-teal-600" />
                        </div>
                        <div>
                          <div className="font-medium text-teal-900">AI Cleanup Complete!</div>
                          <div className="text-xs text-teal-600">BOQ structured and ready for review</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white rounded p-2 text-center">
                          <div className="font-bold text-teal-700">{cleanupStats.totalCleaned}</div>
                          <div className="text-teal-600">Total Items</div>
                        </div>
                        <div className="bg-white rounded p-2 text-center">
                          <div className="font-bold text-blue-700">{cleanupStats.workItems || 0}</div>
                          <div className="text-blue-600">Work Items</div>
                        </div>
                        <div className="bg-white rounded p-2 text-center">
                          <div className="font-bold text-purple-700">{cleanupStats.formulasMatched}</div>
                          <div className="text-purple-600">Formulas Matched</div>
                        </div>
                        <div className="bg-white rounded p-2 text-center">
                          <div className="font-bold text-orange-700">{cleanupStats.needsEnhancement || 0}</div>
                          <div className="text-orange-600">Need Enhancement</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Error Display */}
                  {activeJob?.status === 'failed' && (
                    <div className="bg-red-50 rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 text-red-700 font-medium">
                        <AlertCircle className="w-4 h-4" />
                        Parsing Failed
                      </div>
                      <p className="text-red-600 mt-1">
                        {error || 'An error occurred during parsing. Please try again.'}
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {!activeJob && (
                  <button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Start Parsing
                      </>
                    )}
                  </button>
                )}
                
                {activeJob?.status === 'completed' && parsedItems.length > 0 && !isCleaning && (
                  <button
                    onClick={runCleanup}
                    disabled={isCleaning}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isCleaning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Cleaning up...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4" />
                        Review & Clean {parsedItems.length} Items
                      </>
                    )}
                  </button>
                )}
                
                {importSuccess && (
                  <div className="flex items-center gap-2 text-green-600 font-medium">
                    <CheckCircle2 className="w-5 h-5" />
                    Successfully imported! Redirecting...
                  </div>
                )}
                
                {(activeJob?.status === 'completed' || activeJob?.status === 'failed') && (
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  >
                    Upload Another
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg border border-blue-200 p-4">
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            BOQ Format Guidelines
          </h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Excel files should have headers: Item No, Description, Unit, Qty, Rate, Amount</li>
            <li>• Multiple sheets are supported - BOQ items will be extracted from all sheets</li>
            <li>• PDF files will be processed using AI extraction (may take longer)</li>
            <li>• Items will be matched to materials in your library automatically</li>
          </ul>
        </div>
      </div>
      )}
    </div>
  );
};

export default BOQImport;
