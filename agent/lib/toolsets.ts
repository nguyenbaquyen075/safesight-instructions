// SPDX-License-Identifier: MIT
import type { ToolContext } from './tool-context';
import { makeReadViolation } from '../tools/read_violation';
import { makeReadCameraHistory } from '../tools/read_camera_history';
import { makeReadSiteContext } from '../tools/read_site_context';
import { makeSearchViolations } from '../tools/search_violations';
import { makeReadSystemHealth } from '../tools/read_system_health';
import { makeReadAgentActivity } from '../tools/read_agent_activity';
import { makeRecordVerdict } from '../tools/record_verdict';
import { makeEscalate } from '../tools/escalate';
import { makeScheduleFollowup } from '../tools/schedule_followup';
import { makeWriteNote } from '../tools/write_note';
import { makeRememberCamera } from '../tools/remember_camera';
import { makeListCameraAgents } from '../tools/list_camera_agents';
import { makeDispatchToCamera } from '../tools/dispatch_to_camera';

// Phiên thuộc một camera thì có thêm remember_camera ở CUỐI bộ tool: thứ tự các tool trước đó
// không đổi nên prompt cache vẫn dùng lại được giữa các phiên cùng kind cùng loại chủ thể.
export function toolsFor(kind: string, ctx: ToolContext) {
  const tools = toolsForKind(kind, ctx);
  return ctx.cameraId ? [...tools, makeRememberCamera(ctx)] : tools;
}

// Bộ tool CỐ ĐỊNH theo kind (thứ tự ổn định) để prompt cache không vỡ giữa các phiên cùng kind.
function toolsForKind(kind: string, ctx: ToolContext) {
  const reads = [makeReadViolation(ctx), makeReadCameraHistory(ctx), makeReadSiteContext(ctx), makeSearchViolations(ctx), makeReadSystemHealth(ctx)];
  // Điều phối subagent (list + dispatch) chỉ cho các kind toàn hệ thống, thêm ở CUỐI để không đổi thứ tự tool cũ.
  const orchestration = [makeListCameraAgents(ctx), makeDispatchToCamera(ctx)];
  switch (kind) {
    case 'violation.review': return [...reads, makeRecordVerdict(ctx), makeEscalate(ctx), makeScheduleFollowup(ctx), makeWriteNote(ctx)];
    case 'followup': return [...reads, makeRecordVerdict(ctx), makeEscalate(ctx), makeScheduleFollowup(ctx), makeWriteNote(ctx)];
    case 'camera.digest': return [...reads, makeScheduleFollowup(ctx), makeWriteNote(ctx), makeEscalate(ctx)];
    case 'camera.instruction': return [...reads, makeScheduleFollowup(ctx), makeWriteNote(ctx), makeEscalate(ctx)];
    case 'shift.report': return [...reads, makeReadAgentActivity(ctx), makeWriteNote(ctx), makeEscalate(ctx), ...orchestration];
    case 'weekly.report': return [...reads, makeReadAgentActivity(ctx), makeWriteNote(ctx), makeEscalate(ctx), ...orchestration];
    case 'ops.escalate': return [...reads, makeReadAgentActivity(ctx), makeEscalate(ctx), makeWriteNote(ctx), ...orchestration];
    case 'ask': return [...reads, makeReadAgentActivity(ctx), makeRecordVerdict(ctx), makeEscalate(ctx), makeScheduleFollowup(ctx), makeWriteNote(ctx), ...orchestration];
    default: return reads;
  }
}
