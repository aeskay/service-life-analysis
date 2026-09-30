/**
 * TopNav.jsx — Application top navigation bar
 * Includes brand identity, global Reconstructed / In Service toggle,
 * Firebase Auth controls, and active Cloud Project selector.
 */
import React, { useRef, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getActiveProjectId, getUserProjects } from '../utils/projectStore';

// SVG Icons
const RoadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3v18M16 3v18M3 8h18M3 16h18" />
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const FolderIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);

const UserIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const modes = [
  { id: 'reconstructed', label: 'Reconstructed' },
  { id: 'inservice',     label: 'In Service'    },
];

export default function TopNav({ mode, onModeChange, onOpenAuthModal, onOpenProjectModal, activeProjectId }) {
  const pillRef = useRef(null);
  const [thumbStyle, setThumbStyle] = useState({ left: 3, width: 0 });
  const authContext = useAuth();
  const currentUser = authContext?.currentUser || null;
  const logout = authContext?.logout || (() => {});
  const [projectName, setProjectName] = useState('Local Workspace');

  useEffect(() => {
    if (!pillRef.current) return;
    const activeIdx = modes.findIndex(m => m.id === mode);
    const pills = pillRef.current.querySelectorAll('.toggle-pill__option');
    if (pills[activeIdx]) {
      const el = pills[activeIdx];
      setThumbStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
      });
    }
  }, [mode]);

  useEffect(() => {
    if (currentUser && activeProjectId) {
      getUserProjects(currentUser.uid).then(projects => {
        const found = projects.find(p => p.id === activeProjectId);
        if (found) setProjectName(found.name);
        else setProjectName('Select Project');
      });
    } else if (activeProjectId) {
      setProjectName('Active Cloud Project');
    } else {
      setProjectName('Local Workspace');
    }
  }, [currentUser, activeProjectId]);

  return (
    <nav className="topnav" role="navigation" aria-label="Primary navigation">
      {/* Brand */}
      <div className="topnav__brand">
        <div className="topnav__logo" aria-hidden="true">
          <RoadIcon />
        </div>
        <div className="topnav__title">
          <span className="topnav__title-main">CRCP Service Life Analysis</span>
        </div>
      </div>

      {/* Dataset Mode Toggle */}
      <div className="dataset-toggle" role="group" aria-label="Dataset mode">
        <div
          id="dataset-toggle-pill"
          className="toggle-pill"
          ref={pillRef}
          role="radiogroup"
          aria-label="Select dataset mode"
        >
          <div
            className="toggle-pill__thumb"
            aria-hidden="true"
            style={{ left: thumbStyle.left, width: thumbStyle.width }}
          />
          {modes.map(m => (
            <button
              key={m.id}
              id={`toggle-${m.id}`}
              role="radio"
              aria-checked={mode === m.id}
              className={`toggle-pill__option${mode === m.id ? ' active' : ''}`}
              onClick={() => onModeChange(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right Controls: Cloud Project & Firebase Auth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
        {/* Project Selector Button */}
        <button 
          className="btn btn--secondary btn--sm"
          onClick={() => {
            if (!currentUser) {
              onOpenAuthModal();
            } else {
              onOpenProjectModal();
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
          title={currentUser ? "Switch or manage projects" : "Sign in to access Cloud Projects"}
        >
          <FolderIcon />
          <span>{projectName}</span>
          <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
        </button>

        {/* User Auth Badge / Login Button */}
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: 'var(--text-main)', background: 'var(--bg-elevated)',
              padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-subtle)'
            }}>
              <UserIcon />
              <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.email}
              </span>
            </div>
            <button 
              className="btn btn--secondary btn--sm" 
              onClick={() => logout()}
              style={{ fontSize: 11, padding: '4px 8px' }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            className="btn btn--primary btn--sm" 
            onClick={onOpenAuthModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <UserIcon />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </nav>
  );
}
