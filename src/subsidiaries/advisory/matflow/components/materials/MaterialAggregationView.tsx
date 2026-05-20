/**
 * Material Aggregation View
 * Shows aggregated material requirements across all BOQ items
 */

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Package, ExternalLink } from 'lucide-react';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import type { BOQItem } from '../../types';

interface MaterialAggregationViewProps {
  items: BOQItem[];
}

interface AggregatedMaterial {
  materialId: string;
  materialName: string;
  category: string;
  totalQuantity: number;
  unit: string;
  estimatedCost: number;
  sourceItems: Array<{
    itemId: string;
    itemCode: string;
    description: string;
    quantity: number;
  }>;
  procurementStatus?: 'not_started' | 'partial' | 'complete';
}

export function MaterialAggregationView({ items }: MaterialAggregationViewProps) {
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());
  const [billFilter, setBillFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Aggregate materials across all items
  const aggregatedMaterials = useMemo(() => {
    const materialMap = new Map<string, AggregatedMaterial>();

    items.forEach(item => {
      if (!item.materialRequirements || item.materialRequirements.length === 0) return;

      // Apply bill filter
      if (billFilter !== 'all' && item.billNumber !== billFilter) return;

      item.materialRequirements.forEach((req: any) => {
        const key = req.materialId || req.materialName;
        if (!key) return;

        if (!materialMap.has(key)) {
          materialMap.set(key, {
            materialId: req.materialId || '',
            materialName: req.materialName || key,
            category: req.category || 'Other',
            totalQuantity: 0,
            unit: req.unit || '',
            estimatedCost: 0,
            sourceItems: [],
          });
        }

        const material = materialMap.get(key)!;
        material.totalQuantity += req.quantity || 0;
        material.estimatedCost += req.totalCost || 0;
        material.sourceItems.push({
          itemId: item.id,
          itemCode: item.hierarchyPath || item.itemNumber,
          description: item.description,
          quantity: req.quantity || 0,
        });
      });
    });

    let result = Array.from(materialMap.values());

    // Apply category filter
    if (categoryFilter !== 'all') {
      result = result.filter(m => m.category === categoryFilter);
    }

    return result.sort((a, b) => b.estimatedCost - a.estimatedCost);
  }, [items, billFilter, categoryFilter]);

  const toggleMaterial = (materialId: string) => {
    const newExpanded = new Set(expandedMaterials);
    if (newExpanded.has(materialId)) {
      newExpanded.delete(materialId);
    } else {
      newExpanded.add(materialId);
    }
    setExpandedMaterials(newExpanded);
  };

  // Get unique bills for filtering
  const uniqueBills = useMemo(() => {
    const bills = new Set<string>();
    items.forEach(item => {
      if (item.billNumber) bills.add(item.billNumber);
    });
    return Array.from(bills).sort();
  }, [items]);

  // Get unique categories
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    aggregatedMaterials.forEach(m => categories.add(m.category));
    return Array.from(categories).sort();
  }, [aggregatedMaterials]);

  const totalEstimatedCost = aggregatedMaterials.reduce((sum, m) => sum + m.estimatedCost, 0);

  const handleExport = (format: 'excel' | 'pdf' | 'csv') => {
    // Placeholder - implement actual export logic
    alert(`Exporting to ${format.toUpperCase()}... (Not implemented yet)`);
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <KPIGrid cols={3}>
        <KPICard
          label="Total Materials"
          value={aggregatedMaterials.length}
        />
        <KPICard
          label="Estimated Cost"
          value={new Intl.NumberFormat('en-UG', {
            maximumFractionDigits: 0,
          }).format(totalEstimatedCost)}
          unit="UGX"
        />
        <KPICard
          label="Source BOQ Items"
          value={items.filter(i => i.materialRequirements && i.materialRequirements.length > 0).length}
        />
      </KPIGrid>

      {/* Filters and Export */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">Filter by:</span>

          {/* Bill Filter */}
          <select
            value={billFilter}
            onChange={(e) => setBillFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Bills</option>
            {uniqueBills.map(bill => (
              <option key={bill} value={bill}>Bill {bill}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Categories</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('excel')}
            className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Aggregated Materials Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-12 px-4 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Material
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estimated Cost
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source Items
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Procurement
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {aggregatedMaterials.map((material) => {
              const isExpanded = expandedMaterials.has(material.materialId || material.materialName);

              return (
                <React.Fragment key={material.materialId || material.materialName}>
                  {/* Main Row */}
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleMaterial(material.materialId || material.materialName)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {material.materialName}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {material.category}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900 text-right font-medium">
                      {material.totalQuantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {material.unit}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-900 text-right font-medium">
                      {new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(material.estimatedCost)}
                    </td>
                    <td className="px-6 py-3 text-center text-sm text-gray-900">
                      {material.sourceItems.length}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {material.procurementStatus ? (
                        <button className="text-blue-600 hover:text-blue-800 flex items-center gap-1 mx-auto">
                          View <ExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">Not started</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Row - Source Items */}
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-12 py-4">
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-3">
                            Source BOQ Items ({material.sourceItems.length})
                          </h4>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="text-left py-2 px-3 font-medium text-gray-600">Item Code</th>
                                <th className="text-left py-2 px-3 font-medium text-gray-600">Description</th>
                                <th className="text-right py-2 px-3 font-medium text-gray-600">Quantity</th>
                              </tr>
                            </thead>
                            <tbody>
                              {material.sourceItems.map((source, idx) => (
                                <tr key={idx} className="border-b border-gray-100 last:border-0">
                                  <td className="py-2 px-3 text-gray-900 font-medium">{source.itemCode}</td>
                                  <td className="py-2 px-3 text-gray-700">{source.description}</td>
                                  <td className="py-2 px-3 text-right text-gray-900">
                                    {source.quantity.toLocaleString()} {material.unit}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {aggregatedMaterials.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No materials found</p>
            <p className="text-sm mt-1">Apply formulas to BOQ items to see aggregated materials</p>
          </div>
        )}
      </div>
    </div>
  );
}
