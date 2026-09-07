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
  // Kenar örneklemesi kırpmadan ÖNCE yapılır: kırpılmış görüntüde markanın
  // kendi rengi kenara dayanır ve yanlışlıkla zemin sanılır.
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, CH = info.channels;
  const at = (x, y) => (y * W + x) * CH;

  // Background colour, sampled from the outer border. Artwork often ships with
  // its own panel (white, black or brand-coloured); the mark is whatever
  // differs from that panel, not simply whatever is dark or light.
  let br = 0, bg = 0, bb = 0, bn = 0, transparentBorder = 0, borderTotal = 0;
  const edge = (x, y) => {
    const i = at(x, y);
    borderTotal++;
    if (data[i + 3] < 128) { transparentBorder++; return; }
    br += data[i]; bg += data[i + 1]; bb += data[i + 2]; bn++;
  };
  for (let x = 0; x < W; x++) { edge(x, 0); edge(x, H - 1); }
  for (let y = 0; y < H; y++) { edge(0, y); edge(W - 1, y); }
  const borderIsTransparent = transparentBorder / borderTotal > 0.5;
  const bgR = bn ? br / bn : 255, bgG = bn ? bg / bn : 255, bgB = bn ? bb / bn : 255;

  const N = W * H;
  const raw = new Float32Array(N);
  let maxDist = 0;
  for (let p = 0; p < N; p++) {
    const i = p * CH;
    const a = data[i + 3] / 255;
    if (borderIsTransparent) {
      raw[p] = a;                       // shape already described by alpha
    } else {
      const d = Math.max(
        Math.abs(data[i] - bgR),
        Math.abs(data[i + 1] - bgG),
        Math.abs(data[i + 2] - bgB)
      ) / 255;
      raw[p] = a * d;                   // distance from the panel colour
      if (raw[p] > maxDist) maxDist = raw[p];
    }
  }

  const alpha = Buffer.allocUnsafe(N);
  const gain = borderIsTransparent ? 1 : (maxDist > 0.02 ? 1 / maxDist : 1);
  for (let p = 0; p < N; p++) {
    alpha[p] = Math.round(Math.min(1, raw[p] * gain) * 255);
  }

  const white = Buffer.alloc(N * 3, 255);
  const silhouette = await sharp(white, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();

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
    // Artwork that only works in its own colours: shown as a text mark.
    if (["Turkish Leather Brands", "Innovation is GREAT"].includes(name)) {
      console.log(`text ${name} (artwork is a colour-locked panel)`);
      continue;
    }
    try {
      writeFileSync(dest, await normalise(readFileSync(dest)));
    } catch (e) {
      console.warn(`text ${name} (${e.message})`);
      continue;
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
