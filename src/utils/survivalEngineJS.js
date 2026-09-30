/**
 * survivalEngineJS.js
 * Pure JavaScript implementation of Kaplan-Meier survival estimation & median calculation.
 * Runs in web browsers (Netlify) without needing local Python or external services.
 */

export function calculateKaplanMeier(dataItems) {
  // dataItems: Array<{ Age: number, Event: number }>
  if (!dataItems || dataItems.length === 0) {
    return {
      timeline: [0],
      survival: [1.0],
      ci_lower: [1.0],
      ci_upper: [1.0],
      median: null,
      total: 0
    };
  }

  // Sort items by duration (Age) ascending
  const sorted = [...dataItems].sort((a, b) => a.Age - b.Age);

  // Group by distinct event/censor times
  const timeMap = new Map();
  for (const item of sorted) {
    const t = Number(item.Age.toFixed(4));
    if (!timeMap.has(t)) {
      timeMap.set(t, { time: item.Age, events: 0, totalAtRisk: 0 });
    }
    const rec = timeMap.get(t);
    if (item.Event === 1) {
      rec.events += 1;
    }
  }

  const times = Array.from(timeMap.keys()).sort((a, b) => a - b);
  let atRisk = sorted.length;
  
  let currentSurvival = 1.0;
  let greenwoodSum = 0;

  const timeline = [0];
  const survival = [1.0];
  const ci_lower = [1.0];
  const ci_upper = [1.0];

  let median = null;

  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const group = timeMap.get(t);
    
    // Total items at risk at time t before events at t
    const n = atRisk;
    const d = group.events;

    if (n > 0 && d > 0) {
      currentSurvival *= (1 - d / n);
      greenwoodSum += d / (n * (n - d > 0 ? n - d : 1));
    }

    // Standard error via Greenwood's formula
    const se = currentSurvival * Math.sqrt(greenwoodSum);
    const z = 1.96; // 95% confidence
    const lower = Math.max(0, currentSurvival - z * se);
    const upper = Math.min(1.0, currentSurvival + z * se);

    timeline.push(t);
    survival.push(currentSurvival);
    ci_lower.push(lower);
    ci_upper.push(upper);

    if (median === null && currentSurvival <= 0.5) {
      median = t;
    }

    // Reduce at-risk for next duration
    atRisk -= sorted.filter(x => Math.abs(x.Age - t) < 0.00001).length;
  }

  if (median === null && survival[survival.length - 1] > 0.5) {
    median = timeline[timeline.length - 1];
  }

  return {
    timeline,
    survival,
    ci_lower,
    ci_upper,
    median: median !== null ? Number(median.toFixed(2)) : null,
    total: dataItems.length
  };
}

/**
 * Service Life Kaplan-Meier estimation for Reconstructed & In-Service datasets
 */
export function runServiceLifeSurvivalJS(state) {
  const reconRows = state.reconstructed?.rows || state.reconstructed?.pmisRows || [];
  const inServiceRows = state.inservice?.rows || state.inservice?.pmisRows || [];

  const reconVerified = new Set(state.reconstructed?.verifiedSNs || []);
  const inServiceVerified = new Set(state.inservice?.verifiedSNs || []);

  const reconEOLMap = state.reconstructed?.actualEndOfLifeMap || {};
  const inServiceYCMap = state.inservice?.actualYearConstMap || {};
  const currentYear = new Date().getFullYear();

  const reconData = [];
  for (const r of reconRows) {
    const id = String(r.ID || r['S/N'] || '');
    if (reconVerified.size > 0 && !reconVerified.has(id)) continue;

    const yc = Number(r['Year Constructed'] || r['CONSTRUCTION_YEAR']) || 0;
    const eolVal = Number(reconEOLMap[id] || r['End of Life'] || r['END_OF_LIFE']);

    let sl = Number(r['Service Life'] || r['SERVICE_LIFE']) || 0;
    if (yc > 0 && eolVal > 0) sl = eolVal - yc;

    if (sl > 0) reconData.push({ Age: sl, Event: 1 });
  }

  const inServiceData = [];
  for (const r of inServiceRows) {
    const id = String(r.ID || r['S/N'] || '');
    if (inServiceVerified.size > 0 && !inServiceVerified.has(id)) continue;

    const yc = Number(inServiceYCMap[id] || r['Year Constructed'] || r['CONSTRUCTION_YEAR']);
    if (yc > 0) {
      const age = currentYear - yc;
      if (age > 0) inServiceData.push({ Age: age, Event: 0 }); // Censored
    }
  }

  const reconKm = calculateKaplanMeier(reconData);
  const inServiceKm = calculateKaplanMeier(inServiceData);

  return {
    timeline: reconKm.timeline,
    survival: reconKm.survival,
    ci_lower: reconKm.ci_lower,
    ci_upper: reconKm.ci_upper,
    median: reconKm.median,

    r_timeline: reconKm.timeline,
    r_survival: reconKm.survival,
    r_median: reconKm.median,

    insvc_timeline: inServiceKm.timeline,
    insvc_survival: inServiceKm.survival,
    insvc_median: inServiceKm.median,

    total_recon: reconData.length,
    total_insvc: inServiceData.length
  };
}

