/**
 * DataTable.jsx — Main data table for displaying split L/R rows.
 *
 * ALL_COLUMNS is exported so ColumnToggle can read the full column list.
 * The component accepts a `visibleKeys` Set to control which columns render.
 */
import React from 'react';

// Full ordered column definition — exported for use by ColumnToggle
export const ALL_COLUMNS = [
  { key: 'ID',               label: 'ID',              className: 'col-id'      },
  { key: 'S/N',              label: 'S/N',             className: ''            },
  { key: 'HIGHWAY',          label: 'Highway',         className: 'col-highway' },
  { key: '_direction',       label: 'Direction',       className: 'col-flag'    },
  { key: 'Year Constructed', label: 'Year Const.',     className: ''            },
  { key: 'End of Life',      label: 'End of Life',     className: ''            },
  { key: 'Service Life',     label: 'Service Life',    className: ''            },
  { key: 'DISTRICT',         label: 'District',        className: ''            },
  { key: 'COUNTY',           label: 'County',          className: ''            },
  { key: 'Original CSJ',     label: 'Original CSJ',    className: ''            },
  { key: 'Old Begin Ref',    label: 'Old Begin Ref',   className: ''            },
  { key: 'Old End Ref',      label: 'Old End Ref',     className: ''            },
  { key: 'Construction length', label: 'Const. Length', className: ''           },
  { key: 'Old Slab Th',      label: 'Old Slab Th',     className: ''            },
  { key: 'Slab Th',          label: 'Slab Th',         className: ''            },
  { key: 'Base',             label: 'Base',            className: ''            },
  { key: 'Base Th',          label: 'Base Th',         className: ''            },
  { key: 'Subgrade',         label: 'Subgrade',        className: ''            },
  { key: 'Sub',              label: 'Sub',             className: ''            },
  { key: 'Sub Th',           label: 'Sub Th',          className: ''            },
  { key: 'New CSJ',          label: 'New CSJ',         className: ''            },
  { key: 'New Begin Ref',    label: 'New Begin Ref',   className: ''            },
  { key: 'New End Ref',      label: 'New End Ref',     className: ''            },
  { key: 'Recon length',     label: 'Recon Length',    className: ''            },
  { key: 'Begin Ref',        label: 'Begin Ref',       className: ''            },
  { key: 'End Ref',          label: 'End Ref',         className: ''            },
  { key: 'Overlap Length',   label: 'Overlap Length',  className: ''            },
  { key: 'Start GPS',        label: 'Start GPS',       className: ''            },
  { key: 'End GPS',          label: 'End GPS',         className: ''            },
  { key: 'New Slab',         label: 'New Slab',        className: ''            },
  { key: 'Rehab Method',     label: 'Rehab Method',    className: ''            },
  { key: '_flagged',         label: 'PMIS Status',     className: 'col-flag'    },
];

// Default visible columns (shown on first launch)
export const DEFAULT_VISIBLE_KEYS = new Set([
  'ID', 'S/N', 'HIGHWAY', '_direction', 'Year Constructed', 'End of Life',
  'Service Life', 'DISTRICT', 'COUNTY', 'Begin Ref', 'End Ref', 'Old Slab Th', 'Slab Th', 'Base', 'Base Th', 'Sub',
  'New CSJ', 'Rehab Method', '_flagged',
]);

// ─── Sub-components ───────────────────────────────────────────────────────────
export function DirectionChip({ direction }) {
  return (
    <span className={`chip chip--direction-${(direction || '').toLowerCase()}`}>
      {direction || '?'}
    </span>
  );
}

export function PMISFlag({ flagged }) {
  if (flagged) {
    return (
      <span className="flag-icon" title="Not found in PMIS — requires review">⚠</span>
    );
  }
  return (
    <span style={{ color: 'var(--success)', fontSize: 13 }} title="Verified in PMIS">✓</span>
  );
}

export function CellValue({ col, value }) {
  if (col.key === '_direction') return <DirectionChip direction={value} />;
  if (col.key === '_flagged')   return <PMISFlag flagged={!!value} />;
  if (value === null || value === undefined || value === '') {
    return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  }
  return <>{String(value)}</>;
}

// ─── Main component ───────────────────────────────────────────────────────────
/**
 * @param {Array<Object>} rows        - Processed data rows
 * @param {Set<string>}   visibleKeys - Set of column keys to display
 * @param {Function}      onRowClick  - Called with row index when row is clicked
 */
export default function DataTable({
  rows,
  visibleKeys,
  onRowClick,
  activeColumns,
  selectedIds,
  onSelectRow,
  onSelectAll,
}) {
  if (!rows || rows.length === 0) return null;

  // Filter to only columns the user has enabled
  const baseCols = activeColumns || ALL_COLUMNS;
  const cols = baseCols.filter(c => !visibleKeys || visibleKeys.has(c.key));

  const allSelected = rows.length > 0 && selectedIds && selectedIds.size === rows.length;

  return (
    <div className="table-container" role="region" aria-label="Split L/R data table">
      <table className="data-table" id="split-lr-table">
        <thead>
          <tr>
            <th style={{ width: 36, textAlign: 'center' }}>
              <input
                type="checkbox"
                aria-label="Select all rows"
                onChange={(e) => onSelectAll && onSelectAll(e.target.checked)}
                checked={allSelected}
                style={{ cursor: 'pointer', width: 15, height: 15 }}
              />
            </th>
            <th style={{ width: 40, textAlign: 'center' }}>#</th>
            {cols.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const uniqueId = String(row.ID || row['S/N'] || idx);
            const isSelected = selectedIds ? selectedIds.has(uniqueId) : false;
            return (
              <tr
                key={row.ID || idx}
                id={`row-${row.ID || idx}`}
                className={[
                  row._flagged ? 'flagged' : '',
                  isSelected ? 'selected' : '',
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
                    aria-label={`Select row ${row.ID || idx}`}
                    checked={isSelected}
                    onChange={(e) => onSelectRow && onSelectRow(uniqueId, e.target.checked)}
                    style={{ cursor: 'pointer', width: 15, height: 15 }}
                  />
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 10, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                  {idx + 1}
                </td>
                {cols.map(col => (
                  <td key={col.key} className={col.className}>
                    <CellValue col={col} value={row[col.key]} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
