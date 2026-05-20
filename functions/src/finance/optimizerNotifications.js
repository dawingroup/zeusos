/**
 * Cloud Function - Optimizer Notifications (Gen 2)
 *
 * Monitors for:
 * - Crisis mode activation (mandatory spend > cash)
 * - Statutory liability deadlines approaching
 * - Receipt confidence drops
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ────────────────────────────────────────────────────────────────────────────
// CRISIS MODE ALERT
// ────────────────────────────────────────────────────────────────────────────

exports.crisisAlertOnSpendPlan = onDocumentCreated(
  {
    document: 'companies/{companyId}/spend_plans/{planId}',
    timeoutSeconds: 30,
    memory: '128MiB',
  },
  async (event) => {
    const { companyId, planId } = event.params;
    const plan = event.data?.data();

    if (!plan) return;

    const hasCrisis = plan.riskFlags?.some(f => f.severity === 'critical');
    if (!hasCrisis) return;

    logger.warn(`[OptimizerNotify] CRISIS MODE detected for company ${companyId} (plan ${planId})`);

    // Store notification in Firestore for the UI to pick up
    await db.collection('companies').doc(companyId).collection('notifications').add({
      type: 'optimizer_crisis',
      title: 'Cash Flow Crisis Alert',
      message: `Mandatory expenditures exceed available cash. Total outflow: UGX ${(plan.totalOutflow || 0).toLocaleString()}.`,
      severity: 'critical',
      module: 'finance-optimizer',
      data: {
        planId,
        date: plan.date,
        totalOutflow: plan.totalOutflow,
        openingBalance: plan.openingBankBalance,
        shortfall: (plan.totalOutflow || 0) - (plan.openingBankBalance || 0),
      },
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

// ────────────────────────────────────────────────────────────────────────────
// STATUTORY DEADLINE REMINDER
// ────────────────────────────────────────────────────────────────────────────

exports.statutoryDeadlineReminder = onSchedule(
  {
    schedule: '0 8 * * *', // 8 AM daily
    timeZone: 'Africa/Nairobi',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    logger.info('[OptimizerNotify] Checking statutory deadlines...');

    const deadlines = [
      { type: 'tax_paye', label: 'PAYE', day: 15, penalty: '2%' },
      { type: 'nssf', label: 'NSSF', day: 15, penalty: '5%' },
      { type: 'tax_vat', label: 'VAT', day: 15, penalty: '2%' },
    ];

    const today = new Date();
    const dayOfMonth = today.getDate();

    const upcomingDeadlines = deadlines.filter(d => {
      const daysUntil = d.day - dayOfMonth;
      return daysUntil >= 0 && daysUntil <= 5; // 5-day warning
    });

    if (upcomingDeadlines.length === 0) {
      logger.info('[OptimizerNotify] No upcoming statutory deadlines');
      return;
    }

    const companiesSnap = await db.collection('companies').get();

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;

      for (const deadline of upcomingDeadlines) {
        const daysUntil = deadline.day - dayOfMonth;

        // Check if already notified today
        const existingSnap = await db.collection('companies').doc(companyId)
          .collection('notifications')
          .where('type', '==', 'statutory_deadline')
          .where('data.deadlineType', '==', deadline.type)
          .where('data.deadlineDay', '==', deadline.day)
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();

        if (!existingSnap.empty) {
          const lastNotif = existingSnap.docs[0].data();
          const lastDate = lastNotif.createdAt?.toDate?.();
          if (lastDate && lastDate.toDateString() === today.toDateString()) {
            continue; // Already notified today
          }
        }

        await db.collection('companies').doc(companyId).collection('notifications').add({
          type: 'statutory_deadline',
          title: `${deadline.label} Due ${daysUntil === 0 ? 'Today' : `in ${daysUntil} Days`}`,
          message: `${deadline.label} remittance is due on the ${deadline.day}th. Late penalty: ${deadline.penalty}/month.`,
          severity: daysUntil <= 2 ? 'critical' : 'warning',
          module: 'finance-optimizer',
          data: {
            deadlineType: deadline.type,
            deadlineDay: deadline.day,
            daysUntil,
            penaltyRate: deadline.penalty,
          },
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    logger.info(`[OptimizerNotify] Sent ${upcomingDeadlines.length} deadline reminders`);
  }
);
