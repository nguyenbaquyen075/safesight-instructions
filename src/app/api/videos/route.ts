// SPDX-License-Identifier: MIT

import { readdir, writeFile, stat } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isSafeVideoName } from '@/lib/camera-source';

// Video mẫu cho camera mô phỏng nằm ở public/videos/ để Next phục vụ thẳng qua
// /videos/<ten>, còn yolo_inference.py đọc cùng thư mục đó từ đĩa.
const VIDEO_DIR = path.join(process.cwd(), 'public', 'videos');
const MAX_BYTES = 200 * 1024 * 1024;   // 200MB — video mẫu vài chục giây là đủ

/** Danh sách video mẫu đang có, kèm dung lượng để hiển thị. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let names: string[] = [];
  try {
    names = await readdir(VIDEO_DIR);
  } catch {
    return NextResponse.json({ videos: [] });   // chưa có thư mục -> danh sách rỗng
  }

  const videos = [];
  for (const name of names.filter(isSafeVideoName).sort()) {
    try {
      const info = await stat(path.join(VIDEO_DIR, name));
      videos.push({ name, sizeMB: Math.round(info.size / 1024 / 1024 * 10) / 10 });
    } catch {
      // file biến mất giữa chừng -> bỏ qua, không làm hỏng cả danh sách
    }
  }
  return NextResponse.json({ videos });
}

/** Tải một video mẫu lên. Trả về tên file đã lưu (có thể khác tên gửi lên nếu trùng). */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Thiếu file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File ${Math.round(file.size / 1024 / 1024)}MB, vượt giới hạn 200MB` },
      { status: 400 },
    );
  }

  // Chuẩn hoá tên: bỏ đường dẫn, thay ký tự lạ. KHÔNG tin tên trình duyệt gửi lên —
  // "../../.env" là tên file hợp lệ với trình duyệt nhưng ghi đè được file hệ thống.
  const base = path.basename(file.name).replace(/[^\w.\- ]/g, '_');
  if (!isSafeVideoName(base)) {
    return NextResponse.json(
      { error: 'Chỉ nhận .mp4 .mov .webm .avi .mkv' },
      { status: 400 },
    );
  }

  // Trùng tên -> thêm hậu tố, không ghi đè video camera khác đang dùng
  let name = base;
  const ext = path.extname(base);
  const stem = base.slice(0, -ext.length);
  for (let i = 1; i < 100; i++) {
    try {
      await stat(path.join(VIDEO_DIR, name));
      name = `${stem}-${i}${ext}`;
    } catch {
      break;
    }
  }

  await writeFile(path.join(VIDEO_DIR, name), Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ name });
}
