/**
 * ItemRevisionTimeline
 *
 * Phase 3b — wires the design-studio's RevisionTimeline component to
 * real data by merging the latest `projectFiles` for a given design
 * item with its `revisionRequests`. Renders in the DesignItemDetail's
 * `files-approvals` tab alongside UnifiedFileManager.
 */

import { useEffect, useMemo, useState } from 'react';
import RevisionTimeline from '@/subsidiaries/finishes/design-studio/components/RevisionTimeline';
import {
  subscribeToProjectFiles,
  type ManagedFile,
} from '@/shared/services/fileManager';
import {
  subscribeToRevisionRequests,
  type RevisionRequest,
} from '../../services/revisionRequestService';
import { buildRevisionTimeline } from '../../services/revisionTimelineBuilder';

interface ItemRevisionTimelineProps {
  projectId: string;
  itemId: string;
}

export function ItemRevisionTimeline({ projectId, itemId }: ItemRevisionTimelineProps) {
  const [files, setFiles] = useState<ManagedFile[]>([]);
  const [requests, setRequests] = useState<RevisionRequest[]>([]);

  useEffect(() => {
    const unsubFiles = subscribeToProjectFiles(projectId, { itemId }, ({ files: f }) => {
      setFiles(f);
    });
    const unsubReqs = subscribeToRevisionRequests(projectId, { itemId }, (r) => {
      setRequests(r);
    });
    return () => {
      unsubFiles();
      unsubReqs();
    };
  }, [projectId, itemId]);

  const timeline = useMemo(
    () => buildRevisionTimeline({ files, requests }),
    [files, requests],
  );

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Revision Timeline</h3>
        <p className="text-[11px] text-gray-400">
          File uploads and client revision requests, oldest first.
        </p>
      </div>
      <div className="max-h-[480px] overflow-y-auto">
        <RevisionTimeline revisions={timeline} />
      </div>
    </div>
  );
}

export default ItemRevisionTimeline;
