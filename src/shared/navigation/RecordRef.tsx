import type { CSSProperties, ReactNode } from 'react';
import { Skeleton } from '@/core/components/ui/skeleton';
import { RecordLink } from './RecordLink';
import { resolveRecordTarget, type RecordEntityType, type RecordTargetParams } from './recordRoutes';
import { RECORD_TYPE_NOUN } from './recordLabels';
import { useRecordLabel } from './useRecordLabel';

export interface RecordRefProps extends Omit<RecordTargetParams, 'id'> {
  type: RecordEntityType;
  id: string | null | undefined;
  /** Render the secondary line (the title beside its code) after the primary. */
  withSecondary?: boolean;
  /** Shown while resolving. */
  loadingFallback?: ReactNode;
  /** Shown when there is no id. */
  empty?: ReactNode;
  /** Wrap the label in a RecordLink when the type has a page. */
  link?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * A linked record rendered by NAME — the code or title a person knows it
 * by — with the id only ever in the tooltip. Unresolvable (no access, no
 * such record) shows the record type's noun, never the id.
 */
export function RecordRef({
  type,
  id,
  clientId,
  msaId,
  sowId,
  withSecondary = false,
  loadingFallback,
  empty = '—',
  link = true,
  className,
  style,
}: RecordRefProps) {
  const { label, loading } = useRecordLabel(type, id);
  if (!id) return <span className={className} style={style}>{empty}</span>;

  if (loading) {
    return (
      <span className={className} style={style} data-record-loading="">
        {loadingFallback ?? <Skeleton className="inline-block h-3 w-16 align-middle" />}
      </span>
    );
  }

  const text = label ? (
    <>
      {label.primary}
      {withSecondary && label.secondary ? <span className="opacity-70"> · {label.secondary}</span> : null}
    </>
  ) : (
    RECORD_TYPE_NOUN[type]
  );

  const routed = link && resolveRecordTarget(type, { id, clientId, msaId, sowId }).path;
  if (routed) {
    return (
      <RecordLink type={type} id={id} clientId={clientId} msaId={msaId} sowId={sowId} className={className} style={style} title={label?.secondary ?? id}>
        {text}
      </RecordLink>
    );
  }
  return (
    <span className={className} style={style} title={label ? label.secondary ?? id : id} data-record-unresolved={label ? undefined : ''}>
      {text}
    </span>
  );
}

export default RecordRef;
