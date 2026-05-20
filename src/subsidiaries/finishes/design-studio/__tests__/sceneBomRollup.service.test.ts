/**
 * Scene BOM Rollup Service Tests
 */
import { describe, it, expect } from 'vitest';
import {
  getProjectRollup,
  getCabinetRollup,
  getProjectCutList,
  getProjectPricing,
} from '../services/sceneBomRollup.service';
import type { SceneCabinet } from '../types/scene.types';
import type { SceneAssembly, ScenePart } from '../types/assembly.types';
import type { PricingBreakdown } from '../types/constraintEngine.types';

const makePart = (overrides: Partial<ScenePart> = {}): ScenePart => ({
  id: `p-${Math.random().toString(36).slice(2, 6)}`,
  assemblyId: 'asm-1',
  cabinetId: 'cab-1',
  partCode: 'P1',
  partName: 'Panel',
  partCategory: 'panel',
  inventoryItemId: 'inv-board',
  inventoryItemName: '18mm MFC',
  quantity: 1,
  unit: 'pcs',
  unitCost: 100,
  totalCost: 100,
  currency: 'UGX',
  materialDescription: '18mm MFC White',
  dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' as const },
  ...overrides,
});

const makeAssembly = (cabinetId: string, parts: ScenePart[]): SceneAssembly => ({
  id: `asm-${cabinetId}`,
  cabinetId,
  assemblyType: 'carcass',
  assemblyCode: 'carcass-1',
  displayName: 'Main Carcass',
  parts,
  meshNodeIds: [],
  boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 } },
  jointSpec: [],
  assemblySequence: [],
  isComplete: true,
  totalPartCount: parts.length,
  totalArea: 0,
  totalCost: parts.reduce((s, p) => s + p.totalCost, 0),
  sequence: 0,
});

const makeCabinet = (id: string, code: string, pricing?: Partial<PricingBreakdown>): SceneCabinet => ({
  id,
  sceneId: 'scene-1',
  pddId: 'pdd-1',
  cabinetCode: code,
  displayName: `Cabinet ${code}`,
  configuration: {},
  finishSelections: {},
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  anchorPoint: 'bottom_back_left',
  glbUrl: '',
  thumbnailUrl: '',
  assemblies: [],
  computedBOM: [],
  estimatedPrice: {
    materialsCost: 500, edgeBandingCost: 50, hardwareCost: 100,
    laborCost: 200, overheadCost: 75, marginAmount: 200,
    subtotal: 1125, vatAmount: 202, total: 1327,
    currency: 'UGX', lineItems: [],
    ...pricing,
  } as PricingBreakdown,
  isLocked: false,
  sequence: 0,
  createdAt: null as any,
  updatedAt: null as any,
});

describe('sceneBomRollup.service', () => {
  describe('getProjectRollup', () => {
    it('aggregates parts across multiple cabinets', () => {
      const cabinets = [makeCabinet('cab-1', 'KB600-A'), makeCabinet('cab-2', 'KB600-B')];
      const assembliesByCabinet: Record<string, SceneAssembly[]> = {
        'cab-1': [makeAssembly('cab-1', [
          makePart({ cabinetId: 'cab-1', totalCost: 200 }),
          makePart({ cabinetId: 'cab-1', totalCost: 150 }),
        ])],
        'cab-2': [makeAssembly('cab-2', [
          makePart({ cabinetId: 'cab-2', totalCost: 300 }),
        ])],
      };

      const rollup = getProjectRollup(cabinets, assembliesByCabinet);

      expect(rollup.level).toBe('project');
      expect(rollup.totalParts).toBe(3);
      expect(rollup.totalCost).toBe(650);
    });

    it('shows per-cabinet attribution in appearingIn', () => {
      const cabinets = [makeCabinet('cab-1', 'KB600-A'), makeCabinet('cab-2', 'KB600-B')];
      const assembliesByCabinet: Record<string, SceneAssembly[]> = {
        'cab-1': [makeAssembly('cab-1', [
          makePart({ cabinetId: 'cab-1', inventoryItemId: 'shared-board' }),
        ])],
        'cab-2': [makeAssembly('cab-2', [
          makePart({ cabinetId: 'cab-2', inventoryItemId: 'shared-board' }),
        ])],
      };

      const rollup = getProjectRollup(cabinets, assembliesByCabinet);
      const panelCat = rollup.byCategory['panel'];
      expect(panelCat).toBeDefined();

      const sharedLine = panelCat.lineItems.find(l => l.inventoryItemId === 'shared-board');
      expect(sharedLine?.appearingIn.length).toBe(2);
    });

    it('project total equals sum of cabinet totals', () => {
      const cabinets = [makeCabinet('cab-1', 'A'), makeCabinet('cab-2', 'B'), makeCabinet('cab-3', 'C')];
      const assembliesByCabinet: Record<string, SceneAssembly[]> = {
        'cab-1': [makeAssembly('cab-1', [makePart({ cabinetId: 'cab-1', totalCost: 100 })])],
        'cab-2': [makeAssembly('cab-2', [makePart({ cabinetId: 'cab-2', totalCost: 200 })])],
        'cab-3': [makeAssembly('cab-3', [makePart({ cabinetId: 'cab-3', totalCost: 300 })])],
      };

      const projectRollup = getProjectRollup(cabinets, assembliesByCabinet);
      const cabRollups = cabinets.map(c =>
        getCabinetRollup(c, assembliesByCabinet[c.id] ?? []),
      );
      const sumOfCabinets = cabRollups.reduce((s, r) => s + r.totalCost, 0);

      expect(projectRollup.totalCost).toBe(sumOfCabinets);
    });
  });

  describe('getProjectCutList', () => {
    it('builds cut list with by-cabinet and aggregated views', () => {
      const cabinets = [makeCabinet('cab-1', 'KB600-A')];
      const assembliesByCabinet: Record<string, SceneAssembly[]> = {
        'cab-1': [makeAssembly('cab-1', [
          makePart({ cabinetId: 'cab-1' }),
          makePart({ cabinetId: 'cab-1', inventoryItemId: 'mdf-8', materialDescription: '8mm MDF' }),
        ])],
      };

      const cutList = getProjectCutList(cabinets, assembliesByCabinet, 'scene-1');

      expect(cutList.sceneId).toBe('scene-1');
      expect(cutList.byCabinet.length).toBe(1);
      expect(cutList.byCabinet[0].cabinetCode).toBe('KB600-A');
      expect(cutList.aggregated.byMaterial.length).toBe(2);
    });
  });

  describe('getProjectPricing', () => {
    it('sums pricing across cabinets', () => {
      const cabinets = [
        makeCabinet('cab-1', 'A', { total: 1000, materialsCost: 500 }),
        makeCabinet('cab-2', 'B', { total: 2000, materialsCost: 1000 }),
      ];

      const pricing = getProjectPricing(cabinets);
      expect(pricing.total).toBe(3000);
      expect(pricing.materialsCost).toBe(1500);
    });
  });
});
