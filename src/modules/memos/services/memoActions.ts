/**
 * Typed wrappers around the `memoAction` callable
 * (functions/src/memos/callables/memoAction.js, europe-west1).
 *
 * Drafts are written by the client (memoService.ts); everything after that —
 * submit, clear, decide, issue, file the PDF, withdraw, reopen, acknowledge —
 * goes through here so the number, the route, the history row and the step's
 * task are written once, server-side.
 */
import { connectFunctionsEmulator, getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { app } from '@/core/services/firebase/config';
import type { MemoApprovalSnapshot, MemoDecisionOutcome, MemoRouteStage, MemoStatus } from '../types/memo';

const functions = getFunctions(app, 'europe-west1');

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

export type MemoActionName = 'submit' | 'clear' | 'decide' | 'issue' | 'filePdf' | 'withdraw' | 'reopen' | 'acknowledge';

export interface MemoActionRequest {
  action: MemoActionName;
  memoId: string;
  /** clear */
  outcome?: 'cleared' | 'returned' | MemoDecisionOutcome;
  /** clear (required on `returned`) · withdraw */
  note?: string;
  /** decide */
  conditions?: string;
  notes?: string;
  signedName?: string;
  /** filePdf */
  storagePath?: string;
  url?: string;
}

export interface MemoActionResponse {
  id: string;
  status: MemoStatus;
  memoNumber?: string;
  version?: number;
  approval?: MemoApprovalSnapshot;
  stage?: MemoRouteStage | 'returned';
  outcome?: MemoDecisionOutcome;
  contentHash?: string;
  superseded?: string | null;
  pdfUrl?: string;
  acknowledgedAt?: string;
}

export const memoActionFn: HttpsCallable<MemoActionRequest, MemoActionResponse> = httpsCallable(functions, 'memoAction');

async function call(req: MemoActionRequest): Promise<MemoActionResponse> {
  const res = await memoActionFn(req);
  return res.data;
}

export const submitMemo = (memoId: string) => call({ action: 'submit', memoId });
export const clearMemo = (memoId: string, outcome: 'cleared' | 'returned', note?: string) => call({ action: 'clear', memoId, outcome, note });
export const decideMemo = (memoId: string, input: { outcome: MemoDecisionOutcome; conditions?: string; notes?: string; signedName: string }) =>
  call({ action: 'decide', memoId, ...input });
export const issueMemo = (memoId: string) => call({ action: 'issue', memoId });
export const fileMemoPdf = (memoId: string, storagePath: string, url: string) => call({ action: 'filePdf', memoId, storagePath, url });
export const withdrawMemo = (memoId: string, note?: string) => call({ action: 'withdraw', memoId, note });
export const reopenMemo = (memoId: string) => call({ action: 'reopen', memoId });
export const acknowledgeMemo = (memoId: string) => call({ action: 'acknowledge', memoId });
