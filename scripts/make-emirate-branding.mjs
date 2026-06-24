/**
 * Generate Emirate Co PNG assets (icons + Open Graph image).
 * Run: node scripts/make-emirate-branding.mjs
 */
import sharp from "sharp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logoSvg = readFileSync(join(root, "images/emirate-logo-dark.svg"));

async function makeSquareIcon(size, outPath) {
  const logoWidth = Math.round(size * 0.82);
  const logoHeight = Math.round(logoWidth * (280 / 640));
  const logo = await sharp(logoSvg).resize(logoWidth, logoHeight, { fit: "inside" }).png().toBuffer();
  const left = Math.round((size - logoWidth) / 2);
  const top = Math.round((size - logoHeight) / 2);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function makeOgImage(outPath) {
  const width = 1200;
  const height = 630;
  const logoWidth = 760;
  const logoHeight = Math.round(logoWidth * (280 / 640));
  const logo = await sharp(logoSvg).resize(logoWidth, logoHeight, { fit: "inside" }).png().toBuffer();
  const left = Math.round((width - logoWidth) / 2);
  const top = Math.round((height - logoHeight) / 2 - 20);
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 },
    },
  })
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

await makeSquareIcon(512, join(root, "icons/icon-512.png"));
await makeSquareIcon(192, join(root, "icons/icon-192.png"));
await makeOgImage(join(root, "images/og-emirate.png"));
console.log("Created icons/icon-512.png, icons/icon-192.png, images/og-emirate.png");
