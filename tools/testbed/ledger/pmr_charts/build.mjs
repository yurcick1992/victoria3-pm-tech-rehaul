// build.mjs <work dir>: template.html (beside this script) + <work dir>/data.json
//   -> <work dir>/pmr_vanilla_nfu_charts.html (the published file) and <work dir>/preview.html (a local look).
// The work dir is a scratch folder outside the repository: nothing this script writes is committed.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const dir = process.argv[2];
if (!dir) throw new Error('usage: node build.mjs <work dir holding data.json>');
const tpl = readFileSync(join(import.meta.dirname, 'template.html'), 'utf8');
const data = readFileSync(join(dir, 'data.json'), 'utf8').replace(/</g, '\\u003c');
if (tpl.split('/*DATA*/').length !== 2) throw new Error('template must hold exactly one /*DATA*/');
const page = tpl.replace('/*DATA*/', () => data);
writeFileSync(join(dir, 'pmr_vanilla_nfu_charts.html'), page);
writeFileSync(join(dir, 'preview.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;font:14px system-ui}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>');
console.log('built', (page.length / 1e6).toFixed(2), 'MB');
