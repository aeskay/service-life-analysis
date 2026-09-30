/**
 * normalizers.js
 * Contains string cleaning utilities for matching Districts and Highways
 * across different datasets (Excel vs PMIS).
 */

/**
 * Turns '02 - FORT WORTH' or 'FORTWORTH' into 'FORTWORTH'.
 * Removes leading numbers, dashes, AND all spaces.
 */
export function cleanDistrictString(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).toUpperCase().trim();
  // 1. Remove leading numbers and dashes (e.g., '02 - ')
  s = s.replace(/^[0-9\s-]+/, '');
  // 2. Remove ALL internal spaces
  s = s.replace(/\s+/g, '');
  return s;
}

/**
 * Standardizes highway names while KEEPING the roadbed (L/R).
 * Turns 'IH 0020 L' into 'IH20L'.
 */
export function normalizeHighway(val) {
  if (val === null || val === undefined) return '';
  let s = String(val).toUpperCase().trim();
  // Remove spaces and dashes
  s = s.replace(/[\s-]/g, '');
  
  // Remove leading zeros in the number part but keep the letter
  // e.g., IH0020L -> IH20L
  const match = s.match(/^([A-Z]+)0*(\d+)([A-Z]*)$/);
  if (match) {
    const prefix = match[1];
    const number = match[2];
    const suffix = match[3];
    return `${prefix}${number}${suffix}`;
  }
  return s;
}
