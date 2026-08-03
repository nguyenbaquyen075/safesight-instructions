// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { mockUsers } from '@/data/mock-users';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = mockUsers.find(u => u.id === id);
  
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  
  await new Promise((resolve) => setTimeout(resolve, 300));
  return NextResponse.json(user);
}
