/**
 * useMasterJobRollup — Firestore-backed React hook returning the §9.4
 * GraphQL `masterJob` shape.
 *
 * Spec §9.4:
 *   query MasterJobRollup($id: ID!) {
 *     masterJob(id: $id) {
 *       code status ceilingMinor allocatedMinor
 *       marginPct                  # (clientTotal - cost) / clientTotal
 *       clientTotalMinor           # client-facing
 *       workOrders {
 *         subsidiary { name }
 *         status budgetMinor cumulativeCostMinor transferPriceMinor
 *         burnPct
 *       }
 *       clientInvoice { amountMinor status }
 *     }
 *   }
 *
 * The hook subscribes to:
 *   - master_jobs/{id}
 *   - internal_work_orders where masterJobId == id
 *   - client_invoices/{masterJobId}:active (the §11.7 single-invoice lock doc)
 *
 * Field-level guards (§9.4 callout): cumulativeCostMinor and
 * transferPriceMinor are AM/finance-only. The hook itself doesn't gate —
 * Firestore rules deny subsidiary reads of `master_jobs/{id}`, so the
 * subscriber just returns `null` (the guard already 403s the route).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';
import type { MasterJob } from '../types/master-job.types';
import type { InternalWorkOrder } from '../types/iwo.types';
import type { IWOState } from '../constants/iwo-states';

export interface MasterJobRollupWorkOrder {
  id: string;
  code: string;
  subsidiary: { id: SubsidiaryId; name: string };
  status: IWOState;
  budgetMinor: number;
  cumulativeCostMinor: number;
  transferPriceMinor: number;
  burnPct: number;
  currency: string;
}

export interface MasterJobRollupInvoice {
  amountMinor: number;
  status: string;
  currency: string;
}

export interface MasterJobRollup {
  id: string;
  code: string;
  status: MasterJob['status'];
  ceilingMinor: number;
  allocatedMinor: number;
  marginPct: number;
  clientTotalMinor: number;
  currency: string;
  workOrders: MasterJobRollupWorkOrder[];
  clientInvoice?: MasterJobRollupInvoice;
}

const SUBSIDIARY_LABELS: Record<SubsidiaryId, string> = {
  'zeus-group':       'Zeus Group',
  'zeus-the-agency':  'Zeus The Agency',
  'zeus-digital':     'Zeus Digital',
  'labyrinth':        'Labyrinth',
  'odd-gorilla':      'Odd Gorilla',
  'house-of-zeus':    'House of Zeus',
};

interface ClientInvoiceDoc {
  amountMinor?: number;
  total?: { amountMinor?: number; currency?: string };
  status?: string;
  currency?: string;
}

export function useMasterJobRollup(masterJobId: string | null | undefined) {
  const [mj, setMj] = useState<MasterJob | null>(null);
  const [iwos, setIwos] = useState<InternalWorkOrder[]>([]);
  const [invoice, setInvoice] = useState<MasterJobRollupInvoice | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!masterJobId) {
      setMj(null);
      setIwos([]);
      setInvoice(undefined);
      setLoading(false);
      return;
    }
    setLoading(true);

    const unsubMj = onSnapshot(doc(db, 'master_jobs', masterJobId), snap => {
      setMj(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<MasterJob, 'id'>) }) : null);
      setLoading(false);
    });

    const unsubIwos = onSnapshot(
      query(
        collection(db, 'internal_work_orders'),
        where('masterJobId', '==', masterJobId),
      ),
      snap => {
        setIwos(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) })));
      },
    );

    // The single-invoice lock is `client_invoices/{masterJobId}:active`
    // (firestore.rules §4283 + Phase 3.F service).
    const unsubInv = onSnapshot(
      doc(db, 'client_invoices', `${masterJobId}:active`),
      snap => {
        if (!snap.exists()) {
          setInvoice(undefined);
          return;
        }
        const d = snap.data() as ClientInvoiceDoc;
        const total = d.total || {};
        setInvoice({
          amountMinor: typeof total.amountMinor === 'number'
            ? total.amountMinor
            : (typeof d.amountMinor === 'number' ? d.amountMinor : 0),
          status: d.status || 'UNKNOWN',
          currency: total.currency || d.currency || 'USD',
        });
      },
      // Errors (e.g. permission-denied for subsidiary principals) keep
      // invoice as undefined — the page doesn't fail just because billing
      // can't be read.
      () => setInvoice(undefined),
    );

    return () => {
      unsubMj();
      unsubIwos();
      unsubInv();
    };
  }, [masterJobId]);

  const rollup = useMemo<MasterJobRollup | null>(() => {
    if (!mj) return null;
    const totalCost = iwos
      .filter(iwo => iwo.state !== 'REJECTED' && iwo.state !== 'CANCELLED')
      .reduce((sum, iwo) => sum + (iwo.cumulativeCostMinor || 0), 0);
    const clientTotal = mj.clientTotalMinor || 0;
    // Per spec §9.4 / §8.3 — margin uses client price vs cost (subsidiary
    // cost basis), not allocated vs ceiling.
    const marginPct = clientTotal > 0
      ? ((clientTotal - totalCost) / clientTotal) * 100
      : 0;
    const workOrders: MasterJobRollupWorkOrder[] = iwos.map(iwo => {
      const burnPct = iwo.budgetMinor > 0
        ? Math.min(100, ((iwo.cumulativeCostMinor || 0) / iwo.budgetMinor) * 100)
        : 0;
      return {
        id: iwo.id,
        code: iwo.code,
        subsidiary: {
          id: iwo.subsidiaryOrgId,
          name: SUBSIDIARY_LABELS[iwo.subsidiaryOrgId] || iwo.subsidiaryOrgId,
        },
        status: iwo.state,
        budgetMinor: iwo.budgetMinor,
        cumulativeCostMinor: iwo.cumulativeCostMinor || 0,
        transferPriceMinor: iwo.transferPriceMinor,
        burnPct,
        currency: iwo.currency,
      };
    });
    return {
      id: mj.id,
      code: mj.code,
      status: mj.status,
      ceilingMinor: mj.ceilingMinor,
      allocatedMinor: mj.allocatedMinor || 0,
      marginPct,
      clientTotalMinor: clientTotal,
      currency: mj.currency,
      workOrders,
      clientInvoice: invoice,
    };
  }, [mj, iwos, invoice]);

  return { rollup, loading, masterJob: mj, iwos };
}
