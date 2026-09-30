/**
 * MatchPMISTable.jsx
 * Data table for the PMIS matching results.
 * Shows metadata columns followed by dynamic year columns (1996-2024).
 * Empty PMIS matches are highlighted in light red.
 */
import React from 'react';
import { ALL_COLUMNS, CellValue } from '../SplitLR/DataTable';

export default function MatchPMISTable({ rows, availableYears, visibleKeys, onRowClick, activeColumns }) {
  if (!rows || rows.length === 0) return null;

  // Filter the base columns based on what's toggled ON
  const baseCols = activeColumns || ALL_COLUMNS;
  const activeBaseColumns = baseCols.filter(c => visibleKeys.has(c.key));
  const showYears = visibleKeys.has('pmis_years');

  return (
    <div className="table-container" role="region" aria-label="PMIS Match data table">
      <table className="data-table" id="pmis-match-table">
        <thead>
          <tr>
            <th style={{ width: 40, textAlign: 'center' }}>#</th>
            
            {/* Dynamic Base Columns */}
            {activeBaseColumns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
            
            {/* Dynamic Year Columns */}
            {showYears && availableYears.map(year => (
              <th key={year}>{year}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr 
              key={row.ID || idx}
              id={`row-${row.ID || idx}`}
              className={row._flagged ? 'flagged' : ''}
              onClick={() => onRowClick && onRowClick(idx)}
              tabIndex={0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick && onRowClick(idx);
                }
              }}
            >
              <td style={{ color: 'var(--text-muted)', fontSize: 10, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                {idx + 1}
              </td>
              
              {/* Dynamic Base Cells */}
              {activeBaseColumns.map((col) => (
                <td key={col.key} className={col.className}>
                  <CellValue col={col} value={row[col.key]} />
                </td>
              ))}
              
              {/* Year Data Cells */}
              {showYears && availableYears.map(year => {
                const val = row[year];
                if (val === null) {
                  return (
                    <td key={year} style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                      {/* Empty cell with red background */}
                    </td>
                  );
                }
                return (
                  <td key={year} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--success)' }}>
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
