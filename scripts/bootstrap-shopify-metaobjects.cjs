/**
 * Bootstrap Shopify metaobject definitions.
 *
 * Reads the 6 JSON specs in docs/integrations/metaobjects/ and creates each
 * one in Shopify via Admin GraphQL. Idempotent: looks up by `type` first;
 * skips if already present. Handles circular cross-references by deferring
 * ref fields whose target type doesn't exist yet, then patching them in a
 * second pass.
 *
 * On success, writes the returned GIDs to systemConfig/shopifyConfig.metaobjectGids:
 *   { material: "gid://...", finish: "gid://...", project: "gid://...", ... }
 *
 * Usage:
 *   node scripts/bootstrap-shopify-metaobjects.cjs
 *   node scripts/bootstrap-shopify-metaobjects.cjs --dry-run
 *
 * Prereqs:
 *   - GOOGLE_APPLICATION_CREDENTIALS set (or running in a Firebase env)
 *   - systemConfig/shopifyConfig has { shopDomain, accessToken }
 */

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'dawinos' });
}
const db = admin.firestore();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

if (DRY_RUN) console.log('\n[dry-run] No mutations will be sent.\n');

// online_store capability on metaobjects requires 2024-07 or later
const SHOPIFY_API_VERSION = '2024-10';
const SHOPIFY_CONFIG_DOC = 'systemConfig/shopifyConfig';
const METAOBJECT_DIR = path.resolve(__dirname, '../docs/integrations/metaobjects');

// Creation order. `voice`, `featured_update`, `finish` reference `project`,
// `finish` references `material`, `project` references all of them. We pass
// twice: first pass defers any list.metaobject_reference / metaobject_reference
// to a type that doesn't yet exist; second pass adds them.
const ORDER = ['material', 'voice', 'press_mention', 'featured_update', 'finish', 'project'];

async function getConfig() {
  const snap = await db.doc(SHOPIFY_CONFIG_DOC).get();
  if (!snap.exists) throw new Error(`${SHOPIFY_CONFIG_DOC} not found`);
  const c = snap.data();
  if (!c.shopDomain || !c.accessToken) {
    throw new Error(`${SHOPIFY_CONFIG_DOC} missing shopDomain or accessToken`);
  }
  return c;
}

async function gql(config, query, variables = {}) {
  const url = `https://${config.shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Shopify-Access-Token': config.accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${body}`);
  const json = JSON.parse(body);
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data;
}

const LIST_DEFINITIONS = `
  query MetaobjectDefinitions {
    metaobjectDefinitions(first: 100) {
      nodes { id type name fieldDefinitions { key type { name } validations { name value } } }
    }
  }
`;

const DEFINITION_CREATE = `
  mutation Create($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type fieldDefinitions { key } }
      userErrors { field message code }
    }
  }
`;

const DEFINITION_UPDATE = `
  mutation Update($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition { id type fieldDefinitions { key } }
      userErrors { field message code }
    }
  }
`;

