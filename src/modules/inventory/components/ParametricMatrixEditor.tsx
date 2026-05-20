/**
 * ParametricMatrixEditor Component
 *
 * Admin UI for managing parametric selection rules.
 * Rules define automatic item/kit selection based on project and design-item variables.
 *
 * Features:
 * - List all rules with conditions and result items
 * - Create / edit / delete rules
 * - Priority ordering (lower = higher priority)
 * - Test rules against sample variables
 * - Toggle active/inactive
 */

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Zap,
  TestTube2,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import type { ParametricRule, ParametricCondition, ParametricOperator } from '../types/parametricMatrix';
import {
  PARAMETRIC_VARIABLE_LABELS,
  PARAMETRIC_VARIABLE_OPTIONS,
  PARAMETRIC_VARIABLES,
} from '../types/parametricMatrix';
import {
  getAllParametricRules,
  createParametricRule,
  updateParametricRule,
  deleteParametricRule,
  previewParametricResolution,
} from '../services/parametricMatrixService';
import type { ParametricRuleInput, ParametricSelectionResult } from '../services/parametricMatrixService';

// ============================================
// Sub-components
// ============================================

interface ConditionEditorProps {
  condition: ParametricCondition;
  index: number;
  onChange: (index: number, condition: ParametricCondition) => void;
  onRemove: (index: number) => void;
}

