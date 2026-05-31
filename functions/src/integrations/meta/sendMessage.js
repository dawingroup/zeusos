/**
 * Meta WhatsApp - Send Message Cloud Functions
 * HTTP-callable functions for sending outbound WhatsApp messages
 * Supports dual-provider routing during Zoko-to-Meta migration
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const {
  META_WHATSAPP_ACCESS_TOKEN,
  META_WHATSAPP_PHONE_NUMBER_ID,
  sendTextMessage: metaSendText,
  sendTemplateMessage: metaSendTemplate,
  sendImageMessage: metaSendImage,
  sendInteractiveMessage: metaSendInteractive,
  sendLocationMessage: metaSendLocation,
  sendDocumentMessage: metaSendDocument,
} = require('./metaCloudApiClient');
const { normalizePhoneNumber, isValidPhoneNumber } = require('./utils');

// Import Zoko for dual-run support
let zokoSendText, zokoSendTemplate, zokoSendImage, ZOKO_API_KEY;
try {
  const zokoClient = require('../zoko/zokoClient');
  zokoSendText = zokoClient.sendTextMessage;
  zokoSendTemplate = zokoClient.sendTemplateMessage;
  zokoSendImage = zokoClient.sendImageMessage;
  ZOKO_API_KEY = zokoClient.ZOKO_API_KEY;
} catch {
  // Zoko module may be removed after migration
  logger.info('Zoko client not available - using Meta only');
}

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  CONVERSATIONS: 'whatsappConversations',
  TEMPLATES: 'whatsappTemplates',
  // Phase 4.2 — config moved off DawinOS `systemConfig` onto the Zeus comms
  // config (`commsConfig/whatsapp`, the same doc the webhook kill-switch reads).
  CONFIG: 'commsConfig',
};
const CONFIG_DOC_ID = 'whatsapp';

/**
 * Verify Firebase ID token from Authorization header
 */
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const idToken = authHeader.split('Bearer ')[1];
  return admin.auth().verifyIdToken(idToken);
}

/**
 * Check if user has an allowed role for WhatsApp messaging
 */
