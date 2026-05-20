// ============================================================================
// MSW SERVER
// DawinOS v2.0 - Testing Strategy
// Mock Service Worker server setup
// ============================================================================

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
