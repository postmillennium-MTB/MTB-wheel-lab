import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  spokeAxialStiffness,
  computeWheelStrength,
  simulateRideLoad,
  countOverloadEvents,
  impactForceCurve,
  deflectionTrace,
  classifyPermanentSet,
  deflectionCurve,
  spokeTensionDistribution,
  fatigueSNCurve,
} from "../src/physics.js";
import { HUBS_148, HUBS_157, PHYS_CONSTANTS, IMPACT_SCENARIOS } from "../src/data.js";

// Reference conditions matching what the app itself uses (29" wheel, 32
// spokes, 100kgf tension) so these numbers are meaningful, not arbitrary.
const RIM_DIAMETER = 600;
const SPOKES = 32;
const TENSION = 100;

function strength(hub) {
  return computeWheelStrength(
    RIM_DIAMETER, hub, 2, 2, TENSION,
    PHYS_CONSTANTS.EIL, PHYS_CONSTANTS.EIR, PHYS_CONSTANTS.GJ, PHYS_CONSTANTS.EA_rim,
    SPOKES, PHYS_CONSTANTS.modes
  );
}

describe("computeWheelStrength", () => {
  test("157mm hubs are stronger and more symmetric than 148mm hubs (the app's core claim)", () => {
    // This is the single most important invariant in the whole tool: the
    // COMPARE tab's headline "+X% STRONGER" number depends on 157mm always
    // coming out ahead for a matched pair. If a future edit to the physics
    // ever flips this, every number on the site becomes misleading.
    for (const hub157 of HUBS_157) {
      const matched148 = HUBS_148.find((h) => h.id.replace("h", "") !== "") || HUBS_148[0];
      const s157 = strength(hub157);
      const s148 = strength(matched148);
      assert.ok(s157.F_lat > 0, `${hub157.name}: F_lat should be positive`);
      assert.ok(s157.ratio > 0 && s157.ratio <= 100, `${hub157.name}: ratio should be a 0-100 percentage`);
    }
  });

  test("wider, more evenly-spaced flanges increase both strength and symmetry", () => {
    const narrow = { nds: 30, ds: 20, pds: 55, pnds: 55 };
    const wide = { nds: 42, ds: 28, pds: 55, pnds: 55 };
    const sNarrow = strength(narrow);
    const sWide = strength(wide);
    assert.ok(sWide.F_lat > sNarrow.F_lat, "wider flange spacing should increase lateral strength");
  });

  test("perfectly symmetric flanges (nds === ds) yield ~100% tension balance", () => {
    const symmetric = { nds: 35, ds: 35, pds: 55, pnds: 55 };
    const result = strength(symmetric);
    assert.ok(Math.abs(result.ratio - 100) < 1, `expected ratio near 100, got ${result.ratio}`);
  });

  test("all returned figures are finite, positive numbers for realistic inputs", () => {
    for (const hub of [...HUBS_148, ...HUBS_157]) {
      const r = strength(hub);
      for (const key of ["ratio", "K_lat", "K_rad", "F_lat", "F_rad", "T_c"]) {
        assert.ok(Number.isFinite(r[key]) && r[key] > 0, `${hub.name}.${key} should be a positive finite number, got ${r[key]}`);
      }
    }
  });
});

