// SPDX-License-Identifier: MIT
import Anthropic from '@anthropic-ai/sdk';
import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool';
import { env } from '../env';
import type { SessionClient, Turn } from './types';

// Mọi tool ở đây đều do betaZodTool sinh ra, nên input_schema/description/parse luôn có —
// giao kiểu union tool của SDK với hình dạng đó để khỏi phải bóc từng nhánh.
type ZodRunnableTool = BetaRunnableTool & { description?: string; input_schema: Record<string, unknown> };

interface ToolCall { id: string; function: { name: string; arguments: string } }
interface ChatMessage { role: string; content: unknown; tool_calls?: ToolCall[]; tool_call_id?: string }
interface ChatResponse {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

function toFunctionTool(tool: ZodRunnableTool) {
  // $schema là siêu dữ liệu của JSON Schema, một số proxy từ chối tham số lạ.
  const parameters = { ...tool.input_schema };
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
export function openAiClient(override: { baseUrl?: string; apiKey?: string | null } = {}): SessionClient {
  const baseUrl = (override.baseUrl ?? env.llmBaseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  const apiKey = override.apiKey ?? env.llmKey;
  const imageInput = env.llmImageInput;
  return {
    async *run(p): AsyncGenerator<Turn> {
      const runnables = p.tools as ZodRunnableTool[];
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
        if (!res.ok) {
          // Ném đúng lớp lỗi của SDK để mapError (session.ts) xử lý 429/401/403/400/5xx như nhau
          // cho cả hai provider, không cần nhánh riêng.
          const raw = await res.text().catch(() => '');
          let parsedBody: unknown; try { parsedBody = JSON.parse(raw); } catch { parsedBody = undefined; }
          throw Anthropic.APIError.generate(res.status, parsedBody as object | undefined, `LLM HTTP ${res.status}: ${raw.slice(0, 300)}`, res.headers);
        }
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
              content = toolResultText(await tool.run(tool.parse(parsed)), imageInput, images);
            } catch (error) {
              content = `lỗi tool ${call.function.name}: ${error instanceof Error ? error.message : String(error)}`;
            }
          }
          messages.push({ role: 'tool', tool_call_id: call.id, content });
        }
        // Ảnh chỉ tải lên MỘT lần mỗi phiên: mỗi vòng gửi lại toàn bộ `messages`, giữ nguyên data URL
        // của các lượt trước là nhân đôi payload mỗi vòng. Thay bằng ghi chú, model vẫn biết đã thấy ảnh.
        if (images.length) {
          for (const m of messages) {
            if (!Array.isArray(m.content)) continue;
            m.content = (m.content as Array<{ type: string }>).map(part => part.type === 'image_url' ? { type: 'text', text: '(ảnh đã gửi ở lượt trước)' } : part);
          }
          messages.push(...images);
        }
      }
    },
  };
}
