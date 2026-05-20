/**
 * Material Forecast Page
 * Shows forecasted materials from selected BOQ items with supplier recommendations
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calculator,
  Package,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowLeft,
  Truck,
  DollarSign,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '../components/layout/PageHeader';
import { 
  generateMaterialForecast, 
  getForecastSummary,
  type MaterialForecast as MaterialForecastType,
  type ForecastedMaterial,
} from '../services/materialForecastService';

const MaterialForecast: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [forecast, setForecast] = useState<MaterialForecastType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMaterials, setExpandedMaterials] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (projectId) {
      loadForecast();
    }
  }, [projectId]);

  const loadForecast = async () => {
    if (!projectId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await generateMaterialForecast(projectId);
      setForecast(data);
    } catch (err) {
      console.error('Failed to generate forecast:', err);
      setError('Failed to generate material forecast');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMaterial = (materialId: string) => {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-amber-600">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span>Generating material forecast...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      </div>
    );
  }

  if (!forecast) {
    return null;
  }

  const summary = getForecastSummary(forecast);

  return (
    <div>
      <PageHeader
        title="Material Forecast"
        description="Projected materials from selected work items"
        breadcrumbs={[
          { label: 'MatFlow', href: '/advisory/matflow' },
          { label: 'Projects', href: '/advisory/matflow/projects' },
          { label: 'Project', href: `/advisory/matflow/projects/${projectId}` },
          { label: 'Material Forecast' },
        ]}
      />

      <div className="p-6 space-y-6">
        {/* Back Link */}
        <Link 
          to={`/advisory/matflow/projects/${projectId}`}
          className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Project
        </Link>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={Package}
            label="Selected Items"
            value={summary.itemCount.toString()}
            color="blue"
          />
          <SummaryCard
            icon={Calculator}
            label="Material Types"
            value={summary.materialCount.toString()}
            color="purple"
          />
          <SummaryCard
            icon={DollarSign}
            label="Estimated Cost"
            value={`UGX ${formatCurrency(summary.estimatedCost)}`}
            color="green"
          />
          <SummaryCard
            icon={Truck}
            label="Suppliers Needed"
            value={summary.suppliersNeeded.toString()}
            color="amber"
          />
        </div>

        {/* Warnings */}
        {forecast.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800 font-medium mb-2">
              <AlertTriangle className="w-5 h-5" />
              Warnings
            </div>
            <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
              {forecast.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {/* No Selection Message */}
        {forecast.selectedItemCount === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Items Selected</h3>
            <p className="text-gray-600 mb-4">
              Select work items from the BOQ to generate a material forecast
            </p>
            <Link
              to={`/advisory/matflow/projects/${projectId}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              Go to BOQ Items
            </Link>
          </div>
        ) : (
          /* Materials List */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Forecasted Materials ({forecast.materials.length})
              </h2>
              <button
                onClick={loadForecast}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Material</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Unit Rate</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">Total Cost</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Recommended Supplier</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {forecast.materials.map(material => (
                    <MaterialRow
                      key={material.materialId}
                      material={material}
                      isExpanded={expandedMaterials.has(material.materialId)}
                      onToggle={() => toggleMaterial(material.materialId)}
                      formatCurrency={formatCurrency}
                    />
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-900">
                      Total Estimated Cost
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-amber-600">
                      UGX {formatCurrency(forecast.totalEstimatedCost)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Items Without Formula */}
        {forecast.itemsWithoutFormula.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-orange-800 font-medium mb-2">
              <AlertTriangle className="w-5 h-5" />
              Items Without Formula ({forecast.itemsWithoutFormula.length})
            </div>
            <p className="text-sm text-orange-700 mb-2">
              These items are selected but have no formula assigned:
            </p>
            <div className="flex flex-wrap gap-2">
              {forecast.itemsWithoutFormula.map(code => (
                <span key={code} className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm">
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Summary Card Component
interface SummaryCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  color: 'blue' | 'purple' | 'green' | 'amber';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon: Icon, label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <div className="flex items-center gap-3">
        <Icon className="w-8 h-8" />
        <div>
          <div className="text-sm opacity-80">{label}</div>
          <div className="text-xl font-bold">{value}</div>
        </div>
      </div>
    </div>
  );
};

// Material Row Component
interface MaterialRowProps {
  material: ForecastedMaterial;
  isExpanded: boolean;
  onToggle: () => void;
  formatCurrency: (amount: number) => string;
}

const MaterialRow: React.FC<MaterialRowProps> = ({ 
  material, 
  isExpanded, 
  onToggle,
  formatCurrency 
}) => {
  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900">{material.materialName}</div>
          <div className="text-sm text-gray-500">{material.unit}</div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="font-medium">{material.totalQuantity.toFixed(2)}</div>
          <div className="text-xs text-gray-500">
            (incl. {material.wastageQuantity.toFixed(1)} wastage)
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          {material.estimatedUnitCost > 0 ? (
            <span>UGX {formatCurrency(material.estimatedUnitCost)}</span>
          ) : (
            <span className="text-gray-400">No rates</span>
          )}
        </td>
        <td className="px-4 py-3 text-right font-medium">
          {material.estimatedTotalCost > 0 ? (
            <span>UGX {formatCurrency(material.estimatedTotalCost)}</span>
          ) : (
            <span className="text-gray-400">-</span>
          )}
        </td>
        <td className="px-4 py-3">
          {material.recommendedSupplier ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm">{material.recommendedSupplier.supplierName}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400">No supplier data</span>
          )}
        </td>
        <td className="px-4 py-3">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </td>
      </tr>
      
      {/* Expanded Details */}
      {isExpanded && (
        <tr>
          <td colSpan={6} className="bg-gray-50 px-4 py-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Source Items */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Source Work Items ({material.sourceItems.length})
                </h4>
                <div className="space-y-2">
                  {material.sourceItems.map((item, idx) => (
                    <div key={idx} className="text-sm bg-white p-2 rounded border">
                      <div className="font-medium">{item.itemCode}</div>
                      <div className="text-gray-600 truncate">{item.description}</div>
                      <div className="text-gray-500">
                        Qty: {item.quantity.toFixed(2)} • Formula: {item.formulaCode || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Supplier Options */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Supplier Options ({material.supplierRates.length})
                </h4>
                {material.supplierRates.length > 0 ? (
                  <div className="space-y-2">
                    {material.supplierRates.slice(0, 3).map((rate, idx) => (
                      <div 
                        key={idx} 
                        className={`text-sm p-2 rounded border ${
                          idx === 0 ? 'bg-green-50 border-green-200' : 'bg-white'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{rate.supplierName}</span>
                          <span className={idx === 0 ? 'text-green-700 font-medium' : ''}>
                            UGX {formatCurrency(rate.landedCost)}/{material.unit}
                          </span>
                        </div>
                        <div className="text-gray-500 text-xs">
                          Unit: {formatCurrency(rate.unitPrice)} + Delivery: {formatCurrency(rate.deliveryCost || 0)}
                          {rate.leadTimeDays && ` • ${rate.leadTimeDays} days lead time`}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 bg-white p-3 rounded border">
                    No supplier rates available for this material
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default MaterialForecast;
