import * as React from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type BannerTone = 'info' | 'warning' | 'danger' | 'success';

export interface BannerProps {
  tone?: BannerTone;
  title: React.ReactNode;
  message?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const TONE = {
  info:    { bg: 'var(--rag-blue-soft)',  fg: 'var(--rag-blue)',   Icon: Info },
  warning: { bg: 'var(--rag-amber-soft)', fg: 'var(--rag-amber)',  Icon: AlertTriangle },
  danger:  { bg: 'var(--rag-red-soft)',   fg: 'var(--rag-red)',    Icon: AlertCircle },
  success: { bg: 'var(--rag-green-soft)', fg: 'var(--rag-green)',  Icon: CheckCircle2 },
} as const;

/**
 * Full-width inline alert banner — used for payroll readiness,
 * expiring documents, system-wide notices, etc.
 */
export function Banner({
  tone = 'info',
  title,
  message,
  icon,
  actions,
  onDismiss,
  className,
}: BannerProps) {
  const { bg, fg, Icon } = TONE[tone];
  return (
    <div
      className={cn(
        'flex items-start gap-3 px-5 py-3.5 rounded-[10px] border',
        className
      )}
      style={{
        backgroundColor: bg,
        borderColor: 'transparent',
        color: 'var(--fg-primary)',
      }}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div className="shrink-0 mt-0.5" style={{ color: fg }}>
        {icon ?? <Icon className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold leading-tight" style={{ color: fg }}>
          {title}
        </div>
        {message && (
          <div
            className="mt-0.5 text-[12.5px] leading-snug"
            style={{ color: 'var(--fg-secondary)' }}
          >
            {message}
          </div>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 ml-2">{actions}</div>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] hover:bg-black/5 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
