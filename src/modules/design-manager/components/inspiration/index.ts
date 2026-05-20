/**
 * Inspiration Components
 * Re-exports from clipper for use in design-manager module
 */

// Components
export { ManualUploadDialog } from '@/subsidiaries/finishes/clipper/components/ManualUploadDialog';
export { SearchResultCard } from '@/subsidiaries/finishes/clipper/components/SearchResultCard';

// Hooks
export { useManualUpload } from '@/subsidiaries/finishes/clipper/hooks/useManualUpload';
export type { UploadStep } from '@/subsidiaries/finishes/clipper/hooks/useManualUpload';

// Local hook
export { useInspirationUpload } from '../../hooks/useInspirationUpload';

// Types
export type {
  DesignClip,
  ClipType,
  ClipAIAnalysis,
  ReverseSearchMatch,
} from '@/subsidiaries/finishes/clipper/types';
