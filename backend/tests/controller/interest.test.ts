import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';

const USER_ID = 'test-user-id';

const authenticate = jest.fn((req: any, _res: any, next: any) => {
  req.auth = { userId: USER_ID };
  next();
});

jest.unstable_mockModule('../../src/controller/middleware/authenticate.ts', () => ({
  authenticate: (req: any, res: any, next: any) => authenticate(req, res, next),
}));

const { app } = await import('../../src/app.ts');
const { INTERESTS } = await import('../../src/constants/interests.ts');

beforeEach(() => {
  authenticate.mockReset();
  authenticate.mockImplementation((req: any, _res: any, next: any) => {
    req.auth = { userId: USER_ID };
    next();
  });
});

describe('GET /interests', () => {
  it('returns 200 and the preset list', async () => {
    const res = await request(app).get('/interests');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([...INTERESTS]);
  });

  it('returns 401 when the caller is not authenticated', async () => {
    authenticate.mockImplementation((_req: any, res: any) =>
      res.status(401).json({ message: 'Unauthorized.' })
    );

    const res = await request(app).get('/interests');

    expect(res.status).toBe(401);
  });
});

describe('INTERESTS', () => {
  it('has no duplicates', () => {
    expect(new Set(INTERESTS).size).toBe(INTERESTS.length);
  });
});
