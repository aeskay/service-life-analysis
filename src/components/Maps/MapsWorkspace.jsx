import React, { useState, useEffect, useRef } from 'react';
import { loadState } from '../../utils/stateStore';

function StatsBadge({ label, count, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: color + '18', border: `1px solid ${color}40`,
      borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 600, color,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {count} {label}
    </span>
  );
}

function StaticMapPanel({ title, src, filename, stats }) {
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(true);
  const [imgKey, setImgKey] = useState(Date.now());

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src + '?t=' + imgKey;
    a.download = filename + '.png';
    a.click();
  };

  return (
    <details
      open={open}
      onToggle={e => setOpen(e.target.open)}
      style={{
        background: 'white',
        borderRadius: 8,
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <summary style={{
        padding: '14px 24px', cursor: 'pointer',
        backgroundColor: 'var(--bg-elevated)',
        borderBottom: open ? '1px solid var(--border-subtle)' : 'none',
        display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span style={{ fontSize: 15, fontWeight: 600, marginRight: 'auto' }}>{title}</span>
        {stats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {stats.total !== undefined && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                {stats.total} total sections
              </span>
            )}
            {stats.recon !== undefined && (
              <StatsBadge label="Reconstructed" count={stats.recon} color="#ef4444" />
            )}
            {stats.inSvc !== undefined && (
              <StatsBadge label="In Service" count={stats.inSvc} color="#22c55e" />
            )}
          </div>
        )}
      </summary>

      <div style={{ padding: 24 }}>
        {missing ? (
          <div style={{
            padding: 40, textAlign: 'center',
            border: '2px dashed var(--border-subtle)', borderRadius: 8,
            color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.8,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Map not generated yet</div>
            <div>Click <strong>Generate Maps</strong> above to create this map.</div>
          </div>
        ) : (
          <>
            {!loaded && (
              <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="loading-overlay__spinner" style={{ width: 28, height: 28 }} />
              </div>
            )}
            <img
              key={imgKey}
              src={src + '?t=' + imgKey}
              alt={title}
              onLoad={() => setLoaded(true)}
              onError={() => { setMissing(true); setLoaded(false); }}
              style={{
                width: '100%', height: 'auto',
                borderRadius: 6, border: '1px solid var(--border-subtle)',
                display: loaded ? 'block' : 'none',
              }}
            />
            {loaded && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn--secondary btn--sm" onClick={handleDownload}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Download PNG (300 DPI)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}

export default function MapsWorkspace({ mode, addToast }) {
  const [refreshKey, setRefreshKey]   = useState(0);
  const [generating, setGenerating]   = useState(false);
  const [progress, setProgress]       = useState([]);
  const [counts, setCounts]           = useState({ recon: 0, inSvc: 0 });
  const logRef = useRef(null);

  useEffect(() => {
    loadState().then(state => {
      const countVerified = (modeData) => {
        const verified = new Set(modeData.verifiedSNs || []);
        const verifiedRows = (modeData.pmisRows || []).filter(r => verified.has(r['ID'] || r['S/N']));
        const getBase = (id) => typeof id === 'string' ? id.replace(/[LR]$/i, '') : String(id);
        return new Set(verifiedRows.map(r => getBase(r['ID'] || r['S/N']))).size;
      };
      setCounts({
        recon: countVerified(state.reconstructed),
        inSvc: countVerified(state.inservice),
      });
    });
  }, [refreshKey]);

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress([]);
    window.electronAPI?.onMapGenProgress(line => {
      setProgress(prev => [...prev, line.trim()]);
      setTimeout(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, 0);
    });
    try {
      await window.electronAPI.generateMaps();
      addToast && addToast('Maps generated successfully!', 'success');
      setRefreshKey(k => k + 1);
    } catch (err) {
      addToast && addToast('Map generation failed: ' + err.message, 'error');
      setProgress(prev => [...prev, '❌ ' + err.message]);
    } finally {
      setGenerating(false);
      window.electronAPI?.offMapGenProgress();
    }
  };

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Section Locations</div>
        </div>
        <div className="workspace__toolbar-right" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--primary btn--sm" onClick={handleGenerate}
            disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {generating ? 'Generating…' : 'Generate Maps'}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => setRefreshKey(k => k + 1)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="workspace__body" style={{
        padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto',
      }}>
        {progress.length > 0 && (
          <div ref={logRef} style={{
            background: '#0f1117', borderRadius: 8, padding: '12px 16px',
            fontFamily: 'monospace', fontSize: 12, color: '#a3e635',
            maxHeight: 180, overflowY: 'auto', border: '1px solid #2a2d3a', lineHeight: 1.7,
          }}>
            {progress.map((line, i) => <div key={i}>{line}</div>)}
            {generating && <div style={{ color: '#60a5fa' }}>⏳ Running…</div>}
          </div>
        )}

        <StaticMapPanel key={`recon-${refreshKey}`} title="Reconstructed Only"
          src="/maps/reconstructed.png" filename="reconstructed"
          stats={{ total: counts.recon, recon: counts.recon }} />
        <StaticMapPanel key={`insvc-${refreshKey}`} title="In Service Only"
          src="/maps/inservice.png" filename="inservice"
          stats={{ total: counts.inSvc, inSvc: counts.inSvc }} />
        <StaticMapPanel key={`comb-${refreshKey}`} title="Reconstructed & In Service"
          src="/maps/combined.png" filename="combined"
          stats={{ total: counts.recon + counts.inSvc, recon: counts.recon, inSvc: counts.inSvc }} />
      </div>
    </div>
  );
}

