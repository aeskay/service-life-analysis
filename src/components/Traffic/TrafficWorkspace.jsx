import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { loadState, saveState } from '../../utils/stateStore';
import ColumnToggle from '../SplitLR/ColumnToggle';
import { ALL_COLUMNS, CellValue } from '../SplitLR/DataTable';

const RefreshIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const ExportIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M3 14v2.25C3 17.32 3.68 18 4.75 18h10.5C16.32 18 17 17.32 17 16.25V14" />
    <path d="M10 3v10M10 13l-3.5-3.5M10 13l3.5-3.5" />
  </svg>
);

function Badge({ children, variant = 'gray' }) {
  const colors = {
    gray: { bg: '#3f3f46', text: '#e4e4e7', border: '#52525b' },
    blue: { bg: '#1e3a8a', text: '#bfdbfe', border: '#1e40af' },
  };
  const c = colors[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap'
    }}>
      {children}
    </span>
  );
}

const TRAFFIC_DEFAULT_VISIBLE = new Set([
  'ID', 'S/N', 'HIGHWAY', 'Year Constructed', '_actualYearConst', 'End of Life', '_actualEndOfLife', 'Service Life', '_actualServiceLife', 'Equation Type', 'Equation', 'Cumulative ESAL'
]);

export default function TrafficWorkspace({ addToast, uiPrefs, onUIPrefsChange }) {
  const [trafficMode, setTrafficMode] = useState('reconstructed');
  
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [actualMaps, setActualMaps] = useState({ eol: {}, yc: {} });
  const [originalPmisKeys, setOriginalPmisKeys] = useState([]);
  
  const mappedResults = useMemo(() => {
    if (!results || !results.results || results.results.length === 0) return null;
    
    const upperToOriginal = {};
    for (const key of originalPmisKeys) {
      const upper = key.toUpperCase().replace(/ /g, '_');
      upperToOriginal[upper] = key;
    }

    const newRes = results.results.map(row => {
      const newRow = {};
      for (const k in row) {
        if (upperToOriginal[k]) {
          newRow[upperToOriginal[k]] = row[k];
        } else {
          newRow[k] = row[k];
        }
      }
      return newRow;
    });
    
    return { ...results, results: newRes };
  }, [results, originalPmisKeys]);

  const dataKeys = useMemo(() => {
    if (!mappedResults || !mappedResults.results || mappedResults.results.length === 0) return new Set();
    return new Set(Object.keys(mappedResults.results[0]));
  }, [mappedResults]);

  const yearKeys = useMemo(() => Array.from(dataKeys).filter(k => /^\d{4}$/.test(k)).sort(), [dataKeys]);

  const activeColumns = useMemo(() => {
    const predefinedKeys = new Set(ALL_COLUMNS.map(c => c.key));
    const dynamicCols = [];
    for (const k of dataKeys) {
      if (!predefinedKeys.has(k) && !/^AGE_\d+$/.test(k) && !/^\d{4}$/.test(k) && !k.startsWith('_') && !['EQUATION_TYPE', 'EQUATION', 'CUMULATIVE_ESAL', 'CONSTRUCTION_YEAR', 'TEMP_MAX_AGE', 'CALC_ESAL'].includes(k)) {
        dynamicCols.push({ key: k, label: k });
      }
    }
    
    const baseCols = [];
    for (const c of ALL_COLUMNS) {
      if (dataKeys.has(c.key) || c.key.startsWith('_') || c.key === 'ID' || c.key === 'S/N') {
        baseCols.push(c);
        if (c.key === 'Year Constructed') {
          baseCols.push({ key: '_actualYearConst', label: 'Actual Year Const.', className: 'col-num' });
        }
        if (c.key === 'End of Life') {
          baseCols.push({ key: '_actualEndOfLife', label: 'Actual End of Life', className: 'col-num' });
        }
        if (c.key === 'Service Life') {
          baseCols.push({ key: '_actualServiceLife', label: 'Actual Service Life', className: 'col-num' });
        }
      }
    }
    
    return [
      ...baseCols,
      { key: 'Equation Type', label: 'Equation Type' },
      { key: 'Equation', label: 'Equation' },
      { key: 'Cumulative ESAL', label: 'Cumulative ESAL' },
      ...dynamicCols,
      { key: 'Years', label: 'Years (PMIS)', isGroup: true },
      { key: 'Traffic Data', label: 'Traffic Data (Age Columns)', isGroup: true }
    ];
  }, [dataKeys]);

  const [visibleKeys, setVisibleKeys] = useState(() => {
    if (uiPrefs?.traffic?.visibleColumns) {
      // If we have explicit visible columns saved, use them directly
      return new Set(uiPrefs.traffic.visibleColumns);
    }
    // Otherwise fallback to default
    return new Set(TRAFFIC_DEFAULT_VISIBLE);
  });

  useEffect(() => {
    if (!uiPrefs?.traffic?.visibleColumns) {
      const base = new Set(TRAFFIC_DEFAULT_VISIBLE);
      // Always show ID if it exists in activeColumns
      if (activeColumns.some(c => c.key === 'ID')) base.add('ID');
      if (activeColumns.some(c => c.key === 'S/N')) base.add('S/N');
      setVisibleKeys(base);
    }
  }, [activeColumns, uiPrefs]);

  const handleColumnChange = useCallback((newSet) => {
    setVisibleKeys(newSet);
    if (onUIPrefsChange) {
      const visibleColumns = Array.from(newSet);
      onUIPrefsChange(prev => ({
        ...prev,
        traffic: { ...prev.traffic, visibleColumns }
      }));
    }
  }, [onUIPrefsChange]);

  useEffect(() => {
    let active = true;
    loadState().then(state => {
      if (!active) return;
      if (state.trafficAnalysis && state.trafficAnalysis[trafficMode]) {
        setResults(state.trafficAnalysis[trafficMode]);
      } else {
        setResults(null);
      }
      
      const modeData = state[trafficMode] || {};
      setOriginalPmisKeys(modeData.pmisRows && modeData.pmisRows.length > 0 ? Object.keys(modeData.pmisRows[0]) : []);
      setActualMaps({
        eol: modeData.actualEndOfLifeMap || {},
        yc: modeData.actualYearConstMap || {}
      });
    });
    return () => { active = false; };
  }, [trafficMode]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const customPmisPath = uiPrefs?.sourceFiles?.pmis;

      // Run both modes so cross-mode charts (Distribution, Slab/Base) have data
      const modes = ['reconstructed', 'inservice'];
      let currentModeData = null;
      const state = await loadState();
      const updatedTraffic = { ...(state.trafficAnalysis || {}) };

      const { runTrafficAnalysisJS } = await import('../../utils/trafficEngineJS');

      for (const mode of modes) {
        try {
          const data = runTrafficAnalysisJS(state, mode);

          updatedTraffic[mode] = data;
          if (mode === trafficMode) {
            currentModeData = data;
          }
        } catch (modeErr) {
          addToast('warning', `${mode} Analysis Skipped`, modeErr.message || String(modeErr));
        }
      }

      const updated = { ...state, trafficAnalysis: updatedTraffic };
      await saveState(updated);

      if (currentModeData) setResults(currentModeData);
      addToast('success', 'Analysis Complete', `Processed traffic for both reconstructed and in-service sections.`);
    } catch (e) {
      addToast('error', 'Traffic Analysis Failed', e.message || String(e));
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async () => {
    if (!results || !results.results) return;
    try {
      const { exportToExcel } = await import('../../utils/exporter');
      const filename = `traffic_analysis_${trafficMode}.xlsx`;
      await exportToExcel(results.results, filename);
      addToast('success', 'Export Complete', `Exported traffic analysis to ${filename}`);
    } catch (e) {
      addToast('error', 'Export Failed', e.message || String(e));
    }
  };

  // Helper to extract value safely matching Table format
  const getTrafficColValue = (r, key) => {
    if (key === 'Equation Type') return <Badge variant={r.EQUATION_TYPE === 'NIL' ? 'gray' : 'blue'}>{r.EQUATION_TYPE}</Badge>;
    if (key === 'Equation') return <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.EQUATION}</span>;
    if (key === 'Cumulative ESAL') return <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.CUMULATIVE_ESAL ? r.CUMULATIVE_ESAL.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}</span>;
    return null;
  };

  return (
    <div className="workspace">
      <div className="workspace__toolbar">
        <div className="workspace__toolbar-left">
          <div>
            <div className="workspace__title">
              ESAL
              {results && results.results && (
                <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 12, fontWeight: 500 }}>
                  ({results.results.length} sections)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="workspace__toolbar-right">
          <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.2)', borderRadius: 8, padding: 4 }}>
            <button 
              onClick={() => setTrafficMode('reconstructed')}
              className={`btn ${trafficMode === 'reconstructed' ? 'btn--primary' : ''}`}
              style={{ 
                background: trafficMode === 'reconstructed' ? '' : 'transparent', 
                color: trafficMode === 'reconstructed' ? '' : 'var(--text-muted)', 
                border: 'none', 
                boxShadow: 'none' 
              }}
            >
              Reconstructed
            </button>
            <button 
              onClick={() => setTrafficMode('inservice')}
              className={`btn ${trafficMode === 'inservice' ? 'btn--primary' : ''}`}
              style={{ 
                background: trafficMode === 'inservice' ? '' : 'transparent', 
                color: trafficMode === 'inservice' ? '' : 'var(--text-muted)', 
                border: 'none', 
                boxShadow: 'none' 
              }}
            >
              In Service
            </button>
          </div>
          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />
          <ColumnToggle
            allColumns={activeColumns}
            visibleKeys={visibleKeys}
            onChange={handleColumnChange}
          />
          <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />
          <button
            className="btn btn--primary"
            onClick={handleRun}
            disabled={running}
          >
            {running ? <span className="spinner" /> : <RefreshIcon />}
            {results ? 'Re-run Analysis' : 'Run Analysis'}
          </button>
          <button
            className="btn btn--success"
            onClick={handleExport}
            disabled={running || !results}
          >
            <ExportIcon />
            Export Analysis
          </button>
        </div>
      </div>

      <div className="workspace__body" style={{ position: 'relative' }}>
        {running && (
          <div className="loading-overlay">
            <div className="loading-overlay__content">
              <div className="loading-overlay__spinner" />
              <div className="loading-overlay__text">Processing Traffic Models for Both Modes…</div>
            </div>
          </div>
        )}

        {!running && !results && (
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="M3 15h6" />
                <path d="M3 18h6" />
              </svg>
            </div>
            <div className="empty-state__title">No Traffic Data</div>
            <div className="empty-state__desc">
              Run the analysis to fetch matching PMIS records and calculate rational models.
            </div>
            <button className="btn btn--primary" onClick={handleRun}>
              <RefreshIcon /> Run Analysis
            </button>
          </div>
        )}

        {mappedResults && (
          <>
            <div className="table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
              <table className="data-table" style={{ width: '100%', minWidth: 1200 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>#</th>
                    
                    {activeColumns.filter(c => {
                      if (trafficMode === 'inservice' && (c.key === '_actualEndOfLife' || c.key === 'End of Life')) return false;
                      if (trafficMode !== 'inservice' && c.key === '_actualYearConst') return false;
                      return true;
                    }).map(c => {
                      if (c.key === 'Years' || c.key === 'Traffic Data') return null;
                      return visibleKeys.has(c.key) && (
                        <th key={c.key} className={c.className} style={{ whiteSpace: 'nowrap' }}>{c.label}</th>
                      )
                    })}

                    {visibleKeys.has('Years') && yearKeys.map(y => (
                      <th key={`year-${y}`} style={{ whiteSpace: 'nowrap' }}>{y}</th>
                    ))}

                    {visibleKeys.has('Traffic Data') && [...Array(mappedResults.global_max_age + 1)].map((_, i) => (
                      <th key={`age-${i}`} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Age {i}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mappedResults.results.map((r, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      
                      {activeColumns.filter(c => {
                        if (trafficMode === 'inservice' && (c.key === '_actualEndOfLife' || c.key === 'End of Life')) return false;
                        if (trafficMode !== 'inservice' && c.key === '_actualYearConst') return false;
                        return true;
                      }).map(c => {
                        if (c.key === 'Years' || c.key === 'Traffic Data') return null;
                        if (!visibleKeys.has(c.key)) return null;

                        // Traffic specific formatting
                        if (['Equation Type', 'Equation', 'Cumulative ESAL'].includes(c.key)) {
                          return <td key={c.key}>{getTrafficColValue(r, c.key)}</td>;
                        }

                        // Use default CellValue for existing PMIS columns
                        if (c.key === '_actualYearConst') {
                          const uniqueId = r.ID || r['S/N'];
                          const actualYC = actualMaps.yc[uniqueId];
                          const defaultYC = r['Year Constructed'] || r['CONSTRUCTION_YEAR'];
                          return (
                            <td key={c.key} className={c.className} style={{ whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: actualYC ? 700 : 'normal', color: actualYC ? 'var(--accent-secondary)' : 'inherit' }}>
                                {actualYC || defaultYC || '—'}
                              </span>
                            </td>
                          );
                        }
                        if (c.key === '_actualEndOfLife') {
                          const uniqueId = r.ID || r['S/N'];
                          const actualEOL = actualMaps.eol[uniqueId];
                          const defaultEOL = r['End of Life'] || r['END_OF_LIFE'];
                          return (
                            <td key={c.key} className={c.className} style={{ whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: actualEOL ? 700 : 'normal', color: actualEOL ? 'var(--accent-secondary)' : 'inherit' }}>
                                {actualEOL || defaultEOL || '—'}
                              </span>
                            </td>
                          );
                        }
                        if (c.key === '_actualServiceLife') {
                          let actualServiceLife = '—';
                          let hasOverride = false;
                          const uniqueId = r.ID || r['S/N'];
                          if (trafficMode === 'inservice') {
                            const actualYC = actualMaps.yc[uniqueId];
                            hasOverride = !!actualYC;
                            const origYC = parseInt(r['Year Constructed'] || r['CONSTRUCTION_YEAR'], 10);
                            const activeYC = hasOverride ? parseInt(actualYC, 10) : origYC;
                            const origSL = parseInt(r['Service Life'], 10);
                            if (!isNaN(origYC) && !isNaN(activeYC) && !isNaN(origSL)) {
                              actualServiceLife = origSL + (origYC - activeYC);
                            }
                          } else {
                            const actualEOL = actualMaps.eol[uniqueId];
                            hasOverride = !!actualEOL;
                            const eolToUse = actualEOL || r['End of Life'] || r['END_OF_LIFE'];
                            const yearConst = parseInt(r['Year Constructed'] || r['CONSTRUCTION_YEAR'], 10);
                            const eolVal = parseInt(eolToUse, 10);
                            if (!isNaN(yearConst) && !isNaN(eolVal)) {
                              actualServiceLife = eolVal - yearConst;
                            }
                          }
                          return (
                            <td key={c.key} className={c.className} style={{ whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: hasOverride ? 700 : 'normal', color: hasOverride ? 'var(--accent-secondary)' : 'inherit' }}>
                                {actualServiceLife !== '—' ? `${actualServiceLife} yrs` : '—'}
                              </span>
                            </td>
                          );
                        }

                        return (
                          <td key={c.key} className={c.className} style={{ whiteSpace: 'nowrap' }}>
                            <CellValue col={c} value={r[c.key]} />
                          </td>
                        );
                      })}

                      {visibleKeys.has('Years') && yearKeys.map(y => (
                        <td key={`year-${y}`} style={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                          {r[y] !== null && r[y] !== undefined ? String(r[y]) : '-'}
                        </td>
                      ))}

                      {visibleKeys.has('Traffic Data') && [...Array(mappedResults.global_max_age + 1)].map((_, a) => {
                        const val = r[`AGE_${a}`];
                        const isActual = val && val.actual;
                        return (
                          <td key={a} style={{ 
                            textAlign: 'right', fontFamily: 'monospace',
                            color: val ? (isActual ? '#a3e635' : '#fbbf24') : 'var(--text-muted)'
                          }}>
                            {val ? val.v.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div style={{ padding: '12px 20px', background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 16, fontSize: 12, flexShrink: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#a3e635', borderRadius: 2 }}></span> Actual PMIS Data</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, background: '#fbbf24', borderRadius: 2 }}></span> Predicted (Model)</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
