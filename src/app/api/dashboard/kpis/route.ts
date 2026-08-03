// SPDX-License-Identifier: MIT

import { NextResponse } from 'next/server';
import { mockDashboardKPIs } from '@/data/mock-dashboard';

export async function GET() {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 500));
  
  return NextResponse.json(mockDashboardKPIs);
}
