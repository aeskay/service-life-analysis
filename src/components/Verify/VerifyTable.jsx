/**
 * VerifyTable.jsx
 * Section list for the Verify Service Life tab.
 * Reuses the base column definitions from DataTable and adds a Verified column.
 */
import React from 'react';
import { ALL_COLUMNS, CellValue } from '../SplitLR/DataTable';

// Base columns shown by default in the verify table (same toggle system as the others)
export const VERIFY_COLUMNS = [];
for (const col of ALL_COLUMNS) {
  VERIFY_COLUMNS.push(col);
  if (col.key === 'Year Constructed') {
    VERIFY_COLUMNS.push({ key: '_actualYearConst', label: 'Actual Year Const.', className: 'col-num' });
  }
  if (col.key === 'End of Life') {
    VERIFY_COLUMNS.push({ key: '_actualEndOfLife', label: 'Actual End of Life', className: 'col-num' });
  }
  if (col.key === 'Service Life') {
    VERIFY_COLUMNS.push({ key: '_actualServiceLife', label: 'Actual Service Life', className: 'col-num' });
  }
}
VERIFY_COLUMNS.push({ key: '_verified', label: 'Verified', className: 'col-flag' });

export const VERIFY_DEFAULT_VISIBLE = new Set([
  'ID', 'S/N', 'HIGHWAY', '_direction', 'Year Constructed', '_actualYearConst', 'End of Life',
  '_actualEndOfLife', 'Service Life', '_actualServiceLife', 'DISTRICT', 'Begin Ref', 'End Ref', 'Old Slab Th', 'Slab Th', 'Base', 'Base Th', 'Sub', 'Rehab Method', '_flagged',
  '_verified',
]);

function VerifiedBadge({ verified }) {
  if (verified) {
    return <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 13 }} title="Verified">✓ Verified</span>;
  }
  return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>;
}

export default function VerifyTable({ rows, visibleKeys, onRowClick, verifiedSNs, actualEndOfLifeMap, actualYearConstMap, mode, selectedIds, onSelectRow, onSelectAll, activeColumns }) {
  if (!rows || rows.length === 0) return null;

  const isInService = mode === 'inservice';

  // Strip non-applicable columns based on mode
  const baseCols = activeColumns || VERIFY_COLUMNS;
  const cols = baseCols.filter(c => {
    if (isInService && (c.key === '_actualEndOfLife' || c.key === 'End of Life')) return false;
    if (!isInService && (c.key === '_actualYearConst')) return false;
    return visibleKeys.has(c.key);
  });

  return (
    <div className="table-container" role="region" aria-label="Verify Service Life table">
      <table className="data-table" id="verify-table">
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>
              <input
                type="checkbox"
                onChange={(e) => onSelectAll(e.target.checked)}
                checked={rows.length > 0 && selectedIds && selectedIds.size === rows.length}
                style={{ cursor: 'pointer' }}
              />
            </th>
            <th style={{ width: 40, textAlign: 'center' }}>#</th>
            {cols.map(col => <th key={col.key}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const uniqueId = row['ID'] || row['S/N'];
            const isVerified = verifiedSNs.has(uniqueId);
            const isSelected = selectedIds ? selectedIds.has(uniqueId) : false;
            return (
              <tr
                key={`${uniqueId}-${idx}`}
                id={`verify-row-${uniqueId}-${idx}`}
                className={[
                  row._flagged  ? 'flagged'  : '',
                  isVerified    ? 'verified' : '',
                  isSelected    ? 'selected' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => onRowClick(idx)}
                tabIndex={0}
                role="button"
                aria-label={`Row ${row.ID} — ${row.HIGHWAY}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(idx); }}
              >
                <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds ? selectedIds.has(uniqueId) : false}
                    onChange={(e) => onSelectRow(uniqueId, e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 10, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                  {idx + 1}
                </td>
                {cols.map(col => {
                  let cellContent;
                  if (col.key === '_verified') {
                    cellContent = <VerifiedBadge verified={isVerified} />;
                  } else if (col.key === '_actualEndOfLife') {
                    const actualEOL = actualEndOfLifeMap?.[uniqueId];
                    const defaultEOL = row['End of Life'];
                    cellContent = (
                      <span style={{ fontWeight: actualEOL ? 700 : 'normal', color: actualEOL ? 'var(--accent-secondary)' : 'inherit' }}>
                        {actualEOL || defaultEOL || '—'}
                      </span>
                    );
                  } else if (col.key === '_actualYearConst') {
                    const actualYC = actualYearConstMap?.[uniqueId];
                    const defaultYC = row['Year Constructed'];
                    cellContent = (
                      <span style={{ fontWeight: actualYC ? 700 : 'normal', color: actualYC ? 'var(--accent-secondary)' : 'inherit' }}>
                        {actualYC || defaultYC || '—'}
                      </span>
                    );
                  } else if (col.key === '_actualServiceLife') {
                    let actualServiceLife = '—';
                    let hasOverride = false;
                    
                    if (isInService) {
                      const actualYC = actualYearConstMap?.[uniqueId];
                      hasOverride = !!actualYC;
                      const origYC = parseInt(row['Year Constructed'], 10);
                      const activeYC = hasOverride ? parseInt(actualYC, 10) : origYC;
                      const currentYear = new Date().getFullYear();
                      
                      if (!isNaN(activeYC)) {
                        actualServiceLife = currentYear - activeYC;
                      }
                    } else {
                      const actualEOL = actualEndOfLifeMap?.[uniqueId];
                      hasOverride = !!actualEOL;
                      const eolToUse = actualEOL || row['End of Life'];
                      const yearConst = parseInt(row['Year Constructed'], 10);
                      const eolVal = parseInt(eolToUse, 10);
                      if (!isNaN(yearConst) && !isNaN(eolVal)) {
                        actualServiceLife = eolVal - yearConst;
                      }
                    }
                    
                    cellContent = (
                      <span style={{ fontWeight: hasOverride ? 700 : 'normal', color: hasOverride ? 'var(--accent-secondary)' : 'inherit' }}>
                        {actualServiceLife !== '—' ? `${actualServiceLife} yrs` : '—'}
                      </span>
                    );
                  } else {
                    cellContent = <CellValue col={col} value={row[col.key]} />;
                  }

                  return (
                    <td key={col.key} className={col.className}>
                      {cellContent}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
