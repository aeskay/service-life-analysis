import React from 'react';

export default function AnovaWorkspace() {
  return (
    <div className="workspace" style={{ backgroundColor: 'var(--bg-main)' }}>
      <div className="workspace__header">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="workspace__title">Statistical Analysis Report</div>
          <div className="workspace__subtitle">Type II Factorial ANOVA with Tukey HSD Post-Hoc Test</div>
        </div>
      </div>

      <div className="workspace__body" style={{ padding: '32px 48px', overflowY: 'auto', display: 'flex' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 1100, width: '100%', margin: '0 auto', color: 'var(--text-main)', fontSize: '15px' }}>
        
        {/* Executive Summary */}
        <div style={{ background: 'var(--bg-panel, #1e1e24)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, marginBottom: 24, marginTop: 0, color: 'var(--primary-color, #60a5fa)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            1. Introduction & Methodology
          </h2>
          <div style={{ lineHeight: 1.7 }}>
            <p><strong>Introduction:</strong> This statistical analysis investigates the critical factors contributing to the service life of Continuously Reinforced Concrete Pavement (CRCP). By analyzing historical pavement performance data, the goal is to determine which structural design parameters (e.g., base type, thicknesses) and traffic loads (Cumulative ESALs) have the most significant impact on how long a pavement lasts before requiring full reconstruction.</p>
            <p><strong>Methodology:</strong> To evaluate these factors, we employ a <strong>Type II Factorial Analysis of Variance (ANOVA)</strong> using a General Linear Model (GLM). ANOVA is a powerful statistical method used to determine if the differences in service life across various pavement designs are statistically significant, rather than just due to random chance.</p>
            <ul style={{ paddingLeft: 20, margin: '12px 0' }}>
              <li style={{ marginBottom: 8 }}><strong>Why Type II?</strong> Type II sum of squares is highly robust for unbalanced datasets (where the sample sizes for different base types are unequal), as it evaluates the main effect of each variable after mathematically controlling for all other variables in the model.</li>
              <li style={{ marginBottom: 8 }}><strong>Variables Evaluated:</strong> The model evaluates one categorical factor (<strong>Base Type</strong>) alongside three continuous covariates (<strong>Old Slab Thickness</strong>, <strong>Base Thickness</strong>, and <strong>Cumulative ESALs in millions</strong>).</li>
              <li><strong>Post-Hoc Analysis:</strong> A Tukey HSD (Honestly Significant Difference) test is subsequently performed to identify exactly <em>which</em> specific base types significantly outperform others.</li>
            </ul>
            <p><strong>Sample Size:</strong> The analysis was conducted on a curated dataset of <strong>72 verified reconstructed sections</strong>.</p>
          </div>
        </div>

        {/* Results */}
        <div style={{ background: 'var(--bg-panel, #1e1e24)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, marginBottom: 24, marginTop: 0, color: 'var(--primary-color, #60a5fa)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
            2. ANOVA Results & Model Strength
          </h2>
          <div style={{ lineHeight: 1.7, marginBottom: 24 }}>
            <p><strong>Overall Model Strength:</strong> The combined variables explain approximately <strong>39.65%</strong> of the variance in service life (Adjusted R-squared). The overall model is highly significant (p = 1.06e-06).</p>
            <p>The Type II ANOVA revealed that <strong>Base Type</strong> is the only statistically significant predictor of service life among the evaluated factors (<em>p &lt; 0.05</em>).</p>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Factor</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Sum of Squares</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Degrees of Freedom (df)</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>F-Value</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>P-Value</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Effect Size (η²)</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Significance</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(96, 165, 250, 0.1)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>Base Type</td>
                  <td style={{ padding: '12px 16px' }}>859.76</td>
                  <td style={{ padding: '12px 16px' }}>4.0</td>
                  <td style={{ padding: '12px 16px' }}>7.095</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>0.000086</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>0.307</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80', fontWeight: 'bold' }}>Significant</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px' }}>Old Slab Thickness</td>
                  <td style={{ padding: '12px 16px' }}>29.72</td>
                  <td style={{ padding: '12px 16px' }}>1.0</td>
                  <td style={{ padding: '12px 16px' }}>0.981</td>
                  <td style={{ padding: '12px 16px' }}>0.3256</td>
                  <td style={{ padding: '12px 16px' }}>0.015</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Not Sig.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px' }}>Base Thickness</td>
                  <td style={{ padding: '12px 16px' }}>95.14</td>
                  <td style={{ padding: '12px 16px' }}>1.0</td>
                  <td style={{ padding: '12px 16px' }}>3.141</td>
                  <td style={{ padding: '12px 16px' }}>0.0811</td>
                  <td style={{ padding: '12px 16px' }}>0.047</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Not Sig.</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px' }}>Cumulative ESALs</td>
                  <td style={{ padding: '12px 16px' }}>106.18</td>
                  <td style={{ padding: '12px 16px' }}>1.0</td>
                  <td style={{ padding: '12px 16px' }}>3.505</td>
                  <td style={{ padding: '12px 16px' }}>0.0658</td>
                  <td style={{ padding: '12px 16px' }}>0.052</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Not Sig.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 24, padding: 24, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-subtle)', lineHeight: 1.6 }}>
            <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-main)' }}>Factor-by-Factor Breakdown</h4>
            <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <li>
                <strong>Base Type (p = 0.000086):</strong> <em>Highly Significant.</em> The p-value is extremely low, indicating that the type of material used for the base is the primary driver in determining how long the pavement lasts in this dataset. It has a large effect size (η² = 0.307), explaining ~31% of the remaining variance.
              </li>
              <li>
                <strong>Old Slab Thickness (p = 0.325):</strong> <em>Not Significant.</em> Thicker slabs did not necessarily result in longer service lives here. This is a common finding in forensic pavement analysis, where base failure often triggers reconstruction regardless of the slab thickness.
              </li>
              <li>
                <strong>Base Thickness (p = 0.081):</strong> <em>Marginally Significant.</em> While it didn't pass the strict 0.05 threshold, it is close. This suggests that while base type is critical, the thickness of that base plays a supporting role.
              </li>
              <li>
                <strong>Cumulative ESALs (p = 0.065):</strong> <em>Marginally Significant.</em> This indicates that traffic load does influence lifespan, but in these sections, the structural design choice (Base Type) was a much stronger predictor of failure than the traffic volume itself.
              </li>
            </ul>
          </div>
        </div>

        {/* Post-Hoc */}
        <div style={{ background: 'var(--bg-panel, #1e1e24)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, marginBottom: 24, marginTop: 0, color: 'var(--primary-color, #60a5fa)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            3. Tukey HSD Post-Hoc Analysis (Base Type)
          </h2>
          <div style={{ lineHeight: 1.7, marginBottom: 24 }}>
            <p>Since Base Type was highly significant, a multiple comparison of means was performed. The following table highlights the pairs of base types that exhibited a statistically significant difference in service life.</p>
          </div>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-subtle)' }}>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Group 1</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Group 2</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Mean Difference (Years)</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Adjusted P-Value</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>Reject Null?</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(74, 222, 128, 0.1)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>ASB</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>LSB</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80' }}>+13.06 years</td>
                  <td style={{ padding: '12px 16px' }}>0.0004</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>True</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(74, 222, 128, 0.1)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>CTB</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>LSB</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80' }}>+13.86 years</td>
                  <td style={{ padding: '12px 16px' }}>0.0000</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>True</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(74, 222, 128, 0.1)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>ASB</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>Flex Base</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80' }}>+9.56 years</td>
                  <td style={{ padding: '12px 16px' }}>0.0369</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>True</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(74, 222, 128, 0.1)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>CTB</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>Flex Base</td>
                  <td style={{ padding: '12px 16px', color: '#4ade80' }}>+10.36 years</td>
                  <td style={{ padding: '12px 16px' }}>0.0109</td>
                  <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>True</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-muted)' }}>* Note: Non-significant comparisons (e.g., ASB vs CTB) were omitted for brevity.</p>
        </div>

        {/* Diagnostics & Conclusion */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          
          <div style={{ background: 'var(--bg-panel, #1e1e24)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, marginBottom: 24, marginTop: 0, color: 'var(--primary-color, #60a5fa)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              4. Model Diagnostics
            </h2>
            <div style={{ lineHeight: 1.7 }}>
              <div style={{ marginBottom: 16 }}>
                <strong>Normality of Residuals:</strong> 
                <br />Shapiro-Wilk <em>p-value</em> = 0.1482
                <div style={{ color: '#4ade80', fontSize: 13, marginTop: 4 }}>✓ Data is normally distributed (p &gt; 0.05).</div>
              </div>
              <div>
                <strong>Homogeneity of Variance:</strong> 
                <br />Levene's <em>p-value</em> = 0.9173
                <div style={{ color: '#4ade80', fontSize: 13, marginTop: 4 }}>✓ Variances are equal across groups (p &gt; 0.05).</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-panel, #1e1e24)', borderRadius: 12, border: '1px solid var(--border-subtle)', padding: 32, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <h2 style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: 16, marginBottom: 24, marginTop: 0, color: 'var(--primary-color, #60a5fa)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              5. Final Interpretation
            </h2>
            <div style={{ lineHeight: 1.7 }}>
              <p>The statistical analysis strongly indicates that the <strong>type of base layer</strong> has a dominant effect on the service life of reconstructed sections, overshadowing factors like slab thickness, base thickness, and traffic (ESALs) within this dataset.</p>
              <p>Specifically, sections constructed over <strong>Lime-Stabilized Base (LSB)</strong> and <strong>Flexible Base</strong> provided significantly longer service lives compared to Asphalt Stabilized Base (ASB) and Cement Treated Base (CTB), outperforming them by an average of <strong>9.5 to 13.8 years</strong>.</p>
              
              <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                <strong>Average Service Life by Base Type:</strong>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <li><strong>LSB:</strong> 50.0 years</li>
                  <li><strong>Flex Base:</strong> 46.5 years</li>
                  <li><strong>Foundation Course:</strong> 42.3 years</li>
                  <li><strong>ASB:</strong> 36.9 years</li>
                  <li><strong>CTB:</strong> 36.1 years</li>
                </ul>
              </div>
            </div>
        </div>
        
        {/* Raw Log Output */}
        <div style={{ marginTop: 8, background: '#0d0d0d', borderRadius: 12, padding: 24, border: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: 13, color: '#a3a3a3', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
          <div style={{ color: '#fff', marginBottom: 16, fontSize: 14, fontWeight: 'bold' }}>--- RAW ANALYSIS LOG ---</div>
          {`=============================================
PHASE 1: MODEL OVERALL STRENGTH
=============================================
R-squared (Total Variance Explained): 0.4560
Adjusted R-squared (PhD citation val): 0.3965
Overall Model p-value:                1.0600e-06

=============================================
PHASE 2: FACTORIAL ANOVA RESULTS
=============================================
                   df         F    PR(>F)  partial_eta_sq
C(Base)           4.0  7.095178  0.000086        0.307215
Old_Slab_Th       1.0  0.981148  0.325646        0.015099
Base_Th           1.0  3.140632  0.081124        0.046777
CUMULATIVE_ESAL   1.0  3.505023  0.065753        0.051922
Residual         64.0       NaN       NaN        0.500000

=============================================
PHASE 3: POST-HOC COMPARISONS (BASE TYPE)
=============================================
NOTE: meandiff = (Group 2 Mean) - (Group 1 Mean)
A POSITIVE meandiff means Group 2 lasted LONGER than Group 1.

            Multiple Comparison of Means - Tukey HSD, FWER=0.05            
===========================================================================
      group1            group2      meandiff p-adj   lower    upper  reject
---------------------------------------------------------------------------
              ASB               CTB  -0.7983 0.9896  -5.5424  3.9457  False
              ASB         Flex Base   9.5588 0.0369   0.3876   18.73   True
              ASB Foundation Course   5.3088 0.4884  -3.8624   14.48  False
              ASB               LSB  13.0588 0.0004   4.6628 21.4548   True
              CTB         Flex Base  10.3571 0.0109   1.7215 18.9928   True
              CTB Foundation Course   6.1071 0.2856  -2.5285 14.7428  False
              CTB               LSB  13.8571    0.0   6.0497 21.6646   True
        Flex Base Foundation Course    -4.25 0.8448 -15.9196  7.4196  False
        Flex Base               LSB      3.5  0.901  -7.5708 14.5708  False
Foundation Course               LSB     7.75 0.2955  -3.3208 18.8208  False
---------------------------------------------------------------------------

=============================================
PHASE 4: STATISTICAL VALIDATION
=============================================
Residual Normality (Shapiro-Wilk p-value): 0.1482
-> Result: PASS (Residuals are normally distributed)
Homogeneity of Variance (Levene p-value):   0.9173
-> Result: PASS (Group variances are equal)

--- Raw Means for Verification ---
Base
ASB                  36.941176
CTB                  36.142857
Flex Base            46.500000
Foundation Course    42.250000
LSB                  50.000000`}
        </div>

        </div>
        </div>
      </div>
    </div>
  );
}
