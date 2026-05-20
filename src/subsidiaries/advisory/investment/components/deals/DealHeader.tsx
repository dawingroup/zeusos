/**
 * Deal Header - Key information and actions
 */

import { 
  Edit, 
  MoreHorizontal, 
  Archive, 
  Copy,
  ExternalLink,
  Calendar,
  Building2,
  Users,
  AlertTriangle,
  DollarSign
} from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  dealCode: string;
  stage: string;
  status: string;
  sector: string;
  subsector?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dealType: string;
  targetInvestment: { amount: number; currency: string };
  expectedCloseDate?: Date;
  currentStageDays: number;
  geography: { country: string; region?: string; city?: string };
  investmentStructure: { type: string; equityPercentage?: number };
  team?: Array<{ userId: string; name: string; role: string }>;
  riskLevel?: string;
}

interface DealHeaderProps {
  deal: Deal;
  onStageChange: (stage: string) => void;
  onEdit: () => void;
}

const DEAL_STAGES = [
  'screening',
  'initial_review',
  'preliminary_dd',
  'detailed_dd',
  'ic_memo',
  'ic_approval',
  'negotiation',
  'documentation',
  'closing',
  'post_closing'
];

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

function formatStageName(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getSectorColor(sector: string): string {
  const colors: Record<string, string> = {
    healthcare: 'bg-rose-500',
    energy: 'bg-amber-500',
    transport: 'bg-blue-500',
    water: 'bg-cyan-500',
    digital: 'bg-violet-500',
    social: 'bg-emerald-500',
    financial: 'bg-indigo-500'
  };
  return colors[sector] || 'bg-gray-500';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    on_hold: 'bg-amber-100 text-amber-700',
    closed_won: 'bg-blue-100 text-blue-700',
    closed_lost: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-600',
    high: 'bg-amber-100 text-amber-600',
    urgent: 'bg-red-100 text-red-600'
  };
  return colors[priority] || 'bg-gray-100 text-gray-600';
}

function getCountryFlag(country: string): string {
  const flags: Record<string, string> = {
    UG: '🇺🇬',
    KE: '🇰🇪',
    TZ: '🇹🇿',
    RW: '🇷🇼',
    ET: '🇪🇹',
  };
  return flags[country] || '🌍';
}

export function DealHeader({ deal, onStageChange, onEdit }: DealHeaderProps) {
  const currentStageIndex = DEAL_STAGES.indexOf(deal.stage);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      {/* Top Row */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          {/* Sector Icon */}
          <div className={`p-3 rounded-xl ${getSectorColor(deal.sector)}`}>
            <Building2 className="w-8 h-8 text-white" />
          </div>
          
          {/* Title & Code */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{deal.name}</h1>
              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(deal.status)}`}>
                {deal.status.replace('_', ' ')}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(deal.priority)}`}>
                {deal.priority}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-gray-500 text-sm">
              <span className="font-mono">{deal.dealCode}</span>
              <span>•</span>
              <span>{getCountryFlag(deal.geography.country)} {deal.geography.city || deal.geography.country}</span>
              <span>•</span>
              <span className="capitalize">{deal.dealType.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={onEdit}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <div className="relative group">
            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10">
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <Copy className="w-4 h-4" />
                Duplicate Deal
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <ExternalLink className="w-4 h-4" />
                Export to PDF
              </button>
              <hr className="my-1" />
              <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                <Archive className="w-4 h-4" />
                Archive Deal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Progress */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Pipeline Progress</span>
          <span className="text-sm text-gray-500">
            {deal.currentStageDays} days in {formatStageName(deal.stage)}
          </span>
        </div>
        <div className="flex gap-1">
          {DEAL_STAGES.map((stage, index) => (
            <button
              key={stage}
              className={`flex-1 h-2 rounded-full transition-colors ${
                index < currentStageIndex 
                  ? 'bg-green-500'
                  : index === currentStageIndex
                    ? 'bg-blue-600'
                    : 'bg-gray-200'
              }`}
              onClick={() => onStageChange(stage)}
              title={formatStageName(stage)}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">Screening</span>
          <span className="text-xs text-gray-400">Post-Closing</span>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6 pt-6 border-t border-gray-200">
        <MetricItem
          label="Target Investment"
          value={formatCurrency(deal.targetInvestment.amount)}
          icon={<DollarSign className="w-4 h-4" />}
        />
        <MetricItem
          label="Investment Type"
          value={deal.investmentStructure.type.replace(/_/g, ' ')}
          subValue={deal.investmentStructure.equityPercentage 
            ? `${deal.investmentStructure.equityPercentage}% equity` 
            : undefined
          }
        />
        <MetricItem
          label="Expected Close"
          value={deal.expectedCloseDate 
            ? formatDate(deal.expectedCloseDate) 
            : 'Not set'
          }
          icon={<Calendar className="w-4 h-4" />}
        />
        <MetricItem
          label="Sector"
          value={deal.sector}
          subValue={deal.subsector}
        />
        <MetricItem
          label="Deal Team"
          value={`${deal.team?.length || 0} members`}
          icon={<Users className="w-4 h-4" />}
        />
        <MetricItem
          label="Risk Level"
          value={deal.riskLevel || 'Not assessed'}
          icon={deal.riskLevel === 'high' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : undefined}
        />
      </div>
    </div>
  );
}

interface MetricItemProps {
  label: string;
  value: string;
  subValue?: string;
  icon?: React.ReactNode;
}

function MetricItem({ label, value, subValue, icon }: MetricItemProps) {
  return (
    <div>
      <p className="text-xs text-gray-500 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="font-semibold mt-1 capitalize">{value}</p>
      {subValue && <p className="text-xs text-gray-400">{subValue}</p>}
    </div>
  );
}

export default DealHeader;
