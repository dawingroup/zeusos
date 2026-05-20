// ============================================================================
// BUSINESS MODEL CANVAS COMPONENT
// DawinOS v2.0 - CEO Strategy Command
// Interactive 9-block Business Model Canvas with AI suggestions
// ============================================================================

import React, { useState, useCallback } from 'react';
import {
  Plus,
  X,
  Sparkles,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Info,
  Star,
} from 'lucide-react';
import type { BusinessModelCanvas as BMCType, CanvasItem } from '../../types/strategy.types';
import {
  BMC_BLOCKS,
  BMC_BLOCK_LABELS,
  BMC_BLOCK_DESCRIPTIONS,
  BMC_BLOCK_COLORS,
  type BMCBlockKey,
} from '../../constants/strategyReview.constants';

export interface BusinessModelCanvasProps {
  data: BMCType;
  onChange: (data: BMCType) => void;
  onRequestAI?: (blockKey: string) => void;
  isAILoading?: boolean;
  readOnly?: boolean;
}

const generateId = () => crypto.randomUUID().slice(0, 8);

export const BusinessModelCanvas: React.FC<BusinessModelCanvasProps> = ({
  data,
  onChange,
  onRequestAI,
  isAILoading = false,
  readOnly = false,
}) => {
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});

  const handleAddItem = useCallback((blockKey: BMCBlockKey) => {
    const text = newItemText[blockKey]?.trim();
    if (!text) return;

    const newItem: CanvasItem = {
      id: generateId(),
      text,
      isNew: true,
    };

    const updatedData = { ...data };
    updatedData[blockKey] = [...(updatedData[blockKey] || []), newItem];
    onChange(updatedData);
    setNewItemText(prev => ({ ...prev, [blockKey]: '' }));
  }, [data, onChange, newItemText]);

  const handleRemoveItem = useCallback((blockKey: BMCBlockKey, itemId: string) => {
    const updatedData = { ...data };
    updatedData[blockKey] = updatedData[blockKey].filter(item => item.id !== itemId);
    onChange(updatedData);
  }, [data, onChange]);

  const handleUpdateItem = useCallback((blockKey: BMCBlockKey, itemId: string, updates: Partial<CanvasItem>) => {
    const updatedData = { ...data };
    updatedData[blockKey] = updatedData[blockKey].map(item =>
      item.id === itemId ? { ...item, ...updates, isModified: true } : item
    );
    onChange(updatedData);
  }, [data, onChange]);

  const totalItems = Object.values(data).reduce((sum, items) => sum + (items?.length || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Business Model Canvas</h3>
          <p className="text-sm text-gray-500">{totalItems} items across 9 blocks</p>
        </div>
        {onRequestAI && (
          <button
            onClick={() => onRequestAI('businessModelCanvas')}
            disabled={isAILoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            {isAILoading ? 'Analyzing...' : 'AI Suggestions'}
          </button>
        )}
      </div>

      {/* Canvas Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 auto-rows-min">
        {/* Row 1-2: Main blocks */}
        {/* Key Partners */}
        <CanvasBlock
          blockKey={BMC_BLOCKS.KEY_PARTNERS}
          items={data.keyPartners || []}
          className="md:col-start-1 md:row-start-1 md:row-span-2"
          newItemText={newItemText[BMC_BLOCKS.KEY_PARTNERS] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.KEY_PARTNERS]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.KEY_PARTNERS)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.KEY_PARTNERS, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.KEY_PARTNERS, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.KEY_PARTNERS}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.KEY_PARTNERS ? null : BMC_BLOCKS.KEY_PARTNERS)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />
        {/* Key Activities */}
        <CanvasBlock
          blockKey={BMC_BLOCKS.KEY_ACTIVITIES}
          items={data.keyActivities || []}
          className="md:col-start-2 md:row-start-1"
          newItemText={newItemText[BMC_BLOCKS.KEY_ACTIVITIES] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.KEY_ACTIVITIES]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.KEY_ACTIVITIES)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.KEY_ACTIVITIES, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.KEY_ACTIVITIES, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.KEY_ACTIVITIES}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.KEY_ACTIVITIES ? null : BMC_BLOCKS.KEY_ACTIVITIES)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />
        {/* Value Propositions */}
        <CanvasBlock
          blockKey={BMC_BLOCKS.VALUE_PROPOSITIONS}
          items={data.valuePropositions || []}
          className="md:col-start-3 md:row-start-1 md:row-span-2"
          newItemText={newItemText[BMC_BLOCKS.VALUE_PROPOSITIONS] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.VALUE_PROPOSITIONS]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.VALUE_PROPOSITIONS)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.VALUE_PROPOSITIONS, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.VALUE_PROPOSITIONS, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.VALUE_PROPOSITIONS}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.VALUE_PROPOSITIONS ? null : BMC_BLOCKS.VALUE_PROPOSITIONS)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />
        {/* Customer Relationships */}
        <CanvasBlock
          blockKey={BMC_BLOCKS.CUSTOMER_RELATIONSHIPS}
          items={data.customerRelationships || []}
          className="md:col-start-4 md:row-start-1"
          newItemText={newItemText[BMC_BLOCKS.CUSTOMER_RELATIONSHIPS] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.CUSTOMER_RELATIONSHIPS]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.CUSTOMER_RELATIONSHIPS)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.CUSTOMER_RELATIONSHIPS, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.CUSTOMER_RELATIONSHIPS, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.CUSTOMER_RELATIONSHIPS}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.CUSTOMER_RELATIONSHIPS ? null : BMC_BLOCKS.CUSTOMER_RELATIONSHIPS)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />
        {/* Customer Segments */}
        <CanvasBlock
          blockKey={BMC_BLOCKS.CUSTOMER_SEGMENTS}
          items={data.customerSegments || []}
          className="md:col-start-5 md:row-start-1 md:row-span-2"
          newItemText={newItemText[BMC_BLOCKS.CUSTOMER_SEGMENTS] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.CUSTOMER_SEGMENTS]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.CUSTOMER_SEGMENTS)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.CUSTOMER_SEGMENTS, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.CUSTOMER_SEGMENTS, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.CUSTOMER_SEGMENTS}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.CUSTOMER_SEGMENTS ? null : BMC_BLOCKS.CUSTOMER_SEGMENTS)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />
        {/* Key Resources */}
        <CanvasBlock
          blockKey={BMC_BLOCKS.KEY_RESOURCES}
          items={data.keyResources || []}
          className="md:col-start-2 md:row-start-2"
          newItemText={newItemText[BMC_BLOCKS.KEY_RESOURCES] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.KEY_RESOURCES]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.KEY_RESOURCES)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.KEY_RESOURCES, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.KEY_RESOURCES, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.KEY_RESOURCES}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.KEY_RESOURCES ? null : BMC_BLOCKS.KEY_RESOURCES)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />
        {/* Channels */}
        <CanvasBlock
          blockKey={BMC_BLOCKS.CHANNELS}
          items={data.channels || []}
          className="md:col-start-4 md:row-start-2"
          newItemText={newItemText[BMC_BLOCKS.CHANNELS] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.CHANNELS]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.CHANNELS)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.CHANNELS, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.CHANNELS, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.CHANNELS}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.CHANNELS ? null : BMC_BLOCKS.CHANNELS)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />

        {/* Row 3: Cost Structure & Revenue Streams */}
        <CanvasBlock
          blockKey={BMC_BLOCKS.COST_STRUCTURE}
          items={data.costStructure || []}
          className="md:col-start-1 md:col-span-2 md:row-start-3"
          newItemText={newItemText[BMC_BLOCKS.COST_STRUCTURE] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.COST_STRUCTURE]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.COST_STRUCTURE)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.COST_STRUCTURE, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.COST_STRUCTURE, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.COST_STRUCTURE}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.COST_STRUCTURE ? null : BMC_BLOCKS.COST_STRUCTURE)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />
        <CanvasBlock
          blockKey={BMC_BLOCKS.REVENUE_STREAMS}
          items={data.revenueStreams || []}
          className="md:col-start-3 md:col-span-3 md:row-start-3"
          newItemText={newItemText[BMC_BLOCKS.REVENUE_STREAMS] || ''}
          onNewItemTextChange={(text) => setNewItemText(prev => ({ ...prev, [BMC_BLOCKS.REVENUE_STREAMS]: text }))}
          onAddItem={() => handleAddItem(BMC_BLOCKS.REVENUE_STREAMS)}
          onRemoveItem={(id) => handleRemoveItem(BMC_BLOCKS.REVENUE_STREAMS, id)}
          onUpdateItem={(id, updates) => handleUpdateItem(BMC_BLOCKS.REVENUE_STREAMS, id, updates)}
          isExpanded={expandedBlock === BMC_BLOCKS.REVENUE_STREAMS}
          onToggleExpand={() => setExpandedBlock(expandedBlock === BMC_BLOCKS.REVENUE_STREAMS ? null : BMC_BLOCKS.REVENUE_STREAMS)}
          onRequestAI={onRequestAI}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Canvas Block Sub-Component
