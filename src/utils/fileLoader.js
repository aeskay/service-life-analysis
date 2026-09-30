/**
 * fileLoader.js
 * Handles file loading in pure web browsers (and optional desktop bridge).
 * Uses SheetJS for .xlsx and PapaParse for .csv.
 */

import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { loadUIPrefs } from './uiPreferences';
import { cleanDistrictString, normalizeHighway } from './normalizers';
import { getFileFromRegistry } from './fileRegistry';

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

export async function parseExcelBuffer(bufferArray) {
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
 * Load an Excel file via browser memory, fetch API, or optional desktop bridge.
 * @param {string} key - Registry key ('repaired' | 'inservice')
 * @param {string} defaultFilename - Filename (e.g. "repaired.xlsx")
 * @param {string} [customPath] - Optional override path
 * @returns {Promise<Array<Object>>} Array of row objects
 */
async function loadExcelFile(key, defaultFilename, customPath) {
  // 1. Check browser file registry / uploaded File object
  const registeredFile = await getFileFromRegistry(key);
  if (registeredFile) {
    const bufferArray = await registeredFile.arrayBuffer();
    return parseExcelBuffer(bufferArray);
  }



  // 3. Try Firebase Firestore (raw parsed rows saved as chunks)
  try {
    const { getActiveProjectId, loadRawSourceFromCloud } = await import('./projectStore');
    const projectId = getActiveProjectId();
    if (projectId) {
      const cloudRows = await loadRawSourceFromCloud(projectId, key);
      if (cloudRows && cloudRows.length > 0) {
        return cloudRows;
      }
    }
  } catch (err) {
    console.warn(`Firestore raw source download for ${key} skipped/failed:`, err.message);
  }

  // 3. Web fetch relative asset paths
  const baseName = defaultFilename.replace('.xlsx', '');
  const candidateUrls = [
    customPath,
    `/raw-files/${defaultFilename}`,
    `/raw-files/${baseName}_new.xlsx`,
    `/${defaultFilename}`,
    `/${baseName}_new.xlsx`,
  ].filter(Boolean);

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        // Netlify catch-all might return 200 OK with index.html for missing assets
        const contentType = resp.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          continue; // Skip this url, it's a fallback HTML page, not an Excel file
        }
        const bufferArray = await resp.arrayBuffer();
        return parseExcelBuffer(bufferArray);
      }
    } catch (_) {
      // try next path
    }
  }

  throw new Error(`Data file "${defaultFilename}" not found. Please go to Source Files workspace and upload your file.`);
}

export async function loadRepaired() {
  const prefs = await loadUIPrefs();
  return loadExcelFile('repaired', 'repaired.xlsx', prefs.sourceFiles?.repaired);
}

export async function loadInService() {
  const prefs = await loadUIPrefs();
  return loadExcelFile('inservice', 'in-service.xlsx', prefs.sourceFiles?.inservice);
}

/**
 * Get PMIS source (File object, string content, or fetch URL)
 */
async function getPMISSource(customPath) {
  const registeredFile = await getFileFromRegistry('pmis');
  if (registeredFile) {
    return registeredFile;
  }



  const candidateUrls = [
    customPath,
    '/raw-files/PMIS.csv',
    '/PMIS.csv'
  ].filter(Boolean);

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, { method: 'HEAD' });
      if (resp.ok) {
        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
          return url;
        }
      }
    } catch (_) {}
  }

  // If we reach here, we didn't find PMIS.csv
  throw new Error(`Data file "PMIS.csv" not found. Please go to Source Files workspace and upload your PMIS CSV file.`);
}

/**
 * Load and parse PMIS.csv, extracting unique highway IDs.
 * @returns {Promise<Set<string>>} Set of unique highway strings
 */
export async function loadPMISHighways() {
  if (cachedPMISHighways) return cachedPMISHighways;

  const prefs = await loadUIPrefs();
  const source = await getPMISSource(prefs.sourceFiles?.pmis);

  return new Promise((resolve, reject) => {
    const highwaySet = new Set();

    Papa.parse(source, {
      header: true,
      download: typeof source === 'string' && source.startsWith('/'),
      encoding: 'latin1',
      skipEmptyLines: true,
      step: (result) => {
        const row = result.data;
        const val = row['SIGNED HWY AND ROADBED ID'];
        if (val && typeof val === 'string') {
          highwaySet.add(normalizeHighway(val));
        }
        const val2 = row['HIGHWAY ROADBED ID'];
        if (val2 && typeof val2 === 'string' && val2.trim()) {
          highwaySet.add(normalizeHighway(val2));
        }
      },
      complete: () => {
        cachedPMISHighways = highwaySet;
        resolve(highwaySet);
      },
      error: (err) => reject(err),
    });
  });
}

/**
 * Return the cached PMIS detail map.
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
 */
export async function loadPMISDataForMatching() {
  if (cachedPMISMap) return cachedPMISMap;

  const prefs = await loadUIPrefs();
  const source = await getPMISSource(prefs.sourceFiles?.pmis);

  return new Promise((resolve, reject) => {
    const pmisMap = new Map();
    const yearSet = new Set();
    const pmisTrends = {};
    const pmisDistributions = {};

    Papa.parse(source, {
      header: true,
      download: typeof source === 'string' && source.startsWith('/'),
      encoding: 'latin1',
      skipEmptyLines: true,
      step: (result) => {
        const row = result.data;
        const year = parseInt(row['FISCAL YEAR'], 10);
        
        if (!isNaN(year) && year >= 1900 && year <= 2100) {
          yearSet.add(year);
          if (!pmisTrends[year]) pmisTrends[year] = { CRCP: 0, JCP: 0, ACP: 0 };
          const pvmntType1 = (row['DETAILED PVMNT TYPE'] || '').toUpperCase().trim();
          const pvmntType2 = (row['DETAILED PVMNT TYPE ROAD LIFE'] || '').toUpperCase().trim();
          const pvmntType = pvmntType1 || pvmntType2;
          const numLanes = parseFloat(row['NUMBER THRU LANES']) || 1;
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

        const district = cleanDistrictString(row['RESPONSIBLE DISTRICT']);
        const highway = normalizeHighway(row['SIGNED HWY AND ROADBED ID'] || row['HIGHWAY ROADBED ID']);
        if (!highway) return;

        const key = `${district}|${highway}`;
        const beginTrm = parseFloat(row['BEGINNING TRM NUMBER']) || 0;
        const beginDisp = parseFloat(row['BEGINNING TRM DISPLACEMENT']) || 0;
        const endTrm = parseFloat(row['ENDING TRM NUMBER']) || 0;
        const endDisp = parseFloat(row['ENDING TRM DISPLACEMENT']) || 0;

        const startRef = beginTrm + beginDisp;
        const endRef = endTrm + endDisp;

        if (isNaN(year) || (startRef === 0 && endRef === 0)) return;

        if (!pmisMap.has(key)) {
          pmisMap.set(key, []);
        }
        
        pmisMap.get(key).push({
          year,
          startRef,
          endRef,
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
