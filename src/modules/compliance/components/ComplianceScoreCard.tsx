/**
 * ComplianceScoreCard
 * Visual compliance health score (0-100) with color coding.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Shield } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface ComplianceScoreCardProps {
  score: number;
  totalDocuments: number;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-[var(--rag-green)]';
  if (score >= 60) return 'text-[var(--rag-amber)]';
  if (score >= 40) return 'text-[var(--rag-amber)]';
  return 'text-[var(--rag-red)]';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-[var(--rag-green)]';
  if (score >= 60) return 'stroke-[var(--rag-amber)]';
  if (score >= 40) return 'stroke-[var(--rag-amber)]';
  return 'stroke-[var(--rag-red)]';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Attention';
  return 'Critical';
}

export function ComplianceScoreCard({ score, totalDocuments }: ComplianceScoreCardProps) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-[var(--rag-green)]" />
          Compliance Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                className="stroke-muted"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                className={getScoreRingColor(score)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={cn('text-2xl font-bold', getScoreColor(score))}>{score}</span>
            </div>
          </div>
          <div>
            <p className={cn('text-lg font-semibold', getScoreColor(score))}>
              {getScoreLabel(score)}
            </p>
            <p className="text-sm text-muted-foreground">
              {totalDocuments} document{totalDocuments !== 1 ? 's' : ''} tracked
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
