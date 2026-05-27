/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): Phase 5.D scaffolding mirrors MyTimeThisWeekPage; full Tailwind/token refactor scheduled with the U.4 sweep. */
/**
 * AddTimeEntryDialog — Phase 5.D follow-up.
 *
 * Inline modal opened from `/time` that lets staff post a time entry
 * without round-tripping to `/delivery/iwo/:id`. The IWO workspace
 * still owns the canonical form because it has rate-card + budget-hold
 * context; this dialog is the lightweight path for the common case of
 * "I just want to add 30 minutes to the same IWO I already touched
 * this week."
 *
 * IWO picker: the caller passes `recentIwoIds` derived from the page's
 * current week of entries (group keys). Free-text input is the fallback
 * when the user wants to log against an IWO they haven't touched yet
 * this week. The Cloud Function validates the IWO id server-side, so
 * a typo surfaces as an error toast rather than a silent post against
 * nothing.
 *
 * Posting:
 *   • `postTimeEntryFn({ iwoId, userId, minutes, entryDate, note })`
 *     — same callable the IWO workspace uses.
 *   • Errors from the rules layer (e.g. wrong subsidiary) or budget-
 *     hold rejection (≥ 100 %) come back as FirebaseError and render
 *     in the dialog's alert region.
 *
 * Reset behaviour: on successful post we clear minutes + note + the
 * entry-date field (back to today) but leave the IWO picker populated
 * so the user can quickly log another entry on the same IWO.
 */

import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { X } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { postTimeEntryFn } from '@/modules/delivery/services/firebase';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Authenticated user's uid (Firebase Auth) — required by
   * postTimeEntryFn's contract.
   */
  userId: string;
  /**
   * IWO ids the user has logged time against in the current page
   * view, used to populate the picker. Empty list is fine — the picker
   * degrades to free-text entry.
   */
  recentIwoIds: string[];
  /**
   * Called after a successful post so the parent can re-open the
   * subscription or surface a confirmation. The dialog closes itself.
   */
  onPosted?: (timeEntryId: string) => void;
}

function todayIso(): string {
  // Local-zone YYYY-MM-DD — the Cloud Function accepts ISO date strings
  // and the calendar bound is what matters (not the timezone offset).
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function AddTimeEntryDialog({ open, onClose, userId, recentIwoIds, onPosted }: Props) {
  const [iwoId, setIwoId] = useState('');
  const [minutes, setMinutes] = useState('');
  const [note, setNote] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const minutesParsed = Number.parseInt(minutes, 10);
  const canSubmit =
    !busy
    && iwoId.trim().length > 0
    && Number.isFinite(minutesParsed)
    && minutesParsed > 0
    && entryDate.length > 0;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await postTimeEntryFn({
        iwoId: iwoId.trim(),
        userId,
        minutes: minutesParsed,
        entryDate,
        note: note.trim() || undefined,
      });
      // Keep the IWO selected so the user can log another entry on
      // the same one without re-picking it.
      setMinutes('');
      setNote('');
      setEntryDate(todayIso());
      onPosted?.(res.data.timeEntryId);
      onClose();
    } catch (e) {
      setErr(
        e instanceof FirebaseError
          ? `${e.code}: ${e.message}`
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="add-time-entry-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Add time entry"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 8,
          background: '#fff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: 12,
          borderBottom: '1px solid #e2e8f0',
        }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Add time entry</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            type="button"
            data-testid="add-time-entry-close-btn"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              padding: 4,
              display: 'inline-flex',
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'block' }}>
            <span style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#64748b',
              marginBottom: 4,
            }}>
              IWO
            </span>
            {recentIwoIds.length > 0 ? (
              <select
                data-testid="add-time-entry-iwo-input"
                value={iwoId}
                onChange={(e) => setIwoId(e.target.value)}
                style={{
                  width: '100%',
                  height: 32,
                  padding: '0 8px',
                  borderRadius: 4,
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  fontSize: 13,
                }}
              >
                <option value="">— Pick from this week —</option>
                {recentIwoIds.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
                <option value="__other__">Other (type below)</option>
              </select>
            ) : (
              <Input
                data-testid="add-time-entry-iwo-input"
                value={iwoId}
                onChange={(e) => setIwoId(e.target.value)}
                placeholder="iwo_xxxx"
              />
            )}
            {recentIwoIds.length > 0 && iwoId === '__other__' && (
              <Input
                data-testid="add-time-entry-iwo-input-other"
                value=""
                onChange={(e) => setIwoId(e.target.value)}
                placeholder="iwo_xxxx"
                style={{ marginTop: 6 }}
              />
            )}
          </label>

          <label style={{ display: 'block' }}>
            <span style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#64748b',
              marginBottom: 4,
            }}>
              Minutes
            </span>
            <Input
              type="number"
              min="1"
              step="15"
              data-testid="add-time-entry-minutes-input"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="30"
            />
          </label>

          <label style={{ display: 'block' }}>
            <span style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#64748b',
              marginBottom: 4,
            }}>
              Date
            </span>
            <Input
              type="date"
              data-testid="add-time-entry-date-input"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </label>

          <label style={{ display: 'block' }}>
            <span style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: '#64748b',
              marginBottom: 4,
            }}>
              Note (optional)
            </span>
            <Input
              data-testid="add-time-entry-note-input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you work on?"
            />
          </label>

          {err && (
            <div
              role="alert"
              data-testid="add-time-entry-error"
              style={{
                fontSize: 12,
                color: '#7f1d1d',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 4,
                padding: '6px 8px',
              }}
            >
              {err}
            </div>
          )}
        </div>

        <footer style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          padding: 12,
          borderTop: '1px solid #e2e8f0',
        }}>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            data-testid="add-time-entry-submit-btn"
            disabled={!canSubmit}
            onClick={submit}
          >
            {busy ? 'Posting…' : 'Post entry'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
