// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { mockCameras } from '@/data/mock-cameras';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const camera = mockCameras.find(c => c.id === id);
  
  if (!camera) {
    return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
  }
  
  await new Promise((resolve) => setTimeout(resolve, 300));
  return NextResponse.json(camera);
}
