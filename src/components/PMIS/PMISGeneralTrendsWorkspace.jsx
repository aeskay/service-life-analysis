import React, { useState, useEffect } from 'react';
import { loadPMISTrends, clearPMISCache, loadPMISDistributions, getPMISTrendsSync, getPMISDistributionsSync } from '../../utils/fileLoader';
import PlotlyChart from '../Verify/PlotlyChart';

const PMISIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M3 15h6" />
    <path d="M3 18h6" />
  </svg>
);

export default function PMISGeneralTrendsWorkspace() {
  const [trends, setTrends] = useState(() => getPMISTrendsSync());
  const [distributions, setDistributions] = useState(() => getPMISDistributionsSync());
  const [loading, setLoading] = useState(!getPMISTrendsSync());
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;

    // Only show loading screen if we don't have trends yet or if user explicitly clicked update
    if (!trends || refreshTrigger > 0) {
      setLoading(true);
    }

    if (refreshTrigger > 0) {
      clearPMISCache();
    }

    Promise.all([loadPMISTrends(), loadPMISDistributions()])
      .then(([trendsData, distsData]) => {
        if (!active) return;
        setTrends(trendsData);
        setDistributions(distsData);
        setLoading(false);
      })
      .catch(err => {
        if (!active) return;
        console.error(err);
        setError('Failed to load PMIS trends. Ensure PMIS.csv is configured and valid.');
        setLoading(false);
      });

    return () => { active = false; };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="workspace">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading PMIS trends (this may take a few seconds if caching for the first time)...
        </div>
      </div>
    );
  }

  if (error || !trends) {
    return (
      <div className="workspace">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-red)' }}>
          {error || 'No trend data available.'}
        </div>
      </div>
    );
  }

  // Filter for years >= 1996 and <= 2024 and prepare data for plotting
  const years = Object.keys(trends)
    .map(Number)
    .filter(y => y >= 1996 && y <= 2024)
    .sort((a, b) => a - b);

  const crcpLaneMiles = years.map(y => trends[y].CRCP);

  const maxMiles = Math.max(...crcpLaneMiles, 0);
  const lastYear = years.length > 0 ? years[years.length - 1] : null;

  // Recreate the exact aesthetic the user requested
  const chartData = [
    {
      x: years,
      y: crcpLaneMiles,
      type: 'bar',
      marker: {
        color: 'black',
        line: {
          color: 'black',
          width: 1
        }
      },
      text: years.map(y => {
        const val = Math.round(trends[y].CRCP);
        return val > 0 ? String(val) : '';
      }),
      textposition: years.map(y => Math.round(trends[y].CRCP) > 0 ? 'auto' : 'none'),
      textangle: -90,
      insidetextanchor: 'middle',
      textfont: {
        family: 'Arial, sans-serif',
        size: 22,
        color: 'white',
      },
      hovertemplate: 'Year: %{x}<br>Lane Miles: %{y:.2f}<extra></extra>'
    }
  ];

  const chartLayout = {
    xaxis: {
      title: { text: '<b>Year</b>', font: { size: 28 } },
      tickmode: 'array',
      tickvals: years,
      tickangle: -45,
      tickfont: { size: 22 },
      showgrid: false,
      ticks: 'inside',
      showline: true,
      mirror: true,
    },
    yaxis: {
      title: { text: '<b>Total Lane Miles</b>', font: { size: 28 } },
      tickfont: { size: 22 },
      range: [0, maxMiles * 1.15],
      dtick: 2000,
      showgrid: true,
      gridcolor: 'rgba(0,0,0,0.15)',
      gridwidth: 1,
      griddash: 'dash',
      ticks: 'inside',
      showline: true,
      mirror: true,
    },
    margin: { l: 100, r: 40, t: 40, b: 100 },
    plot_bgcolor: 'transparent',
    paper_bgcolor: 'transparent',
    font: { color: 'black', family: 'Arial' }
  };

  const dists2024 = distributions ? distributions[2024] : null;

  const buildPctChart = (dataArr, labels, title, rotateX = false) => {
    if (!dataArr) return null;
    const total = dataArr.reduce((a, b) => a + b, 0);
    const pcts = dataArr.map(v => total > 0 ? (v / total * 100) : 0);
    const maxY = Math.max(...pcts, 0);

    return {
      data: [{
        x: labels,
        y: pcts,
        type: 'bar',
        marker: { color: 'black', line: { color: 'black', width: 1 } },
        text: pcts.map(p => p > 0 ? `${Math.round(p)}%` : ''),
        textposition: 'outside',
        cliponaxis: false,
        textfont: { family: 'Arial', size: 22, color: 'black' },
        hovertemplate: '%{x}<br>Count: %{customdata}<br>Percentage: %{y:.0f}%<extra></extra>',
        customdata: dataArr
      }],
      layout: {
        xaxis: {
          title: { text: `<b>${title}</b>`, font: { size: 28, color: 'black' } },
          tickangle: rotateX ? -45 : 0,
          tickfont: { size: 22 },
          showgrid: false, ticks: 'inside', showline: true, mirror: true
        },
        yaxis: {
          title: { text: '<b>Percentage of Sections (%)</b>', font: { size: 28 } },
          tickfont: { size: 22 },
          range: [0, maxY > 0 ? maxY * 1.2 : 100],
          showgrid: true, gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
          ticks: 'inside', showline: true, mirror: true
        },
        margin: { l: 100, r: 20, t: 40, b: rotateX ? 120 : 100 },
        plot_bgcolor: 'white', paper_bgcolor: 'white',
        font: { color: 'black', family: 'Arial' }
      }
    };
  };

  const countBins = (freqMap, bounds) => {
    if (!freqMap) return [];
    const counts = new Array(bounds.length - 1).fill(0);
    for (const [k, c] of Object.entries(freqMap)) {
      const val = parseInt(k, 10);
      let placed = false;
      for (let i = 0; i < bounds.length - 1; i++) {
        if (val >= bounds[i] && val < bounds[i+1]) {
          counts[i] += c;
          placed = true;
          break;
        }
      }
      if (!placed && val >= bounds[bounds.length - 1]) {
        counts[bounds.length - 2] += c;
      }
    }
    return counts;
  };

  const scoreLabels = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90-100'];
  const condChart = buildPctChart(dists2024?.CONDITION_SCORE, scoreLabels, 'Condition Score Range', false);
  const distChart = buildPctChart(dists2024?.DISTRESS_SCORE, scoreLabels, 'Distress Score Range', false);
  const rideChart = buildPctChart(dists2024?.RIDE_SCORE, ['0-0.9', '1.0-1.9', '2.0-2.9', '3.0-3.9', '4.0-5.0'], 'Ride Score Range', false);
  const iriChart = buildPctChart(dists2024?.IRI_SCORE, ['0-49', '50-99', '100-149', '150-199', '200-249', '250+'], 'IRI Score Range', false);

  const punchLabels = ['0', '1-5', '6-10', '11-15', '16-20', '21+'];
  const punchBounds = [0, 1, 6, 11, 16, 21, 9999];
  
  const tenLabels = ['0', '1-10', '11-20', '21-30', '31-40', '41-50', '51+'];
  const tenBounds = [0, 1, 11, 21, 31, 41, 51, 9999];

  const punchChart = buildPctChart(countBins(dists2024?.PUNCHOUTS, punchBounds), punchLabels, 'Punchouts', false);
  const spallChart = buildPctChart(countBins(dists2024?.SPALLINGS, tenBounds), tenLabels, 'Spalls', false);
  const acpPatchChart = buildPctChart(countBins(dists2024?.ACP_PATCHES, tenBounds), tenLabels, 'ACP Patches', false);
  const pccPatchChart = buildPctChart(countBins(dists2024?.PCC_PATCHES, tenBounds), tenLabels, 'PCC Patches', false);

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">PMIS General Trends</div>
          <div className="workspace__subtitle">Analyze overall PMIS trends and totals across the network.</div>
        </div>
        <div className="workspace__toolbar-right">
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
            CRCP Trend Over Time (1996 - {lastYear || 'Present'})
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ height: 500 }}>
              <PlotlyChart
                data={chartData}
                layout={chartLayout}
                filename="crcp_lane_miles_trend"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Total Lane Miles = Calculated Length × Number Thru Lanes
            </div>
          </div>
        </details>

        {dists2024 && (
          <>
            <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
              <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
                Score Distribution (2024 PMIS)
              </summary>
              <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ height: 350 }}><PlotlyChart data={condChart.data} layout={condChart.layout} filename="Condition_Score_Distribution_2024" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={distChart.data} layout={distChart.layout} filename="Distress_Score_Distribution_2024" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={rideChart.data} layout={rideChart.layout} filename="Ride_Score_Distribution_2024" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={iriChart.data} layout={iriChart.layout} filename="IRI_Score_Distribution_2024" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
              </div>
            </details>

            <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
              <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
                Distress Counts (2024 PMIS)
              </summary>
              <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ height: 350 }}><PlotlyChart data={punchChart.data} layout={punchChart.layout} filename="Punchout_Distribution_2024" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={spallChart.data} layout={spallChart.layout} filename="Spall_Distribution_2024" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={acpPatchChart.data} layout={acpPatchChart.layout} filename="ACP_Patch_Distribution_2024" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
                <div style={{ height: 350 }}><PlotlyChart data={pccPatchChart.data} layout={pccPatchChart.layout} filename="PCC_Patch_Distribution_2024" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} /></div>
              </div>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
