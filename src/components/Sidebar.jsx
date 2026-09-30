/**
 * Sidebar.jsx — Left navigation sidebar
 */
import React from 'react';

// Icons
const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const SplitIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l5.1 5.1M4 4l5 5" />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
    <path d="M6 4l4 4-4 4" />
  </svg>
);

const PMISIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    <path d="M3 15h6" />
    <path d="M3 18h6" />
  </svg>
);

const VerifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const SlabIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
  </svg>
);

const BaseThicknessIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 12 12 17 22 12" />
    <polyline points="2 17 12 22 22 17" />
  </svg>
);

const BaseTypeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const BaseTyThIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M18 20V10" />
    <path d="M14 20V14" />
    <path d="M10 20V4" />
    <path d="M6 20V8" />
    <path d="M2 20h20" />
  </svg>
);

const CleanIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M19 11l-8-8-8 8a6 6 0 0 0 8 10c2.4 0 4-1.5 5.5-3" />
    <path d="M11 21a6 6 0 0 0 8-10" />
    <path d="M10 5l4 4" />
  </svg>
);

const ConstructionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const AverageLifeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M18 20V10" />
    <path d="M12 20V4" />
    <path d="M6 20v-6" />
    <path d="M2 20h20" />
  </svg>
);

const SurvivalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M4 22V2" />
    <path d="M4 14c4 0 4-8 8-8 4 0 4 8 8 8" />
    <path d="M2 22h20" />
  </svg>
);

const DistributionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar__tab-icon">
    <path d="M12 20V10" />
    <path d="M18 20v-4" />
    <path d="M6 20v-6" />
    <path d="M2 20h20" />
    <path d="M4 14l4-4 4 4 6-6" />
  </svg>
);

const CATEGORIES = [
  {
    id: 'configuration',
    label: 'Configuration',
    tabs: [
      {
        id: 'source-files',
        label: 'Source Files',
        icon: <FolderIcon />,
        description: 'Configure input data files',
      }
    ]
  },
  {
    id: 'file-process',
    label: 'File Process',
    tabs: [
      {
        id: 'split-lr',
        label: 'Split L/R',
        icon: <SplitIcon />,
        description: 'Highway direction splitting',
      },
      {
        id: 'match-pmis',
        label: 'Match PMIS',
        icon: <PMISIcon />,
        description: 'Match sections to PMIS database',
      },
      {
        id: 'verify',
        label: 'Verify Service Life',
        icon: <VerifyIcon />,
        description: 'Confirm sections reached service life using PMIS charts',
      },
    ]
  },
  {
    id: 'life-analysis',
    label: 'Life Analysis',
    tabs: [
      {
        id: 'cleaned-sections',
        label: 'Cleaned Sections',
        icon: <CleanIcon />, 
        description: 'Review and verify cleaned sections',
      },
      {
        id: 'construction-info',
        label: 'Construction Info',
        icon: <ConstructionIcon />, 
        description: 'Analyze construction year data',
      },
      {
        id: 'average-life',
        label: 'Average Life',
        icon: <AverageLifeIcon />, 
        description: 'Analyze average life of verified sections',
      }
    ]
  },
  {
    id: 'traffic',
    label: 'TRAFFIC',
    tabs: [
      {
        id: 'traffic-lifecycle',
        label: 'ESAL',
        icon: <AverageLifeIcon />,
        description: 'Calculate ESALs using PMIS and rational models',
      },
      {
        id: 'traffic-distribution',
        label: 'Distribution',
        icon: <DistributionIcon />,
        description: 'ESAL distribution and analysis',
      },
      {
        id: 'traffic-service-life',
        label: 'Service Life',
        icon: <SurvivalIcon />,
        description: 'ESAL vs Service Life analysis',
      },
      {
        id: 'traffic-slab-base',
        label: 'Slab & Base',
        icon: <SlabIcon />,
        description: 'ESAL vs Slab and Base Thickness',
      }
    ]
  },
  {
    id: 'survival-curves',
    label: 'Survival Curves',
    tabs: [
      {
        id: 'survival-analysis-service-life',
        label: 'Service Life',
        icon: <SurvivalIcon />, 
        description: 'Kaplan-Meier survival curves for Service Life',
      },
      {
        id: 'survival-analysis-traffic',
        label: 'Traffic Survival',
        icon: <SurvivalIcon />, 
        description: 'Kaplan-Meier survival curves for Cumulative ESAL',
      },
      {
        id: 'survival-analysis-slab-thickness',
        label: 'Slab Thickness',
        icon: <SlabIcon />, 
        description: 'Survival curves by slab thickness',
      },
      {
        id: 'survival-analysis-base-thickness',
        label: 'Base Thickness',
        icon: <BaseThicknessIcon />, 
        description: 'Survival curves by base thickness',
      }
    ]
  },
  {
    id: 'slab-and-base',
    label: 'SLAB & BASE',
    tabs: [
      {
        id: 'slab-thickness',
        label: 'Slab Thickness',
        icon: <SlabIcon />, 
        description: 'Effect of slab thickness on service life',
      },
      {
        id: 'base-thickness',
        label: 'Base Thickness',
        icon: <BaseThicknessIcon />, 
        description: 'Effect of base thickness on service life',
      },
      {
        id: 'base-type',
        label: 'Base Type',
        icon: <BaseTypeIcon />, 
        description: 'Effect of base type on service life',
      },
      {
        id: 'base-ty-th',
        label: 'Base TY and TH',
        icon: <BaseTyThIcon />, 
        description: 'Effect of base type and thickness',
      }
    ]
  },
  {
    id: 'heatmaps',
    label: 'HEATMAPS',
    tabs: [
      {
        id: 'pave-traffic-heatmap',
        label: 'Pave & Traffic',
        icon: <DistributionIcon />,
        description: 'Heatmap of Slab/Base Thickness and ESAL vs Service Life',
      }
    ]
  },
  {
    id: 'pmis',
    label: 'PMIS',
    tabs: [
      {
        id: 'general-trends',
        label: 'General Trends',
        icon: <PMISIcon />,
        description: 'Analyze overall PMIS trends and totals',
      },
      {
        id: 'before-terminal',
        label: 'Before Terminal',
        icon: <CleanIcon />,
        description: 'Normalized degradation trends leading to terminal year',
      },
      {
        id: 'terminal',
        label: 'Terminal',
        icon: <CleanIcon />,
        description: 'Terminal PMIS scores at End of Life',
      },
      {
        id: 'after-terminal-c',
        label: 'After Terminal (C)',
        icon: <CleanIcon />,
        description: 'Post-construction peak condition PMIS scores',
      },
      {
        id: 'after-terminal-d',
        label: 'After Terminal (D)',
        icon: <CleanIcon />,
        description: 'Post-construction peak distress PMIS scores',
      }
    ]
  },
  {
    id: 'maps',
    label: 'MAPS',
    tabs: [
      {
        id: 'section-locations',
        label: 'Section Locations',
        icon: <VerifyIcon />,
        description: 'View sections on the Texas map',
      },
      {
        id: 'district-heatmaps',
        label: 'District Heatmaps',
        icon: <AverageLifeIcon />,
        description: 'Choropleth heatmaps by TxDOT district',
      }
    ]
  },
  {
    id: 'statistics-info',
    label: 'STATISTICS INFO',
    tabs: [
      {
        id: 'traffic-stats',
        label: 'Traffic',
        icon: <DistributionIcon />,
        description: 'Traffic statistical reports and parameters',
      },
      {
        id: 'service-life-stats',
        label: 'Service Life',
        icon: <AverageLifeIcon />,
        description: 'Service life statistical reports',
      },
      {
        id: 'anova',
        label: 'ANOVA',
        icon: <DistributionIcon />,
        description: 'Multi-Way Factorial ANOVA (GLM)',
      },
      {
        id: 'cox-ph',
        label: 'Cox PH',
        icon: <AverageLifeIcon />,
        description: 'Cox Proportional Hazards Model',
      }
    ]
  }
];

