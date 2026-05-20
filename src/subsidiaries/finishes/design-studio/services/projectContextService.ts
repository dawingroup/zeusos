/**
 * Project Context Service — Auto-populate title block fields from Firestore
 * Resolution chain: MO → Design Project → Customer
 */

import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ProjectContext, ProjectModelFile, DesignItemPartSummary, MaterialPaletteEntry } from '../types/workshop-viewer.types';
import { fetchMOWithBOM } from './productionService';

const WORKSHOP_MODEL_RE = /\.(3ds|dxf)$/i;
const WORKSHOP_CSV_RE = /\.csv$/i;

/**
 * Query the `projectFiles` collection for workshop-compatible files.
 * Supplements the deliverables subcollection so files uploaded via the
 * Unified File Manager are also visible in the Workshop Viewer.
 */
async function getProjectFilesForWorkshop(
  projectId: string,
  itemId?: string
): Promise<{ models: ProjectModelFile[]; csvFiles: ProjectModelFile[] }> {
  const models: ProjectModelFile[] = [];
  const csvFiles: ProjectModelFile[] = [];
  try {
    const constraints = [
      where('projectId', '==', projectId),
      where('isLatest', '==', true),
    ];
    if (itemId) {
      constraints.push(where('itemId', '==', itemId));
    }
    const q = query(collection(db, 'projectFiles'), ...constraints);
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      const name = (data.fileName || data.name || '').toLowerCase();
      const url = data.storageUrl;
      if (!url) continue;

      const entry: ProjectModelFile = {
        fileName: data.fileName || data.name || '',
        storageUrl: url,
        itemId: data.itemId || '',
        itemName: data.itemName || '',
        _sourceId: data._sourceId || undefined,
      };

      if (WORKSHOP_MODEL_RE.test(name)) {
        models.push(entry);
      } else if (WORKSHOP_CSV_RE.test(name)) {
        csvFiles.push(entry);
      }
    }
  } catch (err) {
    console.warn('[projectContextService] Failed to query projectFiles:', err);
  }
  return { models, csvFiles };
}

/**
 * Resolve project context from a Design Project ID.
 */
export async function resolveFromDesignProject(projectId: string): Promise<ProjectContext | null> {
  try {
    const projectSnap = await getDoc(doc(db, 'designProjects', projectId));
    if (!projectSnap.exists()) return null;

    const project = projectSnap.data();
    let clientName = '';
    let clientAddress = '';

    // Fetch customer if linked
    if (project.customerId) {
      const customerSnap = await getDoc(doc(db, 'customers', project.customerId));
      if (customerSnap.exists()) {
        const customer = customerSnap.data();
        clientName = customer.name || customer.companyName || '';
        clientAddress = customer.address || '';
      }
    }

    return {
      projectId,
      projectName: project.name || project.title || '',
      projectCode: project.projectCode || project.code || '',
      clientName,
      clientAddress,
      stage: project.stage || 'Construction Documents',
      source: 'design-project',
    };
  } catch (err) {
    console.error('Failed to resolve project context:', err);
    return null;
  }
}

/**
 * Resolve project context from a Manufacturing Order ID.
 * Follows: MO → demandSource.referenceId → Design Project → Customer
 */
export async function resolveFromManufacturingOrder(moId: string): Promise<ProjectContext | null> {
  try {
    const moSnap = await getDoc(doc(db, 'manufacturingOrders', moId));
    if (!moSnap.exists()) return null;

    const mo = moSnap.data();

    // Fetch production context (BOM with stock badges) in parallel
    const productionContextPromise = fetchMOWithBOM(moId);

    // Follow to design project via demandSource
    const designProjectId = mo.demandSource?.referenceId || mo.linkedProjectId;
    if (designProjectId) {
      const [context, productionContext] = await Promise.all([
        resolveFromDesignProject(designProjectId),
        productionContextPromise,
      ]);
      if (context) {
        return { ...context, source: 'manufacturing-order', productionContext: productionContext || undefined };
      }
    }

    const productionContext = await productionContextPromise;

    // Fallback: use MO's own data
    return {
      projectId: moId,
      projectName: mo.name || mo.title || '',
      projectCode: mo.orderNumber || '',
      clientName: mo.customerName || '',
      clientAddress: '',
      stage: 'Production',
      source: 'manufacturing-order',
      productionContext: productionContext || undefined,
    };
  } catch (err) {
    console.error('Failed to resolve MO context:', err);
    return null;
  }
}

/**
 * Resolve full context from a Design Project + Design Item.
 * Fetches parts, material palette, and 3D file deliverables.
 */
