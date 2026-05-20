/**
 * RequestRevisionButton
 *
 * Phase 3b — portal-side entry point for the revision-request feedback
 * loop (F-D3). Clients click this on a project or specific deliverable,
 * fill a short textarea, and submit. The resulting `revisionRequests`
 * doc lands in the Design Manager's RevisionRequestsPanel for the
 * assigned designer.
 */

import { useState } from 'react';
import { MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import { getAuth } from 'firebase/auth';
import { createRevisionRequest } from '@/modules/design-manager/services/revisionRequestService';

interface RequestRevisionButtonProps {
  projectId: string;
  /** Optional — scope the request to a specific design item. */
  itemId?: string;
  itemName?: string;
  /** Display name of the client, stored for designer-side triage. */
  clientName?: string;
  /** Optional — specific `projectFiles` IDs the client is referring to. */
  relatedFileIds?: string[];
  /** Button visual variant — default 'outline' fits portal aesthetics. */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Override the button label. */
  label?: string;
}

export default function RequestRevisionButton({
  projectId,
  itemId,
  itemName,
  clientName,
  relatedFileIds,
  variant = 'outline',
  label = 'Request Revision',
}: RequestRevisionButtonProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMessage('');
    setError(null);
    setSubmitted(false);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Please describe what change you would like.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const user = getAuth().currentUser;
      await createRevisionRequest({
        projectId,
        itemId,
        itemName,
        requestedBy: user?.uid || 'anonymous-portal',
        requestedByName: clientName || user?.displayName || undefined,
        message: message.trim(),
        relatedFileIds,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setOpen(false);
    // Clear state after the dialog animation completes.
    setTimeout(reset, 200);
  };

  return (
    <>
      <Button
        variant={variant}
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <MessageSquare className="h-4 w-4" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {submitted ? 'Revision request sent' : 'Request a revision'}
            </DialogTitle>
            <DialogDescription>
              {submitted
                ? 'The design team has been notified and will respond shortly.'
                : itemName
                  ? `Tell the design team what you'd like changed on "${itemName}".`
                  : "Tell the design team what you'd like changed."}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2" />
              <p className="text-sm text-muted-foreground">
                You can track the status of this request here as it progresses.
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <Label htmlFor="revision-message" className="text-sm">
                What change would you like?
              </Label>
              <Textarea
                id="revision-message"
                placeholder="e.g. Can we change the countertop material to walnut?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                disabled={submitting}
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          <DialogFooter>
            {submitted ? (
              <Button onClick={handleClose}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={handleClose} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send request'
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
