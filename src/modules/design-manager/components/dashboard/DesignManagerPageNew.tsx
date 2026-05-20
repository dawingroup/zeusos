/**
 * DesignManagerPage Component (New Figma Design)
 * Main page for the Design Manager module with view modes
 * Connected to real Firestore data and existing components
 * Projects partitioned into: Active Design, In Manufacturing/Fulfillment, Completed
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Package,
  Plus,
  FolderOpen,
  Clock,
  CheckCircle,
  Search,
  ChevronRight,
  Factory,
  Truck,
  FileText,
  Ban,
  X,
  History,
  Filter,
  Loader2,
  Library,
  Pin,
  Info,
  BellOff,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/core/components/ui/tooltip';
import { db } from '@/shared/services/firebase';
import { Button } from '@/shared/components/ui';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/core/components/ui/table';
import { Input } from '@/core/components/ui/input';
import { Label } from '@/core/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { cn } from '@/shared/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { subscribeToProjects, subscribeToDesignItems } from '../../services/firestore';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { deriveHandoverStatus, deriveFulfillmentStatus } from '../../services/designItemStatusDerivation';
import type { DesignProject, DesignItem } from '../../types';
import { ProjectDialog } from '../project/ProjectDialog';
import { isAtFinalStageForItem } from '../../utils/stage-gate';
import { computeProjectPriorities, type PriorityScore } from '../../services/priorityService';
import type { CRMDealStage } from '@/modules/crm/types';
import { fetchCrmDealStagesByLinkedProjectIds } from '@/modules/crm/services/crmDealLookup';
import {
  loadCommercialSnapshot,
  projectHasSalesOrder,
  resolveHasSalesOrderSet,
  QUOTE_SIGNAL_BADGE_CLASS,
  QUOTE_SIGNAL_LABEL,
  type QuoteCommercialSignal,
} from '../../services/projectCommercialSignals';
import { readDesignManagerRecents } from '../../services/designManagerRecents';
import {
  readPinnedProjectIds,
  writePinnedProjectIds,
  mergePinToggle,
} from '../../services/designManagerPins';
import { getPinAutoReleaseReason } from '../../services/projectPinMilestones';
import {
  fetchPinnedProjectIdsFromUserDoc,
  persistPinnedProjectIdsToUserDoc,
} from '../../services/designManagerPinsFirestore';
import {
  buildSnoozeUntilMap,
  snoozeProjectForDays,
  clearProjectSnooze,
  countActiveSnoozes,
} from '../../services/designManagerSnooze';

// Fulfillment statuses that indicate items are in the post-production pipeline
const FULFILLMENT_ACTIVE_STATUSES = ['received', 'packing', 'ready_for_dispatch', 'dispatched'];
const FULFILLMENT_TERMINAL_STATUSES = ['delivered', 'installed', 'complete'];

type ProjectLifecycleBucket = 'active' | 'prospect' | 'manufacturing' | 'completed' | 'lost';

function classifyProject(
  project: DesignProject,
  projectItems: DesignItem[],
  dealStage?: CRMDealStage | null,
): ProjectLifecycleBucket {
  // Deal marked as lost → archive
  if (dealStage === 'lost') return 'lost';

  // Completed or cancelled projects
  if (project.status === 'completed' || project.status === 'cancelled') return 'completed';

  // All items reached terminal fulfillment → treat as completed even if status wasn't updated.
  // P7/F10: derive status from the FulfillmentTracking timestamps so this
  // classifier doesn't miss items whose flat fulfillmentStatus field
  // drifted behind their timestamps.
  if (
    projectItems.length > 0 &&
    projectItems.every(
      (i) => FULFILLMENT_TERMINAL_STATUSES.includes(deriveFulfillmentStatus(i))
    )
  ) {
    return 'completed';
  }

  // Check if any items have been handed over to manufacturing or are in fulfillment
  // Derive handover state from the MO link — the stored handoverStatus
  // field is a lagging denormalization. See P7/F10.
  const hasManufacturingItems = projectItems.some(
    (i) => deriveHandoverStatus(i) === 'handed-over'
  );
  const hasFulfillmentItems = projectItems.some(
    (i) => FULFILLMENT_ACTIVE_STATUSES.includes(deriveFulfillmentStatus(i))
  );

  if (hasManufacturingItems || hasFulfillmentItems) return 'manufacturing';

  // Active = won deal OR has a linked Sales Order
  if (dealStage === 'won' || project.linkedSalesOrderId) return 'active';

  // Everything else is a prospect (early-stage or no deal linked)
  return 'prospect';
}

/** Deal stage priority boost: won deals rank highest, late-stage deals rank higher */
const DEAL_STAGE_BOOST: Partial<Record<CRMDealStage, number>> = {
  won: 100,
  negotiation: 30,
  quotation: 20,
  design_proposal: 10,
  site_visit: 5,
};

const CRM_STAGES_FOR_FILTER: CRMDealStage[] = [
  'lead',
  'qualification',
  'site_visit',
  'design_proposal',
  'quotation',
  'negotiation',
  'won',
  'on_hold',
  'lost',
];

function formatCrmStageLabel(stage: CRMDealStage): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const QUOTE_FILTER_OPTIONS: { value: QuoteCommercialSignal; label: string }[] = [
  { value: 'none', label: 'No quote' },
  { value: 'draft', label: 'Draft' },
  { value: 'with_client', label: 'With client (sent / pending)' },
  { value: 'partial_lines', label: 'Part-approved lines' },
  { value: 'full_approval', label: 'Quote approved' },
  { value: 'declined', label: 'Declined / expired' },
];

