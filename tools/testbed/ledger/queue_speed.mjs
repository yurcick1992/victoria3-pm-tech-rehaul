// Per-element construction speed in a save's queues: the per-project cap (base_construction_speed) and the
// speed actually granted (construction_speed), per country, per queue. Streams `rakaly melt -c`.
//   node tools/testbed/ledger/queue_speed.mjs <save.v3> <config.json> [TAG,TAG]
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import readline from 'node:readline';
const [save, cfgPath, tagArg] = process.argv.slice(2);
const REPO = 'C:/claude-code/victoria 3 PM and tech rehaul';
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const rung = {};
for (const ind of cfg.industries) { if (ind.disabled) continue; for (const t of ind.tiers) rung[t.key] = { ind: ind.id, era: t.era, cost: t.building_cost }; }
const TAGS = (tagArg || 'GBR,USA,FRA,GER,NGF,PRU,NET,BEL,UNL,RUS,JAP').split(',');
const rak = spawn(REPO + '/tools/vendor/rakaly/rakaly.exe', ['melt', '--format', 'vic3', '--unknown-key', 'stringify', '-c', save]);
const rl = readline.createInterface({ input: rak.stdout, crlfDelay: Infinity });
let depth = 0, inCM = false, cmDepth = 0, rec = null, q = null, el = null, date = null;
const out = [];
for await (const raw of rl) {
  const t = raw.trim();
  const opens = (t.match(/\{/g) || []).length, closes = (t.match(/\}/g) || []).length;
  if (depth === 0 && /^date=/.test(t) && !date) date = t.slice(5);
  if (depth === 0 && t === 'country_manager={') { inCM = true; cmDepth = 0; }
  if (inCM) {
    if (depth === 2 && /^\d+=\{$/.test(t)) rec = { tag: null, els: [] };
    if (rec) {
      if (depth === 3 && /^definition="/.test(t)) rec.tag = t.slice(12, -1);
      if (depth === 3 && (t === 'government_queue={' || t === 'private_queue={')) q = t.startsWith('gov') ? 'gov' : 'prv';
      if (q && depth === 5 && t === '{') el = { q };
      if (el) {
        let x;
        if ((x = /^type="([a-z_0-9]+)"$/.exec(t))) el.type = x[1];
        else if ((x = /^construction_left=([\d.]+)$/.exec(t))) el.left = +x[1];
        else if ((x = /^construction_speed=([\d.]+)$/.exec(t))) el.speed = +x[1];
        else if ((x = /^base_construction_speed=([\d.]+)$/.exec(t))) el.base = +x[1];
      }
    }
  }
  depth += opens - closes;
  if (el && depth <= 5 && t === '}') { rec.els.push(el); el = null; }
  if (q && depth <= 3) q = null;
  if (rec && depth <= 2 && closes) { if (rec.tag) out.push(rec); rec = null; }
  if (inCM && depth <= 0 && closes) inCM = false;
}
const med = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log(`# ${save.split(/[\\/]/).slice(-3, -2)[0]}  date ${date}`);
for (const tag of TAGS) {
  const r = out.find(o => o.tag === tag); if (!r) continue;
  for (const qq of ['gov', 'prv']) {
    const E = r.els.filter(e => e.q === qq); if (!E.length) continue;
    const working = E.filter(e => e.speed > 0);
    const cap = med(E.map(e => e.base).filter(Number.isFinite));
    const tier = E.filter(e => rung[e.type]);
    const byEra = [0, 1, 2, 3].map(era => {
      const T = tier.filter(e => rung[e.type].era === era); if (!T.length) return '';
      const cost = med(T.map(e => rung[e.type].cost)), b = med(T.map(e => e.base));
      return `e${era} n${T.length} cost ${cost} → ${(cost / b).toFixed(0)}wk at cap`;
    }).filter(Boolean).join(' | ');
    console.log(`${tag} ${qq}: items ${E.length}, progressing ${working.length} (${(100 * working.length / E.length).toFixed(0)}%), cap median ${cap?.toFixed(1)}, granted median (progressing) ${med(working.map(e => e.speed)).toFixed(1)}, left ${Math.round(E.reduce((a, e) => a + (e.left || 0), 0))}, speed Σ ${Math.round(E.reduce((a, e) => a + (e.speed || 0), 0))}  ${byEra}`);
  }
}
