import React from 'react';

export default function CoxPHWorkspace() {
  return (
    <div className="workspace" style={{ backgroundColor: 'var(--bg-main)' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Survival Statistics</div>
          <div className="workspace__subtitle">Cox Proportional Hazards Model (Right-Censored Data)</div>
        </div>
      </div>

      <div className="workspace__body" style={{ padding: '32px 48px', overflowY: 'auto', display: 'flex' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1100, width: '100%', margin: '0 auto', color: 'var(--text-main)', fontSize: '15px' }}>
          
          {/* Executive Summary */}
          <div style={{ background: 'var(--bg-panel, #1e1e24)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, marginBottom: 24, marginTop: 0, color: 'var(--primary-color, #60a5fa)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              1. Methodology & Data Integration
            </h2>
            <div style={{ lineHeight: 1.7 }}>
              <p><strong>Introduction:</strong> While the ANOVA model evaluated only the pavements that failed (reconstructed), this <strong>Cox Proportional Hazards (PH)</strong> model incorporates both the failed sections and the <em>in-service</em> sections. By treating the in-service sections as "right-censored" (meaning they have survived up to their current age without failing), the model utilizes the full spectrum of historical data.</p>
              <p><strong>Methodology:</strong> The Cox PH model estimates the "hazard" or risk of failure. A Hazard Ratio (HR) below 1.0 indicates a decreased risk of failure (longer service life), while an HR above 1.0 indicates an increased risk.</p>
              <ul style={{ paddingLeft: 20, margin: '12px 0' }}>
                <li style={{ marginBottom: 8 }}><strong>Sample Size:</strong> Increased from 72 failed sections to a total of <strong>307 sections</strong> (72 failed, 235 censored).</li>
                <li style={{ marginBottom: 8 }}><strong>Variables:</strong> Evaluates Old Slab Thickness, Base Thickness, Cumulative ESALs, and Base Type.</li>
                <li><strong>Baseline Base Type:</strong> Asphalt Stabilized Base (ASB) acts as the mathematical baseline for base type comparisons.</li>
              </ul>
            </div>
          </div>

          {/* Results Table */}
          <div style={{ background: 'var(--bg-panel, #1e1e24)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, marginBottom: 24, marginTop: 0, color: 'var(--primary-color, #60a5fa)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              2. Cox PH Model Results
            </h2>
            <div style={{ lineHeight: 1.7, marginBottom: 24 }}>
              <p><strong>Overall Model Strength:</strong> The model has a Concordance Index of <strong>0.71</strong>, indicating a good predictive fit for survival data. The overall model is highly statistically significant (Log-likelihood p &lt; 0.001).</p>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Variable</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Hazard Ratio exp(coef)</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>95% Confidence Interval</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>p-value</th>
                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(96, 165, 250, 0.1)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>Old Slab Thickness</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>0.81</td>
                    <td style={{ padding: '12px 16px' }}>(0.71, 0.92)</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>&lt;0.005</td>
                    <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 'bold' }}>Highly Significant</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(96, 165, 250, 0.1)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>Cumulative ESALs</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>0.99</td>
                    <td style={{ padding: '12px 16px' }}>(0.98, 1.00)</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>0.01</td>
                    <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 'bold' }}>Significant</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>Base Thickness</td>
                    <td style={{ padding: '12px 16px' }}>0.77</td>
                    <td style={{ padding: '12px 16px' }}>(0.59, 1.01)</td>
                    <td style={{ padding: '12px 16px' }}>0.06</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Marginal</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>CTB Base</td>
                    <td style={{ padding: '12px 16px' }}>1.12</td>
                    <td style={{ padding: '12px 16px' }}>(0.67, 1.88)</td>
                    <td style={{ padding: '12px 16px' }}>0.67</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Not Significant</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>Flex Base</td>
                    <td style={{ padding: '12px 16px' }}>1.96</td>
                    <td style={{ padding: '12px 16px' }}>(0.67, 5.78)</td>
                    <td style={{ padding: '12px 16px' }}>0.22</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Not Significant</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>Foundation Course</td>
                    <td style={{ padding: '12px 16px' }}>2.23</td>
                    <td style={{ padding: '12px 16px' }}>(0.77, 6.47)</td>
                    <td style={{ padding: '12px 16px' }}>0.14</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Not Significant</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>HMAC Base</td>
                    <td style={{ padding: '12px 16px' }}>0.55</td>
                    <td style={{ padding: '12px 16px' }}>(0.14, 2.17)</td>
                    <td style={{ padding: '12px 16px' }}>0.39</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Not Significant</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px' }}>LSB Base</td>
                    <td style={{ padding: '12px 16px' }}>0.60</td>
                    <td style={{ padding: '12px 16px' }}>(0.27, 1.35)</td>
                    <td style={{ padding: '12px 16px' }}>0.21</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Not Significant</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-subtle)', lineHeight: 1.6 }}>
              <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main)' }}>Factor-by-Factor Breakdown</h4>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <li>
                  <strong>Old Slab Thickness (HR = 0.81):</strong> <em>Highly Significant.</em> Unlike the ANOVA, when in-service pavements are included, slab thickness becomes the dominant factor. An HR of 0.81 indicates that <strong>every 1-inch increase in slab thickness reduces the risk of failure by 19%</strong> across the entire network.
                </li>
                <li>
                  <strong>Base Thickness (HR = 0.77):</strong> <em>Marginally Significant.</em> Suggests that every additional inch of base thickness reduces failure risk by roughly 23%, though it falls just short of the strict p=0.05 threshold.
                </li>
                <li>
                  <strong>Base Type:</strong> <em>Not Significant.</em> When censored data is included, the base material's statistical dominance disappears. The massive influence of slab thickness on the surviving 235 sections effectively overrides the impact of the base type seen in the failed sections.
                </li>
                <li>
                  <strong>Cumulative ESALs (HR = 0.99):</strong> <em>Significant, but trivial effect.</em> A ratio of 0.99 means higher traffic slightly reduces failure risk mathematically. In pavement engineering, this confounding effect typically occurs because high-traffic roads are structurally over-designed to survive longer.
                </li>
              </ul>
            </div>
          </div>

        {/* Raw Log Output */}
        <div style={{ marginTop: 8, background: '#0d0d0d', borderRadius: 12, padding: 24, border: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: 13, color: '#a3a3a3', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
          <div style={{ color: '#fff', marginBottom: 16, fontSize: 14, fontWeight: 'bold' }}>--- RAW ANALYSIS LOG ---</div>
          {`--- MISSING DATA REPORT ---
Column 'Actual_Service_Life_yrs' is missing 0 values.
Column 'Base' is missing 2 values.
Column 'Old_Slab_Th' is missing 0 values.
Column 'Base_Th' is missing 18 values.
Column 'CUMULATIVE_ESAL' is missing 0 values.

Final count for analysis: 307 rows
Failed (Events): 72
In-Service (Censored): 235

=============================================
FINAL COX MODEL RESULTS
=============================================
model\tlifelines.CoxPHFitter
duration col\t'Actual_Service_Life_yrs'
event col\t'Event_Internal'
penalizer\t0.1
l1 ratio\t0.0
baseline estimation\tbreslow
number of observations\t307
number of events observed\t72
partial log-likelihood\t-323.84
time fit was run\t2026-06-29 14:01:23 UTC
coef\texp(coef)\tse(coef)\tcoef lower 95%\tcoef upper 95%\texp(coef) lower 95%\texp(coef) upper 95%\tcmp to\tz\tp\t-log2(p)
Old_Slab_Th\t-0.21\t0.81\t0.07\t-0.34\t-0.08\t0.71\t0.92\t0.00\t-3.18\t<0.005\t9.41
Base_Th\t-0.26\t0.77\t0.14\t-0.52\t0.01\t0.59\t1.01\t0.00\t-1.89\t0.06\t4.10
CUMULATIVE_ESAL\t-0.01\t0.99\t0.00\t-0.02\t-0.00\t0.98\t1.00\t0.00\t-2.49\t0.01\t6.30
Base_CTB\t0.11\t1.12\t0.26\t-0.40\t0.63\t0.67\t1.88\t0.00\t0.43\t0.67\t0.59
Base_Flex Base\t0.67\t1.96\t0.55\t-0.41\t1.75\t0.67\t5.78\t0.00\t1.22\t0.22\t2.17
Base_Foundation Course\t0.80\t2.23\t0.54\t-0.27\t1.87\t0.77\t6.47\t0.00\t1.47\t0.14\t2.82
Base_HMAC\t-0.60\t0.55\t0.70\t-1.98\t0.77\t0.14\t2.17\t0.00\t-0.86\t0.39\t1.36
Base_LSB\t-0.52\t0.60\t0.41\t-1.33\t0.30\t0.27\t1.35\t0.00\t-1.24\t0.21\t2.23

Concordance\t0.71
Partial AIC\t663.67
log-likelihood ratio test\t26.54 on 8 df
-log2(p) of ll-ratio test\t10.20`}
        </div>

        </div>
      </div>
    </div>
  );
}
