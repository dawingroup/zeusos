/**
 * Parsing Hooks
 * 
 * React hooks for BOQ parsing workflow.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  ParsingJob,
  ParsedSection,
  ParsedItem,
} from '../types/parsing';
import {
  boqParserService,
  type StartParsingOptions,
} from '../services/boq-parser-service';

// ============================================================================
// PARSING JOB HOOK
// ============================================================================

export interface UseParsingJobReturn {
  job: ParsingJob | null;
  loading: boolean;
  error: string | null;
  startParsing: (options?: StartParsingOptions) => Promise<void>;
  cancelParsing: () => Promise<void>;
}

export const useParsingJob = (jobId: string | null): UseParsingJobReturn => {
  const [job, setJob] = useState<ParsingJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }

    setLoading(true);

    const unsubscribe = boqParserService.subscribeToParsingJob(jobId, (updatedJob) => {
      setJob(updatedJob);
      setLoading(false);

      if (updatedJob.status === 'failed' && updatedJob.errors?.length) {
        setError(updatedJob.errors[0].message);
      } else {
        setError(null);
      }
    });

    return unsubscribe;
  }, [jobId]);

  const startParsing = useCallback(
    async (options?: StartParsingOptions) => {
      if (!jobId) return;

      setError(null);
      try {
        await boqParserService.startParsing(jobId, options);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start parsing');
        throw err;
      }
    },
    [jobId]
  );

  const cancelParsing = useCallback(async () => {
    if (!jobId) return;

    try {
      await boqParserService.cancelParsing(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel parsing');
      throw err;
    }
  }, [jobId]);

  return {
    job,
    loading,
    error,
    startParsing,
    cancelParsing,
  };
};

// ============================================================================
// FILE UPLOAD HOOK
// ============================================================================

export interface UseFileUploadReturn {
  uploading: boolean;
  uploadProgress: number;
  uploadFile: (
    file: File,
    options: {
      projectId: string;
      engagementId: string;
      boqId?: string;
      userId: string;
    },
    storage: any
  ) => Promise<ParsingJob>;
  error: string | null;
}

export const useFileUpload = (): UseFileUploadReturn => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (
      file: File,
      options: {
        projectId: string;
        engagementId: string;
        boqId?: string;
        userId: string;
      },
      storage: any
    ): Promise<ParsingJob> => {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 10, 90));
        }, 200);

        const job = await boqParserService.uploadBOQFile(file, options, storage);

        clearInterval(progressInterval);
        setUploadProgress(100);
        setUploading(false);

        return job;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setUploading(false);
        throw err;
      }
    },
    []
  );

  return {
    uploading,
    uploadProgress,
    uploadFile,
    error,
  };
};

// ============================================================================
// LOCAL PARSING HOOK
// ============================================================================

export interface UseLocalParsingReturn {
  parsing: boolean;
  progress: { stage: string; percentage: number; message?: string };
  parseFile: (
    jobId: string,
    file: File,
    options?: StartParsingOptions
  ) => Promise<void>;
  error: string | null;
}

export const useLocalParsing = (): UseLocalParsingReturn => {
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState({ stage: 'idle', percentage: 0 });
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback(
    async (jobId: string, file: File, options?: StartParsingOptions) => {
      setParsing(true);
      setError(null);
      setProgress({ stage: 'starting', percentage: 0 });

      try {
        await boqParserService.parseLocally(jobId, file, options, (p) => {
          setProgress(p);
        });
        setProgress({ stage: 'completed', percentage: 100 });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Parsing failed');
        throw err;
      } finally {
        setParsing(false);
      }
    },
    []
  );

  return {
    parsing,
    progress,
    parseFile,
    error,
  };
};

// ============================================================================
// REVIEW HOOK
// ============================================================================

export interface UseParsingReviewReturn {
  sections: ParsedSection[];
  currentSection: ParsedSection | null;
  currentItem: ParsedItem | null;
  reviewProgress: {
    total: number;
    reviewed: number;
    approved: number;
    modified: number;
    rejected: number;
  };
  selectSection: (sectionId: string) => void;
  selectItem: (itemId: string) => void;
  approveItem: (
    edits?: Array<{ field: string; oldValue: any; newValue: any }>
  ) => Promise<void>;
  rejectItem: (reason?: string) => Promise<void>;
  approveAllHighConfidence: () => Promise<void>;
  completeReview: (notes?: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const useParsingReview = (
  jobId: string,
  userId: string
): UseParsingReviewReturn => {
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [currentSectionId, setCurrentSectionId] = useState<string | null>(null);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to job updates
  useEffect(() => {
    const unsubscribe = boqParserService.subscribeToParsingJob(jobId, (job) => {
      if (job.parsedSections) {
        setSections(job.parsedSections);

        // Auto-select first section if none selected
        if (!currentSectionId && job.parsedSections.length > 0) {
          setCurrentSectionId(job.parsedSections[0].id);
        }
      }
    });

    return unsubscribe;
  }, [jobId, currentSectionId]);

  const currentSection = sections.find((s) => s.id === currentSectionId) || null;
  const currentItem =
    currentSection?.items.find((i) => i.id === currentItemId) || null;

  // Calculate review progress
  const reviewProgress = {
    total: sections.reduce((sum, s) => sum + s.items.length, 0),
    reviewed: sections.reduce(
      (sum, s) =>
        sum +
        s.items.filter((i) =>
          ['approved', 'modified', 'rejected', 'auto_approved'].includes(
            i.reviewStatus
          )
        ).length,
      0
    ),
    approved: sections.reduce(
      (sum, s) =>
        sum +
        s.items.filter((i) =>
          ['approved', 'auto_approved'].includes(i.reviewStatus)
        ).length,
      0
    ),
    modified: sections.reduce(
      (sum, s) =>
        sum + s.items.filter((i) => i.reviewStatus === 'modified').length,
      0
    ),
    rejected: sections.reduce(
      (sum, s) =>
        sum + s.items.filter((i) => i.reviewStatus === 'rejected').length,
      0
    ),
  };

  const selectSection = useCallback(
    (sectionId: string) => {
      setCurrentSectionId(sectionId);
      const section = sections.find((s) => s.id === sectionId);
      if (section?.items.length) {
        setCurrentItemId(section.items[0].id);
      }
    },
    [sections]
  );

  const selectItem = useCallback((itemId: string) => {
    setCurrentItemId(itemId);
  }, []);

  const moveToNextItem = useCallback(() => {
    if (!currentSection || !currentItemId) return;

    const currentIndex = currentSection.items.findIndex(
      (i) => i.id === currentItemId
    );

    // Try next item in same section
    if (currentIndex < currentSection.items.length - 1) {
      setCurrentItemId(currentSection.items[currentIndex + 1].id);
      return;
    }

    // Try first item in next section
    const sectionIndex = sections.findIndex((s) => s.id === currentSectionId);
    if (sectionIndex < sections.length - 1) {
      const nextSection = sections[sectionIndex + 1];
      setCurrentSectionId(nextSection.id);
      if (nextSection.items.length > 0) {
        setCurrentItemId(nextSection.items[0].id);
      }
    }
  }, [currentSection, currentItemId, currentSectionId, sections]);

  const approveItem = useCallback(
    async (edits?: Array<{ field: string; oldValue: any; newValue: any }>) => {
      if (!currentSectionId || !currentItemId) return;

      setLoading(true);
      setError(null);

      try {
        await boqParserService.updateItemReview(
          jobId,
          currentSectionId,
          currentItemId,
          {
            status: edits ? 'modified' : 'approved',
            edits,
            userId,
          }
        );

        moveToNextItem();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve item');
      } finally {
        setLoading(false);
      }
    },
    [jobId, currentSectionId, currentItemId, userId, moveToNextItem]
  );

  const rejectItem = useCallback(
    async (_reason?: string) => {
      if (!currentSectionId || !currentItemId) return;

      setLoading(true);
      setError(null);

      try {
        await boqParserService.updateItemReview(
          jobId,
          currentSectionId,
          currentItemId,
          {
            status: 'rejected',
            userId,
          }
        );

        moveToNextItem();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject item');
      } finally {
        setLoading(false);
      }
    },
    [jobId, currentSectionId, currentItemId, userId, moveToNextItem]
  );

  const approveAllHighConfidence = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      for (const section of sections) {
        for (const item of section.items) {
          if (
            item.reviewStatus === 'pending' &&
            item.confidence.overall >= 0.85
          ) {
            await boqParserService.updateItemReview(jobId, section.id, item.id, {
              status: 'approved',
              userId,
            });
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve items');
    } finally {
      setLoading(false);
    }
  }, [sections, jobId, userId]);

  const completeReview = useCallback(
    async (notes?: string) => {
      setLoading(true);
      setError(null);

      try {
        await boqParserService.completeReview(jobId, userId, notes);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to complete review'
        );
      } finally {
        setLoading(false);
      }
    },
    [jobId, userId]
  );

  return {
    sections,
    currentSection,
    currentItem,
    reviewProgress,
    selectSection,
    selectItem,
    approveItem,
    rejectItem,
    approveAllHighConfidence,
    completeReview,
    loading,
    error,
  };
};

// ============================================================================
// APPLY TO BOQ HOOK
// ============================================================================

export interface UseApplyToBOQReturn {
  applying: boolean;
  applyToBOQ: (targetBoqId: string) => Promise<void>;
  error: string | null;
}

export const useApplyToBOQ = (
  jobId: string,
  userId: string
): UseApplyToBOQReturn => {
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyToBOQ = useCallback(
    async (targetBoqId: string) => {
      setApplying(true);
      setError(null);

      try {
        await boqParserService.applyToBOQLocally(jobId, targetBoqId, userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply to BOQ');
        throw err;
      } finally {
        setApplying(false);
      }
    },
    [jobId, userId]
  );

  return {
    applying,
    applyToBOQ,
    error,
  };
};

export default {
  useParsingJob,
  useFileUpload,
  useLocalParsing,
  useParsingReview,
  useApplyToBOQ,
};
