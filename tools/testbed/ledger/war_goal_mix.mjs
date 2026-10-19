// WHAT ARE THE WARS ABOUT? Every war goal of the active diplomatic plays, out of saves (2026-10-18, FINDINGS F243).
// A save's `war_goal_manager.database` holds each goal of each ACTIVE play: its type, primary/secondary demand, and `initial_war_goal=yes`
// on the goal the play was started with (the rest were ADDED during the play). An enforced treaty article carries its article in
// `target.options.article` — a 1.13 treaty-port demand is `enforce_treaty_article` with article "treaty_port", NOT the `take_treaty_port`
// goal type (0 of 2,029 goals). Only ACTIVE plays are stored, so each save is a snapshot; pool many saves.
// usage: node tools/testbed/ledger/war_goal_mix.mjs --label vanilla <save.v3> [...] [--label mod <save.v3> [...]] [--jobs 4] [--json out]
import { spawn } from 'node:child_process'; import readline from 'node:readline'; import fs from 'node:fs';
const args = process.argv.slice(2); const groups = []; let jobs = 4, jsonOut = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--label') groups.push({ label: args[++i], saves: [] });
  else if (args[i] === '--jobs') jobs = +args[++i];
  else if (args[i] === '--json') jsonOut = args[++i];
  else { if (!groups.length) groups.push({ label: 'saves', saves: [] }); groups.at(-1).saves.push(args[i]); }
}
if (!groups.some(g => g.saves.length)) { console.error('usage: war_goal_mix.mjs --label <name> <save.v3> [...] [--label ...]'); process.exit(2); }
const readSave = save => new Promise(resolve => {
  const p = spawn('tools/vendor/rakaly/rakaly.exe', ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', save]);
  const rl = readline.createInterface({ input: p.stdout });
  let st = 0, date = '', cur = null; const c = {};
  const flush = () => { if (cur && cur.t) { const k = cur.t + (cur.art ? ':' + cur.art : '') + (cur.init ? '|initial' : '|added'); c[k] = (c[k] || 0) + 1; } cur = null; };
  rl.on('line', l => {
    if (!date) { const m = /^date=([\d.]+)/.exec(l); if (m) date = m[1]; }
    if (st === 0 && l === 'war_goal_manager={') st = 1;
    else if (st === 1 && /^[a-z_]+=\{/.test(l)) { flush(); st = 2; rl.close(); p.kill(); }
    else if (st === 1) {
      let m;
      if (/^\t\t\d+=\{$/.test(l)) { flush(); cur = {}; }
      else if (cur && (m = /^\t\t\ttype="([a-z_]+)"$/.exec(l))) cur.t = m[1];
      else if (cur && /^\t\t\tinitial_war_goal=yes$/.test(l)) cur.init = true;
      else if (cur && (m = /^\t\t\t\t\tarticle="([a-z_]+)"$/.exec(l))) cur.art = m[1];
    }
  });
  rl.on('close', () => { flush(); resolve({ save, date, c, ok: st === 2 }); });
});
const queue = groups.flatMap(g => g.saves.map(s => ({ g, s }))); const results = new Map(groups.map(g => [g, []]));
await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { while (queue.length) { const { g, s } = queue.shift(); results.get(g).push(await readSave(s)); } }));
const out = {};
for (const g of groups) {
  const rs = results.get(g); const bad = rs.filter(r => !r.ok).length; const by = {};
  for (const r of rs) for (const [k, v] of Object.entries(r.c)) { const [t, s] = k.split('|'); (by[t] ??= { initial: 0, added: 0 })[s] += v; }
  const tot = Object.values(by).reduce((a, b) => a + b.initial + b.added, 0), add = Object.values(by).reduce((a, b) => a + b.added, 0);
  console.log(`== ${g.label}: ${rs.length} saves${bad ? ` (${bad} without a war_goal_manager)` : ''}, ${tot} war goals, ${add} added during a play`);
  for (const [t, b] of Object.entries(by).sort((x, y) => (y[1].initial + y[1].added) - (x[1].initial + x[1].added)))
    console.log(`   ${t.padEnd(44)} initial ${String(b.initial).padStart(4)}   added ${String(b.added).padStart(4)}   ${(100 * (b.initial + b.added) / tot).toFixed(1).padStart(5)}%`);
  out[g.label] = { saves: rs.map(r => ({ save: r.save, date: r.date, c: r.c })), totals: by };
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
