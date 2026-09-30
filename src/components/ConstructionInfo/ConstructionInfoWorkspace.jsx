import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';

export default function ConstructionInfoWorkspace({ mode, addToast }) {
  const [dataStats, setDataStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadState().then(state => {
      if (!active) return;
      
      const reconData = state?.reconstructed || {};
      const inServiceData = state?.inservice || {};

      const reconVerified = new Set(reconData.verifiedSNs || []);
      const inServiceVerified = new Set(inServiceData.verifiedSNs || []);

      const reconRows = reconData.pmisRows || [];
      const inServiceRows = inServiceData.pmisRows || [];

      // Maps for actual overrides
      const reconYearConstMap = reconData.actualYearConstMap || {};
      const inServiceYearConstMap = inServiceData.actualYearConstMap || {};

      const reconCounts = {};
      const inServiceCounts = {};
      const processedGlobalSNs = new Set();
      let totalCount = 0;

      // Helper to process a dataset
      const processRows = (rows, verifiedSet, yearConstMap, datasetPrefix, countsObj) => {
        for (const row of rows) {
          const id = row['ID'] || row['S/N'];
          const baseSN = row['S/N'] || id; // Use the base S/N (CSJ) rather than the directional ID
          
          if (!verifiedSet.has(id)) continue; // Only process verified/cleaned sections
          
          // Create a globally unique key for this CSJ within this specific dataset
          const globalSN = `${datasetPrefix}_${baseSN}`;
          
          // If we've already counted this CSJ for this dataset (e.g., from an L or R row), skip it.
          if (processedGlobalSNs.has(globalSN)) continue;
          processedGlobalSNs.add(globalSN);

          let yearConst = Number(row['Year Constructed']) || 0;
          if (yearConstMap[id]) {
            yearConst = Number(yearConstMap[id]);
          }

          if (yearConst > 0) {
            countsObj[yearConst] = (countsObj[yearConst] || 0) + 1;
            totalCount++;
          }
        }
      };

      // Process both datasets with unique prefixes to prevent cross-dataset conflicts
      processRows(reconRows, reconVerified, reconYearConstMap, 'recon', reconCounts);
      processRows(inServiceRows, inServiceVerified, inServiceYearConstMap, 'inservice', inServiceCounts);

      if (totalCount === 0) {
        setDataStats(null);
        setIsLoading(false);
        return;
      }

      const allYearsSet = new Set([...Object.keys(reconCounts), ...Object.keys(inServiceCounts)]);
      const xValues = Array.from(allYearsSet).map(Number).sort((a, b) => a - b);
      
      const reconYValues = xValues.map(x => reconCounts[x] || 0);
      const inServiceYValues = xValues.map(x => inServiceCounts[x] || 0);
      const combinedYValues = xValues.map((x, i) => reconYValues[i] + inServiceYValues[i]);
      
      const maxY = Math.max(...combinedYValues);

      setDataStats({
        xValues,
        reconYValues,
        inServiceYValues,
        combinedYValues,
        maxY,
        totalSections: totalCount
      });
      setIsLoading(false);
    });

    return () => { active = false; };
  }, [refreshTrigger]);

  if (isLoading) {
    return (
      <div className="workspace">
        <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
          <div className="loading-overlay__spinner" style={{ width: 24, height: 24 }} />
        </div>
      </div>
    );
  }

  if (!dataStats) {
    return (
      <div className="workspace">
        <div className="workspace__header">
          <div className="workspace__title">Construction Info</div>
          <div className="workspace__subtitle">Statistical distribution of Construction Years for all combined sections.</div>
        </div>
        <div className="workspace__body" style={{ padding: 24 }}>
          <div className="empty-state">
            <div className="empty-state__icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20v-6M6 20V10M18 20V4" />
              </svg>
            </div>
            <div className="empty-state__title">No Verified Data Found</div>
            <div className="empty-state__desc">
              There are no verified sections to analyze. Please verify sections in the Cleaned Sections tab first.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Safety check for React Fast Refresh (HMR) keeping old state shapes
  if (!dataStats.reconYValues) {
    return (
      <div className="workspace">
        <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
          <div className="loading-overlay__spinner" style={{ width: 24, height: 24 }} />
        </div>
      </div>
    );
  }

  const { xValues, reconYValues, inServiceYValues, combinedYValues, maxY } = dataStats;
  const topY = Math.ceil(maxY * 1.2);

  const sharedLayoutBase = {
    xaxis: {
      title: {
        text: '<b>Construction Year</b>',
        font: { size: 22, color: 'black' },
        standoff: 20
      },
      tickmode: 'linear',
      dtick: 1,
      tickangle: -90,
      tickfont: { size: 14 },
      ticks: 'inside',
      showline: true,
      linewidth: 1,
      linecolor: 'black',
      mirror: true
    },
    yaxis: {
      title: {
        text: '<b>Number of Pavement Sections</b>',
        font: { size: 22, color: 'black' }
      },
      range: [0, topY],
      tickfont: { size: 14 },
      gridcolor: 'rgba(0,0,0,0.15)',
      gridwidth: 1,
      griddash: 'dash',
      ticks: 'inside',
      showline: true,
      linewidth: 1,
      linecolor: 'black',
      mirror: true
    },
    legend: {
      x: 1,
      xanchor: 'right',
      y: 1,
      bgcolor: 'rgba(255,255,255,0.8)',
      bordercolor: 'rgba(0,0,0,0.1)',
      borderwidth: 1
    },
    margin: { t: 40, r: 20, l: 60, b: 80 },
    plot_bgcolor: 'white',
    paper_bgcolor: 'white'
  };

  // ─── Chart 1: Combined Black Bars ───────────────────────────────────────────
  const chartDataCombined = [
    {
      x: xValues,
      y: combinedYValues,
      type: 'bar',
      name: 'Combined Sections',
      marker: {
        color: 'black',
        line: { color: 'black', width: 1.5 }
      },
      width: 0.8,
      showlegend: false
    }
  ];

  // ─── Chart 2: Stacked Format ──────────────────────────────────────────────
  const chartDataStacked = [
    {
      x: xValues,
      y: reconYValues,
      type: 'bar',
      name: 'Reconstructed',
      marker: { color: '#ffa1a1', line: { color: 'black', width: 1.5 } },
      text: reconYValues.map(v => v > 0 ? String(v) : ''),
      textposition: 'inside',
      insidetextanchor: 'middle',
      textfont: { color: 'black', size: 13, family: 'Arial', weight: 'bold' }
    },
    {
      x: xValues,
      y: inServiceYValues,
      type: 'bar',
      name: 'In Service',
      marker: { color: '#a1ffcb', line: { color: 'black', width: 1.5 } },
      text: inServiceYValues.map(v => v > 0 ? String(v) : ''),
      textposition: 'inside',
      insidetextanchor: 'middle',
      textfont: { color: 'black', size: 13, family: 'Arial', weight: 'bold' }
    }
  ];

  const chartLayoutStacked = {
    ...sharedLayoutBase,
    barmode: 'stack'
  };

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Construction Info</div>
          <div className="workspace__subtitle">Statistical distribution of Construction Years across all verified sections.</div>
        </div>
        <div className="workspace__toolbar-right">
          <button className="btn btn--secondary btn--sm" onClick={() => setRefreshTrigger(t => t + 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Update Chart
          </button>
        </div>
      </div>
      
      <div className="workspace__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
        
        {/* Accordion 1: Combined Black Bars */}
        <details style={{
          background: 'white',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          <summary style={{
            padding: '16px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret">
              <path d="M9 18l6-6-6-6" />
            </svg>
            Combined Construction Info
          </summary>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.totalSections}</div>
              </div>
            </div>

            <div style={{ height: 400 }}>
              <PlotlyChart 
                data={chartDataCombined} 
                layout={sharedLayoutBase} 
                filename="construction_info_combined"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        {/* Accordion 2: Stacked Format */}
        <details open style={{
          background: 'white',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          <summary style={{
            padding: '16px 24px',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            backgroundColor: 'var(--bg-elevated)',
            borderBottom: '1px solid var(--border-subtle)',
            listStyle: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret">
              <path d="M9 18l6-6-6-6" />
            </svg>
            Number of Pavements by Construction Year (Stacked)
          </summary>

          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.totalSections}</div>
              </div>
            </div>

            <div style={{ height: 400 }}>
              <PlotlyChart 
                data={chartDataStacked} 
                layout={chartLayoutStacked} 
                filename="construction_info_stacked"
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
