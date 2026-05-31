const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { defineString, defineSecret } = require('firebase-functions/params');
const { Client } = require('@notionhq/client');
const AnthropicModule = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('./src/config/cors');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// AI Functions
const { generateStrategyReport } = require('./src/ai/generateStrategyReport');
const { strategyResearch } = require('./src/ai/strategyResearch');
const { assessStrategySection, rewriteStrategySection } = require('./src/ai/strategyAssessment');
const { projectScoping } = require('./src/ai/projectScoping');
const { designItemEnhancement } = require('./src/ai/designItemEnhancement');
const { imageAnalysis } = require('./src/ai/imageAnalysis');
const { analyzeClip } = require('./src/ai/analyzeClip');
const { assistantChat } = require('./src/ai/assistantChat');
const { generateProductNames } = require('./src/ai/productNaming');
const { generateProductContent, generateDiscoverabilityData } = require('./src/ai/productContent');
const { auditShopifyProduct } = require('./src/ai/catalogAudit');
const { generateEmbedding, generateEmbeddings, semanticSearch, indexCollection } = require('./src/ai/embeddings');
const { marketIntelligenceScan, getMarketIntelligenceReports } = require('./src/ai/marketIntelligence');
const { extractMemories, getMemoryContext, saveManualMemory, semanticMemorySearch } = require('./src/ai/aiMemory');
const { getMemoryContext: loadMemoryContext } = require('./src/utils/memoryLoader');
const { reverseImageSearch } = require('./src/ai/reverseImageSearch');
const { proxyFetchImage } = require('./src/ai/proxyFetchImage');
// (Material pricing AI, design/inventory AI handlers, and matflow handlers were
// removed in the Phase 1.E sweep — no httpsCallable callers in src/ or
// zeusos-mcp-server/. See PR for full list.)
const { researchProduct } = require('./src/ai/researchProduct');
const { auditInventoryHealth } = require('./src/ai/auditInventoryHealth');
// mergeInventoryDuplicates was a DawinOS inventory-management AI tool
// that read `inventoryItems` (stripped in Phase 1.C). No frontend
// callers in ZeusOS — removed in the tools/* cleanup.
const { crossModuleIntelligence } = require('./src/ai/crossModuleIntelligence');
const { assetIntelligence } = require('./src/ai/assetIntelligence');
const { procurementAdvisor } = require('./src/ai/procurementAdvisor');
const { parsePurchaseOrderPdf } = require('./src/ai/parsePurchaseOrderPdf');

// (Workshop Viewer AI — DawinOS construction-domain CFns removed in
// Phase 1.C cleanup follow-up. The five CFns and the `workshop/` directory
// have no callers in ZeusOS. Removed because `generateMesh` and
// `generateParametric` referenced a deprecated `TRIPO_API_KEY` Secret
// Manager secret that blocked `firebase deploy --only functions`.)

// Scheduled Audit Functions
const { dailyCatalogAudit, weeklyCatalogAudit } = require('./src/scheduled/catalogAudit');
exports.dailyCatalogAudit = dailyCatalogAudit;
exports.weeklyCatalogAudit = weeklyCatalogAudit;

// Monthly Material Market Pricing
const { monthlyMaterialPricing } = require('./src/scheduled/materialPricingScheduled');
exports.monthlyMaterialPricing = monthlyMaterialPricing;

// Memory TTL Cleanup
const { memoryTTLCleanup } = require('./src/scheduled/memoryTTLCleanup');
exports.memoryTTLCleanup = memoryTTLCleanup;

// ADD-FIN-001: Deadline Monitoring Functions
const {
  hourlyDeadlineCheck,
  dailyDeadlineSummary,
  triggerDeadlineCheck,
  getProjectDeadlineSummary
} = require('./src/scheduled/deadline-monitoring');
exports.hourlyDeadlineCheck = hourlyDeadlineCheck;
exports.dailyDeadlineSummary = dailyDeadlineSummary;
exports.triggerDeadlineCheck = triggerDeadlineCheck;
exports.getProjectDeadlineSummary = getProjectDeadlineSummary;

// ADD-FIN-001: Document Export Functions
const {
  dailyDocumentExport,
  triggerDocumentExport,
  retryFailedExports,
  getExportJobStatus
} = require('./src/scheduled/document-export');
exports.dailyDocumentExport = dailyDocumentExport;
exports.triggerDocumentExport = triggerDocumentExport;
exports.retryFailedExports = retryFailedExports;
exports.getExportJobStatus = getExportJobStatus;

// Shopify integration surface — fully removed in Phase 1.E sweep.
// DawinOS shipped on a Shopify storefront (custom finishes, voice,
// press mentions, materials, fulfillment); Zeus does not. Every webhook,
// metaobject publisher, daily-reconcile scheduler, and AI storefront
// drafter is gone. Removed:
//   webhooks: shopifyProductUpdate/Delete, shopifyOrderCreate/Update,
//             shopifyFulfillmentCreate, shopifyProjectEnquiry,
//             shopifySampleOrder, shopifyNewsletterSubscribe
//   integrations/shopify: shopifyPublishCaseStudy, publishFinishMetaobject,
//             publishProjectMetaobject, applyProductMetafieldsCallable,
//             publishVoiceMetaobject, publishPressMentionMetaobject,
//             publishFeaturedUpdateMetaobject, publishMaterialMetaobject
//   triggers: finishShopifySync, manufacturingShopifyWorkshopStatus,
//             voiceShopifySync, pressMentionShopifySync,
//             featuredUpdateShopifySync, materialShopifySync
//   scheduled: shopifyDailyReconcile
//   ai: draftStorefrontContent
// Same trigger-kind-drift deploy failure pattern as PR #48/#103/#104.

// Shopify Inventory Sync Trigger — removed in Phase 1.E cleanup
// (DawinOS-legacy; inventory module stripped in Phase 1.C; no consumers).
// Was tripping firebase deploy with "Changing from HTTPS to background
// triggered function" because the Firestore-trigger registration drifted
// from prod state. Same pattern as PR #48's projectCaseStudyShopifySync
// removal.

// Manufacturing MES Triggers — fully removed in Phase 1.E sweep
// (DawinOS-legacy, no callers; manufacturing module stripped in
// Phase 1.C). Previously: onManufacturingStepCompleted, onMOCompletedMES,
// onBOMLineCreated removed in an earlier pass; this hotfix removes the
// remaining 5 — onQualityEventCreated, dailyProductionReport,
// overdueOrderCheck, checkBOMAvailability, generateBOMFromOptimization
// — because they were causing trigger-kind-drift deploy failures
// ("Changing from an HTTPS function to a background triggered function
// is not allowed"). Same pattern as PR #48's projectCaseStudyShopifySync
// removal and PR #103's onStockLevelChanged removal.

// Sales Order Triggers — fully removed in Phase 1.E sweep.
// DawinOS construction-era SO lifecycle (status changes, change-order
// approval, release, stale-check, risk auto-detection). ZeusOS replaces
// this with the IWO state machine (functions/src/assignment/) and the
// commercial-gravity flow (master_jobs → quotes → client_invoices).
// Removed: onSalesOrderStatusChanged, onChangeOrderApproved,
// onSalesOrderReleased, staleSalesOrderCheck, autoDetectRisks. Same
// trigger-kind-drift pattern as PR #103/#104.

// BigQuery Operational Analytics Sync — fully removed in Phase 1.E sweep.
// DawinOS construction-era analytics sync (inventory, stock levels, sales
// orders, design projects, matflow projects, customers, suppliers, legacy
// suppliers). All source collections are stripped in ZeusOS, so the
// triggers fire on nothing. BigQuery for ZeusOS will be re-introduced in
// Phase 5.B (Executive Dashboard rebuild) against the new commercial-
// gravity collections (master_jobs, quotes, client_invoices, IWOs).
// Removed: onInventoryItemWritten, onStockLevelWritten,
// onSalesOrderWritten, onProjectWritten, onMatflowProjectWritten,
// onCustomerWritten, onSupplierWritten, onLegacySupplierWritten,
// backfillOperationalBigQuery. Same trigger-kind-drift pattern.

exports.generateStrategyReport = generateStrategyReport;
exports.strategyResearch = strategyResearch;
exports.assessStrategySection = assessStrategySection;
exports.rewriteStrategySection = rewriteStrategySection;
exports.projectScoping = projectScoping;
exports.designItemEnhancement = designItemEnhancement;
exports.imageAnalysis = imageAnalysis;
exports.analyzeClip = analyzeClip;
exports.assistantChat = assistantChat;
exports.crossModuleIntelligence = crossModuleIntelligence;
exports.reverseImageSearch = reverseImageSearch;
exports.proxyFetchImage = proxyFetchImage;
exports.researchProduct = researchProduct;
exports.auditInventoryHealth = auditInventoryHealth;
// mergeInventoryDuplicates export removed — see import block for rationale.
exports.assetIntelligence = assetIntelligence;
exports.procurementAdvisor = procurementAdvisor;
exports.parsePurchaseOrderPdf = parsePurchaseOrderPdf;
// (Phase 1.E: removed enhanceClipForMaterial / enhanceInventoryItem /
// applyInventoryCorrections / enhanceBOQItems / generateFormulaBreakdown —
// no httpsCallable callers. Workshop / Trimble CFn exports already gone.)
exports.generateProductNames = generateProductNames;
exports.generateProductContent = generateProductContent;
exports.generateDiscoverabilityData = generateDiscoverabilityData;
exports.auditShopifyProduct = auditShopifyProduct;

// AI Memory Functions
exports.extractMemories = extractMemories;
exports.getMemoryContext = getMemoryContext;
exports.saveManualMemory = saveManualMemory;
exports.semanticMemorySearch = semanticMemorySearch;

// Market Intelligence AI Functions
exports.marketIntelligenceScan = marketIntelligenceScan;
exports.getMarketIntelligenceReports = getMarketIntelligenceReports;

// RAG / Embedding Functions
exports.generateEmbedding = generateEmbedding;
exports.generateEmbeddings = generateEmbeddings;
exports.semanticSearch = semanticSearch;
exports.indexCollection = indexCollection;

// Cash Flow Optimizer — fully removed in Phase 1.E sweep.
// DawinOS-era spend-plan + crisis-alert + statutory-deadline + savings-
// allocation + QBO re-ingest + balance-change rescoring + spend-plan
// approval rescoring + liability detection from QBO + client payment
// profile updates. ZeusOS replaces this with the Phase 4.1
// procurement/finance handshake (talent + media supplier invoices →
// PO + JE via outbox consumers in functions/src/finance/) against an
// accounting provider TBD. QBO is disabled per plan §3 anyway.
// Removed:
//   finance/dailyCashFlowOptimizer (dailyCashFlowOptimizer)
//   finance/optimizerCallable (triggerOptimizer, generateSpendPlan,
//                              rescoreExpenditures)
//   finance/optimizerNotifications (crisisAlertOnSpendPlan,
//                                   statutoryDeadlineReminder)
//   triggers/cashFlowTriggers (autoAllocateSavingsOnInflow,
//     reingestOnQBOSync, rescoreOnBalanceChange,
//     rescoreOnSpendPlanApproval, detectLiabilitiesFromQBO,
//     updateClientPaymentProfile)
// Same trigger-kind-drift deploy failure pattern as PR #48/#103/#104.

// Client Portal admin — invite a portal user by email (staff-only callable)
const { inviteClientPortalUser } = require('./src/admin/inviteClientPortalUser');
exports.inviteClientPortalUser = inviteClientPortalUser;

// AI CFO Advisory Functions
const { generateCFOBriefing, dailyCFOBriefing } = require('./src/ai/cfoBriefing');
const { runCashFlowScenario } = require('./src/ai/cashFlowScenario');
exports.generateCFOBriefing = generateCFOBriefing;
exports.dailyCFOBriefing = dailyCFOBriefing;
exports.runCashFlowScenario = runCashFlowScenario;

// Phase 3.5 — Client Strategy Assistant. Aggregates stakeholders + competitors
// + regulatory exposure + business memory for a client, Claude-synthesised into
// a structured brief. Brand-direct ADs (own client) or parent-org principals.
const { generateClientStrategyBrief } = require('./src/ai/clientStrategyBrief');
exports.generateClientStrategyBrief = generateClientStrategyBrief;

// DawinOS v2.0 - Auth & Claims Functions
const { syncEmployeeClaims, setAdminClaims, initializeFirstAdmin, getCurrentClaims, updateUserClaims } = require('./src/auth/setCustomClaims');
exports.syncEmployeeClaims = syncEmployeeClaims;
exports.setAdminClaims = setAdminClaims;
exports.initializeFirstAdmin = initializeFirstAdmin;
exports.getCurrentClaims = getCurrentClaims;
exports.updateUserClaims = updateUserClaims;

// DawinOS v2.0 - User Invite Functions
const { processNewUserInvite } = require('./src/auth/userInvites');
exports.processNewUserInvite = processNewUserInvite;

// DawinOS v2.0 - User Doc Migration (admin-only)
const { migrateUserDocs } = require('./src/auth/migrateUserDocs');
exports.migrateUserDocs = migrateUserDocs;

// DawinOS v2.0 - Task Generation Functions
const {
  onBusinessEventCreated,
  processOverdueEscalations,
  sendTaskReminders,
  retryUnassignedTasks,
  assignUnassignedTasks
} = require('./src/triggers/taskGeneration');
exports.onBusinessEventCreated = onBusinessEventCreated;
exports.processOverdueEscalations = processOverdueEscalations;
exports.sendTaskReminders = sendTaskReminders;
exports.retryUnassignedTasks = retryUnassignedTasks;
exports.assignUnassignedTasks = assignUnassignedTasks;

// Customer Sync Functions
const {
  syncCustomerCallable,
  syncAllCustomersCallable,
  scheduledCustomerSync,
  importFromQuickBooksCallable,
} = require('./src/sync/customerSync');
exports.syncCustomer = syncCustomerCallable;
exports.syncAllCustomers = syncAllCustomersCallable;
exports.scheduledCustomerSync = scheduledCustomerSync;
exports.importFromQuickBooks = importFromQuickBooksCallable;

// QuickBooks Integration
const {
  getAuthUrl,
  handleCallback,
  checkConnection,
} = require('./src/integrations/quickbooks/auth');
const {
  disconnectQuickBooks,
} = require('./src/integrations/quickbooks/disconnect');
const {
  onCustomerCreatedQBO,
  syncCustomerToQuickBooks,
} = require('./src/integrations/quickbooks/customerSync');

exports.qbGetAuthUrl = getAuthUrl;
exports.qbCallback = handleCallback;
exports.qbCheckConnection = checkConnection;
exports.qbDisconnect = disconnectQuickBooks;
exports.onCustomerCreatedQBO = onCustomerCreatedQBO;
exports.syncCustomerToQuickBooks = syncCustomerToQuickBooks;

// QuickBooks Vendor Sync
const {
  syncSupplierToQuickBooks,
  syncAllSuppliersToQuickBooks,
  onSupplierCreated,
  onSupplierUpdated,
} = require('./src/integrations/quickbooks/vendorSync');
exports.syncSupplierToQuickBooks = syncSupplierToQuickBooks;
exports.syncAllSuppliersToQuickBooks = syncAllSuppliersToQuickBooks;
exports.onSupplierCreated = onSupplierCreated;
exports.onSupplierUpdated = onSupplierUpdated;

// QuickBooks Contact Pull Sync (QBO → DawinOS)
const {
  syncQBOContactsToFirestore,
} = require('./src/integrations/quickbooks/contactSync');
exports.syncQBOContactsToFirestore = syncQBOContactsToFirestore;

// QuickBooks Bill Sync
const {
  syncPOToBill,
  syncMultiplePOsToBills,
  syncBillCorrection,
  verifyBillSync,
  resetBillSync,
  batchUpdateBillNumbers,
  detectQBOCustomFields,
  probeQBOCustomFields,
} = require('./src/integrations/quickbooks/billSync');
exports.syncPOToBill = syncPOToBill;
exports.syncMultiplePOsToBills = syncMultiplePOsToBills;
exports.syncBillCorrection = syncBillCorrection;
exports.verifyBillSync = verifyBillSync;
exports.resetBillSync = resetBillSync;
exports.batchUpdateBillNumbers = batchUpdateBillNumbers;
exports.detectQBOCustomFields = detectQBOCustomFields;
exports.probeQBOCustomFields = probeQBOCustomFields;

// QuickBooks legacy syncs — fully removed in Phase 1.E sweep.
// DawinOS shipped a tight QBO integration around its construction
// domain: Bill sync on PO approval, SalesOrder/quote sync, MO→Invoice +
// MO→COGS journal entries, SO scope-freeze sync, SO→Invoice on release,
// inventory item resolution, stock-adjustment numbering. ZeusOS has
// disabled QBO per plan §3 (open item #3) and the underlying
// collections (manufacturingOrders, salesOrders, inventoryItems,
// client_quotes legacy schema) are stripped. Removed:
//   triggers: qboBillSyncTrigger (onPurchaseOrderApproved,
//             onReceiptCorrectionBillSync), qboSalesOrderTrigger
//             (onClientQuoteApproved), qboSOSalesOrderTrigger
//             (onSalesOrderScopeFrozen), qboSOInvoiceTrigger
//             (onSalesOrderReleasedInvoice), stockAdjustment.triggers
//             (generateAdjustmentNumber, onStockAdjustmentStatusChange)
//   integrations/quickbooks: salesOrderSync (syncQuoteToSalesOrder,
//             syncMultipleQuotesToSalesOrders), invoiceSync
//             (syncMOToInvoice, syncQuoteToInvoice, syncSOToInvoice,
//             syncPaymentToQBO), journalEntrySync (syncMOToCOGS,
//             syncMultipleMOsToCOGS), itemResolutionService
//             (syncInventoryItemsToQBO, onInventoryItemUpdated,
//             onInventoryItemDeleted)
// Same trigger-kind-drift deploy failure pattern as PR #48/#103/#104.
// Auth/connection HTTPS callables (qbGetAuthUrl, qbCallback,
// qbCheckConnection, qbDisconnect) are retained so the integration can
// be re-enabled in Phase 4.1 against an accounting provider TBD.

// (Phase 1.E: removed QuickBooks COGS Sync Trigger
// `onManufacturingOrderCompletedCOGS` — DawinOS construction-domain trigger.)

