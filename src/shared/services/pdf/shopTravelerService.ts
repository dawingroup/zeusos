/**
 * Shop Traveler PDF Service
 * Generates printable shop traveler documents for production workflow
 * Includes cut lists, assembly instructions, QC checkpoints, and material specs
 */

import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { createElement } from 'react';

// ============================================
// Types
// ============================================

export interface ShopTravelerData {
  projectId: string;
  projectName: string;
  projectCode?: string;
  customerName?: string;
  dueDate?: string;
  priority?: 'normal' | 'high' | 'urgent';
  designItems: DesignItemTraveler[];
  materialSummary: MaterialSummary[];
  productionNotes?: string;
  qualityCheckpoints?: QualityCheckpoint[];
}

export interface DesignItemTraveler {
  id: string;
  name: string;
  category: string;
  quantity: number;
  description?: string;
  dimensions?: {
    width: number;
    height: number;
    depth: number;
    unit: string;
  };
  materials: MaterialSpec[];
  parts: PartSpec[];
  features: FeatureSpec[];
  assemblySteps?: string[];
  specialInstructions?: string;
  imageUrl?: string;
}

export interface MaterialSpec {
  name: string;
  specification: string;
  quantity: string;
  sheetsRequired?: number;
}

export interface PartSpec {
  name: string;
  sku?: string;
  quantity: number;
  dimensions?: string;
  material?: string;
  grainDirection?: 'length' | 'width' | 'any';
}

export interface FeatureSpec {
  name: string;
  category: string;
  estimatedMinutes: number;
  notes?: string;
}

export interface MaterialSummary {
  material: string;
  totalSheets: number;
  thickness: string;
  supplier?: string;
}

export interface QualityCheckpoint {
  stage: string;
  checks: string[];
  signOffRequired: boolean;
}

// ============================================
// PDF Styles
// ============================================

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#333',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    width: 120,
    textAlign: 'right',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  projectCode: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  priority: {
    fontSize: 10,
    padding: 4,
    marginTop: 4,
    textAlign: 'center',
  },
  priorityNormal: {
    backgroundColor: '#e0e0e0',
    color: '#333',
  },
  priorityHigh: {
    backgroundColor: '#fff3cd',
    color: '#856404',
  },
  priorityUrgent: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
    padding: 6,
    marginBottom: 8,
  },
  itemCard: {
    border: '1pt solid #ccc',
    padding: 10,
    marginBottom: 10,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  itemName: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemQuantity: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0066cc',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 80,
    fontWeight: 'bold',
    color: '#666',
  },
  value: {
    flex: 1,
  },
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tableCell: {
    flex: 1,
    fontSize: 9,
  },
  tableCellSmall: {
    width: 60,
    fontSize: 9,
  },
  checkbox: {
    width: 12,
    height: 12,
    border: '1pt solid #333',
    marginRight: 6,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#999',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 8,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    fontSize: 8,
    color: '#999',
  },
  signOff: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  signOffBox: {
    flex: 1,
    marginRight: 20,
  },
  signOffLabel: {
    fontSize: 9,
    color: '#666',
    marginBottom: 4,
  },
  signOffLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    height: 30,
  },
  notes: {
    backgroundColor: '#fffde7',
    padding: 8,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  notesTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
});

// ============================================
// PDF Components
// ============================================

function ShopTravelerHeader({ data }: { data: ShopTravelerData }) {
  const priorityStyle = data.priority === 'urgent' 
    ? styles.priorityUrgent 
    : data.priority === 'high' 
      ? styles.priorityHigh 
      : styles.priorityNormal;

  return createElement(View, { style: styles.header },
    createElement(View, { style: styles.headerLeft },
      createElement(Text, { style: styles.title }, 'SHOP TRAVELER'),
      createElement(Text, { style: styles.subtitle }, data.projectName),
      data.customerName && createElement(Text, { style: styles.subtitle }, `Customer: ${data.customerName}`),
      data.dueDate && createElement(Text, { style: styles.subtitle }, `Due: ${data.dueDate}`)
    ),
    createElement(View, { style: styles.headerRight },
      data.projectCode && createElement(Text, { style: styles.projectCode }, data.projectCode),
      createElement(Text, { style: [styles.priority, priorityStyle] }, 
        (data.priority || 'normal').toUpperCase()
      )
    )
  );
}

