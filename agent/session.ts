// SPDX-License-Identifier: MIT
import Anthropic from '@anthropic-ai/sdk';
import { env } from './lib/env';
import { prisma } from './lib/db';
import { emit, newSessionId } from './lib/audit';
import { getAgentSettings } from './lib/settings';
import { claudeLatchedOff, latchClaudeOff } from './lib/guard';
import { systemBlocks } from './lib/prompt';
import { preambleFor } from './lib/preamble';
import { toolsFor } from './lib/toolsets';
import { newToolContext } from './lib/tool-context';
import { dailyTokensUsed } from './lib/usage';
import { addCameraTokens, cameraIdOf, getCameraAgent, parseMemory, type CameraMemoryNote } from './lib/camera-agent';
import { openAiClient } from './lib/llm/openai';
import type { LeasedTask } from './lib/tasks';

// Kiểu chung của mọi provider nằm ở lib/llm/types; re-export để nơi gọi cũ vẫn import từ '../session'.
export type { RunParams, Turn, SessionClient } from './lib/llm/types';
import type { SessionClient, Turn } from './lib/llm/types';

export class SessionError extends Error {
  retryAfterMs: number | null;
  fatal: boolean;
  // Phiên thật sự đã chạy khi lỗi xảy ra — runSession trỏ task sang sessionId mới mỗi lần thử,
  // nên task.sessionId ở main.ts là của lần TRƯỚC; gắn ở đây để event lỗi vào đúng thread.
  sessionId?: string;
  // Lỗi "không phải lỗi của task" (chạm trần token): trả lại lượt để task không bị retire oan sau 3 ngày chạm trần.
  refundAttempt: boolean;
  constructor(message: string, retryAfterMs: number | null, fatal: boolean, refundAttempt = false) {
    super(message);
    this.retryAfterMs = retryAfterMs;
    this.fatal = fatal;
    this.refundAttempt = refundAttempt;
  }
}

// Trần token tính theo ngày địa phương: hẹn lại đúng lúc qua nửa đêm (tối thiểu 1 phút để không quay vòng nóng).
export function msUntilMidnight(now = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(60_000, next.getTime() - now.getTime());
}

// Lớp mỏng bọc SDK: mọi thứ Anthropic-specific ở đây, để phần còn lại test được bằng client giả.
export function anthropicClient(): SessionClient {
  // LLM_BASE_URL/ANTHROPIC_BASE_URL cũng phải áp cho SDK: proxy định dạng Anthropic dùng chung biến này.
  const client = new Anthropic({ apiKey: env.llmKey, baseURL: env.llmBaseUrl ?? undefined });
  return {
    async *run(p) {
      const runner = client.beta.messages.toolRunner({
        model: p.model, max_tokens: 16000,
        thinking: { type: 'adaptive' }, output_config: { effort: p.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max' },
        system: p.system, tools: p.tools as never, messages: p.messages as never,
        max_iterations: p.maxIterations,
      });
      for await (const message of runner) yield message as unknown as Turn;
    },
  };
}

export function mapError(error: unknown): SessionError {
  if (error instanceof Anthropic.RateLimitError) return new SessionError('429: quá giới hạn Claude', 60_000, false);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) { latchClaudeOff(error.message); return new SessionError(`Claude từ chối request: ${error.message}`, null, true); }
  if (error instanceof Anthropic.BadRequestError) return new SessionError(`Claude từ chối request: ${error.message}`, null, true);
  if (error instanceof Anthropic.APIConnectionError) return new SessionError('không nối được Claude', 30_000, false);
  if (error instanceof Anthropic.APIError) return new SessionError(`Claude lỗi ${error.status}: ${error.message}`, 60_000, false);
  return new SessionError(error instanceof Error ? error.message : String(error), 30_000, false);
}

