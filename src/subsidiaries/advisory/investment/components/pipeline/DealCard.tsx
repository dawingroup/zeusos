/**
 * Deal Card - Compact card for Kanban board
 */

import { 
  Building2, 
  Calendar, 
  AlertTriangle,
  Heart,
  Factory,
  Leaf,
  Cpu,
  Users,
  Landmark
} from 'lucide-react';

type DealStage = 
  | 'screening'
  | 'initial_review'
  | 'preliminary_dd'
  | 'detailed_dd'
  | 'ic_memo'
  | 'ic_approval'
  | 'negotiation'
  | 'documentation'
  | 'closing'
  | 'post_closing';

interface Deal {
  id: string;
  name: string;
  dealCode: string;
  stage: DealStage;
  sector: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  targetInvestment: { amount: number; currency: string };
  expectedCloseDate?: Date;
  currentStageDays: number;
  geography: { country: string };
  team?: Array<{ userId: string; name: string; avatarUrl?: string }>;
}

interface DealCardProps {
  deal: Deal;
  onClick?: () => void;
  isDragging?: boolean;
  isOverdue?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
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

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getSectorIcon(sector: string) {
  const icons: Record<string, typeof Building2> = {
    healthcare: Heart,
    energy: Factory,
    transport: Building2,
    water: Leaf,
    digital: Cpu,
    social: Users,
    financial: Landmark
  };
  return icons[sector] || Building2;
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
    GH: '🇬🇭',
    NG: '🇳🇬',
  };
  return flags[country] || '🌍';
}

export function DealCard({ 
  deal, 
  onClick, 
  isDragging, 
  isOverdue,
  onDragStart,
  onDragEnd
}: DealCardProps) {
  const SectorIcon = getSectorIcon(deal.sector);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`p-3 bg-white rounded-lg border cursor-pointer transition-all hover:shadow-md ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-blue-500' : ''
      } ${isOverdue ? 'border-l-4 border-l-amber-500' : 'border-gray-200'}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded ${getSectorColor(deal.sector)}`}>
            <SectorIcon className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{deal.name}</p>
            <p className="text-xs text-gray-500">{deal.dealCode}</p>
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${getPriorityColor(deal.priority)}`}>
          {deal.priority}
        </span>
      </div>

      {/* Investment Amount */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-semibold">
          {formatCurrency(deal.targetInvestment.amount)}
        </span>
        <span className="text-lg">
          {getCountryFlag(deal.geography.country)}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          <span>
            {deal.expectedCloseDate 
              ? formatDate(deal.expectedCloseDate)
              : 'No date'
            }
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <span>{deal.currentStageDays}d</span>
          {isOverdue && (
            <AlertTriangle className="w-3 h-3 text-amber-500" />
          )}
        </div>

        {/* Team Avatars */}
        {deal.team && deal.team.length > 0 && (
          <div className="flex -space-x-2">
            {deal.team.slice(0, 3).map((member) => (
              <div 
                key={member.userId} 
                className="w-5 h-5 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-[8px] font-medium text-gray-600"
                title={member.name}
              >
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
            ))}
            {deal.team.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[8px] border-2 border-white">
                +{deal.team.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DealCard;
