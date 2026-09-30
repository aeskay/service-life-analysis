/**
 * fileLoader.js
 * Handles all file loading via Electron IPC bridge.
 * Uses SheetJS for .xlsx and PapaParse for .csv
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { loadUIPrefs } from './uiPreferences';
import { cleanDistrictString, normalizeHighway } from './normalizers';

let cachedPMISHighways = null;
let cachedPMISMap = null;

export function clearPMISCache() {
  cachedPMISHighways = null;
  cachedPMISMap = null;
}

export function getPMISTrendsSync() {
  return cachedPMISMap ? cachedPMISMap.pmisTrends : null;
}

export function getPMISDistributionsSync() {
  return cachedPMISMap ? cachedPMISMap.pmisDistributions : null;
}

async function parseExcelBuffer(bufferArray) {
  const uint8 = new Uint8Array(bufferArray);
  const workbook = XLSX.read(uint8, { type: 'array' });

  const firstSheet = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheet];

  // Convert to JSON, using raw values, preserving empty cells as null
  return XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false,
  });
}

/**
 * Load an Excel file through the Electron IPC bridge.
 * @param {string} filename - Filename in raw-files/ (e.g. "repaired.xlsx")
 * @param {string} [customPath] - Optional override path
 * @returns {Promise<Array<Object>>} Array of row objects (first sheet)
 */
async function loadExcelFile(filename, customPath) {
  if (!window.electronAPI) {
    throw new Error('Electron API not available. Run via Electron.');
  }

  const bufferArray = await window.electronAPI.readFileBuffer(filename, customPath);
  return parseExcelBuffer(bufferArray);
}

export async function loadRepaired() {
  const prefs = await loadUIPrefs();
  return loadExcelFile('repaired.xlsx', prefs.sourceFiles?.repaired);
}

export async function loadInService() {
  const prefs = await loadUIPrefs();
  return loadExcelFile('in-service.xlsx', prefs.sourceFiles?.inservice);
}

/**
 * Load and parse PMIS.csv, extracting unique highway IDs.
 * The relevant column is "SIGNED HWY AND ROADBED ID".
 * @returns {Promise<Set<string>>} Set of unique highway strings
 */
export async function loadPMISHighways() {
  if (cachedPMISHighways) return cachedPMISHighways;

  if (!window.electronAPI) {
    throw new Error('Electron API not available. Run via Electron.');
  }

  const prefs = await loadUIPrefs();
  const customPath = prefs.sourceFiles?.pmis;

  const csvText = await window.electronAPI.readPmisText(customPath);

  return new Promise((resolve, reject) => {
    const highwaySet = new Set();

    Papa.parse(csvText, {
      header: true,
      encoding: 'latin1',
      skipEmptyLines: true,
      step: (result) => {
        const row = result.data;
        // Primary lookup column
        const val = row['SIGNED HWY AND ROADBED ID'];
        if (val && typeof val === 'string') {
          highwaySet.add(normalizeHighway(val));
        }
        // Also index HIGHWAY ROADBED ID as secondary
        const val2 = row['HIGHWAY ROADBED ID'];
        if (val2 && typeof val2 === 'string' && val2.trim()) {
          highwaySet.add(normalizeHighway(val2));
        }
      },
      complete: () => resolve(highwaySet),
      error: (err) => reject(err),
    });
  });
}

/**
 * Return the cached PMIS detail map (same map used for matching, now with
 * extra score/distress fields stored per entry). Triggers a full parse if
 * not yet cached — subsequent calls are instant.
 * @returns {Promise<Map<string, Array<Object>>>}
 */
export async function loadPMISDetailMap() {
  if (cachedPMISMap) return cachedPMISMap.pmisMap;
  const { pmisMap } = await loadPMISDataForMatching();
  return pmisMap;
}

export async function loadPMISTrends() {
  if (cachedPMISMap) return cachedPMISMap.pmisTrends;
  const { pmisTrends } = await loadPMISDataForMatching();
  return pmisTrends;
}

export async function loadPMISDistributions() {
  if (cachedPMISMap) return cachedPMISMap.pmisDistributions;
  const { pmisDistributions } = await loadPMISDataForMatching();
  return pmisDistributions;
}
/**
 * Load and parse PMIS.csv into a Map for range matching.
 * Groups data by "District|Highway".
 * Parses TRM Number + Displacement for both Begin and End.
 * Results are cached in memory so it only takes a few seconds on the very first load.
 * @returns {Promise<{ pmisMap: Map<string, Array<Object>>, availableYears: Array<number> }>}
 */
