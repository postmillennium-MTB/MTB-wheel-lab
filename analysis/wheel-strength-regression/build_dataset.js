// Builds the full regression dataset by running wheel-physics-core's
// validated calc() engine directly -- same math the live app uses -- once
// per (hub, rim, spoke diameter, spoke count, tension, wheel size) tuple.
const { calc } = require('wheel-physics-core');

const HUBS_148 = [
  { id: "h1", name: "Onyx 148 MFU", nds: 36.9, ds: 22.92, pds: 50, pnds: 50 },
  { id: "h5", name: "Spank Hex J-Type Boost R148", nds: 37, ds: 25, pds: 64, pnds: 58 },
  { id: "h6", name: "CK 148x12 Centerlock Rear", nds: 36.3, ds: 24, pds: 57.4, pnds: 57.4 },
  { id: "h8", name: "Project 321 G3 148x12", nds: 32, ds: 22, pds: 60.5, pnds: 55 },
  { id: "h10", name: "Hydra Mountain 6-Bolt 148", nds: 38, ds: 25, pds: 60, pnds: 58 },
  { id: "h12", name: "I9 Hydra Centerlock 148", nds: 39, ds: 24, pds: 60, pnds: 49 },
  { id: "h14", name: "I9 1/1 Mountain 6-Bolt 148", nds: 37, ds: 23, pds: 60, pnds: 58 },
  { id: "h15", name: "Hope Pro5 148 6-bolt", nds: 35, ds: 22.6, pds: 59, pnds: 57 },
  { id: "h17", name: "Erase MTB IS 148x12 V2", nds: 38, ds: 25, pds: 56, pnds: 50 },
  { id: "h20", name: "Hadley 148x12", nds: 37.1, ds: 22.9, pds: 59, pnds: 52 },
  { id: "h21", name: "OneUp Rear Hub 148x12", nds: 38, ds: 23, pds: 48, pnds: 52 },
  { id: "h23", name: "KOM Xeno Rear Boost 148x12", nds: 30.5, ds: 23.5, pds: 46, pnds: 46 },
  { id: "h27", name: "DMR Zone 148 Boost Centerlock", nds: 38, ds: 21, pds: 56, pnds: 56 },
  { id: "h28", name: "DT Swiss 350 148 6-bolt", nds: 36.6, ds: 23.3, pds: 52, pnds: 58 },
  { id: "h30", name: "e*thirteen Sidekick 148 Boost", nds: 38, ds: 21, pds: 60, pnds: 60 },
].map(h => ({ ...h, standard: 148 }));

const HUBS_157 = [
  { id: "h2", name: "Onyx 150/157", nds: 41.4, ds: 27.42, pds: 50, pnds: 50 },
  { id: "h3", name: "Onyx 150/157 Vesper", nds: 41.4, ds: 26.97, pds: 50, pnds: 42 },
  { id: "h4", name: "Spank Hex J-Type R150/157", nds: 39.5, ds: 29.5, pds: 64, pnds: 58 },
  { id: "h7", name: "CK 157 SB Centerlock Rear", nds: 40.3, ds: 28.8, pds: 57.4, pnds: 57.4 },
  { id: "h9", name: "Project 321 G3 157 SB", nds: 32, ds: 26, pds: 60.5, pnds: 55 },
  { id: "h11", name: "I9 Hydra 6-Bolt 150/157", nds: 41, ds: 29, pds: 60, pnds: 58 },
  { id: "h13", name: "I9 Hydra Centerlock 157 SB", nds: 43, ds: 28, pds: 60, pnds: 49 },
  { id: "h16", name: "Hope Pro5 157 SB 6-bolt", nds: 39.6, ds: 27, pds: 59, pnds: 57 },
  { id: "h18", name: "Erase MTB IS 157x12 V2", nds: 42.5, ds: 29.5, pds: 56, pnds: 50 },
  { id: "h19", name: "Hadley 150/157", nds: 41.5, ds: 27.5, pds: 59, pnds: 59 },
  { id: "h22", name: "OneUp Rear Hub 157x12", nds: 35, ds: 26, pds: 48, pnds: 52.5 },
  { id: "h24", name: "KOM Xeno Rear Super Boost 157", nds: 35, ds: 28, pds: 46, pnds: 46 },
  { id: "h26", name: "DMR Zone 157 SB Centerlock", nds: 41, ds: 25, pds: 56, pnds: 56 },
  { id: "h29", name: "DT Swiss 350 157 6-bolt", nds: 41.1, ds: 27.9, pds: 50.5, pnds: 60 },
  { id: "h31", name: "e*thirteen Sidekick Pro 157 SB", nds: 42.5, ds: 25.5, pds: 60, pnds: 60 },
].map(h => ({ ...h, standard: 157 }));

const ALL_HUBS = [...HUBS_148, ...HUBS_157];

// ---------------------------------------------------------------------
// Rim catalog -- see README for sourcing and the rim_stiffness_index
// scaling method (an estimate; internal_width/depth/material are
// verified against manufacturer/retailer spec pages).
// ---------------------------------------------------------------------
const RIMS = [
  { id: "r1", name: "DT Swiss XM 481", material: "alloy", internal_width: 30, depth: 21 },
  { id: "r2", name: "Race Face ARC Offset 30", material: "alloy", internal_width: 30, depth: 20 },
  { id: "r3", name: "Stan's Flow S2", material: "alloy", internal_width: 30, depth: 18.2 },
  { id: "r4", name: "We Are One Convert", material: "carbon", internal_width: 35, depth: 21 },
  { id: "r5", name: "ENVE M730", material: "carbon", internal_width: 30, depth: 27 },
].map((r) => {
  const REF_WIDTH = 30, REF_DEPTH = 21; // DT Swiss XM 481 -- the app's existing default rim
  const geometryFactor = (r.internal_width * r.depth) / (REF_WIDTH * REF_DEPTH);
  const materialFactor = r.material === "carbon" ? 1.35 : 1.0;
  return { ...r, rim_stiffness_index: +(geometryFactor * materialFactor).toFixed(3) };
});

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

const rows = [];
for (const h of ALL_HUBS) {
  for (const r of RIMS) {
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

console.log(JSON.stringify(rows, null, 2));
console.error(`# ${rows.length} rows (30 hubs x 5 rims x 2 spoke-dia x 2 spoke-count x 2 tension x 2 wheel-size)`);