// QuickBooks Financial Sync
const {
  syncAllQBOData,
  syncQBOCategory,
  getQBOSyncHistory,
} = require('./src/integrations/quickbooks/financialSync');
exports.syncAllQBOData = syncAllQBOData;
exports.syncQBOCategory = syncQBOCategory;
exports.getQBOSyncHistory = getQBOSyncHistory;

// AI Utilities (new modular structure)
const {
  getModel,
  parseJsonResponse,
  generateWithRetry,
  MODEL_CONFIGS,
} = require('./src/utils/geminiClient');
const {
  checkRateLimit: checkRateLimitV2,
  enforceRateLimit,
  RATE_LIMITS,
} = require('./src/utils/rateLimiter');
const {
  validateChatInput,
  validateAssetInput,
  validateCutlistInput,
  sanitizePromptText,
} = require('./src/utils/validators');

// Firestore Triggers
const { onAssetStatusChange } = require('./src/triggers/syncAssetStatus');
exports.onAssetStatusChange = onAssetStatusChange;

// Feature Cache Invalidation Triggers
const { onFeatureWritten, onFeatureLibraryWritten } = require('./src/triggers/invalidateFeatureCache');
exports.onFeatureWritten = onFeatureWritten;
exports.onFeatureLibraryWritten = onFeatureLibraryWritten;

// (Phase 1.E: removed Clip Analysis Trigger `onDesignClipCreated`
// — DawinOS design-manager artifact.)

// Business Event Monitors - AI Intelligence Integration (Phase 1.E:
// removed onDesignItemUpdated / onDesignProjectCreated / onDesignProjectUpdated
// — design-manager stripped in Phase 1.A. onDesignItemCreated retained: still
// referenced by src/modules/intelligence-layer.)
const {
  onDesignItemCreated,
  onLaunchProductUpdated,
  onEngagementCreated,
  onEngagementUpdated,
  onDisbursementCreated,
  onDeliveryProjectUpdated,
} = require('./src/triggers/businessEventMonitors');
exports.onDesignItemCreated = onDesignItemCreated;
exports.onLaunchProductUpdated = onLaunchProductUpdated;
exports.onEngagementCreated = onEngagementCreated;
exports.onEngagementUpdated = onEngagementUpdated;
exports.onDisbursementCreated = onDisbursementCreated;
exports.onDeliveryProjectUpdated = onDeliveryProjectUpdated;

// (Phase 1.E: removed Manufacturing Order Triggers
// onManufacturingOrderCreated / onManufacturingOrderUpdated — manufacturing
// module stripped in Phase 1.A.)

// Purchase Order Triggers
const {
  onPurchaseOrderCreated,
  onPurchaseOrderUpdated,
} = require('./src/triggers/purchaseOrderTriggers');
exports.onPurchaseOrderCreated = onPurchaseOrderCreated;
exports.onPurchaseOrderUpdated = onPurchaseOrderUpdated;

// (Phase 1.E: removed Finish Library Trigger `onFinishUpdated` — finish
// library stripped in Phase 1.A.)

// Inventory + Stock surface — fully removed in Phase 1.E sweep.
// All of DawinOS's inventory lifecycle is gone: low-stock alerts,
// auto-archive, category itemCount sync, category seed migration,
// inventory-issue (issue from stores) with numbering + QBO expense
// journal mirroring. ZeusOS is a marketing agency, no warehouse.
// Removed:
//   triggers: stockAlerts (checkLowStockLevels), inventoryAutoArchive
//             (onInventoryItemUpdatedAutoArchive), inventoryCategorySync
//             (onInventoryItemCreatedCategorySync,
//             onInventoryItemUpdatedCategorySync,
//             onInventoryItemDeletedCategorySync), inventoryIssueTriggers
//             (generateIssueNumber, onInventoryIssueCreated,
//             onInventoryIssueUpdated), qboInventoryIssueTrigger
//             (onInventoryIssueQBOSync, onInventoryIssueReversalQBOSync)
//   migrations: seedInventoryCategories
// Same trigger-kind-drift deploy failure pattern as PR #48/#103/#104.

// Push Notifications
const { 
  sendPushNotification, 
  onDeliveryCreated, 
  onProcurementStatusChange,
  checkCriticalItems,
} = require('./src/notifications/pushNotifications');
exports.sendPushNotification = sendPushNotification;
exports.onDeliveryCreated = onDeliveryCreated;
exports.onProcurementStatusChange = onProcurementStatusChange;
exports.checkCriticalItems = checkCriticalItems;

// WhatsApp Cloud API Integration (Meta)
const { sendWhatsAppMessage } = require('./src/integrations/meta/sendMessage');
const { metaWhatsAppWebhook } = require('./src/webhooks/metaWhatsAppWebhook');
const { syncWhatsAppTemplatesMeta, scheduledTemplateSyncMeta } = require('./src/integrations/meta/syncTemplates');
exports.sendWhatsAppMessage = sendWhatsAppMessage;
exports.metaWhatsAppWebhook = metaWhatsAppWebhook;
exports.syncWhatsAppTemplatesMeta = syncWhatsAppTemplatesMeta;
exports.scheduledTemplateSyncMeta = scheduledTemplateSyncMeta;

// Meta WhatsApp - Broadcast & AI Agent
const { executeBroadcast } = require('./src/integrations/meta/broadcastExecutor');
const { processWhatsAppWithAI } = require('./src/integrations/meta/salesAgent');
exports.executeBroadcast = executeBroadcast;
exports.processWhatsAppWithAI = processWhatsAppWithAI;

// Meta WhatsApp - Template Management
const { createWhatsAppTemplate, deleteWhatsAppTemplate, listPredefinedTemplates } = require('./src/integrations/meta/templateManager');
exports.createWhatsAppTemplate = createWhatsAppTemplate;
exports.deleteWhatsAppTemplate = deleteWhatsAppTemplate;
exports.listPredefinedTemplates = listPredefinedTemplates;

// Google Chat Bridge - Internal Communication
const { gchatWebhook } = require('./src/webhooks/gchatWebhook');
const { sendGChatMessage, createGChatSpace, manageGChatMembers } = require('./src/integrations/gchat/sendMessage');
const { createIncidentSpace, resolveIncidentSpace } = require('./src/integrations/gchat/incidentManager');
exports.gchatWebhook = gchatWebhook;
exports.sendGChatMessage = sendGChatMessage;
exports.createGChatSpace = createGChatSpace;
exports.manageGChatMembers = manageGChatMembers;
exports.createIncidentSpace = createIncidentSpace;
exports.resolveIncidentSpace = resolveIncidentSpace;

// Marketing Hub Functions
const { executeCampaign } = require('./src/marketing/executeCampaign');
const { trackCampaignEngagement, trackCampaignReplies } = require('./src/marketing/trackCampaignEngagement');
const { aggregateCampaignAnalytics, triggerCampaignAnalytics } = require('./src/marketing/aggregateCampaignAnalytics');
exports.executeCampaign = executeCampaign;
exports.trackCampaignEngagement = trackCampaignEngagement;
exports.trackCampaignReplies = trackCampaignReplies;
exports.aggregateCampaignAnalytics = aggregateCampaignAnalytics;
exports.triggerCampaignAnalytics = triggerCampaignAnalytics;

// EFRIS Tax Invoice Validation - Disabled until EFRIS API key is configured
// const {
//   validateEFRISInvoice,
//   verifySupplierTIN,
// } = require('./src/advisory/matflow/validateEFRISInvoice');
// exports.validateEFRISInvoice = validateEFRISInvoice;
// exports.verifySupplierTIN = verifySupplierTIN;

// Advisory - Allocation Memo Generation
const { generateAllocationMemo } = require('./src/advisory/generateAllocationMemo');
exports.generateAllocationMemo = generateAllocationMemo;

// Advisory - Receipt OCR (Cloud Vision fallback)
const { processReceiptOCR, batchProcessReceipts } = require('./src/advisory/processReceiptOCR');
exports.processReceiptOCR = processReceiptOCR;
exports.batchProcessReceipts = batchProcessReceipts;

// Advisory - AMH Report Generation
const { generateAMHReport } = require('./src/advisory/generateAMHReport');
exports.generateAMHReport = generateAMHReport;

// Market Intelligence - Digital Profile Discovery & Topic Tracking
const {
  discoverDigitalProfiles,
  scanTopicMentions,
} = require('./src/intelligence/digitalProfileDiscovery');
exports.discoverDigitalProfiles = discoverDigitalProfiles;
exports.scanTopicMentions = scanTopicMentions;

// Market Intelligence - Enhance, News, Insights, Analysis
const {
  enhanceCompetitorProfile,
  scanMarketNews,
  generateMarketInsights,
  analyzeMarketSector,
  discoverCompetitors,
} = require('./src/intelligence/marketIntelFunctions');
exports.enhanceCompetitorProfile = enhanceCompetitorProfile;
exports.scanMarketNews = scanMarketNews;
exports.generateMarketInsights = generateMarketInsights;
exports.analyzeMarketSector = analyzeMarketSector;
exports.discoverCompetitors = discoverCompetitors;

// Social Intelligence - Social Tracker, AI Analysis
const {
  syncSocialMetrics,
  fetchSocialPosts,
  analyzeSocialStrategy,
  triggerSocialSync,
} = require('./src/intelligence/socialTrackerFunctions');
exports.syncSocialMetrics = syncSocialMetrics;
exports.fetchSocialPosts = fetchSocialPosts;
exports.analyzeSocialStrategy = analyzeSocialStrategy;
exports.triggerSocialSync = triggerSocialSync;

// Marketing - Social Account registry bridge + analytics
const { onSocialMediaAccountWritten } = require('./src/marketing/registerOwnDigitalProfile');
const {
  onSocialMediaPostWritten,
  onSocialMediaAccountWrittenBQ,
} = require('./src/marketing/marketingBigQuerySync');
const { getSocialBenchmark } = require('./src/marketing/getSocialBenchmark');
exports.onSocialMediaAccountWritten = onSocialMediaAccountWritten;
exports.onSocialMediaPostWritten = onSocialMediaPostWritten;
exports.onSocialMediaAccountWrittenBQ = onSocialMediaAccountWrittenBQ;
exports.getSocialBenchmark = getSocialBenchmark;

// Marketing Phase 2 - Meta publishing + AI copy
const {
  metaOAuthStart,
  metaOAuthCallback,
  metaDisconnect,
} = require('./src/integrations/social/meta/auth');
const {
  metaDataDeletionCallback,
} = require('./src/integrations/social/meta/dataDeletionCallback');
const { socialPublisher } = require('./src/scheduled/socialPublisher');
const { generateSocialCopy } = require('./src/marketing/generateSocialCopy');
exports.metaOAuthStart = metaOAuthStart;
exports.metaOAuthCallback = metaOAuthCallback;
exports.metaDisconnect = metaDisconnect;
exports.metaDataDeletionCallback = metaDataDeletionCallback;
exports.socialPublisher = socialPublisher;
exports.generateSocialCopy = generateSocialCopy;

// Adobe PDF Services Functions
const {
  adobeCreatePdf,
  adobeExportPdf,
  adobeCombinePdf,
  adobeExtractPdf,
  adobeOcrPdf,
  adobeCompressPdf,
  adobeProtectPdf,
  adobeSplitPdf,
  adobeLinearizePdf,
  adobeWatermarkPdf,
  // v2 functions with manual CORS handling (onRequest Gen 2)
  adobeCreatePdfV2,
  adobeExtractPdfV2,
  adobeCompressPdfV2,
} = require('./src/adobe');
exports.adobeCreatePdf = adobeCreatePdf;
exports.adobeExportPdf = adobeExportPdf;
exports.adobeCombinePdf = adobeCombinePdf;
exports.adobeExtractPdf = adobeExtractPdf;
exports.adobeOcrPdf = adobeOcrPdf;
exports.adobeCompressPdf = adobeCompressPdf;
exports.adobeProtectPdf = adobeProtectPdf;
exports.adobeSplitPdf = adobeSplitPdf;
exports.adobeLinearizePdf = adobeLinearizePdf;
exports.adobeWatermarkPdf = adobeWatermarkPdf;
// v2 exports (onRequest Gen 2)
exports.adobeCreatePdfV2 = adobeCreatePdfV2;
exports.adobeExtractPdfV2 = adobeExtractPdfV2;
exports.adobeCompressPdfV2 = adobeCompressPdfV2;

// API Keys configuration
const NOTION_API_KEY = defineString('NOTION_API_KEY');
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const QUICKBOOKS_CLIENT_ID = defineSecret('QUICKBOOKS_CLIENT_ID');
const QUICKBOOKS_CLIENT_SECRET = defineSecret('QUICKBOOKS_CLIENT_SECRET');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// QuickBooks OAuth URLs
const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';
const QBO_REDIRECT_URI = 'https://us-central1-dawin-cutlist-processor.cloudfunctions.net/api/quickbooks/callback';

// Notion Database IDs
const CLIENTS_DATABASE_ID = '128a6be2745681ce8294f4b8d3a2e069';
const PROJECTS_DATABASE_ID = '128a6be27456815993acf071233e4ed3';

// Initialize Notion client (will be initialized on first request)
let notion = null;
function getNotionClient() {
  if (!notion) {
    notion = new Client({ auth: NOTION_API_KEY.value() });
  }
  return notion;
}

// Get Anthropic client - create fresh to ensure secret is loaded
function getAnthropicClient() {
  const apiKey = ANTHROPIC_API_KEY.value();
  console.log('Anthropic API key length:', apiKey ? apiKey.length : 0);
  const Anthropic = AnthropicModule.default || AnthropicModule;
  return new Anthropic({ apiKey });
}

// ============================================
// Gemini AI Configuration
// ============================================

// Initialize Google Generative AI client
let genAI = null;
function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
  }
  return genAI;
}

// Get Gemini model for design chat (Flash for speed/cost)
function getGeminiFlash() {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 4096,
      temperature: 0.7,
    },
  });
}

// Get Gemini model for strategy research (Pro for complex reasoning)
function getGeminiPro() {
  return getGenAI().getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      maxOutputTokens: 8192,
      temperature: 0.4,
    },
  });
}

// System prompts for AI assistants
const SYSTEM_PROMPTS = {
  designChat: `You are an expert furniture and millwork design consultant for Dawin Group, a custom manufacturing company in Uganda specializing in luxury hospitality, residential, and commercial projects.

CONTEXT:
- You assist designers in developing detailed specifications for custom furniture and millwork
- You have access to Dawin's Feature Library containing manufacturing capabilities
- You understand East African wood species, finishes, and hardware suppliers
- You follow AWI (Architectural Woodwork Institute) quality standards
- You have access to the current design item's parameters, overview, and context

CAPABILITIES:
1. Analyze reference images to extract design elements, materials, and proportions
2. Recommend features from the Feature Library based on client needs
3. Suggest materials appropriate for the project budget tier
4. Identify manufacturing considerations and potential challenges
5. Help document design decisions with clear rationale
6. ENRICH DESIGN ITEMS: Review current parameters and suggest improvements or missing details
7. Reference existing design item data when answering questions

DESIGN ITEM ENRICHMENT:
When a design item context is provided, you should:
- Reference the current dimensions, materials, hardware, and finish specifications
- Identify missing or incomplete parameters that should be filled in
- Suggest specific values for empty fields based on the design context
- Recommend materials, hardware, and finishes that complement each other
- Flag any inconsistencies between specifications (e.g., hardware incompatible with material thickness)
- Provide enrichment suggestions in this format:

SUGGESTED ENRICHMENTS:
- [field]: [suggested value] - [reason]

When analyzing images, structure your response as:
- Style Elements: [list identified design styles]
- Materials Detected: [list visible or inferred materials]
- Color Palette: [hex codes or descriptions]
- Suggested Features: [Feature Library recommendations]
- Manufacturing Notes: [any production considerations]
- Parameter Suggestions: [recommendations for design item fields]`,

  strategyResearch: `You are a strategic research assistant for Dawin Group, helping project managers and designers develop comprehensive project strategies for custom furniture and millwork projects.

RESEARCH CAPABILITIES:
1. Web Search: Search for current design trends, hospitality benchmarks, and industry standards
2. Space Planning: Calculate capacity ranges based on area and project type
3. Budget Analysis: Map features to budget tiers based on market positioning
4. Internal Search: Query Dawin's Feature Library for manufacturing capabilities

ALWAYS:
- Cite sources when presenting web research findings
- Provide confidence levels for recommendations
- Consider East African market context
- Reference manufacturing capabilities when discussing feasibility

SPACE PLANNING STANDARDS:
- Fine Dining: 15-20 sqft per seat
- Casual Dining: 12-15 sqft per seat
- Fast Casual: 10-12 sqft per seat
- Hotel Lobby: 25-35 sqft per seat`,
};

// Enrich Asset Data with Gemini AI (Auto-fill specs)
async function enrichAssetData(req, res) {
  const { brand, model } = req.body;

  if (!brand || !model) {
    return res.status(400).json({ error: 'Both brand and model are required' });
  }

  console.log(`Enriching asset data for: ${brand} ${model}`);

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model_ai = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      },
    });

    const prompt = `You are a Workshop Librarian specializing in woodworking and manufacturing equipment.

Search for the official technical specifications of the ${brand} ${model}.

Extract and return the following information in JSON format:

1. **specs**: Technical specifications as key-value pairs. Include:
   - Power (watts or HP)
   - Dimensions (L x W x H in mm)
   - Weight (kg)
   - RPM or speed ratings
   - Voltage requirements
   - Any other relevant technical specs

2. **manualUrl**: The official manual download URL or product documentation page. If not found, return null.

3. **productPageUrl**: The official manufacturer product page URL. If not found, return null.

4. **maintenanceTasks**: Array of 5 recommended maintenance tasks specific to this tool.

5. **maintenanceIntervalHours**: Recommended service interval in operating hours (number).

Return ONLY valid JSON matching this exact schema:
{
  "specs": { "Power": "2200W", "RPM": "24000", ... },
  "manualUrl": "https://..." or null,
  "productPageUrl": "https://..." or null,
  "maintenanceTasks": ["task1", "task2", "task3", "task4", "task5"],
  "maintenanceIntervalHours": 200
}

If you cannot find specific information, use reasonable estimates based on similar tools. Mark estimated values with "(est.)" suffix.`;

    const result = await model_ai.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let enrichedData;
    try {
      enrichedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    const normalizedData = {
      specs: enrichedData.specs || {},
      manualUrl: enrichedData.manualUrl || null,
      productPageUrl: enrichedData.productPageUrl || null,
      maintenanceTasks: Array.isArray(enrichedData.maintenanceTasks) 
        ? enrichedData.maintenanceTasks.slice(0, 5)
        : ['Inspect power cord', 'Clean air vents', 'Check fasteners', 'Lubricate moving parts', 'Test safety switches'],
      maintenanceIntervalHours: typeof enrichedData.maintenanceIntervalHours === 'number'
        ? enrichedData.maintenanceIntervalHours
        : 200,
      enrichedAt: new Date().toISOString(),
      enrichedBy: 'gemini-2.0-flash',
      searchQuery: `${brand} ${model}`,
    };

    res.json({ data: normalizedData });

  } catch (error) {
    console.error('Error enriching asset data:', error);
    res.status(500).json({ error: `Failed to enrich asset data: ${error.message}` });
  }
}

