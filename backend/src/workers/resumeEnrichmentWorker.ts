// Must load env before any import below that reads process.env at module load
// time (the pg Pool in db/index.ts and the Anthropic client in ai.resume.service.ts).
import 'dotenv/config';
import { Worker } from 'bullmq';
import { getSearchTerms } from '../services/user/user.ai.service.ts';
import { cacheShortResume } from '../services/resume/ai.resume.service.ts';
import { bullConnection } from '../queues/connection.ts';

const worker = new Worker('resume-enrichment', async (job) => {
    const { resume_id } = job.data;
    const start = Date.now();
    console.log(`[resume-enrichment] job ${job.id} started (resume_id=${resume_id}) at ${new Date(start).toISOString()}`);
    try {
        await Promise.all([
            getSearchTerms(resume_id),
            cacheShortResume(resume_id)
        ]);
        console.log(`[resume-enrichment] job ${job.id} finished (resume_id=${resume_id}) in ${Date.now() - start}ms`);
    } catch (err) {
        console.error(`[resume-enrichment] job ${job.id} threw (resume_id=${resume_id}) after ${Date.now() - start}ms`, err);
        throw err;
    }
}, {
    connection: bullConnection,
    concurrency: 5,
});

worker.on('failed', (job, err) => {
    console.error(`[resume-enrichment] job ${job?.id} failed:`, err);
});