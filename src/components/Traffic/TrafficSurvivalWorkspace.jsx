import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';

export default function TrafficSurvivalWorkspace({ addToast }) {
  const [data, setData] = useState(window.trafficSurvivalCache || null);
  const [slabData, setSlabData] = useState(window.trafficSurvivalSlabCache || null);
  const [isLoading, setIsLoading] = useState(!window.trafficSurvivalCache || !window.trafficSurvivalSlabCache);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (window.trafficSurvivalCache && window.trafficSurvivalSlabCache && refreshTrigger === 0) {
      return;
    }

    window.trafficSurvivalCache = null;
    window.trafficSurvivalSlabCache = null;
    setIsLoading(true);

    runJSFallback();

    function runJSFallback() {
      import('../../utils/stateStore').then(({ loadState }) => loadState()).then(state => {
        import('../../utils/survivalEngineJS').then(({ calculateKaplanMeier }) => {
          const reconTraffic = state.trafficAnalysis?.reconstructed?.results || [];
          const inServiceTraffic = state.trafficAnalysis?.inservice?.results || [];

          const reconVerified = new Set(state.reconstructed?.verifiedSNs || []);
          const inServiceVerified = new Set(state.inservice?.verifiedSNs || []);

          const reconData = reconTraffic.filter(r => reconVerified.has(String(r.ID || r['S/N'])))
            .map(r => ({ Age: Number(r.CUMULATIVE_ESAL || 0) / 1000000.0, Event: 1 }))
            .filter(d => d.Age > 0);

          const inServiceData = inServiceTraffic.filter(r => inServiceVerified.has(String(r.ID || r['S/N'])))
            .map(r => ({ Age: Number(r.CUMULATIVE_ESAL || 0) / 1000000.0, Event: 0 }))
            .filter(d => d.Age > 0);

          const reconKm = calculateKaplanMeier(reconData);
          const inServiceKm = calculateKaplanMeier(inServiceData);

          const res = {
            recon_timeline: reconKm.timeline,
            recon_survival: reconKm.survival,
            recon_ci_lower: reconKm.ci_lower,
            recon_ci_upper: reconKm.ci_upper,
            recon_median: reconKm.median,
            insvc_timeline: inServiceKm.timeline,
            insvc_survival: inServiceKm.survival,
            insvc_ci_lower: inServiceKm.ci_lower,
            insvc_ci_upper: inServiceKm.ci_upper,
            insvc_median: inServiceKm.median,
            total_recon: reconData.length,
            total_insvc: inServiceData.length
          };

          window.trafficSurvivalCache = res;
          window.trafficSurvivalSlabCache = res;
          setData(res);
          setSlabData(res);
          setError(null);
          setIsLoading(false);
        });
      }).catch(err => {
        setError(err.message || String(err));
        setIsLoading(false);
      });
    }
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="workspace" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="loading-overlay__spinner" style={{ width: 40, height: 40 }} />
          <div style={{ color: 'var(--text-muted)' }}>Running Kaplan-Meier survival analysis for Traffic...</div>
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

  const topY = 1.05;

  const chartData = [
    {
      x: data.timeline,
      y: data.survival,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Kaplan-Meier (Empirical)',
      line: { shape: 'hv', color: 'black', width: 3.5 },
      marker: { color: 'black', size: 6 }
    },
    {
      x: [0, Math.max(...data.timeline)],
      y: [0.5, 0.5],
      type: 'scatter',
      mode: 'lines',
      name: 'Median (50%)',
      line: { color: 'blue', width: 3.5, dash: 'dot' }
    }
  ];

  const maxX = Math.max(...data.timeline);
  const layout = {
    xaxis: {
      title: { text: '<b>Cumulative ESAL (Millions)</b>', font: { size: 28 } },
      tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 2, tickwidth: 2, linecolor: 'black', mirror: true,
      zerolinecolor: 'rgba(0,0,0,0.15)',
      
      range: [0, maxX * 1.05]
    },
    yaxis: {
      title: { text: '<b>Survival Probability (%)</b>', font: { size: 28 } },
      range: [0, topY], tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 2, tickwidth: 2, linecolor: 'black', mirror: true,
      tickvals: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      ticktext: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
      zerolinecolor: 'rgba(0,0,0,0.15)'
    },
    legend: {
      x: 1, xanchor: 'right', y: 1,
      bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1
    },
    margin: { t: 40, r: 20, l: 100, b: 100 },
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' },
    hovermode: 'x unified',
  };

  const hasRecon = data.r_timeline && data.r_timeline.length > 0;
  const maxXR = hasRecon ? Math.max(...data.r_timeline) : 0;
  const chartDataRecon = hasRecon ? [
    {
      x: data.r_timeline,
      y: data.r_survival,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Kaplan-Meier (Reconstructed)',
      line: { shape: 'hv', color: '#e34a33', width: 3.5 },
      marker: { color: '#e34a33', size: 6 }
    },
    {
      x: [0, maxXR],
      y: [0.5, 0.5],
      type: 'scatter',
      mode: 'lines',
      name: 'Median (50%)',
      line: { color: 'blue', width: 2, dash: 'dot' }
    }
  ] : [];

  const layoutRecon = {
    ...layout,
    xaxis: { ...layout.xaxis, range: [0, maxXR * 1.05] }
  };

  let chartDataSlab = [];
  let maxX_slab = 0;
  let totalSections_slab = 0;
  const annotationsSlab = [];
  let thicknessKeys = [];

  if (slabData) {
    thicknessKeys = Object.keys(slabData).sort((a, b) => parseFloat(a) - parseFloat(b));
    const colors = [
      '#1c03fc', '#fc7f03', '#02c934', '#5202c9', '#027dc9',
      '#c90202', '#121212', '#805003', '#037980'
    ];
    const mid_idx = Math.ceil(thicknessKeys.length / 2);

    thicknessKeys.forEach((thKey, idx) => {
      const group = slabData[thKey];
      const th = parseFloat(thKey);
      if (!group || !group.timeline || group.timeline.length === 0) return;

      totalSections_slab += group.count;

      const localMaxX = Math.max(...group.timeline);
      if (localMaxX > maxX_slab) maxX_slab = localMaxX;

      const lineColor = colors[idx % colors.length];
      const targetLegend = idx < mid_idx ? 'legend' : 'legend2';

      chartDataSlab.push({
        x: group.timeline,
        y: group.survival,
        type: 'scatter',
        mode: 'lines',
        name: `${th % 1 === 0 ? th.toFixed(0) : th}`,
        line: { shape: 'hv', width: 3.5, color: lineColor },
        legend: targetLegend
      });

      const median = group.median;
      if (th <= 10 && median && isFinite(median)) {
        chartDataSlab.push({
          x: [0, median], y: [0.5, 0.5],
          type: 'scatter', mode: 'lines',
          line: { color: lineColor, dash: 'dot' },
          showlegend: false, hoverinfo: 'skip'
        });
        chartDataSlab.push({
          x: [median, median], y: [0, 0.5],
          type: 'scatter', mode: 'lines',
          line: { color: lineColor, dash: 'dot' },
          showlegend: false, hoverinfo: 'skip'
        });
        annotationsSlab.push({
          x: median + 0.5, y: 0.51,
          text: `${median.toFixed(1)} M`,
          showarrow: false, xanchor: 'left', yanchor: 'bottom',
          font: { color: lineColor, size: 28, family: 'Arial Black' }
        });
      }
    });
  }

  const layoutSlab = {
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
      title: { text: '<b>Cumulative ESAL (Millions)</b>', font: { size: 28 } },
      tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 2, tickwidth: 2, linecolor: 'black', mirror: true,
      zerolinecolor: 'rgba(0,0,0,0.15)',
      dtick: 5,
      range: [0, maxX_slab * 1.05]
    },
    legend: {
      title: { text: '<b>Thickness (in)</b>', font: { size: 22 } },
      font: { size: 20 },
      yanchor: "top",
      y: 0.42,
      xanchor: "left",
      x: 0.02,
      bgcolor: "rgba(0,0,0,0)",
    },
    legend2: {
      title: { text: '<br>', font: { size: 22 } },
      font: { size: 20 },
      yanchor: "top",
      y: 0.42,
      xanchor: "left",
      x: 0.12,
      bgcolor: "rgba(0,0,0,0)",
    },
    shapes: [
      {
        type: "rect",
        xref: "paper", yref: "paper",
        x0: 0.01, y0: 0.44, x1: 0.25, y1: 0.02,
        fillcolor: "rgba(255, 255, 255, 0.95)",
        line: { color: "lightgray", width: 1 },
        layer: "above"
      }
    ],
    annotations: annotationsSlab,
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
          <div className="workspace__title">Traffic Survival (Kaplan-Meier)</div>
          <div className="workspace__subtitle">Survival probability over cumulative ESAL traffic loading.</div>
        </div>
        <div className="workspace__toolbar-right">
          <button className="button button--secondary" onClick={() => window.location.reload()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            Update Analysis
          </button>
        </div>
      </div>

      <div className="workspace__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
        
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Kaplan-Meier Survival Curve
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{data.total_recon + data.total_insvc}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Median Service Life (KM)</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{data.median ? `${data.median.toFixed(2)}` : 'Not Reached'}</div>
              </div>
            </div>

            <div style={{ height: 400 }}>
              <PlotlyChart
                data={chartData}
                layout={layout}
                filename="survival_analysis"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        {hasRecon && (
          <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
            <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
              Reconstructed Only (No Right-Censoring)
            </summary>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{data.total_recon}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Median Service Life (KM)</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{data.r_median ? `${data.r_median.toFixed(2)}` : 'Not Reached'}</div>
                </div>
              </div>
              <div style={{ height: 400 }}>
                <PlotlyChart
                  data={chartDataRecon}
                  layout={layoutRecon}
                  filename="survival_analysis_recon"
                  config={{ responsive: true, displayModeBar: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </details>
        )}

        {slabData && thicknessKeys.length > 0 && (
          <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
            <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
              Slab Thickness Survival Curves (vs Cumulative ESAL)
            </summary>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{totalSections_slab}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Thickness Groups</div>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{thicknessKeys.length}</div>
                </div>
              </div>

              <div style={{ height: 600 }}>
                <PlotlyChart
                  data={chartDataSlab}
                  layout={layoutSlab}
                  filename="survival_analysis_traffic_slab_thickness"
                  config={{ responsive: true, displayModeBar: true }}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
            </div>
          </details>
        )}

      </div>
    </div>
  );
}
