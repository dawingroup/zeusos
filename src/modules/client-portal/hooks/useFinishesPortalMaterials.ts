/**
 * useFinishesPortalMaterials — feeds the portal Materials & FF&E screen.
 *
 * Reads the project's `materials` subcollection
 * (`designProjects/<id>/materials/*`). Each Material doc carries the
 * canonical staff-side schema (code / name / category / etc.) plus
 * optional portal-only extras (`portalStatus`, `portalZone`,
 * `portalDisplaySpec`, `portalQty`, `portalTone`) that the seed +
 * future staff-side editor write so the editorial portal renders the
 * material schedule the way the wireframe shows it.
 *
 * Groups by category and bucket counts by portalStatus.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { DesignProject } from '@/modules/design-manager/types';
import type { ImgTone } from '../components/primitives';
import {
  getPortalProjectByCode,
} from '@/modules/customer-hub/services/client-portal/clientPortalAccess';
import { assertProjectAccess } from '@/modules/customer-hub/services/client-portal/portalAccessGate';

export type PortalMaterialStatus = 'open' | 'sealed' | 'ordered' | 'on_site' | 'installed';

/** Friendly category buckets shown in the portal (one tab each). */
export type PortalMaterialCategory =
  | 'Stone'
  | 'Timber'
  | 'Fabric'
  | 'Lighting'
  | 'Hardware'
  | 'Finishing'
  | 'Other';

export interface PortalMaterialItem {
  id: string;
  code: string;
  name: string;
  /** Friendly bucket label for the tab strip. */
  portalCategory: PortalMaterialCategory;
  /** Canonical staff-side category (kept for filtering / future use). */
  rawCategory: string;
  spec: string;
  qty: string;
  zone: string;
  status: PortalMaterialStatus;
  /** Image tone for the warm-paper placeholder header. */
  tone: ImgTone;
}

export interface PortalMaterialsCounts {
  total: number;
  sealed: number;
  ordered: number;
  onSite: number;
  open: number;
}

export interface PortalMaterialsData {
  project: DesignProject;
  items: PortalMaterialItem[];
  counts: PortalMaterialsCounts;
  /** Items keyed by friendly category — used for tab filtering. */
  byCategory: Record<PortalMaterialCategory, PortalMaterialItem[]>;
}

interface State {
  data: PortalMaterialsData | null;
  loading: boolean;
  error: Error | null;
}

export function useFinishesPortalMaterials(code: string | undefined): State {
  const { user } = useAuth();
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!code) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ data: null, loading: true, error: null });

    (async () => {
      try {
        const project = await getPortalProjectByCode(code);
        if (!project) throw new Error(`Project ${code} not found`);

        assertProjectAccess(user, project);

        const snap = await getDocs(collection(db, 'designProjects', project.id, 'materials'));
        const items = snap.docs.map((d) => mapMaterial(d.id, d.data()));
        // Sort: open first (signal), then ordered, on_site, installed, sealed.
        items.sort(sortMaterials);

        const counts: PortalMaterialsCounts = {
          total: items.length,
          sealed: items.filter((i) => i.status === 'sealed').length,
          ordered: items.filter((i) => i.status === 'ordered').length,
          onSite: items.filter((i) => i.status === 'on_site' || i.status === 'installed').length,
          open: items.filter((i) => i.status === 'open').length,
        };

        const byCategory: Record<PortalMaterialCategory, PortalMaterialItem[]> = {
          Stone: [], Timber: [], Fabric: [], Lighting: [], Hardware: [], Finishing: [], Other: [],
        };
        for (const i of items) byCategory[i.portalCategory].push(i);

        if (cancelled) return;
        setState({
          data: { project, items, counts, byCategory },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err as Error });
      }
    })();

    return () => { cancelled = true; };
  }, [code, user?.uid]);

  return state;
}

function mapMaterial(id: string, raw: any): PortalMaterialItem {
  const portalCategory = mapCategory(raw.category, raw.subcategory);
  return {
    id,
    code: raw.code ?? id,
    name: raw.name ?? '—',
    portalCategory,
    rawCategory: raw.category ?? 'other',
    spec: raw.portalDisplaySpec ?? raw.description ?? '',
    qty: raw.portalQty ?? '—',
    zone: raw.portalZone ?? '—',
    status: (raw.portalStatus as PortalMaterialStatus) ?? 'sealed',
    tone: (raw.portalTone as ImgTone) ?? 'interior',
  };
}

function mapCategory(category: string, subcategory?: string): PortalMaterialCategory {
  if (!category) return 'Other';
  if (category === 'stone-composite') return 'Stone';
  if (category === 'solid-wood' || category === 'sheet-goods' || category === 'edge-banding') return 'Timber';
  if (category === 'fabric-upholstery') return 'Fabric';
  if (category === 'finishing') return 'Finishing';
  if (category === 'hardware') {
    if (subcategory === 'Lighting') return 'Lighting';
    return 'Hardware';
  }
  return 'Other';
}

function sortMaterials(a: PortalMaterialItem, b: PortalMaterialItem): number {
  const statusOrder: Record<PortalMaterialStatus, number> = {
    open: 0, ordered: 1, on_site: 2, installed: 3, sealed: 4,
  };
  if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
  return a.code.localeCompare(b.code);
}
