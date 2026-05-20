/**
 * Material Pricing Scheduled Function
 *
 * Runs on the 1st of every month at 08:00 EAT.
 * Iterates all active materials in the library and fetches current market
 * prices via Gemini AI + Google Search grounding.
 *
 * Rate-limited to avoid hitting API quotas: one material every 8 seconds
 * (≈ 450 materials per hour, well within Cloud Function timeouts).
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const {
  _fetchMarketPrices,
  _savePriceToMaterial,
} = require('../ai/materialPricingAI');

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// How long to wait between pricing each material (ms) to avoid rate limits
const DELAY_MS = 8_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Monthly material price refresh.
 * Scheduled: 1st of every month at 08:00 Africa/Nairobi.
 */
exports.monthlyMaterialPricing = onSchedule(
  {
    schedule: '0 8 1 * *',
    timeZone: 'Africa/Nairobi',
    timeoutSeconds: 540, // 9 minutes — Cloud Functions max
    memory: '512MiB',
    secrets: [GEMINI_API_KEY],
  },
  async (_event) => {
    logger.info('[materialPricing] Monthly material pricing run starting...');

    const apiKey = GEMINI_API_KEY.value();
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const oneMonthAgoTs = admin.firestore.Timestamp.fromDate(oneMonthAgo);

    // advisoryPlatform/matflow/materials is a subcollection under the document
    // advisoryPlatform/matflow — use collectionGroup or direct path via doc+collection
    const materialsSnap = await db
      .doc('advisoryPlatform/matflow')
      .collection('materials')
      .where('isActive', '==', true)
      .get();

    const materials = materialsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    logger.info(`[materialPricing] Found ${materials.length} active materials to price`);

    const results = { priced: 0, skipped: 0, errors: 0 };

    for (const material of materials) {
      // Skip if priced within the last month (avoid double-running on redeploy)
      if (material.lastMarketPricedAt) {
        const lastPriced = material.lastMarketPricedAt.toDate
          ? material.lastMarketPricedAt.toDate()
          : new Date(material.lastMarketPricedAt._seconds * 1000);
        if (lastPriced > oneMonthAgo) {
          results.skipped++;
          continue;
        }
      }

      try {
        logger.info(`[materialPricing] Pricing "${material.name}" (${material.baseUnit})`);

        const { averagePrice, prices, sources, notes, currency } =
          await _fetchMarketPrices(
            material.name,
            material.baseUnit,
            material.category || 'other',
            apiKey,
          );

        await _savePriceToMaterial(
          material.id,
          averagePrice,
          currency,
          notes,
          prices,
          sources,
          'system-scheduler',
        );

        results.priced++;
        logger.info(
          `[materialPricing] "${material.name}" → ${averagePrice.toLocaleString()} ${currency}`,
        );
      } catch (err) {
        results.errors++;
        logger.error(`[materialPricing] Error pricing "${material.name}":`, err.message);
      }

      // Rate-limit: wait between materials
      await sleep(DELAY_MS);
    }

    logger.info(
      `[materialPricing] Complete — priced: ${results.priced}, skipped: ${results.skipped}, errors: ${results.errors}`,
    );

    // Write a run summary to Firestore for audit
    await db.doc('advisoryPlatform/matflow').collection('pricingRuns').add({
      runAt: admin.firestore.Timestamp.now(),
      totalMaterials: materials.length,
      priced: results.priced,
      skipped: results.skipped,
      errors: results.errors,
    });
  },
);
