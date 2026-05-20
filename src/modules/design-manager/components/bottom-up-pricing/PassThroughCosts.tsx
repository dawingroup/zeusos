/**
 * Pass-Through Costs Panel
 * Manages logistics costs and external studies with admin fee
 */

import { useState } from 'react';
import { Plus, Trash2, Truck, FlaskConical } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { LogisticsCostItem, ExternalStudyItem } from '../../types/bottomUpPricing';

interface PassThroughCostsProps {
  logistics: LogisticsCostItem[];
  externalStudies: ExternalStudyItem[];
  adminFeePercent: number;
  logisticsTotalCost: number;
  externalStudiesTotalCost: number;
  adminFeeAmount: number;
  onAddLogistics: (description: string, amount: number) => void;
  onUpdateLogistics: (id: string, updates: Partial<LogisticsCostItem>) => void;
  onRemoveLogistics: (id: string) => void;
  onAddExternalStudy: (description: string, amount: number) => void;
  onUpdateExternalStudy: (id: string, updates: Partial<ExternalStudyItem>) => void;
  onRemoveExternalStudy: (id: string) => void;
  onSetAdminFeePercent: (pct: number) => void;
}

export function PassThroughCosts({
  logistics,
  externalStudies,
  adminFeePercent,
  logisticsTotalCost,
  externalStudiesTotalCost,
  adminFeeAmount,
  onAddLogistics,
  onUpdateLogistics,
  onRemoveLogistics,
  onAddExternalStudy,
  onUpdateExternalStudy,
  onRemoveExternalStudy,
  onSetAdminFeePercent,
}: PassThroughCostsProps) {
  const [newLogDesc, setNewLogDesc] = useState('');
  const [newLogAmt, setNewLogAmt] = useState('');
  const [newStudyDesc, setNewStudyDesc] = useState('');
  const [newStudyAmt, setNewStudyAmt] = useState('');

  const formatCurrency = (val: number) =>
    `UGX ${val.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const handleAddLogistics = () => {
    if (!newLogDesc.trim() || !newLogAmt) return;
    onAddLogistics(newLogDesc.trim(), parseFloat(newLogAmt));
    setNewLogDesc('');
    setNewLogAmt('');
  };

  const handleAddStudy = () => {
    if (!newStudyDesc.trim() || !newStudyAmt) return;
    onAddExternalStudy(newStudyDesc.trim(), parseFloat(newStudyAmt));
    setNewStudyDesc('');
    setNewStudyAmt('');
  };

  return (
    <div className="space-y-4">
      {/* Logistics */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Logistics / Reimbursables</h3>
          </div>
          <span className="text-sm font-semibold text-gray-900">{formatCurrency(logisticsTotalCost)}</span>
        </div>
        <div className="p-4 space-y-2">
          {logistics.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="text"
                value={item.description}
                onChange={(e) => onUpdateLogistics(item.id, { description: e.target.value })}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
              />
              <div className="relative w-32">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                <input
                  type="number"
                  value={item.amount || ''}
                  onChange={(e) => onUpdateLogistics(item.id, { amount: parseFloat(e.target.value) || 0 })}
                  min={0}
                  className="w-full pl-11 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button onClick={() => onRemoveLogistics(item.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {/* Add new */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              type="text"
              value={newLogDesc}
              onChange={(e) => setNewLogDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddLogistics()}
              placeholder="e.g., Travel, Printing, Courier..."
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="relative w-32">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
              <input
                type="number"
                value={newLogAmt}
                onChange={(e) => setNewLogAmt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLogistics()}
                min={0}
                placeholder="0"
                className="w-full pl-11 pr-2 py-1.5 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAddLogistics}
              disabled={!newLogDesc.trim() || !newLogAmt}
              className={cn(
                'p-1.5 rounded',
                newLogDesc.trim() && newLogAmt ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
              )}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* External Studies */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">External Studies</h3>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {formatCurrency(externalStudiesTotalCost + adminFeeAmount)}
          </span>
        </div>
        <div className="p-4 space-y-2">
          {externalStudies.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <input
                type="text"
                value={item.description}
                onChange={(e) => onUpdateExternalStudy(item.id, { description: e.target.value })}
                className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
              />
              <div className="relative w-32">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
                <input
                  type="number"
                  value={item.amount || ''}
                  onChange={(e) => onUpdateExternalStudy(item.id, { amount: parseFloat(e.target.value) || 0 })}
                  min={0}
                  className="w-full pl-11 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button onClick={() => onRemoveExternalStudy(item.id)} className="p-1 text-gray-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {/* Add new */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              type="text"
              value={newStudyDesc}
              onChange={(e) => setNewStudyDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStudy()}
              placeholder="e.g., Geotechnical, Acoustic, Environmental..."
              className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="relative w-32">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
              <input
                type="number"
                value={newStudyAmt}
                onChange={(e) => setNewStudyAmt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStudy()}
                min={0}
                placeholder="0"
                className="w-full pl-11 pr-2 py-1.5 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleAddStudy}
              disabled={!newStudyDesc.trim() || !newStudyAmt}
              className={cn(
                'p-1.5 rounded',
                newStudyDesc.trim() && newStudyAmt ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'
              )}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Admin Fee */}
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Admin Fee</span>
              <div className="relative w-20">
                <input
                  type="number"
                  value={adminFeePercent}
                  onChange={(e) => onSetAdminFeePercent(parseFloat(e.target.value) || 0)}
                  min={0}
                  max={100}
                  step={1}
                  className="w-full pl-2 pr-6 py-1 text-sm text-right border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
              </div>
            </div>
            <span className="text-sm font-medium text-gray-700">{formatCurrency(adminFeeAmount)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
