/**
 * uiPreferences.js
 * Manages persistent UI state: mode, active tab, column visibility, and any
 * future per-session preferences. Saved to Browser LocalStorage and Desktop disk.
 */

import { ALL_COLUMNS, DEFAULT_VISIBLE_KEYS } from '../components/SplitLR/DataTable';

const LOCAL_STORAGE_KEY = 'service_life_ui_prefs_v2';

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
 * Load UI preferences from Desktop disk or Browser LocalStorage.
 * @returns {Promise<Object>}
 */
export async function loadUIPrefs() {
  let stored = null;

  // 1. Desktop Electron bridge
  if (window.electronAPI?.readUIPrefs) {
    try {
      stored = await window.electronAPI.readUIPrefs();
    } catch (_) {}
  }

  // 2. Browser LocalStorage fallback
  if (!stored) {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch (_) {}
  }

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
}

/**
 * Save current UI preferences.
 * @param {Object} prefs
 */
export async function saveUIPrefs(prefs) {
  // 1. Browser LocalStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn('Could not save UI preferences to LocalStorage:', err);
  }

  // 2. Desktop Electron bridge
  if (window.electronAPI?.writeUIPrefs) {
    try {
      await window.electronAPI.writeUIPrefs(prefs);
    } catch (err) {
      console.warn('Could not save UI preferences to Desktop disk:', err);
    }
  }
}

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
