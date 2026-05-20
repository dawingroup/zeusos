/**
 * Configurator Constants
 */

export const CONFIGURATOR_MODES = ['workshop', 'client', 'embed'] as const;
export type ConfiguratorMode = (typeof CONFIGURATOR_MODES)[number];

export const MAX_CONFIGURATION_URL_LENGTH = 2048;

export const AR_MODEL_VIEWER_VERSION = '4.0';

export const SHARE_QR_SIZE_PX = 256;

export const PRICE_UPDATE_DEBOUNCE_MS = 300;

export const MOBILE_GLB_TARGET_KB = 2048;

export const PROGRESSIVE_LOAD_THRESHOLD_KB = 500;