// Analyze Asset Capabilities with Gemini AI
async function analyzeAssetCapabilities(req, res) {
  const { asset } = req.body;

  if (!asset || !asset.brand || !asset.model) {
    return res.status(400).json({ error: 'Asset with brand and model is required' });
  }

  console.log(`Analyzing capabilities for: ${asset.brand} ${asset.model}`);

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
      },
    });

    const prompt = `You are a Manufacturing Capabilities Analyst for a custom millwork, furniture, and upholstery production shop.

Analyze this workshop asset and identify ALL manufacturing features/capabilities it enables:

**Asset Information:**
- Brand: ${asset.brand}
- Model: ${asset.model}
- Category: ${asset.category || 'Unknown'}
- Nickname: ${asset.nickname || 'None'}
- Specifications: ${JSON.stringify(asset.specs || {})}
- Location/Zone: ${asset.location?.zone || 'Workshop'}

**Your Task:**
Identify 3-8 specific manufacturing FEATURES this tool/machine can produce.

For each feature, provide:
1. **name**: Specific feature name (e.g., "Pocket Hole Joinery", "Dado Joint", "Edge Profile - Ogee")
2. **description**: What this feature produces and quality considerations
3. **category**: Choose ONE: JOINERY | EDGE_TREATMENT | DRILLING | SHAPING | ASSEMBLY | FINISHING | CUTTING | SPECIALTY
4. **tags**: 3-5 searchable tags
5. **estimatedMinutes**: Typical time per application
6. **complexity**: simple | moderate | complex

Return ONLY valid JSON array:
[
  {
    "name": "Feature Name",
    "description": "Detailed description...",
    "category": "CATEGORY",
    "tags": ["tag1", "tag2"],
    "estimatedMinutes": 15,
    "complexity": "moderate"
  }
]

Be specific to ${asset.brand} ${asset.model}'s actual capabilities.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    let jsonStr = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let features;
    try {
      features = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      return res.status(500).json({ error: 'Failed to parse AI response. Please try again.' });
    }

    if (!Array.isArray(features)) {
      features = [features];
    }

    const validCategories = ['JOINERY', 'EDGE_TREATMENT', 'DRILLING', 'SHAPING', 'ASSEMBLY', 'FINISHING', 'CUTTING', 'SPECIALTY'];

    const normalizedFeatures = features.map((f, index) => ({
      name: f.name || `Feature ${index + 1}`,
      description: f.description || '',
      category: validCategories.includes(f.category) ? f.category : 'SPECIALTY',
      tags: Array.isArray(f.tags) ? f.tags : [],
      estimatedMinutes: typeof f.estimatedMinutes === 'number' ? f.estimatedMinutes : 15,
      complexity: ['simple', 'moderate', 'complex'].includes(f.complexity) ? f.complexity : 'moderate',
      sourceAssetId: asset.id,
      sourceAssetName: asset.nickname || `${asset.brand} ${asset.model}`,
    }));

    console.log(`Found ${normalizedFeatures.length} capabilities for ${asset.brand} ${asset.model}`);

    res.json({
      data: {
        asset: {
          id: asset.id,
          name: asset.nickname || `${asset.brand} ${asset.model}`,
          brand: asset.brand,
          model: asset.model,
        },
        suggestedFeatures: normalizedFeatures,
        analyzedAt: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Error analyzing asset capabilities:', error);
    res.status(500).json({ error: `Failed to analyze asset: ${error.message}` });
  }
}

// Rate limiting helper using Firestore
async function checkRateLimit(userId, limitPerMinute = 10) {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const windowStart = now - windowMs;
  
  const rateLimitRef = db.collection('rateLimits').doc(userId);
  const doc = await rateLimitRef.get();
  
  if (!doc.exists) {
    await rateLimitRef.set({ requests: [now] });
    return { allowed: true, remaining: limitPerMinute - 1 };
  }
  
  const data = doc.data();
  const recentRequests = (data.requests || []).filter(t => t > windowStart);
  
  if (recentRequests.length >= limitPerMinute) {
    const oldestRequest = Math.min(...recentRequests);
    const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }
  
  recentRequests.push(now);
  await rateLimitRef.set({ requests: recentRequests });
  return { allowed: true, remaining: limitPerMinute - recentRequests.length };
}

// Helper function to verify Firebase ID token
async function verifyFirebaseToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.log('Token verification failed:', error.message);
    return null;
  }
}

// Get all customers from Notion
async function getCustomers(req, res) {
  try {
    console.log('Fetching customers from Notion database:', CLIENTS_DATABASE_ID);
    
    const data = await getNotionClient().databases.query({
      database_id: CLIENTS_DATABASE_ID,
      sorts: [{ property: 'Name', direction: 'ascending' }]
    });

    const customers = data.results.map(page => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text || 'Unnamed',
      status: page.properties.Status?.select?.name || 'Active'
    }));

    console.log(`Found ${customers.length} customers`);
    res.json({ customers });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get projects for a specific customer
async function getProjects(req, res) {
  try {
    const { customerId } = req.query;
    console.log('Fetching projects from Notion database:', PROJECTS_DATABASE_ID);

    const queryParams = {
      database_id: PROJECTS_DATABASE_ID,
      sorts: [{ property: 'Project Code', direction: 'ascending' }]
    };

    if (customerId) {
      queryParams.filter = {
        property: 'Client',
        relation: { contains: customerId }
      };
    }

    const data = await getNotionClient().databases.query(queryParams);

    const projects = data.results.map(page => ({
      id: page.id,
      name: page.properties.Name?.title?.[0]?.plain_text || 'Unnamed Project',
      projectCode: page.properties['Project Code']?.formula?.string || page.properties['Project Code']?.rich_text?.[0]?.plain_text || '',
      status: page.properties.Status?.status?.name || 'Active',
      driveFolderUrl: page.properties['📁 Google Drive Folder']?.url || ''
    }));

    console.log(`Found ${projects.length} projects`);
    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
}

// Log activity to a project page
async function logActivity(req, res) {
  try {
    const { projectId, activity, details } = req.body;
    console.log('Logging activity to project:', projectId);

    const timestamp = new Date().toISOString();
    
    await getNotionClient().comments.create({
      parent: { page_id: projectId },
      rich_text: [{
        type: 'text',
        text: {
          content: `[${timestamp}] ${activity}: ${details}`
        }
      }]
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// AI Functions
// ============================================

// System prompt for brief analysis
const BRIEF_ANALYSIS_PROMPT = `You are a design brief analyzer for a custom millwork and furniture manufacturing company (Dawin Finishes).
Extract structured information from the provided design brief.

Return a JSON object with the following structure:
{
  "extractedItems": [
    {
      "name": "Item name",
      "category": "casework|furniture|millwork|doors|fixtures|specialty",
      "description": "Brief description",
      "dimensions": {
        "width": number or null,
        "height": number or null,
        "depth": number or null,
        "unit": "mm" or "inches"
      },
      "suggestedMaterials": ["material suggestions"],
      "suggestedFinish": "finish suggestion or null",
      "specialRequirements": ["any special requirements"],
      "estimatedComplexity": "low|medium|high",
      "confidence": 0.0-1.0
    }
  ],
  "projectNotes": "Overall project notes or null",
  "ambiguities": ["List of unclear items needing clarification"],
  "clientPreferences": ["Extracted client preferences"]
}

Categories:
- casework: Cabinets, vanities, built-ins
- furniture: Tables, desks, seating
- millwork: Paneling, moldings, trim
- doors: Interior doors, frames
- fixtures: Shelving, displays
- specialty: Custom/other

IMPORTANT: Return ONLY valid JSON, no markdown or explanation.`;

// Analyze design brief using Claude
async function analyzeBrief(req, res) {
  try {
    const { briefText, projectId } = req.body;
    
    if (!briefText) {
      return res.status(400).json({ error: 'briefText is required' });
    }

    console.log('Analyzing brief for project:', projectId);
    console.log('Brief length:', briefText.length, 'characters');

    const client = getAnthropicClient();
    
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: BRIEF_ANALYSIS_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Please analyze this design brief:\n\n${briefText}`
        }
      ]
    });

    const responseText = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

    console.log('Claude response length:', responseText.length);

    // Parse JSON from response
    let result;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch (parseError) {
      console.error('Failed to parse Claude response:', parseError);
      result = {
        extractedItems: [],
        projectNotes: 'Failed to parse AI response',
        ambiguities: ['AI response format error - please try again'],
        clientPreferences: []
      };
    }

    // Store analysis in Firestore if projectId provided
    if (projectId && result) {
      try {
        await db.collection('designProjects').doc(projectId).collection('aiAnalyses').add({
          analysisType: 'brief-parsing',
          inputData: { briefText: briefText.substring(0, 1000) }, // Store first 1000 chars
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          result,
          confidence: result.extractedItems?.[0]?.confidence || null
        });
        console.log('Analysis saved to Firestore');
      } catch (dbError) {
        console.error('Failed to save analysis to Firestore:', dbError);
      }
    }

    res.json({ 
      success: true, 
      result,
      usage: {
        inputTokens: message.usage?.input_tokens,
        outputTokens: message.usage?.output_tokens
      }
    });

  } catch (error) {
    console.error('Error analyzing brief:', error);
    res.status(500).json({ 
      error: error.message,
      details: error.status ? `API Status: ${error.status}` : undefined
    });
  }
}

// DfM Rules Engine
const DFM_RULES = [
  {
    id: 'min-panel-thickness',
    category: 'material',
    check: (params) => {
      if (params.dimensions?.width > 600 && params.primaryMaterial?.thickness < 18) {
        return {
          severity: 'warning',
          description: 'Panel width exceeds 600mm with thickness under 18mm. Risk of sagging.',
          suggestedFix: 'Increase panel thickness to 18mm or add support rails.',
        };
      }
      return null;
    },
  },
  {
    id: 'inside-corner-radius',
    category: 'tool-access',
    check: (params) => {
      if (params.insideCornerRadius !== undefined && params.insideCornerRadius < 6) {
        return {
          severity: 'error',
          description: 'Inside corner radius less than 6mm cannot be achieved with standard router bits.',
          suggestedFix: 'Specify minimum 6mm inside corner radius or use chisel cleanup.',
        };
      }
      return null;
    },
  },
  {
    id: 'grain-direction-structure',
    category: 'material',
    check: (params) => {
      if (params.primaryMaterial?.grainDirection && 
          params.constructionMethod === 'solid-wood' &&
          !params.grainDirectionSpecified) {
        return {
          severity: 'warning',
          description: 'Solid wood construction with grain-sensitive material but grain direction not specified.',
          suggestedFix: 'Specify grain direction for structural integrity.',
        };
      }
      return null;
    },
  },
  {
    id: 'drawer-slide-clearance',
    category: 'hardware',
    check: (params) => {
      const slides = params.hardware?.filter(h => h.category === 'slides');
      if (slides?.length && params.dimensions?.depth) {
        const availableDepth = params.dimensions.depth - 25.4;
        if (availableDepth < 300) {
          return {
            severity: 'info',
            description: 'Drawer depth after slide clearance is under 300mm. Verify slide compatibility.',
            suggestedFix: 'Confirm selected slides fit within available depth.',
          };
        }
      }
      return null;
    },
  },
  {
    id: 'edge-banding-thickness-match',
    category: 'material',
    check: (params) => {
      if (params.edgeBanding && params.primaryMaterial) {
        if (params.edgeBanding.thickness > params.primaryMaterial.thickness) {
          return {
            severity: 'error',
            description: 'Edge banding thickness exceeds panel thickness.',
            suggestedFix: 'Select edge banding with thickness ≤ panel thickness.',
          };
        }
      }
      return null;
    },
  },
  {
    id: 'minimum-dimension-check',
    category: 'material',
    check: (params) => {
      const dims = params.dimensions;
      if (dims) {
        if ((dims.width && dims.width < 50) || (dims.height && dims.height < 50) || (dims.depth && dims.depth < 50)) {
          return {
            severity: 'warning',
            description: 'One or more dimensions are under 50mm which may be difficult to manufacture.',
            suggestedFix: 'Review dimensions - very small parts may require special handling.',
          };
        }
      }
      return null;
    },
  },
  {
    id: 'hardware-quantity-check',
    category: 'hardware',
    check: (params) => {
      const hinges = params.hardware?.filter(h => h.category === 'hinges');
      if (hinges?.length === 1 && hinges[0].quantity < 2) {
        return {
          severity: 'warning',
          description: 'Single hinge specified - doors typically require at least 2 hinges.',
          suggestedFix: 'Add additional hinges for proper door support.',
        };
      }
      return null;
    },
  },
  {
    id: 'finish-compatibility',
    category: 'finish',
    check: (params) => {
      if (params.finish?.type === 'paint' && params.primaryMaterial?.type === 'veneer') {
        return {
          severity: 'info',
          description: 'Paint finish specified on veneer material - this will cover the wood grain.',
          suggestedFix: 'Consider stain or clear finish to preserve veneer appearance, or use different substrate for paint.',
        };
      }
      return null;
    },
  }
];