function MaterialSummarySection({ materials }: { materials: MaterialSummary[] }) {
  if (!materials || materials.length === 0) return null;

  return createElement(View, { style: styles.section },
    createElement(Text, { style: styles.sectionTitle }, 'MATERIAL REQUIREMENTS'),
    createElement(View, { style: styles.table },
      createElement(View, { style: styles.tableHeader },
        createElement(Text, { style: styles.tableCell }, 'Material'),
        createElement(Text, { style: styles.tableCellSmall }, 'Thickness'),
        createElement(Text, { style: styles.tableCellSmall }, 'Sheets'),
        createElement(Text, { style: styles.tableCell }, 'Supplier')
      ),
      ...materials.map((mat, i) => 
        createElement(View, { key: i, style: styles.tableRow },
          createElement(Text, { style: styles.tableCell }, mat.material),
          createElement(Text, { style: styles.tableCellSmall }, mat.thickness),
          createElement(Text, { style: styles.tableCellSmall }, String(mat.totalSheets)),
          createElement(Text, { style: styles.tableCell }, mat.supplier || '-')
        )
      )
    )
  );
}

function DesignItemSection({ item }: { item: DesignItemTraveler }) {
  return createElement(View, { style: styles.itemCard, wrap: false },
    createElement(View, { style: styles.itemHeader },
      createElement(Text, { style: styles.itemName }, item.name),
      createElement(Text, { style: styles.itemQuantity }, `Qty: ${item.quantity}`)
    ),
    
    // Basic info
    createElement(View, { style: styles.row },
      createElement(Text, { style: styles.label }, 'Category:'),
      createElement(Text, { style: styles.value }, item.category)
    ),
    item.dimensions && createElement(View, { style: styles.row },
      createElement(Text, { style: styles.label }, 'Dimensions:'),
      createElement(Text, { style: styles.value }, 
        `${item.dimensions.width} x ${item.dimensions.height} x ${item.dimensions.depth} ${item.dimensions.unit}`
      )
    ),
    item.description && createElement(View, { style: styles.row },
      createElement(Text, { style: styles.label }, 'Description:'),
      createElement(Text, { style: styles.value }, item.description)
    ),

    // Parts table
    item.parts && item.parts.length > 0 && createElement(View, { style: styles.table },
      createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, marginTop: 8 } }, 'Parts List'),
      createElement(View, { style: styles.tableHeader },
        createElement(Text, { style: styles.tableCell }, 'Part'),
        createElement(Text, { style: styles.tableCellSmall }, 'SKU'),
        createElement(Text, { style: styles.tableCellSmall }, 'Qty'),
        createElement(Text, { style: styles.tableCell }, 'Dimensions'),
        createElement(Text, { style: styles.tableCellSmall }, 'Grain')
      ),
      ...item.parts.map((part, i) => 
        createElement(View, { key: i, style: styles.tableRow },
          createElement(Text, { style: styles.tableCell }, part.name),
          createElement(Text, { style: styles.tableCellSmall }, part.sku || '-'),
          createElement(Text, { style: styles.tableCellSmall }, String(part.quantity)),
          createElement(Text, { style: styles.tableCell }, part.dimensions || '-'),
          createElement(Text, { style: styles.tableCellSmall }, part.grainDirection || 'any')
        )
      )
    ),

    // Special instructions
    item.specialInstructions && createElement(View, { style: styles.notes },
      createElement(Text, { style: styles.notesTitle }, 'Special Instructions'),
      createElement(Text, null, item.specialInstructions)
    )
  );
}

function QualityChecklistSection({ checkpoints }: { checkpoints: QualityCheckpoint[] }) {
  if (!checkpoints || checkpoints.length === 0) return null;

  return createElement(View, { style: styles.section },
    createElement(Text, { style: styles.sectionTitle }, 'QUALITY CHECKPOINTS'),
    ...checkpoints.map((checkpoint, i) =>
      createElement(View, { key: i, style: { marginBottom: 10 } },
        createElement(Text, { style: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 } }, 
          checkpoint.stage
        ),
        ...checkpoint.checks.map((check, j) =>
          createElement(View, { key: j, style: styles.checklistItem },
            createElement(View, { style: styles.checkbox }),
            createElement(Text, null, check)
          )
        ),
        checkpoint.signOffRequired && createElement(View, { style: styles.signOff },
          createElement(View, { style: styles.signOffBox },
            createElement(Text, { style: styles.signOffLabel }, 'Inspector Signature'),
            createElement(View, { style: styles.signOffLine })
          ),
          createElement(View, { style: styles.signOffBox },
            createElement(Text, { style: styles.signOffLabel }, 'Date'),
            createElement(View, { style: styles.signOffLine })
          )
        )
      )
    )
  );
}

function SignOffSection() {
  return createElement(View, { style: styles.signOff },
    createElement(View, { style: styles.signOffBox },
      createElement(Text, { style: styles.signOffLabel }, 'Production Lead'),
      createElement(View, { style: styles.signOffLine })
    ),
    createElement(View, { style: styles.signOffBox },
      createElement(Text, { style: styles.signOffLabel }, 'Quality Control'),
      createElement(View, { style: styles.signOffLine })
    ),
    createElement(View, { style: styles.signOffBox },
      createElement(Text, { style: styles.signOffLabel }, 'Date Completed'),
      createElement(View, { style: styles.signOffLine })
    )
  );
}

