/**
 * WhatsApp Template Manager
 * Cloud Functions for creating, managing, and submitting templates to Meta
 * Includes pre-built template definitions for common business use cases
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const {
  META_WHATSAPP_ACCESS_TOKEN,
  META_WHATSAPP_BUSINESS_ACCOUNT_ID,
  createTemplate,
  deleteTemplate,
  getTemplates,
  uploadMediaForTemplate,
  uploadBufferToMeta,
  generateMinimalPdf,
} = require('./metaCloudApiClient');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ============================================
// Pre-built Template Definitions
// ============================================

const PREDEFINED_TEMPLATES = {
  quote_submission: {
    name: 'quote_submission',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        // Example image is injected at submission time from org branding or whatsappConfig
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nHere is your quote from *Dawin Finishes*.\n\n*{{2}}*\nQuote #: {{3}}\nProject: {{4}}\nAmount: *{{5}}*\n\nView full details: {{6}}\n\nPlease review and tap a button below to respond.',
        example: {
          body_text: [
            [
              'John',
              'Living Room Interior Finishes',
              'QT-2024-001',
              'Villa Kololo',
              'UGX 45,000,000',
              'https://portal.dawin.group/quotes/abc123',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'Approve',
          },
          {
            type: 'QUICK_REPLY',
            text: 'Reject',
          },
        ],
      },
    ],
  },

  order_status_update: {
    name: 'order_status_update',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Order Update',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nYour order *{{2}}* has been updated.\n\nStatus: *{{3}}*\n{{4}}\n\nFor any questions, reply to this message.',
        example: {
          body_text: [
            [
              'John',
              'ORD-2024-001',
              'Shipped',
              'Expected delivery: Monday, Feb 24',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  quote_document: {
    name: 'quote_document',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
        // Document is attached at send time via header component parameter
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nPlease find attached the detailed quote for *{{2}}*.\n\nQuote #: {{3}}\nAmount: *{{4}}*\n\nReview the PDF for a full breakdown of items and pricing.',
        example: {
          body_text: [
            [
              'John',
              'Living Room Interior Finishes',
              'QT-2024-001',
              'UGX 45,000,000',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  order_confirmation: {
    name: 'order_confirmation',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        // Branded header image injected at send time from org branding
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nYour order has been confirmed! 🎉\n\n*Order:* {{2}}\n*Total:* {{3}}\n\n*Payment Schedule:*\n{{4}}\n{{5}}\n\nWe will begin processing your order shortly. For any questions, reply to this message.',
        example: {
          body_text: [
            [
              'John',
              'SO-2024-001',
              'UGX 45,000,000',
              '50% Deposit: UGX 22,500,000',
              '30% Second Payment: UGX 13,500,000\n20% Final Payment: UGX 9,000,000',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  deposit_payment_request: {
    name: 'deposit_payment_request',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        // Branded header image injected at submission time from org branding
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nThank you for confirming your order *{{2}}*.\n\nTo proceed, kindly make the deposit payment of *{{3}}* ({{4}} of {{5}}).\n\n*Payment Options:*\n🏦 *Bank Transfer*\nABSA Bank\nA/C Name: DAWIN FINISHES SMC LIMITED\nA/C No: 6006867063\n\n📱 *MTN Mobile Money*\nMerchant: DAWIN FINISHES SMC LTD\nCode: 595946\n\n💳 *POS / Online*\nVISA, MasterCard, Mobile Money via Pesapal\n\nPlease share payment confirmation once done. For any questions, reply to this message.',
        example: {
          body_text: [
            [
              'John',
              'SO-2024-001',
              'UGX 22,500,000',
              '50%',
              'UGX 45,000,000',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'QUICK_REPLY',
            text: 'Payment Sent',
          },
          {
            type: 'QUICK_REPLY',
            text: 'Need Help',
          },
        ],
      },
    ],
  },

  payment_receipt: {
    name: 'payment_receipt',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
        // PDF receipt document is attached at send time
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nThank you for your payment! Here is your official receipt.\n\n*Order:* {{2}}\n*Amount Paid:* {{3}}\n*Date:* {{4}}\n*Method:* {{5}}\n\nPlease find the detailed receipt attached as a PDF.\n\nFor any questions, reply to this message.',
        example: {
          body_text: [
            [
              'John',
              'SO-2024-001',
              'UGX 22,500,000',
              '2024-03-15',
              'Bank Transfer (ABSA)',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  document_share: {
    name: 'document_share',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
        // PDF document is attached at send time
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nPlease find attached: *{{2}}*\n\n{{3}}\n\nIf you have any questions, reply to this message.',
        example: {
          body_text: [
            [
              'John',
              'Project Proposal',
              'This document contains the details discussed.',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  receipt_document: {
    name: 'receipt_document',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
        // PDF receipt document is attached at send time
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nPlease find your official receipt attached.\n\n*Order:* {{2}}\n*Amount:* {{3}}\n*Date:* {{4}}\n\nThank you for your business. For any questions, reply to this message.',
        example: {
          body_text: [
            [
              'John',
              'SO-2024-001',
              'UGX 22,500,000',
              '2024-03-15',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  change_order_submission: {
    name: 'change_order_submission',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'IMAGE',
        // Branded image header injected from whatsappConfig/templateHeaderImages
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nA change order is ready for your review.\n\n*Change Order:* {{2}}\n*Title:* {{3}}\n*Project Order:* {{4}}\n*Impact:* {{5}} {{6}}\n*New Order Total:* {{7}}\n\nPlease review and approve here:\n{{8}}\n\nIf anything needs clarification, reply to this message.',
        example: {
          body_text: [
            [
              'John',
              'CO-SO-2024-001-002',
              'Kitchen scope revision',
              'SO-2024-001',
              'UGX 3,500,000',
              'increase',
              'UGX 48,500,000',
              'https://portal.dawin.group/client-portal/token/change-order/co123?src=whatsapp',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  change_order_document: {
    name: 'change_order_document',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
        // PDF is attached at send time
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nPlease find the change-order PDF attached.\n\n*Change Order:* {{2}}\n*Title:* {{3}}\n*Net Impact:* {{4}}\n\nYou can approve using the link sent in the previous message.',
        example: {
          body_text: [
            [
              'John',
              'CO-SO-2024-001-002',
              'Kitchen scope revision',
              '+UGX 3,500,000',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  meeting_minutes: {
    name: 'meeting_minutes',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'DOCUMENT',
        // Branded minutes PDF is attached at send time
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nPlease find attached the minutes from our recent engagement.\n\n*Subject:* {{2}}\n*Date:* {{3}}\n*Project:* {{4}}\n\n{{5}}\n\nThe full branded minutes are attached as a PDF. Kindly review and reply with any amendments or confirmations.',
        example: {
          body_text: [
            [
              'John',
              'Kickoff Meeting — Kitchen Remodel',
              '15 March 2026',
              'DP-2026-014 · Nakasero Residence',
              '3 action items captured. Next follow-up on 22 March 2026.',
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },

  welcome_message: {
    name: 'welcome_message',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'BODY',
        text: 'Hello {{1}}! Welcome to *Dawin Finishes*. We specialize in premium interior and exterior finishes.\n\nHow can we help you today? Feel free to send us a message anytime.',
        example: {
          body_text: [['John']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Dawin Finishes',
      },
    ],
  },
};

/**
 * Get a template header image URL from whatsappConfig or org branding.
 * @param {string} [imageKey] - Specific key in templateHeaderImages (e.g. 'depositRequest', 'orderConfirmation').
 *                               Falls back to 'quoteSubmission' then 'default'.
 */
