import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';

export default function AverageLifeWorkspace({ mode, addToast }) {
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
      
      // Datasets
      const reconVerified = new Set(reconData.verifiedSNs || []);
      const reconRows = reconData.pmisRows || [];
      const reconEndOfLifeMap = reconData.actualEndOfLifeMap || {};
      const reconYearConstMap = reconData.actualYearConstMap || {};

      const inServiceVerified = new Set(inServiceData.verifiedSNs || []);
      const inServiceRows = inServiceData.pmisRows || [];
      const inServiceEndOfLifeMap = inServiceData.actualEndOfLifeMap || {};
      const inServiceYearConstMap = inServiceData.actualYearConstMap || {};

      // Helper to process datasets (with duplicate handling like Construction Info)
      const getActuals = (rows, verifiedSet, endOfLifeMap, yearConstMap, datasetPrefix, minServiceLifeFilter = 0) => {
        const actuals = [];
        for (const row of rows) {
          const id = row['ID'] || row['S/N'];
          if (!verifiedSet.has(id)) continue;

          let yearConst = Number(row['Year Constructed']) || 0;
          if (yearConstMap[id]) yearConst = Number(yearConstMap[id]);
          let actual = Number(row['Service Life']) || 0;
          if (datasetPrefix === 'recon') {
            const eol = endOfLifeMap[id];
            const eolVal = Number(eol || row['End of Life']);
            if (!isNaN(yearConst) && !isNaN(eolVal) && yearConst > 0) {
              actual = eolVal - yearConst;
            }
          } else {
            const hasOverride = !!yearConstMap[id];
            const origYC = parseInt(row['Year Constructed'], 10);
            const activeYC = hasOverride ? parseInt(yearConstMap[id], 10) : origYC;
            const currentYear = new Date().getFullYear();
            
            if (!isNaN(activeYC)) {
                actual = currentYear - activeYC;
            }
          }

          if (actual >= 0 && actual >= minServiceLifeFilter) {
            const endRef = Number(row['End Ref'] || row['New End Ref'] || 0);
            const beginRef = Number(row['Begin Ref'] || row['New Begin Ref'] || 0);
            const laneMiles = Math.abs(endRef - beginRef);

            actuals.push({ actual, laneMiles });
          }
        }
        return actuals;
      };

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
        return { isNormal: pValue > 0.05, pValue, skewness, kurtosis };
      };

      // Helper to calculate chart stats
      function calculateChartStats(reconArray, inServiceArray) {
        const reconCounts = {};
        const inServiceCounts = {};
        let sumArithmetic = 0, sumWeighted = 0, totalLaneMiles = 0, totalValid = 0;
        const allActuals = [];

        for (const { actual, laneMiles } of reconArray) {
          reconCounts[actual] = (reconCounts[actual] || 0) + 1;
          allActuals.push(actual);
          sumArithmetic += actual;
          sumWeighted += actual * laneMiles;
          totalLaneMiles += laneMiles;
          totalValid++;
        }

        for (const { actual, laneMiles } of inServiceArray) {
          inServiceCounts[actual] = (inServiceCounts[actual] || 0) + 1;
          allActuals.push(actual);
          sumArithmetic += actual;
          sumWeighted += actual * laneMiles;
          totalLaneMiles += laneMiles;
          totalValid++;
        }

        allActuals.sort((a,b) => a-b);
        
        let mean = 0, median = 0, weightedMean = 0;
        if (totalValid > 0) {
          mean = sumArithmetic / totalValid;
          weightedMean = sumWeighted / totalLaneMiles;
          median = totalValid % 2 === 0
            ? (allActuals[totalValid / 2 - 1] + allActuals[totalValid / 2]) / 2
            : allActuals[Math.floor(totalValid / 2)];
        }

        const allYearsSet = new Set([...Object.keys(reconCounts), ...Object.keys(inServiceCounts)]);
        const xValues = Array.from(allYearsSet).map(Number).sort((a, b) => a - b);
        
        const reconYValues = xValues.map(x => reconCounts[x] || 0);
        const inServiceYValues = xValues.map(x => inServiceCounts[x] || 0);
        const combinedYValues = xValues.map((x, i) => reconYValues[i] + inServiceYValues[i]);
        const maxY = combinedYValues.length > 0 ? Math.max(...combinedYValues) : 0;

        return { mean, median, weightedMean, xValues, reconYValues, inServiceYValues, maxY, totalSections: totalValid };
      }

      const reconActuals = getActuals(reconRows, reconVerified, reconEndOfLifeMap, reconYearConstMap, 'recon', 0);
      const inServiceActualsAll = getActuals(inServiceRows, inServiceVerified, inServiceEndOfLifeMap, inServiceYearConstMap, 'inservice', 0);
      const inServiceActuals30 = getActuals(inServiceRows, inServiceVerified, inServiceEndOfLifeMap, inServiceYearConstMap, 'inservice', 30);

      const statsReconOnly = calculateChartStats(reconActuals, []);
      statsReconOnly.reconNormality = calculateNormality(reconActuals.map(r => r.actual));
      const statsCombinedAll = calculateChartStats(reconActuals, inServiceActualsAll);
      const statsCombined30 = calculateChartStats(reconActuals, inServiceActuals30);

      // --- Effect of Construction Year Data (Reconstructed Only) ---
      const reconEffectData = {};

      const processEffectData = (rows, verifiedSet, endOfLifeMap, yearConstMap, effectObj) => {
        for (const row of rows) {
          const id = row['ID'] || row['S/N'];
          if (!verifiedSet.has(id)) continue;

          let yearConst = Number(row['Year Constructed']) || 0;
          if (yearConstMap[id]) yearConst = Number(yearConstMap[id]);
          if (!yearConst) continue;
      
          let actual = Number(row['Service Life']) || 0;
          const eol = endOfLifeMap[id];
          if (eol && yearConst) {
            actual = Number(eol) - yearConst;
          }
          
          if (actual >= 0) {
            if (!effectObj[yearConst]) {
               effectObj[yearConst] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
            }
            effectObj[yearConst].sum += actual;
            effectObj[yearConst].count += 1;
            effectObj[yearConst].min = Math.min(effectObj[yearConst].min, actual);
            effectObj[yearConst].max = Math.max(effectObj[yearConst].max, actual);
          }
        }
      };

      processEffectData(reconRows, reconVerified, reconEndOfLifeMap, reconYearConstMap, reconEffectData);

      setDataStats({
        statsReconOnly,
        statsCombinedAll,
        statsCombined30,
        reconEffectData
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

  // Handle HMR mismatch state
  if (!dataStats || !dataStats.statsReconOnly) {
    return (
      <div className="workspace">
        <div style={{ padding: 24, display: 'flex', justifyContent: 'center' }}>
          <div className="loading-overlay__spinner" style={{ width: 24, height: 24 }} />
        </div>
      </div>
    );
  }

  const { statsReconOnly, statsCombinedAll, statsCombined30, reconEffectData } = dataStats;

  // --- Helper to Generate Stacked Bar Charts ---
  const generateStackedBarChart = (statsData, filename) => {
    const { xValues, reconYValues, inServiceYValues, mean, median, weightedMean, maxY } = statsData;
    const topY = filename === 'average_life_combined_all' ? 25 : Math.ceil(maxY * 1.2);

    const data = [
      {
        x: xValues,
        y: reconYValues,
        type: 'bar',
        name: 'Reconstructed',
        marker: { color: '#ffa1a1', line: { color: 'black', width: 1.5 } },
        text: reconYValues.map(v => v > 0 ? String(v) : ''),
        textposition: 'inside',
        insidetextanchor: 'middle',
        textfont: { color: 'black', size: 12, family: 'Arial' }
      }
    ];

    if (inServiceYValues && inServiceYValues.some(v => v > 0)) {
      data.push({
        x: xValues,
        y: inServiceYValues,
        type: 'bar',
        name: 'In Service',
        marker: { color: '#a1ffcb', line: { color: 'black', width: 1.5 } },
        text: inServiceYValues.map(v => v > 0 ? String(v) : ''),
        textposition: 'inside',
        insidetextanchor: 'middle',
        textfont: { color: 'black', size: 12, family: 'Arial' }
      });
    }

    if (mean > 0) {
      data.push({
        x: [mean, mean], y: [0, topY], mode: 'lines',
        name: `Arithmetic Mean: ${mean.toFixed(2)}`,
        line: { color: 'red', dash: 'dash', width: 2 }
      });
    }
    if (median > 0) {
      data.push({
        x: [median, median], y: [0, topY], mode: 'lines',
        name: `Median: ${median.toFixed(2)}`,
        line: { color: 'blue', dash: 'dash', width: 2 }
      });
    }
    if (weightedMean > 0) {
      data.push({
        x: [weightedMean, weightedMean], y: [0, topY], mode: 'lines',
        name: `Weighted Mean: ${weightedMean.toFixed(2)}`,
        line: { color: 'green', dash: 'dash', width: 2 }
      });
    }



    const layout = {
      barmode: 'stack',
      xaxis: {
        title: { text: '<b>Service Life (Years)</b>', font: { size: 28 } },
        tickmode: 'linear', dtick: 2, tickfont: { size: 22 }, ticks: 'inside',
        showline: true, linewidth: 1, linecolor: 'black', mirror: true
      },
      yaxis: {
        title: { text: '<b>Number of Pavement Sections</b>', font: { size: 28 } },
        range: [0, topY], tickfont: { size: 22 }, ticks: 'inside',
        gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
        showline: true, linewidth: 1, linecolor: 'black', mirror: true
      },
      legend: {
        x: 1, xanchor: 'right', y: 1,
        bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1
      },
      margin: { t: 40, r: 20, l: 100, b: 100 },
      plot_bgcolor: 'white', paper_bgcolor: 'white',
      font: { color: 'black', family: 'Arial' }
    };

    return { data, layout };
  };

  const chartReconOnly = generateStackedBarChart(statsReconOnly, 'average_life_reconstructed');
  const chartCombinedAll = generateStackedBarChart(statsCombinedAll, 'average_life_combined_all');
  const chartCombined30 = generateStackedBarChart(statsCombined30, 'average_life_combined_30');

  // --- Helper to Generate Line Charts (Shaded Min/Max) ---
  const generateEffectChart = (effectData, colorHex, fillRgba, titlePrefix) => {
    const years = Object.keys(effectData).map(Number).sort((a,b) => a - b);
    if (years.length === 0) return { data: [], layout: {} };

    const means = years.map(y => effectData[y].sum / effectData[y].count);
    const mins = years.map(y => effectData[y].min);
    const maxes = years.map(y => effectData[y].max);

    const minX = Math.min(...years) - 1;
    const maxX = Math.max(...years) + 1;
    const topEffectY = Math.ceil(Math.max(...maxes) / 5) * 5 + 5; 

    const data = [
      { x: years, y: maxes, mode: 'lines', line: { width: 0 }, showlegend: false, hoverinfo: 'skip' },
      { x: years, y: mins, mode: 'lines', fill: 'tonexty', fillcolor: fillRgba, line: { width: 0 }, name: 'Min-Max Range' },
      { x: years, y: means, mode: 'lines+markers', name: 'Average Service Life', line: { color: colorHex }, marker: { color: colorHex } }
    ];

    const layout = {
      xaxis: {
        title: { text: '<b>Construction Year</b>', font: { size: 28 } },
        range: [minX, maxX],
        tickmode: 'linear', dtick: 1, tickangle: 45, tickfont: { size: 22 }, ticks: 'inside',
        gridcolor: 'rgba(0,0,0,0.1)', gridwidth: 1, griddash: 'dash',
        showline: true, linewidth: 1, linecolor: 'black', mirror: true
      },
      yaxis: {
        title: { text: '<b>Service Life (Years)</b>', font: { size: 28 } },
        range: [0, topEffectY],
        tickmode: 'linear', dtick: 5, tickfont: { size: 22 }, ticks: 'inside',
        gridcolor: 'rgba(0,0,0,0.1)', gridwidth: 1, griddash: 'dash',
        showline: true, linewidth: 1, linecolor: 'black', mirror: true
      },
      legend: {
        x: 1, xanchor: 'right', y: 1,
        bgcolor: 'rgba(255,255,255,0.8)', bordercolor: 'rgba(0,0,0,0.1)', borderwidth: 1
      },
      margin: { t: 40, r: 20, l: 100, b: 100 },
      plot_bgcolor: 'white', paper_bgcolor: 'white',
      font: { color: 'black', family: 'Arial' }
    };

    return { data, layout };
  };

  const reconEffect = generateEffectChart(reconEffectData, 'red', 'rgba(255, 0, 0, 0.2)', 'Reconstructed');

  const StatsBar = ({ stats }) => (
    <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.totalSections}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Arithmetic Mean</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.mean.toFixed(2)}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Median</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.median.toFixed(2)}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Weighted Mean</div>
        <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.weightedMean.toFixed(2)}</div>
      </div>
      {stats.reconNormality && (
        <>
          <div style={{ width: 1, backgroundColor: 'var(--border-subtle)', margin: '0 8px' }} />
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Distribution (Jarque-Bera)</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: stats.reconNormality.isNormal ? 'var(--success)' : 'var(--text-primary)' }}>
              {stats.reconNormality.isNormal ? 'Approximately Normal' : 'Not Normal'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Skewness</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{stats.reconNormality.skewness?.toFixed(3)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kurtosis</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{stats.reconNormality.kurtosis?.toFixed(3)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>p-value</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>{stats.reconNormality.pValue < 0.001 ? '<0.001' : stats.reconNormality.pValue?.toFixed(3)}</div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Average Life Analysis</div>
          <div className="workspace__subtitle">Calculate and analyze the average service life across verified sections.</div>
        </div>
        <div className="workspace__toolbar-right">
          <button className="btn btn--secondary btn--sm" onClick={() => setRefreshTrigger(t => t + 1)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Update
          </button>
        </div>
      </div>
      
      <div className="workspace__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>
        
        {/* Chart 1: Average Life (Reconstructed Only) */}
        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Average Life for Reconstructed
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {statsReconOnly.totalSections > 0 ? (
              <>
                <StatsBar stats={statsReconOnly} />
                <div style={{ height: 400 }}>
                  <PlotlyChart data={chartReconOnly.data} layout={chartReconOnly.layout} filename="average_life_reconstructed" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} />
                </div>
              </>
            ) : (
              <div>No verified reconstructed sections to display.</div>
            )}
          </div>
        </details>

        {/* Chart 2: Average Life (All In Service Included) */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Average Life (Including all In Service)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {statsCombinedAll.totalSections > 0 ? (
              <>
                <StatsBar stats={statsCombinedAll} />
                <div style={{ height: 400 }}>
                  <PlotlyChart data={chartCombinedAll.data} layout={chartCombinedAll.layout} filename="average_life_combined_all" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} />
                </div>
              </>
            ) : (
              <div>No verified sections to display.</div>
            )}
          </div>
        </details>

        {/* Chart 3: Average Life (In Service > 30 Years Included) */}
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Average Life (Including In Service &gt; 30 Years)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {statsCombined30.totalSections > 0 ? (
              <>
                <StatsBar stats={statsCombined30} />
                <div style={{ height: 400 }}>
                  <PlotlyChart data={chartCombined30.data} layout={chartCombined30.layout} filename="average_life_combined_30" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} />
                </div>
              </>
            ) : (
              <div>No verified sections to display.</div>
            )}
          </div>
        </details>

        {/* Chart 4: Effect of Construction Year (Reconstructed) */}
        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Effect of Construction Year on Service Life (Reconstructed)
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {reconEffect.data.length > 0 ? (
              <>
                <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{statsReconOnly.totalSections}</div>
                  </div>
                </div>
                <div style={{ height: 400 }}>
                  <PlotlyChart data={reconEffect.data} layout={reconEffect.layout} filename="effect_const_year_reconstructed" config={{ responsive: true, displayModeBar: true }} style={{ width: '100%', height: '100%' }} />
                </div>
              </>
            ) : (
              <div>No verified reconstructed sections to display.</div>
            )}
          </div>
        </details>

      </div>
    </div>
  );
}
