/**
 * stateStore.js
 * Persists and restores split processing progress between sessions.
 * Uses Electron IPC for local offline disk cache and Firebase Firestore for cloud project sync.
 */

import { getActiveProjectId, loadProjectStateFromCloud, saveProjectStateToCloud } from './projectStore';

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
 * Load persisted state from active Cloud Project or local disk.
 * @returns {Promise<Object>} State object
 */
export async function loadState() {
  const activeProjectId = getActiveProjectId();

  // Try loading from active cloud project if set
  if (activeProjectId) {
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
  }

  // Fallback to local Electron disk state
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

  return structuredClone(DEFAULT_STATE);
}

/**
 * Save state to local disk and sync to active Cloud Project.
 * @param {Object} state
 */
export async function saveState(state) {
  // 1. Save to local disk for offline resilience
  if (window.electronAPI?.writeState) {
    try {
      await window.electronAPI.writeState(state);
    } catch (err) {
      console.warn('Failed writing to local disk state:', err);
    }
  }

  // 2. Sync to active Cloud Project if logged in & active project is set
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