export async function resolveFromDesignItem(
  projectId: string,
  itemId: string,
): Promise<ProjectContext | null> {
  try {
    // Get base project context
    const baseContext = await resolveFromDesignProject(projectId);
    if (!baseContext) return null;

    // Fetch the design item
    const itemSnap = await getDoc(doc(db, 'designProjects', projectId, 'designItems', itemId));
    if (!itemSnap.exists()) return baseContext;

    const item = itemSnap.data();

    // Extract parts summary
    const designItemParts: DesignItemPartSummary[] = (item.parts || []).map((p: Record<string, unknown>) => ({
      name: p.name || '',
      materialName: p.materialName || '',
      length: p.length || 0,
      width: p.width || 0,
      thickness: p.thickness || 0,
      quantity: p.quantity || 1,
      edgeBanding: p.edgeBanding || undefined,
      grainDirection: p.grainDirection || undefined,
    }));

    // Extract material palette from project
    const projectSnap = await getDoc(doc(db, 'designProjects', projectId));
    const projectData = projectSnap.exists() ? projectSnap.data() : {};
    const rawPalette = projectData.materialPalette;
    const materialPalette: MaterialPaletteEntry[] = (Array.isArray(rawPalette) ? rawPalette : []).map((m: Record<string, unknown>) => ({
      name: String(m.name || m.materialName || ''),
      code: String(m.code || m.materialCode || ''),
      thickness: typeof m.thickness === 'number' ? m.thickness : undefined,
      inventoryItemId: typeof m.inventoryItemId === 'string' ? m.inventoryItemId : undefined,
    }));

    // Collect ALL 3D model files and CSV cut list files.
    // Cross-reference projectFiles and deliverables to filter orphans in both directions.
    let modelFileUrl: string | undefined;
    const modelFileUrls: ProjectModelFile[] = [];
    const csvFileUrls: ProjectModelFile[] = [];

    // Fetch both projectFiles and deliverables
    const pfResult = await getProjectFilesForWorkshop(projectId, itemId);

    // Also fetch deliverable URLs so we can detect orphaned projectFiles mirrors
    const deliverableUrls = new Set<string>();
    try {
      const deliverablesSnap = await getDocs(
        collection(db, 'designProjects', projectId, 'designItems', itemId, 'deliverables')
      );
      for (const d of deliverablesSnap.docs) {
        const data = d.data();
        const url = data.storageUrl || data.fileUrl || data.url;
        if (url) deliverableUrls.add(url);
      }
    } catch {
      // Deliverables subcollection may not exist
    }

    // Filter projectFiles: mirrored entries whose source deliverable was deleted are orphans.
    // Keep entries that: (a) are not mirrors (_sourceId absent), or (b) have a matching deliverable URL.
    const filterOrphans = (entries: ProjectModelFile[]) =>
      entries.filter(e => !e._sourceId || deliverableUrls.has(e.storageUrl));
    const validPfModels = filterOrphans(pfResult.models);
    const validPfCsv = filterOrphans(pfResult.csvFiles);
    const pfUrls = new Set([...validPfModels, ...validPfCsv].map(f => f.storageUrl));
    const hasProjectFiles = pfUrls.size > 0;

    // Add valid projectFiles entries
    for (const m of validPfModels) {
      modelFileUrls.push(m);
      if (!modelFileUrl) modelFileUrl = m.storageUrl;
    }
    for (const c of validPfCsv) {
      csvFileUrls.push(c);
    }

    // Add deliverables not already covered by projectFiles
    const seenUrls = new Set(pfUrls);
    for (const url of deliverableUrls) {
      if (seenUrls.has(url)) continue;
      // If projectFiles has entries, skip deliverables not in projectFiles (deleted from UFM)
      if (hasProjectFiles && !pfUrls.has(url)) continue;
      seenUrls.add(url);
    }
    // Re-scan deliverables for file details (only for URLs we haven't seen)
    try {
      const deliverablesSnap = await getDocs(
        collection(db, 'designProjects', projectId, 'designItems', itemId, 'deliverables')
      );
      for (const d of deliverablesSnap.docs) {
        const data = d.data();
        const name = (data.fileName || data.name || '').toLowerCase();
        const url = data.storageUrl || data.fileUrl || data.url;
        if (!url || pfUrls.has(url)) continue;
        if (hasProjectFiles && !pfUrls.has(url)) continue;

        if (name.endsWith('.3ds') || name.endsWith('.dxf')) {
          modelFileUrls.push({
            fileName: data.fileName || data.name || '',
            storageUrl: url,
            itemId,
            itemName: item.name || item.itemCode || '',
          });
          if (!modelFileUrl) modelFileUrl = url;
        } else if (name.endsWith('.csv')) {
          csvFileUrls.push({
            fileName: data.fileName || data.name || '',
            storageUrl: url,
            itemId,
            itemName: item.name || item.itemCode || '',
          });
        }
      }
    } catch {
      // Deliverables subcollection may not exist
    }

    // P21.8.1 — surface the rollup summary so the Item Metadata panel
    // can badge "N cabinets contribute frozen totals" without a second
    // read. Silently omit when the item has no rollup yet (never
    // aggregated, or cleared because the last cabinet was removed).
    const rawRollup = item.manufacturingRollup as
      | { cabinetCount?: unknown; lockedCabinetCount?: unknown }
      | undefined;
    const rollupSummary =
      rawRollup && typeof rawRollup.cabinetCount === 'number'
        ? {
            cabinetCount: rawRollup.cabinetCount,
            lockedCabinetCount:
              typeof rawRollup.lockedCabinetCount === 'number'
                ? rawRollup.lockedCabinetCount
                : 0,
          }
        : undefined;

    return {
      ...baseContext,
      designItemId: itemId,
      designItemName: item.name || item.itemCode || '',
      designItemStage: item.currentStage || '',
      designItemParts,
      materialPalette,
      rollupSummary,
      modelFileUrl,
      modelFileUrls,
      csvFileUrls,
    };
  } catch (err) {
    console.error('Failed to resolve design item context:', err);
    return null;
  }
}

