// THE TECHNOLOGY TREE AS THE RESEARCH MODEL SEES IT (BALANCE_FRAMEWORK §10.96) — read from the files a game actually loads:
// vanilla's `common/technology/technologies/*.txt`, or an emitted mod's copies of them layered over vanilla (a mod file of the same name
// replaces vanilla's; `zzz_pm_rehaul_techs.txt` adds). Per technology: tree (category), game era, prerequisites, the base `ai_weight` value
// (the `value =` line only — the conditional `if` blocks depend on AI strategies the model does not have), and `can_research = no`.
// Era costs from `common/technology/eras/*.txt`. Nothing is copied by hand, so a patch or a re-built mod flows through.
import fs from 'node:fs'; import path from 'node:path';
export const GAME = 'C:/Program Files (x86)/Steam/steamapps/common/Victoria 3/game';
const strip = s => s.replace(/^\uFEFF/, '');

function parseTechFile(txt, out) {
  const lines = strip(txt).split(/\r?\n/);
  let depth = 0, cur = null, inPre = false, inAi = false, aiDepth = 0;
  for (const raw of lines) {
    const line = raw.replace(/#.*/, '');
    const t = line.trim();
    if (depth === 0) {
      const m = /^([A-Za-z0-9_\-]+)\s*=\s*\{/.exec(t);
      if (m) cur = out[m[1]] = { id: m[1], era: null, category: null, prereqs: [], ai: 1, researchable: true };
    } else if (cur) {
      let x;
      if (depth === 1 && (x = /^era\s*=\s*era_(\d)/.exec(t))) cur.era = +x[1];
      else if (depth === 1 && (x = /^category\s*=\s*([a-z_]+)/.exec(t))) cur.category = x[1];
      else if (depth === 1 && /^can_research\s*=\s*no/.test(t)) cur.researchable = false;
      else if (depth === 1 && /^unlocking_technologies\s*=\s*\{/.test(t)) { inPre = true; }
      else if (depth === 1 && /^ai_weight\s*=\s*\{/.test(t)) { inAi = true; aiDepth = depth + 1; }
      if (inPre) for (const q of t.replace(/^unlocking_technologies\s*=\s*\{/, '').matchAll(/([A-Za-z0-9_\-]+)/g)) cur.prereqs.push(q[1]);
      if (inAi && depth + (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length >= aiDepth - 1) {
        if ((x = /^value\s*=\s*([\d.]+)/.exec(t)) && depth === aiDepth) cur.ai = +x[1];
      }
    }
    const o = (t.match(/\{/g) || []).length, c = (t.match(/\}/g) || []).length;
    depth += o - c;
    if (inPre && t.includes('}')) inPre = false;
    if (inAi && depth < aiDepth) inAi = false;
    if (depth === 0) cur = null;
  }
}

// mod: path to an emitted mod root (or null for vanilla)
export function loadTree(mod = null) {
  const files = new Map();
  const vdir = path.join(GAME, 'common/technology/technologies');
  for (const f of fs.readdirSync(vdir)) if (f.endsWith('.txt')) files.set(f, path.join(vdir, f));
  if (mod) { const mdir = path.join(mod, 'common/technology/technologies'); if (fs.existsSync(mdir)) for (const f of fs.readdirSync(mdir)) if (f.endsWith('.txt')) files.set(f, path.join(mdir, f)); }
  const techs = {};
  for (const [, p] of [...files].sort()) parseTechFile(fs.readFileSync(p, 'utf8'), techs);
  const eraCost = {};
  const edir = path.join(mod && fs.existsSync(path.join(mod, 'common/technology/eras')) ? mod : GAME, 'common/technology/eras');
  for (const f of fs.readdirSync(edir)) {
    for (const m of strip(fs.readFileSync(path.join(edir, f), 'utf8')).matchAll(/era_(\d)\s*=\s*\{[^}]*?technology_cost\s*=\s*(\d+)/g)) eraCost[+m[1]] = +m[2];
  }
  for (const t of Object.values(techs)) {
    if (!t.era || !t.category) throw new Error(`tech ${t.id}: era ${t.era} category ${t.category}`);
    for (const p of t.prereqs) if (!techs[p]) throw new Error(`tech ${t.id}: unknown prerequisite ${p}`);
  }
  if (Object.keys(eraCost).length !== 5) throw new Error('era costs: ' + JSON.stringify(eraCost));
  return { techs, eraCost, cats: ['production', 'military', 'society'] };
}

// the engine's cost (TECH_AHEAD_OF_TIME_PENALTY_FACTOR, 00_defines.txt): era cost × (1 + f × Σ over unheld earlier-era techs of the same tree of
// the era gap). ⚠ The define's wording ("this multiple of the cost") is read as the TARGET's era cost — the wiki's Dynamite example (era 3, two
// unheld era-2 techs, +6,250 = 2 × 0.25 × 12,500) agrees. `held` is a Set.
export function techCost(tree, id, held, f = 0.25) {
  const t = tree.techs[id]; let gap = 0;
  for (const u of Object.values(tree.techs)) if (u.researchable && u.category === t.category && u.era < t.era && !held.has(u.id)) gap += t.era - u.era;   // F160: unresearchable techs (sericulture) are skipped
  return tree.eraCost[t.era] * (1 + f * gap);
}
export const canResearch = (tree, id, held) => { const t = tree.techs[id]; return t.researchable && !held.has(id) && t.prereqs.every(p => held.has(p)); };
