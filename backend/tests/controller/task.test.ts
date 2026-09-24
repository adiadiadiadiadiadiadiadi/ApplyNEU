import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import { AppError } from '../../src/errors/AppError.ts';

const addTask = jest.fn<(user_id: string, text: string, description: string, application_id: string) => Promise<any>>();
const toggleTask = jest.fn<(task_id: string, user_id: string) => Promise<any>>();
const getTasks = jest.fn<(user_id: string, includeCompleted: boolean) => Promise<any>>();
const deleteTasksForApplication = jest.fn<(user_id: string, application_id: string) => Promise<any>>();
const addInstructions = jest.fn<(user_id: string, employer_instructions: string, application_id: string, company?: string, title?: string) => Promise<any>>();

const authenticate = jest.fn((req: any, _res: any, next: any) => {
  req.auth = { userId: USER_ID };
  next();
});

jest.unstable_mockModule('../../src/services/task/task.service.ts', () => ({
  addTask,
  toggleTask,
  getTasks,
  deleteTasksForApplication,
}));

jest.unstable_mockModule('../../src/services/task/ai.task.service.ts', () => ({
  addInstructions,
}));

jest.unstable_mockModule('../../src/controller/middleware/authenticate.ts', () => ({
  authenticate: (req: any, res: any, next: any) => authenticate(req, res, next),
}));

const { app } = await import('../../src/app.ts');

const USER_ID = 'test-user-id';
const TASK_ID = 'test-task-id';
const APP_ID = 'test-app-id';

const rejectAuth = () =>
  authenticate.mockImplementation((_req: any, res: any) =>
    res.status(401).json({ message: 'Unauthorized.' })
  );

beforeEach(() => {
  addTask.mockReset();
  toggleTask.mockReset();
  getTasks.mockReset();
  deleteTasksForApplication.mockReset();
  addInstructions.mockReset();
  authenticate.mockReset();
  authenticate.mockImplementation((req: any, _res: any, next: any) => {
    req.auth = { userId: USER_ID };
    next();
  });
});

