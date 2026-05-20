/**
 * useInventoryAI Hook
 * State management for Claude-powered inventory enhancement, health auditing,
 * duplicate resolution, batch corrections, and agent instructions.
 */

import { useState, useCallback } from 'react';
import {
  enhanceInventoryItemAI,
  auditInventoryHealthAI,
  loadLastAuditResult,
  saveAuditResult,
  mergeDuplicateItems,
  applyInventoryCorrections,
  loadAgentInstructions,
  saveAgentInstructions,
} from '../services/inventoryAIService';
import type { AuditOptions } from '../services/inventoryAIService';
import type {
  EnhancementResult,
  InventoryAuditResult,
  AuditBatchProgress,
  DuplicateMergeRequest,
  DuplicateMergeResult,
  ApplyCorrectionsResponse,
  CorrectionReviewItem,
  CorrectionAction,
  AgentInstructions,
} from '../types/inventoryAI';
import type { InventoryItem } from '../types/inventory';

export interface UseInventoryAIResult {
  // Enhancement
  enhancement: EnhancementResult | null;
  enhancing: boolean;
  enhanceError: string | null;
  runEnhancement: (
    item: InventoryItem,
    existingItems?: Array<{ name: string; sku: string; category: string; subcategory?: string }>
  ) => Promise<void>;
  clearEnhancement: () => void;

  // Audit
  auditResult: InventoryAuditResult | null;
  auditing: boolean;
  auditProgress: AuditBatchProgress | null;
  auditError: string | null;
  runAudit: (items: InventoryItem[], options?: AuditOptions) => Promise<void>;
  loadSavedAudit: () => Promise<void>;
  clearAudit: () => void;

  // Duplicate Resolution
  merging: boolean;
  mergeError: string | null;
  mergeResult: DuplicateMergeResult | null;
  runMerge: (request: DuplicateMergeRequest) => Promise<void>;
  clearMerge: () => void;

  // Batch Corrections
  corrections: CorrectionReviewItem[];
  applyingCorrections: boolean;
  correctionError: string | null;
  correctionResult: ApplyCorrectionsResponse | null;
  setCorrectionStatus: (correctionId: string, status: CorrectionReviewItem['status']) => void;
  acceptAllCorrections: () => void;
  rejectAllCorrections: () => void;
  runApplyCorrections: () => Promise<void>;
  clearCorrections: () => void;

  // Post-improvement cleanup
  removeIssuesForItems: (itemIds: string[]) => void;

  // Agent Instructions
  agentInstructions: AgentInstructions | null;
  instructionsLoading: boolean;
  instructionsSaving: boolean;
  instructionsError: string | null;
  savedInstructionsId: string | null;
  loadInstructions: (subsidiaryId?: string) => Promise<void>;
  updateInstructions: (instructions: AgentInstructions) => void;
  saveInstructions: (userId: string, profileName?: string) => Promise<void>;
}

