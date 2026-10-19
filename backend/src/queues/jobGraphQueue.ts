// Queue created on first use rather than at import time.

import { Queue } from 'bullmq';
import { bullConnection } from './connection.ts';

let queue: Queue | null = null;

export const getJobGraphQueue = (): Queue =>
    (queue ??= new Queue('job-enqueue', { connection: bullConnection }));
