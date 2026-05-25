/**
 * Seed EventDefinitions — Phase 6.E.
 *
 * Three definitions, one per recent event family, proving the
 * engine fans out correctly:
 *
 *   ed_approval_advanced_next_rung
 *     → ApprovalRungAdvanced events spawn a "review at next rung"
 *       task for whoever holds that rung (resolution deferred to
 *       6.E.2 — assignTo: { kind: 'unassigned' } for now, so the
 *       task floats in the pool until a CD/ECD claims it).
 *
 *   ed_conflict_exclusivity_breach
 *     → ConflictExclusivityRisk events spawn a P1 task to the
 *       Account Director for the masterJob's account. Resolution
 *       lands in 6.E.2 (currently unassigned). Includes the
 *       walledClientIds[] in the description so the AD sees who
 *       the competitor is.
 *
 *   ed_iwo_issued_acceptance
 *     → IWOIssued events spawn an "Accept this IWO" task to the
 *       receiving subsidiary's delivery lead. We don't know who
 *       that is from the event alone (deferred to 6.E.2 via
 *       role-based resolver), so for 6.E.1 the task is brand-tagged
 *       and unassigned — the subsidiary's delivery team claims it
 *       from their inbox.
 *
 * Run via `seedEventDefinitions(db)` from an admin context (one-off
 * Cloud Functions shell or a migration script). Idempotent — uses
 * fixed IDs and set with `{ merge: true }`.
 */

const SEED_DEFINITIONS = [
  {
    id: 'ed_approval_advanced_next_rung',
    eventType: 'ApprovalRungAdvanced',
    description:
      'When a creative deliverable advances up the ECD ladder, ' +
      'spawn a "review at next rung" task for whoever holds the ' +
      'new rung. (Tier-aware ladder depth, see Addendum v1.1 §7.)',
    applicableSubsidiaries: ['all'],
    tasks: [
      {
        id: 'review_at_next_rung',
        titleTpl: 'Review IWO {{aggregateId}} at rung {{payload.toRung}}',
        descriptionTpl:
          'IWO {{aggregateId}} just advanced from {{payload.fromRung}} to {{payload.toRung}}. ' +
          'Review the deliverable and either advance to the next rung or reject ' +
          'with structured notes (sends the work back to ladder[0]).',
        priority: 'P2',
        dueInDays: 2,
        assignTo: { kind: 'unassigned' },
        tagsTpl: {
          iwoId: '{{aggregateId}}',
          masterJobId: '{{payload.masterJobId}}',
        },
      },
    ],
    isActive: true,
  },

  {
    id: 'ed_conflict_exclusivity_breach',
    eventType: 'ConflictExclusivityRisk',
    description:
      'When the conflict firewall excludes 1+ brand from a routing ' +
      'decision, escalate to Account Mgmt for review. (Conflict ' +
      'Sentinel ZA-004 will consume the same event in Phase 6.F.)',
    applicableSubsidiaries: ['all'],
    tasks: [
      {
        id: 'review_firewall_breach',
        titleTpl: 'Review conflict-firewall breach risk on master job {{payload.masterJobId}}',
        descriptionTpl:
          'Category: {{payload.categoryId}}. ' +
          'Excluded brands: {{payload.excludedBrandIds}}. ' +
          'Walled clients in category: {{payload.walledClientIds}}. ' +
          'Decide: accept Traffic\'s routing alternative, OR negotiate ' +
          'an exclusivity carve-out with the existing client.',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { kind: 'unassigned' },
        tagsTpl: {
          masterJobId: '{{payload.masterJobId}}',
          category: '{{payload.categoryId}}',
        },
      },
    ],
    isActive: true,
  },

  {
    id: 'ed_iwo_issued_acceptance',
    eventType: 'IWOIssued',
    description:
      'When a new IWO is issued to a sibling brand, spawn an ' +
      '"Accept this IWO" task for the receiving brand\'s delivery ' +
      'team. Brand-tagged so the right subsidiary inbox sees it.',
    applicableSubsidiaries: ['all'],
    tasks: [
      {
        id: 'accept_iwo',
        titleTpl: 'Accept IWO {{aggregateId}} ({{payload.requiredCapability}})',
        descriptionTpl:
          'A new internal work order has been issued to your brand. ' +
          'Review the handoff packet (brief + milestones + acceptance ' +
          'criteria) and either accept or reject. Tier {{payload.tier}}; ' +
          'SLA clock starts on accept.',
        priority: 'P1',
        dueInDays: 1,
        assignTo: { kind: 'unassigned' },
        tagsTpl: {
          iwoId: '{{aggregateId}}',
          brandId: '{{payload.subsidiaryOrgId}}',
          masterJobId: '{{payload.masterJobId}}',
        },
      },
    ],
    isActive: true,
  },
];

/**
 * Seed the 3 starter EventDefinitions. Idempotent — re-runs leave
 * the docs at their latest spec. Audit fields are merged via
 * { merge: true } so an admin's later updatedBy isn't clobbered.
 */
async function seedEventDefinitions(db) {
  const nowIso = new Date().toISOString();
  const ids = [];
  for (const def of SEED_DEFINITIONS) {
    const ref = db.collection('event_definitions').doc(def.id);
    const existing = await ref.get();
    const baseAudit = existing.exists
      ? {
          // Preserve original createdBy/createdAt; bump updated.
          updatedBy: 'system-seed',
          updatedAt: nowIso,
        }
      : {
          createdBy: 'system-seed',
          createdAt: nowIso,
          updatedBy: 'system-seed',
          updatedAt: nowIso,
        };
    await ref.set({ ...def, ...baseAudit }, { merge: true });
    ids.push(def.id);
  }
  return ids;
}

module.exports = {
  SEED_DEFINITIONS,
  seedEventDefinitions,
};
