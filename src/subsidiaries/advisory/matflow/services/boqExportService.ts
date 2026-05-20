/**
 * BOQ Export Service
 * Generates formatted BOQ documents with cover page, hierarchy, summaries, and page numbers
 */

import * as XLSX from 'xlsx';

interface BOQItem {
  id: string;
  itemCode?: string;
  description: string;
  unit: string;
  quantity?: number;
  quantityContract?: number;
  rate?: number;
  amount?: number;
  billNumber?: string;
  billName?: string;
  elementCode?: string;
  elementName?: string;
  sectionCode?: string;
  sectionName?: string;
  hierarchyPath?: string;
  specifications?: string;
}

interface ProjectInfo {
  name: string;
  clientName?: string;
  location?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
}

interface BillSummary {
  billNumber: string;
  billName?: string;
  elements: ElementSummary[];
  total: number;
  itemCount: number;
}

interface ElementSummary {
  code: string;
  name?: string;
  total: number;
  itemCount: number;
}

/**
 * Group BOQ items into hierarchy structure
 */
function groupItemsByHierarchy(items: BOQItem[]): Map<string, Map<string, Map<string, BOQItem[]>>> {
  const hierarchy = new Map<string, Map<string, Map<string, BOQItem[]>>>();
  
  for (const item of items) {
    const bill = item.billNumber || 'Uncategorized';
    const element = item.elementCode || 'General';
    const section = item.sectionCode || 'Items';
    
    if (!hierarchy.has(bill)) {
      hierarchy.set(bill, new Map());
    }
    const billMap = hierarchy.get(bill)!;
    
    if (!billMap.has(element)) {
      billMap.set(element, new Map());
    }
    const elementMap = billMap.get(element)!;
    
    if (!elementMap.has(section)) {
      elementMap.set(section, []);
    }
    elementMap.get(section)!.push(item);
  }
  
  return hierarchy;
}

/**
 * Calculate bill summaries
 */
