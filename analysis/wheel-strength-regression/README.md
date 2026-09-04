# Lateral wheel-strength regression

OLS regression against the app's own 30-hub catalogue (`HUBS_148` + `HUBS_157`
from `src/data.js`), run through `wheel-physics-core`'s validated `calc()`
engine directly -- the same numbers the COMPARE tab shows, not a
re-derivation.

## Model

```
Y (F_lat, kgf) = b0 + b1*tension_ratio + b2*flange_width + b3*pcd_mean + b4*standard_157
```

Fixed at the app's defaults: 29" wheel (ERD 600mm), 32 spokes, 2.0mm spoke
diameter both sides, 100kgf drive-side tension.

| Beta | Definition | Source |
|---|---|---|
| `tension_ratio` | NDS/DS spoke tension split, % (`calc().ratio`) -- geometry-driven, not an independent input at fixed tension | engine output |
| `flange_width` | total hub flange width, `nds + ds` (mm) | hub geometry |
| `pcd_mean` | mean flange pitch-circle diameter, `(pds + pnds) / 2` (mm) | hub geometry |
| `standard_157` | axle standard dummy: 1 = 157mm Super Boost, 0 = 148mm Boost | hub catalogue membership |

`pcd_ds` / `pcd_nds` are also written to the dataset separately in case you
want to split PCD the same way `tension_ratio` already captures the DS/NDS
split, rather than averaging it.

## Running it

```bash
npm install                 # pulls wheel-physics-core, pinned to the same
                             # commit as the main app's package.json
node build_dataset.js > dataset.json
pip install numpy pandas statsmodels
python3 regression.py
```

`regression.py` prints the raw-unit OLS summary, standardized (z-scored)
betas with p-values, VIF per predictor, and partial R^2 per predictor, then
writes `wheel_strength_dataset.csv`.

## Results (n=30)

R^2 = 0.993, adj. R^2 = 0.992.

| Beta | std beta | p | VIF | partial R^2 |
|---|---|---|---|---|
| `tension_ratio` | 0.728 | <0.001 | 1.73 | 0.307 |
| `flange_width` | 0.696 | <0.001 | 3.21 | 0.151 |
| `pcd_mean` | 0.042 | 0.024 | 1.07 | 0.002 |
| `standard_157` | -0.037 | 0.278 | 4.00 | 0.0003 |

**Reading it:** tension symmetry and total flange width carry almost all of
the explained variance and are nearly tied in effect size. PCD is
statistically significant but the effect is negligible once flange width and
tension ratio are controlled for -- at the pull-circle range in this
catalogue (46-64mm), PCD's contribution to bracing angle is dominated by
flange offset. Axle standard (148 vs. 157) is *not* significant on its own
once geometry is in the model: the standard's apparent strength edge is
fully explained by 157mm hubs running wider flanges and better tension
balance, not by the axle width itself.

`flange_width` and `standard_157` carry a VIF of ~3-4 (157mm hubs
mechanically run wider flanges), worth watching if more betas are added
later, but not yet unstable at n=30.
