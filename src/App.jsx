/**
 * App.jsx — Root application component.
 *
 * Integrates Firebase Auth & Firestore Project Management.
 * Owns global UI preferences state and active project attribution.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TopNav from './components/TopNav';
import Sidebar from './components/Sidebar';
import SplitLRWorkspace from './components/SplitLR/SplitLRWorkspace';
import MatchPMISWorkspace from './components/MatchPMIS/MatchPMISWorkspace';
import SourceFilesWorkspace from './components/SourceFiles/SourceFilesWorkspace';
import VerifyWorkspace from './components/Verify/VerifyWorkspace';
import CleanedSectionsWorkspace from './components/AverageLife/CleanedSectionsWorkspace';
import ConstructionInfoWorkspace from './components/ConstructionInfo/ConstructionInfoWorkspace';
import AverageLifeWorkspace from './components/AverageLife/AverageLifeWorkspace';
import SurvivalWorkspace from './components/AverageLife/SurvivalWorkspace';
import TrafficSurvivalWorkspace from './components/Traffic/TrafficSurvivalWorkspace';
import SurvivalSlabThicknessWorkspace from './components/AverageLife/SurvivalSlabThicknessWorkspace';
import SurvivalBaseThicknessWorkspace from './components/AverageLife/SurvivalBaseThicknessWorkspace';
import TrafficWorkspace from './components/Traffic/TrafficWorkspace';
import TrafficDistributionWorkspace from './components/Traffic/TrafficDistributionWorkspace';
import TrafficServiceLifeWorkspace from './components/Traffic/TrafficServiceLifeWorkspace';
import TrafficSlabBaseWorkspace from './components/Traffic/TrafficSlabBaseWorkspace';
import PaveTrafficHeatmapWorkspace from './components/Heatmaps/PaveTrafficHeatmapWorkspace';
import PMISGeneralTrendsWorkspace from './components/PMIS/PMISGeneralTrendsWorkspace';
import TerminalWorkspace from './components/PMIS/TerminalWorkspace';
import BeforeTerminalWorkspace from './components/PMIS/BeforeTerminalWorkspace';
import AfterTerminalCWorkspace from './components/PMIS/AfterTerminalCWorkspace';
import AfterTerminalDWorkspace from './components/PMIS/AfterTerminalDWorkspace';
import AnovaWorkspace from './components/Statistics/AnovaWorkspace';
import CoxPHWorkspace from './components/Statistics/CoxPHWorkspace';
import MapsWorkspace from './components/Maps/MapsWorkspace';
import HeatmapWorkspace from './components/Maps/HeatmapWorkspace';
import TrafficStatsWorkspace from './components/Statistics/TrafficStatsWorkspace';
import ServiceLifeStatsWorkspace from './components/Statistics/ServiceLifeStatsWorkspace';
import SlabThicknessWorkspace from './components/SlabAndBase/SlabThicknessWorkspace';
import BaseThicknessWorkspace from './components/SlabAndBase/BaseThicknessWorkspace';
import BaseTypeWorkspace from './components/SlabAndBase/BaseTypeWorkspace';
import BaseTyThWorkspace from './components/SlabAndBase/BaseTyThWorkspace';
import ToastContainer from './components/ToastContainer';
import AuthModal from './components/Auth/AuthModal';
import ProjectModal from './components/Projects/ProjectModal';
import { AuthProvider } from './context/AuthContext';
import { useToast } from './hooks/useToast';
import { useAuth } from './context/AuthContext';
import { loadUIPrefs, saveUIPrefs } from './utils/uiPreferences';
import { getActiveProjectId, setActiveProjectId, getUserProjects, createProject } from './utils/projectStore';

function AppContent() {
  const authContext = useAuth() || {};
  const currentUser = authContext.currentUser || null;

  const [paths, setPaths] = useState(null);
  const [errorCount, setErrorCount] = useState(0);
  const [uiPrefsReady, setPrefsReady] = useState(false);
  const [uiPrefs, setUIPrefs] = useState(null);

  // Auth & Project Modal states
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [activeProjectId, setActiveProjectIdState] = useState(getActiveProjectId());
  const [projectKey, setProjectKey] = useState(0); // Key used to force remount/reload workspaces when project changes

  const { toasts, addToast, removeToast } = useToast();

  // ─── Auto Sync User Active Project on Auth Login ───────────────────────────
  useEffect(() => {
    if (!currentUser) {
      // Clear session data on sign out
      localStorage.removeItem('service_life_app_state_v1');
      setActiveProjectId(null);
      setActiveProjectIdState(null);
      setProjectKey(k => k + 1);
      return;
    }

    let isMounted = true;
    async function syncActiveProject() {
      try {
        const projects = await getUserProjects(currentUser.uid);
        const currentActiveId = getActiveProjectId();

        if (projects.length > 0) {
          const activeFound = projects.find(p => p.id === currentActiveId);
          if (!activeFound || !currentActiveId) {
            const mostRecent = projects[0];
            setActiveProjectId(mostRecent.id);
            if (isMounted) {
              setActiveProjectIdState(mostRecent.id);
              setProjectKey(k => k + 1);
              addToast('info', 'Cloud Project Loaded', `Loaded active project: "${mostRecent.name}"`);
            }
          }
        } else {
          // Create initial cloud project automatically for new user
          const defaultProj = await createProject(currentUser.uid, 'Default Pavement Project', 'Automated cloud workspace');
          setActiveProjectId(defaultProj.id);
          if (isMounted) {
            setActiveProjectIdState(defaultProj.id);
            setProjectKey(k => k + 1);
            addToast('success', 'Project Initialized', `Created and opened online cloud project: "${defaultProj.name}"`);
          }
        }
      } catch (err) {
        console.warn('Error syncing active cloud project:', err);
      }
    }

    syncActiveProject();
    return () => { isMounted = false; };
  }, [currentUser, addToast]);

  // ─── Load everything from disk on first mount ──────────────────────────────
  useEffect(() => {
    loadUIPrefs().then(prefs => {
      setUIPrefs(prefs);
      setPrefsReady(true);
    });
  }, []);

  // ─── Global Event Listener for Toasts ────────────────────────────────────────
  useEffect(() => {
    const handleGlobalToast = (e) => {
      const { type, title, desc, duration } = e.detail;
      addToast(type, title, desc, duration);
    };
    window.addEventListener('app-toast', handleGlobalToast);
    return () => window.removeEventListener('app-toast', handleGlobalToast);
  }, [addToast]);

  // ─── Debounced auto-save: persist prefs 600ms after any change ─────────────
  const saveTimerRef = useRef(null);

  const handleUIPrefsChange = useCallback((updater) => {
    setUIPrefs(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveUIPrefs(next), 600);
      return next;
    });
  }, []);

  // ─── Mode change — persisted ───────────────────────────────────────────────
  const handleModeChange = useCallback((newMode) => {
    handleUIPrefsChange(prev => ({ ...prev, mode: newMode }));
    addToast(
      'info',
      `Switched to ${newMode === 'reconstructed' ? 'Reconstructed' : 'In Service'}`,
      `Loading ${newMode === 'reconstructed' ? 'repaired.xlsx' : 'in-service.xlsx'} dataset.`,
      2500
    );
  }, [handleUIPrefsChange, addToast]);

  // ─── Tab change — persisted ────────────────────────────────────────────────
  const handleTabChange = useCallback((tab) => {
    handleUIPrefsChange(prev => ({ ...prev, activeTab: tab }));
  }, [handleUIPrefsChange]);

  const handleProjectChange = useCallback((newProjectId) => {
    setActiveProjectIdState(newProjectId);
    setProjectKey(prev => prev + 1); // Trigger workspace re-render
  }, []);

  // Don't render until prefs loaded so we don't flash wrong state
  if (!uiPrefsReady || !uiPrefs) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-base)', color: 'var(--text-muted)', flexDirection: 'column', gap: 16,
      }}>
        <div className="loading-overlay__spinner" style={{ width: 32, height: 32 }} />
        <div style={{ fontSize: 'var(--text-sm)' }}>Restoring your session…</div>
      </div>
    );
  }

  const { mode, activeTab } = uiPrefs;

  return (
    <div className="app-shell" key={`project-view-${projectKey}`}>
      <TopNav 
        mode={mode} 
        onModeChange={handleModeChange} 
        paths={paths} 
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenProjectModal={() => setProjectModalOpen(true)}
        activeProjectId={activeProjectId}
      />

      <div className="main-area">
        <Sidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          errorCount={errorCount}
        />

        <main style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {uiPrefs.activeTab === 'source-files' && (
            <SourceFilesWorkspace
              paths={paths}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
              addToast={addToast}
            />
          )}

          {uiPrefs.activeTab === 'split-lr' && (
            <SplitLRWorkspace
              mode={mode}
              onErrorCountChange={setErrorCount}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'match-pmis' && (
            <MatchPMISWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'verify' && (
            <VerifyWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'cleaned-sections' && (
            <CleanedSectionsWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'construction-info' && (
            <ConstructionInfoWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'average-life' && (
            <AverageLifeWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'survival-analysis-service-life' && (
            <SurvivalWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'survival-analysis-traffic' && (
            <TrafficSurvivalWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'survival-analysis-slab-thickness' && (
            <SurvivalSlabThicknessWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'survival-analysis-base-thickness' && (
            <SurvivalBaseThicknessWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'traffic-lifecycle' && (
            <TrafficWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'traffic-distribution' && (
            <TrafficDistributionWorkspace />
          )}
          {uiPrefs.activeTab === 'traffic-service-life' && (
            <TrafficServiceLifeWorkspace />
          )}
          {uiPrefs.activeTab === 'traffic-slab-base' && (
            <TrafficSlabBaseWorkspace />
          )}
          {uiPrefs.activeTab === 'anova' && (
            <AnovaWorkspace />
          )}
          {uiPrefs.activeTab === 'cox-ph' && (
            <CoxPHWorkspace />
          )}
          {uiPrefs.activeTab === 'traffic-stats' && (
            <TrafficStatsWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'service-life-stats' && (
            <ServiceLifeStatsWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'slab-thickness' && (
            <SlabThicknessWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'base-thickness' && (
            <BaseThicknessWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'base-type' && (
            <BaseTypeWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'base-ty-th' && (
            <BaseTyThWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          
          {/* Heatmaps */}
          {uiPrefs.activeTab === 'pave-traffic-heatmap' && (
            <PaveTrafficHeatmapWorkspace />
          )}

          {/* PMIS */}
          {uiPrefs.activeTab === 'general-trends' && (
            <PMISGeneralTrendsWorkspace />
          )}
          {uiPrefs.activeTab === 'before-terminal' && (
            <BeforeTerminalWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'terminal' && (
            <TerminalWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'after-terminal-c' && (
            <AfterTerminalCWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'after-terminal-d' && (
            <AfterTerminalDWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}

          {uiPrefs.activeTab === 'section-locations' && (
            <MapsWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
          {uiPrefs.activeTab === 'district-heatmaps' && (
            <HeatmapWorkspace
              mode={mode}
              addToast={addToast}
              uiPrefs={uiPrefs}
              onUIPrefsChange={handleUIPrefsChange}
            />
          )}
        </main>
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setAuthModalOpen(false)}
        addToast={addToast}
      />

      <ProjectModal 
        isOpen={isProjectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onProjectChange={handleProjectChange}
        addToast={addToast}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
