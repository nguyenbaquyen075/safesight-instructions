// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { openAiClient } from '../lib/llm/openai';
import { mapError } from '../session';
import type { RunParams, Turn } from '../session';

// Server giả: trả lần lượt các phản hồi đã xếp sẵn và ghi lại body của từng request.
async function stub(responses: Array<{ status?: number; body: unknown }>) {
  const bodies: Array<Record<string, unknown>> = [];
  let n = 0;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      bodies.push(JSON.parse(raw));
      const next = responses[Math.min(n++, responses.length - 1)];
      res.writeHead(next.status ?? 200, { 'content-type': 'application/json' });
      res.end(typeof next.body === 'string' ? next.body : JSON.stringify(next.body));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  return { bodies, port, close: () => new Promise<void>(resolve => { server.close(() => resolve()); }) };
}

const calls: unknown[] = [];
const fakeTool = betaZodTool({
  name: 'read_thing',
  description: 'Đọc một thứ',
  inputSchema: z.object({ thingId: z.string() }),
  run: async ({ thingId }) => { calls.push({ thingId }); return [{ type: 'text' as const, text: `thing ${thingId}` }]; },
});

function params(): RunParams {
  return {
    model: 'AHV-Holding-TroLy', effort: 'medium',
    system: [{ type: 'text', text: 'hướng dẫn' }],
    tools: [fakeTool], messages: [{ role: 'user', content: 'đọc thing-1 giúp' }], maxIterations: 5,
  };
}

async function collect(port: number): Promise<Turn[]> {
  const turns: Turn[] = [];
  for await (const turn of openAiClient({ baseUrl: `http://127.0.0.1:${port}`, apiKey: 'test' }).run(params())) turns.push(turn);
  return turns;
}

test('openAiClient runs the tool loop and yields the final turn with usage and a mapped stop_reason', async () => {
  calls.length = 0;
  const s = await stub([
    { body: { choices: [{ message: { content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'read_thing', arguments: '{"thingId":"thing-1"}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 100, completion_tokens: 10 } } },
    { body: { choices: [{ message: { content: 'Xong.' }, finish_reason: 'stop' }], usage: { prompt_tokens: 200, completion_tokens: 20 } } },
  ]);
  try {
    const turns = await collect(s.port);
    assert.deepEqual(calls, [{ thingId: 'thing-1' }]);
    assert.deepEqual(turns.map(t => t.stop_reason), ['tool_use', 'end_turn']);
    assert.deepEqual(turns.map(t => t.usage.input_tokens), [100, 200]);
    assert.deepEqual(turns.map(t => t.usage.output_tokens), [10, 20]);
    assert.deepEqual(turns[1].content, [{ type: 'text', text: 'Xong.' }]);

    const first = s.bodies[0] as { tools: Array<{ type: string; function: { name: string; parameters: Record<string, unknown> } }>; thinking?: unknown; tool_choice: string };
    assert.equal(first.tools[0].type, 'function');
    assert.equal(first.tools[0].function.name, 'read_thing');
    assert.deepEqual(first.tools[0].function.parameters.required, ['thingId']);
    assert.equal(first.tool_choice, 'auto');
    assert.equal('thinking' in first, false);
    assert.equal('output_config' in first, false);

    // Lượt hai phải mang kết quả tool về dưới dạng message role 'tool'.
    const second = s.bodies[1] as { messages: Array<{ role: string; content: unknown; tool_call_id?: string }> };
    const toolMessage = second.messages.find(m => m.role === 'tool');
    assert.deepEqual([toolMessage?.tool_call_id, toolMessage?.content], ['call_1', 'thing thing-1']);
  } finally { await s.close(); }
});

// Lỗi ném ra từ vòng lặp (thay vì để assert.rejects nuốt) — cần chính đối tượng lỗi để map tiếp.
async function rejection(port: number): Promise<unknown> {
  return collect(port).then(() => new Error('không có lỗi nào được ném'), (e: unknown) => e);
}

test('an HTTP error becomes the matching SDK error: 429 waits 60s, 401 is fatal', async () => {
  const rate = await stub([{ status: 429, body: 'too many' }]);
  try {
    const error = await rejection(rate.port);
    assert.ok(error instanceof Anthropic.RateLimitError, 'phải là RateLimitError của SDK');
    const mapped = mapError(error);
    assert.equal(mapped.retryAfterMs, 60_000);
    assert.equal(mapped.fatal, false);
  } finally { await rate.close(); }

  const denied = await stub([{ status: 401, body: 'bad key' }]);
  try {
    const error = await rejection(denied.port);
    assert.ok(error instanceof Anthropic.AuthenticationError, 'phải là AuthenticationError của SDK');
    const mapped = mapError(error);
    assert.equal(mapped.fatal, true);
    assert.equal(mapped.retryAfterMs, null);
  } finally { await denied.close(); }
});
