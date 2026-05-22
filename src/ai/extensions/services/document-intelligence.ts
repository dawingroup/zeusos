/**
 * Document Intelligence Service
 * AI-powered document parsing and data extraction
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../firebase/config';
import {
  DocumentAnalysis,
  DocumentType,
  ExtractedField,
  ExtractedTable,
  ExtractedAmount,
  ExtractedDate,
  ExtractedReference,
  ValidationResult,
  IPCExtraction,
  BOQExtraction,
  BOQSection,
  LinkableEntityType,
  ModuleType,
} from '../types/ai-extensions';

// Document type detection patterns
const DOCUMENT_PATTERNS: Array<{
  type: DocumentType;
  patterns: RegExp[];
  suggestedModule: ModuleType;
  suggestedEntityType: LinkableEntityType;
}> = [
  {
    type: 'ipc',
    patterns: [
      /interim\s+payment\s+certificate/i,
      /IPC[-\s]?\d+/i,
      /certificate\s+(?:no|number|#)/i,
      /certified\s+amount/i,
    ],
    suggestedModule: 'infrastructure',
    suggestedEntityType: 'ipc',
  },
  {
    type: 'requisition',
    patterns: [
      /requisition/i,
      /material\s+request/i,
      /purchase\s+requisition/i,
    ],
    suggestedModule: 'infrastructure',
    suggestedEntityType: 'requisition',
  },
  {
    type: 'boq',
    patterns: [
      /bill\s+of\s+quantit/i,
      /BOQ/i,
      /schedule\s+of\s+rates/i,
      /item\s+description\s+unit\s+qty/i,
    ],
    suggestedModule: 'matflow',
    suggestedEntityType: 'boq',
  },
  {
    type: 'contract',
    patterns: [
      /contract\s+agreement/i,
      /terms\s+and\s+conditions/i,
      /parties\s+agree/i,
    ],
    suggestedModule: 'infrastructure',
    suggestedEntityType: 'project',
  },
  {
    type: 'invoice',
    patterns: [
      /invoice/i,
      /tax\s+invoice/i,
      /bill\s+to/i,
      /payment\s+due/i,
    ],
    suggestedModule: 'matflow',
    suggestedEntityType: 'purchaseOrder',
  },
  {
    type: 'valuation',
    patterns: [
      /valuation/i,
      /progress\s+valuation/i,
      /work\s+done\s+to\s+date/i,
    ],
    suggestedModule: 'infrastructure',
    suggestedEntityType: 'project',
  },
];

export class DocumentIntelligenceService {
  private analysesRef = collection(db, 'documentAnalyses');

  /**
   * Analyze a document
   */
  async analyzeDocument(
    documentId: string,
    content: string,
    _mimeType: string
  ): Promise<DocumentAnalysis> {
    const startTime = Date.now();

    // Detect document type
    const { documentType, confidence, suggestedModule, suggestedEntityType } =
      this.detectDocumentType(content);

    // Extract structured data
    const extractedFields = this.extractFields(content, documentType);
    const extractedTables = this.extractTables(content);
    const extractedAmounts = this.extractAmounts(content);
    const extractedDates = this.extractDates(content);
    const extractedReferences = this.extractReferences(content);

    // Validate extracted data
    const validationResults = this.validateExtraction(
      documentType,
      extractedFields,
      extractedAmounts
    );

    const analysis: DocumentAnalysis = {
      id: `analysis_${Date.now()}`,
      documentId,
      documentType,
      extractedFields,
      extractedTables,
      extractedAmounts,
      extractedDates,
      extractedReferences,
      confidence,
      suggestedModule,
      suggestedEntityType,
      validationResults,
      analyzedAt: new Date(),
      processingTime: Date.now() - startTime,
      modelVersion: '1.0.0',
    };

    await this.storeAnalysis(analysis);
    return analysis;
  }

  /**
   * Detect document type from content
   */
  private detectDocumentType(content: string): {
    documentType: DocumentType;
    confidence: number;
    suggestedModule: ModuleType;
    suggestedEntityType: LinkableEntityType;
  } {
    let bestMatch: DocumentType = 'unknown';
    let bestScore = 0;
    let suggestedModule: ModuleType = 'infrastructure';
    let suggestedEntityType: LinkableEntityType = 'project';

    for (const { type, patterns, suggestedModule: module, suggestedEntityType: entityType } of DOCUMENT_PATTERNS) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
        suggestedModule = module;
        suggestedEntityType = entityType;
      }
    }

    const confidence = bestScore > 0 ? Math.min(0.95, 0.5 + bestScore * 0.15) : 0.3;

    return {
      documentType: bestMatch,
      confidence,
      suggestedModule,
      suggestedEntityType,
    };
  }

  /**
   * Extract fields based on document type
   */
  private extractFields(content: string, documentType: DocumentType): ExtractedField[] {
    const fields: ExtractedField[] = [];

    // Common field patterns
    const projectRefMatch = content.match(/project\s*(?:ref|reference|no|number|#)?[:\s]*([A-Z0-9/-]+)/i);
    if (projectRefMatch) {
      fields.push({
        name: 'projectReference',
        value: projectRefMatch[1].trim(),
        confidence: 0.8,
      });
    }

    const contractRefMatch = content.match(/contract\s*(?:ref|reference|no|number|#)?[:\s]*([A-Z0-9/-]+)/i);
    if (contractRefMatch) {
      fields.push({
        name: 'contractReference',
        value: contractRefMatch[1].trim(),
        confidence: 0.8,
      });
    }

    // Document-type specific extractions
    if (documentType === 'ipc') {
      const certNoMatch = content.match(/(?:certificate|IPC)\s*(?:no|number|#)?[:\s]*([A-Z0-9/-]+)/i);
      if (certNoMatch) {
        fields.push({
          name: 'certificateNumber',
          value: certNoMatch[1].trim(),
          confidence: 0.85,
        });
      }

      const contractorMatch = content.match(/contractor[:\s]*([^\n,]+)/i);
      if (contractorMatch) {
        fields.push({
          name: 'contractor',
          value: contractorMatch[1].trim(),
          confidence: 0.75,
        });
      }
    }

    if (documentType === 'requisition') {
      const reqNoMatch = content.match(/requisition\s*(?:no|number|#)?[:\s]*([A-Z0-9/-]+)/i);
      if (reqNoMatch) {
        fields.push({
          name: 'requisitionNumber',
          value: reqNoMatch[1].trim(),
          confidence: 0.85,
        });
      }
    }

    return fields;
  }

  /**
   * Extract tables from content
   */
  private extractTables(content: string): ExtractedTable[] {
    const tables: ExtractedTable[] = [];

    // Look for table-like patterns (simplified)
    const tablePattern = /(?:item|no|s\/n)[^\n]*(?:description|particulars)[^\n]*(?:unit|qty|quantity)[^\n]*(?:rate|price)[^\n]*(?:amount|total)/i;
    
    if (tablePattern.test(content)) {
      // Extract lines that look like table rows
      const lines = content.split('\n');
      const dataRows: string[][] = [];
      let headers: string[] = [];

      for (const line of lines) {
        // Simple heuristic: lines with multiple numbers are likely table rows
        const numbers = line.match(/[\d,]+\.?\d*/g);
        if (numbers && numbers.length >= 2) {
          const parts = line.split(/\s{2,}|\t/).filter(p => p.trim());
          if (parts.length >= 3) {
            if (headers.length === 0 && isNaN(parseFloat(parts[0]))) {
              headers = parts;
            } else {
              dataRows.push(parts);
            }
          }
        }
      }

      if (dataRows.length > 0) {
        tables.push({
          name: 'MainTable',
          headers: headers.length > 0 ? headers : ['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount'],
          rows: dataRows.slice(0, 50), // Limit rows
          confidence: 0.7,
        });
      }
    }

    return tables;
  }

  /**
   * Extract monetary amounts from content
   */
  private extractAmounts(content: string): ExtractedAmount[] {
    const amounts: ExtractedAmount[] = [];
    const currencyPatterns = [
      { currency: 'UGX', pattern: /UGX\.?\s*([\d,]+(?:\.\d{2})?)/gi },
      { currency: 'USD', pattern: /USD\.?\s*([\d,]+(?:\.\d{2})?)/gi },
      { currency: 'USD', pattern: /\$\s*([\d,]+(?:\.\d{2})?)/gi },
      { currency: 'KES', pattern: /KES\.?\s*([\d,]+(?:\.\d{2})?)/gi },
    ];

    // Extract labeled amounts
    const labeledAmountPattern = /(total|subtotal|net|gross|amount|value|budget|certified|cumulative)[:\s]*([\d,]+(?:\.\d{2})?)/gi;
    let match;
    
    while ((match = labeledAmountPattern.exec(content)) !== null) {
      const amount = parseFloat(match[2].replace(/,/g, ''));
      if (amount > 0) {
        amounts.push({
          label: match[1].toLowerCase(),
          amount,
          currency: 'UGX', // Default to UGX for Uganda context
          confidence: 0.75,
        });
      }
    }

    // Extract currency-prefixed amounts
    for (const { currency, pattern } of currencyPatterns) {
      while ((match = pattern.exec(content)) !== null) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (amount > 0 && !amounts.some(a => a.amount === amount)) {
          amounts.push({
            label: 'amount',
            amount,
            currency,
            confidence: 0.8,
          });
        }
      }
    }

    return amounts;
  }

  /**
   * Extract dates from content
   */
  private extractDates(content: string): ExtractedDate[] {
    const dates: ExtractedDate[] = [];
    
    // Extract labeled dates
    const labeledDatePattern = /(date|period|from|to|due|submission|approval)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/gi;
    let match;
    
    while ((match = labeledDatePattern.exec(content)) !== null) {
      try {
        const parts = match[2].split(/[\/\-]/);
        const date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (!isNaN(date.getTime())) {
          dates.push({
            label: match[1].toLowerCase(),
            date,
            confidence: 0.8,
          });
        }
      } catch {
        // Skip invalid dates
      }
    }

    return dates;
  }

  /**
   * Extract reference numbers from content
   */
  private extractReferences(content: string): ExtractedReference[] {
    const references: ExtractedReference[] = [];

    // Project references
    const projectRefs = content.match(/(?:project|proj)[.\s]*(?:ref|no|#)?[:\s]*([A-Z0-9\/-]+)/gi);
    if (projectRefs) {
      for (const ref of projectRefs) {
        const value = ref.replace(/(?:project|proj)[.\s]*(?:ref|no|#)?[:\s]*/i, '').trim();
        if (value && !references.some(r => r.value === value)) {
          references.push({ type: 'project', value, confidence: 0.8 });
        }
      }
    }

    // Contract references
    const contractRefs = content.match(/(?:contract)[.\s]*(?:ref|no|#)?[:\s]*([A-Z0-9\/-]+)/gi);
    if (contractRefs) {
      for (const ref of contractRefs) {
        const value = ref.replace(/(?:contract)[.\s]*(?:ref|no|#)?[:\s]*/i, '').trim();
        if (value && !references.some(r => r.value === value)) {
          references.push({ type: 'contract', value, confidence: 0.8 });
        }
      }
    }

    // Certificate references
    const certRefs = content.match(/(?:certificate|IPC)[.\s]*(?:ref|no|#)?[:\s]*([A-Z0-9\/-]+)/gi);
    if (certRefs) {
      for (const ref of certRefs) {
        const value = ref.replace(/(?:certificate|IPC)[.\s]*(?:ref|no|#)?[:\s]*/i, '').trim();
        if (value && !references.some(r => r.value === value)) {
          references.push({ type: 'certificate', value, confidence: 0.8 });
        }
      }
    }

    // Invoice references
    const invoiceRefs = content.match(/(?:invoice)[.\s]*(?:ref|no|#)?[:\s]*([A-Z0-9\/-]+)/gi);
    if (invoiceRefs) {
      for (const ref of invoiceRefs) {
        const value = ref.replace(/(?:invoice)[.\s]*(?:ref|no|#)?[:\s]*/i, '').trim();
        if (value && !references.some(r => r.value === value)) {
          references.push({ type: 'invoice', value, confidence: 0.8 });
        }
      }
    }

    // PO references
    const poRefs = content.match(/(?:PO|purchase\s*order)[.\s]*(?:ref|no|#)?[:\s]*([A-Z0-9\/-]+)/gi);
    if (poRefs) {
      for (const ref of poRefs) {
        const value = ref.replace(/(?:PO|purchase\s*order)[.\s]*(?:ref|no|#)?[:\s]*/i, '').trim();
        if (value && !references.some(r => r.value === value)) {
          references.push({ type: 'po', value, confidence: 0.8 });
        }
      }
    }

    return references;
  }

  /**
   * Validate extracted data
   */
  private validateExtraction(
    documentType: DocumentType,
    fields: ExtractedField[],
    amounts: ExtractedAmount[]
  ): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check for required fields based on document type
    if (documentType === 'ipc') {
      const hasCertNo = fields.some(f => f.name === 'certificateNumber');
      if (!hasCertNo) {
        results.push({
          field: 'certificateNumber',
          status: 'warning',
          message: 'Certificate number not found',
        });
      }

      const hasTotalAmount = amounts.some(a => a.label.includes('total') || a.label.includes('net'));
      if (!hasTotalAmount) {
        results.push({
          field: 'totalAmount',
          status: 'warning',
          message: 'Total/Net amount not clearly identified',
        });
      }
    }

    if (documentType === 'boq') {
      const hasProjectRef = fields.some(f => f.name === 'projectReference');
      if (!hasProjectRef) {
        results.push({
          field: 'projectReference',
          status: 'warning',
          message: 'Project reference not found',
        });
      }
    }

    // Validate amount consistency
    const totals = amounts.filter(a => a.label.includes('total'));
    const subtotals = amounts.filter(a => a.label.includes('subtotal'));
    if (totals.length > 0 && subtotals.length > 0) {
      const totalSum = totals.reduce((sum, a) => sum + a.amount, 0);
      const subtotalSum = subtotals.reduce((sum, a) => sum + a.amount, 0);
      if (Math.abs(totalSum - subtotalSum) > 1) {
        results.push({
          field: 'amounts',
          status: 'warning',
          message: 'Subtotals may not match total',
          suggestedValue: { totalSum, subtotalSum },
        });
      }
    }

    return results;
  }

  /**
   * Analyze IPC document specifically
   */
  async analyzeIPC(
    documentId: string,
    content: string
  ): Promise<DocumentAnalysis & { ipcData: IPCExtraction }> {
    const baseAnalysis = await this.analyzeDocument(documentId, content, 'application/pdf');

    // Extract IPC-specific data
    const ipcData = this.extractIPCData(content, baseAnalysis);

    return {
      ...baseAnalysis,
      ipcData,
    };
  }

  /**
   * Extract IPC-specific data
   */
  private extractIPCData(_content: string, analysis: DocumentAnalysis): IPCExtraction {
    // Get certificate number from extracted fields
    const certNoField = analysis.extractedFields.find(f => f.name === 'certificateNumber');
    const projectRefField = analysis.extractedFields.find(f => f.name === 'projectReference');
    const contractRefField = analysis.extractedFields.find(f => f.name === 'contractReference');
    const contractorField = analysis.extractedFields.find(f => f.name === 'contractor');

    // Get amounts
    const amounts = analysis.extractedAmounts;
    const cumulativeAmount = amounts.find(a => a.label.includes('cumulative'))?.amount || 0;
    const previousAmount = amounts.find(a => a.label.includes('previous'))?.amount || 0;
    const currentAmount = amounts.find(a => a.label.includes('current'))?.amount || 
      amounts.find(a => a.label.includes('certified'))?.amount || 0;
    const retentionAmount = amounts.find(a => a.label.includes('retention'))?.amount || 0;
    const advanceAmount = amounts.find(a => a.label.includes('advance'))?.amount || 0;
    const netAmount = amounts.find(a => a.label.includes('net'))?.amount ||
      amounts.find(a => a.label.includes('payable'))?.amount || 0;

    // Get dates
    const dates = analysis.extractedDates;
    const periodFrom = dates.find(d => d.label === 'from')?.date;
    const periodTo = dates.find(d => d.label === 'to')?.date;

    return {
      certificateNumber: certNoField?.value as string || 'Unknown',
      projectReference: projectRefField?.value as string || 'Unknown',
      contractReference: contractRefField?.value as string,
      periodFrom: periodFrom?.toISOString().split('T')[0] || '',
      periodTo: periodTo?.toISOString().split('T')[0] || '',
      cumulativeWorkDone: cumulativeAmount,
      previousCertificates: previousAmount,
      currentCertificate: currentAmount,
      retention: retentionAmount,
      advanceRecovery: advanceAmount,
      netPayable: netAmount,
      contractor: contractorField?.value as string || 'Unknown',
      certifyingOfficer: undefined,
      status: 'submitted',
    };
  }

  /**
   * Analyze BOQ document
   */
  async analyzeBOQ(
    documentId: string,
    content: string
  ): Promise<DocumentAnalysis & { boqData: BOQExtraction }> {
    const baseAnalysis = await this.analyzeDocument(documentId, content, 'application/pdf');

    // Extract BOQ-specific data
    const boqData = this.extractBOQData(content, baseAnalysis);

    return {
      ...baseAnalysis,
      boqData,
    };
  }

  /**
   * Extract BOQ-specific data
   */
  private extractBOQData(_content: string, analysis: DocumentAnalysis): BOQExtraction {
    const projectRefField = analysis.extractedFields.find(f => f.name === 'projectReference');
    
    // Get total amount
    const grandTotal = analysis.extractedAmounts.find(a => 
      a.label.includes('grand') || a.label.includes('total')
    )?.amount || 0;

    // Convert extracted tables to BOQ sections
    const sections: BOQSection[] = [];
    
    for (const table of analysis.extractedTables) {
      const items = table.rows.map((row, idx) => ({
        itemNumber: row[0] || String(idx + 1),
        description: row[1] || '',
        unit: row[2] || 'No.',
        quantity: parseFloat(row[3]?.replace(/,/g, '') || '0'),
        rate: parseFloat(row[4]?.replace(/,/g, '') || '0'),
        amount: parseFloat(row[5]?.replace(/,/g, '') || '0'),
      }));

      const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

      sections.push({
        name: table.name || 'Items',
        items,
        subtotal,
      });
    }

    return {
      projectReference: projectRefField?.value as string || 'Unknown',
      preparedBy: undefined,
      datePrepared: undefined,
      currency: 'UGX',
      sections,
      grandTotal,
    };
  }

  /**
   * Store analysis
   */
  private async storeAnalysis(analysis: DocumentAnalysis): Promise<string> {
    const docRef = await addDoc(this.analysesRef, {
      ...analysis,
      analyzedAt: serverTimestamp(),
    });
    return docRef.id;
  }

  /**
   * Get analysis by document ID
   */
  async getAnalysis(documentId: string): Promise<DocumentAnalysis | null> {
    const q = query(
      this.analysesRef,
      where('documentId', '==', documentId),
      orderBy('analyzedAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
      analyzedAt: doc.data().analyzedAt?.toDate() || new Date(),
    } as DocumentAnalysis;
  }
}

export const documentIntelligenceService = new DocumentIntelligenceService();
