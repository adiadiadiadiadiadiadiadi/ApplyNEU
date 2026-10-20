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

type RunWithThread = AgentRun & { user_id: string; thread_id: string | null };

const FINISHED: AgentRunStatus[] = ['done', 'failed', 'handed_off', 'cancelled'];

/**
 * Runs that open a browser and so count toward the user's max_agents. Everything else (job
 * threads, cover letters) goes through the queue without taking a slot; their model calls are
 * limited separately.
 */
const SLOT_TYPES: AgentRunType[] = ['external_apply'];

/**
 * Fetches a run by id with its owner and thread, for the worker.
 * @throws AppError(404) when no run has that id
 */
export const getAgentRun = async (run_id: string): Promise<RunWithThread> => {
  const result = await pool.query<RunWithThread>(
    `SELECT ${RUN_COLUMNS}, user_id, thread_id FROM agent_runs WHERE run_id = $1;`,
    [run_id]
  );
  if (!result.rows[0]) throw new AppError(404, 'Agent run not found.');
  return result.rows[0];
};

/**
 * Fetches the run that owns a LangGraph thread, for resumes.
 * @throws AppError(404) when no run has that thread
 */
export const getAgentRunByThread = async (thread_id: string): Promise<RunWithThread> => {
  const result = await pool.query<RunWithThread>(
    `SELECT ${RUN_COLUMNS}, user_id, thread_id FROM agent_runs WHERE thread_id = $1;`,
    [thread_id]
  );
  if (!result.rows[0]) throw new AppError(404, 'Agent run not found.');
  return result.rows[0];
};

/**
 * Fetches one of the caller's runs.
 * @throws AppError(404) when the run doesn't exist or belongs to someone else
 */
export const getAgentRunForUser = async (run_id: string, user_id: string): Promise<AgentRun> => {
  const result = await pool.query<AgentRun>(
    `SELECT ${RUN_COLUMNS} FROM agent_runs WHERE run_id = $1 AND user_id = $2;`,
    [run_id, user_id]
  );
  if (!result.rows[0]) throw new AppError(404, 'Agent run not found.');
  return result.rows[0];
};

export type ClaimResult = 'claimed' | 'full' | 'gone';

/**
 * Moves a run to running. A browser run (SLOT_TYPES) only moves if the user has fewer running
 * browser runs than their max_agents; runs waiting on the user don't hold a slot. A per-user
 * advisory lock serializes those claims, so two workers can't both take the last slot. Other
 * runs move straight away. `force` (run-now) skips max_agents.
 * @param from - Statuses the run may be claimed from: queued for a start, waiting_for_you for a resume
 * @returns claimed, full (try again later), or gone (cancelled or finished; drop the job)
 */
export const claimAgentRun = async (
  run_id: string,
  from: AgentRunStatus[],
  { force = false }: { force?: boolean } = {}
): Promise<ClaimResult> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [run] } = await client.query(
      `SELECT user_id, type, status FROM agent_runs WHERE run_id = $1;`,
      [run_id]
    );
    if (!run || !from.includes(run.status)) {
      await client.query('ROLLBACK');
      return 'gone';
    }
    if (SLOT_TYPES.includes(run.type) && !force) {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [run.user_id]);
      const { rows: [slots] } = await client.query(
        `
          SELECT
            (SELECT count(*)::int FROM agent_runs
             WHERE user_id = $1 AND status = 'running' AND type = ANY($2)) AS running,
            (SELECT max_agents FROM preferences WHERE user_id = $1) AS max_agents;
        `,
        [run.user_id, SLOT_TYPES]
      );
      if (slots.running >= (slots.max_agents ?? 2)) {
        await client.query('ROLLBACK');
        return 'full';
      }
    }
    await client.query(
      `UPDATE agent_runs SET status = 'running', updated_at = now() WHERE run_id = $1;`,
      [run_id]
    );
    await client.query('COMMIT');
    return 'claimed';
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Moves a run between statuses only if it's still in one of `from`, so a run cancelled while
 * a node was running isn't flipped back to done or waiting.
 * @returns whether the run moved
 */
export const moveAgentRun = async (run_id: string, from: AgentRunStatus[], to: AgentRunStatus) => {
  const result = await pool.query(
    `
      UPDATE agent_runs SET status = $3, updated_at = now()
      WHERE run_id = $1 AND status = ANY($2::agent_run_status[]);
    `,
    [run_id, from, to]
  );
  return (result.rowCount ?? 0) > 0;
};

/**
 * Cancels one of the caller's unfinished runs.
 * @throws AppError(404) when the run doesn't exist or isn't theirs; AppError(409) when it already finished
 */
export const cancelAgentRun = async (run_id: string, user_id: string): Promise<AgentRun> => {
  const run = await getAgentRunForUser(run_id, user_id);
  if (FINISHED.includes(run.status)) throw new AppError(409, 'This run has already finished.');
  const result = await pool.query<AgentRun>(
    `
      UPDATE agent_runs SET status = 'cancelled', updated_at = now()
      WHERE run_id = $1 AND user_id = $2
      RETURNING ${RUN_COLUMNS};
    `,
    [run_id, user_id]
  );
  return result.rows[0]!;
};
