/**
 * `onCompetitorDeleted` — the server half of D-3
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md): when an admin
 * hard-deletes `competitors/{id}`, every child row keyed on it goes too and
 * every reference array drops the id. The client never hard-deletes — it
 * archives — so this fires only for admin tooling and the rules' `isAdmin()`
 * delete path.
 */
'use strict';

const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { runCompetitorCascade } = require('../lib/competitorCascade');

const onCompetitorDeleted = onDocumentDeleted(
  { document: 'competitors/{competitorId}', region: 'europe-west1' },
  async (event) => {
    const competitorId = event.params.competitorId;
    const name = (event.data && event.data.data() && event.data.data().name) || competitorId;
    try {
      const result = await runCompetitorCascade(getFirestore(), competitorId);
      logger.info(`[competitorCascade] ${name}: deleted ${result.deleted}, detached ${result.detached}`, result);
    } catch (err) {
      // Never leave the delete half-done silently: the integrity audit
      // (scripts/audit-market-intel-integrity.cjs) counts the orphans.
      logger.error(`[competitorCascade] failed for ${competitorId}: ${err.message}`, { competitorId });
      throw err;
    }
  },
);

module.exports = { onCompetitorDeleted };
