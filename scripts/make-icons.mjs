// SPDX-License-Identifier: MIT

// Sinh icon PWA (192/512px) từ logo SVG. Chạy một lần thủ công, không phải bước build:
//   node scripts/make-icons.mjs
// Kết quả (public/icons/icon-192.png, icon-512.png) được commit thẳng vào repo.
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const SRC = path.resolve(process.cwd(), 'wiki/assets/safesight-logo.svg');
const OUT_DIR = path.resolve(process.cwd(), 'public/icons');
const SIZES = [192, 512];

async function main() {
  if (!fs.existsSync(SRC)) throw new Error(`Không tìm thấy logo nguồn: ${SRC}`);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const size of SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(SRC, { density: 384 })
      .resize(size, size, { fit: 'contain', background: '#0F172A' })
      .flatten({ background: '#0F172A' })
      .png()
      .toFile(outPath);
    console.log(`Đã tạo ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
