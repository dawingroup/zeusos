/**
 * Contracts & SOW bounded context.
 *
 * Owns: MSAs, SOWs, scope, change orders.
 * Must never: let delivery teams edit terms.
 *
 * Per spec §1.3 — Contracts is one of the four services that hold all
 * commercial truth. Subsidiary-org users cannot mutate any document in
 * this context (enforced in firestore.rules).
 */

export type { Client, ClientStatus, ClientContact } from './types/client.types';
export type { MSA, MSAStatus } from './types/msa.types';
export type { SOW, SOWStatus, SOWType } from './types/sow.types';
export type { ChangeOrder, ChangeOrderStatus } from './types/change-order.types';
