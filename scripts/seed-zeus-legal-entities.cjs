/**
 * Seed Zeus Group Legal-Entity Organization records — Phase 3.A.5.
 *
 * Per Tech Spec v1.0 §4.1 / plan §14.4 each sub-brand is a real legal
 * entity, not a theming tag. This script stamps one
 * `organizations/{orgId}` document per legal entity with the
 * commercial-gravity metadata (`kind`, `is_legal_entity`,
 * `base_currency`, `gl_connection_id`) that downstream collections
 * (rate_cards, intercompany_invoices, etc.) reference via FK.
 *
 * These docs sit ALONGSIDE the legacy tenant container at
 * `organizations/default/...` — they do not replace it. The legacy
 * container continues to hold users, settings, audit log, and
 * pre-Phase-3 collections.
 *
 * Idempotent. Re-running merges fields rather than overwriting siblings,
 * so it's safe to run repeatedly as we evolve the metadata.
 *
 * Run:
 *   node scripts/seed-zeus-legal-entities.cjs
 *   node scripts/seed-zeus-legal-entities.cjs --dry-run
 *
 * Prerequisite — Application Default Credentials, either:
 *   1.  gcloud auth application-default login
 *   2.  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/zeusos-sa-key.json
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'zeusos' });
const db = admin.firestore();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

if (DRY_RUN) console.log('\n  DRY RUN — no documents will be written\n');

// ─── Legal-entity records ───────────────────────────────────────────────────

const LEGAL_ENTITIES = [
  {
    id: 'zeus-group',
    name: 'Zeus Group',
    legalName: 'Zeus The Agency Limited',
    kind: 'PARENT',
    is_legal_entity: true,
    base_currency: 'UGX',
    gl_connection_id: null,
  },
  {
    id: 'zeus-the-agency',
    name: 'Zeus The Agency',
    legalName: 'Zeus The Agency Limited',
    kind: 'SUBSIDIARY',
    is_legal_entity: true,
    base_currency: 'UGX',
    gl_connection_id: null,
  },
  {
    id: 'zeus-digital',
    name: 'Zeus Digital',
    legalName: 'Zeus Digital Limited',
    kind: 'SUBSIDIARY',
    is_legal_entity: true,
    base_currency: 'UGX',
    gl_connection_id: null,
  },
  {
    id: 'labyrinth',
    name: 'Labyrinth Content Studio',
    legalName: 'Labyrinth Content Studio Limited',
    kind: 'SUBSIDIARY',
    is_legal_entity: true,
    base_currency: 'UGX',
    gl_connection_id: null,
  },
  {
    id: 'odd-gorilla',
    name: 'Odd Gorilla',
    legalName: 'Odd Gorilla Limited',
    kind: 'SUBSIDIARY',
    is_legal_entity: true,
    base_currency: 'UGX',
    gl_connection_id: null,
  },
  {
    id: 'house-of-zeus',
    name: 'House of Zeus',
    legalName: 'House of Zeus Limited',
    kind: 'SUBSIDIARY',
    is_legal_entity: true,
    // Per CLAUDE.md — the Kenyan footprint runs on KES.
    base_currency: 'KES',
    gl_connection_id: null,
  },
];

// ─── Run ────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  let written = 0;
  let unchanged = 0;

  for (const entity of LEGAL_ENTITIES) {
    const ref = db.collection('organizations').doc(entity.id);
    const existing = await ref.get();

    const payload = {
      ...entity,
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
    };

    if (existing.exists) {
      const data = existing.data();
      const equivalent =
        data.kind === entity.kind
        && data.is_legal_entity === entity.is_legal_entity
        && data.base_currency === entity.base_currency
        && data.gl_connection_id === entity.gl_connection_id
        && data.name === entity.name;

      if (equivalent) {
        console.log(`  · ${entity.id.padEnd(20)} unchanged`);
        unchanged++;
        continue;
      }
    }

    if (DRY_RUN) {
      console.log(`  + ${entity.id.padEnd(20)} would write:`);
      console.log(`        kind             ${payload.kind}`);
      console.log(`        is_legal_entity  ${payload.is_legal_entity}`);
      console.log(`        base_currency    ${payload.base_currency}`);
      console.log(`        gl_connection_id ${payload.gl_connection_id ?? 'null'}`);
      written++;
      continue;
    }

    await ref.set(payload, { merge: true });
    console.log(`  ✓ ${entity.id.padEnd(20)} ${existing.exists ? 'updated' : 'created'}`);
    written++;
  }

  console.log(`\n  ${written} ${DRY_RUN ? 'would change' : 'written'} · ${unchanged} unchanged · ${LEGAL_ENTITIES.length} total\n`);
}

main().catch((err) => {
  console.error('\n  FATAL:', err);
  process.exit(1);
});
