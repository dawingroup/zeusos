/**
 * DD Progress Ring - Visual progress indicator for due diligence
 */

import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

interface Workstream {
  id: string;
  type: string;
  progress: number;
  status: string;
  tasksComplete: number;
  totalTasks: number;
}

interface DueDiligence {
  id: string;
  overallProgress: number;
  workstreams: Workstream[];
  redFlags: number;
  findings: number;
}

interface DDProgressRingProps {
  dueDiligence: DueDiligence;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function DDProgressRing({ dueDiligence, size = 'md', onClick }: DDProgressRingProps) {
  const { overallProgress, workstreams, redFlags, findings } = dueDiligence;

  const sizeConfig = {
    sm: { ring: 80, stroke: 6, text: 'text-lg' },
    md: { ring: 120, stroke: 8, text: 'text-2xl' },
    lg: { ring: 160, stroke: 10, text: 'text-3xl' }
  };

  const config = sizeConfig[size];
  const radius = (config.ring - config.stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (overallProgress / 100) * circumference;

  const getStatusColor = () => {
    if (redFlags > 0) return 'text-red-500';
    if (overallProgress >= 100) return 'text-green-500';
    if (overallProgress >= 50) return 'text-blue-500';
    return 'text-amber-500';
  };

  const getStrokeColor = () => {
    if (redFlags > 0) return '#ef4444';
    if (overallProgress >= 100) return '#22c55e';
    return '#3b82f6';
  };

  return (
    <div 
      className={`bg-white rounded-lg border border-gray-200 p-6 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <h3 className="text-base font-semibold mb-4">Due Diligence Progress</h3>
      
      <div className="flex flex-col items-center">
        {/* Progress Ring */}
        <div className="relative" style={{ width: config.ring, height: config.ring }}>
          <svg width={config.ring} height={config.ring} className="-rotate-90">
            {/* Background circle */}
            <circle
              cx={config.ring / 2}
              cy={config.ring / 2}
              r={radius}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={config.stroke}
            />
            {/* Progress circle */}
            <circle
              cx={config.ring / 2}
              cy={config.ring / 2}
              r={radius}
              fill="none"
              stroke={getStrokeColor()}
              strokeWidth={config.stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`font-bold ${config.text} ${getStatusColor()}`}>
              {overallProgress.toFixed(0)}%
            </span>
          </div>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4 mt-4">
          {redFlags > 0 && (
            <div className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">{redFlags} Red Flags</span>
            </div>
          )}
          {findings > 0 && redFlags === 0 && (
            <div className="flex items-center gap-1 text-amber-500">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{findings} Findings</span>
            </div>
          )}
          {overallProgress >= 100 && redFlags === 0 && (
            <div className="flex items-center gap-1 text-green-500">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Complete</span>
            </div>
          )}
        </div>

        {/* Workstream breakdown */}
        {size !== 'sm' && (
          <div className="w-full mt-4 space-y-2">
            {workstreams.map(ws => (
              <div key={ws.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-24 truncate capitalize">
                  {ws.type.replace(/_/g, ' ')}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      ws.progress >= 100 
                        ? 'bg-green-500' 
                        : ws.progress > 0 
                          ? 'bg-blue-500' 
                          : 'bg-gray-300'
                    }`}
                    style={{ width: `${ws.progress}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-10 text-right">
                  {ws.progress.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DDProgressRing;
