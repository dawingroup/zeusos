/**
 * Cloud Function for BOQ Parsing
 * Processes uploaded BOQ files using AI or regex-based extraction
 *
 * Supports:
 * - Excel files (.xlsx, .xls) - using xlsx library
 * - CSV files - native parsing
 * - PDF files - text extraction
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

interface ProcessBOQRequest {
  jobId: string;
  organizationId: string;
  projectId: string;
}

interface BOQItem {
  lineNumber: number;
  itemCode?: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  category?: string;
  stage?: string;
  confidence: number;
}

interface ParsedBOQResult {
  projectInfo: {
    projectName: string;
    projectCode?: string;
    client?: string;
    date?: string;
  };
  items: BOQItem[];
  summary: {
    totalItems: number;
    stages: string[];
    categories: string[];
    averageConfidence: number;
    lowConfidenceCount: number;
    totalValue?: number;
  };
  metadata: {
    sourceFormat: string;
    fileName: string;
    processingTime: number;
    parsingMethod: 'ai' | 'regex' | 'structured';
  };
}

/**
 * Parse CSV content into BOQ items
 */
function parseCSVContent(content: string): BOQItem[] {
  const lines = content.split('\n').filter(line => line.trim());
  const items: BOQItem[] = [];

  // Try to detect header row
  const headerPatterns = ['description', 'item', 'qty', 'quantity', 'unit', 'price', 'amount'];
  let headerIndex = 0;

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (headerPatterns.some(p => lower.includes(p))) {
      headerIndex = i;
      break;
    }
  }

  // Parse data rows
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));

    if (cells.length < 2) continue;

    // Try to extract BOQ fields
    const item: BOQItem = {
      lineNumber: i - headerIndex,
      description: '',
      unit: 'nr',
      quantity: 0,
      confidence: 0.7,
    };

    // Heuristic field detection
    for (let j = 0; j < cells.length; j++) {
      const cell = cells[j];
      const numValue = parseFloat(cell.replace(/[,$]/g, ''));

      if (!item.description && cell.length > 10 && isNaN(numValue)) {
        item.description = cell;
      } else if (!item.itemCode && /^[A-Z0-9-]+$/i.test(cell) && cell.length < 20) {
        item.itemCode = cell;
      } else if (!isNaN(numValue) && numValue > 0) {
        if (!item.quantity || numValue < 1000) {
          item.quantity = numValue;
        } else if (!item.unitPrice) {
          item.unitPrice = numValue;
        } else if (!item.totalPrice) {
          item.totalPrice = numValue;
        }
      } else if (['m', 'm2', 'm3', 'nr', 'no', 'pcs', 'kg', 'ton', 'l', 'set', 'lot', 'ls', 'each'].includes(cell.toLowerCase())) {
        item.unit = cell.toLowerCase();
      }
    }

    if (item.description && item.quantity > 0) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Parse text content using regex patterns (for PDF text extraction)
 */
function parseTextContent(content: string, fileName: string): BOQItem[] {
  const items: BOQItem[] = [];
  const lines = content.split('\n');

  // Common BOQ patterns
  const boqLinePattern = /^(\d+\.?\d*|\w+-\d+)?\s*(.{10,100})\s+(\d+\.?\d*)\s*(m2?|m3?|nr|no|pcs|kg|ton|l|set|lot|ls|each)?\s*(?:@?\s*)?(\d+[,.]?\d*)?/i;

  let lineNumber = 0;
  for (const line of lines) {
    const match = line.match(boqLinePattern);
    if (match) {
      lineNumber++;
      const item: BOQItem = {
        lineNumber,
        itemCode: match[1]?.trim(),
        description: match[2]?.trim() || '',
        quantity: parseFloat(match[3]) || 0,
        unit: match[4]?.toLowerCase() || 'nr',
        unitPrice: match[5] ? parseFloat(match[5].replace(',', '')) : undefined,
        confidence: 0.6,
      };

      if (item.description && item.quantity > 0) {
        items.push(item);
      }
    }
  }

  return items;
}

/**
 * Extract categories and stages from items
 */
function categorizeItems(items: BOQItem[]): { categories: string[]; stages: string[] } {
  const categoryKeywords: Record<string, string[]> = {
    'Structural': ['concrete', 'steel', 'reinforcement', 'foundation', 'beam', 'column', 'slab'],
    'Finishes': ['paint', 'tile', 'plaster', 'ceiling', 'floor', 'wall finish', 'coating'],
    'Electrical': ['wire', 'cable', 'socket', 'switch', 'light', 'electrical', 'conduit'],
    'Plumbing': ['pipe', 'tap', 'toilet', 'sink', 'drain', 'water', 'sanitary'],
    'HVAC': ['ac', 'air conditioning', 'ventilation', 'duct', 'cooling'],
    'Doors & Windows': ['door', 'window', 'frame', 'glass', 'shutter'],
    'Roofing': ['roof', 'sheet', 'gutter', 'fascia', 'soffit'],
  };

  const stageKeywords: Record<string, string[]> = {
    'Foundation': ['foundation', 'excavation', 'footing', 'pile'],
    'Structure': ['column', 'beam', 'slab', 'structural'],
    'Rough-in': ['electrical rough', 'plumbing rough', 'conduit'],
    'Finishing': ['paint', 'tile', 'ceiling', 'finish'],
  };

  const foundCategories = new Set<string>();
  const foundStages = new Set<string>();

  for (const item of items) {
    const desc = item.description.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => desc.includes(kw))) {
        item.category = category;
        foundCategories.add(category);
        break;
      }
    }

    for (const [stage, keywords] of Object.entries(stageKeywords)) {
      if (keywords.some(kw => desc.includes(kw))) {
        item.stage = stage;
        foundStages.add(stage);
        break;
      }
    }
  }

  return {
    categories: Array.from(foundCategories),
    stages: Array.from(foundStages),
  };
}

