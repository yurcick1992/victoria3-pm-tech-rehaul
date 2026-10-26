// MAKE A TECHNOLOGY ICON from an image-model picture painted on flat green (POLISH_1_0.md R5).
//
//   node tools/make_tech_icon.mjs --src <picture.png> --out art/invention_icons/<technology>.png [--region x,y,w,h] [--size 215]
//
// Writes a 256 x 256 RGBA PNG in the form of vanilla's invention icons; emit_techs.mjs turns it into the DDS the game reads.
//   1. the green panel: the bounding box of pure-green pixels inside --region (default: the whole picture), inset 4 px, so a sheet
//      of several labelled panels can be cut one panel at a time;
//   2. the key: alpha from how far a pixel is greener than its other channels, against the panel's own measured green; the colour
//      of a part-transparent pixel is unmixed from that green, and any green left over is clamped away (G <= max(R, B));
//   3. the object trimmed to its pixels and scaled so its longer side is --size px (vanilla's longer side is 209-246 px, most near
//      215), centred on the 256 canvas;
//   4. vanilla's soft black outer glow. MEASURED from four vanilla icons (nitrogen_fixation, pneumatic_tools, improved_fertilizer,
//      lathe): the black's alpha at 2..8 px outside the silhouette is 145 103 68 41 22 10 4 (0-255), the same on all four. That is
//      a full-black edge at 1.9 px out, softened as a Gaussian with sigma 2.4 px, which is what this draws.
// ⚠ JPEG pictures go through a PNG first (PowerShell: [System.Drawing.Image]::FromFile(jpg).Save(png, 'Png')); this tool reads PNG only.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readPNG, writePNG, resample } from './lib_image.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1]]]) : a), []));
if (!args.src || !args.out) { console.error('usage: node tools/make_tech_icon.mjs --src <picture.png> --out <icon.png> [--region x,y,w,h] [--size 215]'); process.exit(2); }
const SIZE = Number(args.size || 215), CANVAS = 256;
const pic = readPNG(readFileSync(args.src));
const [rx, ry, rw, rh] = args.region ? args.region.split(',').map(Number) : [0, 0, pic.w, pic.h];
const at = (x, y) => (y * pic.w + x) * 4;
const isGreen = o => pic.px[o + 1] > 170 && pic.px[o] < 110 && pic.px[o + 2] < 110 && pic.px[o + 1] - Math.max(pic.px[o], pic.px[o + 2]) > 100;

// 1. the panel
let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1, n = 0; const bgSum = [0, 0, 0];
for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) {
  const o = at(x, y); if (!isGreen(o)) continue;
  x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  bgSum[0] += pic.px[o]; bgSum[1] += pic.px[o + 1]; bgSum[2] += pic.px[o + 2]; n++;
}
if (!n) throw new Error(`no flat-green pixels in region ${rx},${ry},${rw},${rh} of ${args.src}`);
x0 += 4; y0 += 4; x1 -= 4; y1 -= 4;
const bg = bgSum.map(v => v / n), bgGreen = bg[1] - Math.max(bg[0], bg[2]);
const PW = x1 - x0 + 1, PH = y1 - y0 + 1;

// 2. the key
const LO = 18;                                   // greenness below this is the object's own (JPEG noise, olive tones)
const HI = bgGreen - 24;                         // and above this, the background's own (JPEG noise in the flat green)
const cut = { w: PW, h: PH, px: Buffer.alloc(PW * PH * 4) };
let edgeHits = 0;
for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
  const o = at(x0 + x, y0 + y), d = (y * PW + x) * 4;
  const r = pic.px[o], g = pic.px[o + 1], b = pic.px[o + 2], greenness = g - Math.max(r, b);
  const t = Math.min(1, Math.max(0, (greenness - LO) / (HI - LO)));         // share of the background in this pixel
  let a = 1 - t; if (a < 0.04) a = 0;
  if (a > 0 && (x === 0 || y === 0 || x === PW - 1 || y === PH - 1)) edgeHits++;
  let c = [r, g, b];
  if (a > 0 && a < 1) c = c.map((v, i) => (v - t * bg[i]) / a);              // unmix the green
  c[1] = Math.min(c[1], (c[0] + c[2]) / 2 + 6);                             // despill (average form: olive fringes turn brown, not yellow)
  cut.px[d] = Math.max(0, Math.min(255, Math.round(c[0]))); cut.px[d + 1] = Math.max(0, Math.min(255, Math.round(c[1])));
  cut.px[d + 2] = Math.max(0, Math.min(255, Math.round(c[2]))); cut.px[d + 3] = Math.round(a * 255);
}

