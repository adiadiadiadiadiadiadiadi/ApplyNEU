// Queue created on first use rather than at import time.

import { Queue } from 'bullmq';
import { bullConnection } from './connection.ts';

export const AGENTS_QUEUE = 'agents';

/**
 * BullMQ runs lower numbers first: a resume the user just answered, then a run the sweep is
 * blocked on (a cover letter NUWorks asks for), then a run the user started, then runs from the
 * router. Run-now moves a job to 0, which BullMQ treats as unprioritized and processes before
 * every prioritized job.
 */
export const AGENT_PRIORITY = { resume: 1, blocking: 2, user: 3, router: 4 } as const;

let queue: Queue | null = null;

export const getAgentsQueue = (): Queue =>
    (queue ??= new Queue(AGENTS_QUEUE, { connection: bullConnection }));
