/**
 * MatFlow Module - Central Export
 * Material flow tracking and management for construction projects
 */

// Types
export * from './types';

// Hooks - Offline
export { useNetworkStatus } from './hooks/useNetworkStatus';
export { useSyncStatus } from './hooks/useSyncStatus';

// Hooks - Mobile
export {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useBreakpoint,
  useIsTouchDevice,
  useViewportSize,
  BREAKPOINTS,
} from './hooks/useMediaQuery';

// Hooks - Push Notifications
export { usePushNotifications } from './hooks/usePushNotifications';

// Services - Offline
export {
  initializeOfflinePersistence,
  goOffline,
  goOnline,
  waitForSync,
  onSyncComplete,
  estimateCacheSize,
  requestPersistentStorage,
  clearCache,
  getPersistenceStatus,
} from './services/offlineConfig';

export {
  syncQueueService,
  queueOperation,
  getPendingOperations,
  getPendingCount,
  processSyncQueue,
  getSyncErrors,
  retryFailedOperations,
} from './services/syncQueueService';

export {
  offlineAwareService,
  getDocOffline,
  queryDocsOffline,
  setDocOffline,
  createDocOffline,
  updateDocOffline,
  deleteDocOffline,
} from './services/offlineAwareService';

// Services - Push Notifications
export {
  pushNotificationService,
  isPushSupported,
  getPermissionStatus,
  requestPermission,
  subscribeToPush,
  unsubscribeFromPush,
  showDeliveryNotification,
  showSyncNotification,
} from './services/pushNotificationService';

// Services - Service Worker
export {
  serviceWorkerRegistration,
  checkForUpdate,
  skipWaiting,
  requestBackgroundSync,
} from './services/serviceWorkerRegistration';

// Components - Offline
export { OfflineIndicator } from './components/offline';

// Components - Mobile
export {
  MobileNav,
  MobileQuickActions,
  MobileBOQList,
  MobileDeliveryForm,
  MobileDashboard,
  MobileLayout,
} from './components/mobile';

// Components - PWA
export {
  NotificationPrompt,
  NotificationSettings,
  UpdatePrompt,
  InstallPrompt,
  IOSInstallInstructions,
} from './components/pwa';

// Components - Stages
export {
  StageProgressBar,
  StageTimeline,
  ProjectStagesOverview,
} from './components/stages';

// Services - EFRIS Tax Validation
export {
  efrisService,
  parseFDN,
  isValidFDN,
  validateInvoice,
  validateAndSaveInvoice,
  calculateInvoiceMatch,
  getProjectValidations,
  getDeliveryValidation,
  revalidateInvoice,
  verifySupplierTIN,
  saveSupplierTaxProfile,
  getSupplierTaxProfile,
  calculateTaxComplianceSummary,
  batchValidatePending,
} from './services/efrisService';

// Hooks - EFRIS
export {
  useEFRISValidation,
  useDeliveryValidation,
  useFDNInput,
  useTaxComplianceSummary,
  useSupplierTINVerification,
  useFilteredValidations,
} from './hooks/useEFRIS';

// Components - EFRIS
export {
  EFRISValidationBadge,
  FDNInput,
  InvoiceValidationCard,
  TaxComplianceDashboard,
} from './components/efris';

// Services - Export and Reporting
export {
  exportService,
  generateReport,
  getProjectReports,
  getReportById,
  deleteReport,
  incrementDownloadCount,
  saveReportTemplate,
  getReportTemplates,
  deleteReportTemplate,
  quickExportData,
} from './services/exportService';

// Hooks - Export
export {
  useExport,
  useReportTemplates,
  useQuickExport,
  useReportConfigBuilder,
  getDefaultTitle,
} from './hooks/useExport';

// Components - Export
export {
  ReportGenerator,
  ReportsList,
  QuickExportPanel,
} from './components/export';