// Run DfM check
async function runDfMCheck(req, res) {
  try {
    const { designItemId, projectId, parameters } = req.body;
    
    if (!parameters) {
      return res.status(400).json({ error: 'parameters object is required' });
    }

    console.log('Running DfM check for item:', designItemId);

    const issues = [];
    
    // Run all rules
    for (const rule of DFM_RULES) {
      try {
        const result = rule.check(parameters);
        if (result) {
          issues.push({
            ...result,
            category: rule.category,
            ruleId: rule.id,
          });
        }
      } catch (ruleError) {
        console.error(`Rule ${rule.id} failed:`, ruleError);
      }
    }

    // Sort by severity
    const severityOrder = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Store analysis in Firestore if projectId provided
    if (projectId && designItemId) {
      try {
        await db.collection('designProjects').doc(projectId).collection('aiAnalyses').add({
          analysisType: 'dfm-check',
          designItemId,
          inputData: parameters,
          requestedAt: admin.firestore.FieldValue.serverTimestamp(),
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          result: { issues },
          dfmIssues: issues
        });
        console.log('DfM analysis saved to Firestore');
      } catch (dbError) {
        console.error('Failed to save DfM analysis to Firestore:', dbError);
      }
    }

    res.json({ 
      success: true, 
      issues,
      summary: {
        total: issues.length,
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
      }
    });

  } catch (error) {
    console.error('Error running DfM check:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// Notion Integration for Milestones
// ============================================

/**
 * Sync a milestone update to Notion project page
 */
async function syncMilestoneToNotion(req, res) {
  try {
    const { projectId, milestone, designItem, stage, notes } = req.body;
    
    if (!projectId || !milestone) {
      return res.status(400).json({ error: 'projectId and milestone are required' });
    }

    console.log('Syncing milestone to Notion:', milestone, 'for project:', projectId);

    // Get project to find Notion page ID
    const projectDoc = await db.collection('designProjects').doc(projectId).get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectDoc.data();
    const notionPageId = project.notionPageId;

    if (!notionPageId) {
      // No Notion page linked - just log and return success
      console.log('No Notion page linked to project');
      return res.json({ 
        success: true, 
        synced: false,
        message: 'No Notion page linked to project',
      });
    }

    // Create milestone update comment on Notion page
    const timestamp = new Date().toISOString();
    const milestoneText = designItem 
      ? `[${timestamp}] ${milestone}: ${designItem.name} moved to ${stage}${notes ? ` - ${notes}` : ''}`
      : `[${timestamp}] ${milestone}${notes ? `: ${notes}` : ''}`;

    await getNotionClient().comments.create({
      parent: { page_id: notionPageId },
      rich_text: [{
        type: 'text',
        text: { content: milestoneText },
      }],
    });

    console.log('Milestone synced to Notion');

    res.json({ 
      success: true, 
      synced: true,
      message: 'Milestone synced to Notion',
    });

  } catch (error) {
    console.error('Error syncing milestone to Notion:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// Firestore Triggers - Automatic Syncs
// ============================================

/**
 * Sync milestone to Notion when design item stage changes
 * Triggered on any design item update
 */
exports.onDesignItemUpdate = onDocumentUpdated({
  document: 'designProjects/{projectId}/designItems/{itemId}',
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  const { projectId, itemId } = event.params;

  // Check if stage changed to production-ready - sync milestone to Notion
  if (before.currentStage !== 'production-ready' && after.currentStage === 'production-ready') {
    console.log(`Design item ${itemId} reached production-ready`);

    try {
      // Sync milestone to Notion if project has a linked page
      const projectDoc = await db.collection('designProjects').doc(projectId).get();
      if (projectDoc.exists && projectDoc.data().notionPageId) {
        const notionPageId = projectDoc.data().notionPageId;
        const milestoneText = `[${new Date().toISOString()}] PRODUCTION RELEASE: ${after.name} (${after.itemCode}) is now production-ready`;

        try {
          await getNotionClient().comments.create({
            parent: { page_id: notionPageId },
            rich_text: [{
              type: 'text',
              text: { content: milestoneText },
            }],
          });
          console.log('Milestone synced to Notion');
        } catch (notionError) {
          console.error('Notion sync failed:', notionError.message);
        }
      }

    } catch (error) {
      console.error('Error in production-ready sync:', error);
    }
  }

  // Check if stage changed (any transition) - sync milestone to Notion
  if (before.currentStage !== after.currentStage) {
    console.log(`Stage transition: ${before.currentStage} → ${after.currentStage}`);

    try {
      const projectDoc = await db.collection('designProjects').doc(projectId).get();
      if (projectDoc.exists && projectDoc.data().notionPageId) {
        const notionPageId = projectDoc.data().notionPageId;
        const milestoneText = `[${new Date().toISOString()}] Stage Update: ${after.name} moved from ${before.currentStage} to ${after.currentStage}`;

        try {
          await getNotionClient().comments.create({
            parent: { page_id: notionPageId },
            rich_text: [{
              type: 'text',
              text: { content: milestoneText },
            }],
          });
          console.log('Stage milestone synced to Notion');
        } catch (notionError) {
          console.error('Notion milestone sync failed:', notionError.message);
        }
      }
    } catch (error) {
      console.error('Error syncing stage milestone:', error);
    }
  }
});

// ============================================
// QuickBooks Integration
// ============================================

/**
 * Get QuickBooks OAuth authorization URL
 */
async function getQuickBooksAuthUrl(req, res) {
  try {
    const clientId = QUICKBOOKS_CLIENT_ID.value();
    if (!clientId) {
      return res.status(500).json({ error: 'QuickBooks not configured' });
    }

    const state = Buffer.from(JSON.stringify({
      timestamp: Date.now(),
    })).toString('base64');

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'com.intuit.quickbooks.accounting',
      redirect_uri: QBO_REDIRECT_URI,
      state,
    });

    res.json({ url: `${QBO_AUTH_URL}?${params.toString()}` });
  } catch (error) {
    console.error('Error generating QuickBooks auth URL:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle QuickBooks OAuth callback
 */
async function handleQuickBooksCallback(req, res) {
  const { code, state, realmId, error } = req.query;

  if (error) {
    console.error('QuickBooks OAuth error:', error);
    return res.redirect('/customers?qb_error=auth_failed');
  }

  if (!code || !realmId) {
    return res.redirect('/customers?qb_error=missing_params');
  }

  try {
    const clientId = QUICKBOOKS_CLIENT_ID.value();
    const clientSecret = QUICKBOOKS_CLIENT_SECRET.value();

    // Exchange code for tokens
    const tokenResponse = await fetch(QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: QBO_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json();

    // Store tokens in Firestore
    await db.collection('integrations').doc('quickbooks').set({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      x_refresh_token_expires_in: tokens.x_refresh_token_expires_in,
      realm_id: realmId,
      created_at: Date.now(),
      connected_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('QuickBooks connected successfully');
    res.redirect('/customers?qb_success=true');
  } catch (err) {
    console.error('QuickBooks callback error:', err);
    res.redirect('/customers?qb_error=token_exchange');
  }
}

/**
 * Get QuickBooks connection status
 */
async function getQuickBooksStatus(req, res) {
  try {
    const doc = await db.collection('integrations').doc('quickbooks').get();
    if (!doc.exists) {
      return res.json({ connected: false });
    }

    const data = doc.data();
    const refreshExpiresAt = data.created_at + (data.x_refresh_token_expires_in * 1000);

    res.json({
      connected: true,
      realmId: data.realm_id,
      refreshTokenValid: Date.now() < refreshExpiresAt,
    });
  } catch (error) {
    console.error('Error checking QuickBooks status:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Refresh QuickBooks tokens if needed
 */
async function refreshQuickBooksTokens() {
  const doc = await db.collection('integrations').doc('quickbooks').get();
  if (!doc.exists) {
    throw new Error('QuickBooks not connected');
  }

  const tokens = doc.data();
  const expiresAt = tokens.created_at + (tokens.expires_in * 1000);

  // Return existing tokens if still valid (with 5 min buffer)
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return tokens;
  }

  // Refresh the token
  const clientId = QUICKBOOKS_CLIENT_ID.value();
  const clientSecret = QUICKBOOKS_CLIENT_SECRET.value();

  const response = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const newTokens = await response.json();

  const updatedTokens = {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_in: newTokens.expires_in,
    x_refresh_token_expires_in: newTokens.x_refresh_token_expires_in,
    realm_id: tokens.realm_id,
    created_at: Date.now(),
  };

  await db.collection('integrations').doc('quickbooks').update(updatedTokens);

  return updatedTokens;
}

/**
 * Make authenticated request to QuickBooks API
 */
async function qboRequest(endpoint, options = {}) {
  const tokens = await refreshQuickBooksTokens();

  const response = await fetch(
    `${QBO_API_BASE}/${tokens.realm_id}${endpoint}`,
    {
      ...options,
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers,
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Sync customer to QuickBooks
 */

/**
 * Import customers FROM QuickBooks into this tool
 */
async function importCustomersFromQuickBooks(req, res) {
  try {
    // Query all active customers from QuickBooks
    const query = encodeURIComponent("SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000");
    const data = await qboRequest(`/query?query=${query}`);
    const qbCustomers = data.QueryResponse?.Customer || [];
    
    const results = {
      total: qbCustomers.length,
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Get next customer number for new imports
    const existingCustomers = await db.collection('customers').get();
    let maxNumber = 0;
    existingCustomers.docs.forEach((doc) => {
      const code = doc.data().code || '';
      const match = code.match(/DF-CUS-(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });

    for (const qbCustomer of qbCustomers) {
      try {
        // Check if customer already exists by QuickBooks ID
        const existingQuery = await db.collection('customers')
          .where('externalIds.quickbooksId', '==', qbCustomer.Id)
          .get();

        if (!existingQuery.empty) {
          // Update existing customer
          const existingDoc = existingQuery.docs[0];
          await db.collection('customers').doc(existingDoc.id).update({
            name: qbCustomer.DisplayName || qbCustomer.CompanyName || 'Unknown',
            email: qbCustomer.PrimaryEmailAddr?.Address || null,
            phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
            billingAddress: qbCustomer.BillAddr ? {
              street1: qbCustomer.BillAddr.Line1 || '',
              street2: qbCustomer.BillAddr.Line2 || '',
              city: qbCustomer.BillAddr.City || '',
              state: qbCustomer.BillAddr.CountrySubDivisionCode || '',
              postalCode: qbCustomer.BillAddr.PostalCode || '',
              country: qbCustomer.BillAddr.Country || 'Kenya',
            } : null,
            'syncStatus.quickbooks': 'synced',
            'syncStatus.quickbooksLastSync': admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'quickbooks_import',
          });
          results.updated++;
        } else {
          // Create new customer
          maxNumber++;
          const customerCode = `DF-CUS-${maxNumber.toString().padStart(3, '0')}`;
          
          await db.collection('customers').add({
            code: customerCode,
            name: qbCustomer.DisplayName || qbCustomer.CompanyName || 'Unknown',
            type: qbCustomer.CompanyName ? 'commercial' : 'residential',
            status: 'active',
            email: qbCustomer.PrimaryEmailAddr?.Address || null,
            phone: qbCustomer.PrimaryPhone?.FreeFormNumber || null,
            website: qbCustomer.WebAddr?.URI || null,
            billingAddress: qbCustomer.BillAddr ? {
              street1: qbCustomer.BillAddr.Line1 || '',
              street2: qbCustomer.BillAddr.Line2 || '',
              city: qbCustomer.BillAddr.City || '',
              state: qbCustomer.BillAddr.CountrySubDivisionCode || '',
              postalCode: qbCustomer.BillAddr.PostalCode || '',
              country: qbCustomer.BillAddr.Country || 'Kenya',
            } : null,
            contacts: [],
            externalIds: {
              quickbooksId: qbCustomer.Id,
            },
            syncStatus: {
              quickbooks: 'synced',
              quickbooksLastSync: admin.firestore.FieldValue.serverTimestamp(),
            },
            notes: qbCustomer.Notes || '',
            tags: ['imported-from-quickbooks'],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'quickbooks_import',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'quickbooks_import',
          });
          results.imported++;
        }
      } catch (err) {
        results.errors.push({ qbId: qbCustomer.Id, name: qbCustomer.DisplayName, error: err.message });
      }
    }

    // Log import results
    await db.collection('syncLogs').add({
      type: 'quickbooks_import',
      results,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ success: true, results });
  } catch (error) {
    console.error('QuickBooks import error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// Gemini AI Handlers
// ============================================

/**
 * Handle Design Chat - Conversational AI for design consultation
 * Uses Gemini Flash for speed and cost efficiency
 */
async function handleDesignChat(req, res) {
  try {
    const { 
      designItemId, 
      projectId,
      message, 
      imageData, 
      conversationHistory = [],
      userId 
    } = req.body;

    if (!message && !imageData) {
      return res.status(400).json({ error: 'Message or imageData is required' });
    }

    // Rate limiting
    if (userId) {
      const rateCheck = await checkRateLimit(userId, 20);
      if (!rateCheck.allowed) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded', 
          retryAfter: rateCheck.retryAfter,
          message: `Too many requests. Please wait ${rateCheck.retryAfter} seconds.`
        });
      }
    }

    console.log('Design Chat request:', { designItemId, projectId, hasImage: !!imageData });

    const model = getGeminiFlash();

    // Gap-7: Get cached Feature Library context
    const featureContext = await getCachedFeatureContext();
    
    // Gap-7: Get project-specific RAG context
    const projectContext = projectId ? await getProjectContextForAI(projectId) : null;

    // NEW: Get design item context for enrichment
    let designItemContext = null;
    if (designItemId && projectId) {
      designItemContext = await getDesignItemContextForAI(projectId, designItemId);
    }

    // Build conversation parts
    const parts = [];
    
    // Add system instruction
    parts.push({ text: SYSTEM_PROMPTS.designChat });
    
    // Add Feature Library context if available
    if (featureContext) {
      parts.push({ text: `\n\nDAWIN FEATURE LIBRARY (use for recommendations):\n${featureContext}` });
    }
    
    // Gap-7: Add project-specific RAG context
    if (projectContext) {
      parts.push({ text: `\n\nPROJECT CONTEXT (use for personalized responses):\n${JSON.stringify(projectContext, null, 2)}` });
    }

    // NEW: Add design item context for enrichment suggestions
    if (designItemContext) {
      parts.push({ text: `\n\nCURRENT DESIGN ITEM (reference this and suggest enrichments where needed):\n${JSON.stringify(designItemContext, null, 2)}` });
    }

    // Add conversation history (last 10 messages)
    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      parts.push({ text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}` });
    }

    // Add current message
    if (message) {
      parts.push({ text: `User: ${message}` });
    }

    // Add image if provided (base64)
    if (imageData) {
      const imageMatch = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (imageMatch) {
        parts.push({
          inlineData: {
            mimeType: `image/${imageMatch[1]}`,
            data: imageMatch[2],
          },
        });
        if (!message) {
          parts.push({ text: 'User: Please analyze this image for furniture/millwork design.' });
        }
      }
    }

    // Generate response
    const result = await model.generateContent({
      contents: [{ role: 'user', parts }],
    });

    const response = result.response;
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = response.usageMetadata || {};

    // Parse image analysis if present
    let imageAnalysis = null;
    if (imageData && responseText.includes('Style Elements:')) {
      imageAnalysis = parseImageAnalysis(responseText);
    }

    // Extract feature recommendations
    const featureRecommendations = extractFeatureRecommendations(responseText);

    // Save conversation to Firestore if designItemId provided
    if (designItemId && projectId) {
      try {
        const conversationRef = db.collection('designItemConversations').doc(designItemId);
        const conversationDoc = await conversationRef.get();
        
        const newMessages = [
          { role: 'user', content: message || '[Image uploaded]', timestamp: admin.firestore.FieldValue.serverTimestamp() },
          { role: 'assistant', content: responseText, timestamp: admin.firestore.FieldValue.serverTimestamp(), metadata: { imageAnalysis, featureRecommendations, modelUsed: 'gemini-1.5-flash-002' } },
        ];

        if (conversationDoc.exists) {
          await conversationRef.update({
            messages: admin.firestore.FieldValue.arrayUnion(...newMessages),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          await conversationRef.set({
            designItemId,
            projectId,
            messages: newMessages,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
      }
    }

    res.json({
      success: true,
      text: responseText,
      imageAnalysis,
      featureRecommendations,
      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        modelUsed: 'gemini-1.5-flash-002',
      },
    });

  } catch (error) {
    console.error('Design Chat error:', error);
    res.status(500).json({ 
      error: 'AI processing failed',
      details: error.message,
    });
  }
}

/**
 * Handle Design Chat with Streaming - SSE for real-time responses
 * Gap-4: Streaming implementation for better UX
 */
async function handleDesignChatStream(req, res) {
  try {
    const { 
      designItemId, 
      projectId,
      message, 
      imageData, 
      conversationHistory = [],
      userId 
    } = req.body;

    if (!message && !imageData) {
      return res.status(400).json({ error: 'Message or imageData is required' });
    }

    // Rate limiting
    if (userId) {
      const rateCheck = await checkRateLimit(userId, 20);
      if (!rateCheck.allowed) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded', 
          retryAfter: rateCheck.retryAfter,
        });
      }
    }

    console.log('Design Chat Stream request:', { designItemId, projectId, hasImage: !!imageData });

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const model = getGeminiFlash();
    const featureContext = await getCachedFeatureContext();
    
    // Gap-7: Get project-specific RAG context
    const projectContext = projectId ? await getProjectContextForAI(projectId) : null;

    // Get design item context for enrichment
    let designItemContext = null;
    if (designItemId && projectId) {
      designItemContext = await getDesignItemContextForAI(projectId, designItemId);
    }

    // Build conversation parts
    const parts = [];
    parts.push({ text: SYSTEM_PROMPTS.designChat });
    
    if (featureContext) {
      parts.push({ text: `\n\nDAWIN FEATURE LIBRARY (use for recommendations):\n${featureContext}` });
    }
    
    // Gap-7: Add project-specific RAG context
    if (projectContext) {
      parts.push({ text: `\n\nPROJECT CONTEXT (use for personalized responses):\n${JSON.stringify(projectContext, null, 2)}` });
    }

    // Add design item context for enrichment suggestions
    if (designItemContext) {
      parts.push({ text: `\n\nCURRENT DESIGN ITEM (reference this and suggest enrichments where needed):\n${JSON.stringify(designItemContext, null, 2)}` });
    }

    const recentHistory = conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      parts.push({ text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}` });
    }

    if (message) {
      parts.push({ text: `User: ${message}` });
    }

    if (imageData) {
      const imageMatch = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
      if (imageMatch) {
        parts.push({
          inlineData: {
            mimeType: `image/${imageMatch[1]}`,
            data: imageMatch[2],
          },
        });
        if (!message) {
          parts.push({ text: 'User: Please analyze this image for furniture/millwork design.' });
        }
      }
    }

    // Stream the response
    let fullResponse = '';
    const streamResult = await model.generateContentStream({
      contents: [{ role: 'user', parts }],
    });

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        fullResponse += chunkText;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunkText })}\n\n`);
      }
    }

    // Get final response metadata
    const response = await streamResult.response;
    const usageMetadata = response.usageMetadata || {};

    // Parse analysis and recommendations
    const imageAnalysis = imageData && fullResponse.includes('Style Elements:') 
      ? parseImageAnalysis(fullResponse) 
      : null;
    const featureRecommendations = extractFeatureRecommendations(fullResponse);

    // Save conversation to Firestore
    if (designItemId && projectId) {
      try {
        const conversationRef = db.collection('designItemConversations').doc(designItemId);
        const conversationDoc = await conversationRef.get();
        
        const newMessages = [
          { role: 'user', content: message || '[Image uploaded]', timestamp: admin.firestore.FieldValue.serverTimestamp() },
          { role: 'assistant', content: fullResponse, timestamp: admin.firestore.FieldValue.serverTimestamp(), metadata: { imageAnalysis, featureRecommendations, modelUsed: 'gemini-2.0-flash', streaming: true } },
        ];

        if (conversationDoc.exists) {
          await conversationRef.update({
            messages: admin.firestore.FieldValue.arrayUnion(...newMessages),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          await conversationRef.set({
            designItemId,
            projectId,
            messages: newMessages,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
      }
    }

    // Send final event with metadata
    res.write(`data: ${JSON.stringify({ 
      type: 'done', 
      imageAnalysis,
      featureRecommendations,
      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        modelUsed: 'gemini-2.0-flash',
      }
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('Design Chat Stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
}

/**
 * Handle Strategy Research - AI for project strategy with web search
 * Uses Gemini Pro for complex reasoning
 */
async function handleStrategyResearch(req, res) {
  try {
    const { 
      query, 
      projectId,
      projectContext,
      enableWebSearch = false,
      userId,
      companyId,
    } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Rate limiting (stricter for Pro model)
    if (userId) {
      const rateCheck = await checkRateLimit(userId, 10);
      if (!rateCheck.allowed) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded', 
          retryAfter: rateCheck.retryAfter,
        });
      }
    }

    console.log('Strategy Research request:', { projectId, enableWebSearch });

    const model = getGeminiPro();

    // Get cached Feature Library context
    const featureContext = await getCachedFeatureContext();

    // Load business memory context (non-blocking)
    let memoryPrompt = '';
    let memoryCount = 0;
    if (companyId) {
      try {
        const memCtx = await loadMemoryContext(companyId, 'strategy_research', 10);
        memoryPrompt = memCtx.prompt;
        memoryCount = memCtx.count;
        if (memoryCount > 0) {
          console.log(`Strategy Research REST: ${memoryCount} business memories loaded`);
        }
      } catch (err) {
        console.warn('Memory load failed (non-blocking):', err.message);
      }
    }

    // Build prompt with context
    let fullPrompt = SYSTEM_PROMPTS.strategyResearch + '\n\n';

    // Inject business memory if available
    if (memoryPrompt) {
      fullPrompt += memoryPrompt + '\n\n';
    }
    
    // Add Feature Library context if available
    if (featureContext) {
      fullPrompt += `DAWIN FEATURE LIBRARY (reference for feasibility):\n${featureContext}\n\n`;
    }
    
    if (projectContext) {
      fullPrompt += `PROJECT CONTEXT:\n${JSON.stringify(projectContext, null, 2)}\n\n`;
    }
    
    fullPrompt += `USER QUERY: ${query}`;

    // Generate response
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });

    const response = result.response;
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = response.usageMetadata || {};

    // Save research to Firestore if projectId provided
    if (projectId) {
      try {
        await db.collection('projectStrategy').doc(projectId).collection('research').add({
          query,
          response: responseText,
          enableWebSearch,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          usageMetadata: {
            inputTokens: usageMetadata.promptTokenCount || 0,
            outputTokens: usageMetadata.candidatesTokenCount || 0,
          },
        });
      } catch (saveError) {
        console.error('Error saving research:', saveError);
      }
    }

    res.json({
      success: true,
      text: responseText,
      sources: [], // Web search grounding would populate this
      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        groundedPrompt: enableWebSearch,
        modelUsed: 'gemini-1.5-pro-002',
      },
    });

  } catch (error) {
    console.error('Strategy Research error:', error);
    res.status(500).json({ 
      error: 'AI processing failed',
      details: error.message,
    });
  }
}

/**
 * Handle Image Analysis - Multimodal analysis for reference images
 * Uses Gemini Flash for image processing
 */
async function handleImageAnalysis(req, res) {
  try {
    const { imageData, analysisType = 'design', userId } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: 'imageData is required' });
    }

    // Rate limiting
    if (userId) {
      const rateCheck = await checkRateLimit(userId, 15);
      if (!rateCheck.allowed) {
        return res.status(429).json({ 
          error: 'Rate limit exceeded', 
          retryAfter: rateCheck.retryAfter,
        });
      }
    }

    console.log('Image Analysis request:', { analysisType });

    const model = getGeminiFlash();

    // Parse base64 image
    const imageMatch = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!imageMatch) {
      return res.status(400).json({ error: 'Invalid image format. Expected base64 data URL.' });
    }

    const prompt = analysisType === 'design' 
      ? `Analyze this furniture or interior design image. Provide:
1. Style Elements: Identify design styles (modern, traditional, etc.)
2. Materials Detected: List visible materials (wood species, metals, fabrics)
3. Color Palette: Extract dominant colors with hex codes
4. Construction Details: Note joinery, hardware, finishes visible
5. Manufacturing Notes: Considerations for reproducing this design
6. Suggested Features: What Dawin manufacturing capabilities would be needed`
      : `Analyze this reference image for design inspiration. Describe what you see in detail.`;

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: `image/${imageMatch[1]}`,
              data: imageMatch[2],
            },
          },
        ],
      }],
    });

    const response = result.response;
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = response.usageMetadata || {};

    // Parse structured analysis
    const analysis = parseImageAnalysis(responseText);

    res.json({
      success: true,
      text: responseText,
      analysis,
      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        modelUsed: 'gemini-1.5-flash-002',
      },
    });

  } catch (error) {
    console.error('Image Analysis error:', error);
    res.status(500).json({ 
      error: 'Image analysis failed',
      details: error.message,
    });
  }
}

