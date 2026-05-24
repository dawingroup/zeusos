// ============================================================================
// SCENARIO ANALYSIS PAGE
// What-if scenario builder with before/after comparison and AI analysis
// ============================================================================

import { useState, useCallback } from 'react';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  TrendingUp,
  Plus,
  Trash2,
  Loader2,
  AlertTriangle,
  ArrowRight,
  Brain,
} from 'lucide-react';
import { useCFOBriefing } from '../hooks/useCFOBriefing';
import type { ScenarioInput, ScenarioResult } from '../types/optimizer.types';
import { useAuth } from '@/shared/hooks/useAuth';

function formatUGX(value: number): string {
  return `UGX ${Math.abs(value).toLocaleString('en-UG')}`;
}

const MODIFICATION_TYPES = [
  { value: 'delay_payment', label: 'Delay Payment' },
  { value: 'late_receipt', label: 'Late Receipt' },
  { value: 'cash_injection', label: 'Cash Injection' },
  { value: 'cost_increase', label: 'Cost Increase' },
] as const;

type ModificationType = typeof MODIFICATION_TYPES[number]['value'];

interface ModificationEntry {
  id: string;
  type: ModificationType;
  amount: string;
  description: string;
}

export function ScenarioAnalysisPage() {
  useAuth();
  const companyId = 'dawinos'; // From company context

  const {
    scenarioResults,
    isGenerating,
    error,
    runScenario,
  } = useCFOBriefing({ companyId });

  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [modifications, setModifications] = useState<ModificationEntry[]>([
    { id: '1', type: 'delay_payment', amount: '', description: '' },
  ]);
  const [latestResult, setLatestResult] = useState<ScenarioResult | null>(null);

  const addModification = () => {
    setModifications(prev => [
      ...prev,
      { id: Date.now().toString(), type: 'delay_payment', amount: '', description: '' },
    ]);
  };

  const removeModification = (id: string) => {
    setModifications(prev => prev.filter(m => m.id !== id));
  };

  const updateModification = (id: string, field: keyof ModificationEntry, value: string) => {
    setModifications(prev => prev.map(m =>
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  const handleRunScenario = useCallback(async () => {
    if (!scenarioName.trim()) return;

    const scenario: ScenarioInput = {
      name: scenarioName.trim(),
      description: scenarioDescription.trim(),
      modifications: modifications
        .filter(m => m.amount)
        .map(m => ({
          type: m.type,
          amount: parseFloat(m.amount) || 0,
          description: m.description,
        })),
    };

    try {
      const result = await runScenario(scenario);
      setLatestResult(result);
    } catch {
      // Error already handled by hook
    }
  }, [scenarioName, scenarioDescription, modifications, runScenario]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-violet-600" />
          <h2 className="text-xl font-bold text-foreground">Scenario Analysis</h2>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[var(--rag-red-soft)] text-[var(--rag-red)] rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scenario Builder */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Build Scenario</h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Scenario Name</label>
              <Input
                placeholder="e.g. Delay Q2 supplier payments"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
              <Input
                placeholder="What-if we delay payments by 2 weeks..."
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <label className="text-xs text-muted-foreground mb-2 block">Modifications</label>
              <div className="space-y-2">
                {modifications.map((mod) => (
                  <div key={mod.id} className="flex items-center gap-2">
                    <select
                      value={mod.type}
                      onChange={(e) => updateModification(mod.id, 'type', e.target.value)}
                      className="h-9 px-2 border border-[var(--border-subtle)] rounded-md text-sm flex-shrink-0"
                    >
                      {MODIFICATION_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      placeholder="Amount (UGX)"
                      value={mod.amount}
                      onChange={(e) => updateModification(mod.id, 'amount', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Note"
                      value={mod.description}
                      onChange={(e) => updateModification(mod.id, 'description', e.target.value)}
                      className="flex-1"
                    />
                    {modifications.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeModification(mod.id)}
                        className="text-[var(--fg-tertiary)] hover:text-[var(--rag-red)]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={addModification}
                className="text-xs mt-2"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Modification
              </Button>
            </div>

            <Button
              className="w-full mt-4 bg-violet-600 hover:bg-violet-700 text-white"
              onClick={handleRunScenario}
              disabled={isGenerating || !scenarioName.trim()}
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Brain className="w-4 h-4 mr-1.5" />
              )}
              Run Scenario Analysis
            </Button>
          </div>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {latestResult ? (
            <>
              {/* Impact Summary */}
              <Card className={`p-5 border-l-4 ${
                latestResult.analysis?.impact === 'positive' ? 'border-l-green-500'
                  : latestResult.analysis?.impact === 'negative' ? 'border-l-red-500'
                    : 'border-l-gray-300'
              }`}>
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Impact: {latestResult.analysis?.impact?.toUpperCase() || 'Unknown'}
                </h3>
                <p className="text-sm text-muted-foreground">{latestResult.analysis?.impactSummary}</p>

                {/* Before/After */}
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="p-3 bg-[var(--bg-sunken)] rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Baseline Cash</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatUGX(latestResult.baseline?.cashPosition || 0)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    (latestResult.modified?.cashPosition || 0) > (latestResult.baseline?.cashPosition || 0)
                      ? 'bg-[var(--rag-green-soft)]' : 'bg-[var(--rag-red-soft)]'
                  }`}>
                    <p className="text-xs text-muted-foreground mb-1">Scenario Cash</p>
                    <p className={`text-lg font-bold ${
                      (latestResult.modified?.cashPosition || 0) > (latestResult.baseline?.cashPosition || 0)
                        ? 'text-[var(--rag-green)]' : 'text-[var(--rag-red)]'
                    }`}>
                      {formatUGX(latestResult.modified?.cashPosition || 0)}
                    </p>
                  </div>
                </div>
              </Card>

              {/* AI Insights */}
              {(latestResult.analysis?.keyInsights?.length ?? 0) > 0 && (
                <Card className="p-5">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Key Insights</h4>
                  <div className="space-y-1.5">
                    {latestResult.analysis!.keyInsights.map((insight: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-indigo-500 shrink-0" />
                        <span className="text-muted-foreground">{insight}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Recommendations */}
              {(latestResult.analysis?.recommendations?.length ?? 0) > 0 && (
                <Card className="p-5">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Recommendations</h4>
                  <div className="space-y-1.5">
                    {latestResult.analysis!.recommendations.map((rec: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-[var(--rag-green)]">
                        <span className="shrink-0">&#x2022;</span>
                        <span>{rec}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Tradeoffs */}
              {(latestResult.analysis?.tradeoffs?.length ?? 0) > 0 && (
                <Card className="p-5">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Tradeoffs</h4>
                  <div className="space-y-1.5">
                    {latestResult.analysis!.tradeoffs.map((t: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-[var(--rag-amber)]">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <TrendingUp className="w-10 h-10 text-[var(--fg-tertiary)] mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Build a scenario and run the analysis</p>
              <p className="text-xs text-[var(--fg-tertiary)] mt-1">
                Claude will analyze the impact on your cash flow
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Previous Scenarios */}
      {scenarioResults.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Previous Scenarios</h3>
          <div className="space-y-2">
            {scenarioResults.map((result, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0 cursor-pointer hover:bg-[var(--bg-sunken)] -mx-2 px-2 rounded"
                onClick={() => setLatestResult(result)}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  result.analysis?.impact === 'positive' ? 'bg-[var(--rag-green)]'
                    : result.analysis?.impact === 'negative' ? 'bg-[var(--rag-red)]'
                      : 'bg-[var(--bg-sunken)]'
                }`} />
                <span className="text-sm font-medium text-foreground flex-1 truncate">
                  {result.scenarioName}
                </span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  result.analysis?.riskAssessment === 'critical' ? 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]'
                    : result.analysis?.riskAssessment === 'high' ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]'
                      : result.analysis?.riskAssessment === 'medium' ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]'
                        : 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]'
                }`}>
                  {result.analysis?.riskAssessment || 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default ScenarioAnalysisPage;
