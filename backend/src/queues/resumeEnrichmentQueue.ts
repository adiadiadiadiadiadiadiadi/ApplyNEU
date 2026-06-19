// src/queues/resumeEnrichmentQueue.ts
import { Queue } from 'bullmq';
import { bullConnection } from './connection.ts';

export const resumeEnrichmentQueue = new Queue('resume-enrichment', {
    connection: bullConnection,
});
