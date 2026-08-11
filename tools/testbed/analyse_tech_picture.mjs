// RENAME-PROOF reading of the tech-tree batch.
// ⚠ TESTBED_METRICS §35 warns that a hardcoded country TAG is a time bomb on a long campaign; keying on
// the DISPLAY NAME is the same bomb with a nicer face. Prussia becomes Germany, a revolution renames
// France, and a per-country column simply stops. So: aggregate over ALL countries, and report the
// leading edge and the world total, neither of which cares what anyone is called.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dirs = process.argv.slice(2);
const ERA_OF = {};                                   // technology display name -> era, from our own data
{
  const d = JSON.parse(readFileSync('C:/claude-code/victoria 3 PM and tech rehaul/config/tech_tree_options.json', 'utf8'));
  for (const t of d.options.find(o => o.ships).techs) ERA_OF[t.name] = t.era;
}
const TOTAL_TECHS = Object.keys(ERA_OF).length;

for (const dir of dirs) {
  for (const rp of readdirSync(dir).map(e => join(dir, e)).filter(p => statSync(p).isDirectory() && existsSync(join(p, 'run.log')))) {
    const tok = (readFileSync(join(rp, 'run.log'), 'utf8').match(/token ([A-Za-z0-9_]+)\)/) ?? [])[1];
    if (!tok || !existsSync(join(rp, 'logs_live', 'debug.log'))) continue;
    const fin = readFileSync(join(rp, 'run.log'), 'utf8').match(/run \d+ finished[^\n]*in-game ([\d.]+)/);
    if (!fin || fin[1] === '1841.1.1') continue;                       // the stopped run

    const perCountry = {}, firstSeen = {}, gdpAt = {}, worldAt = {};
    for (const l of readFileSync(join(rp, 'logs_live', 'debug.log'), 'utf8').split('\n')) {
      const i = l.indexOf('V3TB|'); if (i < 0) continue;
      const f = l.slice(i).split('|').map(x => x.trim()); if (f[1] !== tok) continue;   // ⚠ trim: debug.log lines carry a trailing CR, and an untrimmed name matches nothing
      if (f[2] === 'TECH') {
        const yr = +((f[4] ?? '').match(/(\d{4})\s*$/)?.[1] ?? 0); if (!yr) continue;
        (perCountry[f[3]] ??= new Set()).add(f[5]);
        if (!(f[5] in firstSeen) || yr < firstSeen[f[5]]) firstSeen[f[5]] = yr;
      } else if (f[2] === 'GDP') { (gdpAt[f[3]] ??= {})[f[4]] = +f[5]; }   // GDP|date|country|value
      else if (f[2] === 'WORLD') worldAt[f[3]] = +f[4];
    }
    console.log(`\n===== ${rp.split(/[\\/]/).pop()} =====`);

    // 1. THE LEADING EDGE: distinct technologies anyone in the world has reached, by decade.
    //    This is what "how far up a 217-technology tree do countries actually get" means.
    console.log('\n  decade   distinct techs reached world-wide      by era of the technology');
    for (const dec of [1840, 1850, 1860, 1870, 1880, 1890, 1900, 1910, 1920, 1930, 1936]) {
      const reached = Object.entries(firstSeen).filter(([, y]) => y <= dec).map(([n]) => n);
      const known = reached.filter(n => n in ERA_OF);
      const byEra = [1, 2, 3, 4, 5].map(e => known.filter(n => ERA_OF[n] === e).length);
      const tot = [1, 2, 3, 4, 5].map(e => Object.values(ERA_OF).filter(x => x === e).length);
      console.log(`  by ${dec}   ${String(known.length).padStart(3)} / ${TOTAL_TECHS}  ${(100 * known.length / TOTAL_TECHS).toFixed(0).padStart(3)}%      ` +
        byEra.map((n, i) => `e${i + 1} ${String(n).padStart(2)}/${tot[i]}`).join('  '));
    }
    // 2. the single most advanced country, whatever it ends up being called
    const best = Object.entries(perCountry).sort((a, b) => b[1].size - a[1].size).slice(0, 5);
    console.log(`\n  most technologies held by one country: ` +
      best.map(([c, s]) => `${c} ${s.size}`).join(' · '));

    // 3. GDP: world total, plus the top five at the last dump — no fixed names anywhere
    const dumps = Object.keys(worldAt).sort();
    console.log(`\n  world GDP  ` + dumps.map(d => d.split('.')[0]).join('     '));
    console.log(`             ` + dumps.map(d => (worldAt[d] / 1e6).toFixed(0) + 'M').join('   '));
    const last = dumps.at(-1);
    const top = Object.entries(gdpAt[last] ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`  top economies at ${last}: ` + top.map(([c, v]) => `${c} ${(v / 1e6).toFixed(0)}M`).join(' · '));
  }
}
