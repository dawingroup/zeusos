/**
 * Role Profile + Role Assignment service layer — Phase 6.UI.A (PR 6).
 *
 * Typed wrappers for the admin callables shipped in
 * `functions/src/hr-central/role-profiles.js`, plus realtime
 * subscriptions for the list pages.
 */

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase/firestore';
import { app } from '@/core/services/firebase/config';
import type {
  CreateRoleProfileInput,
  RoleProfile,
  RoleProfileId,
  RoleAssignment,
} from '@/modules/hr-central/role-profiles/types';

const functions = getFunctions(app, 'europe-west1');

// ──────────────────────────────────────────────────────────────────
// Callables
// ──────────────────────────────────────────────────────────────────

export interface CreateRoleProfileCallableInput extends CreateRoleProfileInput {
  id?: RoleProfileId;
}
export interface CreateRoleProfileResult {
  id: RoleProfileId;
  created: boolean;
}
export const createRoleProfileFn: HttpsCallable<CreateRoleProfileCallableInput, CreateRoleProfileResult> =
  httpsCallable(functions, 'createRoleProfile');

export interface UpdateRoleProfileInput {
  id: RoleProfileId;
  patch: Partial<Pick<RoleProfile,
    | 'title' | 'description' | 'jobLevel' | 'employmentTypes'
    | 'reportsTo' | 'supervises' | 'peers'
    | 'escalationPath' | 'delegationPool'
    | 'skills' | 'taskCapabilities' | 'approvalAuthorities'
    | 'typicalTaskLoad' | 'aiContext' | 'status'
  >>;
}
export interface UpdateRoleProfileResult {
  id: RoleProfileId;
  updated: true;
}
export const updateRoleProfileFn: HttpsCallable<UpdateRoleProfileInput, UpdateRoleProfileResult> =
  httpsCallable(functions, 'updateRoleProfile');

export interface ArchiveRoleProfileInput {
  id: RoleProfileId;
}
export interface ArchiveRoleProfileResult {
  id: RoleProfileId;
  archived: true;
}
export const archiveRoleProfileFn: HttpsCallable<ArchiveRoleProfileInput, ArchiveRoleProfileResult> =
  httpsCallable(functions, 'archiveRoleProfile');

export interface AssignEmployeeToRoleCallableInput {
  employeeId: string;
  roleProfileId: RoleProfileId;
  effectiveFrom: string;
  effectiveTo?: string;
  isPrimary?: boolean;
  overrides?: RoleAssignment['overrides'];
}
export interface AssignEmployeeToRoleResult {
  id: string;
  employeeId: string;
  roleProfileId: RoleProfileId;
  created: boolean;
}
export const assignEmployeeToRoleFn: HttpsCallable<AssignEmployeeToRoleCallableInput, AssignEmployeeToRoleResult> =
  httpsCallable(functions, 'assignEmployeeToRole');

export interface EndRoleAssignmentInput {
  id: string;
  effectiveTo?: string;
}
export interface EndRoleAssignmentResult {
  id: string;
  ended: true;
}
export const endRoleAssignmentFn: HttpsCallable<EndRoleAssignmentInput, EndRoleAssignmentResult> =
  httpsCallable(functions, 'endRoleAssignment');

// ──────────────────────────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────────────────────────

export function subscribeRoleProfiles(
  cb: (rows: RoleProfile[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'role_profile'),
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<RoleProfile, 'id'>) }))
        .sort((a, b) => a.title.localeCompare(b.title));
      cb(rows);
    },
    (err) => onError?.(err),
  );
}

export function subscribeRoleProfile(
  id: RoleProfileId,
  cb: (profile: RoleProfile | null) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'role_profile', id),
    (snap) => cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<RoleProfile, 'id'>) }) : null),
    (err) => onError?.(err),
  );
}

export function subscribeRoleAssignments(
  cb: (rows: RoleAssignment[]) => void,
  onError?: (e: Error) => void,
  opts?: { status?: RoleAssignment['status']; roleProfileId?: RoleProfileId },
): Unsubscribe {
  const clauses = [];
  if (opts?.status) clauses.push(where('status', '==', opts.status));
  if (opts?.roleProfileId) clauses.push(where('roleProfileId', '==', opts.roleProfileId));
  const base = collection(db, 'role_assignment');
  const q = clauses.length > 0
    ? query(base, ...clauses, orderBy('assignedAt', 'desc'))
    : query(base, orderBy('assignedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoleAssignment, 'id'>) }))),
    (err) => onError?.(err),
  );
}
