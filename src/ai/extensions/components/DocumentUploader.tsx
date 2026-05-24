/**
 * DocumentUploader Component
 * Document upload with AI analysis
 */

import React, { useState, useCallback } from 'react';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
  Download,
  FileSpreadsheet,
  FileImage,
} from 'lucide-react';
import { DocumentAnalysis, DocumentType, ExtractedField } from '../types/ai-extensions';

interface DocumentUploaderProps {
  onAnalysisComplete: (analysis: DocumentAnalysis) => void;
  onFileSelect?: (file: File) => void;
  acceptedTypes?: string[];
  maxSizeMB?: number;
}

const DOCUMENT_TYPE_ICONS: Record<DocumentType, React.ReactNode> = {
  ipc: <FileText className="w-5 h-5" />,
  requisition: <FileText className="w-5 h-5" />,
  boq: <FileSpreadsheet className="w-5 h-5" />,
  contract: <FileText className="w-5 h-5" />,
  valuation: <FileText className="w-5 h-5" />,
  report: <FileText className="w-5 h-5" />,
  invoice: <FileText className="w-5 h-5" />,
  certificate: <FileText className="w-5 h-5" />,
  letter: <FileText className="w-5 h-5" />,
  unknown: <FileText className="w-5 h-5" />,
};

export const DocumentUploader: React.FC<DocumentUploaderProps> = ({
  onAnalysisComplete,
  onFileSelect,
  acceptedTypes = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.xls', '.csv'],
  maxSizeMB = 10,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

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

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelection(file);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  }, []);

  const handleFileSelection = async (file: File) => {
    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMB}MB limit`);
      return;
    }

    // Validate file type
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!acceptedTypes.includes(ext)) {
      setError(`File type ${ext} not supported`);
      return;
    }

    setSelectedFile(file);
    setError(null);
    onFileSelect?.(file);

    // Start analysis
    await analyzeDocument(file);
  };

  const analyzeDocument = async (file: File) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Read file content (for text-based files)
      const content = await readFileContent(file);

      // In production, this would call the document intelligence service
      // For now, simulate analysis
      const mockAnalysis: DocumentAnalysis = {
        id: `analysis_${Date.now()}`,
        documentId: file.name,
        documentType: detectDocumentType(file.name, content),
        extractedFields: extractMockFields(content),
        extractedTables: [],
        extractedAmounts: extractMockAmounts(content),
        extractedDates: [],
        extractedReferences: [],
        confidence: 0.85,
        suggestedModule: 'infrastructure',
        suggestedEntityType: 'project',
        validationResults: [],
        analyzedAt: new Date(),
        processingTime: 1500,
        modelVersion: '1.0.0',
      };

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setAnalysis(mockAnalysis);
      onAnalysisComplete(mockAnalysis);
    } catch (err) {
      setError('Failed to analyze document');
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const detectDocumentType = (filename: string, content: string): DocumentType => {
    const lower = (filename + content).toLowerCase();
    if (lower.includes('ipc') || lower.includes('interim payment')) return 'ipc';
    if (lower.includes('requisition')) return 'requisition';
    if (lower.includes('boq') || lower.includes('bill of quantities')) return 'boq';
    if (lower.includes('contract')) return 'contract';
    if (lower.includes('invoice')) return 'invoice';
    if (lower.includes('valuation')) return 'valuation';
    return 'unknown';
  };

  const extractMockFields = (content: string): ExtractedField[] => {
    const fields: ExtractedField[] = [];
    
    // Extract project reference
    const projectMatch = content.match(/project[:\s]*([A-Z0-9/-]+)/i);
    if (projectMatch) {
      fields.push({
        name: 'projectReference',
        value: projectMatch[1],
        confidence: 0.8,
      });
    }

    return fields;
  };

  const extractMockAmounts = (content: string): { label: string; amount: number; currency: string; confidence: number }[] => {
    const amounts: { label: string; amount: number; currency: string; confidence: number }[] = [];
    
    const amountMatch = content.match(/total[:\s]*([\d,]+)/i);
    if (amountMatch) {
      amounts.push({
        label: 'total',
        amount: parseFloat(amountMatch[1].replace(/,/g, '')),
        currency: 'UGX',
        confidence: 0.75,
      });
    }

    return amounts;
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setAnalysis(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      {!selectedFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
            isDragging
              ? 'border-[var(--rag-blue)] bg-[var(--rag-blue-soft)]'
              : 'border-[var(--border-subtle)] hover:border-[var(--border-default)]'
          }`}
        >
          <input
            type="file"
            accept={acceptedTypes.join(',')}
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragging ? 'text-[var(--rag-blue)]' : 'text-[var(--fg-tertiary)]'}`} />
          <p className="text-sm font-medium text-muted-foreground">
            Drop a document here or click to upload
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Supports PDF, images, and spreadsheets (max {maxSizeMB}MB)
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg text-[var(--rag-red)]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-[var(--rag-red-soft)] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected File */}
      {selectedFile && (
        <div className="bg-card border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          {/* File Header */}
          <div className="flex items-center gap-3 p-4 border-b border-[var(--border-subtle)]">
            <div className="p-2 bg-[var(--bg-sunken)] rounded-lg text-muted-foreground">
              {selectedFile.type.includes('image') ? (
                <FileImage className="w-5 h-5" />
              ) : selectedFile.type.includes('spreadsheet') || selectedFile.name.endsWith('.xlsx') ? (
                <FileSpreadsheet className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            {!isAnalyzing && (
              <button
                onClick={clearSelection}
                className="p-1.5 text-[var(--fg-tertiary)] hover:text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Analysis Status */}
          {isAnalyzing && (
            <div className="p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--rag-blue)]" />
              <div>
                <p className="text-sm font-medium text-foreground">Analyzing document...</p>
                <p className="text-xs text-muted-foreground">Extracting data and classifying content</p>
              </div>
            </div>
          )}

          {/* Analysis Results */}
          {analysis && !isAnalyzing && (
            <div className="p-4 space-y-4">
              {/* Document Type */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--rag-green-soft)] rounded-lg text-[var(--rag-green)]">
                  {DOCUMENT_TYPE_ICONS[analysis.documentType]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground capitalize">
                      {analysis.documentType.replace('_', ' ')}
                    </p>
                    <CheckCircle className="w-4 h-4 text-[var(--rag-green)]" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(analysis.confidence * 100)}% confidence
                  </p>
                </div>
              </div>

              {/* Extracted Fields */}
              {analysis.extractedFields.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    Extracted Fields
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {analysis.extractedFields.map((field, i) => (
                      <div key={i} className="p-2 bg-[var(--bg-sunken)] rounded-lg">
                        <p className="text-xs text-muted-foreground">{field.name}</p>
                        <p className="text-sm font-medium text-foreground truncate">
                          {String(field.value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Extracted Amounts */}
              {analysis.extractedAmounts.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    Extracted Amounts
                  </h4>
                  <div className="space-y-2">
                    {analysis.extractedAmounts.map((amount, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[var(--bg-sunken)] rounded-lg">
                        <span className="text-sm text-muted-foreground capitalize">{amount.label}</span>
                        <span className="text-sm font-medium text-foreground">
                          {amount.currency} {amount.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Module */}
              <div className="pt-3 border-t border-[var(--border-subtle)]">
                <p className="text-xs text-muted-foreground mb-2">Suggested destination</p>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-xs font-medium bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] rounded">
                    {analysis.suggestedModule}
                  </span>
                  <span className="text-xs text-[var(--fg-tertiary)]">→</span>
                  <span className="px-2 py-1 text-xs font-medium bg-[var(--bg-sunken)] text-muted-foreground rounded">
                    {analysis.suggestedEntityType}
                  </span>
                </div>
              </div>

              {/* Validation Results */}
              {analysis.validationResults.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    Validation
                  </h4>
                  <div className="space-y-1">
                    {analysis.validationResults.map((result, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-sm ${
                          result.status === 'error'
                            ? 'text-[var(--rag-red)]'
                            : result.status === 'warning'
                            ? 'text-[var(--rag-amber)]'
                            : 'text-[var(--rag-green)]'
                        }`}
                      >
                        {result.status === 'valid' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <AlertCircle className="w-4 h-4" />
                        )}
                        {result.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <button className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--rag-blue)] hover:bg-[var(--rag-blue)] rounded-lg transition-colors">
                  <CheckCircle className="w-4 h-4" />
                  Use Extracted Data
                </button>
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)] rounded-lg transition-colors">
                  <Eye className="w-4 h-4" />
                </button>
                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)] rounded-lg transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              </div>

              {/* Processing time */}
              <p className="text-xs text-[var(--fg-tertiary)] text-center">
                Processed in {analysis.processingTime}ms
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentUploader;
