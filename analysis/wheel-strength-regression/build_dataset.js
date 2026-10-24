// Builds the full regression dataset by running wheel-physics-core's
// validated calc() engine directly -- same math the live app uses -- once
// per (hub, rim, spoke diameter, spoke count, tension, wheel size) tuple.
const { calc } = require('wheel-physics-core');

// ---------------------------------------------------------------------
// Hub catalogue -- NOT defined here. The app's own src/data.js (inside
// wheel-lab-source.zip) is the single source of truth; hubs.js reads it
// from there so the app and this regression can never disagree about a
// hub's dimensions. To change a hub, edit src/data.js in the archive.
// ---------------------------------------------------------------------
const { ALL_HUBS } = require('./hubs');

// ---------------------------------------------------------------------
// Rim catalog -- see README for sourcing and the rim_stiffness_index
// scaling method (an estimate; internal_width/depth/material are
// verified against manufacturer/retailer spec pages).
// ---------------------------------------------------------------------
const RIM_CATALOG = [
  { id: "r1", name: "DT Swiss XM 481", material: "alloy", internal_width: 30, depth: 21 },
  { id: "r2", name: "Race Face ARC Offset 30", material: "alloy", internal_width: 30, depth: 20 },
  { id: "r3", name: "Stan's Flow S2", material: "alloy", internal_width: 30, depth: 18.2 },
  { id: "r4", name: "We Are One Convert", material: "carbon", internal_width: 35, depth: 21 },
  { id: "r5", name: "ENVE M730", material: "carbon", internal_width: 30, depth: 27 },
];
// carbonFactor is the carbon materialFactor: 1.35 by default, an
// unmeasured assumption (see README); explorer.html offers 1.0 and 0.75 too.
const DEFAULT_CARBON_FACTOR = 1.35;
const rimsFor = (carbonFactor) => RIM_CATALOG.map((r) => {
  const REF_WIDTH = 30, REF_DEPTH = 21; // DT Swiss XM 481 -- the app's existing default rim
  const geometryFactor = (r.internal_width * r.depth) / (REF_WIDTH * REF_DEPTH);
  const materialFactor = r.material === "carbon" ? carbonFactor : 1.0;
  return { ...r, rim_stiffness_index: +(geometryFactor * materialFactor).toFixed(3) };
});
const RIMS = rimsFor(DEFAULT_CARBON_FACTOR);

// ---------------------------------------------------------------------
// Build-spec betas 1-4. Each is a real, verifiable spec or a published
// working range -- not an estimate like rim_stiffness_index. Two levels
// per dimension (not three) to keep the full factorial (30 hubs x 5
// rims x 2^4 = 2400 rows) a size an in-browser explorer can still hold
// entirely in memory. See README for sources.
// ---------------------------------------------------------------------
// 1. Spoke diameter (mm) -- same gauge both sides (mixed-gauge builds
//    are common in practice but would double this dimension again; not
//    modeled here). 14g = 2.0mm, 15g = 1.8mm (SWG standard).
const SPOKE_DIAMETERS = [1.8, 2.0];
// 2. Spoke count -- 28h and 32h, the two most common trail/enduro
//    counts in this hub catalogue's actual product lines. 36h exists
//    but is more DH-specific; omitted to hold the factorial size down.
const SPOKE_COUNTS = [28, 32];
// 3. Drive-side build tension (kgf) -- 90kgf (Stan's-style modern-rim
//    low end) to 120kgf (DT Swiss's stated maximum). Not a component
//    spec, but bracketed by two manufacturers' own published numbers
//    rather than picked arbitrarily.
const TENSIONS_KGF = [90, 120];
// 4. Wheel size (ERD, mm) -- 27.5" and 29" only; this hub/rim catalogue
//    is trail/enduro-oriented and 26"/32"(fat) aren't realistic options
//    for it. ERD values from the app's own RIM_ERD_BY_SIZE table.
const WHEEL_SIZES = [
  { label: "27.5", erd: 559 },
  { label: "29", erd: 600 },
];

const SPOKES_PER_SIDE_DIA = (d) => d; // same diameter both sides, kept as a named step for clarity
const EIL_REF = 50, EIR_REF = 150, GJ_REF = 22, EA_RIM_REF = 115e5, MODES = 24;

function buildRows(carbonFactor = DEFAULT_CARBON_FACTOR) {
const rows = [];
for (const h of ALL_HUBS) {
  for (const r of rimsFor(carbonFactor)) {
    for (const dia of SPOKE_DIAMETERS) {
      for (const count of SPOKE_COUNTS) {
        for (const tension of TENSIONS_KGF) {
          for (const wheel of WHEEL_SIZES) {
            const idx = r.rim_stiffness_index;
            const spk = SPOKES_PER_SIDE_DIA(dia);
            const result = calc(
              wheel.erd, h, spk, spk, tension,
              EIL_REF * idx, EIR_REF * idx, GJ_REF * idx, EA_RIM_REF * idx,
              count, MODES
            );
            rows.push({
              hub_id: h.id,
              hub_name: h.name,
              rim_id: r.id,
              rim_name: r.name,
              F_lat: result.F_lat,                     // Y
              tension_ratio: result.ratio,              // beta1
              flange_width: h.nds + h.ds,               // beta2
              pcd_mean: (h.pds + h.pnds) / 2,           // beta3
              pcd_ds: h.pds,
              pcd_nds: h.pnds,
              standard_157: h.standard === 157 ? 1 : 0, // beta4
              rim_stiffness_index: idx,                 // beta5 (estimated)
              rim_internal_width: r.internal_width,     // beta6 (verified)
              rim_material: r.material,
              spoke_diameter: dia,                      // beta7 (verified)
              spoke_count: count,                       // beta8 (verified)
              tension_kgf: tension,                     // beta9 (verified, working-range setpoint)
              wheel_erd: wheel.erd,                     // beta10 (verified)
              wheel_size: wheel.label,
            });
          }
        }
      }
    }
  }
}

return rows;
}

module.exports = { buildRows, DEFAULT_CARBON_FACTOR };

// Run directly (`node build_dataset.js > dataset.json`): print the rows.
// When require()d by build_explorer.js, only buildRows is exported.
if (require.main === module) {
  const rows = buildRows();
  console.log(JSON.stringify(rows, null, 2));
  console.error(`# ${rows.length} rows (${ALL_HUBS.length} hubs x ${RIMS.length} rims x ${SPOKE_DIAMETERS.length} spoke-dia x ${SPOKE_COUNTS.length} spoke-count x ${TENSIONS_KGF.length} tension x ${WHEEL_SIZES.length} wheel-size)`);
}
