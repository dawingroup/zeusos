/**
 * ShopTraveler PDF Document
 * Complete production documentation with cutting maps, edge banding, remnants, and labels
 * 
 * Enhanced with Dawin Finishes branding and Outfit font
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { Project, ProductionResult, NestingSheet, PartPlacement, WasteRegion, LinearCuttingResult } from '@/shared/types';
import type { Deliverable } from '@/modules/design-manager/types';
import { DRAWING_DELIVERABLE_TYPES, IMAGE_FILE_EXTENSIONS } from '@/modules/design-manager/constants/deliverableConstants';
import {
  remapEdgeBandingForPlacementState,
  remapEdgeOperationsForPlacementState,
  PORTRAIT_LAYOUT_EDGE_ROTATION_QUARTER_TURNS,
  rotateEdgeBandingQuarterTurns,
} from '@/shared/services/optimization/edgeBandingOrientation';

// ============================================
// Font Configuration - Outfit Font Family
// ============================================

// Register Outfit font from Google Fonts CDN
Font.register({
  family: 'Outfit',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-300-normal.ttf',
      fontWeight: 300,
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-400-normal.ttf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-500-normal.ttf',
      fontWeight: 500,
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-600-normal.ttf',
      fontWeight: 600,
    },
    {
      src: 'https://cdn.jsdelivr.net/fontsource/fonts/outfit@latest/latin-700-normal.ttf',
      fontWeight: 700,
    },
  ],
});

// ============================================
// Dawin Finishes Brand Colors
// ============================================

const BRAND = {
  boysenberry: '#872E5C',      // Primary brand color
  boysenberryDark: '#6a2449',  // Dark variant
  cashmere: '#E2CAA9',         // Warm background
  cashmereLight: '#efe3d4',    // Light cashmere
  seaform: '#7ABDCD',          // Info/highlights
  pesto: '#8A7D4B',            // Success states
  edgeThick: '#E74C3C',        // Red - 2.0mm thick edge
  edgeThin: '#3498DB',         // Blue - 0.4mm thin edge
  text: '#212121',             // Primary text
  textLight: '#6b7280',        // Secondary text
  white: '#FFFFFF',
  grainArrow: '#872E5C',       // Grain direction indicator
};

// ============================================
// Types
// ============================================

// Standard part entry (hinges, screws, edging from inventory)
export interface StandardPartEntry {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unitCost: number;
  designItemId: string;
  designItemName: string;
}

// Special part entry (luxury/approved items)
export interface SpecialPartEntry {
  id: string;
  name: string;
  category: string;
  quantity: number;
  supplier: string;
  costing?: {
    currency: string;
    unitCost: number;
    totalLandedCost: number;
  };
  designItemId: string;
  designItemName: string;
}

interface ShopTravelerProps {
  project: Project;
  production: ProductionResult;
  options?: ShopTravelerOptions;
  standardParts?: StandardPartEntry[];
  specialParts?: SpecialPartEntry[];
  deliverablesByItem?: Map<string, { deliverables: Deliverable[]; itemName: string }>;
  logoUrl?: string;  // Dawin Finishes logo URL from subsidiary branding
  debugEdgeMapping?: boolean;
}

export interface ShopTravelerOptions {
  includeCoverPage?: boolean;
  includeCuttingMaps?: boolean;
  includeTimberCutting?: boolean;
  includeLinearStockCutting?: boolean;
  includeEdgeBanding?: boolean;
  includeRemnants?: boolean;
  includeLabels?: boolean;
  includeStandardParts?: boolean;
  includeSpecialParts?: boolean;
  includeQCCheckboxes?: boolean;
}

interface PartWithBanding {
  partId: string;
  partName: string;
  designItemName: string;
  cabinet?: string;
  length: number;
  width: number;
  thickness: number;
  grainDirection: 'length' | 'width' | 'none';
  edgeBanding: {
    top: string | boolean;
    bottom: string | boolean;
    left: string | boolean;
    right: string | boolean;
  };
  edgeOperationsCode?: string;
  bandingLength: number;
  sheetNumber: number;
}

// ============================================
// Styles with Outfit Font
// ============================================

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Outfit',
    backgroundColor: BRAND.white,
  },
  labelPage: {
    padding: 15,
    fontSize: 7,
    fontFamily: 'Outfit',
    backgroundColor: BRAND.white,
  },
  // Header bar - Dawin branding
  headerBar: {
    backgroundColor: BRAND.boysenberry,
    marginHorizontal: -30,
    marginTop: -30,
    paddingHorizontal: 30,
    paddingVertical: 12,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: BRAND.white,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 9,
    color: BRAND.cashmere,
    marginTop: 2,
  },
  headerRight: {
    position: 'absolute',
    right: 30,
    top: 12,
    alignItems: 'flex-end',
  },
  headerDate: {
    fontSize: 8,
    color: BRAND.cashmereLight,
  },
  headerPage: {
    fontSize: 9,
    color: BRAND.white,
    fontWeight: 600,
  },
  // Section titles
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: BRAND.boysenberry,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: BRAND.cashmere,
  },
  sectionTitleBar: {
    backgroundColor: BRAND.cashmereLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.boysenberry,
  },
  sectionTitleText: {
    fontSize: 12,
    fontWeight: 600,
    color: BRAND.boysenberryDark,
  },
  // Cover page styles
  coverContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverBrand: {
    fontSize: 11,
    fontWeight: 500,
    color: BRAND.boysenberry,
    letterSpacing: 3,
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 42,
    fontWeight: 700,
    color: BRAND.boysenberry,
    marginBottom: 12,
  },
  coverProjectCode: {
    fontSize: 32,
    fontWeight: 700,
    color: BRAND.text,
    marginBottom: 8,
  },
  coverCustomer: {
    fontSize: 16,
    fontWeight: 400,
    color: BRAND.textLight,
    marginBottom: 40,
  },
  coverDivider: {
    width: 80,
    height: 3,
    backgroundColor: BRAND.cashmere,
    marginBottom: 40,
  },
  coverStats: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 20,
  },
  coverStat: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: BRAND.cashmereLight,
    borderRadius: 6,
    minWidth: 90,
  },
  coverStatValue: {
    fontSize: 28,
    fontWeight: 700,
    color: BRAND.boysenberry,
  },
  coverStatLabel: {
    fontSize: 9,
    fontWeight: 500,
    color: BRAND.textLight,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coverFooter: {
    marginTop: 60,
    alignItems: 'center',
  },
  coverGenerated: {
    fontSize: 8,
    color: BRAND.textLight,
  },
  // Sheet header styles
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.cashmere,
  },
  sheetNumber: {
    fontSize: 14,
    fontWeight: 600,
    color: BRAND.boysenberry,
  },
  sheetMaterial: {
    fontSize: 11,
    fontWeight: 500,
    color: BRAND.text,
  },
  sheetDimensions: {
    fontSize: 9,
    color: BRAND.textLight,
  },
  sheetUtilization: {
    fontSize: 10,
    fontWeight: 600,
  },
  utilizationGood: {
    color: BRAND.pesto,
  },
  utilizationWarn: {
    color: BRAND.edgeThick,
  },
  // Diagram styles
  diagram: {
    marginBottom: 8,
    alignItems: 'center',
  },
  sheetOutline: {
    borderWidth: 2,
    borderColor: BRAND.text,
    backgroundColor: BRAND.cashmereLight,
    position: 'relative',
  },
  part: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: BRAND.boysenberryDark,
    backgroundColor: BRAND.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partLabel: {
    fontSize: 5,
    fontWeight: 600,
    color: BRAND.text,
    textAlign: 'center',
  },
  partNo: {
    fontSize: 4,
    fontWeight: 700,
    color: BRAND.boysenberryDark,
    textAlign: 'center',
    marginBottom: 1,
  },
  partDimensions: {
    fontSize: 4,
    color: BRAND.textLight,
    textAlign: 'center',
  },
  partSideDimension: {
    position: 'absolute',
    fontSize: 4,
    color: BRAND.textLight,
    textAlign: 'center',
  },
  partTopDimension: {
    top: 6,
    left: 8,
    right: 8,
  },
  partBottomDimension: {
    bottom: 6,
    left: 8,
    right: 8,
  },
  edgeDebugCode: {
    position: 'absolute',
    bottom: 4,
    left: 1,
    right: 1,
    fontSize: 3,
    color: BRAND.boysenberryDark,
    textAlign: 'center',
    opacity: 0.75,
  },
  cutSequence: {
    position: 'absolute',
    top: 1,
    right: 1,
    fontSize: 5,
    fontWeight: 700,
    color: BRAND.white,
    backgroundColor: BRAND.boysenberry,
    borderRadius: 5,
    width: 10,
    height: 10,
    textAlign: 'center',
  },
  // Edge banding indicators - offset from edge, using dashed pattern via segments
  edgeBandTop: {
    position: 'absolute',
    top: 2,
    left: 4,
    right: 4,
    height: 0,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    borderStyle: 'dashed',
  },
  edgeBandBottom: {
    position: 'absolute',
    bottom: 2,
    left: 4,
    right: 4,
    height: 0,
    borderTopWidth: 1,
    borderTopColor: '#000000',
    borderStyle: 'dashed',
  },
  edgeBandLeft: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 2,
    width: 0,
    borderLeftWidth: 1,
    borderLeftColor: '#000000',
    borderStyle: 'dashed',
  },
  edgeBandRight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    right: 2,
    width: 0,
    borderRightWidth: 1,
    borderRightColor: '#000000',
    borderStyle: 'dashed',
  },
  // Drawings section styles
  drawingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  drawingItem: {
    width: '48%',
    padding: 8,
    borderWidth: 1,
    borderColor: BRAND.cashmere,
    borderRadius: 4,
    marginBottom: 8,
  },
  drawingImage: {
    width: '100%',
    height: 150,
    objectFit: 'contain',
    marginBottom: 6,
  },
  drawingLabel: {
    fontSize: 8,
    fontWeight: 600,
    color: BRAND.text,
  },
  drawingMeta: {
    fontSize: 6,
    color: BRAND.textLight,
    marginTop: 2,
  },
  grainArrow: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    fontSize: 7,
    color: BRAND.grainArrow,
    fontWeight: 600,
  },
  remnant: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: BRAND.pesto,
    borderStyle: 'dashed',
    backgroundColor: BRAND.cashmereLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remnantLabel: {
    fontSize: 5,
    color: BRAND.pesto,
    fontWeight: 600,
  },
  remnantDim: {
    fontSize: 4,
    color: BRAND.textLight,
  },
  // Parts list styles
  partsList: {
    marginTop: 12,
  },
  partsListHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.boysenberry,
    padding: 6,
    marginBottom: 4,
  },
  partsListHeaderCell: {
    fontSize: 7,
    fontWeight: 600,
    color: BRAND.white,
  },
  partsListRow: {
    flexDirection: 'row',
    padding: 5,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.cashmereLight,
  },
  partsListCell: {
    fontSize: 7,
    color: BRAND.text,
  },
  partsListCellLabel: {
    width: '15%',
  },
  partsListCellName: {
    width: '30%',
  },
  partsListCellItem: {
    width: '25%',
  },
  partsListCellDim: {
    width: '15%',
    textAlign: 'right',
  },
  partsListCellEdge: {
    width: '15%',
    textAlign: 'center',
  },
  // Table styles
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: BRAND.boysenberry,
    padding: 8,
  },
  tableHeaderCell: {
    color: BRAND.white,
    fontSize: 8,
    fontWeight: 600,
  },
  tableRow: {
    flexDirection: 'row',
    padding: 7,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.cashmereLight,
  },
  tableRowAlt: {
    backgroundColor: BRAND.cashmereLight,
  },
  tableCell: {
    fontSize: 7,
    color: BRAND.text,
  },
  tableCellBold: {
    fontSize: 7,
    color: BRAND.text,
    fontWeight: 600,
  },
  tableTotal: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: BRAND.cashmere,
    borderTopWidth: 2,
    borderTopColor: BRAND.boysenberry,
  },
  // Label styles
  labelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  label: {
    width: '31%',
    padding: 8,
    borderWidth: 1,
    borderColor: BRAND.boysenberry,
    borderRadius: 3,
    marginBottom: 8,
  },
  labelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.cashmere,
  },
  labelCode: {
    fontSize: 10,
    fontWeight: 700,
    color: BRAND.boysenberry,
  },
  labelSheet: {
    fontSize: 7,
    fontWeight: 500,
    color: BRAND.textLight,
  },
  labelName: {
    fontSize: 7,
    fontWeight: 500,
    color: BRAND.text,
    marginBottom: 2,
  },
  labelItem: {
    fontSize: 6,
    color: BRAND.textLight,
    marginBottom: 4,
  },
  labelDim: {
    fontSize: 8,
    fontWeight: 600,
    color: BRAND.text,
  },
  labelThickness: {
    fontSize: 6,
    color: BRAND.textLight,
  },
  labelEdge: {
    fontSize: 6,
    fontWeight: 500,
    color: BRAND.seaform,
    marginTop: 4,
  },
  labelGrain: {
    fontSize: 6,
    color: BRAND.boysenberry,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BRAND.cashmere,
  },
  footerLeft: {
    fontSize: 7,
    color: BRAND.boysenberry,
    fontWeight: 500,
  },
  footerCenter: {
    fontSize: 6,
    color: BRAND.textLight,
  },
  footerRight: {
    fontSize: 8,
    color: BRAND.text,
    fontWeight: 600,
  },
  // Legend
  legend: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
    padding: 8,
    backgroundColor: BRAND.cashmereLight,
    borderRadius: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 8,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 6,
    color: BRAND.textLight,
  },
  boardLabelNote: {
    fontSize: 6,
    color: BRAND.textLight,
    marginTop: 2,
    textAlign: 'center',
  },
  // === Linear Cutting Diagram Styles (1D: Timber & Bar) ===
  linearMaterialGroup: {
    marginBottom: 20,
  },
  linearGroupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: BRAND.cashmereLight,
    padding: 8,
    borderLeftWidth: 4,
    borderLeftColor: BRAND.boysenberry,
    marginBottom: 10,
  },
  linearGroupTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: BRAND.boysenberryDark,
  },
  linearGroupMeta: {
    fontSize: 7,
    color: BRAND.textLight,
  },
  linearStickContainer: {
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.cashmereLight,
  },
  linearStickLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  linearStickNumber: {
    fontSize: 8,
    fontWeight: 600,
    color: BRAND.boysenberry,
  },
  linearStickMeta: {
    fontSize: 7,
    color: BRAND.textLight,
  },
  linearBarOutline: {
    height: 36,
    borderWidth: 2,
    borderColor: BRAND.text,
    backgroundColor: BRAND.cashmereLight,
    position: 'relative',
    marginVertical: 4,
  },
  linearCutSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderRightColor: BRAND.boysenberryDark,
    backgroundColor: BRAND.white,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  linearCutLabel: {
    fontSize: 5,
    fontWeight: 600,
    color: BRAND.text,
    textAlign: 'center',
  },
  linearCutDimension: {
    fontSize: 4,
    color: BRAND.textLight,
    textAlign: 'center',
  },
  linearWasteSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#e5e7eb',
  },
  linearWasteReusable: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: BRAND.cashmereLight,
    borderWidth: 1,
    borderColor: BRAND.pesto,
  },
  linearDimensionRow: {
    flexDirection: 'row',
    position: 'relative',
    height: 10,
  },
  linearDimMark: {
    position: 'absolute',
    fontSize: 4,
    color: BRAND.textLight,
  },
  linearPartsRow: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.cashmereLight,
  },
  linearPartsCell: {
    fontSize: 6,
    color: BRAND.text,
  },
  linearSummaryBoxes: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 12,
  },
  linearSummaryBox: {
    padding: 8,
    backgroundColor: BRAND.cashmereLight,
    borderRadius: 4,
    alignItems: 'center',
  },
  linearSummaryValue: {
    fontSize: 14,
    fontWeight: 700,
    color: BRAND.boysenberry,
  },
  linearSummaryLabel: {
    fontSize: 6,
    color: BRAND.textLight,
  },
  processingInfoBox: {
    marginTop: 6,
    marginBottom: 8,
    padding: 6,
    backgroundColor: BRAND.cashmereLight,
    borderRadius: 3,
    borderLeftWidth: 3,
    borderLeftColor: BRAND.seaform,
  },
  processingInfoText: {
    fontSize: 6,
    color: BRAND.text,
  },
  utilizationBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 600,
  },
});

// ============================================
// Helper Functions
// ============================================

function calculateScale(sheetSize: { length: number; width: number }, maxWidth = 480, maxHeight = 320): number {
  // Ensure we have valid sheet dimensions
  const sheetLength = Math.max(sheetSize.length || 2440, 100);
  const sheetWidth = Math.max(sheetSize.width || 1220, 100);
  
  const scaleX = maxWidth / sheetLength;
  const scaleY = maxHeight / sheetWidth;
  
  // Use the smaller scale to ensure the diagram fits within bounds
  // No arbitrary cap - let it scale naturally based on available space
  return Math.min(scaleX, scaleY);
}

function getPlacedEdgeBanding(part: PartPlacement): { top: boolean; bottom: boolean; left: boolean; right: boolean } | undefined {
  return remapEdgeBandingForPlacementState(part.edgeBanding, {
    rotated: !!part.rotated,
    rotationQuarterTurns: part.rotationQuarterTurns,
  });
}

function rotateEdgeBandingForVerticalLayout(
  edgeBanding: { top: boolean; bottom: boolean; left: boolean; right: boolean } | undefined
): { top: boolean; bottom: boolean; left: boolean; right: boolean } | undefined {
  return rotateEdgeBandingQuarterTurns(edgeBanding, PORTRAIT_LAYOUT_EDGE_ROTATION_QUARTER_TURNS);
}

function getPlacedEdgeOperations(part: PartPlacement): PartPlacement['edgeOperationsBySide'] {
  return remapEdgeOperationsForPlacementState(part.edgeOperationsBySide, {
    rotated: !!part.rotated,
    rotationQuarterTurns: part.rotationQuarterTurns,
  });
}

function operationCode(type: string): string {
  switch (type) {
    case 'grooving': return 'GRV';
    case 'mitering': return 'MIT';
    case 'routing': return 'RTE';
    case 'edge_banding': return 'EBD';
    case 'custom': return 'CUS';
    default: return type.toUpperCase().slice(0, 3);
  }
}

function getEdgeOperationsCode(operationsBySide: PartPlacement['edgeOperationsBySide'] | undefined): string {
  if (!operationsBySide) return '-';
  const order: Array<'top' | 'right' | 'bottom' | 'left' | 'front'> = ['top', 'right', 'bottom', 'left', 'front'];
  const sideCode: Record<typeof order[number], string> = {
    top: 'T',
    right: 'R',
    bottom: 'B',
    left: 'L',
    front: 'F',
  };
  const segments: string[] = [];
  for (const side of order) {
    const ops = operationsBySide[side];
    if (!ops || ops.length === 0) continue;
    const opsCode = ops.map(op => operationCode(op.type)).join('+');
    segments.push(`${sideCode[side]}:${opsCode}`);
  }
  return segments.length > 0 ? segments.join(' | ') : '-';
}

function getAllPartsWithBanding(nestingSheets: NestingSheet[], sheetIndex?: number): PartWithBanding[] {
  const parts: PartWithBanding[] = [];
  
  const sheetsToProcess = sheetIndex !== undefined 
    ? [{ sheet: nestingSheets[sheetIndex], idx: sheetIndex }] 
    : nestingSheets.map((sheet, idx) => ({ sheet, idx }));
  
  for (const { sheet, idx } of sheetsToProcess) {
    for (const placement of sheet.placements) {
      // Read edge banding from actual part data, respecting the order applied
      const placedEdgeBanding = getPlacedEdgeBanding(placement);
      const edgeBanding = {
        top: placedEdgeBanding?.top ? (placement.edgeBanding?.material || true) : false,
        bottom: placedEdgeBanding?.bottom ? (placement.edgeBanding?.material || true) : false,
        left: placedEdgeBanding?.left ? (placement.edgeBanding?.material || true) : false,
        right: placedEdgeBanding?.right ? (placement.edgeBanding?.material || true) : false,
      } as { top: string | boolean; bottom: string | boolean; left: string | boolean; right: string | boolean };
      
      const calcBandingLength = (edge: string | boolean, dim: number) => {
        if (!edge) return 0;
        return dim;
      };
      
      const bandingLength = 
        calcBandingLength(edgeBanding.top, placement.length) +
        calcBandingLength(edgeBanding.bottom, placement.length) +
        calcBandingLength(edgeBanding.left, placement.width) +
        calcBandingLength(edgeBanding.right, placement.width);
      
      parts.push({
        partId: placement.partId,
        partName: placement.partName,
        designItemName: placement.designItemName,
        length: placement.length,
        width: placement.width,
        thickness: placement.edgeBanding?.thickness || 18,
        grainDirection: placement.grainAligned ? 'length' : 'none',
        edgeBanding,
        edgeOperationsCode: getEdgeOperationsCode(getPlacedEdgeOperations(placement)),
        bandingLength,
        sheetNumber: idx + 1,
      });
    }
  }
  
  return parts;
}

function formatDate(date?: Date): string {
  if (!date) return new Date().toLocaleDateString();
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDimensions(length: number, width: number): string {
  return `${length} × ${width} mm`;
}

function getCompactPartName(partName: string): string {
  if (!partName) return 'Part';
  const normalized = partName.replace(/\s+/g, ' ').trim();
  const segments = normalized.split(' - ').map(s => s.trim()).filter(Boolean);
  const base = segments.length > 1 ? segments[segments.length - 1] : normalized;
  return base.length > 26 ? `${base.slice(0, 23)}...` : base;
}

function getEdgeBandingCode(edgeBanding: { top: string | boolean; bottom: string | boolean; left: string | boolean; right: string | boolean }): string {
  const codes: string[] = [];
  if (edgeBanding.top) codes.push('T');
  if (edgeBanding.bottom) codes.push('B');
  if (edgeBanding.left) codes.push('L');
  if (edgeBanding.right) codes.push('R');
  return codes.length > 0 ? codes.join('') : '-';
}

// ============================================
// Sub-Components
// ============================================

interface CoverPageProps {
  projectCode: string;
  customerName?: string;
  totalSheets: number;
  targetYield: number;
  totalParts: number;
  generatedAt: string;
  logoUrl?: string;
}

const CoverPage: React.FC<CoverPageProps> = ({ 
  projectCode, 
  customerName, 
  totalSheets, 
  targetYield,
  totalParts,
  generatedAt,
  logoUrl,
}) => (
  <View style={styles.coverContainer}>
    {/* Company Logo */}
    {logoUrl ? (
      <Image src={logoUrl} style={{ width: 180, height: 60, objectFit: 'contain', marginBottom: 30 }} />
    ) : (
      <Text style={styles.coverBrand}>DAWIN FINISHES</Text>
    )}
    
    <Text style={styles.coverTitle}>SHOP TRAVELER</Text>
    <Text style={styles.coverProjectCode}>{projectCode}</Text>
    {customerName && <Text style={styles.coverCustomer}>{customerName}</Text>}
    
    <View style={styles.coverStats}>
      <View style={styles.coverStat}>
        <Text style={styles.coverStatValue}>{totalSheets}</Text>
        <Text style={styles.coverStatLabel}>Sheets</Text>
      </View>
      <View style={styles.coverStat}>
        <Text style={styles.coverStatValue}>{totalParts}</Text>
        <Text style={styles.coverStatLabel}>Parts</Text>
      </View>
      <View style={styles.coverStat}>
        <Text style={styles.coverStatValue}>{targetYield.toFixed(1)}%</Text>
        <Text style={styles.coverStatLabel}>Yield</Text>
      </View>
    </View>
    
    <Text style={[styles.coverStatLabel, { marginTop: 40 }]}>
      Generated: {generatedAt}
    </Text>
  </View>
);

