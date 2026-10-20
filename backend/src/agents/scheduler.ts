import { getAgentsQueue, AGENT_PRIORITY } from '../queues/agentsQueue.ts';
import { createAgentRun, getAgentRunForUser, cancelAgentRun } from '../services/agentRun/agentRun.service.ts';
import { AppError } from '../errors/AppError.ts';
import type { AgentRunType } from '../types/agentRuns.ts';

/** How long a finished job is kept, so a repeated start or resume for the same step is ignored. */
const DEDUP_SECONDS = 24 * 60 * 60;

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: { age: DEDUP_SECONDS },
  removeOnFail: { age: DEDUP_SECONDS },
};

const startJobId = (run_id: string) => `start:${run_id}`;

type StartAgent = {
  user_id: string;
  type: AgentRunType;
  title: string;
  job_id?: string;
  parent_run_id?: string;
  source: 'user' | 'sweep';
};

/**
 * The only way to start an agent: records a queued run and enqueues its start, so the worker
 * decides when it actually runs under the user's limits. Nothing starts a graph directly.
 */
export const startAgent = async ({ source, ...run }: StartAgent) => {
  const created = await createAgentRun({ ...run, status: 'queued' });
  await getAgentsQueue().add('start', { run_id: created.run_id }, {
    ...JOB_OPTIONS,
    jobId: startJobId(created.run_id),
    priority: AGENT_PRIORITY[source],
  });
  return created;
};

/**
 * Hands a paused thread to the worker instead of resuming it inline, so long nodes never run
 * inside an API request. The job id is `${thread_id}:${step}`, so resuming the same pause twice
 * (a double-clicked approve) enqueues once, while the thread's next pause gets a new id.
 * @param thread_id - Thread to resume
 * @param step - The pause being resumed, e.g. 'approval'
 * @param value - What the paused node receives, e.g. { approved: true }
 */
export const resumeJobThread = (thread_id: string, step: string, value: unknown) =>
  getAgentsQueue().add('resume', { thread_id, value }, {
    ...JOB_OPTIONS,
    jobId: `${thread_id}:${step}`,
    priority: AGENT_PRIORITY.resume,
  });

/**
 * Starts one of the caller's queued runs as soon as a worker is free, ahead of every
 * prioritized job and past the user's max_agents limit. The one-NUWorks-run rule still holds.
 * @throws AppError(409) when the run isn't queued
 */
export const runAgentNow = async (run_id: string, user_id: string) => {
  const run = await getAgentRunForUser(run_id, user_id);
  if (run.status !== 'queued') throw new AppError(409, 'Only a queued run can be started now.');
  const job = await getAgentsQueue().getJob(startJobId(run_id));
  if (!job) throw new AppError(409, 'This run is no longer waiting to start.');
  await job.updateData({ ...job.data, force: true });
  if (await job.isDelayed()) await job.promote();
  await job.changePriority({ priority: 0 });
  return run;
};

/**
 * Cancels one of the caller's unfinished runs and drops its start job if it hasn't run yet.
 * A run already inside a node finishes that node; the worker then leaves it cancelled.
 */
export const cancelAgent = async (run_id: string, user_id: string) => {
  const run = await cancelAgentRun(run_id, user_id);
  await getAgentsQueue().remove(startJobId(run_id)).catch(() => 0);
  return run;
};
