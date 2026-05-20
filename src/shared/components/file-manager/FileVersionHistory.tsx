/**
 * FileVersionHistory
 * Dialog showing version chain for a file
 */

import { useState, useEffect } from 'react';
import { Download, Clock, User } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import type { ManagedFile } from '@/shared/services/fileManager';
import { getFileVersions } from '@/shared/services/fileManager';
import { formatFileSize } from '@/shared/services/fileManager';

interface FileVersionHistoryProps {
  file: ManagedFile;
  open: boolean;
  onClose: () => void;
}

export function FileVersionHistory({ file, open, onClose }: FileVersionHistoryProps) {
  const [versions, setVersions] = useState<ManagedFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getFileVersions(file.id)
      .then(setVersions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [file.id, open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Version History
          </DialogTitle>
          <p className="text-sm text-gray-500 mt-1">{file.name}</p>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading versions...</div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {versions.map((v) => (
              <div
                key={v.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  v.isLatest ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-gray-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">v{v.version}</span>
                    {v.isLatest && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <span>{v.fileName}</span>
                    <span>{formatFileSize(v.fileSize)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                    <User className="h-3 w-3" />
                    <span>{v.uploadedByName || v.uploadedBy || 'Unknown'}</span>
                    {v.uploadedAt?.toDate && (
                      <span>
                        {' '}
                        {v.uploadedAt.toDate().toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                <a
                  href={v.storageUrl}
                  download={v.name || v.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                  title="Download this version"
                >
                  <Download className="h-4 w-4 text-gray-600" />
                </a>
              </div>
            ))}
            {versions.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No version history</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