function ConditionEditor({ condition, index, onChange, onRemove }: ConditionEditorProps) {
  const variableOptions = PARAMETRIC_VARIABLE_OPTIONS[condition.variable] ?? [];

  return (
    <div className="flex items-center gap-2 text-sm">
      <GripVertical className="w-4 h-4 text-gray-400 shrink-0" />

      {/* Variable */}
      <select
        value={condition.variable}
        onChange={(e) => onChange(index, { ...condition, variable: e.target.value })}
        className="border rounded px-2 py-1 bg-white text-sm min-w-[140px]"
      >
        <option value="">Select variable...</option>
        {PARAMETRIC_VARIABLES.map((v) => (
          <option key={v} value={v}>{PARAMETRIC_VARIABLE_LABELS[v] ?? v}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onChange(index, { ...condition, operator: e.target.value as ParametricOperator })}
        className="border rounded px-2 py-1 bg-white text-sm w-[100px]"
      >
        <option value="equals">equals</option>
        <option value="not_equals">not equals</option>
        <option value="in">in</option>
      </select>

      {/* Value */}
      {variableOptions.length > 0 ? (
        condition.operator === 'in' ? (
          <select
            multiple
            value={Array.isArray(condition.value) ? condition.value : [condition.value]}
            onChange={(e) => {
              const selected = Array.from(e.target.selectedOptions, o => o.value);
              onChange(index, { ...condition, value: selected });
            }}
            className="border rounded px-2 py-1 bg-white text-sm min-w-[140px] h-16"
          >
            {variableOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ) : (
          <select
            value={typeof condition.value === 'string' ? condition.value : ''}
            onChange={(e) => onChange(index, { ...condition, value: e.target.value })}
            className="border rounded px-2 py-1 bg-white text-sm min-w-[140px]"
          >
            <option value="">Select value...</option>
            {variableOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )
      ) : (
        <input
          type="text"
          value={typeof condition.value === 'string' ? condition.value : (condition.value ?? []).join(', ')}
          onChange={(e) => {
            const val = condition.operator === 'in'
              ? e.target.value.split(',').map(s => s.trim())
              : e.target.value;
            onChange(index, { ...condition, value: val });
          }}
          placeholder={condition.operator === 'in' ? 'val1, val2, ...' : 'Value'}
          className="border rounded px-2 py-1 text-sm min-w-[140px]"
        />
      )}

      <button
        onClick={() => onRemove(index)}
        className="text-red-400 hover:text-red-600 p-1"
        title="Remove condition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============================================
// Rule Form (Create / Edit)
// ============================================

interface RuleFormProps {
  initial?: Partial<ParametricRuleInput>;
  onSave: (data: ParametricRuleInput) => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
}

function RuleForm({ initial, onSave, onCancel, isSaving }: RuleFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [conditions, setConditions] = useState<ParametricCondition[]>(
    initial?.conditions ?? [{ variable: '', operator: 'equals', value: '' }],
  );
  const [resultItemId, setResultItemId] = useState(initial?.resultItemId ?? '');
  const [resultSku, setResultSku] = useState(initial?.resultSku ?? '');
  const [resultName, setResultName] = useState(initial?.resultName ?? '');
  const [resultQty, setResultQty] = useState(initial?.resultQuantityPerUnit ?? 1);
  const [priority, setPriority] = useState(initial?.priority ?? 100);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const handleConditionChange = (index: number, condition: ParametricCondition) => {
    const updated = [...conditions];
    updated[index] = condition;
    setConditions(updated);
  };

  const handleConditionRemove = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addCondition = () => {
    setConditions([...conditions, { variable: '', operator: 'equals', value: '' }]);
  };

  const handleSubmit = async () => {
    const validConditions = conditions.filter(c => c.variable && c.value);
    if (!name || validConditions.length === 0 || !resultItemId) return;

    await onSave({
      name,
      description: description || undefined,
      conditions: validConditions,
      resultItemId,
      resultSku,
      resultName,
      resultQuantityPerUnit: resultQty,
      priority,
      isActive,
    });
  };

  return (
    <div className="border rounded-lg p-4 bg-indigo-50 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Rule Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Inset Hinge - Premium"
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Priority (lower = higher)</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full border rounded px-3 py-1.5 text-sm"
            min={1}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="When should this rule fire?"
          className="w-full border rounded px-3 py-1.5 text-sm"
        />
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-600">Conditions (ALL must match)</label>
          <button onClick={addCondition} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add Condition
          </button>
        </div>
        <div className="space-y-2">
          {conditions.map((c, i) => (
            <ConditionEditor
              key={i}
              condition={c}
              index={i}
              onChange={handleConditionChange}
              onRemove={handleConditionRemove}
            />
          ))}
        </div>
      </div>

      {/* Result */}
      <div className="border-t pt-3">
        <label className="text-xs font-medium text-gray-600 mb-2 block">Result (selected item/kit)</label>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Item ID *</label>
            <input
              type="text"
              value={resultItemId}
              onChange={(e) => setResultItemId(e.target.value)}
              placeholder="Firestore doc ID"
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">SKU</label>
            <input
              type="text"
              value={resultSku}
              onChange={(e) => setResultSku(e.target.value)}
              placeholder="e.g., KIT-HNG-INS-PRM"
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Display Name</label>
            <input
              type="text"
              value={resultName}
              onChange={(e) => setResultName(e.target.value)}
              placeholder="e.g., Inset Hinge Kit Premium"
              className="w-full border rounded px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Qty per Unit</label>
            <input
              type="number"
              value={resultQty}
              onChange={(e) => setResultQty(Number(e.target.value))}
              className="w-full border rounded px-2 py-1.5 text-sm"
              min={1}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Active
            </label>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving || !name || !resultItemId || conditions.filter(c => c.variable).length === 0}
          className="px-4 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Rule
        </button>
      </div>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

interface ParametricMatrixEditorProps {
  userId: string;
  subsidiaryId?: string;
}

export function ParametricMatrixEditor({ userId, subsidiaryId }: ParametricMatrixEditorProps) {
  const [rules, setRules] = useState<ParametricRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  // Test panel state
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const [testResults, setTestResults] = useState<{ matched: ParametricSelectionResult[]; unmatched: ParametricRule[] } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    setLoading(true);
    try {
      const data = await getAllParametricRules();
      setRules(data);
    } catch (err) {
      console.error('Failed to load parametric rules:', err);
    } finally {
      setLoading(false);
    }
  }

  const toggleExpanded = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const handleCreate = async (data: ParametricRuleInput) => {
    setIsSaving(true);
    try {
      await createParametricRule({ ...data, subsidiaryId }, userId);
      setShowCreateForm(false);
      await loadRules();
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (ruleId: string, data: ParametricRuleInput) => {
    setIsSaving(true);
    try {
      await updateParametricRule(ruleId, data);
      setEditingRuleId(null);
      await loadRules();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this parametric rule?')) return;
    await deleteParametricRule(ruleId);
    await loadRules();
  };

  const handleToggleActive = async (rule: ParametricRule) => {
    await updateParametricRule(rule.id, { isActive: !rule.isActive });
    await loadRules();
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const results = await previewParametricResolution(testVariables);
      setTestResults(results);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading parametric rules...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Parametric Selection Matrix</h3>
          <span className="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
            {rules.length} rule{rules.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTestPanel(!showTestPanel)}
            className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50 flex items-center gap-1"
          >
            <TestTube2 className="w-4 h-4" /> Test
          </button>
          <button
            onClick={() => { setShowCreateForm(true); setEditingRuleId(null); }}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Add Rule
          </button>
        </div>
      </div>

      {/* Test Panel */}
      {showTestPanel && (
        <div className="border rounded-lg p-4 bg-amber-50 space-y-3">
          <h4 className="text-sm font-medium text-amber-800 flex items-center gap-1">
            <TestTube2 className="w-4 h-4" /> Rule Tester
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {PARAMETRIC_VARIABLES.map((v) => (
              <div key={v}>
                <label className="block text-xs text-gray-600 mb-1">{PARAMETRIC_VARIABLE_LABELS[v]}</label>
                {PARAMETRIC_VARIABLE_OPTIONS[v] ? (
                  <select
                    value={testVariables[v] ?? ''}
                    onChange={(e) => setTestVariables({ ...testVariables, [v]: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm bg-white"
                  >
                    <option value="">(not set)</option>
                    {PARAMETRIC_VARIABLE_OPTIONS[v].map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={testVariables[v] ?? ''}
                    onChange={(e) => setTestVariables({ ...testVariables, [v]: e.target.value })}
                    className="w-full border rounded px-2 py-1 text-sm"
                    placeholder="Value..."
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50 flex items-center gap-1"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Run Test
            </button>
            {testResults && (
              <span className="text-sm text-gray-600">
                {testResults.matched.length} matched, {testResults.unmatched.length} unmatched
              </span>
            )}
          </div>
          {testResults && testResults.matched.length > 0 && (
            <div className="space-y-1">
              {testResults.matched.map((m) => (
                <div key={m.ruleId} className="flex items-center gap-2 text-sm bg-green-100 rounded px-3 py-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium">{m.ruleName}</span>
                  <span className="text-gray-500">→</span>
                  <span className="text-green-700">{m.resultName}</span>
                  <span className="text-gray-400 text-xs">({m.resultSku})</span>
                </div>
              ))}
            </div>
          )}
          {testResults && testResults.matched.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-100 rounded px-3 py-1.5">
              <AlertCircle className="w-4 h-4" /> No rules matched the given variables
            </div>
          )}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <RuleForm
          onSave={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          isSaving={isSaving}
        />
      )}

      {/* Rules List */}
      {rules.length === 0 && !showCreateForm ? (
        <div className="text-center py-8 text-gray-400">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No parametric rules yet.</p>
          <p className="text-xs mt-1">Add rules to auto-select hardware items/kits based on project settings.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`border rounded-lg ${rule.isActive ? 'bg-white' : 'bg-gray-50 opacity-70'}`}
            >
              {editingRuleId === rule.id ? (
                <div className="p-2">
                  <RuleForm
                    initial={{
                      name: rule.name,
                      description: rule.description,
                      conditions: rule.conditions,
                      resultItemId: rule.resultItemId,
                      resultSku: rule.resultSku,
                      resultName: rule.resultName,
                      resultQuantityPerUnit: rule.resultQuantityPerUnit,
                      priority: rule.priority,
                      isActive: rule.isActive,
                    }}
                    onSave={(data) => handleUpdate(rule.id, data)}
                    onCancel={() => setEditingRuleId(null)}
                    isSaving={isSaving}
                  />
                </div>
              ) : (
                <>
                  {/* Rule header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => toggleExpanded(rule.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 w-8 text-center">
                        {rule.priority}
                      </span>
                      <span className="font-medium text-sm text-gray-900">{rule.name}</span>
                      <span className="text-xs text-gray-400">→</span>
                      <span className="text-sm text-indigo-600">{rule.resultName || rule.resultSku}</span>
                      {!rule.isActive && (
                        <span className="text-xs bg-gray-200 text-gray-500 rounded-full px-2 py-0.5">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {expandedRules.has(rule.id) ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Rule details (expanded) */}
                  {expandedRules.has(rule.id) && (
                    <div className="px-4 pb-3 border-t space-y-3">
                      {rule.description && (
                        <p className="text-xs text-gray-500 pt-2">{rule.description}</p>
                      )}

                      {/* Conditions */}
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase">Conditions</span>
                        <div className="mt-1 space-y-1">
                          {rule.conditions.map((c, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600 font-medium">
                                {PARAMETRIC_VARIABLE_LABELS[c.variable] ?? c.variable}
                              </span>
                              <span className="text-gray-400">{c.operator.replace('_', ' ')}</span>
                              <span className="text-indigo-700 font-mono text-xs bg-indigo-50 rounded px-1.5 py-0.5">
                                {Array.isArray(c.value) ? c.value.join(', ') : c.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Result */}
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase">Result</span>
                        <div className="text-sm mt-1">
                          <span className="text-gray-600">{rule.resultName}</span>
                          {rule.resultSku && (
                            <span className="text-xs ml-2 text-gray-400 font-mono">{rule.resultSku}</span>
                          )}
                          {(rule.resultQuantityPerUnit ?? 1) > 1 && (
                            <span className="text-xs ml-2 text-gray-400">× {rule.resultQuantityPerUnit}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1 border-t">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(rule); }}
                          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                        >
                          {rule.isActive ? (
                            <><ToggleRight className="w-4 h-4 text-green-500" /> Active</>
                          ) : (
                            <><ToggleLeft className="w-4 h-4" /> Inactive</>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingRuleId(rule.id); setShowCreateForm(false); }}
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }}
                          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
