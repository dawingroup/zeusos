import { GoogleAuth } from 'google-auth-library';

const _auth = new GoogleAuth();
const CF_BASE = 'https://us-central1-dawinos.cloudfunctions.net';

/**
 * Call a Firebase onCall (Gen 2) Cloud Function from a server context.
 * Uses Google OIDC identity tokens which satisfy Cloud Run invoker requirements.
 * In GCP (Cloud Functions), credentials are automatic. Locally, set
 * GOOGLE_APPLICATION_CREDENTIALS to a service account JSON with cloudfunctions.invoker role.
 */
export async function callCloudFunction<I, O>(name: string, data: I): Promise<O> {
  const url = `${CF_BASE}/${name}`;
  const client = await _auth.getIdTokenClient(url);
  const res = await client.request<{ result: O }>({
    url,
    method: 'POST',
    data: { data },
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data.result;
}
