import { getAgentsQueue, AGENT_PRIORITY } from '../queues/agentsQueue.ts';
import { createAgentRun, cancelAgentRun } from '../services/agentRun/agentRun.service.ts';
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
};

/**
 * Starts an agent in the background: records a queued run and enqueues its start, so the worker
 * decides when it runs under the user's num_agents limit. The job the sweep is on doesn't come
 * through here; its thread runs inline in the analyze request (#149).
 */
export const startAgent = async (run: StartAgent) => {
  const created = await createAgentRun({ ...run, status: 'queued' });
  await getAgentsQueue().add('start', { run_id: created.run_id }, {
    ...JOB_OPTIONS,
    jobId: startJobId(created.run_id),
    priority: AGENT_PRIORITY.start,
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
 * Cancels one of the caller's unfinished runs and drops its start job if it hasn't run yet.
 * A run already inside a node finishes that node; the worker then leaves it cancelled.
 */
export const cancelAgent = async (run_id: string, user_id: string) => {
  const run = await cancelAgentRun(run_id, user_id);
  await getAgentsQueue().remove(startJobId(run_id)).catch(() => 0);
  return run;
};