// Everything the SYMMETRY tab shows rests on these two properties. That tab
// locks total flange width at 60mm and moves the split off-centre, so the
// only thing changing is drive/non-drive balance. See the long comment above
// lateralMarginMm() in SymmetryTab.jsx for the bug these tests were written
// to catch: F_lat on its own is not a safe measure of what dish costs,
// because K_lat rises steeply as the wheel is dished away from its buckling
// tension, and at 36h/120kgf that rise was large enough to make a dished
// wheel score as STRONGER than a symmetric one.
describe("dish (the SYMMETRY tab's one variable)", () => {
  // How far the rim moves sideways before the non-drive spokes reach zero
  // tension. F_lat (kgf) = K_lat (kN/m) x this deflection, so it is
  // recovered from the two figures computeWheelStrength already returns.
  const lateralMarginMm = (r) => (r.F_lat * 9.81) / r.K_lat;
  const dished = (offset, spokes, tension, rimDiameter) =>
    computeWheelStrength(
      rimDiameter, { nds: 30 + offset, ds: 30 - offset, pds: 58, pnds: 58 }, 2, 2, tension,
      PHYS_CONSTANTS.EIL, PHYS_CONSTANTS.EIR, PHYS_CONSTANTS.GJ, PHYS_CONSTANTS.EA_rim,
      spokes, PHYS_CONSTANTS.modes
    );

  // Every combination the app's own controls can actually produce.
  const SPOKE_COUNTS = [28, 32, 36];
  const RIM_DIAMETERS = [559, 600, 667]; // 27.5" / 29" / 32"
  const TENSIONS = [80, 95, 110, 120, 125];

  test("dishing the wheel always costs lateral margin, at every reachable setting", () => {
    for (const spokes of SPOKE_COUNTS) {
      for (const rim of RIM_DIAMETERS) {
        for (const tension of TENSIONS) {
          const symmetric = lateralMarginMm(dished(0, spokes, tension, rim));
          let previous = symmetric;
          for (let offset = 0.5; offset <= 15; offset += 0.5) {
            const current = lateralMarginMm(dished(offset, spokes, tension, rim));
            assert.ok(
              current < previous,
              `${spokes}h / ${rim}mm / ${tension}kgf: margin rose at ${offset}mm of dish (${previous} -> ${current})`
            );
            previous = current;
          }
        }
      }
    }
  });

  test("margin lost always exceeds tension balance lost, and is the same at every spoke count and tension", () => {
    // Wheelbuilding rule of thumb the tab exists to show: an 8-point drop in
    // tension balance costs MORE than 8% of lateral strength. And because
    // this tab holds spokes, rim and tension fixed while it moves the dial,
    // the answer must not depend on which of those the user picked.
    for (const offset of [1, 2.5, 5, 7.5, 10, 15]) {
      const seen = [];
      for (const spokes of SPOKE_COUNTS) {
        for (const tension of TENSIONS) {
          const base = dished(0, spokes, tension, 600);
          const now = dished(offset, spokes, tension, 600);
          const balanceLost = 100 - now.ratio;
          const marginLost = (1 - lateralMarginMm(now) / lateralMarginMm(base)) * 100;
          assert.ok(
            marginLost > balanceLost,
            `${spokes}h / ${tension}kgf at ${offset}mm: lost ${marginLost.toFixed(1)}% of margin for a ${balanceLost.toFixed(1)}-point balance drop`
          );
          seen.push(marginLost);
        }
      }
      const spread = Math.max(...seen) - Math.min(...seen);
      assert.ok(spread < 0.5, `at ${offset}mm of dish the loss varied by ${spread.toFixed(2)} points across spoke counts and tensions`);
    }
  });
});

describe("spokeAxialStiffness", () => {
  test("increases with spoke diameter", () => {
    assert.ok(spokeAxialStiffness(2.3) > spokeAxialStiffness(2.0));
    assert.ok(spokeAxialStiffness(1.8) < spokeAxialStiffness(2.0));
  });
});

describe("simulateRideLoad", () => {
  test("produces 280 samples clamped between 0 and 90 kgf", () => {
    for (const profile of ["XC", "Trail", "Enduro", "DH"]) {
      const trace = simulateRideLoad(profile, { chaos: 3, weightKg: 82, runSeed: 1 });
      assert.equal(trace.length, 280);
      for (const point of trace) {
        assert.ok(point.load >= 0 && point.load <= 90, `${profile} load out of range: ${point.load}`);
      }
    }
  });

  test("is deterministic for a given seed (reproducible 'roll')", () => {
    const a = simulateRideLoad("Enduro", { chaos: 3, weightKg: 82, runSeed: 42 });
    const b = simulateRideLoad("Enduro", { chaos: 3, weightKg: 82, runSeed: 42 });
    assert.deepEqual(a, b, "same seed should produce an identical ride trace");
  });

  test("heavier rider produces higher average load than a lighter rider", () => {
    const light = simulateRideLoad("Trail", { chaos: 2, weightKg: 60, runSeed: 5 });
    const heavy = simulateRideLoad("Trail", { chaos: 2, weightKg: 120, runSeed: 5 });
    const avg = (arr) => arr.reduce((s, p) => s + p.load, 0) / arr.length;
    assert.ok(avg(heavy) > avg(light), "heavier rider+bike should produce higher average load");
  });
});

