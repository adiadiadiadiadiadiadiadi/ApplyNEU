import { randomUUID } from 'node:crypto';
import { pool } from '../../db/index.ts';
import { AppError } from '../../errors/AppError.ts';
import type { AgentRun, AgentRunGroups, AgentRunStatus, AgentRunType } from '../../types/agentRuns.ts';

/** Finished runs shown on the homepage; active runs are always shown in full. */
const RECENT_LIMIT = 20;

const RUN_COLUMNS = 'run_id, type, parent_run_id, job_id, status, title, started_at, updated_at';

/**
 * Lists the caller's agent runs grouped for the homepage, each group newest activity first:
 * runs waiting on the user, running, queued, and the most recent finished ones.
 * @param user_id - Owner of the runs
 */
export const listAgentRuns = async (user_id: string): Promise<AgentRunGroups> => {
  try {
    const [active, recent] = await Promise.all([
      pool.query<AgentRun>(
        `
          SELECT ${RUN_COLUMNS}
          FROM agent_runs
          WHERE user_id = $1 AND status IN ('queued', 'running', 'waiting_for_you')
          ORDER BY updated_at DESC;
        `,
        [user_id]
      ),
      pool.query<AgentRun>(
        `
          SELECT ${RUN_COLUMNS}
          FROM agent_runs
          WHERE user_id = $1 AND status IN ('done', 'failed', 'handed_off', 'cancelled')
          ORDER BY updated_at DESC
          LIMIT $2;
        `,
        [user_id, RECENT_LIMIT]
      ),
    ]);
    const withStatus = (status: AgentRunStatus) => active.rows.filter((run) => run.status === status);
    return {
      needs_you: withStatus('waiting_for_you'),
      running: withStatus('running'),
      queued: withStatus('queued'),
      recent: recent.rows,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error fetching agent runs.');
  }
};

type NewAgentRun = {
  user_id: string;
  type: AgentRunType;
  title: string;
  job_id?: string;
  parent_run_id?: string;
  status?: AgentRunStatus;
};

/**
 * Records a new run. Every type except sweep gets a fresh thread_id for its LangGraph thread,
 * returned so the caller can start the graph on it.
 * @throws AppError(409) when the user already has an unfinished run for this job
 */
export const createAgentRun = async ({
  user_id, type, title, job_id, parent_run_id, status = 'queued',
}: NewAgentRun): Promise<AgentRun & { thread_id: string | null }> => {
  try {
    const result = await pool.query(
      `
        INSERT INTO agent_runs (user_id, type, title, job_id, parent_run_id, thread_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING ${RUN_COLUMNS}, thread_id;
      `,
      [user_id, type, title, job_id ?? null, parent_run_id ?? null, type === 'sweep' ? null : randomUUID(), status]
    );
    return result.rows[0];
  } catch (error) {
    if ((error as { constraint?: string }).constraint === 'agent_runs_one_active_job') {
      throw new AppError(409, 'This job already has an active run.');
    }
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error creating agent run.');
  }
};

/**
 * Moves a run to a new status and bumps updated_at, so the homepage sorts by latest activity.
 * Called by the graph and workers, which act on a run they already own, so it isn't scoped to
 * a user.
 * @throws AppError(404) when no run has that id
 */
export const updateAgentRunStatus = async (run_id: string, status: AgentRunStatus): Promise<AgentRun> => {
  try {
    const result = await pool.query<AgentRun>(
      `
        UPDATE agent_runs
        SET status = $2, updated_at = now()
        WHERE run_id = $1
        RETURNING ${RUN_COLUMNS};
      `,
      [run_id, status]
    );
    if (!result.rows[0]) throw new AppError(404, 'Agent run not found.');
    return result.rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'Error updating agent run.');
  }
};