/**
 * Parse image analysis response into structured format
 */
function parseImageAnalysis(text) {
  const analysis = {
    styleElements: [],
    detectedMaterials: [],
    colorPalette: [],
    constructionDetails: [],
    suggestedFeatures: [],
  };

  // Extract style elements
  const styleMatch = text.match(/Style Elements?:([^\n]+(?:\n(?!Materials|Color|Construction|Manufacturing|Suggested)[^\n]+)*)/i);
  if (styleMatch) {
    analysis.styleElements = styleMatch[1].split(/[,\n]/).map(s => s.trim()).filter(s => s && s !== '-');
  }

  // Extract materials
  const materialsMatch = text.match(/Materials? (?:Detected|Visible)?:([^\n]+(?:\n(?!Color|Construction|Manufacturing|Suggested|Style)[^\n]+)*)/i);
  if (materialsMatch) {
    analysis.detectedMaterials = materialsMatch[1].split(/[,\n]/).map(s => s.trim()).filter(s => s && s !== '-');
  }

  // Extract color palette
  const colorMatch = text.match(/Color Palette:([^\n]+(?:\n(?!Construction|Manufacturing|Suggested|Style|Materials)[^\n]+)*)/i);
  if (colorMatch) {
    const colors = colorMatch[1].match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g);
    if (colors) {
      analysis.colorPalette = colors;
    }
  }

  // Extract suggested features
  const featuresMatch = text.match(/Suggested Features?:([^\n]+(?:\n(?!Style|Materials|Color|Construction|Manufacturing)[^\n]+)*)/i);
  if (featuresMatch) {
    analysis.suggestedFeatures = featuresMatch[1].split(/[,\n]/).map(s => s.trim()).filter(s => s && s !== '-');
  }

  return analysis;
}

/**
 * Extract feature recommendations from AI response
 */
function extractFeatureRecommendations(text) {
  const recommendations = [];
  
  // Look for Feature Library references
  const featurePatterns = [
    /recommend(?:ed|s)?[:\s]+([^.]+)/gi,
    /suggest(?:ed|s)?[:\s]+([^.]+)/gi,
    /consider[:\s]+([^.]+)/gi,
  ];

  for (const pattern of featurePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const rec = match[1].trim();
      if (rec.length > 5 && rec.length < 100 && !recommendations.includes(rec)) {
        recommendations.push(rec);
      }
    }
  }

  return recommendations.slice(0, 5);
}

/**
 * Gap-1: Cutlist AI Analysis
 * Analyzes cutlist/parts data and provides optimization suggestions
 */