type DealListFilter = 'any' | 'none' | CRMDealStage;
type SoListFilter = 'any' | 'yes' | 'no';
type QuoteListFilter = 'any' | QuoteCommercialSignal;

const SECTION_HINT_ACTIVE =
  'Classifier: CRM deal stage is Won, or the project has linkedSalesOrderId. Skipped if the deal is Lost, the project is completed/cancelled, every item is in terminal fulfillment, or any item is in manufacturing/active fulfillment.';

const SECTION_HINT_PROSPECT =
  'Classifier: everything that is not Lost, Completed, or Manufacturing — typically pre-won without linkedSalesOrderId on the project. A sales order document may still exist for the project (see SO column).';

const SECTION_HINT_MANUFACTURING =
  'Classifier: at least one design item is handed over to manufacturing (MO), or an item is in an active fulfillment status (received through dispatched).';

const SECTION_HINT_COMPLETED =
  'Classifier: project status is completed or cancelled, or all design items are in terminal fulfillment (delivered, installed, complete).';

const SECTION_HINT_LOST = 'Classifier: linked CRM deal stage is Lost.';

function projectMatchesListFilters(
  p: DesignProject,
  search: string,
  dealF: DealListFilter,
  soF: SoListFilter,
  quoteF: QuoteListFilter,
  dealStageMap: Map<string, CRMDealStage>,
  quoteByProject: Map<string, QuoteCommercialSignal>,
  hasSo: Set<string>,
  commercialReady: boolean,
): boolean {
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    const match =
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.customerName || '').toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      (p.dealId && p.dealId.toLowerCase().includes(q));
    if (!match) return false;
  }
  if (dealF !== 'any') {
    if (dealF === 'none') {
      if (p.dealId?.trim()) return false;
      // CRM deal may only reference this project via `linkedProjectId` (no `dealId` on project).
      if (dealStageMap.has(p.id)) return false;
    } else {
      if (dealStageMap.get(p.id) !== dealF) return false;
    }
  }
  if (soF !== 'any') {
    const has = projectHasSalesOrder(p, hasSo);
    if (soF === 'yes') {
      if (commercialReady) {
        if (!has) return false;
      } else {
        if (!p.linkedSalesOrderId) return false;
      }
    } else {
      if (commercialReady) {
        if (has) return false;
      } else {
        if (p.linkedSalesOrderId) return false;
      }
    }
  }
  if (quoteF !== 'any') {
    if (!commercialReady) return true;
    const sig = quoteByProject.get(p.id) ?? 'none';
    if (sig !== quoteF) return false;
  }
  return true;
}

