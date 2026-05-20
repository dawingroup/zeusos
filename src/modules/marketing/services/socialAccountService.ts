/**
 * Social Account Service
 * CRUD + real-time subscriptions for our owned subsidiary social pages.
 * Mirrors projectCaseStudyService — subsidiaryId scoping, onSnapshot subscriptions.
 */

import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  CollectionReference,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { SOCIAL_ACCOUNTS_COLLECTION, SOCIAL_ACCOUNT_INSIGHTS_COLLECTION } from '../constants';
import type {
  SocialMediaAccount,
  SocialAccountFormData,
  SocialAccountPlatform,
  SocialAccountSnapshot,
} from '../types';

const accountsRef = collection(
  db,
  SOCIAL_ACCOUNTS_COLLECTION
) as CollectionReference<SocialMediaAccount>;

function normalizeHandle(handle: string): string {
  return handle.trim().replace(/^@/, '');
}

export async function createSocialAccount(
  data: SocialAccountFormData,
  userId: string
): Promise<string> {
  const payload: Omit<SocialMediaAccount, 'id'> = {
    subsidiaryId: data.subsidiaryId,
    platform: data.platform,
    displayName: data.displayName.trim(),
    handle: normalizeHandle(data.handle),
    profileUrl: data.profileUrl.trim(),
    status: data.trackingEnabled === false ? 'paused' : 'tracking',
    trackingEnabled: data.trackingEnabled !== false,
    oauthEnabled: false,
    createdAt: serverTimestamp() as Timestamp,
    createdBy: userId,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const docRef = await addDoc(accountsRef, payload as SocialMediaAccount);
  return docRef.id;
}

export async function getSocialAccount(id: string): Promise<SocialMediaAccount | null> {
  const snap = await getDoc(doc(db, SOCIAL_ACCOUNTS_COLLECTION, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as SocialMediaAccount) : null;
}

export function subscribeToSocialAccounts(
  subsidiaryId: string,
  callback: (accounts: SocialMediaAccount[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    accountsRef,
    where('subsidiaryId', '==', subsidiaryId),
    orderBy('platform', 'asc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as SocialMediaAccount)));
    },
    (error) => {
      console.error('Error subscribing to social accounts:', error);
      onError?.(error);
    }
  );
}

export function subscribeToSocialAccountsByPlatform(
  subsidiaryId: string,
  platform: SocialAccountPlatform,
  callback: (accounts: SocialMediaAccount[]) => void
): () => void {
  const q = query(
    accountsRef,
    where('subsidiaryId', '==', subsidiaryId),
    where('platform', '==', platform)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as SocialMediaAccount)));
  });
}

export async function updateSocialAccount(
  id: string,
  updates: Partial<SocialAccountFormData>
): Promise<void> {
  const patch: Record<string, unknown> = {
    ...updates,
    updatedAt: serverTimestamp(),
  };
  if (typeof updates.handle === 'string') {
    patch.handle = normalizeHandle(updates.handle);
  }
  await updateDoc(doc(db, SOCIAL_ACCOUNTS_COLLECTION, id), patch);
}

export async function setAccountTracking(id: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db, SOCIAL_ACCOUNTS_COLLECTION, id), {
    trackingEnabled: enabled,
    status: enabled ? 'tracking' : 'paused',
    updatedAt: serverTimestamp(),
  });
}

export async function deleteSocialAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, SOCIAL_ACCOUNTS_COLLECTION, id));
}

/**
 * Start the Meta OAuth flow for a social account.
 * Calls the `metaOAuthStart` callable to get a signed redirect URL, then opens
 * the Facebook Login dialog in a popup. The popup's server-side callback handler
 * posts a `dawinos-meta-oauth` message back when it's done; we resolve on that.
 */
export async function startMetaOAuth(
  socialMediaAccountId: string,
  options: { popupName?: string } = {}
): Promise<{ status: 'ok' | 'error'; message: string }> {
  const { httpsCallable, getFunctions } = await import('firebase/functions');
  const fn = httpsCallable<{ socialMediaAccountId: string }, { authUrl: string }>(
    getFunctions(undefined, 'us-central1'),
    'metaOAuthStart'
  );
  const { data } = await fn({ socialMediaAccountId });

  const popup = window.open(
    data.authUrl,
    options.popupName || 'metaOAuth',
    'popup=yes,width=520,height=720'
  );
  if (!popup) {
    throw new Error('Popup blocked — allow popups for dawinos.web.app and try again');
  }

  return new Promise((resolve) => {
    let settled = false;
    const onMessage = (event: MessageEvent) => {
      if (!event.data || event.data.source !== 'dawinos-meta-oauth') return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(pollTimer);
      resolve({
        status: event.data.status === 'ok' ? 'ok' : 'error',
        message: event.data.message || '',
      });
    };
    window.addEventListener('message', onMessage);
    // Fallback: poll for popup close in case the message path is blocked.
    const pollTimer = setInterval(() => {
      if (!settled && popup.closed) {
        settled = true;
        window.removeEventListener('message', onMessage);
        clearInterval(pollTimer);
        resolve({ status: 'ok', message: 'Window closed' });
      }
    }, 800);
  });
}

export async function disconnectMetaAccount(
  socialMediaAccountId: string
): Promise<void> {
  const { httpsCallable, getFunctions } = await import('firebase/functions');
  const fn = httpsCallable<{ socialMediaAccountId: string }, { ok: boolean }>(
    getFunctions(undefined, 'us-central1'),
    'metaDisconnect'
  );
  await fn({ socialMediaAccountId });
}

/**
 * Subscribe to the latest-snapshot insights doc for each account in a subsidiary.
 * The sync job writes to `socialAccountInsights/{accountId}/latest/snapshot`.
 */
export function subscribeToAccountSnapshots(
  subsidiaryId: string,
  callback: (snapshots: SocialAccountSnapshot[]) => void
): () => void {
  // Flat collection: socialAccountInsights doc id == accountId, contains the latest snapshot.
  const q = query(
    collection(db, SOCIAL_ACCOUNT_INSIGHTS_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId)
  );
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs.map((d) => ({ accountId: d.id, ...d.data() } as SocialAccountSnapshot))
    );
  });
}