async function getTemplateHeaderImageUrl(imageKey) {
  // 1. Check whatsappConfig for template header images
  const waConfig = await db.collection('systemConfig').doc('whatsappConfig').get();
  if (waConfig.exists) {
    const images = waConfig.data()?.templateHeaderImages;
    const url = (imageKey && images?.[imageKey]) || images?.quoteSubmission || images?.default;
    if (url) return url;
  }

  // 2. Fall back to org branding logo
  const settingsDoc = await db
    .collection('organizations/default/settings')
    .doc('general')
    .get();
  if (settingsDoc.exists) {
    const branding = settingsDoc.data()?.branding?.subsidiaries?.['dawin-finishes'];
    if (branding?.logoUrl) return branding.logoUrl;
    // Try parent org
    const groupBranding = settingsDoc.data()?.branding?.subsidiaries?.['dawin-group'];
    if (groupBranding?.logoUrl) return groupBranding.logoUrl;
  }

  return null;
}

// Backward-compatible alias
const getQuoteHeaderImageUrl = () => getTemplateHeaderImageUrl('quoteSubmission');

// ============================================
// Cloud Functions
// ============================================

/**
 * Create a WhatsApp template in Meta Business Manager
 * Can use a predefined template or custom components
 */
const createWhatsAppTemplate = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
    secrets: [META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_BUSINESS_ACCOUNT_ID],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { predefinedTemplate, templateName, name, category, language, components } = request.data;
    const normalizedPredefined = String(
      predefinedTemplate ||
      templateName ||
      // Backward-compatible fallback: if only `name` is supplied and it
      // matches a predefined template key, treat it as predefined.
      ((name && !category && !components) ? name : '')
    ).trim();

    let templateDef;

    if (normalizedPredefined && PREDEFINED_TEMPLATES[normalizedPredefined]) {
      // Use a predefined template
      templateDef = PREDEFINED_TEMPLATES[normalizedPredefined];
      logger.info('Using predefined template', { predefinedTemplate: normalizedPredefined });
    } else if (name && category && components) {
      // Custom template
      templateDef = { name, category, language: language || 'en', components };
      logger.info('Using custom template', { name, category });
    } else {
      throw new HttpsError(
        'invalid-argument',
        'Provide either predefinedTemplate name or custom name + category + components'
      );
    }

    // Helper to store template in Firestore
    async function storeInFirestore(templateName, templateCategory, templateLanguage, components, metaResult) {
      const safeComponents = components.map(({ example, ...rest }) => rest);
      const templateRef = db.collection('whatsappTemplates').doc(templateName);
      await templateRef.set(
        {
          name: templateName,
          category: templateCategory.toLowerCase(),
          language: templateLanguage,
          status: metaResult.status || 'pending',
          metaTemplateId: metaResult.id || null,
          components: safeComponents,
          bodyText: extractBodyText(components),
          headerType: extractHeaderType(components),
          headerText: extractHeaderText(components),
          footerText: extractFooterText(components),
          buttons: extractButtons(components),
          parameterCount: countParameters(components),
          provider: 'meta',
          createdBy: request.auth.uid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    try {
      // ── Step 1: Resolve desired header format ──
      const desiredHeader = templateDef.components.find((c) => c.type === 'HEADER');
      const desiredFormat = desiredHeader?.format?.toUpperCase() || null; // 'IMAGE', 'DOCUMENT', or 'TEXT'

      // For IMAGE headers, check if an image URL is available
      // Map template name to the appropriate image slot key
      const IMAGE_KEY_MAP = {
        quote_submission: 'quoteSubmission',
        order_confirmation: 'orderConfirmation',
        deposit_payment_request: 'depositRequest',
        change_order_submission: 'changeOrderSubmission',
      };
      const TEXT_FALLBACK_MAP = {
        quote_submission: 'Your Quote from Dawin Finishes',
        order_confirmation: 'Order Confirmed — Dawin Finishes',
        deposit_payment_request: 'Deposit Payment Request — Dawin Finishes',
        change_order_submission: 'Change Order Update — Dawin Finishes',
      };
      let headerImageUrl = null;
      if (desiredFormat === 'IMAGE') {
        const imageKey = IMAGE_KEY_MAP[templateDef.name] || 'default';
        headerImageUrl = await getTemplateHeaderImageUrl(imageKey);
      }

      // ── Step 2: Check if this template already exists on Meta ──
      let existingOnMeta = null;
      try {
        const allTemplates = await getTemplates();
        existingOnMeta = allTemplates.find((t) => t.name === templateDef.name);
        // Also check for versioned names (e.g. quote_submission_v2)
        if (!existingOnMeta) {
          for (const suffix of ['_v2', '_v3']) {
            const versioned = allTemplates.find((t) => t.name === `${templateDef.name}${suffix}`);
            if (versioned) {
              existingOnMeta = versioned;
              break;
            }
          }
        }
      } catch (fetchErr) {
        logger.warn('Could not fetch templates from Meta (continuing with create):', {
          error: fetchErr.message,
        });
      }

      if (existingOnMeta) {
        // Check if the existing template's header format matches what we want
        const existingHeader = (existingOnMeta.components || []).find(
          (c) => c.type === 'HEADER'
        );
        const existingFormat = existingHeader?.format?.toUpperCase() || 'TEXT';

        // If format matches (or we don't have an image for IMAGE), just sync
        const wantsImage = desiredFormat === 'IMAGE' && headerImageUrl;
        const formatMatches = existingFormat === (wantsImage ? 'IMAGE' : 'TEXT');

        if (formatMatches) {
          logger.info('Template on Meta matches desired format — syncing to Firestore', {
            name: existingOnMeta.name,
            status: existingOnMeta.status,
            format: existingFormat,
          });

          const metaComponents = existingOnMeta.components || templateDef.components;
          await storeInFirestore(
            templateDef.name,
            templateDef.category,
            templateDef.language,
            metaComponents,
            { id: existingOnMeta.id, status: existingOnMeta.status }
          );

          // Record actual Meta name if it differs
          if (existingOnMeta.name !== templateDef.name) {
            await db.collection('whatsappTemplates').doc(templateDef.name).set(
              { metaTemplateName: existingOnMeta.name },
              { merge: true }
            );
          }

          return {
            success: true,
            templateId: existingOnMeta.id,
            templateName: existingOnMeta.name,
            status: existingOnMeta.status,
          };
        }

        // Format mismatch — we need a NEW template with a different name
        // (Meta doesn't allow editing the header format of an existing template)
        logger.info('Format mismatch — creating new versioned template', {
          existing: existingFormat,
          desired: wantsImage ? 'IMAGE' : 'TEXT',
          existingName: existingOnMeta.name,
        });
      }

      // ── Step 3: Prepare components for creation ──
      // Meta v21.0 requires header_handle (from Resumable Upload API) for IMAGE
      // headers. We upload the image to Meta first to get a handle, then use it
      // in the template. If upload fails, we fall back to TEXT header.

      let usingImageHeader = false;
      let usingDocumentHeader = false;
      if (desiredFormat === 'IMAGE' && desiredHeader && !desiredHeader.example) {
        if (headerImageUrl) {
          try {
            logger.info('Uploading header image to Meta via Resumable Upload API...');
            const headerHandle = await uploadMediaForTemplate(headerImageUrl);
            desiredHeader.example = { header_handle: [headerHandle] };
            usingImageHeader = true;
            logger.info('Got header_handle for IMAGE template');
          } catch (uploadErr) {
            logger.warn('Failed to upload image to Meta — falling back to TEXT header', {
              error: uploadErr.message,
            });
            desiredHeader.format = 'TEXT';
            desiredHeader.text = TEXT_FALLBACK_MAP[templateDef.name] || 'Dawin Finishes';
          }
        } else {
          logger.info('No header image URL found — using TEXT header format');
          desiredHeader.format = 'TEXT';
          desiredHeader.text = 'Your Quote from Dawin Finishes';
        }
      }

      // For DOCUMENT headers, Meta requires an example PDF uploaded via Resumable Upload API
      if (desiredFormat === 'DOCUMENT' && desiredHeader && !desiredHeader.example) {
        // Try configured sample PDF, then Fall back to a publicly-hosted minimal PDF
        let samplePdfUrl = null;
        try {
          const waConfig = await db.collection('systemConfig').doc('whatsappConfig').get();
          if (waConfig.exists) {
            samplePdfUrl = waConfig.data()?.templateSampleDocumentUrl;
          }
        } catch { /* ignore */ }

        // If no custom sample configured, try to use a PDF from Firebase Storage
        if (!samplePdfUrl) {
          try {
            const bucket = admin.storage().bucket();
            const samplePath = 'organizations/default/whatsapp/template-samples/sample-quote.pdf';
            const [exists] = await bucket.file(samplePath).exists();
            if (exists) {
              // Generate a signed URL valid for 10 minutes (only needed for upload to Meta)
              const [signedUrl] = await bucket.file(samplePath).getSignedUrl({
                action: 'read',
                expires: Date.now() + 10 * 60 * 1000,
              });
              samplePdfUrl = signedUrl;
              logger.info('Using sample PDF from Firebase Storage for template submission');
            }
          } catch (storageErr) {
            logger.warn('Could not check Firebase Storage for sample PDF', { error: storageErr.message });
          }
        }

        // Last resort: generate a minimal PDF in memory and upload directly
        if (!samplePdfUrl) {
          try {
            logger.info('Generating minimal sample PDF for DOCUMENT template submission');
            const samplePdfBuffer = generateMinimalPdf('Sample Quote — Dawin Finishes');
            const headerHandle = await uploadBufferToMeta(samplePdfBuffer, 'application/pdf');
            desiredHeader.example = { header_handle: [headerHandle] };
            usingDocumentHeader = true;
            logger.info('Got header_handle for DOCUMENT template from generated PDF');
          } catch (genErr) {
            logger.warn('Failed to generate/upload sample PDF — falling back to TEXT header', {
              error: genErr.message,
            });
            desiredHeader.format = 'TEXT';
            desiredHeader.text = 'Quote Document';
          }
        }

        // Upload the sample PDF URL if we have one (and haven't already set header_handle above)
        if (samplePdfUrl && !desiredHeader.example) {
          try {
            logger.info('Uploading sample document to Meta via Resumable Upload API...');
            const headerHandle = await uploadMediaForTemplate(samplePdfUrl);
            desiredHeader.example = { header_handle: [headerHandle] };
            usingDocumentHeader = true;
            logger.info('Got header_handle for DOCUMENT template');
          } catch (uploadErr) {
            logger.warn('Failed to upload document to Meta — falling back to TEXT header', {
              error: uploadErr.message,
            });
            desiredHeader.format = 'TEXT';
            desiredHeader.text = 'Quote Document';
          }
        }
      }

      // ── Step 4: Create the template ──
      // Strategy: try IMAGE first, if all attempts fail with 500, retry with TEXT header

      let result;
      let createdName = templateDef.name;

      // Helper: pick candidate names (skip original if already taken on Meta)
      const candidateNames = existingOnMeta
        ? [`${templateDef.name}_v2`, `${templateDef.name}_v3`, `${templateDef.name}_v4`]
        : [templateDef.name, `${templateDef.name}_v2`, `${templateDef.name}_v3`];

      let created = false;
      let lastErr = null;

      for (const name of candidateNames) {
        createdName = name;
        try {
          result = await createTemplate(
            name,
            templateDef.category,
            templateDef.language,
            templateDef.components
          );
          created = true;
          break;
        } catch (err) {
          lastErr = err;
          const code = err.metaError?.code || err.metaError?.error?.code;
          if (err.status === 500 || code === 100) {
            logger.info(`${name} failed, trying next`, { error: err.message });
            continue;
          }
          throw err; // Non-retryable error
        }
      }

      // If IMAGE/DOCUMENT header failed on ALL names, fall back to TEXT header and retry
      if (!created && (usingImageHeader || usingDocumentHeader)) {
        logger.warn(`${desiredHeader.format} header creation failed on all names — falling back to TEXT header`);
        desiredHeader.format = 'TEXT';
        desiredHeader.text = 'Your Quote from Dawin Finishes';
        delete desiredHeader.example;
        usingImageHeader = false;
        usingDocumentHeader = false;

        for (const name of candidateNames) {
          createdName = name;
          try {
            result = await createTemplate(
              name,
              templateDef.category,
              templateDef.language,
              templateDef.components
            );
            created = true;
            break;
          } catch (err) {
            lastErr = err;
            const code = err.metaError?.code || err.metaError?.error?.code;
            if (err.status === 500 || code === 100) {
              continue;
            }
            throw err;
          }
        }
      }

      if (!created) {
        throw lastErr || new Error('Could not create template after all attempts');
      }

      // ── Step 5: Store in Firestore ──

      await storeInFirestore(
        templateDef.name, // Firestore doc key stays canonical
        templateDef.category,
        templateDef.language,
        templateDef.components,
        result
      );

      // Record actual Meta name so sending code uses the right one
      if (createdName !== templateDef.name) {
        await db.collection('whatsappTemplates').doc(templateDef.name).set(
          { metaTemplateName: createdName },
          { merge: true }
        );
      }

      logger.info('Template created successfully', {
        name: createdName,
        firestoreKey: templateDef.name,
        metaId: result.id,
        status: result.status,
      });

      return {
        success: true,
        templateId: result.id,
        templateName: createdName,
        status: result.status || 'PENDING',
      };
    } catch (err) {
      logger.error('Failed to create template', {
        name: templateDef.name,
        error: err.message,
        metaError: err.metaError,
      });

      // Include Meta's specific error details for better debugging
      const metaDetail = err.metaError?.message || err.metaError?.error?.message || '';
      const detail = metaDetail ? ` (${metaDetail})` : '';
      throw new HttpsError('internal', `Failed to create template: ${err.message}${detail}`);
    }
  }
);

/**
 * Delete a WhatsApp template from Meta Business Manager
 */
const deleteWhatsAppTemplate = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    secrets: [META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_BUSINESS_ACCOUNT_ID],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { templateName } = request.data;
    if (!templateName) {
      throw new HttpsError('invalid-argument', 'templateName is required');
    }

    try {
      await deleteTemplate(templateName);

      // Update Firestore
      const templateRef = db.collection('whatsappTemplates').doc(templateName);
      const snap = await templateRef.get();
      if (snap.exists) {
        await templateRef.update({
          status: 'removed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return { success: true, deleted: templateName };
    } catch (err) {
      logger.error('Failed to delete template', { templateName, error: err.message });
      throw new HttpsError('internal', `Failed to delete template: ${err.message}`);
    }
  }
);

/**
 * List available predefined templates that can be submitted
 */
const listPredefinedTemplates = onCall(
  { region: 'us-central1', memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    return {
      templates: Object.entries(PREDEFINED_TEMPLATES).map(([key, def]) => ({
        key,
        name: def.name,
        category: def.category,
        language: def.language,
        description: getTemplateDescription(key),
        bodyPreview: extractBodyText(def.components).substring(0, 120) + '...',
        hasButtons: def.components.some(
          (c) => c.type === 'BUTTONS' && c.buttons?.length > 0
        ),
        parameterCount: countParameters(def.components),
      })),
    };
  }
);

// ============================================
// Helpers
// ============================================

function extractBodyText(components) {
  const body = components.find((c) => c.type === 'BODY');
  return body?.text || '';
}

function extractHeaderType(components) {
  const header = components.find((c) => c.type === 'HEADER');
  return header?.format?.toLowerCase() || null;
}

function extractHeaderText(components) {
  const header = components.find((c) => c.type === 'HEADER');
  return header?.text || null;
}

function extractFooterText(components) {
  const footer = components.find((c) => c.type === 'FOOTER');
  return footer?.text || null;
}

function extractButtons(components) {
  const btns = components.find((c) => c.type === 'BUTTONS');
  if (!btns?.buttons) return [];
  return btns.buttons.map((b) => ({
    type: b.type.toLowerCase(),
    text: b.text,
    url: b.url || null,
    phoneNumber: b.phone_number || null,
  }));
}

function countParameters(components) {
  let count = 0;
  for (const c of components) {
    const matches = (c.text || '').match(/\{\{\d+\}\}/g);
    if (matches) count += matches.length;
  }
  return count;
}

function getTemplateDescription(key) {
  const descriptions = {
    quote_submission:
      'Send a quote to clients with Approve/Reject quick-reply buttons. Works outside the 24h window.',
    quote_document:
      'Send a PDF quote document as a template attachment. Works outside the 24h window.',
    order_status_update:
      'Notify customers about order status changes (shipped, delivered, etc.).',
    order_confirmation:
      'Confirm a sales order with payment schedule breakdown. Includes branded header image.',
    deposit_payment_request:
      'Request deposit payment from client with bank, MTN MoMo, and Pesapal payment options.',
    payment_receipt:
      'Share a PDF payment receipt with the client. Includes order details, amount paid, date, and payment method.',
    document_share:
      'Send any PDF document (invoice, contract, report, etc.) to a client. Works outside the 24h window.',
    receipt_document:
      'Send an official PDF receipt document to a client with order and payment details.',
    change_order_submission:
      'Notify clients that a change order is ready and provide the approval link. Supports branded image header.',
    change_order_document:
      'Send the detailed change-order PDF attachment as a follow-up document template.',
    welcome_message:
      'Welcome new contacts with a branded greeting message.',
  };
  return descriptions[key] || '';
}

module.exports = {
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  listPredefinedTemplates,
  PREDEFINED_TEMPLATES,
};
