// ============================================================================
// SECTION DIFF VIEWER - Strategy Plan Update Tool
// Side-by-side comparison of original vs rewrite content
// ============================================================================

import { useMemo } from 'react';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface SectionDiffViewerProps {
  original: string;
  rewrite: string;
  heading?: string;
}

// ----------------------------------------------------------------------------
// Simple word-level diff
// ----------------------------------------------------------------------------

interface DiffSegment {
  type: 'same' | 'added' | 'removed';
  text: string;
}

function computeWordDiff(a: string, b: string): { left: DiffSegment[]; right: DiffSegment[] } {
  const wordsA = a.split(/(\s+)/);
  const wordsB = b.split(/(\s+)/);

  // Simple LCS-based diff for word sequences
  const m = wordsA.length;
  const n = wordsB.length;

  // For very long texts, fall back to paragraph-level comparison
  if (m * n > 1_000_000) {
    return {
      left: [{ type: 'removed', text: a }],
      right: [{ type: 'added', text: b }],
    };
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = wordsA[i - 1] === wordsB[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack
  const left: DiffSegment[] = [];
  const right: DiffSegment[] = [];
  let i = m, j = n;

  const leftStack: DiffSegment[] = [];
  const rightStack: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && wordsA[i - 1] === wordsB[j - 1]) {
      leftStack.push({ type: 'same', text: wordsA[i - 1] });
      rightStack.push({ type: 'same', text: wordsB[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rightStack.push({ type: 'added', text: wordsB[j - 1] });
      j--;
    } else {
      leftStack.push({ type: 'removed', text: wordsA[i - 1] });
      i--;
    }
  }

  leftStack.reverse().forEach((s) => left.push(s));
  rightStack.reverse().forEach((s) => right.push(s));

  return { left, right };
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function SectionDiffViewer({ original, rewrite, heading }: SectionDiffViewerProps) {
  const diff = useMemo(() => computeWordDiff(original, rewrite), [original, rewrite]);

  return (
    <div className="rounded-lg border bg-card">
      {heading && (
        <div className="px-4 py-2 border-b bg-[var(--bg-sunken)]">
          <h4 className="text-sm font-medium text-muted-foreground">{heading}</h4>
        </div>
      )}
      <div className="grid grid-cols-2 divide-x">
        {/* Original */}
        <div className="p-4">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Original
          </h5>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {diff.left.map((seg, i) => (
              <span
                key={i}
                className={seg.type === 'removed' ? 'bg-red-100 text-red-800 line-through' : ''}
              >
                {seg.text}
              </span>
            ))}
          </div>
        </div>

        {/* Rewrite */}
        <div className="p-4">
          <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Rewrite
          </h5>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {diff.right.map((seg, i) => (
              <span
                key={i}
                className={seg.type === 'added' ? 'bg-green-100 text-green-800' : ''}
              >
                {seg.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
