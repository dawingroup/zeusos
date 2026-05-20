/**
 * useStrategyReport Hook
 * Real-time synchronization and auto-save for editable strategy reports
 * Pattern mirrors useStrategyResearch for consistency
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, Timestamp, increment } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  StrategyReportDocument,
  SaveStatus,
} from '../types/strategyReport';

const DEBOUNCE_DELAY = 500; // ms

interface UseStrategyReportReturn {
  report: StrategyReportDocument | null;
  isLoading: boolean;
  isSaving: boolean;
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  error: string | null;
  updateReport: (updates: Partial<StrategyReportDocument>) => Promise<void>;
  clearError: () => void;
}

/**
 * Custom hook for managing strategy report state with real-time sync
 *
 * @param reportId - The ID of the strategy report to sync with
 * @param userId - Current user ID for tracking changes
 * @returns Report data, loading state, save status, and update function
 */
export function useStrategyReport(
  reportId: string,
  userId: string
): UseStrategyReportReturn {
  const [report, setReport] = useState<StrategyReportDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer ref
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Real-time sync with Firestore
  useEffect(() => {
    const reportRef = doc(db, 'strategyReports', reportId);

    const unsubscribe = onSnapshot(
      reportRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setReport({ id: snapshot.id, ...data } as StrategyReportDocument);
        } else {
          setReport(null);
          setError('Report not found');
        }
        setIsLoading(false);
      },
      (err) => {
        console.error('Error syncing strategy report:', err);
        setError(err.message);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [reportId]);

  /**
   * Update report with debounced auto-save
   */
  const updateReport = useCallback(
    async (updates: Partial<StrategyReportDocument>) => {
      if (!isMounted.current) return;

      // Clear any existing debounce timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      setSaveStatus('saving');
      setIsSaving(true);

      // Debounce the save operation
      debounceTimer.current = setTimeout(async () => {
        try {
          const reportRef = doc(db, 'strategyReports', reportId);
          const now = Timestamp.now();

          // Prepare update payload
          const updatePayload: any = {
            ...updates,
            updatedAt: now,
            updatedBy: userId,
            version: increment(1),
          };

          // If this is a manual edit, track it
          if (updates.manualEdits || updates.lastEditedSection) {
            updatePayload.lastEditedAt = now;
            updatePayload.lastEditedBy = userId;
          }

          await setDoc(reportRef, updatePayload, { merge: true });

          if (isMounted.current) {
            setSaveStatus('saved');
            setLastSaved(new Date());
            setError(null);

            // Reset to idle after 2 seconds
            setTimeout(() => {
              if (isMounted.current) {
                setSaveStatus('idle');
              }
            }, 2000);
          }
        } catch (err: any) {
          console.error('Error saving strategy report:', err);
          if (isMounted.current) {
            setSaveStatus('error');
            setError(err.message || 'Failed to save report');
          }
        } finally {
          if (isMounted.current) {
            setIsSaving(false);
          }
        }
      }, DEBOUNCE_DELAY);
    },
    [reportId, userId]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    report,
    isLoading,
    isSaving,
    saveStatus,
    lastSaved,
    error,
    updateReport,
    clearError,
  };
}

/**
 * Helper hook for tracking manual edits to report fields
 *
 * @param report - Current report state
 * @param updateReport - Update function from useStrategyReport
 * @returns Function to track field edits
 */
export function useTrackManualEdits(
  report: StrategyReportDocument | null,
  updateReport: (updates: Partial<StrategyReportDocument>) => Promise<void>
) {
  const trackEdit = useCallback(
    (fieldPath: string, value: any, section?: string) => {
      if (!report) return;

      const manualEdits = report.manualEdits || [];
      const newManualEdits = manualEdits.includes(fieldPath)
        ? manualEdits
        : [...manualEdits, fieldPath];

      updateReport({
        [fieldPath]: value,
        manualEdits: newManualEdits,
        lastEditedSection: section,
      });
    },
    [report, updateReport]
  );

  return trackEdit;
}

/**
 * Helper hook for formatting the "last saved" timestamp
 *
 * @param lastSaved - Last saved date
 * @returns Formatted string (e.g., "Saved 2 minutes ago")
 */
export function useLastSavedText(lastSaved: Date | null): string {
  const [text, setText] = useState<string>('');

  useEffect(() => {
    if (!lastSaved) {
      setText('');
      return;
    }

    const updateText = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastSaved.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);

      if (diffSec < 10) {
        setText('Saved just now');
      } else if (diffSec < 60) {
        setText(`Saved ${diffSec} seconds ago`);
      } else if (diffMin < 60) {
        setText(`Saved ${diffMin} minute${diffMin === 1 ? '' : 's'} ago`);
      } else if (diffHour < 24) {
        setText(`Saved ${diffHour} hour${diffHour === 1 ? '' : 's'} ago`);
      } else {
        setText(`Saved on ${lastSaved.toLocaleDateString()}`);
      }
    };

    updateText();
    const interval = setInterval(updateText, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [lastSaved]);

  return text;
}
