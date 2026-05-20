/**
 * MaterialRuleIndicator — Shows material compatibility status
 * Compatible / Conditional / Incompatible based on DKB material rules
 */
import { useQuery } from '@tanstack/react-query';
import { getMaterialRules } from '../../services/knowledgeBase.service';

interface MaterialRuleIndicatorProps {
  finishCategory: string;
  substrateCategory: string;
}

export function MaterialRuleIndicator({
  finishCategory,
  substrateCategory,
}: MaterialRuleIndicatorProps) {
  const { data: rules, isLoading } = useQuery({
    queryKey: ['materialRules', finishCategory, substrateCategory],
    queryFn: () => getMaterialRules(finishCategory, substrateCategory),
    enabled: !!finishCategory && !!substrateCategory,
  });

  if (isLoading) {
    return <span className="text-[10px] text-muted-foreground">Checking...</span>;
  }

  if (!rules || rules.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
        No rules found
      </span>
    );
  }

  // Check for incompatible pairs
  const hasIncompatible = rules.some(rule =>
    rule.incompatiblePairs.some(
      p =>
        (p.a === finishCategory && p.b === substrateCategory) ||
        (p.a === substrateCategory && p.b === finishCategory),
    ),
  );

  // Check for compatible pairs
  const hasCompatible = rules.some(rule =>
    rule.compatiblePairs.some(
      p =>
        (p.a === finishCategory && p.b === substrateCategory) ||
        (p.a === substrateCategory && p.b === finishCategory),
    ),
  );

  if (hasIncompatible) {
    const reason = rules
      .flatMap(r => r.incompatiblePairs)
      .find(
        p =>
          (p.a === finishCategory && p.b === substrateCategory) ||
          (p.a === substrateCategory && p.b === finishCategory),
      )?.reason;

    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] text-destructive"
        title={reason || 'Incompatible combination'}
      >
        <span className="w-2 h-2 rounded-full bg-destructive" />
        Incompatible
      </span>
    );
  }

  if (hasCompatible) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-green-600">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        Compatible
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-yellow-600">
      <span className="w-2 h-2 rounded-full bg-yellow-500" />
      Conditional
    </span>
  );
}
