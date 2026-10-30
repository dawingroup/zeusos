/**
 * "Delete draft" with a confirmation. Renders nothing unless memoDraftDeletion
 * allows the person to delete this memo — so it is safe to place on any
 * surface that shows a memo.
 */
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import type { Memo, MemoActor } from '../types/memo';
import { memoDraftDeletion } from '../utils/memoDeletion';
import { deleteMemoDraft } from '../services/memoService';

export interface DeleteMemoDraftButtonProps {
  memo: Pick<Memo, 'id' | 'subject' | 'status' | 'createdBy' | 'memoNumber' | 'version'>;
  actor: MemoActor | null;
  isAdmin: boolean;
  variant?: 'button' | 'icon';
  onBeforeDelete?: () => void;
  onDeleted?: () => void;
}

export function DeleteMemoDraftButton({ memo, actor, isAdmin, variant = 'button', onBeforeDelete, onDeleted }: DeleteMemoDraftButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verdict = memoDraftDeletion(memo, actor?.uid, isAdmin);
  if (!actor || !verdict.allowed) return null;
  const subject = memo.subject?.trim() || 'Untitled memo';

  return (
    <>
      {variant === 'icon' ? (
        <button type="button" aria-label={`Delete draft ${subject}`} title="Delete draft" onClick={() => setOpen(true)} className="rounded p-1 hover:bg-black/5" style={{ color: 'var(--fg-tertiary)' }}>
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} style={{ color: 'var(--rag-red)' }}>
          <Trash2 className="mr-1 h-3 w-3" /> Delete draft
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription>
              “{subject}” is deleted with its comments and attachments. This cannot be undone.
              {memo.memoNumber ? ` It carries ${memo.memoNumber}; that number is not reused.` : ''}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm" style={{ color: 'var(--rag-red)' }}>{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep it</Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  onBeforeDelete?.();
                  await deleteMemoDraft(memo.id, actor, { isAdmin });
                  setOpen(false);
                  onDeleted?.();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Deleting…' : 'Delete draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
