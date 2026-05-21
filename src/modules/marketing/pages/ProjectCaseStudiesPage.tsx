/**
 * ProjectCaseStudiesPage
 *
 * Authoring surface for curated project write-ups that get published to
 * dawinfinishes.com (Shopify) using the `page.project` template.
 *
 * Scaffolded: list view, status filter, basic empty state, and a "New
 * case study" stub. The detail/edit form is intentionally left as a
 * separate component (`ProjectCaseStudyForm`) to be built next.
 */

import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Search, ExternalLink, FileText, Eye, Pencil, Globe } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjectCaseStudies } from '../hooks/useProjectCaseStudies';
import { ProjectCaseStudyForm } from '../components/case-studies/ProjectCaseStudyForm';
import { ProjectCaseStudyStorefrontDrawer } from '../components/case-studies/ProjectCaseStudyStorefrontDrawer';
import type { CaseStudyStatus, ProjectCaseStudy } from '../types';
import { CASE_STUDY_STATUS_META } from '../constants';

const SYNC_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  unpublished: 'bg-gray-100 text-gray-600',
};

const DEFAULT_SUBSIDIARY = 'finishes';

const STATUS_TABS: { value: CaseStudyStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export default function ProjectCaseStudiesPage() {
  const { user } = useAuth();
  const [statusTab, setStatusTab] = useState<CaseStudyStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ProjectCaseStudy | null>(null);
  const [storefrontEditing, setStorefrontEditing] = useState<ProjectCaseStudy | null>(null);
  const [showForm, setShowForm] = useState(false);

  const subsidiaryId = user?.uid ? DEFAULT_SUBSIDIARY : undefined;

  const { caseStudies, loading, error } = useProjectCaseStudies(subsidiaryId, {
    status: statusTab === 'all' ? undefined : statusTab,
    search: search.trim() || undefined,
  });

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(cs: ProjectCaseStudy) {
    setEditing(cs);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  const counts = useMemo(() => {
    const map = new Map<CaseStudyStatus, number>();
    caseStudies.forEach((cs) => map.set(cs.status, (map.get(cs.status) || 0) + 1));
    return map;
  }, [caseStudies]);

  return (
    <div className="p-6 space-y-6">
      <Helmet>
        <title>Project Case Studies · Marketing · ZeusOS</title>
      </Helmet>

      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Project Case Studies</h1>
          <p className="text-sm text-gray-500">
            Curate project write-ups here. Approved case studies are published to
            dawinfinishes.com under the <code>page.project</code> template.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white hover:bg-pink-700"
        >
          <Plus className="h-4 w-4" />
          New case study
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusTab(tab.value)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                statusTab === tab.value
                  ? 'bg-pink-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.value !== 'all' && counts.get(tab.value as CaseStudyStatus) ? (
                <span className="ml-1 text-xs opacity-75">
                  · {counts.get(tab.value as CaseStudyStatus)}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="search"
            placeholder="Search by title, client, location, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load case studies: {error.message}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border bg-white p-12 text-center text-sm text-gray-500">
          Loading case studies…
        </div>
      ) : caseStudies.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {caseStudies.map((cs) => (
            <CaseStudyCard
              key={cs.id}
              caseStudy={cs}
              onEdit={() => openEdit(cs)}
              onOpenStorefront={() => setStorefrontEditing(cs)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ProjectCaseStudyForm caseStudy={editing || undefined} onClose={closeForm} />
      )}

      {storefrontEditing && (
        <ProjectCaseStudyStorefrontDrawer
          caseStudy={storefrontEditing}
          onClose={() => setStorefrontEditing(null)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed bg-white p-12 text-center">
      <FileText className="mx-auto h-10 w-10 text-gray-400" />
      <h3 className="mt-3 text-base font-semibold">No case studies yet</h3>
      <p className="mt-1 text-sm text-gray-500">
        Start by capturing the brief, narrative, and key results for a completed project.
        When approved, this content publishes to <code>dawinfinishes.com/pages/&lt;handle&gt;</code>.
      </p>
    </div>
  );
}

function CaseStudyCard({
  caseStudy,
  onEdit,
  onOpenStorefront,
}: {
  caseStudy: ProjectCaseStudy;
  onEdit: () => void;
  onOpenStorefront: () => void;
}) {
  const statusMeta = CASE_STUDY_STATUS_META[caseStudy.status];
  const syncStatus = caseStudy.storefront?.shopifySyncStatus;
  const liveUrl = caseStudy.storefront?.shopifyMetaobjectGid && caseStudy.handle
    ? `https://dawinfinishes.com/projects/${caseStudy.handle}`
    : caseStudy.shopifyPageUrl;
  return (
    <article className="flex flex-col rounded-lg border bg-white overflow-hidden hover:shadow-md transition">
      <div className="aspect-video bg-gray-100 relative">
        {caseStudy.hero.imageUrl ? (
          <img
            src={caseStudy.hero.imageUrl}
            alt={caseStudy.hero.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <FileText className="h-10 w-10" />
          </div>
        )}
        <span
          className={`absolute top-3 left-3 rounded-full px-2 py-0.5 text-xs font-medium ${statusMeta.badgeClass}`}
        >
          {statusMeta.label}
        </span>
        {syncStatus && (
          <span
            className={`absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-medium ${SYNC_BADGE[syncStatus] || 'bg-gray-100'}`}
            title="dawinfinishes.com sync status"
          >
            {syncStatus}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-semibold leading-tight">{caseStudy.hero.title}</h3>
        <p className="mt-1 text-xs text-gray-500">
          {[caseStudy.hero.client, caseStudy.hero.location, caseStudy.hero.year]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {caseStudy.hero.summary && (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">{caseStudy.hero.summary}</p>
        )}
        <div className="mt-4 flex items-center gap-2 pt-2 border-t">
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            onClick={() => alert('Preview not yet wired up — scaffold only.')}
          >
            <Eye className="h-3.5 w-3.5" />
            Preview
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
            onClick={onOpenStorefront}
          >
            <Globe className="h-3.5 w-3.5" />
            Storefront
          </button>
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-pink-600 hover:bg-pink-50"
            >
              View live
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
