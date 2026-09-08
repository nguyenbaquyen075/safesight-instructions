// SPDX-License-Identifier: MIT

// Seed tối thiểu: chỉ Organization/Site/Camera mà yolo_inference.py cần để ghi
// Violation (FK cameraId -> Camera). Dữ liệu lấy khớp với src/data/mock-cameras.ts
// và src/data/mock-sites.ts để id nhất quán với phần còn lại của dashboard.
import 'dotenv/config';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaPg } from '@prisma/adapter-pg';

function resolveDbUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  if (raw.startsWith('file:')) {
    const filePath = raw.replace(/^file:(\.\/)?/, '');
    return `file://${path.resolve(process.cwd(), filePath)}`;
  }
  return raw;
}

// Chọn adapter theo DATABASE_URL, giống src/lib/prisma.ts (seed chạy bằng node nên
// không import được file .ts đó).
function createAdapter(url) {
  return /^postgres(ql)?:\/\//.test(url) ? new PrismaPg({ connectionString: url }) : new PrismaLibSql({ url });
}

const prisma = new PrismaClient({ adapter: createAdapter(resolveDbUrl()) });

const sites = [
  { id: 'site-001', orgId: 'org-001', name: 'Vinhomes Grand Park - Tòa S503', address: 'Long Thạnh Mỹ, TP. Thủ Đức, TP.HCM', lat: 10.8411, lng: 106.8334, status: 'ACTIVE' },
  { id: 'site-002', orgId: 'org-001', name: 'Masteri Centre Point - Block A', address: 'Xa lộ Hà Nội, Long Bình, TP. Thủ Đức', lat: 10.8593, lng: 106.8, status: 'ACTIVE' },
];

// Chỉ 6 camera thực sự dùng trong src/data/camera-videos.json (nguồn video cho YOLO)
const cameras = [
  { id: 'cam-001', siteId: 'site-001', name: 'Cổng chính - Entrance A', rtspUrl: 'rtsp://192.168.1.101:554/stream1', status: 'ONLINE', type: 'dome', location: 'Main Entrance', fps: 15, resolution: '1920x1080' },
  { id: 'cam-002', siteId: 'site-001', name: 'Tầng 15 - Khu vực cốt thép', rtspUrl: 'rtsp://192.168.1.102:554/stream1', status: 'ONLINE', type: 'fixed', location: 'Floor 15 - Rebar Area', fps: 15, resolution: '1920x1080' },
  { id: 'cam-003', siteId: 'site-001', name: 'Khu vực cẩu tháp #1', rtspUrl: 'rtsp://192.168.1.103:554/stream1', status: 'ONLINE', type: 'ptz', location: 'Tower Crane #1 Zone', fps: 10, resolution: '2560x1440' },
  { id: 'cam-005', siteId: 'site-001', name: 'Lối đi tầng hầm P1', rtspUrl: 'rtsp://192.168.1.105:554/stream1', status: 'ONLINE', type: 'dome', location: 'Basement P1 Walkway', fps: 15, resolution: '1920x1080' },
  { id: 'cam-007', siteId: 'site-002', name: 'Cổng vào công trường', rtspUrl: 'rtsp://192.168.2.101:554/stream1', status: 'ONLINE', type: 'dome', location: 'Site Gate', fps: 15, resolution: '1920x1080' },
  { id: 'cam-008', siteId: 'site-002', name: 'Tầng 8 - Đổ bê tông', rtspUrl: 'rtsp://192.168.2.102:554/stream1', status: 'ONLINE', type: 'fixed', location: 'Floor 8 - Concrete Pour', fps: 15, resolution: '1920x1080' },
];

async function main() {
  await prisma.organization.upsert({
    where: { id: 'org-001' },
    update: {},
    create: { id: 'org-001', name: 'AHV Works' },
  });

  for (const site of sites) {
    await prisma.site.upsert({ where: { id: site.id }, update: {}, create: site });
  }

  for (const cam of cameras) {
    await prisma.camera.upsert({ where: { id: cam.id }, update: {}, create: cam });
  }

  console.log(`Seed OK: 1 org, ${sites.length} sites, ${cameras.length} cameras`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
