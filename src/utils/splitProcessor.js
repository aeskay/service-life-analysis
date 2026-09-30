/**
 * splitProcessor.js
 * Core data processing logic for the Split L/R module.
 *
 * Highway naming rules:
 *   - If highway name ends in a directional letter (N, S, E, W), append direction directly: "IH0035WL"
 *   - Otherwise, append a space then the direction: "IH0010 L"
 *
 * ID generation:
 *   - Concatenate the original S/N value with the direction letter: "1L", "42R"
 */

import { normalizeHighway } from './normalizers';

const DIRECTIONAL_SUFFIXES = new Set(['N', 'S', 'E', 'W']);

/**
 * Strips any existing roadbed direction ('L' or 'R') from a highway string.
 * Examples:
 *   "IH0610 L"  -> "IH0610"
 *   "IH0610 R"  -> "IH0610"
 *   "IH0035WL"  -> "IH0035W"
 *   "IH0035WR"  -> "IH0035W"
 *   "IH0010L"   -> "IH0010"
 *   "IH0010"    -> "IH0010"
 * @param {string} highway
 * @returns {string}
 */
export function stripHighwayDirection(highway) {
  if (!highway || typeof highway !== 'string') return highway || '';
  const trimmed = highway.trim();
  // Case 1: Trailing space followed by L or R, e.g. "IH0610 L" or "IH0610-L"
  if (/[\s_-]+[LR]$/i.test(trimmed)) {
    return trimmed.replace(/[\s_-]+[LR]$/i, '').trim();
  }
  // Case 2: Directional suffix followed by L or R, e.g. "IH0035WL" -> "IH0035W"
  if (/[0-9]+[NEWS][LR]$/i.test(trimmed)) {
    return trimmed.slice(0, -1);
  }
  // Case 3: Digits directly followed by L or R, e.g. "IH0010L" -> "IH0010"
  if (/[0-9]+[LR]$/i.test(trimmed)) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

/**
 * Determine whether to append direction with or without a space.
 * Safely strips any existing direction first so calling it multiple times is idempotent.
 * @param {string} highway - Original highway name (e.g. "IH0035W", "IH0010", "IH0610 L")
 * @param {'L'|'R'} direction
 * @returns {string}
 */
export function splitHighway(highway, direction) {
  if (!highway || typeof highway !== 'string') return `${highway || ''} ${direction}`.trim();
  const dirUpper = String(direction).toUpperCase();
  const base = stripHighwayDirection(highway);
  const lastChar = base.slice(-1).toUpperCase();
  if (DIRECTIONAL_SUFFIXES.has(lastChar)) {
    return base + dirUpper;       // e.g. IH0035W → IH0035WL
  }
  return base + ' ' + dirUpper;  // e.g. IH0010 → IH0010 L
}

/**
 * Generate the primary key ID for a split row.
 * Safely handles S/N that might already have an L/R suffix.
 * @param {string|number} sn - Original S/N value
 * @param {'L'|'R'} direction
 * @returns {string}
 */
export function generateID(sn, direction) {
  const dirUpper = String(direction).toUpperCase();
  if (sn === null || sn === undefined || sn === '') return dirUpper;
  const snStr = String(sn).trim();
  if (/[_\s-]?[LR]$/i.test(snStr)) {
    return snStr.replace(/[_\s-]?[LR]$/i, '') + dirUpper;
  }
  return `${snStr}${dirUpper}`;
}

/**
 * Detect whether a row has already been split into L or R.
 * Checks ID (e.g. "1L", "1R"), Direction column, S/N column, and HIGHWAY column.
 * @param {Object} row
 * @returns {{ isSplit: boolean, direction: 'L'|'R'|null, baseSN: string, id: string }}
 */
export function detectSplitInfo(row) {
  if (!row || typeof row !== 'object') {
    return { isSplit: false, direction: null, baseSN: '', id: '' };
  }

  // 1. Explicit direction column
  const rawDir = String(row['_direction'] ?? row['Direction'] ?? row['direction'] ?? row['DIRECTION'] ?? '').trim().toUpperCase();
  if (rawDir === 'L' || rawDir === 'R') {
    const rawId = String(row['ID'] ?? row['Id'] ?? row['id'] ?? '').trim();
    const rawSn = String(row['S/N'] ?? row['SN'] ?? row['sn'] ?? '').trim();
    const baseSN = rawSn.replace(/[_\s-]?[LR]$/i, '') || rawId.replace(/[_\s-]?[LR]$/i, '');
    return {
      isSplit: true,
      direction: rawDir,
      baseSN: baseSN || rawSn,
      id: rawId || generateID(baseSN || rawSn, rawDir),
    };
  }

  // 2. ID column (e.g. "1L", "1R", "11L", "24R", "1-L", etc.)
  const rawId = String(row['ID'] ?? row['Id'] ?? row['id'] ?? '').trim();
  if (rawId) {
    const idMatch = rawId.match(/^(.+?)[_\s-]?([LR])$/i);
    if (idMatch) {
      const dir = idMatch[2].toUpperCase();
      const base = idMatch[1].trim();
      const rawSn = String(row['S/N'] ?? row['SN'] ?? row['sn'] ?? '').trim();
      const baseSN = rawSn ? rawSn.replace(/[_\s-]?[LR]$/i, '') : base;
      return {
        isSplit: true,
        direction: dir,
        baseSN: baseSN || base,
        id: rawId.toUpperCase(),
      };
    }
  }

  // 3. S/N column (e.g. S/N: "1L", "2R")
  const rawSn = String(row['S/N'] ?? row['SN'] ?? row['sn'] ?? '').trim();
  if (rawSn) {
    const snMatch = rawSn.match(/^(\d+)[_\s-]?([LR])$/i);
    if (snMatch) {
      const dir = snMatch[2].toUpperCase();
      const base = snMatch[1];
      return {
        isSplit: true,
        direction: dir,
        baseSN: base,
        id: rawId || generateID(base, dir),
      };
    }
  }

  // 4. Highway column ending with space+L/R or directional+L/R (e.g. "IH0610 L", "IH0035WL")
  const rawHwy = String(row['HIGHWAY'] ?? row['Highway'] ?? '').trim();
  if (rawHwy) {
    const hwyMatch = rawHwy.match(/[\s_-]+([LR])$/i) || rawHwy.match(/[0-9]+[NEWS]([LR])$/i);
    if (hwyMatch) {
      const dir = hwyMatch[1].toUpperCase();
      const baseSN = rawSn ? rawSn.replace(/[_\s-]?[LR]$/i, '') : (rawId ? rawId.replace(/[_\s-]?[LR]$/i, '') : '');
      return {
        isSplit: true,
        direction: dir,
        baseSN: baseSN || rawSn,
        id: rawId || generateID(baseSN || rawSn, dir),
      };
    }
  }

  return { isSplit: false, direction: null, baseSN: rawSn, id: rawId };
}

/**
 * Process source rows, splitting each unsplit row into L and R entries,
 * or preserving already-split rows without duplicating them.
 *
 * @param {Array<Object>}  sourceRows        - Rows from the source Excel file
 * @param {Set<string>}    pmisHighways      - Set of all highway IDs from PMIS.csv
 * @param {Set<string>}    alreadyProcessed  - Set of S/N or ID values already processed (persisted)
 * @param {Array<string>}  previousErrors    - S/N or ID values that errored last time (should reprocess)
 * @returns {{ rows: Array<Object>, errors: Array<Object>, newlyProcessed: Set<string> }}
 */
export function processRows(sourceRows, pmisHighways, alreadyProcessed, previousErrors = []) {
  const outputRows = [];
  const errors = [];
  const newlyProcessed = new Set();
  const errorSNs = new Set(previousErrors);

  for (const row of sourceRows) {
    const splitInfo = detectSplitInfo(row);
    const snRaw = String(row['S/N'] ?? row['SN'] ?? row['sn'] ?? '').trim();
    const idRaw = String(row['ID'] ?? row['Id'] ?? row['id'] ?? '').trim();

    // Determine the base S/N (e.g. "1" from "1L" or 1)
    const baseSN = splitInfo.isSplit
      ? (splitInfo.baseSN || (snRaw ? snRaw.replace(/[_\s-]?[LR]$/i, '') : '') || idRaw.replace(/[_\s-]?[LR]$/i, ''))
      : snRaw;

    if (splitInfo.isSplit) {
      // ─── ALREADY SPLIT ROW ──────────────────────────────────────────────────
      // This row is already an individual split row (L or R).
      // DO NOT split it into two rows. Process it as a single row.
      const direction = splitInfo.direction;
      const targetID = splitInfo.id || idRaw || generateID(baseSN, direction);
      const trackingKey = targetID;

      // Skip if already processed without error
      if ((alreadyProcessed.has(trackingKey) || (baseSN && alreadyProcessed.has(baseSN))) &&
          !errorSNs.has(trackingKey) && !errorSNs.has(baseSN)) {
        continue;
      }

      const currentHighway = String(row['HIGHWAY'] ?? row['Highway'] ?? '').trim();
      const originalHighway = stripHighwayDirection(currentHighway);
      // Ensure highway has proper L/R format (idempotent)
      const newHighway = splitHighway(originalHighway, direction);

      const normalizedCheck = normalizeHighway(newHighway);
      const inPMIS = pmisHighways.has(normalizedCheck);

      let rowHadError = false;
      if (!inPMIS) {
        rowHadError = true;
        errors.push({
          highway: newHighway,
          originalHighway,
          sn: targetID,
          direction,
          message: `Highway "${newHighway}" not found in PMIS dataset`,
        });
      }

      outputRows.push({
        ...row,
        ID: targetID,
        'S/N': row['S/N'] ?? baseSN,
        HIGHWAY: newHighway,
        _direction: direction,
        _flagged: !inPMIS,
        _originalHighway: originalHighway,
        _originalSN: baseSN,
      });

      if (!rowHadError) {
        newlyProcessed.add(targetID);
        if (baseSN) newlyProcessed.add(baseSN);
      }
    } else {
      // ─── UNSPLIT ROW ────────────────────────────────────────────────────────
      // Traditional row: split into both L and R entries.
      const sn = baseSN || snRaw;

      // Skip if already successfully processed (not in error list)
      if (alreadyProcessed.has(sn) && !errorSNs.has(sn)) {
        continue;
      }

      const originalHighway = String(row['HIGHWAY'] ?? row['Highway'] ?? '').trim();
      let rowHadError = false;

      for (const direction of ['L', 'R']) {
        const newHighway = splitHighway(originalHighway, direction);
        const newID = generateID(sn, direction);
        const normalizedCheck = normalizeHighway(newHighway);
        const inPMIS = pmisHighways.has(normalizedCheck);

        if (!inPMIS) {
          rowHadError = true;
          errors.push({
            highway: newHighway,
            originalHighway,
            sn,
            direction,
            message: `Highway "${newHighway}" not found in PMIS dataset`,
          });
        }

        outputRows.push({
          ...row,
          ID: newID,
          'S/N': row['S/N'] ?? sn,
          HIGHWAY: newHighway,
          _direction: direction,
          _flagged: !inPMIS,
          _originalHighway: originalHighway,
          _originalSN: sn,
        });
      }

      if (!rowHadError) {
        newlyProcessed.add(sn);
      }
    }
  }

  return { rows: outputRows, errors, newlyProcessed };
}

/**
 * Merge new processed rows with existing processed rows, avoiding full reprocess duplicates.
 * @param {Array<Object>} existingRows   - Previously processed rows (may be partially complete)
 * @param {Array<Object>} newRows        - Newly generated rows from this run
 * @param {Set<string>}   reprocessedSNs - S/N values or IDs that were reprocessed this run
 * @returns {Array<Object>}
 */
export function mergeRows(existingRows, newRows, reprocessedSNs) {
  // Remove existing rows for S/Ns or IDs that were reprocessed
  const filtered = existingRows.filter(r => {
    const origSN = String(r._originalSN ?? r['S/N'] ?? '');
    const rowId = String(r.ID ?? '');
    return !reprocessedSNs.has(origSN) && !reprocessedSNs.has(rowId);
  });
  return [...filtered, ...newRows];
}
