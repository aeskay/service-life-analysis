import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';

export default function SurvivalWorkspace({ addToast }) {
  const [data, setData] = useState(window.survivalDataCache || null);
  const [isLoading, setIsLoading] = useState(!window.survivalDataCache);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showWeibull, setShowWeibull] = useState(false);

  useEffect(() => {
    if (window.survivalDataCache && refreshTrigger === 0) {
      return;
    }
    window.survivalDataCache = null;
    setIsLoading(true);

    if (window.electronAPI?.runSurvivalAnalysis) {
      window.electronAPI.runSurvivalAnalysis()
        .then(res => {
          if (res.error) {
            runJSFallback();
          } else {
            window.survivalDataCache = res;
            setData(res);
            setError(null);
            setIsLoading(false);
          }
        })
        .catch(() => runJSFallback());
    } else {
      runJSFallback();
    }

    function runJSFallback() {
      import('../../utils/stateStore').then(({ loadState }) => {
        return loadState();
      }).then(state => {
        import('../../utils/survivalEngineJS').then(({ runServiceLifeSurvivalJS }) => {
          const res = runServiceLifeSurvivalJS(state);
          window.survivalDataCache = res;
          setData(res);
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
          <div style={{ color: 'var(--text-muted)' }}>Running Kaplan-Meier survival analysis...</div>
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

  if (showWeibull && data.w_timeline && data.w_timeline.length > 0) {
    chartData.push({
      x: data.w_timeline,
      y: data.w_survival,
      type: 'scatter',
      mode: 'lines',
      name: 'Weibull Fit',
      line: { color: 'red', width: 3.5, dash: 'dash' }
    });
  }

  const maxX = (showWeibull && data.w_timeline && data.w_timeline.length > 0)
    ? Math.max(...data.w_timeline)
    : Math.max(...data.timeline);
  const weibullAnnotations = [];
  if (showWeibull && data.w_rho && data.w_lambda) {
    weibullAnnotations.push({
      x: 0.62,
      y: 0.78,
      xref: 'paper',
      yref: 'paper',
      text: `Shape (ρ): ${data.w_rho.toFixed(2)}<br>Scale (λ): ${data.w_lambda.toFixed(2)}`,
      showarrow: false,
      font: { size: 18, color: 'black' },
      bgcolor: 'rgba(255,255,255,0.8)',
      bordercolor: 'rgba(0,0,0,0.1)',
      borderwidth: 1,
      borderpad: 4,
      xanchor: 'right',
      yanchor: 'top'
    });
  }

  const layout = {
    annotations: weibullAnnotations,
    xaxis: {
      title: { text: '<b>Age (Years)</b>', font: { size: 28 } },
      tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 2, tickwidth: 2, linecolor: 'black', mirror: true,
      zerolinecolor: 'rgba(0,0,0,0.15)',
      dtick: 5,
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
      bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1,
      font: { size: 22 }
    },
    margin: { t: 40, r: 20, l: 100, b: 100 },
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' },
    hovermode: 'x unified',
  };

  const hasRecon = data.r_timeline && data.r_timeline.length > 0;
  const maxXR = hasRecon
    ? ((showWeibull && data.w_r_timeline && data.w_r_timeline.length > 0) ? Math.max(...data.w_r_timeline) : Math.max(...data.r_timeline))
    : 0;
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
      line: { color: 'blue', width: 3.5, dash: 'dot' }
    }
  ] : [];

  if (hasRecon && showWeibull && data.w_r_timeline && data.w_r_timeline.length > 0) {
    chartDataRecon.push({
      x: data.w_r_timeline,
      y: data.w_r_survival,
      type: 'scatter',
      mode: 'lines',
      name: 'Weibull Fit',
      line: { color: 'red', width: 3.5, dash: 'dash' }
    });
  }

  const weibullReconAnnotations = [];
  if (showWeibull && data.w_r_rho && data.w_r_lambda) {
    weibullReconAnnotations.push({
      x: 1,
      y: 0.68,
      xref: 'paper',
      yref: 'paper',
      text: `Shape (ρ): ${data.w_r_rho.toFixed(2)}<br>Scale (λ): ${data.w_r_lambda.toFixed(2)}`,
      showarrow: false,
      font: { size: 18, color: 'black' },
      bgcolor: 'rgba(255,255,255,0.8)',
      bordercolor: 'rgba(0,0,0,0.1)',
      borderwidth: 1,
      borderpad: 4,
      xanchor: 'right',
      yanchor: 'top'
    });
  }

  const layoutRecon = {
    ...layout,
    annotations: weibullReconAnnotations,
    xaxis: { ...layout.xaxis, range: [0, maxXR * 1.05] }
  };

  const chartDataSens = [
    {
      x: data.timeline,
      y: data.survival,
      type: 'scatter',
      mode: 'lines',
      name: `Baseline (Median: ${data.median ? data.median.toFixed(0) : 'N/A'}y)`,
      line: { shape: 'hv', color: 'black', width: 3.5 }
    }
  ];

  if (data.sens_10_timeline && data.sens_10_timeline.length > 0) {
    chartDataSens.push({
      x: data.sens_10_timeline,
      y: data.sens_10_survival,
      type: 'scatter',
      mode: 'lines',
      name: `10% Simulated Failure (Median: ${data.sens_10_median ? data.sens_10_median.toFixed(0) : 'N/A'}y)`,
      line: { shape: 'hv', color: 'orange', width: 3.5 }
    });
  }

  if (data.sens_20_timeline && data.sens_20_timeline.length > 0) {
    chartDataSens.push({
      x: data.sens_20_timeline,
      y: data.sens_20_survival,
      type: 'scatter',
      mode: 'lines',
      name: `20% Simulated Failure (Median: ${data.sens_20_median ? data.sens_20_median.toFixed(0) : 'N/A'}y)`,
      line: { shape: 'hv', color: 'green', width: 3.5 }
    });
  }

  chartDataSens.push({
    x: [0, maxX],
    y: [0.5, 0.5],
    type: 'scatter',
    mode: 'lines',
    name: 'Median (50%)',
    line: { color: 'blue', width: 3.5, dash: 'dot' },
    showlegend: false
  });

  const layoutSens = {
    ...layout,
    legend: { ...layout.legend, x: 0.02, y: 0.02, xanchor: 'left', yanchor: 'bottom', font: { size: 18 } }
  };

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Survival Analysis (Service Life)</div>
          <div className="workspace__subtitle">Statistically rigorous service life estimation accounting for right-censored (in-service) pavements.</div>
        </div>
        <div className="workspace__toolbar-right" style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginRight: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={showWeibull} onChange={e => setShowWeibull(e.target.checked)} />
            Include Weibull Fit
          </label>
          <button className="btn btn--secondary btn--sm" onClick={() => setRefreshTrigger(t => t + 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
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

        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Sensitivity Analysis
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Baseline Median</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{data.median ? `${data.median.toFixed(2)}` : 'Not Reached'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>10% Simulated Median</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{data.sens_10_median ? `${data.sens_10_median.toFixed(2)}` : 'Not Reached'}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>20% Simulated Median</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{data.sens_20_median ? `${data.sens_20_median.toFixed(2)}` : 'Not Reached'}</div>
              </div>
            </div>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={chartDataSens}
                layout={layoutSens}
                filename="survival_sensitivity"
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

      </div>
    </div>
  );
}