export async function loadPMISDataForMatching() {
  if (cachedPMISMap) return cachedPMISMap;

  if (!window.electronAPI) {
    throw new Error('Electron API not available. Run via Electron.');
  }

  const prefs = await loadUIPrefs();
  const customPath = prefs.sourceFiles?.pmis;

  const csvText = await window.electronAPI.readPmisText(customPath);

  return new Promise((resolve, reject) => {
    const pmisMap = new Map();
    const yearSet = new Set();
    const pmisTrends = {}; // { year: { CRCP: laneMiles, JCP: laneMiles, ACP: laneMiles } }
    const pmisDistributions = {};



    Papa.parse(csvText, {
      header: true,
      encoding: 'latin1',
      skipEmptyLines: true,
      step: (result) => {
        const row = result.data;
        
        const year = parseInt(row['FISCAL YEAR'], 10);
        
        // --- AGGREGATE TRENDS BEFORE ANY FILTERING ---
        if (!isNaN(year) && year >= 1900 && year <= 2100) {
          yearSet.add(year);
          if (!pmisTrends[year]) pmisTrends[year] = { CRCP: 0, JCP: 0, ACP: 0 };
          const pvmntType1 = (row['DETAILED PVMNT TYPE'] || '').toUpperCase().trim();
          const pvmntType2 = (row['DETAILED PVMNT TYPE ROAD LIFE'] || '').toUpperCase().trim();
          const pvmntType = pvmntType1 || pvmntType2;
          const numLanes = parseFloat(row['NUMBER THRU LANES']) || 1; // Fallback to 1
          const length = parseFloat(row['CALCULATED LENGTH']) || 0;
          const laneMiles = length * numLanes;
          
          
          if (pvmntType.includes('CRCP') || pvmntType.includes('CONTINUOUSLY REINFORCED CONCRETE') || pvmntType === '01 - CONTINUOUSLY REINFORCED CONCRETE (CRCP)') {
              pmisTrends[year].CRCP += laneMiles;
              
              if (!pmisDistributions[year]) {
                pmisDistributions[year] = {
                  CONDITION_SCORE: Array(10).fill(0),
                  DISTRESS_SCORE: Array(10).fill(0),
                  RIDE_SCORE: Array(5).fill(0),
                  IRI_SCORE: Array(6).fill(0),
                  PUNCHOUTS: {},
                  SPALLINGS: {},
                  ACP_PATCHES: {},
                  PCC_PATCHES: {}
                };
              }
              const dists = pmisDistributions[year];
              
              const cond = parseFloat(row['CONDITION SCORE']);
              const dist = parseFloat(row['DISTRESS SCORE']);
              const ride = parseFloat(row['RIDE SCORE']);
              const iri = parseFloat(row['IRI AVERAGE SCORE (IN/MILE)']);
              const punch = parseFloat(row['CRCP PUNCHOUT QTY']);
              const spall = parseFloat(row['CRCP SPALLED CRACKS QTY']);
              const acpPatch = parseFloat(row['CRCP ACP PATCHES QTY']);
              const pccPatch = parseFloat(row['CRCP PCC PATCHES QTY']);
              
              if (!isNaN(cond) && cond > 0) dists.CONDITION_SCORE[Math.min(Math.floor(cond / 10), 9)]++;
              if (!isNaN(dist) && dist > 0) dists.DISTRESS_SCORE[Math.min(Math.floor(dist / 10), 9)]++;
              if (!isNaN(ride) && ride > 0) dists.RIDE_SCORE[Math.min(Math.floor(ride), 4)]++;
              if (!isNaN(iri) && iri > 0) dists.IRI_SCORE[Math.min(Math.floor(iri / 50), 5)]++;
              
              if (!isNaN(punch)) { const p = Math.floor(punch); dists.PUNCHOUTS[p] = (dists.PUNCHOUTS[p] || 0) + 1; }
              if (!isNaN(spall)) { const s = Math.floor(spall); dists.SPALLINGS[s] = (dists.SPALLINGS[s] || 0) + 1; }
              if (!isNaN(acpPatch)) { const a = Math.floor(acpPatch); dists.ACP_PATCHES[a] = (dists.ACP_PATCHES[a] || 0) + 1; }
              if (!isNaN(pccPatch)) { const c = Math.floor(pccPatch); dists.PCC_PATCHES[c] = (dists.PCC_PATCHES[c] || 0) + 1; }
              
          } else if (pvmntType.includes('JCP') || pvmntType.includes('JOINTED CONCRETE')) {
              pmisTrends[year].JCP += laneMiles;
          } else {
              pmisTrends[year].ACP += laneMiles;
          }
        }
        // ---------------------------------------------

        const district = cleanDistrictString(row['RESPONSIBLE DISTRICT']);
        const highway = normalizeHighway(row['SIGNED HWY AND ROADBED ID'] || row['HIGHWAY ROADBED ID']);
        
        if (!highway) return;

        // Grouping key: DISTRICT|HIGHWAY
        const key = `${district}|${highway}`;

        const beginTrm = parseFloat(row['BEGINNING TRM NUMBER']) || 0;
        const beginDisp = parseFloat(row['BEGINNING TRM DISPLACEMENT']) || 0;
        const endTrm = parseFloat(row['ENDING TRM NUMBER']) || 0;
        const endDisp = parseFloat(row['ENDING TRM DISPLACEMENT']) || 0;

        const startRef = beginTrm + beginDisp;
        const endRef = endTrm + endDisp;

        // Skip rows with no valid range or year
        if (isNaN(year) || (startRef === 0 && endRef === 0)) return;

        if (!pmisMap.has(key)) {
          pmisMap.set(key, []);
        }
        
        pmisMap.get(key).push({
          year,
          startRef,
          endRef,
          // ── Chart detail fields ──────────────────────────────────────────
          distressScore:  parseFloat(row['DISTRESS SCORE'])   || null,
          conditionScore: parseFloat(row['CONDITION SCORE'])  || null,
          rideScore:      parseFloat(row['RIDE SCORE'])        || null,
          iri:            parseFloat(row['IRI AVERAGE SCORE (IN/MILE)']) || null,
          acpPatches:     parseFloat(row['CRCP ACP PATCHES QTY'])     || 0,
          pccPatches:     parseFloat(row['CRCP PCC PATCHES QTY'])     || 0,
          punchout:       parseFloat(row['CRCP PUNCHOUT QTY'])        || 0,
          spalledCracks:  parseFloat(row['CRCP SPALLED CRACKS QTY']) || 0,
          calcLength:     parseFloat(row['CALCULATED LENGTH'])         || 0,
        });
        
      },
      complete: () => {
        const availableYears = Array.from(yearSet).sort((a, b) => a - b);
        cachedPMISMap = { pmisMap, availableYears, pmisTrends, pmisDistributions };
        resolve(cachedPMISMap);
      },
      error: (err) => reject(err),
    });
  });
}

