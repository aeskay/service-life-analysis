/**
 * CleanedSectionsWorkspace.jsx — "Verify Service Life" tab.
 *
 * Loads the Match PMIS output from persistent state, shows each section in a
 * table, lets the user open a detail modal with two Plotly charts, and
 * mark sections as verified. Verified SNs persist across sessions.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import VerifyTable, { VERIFY_COLUMNS, VERIFY_DEFAULT_VISIBLE } from '../Verify/VerifyTable';
import VerifyModal from '../Verify/VerifyModal';
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

export default function CleanedSectionsWorkspace({ mode, addToast, uiPrefs, onUIPrefsChange }) {
  const modeKey = mode === 'reconstructed' ? 'reconstructed' : 'inservice';

  // ─── State ──────────────────────────────────────────────────────────────
  const [rows,               setRows]               = useState([]);
  const [verifiedSNs,        setVerifiedSNs]        = useState(new Set());
  const [actualEndOfLifeMap, setActualEndOfLifeMap] = useState({});
  const [actualYearConstMap, setActualYearConstMap] = useState({});
  const [appState,           setAppState]           = useState(null);
  const [modalIndex,         setModalIndex]         = useState(null);
  const [isLoadingDetail,    setLoadingDetail]      = useState(false);
  const [pmisDetailMap,      setPmisDetailMap]      = useState(null);

  // Column visibility — restored from uiPrefs
  const [visibleKeys, setVisibleKeys] = useState(() => {
    const hidden = uiPrefs?.verify?.hiddenColumns || [];
    const base = new Set(VERIFY_COLUMNS.map(c => c.key));
    hidden.forEach(k => base.delete(k));
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
      const verifiedSet = new Set(d?.verifiedSNs || []);
      setVerifiedSNs(verifiedSet);
      if (modeKey === 'inservice') {
        setActualYearConstMap(d?.actualYearConstMap || {});
        setActualEndOfLifeMap({});
      } else {
        setActualEndOfLifeMap(d?.actualEndOfLifeMap || {});
        setActualYearConstMap({});
      }
      const allRows = d.pmisRows || [];
      setRows(allRows.filter(r => verifiedSet.has(r['ID'] || r['S/N'])));
    });
    return () => { active = false; };
  }, [modeKey]);

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
    const verifiedSet = new Set(d?.verifiedSNs || []);
    setVerifiedSNs(verifiedSet);
    if (modeKey === 'inservice') {
      setActualYearConstMap(d?.actualYearConstMap || {});
      setActualEndOfLifeMap({});
    } else {
      setActualEndOfLifeMap(d?.actualEndOfLifeMap || {});
      setActualYearConstMap({});
    }
    setAppState(state);

    let pmisRows = d?.pmisRows || [];
    const verifiedOnly = pmisRows.filter(r => verifiedSet.has(r['ID'] || r['S/N']));
    setRows(verifiedOnly);

    if (pmisRows.length === 0) {
      addToast('warning', 'No Data Found', 'Run "Update from Split Tab" in the Match PMIS tab first.');
    } else {
      addToast('success', 'Refreshed', `Loaded ${verifiedOnly.length} verified sections.`);
    }
  }, [modeKey, addToast]);

  // ─── Open modal + lazy-load PMIS detail map ────────────────────────────
  const handleRowClick = useCallback(async (idx) => {
    setModalIndex(idx);
    if (pmisDetailMap) return; 
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

  // ─── Update Actual End of Life ──────────────────────────────────────────
  const handleUpdateActualEndOfLife = useCallback(async (sn, year) => {
    const nextMap = { ...actualEndOfLifeMap };
    if (year === null || year === undefined || year === '') {
      delete nextMap[sn]; 
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

  // ─── Export verified sections ─────────────────────────────────────────
  const handleExport = useCallback(async () => {
    const verifiedRows = rows.map(r => {
      const uniqueId = r['ID'] || r['S/N'];
      const newRow = { ...r };
      
      if (modeKey === 'inservice') {
        const actualYC = actualYearConstMap[uniqueId];
        newRow['Actual Year Const'] = actualYC || r['Year Constructed'] || null;
        
        const origYC = parseInt(r['Year Constructed'], 10);
        const activeYC = actualYC ? parseInt(actualYC, 10) : origYC;
        const origSL = parseInt(r['Service Life'], 10);
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
      const filename = generateExportFilename(mode).replace('split', 'average-life');
      const savedPath = await exportToExcel(verifiedRows, filename);
      if (savedPath) addToast('success', 'Export Complete', `Saved to: ${savedPath}`);
    } catch (err) {
      addToast('error', 'Export Failed', err.message || String(err));
    }
  }, [rows, actualEndOfLifeMap, mode, addToast]);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="workspace">
      {/* Toolbar */}
      <div className="workspace__toolbar">
        <div className="workspace__toolbar-left">
          <div>
            <div className="workspace__title">Cleaned Sections ({mode === 'reconstructed' ? 'Reconstructed' : 'In Service'})</div>
            <div className="workspace__subtitle">Review and analyze verified sections to determine average service life.</div>
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
            Refresh
          </button>
          <button
            id="verify-export-btn"
            className="btn btn--success"
            onClick={handleExport}
            disabled={rows.length === 0}
          >
            <ExportIcon />
            Export Analysis
          </button>
        </div>
      </div>

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
            <div className="empty-state__title">No Verified Data</div>
            <div className="empty-state__desc">
            </div>
            <button className="btn btn--primary" onClick={handleRefresh}>
              <RefreshIcon />
              Refresh from Match PMIS
            </button>
          </div>
        ) : (
          <VerifyTable
            rows={rows}
            visibleKeys={visibleKeys}
            onRowClick={handleRowClick}
            verifiedSNs={verifiedSNs}
            actualEndOfLifeMap={actualEndOfLifeMap}
            actualYearConstMap={actualYearConstMap}
            mode={modeKey}
            activeColumns={activeColumns}
          />
        )}
      </div>

      {/* Detail modal */}
      {modalIndex !== null && (
        <VerifyModal
          rows={rows}
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
          actualYearConstMap={actualYearConstMap}
          mode={modeKey}
          hideCharts={true}
        />
      )}
    </div>
  );
}
