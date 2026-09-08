// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventSummary, toChatItems } from '@/lib/chat-shape';
import type { AgentEventView } from '@/types/agent';

// Phần thuần cho widget chat với agent: đổi AgentEvent của một phiên hỏi đáp thành các
// bong bóng (user / assistant) và dòng hệ thống (verdict, action, lỗi, phiên bị bỏ qua).

function ev(type: string, data: Record<string, unknown>, id = type): AgentEventView {
  return { id, sessionId: 's1', taskId: null, subjectType: 'system', subjectId: null, type, data, emittedAt: '2026-09-08T08:00:00.000Z' };
}

test('toChatItems maps user and assistant messages to bubbles in order', () => {
  const items = toChatItems([ev('message.user', { text: 'cam-003 hôm nay có gì?' }, 'a'), ev('message.assistant', { text: 'Không có vi phạm mới.' }, 'b')]);
  assert.deepEqual(items.map(i => [i.id, i.role, i.text]), [['a', 'user', 'cam-003 hôm nay có gì?'], ['b', 'assistant', 'Không có vi phạm mới.']]);
});

test('toChatItems keeps verdict, action and error as system lines and drops the rest', () => {
  const items = toChatItems([
    ev('session.started', { kind: 'ask' }),
    ev('tool.call', { tool: 'read_violation' }),
    ev('verdict', { band: 'VERIFIED', verdict: 'violation', note: 'thiếu mũ' }),
    ev('action', { action: 'escalate' }),
    ev('error', { message: 'LLM timeout' }),
    ev('session.ended', { stop: 'end_turn' }),
  ]);
  assert.deepEqual(items.map(i => [i.role, i.tone, i.text]), [
    ['system', 'muted', 'VERIFIED · violation · thiếu mũ'],
    ['system', 'muted', 'escalate'],
    ['system', 'danger', 'LLM timeout'],
  ]);
});

test('toChatItems surfaces a skipped session as the explanation the asker sees', () => {
  const items = toChatItems([ev('session.ended', { stop: 'skipped', reason: 'subagent camera cam-003 đang tắt' })]);
  assert.deepEqual(items.map(i => [i.role, i.tone, i.text]), [['system', 'danger', 'Không chạy được: subagent camera cam-003 đang tắt']]);
});

test('toChatItems falls back to note for assistant messages without text and drops empty ones', () => {
  const items = toChatItems([ev('message.assistant', { note: 'ghi chú' }, 'n'), ev('message.assistant', {}, 'e')]);
  assert.deepEqual(items.map(i => [i.id, i.text]), [['n', 'ghi chú']]);
});

test('eventSummary renders the timeline text for each event type', () => {
  assert.equal(eventSummary(ev('tool.call', { tool: 'read_violation' })), 'gọi read_violation');
  assert.equal(eventSummary(ev('health', { code: 'ENGINE_DOWN' })), 'ENGINE_DOWN');
  assert.equal(eventSummary(ev('message.user', { text: 'hi' })), '👤 hi');
  assert.equal(eventSummary(ev('session.ended', { stop: 'end_turn' })), 'kết thúc (end_turn)');
  assert.equal(eventSummary(ev('custom.type', {})), 'custom.type');
});