// ============================================
// Main PDF Document
// ============================================

export function ShopTravelerDocument({ data }: { data: ShopTravelerData }) {
  return createElement(Document, null,
    createElement(Page, { size: 'A4', style: styles.page },
      createElement(ShopTravelerHeader, { data }),
      createElement(MaterialSummarySection, { materials: data.materialSummary }),
      
      // Design items
      createElement(View, { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, 
          `DESIGN ITEMS (${data.designItems.length})`
        ),
        ...data.designItems.map((item, i) =>
          createElement(DesignItemSection, { key: i, item })
        )
      ),
      
      // Quality checkpoints
      data.qualityCheckpoints && createElement(QualityChecklistSection, { checkpoints: data.qualityCheckpoints }),
      
      // Production notes
      data.productionNotes && createElement(View, { style: styles.notes },
        createElement(Text, { style: styles.notesTitle }, 'Production Notes'),
        createElement(Text, null, data.productionNotes)
      ),
      
      // Sign-off section
      createElement(SignOffSection, null),
      
      // Footer
      createElement(Text, { style: styles.footer }, 
        `Generated: ${new Date().toLocaleDateString()} | Project: ${data.projectName}`
      ),
      createElement(Text, { 
        style: styles.pageNumber,
        render: ({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`
      })
    )
  );
}

// ============================================
// Data Builders
// ============================================

/**
 * Build shop traveler data from project and optimization results
 */
export function buildShopTravelerData(
  project: any,
  designItems: any[],
  optimizationState?: any
): ShopTravelerData {
  // Build material summary from optimization
  const materialSummary: MaterialSummary[] = [];
  if (optimizationState?.production?.nestingSheets) {
    const sheetsByMaterial = new Map<string, number>();
    for (const sheet of optimizationState.production.nestingSheets) {
      const key = `${sheet.material}-${sheet.thickness}`;
      sheetsByMaterial.set(key, (sheetsByMaterial.get(key) || 0) + 1);
    }
    for (const [key, count] of sheetsByMaterial) {
      const [material, thickness] = key.split('-');
      materialSummary.push({
        material,
        thickness,
        totalSheets: count,
      });
    }
  }

  // Build design item travelers
  const itemTravelers: DesignItemTraveler[] = designItems.map(item => ({
    id: item.id,
    name: item.name,
    category: item.category || 'General',
    quantity: item.quantity || 1,
    description: item.description,
    dimensions: item.dimensions,
    materials: (item.materials || []).map((m: any) => ({
      name: m.name || m,
      specification: m.specification || '',
      quantity: m.quantity || '1',
    })),
    parts: (item.parts || []).map((p: any) => ({
      name: p.name,
      sku: p.sku,
      quantity: p.quantity || 1,
      dimensions: p.dimensions 
        ? `${p.dimensions.length}x${p.dimensions.width}x${p.dimensions.thickness}` 
        : undefined,
      material: p.material,
      grainDirection: p.grainDirection,
    })),
    features: (item.features || []).map((f: any) => ({
      name: f.name,
      category: f.category || 'General',
      estimatedMinutes: f.estimatedMinutes || 30,
    })),
    specialInstructions: item.specialInstructions || item.notes,
  }));

  // Default quality checkpoints
  const qualityCheckpoints: QualityCheckpoint[] = [
    {
      stage: 'Material Prep',
      checks: [
        'Material grade verified',
        'Dimensions match cut list',
        'No visible defects',
        'Grain direction correct',
      ],
      signOffRequired: false,
    },
    {
      stage: 'CNC/Cutting',
      checks: [
        'All parts cut to specification',
        'Edge quality acceptable',
        'Part labels applied',
      ],
      signOffRequired: true,
    },
    {
      stage: 'Assembly',
      checks: [
        'Joints properly aligned',
        'Hardware correctly installed',
        'Structural integrity verified',
      ],
      signOffRequired: false,
    },
    {
      stage: 'Finishing',
      checks: [
        'Surface preparation complete',
        'Finish applied evenly',
        'Color match verified',
        'Final inspection passed',
      ],
      signOffRequired: true,
    },
  ];

  return {
    projectId: project.id,
    projectName: project.name || 'Unnamed Project',
    projectCode: project.code,
    customerName: project.customerName,
    dueDate: project.dueDate,
    priority: project.priority || 'normal',
    designItems: itemTravelers,
    materialSummary,
    productionNotes: project.productionNotes,
    qualityCheckpoints,
  };
}
