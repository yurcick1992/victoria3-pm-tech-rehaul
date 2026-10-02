// THE YEARLY SUMMARY INDEX OF A RUN — date → save-summary file, read from the first bytes of each gz (the provenance sits near the top), so a
// reader can take "the first summary of year Y" without inflating every file. Shared by the small ledger readers promoted from the session
// scratchpad on 2026-10-02 (ustar_path, craft_path, us_construction_windows, pp_goods, rung_fate). No cache: indexing a 400-summary run costs a
// few hundred ms. The harvester's temp files (`.partial.`) are excluded (landmine L25).
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const SESSIONS = path.join(ROOT, 'tools/testbed/sessions');
export function indexRun(runDir) {
  const sd = path.join(runDir, 'save_summaries'); if (!fs.existsSync(sd)) return {};
  const idx = {};
  for (const f of fs.readdirSync(sd).filter(f => f.endsWith('.json.gz') && !f.includes('.partial.')).sort()) {
    const fd = fs.openSync(path.join(sd, f), 'r'); const buf = Buffer.alloc(4096); const n = fs.readSync(fd, buf, 0, 4096, 0); fs.closeSync(fd);
    let txt = ''; try { txt = zlib.gunzipSync(buf.subarray(0, n), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8'); } catch { continue; }
    const m = /"date":"([0-9.]+)"/.exec(txt); if (m && !idx[m[1]]) idx[m[1]] = path.join(sd, f);
  }
  return idx;
}
export const readSum = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
// every run folder of a session (optionally one setup), sorted; a session NAME resolves under tools/testbed/sessions
export function runsOf(sessDir, setup) {
  const d = fs.existsSync(sessDir) ? sessDir : path.join(SESSIONS, sessDir);
  return fs.readdirSync(d).filter(x => /^run\d+/.test(x) && (!setup || x.endsWith('_' + setup))).sort().map(x => path.join(d, x));
}
const toDay = d => { const [y, m, dd] = d.split('.').map(Number); return y * 365 + (m - 1) * 30.4 + dd; };
// the first summary date of year y in an index (null if none)
export const firstOf = (idx, y) => Object.keys(idx).filter(d => d.startsWith(y + '.')).sort((p, q) => toDay(p) - toDay(q))[0];
export const med = v => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