// 2b. specks: a small blob touching the panel's edge is the panel's own rounded corner or shadow, not the object. Dropped, and said so.
{
  const lab = new Int32Array(PW * PH).fill(-1); let dropped = 0, blobs = 0;
  for (let s = 0; s < PW * PH; s++) {
    if (lab[s] !== -1 || cut.px[s * 4 + 3] === 0) continue;
    const stack = [s], members = []; let touches = false; lab[s] = s;
    while (stack.length) {
      const i = stack.pop(), x = i % PW, y = (i / PW) | 0; members.push(i);
      if (x === 0 || y === 0 || x === PW - 1 || y === PH - 1) touches = true;
      for (const j of [x > 0 ? i - 1 : -1, x < PW - 1 ? i + 1 : -1, y > 0 ? i - PW : -1, y < PH - 1 ? i + PW : -1])
        if (j >= 0 && lab[j] === -1 && cut.px[j * 4 + 3] > 0) { lab[j] = s; stack.push(j); }
    }
    if (touches && members.length < 0.003 * PW * PH) { for (const i of members) cut.px[i * 4 + 3] = 0; dropped += members.length; blobs++; }
  }
  if (blobs) console.log(`  dropped ${blobs} edge speck(s), ${dropped} px`);
}
edgeHits = 0;
for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if ((x === 0 || y === 0 || x === PW - 1 || y === PH - 1) && cut.px[(y * PW + x) * 4 + 3] > 0) edgeHits++;

// 3. trim and scale
let bx0 = Infinity, by0 = Infinity, bx1 = -1, by1 = -1;
for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) if (cut.px[(y * PW + x) * 4 + 3] > 8) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
const TW = bx1 - bx0 + 1, TH = by1 - by0 + 1, trimmed = { w: TW, h: TH, px: Buffer.alloc(TW * TH * 4) };
for (let y = 0; y < TH; y++) cut.px.copy(trimmed.px, y * TW * 4, ((by0 + y) * PW + bx0) * 4, ((by0 + y) * PW + bx1 + 1) * 4);
const k = SIZE / Math.max(TW, TH), SW = Math.max(1, Math.round(TW * k)), SH = Math.max(1, Math.round(TH * k));
const obj = resample(trimmed, SW, SH);
const ox = Math.round((CANVAS - SW) / 2), oy = Math.round((CANVAS - SH) / 2);
const alpha = new Float64Array(CANVAS * CANVAS), rgb = new Float64Array(CANVAS * CANVAS * 3);
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
  const s = (y * SW + x) * 4, d = (oy + y) * CANVAS + ox + x;
  alpha[d] = obj.px[s + 3] / 255; rgb[d * 3] = obj.px[s]; rgb[d * 3 + 1] = obj.px[s + 1]; rgb[d * 3 + 2] = obj.px[s + 2];
}

// 4. the glow: chamfer distance (1, sqrt 2) from the silhouette (alpha >= 0.5), then a Gaussian edge
const dist = new Float64Array(CANVAS * CANVAS).fill(1e9);
for (let i = 0; i < dist.length; i++) if (alpha[i] >= 0.5) dist[i] = 0;
const pass = (ys, xs, nb) => { for (const y of ys) for (const x of xs) { const i = y * CANVAS + x; for (const [dx, dy, w] of nb) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= CANVAS || Y >= CANVAS) continue; const v = dist[Y * CANVAS + X] + w; if (v < dist[i]) dist[i] = v; } } };
const fwd = [...Array(CANVAS).keys()], back = fwd.slice().reverse(), R2 = Math.SQRT2;
pass(fwd, fwd, [[-1, 0, 1], [0, -1, 1], [-1, -1, R2], [1, -1, R2]]);
pass(back, back, [[1, 0, 1], [0, 1, 1], [1, 1, R2], [-1, 1, R2]]);
const erf = z => { const s = Math.sign(z), t = 1 / (1 + 0.3275911 * Math.abs(z)); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z)); };
const EDGE = 1.9, SIGMA = 2.4;
const out = { w: CANVAS, h: CANVAS, px: Buffer.alloc(CANVAS * CANVAS * 4) };
let transparent = 0;
for (let i = 0; i < CANVAS * CANVAS; i++) {
  const glow = dist[i] === 0 ? 1 : 0.5 * (1 - erf((dist[i] - EDGE) / (SIGMA * Math.SQRT2)));
  const a = alpha[i], A = a + glow * (1 - a);
  for (let c = 0; c < 3; c++) out.px[i * 4 + c] = A > 0 ? Math.round(rgb[i * 3 + c] * a / A) : 0;
  out.px[i * 4 + 3] = Math.round(A * 255);
  if (out.px[i * 4 + 3] === 0) transparent++;
}
mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, writePNG(out));
console.log(`${args.out}: panel ${PW}x${PH} at ${x0},${y0}; green ${bg.map(Math.round).join(',')}; object ${TW}x${TH} -> ${SW}x${SH}; ` +
  `${(transparent / CANVAS / CANVAS * 100).toFixed(0)}% transparent (vanilla 41-64%)` +
  (edgeHits ? `; ⚠ the object touches the panel edge in ${edgeHits} px: it is cut off there` : ''));
