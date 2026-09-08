// SPDX-License-Identifier: MIT
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'agent');
let cached: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> | null = null;

// Frontmatter dạng `---\nname: ...\ndescription: ...\n---\n<nội dung>`.
function parseSkill(dirName: string, raw: string): { name: string; description: string; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { name: dirName, description: '', body: raw };
  const [, frontmatter, body] = match;
  const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? dirName;
  const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  return { name, description, body: body.trimStart() };
}

// Nội dung tĩnh (không timestamp) để prompt cache khớp giữa các phiên.
export async function systemBlocks() {
  if (cached) return cached;
  const instructions = await readFile(path.join(ROOT, 'instructions.md'), 'utf8');
  const dirs = (await readdir(path.join(ROOT, 'skills'), { withFileTypes: true }))
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();
  const skills = await Promise.all(dirs.map(async dir => {
    const raw = await readFile(path.join(ROOT, 'skills', dir, 'SKILL.md'), 'utf8');
    return parseSkill(dir, raw);
  }));
  const index = ['| Skill | Use when |', '|---|---|', ...skills.map(s => `| ${s.name} | ${s.description} |`)].join('\n');
  const skillsText = [index, ...skills.map(s => `<!-- skill: ${s.name} -->\n${s.body}`)].join('\n\n');
  cached = [
    { type: 'text', text: instructions },
    { type: 'text', text: skillsText, cache_control: { type: 'ephemeral' } },
  ];
  return cached;
}
