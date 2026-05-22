/**
 * Talent Profile service — CRUD for the talent roster.
 *
 * Collection: talent_profiles/{profileId}
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { TalentProfile, TalentType, TalentStatus } from '../types/talent-profile.types';
import type { FreelancerContract } from '../types/freelancer-contract.types';

const PROFILES_COLL   = 'talent_profiles';
const CONTRACTS_COLL  = 'freelancer_contracts';

// ─────────────────────────────────────────────────────────────────
// Profile CRUD
// ─────────────────────────────────────────────────────────────────

export async function createTalentProfile(
  input: Omit<TalentProfile, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<TalentProfile> {
  const ref = await addDoc(collection(db, PROFILES_COLL), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getTalentProfile(ref.id) as Promise<TalentProfile>;
}

export async function getTalentProfile(profileId: string): Promise<TalentProfile | null> {
  const snap = await getDoc(doc(db, PROFILES_COLL, profileId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<TalentProfile, 'id'>) };
}

export async function listTalentProfiles(filters: {
  type?: TalentType;
  status?: TalentStatus;
  subsidiaryOrgId?: string;
} = {}): Promise<TalentProfile[]> {
  const constraints = [];
  if (filters.type)            constraints.push(where('type',            '==', filters.type));
  if (filters.status)          constraints.push(where('status',          '==', filters.status));
  if (filters.subsidiaryOrgId) constraints.push(where('subsidiaryOrgId', '==', filters.subsidiaryOrgId));

  const q = constraints.length
    ? query(collection(db, PROFILES_COLL), ...constraints, orderBy('name'))
    : query(collection(db, PROFILES_COLL), orderBy('name'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TalentProfile, 'id'>) }));
}

export async function updateTalentProfile(
  profileId: string,
  updates: Partial<Omit<TalentProfile, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<void> {
  await updateDoc(doc(db, PROFILES_COLL, profileId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────────────────────────
// Freelancer Contracts (convenience — writes to root collection)
// ─────────────────────────────────────────────────────────────────

export async function createFreelancerContract(
  input: Omit<FreelancerContract, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<FreelancerContract> {
  const ref = await addDoc(collection(db, CONTRACTS_COLL), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<FreelancerContract, 'id'>) };
}

export async function listContractsForProfile(profileId: string): Promise<FreelancerContract[]> {
  const snap = await getDocs(
    query(
      collection(db, CONTRACTS_COLL),
      where('talentProfileId', '==', profileId),
      orderBy('startDate', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FreelancerContract, 'id'>) }));
}
