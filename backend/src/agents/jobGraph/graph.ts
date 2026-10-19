import { END, START, StateGraph } from '@langchain/langgraph';
import { checkpointer } from '../checkpointer.ts';
import { getJobGraphQueue } from '../../queues/jobGraphQueue.ts';
import { decide, jobMatch } from './nodes.ts';
import { JobGraphState } from './state.ts';

/**
 * One job's path from scoring to a decision. Later steps (approval, submit, routing) are added
 * as nodes between decide and END.
 *
 * A node that calls interrupt() runs again from its first line when the thread resumes, so it
 * must do nothing before the interrupt that can't safely happen twice. Put writes in the node
 * before it.
 */
export const jobGraph = new StateGraph(JobGraphState)
  .addNode('jobMatch', jobMatch)
  .addNode('decide', decide)
  .addEdge(START, 'jobMatch')
  .addEdge('jobMatch', 'decide')
  .addEdge('decide', END)
  .compile({ checkpointer });

/** Starts or continues the job's thread, checkpointing each step under thread_id. */
export const runJobThread = (thread_id: string, input: { user_id: string; job_id: string }) =>
  jobGraph.invoke(input, { configurable: { thread_id } });

/** How long a finished resume job is kept, so a repeated resume for the same pause is ignored. */
const RESUME_DEDUP_SECONDS = 24 * 60 * 60;

/**
 * Hands a paused thread to the worker instead of resuming it inline, so long nodes never run
 * inside an API request. The job id is `${thread_id}:${step}`, so resuming the same pause twice
 * (a double-clicked approve) enqueues once, while the thread's next pause gets a new id.
 * @param thread_id - Thread to resume
 * @param step - The pause being resumed, e.g. 'approval'
 * @param value - What the paused node receives, e.g. { approved: true }
 */
export const resumeJobThread = (thread_id: string, step: string, value: unknown) =>
  getJobGraphQueue().add(
    'resume',
    { thread_id, value },
    {
      jobId: `${thread_id}:${step}`,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: RESUME_DEDUP_SECONDS },
      removeOnFail: { age: RESUME_DEDUP_SECONDS },
    }
  );
