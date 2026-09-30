const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Raw file I/O
  readFileBuffer: (filename, fullPath)  => ipcRenderer.invoke('read-file-buffer', { filename, fullPath }),
  readPmisText:   (fullPath)            => ipcRenderer.invoke('read-pmis-text', fullPath),

  // File dialogs
  writeExcel:     (fullPath, bufferArray) => ipcRenderer.invoke('write-excel', { fullPath, bufferArray }),
  showSaveDialog: (defaultName)         => ipcRenderer.invoke('show-save-dialog', defaultName),
  showOpenDialog: (options)             => ipcRenderer.invoke('show-open-dialog', options),

  // Split-progress data state
  readState:      ()                    => ipcRenderer.invoke('read-state'),
  writeState:     (stateObj)            => ipcRenderer.invoke('write-state', stateObj),

  // UI preferences (mode, tab, column visibility, etc.)
  readUIPrefs:    ()                    => ipcRenderer.invoke('read-ui-prefs'),
  writeUIPrefs:   (prefs)               => ipcRenderer.invoke('write-ui-prefs', prefs),

  // Directory info
  getPaths:       ()                    => ipcRenderer.invoke('get-paths'),

  // Map generation via Python
  generateMaps:       ()            => ipcRenderer.invoke('generate-maps'),
  onMapGenProgress:   (cb)          => ipcRenderer.on('map-gen-progress', (_, line) => cb(line)),
  offMapGenProgress:  ()            => ipcRenderer.removeAllListeners('map-gen-progress'),

  // Survival Analysis
  runSurvivalAnalysis: () => ipcRenderer.invoke('run-survival-analysis'),
  runSurvivalAnalysisTraffic: () => ipcRenderer.invoke('run-survival-analysis-traffic'),
  runSurvivalAnalysisTrafficSlab: () => ipcRenderer.invoke('run-survival-analysis-traffic-slab'),
  runSurvivalAnalysisSlab: () => ipcRenderer.invoke('run-survival-analysis-slab'),
  runSurvivalAnalysisBase: () => ipcRenderer.invoke('run-survival-analysis-base'),

  // Heatmap (choropleth) generation via Python
  generateHeatmaps:       ()  => ipcRenderer.invoke('generate-heatmaps'),
  onHeatmapGenProgress:   (cb) => ipcRenderer.on('heatmap-gen-progress', (_, line) => cb(line)),
  offHeatmapGenProgress:  ()  => ipcRenderer.removeAllListeners('heatmap-gen-progress'),

  // Traffic Analysis
  runTrafficAnalysis:     (mode, customPmisPath) => ipcRenderer.invoke('run-traffic-analysis', mode, customPmisPath),
  onTrafficProgress:      (cb) => ipcRenderer.on('traffic-progress', (_, line) => cb(line)),
  offTrafficProgress:     ()  => ipcRenderer.removeAllListeners('traffic-progress'),
  exportTrafficExcel:     (data) => ipcRenderer.invoke('export-traffic-excel', data),
  
  // ANOVA Analysis
  runAnova: (data) => ipcRenderer.invoke('run-anova', data),
});