export function runSurvivalAnalysisBaseJS(state) {
  const reconRows = state.reconstructed?.rows || state.reconstructed?.pmisRows || [];
  const inServiceRows = state.inservice?.rows || state.inservice?.pmisRows || [];

  const reconVerified = new Set(state.reconstructed?.verifiedSNs || []);
  const inServiceVerified = new Set(state.inservice?.verifiedSNs || []);

  const reconEOLMap = state.reconstructed?.actualEndOfLifeMap || {};
  const inServiceYCMap = state.inservice?.actualYearConstMap || {};
  const currentYear = new Date().getFullYear();

  const groups = {};

  const processRow = (r, isRecon, verifiedSet) => {
    const id = String(r.ID || r['S/N'] || '');
    if (verifiedSet.size > 0 && !verifiedSet.has(id)) return;

    const rawTh = r['Base Th'] || r['Base Thickness'] || r['BASE_THICKNESS'] || r['Base_Th'];
    let thVal = parseFloat(rawTh);
    if (isNaN(thVal) || thVal <= 0) return;

    const thKey = thVal.toFixed(1);
    if (!groups[thKey]) groups[thKey] = [];

    const yc = Number(r['Year Constructed'] || r['CONSTRUCTION_YEAR']) || 0;
    if (isRecon) {
      const eolVal = Number(reconEOLMap[id] || r['End of Life'] || r['END_OF_LIFE']);
      let sl = Number(r['Service Life'] || r['SERVICE_LIFE']) || 0;
      if (yc > 0 && eolVal > 0) sl = eolVal - yc;
      if (sl > 0) groups[thKey].push({ Age: sl, Event: 1 });
    } else {
      const activeYC = Number(inServiceYCMap[id] || yc);
      if (activeYC > 0) {
        const age = currentYear - activeYC;
        if (age > 0) groups[thKey].push({ Age: age, Event: 0 });
      }
    }
  };

  for (const r of reconRows) processRow(r, true, reconVerified);
  for (const r of inServiceRows) processRow(r, false, inServiceVerified);

  const result = {};
  for (const [thKey, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    const km = calculateKaplanMeier(items);
    result[thKey] = {
      timeline: km.timeline,
      survival: km.survival,
      median: km.median,
      count: items.length
    };
  }

  return result;
}

export function runSurvivalAnalysisSlabJS(state) {
  const reconRows = state.reconstructed?.rows || state.reconstructed?.pmisRows || [];
  const inServiceRows = state.inservice?.rows || state.inservice?.pmisRows || [];

  const reconVerified = new Set(state.reconstructed?.verifiedSNs || []);
  const inServiceVerified = new Set(state.inservice?.verifiedSNs || []);

  const reconEOLMap = state.reconstructed?.actualEndOfLifeMap || {};
  const inServiceYCMap = state.inservice?.actualYearConstMap || {};
  const currentYear = new Date().getFullYear();

  const groups = {};

  const processRow = (r, isRecon, verifiedSet) => {
    const id = String(r.ID || r['S/N'] || '');
    if (verifiedSet.size > 0 && !verifiedSet.has(id)) return;

    const rawTh = r['Old Slab Th'] || r['Slab Thickness'] || r['SLAB_THICKNESS'] || r['D_SLAB'];
    let thVal = parseFloat(rawTh);
    if (isNaN(thVal) || thVal <= 0) return;

    const thKey = thVal.toFixed(1);
    if (!groups[thKey]) groups[thKey] = [];

    const yc = Number(r['Year Constructed'] || r['CONSTRUCTION_YEAR']) || 0;
    if (isRecon) {
      const eolVal = Number(reconEOLMap[id] || r['End of Life'] || r['END_OF_LIFE']);
      let sl = Number(r['Service Life'] || r['SERVICE_LIFE']) || 0;
      if (yc > 0 && eolVal > 0) sl = eolVal - yc;
      if (sl > 0) groups[thKey].push({ Age: sl, Event: 1 });
    } else {
      const activeYC = Number(inServiceYCMap[id] || yc);
      if (activeYC > 0) {
        const age = currentYear - activeYC;
        if (age > 0) groups[thKey].push({ Age: age, Event: 0 });
      }
    }
  };

  for (const r of reconRows) processRow(r, true, reconVerified);
  for (const r of inServiceRows) processRow(r, false, inServiceVerified);

  const result = {};
  for (const [thKey, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    const km = calculateKaplanMeier(items);
    result[thKey] = {
      timeline: km.timeline,
      survival: km.survival,
      median: km.median,
      count: items.length
    };
  }

  return result;
}
