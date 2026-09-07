// SPDX-License-Identifier: MIT
import type { LeasedTask } from '../lib/tasks';
import { newSessionId } from '../lib/audit';
import { runSweep, runProbe } from './sweep';
import { runCleanup } from './cleanup';

export type DirectHandler = (task: LeasedTask) => Promise<string>;
export const directHandlers: Record<string, DirectHandler> = {
  'health.sweep': runSweep,
  'health.probe': runProbe,
  'snapshot.cleanup': (task) => runCleanup(task, newSessionId()),
};

export async function runDirect(task: LeasedTask): Promise<string> {
  const handler = directHandlers[task.kind];
  if (!handler) return `chưa có handler cho ${task.kind}`;
  return handler(task);
}
