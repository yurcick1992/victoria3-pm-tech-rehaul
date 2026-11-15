// CHECK A RELEASE'S PUBLIC TEXTS (the `release` skill, step 4): release_notes/<version>/*.txt, each pasted whole into Steam or the forum.
//
//   node tools/check_release_notes.mjs release_notes/<version> [more files or folders]
//
// Per file: the dialect from the name (steam_* = Steam BBCode, lowercase; forum_* = the Paradox forum's XenForo BBCode), the size Steam
// counts (UTF-8 bytes + one byte per line break, the CRLF a browser submits; CHANGELOG_WORKSHOP's note in REPO_GUIDE), balanced paired
// tags, tags of the other dialect, and internal references a player must never see (§, F-numbers, landmine ids, backticks, Markdown).
// steam_changenote.txt over 8,000 is a FAIL (k_cchPublishedDocumentChangeDescriptionMax); another steam_* file over 8,000 is a FAIL too, as
// a precaution (Steam's discussion limit is unverified). Exit 1 on any FAIL.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const args = process.argv.slice(2);
if (!args.length) { console.error('usage: node tools/check_release_notes.mjs release_notes/<version> [...]'); process.exit(2); }
const files = args.flatMap(a => !existsSync(a) ? (console.error(`not found: ${a}`), process.exit(2)) :
  statSync(a).isDirectory() ? readdirSync(a).filter(f => f.endsWith('.txt')).map(f => join(a, f)) : [a]);
const LIMIT = 8000;
const PAIRED = { steam: ['h1', 'h2', 'h3', 'list', 'olist', 'b', 'i', 'u', 'url', 'quote', 'spoiler', 'code', 'table'],
                 forum: ['B', 'I', 'U', 'SIZE', 'LIST', 'SPOILER', 'URL', 'QUOTE', 'CODE', 'COLOR'] };
let failures = 0;
for (const f of files) {
  const name = basename(f);
  const dialect = name.startsWith('steam_') ? 'steam' : name.startsWith('forum_') ? 'forum' : null;
  const raw = readFileSync(f, 'utf8').replace(/^﻿/, '');
  const text = raw.replace(/\r\n/g, '\n');
  const breaks = (text.match(/\n/g) || []).length;
  const steamBytes = Buffer.byteLength(text, 'utf8') + breaks;
  const out = [], bad = [];
  if (!dialect) { bad.push('name starts with neither steam_ nor forum_: dialect unknown'); }
  else {
    // tags as written, case kept: Steam's are lowercase, the forum's uppercase in the precedents (XenForo itself ignores case)
    const tags = [...text.matchAll(/\[(\/?)([A-Za-z][A-Za-z0-9]*)(?:[= ][^\]]*)?\]/g)].map(m => ({ close: !!m[1], tag: m[2] }));
    const known = PAIRED[dialect], other = PAIRED[dialect === 'steam' ? 'forum' : 'steam'];
    for (const t of known) {
      const o = tags.filter(x => !x.close && x.tag === t).length, c = tags.filter(x => x.close && x.tag === t).length;
      if (o !== c) bad.push(`[${t}] opened ${o}, closed ${c}`);
    }
    const foreign = [...new Set(tags.filter(x => other.includes(x.tag) && !known.includes(x.tag)).map(x => x.tag))];
    if (foreign.length) bad.push(`tags of the other dialect: ${foreign.map(t => `[${t}]`).join(' ')}`);
    if (dialect === 'steam' && steamBytes > LIMIT) bad.push(`${steamBytes} bytes as Steam counts them, over ${LIMIT}`);
  }
  const internal = [[/§\s?\d/, '§ reference'], [/\bF\d{3}\b/, 'F-number'], [/\bL\d{2}\b/, 'landmine id'], [/`/, 'backtick'],
    [/\*\*/, 'Markdown bold'], [/^#{1,4} /m, 'Markdown heading'], [/^\s*[-*] /m, 'Markdown bullet'], [/\bsha256\b|\b[0-9a-f]{16}\b/, 'a hash']];
  for (const [re, what] of internal) { const m = text.match(re); if (m) bad.push(`${what}: "…${text.slice(Math.max(0, m.index - 30), m.index + 30).replace(/\n/g, ' ')}…"`); }
  if (/\bAI-generated\b/.test(text) === false) out.push('no AI-generated disclaimer (every precedent has one)');
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${name}  ${dialect ?? '?'}  ${Buffer.byteLength(text, 'utf8')} bytes, ${steamBytes} as Steam counts${dialect === 'steam' ? ` (limit ${LIMIT})` : ''}`);
  for (const b of bad) console.log(`       FAIL ${b}`);
  for (const w of out) console.log(`       warn ${w}`);
  failures += bad.length;
}
console.log(failures ? `${failures} failure(s)` : `all ${files.length} text(s) pass`);
process.exit(failures ? 1 : 0);
