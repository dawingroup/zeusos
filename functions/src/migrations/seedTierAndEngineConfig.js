/**
 * Seed Tier-SLA Policy + Engine Config — Phase 6.A.2.
 *
 * One-time callable. Idempotent (uses set+merge=false; safe to re-run
 * because the docs are config, not user-mutable state).
 *
 * Populates:
 *   tier_sla_policy/TIER_1
 *   tier_sla_policy/TIER_2
 *   tier_sla_policy/TIER_3
 *   engine_config/global
 *
 * Source of truth: Addendum v1.1 §5 (Tier System) + v1.2 §2.4 (engine
 * config defaults — Uganda/Kenya operations).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const TIER_POLICIES = [
  {
    tier: 'TIER_1',
    minLeadDays: 14,
    feedbackDays: 5,
    briefingMode: 'MEETING',
    label: 'Creative strategy — all channels',
  },
  {
    tier: 'TIER_2',
    minLeadDays: 7,
    feedbackDays: 2,
    briefingMode: 'CALL',
    label: 'Tactical brief — a few channels',
  },
  {
    tier: 'TIER_3',
    minLeadDays: 2,
    feedbackDays: 1,
    briefingMode: 'EMAIL',
    label: 'Small job — quick-turn',
  },
];

const ENGINE_CONFIG_DEFAULTS = {
  id: 'global',
  workingHours: {
    timezone: 'Africa/Kampala',
    startTime: '08:00',
    endTime: '17:00',
    workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  },
  // SLA hours by tier × priority. Critical TIER_1 still has more
  // runway than critical TIER_3 — that's the whole point of tiering.
  slaHoursByTier: {
    TIER_1: { critical: 24, high: 48, medium: 96, low: 168 },
    TIER_2: { critical: 8, high: 24, medium: 48, low: 96 },
    TIER_3: { critical: 4, high: 8, medium: 24, low: 72 },
  },
  defaultMaxConcurrentTasks: 5,
  overdueEscalation: {
    critical: 1,
    high: 4,
    medium: 12,
    low: 24,
  },
  reminderCadence: {
    firstReminderHoursBefore: 24,
    secondReminderHoursBefore: 4,
    finalReminderHoursBefore: 1,
  },
};

async function runSeed() {
  const writer = db.batch();

  for (const policy of TIER_POLICIES) {
    writer.set(db.doc(`tier_sla_policy/${policy.tier}`), {
      ...policy,
      updatedBy: 'migration:seedTierAndEngineConfig',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  writer.set(db.doc('engine_config/global'), {
    ...ENGINE_CONFIG_DEFAULTS,
    updatedBy: 'migration:seedTierAndEngineConfig',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await writer.commit();

  return {
    success: true,
    tierPoliciesWritten: TIER_POLICIES.length,
    engineConfigWritten: true,
  };
}

exports.seedTierAndEngineConfig = onCall(
  { cors: ALLOWED_ORIGINS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign-in required.');
    }
    // Admin-only — config docs.
    const callerToken = request.auth.token || {};
    if (!callerToken.admin && !callerToken.superAdmin) {
      throw new HttpsError('permission-denied', 'Admin role required.');
    }

    try {
      return await runSeed();
    } catch (err) {
      throw new HttpsError('internal', `Seed failed: ${err.message}`);
    }
  }
);

// Pure runner exported for unit tests.
exports.runSeed = runSeed;
exports.TIER_POLICIES = TIER_POLICIES;
exports.ENGINE_CONFIG_DEFAULTS = ENGINE_CONFIG_DEFAULTS;
