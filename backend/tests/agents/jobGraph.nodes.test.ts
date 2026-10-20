import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const getJobById = jest.fn<(job_id: string) => Promise<any>>();
const getUserPreferences = jest.fn<(user_id: string) => Promise<any>>();
const sendJobDescription = jest.fn<(...args: string[]) => Promise<any>>();
const decideFromScore = jest.fn<(match_score: number, job_match: string) => string>();

jest.unstable_mockModule('../../src/services/job.service.ts', () => ({ getJobById }));
jest.unstable_mockModule('../../src/services/preference.service.ts', () => ({ getUserPreferences }));
jest.unstable_mockModule('../../src/services/jobMatch/jobMatch.service.ts', () => ({ sendJobDescription, decideFromScore }));

const { jobMatch, decide } = await import('../../src/agents/jobGraph/nodes.ts');
const { GRAPH_VERSION } = await import('../../src/agents/jobGraph/state.ts');

const state = (overrides = {}) => ({
  user_id: 'user-1',
  job_id: 'job-1',
  match_score: null,
  rationale: null,
  decision: null,
  requires_approval: false,
  graph_version: GRAPH_VERSION,
  ...overrides,
});

beforeEach(() => {
  getJobById.mockReset().mockResolvedValue({ job_id: 'job-1', company: 'Acme', title: 'SWE Co-op', description: 'Build things.' });
  getUserPreferences.mockReset().mockResolvedValue({ job_match: 'medium', wait_for_approval: true });
  sendJobDescription.mockReset().mockResolvedValue({ decision: 'APPLY', match_score: 72, rationale: 'Good fit.', employer_instructions: [] });
  decideFromScore.mockReset().mockReturnValue('APPLY');
});

describe('jobMatch', () => {
  it('scores the stored posting through sendJobDescription and returns the score and rationale', async () => {
    const update = await jobMatch(state());

    expect(getJobById).toHaveBeenCalledWith('job-1');
    expect(sendJobDescription).toHaveBeenCalledWith('user-1', 'Build things.', 'Acme', 'SWE Co-op');
    expect(update).toEqual({ match_score: 72, rationale: 'Good fit.' });
  });
});

describe('decide', () => {
  it("decides from the score and the user's current job_match preference", async () => {
    getUserPreferences.mockResolvedValue({ job_match: 'high', wait_for_approval: true });
    decideFromScore.mockReturnValue('DO_NOT_APPLY');

    const update = await decide(state({ match_score: 60 }));

    expect(getUserPreferences).toHaveBeenCalledWith('user-1');
    expect(decideFromScore).toHaveBeenCalledWith(60, 'high');
    expect(update).toEqual({ decision: 'DO_NOT_APPLY', requires_approval: false });
  });

  it.each([
    [true, true],
    [false, false],
  ])('requires approval for APPLY when wait_for_approval is %s', async (wait_for_approval, requires_approval) => {
    getUserPreferences.mockResolvedValue({ job_match: 'medium', wait_for_approval });

    const update = await decide(state({ match_score: 80 }));

    expect(update).toEqual({ decision: 'APPLY', requires_approval });
  });

  it('throws if no score has been set', async () => {
    await expect(decide(state())).rejects.toThrow('decide ran before jobMatch');
    expect(decideFromScore).not.toHaveBeenCalled();
  });
});
