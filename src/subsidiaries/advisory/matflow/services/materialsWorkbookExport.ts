/**
 * Materials Workbook Export
 * Generates a detailed materials workbook structured with the same
 * Level 1 (Bill), Level 2 (Element), Level 3 (Section) hierarchy
 * as the control BOQ workbook.
 *
 * Sheets:
 *   1. Summary        – One row per BOQ work item with material/labour/equipment cost totals
 *   2. Materials Detail – Material breakdown per BOQ item, grouped by Bill > Element > Section
 *   3. Labour & Equipment – Labour and equipment rates per BOQ item
 *   4. Consolidated   – Aggregated materials for procurement (grouped by material)
 */

import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface MaterialComponent {
  materialId?: string;
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  unitPrice?: number;
  moq?: number;
  packUnit?: string;
}

interface BOQItemForExport {
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
  hierarchyLevel?: number;
  isSummaryRow?: boolean;
  formulaCode?: string;
  formulaName?: string;
  materialRequirements?: MaterialComponent[];
  laborRate?: number;
  materialRate?: number;
  equipmentRate?: number;
  noFormulaRequired?: boolean;
  isBulkItem?: boolean;
}

interface ProjectInfo {
  name: string;
  clientName?: string;
  location?: string;
  currency?: string;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Build three-level hierarchy map: Bill → Element → Section → items[]
 */
function buildHierarchy(items: BOQItemForExport[]) {
  const map = new Map<string, {
    billName?: string;
    elements: Map<string, {
      elementName?: string;
      sections: Map<string, {
        sectionName?: string;
        items: BOQItemForExport[];
      }>;
    }>;
  }>();

  for (const item of items) {
    // Skip summary / header rows
    if (item.isSummaryRow) continue;

    const bill = item.billNumber || '0';
    const elem = item.elementCode || '0';
    const sec = item.sectionCode || '0';

    if (!map.has(bill)) {
      map.set(bill, { billName: item.billName, elements: new Map() });
    }
    const billEntry = map.get(bill)!;
    if (!billEntry.billName && item.billName) billEntry.billName = item.billName;

    if (!billEntry.elements.has(elem)) {
      billEntry.elements.set(elem, { elementName: item.elementName, sections: new Map() });
    }
    const elemEntry = billEntry.elements.get(elem)!;
    if (!elemEntry.elementName && item.elementName) elemEntry.elementName = item.elementName;

    if (!elemEntry.sections.has(sec)) {
      elemEntry.sections.set(sec, { sectionName: item.sectionName, items: [] });
    }
    const secEntry = elemEntry.sections.get(sec)!;
    if (!secEntry.sectionName && item.sectionName) secEntry.sectionName = item.sectionName;

    secEntry.items.push(item);
  }

  return map;
}

function sortedKeys<V>(map: Map<string, V>): string[] {
  return Array.from(map.keys()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function getQty(item: BOQItemForExport): number {
  return item.quantityContract ?? item.quantity ?? 0;
}

// ─────────────────────────────────────────────────────────────────
// Sheet 1: Summary
// ─────────────────────────────────────────────────────────────────

function buildSummarySheet(items: BOQItemForExport[], currency: string) {
  const hierarchy = buildHierarchy(items);
  const rows: any[][] = [];

  rows.push([
    'Item Code', 'Description', 'Unit', 'Contract Qty',
    `Material Cost (${currency})`, `Labour Cost (${currency})`,
    `Equipment Cost (${currency})`, `Line Total (${currency})`,
  ]);

  let grandMaterial = 0;
  let grandLabour = 0;
  let grandEquipment = 0;

  for (const billKey of sortedKeys(hierarchy)) {
    const bill = hierarchy.get(billKey)!;
    // Level 1 header
    rows.push([`Bill ${billKey}${bill.billName ? ' - ' + bill.billName : ''}`, '', '', '', '', '', '', '']);

    for (const elemKey of sortedKeys(bill.elements)) {
      const elem = bill.elements.get(elemKey)!;
      // Level 2 header
      rows.push([`  ${billKey}.${elemKey}${elem.elementName ? ' - ' + elem.elementName : ''}`, '', '', '', '', '', '', '']);

      for (const secKey of sortedKeys(elem.sections)) {
        const sec = elem.sections.get(secKey)!;
        // Level 3 header
        rows.push([`    ${billKey}.${elemKey}.${secKey}${sec.sectionName ? ' - ' + sec.sectionName : ''}`, '', '', '', '', '', '', '']);

        for (const item of sec.items) {
          const contractQty = getQty(item);
          const matCost = (item.materialRate ?? 0) * contractQty;
          const labCost = (item.laborRate ?? 0) * contractQty;
          const eqCost = (item.equipmentRate ?? 0) * contractQty;
          const lineTotal = matCost + labCost + eqCost;

          grandMaterial += matCost;
          grandLabour += labCost;
          grandEquipment += eqCost;

          rows.push([
            item.itemCode || item.hierarchyPath || '',
            item.description,
            item.unit,
            contractQty,
            matCost,
            labCost,
            eqCost,
            lineTotal,
          ]);
        }
      }
    }
  }

  // Grand total
  rows.push([]);
  rows.push([
    '', 'GRAND TOTAL', '', '',
    grandMaterial,
    grandLabour,
    grandEquipment,
    grandMaterial + grandLabour + grandEquipment,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 50 }, { wch: 8 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
  ];
  return ws;
}

// ─────────────────────────────────────────────────────────────────
// Sheet 2: Materials Detail
// ─────────────────────────────────────────────────────────────────

function buildMaterialsDetailSheet(items: BOQItemForExport[], currency: string) {
  const hierarchy = buildHierarchy(items);
  const rows: any[][] = [];

  rows.push([
    'Item Code', 'Description', 'Unit', 'Contract Qty',
    'Material', 'Req Qty', 'Purchase Qty (incl. wastage)',
    'MOQ', 'Pack', `Unit Price (${currency})`, `Material Cost (${currency})`,
  ]);

  for (const billKey of sortedKeys(hierarchy)) {
    const bill = hierarchy.get(billKey)!;
    rows.push([`Bill ${billKey}${bill.billName ? ' - ' + bill.billName : ''}`, '', '', '', '', '', '', '', '', '', '']);

    for (const elemKey of sortedKeys(bill.elements)) {
      const elem = bill.elements.get(elemKey)!;
      rows.push([`  ${billKey}.${elemKey}${elem.elementName ? ' - ' + elem.elementName : ''}`, '', '', '', '', '', '', '', '', '', '']);

      for (const secKey of sortedKeys(elem.sections)) {
        const sec = elem.sections.get(secKey)!;
        rows.push([`    ${billKey}.${elemKey}.${secKey}${sec.sectionName ? ' - ' + sec.sectionName : ''}`, '', '', '', '', '', '', '', '', '', '']);

        for (const item of sec.items) {
          const contractQty = getQty(item);
          const materials = item.materialRequirements || [];

          if (materials.length === 0) {
            rows.push([
              item.itemCode || item.hierarchyPath || '',
              item.description,
              item.unit,
              contractQty,
              item.noFormulaRequired ? '(no materials)' : '(no formula assigned)',
              '', '', '', '', '', '',
            ]);
            continue;
          }

          for (let i = 0; i < materials.length; i++) {
            const mat = materials[i];
            const reqQty = mat.quantity * contractQty;
            const purchaseQty = reqQty * (1 + (mat.wastagePercent || 0) / 100);
            const unitPrice = mat.unitPrice ?? 0;
            const matCost = purchaseQty * unitPrice;

            rows.push([
              i === 0 ? (item.itemCode || item.hierarchyPath || '') : '',
              i === 0 ? item.description : '',
              i === 0 ? item.unit : '',
              i === 0 ? contractQty : '',
              mat.materialName,
              reqQty,
              purchaseQty,
              mat.moq ?? '',
              mat.packUnit ?? '',
              unitPrice,
              matCost,
            ]);
          }
        }
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 45 }, { wch: 8 }, { wch: 12 },
    { wch: 30 }, { wch: 12 }, { wch: 18 },
    { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 18 },
  ];
  return ws;
}

// ─────────────────────────────────────────────────────────────────
// Sheet 3: Labour & Equipment
// ─────────────────────────────────────────────────────────────────

function buildLabourEquipmentSheet(items: BOQItemForExport[], currency: string) {
  const hierarchy = buildHierarchy(items);
  const rows: any[][] = [];

  rows.push([
    'Item Code', 'Description', 'Unit', 'Contract Qty',
    `Labour Rate (${currency})`, `Labour Cost (${currency})`,
    `Equip Rate (${currency})`, `Equip Cost (${currency})`,
    `Line Total (${currency})`,
  ]);

  for (const billKey of sortedKeys(hierarchy)) {
    const bill = hierarchy.get(billKey)!;
    rows.push([`Bill ${billKey}${bill.billName ? ' - ' + bill.billName : ''}`, '', '', '', '', '', '', '', '']);

    for (const elemKey of sortedKeys(bill.elements)) {
      const elem = bill.elements.get(elemKey)!;
      rows.push([`  ${billKey}.${elemKey}${elem.elementName ? ' - ' + elem.elementName : ''}`, '', '', '', '', '', '', '', '']);

      for (const secKey of sortedKeys(elem.sections)) {
        const sec = elem.sections.get(secKey)!;
        rows.push([`    ${billKey}.${elemKey}.${secKey}${sec.sectionName ? ' - ' + sec.sectionName : ''}`, '', '', '', '', '', '', '', '']);

        for (const item of sec.items) {
          const contractQty = getQty(item);
          const labRate = item.laborRate ?? 0;
          const eqRate = item.equipmentRate ?? 0;
          const labCost = labRate * contractQty;
          const eqCost = eqRate * contractQty;

          rows.push([
            item.itemCode || item.hierarchyPath || '',
            item.description,
            item.unit,
            contractQty,
            labRate,
            labCost,
            eqRate,
            eqCost,
            labCost + eqCost,
          ]);
        }
      }
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 16 }, { wch: 50 }, { wch: 8 }, { wch: 12 },
    { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
  ];
  return ws;
}

// ─────────────────────────────────────────────────────────────────
// Sheet 4: Consolidated Materials (for procurement)
// ─────────────────────────────────────────────────────────────────

function buildConsolidatedSheet(items: BOQItemForExport[], currency: string) {
  const materialMap = new Map<string, {
    name: string;
    totalRequired: number;
    totalPurchase: number;
    unit: string;
    moq?: number;
    packUnit?: string;
    unitPrice: number;
  }>();

  for (const item of items) {
    if (item.isSummaryRow) continue;
    const contractQty = getQty(item);
    const materials = item.materialRequirements || [];

    for (const mat of materials) {
      const key = mat.materialId || mat.materialName;
      const reqQty = mat.quantity * contractQty;
      const purchaseQty = reqQty * (1 + (mat.wastagePercent || 0) / 100);

      if (materialMap.has(key)) {
        const existing = materialMap.get(key)!;
        existing.totalRequired += reqQty;
        existing.totalPurchase += purchaseQty;
        // Keep the higher unit price if prices differ
        if ((mat.unitPrice ?? 0) > existing.unitPrice) {
          existing.unitPrice = mat.unitPrice ?? 0;
        }
      } else {
        materialMap.set(key, {
          name: mat.materialName,
          totalRequired: reqQty,
          totalPurchase: purchaseQty,
          unit: mat.unit,
          moq: mat.moq,
          packUnit: mat.packUnit,
          unitPrice: mat.unitPrice ?? 0,
        });
      }
    }
  }

  const rows: any[][] = [];
  rows.push([
    'Material', 'Total Required', 'Total Purchase (incl. wastage)',
    'Unit', 'MOQ', 'Pack', `Unit Price (${currency})`, `Total Cost (${currency})`,
  ]);

  let grandTotal = 0;
  const sorted = Array.from(materialMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  for (const mat of sorted) {
    const totalCost = mat.totalPurchase * mat.unitPrice;
    grandTotal += totalCost;

    rows.push([
      mat.name,
      mat.totalRequired,
      mat.totalPurchase,
      mat.unit,
      mat.moq ?? '',
      mat.packUnit ?? '',
      mat.unitPrice,
      totalCost,
    ]);
  }

  rows.push([]);
  rows.push(['', '', '', '', '', '', 'GRAND TOTAL', grandTotal]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 35 }, { wch: 16 }, { wch: 22 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 16 }, { wch: 18 },
  ];
  return ws;
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Generate a 4-sheet materials workbook following the control BOQ hierarchy.
 */
export async function exportMaterialsWorkbook(
  items: BOQItemForExport[],
  projectInfo: ProjectInfo,
): Promise<Blob> {
  const currency = projectInfo.currency || 'UGX';
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(items, currency), 'Summary');
  XLSX.utils.book_append_sheet(wb, buildMaterialsDetailSheet(items, currency), 'Materials Detail');
  XLSX.utils.book_append_sheet(wb, buildLabourEquipmentSheet(items, currency), 'Labour & Equipment');
  XLSX.utils.book_append_sheet(wb, buildConsolidatedSheet(items, currency), 'Consolidated Materials');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Export and trigger browser download of the materials workbook.
 */
export async function exportAndDownloadMaterials(
  items: BOQItemForExport[],
  projectInfo: ProjectInfo,
): Promise<void> {
  const blob = await exportMaterialsWorkbook(items, projectInfo);
  const filename = `Materials_${projectInfo.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
