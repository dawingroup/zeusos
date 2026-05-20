/**
 * LinkDesignItemModal — P9b
 *
 * Two-step picker the operator opens from the BOQ-side drawer to link a
 * ControlBOQItem to a finishes DesignItem:
 *
 *   Step 1 — pick a DesignProject (subscribes to top-N projects).
 *   Step 2 — pick a DesignItem inside that project.
 *
 * We subscribe to projects (rather than fetching once) so the list stays
 * fresh while the modal is open; items are fetched once per project
 * change because the operator's selection is transient. Search boxes
 * filter client-side — the project/item counts here are small (< 200).
 *
 * On confirm we call `linkBoqToDesignItem` which enforces:
 *   - Both docs exist.
 *   - BOQ row's stored `projectId` matches the advisory projectId the
 *     drawer passed in (tenancy).
 *   - The BOQ row is not already linked to a different DesignItem.
 *
 * Errors surface inline rather than closing the modal so the operator
 * can correct the mistake (most commonly "already linked — unlink
 * first").
 */
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Link2, ArrowLeft } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/core/components/ui/dialog';
import {
  subscribeToProjects,
  getDesignItems,
} from '@/modules/design-manager/services';
import type { DesignItem, DesignProject } from '@/modules/design-manager/types';
import {
  linkBoqToDesignItem,
  BOQDesignItemLinkError,
  type BOQItemRef,
} from '@/modules/design-manager/services/boqDesignItemLinkService';

interface LinkDesignItemModalProps {
  /** Controls visibility — the parent owns the open state. */
  open: boolean;
  onClose: () => void;
  /** The BOQ line we're linking from. */
  boqRef: BOQItemRef;
  /** User writing the link — recorded on both sides' audit fields. */
  userId: string;
  /** Fired after a successful link commit; parent should refresh. */
  onLinked: (designItem: DesignItem) => void;
}

type Step = 'pick-project' | 'pick-item';

export function LinkDesignItemModal({
  open,
  onClose,
  boqRef,
  userId,
  onLinked,
}: LinkDesignItemModalProps) {
  const [step, setStep] = useState<Step>('pick-project');
  const [projects, setProjects] = useState<DesignProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<DesignProject | null>(null);
  const [projectSearch, setProjectSearch] = useState('');

  const [items, setItems] = useState<DesignItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState('');

  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Reset to step 1 every time the modal is opened so reopening after
  // a successful link doesn't land the operator on a stale item list.
  useEffect(() => {
    if (open) {
      setStep('pick-project');
      setSelectedProject(null);
      setProjectSearch('');
      setItemSearch('');
      setItems([]);
      setLinkError(null);
      setItemsError(null);
    }
  }, [open]);

  // Subscribe to projects while the modal is open. Unsubscribe on close
  // so idle Firestore listeners don't pile up between drawer opens.
  useEffect(() => {
    if (!open) return;
    setProjectsLoading(true);
    const unsub = subscribeToProjects(list => {
      setProjects(list);
      setProjectsLoading(false);
    });
    return unsub;
  }, [open]);

  // Fetch items when the user picks a project. One-shot (not a
  // subscription) because the operator's in-modal decision is quick
  // and the live refresh value is low.
  useEffect(() => {
    if (!selectedProject) return;
    let cancelled = false;
    setItemsLoading(true);
    setItemsError(null);
    getDesignItems(selectedProject.id)
      .then(list => {
        if (!cancelled) setItems(list);
      })
      .catch(err => {
        if (!cancelled) {
          setItemsError(err instanceof Error ? err.message : 'Failed to load design items');
        }
      })
      .finally(() => {
        if (!cancelled) setItemsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProject]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      p =>
        p.name?.toLowerCase().includes(q) ||
        p.code?.toLowerCase().includes(q) ||
        p.customerName?.toLowerCase().includes(q),
    );
  }, [projects, projectSearch]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      i =>
        i.name?.toLowerCase().includes(q) ||
        i.itemCode?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q),
    );
  }, [items, itemSearch]);

  const handleLink = async (item: DesignItem) => {
    if (!selectedProject) return;
    setLinking(true);
    setLinkError(null);
    try {
      await linkBoqToDesignItem(
        boqRef,
        { designProjectId: selectedProject.id, designItemId: item.id },
        userId,
      );
      onLinked(item);
      onClose();
    } catch (err) {
      if (err instanceof BOQDesignItemLinkError) {
        setLinkError(`${err.code}: ${err.message}`);
      } else {
        setLinkError(err instanceof Error ? err.message : 'Link failed');
      }
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Link BOQ item to a DesignItem
          </DialogTitle>
          <DialogDescription>
            {step === 'pick-project'
              ? 'Step 1 of 2 — pick the design project this BOQ line corresponds to.'
              : `Step 2 of 2 — pick a design item in “${selectedProject?.name ?? ''}”.`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Project picker */}
        {step === 'pick-project' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                placeholder="Search design projects…"
                className="w-full border rounded-md pl-8 pr-3 py-2 text-sm"
              />
            </div>

            {projectsLoading && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading projects…
              </p>
            )}

            {!projectsLoading && filteredProjects.length === 0 && (
              <p className="text-xs text-gray-500 italic py-6 text-center">
                No design projects match your search.
              </p>
            )}

            {!projectsLoading && filteredProjects.length > 0 && (
              <ul className="rounded-md border border-gray-200 divide-y max-h-72 overflow-y-auto">
                {filteredProjects.map(project => (
                  <li key={project.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProject(project);
                        setStep('pick-item');
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {project.name}
                        </span>
                        {project.code && (
                          <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                            {project.code}
                          </span>
                        )}
                      </div>
                      {project.customerName && (
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {project.customerName}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Step 2: Item picker */}
        {step === 'pick-item' && selectedProject && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setStep('pick-project');
                setSelectedProject(null);
                setItems([]);
                setItemSearch('');
                setLinkError(null);
              }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ArrowLeft className="w-3 h-3" />
              Change project
            </button>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={itemSearch}
                onChange={e => setItemSearch(e.target.value)}
                placeholder="Search design items…"
                className="w-full border rounded-md pl-8 pr-3 py-2 text-sm"
              />
            </div>

            {itemsLoading && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading items…
              </p>
            )}

            {itemsError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {itemsError}
              </p>
            )}

            {!itemsLoading && !itemsError && filteredItems.length === 0 && (
              <p className="text-xs text-gray-500 italic py-6 text-center">
                No design items in this project.
              </p>
            )}

            {!itemsLoading && filteredItems.length > 0 && (
              <ul className="rounded-md border border-gray-200 divide-y max-h-72 overflow-y-auto">
                {filteredItems.map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={linking}
                      onClick={() => handleLink(item)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {item.name}
                        </span>
                        {item.itemCode && (
                          <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">
                            {item.itemCode}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 text-[10px] text-gray-500 mt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-gray-100">{item.category}</span>
                        {item.currentStage && <span>{item.currentStage}</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {linking && (
              <p className="text-xs text-blue-600 flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Linking…
              </p>
            )}

            {linkError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                {linkError}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default LinkDesignItemModal;
