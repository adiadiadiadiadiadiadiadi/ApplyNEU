import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { AppError } from '../../src/errors/AppError.ts';

const addUser = jest.fn<(user_id: string, first_name: string, last_name: string, email: string, grad_year: number) => Promise<any>>();
const getUser = jest.fn<(user_id: string) => Promise<any>>();
const updateUser = jest.fn<(user_id: string, first_name: string, last_name: string, email: string, grad_year: number) => Promise<any>>();
const getUserApplicationStats = jest.fn<(user_id: string) => Promise<any>>();

const requireUser = jest.fn((_req: any, _res: any, next: any) => next());

jest.unstable_mockModule('../../src/services/user/user.service.ts', () => ({
  addUser,
  getUser,
  updateUser,
}));

jest.unstable_mockModule('../../src/services/application.service.ts', () => ({
  addJobApplication: jest.fn(),
  getUserApplicationStats,
  getUserApplications: jest.fn(),
  updateApplicationStatus: jest.fn(),
}));

jest.unstable_mockModule('../../src/controller/middleware/requireUser.ts', () => ({
  requireUser: (req: any, res: any, next: any) => requireUser(req, res, next),
}));

const { app } = await import('../../src/app.ts');

const USER_ID = 'test-user-id';

const validUserBody = {
  user_id: USER_ID,
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@northeastern.edu',
  grad_year: 2026,
};

const rejectUser = () =>
  requireUser.mockImplementation((_req: any, res: any) =>
    res.status(401).json({ message: 'Unauthorized.' })
  );

beforeEach(() => {
  addUser.mockReset();
  getUser.mockReset();
  updateUser.mockReset();
  getUserApplicationStats.mockReset();
  requireUser.mockReset();
  requireUser.mockImplementation((_req: any, _res: any, next: any) => next());
});

describe('POST /users/new', () => {
  it('returns 200 and the created user on valid input', async () => {
    const created = { ...validUserBody };
    addUser.mockResolvedValue(created);

    const res = await request(app).post('/users/new').send(validUserBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
    expect(addUser).toHaveBeenCalledWith(USER_ID, 'Ada', 'Lovelace', 'ada@northeastern.edu', 2026);
  });

  it('ignores extra body fields and only forwards the known fields', async () => {
    addUser.mockResolvedValue({ ...validUserBody });

    const res = await request(app)
      .post('/users/new')
      .send({ ...validUserBody, role: 'admin', extra: true });

    expect(res.status).toBe(200);
    expect(addUser).toHaveBeenCalledWith(USER_ID, 'Ada', 'Lovelace', 'ada@northeastern.edu', 2026);
  });

  it.each(['user_id', 'first_name', 'last_name', 'email', 'grad_year'])(
    'returns 400 when %s is missing',
    async (field) => {
      const body: Record<string, unknown> = { ...validUserBody };
      delete body[field];

      const res = await request(app).post('/users/new').send(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(`${field} is required.`);
      expect(addUser).not.toHaveBeenCalled();
    }
  );

  it('returns 400 when the body is empty', async () => {
    const res = await request(app).post('/users/new').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('user_id is required.');
    expect(addUser).not.toHaveBeenCalled();
  });

  it('does not require an existing user (requireUser is not applied to this route)', async () => {
    rejectUser();
    addUser.mockResolvedValue({ ...validUserBody });

    const res = await request(app).post('/users/new').send(validUserBody);

    expect(res.status).toBe(200);
    expect(requireUser).not.toHaveBeenCalled();
  });

  it('propagates an AppError status from the service', async () => {
    addUser.mockRejectedValue(new AppError(409, 'User already exists.'));

    const res = await request(app).post('/users/new').send(validUserBody);

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('User already exists.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    addUser.mockRejectedValue(new Error('db down'));

    const res = await request(app).post('/users/new').send(validUserBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('GET /users/:user_id', () => {
  it('returns 200 and the user record when found', async () => {
    const user = { ...validUserBody };
    getUser.mockResolvedValue(user);

    const res = await request(app).get(`/users/${USER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(user);
    expect(getUser).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 404 when the user does not exist', async () => {
    getUser.mockRejectedValue(new AppError(404, 'User not found.'));

    const res = await request(app).get(`/users/${USER_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    getUser.mockRejectedValue(new Error('db down'));

    const res = await request(app).get(`/users/${USER_ID}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('PUT /users/:user_id', () => {
  const updateBody = {
    first_name: 'Grace',
    last_name: 'Hopper',
    email: 'grace@northeastern.edu',
    grad_year: 2027,
  };

  it('returns 200 and the updated user on valid input', async () => {
    const updated = { user_id: USER_ID, ...updateBody };
    updateUser.mockResolvedValue(updated);

    const res = await request(app).put(`/users/${USER_ID}`).send(updateBody);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(updated);
    expect(updateUser).toHaveBeenCalledWith(USER_ID, 'Grace', 'Hopper', 'grace@northeastern.edu', 2027);
  });

  it.each(['first_name', 'last_name', 'email', 'grad_year'])(
    'returns 400 when %s is missing',
    async (field) => {
      const body: Record<string, unknown> = { ...updateBody };
      delete body[field];

      const res = await request(app).put(`/users/${USER_ID}`).send(body);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(`${field} is required.`);
      expect(updateUser).not.toHaveBeenCalled();
    }
  );

  it('returns 401 when user does not exist', async () => {
    rejectUser();

    const res = await request(app).put(`/users/${USER_ID}`).send(updateBody);

    expect(res.status).toBe(401);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('validates the body before checking the user (invalid body + missing user -> 400)', async () => {
    rejectUser();

    const res = await request(app).put(`/users/${USER_ID}`).send({});

    expect(res.status).toBe(400);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('propagates a 404 AppError when the user disappears between checks', async () => {
    updateUser.mockRejectedValue(new AppError(404, 'User not found.'));

    const res = await request(app).put(`/users/${USER_ID}`).send(updateBody);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User not found.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    updateUser.mockRejectedValue(new Error('db down'));

    const res = await request(app).put(`/users/${USER_ID}`).send(updateBody);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('GET /users/:user_id/application-stats', () => {
  it('returns 200 and the aggregate application stats', async () => {
    const stats = { pending: 1, applied: 2, interview: 0, offer: 0, rejected: 1 };
    getUserApplicationStats.mockResolvedValue(stats);

    const res = await request(app).get(`/users/${USER_ID}/application-stats`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(stats);
    expect(getUserApplicationStats).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 401 when user does not exist', async () => {
    rejectUser();

    const res = await request(app).get(`/users/${USER_ID}/application-stats`);

    expect(res.status).toBe(401);
    expect(getUserApplicationStats).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    getUserApplicationStats.mockRejectedValue(new Error('db down'));

    const res = await request(app).get(`/users/${USER_ID}/application-stats`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

export { USER_ID };