interface SheetHeaderProps {
  sheetNumber: number;
  totalSheets: number;
  material: string;
  dimensions: { length: number; width: number };
  utilizationPercent: number;
}

const SheetHeader: React.FC<SheetHeaderProps> = ({ 
  sheetNumber, 
  totalSheets, 
  material, 
  dimensions,
  utilizationPercent,
}) => (
  <View style={styles.sheetHeader}>
    <View>
      <Text style={styles.sheetNumber}>Sheet {sheetNumber} of {totalSheets}</Text>
      <Text style={styles.sheetMaterial}>{material}</Text>
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={styles.sheetDimensions}>
        {formatDimensions(dimensions.length, dimensions.width)}
      </Text>
      <Text style={[styles.sheetDimensions, { color: utilizationPercent >= 85 ? '#48bb78' : '#ed8936' }]}>
        {utilizationPercent.toFixed(1)}% utilization
      </Text>
    </View>
  </View>
);

interface NestingDiagramProps {
  sheet: NestingSheet;
  showEdgeBanding?: boolean;
  showGrainDirection?: boolean;
  showCutSequence?: boolean;
  showEdgeDebugCodes?: boolean;
}

const NestingDiagram: React.FC<NestingDiagramProps> = ({ 
  sheet, 
  showEdgeBanding = true,
  showGrainDirection = true,
  showCutSequence = true,
  showEdgeDebugCodes = false,
}) => {
  // Ensure valid sheet dimensions
  const sheetLength = Math.max(sheet.sheetSize?.length || 2440, 100);
  const sheetWidth = Math.max(sheet.sheetSize?.width || 1220, 100);
  
  const scale = calculateScale({ length: sheetWidth, width: sheetLength }, 500, 620);
  const scaledSheetWidth = sheetWidth * scale;
  const scaledSheetHeight = sheetLength * scale;
  
  return (
    <View style={styles.diagram}>
      <View style={[styles.sheetOutline, { width: scaledSheetWidth, height: scaledSheetHeight }]}>
        {/* Parts */}
        {sheet.placements.map((part, index) => {
          // Dimensions are already placed dimensions (rotation already applied)
          // Use them directly - same as NestingStudio
          const partLength = part.length;  // Horizontal dimension on sheet
          const partWidth = part.width;    // Vertical dimension on sheet
          
          // Clamp part position and size to stay within sheet bounds
          const partX = Math.max(0, Math.min(part.x || 0, sheetLength - partLength));
          const partY = Math.max(0, Math.min(part.y || 0, sheetWidth - partWidth));
          const rotatedX = sheetWidth - (partY + partWidth);
          const rotatedY = partX;
          const clampedLength = Math.min(partLength, sheetLength - partX);
          const clampedWidth = Math.min(partWidth, sheetWidth - partY);
          
          // Scale for rendering
          const scaledPartWidth = clampedWidth * scale;
          const scaledPartHeight = clampedLength * scale;
          const renderedPartWidth = Math.max(scaledPartWidth, 20);
          const renderedPartHeight = Math.max(scaledPartHeight, 15);
          const scaledX = rotatedX * scale;
          const scaledY = rotatedY * scale;
          const placedEdgeBanding = getPlacedEdgeBanding(part);
          const displayEdgeBanding = rotateEdgeBandingForVerticalLayout(placedEdgeBanding);
          const placedEdgeCode = placedEdgeBanding
            ? getEdgeBandingCode(placedEdgeBanding)
            : '-';
          const displayEdgeCode = displayEdgeBanding
            ? getEdgeBandingCode(displayEdgeBanding)
            : '-';
          // Labels should follow rendered orientation on the portrait-transformed sheet:
          // top/bottom track rendered horizontal axis, left/right track rendered vertical axis.
          const horizontalLabel = `${part.width} mm`;
          const verticalLabel = `${part.length} mm`;
          const sideDimTop = Math.max(6, (renderedPartHeight / 2) - 8);
          
          // Skip parts that are too small to render
          if (scaledPartWidth < 2 || scaledPartHeight < 2) return null;
          
          // Use unique key: partId + index + position to ensure no duplicates
          const uniqueKey = `${part.partId}-${index}-${partX}-${partY}`;
          
          return (
            <View 
              key={uniqueKey}
              style={[
                styles.part,
                {
                  left: scaledX,
                  top: scaledY,
                  width: renderedPartWidth,
                  height: renderedPartHeight,
                }
              ]}
            >
              {scaledPartWidth > 20 && scaledPartHeight > 15 && (
                <>
                  <Text style={styles.partNo}>Part No: {part.partId}</Text>
                  <Text style={styles.partLabel}>{getCompactPartName(part.partName)}</Text>
                </>
              )}
              {scaledPartWidth > 34 && scaledPartHeight > 24 && (
                <>
                  <Text style={[styles.partSideDimension, styles.partTopDimension]}>
                    {horizontalLabel}
                  </Text>
                  <Text style={[styles.partSideDimension, styles.partBottomDimension]}>
                    {horizontalLabel}
                  </Text>
                  <Text
                    style={[
                      styles.partSideDimension,
                      { left: 3, top: sideDimTop, transform: 'rotate(-90deg)' },
                    ]}
                  >
                    {verticalLabel}
                  </Text>
                  <Text
                    style={[
                      styles.partSideDimension,
                      { right: 3, top: sideDimTop, transform: 'rotate(90deg)' },
                    ]}
                  >
                    {verticalLabel}
                  </Text>
                </>
              )}
              
              {showCutSequence && (
                <Text style={styles.cutSequence}>{index + 1}</Text>
              )}
              
              {showGrainDirection && part.grainAligned && scaledPartWidth > 15 && (
                <Text style={styles.grainArrow}>→</Text>
              )}
              
              {/* Edge banding indicators - offset from part edge, black lines for B&W printing */}
              {showEdgeBanding && displayEdgeBanding && (
                <>
                  {displayEdgeBanding.top && <View style={styles.edgeBandTop} />}
                  {displayEdgeBanding.bottom && <View style={styles.edgeBandBottom} />}
                  {displayEdgeBanding.left && <View style={styles.edgeBandLeft} />}
                  {displayEdgeBanding.right && <View style={styles.edgeBandRight} />}
                </>
              )}

              {showEdgeDebugCodes && scaledPartWidth > 45 && scaledPartHeight > 28 && (
                <Text style={styles.edgeDebugCode}>P:{placedEdgeCode} D:{displayEdgeCode}</Text>
              )}
            </View>
          );
        })}
        
        {/* Waste regions / Offcuts */}
        {sheet.wasteRegions?.filter(r => r.reusable).map((offcut, index) => {
          const rotatedOffcutWidth = Math.min(offcut.width, sheetWidth) * scale;
          const rotatedOffcutHeight = Math.min(offcut.length, sheetLength) * scale;
          
          if (rotatedOffcutWidth < 5 || rotatedOffcutHeight < 5) return null;
          
          return (
            <View 
              key={`offcut-${index}`}
              style={[styles.remnant, {
                left: (sheetWidth - ((offcut.y || 0) + Math.min(offcut.width, sheetWidth))) * scale,
                top: Math.max(0, offcut.x || 0) * scale,
                width: Math.min(offcut.width, sheetWidth) * scale,
                height: Math.min(offcut.length, sheetLength) * scale,
              }]}
            >
              {rotatedOffcutWidth > 30 && rotatedOffcutHeight > 15 && (
                <Text style={styles.remnantLabel}>OFFCUT</Text>
              )}
            </View>
          );
        })}
      </View>
      <Text style={styles.boardLabelNote}>
        Board label format: Part No + short part name.
      </Text>
      
      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: BRAND.seaform }]} />
          <Text style={styles.legendText}>Edge Banding</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: BRAND.cashmereLight, borderWidth: 1, borderColor: BRAND.pesto, borderStyle: 'dashed' }]} />
          <Text style={styles.legendText}>Reusable Offcut</Text>
        </View>
        <View style={styles.legendItem}>
          <Text style={[styles.legendText, { color: BRAND.grainArrow }]}>→</Text>
          <Text style={styles.legendText}>Grain Direction</Text>
        </View>
      </View>
    </View>
  );
};

