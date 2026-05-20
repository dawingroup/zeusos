/**
 * DfM Checker Component
 * Design for Manufacturing validation
 */

import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import type { DesignItemFull, DfMIssue } from '../../types';

export interface DfMCheckerProps {
  designItem: DesignItemFull;
  onIssuesFound: (issues: DfMIssue[]) => void;
  onResolveIssue?: (ruleId: string) => void;
  className?: string;
}

const SEVERITY_CONFIG = {
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: '❌',
    label: 'Error',
    textColor: 'text-red-800',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    icon: '⚠️',
    label: 'Warning',
    textColor: 'text-yellow-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'ℹ️',
    label: 'Info',
    textColor: 'text-blue-800',
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  material: 'Material',
  hardware: 'Hardware',
  'tool-access': 'Tool Access',
  joinery: 'Joinery',
  finish: 'Finish',
  dimension: 'Dimensions',
  assembly: 'Assembly',
};

export function DfMChecker({
  designItem,
  onIssuesFound,
  onResolveIssue,
  className,
}: DfMCheckerProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [issues, setIssues] = useState<DfMIssue[]>([]);
  const [hasChecked, setHasChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolvedRules, setResolvedRules] = useState<Set<string>>(new Set());

  const runCheck = async () => {
    setIsChecking(true);
    setError(null);

    try {
      // Build parameters from design item for DfM check
      const parameters = {
        dimensions: designItem.parameters?.dimensions || { width: null, height: null, depth: null, unit: 'mm' },
        primaryMaterial: designItem.parameters?.primaryMaterial || null,
        secondaryMaterials: designItem.parameters?.secondaryMaterials || [],
        edgeBanding: designItem.parameters?.edgeBanding || null,
        hardware: designItem.parameters?.hardware || [],
        finish: designItem.parameters?.finish || null,
        constructionMethod: designItem.parameters?.constructionMethod || 'frameless',
        joineryTypes: designItem.parameters?.joineryTypes || [],
      };

      const response = await fetch('https://api-okekivpl2a-uc.a.run.app/api/ai/dfm-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designItemId: designItem.id,
          projectId: designItem.projectId,
          parameters,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'DfM check failed');
      }

      setIssues(data.issues || []);
      setHasChecked(true);
      onIssuesFound(data.issues || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check failed');
    } finally {
      setIsChecking(false);
    }
  };

  const handleResolve = (ruleId: string) => {
    setResolvedRules(prev => new Set([...prev, ruleId]));
    onResolveIssue?.(ruleId);
  };

  const activeIssues = issues.filter(i => !resolvedRules.has(i.ruleId || ''));
  const errorCount = activeIssues.filter(i => i.severity === 'error').length;
  const warningCount = activeIssues.filter(i => i.severity === 'warning').length;
  const infoCount = activeIssues.filter(i => i.severity === 'info').length;

  const groupedIssues: Record<string, DfMIssue[]> = activeIssues.reduce((acc, issue) => {
    const cat = issue.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(issue);
    return acc;
  }, {} as Record<string, DfMIssue[]>);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">DfM Check</h3>
          <p className="text-sm text-gray-500">
            Design for Manufacturing validation
          </p>
        </div>

        <button
          onClick={runCheck}
          disabled={isChecking}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            isChecking
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#1d1d1f] text-white hover:bg-[#424245]'
          )}
        >
          {isChecking ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Checking...
            </span>
          ) : hasChecked ? (
            '🔄 Re-run Check'
          ) : (
            '🔍 Run DfM Check'
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results Summary */}
      {hasChecked && (
        <div className={cn(
          'p-4 rounded-lg border',
          errorCount > 0 ? 'bg-red-50 border-red-200' :
          warningCount > 0 ? 'bg-yellow-50 border-yellow-200' :
          'bg-green-50 border-green-200'
        )}>
          <div className="flex items-center gap-4">
            <span className="text-2xl">
              {errorCount > 0 ? '❌' : warningCount > 0 ? '⚠️' : '✅'}
            </span>
            <div>
              <h4 className={cn(
                'font-medium',
                errorCount > 0 ? 'text-red-800' :
                warningCount > 0 ? 'text-yellow-800' :
                'text-green-800'
              )}>
                {errorCount > 0 
                  ? `${errorCount} Error${errorCount > 1 ? 's' : ''} Found`
                  : warningCount > 0
                  ? `${warningCount} Warning${warningCount > 1 ? 's' : ''}`
                  : 'All Checks Passed'}
              </h4>
              <p className="text-sm text-gray-600">
                {errorCount} errors, {warningCount} warnings, {infoCount} info
                {resolvedRules.size > 0 && ` (${resolvedRules.size} resolved)`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Issues by Category */}
      {hasChecked && activeIssues.length > 0 && (
        <div className="space-y-4">
          {Object.entries(groupedIssues).map(([category, categoryIssues]: [string, DfMIssue[]]) => (
            <div key={category} className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b">
                <h5 className="text-sm font-medium text-gray-700">
                  {CATEGORY_LABELS[category] || category} ({categoryIssues.length})
                </h5>
              </div>
              
              <div className="divide-y">
                {categoryIssues.map((issue: DfMIssue, index: number) => {
                  const config = SEVERITY_CONFIG[issue.severity];
                  return (
                    <div
                      key={index}
                      className={cn('p-4', config.bg)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-lg flex-shrink-0">{config.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded',
                              config.border,
                              config.textColor
                            )}>
                              {config.label}
                            </span>
                            {issue.affectedComponent && (
                              <span className="text-xs text-gray-500">
                                {issue.affectedComponent}
                              </span>
                            )}
                          </div>
                          
                          <p className={cn('text-sm', config.textColor)}>
                            {issue.description}
                          </p>
                          
                          {issue.suggestedFix && (
                            <div className="mt-2 p-2 bg-white/50 rounded text-sm">
                              <strong className="text-gray-700">Suggested Fix:</strong>{' '}
                              <span className="text-gray-600">{issue.suggestedFix}</span>
                            </div>
                          )}
                        </div>
                        
                        {onResolveIssue && issue.ruleId && (
                          <button
                            onClick={() => handleResolve(issue.ruleId!)}
                            className="flex-shrink-0 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 border rounded hover:bg-white"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Issues */}
      {hasChecked && activeIssues.length === 0 && (
        <div className="text-center py-8">
          <span className="text-4xl">✅</span>
          <p className="mt-2 text-sm text-gray-600">
            No manufacturing issues detected
          </p>
        </div>
      )}

      {/* Pre-check Info */}
      {!hasChecked && !isChecking && (
        <div className="p-6 bg-gray-50 rounded-lg text-center">
          <span className="text-3xl">🔧</span>
          <p className="mt-2 text-sm text-gray-600">
            Run a DfM check to validate this design against 50+ manufacturing rules
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Checks include material rules, tool access, joinery, hardware clearances, and finish requirements
          </p>
        </div>
      )}
    </div>
  );
}

export default DfMChecker;
