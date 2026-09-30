const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

// ─── Base Paths ────────────────────────────────────────────────────────────────
const USER_BASE = path.resolve(
  os.homedir(),
  'OneDrive - Texas Tech University',
  'Research', 'PhD', '0-7147', 'Tasks', 'Task 6', 'New Data', 'service-life-analysis'
);
const PROJECT_ROOT   = path.resolve(__dirname, '..', '..');
const BASE_DIR       = fs.existsSync(USER_BASE) ? USER_BASE : PROJECT_ROOT;
const RAW_DIR        = path.join(BASE_DIR, 'raw-files');
const PROCESSED_DIR  = path.join(BASE_DIR, 'processed');
const SPLIT_LR_DIR   = path.join(PROCESSED_DIR, 'split-lr');
const STATE_DIR      = path.join(BASE_DIR, '.app-state');
const STATE_FILE     = path.join(STATE_DIR, 'split_progress.json');
const UI_PREFS_FILE  = path.join(STATE_DIR, 'ui_preferences.json');
const LOGS_DIR       = path.join(BASE_DIR, 'logs');
const MAP_SCRIPT     = path.join(BASE_DIR, 'generate_maps.py');
const MAPS_OUT_DIR   = path.join(__dirname, '..', 'public', 'maps');

function resolvePmisPath(explicitPath) {
  if (explicitPath && typeof explicitPath === 'string' && fs.existsSync(explicitPath)) {
    return explicitPath;
  }
  
  // Check UI preferences in both candidate state directories
  const candidatePrefs = [
    UI_PREFS_FILE,
    path.join(PROJECT_ROOT, '.app-state', 'ui_preferences.json'),
    path.join(USER_BASE, '.app-state', 'ui_preferences.json')
  ];

  for (const pf of candidatePrefs) {
    try {
      if (pf && fs.existsSync(pf)) {
        const prefs = JSON.parse(fs.readFileSync(pf, 'utf8'));
        const configuredPmis = prefs?.sourceFiles?.pmis;
        if (configuredPmis && fs.existsSync(configuredPmis)) {
          return configuredPmis;
        }
      }
    } catch (_) {}
  }

  // Fallback to local raw-files
  const rawCandidates = [
    path.join(PROJECT_ROOT, 'raw-files', 'PMIS.csv'),
    path.join(RAW_DIR, 'PMIS.csv')
  ];

  for (const rf of rawCandidates) {
    if (fs.existsSync(rf)) return rf;
  }

  return explicitPath || path.join(RAW_DIR, 'PMIS.csv');
}

// ─── Ensure directory structure exists on startup ─────────────────────────────
[PROCESSED_DIR, SPLIT_LR_DIR, STATE_DIR, LOGS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Window Setup ─────────────────────────────────────────────────────────────
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    frame: true,
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'CRCP Service Life Analysis',
  });

  // Handle popups (such as Firebase Google OAuth sign-in) in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('google.com') || url.includes('firebaseapp.com') || url.includes('accounts.google')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 500,
          height: 600,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        }
      };
    }
    return { action: 'deny' };
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const devUrl = process.env.VITE_DEV_SERVER_URL;

    // Retry with exponential backoff whenever the page fails to load.
    // Handles Vite dep-optimization restarts (which briefly drop the server).
    // Backoff: 1.5s → 3s → 6s → 8s (cap) up to 10 retries ≈ 60s total patience.
    let retryCount = 0;
    let retryTimer = null;
    const MAX_RETRIES = 10;

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, failedUrl) => {
      if (typeof failedUrl === 'string' && failedUrl.startsWith('http://localhost')) {
        retryCount++;
        if (retryCount > MAX_RETRIES) {
          console.error(`[Electron] Vite did not come back after ${MAX_RETRIES} retries. Giving up.`);
          return;
        }
        const delay = Math.min(1500 * Math.pow(1.5, retryCount - 1), 8000);
        console.log(`[Electron] Vite not ready (${errorCode}) — retry ${retryCount}/${MAX_RETRIES} in ${Math.round(delay)}ms…`);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.loadURL(devUrl);
          }
        }, delay);
      }
    });

    // Reset retry counter on successful load
    mainWindow.webContents.on('did-finish-load', () => {
      clearTimeout(retryTimer);
      retryCount = 0;
    });

    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}


app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: Read raw file as buffer ─────────────────────────────────────────────
ipcMain.handle('read-file-buffer', async (_, { filename, fullPath }) => {
  if (fullPath && typeof fullPath !== 'string') fullPath = undefined;
  let filePath = fullPath;
  if (!filePath || !fs.existsSync(filePath)) {
    const projectRaw = path.resolve(PROJECT_ROOT, 'raw-files', filename);
    if (fs.existsSync(projectRaw)) filePath = projectRaw;
    else filePath = path.join(RAW_DIR, filename);
  }
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return Array.from(fs.readFileSync(filePath));
});

// ─── IPC: Read PMIS CSV as latin1 text ────────────────────────────────────────
ipcMain.handle('read-pmis-text', async (_, fullPath) => {
  if (fullPath && typeof fullPath !== 'string') fullPath = undefined;
  const filePath = resolvePmisPath(fullPath);
  if (!fs.existsSync(filePath)) throw new Error(`PMIS file not found: ${filePath}`);
  return fs.readFileSync(filePath, 'latin1');
});

// ─── IPC: Write Excel file to a user-chosen absolute path ────────────────────
// fullPath comes from the Save-As dialog — honours whatever folder the user picked.
ipcMain.handle('write-excel', async (_, { fullPath, filename, bufferArray }) => {
  const filePath = fullPath || path.join(SPLIT_LR_DIR, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(bufferArray));
  return filePath;
});

