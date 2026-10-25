/**
 * RecordLink — a reference to another record as a link to its detail page,
 * degrading to plain text when there is nothing to link to.
 *
 * The destination comes from `resolveRecordTarget`, so a link and the route
 * table can never disagree. Access is still enforced by the route's guard;
 * `RecordTarget.guard` is carried so a later pass can hide links the signed-in
 * person could not open, the way the guards decide it.
 *
 *   <RecordLink type="masterJob" id={job.id}>{job.code}</RecordLink>
 */
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { resolveRecordTarget, type RecordEntityType, type RecordTargetParams } from './recordRoutes';

export interface RecordLinkProps extends Omit<RecordTargetParams, 'id'> {
  type: RecordEntityType;
  id: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function RecordLink({ type, id, clientId, msaId, sowId, children, className, style, title }: RecordLinkProps) {
  const target = resolveRecordTarget(type, { id, clientId, msaId, sowId });

  if (!target.path) {
    return (
      <span className={className} style={style} title={title}>
        {children}
      </span>
    );
  }

  return (
    <Link
      to={target.path}
      className={`hover:underline ${className ?? ''}`.trim()}
      style={{ color: 'var(--accent)', cursor: 'pointer', ...style }}
      title={title}
      // Don't also trigger an enclosing clickable row.
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}

export default RecordLink;
