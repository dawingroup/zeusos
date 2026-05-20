/**
 * FIREBASE MODULE INDEX
 * 
 * Re-exports all firebase utilities for the advisory platform
 */

// Collections and paths
export * from './collections';
export { COLLECTION_PATHS, paths } from './collections';

// Type converters
export * from './converters';

// Query helpers
export * from './queries';

// Index definitions
export * from './indexes';
export { REQUIRED_INDEXES, generateIndexConfig } from './indexes';
