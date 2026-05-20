/**
 * Install Shopify webhook secrets into systemConfig/shopifyConfig.
 *
 * Two secrets:
 *   - apiSecret      → the Shopify app's "API secret key" (from
 *                       Shopify admin → Apps → DawinOS Sync → API credentials).
 *                       Used by Shopify to sign native webhooks
 *                       (X-Shopify-Hmac-Sha256), e.g. customers/create.
 *   - webhookSecret  → a random 32-byte base64 we generate ourselves. Used
 *                       to sign Shopify Flow → DawinOS calls
 *                       (X-Dawin-Signature: sha256=<hex>), e.g. sample-order.
 *
 * Usage:
 *   # Generate + install a new webhookSecret only (apiSecret untouched)
 *   node scripts/install-shopify-webhook-secrets.cjs --generate-webhook
 *
 *   # Install a specific apiSecret value (paste from Shopify admin)
 *   node scripts/install-shopify-webhook-secrets.cjs --api-secret=<value>
 *
 *   # Both at once
 *   node scripts/install-shopify-webhook-secrets.cjs --api-secret=<value> --generate-webhook
 *
 *   # Print the current webhookSecret (so you can paste it into Shopify Flow)
 *   node scripts/install-shopify-webhook-secrets.cjs --print
 *
 * Prereqs:
 *   - GOOGLE_APPLICATION_CREDENTIALS pointing at a service account that can
 *     write systemConfig (typically `firebase-adminsdk-*@dawinos.iam.gserviceaccount.com`).
 */

const crypto = require('crypto');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'dawinos' });
}
const db = admin.firestore();

const args = process.argv.slice(2);
const flagGenerate = args.includes('--generate-webhook');
const flagPrint = args.includes('--print');
const apiSecretFlag = args.find((a) => a.startsWith('--api-secret='));
const apiSecret = apiSecretFlag ? apiSecretFlag.split('=')[1] : null;

const DOC = 'systemConfig/shopifyConfig';

async function main() {
  const ref = db.doc(DOC);

  if (flagPrint) {
    const snap = await ref.get();
    if (!snap.exists) {
      console.error(`${DOC} not found`);
      process.exit(1);
    }
    const d = snap.data();
    console.log(JSON.stringify({
      shopDomain: d.shopDomain || null,
      hasAccessToken: Boolean(d.accessToken),
      hasApiSecret: Boolean(d.apiSecret),
      apiSecretMasked: d.apiSecret ? `${d.apiSecret.slice(0, 4)}…${d.apiSecret.slice(-4)}` : null,
      webhookSecret: d.webhookSecret || null,
      enquirySecret: d.enquirySecret ? '(present, untouched)' : null,
      indexNowKey: d.indexNowKey || null,
    }, null, 2));
    return;
  }

  const update = {};

  if (apiSecret) {
    update.apiSecret = apiSecret;
    update.apiSecretRotatedAt = admin.firestore.FieldValue.serverTimestamp();
    console.log(`▶ Setting apiSecret (${apiSecret.length} chars)`);
  }

  let generatedWebhookSecret = null;
  if (flagGenerate) {
    generatedWebhookSecret = crypto.randomBytes(32).toString('base64');
    update.webhookSecret = generatedWebhookSecret;
    update.webhookSecretRotatedAt = admin.firestore.FieldValue.serverTimestamp();
    console.log('▶ Generating a new webhookSecret');
  }

  if (Object.keys(update).length === 0) {
    console.log('Nothing to do. Pass --api-secret=<value>, --generate-webhook, or --print.');
    return;
  }

  await ref.set(update, { merge: true });
  console.log(`✓ Wrote ${Object.keys(update).filter((k) => !k.endsWith('RotatedAt')).join(', ')} to ${DOC}`);

  if (generatedWebhookSecret) {
    console.log('\n──────────────────────────────────────────────');
    console.log('Paste this into Shopify Flow "X-Dawin-Signature" header:');
    console.log('   (the header value is sha256=<hex hmac of body using this secret>;');
    console.log('    Shopify Flow has a built-in HMAC helper that takes the secret directly)');
    console.log('');
    console.log(`SECRET:  ${generatedWebhookSecret}`);
    console.log('──────────────────────────────────────────────\n');
    console.log('Store this in 1Password/your secret store — Firestore is the only other copy.');
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('✗ Failed:', err.message || err);
  process.exit(1);
});
