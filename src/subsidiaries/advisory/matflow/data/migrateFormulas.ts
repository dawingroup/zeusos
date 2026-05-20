/**
 * Migration Script — Seed Firestore Formula Library
 *
 * Run this ONCE to migrate from hardcoded formulas to the Firestore library.
 *
 * Usage:
 *   npx ts-node migrateFormulas.ts
 *
 * Or from the Firebase Functions shell:
 *   import { migrateFormulas } from './migrateFormulas';
 *   await migrateFormulas();
 */

import { initializeApp } from 'firebase/app';
import { importFromJSON } from './formulaLibraryService';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Firebase (uses env vars or service account)
// If running in a Firebase Functions context, this is already initialized.
const firebaseConfig = {
  // Your Firebase config — typically loaded from environment
  projectId: process.env.FIREBASE_PROJECT_ID ?? 'dawinos',
};

try {
  initializeApp(firebaseConfig);
} catch {
  // Already initialized
}

export async function migrateFormulas(): Promise<void> {
  console.log('=== MatFlow Formula Library Migration ===\n');

  // Read the JSON library file
  const jsonPath = path.resolve(__dirname, 'formulas.json');
  console.log(`Reading formulas from: ${jsonPath}`);

  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const parsed = JSON.parse(jsonContent);
  console.log(`Found ${parsed.formulas.length} formulas to import\n`);

  // Import with merge mode (safe — won't delete existing data)
  console.log('Importing with mode: merge (create new, update existing)...\n');
  const result = await importFromJSON(jsonContent, 'merge', 'migration_v2');

  // Report results
  console.log('=== Migration Results ===');
  console.log(`  Created:  ${result.created}`);
  console.log(`  Updated:  ${result.updated}`);
  console.log(`  Skipped:  ${result.skipped}`);
  console.log(`  Errors:   ${result.errors.length}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach((e) => console.log(`  ${e.code}: ${e.error}`));
  }

  console.log('\n=== Migration Complete ===');
  console.log(
    '\nThe formula library is now live in Firestore at: matflow/data/formulaLibrary/formulas'
  );
  console.log(
    'You can now update formulas directly in Firestore, via the admin API, or by re-importing formulas.json.'
  );
}

// Run if executed directly
if (require.main === module) {
  migrateFormulas()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
