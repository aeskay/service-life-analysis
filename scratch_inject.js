const fs = require('fs');
const path = require('path');
const os = require('os');
const mainPath = 'electron/main.js';
let main = fs.readFileSync(mainPath, 'utf8');

const newHandler = `// ─── IPC: Traffic Survival Analysis ──────────────────────────────────────────
ipcMain.handle('run-survival-analysis-traffic', async () => {
  const tmpDir     = os.tmpdir();
  const uuid       = require('crypto').randomUUID();
  const scriptPath = path.join(tmpDir, \`survival_traffic_script_\${uuid}.py\`);
  const resultPath = path.join(tmpDir, \`survival_traffic_result_\${uuid}.json\`);

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
    '    from lifelines import KaplanMeierFitter',
    '',
    '    with open(STATE_FILE, "r", encoding="utf-8") as _f:',
    '        state = json.load(_f)',
    '',
    '    def get_rows(mode_name, event_val):',
    '        traffic_data = state.get("trafficAnalysis", {}).get(mode_name, {}).get("results", [])',
    '        verified_sns = set(state.get(mode_name, {}).get("verifiedSNs", []))',
    '        out = []',
    '        for r in traffic_data:',
    '            id_val = str(r.get("ID") or r.get("S/N"))',
    '            if id_val not in verified_sns:',
    '                continue',
    '            esal = float(r.get("CUMULATIVE_ESAL", 0) or 0)',
    '            if esal <= 0:',
    '                continue',
    '            # Convert to millions for better scaling',
    '            out.append({"Age": esal / 1000000.0, "Event": event_val})',
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
    '    median = kmf.median_survival_time_',
    '    if np.isinf(median): median = None',
    '',
    '    r_timeline = []',
    '    r_survival = []',
    '    r_median = None',
    '    if recon:',
    '        df_recon = pd.DataFrame(recon)',
    '        kmf_recon = KaplanMeierFitter()',
    '        kmf_recon.fit(df_recon["Age"], event_observed=df_recon["Event"])',
    '        r_timeline = kmf_recon.timeline.tolist()',
    '        r_survival = kmf_recon.survival_function_["KM_estimate"].tolist()',
    '        r_median = kmf_recon.median_survival_time_',
    '        if np.isinf(r_median): r_median = None',
    '',
    '    write_result({',
    '        "timeline":    kmf.timeline.tolist(),',
    '        "survival":    kmf.survival_function_["KM_estimate"].tolist(),',
    '        "median":      median,',
    '        "r_timeline":  r_timeline,',
    '        "r_survival":  r_survival,',
    '        "r_median":    r_median,',
    '        "total_recon": len(recon),',
    '        "total_insvc": len(insvc),',
    '    })',
    '',
    'except Exception:',
    '    write_result({"error": traceback.format_exc()})',
    '    sys.exit(1)',
  ].join('\\n');

  fs.writeFileSync(scriptPath, pyCode, 'utf8');

  return new Promise((resolve, reject) => {
    const anacondaPython = path.join(os.homedir(), 'anaconda3', 'python.exe');
    const pythonCmd = fs.existsSync(anacondaPython)
      ? anacondaPython
      : (process.platform === 'win32' ? 'python' : 'python3');

    const py = spawn(pythonCmd, [scriptPath, resultPath, STATE_FILE]);

    let stdoutStr = '';
    let stderrStr = '';
    py.stdout.on('data', d => { stdoutStr += d.toString(); });
    py.stderr.on('data', d => { stderrStr += d.toString(); });

    py.on('error', err => {
      try { fs.unlinkSync(scriptPath); } catch (_) {}
      reject(new Error('Could not start Python: ' + err.message));
    });

    py.on('close', code => {
      try { fs.unlinkSync(scriptPath); } catch (_) {}

      if (fs.existsSync(resultPath)) {
        try {
          const raw = fs.readFileSync(resultPath, 'utf8');
          try { fs.unlinkSync(resultPath); } catch (_) {}
          
          try {
            const result = JSON.parse(raw);
            if (result.error) return reject(new Error(result.error));
            return resolve(result);
          } catch (parseErr) {
            return reject(new Error("Failed to parse Python result (JSON Error): " + parseErr.message + "\\nRaw: " + raw.substring(0, 300)));
          }
        } catch (readErr) {
          console.error('[survival] File read error:', readErr);
        }
      }

      const detail = stderrStr || stdoutStr || 'Python produced no output (code ' + code + ')';
      console.error('[survival] Python failed:', detail);
      reject(new Error('Python script failed:\\n' + detail));
    });
  });
});
`;

if (!main.includes('run-survival-analysis-traffic')) {
  main = main.replace('// ─── IPC: Survival Analysis by Slab Thickness ────────────────────────────────', newHandler + '\n// ─── IPC: Survival Analysis by Slab Thickness ────────────────────────────────');
  fs.writeFileSync(mainPath, main, 'utf8');
  console.log('Added run-survival-analysis-traffic to main.js');
} else {
  console.log('Already in main.js');
}
