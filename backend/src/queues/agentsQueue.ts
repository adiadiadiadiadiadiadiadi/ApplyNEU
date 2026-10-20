// Queue created on first use rather than at import time.

import { Queue } from 'bullmq';
import { bullConnection } from './connection.ts';

export const AGENTS_QUEUE = 'agents';

/**
 * First in, first out, except that a resume the user just answered goes ahead of new starts.
 * BullMQ runs lower numbers first and keeps arrival order within a priority.
 */
export const AGENT_PRIORITY = { resume: 1, start: 2 } as const;

let queue: Queue | null = null;

export const getAgentsQueue = (): Queue =>
    (queue ??= new Queue(AGENTS_QUEUE, { connection: bullConnection }));
