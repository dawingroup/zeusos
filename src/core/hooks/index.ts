/**
 * Shared Hooks
 * Common React hooks used across all modules
 */

export { useAuth, type AuthState, type UseAuthReturn } from './useAuth';
export { 
  useDocument, 
  useCollection, 
  useFirestoreMutation,
  type UseDocumentReturn,
  type UseCollectionReturn
} from './useFirestore';

export { useCrossModule, type UseCrossModuleOptions } from './useCrossModule';
export { useGlobalSearch, type UseSearchOptions } from './useSearch';
export { useSync, type UseSyncOptions } from './useSync';
export { useKeyboardShortcuts, useCustomShortcut } from './useKeyboardShortcuts';
