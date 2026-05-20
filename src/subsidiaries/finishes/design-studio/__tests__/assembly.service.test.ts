/**
 * Assembly Service Tests
 */
import { describe, it, expect } from 'vitest';
import {
  extractAssembliesFromParsedModel,
  mapPartsToAssemblies,
  getAssemblyBOM,
  mergePartsIntoAssembly,
  splitAssembly,
} from '../services/assembly.service';
import type { ScenePart, SceneAssembly } from '../types/assembly.types';

const makePart = (overrides: Partial<ScenePart> = {}): ScenePart => ({
  id: `part-${Math.random().toString(36).slice(2, 6)}`,
  assemblyId: '',
  cabinetId: 'cab-1',
  partCode: 'P1',
  partName: 'Test Part',
  partCategory: 'panel',
  inventoryItemId: 'inv-1',
  inventoryItemName: 'Test Material',
  quantity: 1,
  unit: 'pcs',
  unitCost: 100,
  totalCost: 100,
  currency: 'UGX',
  materialDescription: '18mm MFC White',
  ...overrides,
});

describe('assembly.service', () => {
  describe('extractAssembliesFromParsedModel', () => {
    it('extracts assemblies from mesh names using naming heuristics', () => {
      const meshNames = [
        'side_panel_L', 'side_panel_R', 'bottom_panel', 'back_panel', 'top_rail',
        'door_front', 'shelf_1',
        'hinge_L', 'hinge_R', 'handle_1',
      ];

      const assemblies = extractAssembliesFromParsedModel('cab-1', meshNames);

      expect(assemblies.length).toBeGreaterThan(0);
      const types = assemblies.map(a => a.assemblyType);
      expect(types).toContain('carcass');
      expect(types).toContain('door_assembly');
      expect(types).toContain('hardware_kit');
    });

    it('uses archetype hierarchy when provided', () => {
      const meshNames = ['side_L', 'bottom'];
      const assemblies = extractAssembliesFromParsedModel('cab-1', meshNames, 'kitchen_base');

      const types = assemblies.map(a => a.assemblyType);
      expect(types).toContain('carcass');
      expect(types).toContain('drawer_box');
      expect(types).toContain('door_assembly');
      expect(types).toContain('plinth_assembly');
      expect(types).toContain('hardware_kit');
    });

    it('creates default assemblies for empty mesh list', () => {
      const assemblies = extractAssembliesFromParsedModel('cab-1', []);
      expect(assemblies.length).toBeGreaterThan(0);
    });
  });

  describe('mapPartsToAssemblies', () => {
    it('maps parts to assemblies by name heuristics', () => {
      const assemblies = extractAssembliesFromParsedModel('cab-1', ['side', 'door'], 'kitchen_base');
      const parts = [
        makePart({ partName: 'side_panel_L', partCategory: 'panel' }),
        makePart({ partName: 'door_front', partCategory: 'panel' }),
        makePart({ partName: 'hinge_clip_top', partCategory: 'hardware' }),
      ];

      const result = mapPartsToAssemblies(parts, assemblies);
      const carcass = result.find(a => a.assemblyType === 'carcass');
      const door = result.find(a => a.assemblyType === 'door_assembly');
      const hw = result.find(a => a.assemblyType === 'hardware_kit');

      expect(carcass?.parts.length).toBe(1);
      expect(door?.parts.length).toBe(1);
      expect(hw?.parts.length).toBe(1);
    });

    it('updates assembly totals after mapping', () => {
      const assemblies = extractAssembliesFromParsedModel('cab-1', ['side']);
      const parts = [
        makePart({ partName: 'side_L', totalCost: 200 }),
        makePart({ partName: 'side_R', totalCost: 200 }),
      ];

      const result = mapPartsToAssemblies(parts, assemblies);
      const carcass = result.find(a => a.assemblyType === 'carcass');
      expect(carcass?.totalPartCount).toBe(2);
      expect(carcass?.totalCost).toBe(400);
    });
  });

  describe('getAssemblyBOM', () => {
    it('groups parts by category with subtotals', () => {
      const assembly: SceneAssembly = {
        id: 'asm-1', cabinetId: 'cab-1', assemblyType: 'carcass',
        assemblyCode: 'carcass-1', displayName: 'Carcass',
        parts: [
          makePart({ partCategory: 'panel', totalCost: 300 }),
          makePart({ partCategory: 'panel', totalCost: 200 }),
          makePart({ partCategory: 'hardware', totalCost: 50 }),
        ],
        meshNodeIds: [], boundingBox: { min: {x:0,y:0,z:0}, max: {x:0,y:0,z:0}, center: {x:0,y:0,z:0}, size: {x:0,y:0,z:0} },
        jointSpec: [], assemblySequence: [],
        isComplete: true, totalPartCount: 3, totalArea: 0, totalCost: 550, sequence: 0,
      };

      const bom = getAssemblyBOM(assembly);
      expect(bom.length).toBe(2); // panel + hardware
      const panelCat = bom.find(c => c.category === 'panel');
      expect(panelCat?.subtotal).toBe(500);
      expect(panelCat?.partCount).toBe(2);
    });
  });

  describe('mergePartsIntoAssembly', () => {
    it('moves selected parts to a new assembly', () => {
      const p1 = makePart({ id: 'p1', partName: 'part A' });
      const p2 = makePart({ id: 'p2', partName: 'part B' });
      const p3 = makePart({ id: 'p3', partName: 'part C' });

      const assemblies: SceneAssembly[] = [{
        id: 'asm-1', cabinetId: 'cab-1', assemblyType: 'carcass',
        assemblyCode: 'carcass-1', displayName: 'Carcass',
        parts: [p1, p2, p3],
        meshNodeIds: [], boundingBox: { min: {x:0,y:0,z:0}, max: {x:0,y:0,z:0}, center: {x:0,y:0,z:0}, size: {x:0,y:0,z:0} },
        jointSpec: [], assemblySequence: [],
        isComplete: true, totalPartCount: 3, totalArea: 0, totalCost: 300, sequence: 0,
      }];

      const result = mergePartsIntoAssembly(assemblies, ['p1', 'p2'], 'shelf_pack', 'New Shelf Pack', 'cab-1');

      expect(result.length).toBe(2);
      const remaining = result.find(a => a.assemblyType === 'carcass');
      const newAsm = result.find(a => a.assemblyType === 'shelf_pack');

      expect(remaining?.parts.length).toBe(1);
      expect(newAsm?.parts.length).toBe(2);
    });
  });

  describe('splitAssembly', () => {
    it('splits one assembly into multiple', () => {
      const p1 = makePart({ id: 'p1' });
      const p2 = makePart({ id: 'p2' });
      const p3 = makePart({ id: 'p3' });

      const assemblies: SceneAssembly[] = [{
        id: 'asm-1', cabinetId: 'cab-1', assemblyType: 'carcass',
        assemblyCode: 'carcass-1', displayName: 'Big Carcass',
        parts: [p1, p2, p3],
        meshNodeIds: [], boundingBox: { min: {x:0,y:0,z:0}, max: {x:0,y:0,z:0}, center: {x:0,y:0,z:0}, size: {x:0,y:0,z:0} },
        jointSpec: [], assemblySequence: [],
        isComplete: true, totalPartCount: 3, totalArea: 0, totalCost: 300, sequence: 0,
      }];

      const result = splitAssembly(assemblies, 'asm-1', [['p1'], ['p2', 'p3']], ['Group A', 'Group B'], 'cab-1');

      expect(result.length).toBe(2);
      expect(result[0].parts.length).toBe(1);
      expect(result[1].parts.length).toBe(2);
      expect(result[0].displayName).toBe('Group A');
    });
  });
});
