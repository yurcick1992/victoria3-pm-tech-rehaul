// EMIT THE MOD'S OWN PRODUCTION-METHOD ICONS (POLISH_1_0.md R10).
//
//   node tools/emit_method_icons.mjs <modRoot>        # called by tools/build.ps1
//
// Every art/production_method_icons/<method key>.png (104 x 104, made by tools/make_icon.mjs --kind method) is written as
//   gfx/interface/icons/production_method_icons/zzz_pm_rehaul_<method key>.dds
// in vanilla's form (uncompressed A8R8G8B8, 7 mips). build.ps1 points the method's `texture` at that path whenever the picture exists,
// over the icon the book carries (a minted method's book icon is the method below's: make_tier4_config.mjs). The book is not touched,
// so a picture changes no canon checksum. Invoke-ModChecks fails a build that names a zzz_pm_rehaul_ texture no file backs.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPNG, writeDDS } from './lib_image.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOD = process.argv[2];
if (!MOD) { console.error('usage: node tools/emit_method_icons.mjs <modRoot>'); process.exit(2); }
const ART = join(REPO, 'art', 'production_method_icons');
const pngs = existsSync(ART) ? readdirSync(ART).filter(f => f.endsWith('.png')).sort() : [];
const outDir = join(MOD, 'gfx', 'interface', 'icons', 'production_method_icons');
mkdirSync(outDir, { recursive: true });
for (const f of pngs) {
  const img = readPNG(readFileSync(join(ART, f)));
  if (img.w !== 104 || img.h !== 104) throw new Error(`${join(ART, f)}: ${img.w}x${img.h} — a method icon is 104x104 (tools/make_icon.mjs --kind method makes one)`);
  writeFileSync(join(outDir, `zzz_pm_rehaul_${f.replace(/\.png$/, '')}.dds`), writeDDS(img));
}
console.log(`  method icons: ${pngs.length} from art/production_method_icons: ${pngs.map(f => f.replace(/\.png$/, '')).join(', ') || '(none)'}`);
