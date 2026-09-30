/**
 * VerifyModal.jsx
 * Detail popup for a single section in the Verify Service Life tab.
 * Shows: info cards, Evaluation Scores chart, Distress Counts chart,
 * Add/Remove Verified buttons, and Prev/Next navigation.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import PlotlyChart from './PlotlyChart';
import { buildEvalData, buildDistressData } from '../../hooks/useVerifyCharts';

// ─── Info Card ─────────────────────────────────────────────────────────────
function InfoCard({ label, value, accent }) {
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      padding: '8px 14px',
      minWidth: 100,
      flex: '1 1 120px',
      maxWidth: '18%', 
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontWeight: 700,
        fontSize: 'var(--text-sm)',
        color: accent || 'var(--text-heading)',
        fontFamily: typeof value === 'number' || /^\d/.test(String(value)) ? 'var(--font-mono)' : 'var(--font-sans)',
        wordBreak: 'break-word',
      }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

// ─── Vertical line shape helper ────────────────────────────────────────────
function vline(x, color, label) {
  return {
    shape: {
      type: 'line', x0: x, x1: x, y0: 0, y1: 1, yref: 'paper',
      line: { color, width: 2.5, dash: 'dash' },
    },
    annotation: {
      x, yref: 'paper', y: 1.02, xanchor: 'center', yanchor: 'bottom',
      text: `<b>${label}</b>`, showarrow: false,
      font: { color, size: 11 },
    },
  };
}

// ─── Chart builders ────────────────────────────────────────────────────────
function buildEvalLayout(row, endOfLifeOverride, yearConstOverride, shapes, annotations, years, isInService) {
  const origYearConst = parseInt(row['Year Constructed'], 10);
  const actualYearConst = yearConstOverride ? parseInt(yearConstOverride, 10) : null;
  const activeYearConst = (actualYearConst && !isNaN(actualYearConst)) ? actualYearConst : origYearConst;

  const origEndOfLife = parseInt(row['End of Life'], 10);
  const actualEndOfLife = endOfLifeOverride ? parseInt(endOfLifeOverride, 10) : null;
  const activeEndOfLife = (actualEndOfLife && !isNaN(actualEndOfLife)) ? actualEndOfLife : origEndOfLife;
  
  const lines = [];
  if (!isNaN(activeYearConst)) lines.push(vline(activeYearConst, '#22c55e', 'Year Const.'));
  // Only draw EOL line for reconstructed (repaired) mode
  if (!isInService && !isNaN(activeEndOfLife)) lines.push(vline(activeEndOfLife, '#ef4444', 'End of Life'));

  const minYr = years[0] ?? 1996;
  const maxYr = years[years.length - 1] ?? 2024;

  return {
    template: 'plotly_white',
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    margin: { t: 60, b: 155, l: 75, r: 85 },
    height: 390,
    legend: { orientation: 'h', yanchor: 'top', y: -0.22, xanchor: 'center', x: 0.5, font: { size: 12 }, bordercolor: '#000', borderwidth: 1 },
    hovermode: 'x unified',
    barmode: 'group',
    xaxis: {
      title: { text: '<b>Fiscal Year</b>', font: { size: 14 } },
      range: [minYr - 0.7, maxYr + 0.7],
      tickmode: 'linear', dtick: 1, tickangle: -45,
      tickfont: { size: 12 }, showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside',
    },
    yaxis: {
      title: { text: '<b>Average Score</b>', font: { size: 13 } },
      range: [0, 105], tickvals: Array.from({ length: 11 }, (_, i) => i * 10),
      tickfont: { size: 12 }, showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside',
    },
    yaxis2: {
      title: { text: '<b>Ride Score</b>', font: { size: 13, color: '#d62728' } },
      tickfont: { size: 12, color: '#d62728' },
      range: [0, 5.25], dtick: 0.5, tickformat: '.1f',
      overlaying: 'y', side: 'right',
      showgrid: false, showline: true, linewidth: 2, linecolor: '#000', ticks: 'inside',
    },
    shapes: lines.map(l => l.shape),
    annotations: lines.map(l => l.annotation),
  };
}

function buildDistressLayout(row, endOfLifeOverride, yearConstOverride, distData, isInService) {
  const origYearConst = parseInt(row['Year Constructed'], 10);
  const actualYearConst = yearConstOverride ? parseInt(yearConstOverride, 10) : null;
  const activeYearConst = (actualYearConst && !isNaN(actualYearConst)) ? actualYearConst : origYearConst;

  const origEndOfLife = parseInt(row['End of Life'], 10);
  const actualEndOfLife = endOfLifeOverride ? parseInt(endOfLifeOverride, 10) : null;
  const activeEndOfLife = (actualEndOfLife && !isNaN(actualEndOfLife)) ? actualEndOfLife : origEndOfLife;

  const lines = [];
  if (!isNaN(activeYearConst)) lines.push(vline(activeYearConst, '#22c55e', 'Year Const.'));
  if (!isInService && !isNaN(activeEndOfLife)) lines.push(vline(activeEndOfLife, '#ef4444', 'End of Life'));

  const { years, yMax, step } = distData;
  const minYr = years[0] ?? 1996;
  const maxYr = years[years.length - 1] ?? 2024;
  const tickCount = Math.round(yMax / step) + 1;
  const tickVals = Array.from({ length: tickCount }, (_, i) => i * step);

  return {
    template: 'plotly_white',
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    margin: { t: 50, b: 155, l: 90, r: 40 },
    height: 390,
    legend: { orientation: 'h', yanchor: 'top', y: -0.22, xanchor: 'center', x: 0.5, font: { size: 12 }, bordercolor: '#000', borderwidth: 1 },
    hovermode: 'x unified',
    barmode: 'group',
    xaxis: {
      title: { text: '<b>Fiscal Year</b>', font: { size: 14 } },
      range: [minYr - 0.7, maxYr + 0.7],
      tickmode: 'linear', dtick: 1, tickangle: -45,
      tickfont: { size: 12 }, showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside',
    },
    yaxis: {
      title: { text: '<b>Avg. distress per centerline mile</b>', font: { size: 13 } },
      range: [0, yMax], tickvals: tickVals,
      tickfont: { size: 12 }, showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside',
      gridcolor: '#dddddd',
    },
    shapes: lines.map(l => l.shape),
    annotations: lines.map(l => l.annotation),
  };
}

// ─── Main component ────────────────────────────────────────────────────────
export default function VerifyModal({ 
  rows, currentIndex, onClose, onPrev, onNext, verifiedSNs, 
  onVerify, onUnverify, pmisDetailMap, isLoadingDetail, 
  actualEndOfLifeMap, onUpdateActualEndOfLife, 
  actualYearConstMap, onUpdateActualYearConst, mode, hideCharts
}) {
  const isInService = mode === 'inservice';
  const row = rows[currentIndex];
  const uniqueId = row ? (row['ID'] || row['S/N']) : null;
  const isVerified = verifiedSNs.has(uniqueId);
  const actualEndOfLife = actualEndOfLifeMap?.[uniqueId];
  const actualYearConst = actualYearConstMap?.[uniqueId];

  // Keyboard navigation
  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onPrev();
    if (e.key === 'ArrowRight') onNext();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  // Build chart data
  const evalData = useMemo(() => pmisDetailMap && row ? buildEvalData(pmisDetailMap, row) : null, [pmisDetailMap, row]);
  const distData = useMemo(() => pmisDetailMap && row ? buildDistressData(pmisDetailMap, row) : null, [pmisDetailMap, row]);

  if (!row) return null;

  const highway = row['HIGHWAY'] || '—';
  const direction = row['_direction'];
  const dirColor = direction === 'L' ? 'var(--info)' : '#a855f7';

  // ─── Eval chart traces ────────────────────────────────────────────────
  const evalTraces = evalData ? [
    {
      type: 'bar', name: 'Distress Score',
      x: evalData.years, y: evalData.distressScore,
      marker: { color: '#1f77b4', line: { color: '#000', width: 0.8 } },
      hovertemplate: 'Year: %{x}<br>Distress: %{y:.1f}<extra></extra>',
    },
    {
      type: 'bar', name: 'Condition Score',
      x: evalData.years, y: evalData.conditionScore,
      marker: { color: '#2ca02c', line: { color: '#000', width: 0.8 } },
      opacity: 0.85,
      hovertemplate: 'Year: %{x}<br>Condition: %{y:.1f}<extra></extra>',
    },
    {
      type: 'scatter', name: 'Ride Score', yaxis: 'y2',
      x: evalData.years, y: evalData.rideScore,
      mode: 'lines+markers',
      marker: { symbol: 'diamond', size: 9, color: '#d62728' },
      line: { color: '#d62728', width: 2.5 },
      hovertemplate: 'Year: %{x}<br>Ride: %{y:.2f}<extra></extra>',
    },
  ] : [];

  // ─── Distress chart traces ────────────────────────────────────────────
  const distTraces = distData ? [
    { type: 'bar', name: 'Punchouts', x: distData.years, y: distData.punchPerMile, marker: { color: '#d62728', line: { color: '#000', width: 0.8 } }, hovertemplate: '<b>Punchouts</b>: %{y:.2f}/mi<extra></extra>' },
    { type: 'bar', name: 'ACP Patches', x: distData.years, y: distData.acpPerMile, marker: { color: '#1f77b4', line: { color: '#000', width: 0.8 } }, hovertemplate: '<b>ACP Patches</b>: %{y:.2f}/mi<extra></extra>' },
    { type: 'bar', name: 'PCC Patches', x: distData.years, y: distData.pccPerMile, marker: { color: '#555555', line: { color: '#000', width: 0.8 } }, hovertemplate: '<b>PCC Patches</b>: %{y:.2f}/mi<extra></extra>' },
    { type: 'bar', name: 'Spalled Cracks', x: distData.years, y: distData.spallPerMile, marker: { color: '#ff7f0e', line: { color: '#000', width: 0.8 } }, hovertemplate: '<b>Spalled Cracks</b>: %{y:.2f}/mi<extra></extra>' },
  ] : [];

  const evalLayout = evalData ? buildEvalLayout(row, actualEndOfLife, actualYearConst, [], [], evalData.years, isInService) : null;
  const distLayout = distData ? buildDistressLayout(row, isInService ? null : actualEndOfLife, actualYearConst, distData, isInService) : null;

  return (
    <div
      className="modal-overlay"
      role="dialog" aria-modal="true" aria-label="Section detail"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal--verify">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="modal__header">
          <div className="modal__title">
            <span className="modal__title-main">
              Verify Service Life
              {isVerified
                ? <span className="status-badge status-badge--success" style={{ marginLeft: 12, fontSize: 11 }}>✓ Verified</span>
                : <span className="status-badge status-badge--muted" style={{ marginLeft: 12, fontSize: 11 }}>Unverified</span>
              }
            </span>
            <span className="modal__title-sub">
              ID: {row.ID} · {highway}&nbsp;
              <span style={{ color: dirColor, fontWeight: 700 }}>({direction})</span>
            </span>
          </div>
          <button id="verify-modal-close" className="modal__close" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="modal__body modal__body--scrollable">
          {/* Info cards */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            <InfoCard label="ID" value={row['ID']} />
            <InfoCard label="S/N" value={row['S/N']} />
            <InfoCard label="Highway" value={highway} />
            <InfoCard label="Direction" value={direction} accent={dirColor} />
            <InfoCard label="District" value={row['DISTRICT']} />
            <InfoCard label="Service Life" value={row['Service Life'] ? `${row['Service Life']} yrs` : null} accent="var(--accent-secondary)" />
            
            {/* Repaired mode: Actual Service Life based on End of Life */}
            {!isInService && (
              <InfoCard 
                label="Actual Service Life" 
                value={(() => {
                  const eolToUse = actualEndOfLife || row['End of Life'];
                  if (eolToUse && !isNaN(parseInt(eolToUse, 10)) && !isNaN(parseInt(row['Year Constructed'], 10))) {
                    return `${parseInt(eolToUse, 10) - parseInt(row['Year Constructed'], 10)} yrs`;
                  }
                  return '—';
                })()}
                accent="var(--accent-secondary)" 
              />
            )}
            
            {/* In-Service mode: Actual Service Life based on Year Const */}
            {isInService && (
              <InfoCard 
                label="Actual Service Life" 
                value={(() => {
                  const origYC = parseInt(row['Year Constructed'], 10);
                  const activeYC = actualYearConst ? parseInt(actualYearConst, 10) : origYC;
                  const origSL = parseInt(row['Service Life'], 10);
                  if (!isNaN(origYC) && !isNaN(activeYC) && !isNaN(origSL)) {
                    return `${origSL + (origYC - activeYC)} yrs`;
                  }
                  return '—';
                })()}
                accent="var(--accent-secondary)" 
              />
            )}

            {/* Repaired mode: Static Year Const. */}
            {!isInService && (
              <InfoCard label="Year Const." value={row['Year Constructed']} accent="var(--success)" />
            )}

            {/* In-Service mode: Editable Actual Year Const. */}
            {isInService && (
              <div style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', padding: '8px 14px', minWidth: 100, flex: '1 1 120px', maxWidth: '18%'
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                  Actual Year Const.
                </div>
                <input
                  type="number"
                  value={actualYearConst || row['Year Constructed'] || ''}
                  onChange={(e) => onUpdateActualYearConst(uniqueId, e.target.value)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: actualYearConst ? 'var(--accent-secondary)' : 'var(--success)',
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    padding: 0
                  }}
                />
              </div>
            )}

            {/* Repaired mode: Static End of Life and Editable Actual End of Life */}
            {!isInService && (
              <InfoCard label="End of Life" value={row['End of Life']} accent="#f59e0b" />
            )}
            {!isInService && (
              <div style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)', padding: '8px 14px', minWidth: 100, flex: '1 1 120px', maxWidth: '18%'
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
                  Actual End of Life
                </div>
                <input
                  type="number"
                  value={actualEndOfLife || row['End of Life'] || ''}
                  onChange={(e) => onUpdateActualEndOfLife(uniqueId, e.target.value)}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    color: actualEndOfLife ? 'var(--accent-secondary)' : 'var(--error)',
                    fontWeight: 700,
                    fontSize: 'var(--text-sm)',
                    fontFamily: 'var(--font-mono)',
                    outline: 'none',
                    padding: 0
                  }}
                />
              </div>
            )}
            <InfoCard label="Begin Ref" value={row['Begin Ref']} />
            <InfoCard label="End Ref" value={row['End Ref']} />
            <InfoCard label="Rehab Method" value={row['Rehab Method']} />
          </div>

          {/* Loading detail */}
          {isLoadingDetail && !hideCharts && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '32px 0', color: 'var(--text-muted)' }}>
              <span className="spinner" style={{ width: 20, height: 20 }} />
              <span>Loading PMIS chart data — parsing 168 MB CSV (one-time per session)…</span>
            </div>
          )}

          {/* Charts */}
          {!isLoadingDetail && !hideCharts && (
            <>
              {/* Chart 1: Evaluation Scores */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: 8, fontSize: 'var(--text-sm)' }}>
                  Evaluation Scores
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                    — weighted by section length · dashed lines mark Year Const. (green) and End of Life (red)
                  </span>
                </div>
                {evalTraces.length > 0 ? (
                  <PlotlyChart
                    data={evalTraces}
                    layout={evalLayout}
                    filename={`eval_${row['ID']}_${highway}`}
                    style={{ height: 390 }}
                  />
                ) : (
                  <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    No PMIS evaluation data found for this section's range.
                  </div>
                )}
              </div>

              {/* Chart 2: Distress Counts */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: 8, fontSize: 'var(--text-sm)' }}>
                  Distress Counts per Centerline Mile
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 11, marginLeft: 8 }}>
                    — dashed lines mark Year Const. (green) and End of Life (red)
                  </span>
                </div>
                {distTraces.length > 0 ? (
                  <PlotlyChart
                    data={distTraces}
                    layout={distLayout}
                    filename={`distress_${row['ID']}_${highway}`}
                    style={{ height: 390 }}
                  />
                ) : (
                  <div style={{ padding: '24px 0', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    No PMIS distress data found for this section's range.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="modal__footer">
          <div className="modal__nav">
            <button id="verify-modal-prev" className="btn btn--secondary btn--sm" onClick={onPrev} disabled={currentIndex === 0} title="Previous (← key)">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4L6 8l4 4" /></svg>
              Previous
            </button>
            <span className="modal__counter">{currentIndex + 1} / {rows.length}</span>
            <button id="verify-modal-next" className="btn btn--secondary btn--sm" onClick={onNext} disabled={currentIndex === rows.length - 1} title="Next (→ key)">
              Next
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 4l4 4-4 4" /></svg>
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {isVerified ? (
              <button
                id="verify-remove-btn"
                className="btn btn--danger"
                onClick={() => onUnverify(uniqueId)}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
                Remove from Verified
              </button>
            ) : (
              <button
                id="verify-add-btn"
                className="btn btn--success"
                onClick={() => onVerify(uniqueId)}
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14">
                  <path d="M4 10l5 5 7-8" />
                </svg>
                Add to Verified
              </button>
            )}
            <button id="verify-modal-close-footer" className="btn btn--ghost btn--sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
