// Queue created on first use rather than at import time.

import { Queue } from 'bullmq';
import { bullConnection } from './connection.ts';

export const AGENTS_QUEUE = 'agents';

/**
 * BullMQ runs lower numbers first. A resume the user just answered beats a run they started,
 * which beats a run the sweep started. Run-now moves a job to 0, which BullMQ treats as
 * unprioritized and processes before every prioritized job.
 */
export const AGENT_PRIORITY = { resume: 1, user: 2, sweep: 3 } as const;

let queue: Queue | null = null;

export const getAgentsQueue = (): Queue =>
    (queue ??= new Queue(AGENTS_QUEUE, { connection: bullConnection }));
