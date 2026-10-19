import { getJobById } from '../../services/job.service.ts';
import { getUserPreferences } from '../../services/preference.service.ts';
import { decideFromScore, sendJobDescription } from '../../services/jobMatch/jobMatch.service.ts';
import type { JobState } from './state.ts';

/**
 * Scores the posting through the existing job match path, so the score cache, instruction memo
 * and per-user rate limit still apply. The instructions it returns aren't kept yet; #150 stores
 * them and puts their ids in state.
 */
export const jobMatch = async (state: JobState): Promise<Partial<JobState>> => {
  const job = await getJobById(state.job_id);
  const { match_score } = await sendJobDescription(state.user_id, job.description, job.company, job.title);
  return { match_score };
};

/**
 * Applies the user's job_match threshold in code. The preference is read here rather than
 * carried in state, so changing it mid-sweep affects the next job.
 */
export const decide = async (state: JobState): Promise<Partial<JobState>> => {
  if (state.match_score === null) throw new Error('decide ran before jobMatch scored the job.');
  const { job_match } = await getUserPreferences(state.user_id);
  return { decision: decideFromScore(state.match_score, job_match) };
};
