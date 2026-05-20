/**
 * Shopify Project Enquiry Webhook Handler
 *
 * Receives a project enquiry from the dawinfinishes.com /pages/start-project
 * contact form (delivered via Shopify Flow → HTTP request) and creates a
 * CRMDeal at stage 'lead' in the finishes subsidiary.
 *
 * Authentication: shared secret in the `X-Dawin-Enquiry-Secret` header,
 * matched against systemConfig/shopifyConfig.enquirySecret.
 *
 * Dedup: by `enquiryId` (idempotency key supplied by Shopify Flow) when
 * present, otherwise by (email + 5-minute window).
 *
 * Payload contract — see docs/integrations/shopify-project-enquiry.md
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');

const CRM_DEALS_COLLECTION = 'crmDeals';
const CRM_ACTIVITIES_COLLECTION = 'crmActivities';
const SHOPIFY_CONFIG_DOC = 'systemConfig/shopifyConfig';
const ENQUIRY_DEDUP_WINDOW_MS = 5 * 60 * 1000;

function generateDealNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CRM-DEAL-${dateStr}-${rand}`;
}

function pickProbability(scope) {
  switch ((scope || '').toLowerCase()) {
    case 'full fit-out': return 35;
    case 'specific finishes only': return 30;
    case 'manufacturing only': return 25;
    case 'design consultation': return 20;
    default: return 20;
  }
}

function parseBudget(budgetBand) {
  if (!budgetBand) return 0;
  const matches = String(budgetBand).match(/(\d+)\s*M/gi);
  if (!matches) return 0;
  const nums = matches.map(m => parseInt(m, 10));
  if (nums.length === 1) return nums[0] * 1_000_000;
  return Math.round(((nums[0] + nums[1]) / 2) * 1_000_000);
}

function estimateCloseDate(timeline) {
  const now = new Date();
  const months = {
    'within 1 month': 1,
    '1-3 months': 2,
    '3-6 months': 4,
    '6+ months': 7,
    'flexible': 3,
  }[String(timeline || '').toLowerCase()] ?? 3;
  return new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
}

exports.shopifyProjectEnquiry = onRequest(
  { cors: ALLOWED_ORIGINS },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const db = getFirestore();

    try {
      const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
      const shopConfig = configDoc.exists ? configDoc.data() : {};

      if (shopConfig.enquirySecret) {
        const supplied = req.headers['x-dawin-enquiry-secret'];
        if (!supplied || supplied !== shopConfig.enquirySecret) {
          console.error('shopifyProjectEnquiry: invalid shared secret');
          res.status(401).send('Unauthorized');
          return;
        }
      }

      const body = req.body || {};
      if (!body.email && !body.phone) {
        res.status(400).json({ error: 'email or phone is required' });
        return;
      }

      const now = new Date();
      const enquiryId = body.enquiryId || body.enquiry_id || null;

      // Dedup
      let dedupQuery = db.collection(CRM_DEALS_COLLECTION).where('source', '==', 'website');
      if (enquiryId) {
        const existing = await dedupQuery.where('enquiryId', '==', enquiryId).limit(1).get();
        if (!existing.empty) {
          console.log(`shopifyProjectEnquiry: deal exists for enquiryId=${enquiryId} — skipping`);
          res.status(200).json({ status: 'duplicate', dealId: existing.docs[0].id });
          return;
        }
      } else if (body.email) {
        const since = new Date(now.getTime() - ENQUIRY_DEDUP_WINDOW_MS);
        const existing = await dedupQuery
          .where('customerEmail', '==', body.email)
          .where('createdAt', '>=', since)
          .limit(1)
          .get();
        if (!existing.empty) {
          console.log(`shopifyProjectEnquiry: recent deal exists for email=${body.email} — skipping`);
          res.status(200).json({ status: 'duplicate', dealId: existing.docs[0].id });
          return;
        }
      }

      const customerName = body.name || body.fullName || body.email || 'Website enquiry';
      const customerId = body.email ? `web_${body.email.toLowerCase()}` : `web_${Date.now()}`;
      const dealId = `deal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const referenceProject = body.referredProject || body.referred_project || body.inspiredBy || '';
      const tags = ['website-enquiry', 'project-form'];
      if (referenceProject) tags.push(`ref:${referenceProject.slice(0, 40)}`);
      if (body.projectType) tags.push(`type:${String(body.projectType).toLowerCase()}`);

      const noteLines = [
        `Project type: ${body.projectType || '—'}`,
        `Location: ${body.projectLocation || '—'}`,
        `Scope: ${body.scope || '—'}`,
        `Budget band: ${body.budget || '—'}`,
        `Timeline: ${body.timeline || '—'}`,
        `Inspired by: ${referenceProject || '—'}`,
        `Heard about us: ${body.hearAbout || '—'}`,
        body.message ? `\nMessage:\n${body.message}` : '',
      ];

      // Schema §4.9 — fuller intake payload. Storefront may post these fields
      // either at top-level or under a `payload` key.
      const p = body.payload || body;
      const utm = body.utm || {
        source: body.utm_source || body.utmSource,
        medium: body.utm_medium || body.utmMedium,
        campaign: body.utm_campaign || body.utmCampaign,
        term: body.utm_term || body.utmTerm,
        content: body.utm_content || body.utmContent,
        referrer: body.referrer,
        landingPage: body.landingPage,
      };

      const deal = {
        dealNumber: generateDealNumber(),
        title: `Website enquiry — ${body.projectType || p.type || 'Project'} (${customerName})`,
        description: `Project enquiry submitted via dawinfinishes.com/pages/start-project`,
        customerId,
        customerName,
        customerEmail: body.email || p.contact_email || '',
        customerPhone: body.phone || p.contact_phone || '',
        customerCompany: body.company || p.contact_company || '',
        party: { kind: 'finishes_customer', id: customerId },
        stage: 'lead',
        probability: pickProbability(body.scope || p.scope),
        priority: 'medium',
        source: 'website',
        estimatedValue: parseBudget(body.budget),
        currency: 'UGX',
        weightedValue: 0,
        linkedQuoteIds: [],
        linkedMOIds: [],
        ownerId: 'unassigned',
        ownerName: 'Unassigned',
        teamMemberIds: [],
        expectedCloseDate: estimateCloseDate(body.timeline),
        stageEnteredAt: now,
        siteLocation: body.projectLocation ? { address: body.projectLocation } : (p.location ? { address: p.location } : null),
        tags,
        notes: noteLines.filter(Boolean).join('\n'),
        subsidiaryId: 'finishes',
        enquiryId,
        enquirySource: body.sourcePage || '/pages/start-project',
        referencedProjectHandle: body.referencedProjectHandle || null,

        // Schema §4.9 — extended intake fields
        enquiryType: p.type || body.projectType || null,
        scopeList: Array.isArray(p.scope) ? p.scope : (typeof p.scope === 'string' ? [p.scope] : []),
        areaSqm: typeof p.area_sqm === 'number' ? p.area_sqm : null,
        budgetUgxMin: typeof p.budget_ugx_min === 'number' ? p.budget_ugx_min : null,
        budgetUgxMax: typeof p.budget_ugx_max === 'number' ? p.budget_ugx_max : null,
        deadlineText: p.deadline_text || null,
        briefText: p.brief_text || body.message || null,
        vibeTags: Array.isArray(p.vibe_tags) ? p.vibe_tags : [],
        finishesPickedHandles: Array.isArray(p.finishes_picked) ? p.finishes_picked : [],
        referencesText: p.references || null,
        referrerChannel: p.referrer || null,
        consentNda: Boolean(p.consent_nda),
        consentVisit: Boolean(p.consent_visit),
        consentPublish: Boolean(p.consent_publish),

        // Attribution
        utm,

        createdAt: now,
        createdBy: 'shopify-form',
        updatedAt: now,
        updatedBy: 'shopify-form',
      };

      await db.collection(CRM_DEALS_COLLECTION).doc(dealId).set(deal);

      const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await db.collection(CRM_ACTIVITIES_COLLECTION).doc(activityId).set({
        dealId,
        customerId,
        type: 'enquiry_received',
        title: `New website enquiry: ${body.projectType || 'Project'}`,
        description: deal.notes,
        source: 'auto_system',
        performedBy: 'shopify-form',
        performedByName: 'Website enquiry form',
        performedAt: now,
        createdAt: now,
      });

      console.log(`shopifyProjectEnquiry: created deal ${dealId} for ${customerName}`);
      res.status(201).json({ status: 'created', dealId });
    } catch (error) {
      console.error('shopifyProjectEnquiry error:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);
