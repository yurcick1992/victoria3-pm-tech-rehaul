// ai_country_goals.mjs — THE AI'S STANCE TOWARD EACH COUNTRY, OUT OF ONE SAVE (FINDINGS F244 §10, 2026-10-19).
// Every AI country keeps, per relevant country, goal scores (threat / protect / befriend / antagonize) with scored reasons, an
// attitude (belligerent, domineering, antagonistic, wary, cautious, cooperative, genial, protective, …) and a secret goal (none,
// befriend, antagonize, protect, conquer, dominate, reconcile, comply, defy) — the save's `country_goal` records. This lists them,
// owner → target, with the owner's and target's country types read from the matching summary.
// usage: node ai_country_goals.mjs <save.v3> <summary.json.gz> [--reason AI_REASON_WANTS_TREATY_PORTS] [--json out.json]
//   default: a census of attitudes and secret goals, then every pair carrying --reason (default the treaty-port reason)
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import fs from 'fs';
import zlib from 'zlib';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const reasonWanted = opt('--reason') ?? 'AI_REASON_WANTS_TREATY_PORTS'; const jsonOut = opt('--json');
const [save, sumFile] = args;
if (!save || !sumFile) { console.error('usage: node ai_country_goals.mjs <save.v3> <summary.json.gz> [--reason R] [--json out]'); process.exit(1); }
const sum = JSON.parse(zlib.gunzipSync(fs.readFileSync(sumFile)));
const byId = {}; for (const [k, c] of Object.entries(sum.countries)) byId[c.id] = { key: k, type: c.country_type };
const rak = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'vendor', 'rakaly', 'rakaly.exe');
const p = spawn(rak, ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', save], { stdio: ['ignore', 'pipe', 'inherit'] });
p.stdout.setEncoding('utf8');
const rl = createInterface({ input: p.stdout, crlfDelay: Infinity });
// country_goal={ <target id>={ country=<owner id> attitude=… secret_goal=… <goal>={ value=… reasons={ { reason="…" score=… } } } } }
const recs = []; let inCG = false, cgDepth = 0, depth = 0, cur = null, goal = null, reason = null;
for await (const raw of rl) {
  const t = raw.trim();
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  if (!inCG && t === 'country_goal={') { inCG = true; cgDepth = depth; depth += 1; continue; }
  if (inCG) {
    const rel = depth - cgDepth; let x;
    if (rel === 1 && (x = /^(\d+)=\{$/.exec(t))) { cur = { target: +x[1], goals: {} }; recs.push(cur); }
    else if (cur && rel === 2) {
      if ((x = /^country=(\d+)$/.exec(t))) cur.owner = +x[1];
      else if ((x = /^attitude=([a-z_]+)$/.exec(t))) cur.attitude = x[1];
      else if ((x = /^secret_goal=([a-z_]+)$/.exec(t))) cur.secret = x[1];
      else if ((x = /^([a-z_]+)=\{$/.exec(t))) { goal = x[1]; cur.goals[goal] = { value: 0, reasons: [] }; }
    } else if (cur && goal && rel === 3 && (x = /^value=([\-\d.]+)$/.exec(t))) cur.goals[goal].value = +x[1];
    else if (cur && goal && rel === 5) {
      if ((x = /^reason="([A-Z_]+)"$/.exec(t))) { reason = { r: x[1] }; cur.goals[goal].reasons.push(reason); }
      else if (reason && (x = /^score=([\-\d.]+)$/.exec(t))) reason.s = +x[1];
    }
    depth += opens - closes;
    if (depth - cgDepth <= 2) reason = null;
    if (depth - cgDepth <= 1) goal = null;
    if (depth <= cgDepth) { inCG = false; cur = null; }
    continue;
  }
  depth += opens - closes;
}
for (const r of recs) { r.o = byId[r.owner]?.key ?? r.owner; r.t = byId[r.target]?.key ?? r.target; r.ot = byId[r.owner]?.type; r.tt = byId[r.target]?.type; }
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(recs));
const tally = f => Object.entries(recs.reduce((a, r) => (a[f(r)] = (a[f(r)] || 0) + 1, a), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
console.log(`${sum.provenance.date}: ${recs.length} country_goal records`);
console.log('attitudes:', tally(r => r.attitude));
console.log('secret goals:', tally(r => r.secret));
const hits = recs.filter(r => Object.values(r.goals).some(g => g.reasons.some(x => x.r === reasonWanted)));
console.log(`\n${hits.length} pairs carrying ${reasonWanted} (owner > target (target type): attitude, secret goal, reason score):`);
for (const r of hits) { const s = Object.values(r.goals).flatMap(g => g.reasons).find(x => x.r === reasonWanted)?.s; console.log(`  ${r.o} > ${r.t} (${r.tt}): ${r.attitude}, ${r.secret}, ${Math.round(s)}`); }
