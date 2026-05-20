/**
 * BOQ Parser Service
 * 
 * Orchestrates BOQ parsing from various file formats.
 */

import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  onSnapshot,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase';
import * as XLSX from 'xlsx';
import { parseFullBOQLocally } from '../ai/boq-parser-ai';
import type { MaterialLibraryEntry } from '../ai/material-matcher-ai';
import type {
  ParsingJob,
  SourceFile,
  ExcelSheetInfo,
  ItemReviewStatus,
} from '../types/parsing';

// Generate unique IDs
const generateId = (prefix: string = 'parsing'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const PARSING_JOBS_COLLECTION = 'advisoryPlatform/matflow/parsingJobs';

// ============================================================================
// FILE UPLOAD & ANALYSIS
// ============================================================================

export interface UploadOptions {
  projectId: string;
  engagementId: string;
  boqId?: string;
  userId: string;
}

/**
 * Upload a BOQ file and create a parsing job
 */
export const uploadBOQFile = async (
  file: File,
  options: UploadOptions,
  storage: any
): Promise<ParsingJob> => {
  const jobId = generateId('parsing');

  // Upload file to Storage
  const storagePath = `matflow/parsing/${options.projectId}/${jobId}/${file.name}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  // Analyze Excel file if applicable
  let sheets: ExcelSheetInfo[] | undefined;
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    sheets = await analyzeExcelFile(file);
  }

  // Create source file info
  const sourceFile: SourceFile = {
    url: downloadUrl,
    fileName: file.name,
    fileType: getFileType(file.name),
    mimeType: file.type,
    size: file.size,
    uploadedAt: Timestamp.now(),
    sheets,
    selectedSheet: sheets?.[0]?.name,
  };

  // Create parsing job
  const job: ParsingJob = {
    id: jobId,
    projectId: options.projectId,
    engagementId: options.engagementId,
    boqId: options.boqId,
    sourceFile,
    status: 'uploading',
    progress: {
      stage: 'uploading',
      percentage: 0,
    },
    createdAt: Timestamp.now(),
    createdBy: options.userId,
    updatedAt: Timestamp.now(),
  };

  // Save to Firestore
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);
  await setDoc(jobRef, job);

  return job;
};

const getFileType = (fileName: string): SourceFile['fileType'] => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'xlsx':
    case 'xls':
      return 'excel';
    case 'pdf':
      return 'pdf';
    case 'csv':
      return 'csv';
    case 'png':
    case 'jpg':
    case 'jpeg':
      return 'image';
    default:
      return 'excel';
  }
};

/**
 * Analyze Excel file structure
 */
const analyzeExcelFile = async (file: File): Promise<ExcelSheetInfo[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const sheets: ExcelSheetInfo[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

          // Detect if this looks like a BOQ sheet
          const firstRows = jsonData.slice(0, 10);
          const hasHeaders = detectBOQHeaders(firstRows);
          const detectedType = detectSheetType(firstRows);

          return {
            name,
            rowCount: range.e.r - range.s.r + 1,
            columnCount: range.e.c - range.s.c + 1,
            hasHeaders,
            detectedType,
          };
        });

        resolve(sheets);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const detectBOQHeaders = (rows: any[][]): boolean => {
  const boqKeywords = [
    'item', 'description', 'qty', 'quantity', 'unit', 'rate',
    'amount', 'total', 'no.', 'ref', 'specification',
  ];

  for (const row of rows.slice(0, 5)) {
    const rowText = row.map((cell) => String(cell || '').toLowerCase()).join(' ');
    const matchCount = boqKeywords.filter((kw) => rowText.includes(kw)).length;
    if (matchCount >= 3) return true;
  }

  return false;
};

const detectSheetType = (rows: any[][]): ExcelSheetInfo['detectedType'] => {
  const flatText = rows
    .flat()
    .map((cell) => String(cell || '').toLowerCase())
    .join(' ');

  if (flatText.includes('bill of quantities') || flatText.includes('boq')) {
    return 'boq';
  }
  if (flatText.includes('summary') || flatText.includes('recap')) {
    return 'summary';
  }
  if (flatText.includes('rate') && flatText.includes('analysis')) {
    return 'rates';
  }

  return 'unknown';
};

// ============================================================================
// PARSING EXECUTION
// ============================================================================

export interface StartParsingOptions {
  selectedSheet?: string;
  templateId?: string;
  useAI?: boolean;
  materialLibrary?: MaterialLibraryEntry[];
}

/**
 * Start parsing a BOQ file
 */
export const startParsing = async (
  jobId: string,
  options?: StartParsingOptions
): Promise<void> => {
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);

  // Update job status
  await updateDoc(jobRef, {
    status: 'queued',
    'progress.stage': 'queued',
    'progress.percentage': 0,
    'progress.currentOperation': 'Queued for parsing...',
    'sourceFile.selectedSheet': options?.selectedSheet,
    templateId: options?.templateId,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Parse BOQ file locally (client-side)
 */
export const parseLocally = async (
  jobId: string,
  file: File,
  options?: StartParsingOptions,
  onProgress?: (progress: { stage: string; percentage: number; message?: string }) => void
): Promise<void> => {
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);

  try {
    // Update status to preprocessing
    await updateDoc(jobRef, {
      status: 'preprocessing',
      'progress.stage': 'preprocessing',
      'progress.percentage': 5,
      'progress.currentOperation': 'Reading file...',
      updatedAt: serverTimestamp(),
    });

    // Parse Excel file - use all sheets if no specific sheet selected
    const excelData = options?.selectedSheet 
      ? await parseExcelFile(file, options.selectedSheet)
      : await parseAllExcelSheets(file);

    // Update status to parsing
    await updateDoc(jobRef, {
      status: 'parsing',
      'progress.stage': 'parsing',
      'progress.percentage': 10,
      'progress.currentOperation': 'Analyzing structure...',
      updatedAt: serverTimestamp(),
    });

    // Parse BOQ
    const result = await parseFullBOQLocally({
      excelData: excelData.rows,
      fileName: file.name,
      sheetName: excelData.sheetName,
      projectName: '', // Would get from job context
      materialLibrary: options?.materialLibrary,
      onProgress: (progress) => {
        onProgress?.(progress);
        // Update Firestore progress periodically
        updateDoc(jobRef, {
          'progress.stage': progress.stage,
          'progress.percentage': progress.percentage,
          'progress.currentOperation': progress.message,
          updatedAt: serverTimestamp(),
        }).catch(console.error);
      },
    });

    // Calculate review stats
    const totalItems = result.sections.reduce((sum, s) => sum + s.items.length, 0);
    const autoApproved = result.sections.flatMap((s) => s.items)
      .filter((i) => i.reviewStatus === 'auto_approved').length;

    // Update job with results
    await updateDoc(jobRef, {
      status: 'review_ready',
      progress: {
        stage: 'review_ready',
        percentage: 100,
        currentOperation: 'Ready for review',
        itemsParsed: totalItems,
        totalItems,
        sectionsIdentified: result.sections.length,
      },
      parsedSections: result.sections,
      parsingMetadata: result.metadata,
      review: {
        status: 'pending',
        totalItems,
        reviewedItems: autoApproved,
        approvedItems: autoApproved,
        modifiedItems: 0,
        rejectedItems: 0,
      },
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // Update job with error
    await updateDoc(jobRef, {
      status: 'failed',
      errors: [
        {
          code: 'PARSING_ERROR',
          severity: 'critical',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Timestamp.now(),
          recoverable: false,
        },
      ],
      updatedAt: serverTimestamp(),
    });
    throw error;
  }
};

// ============================================================================
// JOB MANAGEMENT
// ============================================================================

/**
 * Get parsing job by ID
 */
export const getParsingJob = async (jobId: string): Promise<ParsingJob | null> => {
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);
  const snapshot = await getDoc(jobRef);

  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as ParsingJob;
};

/**
 * Subscribe to parsing job updates
 */
export const subscribeToParsingJob = (
  jobId: string,
  callback: (job: ParsingJob) => void
): (() => void) => {
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);

  return onSnapshot(jobRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as ParsingJob);
    }
  });
};

/**
 * Cancel parsing job
 */
export const cancelParsing = async (jobId: string): Promise<void> => {
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);

  await updateDoc(jobRef, {
    status: 'failed',
    'progress.currentOperation': 'Cancelled by user',
    errors: [
      {
        code: 'CANCELLED',
        severity: 'info',
        message: 'Parsing cancelled by user',
        timestamp: Timestamp.now(),
        recoverable: false,
      },
    ],
    updatedAt: serverTimestamp(),
  });
};

// ============================================================================
// REVIEW MANAGEMENT
// ============================================================================

/**
 * Start review of parsed BOQ
 */
export const startReview = async (jobId: string, userId: string): Promise<void> => {
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);

  await updateDoc(jobRef, {
    status: 'reviewing',
    'review.status': 'in_progress',
    'review.startedAt': Timestamp.now(),
    'review.startedBy': userId,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Update item review status
 */
export const updateItemReview = async (
  jobId: string,
  sectionId: string,
  itemId: string,
  update: {
    status: ItemReviewStatus;
    edits?: Array<{ field: string; oldValue: any; newValue: any }>;
    userId: string;
  }
): Promise<void> => {
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);
  const job = await getParsingJob(jobId);

  if (!job || !job.parsedSections) return;

  // Find and update the item
  const sections = [...job.parsedSections];
  const sectionIndex = sections.findIndex((s) => s.id === sectionId);

  if (sectionIndex === -1) return;

  const section = { ...sections[sectionIndex] };
  const itemIndex = section.items.findIndex((i) => i.id === itemId);

  if (itemIndex === -1) return;

  const item = { ...section.items[itemIndex] };
  item.reviewStatus = update.status;
  item.reviewedBy = update.userId;
  item.reviewedAt = Timestamp.now();

  if (update.edits) {
    item.userEdits = update.edits.map((e) => ({
      field: e.field,
      originalValue: e.oldValue,
      originalSource: 'ai' as const,
      newValue: e.newValue,
      editedAt: Timestamp.now(),
      editedBy: update.userId,
    }));

    // Apply edits to item
    for (const edit of update.edits) {
      (item as any)[edit.field] = edit.newValue;
    }
  }

  section.items[itemIndex] = item;
  sections[sectionIndex] = section;

  // Update review counts
  const allItems = sections.flatMap((s) => s.items);
  const reviewedItems = allItems.filter((i) =>
    ['approved', 'modified', 'rejected', 'auto_approved'].includes(i.reviewStatus)
  ).length;
  const approvedItems = allItems.filter((i) =>
    ['approved', 'auto_approved'].includes(i.reviewStatus)
  ).length;
  const modifiedItems = allItems.filter((i) => i.reviewStatus === 'modified').length;
  const rejectedItems = allItems.filter((i) => i.reviewStatus === 'rejected').length;

  await updateDoc(jobRef, {
    parsedSections: sections,
    'review.reviewedItems': reviewedItems,
    'review.approvedItems': approvedItems,
    'review.modifiedItems': modifiedItems,
    'review.rejectedItems': rejectedItems,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Complete review
 */
export const completeReview = async (
  jobId: string,
  userId: string,
  notes?: string
): Promise<void> => {
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);

  await updateDoc(jobRef, {
    status: 'approved',
    'review.status': 'completed',
    'review.completedAt': Timestamp.now(),
    'review.completedBy': userId,
    'review.notes': notes,
    updatedAt: serverTimestamp(),
  });
};

// ============================================================================
// APPLY TO BOQ
// ============================================================================

/**
 * Apply parsed data to a BOQ document
 */
export const applyToBOQ = async (
  jobId: string,
  targetBoqId: string,
  userId: string,
  functions: any
): Promise<void> => {
  const job = await getParsingJob(jobId);

  if (!job || job.status !== 'approved' || !job.parsedSections) {
    throw new Error('Job must be approved before applying to BOQ');
  }

  // Call Cloud Function to apply parsed data to BOQ
  const applyParsedBOQ = httpsCallable(functions, 'applyParsedBOQ');

  await applyParsedBOQ({
    jobId,
    targetBoqId,
    userId,
  });

  // Update job status
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);
  await updateDoc(jobRef, {
    status: 'applied',
    boqId: targetBoqId,
    completedAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Apply parsed data locally (without Cloud Function)
 */
export const applyToBOQLocally = async (
  jobId: string,
  targetBoqId: string,
  userId: string
): Promise<void> => {
  const job = await getParsingJob(jobId);

  if (!job || job.status !== 'approved' || !job.parsedSections) {
    throw new Error('Job must be approved before applying to BOQ');
  }

  const boqRef = doc(db, 'advisoryPlatform/matflow/boqs', targetBoqId);
  const boqSnap = await getDoc(boqRef);

  if (!boqSnap.exists()) {
    throw new Error('Target BOQ not found');
  }

  // Transform parsed sections to BOQ format, tracking rejected items
  let totalItemsBefore = 0;
  let totalRejected = 0;

  const sections = job.parsedSections.map((parsed, index) => {
    const allItems = parsed.items;
    const acceptedItems = allItems.filter((item) => item.reviewStatus !== 'rejected');
    const rejectedCount = allItems.length - acceptedItems.length;

    totalItemsBefore += allItems.length;
    totalRejected += rejectedCount;

    return {
      id: `section-${Date.now()}-${index}`,
      code: parsed.code,
      name: parsed.name,
      description: parsed.description,
      category: parsed.category,
      order: index,
      items: acceptedItems.map((item, itemIndex) => ({
        id: `item-${Date.now()}-${index}-${itemIndex}`,
        itemNumber: item.itemNumber,
        description: item.description,
        specification: item.specification,
        unit: item.unit,
        quantity: item.quantity,
        laborRate: item.laborRate,
        materialRate: item.materialRate,
        equipmentRate: item.equipmentRate,
        unitRate: item.unitRate,
        laborAmount: item.laborAmount,
        materialAmount: item.materialAmount,
        equipmentAmount: item.equipmentAmount,
        totalAmount: item.totalAmount,
        materialId: item.materialMatch?.materialId,
        materialName: item.materialMatch?.materialName,
        aiMetadata: {
          confidence: item.confidence.overall,
          parsedFromJob: jobId,
          originalReviewStatus: item.reviewStatus,
        },
      })),
      subtotal: acceptedItems.reduce((sum, i) => sum + i.totalAmount, 0),
    };
  });

  if (totalRejected > 0) {
    console.warn(
      `[applyToBOQLocally] ${totalRejected} of ${totalItemsBefore} items were rejected and excluded from import.`
    );
  }

  // Calculate summary
  const summary = calculateSummary(sections);

  // Update BOQ
  await updateDoc(boqRef, {
    sections,
    summary,
    source: 'ai_parsed',
    sourceFileUrl: job.sourceFile.url,
    sourceFileName: job.sourceFile.fileName,
    parsingStatus: 'completed',
    parsingResults: {
      jobId,
      completedAt: Timestamp.now(),
      sectionsImported: sections.length,
      itemsImported: sections.reduce((sum, s) => sum + s.items.length, 0),
      itemsRejected: totalRejected,
      totalItemsBefore: totalItemsBefore,
      averageConfidence: job.parsingMetadata?.averageConfidence || 0,
    },
    'audit.updatedAt': serverTimestamp(),
    'audit.updatedBy': userId,
  });

  // Update job status
  const jobRef = doc(db, PARSING_JOBS_COLLECTION, jobId);
  await updateDoc(jobRef, {
    status: 'applied',
    boqId: targetBoqId,
    completedAt: Timestamp.now(),
    updatedAt: serverTimestamp(),
  });
};

const calculateSummary = (sections: any[]) => {
  let totalLabor = 0;
  let totalMaterial = 0;
  let totalEquipment = 0;
  let totalAmount = 0;

  for (const section of sections) {
    for (const item of section.items) {
      totalLabor += item.laborAmount || 0;
      totalMaterial += item.materialAmount || 0;
      totalEquipment += item.equipmentAmount || 0;
      totalAmount += item.totalAmount || 0;
    }
  }

  return {
    totalLabor: { amount: totalLabor, currency: 'UGX' },
    totalMaterial: { amount: totalMaterial, currency: 'UGX' },
    totalEquipment: { amount: totalEquipment, currency: 'UGX' },
    subtotal: { amount: totalAmount, currency: 'UGX' },
    contingency: { amount: totalAmount * 0.05, currency: 'UGX' },
    grandTotal: { amount: totalAmount * 1.05, currency: 'UGX' },
    itemCount: sections.reduce((sum, s) => sum + s.items.length, 0),
    sectionCount: sections.length,
  };
};

// ============================================================================
// EXCEL PARSING (CLIENT-SIDE)
// ============================================================================

export interface ParsedExcelData {
  headers: string[];
  rows: Record<string, any>[];
  sheetName: string;
}

/**
 * Parse Excel file to JSON
 */
export const parseExcelFile = async (
  file: File,
  sheetName?: string
): Promise<ParsedExcelData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const targetSheet = sheetName || workbook.SheetNames[0];
        const sheet = workbook.Sheets[targetSheet];

        if (!sheet) {
          throw new Error(`Sheet "${targetSheet}" not found`);
        }

        // Get headers from first row
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        const headers = jsonData[0]?.map((h) => String(h || '')) || [];

        // Get data rows
        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

        resolve({
          headers,
          rows,
          sheetName: targetSheet,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Parse ALL sheets from an Excel file
 * Returns combined rows from all BOQ-like sheets with sheet name prefixed to bill tracking
 */
export const parseAllExcelSheets = async (
  file: File
): Promise<ParsedExcelData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const allRows: Record<string, any>[] = [];
        let combinedHeaders: string[] = [];
        const sheetNames: string[] = [];
        const skippedSheets: string[] = [];

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;

          // Get headers from first row
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          const headers = jsonData[0]?.map((h) => String(h || '')) || [];

          // Check if this looks like a BOQ sheet using headers + content heuristics
          const boqKeywords = ['item', 'description', 'qty', 'quantity', 'unit', 'rate', 'amount'];
          const headerText = headers.join(' ').toLowerCase();
          const headerMatchCount = boqKeywords.filter((kw) => headerText.includes(kw)).length;

          // Secondary check: scan first 10 data rows for numeric columns (quantities/amounts)
          let hasNumericData = false;
          if (headerMatchCount < 2) {
            for (let r = 1; r < Math.min(11, jsonData.length); r++) {
              const row = jsonData[r] || [];
              const numericCols = row.filter(
                (cell: any) => cell != null && !isNaN(parseFloat(String(cell))) && parseFloat(String(cell)) > 0
              );
              if (numericCols.length >= 2) {
                hasNumericData = true;
                break;
              }
            }
          }

          // Accept sheets with ≥1 keyword match + numeric data, or ≥2 keyword matches
          if (headerMatchCount < 2 && !(headerMatchCount >= 1 && hasNumericData)) {
            skippedSheets.push(sheetName);
            continue;
          }

          // Use first valid headers as combined headers
          if (combinedHeaders.length === 0) {
            combinedHeaders = headers;
          }

          // Get data rows and add sheet source
          const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];
          
          // Add a marker row to indicate sheet/bill change
          if (rows.length > 0) {
            allRows.push({
              __sheetName: sheetName,
              __isSheetHeader: true,
              description: `BILL: ${sheetName}`,
              itemCode: '',
            });
          }
          
          // Add rows with sheet source tracking
          for (const row of rows) {
            allRows.push({
              ...row,
              __sheetName: sheetName,
            });
          }
          
          sheetNames.push(sheetName);
        }

        console.log(`[parseAllExcelSheets] Parsed ${sheetNames.length} BOQ sheets: ${sheetNames.join(', ')}`);
        console.log(`[parseAllExcelSheets] Total rows: ${allRows.length}`);
        if (skippedSheets.length > 0) {
          console.warn(`[parseAllExcelSheets] Skipped ${skippedSheets.length} non-BOQ sheets: ${skippedSheets.join(', ')}`);
        }

        resolve({
          headers: combinedHeaders,
          rows: allRows,
          sheetName: sheetNames.join(', '),
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const boqParserService = {
  uploadBOQFile,
  startParsing,
  parseLocally,
  getParsingJob,
  subscribeToParsingJob,
  cancelParsing,
  startReview,
  updateItemReview,
  completeReview,
  parseAllExcelSheets,
  applyToBOQ,
  applyToBOQLocally,
  parseExcelFile,
};

export default boqParserService;
