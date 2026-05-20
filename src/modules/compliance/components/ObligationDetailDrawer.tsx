/**
 * ObligationDetailDrawer
 * Sheet showing obligation details, linked docs, completion actions.
 */

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';
import { Button } from '@/core/components/ui/button';
import {
  ClipboardCheck,
  Calendar,
  Building2,
  Clock,
  Tag,
  CheckCircle,
  Trash2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type { ComplianceObligation } from '../types';
import {
  CATEGORY_LABELS,
  REGULATORY_BODY_LABELS,
  FREQUENCY_LABELS,
  OBLIGATION_STATUS_LABELS,
  OBLIGATION_PRIORITY_LABELS,
  OBLIGATION_PRIORITY_COLORS,
} from '../types/constants';

interface ObligationDetailDrawerProps {
  obligation: ComplianceObligation | null;
  open: boolean;
  onClose: () => void;
  onComplete: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}

export function ObligationDetailDrawer({
  obligation,
  open,
  onClose,
  onComplete,
  onDelete,
}: ObligationDetailDrawerProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!obligation) return null;

  const nextDue = obligation.nextDueDate?.toDate();
  const lastCompleted = obligation.lastCompletedDate?.toDate();
  const isOverdue = nextDue && nextDue < new Date();

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(obligation.id);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            {obligation.title}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status & Priority */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2.5 py-1 rounded-full border font-medium bg-muted">
              {OBLIGATION_STATUS_LABELS[obligation.status]}
            </span>
            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', OBLIGATION_PRIORITY_COLORS[obligation.priority])}>
              {OBLIGATION_PRIORITY_LABELS[obligation.priority]}
            </span>
            {isOverdue && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Overdue
              </span>
            )}
          </div>

          {/* Description */}
          {obligation.description && (
            <p className="text-sm text-muted-foreground">{obligation.description}</p>
          )}

          {/* Details */}
          <div className="space-y-1 border rounded-md p-4">
            <InfoRow icon={Tag} label="Category" value={CATEGORY_LABELS[obligation.category]} />
            <InfoRow icon={Building2} label="Regulatory Body" value={REGULATORY_BODY_LABELS[obligation.regulatoryBody]} />
            <InfoRow icon={Clock} label="Frequency" value={FREQUENCY_LABELS[obligation.frequency]} />
            {obligation.dayOfMonthDue && (
              <InfoRow icon={Calendar} label="Day of Month Due" value={`${obligation.dayOfMonthDue}th`} />
            )}
            <InfoRow
              icon={isOverdue ? AlertTriangle : Calendar}
              label="Next Due Date"
              value={nextDue?.toLocaleDateString()}
            />
            <InfoRow icon={CheckCircle} label="Last Completed" value={lastCompleted?.toLocaleDateString()} />
          </div>

          {/* Required Documents */}
          {obligation.requiredDocumentTypes.length > 0 && (
            <div className="border rounded-md p-4">
              <p className="text-xs text-muted-foreground mb-2">Required Documents</p>
              <div className="flex flex-wrap gap-1.5">
                {obligation.requiredDocumentTypes.map(dt => (
                  <span key={dt} className="text-xs px-2 py-1 rounded bg-muted flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {dt.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Auto-task */}
          <div className="border rounded-md p-4">
            <p className="text-xs text-muted-foreground mb-1">Task Automation</p>
            <p className="text-sm">
              {obligation.autoCreateTasks
                ? 'Tasks are automatically created when this obligation is due'
                : 'Automatic task creation is disabled'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            {obligation.status === 'active' && (
              <Button size="sm" onClick={() => onComplete(obligation.id)}>
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                Mark Complete
              </Button>
            )}
            <Button
              variant={confirmDelete ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleDelete}
              className={confirmDelete ? '' : 'text-destructive'}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {confirmDelete ? 'Confirm Delete' : 'Delete'}
            </Button>
            {confirmDelete && (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
