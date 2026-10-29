/**
 * useApprovalsInbox — live, normalized approvals queue for a scope.
 *
 * Scope-aware so a feed is only opened for people who can read it (and so a
 * brand user never hits the parent-gated commercial queries):
 *   - parent → every queue: DELIVERED IWOs (all brands), SOWs pending
 *              approval, draft change orders, issued quotes, submitted
 *              talent + media invoices
 *   - brand  → that brand's DELIVERED IWOs only (ECD rungs + awaiting
 *              internal acceptance)
 *   - none   → nothing
 *
 * Every listener is wrapped so a permission error on one feed degrades that
 * source to empty (and names it in `degraded`) rather than blanking the
 * page. Listener health flows through the shared recovery hook so a dead
 * listener after a token refresh resubscribes like every other live surface.
 * All aggregation / sorting lives in the tested projection core.
 */

import { useEffect, useMemo, useState } from 'react';

import { useListenerRecovery } from '@/shared/hooks/useResilientSubscription';

import {
  buildApprovalsInbox,
  filterByScope,
  type ChangeOrderInput,
  type IwoInput,
  type MediaSupplierInvoiceInput,
  type QuoteInput,
  type SowInput,
  type TalentInvoiceInput,
} from '../approvalsProjection';
import { subscribeDraftChangeOrders, subscribeIssuedQuotes, subscribePendingSows } from '../feeds/commercialFeeds';
import { subscribeDeliveredIwos } from '../feeds/iwoFeeds';
import {
  subscribeSubmittedMediaSupplierInvoices,
  subscribeSubmittedTalentInvoices,
} from '../feeds/supplierInvoiceFeeds';
import type { ApprovalItem, ApprovalsScope } from '../types';

export type ApprovalsFeedName = 'iwos' | 'sows' | 'changeOrders' | 'quotes' | 'talentInvoices' | 'mediaSupplierInvoices';

export interface UseApprovalsInboxResult {
  items: ApprovalItem[];
  /** True until every opened feed has answered once (data or error). */
  loading: boolean;
  /** A non-permission failure on some feed; permission refusals go to `degraded`. */
  error: Error | null;
  /** Feeds that were refused (permission-denied) and are showing as empty. */
  degraded: ApprovalsFeedName[];
  /** Resubscribe every feed now — for a manual Refresh button. */
  resubscribe: () => void;
}

function isPermissionDenied(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' && /permission-denied$/.test(code);
}

export function useApprovalsInbox(scope: ApprovalsScope): UseApprovalsInboxResult {
  const brandOrgId = scope.kind === 'brand' ? scope.orgId : null;
  const scopeKey = scope.kind === 'brand' ? `brand:${scope.orgId}` : scope.kind;
  const { epoch, report, resubscribe } = useListenerRecovery([scopeKey]);

  const [iwos, setIwos] = useState<IwoInput[]>([]);
  const [sows, setSows] = useState<SowInput[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrderInput[]>([]);
  const [quotes, setQuotes] = useState<QuoteInput[]>([]);
  const [talentInvoices, setTalentInvoices] = useState<TalentInvoiceInput[]>([]);
  const [mediaSupplierInvoices, setMediaSupplierInvoices] = useState<MediaSupplierInvoiceInput[]>([]);
  const [pending, setPending] = useState<ReadonlySet<ApprovalsFeedName>>(() => new Set());
  const [degraded, setDegraded] = useState<ApprovalsFeedName[]>([]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setIwos([]);
    setSows([]);
    setChangeOrders([]);
    setQuotes([]);
    setTalentInvoices([]);
    setMediaSupplierInvoices([]);
    setDegraded([]);
    setError(null);

    if (scope.kind === 'none') {
      setPending(new Set());
      return;
    }

    type Open = (ok: (rows: never[]) => void, fail: (err: Error) => void) => () => void;
    const feeds: Array<[ApprovalsFeedName, Open]> = [];
    const add = <T,>(name: ApprovalsFeedName, set: (rows: T[]) => void, open: (cb: (rows: T[]) => void, onErr: (e: Error) => void) => () => void) => {
      feeds.push([name, (ok, fail) => open((rows) => { set(rows); ok(rows as never[]); }, fail)]);
    };

    add<IwoInput>('iwos', setIwos, (cb, onErr) => subscribeDeliveredIwos({ brandId: brandOrgId ?? undefined }, cb, onErr));
    if (scope.kind === 'parent') {
      add<SowInput>('sows', setSows, subscribePendingSows);
      add<ChangeOrderInput>('changeOrders', setChangeOrders, subscribeDraftChangeOrders);
      add<QuoteInput>('quotes', setQuotes, subscribeIssuedQuotes);
      add<TalentInvoiceInput>('talentInvoices', setTalentInvoices, subscribeSubmittedTalentInvoices);
      add<MediaSupplierInvoiceInput>('mediaSupplierInvoices', setMediaSupplierInvoices, subscribeSubmittedMediaSupplierInvoices);
    }

    setPending(new Set(feeds.map(([name]) => name)));
    const settle = (name: ApprovalsFeedName) =>
      setPending((prev) => {
        if (!prev.has(name)) return prev;
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
    const refuse = (name: ApprovalsFeedName, err: unknown) => {
      if (isPermissionDenied(err)) {
        setDegraded((prev) => (prev.includes(name) ? prev : [...prev, name]));
      } else {
        setError((prev) => prev ?? (err instanceof Error ? err : new Error(String(err))));
      }
    };

    const unsubs = feeds.map(([name, open]) => {
      try {
        return open(
          () => {
            report(name, true);
            settle(name);
          },
          (err) => {
            report(name, false);
            refuse(name, err);
            settle(name);
          },
        );
      } catch (err) {
        // Opening the query itself threw (bad ref, offline SDK): treat like a refused feed.
        report(name, false);
        refuse(name, err);
        settle(name);
        return () => {};
      }
    });

    return () => unsubs.forEach((u) => u());
    // scopeKey encodes scope.kind + brand org; epoch is the recovery resubscribe signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, brandOrgId, epoch, report]);

  const items = useMemo<ApprovalItem[]>(() => {
    const effectiveScope: ApprovalsScope =
      brandOrgId ? { kind: 'brand', orgId: brandOrgId } : scopeKey === 'parent' ? { kind: 'parent' } : { kind: 'none' };
    if (effectiveScope.kind === 'none') return [];
    const all = buildApprovalsInbox(
      { iwos, sows, changeOrders, quotes, talentInvoices, mediaSupplierInvoices },
      Date.now(),
    );
    return filterByScope(all, effectiveScope);
  }, [iwos, sows, changeOrders, quotes, talentInvoices, mediaSupplierInvoices, brandOrgId, scopeKey]);

  return { items, loading: pending.size > 0, error, degraded, resubscribe };
}
