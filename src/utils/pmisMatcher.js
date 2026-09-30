/**
 * pmisMatcher.js
 * Algorithm for matching Split L/R rows against the PMIS database across years 1996-2024.
 */

import { cleanDistrictString, normalizeHighway } from './normalizers';

/**
 * Determine the alias column name for start and end ranges
 * based on the user's excel file headers.
 */
function getTargetRange(row) {
  const start = row['Begin Ref'];
  const end   = row['End Ref'];
  
  return {
    start: parseFloat(start),
    end: parseFloat(end),
  };
}

/**
 * Perform matching for all rows.
 * @param {Array<Object>} splitRows - The output from the Split L/R process.
 * @param {Map<string, Array<Object>>} pmisMap - The grouped PMIS data.
 * @param {Array<number>} availableYears - The dynamic years extracted from PMIS data.
 * @returns {Array<Object>} The matched rows ready for UI rendering.
 */
export function matchPMIS(splitRows, pmisMap, availableYears) {
  return splitRows.map(row => {
    const district = cleanDistrictString(row['DISTRICT']);
    const highway  = normalizeHighway(row['HIGHWAY']);
    const key = `${district}|${highway}`;

    const { start: targetStart, end: targetEnd } = getTargetRange(row);
    
    // Result object - Keep ALL original columns from the row
    const resultRow = {
      ...row,
    };

    // If no valid target range or no PMIS data for this district+highway
    if (isNaN(targetStart) || isNaN(targetEnd) || !pmisMap.has(key)) {
      availableYears.forEach(year => resultRow[year] = null);
      return resultRow;
    }

    const pmisData = pmisMap.get(key);

    // Group PMIS data by year
    const byYear = {};
    for (const p of pmisData) {
      if (!byYear[p.year]) byYear[p.year] = [];
      byYear[p.year].push(p);
    }

    // Evaluate overlap for each year
    availableYears.forEach(year => {
      const yearRows = byYear[year] || [];
      
      // Filter PMIS rows that overlap with the target range
      // (Using strict < and > per Python script logic)
      const overlapping = yearRows.filter(p => 
        (p.startRef < targetEnd) && (p.endRef > targetStart)
      );

      if (overlapping.length === 0) {
        resultRow[year] = null; // null indicates no match (red background in UI)
      } else {
        // Find the min start and max end of the overlapping segments
        const minStart = Math.min(...overlapping.map(p => p.startRef));
        const maxEnd   = Math.max(...overlapping.map(p => p.endRef));
        
        // Format to 3 decimal places to match Python script
        resultRow[year] = `${minStart.toFixed(3)}-${maxEnd.toFixed(3)}`;
      }
    });

    return resultRow;
  });
}
