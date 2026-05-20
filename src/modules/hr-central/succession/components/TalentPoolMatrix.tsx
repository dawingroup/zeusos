// ============================================================================
// TALENT POOL MATRIX (9-BOX GRID)
// DawinOS v2.0 - HR Module
// Displays talent in a 9-box grid format
// ============================================================================

import React from 'react';
import { SuccessorCandidate, TalentPoolMember } from '../types/succession.types';
import {
  NINE_BOX_CATEGORIES,
  NINE_BOX_COLORS,
  NineBoxCategory,
} from '../constants/succession.constants';

interface TalentPoolMatrixProps {
  members: (SuccessorCandidate | TalentPoolMember)[];
  onMemberClick?: (memberId: string) => void;
  compact?: boolean;
}

interface GridCell {
  category: NineBoxCategory;
  label: string;
  row: number;
  col: number;
  color: string;
}

const GRID_LAYOUT: GridCell[] = [
  { category: NINE_BOX_CATEGORIES.FUTURE_STAR, label: 'Future Star', row: 0, col: 0, color: NINE_BOX_COLORS.future_star },
  { category: NINE_BOX_CATEGORIES.HIGH_POTENTIAL, label: 'High Potential', row: 0, col: 1, color: NINE_BOX_COLORS.high_potential },
  { category: NINE_BOX_CATEGORIES.STAR, label: 'Star', row: 0, col: 2, color: NINE_BOX_COLORS.star },
  { category: NINE_BOX_CATEGORIES.INCONSISTENT, label: 'Inconsistent', row: 1, col: 0, color: NINE_BOX_COLORS.inconsistent },
  { category: NINE_BOX_CATEGORIES.CORE_PLAYER, label: 'Core Player', row: 1, col: 1, color: NINE_BOX_COLORS.core_player },
  { category: NINE_BOX_CATEGORIES.HIGH_PERFORMER, label: 'High Performer', row: 1, col: 2, color: NINE_BOX_COLORS.high_performer },
  { category: NINE_BOX_CATEGORIES.UNDERPERFORMER, label: 'Underperformer', row: 2, col: 0, color: NINE_BOX_COLORS.underperformer },
  { category: NINE_BOX_CATEGORIES.AVERAGE_PERFORMER, label: 'Average', row: 2, col: 1, color: NINE_BOX_COLORS.average_performer },
  { category: NINE_BOX_CATEGORIES.SOLID_PERFORMER, label: 'Solid Performer', row: 2, col: 2, color: NINE_BOX_COLORS.solid_performer },
];

export const TalentPoolMatrix: React.FC<TalentPoolMatrixProps> = ({
  members,
  onMemberClick,
  compact = false,
}) => {
  const getMembersByCategory = (category: NineBoxCategory) => {
    return members.filter(m => m.nineBoxCategory === category);
  };

  const getMemberName = (member: SuccessorCandidate | TalentPoolMember): string => {
    return member.employeeName;
  };

  const getMemberId = (member: SuccessorCandidate | TalentPoolMember): string => {
    return 'id' in member ? member.id : member.employeeId;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">9-Box Talent Matrix</h3>
        <span className="text-sm text-gray-500">{members.length} members</span>
      </div>

      {/* Axis Labels */}
      <div className="relative">
        {/* Y-Axis Label */}
        <div className="absolute -left-8 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-medium text-gray-500 whitespace-nowrap">
          POTENTIAL →
        </div>

        {/* X-Axis Label */}
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs font-medium text-gray-500">
          PERFORMANCE →
        </div>

        {/* Grid */}
        <div className="grid grid-cols-3 gap-1 ml-4">
          {GRID_LAYOUT.map((cell) => {
            const cellMembers = getMembersByCategory(cell.category);
            return (
              <div
                key={cell.category}
                className={`relative border rounded-lg ${
                  compact ? 'p-2 min-h-[80px]' : 'p-3 min-h-[120px]'
                }`}
                style={{
                  backgroundColor: `${cell.color}10`,
                  borderColor: `${cell.color}40`,
                }}
              >
                {/* Cell Header */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-xs font-medium"
                    style={{ color: cell.color }}
                  >
                    {compact ? cell.label.split(' ')[0] : cell.label}
                  </span>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: cell.color }}
                  >
                    {cellMembers.length}
                  </span>
                </div>

                {/* Members */}
                <div className={`space-y-1 ${compact ? 'max-h-[60px]' : 'max-h-[80px]'} overflow-y-auto`}>
                  {cellMembers.slice(0, compact ? 2 : 4).map((member) => (
                    <button
                      key={getMemberId(member)}
                      onClick={() => onMemberClick?.(getMemberId(member))}
                      className="w-full text-left text-xs p-1 rounded bg-white hover:bg-gray-50 truncate shadow-sm"
                    >
                      {getMemberName(member)}
                    </button>
                  ))}
                  {cellMembers.length > (compact ? 2 : 4) && (
                    <span className="text-xs text-gray-500">
                      +{cellMembers.length - (compact ? 2 : 4)} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Action Guide:</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded" style={{ backgroundColor: `${NINE_BOX_COLORS.star}20`, color: NINE_BOX_COLORS.star }}>
            Stars: Promote
          </span>
          <span className="px-2 py-1 rounded" style={{ backgroundColor: `${NINE_BOX_COLORS.high_potential}20`, color: NINE_BOX_COLORS.high_potential }}>
            High Potential: Develop
          </span>
          <span className="px-2 py-1 rounded" style={{ backgroundColor: `${NINE_BOX_COLORS.core_player}20`, color: NINE_BOX_COLORS.core_player }}>
            Core Players: Maintain
          </span>
          <span className="px-2 py-1 rounded" style={{ backgroundColor: `${NINE_BOX_COLORS.underperformer}20`, color: NINE_BOX_COLORS.underperformer }}>
            Underperformers: Action
          </span>
        </div>
      </div>
    </div>
  );
};

export default TalentPoolMatrix;
