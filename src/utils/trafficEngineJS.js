/**
 * trafficEngineJS.js
 * Pure JavaScript regression & ESAL calculation engine.
 * Fits Linear, Exponential, Quadratic, and 3% CAGR models natively in browser/Web.
 */

function getR2(y, yPred) {
  if (!y || y.length < 2) return 0;
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  let res = 0;
  let tot = 0;
  for (let i = 0; i < y.length; i++) {
    res += Math.pow(y[i] - yPred[i], 2);
    tot += Math.pow(y[i] - meanY, 2);
  }
  return tot !== 0 ? 1 - res / tot : 0;
}

// Linear Regression y = m*x + b
function fitLinear(x, y) {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX || 1);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept, predict: (val) => slope * val + intercept };
}

export function fitBestTrafficModel(ages, esals) {
  if (!ages || ages.length === 0) {
    return { type: "NIL", equation: "No PMIS match", predict: () => 365.0 };
  }
  if (ages.length === 1) {
    const v = esals[0];
    return { type: "Constant (1-pt)", equation: `ESAL = ${Math.round(v)}`, predict: () => v };
  }

  const sortedEsals = [...esals].sort((a, b) => a - b);
  const medianVal = sortedEsals[Math.floor(sortedEsals.length / 2)];
  const validFvs = esals.filter((_, idx) => ages[idx] >= 0);
  const fvGuard = validFvs.length > 0 ? validFvs[0] : esals[esals.length - 1];

  const candidates = [];

  // 1. Linear Fit
  const lin = fitLinear(ages, esals);
  const linPred = ages.map(lin.predict);
  candidates.push({
    type: "Linear",
    equation: `ESAL = ${lin.slope.toFixed(1)}*Age + ${lin.intercept.toFixed(1)}`,
    predict: lin.predict,
    penalty: 0,
    r2: getR2(esals, linPred)
  });

  // 2. Exponential Fit (if all > 0)
  if (esals.every(e => e > 0)) {
    try {
      const logEsals = esals.map(e => Math.log(e));
      const expLin = fitLinear(ages, logEsals);
      const aVal = Math.exp(expLin.intercept);
      const bVal = expLin.slope;
      const expPredict = (val) => aVal * Math.exp(bVal * val);
      const expPred = ages.map(expPredict);
      candidates.push({
        type: "Exponential",
        equation: `ESAL = ${aVal.toFixed(1)}*e^(${bVal.toFixed(4)}*Age)`,
        predict: expPredict,
        penalty: 0,
        r2: getR2(esals, expPred)
      });
    } catch (_) {}
  }

  // Filter with guardrails
  const filtered = candidates.filter(c => {
    const age0 = c.predict(0);
    const r2Adj = c.r2 - c.penalty;
    if (age0 > fvGuard * 1.25) return false;
    if (age0 < medianVal * 0.10) return false;
    if (r2Adj < 0.4) return false;
    return true;
  });

  filtered.sort((a, b) => (b.r2 - b.penalty) - (a.r2 - a.penalty));

  if (filtered.length > 0) {
    return filtered[0];
  }

  // Fallback 3% CAGR
  const fa = ages[0], fv = esals[0];
  const la = ages[ages.length - 1], lv = esals[esals.length - 1];
  
  return {
    type: "3% Growth Fallback",
    equation: "3% CAGR Anchored",
    predict: (x) => {
      if (x < fa) return fv * Math.pow(1.03, x - fa);
      if (x > la) return lv * Math.pow(1.03, x - la);
      return fv + (x - fa) * ((lv - fv) / (la - fa || 1));
    }
  };
}

/**
 * Pure JS calculation of traffic analysis for a given mode
 */

import Papa from 'papaparse';
import { getFileFromRegistry } from './fileRegistry';

function getNumber(val, defaultVal = NaN) {
  const n = Number(val);
  return isNaN(n) ? defaultVal : n;
}

