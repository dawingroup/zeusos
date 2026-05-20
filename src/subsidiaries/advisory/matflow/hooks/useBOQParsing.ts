/**
 * BOQ Parsing Hook
 * Manages file upload, parsing jobs, and import of parsed items
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  uploadBOQFile,
  createParsingJob,
  subscribeToParsingJob,
  importParsedItems,
  getParsingJobs,
  updateParsingJobStatus,
  deleteParsingJob,
  type ParsingJob,
} from '../services/parsingService';
import type { ParsedBOQItem } from '../ai/schemas/boqSchema';
import { cleanupBOQItems, type CleanedBOQItem, type CleanupResult } from '../ai/boqCleanupService';
import * as XLSX from 'xlsx';

// Default organization ID
const DEFAULT_ORG_ID = 'default';

interface UseBOQParsingOptions {
  projectId: string;
}

export function useBOQParsing({ projectId }: UseBOQParsingOptions) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  const userId = user?.uid;
  
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ParsingJob | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementProgress, setEnhancementProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [parsingHistory, setParsingHistory] = useState<ParsingJob[]>([]);
  const [cleanedItems, setCleanedItems] = useState<CleanedBOQItem[]>([]);
  const [cleanupStats, setCleanupStats] = useState<CleanupResult['stats'] | null>(null);

  // Subscribe to active job updates
  useEffect(() => {
    if (!activeJobId || !projectId) {
      console.log('Subscription skipped:', { activeJobId, projectId });
      return;
    }

    console.log('Setting up subscription for job:', { orgId, projectId, activeJobId });

    const unsubscribe = subscribeToParsingJob(
      orgId,
      projectId,
      activeJobId,
      (job) => {
        console.log('Job update received:', {
          jobId: job?.id,
          status: job?.status,
          progress: job?.progress,
          parsedItemsCount: job?.parsedItems?.length || 0,
          hasJob: !!job
        });

        setActiveJob(job);

        if (job?.status === 'completed') {
          console.log('Job completed, parsed items:', job.parsedItems?.length || 0);
          // Refresh parsing history when job completes
          loadParsingHistory();
        } else if (job?.status === 'failed') {
          console.error('Job failed:', job.errorMessage);
          setError(job.errorMessage || 'Parsing failed');
        }
      }
    );

    return () => {
      console.log('Unsubscribing from job:', activeJobId);
      unsubscribe();
    };
  }, [activeJobId, orgId, projectId]);

  // Load parsing history
  const loadParsingHistory = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const jobs = await getParsingJobs(orgId, projectId);
      setParsingHistory(jobs);
    } catch (err) {
      console.error('Failed to load parsing history:', err);
    }
  }, [orgId, projectId]);

  // Load history on mount
  useEffect(() => {
    loadParsingHistory();
  }, [loadParsingHistory]);

  // Parse Excel file locally
  const parseExcelLocally = async (file: File, jobId: string): Promise<ParsedBOQItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          // Update progress: Analyzing
          await updateParsingJobStatus(orgId, projectId, jobId, 'processing', { progress: 15 });
          
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Update progress: Extracting
          await updateParsingJobStatus(orgId, projectId, jobId, 'processing', { progress: 30 });
          
          const parsedItems: ParsedBOQItem[] = [];
          const boqKeywords = ['item', 'description', 'qty', 'quantity', 'unit', 'rate', 'amount'];
          const processedSheets: string[] = [];
          const skippedSheets: string[] = [];

          // Process each sheet - only BOQ-like sheets
          for (let i = 0; i < workbook.SheetNames.length; i++) {
            const sheetName = workbook.SheetNames[i];
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            // Check if this sheet looks like a BOQ by examining column headers
            const headerRow = (XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][])[0] || [];
            const headerText = headerRow.map((h: any) => String(h || '').toLowerCase()).join(' ');
            const matchCount = boqKeywords.filter(kw => headerText.includes(kw)).length;

            if (matchCount < 2) {
              skippedSheets.push(sheetName);
              console.log(`[parseExcelLocally] Skipping non-BOQ sheet "${sheetName}" (${matchCount} keyword matches)`);
              continue;
            }

            const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

            // Update progress based on sheet processing
            const sheetProgress = 30 + ((i + 1) / workbook.SheetNames.length) * 40;
            await updateParsingJobStatus(orgId, projectId, jobId, 'processing', { progress: Math.round(sheetProgress) });

            // Try to extract BOQ items from the sheet
            for (const row of jsonData) {
              // Look for common BOQ column patterns
              const item = extractBOQItem(row, parsedItems.length + 1);
              if (item) {
                parsedItems.push(item);
              }
            }
            processedSheets.push(sheetName);
          }

          console.log(`[parseExcelLocally] Processed ${processedSheets.length} BOQ sheets: ${processedSheets.join(', ')}`);
          if (skippedSheets.length > 0) {
            console.log(`[parseExcelLocally] Skipped ${skippedSheets.length} non-BOQ sheets: ${skippedSheets.join(', ')}`);
          }
          
          // Update progress: Matching
          await updateParsingJobStatus(orgId, projectId, jobId, 'processing', { progress: 80 });
          
          // Simulate material matching delay
          await new Promise(r => setTimeout(r, 500));
          
          // Update progress: Complete - save parsed items to job document
          await updateParsingJobStatus(orgId, projectId, jobId, 'completed', { 
            progress: 100,
            parsedItems
          });
          
          resolve(parsedItems);
        } catch (err) {
          reject(err);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };
  
  // Extract BOQ item from row data - be PERMISSIVE, let cleanup handle filtering
  const extractBOQItem = (row: Record<string, any>, index: number): ParsedBOQItem | null => {
    // Common column name patterns for BOQ items
    const itemCodeKeys = ['item', 'item no', 'item code', 'no', 'ref', 'reference', 'code', 'sn', 's/n', 'item ref'];
    const descKeys = ['description', 'desc', 'item description', 'particulars', 'work item', 'specification'];
    const qtyKeys = ['qty', 'quantity', 'qnty'];
    const unitKeys = ['unit', 'uom', 'units'];
    const rateKeys = ['rate', 'unit rate', 'price', 'unit price'];
    const amountKeys = ['amount', 'total', 'total amount', 'value'];
    
    const findValue = (keys: string[]) => {
      for (const key of keys) {
        const found = Object.entries(row).find(([k]) => k.toLowerCase().includes(key));
        if (found && found[1] !== undefined && found[1] !== '') {
          return found[1];
        }
      }
      return null;
    };
    
    // Extract item code from the actual data - this is CRITICAL for hierarchy
    const rawItemCode = findValue(itemCodeKeys);
    const description = findValue(descKeys);
    // Round quantity UP to nearest whole number
    const rawQuantity = parseFloat(String(findValue(qtyKeys) || 0)) || 0;
    const quantity = Math.ceil(rawQuantity);
    const unit = String(findValue(unitKeys) || 'nr');
    const rate = parseFloat(String(findValue(rateKeys) || 0)) || 0;
    const amount = parseFloat(String(findValue(amountKeys) || 0)) || quantity * rate;
    
    // PERMISSIVE: Only skip if BOTH description AND item code are missing
    // Header rows (bills, elements, sections) often have no qty/rate/amount but ARE important
    if (!description && !rawItemCode) {
      return null;
    }
    
    // Use actual item code from Excel if found, otherwise generate index-based code
    const itemCode = rawItemCode ? String(rawItemCode).trim() : String(index);

    // Determine hierarchy level from item code dot-segments
    const codeParts = itemCode.split('.').filter(Boolean);
    const hierarchyLevel = codeParts.length; // 1=Bill, 2=Element, 3=Section, 4=WorkItem
    const isHeaderRow = hierarchyLevel <= 3 && quantity === 0 && rate === 0;
    const parentCode = codeParts.length > 1
      ? codeParts.slice(0, -1).join('.')
      : undefined;

    return {
      itemCode,
      description: String(description || ''),
      quantity,
      unit,
      rate,
      amount,
      confidence: isHeaderRow ? 0.9 : 0.8,
      hierarchyLevel,
      isHeaderRow,
      parentCode,
    };
  };

  // Start parsing a file
  const startParsing = useCallback(async (file: File) => {
    console.log('startParsing called with file:', file.name, 'orgId:', orgId, 'projectId:', projectId);

    if (!userId) {
      console.error('User not authenticated');
      setError('User not authenticated');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Upload file
      console.log('Uploading file to Firebase Storage...');
      const { fileUrl, fileType } = await uploadBOQFile(orgId, projectId, file);
      console.log('File uploaded:', { fileUrl, fileType });

      // Create parsing job
      console.log('Creating parsing job in Firestore...');
      const jobId = await createParsingJob(
        orgId,
        projectId,
        userId,
        file.name,
        fileUrl,
        fileType
      );
      console.log('Parsing job created with ID:', jobId);

      setActiveJobId(jobId);
      console.log('Active job ID set to:', jobId);

      // Process file locally (client-side parsing)
      if (fileType === 'excel' || fileType === 'csv') {
        try {
          console.log('Starting local Excel parsing...');
          await parseExcelLocally(file, jobId);
          console.log('Local parsing completed successfully');
        } catch (parseErr) {
          console.error('Local parsing failed:', parseErr);
          await updateParsingJobStatus(orgId, projectId, jobId, 'failed', {
            errorMessage: parseErr instanceof Error ? parseErr.message : 'Parsing failed'
          });
        }
      } else {
        // PDF parsing not supported locally
        await updateParsingJobStatus(orgId, projectId, jobId, 'failed', {
          errorMessage: 'PDF parsing requires server-side processing. Please upload Excel or CSV files.'
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  }, [orgId, projectId, userId]);

  // Import selected items
  const importItems = useCallback(async (items: ParsedBOQItem[]) => {
    console.log('importItems called with', items?.length, 'items, userId:', userId);
    
    if (!userId) {
      setError('User not authenticated');
      console.error('Import failed: User not authenticated');
      return [];
    }
    
    if (!items || items.length === 0) {
      setError('No items to import');
      console.error('Import failed: No items provided');
      return [];
    }
    
    setIsImporting(true);
    setError(null);
    
    try {
      console.log('Calling importParsedItems...', { orgId, projectId, itemCount: items.length });
      const importedIds = await importParsedItems(orgId, projectId, items, userId);
      console.log('importParsedItems returned:', importedIds);
      
      // Clear active job after successful import
      setActiveJob(null);
      setActiveJobId(null);
      
      return importedIds;
    } catch (err) {
      console.error('importParsedItems error:', err);
      setError(err instanceof Error ? err.message : 'Failed to import items');
      return [];
    } finally {
      setIsImporting(false);
    }
  }, [orgId, projectId, userId]);

  // Clear active job
  const clearActiveJob = useCallback(() => {
    setActiveJob(null);
    setActiveJobId(null);
    setCleanedItems([]);
    setCleanupStats(null);
    setError(null);
  }, []);

  // Cleanup parsed items with AI enrichment
  const runCleanup = useCallback(async () => {
    const items = activeJob?.parsedItems;
    if (!items || items.length === 0) {
      setError('No items to cleanup');
      return;
    }
    
    setIsCleaning(true);
    setError(null);
    
    try {
      console.log('Running cleanup on', items.length, 'items...');
      const result = await cleanupBOQItems(items);
      console.log('Cleanup complete:', result.stats);
      
      setCleanedItems(result.cleanedItems);
      setCleanupStats(result.stats);
      
      return result;
    } catch (err) {
      console.error('Cleanup failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to cleanup items');
      return null;
    } finally {
      setIsCleaning(false);
    }
  }, [activeJob?.parsedItems]);

  // Import cleaned items (uses cleaned items if available, otherwise parsed items)
  const importCleanedItems = useCallback(async (items: CleanedBOQItem[]) => {
    console.log('importCleanedItems called with', items?.length, 'items');
    
    if (!userId) {
      setError('User not authenticated');
      return [];
    }
    
    if (!items || items.length === 0) {
      setError('No items to import');
      return [];
    }
    
    setIsImporting(true);
    setError(null);
    
    try {
      // Pass CleanedBOQItem directly - importParsedItems now handles all hierarchy fields
      // Cast to any to preserve all CleanedBOQItem fields including hierarchy data
      const importedIds = await importParsedItems(orgId, projectId, items as any, userId);
      console.log('Imported', importedIds.length, 'items');
      
      // Clear state after successful import
      setActiveJob(null);
      setActiveJobId(null);
      setCleanedItems([]);
      setCleanupStats(null);
      
      return importedIds;
    } catch (err) {
      console.error('Import failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to import items');
      return [];
    } finally {
      setIsImporting(false);
    }
  }, [orgId, projectId, userId]);

  // Run AI enhancement via Cloud Function
  const runAIEnhancement = useCallback(async () => {
    if (!activeJobId || !projectId) {
      setError('No active job to enhance');
      return null;
    }

    setIsEnhancing(true);
    setEnhancementProgress(0);
    setError(null);

    try {
      console.log('Starting AI enhancement for job:', activeJobId);
      const functions = getFunctions();
      const enhanceBOQItemsFn = httpsCallable(functions, 'enhanceBOQItems');

      const result = await enhanceBOQItemsFn({
        orgId,
        projectId,
        jobId: activeJobId,
      });

      const data = result.data as {
        success: boolean;
        enhancedCount: number;
        sectionsProcessed: number;
        totalItems: number;
      };

      console.log('AI enhancement complete:', data);
      setEnhancementProgress(100);

      // Re-run cleanup to pick up AI-enhanced fields
      // The job's parsedItems in Firestore are now updated,
      // so we need to refresh the active job and re-cleanup
      if (data.success) {
        // Trigger a refresh by re-running cleanup on the updated items
        // The subscription will pick up the updated job from Firestore
        console.log('Re-running cleanup with AI-enhanced items...');
        // Small delay to allow Firestore subscription to catch up
        await new Promise(r => setTimeout(r, 1000));
        await runCleanup();
      }

      return data;
    } catch (err) {
      console.error('AI enhancement failed:', err);
      setError(err instanceof Error ? err.message : 'AI enhancement failed');
      return null;
    } finally {
      setIsEnhancing(false);
    }
  }, [activeJobId, orgId, projectId, runCleanup]);

  // Delete a parsing job from history
  const deleteHistoryJob = useCallback(async (jobId: string) => {
    if (!projectId) return;
    
    try {
      console.log('Deleting parsing job:', { orgId, projectId, jobId });
      await deleteParsingJob(orgId, projectId, jobId);
      console.log('Delete successful, refreshing history...');
      // Optimistically remove from local state immediately
      setParsingHistory(prev => prev.filter(job => job.id !== jobId));
      // Then refresh from server
      await loadParsingHistory();
    } catch (err) {
      console.error('Failed to delete parsing job:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete job');
    }
  }, [orgId, projectId, loadParsingHistory]);

  // Computed states
  const isProcessing = activeJob?.status === 'processing' || isUploading;
  const progress = activeJob?.progress || 0;
  const parsedItems = activeJob?.parsedItems || [];

  return {
    // State
    activeJob,
    isProcessing,
    isUploading,
    isImporting,
    isCleaning,
    isEnhancing,
    enhancementProgress,
    progress,
    parsedItems,
    cleanedItems,
    cleanupStats,
    parsingHistory,
    error,

    // Actions
    startParsing,
    importItems,
    importCleanedItems,
    runCleanup,
    runAIEnhancement,
    clearActiveJob,
    refreshHistory: loadParsingHistory,
    deleteHistoryJob,
  };
}