export function useInventoryAI(): UseInventoryAIResult {
  // Enhancement state
  const [enhancement, setEnhancement] = useState<EnhancementResult | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  // Audit state
  const [auditResult, setAuditResult] = useState<InventoryAuditResult | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [auditProgress, setAuditProgress] = useState<AuditBatchProgress | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Duplicate merge state
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [mergeResult, setMergeResult] = useState<DuplicateMergeResult | null>(null);

  // Corrections state
  const [corrections, setCorrections] = useState<CorrectionReviewItem[]>([]);
  const [applyingCorrections, setApplyingCorrections] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionResult, setCorrectionResult] = useState<ApplyCorrectionsResponse | null>(null);

  // Agent instructions state
  const [agentInstructions, setAgentInstructions] = useState<AgentInstructions | null>(null);
  const [instructionsLoading, setInstructionsLoading] = useState(false);
  const [instructionsSaving, setInstructionsSaving] = useState(false);
  const [instructionsError, setInstructionsError] = useState<string | null>(null);
  const [savedInstructionsId, setSavedInstructionsId] = useState<string | null>(null);

  // ---- Enhancement ----

  const runEnhancement = useCallback(
    async (
      item: InventoryItem,
      existingItems?: Array<{ name: string; sku: string; category: string; subcategory?: string }>
    ) => {
      setEnhancing(true);
      setEnhanceError(null);
      setEnhancement(null);
      try {
        const result = await enhanceInventoryItemAI(item, existingItems);
        setEnhancement(result);
      } catch (err) {
        setEnhanceError((err as Error).message || 'Enhancement failed');
      } finally {
        setEnhancing(false);
      }
    },
    []
  );

  const clearEnhancement = useCallback(() => {
    setEnhancement(null);
    setEnhanceError(null);
  }, []);

  // ---- Audit ----

  const runAudit = useCallback(
    async (items: InventoryItem[], options?: AuditOptions) => {
      setAuditing(true);
      setAuditError(null);
      setAuditResult(null);
      setAuditProgress(null);
      setCorrections([]);
      setCorrectionResult(null);
      try {
        const mergedOptions: AuditOptions = {
          ...options,
          ...(agentInstructions ? { agentInstructions } : {}),
          onProgress: (progress) => setAuditProgress(progress),
        };
        const result = await auditInventoryHealthAI(items, mergedOptions);
        setAuditResult(result);

        // Populate correction review items from audit result
        if (result.corrections && result.corrections.length > 0) {
          setCorrections(
            result.corrections.map((c: CorrectionAction) => ({
              ...c,
              status: c.confidence >= 0.85 ? 'accepted' as const : 'pending' as const,
            }))
          );
        }
      } catch (err) {
        setAuditError((err as Error).message || 'Audit failed');
      } finally {
        setAuditing(false);
        setAuditProgress(null);
      }
    },
    [agentInstructions]
  );

  const loadSavedAudit = useCallback(async () => {
    try {
      const saved = await loadLastAuditResult();
      if (saved) {
        setAuditResult(saved);
        if (saved.corrections && saved.corrections.length > 0) {
          setCorrections(
            saved.corrections.map((c: CorrectionAction) => ({
              ...c,
              status: c.confidence >= 0.85 ? 'accepted' as const : 'pending' as const,
            }))
          );
        }
      }
    } catch (err) {
      console.warn('Failed to load saved audit results:', err);
    }
  }, []);

  const clearAudit = useCallback(() => {
    setAuditResult(null);
    setAuditError(null);
    setCorrections([]);
    setCorrectionResult(null);
  }, []);

  // ---- Duplicate Merge ----

  const runMerge = useCallback(async (request: DuplicateMergeRequest) => {
    setMerging(true);
    setMergeError(null);
    setMergeResult(null);
    try {
      const result = await mergeDuplicateItems(request);
      setMergeResult(result);
    } catch (err) {
      setMergeError((err as Error).message || 'Merge failed');
    } finally {
      setMerging(false);
    }
  }, []);

  const clearMerge = useCallback(() => {
    setMergeResult(null);
    setMergeError(null);
  }, []);

  // ---- Corrections ----

  const setCorrectionStatus = useCallback(
    (correctionId: string, status: CorrectionReviewItem['status']) => {
      setCorrections(prev =>
        prev.map(c => (c.id === correctionId ? { ...c, status } : c))
      );
    },
    []
  );

  const acceptAllCorrections = useCallback(() => {
    setCorrections(prev => prev.map(c => ({ ...c, status: 'accepted' as const })));
  }, []);

  const rejectAllCorrections = useCallback(() => {
    setCorrections(prev => prev.map(c => ({ ...c, status: 'rejected' as const })));
  }, []);

  const runApplyCorrections = useCallback(async () => {
    const toApply = corrections.filter(c => c.status === 'accepted');
    if (toApply.length === 0) return;

    setApplyingCorrections(true);
    setCorrectionError(null);
    setCorrectionResult(null);
    try {
      const result = await applyInventoryCorrections({
        corrections: toApply.map(c => ({
          id: c.id,
          itemId: c.itemId,
          field: c.field,
          newValue: c.suggestedValue,
        })),
      });
      setCorrectionResult(result);
      // Mark applied corrections
      setCorrections(prev =>
        prev.map(c => {
          if (c.status === 'accepted') {
            const failed = result.failures.some(f => f.id === c.id);
            return { ...c, status: failed ? 'pending' : 'applied' };
          }
          return c;
        })
      );
    } catch (err) {
      setCorrectionError((err as Error).message || 'Failed to apply corrections');
    } finally {
      setApplyingCorrections(false);
    }
  }, [corrections]);

  const clearCorrections = useCallback(() => {
    setCorrections([]);
    setCorrectionError(null);
    setCorrectionResult(null);
  }, []);

  // ---- Post-improvement cleanup ----

  const removeIssuesForItems = useCallback((itemIds: string[]) => {
    const idSet = new Set(itemIds);
    setAuditResult(prev => {
      if (!prev) return prev;
      const filteredIssues = prev.issues.filter(i => !idSet.has(i.itemId));
      const filteredCorrections = prev.corrections.filter(c => !idSet.has(c.itemId));
      const filteredDuplicates = (prev.duplicateGroups || []).filter(
        g => !idSet.has(g.primaryItemId) && !g.candidates.some(c => idSet.has(c.itemId))
      );
      const updated: InventoryAuditResult = {
        ...prev,
        issues: filteredIssues,
        corrections: filteredCorrections,
        duplicateGroups: filteredDuplicates,
        summary: {
          ...prev.summary,
          itemsWithIssues: new Set(filteredIssues.map(i => i.itemId)).size,
          criticalCount: filteredIssues.filter(i => i.severity === 'critical').length,
          warningCount: filteredIssues.filter(i => i.severity === 'warning').length,
          infoCount: filteredIssues.filter(i => i.severity === 'info').length,
          duplicateGroupCount: filteredDuplicates.length,
          correctableCount: filteredCorrections.length,
        },
      };
      // Persist updated result to Firestore
      saveAuditResult(updated).catch(err =>
        console.warn('Failed to persist updated audit result:', err)
      );
      return updated;
    });
    // Also remove from corrections review
    setCorrections(prev => prev.filter(c => !idSet.has(c.itemId)));
  }, []);

  // ---- Agent Instructions ----

  const loadInstructions = useCallback(async (subsidiaryId?: string) => {
    setInstructionsLoading(true);
    setInstructionsError(null);
    try {
      const saved = await loadAgentInstructions(subsidiaryId);
      if (saved) {
        setAgentInstructions(saved.instructions);
        setSavedInstructionsId(saved.id);
      }
    } catch (err) {
      setInstructionsError((err as Error).message || 'Failed to load instructions');
    } finally {
      setInstructionsLoading(false);
    }
  }, []);

  const updateInstructions = useCallback((instructions: AgentInstructions) => {
    setAgentInstructions(instructions);
  }, []);

  const saveInstructions = useCallback(
    async (userId: string, profileName?: string) => {
      if (!agentInstructions) return;
      setInstructionsSaving(true);
      setInstructionsError(null);
      try {
        const id = await saveAgentInstructions(
          agentInstructions,
          userId,
          profileName,
          savedInstructionsId || undefined
        );
        setSavedInstructionsId(id);
      } catch (err) {
        setInstructionsError((err as Error).message || 'Failed to save instructions');
      } finally {
        setInstructionsSaving(false);
      }
    },
    [agentInstructions, savedInstructionsId]
  );

  return {
    // Enhancement
    enhancement,
    enhancing,
    enhanceError,
    runEnhancement,
    clearEnhancement,
    // Audit
    auditResult,
    auditing,
    auditProgress,
    auditError,
    runAudit,
    loadSavedAudit,
    clearAudit,
    // Duplicate merge
    merging,
    mergeError,
    mergeResult,
    runMerge,
    clearMerge,
    // Corrections
    corrections,
    applyingCorrections,
    correctionError,
    correctionResult,
    setCorrectionStatus,
    acceptAllCorrections,
    rejectAllCorrections,
    runApplyCorrections,
    clearCorrections,
    // Post-improvement cleanup
    removeIssuesForItems,
    // Agent instructions
    agentInstructions,
    instructionsLoading,
    instructionsSaving,
    instructionsError,
    savedInstructionsId,
    loadInstructions,
    updateInstructions,
    saveInstructions,
  };
}
