import React, { useState, useEffect } from 'react';
import { loadState } from '../../utils/stateStore';

const calculateNormality = (arr) => {
  if (!arr || arr.length < 4) return null;
  
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  
  let m2 = 0, m3 = 0, m4 = 0;
  for (const x of arr) {
    const diff = x - mean;
    m2 += Math.pow(diff, 2);
    m3 += Math.pow(diff, 3);
    m4 += Math.pow(diff, 4);
  }
  
  m2 /= arr.length;
  m3 /= arr.length;
  m4 /= arr.length;
  
  if (m2 === 0) return null;
  
  const skewness = m3 / Math.pow(m2, 1.5);
  const kurtosis = m4 / Math.pow(m2, 2);
  
  // Jarque-Bera test statistic
  const n = arr.length;
  const jb = (n / 6) * (Math.pow(skewness, 2) + 0.25 * Math.pow(kurtosis - 3, 2));
  
  // Chi-Square approx (df=2)
  const pValue = Math.exp(-jb / 2);
  const isNormal = pValue > 0.05;
  
  return { skewness, kurtosis, jb, pValue, isNormal };
};

export default function TrafficStatsWorkspace() {
  const [dataStats, setDataStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadState().then(state => {
      if (!active) return;
      
      const res = state.trafficAnalysis?.reconstructed?.results || [];
      const reconEsals = res.map(r => r.CUMULATIVE_ESAL).filter(x => !isNaN(x) && x > 0);
      
      setDataStats({
        reconCount: reconEsals.length,
        reconNormality: calculateNormality(reconEsals)
      });
      setIsLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="workspace" style={{ overflowY: 'auto' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Traffic Distribution Statistics</div>
          <div className="workspace__subtitle">Statistical breakdown of Cumulative ESALs (millions) across all sections.</div>
        </div>
        <div className="workspace__toolbar-right">
          <button className="btn btn--secondary btn--sm" onClick={() => window.location.reload()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Update Analysis
          </button>
        </div>
      </div>

      <div className="workspace__body" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto', maxWidth: 900 }}>
        
        {isLoading ? (
          <div style={{ padding: 24 }}>Calculating statistics...</div>
        ) : !dataStats?.reconNormality ? (
          <div style={{ padding: 24 }}>Insufficient data for statistical analysis.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <details open style={{ background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', overflow: 'hidden', flexShrink: 0 }}>
              <summary style={{ padding: '16px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer', backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 12, listStyle: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="details-caret"><path d="M9 18l6-6-6-6" /></svg>
                Normal Distribution Test (Reconstructed only)
              </summary>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 32 }}>
                
                {/* Methodology Section */}
                <section>
                  <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 16 }}>1. Methodology</h2>
                  <p style={{ lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: 12 }}>
                    To determine whether the traffic distribution (Cumulative ESALs) across the pavement sections follows a normal distribution, the <strong>Jarque-Bera (JB) goodness-of-fit test</strong> was utilized. The JB test is a robust statistical procedure that specifically measures whether sample data have the skewness and kurtosis matching a normal distribution.
                  </p>
                  <ul style={{ lineHeight: 1.6, color: 'var(--text-primary)', margin: 0, paddingLeft: 24 }}>
                    <li><strong>Skewness</strong> measures the asymmetry of the data distribution. A perfectly normal distribution has a skewness of exactly 0.</li>
                    <li><strong>Kurtosis</strong> measures the "tailedness" of the distribution. A perfect normal distribution has a kurtosis of exactly 3.</li>
                  </ul>
                  <p style={{ lineHeight: 1.6, color: 'var(--text-primary)', marginTop: 12 }}>
                    The test statistic is compared against a Chi-Squared distribution with 2 degrees of freedom to obtain a <em>p-value</em>. The null hypothesis states that the data is normally distributed.
                  </p>
                </section>
                
                {/* Parameters Section */}
                <section>
                  <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 16 }}>2. Parameters</h2>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
                    <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8, color: 'var(--text-primary)' }}>
                      <li><strong>Target Variable:</strong> Cumulative ESALs</li>
                      <li><strong>Sample Size (n):</strong> {dataStats.reconCount} Reconstructed Sections</li>
                      <li><strong>Degrees of Freedom (df):</strong> 2</li>
                      <li><strong>Alpha Level ({'\u03B1'}):</strong> 0.05</li>
                    </ul>
                  </div>
                </section>

                {/* Results Section */}
                <section>
                  <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 16 }}>3. Results</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                    
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Skewness (S)</div>
                      <div style={{ fontSize: 24, fontWeight: 600 }}>{dataStats.reconNormality.skewness.toFixed(3)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Expected: ~0.0</div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Kurtosis (K)</div>
                      <div style={{ fontSize: 24, fontWeight: 600 }}>{dataStats.reconNormality.kurtosis.toFixed(3)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Expected: ~3.0</div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Test Statistic (JB)</div>
                      <div style={{ fontSize: 24, fontWeight: 600 }}>{dataStats.reconNormality.jb.toFixed(3)}</div>
                    </div>

                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 20, borderLeft: '4px solid var(--primary)' }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>p-value</div>
                      <div style={{ fontSize: 24, fontWeight: 600 }}>
                        {dataStats.reconNormality.pValue < 0.001 ? '< 0.001' : dataStats.reconNormality.pValue.toFixed(3)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                        Cutoff: {'>'} 0.05
                      </div>
                    </div>

                  </div>
                </section>

                {/* Interpretation & Conclusion Section */}
                <section>
                  <h2 style={{ fontSize: 20, fontWeight: 600, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8, marginBottom: 16 }}>4. Interpretation & Conclusion</h2>
                  <div style={{ 
                    background: dataStats.reconNormality.isNormal ? 'rgba(40, 167, 69, 0.05)' : 'rgba(220, 53, 69, 0.05)', 
                    border: `1px solid ${dataStats.reconNormality.isNormal ? 'rgba(40, 167, 69, 0.3)' : 'rgba(220, 53, 69, 0.3)'}`, 
                    borderRadius: 8, 
                    padding: 24 
                  }}>
                    <h3 style={{ fontSize: 16, fontWeight: 600, marginTop: 0, marginBottom: 12, color: dataStats.reconNormality.isNormal ? 'var(--success)' : 'var(--danger)' }}>
                      {dataStats.reconNormality.isNormal ? 'Null Hypothesis Accepted' : 'Null Hypothesis Rejected'}
                    </h3>
                    {dataStats.reconNormality.isNormal ? (
                      <>
                        <p style={{ lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>
                          The calculated <em>p-value</em> of <strong>{dataStats.reconNormality.pValue.toFixed(3)}</strong> is greater than the standard alpha level of 0.05. Therefore, we do not have sufficient evidence to reject the null hypothesis. 
                        </p>
                        <p style={{ lineHeight: 1.6, color: 'var(--text-primary)', margin: '12px 0 0 0' }}>
                          <strong>Conclusion:</strong> The Cumulative ESALs for the reconstructed pavement sections follow an approximately normal distribution. The low skewness ({dataStats.reconNormality.skewness.toFixed(3)}) indicates the data is mostly symmetrical, and the kurtosis ({dataStats.reconNormality.kurtosis.toFixed(3)}) indicates standard tail weights. This validates the use of parametric statistical methods for further performance modeling.
                        </p>
                      </>
                    ) : (
                      <>
                        <p style={{ lineHeight: 1.6, color: 'var(--text-primary)', margin: 0 }}>
                          The calculated <em>p-value</em> of <strong>{dataStats.reconNormality.pValue < 0.001 ? '< 0.001' : dataStats.reconNormality.pValue.toFixed(3)}</strong> is less than the standard alpha level of 0.05. Therefore, we reject the null hypothesis.
                        </p>
                        <p style={{ lineHeight: 1.6, color: 'var(--text-primary)', margin: '12px 0 0 0' }}>
                          <strong>Conclusion:</strong> The Cumulative ESALs for the reconstructed pavement sections deviate significantly from a normal distribution. Due to the high deviation in skewness ({dataStats.reconNormality.skewness.toFixed(3)}) or kurtosis ({dataStats.reconNormality.kurtosis.toFixed(3)}), non-parametric statistical methods are recommended for subsequent analyses.
                        </p>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
