const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const tmpDir     = os.tmpdir();
const scriptPath = path.join(tmpDir, 'survival_script_test.py');
const resultPath = path.join(tmpDir, 'survival_result_test.json');
const statePath  = 'C:\\Users\\Samuel Alalade\\OneDrive - Texas Tech University\\Research\\PhD\\0-7147\\Tasks\\Task 6\\New Data\\service-life-analysis\\.app-state\\split_progress.json';

const pyCode = [
    'import sys, json, traceback',
    'RESULT_PATH = sys.argv[1]',
    'STATE_FILE  = sys.argv[2]',
    '',
    'def write_result(obj):',
    '    with open(RESULT_PATH, "w", encoding="utf-8") as _f:',
    '        json.dump(obj, _f)',
    '',
    'try:',
    '    import re, pandas as pd, numpy as np',
    '    from lifelines import KaplanMeierFitter, WeibullFitter',
    '',
    '    with open(STATE_FILE, "r", encoding="utf-8") as _f:',
    '        state = json.load(_f)',
    '',
    '    def get_rows(mode_name, event_val):',
    '        mode = state.get(mode_name, {})',
    '        verified_sns = set(mode.get("verifiedSNs", []))',
    '        pmis_rows = mode.get("pmisRows", [])',
    '        v_rows = [r for r in pmis_rows if (r.get("ID") or r.get("S/N")) in verified_sns]',
    '        v_rows = sorted(v_rows, key=lambda x: str(x.get("ID") or x.get("S/N")))',
    '        seen_base, deduped = set(), []',
    '        for r in v_rows:',
    '            val = str(r.get("ID") or r.get("S/N"))',
    '            base_id = re.sub(r"[LR]$", "", val, flags=re.IGNORECASE)',
    '            if base_id not in seen_base:',
    '                deduped.append(r)',
    '                seen_base.add(base_id)',
    '        out = []',
    '        for r in deduped:',
    '            sl = r.get("Service Life")',
    '            if sl is not None:',
    '                try: out.append({"Age": float(sl), "Event": event_val})',
    '                except Exception: pass',
    '        return out',
    '',
    '    recon = get_rows("reconstructed", 1)',
    '    insvc = get_rows("inservice", 0)',
    '',
    '    if not recon and not insvc:',
    '        write_result({"error": "No verified data available"})',
    '        sys.exit(0)',
    '',
    '    df = pd.DataFrame(recon + insvc)',
    '    kmf = KaplanMeierFitter()',
    '    kmf.fit(df["Age"], event_observed=df["Event"])',
    '',
    '    wf = WeibullFitter()',
    '    try:',
    '        wf.fit(df["Age"], event_observed=df["Event"])',
    '        w_timeline = wf.survival_function_.index.tolist()',
    '        w_survival = wf.survival_function_["Weibull_estimate"].tolist()',
    '        w_median = None if np.isinf(wf.median_survival_time_) else wf.median_survival_time_',
    '    except Exception:',
    '        w_timeline, w_survival, w_median = [], [], None',
    '',
    '    median = kmf.median_survival_time_',
    '    if np.isinf(median): median = None',
    '',
    '    write_result({',
    '        "timeline":    kmf.timeline.tolist(),',
    '        "survival":    kmf.survival_function_["KM_estimate"].tolist(),',
    '        "median":      median,',
    '        "w_timeline":  w_timeline,',
    '        "w_survival":  w_survival,',
    '        "w_median":    w_median,',
    '        "total_recon": len(recon),',
    '        "total_insvc": len(insvc),',
    '    })',
    '',
    'except Exception:',
    '    write_result({"error": traceback.format_exc()})',
    '    sys.exit(1)'
].join('\\n');

fs.writeFileSync(scriptPath, pyCode, 'utf8');

const pythonCmd = 'C:\\\\Users\\\\Samuel Alalade\\\\anaconda3\\\\python.exe';
const res = spawnSync(pythonCmd, [scriptPath, resultPath, statePath]);

console.log('stdout:', res.stdout ? res.stdout.toString() : '');
console.log('stderr:', res.stderr ? res.stderr.toString() : '');
console.log('status:', res.status);
console.log('exists:', fs.existsSync(resultPath));
if (fs.existsSync(resultPath)) {
    console.log('result:', fs.readFileSync(resultPath, 'utf8').substring(0, 200));
}
