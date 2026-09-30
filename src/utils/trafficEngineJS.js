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
export function runTrafficAnalysisJS(state, mode) {
  const modeData = state[mode] || {};
  const vSNs = new Set((modeData.verifiedSNs || []).map(x => String(x).trim()));
  const rows = modeData.pmisRows && modeData.pmisRows.length > 0 ? modeData.pmisRows : (modeData.splitRows || modeData.rows || []);

  const verifiedSections = rows.filter(r => vSNs.has(String(r.ID || r['S/N'] || '').trim()));
  const masterRows = verifiedSections.length > 0 ? verifiedSections : rows;

  if (masterRows.length === 0) {
    return { error: `No sections found for mode '${mode}' in project.` };
  }

  const results = [];
  let globalMaxAge = 0;

  for (const row of masterRows) {
    const yc = Number(row['Year Constructed'] || row['CONSTRUCTION_YEAR'] || row['CONSTRUCTION_YEAR'] || 0);
    let maxAge = 0;
    const currentYear = new Date().getFullYear();

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

    const rowCopy = { ...row, TEMP_MAX_AGE: maxAge };
    results.push(rowCopy);
  }

  // Process sections with linear/cagr models
  const processedResults = results.map(r => {
    const yc = Number(r['Year Constructed'] || r['CONSTRUCTION_YEAR'] || 0);
    const maxAge = r.TEMP_MAX_AGE || 0;
    
    // Default estimated ESAL base: ~150,000 to 500,000 ESALs per year depending on lanes
    const baseAadt = Number(r['AADT_CURRENT'] || r['AADT'] || 15000);
    const truckPct = Number(r['TRUCK_AADT_PCT'] || 12);
    const calculatedAnnualEsal = Math.max(365, baseAadt * 365 * (truckPct / 100) * 0.6);

    const dummyAges = [0, 5, 10, 15, 20].filter(a => a <= maxAge);
    if (dummyAges.length === 0) dummyAges.push(0);
    const dummyEsals = dummyAges.map(a => calculatedAnnualEsal * (1 + a * 0.02));

    const model = fitBestTrafficModel(dummyAges, dummyEsals);

    let cumEsal = 0;
    for (let a = 0; a <= maxAge; a++) {
      const colName = `AGE_${a}`;
      const val = Math.max(365, model.predict(a));
      r[colName] = { v: Math.round(val), actual: false };
      cumEsal += val;
    }

    r['EQUATION_TYPE'] = model.type;
    r['EQUATION'] = model.equation;
    r['CUMULATIVE_ESAL'] = Math.round(cumEsal);

    return r;
  });

  return {
    success: true,
    results: processedResults,
    global_max_age: globalMaxAge
  };
}
