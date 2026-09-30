import React, { useCallback } from 'react';
import { patchSourceFilesPrefs } from '../../utils/uiPreferences';

export default function SourceFilesWorkspace({ paths, uiPrefs, onUIPrefsChange, addToast }) {
  
  const handleSelectFile = useCallback(async (key, title, filters) => {
    if (!window.electronAPI) return;
    try {
      const filePath = await window.electronAPI.showOpenDialog({
        title,
        filters
      });
      
      if (filePath && onUIPrefsChange && uiPrefs) {
        onUIPrefsChange(patchSourceFilesPrefs(uiPrefs, { [key]: filePath }));
        addToast('success', 'File Updated', `Selected: ${filePath}`);
      }
    } catch (err) {
      addToast('error', 'Selection Failed', err.message);
    }
  }, [uiPrefs, onUIPrefsChange, addToast]);
  
  const handleResetFile = useCallback((key) => {
    if (onUIPrefsChange && uiPrefs) {
      onUIPrefsChange(patchSourceFilesPrefs(uiPrefs, { [key]: null }));
      addToast('info', 'File Reset', 'Restored default file path.');
    }
  }, [uiPrefs, onUIPrefsChange, addToast]);

  const repairedFile = uiPrefs?.sourceFiles?.repaired || (paths ? `${paths.rawDir}\\repaired.xlsx` : 'repaired.xlsx');
  const inserviceFile = uiPrefs?.sourceFiles?.inservice || (paths ? `${paths.rawDir}\\in-service.xlsx` : 'in-service.xlsx');
  const pmisFile = uiPrefs?.sourceFiles?.pmis || (paths ? `${paths.rawDir}\\PMIS.csv` : 'PMIS.csv');

  return (
    <div className="workspace">
      <div className="workspace__toolbar">
        <div className="workspace__title">Source Files Configuration</div>
      </div>
      
      <div className="workspace__body" style={{ padding: 'var(--sp-6)' }}>
        
        <div style={{ maxWidth: 800 }}>
          <h2 style={{ fontSize: 'var(--text-lg)', color: 'var(--text-heading)', marginBottom: 'var(--sp-2)' }}>
            Data Inputs
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-6)', lineHeight: 1.5 }}>
            By default, the application looks for specific files in the <code>raw-files</code> directory within your workspace. 
            You can override these defaults by selecting custom files from your computer.
          </p>
          
          {/* Repaired Excel */}
          <div style={{ marginBottom: 'var(--sp-6)', padding: 'var(--sp-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: 'var(--sp-1)' }}>Repaired Excel File</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Used in Reconstructed mode.</div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                {uiPrefs?.sourceFiles?.repaired && (
                  <button className="btn btn--secondary" onClick={() => handleResetFile('repaired')}>Reset to Default</button>
                )}
                <button 
                  className="btn btn--primary" 
                  onClick={() => handleSelectFile('repaired', 'Select Repaired Excel File', [{ name: 'Excel', extensions: ['xlsx'] }])}
                >
                  Change File
                </button>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: uiPrefs?.sourceFiles?.repaired ? 'var(--info)' : 'var(--text-secondary)', background: 'var(--bg-panel)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
              {repairedFile}
            </div>
          </div>

          {/* In-Service Excel */}
          <div style={{ marginBottom: 'var(--sp-6)', padding: 'var(--sp-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: 'var(--sp-1)' }}>In-Service Excel File</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Used in In-Service mode.</div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                {uiPrefs?.sourceFiles?.inservice && (
                  <button className="btn btn--secondary" onClick={() => handleResetFile('inservice')}>Reset to Default</button>
                )}
                <button 
                  className="btn btn--primary" 
                  onClick={() => handleSelectFile('inservice', 'Select In-Service Excel File', [{ name: 'Excel', extensions: ['xlsx'] }])}
                >
                  Change File
                </button>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: uiPrefs?.sourceFiles?.inservice ? 'var(--info)' : 'var(--text-secondary)', background: 'var(--bg-panel)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
              {inserviceFile}
            </div>
          </div>

          {/* PMIS CSV */}
          <div style={{ marginBottom: 'var(--sp-6)', padding: 'var(--sp-4)', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-2)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-heading)', marginBottom: 'var(--sp-1)' }}>PMIS Database (CSV)</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Used across all modes for range matching.</div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                {uiPrefs?.sourceFiles?.pmis && (
                  <button className="btn btn--secondary" onClick={() => handleResetFile('pmis')}>Reset to Default</button>
                )}
                <button 
                  className="btn btn--primary" 
                  onClick={() => handleSelectFile('pmis', 'Select PMIS CSV File', [{ name: 'CSV', extensions: ['csv'] }])}
                >
                  Change File
                </button>
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: uiPrefs?.sourceFiles?.pmis ? 'var(--info)' : 'var(--text-secondary)', background: 'var(--bg-panel)', padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)' }}>
              {pmisFile}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
