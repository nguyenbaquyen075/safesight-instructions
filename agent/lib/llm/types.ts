// SPDX-License-Identifier: MIT
import type { systemBlocks } from '../prompt';

export interface RunParams { model: string; effort: string; system: Awaited<ReturnType<typeof systemBlocks>>; tools: unknown[]; messages: unknown[]; maxIterations: number }
export interface Turn { content: unknown[]; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null }; stop_reason: string | null }
export interface SessionClient { run(params: RunParams): AsyncIterable<Turn> }
