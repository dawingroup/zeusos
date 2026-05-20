/**
 * Trend Insights Panel Component
 * Displays saved research findings
 */

import { ExternalLink, Trash2, TrendingUp, Target, Lightbulb, BarChart } from 'lucide-react';
import type { ResearchFinding } from './useStrategyResearch';

interface TrendInsightsPanelProps {
  findings: ResearchFinding[];
  onDelete: (findingId: string) => Promise<void>;
}

const CATEGORY_CONFIG = {
  trend: { icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
  benchmark: { icon: BarChart, color: 'text-blue-600', bg: 'bg-blue-50' },
  recommendation: { icon: Target, color: 'text-green-600', bg: 'bg-green-50' },
  insight: { icon: Lightbulb, color: 'text-amber-600', bg: 'bg-amber-50' },
};

export function TrendInsightsPanel({ findings, onDelete }: TrendInsightsPanelProps) {
  if (findings.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Lightbulb className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500">No research findings saved yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Use the Research Assistant to discover insights
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {findings.map((finding) => {
        const config = CATEGORY_CONFIG[finding.category] || CATEGORY_CONFIG.insight;
        const Icon = config.icon;

        return (
          <div
            key={finding.id}
            className="p-4 bg-gray-50 rounded-lg border border-gray-100 group"
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${config.bg}`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-gray-900 text-sm">{finding.title}</h4>
                  <button
                    onClick={() => onDelete(finding.id)}
                    className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-3">{finding.content}</p>
                
                {/* Sources */}
                {finding.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {finding.sources.map((source, i) => (
                      <a
                        key={i}
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Source {i + 1}
                      </a>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-400 mt-2">
                  {finding.createdAt.toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