// ─── IPC: Show Save-As dialog defaulting to split-lr subfolder ───────────────
ipcMain.handle('show-save-dialog', async (_, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Split L/R Dataset',
    defaultPath: path.join(SPLIT_LR_DIR, defaultName),
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
  });
  return result.canceled ? null : result.filePath;
});

// ─── IPC: Show Open dialog for custom source files ─────────────────────────────
ipcMain.handle('show-open-dialog', async (_, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    ...options
  });
  return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
});

// ─── IPC: Split-progress state (processing data) ─────────────────────────────
ipcMain.handle('read-state', async () => {
  if (!fs.existsSync(STATE_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return null; }
});

ipcMain.handle('write-state', async (_, stateObj) => {
  fs.writeFileSync(STATE_FILE, JSON.stringify(stateObj, null, 2), 'utf8');
  return true;
});

// ─── IPC: UI preferences (mode, tab, column visibility, etc.) ────────────────
ipcMain.handle('read-ui-prefs', async () => {
  if (!fs.existsSync(UI_PREFS_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(UI_PREFS_FILE, 'utf8')); }
  catch { return null; }
});

ipcMain.handle('write-ui-prefs', async (_, prefs) => {
  fs.writeFileSync(UI_PREFS_FILE, JSON.stringify(prefs, null, 2), 'utf8');
  return true;
});

// ─── IPC: Traffic Analysis ───────────────────────────────────────────────────
ipcMain.handle('run-traffic-analysis', async (event, mode = 'reconstructed', customPmisPath) => {
  const resultId = Math.random().toString(36).substring(2, 9);
  const outPath = path.join(app.getPath('temp'), `traffic_results_${resultId}.json`);
  const pmisPath = resolvePmisPath(customPmisPath);
  
  if (!fs.existsSync(pmisPath)) {
    throw new Error(`PMIS file not found at ${pmisPath}`);
  }

  const pyScript = path.join(__dirname, 'analyze_traffic.py');

  return new Promise((resolve, reject) => {
    const anacondaPython = path.join(os.homedir(), 'anaconda3', 'python.exe');
    const pythonCmd = fs.existsSync(anacondaPython) ? anacondaPython : (process.platform === 'win32' ? 'python' : 'python3');
    
    const proc = spawn(pythonCmd, [pyScript, STATE_FILE, pmisPath, outPath, mode]);

    proc.stdout.on('data', d => {
      const line = d.toString();
      console.log('[traffic]', line.trim());
      event.sender.send('traffic-progress', line);
    });
    proc.stderr.on('data', d => {
      console.error('[traffic stderr]', d.toString().trim());
    });
    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Traffic script exited with code ${code}`));
      } else {
        try {
          const res = JSON.parse(fs.readFileSync(outPath, 'utf8'));
          if (res.error) reject(new Error(res.error));
          else resolve(res);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
});

ipcMain.handle('export-traffic-excel', async (event, data) => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Traffic Analysis',
    defaultPath: 'Pavement_Lifecycle_Rational_Model.xlsx',
    filters: [{ name: 'Excel Files', extensions: ['xlsx'] }]
  });
  
  if (!filePath) return { canceled: true };
  
  // Create a python script specifically for exporting excel (using the xlsxwriter)
  const excelScriptPath = path.join(app.getPath('temp'), 'export_traffic.py');
  const dataPath = path.join(app.getPath('temp'), 'traffic_data.json');
  fs.writeFileSync(dataPath, JSON.stringify(data));
  
  const scriptContent = `
import pandas as pd
import json, sys
import xlsxwriter

with open(r'${dataPath.replace(/\\/g, '\\\\')}', 'r') as f:
    data = json.load(f)

results = data['results']
max_age = data['global_max_age']
out_path = r'${filePath.replace(/\\/g, '\\\\')}'

age_cols = [f"AGE_{a}" for a in range(max_age + 1)]

# Prepare data for sheet 3
sheet3_data = []
actual_mask = []
for r in results:
    row = r.copy()
    act = set()
    for c in age_cols:
        val = row.get(c)
        if val:
            row[c] = val['v']
            if val['actual']: act.add(int(c.split('_')[1]))
        else:
            row[c] = None
    sheet3_data.append(row)
    actual_mask.append(act)

df3 = pd.DataFrame(sheet3_data)
writer = pd.ExcelWriter(out_path, engine='xlsxwriter')
df3.to_excel(writer, sheet_name='Lifecycle_ESAL_Predicted', index=False)

workbook = writer.book
s3 = writer.sheets['Lifecycle_ESAL_Predicted']

f_act = workbook.add_format({'bg_color': '#C6EFCE', 'font_color': '#006100', 'border': 1})
f_pre = workbook.add_format({'bg_color': '#FFEB9C', 'font_color': '#9C6500', 'border': 1})

try:
    age_0_idx = df3.columns.get_loc("AGE_0")
    for r_idx, actual_ages in enumerate(actual_mask):
        row_num = r_idx + 1
        m_age = max([a for a in range(max_age + 1) if pd.notna(df3.iloc[r_idx].get(f"AGE_{a}"))] + [0])
        for a in range(m_age + 1):
            val = df3.iloc[r_idx].get(f"AGE_{a}")
            if pd.notna(val):
                s3.write(row_num, age_0_idx + a, val, f_act if a in actual_ages else f_pre)
except Exception as e:
    print(e)

writer.close()
print("SUCCESS")
`;
  
  fs.writeFileSync(excelScriptPath, scriptContent);
  
  return new Promise((resolve, reject) => {
    const anacondaPython = path.join(os.homedir(), 'anaconda3', 'python.exe');
    const pythonCmd = fs.existsSync(anacondaPython) ? anacondaPython : (process.platform === 'win32' ? 'python' : 'python3');
    
    const proc = spawn(pythonCmd, [excelScriptPath]);
    proc.on('close', code => {
      if (code === 0) resolve({ success: true, filePath });
      else reject(new Error('Export failed'));
    });
  });
});

// ─── IPC: Map Points Extraction ──────────────────────────────────────────────────
ipcMain.handle('run-survival-analysis', async () => {
  const tmpDir     = os.tmpdir();
  const uuid       = require('crypto').randomUUID();
  const scriptPath = path.join(tmpDir, `survival_script_${uuid}.py`);
  const resultPath = path.join(tmpDir, `survival_result_${uuid}.json`);

  // Python script receives RESULT_PATH and STATE_FILE as argv[1] and argv[2]
  // so NO path escaping is needed inside the script string.
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
    '        eol_map = mode.get("actualEndOfLifeMap", {})',
    '        yc_map = mode.get("actualYearConstMap", {})',
    '        v_rows = [r for r in pmis_rows if (r.get("ID") or r.get("S/N")) in verified_sns]',
    '        out = []',
    '        for r in v_rows:',
    '            id_val = str(r.get("ID") or r.get("S/N"))',
    '            ',
    '            sl = 0',
    '            if mode_name == "inservice":',
    '                orig_yc = float(r.get("Year Constructed", 0) or 0)',
    '                active_yc = float(yc_map[id_val]) if str(yc_map.get(id_val, "")) != "" else orig_yc',
    `                if active_yc > 0:`,
    `                    sl = ${new Date().getFullYear()} - active_yc`,
    '            else:',
    '                orig_yc = float(r.get("Year Constructed", 0) or 0)',
    '                eol_to_use = float(eol_map[id_val]) if str(eol_map.get(id_val, "")) != "" else float(r.get("End of Life", 0) or 0)',
    '                if orig_yc > 0 and eol_to_use > 0:',
    '                    sl = eol_to_use - orig_yc',
    '            ',
    '            if sl <= 0:',
    '                continue',
    '            out.append({"Age": float(sl), "Event": event_val})',
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
    '    w_timeline = []',
    '    w_survival = []',
    '    w_rho = None',
    '    w_lambda = None',
    '    try:',
    '        wb = WeibullFitter()',
    '        wb.fit(df["Age"], event_observed=df["Event"])',
    '        w_timeline = np.linspace(0, max(kmf.timeline.tolist()) + 30, 100).tolist()',
    '        w_survival = wb.survival_function_at_times(w_timeline).tolist()',
    '        w_rho = wb.rho_',
    '        w_lambda = wb.lambda_',
    '    except Exception as e:',
    '        pass',
    '',
    '    # --- Reconstructed Only ---',
    '    r_timeline = []',
    '    r_survival = []',
    '    w_r_timeline = []',
    '    w_r_survival = []',
    '    w_r_rho = None',
    '    w_r_lambda = None',
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
    '        try:',
    '            wb_r = WeibullFitter()',
    '            wb_r.fit(df_recon["Age"], event_observed=df_recon["Event"])',
    '            w_r_timeline = np.linspace(0, max(kmf_recon.timeline.tolist()) + 30, 100).tolist()',
    '            w_r_survival = wb_r.survival_function_at_times(w_r_timeline).tolist()',
    '            w_r_rho = wb_r.rho_',
    '            w_r_lambda = wb_r.lambda_',
    '        except Exception:',
    '            pass',
    '',
    '    # --- Sensitivity Analysis ---',
    '    sens_10_timeline = []',
    '    sens_10_survival = []',
    '    sens_10_median = None',
    '    sens_20_timeline = []',
    '    sens_20_survival = []',
    '    sens_20_median = None',
    '',
    '    def get_simulated_data(percent):',
    '        sim_df = df.copy()',
    '        censored_df = sim_df[sim_df["Event"] == 0]',
    '        num_to_fail = int(len(censored_df) * percent)',
    '        if num_to_fail > 0:',
    '            fail_indices = censored_df.sample(n=num_to_fail, random_state=42).index',
    '            sim_df.loc[fail_indices, "Event"] = 1',
    '        return sim_df',
    '',
    '    try:',
    '        df_10 = get_simulated_data(0.10)',
    '        kmf_10 = KaplanMeierFitter()',
    '        kmf_10.fit(df_10["Age"], event_observed=df_10["Event"])',
    '        sens_10_timeline = kmf_10.timeline.tolist()',
    '        sens_10_survival = kmf_10.survival_function_["KM_estimate"].tolist()',
    '        sens_10_median = kmf_10.median_survival_time_',
    '        if np.isinf(sens_10_median): sens_10_median = None',
    '',
    '        df_20 = get_simulated_data(0.20)',
    '        kmf_20 = KaplanMeierFitter()',
    '        kmf_20.fit(df_20["Age"], event_observed=df_20["Event"])',
    '        sens_20_timeline = kmf_20.timeline.tolist()',
    '        sens_20_survival = kmf_20.survival_function_["KM_estimate"].tolist()',
    '        sens_20_median = kmf_20.median_survival_time_',
    '        if np.isinf(sens_20_median): sens_20_median = None',
    '    except Exception:',
    '        pass',
    '',
    '    write_result({',
    '        "timeline":    kmf.timeline.tolist(),',
    '        "survival":    kmf.survival_function_["KM_estimate"].tolist(),',
    '        "median":      median,',
    '        "r_timeline":  r_timeline,',
    '        "r_survival":  r_survival,',
    '        "r_median":    r_median,',
    '        "w_timeline":  w_timeline,',
    '        "w_survival":  w_survival,',
    '        "w_rho":       w_rho,',
    '        "w_lambda":    w_lambda,',
    '        "w_r_timeline": w_r_timeline,',
    '        "w_r_survival": w_r_survival,',
    '        "w_r_rho":     w_r_rho,',
    '        "w_r_lambda":  w_r_lambda,',
    '        "sens_10_timeline": sens_10_timeline,',
    '        "sens_10_survival": sens_10_survival,',
    '        "sens_10_median": sens_10_median,',
    '        "sens_20_timeline": sens_20_timeline,',
    '        "sens_20_survival": sens_20_survival,',
    '        "sens_20_median": sens_20_median,',
    '        "total_recon": len(recon),',
    '        "total_insvc": len(insvc),',
    '    })',
    '',
    'except Exception:',
    '    write_result({"error": traceback.format_exc()})',
    '    sys.exit(1)',
  ].join('\n');

  fs.writeFileSync(scriptPath, pyCode, 'utf8');

  return new Promise((resolve, reject) => {
    const anacondaPython = path.join(os.homedir(), 'anaconda3', 'python.exe');
    const pythonCmd = fs.existsSync(anacondaPython)
      ? anacondaPython
      : (process.platform === 'win32' ? 'python' : 'python3');

    // Pass paths as CLI args — no escaping needed
    // Pass paths as CLI args — no escaping needed
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
            return reject(new Error("Failed to parse Python result (JSON Error): " + parseErr.message + "\nRaw: " + raw.substring(0, 300)));
          }
        } catch (readErr) {
          console.error('[survival] File read error:', readErr);
        }
      }

      const detail = stderrStr || stdoutStr || 'Python produced no output (code ' + code + ')';
      console.error('[survival] Python failed:', detail);
      reject(new Error('Python script failed:\n' + detail));
    });
  });
});

// ─── IPC: Traffic Survival Analysis ──────────────────────────────────────────
ipcMain.handle('run-survival-analysis-traffic', async () => {
  const tmpDir     = os.tmpdir();
  const uuid       = require('crypto').randomUUID();
  const scriptPath = path.join(tmpDir, `survival_traffic_script_${uuid}.py`);
  const resultPath = path.join(tmpDir, `survival_traffic_result_${uuid}.json`);

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
  ].join('\n');

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
            return reject(new Error("Failed to parse Python result (JSON Error): " + parseErr.message + "\nRaw: " + raw.substring(0, 300)));
          }
        } catch (readErr) {
          console.error('[survival] File read error:', readErr);
        }
      }

      const detail = stderrStr || stdoutStr || 'Python produced no output (code ' + code + ')';
      console.error('[survival] Python failed:', detail);
      reject(new Error('Python script failed:\n' + detail));
    });
  });
});

// ─── IPC: Traffic Survival Analysis by Slab Thickness ──────────────────────────
ipcMain.handle('run-survival-analysis-traffic-slab', async () => {
  const tmpDir     = os.tmpdir();
  const uuid       = require('crypto').randomUUID();
  const scriptPath = path.join(tmpDir, `survival_traffic_slab_script_${uuid}.py`);
  const resultPath = path.join(tmpDir, `survival_traffic_slab_result_${uuid}.json`);

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
    '        mode = state.get(mode_name, {})',
    '        verified_sns = set(mode.get("verifiedSNs", []))',
    '        pmis_rows = mode.get("pmisRows", [])',
    '        ',
    '        slab_map = {}',
    '        for pr in pmis_rows:',
    '            i = str(pr.get("ID") or pr.get("S/N"))',
    '            st = pr.get("Slab Th")',
    '            if st is None:',
    '                st = pr.get("Old Slab Th")',
    '            if st is not None:',
    '                try: slab_map[i] = float(st)',
    '                except ValueError: pass',
    '',
    '        out = []',
    '        for r in traffic_data:',
    '            id_val = str(r.get("ID") or r.get("S/N"))',
    '            if id_val not in verified_sns:',
    '                continue',
    '            esal = float(r.get("CUMULATIVE_ESAL", 0) or 0)',
    '            if esal <= 0:',
    '                continue',
    '            slab_th = slab_map.get(id_val)',
    '            if slab_th is not None:',
    '                out.append({"Age": esal / 1000000.0, "Event": event_val, "SlabTh": slab_th})',
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
    '    results = {}',
    '    for th, group in df.groupby("SlabTh"):',
    '        kmf = KaplanMeierFitter()',
    '        kmf.fit(group["Age"], event_observed=group["Event"])',
    '        median = kmf.median_survival_time_',
    '        if np.isinf(median): median = None',
    '        results[str(th)] = {',
    '            "timeline": kmf.timeline.tolist(),',
    '            "survival": kmf.survival_function_["KM_estimate"].tolist(),',
    '            "median": median,',
    '            "count": len(group)',
    '        }',
    '',
    '    write_result(results)',
    '',
    'except Exception:',
    '    write_result({"error": traceback.format_exc()})',
    '    sys.exit(1)',
  ].join('\n');

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

// ─── IPC: Survival Analysis by Slab Thickness ────────────────────────────────
ipcMain.handle('run-survival-analysis-slab', async () => {
  const tmpDir     = os.tmpdir();
  const uuid       = require('crypto').randomUUID();
  const scriptPath = path.join(tmpDir, `survival_slab_script_${uuid}.py`);
  const resultPath = path.join(tmpDir, `survival_slab_result_${uuid}.json`);

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
    '        mode = state.get(mode_name, {})',
    '        verified_sns = set(mode.get("verifiedSNs", []))',
    '        pmis_rows = mode.get("pmisRows", [])',
    '        eol_map = mode.get("actualEndOfLifeMap", {})',
    '        yc_map = mode.get("actualYearConstMap", {})',
    '        v_rows = [r for r in pmis_rows if (r.get("ID") or r.get("S/N")) in verified_sns]',
    '        out = []',
    '        for r in v_rows:',
    '            id_val = str(r.get("ID") or r.get("S/N"))',
    '            yc = float(r.get("Year Constructed", 0) or 0)',
    '            if str(yc_map.get(id_val, "")) != "":',
    '                yc = float(yc_map[id_val])',
    '',
    '            sl = float(r.get("Service Life", 0) or 0)',
    '            if str(eol_map.get(id_val, "")) != "" and yc > 0:',
    '                sl = float(eol_map[id_val]) - yc',
    '',
    '            slab_th = r.get("Slab Th")',
    '            if slab_th is None:',
    '                slab_th = r.get("Old Slab Th")',
    '',
    '            if slab_th is not None:',
    '                try: slab_th = float(slab_th)',
    '                except ValueError: slab_th = None',
    '',
    '            if sl >= 0 and slab_th is not None:',
    '                out.append({"Age": float(sl), "Event": event_val, "SlabTh": slab_th})',
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
    '    results = {}',
    '    for th, group in df.groupby("SlabTh"):',
    '        kmf = KaplanMeierFitter()',
    '        kmf.fit(group["Age"], event_observed=group["Event"])',
    '        median = kmf.median_survival_time_',
    '        if np.isinf(median): median = None',
    '        results[str(th)] = {',
    '            "timeline": kmf.timeline.tolist(),',
    '            "survival": kmf.survival_function_["KM_estimate"].tolist(),',
    '            "median": median,',
    '            "count": len(group)',
    '        }',
    '',
    '    write_result(results)',
    '',
    'except Exception:',
    '    write_result({"error": traceback.format_exc()})',
    '    sys.exit(1)',
  ].join('\n');

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
            return reject(new Error("Failed to parse Python result (JSON Error): " + parseErr.message + "\nRaw: " + raw.substring(0, 300)));
          }
        } catch (readErr) {
          console.error('[survival] File read error:', readErr);
        }
      }

      const detail = stderrStr || stdoutStr || 'Python produced no output (code ' + code + ')';
      console.error('[survival] Python failed:', detail);
      reject(new Error('Python script failed:\n' + detail));
    });
  });
});

// ─── IPC: Survival Analysis by Base Thickness ────────────────────────────────
ipcMain.handle('run-survival-analysis-base', async () => {
  const tmpDir     = os.tmpdir();
  const uuid       = require('crypto').randomUUID();
  const scriptPath = path.join(tmpDir, `survival_base_script_${uuid}.py`);
  const resultPath = path.join(tmpDir, `survival_base_result_${uuid}.json`);

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
    '        mode = state.get(mode_name, {})',
    '        verified_sns = set(mode.get("verifiedSNs", []))',
    '        pmis_rows = mode.get("pmisRows", [])',
    '        eol_map = mode.get("actualEndOfLifeMap", {})',
    '        yc_map = mode.get("actualYearConstMap", {})',
    '        v_rows = [r for r in pmis_rows if (r.get("ID") or r.get("S/N")) in verified_sns]',
    '        out = []',
    '        for r in v_rows:',
    '            id_val = str(r.get("ID") or r.get("S/N"))',
    '            yc = float(r.get("Year Constructed", 0) or 0)',
    '            if str(yc_map.get(id_val, "")) != "":',
    '                yc = float(yc_map[id_val])',
    '',
    '            sl = float(r.get("Service Life", 0) or 0)',
    '            if str(eol_map.get(id_val, "")) != "" and yc > 0:',
    '                sl = float(eol_map[id_val]) - yc',
    '',
    '            base_th = r.get("Base Th")',
    '            if base_th is None or str(base_th).strip() == "":',
    '                base_th = r.get("Base_1")',
    '',
    '            if base_th is not None:',
    '                try: base_th = float(base_th)',
    '                except ValueError: base_th = None',
    '',
    '            if sl >= 0 and base_th is not None:',
    '                out.append({"Age": float(sl), "Event": event_val, "BaseTh": base_th})',
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
    '    results = {}',
    '    for th, group in df.groupby("BaseTh"):',
    '        kmf = KaplanMeierFitter()',
    '        kmf.fit(group["Age"], event_observed=group["Event"])',
    '        median = kmf.median_survival_time_',
    '        if np.isinf(median): median = None',
    '        results[str(th)] = {',
    '            "timeline": kmf.timeline.tolist(),',
    '            "survival": kmf.survival_function_["KM_estimate"].tolist(),',
    '            "median": median,',
    '            "count": len(group)',
    '        }',
    '',
    '    write_result(results)',
    '',
    'except Exception:',
    '    write_result({"error": traceback.format_exc()})',
    '    sys.exit(1)',
  ].join('\n');

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

// ─── IPC: Directory paths info ────────────────────────────────────────────────
ipcMain.handle('get-paths', async () => ({
  baseDir:      BASE_DIR,
  rawDir:       RAW_DIR,
  processedDir: PROCESSED_DIR,
  splitLRDir:   SPLIT_LR_DIR,
  stateDir:     STATE_DIR,
  logsDir:      LOGS_DIR,
}));

// ─── IPC: Generate Maps via Python ───────────────────────────────────────────
ipcMain.handle('generate-maps', async (event) => {
  if (!fs.existsSync(MAPS_OUT_DIR)) fs.mkdirSync(MAPS_OUT_DIR, { recursive: true });

  const base_downloads = path.join(os.homedir(), 'Downloads');
  const statewide      = path.join(base_downloads, 'TxDOT Statewide');
  const district_shp   = path.join(statewide, 'TxDOT_Districts', 'TxDOT_Districts.shp');
  const markers_gdb    = path.join(statewide, 'TxDOT_Reference_Markers_-3319492179985110783', '3f843393-22ab-44c8-a9a2-7e85b5dfe25a.gdb');

  // Write the Python script
  const script = `
import geopandas as gpd
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import json, re, os

state_file   = r'${STATE_FILE.replace(/\\/g, '\\\\')}'
district_shp = r'${district_shp.replace(/\\/g, '\\\\')}'
markers_gdb  = r'${markers_gdb.replace(/\\/g, '\\\\')}'
output_folder= r'${MAPS_OUT_DIR.replace(/\\/g, '\\\\')}'

os.makedirs(output_folder, exist_ok=True)

def normalize_hwy(hwy):
    if pd.isna(hwy): return ""
    s = str(hwy).upper().strip().replace(" ","").replace("-","")
    import re as _re
    s = _re.sub(r'[RLKAX]$','',s)
    m = _re.match(r"([A-Z]+)0*(\\d+)",s)
    return f"{m.group(1)}{m.group(2)}" if m else s

print("1/4 Loading shapefiles...", flush=True)
district_map = gpd.read_file(district_shp)
markers      = gpd.read_file(markers_gdb, engine="fiona")
district_map['DIST_CLEAN'] = district_map['DIST_NM'].astype(str).str.upper().str.replace(" ","")
markers['DIST_CLEAN']      = markers['DIST_NM'].astype(str).str.upper().str.replace(" ","")
markers['hwy_key']         = markers['RTE_NM'].apply(normalize_hwy)
m_col = 'MRKR_NBR' if 'MRKR_NBR' in markers.columns else 'M_NBR'
markers['TRM_NUM'] = pd.to_numeric(markers[m_col], errors='coerce').fillna(0).astype(int)

print("2/4 Reading verified sections from app state...", flush=True)
with open(state_file) as f:
    state = json.load(f)

def get_verified_rows(mode_data):
    verified = set(mode_data.get('verifiedSNs', []))
    rows = mode_data.get('pmisRows', [])
    v_rows = [r for r in rows if (r.get('ID') or r.get('S/N')) in verified]
    
    import re
    
    # Deduplicate by base ID (strip trailing L or R)
    # Sort to ensure '1L' is processed before '1R', so we keep '1L' if both exist
    v_rows = sorted(v_rows, key=lambda x: str(x.get('ID') or x.get('S/N')))
    
    seen_base = set()
    deduped = []
    for r in v_rows:
        val = str(r.get('ID') or r.get('S/N'))
        base_id = re.sub(r'[LR]$', '', val, flags=re.IGNORECASE)
        if base_id not in seen_base:
            deduped.append(r)
            seen_base.add(base_id)
    return deduped

recon_rows = get_verified_rows(state.get('reconstructed', {}))
insvc_rows = get_verified_rows(state.get('inservice', {}))
print(f"   Verified reconstructed: {len(recon_rows)} | in-service: {len(insvc_rows)}", flush=True)

def rows_to_gdf(rows):
    if not rows: return gpd.GeoDataFrame()
    df = pd.DataFrame(rows)
    df.columns = [str(c).upper().strip() for c in df.columns]
    df['DIST_CLEAN'] = df['DISTRICT'].astype(str).str.upper().str.replace(" ","")
    df['hwy_key']    = df['HIGHWAY'].apply(normalize_hwy)
    df['TRM_NUM']    = pd.to_numeric(df['BEGIN REF'], errors='coerce').fillna(0).astype(int)
    # Attach a unique row ID so we can deduplicate after merge
    df['_row_id'] = range(len(df))
    merged = markers.merge(df, on=['DIST_CLEAN','hwy_key','TRM_NUM'])
    if merged.empty: return gpd.GeoDataFrame()
    # One GPS point per verified section — drop extras caused by duplicate marker entries
    merged = merged.drop_duplicates(subset=['_row_id'])
    return merged.to_crs(district_map.crs)

def district_counts_from_rows(rows):
    """Count verified sections per district using the District column directly."""
    if not rows: return {}
    df = pd.DataFrame(rows)
    df.columns = [str(c).upper().strip() for c in df.columns]
    df['DIST_CLEAN'] = df['DISTRICT'].astype(str).str.upper().str.replace(" ","")
    return df.groupby('DIST_CLEAN').size().to_dict()

print("3/4 Finding GPS coordinates...", flush=True)
recon_pts = rows_to_gdf(recon_rows)
insvc_pts = rows_to_gdf(insvc_rows)
print(f"   GPS matched: {len(recon_pts)} reconstructed | {len(insvc_pts)} in-service", flush=True)

# Counts come from District column — not from GPS merge (avoids inflation)
recon_dist_counts = district_counts_from_rows(recon_rows)
insvc_dist_counts  = district_counts_from_rows(insvc_rows)

district_map['ReconCount']    = district_map['DIST_CLEAN'].map(recon_dist_counts).fillna(0).astype(int)
district_map['InSvcCount']    = district_map['DIST_CLEAN'].map(insvc_dist_counts).fillna(0).astype(int)
district_map['CombinedCount'] = district_map['ReconCount'] + district_map['InSvcCount']


def draw_map(ax, dm, pts_list, count_col):
    dm.plot(ax=ax, facecolor='white', edgecolor='black', linewidth=0.8)
    for pts, color in pts_list:
        if not pts.empty:
            pts.plot(ax=ax, markersize=14, color=color, alpha=0.85, zorder=3)
    for _, row in dm.iterrows():
        c    = row.geometry.centroid
        abbr = str(row.get('DIST_ABBR') or row['DIST_NM'][:3]).upper()
        ax.text(c.x, c.y + 22000, abbr, ha='center', va='center',
                fontsize=9, color='darkgrey', fontweight='bold', alpha=0.7, zorder=2)
        count = row[count_col]
        if count > 0:
            ax.text(c.x, c.y - 10000, str(count), ha='center', va='center',
                    fontsize=10, color='black', fontweight='bold', zorder=4,
                    bbox=dict(boxstyle='round,pad=0.25', edgecolor='black', facecolor=(1,1,1,0.92)))
    ax.axis('off')

def draw_choropleth(ax, dm, count_col, cmap_name, edge_color):
    dm.plot(column=count_col, cmap=cmap_name, ax=ax, edgecolor='black', linewidth=0.8)
    total_count = dm[count_col].sum()
    nl = "\\n"
    for _, row in dm.iterrows():
        count = row[count_col]
        if count > 0:
            c = row.geometry.centroid
            dist_name = str(row.get('DIST_NM', '')).strip().title()
            label = dist_name + nl + str(int(count))
            ax.text(c.x, c.y, label, ha='center', va='center',
                    fontsize=8, color='black',
                    bbox=dict(boxstyle='round,pad=0.3', edgecolor='black', facecolor='white', alpha=0.9))
    ax.axis('off')
    # Add TOTAL annotation in bottom left
    plt.text(0.15, 0.1, f"TOTAL: {int(total_count)}", fontsize=12, color='black', transform=ax.transAxes,
             bbox=dict(boxstyle='round,pad=0.5', edgecolor=edge_color, facecolor='white'))

print("4/4 Generating maps...", flush=True)
for pts_list, count_col, patches, fname in [
    ([(recon_pts,'red')],                    'ReconCount',    [mpatches.Patch(color='red',   label='Reconstructed')],                                                     'reconstructed'),
    ([(insvc_pts,'green')],                  'InSvcCount',    [mpatches.Patch(color='green', label='In Service')],                                                        'inservice'),
    ([(recon_pts,'red'),(insvc_pts,'green')],'CombinedCount', [mpatches.Patch(color='red',   label='Reconstructed'), mpatches.Patch(color='green', label='In Service')], 'combined'),
]:
    fig, ax = plt.subplots(figsize=(14,10))
    draw_map(ax, district_map, pts_list, count_col)
    ax.legend(handles=patches, loc='lower right', fontsize=11, frameon=True)
    fig.tight_layout()
    fig.savefig(os.path.join(output_folder, f'{fname}.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print(f"  DONE: {fname}.png", flush=True)

# Generate point-based maps only
for pts_list, count_col, patches, fname in [
    ([(recon_pts,'red')],                    'ReconCount',    [mpatches.Patch(color='red',   label='Reconstructed')],                                                     'reconstructed'),
    ([(insvc_pts,'green')],                  'InSvcCount',    [mpatches.Patch(color='green', label='In Service')],                                                        'inservice'),
    ([(recon_pts,'red'),(insvc_pts,'green')],'CombinedCount', [mpatches.Patch(color='red',   label='Reconstructed'), mpatches.Patch(color='green', label='In Service')], 'combined'),
]:
    fig, ax = plt.subplots(figsize=(14,10))
    draw_map(ax, district_map, pts_list, count_col)
    ax.legend(handles=patches, loc='lower right', fontsize=11, frameon=True)
    fig.tight_layout()
    fig.savefig(os.path.join(output_folder, f'{fname}.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print(f"  DONE: {fname}.png", flush=True)

print("SUCCESS", flush=True)
`;

  fs.writeFileSync(MAP_SCRIPT, script, 'utf8');

  return new Promise((resolve, reject) => {
    // Use Anaconda Python which has geopandas/matplotlib installed
    const anacondaPython = path.join(os.homedir(), 'anaconda3', 'python.exe');
    const pythonCmd = fs.existsSync(anacondaPython) ? anacondaPython : (process.platform === 'win32' ? 'python' : 'python3');
    const proc = spawn(pythonCmd, [MAP_SCRIPT], { env: process.env });

    proc.stdout.on('data', d => {
      const line = d.toString();
      console.log('[map-gen]', line.trim());
      event.sender.send('map-gen-progress', line);
    });
    proc.stderr.on('data', d => {
      const line = d.toString();
      console.error('[map-gen stderr]', line.trim());
      event.sender.send('map-gen-progress', line);
    });
    proc.on('close', code => {
      if (code === 0) resolve({ success: true });
      else reject(new Error(`Python exited with code ${code}`));
    });
    proc.on('error', err => reject(new Error(`Could not start Python: ${err.message}`)));
  });
});

// ─── IPC: Generate Heatmap (Choropleth) Maps via Python ───────────────────────
const HEATMAP_SCRIPT = path.join(BASE_DIR, 'generate_heatmaps.py');

ipcMain.handle('generate-heatmaps', async (event) => {
  if (!fs.existsSync(MAPS_OUT_DIR)) fs.mkdirSync(MAPS_OUT_DIR, { recursive: true });

  const base_downloads = path.join(os.homedir(), 'Downloads');
  const statewide      = path.join(base_downloads, 'TxDOT Statewide');
  const district_shp   = path.join(statewide, 'TxDOT_Districts', 'TxDOT_Districts.shp');

  const heatmap_script = `
import geopandas as gpd
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json, os

state_file   = r'${STATE_FILE.replace(/\\/g, '\\\\')}'
district_shp = r'${district_shp.replace(/\\/g, '\\\\')}'
output_folder= r'${MAPS_OUT_DIR.replace(/\\/g, '\\\\')}'

os.makedirs(output_folder, exist_ok=True)

print("1/3 Loading shapefile...", flush=True)
district_map = gpd.read_file(district_shp)
district_map['DIST_NM']    = district_map['DIST_NM'].str.strip()
district_map['DIST_CLEAN'] = district_map['DIST_NM'].str.upper().str.replace(" ","")

print("2/3 Reading verified sections from app state...", flush=True)
with open(state_file, 'r', encoding='utf-8') as f:
    state = json.load(f)

def get_dist_counts(mode_name):
    mode = state.get(mode_name, {})
    verified_sns = set(mode.get('verifiedSNs', []))
    rows = mode.get('pmisRows', [])
    verified_rows = [r for r in rows if (r.get('ID') or r.get('S/N')) in verified_sns]
    counts = {}
    for r in verified_rows:
        dist = str(r.get('DISTRICT', '')).strip().upper().replace(' ', '')
        counts[dist] = counts.get(dist, 0) + 1
    return counts

recon_counts = get_dist_counts('reconstructed')
insvc_counts  = get_dist_counts('inservice')
print(f"   Reconstructed districts: {len(recon_counts)} | In-service districts: {len(insvc_counts)}", flush=True)

district_map['ReconCount'] = district_map['DIST_CLEAN'].map(recon_counts).fillna(0).astype(int)
district_map['InSvcCount'] = district_map['DIST_CLEAN'].map(insvc_counts).fillna(0).astype(int)

def draw_choropleth(ax, dm, count_col, cmap_name, edge_color):
    dm.plot(column=count_col, cmap=cmap_name, ax=ax, edgecolor='black', linewidth=0.8)
    total_count = dm[count_col].sum()
    newline = chr(10)
    for _, row in dm.iterrows():
        count = row[count_col]
        if count > 0:
            c = row.geometry.centroid
            dist_name = str(row.get('DIST_NM', '')).strip().title()
            label = dist_name + newline + str(int(count))
            ax.text(c.x, c.y, label, ha='center', va='center',
                    fontsize=8, color='black',
                    bbox=dict(boxstyle='round,pad=0.3', edgecolor='black', facecolor='white', alpha=0.9))
    ax.axis('off')
    plt.text(0.15, 0.08, f"TOTAL: {int(total_count)}", fontsize=12, color='black', transform=ax.transAxes,
             bbox=dict(boxstyle='round,pad=0.5', edgecolor=edge_color, facecolor='white'))

print("3/3 Generating choropleth maps...", flush=True)
for count_col, cmap_name, edge_color, fname in [
    ('ReconCount', 'Reds',   'red',   'reconstructed_choropleth'),
    ('InSvcCount', 'Greens', 'green', 'inservice_choropleth'),
]:
    fig, ax = plt.subplots(figsize=(12, 8))
    draw_choropleth(ax, district_map, count_col, cmap_name, edge_color)
    fig.tight_layout()
    fig.savefig(os.path.join(output_folder, f'{fname}.png'), dpi=300, bbox_inches='tight')
    plt.close()
    print(f"  DONE: {fname}.png", flush=True)

print("SUCCESS", flush=True)
`;

  fs.writeFileSync(HEATMAP_SCRIPT, heatmap_script, 'utf8');

  return new Promise((resolve, reject) => {
    const anacondaPython = path.join(os.homedir(), 'anaconda3', 'python.exe');
    const pythonCmd = fs.existsSync(anacondaPython) ? anacondaPython : (process.platform === 'win32' ? 'python' : 'python3');
    const proc = spawn(pythonCmd, [HEATMAP_SCRIPT], { env: process.env });

    proc.stdout.on('data', d => {
      const line = d.toString();
      console.log('[heatmap-gen]', line.trim());
      event.sender.send('heatmap-gen-progress', line);
    });
    proc.stderr.on('data', d => {
      const line = d.toString();
      console.error('[heatmap-gen stderr]', line.trim());
      event.sender.send('heatmap-gen-progress', line);
    });
    proc.on('close', code => {
      if (code === 0) resolve({ success: true });
      else reject(new Error(`Python exited with code ${code}`));
    });
    proc.on('error', err => reject(new Error(`Could not start Python: ${err.message}`)));
  });
});

// ─── IPC: ANOVA Engine ───────────────────────────────────────────────────────
ipcMain.handle('run-anova', async (event, data) => {
  const tmpDir     = os.tmpdir();
  const uuid       = require('crypto').randomUUID();
  const dataPath   = path.join(tmpDir, `anova_data_${uuid}.json`);
  
  fs.writeFileSync(dataPath, JSON.stringify(data), 'utf8');

  return new Promise((resolve, reject) => {
    const anacondaPython = path.join(os.homedir(), 'anaconda3', 'python.exe');
    const pythonCmd = fs.existsSync(anacondaPython) ? anacondaPython : (process.platform === 'win32' ? 'python' : 'python3');
    
    const scriptPath = path.join(__dirname, 'anova_engine.py');
    const py = spawn(pythonCmd, [scriptPath, dataPath]);

    let stdoutStr = '';
    let stderrStr = '';
    py.stdout.on('data', d => { stdoutStr += d.toString(); });
    py.stderr.on('data', d => { stderrStr += d.toString(); });

    py.on('error', err => {
      try { fs.unlinkSync(dataPath); } catch (_) {}
      reject(new Error('Could not start Python: ' + err.message));
    });

    py.on('close', code => {
      try { fs.unlinkSync(dataPath); } catch (_) {}

      if (code !== 0) {
        console.error('[anova] Python failed:', stderrStr);
        return reject(new Error(stderrStr || stdoutStr || 'Python script failed with code ' + code));
      }

      try {
        const result = JSON.parse(stdoutStr);
        if (result.error) return reject(new Error(result.error));
        resolve(result);
      } catch (e) {
        console.error('[anova] Failed to parse output:', stdoutStr);
        reject(new Error('Failed to parse ANOVA output: ' + e.message));
      }
    });
  });
});
