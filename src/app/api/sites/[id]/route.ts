// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { mockSites } from '@/data/mock-sites';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const site = mockSites.find(s => s.id === id);
  
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }
  
  await new Promise((resolve) => setTimeout(resolve, 300));
  return NextResponse.json(site);
}
