/**
 * EFRIS Tax Invoice Validation Service
 * Handles invoice validation with URA's EFRIS system
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/core/services/firebase';
import {
  EFRISInvoice,
  EFRISInvoiceStatus,
  EFRISValidationRequest,
  EFRISValidationResponse,
  InvoiceValidationRecord,
  InvoiceMatchResult,
  SupplierTaxProfile,
  TaxComplianceSummary,
  EFRISSettings,
  FiscalDocumentNumber,
  DeliveryLogForValidation,
} from '../types/efris';

// Collection references
const getInvoiceValidationsRef = (projectId: string) =>
  collection(db, 'advisory_projects', projectId, 'invoiceValidations');

const getSupplierTaxProfilesRef = () =>
  collection(db, 'supplierTaxProfiles');

// Default EFRIS settings
const DEFAULT_EFRIS_SETTINGS: EFRISSettings = {
  enabled: true,
  autoValidate: true,
  requireValidation: false,
  amountTolerancePercent: 1,
  cacheExpiryHours: 24,
};

/**
 * Parse Fiscal Document Number
 */
export function parseFDN(fdn: string): FiscalDocumentNumber | null {
  // FDN format: XXXXXXXX-YYYYYYYY-ZZZZ
  // Device Number - Fiscal Doc Number - Verification Code
  const fdnRegex = /^([A-Z0-9]{8})-(\d{8})-([A-Z0-9]{4})$/;
  const match = fdn.trim().toUpperCase().match(fdnRegex);
  
  if (!match) {
    return null;
  }
  
  return {
    fdn: match[0],
    deviceNumber: match[1],
    fiscalDocNumber: match[2],
    verificationCode: match[3],
  };
}

/**
 * Validate FDN format
 */
export function isValidFDN(fdn: string): boolean {
  return parseFDN(fdn) !== null;
}

/**
 * Validate invoice with EFRIS
 */
