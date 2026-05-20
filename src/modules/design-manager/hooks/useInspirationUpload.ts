/**
 * useInspirationUpload Hook
 * Wrapper hook that integrates the clipper's ManualUploadDialog
 * with design-manager context (project/design-item).
 */

import { useState, useCallback } from 'react';
import type { DesignClip } from '@/subsidiaries/finishes/clipper/types';

interface UseInspirationUploadOptions {
  projectId: string;
  designItemId?: string;
  onClipCreated?: (clipId: string, clip?: DesignClip) => void;
}

interface UseInspirationUploadReturn {
  /** Whether the upload dialog is open */
  isOpen: boolean;
  /** Open the upload dialog */
  openUploader: () => void;
  /** Close the upload dialog */
  closeUploader: () => void;
  /** Handle clip creation callback */
  handleClipCreated: (clipId: string) => void;
  /** Project ID for the upload context */
  projectId: string;
  /** Design item ID for the upload context */
  designItemId?: string;
}

export function useInspirationUpload({
  projectId,
  designItemId,
  onClipCreated,
}: UseInspirationUploadOptions): UseInspirationUploadReturn {
  const [isOpen, setIsOpen] = useState(false);

  const openUploader = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeUploader = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleClipCreated = useCallback(
    (clipId: string) => {
      onClipCreated?.(clipId);
      // Optionally close the dialog after successful upload
      // setIsOpen(false);
    },
    [onClipCreated]
  );

  return {
    isOpen,
    openUploader,
    closeUploader,
    handleClipCreated,
    projectId,
    designItemId,
  };
}

export default useInspirationUpload;
