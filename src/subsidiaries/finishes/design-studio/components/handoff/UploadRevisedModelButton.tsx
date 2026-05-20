/**
 * UploadRevisedModelButton — scene-level "upload an updated 3D model
 * and create a revision" flow, surfaced in the scene's Files drawer.
 *
 * Scope decision: revisions are project-scoped
 * (`DesignRevision.projectId`), and a scene is the natural place to
 * raise one because every cabinet in the scene sees the same latest
 * revision. Uploading from here creates one revision at
 * project-level; the existing scene-level "Apply rev #N (K)" batch
 * button (BatchRevisionApplyButton) then picks it up automatically
 * via its subscribeToRevisions listener — no additional wiring
 * needed.
 *
 * Accepts:
 *   - .glb — ready for the batch apply immediately.
 *   - .step/.stp/.x_t/.x_b — revision doc is created, but the GLB
 *     isn't generated until the CAD→GLB Cloud Function runs; the UI
 *     explains this and lets the user come back.
 */
import { useRef, useState } from 'react';
import { Upload, Loader2, AlertTriangle, Clock, Check } from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import { uploadRevisionFromFile } from '../../services/designRevisionService';

interface Props {
  projectId: string;
  sceneName?: string;
}

const ACCEPT = '.3ds,.glb,.step,.stp,.x_t,.x_b';

export function UploadRevisedModelButton({ projectId, sceneName }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<
    | { kind: 'glb'; revisionNumber: number; fileName: string }
    | { kind: 'cad'; revisionNumber: number; fileName: string }
    | null
  >(null);

  const handlePick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be picked again after a round.
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !user) return;

    setBusy(true);
    setErr(null);
    setDone(null);
    try {
      const res = await uploadRevisionFromFile(file, {
        projectId,
        userId: user.uid,
        editNotes: sceneName ? `Uploaded ${file.name} from scene "${sceneName}"` : `Uploaded ${file.name}`,
      });
      setDone({
        kind: res.isPreviewReady ? 'glb' : 'cad',
        revisionNumber: res.revisionNumber,
        fileName: file.name,
      });
    } catch (e) {
      setErr((e as Error).message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  if (!projectId) return null;

  return (
    <div className="rounded-md border border-border bg-card p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium">Upload updated 3D model</p>
          <p className="text-[10px] text-muted-foreground">
            .3ds / .glb previews instantly · .step / .stp / .x_t / .x_b queued for CAD→GLB
          </p>
        </div>
        <button
          type="button"
          onClick={handlePick}
          disabled={busy || !user}
          title="Create a new project revision from an updated model file"
          className="shrink-0 text-[11px] px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {/* Done-state note text says "GLB" generically because most
          DawinOS .3ds uploads still end up with a companion GLB; the
          apply path works from whichever source is present. */}


      {done?.kind === 'glb' && (
        <div className="rounded border border-green-200 bg-green-50 px-2 py-1 text-[10px] text-green-900 flex items-start gap-1">
          <Check className="h-3 w-3 shrink-0 mt-0.5" />
          <span>
            Revision #{done.revisionNumber} created from <span className="font-mono">{done.fileName}</span>.
            Use <span className="font-medium">Apply rev #{done.revisionNumber}</span> in the Design Manager sync row
            to push it to every cabinet — or open a cabinet's Apply
            revision button for a granular preview.
          </span>
        </div>
      )}

      {done?.kind === 'cad' && (
        <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] text-blue-900 flex items-start gap-1">
          <Clock className="h-3 w-3 shrink-0 mt-0.5" />
          <span>
            Revision #{done.revisionNumber} created from <span className="font-mono">{done.fileName}</span>.
            A Cloud Function will regenerate the GLB — come back and
            click <span className="font-medium">Apply rev #{done.revisionNumber}</span> in ~60s once the
            conversion finishes.
          </span>
        </div>
      )}

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-900 flex items-start gap-1">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      )}
    </div>
  );
}
