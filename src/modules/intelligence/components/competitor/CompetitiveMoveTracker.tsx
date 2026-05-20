// ============================================================================
// COMPETITIVE MOVE TRACKER
// DawinOS v2.0 - Market Intelligence Module
// Timeline view of competitive moves
// ============================================================================

import React from 'react';
import {
  Rocket,
  DollarSign,
  LogIn,
  LogOut,
  GitMerge,
  Users2,
  User,
  Wallet,
  Globe,
  Building,
  Megaphone,
  Cpu,
  Scale,
  TrendingUp,
  UserPlus,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { CompetitiveMove } from '../../types/competitor.types';
import {
  COMPETITIVE_MOVE_TYPE_LABELS,
  IMPACT_SIGNIFICANCE_LABELS,
  IMPACT_SIGNIFICANCE_SCORES,
  CompetitiveMoveType,
  ImpactSignificance,
} from '../../constants/competitor.constants';

interface CompetitiveMoveTrackerProps {
  moves: CompetitiveMove[];
  onViewMove?: (move: CompetitiveMove) => void;
  onAddMove?: () => void;
  maxItems?: number;
}

const getMoveIcon = (moveType: CompetitiveMoveType) => {
  const icons: Record<CompetitiveMoveType, React.ReactNode> = {
    product_launch: <Rocket className="w-4 h-4" />,
    price_change: <DollarSign className="w-4 h-4" />,
    market_entry: <LogIn className="w-4 h-4" />,
    market_exit: <LogOut className="w-4 h-4" />,
    acquisition: <GitMerge className="w-4 h-4" />,
    partnership: <Users2 className="w-4 h-4" />,
    leadership_change: <User className="w-4 h-4" />,
    funding_round: <Wallet className="w-4 h-4" />,
    expansion: <Globe className="w-4 h-4" />,
    restructuring: <Building className="w-4 h-4" />,
    marketing_campaign: <Megaphone className="w-4 h-4" />,
    technology_launch: <Cpu className="w-4 h-4" />,
    regulatory_filing: <Scale className="w-4 h-4" />,
    ipo_listing: <TrendingUp className="w-4 h-4" />,
    talent_hire: <UserPlus className="w-4 h-4" />,
  };
  return icons[moveType] || <AlertCircle className="w-4 h-4" />;
};

const getImpactColor = (significance: ImpactSignificance): string => {
  const score = IMPACT_SIGNIFICANCE_SCORES[significance];
  if (score >= 5) return 'bg-red-500';
  if (score >= 4) return 'bg-orange-500';
  if (score >= 3) return 'bg-amber-500';
  if (score >= 2) return 'bg-yellow-500';
  return 'bg-gray-400';
};

const getStatusColor = (status: CompetitiveMove['status']) => {
  switch (status) {
    case 'identified': return 'bg-blue-100 text-blue-700';
    case 'analyzing': return 'bg-purple-100 text-purple-700';
    case 'responded': return 'bg-green-100 text-green-700';
    case 'monitoring': return 'bg-amber-100 text-amber-700';
    case 'closed': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const formatDate = (timestamp: { toDate: () => Date }): string => {
  return timestamp.toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatRelativeDate = (timestamp: { toDate: () => Date }): string => {
  const date = timestamp.toDate();
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(timestamp);
};

export const CompetitiveMoveTracker: React.FC<CompetitiveMoveTrackerProps> = ({
  moves,
  onViewMove,
  onAddMove,
  maxItems,
}) => {
  const displayMoves = maxItems ? moves.slice(0, maxItems) : moves;

  if (moves.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center py-8">
          <Rocket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No competitive moves tracked</p>
          <p className="text-sm text-gray-500 mt-1">
            Start tracking competitor activities
          </p>
          {onAddMove && (
            <button
              onClick={onAddMove}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              Track Move
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-gray-900">Competitive Moves</h3>
          <p className="text-sm text-gray-500">{moves.length} moves tracked</p>
        </div>
        {onAddMove && (
          <button
            onClick={onAddMove}
            className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            + Track Move
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {displayMoves.map((move, index) => (
          <div
            key={move.id}
            className="p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => onViewMove?.(move)}
          >
            <div className="flex items-start gap-3">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${getImpactColor(move.impactSignificance)}`}
                >
                  {getMoveIcon(move.moveType)}
                </div>
                {index < displayMoves.length - 1 && (
                  <div className="w-0.5 flex-1 bg-gray-200 mt-2" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-medium text-gray-900">{move.title}</h4>
                    <p className="text-sm text-gray-500">
                      {move.competitorName} • {COMPETITIVE_MOVE_TYPE_LABELS[move.moveType]}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(move.status)}`}>
                      {move.status.charAt(0).toUpperCase() + move.status.slice(1)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </div>

                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {move.description}
                </p>

                {/* Impact & Date */}
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>{IMPACT_SIGNIFICANCE_LABELS[move.impactSignificance]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeDate(move.dateObserved)}</span>
                  </div>
                  {move.impactedSubsidiaries.length > 0 && (
                    <span>
                      Affects: {move.impactedSubsidiaries.join(', ')}
                    </span>
                  )}
                </div>

                {/* Response */}
                {move.ourResponse && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-sm text-green-700">
                    <span className="font-medium">Our response: </span>
                    {move.ourResponse}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {maxItems && moves.length > maxItems && (
        <div className="p-3 border-t border-gray-200 text-center">
          <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            View all {moves.length} moves
          </button>
        </div>
      )}
    </div>
  );
};

export default CompetitiveMoveTracker;
