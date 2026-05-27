/**
 * RouteToAMButton — Layer 3 of §7.4. When a subsidiary user has any UI
 * affordance that *could* be misinterpreted as direct client contact
 * (e.g. a deliverable comment thread, or a future "ask the client a
 * question" surface), this is the ONLY action available.
 *
 * Per spec §7.4 third bullet: "the only available action is 'route to
 * account management,' which creates an intake item on the master job —
 * there is no UI affordance or API to answer the client with a price."
 *
 * The button calls the `routeDirectClientRequest` callable, which
 * writes the intake item AND emits `DirectClientRequestRouted` to the
 * transactional outbox atomically (mirrors how every other state change
 * in the platform writes its event — see `appendDomainEvent` in
 * `functions/src/platform/outbox.js`).
 *
 * Refactored U.4 from inline-styled scaffolding to shadcn <Button> +
 * .rag red alert for the error state.
 */

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import type { SubsidiaryId } from '@/core/settings/types';
import { routeDirectClientRequestFn } from '../services/firebase';

export interface RouteToAMButtonProps {
  /** Subsidiary the request was received by. */
  receivingSubsidiaryOrgId: SubsidiaryId;
  /** Master job the request relates to (the routing target). */
  masterJobId?: string;
  /** Client the request came from. */
  clientId: string;
  /** Account-Management user the request was routed to. Required by the
   *  domain event so the AM notification system knows who to ping. */
  routedToUserId: string;
  /** Pre-filled note (e.g. "client commented on deliverable X"). The user
   *  can append before submitting; the final string is what lands on the
   *  intake item. */
  defaultNote?: string;
  /** Optional callback fired after a successful write so the parent can
   *  close a dialog / show a toast. */
  onRouted?: () => void;
}

export function RouteToAMButton(props: RouteToAMButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    // eslint-disable-next-line no-alert -- intake note is short-form; replace with dialog once shared dialog system lands
    const note = window.prompt(
      'Route this client request to Account Management?\nAdd a note (required):',
      props.defaultNote ?? '',
    );
    if (!note || !note.trim()) return;

    setBusy(true);
    setError(null);
    try {
      await routeDirectClientRequestFn({
        receivingSubsidiaryOrgId: props.receivingSubsidiaryOrgId,
        routedToUserId: props.routedToUserId,
        masterJobId: props.masterJobId,
        clientId: props.clientId,
        note: note.trim(),
      });
      props.onRouted?.();
    } catch (err) {
      setError(`Routing failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={busy}
        title="The subsidiary cannot answer the client directly — only Account Management can."
      >
        Route to Account Management
      </Button>
      {error && (
        <p role="alert" className="rag red mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}
