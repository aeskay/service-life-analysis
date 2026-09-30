/**
 * DetailModal.jsx — Row detail popup with Previous/Next/Close navigation
 */
import React, { useEffect, useCallback } from 'react';

const HIGHLIGHTED_KEYS = ['ID', 'HIGHWAY', 'S/N', '_direction'];

const DISPLAY_KEY_MAP = {
  'ID':              'Record ID',
  'S/N':             'Serial Number',
  'HIGHWAY':         'Highway',
  '_direction':      'Direction',
  '_flagged':        'PMIS Flag',
  '_originalHighway':'Original Highway',
};

const HIDDEN_KEYS = ['_originalSN'];

function formatValue(key, value) {
  if (value === null || value === undefined || value === '') return null;
  if (key === '_flagged') return value ? '⚠ Not in PMIS' : '✓ Verified in PMIS';
  if (key === '_direction') return value === 'L' ? '← Left (L)' : '→ Right (R)';
  return String(value);
}

export default function DetailModal({ rows, currentIndex, onClose, onPrev, onNext }) {
  const row = rows[currentIndex];

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') onPrev();
    if (e.key === 'ArrowRight') onNext();
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!row) return null;

  const entries = Object.entries(row).filter(([k]) => !HIDDEN_KEYS.includes(k));

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Row detail"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        {/* Header */}
        <div className="modal__header">
          <div className="modal__title">
            <span className="modal__title-main">
              Record Detail
              {row._flagged && (
                <span
                  className="status-badge status-badge--warning"
                  style={{ marginLeft: 12, fontSize: 11 }}
                >
                  ⚠ Not in PMIS
                </span>
              )}
            </span>
            <span className="modal__title-sub">
              ID: {row.ID} · Highway: {row.HIGHWAY}
            </span>
          </div>
          <button
            id="modal-close-btn"
            className="modal__close"
            onClick={onClose}
            aria-label="Close modal"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l12 12M13 1L1 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal__body">
          <div className="modal__fields">
            {entries.map(([key, value]) => {
              const displayKey = DISPLAY_KEY_MAP[key] || key;
              const displayValue = formatValue(key, value);
              const isHighlighted = HIGHLIGHTED_KEYS.includes(key);
              const isEmpty = displayValue === null;
              const isFlagKey = key === '_flagged';

              return (
                <div
                  key={key}
                  className={`modal__field${isHighlighted ? ' highlighted' : ''}`}
                >
                  <div className="modal__field-key">{displayKey}</div>
                  <div
                    className={`modal__field-value${isEmpty ? ' empty' : ''}`}
                    style={
                      isFlagKey
                        ? { color: value ? 'var(--warning)' : 'var(--success)', fontFamily: 'var(--font-sans)' }
                        : key === '_direction'
                        ? { color: value === 'L' ? 'var(--info)' : '#a855f7', fontWeight: 700 }
                        : undefined
                    }
                  >
                    {displayValue ?? '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer with navigation */}
        <div className="modal__footer">
          <div className="modal__nav">
            <button
              id="modal-prev-btn"
              className="btn btn--secondary btn--sm"
              onClick={onPrev}
              disabled={currentIndex === 0}
              title="Previous record (← arrow key)"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M10 4L6 8l4 4" />
              </svg>
              Previous
            </button>
            <span className="modal__counter">
              {currentIndex + 1} / {rows.length}
            </span>
            <button
              id="modal-next-btn"
              className="btn btn--secondary btn--sm"
              onClick={onNext}
              disabled={currentIndex === rows.length - 1}
              title="Next record (→ arrow key)"
            >
              Next
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 4l4 4-4 4" />
              </svg>
            </button>
          </div>
          <button
            id="modal-close-footer-btn"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
