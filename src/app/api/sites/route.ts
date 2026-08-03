// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { mockSites } from '@/data/mock-sites';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  
  let sites = [...mockSites];
  
  if (status) {
    sites = sites.filter(s => s.status === status);
  }
  
  await new Promise((resolve) => setTimeout(resolve, 500));
  return NextResponse.json(sites);
}
