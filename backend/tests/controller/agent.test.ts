import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { AppError } from '../../src/errors/AppError.ts';

const listAgentRuns = jest.fn<(user_id: string) => Promise<any>>();

const authenticate = jest.fn((req: any, _res: any, next: any) => {
  req.auth = { userId: USER_ID };
  next();
});

jest.unstable_mockModule('../../src/services/agentRun/agentRun.service.ts', () => ({ listAgentRuns }));
jest.unstable_mockModule('../../src/controller/middleware/authenticate.ts', () => ({
  authenticate: (req: any, res: any, next: any) => authenticate(req, res, next),
}));

const { app } = await import('../../src/app.ts');

const USER_ID = 'test-user-id';
const GROUPS = { needs_you: [], running: [{ run_id: 'run-1' }], queued: [], recent: [] };

beforeEach(() => {
  listAgentRuns.mockReset().mockResolvedValue(GROUPS);
  authenticate.mockReset().mockImplementation((req: any, _res: any, next: any) => {
    req.auth = { userId: USER_ID };
    next();
  });
});

describe('GET /me/agents', () => {
  it("returns the caller's grouped runs", async () => {
    const res = await request(app).get('/me/agents');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(GROUPS);
    expect(listAgentRuns).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 401 without a valid token', async () => {
    authenticate.mockImplementation((_req: any, res: any) => res.status(401).json({ message: 'Unauthorized.' }));

    const res = await request(app).get('/me/agents');

    expect(res.status).toBe(401);
    expect(listAgentRuns).not.toHaveBeenCalled();
  });

  it('passes a service error through', async () => {
    listAgentRuns.mockRejectedValue(new AppError(500, 'Error fetching agent runs.'));

    const res = await request(app).get('/me/agents');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Error fetching agent runs.');
  });
});
