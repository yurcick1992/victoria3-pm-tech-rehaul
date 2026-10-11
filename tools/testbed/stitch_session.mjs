// STITCH CONTINUATION RUNS INTO WHOLE CAMPAIGNS (2026-10-11) — a session whose runs CONTINUE another session's runs from a kept save
// (run_schedule `continue_save`, each run folder's continuation.json names its parent) is joined with its parents into a NEW session folder
// that reads like an ordinary batch: one run folder per 1836 → <until> campaign, so the standard ledger (fill_ledger.sh), the register
// (criteria.mjs) and every reader run on it unchanged. Everything is COPIED; the two source sessions are not touched (sessions are never
// modified). Per run:
//   · save_summaries: the parent's summaries dated BEFORE the continuation's first one, then the continuation's, renumbered on (0001…);
//   · logs_live/debug.log: each half from its own telemetry token's first line on, the continuation's token REWRITTEN to the parent's so a
//     token-filtered reader sees one run (je_tally, tech_census, lib_grants, the dated TECH lines); error.log / dedicated_server.log: the
//     parent's whole mirror, then the continuation's from its own start time; run.log concatenated (the reload reads as a resume attempt);
//   · markets.tsv / events.tsv concatenated (one header); telemetry.json with both halves' dump dates;
//   · meta.json: started = the parent's, ended / reached / until / wall_seconds = the continuation's (its wall_seconds already carries the
//     parent's play via -PriorWallSeconds), token = the parent's, attempts summed, `stitched` = { parent, child, child_token };
//   · build_state.json and save_provenance.json: the continuation's (the same book; the token in save_provenance set to the parent's);
//   · saves/: the continuation's kept endpoint only.
// Session level: schedule.json (the continuation's, label and runs rewritten), session.json, markets_all.tsv, machine_load.tsv (both halves),
// STITCHED.md. usage: node tools/testbed/stitch_session.mjs <continuation session> <new session name | absolute test path> [--partial]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import readline from 'node:readline';
const SESS = 'C:/claude-code/victoria 3 PM and tech rehaul/tools/testbed/sessions';
const ARGS = process.argv.slice(2); const PARTIAL = ARGS.includes('--partial'); const [CHILD, NEWNAME] = ARGS.filter(a => a !== '--partial');
if (!CHILD || !NEWNAME) { console.error('usage: stitch_session.mjs <continuation session> <new session name | absolute path for a test> [--partial]'); process.exit(1); }
const CH = path.join(SESS, CHILD), OUT = path.isAbsolute(NEWNAME) ? NEWNAME : path.join(SESS, NEWNAME);   // an absolute path = a test outside the sessions folder
if (fs.existsSync(OUT)) { console.error('exists: ' + OUT); process.exit(1); }
const J = f => JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, ''));
const headDate = f => { const fd = fs.openSync(f, 'r'); const b = Buffer.alloc(4096); const n = fs.readSync(fd, b, 0, 4096, 0); fs.closeSync(fd);
  return /"date":"([0-9.]+)"/.exec(zlib.gunzipSync(b.subarray(0, n), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8'))?.[1]; };
const dnum = d => { const [y, m, dd] = d.split('.').map(Number); return y * 10000 + m * 100 + dd; };
const secOfDay = s => { const m = /^\[(\d\d):(\d\d):(\d\d)\]/.exec(s); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null; };
async function copyLines(src, out, { fromToken = null, fromSec = null, rewrite = null } = {}) {
  if (!fs.existsSync(src)) return 0;
  const rl = readline.createInterface({ input: fs.createReadStream(src), crlfDelay: Infinity }); let on = !fromToken && fromSec == null, n = 0;
  for await (let l of rl) {
    if (!on) { if (fromToken && l.includes(fromToken)) on = true; else if (fromSec != null) { const s = secOfDay(l); if (s != null && s >= fromSec) on = true; } if (!on) continue; }
    if (rewrite) l = l.split(rewrite[0]).join(rewrite[1]);
    out.write(l + '\n'); n++;
  }
  return n;
}
const ws = f => fs.createWriteStream(f);
const end = s => new Promise(r => s.end(r));
// --partial: skip continuation runs not yet complete (a test while the batch still plays)
const runs = fs.readdirSync(CH).filter(d => /^run\d+_/.test(d)).sort().filter(d => { if (!PARTIAL) return true;
  try { const m = J(path.join(CH, d, 'meta.json')); return m.reached_ingame_date === m.until_date; } catch { return false; } });
fs.mkdirSync(OUT, { recursive: true });
const notes = [], index = [];
for (const rd of runs) {
  const C = path.join(CH, rd), cont = J(path.join(C, 'continuation.json')); const P = path.join(SESS, cont.parent); const O = path.join(OUT, rd);
  const pm = J(path.join(P, 'meta.json')), cm = J(path.join(C, 'meta.json'));
  if (cm.abandoned_reason || cm.reached_ingame_date !== cm.until_date) throw new Error(`${rd}: the continuation did not complete (${cm.reached_ingame_date} of ${cm.until_date})`);
  fs.mkdirSync(path.join(O, 'save_summaries'), { recursive: true }); fs.mkdirSync(path.join(O, 'logs_live'), { recursive: true }); fs.mkdirSync(path.join(O, 'saves'), { recursive: true });
  // summaries
  const list = dir => fs.readdirSync(dir).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort().map(f => ({ f: path.join(dir, f), d: headDate(path.join(dir, f)) })).filter(x => x.d);
  const cs = list(path.join(C, 'save_summaries')); const first = Math.min(...cs.map(x => dnum(x.d)));
  const ps = list(path.join(P, 'save_summaries')).filter(x => dnum(x.d) < first);
  let k = 0; for (const x of [...ps, ...cs]) { k++; fs.copyFileSync(x.f, path.join(O, 'save_summaries', String(k).padStart(4, '0') + '_' + path.basename(x.f).replace(/^\d+_/, ''))); }
  // logs
  const dbg = ws(path.join(O, 'logs_live/debug.log'));
  const nP = await copyLines(path.join(P, 'logs_live/debug.log'), dbg, { fromToken: pm.token });
  const nC = await copyLines(path.join(C, 'logs_live/debug.log'), dbg, { fromToken: cm.token, rewrite: [cm.token, pm.token] }); await end(dbg);
  const cStart = secOfDay('[' + cm.started.slice(11, 19) + ']');
  for (const lf of ['error.log', 'dedicated_server.log', 'custom_automated_stats.log']) {
    if (!fs.existsSync(path.join(P, 'logs_live', lf)) && !fs.existsSync(path.join(C, 'logs_live', lf))) continue;
    const o = ws(path.join(O, 'logs_live', lf)); await copyLines(path.join(P, 'logs_live', lf), o); await copyLines(path.join(C, 'logs_live', lf), o, { fromSec: cStart }); await end(o);
  }
  { const o = ws(path.join(O, 'run.log')); await copyLines(path.join(P, 'run.log'), o); await copyLines(path.join(C, 'run.log'), o); await end(o); }
  for (const t of ['markets.tsv', 'events.tsv']) {
    const a = fs.existsSync(path.join(P, t)) ? fs.readFileSync(path.join(P, t), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/) : [];
    const b = fs.existsSync(path.join(C, t)) ? fs.readFileSync(path.join(C, t), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/) : [];
    fs.writeFileSync(path.join(O, t), [...(a.length ? a : b.slice(0, 1)), ...b.slice(1)].join('\n') + '\n');
  }
  const pt = J(path.join(P, 'telemetry.json')), ct = J(path.join(C, 'telemetry.json'));
  fs.writeFileSync(path.join(O, 'telemetry.json'), JSON.stringify({ ...ct, dump_dates: [...(pt.dump_dates || []), ...(ct.dump_dates || [])], _stitched: 'both halves\' dump dates' }, null, 2));
  const meta = { ...cm, run: pm.run, token: pm.token, started: pm.started, dump_dates: [...(pm.dump_dates || []), ...(cm.dump_dates || [])],
    attempts: (pm.attempts || 1) + (cm.attempts || 1), resumes: (pm.resumes || 0) + (cm.resumes || 0),
    stitched: { parent: cont.parent, child: `${CHILD}/${rd}`, child_token: cm.token, parent_wall_seconds: pm.wall_seconds, child_wall_seconds_this_launch: cm.wall_seconds_this_launch } };
  fs.writeFileSync(path.join(O, 'meta.json'), JSON.stringify(meta, null, 2));
  fs.copyFileSync(path.join(C, 'build_state.json'), path.join(O, 'build_state.json'));
  if (fs.existsSync(path.join(C, 'save_provenance.json'))) { const sp = J(path.join(C, 'save_provenance.json')); sp.token = pm.token; sp.session = NEWNAME.slice(0, 15); sp.until = cm.until_date; fs.writeFileSync(path.join(O, 'save_provenance.json'), JSON.stringify(sp, null, 2)); }
  for (const s of fs.readdirSync(path.join(C, 'saves')).filter(f => f.endsWith('.v3'))) fs.copyFileSync(path.join(C, 'saves', s), path.join(O, 'saves', s));
  notes.push(`- ${rd}: ${cont.parent} (1836 → ${ps.at(-1)?.d}, ${ps.length} summaries, token ${pm.token}) + ${CHILD}/${rd} (${cs[0].d} → ${cs.at(-1).d}, ${cs.length} summaries, token ${cm.token} rewritten); debug.log ${nP} + ${nC} lines; wall ${meta.wall_seconds} s`);
  index.push({ index: +rd.slice(3, 6), setup: rd.replace(/^run\d+_/, ''), until: cm.until_date, status: 'ok', stitched: meta.stitched });
}
// session level
const sch = J(path.join(CH, 'schedule.json')); sch.label = path.basename(NEWNAME).replace(/^\d{8}_\d{6}_/, '');
sch._stitched = `STITCHED by tools/testbed/stitch_session.mjs from ${CHILD} and its parents — see STITCHED.md`;
sch.runs = sch.runs.map(r => { const { continue_save, continue_expect_after, prior_wall_seconds, ...rest } = r; return rest; });
fs.writeFileSync(path.join(OUT, 'schedule.json'), JSON.stringify(sch, null, 2));
fs.writeFileSync(path.join(OUT, 'session.json'), JSON.stringify({ label: sch.label, stamp: NEWNAME.slice(0, 15), stitched_from: CHILD, runs_planned: index.length, runs_executed: index.length, aborted: false, runs: index }, null, 2));
{ const rows = []; let hdr = null;
  for (const rd of runs) { const t = fs.readFileSync(path.join(OUT, rd, 'markets.tsv'), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/); hdr ??= 'run_index\tsetup\t' + t[0].split('\t').slice(1).join('\t');
    for (const l of t.slice(1)) rows.push(`${+rd.slice(3, 6)}\t${rd.replace(/^run\d+_/, '')}\t${l.split('\t').slice(1).join('\t')}`); }
  fs.writeFileSync(path.join(OUT, 'markets_all.tsv'), [hdr, ...rows].join('\n') + '\n'); }
{ const parents = [...new Set(runs.map(rd => J(path.join(CH, rd, 'continuation.json')).parent.split('/')[0]))];
  const parts = [...parents.map(p => path.join(SESS, p, 'machine_load.tsv')), path.join(CH, 'machine_load.tsv')].filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8').replace(/\r?\n$/, '').split(/\r?\n/));
  if (parts.length) fs.writeFileSync(path.join(OUT, 'machine_load.tsv'), [parts[0][0], ...parts.flatMap(p => p.slice(1))].join('\n') + '\n'); }
fs.writeFileSync(path.join(OUT, 'STITCHED.md'), `# STITCHED SESSION — not a batch of its own\n\nBuilt ${new Date().toISOString().slice(0, 16)} UTC by \`tools/testbed/stitch_session.mjs ${CHILD} ${NEWNAME}\`.\nEach run folder is one whole campaign: its parent run (1836 → the save) plus the continuation that played on from that save.\nEverything is a COPY; the source sessions are untouched. The continuation's telemetry token is REWRITTEN to the parent's in\nlogs_live/debug.log and save_provenance.json, so token-filtered readers see one run. run.log carries both halves (the reload reads as a\nresume attempt); meta.json's wall_seconds is the continuation's, which carries the parent's play (-PriorWallSeconds) plus one reload.\n\n${notes.join('\n')}\n`);
console.log(`stitched ${runs.length} run(s) into ${OUT}\n${notes.join('\n')}`);
