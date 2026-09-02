// Runtime smoke test: loads the actual built dist/index.html into a
// simulated DOM and confirms the app mounts and renders real content
// without throwing. This is the strongest automated check available
// without a real browser -- it exercises the whole render tree (all
// four tabs' initial state), not just syntax.
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf-8");

// jsdom doesn't implement ResizeObserver (used by Recharts' ResponsiveContainer);
// stub it so charts render at a fixed size instead of erroring.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
dom.window.ResizeObserver = ResizeObserverStub;

// Recharts' ResponsiveContainer reads getBoundingClientRect for sizing.
dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
  width: 600, height: 400, top: 0, left: 0, right: 600, bottom: 400, x: 0, y: 0, toJSON() {},
});

let caughtError = null;
dom.window.addEventListener("error", (e) => {
  caughtError = e.error || e.message;
});

// give React a tick to render
await new Promise((resolve) => setTimeout(resolve, 300));

const root = dom.window.document.getElementById("root");

function fail(message) {
  console.error("Smoke test FAILED:", message);
  if (caughtError) console.error(caughtError);
  dom.window.close();
  process.exit(1);
}

if (!root || root.textContent.length === 0) fail("#root has no rendered content after initial mount.");
if (caughtError) fail("runtime error during initial render.");
if (!root.textContent.includes("Wheel Strength Lab")) fail("expected heading text not found after initial mount.");

// Click through every tab. Each tab renders a distinct code path (charts,
// the symmetry demo, etc.) that the default COMPARE-tab render never
// touches -- an undefined-variable bug in any of them would otherwise
// only surface when a real user happened to click there.
const tabNames = ["SYMMETRY", "SIMULATION", "DEEP DIVE", "COMPARE"];
for (const name of tabNames) {
  const buttons = [...dom.window.document.querySelectorAll("button")];
  const tabButton = buttons.find((b) => b.textContent.trim() === name);
  if (!tabButton) fail(`could not find a "${name}" tab button to click.`);
  tabButton.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  if (caughtError) fail(`runtime error after switching to the ${name} tab.`);
  if (root.textContent.length === 0) fail(`#root emptied out after switching to the ${name} tab.`);
}

// The COMPARE tab's hub cross-section must redraw for the hub the user picks.
// It used to be wired to a fixed illustrative geometry, so it drew the same
// 37mm/20mm hub whatever the dropdown said -- while the strength figures
// beside it, and the TOTAL FLANGE WIDTH readout directly below it, followed
// the selection correctly. This checks the drawing actually moves.
const compareTab = [...dom.window.document.querySelectorAll("button")]
  .find((b) => b.textContent.trim() === "COMPARE");
compareTab.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 150));

// The dimension callouts are the "<n>mm" texts inside the first cross-section.
function hubDimensions() {
  const svg = dom.window.document.querySelector('svg[viewBox="0 0 280 224"]');
  if (!svg) fail("could not find a hub cross-section SVG on the COMPARE tab.");
  return [...svg.querySelectorAll("text")]
    .map((t) => t.textContent)
    .filter((t) => /mm$/.test(t))
    .join(" ");
}

const hubSelect = dom.window.document.querySelector("select");
if (!hubSelect) fail("could not find the hub dropdown on the COMPARE tab.");
const options = [...hubSelect.querySelectorAll("option")].map((o) => o.value);
if (options.length < 2) fail("hub dropdown has fewer than two options to compare.");

const before = hubDimensions();
// React tracks a controlled <select>'s value, so assigning to .value alone is
// swallowed. Go through the prototype setter, then fire change, the same way
// a real selection does.
const setValue = Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set;
setValue.call(hubSelect, options[options.length - 1]);
hubSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
await new Promise((resolve) => setTimeout(resolve, 150));
if (caughtError) fail("runtime error after changing the hub selection.");

const after = hubDimensions();
if (before === after) {
  fail(`hub cross-section did not redraw when a different hub was selected (still "${before}").`);
}

console.log("Smoke test passed: app mounted, every tab rendered, and the hub diagram follows the dropdown.");
dom.window.close();
