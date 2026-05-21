/**
 * Seed Zeus Group Organization + 5 Subsidiaries
 *
 * Writes the foundational `organizations/default/settings/general` document
 * for ZeusOS, with Zeus Group org info and all five sub-brand subsidiaries
 * (Zeus The Agency, Zeus Digital, Labyrinth, Odd Gorilla, House of Zeus).
 *
 * This is the first thing that must exist before users can log in and
 * see a branded shell. Phase 2 bootstrap.
 *
 * Run with:
 *   node scripts/seed-zeus-organization.cjs
 *   node scripts/seed-zeus-organization.cjs --dry-run
 *   node scripts/seed-zeus-organization.cjs --force        # overwrite if exists
 *
 * Prerequisite — Application Default Credentials, either:
 *   1.  gcloud auth application-default login
 *   2.  export GOOGLE_APPLICATION_CREDENTIALS=/path/to/zeusos-sa-key.json
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'zeusos' });
const db = admin.firestore();

// ─── CLI flags ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

if (DRY_RUN) console.log('\n  DRY RUN — no documents will be written\n');
if (FORCE) console.log('  FORCE — will overwrite existing org settings\n');

// ─── Zeus Group palette (from the company profile) ───────────────────────────

const ZEUS_NAVY = '#0A1F4A';
const ZEUS_RED = '#E63946';
const ZEUS_NAVY_LIGHT = '#1A3870';
const ZEUS_NAVY_50 = '#EEF1F8';

const SUBSIDIARIES = {
  'zeus-group': {
    primaryColor: ZEUS_NAVY,
    secondaryColor: ZEUS_RED,
    accentColor: ZEUS_NAVY_LIGHT,
    tagline: '#TheZeusWay — Speed, Quality, Consistency',
    description:
      "East Africa's leading consortium of award-winning marketing agencies, " +
      'serving FMCG, finance, telecom, energy, and consumer brands across Uganda and Kenya.',
    website: 'https://zeustheagency.com',
    contact: {
      address: { country: 'Uganda', city: 'Kampala' },
    },
  },
  'zeus-the-agency': {
    primaryColor: '#F5D900',
    secondaryColor: ZEUS_NAVY,
    accentColor: '#000000',
    tagline: 'Award-winning integrated 360° advertising',
    description:
      'Flagship Ugandan agency. Creative, BTL, Digital, PR, Media Buying and Production strategies.',
    website: 'https://zeustheagency.com',
    contact: { address: { country: 'Uganda', city: 'Kampala' } },
  },
  'zeus-digital': {
    primaryColor: '#00C5E5',
    secondaryColor: ZEUS_NAVY,
    accentColor: '#0095B0',
    tagline: 'Digital-first. Insights-driven.',
    description:
      'Content, SEM/SEO, Influencer, Media Buy, Channel & Digital Innovation strategies. ' +
      'Full-service PR, Media Buy, Creative & Production also delivered.',
    website: 'https://zeustheagency.com',
    contact: { address: { country: 'Uganda', city: 'Kampala' } },
  },
  labyrinth: {
    primaryColor: '#C8F0D6',
    secondaryColor: '#2F9D5C',
    accentColor: ZEUS_NAVY,
    tagline: 'Audio & Visual Content Studio',
    description:
      'Sound production, photography, podcasts, product photography, film & documentary production.',
    website: 'https://labyrinthcontentstudio.com',
    contact: { address: { country: 'Uganda', city: 'Kampala' } },
  },
  'odd-gorilla': {
    primaryColor: '#FFB0B8',
    secondaryColor: '#E65B66',
    accentColor: ZEUS_NAVY,
    tagline: 'Conflict-of-interest advertising',
    description:
      'Fully integrated conflict agency that serves clients within categories where Zeus The Agency ' +
      'has competing accounts. Creative, BTL, Digital, PR, Media Buying, Production.',
    website: 'https://oddgorilla.com',
    contact: { address: { country: 'Uganda', city: 'Kampala' } },
  },
  'house-of-zeus': {
    primaryColor: '#C8FF3C',
    secondaryColor: '#6FA823',
    accentColor: ZEUS_NAVY,
    tagline: 'House of Zeus — Kenya',
    description:
      "Latest footprint expansion leading the charge in the Kenya market. " +
      '360° marketing & communications services.',
    website: 'https://zeustheagency.com',
    contact: { address: { country: 'Kenya', city: 'Nairobi' } },
  },
};

// ─── OrganizationSettings document ──────────────────────────────────────────

const now = new Date().toISOString();

const ORG_SETTINGS = {
  id: 'default',
  info: {
    name: 'Zeus Group',
    shortName: 'Zeus',
    legalName: 'Zeus The Agency Limited',
    website: 'https://zeustheagency.com',
    email: 'hello@zeustheagency.com',
    address: {
      street: '',
      city: 'Kampala',
      country: 'Uganda',
    },
  },
  branding: {
    groupPrimaryColor: ZEUS_NAVY,
    groupSecondaryColor: ZEUS_RED,
    platformDefaults: {
      theme: 'light',
      accent: 'boysenberry', // legacy token aliased to --zeus-navy in src/index.css
      density: 'balanced',
    },
    subsidiaries: SUBSIDIARIES,
  },
  defaultCurrency: 'UGX',
  defaultLanguage: 'en-UG',
  timezone: 'Africa/Kampala',
  fiscalYearStart: 1, // January — calendar year
  createdAt: now,
  updatedAt: now,
};

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  const ref = db.collection('organizations').doc('default').collection('settings').doc('general');

  const existing = await ref.get();
  if (existing.exists && !FORCE) {
    console.error('\n  ERROR: organizations/default/settings/general already exists.');
    console.error('  Re-run with --force to overwrite, or delete the doc manually first.\n');
    console.error('  Existing doc preview:');
    const data = existing.data();
    console.error(`    info.name: ${data?.info?.name ?? '<missing>'}`);
    console.error(`    branding.subsidiaries: ${Object.keys(data?.branding?.subsidiaries ?? {}).join(', ')}`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log('  Would write organizations/default/settings/general:');
    console.log(JSON.stringify(ORG_SETTINGS, null, 2));
    console.log('\n  Subsidiaries that would be created:');
    Object.keys(SUBSIDIARIES).forEach((id) => console.log(`    • ${id}`));
    return;
  }

  await ref.set(ORG_SETTINGS);
  console.log('  ✓ wrote organizations/default/settings/general');
  console.log(`  ✓ ${Object.keys(SUBSIDIARIES).length} subsidiaries seeded: ${Object.keys(SUBSIDIARIES).join(', ')}`);
  console.log('\n  Next step: open the preview, sign in with Google, and verify the AppShell loads with Zeus branding.\n');
}

main().catch((err) => {
  console.error('\n  FATAL:', err);
  process.exit(1);
});
