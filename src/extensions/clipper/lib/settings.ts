/**
 * Chrome Storage Settings Layer
 * Uses chrome.storage.sync for cross-device sync of user preferences
 */

export interface ClipperSettings {
  // Image detection
  autoDetectImages: boolean;
  minImageSize: number;
  detectBackgroundImages: boolean;

  // AI analysis
  autoAnalyze: boolean;
  analysisProvider: 'gemini' | 'none';

  // Sync
  syncEnabled: boolean;
  syncOnWifiOnly: boolean;
  autoSyncInterval: number; // minutes

  // UI preferences
  defaultView: 'grid' | 'list';
  showSyncStatus: boolean;
  confirmBeforeDelete: boolean;

  // Default project
  defaultProjectId?: string;

  // Schema version for migrations
  schemaVersion: number;
}

export const DEFAULT_SETTINGS: ClipperSettings = {
  autoDetectImages: true,
  minImageSize: 200,
  detectBackgroundImages: true,

  autoAnalyze: true,
  analysisProvider: 'gemini',

  syncEnabled: true,
  syncOnWifiOnly: false,
  autoSyncInterval: 5,

  defaultView: 'grid',
  showSyncStatus: true,
  confirmBeforeDelete: true,

  defaultProjectId: undefined,

  schemaVersion: 1,
};

const SETTINGS_KEY = 'clipperSettings';
const CURRENT_SCHEMA_VERSION = 1;

/**
 * Get all settings, with defaults for missing values
 */
export async function getSettings(): Promise<ClipperSettings> {
  return new Promise((resolve) => {
    chrome.storage.sync.get([SETTINGS_KEY], (result: any) => {
      const stored = result[SETTINGS_KEY] || {};
      const settings = { ...DEFAULT_SETTINGS, ...stored };

      // Run migrations if needed
      if (settings.schemaVersion < CURRENT_SCHEMA_VERSION) {
        const migrated = migrateSettings(settings);
        updateSettings(migrated).then(() => resolve(migrated));
      } else {
        resolve(settings);
      }
    });
  });
}

/**
 * Get a specific setting value
 */
export async function getSetting<K extends keyof ClipperSettings>(
  key: K
): Promise<ClipperSettings[K]> {
  const settings = await getSettings();
  return settings[key];
}

/**
 * Update one or more settings
 */
export async function updateSettings(
  updates: Partial<ClipperSettings>
): Promise<void> {
  const current = await getSettings();
  const updated = { ...current, ...updates };

  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: updated }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Reset all settings to defaults
 */
export async function resetSettings(): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Listen for settings changes
 */
export function onSettingsChanged(
  callback: (newSettings: ClipperSettings, oldSettings: ClipperSettings) => void
): () => void {
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: string
  ) => {
    if (area === 'sync' && changes[SETTINGS_KEY]) {
      const oldSettings = { ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].oldValue };
      const newSettings = { ...DEFAULT_SETTINGS, ...changes[SETTINGS_KEY].newValue };
      callback(newSettings, oldSettings);
    }
  };

  chrome.storage.onChanged.addListener(listener);

  // Return unsubscribe function
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Migrate settings from older schema versions
 */
function migrateSettings(settings: ClipperSettings): ClipperSettings {
  let migrated = { ...settings };

  // Example migration from version 0 to 1
  // if (migrated.schemaVersion < 1) {
  //   // Add new fields with defaults
  //   migrated = { ...DEFAULT_SETTINGS, ...migrated };
  //   migrated.schemaVersion = 1;
  // }

  // Always update to current version
  migrated.schemaVersion = CURRENT_SCHEMA_VERSION;

  return migrated;
}

/**
 * Export settings as JSON (for backup)
 */
export async function exportSettings(): Promise<string> {
  const settings = await getSettings();
  return JSON.stringify(settings, null, 2);
}

/**
 * Import settings from JSON (for restore)
 */
export async function importSettings(json: string): Promise<void> {
  try {
    const settings = JSON.parse(json) as Partial<ClipperSettings>;
    await updateSettings(settings);
  } catch {
    throw new Error('Invalid settings JSON');
  }
}
