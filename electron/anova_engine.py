import sys
import json
import pandas as pd
import statsmodels.api as sm
from statsmodels.formula.api import ols
from statsmodels.stats.multicomp import pairwise_tukeyhsd
import scipy.stats as stats
import warnings
import io

warnings.filterwarnings('ignore')

def run_analysis(json_path):
    try:
        # 1. Load Data
        with open(json_path, 'r') as f:
            data = json.load(f)
            
        df = pd.DataFrame(data)
        
        # 2. Capture printed output
        output_buffer = io.StringIO()
        
        # The JSON from JS must have exactly: ['Actual_Service_Life_yrs', 'Old_Slab_Th', 'Base_Th', 'CUMULATIVE_ESAL', 'Base']
        cols_to_clean = ['Actual_Service_Life_yrs', 'Old_Slab_Th', 'Base_Th', 'CUMULATIVE_ESAL']
        for col in cols_to_clean:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df_clean = df.dropna(subset=cols_to_clean + ['Base']).copy()
        
        output_buffer.write(f"Analyzing {len(df_clean)} reconstructed sections...\n")

        # 3. Build the Factorial ANOVA Model
        formula = 'Actual_Service_Life_yrs ~ C(Base) + Old_Slab_Th + Base_Th + CUMULATIVE_ESAL'
        
        model = ols(formula, data=df_clean).fit()
        anova_table = sm.stats.anova_lm(model, typ=2)

        output_buffer.write("\n" + "="*30 + "\n")
        output_buffer.write("FACTORIAL ANOVA RESULTS\n")
        output_buffer.write("="*30 + "\n")
        output_buffer.write(anova_table.to_string() + "\n")
        
        # 4. Check Significance (p-value < 0.05)
        sig_vars = anova_table[anova_table['PR(>F)'] < 0.05].index.tolist()
        if sig_vars:
            output_buffer.write(f"\nSignificant factors found: {sig_vars}\n")
        else:
            output_buffer.write("\nNo factors reached statistical significance at 0.05.\n")

        # 5. POST-HOC TEST (Tukey HSD)
        if 'C(Base)' in sig_vars:
            output_buffer.write("\n--- Post-Hoc Analysis for Base Type ---\n")
            tukey = pairwise_tukeyhsd(endog=df_clean['Actual_Service_Life_yrs'], 
                                      groups=df_clean['Base'], 
                                      alpha=0.05)
            output_buffer.write(str(tukey) + "\n")

        # 6. Model Diagnostics
        output_buffer.write("\n--- Model Diagnostics ---\n")
        _, p_norm = stats.shapiro(model.resid)
        output_buffer.write(f"Residual Normality (Shapiro-Wilk p-value): {p_norm:.4f}\n")
        
        groups = [group['Actual_Service_Life_yrs'].values for name, group in df_clean.groupby('Base')]
        _, p_levene = stats.levene(*groups)
        output_buffer.write(f"Homogeneity of Variance (Levene p-value): {p_levene:.4f}\n")

        print(json.dumps({"success": True, "text": output_buffer.getvalue()}))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input file provided"}))
        sys.exit(1)
        
    run_analysis(sys.argv[1])
