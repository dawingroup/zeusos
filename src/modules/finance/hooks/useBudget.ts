// ============================================================================
// USE BUDGET HOOK
// DawinOS v2.0 - Financial Management Module
// Hook for individual budget management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { budgetService } from '../services/budgetService';
import { useCurrentUserId } from '@/contexts/AuthContext';
import {
  Budget,
  BudgetInput,
  BudgetUpdate,
  BudgetLineItem,
  BudgetLineInput,
  BudgetLineUpdate,
} from '../types/budget.types';

interface UseBudgetOptions {
  companyId: string;
  budgetId?: string;
  autoLoad?: boolean;
}

interface UseBudgetReturn {
  // Data
  budget: Budget | null;
  lines: BudgetLineItem[];
  
  // Loading state
  loading: boolean;
  linesLoading: boolean;
  saving: boolean;
  error: Error | null;
  
  // Budget actions
  createBudget: (input: BudgetInput) => Promise<Budget>;
  updateBudget: (update: BudgetUpdate) => Promise<Budget>;
  refresh: () => Promise<void>;
  
  // Line item actions
  addLine: (input: BudgetLineInput) => Promise<BudgetLineItem>;
  updateLine: (lineId: string, update: BudgetLineUpdate) => Promise<BudgetLineItem>;
  deleteLine: (lineId: string) => Promise<void>;
  refreshLines: () => Promise<void>;
  
  // Workflow actions
  submitForApproval: () => Promise<Budget>;
  approve: (notes?: string) => Promise<Budget>;
  reject: (notes?: string) => Promise<Budget>;
  activate: () => Promise<Budget>;
}

export function useBudget(options: UseBudgetOptions): UseBudgetReturn {
  const { companyId, budgetId, autoLoad = true } = options;
  const currentUserId = useCurrentUserId();

  const [budget, setBudget] = useState<Budget | null>(null);
  const [lines, setLines] = useState<BudgetLineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [linesLoading, setLinesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load budget
  const loadBudget = useCallback(async () => {
    if (!companyId || !budgetId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await budgetService.getBudget(companyId, budgetId);
      setBudget(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load budget'));
    } finally {
      setLoading(false);
    }
  }, [companyId, budgetId]);

  // Load lines
  const loadLines = useCallback(async () => {
    if (!companyId || !budgetId) return;
    
    setLinesLoading(true);
    
    try {
      const data = await budgetService.getBudgetLines(companyId, budgetId);
      setLines(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load budget lines'));
    } finally {
      setLinesLoading(false);
    }
  }, [companyId, budgetId]);

  useEffect(() => {
    if (autoLoad && budgetId) {
      loadBudget();
      loadLines();
    }
  }, [loadBudget, loadLines, autoLoad, budgetId]);

  // Create budget
  const createBudget = useCallback(async (input: BudgetInput): Promise<Budget> => {
    setSaving(true);
    setError(null);
    
    try {
      // userId would come from auth context in real implementation
      const userId = currentUserId;
      const newBudget = await budgetService.createBudget(companyId, input, userId);
      setBudget(newBudget);
      return newBudget;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create budget');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId]);

  // Update budget
  const updateBudget = useCallback(async (update: BudgetUpdate): Promise<Budget> => {
    if (!budgetId) throw new Error('No budget selected');
    
    setSaving(true);
    setError(null);
    
    try {
      const userId = currentUserId;
      const updated = await budgetService.updateBudget(companyId, budgetId, update, userId);
      setBudget(updated);
      return updated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update budget');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId, budgetId]);

  // Add line
  const addLine = useCallback(async (input: BudgetLineInput): Promise<BudgetLineItem> => {
    if (!budgetId) throw new Error('No budget selected');
    
    setSaving(true);
    setError(null);
    
    try {
      const userId = currentUserId;
      const newLine = await budgetService.addBudgetLine(companyId, budgetId, input, userId);
      setLines(prev => [...prev, newLine]);
      await loadBudget(); // Refresh totals
      return newLine;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add budget line');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId, budgetId, loadBudget]);

  // Update line
  const updateLine = useCallback(async (
    lineId: string,
    update: BudgetLineUpdate
  ): Promise<BudgetLineItem> => {
    setSaving(true);
    setError(null);
    
    try {
      const userId = currentUserId;
      const updated = await budgetService.updateBudgetLine(companyId, lineId, update, userId);
      setLines(prev => prev.map(l => l.id === lineId ? updated : l));
      await loadBudget(); // Refresh totals
      return updated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update budget line');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId, loadBudget]);

  // Delete line
  const deleteLine = useCallback(async (lineId: string): Promise<void> => {
    setSaving(true);
    setError(null);
    
    try {
      const userId = currentUserId;
      await budgetService.deleteBudgetLine(companyId, lineId, userId);
      setLines(prev => prev.filter(l => l.id !== lineId));
      await loadBudget(); // Refresh totals
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete budget line');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId, loadBudget]);

  // Submit for approval
  const submitForApproval = useCallback(async (): Promise<Budget> => {
    if (!budgetId) throw new Error('No budget selected');
    
    setSaving(true);
    setError(null);
    
    try {
      const userId = currentUserId;
      const updated = await budgetService.submitBudgetForApproval(companyId, budgetId, userId);
      setBudget(updated);
      return updated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit budget for approval');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId, budgetId]);

  // Approve
  const approve = useCallback(async (notes?: string): Promise<Budget> => {
    if (!budgetId) throw new Error('No budget selected');
    
    setSaving(true);
    setError(null);
    
    try {
      const userId = currentUserId;
      const updated = await budgetService.processBudgetApproval(
        companyId, budgetId, 'approve', userId, notes
      );
      setBudget(updated);
      return updated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve budget');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId, budgetId]);

  // Reject
  const reject = useCallback(async (notes?: string): Promise<Budget> => {
    if (!budgetId) throw new Error('No budget selected');
    
    setSaving(true);
    setError(null);
    
    try {
      const userId = currentUserId;
      const updated = await budgetService.processBudgetApproval(
        companyId, budgetId, 'reject', userId, notes
      );
      setBudget(updated);
      return updated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reject budget');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId, budgetId]);

  // Activate
  const activate = useCallback(async (): Promise<Budget> => {
    if (!budgetId) throw new Error('No budget selected');
    
    setSaving(true);
    setError(null);
    
    try {
      const userId = currentUserId;
      const updated = await budgetService.activateBudget(companyId, budgetId, userId);
      setBudget(updated);
      return updated;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to activate budget');
      setError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [companyId, budgetId]);

  return {
    budget,
    lines,
    
    loading,
    linesLoading,
    saving,
    error,
    
    createBudget,
    updateBudget,
    refresh: loadBudget,
    
    addLine,
    updateLine,
    deleteLine,
    refreshLines: loadLines,
    
    submitForApproval,
    approve,
    reject,
    activate,
  };
}
