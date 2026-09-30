const fs = require('fs');
const file = 'src/components/Traffic/TrafficSlabBaseWorkspace.jsx';
let content = fs.readFileSync(file, 'utf8');

const logicToInsert = `
  const uniqueThicknessGroups = {};
  dataStats.reconScatterThickness.forEach(d => {
    if (!uniqueThicknessGroups[d.originalX]) uniqueThicknessGroups[d.originalX] = [];
    uniqueThicknessGroups[d.originalX].push(d.x / 1000000);
  });

  const sortedUniqueThicknesses = Object.keys(uniqueThicknessGroups).map(Number).sort((a, b) => a - b);
  const xDataUnique = [];
  const yDataUnique = [];
  const meanXUnique = [];
  const meanYUnique = [];

  sortedUniqueThicknesses.forEach(thickness => {
    const esals = uniqueThicknessGroups[thickness];
    const avg = esals.reduce((sum, val) => sum + val, 0) / esals.length;
    meanXUnique.push(thickness);
    meanYUnique.push(avg);

    esals.forEach(e => {
      xDataUnique.push(thickness);
      yDataUnique.push(e);
    });
  });

  const chartDataUnique = [
    {
      x: xDataUnique,
      y: yDataUnique,
      type: 'box',
      name: 'Cumulative ESAL',
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

  const layoutUnique = {
    xaxis: {
      title: { text: '<b>Slab Thickness (inches)</b>', font: { size: 28 } },
      tickmode: 'linear', dtick: 1,
      tickfont: { size: 22 }, tickangle: 0, ticks: 'inside', rangemode: 'normal',
      gridcolor: 'rgba(0,0,0,0.15)', gridwidth: 1, griddash: 'dash',
      showline: true, linewidth: 1, linecolor: 'black', mirror: true,
    },
    yaxis: {
      title: { text: '<b>Cumulative ESAL (millions)</b>', font: { size: 28 } },
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

  // Scatter Data (ESAL vs Base Thickness)`;

content = content.replace('  // Scatter Data (ESAL vs Base Thickness)', logicToInsert);

const jsxToInsert = `
        {/* ESAL vs Slab Thickness (Box Plot) */}
        <details style={{ background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', flexShrink: 0 }}>
          <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
            Cumulative ESAL vs. Slab Thickness
          </summary>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="stats-bar" style={{ display: 'flex', gap: 32, padding: '16px 24px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Analyzed Sections (Reconstructed Only)</div>
                <div style={{ fontSize: 20, fontWeight: 600 }}>{dataStats.reconScatterThickness.length}</div>
              </div>
            </div>

            <div style={{ height: 400 }}>
              <PlotlyChart
                data={chartDataUnique}
                layout={layoutUnique}
                filename="esal_vs_slabthickness_boxplot"
                config={{ responsive: true, displayModeBar: true }}
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </div>
        </details>

        {/* ESAL vs Slab Thickness (Scatter Plot) */}`;

content = content.replace('{/* ESAL vs Slab Thickness (Scatter Plot) */}', jsxToInsert);

fs.writeFileSync(file, content);