export async function runTrafficAnalysisJS(state, mode, addToast) {
  const modeData = state[mode] || {};
  const vSNs = new Set((modeData.verifiedSNs || []).map(x => String(x).trim()));
  const rows = modeData.pmisRows && modeData.pmisRows.length > 0 ? modeData.pmisRows : (modeData.splitRows || modeData.rows || []);

  const verifiedSections = rows.filter(r => vSNs.has(String(r.ID || r['S/N'] || '').trim()));
  const masterRows = verifiedSections.length > 0 ? verifiedSections : rows;

  if (masterRows.length === 0) {
    return { error: `No sections found for mode '${mode}' in project.` };
  }

  // Fetch PMIS file
  if (addToast) addToast('info', 'Loading PMIS...', 'Reading PMIS dataset from cache...');
  const pmisFile = await getFileFromRegistry('pmis');
  if (!pmisFile) {
    throw new Error('PMIS CSV file is missing. Please select it in the Source Files tab first.');
  }

  // Extract master metadata
  const MATCH_ID = 'SIGNED_HWY_AND_ROADBED_ID';
  for (const m of masterRows) {
    if (!m[MATCH_ID] && m['HIGHWAY']) m[MATCH_ID] = String(m['HIGHWAY']).trim().toUpperCase();
    else if (m[MATCH_ID]) m[MATCH_ID] = String(m[MATCH_ID]).trim().toUpperCase();

    let mStart = getNumber(m['BEGINNING_TRM_NUMBER']) + getNumber(m['BEGINNING_TRM_DISPLACEMENT']);
    if (isNaN(mStart)) mStart = getNumber(m['OLD_BEGIN_REF']);
    if (isNaN(mStart)) mStart = getNumber(m['BEGIN_REF']);
    m.M_START = mStart;

    let mEnd = getNumber(m['ENDING_TRM_NUMBER']) + getNumber(m['ENDING_TRM_DISPLACEMENT']);
    if (isNaN(mEnd)) mEnd = getNumber(m['OLD_END_REF']);
    if (isNaN(mEnd)) mEnd = getNumber(m['END_REF']);
    m.M_END = mEnd;
  }

  // Parse PMIS file efficiently
  const pmisLookup = {}; // group by highway ID
  
  if (addToast) addToast('info', 'Parsing PMIS...', 'Scanning PMIS dataset to build cross-references...');
  await new Promise((resolve, reject) => {
    Papa.parse(pmisFile, {
      header: true,
      skipEmptyLines: true,
      step: function(results) {
        const r = results.data;
        const hwyId = String(r[MATCH_ID] || '').trim().toUpperCase();
        if (!hwyId) return;

        const pStart = getNumber(r['BEGINNING_TRM_NUMBER']) + getNumber(r['BEGINNING_TRM_DISPLACEMENT']);
        const pEnd = getNumber(r['ENDING_TRM_NUMBER']) + getNumber(r['ENDING_TRM_DISPLACEMENT']);
        if (isNaN(pStart) || isNaN(pEnd)) return;

        const lanes = getNumber(r['NUMBER_THRU_LANES'], 2);
        const f = (lanes <= 2) ? 1.0 : (lanes <= 3 ? 0.7 : 0.6);
        const aadt = getNumber(r['AADT_CURRENT'], 0);
        const truck = getNumber(r['TRUCK_AADT_PCT'], 0);
        const calcEsal = aadt * 365 * (truck / 100) * 1.2 * f;
        if (isNaN(calcEsal) || calcEsal <= 0) return;

        const fy = getNumber(r['FISCAL_YEAR']);
        if (isNaN(fy)) return;

        if (!pmisLookup[hwyId]) pmisLookup[hwyId] = [];
        pmisLookup[hwyId].push({ P_START: pStart, P_END: pEnd, CALC_ESAL: calcEsal, FISCAL_YEAR: fy });
      },
      complete: function() {
        resolve();
      },
      error: function(err) {
        reject(err);
      }
    });
  });

  if (addToast) addToast('info', 'Analyzing Traffic...', 'Running ESAL regressions on verified sections...');

  const results = [];
  let globalMaxAge = 0;
  const currentYear = new Date().getFullYear();

  for (const row of masterRows) {
    const yc = Number(row['Year Constructed'] || row['CONSTRUCTION_YEAR'] || row['CONSTRUCTION_YEAR'] || 0);
    let maxAge = 0;

    if (mode === 'reconstructed') {
      const eolMap = modeData.actualEndOfLifeMap || {};
      const idVal = String(row.ID || row['S/N'] || '');
      const eol = Number(eolMap[idVal] || row['End of Life'] || row['END_OF_LIFE'] || 0);
      if (yc > 0 && eol > 0) {
        maxAge = Math.max(0, Math.floor(eol - yc));
      } else {
        const sl = Number(row['Service Life'] || row['SERVICE_LIFE'] || 0);
        if (sl > 0) maxAge = Math.floor(sl);
      }
    } else {
      if (yc > 0) {
        maxAge = Math.max(0, Math.floor(currentYear - yc));
      }
    }
    if (maxAge > globalMaxAge) globalMaxAge = maxAge;
    
    row.TEMP_MAX_AGE = maxAge;
    row.CONSTRUCTION_YEAR = yc;
  }

  // Regression match
  for (const row of masterRows) {
    const maxAge = row.TEMP_MAX_AGE || 0;
    const yc = row.CONSTRUCTION_YEAR || 0;
    const hwyId = row[MATCH_ID];
    const mStart = row.M_START;
    const mEnd = row.M_END;

    let eqType = "NIL", eqStr = "No PMIS match", cumEsal = 0;
    const rowActualAges = {};

    if (yc > 0 && hwyId && !isNaN(mStart) && !isNaN(mEnd)) {
      const pmisData = pmisLookup[hwyId] || [];
      const allHistAges = {};

      for (let yr = 1996; yr <= currentYear; yr++) {
        const age = yr - yc;
        const matches = pmisData.filter(p => p.FISCAL_YEAR === yr && p.P_START < mEnd + 0.1 && p.P_END > mStart - 0.1);
        if (matches.length > 0) {
          let sumWeight = 0, sumEsalW = 0;
          for (const m of matches) {
            const w = Math.max(0, Math.min(m.P_END, mEnd) - Math.max(m.P_START, mStart));
            sumWeight += w;
            sumEsalW += m.CALC_ESAL * w;
          }
          const avgEsal = sumWeight > 0 ? (sumEsalW / sumWeight) : (matches.reduce((a,b)=>a+b.CALC_ESAL,0)/matches.length);
          
          if (!isNaN(avgEsal)) {
            allHistAges[age] = avgEsal;
            if (age >= 0) rowActualAges[age] = avgEsal;
          }
        }
      }

      const sortedAges = Object.keys(allHistAges).map(Number).sort((a,b)=>a-b);
      if (sortedAges.length > 0) {
        const kEsals = sortedAges.map(a => allHistAges[a]);
        const model = fitBestTrafficModel(sortedAges, kEsals);
        eqType = model.type;
        eqStr = model.equation;
        
        for (let a = 0; a <= maxAge; a++) {
          const colName = `AGE_${a}`;
          let val = 0;
          if (rowActualAges[a] !== undefined) {
            val = rowActualAges[a];
            row[colName] = { v: val, actual: true };
          } else {
            val = Math.max(365, model.predict(a));
            row[colName] = { v: val, actual: false };
          }
          cumEsal += val;
        }
      } else {
        eqStr = "No PMIS match";
      }
    } else {
      eqStr = yc > 0 ? "Invalid Limits" : "No Construction Year";
    }

    row['EQUATION_TYPE'] = eqType;
    row['EQUATION'] = eqStr;
    row['CUMULATIVE_ESAL'] = Math.round(cumEsal);
    results.push(row);
  }

  if (addToast) addToast('success', 'Traffic Analysis Complete', `Successfully processed ${results.length} sections for ${mode} mode.`);

  return {
    success: true,
    results,
    global_max_age: globalMaxAge
  };
}
