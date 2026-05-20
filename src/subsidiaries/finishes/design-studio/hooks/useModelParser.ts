/**
 * useModelParser — Orchestrates file parsing, assembly detection, and linkage
 */

import { useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {
  ParsedModel,
  MeshObject,
  MaterialDef,
  CutListEntry,
  PartTreeNode,
  MeshCutListLink,
  DimensionSet,
} from '../types/workshop-viewer.types';
import { parse3DS } from '../services/parser3ds';
import { parseDXF } from '../services/parserDxf';
import { parseGLB } from '../services/parserGlb';
import { parsePolyBoardCSV } from '../services/parserCsv';
import { computeDimensions } from '../services/dimensionEngine';
import { buildMeshCutListLinks, buildPartTree } from '../services/assemblyEngine';

interface UseModelParserReturn {
  model: ParsedModel | null;
  cutList: CutListEntry[];
  partTree: PartTreeNode[];
  meshLinks: MeshCutListLink[];
  dimensions: DimensionSet | null;
  modelFileName: string | undefined;
  csvFileName: string | undefined;
  loading: boolean;
  error: string | null;
  loadModelFile: (file: File) => void;
  loadMultipleModelFiles: (files: File[]) => void;
  loadCsvFile: (file: File) => void;
  reset: () => void;
}

export function useModelParser(): UseModelParserReturn {
  const [model, setModel] = useState<ParsedModel | null>(null);
  const [cutList, setCutList] = useState<CutListEntry[]>([]);
  const [partTree, setPartTree] = useState<PartTreeNode[]>([]);
  const [meshLinks, setMeshLinks] = useState<MeshCutListLink[]>([]);
  const [dimensions, setDimensions] = useState<DimensionSet | null>(null);
  const [modelFileName, setModelFileName] = useState<string | undefined>();
  const [csvFileName, setCsvFileName] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute dimensions from GLB buffer using Three.js Box3
  const computeGlbDimensions = useCallback(async (buffer: ArrayBuffer): Promise<DimensionSet> => {
    const loader = new GLTFLoader();
    return new Promise((resolve) => {
      loader.parse(buffer, '', (gltf) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const rawMax = Math.max(size.x, size.y, size.z);
        // Tripo AI models are in meters — scale to mm if model is small
        const scale = rawMax < 100 ? 1000 : 1;
        resolve({
          overall: {
            width: Math.round(size.x * scale),
            depth: Math.round(size.z * scale),
            height: Math.round(size.y * scale),
          },
          intermediate: [],
        });
      }, () => {
        resolve({ overall: { width: 0, depth: 0, height: 0 }, intermediate: [] });
      });
    });
  }, []);

  // Rebuild links and tree when both model and cutlist change
  const rebuildAssembly = useCallback(async (parsedModel: ParsedModel | null, parsedCutList: CutListEntry[]) => {
    if (!parsedModel) return;

    const links = parsedCutList.length > 0
      ? buildMeshCutListLinks(parsedModel, parsedCutList)
      : [];
    const tree = buildPartTree(parsedModel, parsedCutList, links);

    // For GLB models, compute dims from the actual 3D scene
    let dims: DimensionSet;
    if (parsedModel.source === 'glb' && parsedModel.glbBuffer) {
      dims = await computeGlbDimensions(parsedModel.glbBuffer);
    } else {
      dims = computeDimensions(parsedModel);
    }

    setMeshLinks(links);
    setPartTree(tree);
    setDimensions(dims);
  }, [computeGlbDimensions]);

  const loadModelFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let parsed: ParsedModel;

      if (ext === '3ds') {
        const buffer = await file.arrayBuffer();
        parsed = parse3DS(buffer);
      } else if (ext === 'dxf') {
        const text = await file.text();
        parsed = parseDXF(text);
      } else if (ext === 'glb' || ext === 'gltf') {
        const buffer = await file.arrayBuffer();
        parsed = await parseGLB(buffer);
      } else {
        throw new Error(`Unsupported model format: .${ext}`);
      }

      parsed.fileName = file.name;

      if (parsed.objects.length === 0) {
        throw new Error('No geometry found in file. The file may be empty or in an unsupported format.');
      }

      setModel(parsed);
      setModelFileName(file.name);
      rebuildAssembly(parsed, cutList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse model file');
      console.error('Model parse error:', err);
    } finally {
      setLoading(false);
    }
  }, [cutList, rebuildAssembly]);

  const loadMultipleModelFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    if (files.length === 1) { loadModelFile(files[0]); return; }

    setLoading(true);
    setError(null);

    try {
      const allObjects: MeshObject[] = [];
      const allMaterials: Record<string, MaterialDef> = {};
      const names: string[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        let parsed: ParsedModel;
        if (ext === '3ds') {
          parsed = parse3DS(await file.arrayBuffer());
        } else if (ext === 'dxf') {
          parsed = parseDXF(await file.text());
        } else {
          continue; // Skip unsupported formats
        }
        allObjects.push(...parsed.objects);
        Object.assign(allMaterials, parsed.materials);
        names.push(file.name);
      }

      if (allObjects.length === 0) {
        throw new Error('No geometry found in any of the selected files.');
      }

      const combined: ParsedModel = {
        source: '3ds',
        fileName: names.join(' + '),
        objects: allObjects,
        materials: allMaterials,
      };

      setModel(combined);
      setModelFileName(combined.fileName);
      rebuildAssembly(combined, cutList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse model files');
      console.error('Multi-model parse error:', err);
    } finally {
      setLoading(false);
    }
  }, [cutList, rebuildAssembly, loadModelFile]);

  const loadCsvFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const result = parsePolyBoardCSV(text);

      if (!result.success) {
        throw new Error(`CSV parse failed: ${result.errors.join(', ')}`);
      }

      setCutList(result.entries);
      setCsvFileName(file.name);

      if (model) {
        rebuildAssembly(model, result.entries);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      console.error('CSV parse error:', err);
    } finally {
      setLoading(false);
    }
  }, [model, rebuildAssembly]);

  const reset = useCallback(() => {
    setModel(null);
    setCutList([]);
    setPartTree([]);
    setMeshLinks([]);
    setDimensions(null);
    setModelFileName(undefined);
    setCsvFileName(undefined);
    setError(null);
  }, []);

  return {
    model,
    cutList,
    partTree,
    meshLinks,
    dimensions,
    modelFileName,
    csvFileName,
    loading,
    error,
    loadModelFile,
    loadMultipleModelFiles,
    loadCsvFile,
    reset,
  };
}
