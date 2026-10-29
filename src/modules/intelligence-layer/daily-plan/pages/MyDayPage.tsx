/**
 * /tasks/today — My Day. "Your focus today" for the signed-in person, plus a
 * follow-through strip from their recent closed days.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/core/components/ui/button';
import { useCurrentDawinUser } from '@/core/settings';
import { FocusTodayCard } from '../components/FocusTodayCard';
import { computeFocusReliability, formatHeaderDate, nairobiDateKey } from '../format';
import { fetchRecentPlans } from '../services/dailyPlanService';
import type { FocusReliability } from '../types';

export default function MyDayPage() {
  const navigate = useNavigate();
  const { dawinUser } = useCurrentDawinUser();
  const uid = dawinUser?.uid ?? null;
  const [reliability, setReliability] = useState<FocusReliability | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    fetchRecentPlans(uid, 10)
      .then((plans) => { if (!cancelled) setReliability(computeFocusReliability(plans)); })
      .catch(() => { if (!cancelled) setReliability(null); });
    return () => { cancelled = true; };
  }, [uid]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 max-w-[920px] mx-auto space-y-4" data-testid="my-day-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[17px] font-semibold m-0" style={{ color: 'var(--fg-primary)' }}>My Day</h1>
          <p className="text-[12.5px] mt-0.5 m-0" style={{ color: 'var(--fg-secondary)' }}>{formatHeaderDate(nairobiDateKey())}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/intelligence/inbox')}>My Tasks</Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/tasks/review')}>Team plans</Button>
        </div>
      </div>

      <FocusTodayCard />

      {reliability && reliability.days > 0 && (
        <section className="rounded-[10px] px-5 py-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)' }} data-testid="focus-reliability">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>Follow-through · last {reliability.days} {reliability.days === 1 ? 'day' : 'days'}</div>
              <div className="text-[13px] mt-1" style={{ color: 'var(--fg-secondary)' }}>
                <strong style={{ color: 'var(--fg-primary)' }}>{reliability.completionRate}%</strong> of what you committed to landed ·{' '}
                {reliability.done} done · {reliability.carried} carried · {reliability.blocked} blocked
              </div>
            </div>
            <div className="flex items-end gap-1 h-8" aria-hidden="true">
              {reliability.trail.map((n, i) => (
                <span key={i} className="w-2 rounded-sm" style={{ height: `${Math.max(4, Math.min(32, n * 6))}px`, background: n > 0 ? 'var(--rag-green)' : 'var(--border-default)' }} />
              ))}
            </div>
          </div>
        </section>
      )}

      <p className="text-[11.5px] m-0" style={{ color: 'var(--fg-quaternary)' }}>
        Drafted at 17:00 from your open work, shaped by your manager in the evening, published at 06:00 and closed at 20:00, Africa/Nairobi. Wrap up before 20:00 and what you carry leads tomorrow.
      </p>
    </div>
  );
}