/**
 * Auto-detect context from URL search params.
 * ?projectId=xxx&itemId=yyy or ?moId=xxx
 */
export async function resolveFromUrlParams(): Promise<ProjectContext | null> {
  const params = new URLSearchParams(window.location.search);

  const projectId = params.get('projectId');
  const itemId = params.get('itemId');

  if (projectId && itemId) return resolveFromDesignItem(projectId, itemId);
  if (projectId) return resolveFromDesignProject(projectId);

  const moId = params.get('moId');
  if (moId) return resolveFromManufacturingOrder(moId);

  return null;
}

/**
 * Resolve ALL 3D model files across ALL design items in a project.
 * Used by the multi-model picker in FileUploadZone.
 */
export async function resolveProjectModels(projectId: string): Promise<ProjectModelFile[]> {
  const allModels: ProjectModelFile[] = [];
  const seenUrls = new Set<string>();
  try {
    const itemsSnap = await getDocs(collection(db, 'designProjects', projectId, 'designItems'));
    for (const itemDoc of itemsSnap.docs) {
      const itemData = itemDoc.data();
      const itemName = itemData.name || itemData.itemCode || itemDoc.id;

      try {
        const deliverablesSnap = await getDocs(
          collection(db, 'designProjects', projectId, 'designItems', itemDoc.id, 'deliverables')
        );
        for (const d of deliverablesSnap.docs) {
          const data = d.data();
          const name = (data.fileName || data.name || '').toLowerCase();
          if (name.endsWith('.3ds') || name.endsWith('.dxf')) {
            const url = data.storageUrl || data.fileUrl || data.url;
            if (url) {
              seenUrls.add(url);
              allModels.push({
                fileName: data.fileName || data.name || '',
                storageUrl: url,
                itemId: itemDoc.id,
                itemName,
              });
            }
          }
        }
      } catch {
        // Deliverables subcollection may not exist for this item
      }
    }
  } catch (err) {
    console.error('Failed to resolve project models:', err);
  }

  // Also include models from projectFiles collection — but skip orphaned mirrors
  const pfResult = await getProjectFilesForWorkshop(projectId);
  for (const m of pfResult.models) {
    if (seenUrls.has(m.storageUrl)) continue;
    // Orphaned mirror: _sourceId set but no matching deliverable URL
    if (m._sourceId) continue;
    allModels.push(m);
  }

  return allModels;
}

/**
 * Resolve ALL CSV cut list files across ALL design items in a project.
 */
