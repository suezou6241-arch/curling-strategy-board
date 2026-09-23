import sharp from "sharp";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";

const svg = readFileSync("icon-src.svg");
mkdirSync("public", { recursive: true });

const targets = [
  { size: 192, file: "public/pwa-192.png" },
  { size: 512, file: "public/pwa-512.png" },
  { size: 180, file: "public/apple-touch-icon.png" },
];

// maskable 用: 周囲に余白(セーフゾーン)を持たせた 512 版
async function run() {
  for (const t of targets) {
    await sharp(svg, { density: 384 })
      .resize(t.size, t.size)
      .png()
      .toFile(t.file);
    console.log("wrote", t.file);
  }
  // maskable: 背景色で 512 全面を塗り、中央にアイコンを 80% で配置
  const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer();
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 11, g: 61, b: 46, alpha: 1 },
    },
  })
    .composite([{ input: inner, gravity: "center" }])
    .png()
    .toFile("public/pwa-maskable-512.png");
  console.log("wrote public/pwa-maskable-512.png");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
