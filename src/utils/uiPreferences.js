/**
 * uiPreferences.js
 * Manages persistent UI state: mode, active tab, column visibility, and any
 * future per-session preferences. Saved to .app-state/ui_preferences.json
 * via Electron IPC so the app restores exactly as the user left it.
 */

import { ALL_COLUMNS, DEFAULT_VISIBLE_KEYS } from '../components/SplitLR/DataTable';

const DEFAULT_HIDDEN_BASE = ALL_COLUMNS
  .map(c => c.key)
  .filter(k => !DEFAULT_VISIBLE_KEYS.has(k));

const DEFAULT_UI_PREFS = {
  version: 2,
  mode: 'reconstructed',
  activeTab: 'split-lr',
  splitLR: {
    hiddenColumns: [...DEFAULT_HIDDEN_BASE],
  },
  matchPMIS: {
    hiddenColumns: [...DEFAULT_HIDDEN_BASE],
  },
  verify: {
    hiddenColumns: [...DEFAULT_HIDDEN_BASE],
  },
  sourceFiles: {
    repaired: null,
    inservice: null,
    pmis: null,
  },
};

/**
 * Load UI preferences from disk.
 * Falls back to defaults if the file doesn't exist or can't be parsed.
 * @returns {Promise<Object>}
 */
export async function loadUIPrefs() {
  if (!window.electronAPI) return structuredClone(DEFAULT_UI_PREFS);
  try {
    let stored = await window.electronAPI.readUIPrefs();
    if (!stored) return structuredClone(DEFAULT_UI_PREFS);
    
    // Migrate v1 to v2 (semantic change for hiddenColumns)
    if (!stored.version || stored.version < 2) {
      stored.version = 2;
      if (stored.splitLR && (!stored.splitLR.hiddenColumns || stored.splitLR.hiddenColumns.length === 0)) {
        stored.splitLR.hiddenColumns = [...DEFAULT_HIDDEN_BASE];
      }
      if (stored.matchPMIS && (!stored.matchPMIS.hiddenColumns || stored.matchPMIS.hiddenColumns.length === 0)) {
        stored.matchPMIS.hiddenColumns = [...DEFAULT_HIDDEN_BASE];
      }
    }

    // Deep-merge with defaults to handle schema additions across app versions
    return {
      ...DEFAULT_UI_PREFS,
      ...stored,
      splitLR: {
        ...DEFAULT_UI_PREFS.splitLR,
        ...(stored.splitLR || {}),
      },
      matchPMIS: {
        ...DEFAULT_UI_PREFS.matchPMIS,
        ...(stored.matchPMIS || {}),
      },
      verify: {
        ...DEFAULT_UI_PREFS.verify,
        ...(stored.verify || {}),
      },
      sourceFiles: {
        ...DEFAULT_UI_PREFS.sourceFiles,
        ...(stored.sourceFiles || {}),
      },
    };
  } catch {
    return structuredClone(DEFAULT_UI_PREFS);
  }
}

/**
 * Save the current UI preferences to disk.
 * Called whenever the user changes mode, tab, column visibility, etc.
 * @param {Object} prefs
 */
export async function saveUIPrefs(prefs) {
  if (!window.electronAPI) return;
  try {
    await window.electronAPI.writeUIPrefs(prefs);
  } catch (err) {
    console.warn('Could not save UI preferences:', err);
  }
}

/**
 * Build an updated prefs object patching only the splitLR section.
 * @param {Object} current  - Existing prefs
 * @param {Object} patch    - Partial splitLR update, e.g. { hiddenColumns: [...] }
 * @returns {Object}
 */
export function patchSplitLRPrefs(current, patch) {
  return {
    ...current,
    splitLR: { ...current.splitLR, ...patch },
  };
}

export function patchMatchPMISPrefs(current, patch) {
  return {
    ...current,
    matchPMIS: { ...current.matchPMIS, ...patch },
  };
}

export function patchVerifyPrefs(current, patch) {
  return {
    ...current,
    verify: { ...current.verify, ...patch },
  };
}

export function patchSourceFilesPrefs(current, patch) {
  return {
    ...current,
    sourceFiles: { ...current.sourceFiles, ...patch },
  };
}
