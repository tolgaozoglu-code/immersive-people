// Downloads reference logos at build time and writes a manifest.
// Failures are non-fatal: missing logos fall back to text on the site.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { get } from "node:https";
import { resolve } from "node:path";

let sharp = null;
try {
  ({ default: sharp } = await import("sharp"));
} catch (e) {
  console.warn(`sharp unavailable (${e.message}); logos will be used as downloaded.`);
}

const OUT_DIR = resolve("assets/uploads/logos");
const MANIFEST = resolve("_data/logo_files.json");

const LOGOS = [
  ["VISA", "https://static.wixstatic.com/media/29bb63_7b73cde0d853437d93a9ea955c2c195f~mv2.png"],
  ["Pfizer", "https://static.wixstatic.com/media/29bb63_530f05189ffd4a5dad12177e23d9a8f6~mv2.png"],
  ["PHILIPS", "https://static.wixstatic.com/media/29bb63_eb9619b6952c439ab3416a36af8288d4~mv2.png"],
  ["SOCAR", "https://static.wixstatic.com/media/29bb63_54ff5103b8764ba49edd759812957c6c~mv2.png"],
  ["ANADOLU GROUP", "https://static.wixstatic.com/media/29bb63_bb99b1f2d0db4b0196d6e84f9e2535d3~mv2.png"],
  ["BMW", "https://static.wixstatic.com/media/29bb63_fefb04d1360a4a7f8725e0d8e6320661~mv2.png"],
  ["Johnson & Johnson", "https://static.wixstatic.com/media/29bb63_1a2d66b2542a477e811c0cbab4e4b952~mv2.png"],
  ["Vodafone", "https://static.wixstatic.com/media/29bb63_161668fa58654322942f020915f572cc~mv2.png"],
  ["MAN", "https://static.wixstatic.com/media/29bb63_3e7b278ecc654dbdb7fefc627974d9a7~mv2.png"],
  ["Godiva", "https://static.wixstatic.com/media/29bb63_17308945eb644c69aea733ccb51f6eb0~mv2.png"],
  ["Messe Frankfurt", "https://static.wixstatic.com/media/29bb63_cf3b39487b1640f3aa13d20e2ad2b10c~mv2.png"],
  ["ASELSAN", "https://static.wixstatic.com/media/29bb63_47eb44d8771840e2b59e63466d9c9972~mv2.png"],
  ["HAVELSAN", "https://static.wixstatic.com/media/29bb63_88d3ad4f803e45b1840cacfbd23b3c9a~mv2.png"],
  ["İBB", "https://static.wixstatic.com/media/29bb63_da432e360be043d0a77a6e972cc3c70c~mv2.png"],
  ["TİM", "https://static.wixstatic.com/media/29bb63_c7523fe36d964896a12410e402ab5fd2~mv2.png"],
  ["Turkish Leather Brands", "https://static.wixstatic.com/media/29bb63_40edeeaced0d4d099d81685ede6448f1~mv2.png"],
  ["Innovation is GREAT", "https://static.wixstatic.com/media/29bb63_ff233858a4a8458f8226f1eecd3d990b~mv2.png"]
];


// --- Logo normalisation -------------------------------------------------
// Canvas geometry: every logo lands on the same 600x200 canvas, with the mark
// scaled to an equal geometric mean (equal optical weight), so a square mark
// and a wide wordmark read as the same size when placed side by side.
const CANVAS_W = 600, CANVAS_H = 200;
const INNER_W = 540, INNER_H = 168;
const TARGET = 150; // sqrt(mark width * mark height)