/**
 * Process BOQ Parsing Job
 * Called from the frontend when a file is uploaded for parsing
 */
export const processBOQParsingJob = functions.https.onCall(
  async (data: ProcessBOQRequest, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const { jobId, organizationId, projectId } = data;

    if (!jobId || !organizationId || !projectId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required parameters: jobId, organizationId, projectId'
      );
    }

    const db = admin.firestore();
    const storage = admin.storage().bucket();
    const jobRef = db.doc(
      `organizations/${organizationId}/matflow_projects/${projectId}/parsing_jobs/${jobId}`
    );
    const startTime = Date.now();

    try {
      // Get job details
      const jobSnap = await jobRef.get();
      if (!jobSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'Parsing job not found');
      }

      const job = jobSnap.data()!;

      // Update status to processing
      await jobRef.update({
        status: 'processing',
        progress: 10,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Download file from Cloud Storage
      const storagePath = job.storagePath || job.filePath;
      if (!storagePath) {
        throw new functions.https.HttpsError('invalid-argument', 'No file path in job');
      }

      console.log(`[BOQParsing] Downloading file: ${storagePath}`);

      let fileContent: string;
      let parsingMethod: 'ai' | 'regex' | 'structured' = 'regex';

      try {
        const file = storage.file(storagePath);
        const [exists] = await file.exists();

        if (!exists) {
          throw new Error(`File not found: ${storagePath}`);
        }

        const [buffer] = await file.download();

        // Update progress
        await jobRef.update({
          progress: 30,
          updatedAt: admin.firestore.Timestamp.now(),
        });

        // Parse based on file type
        const fileType = job.fileType?.toLowerCase() || job.fileName?.split('.').pop()?.toLowerCase();

        if (fileType === 'csv') {
          fileContent = buffer.toString('utf-8');
          parsingMethod = 'structured';
        } else if (fileType === 'xlsx' || fileType === 'xls') {
          // For Excel files, try to use xlsx library if available
          // Otherwise, fall back to treating as text (limited support)
          try {
            const XLSX = require('xlsx');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            fileContent = XLSX.utils.sheet_to_csv(sheet);
            parsingMethod = 'structured';
          } catch (xlsxError) {
            console.warn('[BOQParsing] xlsx library not available, using text extraction');
            fileContent = buffer.toString('utf-8');
          }
        } else {
          // PDF or other text-based formats
          fileContent = buffer.toString('utf-8');
        }
      } catch (downloadError) {
        console.error('[BOQParsing] Error downloading file:', downloadError);
        throw new functions.https.HttpsError(
          'internal',
          `Failed to download file: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
        );
      }

      // Update progress
      await jobRef.update({
        progress: 50,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Parse the content
      let items: BOQItem[];

      if (parsingMethod === 'structured') {
        items = parseCSVContent(fileContent);
      } else {
        items = parseTextContent(fileContent, job.fileName);
      }

      // Update progress
      await jobRef.update({
        progress: 70,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      // Categorize items
      const { categories, stages } = categorizeItems(items);

      // Calculate summary
      const avgConfidence = items.length > 0
        ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length
        : 0;
      const lowConfidenceCount = items.filter(item => item.confidence < 0.7).length;
      const totalValue = items.reduce((sum, item) => sum + (item.totalPrice || 0), 0);

      const processingTime = Date.now() - startTime;

      const result: ParsedBOQResult = {
        projectInfo: {
          projectName: 'Extracted from: ' + job.fileName,
        },
        items,
        summary: {
          totalItems: items.length,
          stages,
          categories,
          averageConfidence: Math.round(avgConfidence * 100) / 100,
          lowConfidenceCount,
          totalValue: totalValue > 0 ? totalValue : undefined,
        },
        metadata: {
          sourceFormat: job.fileType || 'unknown',
          fileName: job.fileName,
          processingTime,
          parsingMethod,
        },
      };

      // Update with results
      await jobRef.update({
        status: 'completed',
        progress: 100,
        result,
        parsedItems: items,
        completedAt: admin.firestore.Timestamp.now(),
        updatedAt: admin.firestore.Timestamp.now(),
      });

      console.log(`[BOQParsing] Completed: ${items.length} items extracted in ${processingTime}ms`);

      return {
        success: true,
        itemCount: items.length,
        parsingMethod,
        message: `BOQ parsing completed. Extracted ${items.length} items using ${parsingMethod} parsing.`,
      };

    } catch (error: unknown) {
      console.error('BOQ parsing error:', error);

      const errorMessage = error instanceof Error ? error.message : 'An error occurred during parsing';

      await jobRef.update({
        status: 'failed',
        errorMessage,
        updatedAt: admin.firestore.Timestamp.now(),
      });

      throw new functions.https.HttpsError('internal', errorMessage);
    }
  }
);
