import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';

export default function SurvivalBaseThicknessWorkspace({ addToast }) {
  const [data, setData] = useState(window.survivalBaseDataCache || null);
  const [isLoading, setIsLoading] = useState(!window.survivalBaseDataCache);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    // Always run fresh — never serve stale data
    window.survivalBaseDataCache = null;
    setIsLoading(true);
    window.electronAPI.runSurvivalAnalysisBase()
      .then(res => {
        if (res.error) {
          setError(res.error);
        } else {
          window.survivalBaseDataCache = res;
          setData(res);
          setError(null);
        }
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="loading-overlay__spinner" style={{ width: 40, height: 40 }} />
          <div style={{ color: 'var(--text-muted)' }}>Running Kaplan-Meier survival analysis by Base Thickness...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspace" style={{ padding: 'var(--sp-8)' }}>
        <div style={{ background: '#7f1d1d', color: '#fecaca', padding: 'var(--sp-4)', borderRadius: 8 }}>
          <strong>Error running analysis:</strong>
          <pre style={{
            marginTop: 8,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 300,
            overflowY: 'auto',
            background: '#450a0a',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 12,
            color: '#fca5a5',
          }}>{error}</pre>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // data is a dict: { "8.0": { timeline: [], survival: [], median: null, count: 10 }, "9.0": ... }
  // Sort by numeric value but preserve the original string key Python used (e.g. "8.0", "13.25")
  const thicknessKeys = Object.keys(data).sort((a, b) => parseFloat(a) - parseFloat(b));

  // Custom colors for thickness groups
  const colors = [
    '#d10000', '#fc7f03', '#02c934', '#5202c9', '#027dc9',
    '#c90202', '#121212', '#805003', '#037980'
  ];

  const chartData = [];
  let maxX = 0;
  let totalSections = 0;
  let renderedMedians = 0;
  const annotations = [];

  thicknessKeys.forEach((thKey, idx) => {
    const group = data[thKey];          // use the original Python key directly
    const th = parseFloat(thKey);       // numeric value for comparisons
    if (!group || !group.timeline || group.timeline.length === 0) return;

    totalSections += group.count;

    const localMaxX = Math.max(...group.timeline);
    if (localMaxX > maxX) maxX = localMaxX;

    const lineColor = colors[idx % colors.length];

    chartData.push({
      x: group.timeline,
      y: group.survival,
      type: 'scatter',
      mode: 'lines',
      name: `${th % 1 === 0 ? th.toFixed(0) : th}`,
      line: { shape: 'hv', width: 3.5, color: lineColor },
      legend: 'legend'
    });

    const median = group.median;
    if (th <= 10 && median && isFinite(median)) {
      chartData.push({
        x: [0, median], y: [0.5, 0.5],
        type: 'scatter', mode: 'lines',
        line: { color: lineColor, dash: 'dot' },
        showlegend: false, hoverinfo: 'skip'
      });
      chartData.push({
        x: [median, median], y: [0, 0.5],
        type: 'scatter', mode: 'lines',
        line: { color: lineColor, dash: 'dot' },
        showlegend: false, hoverinfo: 'skip'
      });
      
      const isEven = renderedMedians % 2 === 0;
      annotations.push({
        x: median + 0.5, 
        y: 0.5 + (isEven ? 0.005 : -0.005),
        text: `${median.toFixed(1)} yrs`,
        showarrow: false, xanchor: 'left', yanchor: isEven ? 'bottom' : 'top',
        font: { color: lineColor, size: 28, family: 'Arial Black' },
        bgcolor: 'rgba(255,255,255,0.7)'
      });
      renderedMedians++;
    }
  });


  const layout = {
    yaxis: {
      title: { text: '<b>Survival Probability (%)</b>', font: { size: 28 } },
      range: [0, 1.05], tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 2, tickwidth: 2, linecolor: 'black', mirror: true,
      tickvals: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      ticktext: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
      zerolinecolor: 'rgba(0,0,0,0.15)'
    },
    xaxis: {
      title: { text: '<b>Age (Years)</b>', font: { size: 28 } },
      tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 2, tickwidth: 2, linecolor: 'black', mirror: true,
      zerolinecolor: 'rgba(0,0,0,0.15)',
      dtick: 5,
      range: [0, maxX * 1.05]
    },
    // Configure the single legend
    legend: {
      title: { text: '<b>Thickness (in)</b>', font: { size: 22 } },
      font: { size: 20 },
      yanchor: "bottom",
      y: 0.05,
      xanchor: "left",
      x: 0.02,
      bgcolor: "rgba(255, 255, 255, 0.95)",
      bordercolor: "lightgray",
      borderwidth: 1
    },
    annotations: annotations,
    plot_bgcolor: 'white',
    paper_bgcolor: 'white',
    margin: { l: 100, r: 40, t: 40, b: 100 },
    font: { family: 'Arial', color: 'black' },
    hovermode: 'x unified'
  };

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Survival Analysis (Base Thickness)</div>
          <div className="workspace__subtitle">Kaplan-Meier survival curves grouped by Base Thickness.</div>
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
        
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Base Thickness Survival Curves
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{totalSections}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Thickness Groups</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{thicknessKeys.length}</div>
              </div>
            </div>

            <div style={{ height: 600 }}>
              <PlotlyChart
                data={chartData}
                layout={layout}
                filename="survival_analysis_base_thickness"
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
