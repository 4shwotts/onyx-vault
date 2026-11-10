// Turns a Vitest/Istanbul coverage-summary.json into a shields.io
// "endpoint" badge file:
//   node coverage-badge.mjs <coverage-summary.json> <badge.json> [label]
// Uses line coverage. Colours: 90%+ bright green, 80%+ green,
// 70%+ yellow-green, 60%+ yellow, below that red.
import fs from 'node:fs';

const [summaryPath, outPath, label = 'server coverage'] = process.argv.slice(2);
if (!summaryPath || !outPath) {
  console.error('Usage: node coverage-badge.mjs <coverage-summary.json> <badge.json> [label]');
  process.exit(1);
}

const pct = JSON.parse(fs.readFileSync(summaryPath, 'utf8')).total.lines.pct;
if (typeof pct !== 'number' || Number.isNaN(pct)) {
  console.error(`No line coverage figure in ${summaryPath}`);
  process.exit(1);
}

const color = pct >= 90 ? 'brightgreen' : pct >= 80 ? 'green' : pct >= 70 ? 'yellowgreen' : pct >= 60 ? 'yellow' : 'red';
const badge = { schemaVersion: 1, label, message: `${pct.toFixed(1)}%`, color };

fs.writeFileSync(outPath, `${JSON.stringify(badge, null, 2)}\n`);
console.log(`Badge: ${label} ${badge.message} (${color})`);
