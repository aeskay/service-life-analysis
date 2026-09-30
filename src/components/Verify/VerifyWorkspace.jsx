/**
 * VerifyWorkspace.jsx — "Verify Service Life" tab.
 *
 * Loads the Match PMIS output from persistent state, shows each section in a
 * table, lets the user open a detail modal with two Plotly charts, and
 * mark sections as verified. Verified SNs persist across sessions.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import VerifyTable, { VERIFY_COLUMNS, VERIFY_DEFAULT_VISIBLE } from './VerifyTable';
import VerifyModal from './VerifyModal';
import ColumnToggle from '../SplitLR/ColumnToggle';
import { loadState, saveState } from '../../utils/stateStore';
import { loadPMISDetailMap } from '../../utils/fileLoader';
import { exportToExcel, generateExportFilename } from '../../utils/exporter';
import { patchVerifyPrefs } from '../../utils/uiPreferences';

// ─── Icons ──────────────────────────────────────────────────────────────────
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

export default function VerifyWorkspace({ mode, addToast, uiPrefs, onUIPrefsChange }) {
  const modeKey = mode === 'reconstructed' ? 'reconstructed' : 'inservice';

  // ─── State ──────────────────────────────────────────────────────────────
  const [rows,               setRows]               = useState([]);
  const [verifiedSNs,        setVerifiedSNs]        = useState(new Set());
  const [actualEndOfLifeMap, setActualEndOfLifeMap] = useState({});
  const [actualYearConstMap, setActualYearConstMap] = useState({});
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'verified', 'unverified'
  const [appState,           setAppState]           = useState(null);
  const [modalIndex,         setModalIndex]         = useState(null);
  const [isLoadingDetail,    setLoadingDetail]      = useState(false);
  const [pmisDetailMap,      setPmisDetailMap]      = useState(null);
  const [selectedIds,        setSelectedIds]        = useState(new Set());

  // Column visibility — restored from uiPrefs
  const [visibleKeys, setVisibleKeys] = useState(() => {
    const hidden = uiPrefs?.verify?.hiddenColumns || [];
    const base = new Set(VERIFY_COLUMNS.map(c => c.key));
    hidden.forEach(k => base.delete(k));
    // If no prefs stored yet, start from default
    if (!uiPrefs?.verify?.hiddenColumns) {
      return new Set(VERIFY_DEFAULT_VISIBLE);
    }
    return base;
  });

  // ─── Dynamically filter columns based on available data ───────────────────
  const dataKeys = useMemo(() => rows.length > 0 ? new Set(Object.keys(rows[0])) : new Set(), [rows]);
  const activeColumns = useMemo(() => {
    const predefinedKeys = new Set(VERIFY_COLUMNS.map(c => c.key));
    const dynamicCols = [];
    for (const k of dataKeys) {
      if (!predefinedKeys.has(k) && !/^\d{4}$/.test(k)) {
        dynamicCols.push({ key: k, label: k, className: '' });
      }
    }
    return [
      ...VERIFY_COLUMNS.filter(c => c.key.startsWith('_') || dataKeys.has(c.key)),
      ...dynamicCols
    ];
  }, [dataKeys]);

  // ─── Load persisted data on mount / mode change ─────────────────────────
  useEffect(() => {
    let active = true;
    loadState().then(state => {
      if (!active) return;
      setAppState(state);
      const d = state[modeKey];
      setRows(d.pmisRows || []);
      setVerifiedSNs(new Set(d.verifiedSNs || []));
      if (modeKey === 'inservice') {
        setActualYearConstMap(d.actualYearConstMap || {});
        setActualEndOfLifeMap({});
      } else {
        setActualEndOfLifeMap(d.actualEndOfLifeMap || {});
        setActualYearConstMap({});
      }
    });
    return () => { active = false; };
  }, [modeKey]);

  // ─── Check for Duplicate IDs ──────────────────────────────────────────
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    const idCount = {};
    const duplicates = new Set();
    rows.forEach(r => {
      const id = r.ID || r['S/N'];
      if (id) {
        if (idCount[id]) duplicates.add(id);
        else idCount[id] = 1;
      }
    });
    if (duplicates.size > 0) {
      const dupList = Array.from(duplicates).slice(0, 5).join(', ');
      const overflow = duplicates.size > 5 ? ` and ${duplicates.size - 5} more` : '';
      addToast('warning', 'Duplicate Sections Detected!', `Found duplicate IDs (${dupList}${overflow}). Please check your Excel file for duplicate sections.`);
    }
  }, [rows, addToast]);

  // ─── Column visibility persistence ────────────────────────────────────
  const handleColumnChange = useCallback((newSet) => {
    setVisibleKeys(newSet);
    if (onUIPrefsChange) {
      const hiddenColumns = VERIFY_COLUMNS.map(c => c.key).filter(k => !newSet.has(k));
      onUIPrefsChange(prev => patchVerifyPrefs(prev, { hiddenColumns }));
    }
  }, [onUIPrefsChange]);

  // ─── Reload from Match PMIS state ───────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    const state = await loadState();
    const d = state[modeKey];
    const pmisRows = d.pmisRows || [];
    setRows(pmisRows);
    setAppState(state);
    setVerifiedSNs(new Set(d.verifiedSNs || []));
    
    if (modeKey === 'inservice') {
      setActualYearConstMap(d.actualYearConstMap || {});
      setActualEndOfLifeMap({});
    } else {
      setActualEndOfLifeMap(d.actualEndOfLifeMap || {});
      setActualYearConstMap({});
    }
    
    if (pmisRows.length === 0) {
      addToast('warning', 'No Data Found', 'Run "Update from Split Tab" in the Match PMIS tab first.');
    } else {
      addToast('success', 'Refreshed', `Loaded ${pmisRows.length} sections from Match PMIS.`);
    }
  }, [modeKey, addToast]);

  // ─── Open modal + lazy-load PMIS detail map ────────────────────────────
  const handleRowClick = useCallback(async (idx) => {
    setModalIndex(idx);
    if (pmisDetailMap) return; // already loaded
    setLoadingDetail(true);
    try {
      const map = await loadPMISDetailMap();
      setPmisDetailMap(map);
    } catch (err) {
      addToast('error', 'Detail Load Failed', err.message || String(err));
    } finally {
      setLoadingDetail(false);
    }
  }, [pmisDetailMap, addToast]);

  const closeModal = useCallback(() => setModalIndex(null), []);
  const prevModal  = useCallback(() => setModalIndex(i => Math.max(0, i - 1)), []);
  const nextModal  = useCallback(() => setModalIndex(i => Math.min(rows.length - 1, i + 1)), [rows.length]);

  // ─── Add to Verified ────────────────────────────────────────────────────
  const handleVerify = useCallback(async (sn) => {
    const next = new Set(verifiedSNs);
    next.add(sn);
    setVerifiedSNs(next);
    const state = appState || await loadState();
    const updated = {
      ...state,
      [modeKey]: { ...state[modeKey], verifiedSNs: Array.from(next) },
    };
    setAppState(updated);
    await saveState(updated);
    addToast('success', 'Added to Verified', `Section ${sn} marked as verified.`);
  }, [verifiedSNs, appState, modeKey, addToast]);

  // ─── Remove from Verified ───────────────────────────────────────────────
  const handleUnverify = useCallback(async (sn) => {
    const next = new Set(verifiedSNs);
    next.delete(sn);
    setVerifiedSNs(next);
    const state = appState || await loadState();
    const updated = {
      ...state,
      [modeKey]: { ...state[modeKey], verifiedSNs: Array.from(next) },
    };
    setAppState(updated);
    await saveState(updated);
    addToast('info', 'Removed from Verified', `Section ${sn} unverified.`);
  }, [verifiedSNs, appState, modeKey, addToast]);

  // ─── Bulk Selection & Actions ───────────────────────────────────────────
  const displayRows = useMemo(() => {
    if (filterStatus === 'all') return rows;
    if (filterStatus === 'verified') return rows.filter(r => verifiedSNs.has(r.ID || r['S/N']));
    if (filterStatus === 'unverified') return rows.filter(r => !verifiedSNs.has(r.ID || r['S/N']));
    return rows;
  }, [rows, filterStatus, verifiedSNs]);

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
      const allIds = displayRows.map(r => r.ID || r['S/N']);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  }, [displayRows]);

  // Clear selections when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filterStatus]);

  const selectedUnverifiedCount = useMemo(() => {
    let count = 0;
    selectedIds.forEach(id => {
      if (!verifiedSNs.has(id)) count++;
    });
    return count;
  }, [selectedIds, verifiedSNs]);

  const selectedVerifiedCount = useMemo(() => {
    let count = 0;
    selectedIds.forEach(id => {
      if (verifiedSNs.has(id)) count++;
    });
    return count;
  }, [selectedIds, verifiedSNs]);

  const handleBulkVerify = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const next = new Set(verifiedSNs);
    let newlyVerified = 0;
    selectedIds.forEach(id => {
      if (!next.has(id)) {
        next.add(id);
        newlyVerified++;
      }
    });
    if (newlyVerified === 0) {
      addToast('info', 'Bulk Verify', 'All selected sections are already verified.');
      return;
    }
    setVerifiedSNs(next);
    const state = appState || await loadState();
    const updated = {
      ...state,
      [modeKey]: { ...state[modeKey], verifiedSNs: Array.from(next) },
    };
    setAppState(updated);
    await saveState(updated);
    addToast('success', 'Bulk Verify', `${newlyVerified} section${newlyVerified !== 1 ? 's' : ''} marked as verified.`);
    setSelectedIds(new Set()); // clear selection
  }, [selectedIds, verifiedSNs, appState, modeKey, addToast]);

  const handleBulkUnverify = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const next = new Set(verifiedSNs);
    let newlyUnverified = 0;
    selectedIds.forEach(id => {
      if (next.has(id)) {
        next.delete(id);
        newlyUnverified++;
      }
    });
    if (newlyUnverified === 0) {
      addToast('info', 'Bulk Unverify', 'None of the selected sections were verified.');
      return;
    }
    setVerifiedSNs(next);
    const state = appState || await loadState();
    const updated = {
      ...state,
      [modeKey]: { ...state[modeKey], verifiedSNs: Array.from(next) },
    };
    setAppState(updated);
    await saveState(updated);
    addToast('info', 'Bulk Unverify', `${newlyUnverified} section${newlyUnverified !== 1 ? 's' : ''} removed from verified.`);
    setSelectedIds(new Set()); // clear selection
  }, [selectedIds, verifiedSNs, appState, modeKey, addToast]);

  // ─── Update Actual End of Life ──────────────────────────────────────────
  const handleUpdateActualEndOfLife = useCallback(async (sn, year) => {
    // In-service mode has no EOL — this callback should never fire, but guard anyway
    if (modeKey === 'inservice') return;
    const nextMap = { ...actualEndOfLifeMap };
    if (year === null || year === undefined || year === '') {
      delete nextMap[sn]; // revert to default
    } else {
      nextMap[sn] = parseInt(year, 10);
    }
    setActualEndOfLifeMap(nextMap);
    const state = appState || await loadState();
    const updated = {
      ...state,
      [modeKey]: { ...state[modeKey], actualEndOfLifeMap: nextMap },
    };
    setAppState(updated);
    await saveState(updated);
  }, [actualEndOfLifeMap, appState, modeKey]);

  const handleUpdateActualYearConst = useCallback(async (sn, year) => {
    if (modeKey !== 'inservice') return;
    const nextMap = { ...actualYearConstMap };
    if (year === null || year === undefined || year === '') {
      delete nextMap[sn];
    } else {
      nextMap[sn] = year;
    }
    setActualYearConstMap(nextMap);

    const state = appState || await loadState();
    const updated = {
      ...state,
      [modeKey]: { ...state[modeKey], actualYearConstMap: nextMap },
    };
    setAppState(updated);
    await saveState(updated);
  }, [actualYearConstMap, appState, modeKey]);

  // ─── Export verified sections ─────────────────────────────────────────
  const handleExport = useCallback(async () => {
    const verifiedRows = rows
      .filter(r => verifiedSNs.has(r['ID'] || r['S/N']))
      .map(r => {
        const uniqueId = r['ID'] || r['S/N'];
        const newRow = { ...r };
        if (modeKey === 'inservice') {
          const actualYC = actualYearConstMap[uniqueId];
          const origYC = parseInt(r['Year Constructed'], 10);
          const activeYC = actualYC ? parseInt(actualYC, 10) : origYC;
          const origSL = parseInt(r['Service Life'], 10);
          newRow['Actual Year Const.'] = actualYC || r['Year Constructed'] || null;
          newRow['Actual Service Life (yrs)'] = (!isNaN(origYC) && !isNaN(activeYC) && !isNaN(origSL)) 
            ? origSL + (origYC - activeYC) 
            : null;
        } else {
          const actualEOL = actualEndOfLifeMap[uniqueId];
          const eolToUse = actualEOL || r['End of Life'];
          newRow['Actual End of Life'] = eolToUse || null;
          
          const yearConst = parseInt(r['Year Constructed'], 10);
          const eolVal = parseInt(eolToUse, 10);
          newRow['Actual Service Life (yrs)'] = (!isNaN(yearConst) && !isNaN(eolVal)) 
            ? eolVal - yearConst 
            : null;
        }
        return newRow;
      });

    if (!verifiedRows.length) {
      addToast('warning', 'Nothing to Export', 'Mark at least one section as verified first.');
      return;
    }
    try {
      const filename = generateExportFilename(mode).replace('split', 'verified');
      const savedPath = await exportToExcel(verifiedRows, filename);
      if (savedPath) addToast('success', 'Export Complete', `Saved to: ${savedPath}`);
    } catch (err) {
      addToast('error', 'Export Failed', err.message || String(err));
    }
  }, [rows, verifiedSNs, actualEndOfLifeMap, actualYearConstMap, mode, modeKey, addToast]);

  // ─── Export unverified sections ───────────────────────────────────────
  const handleExportUnverified = useCallback(async () => {
    const unverifiedRows = rows
      .filter(r => !verifiedSNs.has(r['ID'] || r['S/N']))
      .map(r => {
        const uniqueId = r['ID'] || r['S/N'];
        const newRow = { ...r };
        if (modeKey === 'inservice') {
          const actualYC = actualYearConstMap[uniqueId];
          const origYC = parseInt(r['Year Constructed'], 10);
          const activeYC = actualYC ? parseInt(actualYC, 10) : origYC;
          const origSL = parseInt(r['Service Life'], 10);
          newRow['Actual Year Const.'] = actualYC || r['Year Constructed'] || null;
          newRow['Actual Service Life (yrs)'] = (!isNaN(origYC) && !isNaN(activeYC) && !isNaN(origSL)) 
            ? origSL + (origYC - activeYC) 
            : null;
        } else {
          const actualEOL = actualEndOfLifeMap[uniqueId];
          const eolToUse = actualEOL || r['End of Life'];
          newRow['Actual End of Life'] = eolToUse || null;
          
          const yearConst = parseInt(r['Year Constructed'], 10);
          const eolVal = parseInt(eolToUse, 10);
          newRow['Actual Service Life (yrs)'] = (!isNaN(yearConst) && !isNaN(eolVal)) 
            ? eolVal - yearConst 
            : null;
        }
        return newRow;
      });

    if (unverifiedRows.length === 0) {
      addToast('info', 'Nothing to Export', 'All sections are currently verified.');
      return;
    }
    try {
      const filename = generateExportFilename(mode).replace('split', 'unverified');
      const savedPath = await exportToExcel(unverifiedRows, filename);
      if (savedPath) addToast('success', 'Export Complete', `Saved to: ${savedPath}`);
    } catch (err) {
      addToast('error', 'Export Failed', err.message || String(err));
    }
  }, [rows, verifiedSNs, actualEndOfLifeMap, actualYearConstMap, modeKey, mode, addToast]);

  // ─── Stats & Filtering ────────────────────────────────────────────────
  const totalRows = rows.length;
  const verifiedCount = useMemo(() => {
    return rows.filter(r => verifiedSNs.has(r.ID || r['S/N'])).length;
  }, [rows, verifiedSNs]);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="workspace">
      {/* Toolbar */}
      <div className="workspace__toolbar">
        <div className="workspace__toolbar-left">
          <div>
            <div className="workspace__title">Verify Service Life</div>
          </div>
        </div>
        <div className="workspace__toolbar-right">
          <ColumnToggle
            allColumns={activeColumns}
            visibleKeys={visibleKeys}
            onChange={handleColumnChange}
          />
          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />
          <button
            id="verify-refresh-btn"
            className="btn btn--primary"
            onClick={handleRefresh}
          >
            <RefreshIcon />
            Refresh from PMIS
          </button>
          
          {/* Bulk Action Buttons */}
          {(filterStatus === 'all' || filterStatus === 'unverified') && (
            <button 
              id="verify-bulk-verify-btn"
              className="btn btn--success" 
              disabled={selectedIds.size === 0 || (filterStatus === 'all' && selectedUnverifiedCount === 0)} 
              onClick={handleBulkVerify}
              style={{ marginLeft: 8 }}
              title={
                selectedIds.size === 0 
                  ? "Select sections to verify" 
                  : filterStatus === 'all' && selectedUnverifiedCount === 0
                  ? "All selected sections are already verified"
                  : `Mark ${filterStatus === 'all' ? selectedUnverifiedCount : selectedIds.size} section(s) as verified`
              }
            >
              Verify Selected {selectedIds.size > 0 ? `(${filterStatus === 'all' ? selectedUnverifiedCount : selectedIds.size})` : ''}
            </button>
          )}
          {(filterStatus === 'all' || filterStatus === 'verified') && (
            <button 
              id="verify-bulk-unverify-btn"
              className="btn btn--danger" 
              disabled={selectedIds.size === 0 || (filterStatus === 'all' && selectedVerifiedCount === 0)} 
              onClick={handleBulkUnverify}
              style={{ marginLeft: 8 }}
              title={
                selectedIds.size === 0 
                  ? "Select sections to unverify" 
                  : filterStatus === 'all' && selectedVerifiedCount === 0
                  ? "None of the selected sections are verified"
                  : `Remove ${filterStatus === 'all' ? selectedVerifiedCount : selectedIds.size} section(s) from verified`
              }
            >
              Unverify Selected {selectedIds.size > 0 ? `(${filterStatus === 'all' ? selectedVerifiedCount : selectedIds.size})` : ''}
            </button>
          )}

          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', marginLeft: 8 }} />

          <button
            id="verify-export-btn"
            className="btn btn--success"
            onClick={handleExport}
            disabled={rows.length === 0 || verifiedSNs.size === 0}
            style={{ marginLeft: 8 }}
          >
            <ExportIcon />
            Export Verified
          </button>
          <button
            id="verify-export-unverified-btn"
            className="btn btn--secondary"
            onClick={handleExportUnverified}
            disabled={rows.length === 0 || rows.length === verifiedSNs.size}
            style={{ marginLeft: 8 }}
          >
            <ExportIcon />
            Export Unverified
          </button>
        </div>
      </div>

      {/* Stats bar (Clickable Filters) */}
      {totalRows > 0 && (
        <div className="stats-bar">
          <div 
            className="stats-bar__item" 
            style={{ cursor: 'pointer', opacity: filterStatus === 'all' ? 1 : 0.6 }}
            onClick={() => setFilterStatus('all')}
            title="Show all sections"
          >
            <span className="stats-bar__value">{totalRows}</span>
            <span className="stats-bar__label">Total Sections</span>
          </div>
          <div className="stats-bar__divider" />
          <div 
            className="stats-bar__item"
            style={{ cursor: 'pointer', opacity: filterStatus === 'verified' ? 1 : 0.6 }}
            onClick={() => setFilterStatus('verified')}
            title="Show only verified sections"
          >
            <span className="stats-bar__value" style={{ color: 'var(--success)' }}>{verifiedCount}</span>
            <span className="stats-bar__label">Verified</span>
          </div>
          <div className="stats-bar__divider" />
          <div 
            className="stats-bar__item"
            style={{ cursor: 'pointer', opacity: filterStatus === 'unverified' ? 1 : 0.6 }}
            onClick={() => setFilterStatus('unverified')}
            title="Show only unverified sections"
          >
            <span className="stats-bar__value" style={{ color: 'var(--text-muted)' }}>{totalRows - verifiedCount}</span>
            <span className="stats-bar__label">Unverified</span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="workspace__body">
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4" />
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
              </svg>
            </div>
            <div className="empty-state__title">No Data Loaded</div>
            <div className="empty-state__desc">
              First run <strong>Update from Split Tab</strong> in the Match PMIS tab,
              then click <strong>Refresh from PMIS</strong> here.
            </div>
            <button className="btn btn--primary" onClick={handleRefresh}>
              <RefreshIcon />
              Refresh from PMIS
            </button>
          </div>
        ) : (
          <VerifyTable
            rows={displayRows}
            visibleKeys={visibleKeys}
            onRowClick={handleRowClick}
            verifiedSNs={verifiedSNs}
            actualEndOfLifeMap={actualEndOfLifeMap}
            actualYearConstMap={actualYearConstMap}
            mode={modeKey}
            selectedIds={selectedIds}
            onSelectRow={handleSelectRow}
            onSelectAll={handleSelectAll}
            activeColumns={activeColumns}
          />
        )}
      </div>

      {/* Detail modal uses displayRows so Prev/Next stays within the filtered view */}
      {modalIndex !== null && (
        <VerifyModal
          rows={displayRows}
          currentIndex={modalIndex}
          onClose={closeModal}
          onPrev={prevModal}
          onNext={nextModal}
          verifiedSNs={verifiedSNs}
          onVerify={handleVerify}
          onUnverify={handleUnverify}
          pmisDetailMap={pmisDetailMap}
          isLoadingDetail={isLoadingDetail}
          actualEndOfLifeMap={actualEndOfLifeMap}
          onUpdateActualEndOfLife={handleUpdateActualEndOfLife}
          actualYearConstMap={actualYearConstMap}
          onUpdateActualYearConst={handleUpdateActualYearConst}
          mode={modeKey}
        />
      )}
    </div>
  );
}
