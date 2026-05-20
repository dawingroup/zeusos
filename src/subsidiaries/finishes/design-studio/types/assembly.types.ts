/**
 * Assembly Types — Scene-level assembly hierarchy
 *
 * Formal hierarchy: Scene → Cabinet → Assembly → Part
 * Enables selection at any level, BOM aggregation at any level,
 * and cutlist grouping at any level.
 */
import type { Timestamp } from 'firebase/firestore';
import type { AssemblyTypeEnum, PartCategory } from '../constants/assembly.constants';
import type { CNCBoringSpec, HardwareScheduleEntry } from './mdp.types';
import type { JointSpec } from './knowledgeBase.types';
import type { PartRole } from './workshop-viewer.types';
import type { RelativePosition } from './ai-recognition.types';

/** An assembly within a cabinet (e.g., carcass, drawer box, door assembly) */
export interface SceneAssembly {
  id: string;
  cabinetId: string;
  assemblyType: AssemblyTypeEnum;
  assemblyCode: string;
  displayName: string;
  parts: ScenePart[];
  meshNodeIds: string[];
  boundingBox: BoundingBox;
  jointSpec: JointSpec[];
  assemblySequence: string[];
  isComplete: boolean;
  totalPartCount: number;
  totalArea: number;
  totalCost: number;
  sequence: number;
}

/** An individual part within an assembly */
export interface ScenePart {
  id: string;
  assemblyId: string;
  cabinetId: string;
  partCode: string;
  partName: string;
  partCategory: PartCategory;
  /** Structural role within the parent assembly — side, shelf, door, etc.
   *  Persisted at recognition time so downstream naming + drawings are stable. */
  role?: PartRole;
  /** Spatial position within the parent assembly — left, right, top, etc.
   *  Persisted at recognition time so naming includes position context. */
  relativePosition?: RelativePosition;
  componentEntryId?: string;
  inventoryItemId: string;
  inventoryItemName: string;
  meshNodeId?: string;

  dimensions?: {
    length: number;
    width: number;
    thickness: number;
    grainDirection: 'length' | 'width' | 'none';
  };

  /** Geometry-source metadata for mesh-derived dimensions (P5.1). */
  dimensionQuality?: {
    source: 'obb' | 'aabb' | 'csv';
    confidence: number;
    uncertain?: boolean;
    aabb?: { length: number; width: number; thickness: number };
    obb?: { length: number; width: number; thickness: number };
  };

  edgeBanding?: {
    top: { type: string; length: number } | null;
    bottom: { type: string; length: number } | null;
    left: { type: string; length: number } | null;
    right: { type: string; length: number } | null;
    front: { type: string; length: number } | null;
  };

  quantity: number;
  unit: string;

  unitCost: number;
  totalCost: number;
  currency: 'UGX' | 'USD';

  finishLibraryId?: string;
  materialDescription: string;

  /** CNC boring/drilling specification — canonical P1.3 shape.
   *  Legacy data (ad-hoc `{ targets }`, `{ hardware }`, `{ holes }` shapes)
   *  is normalised at read-time by `normalizeBoringSpec()`. */
  boringSpec?: CNCBoringSpec;
  notes?: string;
}

/** Axis-aligned bounding box */
export interface BoundingBox {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}

/** Aggregated BOM view — computed on demand, not stored */
export interface SceneBOMRollup {
  level: 'project' | 'cabinet' | 'assembly';
  scopeId: string;
  scopeName: string;
  byCategory: Record<string, BOMCategoryRollup>;
  totalCost: number;
  totalParts: number;
  currency: 'UGX' | 'USD';
}

export interface BOMCategoryRollup {
  category: PartCategory;
  lineItems: BOMRollupLine[];
  subtotal: number;
  partCount: number;
}

export interface BOMRollupLine {
  inventoryItemId: string;
  inventoryItemName: string;
  description: string;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  appearingIn: { cabinetId: string; cabinetName: string; qty: number }[];
}

/** Full project cut list */
export interface ProjectCutList {
  sceneId: string;
  generatedAt: Timestamp;
  byCabinet: CabinetCutListSection[];
  aggregated: AggregatedCutList;
  totalSheetCount: Record<string, number>;
  totalEdgeBandingByType: Record<string, number>;
  totalHardwareItems: HardwareScheduleEntry[];
}

export interface CabinetCutListSection {
  cabinetId: string;
  cabinetCode: string;
  cabinetName: string;
  byAssembly: AssemblyCutListSection[];
  cabinetTotal: { partCount: number; area: number; cost: number };
}

export interface AssemblyCutListSection {
  assemblyId: string;
  assemblyCode: string;
  assemblyName: string;
  parts: ScenePart[];
  assemblyTotal: { partCount: number; area: number; cost: number };
}

export interface AggregatedCutList {
  byMaterial: {
    material: string;
    finishLibraryId: string;
    parts: ScenePart[];
    totalArea: number;
  }[];
}
