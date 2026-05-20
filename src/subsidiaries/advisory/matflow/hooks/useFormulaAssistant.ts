/**
 * useFormulaAssistant
 * Hook for Claude AI-powered material formula generation
 */

import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '@/core/hooks/useAuth';
import { createFormula } from '../services/formulaService';
import { resolveAllComponents } from '../services/materialResolver';
import { updateBOQItemMaterials } from '../services/boqService';

export interface FormulaComponent {
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
  specification: string;
  reasoning: string;
}

export interface LaborComponent {
  description: string;
  skillLevel: 'skilled' | 'semi-skilled' | 'unskilled';
  hoursPerUnit: number;
}

export interface FormulaBreakdown {
  formulaName: string;
  category: string;
  components: FormulaComponent[];
  laborComponent?: LaborComponent;
  assumptions: string[];
  confidence: number;
  notes?: string;
  totalQuantities?: Array<{
    materialName: string;
    quantityPerUnit: number;
    totalQuantity: number;
    unit: string;
  }>;
}

export interface FormulaAssistantInput {
  description: string;
  specification?: string;
  unit: string;
  quantity?: number;
  existingMaterials?: string[];
}

export function useFormulaAssistant(orgId: string, projectId: string) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FormulaBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateBreakdown = useCallback(async (input: FormulaAssistantInput) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const functions = getFunctions();
      const fn = httpsCallable<FormulaAssistantInput, FormulaBreakdown>(
        functions, 'generateFormulaBreakdown'
      );
      const res = await fn(input);
      setResult(res.data);
      return res.data;
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate formula breakdown';
      setError(msg);
      console.error('Formula assistant error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveAsFormula = useCallback(async (breakdown: FormulaBreakdown): Promise<string | null> => {
    if (!user) return null;

    try {
      // Resolve (or auto-seed) each component against the materials library
      const resolved = await resolveAllComponents(
        breakdown.components,
        breakdown.category,
        user.uid,
      );

      const formulaInput = {
        code: breakdown.formulaName
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, '_')
          .toUpperCase()
          .substring(0, 20),
        name: breakdown.formulaName,
        description: breakdown.notes || `AI-generated formula: ${breakdown.formulaName}`,
        category: breakdown.category,
        outputUnit: 'nr',
        components: breakdown.components.map(c => {
          const key = c.materialName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
          const r = resolved.get(key);
          return {
            materialId: r?.materialId ?? '',
            materialName: c.materialName,
            quantity: c.quantity,
            unit: c.unit,
            wastagePercent: c.wastagePercent,
          };
        }),
        keywords: [breakdown.category, 'ai-generated'],
      };

      const formulaId = await createFormula(formulaInput as any, user.uid);
      return formulaId;
    } catch (err: any) {
      console.error('Error saving formula:', err);
      setError(err.message || 'Failed to save formula');
      return null;
    }
  }, [user]);

  const applyToItem = useCallback(async (
    boqItemId: string,
    boqQuantity: number,
    breakdown: FormulaBreakdown,
    formulaId?: string,
    formulaCode?: string,
  ) => {
    if (!user) return false;

    try {
      // Resolve (or auto-seed) materials so we have IDs and prices
      const resolved = await resolveAllComponents(
        breakdown.components,
        breakdown.category,
        user.uid,
      );

      const materialRequirements = breakdown.components.map(c => {
        const key = c.materialName.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        const r = resolved.get(key);
        const unitPrice = r?.unitPrice ?? 0;

        // Apply BOQ quantity + wastage (same as materialCalculator)
        const baseQty = c.quantity * (boqQuantity || 0);
        const withWastage = baseQty * (1 + c.wastagePercent / 100);
        const totalQty = Math.ceil(withWastage * 100) / 100;
        const totalCost = totalQty * unitPrice;

        return {
          materialId: r?.materialId ?? '',
          materialName: c.materialName,
          quantity: totalQty,
          requiredQuantity: totalQty,
          purchaseQuantity: totalQty,
          unit: c.unit,
          wastagePercent: c.wastagePercent,
          wastageIncluded: true,
          unitPrice,
          totalCost,
          specification: c.specification,
          source: 'ai-generated',
        };
      });

      await updateBOQItemMaterials(
        orgId,
        projectId,
        boqItemId,
        user.uid,
        materialRequirements,
        formulaId,
        formulaCode,
      );
      return true;
    } catch (err: any) {
      console.error('Error applying to item:', err);
      setError(err.message || 'Failed to apply formula to item');
      return false;
    }
  }, [orgId, projectId, user]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    generateBreakdown,
    saveAsFormula,
    applyToItem,
    reset,
    loading,
    result,
    error,
  };
}