export async function validateInvoice(
  request: EFRISValidationRequest
): Promise<EFRISValidationResponse> {
  try {
    // Call Cloud Function for EFRIS API
    const validateEFRIS = httpsCallable<EFRISValidationRequest, EFRISValidationResponse>(
      functions,
      'validateEFRISInvoice'
    );
    
    const result = await validateEFRIS(request);
    return result.data;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to validate invoice';
    console.error('EFRIS validation error:', error);
    return {
      success: false,
      status: 'invalid',
      error: {
        code: 'VALIDATION_ERROR',
        message: errorMessage,
      },
      validatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Validate invoice and save record
 */
export async function validateAndSaveInvoice(
  projectId: string,
  fdn: string,
  delivery: DeliveryLogForValidation,
  userId: string
): Promise<InvoiceValidationRecord> {
  // Parse FDN
  const parsedFdn = parseFDN(fdn);
  if (!parsedFdn) {
    throw new Error('Invalid Fiscal Document Number format');
  }
  
  // Check cache first
  const cached = await getCachedValidation(projectId, fdn);
  if (cached && !isCacheExpired(cached)) {
    return cached;
  }
  
  // Validate with EFRIS
  const validationResponse = await validateInvoice({
    fdn: parsedFdn.fdn,
    invoiceAmount: delivery.totalCost,
  });
  
  // Create validation record
  const now = new Date().toISOString();
  const recordId = `${projectId}_${parsedFdn.fdn.replace(/-/g, '_')}`;
  
  const record: InvoiceValidationRecord = {
    id: recordId,
    projectId,
    deliveryId: delivery.id,
    fdn: parsedFdn.fdn,
    invoiceNumber: validationResponse.invoice?.invoiceNumber || '',
    invoiceDate: validationResponse.invoice?.invoiceDate || '',
    supplierTin: validationResponse.invoice?.seller.tin || delivery.supplierInfo?.tin || '',
    supplierName: validationResponse.invoice?.seller.name || delivery.supplierName,
    subtotal: validationResponse.invoice?.amounts.subtotal || 0,
    vatAmount: validationResponse.invoice?.amounts.vatAmount || 0,
    totalAmount: validationResponse.invoice?.amounts.totalAmount || delivery.totalCost || 0,
    currency: validationResponse.invoice?.amounts.currency || 'UGX',
    validationStatus: validationResponse.status,
    validatedAt: validationResponse.success ? now : undefined,
    validationError: validationResponse.error?.message,
    amountMatches: false,
    supplierMatches: false,
    itemsMatched: 0,
    itemsTotal: delivery.items?.length || 0,
    efrisInvoice: validationResponse.invoice,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    lastValidationAttempt: now,
  };
  
  // Calculate matches if validation succeeded
  if (validationResponse.success && validationResponse.invoice) {
    const matchResult = calculateInvoiceMatch(delivery, validationResponse.invoice);
    record.amountMatches = matchResult.amountMatch.matches;
    record.supplierMatches = matchResult.supplierMatch.matches;
    record.itemsMatched = matchResult.itemMatches.filter(m => m.matchStatus === 'matched').length;
  }
  
  // Save to Firestore
  await setDoc(
    doc(getInvoiceValidationsRef(projectId), recordId),
    record
  );
  
  return record;
}

/**
 * Get cached validation
 */
async function getCachedValidation(
  projectId: string,
  fdn: string
): Promise<InvoiceValidationRecord | null> {
  const recordId = `${projectId}_${fdn.replace(/-/g, '_')}`;
  const docSnap = await getDoc(doc(getInvoiceValidationsRef(projectId), recordId));
  
  if (docSnap.exists()) {
    return docSnap.data() as InvoiceValidationRecord;
  }
  
  return null;
}

/**
 * Check if cache is expired
 */
function isCacheExpired(
  record: InvoiceValidationRecord,
  expiryHours: number = DEFAULT_EFRIS_SETTINGS.cacheExpiryHours
): boolean {
  if (!record.validatedAt) return true;
  
  const validatedTime = new Date(record.validatedAt).getTime();
  const expiryTime = validatedTime + (expiryHours * 60 * 60 * 1000);
  
  return Date.now() > expiryTime;
}

/**
 * Calculate invoice match with delivery
 */
export function calculateInvoiceMatch(
  delivery: DeliveryLogForValidation,
  invoice: EFRISInvoice,
  tolerancePercent: number = DEFAULT_EFRIS_SETTINGS.amountTolerancePercent
): InvoiceMatchResult {
  const warnings: string[] = [];
  
  // Amount matching
  const expectedAmount = delivery.totalCost || 0;
  const invoiceAmount = invoice.amounts.totalAmount;
  const variance = invoiceAmount - expectedAmount;
  const variancePercent = expectedAmount > 0 
    ? (Math.abs(variance) / expectedAmount) * 100 
    : 0;
  const amountMatches = variancePercent <= tolerancePercent;
  
  if (!amountMatches) {
    warnings.push(
      `Amount variance: ${variance.toLocaleString()} ${invoice.amounts.currency} (${variancePercent.toFixed(1)}%)` 
    );
  }
  
  // Supplier matching
  const expectedSupplier = delivery.supplierName.toLowerCase().trim();
  const invoiceSupplier = invoice.seller.name.toLowerCase().trim();
  const invoiceTradeName = invoice.seller.tradeName?.toLowerCase().trim() || '';
  const tinMatches = delivery.supplierInfo?.tin === invoice.seller.tin;
  
  const supplierMatches = 
    tinMatches ||
    expectedSupplier.includes(invoiceSupplier) ||
    invoiceSupplier.includes(expectedSupplier) ||
    expectedSupplier.includes(invoiceTradeName) ||
    invoiceTradeName.includes(expectedSupplier);
  
  if (!supplierMatches) {
    warnings.push(
      `Supplier mismatch: expected "${delivery.supplierName}", invoice shows "${invoice.seller.name}"` 
    );
  }
  
  // Item matching (fuzzy match on descriptions)
  const itemMatches: InvoiceMatchResult['itemMatches'] = [];
  const deliveryItems = delivery.items || [];
  const invoiceItems = [...invoice.items];
  
  for (const deliveryItem of deliveryItems) {
    let bestMatch: { lineNumber: number; confidence: number; item: EFRISInvoice['items'][0] } | null = null;
    
    for (const invoiceItem of invoiceItems) {
      const confidence = calculateItemMatchConfidence(
        deliveryItem.materialName,
        deliveryItem.quantity,
        invoiceItem.description,
        invoiceItem.quantity
      );
      
      if (confidence > (bestMatch?.confidence || 50)) {
        bestMatch = { lineNumber: invoiceItem.lineNumber, confidence, item: invoiceItem };
      }
    }
    
    if (bestMatch && bestMatch.confidence >= 70) {
      itemMatches.push({
        deliveryItemId: deliveryItem.materialId,
        deliveryItemName: deliveryItem.materialName,
        deliveryQuantity: deliveryItem.quantity,
        invoiceLineNumber: bestMatch.lineNumber,
        invoiceDescription: bestMatch.item.description,
        invoiceQuantity: bestMatch.item.quantity,
        matchStatus: bestMatch.confidence >= 90 ? 'matched' : 'partial',
        matchConfidence: bestMatch.confidence,
      });
      
      // Remove matched item
      const idx = invoiceItems.findIndex(i => i.lineNumber === bestMatch!.lineNumber);
      if (idx >= 0) invoiceItems.splice(idx, 1);
    } else {
      itemMatches.push({
        deliveryItemId: deliveryItem.materialId,
        deliveryItemName: deliveryItem.materialName,
        deliveryQuantity: deliveryItem.quantity,
        matchStatus: 'unmatched',
        matchConfidence: bestMatch?.confidence || 0,
      });
    }
  }
  
  // Determine overall match
  let overallMatch: InvoiceMatchResult['overallMatch'] = 'unverified';
  if (amountMatches && supplierMatches && itemMatches.every(m => m.matchStatus === 'matched')) {
    overallMatch = 'exact';
  } else if (amountMatches || supplierMatches) {
    overallMatch = 'partial';
  } else {
    overallMatch = 'mismatch';
  }
  
  return {
    overallMatch,
    amountMatch: {
      matches: amountMatches,
      expectedAmount,
      invoiceAmount,
      variance,
      variancePercent,
    },
    supplierMatch: {
      matches: supplierMatches,
      expectedSupplier: delivery.supplierName,
      invoiceSupplier: invoice.seller.name,
      tinMatches,
    },
    itemMatches,
    warnings,
  };
}

/**
 * Calculate item match confidence
 */
function calculateItemMatchConfidence(
  deliveryName: string,
  deliveryQty: number,
  invoiceDesc: string,
  invoiceQty: number
): number {
  let confidence = 0;
  
  // Normalize strings
  const normalizedDelivery = deliveryName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedInvoice = invoiceDesc.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Check for substring match
  if (normalizedInvoice.includes(normalizedDelivery) || 
      normalizedDelivery.includes(normalizedInvoice)) {
    confidence += 50;
  }
  
  // Check common material keywords
  const keywords = ['cement', 'sand', 'aggregate', 'steel', 'rebar', 'brick', 
                    'paint', 'pipe', 'wire', 'timber', 'wood', 'tile'];
  for (const keyword of keywords) {
    if (normalizedDelivery.includes(keyword) && normalizedInvoice.includes(keyword)) {
      confidence += 20;
      break;
    }
  }
  
  // Quantity match
  const qtyVariance = Math.abs(deliveryQty - invoiceQty) / Math.max(deliveryQty, invoiceQty);
  if (qtyVariance <= 0.01) confidence += 30;
  else if (qtyVariance <= 0.05) confidence += 20;
  else if (qtyVariance <= 0.1) confidence += 10;
  
  return Math.min(confidence, 100);
}

/**
 * Get validation records for project
 */
export async function getProjectValidations(
  projectId: string,
  status?: EFRISInvoiceStatus
): Promise<InvoiceValidationRecord[]> {
  let q = query(
    getInvoiceValidationsRef(projectId),
    orderBy('createdAt', 'desc')
  );
  
  if (status) {
    q = query(
      getInvoiceValidationsRef(projectId),
      where('validationStatus', '==', status),
      orderBy('createdAt', 'desc')
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as InvoiceValidationRecord);
}

/**
 * Get validation for specific delivery
 */
export async function getDeliveryValidation(
  projectId: string,
  deliveryId: string
): Promise<InvoiceValidationRecord | null> {
  const q = query(
    getInvoiceValidationsRef(projectId),
    where('deliveryId', '==', deliveryId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : snapshot.docs[0].data() as InvoiceValidationRecord;
}

/**
 * Revalidate invoice
 */
export async function revalidateInvoice(
  projectId: string,
  validationId: string,
  _userId: string
): Promise<InvoiceValidationRecord> {
  const docRef = doc(getInvoiceValidationsRef(projectId), validationId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error('Validation record not found');
  }
  
  const record = docSnap.data() as InvoiceValidationRecord;
  
  // Revalidate with EFRIS
  const validationResponse = await validateInvoice({
    fdn: record.fdn,
    sellerTin: record.supplierTin,
    invoiceAmount: record.totalAmount,
  });
  
  const now = new Date().toISOString();
  
  // Update record
  await updateDoc(docRef, {
    validationStatus: validationResponse.status,
    validatedAt: validationResponse.success ? now : record.validatedAt,
    validationError: validationResponse.error?.message,
    efrisInvoice: validationResponse.invoice || record.efrisInvoice,
    updatedAt: now,
    lastValidationAttempt: now,
  });
  
  return {
    ...record,
    validationStatus: validationResponse.status,
    validatedAt: validationResponse.success ? now : record.validatedAt,
    validationError: validationResponse.error?.message,
    efrisInvoice: validationResponse.invoice || record.efrisInvoice,
    updatedAt: now,
    lastValidationAttempt: now,
  };
}

/**
 * Verify supplier TIN
 */
export async function verifySupplierTIN(tin: string): Promise<SupplierTaxProfile | null> {
  try {
    const verifyTIN = httpsCallable<{ tin: string }, SupplierTaxProfile | null>(
      functions,
      'verifySupplierTIN'
    );
    
    const result = await verifyTIN({ tin });
    return result.data;
  } catch (error) {
    console.error('TIN verification error:', error);
    return null;
  }
}

/**
 * Save or update supplier tax profile
 */
export async function saveSupplierTaxProfile(
  profile: SupplierTaxProfile
): Promise<void> {
  await setDoc(
    doc(getSupplierTaxProfilesRef(), profile.supplierId),
    profile,
    { merge: true }
  );
}

/**
 * Get supplier tax profile
 */
export async function getSupplierTaxProfile(
  supplierId: string
): Promise<SupplierTaxProfile | null> {
  const docSnap = await getDoc(doc(getSupplierTaxProfilesRef(), supplierId));
  return docSnap.exists() ? docSnap.data() as SupplierTaxProfile : null;
}

/**
 * Calculate tax compliance summary
 */
export async function calculateTaxComplianceSummary(
  projectId: string,
  startDate: string,
  endDate: string
): Promise<TaxComplianceSummary> {
  const validations = await getProjectValidations(projectId);
  
  // Filter by date range
  const filtered = validations.filter(v => {
    const date = v.invoiceDate || v.createdAt;
    return date >= startDate && date <= endDate;
  });
  
  // Calculate invoice stats
  const total = filtered.length;
  const validated = filtered.filter(v => v.validationStatus === 'valid').length;
  const invalid = filtered.filter(v => 
    ['invalid', 'expired', 'cancelled', 'not_found'].includes(v.validationStatus)
  ).length;
  const pending = filtered.filter(v => v.validationStatus === 'pending').length;
  
  // Calculate amounts
  const withValid = filtered.filter(v => v.validationStatus === 'valid');
  const withInvalid = filtered.filter(v => 
    ['invalid', 'expired', 'cancelled', 'not_found'].includes(v.validationStatus)
  );
  const withPending = filtered.filter(v => v.validationStatus === 'pending');
  
  const totalPurchases = filtered.reduce((sum, v) => sum + v.totalAmount, 0);
  const vatRecoverable = withValid.reduce((sum, v) => sum + v.vatAmount, 0);
  const withValidInvoices = withValid.reduce((sum, v) => sum + v.totalAmount, 0);
  const withInvalidInvoices = withInvalid.reduce((sum, v) => sum + v.totalAmount, 0);
  const unvalidated = withPending.reduce((sum, v) => sum + v.totalAmount, 0);
  
  // Calculate supplier stats
  const supplierTins = new Set<string>();
  const vatRegisteredTins = new Set<string>();
  
  for (const v of filtered) {
    if (v.supplierTin) {
      supplierTins.add(v.supplierTin);
      if (v.efrisInvoice?.seller.vatRegistered) {
        vatRegisteredTins.add(v.supplierTin);
      }
    }
  }
  
  return {
    projectId,
    period: { startDate, endDate },
    invoices: { total, validated, invalid, pending },
    amounts: {
      totalPurchases,
      vatRecoverable,
      withValidInvoices,
      withInvalidInvoices,
      unvalidated,
    },
    suppliers: {
      total: supplierTins.size,
      vatRegistered: vatRegisteredTins.size,
      nonVatRegistered: supplierTins.size - vatRegisteredTins.size,
      suspended: 0, // Would need additional query
    },
    complianceRate: total > 0 ? (validated / total) * 100 : 0,
  };
}

/**
 * Batch validate pending invoices
 */
export async function batchValidatePending(
  projectId: string,
  _userId: string,
  maxCount: number = 10
): Promise<{ validated: number; failed: number }> {
  const pending = await getProjectValidations(projectId, 'pending');
  const toValidate = pending.slice(0, maxCount);
  
  let validated = 0;
  let failed = 0;
  
  for (const record of toValidate) {
    try {
      await revalidateInvoice(projectId, record.id, _userId);
      validated++;
    } catch (error) {
      console.error(`Failed to validate ${record.fdn}:`, error);
      failed++;
    }
  }
  
  return { validated, failed };
}

export const efrisService = {
  parseFDN,
  isValidFDN,
  validateInvoice,
  validateAndSaveInvoice,
  calculateInvoiceMatch,
  getProjectValidations,
  getDeliveryValidation,
  revalidateInvoice,
  verifySupplierTIN,
  saveSupplierTaxProfile,
  getSupplierTaxProfile,
  calculateTaxComplianceSummary,
  batchValidatePending,
};

export default efrisService;
