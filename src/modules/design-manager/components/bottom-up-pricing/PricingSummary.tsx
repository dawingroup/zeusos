/**
 * Pricing Summary
 * Displays final breakdown tables (by discipline, by stage) and grand total
 */

import { BarChart3, Layers, Calculator } from 'lucide-react';
import type { BottomUpPricingResult } from '../../types/bottomUpPricing';

interface PricingSummaryProps {
  result: BottomUpPricingResult;
  currency: string;
}

export function PricingSummary({ result }: PricingSummaryProps) {
  const formatCurrency = (val: number) =>
    `UGX ${val.toLocaleString('en-UG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const hasData = result.totalLaborHours > 0 || result.logisticsCost > 0 || result.externalStudiesCost > 0;

  if (!hasData) {
    return (
      <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
        <Calculator className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Add disciplines, deliverables, and costs above to see the pricing summary.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* By Discipline */}
      {result.byDiscipline.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 p-4 border-b border-gray-200">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Cost by Discipline</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200 bg-gray-50">
                  <th className="p-3 font-medium">Discipline</th>
                  <th className="p-3 font-medium text-right">Hours</th>
                  <th className="p-3 font-medium text-right">Cost</th>
                  <th className="p-3 font-medium text-right">% of Labor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.byDiscipline.map((disc) => (
                  <tr key={disc.discipline} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">{disc.label}</td>
                    <td className="p-3 text-right text-gray-600">{disc.totalHours.toFixed(1)}</td>
                    <td className="p-3 text-right font-medium text-gray-900">{formatCurrency(disc.totalCost)}</td>
                    <td className="p-3 text-right text-gray-500">
                      {result.laborCost > 0 ? ((disc.totalCost / result.laborCost) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="p-3 text-gray-900">Total Labor</td>
                  <td className="p-3 text-right text-gray-900">{result.totalLaborHours.toFixed(1)}</td>
                  <td className="p-3 text-right text-gray-900">{formatCurrency(result.laborCost)}</td>
                  <td className="p-3 text-right text-gray-500">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* By Stage */}
      {result.byStage.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 p-4 border-b border-gray-200">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-gray-900">Cost by Design Stage</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200 bg-gray-50">
                  <th className="p-3 font-medium">Stage</th>
                  <th className="p-3 font-medium text-right">Hours</th>
                  <th className="p-3 font-medium text-right">Cost</th>
                  <th className="p-3 font-medium text-right">% of Labor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.byStage.map((stage) => (
                  <tr key={stage.stage} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">{stage.label}</td>
                    <td className="p-3 text-right text-gray-600">{stage.totalHours.toFixed(1)}</td>
                    <td className="p-3 text-right font-medium text-gray-900">{formatCurrency(stage.totalCost)}</td>
                    <td className="p-3 text-right text-gray-500">
                      {result.laborCost > 0 ? ((stage.totalCost / result.laborCost) * 100).toFixed(1) : '0.0'}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grand Total Card */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Fee Summary</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Labor ({result.totalLaborHours.toFixed(1)} hrs)</span>
            <span className="text-sm font-medium text-gray-900">{formatCurrency(result.laborCost)}</span>
          </div>
          {result.logisticsCost > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Logistics / Reimbursables</span>
              <span className="text-sm font-medium text-gray-900">{formatCurrency(result.logisticsCost)}</span>
            </div>
          )}
          {result.externalStudiesCost > 0 && (
            <>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">External Studies</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(result.externalStudiesCost)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600 pl-4">+ Admin Fee</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(result.adminFeeAmount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between items-center pt-3 mt-3 border-t-2 border-blue-300">
            <span className="text-lg font-bold text-gray-900">Grand Total Fee</span>
            <span className="text-2xl font-bold text-blue-700">{formatCurrency(result.grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