function loadSpec(type) {
  const filePath = path.join(METAOBJECT_DIR, `${type}.json`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const spec = JSON.parse(raw);
  return spec;
}

/**
 * Convert a JSON spec field-definition entry into the Shopify
 * `MetaobjectFieldDefinitionCreateInput` shape.
 */
function fieldFromSpec(f, existsByType = new Map()) {
  const out = {
    key: f.key,
    name: f.name,
    type: f.type,
  };
  if (f.required) out.required = true;
  if (f.validations && f.validations.length > 0) {
    out.validations = f.validations
      .map((v) => {
        // Shopify's metaobject_reference / list.metaobject_reference fields
        // require the validation `metaobject_definition_id` with a GID, not
        // `metaobject_definition` with a type string. Translate on the fly.
        if (v.name === 'metaobject_definition') {
          const target = existsByType.get(v.value);
          if (!target) return null; // deferred — handled by caller
          return { name: 'metaobject_definition_id', value: target.id };
        }
        return { name: v.name, value: v.value };
      })
      .filter(Boolean);
  }
  return out;
}

function isReferenceToOtherDawinType(field) {
  const t = field.type;
  if (t !== 'metaobject_reference' && t !== 'list.metaobject_reference') return false;
  return (field.validations || []).some((v) => v.name === 'metaobject_definition');
}

function refTargetType(field) {
  const v = (field.validations || []).find((x) => x.name === 'metaobject_definition');
  return v ? v.value : null;
}

/**
 * Build the definition payload, optionally deferring references whose target
 * type isn't yet in `existsByType`.
 */
// Shopify reserves certain names — they're system-managed on every metaobject
// and rejected as user-defined field definitions.
const RESERVED_FIELD_KEYS = new Set(['handle', 'id', 'type', 'display_name', 'displayName']);

function buildDefinitionPayload(spec, existsByType) {
  const fieldDefinitions = [];
  const deferred = [];
  for (const f of spec.field_definitions) {
    if (RESERVED_FIELD_KEYS.has(f.key)) continue;
    if (isReferenceToOtherDawinType(f)) {
      const targetType = refTargetType(f);
      if (!existsByType.has(targetType)) {
        deferred.push(f);
        continue;
      }
    }
    fieldDefinitions.push(fieldFromSpec(f, existsByType));
  }
  // Shopify rejects access.admin on merchant-owned (non-app-reserved) types —
  // MERCHANT_READ_WRITE is the default anyway. Strip it and keep only the
  // storefront access setting.
  const access = spec.access?.storefront ? { storefront: spec.access.storefront } : undefined;
  return {
    type: spec.type,
    name: spec.name,
    description: spec.description,
    access,
    capabilities: toShopifyCapabilities(spec.capabilities),
    fieldDefinitions,
    deferred,
  };
}

/**
 * Transform the snake_case JSON-spec capabilities into the camelCase shape
 * the Shopify GraphQL `MetaobjectCapabilityCreateInput` expects, and reshape
 * `online_store` → `onlineStore: { enabled, data: { urlHandle, canCreateRedirects } }`.
 * Disabled `online_store` is dropped entirely (the API rejects it on entities
 * that aren't URL-addressable).
 */
function toShopifyCapabilities(caps = {}) {
  const out = {};
  if (caps.publishable) out.publishable = { enabled: !!caps.publishable.enabled };
  if (caps.translatable) out.translatable = { enabled: !!caps.translatable.enabled };
  if (caps.online_store && caps.online_store.enabled) {
    // Note: canCreateRedirects isn't a definition-create input; redirects are
    // configured per-entry, not per-definition.
    out.onlineStore = {
      enabled: true,
      data: { urlHandle: caps.online_store.url_handle },
    };
  }
  return out;
}

async function listExisting(config) {
  const data = await gql(config, LIST_DEFINITIONS);
  const byType = new Map();
  for (const n of data.metaobjectDefinitions?.nodes || []) {
    byType.set(n.type, n);
  }
  return byType;
}

async function ensureDefinition(config, spec, existsByType) {
  const existing = existsByType.get(spec.type);
  const payload = buildDefinitionPayload(spec, existsByType);

  if (existing) {
    // Reconcile: anything in the spec that isn't yet on the live definition
    // becomes a pass-2 patch (covers retries after a partial earlier failure).
    const existingKeys = new Set((existing.fieldDefinitions || []).map((f) => f.key));
    const missingFromLive = spec.field_definitions.filter(
      (f) => !RESERVED_FIELD_KEYS.has(f.key) && !existingKeys.has(f.key)
    );
    console.log(`  · ${spec.type}: exists (${existing.id}) — skipping create, ${missingFromLive.length} field(s) to reconcile in pass 2`);
    return { gid: existing.id, deferred: missingFromLive, isNew: false };
  }

  if (DRY_RUN) {
    console.log(`  · ${spec.type}: WOULD create with ${payload.fieldDefinitions.length} fields (deferring ${payload.deferred.length} refs)`);
    return { gid: `gid://shopify/MetaobjectDefinition/PENDING-${spec.type}`, deferred: payload.deferred, isNew: true };
  }

  const data = await gql(config, DEFINITION_CREATE, {
    definition: {
      type: payload.type,
      name: payload.name,
      description: payload.description,
      access: payload.access,
      capabilities: payload.capabilities,
      fieldDefinitions: payload.fieldDefinitions,
    },
  });
  const errs = data.metaobjectDefinitionCreate?.userErrors || [];
  if (errs.length > 0) {
    throw new Error(`metaobjectDefinitionCreate(${spec.type}) errors: ${JSON.stringify(errs)}`);
  }
  const mod = data.metaobjectDefinitionCreate.metaobjectDefinition;
  console.log(`  · ${spec.type}: created ${mod.id} (${payload.fieldDefinitions.length} fields, ${payload.deferred.length} deferred)`);
  return { gid: mod.id, deferred: payload.deferred, isNew: true };
}

async function patchDeferred(config, spec, gid, deferred, existsByType) {
  if (!deferred || deferred.length === 0) return;
  if (DRY_RUN) {
    console.log(`  · ${spec.type}: WOULD patch ${deferred.length} deferred fields`);
    return;
  }
  // We always re-fetch the definition's current field keys so we don't double-add.
  const data0 = await gql(config, LIST_DEFINITIONS);
  const existingDef = (data0.metaobjectDefinitions?.nodes || []).find((n) => n.id === gid);
  const existingKeys = new Set((existingDef?.fieldDefinitions || []).map((f) => f.key));
  const fieldsToAdd = deferred
    .filter((f) => !existingKeys.has(f.key))
    .map((f) => fieldFromSpec(f, existsByType));
  if (fieldsToAdd.length === 0) {
    console.log(`  · ${spec.type}: deferred fields already present — nothing to patch`);
    return;
  }
  const data = await gql(config, DEFINITION_UPDATE, {
    id: gid,
    definition: {
      fieldDefinitions: fieldsToAdd.map((field) => ({ create: field })),
    },
  });
  const errs = data.metaobjectDefinitionUpdate?.userErrors || [];
  if (errs.length > 0) {
    throw new Error(`metaobjectDefinitionUpdate(${spec.type}) errors: ${JSON.stringify(errs)}`);
  }
  console.log(`  · ${spec.type}: patched ${fieldsToAdd.length} ref fields`);
}

async function main() {
  console.log('▶ Bootstrap Shopify metaobject definitions\n');
  const config = await getConfig();
  console.log(`  shopDomain: ${config.shopDomain}\n`);

  const existsByType = await listExisting(config);

  const results = {}; // type -> { gid, deferred }
  console.log('▶ Pass 1: create or detect each definition (deferring circular refs)\n');
  for (const type of ORDER) {
    const spec = loadSpec(type);
    const { gid, deferred, isNew } = await ensureDefinition(config, spec, existsByType);
    results[type] = { gid, deferred };
    // After (potentially) creating, mark exists so subsequent definitions can
    // include refs to it.
    existsByType.set(type, { id: gid, type, fieldDefinitions: spec.field_definitions });
  }

  console.log('\n▶ Pass 2: patch deferred reference fields\n');
  for (const type of ORDER) {
    const spec = loadSpec(type);
    const { gid, deferred } = results[type];
    await patchDeferred(config, spec, gid, deferred, existsByType);
  }

  console.log('\n▶ Writing GIDs to systemConfig/shopifyConfig.metaobjectGids');
  const metaobjectGids = {};
  for (const type of ORDER) {
    metaobjectGids[type] = results[type].gid;
  }
  if (!DRY_RUN) {
    await db.doc(SHOPIFY_CONFIG_DOC).set(
      { metaobjectGids, metaobjectGidsUpdatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  } else {
    console.log('  [dry-run] would write:', metaobjectGids);
  }

  console.log('\n✓ Done.');
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('\n✗ Failed:', err.message || err);
  console.error(err.stack || '');
  process.exit(1);
});
