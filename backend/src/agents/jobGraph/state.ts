import { Annotation } from '@langchain/langgraph';

/**
 * Saved on every thread. Bump it when a change to the graph would break a thread paused on the
 * previous version, so resumes can tell old threads apart and handle them explicitly.
 */
export const GRAPH_VERSION = 1;

export type JobDecision = 'APPLY' | 'DO_NOT_APPLY';

/**
 * Everything a job's thread carries between nodes, saved in each checkpoint. Holds ids and small values only.
 */
export const JobGraphState = Annotation.Root({
  user_id: Annotation<string>,
  job_id: Annotation<string>,
  match_score: Annotation<number | null>({ reducer: (_, next) => next, default: () => null }),
  decision: Annotation<JobDecision | null>({ reducer: (_, next) => next, default: () => null }),
  graph_version: Annotation<number>({ reducer: (_, next) => next, default: () => GRAPH_VERSION }),
});

export type JobState = typeof JobGraphState.State;
