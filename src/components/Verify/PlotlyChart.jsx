/**
 * PlotlyChart.jsx — React wrapper around Plotly.js.
 * Uses a static import so Vite pre-bundles plotly.js-dist-min at startup
 * (avoids the mid-session dep-optimization restart that drops the HMR connection).
 */
import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

const copyIcon = {
  width: 24,
  height: 24,
  path: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z'
};

const DEFAULT_CONFIG = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['sendDataToCloud', 'editInChartStudio', 'lasso2d', 'select2d'],
  modeBarButtonsToAdd: [
    {
      name: 'Copy to Clipboard',
      icon: copyIcon,
      click: function(gd) {
        Plotly.toImage(gd, { format: 'png', height: 600, width: 1100, scale: 2 }).then(function(dataUrl) {
          fetch(dataUrl)
            .then(res => res.blob())
            .then(blob => {
              navigator.clipboard.write([
                new ClipboardItem({ [blob.type]: blob })
              ]).then(() => {
                window.dispatchEvent(new CustomEvent('app-toast', {
                  detail: {
                    type: 'success',
                    title: 'Chart Copied',
                    desc: 'Chart copied to clipboard! You can now paste it directly into PowerPoint or Word.'
                  }
                }));
              }).catch(err => {
                console.error('Failed to copy chart: ', err);
                window.dispatchEvent(new CustomEvent('app-toast', {
                  detail: {
                    type: 'error',
                    title: 'Copy Failed',
                    desc: 'Failed to copy chart to clipboard.'
                  }
                }));
              });
            });
        });
      }
    }
  ],
  toImageButtonOptions: {
    format: 'png',
    filename: 'chart',
    height: 600,
    width: 1100,
    scale: 2,
  },
};

export default function PlotlyChart({ data, layout, config, style, filename }) {
  const divRef = useRef(null);

  useEffect(() => {
    if (!divRef.current) return;
    const cfg = {
      ...DEFAULT_CONFIG,
      ...(config || {}),
      toImageButtonOptions: {
        ...DEFAULT_CONFIG.toImageButtonOptions,
        filename: filename || 'chart',
        ...(config?.toImageButtonOptions || {}),
      },
    };
    // Plotly.react efficiently diffs and updates (or creates) the chart
    Plotly.react(divRef.current, data, layout, cfg);
  }); // intentionally no deps — re-run on every render since data/layout are new objects

  // Purge chart on unmount to free WebGL/canvas resources
  useEffect(() => {
    const div = divRef.current;
    return () => { if (div) Plotly.purge(div); };
  }, []);

  return <div ref={divRef} style={{ width: '100%', minHeight: 350, ...style }} />;
}