async function analyzeCutlistWithAI(req, res) {
  try {
    const { projectId, parts, materials, analysisType = 'full' } = req.body;

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      return res.status(400).json({ error: 'Parts array is required' });
    }

    console.log('Cutlist AI Analysis:', { projectId, partsCount: parts.length, analysisType });

    const model = getGeminiFlash();
    const featureContext = await getCachedFeatureContext();

    // Build analysis prompt
    const prompt = `You are a Manufacturing Optimization Expert for custom millwork and cabinet production.

Analyze this cutlist and provide actionable insights:

**PARTS DATA (${parts.length} parts):**
${JSON.stringify(parts.slice(0, 50), null, 2)}

**MATERIALS:**
${materials ? JSON.stringify(materials, null, 2) : 'Not specified'}

${featureContext ? `**AVAILABLE FEATURES:**\n${featureContext}` : ''}

**ANALYSIS TYPE:** ${analysisType}

Provide analysis in this JSON structure:
{
  "summary": {
    "totalParts": number,
    "uniqueMaterials": number,
    "estimatedSheets": number,
    "complexityScore": "low|medium|high"
  },
  "optimizations": [
    {
      "type": "material|dimension|grain|grouping",
      "title": "string",
      "description": "string",
      "impact": "high|medium|low",
      "savings": "string (optional)"
    }
  ],
  "dfmWarnings": [
    {
      "severity": "error|warning|info",
      "partIds": ["string"],
      "issue": "string",
      "recommendation": "string"
    }
  ],
  "materialRecommendations": [
    {
      "currentMaterial": "string",
      "suggestedMaterial": "string",
      "reason": "string"
    }
  ],
  "nestingTips": ["string"]
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = result.response.usageMetadata || {};

    // Parse JSON from response
    let analysis = null;
    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse cutlist analysis:', parseError);
    }

    // Save analysis to project if projectId provided
    if (projectId && analysis) {
      try {
        await db.collection('designProjects').doc(projectId).update({
          'optimizationState.aiAnalysis': {
            ...analysis,
            analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
            partsAnalyzed: parts.length,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (saveError) {
        console.error('Error saving cutlist analysis:', saveError);
      }
    }

    res.json({
      success: true,
      analysis: analysis || { raw: responseText },
      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        modelUsed: 'gemini-2.0-flash',
      },
    });

  } catch (error) {
    console.error('Cutlist AI Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Gap-2: Customer Intelligence
 * Analyzes customer history and provides insights for personalization
 */
async function getCustomerIntelligence(req, res) {
  try {
    const { customerId, includeProjectHistory = true } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }

    console.log('Customer Intelligence:', { customerId, includeProjectHistory });

    // Get customer data
    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const customer = customerDoc.data();

    // Get customer's project history
    let projectHistory = [];
    if (includeProjectHistory) {
      const projectsSnapshot = await db.collection('designProjects')
        .where('customerId', '==', customerId)
        .orderBy('createdAt', 'desc')
        .limit(10)
        .get();
      
      for (const doc of projectsSnapshot.docs) {
        const project = doc.data();
        projectHistory.push({
          id: doc.id,
          name: project.name,
          code: project.code,
          status: project.status,
          stage: project.stage,
          totalValue: project.budget?.total,
          materialsUsed: project.materialPalette?.entries?.map(m => m.designName) || [],
          completedAt: project.completedAt,
        });
      }
    }

    const model = getGeminiFlash();

    const prompt = `You are a Customer Success Analyst for a custom millwork and cabinet manufacturing company.

Analyze this customer and provide actionable intelligence:

**CUSTOMER:**
- Name: ${customer.name}
- Segment: ${customer.segment || 'Unknown'}
- Contact: ${customer.email || 'N/A'}
- Notes: ${customer.notes?.substring(0, 500) || 'None'}
- Tags: ${(customer.tags || []).join(', ') || 'None'}

**PROJECT HISTORY (${projectHistory.length} projects):**
${JSON.stringify(projectHistory, null, 2)}

Provide intelligence in this JSON structure:
{
  "customerProfile": {
    "preferredStyles": ["string"],
    "preferredMaterials": ["string"],
    "pricePoint": "budget|mid-range|premium|luxury",
    "communicationPreference": "string",
    "decisionMakingStyle": "string"
  },
  "insights": [
    {
      "type": "pattern|opportunity|risk",
      "title": "string",
      "description": "string",
      "confidence": "high|medium|low"
    }
  ],
  "recommendations": [
    {
      "action": "string",
      "reason": "string",
      "priority": "high|medium|low"
    }
  ],
  "upsellOpportunities": ["string"],
  "lifetimeValueEstimate": "string",
  "nextBestAction": "string"
}`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usageMetadata = result.response.usageMetadata || {};

    // Parse JSON from response
    let intelligence = null;
    try {
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                        responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intelligence = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('Failed to parse customer intelligence:', parseError);
    }

    // Save intelligence to customer record
    if (intelligence) {
      try {
        await db.collection('customers').doc(customerId).update({
          aiIntelligence: {
            ...intelligence,
            analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
            projectsAnalyzed: projectHistory.length,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (saveError) {
        console.error('Error saving customer intelligence:', saveError);
      }
    }

    res.json({
      success: true,
      customer: {
        id: customerId,
        name: customer.name,
        segment: customer.segment,
      },
      projectCount: projectHistory.length,
      intelligence: intelligence || { raw: responseText },
      usageMetadata: {
        inputTokens: usageMetadata.promptTokenCount || 0,
        outputTokens: usageMetadata.candidatesTokenCount || 0,
        modelUsed: 'gemini-2.0-flash',
      },
    });

  } catch (error) {
    console.error('Customer Intelligence error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// Feature Library Context Cache
// ============================================

const CACHE_TTL_HOURS = 8;
const CACHE_CONFIG_DOC = 'systemConfig/featureLibraryCache';

/**
 * Get Feature Library cache status
 */
async function getFeatureCacheStatus(req, res) {
  try {
    const cacheDoc = await db.doc(CACHE_CONFIG_DOC).get();
    
    if (!cacheDoc.exists) {
      return res.json({
        status: 'not-initialized',
        message: 'Feature Library cache has not been created yet',
        canRefresh: true,
      });
    }
    
    const cache = cacheDoc.data();
    const now = Date.now();
    const expiresAt = cache.expiresAt?.toMillis() || 0;
    const isExpired = now > expiresAt;
    
    res.json({
      status: isExpired ? 'expired' : 'active',
      featureCount: cache.featureCount || 0,
      tokenCount: cache.tokenCount || 0,
      createdAt: cache.createdAt?.toDate().toISOString(),
      expiresAt: cache.expiresAt?.toDate().toISOString(),
      lastRefreshTrigger: cache.lastRefreshTrigger,
      isExpired,
      hoursRemaining: isExpired ? 0 : Math.round((expiresAt - now) / (1000 * 60 * 60)),
      estimatedSavings: `${Math.round((cache.tokenCount || 0) * 0.75 / 1000)}K tokens saved per call`,
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Refresh Feature Library cache
 */
async function refreshFeatureCache(req, res) {
  try {
    const { trigger = 'manual' } = req.body;
    
    console.log('Refreshing Feature Library cache, trigger:', trigger);
    
    // Get all active features from Firestore
    const featuresSnapshot = await db.collection('featureLibrary')
      .where('status', '==', 'active')
      .get();
    
    const features = [];
    featuresSnapshot.forEach(doc => {
      const data = doc.data();
      features.push({
        code: data.code,
        name: data.name,
        category: data.category,
        subcategory: data.subcategory || null,
        qualityGrade: data.qualityGrade,
        estimatedHours: data.estimatedTime?.typical || 0,
        requiredEquipment: data.requiredEquipment || [],
        skillLevel: data.costFactors?.skillLevel || 'journeyman',
        tags: data.tags || [],
        description: data.description?.substring(0, 200) || '',
      });
    });
    
    // Build optimized context for AI
    const featureContext = {
      featureLibrary: {
        lastUpdated: new Date().toISOString(),
        totalFeatures: features.length,
        categories: [...new Set(features.map(f => f.category))],
        features: features,
      },
    };
    
    // Estimate token count (rough estimate: ~4 chars per token)
    const contextJson = JSON.stringify(featureContext);
    const estimatedTokens = Math.ceil(contextJson.length / 4);
    
    // Store cache metadata
    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + (CACHE_TTL_HOURS * 60 * 60 * 1000)
    );
    
    await db.doc(CACHE_CONFIG_DOC).set({
      featureCount: features.length,
      tokenCount: estimatedTokens,
      createdAt: now,
      expiresAt: expiresAt,
      lastRefreshTrigger: trigger,
      contextSnapshot: contextJson, // Store the actual context
    });
    
    console.log(`Cache refreshed: ${features.length} features, ~${estimatedTokens} tokens`);
    
    res.json({
      success: true,
      featureCount: features.length,
      tokenCount: estimatedTokens,
      expiresAt: expiresAt.toDate().toISOString(),
      message: `Cache refreshed with ${features.length} features`,
    });
  } catch (error) {
    console.error('Error refreshing cache:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get Feature Library context for AI (used by AI handlers)
 */
async function getFeatureContextForAI(req, res) {
  try {
    const cacheDoc = await db.doc(CACHE_CONFIG_DOC).get();
    
    if (!cacheDoc.exists) {
      // No cache, return empty context
      return res.json({
        cached: false,
        context: null,
        message: 'No cache available. Call POST /ai/feature-cache to create one.',
      });
    }
    
    const cache = cacheDoc.data();
    const now = Date.now();
    const expiresAt = cache.expiresAt?.toMillis() || 0;
    const isExpired = now > expiresAt;
    
    if (isExpired) {
      // Auto-refresh if expired
      console.log('Cache expired, auto-refreshing...');
      const featuresSnapshot = await db.collection('featureLibrary')
        .where('status', '==', 'active')
        .get();
      
      const features = [];
      featuresSnapshot.forEach(doc => {
        const data = doc.data();
        features.push({
          code: data.code,
          name: data.name,
          category: data.category,
          qualityGrade: data.qualityGrade,
          estimatedHours: data.estimatedTime?.typical || 0,
          requiredEquipment: data.requiredEquipment || [],
          skillLevel: data.costFactors?.skillLevel || 'journeyman',
          tags: data.tags || [],
        });
      });
      
      const featureContext = {
        featureLibrary: {
          lastUpdated: new Date().toISOString(),
          totalFeatures: features.length,
          categories: [...new Set(features.map(f => f.category))],
          features: features,
        },
      };
      
      return res.json({
        cached: false,
        context: featureContext,
        message: 'Cache was expired, returning fresh context',
      });
    }
    
    // Return cached context
    res.json({
      cached: true,
      context: JSON.parse(cache.contextSnapshot),
      tokenCount: cache.tokenCount,
      expiresIn: Math.round((expiresAt - now) / (1000 * 60 * 60)) + ' hours',
    });
  } catch (error) {
    console.error('Error getting feature context:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Gap-7: RAG - Retrieve project context for AI prompts
 * Fetches relevant project data, design items, materials, and customer info
 */
async function getProjectContextForAI(projectId) {
  if (!projectId) return null;
  
  try {
    const context = {
      project: null,
      designItems: [],
      materials: [],
      customer: null,
      recentConversations: [],
    };

    // Get project details
    const projectDoc = await db.collection('designProjects').doc(projectId).get();
    if (!projectDoc.exists) return null;
    
    const project = projectDoc.data();
    context.project = {
      id: projectId,
      name: project.name,
      code: project.code,
      status: project.status,
      stage: project.stage,
      description: project.description?.substring(0, 500),
      constraints: project.constraints || [],
      goals: project.goals || [],
      budget: project.budget,
      timeline: project.timeline,
    };

    // Get design items (limit to 10 most recent)
    const itemsSnapshot = await db.collection('designProjects').doc(projectId)
      .collection('designItems')
      .orderBy('updatedAt', 'desc')
      .limit(10)
      .get();
    
    for (const doc of itemsSnapshot.docs) {
      const item = doc.data();
      context.designItems.push({
        id: doc.id,
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        status: item.status,
        ragStatus: item.ragStatus,
        dimensions: item.parameters?.dimensions,
        primaryMaterial: item.parameters?.primaryMaterial?.name,
        constructionMethod: item.parameters?.constructionMethod,
      });
    }

    // Get material palette
    if (project.materialPalette?.entries) {
      context.materials = project.materialPalette.entries.slice(0, 10).map(m => ({
        designName: m.designName,
        inventoryName: m.inventoryName,
        thickness: m.thickness,
        category: m.category,
      }));
    }

    // Get customer info if linked
    if (project.customerId) {
      const customerDoc = await db.collection('customers').doc(project.customerId).get();
      if (customerDoc.exists) {
        const customer = customerDoc.data();
        context.customer = {
          name: customer.name,
          segment: customer.segment,
          preferences: customer.preferences?.substring?.(0, 200),
        };
      }
    }

    // Get recent AI conversations for this project (limit to 5)
    const conversationsSnapshot = await db.collection('designItemConversations')
      .where('projectId', '==', projectId)
      .orderBy('updatedAt', 'desc')
      .limit(5)
      .get();
    
    for (const doc of conversationsSnapshot.docs) {
      const conv = doc.data();
      const lastMessages = (conv.messages || []).slice(-3);
      context.recentConversations.push({
        designItemId: conv.designItemId,
        lastMessages: lastMessages.map(m => ({
          role: m.role,
          content: m.content?.substring(0, 200),
        })),
      });
    }

    return context;
  } catch (error) {
    console.error('Error getting project context for AI:', error);
    return null;
  }
}

/**
 * Get Design Item context for AI prompts
 * Fetches the full design item data including parameters for enrichment suggestions
 */
async function getDesignItemContextForAI(projectId, designItemId) {
  if (!projectId || !designItemId) return null;
  
  try {
    const itemDoc = await db.collection('designProjects').doc(projectId)
      .collection('designItems').doc(designItemId).get();
    
    if (!itemDoc.exists) return null;
    
    const item = itemDoc.data();
    
    // Build comprehensive context for AI
    const context = {
      // Identity
      id: designItemId,
      itemCode: item.itemCode,
      name: item.name,
      description: item.description || null,
      category: item.category,
      
      // Status
      currentStage: item.currentStage,
      ragStatus: item.ragStatus,
      overallReadiness: item.overallReadiness,
      
      // Dimensions
      dimensions: item.parameters?.dimensions || {
        width: null,
        height: null,
        depth: null,
        unit: 'mm',
      },
      
      // Materials
      primaryMaterial: item.parameters?.primaryMaterial || null,
      secondaryMaterials: item.parameters?.secondaryMaterials || [],
      edgeBanding: item.parameters?.edgeBanding || null,
      
      // Hardware
      hardware: item.parameters?.hardware || [],
      
      // Finish
      finish: item.parameters?.finish || null,
      
      // Construction
      constructionMethod: item.parameters?.constructionMethod || null,
      joineryTypes: item.parameters?.joineryTypes || [],
      
      // Quality
      awiGrade: item.parameters?.awiGrade || null,
      
      // Special requirements
      specialRequirements: item.parameters?.specialRequirements || [],
      
      // Workflow flags
      hasBlockers: item.hasBlockers || false,
      blockerNotes: item.blockerNotes || null,
      requiresPrototype: item.requiresPrototype || false,
      
      // Notes
      notes: item.notes || null,
      
      // Files count
      filesCount: item.files?.length || 0,
      
      // Identify empty/incomplete fields
      incompleteFields: [],
    };
    
    // Identify incomplete fields for AI to suggest enrichments
    if (!context.dimensions?.width) context.incompleteFields.push('dimensions.width');
    if (!context.dimensions?.height) context.incompleteFields.push('dimensions.height');
    if (!context.dimensions?.depth) context.incompleteFields.push('dimensions.depth');
    if (!context.primaryMaterial) context.incompleteFields.push('primaryMaterial');
    if (!context.finish) context.incompleteFields.push('finish');
    if (!context.constructionMethod) context.incompleteFields.push('constructionMethod');
    if (context.joineryTypes.length === 0) context.incompleteFields.push('joineryTypes');
    if (context.hardware.length === 0) context.incompleteFields.push('hardware');
    if (!context.awiGrade) context.incompleteFields.push('awiGrade');
    if (!context.description) context.incompleteFields.push('description');
    
    return context;
  } catch (error) {
    console.error('Error getting design item context for AI:', error);
    return null;
  }
}

/**
 * Get cached Feature Library context (internal helper)
 * Returns the context string to inject into AI prompts
 */
async function getCachedFeatureContext() {
  try {
    const cacheDoc = await db.doc(CACHE_CONFIG_DOC).get();
    
    if (!cacheDoc.exists) {
      return null;
    }
    
    const cache = cacheDoc.data();
    const now = Date.now();
    const expiresAt = cache.expiresAt?.toMillis() || 0;
    
    if (now > expiresAt) {
      return null; // Expired
    }
    
    return cache.contextSnapshot;
  } catch (error) {
    console.error('Error getting cached context:', error);
    return null;
  }
}

// ============================================
// Shopify Integration Handlers
// ============================================

const SHOPIFY_CONFIG_DOC = 'systemConfig/shopifyConfig';

/**
 * Connect to Shopify store
 */
async function connectShopify(req, res) {
  try {
    const { shopDomain, accessToken } = req.body;
    
    if (!shopDomain || !accessToken) {
      return res.status(400).json({ error: 'Shop domain and access token required' });
    }
    
    // Clean shop domain
    const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // Verify connection by fetching shop info
    const shopResponse = await fetch(`https://${cleanDomain}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    });
    
    if (!shopResponse.ok) {
      const error = await shopResponse.text();
      console.error('Shopify connection error:', error);
      return res.status(400).json({ error: 'Invalid credentials or shop domain' });
    }
    
    const shopData = await shopResponse.json();
    
    // Store configuration
    await db.doc(SHOPIFY_CONFIG_DOC).set({
      shopDomain: cleanDomain,
      shopName: shopData.shop.name,
      shopEmail: shopData.shop.email,
      accessToken: accessToken, // In production, encrypt this
      status: 'connected',
      connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    res.json({ 
      success: true, 
      shop: {
        name: shopData.shop.name,
        domain: cleanDomain,
      }
    });
  } catch (error) {
    console.error('Error connecting to Shopify:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get Shopify connection status
 */
async function getShopifyStatus(req, res) {
  try {
    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    
    if (!configDoc.exists) {
      return res.json({ 
        connected: false,
        status: 'disconnected',
      });
    }
    
    const config = configDoc.data();
    
    res.json({
      connected: config.status === 'connected',
      status: config.status,
      shopName: config.shopName,
      shopDomain: config.shopDomain,
      connectedAt: config.connectedAt,
      lastSync: config.lastSync,
    });
  } catch (error) {
    console.error('Error getting Shopify status:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get Shopify products
 */
async function getShopifyProducts(req, res) {
  try {
    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    
    if (!configDoc.exists || configDoc.data().status !== 'connected') {
      return res.status(400).json({ error: 'Shopify not connected' });
    }
    
    const config = configDoc.data();
    
    const response = await fetch(
      `https://${config.shopDomain}/admin/api/2024-01/products.json?limit=50`,
      {
        headers: {
          'X-Shopify-Access-Token': config.accessToken,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch products from Shopify');
    }
    
    const data = await response.json();
    
    res.json({ 
      products: data.products || [],
      count: data.products?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Sync product to Shopify
 */
async function syncProductToShopify(req, res) {
  try {
    const { roadmapProductId, productData } = req.body;
    
    if (!roadmapProductId || !productData) {
      return res.status(400).json({ error: 'Product ID and data required' });
    }
    
    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    
    if (!configDoc.exists || configDoc.data().status !== 'connected') {
      return res.status(400).json({ error: 'Shopify not connected' });
    }
    
    const config = configDoc.data();
    
    // Check if product already exists in mapping
    const mappingQuery = await db.collection('productSyncMappings')
      .where('roadmapProductId', '==', roadmapProductId)
      .get();
    
    let shopifyProductId = null;
    let method = 'POST';
    let url = `https://${config.shopDomain}/admin/api/2024-01/products.json`;
    
    if (!mappingQuery.empty) {
      const mapping = mappingQuery.docs[0].data();
      if (mapping.shopifyProductId) {
        shopifyProductId = mapping.shopifyProductId;
        method = 'PUT';
        url = `https://${config.shopDomain}/admin/api/2024-01/products/${shopifyProductId}.json`;
      }
    }
    
    // Create/Update product in Shopify
    const response = await fetch(url, {
      method,
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ product: productData }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error('Shopify sync error:', error);
      throw new Error('Failed to sync product to Shopify');
    }
    
    const result = await response.json();
    shopifyProductId = result.product.id;

    // Extract inventory_item_id from first variant (for inventory level push)
    const shopifyVariantId = result.product.variants?.[0]?.id || null;
    const shopifyInventoryItemId = result.product.variants?.[0]?.inventory_item_id || null;

    // Update mapping
    const mappingRef = mappingQuery.empty
      ? db.collection('productSyncMappings').doc()
      : mappingQuery.docs[0].ref;

    await mappingRef.set({
      roadmapProductId,
      shopifyProductId: String(shopifyProductId),
      syncStatus: 'synced',
      lastSynced: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({
      success: true,
      shopifyProductId: String(shopifyProductId),
      shopifyVariantId: shopifyVariantId ? String(shopifyVariantId) : null,
      shopifyInventoryItemId: shopifyInventoryItemId ? String(shopifyInventoryItemId) : null,
      action: method === 'POST' ? 'created' : 'updated',
    });
  } catch (error) {
    console.error('Error syncing to Shopify:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update an existing Shopify product
 */
async function updateShopifyProduct(req, res) {
  try {
    const { shopifyProductId, updates } = req.body;

    if (!shopifyProductId || !updates) {
      return res.status(400).json({ error: 'Shopify product ID and updates required' });
    }

    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    if (!configDoc.exists || configDoc.data().status !== 'connected') {
      return res.status(400).json({ error: 'Shopify not connected' });
    }

    const config = configDoc.data();

    const response = await fetch(
      `https://${config.shopDomain}/admin/api/2024-01/products/${shopifyProductId}.json`,
      {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': config.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ product: updates }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Shopify update error:', error);
      throw new Error('Failed to update product on Shopify');
    }

    const result = await response.json();
    res.json({ success: true, product: result.product });
  } catch (error) {
    console.error('Error updating Shopify product:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get Shopify orders (from Shopify API)
 */
async function getShopifyOrders(req, res) {
  try {
    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    if (!configDoc.exists || configDoc.data().status !== 'connected') {
      return res.status(400).json({ error: 'Shopify not connected' });
    }

    const config = configDoc.data();
    const limit = req.query.limit || 50;
    const status = req.query.status || 'any';
    const sinceId = req.query.since_id || '';

    let url = `https://${config.shopDomain}/admin/api/2024-01/orders.json?limit=${limit}&status=${status}`;
    if (sinceId) {
      url += `&since_id=${sinceId}`;
    }

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch orders from Shopify');
    }

    const data = await response.json();
    res.json({
      orders: data.orders || [],
      count: data.orders?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching Shopify orders:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Bulk sync Shopify orders into Firestore
 */
async function syncShopifyOrders(req, res) {
  try {
    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    if (!configDoc.exists || configDoc.data().status !== 'connected') {
      return res.status(400).json({ error: 'Shopify not connected' });
    }

    const config = configDoc.data();
    const { sinceId, limit = 250 } = req.body;

    let url = `https://${config.shopDomain}/admin/api/2024-01/orders.json?limit=${limit}&status=any`;
    if (sinceId) {
      url += `&since_id=${sinceId}`;
    }

    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch orders from Shopify');
    }

    const data = await response.json();
    const orders = data.orders || [];

    const { buildOrderDocument } = require('./src/webhooks/shopifyOrderCreate');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    const batch = db.batch();

    for (const order of orders) {
      const shopifyOrderId = String(order.id);
      const orderDocId = `shopify_${shopifyOrderId}`;
      const orderRef = db.collection('shopifyOrders').doc(orderDocId);
      const existing = await orderRef.get();

      if (existing.exists) {
        // Update existing
        const orderDoc = buildOrderDocument(order, config, existing.data().crmDealId);
        delete orderDoc.createdAt; // Don't overwrite original creation time
        batch.update(orderRef, orderDoc);
        updated++;
      } else {
        // Create new
        const orderDoc = buildOrderDocument(order, config, null);
        batch.set(orderRef, orderDoc);
        created++;
      }
    }

    await batch.commit();

    res.json({
      success: true,
      total: orders.length,
      created,
      updated,
      skipped,
    });
  } catch (error) {
    console.error('Error syncing Shopify orders:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Update inventory levels on Shopify (DawinOS → Shopify push)
 */
async function updateShopifyInventory(req, res) {
  try {
    const { shopifyInventoryItemId, shopifyLocationId, availableQuantity } = req.body;

    if (!shopifyInventoryItemId || !shopifyLocationId || availableQuantity === undefined) {
      return res.status(400).json({
        error: 'shopifyInventoryItemId, shopifyLocationId, and availableQuantity are required',
      });
    }

    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    if (!configDoc.exists || configDoc.data().status !== 'connected') {
      return res.status(400).json({ error: 'Shopify not connected' });
    }

    const config = configDoc.data();

    const response = await fetch(
      `https://${config.shopDomain}/admin/api/2024-01/inventory_levels/set.json`,
      {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': config.accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inventory_item_id: parseInt(shopifyInventoryItemId, 10),
          location_id: parseInt(shopifyLocationId, 10),
          available: Math.floor(availableQuantity),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Shopify inventory update error:', error);
      throw new Error('Failed to update inventory on Shopify');
    }

    const result = await response.json();
    res.json({
      success: true,
      inventoryLevel: result.inventory_level,
    });
  } catch (error) {
    console.error('Error updating Shopify inventory:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Get Shopify locations (for mapping DawinOS warehouses)
 */
async function getShopifyLocations(req, res) {
  try {
    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    if (!configDoc.exists || configDoc.data().status !== 'connected') {
      return res.status(400).json({ error: 'Shopify not connected' });
    }

    const config = configDoc.data();

    const response = await fetch(
      `https://${config.shopDomain}/admin/api/2024-01/locations.json`,
      {
        headers: {
          'X-Shopify-Access-Token': config.accessToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch locations from Shopify');
    }

    const data = await response.json();
    res.json({
      locations: (data.locations || []).map(loc => ({
        id: String(loc.id),
        name: loc.name,
        address1: loc.address1,
        city: loc.city,
        country: loc.country_name,
        active: loc.active,
      })),
    });
  } catch (error) {
    console.error('Error fetching Shopify locations:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// NEW AI ENDPOINT HANDLERS
// ============================================

/**
 * Handle Project Scoping AI request via Express API
 * Wraps the projectScoping callable function logic
 */
async function handleProjectScoping(req, res) {
  try {
    const { briefText, projectId, projectName, projectType, location, includeResearch, customerId } = req.body;

    if (!briefText || typeof briefText !== 'string' || briefText.length < 20) {
      return res.status(400).json({ error: 'Brief text must be at least 20 characters' });
    }

    // Import the core logic from projectScoping module
    const { processProjectScoping } = require('./src/ai/projectScopingLogic');
    
    const result = await processProjectScoping({
      briefText,
      projectId,
      projectName,
      projectType,
      location: location || 'East Africa',
      includeResearch: includeResearch !== false,
      customerId,
      geminiApiKey: GEMINI_API_KEY.value(),
      db,
    });

    res.json(result);
  } catch (error) {
    console.error('Project Scoping error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle Design Item Enhancement AI request via Express API
 */
async function handleDesignItemEnhancement(req, res) {
  try {
    const { deliverable, projectContext, customerId, companyId, includeSuppliers } = req.body;

    if (!deliverable || !deliverable.itemType) {
      return res.status(400).json({ error: 'Deliverable with itemType is required' });
    }

    // Load business memory context (non-blocking)
    let memoryPrompt = '';
    let memoryCount = 0;
    if (companyId) {
      try {
        const memCtx = await loadMemoryContext(companyId, 'design_enhancement', 8);
        memoryPrompt = memCtx.prompt;
        memoryCount = memCtx.count;
        if (memoryCount > 0) {
          console.log(`Design Enhancement REST: ${memoryCount} business memories loaded`);
        }
      } catch (err) {
        console.warn('Memory load failed (non-blocking):', err.message);
      }
    }

    // Import the core logic from designItemEnhancement module
    const { processDesignItemEnhancement } = require('./src/ai/designItemEnhancementLogic');
    
    const result = await processDesignItemEnhancement({
      deliverable,
      projectContext,
      customerId,
      includeSuppliers: includeSuppliers !== false,
      geminiApiKey: GEMINI_API_KEY.value(),
      db,
      memoryPrompt,
    });

    result.memoryCount = memoryCount;
    res.json(result);
  } catch (error) {
    console.error('Design Item Enhancement error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle Image Analysis AI request via Express API
 */
async function handleImageAnalysisEndpoint(req, res) {
  try {
    const { imageBase64, imageMimeType, projectId, additionalPrompt } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }

    // Import the core logic from imageAnalysis module  
    const { processImageAnalysis } = require('./src/ai/imageAnalysisLogic');
    
    const result = await processImageAnalysis({
      imageBase64,
      imageMimeType: imageMimeType || 'image/jpeg',
      projectId,
      additionalPrompt,
      geminiApiKey: GEMINI_API_KEY.value(),
      db,
    });

    res.json(result);
  } catch (error) {
    console.error('Image Analysis error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle Generate Product Names AI request via Express API
 */
async function handleGenerateProductNames(req, res) {
  try {
    const { context, namingStrategy, existingNames = [] } = req.body;

    if (!context || !context.category) {
      return res.status(400).json({ error: 'Product context with category is required' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: { 
        maxOutputTokens: 2048, 
        temperature: 0.8,
      },
    });

    const defaultStrategy = `Create names that:
1. Evoke quality craftsmanship and premium materials
2. Are memorable and easy to pronounce
3. Work well for SEO
4. Fit the Dawin Finishes brand identity
5. Could work as part of a collection
6. Are 2-4 words, avoiding generic terms`;

    const prompt = `You are a product naming specialist for Dawin Finishes, a custom millwork and cabinet manufacturer.

NAMING STRATEGY:
${namingStrategy || defaultStrategy}

EXISTING PRODUCT NAMES (avoid duplicates):
${existingNames.length > 0 ? existingNames.join(', ') : 'None yet'}

PRODUCT CONTEXT:
- Category: ${context.category}
- Materials: ${context.materials?.join(', ') || 'Custom materials'}
- Features: ${context.features?.join(', ') || 'Handcrafted quality'}
- Target Market: ${context.targetMarket || 'Design professionals and homeowners'}
${context.dimensions ? `- Dimensions: ${context.dimensions}` : ''}
${context.collectionHint ? `- Collection Hint: ${context.collectionHint}` : ''}

Generate exactly 5 product name candidates. For each, provide:
1. The name (2-4 words, evocative and memorable)
2. A URL-friendly handle (lowercase, hyphens only)
3. Brief rationale (1 sentence explaining why this name works)
4. Scores 0-100 for: brandFit, seoScore, uniqueness

Respond in this exact JSON format:
{
  "candidates": [
    {
      "name": "Product Name",
      "handle": "product-name",
      "rationale": "Why this name works for the brand",
      "scores": { "brandFit": 85, "seoScore": 78, "uniqueness": 92 }
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        const rawMatch = responseText.match(/\{[\s\S]*\}/);
        if (rawMatch) {
          parsed = JSON.parse(rawMatch[0]);
        } else {
          throw new Error('Failed to parse AI response');
        }
      }
    }

    const now = new Date().toISOString();
    parsed.candidates = parsed.candidates.map(candidate => ({
      ...candidate,
      generatedAt: now,
    }));

    res.json(parsed);
  } catch (error) {
    console.error('Generate Product Names error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle Generate Product Content AI request via Express API
 */
async function handleGenerateProductContent(req, res) {
  try {
    const { product, contentTypes = ['short', 'full', 'meta', 'bullets'], tone = 'professional' } = req.body;

    if (!product || !product.name) {
      return res.status(400).json({ error: 'Product with name is required' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: { 
        maxOutputTokens: 4096, 
        temperature: 0.7,
      },
    });

    let dimensionsStr = 'Custom sizing available';
    if (product.specifications?.dimensions) {
      const d = product.specifications.dimensions;
      dimensionsStr = `${d.length}x${d.width}x${d.height} ${d.unit || 'mm'}`;
    }

    const prompt = `Generate product content for a custom millwork product from Dawin Finishes.

PRODUCT DETAILS:
- Name: ${product.name}
- Category: ${product.category || 'Custom Millwork'}
- Materials: ${product.specifications?.materials?.join(', ') || 'Premium materials'}
- Finishes: ${product.specifications?.finishes?.join(', ') || 'Custom finish options'}
- Features: ${product.specifications?.features?.join(', ') || 'Handcrafted quality'}
- Dimensions: ${dimensionsStr}
- Description hint: ${product.description || 'High-quality custom piece'}

TONE: ${tone}

Generate the following in JSON format:
{
  "shortDescription": "50-100 word compelling summary",
  "fullDescription": "300-500 word HTML description with <p>, <h3>, <ul>, <li>, <strong> tags",
  "metaDescription": "Max 155 characters SEO meta description",
  "bulletPoints": ["5-7 key selling points"],
  "faqs": [{"question": "...", "answer": "..."}]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        const rawMatch = responseText.match(/\{[\s\S]*\}/);
        if (rawMatch) {
          parsed = JSON.parse(rawMatch[0]);
        } else {
          throw new Error('Failed to parse AI response');
        }
      }
    }

    parsed.generatedAt = new Date().toISOString();
    parsed.modelVersion = 'gemini-1.5-flash';
    parsed.editedByUser = false;

    res.json(parsed);
  } catch (error) {
    console.error('Generate Product Content error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle Generate Discoverability Data AI request via Express API
 */
async function handleGenerateDiscoverability(req, res) {
  try {
    const { product } = req.body;

    if (!product || !product.name) {
      return res.status(400).json({ error: 'Product is required' });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: { 
        maxOutputTokens: 2048, 
        temperature: 0.6,
      },
    });

    const prompt = `Generate AI discoverability data for this custom millwork product:

PRODUCT: ${product.name}
CATEGORY: ${product.category || 'Custom Millwork'}
MATERIALS: ${product.specifications?.materials?.join(', ') || 'Various'}
FEATURES: ${product.specifications?.features?.join(', ') || 'Custom'}

Generate discovery content in JSON format:
{
  "whatItIs": "Clear 1-sentence description",
  "bestFor": "Who should buy this and why",
  "comparedTo": "How it compares to alternatives",
  "uniqueFeatures": ["3-5 standout features"],
  "useCases": ["4-6 specific use cases"],
  "faqs": [{"question": "...", "answer": "..."}],
  "semanticTags": {
    "materialType": ["wood", "veneer", etc.],
    "styleCategory": ["modern", "traditional", etc.],
    "roomType": ["kitchen", "bathroom", etc.],
    "colorFamily": ["natural", "white", etc.]
  },
  "searchKeywords": ["10-15 relevant search terms"]
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        const rawMatch = responseText.match(/\{[\s\S]*\}/);
        if (rawMatch) {
          parsed = JSON.parse(rawMatch[0]);
        } else {
          throw new Error('Failed to parse AI response');
        }
      }
    }

    parsed.generatedAt = new Date().toISOString();
    res.json(parsed);
  } catch (error) {
    console.error('Generate Discoverability error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * Handle Audit Product request via Express API
 */
async function handleAuditProduct(req, res) {
  try {
    const { shopifyProduct, auditConfig = {} } = req.body;

    if (!shopifyProduct) {
      return res.status(400).json({ error: 'Shopify product data is required' });
    }

    const config = {
      minDescriptionLength: auditConfig.minDescriptionLength || 100,
      maxDescriptionLength: auditConfig.maxDescriptionLength || 5000,
      minImageCount: auditConfig.minImageCount || 3,
      requiredBrandTerms: auditConfig.brandTerms?.required || ['Dawin', 'custom', 'crafted'],
      prohibitedTerms: auditConfig.brandTerms?.prohibited || ['cheap', 'discount', 'knockoff'],
    };

    const issues = [];
    const categoryScores = {
      content_completeness: 100,
      seo_quality: 100,
      image_optimization: 100,
      schema_data: 100,
      brand_consistency: 100,
    };

    // Title check
    if (!shopifyProduct.title || shopifyProduct.title.length < 5) {
      issues.push({
        id: `title_${Date.now()}`,
        category: 'content_completeness',
        severity: 'critical',
        field: 'title',
        message: 'Title is missing or too short',
      });
      categoryScores.content_completeness -= 25;
    }

    // Description check
    const descriptionLength = (shopifyProduct.body_html || '').replace(/<[^>]*>/g, '').length;
    if (descriptionLength < config.minDescriptionLength) {
      issues.push({
        id: `desc_short_${Date.now()}`,
        category: 'content_completeness',
        severity: 'high',
        field: 'body_html',
        message: `Description too short (${descriptionLength} chars)`,
      });
      categoryScores.content_completeness -= 20;
    }

    // Image check
    const images = shopifyProduct.images || [];
    if (images.length < config.minImageCount) {
      issues.push({
        id: `img_count_${Date.now()}`,
        category: 'image_optimization',
        severity: 'high',
        field: 'images',
        message: `Insufficient images (${images.length}/${config.minImageCount})`,
      });
      categoryScores.image_optimization -= 20;
    }

    // Ensure scores don't go below 0
    Object.keys(categoryScores).forEach(key => {
      categoryScores[key] = Math.max(0, categoryScores[key]);
    });

    // Weighted average
    const weights = { content_completeness: 0.3, seo_quality: 0.25, image_optimization: 0.2, schema_data: 0.1, brand_consistency: 0.15 };
    let overallScore = 0;
    Object.entries(weights).forEach(([category, weight]) => {
      overallScore += categoryScores[category] * weight;
    });
    overallScore = Math.round(overallScore);

    res.json({
      productId: shopifyProduct.id,
      auditedAt: new Date().toISOString(),
      overallScore,
      categoryScores,
      issues,
      recommendations: issues.slice(0, 5).map(i => `${i.severity.toUpperCase()}: ${i.message}`),
    });
  } catch (error) {
    console.error('Audit Product error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================
// CEO STRATEGY REVIEW AI - Claude-Powered Strategy Analysis
// ============================================

const STRATEGY_REVIEW_SYSTEM_PROMPT = `You are an expert business strategy consultant and AI assistant for the Dawin Group CEO Strategy Command. You help executives review, analyze, and improve their business strategy.

Your role:
1. Analyze uploaded strategy documents and provide structured feedback
2. Guide users through each section of the strategy review
3. Suggest improvements to the Business Model Canvas
4. Identify strategic risks and opportunities
5. Generate actionable OKRs and KPIs from strategic objectives
6. Provide competitive and market analysis insights

Context about the organization:
- Dawin Group is a diversified company with subsidiaries: Dawin Finishes (manufacturing/interior finishing), Dawin Advisory (consulting), Dawin Technology, and Dawin Capital
- Operations primarily in East Africa (Uganda headquarters)
- The CEO Strategy Command is a tool for strategic planning and performance tracking

IMPORTANT: Always return valid JSON with this exact structure:
{
  "message": "Your analysis and recommendations in markdown format",
  "suggestions": [...]
}

Each suggestion in the array must have these fields:
  - "id": unique string
  - "type": one of "bmc", "swot", "okr", "kpi", "risk", "market", "financial", "roadmap", "general"
  - "sectionKey": the review section this applies to — one of "executiveSummary", "visionMission", "businessModelCanvas", "marketAnalysis", "competitiveAnalysis", "swotAnalysis", "financialProjections", "riskAssessment", "implementationRoadmap", "okrKpiOutput"
  - "title": short descriptive title
  - "content": the suggestion content (see format rules below)
  - "score": numeric section quality score from 1 to 5
  - "recommendations": array of actionable recommendation strings for this section
  - "confidence": number 0-1

CONTENT FORMAT by type:
- type "bmc": content MUST be a JSON string like: {"keyPartners":["item1"],"keyActivities":["item1"],"keyResources":["item1"],"valuePropositions":["item1"],"customerRelationships":["item1"],"channels":["item1"],"customerSegments":["item1"],"costStructure":["item1"],"revenueStreams":["item1"]}
- type "swot": content MUST be a JSON string like: {"strengths":["item1"],"weaknesses":["item1"],"opportunities":["item1"],"threats":["item1"]}
- All other types: content is your detailed AI analysis and improved strategy text for that section. Write substantive, publication-ready content — not bullet-point outlines. Include specific data, strategic reasoning, and actionable detail. This will appear as the "AI Revised" version alongside the user's original document.

Additionally, each non-BMC/SWOT suggestion MUST include an "originalExcerpt" field: a verbatim excerpt (first 200 characters) from the uploaded document that identifies which part of the original document this section corresponds to. This helps the system locate the relevant portion of the uploaded document.

For full_analysis: return one suggestion per section (executiveSummary, visionMission, marketAnalysis, competitiveAnalysis, financialProjections, riskAssessment, implementationRoadmap), plus one "bmc" suggestion and one "swot" suggestion. Each with a score and recommendations.

Be specific, actionable, and reference industry best practices. Consider the East African market context.`;

const SECTION_PROMPTS = {
  executiveSummary: 'Analyze the executive summary. Evaluate clarity, completeness, strategic coherence, and alignment between stated objectives and business model. Write detailed, publication-ready analysis.',
  visionMission: 'Review vision and mission statements. Evaluate clarity, inspirational quality, specificity, and alignment with market reality. Write detailed analysis with specific improvement suggestions.',
  businessModelCanvas: 'Analyze the Business Model Canvas blocks. Evaluate completeness, internal consistency between blocks, gaps, and innovation opportunities. Return suggestions as structured items for each BMC block.',
  marketAnalysis: 'Evaluate the market analysis. Consider market sizing, target segments, growth projections, regulatory factors, and market trends. Write substantive analysis with specific data points.',
  competitiveAnalysis: 'Review the competitive landscape. Assess competitor identification, competitive positioning, differentiation strategy, and sustainable advantages. Provide detailed analysis.',
  swotAnalysis: 'Analyze the SWOT assessment. Evaluate whether strengths are genuine advantages, weaknesses are honestly assessed, opportunities are feasible, and threats are thorough. Suggest additional items with impact ratings.',
  financialProjections: 'Review financial projections. Assess revenue assumptions, cost sustainability, capital efficiency, break-even feasibility, and funding alignment. Provide specific numerical analysis.',
  riskAssessment: 'Evaluate strategic risk assessment. Consider completeness across categories, accuracy of ratings, quality of mitigation strategies, and missing risks. Provide detailed analysis.',
  implementationRoadmap: 'Review the implementation roadmap. Assess phase sequencing, milestone feasibility, resource adequacy, and quick wins vs long-term balance. Provide specific timeline recommendations.',
  okrKpiOutput: 'Generate recommended OKRs (3-5 objectives with 2-4 key results each) and KPIs (8-12 across financial, operational, customer, employee, growth categories). Return as structured JSON arrays within suggestions.',
  full_analysis: 'Provide a comprehensive assessment of the entire business strategy document. Score each section 1-5, identify key strengths and gaps, and pre-populate suggestions for Business Model Canvas, SWOT, OKRs, and KPIs. Write detailed, publication-ready analysis for each section — not outlines.',
};

async function handleStrategyReviewAI(req, res) {
  try {
    const { section, currentData, uploadedDocumentContent, question, conversationHistory, companyId, assessmentMode, documentSectionId, dataPackage } = req.body;

    if (!section) {
      res.status(400).json({ error: 'Section is required' });
      return;
    }

    console.log('Strategy Review AI - Section:', section);

    // Load business memory context (non-blocking)
    let memoryPrompt = '';
    let memoryCount = 0;
    if (companyId) {
      try {
        const memCtx = await loadMemoryContext(companyId, 'strategy_review', 10);
        memoryPrompt = memCtx.prompt;
        memoryCount = memCtx.count;
        if (memoryCount > 0) {
          console.log(`Strategy Review: ${memoryCount} business memories loaded`);
        }
      } catch (err) {
        console.warn('Memory load failed (non-blocking):', err.message);
      }
    }

    const client = getAnthropicClient();

    // Build system prompt with memory context
    let systemPrompt = STRATEGY_REVIEW_SYSTEM_PROMPT;
    if (memoryPrompt) {
      systemPrompt += memoryPrompt;
    }

    // Build messages from conversation history
    const messages = [];

    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content,
        });
      }
    }

    // Build the current user message
    let userMessage = '';

    if (uploadedDocumentContent) {
      userMessage += `## Uploaded Strategy Document Content:\n${uploadedDocumentContent.substring(0, 80000)}\n\n`;
    }

    if (currentData && Object.keys(currentData).length > 0) {
      userMessage += `## Current Review Data:\n${JSON.stringify(currentData, null, 2).substring(0, 8000)}\n\n`;
    }

    // Assessment mode prompts for document section analysis
    let sectionPrompt;
    if (assessmentMode === 'assess_alignment') {
      sectionPrompt = `Assess the alignment of this strategy document section with the current business data provided. Score the section from 1 to 5:
5 = Fully aligned with current business data
4 = Mostly aligned, minor updates needed
3 = Partially aligned, significant gaps exist
2 = Largely outdated, major rewrite needed
1 = Completely misaligned with current reality

Respond with JSON: {"score": number, "gaps": string[], "outdatedClaims": string[], "recommendation": "rewrite"|"minor_update"|"no_action"|"flag_for_ceo"}`;
    } else if (assessmentMode === 'generate_rewrite') {
      sectionPrompt = `Rewrite this strategy section to address the identified gaps and incorporate current business data. Maintain the same tone, structure, and strategic intent. Return ONLY the rewritten section content as plain text — no JSON wrapper, no code blocks.`;
    } else {
      sectionPrompt = SECTION_PROMPTS[section] || SECTION_PROMPTS.full_analysis;
    }

    if (documentSectionId) {
      userMessage += `## Document Section ID: ${documentSectionId}\n\n`;
    }
    if (dataPackage && Object.keys(dataPackage).length > 0) {
      userMessage += `## Business Data Package:\n${JSON.stringify(dataPackage, null, 2).substring(0, 8000)}\n\n`;
    }

    userMessage += `## Task:\n${sectionPrompt}\n\n`;

    if (question) {
      userMessage += `## Specific Question:\n${question}\n\n`;
    }

    userMessage += `\nRespond with valid JSON containing "message" (markdown analysis) and "suggestions" array. Each suggestion must have: id, type, sectionKey, title, content, score (1-5), recommendations (string array), confidence (0-1). For BMC type, content must be a JSON string with BMC block arrays. For SWOT type, content must be a JSON string with strengths/weaknesses/opportunities/threats arrays. For all other types, content MUST be the FULL original text from the uploaded document for that section — enhanced with inline [AI INSIGHT] and [NOTE] annotations. Do NOT condense, summarize, or outline the original content.`;

    messages.push({ role: 'user', content: userMessage });

    // full_analysis uses Sonnet for speed (large doc, 9 sections at once);
    // individual sections use Opus for quality (smaller, focused requests).
    const model = section === 'full_analysis' ? 'claude-sonnet-4-20250514' : 'claude-opus-4-6';
    const maxTokens = section === 'full_analysis' ? 16384 : 8192;

    console.log(`Strategy Review AI - Calling ${model} (streaming) with max_tokens=${maxTokens}, message length=${userMessage.length}`);

    // Use streaming to avoid Anthropic SDK timeout for large requests
    const stream = await client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    });
    const response = await stream.finalMessage();

    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const stopReason = response.stop_reason;
    console.log(`Strategy Review AI - Response length: ${responseText.length}, stop_reason: ${stopReason}`);

    if (stopReason === 'max_tokens') {
      console.warn('Strategy Review AI - Response was TRUNCATED (hit max_tokens limit)');
    }

    // Parse JSON from response — with robust recovery for truncated responses
    let result;
    try {
      result = JSON.parse(responseText);
      console.log(`Strategy Review AI - Direct JSON parse OK, suggestions: ${(result.suggestions || []).length}`);
    } catch (parseError) {
      console.warn('Strategy Review AI - Direct JSON parse failed, trying fallbacks...');

      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[1]);
          console.log(`Strategy Review AI - Code block parse OK, suggestions: ${(result.suggestions || []).length}`);
        } catch (e) {
          console.warn('Strategy Review AI - Code block parse failed');
        }
      }

      if (!result) {
        // Try to find the outermost JSON object
        const firstBrace = responseText.indexOf('{');
        const lastBrace = responseText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            result = JSON.parse(responseText.substring(firstBrace, lastBrace + 1));
            console.log(`Strategy Review AI - Brace extraction OK, suggestions: ${(result.suggestions || []).length}`);
          } catch (e) {
            console.warn('Strategy Review AI - Brace extraction failed');
          }
        }
      }

      if (!result && stopReason === 'max_tokens') {
        // Truncated response — try to repair by closing the JSON
        console.log('Strategy Review AI - Attempting truncated JSON repair...');
        let truncated = responseText;
        const firstBrace = truncated.indexOf('{');
        if (firstBrace !== -1) {
          truncated = truncated.substring(firstBrace);
          // Try progressively closing brackets
          const repairs = [
            truncated + ']}',          // close suggestions array + root object
            truncated + '"}]}',        // close string + suggestions array + root object
            truncated + '"}]}]}',      // nested array close
          ];
          for (const attempt of repairs) {
            try {
              result = JSON.parse(attempt);
              console.log(`Strategy Review AI - Truncated repair OK, suggestions: ${(result.suggestions || []).length}`);
              break;
            } catch (e) { /* try next */ }
          }
        }
      }

      if (!result) {
        console.error('Strategy Review AI - All JSON parsing failed, using raw text fallback');
        result = { message: responseText.substring(0, 2000), suggestions: [] };
      }
    }

    // Ensure suggestions have IDs and pass through all fields
    const suggestions = (result.suggestions || []).map((s, i) => ({
      id: s.id || `suggestion_${Date.now()}_${i}`,
      type: s.type || 'general',
      sectionKey: s.sectionKey || null,
      title: s.title || `Suggestion ${i + 1}`,
      content: s.content || '',
      score: typeof s.score === 'number' ? s.score : 0,
      recommendations: Array.isArray(s.recommendations) ? s.recommendations : [],
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.7,
      applied: false,
    }));

    const assistantMessage = {
      id: `ai_${Date.now()}`,
      role: 'assistant',
      content: result.message || responseText,
      timestamp: new Date().toISOString(),
      section,
      suggestions,
    };

    res.json({
      success: true,
      message: result.message || responseText,
      suggestions,
      conversationMessage: assistantMessage,
      memoryCount,
    });
  } catch (error) {
    console.error('Strategy Review AI error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: '',
      suggestions: [],
      conversationMessage: {
        id: `ai_error_${Date.now()}`,
        role: 'assistant',
        content: `I encountered an error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

async function handleStrategyDocumentParse(req, res) {
  try {
    const { textContent, fileBase64, fileName, companyId } = req.body;

    let documentText = '';

    if (textContent) {
      // Text content sent directly
      documentText = textContent;
    } else if (fileBase64 && fileName) {
      // Binary file sent as base64 — extract text server-side
      const fileBuffer = Buffer.from(fileBase64, 'base64');
      const lowerName = fileName.toLowerCase();

      if (lowerName.endsWith('.docx')) {
        // Use mammoth for reliable DOCX text extraction
        try {
          const mammoth = require('mammoth');
          const mammothResult = await mammoth.extractRawText({ buffer: fileBuffer });
          documentText = (mammothResult.value || '').trim();
          console.log(`Strategy Doc Parse - mammoth extracted ${documentText.length} chars from DOCX`);
          if (mammothResult.messages && mammothResult.messages.length > 0) {
            console.log('Strategy Doc Parse - mammoth warnings:', mammothResult.messages.map(m => m.message).join('; '));
          }
        } catch (mammothErr) {
          console.warn('Strategy Doc Parse - mammoth extraction failed:', mammothErr.message);
          // Fallback: try adm-zip manual extraction
          try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(fileBuffer);
            const docEntry = zip.getEntry('word/document.xml');
            if (docEntry) {
              const xmlContent = docEntry.getData().toString('utf8');
              documentText = xmlContent
                .replace(/<w:br[^>]*\/>/g, '\n')
                .replace(/<w:p[^>]*>/g, '\n')
                .replace(/<[^>]+>/g, '')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&apos;/g, "'")
                .replace(/\n{3,}/g, '\n\n')
                .trim();
              console.log(`Strategy Doc Parse - adm-zip fallback extracted ${documentText.length} chars`);
            } else {
              console.warn('Strategy Doc Parse - adm-zip: word/document.xml not found in DOCX');
            }
          } catch (zipErr) {
            console.warn('Strategy Doc Parse - adm-zip fallback also failed:', zipErr.message);
          }
        }
      } else if (lowerName.endsWith('.pdf')) {
        // Use Claude's PDF support — send as document content block
        try {
          const client = getAnthropicClient();
          const pdfResponse = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
            messages: [{
              role: 'user',
              content: [
                {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: fileBase64,
                  },
                },
                {
                  type: 'text',
                  text: 'Extract all the text content from this PDF document. Return only the raw text content, preserving the document structure with headings and paragraphs. Do not add any commentary or analysis.',
                },
              ],
            }],
          });
          documentText = pdfResponse.content[0]?.type === 'text' ? pdfResponse.content[0].text : '';
        } catch (pdfErr) {
          console.warn('PDF extraction via Claude failed:', pdfErr.message);
        }
      }

      if (!documentText) {
        console.warn('Strategy Doc Parse - No text extracted from file:', fileName);
        res.status(400).json({ 
          error: 'Could not extract text from the uploaded file. Please try pasting the content manually.',
        });
        return;
      }
    } else {
      res.status(400).json({ error: 'No document content provided. Send textContent or fileBase64 with fileName.' });
      return;
    }

    console.log(`Strategy Doc Parse - Extracted text length: ${documentText.length}`);
    console.log(`Strategy Doc Parse - First 200 chars: ${documentText.substring(0, 200)}`);

    // Return the raw extracted text directly — the frontend will send it
    // to the strategy review AI for structured analysis
    const charLimit = 100000;
    const wasTruncated = documentText.length > charLimit;
    const truncatedText = documentText.substring(0, charLimit);

    // Return the extracted text as content (the AI review endpoint handles structuring)
    res.json({
      success: true,
      content: truncatedText,
      truncated: wasTruncated,
      originalLength: documentText.length,
    });
  } catch (error) {
    console.error('Strategy Document Parse error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Admin Functions
// generateDesignManagerEvents{,HTTP} + processPendingEvents were the
// DawinOS Design Manager event-stream admin triggers — they ran on
// `designProjects` / `designItems` (stripped in Phase 1.A). No
// frontend callers in ZeusOS; removed in the tools/* cleanup.

// Admin: Material backfill — removed in the Phase 1.E tools/* sweep.
// backfillMaterialFields was a one-time DawinOS migration that
// read+wrote the `materials` collection (stripped in Phase 1.C). It had
// no frontend callers and was the last reader of `materials`, so
// dropping it lets firestore.rules retire the matching match block.

// Admin: Service credentials (Firebase Secret Manager)
const {
  adminListServiceCredentials,
  adminSetServiceCredential,
  adminTestServiceCredential,
} = require('./src/admin/secrets');
exports.adminListServiceCredentials = adminListServiceCredentials;
exports.adminSetServiceCredential = adminSetServiceCredential;
exports.adminTestServiceCredential = adminTestServiceCredential;

// ZeusOS MCP Server — AI tool access to Firestore operational data
// Build first: cd zeusos-mcp-server && npm run build
exports.zeusos_mcp = require('./src/mcp/zeusos-mcp.js').zeusos_mcp;

// ============================================================
// Drive Bridge (Phase 2 — Shared Drive Architecture v3/v3.1)
// ============================================================
//
// Two onCreate Firestore triggers that mirror new `designProjects`
// and `projectFiles` docs into the `01_Active-Projects/{code}_.../{01..07}/`
// tree on Google Drive. Both short-circuit cleanly when the feature
// flag is off (i.e. when `DRIVE_ACTIVE_PROJECTS_FOLDER_ID` or the
// GOOGLE_DRIVE_* secrets are unset), so deployment is safe before the
// Phase 0 admin steps have been completed.
const {
  onDesignProjectCreatedForDrive,
  onProjectFileCreatedForDrive,
  onDesignProjectCompletedForDrive,
  onProjectFileUpdatedForDrive,
  onProjectFileDeletedForDrive,
} = require('./src/triggers/driveTriggers');
exports.onDesignProjectCreatedForDrive = onDesignProjectCreatedForDrive;
exports.onProjectFileCreatedForDrive = onProjectFileCreatedForDrive;
// Phase 4 — archive lifecycle. Fires on status→'completed' transitions
// and relocates the project's Drive folder into `02_Archive/{YYYY}/`.
exports.onDesignProjectCompletedForDrive = onDesignProjectCompletedForDrive;
// Phase 4b — onUpdate re-mirror (overwriteFile storage swap, name edits)
// and onDelete cascade (delete the Drive mirror when the Firestore
// doc goes). Closes the Phase 2 staleness gaps.
exports.onProjectFileUpdatedForDrive = onProjectFileUpdatedForDrive;
exports.onProjectFileDeletedForDrive = onProjectFileDeletedForDrive;
// Admin callable — verifies a Drive folder ID resolves + is reachable
// by the service account. Backs the "Verify" button on the Drive
// Folder Settings page.
const { verifyDriveFolder } = require('./src/admin/verifyDriveFolder');
exports.verifyDriveFolder = verifyDriveFolder;
// Phase 4 monthly sweep — catches any completed project that missed
// the transition trigger (backlog, rolled-out-later projects, previous
// archive failures).
const { archiveSweep } = require('./src/scheduled/archiveSweep');
exports.archiveSweep = archiveSweep;

// ============================================================
// Pricing — Phase 3.C (engine + Quote builder)
// ============================================================
// PHASE 3.A.5 PLACEHOLDER: collections are stubbed at the root
// (`rate_cards`, `quotes`, `sows`). 3.A.5 re-roots them under
// `organizations/{id}/...` — re-point the lookups when it lands.
const { priceQuote } = require('./src/pricing/priceQuote');
const { issueQuote, acceptQuote, voidQuote } = require('./src/pricing/quoteLifecycle');
const { createRateCardVersion, activateRateCard, retireRateCard } = require('./src/pricing/rateCardAdmin');
exports.priceQuote = priceQuote;
exports.issueQuote = issueQuote;
exports.acceptQuote = acceptQuote;
exports.voidQuote = voidQuote;
exports.createRateCardVersion = createRateCardVersion;
exports.activateRateCard = activateRateCard;
exports.retireRateCard = retireRateCard;

// ============================================================
// Assignment & Handoff — Phase 3.B (IWO state machine)
// ============================================================
// Spec §6 (state machine) + §7 (handoff engine) + §9.1-9.3 (API).
// Cross-cutting infra: `src/platform/idempotency.js`, `src/platform/outbox.js`.
const assignment = require('./src/assignment');
exports.issueWorkOrder = assignment.issueWorkOrder;
exports.acceptWorkOrder = assignment.acceptWorkOrder;
exports.rejectWorkOrder = assignment.rejectWorkOrder;
exports.startWorkOrder = assignment.startWorkOrder;
exports.postTimeEntry = assignment.postTimeEntry;
exports.postCostEntry = assignment.postCostEntry;
exports.submitDeliverable = assignment.submitDeliverable;
exports.acceptInternal = assignment.acceptInternal;
exports.requestRevision = assignment.requestRevision;
exports.closeWorkOrder = assignment.closeWorkOrder;
exports.cancelWorkOrder = assignment.cancelWorkOrder;

// Phase 3.E — spec §7.4 Layer 3 routing.
exports.routeDirectClientRequest = assignment.routeDirectClientRequest;

// Phase 6.B — brand routing recommendation (Addendum v1.1 §8).
exports.routeBrand = assignment.routeBrand;

// ADR-2026-05-25 §2.Q4 — Conflict firewall on named-competitor model.
// Replaces the retired Phase 6.C category-based callables. Both
// callables are idempotent on (clientId, competitorClientId) and
// gated on parent-org auth.
const conflictFirewall = require('./src/conflict-firewall/admin');
exports.addClientCompetitor    = conflictFirewall.addClientCompetitor;
exports.removeClientCompetitor = conflictFirewall.removeClientCompetitor;

// Phase 6.UI.A — Role Profile + Role Assignment admin callables (PR 6).
// Gates: parent-org admin via `assertParentOrgPrincipal`. Idempotent
// upsert semantics on both collections.
const roleProfileAdmin = require('./src/hr-central/role-profiles');
exports.createRoleProfile     = roleProfileAdmin.createRoleProfile;
exports.updateRoleProfile     = roleProfileAdmin.updateRoleProfile;
exports.archiveRoleProfile    = roleProfileAdmin.archiveRoleProfile;
exports.assignEmployeeToRole  = roleProfileAdmin.assignEmployeeToRole;
exports.endRoleAssignment     = roleProfileAdmin.endRoleAssignment;

// Phase 6.D — ECD approval ladder (Addendum v1.1 §7 / change C5).
exports.advanceApprovalRung = assignment.advanceApprovalRung;
exports.rejectApprovalRung = assignment.rejectApprovalRung;

// Phase 6.D — CES (Cost Estimate Sheet) lifecycle (Addendum v1.1 §8 / change C7).
const { postCesLineItem, signOffCes } = require('./src/pricing/cesLifecycle');
exports.postCesLineItem = postCesLineItem;
exports.signOffCes = signOffCes;

// Domain-event outbox consumer (logs + marks processed; richer
// consumers wired in Phase 3.D/3.F).
const { onDomainEventCreated } = require('./src/platform/outbox');
exports.onDomainEventCreated = onDomainEventCreated;

// Phase 6.E — Event/Task engine. Fans every domain_event into
// generated_tasks per matching EventDefinition rules (closes v1.2
// subsystem B). Runs in parallel with onDomainEventCreated; tags
// processedBy: ['task-generator'] for at-least-once dispatch.
const { onDomainEventTaskGenerator } = require('./src/event-task-engine/onDomainEventTaskGenerator');
exports.onDomainEventTaskGenerator = onDomainEventTaskGenerator;

// ============================================================
// Account Management — Phase 3.D (Commercial-core UI backing)
// ============================================================
// Contracts mutations (MSA / SOW / ChangeOrder / Client) plus the
// `openMasterJobOnQuoteAccepted` outbox listener that lights up a
// master_job the moment 3.C emits a `QuoteAccepted` event. All
// callables reject SUBSIDIARY principals via `assertParentOrgPrincipal`
// (spec §7.4 layer 2).
const { upsertClient } = require('./src/contracts/clientAdmin');
const { upsertMsa, activateMsa } = require('./src/contracts/msaAdmin');
const {
  upsertSow,
  submitSowForApproval,
  approveSow,
  cancelSow,
} = require('./src/contracts/sowAdmin');
const {
  upsertChangeOrder,
  approveChangeOrder,
  rejectChangeOrder,
} = require('./src/contracts/changeOrderAdmin');
exports.upsertClient = upsertClient;
exports.upsertMsa = upsertMsa;
exports.activateMsa = activateMsa;
exports.upsertSow = upsertSow;
exports.submitSowForApproval = submitSowForApproval;
exports.approveSow = approveSow;
exports.cancelSow = cancelSow;
exports.upsertChangeOrder = upsertChangeOrder;
exports.approveChangeOrder = approveChangeOrder;
exports.rejectChangeOrder = rejectChangeOrder;
exports.openMasterJobOnQuoteAccepted = assignment.openMasterJobOnQuoteAccepted;
exports.signAcceptanceCriterion = assignment.signAcceptanceCriterion;

// ============================================================
// Phase 4.1 — Procurement / Finance handshake (plan §15)
// ============================================================
// Three outbox consumers that close the Phase 4 acceptance gate
// "supplier invoice triggers PO + journal entry". Currently
// scaffolded — bodies are documented TODOs, but the triggers are
// real so events aren't silently dropped. See
// docs/PHASE_4_1_HANDSHAKE.md for the implementation contract.
const { onTalentInvoiceApproved } = require('./src/talent/onTalentInvoiceApproved');
const { onMediaSupplierInvoicePaid } = require('./src/media/onMediaSupplierInvoicePaid');
const { postJournalEntryOnInvoicePaid } = require('./src/finance/postJournalEntryOnInvoicePaid');
exports.onTalentInvoiceApproved = onTalentInvoiceApproved;
exports.onMediaSupplierInvoicePaid = onMediaSupplierInvoicePaid;
exports.postJournalEntryOnInvoicePaid = postJournalEntryOnInvoicePaid;

// ============================================================
// Finance — Group consolidation rollup (Phase 1.2)
// ============================================================
// Multi-currency consolidation of the 5 sibling brands onto Zeus's
// native ledger (gl_postings → P&L/BS/CF), FX-converted to a group
// presentation currency, with auto-derived intercompany eliminations.
// Writes companies/zeus-group/rollups/{YYYY-MM}. `runGroupRollupNow`
// is parent-org-only (commercial scope).
const {
  groupFinancialRollup,
  runGroupRollupNow,
} = require('./src/finance/groupRollup');
exports.groupFinancialRollup = groupFinancialRollup;
exports.runGroupRollupNow = runGroupRollupNow;

// ============================================================
// Billing — Phase 3.F (client invoices + GL adapter)
// ============================================================
// AM-driven client-invoice lifecycle (generate → issue → record
// payment) plus the GL-posting consumer for the IC invoices that
// 3.B raises on IWO close. The IC invoice itself is raised inside
// 3.B's closeWorkOrder transaction; this module owns the cross-
// entity GL posting that 3.B explicitly defers to "the Phase 3.F
// billing-run consumer". QBO/Xero connectors still deferred to
// Phase 5 — today the GL audit-trail adapter writes to gl_postings/.
const { issueClientInvoice } = require('./src/billing/issueClientInvoice');
const { recordClientPayment } = require('./src/billing/recordClientPayment');
const { generateClientInvoice } = require('./src/billing/generateClientInvoice');
const {
  onIntercompanyInvoiceCreated,
} = require('./src/billing/onIntercompanyInvoiceCreated');
exports.issueClientInvoice = issueClientInvoice;
exports.recordClientPayment = recordClientPayment;
exports.generateClientInvoice = generateClientInvoice;
exports.onIntercompanyInvoiceCreated = onIntercompanyInvoiceCreated;

// ============================================================
// Asset Library — Phase 5.C (DAM-lite)
// ============================================================
// `onAssetUploaded` — Storage trigger that generates 200x200 and
// 800x800 thumbnails when staff upload a raster image. Populates
// `thumbnailUrl` and `previewUrl` on the matching asset_library_items
// doc.
// `onAssetDeleted` — Firestore trigger that sweeps the Storage tree
// (source + thumb + preview) and revokes outstanding share links
// when an asset doc is deleted.
// `resolveShareLink` — public HTTPS endpoint that resolves a share
// token to a fresh signed Storage URL. Validates expiry + revocation
// in Firestore; never exposes the underlying object directly.
const { onAssetUploaded } = require('./src/asset-library/onAssetUploaded');
const { onAssetDeleted } = require('./src/asset-library/onAssetDeleted');
const { resolveShareLink } = require('./src/asset-library/resolveShareLink');
exports.onAssetUploaded = onAssetUploaded;
exports.onAssetDeleted = onAssetDeleted;
exports.resolveShareLink = resolveShareLink;
