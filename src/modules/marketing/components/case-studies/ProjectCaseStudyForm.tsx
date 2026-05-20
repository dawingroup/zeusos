/**
 * ProjectCaseStudyForm
 *
 * Create / edit a project case study and publish it to Shopify.
 *
 * Field-by-field, every input below maps to a field that lands on the
 * published `article.project` page on dawinfinishes.com. Fields that
 * Shopify doesn't render (stats, action points, per-case-study CTA,
 * narrative aside) were removed in commit cb338481-followup so the
 * form is honest about what publishes.
 *
 * Images upload directly to Firebase Storage; the resulting public
 * URLs feed Shopify `fileCreate` during publish so the gallery + hero
 * end up in Shopify Files.
 */

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Plus, Save, Trash2, Upload, X, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { DesignProjectPicker, type DesignProjectPickerValue } from '@/subsidiaries/finishes/design-studio/components/scene/DesignProjectPicker';
import {
  createCaseStudy,
  publishCaseStudyToShopify,
  updateCaseStudy,
} from '../../services/projectCaseStudyService';
import type {
  CaseStudyCategory,
  CaseStudyMaterial,
  CaseStudyStatus,
  ProjectCaseStudy,
  ProjectCaseStudyFormData,
} from '../../types';
import { CASE_STUDY_CATEGORY_META } from '../../constants';
import { CaseStudyImagePicker } from './CaseStudyImagePicker';

