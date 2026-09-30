/**
 * useVerifyCharts.js
 * Pure data-transformation helpers for the Verify Service Life charts.
 * No React hooks — these are plain functions consumed by VerifyModal.
 */

import { cleanDistrictString, normalizeHighway } from '../utils/normalizers';

// ─── Y-Axis tick step calculator ───────────────────────────────────────────
// Picks the smallest "nice" step such that there are 5-8 ticks on the axis.
// E.g. maxVal=12 → step=2 → ticks 0,2,4,6,8,10,12,14
export function niceTickStep(maxVal) {
  if (!maxVal || maxVal <= 0) return 1;
  const targetTicks = 7;
  const roughStep = maxVal / targetTicks;
  const niceSteps = [
    0.1, 0.2, 0.25, 0.5,
    1, 2, 2.5, 5,
    10, 20, 25, 50,
    100, 200, 250, 500,
    1000, 2000, 5000,
  ];
  for (const s of niceSteps) {
    if (s >= roughStep) return s;
  }
  return niceSteps[niceSteps.length - 1];
}

// ─── Lookup helpers ────────────────────────────────────────────────────────
function getKey(row) {
  const district = cleanDistrictString(row['DISTRICT']);
  const highway  = normalizeHighway(row['HIGHWAY']);
  return `${district}|${highway}`;
}

function getRange(row) {
  return {
    start: parseFloat(row['Begin Ref']),
    end:   parseFloat(row['End Ref']),
  };
}

// ─── Filter PMIS records that overlap the section's range ─────────────────
function getOverlapping(pmisDetailMap, row) {
  const key = getKey(row);
  const { start, end } = getRange(row);
  if (isNaN(start) || isNaN(end) || !pmisDetailMap.has(key)) return [];
  return pmisDetailMap.get(key).filter(
    p => p.startRef < end && p.endRef > start
  );
}

// ─── Chart 1: Evaluation Scores ───────────────────────────────────────────
// Weighted averages of Distress Score, Condition Score, Ride Score by CALCULATED LENGTH.
export function buildEvalData(pmisDetailMap, row) {
  const records = getOverlapping(pmisDetailMap, row);
  if (!records.length) return null;

  const { start, end } = getRange(row);
  const byYear = {};
  
  for (const p of records) {
    if (!byYear[p.year]) {
      byYear[p.year] = { 
        wDistress: 0, wCondition: 0, wRide: 0, wIri: 0, 
        lenDistress: 0, lenCondition: 0, lenRide: 0, lenIri: 0 
      };
    }
    const y = byYear[p.year];
    
    // Calculate exact overlap
    const overlapStart = Math.max(start, p.startRef);
    const overlapEnd = Math.min(end, p.endRef);
    const w = Math.max(0, overlapEnd - overlapStart);
    
    if (w > 0) {
      if (p.distressScore  !== null) { y.wDistress  += p.distressScore  * w; y.lenDistress += w; }
      if (p.conditionScore !== null) { y.wCondition += p.conditionScore * w; y.lenCondition += w; }
      if (p.rideScore      !== null) { y.wRide      += p.rideScore      * w; y.lenRide += w; }
      if (p.iri            !== null) { y.wIri       += p.iri            * w; y.lenIri += w; }
    }
  }

  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  return {
    years,
    distressScore:  years.map(y => byYear[y].lenDistress  > 0 ? byYear[y].wDistress  / byYear[y].lenDistress  : null),
    conditionScore: years.map(y => byYear[y].lenCondition > 0 ? byYear[y].wCondition / byYear[y].lenCondition : null),
    rideScore:      years.map(y => byYear[y].lenRide      > 0 ? byYear[y].wRide      / byYear[y].lenRide      : null),
    iriScore:       years.map(y => byYear[y].lenIri       > 0 ? byYear[y].wIri       / byYear[y].lenIri       : null),
  };
}

// ─── Chart 2: Distress Counts per Centerline Mile ─────────────────────────
// Sum each distress type per year, divide by total CALCULATED LENGTH.
export function buildDistressData(pmisDetailMap, row) {
  const records = getOverlapping(pmisDetailMap, row);
  if (!records.length) return null;

  const { start, end } = getRange(row);
  const byYear = {};
  
  for (const p of records) {
    if (!byYear[p.year]) byYear[p.year] = { acp: 0, pcc: 0, punch: 0, spall: 0, len: 0 };
    const y = byYear[p.year];
    
    // Calculate exact overlap
    const overlapStart = Math.max(start, p.startRef);
    const overlapEnd = Math.min(end, p.endRef);
    const w = Math.max(0, overlapEnd - overlapStart);
    
    // Full segment length (to apportion distresses correctly)
    const segLen = Math.max(0.001, p.endRef - p.startRef);
    
    if (w > 0) {
      const ratio = w / segLen;
      y.acp   += (p.acpPatches    || 0) * ratio;
      y.pcc   += (p.pccPatches    || 0) * ratio;
      y.punch += (p.punchout      || 0) * ratio;
      y.spall += (p.spalledCracks || 0) * ratio;
      y.len   += w;
    }
  }

  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const safe  = (n, d) => (d > 0 ? n / d : null);

  const acpPerMile   = years.map(y => safe(byYear[y].acp,   byYear[y].len));
  const pccPerMile   = years.map(y => safe(byYear[y].pcc,   byYear[y].len));
  const punchPerMile = years.map(y => safe(byYear[y].punch, byYear[y].len));
  const spallPerMile = years.map(y => safe(byYear[y].spall, byYear[y].len));

  const allVals = [...acpPerMile, ...pccPerMile, ...punchPerMile, ...spallPerMile].filter(v => v !== null);
  const maxVal  = allVals.length ? Math.max(...allVals) : 0;
  const step    = niceTickStep(maxVal);
  const yMax    = Math.ceil((maxVal + step * 0.5) / step) * step;

  return { years, acpPerMile, pccPerMile, punchPerMile, spallPerMile, yMax, step };
}
