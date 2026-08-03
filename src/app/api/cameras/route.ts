// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { mockCameras } from '@/data/mock-cameras';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteId = searchParams.get('siteId');
  const status = searchParams.get('status');
  
  let cameras = [...mockCameras];
  
  if (siteId) {
    cameras = cameras.filter(c => c.siteId === siteId);
  }
  if (status) {
    cameras = cameras.filter(c => c.status === status);
  }
  
  await new Promise((resolve) => setTimeout(resolve, 500));
  return NextResponse.json(cameras);
}
