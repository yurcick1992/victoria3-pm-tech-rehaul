// VANILLA PICTURES AS PNG — for art briefs and side-by-side checks (the references of POLISH_1_0.md R2, R5, R10 were made this way).
//
//   node tools/dds_to_png.mjs one   <in.dds> <out.png> [--scale 0.333]
//   node tools/dds_to_png.mjs sheet <out.png> --cols 4 --cell 256 [--bg 3a3530] <in1.dds|png> [<in2> …]
//
// `one` converts a DDS (uncompressed or DXT5: tools/lib_image.mjs readDDS), optionally scaled; `sheet` lays several pictures (DDS or PNG)
// out on a flat background, each scaled to fit its cell, so one image can show a family of icons to a person or an image model.
// ⚠ Pictures converted from the game are Paradox's: write them somewhere gitignored (art_brief/references/ is), never into the repo.
import { readFileSync, writeFileSync } from 'node:fs';
import { readDDS, readPNG, writePNG, resample } from './lib_image.mjs';

const [mode, ...rest] = process.argv.slice(2);
const opt = k => { const i = rest.indexOf('--' + k); return i >= 0 ? rest.splice(i, 2)[1] : null; };
const load = p => (p.toLowerCase().endsWith('.png') ? readPNG : readDDS)(readFileSync(p));
if (mode === 'one') {
  const scale = Number(opt('scale') || 1);
  const [src, out] = rest; if (!src || !out) throw new Error('usage: one <in.dds> <out.png> [--scale s]');
  let img = load(src);
  if (scale !== 1) img = resample(img, Math.max(1, Math.round(img.w * scale)), Math.max(1, Math.round(img.h * scale)));
  writeFileSync(out, writePNG(img));
  console.log(`${out}  ${img.w}x${img.h}`);
} else if (mode === 'sheet') {
  const cols = Number(opt('cols') || 4), cell = Number(opt('cell') || 256), bg = opt('bg') || '3a3530';
  const [out, ...ins] = rest; if (!out || !ins.length) throw new Error('usage: sheet <out.png> --cols N --cell N [--bg hex] <in…>');
  const pad = Math.round(cell / 16), rows = Math.ceil(ins.length / cols);
  const W = cols * (cell + pad) + pad, H = rows * (cell + pad) + pad, px = Buffer.alloc(W * H * 4);
  const [r, g, b] = [0, 2, 4].map(i => parseInt(bg.slice(i, i + 2), 16));
  for (let i = 0; i < W * H; i++) { px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = 255; }
  ins.forEach((p, k) => {
    let img = load(p); const f = Math.min(1, cell / Math.max(img.w, img.h));
    if (f < 1) img = resample(img, Math.round(img.w * f), Math.round(img.h * f));
    const ox = pad + (k % cols) * (cell + pad) + Math.floor((cell - img.w) / 2), oy = pad + Math.floor(k / cols) * (cell + pad) + Math.floor((cell - img.h) / 2);
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const s = (y * img.w + x) * 4, d = ((oy + y) * W + ox + x) * 4, a = img.px[s + 3] / 255;
      for (let c = 0; c < 3; c++) px[d + c] = Math.round(img.px[s + c] * a + px[d + c] * (1 - a));
    }
  });
  writeFileSync(out, writePNG({ w: W, h: H, px }, { alpha: false }));
  console.log(`${out}  ${W}x${H}, ${ins.length} picture(s)`);
} else {
  console.error('usage: node tools/dds_to_png.mjs one <in.dds> <out.png> [--scale s] | sheet <out.png> --cols N --cell N [--bg hex] <in…>');
  process.exit(2);
}
