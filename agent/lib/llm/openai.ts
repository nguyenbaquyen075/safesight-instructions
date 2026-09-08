// SPDX-License-Identifier: MIT
import * as z from 'zod/v4';
import { env } from '../env';
import type { SessionClient, Turn } from './types';

// Lỗi HTTP từ endpoint tương thích OpenAI — session.ts ánh xạ status sang SessionError.
export class LlmHttpError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`LLM HTTP ${status}: ${body.slice(0, 300)}`);
    this.status = status;
    this.body = body;
  }
}

// Hình dạng tool do betaZodTool sinh ra (xem @anthropic-ai/sdk/helpers/beta/zod).
interface RunnableTool {
  name: string;
  description?: string;
  input_schema?: Record<string, unknown>;
  inputSchema?: z.ZodType;
  parse?: (args: unknown) => unknown;
  run: (args: never) => unknown;
}

interface ToolCall { id: string; function: { name: string; arguments: string } }
interface ChatMessage { role: string; content: unknown; tool_calls?: ToolCall[]; tool_call_id?: string }
interface ChatResponse {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function toFunctionTool(tool: RunnableTool) {
  const schema = tool.input_schema ?? (tool.inputSchema ? z.toJSONSchema(tool.inputSchema) : { type: 'object', properties: {} });
  // $schema là siêu dữ liệu của JSON Schema, một số proxy từ chối tham số lạ.
  const parameters = { ...schema } as Record<string, unknown>;
  delete parameters.$schema;
  return { type: 'function' as const, function: { name: tool.name, description: tool.description ?? '', parameters } };
}

// stop_reason của Anthropic là hợp đồng mà runSession đang đọc; quy đổi finish_reason về đó.
function mapFinish(reason: string | null | undefined): string | null {
  switch (reason) {
    case 'tool_calls': return 'tool_use';
    case 'stop': return 'end_turn';
    case 'length': return 'max_tokens';
    case 'content_filter': return 'refusal';
    default: return reason ?? null;
  }
}

// Kết quả tool có thể là chuỗi hoặc mảng content block kiểu Anthropic: gộp text, tách ảnh ra tin nhắn riêng.
function toolResultText(result: unknown, imageInput: boolean, images: ChatMessage[]): string {
  if (typeof result === 'string') return result;
  if (!Array.isArray(result)) return JSON.stringify(result);
  const texts: string[] = [];
  for (const block of result as Array<{ type: string; text?: string; source?: { media_type?: string; data?: string } }>) {
    if (block.type === 'text' && block.text) texts.push(block.text);
    else if (block.type === 'image' && imageInput && block.source?.data) {
      images.push({
        role: 'user',
        content: [
          { type: 'text', text: '(ảnh từ tool)' },
          { type: 'image_url', image_url: { url: `data:${block.source.media_type ?? 'image/jpeg'};base64,${block.source.data}` } },
        ],
      });
    }
  }
  return texts.join('\n') || '(kết quả không có phần văn bản)';
}

// Vòng lặp agentic tối thiểu trên POST /chat/completions — không thêm dependency, không gửi field riêng của Anthropic.
export function openAiClient(override: { baseUrl?: string; apiKey?: string | null; imageInput?: boolean } = {}): SessionClient {
  const baseUrl = (override.baseUrl ?? env.llmBaseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiKey = override.apiKey ?? env.llmKey;
  const imageInput = override.imageInput ?? env.llmImageInput;
  return {
    async *run(p): AsyncGenerator<Turn> {
      const runnables = p.tools as RunnableTool[];
      const byName = new Map(runnables.map(t => [t.name, t]));
      const tools = runnables.map(toFunctionTool);
      const messages: ChatMessage[] = [
        { role: 'system', content: p.system.map(b => b.text).join('\n\n') },
        ...(p.messages as Array<{ role: string; content: unknown }>).map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      ];

      for (let i = 0; i < p.maxIterations; i++) {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey ?? ''}` },
          body: JSON.stringify({ model: p.model, messages, tools, tool_choice: 'auto', max_tokens: 4096 }),
        });
        if (!res.ok) throw new LlmHttpError(res.status, await res.text().catch(() => ''));
        const data = await res.json() as ChatResponse;
        const choice = data.choices?.[0];
        const text = choice?.message?.content ?? '';
        const calls = choice?.message?.tool_calls ?? [];

        yield {
          content: [
            ...(text ? [{ type: 'text', text }] : []),
            ...calls.map(c => ({ type: 'tool_use', id: c.id, name: c.function.name, input: c.function.arguments })),
          ],
          usage: { input_tokens: data.usage?.prompt_tokens ?? 0, output_tokens: data.usage?.completion_tokens ?? 0 },
          stop_reason: mapFinish(choice?.finish_reason),
        };
        if (!calls.length) return;

        messages.push({ role: 'assistant', content: text || null, tool_calls: calls });
        const images: ChatMessage[] = [];
        for (const call of calls) {
          const tool = byName.get(call.function.name);
          let content: string;
          if (!tool) content = `không có tool tên ${call.function.name}`;
          else {
            try {
              const parsed = JSON.parse(call.function.arguments || '{}');
              content = toolResultText(await tool.run((tool.parse ? tool.parse(parsed) : parsed) as never), imageInput, images);
            } catch (error) {
              content = `lỗi tool ${call.function.name}: ${error instanceof Error ? error.message : String(error)}`;
            }
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content });
        }
        messages.push(...images);
      }
    },
  };
}
