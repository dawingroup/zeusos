/**
 * DOCUMENT SERVICE - Public API
 */

// Types
export * from './document-types';

// Service
export { DocumentService, documentService } from './document-service';

// Hooks
export {
  useDocument,
  useDocuments,
  useEntityDocuments,
  useDocumentUpload,
  useDocumentMutations,
  useVersionHistory,
  useDocumentActivity,
  useFolders,
  useShareLink,
  useDocumentSearch,
  useDocumentAccess,
  useDocumentStats,
} from './document-hooks';
