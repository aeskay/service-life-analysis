/**
 * MatchPMISWorkspace.jsx
 * Orchestrates the matching of Split L/R rows against the PMIS database.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MatchPMISTable from './MatchPMISTable';
import { loadPMISDataForMatching, clearPMISCache } from '../../utils/fileLoader';
import { matchPMIS } from '../../utils/pmisMatcher';
import { loadState, saveState } from '../../utils/stateStore';
import { exportToExcel, generateExportFilename } from '../../utils/exporter';
import ColumnToggle from '../SplitLR/ColumnToggle';
import DetailModal from '../SplitLR/DetailModal';
import { ALL_COLUMNS, DEFAULT_VISIBLE_KEYS } from '../SplitLR/DataTable';
import { patchMatchPMISPrefs } from '../../utils/uiPreferences';

const PMIS_TOGGLE_COLUMNS = [
  ...ALL_COLUMNS,
  { key: 'pmis_years', label: 'PMIS Years', className: '' }
];

const RefreshIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M4 4v5h5" /><path d="M16 16v-5h-5" />
    <path d="M16.94 7.99A8 8 0 0 0 3.66 3.31M3.06 12.01a8 8 0 0 0 13.28 4.68" />
  </svg>
);

const ExportIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M3 14v2.25C3 17.32 3.68 18 4.75 18h10.5C16.32 18 17 17.32 17 16.25V14" />
    <path d="M10 3v10M10 13l-3.5-3.5M10 13l3.5-3.5" />
  </svg>
);

export default function MatchPMISWorkspace({ mode, addToast, uiPrefs, onUIPrefsChange }) {
  const [rows, setRows] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setStep] = useState('');
  const [modalIndex, setModal] = useState(null);
  const [visibleKeys, setVisibleKeys] = useState(() => {
    const hidden = uiPrefs?.matchPMIS?.hiddenColumns || [];
    const base = new Set(PMIS_TOGGLE_COLUMNS.map(c => c.key));
    hidden.forEach(k => base.delete(k));
    return base;
  });

  // ─── Dynamically filter columns based on available data ───────────────────
  const dataKeys = useMemo(() => rows.length > 0 ? new Set(Object.keys(rows[0])) : new Set(), [rows]);
  const activeColumns = useMemo(() => {
    const predefinedKeys = new Set(PMIS_TOGGLE_COLUMNS.map(c => c.key));
    const dynamicCols = [];
    for (const k of dataKeys) {
      if (!predefinedKeys.has(k) && !/^\d{4}$/.test(k)) {
        dynamicCols.push({ key: k, label: k, className: '' });
      }
    }
    return [
      ...PMIS_TOGGLE_COLUMNS.filter(c => c.key.startsWith('_') || c.key === 'pmis_years' || dataKeys.has(c.key)),
      ...dynamicCols
    ];
  }, [dataKeys]);

  // Load state and UI prefs on mount
  useEffect(() => {
    let active = true;
    async function init() {
      setIsLoading(true);
      try {
        const state = await loadState();
        const modeKey = mode === 'reconstructed' ? 'reconstructed' : 'inservice';
        if (active && state[modeKey]) {
          setRows(state[modeKey].pmisRows || []);
          setAvailableYears(state[modeKey].pmisAvailableYears || []);
        }
      } catch (err) {
        console.error('Failed to load PMIS state:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [mode]); // Re-run when mode changes

  // Handle column visibility changes
  const handleColumnsChange = useCallback((nextVisibleKeys) => {
    setVisibleKeys(nextVisibleKeys);
    
    // Save to uiPreferences
    const hidden = PMIS_TOGGLE_COLUMNS
      .map(c => c.key)
      .filter(k => !nextVisibleKeys.has(k));
      
    if (onUIPrefsChange) {
      onUIPrefsChange(prev => patchMatchPMISPrefs(prev, { hiddenColumns: hidden }));
    }
  }, [onUIPrefsChange]);
  
  // ─── Modal helpers ───────────────────────────────────────────────────────────
  const openModal  = useCallback((idx) => setModal(idx), []);
  const closeModal = useCallback(() => setModal(null), []);
  const prevModal  = useCallback(() => setModal(i => Math.max(0, i - 1)), []);
  const nextModal  = useCallback(() => setModal(i => Math.min(rows.length - 1, i + 1)), [rows.length]);

  const handleUpdate = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      setStep('Loading Split L/R output…');
      const state = await loadState();
      const modeKey = mode === 'reconstructed' ? 'reconstructed' : 'inservice';
      const splitRows = state[modeKey]?.rows || [];

      if (splitRows.length === 0) {
        addToast('warning', 'No Split Data', 'You must process files in the Split L/R tab first.');
        return;
      }

      setStep('Parsing PMIS database (168MB) — this takes a few seconds…');
      // Force dump the memory cache so we read the freshest PMIS file on disk
      clearPMISCache();
      // Takes ~3-5 seconds depending on machine
      const { pmisMap, availableYears: years } = await loadPMISDataForMatching();
      setAvailableYears(years);

      setStep(`Matching PMIS ranges across ${years.length} years…`);
      // Very fast operation once data is mapped
      const matchedData = matchPMIS(splitRows, pmisMap, years);

      setRows(matchedData);
      
      // Save to state store so they don't vanish on tab switch
      const updatedState = {
        ...state,
        [modeKey]: {
          ...state[modeKey],
          pmisRows: matchedData,
          pmisAvailableYears: years,
        }
      };
      await saveState(updatedState);
      
      addToast('success', 'PMIS Match Complete', `Matched ${splitRows.length} sections across ${years.length} years.`);
    } catch (err) {
      console.error('PMIS Match failed:', err);
      addToast('error', 'Matching Failed', err.message || String(err));
    } finally {
      setIsLoading(false);
      setStep('');
    }
  }, [isLoading, mode, addToast]);

  const handleExport = useCallback(async () => {
    if (!rows.length) { addToast('warning', 'Nothing to Export', 'Run matching first.'); return; }
    try {
      setStep('Preparing export…');
      const filename = generateExportFilename(mode).replace('split', 'pmis-match');
      const savedPath = await exportToExcel(rows, filename);
      if (savedPath) addToast('success', 'Export Complete', `Saved to: ${savedPath}`);
    } catch (err) {
      addToast('error', 'Export Failed', err.message || String(err));
    } finally { setStep(''); }
  }, [rows, mode, addToast]);

  return (
    <div className="workspace">
      {/* Toolbar */}
      <div className="workspace__toolbar">
        <div className="workspace__toolbar-left">
          <div>
            <div className="workspace__title">Match PMIS</div>
            <div className="workspace__subtitle">
              Input: {mode === 'reconstructed' ? 'repaired.xlsx (Split)' : 'in-service.xlsx (Split)'}
            </div>
          </div>
        </div>
        <div className="workspace__toolbar-right">
          <ColumnToggle
            allColumns={activeColumns}
            visibleKeys={visibleKeys}
            onChange={handleColumnsChange}
          />

          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />

          <button
            id="update-from-split-btn"
            className="btn btn--primary"
            onClick={handleUpdate}
            disabled={isLoading}
          >
            {isLoading ? <span className="spinner" /> : <RefreshIcon />}
            Update from Split Tab
          </button>
          
          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />

          <button
            id="export-pmis-btn"
            className="btn btn--success"
            onClick={handleExport}
            disabled={isLoading || rows.length === 0}
          >
            <ExportIcon />
            Export to Excel
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="workspace__body" style={{ position: 'relative' }}>
        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-overlay__content">
              <div className="loading-overlay__spinner" />
              <div className="loading-overlay__text">{loadingStep || 'Processing…'}</div>
            </div>
          </div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="M3 15h6" />
                <path d="M3 18h6" />
              </svg>
            </div>
            <div className="empty-state__title">No Matches Loaded</div>
            <div className="empty-state__desc">
              Click <strong>Update from Split Tab</strong> to use your processed {mode === 'reconstructed' ? 'repaired.xlsx' : 'in-service.xlsx'} data and find range overlaps in the PMIS database from 1996 to 2024.
            </div>
            <button
              className="btn btn--primary"
              onClick={handleUpdate}
              disabled={isLoading}
            >
              <RefreshIcon />
              Update from Split Tab
            </button>
          </div>
        )}

        {rows.length > 0 && (
          <MatchPMISTable 
            rows={rows} 
            availableYears={availableYears} 
            visibleKeys={visibleKeys} 
            onRowClick={openModal}
            activeColumns={activeColumns}
          />
        )}
      </div>

      {/* Detail modal */}
      {modalIndex !== null && (
        <DetailModal
          rows={rows}
          currentIndex={modalIndex}
          onClose={closeModal}
          onPrev={prevModal}
          onNext={nextModal}
        />
      )}
    </div>
  );
}
