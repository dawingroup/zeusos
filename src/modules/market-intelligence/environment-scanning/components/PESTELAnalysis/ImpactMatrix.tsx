// ============================================================================
// IMPACT MATRIX COMPONENT
// DawinOS v2.0 - Market Intelligence Module
// 5x5 Impact vs Probability matrix for PESTEL factors
// ============================================================================

import React, { useMemo } from 'react';
import { PESTELFactor } from '../../types/scanning.types';
import {
  PESTEL_DIMENSION_CONFIG,
  IMPACT_LEVELS,
  PROBABILITY_LEVELS,
  IMPACT_LEVEL_CONFIG,
  PROBABILITY_LEVEL_CONFIG,
  PESTELDimension,
  ImpactLevel,
  ProbabilityLevel,
} from '../../constants/scanning.constants';

interface ImpactMatrixProps {
  factors: PESTELFactor[];
  onFactorClick?: (factor: PESTELFactor) => void;
  showLegend?: boolean;
}

const impactOrder: ImpactLevel[] = [
  IMPACT_LEVELS.VERY_LOW,
  IMPACT_LEVELS.LOW,
  IMPACT_LEVELS.MEDIUM,
  IMPACT_LEVELS.HIGH,
  IMPACT_LEVELS.VERY_HIGH,
];

const probabilityOrder: ProbabilityLevel[] = [
  PROBABILITY_LEVELS.RARE,
  PROBABILITY_LEVELS.UNLIKELY,
  PROBABILITY_LEVELS.POSSIBLE,
  PROBABILITY_LEVELS.LIKELY,
  PROBABILITY_LEVELS.VERY_LIKELY,
];

export const ImpactMatrix: React.FC<ImpactMatrixProps> = ({
  factors,
  onFactorClick,
  showLegend = true,
}) => {
  const factorsByCell = useMemo(() => {
    const map: Record<string, PESTELFactor[]> = {};
    
    factors.forEach(factor => {
      const key = `${factor.impact.level}-${factor.impact.probability}`;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(factor);
    });
    
    return map;
  }, [factors]);

  const getCellColor = (impactIdx: number, probIdx: number) => {
    const score = (impactIdx + 1) * (probIdx + 1);
    if (score >= 20) return 'bg-red-100';
    if (score >= 12) return 'bg-orange-100';
    if (score >= 6) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  const getQuadrantLabel = (impactIdx: number, probIdx: number) => {
    if (impactIdx >= 3 && probIdx >= 3) return 'Urgent';
    if (impactIdx >= 3 && probIdx < 3) return 'Prepare';
    if (impactIdx < 3 && probIdx >= 3) return 'Act';
    return 'Monitor';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Impact-Probability Matrix</h3>
      
      <div className="flex">
        {/* Y-axis label */}
        <div className="flex flex-col justify-center mr-2">
          <div className="transform -rotate-90 whitespace-nowrap text-sm font-medium text-gray-600">
            Impact
          </div>
        </div>

        <div className="flex-1">
          {/* Matrix Grid */}
          <div className="grid grid-cols-5 gap-1">
            {/* Render cells from top-left to bottom-right */}
            {impactOrder.slice().reverse().map((impact, impactIdx) => (
              probabilityOrder.map((probability, probIdx) => {
                const key = `${impact}-${probability}`;
                const cellFactors = factorsByCell[key] || [];
                const actualImpactIdx = 4 - impactIdx;
                
                return (
                  <div
                    key={key}
                    className={`aspect-square rounded-lg ${getCellColor(actualImpactIdx, probIdx)} 
                      flex items-center justify-center relative group transition-all
                      ${cellFactors.length > 0 ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : ''}`}
                  >
                    {cellFactors.length > 0 ? (
                      <div className="flex flex-wrap gap-0.5 p-1 justify-center">
                        {cellFactors.slice(0, 4).map((factor) => (
                          <div
                            key={factor.id}
                            className="w-3 h-3 rounded-full border-2 border-white shadow-sm cursor-pointer hover:scale-125 transition-transform"
                            style={{
                              backgroundColor: PESTEL_DIMENSION_CONFIG[factor.dimension as PESTELDimension]?.color || '#666',
                            }}
                            onClick={() => onFactorClick?.(factor)}
                            title={factor.title}
                          />
                        ))}
                        {cellFactors.length > 4 && (
                          <div className="w-3 h-3 rounded-full bg-gray-400 border-2 border-white shadow-sm flex items-center justify-center">
                            <span className="text-[6px] text-white font-bold">
                              +{cellFactors.length - 4}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100">
                        {getQuadrantLabel(actualImpactIdx, probIdx)}
                      </span>
                    )}

                    {/* Tooltip on hover */}
                    {cellFactors.length > 0 && (
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 
                        bg-gray-900 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 
                        pointer-events-none z-10 whitespace-nowrap">
                        {cellFactors.length} factor{cellFactors.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })
            ))}
          </div>

          {/* X-axis labels */}
          <div className="grid grid-cols-5 gap-1 mt-2">
            {probabilityOrder.map(prob => (
              <div key={prob} className="text-center">
                <span className="text-[10px] text-gray-500">
                  {PROBABILITY_LEVEL_CONFIG[prob]?.label}
                </span>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-1">
            <span className="text-sm font-medium text-gray-600">Probability</span>
          </div>
        </div>

        {/* Y-axis labels */}
        <div className="flex flex-col justify-between ml-2 py-1">
          {impactOrder.slice().reverse().map(impact => (
            <span key={impact} className="text-[10px] text-gray-500">
              {IMPACT_LEVEL_CONFIG[impact]?.label}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Dimensions:</span>
              {Object.entries(PESTEL_DIMENSION_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-xs text-gray-500">{config.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-100" />
              <span className="text-xs text-gray-500">Urgent (20-25)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-orange-100" />
              <span className="text-xs text-gray-500">Act (12-19)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-yellow-100" />
              <span className="text-xs text-gray-500">Prepare (6-11)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-100" />
              <span className="text-xs text-gray-500">Monitor (1-5)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImpactMatrix;
