import sys
import json
import traceback
import os
import pandas as pd
import numpy as np

def get_r2(y, y_pred):
    if len(y) < 2: return 0
    res = np.sum((y - y_pred) ** 2)
    tot = np.sum((y - np.mean(y)) ** 2)
    return 1 - (res / tot) if tot != 0 else 0

def fit_best_model(ages, esals):
    if len(ages) == 0: return "NIL", "", lambda x: 365.0
    if len(ages) == 1:
        v = esals[0]
        return "Constant (1-pt)", f"ESAL = {v:.0f}", lambda x, val=v: val

    median_val = np.median(esals)
    fa, fv = ages[0], esals[0]
    la, lv = ages[-1], esals[-1]
    a_arr, e_arr = ages.copy(), esals.copy()
    
    valid_fvs = [e for a, e in zip(ages, esals) if a >= 0]
    fv_for_guardrail = valid_fvs[0] if valid_fvs else esals[-1]
    
    valid_candidates = []
    
    # 1. Linear
    p_lin = np.polyfit(ages, esals, 1)
    valid_candidates.append(("Linear", f"ESAL = {p_lin[0]:.1f}*Age + {p_lin[1]:.1f}", lambda x, p=p_lin: np.polyval(p, x), 0))

    # 2. Exponential
    if (esals > 0).all():
        try:
            p_exp = np.polyfit(ages, np.log(esals), 1)
            a_v, b_v = np.exp(p_exp[1]), p_exp[0]
            valid_candidates.append(("Exponential", f"ESAL = {a_v:.1f}*e^({b_v:.4f}*Age)", lambda x, a=a_v, b=b_v: a * np.exp(b * x), 0))
        except: pass

    # 3. Polynomial
    if len(ages) >= 4:
        p_poly = np.polyfit(ages, esals, 2)
        valid_candidates.append(("Polynomial", "Quadratic Fit", lambda x, p=p_poly: np.polyval(p, x), 0.15))

    filtered_candidates = []
    for name, eq, fn, penalty in valid_candidates:
        r2 = get_r2(esals, fn(ages)) - penalty
        age_0_val = fn(0)
        
        # Guardrails
        if age_0_val > (fv_for_guardrail * 1.25): continue
        if age_0_val < (median_val * 0.10): continue
        if r2 < 0.4: continue
        
        filtered_candidates.append((name, eq, fn, r2))

    filtered_candidates.sort(key=lambda x: x[3], reverse=True)

    if not filtered_candidates:
        # 3% Fallback
        def fallback_fn(x, f_a=fa, f_v=fv, l_a=la, l_v=lv, a_s=a_arr, e_s=e_arr):
            if x < f_a: return f_v * (1.03 ** (x - f_a))
            if x > l_a: return l_v * (1.03 ** (x - l_a))
            return float(np.interp(x, a_s, e_s))
        return "3% Growth Fallback", "3% CAGR Anchored", fallback_fn

    return filtered_candidates[0][0], filtered_candidates[0][1], filtered_candidates[0][2]

