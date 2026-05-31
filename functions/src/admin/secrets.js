/**
 * Service Credentials admin callables.
 *
 * Reads/writes integration API keys via Google Cloud Secret Manager so admins
 * can rotate them without redeploying. The full secret value is never returned
 * to the client — list responses only carry the last 4 chars + presence.
 *
 * Permissions:
 *   - list / test: any authenticated admin (DawinUser.globalRole in {admin, owner})
 *   - set:        owner only  (or hard-coded super-user email)
 *
 * IAM: the Cloud Run service account running these functions needs:
 *   - roles/secretmanager.admin    (to create new secrets and add versions)
 * If only `secretmanager.secretAccessor` is granted, list+test still work but
 * `set` will fail with PERMISSION_DENIED — surface that as an actionable error.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const secretClient = new SecretManagerServiceClient();

const SUPER_USER_EMAILS = [
  'onzimai@zeusgroup.co.ug',
  'onzimai@dawin.group',
  'admin@zeusgroup.co.ug',
];

/**
 * Registry of secrets exposed in the API Keys page.
 * Add a new entry here to surface a new service credential.
 */
const SERVICE_REGISTRY = [
  // AI Services
  {
    id: 'GEMINI_API_KEY',
    label: 'Google Gemini',
    group: 'ai',
    description: 'AI model for backfill, content drafting, and Smart UI.',
    helpUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'OPENAI_API_KEY',
    label: 'OpenAI',
    group: 'ai',
    description: 'Optional OpenAI key for fallback completions.',
    helpUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'ANTHROPIC_API_KEY',
    label: 'Anthropic Claude',
    group: 'ai',
    description: 'Optional Claude API key.',
    helpUrl: 'https://console.anthropic.com/',
  },

  // Documents
  {
    id: 'ADOBE_CLIENT_SECRET',
    label: 'Adobe PDF Services — Client Secret',
    group: 'documents',
    description: 'Server-side OAuth secret for Adobe PDF Services.',
    helpUrl: 'https://developer.adobe.com/console',
  },
  {
    id: 'ADOBE_SIGN_CLIENT_SECRET',
    label: 'Adobe Sign — Client Secret',
    group: 'documents',
    helpUrl: 'https://developer.adobe.com/console',
  },

  // Storefront
  {
    id: 'SHOPIFY_ADMIN_TOKEN',
    label: 'Shopify Admin API Token',
    group: 'storefront',
    description: 'Used for product sync to dawinfinishes.com.',
    helpUrl: 'https://shopify.dev/docs/apps/auth/admin-app-access-tokens',
  },

  // Messaging
  {
    id: 'META_WHATSAPP_ACCESS_TOKEN',
    label: 'WhatsApp Cloud API — Access Token',
    group: 'messaging',
    helpUrl: 'https://developers.facebook.com/docs/whatsapp/cloud-api/get-started',
  },
  {
    id: 'META_APP_ID',
    label: 'Meta App ID',
    group: 'messaging',
    description: 'Public Meta App ID used by WhatsApp + social integrations.',
    helpUrl: 'https://developers.facebook.com/apps/',
  },
  {
    id: 'META_APP_SECRET',
    label: 'Meta App Secret',
    group: 'messaging',
    description: 'Signs webhook callbacks for WhatsApp + Meta integrations.',
    helpUrl: 'https://developers.facebook.com/apps/',
  },
  {
    id: 'META_OAUTH_STATE_SECRET',
    label: 'Meta OAuth State Secret',
    group: 'messaging',
    description: 'HMAC key for signing the OAuth state parameter in Meta auth flows.',
  },
  {
    id: 'SOCIAL_TOKEN_ENCRYPTION_KEY',
    label: 'Social Token Encryption Key',
    group: 'messaging',
    description: 'Encrypts third-party social provider tokens stored in Firestore.',
  },

  // Accounting
  {
    id: 'QBO_CLIENT_SECRET',
    label: 'QuickBooks Online — Client Secret',
    group: 'accounting',
    description: 'Required for QBO OAuth refresh + sync.',
    helpUrl: 'https://developer.intuit.com/app/developer/dashboard',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getProjectId() {
  // Prefer GOOGLE_CLOUD_PROJECT (set by Functions runtime); fall back to admin SDK.
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    (await admin.app().options.projectId) ||
    'zeusos'
  );
}

function secretName(projectId, id) {
  return `projects/${projectId}/secrets/${id}`;
}

function latestVersionName(projectId, id) {
  return `${secretName(projectId, id)}/versions/latest`;
}

/**
 * Returns `{ configured, lastFour, updatedAt }` for a single secret.
 * Never returns the raw value.
 */
async function readSecretStatus(projectId, id) {
  try {
    const [version] = await secretClient.accessSecretVersion({
      name: latestVersionName(projectId, id),
    });
    const value = version?.payload?.data?.toString('utf8') ?? '';
    if (!value) return { configured: false };
    const lastFour = value.length >= 4 ? value.slice(-4) : value;

    // Look up updatedAt from the version metadata.
    let updatedAt;
    try {
      const [meta] = await secretClient.getSecretVersion({
        name: version.name,
      });
      const ts = meta?.createTime;
      if (ts?.seconds) {
        updatedAt = new Date(Number(ts.seconds) * 1000).toISOString();
      }
    } catch {
      // Ignore metadata read failures — status is still useful.
    }

    return { configured: true, lastFour, updatedAt };
  } catch (err) {
    // NOT_FOUND just means the secret hasn't been created yet.
    if (err && (err.code === 5 || err.code === 'NOT_FOUND')) {
      return { configured: false };
    }
    logger.warn(`Failed to read secret ${id}`, err?.message);
    return { configured: false };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime resolver — used by AI / comms / integration functions to read a
// credential at call time. Reads `versions/latest` from Secret Manager so a
// key set via the Settings → API Keys page takes effect WITHOUT a redeploy
// (a `defineSecret`-bound env var only refreshes on deploy). Falls back to the
// process env (the deploy-time bound value) when Secret Manager has no version,
// and returns null when nothing is configured. Short-TTL in-memory cache keeps
// us off the Secret Manager API on every invocation within a warm instance.
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_CACHE_TTL_MS = 5 * 60 * 1000;
const _secretCache = new Map(); // id -> { value, fetchedAt }

/**
 * Resolve a service credential value at runtime.
 * @param {string} id — registry id, e.g. 'ANTHROPIC_API_KEY'.
 * @returns {Promise<string|null>} the secret value, or null if unconfigured.
 */
async function resolveServiceSecret(id) {
  if (!id || typeof id !== 'string') return null;

  const cached = _secretCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < SECRET_CACHE_TTL_MS) {
    return cached.value;
  }

  let value = null;
  try {
    const projectId = await getProjectId();
    const [version] = await secretClient.accessSecretVersion({
      name: latestVersionName(projectId, id),
    });
    const raw = version?.payload?.data?.toString('utf8') ?? '';
    if (raw) value = raw;
  } catch (err) {
    // NOT_FOUND / access errors fall through to the env fallback.
    if (!(err && (err.code === 5 || err.code === 'NOT_FOUND'))) {
      logger.warn(`resolveServiceSecret(${id}) Secret Manager read failed`, err?.message);
    }
  }

  // Fallback to the deploy-time bound value (defineSecret / .env).
  if (!value && process.env[id]) value = process.env[id];

  _secretCache.set(id, { value, fetchedAt: Date.now() });
  return value;
}

async function requireAuthorized(request, requireOwner) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required');
  }
  const email = request.auth.token?.email;
  const isSuperUser = email && SUPER_USER_EMAILS.includes(email);
  if (isSuperUser) return { uid: request.auth.uid, email, role: 'owner' };

  // Look up the DawinUser profile to read globalRole. ZeusOS stores the
  // user doc keyed by uid at `organizations/default/users/{uid}` (canonical)
  // with a `users/{uid}` fallback — mirror `loadUserDoc` in
  // assignment/lib/auth.js rather than the legacy DawinOS uid-field query
  // (which misses doc-id-keyed records).
  let role;
  try {
    let snap = await db.doc(`organizations/default/users/${request.auth.uid}`).get();
    if (!snap.exists) snap = await db.doc(`users/${request.auth.uid}`).get();
    if (snap.exists) {
      role = snap.data()?.globalRole;
    }
  } catch (err) {
    logger.warn('Failed to look up DawinUser', err?.message);
  }

  if (role !== 'admin' && role !== 'owner') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }
  if (requireOwner && role !== 'owner') {
    throw new HttpsError('permission-denied', 'Owner role required to rotate credentials.');
  }
  return { uid: request.auth.uid, email, role };
}

