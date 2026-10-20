import { END, START, StateGraph } from '@langchain/langgraph';
import { checkpointer } from '../checkpointer.ts';
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
