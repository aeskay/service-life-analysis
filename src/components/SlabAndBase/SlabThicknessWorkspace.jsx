import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';

export default function SlabThicknessWorkspace({ addToast }) {
  const [dataStats, setDataStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadState().then(state => {
      if (!active) return;
      
      const reconData = state?.reconstructed || {};
      const reconVerified = new Set(reconData.verifiedSNs || []);
      const reconRows = reconData.pmisRows || [];

      const inServiceData = state?.inservice || {};
      const inServiceVerified = new Set(inServiceData.verifiedSNs || []);
      const inServiceRows = inServiceData.pmisRows || [];

      // Maps for actual overrides
      const reconYearConstMap = reconData.actualYearConstMap || {};
      const reconEndOfLifeMap = reconData.actualEndOfLifeMap || {};

      let totalCount = 0;
      const thicknessGroups = {};

      const reconFreqMap = {};
      const inServiceFreqMap = {};
      const reconScatter = [];
      const inServiceScatter = [];

      let reconFreqTotal = 0;
      let inServiceFreqTotal = 0;

      let totalUniqueCount = 0;
      const uniqueThicknessGroups = {};
      const processedCSJs = new Set();

      for (const row of reconRows) {
        const id = row['ID'] || row['S/N'];
        const csj = row['S/N'] || id; // Base S/N for deduplication
        if (!reconVerified.has(id)) continue;

        let slabThickness = Number(row['Old Slab Th']) || 0;
        
        const origYC = Number(row['Year Constructed']) || 0;
        const actualEOL = reconEndOfLifeMap[id];
        const eolToUse = actualEOL || row['End of Life'];
        const eolVal = Number(eolToUse);
        
        let serviceLife = Number(row['Service Life']) || 0;
        if (!isNaN(origYC) && !isNaN(eolVal) && origYC > 0) {
            serviceLife = eolVal - origYC;
        }

        if (serviceLife >= 0) {
            // Standard specific grouping (L/R distinct)
            if (!thicknessGroups[slabThickness]) {
              thicknessGroups[slabThickness] = [];
            }
            thicknessGroups[slabThickness].push(serviceLife);
            totalCount++;

            reconFreqMap[slabThickness] = (reconFreqMap[slabThickness] || 0) + 1;
            reconFreqTotal++;

            const jitterX = slabThickness + (Math.random() - 0.5) * 0.4;
            reconScatter.push({ x: slabThickness, jitterX, y: serviceLife });

            // Unique CSJ grouping
            if (!processedCSJs.has(csj)) {
              processedCSJs.add(csj);
              if (!uniqueThicknessGroups[slabThickness]) {
                uniqueThicknessGroups[slabThickness] = [];
              }
              uniqueThicknessGroups[slabThickness].push(serviceLife);
              totalUniqueCount++;
            }
          }
      }

      for (const row of inServiceRows) {
        const id = row['ID'] || row['S/N'];
        if (!inServiceVerified.has(id)) continue;

        let slabThickness = parseFloat(row['Slab Th']);
        if (isNaN(slabThickness) || slabThickness <= 0) {
          slabThickness = parseFloat(row['Old Slab Th']);
        }
        
        let actualServiceLife = Number(row['Service Life']) || 0;
        const actualYC = inServiceData?.actualYearConstMap?.[id];
        const hasOverride = !!actualYC;
        const origYC = parseInt(row['Year Constructed'], 10);
        const activeYC = hasOverride ? parseInt(actualYC, 10) : origYC;
        const currentYear = new Date().getFullYear();
        
        if (!isNaN(activeYC)) {
            actualServiceLife = currentYear - activeYC;
        }

        if (actualServiceLife >= 0 && slabThickness > 0) {
          inServiceFreqMap[slabThickness] = (inServiceFreqMap[slabThickness] || 0) + 1;
          inServiceFreqTotal++;

          if (actualServiceLife > 0) {
              const jitterX = slabThickness + (Math.random() - 0.5) * 0.4;
              inServiceScatter.push({ x: slabThickness, jitterX, y: actualServiceLife });
          }
        }
      }

      setDataStats({
        thicknessGroups,
        totalCount,
        uniqueThicknessGroups,
        totalUniqueCount,
        reconFreqMap,
        inServiceFreqMap,
        reconFreqTotal,
        inServiceFreqTotal,
        reconScatter,
        inServiceScatter
      });
      setIsLoading(false);
    });

    return () => { active = false; };
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="loading-overlay__spinner" style={{ width: 40, height: 40 }} />
          <div style={{ color: 'var(--text-muted)' }}>Calculating slab thickness statistics...</div>
        </div>
      </div>
    );
  }

  if (!dataStats) return null;

  // Prepare data for Plotly boxplot
  const sortedThicknesses = Object.keys(dataStats.thicknessGroups)
    .map(Number)
    .sort((a, b) => a - b);

  const xData = [];
  const yData = [];
  const meanX = [];
  const meanY = [];

  sortedThicknesses.forEach(thickness => {
    const lives = dataStats.thicknessGroups[thickness];
    const avg = lives.reduce((sum, val) => sum + val, 0) / lives.length;
    meanX.push(`<b>${thickness}</b>`);
    meanY.push(avg);

    lives.forEach(life => {
      xData.push(`<b>${thickness}</b>`); // X-axis label
      yData.push(life);
    });
  });

  const chartData = [
    {
      x: xData,
      y: yData,
      type: 'box',
      name: 'Service Life',
      boxpoints: 'all',
      jitter: 0.3,
      pointpos: -1.8,
      marker: { color: '#ff4d4d', size: 5, opacity: 0.8, line: { color: 'black', width: 1 } },
      line: { color: 'black', width: 1.5 },
      fillcolor: 'lightgrey',
      showlegend: false
    },
    {
      x: meanX,
      y: meanY,
      mode: 'markers',
      type: 'scatter',
      name: 'Mean',
      marker: { symbol: 'x', color: 'black', size: 8, line: { width: 1.5, color: 'black' } },
      showlegend: false
    }
  ];

  // Unique CSJ Chart Data
  const sortedUniqueThicknesses = Object.keys(dataStats.uniqueThicknessGroups)
    .map(Number)
    .sort((a, b) => a - b);

  const xDataUnique = [];
  const yDataUnique = [];
  const meanXUnique = [];
  const meanYUnique = [];

  sortedUniqueThicknesses.forEach(thickness => {
    const lives = dataStats.uniqueThicknessGroups[thickness];
    const avg = lives.reduce((sum, val) => sum + val, 0) / lives.length;
    meanXUnique.push(`<b>${thickness}</b>`);
    meanYUnique.push(avg);

    lives.forEach(life => {
      xDataUnique.push(`<b>${thickness}</b>`);
      yDataUnique.push(life);
    });
  });

  const chartDataUnique = [
    {
      x: xDataUnique,
      y: yDataUnique,
      type: 'box',
      name: 'Service Life',
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

  // Frequency Data (Stacked)
  const allFreqThicknesses = Array.from(new Set([
    ...Object.keys(dataStats.reconFreqMap),
    ...Object.keys(dataStats.inServiceFreqMap)
  ])).map(Number).sort((a, b) => a - b);

  const freqX = allFreqThicknesses.map(t => `<b>${t}</b>`);
  const reconFreqY = allFreqThicknesses.map(t => dataStats.reconFreqMap[t] || 0);
  const inServiceFreqY = allFreqThicknesses.map(t => dataStats.inServiceFreqMap[t] || 0);

  // Frequency Data (Reconstructed only)
  const reconOnlyThicknesses = Object.keys(dataStats.reconFreqMap).map(Number).sort((a, b) => a - b);
  const reconOnlyFreqX = reconOnlyThicknesses.map(t => `<b>${t}</b>`);
  const reconOnlyFreqY = reconOnlyThicknesses.map(t => dataStats.reconFreqMap[t] || 0);

  const freqChartRecon = [
    {
      x: reconOnlyFreqX,
      y: reconOnlyFreqY,
      type: 'bar',
      name: 'Reconstructed',
      marker: { color: '#ffa1a1', line: { color: 'black', width: 1.5 } },
      text: reconOnlyFreqY.map(v => v > 0 ? String(v) : ''),
      textposition: 'inside',
      insidetextanchor: 'middle',
      textfont: { color: 'black', size: 22, family: 'Arial' }
    }
  ];

  const freqChartStacked = [
    {
      x: freqX,
      y: reconFreqY,
      type: 'bar',
      name: 'Reconstructed',
      marker: { color: '#ffa1a1', line: { color: 'black', width: 1.5 } },
      text: reconFreqY.map(v => v > 0 ? String(v) : ''),
      textposition: 'inside',
      insidetextanchor: 'middle',
      textfont: { color: 'black', size: 22, family: 'Arial' }
    },
    {
      x: freqX,
      y: inServiceFreqY,
      type: 'bar',
      name: 'In Service',
      marker: { color: '#a1ffcb', line: { color: 'black', width: 1.5 } },
      text: inServiceFreqY.map(v => v > 0 ? String(v) : ''),
      textposition: 'inside',
      insidetextanchor: 'middle',
      textfont: { color: 'black', size: 22, family: 'Arial' }
    }
  ];

  const combinedMaxY = Math.max(...allFreqThicknesses.map(t => (dataStats.reconFreqMap[t] || 0) + (dataStats.inServiceFreqMap[t] || 0)));
  const freqTopY = combinedMaxY > 0 ? Math.ceil(combinedMaxY * 1.2) : 10;
  
  const reconMaxY = Math.max(...reconOnlyFreqY, 0);
  const reconTopY = reconMaxY > 0 ? Math.ceil(reconMaxY * 1.2) : 10;

  const freqLayoutRecon = {
    xaxis: {
      title: { text: '<b>Slab Thickness (inches)</b>', font: { size: 28 } },
      tickmode: 'linear', dtick: 1, tickfont: { size: 22 }, ticks: 'inside',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Number of Pavement Sections</b>', font: { size: 28 } },
      range: [0, reconTopY], tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    margin: { t: 40, r: 20, l: 100, b: 100 },
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' },
    showlegend: false
  };

  const freqLayoutStacked = {
    ...freqLayoutRecon,
    yaxis: {
      ...freqLayoutRecon.yaxis,
      range: [0, freqTopY]
    },
    barmode: 'stack',
    showlegend: true,
    legend: {
      x: 1, xanchor: 'right', y: 1,
      bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1
    }
  };

  const scatterChartRecon = {
    x: dataStats.reconScatter.map(d => d.jitterX),
    y: dataStats.reconScatter.map(d => d.y),
    mode: 'markers',
    type: 'scatter',
    name: 'Reconstructed',
    marker: { color: '#ff4d4d', size: 10, opacity: 0.7, line: { color: 'black', width: 1 } }
  };

  const scatterChartInService = {
    x: dataStats.inServiceScatter.map(d => d.jitterX),
    y: dataStats.inServiceScatter.map(d => d.y),
    mode: 'markers',
    type: 'scatter',
    name: 'In Service',
    marker: { color: '#2ca25f', size: 10, opacity: 0.7, line: { color: 'black', width: 1 } }
  };

  const allScatterThicknesses = Array.from(new Set([
    ...dataStats.reconScatter.map(d => d.x),
    ...dataStats.inServiceScatter.map(d => d.x)
  ])).sort((a, b) => a - b);

  const scatterLayout = {
    xaxis: {
      title: { text: '<b>Slab Thickness (Inches)</b>', font: { size: 28 } },
      tickvals: allScatterThicknesses,
      ticktext: allScatterThicknesses.map(t => String(t)),
      tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Service Life (Years)</b>', font: { size: 28 } },
      range: [10, 70], tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    legend: {
      font: { size: 28 },
      x: 1, xanchor: 'right', y: 1,
      bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1
    },
    margin: { t: 40, r: 20, l: 100, b: 100 },
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' },
    showlegend: true
  };

  const layout = {
    xaxis: {
      title: { text: '<b>Slab Thickness (inches)</b>', font: { size: 28 } },
      tickfont: { size: 22 },
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Service Life (Years)</b>', font: { size: 28 } },
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

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Slab Thickness Analysis</div>
          <div className="workspace__subtitle">Effect of slab thickness on service life (Reconstructed sections only).</div>
        </div>
        <div className="workspace__toolbar-right">
          <button className="btn btn--secondary btn--sm" onClick={() => setRefreshTrigger(t => t + 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Update Analysis
          </button>
        </div>
      </div>

      <div className="workspace__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
        
        {/* Frequency - Reconstructed Only */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Slab Frequency (Reconstructed Only)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconFreqTotal}</div>
              </div>
            </div>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={freqChartRecon}
                layout={freqLayoutRecon}
                filename="slab_frequency_reconstructed"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        {/* Frequency - Stacked (All In Service) */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Slab Frequency (Including All In-Service)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconFreqTotal}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>In-Service Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.inServiceFreqTotal}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Sections Analyzed</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconFreqTotal + dataStats.inServiceFreqTotal}</div>
              </div>
            </div>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={freqChartStacked}
                layout={freqLayoutStacked}
                filename="slab_frequency_stacked"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Service Life vs. Slab Thickness
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.totalCount}</div>
              </div>
            </div>

            <div style={{ height: 400 }}>
              <PlotlyChart
                data={chartData}
                layout={layout}
                filename="slab_thickness_analysis"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Service Life vs. Slab Thickness (Unique CSJ)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Unique Analyzed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.totalUniqueCount}</div>
              </div>
            </div>

            <div style={{ height: 400 }}>
              <PlotlyChart
                data={chartDataUnique}
                layout={layout}
                filename="slab_thickness_unique_analysis"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Service Life vs. Slab Thickness (Scatter Plot)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconScatter.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>In-Service Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.inServiceScatter.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Plotted</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconScatter.length + dataStats.inServiceScatter.length}</div>
              </div>
            </div>

            <div style={{ height: 400 }}>
              <PlotlyChart
                data={[scatterChartRecon, scatterChartInService]}
                layout={scatterLayout}
                filename="slab_thickness_scatter"
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
