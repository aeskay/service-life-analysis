import React, { useCallback, useRef } from 'react';
import { patchSourceFilesPrefs } from '../../utils/uiPreferences';
import { storeFileInRegistry } from '../../utils/fileRegistry';

export default function SourceFilesWorkspace({ paths, uiPrefs, onUIPrefsChange, addToast }) {
  const fileInputRef = useRef(null);
  const activeKeyRef = useRef(null);

  const handleSelectFile = useCallback(async (key, title, filters) => {


    // 2. Web Browser mode fallback (Netlify / standard browser)
    activeKeyRef.current = key;
    if (fileInputRef.current) {
      fileInputRef.current.accept = key === 'pmis' ? '.csv' : '.xlsx,.xls';
      fileInputRef.current.value = ''; // Reset input
      fileInputRef.current.click();
    }
  }, [uiPrefs, onUIPrefsChange, addToast]);

  const handleWebFileChange = async (e) => {
    const file = e.target.files?.[0];
    const key = activeKeyRef.current;
    if (file && key && onUIPrefsChange && uiPrefs) {
      try {
        addToast?.('info', 'Uploading...', `Saving ${file.name} to local database and cloud storage.`);
        // 1. Store in local IndexedDB for fast access
        await storeFileInRegistry(key, file);
        
        // 2. Parse and save raw rows to Firestore if not PMIS
        if (key !== 'pmis') {
          // Dynamic import to avoid circular dependencies
          const { getActiveProjectId, saveRawSourceToCloud } = await import('../../utils/projectStore');
          const projectId = getActiveProjectId();
          if (projectId) {
            const { parseExcelBuffer } = await import('../../utils/fileLoader');
            const bufferArray = await file.arrayBuffer();
            const rawRows = await parseExcelBuffer(bufferArray);
            await saveRawSourceToCloud(projectId, key, rawRows);
            addToast?.('success', 'Cloud Upload Complete', `${file.name} is now stored securely online for this project.`);
          }
        }
        
        const displayPath = file.name;
        onUIPrefsChange(patchSourceFilesPrefs(uiPrefs, { [key]: displayPath }));
      } catch (err) {
        console.error('File upload failed:', err);
        addToast?.('error', 'Upload Failed', err.message || 'Could not save file online.');
      }
    }
  };

  const handleResetFile = useCallback((key) => {
    if (onUIPrefsChange && uiPrefs) {
      onUIPrefsChange(patchSourceFilesPrefs(uiPrefs, { [key]: null }));
      addToast?.('info', 'File Reset', 'Restored default file path.');
    }
  }, [uiPrefs, onUIPrefsChange, addToast]);

  const repairedFile = uiPrefs?.sourceFiles?.repaired || (paths ? `${paths.rawDir}\\repaired.xlsx` : 'repaired.xlsx');
  const inserviceFile = uiPrefs?.sourceFiles?.inservice || (paths ? `${paths.rawDir}\\in-service.xlsx` : 'in-service.xlsx');
  const pmisFile = uiPrefs?.sourceFiles?.pmis || (paths ? `${paths.rawDir}\\PMIS.csv` : 'PMIS.csv');

  return (
    <div className="workspace">
      {/* Hidden file input for web browser fallback */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        onChange={handleWebFileChange} 
      />

      <div className="workspace__toolbar">
        <div className="workspace__title">Source Files Configuration</div>
      </div>
      
      <div className="workspace__body" style={{ padding: 'var(--sp-6)' }}>
        
        <div style={{ maxWidth: 800 }}>
          <h2 style={{ fontSize: 'var(--text-lg)', color: 'var(--text-heading)', marginBottom: 'var(--sp-2)' }}>
            Data Inputs
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)', lineHeight: 1.5 }}>
            By default, the application looks for specific files in the <code>raw-files</code> directory within your workspace. 
            You can override these defaults by selecting custom files from your computer.
          </p>
          <div style={{ padding: 'var(--sp-3)', background: 'var(--bg-panel)', borderLeft: '4px solid var(--info)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--sp-6)' }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              <strong>Note on Cloud Projects:</strong> Repaired and In-Service Excel files are securely uploaded to your Cloud Project so you can resume work on any device. However, for performance, the massive 168MB <strong>PMIS.csv</strong> never leaves your device and must be re-selected locally if you change computers.
            </p>
          </div>
          
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
                  onClick={() => handleSelectFile('repaired', 'Select Repaired Excel File', [{ name: 'Excel', extensions: ['xlsx', 'xls'] }])}
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
                  onClick={() => handleSelectFile('inservice', 'Select In-Service Excel File', [{ name: 'Excel', extensions: ['xlsx', 'xls'] }])}
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
