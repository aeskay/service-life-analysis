import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';

export default function BaseTyThWorkspace({ addToast }) {
  const [dataStats, setDataStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadState().then(data => {
      if (!active) return;
      if (!data) return;

      const reconData = data?.reconstructed || {};
      const reconRows = reconData.pmisRows || [];
      const reconVerified = new Set(reconData.verifiedSNs || []);
      const reconYearConstMap = reconData.actualYearConstMap || {};
      const reconEndOfLifeMap = reconData.actualEndOfLifeMap || {};

      // User requested to limit analysis strictly to Reconstructed only
      const inServiceRows = [];

      const reconFreqMap = {}; // { Th: { Ty: count } }
      const allFreqMap = {};   // { Th: { Ty: count } }
      const reconLifeMap = {}; // { Th: { Ty: [lives] } }
      
      let reconFreqTotal = 0;
      let allFreqTotal = 0;
      let totalAnalyzedForLife = 0;

      const processRow = (row, isRecon) => {
        const id = row['ID'] || row['S/N'];
        if (isRecon && !reconVerified.has(id)) return;

        const bTh = parseFloat(row['Base Th']);
        let bType = String(row['Base'] || '').trim();
        
        if (isNaN(bTh) || bTh <= 0 || !bType || bType === 'undefined') return;
        
        // Populate Frequencies
        if (!allFreqMap[bTh]) allFreqMap[bTh] = {};
        allFreqMap[bTh][bType] = (allFreqMap[bTh][bType] || 0) + 1;
        allFreqTotal++;

        if (isRecon) {
          if (!reconFreqMap[bTh]) reconFreqMap[bTh] = {};
          reconFreqMap[bTh][bType] = (reconFreqMap[bTh][bType] || 0) + 1;
          reconFreqTotal++;

          const origYC = Number(row['Year Constructed'] || row['Year Con']) || 0;
          const actualEOL = reconEndOfLifeMap[id];
          const eolToUse = actualEOL || row['End of Life'] || row['Year of Rehab'];
          const eolVal = Number(eolToUse);
          
          let life = parseFloat(row['Service Life'] || row['Life']);
          if (!isNaN(origYC) && !isNaN(eolVal) && origYC > 0) {
              life = eolVal - origYC;
          } else if (isNaN(life) && origYC > 0) {
              // Final fallback
             life = new Date().getFullYear() - origYC;
          }

          if (!isNaN(life) && life > 0) {
            if (!reconLifeMap[bTh]) reconLifeMap[bTh] = {};
            if (!reconLifeMap[bTh][bType]) reconLifeMap[bTh][bType] = [];
            reconLifeMap[bTh][bType].push(life);
            totalAnalyzedForLife++;
          }
        }
      };

      reconRows.forEach(r => processRow(r, true));
      inServiceRows.forEach(r => processRow(r, false));

      // Get unique base types globally for color consistency
      const globalTypesSet = new Set();
      Object.values(allFreqMap).forEach(typesObj => Object.keys(typesObj).forEach(t => globalTypesSet.add(t)));
      
      // Calculate global mean life for sorting Base Types
      const globalTypeLife = {};
      Object.values(reconLifeMap).forEach(typesObj => {
        Object.entries(typesObj).forEach(([t, lives]) => {
          if (!globalTypeLife[t]) globalTypeLife[t] = [];
          globalTypeLife[t].push(...lives);
        });
      });

      const getMean = (arr) => arr && arr.length > 0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
      
      const allBaseTypes = Array.from(globalTypesSet).sort((a, b) => {
        const meanA = getMean(globalTypeLife[a]);
        const meanB = getMean(globalTypeLife[b]);
        if (meanA === meanB) return a.localeCompare(b);
        return meanA - meanB;
      });

      const greyColors = ['#FFFFFF', '#E0E0E0', '#C0C0C0', '#A0A0A0', '#808080', '#606060', '#404040', '#202020', '#000000'];
      const patternShapes = ['', '/', '\\', 'x', '-', '|', '+', '.'];
      
      const typeStyleMap = {};
      allBaseTypes.forEach((t, i) => { 
        typeStyleMap[t] = {
          color: greyColors[i % greyColors.length],
          pattern: patternShapes[i % patternShapes.length]
        };
      });

      const sortedThicknesses = Object.keys(allFreqMap).map(Number).sort((a,b)=>a-b);

      // Build Traces
      const buildTraces = (dataMap, isMean) => {
        return allBaseTypes.map(bType => {
          const xData = [];
          const yData = [];
          
          sortedThicknesses.forEach(th => {
            xData.push(`<b>${th}</b>`);
            const valObj = dataMap[th] ? dataMap[th][bType] : null;
            if (isMean) {
              if (valObj && valObj.length > 0) yData.push(getMean(valObj));
              else yData.push(null);
            } else {
              yData.push(valObj || 0);
            }
          });

          return {
            x: xData,
            y: yData,
            type: 'bar',
            name: bType,
            marker: { 
              color: typeStyleMap[bType].color, 
              line: { color: 'black', width: 1.5 },
              pattern: {
                shape: typeStyleMap[bType].pattern,
                fillmode: 'overlay',
                size: 8,
                solidity: 0.3,
                fgcolor: 'black'
              }
            }
          };
        });
      };

      const reconFreqTraces = buildTraces(reconFreqMap, false);
      const allFreqTraces = buildTraces(allFreqMap, false);
      const lifeTraces = buildTraces(reconLifeMap, true);

      setDataStats({
        reconFreqTraces,
        lifeTraces,
        allBaseTypes,
        sortedThicknesses,
        reconFreqTotal,
        totalAnalyzedForLife
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
          <div style={{ color: 'var(--text-muted)' }}>Calculating Base TY and TH statistics...</div>
        </div>
      </div>
    );
  }

  if (!dataStats) return null;

  const getLayout = (yTitle, isStacked = false) => ({
    barmode: isStacked ? 'stack' : 'group',
    xaxis: {
      title: { text: '<b>Base Thickness (Inches)</b>', font: { size: 28 } },
      tickfont: { size: 28 }, ticks: 'inside',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: `<b>${yTitle}</b>`, font: { size: 28 } },
      tickfont: { size: 28 }, ticks: 'inside',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
      rangemode: 'tozero',
      ...(yTitle === 'Mean Service Life (Years)' ? { range: [0, 70] } : {})
    },
    legend: {
      title: { text: '<b>Base Type</b>', font: { size: 28 } },
      font: { size: 28 },
      x: 1, xanchor: 'right', y: 1, yanchor: 'top',
      bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1
    },
    margin: { t: 40, r: 20, l: 100, b: 100 },
    plot_bgcolor: 'transparent', paper_bgcolor: 'transparent',
    font: { family: 'Arial', color: 'black' },
    showlegend: true
  });

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Base TY and TH Analysis</div>
          <div className="workspace__subtitle">Effect of Base Type and Thickness on service life.</div>
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
        
        {/* Frequency - Reconstructed */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Base TY and TH Frequency (Reconstructed Only)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reconstructed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconFreqTotal}</div>
              </div>
            </div>

            <div style={{ height: 500 }}>
              <PlotlyChart
                data={dataStats.reconFreqTraces}
                layout={getLayout('Count', false)}
                filename="base_ty_th_freq_recon"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        {/* Service Life vs Base TY and TH */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Mean Service Life by Base Thickness and Type
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Base Types</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.allBaseTypes.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Thickness Variants</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.sortedThicknesses.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Sections Analyzed</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.totalAnalyzedForLife}</div>
              </div>
            </div>

            <div style={{ height: 600 }}>
              <PlotlyChart
                data={dataStats.lifeTraces}
                layout={getLayout('Mean Service Life (Years)', false)}
                filename="base_ty_th_life"
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
