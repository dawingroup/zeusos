/**
 * What the inbox can DO to a row — a map from ApprovalKind to the callable
 * or service that already owns that decision. The inbox mints no new write
 * paths: every Approve / Reject here is the same call the record's own page
 * makes, so authority, idempotency and the outbox stay where they are.
 *
 * ADR-0002 (ported with stream F): the raiser is never the approver. The
 * check here is the client-side courtesy; the server-side refusal lands in
 * the routing-v2 PR (`notSelfApproved()` in rules + the approval callables).
 */

import { advanceApprovalRungFn, rejectApprovalRungFn } from '@/modules/delivery/services/approval-ladder.service';
import { acceptInternalFn, requestRevisionFn } from '@/modules/assignment/services/firebase';
import { approveChangeOrderFn, approveSowFn, rejectChangeOrderFn } from '@/modules/contracts/services/firebase';
import {
  approveTalentInvoice,
  describeApprovalProgress,
  rejectTalentInvoice,
} from '@/modules/talent/services/talent-invoice.service';
import {
  approveMediaSupplierInvoice,
  rejectMediaSupplierInvoice,
} from '@/modules/media/services/media-supplier-invoice.service';
import type { ApprovalItem, ApprovalKind } from './types';

export interface ApprovalActionContext {
  /** Firebase Auth uid of the person deciding. Never a placeholder string. */
  actorUserId: string;
}

export interface ApprovalActionSet {
  /** `run` may return a sentence for the toast (e.g. multi-signature progress); otherwise the page composes one. */
  approve?: { label: string; run: (item: ApprovalItem, ctx: ApprovalActionContext) => Promise<string | void> };
  reject?: {
    label: string;
    /** Prompt shown above the required note. */
    notePrompt: string;
    run: (item: ApprovalItem, note: string, ctx: ApprovalActionContext) => Promise<void>;
  };
}

export class SelfApprovalError extends Error {
  constructor() {
    super('You raised this — someone else has to approve it.');
    this.name = 'SelfApprovalError';
  }
}

/** Refuse before calling anything when the actor is the raiser. */
export function assertNotSelfApproval(item: ApprovalItem, ctx: ApprovalActionContext): void {
  if (!ctx.actorUserId || ctx.actorUserId.trim() === '') {
    throw new Error('Sign in to approve.');
  }
  if (item.requesterUserId && item.requesterUserId === ctx.actorUserId) {
    throw new SelfApprovalError();
  }
}

const ACTIONS: Record<ApprovalKind, ApprovalActionSet> = {
  ecd_rung: {
    approve: {
      label: 'Approve rung',
      run: async (item, ctx) => {
        assertNotSelfApproval(item, ctx);
        await advanceApprovalRungFn({ iwoId: item.entity.id });
      },
    },
    reject: {
      label: 'Return',
      notePrompt: 'What needs to change before this comes back up the ladder?',
      run: async (item, note, ctx) => {
        assertNotSelfApproval(item, ctx);
        await rejectApprovalRungFn({ iwoId: item.entity.id, notes: note });
      },
    },
  },
  iwo_internal_acceptance: {
    approve: {
      label: 'Accept internally',
      run: async (item, ctx) => {
        assertNotSelfApproval(item, ctx);
        await acceptInternalFn({ iwoId: item.entity.id });
      },
    },
    reject: {
      label: 'Request revision',
      notePrompt: 'Which acceptance criteria failed?',
      run: async (item, note, ctx) => {
        assertNotSelfApproval(item, ctx);
        await requestRevisionFn({ iwoId: item.entity.id, criteriaFailures: [note] });
      },
    },
  },
  sow_approval: {
    approve: {
      label: 'Approve SOW',
      run: async (item, ctx) => {
        assertNotSelfApproval(item, ctx);
        await approveSowFn({ sowId: item.entity.id });
      },
    },
    // A SOW is not rejected from the inbox — it is cancelled from its own
    // page with a reason, which is a bigger decision than a row button.
  },
  change_order: {
    approve: {
      label: 'Approve',
      run: async (item, ctx) => {
        assertNotSelfApproval(item, ctx);
        await approveChangeOrderFn({ changeOrderId: item.entity.id });
      },
    },
    reject: {
      label: 'Reject',
      notePrompt: 'Why is this change order rejected?',
      run: async (item, note, ctx) => {
        assertNotSelfApproval(item, ctx);
        await rejectChangeOrderFn({ changeOrderId: item.entity.id, reason: note });
      },
    },
  },
  // The client decides a quote; the inbox only links to it.
  quote_awaiting_client: {},
  // Supplier invoices: the callable plans the signature ladder, refuses the
  // raiser and machine actors server-side, and signs the lowest level the
  // caller may sign — the uid is read from the auth context, not passed.
  talent_invoice: {
    approve: {
      label: 'Approve',
      run: async (item, ctx) => {
        assertNotSelfApproval(item, ctx);
        const result = await approveTalentInvoice(item.entity.id);
        return describeApprovalProgress(result, item.entity.ref ?? item.entity.id);
      },
    },
    reject: {
      label: 'Reject',
      notePrompt: 'Why is this invoice rejected?',
      run: async (item, note, ctx) => {
        assertNotSelfApproval(item, ctx);
        await rejectTalentInvoice(item.entity.id, ctx.actorUserId, note);
      },
    },
  },
  media_supplier_invoice: {
    approve: {
      label: 'Approve',
      run: async (item, ctx) => {
        assertNotSelfApproval(item, ctx);
        const result = await approveMediaSupplierInvoice(item.entity.id);
        return describeApprovalProgress(result, item.entity.ref ?? item.entity.id);
      },
    },
    reject: {
      label: 'Reject',
      notePrompt: 'Why is this invoice rejected?',
      run: async (item, note, ctx) => {
        assertNotSelfApproval(item, ctx);
        await rejectMediaSupplierInvoice(item.entity.id, ctx.actorUserId, note);
      },
    },
  },
};

export function actionsFor(item: ApprovalItem): ApprovalActionSet {
  if (item.decision !== 'inline') return {};
  return ACTIONS[item.kind] ?? {};
}
