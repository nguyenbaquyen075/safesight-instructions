// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { mockAlerts } from '@/data/mock-alerts';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');
  
  let alerts = [...mockAlerts];
  
  if (status) {
    alerts = alerts.filter(a => a.status === status);
  }
  if (channel) {
    alerts = alerts.filter(a => a.channel === channel);
  }
  
  await new Promise((resolve) => setTimeout(resolve, 600));
  return NextResponse.json(alerts);
}
