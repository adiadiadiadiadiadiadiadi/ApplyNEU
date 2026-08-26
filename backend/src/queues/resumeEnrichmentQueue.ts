// src/queues/resumeEnrichmentQueue.ts
// Queue created on first use rather than at import time.

import { Queue } from 'bullmq';
import { bullConnection } from './connection.ts';

let queue: Queue | null = null;

export const getResumeEnrichmentQueue = (): Queue =>
    (queue ??= new Queue('resume-enrichment', { connection: bullConnection }));
