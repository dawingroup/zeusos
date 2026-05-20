/**
 * ArchitecturalPlansSection — scene-level uploader + list for
 * architectural plans / sections / elevations that ship alongside
 * the cabinet drawings in the PDF.
 *
 * Drops into the SceneFilesPanel. Each uploaded image lands in
 * `scene.architecturalAssets[]`; when `includeSheets.architecturalPlans`
 * is on, the PDF generator embeds one page per asset with a title
 * strip showing the kind + label + caption.
 *
 * Limits: PNG / JPEG only (jsPDF embeds images natively; PDFs require
 * a separate conversion step). The service layer enforces this; the
 * UI hints the constraint.
 */
import { useRef, useState } from 'react';
import { Upload, Loader2, Trash2, AlertTriangle, Layout, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  addSceneArchitecturalAsset,
  removeSceneArchitecturalAsset,
} from '../../services/scene.service';
import type { SceneArchitecturalAsset } from '../../types/scene.types';

interface Props {
  sceneId: string;
  assets: SceneArchitecturalAsset[];
  onChanged?: () => void;
}

type AssetKind = SceneArchitecturalAsset['kind'];

const KIND_LABEL: Record<AssetKind, string> = {
  plan: 'Plan',
  section: 'Section',
  elevation: 'Elevation',
  detail: 'Detail',
  other: 'Other',
};

export function ArchitecturalPlansSection({ sceneId, assets, onChanged }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<AssetKind>('plan');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const handlePick = () => {
    if (!label.trim()) {
      setErr('Give the drawing a label first (e.g. "Ground floor plan").');
      return;
    }
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !user) return;

    setBusy(true); setErr(null);
    try {
      await addSceneArchitecturalAsset(sceneId, file, {
        label: label.trim(),
        kind,
        caption: caption.trim() || undefined,
        userId: user.uid,
      });
      setLabel('');
      setCaption('');
      onChanged?.();
    } catch (e) {
      setErr((e as Error).message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (id: string) => {
    setPendingRemoval(id);
    setErr(null);
    try {
      await removeSceneArchitecturalAsset(sceneId, id);
      onChanged?.();
    } catch (e) {
      setErr((e as Error).message || 'Remove failed');
    } finally {
      setPendingRemoval(null);
    }
  };

  return (
    <section className="rounded-md border border-border bg-card p-2.5 space-y-2">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium inline-flex items-center gap-1">
            <LayoutGrid className="h-3.5 w-3.5" /> Architectural plans & sections
          </p>
          <p className="text-[10px] text-muted-foreground">
            Embedded into the PDF when "Architectural Plans" is on. PNG / JPEG only.
          </p>
        </div>
      </header>

      {/* Compose row */}
      <div className="rounded border border-border bg-muted/40 p-2 space-y-1.5">
        <div className="flex gap-1.5">
          <select
            value={kind}
            onChange={e => setKind(e.target.value as AssetKind)}
            className="text-[11px] px-1.5 py-1 rounded border border-border bg-background"
          >
            {(Object.keys(KIND_LABEL) as AssetKind[]).map(k => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Label (e.g. Ground floor plan)"
            className="flex-1 text-[11px] px-2 py-1 rounded border border-border bg-background"
          />
        </div>
        <input
          type="text"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Optional caption — appears under the image on the sheet"
          className="w-full text-[11px] px-2 py-1 rounded border border-border bg-background"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handlePick}
            disabled={busy || !user}
            className="shrink-0 text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {busy ? 'Uploading…' : 'Upload image'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFile}
            className="hidden"
          />
        </div>
      </div>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-900 inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {err}
        </div>
      )}

      {/* Asset list */}
      {assets.length === 0 ? (
        <p className="text-[10px] text-muted-foreground italic">No architectural drawings attached yet.</p>
      ) : (
        <ul className="space-y-1">
          {assets.map(a => (
            <li key={a.id} className="flex items-start gap-2 rounded border border-border p-1.5">
              <Layout className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">
                  {KIND_LABEL[a.kind]} · {a.label}
                </p>
                {a.caption && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{a.caption}</p>
                )}
                <p className="text-[10px] text-muted-foreground font-mono truncate">{a.fileName}</p>
              </div>
              <a
                href={a.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-600 hover:underline"
              >
                View
              </a>
              <button
                type="button"
                onClick={() => handleRemove(a.id)}
                disabled={pendingRemoval === a.id}
                title="Remove"
                className="text-muted-foreground hover:text-red-700 disabled:opacity-40"
              >
                {pendingRemoval === a.id
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Trash2 className="h-3 w-3" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