export default function Sidebar({ activeTab, onTabChange, errorCount = 0 }) {
  return (
    <aside className="sidebar" role="navigation" aria-label="Module navigation">
      <div className="sidebar__header">
        <div className="sidebar__section-label">Analysis Modules</div>
      </div>

      <nav className="sidebar__nav">
        {CATEGORIES.map(category => (
          <div key={category.id} className="sidebar__category">
            <div className="sidebar__category-label" style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              padding: 'var(--sp-2) var(--sp-4)',
              marginTop: 'var(--sp-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
            }}>
              {category.label}
              {category.comingSoon && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                  background: 'rgba(99,102,241,0.15)', color: 'var(--accent-secondary)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase',
                }}>Soon</span>
              )}
            </div>
            {category.tabs.map(tab => (
              <button
                key={tab.id}
                id={`sidebar-tab-${tab.id}`}
                className={`sidebar__tab${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => onTabChange(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
                title={tab.description}
                style={{ marginLeft: 'var(--sp-2)', width: 'calc(100% - var(--sp-2))' }}
              >
                {tab.icon}
                <span className="sidebar__tab-label">{tab.label}</span>
                {tab.id === 'split-lr' && errorCount > 0 && (
                  <span className="sidebar__badge" aria-label={`${errorCount} flagged rows`}>
                    {errorCount > 99 ? '99+' : errorCount}
                  </span>
                )}
                {activeTab === tab.id && <ChevronRight />}
              </button>
            ))}
            {category.comingSoon && category.tabs.length === 0 && (
              <div style={{
                marginLeft: 'var(--sp-4)', padding: 'var(--sp-1) var(--sp-2)',
                fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic',
              }}>
                Modules coming soon…
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar__divider" />

      {/* Removed Active Module and Source Files */}

      {/* Version */}
      <div style={{
        padding: 'var(--sp-3) var(--sp-4)',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 10,
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
      }}>
        v1.0.0 · TTU Research
      </div>
    </aside>
  );
}
