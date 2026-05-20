/**
 * AdjustmentApprovalActions
 * Approve/Reject buttons with rejection reason dialog.
 */

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Label } from '@/core/components/ui/label';
import { Textarea } from '@/core/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';

interface AdjustmentApprovalActionsProps {
  onApprove: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  approving?: boolean;
  rejecting?: boolean;
}

export function AdjustmentApprovalActions({
  onApprove,
  onReject,
  approving,
  rejecting,
}: AdjustmentApprovalActionsProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    await onReject(rejectionReason.trim());
    setRejectDialogOpen(false);
    setRejectionReason('');
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          onClick={onApprove}
          disabled={approving || rejecting}
          className="gap-1.5 bg-green-600 hover:bg-green-700"
        >
          {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Approve
        </Button>
        <Button
          variant="outline"
          onClick={() => setRejectDialogOpen(true)}
          disabled={approving || rejecting}
          className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Adjustment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Rejection Reason <span className="text-destructive">*</span></Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="Explain why this adjustment is being rejected..."
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectionReason.trim() || rejecting}
              className="gap-1.5"
            >
              {rejecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
