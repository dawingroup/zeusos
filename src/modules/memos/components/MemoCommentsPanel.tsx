import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { Textarea } from '@/core/components/ui/textarea';
import type { MemoActor } from '../types/memo';
import { useMemoComments } from '../hooks/useMemoComments';
import { addMemoComment } from '../services/memoCommentService';
import { formatMemoDate } from './memoUi';

export function MemoCommentsPanel({ memoId, actor }: { memoId: string; actor: MemoActor | null }) {
  const { comments, error: loadError } = useMemoComments(memoId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {loadError && <p className="text-xs" style={{ color: 'var(--rag-red)' }}>Could not load the discussion: {loadError}</p>}
      {comments.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--fg-tertiary)' }}>No discussion yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="text-sm">
              <div className="flex items-baseline gap-2">
                <span className="font-medium" style={{ color: 'var(--fg-primary)' }}>{c.authorName}</span>
                <span className="text-xs" style={{ color: 'var(--fg-tertiary)' }}>{formatMemoDate(c.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--fg-secondary)' }}>{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {actor && (
        <div className="space-y-2">
          <Textarea className="min-h-[4rem]" value={text} placeholder="Add to the file…" aria-label="Comment" onChange={(e) => setText(e.target.value)} />
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !text.trim()}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try { await addMemoComment(memoId, text, actor); setText(''); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
              }}
            >
              Post
            </Button>
            {error && <span className="text-xs" style={{ color: 'var(--rag-red)' }}>{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