interface SheetPartsListProps {
  parts: PartPlacement[];
}

const SheetPartsList: React.FC<SheetPartsListProps> = ({ parts }) => {
  // Helper to get edge banding code from part data
  const getPartEdgeCode = (part: PartPlacement): string => {
    const placedEdgeBanding = getPlacedEdgeBanding(part);
    if (!placedEdgeBanding) return '-';
    const codes: string[] = [];
    if (placedEdgeBanding.top) codes.push('T');
    if (placedEdgeBanding.bottom) codes.push('B');
    if (placedEdgeBanding.left) codes.push('L');
    if (placedEdgeBanding.right) codes.push('R');
    return codes.length > 0 ? codes.join('') : '-';
  };

  const getPartOpsCode = (part: PartPlacement): string =>
    getEdgeOperationsCode(getPlacedEdgeOperations(part));

  return (
    <View style={styles.partsList}>
      <View style={styles.partsListHeader}>
        <Text style={[styles.partsListCell, { width: '10%', fontWeight: 'bold' }]}>#</Text>
        <Text style={[styles.partsListCell, { width: '23%', fontWeight: 'bold' }]}>Part Name</Text>
        <Text style={[styles.partsListCell, { width: '20%', fontWeight: 'bold' }]}>Design Item</Text>
        <Text style={[styles.partsListCell, { width: '14%', textAlign: 'right', fontWeight: 'bold' }]}>L × W (mm)</Text>
        <Text style={[styles.partsListCell, { width: '8%', textAlign: 'center', fontWeight: 'bold' }]}>Edge</Text>
        <Text style={[styles.partsListCell, { width: '25%', fontWeight: 'bold' }]}>Ops</Text>
      </View>
      {parts.map((part, index) => (
        <View key={`${part.partId}-${index}`} style={[styles.partsListRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
          <Text style={[styles.partsListCell, { width: '10%' }]}>{index + 1}</Text>
          <Text style={[styles.partsListCell, { width: '23%' }]}>{part.partName}</Text>
          <Text style={[styles.partsListCell, { width: '20%' }]}>{part.designItemName}</Text>
          <Text style={[styles.partsListCell, { width: '14%', textAlign: 'right' }]}>{part.length} × {part.width}</Text>
          <Text style={[styles.partsListCell, { width: '8%', textAlign: 'center' }]}>{getPartEdgeCode(part)}</Text>
          <Text style={[styles.partsListCell, { width: '25%' }]}>{getPartOpsCode(part)}</Text>
        </View>
      ))}
    </View>
  );
};

interface EdgeBandingTableProps {
  parts: PartWithBanding[];
}

const EdgeBandingTable: React.FC<EdgeBandingTableProps> = ({ parts }) => {
  const totalBandingLength = parts.reduce((sum, p) => sum + p.bandingLength, 0);

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Part</Text>
        <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Design Item</Text>
        <Text style={[styles.tableHeaderCell, { width: '14%', textAlign: 'right' }]}>Dimensions</Text>
        <Text style={[styles.tableHeaderCell, { width: '8%', textAlign: 'center' }]}>Edges</Text>
        <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Ops</Text>
        <Text style={[styles.tableHeaderCell, { width: '18%', textAlign: 'right' }]}>Length (mm)</Text>
      </View>
      
      {parts.map((part, index) => (
        <View key={`${part.partId}-${index}`} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
          <Text style={[styles.tableCell, { width: '20%' }]}>{part.partName}</Text>
          <Text style={[styles.tableCell, { width: '20%' }]}>{part.designItemName}</Text>
          <Text style={[styles.tableCell, { width: '14%', textAlign: 'right' }]}>
            {part.length} × {part.width}
          </Text>
          <Text style={[styles.tableCell, { width: '8%', textAlign: 'center' }]}>
            {getEdgeBandingCode(part.edgeBanding)}
          </Text>
          <Text style={[styles.tableCell, { width: '20%' }]}>
            {part.edgeOperationsCode || '-'}
          </Text>
          <Text style={[styles.tableCell, { width: '18%', textAlign: 'right' }]}>
            {part.bandingLength}
          </Text>
        </View>
      ))}
      
      {/* Total */}
      <View style={[styles.tableRow, { backgroundColor: '#edf2f7', borderTopWidth: 2, borderTopColor: '#2d3748' }]}>
        <Text style={[styles.tableCell, { width: '82%', fontWeight: 'bold' }]}>
          Total Edge Banding Required
        </Text>
        <Text style={[styles.tableCell, { width: '18%', textAlign: 'right', fontWeight: 'bold' }]}>
          {totalBandingLength} mm ({(totalBandingLength / 1000).toFixed(2)} m)
        </Text>
      </View>
    </View>
  );
};

interface OffcutTableProps {
  offcuts: WasteRegion[];
  minimumUsable: { width: number; height: number };
}

const OffcutTable: React.FC<OffcutTableProps> = ({ offcuts, minimumUsable }) => {
  const usableOffcuts = offcuts.filter(r => r.reusable);
  
  if (usableOffcuts.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: '#718096' }}>No reusable offcuts above minimum size</Text>
        <Text style={{ color: '#a0aec0', fontSize: 8, marginTop: 5 }}>
          (Minimum: {minimumUsable.width} × {minimumUsable.height} mm)
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, { width: '15%' }]}>#</Text>
        <Text style={[styles.tableHeaderCell, { width: '50%' }]}>Dimensions (mm)</Text>
        <Text style={[styles.tableHeaderCell, { width: '35%', textAlign: 'right' }]}>Area (m²)</Text>
      </View>
      
      {usableOffcuts.map((offcut, index) => (
        <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
          <Text style={[styles.tableCell, { width: '15%' }]}>O{index + 1}</Text>
          <Text style={[styles.tableCell, { width: '50%' }]}>
            {offcut.length} × {offcut.width}
          </Text>
          <Text style={[styles.tableCell, { width: '35%', textAlign: 'right' }]}>
            {(offcut.area / 1000000).toFixed(3)} m²
          </Text>
        </View>
      ))}
    </View>
  );
};