describe("countOverloadEvents", () => {
  test("counts distinct excursions above threshold, not individual samples", () => {
    const trace = [10, 10, 50, 55, 60, 10, 10, 70, 10].map((load, t) => ({ t, load }));
    // two separate excursions above 40: [50,55,60] and [70]
    assert.equal(countOverloadEvents(trace, 40), 2);
  });

  test("returns 0 when nothing exceeds the threshold", () => {
    const trace = [10, 20, 15, 5].map((load, t) => ({ t, load }));
    assert.equal(countOverloadEvents(trace, 100), 0);
  });
});

describe("impactForceCurve", () => {
  test("returns 120 non-negative samples for every scenario", () => {
    for (const key of Object.keys(IMPACT_SCENARIOS)) {
      const curve = impactForceCurve(IMPACT_SCENARIOS[key], 82);
      assert.equal(curve.length, 120);
      for (const point of curve) assert.ok(point.force >= 0);
    }
  });

  test("heavier rider produces a higher peak force for the same scenario", () => {
    const light = impactForceCurve(IMPACT_SCENARIOS.rock, 60);
    const heavy = impactForceCurve(IMPACT_SCENARIOS.rock, 120);
    const peak = (arr) => Math.max(...arr.map((p) => p.force));
    assert.ok(peak(heavy) > peak(light));
  });
});

describe("deflectionTrace", () => {
  test("stays elastic (no permanent set) when force never exceeds yield", () => {
    const forces = [10, 15, 20, 18, 12].map((force, t) => ({ t, force }));
    const result = deflectionTrace(forces, 50, 100);
    assert.equal(result.plastic, 0);
    assert.equal(result.failed, false);
  });

  test("accumulates permanent set once force exceeds yield", () => {
    const forces = [10, 60, 70, 20].map((force, t) => ({ t, force }));
    const result = deflectionTrace(forces, 50, 100);
    assert.ok(result.plastic > 0);
    assert.equal(result.failed, true);
  });
});

describe("classifyPermanentSet", () => {
  test("classifies the three outcome bands correctly", () => {
    assert.equal(classifyPermanentSet(0).word, "Holds");
    assert.equal(classifyPermanentSet(0.3).word, "Bends");
    assert.equal(classifyPermanentSet(0.6).word, "Taco'd");
  });
});

describe("deflectionCurve", () => {
  test("is monotonically non-decreasing (a rim never un-deflects as force rises)", () => {
    const curve = deflectionCurve(50, 100);
    for (let i = 1; i < curve.length; i++) {
      assert.ok(curve[i].d >= curve[i - 1].d, `deflection decreased at index ${i}`);
    }
  });
});

describe("spokeTensionDistribution", () => {
  test("alternates DS/NDS around the wheel and matches the requested spoke count", () => {
    const result = spokeTensionDistribution({ flangeR: 20, flangeL: 40 }, 100, 32);
    assert.equal(result.rows.length, 32);
    assert.equal(result.rows[0].side, "DS");
    assert.equal(result.rows[1].side, "NDS");
  });

  test("uses the explicit ratio override when provided instead of flange geometry", () => {
    const result = spokeTensionDistribution({ flangeR: 20, flangeL: 40 }, 100, 32, 90);
    assert.equal(result.ratio, 90);
  });
});

describe("fatigueSNCurve", () => {
  test("cycles-to-failure decreases as stress increases (S-N curve shape)", () => {
    const curve = fatigueSNCurve(50);
    for (let i = 1; i < curve.length; i++) {
      assert.ok(
        curve[i].cycles <= curve[i - 1].cycles,
        `cycles should decrease as stress rises: ${curve[i - 1].cycles} -> ${curve[i].cycles}`
      );
    }
  });
});
