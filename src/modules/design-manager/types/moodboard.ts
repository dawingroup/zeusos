/**
 * Moodboard Types
 * Type definitions for the in-app moodboard canvas feature
 */

import type { Timestamp } from '@/shared/types';

// ============================================
// Canvas Configuration Types
// ============================================

/**
 * Canvas configuration
 */
export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: string;
  gridEnabled: boolean;
  gridSize: number;
  snapToGrid: boolean;
}

/**
 * Preset canvas sizes
 */
export type CanvasPreset = 'A4-landscape' | 'A4-portrait' | 'A3-landscape' | 'A3-portrait' | '16:9' | '4:3' | 'square' | 'custom';

/**
 * Canvas presets with dimensions (in pixels at 72dpi)
 */
export const CANVAS_PRESETS: Record<CanvasPreset, { width: number; height: number; label: string }> = {
  'A4-landscape': { width: 842, height: 595, label: 'A4 Landscape' },
  'A4-portrait': { width: 595, height: 842, label: 'A4 Portrait' },
  'A3-landscape': { width: 1191, height: 842, label: 'A3 Landscape' },
  'A3-portrait': { width: 842, height: 1191, label: 'A3 Portrait' },
  '16:9': { width: 1920, height: 1080, label: '16:9 Widescreen' },
  '4:3': { width: 1024, height: 768, label: '4:3 Standard' },
  'square': { width: 1080, height: 1080, label: 'Square' },
  'custom': { width: 1200, height: 800, label: 'Custom' },
};

// ============================================
// Element Base Types
// ============================================

/**
 * Base properties for all moodboard elements
 */
export interface BaseElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  locked: boolean;
  name?: string;
}

/**
 * Image element on the moodboard
 */
export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;              // Firebase Storage URL
  thumbnailSrc?: string;
  originalWidth: number;
  originalHeight: number;
  clipId?: string;          // Link to design clip from clipper
  designItemId?: string;    // Link to design item
  filters?: {
    brightness: number;     // -100 to 100
    contrast: number;       // -100 to 100
    saturation: number;     // -100 to 100
  };
  cropBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  borderRadius?: number;
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

/**
 * Text element on the moodboard
 */
export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700';
  fontStyle: 'normal' | 'italic';
  fill: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
  textDecoration?: 'none' | 'underline' | 'line-through';
}

/**
 * Shape element on the moodboard
 */
export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: 'rectangle' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'triangle';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
  dash?: number[];
  // For line/arrow shapes
  points?: number[];
}

/**
 * Color swatch element on the moodboard
 */
export interface ColorSwatchElement extends BaseElement {
  type: 'colorSwatch';
  color: string;
  colorName?: string;
  colorCode?: string;       // Pantone, RAL, NCS, etc.
  colorSystem?: 'pantone' | 'ral' | 'ncs' | 'hex' | 'custom';
  showLabel: boolean;
}

/**
 * Material sample element on the moodboard
 */
export interface MaterialSampleElement extends BaseElement {
  type: 'materialSample';
  materialId: string;
  materialName: string;
  thumbnailUrl: string;
  finish?: string;
  supplier?: string;
  materialCode?: string;
  showLabel: boolean;
}

/**
 * Union type for all moodboard elements
 */
export type MoodboardElement =
  | ImageElement
  | TextElement
  | ShapeElement
  | ColorSwatchElement
  | MaterialSampleElement;

// ============================================
// Color Palette Types
// ============================================

/**
 * Color swatch in the palette
 */
export interface ColorSwatch {
  id: string;
  color: string;            // Hex color
  name?: string;
  code?: string;            // Pantone, RAL, etc.
  source: 'extracted' | 'manual' | 'material' | 'preset';
  sourceImageId?: string;   // If extracted from an image
  sourceMaterialId?: string; // If from a material
}

/**
 * Material sample for the moodboard
 */
export interface MaterialSample {
  id: string;
  materialId: string;       // Reference to material library
  name: string;
  category: string;
  thumbnailUrl: string;
  finish?: string;
  supplier?: string;
}

// ============================================
// Main Moodboard Type
// ============================================

/**
 * Moodboard composition - Main entity
 */
export interface MoodboardComposition {
  id: string;
  projectId: string;
  designItemId?: string;    // Optional link to specific design item

  // Metadata
  name: string;
  description?: string;
  version: number;

  // Canvas configuration
  canvas: CanvasConfig;

  // Elements on canvas
  elements: MoodboardElement[];

  // Color palette extracted/defined
  colorPalette: ColorSwatch[];

  // Material samples linked
  materialSamples: MaterialSample[];