function calculateBillSummaries(items: BOQItem[]): BillSummary[] {
  const hierarchy = groupItemsByHierarchy(items);
  const summaries: BillSummary[] = [];
  
  hierarchy.forEach((elements, billNumber) => {
    const elementSummaries: ElementSummary[] = [];
    let billTotal = 0;
    let billItemCount = 0;
    
    // Get bill name from first item
    let billName: string | undefined;
    
    elements.forEach((sections, elementCode) => {
      let elementTotal = 0;
      let elementItemCount = 0;
      let elementName: string | undefined;
      
      sections.forEach((sectionItems) => {
        for (const item of sectionItems) {
          if (!billName && item.billName) billName = item.billName;
          if (!elementName && item.elementName) elementName = item.elementName;
          elementTotal += item.amount || 0;
          elementItemCount++;
        }
      });
      
      elementSummaries.push({
        code: elementCode,
        name: elementName,
        total: elementTotal,
        itemCount: elementItemCount,
      });
      
      billTotal += elementTotal;
      billItemCount += elementItemCount;
    });
    
    summaries.push({
      billNumber,
      billName,
      elements: elementSummaries,
      total: billTotal,
      itemCount: billItemCount,
    });
  });
  
  return summaries.sort((a, b) => a.billNumber.localeCompare(b.billNumber, undefined, { numeric: true }));
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Export BOQ to Excel with formatted sheets
 */
export async function exportBOQToExcel(
  items: BOQItem[],
  projectInfo: ProjectInfo
): Promise<Blob> {
  const workbook = XLSX.utils.book_new();
  const billSummaries = calculateBillSummaries(items);
  const grandTotal = billSummaries.reduce((sum, b) => sum + b.total, 0);
  const totalItems = billSummaries.reduce((sum, b) => sum + b.itemCount, 0);
  
  // 1. Cover Page
  const coverData = [
    [''],
    [''],
    ['BILL OF QUANTITIES'],
    [''],
    [''],
    ['Project:', projectInfo.name],
    ['Client:', projectInfo.clientName || '-'],
    ['Location:', projectInfo.location || '-'],
    [''],
    ['Description:', projectInfo.description || '-'],
    [''],
    ['Start Date:', projectInfo.startDate ? new Date(projectInfo.startDate).toLocaleDateString() : '-'],
    ['End Date:', projectInfo.endDate ? new Date(projectInfo.endDate).toLocaleDateString() : '-'],
    [''],
    [''],
    ['Total Bills:', billSummaries.length.toString()],
    ['Total Items:', totalItems.toString()],
    ['Grand Total:', `UGX ${formatCurrency(grandTotal)}`],
    [''],
    [''],
    ['Generated:', new Date().toLocaleDateString()],
  ];
  const coverSheet = XLSX.utils.aoa_to_sheet(coverData);
  coverSheet['!cols'] = [{ wch: 20 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, coverSheet, 'Cover Page');
  
  // 2. Grand Summary Page
  const summaryData: any[][] = [
    ['GRAND SUMMARY'],
    [''],
    ['Bill No.', 'Bill Name', 'Items', 'Amount (UGX)'],
  ];
  
  for (const bill of billSummaries) {
    summaryData.push([
      `Bill ${bill.billNumber}`,
      bill.billName || '',
      bill.itemCount,
      formatCurrency(bill.total),
    ]);
  }
  
  summaryData.push(['']);
  summaryData.push(['', 'GRAND TOTAL', totalItems, formatCurrency(grandTotal)]);
  
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet['!cols'] = [{ wch: 15 }, { wch: 40 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Grand Summary');
  
  // 3. Individual Bill Sheets with Element Summaries
  const hierarchy = groupItemsByHierarchy(items);
  
  hierarchy.forEach((elements, billNumber) => {
    const billSummary = billSummaries.find(b => b.billNumber === billNumber);
    const sheetData: any[][] = [];
    
    // Bill Header
    sheetData.push([`BILL ${billNumber}${billSummary?.billName ? ` - ${billSummary.billName}` : ''}`]);
    sheetData.push(['']);
    
    // Element Summary for this bill
    sheetData.push(['ELEMENT SUMMARY']);
    sheetData.push(['Element', 'Description', 'Items', 'Amount (UGX)']);
    
    for (const elSum of billSummary?.elements || []) {
      sheetData.push([
        elSum.code !== 'General' ? `${billNumber}.${elSum.code}` : 'General',
        elSum.name || '',
        elSum.itemCount,
        formatCurrency(elSum.total),
      ]);
    }
    
    sheetData.push(['', 'Bill Total', billSummary?.itemCount || 0, formatCurrency(billSummary?.total || 0)]);
    sheetData.push(['']);
    sheetData.push(['']);
    
    // Detailed Items
    sheetData.push(['DETAILED ITEMS']);
    sheetData.push(['Item Code', 'Description', 'Unit', 'Qty', 'Rate (UGX)', 'Amount (UGX)']);
    
    elements.forEach((sections, elementCode) => {
      // Element header row
      const elementItems = Array.from(sections.values()).flat();
      const elementName = elementItems[0]?.elementName;
      if (elementCode !== 'General') {
        sheetData.push([`Element ${billNumber}.${elementCode}${elementName ? ` - ${elementName}` : ''}`, '', '', '', '', '']);
      }
      
      sections.forEach((sectionItems, sectionCode) => {
        // Section header row
        const sectionName = sectionItems[0]?.sectionName;
        if (sectionCode !== 'Items') {
          sheetData.push([`  Section ${billNumber}.${elementCode}.${sectionCode}${sectionName ? ` - ${sectionName}` : ''}`, '', '', '', '', '']);
        }
        
        // Items
        for (const item of sectionItems) {
          sheetData.push([
            item.itemCode || item.hierarchyPath || '',
            item.description,
            item.unit,
            item.quantityContract || item.quantity || 0,
            formatCurrency(item.rate || 0),
            formatCurrency(item.amount || 0),
          ]);
        }
      });
    });
    
    const billSheet = XLSX.utils.aoa_to_sheet(sheetData);
    billSheet['!cols'] = [
      { wch: 15 },
      { wch: 50 },
      { wch: 8 },
      { wch: 10 },
      { wch: 15 },
      { wch: 18 },
    ];
    
    const sheetName = `Bill ${billNumber}`.substring(0, 31); // Excel sheet name limit
    XLSX.utils.book_append_sheet(workbook, billSheet, sheetName);
  });
  
  // Generate blob
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Trigger download of exported BOQ
 */
export function downloadBOQ(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export and download BOQ
 */
export async function exportAndDownloadBOQ(
  items: BOQItem[],
  projectInfo: ProjectInfo
): Promise<void> {
  const blob = await exportBOQToExcel(items, projectInfo);
  const filename = `BOQ_${projectInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  downloadBOQ(blob, filename);
}
