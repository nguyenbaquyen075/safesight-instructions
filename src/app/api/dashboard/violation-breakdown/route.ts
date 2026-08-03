// SPDX-License-Identifier: MIT

import { NextResponse } from 'next/server';
import { mockViolationBreakdown } from '@/data/mock-dashboard';

export async function GET() {
  await new Promise((resolve) => setTimeout(resolve, 550));
  return NextResponse.json(mockViolationBreakdown);
}
