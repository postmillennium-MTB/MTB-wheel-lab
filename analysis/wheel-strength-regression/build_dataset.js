// Builds the 30-hub regression dataset by running wheel-physics-core's
// validated calc() engine directly -- same math the live app uses.
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

const ALL = [...HUBS_148, ...HUBS_157];

// Fixed defaults: 29" wheel (ERD 600mm), 32 spokes, 2.0mm spoke diameter
// both sides, 100kgf drive-side tension, standard rim constants, 24 modes.
const ERD = 600, SPOKES = 32, SPK_DIA = 2, T_DS = 100;
const EIL = 50, EIR = 150, GJ = 22, EA_RIM = 115e5, MODES = 24;

const rows = ALL.map(h => {
  const r = calc(ERD, h, SPK_DIA, SPK_DIA, T_DS, EIL, EIR, GJ, EA_RIM, SPOKES, MODES);
  return {
    id: h.id,
    name: h.name,
    F_lat: r.F_lat,                 // Y
    tension_ratio: r.ratio,         // beta1: NDS/DS tension split, % (geometry-driven)
    flange_width: h.nds + h.ds,     // beta2: total hub flange width, mm
    pcd_mean: (h.pds + h.pnds) / 2, // beta3: mean flange PCD, mm
    pcd_ds: h.pds,
    pcd_nds: h.pnds,
    standard_157: h.standard === 157 ? 1 : 0, // beta4: axle standard dummy
  };
});

console.log(JSON.stringify(rows, null, 2));
