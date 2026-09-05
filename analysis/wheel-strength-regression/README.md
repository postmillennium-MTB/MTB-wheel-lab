# Lateral wheel-strength regression

OLS regression against the app's own 30-hub catalogue (`HUBS_148` + `HUBS_157`
from `src/data.js`), crossed against a 5-rim catalogue, run through
`wheel-physics-core`'s validated `calc()` engine directly -- the same numbers
the COMPARE tab shows, not a re-derivation.

## Interactive explorer

[`explorer.html`](./explorer.html) is a standalone page (no build step, no
server -- open the file directly) that fits the same model live in the
browser. Toggle betas on and off as chips; the standardized-coefficient
chart and the predicted-vs-actual scatter both refit on every click. It
carries its own copy of the 150-row dataset so it has no runtime dependency
on `wheel-physics-core`.

Two guardrails/notes worth knowing before you start clicking:

- `pcd_mean` and the `pcd_ds`/`pcd_nds` pair are mutually exclusive --
  `pcd_mean` is exactly their average, so having all three selected at once
  makes the design matrix exactly singular, not just correlated.
- `rim_stiffness_index` and `rim_internal_width` are *not* mutually
  exclusive (VIF &asymp; 1.3 -- correlated, not degenerate) but the
  in-browser CI whiskers do **not** cluster standard errors by hub, even
  though each hub appears 5 times (once per rim). The Python regression
  below does cluster by `hub_id`; treat the browser tool's confidence
  intervals as a quick-look approximation.

## Model

```
Y (F_lat, kgf) = b0 + b1*tension_ratio + b2*flange_width + b3*pcd_mean
               + b4*standard_157 + b5*rim_stiffness_index
```

Fixed at the app's defaults: 29" wheel (ERD 600mm), 32 spokes, 2.0mm spoke
diameter both sides, 100kgf drive-side tension. Rim stiffness constants
(EIL/EIR/GJ/EA_rim) are scaled per-rim by `rim_stiffness_index` -- see below.

| Beta | Definition | Source |
|---|---|---|
| `tension_ratio` | NDS/DS spoke tension split, % (`calc().ratio`) -- geometry-driven, not an independent input at fixed tension | engine output |
| `flange_width` | total hub flange width, `nds + ds` (mm) | hub geometry |
| `pcd_mean` | mean flange pitch-circle diameter, `(pds + pnds) / 2` (mm) | hub geometry |
| `standard_157` | axle standard dummy: 1 = 157mm Super Boost, 0 = 148mm Boost | hub catalogue membership |
| `rim_stiffness_index` | composite rim stiffness scale, **estimated** (see below) | rim geometry + a documented material rule of thumb |
| `rim_internal_width` | rim internal width, mm, **verified** against manufacturer/retailer specs | rim catalogue |

`pcd_ds` / `pcd_nds` are also written to the dataset separately, mutually
exclusive with `pcd_mean` in the explorer as noted above.

## Rim catalogue and the stiffness estimate

The 30-hub catalogue is crossed with 5 rims currently sold for trail/enduro
use, chosen to span alloy and carbon, narrow and wide, shallow and deep:

