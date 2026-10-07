// Regenerates the two hub-derived blocks embedded in explorer.html:
//   DATA      -- the 2,400-row factorial dataset
//   HUB_GEOM  -- per-hub {nds, ds, pds, pnds} lookup the page's own calc() uses
// Both are written between BEGIN/END GENERATED markers in explorer.html, so
// nothing else in the page is touched. Run after any hub or rim change:
//   node build_explorer.js
const fs = require('fs');
const path = require('path');
const { buildRows } = require('./build_dataset');
const { ALL_HUBS } = require('./hubs');

const EXPLORER = path.join(__dirname, 'explorer.html');

const dataRow = (r) =>
  `    {hub:${JSON.stringify(r.hub_name)},rim:${JSON.stringify(r.rim_name)},F_lat:${r.F_lat},tension_ratio:${r.tension_ratio},flange_width:${r.flange_width},pcd_mean:${r.pcd_mean},pcd_ds:${r.pcd_ds},pcd_nds:${r.pcd_nds},standard_157:${r.standard_157},rim_stiffness_index:${r.rim_stiffness_index},rim_internal_width:${r.rim_internal_width},rim_material:${JSON.stringify(r.rim_material)},spoke_diameter:${r.spoke_diameter},spoke_count:${r.spoke_count},tension_kgf:${r.tension_kgf},wheel_erd:${r.wheel_erd}}`;

const geomRow = (h) =>
  `    ${JSON.stringify(h.name)}: {nds:${h.nds},ds:${h.ds},pds:${h.pds},pnds:${h.pnds}}`;

const blocks = {
  DATA: '  const DATA = [\n' + buildRows().map(dataRow).join(',\n') + '\n  ];',
  HUB_GEOM: '  const HUB_GEOM = {\n' + ALL_HUBS.map(geomRow).join(',\n') + '\n  };',
};

let html = fs.readFileSync(EXPLORER, 'utf8');
for (const [name, body] of Object.entries(blocks)) {
  const re = new RegExp(`(  // BEGIN GENERATED ${name}[^\\n]*\\n)[\\s\\S]*?(\\n  // END GENERATED ${name})`);
  if (!re.test(html)) throw new Error(`Marker pair for ${name} not found in explorer.html`);
  html = html.replace(re, (_, begin, end) => begin + body + end);
}
fs.writeFileSync(EXPLORER, html);
console.error('explorer.html: DATA and HUB_GEOM regenerated.');
