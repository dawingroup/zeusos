// ============================================================================
// STRATEGY DOCUMENT UPLOAD COMPONENT
// ZeusOS v2.0 - CEO Strategy Command
// Upload and parse business strategy documents for review
// ============================================================================

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  File,
  X,
  Loader2,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { uploadFile } from '../../../../shared/services/firebase/storage';
import mammoth from 'mammoth';
import { parseStrategyDocument } from '../../services/strategyAI.service';
import type { UploadedStrategyDocument } from '../../types/strategy.types';

// Maximum character count sent to AI for analysis
const AI_CONTENT_CHAR_LIMIT = 100_000;

export interface StrategyDocumentUploadProps {
  companyId: string;
  onDocumentUploaded: (doc: UploadedStrategyDocument, parsedContent?: string) => void;
  onAnalyzeDocument?: (content: string) => void;
  onClearDocument?: () => void;
  existingDocument?: UploadedStrategyDocument;
  isAnalyzing?: boolean;
  onSectionsParsed?: (params: { documentText: string }) => Promise<unknown>;
}

export const StrategyDocumentUpload: React.FC<StrategyDocumentUploadProps> = ({
  companyId,
  onDocumentUploaded,
  onAnalyzeDocument,
  onClearDocument,
  existingDocument,
  isAnalyzing = false,
  onSectionsParsed,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [truncationWarning, setTruncationWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cachedArrayBuffer = useRef<ArrayBuffer | null>(null);

  // Try multiple strategies to read a File as ArrayBuffer.
  // macOS iCloud-evicted files and sandboxed locations reject both
  // Blob.arrayBuffer() and FileReader.  The objectURL+fetch path
  // uses a different browser code-path that can sometimes succeed.
  const readFileAsArrayBuffer = async (f: File): Promise<ArrayBuffer> => {
    // Strategy 1: Blob.arrayBuffer (fastest, but fails on sandboxed files)
    try {
      return await f.arrayBuffer();
    } catch { /* fall through */ }

    // Strategy 2: FileReader (broader compat, still fails on iCloud-evicted)
    try {
      return await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
        reader.readAsArrayBuffer(f);
      });
    } catch { /* fall through */ }

    // Strategy 3: createObjectURL + fetch (different browser code-path)
    const url = URL.createObjectURL(f);
    try {
      const resp = await fetch(url);
      return await resp.arrayBuffer();
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const ACCEPTED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/markdown',
  ];
  const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md'];
  const MAX_SIZE_MB = 25;

  const isTextFile = (file: File): boolean => {
    return (
      file.type === 'text/plain' ||
      file.type === 'text/markdown' ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.md')
    );
  };

  const isBinaryFile = (file: File): boolean => {
    return (
      file.type === 'application/pdf' ||
      file.name.endsWith('.pdf') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword' ||
      file.name.endsWith('.docx') ||
      file.name.endsWith('.doc')
    );
  };

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload PDF, Word, or text documents.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File is too large. Maximum size is ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    console.log(`[DocUpload] extractTextFromFile: name=${file.name}, type=${file.type}, size=${file.size}`);
    console.log(`[DocUpload] isTextFile=${isTextFile(file)}, isBinaryFile=${isBinaryFile(file)}`);

    // For text files, read directly on the client
    if (isTextFile(file)) {
      const text = await file.text();
      console.log(`[DocUpload] Text file read OK, length: ${text.length}`);
      return text;
    }

    // For DOCX files, extract text client-side using mammoth (avoids large base64 upload)
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.docx')) {
      setIsParsing(true);
      setUploadProgress('Extracting text from DOCX...');
      try {
        // Use cached ArrayBuffer if available (avoids stale File handle DOMException)
        const arrayBuffer = cachedArrayBuffer.current ?? await readFileAsArrayBuffer(file);
        cachedArrayBuffer.current = arrayBuffer;
        console.log(`[DocUpload] DOCX arrayBuffer size: ${arrayBuffer.byteLength}`);
        const mammothResult = await mammoth.extractRawText({ arrayBuffer });
        const text = (mammothResult.value || '').trim();
        console.log(`[DocUpload] mammoth extracted ${text.length} chars from DOCX`);
        if (mammothResult.messages && mammothResult.messages.length > 0) {
          console.log('[DocUpload] mammoth warnings:', mammothResult.messages.map((m: { message: string }) => m.message).join('; '));
        }
        if (text.length > 0) {
          return text;
        }
        setError('Could not extract text from DOCX. Please try pasting the content manually.');
      } catch (err) {
        console.error('[DocUpload] mammoth DOCX extraction failed:', err);
        const isPermission = err instanceof Error && err.name === 'NotReadableError';
        setError(
          isPermission
            ? 'Cannot read this file — it may be stored in iCloud or a cloud-synced folder. Please copy the file to your Desktop or Downloads folder first, or paste the content manually below.'
            : `DOCX extraction failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try pasting content manually.`
        );
      } finally {
        setIsParsing(false);
        setUploadProgress('');
      }
      return '';
    }

    // For PDF and other binary files, send to backend for server-side parsing
    if (isBinaryFile(file)) {
      setIsParsing(true);
      setUploadProgress('Parsing document content...');
      try {
        console.log('[DocUpload] Calling parseStrategyDocument for binary file...');
        const result = await parseStrategyDocument(file, companyId);
        console.log(`[DocUpload] parseStrategyDocument result: success=${result.success}, contentLength=${result.content?.length || 0}, error=${result.error || 'none'}`);
        if (result.success && result.content) {
          return result.content;
        }
        if (result.error) {
          setError(`Document parsing issue: ${result.error}. You can still upload and paste text manually.`);
        }
      } catch (err) {
        console.error('[DocUpload] Document parsing error:', err);
        setError(`Document parsing failed: ${err instanceof Error ? err.message : 'Unknown error'}. You can still upload and paste text manually.`);
      } finally {
        setIsParsing(false);
        setUploadProgress('');
      }
    } else {
      console.warn(`[DocUpload] File type not recognized as text or binary: type=${file.type}, name=${file.name}`);
      // Try reading as text anyway for unrecognized types
      try {
        const text = await file.text();
        if (text && text.length > 50 && !text.includes('\x00')) {
          console.log(`[DocUpload] Fallback text read OK, length: ${text.length}`);
          return text;
        }
      } catch { /* not a text file */ }
    }
    return '';
  };

  const handleFile = useCallback(async (file: File) => {
    // Read binary content FIRST — before any setState — to stay within the
    // user-gesture window.  Browsers (especially Safari/WebKit) revoke File
    // access once the gesture is considered "spent", which can happen after
    // an await that yields to React's batched re-render cycle.
    cachedArrayBuffer.current = null;
    let eagerReadFailed = false;
    if (file.name.toLowerCase().endsWith('.docx')) {
      try {
        cachedArrayBuffer.current = await readFileAsArrayBuffer(file);
      } catch (err) {
        console.error('[DocUpload] Eager arrayBuffer read failed:', err);
        eagerReadFailed = true;
      }
    }

    setError(eagerReadFailed
      ? 'Cannot read this file — it may be stored in iCloud or a cloud-synced folder. Please copy it to your Desktop or Downloads folder first, or paste the content manually below.'
      : null
    );
    setTruncationWarning(false);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSelectedFile(file);
    setExtractedText('');

    // Skip extraction if the file is completely unreadable — show paste fallback
    if (eagerReadFailed) return;

    // Try to extract text (will use cachedArrayBuffer for DOCX)
    const text = await extractTextFromFile(file);
    if (text) {
      setExtractedText(text);
      if (text.length > AI_CONTENT_CHAR_LIMIT) {
        setTruncationWarning(true);
      }
    }
  }, [companyId]);

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      // If text wasn't extracted yet, try again before uploading
      let contentToSend = extractedText;
      if (!contentToSend || contentToSend.length < 50) {
        console.log('[DocUpload] extractedText is empty/short, retrying extraction before upload...');
        setUploadProgress('Extracting document text...');
        contentToSend = await extractTextFromFile(selectedFile);
        if (contentToSend) {
          setExtractedText(contentToSend);
        }
      }
      console.log(`[DocUpload] handleUpload: contentToSend length = ${contentToSend?.length || 0}`);

      // Upload file to Firebase Storage for persistent URL
      const timestamp = Date.now();
      const safeName = selectedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `companies/${companyId}/strategy_documents/${timestamp}_${safeName}`;

      setUploadProgress('Uploading file to storage...');
      const { url: fileUrl } = await uploadFile(storagePath, selectedFile);

      setUploadProgress('Finalizing...');
      const doc: UploadedStrategyDocument = {
        fileName: selectedFile.name,
        fileUrl,
        storagePath,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        parsedContent: contentToSend || undefined,
      };

      onDocumentUploaded(doc, contentToSend || undefined);

      // Trigger section parsing if handler provided and content available
      if (onSectionsParsed && contentToSend) {
        try {
          await onSectionsParsed({ documentText: contentToSend });
        } catch (err) {
          console.warn('[DocUpload] Section parsing failed:', err);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Show existing document
  if (existingDocument && !selectedFile) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-[var(--rag-green-soft)] border border-[var(--rag-green)] rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--rag-green)]" />
            <div>
              <p className="font-medium text-[var(--rag-green)]">{existingDocument.fileName}</p>
              <p className="text-sm text-[var(--rag-green)]">
                {formatFileSize(existingDocument.fileSize)} — Uploaded {new Date(existingDocument.uploadedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onAnalyzeDocument && existingDocument.parsedContent && (
              <button
                onClick={() => onAnalyzeDocument(existingDocument.parsedContent!)}
                disabled={isAnalyzing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[var(--rag-blue)] bg-[var(--rag-blue-soft)] rounded-lg hover:bg-[var(--rag-blue)] disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isAnalyzing ? 'Analyzing...' : 'Re-Analyze with AI'}
              </button>
            )}
            <button
              onClick={() => onClearDocument?.()}
              className="p-1.5 text-[var(--fg-tertiary)] hover:text-muted-foreground rounded"
              title="Replace document"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isParsing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-[var(--rag-blue)] bg-[var(--rag-blue-soft)]'
            : isParsing
              ? 'border-[var(--border-subtle)] bg-[var(--bg-sunken)] cursor-wait'
              : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-sunken)]'
        }`}
      >
        {isParsing ? (
          <>
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-[var(--rag-blue)] animate-spin" />
            <p className="text-sm font-medium text-foreground mb-1">
              Parsing document content...
            </p>
            <p className="text-xs text-muted-foreground">
              Extracting text from your file for AI analysis
            </p>
          </>
        ) : (
          <>
            <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragging ? 'text-[var(--rag-blue)]' : 'text-[var(--fg-tertiary)]'}`} />
            <p className="text-sm font-medium text-foreground mb-1">
              Upload your current Business Strategy & Plan
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-[var(--fg-tertiary)]">
              Supported: PDF, Word (.docx), Text (.txt, .md) — Max {MAX_SIZE_MB}MB
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          onChange={(e) => e.target.files && handleFile(e.target.files[0])}
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg text-sm text-[var(--rag-red)]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Truncation Warning */}
      {truncationWarning && extractedText && (
        <div className="flex items-start gap-2 p-3 bg-[var(--rag-amber-soft)] border border-[var(--rag-amber)] rounded-lg text-sm text-[var(--rag-amber)]">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Large document detected</p>
            <p className="text-xs mt-0.5">
              Your document has {extractedText.length.toLocaleString()} characters. AI analysis will use the first {AI_CONTENT_CHAR_LIMIT.toLocaleString()} characters. For best results, ensure the most important sections are at the beginning.
            </p>
          </div>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && !isParsing && (
        <div className="bg-[var(--bg-sunken)] border border-[var(--border-subtle)] rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedFile.type === 'application/pdf' ? (
                <FileText className="w-8 h-8 text-[var(--rag-red)]" />
              ) : (
                <File className="w-8 h-8 text-[var(--rag-blue)]" />
              )}
              <div>
                <p className="font-medium text-foreground">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                  {extractedText && (
                    <span className="ml-2 text-[var(--rag-green)]">
                      — {extractedText.length.toLocaleString()} chars extracted
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setExtractedText('');
                  setError(null);
                  setTruncationWarning(false);
                  cachedArrayBuffer.current = null;
                }}
                className="p-2 text-[var(--fg-tertiary)] hover:text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--rag-blue)] rounded-lg hover:bg-[var(--rag-blue)] disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploadProgress || 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload & Start Review
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Text content paste area for binary files when server parsing returned nothing */}
          {!extractedText && isBinaryFile(selectedFile) && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-muted-foreground mb-2">
                Paste document content for AI analysis (optional)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Automatic text extraction returned no content. For best AI analysis, paste the text content manually.
              </p>
              <textarea
                value={extractedText}
                onChange={(e) => {
                  setExtractedText(e.target.value);
                  setTruncationWarning(e.target.value.length > AI_CONTENT_CHAR_LIMIT);
                }}
                placeholder="Paste the text content of your strategy document here..."
                rows={6}
                className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[var(--rag-blue)] focus:border-[var(--rag-blue)]"
              />
            </div>
          )}
        </div>
      )}

      {/* Manual text entry option */}
      {!selectedFile && !existingDocument && !isManualEntry && !isParsing && (
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">or</p>
          <button
            onClick={() => setIsManualEntry(true)}
            className="text-sm text-[var(--rag-blue)] hover:text-[var(--rag-blue)] font-medium"
          >
            Paste strategy content manually
          </button>
        </div>
      )}

      {/* Manual Entry Area */}
      {isManualEntry && !selectedFile && !existingDocument && (
        <div className="bg-[var(--bg-sunken)] border border-[var(--border-subtle)] rounded-lg p-4">
          <label className="block text-sm font-medium text-muted-foreground mb-2">
            Paste your strategy document content
          </label>
          <textarea
            value={extractedText}
            onChange={(e) => {
              setExtractedText(e.target.value);
              setTruncationWarning(e.target.value.length > AI_CONTENT_CHAR_LIMIT);
            }}
            placeholder="Paste the full text content of your business strategy and plan here for AI analysis..."
            rows={10}
            className="w-full border border-[var(--border-default)] rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-[var(--rag-blue)] focus:border-[var(--rag-blue)]"
          />
          {extractedText && (
            <p className={`text-xs mt-1 ${extractedText.length > AI_CONTENT_CHAR_LIMIT ? 'text-[var(--rag-amber)]' : 'text-[var(--fg-tertiary)]'}`}>
              {extractedText.length.toLocaleString()} characters
              {extractedText.length > AI_CONTENT_CHAR_LIMIT && ` (AI will analyze first ${AI_CONTENT_CHAR_LIMIT.toLocaleString()})`}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => {
                if (!extractedText.trim()) return;
                const doc: UploadedStrategyDocument = {
                  fileName: 'manual-entry.txt',
                  fileUrl: '',
                  fileSize: new Blob([extractedText]).size,
                  mimeType: 'text/plain',
                  uploadedAt: new Date().toISOString(),
                  parsedContent: extractedText,
                };
                onDocumentUploaded(doc, extractedText);
                if (onSectionsParsed) {
                  onSectionsParsed({ documentText: extractedText }).catch(() => {});
                }
                setIsManualEntry(false);
              }}
              disabled={!extractedText.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[var(--rag-blue)] rounded-lg hover:bg-[var(--rag-blue)] disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              Start Review
            </button>
            <button
              onClick={() => {
                setIsManualEntry(false);
                setExtractedText('');
                setTruncationWarning(false);
              }}
              className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StrategyDocumentUpload;
