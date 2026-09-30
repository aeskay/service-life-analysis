import React, { useState, useEffect } from 'react';
import PlotlyChart from '../Verify/PlotlyChart';
import { loadState } from '../../utils/stateStore';

export default function PaveTrafficHeatmapWorkspace() {
  const [heatmapData, setHeatmapData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    loadState().then(state => {
      if (!active) return;
      
      const reconTraffic = state.trafficAnalysis?.reconstructed?.results || [];
      const inServiceTraffic = state.trafficAnalysis?.inservice?.results || [];
      const reconEndOfLifeMap = state.reconstructed?.actualEndOfLifeMap || {};
      const reconYearConstMap = state.reconstructed?.actualYearConstMap || {};
      const inServiceYearConstMap = state.inservice?.actualYearConstMap || {};

      const reconVerified = new Set(state.reconstructed?.verifiedSNs || []);
      const inServiceVerified = new Set(state.inservice?.verifiedSNs || []);

      const validRows = [];

      const processRow = (row, isRecon) => {
        const id = row['ID'] || row['S/N'];
        if (isRecon && !reconVerified.has(id)) return;
        if (!isRecon && !inServiceVerified.has(id)) return;

        const esal = Number(row['CUMULATIVE_ESAL']);
        if (isNaN(esal) || esal <= 0) return;
        
        const esalMillions = esal / 1000000;

        let serviceLife = Number(row['SERVICE_LIFE'] || row['Service Life']) || 0;
        if (isRecon) {
            const origYC = Number(row['CONSTRUCTION_YEAR']) || Number(row['Year Constructed']) || 0;
            const actualEOL = reconEndOfLifeMap[id];
            const eolToUse = actualEOL || row['END_OF_LIFE'] || row['End of Life'];
            const eolVal = Number(eolToUse);
            if (!isNaN(origYC) && !isNaN(eolVal) && origYC > 0) {
                serviceLife = eolVal - origYC;
            }
        } else {
            const actualYC = inServiceYearConstMap[id];
            const origYC = parseInt(row['CONSTRUCTION_YEAR'] || row['Year Constructed'], 10);
            const activeYC = actualYC ? parseInt(actualYC, 10) : origYC;
            const currentYear = new Date().getFullYear();
            if (!isNaN(activeYC)) {
                serviceLife = currentYear - activeYC;
            }
        }
        
        let slabThickness = parseFloat(isRecon ? (row['OLD_SLAB_TH'] || row['Old Slab Th']) : (row['SLAB_TH'] || row['Slab Th']));
        if (isNaN(slabThickness) || slabThickness <= 0) {
            slabThickness = parseFloat(row['SLAB_TH'] || row['OLD_SLAB_TH'] || row['Slab Th'] || row['Old Slab Th'] || row['Slab Thickness'] || row['SLAB_THICKNESS']);
        }

        let baseThickness = parseFloat(isRecon ? (row['OLD_BASE_TH'] || row['Old Base Th']) : (row['BASE_TH'] || row['Base Th']));
        if (isNaN(baseThickness) || baseThickness <= 0) {
            baseThickness = parseFloat(row['BASE_TH'] || row['OLD_BASE_TH'] || row['Base Th'] || row['Old Base Th'] || row['Base Thickness'] || row['BASE_THICKNESS']);
        }

        let btStr = String(row['BASE_TYPE'] || row['Base Type'] || row['BASE'] || row['Base'] || '').trim();
        if (!btStr || btStr === 'undefined') {
          btStr = String(row['OLD_BASE_TYPE'] || row['Old Base Type'] || row['OLD_BASE'] || row['Old Base'] || '').trim();
        }
        btStr = btStr.toUpperCase();
        const baseTypeMapping = {
            'ASB': 1, 'ACP': 2, 'CSB': 3, 'FB': 4, 'LSB': 5,
            'ASPHALT STABILIZE BASE': 1, 'ASPHALT CONCRETE PAVEMENT': 2,
            'CEMENT STABILIZE BASE': 3, 'FLEX BASE': 4, 'LIME STABILIZE BASE': 5,
            'CTB': 3, 'CEMENT TREATED BASE': 3,
            'FOUNDATION COURSE': 4
        };
        const baseTypeNum = baseTypeMapping[btStr] || 0;
        
        if (serviceLife > 0 && !isNaN(slabThickness) && slabThickness > 0 && !isNaN(baseThickness) && baseThickness > 0) {
            validRows.push({ esal: esalMillions, serviceLife, slabThickness, baseThickness, baseTypeNum });
        }
      };

      for (const row of reconTraffic) processRow(row, true);
      // for (const row of inServiceTraffic) processRow(row, false);

      // Bucket ESAL
      const esalBins = [
        { min: 0, max: 10, label: '0-10' },
        { min: 10, max: 20, label: '10-20' },
        { min: 20, max: 30, label: '20-30' },
        { min: 30, max: 50, label: '30-50' },
        { min: 50, max: 100, label: '50-100' },
        { min: 100, max: Infinity, label: '>100' }
      ];

      // Grouping dictionary
      // Key: `${slabThickness}_${baseThickness}_${esalLabel}`
      const groups = {};
      const slabSet = new Set();
      
      const xLabelsSet = new Set();
      const baseSet = new Set();

      validRows.forEach(r => {
        let esalLabel = '>100';
        for (const b of esalBins) {
            if (r.esal > b.min && r.esal <= b.max) {
                esalLabel = b.label;
                break;
            }
        }
        const slabKey = r.slabThickness;
        const baseKey = r.baseThickness;
        
        slabSet.add(slabKey);
        baseSet.add(baseKey);
        
        const xLabel = `${baseKey}in | ${esalLabel}`;
        xLabelsSet.add(xLabel);
        
        const key = `${slabKey}_${xLabel}`;
        if (!groups[key]) groups[key] = { sum: 0, count: 0 };
        groups[key].sum += r.serviceLife;
        groups[key].count++;
      });
      
      const uniqueSlabs = Array.from(slabSet).sort((a, b) => a - b);
      const uniqueBases = Array.from(baseSet).sort((a, b) => a - b);
      
      // Order X labels logically: first by Base Thickness, then by ESAL bin
      const orderedXLabels = [];
      for (const b of uniqueBases) {
          for (const bin of esalBins) {
              const lbl = `${b}in | ${bin.label}`;
              if (xLabelsSet.has(lbl)) {
                  orderedXLabels.push(lbl);
              }
          }
      }

      // Build Z matrix (y = slab, x = base+esal)
      const zMatrix = [];
      const textMatrix = [];
      
      for (const slab of uniqueSlabs) {
        const zRow = [];
        const tRow = [];
        for (const xLbl of orderedXLabels) {
            const k = `${slab}_${xLbl}`;
            if (groups[k]) {
                const avg = groups[k].sum / groups[k].count;
                zRow.push(avg);
                tRow.push(avg.toFixed(1));
            } else {
                zRow.push(null);
                tRow.push('');
            }
        }
        zMatrix.push(zRow);
        textMatrix.push(tRow);
      }

      // Correlation Matrix
      const getPearsonCorrelation = (x, y) => {
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        const minLength = Math.min(x.length, y.length);
        for (let i = 0; i < minLength; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += (x[i] * y[i]);
            sumX2 += (x[i] * x[i]);
            sumY2 += (y[i] * y[i]);
        }
        const step1 = (minLength * sumXY) - (sumX * sumY);
        const step2 = (minLength * sumX2) - (sumX * sumX);
        const step3 = (minLength * sumY2) - (sumY * sumY);
        const step4 = Math.sqrt(step2 * step3);
        if (step4 === 0) return 0;
        return step1 / step4;
      };

      const slArr = [];
      const stArr = [];
      const btArr = [];
      const esalArr = [];
      const btypeArr = [];

      validRows.forEach(r => {
        slArr.push(r.serviceLife);
        stArr.push(r.slabThickness);
        btArr.push(r.baseThickness);
        esalArr.push(r.esal);
        btypeArr.push(r.baseTypeNum);
      });

      const corrCols = ['Service Life', 'Slab Thickness', 'Base Thickness', 'ESAL (Millions)'];
      const dataCols = [slArr, stArr, btArr, esalArr, btypeArr];
      const corrZ = [];
      const corrText = [];
      
      for (let i = 0; i < corrCols.length; i++) {
        const rowZ = [];
        const rowText = [];
        for (let j = 0; j < corrCols.length; j++) {
            const corr = getPearsonCorrelation(dataCols[i], dataCols[j]);
            rowZ.push(corr);
            rowText.push(corr.toFixed(2));
        }
        corrZ.push(rowZ);
        corrText.push(rowText);
      }

      setHeatmapData({
        z: zMatrix,
        x: orderedXLabels,
        y: uniqueSlabs.map(String),
        text: textMatrix,
        corrZ,
        corrText,
        corrCols,
        totalAnalyzed: validRows.length
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
          <div style={{ color: 'var(--text-muted)' }}>Calculating Heatmap...</div>
        </div>
      </div>
    );
  }

  if (!heatmapData) return null;

  const chartData = [{
    z: heatmapData.z,
    x: heatmapData.x,
    y: heatmapData.y,
    text: heatmapData.text,
    type: 'heatmap',
    colorscale: 'RdYlGn',
    showscale: true,
    hoverinfo: 'x+y+text',
    texttemplate: '%{text}',
    colorbar: {
        title: { text: 'Avg Service Life (Yrs)', side: 'right' }
    }
  }];

  const layout = {
    title: { text: '<b>Effect of Slab Thickness, Base Thickness, and ESAL on Service Life</b>', font: { size: 16 } },
    xaxis: {
      title: { text: '<b>Base Thickness and ESAL Range (millions)</b>', font: { size: 14 } },
      tickangle: 45,
      tickfont: { size: 12 }, ticks: 'inside',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Slab Thickness (Inches)</b>', font: { size: 14 } },
      tickfont: { size: 12 }, ticks: 'inside',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
      type: 'category'
    },
    margin: { t: 60, r: 20, l: 80, b: 120 }, // extra bottom margin for angled labels
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' }
  };

  const corrChartData = [{
    z: heatmapData.corrZ,
    x: heatmapData.corrCols,
    y: heatmapData.corrCols,
    text: heatmapData.corrText,
    type: 'heatmap',
    colorscale: 'Greens',
    reversescale: true,
    showscale: true,
    hoverinfo: 'x+y+text',
    texttemplate: '%{text}',
    colorbar: {
        title: { text: 'Pearson Correlation', side: 'right' }
    }
  }];

  const corrLayout = {
    title: { text: '<b>Correlation Matrix</b>', font: { size: 16 } },
    xaxis: {
      tickangle: 45,
      tickfont: { size: 12 }, ticks: 'inside',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      tickfont: { size: 12 }, ticks: 'inside',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
      autorange: 'reversed'
    },
    margin: { t: 60, r: 20, l: 120, b: 120 },
    plot_bgcolor: 'white', paper_bgcolor: 'white',
    font: { family: 'Arial', color: 'black' },
    width: 600,
    height: 600
  };

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Traffic Heatmaps (2024 PMIS)</div>
          <div className="workspace__subtitle">Statewide traffic distribution for rigid pavements across districts.</div>
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
        
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Heatmap Analysis
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{heatmapData.totalAnalyzed}</div>
              </div>
            </div>
            <div style={{ height: 600 }}>
              <PlotlyChart
                data={chartData}
                layout={layout}
                filename="pave_traffic_heatmap"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>
        
        <details open style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Correlation Heatmap
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
            <div className="stats-bar" style={{ alignSelf: 'stretch', display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{heatmapData.totalAnalyzed}</div>
              </div>
            </div>
            <div style={{ width: 600, height: 600 }}>
              <PlotlyChart
                data={corrChartData}
                layout={corrLayout}
                filename="correlation_heatmap"
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