async function appendAuditLog(actor, action, details) {
  try {
    await db.collection('admin_audit_log').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      userId: actor.uid,
      userEmail: actor.email,
      action,
      resource: 'service_credential',
      details,
    });
  } catch (err) {
    logger.warn('Failed to write audit log entry', err?.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// adminListServiceCredentials
// ─────────────────────────────────────────────────────────────────────────────

exports.adminListServiceCredentials = onCall(
  { cors: true, timeoutSeconds: 30 },
  async (request) => {
    await requireAuthorized(request, false);
    const projectId = await getProjectId();

    const credentials = await Promise.all(
      SERVICE_REGISTRY.map(async (entry) => {
        const status = await readSecretStatus(projectId, entry.id);
        return {
          id: entry.id,
          label: entry.label,
          description: entry.description,
          group: entry.group,
          helpUrl: entry.helpUrl,
          ...status,
        };
      }),
    );

    return { credentials };
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminSetServiceCredential
// ─────────────────────────────────────────────────────────────────────────────

exports.adminSetServiceCredential = onCall(
  { cors: true, timeoutSeconds: 30 },
  async (request) => {
    const actor = await requireAuthorized(request, true); // owner only
    const { id, value } = request.data || {};

    if (!id || typeof id !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing credential id');
    }
    if (!value || typeof value !== 'string' || !value.trim()) {
      throw new HttpsError('invalid-argument', 'Missing credential value');
    }
    if (!SERVICE_REGISTRY.find((e) => e.id === id)) {
      throw new HttpsError('invalid-argument', `Unknown credential: ${id}`);
    }

    const projectId = await getProjectId();
    const parent = `projects/${projectId}`;
    const trimmed = value.trim();

    try {
      // Create the secret if it doesn't exist yet.
      try {
        await secretClient.getSecret({ name: secretName(projectId, id) });
      } catch (err) {
        if (err && (err.code === 5 || err.code === 'NOT_FOUND')) {
          await secretClient.createSecret({
            parent,
            secretId: id,
            secret: { replication: { automatic: {} } },
          });
          logger.info(`Created Secret Manager secret ${id}`);
        } else {
          throw err;
        }
      }

      const [version] = await secretClient.addSecretVersion({
        parent: secretName(projectId, id),
        payload: { data: Buffer.from(trimmed, 'utf8') },
      });

      await appendAuditLog(actor, 'set_credential', {
        credentialId: id,
        versionName: version?.name,
      });

      return { ok: true };
    } catch (err) {
      logger.error(`Failed to set secret ${id}`, err);
      if (err?.code === 7 || err?.code === 'PERMISSION_DENIED') {
        throw new HttpsError(
          'permission-denied',
          'Functions service account lacks roles/secretmanager.admin. Grant it in IAM, then try again.',
        );
      }
      throw new HttpsError('internal', err?.message || 'Failed to write secret');
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// adminTestServiceCredential
// ─────────────────────────────────────────────────────────────────────────────

async function testGemini(value) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(value)}`,
      { method: 'GET' },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, message: `Gemini rejected key (HTTP ${res.status}): ${text.slice(0, 200)}` };
    }
    return { ok: true, message: 'Gemini key accepted; models endpoint responded 200.' };
  } catch (err) {
    return { ok: false, message: err?.message || 'Gemini request failed' };
  }
}

async function testShopify(value) {
  // We don't know the shop domain from here without extra config — just return
  // a soft "configured" probe so the UI shows the key reaches the function.
  return {
    ok: !!value,
    message: value
      ? 'Token present. Full storefront ping requires SHOPIFY_SHOP_DOMAIN env config.'
      : 'No token configured.',
  };
}

async function testGeneric(id, value) {
  return {
    ok: !!value,
    message: value
      ? `${id} present (${value.length} chars). No connectivity probe defined for this service yet.`
      : `${id} is not configured.`,
  };
}

exports.adminTestServiceCredential = onCall(
  { cors: true, timeoutSeconds: 30 },
  async (request) => {
    await requireAuthorized(request, false);
    const { id } = request.data || {};
    if (!id || typeof id !== 'string') {
      throw new HttpsError('invalid-argument', 'Missing credential id');
    }
    if (!SERVICE_REGISTRY.find((e) => e.id === id)) {
      throw new HttpsError('invalid-argument', `Unknown credential: ${id}`);
    }

    const projectId = await getProjectId();
    let rawValue = '';
    try {
      const [version] = await secretClient.accessSecretVersion({
        name: latestVersionName(projectId, id),
      });
      rawValue = version?.payload?.data?.toString('utf8') ?? '';
    } catch (err) {
      if (err && (err.code === 5 || err.code === 'NOT_FOUND')) {
        return { ok: false, message: `${id} is not configured.` };
      }
      throw new HttpsError('internal', err?.message || 'Failed to read secret');
    }

    if (!rawValue) return { ok: false, message: `${id} is not configured.` };

    if (id === 'GEMINI_API_KEY') return testGemini(rawValue);
    if (id === 'SHOPIFY_ADMIN_TOKEN') return testShopify(rawValue);
    return testGeneric(id, rawValue);
  },
);

// Runtime resolver for other Cloud Functions (AI / comms / integrations).
exports.resolveServiceSecret = resolveServiceSecret;
