import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';
import { loadPMISDetailMap } from '../../utils/fileLoader';
import { buildEvalData, buildDistressData } from '../../hooks/useVerifyCharts';

export default function AfterTerminalCWorkspace({ mode }) {
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [terminalData, setTerminalData] = useState({
    conditions: [],
    distresses: [],
    rides: [],
    iris: [],
    punchouts: [],
    spalls: [],
    acpPatches: [],
    pccPatches: [],
    totalSections: 0,
    validSections: 0
  });

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        // Load reconstructed state
        const state = await loadState();
        const d = state['reconstructed'];
        if (!d) throw new Error("No reconstructed state found. Run Match PMIS first.");

        const verifiedSet = new Set(d?.verifiedSNs || []);
        const actualEndOfLifeMap = d?.actualEndOfLifeMap || {};
        const pmisRows = d?.pmisRows || [];
        
        // Filter verified
        const verifiedRows = pmisRows.filter(r => verifiedSet.has(r['ID'] || r['S/N']));
        
        // Load PMIS detailed map
        const pmisDetailMap = await loadPMISDetailMap();

        const conditions = [];
        const distresses = [];
        const rides = [];
        const iris = [];
        const punchouts = [];
        const spalls = [];
        const acpPatches = [];
        const pccPatches = [];

        let validSectionsCount = 0;

        for (const row of verifiedRows) {
          const uniqueId = row['ID'] || row['S/N'];
          const actualEOL = actualEndOfLifeMap[uniqueId];
          const eolToUse = actualEOL || row['End of Life'];
          const terminalYear = parseInt(eolToUse, 10);
          
          if (isNaN(terminalYear)) continue;

          const evalData = buildEvalData(pmisDetailMap, row);
          const distData = buildDistressData(pmisDetailMap, row);
          
          if (!evalData || !evalData.years || evalData.years.length === 0) continue;

          let bestIdx = -1;
          let bestCond = -1;

          for (let i = 0; i < evalData.years.length; i++) {
            const yr = parseInt(evalData.years[i], 10);
            if (yr >= terminalYear + 1 && yr <= terminalYear + 5) {
              const cond = evalData.conditionScore[i];
              if (cond !== null && cond > bestCond) {
                bestCond = cond;
                bestIdx = i;
              }
            }
          }

          if (bestIdx === -1) continue;

          let hasData = false;
          
          // Scores
          const targetYear = evalData.years[bestIdx];
          const cond = evalData.conditionScore[bestIdx];
          const dist = evalData.distressScore[bestIdx];
          const ride = evalData.rideScore[bestIdx];
          const iri = evalData.iriScore ? evalData.iriScore[bestIdx] : null;

          if (cond !== null) { conditions.push(cond); hasData = true; }
          if (dist !== null) { distresses.push(dist); hasData = true; }
          if (ride !== null) { rides.push(ride); hasData = true; }
          if (iri !== null) { iris.push(iri); hasData = true; }

          // Distresses
          if (distData && distData.years) {
            let distTargetIdx = distData.years.indexOf(targetYear);
            if (distTargetIdx !== -1) {
              const punch = distData.punchPerMile[distTargetIdx];
              const spall = distData.spallPerMile[distTargetIdx];
              const acp = distData.acpPerMile[distTargetIdx];
              const pcc = distData.pccPerMile[distTargetIdx];
              
              if (punch !== null) punchouts.push(Math.round(punch));
              if (spall !== null) spalls.push(Math.round(spall));
              if (acp !== null) acpPatches.push(Math.round(acp));
              if (pcc !== null) pccPatches.push(Math.round(pcc));
            }
          }

          if (hasData) validSectionsCount++;
        }

        if (active) {
          setTerminalData({
            conditions,
            distresses,
            rides,
            iris,
            punchouts,
            spalls,
            acpPatches,
            pccPatches,
            totalSections: verifiedRows.length,
            validSections: validSectionsCount,
            debugKeys: verifiedRows.length > 0 ? Object.keys(verifiedRows[0]).join(', ') : 'No rows'
          });
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err.message || String(err));
          setLoading(false);
        }
      }
    }

    if (mode === 'reconstructed') {
      loadData();
    } else {
      setLoading(false);
    }

    return () => { active = false; };
  }, [mode]);

  // ─── Chart Builders ──────────────────────────────────────────────────────
  function getBinIndex(val, bins) {
    for (let i = 0; i < bins.length - 1; i++) {
      if (val >= bins[i] && val < bins[i + 1]) return i;
    }
    if (val >= bins[bins.length - 1]) return bins.length - 2;
    return -1;
  }

  function buildPctChart(dataArr, bins, labels, title, isScoreChart, conditionMean = null, conditionMedian = null) {
    if (!dataArr || dataArr.length === 0) {
      return { 
        data: [], 
        layout: { 
          xaxis: { title: { text: `<b>${title}</b>`, font: { size: 13, color: 'black' } } },
          yaxis: { title: { text: '<b>Percentage of Sections (%)</b>', font: { size: 13, color: 'black' } } }
        } 
      };
    }

    const counts = new Array(bins.length - 1).fill(0);
    for (const v of dataArr) {
      const idx = getBinIndex(v, bins);
      if (idx >= 0 && idx < labels.length) {
        counts[idx]++;
      }
    }

    const total = dataArr.length;
    const pcts = counts.map(c => total > 0 ? (c / total * 100) : 0);
    const maxY = Math.max(...pcts, 0);

    const shapes = [];
    const dummyTraces = [];

    if (conditionMean !== null || conditionMedian !== null) {
      if (conditionMean !== null) {
        const binIdx = getBinIndex(conditionMean, bins);
        if (binIdx >= 0) {
          const binWidth = bins[binIdx+1] - bins[binIdx];
          const offset = (conditionMean - bins[binIdx]) / binWidth;
          const xPos = binIdx - 0.5 + offset;
          
          shapes.push({
            type: 'line', x0: xPos, x1: xPos, y0: 0, y1: 1, yref: 'paper',
            line: { color: 'blue', width: 2, dash: 'dash' }
          });
          dummyTraces.push({
            x: [null], y: [null], name: `Mean: ${conditionMean.toFixed(1)}`,
            mode: 'lines', line: { color: 'blue', width: 2, dash: 'dash' },
            showlegend: true
          });
        }
      }
      if (conditionMedian !== null) {
        const binIdx = getBinIndex(conditionMedian, bins);
        if (binIdx >= 0) {
          const binWidth = bins[binIdx+1] - bins[binIdx];
          const offset = (conditionMedian - bins[binIdx]) / binWidth;
          const xPos = binIdx - 0.5 + offset;
          
          shapes.push({
            type: 'line', x0: xPos, x1: xPos, y0: 0, y1: 1, yref: 'paper',
            line: { color: 'red', width: 2, dash: 'dash' }
          });
          dummyTraces.push({
            x: [null], y: [null], name: `Median: ${conditionMedian.toFixed(1)}`,
            mode: 'lines', line: { color: 'red', width: 2, dash: 'dash' },
            showlegend: true
          });
        }
      }
    }

    return {
      data: [
        {
          x: labels,
          y: pcts,
          type: 'bar',
          name: 'Segments',
          showlegend: false,
          marker: { color: 'black', line: { color: 'black', width: 1 } },
          text: pcts.map(p => p > 0 ? `${Math.round(p)}%` : ''),
          textposition: 'outside',
          cliponaxis: false,
          textfont: { family: 'Arial', size: 22, color: 'black' },
          hovertemplate: '%{x}<br>Percentage: %{y:.0f}%<br>Count: %{customdata}<extra></extra>',
          customdata: counts
        },
        ...dummyTraces
      ],
      layout: {
        template: 'plotly_white',
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        margin: { t: 20, b: 100, l: 100, r: 20 },
        xaxis: {
          title: { text: `<b>${title}</b>`, font: { size: 28, color: 'black' } },
          tickangle: 0,
          tickfont: { size: 22 },
          showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside'
        },
        yaxis: {
          title: { text: '<b>Percentage of Sections (%)</b>', font: { size: 28, color: 'black' } },
          tickfont: { size: 22 },
          showline: true, linewidth: 2, linecolor: '#000', mirror: true, ticks: 'inside',
          gridcolor: 'rgba(0,0,0,0.05)',
          range: [0, maxY > 0 ? maxY * 1.25 : 100]
        },
        shapes,
        showlegend: dummyTraces.length > 0,
        legend: { x: isScoreChart ? 0 : 1, y: 1, xanchor: isScoreChart ? 'left' : 'right', yanchor: 'top', bgcolor: 'rgba(255,255,255,0.7)', bordercolor: '#ccc', borderwidth: 1, font: { size: 22 } },
        font: { color: 'black', family: 'Arial' },
        bargap: 0.2
      }
    };
  }

  if (mode !== 'reconstructed') {
    return (
      <div className="workspace" style={{ overflowY: 'auto' }}>
        <div className="empty-state">
          <div className="empty-state__icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="empty-state__title">Mode Mismatch</div>
          <div className="empty-state__desc">Terminal PMIS Scores are only applicable to Reconstructed sections. Please switch modes in the top navigation.</div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="workspace" style={{ overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 16 }}>
          <div className="loading-overlay__spinner" style={{ width: 32, height: 32 }} />
          <div style={{ color: 'var(--text-muted)' }}>Calculating terminal scores...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspace" style={{ overflowY: 'auto' }}>
        <div className="empty-state">
          <div className="empty-state__icon" style={{ color: 'var(--error)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
            </svg>
          </div>
          <div className="empty-state__title">Analysis Failed</div>
          <div className="empty-state__desc">{error}</div>
        </div>
      </div>
    );
  }

  // Calculate Mean and Median helper
  function getMeanMedian(arr) {
    if (!arr || arr.length === 0) return { mean: null, median: null };
    const sorted = [...arr].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    return { mean, median };
  }

  const condStats = getMeanMedian(terminalData.conditions);
  const distStats = getMeanMedian(terminalData.distresses);
  const rideStats = getMeanMedian(terminalData.rides);
  const iriStats = getMeanMedian(terminalData.iris);

  const punchStats = getMeanMedian(terminalData.punchouts);
  const spallStats = getMeanMedian(terminalData.spalls);
  const acpStats = getMeanMedian(terminalData.acpPatches);
  const pccStats = getMeanMedian(terminalData.pccPatches);

  // Chart configuration
  const scoreBins = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 101];
  const scoreLabels = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'];
  
  const rideBins = [0, 1.0, 2.0, 3.0, 4.0, 5.1];
  const rideLabels = ['0-0.9', '1.0-1.9', '2.0-2.9', '3.0-3.9', '4.0-5.0'];
  
  const iriBins = [0, 50, 100, 150, 200, 250, 9999];
  const iriLabels = ['0-49', '50-99', '100-149', '150-199', '200-249', '250+'];

  const condChart = buildPctChart(terminalData.conditions, scoreBins, scoreLabels, 'After Terminal (C) Condition Score Range', true, condStats.mean, condStats.median);
  const distChart = buildPctChart(terminalData.distresses, scoreBins, scoreLabels, 'After Terminal (C) Distress Score Range', true, distStats.mean, distStats.median);
  const rideChart = buildPctChart(terminalData.rides, rideBins, rideLabels, 'After Terminal (C) Ride Score Range', true, rideStats.mean, rideStats.median);
  const iriChart = buildPctChart(terminalData.iris, iriBins, iriLabels, 'After Terminal (C) IRI Score Range', true, iriStats.mean, iriStats.median);

  const punchBins = [0, 1, 6, 11, 16, 21, 9999];
  const punchLabels = ['0', '1-5', '6-10', '11-15', '16-20', '21+'];

  const tenBins = [0, 1, 11, 21, 31, 41, 51, 9999];
  const tenLabels = ['0', '1-10', '11-20', '21-30', '31-40', '41-50', '51+'];

  const punchChart = buildPctChart(terminalData.punchouts, punchBins, punchLabels, 'After Terminal (C) Punchouts (per centerline mile)', false, punchStats.mean, punchStats.median);
  const spallChart = buildPctChart(terminalData.spalls, tenBins, tenLabels, 'After Terminal (C) Spalls (per centerline mile)', false, spallStats.mean, spallStats.median);
  const acpPatchChart = buildPctChart(terminalData.acpPatches, tenBins, tenLabels, 'After Terminal (C) ACP Patches (per centerline mile)', false, acpStats.mean, acpStats.median);
  const pccPatchChart = buildPctChart(terminalData.pccPatches, tenBins, tenLabels, 'After Terminal (C) PCC Patches (per centerline mile)', false, pccStats.mean, pccStats.median);

  const StatsBar = () => (
    <div className="stats-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', marginBottom: 24 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Population</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{terminalData.validSections} <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 400 }}>of {terminalData.totalSections} verified</span></div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg After Terminal (C) Condition</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--info)' }}>{condStats.mean ? condStats.mean.toFixed(1) : '—'}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg After Terminal (C) Distress</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{distStats.mean ? distStats.mean.toFixed(1) : '—'}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg After Terminal (C) Ride</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{rideStats.mean ? rideStats.mean.toFixed(1) : '—'}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg After Terminal (C) IRI</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{iriStats.mean ? iriStats.mean.toFixed(1) : '—'}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg Punchouts</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{punchStats.mean !== null ? punchStats.mean.toFixed(1) : '—'}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Avg Spalls</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{spallStats.mean !== null ? spallStats.mean.toFixed(1) : '—'}</div>
      </div>
    </div>
  );

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">After Terminal (C) PMIS Scores</div>
          <div className="workspace__subtitle">PMIS condition scores for sections in the 5 years following construction (peak condition year).</div>
        </div>
        <div className="workspace__toolbar-right">
          <button className="btn btn--secondary btn--sm" onClick={() => window.location.reload()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Update Analysis
          </button>
        </div>
      </div>

      <div className="workspace__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
          
          <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }} open>
            <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
              Terminal Scores
            </summary>
            <div style={{ padding: 24 }}>
              <StatsBar />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ height: 350 }}><PlotlyChart data={condChart.data} layout={condChart.layout} config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={distChart.data} layout={distChart.layout} config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={rideChart.data} layout={rideChart.layout} config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={iriChart.data} layout={iriChart.layout} config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
              </div>
            </div>
          </details>

          <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
            <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
              Terminal Distress Counts
            </summary>
            <div style={{ padding: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ height: 350 }}><PlotlyChart data={punchChart.data} layout={punchChart.layout} config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={spallChart.data} layout={spallChart.layout} config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={acpPatchChart.data} layout={acpPatchChart.layout} config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={pccPatchChart.data} layout={pccPatchChart.layout} config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
              </div>
            </div>
          </details>
      </div>
    </div>
  );
}
