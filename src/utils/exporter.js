/**
 * exporter.js
 * Exports processed rows to a formatted .xlsx file natively in browser.
 */

import * as XLSX from 'xlsx';

/**
 * Export an array of row objects to an Excel file.
 * Strips internal "_" prefixed metadata columns before export.
 *
 * @param {Array<Object>} rows           - Processed data rows
 * @param {string}        defaultName    - Default filename suggestion
 * @returns {Promise<string|null>}       - Path or filename where saved
 */
export async function exportToExcel(rows, defaultName = 'export.xlsx') {
  if (!rows || rows.length === 0) return null;

  // Strip internal metadata columns
  const cleanRows = rows.map(row => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      if (!k.startsWith('_')) {
        clean[k] = v;
      }
    }
    return clean;
  });

  // Build workbook
  const worksheet = XLSX.utils.json_to_sheet(cleanRows);

  // Apply column widths based on header length
  const headers = Object.keys(cleanRows[0] || {});
  worksheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 12) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Export');

  // Write to buffer
  const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  // 1. Desktop Electron fallback if window.electronAPI is present
  if (window.electronAPI?.showSaveDialog && window.electronAPI?.writeExcel) {
    try {
      const savePath = await window.electronAPI.showSaveDialog(defaultName);
      if (!savePath) return null;
      await window.electronAPI.writeExcel(
        savePath,
        Array.from(new Uint8Array(xlsxBuffer))
      );
      return savePath;
    } catch (err) {
      console.warn('Desktop save dialog failed, falling back to browser download:', err);
    }
  }

  // 2. Pure Web Browser Download
  const blob = new Blob([xlsxBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return defaultName;
}

/**
 * Generate a timestamped default filename.
 */
export function generateExportFilename(mode = 'reconstructed') {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `split_lr_${mode}_${ts}.xlsx`;
}
