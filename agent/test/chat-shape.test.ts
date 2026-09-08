// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { askProgress, eventSummary, toChatItems } from '@/lib/chat-shape';
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

// Trạng thái chờ của một lượt hỏi: đã gửi, chưa thấy session.ended sau lúc gửi, chưa im lặng quá 90s.
test('askProgress reports working until a session.ended after the send or 90s of silence', () => {
  const sentAt = Date.parse('2026-09-08T08:00:00.000Z');
  const at = (s: string) => Date.parse(s);
  const endedBefore = { ...ev('session.ended', { stop: 'end_turn' }), emittedAt: '2026-09-08T07:59:00.000Z' };
  const endedAfter = { ...ev('session.ended', { stop: 'end_turn' }), emittedAt: '2026-09-08T08:00:30.000Z' };
  assert.deepEqual(askProgress({ sentAt: null, events: [], now: at('2026-09-08T08:00:10.000Z') }), { ended: false, working: false });
  assert.deepEqual(askProgress({ sentAt, events: [endedBefore], now: at('2026-09-08T08:00:10.000Z') }), { ended: false, working: true });
  assert.deepEqual(askProgress({ sentAt, events: [endedAfter], now: at('2026-09-08T08:00:40.000Z') }), { ended: true, working: false });
  assert.deepEqual(askProgress({ sentAt, events: [], now: sentAt + 89_999 }), { ended: false, working: true });
  assert.deepEqual(askProgress({ sentAt, events: [], now: sentAt + 90_000 }), { ended: false, working: false });
});
