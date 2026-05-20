/**
 * Asset View Card
 * 
 * Displays a unified view of an infrastructure asset
 * with cross-module data.
 */

import {
  MapPin,
  TrendingUp,
  Building2,
  Calendar,
  DollarSign,
  Activity,
  Link2,
  ExternalLink,
} from 'lucide-react';

type AssetStatus =
  | 'pipeline'
  | 'development'
  | 'construction'
  | 'commissioning'
  | 'operational'
  | 'distressed'
  | 'exited';

type ScheduleStatus = 'ahead' | 'on_track' | 'behind' | 'critical';

interface AssetView {
  id: string;
  assetName: string;
  assetType: string;
  sector: string;
  status: AssetStatus;
  
  location: {
    country: string;
    region?: string;
    city?: string;
  };
  
  financials: {
    totalInvestment: number;
    currentValuation: number;
    moic: number;
    irr?: number;
  };
  
  progress?: {
    physicalProgress: number;
    financialProgress: number;
    scheduleStatus: ScheduleStatus;
  };
  
  linkedEntities: {
    portfolioIds: string[];
    holdingIds: string[];
    dealIds: string[];
    projectIds: string[];
  };
  
  lastUpdated: Date;
}

interface AssetViewCardProps {
  asset: AssetView;
  compact?: boolean;
  onViewDetails?: () => void;
  onViewPortfolio?: (portfolioId: string) => void;
  onViewProject?: (projectId: string) => void;
}

export function AssetViewCard({
  asset,
  compact = false,
  onViewDetails,
  onViewPortfolio,
  onViewProject,
}: AssetViewCardProps) {
  const statusConfig: Record<AssetStatus, { color: string; label: string }> = {
    pipeline: { color: 'bg-gray-100 text-gray-800', label: 'Pipeline' },
    development: { color: 'bg-blue-100 text-blue-800', label: 'Development' },
    construction: { color: 'bg-yellow-100 text-yellow-800', label: 'Construction' },
    commissioning: { color: 'bg-purple-100 text-purple-800', label: 'Commissioning' },
    operational: { color: 'bg-green-100 text-green-800', label: 'Operational' },
    distressed: { color: 'bg-red-100 text-red-800', label: 'Distressed' },
    exited: { color: 'bg-gray-100 text-gray-800', label: 'Exited' },
  };
  
  const scheduleConfig: Record<ScheduleStatus, { color: string; label: string }> = {
    ahead: { color: 'text-green-600', label: 'Ahead' },
    on_track: { color: 'text-blue-600', label: 'On Track' },
    behind: { color: 'text-yellow-600', label: 'Behind' },
    critical: { color: 'text-red-600', label: 'Critical' },
  };
  
  if (compact) {
    return (
      <div
        onClick={onViewDetails}
        className="bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-gray-900">{asset.assetName}</h4>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
              <MapPin className="h-3 w-3" />
              {asset.location.country}
              {asset.location.city && `, ${asset.location.city}`}
            </div>
          </div>
          <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig[asset.status].color}`}>
            {statusConfig[asset.status].label}
          </span>
        </div>
        
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">Value:</span>{' '}
            <span className="font-medium">{formatCurrency(asset.financials.currentValuation)}</span>
          </div>
          <div>
            <span className="text-gray-500">MOIC:</span>{' '}
            <span className="font-medium">{asset.financials.moic.toFixed(2)}x</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">{asset.assetName}</h3>
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
              <span className="capitalize">{asset.assetType}</span>
              <span>•</span>
              <span className="capitalize">{asset.sector}</span>
            </div>
          </div>
          <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig[asset.status].color}`}>
            {statusConfig[asset.status].label}
          </span>
        </div>
      </div>
      
      {/* Location */}
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-gray-400" />
          <span>
            {asset.location.city && `${asset.location.city}, `}
            {asset.location.region && `${asset.location.region}, `}
            {asset.location.country}
          </span>
        </div>
      </div>
      
      {/* Financials */}
      <div className="p-4 border-b">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Financials</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <DollarSign className="h-3 w-3" />
              Total Investment
            </div>
            <p className="font-semibold">{formatCurrency(asset.financials.totalInvestment)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <TrendingUp className="h-3 w-3" />
              Current Valuation
            </div>
            <p className="font-semibold">{formatCurrency(asset.financials.currentValuation)}</p>
          </div>
          <div>
            <div className="text-xs text-gray-500">MOIC</div>
            <p className="font-semibold">{asset.financials.moic.toFixed(2)}x</p>
          </div>
          {asset.financials.irr !== undefined && (
            <div>
              <div className="text-xs text-gray-500">IRR</div>
              <p className={`font-semibold ${asset.financials.irr >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(asset.financials.irr)}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Progress (if applicable) */}
      {asset.progress && (
        <div className="p-4 border-b">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Progress</h4>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Physical Progress</span>
                <span className="font-medium">{asset.progress.physicalProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${asset.progress.physicalProgress}%` }}
                />
              </div>
            </div>
            
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Financial Progress</span>
                <span className="font-medium">{asset.progress.financialProgress}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 rounded-full"
                  style={{ width: `${asset.progress.financialProgress}%` }}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500">Schedule:</span>
              <span className={`text-sm font-medium ${scheduleConfig[asset.progress.scheduleStatus].color}`}>
                {scheduleConfig[asset.progress.scheduleStatus].label}
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Linked Entities */}
      <div className="p-4 border-b">
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Linked Entities
        </h4>
        <div className="space-y-2">
          {asset.linkedEntities.portfolioIds.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {asset.linkedEntities.portfolioIds.length} Portfolio(s)
              </span>
              {onViewPortfolio && (
                <button
                  onClick={() => onViewPortfolio(asset.linkedEntities.portfolioIds[0])}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          
          {asset.linkedEntities.holdingIds.length > 0 && (
            <div className="text-sm text-gray-500">
              {asset.linkedEntities.holdingIds.length} Holding(s)
            </div>
          )}
          
          {asset.linkedEntities.projectIds.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {asset.linkedEntities.projectIds.length} Project(s)
              </span>
              {onViewProject && (
                <button
                  onClick={() => onViewProject(asset.linkedEntities.projectIds[0])}
                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View <ExternalLink className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          
          {asset.linkedEntities.dealIds.length > 0 && (
            <div className="text-sm text-gray-500">
              {asset.linkedEntities.dealIds.length} Deal(s)
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          Updated {formatTimeAgo(asset.lastUpdated)}
        </div>
        
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View Details →
          </button>
        )}
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default AssetViewCard;