interface LabelSheetProps {
  parts: PartPlacement[];
  labelsPerRow?: number;
}

const LabelSheet: React.FC<LabelSheetProps> = ({ parts }) => {
  // Helper to get edge banding code from part data
  const getPartEdgeCode = (part: PartPlacement): string => {
    if (!part.edgeBanding) return '-';
    const placedEdgeBanding = getPlacedEdgeBanding(part);
    if (!placedEdgeBanding) return '-';
    const codes: string[] = [];
    if (placedEdgeBanding.top) codes.push('T');
    if (placedEdgeBanding.bottom) codes.push('B');
    if (placedEdgeBanding.left) codes.push('L');
    if (placedEdgeBanding.right) codes.push('R');
    return codes.length > 0 ? codes.join('') : '-';
  };

  return (
    <View style={styles.labelGrid}>
      {parts.map((part, index) => (
        <View key={`${part.partId}-${index}`} style={styles.label}>
          <Text style={styles.labelCode}>{part.partId}</Text>
          <Text style={styles.labelName}>{part.partName}</Text>
          <Text style={styles.labelDim}>
            {part.length} × {part.width} mm
          </Text>
          <Text style={styles.labelName}>{part.designItemName}</Text>
          <Text style={styles.labelEdge}>Edge: {getPartEdgeCode(part)}</Text>
        </View>
      ))}
    </View>
  );
};

