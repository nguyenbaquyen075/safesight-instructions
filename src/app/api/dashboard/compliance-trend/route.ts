// SPDX-License-Identifier: MIT

import { NextResponse } from 'next/server';
import { mockComplianceTrend } from '@/data/mock-dashboard';

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 600));
  return NextResponse.json(mockComplianceTrend);
}
