/**
 * Export and Reporting Service
 * Generates reports in PDF, Excel, CSV formats
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/core/services/firebase';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ReportConfig,
  ReportRecord,
  ReportTemplate,
  ReportType,
  BOQSummaryReportData,
  MaterialRequirementsReportData,
  VarianceAnalysisReportData,
  ProcurementLogReportData,
  TaxComplianceReportData,
  ProjectOverviewReportData,
  DataExportConfig,
  ReportData,
} from '../types/export';
import { calculateTaxComplianceSummary, getProjectValidations } from './efrisService';

// Collection references
const getReportsRef = (projectId: string) =>
  collection(db, 'advisory_projects', projectId, 'reports');

const getTemplatesRef = () =>
  collection(db, 'reportTemplates');

// Mock service functions (would be implemented in actual services)
async function getProjectById(projectId: string) {
  const docSnap = await getDoc(doc(db, 'advisory_projects', projectId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

async function getBOQStages(projectId: string) {
  const snapshot = await getDocs(collection(db, 'advisory_projects', projectId, 'stages'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getBOQItems(projectId: string) {
  const snapshot = await getDocs(collection(db, 'advisory_projects', projectId, 'boq_items'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getDeliveryLogs(projectId: string) {
  const snapshot = await getDocs(collection(db, 'advisory_projects', projectId, 'deliveries'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function getPurchaseOrders(projectId: string) {
  const snapshot = await getDocs(collection(db, 'advisory_projects', projectId, 'purchase_orders'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Generate a report
 */
