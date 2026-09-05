"""
Lateral wheel-strength regression, full factorial dataset:
30 hubs x 5 rims x 2 spoke diameters x 2 spoke counts x 2 tensions x
2 wheel sizes = 2400 rows.

Y  = F_lat (kgf) -- first-spoke-slack lateral strength, from
     wheel-physics-core's calc() (Ford Mode Matrix method).

beta1  = tension_ratio        : NDS/DS spoke tension split (%), geometry-driven
beta2  = flange_width         : total hub flange width, nds+ds (mm)
beta3  = pcd_mean             : mean flange PCD, (pds+pnds)/2 (mm)
beta4  = standard_157         : axle standard dummy (1 = 157 Super Boost, 0 = 148 Boost)
beta5  = rim_stiffness_index  : ESTIMATED composite rim stiffness scale
beta6  = rim_internal_width   : VERIFIED rim internal width (mm)
beta7  = spoke_diameter       : VERIFIED spoke gauge, mm (1.8 or 2.0)
beta8  = spoke_count          : VERIFIED spoke count (28 or 32)
beta9  = tension_kgf          : VERIFIED build tension setpoint (90 or 120 kgf)
beta10 = wheel_erd            : VERIFIED effective rim diameter, mm (559=27.5", 600=29")

Rows repeat each hub 80 times (5 rims x 2^4 build variants), so residuals
are clustered by hub, not independent -- SEs below are clustered by
hub_id.
"""
import json
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor

with open("dataset.json") as f:
    rows = json.load(f)
df = pd.DataFrame(rows)

betas = [
    "tension_ratio", "flange_width", "pcd_mean", "standard_157",
    "rim_stiffness_index", "spoke_diameter", "spoke_count", "tension_kgf", "wheel_erd",
]
X_raw = df[betas]
y = df["F_lat"]

# ---- Raw-unit OLS, clustered SEs by hub_id (repeated-measures design) ---
X = sm.add_constant(X_raw)
model = sm.OLS(y, X).fit(cov_type="cluster", cov_kwds={"groups": df["hub_id"]})

print("=" * 78)
print("RAW-UNIT OLS  (Y = F_lat, kgf)  -- SEs clustered by hub_id")
print("=" * 78)
print(model.summary())

# ---- Standardized betas (z-scored X and y), same clustering -------------
Xz = (X_raw - X_raw.mean()) / X_raw.std()
yz = (y - y.mean()) / y.std()
Xz_c = sm.add_constant(Xz)
model_z = sm.OLS(yz, Xz_c).fit(cov_type="cluster", cov_kwds={"groups": df["hub_id"]})

print("\n" + "=" * 78)
print("STANDARDIZED BETAS (z-scored; comparable magnitude across units)")
print("=" * 78)
std_table = pd.DataFrame({
    "std_beta": model_z.params.drop("const"),
    "p_value": model_z.pvalues.drop("const"),
})
std_table["abs_std_beta"] = std_table["std_beta"].abs()
std_table = std_table.sort_values("abs_std_beta", ascending=False)
print(std_table.drop(columns="abs_std_beta").to_string(float_format=lambda v: f"{v:8.4f}"))

# ---- VIF (multicollinearity check) -------------------------------------
print("\n" + "=" * 78)
print("VARIANCE INFLATION FACTORS")
print("=" * 78)
vif_X = sm.add_constant(X_raw)
vif = pd.Series(
    [variance_inflation_factor(vif_X.values, i) for i in range(1, vif_X.shape[1])],
    index=betas,
)
print(vif.to_string(float_format=lambda v: f"{v:8.3f}"))
print("(>5 = notable collinearity; >10 = coefficient on that beta is unreliable)")

# ---- Partial R^2 per beta (unique variance explained) --------------------
print("\n" + "=" * 78)
print("PARTIAL R^2 (variance uniquely attributable to each beta, unclustered OLS)")
print("=" * 78)
model_plain = sm.OLS(y, X).fit()
full_r2 = model_plain.rsquared
for b in betas:
    reduced = sm.add_constant(X_raw.drop(columns=b))
    r2_reduced = sm.OLS(y, reduced).fit().rsquared
    print(f"  {b:22s}  partial R^2 = {full_r2 - r2_reduced:.4f}")

print(f"\nFull model R^2 = {full_r2:.4f}   Adj R^2 = {model_plain.rsquared_adj:.4f}   n = {len(df)}")

# ---- Save the dataset as CSV for reference ------------------------------
df.to_csv("wheel_strength_dataset.csv", index=False)
print("\nDataset written to wheel_strength_dataset.csv")
