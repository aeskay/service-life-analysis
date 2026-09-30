/**
 * exporter.js
 * Exports processed rows to a formatted .xlsx file via Electron IPC.
 */

import * as XLSX from 'xlsx';

/**
 * Export an array of row objects to an Excel file.
 * Strips internal "_" prefixed metadata columns before export.
 *
 * @param {Array<Object>} rows           - Processed data rows
 * @param {string}        defaultName    - Default filename suggestion
 * @returns {Promise<string|null>}       - Path where file was saved, or null if cancelled
 */
export async function exportToExcel(rows, defaultName) {
  if (!window.electronAPI) {
    throw new Error('Electron API not available.');
  }

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
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Split L-R');

  // Write to buffer
  const xlsxBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

  // Ask user where to save — dialog defaults to processed/ but user can browse anywhere
  const savePath = await window.electronAPI.showSaveDialog(defaultName);
  if (!savePath) return null;

  // Pass the FULL chosen path to the main process so the file lands exactly
  // where the user picked, even if they navigated outside processed/
  await window.electronAPI.writeExcel(
    savePath,
    Array.from(new Uint8Array(xlsxBuffer))
  );

  return savePath;
}

/**
 * Generate a timestamped default filename.
 */
export function generateExportFilename(mode = 'reconstructed') {
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `split_lr_${mode}_${ts}.xlsx`;
}