export async function generateReport(
  config: ReportConfig,
  userId: string
): Promise<ReportRecord> {
  const reportId = `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  
  // Create initial record
  const record: ReportRecord = {
    id: reportId,
    projectId: config.projectId,
    config,
    status: 'generating',
    progress: 0,
    createdAt: now,
    createdBy: userId,
    downloadCount: 0,
  };
  
  await setDoc(doc(getReportsRef(config.projectId), reportId), record);
  
  try {
    // Generate report data based on type
    const reportData = await generateReportData(config);
    
    // Update progress
    await updateDoc(doc(getReportsRef(config.projectId), reportId), {
      progress: 50,
    });
    
    // Generate file in requested format
    const { blob, fileName } = await generateReportFile(config, reportData);
    
    // Update progress
    await updateDoc(doc(getReportsRef(config.projectId), reportId), {
      progress: 80,
    });
    
    // Upload to storage
    const storageRef = ref(storage, `reports/${config.projectId}/${reportId}/${fileName}`);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    
    // Calculate expiry (7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Update record with results
    const updatedRecord: Partial<ReportRecord> = {
      status: 'ready',
      progress: 100,
      fileName,
      fileSize: blob.size,
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
      generatedAt: new Date().toISOString(),
    };
    
    await updateDoc(doc(getReportsRef(config.projectId), reportId), updatedRecord);
    
    return { ...record, ...updatedRecord } as ReportRecord;
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
    console.error('Report generation error:', error);
    
    await updateDoc(doc(getReportsRef(config.projectId), reportId), {
      status: 'failed',
      error: errorMessage,
    });
    
    throw error;
  }
}

/**
 * Generate report data based on type
 */
async function generateReportData(config: ReportConfig): Promise<ReportData> {
  switch (config.type) {
    case 'boq_summary':
      return generateBOQSummaryData(config);
    case 'material_requirements':
      return generateMaterialRequirementsData(config);
    case 'variance_analysis':
      return generateVarianceAnalysisData(config);
    case 'procurement_log':
      return generateProcurementLogData(config);
    case 'tax_compliance':
      return generateTaxComplianceData(config);
    case 'project_overview':
      return generateProjectOverviewData(config);
    default:
      throw new Error(`Unknown report type: ${config.type}`);
  }
}

/**
 * Generate BOQ Summary Data
 */
async function generateBOQSummaryData(config: ReportConfig): Promise<BOQSummaryReportData> {
  const project = await getProjectById(config.projectId);
  const stages = await getBOQStages(config.projectId);
  const items = await getBOQItems(config.projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  // Filter stages if specified
  const filteredStages = config.stageIds?.length
    ? stages.filter((s: any) => config.stageIds!.includes(s.id))
    : stages;
  
  // Group items by stage
  const stageItems = new Map<string, any[]>();
  for (const stage of filteredStages) {
    const stageItemList = items.filter((i: any) => i.stageId === (stage as any).id);
    stageItems.set((stage as any).id, stageItemList);
  }
  
  // Build stage sections
  const stageSections: BOQSummaryReportData['stages'] = filteredStages.map((stage: any) => {
    const stageItemList = stageItems.get(stage.id) || [];
    const subtotal = stageItemList.reduce((sum: number, item: any) => {
      return sum + (item.quantity * (item.unitRate || 0));
    }, 0);
    
    return {
      stageId: stage.id,
      stageName: stage.name,
      stageNumber: stage.order || 0,
      items: stageItemList.map((item: any, idx: number) => ({
        itemNumber: `${stage.order || 0}.${idx + 1}`,
        description: item.description || item.name || '',
        unit: item.unit || '',
        quantity: item.quantity || 0,
        rate: item.unitRate || 0,
        amount: (item.quantity || 0) * (item.unitRate || 0),
        remarks: item.notes || '',
      })),
      subtotal,
    };
  });
  
  // Calculate totals
  const totalItems = items.length;
  const totalQuantity = items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
  const estimatedCost = stageSections.reduce((sum, s) => sum + s.subtotal, 0);
  
  return {
    project: {
      id: (project as any).id,
      name: (project as any).name || '',
      client: (project as any).clientName || '',
      location: (project as any).location || '',
      startDate: (project as any).startDate,
      endDate: (project as any).endDate,
    },
    summary: {
      totalStages: filteredStages.length,
      totalItems,
      totalQuantity,
      estimatedCost,
      currency: 'UGX',
    },
    stages: stageSections,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate Material Requirements Data
 */
async function generateMaterialRequirementsData(
  config: ReportConfig
): Promise<MaterialRequirementsReportData> {
  const project = await getProjectById(config.projectId);
  const items = await getBOQItems(config.projectId);
  const deliveries = await getDeliveryLogs(config.projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  // Calculate delivered quantities per material
  const deliveredMap = new Map<string, number>();
  for (const delivery of deliveries) {
    const deliveryItems = (delivery as any).items || [];
    for (const item of deliveryItems) {
      const current = deliveredMap.get(item.materialId) || 0;
      deliveredMap.set(item.materialId, current + (item.quantity || 0));
    }
  }
  
  // Build material rows
  const materials: MaterialRequirementsReportData['materials'] = items.map((item: any) => {
    const delivered = deliveredMap.get(item.id) || 0;
    const totalRequired = item.quantity || 0;
    const remaining = Math.max(0, totalRequired - delivered);
    
    return {
      materialId: item.id,
      materialName: item.name || item.description || '',
      category: item.category || 'Uncategorized',
      unit: item.unit || '',
      totalRequired,
      delivered,
      remaining,
      unitCost: item.unitRate || 0,
      totalCost: totalRequired * (item.unitRate || 0),
      status: delivered >= totalRequired 
        ? (delivered > totalRequired ? 'over' : 'complete')
        : delivered > 0 ? 'partial' : 'pending',
    };
  });
  
  // Group by category
  const categoryMap = new Map<string, { count: number; cost: number }>();
  for (const mat of materials) {
    const existing = categoryMap.get(mat.category) || { count: 0, cost: 0 };
    categoryMap.set(mat.category, {
      count: existing.count + 1,
      cost: existing.cost + mat.totalCost,
    });
  }
  
  const totalCost = materials.reduce((sum, m) => sum + m.totalCost, 0);
  const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    materialCount: data.count,
    totalCost: data.cost,
    percentOfTotal: totalCost > 0 ? (data.cost / totalCost) * 100 : 0,
  }));
  
  return {
    project: {
      id: (project as any).id,
      name: (project as any).name || '',
    },
    summary: {
      totalMaterials: materials.length,
      totalEstimatedCost: totalCost,
      currency: 'UGX',
    },
    materials,
    byCategory,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate Variance Analysis Data
 */
async function generateVarianceAnalysisData(
  config: ReportConfig
): Promise<VarianceAnalysisReportData> {
  const project = await getProjectById(config.projectId);
  const items = await getBOQItems(config.projectId);
  const deliveries = await getDeliveryLogs(config.projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  // Calculate actual costs per material
  const actualCostMap = new Map<string, { qty: number; cost: number }>();
  for (const delivery of deliveries) {
    const deliveryItems = (delivery as any).items || [];
    for (const item of deliveryItems) {
      const current = actualCostMap.get(item.materialId) || { qty: 0, cost: 0 };
      actualCostMap.set(item.materialId, {
        qty: current.qty + (item.quantity || 0),
        cost: current.cost + ((item.quantity || 0) * (item.unitPrice || 0)),
      });
    }
  }
  
  // Build variance items
  const varianceItems = items.map((item: any) => {
    const actual = actualCostMap.get(item.id) || { qty: 0, cost: 0 };
    const plannedQty = item.quantity || 0;
    const plannedCost = plannedQty * (item.unitRate || 0);
    const quantityVariance = actual.qty - plannedQty;
    const costVariance = actual.cost - plannedCost;
    
    return {
      itemId: item.id,
      itemName: item.name || item.description || '',
      unit: item.unit || '',
      plannedQty,
      actualQty: actual.qty,
      plannedCost,
      actualCost: actual.cost,
      quantityVariance,
      costVariance,
      variancePercent: plannedCost > 0 ? (costVariance / plannedCost) * 100 : 0,
    };
  });
  
  // Calculate totals
  const totalPlanned = varianceItems.reduce((sum, i) => sum + i.plannedCost, 0);
  const totalActual = varianceItems.reduce((sum, i) => sum + i.actualCost, 0);
  const totalVariance = totalActual - totalPlanned;
  
  return {
    project: {
      id: (project as any).id,
      name: (project as any).name || '',
    },
    period: {
      startDate: config.dateRange?.startDate || '',
      endDate: config.dateRange?.endDate || '',
    },
    summary: {
      totalPlanned,
      totalActual,
      totalVariance,
      variancePercent: totalPlanned > 0 ? (totalVariance / totalPlanned) * 100 : 0,
      itemsOverBudget: varianceItems.filter(i => i.costVariance > 0).length,
      itemsUnderBudget: varianceItems.filter(i => i.costVariance < 0).length,
      currency: 'UGX',
    },
    byStage: [],
    topVariances: varianceItems
      .sort((a, b) => Math.abs(b.costVariance) - Math.abs(a.costVariance))
      .slice(0, 10),
    trends: [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate Procurement Log Data
 */
async function generateProcurementLogData(
  config: ReportConfig
): Promise<ProcurementLogReportData> {
  const project = await getProjectById(config.projectId);
  const deliveries = await getDeliveryLogs(config.projectId);
  const purchaseOrders = await getPurchaseOrders(config.projectId);
  const validations = await getProjectValidations(config.projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  // Filter by date range
  const filteredDeliveries = config.dateRange
    ? deliveries.filter((d: any) => {
        const date = d.deliveryDate || d.createdAt;
        return date >= config.dateRange!.startDate && date <= config.dateRange!.endDate;
      })
    : deliveries;
  
  // Build validation lookup
  const validationMap = new Map(validations.map(v => [v.deliveryId, v]));
  
  // Build delivery rows
  const deliveryRows: ProcurementLogReportData['deliveries'] = filteredDeliveries.map((d: any) => ({
    deliveryId: d.id,
    date: d.deliveryDate || d.createdAt || '',
    supplier: d.supplierName || '',
    poNumber: d.purchaseOrderId 
      ? (purchaseOrders.find((po: any) => po.id === d.purchaseOrderId) as any)?.poNumber 
      : undefined,
    items: (d.items || []).map((i: any) => i.materialName || i.name).join(', ') || '',
    quantity: (d.items || []).reduce((sum: number, i: any) => sum + (i.quantity || 0), 0),
    amount: d.totalCost || 0,
    status: d.status || 'pending',
    invoiceValidated: validationMap.get(d.id)?.validationStatus === 'valid',
  }));
  
  // Group by supplier
  const supplierMap = new Map<string, { count: number; amount: number; vatRegistered?: boolean }>();
  for (const delivery of filteredDeliveries) {
    const supplierName = (delivery as any).supplierName || 'Unknown';
    const existing = supplierMap.get(supplierName) || { count: 0, amount: 0 };
    const validation = validationMap.get((delivery as any).id);
    supplierMap.set(supplierName, {
      count: existing.count + 1,
      amount: existing.amount + ((delivery as any).totalCost || 0),
      vatRegistered: validation?.efrisInvoice?.seller.vatRegistered,
    });
  }
  
  const totalSpend = deliveryRows.reduce((sum, d) => sum + d.amount, 0);
  const bySupplier = Array.from(supplierMap.entries()).map(([name, data]) => ({
    supplierName: name,
    deliveryCount: data.count,
    totalAmount: data.amount,
    percentOfSpend: totalSpend > 0 ? (data.amount / totalSpend) * 100 : 0,
    vatRegistered: data.vatRegistered,
  }));
  
  return {
    project: {
      id: (project as any).id,
      name: (project as any).name || '',
    },
    period: {
      startDate: config.dateRange?.startDate || '',
      endDate: config.dateRange?.endDate || '',
    },
    summary: {
      totalDeliveries: filteredDeliveries.length,
      totalPurchaseOrders: purchaseOrders.length,
      totalSpend,
      uniqueSuppliers: supplierMap.size,
      currency: 'UGX',
    },
    deliveries: deliveryRows,
    bySupplier,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate Tax Compliance Data
 */
async function generateTaxComplianceData(
  config: ReportConfig
): Promise<TaxComplianceReportData> {
  const project = await getProjectById(config.projectId);
  const validations = await getProjectValidations(config.projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  const summary = await calculateTaxComplianceSummary(
    config.projectId,
    config.dateRange?.startDate || '',
    config.dateRange?.endDate || ''
  );
  
  // Build invoice rows
  const invoiceRows: TaxComplianceReportData['invoices'] = validations.map(v => ({
    fdn: v.fdn,
    invoiceNumber: v.invoiceNumber,
    date: v.invoiceDate,
    supplier: v.supplierName,
    tin: v.supplierTin,
    amount: v.totalAmount,
    vatAmount: v.vatAmount,
    status: v.validationStatus,
    validatedAt: v.validatedAt,
  }));
  
  // Group by supplier
  const supplierMap = new Map<string, {
    tin: string;
    vatRegistered: boolean;
    invoiceCount: number;
    totalAmount: number;
    vatAmount: number;
    validCount: number;
    invalidCount: number;
  }>();
  
  for (const v of validations) {
    const existing = supplierMap.get(v.supplierName) || {
      tin: v.supplierTin,
      vatRegistered: v.efrisInvoice?.seller.vatRegistered || false,
      invoiceCount: 0,
      totalAmount: 0,
      vatAmount: 0,
      validCount: 0,
      invalidCount: 0,
    };
    
    supplierMap.set(v.supplierName, {
      ...existing,
      invoiceCount: existing.invoiceCount + 1,
      totalAmount: existing.totalAmount + v.totalAmount,
      vatAmount: existing.vatAmount + v.vatAmount,
      validCount: existing.validCount + (v.validationStatus === 'valid' ? 1 : 0),
      invalidCount: existing.invalidCount + (v.validationStatus !== 'valid' && v.validationStatus !== 'pending' ? 1 : 0),
    });
  }
  
  const bySupplier = Array.from(supplierMap.entries()).map(([supplier, data]) => ({
    supplier,
    tin: data.tin,
    vatRegistered: data.vatRegistered,
    invoiceCount: data.invoiceCount,
    totalAmount: data.totalAmount,
    vatAmount: data.vatAmount,
    validInvoices: data.validCount,
    invalidInvoices: data.invalidCount,
  }));
  
  return {
    project: {
      id: (project as any).id,
      name: (project as any).name || '',
    },
    period: {
      startDate: config.dateRange?.startDate || '',
      endDate: config.dateRange?.endDate || '',
    },
    summary: {
      totalInvoices: summary.invoices.total,
      validInvoices: summary.invoices.validated,
      invalidInvoices: summary.invoices.invalid,
      pendingInvoices: summary.invoices.pending,
      complianceRate: summary.complianceRate,
      totalPurchases: summary.amounts.totalPurchases,
      vatRecoverable: summary.amounts.vatRecoverable,
      atRiskAmount: summary.amounts.withInvalidInvoices + summary.amounts.unvalidated,
      currency: 'UGX',
    },
    invoices: invoiceRows,
    bySupplier,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate Project Overview Data
 */
async function generateProjectOverviewData(
  config: ReportConfig
): Promise<ProjectOverviewReportData> {
  const project = await getProjectById(config.projectId);
  const stages = await getBOQStages(config.projectId);
  const items = await getBOQItems(config.projectId);
  const deliveries = await getDeliveryLogs(config.projectId);
  
  if (!project) {
    throw new Error('Project not found');
  }
  
  // Calculate days
  const startDate = (project as any).startDate ? new Date((project as any).startDate) : new Date();
  const today = new Date();
  const daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const endDate = (project as any).endDate ? new Date((project as any).endDate) : null;
  const daysRemaining = endDate 
    ? Math.max(0, Math.floor((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : undefined;
  
  // Calculate budget
  const plannedCost = items.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.unitRate || 0)), 0);
  const actualCost = deliveries.reduce((sum: number, d: any) => sum + (d.totalCost || 0), 0);
  
  // Build stage rows
  const stageRows: ProjectOverviewReportData['stages'] = stages.map((stage: any) => {
    const stageItems = items.filter((i: any) => i.stageId === stage.id);
    const stagePlanned = stageItems.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.unitRate || 0)), 0);
    
    return {
      stageId: stage.id,
      stageName: stage.name || '',
      status: stage.status || 'pending',
      materialProgress: stage.materialProgress || 0,
      workProgress: stage.workProgress || 0,
      plannedCost: stagePlanned,
      actualCost: 0,
      milestones: {
        total: stage.milestones?.length || 0,
        complete: stage.milestones?.filter((m: any) => m.completed)?.length || 0,
      },
      blockers: stage.blockers?.length || 0,
    };
  });
  
  // Calculate overall progress
  const completedStages = stageRows.filter(s => s.status === 'complete').length;
  const overallProgress = stages.length > 0 ? (completedStages / stages.length) * 100 : 0;
  
  return {
    project: {
      id: (project as any).id,
      name: (project as any).name || '',
      client: (project as any).clientName || '',
      location: (project as any).location || '',
      startDate: (project as any).startDate,
      targetEndDate: (project as any).endDate,
      status: (project as any).status || 'active',
    },
    progress: {
      overallPercent: overallProgress,
      stagesComplete: completedStages,
      totalStages: stageRows.length,
      daysElapsed,
      daysRemaining,
    },
    budget: {
      estimated: plannedCost,
      actual: actualCost,
      variance: actualCost - plannedCost,
      variancePercent: plannedCost > 0 ? ((actualCost - plannedCost) / plannedCost) * 100 : 0,
      currency: 'UGX',
    },
    stages: stageRows,
    recentActivity: [],
    issues: [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate report file in specified format
 */
async function generateReportFile(
  config: ReportConfig,
  data: ReportData
): Promise<{ blob: Blob; fileName: string }> {
  const timestamp = new Date().toISOString().split('T')[0];
  const baseName = `${config.title.replace(/\s+/g, '_')}_${timestamp}`;
  
  switch (config.format) {
    case 'pdf':
      return generatePDFReport(config, data, baseName);
    case 'xlsx':
      return generateExcelReport(config, data, baseName);
    case 'csv':
      return generateCSVReport(config, data, baseName);
    case 'json':
      return {
        blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        fileName: `${baseName}.json`,
      };
    default:
      throw new Error(`Unsupported format: ${config.format}`);
  }
}

/**
 * Generate PDF Report
 */
async function generatePDFReport(
  config: ReportConfig,
  data: ReportData,
  baseName: string
): Promise<{ blob: Blob; fileName: string }> {
  const doc = new jsPDF({
    orientation: config.orientation || 'portrait',
    unit: 'mm',
    format: config.paperSize || 'a4',
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(config.title, margin, y);
  y += 10;
  
  if (config.headerText) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(config.headerText, margin, y);
    y += 8;
  }
  
  // Project info
  if ('project' in data && data.project) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(data.project.name, margin, y);
    y += 6;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if ('client' in data.project && data.project.client) {
      doc.text(`Client: ${data.project.client}`, margin, y);
      y += 5;
    }
    if ('period' in data && data.period) {
      doc.text(`Period: ${data.period.startDate} to ${data.period.endDate}`, margin, y);
      y += 5;
    }
  }
  
  y += 5;
  
  // Summary section
  if (config.includeSummary && 'summary' in data && data.summary) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', margin, y);
    y += 6;
    
    const summaryItems = Object.entries(data.summary)
      .filter(([key]) => key !== 'currency')
      .map(([key, value]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        const formattedValue = typeof value === 'number' 
          ? value.toLocaleString() 
          : String(value);
        return [label, formattedValue];
      });
    
    autoTable(doc, {
      startY: y,
      head: [],
      body: summaryItems,
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
      margin: { left: margin },
    });
    
    y = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // Details section
  if (config.includeDetails) {
    addPDFDetailTables(doc, config.type, data, margin, y);
  }
  
  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    
    // Page number
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin - 25,
      pageHeight - 10
    );
    
    // Generated date
    doc.text(
      `Generated: ${new Date().toLocaleString()}`,
      margin,
      pageHeight - 10
    );
    
    // Footer text
    if (config.footerText) {
      doc.text(config.footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  }
  
  const pdfBlob = doc.output('blob');
  return { blob: pdfBlob, fileName: `${baseName}.pdf` };
}

/**
 * Add PDF detail tables based on report type
 */
function addPDFDetailTables(
  doc: jsPDF,
  type: ReportType,
  data: ReportData,
  margin: number,
  startY: number
): void {
  let y = startY;
  
  switch (type) {
    case 'boq_summary':
      const boqData = data as BOQSummaryReportData;
      for (const stage of boqData.stages || []) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(`Stage ${stage.stageNumber}: ${stage.stageName}`, margin, y);
        y += 5;
        
        autoTable(doc, {
          startY: y,
          head: [['Item', 'Description', 'Unit', 'Qty', 'Rate', 'Amount']],
          body: stage.items.map((item) => [
            item.itemNumber,
            item.description,
            item.unit,
            item.quantity.toLocaleString(),
            item.rate.toLocaleString(),
            item.amount.toLocaleString(),
          ]),
          foot: [['', '', '', '', 'Subtotal', stage.subtotal.toLocaleString()]],
          styles: { fontSize: 8 },
          headStyles: { fillColor: [66, 66, 66] },
          footStyles: { fontStyle: 'bold' },
          margin: { left: margin, right: margin },
        });
        
        y = (doc as any).lastAutoTable.finalY + 10;
        
        // Add new page if needed
        if (y > doc.internal.pageSize.getHeight() - 40) {
          doc.addPage();
          y = margin;
        }
      }
      break;
      
    case 'variance_analysis':
      const varianceData = data as VarianceAnalysisReportData;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Top Variances', margin, y);
      y += 5;
      
      autoTable(doc, {
        startY: y,
        head: [['Item', 'Planned', 'Actual', 'Variance', '%']],
        body: (varianceData.topVariances || []).map((item) => [
          item.itemName,
          item.plannedCost.toLocaleString(),
          item.actualCost.toLocaleString(),
          item.costVariance.toLocaleString(),
          `${item.variancePercent.toFixed(1)}%`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: margin, right: margin },
      });
      break;
      
    case 'procurement_log':
      const procurementData = data as ProcurementLogReportData;
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Supplier', 'PO#', 'Items', 'Amount', 'Validated']],
        body: (procurementData.deliveries || []).map((d) => [
          d.date,
          d.supplier,
          d.poNumber || '-',
          d.items.substring(0, 30) + (d.items.length > 30 ? '...' : ''),
          d.amount.toLocaleString(),
          d.invoiceValidated ? 'Yes' : 'No',
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: margin, right: margin },
      });
      break;
      
    case 'tax_compliance':
      const taxData = data as TaxComplianceReportData;
      autoTable(doc, {
        startY: y,
        head: [['FDN', 'Supplier', 'TIN', 'Amount', 'VAT', 'Status']],
        body: (taxData.invoices || []).map((inv) => [
          inv.fdn,
          inv.supplier.substring(0, 20),
          inv.tin || '-',
          inv.amount.toLocaleString(),
          inv.vatAmount.toLocaleString(),
          inv.status,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [66, 66, 66] },
        margin: { left: margin, right: margin },
      });
      break;
      
    default:
      break;
  }
}

/**
 * Generate Excel Report
 */
async function generateExcelReport(
  config: ReportConfig,
  data: ReportData,
  baseName: string
): Promise<{ blob: Blob; fileName: string }> {
  const workbook = XLSX.utils.book_new();
  
  // Summary sheet
  if (config.includeSummary && 'summary' in data && data.summary) {
    const summaryData = Object.entries(data.summary)
      .filter(([key]) => key !== 'currency')
      .map(([key, value]) => ({
        Metric: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
        Value: value,
      }));
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  }
  
  // Detail sheets based on report type
  addExcelDetailSheets(workbook, config.type, data);
  
  // Generate Excel buffer
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  return { blob, fileName: `${baseName}.xlsx` };
}

/**
 * Add Excel detail sheets
 */
function addExcelDetailSheets(
  workbook: XLSX.WorkBook,
  type: ReportType,
  data: ReportData
): void {
  switch (type) {
    case 'boq_summary':
      const boqData = data as BOQSummaryReportData;
      const allItems = (boqData.stages || []).flatMap((stage) =>
        stage.items.map((item) => ({
          Stage: stage.stageName,
          'Item No': item.itemNumber,
          Description: item.description,
          Unit: item.unit,
          Quantity: item.quantity,
          Rate: item.rate,
          Amount: item.amount,
        }))
      );
      const itemsSheet = XLSX.utils.json_to_sheet(allItems);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, 'BOQ Items');
      break;
      
    case 'material_requirements':
      const matData = data as MaterialRequirementsReportData;
      const materialsSheet = XLSX.utils.json_to_sheet(matData.materials || []);
      XLSX.utils.book_append_sheet(workbook, materialsSheet, 'Materials');
      
      const categoriesSheet = XLSX.utils.json_to_sheet(matData.byCategory || []);
      XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'By Category');
      break;
      
    case 'variance_analysis':
      const varianceData = data as VarianceAnalysisReportData;
      const variancesSheet = XLSX.utils.json_to_sheet(varianceData.topVariances || []);
      XLSX.utils.book_append_sheet(workbook, variancesSheet, 'Variances');
      
      if (varianceData.byStage?.length) {
        const stageVariances = varianceData.byStage.map((s) => ({
          Stage: s.stageName,
          'Planned': s.planned,
          'Actual': s.actual,
          'Variance': s.variance,
          'Variance %': s.variancePercent,
          'Status': s.status,
        }));
        const stagesSheet = XLSX.utils.json_to_sheet(stageVariances);
        XLSX.utils.book_append_sheet(workbook, stagesSheet, 'By Stage');
      }
      break;
      
    case 'procurement_log':
      const procData = data as ProcurementLogReportData;
      const deliveriesSheet = XLSX.utils.json_to_sheet(procData.deliveries || []);
      XLSX.utils.book_append_sheet(workbook, deliveriesSheet, 'Deliveries');
      
      const suppliersSheet = XLSX.utils.json_to_sheet(procData.bySupplier || []);
      XLSX.utils.book_append_sheet(workbook, suppliersSheet, 'By Supplier');
      break;
      
    case 'tax_compliance':
      const taxData = data as TaxComplianceReportData;
      const invoicesSheet = XLSX.utils.json_to_sheet(taxData.invoices || []);
      XLSX.utils.book_append_sheet(workbook, invoicesSheet, 'Invoices');
      
      const supplierTaxSheet = XLSX.utils.json_to_sheet(taxData.bySupplier || []);
      XLSX.utils.book_append_sheet(workbook, supplierTaxSheet, 'By Supplier');
      break;
      
    case 'project_overview':
      const overviewData = data as ProjectOverviewReportData;
      const stagesSheet = XLSX.utils.json_to_sheet(overviewData.stages || []);
      XLSX.utils.book_append_sheet(workbook, stagesSheet, 'Stages');
      
      if (overviewData.issues?.length) {
        const issuesSheet = XLSX.utils.json_to_sheet(overviewData.issues);
        XLSX.utils.book_append_sheet(workbook, issuesSheet, 'Issues');
      }
      break;
  }
}

/**
 * Generate CSV Report
 */
async function generateCSVReport(
  config: ReportConfig,
  data: ReportData,
  baseName: string
): Promise<{ blob: Blob; fileName: string }> {
  let dataArray: unknown[] = [];
  
  switch (config.type) {
    case 'boq_summary':
      const boqData = data as BOQSummaryReportData;
      dataArray = (boqData.stages || []).flatMap((stage) =>
        stage.items.map((item) => ({
          stage: stage.stageName,
          ...item,
        }))
      );
      break;
    case 'material_requirements':
      dataArray = (data as MaterialRequirementsReportData).materials || [];
      break;
    case 'variance_analysis':
      dataArray = (data as VarianceAnalysisReportData).topVariances || [];
      break;
    case 'procurement_log':
      dataArray = (data as ProcurementLogReportData).deliveries || [];
      break;
    case 'tax_compliance':
      dataArray = (data as TaxComplianceReportData).invoices || [];
      break;
    case 'project_overview':
      dataArray = (data as ProjectOverviewReportData).stages || [];
      break;
    default:
      dataArray = [data];
  }
  
  let csvContent = '';
  
  if (dataArray.length > 0) {
    // Headers
    const firstRow = dataArray[0] as Record<string, unknown>;
    const headers = Object.keys(firstRow);
    csvContent += headers.join(',') + '\n';
    
    // Data rows
    for (const row of dataArray) {
      const rowData = row as Record<string, unknown>;
      const values = headers.map(h => {
        const val = rowData[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return String(val);
      });
      csvContent += values.join(',') + '\n';
    }
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  return { blob, fileName: `${baseName}.csv` };
}

/**
 * Get reports for project
 */
export async function getProjectReports(projectId: string): Promise<ReportRecord[]> {
  const q = query(
    getReportsRef(projectId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as ReportRecord);
}

/**
 * Get report by ID
 */
export async function getReportById(
  projectId: string,
  reportId: string
): Promise<ReportRecord | null> {
  const docSnap = await getDoc(doc(getReportsRef(projectId), reportId));
  return docSnap.exists() ? docSnap.data() as ReportRecord : null;
}

/**
 * Delete report
 */
export async function deleteReport(
  projectId: string,
  reportId: string
): Promise<void> {
  await deleteDoc(doc(getReportsRef(projectId), reportId));
}

/**
 * Increment download count
 */
export async function incrementDownloadCount(
  projectId: string,
  reportId: string
): Promise<void> {
  const docRef = doc(getReportsRef(projectId), reportId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const current = docSnap.data().downloadCount || 0;
    await updateDoc(docRef, { downloadCount: current + 1 });
  }
}

/**
 * Save report template
 */
export async function saveReportTemplate(
  template: Omit<ReportTemplate, 'id' | 'createdAt'>
): Promise<ReportTemplate> {
  const id = `template_${Date.now()}`;
  const now = new Date().toISOString();
  
  const fullTemplate: ReportTemplate = {
    ...template,
    id,
    createdAt: now,
  };
  
  await setDoc(doc(getTemplatesRef(), id), fullTemplate);
  return fullTemplate;
}

/**
 * Get report templates
 */
export async function getReportTemplates(): Promise<ReportTemplate[]> {
  const snapshot = await getDocs(getTemplatesRef());
  return snapshot.docs.map(doc => doc.data() as ReportTemplate);
}

/**
 * Delete report template
 */
export async function deleteReportTemplate(templateId: string): Promise<void> {
  await deleteDoc(doc(getTemplatesRef(), templateId));
}

/**
 * Quick export data (no report generation)
 */
export async function quickExportData(
  config: DataExportConfig,
  _userId: string
): Promise<{ blob: Blob; fileName: string }> {
  const data: Record<string, unknown[]> = {};
  
  for (const entity of config.entities) {
    switch (entity) {
      case 'boqItems':
        data.boqItems = await getBOQItems(config.projectId);
        break;
      case 'deliveries':
        data.deliveries = await getDeliveryLogs(config.projectId);
        break;
      case 'invoices':
        data.invoices = await getProjectValidations(config.projectId);
        break;
    }
  }
  
  const timestamp = new Date().toISOString().split('T')[0];
  const fileName = `export_${timestamp}`;
  
  switch (config.format) {
    case 'json':
      return {
        blob: new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
        fileName: `${fileName}.json`,
      };
    case 'xlsx':
      const workbook = XLSX.utils.book_new();
      for (const [name, items] of Object.entries(data)) {
        if (Array.isArray(items) && items.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(items);
          XLSX.utils.book_append_sheet(workbook, sheet, name);
        }
      }
      const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      return {
        blob: new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        fileName: `${fileName}.xlsx`,
      };
    case 'csv':
      const firstEntity = Object.values(data)[0] || [];
      let csv = '';
      if (Array.isArray(firstEntity) && firstEntity.length > 0) {
        const headers = Object.keys(firstEntity[0] as any);
        csv = headers.join(',') + '\n';
        for (const row of firstEntity) {
          csv += headers.map(h => JSON.stringify((row as Record<string, unknown>)[h] ?? '')).join(',') + '\n';
        }
      }
      return {
        blob: new Blob([csv], { type: 'text/csv' }),
        fileName: `${fileName}.csv`,
      };
    default:
      throw new Error(`Unsupported format: ${config.format}`);
  }
}

export const exportService = {
  generateReport,
  getProjectReports,
  getReportById,
  deleteReport,
  incrementDownloadCount,
  saveReportTemplate,
  getReportTemplates,
  deleteReportTemplate,
  quickExportData,
};

export default exportService;
