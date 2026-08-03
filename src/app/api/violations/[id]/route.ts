// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { mockViolations } from '@/data/mock-violations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const violation = mockViolations.find(v => v.id === id);
  
  if (!violation) {
    return NextResponse.json({ error: 'Violation not found' }, { status: 404 });
  }
  
  await new Promise((resolve) => setTimeout(resolve, 300));
  return NextResponse.json(violation);
}
