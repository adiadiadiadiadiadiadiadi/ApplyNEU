// Must load env before any import below that reads process.env at module load
// time (the pg Pool in db/index.ts and the Anthropic client in jobMatch.agent.ts).
import 'dotenv/config';
import { Worker } from 'bullmq';
import { Command } from '@langchain/langgraph';
import { jobGraph } from '../agents/jobGraph/graph.ts';
import { bullConnection } from '../queues/connection.ts';
import { pool } from '../db/index.ts';
import { onShutdownSignal, runShutdown } from '../utils/shutdown.ts';

/**
 * Resumes paused job threads enqueued by resumeJobThread. The value is handed to the node that
 * paused, as the return value of its interrupt() call.
 */
const worker = new Worker('job-enqueue', async (job) => {
    const { thread_id, value } = job.data;
    const start = Date.now();
    console.log(`[job-enqueue] job ${job.id} resuming thread_id=${thread_id}`);
    try {
        await jobGraph.invoke(new Command({ resume: value }), { configurable: { thread_id } });
        console.log(`[job-enqueue] job ${job.id} resumed thread_id=${thread_id} in ${Date.now() - start}ms`);
    } catch (err) {
        console.error(`[job-enqueue] job ${job.id} threw (thread_id=${thread_id}) after ${Date.now() - start}ms`, err);
        throw err;
    }
}, {
    connection: bullConnection,
    concurrency: 5,
});

worker.on('failed', (job, err) => {
    console.error(`[job-enqueue] job ${job?.id} failed (thread_id=${job?.data.thread_id}):`, err);
});

// worker.close() waits for active resumes to finish and stops new ones from starting, so a
// deploy never cuts a node off mid-step.
onShutdownSignal((signal) => {
    console.log(`[job-enqueue] ${signal} received, finishing active jobs`);
    void runShutdown([
        () => worker.close(),
        () => pool.end(),
    ]);
});
