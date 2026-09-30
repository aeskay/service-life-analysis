import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';

export default function TrafficSlabBaseWorkspace() {
  const [dataStats, setDataStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadState().then(state => {
      if (!active) return;
      
      const reconTraffic = state.trafficAnalysis?.reconstructed?.results || [];
      const inServiceTraffic = state.trafficAnalysis?.inservice?.results || [];

      const reconScatterThickness = [];
      const inServiceScatterThickness = [];
      const reconScatterBase = [];
      const inServiceScatterBase = [];

      const reconVerified = new Set(state.reconstructed?.verifiedSNs || []);
      const inServiceVerified = new Set(state.inservice?.verifiedSNs || []);

      for (const row of reconTraffic) {
        const id = row['ID'] || row['S/N'];
        if (!reconVerified.has(id)) continue;

        const esal = Number(row['CUMULATIVE_ESAL']);
        if (isNaN(esal) || esal <= 0) continue;
        
        // Reconstructed uses OLD_SLAB_TH
        let slabThickness = parseFloat(row['OLD_SLAB_TH'] || row['Old Slab Th']);
        if (isNaN(slabThickness) || slabThickness <= 0) {
          slabThickness = parseFloat(row['SLAB_TH'] || row['Slab Th'] || row['Slab Thickness'] || row['SLAB_THICKNESS']);
        }
        
        if (!isNaN(slabThickness) && slabThickness > 0) {
          const jitterX = slabThickness + (Math.random() - 0.5) * 0.4;
          reconScatterThickness.push({ x: esal, y: jitterX, originalX: slabThickness });
        }
        
        // Reconstructed uses OLD_BASE_TH
        let baseThickness = parseFloat(row['OLD_BASE_TH'] || row['Old Base Th']);
        if (isNaN(baseThickness) || baseThickness <= 0) {
          baseThickness = parseFloat(row['BASE_TH'] || row['Base Th'] || row['Base Thickness'] || row['BASE_THICKNESS']);
        }
        
        if (!isNaN(baseThickness) && baseThickness > 0) {
          const jitterX = baseThickness + (Math.random() - 0.5) * 0.4;
          reconScatterBase.push({ x: esal, y: jitterX, originalX: baseThickness });
        }
      }

      for (const row of inServiceTraffic) {
        const id = row['ID'] || row['S/N'];
        if (!inServiceVerified.has(id)) continue;

        const esal = Number(row['CUMULATIVE_ESAL']);
        if (isNaN(esal) || esal <= 0) continue;
        
        // In Service uses SLAB_TH
        let slabThickness = parseFloat(row['SLAB_TH'] || row['Slab Th']);
        if (isNaN(slabThickness) || slabThickness <= 0) {
          slabThickness = parseFloat(row['OLD_SLAB_TH'] || row['Old Slab Th'] || row['Slab Thickness'] || row['SLAB_THICKNESS']);
        }
        
        if (!isNaN(slabThickness) && slabThickness > 0) {
          const jitterX = slabThickness + (Math.random() - 0.5) * 0.4;
          inServiceScatterThickness.push({ x: esal, y: jitterX, originalX: slabThickness });
        }
        
        // In Service uses BASE_TH
        let baseThickness = parseFloat(row['BASE_TH'] || row['Base Th']);
        if (isNaN(baseThickness) || baseThickness <= 0) {
          baseThickness = parseFloat(row['OLD_BASE_TH'] || row['Old Base Th'] || row['Base Thickness'] || row['BASE_THICKNESS']);
        }
        
        if (!isNaN(baseThickness) && baseThickness > 0) {
          const jitterX = baseThickness + (Math.random() - 0.5) * 0.4;
          inServiceScatterBase.push({ x: esal, y: jitterX, originalX: baseThickness });
        }
      }

      setDataStats({
        reconScatterThickness,
        inServiceScatterThickness,
        reconScatterBase,
        inServiceScatterBase,
        inServiceMissing: inServiceTraffic.length === 0
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
  
  // Scatter Data (ESAL vs Slab Thickness)
  const scatterThicknessRecon = {
    x: dataStats.reconScatterThickness.map(d => d.y), // Slab Thickness (X) jittered
    y: dataStats.reconScatterThickness.map(d => d.x / 1000000), // Cumulative ESAL (Y)
    mode: 'markers',
    type: 'scatter',
    name: 'Reconstructed',
    text: dataStats.reconScatterThickness.map(d => `Slab Thickness: ${d.originalX} inches`),
    hoverinfo: 'text+y',
    marker: { color: '#ff4d4d', size: 10, opacity: 0.7, line: { color: 'black', width: 1 } }
  };

  const scatterThicknessInService = {
    x: dataStats.inServiceScatterThickness.map(d => d.y), // Slab Thickness (X) jittered
    y: dataStats.inServiceScatterThickness.map(d => d.x / 1000000), // Cumulative ESAL (Y)
    mode: 'markers',
    type: 'scatter',
    name: 'In Service',
    text: dataStats.inServiceScatterThickness.map(d => `Slab Thickness: ${d.originalX} inches`),
    hoverinfo: 'text+y',
    marker: { color: '#2ca25f', size: 10, opacity: 0.7, line: { color: 'black', width: 1 } }
  };

  const allScatterThicknesses = Array.from(new Set([
    ...dataStats.reconScatterThickness.map(d => d.originalX),
    ...dataStats.inServiceScatterThickness.map(d => d.originalX)
  ])).sort((a, b) => a - b);

  const scatterThicknessLayout = {
    xaxis: {
      title: { text: '<b>Slab Thickness (inches)</b>', font: { size: 28 } },
      tickmode: 'linear', dtick: 1,
      tickfont: { size: 22 }, tickangle: 0, ticks: 'inside', rangemode: 'normal',
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


  const uniqueThicknessGroups = {};
  dataStats.reconScatterThickness.forEach(d => {
    if (!uniqueThicknessGroups[d.originalX]) uniqueThicknessGroups[d.originalX] = [];
    uniqueThicknessGroups[d.originalX].push(d.x / 1000000);
  });

  const sortedUniqueThicknesses = Object.keys(uniqueThicknessGroups).map(Number).sort((a, b) => a - b);
  const xDataUnique = [];
  const yDataUnique = [];
  const meanXUnique = [];
  const meanYUnique = [];

  sortedUniqueThicknesses.forEach(thickness => {
    const esals = uniqueThicknessGroups[thickness];
    const avg = esals.reduce((sum, val) => sum + val, 0) / esals.length;
    meanXUnique.push(thickness);
    meanYUnique.push(avg);

    esals.forEach(e => {
      xDataUnique.push(thickness);
      yDataUnique.push(e);
    });
  });

  const chartDataUnique = [
    {
      x: xDataUnique,
      y: yDataUnique,
      type: 'box',
      name: 'Cumulative ESAL',
      boxpoints: 'all',
      jitter: 0.3,
      pointpos: -1.8,
      marker: { color: '#ff4d4d', size: 5, opacity: 0.8, line: { color: 'black', width: 1 } },
      line: { color: 'black', width: 1.5 },
      fillcolor: 'lightgrey',
      showlegend: false
    },
    {
      x: meanXUnique,
      y: meanYUnique,
      mode: 'markers',
      type: 'scatter',
      name: 'Mean',
      marker: { symbol: 'x', color: 'black', size: 8, line: { width: 1.5, color: 'black' } },
      showlegend: false
    }
  ];

  const layoutUnique = {
    xaxis: {
      title: { text: '<b>Slab Thickness (inches)</b>', font: { size: 28 } },
      tickmode: 'linear', dtick: 1,
      tickfont: { size: 22 }, tickangle: 0, ticks: 'inside', rangemode: 'normal',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Cumulative ESAL (millions)</b>', font: { size: 28 } },
      tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
      rangemode: 'tozero'
    },
    margin: { t: 40, r: 20, l: 100, b: 100 },
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' },
    showlegend: false,
    hovermode: 'closest'
  };

  // Scatter Data (ESAL vs Base Thickness)
  const scatterBaseRecon = {
    x: dataStats.reconScatterBase.map(d => d.y), // Base Thickness (X) jittered
    y: dataStats.reconScatterBase.map(d => d.x / 1000000), // Cumulative ESAL (Y)
    mode: 'markers',
    type: 'scatter',
    name: 'Reconstructed',
    text: dataStats.reconScatterBase.map(d => `Base Thickness: ${d.originalX} inches`),
    hoverinfo: 'text+y',
    marker: { color: '#ff4d4d', size: 10, opacity: 0.7, line: { color: 'black', width: 1 } }
  };

  const scatterBaseInService = {
    x: dataStats.inServiceScatterBase.map(d => d.y), // Base Thickness (X) jittered
    y: dataStats.inServiceScatterBase.map(d => d.x / 1000000), // Cumulative ESAL (Y)
    mode: 'markers',
    type: 'scatter',
    name: 'In Service',
    text: dataStats.inServiceScatterBase.map(d => `Base Thickness: ${d.originalX} inches`),
    hoverinfo: 'text+y',
    marker: { color: '#2ca25f', size: 10, opacity: 0.7, line: { color: 'black', width: 1 } }
  };

  const allScatterBases = Array.from(new Set([
    ...dataStats.reconScatterBase.map(d => d.originalX),
    ...dataStats.inServiceScatterBase.map(d => d.originalX)
  ])).sort((a, b) => a - b);

  const scatterBaseLayout = {
    xaxis: {
      title: { text: '<b>Base Thickness (inches)</b>', font: { size: 28 } },
      tickvals: allScatterBases,
      ticktext: allScatterBases.map(t => String(t)),
      tickangle: 0,
      tickfont: { size: 22 }, tickangle: 0, ticks: 'inside', rangemode: 'normal',
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

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">ESAL vs Slab/Base Thickness</div>
          <div className="workspace__subtitle">Relationship between cumulative traffic and structural thicknesses.</div>
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
        
        
        {/* ESAL vs Slab Thickness (Box Plot) */}
        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Cumulative ESAL vs. Slab Thickness
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections (Reconstructed Only)</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconScatterThickness.length}</div>
              </div>
            </div>

            <div style={{ height: 400 }}>
              <PlotlyChart
                data={chartDataUnique}
                layout={layoutUnique}
                filename="esal_vs_slabthickness_boxplot"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        {/* ESAL vs Slab Thickness (Scatter Plot) */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Cumulative ESAL vs. Slab Thickness (Scatter Plot)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {dataStats.inServiceMissing && (
              <div style={{ background: '#78350f', color: '#fde68a', padding: '12px 16px', borderRadius: 8, fontSize: 13 }}>
                ⚠️ <strong>In-Service traffic not yet analyzed.</strong> Go to the <em>ESAL</em> tab and click <strong>Re-run Analysis</strong> to populate In-Service data points.
              </div>
            )}
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Plotted</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconScatterThickness.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>In-Service Plotted</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.inServiceScatterThickness.length}</div>
              </div>
            </div>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={[scatterThicknessRecon, scatterThicknessInService]}
                layout={scatterThicknessLayout}
                filename="esal_vs_slabthickness_scatter"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>
        
        {/* ESAL vs Base Thickness (Scatter Plot) */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Cumulative ESAL vs. Base Thickness (Scatter Plot)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {dataStats.inServiceMissing && (
              <div style={{ background: '#78350f', color: '#fde68a', padding: '12px 16px', borderRadius: 8, fontSize: 13 }}>
                ⚠️ <strong>In-Service traffic not yet analyzed.</strong> Go to the <em>ESAL</em> tab and click <strong>Re-run Analysis</strong> to populate In-Service data points.
              </div>
            )}
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Plotted</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconScatterBase.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>In-Service Plotted</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.inServiceScatterBase.length}</div>
              </div>
            </div>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={[scatterBaseRecon, scatterBaseInService]}
                layout={scatterBaseLayout}
                filename="esal_vs_basethickness_scatter"
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