describe('POST /me/tasks/new', () => {
  it('returns 200 and the created task on valid input', async () => {
    const created = { task_id: TASK_ID, user_id: USER_ID, application_id: APP_ID, text: 'Do thing', description: 'desc', completed: false };
    addTask.mockResolvedValue(created);

    const res = await request(app)
      .post('/me/tasks/new')
      .send({ text: 'Do thing', description: 'desc', application_id: APP_ID });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(created);
    expect(addTask).toHaveBeenCalledWith(USER_ID, 'Do thing', 'desc', APP_ID);
  });

  it('ignores extra body fields and only forwards the known fields', async () => {
    addTask.mockResolvedValue({ task_id: TASK_ID });

    const res = await request(app)
      .post('/me/tasks/new')
      .send({ text: 'Do thing', description: 'desc', application_id: APP_ID, completed: true, foo: 'bar' });

    expect(res.status).toBe(200);
    expect(addTask).toHaveBeenCalledWith(USER_ID, 'Do thing', 'desc', APP_ID);
  });

  it('returns 400 when text is missing', async () => {
    const res = await request(app)
      .post('/me/tasks/new')
      .send({ description: 'desc', application_id: APP_ID });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('text is required.');
    expect(addTask).not.toHaveBeenCalled();
  });

  it('returns 400 when description is missing', async () => {
    const res = await request(app)
      .post('/me/tasks/new')
      .send({ text: 'Do thing', application_id: APP_ID });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('description is required.');
    expect(addTask).not.toHaveBeenCalled();
  });

  it('returns 400 when application_id is missing', async () => {
    const res = await request(app)
      .post('/me/tasks/new')
      .send({ text: 'Do thing', description: 'desc' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('application_id is required.');
    expect(addTask).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is empty', async () => {
    const res = await request(app).post('/me/tasks/new').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('text is required.');
    expect(addTask).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is rejected', async () => {
    rejectAuth();

    const res = await request(app)
      .post('/me/tasks/new')
      .send({ text: 'Do thing', description: 'desc', application_id: APP_ID });

    expect(res.status).toBe(401);
    expect(addTask).not.toHaveBeenCalled();
  });

  it('authenticates before validating the body (invalid body + rejected token -> 401)', async () => {
    rejectAuth();

    const res = await request(app).post('/me/tasks/new').send({});

    expect(res.status).toBe(401);
    expect(addTask).not.toHaveBeenCalled();
  });

  it('propagates an AppError status from the service', async () => {
    addTask.mockRejectedValue(new AppError(409, 'Task already exists.'));

    const res = await request(app)
      .post('/me/tasks/new')
      .send({ text: 'Do thing', description: 'desc', application_id: APP_ID });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Task already exists.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    addTask.mockRejectedValue(new Error('db down'));

    const res = await request(app)
      .post('/me/tasks/new')
      .send({ text: 'Do thing', description: 'desc', application_id: APP_ID });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('POST /me/tasks/add-instructions', () => {
  it('returns 200 and the generated tasks on valid input', async () => {
    const tasks = [{ task_id: TASK_ID, text: 'Upload transcript' }];
    addInstructions.mockResolvedValue(tasks);

    const res = await request(app)
      .post('/me/tasks/add-instructions')
      .send({ employer_instructions: 'Upload transcript', application_id: APP_ID, company: 'Acme', title: 'Engineer' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(tasks);
    expect(addInstructions).toHaveBeenCalledWith(USER_ID, 'Upload transcript', APP_ID, 'Acme', 'Engineer');
  });

  it('forwards undefined for the optional company and title when omitted', async () => {
    addInstructions.mockResolvedValue([]);

    const res = await request(app)
      .post('/me/tasks/add-instructions')
      .send({ employer_instructions: 'Upload transcript', application_id: APP_ID });

    expect(res.status).toBe(200);
    expect(addInstructions).toHaveBeenCalledWith(USER_ID, 'Upload transcript', APP_ID, undefined, undefined);
  });

  it('returns 400 when employer_instructions is missing', async () => {
    const res = await request(app)
      .post('/me/tasks/add-instructions')
      .send({ application_id: APP_ID });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('employer_instructions is required.');
    expect(addInstructions).not.toHaveBeenCalled();
  });

  it('returns 400 when application_id is missing', async () => {
    const res = await request(app)
      .post('/me/tasks/add-instructions')
      .send({ employer_instructions: 'Upload transcript' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('application_id is required.');
    expect(addInstructions).not.toHaveBeenCalled();
  });

  it('returns 401 when the token is rejected', async () => {
    rejectAuth();

    const res = await request(app)
      .post('/me/tasks/add-instructions')
      .send({ employer_instructions: 'Upload transcript', application_id: APP_ID });

    expect(res.status).toBe(401);
    expect(addInstructions).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    addInstructions.mockRejectedValue(new Error('ai failed'));

    const res = await request(app)
      .post('/me/tasks/add-instructions')
      .send({ employer_instructions: 'Upload transcript', application_id: APP_ID });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('DELETE /me/tasks/application/:application_id', () => {
  it('returns 200 and clears tasks for the application', async () => {
    const result = { deleted: 3 };
    deleteTasksForApplication.mockResolvedValue(result);

    const res = await request(app).delete(`/me/tasks/application/${APP_ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
    expect(deleteTasksForApplication).toHaveBeenCalledWith(USER_ID, APP_ID);
  });

  it('returns 401 when the token is rejected', async () => {
    rejectAuth();

    const res = await request(app).delete(`/me/tasks/application/${APP_ID}`);

    expect(res.status).toBe(401);
    expect(deleteTasksForApplication).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    deleteTasksForApplication.mockRejectedValue(new Error('db down'));

    const res = await request(app).delete(`/me/tasks/application/${APP_ID}`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('PUT /tasks/:task_id/complete', () => {
  it('returns 200 and toggles the task completion status', async () => {
    const toggled = { task_id: TASK_ID, completed: true };
    toggleTask.mockResolvedValue(toggled);

    const res = await request(app).put(`/tasks/${TASK_ID}/complete`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(toggled);
    expect(toggleTask).toHaveBeenCalledWith(TASK_ID, USER_ID);
  });

  it('requires authentication', async () => {
    rejectAuth();
    toggleTask.mockResolvedValue({ task_id: TASK_ID, completed: false });

    const res = await request(app).put(`/tasks/${TASK_ID}/complete`);

    expect(res.status).toBe(401);
    expect(toggleTask).not.toHaveBeenCalled();
  });

  it('propagates a 404 AppError when the task is not found', async () => {
    toggleTask.mockRejectedValue(new AppError(404, 'Task not found.'));

    const res = await request(app).put(`/tasks/${TASK_ID}/complete`);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Task not found.');
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    toggleTask.mockRejectedValue(new Error('db down'));

    const res = await request(app).put(`/tasks/${TASK_ID}/complete`);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

describe('GET /me/tasks', () => {
  it('returns 200 and the list of tasks, excluding completed by default', async () => {
    const tasks = [{ task_id: TASK_ID, completed: false }];
    getTasks.mockResolvedValue(tasks);

    const res = await request(app).get('/me/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(tasks);
    expect(getTasks).toHaveBeenCalledWith(USER_ID, false);
  });

  it('passes includeCompleted=true when the query flag is "true"', async () => {
    getTasks.mockResolvedValue([]);

    const res = await request(app).get(`/me/tasks?includeCompleted=true`);

    expect(res.status).toBe(200);
    expect(getTasks).toHaveBeenCalledWith(USER_ID, true);
  });

  it('treats a non-"true" query value as false', async () => {
    getTasks.mockResolvedValue([]);

    const res = await request(app).get(`/me/tasks?includeCompleted=yes`);

    expect(res.status).toBe(200);
    expect(getTasks).toHaveBeenCalledWith(USER_ID, false);
  });

  it('treats an uppercase "TRUE" query value as true (case-insensitive)', async () => {
    getTasks.mockResolvedValue([]);

    const res = await request(app).get(`/me/tasks?includeCompleted=TRUE`);

    expect(res.status).toBe(200);
    expect(getTasks).toHaveBeenCalledWith(USER_ID, true);
  });

  it('returns 401 when the token is rejected', async () => {
    rejectAuth();

    const res = await request(app).get('/me/tasks');

    expect(res.status).toBe(401);
    expect(getTasks).not.toHaveBeenCalled();
  });

  it('returns 500 when the service throws a non-AppError', async () => {
    getTasks.mockRejectedValue(new Error('db down'));

    const res = await request(app).get('/me/tasks');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal server error.');
  });
});

export { USER_ID, TASK_ID, APP_ID };
