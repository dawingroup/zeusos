// ============================================================================
// SWOT ANALYSIS SECTION COMPONENT
// DawinOS v2.0 - CEO Strategy Command
// Interactive 4-quadrant SWOT analysis with AI suggestions
// ============================================================================

import React, { useState, useCallback } from 'react';
import { Plus, X, Sparkles, AlertTriangle, Shield, TrendingUp, Target } from 'lucide-react';
import type { SWOTAnalysis, SWOTItem } from '../../types/strategy.types';
import { SWOT_COLORS, SWOT_LABELS } from '../../constants/strategyReview.constants';

export interface SWOTAnalysisSectionProps {
  data: SWOTAnalysis;
  onChange: (data: SWOTAnalysis) => void;
  onRequestAI?: () => void;
  isAILoading?: boolean;
  readOnly?: boolean;
}

const QUADRANT_ICONS = {
  strengths: Shield,
  weaknesses: AlertTriangle,
  opportunities: TrendingUp,
  threats: Target,
};

type QuadrantKey = keyof SWOTAnalysis;

const generateId = () => crypto.randomUUID().slice(0, 8);

export const SWOTAnalysisSection: React.FC<SWOTAnalysisSectionProps> = ({
  data,
  onChange,
  onRequestAI,
  isAILoading = false,
  readOnly = false,
}) => {
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});

  const handleAddItem = useCallback((quadrant: QuadrantKey) => {
    const text = newItemText[quadrant]?.trim();
    if (!text) return;

    const newItem: SWOTItem = {
      id: generateId(),
      text,
      impact: 'medium',
      aiSuggested: false,
    };

    const updated = { ...data };
    updated[quadrant] = [...(updated[quadrant] || []), newItem];
    onChange(updated);
    setNewItemText(prev => ({ ...prev, [quadrant]: '' }));
  }, [data, onChange, newItemText]);

  const handleRemoveItem = useCallback((quadrant: QuadrantKey, itemId: string) => {
    const updated = { ...data };
    updated[quadrant] = updated[quadrant].filter(item => item.id !== itemId);
    onChange(updated);
  }, [data, onChange]);

  const handleUpdateImpact = useCallback((quadrant: QuadrantKey, itemId: string, impact: 'high' | 'medium' | 'low') => {
    const updated = { ...data };
    updated[quadrant] = updated[quadrant].map(item =>
      item.id === itemId ? { ...item, impact } : item
    );
    onChange(updated);
  }, [data, onChange]);

  const totalItems = Object.values(data).reduce((sum, items) => sum + (items?.length || 0), 0);

  const renderQuadrant = (quadrant: QuadrantKey) => {
    const items = data[quadrant] || [];
    const label = SWOT_LABELS[quadrant];
    const colorClass = SWOT_COLORS[quadrant];
    const Icon = QUADRANT_ICONS[quadrant];
    const text = newItemText[quadrant] || '';

    return (
      <div className={`border-2 rounded-lg p-4 min-h-[200px] flex flex-col ${colorClass}`}>
        {/* Quadrant Header */}
        <div className="flex items-center gap-2 mb-3">
          <Icon className="w-5 h-5" />
          <h4 className="font-semibold text-sm">{label}</h4>
          <span className="text-xs opacity-70">({items.length})</span>
        </div>

        {/* Items */}
        <div className="flex-1 space-y-2 mb-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`group flex items-start gap-2 p-2 rounded-md bg-white/60 border ${
                item.aiSuggested ? 'border-purple-300' : 'border-transparent'
              }`}
            >
              <div className="flex-1">
                <p className="text-sm leading-tight">{item.text}</p>
                {item.actionRequired && (
                  <p className="text-xs mt-1 opacity-70">Action: {item.actionRequired}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {item.aiSuggested && <Sparkles className="w-3 h-3 text-purple-500" />}
                {!readOnly && (
                  <select
                    value={item.impact}
                    onChange={(e) => handleUpdateImpact(quadrant, item.id, e.target.value as 'high' | 'medium' | 'low')}
                    className="text-xs border-none bg-transparent focus:ring-0 p-0 pr-5"
                  >
                    <option value="high">High</option>
                    <option value="medium">Med</option>
                    <option value="low">Low</option>
                  </select>
                )}
                {!readOnly && (
                  <button
                    onClick={() => handleRemoveItem(quadrant, item.id)}
                    className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-xs italic opacity-50 text-center py-4">No items added yet</p>
          )}
        </div>

        {/* Add Item */}
        {!readOnly && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={text}
              onChange={(e) => setNewItemText(prev => ({ ...prev, [quadrant]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && handleAddItem(quadrant)}
              placeholder={`Add ${label.toLowerCase()}...`}
              className="flex-1 text-sm border border-gray-300 rounded px-2.5 py-1.5 bg-white/80 focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
            />
            <button
              onClick={() => handleAddItem(quadrant)}
              disabled={!text.trim()}
              className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 bg-white/60 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">SWOT Analysis</h3>
          <p className="text-sm text-gray-500">{totalItems} items identified</p>
        </div>
        {onRequestAI && (
          <button
            onClick={onRequestAI}
            disabled={isAILoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {isAILoading ? 'Analyzing...' : 'AI Analysis'}
          </button>
        )}
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderQuadrant('strengths')}
        {renderQuadrant('weaknesses')}
        {renderQuadrant('opportunities')}
        {renderQuadrant('threats')}
      </div>
    </div>
  );
};

export default SWOTAnalysisSection;
