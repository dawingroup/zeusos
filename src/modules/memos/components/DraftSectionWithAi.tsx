/**
 * "Draft with AI" under a section card: an optional one-line instruction,
 * then the model's text lands in the card unsaved for the author to keep,
 * edit or drop. Dark without an Anthropic key — the callable's sentence is
 * shown in place and the author writes by hand.
 */
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { describeCallableError } from '@/shared/utils/callableError';

interface Props {
  hasText: boolean;
  onDraft: (instruction?: string) => Promise<void>;
}

export function DraftSectionWithAi({ hasText, onDraft }: Props) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDraft(instruction);
      setOpen(false);
      setInstruction('');
    } catch (e) {
      setError(describeCallableError(e, 'draft the section'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="draft-section-ai">
      {open ? (
        <>
          <Input
            className="h-8 w-72"
            value={instruction}
            placeholder="Anything the draft should take into account? (optional)"
            aria-label="Instruction for the draft"
            disabled={busy}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void run(); } }}
          />
          <Button type="button" size="sm" disabled={busy} onClick={() => void run()}>
            <Sparkles className="mr-1 h-3.5 w-3.5" /> {busy ? 'Drafting…' : hasText ? 'Improve' : 'Draft'}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setError(null); }}>Cancel</Button>
        </>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          title="Draft this section from the memo's header, the other sections and the linked records. Nothing is saved until you do."
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" /> {hasText ? 'Improve with AI' : 'Draft with AI'}
        </Button>
      )}
      {error && <span className="text-xs" style={{ color: 'var(--rag-red)' }}>{error}</span>}
    </div>
  );
}
