// SPDX-License-Identifier: MIT

import type { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';

interface LogAuditInput {
  session: Session;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  /** Dùng để lấy IP; chấp cả NextRequest lẫn Request thô. */
  request?: { headers: Headers };
}

/**
 * Ghi 1 dòng AuditLog cho các thao tác ghi (POST/PATCH/DELETE) đáng chú ý:
 * người dùng, camera, quy tắc cảnh báo, cài đặt Telegram/agent (spec F8).
 * Không bao giờ throw — audit log hỏng không được làm hỏng thao tác chính
 * đã thực hiện xong.
 */
export async function logAudit({ session, action, resource, resourceId, details, request }: LogAuditInput): Promise<void> {
  try {
    const forwardedFor = request?.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 'local';
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        userName: session.user.name ?? session.user.email ?? session.user.id,
        action,
        resource,
        resourceId,
        details,
        ipAddress,
      },
    });
  } catch (err) {
    console.warn('[audit-log] ghi thất bại:', err instanceof Error ? err.message : String(err));
  }
}
