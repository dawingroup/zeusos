/**
 * Project PDF Types — Multi-section project PDF export
 */
import type { Timestamp } from 'firebase/firestore';
import type { PDFSectionType } from '../constants/projectPdf.constants';
import type { DesignScene, SceneCabinet } from './scene.types';
import type { SceneBOMRollup, BOMCategoryRollup, AssemblyCutListSection, ProjectCutList } from './assembly.types';
import type { PricingBreakdown } from './constraintEngine.types';
import type { HardwareScheduleEntry, EdgeBandingEntry } from './mdp.types';
import type { FinishResolver } from '../services/finishScheduleAggregator';
import type { InventoryResolver } from '../services/scheduleLibraryResolvers';

/** Request to generate a project PDF */
export interface ProjectPDFRequest {
  sceneId: string;
  sections: PDFSectionType[];
  includeAssemblyDrawings: boolean;
  includeRenders: boolean;
  renderQuality: 'standard' | 'high';
  layout: 'detailed' | 'workshop' | 'client_presentation';
  customer?: {
    name: string;
    address: string;
  };
  notes?: string;
  /**
   * Optional Finish-Library resolver. When absent, the PDF generator
   * builds one automatically by scoping a batch fetch to exactly the
   * finishLibraryIds the scene uses. Callers override when they
   * already hold a cached library Map.
   */
  finishResolver?: FinishResolver;
  /**
   * Optional Materials-library (inventoryItems) resolver. Same
   * default-build-on-demand semantics as `finishResolver`. Drives the
   * enriched hardware schedule columns (SKU, brand, supplier, unit
   * cost).
   */
  inventoryResolver?: InventoryResolver;

  /**
   * Scene-level schedule sheet toggles. Optional — when omitted, the
   * layout drives the default (detailed = all on, workshop = schedules
   * only, client = renders + finishes + architectural). Setting a
   * field explicitly overrides the layout default, so a user can
   * produce a workshop bundle WITH a render gallery if they want.
   */
  includeRenderGallery?: boolean;
  includeHardwareSchedule?: boolean;
  includeFinishSchedule?: boolean;
  includeArchitecturalPlans?: boolean;
  /** When set, overrides the "Project Summary" section checkbox —
   *  controls whether the P-block (consolidated project drawings)
   *  renders at all. */
  includeProjectSection?: boolean;
  /** When set, overrides the "Cabinet Detail Pages" section — gates
   *  every per-cabinet block (C01/C02/…). */
  includeCabinetSection?: boolean;
}

/** All data needed to render a project PDF */
export interface ProjectPDFData {
  scene: DesignScene;
  cabinets: SceneCabinet[];
  cutList: ProjectCutList;
  bomRollup: SceneBOMRollup;
  hardwareSchedule: HardwareScheduleEntry[];
  edgeBandingSchedule: EdgeBandingEntry[];
  totalPricing: PricingBreakdown;
  generatedAt: Timestamp;
  generatedBy: string;
}

/** Per-cabinet section in the project PDF */
export interface CabinetPDFSection {
  cabinet: SceneCabinet;
  renderUrl: string;
  partsBreakdown: AssemblyCutListSection[];
  cabinetBOM: BOMCategoryRollup[];
  cabinetPrice: PricingBreakdown;
  notes: string[];
}
