export type AgentRunType = 'sweep' | 'job' | 'external_apply' | 'cover_letter';

export type AgentRunStatus = 'queued' | 'running' | 'waiting_for_you' | 'done' | 'failed' | 'handed_off' | 'cancelled';

export type AgentRun = {
  run_id: string;
  type: AgentRunType;
  parent_run_id: string | null;
  job_id: string | null;
  status: AgentRunStatus;
  current_step: string | null;
  title: string;
  started_at: string;
  updated_at: string;
};

export type AgentRunGroups = {
  needs_you: AgentRun[];
  running: AgentRun[];
  queued: AgentRun[];
  recent: AgentRun[];
};
