// SPDX-License-Identifier: MIT
import path from 'node:path';
import sharp from 'sharp';

const MAX_SIDE = 640;

export async function loadSnapshotBase64(snapshotUrl: string): Promise<{ data: string; mediaType: 'image/jpeg' } | null> {
  const name = path.basename(snapshotUrl);
  if (!snapshotUrl.startsWith('/snapshots/') || name.includes('..')) return null;
  try {
    const buf = await sharp(path.resolve(process.cwd(), 'public', 'snapshots', name))
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 }).toBuffer();
    return { data: buf.toString('base64'), mediaType: 'image/jpeg' };
  } catch { return null; }
}
