/**
 * ErrorLogPanel.jsx — Collapsible error log for unmatched highways
 */
import React, { useState } from 'react';

const ChevronIcon = ({ up }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {up ? <path d="M3 9l4-4 4 4" /> : <path d="M3 5l4 4 4-4" />}
  </svg>
);

export default function ErrorLogPanel({ errors, onClear }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={`error-log ${expanded ? 'expanded' : 'collapsed'}`} role="region" aria-label="Error log">
      <div
        className="error-log__header"
        onClick={() => setExpanded(e => !e)}
        role="button"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') setExpanded(v => !v); }}
      >
        <div className="error-log__title">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style={{ color: 'var(--warning)' }}>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          PMIS Mismatch Log
          <span className="error-log__count">{errors.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          {errors.length > 0 && (
            <button
              id="error-log-clear-btn"
              className="btn btn--ghost btn--sm"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
              style={{ fontSize: 10, padding: '2px 8px' }}
            >
              Clear
            </button>
          )}
          <ChevronIcon up={expanded} />
        </div>
      </div>

      {expanded && (
        <div className="error-log__body">
          {errors.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', padding: 'var(--sp-2) 0' }}>
              ✓ No mismatches detected. All highways verified in PMIS.
            </div>
          ) : (
            errors.map((err, idx) => (
              <div key={`${err.sn}-${err.direction}-${idx}`} className="error-log__entry">
                <span className="error-log__entry-highway">{err.highway}</span>
                <span className="error-log__entry-desc">{err.message}</span>
                <span className="error-log__entry-source">S/N: {err.sn} · {err.direction}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
