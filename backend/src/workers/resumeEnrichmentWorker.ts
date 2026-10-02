// Must load env before any import below that reads process.env at module load
// time (the pg Pool in db/index.ts and the Anthropic client in ai.resume.service.ts).
import 'dotenv/config';
import { UnrecoverableError, Worker } from 'bullmq';
import { getSearchTerms } from '../services/user/user.ai.service.ts';
import { setEnrichmentStatus } from '../services/resume/resume.service.ts';
import { bullConnection } from '../queues/connection.ts';
import { AppError } from '../errors/AppError.ts';

const worker = new Worker('resume-enrichment', async (job) => {
    const { resume_id } = job.data;
    const start = Date.now();
    console.log(`[resume-enrichment] job ${job.id} started (resume_id=${resume_id}) at ${new Date(start).toISOString()}`);
    try {
        await Promise.all([
            getSearchTerms(resume_id),
        ]);
        console.log(`[resume-enrichment] job ${job.id} finished (resume_id=${resume_id}) in ${Date.now() - start}ms`);
    } catch (err) {
        console.error(`[resume-enrichment] job ${job.id} threw (resume_id=${resume_id}) after ${Date.now() - start}ms`, err);
        // A missing resume (deleted, or saved without text) will be missing on every retry too.
        if (err instanceof AppError && err.status === 404) throw new UnrecoverableError(err.message);
        throw err;
    }
}, {
    connection: bullConnection,
    concurrency: 5,
});

worker.on('failed', async (job, err) => {
    console.error(`[resume-enrichment] job ${job?.id} failed:`, err);
    if (!job) return;
    const retriesLeft = job.attemptsMade < (job.opts.attempts ?? 1);
    if (retriesLeft && !(err instanceof UnrecoverableError)) return;
    try {
        await setEnrichmentStatus(job.data.resume_id, 'failed');
    } catch (statusErr) {
        console.error(`[resume-enrichment] could not mark resume_id=${job.data.resume_id} failed:`, statusErr);
    }
});