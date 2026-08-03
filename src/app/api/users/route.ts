// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { mockUsers } from '@/data/mock-users';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const role = searchParams.get('role');
  
  let users = [...mockUsers];
  
  if (role) {
    users = users.filter(u => u.role === role);
  }
  
  await new Promise((resolve) => setTimeout(resolve, 500));
  return NextResponse.json(users);
}
