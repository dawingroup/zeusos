import { RagBadge, type RagTone } from './RagBadge';
import { enumLabel } from '@/shared/utils/enumLabel';

/**
 * A status/category pill whose colour comes from the module's `*_TONE` map
 * and whose TEXT is a label, never the enum value. Drop-in for the common
 * `<RagBadge tone={X_TONE[v]}>{v}</RagBadge>` shape that printed `in_progress`.
 */
export function EnumChip<K extends string>({
  value,
  tones,
  labels,
  className,
  hideDot,
}: {
  value: K | string | null | undefined;
  tones?: Partial<Record<K, RagTone>> | Record<string, RagTone>;
  labels?: Partial<Record<K, string>> | Record<string, string>;
  className?: string;
  hideDot?: boolean;
}) {
  const tone = (value && (tones as Record<string, RagTone> | undefined)?.[value]) || 'na';
  return (
    <RagBadge tone={tone} className={className} hideDot={hideDot}>
      {enumLabel(value, labels)}
    </RagBadge>
  );
}

export default EnumChip;