export async function resolveProjectCsvFiles(projectId: string): Promise<ProjectModelFile[]> {
  const allCsv: ProjectModelFile[] = [];
  const seenUrls = new Set<string>();
  try {
    const itemsSnap = await getDocs(collection(db, 'designProjects', projectId, 'designItems'));
    for (const itemDoc of itemsSnap.docs) {
      const itemData = itemDoc.data();
      const itemName = itemData.name || itemData.itemCode || itemDoc.id;

      try {
        const deliverablesSnap = await getDocs(
          collection(db, 'designProjects', projectId, 'designItems', itemDoc.id, 'deliverables')
        );
        for (const d of deliverablesSnap.docs) {
          const data = d.data();
          const name = (data.fileName || data.name || '').toLowerCase();
          if (name.endsWith('.csv')) {
            const url = data.storageUrl || data.fileUrl || data.url;
            if (url) {
              seenUrls.add(url);
              allCsv.push({
                fileName: data.fileName || data.name || '',
                storageUrl: url,
                itemId: itemDoc.id,
                itemName,
              });
            }
          }
        }
      } catch {
        // Deliverables subcollection may not exist for this item
      }
    }
  } catch (err) {
    console.error('Failed to resolve project CSV files:', err);
  }

  // Also include CSVs from projectFiles collection — but skip orphaned mirrors
  const pfResult = await getProjectFilesForWorkshop(projectId);
  for (const c of pfResult.csvFiles) {
    if (seenUrls.has(c.storageUrl)) continue;
    if (c._sourceId) continue;
    allCsv.push(c);
  }

  return allCsv;
}

/**
 * Scan active design projects for available workshop files (models + CSVs).
 * Returns up to 20 most recently updated active projects with their files.
 */
export async function scanActiveProjectsForFiles(): Promise<Array<{
  projectId: string;
  projectName: string;
  projectCode: string;
  items: Array<{
    itemId: string;
    itemName: string;
    models: ProjectModelFile[];
    csvFiles: ProjectModelFile[];
  }>;
}>> {
  const results: Array<{
    projectId: string;
    projectName: string;
    projectCode: string;
    items: Array<{
      itemId: string;
      itemName: string;
      models: ProjectModelFile[];
      csvFiles: ProjectModelFile[];
    }>;
  }> = [];

  try {
    const projectsQuery = query(
      collection(db, 'designProjects'),
      where('status', '==', 'active'),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    const projectSnaps = await getDocs(projectsQuery);

    for (const projDoc of projectSnaps.docs) {
      const projData = projDoc.data();
      const itemsSnap = await getDocs(
        collection(db, 'designProjects', projDoc.id, 'designItems')
      );

      const items: Array<{
        itemId: string;
        itemName: string;
        models: ProjectModelFile[];
        csvFiles: ProjectModelFile[];
      }> = [];

      for (const itemDoc of itemsSnap.docs) {
        const itemData = itemDoc.data();
        const delivSnap = await getDocs(
          collection(db, 'designProjects', projDoc.id, 'designItems', itemDoc.id, 'deliverables')
        );

        const models: ProjectModelFile[] = [];
        const csvFiles: ProjectModelFile[] = [];

        for (const d of delivSnap.docs) {
          const data = d.data();
          const name = (data.fileName || data.name || '').toLowerCase();
          const url = data.storageUrl || data.fileUrl;
          if (!url) continue;

          if (name.endsWith('.3ds') || name.endsWith('.dxf')) {
            models.push({ fileName: data.fileName || data.name, storageUrl: url, itemId: itemDoc.id, itemName: itemData.name || '' });
          } else if (name.endsWith('.csv')) {
            csvFiles.push({ fileName: data.fileName || data.name, storageUrl: url, itemId: itemDoc.id, itemName: itemData.name || '' });
          }
        }

        if (models.length > 0 || csvFiles.length > 0) {
          items.push({ itemId: itemDoc.id, itemName: itemData.name || itemData.itemCode || '', models, csvFiles });
        }
      }

      // Also merge in projectFiles for this project — skip orphaned mirrors
      const pfResult = await getProjectFilesForWorkshop(projDoc.id);
      const pfSeenUrls = new Set(items.flatMap(i => [...i.models, ...i.csvFiles].map(f => f.storageUrl)));
      const unlinkedModels = pfResult.models.filter(m => !pfSeenUrls.has(m.storageUrl) && !m._sourceId);
      const unlinkedCsv = pfResult.csvFiles.filter(c => !pfSeenUrls.has(c.storageUrl) && !c._sourceId);
      if (unlinkedModels.length > 0 || unlinkedCsv.length > 0) {
        items.push({
          itemId: '_project-files',
          itemName: 'Project Files',
          models: unlinkedModels,
          csvFiles: unlinkedCsv,
        });
      }

      if (items.length > 0) {
        results.push({
          projectId: projDoc.id,
          projectName: projData.name || '',
          projectCode: projData.code || '',
          items,
        });
      }
    }
  } catch (err) {
    console.error('Failed to scan active projects for files:', err);
  }

  return results;
}
