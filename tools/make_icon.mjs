// MAKE A TECHNOLOGY OR PRODUCTION-METHOD ICON from an image-model picture painted on flat green (POLISH_1_0.md R5, R10).
//
//   node tools/make_icon.mjs --kind tech   --src <picture.png> --out art/invention_icons/<technology>.png [--region x,y,w,h] [--size 215]
//   node tools/make_icon.mjs --kind method --src <picture.png> --out art/production_method_icons/<method key>.png [--region …] [--size 90]
//
// Writes an RGBA PNG in the form of vanilla's icons of that kind; emit_techs.mjs (technologies) and emit_method_icons.mjs (methods)
// turn it into the DDS the game reads.
//   1. the green panel: the bounding box of pure-green pixels inside --region (default: the whole picture), inset 4 px, so a sheet
//      of several labelled panels can be cut one panel at a time;
//   2. the key: alpha from how far a pixel is greener than its other channels, against the panel's own measured green; the colour
//      of a part-transparent pixel is unmixed from that green, and any green left over is clamped away;
//   3. the object trimmed to its pixels and scaled so its longer side is --size px, centred on the canvas;
//   4. vanilla's soft black outline, a full-black edge 1.9 px outside the silhouette softened as a Gaussian of sigma S. MEASURED:
//      - tech (256 px canvas, longer side 209-246 px, most near 215): on nitrogen_fixation, pneumatic_tools, improved_fertilizer and
//        lathe the black's alpha 2..8 px out is 145 103 68 41 22 10 4 (0-255) on all four: S = 2.4;
//      - method (104 px, longer side 83-93 px, most near 90): on mechanized_workshops, bleached_paper, nitrogen_fixation,
//        sulfite_pulping, lathes and crude_paper it is about 220 120 35 7 at 1..4 px out, the same on every side: S = 1.1.
// ⚠ JPEG pictures go through a PNG first (PowerShell: [System.Drawing.Image]::FromFile(jpg).Save(png, 'Png')); this tool reads PNG only.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { readPNG, writePNG, resample } from './lib_image.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1]]]) : a), []));
// `despill`: a painted picture clamps a pixel's green to the mean of its red and blue (+6), so olive fringes turn brown; a bronze
//   emblem clamps it only to its red or blue, because gold's green is legitimately high and the mean would push its highlights to orange.
const KINDS = {
  tech:   { canvas: 256, size: 215, sigma: 2.4, despill: 'mean', vanilla: '41-64%' },
  method: { canvas: 104, size: 90,  sigma: 1.1, despill: 'max',  vanilla: '43-69%',
            // the bronze itself: every channel's mean and spread over the opaque pixels set to vanilla's, MEASURED on ten bronze method
            // icons (furniture_handicraft, mechanized_workshops, lathes, sulfite_pulping, bleached_paper, crude_paper,
            // electric_sewing_machines, nitrogen_fixation, chemical_fertilizers, improved_fertilizer; 28,432 px). An image model's
            // bronze came out darker and yellower (mean 141-148 / 119-125 / 73-85 against 160 / 141 / 109).
            match: { mean: [159.9, 141.0, 109.0], sd: [28.9, 32.6, 34.6] } },
};
const KIND = KINDS[args.kind];
if (!args.src || !args.out || !KIND) { console.error('usage: node tools/make_icon.mjs --kind tech|method --src <picture.png> --out <icon.png> [--region x,y,w,h] [--size N]'); process.exit(2); }
const SIZE = Number(args.size || KIND.size), CANVAS = KIND.canvas;
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
  c[1] = Math.min(c[1], KIND.despill === 'mean' ? (c[0] + c[2]) / 2 + 6 : Math.max(c[0], c[2]));   // despill (see KINDS)
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
if (KIND.match) {
  const s = [0, 0, 0], q = [0, 0, 0]; let m = 0;
  for (let i = 0; i < SW * SH; i++) if (obj.px[i * 4 + 3] >= 250) { for (let c = 0; c < 3; c++) { s[c] += obj.px[i * 4 + c]; q[c] += obj.px[i * 4 + c] ** 2; } m++; }
  const mean = s.map(v => v / m), sd = q.map((v, c) => Math.sqrt(Math.max(1, v / m - mean[c] ** 2)));
  for (let i = 0; i < SW * SH; i++) for (let c = 0; c < 3; c++)
    obj.px[i * 4 + c] = Math.max(0, Math.min(255, Math.round((obj.px[i * 4 + c] - mean[c]) / sd[c] * KIND.match.sd[c] + KIND.match.mean[c])));
  console.log(`  colour matched: mean ${mean.map(Math.round).join('/')} -> ${KIND.match.mean.map(Math.round).join('/')}`);
}
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
const EDGE = 1.9, SIGMA = KIND.sigma;
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
  `${(transparent / CANVAS / CANVAS * 100).toFixed(0)}% transparent (vanilla ${KIND.vanilla})` +
  (edgeHits ? `; ⚠ the object touches the panel edge in ${edgeHits} px: it is cut off there` : ''));
