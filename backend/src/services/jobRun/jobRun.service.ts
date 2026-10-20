import { jobGraph, runJobThread } from '../../agents/jobGraph/graph.ts';
import { AppError } from '../../errors/AppError.ts';
import { normalizeAndHash } from '../../utils/hash.ts';
import { createAgentRun, getActiveJobRun, updateAgentRunStatus } from '../agentRun/agentRun.service.ts';
import { getInstructions } from '../instructions/instructions.service.ts';
import { addJob } from '../job.service.ts';

type Job = { job_id: string; company: string; title: string };

/**
 * Creates the job's run, or loads the active one when an earlier analyze already started it.
 * @throws AppError(409) when the active run finished between the insert and the lookup
 */
const startJobRun = async (user_id: string, job: Job) => {
  try {
    return await createAgentRun({
      user_id, type: 'job', title: `${job.title} at ${job.company}`, job_id: job.job_id, status: 'running',
    });
  } catch (error) {
    if (!(error instanceof AppError) || error.status !== 409) throw error;
    const active = await getActiveJobRun(user_id, job.job_id);
    if (!active) throw error;
    return active;
  }
};

/**
 * Runs the posting's job thread to its first interrupt or its end and answers from the thread's
 * state. A thread already paused on the user is answered as it stands; any other active thread
 * is run again, which is safe because its nodes are idempotent. The run is marked
 * waiting_for_you when the thread paused, done when it ended, and failed when it threw.
 * @param user_id - User evaluating the job
 * @param job_description - Full text of the job posting
 * @param company - Company name
 * @param title - Job title
 */
export const analyzeJob = async (user_id: string, job_description: string, company: string, title: string) => {
  const job = await addJob(company, title, job_description);
  const run = await startJobRun(user_id, job);
  const config = { configurable: { thread_id: run.thread_id! } };

  const before = await jobGraph.getState(config);
  if (!before.tasks.some((task) => task.interrupts.length > 0)) {
    try {
      await runJobThread(run.thread_id!, { user_id, job_id: job.job_id });
    } catch (error) {
      await updateAgentRunStatus(run.run_id, 'failed').catch((statusError) => {
        console.error(`[jobRun] could not mark run ${run.run_id} failed:`, statusError);
      });
      throw error;
    }
  }

  const { values, next } = await jobGraph.getState(config);
  const [employer_instructions] = await Promise.all([
    getInstructions(normalizeAndHash(job.description)),
    updateAgentRunStatus(run.run_id, next.length ? 'waiting_for_you' : 'done'),
  ]);
  return {
    decision: values.decision,
    match_score: values.match_score,
    rationale: values.rationale,
    requires_approval: values.requires_approval,
    employer_instructions: employer_instructions ?? [],
  };
};