interface ProjectCaseStudyFormProps {
  caseStudy?: ProjectCaseStudy;
  onClose: () => void;
  onSuccess?: (id: string) => void;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

const EMPTY_FORM: ProjectCaseStudyFormData = {
  subsidiaryId: 'finishes',
  handle: '',
  status: 'draft',
  category: 'residential',
  tags: [],
  hero: { title: '' },
  narrative: { heading: 'The brief', body: '', asideHeading: '', asideContent: '' },
  stats: [],
  gallery: { heading: 'Gallery', imagePaths: [] },
  quote: { quote: '', attribution: '' },
  materials: [],
  actionPoints: [],
  cta: {
    eyebrow: 'Ready to start yours?',
    headline: 'Bring this finish to your space',
    body: '',
    primaryText: 'Start a project with Dawin Finishes',
    primaryUrl: '/pages/start-project',
    secondaryText: 'Book a showroom visit',
    secondaryUrl: '/pages/contact',
  },
  authorId: '',
  authorName: '',
};

function toFormData(cs: ProjectCaseStudy): ProjectCaseStudyFormData {
  return {
    subsidiaryId: cs.subsidiaryId,
    handle: cs.handle,
    status: cs.status,
    category: cs.category,
    tags: cs.tags || [],
    hero: cs.hero,
    narrative: cs.narrative,
    stats: cs.stats || [],
    gallery: cs.gallery || { heading: 'Gallery', imagePaths: [] },
    quote: cs.quote,
    materials: cs.materials || [],
    actionPoints: cs.actionPoints || [],
    cta: cs.cta,
    linkedDealId: cs.linkedDealId,
    linkedProjectId: cs.linkedProjectId,
    authorId: cs.authorId,
    authorName: cs.authorName,
    approverId: cs.approverId,
    approverName: cs.approverName,
  };
}

export function ProjectCaseStudyForm({
  caseStudy,
  onClose,
  onSuccess,
}: ProjectCaseStudyFormProps) {
  const { user } = useAuth();
  const isEditing = !!caseStudy;
  const sessionId = useMemo(() => crypto.randomUUID(), []);
  const [data, setData] = useState<ProjectCaseStudyFormData>(EMPTY_FORM);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(
    caseStudy?.shopifyPageUrl || null
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [pullingProject, setPullingProject] = useState(false);
  /**
   * Display value for the DesignProjectPicker. Holds the picked project's
   * id + name + customer so the picker can render its "Change" chip without
   * a second Firestore round-trip. Lazily hydrated on edit-mode if the
   * case study already has a linkedProjectId.
   */
  const [pickedProject, setPickedProject] = useState<DesignProjectPickerValue | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!data.linkedProjectId) {
      setPickedProject(null);
      return;
    }
    if (pickedProject?.id === data.linkedProjectId) return;
    // Hydrate the chip from Firestore so the picker can show the name
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'designProjects', data.linkedProjectId!));
        if (cancelled) return;
        if (snap.exists()) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p: any = snap.data();
          setPickedProject({ id: snap.id, name: p.name || snap.id, code: p.code, customerName: p.customerName });
        }
      } catch {
        // best-effort hydration; picker can still operate by id
      }
    })();
    return () => { cancelled = true; };
  }, [data.linkedProjectId, pickedProject?.id]);

  /**
   * Pull data from the linked DesignProject in DawinOS — auto-fills the
   * first section (hero: client / location / year / scope) from records the
   * team already maintains, so the editor only writes the prose.
   */
  async function handlePullFromLinkedProject() {
    const id = data.linkedProjectId?.trim();
    if (!id) {
      setErrorBanner('Set a linked project id first');
      return;
    }
    setPullingProject(true);
    setErrorBanner(null);
    try {
      const snap = await getDoc(doc(db, 'projects', id));
      if (!snap.exists()) {
        setErrorBanner(`DesignProject ${id} not found`);
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = snap.data();
      const completed = p.completedDate?.toDate ? p.completedDate.toDate() : (p.completedDate ? new Date(p.completedDate) : null);
      const year = completed ? String(completed.getFullYear()) : (p.startDate?.toDate ? String(p.startDate.toDate().getFullYear()) : '');
      const locationCity = p.siteLocation?.city || p.deliveryLocation?.city || '';
      const locationCountry = p.siteLocation?.country || p.deliveryLocation?.country || '';
      const location = [locationCity, locationCountry].filter(Boolean).join(', ');
      setData((d) => ({
        ...d,
        hero: {
          ...d.hero,
          title: d.hero.title || p.name || '',
          client: d.hero.client || p.customerName || '',
          location: d.hero.location || location,
          year: d.hero.year || year,
        },
        // Seed the narrative body with the design project description (the
        // editor can rewrite — keeps the "already-known facts" out of LLM scope).
        narrative: {
          ...(d.narrative || {}),
          body: d.narrative?.body || p.description || '',
        } as ProjectCaseStudyFormData['narrative'],
      }));
      setSuccessBanner(`Pulled hero data from project "${p.name || id}"`);
    } catch (e) {
      setErrorBanner((e as Error).message || 'Failed to pull project data');
    } finally {
      setPullingProject(false);
    }
  }

  useEffect(() => {
    if (caseStudy) {
      setData(toFormData(caseStudy));
    }
  }, [caseStudy]);

  const handleAutogenerated = useMemo(() => slugify(data.hero.title || ''), [data.hero.title]);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!data.hero.title.trim()) e.title = 'Project title is required';
    const finalHandle = (data.handle || handleAutogenerated).trim();
    if (!finalHandle) e.handle = 'Handle is required';
    if (!/^[a-z0-9-]+$/.test(finalHandle)) {
      e.handle = 'Handle must be lowercase letters, numbers, and dashes only';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(targetStatus: CaseStudyStatus, ev?: FormEvent) {
    ev?.preventDefault();
    if (!user?.uid) {
      setErrorBanner('You must be signed in to save a case study.');
      return;
    }
    if (!validate()) return;

    const userId = user.uid;
    const userName = user.displayName || user.email || 'Editor';
    const subsidiaryId = data.subsidiaryId || 'finishes';

    setSaving(true);
    setErrorBanner(null);
    try {
      const finalHandle = (data.handle || handleAutogenerated).trim();
      const payload: ProjectCaseStudyFormData = {
        ...data,
        subsidiaryId,
        handle: finalHandle,
        status: targetStatus,
        authorId: data.authorId || userId,
        authorName: data.authorName || userName,
      };

      if (isEditing && caseStudy) {
        await updateCaseStudy(caseStudy.id, payload, userId);
        onSuccess?.(caseStudy.id);
      } else {
        const id = await createCaseStudy(subsidiaryId, payload, userId, userName);
        onSuccess?.(id);
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save case study';
      setErrorBanner(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!caseStudy?.id) {
      setErrorBanner('Save the case study first, then publish.');
      return;
    }
    setPublishing(true);
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const result = await publishCaseStudyToShopify(caseStudy.id, true);
      setPublishedUrl(result.url);
      setSuccessBanner(
        `${result.isUpdate ? 'Updated' : 'Published'} on Shopify: ${result.url}`
      );
      onSuccess?.(caseStudy.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to publish to Shopify';
      setErrorBanner(msg);
    } finally {
      setPublishing(false);
    }
  }

  function addTag() {
    const v = tagInput.trim();
    if (!v || data.tags.includes(v)) return;
    setData((d) => ({ ...d, tags: [...d.tags, v] }));
    setTagInput('');
  }

  function removeTag(tag: string) {
    setData((d) => ({ ...d, tags: d.tags.filter((t) => t !== tag) }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-full max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isEditing ? 'Edit case study' : 'New case study'}
            </h2>
            <p className="text-xs text-gray-500">
              Published to dawinfinishes.com/pages/{(data.handle || handleAutogenerated) || '<handle>'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form
          className="flex-1 overflow-y-auto px-6 py-5 space-y-6"
          onSubmit={(e) => handleSubmit(data.status, e)}
        >
          {errorBanner && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {errorBanner}
            </div>
          )}
          {successBanner && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {successBanner}
            </div>
          )}

          {/* Basics */}
          <Section title="Basics" defaultOpen>
            <Field label="Project title" error={errors.title} required>
              <input
                type="text"
                value={data.hero.title}
                onChange={(e) =>
                  setData((d) => ({ ...d, hero: { ...d.hero, title: e.target.value } }))
                }
                className="input"
                placeholder="Lubowa Residence"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Handle (URL slug)" error={errors.handle} required>
                <input
                  type="text"
                  value={data.handle}
                  onChange={(e) => setData((d) => ({ ...d, handle: e.target.value }))}
                  placeholder={handleAutogenerated || 'lubowa-residence'}
                  className="input font-mono"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Becomes the Shopify page handle. Lowercase, numbers, dashes only.
                </p>
              </Field>

              <Field label="Category">
                <select
                  value={data.category}
                  onChange={(e) =>
                    setData((d) => ({ ...d, category: e.target.value as CaseStudyCategory }))
                  }
                  className="input"
                >
                  {Object.entries(CASE_STUDY_CATEGORY_META).map(([value, meta]) => (
                    <option key={value} value={value}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Tags">
              <div className="flex flex-wrap gap-2">
                {data.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-2.5 py-0.5 text-xs text-pink-700"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full p-0.5 hover:bg-pink-100"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add tag…"
                    className="input w-32 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="rounded border px-2 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </Field>
          </Section>

          {/* Hero */}
          <Section title="Hero">
            <Field label="Hero image">
              <CaseStudyImagePicker
                mode="single"
                value={data.hero.imageUrl || ''}
                onChange={(url) =>
                  setData((d) => ({ ...d, hero: { ...d.hero, imageUrl: url } }))
                }
                caseStudyId={caseStudy?.id}
                sessionId={sessionId}
              />
            </Field>
            <Field label="Eyebrow">
              <input
                type="text"
                value={data.hero.eyebrow || ''}
                onChange={(e) =>
                  setData((d) => ({ ...d, hero: { ...d.hero, eyebrow: e.target.value } }))
                }
                placeholder="Case study"
                className="input"
              />
            </Field>
            <Field label="One-line summary">
              <textarea
                value={data.hero.summary || ''}
                onChange={(e) =>
                  setData((d) => ({ ...d, hero: { ...d.hero, summary: e.target.value } }))
                }
                rows={2}
                className="input"
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client">
                <input
                  type="text"
                  value={data.hero.client || ''}
                  onChange={(e) =>
                    setData((d) => ({ ...d, hero: { ...d.hero, client: e.target.value } }))
                  }
                  className="input"
                />
              </Field>
              <Field label="Location">
                <input
                  type="text"
                  value={data.hero.location || ''}
                  onChange={(e) =>
                    setData((d) => ({ ...d, hero: { ...d.hero, location: e.target.value } }))
                  }
                  className="input"
                />
              </Field>
              <Field label="Year">
                <input
                  type="text"
                  value={data.hero.year || ''}
                  onChange={(e) =>
                    setData((d) => ({ ...d, hero: { ...d.hero, year: e.target.value } }))
                  }
                  className="input"
                />
              </Field>
              <Field label="Scope">
                <input
                  type="text"
                  value={data.hero.scope || ''}
                  onChange={(e) =>
                    setData((d) => ({ ...d, hero: { ...d.hero, scope: e.target.value } }))
                  }
                  placeholder="Design, finishes, installation"
                  className="input"
                />
              </Field>
            </div>
          </Section>

          {/* Narrative */}
          <Section title="Narrative">
            <Field label="Body (HTML allowed — used as article body on Shopify)">
              <textarea
                value={data.narrative?.body || ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    narrative: { ...(d.narrative || {}), body: e.target.value },
                  }))
                }
                rows={10}
                className="input font-mono text-sm"
                placeholder="<p>The client wanted…</p>"
              />
              <p className="mt-1 text-xs text-gray-500">
                Use inline <code>&lt;h2&gt;</code>/<code>&lt;h3&gt;</code> for headings within the narrative.
              </p>
            </Field>
          </Section>

          {/* Gallery */}
          <Section title="Gallery">
            <CaseStudyImagePicker
              mode="multi"
              values={data.gallery?.imagePaths || []}
              onChange={(imagePaths) =>
                setData((d) => ({
                  ...d,
                  gallery: { ...(d.gallery || { heading: 'Gallery', imagePaths: [] }), imagePaths },
                }))
              }
              caseStudyId={caseStudy?.id}
              sessionId={sessionId}
            />
          </Section>

          {/* Quote */}
          <Section title="Client quote">
            <Field label="Quote">
              <textarea
                value={data.quote?.quote || ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    quote: { ...(d.quote || { quote: '' }), quote: e.target.value },
                  }))
                }
                rows={3}
                className="input"
              />
            </Field>
            <Field label="Attribution">
              <input
                type="text"
                value={data.quote?.attribution || ''}
                onChange={(e) =>
                  setData((d) => ({
                    ...d,
                    quote: { ...(d.quote || { quote: '' }), attribution: e.target.value },
                  }))
                }
                placeholder="Name, role"
                className="input"
              />
            </Field>
          </Section>

          {/* Materials */}
          <Section title="Finishes & materials">
            <ArrayEditor<CaseStudyMaterial>
              items={data.materials}
              onChange={(materials) => setData((d) => ({ ...d, materials }))}
              empty={{ label: '', linkUrl: '' }}
              addLabel="Add material"
              renderItem={(item, update) => (
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => update({ ...item, label: e.target.value })}
                    placeholder="Microcement, Stone Grey"
                    className="input"
                  />
                  <input
                    type="text"
                    value={item.linkUrl || ''}
                    onChange={(e) => update({ ...item, linkUrl: e.target.value })}
                    placeholder="/collections/microcement (optional)"
                    className="input"
                  />
                </div>
              )}
            />
          </Section>

          {/* Links */}
          <Section title="Links (optional)">
            <Field label="Linked CRM deal id">
              <input
                type="text"
                value={data.linkedDealId || ''}
                onChange={(e) => setData((d) => ({ ...d, linkedDealId: e.target.value }))}
                placeholder="deal_…"
                className="input font-mono text-sm"
              />
            </Field>
            <Field label="Linked design/manufacturing project">
              <DesignProjectPicker
                value={pickedProject}
                onChange={(v) => {
                  setPickedProject(v);
                  setData((d) => ({ ...d, linkedProjectId: v?.id || '' }));
                }}
                // Case studies are usually written for completed work but
                // sometimes drafted while the project's still active.
                statuses={['active', 'completed']}
              />
              <div className="flex items-center justify-between mt-2 gap-3">
                <p className="text-xs text-gray-500 flex-1">
                  Pulls hero fields (client, location, year, description) from the DesignProject — only fills blanks.
                </p>
                <button
                  type="button"
                  onClick={handlePullFromLinkedProject}
                  disabled={pullingProject || !data.linkedProjectId}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded disabled:opacity-50 flex-shrink-0"
                  title="Pull client / location / year / description from the linked DesignProject record"
                >
                  {pullingProject ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Pull from project
                </button>
              </div>
            </Field>
          </Section>
        </form>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t bg-gray-50 px-6 py-3">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span>
              Status: <strong className="capitalize">{data.status.replace('_', ' ')}</strong>
            </span>
            {publishedUrl && (
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                View live
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              disabled={saving || publishing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('draft')}
              className="inline-flex items-center gap-1 rounded border bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              disabled={saving || publishing}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </button>
            <button
              type="button"
              onClick={() => handleSubmit('in_review')}
              className="inline-flex items-center gap-1 rounded bg-pink-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-pink-700"
              disabled={saving || publishing}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit for review
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={saving || publishing}
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                title="Push this case study to the Shopify projects blog"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {publishedUrl ? 'Update on Shopify' : 'Publish to Shopify'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="rounded-lg border bg-white">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {title}
      </summary>
      <div className="space-y-4 border-t px-4 py-4">{children}</div>
    </details>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </label>
  );
}

interface ArrayEditorProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  empty: T;
  addLabel: string;
  max?: number;
  renderItem: (item: T, update: (next: T) => void) => React.ReactNode;
}

function ArrayEditor<T>({
  items,
  onChange,
  empty,
  addLabel,
  max,
  renderItem,
}: ArrayEditorProps<T>) {
  const canAdd = !max || items.length < max;
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 rounded border bg-gray-50 p-3">
          <div className="flex-1">{renderItem(item, (next) => {
            const copy = [...items];
            copy[i] = next;
            onChange(copy);
          })}</div>
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {canAdd && (
        <button
          type="button"
          onClick={() => onChange([...items, structuredClone(empty)])}
          className="inline-flex items-center gap-1 rounded border border-dashed bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          <Plus className="h-3.5 w-3.5" />
          {addLabel}
        </button>
      )}
    </div>
  );
}
