import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    style={{
      backgroundColor: 'rgba(20, 20, 22, 0.4)',
      backdropFilter: 'blur(2px)',
      WebkitBackdropFilter: 'blur(2px)',
    }}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  /** Hides the built-in close button — set when consumer renders its own. */
  hideClose?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, hideClose, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-[96vw] max-w-[440px] -translate-x-1/2 -translate-y-1/2 gap-4 p-6 duration-200',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        className
      )}
      style={{
        backgroundColor: 'var(--bg-surface)',
        color: 'var(--fg-primary)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-default)',
      }}
      {...props}
    >
      {children}
      {!hideClose && (
        <DialogPrimitive.Close
          className="absolute right-3.5 top-3.5 h-7 w-7 inline-flex items-center justify-center rounded-md text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)] hover:bg-[var(--bg-sunken)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)] disabled:pointer-events-none"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const KIND_META = {
  danger: { Icon: AlertCircle, color: 'var(--rag-red)', bg: 'var(--rag-red-soft)' },
  warn: { Icon: AlertTriangle, color: 'var(--rag-amber)', bg: 'var(--rag-amber-soft)' },
  info: { Icon: Info, color: 'var(--rag-blue)', bg: 'var(--rag-blue-soft)' },
  success: { Icon: CheckCircle2, color: 'var(--rag-green)', bg: 'var(--rag-green-soft)' },
} as const;

export type DialogKind = keyof typeof KIND_META;

const DialogHeader = ({
  className,
  kind,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { kind?: DialogKind }) => {
  const meta = kind ? KIND_META[kind] : null;
  const Icon = meta?.Icon;
  return (
    <div
      className={cn(
        'flex items-start gap-3 text-left',
        className
      )}
      {...props}
    >
      {Icon && meta && (
        <div
          className="h-10 w-10 shrink-0 rounded-lg grid place-items-center"
          style={{ backgroundColor: meta.bg, color: meta.color }}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="flex flex-col gap-1 min-w-0 flex-1">{children}</div>
    </div>
  );
};
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2',
      className
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-[16px] font-semibold leading-tight', className)}
    style={{ color: 'var(--fg-primary)', letterSpacing: '-0.01em', ...style }}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, style, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-[13px]', className)}
    style={{ color: 'var(--fg-secondary)', ...style }}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