  // Tags/categories
  tags?: string[];
  category?: 'concept' | 'materials' | 'colors' | 'furniture' | 'lighting' | 'accessories' | 'general';

  // Status
  status: 'draft' | 'finalized' | 'shared';

  // Client portal
  sharedToPortal: boolean;
  portalShareDate?: Timestamp;

  // Timestamps
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ============================================
// History & Undo Types
// ============================================

/**
 * Action types for undo/redo
 */
export type MoodboardActionType =
  | 'ADD_ELEMENT'
  | 'REMOVE_ELEMENT'
  | 'UPDATE_ELEMENT'
  | 'REORDER_ELEMENTS'
  | 'UPDATE_CANVAS'
  | 'ADD_COLOR'
  | 'REMOVE_COLOR'
  | 'BATCH';

/**
 * History entry for undo/redo
 */
export interface MoodboardHistoryEntry {
  id: string;
  actionType: MoodboardActionType;
  timestamp: number;
  previousState: Partial<MoodboardComposition>;
  description?: string;
}

// ============================================
// Filter & Dashboard Types
// ============================================

/**
 * Filter options for moodboards
 */
export interface MoodboardFilters {
  projectId?: string;
  status?: MoodboardComposition['status'] | MoodboardComposition['status'][];
  category?: MoodboardComposition['category'] | MoodboardComposition['category'][];
  search?: string;
  sortBy?: 'name' | 'updatedAt' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Moodboard summary for listings
 */
export interface MoodboardSummary {
  id: string;
  projectId: string;
  name: string;
  thumbnailUrl?: string;
  status: MoodboardComposition['status'];
  elementCount: number;
  colorCount: number;
  updatedAt: Timestamp;
}

// ============================================
// Export Types
// ============================================

/**
 * Export format options
 */
export type MoodboardExportFormat = 'pdf' | 'png' | 'jpeg' | 'json';

/**
 * Export options
 */
export interface MoodboardExportOptions {
  format: MoodboardExportFormat;
  quality?: number;         // For JPEG: 0-1
  scale?: number;           // Export scale factor
  includeColorPalette?: boolean;
  includeMaterialList?: boolean;
  paperSize?: 'A4' | 'A3' | 'letter' | 'original';
  orientation?: 'portrait' | 'landscape';
}

// ============================================
// Tool Types
// ============================================

/**
 * Available tools in the moodboard editor
 */
export type MoodboardTool =
  | 'select'
  | 'pan'
  | 'text'
  | 'rectangle'
  | 'circle'
  | 'line'
  | 'arrow'
  | 'colorSwatch'
  | 'image';

/**
 * Tool state
 */
export interface MoodboardToolState {
  activeTool: MoodboardTool;
  // Default values for new elements
  defaultFill: string;
  defaultStroke: string;
  defaultStrokeWidth: number;
  defaultFontFamily: string;
  defaultFontSize: number;
  defaultTextColor: string;
}

// ============================================
// Constants
// ============================================

/**
 * Default canvas configuration
 */
export const DEFAULT_CANVAS_CONFIG: CanvasConfig = {
  width: 1200,
  height: 800,
  backgroundColor: '#ffffff',
  gridEnabled: false,
  gridSize: 20,
  snapToGrid: false,
};

/**
 * Default tool state
 */
export const DEFAULT_TOOL_STATE: MoodboardToolState = {
  activeTool: 'select',
  defaultFill: '#e5e5e5',
  defaultStroke: '#333333',
  defaultStrokeWidth: 2,
  defaultFontFamily: 'Inter',
  defaultFontSize: 16,
  defaultTextColor: '#333333',
};

/**
 * Available font families
 */
export const MOODBOARD_FONTS = [
  'Inter',
  'Outfit',
  'Playfair Display',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Raleway',
  'Merriweather',
  'Georgia',
];

/**
 * Preset color swatches
 */
export const PRESET_COLORS: Array<{ color: string; name: string }> = [
  { color: '#000000', name: 'Black' },
  { color: '#FFFFFF', name: 'White' },
  { color: '#F5F5F5', name: 'Light Gray' },
  { color: '#9E9E9E', name: 'Gray' },
  { color: '#424242', name: 'Dark Gray' },
  { color: '#C9B18F', name: 'Cashmere' },
  { color: '#872E5C', name: 'Boysenberry' },
  { color: '#7FCDCD', name: 'Seafoam' },
  { color: '#6B8E4E', name: 'Pesto' },
  { color: '#D4AF37', name: 'Gold' },
  { color: '#B87333', name: 'Copper' },
  { color: '#2C3E50', name: 'Navy' },
];