export async function runSession(task: LeasedTask, opts: { userMessage?: string; sessionId?: string; client?: SessionClient } = {}): Promise<string> {
  const sessionId = opts.sessionId ?? newSessionId();
  // Panel hỏi-đáp poll tới khi thấy session.ended: lối ra sớm cũng phải phát event kèm lý do, nếu không panel quay mãi.
  const skipped = async (reason: string): Promise<string> => {
    await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'session.ended', data: { stop: 'skipped', reason } });
    return reason;
  };
  const settings = await getAgentSettings();
  if (!settings.isEnabled) return skipped('agent đang tạm dừng');
  const off = claudeLatchedOff();
  if (off) return skipped(`Claude bị tắt tới lần khởi động sau: ${off}`);
  if (!opts.client && !env.llmKey) return skipped(`không có ${env.llmProvider === 'openai' ? 'LLM_API_KEY' : 'ANTHROPIC_API_KEY'} — lane nghiên cứu tạm dừng`);
  // Chạm trần: hoàn lượt (refundAttempt) và hẹn lại sau nửa đêm, không tiêu lần thử của task.
  // Vẫn phải phát session.ended trước khi throw — panel hỏi-đáp poll theo sessionId và chỉ dừng khi thấy event này.
  if ((await dailyTokensUsed()) >= settings.dailyTokenCap) {
    const reason = 'đã chạm trần token trong ngày';
    const retryAfterMs = msUntilMidnight();
    await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'session.ended', data: { stop: 'skipped', reason, retryAfterMs } });
    throw new SessionError(reason, retryAfterMs, false, true);
  }

  // Trần toàn cục thắng trước; sau đó mới tới subagent của camera (tắt riêng / trần token riêng).
  const cameraId = await cameraIdOf(task);
  let memory: CameraMemoryNote[] = [];
  if (cameraId) {
    const cameraAgent = await getCameraAgent(cameraId);
    if (!cameraAgent.isEnabled) return skipped(`subagent camera ${cameraId} đang tắt`);
    if (cameraAgent.tokensUsedToday >= cameraAgent.dailyTokenCap) {
      const reason = 'camera đã chạm trần token trong ngày';
      const retryAfterMs = msUntilMidnight();
      await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'session.ended', data: { stop: 'skipped', reason, retryAfterMs } });
      throw new SessionError(reason, retryAfterMs, false, true);
    }
    memory = parseMemory(cameraAgent.memory);
  }

  await prisma.agentTask.updateMany({ where: { id: task.id, finishedAt: null }, data: { sessionId } });
  const ctx = newToolContext(task, sessionId, cameraId);
  const effort = task.kind === 'shift.report' || task.kind === 'weekly.report' ? 'high' : settings.reviewEffort;
  const client = opts.client ?? (env.llmProvider === 'openai' ? openAiClient() : anthropicClient());
  const messages = [{ role: 'user', content: await preambleFor(task, { userMessage: opts.userMessage, sessionId, cameraId, memory }) }];
  await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'session.started', data: { kind: task.kind, model: settings.model, effort, budget: task.budget, cameraId, workerId: env.workerId } });

  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
  let finalText = ''; let stop: string | null = null;
  try {
    for await (const turn of client.run({ model: settings.model, effort, system: await systemBlocks(), tools: toolsFor(task.kind, ctx), messages, maxIterations: task.budget + 2 })) {
      usage.input_tokens += turn.usage.input_tokens; usage.output_tokens += turn.usage.output_tokens; usage.cache_read_input_tokens += turn.usage.cache_read_input_tokens ?? 0;
      stop = turn.stop_reason;
      const texts = (turn.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text' && b.text).map(b => b.text as string);
      if (texts.length) { finalText = texts.join('\n'); await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'message.assistant', data: { text: finalText } }); }
    }
  } catch (error) {
    const mapped = mapError(error);
    mapped.sessionId = sessionId;
    await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'error', data: { message: mapped.message, fatal: mapped.fatal } });
    await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'session.ended', data: { usage, stop: 'error' } });
    throw mapped;
  } finally {
    // Token đã tiêu là đã tiêu: cộng cả khi phiên lỗi giữa chừng, nếu không camera có thể chạy vượt trần.
    // Lỗi ở đây (DB khoá) không được thay thế SessionError đang bay ra từ catch — chỉ cảnh báo.
    if (cameraId) {
      try {
        await addCameraTokens(cameraId, usage.input_tokens + usage.output_tokens);
      } catch (error) {
        console.warn('[agent] không cộng được token cho camera', cameraId, error instanceof Error ? error.message : String(error));
      }
    }
  }
  if (stop === 'refusal') finalText = 'Claude từ chối lượt này (stop_reason=refusal); không có phán quyết.';
  if (stop === 'max_tokens') finalText = finalText ? `${finalText}\n(kết luận bị cắt vì max_tokens)` : '(kết luận bị cắt vì max_tokens)';
  await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'session.ended', data: { usage, stop, calls: ctx.spent.calls } });
  // Bản báo cáo tuần được ghi thành event riêng để trang /reports đọc lại được bằng
  // GET /api/agent/events?type=report, không phải lọc trong đống message.assistant.
  if (task.kind === 'weekly.report' && finalText) {
    await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'report', data: { text: finalText } });
  }
  return finalText || `phiên kết thúc (${stop ?? 'không rõ'}) không có kết luận`;
}
