import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';

export default function TrafficServiceLifeWorkspace() {
  const [dataStats, setDataStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTrendline, setShowTrendline] = useState(false);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadState().then(state => {
      if (!active) return;
      
      const reconTraffic = state.trafficAnalysis?.reconstructed?.results || [];
      const inServiceTraffic = state.trafficAnalysis?.inservice?.results || [];

      const reconEndOfLifeMap = state.reconstructed?.actualEndOfLifeMap || {};
      const inServiceYearConstMap = state.inservice?.actualYearConstMap || {};

      const reconScatter = [];
      const inServiceScatter = [];

      const reconVerified = new Set(state.reconstructed?.verifiedSNs || []);
      const inServiceVerified = new Set(state.inservice?.verifiedSNs || []);

      for (const row of reconTraffic) {
        const id = row['ID'] || row['S/N'];
        if (!reconVerified.has(id)) continue;

        const esal = Number(row['CUMULATIVE_ESAL']);
        if (isNaN(esal) || esal <= 0) continue;

        const origYC = Number(row['CONSTRUCTION_YEAR']) || Number(row['Year Constructed']) || 0;
        const actualEOL = reconEndOfLifeMap[id];
        const eolToUse = actualEOL || row['END_OF_LIFE'] || row['End of Life'];
        const eolVal = Number(eolToUse);
        
        let serviceLife = Number(row['SERVICE_LIFE']) || Number(row['Service Life']) || 0;
        if (!isNaN(origYC) && !isNaN(eolVal) && origYC > 0) {
            serviceLife = eolVal - origYC;
        }

        if (serviceLife > 0) {
          reconScatter.push({ esal, serviceLife });
        }
      }

      for (const row of inServiceTraffic) {
        const id = row['ID'] || row['S/N'];
        if (!inServiceVerified.has(id)) continue;

        const esal = Number(row['CUMULATIVE_ESAL']);
        if (isNaN(esal) || esal <= 0) continue;

        let actualServiceLife = Number(row['SERVICE_LIFE']) || Number(row['Service Life']) || 0;
        const actualYC = inServiceYearConstMap[id];
        const hasOverride = !!actualYC;
        const origYC = parseInt(row['CONSTRUCTION_YEAR'] || row['Year Constructed'], 10);
        const activeYC = hasOverride ? parseInt(actualYC, 10) : origYC;
        const currentYear = new Date().getFullYear();
        
        if (!isNaN(activeYC)) {
            actualServiceLife = currentYear - activeYC;
        }

        if (actualServiceLife > 0) {
            inServiceScatter.push({ esal, serviceLife: actualServiceLife });
        }
      }

      // Group for average
      const allScatter = [...reconScatter, ...inServiceScatter];
      const byLife = {};
      for (const item of allScatter) {
        if (!byLife[item.serviceLife]) byLife[item.serviceLife] = { sum: 0, count: 0 };
        byLife[item.serviceLife].sum += item.esal;
        byLife[item.serviceLife].count++;
      }
      
      const avgData = Object.keys(byLife).map(k => ({
        serviceLife: Number(k),
        avgEsal: byLife[k].sum / byLife[k].count
      })).sort((a, b) => a.serviceLife - b.serviceLife);

      setDataStats({
        reconScatter,
        inServiceScatter,
        avgData
      });
      setIsLoading(false);
    });

    return () => { active = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="loading-overlay__spinner" style={{ width: 40, height: 40 }} />
          <div style={{ color: 'var(--text-muted)' }}>Calculating ESAL distributions...</div>
        </div>
      </div>
    );
  }

  if (!dataStats) return null;

  // Trendline Logic
  const allPoints = [...dataStats.reconScatter, ...dataStats.inServiceScatter];
  let trendlineTrace = null;
  let trendlineAnnotation = null;

  if (showTrendline && allPoints.length > 1) {
    const n = allPoints.length;
    const sumX = allPoints.reduce((acc, p) => acc + p.serviceLife, 0);
    const sumY = allPoints.reduce((acc, p) => acc + (p.esal / 1000000), 0);
    const sumXY = allPoints.reduce((acc, p) => acc + p.serviceLife * (p.esal / 1000000), 0);
    const sumXX = allPoints.reduce((acc, p) => acc + p.serviceLife * p.serviceLife, 0);

    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const b = (sumY - m * sumX) / n;

    const minX = Math.min(...allPoints.map(p => p.serviceLife));
    const maxX = Math.max(...allPoints.map(p => p.serviceLife));

    const meanY = sumY / n;
    let ssTot = 0;
    let ssRes = 0;
    for (const p of allPoints) {
      const actualY = p.esal / 1000000;
      const predY = m * p.serviceLife + b;
      ssTot += Math.pow(actualY - meanY, 2);
      ssRes += Math.pow(actualY - predY, 2);
    }
    const r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

    trendlineTrace = {
      x: [minX, maxX],
      y: [m * minX + b, m * maxX + b],
      mode: 'lines',
      type: 'scatter',
      name: 'Linear Trend',
      line: { color: 'black', width: 3, dash: 'dash' }
    };

    trendlineAnnotation = {
      x: (minX + maxX) / 2,
      y: 130, // Upper middle since max is 160
      xref: 'x',
      yref: 'y',
      text: `<b>y = ${m.toFixed(4)}x ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(4)}</b><br><b>R² = ${r2.toFixed(4)}</b>`,
      showarrow: false,
      font: { size: 18, color: 'black' },
      bgcolor: 'rgba(255,255,255,0.8)',
      bordercolor: 'black',
      borderwidth: 1,
      borderpad: 4
    };
  }

  // Scatter Plot
  const scatterChartRecon = {
    x: dataStats.reconScatter.map(d => d.serviceLife),
    y: dataStats.reconScatter.map(d => d.esal / 1000000),
    mode: 'markers',
    type: 'scatter',
    name: 'Reconstructed',
    marker: { color: '#ff4d4d', size: 10, opacity: 0.7, line: { color: 'black', width: 1 } }
  };

  const scatterChartInService = {
    x: dataStats.inServiceScatter.map(d => d.serviceLife),
    y: dataStats.inServiceScatter.map(d => d.esal / 1000000),
    mode: 'markers',
    type: 'scatter',
    name: 'In Service',
    marker: { color: '#2ca25f', size: 10, opacity: 0.7, line: { color: 'black', width: 1 } }
  };

  const scatterData = [scatterChartRecon, scatterChartInService];
  if (trendlineTrace) scatterData.push(trendlineTrace);

  const scatterLayout = {
    annotations: trendlineAnnotation ? [trendlineAnnotation] : [],
    xaxis: {
      title: { text: '<b>Service Life (Years)</b>', font: { size: 28 } },
      tickmode: 'linear', dtick: 5,
      tickfont: { size: 22 }, tickangle: 0, ticks: 'inside', rangemode: 'tozero',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Cumulative ESAL (millions)</b>', font: { size: 28 } },
      tickfont: { size: 22 }, ticks: 'inside', range: [0, 160],
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    legend: {
      font: { size: 22 },
      x: 1, xanchor: 'right', y: 1,
      bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1
    },
    margin: { t: 40, r: 20, l: 100, b: 100 },
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' },
    showlegend: true
  };

  // Bar Chart
  const barChart = [{
    x: dataStats.avgData.map(d => d.serviceLife),
    y: dataStats.avgData.map(d => d.avgEsal / 1000000),
    type: 'bar',
    marker: { color: 'lightgrey', line: { color: 'black', width: 1 } },
    text: dataStats.avgData.map(d => (d.avgEsal / 1000000).toFixed(2)),
    textposition: 'outside',
    textfont: { size: 22, color: 'black' }
  }];

  const barLayout = {
    title: { text: '<b>Average ESAL vs. Service Life</b>', font: { size: 28 } },
    xaxis: {
      title: { text: '<b>Service Life (Years)</b>', font: { size: 28 } },
      tickmode: 'linear', dtick: 1,
      tickfont: { size: 22 }, tickangle: 0, ticks: 'inside',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Average ESAL (millions)</b>', font: { size: 28 } },
      tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    margin: { t: 40, r: 20, l: 100, b: 100 },
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' },
    showlegend: false
  };

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Traffic Service Life Limits</div>
          <div className="workspace__subtitle">Comparing Actual End of Life vs Time to reach Traffic ESAL Limits.</div>
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
        
        {/* Scatter Plot */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Cumulative ESAL vs. Service Life (Scatter Plot)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Plotted</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconScatter.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>In-Service Plotted</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.inServiceScatter.length}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={showTrendline} onChange={e => setShowTrendline(e.target.checked)} style={{ width: 16, height: 16 }} />
                  Show Linear Trendline
                </label>
              </div>
            </div>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={scatterData}
                layout={scatterLayout}
                filename="esal_vs_servicelife_scatter"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        {/* Bar Chart */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Average ESAL vs. Service Life (Bar Chart)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={barChart}
                layout={barLayout}
                filename="esal_vs_servicelife_bar"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>
        
      </div>
    </div>
  );
}