// ----------------------------------------------------------------------------
interface CanvasBlockProps {
  blockKey: BMCBlockKey;
  items: CanvasItem[];
  className?: string;
  newItemText: string;
  onNewItemTextChange: (text: string) => void;
  onAddItem: () => void;
  onRemoveItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<CanvasItem>) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRequestAI?: (blockKey: string) => void;
  readOnly?: boolean;
}

const CanvasBlock: React.FC<CanvasBlockProps> = ({
  blockKey,
  items,
  className = '',
  newItemText,
  onNewItemTextChange,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  isExpanded,
  onToggleExpand,
  readOnly = false,
}) => {
  const label = BMC_BLOCK_LABELS[blockKey];
  const description = BMC_BLOCK_DESCRIPTIONS[blockKey];
  const colorClass = BMC_BLOCK_COLORS[blockKey];
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`border-2 rounded-lg p-3 min-h-[140px] flex flex-col ${colorClass} ${className}`}>
      {/* Block Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
            {label}
          </h4>
          <span className="text-xs text-gray-500">({items.length})</span>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <Info className="w-3 h-3" />
            </button>
            {showTooltip && (
              <div className="absolute z-50 bottom-full left-0 mb-1 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
                {description}
              </div>
            )}
          </div>
        </div>
        <button onClick={onToggleExpand} className="text-gray-500 hover:text-gray-700">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Items List */}
      <div className="flex-1 space-y-1 mb-2 overflow-y-auto max-h-48">
        {items.map((item) => (
          <div
            key={item.id}
            className={`group flex items-start gap-1.5 p-1.5 rounded text-xs ${
              item.aiSuggested ? 'bg-purple-100/50 border border-purple-200' :
              item.isNew ? 'bg-green-100/50 border border-green-200' :
              item.isModified ? 'bg-amber-100/50 border border-amber-200' :
              'bg-white/60'
            }`}
          >
            <GripVertical className="w-3 h-3 text-gray-300 mt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
            {isExpanded ? (
              <input
                type="text"
                value={item.text}
                onChange={(e) => onUpdateItem(item.id, { text: e.target.value })}
                className="flex-1 bg-transparent border-none text-xs focus:ring-0 p-0"
                readOnly={readOnly}
              />
            ) : (
              <span className="flex-1 text-gray-700 leading-tight">{item.text}</span>
            )}
            {item.aiSuggested && (
              <Sparkles className="w-3 h-3 text-purple-500 flex-shrink-0 mt-0.5" />
            )}
            {item.priority === 'high' && (
              <Star className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
            )}
            {!readOnly && (
              <button
                onClick={() => onRemoveItem(item.id)}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-gray-400 italic text-center py-2">No items yet</p>
        )}
      </div>

      {/* Add Item */}
      {!readOnly && (
        <div className="flex items-center gap-1 mt-auto">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => onNewItemTextChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddItem()}
            placeholder="Add item..."
            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1 bg-white/80 focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
          />
          <button
            onClick={onAddItem}
            disabled={!newItemText.trim()}
            className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessModelCanvas;
