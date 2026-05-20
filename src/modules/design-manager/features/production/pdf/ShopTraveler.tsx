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

interface ShopTravelerProps {
  project: Project;
  production: ProductionResult;
  deliverablesByItem?: Map<string, { deliverables: Deliverable[]; itemName: string }>;
  logoUrl?: string;  // Dawin Finishes logo URL from subsidiary branding
  debugEdgeMapping?: boolean;
}

interface PartWithBanding {
  partId: string;
  partName: string;
  partNumber?: string;
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
  // Edge banding indicators - offset from edge, black lines for B&W printing
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

function calculateScale(sheetSize: { length: number; width: number }, maxWidth = 500, maxHeight = 350): number {
  // Calculate scale to fit sheet within max dimensions
  const scaleX = maxWidth / sheetSize.length;
  const scaleY = maxHeight / sheetSize.width;
  // Use the smaller scale to ensure sheet fits, no arbitrary cap
  return Math.min(scaleX, scaleY);
}

/**
 * Validate that a part fits within the sheet boundaries
 */
function validatePartPlacement(part: PartPlacement, sheetSize: { length: number; width: number }): boolean {
  // PartPlacement length/width are already persisted as placed-on-sheet dimensions.
  const partLength = part.length;
  const partWidth = part.width;
  return (
    part.x >= 0 &&
    part.y >= 0 &&
    part.x + partLength <= sheetSize.length &&
    part.y + partWidth <= sheetSize.width
  );
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
        partNumber: placement.partNumber,
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

function getCompactPartName(
  partName: string,
  partNumber?: string,
): string {
  if (partNumber) {
    const t = partNumber.replace(/\s+/g, ' ').trim();
    if (t && t.length <= 22) return t;
  }
  if (!partName) return partNumber || 'Part';
  const normalized = partName.replace(/\s+/g, ' ').trim();
  const segments = normalized.split(' - ').map(s => s.trim()).filter(Boolean);
  const base = segments.length > 1 ? segments[segments.length - 1] : normalized;
  return base.length > 18 ? `${base.slice(0, 16)}…` : base;
}

function getEdgeBandingCode(edgeBanding: { top: string | boolean; bottom: string | boolean; left: string | boolean; right: string | boolean }): string {
  const codes: string[] = [];
  if (edgeBanding.top) codes.push('T');
  if (edgeBanding.bottom) codes.push('B');
  if (edgeBanding.left) codes.push('L');
  if (edgeBanding.right) codes.push('R');
  return codes.length > 0 ? codes.join('') : '-';
}

export function _getEdgeBandingDisplay(edgeBanding: { top: string | boolean; bottom: string | boolean; left: string | boolean; right: string | boolean }): string {
  const edges: string[] = [];
  if (edgeBanding.top) edges.push(`T:${typeof edgeBanding.top === 'string' ? edgeBanding.top : 'Y'}`);
  if (edgeBanding.bottom) edges.push(`B:${typeof edgeBanding.bottom === 'string' ? edgeBanding.bottom : 'Y'}`);
  if (edgeBanding.left) edges.push(`L:${typeof edgeBanding.left === 'string' ? edgeBanding.left : 'Y'}`);
  if (edgeBanding.right) edges.push(`R:${typeof edgeBanding.right === 'string' ? edgeBanding.right : 'Y'}`);
  return edges.length > 0 ? edges.join(' | ') : 'None';
}

export function _getGrainDirectionDisplay(direction: 'length' | 'width' | 'none'): string {
  switch (direction) {
    case 'length': return '→ Length';
    case 'width': return '↓ Width';
    default: return '-';
  }
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
  const scale = calculateScale(
    { length: sheet.sheetSize.width, width: sheet.sheetSize.length },
    520,
    680
  );
  const scaledWidth = sheet.sheetSize.width * scale;
  const scaledHeight = sheet.sheetSize.length * scale;
  
  // Filter and validate placements - only show parts that fit within sheet
  const validPlacements = sheet.placements.filter(part => 
    validatePartPlacement(part, sheet.sheetSize)
  );
  
  // Track if any parts were filtered out
  const invalidCount = sheet.placements.length - validPlacements.length;
  
  return (
    <View style={styles.diagram}>
      {invalidCount > 0 && (
        <Text style={{ fontSize: 8, color: BRAND.edgeThick, marginBottom: 4 }}>
          ⚠ {invalidCount} part(s) have invalid placements and are not shown
        </Text>
      )}
      <View style={[styles.sheetOutline, { width: scaledWidth, height: scaledHeight }]}>
        {/* Parts */}
        {validPlacements.map((part, index) => {
          // Dimensions are already placed dimensions (rotation already applied)
          // Use them directly - same as NestingStudio
          const partLength = part.length;
          const partWidth = part.width;
          const rotatedX = sheet.sheetSize.width - (part.y + partWidth);
          const rotatedY = part.x;
          const scaledPartWidth = partWidth * scale;
          const scaledPartHeight = partLength * scale;
          const renderedPartWidth = Math.max(scaledPartWidth, 20);
          const renderedPartHeight = Math.max(scaledPartHeight, 15);
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
          
          // Clamp position to ensure part stays within sheet bounds visually
          const clampedX = Math.max(0, Math.min(rotatedX * scale, scaledWidth - scaledPartWidth));
          const clampedY = Math.max(0, Math.min(rotatedY * scale, scaledHeight - scaledPartHeight));
          
          return (
            <View 
              key={`${part.partId}-${index}`}
              style={[
                styles.part,
                {
                  left: clampedX,
                  top: clampedY,
                  width: renderedPartWidth, // Minimum size for visibility
                  height: renderedPartHeight,
                }
              ]}
            >
              {scaledPartWidth > 28 && scaledPartHeight > 18 && (
                <>
                  <Text style={styles.partNo}>
                    {part.partNumber || part.partId}
                  </Text>
                  <Text style={styles.partLabel}>
                    {getCompactPartName(part.partName, part.partNumber)}
                  </Text>
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
              
              {showGrainDirection && part.grainAligned && (
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
        
        {/* Waste regions / Remnants */}
        {sheet.wasteRegions?.filter(r => r.reusable).map((remnant, index) => (
          <View 
            key={`remnant-${index}`}
            style={[styles.remnant, {
              left: (sheet.sheetSize.width - (remnant.y + remnant.width)) * scale,
              top: remnant.x * scale,
              width: remnant.width * scale,
              height: remnant.length * scale,
            }]}
          >
            <Text style={styles.remnantLabel}>REMNANT</Text>
          </View>
        ))}
      </View>
      <Text style={styles.boardLabelNote}>
        Board label format: Part No + short part name.
      </Text>
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
        <View key={part.partId} style={[styles.partsListRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
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

interface RemnantTableProps {
  remnants: WasteRegion[];
  minimumUsable: { width: number; height: number };
}

const RemnantTable: React.FC<RemnantTableProps> = ({ remnants, minimumUsable }) => {
  const usableRemnants = remnants.filter(r => r.reusable);
  const totalRemnantArea = usableRemnants.reduce((sum, r) => sum + r.area, 0);
  const totalRemnantAreaSqM = totalRemnantArea / 1000000;
  
  return (
    <View>
      {/* Explanation of what remnants are */}
      <View style={{ marginBottom: 15, padding: 10, backgroundColor: BRAND.cashmereLight, borderRadius: 4 }}>
        <Text style={{ fontSize: 9, fontWeight: 600, color: BRAND.boysenberry, marginBottom: 4 }}>
          What is the Remnant Register?
        </Text>
        <Text style={{ fontSize: 7, color: BRAND.text, lineHeight: 1.4 }}>
          Remnants are leftover pieces of sheet material after cutting that are large enough to be reused in future projects. 
          This register tracks usable offcuts (minimum {minimumUsable.width}×{minimumUsable.height}mm) for inventory and cost savings. 
          Store remnants with their reference code for easy retrieval.
        </Text>
      </View>

      {usableRemnants.length === 0 ? (
        <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 4 }}>
          <Text style={{ color: '#718096', fontSize: 9 }}>No reusable remnants from this production run</Text>
          <Text style={{ color: '#a0aec0', fontSize: 7, marginTop: 5 }}>
            All offcuts are smaller than the minimum usable size ({minimumUsable.width}×{minimumUsable.height}mm)
          </Text>
        </View>
      ) : (
        <>
          {/* Summary stats */}
          <View style={{ flexDirection: 'row', gap: 15, marginBottom: 12 }}>
            <View style={{ padding: 8, backgroundColor: BRAND.cashmereLight, borderRadius: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: 700, color: BRAND.pesto }}>{usableRemnants.length}</Text>
              <Text style={{ fontSize: 6, color: BRAND.textLight }}>Usable Pieces</Text>
            </View>
            <View style={{ padding: 8, backgroundColor: BRAND.cashmereLight, borderRadius: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: 700, color: BRAND.pesto }}>{totalRemnantAreaSqM.toFixed(2)} m²</Text>
              <Text style={{ fontSize: 6, color: BRAND.textLight }}>Total Area</Text>
            </View>
          </View>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: '10%' }]}>Ref</Text>
              <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Dimensions (mm)</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%', textAlign: 'right' }]}>Area (m²)</Text>
              <Text style={[styles.tableHeaderCell, { width: '20%' }]}>Sheet #</Text>
              <Text style={[styles.tableHeaderCell, { width: '25%' }]}>Storage Location</Text>
            </View>
            
            {usableRemnants.map((remnant, index) => (
              <View key={index} style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { width: '10%', fontWeight: 600 }]}>R{index + 1}</Text>
                <Text style={[styles.tableCell, { width: '25%' }]}>
                  {remnant.length} × {remnant.width}
                </Text>
                <Text style={[styles.tableCell, { width: '20%', textAlign: 'right' }]}>
                  {(remnant.area / 1000000).toFixed(3)}
                </Text>
                <Text style={[styles.tableCell, { width: '20%' }]}>
                  —
                </Text>
                <Text style={[styles.tableCell, { width: '25%', fontStyle: 'italic', color: BRAND.textLight }]}>
                  ____________
                </Text>
              </View>
            ))}
          </View>
          
          <Text style={{ fontSize: 6, color: BRAND.textLight, marginTop: 8, fontStyle: 'italic' }}>
            Write storage location when remnant is stored. Reference code format: [Project]-R[#]
          </Text>
        </>
      )}
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
      {parts.map((part) => (
        <View key={part.partId} style={styles.label}>
          <Text style={styles.labelCode}>{part.partNumber || part.partId}</Text>
          <Text style={styles.labelName}>{getCompactPartName(part.partName, part.partNumber)}</Text>
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
      <View style={styles.linearStickLabel}>
        <Text style={styles.linearStickNumber}>
          {label} {stickIndex + 1} of {totalSticks}
          {result.isOffcut ? ' (from offcut library)' : ''}
        </Text>
        <Text style={styles.linearStickMeta}>
          {result.stockLength} mm | {result.utilizationPercent.toFixed(1)}% utilised | Waste: {result.wasteLength} mm
        </Text>
      </View>

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

      <View style={[styles.linearBarOutline, { width: maxBarWidth }]}>
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

      {result.wasteSegments.filter(w => w.reusable).length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          {result.wasteSegments.filter(w => w.reusable).map((waste, idx) => (
            <Text key={`wl-${idx}`} style={{ fontSize: 5, color: BRAND.pesto }}>
              Reusable offcut: {waste.length} mm (at {waste.startPosition} mm)
            </Text>
          ))}
        </View>
      )}

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
      <Text style={styles.sectionTitle}>{sectionTitle}</Text>

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
  deliverablesByItem,
  logoUrl,
  debugEdgeMapping = false,
}) => {
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

  // Dynamic page numbering
  let pageNumber = 0;
  const getNextPage = () => ++pageNumber;

  return (
    <Document>
      {/* Cover Page */}
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
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>Dawin Finishes</Text>
          <Text style={styles.footerRight}>Cover</Text>
        </View>
      </Page>

      {/* Cutting Maps - One per sheet */}
      {nestingSheets.map((sheet, index) => {
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
                <Text>{project.code} - Sheet {index + 1} Pattern</Text>
                <Text style={styles.footerRight}>Page {mapPage}</Text>
              </View>
            </Page>
            <Page size="A4" style={styles.page}>
              <Text style={styles.sectionTitle}>Sheet {index + 1} Parts List</Text>
              <SheetPartsList parts={sheet.placements} />
              <View style={styles.footer}>
                <Text>{project.code} - Sheet {index + 1} Parts</Text>
                <Text style={styles.footerRight}>Page {listPage}</Text>
              </View>
            </Page>
          </React.Fragment>
        );
      })}

      {/* Timber Cutting Diagrams (1D) */}
      {timberResults.length > 0 && (
        <Page size="A4" style={styles.page}>
          <LinearCuttingSection
            results={timberResults}
            sectionTitle="Timber Cutting Diagrams"
            stockLabel="Stick"
            showProcessingNotes={true}
          />
          <View style={styles.footer}>
            <Text>{project.code} - Timber Cutting</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}

      {/* Linear Stock (Bar) Cutting Diagrams (1D) */}
      {linearStockResults.length > 0 && (
        <Page size="A4" style={styles.page}>
          <LinearCuttingSection
            results={linearStockResults}
            sectionTitle="Bar / Linear Stock Cutting Diagrams"
            stockLabel="Bar"
          />
          <View style={styles.footer}>
            <Text>{project.code} - Linear Stock</Text>
            <Text style={styles.footerRight}>Page {getNextPage()}</Text>
          </View>
        </Page>
      )}

      {/* Edge Banding Schedule */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Edge Banding Schedule</Text>
        <EdgeBandingTable parts={partsWithBanding} />
        <View style={styles.footer}>
          <Text>{project.code} - Edge Banding</Text>
          <Text style={styles.footerRight}>Page {getNextPage()}</Text>
        </View>
      </Page>
      
      {/* Remnant Register */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Remnant Register</Text>
        <RemnantTable 
          remnants={allRemnants}
          minimumUsable={{ width: 200, height: 200 }}
        />
        <View style={styles.footer}>
          <Text>{project.code} - Remnants</Text>
          <Text style={styles.footerRight}>Page {getNextPage()}</Text>
        </View>
      </Page>

      {/* Consolidated Drawings */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Project Drawings</Text>
        <DrawingsSection deliverablesByItem={deliverablesByItem} />
        <View style={styles.footer}>
          <Text>{project.code} - Drawings</Text>
          <Text style={styles.footerRight}>Page {getNextPage()}</Text>
        </View>
      </Page>

      {/* Part Labels */}
      <Page size="A4" style={styles.labelPage}>
        <Text style={styles.sectionTitle}>Part Labels</Text>
        <LabelSheet parts={allParts} labelsPerRow={3} />
        <View style={styles.footer}>
          <Text>{project.code} - Labels</Text>
          <Text style={styles.footerRight}>Page {getNextPage()}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ShopTraveler;
