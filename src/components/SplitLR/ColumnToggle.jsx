/**
 * ColumnToggle.jsx
 * Excel-style column visibility chooser.
 *
 * Renders a button that opens a dropdown panel with a checkbox for every
 * column.  Supports "Select All" / "Deselect All" and shows how many
 * columns are currently hidden in the button label.
 *
 * Props:
 *   allColumns    {Array}    - Full ordered column list (key + label)
 *   visibleKeys   {Set}      - Set of currently visible column keys
 *   onChange      {Function} - Called with the new Set<string> of visible keys
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

const ColumnsIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
    <path d="M3 5h14M3 10h14M3 15h14" />
    <rect x="7" y="3" width="6" height="14" rx="1" fill="currentColor" opacity="0.15" stroke="none"/>
  </svg>
);

const ChevronDown = ({ up }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="12" height="12"
    style={{ transition: 'transform 0.2s ease', transform: up ? 'rotate(180deg)' : 'rotate(0deg)' }}>
    <path d="M4 6l4 4 4-4" />
  </svg>
);

export default function ColumnToggle({ allColumns, visibleKeys, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // ─── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // ─── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  // ─── Derived counts ─────────────────────────────────────────────────────────
  const totalCount   = allColumns.length;
  const visibleCount = allColumns.filter(c => visibleKeys.has(c.key)).length;
  const hiddenCount  = totalCount - visibleCount;
  const allChecked   = hiddenCount === 0;
  const noneChecked  = visibleCount === 0;

  // ─── Toggle a single column ─────────────────────────────────────────────────
  const toggleColumn = useCallback((key) => {
    const next = new Set(visibleKeys);
    if (next.has(key)) {
      // Prevent hiding the very last visible column
      if (next.size <= 1) return;
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  }, [visibleKeys, onChange]);

  // ─── Select / Deselect All ──────────────────────────────────────────────────
  const selectAll = useCallback(() => {
    onChange(new Set(allColumns.map(c => c.key)));
  }, [allColumns, onChange]);

  const deselectAll = useCallback(() => {
    // Always keep at least the first column visible
    onChange(new Set([allColumns[0].key]));
  }, [allColumns, onChange]);

  return (
    <div className="col-toggle" ref={containerRef}>
      <button
        id="column-toggle-btn"
        className={`btn btn--secondary${open ? ' col-toggle__btn--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Show / hide columns"
      >
        <ColumnsIcon />
        Columns
        {hiddenCount > 0 && (
          <span className="col-toggle__hidden-badge">{hiddenCount} hidden</span>
        )}
        <ChevronDown up={open} />
      </button>

      {open && (
        <div className="col-toggle__panel" role="listbox" aria-label="Column visibility">
          {/* Header with Select All / Deselect All */}
          <div className="col-toggle__header">
            <span className="col-toggle__header-title">
              {visibleCount} / {totalCount} columns visible
            </span>
            <div className="col-toggle__header-actions">
              <button
                className="col-toggle__link"
                onClick={selectAll}
                disabled={allChecked}
              >
                All
              </button>
              <span style={{ color: 'var(--text-muted)' }}>·</span>
              <button
                className="col-toggle__link"
                onClick={deselectAll}
                disabled={noneChecked}
              >
                None
              </button>
            </div>
          </div>

          {/* Column list */}
          <div className="col-toggle__list">
            {allColumns.map((col, idx) => {
              const checked = visibleKeys.has(col.key);
              const isLast  = checked && visibleCount === 1; // can't uncheck last
              return (
                <label
                  key={col.key}
                  className={`col-toggle__item${checked ? ' col-toggle__item--checked' : ''}`}
                  title={isLast ? 'At least one column must be visible' : undefined}
                >
                  <input
                    type="checkbox"
                    className="col-toggle__checkbox"
                    checked={checked}
                    disabled={isLast}
                    onChange={() => toggleColumn(col.key)}
                    id={`col-toggle-${col.key}`}
                  />
                  <span className="col-toggle__check-icon" aria-hidden="true">
                    {checked ? '✓' : ''}
                  </span>
                  <span className="col-toggle__item-label">{col.label}</span>
                  <span className="col-toggle__item-idx">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
