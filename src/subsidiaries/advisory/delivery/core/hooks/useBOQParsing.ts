/**
 * useBOQParsing Hook
 * 
 * Hook for BOQ document parsing workflow.
 */

import { useState, useCallback } from 'react';
import { Firestore } from 'firebase/firestore';
import { parseExcelFile, cleanupBOQItems } from '../services/boq-parser';
import { importBOQItems } from '../services/control-boq';
import type { ParsedBOQItem, CleanedBOQItem, CleanupResult } from '../types/parsing';

interface UseBOQParsingOptions {
  projectId: string;
  userId: string;
}

interface UseBOQParsingReturn {
  // State
  isUploading: boolean;
  isParsing: boolean;
  isCleaning: boolean;
  isImporting: boolean;
  progress: number;
  progressStage: string;
  error: string | null;
  
  // Results
  parsedItems: ParsedBOQItem[];
  cleanedItems: CleanedBOQItem[];
  cleanupResult: CleanupResult | null;
  importedCount: number;
  
  // Actions
  parseFile: (file: File) => Promise<void>;
  runCleanup: () => Promise<void>;
  importItems: (db: Firestore, sourceFileName?: string) => Promise<string[]>;
  clear: () => void;
}

export function useBOQParsing(options: UseBOQParsingOptions): UseBOQParsingReturn {
  const { projectId, userId } = options;
  
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const [parsedItems, setParsedItems] = useState<ParsedBOQItem[]>([]);
  const [cleanedItems, setCleanedItems] = useState<CleanedBOQItem[]>([]);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  
  const parseFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setIsParsing(true);
    setError(null);
    setProgress(0);
    setProgressStage('uploading');
    
    try {
      const items = await parseExcelFile({
        file,
        onProgress: (p) => {
          setProgress(p * 0.6); // 0-60% for parsing
          setProgressStage(p < 30 ? 'reading' : p < 80 ? 'extracting' : 'finalizing');
        },
      });
      
      setParsedItems(items);
      setProgressStage('cleaning');
      setIsParsing(false);
      setIsCleaning(true);
      
      // Auto-run cleanup after parsing
      const result = await cleanupBOQItems(items);
      setCleanedItems(result.cleanedItems);
      setCleanupResult(result);
      
      setProgress(100);
      setProgressStage('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setIsUploading(false);
      setIsParsing(false);
      setIsCleaning(false);
    }
  }, []);
  
  const runCleanup = useCallback(async () => {
    if (parsedItems.length === 0) {
      setError('No parsed items to cleanup');
      return;
    }
    
    setIsCleaning(true);
    setError(null);
    setProgressStage('cleaning');
    
    try {
      const result = await cleanupBOQItems(parsedItems);
      setCleanedItems(result.cleanedItems);
      setCleanupResult(result);
      setProgressStage('cleanup_complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cleanup items');
    } finally {
      setIsCleaning(false);
    }
  }, [parsedItems]);
  
  const importItems = useCallback(async (db: Firestore, sourceFileName?: string) => {
    const itemsToImport = cleanedItems.length > 0 ? cleanedItems : parsedItems.map(item => ({
      ...item,
      itemName: item.description,
      specifications: '',
      isSummaryRow: false,
      billNumber: '1',
      elementCode: '',
      sectionCode: '',
      workItemCode: '',
      hierarchyPath: item.itemCode,
      hierarchyLevel: 1,
      isSpecificationRow: false,
      needsEnhancement: false,
      cleanupNotes: [],
    })) as CleanedBOQItem[];
    
    if (itemsToImport.length === 0) {
      setError('No items to import');
      return [];
    }
    
    setIsImporting(true);
    setError(null);
    setProgressStage('importing');
    
    try {
      const importedIds = await importBOQItems(db, {
        projectId,
        items: itemsToImport,
        userId,
        sourceFileName,
      });
      
      setImportedCount(importedIds.length);
      setProgressStage('import_complete');
      
      return importedIds;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import items');
      return [];
    } finally {
      setIsImporting(false);
    }
  }, [cleanedItems, parsedItems, projectId, userId]);
  
  const clear = useCallback(() => {
    setParsedItems([]);
    setCleanedItems([]);
    setCleanupResult(null);
    setImportedCount(0);
    setProgress(0);
    setProgressStage('');
    setError(null);
  }, []);
  
  return {
    isUploading,
    isParsing,
    isCleaning,
    isImporting,
    progress,
    progressStage,
    error,
    parsedItems,
    cleanedItems,
    cleanupResult,
    importedCount,
    parseFile,
    runCleanup,
    importItems,
    clear,
  };
}
