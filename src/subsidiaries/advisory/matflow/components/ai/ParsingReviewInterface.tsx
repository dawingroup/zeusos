/**
 * AI Parsing Review Interface
 * Interactive review of AI-parsed BOQ data with confidence visualization
 */

import React, { useState } from 'react';
import {
  Check,
  X,
  Edit2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Lightbulb,
  Save,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { ConfidenceBadge } from '../ConfidenceIndicator';

interface ParsedItem {
  id: string;
  itemNumber: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  confidence: number;
  reviewDecision?: 'approved' | 'rejected' | 'edited';
  suggestions?: Array<{
    field: string;
    suggestedValue: string | number;
    reason: string;
  }>;
}

interface ParsedSection {
  id: string;
  name: string;
  number: string;
  items: ParsedItem[];
}

interface ParsingReviewInterfaceProps {
  jobId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const ParsingReviewInterface: React.FC<ParsingReviewInterfaceProps> = ({
  jobId: _jobId,
  onComplete,
  onCancel,
}) => {
  // Placeholder data - will connect to hooks
  const sections: ParsedSection[] = [
    {
      id: '1',
      name: 'Foundation Works',
      number: '1.0',
      items: [
        { id: '1-1', itemNumber: '1.01', description: 'Excavation to reduced level', quantity: 450, unit: 'm³', rate: 25000, amount: 11250000, confidence: 0.95 },
        { id: '1-2', itemNumber: '1.02', description: 'Hardcore filling and compaction', quantity: 320, unit: 'm³', rate: 45000, amount: 14400000, confidence: 0.88 },
        { id: '1-3', itemNumber: '1.03', description: 'Anti-termite treatment', quantity: 1200, unit: 'm²', rate: 8500, amount: 10200000, confidence: 0.72, suggestions: [{ field: 'rate', suggestedValue: 9500, reason: 'Current market rate is higher' }] },
        { id: '1-4', itemNumber: '1.04', description: 'Blinding concrete', quantity: 85, unit: 'm³', rate: 350000, amount: 29750000, confidence: 0.91 },
      ],
    },
    {
      id: '2',
      name: 'Concrete Works',
      number: '2.0',
      items: [
        { id: '2-1', itemNumber: '2.01', description: 'Reinforced concrete grade 25 in foundations', quantity: 120, unit: 'm³', rate: 680000, amount: 81600000, confidence: 0.94 },
        { id: '2-2', itemNumber: '2.02', description: 'Reinforced concrete grade 30 in columns', quantity: 45, unit: 'm³', rate: 750000, amount: 33750000, confidence: 0.89 },
        { id: '2-3', itemNumber: '2.03', description: 'Steel reinforcement Y12', quantity: 8500, unit: 'kg', rate: 4200, amount: 35700000, confidence: 0.65, suggestions: [{ field: 'quantity', suggestedValue: 9200, reason: 'Typical ratio for this section' }] },
      ],
    },
  ];

  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [itemDecisions, setItemDecisions] = useState<Record<string, 'approved' | 'rejected' | 'edited'>>({});
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<ParsedItem>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentSection = sections[currentSectionIndex];
  const totalSections = sections.length;

  // Calculate section progress
  const getSectionStatus = (section: ParsedSection) => {
    const items = section.items || [];
    const approved = items.filter(i => itemDecisions[i.id] === 'approved').length;
    const rejected = items.filter(i => itemDecisions[i.id] === 'rejected').length;
    const edited = items.filter(i => itemDecisions[i.id] === 'edited').length;
    const pending = items.length - approved - rejected - edited;
    return { approved, rejected, edited, pending, total: items.length };
  };

  const sectionStatus = getSectionStatus(currentSection);

  // Navigation
  const navigateToSection = (index: number) => {
    if (index >= 0 && index < totalSections) {
      setCurrentSectionIndex(index);
      setEditingItem(null);
    }
  };

  // Item actions
  const approveItem = (itemId: string) => {
    setItemDecisions(prev => ({ ...prev, [itemId]: 'approved' }));
  };

  const rejectItem = (itemId: string) => {
    setItemDecisions(prev => ({ ...prev, [itemId]: 'rejected' }));
  };

  const startEdit = (item: ParsedItem) => {
    setEditingItem(item.id);
    setEditValues({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
    });
  };

  const saveEdit = () => {
    if (editingItem) {
      setItemDecisions(prev => ({ ...prev, [editingItem]: 'edited' }));
      setEditingItem(null);
      setEditValues({});
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditValues({});
  };

  // Auto-approve high confidence items
  const approveAllHighConfidence = () => {
    const newDecisions = { ...itemDecisions };
    sections.forEach(section => {
      section.items.forEach(item => {
        if (item.confidence >= 0.85 && !newDecisions[item.id]) {
          newDecisions[item.id] = 'approved';
        }
      });
    });
    setItemDecisions(newDecisions);
  };

  // Apply suggestion
  const applySuggestion = (item: ParsedItem, field: string, value: string | number) => {
    setEditingItem(item.id);
    setEditValues(prev => ({ ...prev, [field]: value }));
  };

  // Complete review
  const completeReview = async () => {
    setIsSubmitting(true);
    try {
      // Placeholder - will connect to service
      await new Promise(resolve => setTimeout(resolve, 1000));
      onComplete();
    } catch (err) {
      console.error('Failed to complete review:', err);
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Review Parsed BOQ</h1>
            <p className="text-sm text-gray-500">
              Section {currentSectionIndex + 1} of {totalSections}: {currentSection.name}
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Section Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigateToSection(currentSectionIndex - 1)}
                disabled={currentSectionIndex === 0}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm text-gray-600">
                {currentSectionIndex + 1} / {totalSections}
              </span>
              <button
                onClick={() => navigateToSection(currentSectionIndex + 1)}
                disabled={currentSectionIndex >= totalSections - 1}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={approveAllHighConfidence}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Sparkles className="w-4 h-4" />
              Auto-Approve High Confidence
            </button>
            <button
              onClick={completeReview}
              disabled={isSubmitting || sectionStatus.pending > 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              Complete Review
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500">
              Section Progress: {sectionStatus.approved + sectionStatus.rejected + sectionStatus.edited} / {sectionStatus.total}
            </span>
            <div className="flex gap-3">
              <span className="inline-flex items-center gap-1 text-xs">
                <CheckCircle className="w-4 h-4 text-green-600" />
                {sectionStatus.approved} Approved
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600" />
                {sectionStatus.rejected} Rejected
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                <HelpCircle className="w-4 h-4 text-yellow-600" />
                {sectionStatus.pending} Pending
              </span>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{
                width: `${((sectionStatus.approved + sectionStatus.rejected + sectionStatus.edited) / sectionStatus.total) * 100}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Section Header */}
        <div className="bg-gray-100 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{currentSection.name}</h2>
            <p className="text-sm text-gray-500">
              {currentSection.number} • {currentSection.items.length} items
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Section Total</p>
            <p className="text-lg font-semibold">
              {formatCurrency(currentSection.items.reduce((sum, item) => sum + item.amount, 0))}
            </p>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Item #</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Qty</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Unit</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Rate</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Amount</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Confidence</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentSection.items.map((item) => {
                const decision = itemDecisions[item.id];
                const isEditing = editingItem === item.id;

                return (
                  <React.Fragment key={item.id}>
                    <tr
                      className={cn(
                        'transition-colors',
                        decision === 'approved' && 'bg-green-50',
                        decision === 'rejected' && 'bg-red-50',
                        decision === 'edited' && 'bg-blue-50',
                        isEditing && 'bg-yellow-50'
                      )}
                    >
                      <td className="px-4 py-3 text-sm">{item.itemNumber}</td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editValues.description || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        ) : (
                          <span className="text-sm">{item.description}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.quantity || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, quantity: parseFloat(e.target.value) }))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          />
                        ) : (
                          <span className="text-sm">{item.quantity.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">{item.unit}</td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.rate || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                            className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                          />
                        ) : (
                          <span className="text-sm">{formatCurrency(item.rate)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium">
                        {formatCurrency(item.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ConfidenceBadge score={item.confidence * 100} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveEdit}
                                className="p-1.5 rounded bg-green-100 text-green-600 hover:bg-green-200"
                                title="Save"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => approveItem(item.id)}
                                className={cn(
                                  'p-1.5 rounded hover:bg-green-200',
                                  decision === 'approved' ? 'bg-green-200 text-green-700' : 'bg-green-100 text-green-600'
                                )}
                                title="Approve"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => rejectItem(item.id)}
                                className={cn(
                                  'p-1.5 rounded hover:bg-red-200',
                                  decision === 'rejected' ? 'bg-red-200 text-red-700' : 'bg-red-100 text-red-600'
                                )}
                                title="Reject"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => startEdit(item)}
                                className="p-1.5 rounded bg-blue-100 text-blue-600 hover:bg-blue-200"
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Suggestions Row */}
                    {item.suggestions && item.suggestions.length > 0 && !decision && (
                      <tr className="bg-amber-50">
                        <td colSpan={8} className="px-4 py-2">
                          <div className="flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-600 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-sm text-amber-800 font-medium">AI Suggestions:</p>
                              {item.suggestions.map((suggestion, idx) => (
                                <div key={idx} className="flex items-center gap-2 mt-1">
                                  <span className="text-sm text-amber-700">
                                    {suggestion.field}: {suggestion.suggestedValue} - {suggestion.reason}
                                  </span>
                                  <button
                                    onClick={() => applySuggestion(item, suggestion.field, suggestion.suggestedValue)}
                                    className="text-xs px-2 py-0.5 bg-amber-200 text-amber-800 rounded hover:bg-amber-300"
                                  >
                                    Apply
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          Cancel Review
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => navigateToSection(currentSectionIndex - 1)}
            disabled={currentSectionIndex === 0}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous Section
          </button>
          {currentSectionIndex < totalSections - 1 ? (
            <button
              onClick={() => navigateToSection(currentSectionIndex + 1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Next Section
            </button>
          ) : (
            <button
              onClick={completeReview}
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Complete Review'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParsingReviewInterface;
