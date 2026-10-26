// MAKE THE LAUNCHER'S THUMBNAIL from the square Workshop one (POLISH_1_0.md R2).
//
//   node tools/make_launcher_thumbnail.mjs --src <square.png> --out art/thumbnail_launcher.png [--height 540]
//
// The Paradox launcher draws a mod's picture in a 16:9 tile and crops the image to fill it, keeping the centre: a square thumbnail
// loses its top and bottom 22% (measured on the launcher's mods list, 2026-10-26: a 140 x 78 px tile showing the square's middle band,
// the title cut). This writes a 16:9 picture that shows the whole square: the square in the middle at full height, and beside it the
// same picture blurred and darkened (the usual letterbox fill), with a soft shadow at the square's edges. RGB, no alpha.
// build.ps1 copies the result to .metadata/thumbnail.png, the file the launcher reads; the square stays in the mod root.
import { readFileSync, writeFileSync } from 'node:fs';
import { readPNG, writePNG, resample } from './lib_image.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? a.concat([[v.slice(2), all[i + 1]]]) : a), []));
if (!args.src || !args.out) { console.error('usage: node tools/make_launcher_thumbnail.mjs --src <square.png> --out <wide.png> [--height 540]'); process.exit(2); }
const H = Number(args.height || 540), W = Math.round(H * 16 / 9);
const sq = readPNG(readFileSync(args.src));
if (sq.w !== sq.h) throw new Error(`${args.src}: ${sq.w}x${sq.h} — the source is the square Workshop thumbnail`);

// the fill: the square's own centre band, shrunk to 16 x 9 and scaled back up bilinearly (a wide blur), at 65% brightness
const bandH = Math.round(sq.w * 9 / 16), y0 = Math.round((sq.h - bandH) / 2);
const band = { w: sq.w, h: bandH, px: sq.px.subarray(y0 * sq.w * 4, (y0 + bandH) * sq.w * 4) };
const BW = 16, BH = 9, tiny = resample(band, BW, BH);
const out = { w: W, h: H, px: Buffer.alloc(W * H * 4) };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const fx = Math.min(BW - 1, Math.max(0, (x + 0.5) * BW / W - 0.5)), fy = Math.min(BH - 1, Math.max(0, (y + 0.5) * BH / H - 0.5));
  const xa = Math.floor(fx), ya = Math.floor(fy), xb = Math.min(BW - 1, xa + 1), yb = Math.min(BH - 1, ya + 1), tx = fx - xa, ty = fy - ya;
  const o = (y * W + x) * 4;
  for (let c = 0; c < 3; c++) {
    const p = (xx, yy) => tiny.px[(yy * BW + xx) * 4 + c];
    out.px[o + c] = Math.round(0.65 * ((p(xa, ya) * (1 - tx) + p(xb, ya) * tx) * (1 - ty) + (p(xa, yb) * (1 - tx) + p(xb, yb) * tx) * ty));
  }
  out.px[o + 3] = 255;
}
// the shadow: 16 px either side of the square, darkest at its edge
const x0 = Math.round((W - H) / 2), SH = 16;
for (let y = 0; y < H; y++) for (let d = 1; d <= SH; d++) {
  const k = 1 - 0.55 * Math.pow(1 - d / SH, 2);
  for (const x of [x0 - d, x0 + H - 1 + d]) { const o = (y * W + x) * 4; for (let c = 0; c < 3; c++) out.px[o + c] = Math.round(out.px[o + c] * k); }
}
// the square itself
const fit = resample(sq, H, H);
for (let y = 0; y < H; y++) fit.px.copy(out.px, (y * W + x0) * 4, y * H * 4, (y + 1) * H * 4);
const buf = writePNG(out, { alpha: false });
writeFileSync(args.out, buf);
console.log(`${args.out}: ${W}x${H}, the square ${H}x${H} at x ${x0}, ${buf.length} bytes`);
