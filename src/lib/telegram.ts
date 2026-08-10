// SPDX-License-Identifier: MIT

import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface TelegramResult {
  ok: boolean;
  description?: string;
  result?: unknown;
}

const BASE_URL = 'https://api.telegram.org';

async function callTelegram(botToken: string, method: string, init: RequestInit): Promise<TelegramResult> {
  let lastError = 'unknown error';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}/bot${botToken}/${method}`, { ...init, signal: AbortSignal.timeout(10_000) });
      const data = (await res.json()) as TelegramResult;
      if (!data.ok) {
        lastError = data.description || 'Telegram API trả lỗi không rõ';
        // 4xx (except 429 rate-limit) is a permanent failure — retrying won't help.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          return { ok: false, description: lastError };
        }
        continue;
      }
      return data;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, description: lastError };
}

export class TelegramClient {
  constructor(private botToken: string) {}

  getMe(): Promise<TelegramResult> {
    return callTelegram(this.botToken, 'getMe', { method: 'GET' });
  }

  sendMessage(chatId: string, text: string): Promise<TelegramResult> {
    return callTelegram(this.botToken, 'sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  }

  async sendPhoto(chatId: string, snapshotUrl: string, caption: string): Promise<TelegramResult> {
    const root = path.join(process.cwd(), 'public');
    const filePath = path.resolve(root, snapshotUrl.replace(/^\//, ''));
    if (!filePath.startsWith(root + path.sep)) {
      return { ok: false, description: 'Invalid snapshot path' };
    }
    const fileBuffer = await readFile(filePath);
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('parse_mode', 'HTML');
    form.append('photo', new Blob([fileBuffer]), path.basename(filePath));
    return callTelegram(this.botToken, 'sendPhoto', { method: 'POST', body: form });
  }
}