// ============================================
// Drawings Section Component
// ============================================

interface DrawingsSectionProps {
  deliverablesByItem?: Map<string, { deliverables: Deliverable[]; itemName: string }>;
}

const isImageFile = (d: Deliverable): boolean =>
  d.mimeType?.startsWith('image/') || IMAGE_FILE_EXTENSIONS.includes(d.fileType?.toLowerCase());

const DrawingsSection: React.FC<DrawingsSectionProps> = ({ deliverablesByItem }) => {
  // Collect all drawing-type deliverables from all items
  const allDrawings: { deliverable: Deliverable; itemName: string }[] = [];

  if (deliverablesByItem) {
    for (const [, { deliverables, itemName }] of deliverablesByItem) {
      const drawings = deliverables.filter(d => DRAWING_DELIVERABLE_TYPES.includes(d.type));
      for (const drawing of drawings) {
        allDrawings.push({ deliverable: drawing, itemName });
      }
    }
  }

  if (allDrawings.length === 0) {
    return (
      <View style={{ padding: 20, alignItems: 'center', backgroundColor: BRAND.cashmereLight, borderRadius: 4 }}>
        <Text style={{ color: BRAND.textLight, fontSize: 9 }}>No drawings uploaded for this project</Text>
        <Text style={{ color: BRAND.textLight, fontSize: 7, marginTop: 4 }}>
          Upload drawings as deliverables to include them in the shop traveler
        </Text>
      </View>
    );
  }

  const itemCount = deliverablesByItem?.size || 0;

  return (
    <View>
      <View style={{ marginBottom: 12, padding: 8, backgroundColor: BRAND.cashmereLight, borderRadius: 4 }}>
        <Text style={{ fontSize: 8, color: BRAND.text }}>
          {allDrawings.length} drawing{allDrawings.length !== 1 ? 's' : ''} from {itemCount} design item{itemCount !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={styles.drawingsGrid}>
        {allDrawings.map(({ deliverable, itemName }, index) => (
          <View key={deliverable.id || index} style={styles.drawingItem}>
            {isImageFile(deliverable) ? (
              <Image src={deliverable.storageUrl} style={styles.drawingImage} />
            ) : (
              <View style={[styles.drawingImage, { backgroundColor: BRAND.cashmereLight, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ fontSize: 10, color: BRAND.textLight }}>{deliverable.fileType?.toUpperCase() || 'FILE'}</Text>
                <Text style={{ fontSize: 6, color: BRAND.textLight, marginTop: 2 }}>{deliverable.name}</Text>
              </View>
            )}
            <Text style={styles.drawingLabel}>{deliverable.name}</Text>
            <Text style={styles.drawingMeta}>From: {itemName}</Text>
            <Text style={styles.drawingMeta}>
              {deliverable.fileType?.toUpperCase() || 'FILE'} • {(deliverable.fileSize / 1024).toFixed(1)} KB
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ============================================
// Linear Cutting Components (1D: Timber & Bar)
// ============================================

interface LinearStockGroupHeaderProps {
  materialName: string;
  crossSection: { thickness: number; width: number };
  stockLength: number;
  stickCount: number;
  averageUtilization: number;
  label: 'Timber' | 'Bar';
}

const LinearStockGroupHeader: React.FC<LinearStockGroupHeaderProps> = ({
  materialName,
  crossSection,
  stockLength,
  stickCount,
  averageUtilization,
  label,
}) => (
  <View style={styles.linearGroupHeader}>
    <View>
      <Text style={styles.linearGroupTitle}>
        {materialName} — {crossSection.thickness} x {crossSection.width} mm
      </Text>
      <Text style={styles.linearGroupMeta}>
        Stock length: {stockLength} mm ({(stockLength / 1000).toFixed(2)} m) | {stickCount} {label === 'Timber' ? 'stick' : 'bar'}{stickCount !== 1 ? 's' : ''}
      </Text>
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[
        styles.utilizationBadge,
        {
          backgroundColor: averageUtilization >= 85 ? '#dcfce7' : '#fef3c7',
          color: averageUtilization >= 85 ? BRAND.pesto : '#92400e',
        }
      ]}>
        {averageUtilization.toFixed(1)}% yield
      </Text>
    </View>
  </View>
);

interface LinearCuttingDiagramProps {
  result: LinearCuttingResult;
  stickIndex: number;
  totalSticks: number;
  label: 'Stick' | 'Bar';
}

const LinearCuttingDiagram: React.FC<LinearCuttingDiagramProps> = ({
  result,
  stickIndex,
  totalSticks,
  label,
}) => {
  const maxBarWidth = 480;
  const scale = maxBarWidth / result.stockLength;
  const sortedCuts = [...result.cuts].sort((a, b) => a.startPosition - b.startPosition);
  const cutColors = [BRAND.white, '#f3f4f6', BRAND.white, '#f9fafb'];

  return (
    <View style={styles.linearStickContainer} wrap={false}>
      {/* Stick/bar header */}
      <View style={styles.linearStickLabel}>
        <Text style={styles.linearStickNumber}>
          {label} {stickIndex + 1} of {totalSticks}
          {result.isOffcut ? ' (from offcut library)' : ''}
        </Text>
        <Text style={styles.linearStickMeta}>
          {result.stockLength} mm | {result.utilizationPercent.toFixed(1)}% utilised | Waste: {result.wasteLength} mm
        </Text>
      </View>

      {/* Dimension markers above the bar */}
      <View style={[styles.linearDimensionRow, { width: maxBarWidth }]}>
        {sortedCuts.map((cut, idx) => {
          const leftPos = cut.startPosition * scale;
          const widthPx = cut.cutLength * scale;
          return (
            <Text
              key={`dim-${idx}`}
              style={[styles.linearDimMark, { left: Math.max(0, leftPos + widthPx / 2 - 8) }]}
            >
              {cut.cutLength}
            </Text>
          );
        })}
      </View>

      {/* The horizontal bar diagram */}
      <View style={[styles.linearBarOutline, { width: maxBarWidth }]}>
        {/* Waste segments (behind cuts) */}
        {result.wasteSegments.map((waste, idx) => (
          <View
            key={`waste-${idx}`}
            style={[
              waste.reusable ? styles.linearWasteReusable : styles.linearWasteSegment,
              {
                left: waste.startPosition * scale,
                width: Math.max(waste.length * scale, 1),
              }
            ]}
          />
        ))}

        {/* Cut segments */}
        {sortedCuts.map((cut, idx) => {
          const segWidth = cut.cutLength * scale;
          return (
            <View
              key={`cut-${idx}`}
              style={[
                styles.linearCutSegment,
                {
                  left: cut.startPosition * scale,
                  width: segWidth,
                  backgroundColor: cutColors[idx % cutColors.length],
                }
              ]}
            >
              {segWidth > 25 && (
                <Text style={styles.linearCutLabel}>{cut.partName}</Text>
              )}
              {segWidth > 40 && (
                <Text style={styles.linearCutDimension}>{cut.cutLength} mm</Text>
              )}
              <Text style={[styles.cutSequence, { position: 'absolute', top: 1, right: 1 }]}>
                {idx + 1}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Reusable waste annotations */}
      {result.wasteSegments.filter(w => w.reusable).length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          {result.wasteSegments.filter(w => w.reusable).map((waste, idx) => (
            <Text key={`wl-${idx}`} style={{ fontSize: 5, color: BRAND.pesto }}>
              Reusable offcut: {waste.length} mm (at {waste.startPosition} mm)
            </Text>
          ))}
        </View>
      )}

      {/* Parts table for this stick/bar */}
      <View style={{ marginTop: 4 }}>
        <View style={[styles.linearPartsRow, { backgroundColor: BRAND.boysenberry }]}>
          <Text style={[styles.linearPartsCell, { width: '8%', color: BRAND.white, fontWeight: 600 }]}>#</Text>
          <Text style={[styles.linearPartsCell, { width: '27%', color: BRAND.white, fontWeight: 600 }]}>Part Name</Text>
          <Text style={[styles.linearPartsCell, { width: '30%', color: BRAND.white, fontWeight: 600 }]}>Design Item</Text>
          <Text style={[styles.linearPartsCell, { width: '15%', color: BRAND.white, fontWeight: 600, textAlign: 'right' }]}>Length</Text>
          <Text style={[styles.linearPartsCell, { width: '10%', color: BRAND.white, fontWeight: 600, textAlign: 'right' }]}>Start</Text>
          <Text style={[styles.linearPartsCell, { width: '10%', color: BRAND.white, fontWeight: 600, textAlign: 'center' }]}>Qty</Text>
        </View>
        {sortedCuts.map((cut, idx) => (
          <View key={`row-${idx}`} style={[styles.linearPartsRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.linearPartsCell, { width: '8%' }]}>{idx + 1}</Text>
            <Text style={[styles.linearPartsCell, { width: '27%' }]}>{cut.partName}</Text>
            <Text style={[styles.linearPartsCell, { width: '30%' }]}>{cut.designItemName}</Text>
            <Text style={[styles.linearPartsCell, { width: '15%', textAlign: 'right' }]}>{cut.cutLength} mm</Text>
            <Text style={[styles.linearPartsCell, { width: '10%', textAlign: 'right' }]}>{cut.startPosition}</Text>
            <Text style={[styles.linearPartsCell, { width: '10%', textAlign: 'center' }]}>{cut.quantity}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

interface LinearCuttingSectionProps {
  results: LinearCuttingResult[];
  sectionTitle: string;
  stockLabel: 'Stick' | 'Bar';
  showProcessingNotes?: boolean;
}

const LinearCuttingSection: React.FC<LinearCuttingSectionProps> = ({
  results,
  sectionTitle,
  stockLabel,
  showProcessingNotes = false,
}) => {
  // Group by material + cross-section
  const groups = new Map<string, LinearCuttingResult[]>();
  for (const result of results) {
    const key = `${result.materialName}|${result.crossSection.thickness}x${result.crossSection.width}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(result);
  }

  const totalParts = results.reduce((sum, r) => sum + r.cuts.length, 0);
  const avgYield = results.length > 0
    ? results.reduce((s, r) => s + r.utilizationPercent, 0) / results.length
    : 0;

  return (
    <View>
      <View style={styles.sectionTitleBar}>
        <Text style={styles.sectionTitleText}>{sectionTitle}</Text>
      </View>

      {/* Overall summary boxes */}
      <View style={styles.linearSummaryBoxes}>
        <View style={styles.linearSummaryBox}>
          <Text style={styles.linearSummaryValue}>{results.length}</Text>
          <Text style={styles.linearSummaryLabel}>
            {stockLabel === 'Stick' ? 'Sticks' : 'Bars'}
          </Text>
        </View>
        <View style={styles.linearSummaryBox}>
          <Text style={styles.linearSummaryValue}>{totalParts}</Text>
          <Text style={styles.linearSummaryLabel}>Total Parts</Text>
        </View>
        <View style={styles.linearSummaryBox}>
          <Text style={[styles.linearSummaryValue, { color: BRAND.pesto }]}>
            {avgYield.toFixed(1)}%
          </Text>
          <Text style={styles.linearSummaryLabel}>Avg Yield</Text>
        </View>
      </View>

      {Array.from(groups.entries()).map(([key, groupResults]) => {
        const first = groupResults[0];
        const avgUtil = groupResults.reduce((s, r) => s + r.utilizationPercent, 0) / groupResults.length;

        return (
          <View key={key} style={styles.linearMaterialGroup}>
            <LinearStockGroupHeader
              materialName={first.materialName}
              crossSection={first.crossSection}
              stockLength={first.stockLength}
              stickCount={groupResults.length}
              averageUtilization={avgUtil}
              label={stockLabel === 'Stick' ? 'Timber' : 'Bar'}
            />

            {showProcessingNotes && (
              <View style={styles.processingInfoBox}>
                <Text style={styles.processingInfoText}>
                  Cross-section: {first.crossSection.thickness} x {first.crossSection.width} mm — Check planing requirements before cutting
                </Text>
              </View>
            )}

            {groupResults.map((result, idx) => (
              <LinearCuttingDiagram
                key={result.id}
                result={result}
                stickIndex={idx}
                totalSticks={groupResults.length}
                label={stockLabel}
              />
            ))}
          </View>
        );
      })}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: BRAND.white, borderWidth: 1, borderColor: BRAND.boysenberryDark }]} />
          <Text style={styles.legendText}>Cut Part</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#e5e7eb' }]} />
          <Text style={styles.legendText}>Waste</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: BRAND.cashmereLight, borderWidth: 1, borderColor: BRAND.pesto }]} />
          <Text style={styles.legendText}>Reusable Offcut</Text>
        </View>
      </View>
    </View>
  );
};

// ============================================
// Main Component
// ============================================

export const ShopTraveler: React.FC<ShopTravelerProps> = ({ 
  project, 
  production, 
  options = {},
  standardParts = [],
  specialParts = [],
  deliverablesByItem,
  logoUrl,
  debugEdgeMapping = false,
}) => {
  // Default all sections to true if not specified
  const {
    includeCoverPage = true,
    includeCuttingMaps = true,
    includeTimberCutting = true,
    includeLinearStockCutting = true,
    includeEdgeBanding = true,
    includeRemnants = true,
    includeLabels = true,
    includeStandardParts = true,
    includeSpecialParts = true,
    includeQCCheckboxes = false,
  } = options;

  // Panel nesting data (may be empty for timber/bar-only projects)
  const nestingSheets = production.nestingSheets || [];
  const allParts = nestingSheets.flatMap(sheet => sheet.placements);
  const partsWithBanding = getAllPartsWithBanding(nestingSheets);
  const allRemnants = nestingSheets.flatMap(sheet => sheet.wasteRegions || []);

  // 1D cutting results
  const timberResults = production.timberCuttingResults || [];
  const linearStockResults = production.linearStockCuttingResults || [];
  const timberPartCount = timberResults.reduce((s, r) => s + r.cuts.length, 0);
  const linearPartCount = linearStockResults.reduce((s, r) => s + r.cuts.length, 0);
  
  // Calculate page numbers dynamically based on included sections
  let pageNumber = 0;
  const getNextPage = () => ++pageNumber;
  
  return (
    <Document>
      {/* Cover Page */}
      {includeCoverPage && (
        <Page size="A4" style={styles.page}>
          <CoverPage
            projectCode={project.code}
            customerName={project.customerName}
            totalSheets={nestingSheets.length}
            targetYield={production.optimizedYield}
            totalParts={allParts.length + timberPartCount + linearPartCount}
            generatedAt={formatDate()}
            logoUrl={logoUrl}
          />
          {/* Additional cover stats for timber/linear stock */}
          {(timberResults.length > 0 || linearStockResults.length > 0) && (
            <View style={[styles.coverStats, { justifyContent: 'center', marginTop: 10 }]}>
              {timberResults.length > 0 && (
                <View style={styles.coverStat}>
                  <Text style={styles.coverStatValue}>{timberResults.length}</Text>
                  <Text style={styles.coverStatLabel}>Timber Sticks</Text>
                </View>
              )}
              {linearStockResults.length > 0 && (
                <View style={styles.coverStat}>
                  <Text style={styles.coverStatValue}>{linearStockResults.length}</Text>
                  <Text style={styles.coverStatLabel}>Linear Bars</Text>
                </View>
              )}
            </View>
          )}
          {(project as any).notes && (
            <View style={{ marginTop: 20, padding: 12, backgroundColor: BRAND.cashmereLight, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: 600, color: BRAND.boysenberry, marginBottom: 4 }}>Project Notes:</Text>
              <Text style={{ fontSize: 8, color: BRAND.text }}>{(project as any).notes}</Text>
            </View>
          )}
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>DAWIN FINISHES</Text>
            <Text style={styles.footerCenter}>Generated: {formatDate()}</Text>
            <Text style={styles.footerRight}>Cover</Text>
          </View>
        </Page>
      )}
      
      {/* Cutting Maps - One per sheet */}
      {includeCuttingMaps && nestingSheets.map((sheet, index) => {
        const mapPage = getNextPage();
        const listPage = getNextPage();
        return (
          <React.Fragment key={sheet.id}>
            <Page size="A4" style={styles.page}>
              <SheetHeader 
                sheetNumber={index + 1}
                totalSheets={nestingSheets.length}
                material={sheet.materialName}
                dimensions={sheet.sheetSize}
                utilizationPercent={sheet.utilizationPercent}
              />
              <NestingDiagram 
                sheet={sheet}
                showEdgeBanding={true}
                showGrainDirection={true}
                showCutSequence={true}
                showEdgeDebugCodes={debugEdgeMapping}
              />
              <View style={styles.footer}>
                <Text style={styles.footerLeft}>{project.code}</Text>
                <Text style={styles.footerCenter}>Sheet {index + 1} Pattern</Text>
                <Text style={styles.footerRight}>Page {mapPage}</Text>
              </View>
            </Page>
            <Page size="A4" style={styles.page}>
              <Text style={styles.sectionTitle}>Sheet {index + 1} Parts List</Text>
              <SheetPartsList parts={sheet.placements} />
              {includeQCCheckboxes && (
                <View style={{ marginTop: 12, padding: 10, backgroundColor: BRAND.cashmereLight, borderRadius: 4 }}>
                  <Text style={{ fontSize: 8, fontWeight: 600, color: BRAND.boysenberry, marginBottom: 6 }}>QC Sign-off:</Text>
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: BRAND.text }} />
                      <Text style={{ fontSize: 7, color: BRAND.text }}>Cut Complete</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: BRAND.text }} />
                      <Text style={{ fontSize: 7, color: BRAND.text }}>Edges Applied</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: BRAND.text }} />
                      <Text style={{ fontSize: 7, color: BRAND.text }}>QC Passed</Text>
                    </View>
                    <Text style={{ fontSize: 7, color: BRAND.textLight, marginLeft: 'auto' }}>Initials: ________</Text>
                  </View>
                </View>
              )}
              <View style={styles.footer}>
                <Text style={styles.footerLeft}>{project.code}</Text>
                <Text style={styles.footerCenter}>Sheet {index + 1} Parts</Text>
                <Text style={styles.footerRight}>Page {listPage}</Text>
              </View>
            </Page>
          </React.Fragment>
        );
      })}

      {/* Timber Cutting Diagrams (1D) */}
      {includeTimberCutting && timberResults.length > 0 && (
        <Page size="A4" style={styles.page}>
          <LinearCuttingSection
            results={timberResults}
            sectionTitle="Timber Cutting Diagrams"
            stockLabel="Stick"
            showProcessingNotes={true}
          />
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>{project.code}</Text>
            <Text style={styles.footerCenter}>Timber Cutting</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}

      {/* Linear Stock (Bar) Cutting Diagrams (1D) */}
      {includeLinearStockCutting && linearStockResults.length > 0 && (
        <Page size="A4" style={styles.page}>
          <LinearCuttingSection
            results={linearStockResults}
            sectionTitle="Bar / Linear Stock Cutting Diagrams"
            stockLabel="Bar"
          />
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>{project.code}</Text>
            <Text style={styles.footerCenter}>Linear Stock</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}

      {/* Edge Banding Schedule */}
      {includeEdgeBanding && (
        <Page size="A4" style={styles.page}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>Edge Banding Schedule</Text>
          </View>
          <EdgeBandingTable parts={partsWithBanding} />
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>{project.code}</Text>
            <Text style={styles.footerCenter}>Edge Banding</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}
      
      {/* Offcut Register */}
      {includeRemnants && (
        <Page size="A4" style={styles.page}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>Offcut Register</Text>
          </View>
          <OffcutTable 
            offcuts={allRemnants}
            minimumUsable={{ width: 200, height: 200 }}
          />
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>{project.code}</Text>
            <Text style={styles.footerCenter}>Offcuts</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}
      
      {/* Standard Parts (Hinges, Screws, Edging) */}
      {includeStandardParts && standardParts.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>Standard Parts (Consumables)</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>#</Text>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Category</Text>
              <Text style={[styles.tableHeaderCell, { width: '35%' }]}>Name</Text>
              <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Design Item</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>Qty</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>Cost</Text>
            </View>
            {standardParts.map((part, index) => (
              <View key={part.id} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { width: '8%' }]}>{index + 1}</Text>
                <Text style={[styles.tableCell, { width: '12%', textTransform: 'capitalize' }]}>{part.category}</Text>
                <Text style={[styles.tableCell, { width: '35%' }]}>{part.name}</Text>
                <Text style={[styles.tableCell, { width: '25%' }]}>{part.designItemName}</Text>
                <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>{part.quantity}</Text>
                <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>
                  {(part.quantity * part.unitCost).toLocaleString()}
                </Text>
              </View>
            ))}
            <View style={[styles.tableRow, { backgroundColor: BRAND.cashmereLight }]}>
              <Text style={[styles.tableCell, { width: '80%', fontWeight: 'bold' }]}>
                Total Standard Parts
              </Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'right', fontWeight: 'bold' }]}>
                {standardParts.reduce((sum, p) => sum + p.quantity, 0)}
              </Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'right', fontWeight: 'bold' }]}>
                {standardParts.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0).toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>{project.code}</Text>
            <Text style={styles.footerCenter}>Standard Parts</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}

      {/* Special Parts (Luxury/Approved Items) */}
      {includeSpecialParts && specialParts.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>Special Parts (Approved Items)</Text>
          </View>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '8%' }]}>#</Text>
              <Text style={[styles.tableHeaderCell, { width: '12%' }]}>Category</Text>
              <Text style={[styles.tableHeaderCell, { width: '30%' }]}>Name</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Supplier</Text>
              <Text style={[styles.tableHeaderCell, { width: '10%', textAlign: 'right' }]}>Qty</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Landed Cost</Text>
            </View>
            {specialParts.map((part, index) => (
              <View key={part.id} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { width: '8%' }]}>{index + 1}</Text>
                <Text style={[styles.tableCell, { width: '12%', textTransform: 'capitalize' }]}>{part.category}</Text>
                <Text style={[styles.tableCell, { width: '30%' }]}>{part.name}</Text>
                <Text style={[styles.tableCell, { width: '20%' }]}>{part.supplier || '-'}</Text>
                <Text style={[styles.tableCell, { width: '10%', textAlign: 'right' }]}>{part.quantity}</Text>
                <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                  {part.costing?.totalLandedCost 
                    ? `${part.costing.totalLandedCost.toLocaleString()}`
                    : 'TBD'}
                </Text>
              </View>
            ))}
            <View style={[styles.tableRow, { backgroundColor: BRAND.cashmereLight }]}>
              <Text style={[styles.tableCell, { width: '70%', fontWeight: 'bold' }]}>
                Total Special Parts
              </Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'right', fontWeight: 'bold' }]}>
                {specialParts.reduce((sum, p) => sum + p.quantity, 0)}
              </Text>
              <Text style={[styles.tableCell, { width: '20%', textAlign: 'right', fontWeight: 'bold' }]}>
                {specialParts.reduce((sum, p) => sum + (p.costing?.totalLandedCost || 0), 0).toLocaleString()}
              </Text>
            </View>
          </View>
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>{project.code}</Text>
            <Text style={styles.footerCenter}>Special Parts</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}

      {/* Project Drawings */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionTitleBar}>
          <Text style={styles.sectionTitleText}>Project Drawings</Text>
        </View>
        <DrawingsSection deliverablesByItem={deliverablesByItem} />
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>{project.code}</Text>
          <Text style={styles.footerCenter}>Drawings</Text>
          <Text style={styles.footerRight}>Page {getNextPage()}</Text>
        </View>
      </Page>

      {/* Part Labels */}
      {includeLabels && (
        <Page size="A4" style={styles.labelPage}>
          <View style={styles.sectionTitleBar}>
            <Text style={styles.sectionTitleText}>Part Labels</Text>
          </View>
          <LabelSheet parts={allParts} labelsPerRow={3} />
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>{project.code}</Text>
            <Text style={styles.footerCenter}>Labels</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};

export default ShopTraveler;