export default function DesignManagerPageNew() {
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<DesignProject | null>(null);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleNewProject = () => {
    setEditingProject(null);
    setShowProjectDialog(true);
  };

  const handleCloseDialog = () => {
    setShowProjectDialog(false);
    setEditingProject(null);
  };

  // Real Firestore data
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [allDesignItems, setAllDesignItems] = useState<DesignItem[]>([]);
  const [_loading, setLoading] = useState(true);

  const [listSearch, setListSearch] = useState('');
  const [filterDeal, setFilterDeal] = useState<DealListFilter>('any');
  const [filterSo, setFilterSo] = useState<SoListFilter>('any');
  const [filterQuote, setFilterQuote] = useState<QuoteListFilter>('any');
  const [quoteSignalByProject, setQuoteSignalByProject] = useState<Map<string, QuoteCommercialSignal>>(new Map());
  const [hasSalesOrderResolved, setHasSalesOrderResolved] = useState<Set<string>>(new Set());
  const [commercialReady, setCommercialReady] = useState(false);
  const [recents, setRecents] = useState(() => readDesignManagerRecents());
  const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>(() => readPinnedProjectIds());
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const [pinCloudHydrated, setPinCloudHydrated] = useState(false);
  const [snoozeUntilByProject, setSnoozeUntilByProject] = useState<Map<string, number>>(() => buildSnoozeUntilMap());
  const [showSnoozed, setShowSnoozed] = useState(false);

  const orgId = (user as { organizationId?: string } | null)?.organizationId ?? 'default';

  const refreshSnoozeMap = useCallback(() => {
    setSnoozeUntilByProject(buildSnoozeUntilMap());
  }, []);

  const activeSnoozeCount = useMemo(
    () => countActiveSnoozes(snoozeUntilByProject),
    [snoozeUntilByProject],
  );

  // CRM deal stage per project (must be declared before effects that read it)
  const [dealStageMap, setDealStageMap] = useState<Map<string, CRMDealStage>>(new Map());

  // Project-level priority: highest score among items in each project
  const [projectPriorityMap, setProjectPriorityMap] = useState<Map<string, PriorityScore>>(new Map());
  const priorityTimer = useRef<ReturnType<typeof setTimeout>>();
  const commercialTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    writePinnedProjectIds(pinnedProjectIds);
  }, [pinnedProjectIds]);

  const toggleProjectPin = useCallback((projectId: string) => {
    setPinnedProjectIds((prev) => mergePinToggle(prev, projectId));
    setPinNotice(null);
  }, []);

  const handleSnoozeProject = useCallback((projectId: string, days: number) => {
    snoozeProjectForDays(projectId, days);
    refreshSnoozeMap();
  }, [refreshSnoozeMap]);

  const handleClearProjectSnooze = useCallback((projectId: string) => {
    clearProjectSnooze(projectId);
    refreshSnoozeMap();
  }, [refreshSnoozeMap]);

  useEffect(() => {
    if (!pinNotice) return;
    const t = setTimeout(() => {
      setPinNotice(null);
    }, 12000);
    return () => {
      clearTimeout(t);
    };
  }, [pinNotice]);

  useEffect(() => {
    if (priorityTimer.current) clearTimeout(priorityTimer.current);
    if (projects.length === 0 || allDesignItems.length === 0) return;

    priorityTimer.current = setTimeout(async () => {
      const map = new Map<string, PriorityScore>();
      const results = await Promise.all(
        projects.map((p) =>
          computeProjectPriorities(p.id)
            .then((scores) => ({ projectId: p.id, scores }))
            .catch(() => ({ projectId: p.id, scores: new Map<string, PriorityScore>() })),
        ),
      );
      for (const { projectId, scores } of results) {
        let best: PriorityScore | null = null;
        for (const [, ps] of scores) {
          if (!best || ps.score > best.score) best = ps;
        }
        if (best) map.set(projectId, best);
      }
      setProjectPriorityMap(map);
    }, 600);

    return () => { if (priorityTimer.current) clearTimeout(priorityTimer.current); };
  }, [projects, allDesignItems]);

  // Subscribe to projects
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToProjects((projectsData) => {
      setProjects(projectsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated]);

  // Subscribe to design items from all projects
  useEffect(() => {
    if (projects.length === 0) {
      setAllDesignItems([]);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    const itemsByProject: Record<string, DesignItem[]> = {};

    projects.forEach((project) => {
      const unsub = subscribeToDesignItems(project.id, (items) => {
        itemsByProject[project.id] = items;
        const allItems = Object.values(itemsByProject).flat();
        setAllDesignItems(allItems);
      });
      unsubscribes.push(unsub);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [projects]);

  // Fetch deal stages: `designProjects.dealId` and reverse link `crmDeals.linkedProjectId`.
  useEffect(() => {
    if (projects.length === 0) {
      setDealStageMap(new Map());
      return;
    }

    let cancelled = false;

    void (async () => {
      const map = new Map<string, CRMDealStage>();

      const withDealId = projects.filter((p) => typeof p.dealId === 'string' && p.dealId.trim().length > 0);
      const withoutDealId = projects.filter((p) => !p.dealId?.trim());

      await Promise.all(
        withDealId.map(async (p) => {
          try {
            const snap = await getDoc(doc(db, 'crmDeals', p.dealId!));
            if (snap.exists()) {
              map.set(p.id, snap.data().stage as CRMDealStage);
            }
          } catch {
            /* ignore */
          }
        }),
      );

      if (withoutDealId.length > 0) {
        const reverse = await fetchCrmDealStagesByLinkedProjectIds(withoutDealId.map((p) => p.id));
        for (const [projectId, stage] of reverse) {
          if (!map.has(projectId)) map.set(projectId, stage);
        }
      }

      if (!cancelled) setDealStageMap(map);
    })();

    return () => {
      cancelled = true;
    };
  }, [projects]);

  /** Hydrate pins from org user doc (cross-device); localStorage remains offline cache. */
  useEffect(() => {
    if (!user?.uid) {
      setPinCloudHydrated(true);
      return;
    }
    setPinCloudHydrated(false);
    let cancelled = false;
    void (async () => {
      const ids = await fetchPinnedProjectIdsFromUserDoc(orgId, user.uid);
      if (cancelled) return;
      if (ids !== null) {
        setPinnedProjectIds(ids);
        writePinnedProjectIds(ids);
      }
      setPinCloudHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, orgId]);

  useEffect(() => {
    if (!user?.uid || !pinCloudHydrated) return;
    const t = setTimeout(() => {
      void (async () => {
        try {
          await persistPinnedProjectIdsToUserDoc(orgId, user.uid, pinnedProjectIds);
        } catch {
          /* rules / offline — local pins still work */
        }
      })();
    }, 500);
    return () => {
      clearTimeout(t);
    };
  }, [pinnedProjectIds, user?.uid, orgId, pinCloudHydrated]);

  /** Milestone-based auto-unpin (quote approval, SO, won deal, manufacturing handover). */
  useEffect(() => {
    if (pinnedProjectIds.length === 0) return;

    const nextIds: string[] = [];
    const releasedLabels: string[] = [];

    for (const id of pinnedProjectIds) {
      const p = projects.find((x) => x.id === id);
      const items = allDesignItems.filter((i) => i.projectId === id);
      const deal = dealStageMap.get(id);
      const qs = quoteSignalByProject.get(id) ?? 'none';
      const reason = getPinAutoReleaseReason(
        p,
        items,
        deal,
        qs,
        hasSalesOrderResolved,
        commercialReady,
      );
      if (reason) {
        const label = p ? `${p.code}` : id.slice(0, 8);
        releasedLabels.push(`${label}: ${reason}`);
      } else {
        nextIds.push(id);
      }
    }

    if (releasedLabels.length === 0) return;

    setPinnedProjectIds(nextIds);
    setPinNotice(`Unpinned: ${releasedLabels.join(' · ')}`);
  }, [
    pinnedProjectIds,
    projects,
    allDesignItems,
    dealStageMap,
    quoteSignalByProject,
    hasSalesOrderResolved,
    commercialReady,
  ]);

  const filteredProjects = useMemo(() => {
    const now = Date.now();
    return projects.filter((p) => {
      if (!showSnoozed) {
        const until = snoozeUntilByProject.get(p.id);
        if (until !== undefined && until > now) return false;
      }
      return projectMatchesListFilters(
        p,
        listSearch,
        filterDeal,
        filterSo,
        filterQuote,
        dealStageMap,
        quoteSignalByProject,
        hasSalesOrderResolved,
        commercialReady,
      );
    });
  }, [
    projects,
    showSnoozed,
    snoozeUntilByProject,
    listSearch,
    filterDeal,
    filterSo,
    filterQuote,
    dealStageMap,
    quoteSignalByProject,
    hasSalesOrderResolved,
    commercialReady,
  ]);

  useEffect(() => {
    if (commercialTimer.current) clearTimeout(commercialTimer.current);
    if (!isAuthenticated) return;
    if (projects.length === 0) {
      setQuoteSignalByProject(new Map());
      setHasSalesOrderResolved(new Set());
      setCommercialReady(true);
      return;
    }
    setCommercialReady(false);
    commercialTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const snap = await loadCommercialSnapshot(projects);
          setQuoteSignalByProject(snap.quoteSignalByProject);
          setHasSalesOrderResolved(resolveHasSalesOrderSet(projects, snap.salesOrderFromDocuments));
          setCommercialReady(true);
        } catch {
          const noneSignals = new Map<string, QuoteCommercialSignal>();
          for (const p of projects) {
            noneSignals.set(p.id, 'none');
          }
          setQuoteSignalByProject(noneSignals);
          const fallback = new Set<string>();
          for (const p of projects) {
            if (p.linkedSalesOrderId) fallback.add(p.id);
          }
          setHasSalesOrderResolved(fallback);
          setCommercialReady(true);
        }
      })();
    }, 450);
    return () => {
      if (commercialTimer.current) clearTimeout(commercialTimer.current);
    };
  }, [isAuthenticated, projects]);

  useEffect(() => {
    const onFocus = () => {
      setRecents(readDesignManagerRecents());
    };
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Partition projects into sections (deal-aware with prospect tier)
  const { activeProjects, prospectProjects, manufacturingProjects, completedProjects, lostProjects } = useMemo(() => {
    const active: DesignProject[] = [];
    const prospect: DesignProject[] = [];
    const manufacturing: DesignProject[] = [];
    const completed: DesignProject[] = [];
    const lost: DesignProject[] = [];

    for (const project of filteredProjects) {
      const projectItems = allDesignItems.filter((i) => i.projectId === project.id);
      const dealStage = dealStageMap.get(project.id) ?? null;
      const section = classifyProject(project, projectItems, dealStage);
      if (section === 'active') active.push(project);
      else if (section === 'prospect') prospect.push(project);
      else if (section === 'manufacturing') manufacturing.push(project);
      else if (section === 'lost') lost.push(project);
      else completed.push(project);
    }

    return { activeProjects: active, prospectProjects: prospect, manufacturingProjects: manufacturing, completedProjects: completed, lostProjects: lost };
  }, [filteredProjects, allDesignItems, dealStageMap]);

  /** Full-workspace pipeline counts (not affected by list filters) — for filter panel context */
  const pipelineCounts = useMemo(() => {
    let active = 0;
    let prospect = 0;
    let manufacturing = 0;
    let completed = 0;
    let lost = 0;
    for (const project of projects) {
      const projectItems = allDesignItems.filter((i) => i.projectId === project.id);
      const dealStage = dealStageMap.get(project.id) ?? null;
      const section = classifyProject(project, projectItems, dealStage);
      if (section === 'active') active += 1;
      else if (section === 'prospect') prospect += 1;
      else if (section === 'manufacturing') manufacturing += 1;
      else if (section === 'lost') lost += 1;
      else completed += 1;
    }
    return { active, prospect, manufacturing, completed, lost, total: projects.length };
  }, [projects, allDesignItems, dealStageMap]);

  // Get stats for dashboard
  const stats = useMemo(() => {
    const total = allDesignItems.length;
    const inProgress = allDesignItems.filter(i => !isAtFinalStageForItem(i)).length;
    const productionReady = allDesignItems.filter(i => isAtFinalStageForItem(i)).length;
    const needsAttention = allDesignItems.filter(i =>
      i.overallReadiness < 50 || i.priority === 'urgent'
    ).length;
    return { total, inProgress, productionReady, needsAttention };
  }, [allDesignItems]);

  const pinnedProjectsInOrder = useMemo(
    () =>
      pinnedProjectIds
        .map((id) => projects.find((p) => p.id === id))
        .filter((p): p is DesignProject => Boolean(p)),
    [pinnedProjectIds, projects],
  );

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <FolderOpen className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
        <p className="text-muted-foreground">Please sign in to access the Design Manager.</p>
      </div>
    );
  }

  // Sort projects by priority score + deal stage boost
  const sortByPriority = (list: DesignProject[]) =>
    [...list].sort((a, b) => {
      const aBase = projectPriorityMap.get(a.id)?.score ?? 0;
      const bBase = projectPriorityMap.get(b.id)?.score ?? 0;
      const aDealStage = dealStageMap.get(a.id);
      const bDealStage = dealStageMap.get(b.id);
      const aBoost = aDealStage ? (DEAL_STAGE_BOOST[aDealStage] ?? 0) : 0;
      const bBoost = bDealStage ? (DEAL_STAGE_BOOST[bDealStage] ?? 0) : 0;
      return (bBase + bBoost) - (aBase + aBoost);
    });

  const hasActiveListFilters =
    Boolean(listSearch.trim()) || filterDeal !== 'any' || filterSo !== 'any' || filterQuote !== 'any';

  const clearListFilters = () => {
    setListSearch('');
    setFilterDeal('any');
    setFilterSo('any');
    setFilterQuote('any');
  };

  const activeFilterCount =
    (listSearch.trim() ? 1 : 0) +
    (filterDeal !== 'any' ? 1 : 0) +
    (filterSo !== 'any' ? 1 : 0) +
    (filterQuote !== 'any' ? 1 : 0);

  return (
    <div className="space-y-6">
      {(pinnedProjectsInOrder.length > 0 || pinNotice) && (
        <div className="space-y-2">
          {pinnedProjectsInOrder.length > 0 && (
            <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-white to-slate-50/80 px-4 py-3 shadow-sm">
              <div className="mb-2 flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Pin className="h-4 w-4" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900">Working on</h2>
                  <p className="text-[11px] leading-snug text-gray-600">
                    Stays pinned until a milestone is reached: approved quote line(s), sales order linked, CRM deal won, or released to manufacturing.
                    {user?.uid
                      ? ' Pins sync to your org user profile when signed in (cached locally too).'
                      : ' Sign in to sync pins across devices.'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {pinnedProjectsInOrder.map((p) => (
                  <div
                    key={p.id}
                    className="group flex max-w-[260px] items-center gap-1 rounded-lg border border-gray-200/80 bg-white/90 py-1 pl-2 pr-1 shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        navigate(`project/${p.id}`);
                      }}
                      className="min-w-0 flex-1 truncate text-left text-xs font-medium text-gray-900 hover:text-primary"
                      title={p.name}
                    >
                      <span className="text-primary/90">{p.code}</span>
                      <span className="mx-1 text-gray-300">·</span>
                      <span className="font-normal text-gray-700">{p.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleProjectPin(p.id);
                      }}
                      className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      title="Unpin"
                      aria-label={`Unpin ${p.code}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {pinNotice && (
            <div
              role="status"
              className="flex items-start justify-between gap-3 rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-950"
            >
              <span className="leading-snug">{pinNotice}</span>
              <button
                type="button"
                onClick={() => {
                  setPinNotice(null);
                }}
                className="shrink-0 rounded p-0.5 text-emerald-800 hover:bg-emerald-100"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Find & filter — primary control surface */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50/90 to-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Filter className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900">Find projects</h2>
                  {hasActiveListFilters && (
                    <Badge variant="secondary" className="font-normal text-xs">
                      {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Search and narrow what appears in each section below. Pipeline totals are for your full workspace.
                </p>
              </div>
            </div>
            {pipelineCounts.total > 0 && (
              <div
                className="flex flex-wrap gap-1.5 sm:justify-end"
                title="Project counts by pipeline bucket (all projects, ignoring filters)"
              >
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900">
                  Active {pipelineCounts.active}
                </span>
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                  Prospects {pipelineCounts.prospect}
                </span>
                <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-900">
                  Mfg {pipelineCounts.manufacturing}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  Done {pipelineCounts.completed}
                </span>
                {pipelineCounts.lost > 0 && (
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-900">
                    Lost {pipelineCounts.lost}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasActiveListFilters && (
              <Button type="button" variant="outline" size="sm" className="h-9" onClick={clearListFilters}>
                <X className="h-3.5 w-3.5 mr-1" />
                Clear all
              </Button>
            )}
            <Button onClick={handleNewProject} className="bg-primary hover:bg-primary/90 h-9 shrink-0">
              <Plus className="h-4 w-4 mr-1.5" />
              New project
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-12 xl:items-end">
            <div className="xl:col-span-4 space-y-1.5">
              <Label htmlFor="dm-proj-search" className="text-xs text-gray-600">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                <Input
                  id="dm-proj-search"
                  className="h-10 pl-9"
                  value={listSearch}
                  onChange={(e) => {
                    setListSearch(e.target.value);
                  }}
                  placeholder="Name, code, customer, project or deal id…"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="xl:col-span-2 space-y-1.5">
              <Label className="text-xs text-gray-600">CRM stage</Label>
              <Select
                value={filterDeal}
                onValueChange={(v) => {
                  setFilterDeal(v as DealListFilter);
                }}
              >
                <SelectTrigger id="dm-filter-deal" className="h-10 w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any stage</SelectItem>
                  <SelectItem value="none">No deal linked</SelectItem>
                  {CRM_STAGES_FOR_FILTER.map((s) => (
                    <SelectItem key={s} value={s}>
                      {formatCrmStageLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="xl:col-span-2 space-y-1.5">
              <Label className="text-xs text-gray-600">Sales order</Label>
              <Select
                value={filterSo}
                onValueChange={(v) => {
                  setFilterSo(v as SoListFilter);
                }}
              >
                <SelectTrigger
                  className="h-10 w-full"
                  title={!commercialReady ? 'Sales order links still loading — results refine when ready' : undefined}
                >
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="yes">Has sales order</SelectItem>
                  <SelectItem value="no">No sales order</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="xl:col-span-4 space-y-1.5">
              <Label className="text-xs text-gray-600">Client quote</Label>
              <Select
                value={filterQuote}
                onValueChange={(v) => {
                  setFilterQuote(v as QuoteListFilter);
                }}
              >
                <SelectTrigger
                  className="h-10 w-full"
                  title={!commercialReady ? 'Quote status still loading — results refine when ready' : undefined}
                >
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent className="max-h-[min(24rem,70vh)]">
                  <SelectItem value="any">Any quote state</SelectItem>
                  {QUOTE_FILTER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!commercialReady && projects.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              <span>Loading client quotes and sales-order links for filters and columns…</span>
            </div>
          )}

          {activeSnoozeCount > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={showSnoozed}
                onChange={(e) => {
                  setShowSnoozed(e.target.checked);
                }}
              />
              <span>
                Show {activeSnoozeCount} snoozed project{activeSnoozeCount !== 1 ? 's' : ''} (hidden from lists by default)
              </span>
            </label>
          )}

          {recents.filter((r) => projects.some((p) => p.id === r.id)).length > 0 && (
            <div className="rounded-lg border border-gray-100 bg-slate-50/50 px-3 py-2">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-600">
                <History className="h-3.5 w-3.5" aria-hidden />
                Recently opened
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {recents
                  .filter((r) => projects.some((p) => p.id === r.id))
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        navigate(`project/${r.id}`);
                      }}
                      className="shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-left text-xs text-gray-800 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5 max-w-[220px]"
                      title={r.name}
                    >
                      <span className="font-medium text-gray-900">{r.code}</span>
                      <span className="block truncate text-gray-600">{r.name}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {projects.length > 0 && filteredProjects.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
          <span>No projects match the current filters and search.</span>
          <Button type="button" variant="outline" size="sm" onClick={clearListFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {/* Design item workload (project pipeline counts live in the filter panel above) */}
      <KPIGrid cols={4}>
        <KPICard label="Design items" value={stats.total} delta="Across all projects" />
        <KPICard label="In progress" value={stats.inProgress} delta="Not at final stage" />
        <KPICard
          label="Production ready"
          value={stats.productionReady}
          delta="Ready to manufacture"
          trend="up"
        />
        <KPICard
          label="Needs attention"
          value={stats.needsAttention}
          delta="Low readiness or urgent"
          trend={stats.needsAttention > 0 ? 'down' : undefined}
        />
      </KPIGrid>
      {hasActiveListFilters && projects.length > 0 && (
        <p className="text-xs text-gray-500">
          Showing {filteredProjects.length} of {projects.length} projects — filters apply to every section below.
        </p>
      )}

      {/* Reference data — real routes only (removed placeholder Quick Actions that pointed at non-existent paths) */}
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-gray-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-600">
          <span className="font-medium text-gray-800">Libraries</span>
          {' — shared catalogs for estimating and specs (not project lists).'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              navigate('materials');
            }}
          >
            <Package className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Materials
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              navigate('features');
            }}
          >
            <Library className="h-3.5 w-3.5 mr-1.5" aria-hidden />
            Feature library
          </Button>
        </div>
      </div>

      {/* Active Projects — won deal or linked SO */}
      {activeProjects.length > 0 && (
        <ProjectSection
          title="Active Projects"
          sectionHint={SECTION_HINT_ACTIVE}
          subtitle="Won deal and/or linked Sales Order on the project (see Quote / SO columns for client-quote state)"
          icon={<FolderOpen className="h-5 w-5 text-primary" />}
          count={activeProjects.length}
          projects={sortByPriority(activeProjects)}
          allDesignItems={allDesignItems}
          projectPriorityMap={projectPriorityMap}
          dealStageMap={dealStageMap}
          quoteSignalByProject={quoteSignalByProject}
          hasSalesOrderSet={hasSalesOrderResolved}
          commercialReady={commercialReady}
          navigate={navigate}
          pinnedProjectIds={pinnedProjectIds}
          onToggleProjectPin={toggleProjectPin}
          snoozeUntilByProject={snoozeUntilByProject}
          onSnoozeProject={handleSnoozeProject}
          onClearProjectSnooze={handleClearProjectSnooze}
        />
      )}

      {prospectProjects.length > 0 && (
        <ProjectSection
          title="Prospects"
          sectionHint={SECTION_HINT_PROSPECT}
          subtitle="Not in manufacturing or completed. Includes work still awaiting won deal / SO—use Client quote filters to find approval state"
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          count={prospectProjects.length}
          projects={sortByPriority(prospectProjects)}
          allDesignItems={allDesignItems}
          projectPriorityMap={projectPriorityMap}
          dealStageMap={dealStageMap}
          quoteSignalByProject={quoteSignalByProject}
          hasSalesOrderSet={hasSalesOrderResolved}
          commercialReady={commercialReady}
          navigate={navigate}
          pinnedProjectIds={pinnedProjectIds}
          onToggleProjectPin={toggleProjectPin}
          snoozeUntilByProject={snoozeUntilByProject}
          onSnoozeProject={handleSnoozeProject}
          onClearProjectSnooze={handleClearProjectSnooze}
        />
      )}

      {manufacturingProjects.length > 0 && (
        <ProjectSection
          title="In Manufacturing & Fulfillment"
          sectionHint={SECTION_HINT_MANUFACTURING}
          subtitle="At least one item handed over to manufacturing, or in fulfillment pipeline"
          icon={<Factory className="h-5 w-5 text-orange-500" />}
          count={manufacturingProjects.length}
          projects={sortByPriority(manufacturingProjects)}
          allDesignItems={allDesignItems}
          projectPriorityMap={projectPriorityMap}
          dealStageMap={dealStageMap}
          quoteSignalByProject={quoteSignalByProject}
          hasSalesOrderSet={hasSalesOrderResolved}
          commercialReady={commercialReady}
          navigate={navigate}
          pinnedProjectIds={pinnedProjectIds}
          onToggleProjectPin={toggleProjectPin}
          snoozeUntilByProject={snoozeUntilByProject}
          onSnoozeProject={handleSnoozeProject}
          onClearProjectSnooze={handleClearProjectSnooze}
        />
      )}

      {completedProjects.length > 0 && (
        <ProjectSection
          title="Completed"
          sectionHint={SECTION_HINT_COMPLETED}
          subtitle="Project completed or cancelled, or all items in terminal fulfillment"
          icon={<CheckCircle className="h-5 w-5 text-green-500" />}
          count={completedProjects.length}
          projects={completedProjects}
          allDesignItems={allDesignItems}
          projectPriorityMap={projectPriorityMap}
          dealStageMap={dealStageMap}
          quoteSignalByProject={quoteSignalByProject}
          hasSalesOrderSet={hasSalesOrderResolved}
          commercialReady={commercialReady}
          navigate={navigate}
          pinnedProjectIds={pinnedProjectIds}
          onToggleProjectPin={toggleProjectPin}
          snoozeUntilByProject={snoozeUntilByProject}
          onSnoozeProject={handleSnoozeProject}
          onClearProjectSnooze={handleClearProjectSnooze}
          defaultCollapsed
        />
      )}

      {lostProjects.length > 0 && (
        <ProjectSection
          title="Lost Deals"
          sectionHint={SECTION_HINT_LOST}
          subtitle="Linked CRM deal is in Lost stage"
          icon={<Ban className="h-5 w-5 text-gray-400" />}
          count={lostProjects.length}
          projects={lostProjects}
          allDesignItems={allDesignItems}
          projectPriorityMap={projectPriorityMap}
          dealStageMap={dealStageMap}
          quoteSignalByProject={quoteSignalByProject}
          hasSalesOrderSet={hasSalesOrderResolved}
          commercialReady={commercialReady}
          navigate={navigate}
          pinnedProjectIds={pinnedProjectIds}
          onToggleProjectPin={toggleProjectPin}
          snoozeUntilByProject={snoozeUntilByProject}
          onSnoozeProject={handleSnoozeProject}
          onClearProjectSnooze={handleClearProjectSnooze}
          defaultCollapsed
        />
      )}

      {/* Project Dialog (Create/Edit) */}
      <ProjectDialog
        open={showProjectDialog}
        onClose={handleCloseDialog}
        userId={user?.email || ''}
        project={editingProject}
      />
    </div>
  );
}

// ============================================================
// Extracted ProjectSection component for DRY table rendering
// ============================================================

interface ProjectSectionProps {
  title: string;
  subtitle: string;
  /** Explains `classifyProject` rules for this bucket (tooltip). */
  sectionHint: string;
  icon: React.ReactNode;
  count: number;
  projects: DesignProject[];
  allDesignItems: DesignItem[];
  projectPriorityMap: Map<string, PriorityScore>;
  dealStageMap?: Map<string, CRMDealStage>;
  quoteSignalByProject: Map<string, QuoteCommercialSignal>;
  hasSalesOrderSet: Set<string>;
  commercialReady: boolean;
  navigate: ReturnType<typeof useNavigate>;
  pinnedProjectIds: string[];
  onToggleProjectPin: (projectId: string) => void;
  snoozeUntilByProject: Map<string, number>;
  onSnoozeProject: (projectId: string, days: number) => void;
  onClearProjectSnooze: (projectId: string) => void;
  defaultCollapsed?: boolean;
}

const DEAL_STAGE_COLORS: Partial<Record<CRMDealStage, string>> = {
  won: 'bg-green-100 text-green-700',
  negotiation: 'bg-purple-100 text-purple-700',
  quotation: 'bg-blue-100 text-blue-700',
  design_proposal: 'bg-indigo-100 text-indigo-700',
  site_visit: 'bg-cyan-100 text-cyan-700',
  qualification: 'bg-gray-100 text-gray-600',
  lead: 'bg-gray-50 text-gray-500',
  lost: 'bg-red-100 text-red-600',
  on_hold: 'bg-amber-100 text-amber-700',
};

const DEAL_STAGE_LABELS: Partial<Record<CRMDealStage, string>> = {
  won: 'Won',
  negotiation: 'Negotiation',
  quotation: 'Quotation',
  design_proposal: 'Design Proposal',
  site_visit: 'Site Visit',
  qualification: 'Qualification',
  lead: 'Lead',
  lost: 'Lost',
  on_hold: 'On Hold',
};

function ProjectSection({
  title,
  subtitle,
  sectionHint,
  icon,
  count,
  projects,
  allDesignItems,
  projectPriorityMap,
  dealStageMap,
  quoteSignalByProject,
  hasSalesOrderSet,
  commercialReady,
  navigate,
  pinnedProjectIds,
  onToggleProjectPin,
  snoozeUntilByProject,
  onSnoozeProject,
  onClearProjectSnooze,
  defaultCollapsed,
}: ProjectSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);

  return (
    <div>
      <div className="mb-3 flex w-full items-start gap-1 sm:items-center">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="group flex min-w-0 flex-1 items-center justify-between text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            <div className="min-w-0 text-left">
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-gray-500">{count} project{count !== 1 ? 's' : ''}</span>
            <ChevronRight
              className={cn('h-4 w-4 text-gray-400 transition-transform', !collapsed && 'rotate-90')}
              aria-hidden
            />
          </div>
        </button>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="mt-1 shrink-0 rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 sm:mt-0"
                aria-label={`How “${title}” is classified`}
              >
                <Info className="h-4 w-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-sm text-left text-xs font-normal leading-snug">
              {sectionHint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {!collapsed && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-center">Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Client quote</TableHead>
                <TableHead className="text-center">SO</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Links</TableHead>
                <TableHead className="w-[4.5rem] text-center">Snooze</TableHead>
                <TableHead className="w-12 text-center">Pin</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => {
                const projectItems = allDesignItems.filter(i => i.projectId === project.id);
                const avgReadiness = projectItems.length > 0
                  ? Math.round(projectItems.reduce((sum, i) => sum + i.overallReadiness, 0) / projectItems.length)
                  : 0;

                const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
                  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Active' },
                  'on-hold': { bg: 'bg-amber-50', text: 'text-amber-700', label: 'On Hold' },
                  completed: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Completed' },
                  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cancelled' },
                };
                const currentStatus = statusConfig[project.status] || statusConfig.active;

                const daysActive = project.updatedAt?.toDate
                  ? Math.floor((Date.now() - project.updatedAt.toDate().getTime()) / (1000 * 60 * 60 * 24))
                  : 0;

                // Cross-module links
                const moIds = (project as any).linkedManufacturingOrderIds as string[] | undefined;
                const soId = (project as any).linkedSalesOrderId as string | undefined;
                const hasSo = projectHasSalesOrder(project, hasSalesOrderSet);
                const qSig = quoteSignalByProject.get(project.id) ?? 'none';
                const hasFulfillment = projectItems.some(
                  (i) => [...FULFILLMENT_ACTIVE_STATUSES, ...FULFILLMENT_TERMINAL_STATUSES].includes(deriveFulfillmentStatus(i))
                );

                return (
                  <TableRow
                    key={project.id}
                    onClick={() => navigate(`project/${project.id}`)}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {project.customerName || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {(() => {
                        const ps = projectPriorityMap.get(project.id);
                        if (!ps) return <span className="text-xs text-gray-400">—</span>;
                        return (
                          <span
                            className={cn(
                              'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                              ps.urgency === 'critical' ? 'bg-red-100 text-red-700' :
                              ps.urgency === 'high' ? 'bg-orange-100 text-orange-700' :
                              ps.urgency === 'medium' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            )}
                            title={ps.signals.join(' · ')}
                          >
                            P{ps.score}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="secondary"
                          className={cn('text-xs', currentStatus.bg, currentStatus.text)}
                        >
                          {currentStatus.label}
                        </Badge>
                        {(() => {
                          const ds = dealStageMap?.get(project.id);
                          if (!ds) return null;
                          return (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', DEAL_STAGE_COLORS[ds] || 'bg-gray-100 text-gray-500')}>
                              {DEAL_STAGE_LABELS[ds] || ds}
                            </span>
                          );
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {commercialReady ? (
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium',
                            QUOTE_SIGNAL_BADGE_CLASS[qSig] ?? 'bg-gray-100 text-gray-600',
                          )}
                        >
                          {QUOTE_SIGNAL_LABEL[qSig] ?? qSig}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">…</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-gray-700">
                      {hasSo ? (
                        <span className="font-medium text-emerald-700">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {projectItems.length}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={avgReadiness} className="h-1.5 flex-1" />
                        <span className="text-xs font-medium text-gray-600 w-8 text-right">{avgReadiness}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {moIds && moIds.length > 0 && (
                          <button
                            onClick={() => {
                              navigate(`/manufacturing/orders/${moIds[0]}`);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 hover:bg-orange-100"
                            title="Manufacturing Order"
                            type="button"
                          >
                            <Factory className="w-2.5 h-2.5" /> MO
                          </button>
                        )}
                        {hasFulfillment && (
                          <button
                            onClick={() => {
                              navigate(`/fulfillment?project=${project.id}`);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-600 hover:bg-teal-100"
                            title="Fulfillment Pipeline"
                            type="button"
                          >
                            <Truck className="w-2.5 h-2.5" /> Fulfillment
                          </button>
                        )}
                        {soId && (
                          <button
                            onClick={() => {
                              navigate(`/sales-orders/${soId}`);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                            title="Open Sales Order"
                            type="button"
                          >
                            <FileText className="w-2.5 h-2.5" /> SO
                          </button>
                        )}
                        {hasSo && !soId && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/sales-orders/list?q=${encodeURIComponent(project.code)}`);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50/80 text-blue-700 hover:bg-blue-100"
                            title="Open Sales Orders list filtered by project code"
                          >
                            <FileText className="w-2.5 h-2.5" /> SO
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-1 text-center">
                      {(() => {
                        const until = snoozeUntilByProject.get(project.id);
                        const snoozed = until !== undefined && until > Date.now();
                        return (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                className={cn(
                                  'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                                  snoozed
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-transparent text-gray-400 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-700',
                                )}
                                title={snoozed ? 'Snoozed — change or clear' : 'Snooze project'}
                                aria-label={`Snooze options for ${project.code}`}
                              >
                                <BellOff className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem
                                onClick={() => {
                                  onSnoozeProject(project.id, 7);
                                }}
                              >
                                Snooze 7 days
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  onSnoozeProject(project.id, 14);
                                }}
                              >
                                Snooze 14 days
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  onSnoozeProject(project.id, 30);
                                }}
                              >
                                Snooze 30 days
                              </DropdownMenuItem>
                              {snoozed && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    onClearProjectSnooze(project.id);
                                  }}
                                >
                                  Clear snooze
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-center p-1">
                      {(() => {
                        const isPinned = pinnedProjectIds.includes(project.id);
                        return (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleProjectPin(project.id);
                            }}
                            className={cn(
                              'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                              isPinned
                                ? 'border-primary/40 bg-primary/10 text-primary'
                                : 'border-transparent text-gray-400 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-700',
                            )}
                            title={
                              isPinned
                                ? 'Unpin from Working on'
                                : 'Pin to Working on (auto-unpins at quote approval, SO, deal won, or manufacturing release)'
                            }
                            aria-pressed={isPinned}
                            aria-label={isPinned ? `Unpin ${project.code}` : `Pin ${project.code}`}
                          >
                            <Pin
                              className={cn('h-3.5 w-3.5', !isPinned && 'opacity-45')}
                              aria-hidden
                            />
                          </button>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {daysActive === 0 ? 'Today' : `${daysActive}d ago`}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