async function hasWhatsAppAccess(uid) {
  const configDoc = await db.collection(COLLECTIONS.CONFIG).doc(CONFIG_DOC_ID).get();
  const config = configDoc.exists ? configDoc.data() : {};
  const allowedRoles = config.allowedSenderRoles || ['admin', 'owner', 'design-manager', 'client-liaison'];

  // Check custom claims first
  const userRecord = await admin.auth().getUser(uid);
  const claims = userRecord.customClaims || {};
  const claimsRole = claims.role || '';
  if (allowedRoles.includes(claimsRole) || claims.admin === true) {
    return true;
  }

  // Fallback: check the Firestore user document globalRole. ZeusOS keys the
  // user doc by uid (organizations/default/users/{uid}, then users/{uid}) —
  // mirror loadUserDoc rather than the DawinOS uid-field query. (Phase 4.2)
  let userSnap = await db.doc(`organizations/default/users/${uid}`).get();
  if (!userSnap.exists) userSnap = await db.doc(`users/${uid}`).get();
  if (userSnap.exists) {
    const globalRole = userSnap.data().globalRole || '';
    if (allowedRoles.includes(globalRole)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the 24-hour messaging window is open for a conversation
 */
function isWindowOpen(conversation) {
  if (!conversation.lastInboundAt) return false;
  const lastInbound = conversation.lastInboundAt.toDate
    ? conversation.lastInboundAt.toDate()
    : new Date(conversation.lastInboundAt);
  const windowEnd = new Date(lastInbound.getTime() + 24 * 60 * 60 * 1000);
  return new Date() < windowEnd;
}

/**
 * Store an outbound message in Firestore
 */
async function storeOutboundMessage(conversationId, messageData) {
  const messageRef = db
    .collection(COLLECTIONS.CONVERSATIONS)
    .doc(conversationId)
    .collection('messages')
    .doc();

  const message = {
    id: messageRef.id,
    conversationId,
    direction: 'outbound',
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    ...messageData,
  };

  await messageRef.set(message);

  // Update conversation summary
  await db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).update({
    lastMessageText: messageData.textContent || `[${messageData.messageType}]`,
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDirection: 'outbound',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return message;
}

/**
 * Get or create a conversation for a customer + phone number
 */
async function getOrCreateConversation(customerId, customerName, phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);

  const existing = await db
    .collection(COLLECTIONS.CONVERSATIONS)
    .where('phoneNumber', '==', normalized)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data() };
  }

  const newRef = db.collection(COLLECTIONS.CONVERSATIONS).doc();
  const conversation = {
    id: newRef.id,
    customerId: customerId || null,
    customerName: customerName || 'Unknown',
    phoneNumber: normalized,
    provider: 'meta',
    lastInboundAt: null,
    windowExpiresAt: null,
    isWindowOpen: false,
    status: 'active',
    unreadCount: 0,
    lastMessageText: '',
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDirection: 'outbound',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await newRef.set(conversation);
  return conversation;
}

/**
 * Get the active provider from config
 * @returns {Promise<string>} 'meta' or 'zoko'
 */
async function getActiveProvider() {
  const configDoc = await db.collection(COLLECTIONS.CONFIG).doc(CONFIG_DOC_ID).get();
  return configDoc.exists ? configDoc.data()?.activeProvider || 'meta' : 'meta';
}

/**
 * Build template components from flat params for Meta API
 * Converts { "1": "John", "2": "order123" } to Meta components format
 */
function buildTemplateComponents(params, headerConfig) {
  const components = [];

  // Add header component if the template requires one
  if (headerConfig) {
    const headerComponent = { type: 'header', parameters: [] };
    switch (headerConfig.format) {
      case 'document':
        headerComponent.parameters.push({
          type: 'document',
          document: { link: headerConfig.url || '', filename: headerConfig.filename || 'document' },
        });
        break;
      case 'image':
        headerComponent.parameters.push({
          type: 'image',
          image: { link: headerConfig.url || '' },
        });
        break;
      case 'video':
        headerComponent.parameters.push({
          type: 'video',
          video: { link: headerConfig.url || '' },
        });
        break;
      case 'text':
        if (headerConfig.text) {
          headerComponent.parameters.push({ type: 'text', text: headerConfig.text });
        }
        break;
    }
    if (headerComponent.parameters.length > 0) {
      components.push(headerComponent);
    }
  }

  // Add body parameters
  if (params && Object.keys(params).length > 0) {
    const bodyParameters = Object.entries(params)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([, value]) => ({ type: 'text', text: String(value) }));
    components.push({ type: 'body', parameters: bodyParameters });
  }

  return components;
}

/**
 * Send WhatsApp Message - HTTP endpoint
 * Supports dual-provider routing during migration
 */
const sendWhatsAppMessage = onRequest(
  {
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 60,
    cors: ALLOWED_ORIGINS,
    secrets: [
      META_WHATSAPP_ACCESS_TOKEN,
      META_WHATSAPP_PHONE_NUMBER_ID,
      ...(ZOKO_API_KEY ? [ZOKO_API_KEY] : []),
    ],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const decodedToken = await verifyAuth(req);
      const uid = decodedToken.uid;
      logger.info('sendWhatsAppMessage: auth verified', { uid, email: decodedToken.email });

      const hasAccess = await hasWhatsAppAccess(uid);
      if (!hasAccess) {
        const userRecord = await admin.auth().getUser(uid);
        logger.warn('sendWhatsAppMessage: access denied', {
          uid,
          claims: userRecord.customClaims,
        });
        return res.status(403).json({ error: 'Insufficient permissions to send WhatsApp messages' });
      }

      const {
        conversationId: existingConversationId,
        customerId,
        customerName,
        phoneNumber,
        messageType,
        text,
        templateId,
        templateName,
        templateParams,
        imageUrl,
        imageCaption,
        documentUrl,
        documentCaption,
        documentFilename,
        interactive,
        latitude,
        longitude,
        locationName,
        locationAddress,
        headerConfig,
      } = req.body;

      const normalized = normalizePhoneNumber(phoneNumber);
      if (!isValidPhoneNumber(normalized)) {
        logger.warn('Invalid phone number', { phoneNumber, normalized, messageType });
        return res.status(400).json({ error: `Invalid phone number: "${phoneNumber}"` });
      }

      logger.info('sendWhatsAppMessage: validated', { normalized, messageType, conversationId: existingConversationId });

      // Get or create conversation
      let conversation;
      if (existingConversationId) {
        const doc = await db.collection(COLLECTIONS.CONVERSATIONS).doc(existingConversationId).get();
        if (!doc.exists) {
          return res.status(404).json({ error: 'Conversation not found' });
        }
        conversation = { id: doc.id, ...doc.data() };
      } else {
        conversation = await getOrCreateConversation(customerId, customerName, normalized);
      }

      // For non-template messages, check 24-hour window
      if (messageType !== 'template' && !isWindowOpen(conversation)) {
        return res.status(400).json({
          error: 'Messaging window is closed. Use a template message to re-engage the customer.',
          windowClosed: true,
        });
      }

      const senderName = decodedToken.name || decodedToken.email || 'Unknown';
      const provider = await getActiveProvider();

      let apiResult;
      let messageData;

      switch (messageType) {
        case 'text':
          if (!text) return res.status(400).json({ error: 'Text content is required' });
          if (provider === 'meta') {
            apiResult = await metaSendText(normalized, text);
          } else if (zokoSendText) {
            apiResult = await zokoSendText(normalized, text);
          } else {
            return res.status(500).json({ error: 'No message provider available' });
          }
          messageData = {
            messageType: 'text',
            textContent: text,
            senderType: 'employee',
            senderId: uid,
            senderName,
            provider,
          };
          break;

        case 'template': {
          const metaTemplateName = templateName || templateId;
          if (!metaTemplateName) return res.status(400).json({ error: 'Template name is required' });

          // Resolve actual Meta template name — may be versioned (e.g. quote_submission_v2)
          // if the original name was under Meta's 30-day post-deletion lock
          let actualMetaName = metaTemplateName;
          try {
            const tmplDoc = await db.collection(COLLECTIONS.TEMPLATES).doc(metaTemplateName).get();
            if (tmplDoc.exists && tmplDoc.data()?.metaTemplateName) {
              actualMetaName = tmplDoc.data().metaTemplateName;
              logger.info('Using versioned template name', { canonical: metaTemplateName, actual: actualMetaName });
            }
          } catch (resolveErr) {
            logger.warn('Could not resolve template name:', { error: resolveErr.message });
          }

          if (provider === 'meta') {
            let components;

            // Use pre-built template components if provided (includes header, body, buttons)
            if (interactive?.templateComponents && Array.isArray(interactive.templateComponents)) {
              components = interactive.templateComponents;

              // Server-side safeguard: ensure header format matches what Meta expects
              // Reads the registered template's headerType from Firestore and adapts
              try {
                const regSnap = await db.collection(COLLECTIONS.TEMPLATES).doc(metaTemplateName).get();
                const registeredHeaderType = regSnap.exists ? regSnap.data()?.headerType : null;
                const headerComp = components.find((c) => c.type === 'header');

                if (headerComp?.parameters?.[0]) {
                  const sentType = headerComp.parameters[0].type; // 'image' or 'text'
                  if (registeredHeaderType && sentType !== registeredHeaderType) {
                    logger.warn('Header format mismatch detected — adapting components', {
                      templateName: metaTemplateName,
                      registeredHeaderType,
                      sentType,
                    });
                    if (registeredHeaderType === 'text' && sentType === 'image') {
                      // Meta expects TEXT but got IMAGE — strip the image header entirely
                      // (TEXT headers with no variables don't need a header component)
                      components = components.filter((c) => c.type !== 'header');
                    } else if (registeredHeaderType === 'image' && sentType === 'text') {
                      // Meta expects IMAGE but got TEXT — strip the text header
                      components = components.filter((c) => c.type !== 'header');
                    }
                  }
                }
              } catch (regErr) {
                logger.warn('Could not verify registered header type', { error: regErr.message });
              }

              logger.info('Using pre-built template components', {
                templateName: metaTemplateName,
                componentCount: components.length,
              });
            } else {
              // Build components from flat params (body-only, no header/button support)
              let resolvedHeaderConfig = headerConfig || null;
              if (!resolvedHeaderConfig) {
                const templateSnap = await db.collection(COLLECTIONS.TEMPLATES)
                  .where('metaTemplateName', '==', metaTemplateName)
                  .limit(1)
                  .get();
                if (!templateSnap.empty) {
                  const tmpl = templateSnap.docs[0].data();
                  if (tmpl.headerType && tmpl.headerType !== 'text' && tmpl.headerType !== 'none') {
                    logger.warn('Template requires header media but none provided', {
                      templateName: metaTemplateName,
                      headerType: tmpl.headerType,
                    });
                  }
                }
              }
              components = buildTemplateComponents(templateParams, resolvedHeaderConfig);
            }

            apiResult = await metaSendTemplate(normalized, actualMetaName, 'en', components);
          } else if (zokoSendTemplate) {
            apiResult = await zokoSendTemplate(normalized, templateId, templateParams || {});
          } else {
            return res.status(500).json({ error: 'No message provider available' });
          }
          // Build rich textContent by resolving template body from Firestore
          let richTextContent = `[Template: ${metaTemplateName}]`;
          let templateButtons = [];
          let templateFooter = null;
          let templateHeaderText = null;
          try {
            const tmplSnap = await db.collection(COLLECTIONS.TEMPLATES).doc(metaTemplateName).get();
            if (tmplSnap.exists) {
              const tmplData = tmplSnap.data();
              // Substitute params into body text
              let body = tmplData.bodyText || '';
              if (body && templateParams) {
                for (const [key, value] of Object.entries(templateParams)) {
                  body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                }
              }
              if (body) richTextContent = body;
              // Extract button labels and footer
              if (Array.isArray(tmplData.buttons)) {
                templateButtons = tmplData.buttons.map((b) => b.text || b.type);
              }
              if (tmplData.footerText) templateFooter = tmplData.footerText;
              if (tmplData.headerText) templateHeaderText = tmplData.headerText;
            }
          } catch (tmplErr) {
            logger.warn('Could not resolve template body text', { error: tmplErr.message });
          }

          messageData = {
            messageType: 'template',
            templateId: templateId || metaTemplateName,
            templateName: metaTemplateName,
            templateParams: templateParams || {},
            textContent: richTextContent,
            senderType: 'employee',
            senderId: uid,
            senderName,
            provider,
            ...(templateButtons.length > 0 ? { templateButtons } : {}),
            ...(templateFooter ? { templateFooter } : {}),
            ...(templateHeaderText ? { templateHeaderText } : {}),
          };
          break;
        }

        case 'image':
          if (!imageUrl) return res.status(400).json({ error: 'Image URL is required' });
          if (provider === 'meta') {
            apiResult = await metaSendImage(normalized, imageUrl, imageCaption || '');
          } else if (zokoSendImage) {
            apiResult = await zokoSendImage(normalized, imageUrl, imageCaption || '');
          } else {
            return res.status(500).json({ error: 'No message provider available' });
          }
          messageData = {
            messageType: 'image',
            imageUrl,
            imageCaption: imageCaption || '',
            textContent: imageCaption || '[Image]',
            senderType: 'employee',
            senderId: uid,
            senderName,
            provider,
          };
          break;

        case 'document':
          if (!documentUrl) return res.status(400).json({ error: 'Document URL is required' });
          if (provider !== 'meta') {
            return res.status(400).json({ error: 'Document messages only supported via Meta API' });
          }
          apiResult = await metaSendDocument(normalized, documentUrl, documentCaption || '', documentFilename || '');
          messageData = {
            messageType: 'document',
            documentUrl,
            documentFilename: documentFilename || '',
            textContent: documentCaption || `[Document: ${documentFilename || 'file'}]`,
            senderType: 'employee',
            senderId: uid,
            senderName,
            provider: 'meta',
          };
          break;

        case 'interactive':
          if (!interactive) return res.status(400).json({ error: 'Interactive payload is required' });
          if (provider !== 'meta') {
            return res.status(400).json({ error: 'Interactive messages only supported via Meta API' });
          }
          apiResult = await metaSendInteractive(normalized, interactive);
          messageData = {
            messageType: 'interactive',
            interactiveType: interactive.type || '',
            interactiveBody: interactive,
            textContent: `[Interactive: ${interactive.type || 'message'}]`,
            senderType: 'employee',
            senderId: uid,
            senderName,
            provider: 'meta',
          };
          break;

        case 'location':
          if (!latitude || !longitude) return res.status(400).json({ error: 'Latitude and longitude are required' });
          if (provider !== 'meta') {
            return res.status(400).json({ error: 'Location messages only supported via Meta API' });
          }
          apiResult = await metaSendLocation(normalized, latitude, longitude, locationName || '', locationAddress || '');
          messageData = {
            messageType: 'location',
            locationLatitude: latitude,
            locationLongitude: longitude,
            locationName: locationName || '',
            locationAddress: locationAddress || '',
            textContent: locationName || '[Location]',
            senderType: 'employee',
            senderId: uid,
            senderName,
            provider: 'meta',
          };
          break;

        default:
          return res.status(400).json({ error: `Unsupported message type: ${messageType}` });
      }

      // Store the message with provider-specific message ID
      if (provider === 'meta') {
        messageData.waMessageId = apiResult?.messages?.[0]?.id || null;
      } else {
        messageData.zokoMessageId = apiResult?.messageId || apiResult?.id || null;
      }
      messageData.status = 'sent';
      const storedMessage = await storeOutboundMessage(conversation.id, messageData);

      logger.info('WhatsApp message sent successfully', {
        conversationId: conversation.id,
        messageType,
        provider,
        waMessageId: messageData.waMessageId || null,
        zokoMessageId: messageData.zokoMessageId || null,
      });

      return res.status(200).json({
        success: true,
        conversationId: conversation.id,
        messageId: storedMessage.id,
        waMessageId: messageData.waMessageId || null,
        zokoMessageId: messageData.zokoMessageId || null,
      });
    } catch (err) {
      const metaError = err.metaError || {};
      const metaCode = metaError.code;
      const metaSubcode = metaError.error_subcode;
      const metaDetail = metaError.error_data?.details || metaError.message || '';

      logger.error('Failed to send WhatsApp message', {
        error: err.message,
        metaCode,
        metaSubcode,
        metaDetail,
        stack: err.stack,
      });

      // Map known Meta error codes to actionable responses
      const httpStatus = err.status || 500;
      const response = { error: 'Failed to send message', details: err.message };

      if (metaCode) {
        response.metaErrorCode = metaCode;
        response.metaDetail = metaDetail;
      }

      // 131026 = Message undeliverable (template paused/rejected, bad media URL, or recipient issue)
      if (metaCode === 131026) {
        response.error = 'Message undeliverable';
        response.details =
          'The message could not be delivered. This usually means the template is paused/rejected in Meta, ' +
          'the media URL is not publicly accessible, or the recipient cannot receive messages.';
      }

      // 132000 = Template not found / parameter mismatch
      if (metaCode === 132000 || metaSubcode === 2388023) {
        response.error = 'Template error';
        response.details =
          metaDetail || 'The template was not found or parameters do not match. Check the template name and status in Meta Business Manager.';
      }

      return res.status(httpStatus < 500 ? httpStatus : 502).json(response);
    }
  }
);

module.exports = {
  sendWhatsAppMessage,
};
