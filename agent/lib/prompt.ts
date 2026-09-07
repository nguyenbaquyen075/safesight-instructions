// SPDX-License-Identifier: MIT
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'agent');
let cached: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> | null = null;

// Nội dung tĩnh (không timestamp) để prompt cache khớp giữa các phiên.
export async function systemBlocks() {
  if (cached) return cached;
  const instructions = await readFile(path.join(ROOT, 'instructions.md'), 'utf8');
  const names = (await readdir(path.join(ROOT, 'skills'))).filter(n => n.endsWith('.md')).sort();
  const skills = await Promise.all(names.map(async n => `<!-- skill: ${n} -->\n${await readFile(path.join(ROOT, 'skills', n), 'utf8')}`));
  cached = [
    { type: 'text', text: instructions },
    { type: 'text', text: skills.join('\n\n'), cache_control: { type: 'ephemeral' } },
  ];
  return cached;
}
