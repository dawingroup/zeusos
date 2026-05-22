/**
 * Seed Zeus core-team invites
 *
 * Writes one document per founding team member into
 * `organizations/default/invites/{auto-id}` so that when each person signs in
 * with Google for the first time, the existing `processNewUserInvite` Cloud
 * Function (functions/index.js → invites router) can match by email and
 * provision a `DawinUser` doc with the right globalRole + sub-brand access.
 *
 * Roles mapped from the Zeus profile (pages: founder + team bios) and the
 * agency module-roles registry in src/core/settings/moduleRoles.ts:
 *
 *   - Jeffrey Amani (Founder/ECD)         → owner, all sub-brands, ECD on Campaigns
 *   - Gathoni Kuria (Country Mgr, Kenya)   → admin, House of Zeus primary, strategy_director
 *   - Andrew Radier (ACD/Copy Lead)        → manager, Zeus The Agency, associate_creative_director + copywriter
 *   - Rita Arinaitwe (Digital Director)    → manager, Zeus Digital, digital_director
 *   - Moses Wadda (Account Director)       → manager, Zeus The Agency, account_director
 *   - Hannat Semanda (Account Director)    → manager, Zeus The Agency, account_director
 *   - Moses Mbona (Studio/Art Director)    → manager, Labyrinth, studio_director + art_director
 *   - Violet Nakiggwe (Head of PR)         → manager, Zeus The Agency, head_of_pr
 *   - Hilda Kakate (Head of Media)         → manager, Zeus The Agency, head_of_media
 *
 * Email addresses are placeholders (`firstname.lastname@zeustheagency.com`)
 * — overwrite the real ones once they are confirmed by Zeus, then re-run
 * with --force.
 *
 * Run:
 *   gcloud auth application-default login   # if not already
 *   unset GOOGLE_APPLICATION_CREDENTIALS
 *   node scripts/seed-zeus-team-invites.cjs --dry-run
 *   node scripts/seed-zeus-team-invites.cjs
 *   node scripts/seed-zeus-team-invites.cjs --force        # overwrite existing
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'zeusos' });
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

// ─── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');

if (DRY_RUN) console.log('\n  DRY RUN — no documents will be written\n');
if (FORCE) console.log('  FORCE — will rewrite existing invites for the same emails\n');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALL_SUB_BRANDS = ['zeus-the-agency', 'zeus-digital', 'labyrinth', 'odd-gorilla', 'house-of-zeus'];

const ALL_MODULES_FOR_AGENCY = [
  'campaigns', 'media', 'production', 'talent', 'asset-library', 'asset-registry', 'advisory',
];

function fullAccess(subsidiaryId, moduleRoles = {}) {
  return {
    subsidiaryId,
    hasAccess: true,
    modules: ALL_MODULES_FOR_AGENCY.map((moduleId) => ({
      moduleId,
      hasAccess: true,
      role: moduleRoles[moduleId] || undefined,
    })),
  };
}

const now = new Date();
const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

const INVITED_BY = 'system-seed';
const INVITED_BY_NAME = 'ZeusOS Seed (Phase 2.E)';

// ─── Team Roster ─────────────────────────────────────────────────────────────

const TEAM = [
  {
    email: 'jeffrey.amani@zeustheagency.com',
    displayName: 'Jeffrey Amani',
    jobTitle: 'Founder & Executive Creative Director',
    globalRole: 'owner',
    subsidiaryAccess: ALL_SUB_BRANDS.map((id) =>
      fullAccess(id, { campaigns: id === 'zeus-the-agency' ? 'executive_creative_director' : 'account_director' })
    ),
  },
  {
    email: 'gathoni.kuria@zeustheagency.com',
    displayName: 'Gathoni Kuria',
    jobTitle: 'Country Manager (Kenya) & Head of Strategy',
    globalRole: 'admin',
    subsidiaryAccess: [
      fullAccess('house-of-zeus', { campaigns: 'strategy_director', strategy: 'strategy_owner' }),
      fullAccess('zeus-the-agency', { campaigns: 'strategy_director' }),
    ],
  },
  {
    email: 'andrew.radier@zeustheagency.com',
    displayName: 'Andrew Radier',
    jobTitle: 'Associate Creative Director / Copy Lead',
    globalRole: 'manager',
    subsidiaryAccess: [
      fullAccess('zeus-the-agency', { campaigns: 'associate_creative_director' }),
      fullAccess('zeus-digital', { campaigns: 'associate_creative_director' }),
    ],
  },
  {
    email: 'rita.arinaitwe@zeustheagency.com',
    displayName: 'Rita Arinaitwe',
    jobTitle: 'Digital Director',
    globalRole: 'manager',
    subsidiaryAccess: [
      fullAccess('zeus-digital', { campaigns: 'strategy_director', media: 'paid_media_specialist' }),
    ],
  },
  {
    email: 'moses.wadda@zeustheagency.com',
    displayName: 'Moses Wadda',
    jobTitle: 'Account Director',
    globalRole: 'manager',
    subsidiaryAccess: [
      fullAccess('zeus-the-agency', { campaigns: 'account_director' }),
    ],
  },
  {
    email: 'hannat.semanda@zeustheagency.com',
    displayName: 'Hannat Semanda',
    jobTitle: 'Account Director',
    globalRole: 'manager',
    subsidiaryAccess: [
      fullAccess('zeus-the-agency', { campaigns: 'account_director' }),
    ],
  },
  {
    email: 'moses.mbona@zeustheagency.com',
    displayName: 'Moses Mbona',
    jobTitle: 'Studio Director / Art Director',
    globalRole: 'manager',
    subsidiaryAccess: [
      fullAccess('labyrinth', { production: 'studio_director', campaigns: 'associate_creative_director' }),
      fullAccess('zeus-the-agency', { campaigns: 'art_director' }),
    ],
  },
  {
    email: 'violet.nakiggwe@zeustheagency.com',
    displayName: 'Violet Nakiggwe',
    jobTitle: 'Head of PR',
    globalRole: 'manager',
    subsidiaryAccess: [
      fullAccess('zeus-the-agency', { campaigns: 'account_manager' }),
    ],
  },
  {
    email: 'hilda.kakate@zeustheagency.com',
    displayName: 'Hilda Kakate',
    jobTitle: 'Head of Media',
    globalRole: 'manager',
    subsidiaryAccess: [
      fullAccess('zeus-the-agency', { campaigns: 'account_manager', media: 'head_of_media' }),
    ],
  },
];

// ─── Run ─────────────────────────────────────────────────────────────────────

async function main() {
  const invitesCol = db.collection('organizations').doc('default').collection('invites');

  // Pull existing invites once so the FORCE check is cheap.
  const existingSnap = await invitesCol.get();
  const byEmail = new Map();
  existingSnap.forEach((d) => {
    const data = d.data();
    if (data && data.email) byEmail.set(data.email.toLowerCase(), d.ref);
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const member of TEAM) {
    const emailKey = member.email.toLowerCase();
    const existing = byEmail.get(emailKey);

    if (existing && !FORCE) {
      skipped++;
      console.log(`  ⊘ skip   ${member.email.padEnd(40)} (invite exists; pass --force to overwrite)`);
      continue;
    }

    const payload = {
      email: member.email,
      displayName: member.displayName,
      jobTitle: member.jobTitle,
      globalRole: member.globalRole,
      subsidiaryAccess: member.subsidiaryAccess,
      invitedBy: INVITED_BY,
      invitedByName: INVITED_BY_NAME,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
    };

    if (DRY_RUN) {
      console.log(`  → would ${existing ? 'update' : 'create'} ${member.email}  (${member.globalRole}, ${member.subsidiaryAccess.length} sub-brand(s))`);
      continue;
    }

    if (existing) {
      await existing.set(payload);
      updated++;
      console.log(`  ↻ update ${member.email.padEnd(40)} ${member.globalRole}, ${member.subsidiaryAccess.length} sub-brand(s)`);
    } else {
      await invitesCol.add(payload);
      created++;
      console.log(`  ✓ create ${member.email.padEnd(40)} ${member.globalRole}, ${member.subsidiaryAccess.length} sub-brand(s)`);
    }
  }

  console.log('');
  console.log(`  Summary: ${created} created · ${updated} updated · ${skipped} skipped`);
  console.log('');
  console.log('  Each team member must sign in with Google using their work email');
  console.log('  to trigger processNewUserInvite. The placeholder addresses below');
  console.log('  should be replaced with the real ones once Zeus confirms them:');
  TEAM.forEach((m) => console.log(`    - ${m.email}`));
}

main().catch((err) => {
  console.error('\n  FATAL:', err);
  process.exit(1);
});
