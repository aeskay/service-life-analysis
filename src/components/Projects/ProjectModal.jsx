import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  getUserProjects, 
  createProject, 
  deleteProjectFromCloud, 
  getActiveProjectId, 
  setActiveProjectId 
} from '../../utils/projectStore';
import { loadState } from '../../utils/stateStore';

export default function ProjectModal({ isOpen, onClose, onProjectChange, addToast }) {
  const authContext = useAuth() || {};
  const currentUser = authContext.currentUser || null;
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  
  // New Project Form State
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const activeId = getActiveProjectId();

  useEffect(() => {
    if (isOpen && currentUser) {
      fetchProjects();
    }
  }, [isOpen, currentUser]);

  async function fetchProjects() {
    setLoading(true);
    try {
      const list = await getUserProjects(currentUser.uid);
      setProjects(list);
    } catch (err) {
      console.error(err);
      addToast?.('error', 'Failed Loading Projects', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!projectName.trim()) return;

    try {
      setCreating(true);
      const newProj = await createProject(currentUser.uid, projectName.trim(), projectDesc.trim());
      addToast?.('success', 'Project Created', `Project "${newProj.name}" created successfully.`);
      setActiveProjectId(newProj.id);
      
      setProjectName('');
      setProjectDesc('');
      setActiveTab('list');
      
      await fetchProjects();
      if (onProjectChange) onProjectChange(newProj.id);
      onClose();
    } catch (err) {
      console.error(err);
      addToast?.('error', 'Project Creation Failed', err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleOpenProject(projectId) {
    setActiveProjectId(projectId);
    addToast?.('info', 'Project Opened', 'Loaded cloud project state.');
    if (onProjectChange) onProjectChange(projectId);
    onClose();
  }

  async function handleDelete(projectId, name) {
    if (!window.confirm(`Are you sure you want to delete project "${name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await deleteProjectFromCloud(projectId);
      addToast?.('info', 'Project Deleted', `Deleted project "${name}".`);
      if (activeId === projectId) {
        setActiveProjectId(null);
        if (onProjectChange) onProjectChange(null);
      }
      await fetchProjects();
    } catch (err) {
      console.error(err);
      addToast?.('error', 'Delete Failed', err.message);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{
        background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border-subtle)',
        width: 520, maxWidth: '92%', height: 480, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-main)' }}>
              Project Management
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Cloud-synced analysis projects for {currentUser?.email}
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {/* Tab Buttons */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12, marginBottom: 16 }}>
          <button 
            className={`btn ${activeTab === 'list' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setActiveTab('list')}
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            📁 My Projects ({projects.length})
          </button>
          <button 
            className={`btn ${activeTab === 'create' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setActiveTab('create')}
            style={{ fontSize: 13, padding: '6px 12px' }}
          >
            ➕ Create New Project
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'list' && (
            <>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <div className="loading-overlay__spinner" style={{ width: 28, height: 28 }} />
                </div>
              ) : projects.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto', padding: 20 }}>
                  No saved cloud projects found.<br />Create a new project to save your work online!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {projects.map(p => {
                    const isActive = p.id === activeId;
                    return (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', borderRadius: 8,
                        background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-base)',
                        border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)'
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            {p.name}
                            {isActive && (
                              <span style={{ fontSize: 11, background: 'var(--accent-primary)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>
                                Active
                              </span>
                            )}
                          </div>
                          {p.description && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                              {p.description}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          {!isActive ? (
                            <button 
                              className="btn btn--primary btn--sm" 
                              onClick={() => handleOpenProject(p.id)}
                            >
                              Open
                            </button>
                          ) : (
                            <button className="btn btn--secondary btn--sm" disabled>
                              Loaded
                            </button>
                          )}
                          <button 
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDelete(p.id, p.name)}
                            title="Delete Project"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Project Name *</label>
                <input 
                  type="text" 
                  required 
                  value={projectName} 
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. IH0010 Houston District 2026"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 6,
                    border: '1px solid var(--border-subtle)', background: 'var(--bg-base)',
                    color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Description (Optional)</label>
                <textarea 
                  value={projectDesc} 
                  onChange={e => setProjectDesc(e.target.value)}
                  placeholder="Brief notes about this pavement analysis project..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 6,
                    border: '1px solid var(--border-subtle)', background: 'var(--bg-base)',
                    color: 'var(--text-main)', fontSize: 14, boxSizing: 'border-box', resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button 
                  type="button" 
                  className="btn btn--secondary" 
                  onClick={() => setActiveTab('list')}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creating}
                  className="btn btn--primary"
                >
                  {creating ? 'Creating...' : 'Create & Open Project'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
