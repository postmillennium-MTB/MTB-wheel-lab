// Loads the hub catalogue from the app's own source file, so the regression
// never keeps a second copy of hub dimensions that could drift from the app.
//
// Source of truth: src/data.js inside wheel-lab-source.zip (repo root). The
// zip is read in place with `unzip -p` -- nothing is extracted to disk.
// data.js is a plain ES module with no imports, so stripping the `export`
// keywords and evaluating it is enough; if it ever gains an import, the
// check below fails loudly rather than silently returning a stale list.
const { execFileSync } = require('child_process');
const path = require('path');

const ZIP_PATH = path.join(__dirname, '..', '..', 'wheel-lab-source.zip');
const DATA_ENTRY = 'src/data.js';

const source = execFileSync('unzip', ['-p', ZIP_PATH, DATA_ENTRY], { encoding: 'utf8' });
if (/^\s*import\s/m.test(source)) {
  throw new Error(`${DATA_ENTRY} now has an import; hubs.js can no longer evaluate it standalone.`);
}

const { HUBS_148, HUBS_157 } = new Function(
  source.replace(/^export\s+/gm, '') + '\nreturn { HUBS_148, HUBS_157 };'
)();

// `standard` is the axle width (mm); the app encodes it by which array a hub
// sits in, the regression wants it as a per-hub field (beta4 dummy).
const tag = (hubs, standard) => hubs.map((h) => ({ ...h, standard }));
const ALL_HUBS = [...tag(HUBS_148, 148), ...tag(HUBS_157, 157)];

module.exports = { ALL_HUBS };
