/**
 * stateStore.js
 * Persists and restores split processing progress between sessions.
 * Uses Firestore for Cloud Projects, LocalStorage for Web Browser, and Electron IPC for Desktop.
 */

import { getActiveProjectId, loadProjectStateFromCloud, saveProjectStateToCloud } from './projectStore';

const LOCAL_STORAGE_KEY = 'service_life_app_state_v1';

const DEFAULT_STATE = {
  version: 1,
  reconstructed: {
    processedSNs: [],   // Array<string>
    errorSNs: [],       // Array<string>
    rows: [],           // Cached processed rows
    errors: [],         // Cached error log entries
    pmisRows: [],       // Cached matched PMIS rows
    pmisAvailableYears: [], // Dynamic years array
    verifiedSNs: [],    // Array<string>
    actualEndOfLifeMap: {}, // Object: { [sn]: year }
    lastUpdated: null,
  },
  inservice: {
    processedSNs: [],
    errorSNs: [],
    rows: [],
    errors: [],
    pmisRows: [],
    pmisAvailableYears: [],
    verifiedSNs: [],
    actualEndOfLifeMap: {},
    lastUpdated: null,
  },
  trafficAnalysis: {}
};

/**
 * Load persisted state from Cloud Project, Desktop disk, or Browser LocalStorage.
 * @returns {Promise<Object>} State object
 */
export async function loadState() {
  const activeProjectId = getActiveProjectId();

  // 1. Try loading from active cloud project if set
  if (activeProjectId) {
    try {
      const cloudRes = await loadProjectStateFromCloud(activeProjectId);
      if (cloudRes && cloudRes.state) {
        return {
          ...DEFAULT_STATE,
          ...cloudRes.state,
          reconstructed: { ...DEFAULT_STATE.reconstructed, ...(cloudRes.state.reconstructed || {}) },
          inservice: { ...DEFAULT_STATE.inservice, ...(cloudRes.state.inservice || {}) },
          trafficAnalysis: cloudRes.state.trafficAnalysis || {}
        };
      }
    } catch (err) {
      console.warn('Could not read cloud project state:', err);
    }
  }

  // 2. Desktop Electron disk state fallback
  if (window.electronAPI?.readState) {
    try {
      const stored = await window.electronAPI.readState();
      if (stored) {
        return {
          ...DEFAULT_STATE,
          ...stored,
          reconstructed: { ...DEFAULT_STATE.reconstructed, ...(stored.reconstructed || {}) },
          inservice: { ...DEFAULT_STATE.inservice, ...(stored.inservice || {}) },
          trafficAnalysis: stored.trafficAnalysis || {}
        };
      }
    } catch (err) {
      console.warn('Could not read local disk state:', err);
    }
  }

  // 3. Web Browser LocalStorage fallback
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_STATE,
        ...parsed,
        reconstructed: { ...DEFAULT_STATE.reconstructed, ...(parsed.reconstructed || {}) },
        inservice: { ...DEFAULT_STATE.inservice, ...(parsed.inservice || {}) },
        trafficAnalysis: parsed.trafficAnalysis || {}
      };
    }
  } catch (err) {
    console.warn('Could not read browser LocalStorage state:', err);
  }

  return structuredClone(DEFAULT_STATE);
}

/**
 * Save state to Cloud Project, Desktop disk, and Browser LocalStorage.
 * @param {Object} state
 */
export async function saveState(state) {
  // 1. Save to browser LocalStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Failed saving state to LocalStorage:', err);
  }

  // 2. Save to local disk for desktop offline resilience
  if (window.electronAPI?.writeState) {
    try {
      await window.electronAPI.writeState(state);
    } catch (err) {
      console.warn('Failed writing to local disk state:', err);
    }
  }

  // 3. Sync to active Cloud Project if logged in & active project is set
  const activeProjectId = getActiveProjectId();
  if (activeProjectId) {
    await saveProjectStateToCloud(activeProjectId, state);
  }
}

/**
 * Update the state for a specific mode after processing.
 * @param {Object} prevState
 * @param {'reconstructed'|'inservice'} mode
 * @param {Object} update - { rows, errors, newlyProcessed }
 * @returns {Object} New state
 */
export function buildUpdatedState(prevState, mode, { rows, errors, newlyProcessed }) {
  const modeKey = mode === 'reconstructed' ? 'reconstructed' : 'inservice';
  const existing = prevState[modeKey] || DEFAULT_STATE[modeKey];

  const processedSet = new Set([...(existing.processedSNs || []), ...newlyProcessed]);
  const errorSNs = errors.map(e => e.sn);

  return {
    ...prevState,
    [modeKey]: {
      ...existing,
      processedSNs: Array.from(processedSet),
      errorSNs,
      rows,
      errors,
      lastUpdated: new Date().toISOString(),
    },
  };
}
