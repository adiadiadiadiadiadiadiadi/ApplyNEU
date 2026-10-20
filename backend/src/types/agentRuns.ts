export type AgentRunType = 'sweep' | 'job' | 'external_apply' | 'cover_letter';

export type AgentRunStatus = 'queued' | 'running' | 'waiting_for_you' | 'done' | 'failed' | 'handed_off' | 'cancelled';

export type AgentRun = {
  run_id: string;
  type: AgentRunType;
  parent_run_id: string | null;
  job_id: string | null;
  status: AgentRunStatus;
  title: string;
  started_at: string;
  updated_at: string;
};

/** A run just handed a slot: a start, or a resume carrying the user's answer. */
export type WokenRun = {
  run_id: string;
  thread_id: string | null;
  resume: { step: string; value: unknown } | null;
};

export type AgentRunGroups = {
  needs_you: AgentRun[];
  running: AgentRun[];
  queued: AgentRun[];
  recent: AgentRun[];
};