def run_analysis(state_file_path, pmis_path, result_path, mode):
    print("Loading files...", flush=True)
    with open(state_file_path, "r", encoding="utf-8") as f:
        state = json.load(f)

    # Use only the selected mode (reconstructed or inservice)
    mode_data = state.get(mode, {})
    v_sns = set(str(x).strip() for x in mode_data.get('verifiedSNs', []))
    rows = mode_data.get('pmisRows', [])
    if not rows:
        rows = mode_data.get('splitRows', [])
    v_rows = [r for r in rows if str(r.get('ID') or r.get('S/N') or '').strip() in v_sns]
    verified_sections = v_rows if v_rows else rows
    
    print(f"Mode: {mode} | verifiedSNs: {len(v_sns)} | availableRows: {len(rows)} | matched: {len(verified_sections)}", flush=True)
        
    master_df = pd.DataFrame(verified_sections)
    if master_df.empty:
        print(f"No sections available to analyze for mode '{mode}'.")
        with open(result_path, "w", encoding="utf-8") as f: json.dump({"error": f"No sections found for mode '{mode}' in app state."}, f)
        return
        
    master_df.columns = master_df.columns.str.strip().str.replace(' ', '_').str.upper()
    print("Loading PMIS...", flush=True)
    pmis_df = pd.read_csv(pmis_path, low_memory=False, encoding='latin1')
    pmis_df.columns = pmis_df.columns.str.strip().str.replace(' ', '_').str.upper()

    def get_mp(df, num_col, disp_col, fallback_col=None):
        if num_col in df.columns and disp_col in df.columns:
            res = pd.to_numeric(df[num_col], errors='coerce') + pd.to_numeric(df[disp_col], errors='coerce')
            if not res.isna().all(): return res
        if fallback_col and fallback_col in df.columns:
            return pd.to_numeric(df[fallback_col], errors='coerce')
        return pd.Series([np.nan]*len(df))

    # master_df might have TRM cols or just OLD_BEGIN_REF / BEGIN_REF
    master_df['M_START'] = get_mp(master_df, 'BEGINNING_TRM_NUMBER', 'BEGINNING_TRM_DISPLACEMENT', 'OLD_BEGIN_REF')
    if master_df['M_START'].isna().all() and 'BEGIN_REF' in master_df.columns:
        master_df['M_START'] = pd.to_numeric(master_df['BEGIN_REF'], errors='coerce')
        
    master_df['M_END'] = get_mp(master_df, 'ENDING_TRM_NUMBER', 'ENDING_TRM_DISPLACEMENT', 'OLD_END_REF')
    if master_df['M_END'].isna().all() and 'END_REF' in master_df.columns:
        master_df['M_END'] = pd.to_numeric(master_df['END_REF'], errors='coerce')
        
    pmis_df['P_START'] = get_mp(pmis_df, 'BEGINNING_TRM_NUMBER', 'BEGINNING_TRM_DISPLACEMENT')
    pmis_df['P_END'] = get_mp(pmis_df, 'ENDING_TRM_NUMBER', 'ENDING_TRM_DISPLACEMENT')

    MATCH_ID = 'SIGNED_HWY_AND_ROADBED_ID'
    if MATCH_ID not in master_df.columns and 'HIGHWAY' in master_df.columns:
        master_df[MATCH_ID] = master_df['HIGHWAY']

    pmis_df[MATCH_ID] = pmis_df[MATCH_ID].astype(str).str.strip().str.upper()
    master_df[MATCH_ID] = master_df[MATCH_ID].astype(str).str.strip().str.upper()

    def calc_esal_final(r):
        try:
            lanes = pd.to_numeric(r.get('NUMBER_THRU_LANES', 2), errors='coerce')
            if pd.isna(lanes): lanes = 2
            f = 1.0 if lanes <= 2 else (0.7 if lanes <= 3 else 0.6)
            aadt = pd.to_numeric(r['AADT_CURRENT'], errors='coerce')
            truck = pd.to_numeric(r['TRUCK_AADT_PCT'], errors='coerce')
            return aadt * 365 * (truck/100) * 1.2 * f
        except: return np.nan

    print("Calculating PMIS ESAL...", flush=True)
    pmis_df['CALC_ESAL'] = pmis_df.apply(calc_esal_final, axis=1)
    pmis_df['FISCAL_YEAR'] = pd.to_numeric(pmis_df['FISCAL_YEAR'], errors='coerce')

    import datetime
    current_year = datetime.datetime.now().year

    eol_map = mode_data.get("actualEndOfLifeMap", {})
    yc_map = mode_data.get("actualYearConstMap", {})

    def get_max_age(r):
        id_val = str(r.get('ID') or r.get('S/N') or r.get(MATCH_ID))
        yc = r.get('CONSTRUCTION_YEAR')
        if yc_map and str(yc_map.get(id_val, "")) != "":
            yc = float(yc_map[id_val])
            
        if pd.isna(yc) or yc <= 0:
            return 0
            
        if mode == 'reconstructed':
            eol = r.get('END_OF_LIFE')
            if eol_map and str(eol_map.get(id_val, "")) != "":
                eol = float(eol_map[id_val])
            else:
                try: eol = float(eol)
                except (ValueError, TypeError): eol = np.nan
            
            if pd.notna(eol) and eol > 0:
                return max(0, int(eol - yc))
            
            sl = r.get('SERVICE_LIFE')
            try: sl = float(sl)
            except (ValueError, TypeError): sl = np.nan
            if pd.notna(sl) and sl > 0:
                return int(sl)

        return max(0, int(current_year - yc))

    if 'YEAR_CONSTRUCTED' in master_df.columns and 'CONSTRUCTION_YEAR' not in master_df.columns:
        master_df['CONSTRUCTION_YEAR'] = master_df['YEAR_CONSTRUCTED']
        
    master_df['CONSTRUCTION_YEAR'] = pd.to_numeric(master_df.get('CONSTRUCTION_YEAR'), errors='coerce')
    master_df['TEMP_MAX_AGE'] = master_df.apply(get_max_age, axis=1)
    
    global_max_age = int(master_df['TEMP_MAX_AGE'].max())
    if global_max_age < 0: global_max_age = 0
    AGE_COLS = [f"AGE_{a}" for a in range(global_max_age + 1)]

    CAL_YEARS = list(range(1996, current_year + 1))
    
    print(f"Processing {len(master_df)} verified sections...", flush=True)
    
    results = []
    
    for idx, m_row in master_df.iterrows():
        c_year = m_row.get('CONSTRUCTION_YEAR')
        m_id, m_s, m_e = m_row[MATCH_ID], m_row['M_START'], m_row['M_END']
        
        row_actual_ages = {}
        lifecycle_r = m_row.to_dict()
        
        for col in AGE_COLS: lifecycle_r[col] = None
        
        if pd.notna(c_year):
            hwy_data = pmis_df[pmis_df[MATCH_ID] == m_id]
            all_hist_ages = {}
            for yr in CAL_YEARS:
                age = int(yr - c_year)
                match = hwy_data[(hwy_data['FISCAL_YEAR'] == yr) & (hwy_data['P_START'] < m_e + 0.1) & (hwy_data['P_END'] > m_s - 0.1)].copy()
                if not match.empty:
                    match['W'] = (np.minimum(match['P_END'], m_e) - np.maximum(match['P_START'], m_s)).clip(0)
                    esal_v = np.average(match['CALC_ESAL'], weights=match['W']) if match['W'].sum()>0 else match['CALC_ESAL'].mean()
                    if pd.notna(esal_v):
                        all_hist_ages[age] = esal_v
                        if age >= 0:
                            row_actual_ages[age] = esal_v

            sorted_ages = sorted(all_hist_ages.keys())
            if len(sorted_ages) > 0:
                k_ages = np.array(sorted_ages)
                k_esals = np.array([all_hist_ages[a] for a in sorted_ages])
                eq_t, eq_s, best_fn = fit_best_model(k_ages, k_esals)
                
                cum_esal = 0
                for a in range(int(m_row['TEMP_MAX_AGE']) + 1):
                    col = f"AGE_{a}"
                    if a in row_actual_ages:
                        val = row_actual_ages[a]
                        lifecycle_r[col] = {"v": val, "actual": True}
                    else:
                        val = max(float(best_fn(a)), 365.0)
                        lifecycle_r[col] = {"v": val, "actual": False}
                    cum_esal += val
            else:
                eq_t, eq_s, cum_esal = "NIL", "No PMIS match", 0
        else:
            eq_t, eq_s, cum_esal = "NIL", "No Construction Year", 0

        lifecycle_r['EQUATION_TYPE'] = eq_t
        lifecycle_r['EQUATION'] = eq_s
        lifecycle_r['CUMULATIVE_ESAL'] = cum_esal
        results.append(lifecycle_r)
        
        if (idx+1) % 10 == 0:
            print(f"  Processed {idx+1}/{len(master_df)} sections...", flush=True)

    print("Writing results...", flush=True)
    import math
    def clean_nans(obj):
        if isinstance(obj, dict):
            return {k: clean_nans(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [clean_nans(v) for v in obj]
        elif isinstance(obj, float) and math.isnan(obj):
            return None
        return obj

    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(clean_nans({"success": True, "results": results, "global_max_age": global_max_age}), f)
        
    print("SUCCESS", flush=True)


if __name__ == "__main__":
    state_file = sys.argv[1]
    pmis_file = sys.argv[2]
    out_file = sys.argv[3]
    mode = sys.argv[4] if len(sys.argv) > 4 else 'reconstructed'
    try:
        run_analysis(state_file, pmis_file, out_file, mode)
    except Exception as e:
        traceback.print_exc()
        with open(out_file, "w") as f:
            json.dump({"error": str(e)}, f)
        print(f"FAILED: {e}")
        sys.exit(1)
