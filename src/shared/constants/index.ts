/**
 * App Constants
 * Application-wide constants and configuration values
 */

// API endpoints
export const API_ENDPOINTS = {
  // Add API endpoints here
} as const;

// Feature flags
export const FEATURES = {
  // Strategy Canvas Enhancements
  STRATEGY_GUIDED_WORKFLOW: true,                    // Enable guided 6-step workflow for strategy canvas
  STRATEGY_VALIDATION_UI: true,                      // Enable real-time validation feedback UI
  STRATEGY_SAVE_STATUS_INDICATORS: true,             // Enable enhanced save status indicators
  STRATEGY_CUSTOMER_INTELLIGENCE_AUTO_POPULATE: true, // Enable auto-population from customer intelligence
  STRATEGY_BUDGET_TIER_PRICING: true,                // Enable budget tier multipliers in estimates
  STRATEGY_CONSTRAINT_VALIDATION: true,              // Enable validation of items against strategy constraints
  STRATEGY_BOTTOM_UP_PRICING_INTEGRATION: true,      // Enable strategy integration in bottom-up pricing
  STRATEGY_LLM_SCOPING: false,                       // Enable hybrid regex + LLM scoping (backend required)

  // WhatsApp Communication
  WHATSAPP_ENABLED: true,                             // Enable WhatsApp messaging via Zoko API

  // Global Search
  GLOBAL_SEARCH_V2: true,                             // Client-side indexed search (Fuse.js + IndexedDB)
} as const;

// App configuration
export const APP_CONFIG = {
  APP_NAME: 'Dawin Design-to-Production',
  VERSION: '1.0.0',
} as const;
