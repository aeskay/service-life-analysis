import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';

const calculateNormality = (arr) => {
  if (!arr || arr.length < 4) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const x of arr) {
    const diff = x - mean;
    m2 += Math.pow(diff, 2);
    m3 += Math.pow(diff, 3);
    m4 += Math.pow(diff, 4);
  }
  m2 /= arr.length; m3 /= arr.length; m4 /= arr.length;
  if (m2 === 0) return null;
  
  const skewness = m3 / Math.pow(m2, 1.5);
  const kurtosis = m4 / Math.pow(m2, 2);
  const n = arr.length;
  const jb = (n / 6) * (Math.pow(skewness, 2) + 0.25 * Math.pow(kurtosis - 3, 2));
  const pValue = Math.exp(-jb / 2);
  const isNormal = pValue > 0.05;
  
  return { skewness, kurtosis, jb, pValue, isNormal };
};

export default function TrafficDistributionWorkspace() {
  const [dataStats, setDataStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadState().then(state => {
      if (!active) return;
      
      const reconTraffic = state.trafficAnalysis?.reconstructed?.results || [];
      const inServiceTraffic = state.trafficAnalysis?.inservice?.results || [];

      let reconCount = 0;
      let inServiceCount = 0;

      const reconEsals = [];
      const inServiceEsals = [];

      const reconVerified = new Set(state.reconstructed?.verifiedSNs || []);
      const inServiceVerified = new Set(state.inservice?.verifiedSNs || []);

      for (const row of reconTraffic) {
        const id = row['ID'] || row['S/N'];
        if (!reconVerified.has(id)) continue;

        const esal = Number(row['CUMULATIVE_ESAL']);
        if (isNaN(esal) || esal <= 0) continue;

        reconCount++;
        reconEsals.push(esal);
      }

      for (const row of inServiceTraffic) {
        const id = row['ID'] || row['S/N'];
        if (!inServiceVerified.has(id)) continue;

        const esal = Number(row['CUMULATIVE_ESAL']);
        if (isNaN(esal) || esal <= 0) continue;

        inServiceCount++;
        inServiceEsals.push(esal);
      }

      setDataStats({
        reconCount,
        inServiceCount,
        reconEsals,
        inServiceEsals,
        reconNormality: calculateNormality(reconEsals),
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

  // Histogram Data
  const freqChartRecon = [
    {
      x: dataStats.reconEsals.map(e => e / 1000000),
      type: 'histogram',
      name: 'Reconstructed',
      marker: { color: '#ffa1a1', line: { color: 'black', width: 1 } },
      texttemplate: '%{y}',
      textposition: 'outside',
      textfont: { size: 22 },
      opacity: 0.8
    }
  ];

  const freqChartStacked = [
    {
      x: dataStats.reconEsals.map(e => e / 1000000),
      type: 'histogram',
      name: 'Reconstructed',
      texttemplate: '%{y}',
      textposition: 'auto',
      textfont: { size: 22 },
      marker: { color: '#ffa1a1', line: { color: 'black', width: 1 } }
    },
    {
      x: dataStats.inServiceEsals.map(e => e / 1000000),
      type: 'histogram',
      name: 'In Service',
      texttemplate: '%{y}',
      textposition: 'auto',
      textfont: { size: 22 },
      marker: { color: '#a1ffcb', line: { color: 'black', width: 1 } }
    }
  ];

  const freqLayoutRecon = {
    xaxis: {
      title: { text: '<b>Cumulative ESAL (millions)</b>', font: { size: 28 } },
      tickmode: 'linear', dtick: 10,
      tickfont: { size: 22 }, tickangle: 0, ticks: 'inside',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Number of Pavement Sections</b>', font: { size: 28 } },
      tickfont: { size: 22 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
      range: [0, 18],
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
      range: undefined
    },
    barmode: 'stack',
    showlegend: true,
    legend: {
      font: { size: 22 },
      x: 1, xanchor: 'right', y: 1,
      bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1
    }
  };

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">ESAL Distribution</div>
          <div className="workspace__subtitle">Distribution of Cumulative ESALs across sections.</div>
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
        
        {/* Frequency - Reconstructed Only */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Cumulative ESAL Frequency (Reconstructed Only)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconCount}</div>
              </div>
              {dataStats.reconNormality && (
                <>
                  <div style={{ width: 1, backgroundColor: 'var(--border-subtle)', margin: '0 8px' }} />
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Distribution (Jarque-Bera)</div>
                    <div style={{ fontSize: 18, fontWeight: 500, color: dataStats.reconNormality.isNormal ? 'var(--success)' : 'var(--text-primary)' }}>
                      {dataStats.reconNormality.isNormal ? 'Approximately Normal' : 'Not Normal'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Skewness</div>
                    <div style={{ fontSize: 18, fontWeight: 500 }}>{dataStats.reconNormality.skewness?.toFixed(3)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kurtosis</div>
                    <div style={{ fontSize: 18, fontWeight: 500 }}>{dataStats.reconNormality.kurtosis?.toFixed(3)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>p-value</div>
                    <div style={{ fontSize: 18, fontWeight: 500 }}>{dataStats.reconNormality.pValue < 0.001 ? '<0.001' : dataStats.reconNormality.pValue?.toFixed(3)}</div>
                  </div>
                </>
              )}
            </div>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={freqChartRecon}
                layout={freqLayoutRecon}
                filename="esal_frequency_reconstructed"
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
            Cumulative ESAL Frequency (Including All In-Service)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {dataStats.inServiceMissing && (
              <div style={{ background: '#78350f', color: '#fde68a', padding: '12px 16px', borderRadius: 8, fontSize: 13 }}>
                ⚠️ <strong>In-Service traffic not yet analyzed.</strong> Go to the <em>ESAL</em> tab and click <strong>Re-run Analysis</strong> to generate both Reconstructed and In-Service data.
              </div>
            )}
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconCount}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>In-Service Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.inServiceCount}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Sections Analyzed</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconCount + dataStats.inServiceCount}</div>
              </div>
            </div>
            <div style={{ height: 400 }}>
              <PlotlyChart
                data={freqChartStacked}
                layout={freqLayoutStacked}
                filename="esal_frequency_stacked"
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
