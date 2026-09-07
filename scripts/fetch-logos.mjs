// Downloads reference logos at build time and writes a manifest.
// Failures are non-fatal: missing logos fall back to text on the site.
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { get } from "node:https";
import { resolve } from "node:path";

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

mkdirSync(OUT_DIR, { recursive: true });
const manifest = {};
for (const [name, url] of LOGOS) {
  const file = `${slug(name)}.png`;
  const dest = resolve(OUT_DIR, file);
  try {
    if (!existsSync(dest)) await download(url, dest);
    manifest[name] = `/assets/uploads/logos/${file}`;
    console.log(`ok   ${name}`);
  } catch (e) {
    console.warn(`skip ${name} (${e.message}) — text fallback will be used`);
  }
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
console.log(`manifest: ${Object.keys(manifest).length}/${LOGOS.length} logos`);