async function normalise(buf) {
  if (!sharp) return buf;
  const trimmed = await sharp(buf).trim({ threshold: 8 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const W = meta.width, H = meta.height, N = W * H;

  // True per-pixel alpha, derived by compositing over black and white:
  // lumW - lumB == (1 - alpha) * 255, independent of the mark's own colour.
  const overBlack = await sharp(trimmed).flatten({ background: "#000000" }).greyscale().raw().toBuffer();
  const overWhite = await sharp(trimmed).flatten({ background: "#ffffff" }).greyscale().raw().toBuffer();

  const A = new Float32Array(N);   // alpha 0..1
  const C = new Float32Array(N);   // mark luminance 0..1
  let covered = 0, lumSum = 0, lumCount = 0;
  for (let i = 0; i < N; i++) {
    const a = Math.min(1, Math.max(0, 1 - (overWhite[i] - overBlack[i]) / 255));
    A[i] = a;
    C[i] = a > 0.01 ? Math.min(1, overBlack[i] / 255 / a) : 0;
    if (a > 0.5) { covered++; lumSum += C[i]; lumCount++; }
  }
  const coverage = covered / N;
  const meanLum = lumCount ? lumSum / lumCount : 0;

  // Spread of tone inside the opaque area: a background panel holds a mark of
  // a different tone, whereas a solid mark is uniform.
  let varSum = 0;
  for (let i = 0; i < N; i++) if (A[i] > 0.5) varSum += (C[i] - meanLum) ** 2;
  const spread = lumCount ? Math.sqrt(varSum / lumCount) : 0;

  // High coverage means the artwork carries its own opaque background panel:
  // the mark is then the part that differs from that panel. Otherwise the
  // alpha channel already describes the mark and colour is irrelevant.
  const alpha = Buffer.allocUnsafe(N);
  for (let i = 0; i < N; i++) {
    let v;
    if (coverage > 0.85 && spread > 0.05) v = A[i] * (meanLum > 0.5 ? 1 - C[i] : C[i]);
    else v = A[i];
    alpha[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }

  const white = Buffer.alloc(N * 3, 255);
  const silhouette = await sharp(white, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();

  // Re-trim: the silhouette may have gained transparent margins.
  const tight = await sharp(silhouette).trim({ threshold: 4 }).png().toBuffer();
  const tm = await sharp(tight).metadata();

  // Equal-area scaling so a square mark and a wide wordmark read alike.
  const aspect = tm.width / tm.height;
  let w = Math.round(TARGET * Math.sqrt(aspect));
  let h = Math.round(TARGET / Math.sqrt(aspect));
  const k = Math.min(INNER_W / w, INNER_H / h, 1);
  w = Math.max(1, Math.round(w * k));
  h = Math.max(1, Math.round(h * k));

  const mark = await sharp(tight).resize(w, h, { fit: "fill" }).png().toBuffer();

  return await sharp({
    create: { width: CANVAS_W, height: CANVAS_H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toBuffer();
}

const slug = (s) =>
  s.toLowerCase()
    .replaceAll("ı", "i").replaceAll("İ", "i").replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const download = (url, dest) =>
  new Promise((res, rej) => {
    get(url, { timeout: 15000 }, (r) => {
      if (r.statusCode !== 200) return rej(new Error(`HTTP ${r.statusCode}`));
      const chunks = [];
      r.on("data", (c) => chunks.push(c));
      r.on("end", () => { writeFileSync(dest, Buffer.concat(chunks)); res(); });
    }).on("error", rej).on("timeout", function () { this.destroy(); rej(new Error("timeout")); });
  });

try {
mkdirSync(OUT_DIR, { recursive: true });
const manifest = {};
for (const [name, url] of LOGOS) {
  const file = `${slug(name)}.png`;
  const dest = resolve(OUT_DIR, file);
  try {
    if (!existsSync(dest)) await download(url, dest);
    // Kaynak PNG'ler farklı zemin, renk ve en-boy oranlarıyla geliyor; hepsini
    // şeffaf zeminli beyaz siluete çevirip eşit optik alanda tek tip tuvale otur.
    try {
      writeFileSync(dest, await normalise(readFileSync(dest)));
    } catch (e) {
      console.warn(`     ${name}: normalise skipped (${e.message})`);
    }
    manifest[name] = `/assets/uploads/logos/${file}`;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.warn(`skip ${name} (${e.message}) — text fallback will be used`);
  }
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${Object.keys(manifest).length}/${LOGOS.length} logos`);
} catch (e) {
  // Logolar tamamlayıcı bir katman; hiçbir hata yayını durdurmamalı.
  console.warn(`logo step failed (${e.message}); continuing build with text fallbacks.`);
  try { writeFileSync(MANIFEST, "{}\n"); } catch {}
}