| Rim | Material | Internal width | Depth | Stiffness index | Source |
|---|---|---|---|---|---|
| DT Swiss XM 481 | alloy | 30mm | 21mm | 1.000 (reference) | [dtswiss.com](https://www.dtswiss.com/en/components/rims-mtb/all-mountain/xm-481), [biketart.com](https://www.biketart.com/products/dt-swiss-xm-481-sbwt-disc-specific-rim) |
| Race Face ARC Offset 30 | alloy | 30mm | 20mm | 0.952 | [bike24.com](https://www.bike24.com/p2311760.html), [probikesupply.com](https://www.probikesupply.com/products/raceface-arc-30-rim-29-disc-black-32h-offset) |
| Stan's Flow S2 | alloy | 30mm | 18.2mm | 0.867 | [stans.com](https://stans.com/products/flow-s2-rim) |
| We Are One Convert | carbon | 35mm | 21mm | 1.575 | [evoride-wheels.com](https://www.evoride-wheels.com/en/produit/we-are-one-convert/) |
| ENVE M730 | carbon | 30mm | 27mm | 1.736 | [enve.com](https://enve.com/pages/tech-specs-m730-wheels/), [nsmb.com](https://nsmb.com/articles/enve-m730-wheels/) |

**Internal width, depth, and material are verified** against the sources
linked above. **`rim_stiffness_index` is not** -- no manufacturer publishes
a rim's bending or torsional stiffness in the N&middot;m&sup2; units Ford's
Mode Matrix model needs, so those numbers cannot be looked up for any rim on
the market, let alone these five. The index is this analysis's own estimate,
built like this:

```
geometry_factor = (internal_width_mm * depth_mm) / (30 * 21)   # DT Swiss XM 481 = 1.00
material_factor = 1.35 for carbon, 1.00 for alloy               # rule of thumb, not measured
rim_stiffness_index = geometry_factor * material_factor
```

The reference point (index = 1.00) is the DT Swiss XM 481's geometry,
chosen because it's the closest real match to the generic alloy
double-wall rim the app's existing default constants (`EIL=50, EIR=150,
GJ=22, EA_rim=115e5`) already represent -- so a hub run through the
DT Swiss XM 481 row reproduces the exact same `F_lat` this tool computed
before rims were added at all.

The index is then applied **uniformly** to all four of Ford's constants
(EIL, EIR, GJ, EA_rim) for that rim. That's a real simplification: a wider,
deeper rim does not necessarily stiffen laterally, radially, and
torsionally by the same factor. Splitting it into four independently
justified exponents would need wall-thickness and carbon layup data no
manufacturer publishes -- one indicative, clearly-labeled index beats four
invented ones dressed up as separately derived. The 1.35 carbon multiplier
is an industry rule-of-thumb for stiffness-per-cross-section, not a
measurement of any of these five specific rims.

**Bottom line: treat `rim_stiffness_index` as a labeled estimate for
exploring the model's sensitivity to rim choice, not as a claim about how
much stiffer an ENVE M730 actually is than a Stan's Flow S2.** The
`rim_internal_width` beta is offered alongside it specifically because it
carries no such caveat -- it's a number you can check yourself against the
rim's own spec sheet.

## A note on the dataset's structure

150 rows = 30 hubs &times; 5 rims, so each hub appears five times (once per
rim) rather than being a fresh, independent observation. That's a
repeated-measures design, not a simple random sample -- residuals for the
five rows sharing a hub are correlated with each other. `regression.py`
below fits with standard errors clustered by `hub_id` to account for this;
the in-browser explorer does not (see the guardrail note above).

## Running it

```bash
npm install                 # pulls wheel-physics-core, pinned to the same
                             # commit as the main app's package.json
node build_dataset.js > dataset.json
pip install numpy pandas statsmodels
python3 regression.py
```

`regression.py` prints the raw-unit OLS summary (cluster-robust SEs by
hub), standardized (z-scored) betas with p-values, VIF per predictor, and
partial R^2 per predictor, then writes `wheel_strength_dataset.csv`.

## Results (n=150, 30 hubs x 5 rims)

R^2 = 0.985, adj. R^2 = 0.984 (SEs clustered by hub).

| Beta | std beta | p (clustered) | VIF | partial R^2 |
|---|---|---|---|---|
| `rim_stiffness_index` | 0.690 | <0.001 | 1.00 | 0.476 |
| `tension_ratio` | 0.544 | <0.001 | 1.73 | 0.171 |
| `flange_width` | 0.467 | <0.001 | 3.21 | 0.068 |
| `pcd_mean` | 0.028 | 0.052 | 1.07 | 0.001 |
| `standard_157` | -0.022 | 0.246 | 4.00 | 0.0001 |

**Reading it:** rim stiffness is now the single largest lever on lateral
strength in this model -- larger than tension symmetry or flange width,
both of which still matter and are still nearly tied with each other.
That's the physically expected result once a wide enough rim-stiffness
range is in the sample: `F_lat` is downstream of `K_lat`, which is close to
linear in the rim's bending stiffness in Ford's model, while hub geometry
enters through the (bounded, sub-linear) bracing-angle sine terms. It is
also the beta with the least certain numbers behind it -- see the estimate
caveat above before treating "rim choice beats hub choice" as a settled
claim rather than a plausible, sensibly-signed result from an admittedly
rough stiffness scale. `pcd_mean` and `standard_157` remain the same as
before: negligible-to-null once the other geometry is controlled for.

`flange_width` and `standard_157` still carry a VIF of ~3-4 (157mm hubs
mechanically run wider flanges); `rim_stiffness_index` is orthogonal to
every hub beta by construction (VIF = 1.00, since it doesn't depend on hub
geometry at all).

## Working with Claude on this file

To extend the rim catalogue: give the next session the rim's name and ask
it to (1) web-search internal width, depth, and material against the
manufacturer's own spec page, (2) compute `rim_stiffness_index` using the
formula above against the DT Swiss XM 481 reference row, (3) never invent
a depth or width it can't find a source for -- drop the rim rather than
guess, the way ENVE and e*thirteen's LG1 EN were each considered and only
one made it into the catalogue because only one had a sourced depth
figure at the time.
