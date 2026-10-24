// Regenerates the two blocks embedded in explorer.html:
//   DATA        -- the 2,400-row factorial dataset (carbon factor 1.35)
//   CARBON_ADJ  -- the carbon rows' F_lat and rim_stiffness_index at the
//                  page's other carbon-factor choices, keyed by DATA index.
//                  Precomputed here so the page needs no copy of the engine.
// Both are written between BEGIN/END GENERATED markers in explorer.html, so
// nothing else in the page is touched. Run after any hub or rim change:
//   node build_explorer.js
const fs = require('fs');
const path = require('path');
const { buildRows } = require('./build_dataset');

const EXPLORER = path.join(__dirname, 'explorer.html');

const dataRow = (r) =>
  `    {hub:${JSON.stringify(r.hub_name)},rim:${JSON.stringify(r.rim_name)},F_lat:${r.F_lat},tension_ratio:${r.tension_ratio},flange_width:${r.flange_width},pcd_mean:${r.pcd_mean},pcd_ds:${r.pcd_ds},pcd_nds:${r.pcd_nds},standard_157:${r.standard_157},rim_stiffness_index:${r.rim_stiffness_index},rim_internal_width:${r.rim_internal_width},rim_material:${JSON.stringify(r.rim_material)},spoke_diameter:${r.spoke_diameter},spoke_count:${r.spoke_count},tension_kgf:${r.tension_kgf},wheel_erd:${r.wheel_erd}}`;

// Must match CARBON_FACTOR_OPTIONS in explorer.html (1.35 is DATA itself).
const OTHER_CARBON_FACTORS = [1.0, 0.75];

const rows = buildRows();
const adj = OTHER_CARBON_FACTORS.map((f) => {
  const alt = buildRows(f);
  const entries = [];
  alt.forEach((r, i) => {
    if (rows[i].hub_name !== r.hub_name || rows[i].rim_name !== r.rim_name) throw new Error('row order differs');
    if (r.rim_material === 'carbon') entries.push(`${i}:[${r.F_lat},${r.rim_stiffness_index}]`);
  });
  return `    ${JSON.stringify(String(f))}: {${entries.join(',')}}`;
});

const blocks = {
  DATA: '  const DATA = [\n' + rows.map(dataRow).join(',\n') + '\n  ];',
  CARBON_ADJ: '  const CARBON_ADJ = {\n' + adj.join(',\n') + '\n  };',
};

let html = fs.readFileSync(EXPLORER, 'utf8');
for (const [name, body] of Object.entries(blocks)) {
  const re = new RegExp(`(  // BEGIN GENERATED ${name}[^\\n]*\\n)[\\s\\S]*?(\\n  // END GENERATED ${name})`);
  if (!re.test(html)) throw new Error(`Marker pair for ${name} not found in explorer.html`);
  html = html.replace(re, (_, begin, end) => begin + body + end);
}
fs.writeFileSync(EXPLORER, html);
console.error('explorer.html: DATA and CARBON_ADJ regenerated.');
