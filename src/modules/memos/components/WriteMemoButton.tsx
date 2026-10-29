/**
 * "Write memo" — drop on any record page to start a memo already linked to
 * that record. Any signed-in staff member may write a memo.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { memoNewUrlForRecord, type MemoPrefillSource } from '../utils/memoPrefill';

export interface WriteMemoButtonProps extends MemoPrefillSource {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function WriteMemoButton({ children, className, style, ...source }: WriteMemoButtonProps) {
  if (!source.id) return null;
  return (
    <Link
      to={memoNewUrlForRecord(source)}
      className={className ?? 'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium'}
      style={className ? style : { border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', ...style }}
      title="Write a memo that gives written context for a decision on this record"
    >
      <FileText className="h-3.5 w-3.5" />
      {children ?? 'Write memo'}
    </Link>
  );
}
