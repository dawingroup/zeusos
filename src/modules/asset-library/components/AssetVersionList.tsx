/**
 * AssetVersionList — table of versions for an asset with a rollback button
 * per row and an upload-new-version action at the top.
 */

import type { AssetVersion } from '../types/asset-version.types';

interface Props {
  versions: AssetVersion[];
  currentVersionId: string;
  onRollback?: (versionId: string) => void;
  onUploadNewVersion?: () => void;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function fmtTimestamp(ts: AssetVersion['uploadedAt']): string {
  if (typeof ts === 'string') return ts;
  if (ts && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  return '—';
}

export function AssetVersionList({
  versions,
  currentVersionId,
  onRollback,
  onUploadNewVersion,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {onUploadNewVersion && (
          <button
            onClick={onUploadNewVersion}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted/40"
          >
            Upload New Version
          </button>
        )}
      </div>

      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No version history yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Version</th>
                <th className="px-3 py-2 text-left font-medium">Uploaded</th>
                <th className="px-3 py-2 text-left font-medium">By</th>
                <th className="px-3 py-2 text-right font-medium">Size</th>
                <th className="px-3 py-2 text-left font-medium">Notes</th>
                <th className="px-3 py-2 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {versions.map((v) => {
                const isCurrent = v.id === currentVersionId;
                return (
                  <tr key={v.id} className={isCurrent ? 'bg-[var(--rag-green-soft)]/40' : ''}>
                    <td className="px-3 py-2 font-medium">
                      {v.versionLabel}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center rounded bg-[var(--rag-green-soft)] px-1.5 py-0.5 text-xs text-[var(--rag-green)]">
                          current
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {fmtTimestamp(v.uploadedAt)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{v.uploadedBy}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmtBytes(v.fileSizeBytes)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {v.changeNotes ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!isCurrent && onRollback && (
                        <button
                          onClick={() => onRollback(v.id)}
                          className="text-xs underline text-muted-foreground hover:text-foreground"
                        >
                          Roll back
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
