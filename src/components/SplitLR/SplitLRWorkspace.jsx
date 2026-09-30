/**
 * SplitLRWorkspace.jsx — Main workspace for the Split L/R module.
 *
 * All state (processed rows, errors, column visibility) is loaded from
 * disk on mount and auto-saved on every change, so nothing is ever lost
 * between sessions.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import DataTable, { ALL_COLUMNS, DEFAULT_VISIBLE_KEYS } from './DataTable';
import ColumnToggle from './ColumnToggle';
import DetailModal from './DetailModal';
import ErrorLogPanel from './ErrorLogPanel';
import { loadRepaired, loadInService, loadPMISHighways } from '../../utils/fileLoader';
import { processRows, mergeRows } from '../../utils/splitProcessor';
import { exportToExcel, generateExportFilename } from '../../utils/exporter';
import { loadState, saveState, buildUpdatedState } from '../../utils/stateStore';
import { loadUIPrefs, saveUIPrefs, patchSplitLRPrefs } from '../../utils/uiPreferences';

// ─── Icons ─────────────────────────────────────────────────────────────────────
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

const TrashIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M3 6h14" />
    <path d="M8 6V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2L1 6" />
    <path d="M10 11v5" /><path d="M14 11v5" /><path d="M6 11v5" />
  </svg>
);

export default function SplitLRWorkspace({ mode, onErrorCountChange, addToast, uiPrefs, onUIPrefsChange }) {
  // ─── Data state ─────────────────────────────────────────────────────────────
  const [rows, setRows]           = useState([]);
  const [errors, setErrors]       = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setStep]    = useState('');
  const [modalIndex, setModal]    = useState(null);
  const [appState, setAppState]   = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ─── Column visibility — restored from uiPrefs ────────────────────────────
  const [visibleKeys, setVisibleKeys] = useState(() => {
    const hidden = uiPrefs?.splitLR?.hiddenColumns || [];
    const base = new Set(ALL_COLUMNS.map(c => c.key));
    hidden.forEach(k => base.delete(k));
    return base;
  });

  const pmisRef  = useRef(null);
  const modeKey  = mode === 'reconstructed' ? 'reconstructed' : 'inservice';

  // ─── Load persisted data on first mount ────────────────────────────────────
  useEffect(() => {
    loadState().then(state => {
      setAppState(state);
      const d = state[modeKey];
      if (d.rows.length > 0) {
        setRows(d.rows);
        setErrors(d.errors);
        onErrorCountChange(d.errors.length);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── When mode switches — reload from persisted state ─────────────────────
  useEffect(() => {
    if (!appState) return;
    const d = appState[modeKey];
    setRows(d.rows   || []);
    setErrors(d.errors || []);
    onErrorCountChange((d.errors || []).length);
    setSelectedIds(new Set());
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const dataKeys = useMemo(() => rows.length > 0 ? new Set(Object.keys(rows[0])) : new Set(), [rows]);
  const activeColumns = useMemo(() => {
    const predefinedKeys = new Set(ALL_COLUMNS.map(c => c.key));
    const dynamicCols = [];
    for (const k of dataKeys) {
      if (!predefinedKeys.has(k) && !/^\d{4}$/.test(k)) {
        dynamicCols.push({ key: k, label: k, className: '' });
      }
    }
    return [
      ...ALL_COLUMNS.filter(c => c.key.startsWith('_') || dataKeys.has(c.key)),
      ...dynamicCols
    ];
  }, [dataKeys]);

  // ─── Persist column visibility whenever it changes ────────────────────────
  const handleColumnChange = useCallback((newSet) => {
    setVisibleKeys(newSet);
    if (onUIPrefsChange) {
      const hiddenColumns = ALL_COLUMNS
        .map(c => c.key)
        .filter(k => !newSet.has(k));
      onUIPrefsChange(prev => patchSplitLRPrefs(prev, { hiddenColumns }));
    }
  }, [onUIPrefsChange]);

  // ─── Update from Source ────────────────────────────────────────────────────
  const handleUpdateFromSource = useCallback(async (force = false) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      setStep(mode === 'reconstructed' ? 'Loading repaired.xlsx…' : 'Loading in-service.xlsx…');
      const sourceRows = mode === 'reconstructed' ? await loadRepaired() : await loadInService();

      if (!pmisRef.current) {
        setStep('Parsing PMIS.csv — this may take a moment for the 168 MB file…');
        pmisRef.current = await loadPMISHighways();
      }

      const state = appState || await loadState();
      const modeData = state[modeKey];
      
      // If force reprocess, we ignore what was already processed
      const alreadyProcessed = force ? new Set() : new Set(modeData.processedSNs || []);
      const previousErrors   = force ? [] : (modeData.errorSNs || []);

      setStep('Splitting highway entries…');
      const { rows: newRows, errors: newErrors, newlyProcessed } = processRows(
        sourceRows, pmisRef.current, alreadyProcessed, previousErrors
      );

      const reprocessedSNs = new Set(previousErrors);
      // If force, we just use newRows. If not, we merge.
      const merged = force ? newRows : mergeRows(modeData.rows || [], newRows, reprocessedSNs);

      const freshErrorSNs = new Set(newErrors.map(e => e.sn));
      const oldErrors = force ? [] : (modeData.errors || []).filter(
        e => !freshErrorSNs.has(e.sn) && !newlyProcessed.has(e.sn)
      );
      const combinedErrors = [...oldErrors, ...newErrors];

      setRows(merged);
      setErrors(combinedErrors);
      onErrorCountChange(combinedErrors.length);

      const updatedState = buildUpdatedState(state, mode, {
        rows: merged, errors: combinedErrors, newlyProcessed,
      });
      // If force, we wipe the processed list entirely to reset it
      if (force) {
         updatedState[modeKey].processedSNs = Array.from(newlyProcessed);
         // Prune pmisRows and verifiedSNs to only IDs that exist in the new rows
         const newRowIds = new Set(merged.map(r => String(r.ID || r['S/N'] || '')).filter(Boolean));
         updatedState[modeKey].pmisRows = (updatedState[modeKey].pmisRows || []).filter(
           r => newRowIds.has(String(r.ID || r['S/N'] || ''))
         );
         updatedState[modeKey].verifiedSNs = (updatedState[modeKey].verifiedSNs || []).filter(
           id => newRowIds.has(String(id))
         );
      }

      setAppState(updatedState);
      await saveState(updatedState);

      const newCount = force ? merged.length : newRows.length;
      const flagged  = combinedErrors.length;
      if (newCount === 0 && !force) {
        addToast('info', 'No New Rows', 'All source rows have already been processed.');
      } else {
        addToast(
          flagged > 0 ? 'warning' : 'success',
          force ? 'Reprocess Complete' : `Processed ${newCount} row${newCount !== 1 ? 's' : ''}`,
          flagged > 0
            ? `${merged.length} entries generated. ${flagged} not found in PMIS — see error log.`
            : `${merged.length} entries generated. All verified in PMIS.`
        );
      }
    } catch (err) {
      console.error('Update from source failed:', err);
      addToast('error', 'Processing Failed', err.message || String(err));
    } finally {
      setIsLoading(false);
      setStep('');
    }
  }, [isLoading, mode, appState, modeKey, onErrorCountChange, addToast]);

  // ─── Export to Excel ────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (!rows.length) { addToast('warning', 'Nothing to Export', 'Process source data first.'); return; }
    try {
      setStep('Preparing export…');
      const filename   = generateExportFilename(mode);
      const savedPath  = await exportToExcel(rows, filename);
      if (savedPath) addToast('success', 'Export Complete', `Saved to: ${savedPath}`);
    } catch (err) {
      addToast('error', 'Export Failed', err.message || String(err));
    } finally { setStep(''); }
  }, [rows, mode, addToast]);

  // ─── Clear error log ────────────────────────────────────────────────────────
  const handleClearErrors = useCallback(async () => {
    setErrors([]);
    onErrorCountChange(0);
    if (appState) {
      const updated = {
        ...appState,
        [modeKey]: { ...appState[modeKey], errors: [], errorSNs: [] },
      };
      setAppState(updated);
      await saveState(updated);
    }
  }, [appState, modeKey, onErrorCountChange]);

  // ─── Bulk Selection & Deletion ──────────────────────────────────────────────
  const handleSelectRow = useCallback((id, isSelected) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((isSelected) => {
    if (isSelected) {
      const allIds = rows.map((r, idx) => String(r.ID || r['S/N'] || idx));
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  }, [rows]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (window.confirm && !window.confirm(`Are you sure you want to delete ${count} selected row${count !== 1 ? 's' : ''}? This will remove them from the table and reset their processed state.`)) {
      return;
    }

    const deletedKeys = new Set();
    const remainingRows = [];

    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const key = String(r.ID || r['S/N'] || idx);
      if (selectedIds.has(key)) {
        if (r.ID) deletedKeys.add(String(r.ID));
        if (r['S/N']) deletedKeys.add(String(r['S/N']));
        if (r._originalSN) deletedKeys.add(String(r._originalSN));
      } else {
        remainingRows.push(r);
      }
    }

    const remainingErrors = errors.filter(e => !deletedKeys.has(String(e.sn)));

    setRows(remainingRows);
    setErrors(remainingErrors);
    onErrorCountChange(remainingErrors.length);
    setSelectedIds(new Set());

    const state = appState || await loadState();
    const modeData = state[modeKey] || {};
    const remainingProcessed = (modeData.processedSNs || []).filter(
      sn => !deletedKeys.has(String(sn))
    );
    const remainingErrorSNs = remainingErrors.map(e => e.sn);
    const remainingVerified = (modeData.verifiedSNs || []).filter(
      id => !deletedKeys.has(String(id))
    );
    const remainingPmisRows = (modeData.pmisRows || []).filter(
      r => !deletedKeys.has(String(r.ID || r['S/N'] || ''))
    );

    const updatedState = {
      ...state,
      [modeKey]: {
        ...modeData,
        rows: remainingRows,
        errors: remainingErrors,
        errorSNs: remainingErrorSNs,
        processedSNs: remainingProcessed,
        verifiedSNs: remainingVerified,
        pmisRows: remainingPmisRows,
        lastUpdated: new Date().toISOString(),
      },
    };

    setAppState(updatedState);
    await saveState(updatedState);
    addToast('info', 'Rows Deleted', `Deleted ${count} row${count !== 1 ? 's' : ''} from Split L/R.`);
  }, [selectedIds, rows, errors, appState, modeKey, onErrorCountChange, addToast]);

  const handleClearAll = useCallback(async () => {
    if (rows.length === 0) return;
    const count = rows.length;
    if (window.confirm && !window.confirm(`Are you sure you want to clear all ${count} imported rows? This will reset all split data for this mode.`)) {
      return;
    }

    setRows([]);
    setErrors([]);
    onErrorCountChange(0);
    setSelectedIds(new Set());

    const state = appState || await loadState();
    const modeData = state[modeKey] || {};

    const updatedState = {
      ...state,
      [modeKey]: {
        ...modeData,
        rows: [],
        errors: [],
        errorSNs: [],
        processedSNs: [],
        verifiedSNs: [],
        pmisRows: [],
        lastUpdated: new Date().toISOString(),
      },
    };

    setAppState(updatedState);
    await saveState(updatedState);
    addToast('info', 'All Data Cleared', `Cleared all ${count} row${count !== 1 ? 's' : ''} and reset processing state.`);
  }, [rows.length, appState, modeKey, onErrorCountChange, addToast]);

  // ─── Modal helpers ───────────────────────────────────────────────────────────
  const openModal  = useCallback((idx) => setModal(idx), []);
  const closeModal = useCallback(() => setModal(null), []);
  const prevModal  = useCallback(() => setModal(i => Math.max(0, i - 1)), []);
  const nextModal  = useCallback(() => setModal(i => Math.min(rows.length - 1, i + 1)), [rows.length]);

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const totalRows   = rows.length;
  const flaggedRows = rows.filter(r => r._flagged).length;
  const cleanRows   = totalRows - flaggedRows;
  const uniqueSourceSections = useMemo(() => {
    const snSet = new Set();
    for (const r of rows) {
      const s = String(r._originalSN ?? r['S/N'] ?? '').trim();
      if (s) snSet.add(s);
    }
    return snSet.size || totalRows;
  }, [rows, totalRows]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="workspace">
      {/* Toolbar */}
      <div className="workspace__toolbar">
        <div className="workspace__toolbar-left">
          <div>
            <div className="workspace__title">Split L / R</div>
            <div className="workspace__subtitle">
              {mode === 'reconstructed' ? 'Source: repaired.xlsx' : 'Source: in-service.xlsx'}
            </div>
          </div>
        </div>
        <div className="workspace__toolbar-right">
          <ColumnToggle
            allColumns={activeColumns}
            visibleKeys={visibleKeys}
            onChange={handleColumnChange}
          />

          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />

          <div className="btn-group">
            <button
              id="update-from-source-btn"
              className="btn btn--primary btn-group__main"
              onClick={() => handleUpdateFromSource(false)}
              disabled={isLoading}
            >
              {isLoading ? <span className="spinner" /> : <RefreshIcon />}
              Update from Source
            </button>
            <button
              className="btn btn--primary btn-group__side"
              onClick={() => handleUpdateFromSource(true)}
              disabled={isLoading}
              title="Force Reprocess All (Clears cache and detects column changes)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l-5.46-5.46" />
              </svg>
            </button>
          </div>
          
          <button
            id="export-excel-btn"
            className="btn btn--success"
            onClick={handleExport}
            disabled={isLoading || rows.length === 0}
          >
            <ExportIcon />
            Export to Excel
          </button>

          {selectedIds.size > 0 && (
            <button
              id="delete-selected-btn"
              className="btn btn--danger"
              onClick={handleDeleteSelected}
              disabled={isLoading}
              title={`Delete ${selectedIds.size} selected row${selectedIds.size !== 1 ? 's' : ''}`}
            >
              <TrashIcon />
              Delete Selected ({selectedIds.size})
            </button>
          )}

          {rows.length > 0 && selectedIds.size === 0 && (
            <button
              id="clear-all-btn"
              className="btn btn--secondary"
              onClick={handleClearAll}
              disabled={isLoading}
              title="Clear all imported rows and reset state"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--sp-1)' }}
            >
              <TrashIcon />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {totalRows > 0 && (
        <div className="stats-bar">
          <div className="stats-bar__item">
            <span className="stats-bar__value">{uniqueSourceSections}</span>
            <span className="stats-bar__label">Source Sections</span>
          </div>
          <div className="stats-bar__divider" />
          <div className="stats-bar__item">
            <span className="stats-bar__value">{totalRows}</span>
            <span className="stats-bar__label">Split Rows (L/R)</span>
          </div>
          <div className="stats-bar__divider" />
          <div className="stats-bar__item">
            <span className="stats-bar__value" style={{ color: 'var(--success)' }}>{cleanRows}</span>
            <span className="stats-bar__label">Verified in PMIS</span>
          </div>
          <div className="stats-bar__divider" />
          <div className="stats-bar__item">
            <span className="stats-bar__value" style={{ color: flaggedRows > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {flaggedRows}
            </span>
            <span className="stats-bar__label">Not in PMIS</span>
          </div>
          <div className="stats-bar__divider" />
          <div className="stats-bar__item">
            <span className="stats-bar__label" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              {appState?.[modeKey]?.lastUpdated
                ? `Last updated: ${new Date(appState[modeKey].lastUpdated).toLocaleString()}`
                : 'Not yet processed'}
            </span>
          </div>
        </div>
      )}

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
                <path d="M9 17H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-4" />
                <polyline points="9 11 12 14 22 4" />
              </svg>
            </div>
            <div className="empty-state__title">No Data Loaded</div>
            <div className="empty-state__desc">
              Click <strong>Update from Source</strong> to load{' '}
              {mode === 'reconstructed' ? 'repaired.xlsx' : 'in-service.xlsx'}, split each highway
              entry into Left (L) and Right (R) directions, and cross-reference against PMIS.
            </div>
            <button
              id="empty-update-btn"
              className="btn btn--primary"
              onClick={handleUpdateFromSource}
              disabled={isLoading}
            >
              <RefreshIcon />
              Update from Source
            </button>
          </div>
        )}

        {rows.length > 0 && (
          <DataTable
            rows={rows}
            visibleKeys={visibleKeys}
            onRowClick={openModal}
            activeColumns={activeColumns}
            selectedIds={selectedIds}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
          />
        )}
      </div>

      {/* Error log */}
      {(rows.length > 0 || errors.length > 0) && (
        <ErrorLogPanel errors={errors} onClear={handleClearErrors} />
      )}

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
