/**
 * Service Credentials wrapper around Cloud Functions callables.
 *
 * The actual secret values are NEVER returned to the client — listing
 * returns only `{ configured, lastFour }`; only writes carry a value.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';

export type ServiceCredentialGroup =
  | 'ai'
  | 'documents'
  | 'storefront'
  | 'messaging'
  | 'accounting';

export interface ServiceCredentialStatus {
  id: string;
  label: string;
  description?: string;
  group: ServiceCredentialGroup;
  configured: boolean;
  lastFour?: string;
  updatedAt?: string;
  /** Optional pointer to docs/console for this service. */
  helpUrl?: string;
}

export interface ServiceCredentialTestResult {
  ok: boolean;
  message: string;
}

export async function listServiceCredentials(): Promise<ServiceCredentialStatus[]> {
  const callable = httpsCallable<undefined, { credentials: ServiceCredentialStatus[] }>(
    functions,
    'adminListServiceCredentials',
  );
  const { data } = await callable();
  return data.credentials ?? [];
}

export async function setServiceCredential(id: string, value: string): Promise<void> {
  const callable = httpsCallable<{ id: string; value: string }, { ok: true }>(
    functions,
    'adminSetServiceCredential',
  );
  await callable({ id, value });
}

export async function testServiceCredential(id: string): Promise<ServiceCredentialTestResult> {
  const callable = httpsCallable<{ id: string }, ServiceCredentialTestResult>(
    functions,
    'adminTestServiceCredential',
  );
  const { data } = await callable({ id });
  return data;
}
