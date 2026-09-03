// A tiny static server for ui2/, so a browser can open the bundled balance sheet.
//
// Why it exists: the browser pane inlines a local file as a `data:` URL, and the bundled sheet is
// ~800 KB — past what that will take. Served over HTTP it is an ordinary page.
//
//   node tools/serve_ui2.mjs          # http://localhost:8791/  -> ui2/ladder_sheet.html
//   UI2_PORT=9000 node tools/...      # elsewhere
//
// Read-only by design: no API, no write path. `tools/ui.ps1` remains the one server that can write a
// config, and it serves the CANONICAL book — these are deliberately different ports and different
// books, so nothing can cross over.
//
// ⚠ /api/config and /api/start_exceptions are DELIBERATELY NOT SERVED. builder.html probes them at
// boot and, when they answer, its load banner says it read "config/mod_config.json (live)" — wording
// that is hardcoded there and would be a lie here. Letting them 404 puts the page on its EMBEDDED
// copy, which IS this book, and makes the banner say so. The two console 404s are the honest signal
// that this server cannot write a config.
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui2');
const PORT = +(process.env.UI2_PORT || 8791);
const INDEX = process.env.UI2_INDEX || 'ladder_sheet.html';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
};

createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/' || p === '') p = '/' + INDEX;
  // strip every leading separator and any `..`, then confirm the result is still inside ROOT
  const rel = normalize(p).replace(/^[\\/]+/, '').replace(/^(\.\.[\\/])+/, '');
  const file = join(ROOT, rel);
  // ⚠ statSync().isFile(), not existsSync(): existsSync is TRUE for a directory and readFileSync on a
  // directory throws EISDIR, which killed this server outright. ui2/gen is a directory, so that was
  // one stray request away.
  let st = null; try { st = statSync(file); } catch { }
  if (!file.startsWith(ROOT + sep) || !st || !st.isFile()) { res.writeHead(404).end('not found'); return; }
  const ext = file.slice(file.lastIndexOf('.'));
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(file));
}).listen(PORT, () => console.log(`ui2 on http://localhost:${PORT}/  ->  ${join(ROOT, INDEX)}`));
