// PNG IN, PNG AND DDS OUT — the little image handling the mod's own art needs, with no image library.
//
//   readPNG(buf)            -> { w, h, px }   px = RGBA bytes, row-major, straight (not premultiplied) alpha
//   writePNG(img)           -> Buffer         8-bit RGBA, per-row adaptive filter, zlib level 9
//   resample(img, w, h)     -> img            area-average (box) resampling in premultiplied alpha
//   writeDDS(img)           -> Buffer         uncompressed A8R8G8B8 with the full mip chain, the form of vanilla's icons
//
// ⚠ readPNG takes 8-bit RGB or RGBA, non-interlaced: what an editor saves by default and what writePNG writes. A palette,
//   greyscale, 16-bit or interlaced file THROWS with its type named; convert it rather than teach this file every PNG form.
// ⚠ writeDDS's header is byte-compared against vanilla's invention icons (`lathe.dds`: dwFlags 0x2100F, dwCaps 0x401008, nine
//   mips at 256 px, 349,652 bytes): identical but for bytes 68-75, where vanilla's exporter signs dwReserved1 ("NVTT", version
//   0x20008) and we leave zeros. Pixels are BGRA byte order: the masks describe a little-endian A8R8G8B8 word (MODDING_NOTES).
import { inflateSync, deflateSync } from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (const x of buf) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function paeth(a, b, c) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }

export function readPNG(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('readPNG: not a PNG file');
  let o = 8, w, h, depth, ctype, interlace; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8), d = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; ctype = d[9]; interlace = d[12]; }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || (ctype !== 2 && ctype !== 6) || interlace !== 0)
    throw new Error(`readPNG: only 8-bit RGB/RGBA non-interlaced PNGs are read (this one: depth ${depth}, colour type ${ctype}, interlace ${interlace})`);
  const bpp = ctype === 6 ? 4 : 3, stride = w * bpp, raw = inflateSync(Buffer.concat(idat));
  if (raw.length !== (stride + 1) * h) throw new Error(`readPNG: ${raw.length} bytes of image data, expected ${(stride + 1) * h}`);
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride), px = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pred = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? paeth(a, b, c) : NaN;
      if (Number.isNaN(pred)) throw new Error(`readPNG: unknown filter ${f} on row ${y}`);
      cur[i] = (row[i] + pred) & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const s = x * bpp, d = (y * w + x) * 4;
      px[d] = cur[s]; px[d + 1] = cur[s + 1]; px[d + 2] = cur[s + 2]; px[d + 3] = bpp === 4 ? cur[s + 3] : 255;
    }
    cur.copy(prev);
  }
  return { w, h, px };
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

// `alpha: false` writes RGB (colour type 2) and drops the alpha channel: a quarter smaller for an opaque picture.
export function writePNG({ w, h, px }, { alpha = true } = {}) {
  const bpp = alpha ? 4 : 3, ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  if (!alpha) { const rgb = Buffer.alloc(w * h * 3); for (let i = 0; i < w * h; i++) px.copy(rgb, i * 3, i * 4, i * 4 + 3); px = rgb; }
  const stride = w * bpp, raw = Buffer.alloc((stride + 1) * h), cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride), prev = y ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {          // the standard heuristic: the filter whose output has the smallest sum of |signed bytes|
      const out = cand[f]; let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        const v = (row[i] - (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c))) & 0xff;
        out[i] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    raw[y * (stride + 1)] = best; cand[best].copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Area-average resampling, separable, in premultiplied alpha so transparent pixels lend no colour to the edge.
export function resample({ w, h, px }, W, H) {
  const pre = new Float64Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { const a = px[i * 4 + 3] / 255; pre[i * 4] = px[i * 4] * a; pre[i * 4 + 1] = px[i * 4 + 1] * a; pre[i * 4 + 2] = px[i * 4 + 2] * a; pre[i * 4 + 3] = px[i * 4 + 3]; }
  const weights = (n, N) => {             // for each output index: [[source index, weight], …], weights summing to 1
    const out = [], scale = n / N;
    for (let j = 0; j < N; j++) {
      const s0 = j * scale, s1 = (j + 1) * scale, ws = [];
      for (let i = Math.floor(s0); i < Math.min(n, Math.ceil(s1)); i++) { const cov = Math.min(s1, i + 1) - Math.max(s0, i); if (cov > 0) ws.push([i, cov / scale]); }
      out.push(ws);
    }
    return out;
  };
  const wx = weights(w, W), wy = weights(h, H), tmp = new Float64Array(W * h * 4), out = new Float64Array(W * H * 4);
  for (let y = 0; y < h; y++) for (let X = 0; X < W; X++) for (const [i, k] of wx[X]) for (let c = 0; c < 4; c++) tmp[(y * W + X) * 4 + c] += pre[(y * w + i) * 4 + c] * k;
  for (let Y = 0; Y < H; Y++) for (const [j, k] of wy[Y]) for (let X = 0; X < W; X++) for (let c = 0; c < 4; c++) out[(Y * W + X) * 4 + c] += tmp[(j * W + X) * 4 + c] * k;
  const res = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const a = out[i * 4 + 3];
    for (let c = 0; c < 3; c++) res[i * 4 + c] = a > 0 ? Math.min(255, Math.round(out[i * 4 + c] / (a / 255))) : 0;
    res[i * 4 + 3] = Math.min(255, Math.round(a));
  }
  return { w: W, h: H, px: res };
}

export function writeDDS(img) {
  if (img.w !== img.h || (img.w & (img.w - 1))) throw new Error(`writeDDS: a square power-of-two image is expected, got ${img.w}x${img.h}`);
  const levels = []; for (let m = img; ; m = resample(m, m.w >> 1, m.h >> 1)) { levels.push(m); if (m.w === 1) break; }
  const hdr = Buffer.alloc(128);
  hdr.write('DDS ', 0, 'ascii');
  hdr.writeUInt32LE(124, 4);
  hdr.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x8 | 0x1000 | 0x20000, 8);   // CAPS HEIGHT WIDTH PITCH PIXELFORMAT MIPMAPCOUNT
  hdr.writeUInt32LE(img.h, 12); hdr.writeUInt32LE(img.w, 16); hdr.writeUInt32LE(img.w * 4, 20);
  hdr.writeUInt32LE(levels.length, 28);
  hdr.writeUInt32LE(32, 76); hdr.writeUInt32LE(0x41, 80); hdr.writeUInt32LE(32, 88);
  hdr.writeUInt32LE(0x00ff0000, 92); hdr.writeUInt32LE(0x0000ff00, 96); hdr.writeUInt32LE(0x000000ff, 100); hdr.writeUInt32LE(0xff000000, 104);
  hdr.writeUInt32LE(0x8 | 0x1000 | 0x400000, 108);                   // COMPLEX TEXTURE MIPMAP
  const bodies = levels.map(({ px }) => {
    const b = Buffer.alloc(px.length);
    for (let i = 0; i < px.length; i += 4) { b[i] = px[i + 2]; b[i + 1] = px[i + 1]; b[i + 2] = px[i]; b[i + 3] = px[i + 3]; }   // RGBA -> BGRA
    return b;
  });
  return Buffer.concat([hdr, ...bodies]);
}
